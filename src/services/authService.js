// Authentication & RBAC Service for PetCare PRO AI
import { sound } from './soundService.js';
import { handleUserDeletedDataRetention } from './storageService.js';

export const AUTH_STORAGE_KEYS = {
  USERS: 'petcare_auth_users_v1',
  SESSION: 'petcare_auth_session_v1',
  REMEMBER: 'petcare_auth_remember_v1',
  DELETED_USERS: 'petcare_deleted_users_v1'
};

// Chuẩn hóa hệ thống vai trò toàn hệ sinh thái
export const ROLES = {
  SYSTEM_ADMIN: 'system_admin',
  VET_DOCTOR: 'vet_doctor',
  PET_OWNER: 'pet_owner'
};

// Trạng thái phê duyệt chứng chỉ bác sĩ thú y
export const VET_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

// 1. Quản trị viên hệ thống ban đầu (Dedicated System Admin Seed)
export const INITIAL_SYSTEM_ADMIN = {
  id: 'user_admin_01',
  name: 'Quản trị viên Hệ thống',
  email: 'admin@petcare.ai',
  phone: '0901.000.888',
  address: 'Trụ sở chính PetCare AI, Hà Nội',
  role: ROLES.SYSTEM_ADMIN,
  isLocked: false,
  vetStatus: null,
  mustChangePassword: false,
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
  createdAt: '2026-01-01T08:00:00.000Z'
};

// 2. Bác sĩ thú y kiểm thử chuẩn hệ thống (Approved Vet Doctor Seed)
export const INITIAL_VET_DOCTOR = {
  id: 'user_vet_01',
  name: 'BS. Nguyễn Văn A (Tester)',
  email: 'tester@petcare.ai',
  phone: '0988.123.456',
  address: 'Bệnh viện Thú y PetCare AI',
  role: ROLES.VET_DOCTOR,
  isLocked: false,
  vetStatus: VET_STATUS.APPROVED,
  mustChangePassword: false,
  avatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80',
  createdAt: '2026-01-01T08:00:00.000Z',
  facilityId: null,
  facilityIds: []
};

// 3. Chủ nuôi chính (Pet Owner)
export const INITIAL_PET_OWNER = {
  id: 'user_1791541299976_7ebbe5',
  name: 'Đinh Xuân Mạnh',
  email: 'manhdinh2907@gmail.com',
  phone: '',
  address: 'Việt Nam',
  role: ROLES.PET_OWNER,
  isLocked: false,
  vetStatus: null,
  mustChangePassword: false,
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&auto=format&fit=crop&q=80',
  createdAt: '2026-10-09T10:21:40.033Z'
};

const getStored = (key, fallback) => {
  try {
    const item = localStorage.getItem(key);
    if (!item) return fallback;
    return JSON.parse(item);
  } catch {
    return fallback;
  }
};

