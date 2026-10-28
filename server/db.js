import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { getCollectionData, saveCollectionData, saveMultipleCollections } from './dataHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(process.cwd(), process.env.PETCARE_DATA_DIR || path.join(__dirname, 'data'));
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const TOKENS_FILE = path.join(DATA_DIR, 'tokens.json');
const DELETED_USERS_FILE = path.join(DATA_DIR, 'deleted_users.json');

// Khởi tạo thư mục lưu trữ nếu chưa có
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// -------------------------------------------------------------
// BẢO MẬT: BĂM VÀ XÁC THỰC MẬT KHẨU BẰNG PBKDF2 (SHA-512)
// -------------------------------------------------------------
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `pbkdf2:${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored) return false;
  // Hỗ trợ trường hợp seed ban đầu chưa băm và tự nâng cấp
  if (!stored.startsWith('pbkdf2:')) {
    return stored === password;
  }
  const parts = stored.split(':');
  if (parts.length !== 3) return false;
  const [, salt, originalHash] = parts;
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
  } catch {
    return false;
  }
}

// -------------------------------------------------------------
// BẢO MẬT: BĂM TOKEN KHÔI PHỤC BẰNG SHA-256 (KHÔNG LƯU TOKEN THÔ)
// -------------------------------------------------------------
export function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

// -------------------------------------------------------------
// SEEDING CÁC TÀI KHOẢN MẪU HỆ THỐNG
// -------------------------------------------------------------
const INITIAL_USERS = [
  {
    id: 'user_admin_01',
    name: 'Quản trị viên Hệ thống',
    email: 'admin@petcare.ai',
    password: hashPassword('Admin@123456'),
    phone: '0901.000.888',
    address: 'Trụ sở chính PetCare AI, Hà Nội',
    role: 'system_admin',
    isLocked: false,
    vetStatus: null,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
    createdAt: '2026-01-01T08:00:00.000Z',
    passwordChangedAt: null,
    mustChangePassword: false
  }
];

// -------------------------------------------------------------
// QUẢN LÝ TÀI KHOẢN ĐÃ XÓA (PREVENT RESURRECTION)
// -------------------------------------------------------------
export function getDeletedUsers() {
  try {
    if (!fs.existsSync(DELETED_USERS_FILE)) return [];
    const data = fs.readFileSync(DELETED_USERS_FILE, 'utf8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordDeletedUser(id, email) {
  try {
    const list = getDeletedUsers();
    const cleanId = id ? String(id).trim() : '';
    const cleanEmail = email ? String(email).trim().toLowerCase() : '';
    const exists = list.some(d => 
      (cleanId && String(d.id).trim() === cleanId) || 
      (cleanEmail && (d.email || '').trim().toLowerCase() === cleanEmail)
    );
    if (!exists) {
      list.push({
        id: cleanId,
        email: cleanEmail,
        deletedAt: new Date().toISOString()
      });
      fs.writeFileSync(DELETED_USERS_FILE, JSON.stringify(list, null, 2), 'utf8');
    }
  } catch (err) {
    console.error('Error saving deleted users:', err);
  }
}

export function unmarkDeletedEmail(email) {
  try {
    if (!email) return;
    const cleanEmail = email.trim().toLowerCase();
    const list = getDeletedUsers();
    let modified = false;
    const updated = list.map(item => {
      if ((item.email || '').trim().toLowerCase() === cleanEmail) {
        modified = true;
        return { ...item, email: '' };
      }
      return item;
    });
    if (modified) {
      fs.writeFileSync(DELETED_USERS_FILE, JSON.stringify(updated, null, 2), 'utf8');
    }
  } catch (err) {
    console.error('Error unmarking deleted email:', err);
  }
}

// Đọc và ghi tệp dữ liệu an toàn
export function getUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) {
      return [];
    }
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Error reading users file:', err);
    return [];
  }
}

let simulatedUserSaveFailure = false;
export function simulateUserSaveFailure(enable = true) {
  if (process.env.NODE_ENV !== 'test') return;
  simulatedUserSaveFailure = enable;
}

export function saveUsers(users) {
  if (process.env.NODE_ENV === 'test' && simulatedUserSaveFailure) {
    simulatedUserSaveFailure = false;
    return false;
  }
  const tempPath = path.join(DATA_DIR, `.users.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`);
  const content = JSON.stringify(users, null, 2);
  try {
    fs.writeFileSync(tempPath, content, 'utf8');
    let replaced = false;
    let attempts = 0;
    let lastError = null;
    while (!replaced && attempts < 5) {
      try {
        fs.renameSync(tempPath, USERS_FILE);
        replaced = true;
      } catch (renameErr) {
        lastError = renameErr;
        attempts++;
        if (attempts >= 5) {
          // Bỏ hoàn toàn copyFileSync đè lên file đích; giữ nguyên USERS_FILE gốc
          try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
          console.error(`[ATOMIC WRITE FAILED] Không thể rename sang users.json sau ${attempts} lần thử. Giữ nguyên tệp gốc. Lỗi:`, lastError?.message || lastError);
          return false;
        } else {
          const start = Date.now();
          while (Date.now() - start < 20) {}
        }
      }
    }
    return true;
  } catch (err) {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {}
    console.error('Error saving users file:', err);
    return false;
  }
}

export function getTokens() {
  try {
    if (!fs.existsSync(TOKENS_FILE)) {
      return [];
    }
    const data = fs.readFileSync(TOKENS_FILE, 'utf8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Error reading tokens file:', err);
    return [];
  }
}

export function saveTokens(tokens) {
  const tempPath = path.join(DATA_DIR, `.tokens.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`);
  const content = JSON.stringify(tokens, null, 2);
  try {
    fs.writeFileSync(tempPath, content, 'utf8');
    let replaced = false;
    let attempts = 0;
    let lastError = null;
    while (!replaced && attempts < 5) {
      try {
        fs.renameSync(tempPath, TOKENS_FILE);
        replaced = true;
      } catch (renameErr) {
        lastError = renameErr;
        attempts++;
        if (attempts >= 5) {
          // Bỏ hoàn toàn copyFileSync đè lên file đích; giữ nguyên TOKENS_FILE gốc
          try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
          console.error(`[ATOMIC WRITE FAILED] Không thể rename sang tokens.json sau ${attempts} lần thử. Giữ nguyên tệp gốc. Lỗi:`, lastError?.message || lastError);
          return false;
        } else {
          const start = Date.now();
          while (Date.now() - start < 20) {}
        }
      }
    }
    return true;
  } catch (err) {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {}
    console.error('Error saving tokens file:', err);
    return false;
  }
}

// -------------------------------------------------------------
// CÁC THAO TÁC TRÊN USER (CHUẨN HÓA KIỂU DỮ LIỆU & EMAIL LOOKUP)
// -------------------------------------------------------------
export function findUserByEmail(email) {
  if (!email || typeof email !== 'string') return null;
  const clean = email.trim().toLowerCase();
  const users = getUsers();
  return users.find(u => (u.email || '').trim().toLowerCase() === clean) || null;
}

export function findUserById(id) {
  if (!id) return null;
  const cleanId = String(id).trim();
  const users = getUsers();
  return users.find(u => String(u.id).trim() === cleanId) || null;
}

/**
 * Tìm kiếm tài khoản linh hoạt bằng ID (chuẩn hóa chuỗi) hoặc fallback qua Email.
 * Giải quyết dứt điểm lỗi không tìm thấy tài khoản do khác biệt ID giữa client/server.
 */
export function findUser(id, email) {
  const users = getUsers();
  const cleanId = id ? String(id).trim() : null;
  const cleanEmail = email ? String(email).trim().toLowerCase() : null;

  if (cleanId) {
    const byId = users.find(u => String(u.id).trim() === cleanId);
    if (byId) return byId;
  }
  if (cleanEmail) {
    const byEmail = users.find(u => (u.email || '').trim().toLowerCase() === cleanEmail);
    if (byEmail) return byEmail;
  }
  return null;
}

export function createUser({ 
  name, 
  email, 
  password, 
  phone, 
  role = 'pet_owner',
  isLocked = false,
  vetStatus = null,
  mustChangePassword = true 
}) {
  const users = getUsers();
  const cleanEmail = (email || '').trim().toLowerCase();

  if (users.some(u => (u.email || '').trim().toLowerCase() === cleanEmail)) {
    throw new Error('Địa chỉ email này đã tồn tại trong hệ thống.');
  }

  // Chặn tạo vai trò system_admin
  const assignedRole = role === 'system_admin' ? 'pet_owner' : role;
  // Bác sĩ do admin tạo được cấp quyền ngay lập tức
  const assignedVetStatus = assignedRole === 'vet_doctor' ? (vetStatus || 'approved') : null;

  const newUser = {
    id: `user_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    name: (name || '').trim(),
    email: cleanEmail,
    password: hashPassword(password),
    phone: (phone || '').trim(),
    address: 'Việt Nam',
    role: assignedRole,
    isLocked: Boolean(isLocked),
    vetStatus: assignedVetStatus,
    mustChangePassword: Boolean(mustChangePassword),
    avatar: assignedRole === 'vet_doctor'
      ? 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80'
      : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&auto=format&fit=crop&q=80',
    createdAt: new Date().toISOString(),
    passwordChangedAt: null
  };

  users.push(newUser);
  const ok = saveUsers(users);
  if (!ok) {
    throw new Error('Lỗi ghi dữ liệu người dùng mới vào hệ thống lưu trữ.');
  }

  // Giải phóng email trong danh sách deleted_users để tài khoản mới hoạt động bình thường
  unmarkDeletedEmail(cleanEmail);

  return newUser;
}

