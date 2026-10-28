export const getStoredAuthToken = () => {
  if (typeof localStorage === 'undefined') return null;
  const rawToken = localStorage.getItem('petcare_auth_token') || localStorage.getItem('petcare_token');
  if (!rawToken || rawToken === 'null' || rawToken === 'undefined' || !rawToken.trim()) return null;
  return rawToken.trim();
};

export const apiFetch = async (endpoint, method = 'GET', body = null) => {
  const token = getStoredAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const res = await fetch(`/api/data${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });
  
  let data;
  try {
    data = await res.json();
  } catch (err) {
    throw new Error('Không thể kết nối đến máy chủ.');
  }

  if (!res.ok) {
    // Phân biệt rõ lỗi xác thực phiên (401 hoặc mã lỗi xác thực) và lỗi không có quyền (403 thông thường)
    const authFailureCodes = [
      'INVALID_TOKEN', 
      'NO_TOKEN', 
      'TOKEN_EXPIRED', 
      'SESSION_REVOKED', 
      'ACCOUNT_LOCKED', 
      'USER_NOT_FOUND'
    ];

    const isAuthFailure = res.status === 401 || authFailureCodes.includes(data?.code);

    if (isAuthFailure) {
      // Dọn sạch phiên hết hiệu lực khỏi localStorage
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('petcare_token');
          localStorage.removeItem('petcare_auth_token');
          localStorage.removeItem('petcare_active_user');
          localStorage.removeItem('petcare_current_user');
          localStorage.removeItem('petcare_is_authenticated');
          localStorage.removeItem('petcare_session');
        }
      } catch {}

      if (typeof window !== 'undefined') {
        const normalizedDetail = { ...data };
        if (!normalizedDetail.error || data?.code === 'INVALID_TOKEN' || data?.code === 'NO_TOKEN' || data?.code === 'TOKEN_EXPIRED') {
          normalizedDetail.error = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
        }
        window.dispatchEvent(new CustomEvent('petcare_session_revoked', { detail: normalizedDetail }));
      }
    }

    const err = new Error(
      (isAuthFailure && (!data?.error || data?.code === 'INVALID_TOKEN' || data?.code === 'NO_TOKEN' || data?.code === 'TOKEN_EXPIRED'))
        ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
        : (data?.error || 'Đã có lỗi xảy ra.')
    );
    err.code = data?.code;
    err.status = res.status;
    err.isAuthFailure = isAuthFailure;
    throw err;
  }
  if (method === 'GET') return data;
  return (data && data.data !== undefined) ? data.data : data;
};

// Generic CRUD
export const apiGetAll = async (collection) => apiFetch(`/${collection}`);
export const apiCreate = async (collection, data) => apiFetch(`/${collection}`, 'POST', data);
export const apiUpdate = async (collection, id, data) => apiFetch(`/${collection}/${id}`, 'PUT', data);
export const apiDelete = async (collection, id) => apiFetch(`/${collection}/${id}`, 'DELETE');

// In-flight sync deduplication & throttling để ngăn bão request và vòng lặp cascade
let activeSyncPromise = null;
let lastSyncTimestamp = 0;
const SYNC_THROTTLE_MS = 800; // Khử lặp tối thiểu 800ms giữa các lần sync mới

// Sync all data from API to cache với cơ chế khử lặp (In-flight deduplication)
export const syncAllDataToCache = async (options = {}) => {
  const { force = false, criticalOnly = false } = (typeof options === 'object' && options !== null) ? options : {};

  // 1. In-flight Promise Reuse: Nếu một tiến trình sync đang chạy, tái sử dụng Promise đó
  if (activeSyncPromise && !force) {
    return activeSyncPromise;
  }

  // 2. Throttling: Nếu vừa sync thành công cách đây dưới SYNC_THROTTLE_MS, bỏ qua để tránh bão request do event cascades
  const now = Date.now();
  if (!force && (now - lastSyncTimestamp) < SYNC_THROTTLE_MS) {
    return true;
  }

  const initialToken = getStoredAuthToken();
  const initialSessionUser = typeof localStorage !== 'undefined' ? (localStorage.getItem('petcare_active_user') || localStorage.getItem('petcare_current_user')) : null;
  if (!initialToken) return 'skipped';

  let initialUserId = null;
  try {
    const parsed = initialSessionUser ? JSON.parse(initialSessionUser) : null;
    initialUserId = parsed?.id || null;
  } catch {}

  const runSync = async () => {
    try {
      const fetchCol = async (col, fallback) => {
        try {
          const res = await apiGetAll(col);
          return res !== undefined && res !== null ? res : fallback;
        } catch (err) {
          console.warn(`[PetCare Sync] Lỗi tải collection '${col}':`, err?.message || err);
          if (col === 'pets' || col === 'appointments') {
            // Thú cưng và Lịch khám là dữ liệu cốt lõi: nếu request thất bại, ném lỗi để hiển thị banner lỗi và nút thử lại
            throw err;
          }
          return fallback;
        }
      };

      // Nhóm 1: Dữ liệu cốt lõi ưu tiên số 1 (Core critical)
      const [pets, schedules, appointments, budgets] = await Promise.all([
        fetchCol('pets', []),
        fetchCol('schedules', []),
        fetchCol('appointments', []),
        fetchCol('budgets', [])
      ]);

      // Kiểm tra an toàn phiên sau nhóm 1
      const currentToken = getStoredAuthToken();
      const currentSessionUser = typeof localStorage !== 'undefined' ? (localStorage.getItem('petcare_active_user') || localStorage.getItem('petcare_current_user')) : null;
      let currentUserId = null;
      try {
        const parsed = currentSessionUser ? JSON.parse(currentSessionUser) : null;
        currentUserId = parsed?.id || null;
      } catch {}

      if (!currentToken || currentToken !== initialToken || (initialUserId && currentUserId && String(initialUserId).trim() !== String(currentUserId).trim())) {
        console.warn('[PetCare] Phiên làm việc đã thay đổi sang tài khoản khác trong lúc đồng bộ; hủy bỏ kết quả ghi cache.');
        return 'skipped';
      }

      if (Array.isArray(pets)) localStorage.setItem('petcare_pets_v1', JSON.stringify(pets));
      if (Array.isArray(schedules)) localStorage.setItem('petcare_schedules_v1', JSON.stringify(schedules));
      if (Array.isArray(appointments)) localStorage.setItem('petcare_appointments_v1', JSON.stringify(appointments));
      if (Array.isArray(budgets)) localStorage.setItem('petcare_budgets_v1', JSON.stringify(budgets));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('petcare_core_synced', { detail: { origin: 'syncAllDataToCache' } }));
      }

      // Nhóm 2: Dữ liệu phân hệ phụ chạy nền (Background collections)
      if (!criticalOnly) {
        const [expenses, dailyLogs, prescriptions, familyMembers, dailyHabits, medicalRecords, lostModes, healthData] = await Promise.all([
          fetchCol('expenses', []),
          fetchCol('daily_logs', []),
          fetchCol('prescriptions', []),
          fetchCol('family_members', []),
          fetchCol('daily_habits', []),
          fetchCol('medical_records', []),
          fetchCol('lost_modes', {}),
          fetchCol('health_data', {})
        ]);

        // Kiểm tra an toàn phiên sau nhóm 2
        const finalToken = getStoredAuthToken();
        if (finalToken === initialToken) {
          if (Array.isArray(expenses)) localStorage.setItem('petcare_expenses_v1', JSON.stringify(expenses));
          if (Array.isArray(dailyLogs)) localStorage.setItem('petcare_daily_logs_v1', JSON.stringify(dailyLogs));
          if (Array.isArray(prescriptions)) localStorage.setItem('petcare_prescriptions_v1', JSON.stringify(prescriptions));
          if (Array.isArray(familyMembers)) localStorage.setItem('petcare_family_members_v1', JSON.stringify(familyMembers));
          if (Array.isArray(dailyHabits)) localStorage.setItem('petcare_daily_habits_v1', JSON.stringify(dailyHabits));
          if (Array.isArray(medicalRecords)) localStorage.setItem('petcare_medical_records_v1', JSON.stringify(medicalRecords));
          if (lostModes && typeof lostModes === 'object') localStorage.setItem('petcare_lost_modes_v1', JSON.stringify(lostModes));
          if (healthData && typeof healthData === 'object') {
            localStorage.setItem('petcare_pets_health_data', JSON.stringify(healthData));
            localStorage.setItem('petcare_pets_health_v1', JSON.stringify(healthData));
          }
        }
      }

      lastSyncTimestamp = Date.now();

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('petcare_data_synced', { detail: { origin: 'syncAllDataToCache' } }));
        window.dispatchEvent(new CustomEvent('petcare_appointments_updated', { detail: { origin: 'syncAllDataToCache' } }));
        window.dispatchEvent(new CustomEvent('petcare_pets_updated', { detail: { origin: 'syncAllDataToCache' } }));
        window.dispatchEvent(new CustomEvent('petcare_medical_records_updated', { detail: { origin: 'syncAllDataToCache' } }));
        window.dispatchEvent(new CustomEvent('petcare_expenses_updated', { detail: { origin: 'syncAllDataToCache' } }));
        window.dispatchEvent(new CustomEvent('petcare_budgets_updated', { detail: { origin: 'syncAllDataToCache' } }));
      }
      return true;
    } catch (error) {
      console.error("Sync data failed:", error);
      throw error;
    } finally {
      activeSyncPromise = null;
    }
  };

  activeSyncPromise = runSync();
  return activeSyncPromise;
};

export const runMigrationIfNeeded = async () => {
  // Đã dừng tự động đẩy dữ liệu demo từ localStorage lên server
  // Đảm bảo hệ thống sạch và không tự khôi phục dữ liệu mẫu
  return;
};

/**
 * Tải ảnh đại diện thú cưng thật lên máy chủ backend
 * @param {File} file - Tệp ảnh được chọn từ máy (JPG, JPEG, PNG, WebP <= 5 MB)
 * @param {string|null} [petId] - ID thú cưng nếu đang cập nhật
 * @returns {Promise<string>} Đường dẫn URL ảnh đã lưu trên máy chủ (/api/uploads/avatars/...)
 */
export const uploadPetAvatar = async (file, petId = null) => {
  if (!file) throw new Error('Không có tệp ảnh nào được chọn.');

  const base64Data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(new Error('Không thể đọc tệp ảnh: ' + (err?.message || 'Lỗi không xác định')));
    reader.readAsDataURL(file);
  });

  const payload = {
    fileData: base64Data,
    fileName: file.name,
    petId: petId || undefined
  };

  const res = await apiFetch('/pets/upload-avatar', 'POST', payload);
  const url = res?.url || res?.data?.url;
  if (!url) {
    throw new Error('Máy chủ không trả về đường dẫn ảnh hợp lệ.');
  }
  return url;
};

export const archiveAppointment = async (appointmentId) => {
  if (!appointmentId) throw new Error('Thiếu ID lịch khám cần lưu trữ.');
  return await apiFetch(`/appointments/${appointmentId}/archive`, 'POST');
};

export const unarchiveAppointment = async (appointmentId) => {
  if (!appointmentId) throw new Error('Thiếu ID lịch khám cần khôi phục.');
  return await apiFetch(`/appointments/${appointmentId}/unarchive`, 'POST');
};