const setStored = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error saving ${key}:`, error);
  }
};

export const getAuthHeaders = () => {
  const rawToken = typeof localStorage !== 'undefined' 
    ? (localStorage.getItem('petcare_auth_token') || localStorage.getItem('petcare_token')) 
    : null;
  const token = (rawToken && rawToken !== 'null' && rawToken !== 'undefined' && rawToken.trim() !== '') ? rawToken.trim() : null;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

// Chuẩn hóa một bản ghi user từ dữ liệu cũ sang định dạng bảo mật RBAC v2
const normalizeUserRecord = (user) => {
  if (!user) return null;
  let role = user.role;
  if (role === 'CLINIC_ADMIN' || role === 'vet') role = ROLES.VET_DOCTOR;
  if (role === 'OWNER') role = ROLES.PET_OWNER;
  if (role !== ROLES.SYSTEM_ADMIN && role !== ROLES.VET_DOCTOR && role !== ROLES.PET_OWNER) {
    role = ROLES.PET_OWNER;
  }

  let vetStatus = user.vetStatus;
  if (role === ROLES.VET_DOCTOR && !vetStatus) {
    vetStatus = VET_STATUS.APPROVED;
  } else if (role !== ROLES.VET_DOCTOR) {
    vetStatus = null;
  }

  // Đảm bảo ID ổn định kiểu chuỗi, không sinh ID ngẫu nhiên mới mỗi lần chuẩn hóa
  const cleanId = user.id ? String(user.id).trim() : `user_${Date.now()}`;

  return {
    id: cleanId,
    name: (user.name || 'Người dùng PetCare').trim(),
    email: (user.email || '').trim().toLowerCase(),
    phone: user.phone || '',
    address: user.address || 'Việt Nam',
    role,
    isLocked: Boolean(user.isLocked),
    vetStatus,
    mustChangePassword: Boolean(user.mustChangePassword),
    avatar: user.avatar || (
      role === ROLES.SYSTEM_ADMIN
        ? INITIAL_SYSTEM_ADMIN.avatar
        : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150'
    ),
    createdAt: user.createdAt || new Date().toISOString(),
    passwordChangedAt: user.passwordChangedAt || null,
    facilityId: user.facilityId || null,
    facilityIds: Array.isArray(user.facilityIds) ? user.facilityIds : (user.facilityId ? [user.facilityId] : [])
  };
};

// Lấy danh sách users từ localStorage (dùng nội bộ, không import legacy)
// Backend là nguồn sự thật; hàm này chỉ đọc snapshot cuối cùng đã đồng bộ.
export const getUsers = () => {
  const deletedList = getStored(AUTH_STORAGE_KEYS.DELETED_USERS, []);

  // Kiểm tra tài khoản đã bị xóa theo ID
  const isUserDeleted = (id) => {
    if (!id) return false;
    const cleanId = String(id).trim();
    return deletedList.some(d => cleanId && String(d.id).trim() === cleanId);
  };

  // Kiểm tra tài khoản mẫu đã bị xóa để ngăn tự tái sinh
  const isSeedDeleted = (seedId) => {
    if (!seedId) return false;
    const cleanId = String(seedId).trim();
    return deletedList.some(d => cleanId && String(d.id).trim() === cleanId);
  };

  let users = getStored(AUTH_STORAGE_KEYS.USERS, null);

  if (users === null || !Array.isArray(users)) {
    return [];
  }

  // Lọc bỏ tài khoản đã bị xóa theo ID và loại bỏ mock doctor cũ
  const activeUsers = users.filter(u => {
    if (isUserDeleted(u.id)) return false;
    if (u.id === 'user_vet_pro' || (u.name && u.name.includes('Hoàng Hải Nam'))) return false;
    return true;
  });

  // Chuẩn hóa người dùng mà không tự động seed admin
  let normalized = activeUsers.map(normalizeUserRecord).filter(Boolean);

  if (normalized.length !== users.length) {
    setStored(AUTH_STORAGE_KEYS.USERS, normalized);
  }

  return normalized;
};

// Lấy thông tin phiên đăng nhập hiện tại (kiểm tra trạng thái isLocked thời gian thực)
export const getCurrentUser = () => {
  try {
    const isAuth = localStorage.getItem('petcare_is_authenticated') === 'true';
    if (!isAuth) return null;
    const session = getStored(AUTH_STORAGE_KEYS.SESSION, null) || 
                    getStored('petcare_active_user', null) || 
                    getStored('petcare_current_user', null);
    if (!session) return null;

    // Đối chiếu trực tiếp với danh sách người dùng mới nhất từ kho dữ liệu nếu có
    const users = getUsers();
    const sessionId = session.id ? String(session.id).trim() : '';
    const sessionEmail = session.email ? session.email.toLowerCase().trim() : '';

    if (Array.isArray(users) && users.length > 0) {
      const liveUser = users.find(u => 
        (sessionId && u.id && String(u.id).trim() === sessionId) ||
        (sessionEmail && u.email && u.email.toLowerCase().trim() === sessionEmail)
      );

      // [SECURITY FIX] CHỈ KHI tìm thấy bản ghi người dùng VÀ có bằng chứng rõ ràng isLocked === true:
      // mới gọi logout() thu hồi phiên đăng nhập
      if (liveUser && Boolean(liveUser.isLocked)) {
        console.warn('[PetCare Auth] Tài khoản đang đăng nhập đã bị khóa bởi Quản trị viên (xác nhận từ kho người dùng).');
        logout();
        return null;
      }

      // Vô hiệu hóa phiên đăng nhập cũ nếu mật khẩu đã bị đổi sau thời điểm xác thực của phiên
      if (liveUser && liveUser.passwordChangedAt && session.authTime) {
        const changedTime = new Date(liveUser.passwordChangedAt).getTime();
        const sessionTime = new Date(session.authTime).getTime();
        if (sessionTime < changedTime) {
          console.warn('[PetCare Auth] Phiên đăng nhập đã bị hủy do mật khẩu tài khoản đã thay đổi.');
          logout();
          return null;
        }
      }

      if (liveUser) {
        const sanitizedSession = { ...liveUser, authTime: session.authTime || new Date().toISOString() };
        delete sanitizedSession.password;
        return sanitizedSession;
      }
    }

    // Nếu kho users rỗng hoặc chưa tải xong hoặc không tìm thấy bản ghi trong snapshot cục bộ:
    // KHÔNG TỰ Ý ĐĂNG XUẤT HOẶC COI LÀ TÀI KHOẢN BỊ KHÓA!
    // Trả về thông tin session đã được backend xác thực khi đăng nhập
    const sanitizedSession = { ...session };
    delete sanitizedSession.password;
    return sanitizedSession;
  } catch (err) {
    console.error('[PetCare Auth] Lỗi khi xác thực phiên đăng nhập:', err);
    return null;
  }
};

// Xóa sạch toàn bộ cache dữ liệu nghiệp vụ của phiên làm việc cũ
export const purgeSessionCache = () => {
  try {
    const keysToRemove = [
      'petcare_pets_v1',
      'petcare_schedules_v1',
      'petcare_home_routines',
      'petcare_expenses_v1',
      'petcare_daily_logs_v1',
      'petcare_prescriptions_v1',
      'petcare_family_members_v1',
      'petcare_daily_habits_v1',
      'petcare_appointments_v1',
      'petcare_active_appointments',
      'petcare_medical_records_v1',
      'petcare_lost_modes_v1',
      'petcare_pets_health_data',
      'petcare_pets_health_v1',
      'petcare_weight_tracker_histories',
      'petcare_active_user',
      'petcare_current_user',
      'petcare_current_portal',
      'petcare_token',
      'petcare_auth_token',
      'petcare_is_authenticated',
      AUTH_STORAGE_KEYS.SESSION
    ];
    keysToRemove.forEach(k => {
      try { localStorage.removeItem(k); } catch {}
    });
  } catch (err) {
    console.error('Lỗi dọn dẹp cache phiên:', err);
  }
};

// Đăng nhập bằng Email & Password (Xác thực Backend qua API, kiểm tra tài khoản bị khóa và mật khẩu băm)
export const login = async (email, password, rememberMe = true) => {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) {
    throw new Error('Vui lòng nhập địa chỉ Email.');
  }
  if (!password) {
    throw new Error('Vui lòng nhập Mật khẩu.');
  }

  let sessionUser = null;

  // Xác thực duy nhất qua Backend API - backend là nguồn sự thật
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password })
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok && data.success && data.user) {
      sessionUser = { ...data.user, authTime: data.authTime || new Date().toISOString() };
      
      // 1. Dọn dẹp cache của bất kỳ phiên trước nào để đảm bảo cách ly phiên 100%
      purgeSessionCache();

      // 2. Lưu token mới vào cả petcare_auth_token và petcare_token
      if (data.token) {
        localStorage.setItem('petcare_auth_token', data.token);
        localStorage.setItem('petcare_token', data.token);
      }

      // 3. Lưu phiên làm việc mới
      setStored(AUTH_STORAGE_KEYS.SESSION, sessionUser);
      setStored(AUTH_STORAGE_KEYS.REMEMBER, Boolean(rememberMe));
      try {
        localStorage.setItem('petcare_active_user', JSON.stringify(sessionUser));
        localStorage.setItem('petcare_current_user', JSON.stringify(sessionUser));
        localStorage.setItem('petcare_is_authenticated', 'true');
        if (rememberMe) {
          localStorage.setItem('petcare_remembered_email', cleanEmail);
        } else {
          localStorage.removeItem('petcare_remembered_email');
        }
      } catch {}

      // 4. Đồng bộ thông tin người dùng vừa đăng nhập vào local snapshot
      const localUsers = getUsers();
      const idx = localUsers.findIndex(u => (u.email || '').toLowerCase() === cleanEmail);
      if (idx !== -1) {
        localUsers[idx] = { ...localUsers[idx], ...data.user };
      } else {
        localUsers.push(data.user);
      }
      setStored(AUTH_STORAGE_KEYS.USERS, localUsers);
    } else if (!response.ok) {
      // Backend phản hồi lỗi nghiệp vụ rõ ràng - ném ngay, không fallback
      throw new Error(data.error || 'Đăng nhập không thành công.');
    } else {
      throw new Error('Máy chủ không trả dữ liệu hợp lệ. Vui lòng thử lại.');
    }
  } catch (err) {
    // Phân biệt lỗi mạng (backend offline) và lỗi nghiệp vụ
    const isNetworkError = (
      err.message.includes('Failed to fetch') ||
      err.message.includes('NetworkError') ||
      err.message.includes('Load failed') ||
      err.message.includes('fetch') ||
      err.name === 'TypeError'
    );
    if (isNetworkError) {
      throw new Error('Không thể kết nối đến máy chủ xác thực. Vui lòng kiểm tra kết nối mạng và thử lại.');
    }
    // Lỗi nghiệp vụ (sai mật khẩu, tài khoản không tồn tại, bị khóa, đã xóa)
    throw err;
  }

  sound?.playSuccess?.();
  return sessionUser;
};

// Đăng ký tài khoản mới - Đã vô hiệu hóa theo cơ chế tài khoản do Quản trị viên cấp
export const register = async () => {
  throw new Error('Chức năng tự đăng ký đã bị tắt. Tài khoản được quản trị viên cấp. Vui lòng liên hệ quản trị viên để được hỗ trợ.');
};

// Đăng xuất và dọn dẹp phiên làm việc cùng cache dữ liệu cá nhân
export const logout = () => {
  purgeSessionCache();
  try {
    localStorage.removeItem(AUTH_STORAGE_KEYS.REMEMBER);
  } catch {}
  sound?.playClick?.();
  return null;
};

// Cập nhật thông tin cá nhân (Profile) lưu bền vững lên máy chủ
export const updateProfile = async (profileData) => {
  const current = getCurrentUser();
  if (!current) throw new Error('Chưa đăng nhập');

  let response;
  try {
    response = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(profileData)
    });
  } catch (err) {
    throw new Error('Không thể kết nối đến máy chủ để cập nhật hồ sơ.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success || !data.user) {
    throw new Error(data.error || 'Cập nhật thông tin cá nhân không thành công.');
  }

  const serverUser = data.user;
  delete serverUser.password;

  const sessionUser = { ...serverUser, authTime: current.authTime || new Date().toISOString() };
  setStored(AUTH_STORAGE_KEYS.SESSION, sessionUser);
  try {
    localStorage.setItem('petcare_active_user', JSON.stringify(sessionUser));
    localStorage.setItem('petcare_current_user', JSON.stringify(sessionUser));
  } catch {}

  const users = getUsers();
  const index = users.findIndex(u => u.id === current.id);
  if (index !== -1) {
    users[index] = { ...users[index], ...serverUser };
    delete users[index].password;
    setStored(AUTH_STORAGE_KEYS.USERS, users);
  }

  sound?.playSuccess?.();
  return sessionUser;
};

// Đổi mật khẩu (Xác minh chính xác mật khẩu hiện tại trên server)
export const changePassword = async (currentPassword, newPassword) => {
  const current = getCurrentUser();
  if (!current) throw new Error('Chưa đăng nhập');

  if (!newPassword || newPassword.length < 6) {
    throw new Error('Mật khẩu mới phải chứa ít nhất 6 ký tự.');
  }

  let response;
  try {
    response = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ userId: current.id, currentPassword, newPassword })
    });
  } catch (err) {
    throw new Error('Không thể kết nối đến máy chủ để đổi mật khẩu.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Mật khẩu hiện tại không chính xác hoặc không thể đổi mật khẩu.');
  }

  if (data.token) {
    localStorage.setItem('petcare_auth_token', data.token);
  }

  const nowStr = new Date().toISOString();
  // Cập nhật authTime cho phiên hiện tại để duy trì phiên
  const session = getStored(AUTH_STORAGE_KEYS.SESSION, null);
  if (session) {
    session.authTime = nowStr;
    session.passwordChangedAt = nowStr;
    delete session.password;
    setStored(AUTH_STORAGE_KEYS.SESSION, session);
    try {
      localStorage.setItem('petcare_active_user', JSON.stringify(session));
      localStorage.setItem('petcare_current_user', JSON.stringify(session));
    } catch {}
  }

  sound?.playSuccess?.();
  return true;
};

// ============================================================================
// CÁC HÀM KHÔI PHỤC MẬT KHẨU THỰC TẾ (REAL PASSWORD RECOVERY WORKFLOW)
// ============================================================================

/**
 * Gửi yêu cầu khôi phục mật khẩu đến email
 * - Kiểm tra định dạng email
 * - Gửi yêu cầu đến Backend tạo token an toàn và gửi email thực tế
 * - Trả về thông báo chung trung tính
 * - Ném lỗi nếu gửi thư thất bại (không báo thành công giả)
 */
export const forgotPassword = async (email) => {
  const cleanEmail = (email || '').trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!cleanEmail || !emailRegex.test(cleanEmail)) {
    throw new Error('Địa chỉ email không đúng định dạng (ví dụ: name@example.com).');
  }

  const response = await fetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: cleanEmail })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Đã xảy ra lỗi khi gửi thư khôi phục mật khẩu. Vui lòng thử lại.');
  }

  return data;
};

/**
 * Xác minh tính hợp lệ của token khôi phục
 * - Kiểm tra token có tồn tại, chưa hết hạn (< 15 phút), chưa bị sử dụng
 */
export const verifyResetToken = async (token) => {
  if (!token || typeof token !== 'string' || !token.trim()) {
    return {
      valid: false,
      reason: 'missing_token',
      error: 'Thiếu mã token khôi phục trong liên kết.'
    };
  }

  try {
    const response = await fetch(`/api/auth/verify-reset-token?token=${encodeURIComponent(token.trim())}`);
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.valid) {
      return {
        valid: false,
        reason: data.reason || 'invalid',
        error: data.error || 'Liên kết khôi phục không hợp lệ hoặc đã hết hiệu lực.'
      };
    }

    return {
      valid: true,
      user: data.user
    };
  } catch (err) {
    return {
      valid: false,
      reason: 'network_error',
      error: 'Không thể kết nối đến máy chủ xác thực. Vui lòng kiểm tra lại kết nối mạng.'
    };
  }
};

/**
 * Đặt lại mật khẩu mới bằng token
 * - Kiểm tra mật khẩu mới >= 6 ký tự
 * - Băm mật khẩu tại backend
 * - Đánh dấu token đã sử dụng (chỉ dùng 1 lần)
 * - Vô hiệu hóa các phiên đăng nhập cũ
 * - Không tự ý mở khóa tài khoản hay đổi quyền
 */
export const resetPassword = async (token, newPassword) => {
  if (!token || typeof token !== 'string' || !token.trim()) {
    throw new Error('Mã token khôi phục không hợp lệ.');
  }

  if (!newPassword || newPassword.length < 6) {
    throw new Error('Mật khẩu mới phải chứa ít nhất 6 ký tự.');
  }

  const response = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: token.trim(), newPassword })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Không thể đặt lại mật khẩu. Vui lòng thử lại.');
  }

  // Không lưu mật khẩu hoặc hash vào trình duyệt
  sound?.playSuccess?.();
  return data;
};

// ============================================================================
// CÁC HÀM DÀNH RIÊNG CHO QUẢN TRỊ VIÊN HỆ THỐNG (SYSTEM ADMIN OPERATIONS)
// ============================================================================

// Kiểm tra quyền Admin của caller
export const verifySystemAdmin = (callerId) => {
  const users = getUsers();
  const caller = users.find(u => u.id === callerId);
  if (!caller || caller.role !== ROLES.SYSTEM_ADMIN || caller.isLocked) {
    throw new Error('Truy cập bị từ chối: Yêu cầu quyền Quản trị viên hệ thống (system_admin).');
  }
  return caller;
};

// Admin sửa thông tin tài khoản (Chỉ sửa trường cho phép & đồng bộ Backend)
export const adminUpdateUser = async (callerId, targetUserId, fields) => {
  verifySystemAdmin(callerId);
  const users = getUsers();
  const index = users.findIndex(u => u.id === targetUserId);
  if (index === -1) throw new Error('Không tìm thấy tài khoản cần chỉnh sửa.');

  const existing = users[index];
  const updatedUser = {
    ...existing,
    name: typeof fields.name === 'string' && fields.name.trim() ? fields.name.trim() : existing.name,
    phone: typeof fields.phone === 'string' ? fields.phone.trim() : existing.phone,
    address: typeof fields.address === 'string' ? fields.address.trim() : existing.address,
    avatar: typeof fields.avatar === 'string' && fields.avatar.trim() ? fields.avatar.trim() : existing.avatar,
    facilityId: fields.facilityId !== undefined ? (fields.facilityId || null) : existing.facilityId,
    facilityIds: fields.facilityIds !== undefined 
      ? fields.facilityIds 
      : (fields.facilityId ? [fields.facilityId] : (fields.facilityId === '' || fields.facilityId === null ? [] : existing.facilityIds))
  };

  // Đồng bộ lên backend API
  try {
    const headers = getAuthHeaders();
    const res = await fetch(`/api/auth/users/${encodeURIComponent(targetUserId)}/update`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: updatedUser.name,
        phone: updatedUser.phone,
        address: updatedUser.address,
        avatar: updatedUser.avatar,
        facilityId: updatedUser.facilityId,
        facilityIds: updatedUser.facilityIds
      })
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data?.user) {
        Object.assign(updatedUser, data.user);
      }
    }
  } catch (apiErr) {
    console.warn('[Admin] Lỗi cập nhật backend:', apiErr.message);
  }

  users[index] = updatedUser;
  setStored(AUTH_STORAGE_KEYS.USERS, users);
  sound?.playSuccess?.();
  return updatedUser;
};

// Admin Khóa / Mở khóa tài khoản (Đồng bộ Backend & Local thời gian thực)
export const adminToggleLockUser = async (callerId, targetUserId) => {
  verifySystemAdmin(callerId);
  const users = getUsers();
  const index = users.findIndex(u => u.id === targetUserId);
  if (index === -1) throw new Error('Không tìm thấy tài khoản.');

  const target = users[index];

  // Quy tắc an toàn 1: Không cho admin tự khóa tài khoản đang sử dụng
  if (target.id === callerId) {
    throw new Error('Không thể tự khóa tài khoản quản trị viên đang đăng nhập!');
  }

  // Quy tắc an toàn 2: Không cho khóa quản trị viên hệ thống hoạt động cuối cùng
  if (target.role === ROLES.SYSTEM_ADMIN && !target.isLocked) {
    const activeAdmins = users.filter(u => u.role === ROLES.SYSTEM_ADMIN && !u.isLocked);
    if (activeAdmins.length <= 1) {
      throw new Error('Không thể khóa Quản trị viên hệ thống hoạt động cuối cùng của hệ thống!');
    }
  }

  // Đồng bộ với Backend API
  const res = await fetch(`/api/auth/users/${targetUserId}/toggle-lock`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ callerId })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Máy chủ từ chối yêu cầu khóa/mở khóa tài khoản.');
  }

  const updatedTarget = { ...data };
  delete updatedTarget.password;

  users[index] = updatedTarget;
  setStored(AUTH_STORAGE_KEYS.USERS, users);

  sound?.playSuccess?.();
  return updatedTarget;
};

// Admin Duyệt hoặc Từ chối bác sĩ thú y
export const adminApproveVetDoctor = async (callerId, targetUserId, isApproved) => {
  verifySystemAdmin(callerId);
  const users = getUsers();
  const index = users.findIndex(u => u.id === targetUserId);
  if (index === -1) throw new Error('Không tìm thấy tài khoản.');

  const target = users[index];
  if (target.role !== ROLES.VET_DOCTOR) {
    throw new Error('Tài khoản này không đăng ký vai trò Bác sĩ thú y.');
  }

  // Đồng bộ với Backend API
  const res = await fetch(`/api/auth/users/${targetUserId}/approve-vet`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ callerId, isApproved: Boolean(isApproved) })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Máy chủ từ chối yêu cầu phê duyệt bác sĩ.');
  }

  const updatedTarget = { ...data };
  delete updatedTarget.password;

  users[index] = updatedTarget;
  setStored(AUTH_STORAGE_KEYS.USERS, users);

  sound?.playSuccess?.();
  return updatedTarget;
};

// Admin Đổi vai trò tài khoản (Chặn leo thang đặc quyền SYSTEM_ADMIN, chỉ cho phép giữa PET_OWNER và VET_DOCTOR)
export const adminChangeUserRole = async (callerId, targetUserId, newRole) => {
  verifySystemAdmin(callerId);

  // RÀNG BUỘC BẢO MẬT 1: Tuyệt đối không cho phép gán hoặc leo thang quyền SYSTEM_ADMIN
  if (newRole === ROLES.SYSTEM_ADMIN || newRole === 'system_admin') {
    throw new Error('Bảo mật: Tuyệt đối không được phép thăng quyền lên Quản trị viên hệ thống!');
  }

  // RÀNG BUỘC BẢO MẬT 2: Chỉ cho phép chuyển đổi vai trò giữa pet_owner và vet_doctor
  if (newRole !== ROLES.PET_OWNER && newRole !== ROLES.VET_DOCTOR) {
    throw new Error('Vai trò không hợp lệ. Chỉ cho phép chuyển đổi giữa Chủ nuôi và Bác sĩ thú y.');
  }

  const users = getUsers();
  const index = users.findIndex(u => u.id === targetUserId);
  if (index === -1) throw new Error('Không tìm thấy tài khoản.');

  const target = users[index];

  // RÀNG BUỘC BẢO MẬT 3: Tuyệt đối không cho phép thay đổi vai trò của Quản trị viên hệ thống
  if (target.role === ROLES.SYSTEM_ADMIN || target.role === 'system_admin') {
    throw new Error('Không thể thay đổi vai trò của Quản trị viên hệ thống!');
  }

  // Đồng bộ với Backend API
  try {
    const response = await fetch(`/api/auth/users/${targetUserId}/change-role`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ callerId, role: newRole })
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Máy chủ từ chối yêu cầu thay đổi vai trò.');
    }
  } catch (err) {
    // Nếu là lỗi nghiệp vụ từ server (400, 403, 404), throw ngay lập tức
    if (!err.message.includes('Failed to fetch') && !err.message.includes('NetworkError') && !err.message.includes('Load failed')) {
      throw err;
    }
    // Nếu backend offline, ghi nhận cảnh báo và duy trì cập nhật local
    console.warn('[PetCare Auth] Backend offline khi đổi vai trò, lưu cập nhật vào local snapshot.');
  }

  target.role = newRole;
  if (newRole === ROLES.VET_DOCTOR) {
    target.vetStatus = target.vetStatus || VET_STATUS.APPROVED;
  } else {
    target.vetStatus = null;
  }

  users[index] = target;
  setStored(AUTH_STORAGE_KEYS.USERS, users);

  sound?.playSuccess?.();
  return target;
};

/**
 * Quản trị viên tạo tài khoản mới (Admin Create User)
 * - Yêu cầu quyền system_admin của caller
 * - Kiểm tra họ tên, email hợp lệ & không trùng lặp
 * - Bác sĩ thú y được cấp quyền ngay (vetStatus: 'approved')
 * - Mật khẩu tạm thời có cờ mustChangePassword: true
 * - Lưu đồng thời vào cơ sở dữ liệu backend và kho local
 */
export const adminCreateUser = async (callerId, userData) => {
  verifySystemAdmin(callerId);

  const { name, email, phone, role, password, isLocked } = userData;
  const cleanEmail = (email || '').trim().toLowerCase();

  // Kiểm tra định dạng cơ bản (không kiểm tra trùng - để backend xác nhận)
  if (!name || !name.trim()) throw new Error('Vui lòng nhập Họ và tên.');
  if (!cleanEmail) throw new Error('Vui lòng nhập Email đăng nhập.');

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    throw new Error('Địa chỉ email không đúng định dạng (ví dụ: name@example.com).');
  }

  if (!password || password.length < 6) {
    throw new Error('Mật khẩu tạm thời phải từ 6 ký tự trở lên.');
  }

  if (role !== ROLES.PET_OWNER && role !== ROLES.VET_DOCTOR) {
    throw new Error('Vai trò không hợp lệ. Chỉ được chọn Chủ nuôi hoặc Bác sĩ thú y.');
  }

  // Gọi Backend - đây là nguồn duy nhất kiểm tra trùng email và tạo tài khoản
  let response;
  try {
    response = await fetch('/api/auth/admin/create-user', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        callerId,
        name: name.trim(),
        email: cleanEmail,
        phone: phone ? phone.trim() : '',
        role,
        password,
        isLocked: Boolean(isLocked)
      })
    });
  } catch (err) {
    // Lỗi mạng thực sự - backend không thể kết nối
    throw new Error('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng và đảm bảo backend đang chạy.');
  }

  const data = await response.json().catch(() => ({}));

  // Backend phải phản hồi thành công với user hợp lệ
  if (!response.ok || !data.success || !data.user) {
    throw new Error(data.error || 'Không thể tạo tài khoản. Vui lòng thử lại.');
  }

  const serverUser = data.user;
  // Lưu bản ghi vào local snapshot (không lưu password trong trình duyệt)
  const newUser = { ...serverUser };
  delete newUser.password;

  // Giải phóng email trong danh sách đã xóa ở localStorage (nếu có)
  const deletedList = getStored(AUTH_STORAGE_KEYS.DELETED_USERS, []);
  if (Array.isArray(deletedList) && deletedList.length > 0) {
    let modified = false;
    const updatedDeletedList = deletedList.map(item => {
      if ((item.email || '').trim().toLowerCase() === cleanEmail) {
        modified = true;
        return { ...item, email: '' }; // Giữ ID để seed không tái sinh, xóa email
      }
      return item;
    });
    if (modified) setStored(AUTH_STORAGE_KEYS.DELETED_USERS, updatedDeletedList);
  }

  // Dọn dẹp legacy registered users nếu trùng email
  const legacyRegistered = getStored('petcare_registered_users', []);
  if (Array.isArray(legacyRegistered) && legacyRegistered.length > 0) {
    const filteredLegacy = legacyRegistered.filter(leg =>
      (leg?.email || '').trim().toLowerCase() !== cleanEmail
    );
    setStored('petcare_registered_users', filteredLegacy);
  }

  // Cập nhật local snapshot (loại bỏ bản ghi cũ trùng email/id nếu có)
  const currentUsers = getUsers();
  const filteredUsers = currentUsers.filter(u =>
    String(u.id).trim() !== String(newUser.id).trim() &&
    (u.email || '').trim().toLowerCase() !== cleanEmail
  );
  setStored(AUTH_STORAGE_KEYS.USERS, [...filteredUsers, newUser]);

  sound?.playSuccess?.();
  return newUser;
};

/**
 * Quản trị viên đặt lại mật khẩu tạm thời cho người dùng (Admin Reset Password)
 * - Hỗ trợ tra cứu bằng ID và Email dự phòng
 * - Tạo mật khẩu tạm thời mới, băm bảo mật tại backend
 * - Gán cờ mustChangePassword = true bắt buộc đổi mật khẩu ở lần đăng nhập tiếp theo
 * - Vô hiệu hóa các phiên đăng nhập cũ qua passwordChangedAt
 */
export const adminResetUserPassword = async (callerId, targetUserId, newTemporaryPassword, targetEmail = null) => {
  verifySystemAdmin(callerId);

  if (!newTemporaryPassword || newTemporaryPassword.length < 6) {
    throw new Error('Mật khẩu tạm thời phải từ 6 ký tự trở lên.');
  }

  const cleanTargetId = targetUserId ? String(targetUserId).trim() : '';
  const cleanTargetEmail = targetEmail ? String(targetEmail).trim().toLowerCase() : '';

  // 1. Cập nhật trên Backend Server
  let response;
  try {
    response = await fetch('/api/auth/admin/reset-password', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        callerId,
        targetUserId: cleanTargetId,
        targetEmail: cleanTargetEmail,
        newTemporaryPassword
      })
    });
  } catch (err) {
    throw new Error('Không thể kết nối đến máy chủ để đặt lại mật khẩu.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success || !data.user) {
    throw new Error(data.error || 'Không thể đặt lại mật khẩu tạm thời.');
  }

  const serverUser = data.user;
  delete serverUser.password;

  // 2. Cập nhật trong danh sách người dùng local (không lưu password)
  const users = getUsers();
  const index = users.findIndex(u => 
    (cleanTargetId && String(u.id).trim() === cleanTargetId) ||
    (cleanTargetEmail && (u.email || '').trim().toLowerCase() === cleanTargetEmail)
  );

  const nowStr = new Date().toISOString();
  if (index !== -1) {
    users[index] = { ...users[index], ...serverUser };
    delete users[index].password;
    users[index].mustChangePassword = true;
    users[index].passwordChangedAt = nowStr;
    setStored(AUTH_STORAGE_KEYS.USERS, users);
  }

  // Nếu tài khoản được reset trùng với phiên hiện hành trên trình duyệt này
  const currentSession = getStored(AUTH_STORAGE_KEYS.SESSION, null);
  if (currentSession && (
    (cleanTargetId && String(currentSession.id).trim() === cleanTargetId) ||
    (cleanTargetEmail && (currentSession.email || '').trim().toLowerCase() === cleanTargetEmail)
  )) {
    const updatedSession = {
      ...currentSession,
      mustChangePassword: true,
      passwordChangedAt: nowStr
    };
    delete updatedSession.password;
    setStored(AUTH_STORAGE_KEYS.SESSION, updatedSession);
    try {
      localStorage.setItem('petcare_active_user', JSON.stringify(updatedSession));
      localStorage.setItem('petcare_current_user', JSON.stringify(updatedSession));
    } catch {}
  }

  sound?.playSuccess?.();
  return serverUser;
};

/**
 * Quản trị viên xóa tài khoản người dùng (Admin Delete User)
 * - Chỉ Quản trị viên hệ thống có quyền
 * - Không cho tự xóa tài khoản admin đang đăng nhập
 * - Không cho xóa quản trị viên hệ thống hoạt động cuối cùng
 * - Yêu cầu xác nhận đúng email tài khoản
 * - Bảo lưu hồ sơ thú cưng và dữ liệu chăm sóc (đánh dấu chủ sở hữu đã xóa)
 * - Ngăn chặn tái sinh tài khoản mẫu đã xóa
 */
export const adminDeleteUser = async (callerId, targetUserId, confirmEmail, targetEmail = null) => {
  verifySystemAdmin(callerId);

  const cleanTargetId = targetUserId ? String(targetUserId).trim() : '';
  const cleanTargetEmail = targetEmail ? String(targetEmail).trim().toLowerCase() : '';
  const cleanConfirm = confirmEmail ? String(confirmEmail).trim().toLowerCase() : '';

  const users = getUsers();
  const index = users.findIndex(u => 
    (cleanTargetId && String(u.id).trim() === cleanTargetId) ||
    (cleanTargetEmail && (u.email || '').trim().toLowerCase() === cleanTargetEmail)
  );

  if (index === -1) {
    throw new Error('Không tìm thấy tài khoản người dùng hoặc tài khoản đã bị xóa.');
  }

  const targetUser = users[index];

  // 1. Chặn tự xóa chính tài khoản đang đăng nhập
  const currentSession = getStored(AUTH_STORAGE_KEYS.SESSION, null);
  if (String(callerId).trim() === String(targetUser.id).trim() || 
      (currentSession?.email && currentSession.email.trim().toLowerCase() === targetUser.email.toLowerCase())) {
    throw new Error('Không thể tự xóa tài khoản quản trị viên đang đăng nhập.');
  }

  // 2. Chặn xóa admin hoạt động cuối cùng
  if (targetUser.role === ROLES.SYSTEM_ADMIN) {
    const activeAdmins = users.filter(u => u.role === ROLES.SYSTEM_ADMIN && !u.isLocked);
    if (activeAdmins.length <= 1) {
      throw new Error('Không thể xóa quản trị viên hệ thống hoạt động cuối cùng.');
    }
  }

  // 3. Kiểm tra email xác nhận
  if (!cleanConfirm || cleanConfirm !== targetUser.email.toLowerCase()) {
    throw new Error('Email xác nhận không trùng khớp với email của tài khoản cần xóa.');
  }

  // 4. Gọi Backend Server xóa an toàn - bắt buộc phải thành công
  let deleteResponse;
  try {
    deleteResponse = await fetch('/api/auth/admin/delete-user', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        callerId,
        targetUserId: targetUser.id,
        targetEmail: targetUser.email,
        confirmEmail: cleanConfirm
      })
    });
  } catch (err) {
    // Lỗi mạng - backend không thể kết nối, giữ nguyên danh sách
    throw new Error('Không thể kết nối đến máy chủ. Tài khoản chưa bị xóa. Vui lòng kiểm tra kết nối mạng.');
  }

  const deleteData = await deleteResponse.json().catch(() => ({}));

  // Chỉ cập nhật local khi backend xác nhận thành công
  if (!deleteResponse.ok || !deleteData.success) {
    throw new Error(deleteData.error || 'Máy chủ không xác nhận xóa tài khoản. Vui lòng thử lại.');
  }

  // 5. Backend đã xóa thành công - cập nhật local snapshot
  const updatedUsers = users.filter(u =>
    String(u.id).trim() !== String(targetUser.id).trim() &&
    (u.email || '').trim().toLowerCase() !== targetUser.email.toLowerCase()
  );
  setStored(AUTH_STORAGE_KEYS.USERS, updatedUsers);

  // Ghi nhận vào danh sách đã xóa (chỉ giữ ID để ngăn seed tái sinh; email được giải phóng)
  const deletedList = getStored(AUTH_STORAGE_KEYS.DELETED_USERS, []);
  const alreadyIn = deletedList.some(d =>
    String(d.id).trim() === String(targetUser.id).trim()
  );
  if (!alreadyIn) {
    deletedList.push({
      id: targetUser.id,
      email: '', // Email KHÔNG bị khóa vĩnh viễn - chỉ lưu ID để ngăn seed tái sinh
      deletedAt: new Date().toISOString()
    });
    setStored(AUTH_STORAGE_KEYS.DELETED_USERS, deletedList);
  } else {
    // Đảm bảo email được giải phóng nếu bản ghi đã tồn tại
    const updatedDeleted = deletedList.map(d =>
      String(d.id).trim() === String(targetUser.id).trim()
        ? { ...d, email: '' }
        : d
    );
    setStored(AUTH_STORAGE_KEYS.DELETED_USERS, updatedDeleted);
  }

  // Dọn dẹp legacy registered users nếu có
  const legacyRegistered = getStored('petcare_registered_users', []);
  if (Array.isArray(legacyRegistered) && legacyRegistered.length > 0) {
    const filteredLegacy = legacyRegistered.filter(leg =>
      String(leg.id).trim() !== String(targetUser.id).trim() &&
      (leg.email || '').trim().toLowerCase() !== targetUser.email.toLowerCase()
    );
    setStored('petcare_registered_users', filteredLegacy);
  }

  // Xóa email đã ghi nhớ nếu khớp
  if (localStorage.getItem('petcare_remembered_email')?.toLowerCase() === targetUser.email.toLowerCase()) {
    localStorage.removeItem('petcare_remembered_email');
  }

  // 6. Xử lý bảo lưu an toàn dữ liệu chăm sóc (đánh dấu chủ sở hữu đã xóa, thu hồi quyền chia sẻ)
  handleUserDeletedDataRetention(targetUser.id, targetUser.role);

  sound?.playSuccess?.();
  return { success: true, deletedUser: targetUser };
};


/**
 * Người dùng hoàn tất đổi mật khẩu bắt buộc ở lần đăng nhập đầu tiên
 * - Cập nhật mật khẩu mới
 * - Tắt cờ mustChangePassword: false
 * - Cập nhật phiên đăng nhập hiện tại
 */
export const completeFirstLoginPasswordChange = async (userId, newPassword) => {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('Mật khẩu mới phải từ 6 ký tự trở lên.');
  }

  const nowStr = new Date().toISOString();

  let response;
  try {
    response = await fetch('/api/auth/first-login-change-password', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ userId, newPassword })
    });
  } catch (err) {
    throw new Error('Không thể kết nối đến máy chủ để đổi mật khẩu lần đầu.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Đổi mật khẩu lần đầu không thành công.');
  }

  if (data.token) {
    localStorage.setItem('petcare_auth_token', data.token);
  }

  // Cập nhật trong danh sách local (không lưu password)
  const users = getUsers();
  const index = users.findIndex(u => u.id === userId);
  if (index !== -1) {
    delete users[index].password;
    users[index].mustChangePassword = false;
    users[index].passwordChangedAt = nowStr;
    setStored(AUTH_STORAGE_KEYS.USERS, users);
  }

  // Cập nhật phiên hiện tại (không lưu password)
  const currentSession = getStored(AUTH_STORAGE_KEYS.SESSION, null);
  if (currentSession && (currentSession.id === userId || currentSession.email)) {
    const updatedSession = {
      ...currentSession,
      mustChangePassword: false,
      authTime: nowStr,
      passwordChangedAt: nowStr
    };
    delete updatedSession.password;
    setStored(AUTH_STORAGE_KEYS.SESSION, updatedSession);
    try {
      localStorage.setItem('petcare_active_user', JSON.stringify(updatedSession));
      localStorage.setItem('petcare_current_user', JSON.stringify(updatedSession));
    } catch {}
  }

  sound?.playSuccess?.();
  return { success: true };
};

/**
 * Đồng bộ danh sách người dùng với Backend Server
 * Backend là nguồn sự thật duy nhất cho danh sách Admin và kiểm tra email trùng.
 * Hàm này CẬP NHẬT local snapshot từ backend, không merge với legacy data.
 */
export const syncUsersWithBackend = async () => {
  const initialToken = typeof localStorage !== 'undefined' ? (localStorage.getItem('petcare_token') || localStorage.getItem('petcare_auth_token')) : null;
  const initialSessionStr = typeof localStorage !== 'undefined' ? (localStorage.getItem('petcare_active_user') || localStorage.getItem('petcare_current_user')) : null;
  if (!initialToken) {
    return [];
  }
  const headers = getAuthHeaders();
  // Lấy danh sách người dùng từ backend
  const response = await fetch('/api/auth/users', { headers });
  if (response.status === 401 || response.status === 403) {
    const errData = await response.json().catch(() => ({}));
    const err = new Error(errData.error || 'Truy cập danh sách tài khoản bị từ chối.');
    err.status = response.status;
    err.code = errData.code;
    throw err;
  }
  if (!response.ok) {
    throw new Error('Không thể tải danh sách tài khoản từ máy chủ.');
  }

  const serverUsers = await response.json().catch(() => null);
  if (!Array.isArray(serverUsers)) {
    throw new Error('Máy chủ trả dữ liệu không hợp lệ.');
  }

  // Kiểm tra lại phiên đăng nhập sau khi hoàn thành fetch bất đồng bộ
  // So sánh phiên/token ban đầu với phiên/token hiện tại.
  // Khác phiên thì hủy bỏ kết quả, không ghi vào cache.
  const currentToken = typeof localStorage !== 'undefined' ? (localStorage.getItem('petcare_token') || localStorage.getItem('petcare_auth_token')) : null;
  const currentSessionStr = typeof localStorage !== 'undefined' ? (localStorage.getItem('petcare_active_user') || localStorage.getItem('petcare_current_user')) : null;
  if (!currentToken || currentToken !== initialToken || currentSessionStr !== initialSessionStr) {
    console.warn('[PetCare Auth] Phiên làm việc đã thay đổi hoặc kết thúc trong lúc đồng bộ users; hủy bỏ kết quả ghi cache.');
    return [];
  }

  // Đồng bộ danh sách đã xóa từ server để đảm bảo nhất quán
  try {
    const delResponse = await fetch('/api/auth/deleted-users', { headers });
    if (delResponse.ok) {
      const serverDeleted = await delResponse.json();
      if (Array.isArray(serverDeleted)) {
        const currentDeleted = getStored(AUTH_STORAGE_KEYS.DELETED_USERS, []);
        const currentIds = new Set(currentDeleted.map(d => String(d.id).trim()));
        let modified = false;
        serverDeleted.forEach(sd => {
          if (sd?.id && !currentIds.has(String(sd.id).trim())) {
            // Khi nhập từ server: đảm bảo email được giải phóng (không khóa vĩnh viễn)
            currentDeleted.push({ ...sd, email: '' });
            currentIds.add(String(sd.id).trim());
            modified = true;
          }
        });
        if (modified) setStored(AUTH_STORAGE_KEYS.DELETED_USERS, currentDeleted);
      }
    }
  } catch { /* Bỏ qua lỗi khi lấy deleted list */ }

  const deletedList = getStored(AUTH_STORAGE_KEYS.DELETED_USERS, []);
  const isDeletedById = (id) => {
    if (!id) return false;
    return deletedList.some(d => String(d.id).trim() === String(id).trim());
  };

  // Lọc bỏ tài khoản đã bị xóa khỏi server response
  const activeServerUsers = serverUsers.filter(u => !isDeletedById(u.id));

  // Giải phóng email trong deletedList nếu email đó đang hoạt động trên server
  const activeEmails = new Set(activeServerUsers.map(u => (u.email || '').toLowerCase().trim()));
  const currentDeleted = getStored(AUTH_STORAGE_KEYS.DELETED_USERS, []);
  let emailModified = false;
  const cleanedDeleted = currentDeleted.map(item => {
    if (item.email && activeEmails.has((item.email || '').toLowerCase().trim())) {
      emailModified = true;
      return { ...item, email: '' };
    }
    return item;
  });
  if (emailModified) setStored(AUTH_STORAGE_KEYS.DELETED_USERS, cleanedDeleted);

  // Dọn dẹp petcare_registered_users legacy - xóa các email đã có trên server
  try {
    const legacy = getStored('petcare_registered_users', []);
    if (Array.isArray(legacy) && legacy.length > 0) {
      const serverIds = new Set(activeServerUsers.map(u => String(u.id).trim()));
      const serverEmailSet = new Set(activeServerUsers.map(u => (u.email || '').toLowerCase().trim()));
      const cleanedLegacy = legacy.filter(l =>
        l?.id && !serverIds.has(String(l.id).trim()) &&
        l?.email && !serverEmailSet.has((l.email || '').toLowerCase().trim()) &&
        !isDeletedById(l.id)
      );
      if (cleanedLegacy.length !== legacy.length) {
        setStored('petcare_registered_users', cleanedLegacy);
      }
    }
  } catch { /* Bỏ qua lỗi legacy */ }

  // Lưu snapshot backend vào localStorage - không lưu mật khẩu hoặc hash mật khẩu
  const mergedUsers = activeServerUsers.map(su => {
    const copy = { ...su };
    delete copy.password;
    return copy;
  });

  setStored(AUTH_STORAGE_KEYS.USERS, mergedUsers);
  return mergedUsers;
};