export function updateUser(id, updates) {
  const cleanId = String(id).trim();
  const users = getUsers();
  const index = users.findIndex(u => String(u.id).trim() === cleanId);
  if (index === -1) throw new Error('Không tìm thấy tài khoản người dùng hoặc tài khoản đã bị xóa.');

  const existing = users[index];
  const updated = { ...existing, ...updates };
  users[index] = updated;
  const ok = saveUsers(users);
  if (!ok) {
    throw new Error('Lỗi ghi dữ liệu cập nhật người dùng vào hệ thống lưu trữ.');
  }
  return updated;
}

/**
 * Xóa an toàn tài khoản người dùng tại tầng dữ liệu server:
 * - Thu hồi mọi token khôi phục mật khẩu
 * - Ghi nhận vào deleted_users.json để ngăn chặn tái sinh tài khoản mẫu
 * - Kiểm tra không xóa quản trị viên cuối cùng
 */
export function deleteUser(id, email) {
  const users = getUsers();
  const cleanId = id ? String(id).trim() : null;
  const cleanEmail = email ? String(email).trim().toLowerCase() : null;

  const index = users.findIndex(u => 
    (cleanId && String(u.id).trim() === cleanId) ||
    (cleanEmail && (u.email || '').trim().toLowerCase() === cleanEmail)
  );

  if (index === -1) {
    throw new Error('Không tìm thấy tài khoản người dùng hoặc tài khoản đã bị xóa.');
  }

  const target = users[index];

  // Kiểm tra không xóa admin cuối cùng
  if (target.role === 'system_admin') {
    const activeAdmins = users.filter(u => u.role === 'system_admin' && !u.isLocked);
    if (activeAdmins.length <= 1) {
      throw new Error('Không thể xóa quản trị viên hệ thống hoạt động cuối cùng.');
    }
  }

  // Xóa tài khoản khỏi danh sách
  users.splice(index, 1);
  const okUsers = saveUsers(users);
  if (!okUsers) {
    throw new Error('Lỗi ghi dữ liệu người dùng khi xóa.');
  }

  // Thu hồi và xóa toàn bộ token khôi phục liên quan
  const tokens = getTokens();
  const remainingTokens = tokens.filter(t => 
    String(t.userId).trim() !== String(target.id).trim() && 
    (t.userEmail || '').trim().toLowerCase() !== target.email.toLowerCase()
  );
  const okTokens = saveTokens(remainingTokens);
  if (!okTokens) {
    throw new Error('Lỗi lưu danh sách mã xác thực sau khi xóa người dùng.');
  }

  // Ghi nhận vào danh sách đã xóa để không bao giờ tự sinh lại
  recordDeletedUser(target.id, target.email);

  // Xóa dây chuyền dữ liệu nếu tài khoản là pet_owner:
  // - Xóa các thú cưng thuộc sở hữu của chủ nuôi
  // - Xóa các bản ghi liên quan (schedules, expenses, daily_logs, prescriptions, family_members, daily_habits, appointments, medical_records, lost_modes, health_data)
  // - Nếu là vet_doctor: KHÔNG xóa thú cưng hoặc bệnh án của chủ nuôi.
  if (target.role === 'pet_owner') {
    cascadeDeleteOwnerData(target.id);
  } else if (target.role === 'vet_doctor') {
    // Với bác sĩ: Không xóa thú cưng hoặc bệnh án của chủ nuôi, chỉ gỡ phân công trong appointments
    const appointments = getCollectionData('appointments', false);
    let appModified = false;
    const updatedApps = appointments.map(a => {
      if (a.assignedVetId && String(a.assignedVetId).trim() === String(target.id).trim()) {
        appModified = true;
        return { ...a, assignedVetId: null, assignedVet: 'Đang xếp lịch' };
      }
      return a;
    });
    if (appModified) {
      saveCollectionData('appointments', updatedApps);
    }
  }

  return target;
}

/**
 * Xóa dây chuyền toàn bộ dữ liệu của chủ thú cưng khi bị xóa:
 * Bảo đảm không để lại dữ liệu mồ côi (orphaned data) trong hệ thống
 */
export function cascadeDeleteOwnerData(ownerId) {
  const cleanOwnerId = String(ownerId).trim();
  const allPets = getCollectionData('pets', false);
  const ownerPets = allPets.filter(p => String(p.ownerId).trim() === cleanOwnerId);
  const ownerPetIds = new Set(ownerPets.map(p => String(p.id).trim()));

  const operations = [];

  // 1. Cập nhật danh sách pets: loại bỏ các thú cưng của owner này
  const remainingPets = allPets.filter(p => String(p.ownerId).trim() !== cleanOwnerId);
  operations.push({ collection: 'pets', data: remainingPets, isObject: false });

  // 2. Dọn sạch các mảng dữ liệu nghiệp vụ liên quan
  const arrayCollections = [
    'schedules',
    'expenses',
    'daily_logs',
    'prescriptions',
    'family_members',
    'daily_habits',
    'appointments',
    'medical_records'
  ];

  arrayCollections.forEach(col => {
    let items = getCollectionData(col, false);
    const filtered = items.filter(item => {
      const matchOwner = item.ownerId && String(item.ownerId).trim() === cleanOwnerId;
      const matchPet = item.petId && ownerPetIds.has(String(item.petId).trim());
      return !matchOwner && !matchPet;
    });
    operations.push({ collection: col, data: filtered, isObject: false });
  });

  // 3. Dọn sạch object collections (lost_modes, health_data)
  let lostModes = getCollectionData('lost_modes', true);
  ownerPetIds.forEach(pId => {
    if (lostModes[pId]) {
      delete lostModes[pId];
    }
  });
  operations.push({ collection: 'lost_modes', data: lostModes, isObject: true });

  let healthData = getCollectionData('health_data', true);
  ownerPetIds.forEach(pId => {
    if (healthData[pId]) {
      delete healthData[pId];
    }
    const k1 = `health_${pId}`;
    if (healthData[k1]) {
      delete healthData[k1];
    }
  });
  operations.push({ collection: 'health_data', data: healthData, isObject: true });

  const ok = saveMultipleCollections(operations);
  if (!ok) {
    throw new Error('Lỗi ghi dữ liệu dây chuyền khi xóa chủ nuôi. Toàn bộ thao tác đã được hoàn tác.');
  }
}

// -------------------------------------------------------------
// QUẢN LÝ TOKEN KHÔI PHỤC MẬT KHẨU
// -------------------------------------------------------------

/**
 * Tạo token khôi phục ngẫu nhiên an toàn (32 bytes = 64 hex chars),
 * lưu bản băm SHA-256 vào database, hết hạn sau 15 phút,
 * và vô hiệu hóa tất cả các token trước đó của tài khoản này.
 */
export function createResetToken(userId, email) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenH = hashToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 phút

  const tokens = getTokens();

  // Vô hiệu hóa toàn bộ liên kết cũ chưa sử dụng của tài khoản này
  const updatedTokens = tokens.map(t => {
    if (t.userId === userId && !t.used) {
      return { ...t, used: true, invalidatedReason: 'replaced_by_new_request' };
    }
    return t;
  });

  const newTokenRecord = {
    id: `rst_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    userId,
    userEmail: email.toLowerCase().trim(),
    tokenHash: tokenH,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    used: false,
    usedAt: null
  };

  updatedTokens.push(newTokenRecord);
  saveTokens(updatedTokens);

  return { rawToken, expiresAt };
}

/**
 * Kiểm tra tính hợp lệ của token (chưa dùng, chưa hết hạn)
 */
export function verifyResetToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') {
    return { valid: false, reason: 'invalid', message: 'Mã khôi phục không hợp lệ.' };
  }

  const tokenH = hashToken(rawToken.trim());
  const tokens = getTokens();
  const record = tokens.find(t => t.tokenHash === tokenH);

  if (!record) {
    return { valid: false, reason: 'invalid', message: 'Liên kết khôi phục không tồn tại hoặc không hợp lệ.' };
  }

  if (record.used) {
    return { valid: false, reason: 'used', message: 'Liên kết khôi phục này đã được sử dụng hoặc đã bị thay thế.' };
  }

  const now = new Date();
  if (new Date(record.expiresAt) <= now) {
    return { valid: false, reason: 'expired', message: 'Liên kết khôi phục đã hết hạn (quá 15 phút). Vui lòng yêu cầu liên kết mới.' };
  }

  const user = findUserById(record.userId);
  if (!user) {
    return { valid: false, reason: 'invalid', message: 'Tài khoản liên kết không tồn tại.' };
  }

  return { valid: true, record, user };
}

/**
 * Tiêu thụ token và cập nhật mật khẩu mới (Thao tác nguyên tử, nhất quán)
 * - Mật khẩu mới được băm bằng PBKDF2
 * - Đánh dấu token used: true ngay lập tức
 * - Cập nhật passwordChangedAt để vô hiệu hóa các phiên đăng nhập cũ
 * - Giữ nguyên isLocked và role của người dùng
 */
export function consumeResetTokenAndSetPassword(rawToken, newPassword) {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('Mật khẩu mới phải chứa ít nhất 6 ký tự.');
  }

  const verification = verifyResetToken(rawToken);
  if (!verification.valid) {
    throw new Error(verification.message);
  }

  const { record, user } = verification;
  const tokens = getTokens();
  const users = getUsers();

  const tokenIndex = tokens.findIndex(t => t.id === record.id);
  const userIndex = users.findIndex(u => u.id === user.id);

  if (tokenIndex === -1 || userIndex === -1) {
    throw new Error('Dữ liệu khôi phục không khớp.');
  }

  const nowStr = new Date().toISOString();

  // 1. Đánh dấu token đã được dùng
  tokens[tokenIndex].used = true;
  tokens[tokenIndex].usedAt = nowStr;

  // 2. Cập nhật mật khẩu băm mới, ghi nhận thời điểm đổi mật khẩu
  // TUYỆT ĐỐI không thay đổi role, vetStatus hay tự ý mở khóa tài khoản
  users[userIndex].password = hashPassword(newPassword);
  users[userIndex].passwordChangedAt = nowStr;

  // 3. Vô hiệu hóa mọi token khác của user này
  tokens.forEach((t, idx) => {
    if (t.userId === user.id && !t.used) {
      tokens[idx].used = true;
      tokens[idx].invalidatedReason = 'password_reset_completed';
    }
  });

  // Lưu đồng thời xuống đĩa
  const okTokens = saveTokens(tokens);
  const okUsers = saveUsers(users);
  if (!okTokens || !okUsers) {
    throw new Error('Lỗi ghi dữ liệu khi khôi phục mật khẩu.');
  }

  const safeUser = { ...users[userIndex] };
  delete safeUser.password;
  return safeUser;
}
