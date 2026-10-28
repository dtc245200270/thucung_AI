import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getCollectionData, saveCollectionData, saveMultipleCollections, simulateSaveFailure, clearSimulatedSaveFailures } from './dataHandler.js';
import { findUserById, getUsers } from './db.js';
import { getTodayVnDate, getCurrentVnTime, isPastVnDateTime, addDaysLocal, addMonthsClamped, addYearsClamped } from './dateUtils.js';
import { VET_FACILITIES, VET_SERVICES } from '../src/constants/clinicFacilities.js';

import { JWT_SECRET, config } from './config.js';
import { checkOllamaStatus, analyzeImageWithOllama, validateAndNormalizeImage } from './ollamaVision.js';
import { processChatConsultation, getChatHistory, clearChatHistory } from './chatService.js';
import { 
  getDocuments as getRagDocuments, 
  getSources as getRagSources, 
  toggleDocumentStatus as toggleRagDocumentStatus, 
  upsertDocument as upsertRagDocument, 
  deleteDocument as deleteRagDocument, 
  reindexAll as reindexRagAll, 
  getRagStatus,
  isEmbeddingModelReady 
} from './ragService.js';

const router = express.Router();

// Middleware mô phỏng lỗi ghi đĩa phục vụ kiểm thử hệ thống (CHỈ BẬT KHI NODE_ENV === 'test')
if (process.env.NODE_ENV === 'test') {
  router.use((req, res, next) => {
    if (req.headers['x-simulate-save-failure']) {
      simulateSaveFailure(req.headers['x-simulate-save-failure']);
      res.on('finish', () => {
        clearSimulatedSaveFailures();
      });
    }
    next();
  });

  router.post('/simulate/clear-failures', (req, res) => {
    clearSimulatedSaveFailures();
    return res.json({ success: true, message: 'Simulated failures cleared.' });
  });
}

// Helper kiểm tra trạng thái đơn thuốc/bệnh án đã ký chốt và công bố chính thức
export function isRecordPublished(record) {
  if (!record || typeof record !== 'object') return false;
  return record.isFinal === true && record.status === 'published';
}

// Không tự ý công bố hoặc thay đổi trạng thái đơn thuốc cũ
export function migrateLegacyPrescriptions() {
  // Đã vô hiệu hóa: Không tự ý gán isFinal: true hoặc status: 'published' cho đơn thuốc thiếu trạng thái
  return;
}

// Helper validation chuẩn xác: Ngày dương lịch có thật (không nhận not-a-date, 2026-02-29, 2026-04-31)
export function isValidCalendarDate(dateStr) {
  if (typeof dateStr !== 'string') return false;
  const trimmed = dateStr.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return false;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && (d.getMonth() + 1) === month && d.getDate() === day;
}

// Helper validation chuẩn xác: Giờ hợp lệ HH:MM trong khoảng 00:00 - 23:59 (không nhận 99:99, 25:00)
export function isValidTimeFormat(timeStr) {
  if (typeof timeStr !== 'string') return false;
  const trimmed = timeStr.trim();
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(trimmed);
  return Boolean(match);
}

// Helper validation chuẩn xác: Số hữu hạn lớn hơn 0 (không nhận số âm, 0, NaN, Infinity, chuỗi sai kiểu, boolean)
export function isValidPositiveNumber(val) {
  if (typeof val === 'boolean' || val === null || val === undefined) return false;
  const n = Number(val);
  return Number.isFinite(n) && !isNaN(n) && n > 0;
}

// Helper validation chuẩn xác: Số điện thoại Việt Nam (10 số di động bắt đầu bằng 0 hoặc +84)
export function validateVietnamesePhoneNumber(phone) {
  if (phone === undefined || phone === null || (typeof phone === 'string' && !phone.trim())) {
    return {
      isValid: false,
      error: 'Vui lòng nhập số điện thoại liên hệ xác nhận.',
      code: 'MISSING_PHONE_NUMBER'
    };
  }

  if (typeof phone !== 'string') {
    return {
      isValid: false,
      error: 'Số điện thoại phải là chuỗi ký tự hợp lệ.',
      code: 'INVALID_PHONE_TYPE'
    };
  }

  const trimmed = phone.trim();

  // Kiểm tra ký tự không hợp lệ: từ chối chữ cái và ký tự đặc biệt
  if (/[^0-9+\s.-]/.test(trimmed)) {
    return {
      isValid: false,
      error: 'Số điện thoại không hợp lệ: không được chứa chữ cái hoặc ký tự đặc biệt.',
      code: 'INVALID_PHONE_CHARACTERS'
    };
  }

  // Dấu + chỉ được phép ở đầu chuỗi (+84)
  if (trimmed.includes('+') && !trimmed.startsWith('+')) {
    return {
      isValid: false,
      error: 'Ký tự "+" chỉ được phép ở đầu số điện thoại quốc tế (+84).',
      code: 'INVALID_PHONE_FORMAT'
    };
  }

  // Chuẩn hóa loại bỏ khoảng trắng, dấu chấm, dấu gạch nối
  const sanitized = trimmed.replace(/[\s.-]/g, '');

  if (!sanitized.startsWith('0') && !sanitized.startsWith('+84') && !sanitized.startsWith('84')) {
    return {
      isValid: false,
      error: 'Số điện thoại phải là số Việt Nam bắt đầu bằng 0 hoặc +84 (Ví dụ: 0912 345 678 hoặc +84 912 345 678).',
      code: 'INVALID_PHONE_PREFIX'
    };
  }

  let normalized = sanitized;
  if (normalized.startsWith('+84')) {
    normalized = '0' + normalized.slice(3);
  } else if (normalized.startsWith('84') && sanitized.length > 9) {
    normalized = '0' + normalized.slice(2);
  }

  if (!/^\d+$/.test(normalized)) {
    return {
      isValid: false,
      error: 'Số điện thoại chỉ được chứa các chữ số.',
      code: 'INVALID_PHONE_CHARACTERS'
    };
  }

  if (normalized.length < 10) {
    return {
      isValid: false,
      error: `Số điện thoại quá ngắn (${normalized.length}/10 số). Vui lòng nhập đủ 10 chữ số.`,
      code: 'PHONE_TOO_SHORT'
    };
  }

  if (normalized.length > 11) {
    return {
      isValid: false,
      error: `Số điện thoại quá dài (${normalized.length} số). Số điện thoại Việt Nam tiêu chuẩn gồm 10 chữ số.`,
      code: 'PHONE_TOO_LONG'
    };
  }

  const vnMobileRegex = /^(0)(3|5|7|8|9)[0-9]{8}$/;
  const vnLandlineRegex = /^(02)[0-9]{9}$/;

  if (!vnMobileRegex.test(normalized) && !vnLandlineRegex.test(normalized)) {
    if (normalized.length === 10 && !/^(0)(3|5|7|8|9)/.test(normalized)) {
      return {
        isValid: false,
        error: 'Đầu số không hợp lệ. Số di động Việt Nam bắt đầu bằng 03, 05, 07, 08, 09.',
        code: 'INVALID_PHONE_PREFIX'
      };
    }
    return {
      isValid: false,
      error: 'Số điện thoại không đúng định dạng mạng viễn thông Việt Nam (bắt đầu bằng 0 hoặc +84 kèm 9 chữ số).',
      code: 'INVALID_PHONE_FORMAT'
    };
  }

  return {
    isValid: true,
    sanitized: trimmed,
    normalized
  };
}

// Helper validation lịch sử cân nặng: ngày không được để trống, hợp lệ trên lịch, không thuộc tương lai (Asia/Ho_Chi_Minh)
export function validatePetWeightHistory(weightHistory, todayVn = getTodayVnDate()) {
  if (weightHistory === undefined || weightHistory === null) {
    return { valid: true, sanitized: undefined };
  }
  if (!Array.isArray(weightHistory)) {
    return {
      valid: false,
      error: 'Lịch sử cân nặng (weightHistory) phải là một danh sách mảng hợp lệ.',
      code: 'INVALID_WEIGHT_HISTORY'
    };
  }
  const sanitized = [];
  for (let i = 0; i < weightHistory.length; i++) {
    const entry = weightHistory[i];
    if (!entry || typeof entry !== 'object') {
      return {
        valid: false,
        error: `Bản ghi cân nặng thứ ${i + 1} trong lịch sử không đúng định dạng.`,
        code: 'INVALID_WEIGHT_ENTRY'
      };
    }
    const rawDate = entry.date;
    if (!rawDate || typeof rawDate !== 'string' || !rawDate.trim()) {
      return {
        valid: false,
        error: `Ngày ghi nhận cân nặng ở bản ghi thứ ${i + 1} không được để trống.`,
        code: 'MISSING_WEIGHT_DATE'
      };
    }
    const dateStr = entry.date.trim();
    if (!isValidCalendarDate(dateStr)) {
      return {
        valid: false,
        error: `Ngày ghi nhận cân nặng '${dateStr}' không hợp lệ hoặc không tồn tại trên lịch thực tế (định dạng YYYY-MM-DD).`,
        code: 'INVALID_WEIGHT_DATE'
      };
    }
    if (dateStr > todayVn) {
      return {
        valid: false,
        error: `Ngày ghi nhận cân nặng (${dateStr}) không được thuộc tương lai (vượt quá hôm nay ${todayVn} theo giờ Việt Nam).`,
        code: 'FUTURE_WEIGHT_DATE'
      };
    }
    if (!isValidPositiveNumber(entry.weight)) {
      return {
        valid: false,
        error: `Cân nặng trong bản ghi ngày ${dateStr} phải là một số dương lớn hơn 0 kg.`,
        code: 'INVALID_WEIGHT_VALUE'
      };
    }
    sanitized.push({
      ...entry,
      date: dateStr,
      weight: Number(entry.weight)
    });
  }

  // Sắp xếp tăng dần theo ngày ghi nhận thực tế
  sanitized.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  return { valid: true, sanitized };
}

// Re-export toàn bộ helper ngày giờ chuẩn hóa theo múi giờ Asia/Ho_Chi_Minh (MỤC 6)
export {
  VN_TIMEZONE,
  getTodayVnDate,
  getVnDateString,
  getLocalDateString,
  formatDateVi,
  formatDateKey,
  addDaysLocal,
  addMonthsClamped,
  addYearsClamped,
  getScheduleStatus,
  generateIcsCalendar
} from './dateUtils.js';

// Middleware Authentication
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token == null || token === 'null' || token === 'undefined' || token.trim() === '') {
    return res.status(401).json({ 
      success: false, 
      error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 
      code: 'NO_TOKEN' 
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ 
        success: false, 
        error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 
        code: 'INVALID_TOKEN' 
      });
    }
    
    // Đảm bảo user thực sự còn tồn tại và không bị khóa
    const user = findUserById(decoded.id);
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Tài khoản không tồn tại hoặc đã bị xóa.', 
        code: 'USER_NOT_FOUND' 
      });
    }

    if (user.isLocked) {
      return res.status(403).json({ 
        success: false, 
        error: 'Tài khoản đã bị khóa bởi Quản trị viên hệ thống.', 
        code: 'ACCOUNT_LOCKED' 
      });
    }

    // Thu hồi phiên làm việc cũ nếu mật khẩu đã bị thay đổi hoặc reset sau thời điểm token được cấp
    if (user.passwordChangedAt) {
      if (decoded.pwdChangedAt !== undefined) {
        if (decoded.pwdChangedAt !== user.passwordChangedAt) {
          return res.status(401).json({
            success: false,
            error: 'Phiên đăng nhập đã bị thu hồi do đổi mật khẩu hoặc đặt lại bảo mật. Vui lòng đăng nhập lại.',
            code: 'SESSION_REVOKED'
          });
        }
      } else if (decoded.iat) {
        const changedTime = new Date(user.passwordChangedAt).getTime();
        if (decoded.iat * 1000 <= changedTime) {
          return res.status(401).json({
            success: false,
            error: 'Phiên đăng nhập đã bị thu hồi do đổi mật khẩu hoặc đặt lại bảo mật. Vui lòng đăng nhập lại.',
            code: 'SESSION_REVOKED'
          });
        }
      }
    }

    // Chặn tài khoản chưa hoàn tất đổi mật khẩu lần đầu truy cập các API dữ liệu nghiệp vụ
    const cleanPath = (req.originalUrl || '').split('?')[0];
    const isFirstLoginEndpoint = cleanPath === '/api/auth/first-login-change-password';
    if (user.mustChangePassword && !isFirstLoginEndpoint) {
      return res.status(403).json({
        success: false,
        error: 'Tài khoản yêu cầu đổi mật khẩu ở lần đăng nhập đầu tiên trước khi truy cập dữ liệu.',
        code: 'MUST_CHANGE_PASSWORD'
      });
    }
    
    req.user = user;
    next();
  });
};

export const optionalAuthenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return next();
  }
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (!err && decoded) {
      const user = findUserById(decoded.id);
      if (user && !user.isLocked) {
        req.user = user;
      }
    }
    next();
  });
};

// Map collections to object or array type
const COLLECTION_TYPES = {
  pets: 'array',
  schedules: 'array',
  expenses: 'array',
  daily_logs: 'array',
  prescriptions: 'array',
  family_members: 'array',
  daily_habits: 'array',
  lost_modes: 'object',
  appointments: 'array',
  medical_records: 'array',
  health_data: 'object',
  budgets: 'array',
  ai_observations: 'array'
};

const getAllowedCollections = () => Object.keys(COLLECTION_TYPES);

// Helper kiểm tra bác sĩ có được phân công phụ trách thú cưng hay không (Unified Doctor Permission Policy)
export const isVetAssignedToPet = (vetId, petId, allPets = null, allAppointments = null) => {
  if (!vetId || !petId) return false;
  const pets = allPets || getCollectionData('pets', false);
  const appointments = allAppointments || getCollectionData('appointments', false) || [];
  const pet = pets.find(p => p.id === petId);
  if (!pet) return false;
  if (pet.assignedVetId === vetId) return true;
  if (Array.isArray(pet.sharedWithVetIds) && pet.sharedWithVetIds.includes(vetId)) return true;
  return appointments.some(a => a.petId === petId && (a.assignedVetId === vetId || a.vetId === vetId));
};

// ----------------------------------------------------------------------------
// 1. MIGRATION ENDPOINT (Xác thực quyền, không cho nhập vào tài khoản khác)
// ----------------------------------------------------------------------------
router.post('/migrate', authenticateToken, (req, res) => {
  const user = req.user;
  const { pets, schedules, expenses, daily_logs, prescriptions, family_members, daily_habits, lost_modes, appointments, medical_records, health_data } = req.body;

  const allExistingPets = getCollectionData('pets', false);
  const myExistingPetIds = new Set(allExistingPets.filter(p => p.ownerId === user.id).map(p => p.id));
  const otherExistingPetIds = new Set(allExistingPets.filter(p => p.ownerId !== user.id).map(p => p.id));
  
  const validIncomingPets = [];
  const validIncomingPetIds = new Set();

  if (Array.isArray(pets)) {
    pets.forEach(p => {
      if (!p || !p.id) return;
      // Không cho phép client nhận vơ ID thú cưng đã thuộc người khác
      if (otherExistingPetIds.has(p.id)) return;
      if (myExistingPetIds.has(p.id)) return;

      if (user.role === 'pet_owner') {
        p.ownerId = user.id;
        delete p.assignedVetId;
        validIncomingPets.push(p);
        validIncomingPetIds.add(p.id);
      } else if (user.role === 'vet_doctor') {
        // Bác sĩ không được tự ý nhập thú cưng mang ownerId của người khác
        if (p.ownerId && p.ownerId !== user.id) return;
        p.ownerId = user.id;
        validIncomingPets.push(p);
        validIncomingPetIds.add(p.id);
      } else if (user.role === 'system_admin') {
        validIncomingPets.push(p);
        validIncomingPetIds.add(p.id);
      }
    });
  }

  const allowedPetIds = new Set([...myExistingPetIds, ...validIncomingPetIds]);

  const operations = [];

  const queueMergeArray = (collection, newData, requireValidPet = false) => {
    if (!newData || !Array.isArray(newData)) return;
    
    // Chủ nuôi không được phép đưa hồ sơ bệnh án hoặc đơn thuốc chuyên môn vào
    if (user.role === 'pet_owner' && (collection === 'medical_records' || collection === 'prescriptions')) {
      return;
    }

    const existing = getCollectionData(collection, false);
    const existingIds = new Set(existing.map(item => String(item.id)));
    const toAdd = newData.filter(item => {
      if (!item || !item.id || existingIds.has(String(item.id))) return false;

      if (user.role === 'pet_owner') {
        item.ownerId = user.id;
        delete item.isFinal;
        delete item.confirmedBy;
        delete item.assignedVetId;
        if (collection === 'appointments') {
          item.status = 'pending';
        }
        if (collection === 'expenses' && !isValidPositiveNumber(item.amount)) {
          return false;
        }
        if (requireValidPet && item.petId && item.petId !== 'shared' && item.petId !== 'all' && !allowedPetIds.has(item.petId)) {
          return false;
        }
      } else if (user.role === 'vet_doctor') {
        if (requireValidPet && item.petId && item.petId !== 'shared' && item.petId !== 'all') {
          const isAssigned = isVetAssignedToPet(user.id, item.petId, allExistingPets);
          const isOwnPet = myExistingPetIds.has(item.petId);
          if (!isAssigned && !isOwnPet) return false;
        }
      }

      return true;
    });

    if (toAdd.length > 0) {
      operations.push({ collection, data: [...existing, ...toAdd], isObject: false });
    }
  };

  const queueMergeObject = (collection, newData) => {
    if (!newData || typeof newData !== 'object') return;
    const existing = getCollectionData(collection, true);
    let changed = false;
    for (const [k, v] of Object.entries(newData)) {
      if (user.role !== 'system_admin' && !allowedPetIds.has(k)) {
        continue;
      }
      if (!existing[k]) {
        existing[k] = v;
        changed = true;
      }
    }
    if (changed) {
      operations.push({ collection, data: existing, isObject: true });
    }
  };

  queueMergeArray('pets', validIncomingPets, false);
  queueMergeArray('schedules', schedules, true);
  queueMergeArray('expenses', expenses, true);
  queueMergeArray('daily_logs', daily_logs, true);
  queueMergeArray('prescriptions', prescriptions, true);
  queueMergeArray('family_members', family_members, false);
  queueMergeArray('daily_habits', daily_habits, true);
  queueMergeArray('appointments', appointments, true);
  queueMergeArray('medical_records', medical_records || req.body.medical_records, true);
  
  queueMergeObject('lost_modes', lost_modes);
  queueMergeObject('health_data', health_data);

  if (operations.length > 0) {
    try {
      const ok = saveMultipleCollections(operations);
      if (!ok) {
        return res.status(500).json({ success: false, error: 'Lỗi ghi dữ liệu vào hệ thống lưu trữ khi đồng bộ. Toàn bộ thay đổi đã được hoàn tác.', code: 'TRANSACTION_ROLLBACK' });
      }
    } catch (txErr) {
      if (txErr.code === 'ROLLBACK_FAILED') {
        return res.status(500).json({ success: false, error: txErr.message, code: 'ROLLBACK_FAILED' });
      }
      throw txErr;
    }
  }

  res.json({ success: true, message: 'Migration completed' });
});

// ----------------------------------------------------------------------------
// 2. AI CHATBOT OLLAMA + RAG (ĐẶT TRƯỚC /:collection ĐỂ TRÁNH BỊ BẮT VÀO WILDCARD)
// ----------------------------------------------------------------------------

// POST /chat - Trả lời câu hỏi người dùng kèm RAG và dữ liệu thú cưng
router.post('/chat', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  const endpoint = `${req.method} ${req.originalUrl || req.baseUrl + req.path || req.url}`;
  const userId = req.user?.id || 'anonymous';
  const userRole = req.user?.role || 'none';
  const { message, petId, petContext } = req.body || {};
  const targetPetId = petId || (petContext && petContext.id ? petContext.id : null);
  const msgPreview = typeof message === 'string' ? `${message.substring(0, 80)}${message.length > 80 ? '...' : ''}` : '';

  console.log(`[CHAT INCOMING] ${new Date().toISOString()} | Endpoint: ${endpoint} | User: ${userId} (${userRole}) | Pet: ${targetPetId || 'general'} | Message: "${msgPreview}"`);

  try {
    const result = await processChatConsultation({
      userId: req.user.id,
      userRole: req.user.role,
      message,
      petId: targetPetId
    });

    const durationMs = Date.now() - startTime;
    console.log(`[CHAT COMPLETED] ${new Date().toISOString()} | Endpoint: ${endpoint} | HTTP Status: 200 OK | Duration: ${durationMs}ms | ReplyLen: ${result.reply?.length || 0} | Sources: ${result.sources?.length || 0}`);

    // Trả về cấu trúc đồng bộ tuyệt đối (đảm bảo dù frontend đọc trực tiếp hay qua apiFetch.data đều có success: true)
    return res.status(200).json({
      success: true,
      requestId: result.requestId,
      status: result.status || 'answered',
      reply: result.reply,
      sources: result.sources || [],
      petContext: result.petContext || null,
      durationMs,
      data: {
        success: true,
        requestId: result.requestId,
        status: result.status || 'answered',
        reply: result.reply,
        sources: result.sources || [],
        petContext: result.petContext || null,
        durationMs
      }
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const statusCode = error.statusCode || 500;
    const errorCode = error.code || 'CHAT_ERROR';
    const errorMsg = error.message || 'Lỗi hệ thống khi xử lý câu hỏi.';

    // Ghi nhận đầy đủ thông tin kỹ thuật backend phục vụ truy vết (không log token)
    console.error(`[CHAT FAILED] ${new Date().toISOString()} | Endpoint: ${endpoint} | HTTP Status: ${statusCode} | ErrorCode: ${errorCode} | Duration: ${durationMs}ms`);
    console.error(`[CHAT ERROR MSG]: ${errorMsg}`);
    if (error.technicalDetail) {
      console.error(`[CHAT TECH DETAIL]:`, error.technicalDetail);
    }
    if (error.stack) {
      console.error(`[CHAT BACKEND STACK TRACE]:\n${error.stack}`);
    }

    return res.status(statusCode).json({
      success: false,
      requestId: `req-err-${Date.now()}`,
      status: 'service_error',
      error: errorMsg,
      code: errorCode,
      technicalDetail: error.technicalDetail || null,
      durationMs,
      data: {
        success: false,
        status: 'service_error',
        error: errorMsg,
        code: errorCode,
        durationMs
      }
    });
  }
});

// GET /chat/history - Lấy lịch sử trò chuyện theo người dùng và thú cưng (hoặc hỏi chung)
router.get('/chat/history', authenticateToken, (req, res) => {
  try {
    const { petId } = req.query;
    const history = getChatHistory(req.user.id, petId);
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('[Chat History API Error]:', error.message);
    res.status(500).json({
      success: false,
      error: 'Không thể tải lịch sử trò chuyện.'
    });
  }
});

// DELETE /chat/history - Xóa lịch sử trò chuyện phạm vi đang chọn
router.delete('/chat/history', authenticateToken, (req, res) => {
  try {
    const { petId } = req.query;
    const result = clearChatHistory(req.user.id, petId);
    res.json(result);
  } catch (error) {
    console.error('[Chat Clear API Error]:', error.message);
    res.status(500).json({
      success: false,
      error: 'Không thể xóa lịch sử trò chuyện.'
    });
  }
});

// GET /chat/status - Kiểm tra trạng thái sẵn sàng của Chatbot và mô hình
router.get('/chat/status', async (req, res) => {
  try {
    const ollamaUrl = (config.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
    const textModel = process.env.OLLAMA_TEXT_MODEL || 'qwen2.5:1.5b';
    const embedModel = process.env.OLLAMA_EMBED_MODEL || 'embeddinggemma';

    let isOllamaRunning = false;
    let installedModels = [];

    try {
      const resp = await fetch(`${ollamaUrl}/api/tags`);
      if (resp.ok) {
        isOllamaRunning = true;
        const data = await resp.json();
        installedModels = (data.models || []).map(m => m.name);
      }
    } catch (_) {}

    const isTextModelReady = installedModels.some(m => m === textModel || m.startsWith(`${textModel}:`));
    const isEmbedModelReady = installedModels.some(m => m === embedModel || m.startsWith(`${embedModel}:`));
    const rag = getRagStatus();

    res.json({
      success: true,
      data: {
        isOllamaRunning,
        textModel,
        isTextModelReady,
        embedModel,
        isEmbedModelReady,
        rag
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /admin/rag/docs - Quản trị tài liệu RAG
router.get('/admin/rag/docs', authenticateToken, (req, res) => {
  if (req.user.role !== 'system_admin') {
    return res.status(403).json({ success: false, error: 'Chỉ Quản trị viên hệ thống mới có quyền truy cập.' });
  }
  try {
    const docs = getRagDocuments();
    const sources = getRagSources();
    const status = getRagStatus();
    res.json({
      success: true,
      data: {
        docs,
        sources,
        status
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /admin/rag/docs/:id/toggle - Bật/tắt tài liệu và tự cập nhật chỉ mục
router.post('/admin/rag/docs/:id/toggle', authenticateToken, async (req, res) => {
  if (req.user.role !== 'system_admin') {
    return res.status(403).json({ success: false, error: 'Chỉ Quản trị viên hệ thống mới có quyền truy cập.' });
  }
  try {
    const { id } = req.params;
    const { enabled } = req.body;
    const result = await toggleRagDocumentStatus(id, enabled);
    res.json({
      success: true,
      message: `Đã cập nhật trạng thái tài liệu ${id}.`,
      data: result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /admin/rag/reindex - Yêu cầu tái lập chỉ mục toàn bộ
router.post('/admin/rag/reindex', authenticateToken, async (req, res) => {
  if (req.user.role !== 'system_admin') {
    return res.status(403).json({ success: false, error: 'Chỉ Quản trị viên hệ thống mới có quyền truy cập.' });
  }
  try {
    const result = await reindexRagAll();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /admin/rag/docs - Thêm hoặc cập nhật tài liệu RAG
router.post('/admin/rag/docs', authenticateToken, async (req, res) => {
  if (req.user.role !== 'system_admin') {
    return res.status(403).json({ success: false, error: 'Chỉ Quản trị viên hệ thống mới có quyền truy cập.' });
  }
  try {
    const result = await upsertRagDocument(req.body);
    res.json({
      success: true,
      message: 'Đã lưu tài liệu và cập nhật chỉ mục RAG.',
      data: result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /admin/rag/docs/:id - Xóa tài liệu RAG
router.delete('/admin/rag/docs/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'system_admin') {
    return res.status(403).json({ success: false, error: 'Chỉ Quản trị viên hệ thống mới có quyền truy cập.' });
  }
  try {
    const result = await deleteRagDocument(req.params.id);
    res.json({
      success: true,
      message: `Đã xóa tài liệu ${req.params.id} và cập nhật chỉ mục RAG.`,
      data: result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------------------------------
// 2.1. OLLAMA VISION VÀ QUAN SÁT ẢNH THÚ CƯNG (ĐẶT TRƯỚC /:collection)
// ----------------------------------------------------------------------------

/**
 * GET /ai/vision-status
 * Kiểm tra trạng thái Ollama + model Vision.
 * Không yêu cầu xác thực (để frontend hiển thị trạng thái ngay cả khi chưa đăng nhập).
 * Không gây tải nặng — chỉ gọi /api/tags của Ollama.
 */
router.get('/ai/vision-status', async (req, res) => {
  try {
    const status = await checkOllamaStatus();
    return res.json({
      success: true,
      ...status
    });
  } catch (err) {
    console.error('[Vision Status] Lỗi kiểm tra Ollama:', err);
    return res.status(500).json({
      success: false,
      isRunning: false,
      isModelInstalled: false,
      supportsVision: false,
      configuredModel: process.env.OLLAMA_VISION_MODEL || 'moondream:1.8b',
      availableModels: [],
      statusCode: 'INTERNAL_ERROR',
      message: 'Lỗi nội bộ khi kiểm tra trạng thái Ollama.'
    });
  }
});

/**
 * POST /ai/vision-analyze
 * Phân tích ảnh thú cưng qua Ollama Vision.
 * Yêu cầu xác thực JWT.
 * Body: { petId, imageBase64, observationNotes: { location?, symptoms?, duration? } }
 */
router.post('/ai/vision-analyze', authenticateToken, async (req, res) => {
  const { petId, imageBase64, observationNotes } = req.body || {};
  const userId = req.user?.id;

  // 1. Kiểm tra đầu vào
  if (!petId || typeof petId !== 'string') {
    return res.status(400).json({ success: false, error: 'Thiếu petId hợp lệ.', code: 'MISSING_PET_ID' });
  }

  // 1.1. Chuẩn hóa và kiểm tra dữ liệu ảnh thật (xử lý Base64 thuần hoặc Data URL, nhận diện đúng JPEG /9j/, PNG, WebP)
  const imageValidation = validateAndNormalizeImage(imageBase64);
  if (!imageValidation.valid) {
    return res.status(400).json({
      success: false,
      error: imageValidation.error,
      code: imageValidation.code
    });
  }

  // 2. Kiểm tra quyền sở hữu thú cưng từ phiên xác thực
  let pets = [];
  try {
    pets = getCollectionData('pets') || [];
  } catch (_) {}
  const pet = pets.find(p => p.id === petId);
  if (!pet) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy thú cưng với ID này.', code: 'PET_NOT_FOUND' });
  }
  if (pet.ownerId && userId && String(pet.ownerId) !== String(userId)) {
    return res.status(403).json({ success: false, error: 'Bạn không có quyền phân tích ảnh của thú cưng này.', code: 'FORBIDDEN' });
  }

  // 3. Kiểm tra nhanh trạng thái Ollama trước khi gửi ảnh
  let ollamaStatus;
  try {
    ollamaStatus = await checkOllamaStatus();
  } catch (statusErr) {
    console.error('[Vision Analyze] Lỗi kiểm tra trạng thái Ollama:', statusErr);
    return res.status(503).json({
      success: false,
      error: 'Không thể kiểm tra trạng thái Ollama. Vui lòng đảm bảo Ollama đang chạy.',
      code: 'OLLAMA_UNAVAILABLE'
    });
  }

  if (!ollamaStatus.isRunning) {
    return res.status(503).json({
      success: false,
      error: `Dịch vụ Ollama chưa chạy tại ${process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'}. Hãy khởi động Ollama trước.`,
      code: 'OLLAMA_NOT_RUNNING'
    });
  }
  if (!ollamaStatus.isModelInstalled) {
    return res.status(503).json({
      success: false,
      error: `Model "${ollamaStatus.configuredModel}" chưa được cài. Hãy chạy: ollama pull ${ollamaStatus.configuredModel}`,
      code: 'MODEL_NOT_INSTALLED'
    });
  }
  if (!ollamaStatus.supportsVision) {
    return res.status(422).json({
      success: false,
      error: `Model "${ollamaStatus.configuredModel}" là model văn bản, không hỗ trợ phân tích ảnh. Hãy đổi OLLAMA_VISION_MODEL thành "moondream:1.8b" trong .env.`,
      code: 'MODEL_TEXT_ONLY'
    });
  }

  // 4. Gọi Ollama phân tích ảnh thật
  const petInfo = {
    name: pet.name || 'Thú cưng',
    species: pet.species || '',
    breed: pet.breed || 'Chưa cập nhật',
    age: pet.age || null,
    weight: pet.weight || null
  };

  const notes = {
    location: (observationNotes?.location || '').trim(),
    symptoms: (observationNotes?.symptoms || '').trim(),
    duration: (observationNotes?.duration || '').trim()
  };

  let visionResult;
  try {
    visionResult = await analyzeImageWithOllama({
      imageBase64: imageValidation.cleanBase64,
      petInfo,
      observationNotes: notes
    });
  } catch (analyzeErr) {
    console.error(`[Vision Analyze] Lỗi phân tích Ollama (Pet: ${petId}, Size: ${imageValidation.sizeBytes}b, Format: ${imageValidation.format}):`, analyzeErr?.message || analyzeErr);

    if (analyzeErr.message === 'ABORTED') {
      return res.status(499).json({
        success: false,
        error: 'Yêu cầu phân tích đã bị hủy.',
        code: 'REQUEST_ABORTED'
      });
    }
    return res.status(502).json({
      success: false,
      error: analyzeErr.message || 'Lỗi khi gửi ảnh tới Ollama. Vui lòng thử lại.',
      code: 'VISION_ANALYZE_FAILED'
    });
  }

  // 5. Trả kết quả thực tế — tách biệt rõ nguồn
  return res.json({
    success: true,
    data: {
      petId,
      petName: pet.name,
      petSpecies: pet.species,
      analysis: visionResult.analysis || visionResult.rawText,
      originalText: visionResult.rawText,
      model: visionResult.model,
      visionModel: visionResult.visionModel,
      textModel: visionResult.textModel,
      analyzedAt: visionResult.analyzedAt,
      ownerNotes: notes,
      sourceLabel: 'AI hỗ trợ quan sát — tham khảo',
      disclaimer: 'Kết quả này do AI hỗ trợ quan sát bề mặt hình ảnh, không phải chẩn đoán y khoa. Không kết luận thú cưng khỏe mạnh hay loại trừ bệnh tật từ hình ảnh. Ảnh chụp 2D không thể thay thế thăm khám trực tiếp và xét nghiệm chuyên sâu; không quan sát rõ bất thường trong vùng ảnh không đồng nghĩa với việc không có bệnh. Tuyệt đối không tự ý dùng thuốc hay điều trị khi chưa có chỉ định từ Bác sĩ Thú y.'
    }
  });
});

/**
 * POST /ai/save-observation
 * Lưu kết quả quan sát AI vào bộ nhớ thú cưng.
 * Yêu cầu xác thực JWT.
 * Body: { petId, observationNotes, aiFindings, model }
 * Không tự tạo bệnh án — chỉ lưu ghi chú tham khảo.
 */
router.post('/ai/save-observation', authenticateToken, async (req, res) => {
  const { petId, observationNotes, aiFindings, model } = req.body || {};
  const userId = req.user?.id;

  if (!petId || !aiFindings) {
    return res.status(400).json({ success: false, error: 'Thiếu petId hoặc nội dung quan sát.', code: 'MISSING_FIELDS' });
  }

  // Kiểm tra quyền sở hữu thú cưng
  let pets = [];
  try {
    pets = getCollectionData('pets') || [];
  } catch (_) {}
  const pet = pets.find(p => p.id === petId);
  if (!pet) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy thú cưng.', code: 'PET_NOT_FOUND' });
  }
  if (pet.ownerId && userId && String(pet.ownerId) !== String(userId)) {
    return res.status(403).json({ success: false, error: 'Bạn không có quyền lưu kết quả cho thú cưng này.', code: 'FORBIDDEN' });
  }

  // Đọc collection ai_observations (tạo mới nếu chưa có)
  let observations = [];
  try {
    observations = getCollectionData('ai_observations') || [];
  } catch (_) { observations = []; }
  if (!Array.isArray(observations)) observations = [];

  // Tạo bản ghi mới — nhãn nguồn "AI hỗ trợ quan sát — tham khảo"
  const newRecord = {
    id: `aiobs_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    petId,
    ownerId: userId,
    observationNotes: {
      location: (observationNotes?.location || '').trim(),
      symptoms: (observationNotes?.symptoms || '').trim(),
      duration: (observationNotes?.duration || '').trim()
    },
    aiFindings: String(aiFindings).slice(0, 5000), // giới hạn kích thước lưu
    model: model || process.env.OLLAMA_VISION_MODEL || 'moondream:1.8b',
    sourceLabel: 'AI hỗ trợ quan sát — tham khảo',
    savedAt: new Date().toISOString()
  };

  observations.push(newRecord);
  const ok = saveCollectionData('ai_observations', observations);

  if (!ok) {
    return res.status(500).json({
      success: false,
      error: 'Lỗi ghi dữ liệu vào hệ thống lưu trữ. Vui lòng thử lại.',
      code: 'STORAGE_WRITE_ERROR'
    });
  }

  return res.json({
    success: true,
    data: {
      id: newRecord.id,
      petId,
      savedAt: newRecord.savedAt,
      sourceLabel: newRecord.sourceLabel
    }
  });
});

// ----------------------------------------------------------------------------
// 2.2. LỊCH SỬ QUAN SÁT ẢNH THÚ CƯNG (AI OBSERVATIONS HISTORY)
// ----------------------------------------------------------------------------

router.get('/ai/observations', authenticateToken, async (req, res) => {
  try {
    const { petId } = req.query;
    const allObs = getCollectionData('ai_observations', false) || [];
    let userObs = allObs.filter(item => String(item.ownerId).trim() === String(req.user.id).trim());
    if (petId) {
      userObs = userObs.filter(item => String(item.petId).trim() === String(petId).trim());
    }
    // Sắp xếp mới nhất lên đầu
    userObs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.json({ success: true, data: userObs });
  } catch (error) {
    console.error('Get observations error:', error?.message || error);
    return res.status(500).json({ success: false, error: 'Lỗi máy chủ khi tải lịch sử quan sát' });
  }
});

// Mutex tránh xung đột race condition khi toggle lịch chăm sóc cùng lúc
const toggleScheduleLocks = new Map();

async function acquireScheduleLock(scheduleId) {
  while (toggleScheduleLocks.has(scheduleId)) {
    await toggleScheduleLocks.get(scheduleId);
  }
  let resolver;
  const promise = new Promise(resolve => { resolver = resolve; });
  toggleScheduleLocks.set(scheduleId, promise);
  return () => {
    toggleScheduleLocks.delete(scheduleId);
    resolver();
  };
}

// ----------------------------------------------------------------------------
// 2.5. HOÀN THÀNH LỊCH CHĂM SÓC LẶP TRONG MỘT GIAO DỊCH DUY NHẤT (ATOMIC SCHEDULE TOGGLE)
// ----------------------------------------------------------------------------
router.post('/schedules/:id/toggle-complete', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const releaseLock = await acquireScheduleLock(id);

  try {
    const schedules = getCollectionData('schedules', false);
    const index = schedules.findIndex(s => s.id === id);
    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: 'Lịch chăm sóc không tồn tại trong hệ thống.',
        code: 'SCHEDULE_NOT_FOUND'
      });
    }

    const currentSchedule = schedules[index];
    const allPets = getCollectionData('pets', false);

    // Kiểm tra phân quyền truy cập
    if (req.user.role !== 'system_admin') {
      if (req.user.role === 'pet_owner') {
        if (currentSchedule.ownerId && currentSchedule.ownerId !== req.user.id) {
          return res.status(403).json({
            success: false,
            error: 'Bạn không có quyền thay đổi trạng thái lịch chăm sóc của người khác.',
            code: 'FORBIDDEN'
          });
        }
      } else if (req.user.role === 'vet_doctor') {
        const isAssigned = isVetAssignedToPet(req.user.id, currentSchedule.petId, allPets);
        if (!isAssigned) {
          return res.status(403).json({
            success: false,
            error: 'Bác sĩ không được phân công chăm sóc thú cưng này.',
            code: 'FORBIDDEN'
          });
        }
      }
    }

    // Xác định trạng thái mong muốn: nếu gửi explicit completed thì dùng, ngược lại đảo ngược trạng thái hiện tại
    let isNowCompleted;
    if (req.body && typeof req.body.completed === 'boolean') {
      isNowCompleted = req.body.completed;
    } else {
      isNowCompleted = !currentSchedule.completed;
    }

    // Chống tạo trùng khi gửi lại request hoặc thử lại sau lỗi (Anti-replay / Idempotency)
    // Nếu request yêu cầu completed mà bản ghi ĐÃ completed rồi:
    if (isNowCompleted && currentSchedule.completed) {
      const existingNext = currentSchedule.nextRecurrenceId
        ? schedules.find(s => s.id === currentSchedule.nextRecurrenceId)
        : schedules.find(s => s.parentScheduleId === currentSchedule.id && !s.completed);
      return res.json({
        success: true,
        data: {
          updatedSchedule: currentSchedule,
          nextSchedule: existingNext || null
        }
      });
    }

    const updatedItem = {
      ...currentSchedule,
      completed: isNowCompleted,
      completedAt: isNowCompleted ? (currentSchedule.completedAt || new Date().toISOString()) : null
    };

    let nextSchedule = null;
    if (isNowCompleted && currentSchedule.repeat && currentSchedule.repeat !== 'none') {
      const existingNext = currentSchedule.nextRecurrenceId
        ? schedules.find(s => s.id === currentSchedule.nextRecurrenceId)
        : schedules.find(s => s.parentScheduleId === currentSchedule.id && !s.completed);

      if (existingNext) {
        nextSchedule = existingNext;
        updatedItem.nextRecurrenceId = existingNext.id;
      } else {
        let nextDateStr = currentSchedule.date;
        switch (currentSchedule.repeat) {
          case 'weekly':
            nextDateStr = addDaysLocal(currentSchedule.date, 7);
            break;
          case 'monthly':
            nextDateStr = addMonthsClamped(currentSchedule.date, 1);
            break;
          case 'quarterly':
            nextDateStr = addMonthsClamped(currentSchedule.date, 3);
            break;
          case 'yearly':
            nextDateStr = addYearsClamped(currentSchedule.date, 1);
            break;
          default:
            break;
        }

        // Kiểm tra xem đã có lịch chưa hoàn thành trùng petId, title và nextDateStr hay chưa
        const titleKey = currentSchedule.title || currentSchedule.task || currentSchedule.activity;
        const duplicatePending = schedules.find(s =>
          s.petId === currentSchedule.petId &&
          (s.title || s.task || s.activity) === titleKey &&
          s.date === nextDateStr &&
          !s.completed
        );

        if (duplicatePending) {
          nextSchedule = duplicatePending;
          updatedItem.nextRecurrenceId = duplicatePending.id;
        } else {
          const nextId = `sch-${Date.now()}-next`;
          updatedItem.nextRecurrenceId = nextId;
          nextSchedule = {
            ...currentSchedule,
            id: nextId,
            parentScheduleId: currentSchedule.id,
            nextRecurrenceId: null,
            date: nextDateStr,
            completed: false,
            completedAt: null,
            createdAt: new Date().toISOString()
          };
        }
      }
    }

    // Giao dịch nguyên tử (Atomic transaction): Cập nhật trạng thái và tạo lịch tiếp theo trong cùng 1 lần lưu
    const updatedSchedules = [...schedules];
    updatedSchedules[index] = updatedItem;
    if (nextSchedule && !schedules.some(s => s.id === nextSchedule.id)) {
      updatedSchedules.unshift(nextSchedule);
    }

    const ok = saveCollectionData('schedules', updatedSchedules);
    if (!ok) {
      return res.status(500).json({
        success: false,
        error: 'Lỗi ghi dữ liệu lịch chăm sóc vào hệ thống lưu trữ. Toàn bộ thao tác đã bị hủy bỏ và không làm thay đổi trạng thái.',
        code: 'STORAGE_WRITE_ERROR'
      });
    }

    return res.json({
      success: true,
      data: {
        updatedSchedule: updatedItem,
        nextSchedule
      }
    });
  } catch (err) {
    console.error('Error toggling schedule complete:', err);
    return res.status(500).json({
      success: false,
      error: 'Lỗi máy chủ khi cập nhật lịch chăm sóc.',
      code: 'SERVER_ERROR'
    });
  } finally {
    releaseLock();
  }
});

// Mutex tránh xung đột race condition khi chốt bệnh án và hoàn thành lịch khám
const finalizeEhrLocks = new Map();

async function acquireFinalizeEhrLock(appointmentId) {
  while (finalizeEhrLocks.has(appointmentId)) {
    await finalizeEhrLocks.get(appointmentId);
  }
  let resolver;
  const promise = new Promise(resolve => { resolver = resolve; });
  finalizeEhrLocks.set(appointmentId, promise);
  return () => {
    finalizeEhrLocks.delete(appointmentId);
    resolver();
  };
}

// ----------------------------------------------------------------------------
// 2.6. CHỐT BỆNH ÁN & HOÀN THÀNH LỊCH KHÁM TRONG MỘT GIAO DỊCH DUY NHẤT (ATOMIC EHR SIGN-OFF)
// ----------------------------------------------------------------------------
const handleFinalizeEhr = async (req, res) => {
  const appointmentId = req.params.id || req.body.appointmentId;
  const { petId, soap, notes, recordId } = req.body;

  if (!appointmentId || typeof appointmentId !== 'string' || !appointmentId.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Mã lịch khám (appointmentId) là bắt buộc.',
      code: 'MISSING_APPOINTMENT_ID'
    });
  }

  if (!petId || typeof petId !== 'string' || !petId.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Mã thú cưng (petId) là bắt buộc.',
      code: 'MISSING_PET_ID'
    });
  }

  // 1. Phân quyền: Chỉ Bác sĩ thú y hoặc Quản trị viên mới có quyền chốt bệnh án
  if (req.user.role !== 'vet_doctor' && req.user.role !== 'system_admin') {
    return res.status(403).json({
      success: false,
      error: 'Chỉ Bác sĩ thú y hoặc Quản trị viên mới có quyền chốt bệnh án và hoàn tất ca khám.',
      code: 'FORBIDDEN'
    });
  }

  const releaseLock = await acquireFinalizeEhrLock(appointmentId);
  try {
    const appointments = getCollectionData('appointments', false);
    const medicalRecords = getCollectionData('medical_records', false);
    const allPets = getCollectionData('pets', false);

    // 2. Kiểm tra sự tồn tại của lịch khám
    const appIndex = appointments.findIndex(a => a.id === appointmentId);
    if (appIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Lịch khám không tồn tại trong hệ thống.',
        code: 'APPOINTMENT_NOT_FOUND'
      });
    }
    const appointment = appointments[appIndex];

    // 3. Kiểm tra quan hệ appointmentId–petId
    if (appointment.petId !== petId) {
      return res.status(400).json({
        success: false,
        error: 'Thú cưng không khớp với thông tin đã đăng ký trong lịch khám (sai quan hệ appointmentId–petId).',
        code: 'PET_MISMATCH'
      });
    }

    const pet = allPets.find(p => p.id === petId);
    if (!pet) {
      return res.status(404).json({
        success: false,
        error: 'Thú cưng liên kết với lịch khám không tồn tại trong hệ thống.',
        code: 'PET_NOT_FOUND'
      });
    }

    // 4. Kiểm tra quyền bác sĩ trên ca khám: Quyền thao tác trên ca khám phải căn cứ bác sĩ được phân công cho chính ca đó.
    // Phân công chăm sóc thú cưng không được tự động cho phép thao tác ca thuộc bác sĩ khác.
    if (req.user.role === 'vet_doctor') {
      const apptVetId = appointment.assignedVetId || appointment.vetId;
      if (!apptVetId || apptVetId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Bạn không phải là bác sĩ được phân công phụ trách ca khám này. Chỉ bác sĩ được phân công cho ca khám hoặc quản trị viên mới có quyền chốt ca.',
          code: 'FORBIDDEN_NOT_ASSIGNED_VET'
        });
      }
    }

    // 5. Kiểm tra trạng thái hiện tại & Chống chốt lặp / Xử lý trùng khi bấm nhiều lần (Anti-replay / Idempotency)
    if (appointment.status === 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Lịch khám đang ở trạng thái chờ xác nhận. Vui lòng xác nhận lịch và bắt đầu khám trước khi chốt bệnh án.',
        code: 'APPOINTMENT_PENDING'
      });
    }

    if (appointment.status === 'confirmed') {
      return res.status(400).json({
        success: false,
        error: 'Lịch khám chưa được bắt đầu khám. Vui lòng tiếp nhận bắt đầu khám trước khi chốt bệnh án.',
        code: 'APPOINTMENT_NOT_STARTED'
      });
    }

    if (appointment.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Lịch khám đã bị hủy, không thể chốt bệnh án hoặc hoàn thành.',
        code: 'INVALID_STATUS'
      });
    }

    // Kiểm tra tính toàn vẹn của recordId nếu client truyền lên
    const recordByApp = medicalRecords.find(r => r.appointmentId === appointmentId);
    let recordById = null;
    if (recordId && typeof recordId === 'string' && recordId.trim()) {
      recordById = medicalRecords.find(r => r.id === recordId.trim());
      if (recordById) {
        if (recordById.appointmentId && recordById.appointmentId !== appointmentId) {
          return res.status(400).json({
            success: false,
            error: 'Mã bệnh án (recordId) đã thuộc về một ca khám khác. Không được phép liên kết chéo.',
            code: 'RECORD_MISMATCH'
          });
        }
        if (recordById.petId && recordById.petId !== petId) {
          return res.status(400).json({
            success: false,
            error: 'Mã bệnh án (recordId) đã thuộc về một thú cưng khác. Không được phép liên kết chéo.',
            code: 'RECORD_MISMATCH'
          });
        }
      }
      if (recordByApp && recordById && recordByApp.id !== recordById.id) {
        return res.status(400).json({
          success: false,
          error: 'Xung đột mã bệnh án: Ca khám này đã liên kết với bệnh án khác trong hệ thống.',
          code: 'RECORD_MISMATCH'
        });
      }
    }

    const existingRecord = recordByApp || recordById;

    // Chống ghi đè bệnh án đã chốt và chống chốt lại khi ca khám đã hoàn thành
    if (existingRecord && existingRecord.isFinal) {
      const allPrescriptions = getCollectionData('prescriptions', false);
      const existingPrescription = allPrescriptions.find(p => 
        (p.medicalRecordId && p.medicalRecordId === existingRecord.id) ||
        (p.appointmentId && p.appointmentId === appointmentId)
      ) || null;

      // Bệnh án đã chốt trước đó: Tuyệt đối không ghi đè nội dung mới, trả về bản ghi hiện tại an toàn
      return res.json({
        success: true,
        message: 'Bệnh án đã được chốt và lịch khám đã hoàn thành trước đó.',
        data: {
          appointment: appointment.status === 'completed' ? appointment : { ...appointment, status: 'completed' },
          medicalRecord: existingRecord,
          prescription: existingPrescription
        }
      });
    }

    if (appointment.status === 'completed' && (!existingRecord || !existingRecord.isFinal)) {
      return res.status(400).json({
        success: false,
        error: 'Lịch khám đã ở trạng thái hoàn thành từ trước.',
        code: 'APPOINTMENT_ALREADY_COMPLETED'
      });
    }

    // 6. Chuẩn bị dữ liệu bệnh án chốt (isFinal = true, status = published) và lịch khám completed
    const recordIndex = existingRecord ? medicalRecords.findIndex(r => r.id === existingRecord.id) : -1;
    const nowIso = new Date().toISOString();
    const targetRecordId = (recordIndex !== -1) ? medicalRecords[recordIndex].id : (recordId || `med-${Date.now()}`);
    const existing = (recordIndex !== -1) ? medicalRecords[recordIndex] : null;

    const finalizedRecord = {
      ...(existing || {}),
      id: targetRecordId,
      appointmentId,
      petId,
      ownerId: pet.ownerId, // gắn đúng ownerId của chủ thú cưng để chủ xem được khi isFinal = true
      authorId: req.user.id,
      authorName: req.user.name,
      vetId: req.user.id,
      soap: soap || existing?.soap || {},
      subjective: soap?.subjective !== undefined ? soap.subjective : (req.body.subjective || existing?.subjective || ''),
      objective: soap?.objective !== undefined ? soap.objective : (req.body.objective || existing?.objective || ''),
      assessment: soap?.assessment || req.body.assessment || existing?.assessment || '',
      plan: soap?.plan || req.body.plan || existing?.plan || '',
      reason: appointment.note || appointment.service || existing?.reason || '',
      chiefComplaint: appointment.note || existing?.chiefComplaint || '',
      facility: appointment.facility || existing?.facility || '',
      facilityId: appointment.facilityId || existing?.facilityId || '',
      vetName: req.user.name,
      doctor: req.user.name,
      notes: notes || soap?.notes || existing?.notes || '',
      isFinal: true,
      status: 'published',
      confirmedAt: existing?.confirmedAt || nowIso,
      confirmedBy: existing?.confirmedBy || req.user.name,
      updatedAt: nowIso,
      createdAt: existing?.createdAt || nowIso
    };

    const updatedAppointment = {
      ...appointment,
      status: 'completed',
      completedAt: appointment.completedAt || nowIso,
      updatedAt: nowIso
    };

    // 7. Xử lý đơn thuốc (Prescriptions) thống nhất với Bệnh án lâm sàng:
    const allPrescriptions = getCollectionData('prescriptions', false);
    const existingPresIndex = allPrescriptions.findIndex(p => 
      (p.medicalRecordId && p.medicalRecordId === targetRecordId) ||
      (p.appointmentId && p.appointmentId === appointmentId)
    );
    const existingPrescription = existingPresIndex !== -1 ? allPrescriptions[existingPresIndex] : null;

    // Trích xuất danh sách thuốc từ SOAP form
    const rawMeds = soap?.planMedications || soap?.prescriptions || req.body.medications || req.body.prescriptions || [];
    const validMeds = Array.isArray(rawMeds) ? rawMeds.filter(m => m && typeof m.name === 'string' && m.name.trim().length > 0) : [];

    let updatedPrescriptions = [...allPrescriptions];
    let finalizedPrescription = null;

    if (validMeds.length > 0) {
      // Chuẩn hóa danh sách thuốc chi tiết
      const normalizedMedications = validMeds.map(m => {
        const d = Number(m.days || m.durationDays) || 7;
        const doseStr = String(m.dose || m.dosage || '').trim();
        const routeStr = String(m.route || '').trim();
        const freqStr = String(m.freq || '').trim();
        const usageStr = String(m.instructions || m.instruction || m.usage || m.notes || '').trim();
        return {
          name: m.name.trim(),
          dose: doseStr,
          dosage: doseStr,
          route: routeStr,
          freq: freqStr,
          startDate: m.startDate ? getVnDateString(m.startDate) : getTodayVnDate(),
          days: d,
          durationDays: d,
          instructions: usageStr,
          usage: usageStr,
          quantity: m.quantity !== undefined ? m.quantity : ''
        };
      });

      const firstMed = normalizedMedications[0];
      const prescriptionId = existingPrescription?.id || `pres-${targetRecordId.replace(/^med-/, '')}`;

      finalizedPrescription = {
        ...(existingPrescription || {}),
        id: prescriptionId,
        medicalRecordId: targetRecordId,
        appointmentId,
        petId,
        ownerId: pet.ownerId, // Server enforce từ hồ sơ pet thực tế, tuyệt đối không tin client
        vetId: req.user.id,   // Server enforce từ session bác sĩ đang đăng nhập
        prescribedBy: req.user.name,
        vetName: req.user.name,
        diagnosis: finalizedRecord.assessment || 'Đơn thuốc điều trị theo bệnh án SOAP',
        title: `Đơn thuốc: ${finalizedRecord.assessment || firstMed.name}`,
        medications: normalizedMedications,
        // Các trường tương thích ngược cấp root cho PrescriptionsView & dữ liệu legacy:
        medicineName: normalizedMedications.map(m => m.name).join(', '),
        dosage: normalizedMedications.map(m => `${m.name}: ${m.dose || 'Theo chỉ định'}`).join('; '),
        startDate: firstMed.startDate,
        durationDays: Number(firstMed.days) || 7,
        purpose: finalizedRecord.assessment || 'Điều trị theo chỉ định bác sĩ',
        notes: finalizedRecord.plan || firstMed.instructions || '',
        isFinal: true,
        status: 'published',
        confirmedAt: existingPrescription?.confirmedAt || nowIso,
        createdAt: existingPrescription?.createdAt || nowIso,
        updatedAt: nowIso
      };

      if (existingPresIndex !== -1) {
        updatedPrescriptions[existingPresIndex] = finalizedPrescription;
      } else {
        updatedPrescriptions.unshift(finalizedPrescription);
      }
    } else {
      // Trường hợp không kê thuốc: Chốt được bình thường và KHÔNG tạo đơn rỗng giả!
      // Nếu trước đó có bản nháp chưa chốt cho ca khám này mà giờ xóa hết thuốc, dọn dẹp nháp
      if (existingPresIndex !== -1 && !existingPrescription?.isFinal) {
        updatedPrescriptions.splice(existingPresIndex, 1);
      }
    }

    // 8. Giao dịch nguyên tử đa tệp (Atomic Multi-Collection Transaction):
    // Cập nhật đồng thời medical_records, appointments và prescriptions (nếu có kê thuốc).
    // Nếu 1 bước thất bại -> Rollback toàn bộ!
    const updatedRecords = [...medicalRecords];
    if (recordIndex !== -1) {
      updatedRecords[recordIndex] = finalizedRecord;
    } else {
      updatedRecords.unshift(finalizedRecord);
    }

    const updatedAppointments = [...appointments];
    updatedAppointments[appIndex] = updatedAppointment;

    const operations = [
      { collection: 'medical_records', data: updatedRecords, isObject: false },
      { collection: 'appointments', data: updatedAppointments, isObject: false }
    ];

    if (validMeds.length > 0 || (existingPresIndex !== -1 && !existingPrescription?.isFinal)) {
      operations.push({ collection: 'prescriptions', data: updatedPrescriptions, isObject: false });
    }

    try {
      const ok = saveMultipleCollections(operations);
      if (!ok) {
        return res.status(500).json({
          success: false,
          error: 'Lỗi ghi dữ liệu hệ thống khi chốt bệnh án. Toàn bộ thay đổi đã được hoàn tác.',
          code: 'TRANSACTION_ROLLBACK'
        });
      }
    } catch (txErr) {
      if (txErr.code === 'ROLLBACK_FAILED') {
        return res.status(500).json({
          success: false,
          error: txErr.message,
          code: 'ROLLBACK_FAILED'
        });
      }
      throw txErr;
    }

    return res.json({
      success: true,
      message: 'Chốt bệnh án, hoàn thành lịch khám và ban hành đơn thuốc thành công.',
      data: {
        appointment: updatedAppointment,
        medicalRecord: finalizedRecord,
        prescription: finalizedPrescription
      }
    });
  } catch (err) {
    console.error('Error finalizing EHR and appointment:', err);
    return res.status(500).json({
      success: false,
      error: 'Lỗi máy chủ khi chốt bệnh án và hoàn thành lịch khám.',
      code: 'SERVER_ERROR'
    });
  } finally {
    releaseLock();
  }
};

router.post('/medical-records/finalize-ehr', authenticateToken, handleFinalizeEhr);
router.post('/appointments/:id/finalize-ehr', authenticateToken, handleFinalizeEhr);

// ----------------------------------------------------------------------------
// 2.7. ĐIỀU PHỐI / PHÂN CÔNG BÁC SĨ CHO CA KHÁM (VET APPOINTMENT DISPATCH)
// ----------------------------------------------------------------------------
router.post('/appointments/:id/assign-vet', authenticateToken, (req, res) => {
  if (req.user.role !== 'system_admin') {
    return res.status(403).json({
      success: false,
      error: 'Chỉ Quản trị viên hoặc vai trò điều phối mới có quyền phân công bác sĩ cho ca khám.',
      code: 'FORBIDDEN_ADMIN_REQUIRED'
    });
  }

  const { id } = req.params;
  const vetId = req.body.vetId || req.body.assignedVetId;

  if (!vetId || typeof vetId !== 'string' || !vetId.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Vui lòng chọn bác sĩ để phân công.',
      code: 'MISSING_VET_ID'
    });
  }

  const appointments = getCollectionData('appointments', false) || [];
  const appIndex = appointments.findIndex(a => a.id === id);
  if (appIndex === -1) {
    return res.status(404).json({
      success: false,
      error: 'Lịch khám không tồn tại trong hệ thống.',
      code: 'APPOINTMENT_NOT_FOUND'
    });
  }

  const currentApp = appointments[appIndex];
  if (currentApp.status === 'in_progress' || currentApp.status === 'completed' || currentApp.status === 'cancelled') {
    return res.status(400).json({
      success: false,
      error: 'Không thể phân công bác sĩ cho ca khám đang diễn ra, đã hoàn tất hoặc đã bị hủy.',
      code: 'CANNOT_REASSIGN_ACTIVE_OR_FINISHED'
    });
  }

  const allUsers = getUsers();
  const vet = allUsers.find(u => u.id === vetId.trim());
  if (!vet || vet.role !== 'vet_doctor' || vet.isLocked || (vet.vetStatus && vet.vetStatus !== 'approved')) {
    return res.status(400).json({
      success: false,
      error: 'Bác sĩ được chọn không tồn tại, đã bị khóa hoặc chưa được phê duyệt chứng chỉ hành nghề.',
      code: 'INVALID_ASSIGNED_VET'
    });
  }

  // Kiểm tra bác sĩ có thuộc cơ sở của ca hẹn hay không
  const appFacilityId = currentApp.facilityId;
  const vetFacilities = Array.isArray(vet.facilityIds) 
    ? vet.facilityIds 
    : (vet.facilityId ? [vet.facilityId] : []);
  if (appFacilityId && !vetFacilities.includes(appFacilityId)) {
    return res.status(400).json({
      success: false,
      error: `Bác sĩ ${vet.name} không thuộc cơ sở ${currentApp.facility || appFacilityId}. Không thể phân công cho ca khám tại cơ sở này.`,
      code: 'VET_NOT_IN_FACILITY'
    });
  }

  // Kiểm tra trùng lịch khám của bác sĩ tại ngày và giờ hẹn
  const targetDate = currentApp.date;
  const targetTime = currentApp.time || currentApp.timeSlot;
  const collision = appointments.find(a => {
    if (a.id === id || a.status === 'cancelled') return false;
    const sameTime = a.date === targetDate && (a.time || a.timeSlot) === targetTime;
    return sameTime && (a.assignedVetId === vet.id || a.vetId === vet.id);
  });

  if (collision) {
    return res.status(409).json({
      success: false,
      error: `Bác sĩ ${vet.name} đã có lịch khám khác vào khung giờ ${targetTime} ngày ${targetDate}. Vui lòng chọn bác sĩ khác hoặc đổi giờ hẹn.`,
      code: 'VET_SCHEDULE_COLLISION'
    });
  }

  const vetLabel = vet.name.startsWith('BS.') ? vet.name : `BS. ${vet.name}`;
  const updatedApp = {
    ...currentApp,
    assignedVetId: vet.id,
    assignedVet: vetLabel,
    // Phân công không tự chuyển pending thành confirmed; bác sĩ vẫn phải xác nhận lịch
    updatedAt: new Date().toISOString()
  };

  appointments[appIndex] = updatedApp;
  const ok = saveCollectionData('appointments', appointments);
  if (!ok) {
    return res.status(500).json({
      success: false,
      error: 'Lỗi ghi dữ liệu hệ thống khi lưu phân công.',
      code: 'STORAGE_WRITE_ERROR'
    });
  }

  return res.json({
    success: true,
    message: `Đã phân công ca khám cho ${vetLabel} thành công.`,
    data: updatedApp
  });
});

// ----------------------------------------------------------------------------
// 2.8. ẨN / LƯU TRỮ VÀ KHÔI PHỤC LỊCH KHÁM THEO TÀI KHOẢN (ARCHIVE / UNARCHIVE)
// - Chỉ cho phép khi trạng thái là 'completed' hoặc 'cancelled'
// - Ẩn/lưu trữ riêng theo tài khoản người dùng, không xóa vật lý lịch hoặc dữ liệu y tế
// - Người nuôi ẩn không ảnh hưởng bác sĩ và ngược lại
// ----------------------------------------------------------------------------
router.post('/appointments/:id/archive', authenticateToken, (req, res) => {
  const { id } = req.params;
  const appointments = getCollectionData('appointments', false) || [];
  const appIndex = appointments.findIndex(a => a.id === id || String(a.id).trim() === String(id).trim());
  if (appIndex === -1) {
    return res.status(404).json({
      success: false,
      error: 'Lịch khám không tồn tại trong hệ thống.',
      code: 'APPOINTMENT_NOT_FOUND'
    });
  }

  const currentApp = appointments[appIndex];

  // Kiểm tra quyền
  if (req.user.role !== 'system_admin') {
    if (req.user.role === 'pet_owner') {
      if (String(currentApp.ownerId || '').trim() !== String(req.user.id || '').trim()) {
        return res.status(403).json({
          success: false,
          error: 'Bạn không có quyền lưu trữ lịch khám của người khác.',
          code: 'FORBIDDEN_NOT_OWNER'
        });
      }
    } else if (req.user.role === 'vet_doctor') {
      const isAssigned = (currentApp.assignedVetId === req.user.id || currentApp.vetId === req.user.id);
      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          error: 'Bác sĩ không được phân công ca khám này.',
          code: 'FORBIDDEN_NOT_ASSIGNED_VET'
        });
      }
    }
  }

  // Kiểm tra trạng thái: CHỈ cho phép khi lịch đã completed hoặc cancelled
  if (currentApp.status !== 'completed' && currentApp.status !== 'cancelled') {
    return res.status(400).json({
      success: false,
      error: 'Chỉ được phép xóa khỏi danh sách khi ca khám đã hoàn thành hoặc đã bị hủy.',
      code: 'CANNOT_ARCHIVE_ACTIVE_APPOINTMENT'
    });
  }

  const currentArchived = Array.isArray(currentApp.archivedByUserIds) ? currentApp.archivedByUserIds : [];
  const userIdStr = String(req.user.id).trim();
  if (!currentArchived.includes(userIdStr)) {
    currentApp.archivedByUserIds = [...currentArchived, userIdStr];
    currentApp.updatedAt = new Date().toISOString();
  }

  appointments[appIndex] = currentApp;
  const ok = saveCollectionData('appointments', appointments);
  if (!ok) {
    return res.status(500).json({
      success: false,
      error: 'Lỗi ghi dữ liệu hệ thống khi lưu trữ lịch khám.',
      code: 'STORAGE_WRITE_ERROR'
    });
  }

  return res.json({
    success: true,
    message: 'Đã xóa lịch khám khỏi danh sách hiển thị của bạn (chuyển vào mục Đã lưu trữ).',
    data: currentApp
  });
});

router.post('/appointments/:id/unarchive', authenticateToken, (req, res) => {
  const { id } = req.params;
  const appointments = getCollectionData('appointments', false) || [];
  const appIndex = appointments.findIndex(a => a.id === id || String(a.id).trim() === String(id).trim());
  if (appIndex === -1) {
    return res.status(404).json({
      success: false,
      error: 'Lịch khám không tồn tại trong hệ thống.',
      code: 'APPOINTMENT_NOT_FOUND'
    });
  }

  const currentApp = appointments[appIndex];

  // Kiểm tra quyền
  if (req.user.role !== 'system_admin') {
    if (req.user.role === 'pet_owner') {
      if (String(currentApp.ownerId || '').trim() !== String(req.user.id || '').trim()) {
        return res.status(403).json({
          success: false,
          error: 'Bạn không có quyền khôi phục lịch khám này.',
          code: 'FORBIDDEN_NOT_OWNER'
        });
      }
    } else if (req.user.role === 'vet_doctor') {
      const isAssigned = (currentApp.assignedVetId === req.user.id || currentApp.vetId === req.user.id);
      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          error: 'Bác sĩ không được phân công ca khám này.',
          code: 'FORBIDDEN_NOT_ASSIGNED_VET'
        });
      }
    }
  }

  const currentArchived = Array.isArray(currentApp.archivedByUserIds) ? currentApp.archivedByUserIds : [];
  const userIdStr = String(req.user.id).trim();
  currentApp.archivedByUserIds = currentArchived.filter(uid => uid !== userIdStr);
  currentApp.updatedAt = new Date().toISOString();

  appointments[appIndex] = currentApp;
  const ok = saveCollectionData('appointments', appointments);
  if (!ok) {
    return res.status(500).json({
      success: false,
      error: 'Lỗi ghi dữ liệu hệ thống khi khôi phục lịch khám.',
      code: 'STORAGE_WRITE_ERROR'
    });
  }

  return res.json({
    success: true,
    message: 'Đã khôi phục lịch khám vào danh sách chính.',
    data: currentApp
  });
});

// ----------------------------------------------------------------------------
// GET /api/data/doctors (hoặc /api/doctors) - Danh sách bác sĩ hoạt động theo cơ sở
// ----------------------------------------------------------------------------
router.get('/doctors', (req, res) => {
  try {
    const { facilityId } = req.query;
    const users = getUsers();
    let doctors = users.filter(u => 
      u.role === 'vet_doctor' && 
      !u.isLocked && 
      (!u.vetStatus || u.vetStatus === 'approved')
    );

    if (facilityId && facilityId !== 'all') {
      doctors = doctors.filter(doc => {
        const facs = Array.isArray(doc.facilityIds) 
          ? doc.facilityIds 
          : (doc.facilityId ? [doc.facilityId] : []);
        return facs.includes(facilityId);
      });
    }

    const safeDoctors = doctors.map(d => ({
      id: d.id,
      name: d.name.startsWith('BS.') ? d.name : `BS. ${d.name}`,
      email: d.email,
      phone: d.phone || '',
      avatar: d.avatar || '',
      role: d.role,
      facilityId: d.facilityId || null,
      facilityIds: Array.isArray(d.facilityIds) ? d.facilityIds : (d.facilityId ? [d.facilityId] : []),
      address: d.address || ''
    }));

    return res.json({ success: true, data: safeDoctors });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ----------------------------------------------------------------------------
// 2.9. TẢI KHUNG GIỜ KHẢ DỤNG CHO ĐẶT LỊCH KHÁM (AVAILABLE SLOTS)
// Kiểm tra lịch làm việc thực tế của cơ sở, bác sĩ và loại trừ giờ đã đặt hoặc quá khứ
// ----------------------------------------------------------------------------
router.get('/appointments/available-slots', optionalAuthenticateToken, (req, res) => {
  const { facility, facilityId, doctor, doctorId, date, petId } = req.query;

  if (!date || !isValidCalendarDate(date)) {
    return res.status(400).json({
      success: false,
      error: 'Ngày kiểm tra không hợp lệ hoặc không đúng định dạng YYYY-MM-DD.',
      code: 'INVALID_DATE'
    });
  }

  // Tìm cơ sở tương ứng
  const targetFac = VET_FACILITIES.find(f => 
    f.id === facilityId || 
    f.id === facility || 
    f.name === facility || 
    (facility && f.name.toLowerCase().includes(String(facility).toLowerCase()))
  ) || VET_FACILITIES[0];

  const dateObj = new Date(date + 'T00:00:00+07:00');
  const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 1 = Monday...

  // 1. Kiểm tra cơ sở có lịch làm việc vào ngày này hay không
  if (!targetFac.workingDays || !targetFac.workingDays.includes(dayOfWeek)) {
    return res.json({
      success: true,
      hasWorkSchedule: false,
      facilityName: targetFac.name,
      message: `Cơ sở ${targetFac.name} không có lịch làm việc vào ngày này (nghỉ ca trực). Vui lòng chọn ngày khác.`,
      availableSlots: [],
      bookedSlots: [],
      pastSlots: []
    });
  }

  const baseSlots = [...targetFac.workingHours];
  const allAppointments = getCollectionData('appointments', false) || [];
  const targetDateAppts = allAppointments.filter(a => a.date === date && a.status !== 'cancelled');

  const targetDocId = (doctorId && doctorId !== 'auto' && doctorId !== 'null') ? doctorId : null;
  const todayVn = getTodayVnDate();
  const currentVnTime = getCurrentVnTime();

  const bookedSlots = [];
  const pastSlots = [];
  const availableSlots = [];

  for (const slot of baseSlots) {
    // A. Kiểm tra giờ quá khứ nếu là hôm nay
    if (date === todayVn && slot <= currentVnTime) {
      pastSlots.push(slot);
      continue;
    }

    // B. Kiểm tra thú cưng đã có lịch hẹn ở khung giờ này chưa
    if (petId) {
      const petBooked = targetDateAppts.some(a => a.petId === petId && (a.time === slot || a.timeSlot === slot));
      if (petBooked) {
        bookedSlots.push(slot);
        continue;
      }
    }

    // C. Kiểm tra bác sĩ đã kín lịch ở khung giờ này chưa (nếu chọn bác sĩ cụ thể)
    if (targetDocId) {
      const docBooked = targetDateAppts.some(a => 
        (a.assignedVetId === targetDocId || a.vetId === targetDocId) && 
        (a.time === slot || a.timeSlot === slot)
      );
      if (docBooked) {
        bookedSlots.push(slot);
        continue;
      }
    }

    // D. Kiểm tra sức chứa tối đa của cơ sở ở khung giờ
    const facilityApptsAtSlot = targetDateAppts.filter(a => 
      (a.facility === targetFac.name || a.facilityId === targetFac.id) && 
      (a.time === slot || a.timeSlot === slot)
    );
    if (facilityApptsAtSlot.length >= (targetFac.slotCapacity || 2)) {
      bookedSlots.push(slot);
      continue;
    }

    availableSlots.push(slot);
  }

  return res.json({
    success: true,
    hasWorkSchedule: true,
    facilityName: targetFac.name,
    date,
    totalSlots: baseSlots.length,
    availableSlots,
    bookedSlots,
    pastSlots
  });
});

// ----------------------------------------------------------------------------
// 3. GENERIC GET LIST (Phân quyền 3 vai trò, đồng bộ xem bệnh án)
// ----------------------------------------------------------------------------
router.get('/:collection', authenticateToken, (req, res) => {
  const { collection } = req.params;
  if (!getAllowedCollections().includes(collection)) {
    return res.status(404).json({ success: false, error: 'Collection not found' });
  }

  const isObject = COLLECTION_TYPES[collection] === 'object';
  const data = getCollectionData(collection, isObject);
  const user = req.user;

  const normalizeMedRecord = (r) => {
    if (!r || typeof r !== 'object') return r;
    return {
      ...r,
      subjective: r.subjective !== undefined && r.subjective !== '' ? r.subjective : (r.soap?.subjective || ''),
      objective: r.objective !== undefined && r.objective !== '' ? r.objective : (r.soap?.objective || ''),
      assessment: r.assessment !== undefined && r.assessment !== '' ? r.assessment : (r.soap?.assessment || ''),
      plan: r.plan !== undefined && r.plan !== '' ? r.plan : (r.soap?.plan || '')
    };
  };

  if (user.role === 'system_admin') {
    if (collection === 'medical_records' && Array.isArray(data)) {
      return res.json(data.map(normalizeMedRecord));
    }
    return res.json(data); // Admin thấy tất cả
  }

  if (isObject) {
    const allPets = getCollectionData('pets', false);
    const userPets = allPets.filter(p => p.ownerId === user.id);
    let allowedKeys = userPets.map(p => p.id);
    
    if (user.role === 'vet_doctor') {
      const appointments = getCollectionData('appointments', false) || [];
      const assignedPets = allPets.filter(p => isVetAssignedToPet(user.id, p.id, allPets, appointments));
      allowedKeys = [...new Set([...allowedKeys, ...assignedPets.map(p => p.id)])];
    }

    const result = {};
    for (const key of allowedKeys) {
      if (data[key]) result[key] = data[key];
    }
    return res.json(result);
  } else {
    let result = [];
    if (user.role === 'pet_owner') {
      // Người nuôi thấy các bản ghi thuộc quyền sở hữu của mình
      result = data.filter(item => String(item.ownerId).trim() === String(user.id).trim());
      // Bệnh án & Đơn thuốc: Người nuôi chỉ được đọc hồ sơ chuyên môn đã công bố / đã ký chốt (isRecordPublished: isFinal === true && status === 'published')
      if (collection === 'medical_records' || collection === 'prescriptions') {
        result = result.filter(item => isRecordPublished(item));
      }
    } else if (user.role === 'vet_doctor') {
      const allPets = getCollectionData('pets', false);
      const appointments = getCollectionData('appointments', false) || [];
      const assignedPetIds = new Set(
        allPets.filter(p => isVetAssignedToPet(user.id, p.id, allPets, appointments)).map(p => p.id)
      );
      
      if (collection === 'appointments') {
        // Bác sĩ CHỈ thấy các ca khám được phân công trực tiếp cho mình qua assignedVetId hoặc vetId
        result = data.filter(item => 
          String(item.assignedVetId || '').trim() === String(user.id).trim() ||
          String(item.vetId || '').trim() === String(user.id).trim()
        );
      } else if (collection === 'pets') {
        const filteredPets = data.filter(item => assignedPetIds.has(item.id));
        const allUsers = getUsers();
        result = filteredPets.map(pet => {
          const owner = allUsers.find(u => u.id === pet.ownerId);
          return {
            ...pet,
            ownerName: owner ? owner.name : (pet.ownerName || null),
            ownerPhone: owner ? (owner.phone || null) : (pet.ownerPhone || pet.phone || null),
            ownerEmail: owner ? (owner.email || null) : (pet.ownerEmail || null)
          };
        });
      } else if (collection === 'medical_records' || collection === 'prescriptions') {
        // Bác sĩ thấy các ca được phân công hoặc do chính mình tạo
        const myApptIds = new Set(appointments.filter(a => a.assignedVetId === user.id || a.vetId === user.id).map(a => a.id));
        result = data.filter(item => assignedPetIds.has(item.petId) || item.authorId === user.id || item.vetId === user.id || (item.appointmentId && myApptIds.has(item.appointmentId)));
      } else {
        result = data.filter(item => assignedPetIds.has(item.petId));
      }
    }
    if (collection === 'medical_records' && Array.isArray(result)) {
      result = result.map(normalizeMedRecord);
    }

    // Hỗ trợ lọc theo petId qua query parameter: ?petId=... (Kiểm tra quyền sở hữu & phân công)
    if (req.query && req.query.petId) {
      const targetPetId = String(req.query.petId).trim();
      const allPets = getCollectionData('pets', false) || [];
      const targetPet = allPets.find(p => p.id === targetPetId);
      if (!targetPet) {
        return res.status(404).json({ success: false, error: 'Thú cưng không tồn tại trong hệ thống.', code: 'PET_NOT_FOUND' });
      }

      // Backend kiểm tra quyền sở hữu / phân công đối với thú cưng
      if (user.role === 'pet_owner') {
        if (String(targetPet.ownerId).trim() !== String(user.id).trim()) {
          return res.status(403).json({ success: false, error: 'Bạn không có quyền truy cập dữ liệu của thú cưng này.', code: 'FORBIDDEN_PET_ACCESS' });
        }
      } else if (user.role === 'vet_doctor') {
        const appointments = getCollectionData('appointments', false) || [];
        const isAssigned = isVetAssignedToPet(user.id, targetPet.id, allPets, appointments);
        if (!isAssigned) {
          return res.status(403).json({ success: false, error: 'Bác sĩ không được phân công phụ trách thú cưng này.', code: 'FORBIDDEN_VET_NOT_ASSIGNED' });
        }
      }

      result = result.filter(item => String(item.petId || '').trim() === targetPetId);
    }

    return res.json(result);
  }
});

// ----------------------------------------------------------------------------
// 3.1. GENERIC GET BY ID (Kiểm tra quyền đọc theo ID, ẩn đơn nháp đối với chủ nuôi)
// ----------------------------------------------------------------------------
router.get('/:collection/:id', authenticateToken, (req, res) => {
  const { collection, id } = req.params;
  if (!getAllowedCollections().includes(collection)) {
    return res.status(404).json({ success: false, error: 'Collection not found' });
  }

  const isObject = COLLECTION_TYPES[collection] === 'object';
  const data = getCollectionData(collection, isObject);

  const normalizeMedRecord = (r) => {
    if (!r || typeof r !== 'object') return r;
    return {
      ...r,
      subjective: r.subjective !== undefined && r.subjective !== '' ? r.subjective : (r.soap?.subjective || ''),
      objective: r.objective !== undefined && r.objective !== '' ? r.objective : (r.soap?.objective || ''),
      assessment: r.assessment !== undefined && r.assessment !== '' ? r.assessment : (r.soap?.assessment || ''),
      plan: r.plan !== undefined && r.plan !== '' ? r.plan : (r.soap?.plan || '')
    };
  };

  if (isObject) {
    const allPets = getCollectionData('pets', false);
    const pet = allPets.find(p => p.id === id);
    if (!pet && req.user.role !== 'system_admin') {
      return res.status(404).json({ success: false, error: 'Thú cưng không tồn tại.' });
    }
    if (req.user.role === 'pet_owner') {
      if (!pet || pet.ownerId !== req.user.id) {
        return res.status(403).json({ success: false, error: 'Bạn không có quyền truy cập dữ liệu của thú cưng này.' });
      }
    } else if (req.user.role === 'vet_doctor') {
      const appointments = getCollectionData('appointments', false) || [];
      const isAssigned = isVetAssignedToPet(req.user.id, id, allPets, appointments);
      if (!isAssigned) {
        return res.status(403).json({ success: false, error: 'Bác sĩ không được phân công chăm sóc thú cưng này.' });
      }
    }
    return res.json({ success: true, data: data[id] || null });
  } else {
    const item = data.find(it => String(it.id) === String(id));
    if (!item) {
      return res.status(404).json({ success: false, error: 'Bản ghi không tồn tại.' });
    }

    if (req.user.role === 'pet_owner') {
      if (String(item.ownerId) !== String(req.user.id)) {
        return res.status(403).json({ success: false, error: 'Bạn không có quyền truy cập bản ghi này.' });
      }
      if (collection === 'medical_records' || collection === 'prescriptions') {
        if (!isRecordPublished(item)) {
          return res.status(404).json({ success: false, error: 'Bản ghi đang ở trạng thái bản nháp hoặc chưa công bố.' });
        }
      }
    } else if (req.user.role === 'vet_doctor') {
      if (collection === 'appointments') {
        const isMyAppointment = String(item.assignedVetId || '').trim() === String(req.user.id).trim() || String(item.vetId || '').trim() === String(req.user.id).trim();
        if (!isMyAppointment) {
          return res.status(403).json({ success: false, error: 'Bạn không phải là bác sĩ được phân công cho ca khám này.' });
        }
      } else {
        const allPets = getCollectionData('pets', false);
        const appointments = getCollectionData('appointments', false) || [];
        const isAssigned = isVetAssignedToPet(req.user.id, item.petId || item.id, allPets, appointments);
        const isAuthor = item.authorId === req.user.id || item.vetId === req.user.id;
        if (!isAssigned && !isAuthor) {
          return res.status(403).json({ success: false, error: 'Bác sĩ không được phân công phụ trách bản ghi này.' });
        }
      }
    }

    if (collection === 'pets') {
      const allUsers = getUsers();
      const owner = allUsers.find(u => u.id === item.ownerId);
      return res.json({
        success: true,
        data: {
          ...item,
          ownerName: owner ? owner.name : (item.ownerName || null),
          ownerPhone: owner ? (owner.phone || null) : (item.ownerPhone || item.phone || null),
          ownerEmail: owner ? (owner.email || null) : (item.ownerEmail || null)
        }
      });
    }

    if (collection === 'medical_records') {
      return res.json({ success: true, data: normalizeMedRecord(item) });
    }

    return res.json({ success: true, data: item });
  }
});

// ----------------------------------------------------------------------------
// 3.9. TẢI VÀ LƯU ẢNH ĐẠI DIỆN THÚ CƯNG (PET AVATAR UPLOAD)
// Kiểm tra quyền sửa thú cưng, kiểm tra loại tệp (JPG, JPEG, PNG, WebP), dung lượng tối đa 5 MB
// ----------------------------------------------------------------------------
router.post('/pets/upload-avatar', authenticateToken, async (req, res) => {
  try {
    const { fileData, petId } = req.body || {};

    if (!fileData || typeof fileData !== 'string' || !fileData.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Dữ liệu tệp ảnh không được để trống.',
        code: 'MISSING_FILE_DATA'
      });
    }

    // 1. Kiểm tra phân quyền sửa thú cưng nếu truyền petId
    if (petId) {
      const allPets = getCollectionData('pets', false) || [];
      const targetPet = allPets.find(p => p.id === String(petId).trim());
      if (targetPet) {
        if (req.user.role === 'pet_owner') {
          if (String(targetPet.ownerId).trim() !== String(req.user.id).trim()) {
            return res.status(403).json({
              success: false,
              error: 'Bạn không có quyền thay đổi ảnh đại diện của thú cưng này.',
              code: 'FORBIDDEN_NOT_PET_OWNER'
            });
          }
        } else if (req.user.role === 'vet_doctor') {
          const appointments = getCollectionData('appointments', false) || [];
          const isAssigned = isVetAssignedToPet(req.user.id, targetPet.id, allPets, appointments);
          if (!isAssigned) {
            return res.status(403).json({
              success: false,
              error: 'Bác sĩ không được phân công chăm sóc thú cưng này.',
              code: 'FORBIDDEN_NOT_ASSIGNED_VET'
            });
          }
        }
      }
    }

    // 2. Kiểm tra định dạng qua MIME header của Data URL
    // Chấp nhận JPG, JPEG, PNG, WebP
    const dataUrlMatch = /^data:(image\/(jpeg|jpg|png|webp));base64,(.+)$/i.exec(fileData.trim());
    if (!dataUrlMatch) {
      return res.status(400).json({
        success: false,
        error: 'Định dạng tệp không được hỗ trợ. Hệ thống chỉ chấp nhận ảnh JPG, JPEG, PNG hoặc WebP.',
        code: 'INVALID_FILE_TYPE'
      });
    }

    const mimeType = dataUrlMatch[1].toLowerCase();
    const base64Data = dataUrlMatch[3];
    const buffer = Buffer.from(base64Data, 'base64');

    // 3. Kiểm tra dung lượng tệp (Tối đa 5 MB = 5 * 1024 * 1024 bytes)
    const MAX_SIZE_BYTES = 5 * 1024 * 1024;
    if (buffer.length > MAX_SIZE_BYTES) {
      const sizeMb = (buffer.length / (1024 * 1024)).toFixed(2);
      return res.status(400).json({
        success: false,
        error: `Dung lượng tệp ảnh (${sizeMb} MB) vượt quá giới hạn tối đa cho phép là 5 MB.`,
        code: 'FILE_TOO_LARGE'
      });
    }

    if (buffer.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nội dung tệp ảnh rỗng.',
        code: 'EMPTY_FILE'
      });
    }

    // 4. Kiểm tra chữ ký Magic Bytes của ảnh thực tế
    let ext = '.jpg';
    if (mimeType.includes('png')) {
      // PNG magic bytes: 89 50 4E 47
      if (buffer.length < 8 || buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4E || buffer[3] !== 0x47) {
        return res.status(400).json({
          success: false,
          error: 'Tệp không phải là ảnh PNG hợp lệ.',
          code: 'INVALID_PNG_DATA'
        });
      }
      ext = '.png';
    } else if (mimeType.includes('webp')) {
      // WebP magic bytes: RIFF....WEBP
      if (buffer.length < 12 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') {
        return res.status(400).json({
          success: false,
          error: 'Tệp không phải là ảnh WebP hợp lệ.',
          code: 'INVALID_WEBP_DATA'
        });
      }
      ext = '.webp';
    } else {
      // JPEG magic bytes: FF D8 FF
      if (buffer.length < 3 || buffer[0] !== 0xFF || buffer[1] !== 0xD8 || buffer[2] !== 0xFF) {
        return res.status(400).json({
          success: false,
          error: 'Tệp không phải là ảnh JPG/JPEG hợp lệ.',
          code: 'INVALID_JPEG_DATA'
        });
      }
      ext = '.jpg';
    }

    // 5. Lưu tệp thật vào thư mục uploads/avatars trên backend
    const uploadsDir = path.join(process.cwd(), 'server', 'uploads', 'avatars');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const safePetPrefix = petId ? String(petId).replace(/[^a-zA-Z0-9_-]/g, '') : 'pet';
    const randomSuffix = crypto.randomBytes(6).toString('hex');
    const savedFileName = `${safePetPrefix}-${Date.now()}-${randomSuffix}${ext}`;
    const targetFilePath = path.join(uploadsDir, savedFileName);

    fs.writeFileSync(targetFilePath, buffer);

    const publicUrl = `/api/uploads/avatars/${savedFileName}`;

    return res.json({
      success: true,
      message: 'Tải ảnh đại diện thành công.',
      url: publicUrl,
      data: {
        url: publicUrl,
        fileName: savedFileName,
        size: buffer.length,
        mimeType
      }
    });
  } catch (err) {
    console.error('Lỗi khi tải ảnh đại diện thú cưng:', err);
    return res.status(500).json({
      success: false,
      error: 'Lỗi máy chủ khi xử lý tệp ảnh.',
      code: 'SERVER_ERROR'
    });
  }
});

// ----------------------------------------------------------------------------
// 3.10. TẢI VÀ LƯU ẢNH GIẤY TỜ Y TẾ / SỔ TIÊM (MEDICAL DOCUMENT UPLOAD)
// Kiểm tra quyền sở hữu thú cưng, định dạng JPG/PNG/WebP, dung lượng tối đa 5 MB
// ----------------------------------------------------------------------------
router.post('/medical/upload-document', authenticateToken, async (req, res) => {
  try {
    const { fileData, petId } = req.body || {};

    if (!fileData || typeof fileData !== 'string' || !fileData.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Dữ liệu tệp ảnh tài liệu không được để trống.',
        code: 'MISSING_FILE_DATA'
      });
    }

    if (petId) {
      const allPets = getCollectionData('pets', false) || [];
      const targetPet = allPets.find(p => p.id === String(petId).trim());
      if (targetPet && req.user.role === 'pet_owner') {
        if (String(targetPet.ownerId).trim() !== String(req.user.id).trim()) {
          return res.status(403).json({
            success: false,
            error: 'Bạn không có quyền tải tài liệu y tế cho thú cưng này.',
            code: 'FORBIDDEN_NOT_PET_OWNER'
          });
        }
      }
    }

    const dataUrlMatch = /^data:(image\/(jpeg|jpg|png|webp));base64,(.+)$/i.exec(fileData.trim());
    if (!dataUrlMatch) {
      return res.status(400).json({
        success: false,
        error: 'Định dạng tệp không được hỗ trợ. Hệ thống chỉ chấp nhận ảnh JPG, JPEG, PNG hoặc WebP.',
        code: 'INVALID_FILE_TYPE'
      });
    }

    const mimeType = dataUrlMatch[1].toLowerCase();
    const base64Data = dataUrlMatch[3];
    const buffer = Buffer.from(base64Data, 'base64');

    const MAX_SIZE_BYTES = 5 * 1024 * 1024;
    if (buffer.length > MAX_SIZE_BYTES) {
      const sizeMb = (buffer.length / (1024 * 1024)).toFixed(2);
      return res.status(400).json({
        success: false,
        error: `Dung lượng tệp tài liệu (${sizeMb} MB) vượt quá giới hạn tối đa cho phép là 5 MB.`,
        code: 'FILE_TOO_LARGE'
      });
    }

    if (buffer.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nội dung tệp tài liệu rỗng.',
        code: 'EMPTY_FILE'
      });
    }

    let ext = '.jpg';
    if (mimeType.includes('png')) {
      if (buffer.length < 8 || buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4E || buffer[3] !== 0x47) {
        return res.status(400).json({ success: false, error: 'Tệp không phải là ảnh PNG hợp lệ.', code: 'INVALID_PNG_DATA' });
      }
      ext = '.png';
    } else if (mimeType.includes('webp')) {
      if (buffer.length < 12 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') {
        return res.status(400).json({ success: false, error: 'Tệp không phải là ảnh WebP hợp lệ.', code: 'INVALID_WEBP_DATA' });
      }
      ext = '.webp';
    } else {
      if (buffer.length < 3 || buffer[0] !== 0xFF || buffer[1] !== 0xD8 || buffer[2] !== 0xFF) {
        return res.status(400).json({ success: false, error: 'Tệp không phải là ảnh JPG/JPEG hợp lệ.', code: 'INVALID_JPEG_DATA' });
      }
      ext = '.jpg';
    }

    const uploadsDir = path.join(process.cwd(), 'server', 'uploads', 'medical_docs');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const safePetPrefix = petId ? String(petId).replace(/[^a-zA-Z0-9_-]/g, '') : 'pet';
    const randomSuffix = crypto.randomBytes(6).toString('hex');
    const savedFileName = `doc-${safePetPrefix}-${Date.now()}-${randomSuffix}${ext}`;
    const targetFilePath = path.join(uploadsDir, savedFileName);

    fs.writeFileSync(targetFilePath, buffer);

    const publicUrl = `/api/uploads/medical_docs/${savedFileName}`;

    return res.json({
      success: true,
      message: 'Tải tài liệu y tế thành công.',
      url: publicUrl,
      data: {
        url: publicUrl,
        fileName: savedFileName,
        size: buffer.length,
        mimeType
      }
    });
  } catch (err) {
    console.error('Lỗi khi tải tài liệu y tế:', err);
    return res.status(500).json({
      success: false,
      error: 'Lỗi máy chủ khi xử lý tệp tài liệu.',
      code: 'SERVER_ERROR'
    });
  }
});

// ----------------------------------------------------------------------------
// 4. GENERIC POST CREATE (Chặn trường đặc quyền, liên kết đúng chủ thú cưng)
// ----------------------------------------------------------------------------
router.post('/:collection', authenticateToken, (req, res) => {
  const { collection } = req.params;
  if (!getAllowedCollections().includes(collection)) {
    return res.status(404).json({ success: false, error: 'Collection not found' });
  }

  const isObject = COLLECTION_TYPES[collection] === 'object';
  if (isObject) {
    return res.status(400).json({ success: false, error: 'Use PUT for object collections' });
  }

  // Chặn người nuôi tự tạo bệnh án hoặc đơn thuốc bác sĩ
  if (req.user.role === 'pet_owner' && (collection === 'medical_records' || collection === 'prescriptions')) {
    return res.status(403).json({
      success: false,
      error: 'Chỉ Bác sĩ thú y hoặc Quản trị viên mới có quyền tạo bệnh án hoặc đơn thuốc.'
    });
  }

  const data = getCollectionData(collection, false);

  // Chặn ID trùng (409 Conflict)
  if (req.body.id) {
    const existingIds = new Set(data.map(item => String(item.id)));
    if (existingIds.has(String(req.body.id))) {
      return res.status(409).json({
        success: false,
        error: `Bản ghi với ID '${req.body.id}' đã tồn tại trong hệ thống.`,
        code: 'DUPLICATE_ID'
      });
    }
  }

  // 1. Validation Schema theo từng collection khi tạo mới (POST)
  if (collection === 'expenses') {
    // Tên khoản chi: bắt buộc, không rỗng hoặc chỉ chứa khoảng trắng
    if (!req.body.title || typeof req.body.title !== 'string' || !req.body.title.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Tên khoản chi tiêu là bắt buộc và không được để trống.',
        code: 'MISSING_TITLE'
      });
    }
    req.body.title = req.body.title.trim();

    // Số tiền VND: Số nguyên hữu hạn lớn hơn 0, trong safe integer
    const amt = Number(req.body.amount);
    if (
      typeof req.body.amount === 'boolean' ||
      req.body.amount === null ||
      req.body.amount === undefined ||
      isNaN(amt) ||
      !Number.isFinite(amt) ||
      !Number.isInteger(amt) ||
      amt <= 0 ||
      amt > Number.MAX_SAFE_INTEGER
    ) {
      return res.status(400).json({
        success: false,
        error: 'Số tiền chi tiêu phải là một số nguyên dương hợp lệ lớn hơn 0 (VND, không nhận số âm, 0, số thập phân hoặc chữ).',
        code: 'INVALID_AMOUNT'
      });
    }
    req.body.amount = amt;

    // Ngày chi thực tế: Bắt buộc, thực sự tồn tại và không nằm trong tương lai theo Asia/Ho_Chi_Minh
    if (!isValidCalendarDate(req.body.date)) {
      return res.status(400).json({
        success: false,
        error: 'Ngày chi tiêu không hợp lệ hoặc không tồn tại trên lịch thực tế (định dạng YYYY-MM-DD).',
        code: 'INVALID_DATE'
      });
    }
    const todayVn = getTodayVnDate();
    if (req.body.date > todayVn) {
      return res.status(400).json({
        success: false,
        error: `Ngày chi tiêu (${req.body.date}) không được nằm trong tương lai so với ngày hiện tại (${todayVn}) theo giờ Việt Nam.`,
        code: 'FUTURE_EXPENSE_DATE'
      });
    }

    // Danh mục chi tiêu
    const validCategories = ['food', 'medical', 'grooming', 'supplies', 'other'];
    if (!req.body.category || !validCategories.includes(req.body.category)) {
      req.body.category = 'other';
    }

    // Xử lý thú cưng: Dùng chung hoặc thú cưng thuộc quyền
    if (!req.body.petId || req.body.petId === 'all' || req.body.petId === 'shared' || req.body.petId === 'none') {
      req.body.petId = 'shared';
      req.body.petName = 'Dùng chung';
    } else {
      const allPets = getCollectionData('pets', false) || [];
      const targetPet = allPets.find(p => p.id === req.body.petId);
      if (!targetPet) {
        return res.status(400).json({
          success: false,
          error: 'Thú cưng được chỉ định không tồn tại trong hệ thống.',
          code: 'INVALID_PET_ID'
        });
      }
      if (req.user.role === 'pet_owner' && String(targetPet.ownerId).trim() !== String(req.user.id).trim()) {
        return res.status(403).json({
          success: false,
          error: 'Bạn không có quyền thêm khoản chi cho thú cưng của người khác.',
          code: 'FORBIDDEN_PET_OWNERSHIP'
        });
      }
      req.body.petName = targetPet.name;
    }

    // Chống bấm lặp tạo khoản chi trùng (ngăn chặn double-click submit)
    const existingExpenses = getCollectionData('expenses', false) || [];
    const isDuplicate = existingExpenses.some(e => 
      String(e.ownerId).trim() === String(req.user.id).trim() &&
      String(e.petId).trim() === String(req.body.petId).trim() &&
      String(e.title).trim() === req.body.title &&
      Number(e.amount) === req.body.amount &&
      String(e.date).trim() === req.body.date &&
      e.createdAt && (Date.now() - new Date(e.createdAt).getTime() < 10000)
    );
    if (isDuplicate) {
      return res.status(409).json({
        success: false,
        error: 'Khoản chi tiêu này vừa được ghi nhận cách đây vài giây. Vui lòng không bấm gửi trùng lặp.',
        code: 'DUPLICATE_EXPENSE'
      });
    }
  }

  if (collection === 'budgets') {
    // Tháng ngân sách: bắt buộc định dạng YYYY-MM
    if (!req.body.month || typeof req.body.month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(req.body.month.trim())) {
      return res.status(400).json({
        success: false,
        error: 'Tháng áp dụng ngân sách không hợp lệ (yêu cầu định dạng YYYY-MM, ví dụ: 2026-10).',
        code: 'INVALID_BUDGET_MONTH'
      });
    }
    req.body.month = req.body.month.trim();

    // Số tiền ngân sách: số nguyên dương > 0 VND
    const amt = Number(req.body.amount);
    if (
      typeof req.body.amount === 'boolean' ||
      req.body.amount === null ||
      req.body.amount === undefined ||
      isNaN(amt) ||
      !Number.isFinite(amt) ||
      !Number.isInteger(amt) ||
      amt <= 0 ||
      amt > Number.MAX_SAFE_INTEGER
    ) {
      return res.status(400).json({
        success: false,
        error: 'Số tiền ngân sách phải là một số nguyên dương hợp lệ lớn hơn 0 VND.',
        code: 'INVALID_BUDGET_AMOUNT'
      });
    }
    req.body.amount = amt;

    // Phạm vi: 'all', 'shared', hoặc petId cụ thể thuộc quyền
    if (!req.body.scope || req.body.scope === 'all') {
      req.body.scope = 'all';
    } else if (req.body.scope === 'shared') {
      req.body.scope = 'shared';
    } else {
      const allPets = getCollectionData('pets', false) || [];
      const targetPet = allPets.find(p => p.id === req.body.scope);
      if (!targetPet) {
        return res.status(400).json({
          success: false,
          error: 'Thú cưng liên kết với ngân sách không tồn tại.',
          code: 'INVALID_PET_ID'
        });
      }
      if (req.user.role === 'pet_owner' && String(targetPet.ownerId).trim() !== String(req.user.id).trim()) {
        return res.status(403).json({
          success: false,
          error: 'Bạn không có quyền thiết lập ngân sách cho thú cưng của người khác.',
          code: 'FORBIDDEN_PET_OWNERSHIP'
        });
      }
    }

    // Một phạm vi trong một tháng chỉ có một ngân sách: nếu đã tồn tại thì cập nhật
    const existingBudgets = getCollectionData('budgets', false) || [];
    const collisionIndex = existingBudgets.findIndex(b => 
      String(b.ownerId).trim() === String(req.user.id).trim() &&
      String(b.month).trim() === req.body.month &&
      String(b.scope || 'all').trim() === req.body.scope
    );
    if (collisionIndex !== -1) {
      existingBudgets[collisionIndex] = {
        ...existingBudgets[collisionIndex],
        amount: req.body.amount,
        updatedAt: new Date().toISOString()
      };
      saveCollectionData('budgets', existingBudgets);
      return res.json({ 
        success: true, 
        data: existingBudgets[collisionIndex], 
        message: 'Đã cập nhật ngân sách cho phạm vi và tháng này.' 
      });
    }
  }

  if (collection === 'schedules') {
    if (!req.body.petId || typeof req.body.petId !== 'string' || !req.body.petId.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Lịch chăm sóc / hồ sơ y tế phải liên kết với một thú cưng (petId bắt buộc).',
        code: 'MISSING_PET_ID'
      });
    }

    const allPetsList = getCollectionData('pets', false) || [];
    const targetPet = allPetsList.find(p => p.id === String(req.body.petId).trim());
    if (!targetPet) {
      return res.status(404).json({
        success: false,
        error: 'Thú cưng được chỉ định không tồn tại trong hệ thống.',
        code: 'PET_NOT_FOUND'
      });
    }

    if (req.user.role === 'pet_owner') {
      if (String(targetPet.ownerId).trim() !== String(req.user.id).trim()) {
        return res.status(403).json({
          success: false,
          error: 'Bạn không có quyền thêm bản ghi cho thú cưng của người khác.',
          code: 'FORBIDDEN_PET_OWNERSHIP'
        });
      }
      req.body.ownerId = req.user.id;
      // Chủ nuôi tự khai báo: Không cho phép tự gắn nhãn Bác sĩ xác nhận
      req.body.isVerified = false;
      req.body.source = 'owner_declared';
      delete req.body.verifiedBy;
      delete req.body.verifiedAt;
      delete req.body.doctorLicense;
    } else if (req.user.role === 'vet_doctor') {
      const appointments = getCollectionData('appointments', false) || [];
      const isAssigned = isVetAssignedToPet(req.user.id, targetPet.id, allPetsList, appointments);
      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          error: 'Bác sĩ không được phân công phụ trách thú cưng này.',
          code: 'FORBIDDEN_VET_NOT_ASSIGNED'
        });
      }
      req.body.ownerId = targetPet.ownerId;
      req.body.authorId = req.user.id;
      req.body.authorName = req.user.name;
      if (req.body.appointmentId) {
        const sourceApp = appointments.find(a => a.id === String(req.body.appointmentId).trim());
        if (sourceApp) {
          req.body.appointmentId = sourceApp.id;
        }
      }
      if (req.body.isVerified !== false) {
        req.body.isVerified = true;
        req.body.source = 'vet_verified';
        req.body.verifiedBy = req.user.name;
        req.body.verifiedAt = new Date().toISOString();
      }
    }

    const VALID_SCHEDULE_TYPES = [
      'vaccine',
      'deworm',
      'parasite',
      'grooming',
      'vet',
      'medicine',
      'feeding',
      'exercise',
      'other'
    ];

    if (!req.body.type || typeof req.body.type !== 'string' || !VALID_SCHEDULE_TYPES.includes(req.body.type.trim())) {
      return res.status(400).json({
        success: false,
        error: 'Loại sự kiện (type) là bắt buộc và phải thuộc danh mục hợp lệ: vaccine, deworm, parasite, grooming, vet, medicine, feeding, exercise, other.',
        code: 'INVALID_SCHEDULE_TYPE'
      });
    }
    req.body.type = req.body.type.trim();

    const title = req.body.title || req.body.task || req.body.activity || req.body.vaccineName || req.body.medicationName;
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Tên vaccine hoặc thuốc/chế phẩm chăm sóc không được để trống.',
        code: 'MISSING_TITLE'
      });
    }
    req.body.title = title.trim();

    if (!isValidCalendarDate(req.body.date)) {
      return res.status(400).json({
        success: false,
        error: 'Ngày ghi nhận không hợp lệ hoặc không tồn tại trên lịch thực tế (định dạng YYYY-MM-DD).',
        code: 'INVALID_DATE'
      });
    }

    const todayVn = getTodayVnDate();
    const isMedicalRecord = req.body.type === 'vaccine' || req.body.type === 'parasite' || req.body.type === 'deworm';

    // Ngày tiêm / sử dụng thực tế không được nằm trong tương lai (Mục 3, Mục 4)
    if (isMedicalRecord && !req.body.isPlanned && req.body.completed !== false) {
      if (req.body.date > todayVn) {
        return res.status(400).json({
          success: false,
          error: `Ngày thực hiện (${req.body.date}) không được thuộc tương lai (vượt quá hôm nay ${todayVn}). Ngày dự kiến vui lòng tạo dưới dạng lịch hẹn riêng.`,
          code: 'FUTURE_ADMINISTRATION_DATE'
        });
      }
    }

    // Ngày nhắc tiếp theo nếu nhập phải sau ngày thực tế (Mục 3, Mục 4)
    if (req.body.nextDueDate && String(req.body.nextDueDate).trim()) {
      const nextDueStr = String(req.body.nextDueDate).trim();
      if (!isValidCalendarDate(nextDueStr)) {
        return res.status(400).json({
          success: false,
          error: 'Ngày nhắc tiếp theo không hợp lệ (định dạng YYYY-MM-DD).',
          code: 'INVALID_NEXT_DUE_DATE'
        });
      }
      if (nextDueStr <= req.body.date) {
        return res.status(400).json({
          success: false,
          error: `Ngày nhắc tiếp theo (${nextDueStr}) phải sau ngày thực hiện (${req.body.date}).`,
          code: 'INVALID_NEXT_DUE_DATE_ORDER'
        });
      }
      req.body.nextDueDate = nextDueStr;
    }

    // Liều và đơn vị nếu có (Mục 4, Mục 9)
    if (req.body.dosage !== undefined && req.body.dosage !== null && String(req.body.dosage).trim() !== '') {
      if (!isValidPositiveNumber(req.body.dosage)) {
        return res.status(400).json({
          success: false,
          error: 'Liều lượng phải là một số dương lớn hơn 0 (không nhận số âm, 0 hoặc NaN).',
          code: 'INVALID_DOSAGE_VALUE'
        });
      }
      req.body.dosage = Number(req.body.dosage);
      if (!req.body.dosageUnit || typeof req.body.dosageUnit !== 'string' || !req.body.dosageUnit.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Vui lòng cung cấp đơn vị cho liều lượng (ví dụ: viên, ml, tuýp, mg).',
          code: 'MISSING_DOSAGE_UNIT'
        });
      }
      req.body.dosageUnit = req.body.dosageUnit.trim();
    }
  }

  if (collection === 'daily_logs') {
    if (!req.body.petId || typeof req.body.petId !== 'string' || !req.body.petId.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Bản ghi nhật ký phải liên kết với một thú cưng (petId bắt buộc).',
        code: 'MISSING_PET_ID'
      });
    }
    if (!isValidCalendarDate(req.body.date)) {
      return res.status(400).json({
        success: false,
        error: 'Ngày ghi nhận không hợp lệ hoặc không tồn tại trên lịch thực tế (định dạng YYYY-MM-DD).',
        code: 'INVALID_DATE'
      });
    }

    const logType = req.body.type || 'observation';

    if (logType === 'activity') {
      const title = req.body.title || req.body.name;
      if (!title || typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Tên hoạt động gắn kết không được để trống.',
          code: 'MISSING_ACTIVITY_TITLE'
        });
      }
      req.body.title = title.trim();

      if (req.body.estimatedDuration !== undefined && req.body.estimatedDuration !== null && req.body.estimatedDuration !== '') {
        if (!isValidPositiveNumber(req.body.estimatedDuration)) {
          return res.status(400).json({
            success: false,
            error: 'Thời lượng dự kiến phải là một số hữu hạn dương lớn hơn 0 phút.',
            code: 'INVALID_DURATION'
          });
        }
        req.body.estimatedDuration = Number(req.body.estimatedDuration);
      } else {
        req.body.estimatedDuration = null;
      }

      if (req.body.actualDuration !== undefined && req.body.actualDuration !== null && req.body.actualDuration !== '') {
        if (!isValidPositiveNumber(req.body.actualDuration)) {
          return res.status(400).json({
            success: false,
            error: 'Thời lượng thực tế phải là một số hữu hạn dương lớn hơn 0 phút.',
            code: 'INVALID_ACTUAL_DURATION'
          });
        }
        req.body.actualDuration = Number(req.body.actualDuration);
      } else {
        req.body.actualDuration = null;
      }

      if (req.body.time && !isValidTimeFormat(req.body.time)) {
        return res.status(400).json({
          success: false,
          error: 'Giờ thực hiện hoạt động không đúng định dạng HH:MM (00:00 - 23:59).',
          code: 'INVALID_TIME'
        });
      }

      const validStatuses = ['pending', 'completed', 'cancelled'];
      if (req.body.status && !validStatuses.includes(req.body.status)) {
        return res.status(400).json({
          success: false,
          error: 'Trạng thái hoạt động không hợp lệ.',
          code: 'INVALID_STATUS'
        });
      }
      req.body.status = req.body.status || 'pending';
    }

    if (logType === 'behavior') {
      const behavior = req.body.behavior;
      if (!behavior || typeof behavior !== 'string' || !behavior.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Biểu hiện hành vi không được để trống.',
          code: 'MISSING_BEHAVIOR'
        });
      }
      req.body.behavior = behavior.trim();

      const timeStr = req.body.time;
      if (timeStr && !isValidTimeFormat(timeStr)) {
        return res.status(400).json({
          success: false,
          error: 'Giờ quan sát không đúng định dạng HH:MM.',
          code: 'INVALID_TIME'
        });
      }

      const todayVn = getTodayVnDate();
      if (req.body.date > todayVn) {
        return res.status(400).json({
          success: false,
          error: 'Thời điểm quan sát không được ở tương lai so với ngày hiện tại tại Việt Nam.',
          code: 'FUTURE_OBSERVATION_TIME'
        });
      }
      if (req.body.date === todayVn && timeStr) {
        const currentVnTime = getCurrentVnTime();
        if (timeStr > currentVnTime) {
          return res.status(400).json({
            success: false,
            error: `Giờ quan sát (${timeStr}) không được ở tương lai so với giờ hiện tại (${currentVnTime}) tại Việt Nam.`,
            code: 'FUTURE_OBSERVATION_TIME'
          });
        }
      }
    }

    if (logType === 'observation') {
      const todayVn = getTodayVnDate();
      if (req.body.date > todayVn) {
        return res.status(400).json({
          success: false,
          error: 'Ngày quan sát không được ở tương lai so với ngày hiện tại tại Việt Nam.',
          code: 'FUTURE_OBSERVATION_DATE'
        });
      }
    }
  }

  // Chặn người nuôi tự gửi các trường đặc quyền
  if (req.user.role === 'pet_owner') {
    delete req.body.isFinal;
    delete req.body.confirmedBy;
    if (collection === 'appointments') {
      req.body.status = 'pending'; // Người nuôi tạo lịch luôn ở pending
    }
  }

  if (collection === 'appointments') {
    if (!req.body.petId || typeof req.body.petId !== 'string' || !req.body.petId.trim()) {
      return res.status(400).json({ success: false, error: 'Lịch hẹn phải chỉ định thú cưng (petId bắt buộc).' });
    }
    const phoneCheck = validateVietnamesePhoneNumber(req.body.phone);
    if (!phoneCheck.isValid) {
      return res.status(400).json({
        success: false,
        error: phoneCheck.error,
        code: phoneCheck.code
      });
    }
    req.body.phone = phoneCheck.normalized;
    if (!isValidCalendarDate(req.body.date)) {
      return res.status(400).json({ success: false, error: 'Ngày hẹn không hợp lệ hoặc không tồn tại trên lịch thực tế (định dạng YYYY-MM-DD).' });
    }
    const appTime = req.body.time || req.body.timeSlot;
    if (!isValidTimeFormat(appTime)) {
      return res.status(400).json({ success: false, error: 'Giờ hẹn không đúng định dạng HH:MM hoặc vượt quá phạm vi giờ hợp lệ (00:00 - 23:59).' });
    }

    // Chặn thời điểm quá khứ theo Asia/Ho_Chi_Minh
    const todayVn = getTodayVnDate();
    if (req.body.date < todayVn) {
      return res.status(400).json({
        success: false,
        error: `Ngày hẹn khám (${req.body.date}) không được ở quá khứ so với ngày hiện tại (${todayVn}) theo giờ Việt Nam.`,
        code: 'PAST_APPOINTMENT_DATE'
      });
    }
    if (req.body.date === todayVn) {
      const currentVnTime = getCurrentVnTime();
      if (appTime <= currentVnTime) {
        return res.status(400).json({
          success: false,
          error: `Khung giờ hẹn (${appTime}) đã trôi qua so với giờ hiện tại (${currentVnTime}) tại Việt Nam. Vui lòng chọn khung giờ tương lai.`,
          code: 'PAST_APPOINTMENT_TIME'
        });
      }
    }

    // Kiểm tra tính hợp lệ của bác sĩ được phân công nếu có chỉ định
    if (req.body.assignedVetId && req.body.assignedVetId !== 'auto') {
      const allUsers = getUsers();
      const vet = allUsers.find(u => u.id === req.body.assignedVetId);
      if (!vet || vet.role !== 'vet_doctor' || vet.isLocked || (vet.vetStatus && vet.vetStatus !== 'approved')) {
        return res.status(400).json({
          success: false,
          error: 'Bác sĩ được chọn không tồn tại, đã bị khóa hoặc chưa được phê duyệt chứng chỉ hành nghề.',
          code: 'INVALID_ASSIGNED_VET'
        });
      }

      // Kiểm tra bác sĩ có thuộc cơ sở đã chọn hay không
      const targetFacilityId = req.body.facilityId || req.body.clinicId || '2vet';
      const vetFacilities = Array.isArray(vet.facilityIds) 
        ? vet.facilityIds 
        : (vet.facilityId ? [vet.facilityId] : []);
      
      if (!targetFacilityId || !vetFacilities.includes(targetFacilityId)) {
        return res.status(400).json({
          success: false,
          error: `Bác sĩ ${vet.name} không thuộc cơ sở ${req.body.facility || targetFacilityId || 'đã chọn'}. Vui lòng chọn cơ sở mà bác sĩ đang công tác hoặc chọn "Cơ sở phân công".`,
          code: 'VET_NOT_IN_FACILITY'
        });
      }

      req.body.assignedVetId = vet.id;
      req.body.assignedVet = vet.name.startsWith('BS.') ? vet.name : `BS. ${vet.name}`;
    } else {
      req.body.assignedVetId = null;
      req.body.assignedVet = 'Cơ sở phân công';
    }

    // Kiểm tra họ tên chủ nuôi
    if (!req.body.ownerName || typeof req.body.ownerName !== 'string' || !req.body.ownerName.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Họ tên chủ nuôi là bắt buộc.',
        code: 'MISSING_OWNER_NAME'
      });
    }
    req.body.ownerName = req.body.ownerName.trim();

    // Kiểm tra dịch vụ
    if (!req.body.service || typeof req.body.service !== 'string' || !req.body.service.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng chọn dịch vụ khám từ danh mục hệ thống.',
        code: 'MISSING_SERVICE'
      });
    }
    req.body.service = req.body.service.trim();

    // Kiểm tra cơ sở tiếp nhận và chuẩn hóa mã cơ sở duy nhất 2Vet
    const requestedFacId = req.body.facilityId || req.body.clinicId;
    const activeFac = VET_FACILITIES.find(f => f.id === requestedFacId || f.name === req.body.facility) || VET_FACILITIES[0];
    if (requestedFacId && requestedFacId !== activeFac.id) {
      return res.status(400).json({
        success: false,
        error: `Cơ sở "${requestedFacId}" không tồn tại hoặc đã ngừng hoạt động. Hệ thống PetCare hiện chỉ tiếp nhận tại ${activeFac.name}.`,
        code: 'INVALID_FACILITY'
      });
    }
    req.body.facility = activeFac.name;
    req.body.facilityId = activeFac.id;
    req.body.clinicId = activeFac.id;
  }

  if (collection === 'pets') {
    const todayVn = getTodayVnDate();
    if (req.body.birthDate && typeof req.body.birthDate === 'string' && req.body.birthDate.trim()) {
      const bDate = req.body.birthDate.trim();
      if (isValidCalendarDate(bDate) && bDate > todayVn) {
        return res.status(400).json({
          success: false,
          error: `Ngày sinh của thú cưng (${bDate}) không được vượt quá ngày hiện tại (${todayVn}) theo giờ Việt Nam.`,
          code: 'FUTURE_BIRTH_DATE'
        });
      }
    }

    if (req.body.weightHistory !== undefined && req.body.weightHistory !== null) {
      const vResult = validatePetWeightHistory(req.body.weightHistory, todayVn);
      if (!vResult.valid) {
        return res.status(400).json({
          success: false,
          error: vResult.error,
          code: vResult.code
        });
      }
      req.body.weightHistory = vResult.sanitized;
      // Cân nặng hiện tại phải lấy từ bản ghi hợp lệ mới nhất theo ngày ghi nhận
      if (vResult.sanitized.length > 0) {
        req.body.weight = vResult.sanitized[vResult.sanitized.length - 1].weight;
      }
    }

    if (req.body.weight !== undefined && req.body.weight !== null && req.body.weight !== '') {
      if (!isValidPositiveNumber(req.body.weight)) {
        return res.status(400).json({
          success: false,
          error: 'Cân nặng thú cưng phải là một số hữu hạn dương lớn hơn 0 (không nhận số âm, NaN hoặc sai kiểu).',
          code: 'INVALID_WEIGHT'
        });
      }
    }
  }

  const allPets = getCollectionData('pets', false);

  const newItem = {
    ...req.body,
    id: req.body.id || `${collection.slice(0,3)}-${Date.now()}`,
    ownerId: req.user.role === 'system_admin' ? (req.body.ownerId || req.user.id) : req.user.id,
    createdAt: new Date().toISOString()
  };

  // Nếu là lịch chăm sóc / tiêm chủng: đảm bảo gán đúng ownerId theo thú cưng và bảo đảm quyền xác minh
  if (collection === 'schedules') {
    const pet = allPets.find(p => p.id === newItem.petId);
    if (pet) {
      newItem.ownerId = pet.ownerId;
    }
    if (req.user.role === 'pet_owner') {
      newItem.isVerified = false;
      newItem.source = 'owner_declared';
      delete newItem.verifiedBy;
      delete newItem.verifiedAt;
      delete newItem.doctorLicense;
    }
  }

  // Nếu là bệnh án hoặc đơn thuốc do bác sĩ tạo: gán đúng ownerId của chủ thú cưng để chủ xem được
  if (collection === 'medical_records' || collection === 'prescriptions') {
    const pet = allPets.find(p => p.id === newItem.petId);
    if (pet) {
      newItem.ownerId = pet.ownerId; // Gán đúng chủ sở hữu thú cưng
      newItem.authorId = req.user.id;
      newItem.authorName = req.user.name;
    }
    // Không cho tạo đơn mới thiếu cờ để vượt bộ lọc đơn nháp; Generic POST cho prescriptions luôn ở trạng thái nháp (chỉ endpoint finalize mới ký chốt)
    if (collection === 'prescriptions') {
      if (req.user.role !== 'system_admin') {
        newItem.isFinal = false;
        newItem.status = 'draft';
      }
    } else if (collection === 'medical_records') {
      if (req.body.isFinal === true && (req.user.role === 'vet_doctor' || req.user.role === 'system_admin')) {
        newItem.isFinal = true;
        newItem.status = 'published';
      } else {
        newItem.isFinal = false;
        newItem.status = 'draft';
      }
    }
    // Kiểm tra phân công ca khám: Nếu ca đã giao bác sĩ A, bác sĩ B không được tạo bệnh án/đơn thuốc cho ca này
    const apptId = newItem.appointmentId || req.body.appointmentId;
    if (apptId && req.user.role === 'vet_doctor') {
      const allAppts = getCollectionData('appointments', false) || [];
      const targetAppt = allAppts.find(a => a.id === apptId);
      if (targetAppt) {
        const apptVetId = targetAppt.assignedVetId || targetAppt.vetId;
        if (apptVetId && apptVetId !== req.user.id) {
          return res.status(403).json({
            success: false,
            error: 'Bạn không phải là bác sĩ được phân công cho ca khám này. Không thể tạo bệnh án nháp hoặc kê đơn cho ca khám của bác sĩ khác.',
            code: 'FORBIDDEN_NOT_APPOINTMENT_VET'
          });
        }
      }
    }
  }

  // Kiểm tra quyền đối với petId cho non-admin (bỏ qua các khoản chi hoặc bản ghi dùng chung 'shared' và 'all')
  if (req.user.role !== 'system_admin' && newItem.petId && newItem.petId !== 'shared' && newItem.petId !== 'all') {
    const pet = allPets.find(p => p.id === newItem.petId);
    if (!pet) return res.status(400).json({ success: false, error: 'Thú cưng không tồn tại trong hệ thống.' });
    
    if (req.user.role === 'pet_owner' && pet.ownerId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền thao tác trên thú cưng của người khác.' });
    }
    
    if (req.user.role === 'vet_doctor') {
      const isAssigned = isVetAssignedToPet(req.user.id, pet.id, allPets);
      if (!isAssigned) {
        return res.status(403).json({ success: false, error: 'Thú cưng chưa được phân công cho bác sĩ phụ trách.' });
      }
    }
  }

  // Chống trùng lịch (Collision check & Idempotency) ở backend cho appointments
  if (collection === 'appointments') {
    const existingAppointments = getCollectionData('appointments', false) || [];
    const targetDate = newItem.date;
    const targetTime = newItem.time || newItem.timeSlot;
    if (targetDate && targetTime) {
      // 1. Idempotency: nếu vừa gửi đúng bản ghi này trong 45s qua (cùng thú cưng, ngày, giờ, chủ)
      const duplicateRecent = existingAppointments.find(app => {
        if (app.status === 'cancelled') return false;
        const appTime = app.time || app.timeSlot;
        const isSameSlot = app.date === targetDate && appTime === targetTime && app.petId === newItem.petId && app.ownerId === newItem.ownerId;
        if (!isSameSlot) return false;
        const createdMs = app.createdAt ? new Date(app.createdAt).getTime() : 0;
        return (Date.now() - createdMs) < 45000;
      });
      if (duplicateRecent) {
        return res.json({ success: true, data: duplicateRecent, isIdempotent: true });
      }

      // 2. Chống trùng lịch
      const collision = existingAppointments.find(app => {
        if (app.status === 'cancelled') return false;
        const appTime = app.time || app.timeSlot;
        const sameTime = app.date === targetDate && appTime === targetTime;
        if (!sameTime) return false;
        // Trùng cùng thú cưng
        if (app.petId === newItem.petId) return true;
        // Trùng cùng bác sĩ
        if (newItem.assignedVetId && (app.assignedVetId === newItem.assignedVetId || app.vetId === newItem.assignedVetId)) {
          return true;
        }
        return false;
      });
      if (collision) {
        return res.status(409).json({
          success: false,
          error: collision.petId === newItem.petId
            ? 'Bé thú cưng đã có một lịch hẹn khác vào khung giờ này. Vui lòng chọn khung giờ khác.'
            : 'Bác sĩ được chọn đã có lịch khám vào khung giờ này. Vui lòng chọn khung giờ khác.',
          code: 'APPOINTMENT_COLLISION'
        });
      }
    }
  }

  // Cân nặng thú cưng
  if (collection === 'pets') {
    if (newItem.weight !== undefined && newItem.weight !== null && newItem.weight !== '') {
      newItem.weight = Number(newItem.weight);
    } else {
      newItem.weight = null;
    }
  }

  const updatedData = [newItem, ...data];
  const ok = saveCollectionData(collection, updatedData);
  if (!ok) {
    return res.status(500).json({
      success: false,
      error: 'Lỗi ghi dữ liệu vào hệ thống lưu trữ.',
      code: 'STORAGE_WRITE_ERROR'
    });
  }
  res.json({ success: true, data: newItem });
});

// ----------------------------------------------------------------------------
// 5. GENERIC PUT UPDATE (Kiểm tra dữ liệu sau khi ghép, không đổi ID, chặn quyền trái phép)
// ----------------------------------------------------------------------------
router.put('/:collection/:id', authenticateToken, (req, res) => {
  const { collection, id } = req.params;
  if (!getAllowedCollections().includes(collection)) {
    return res.status(404).json({ success: false, error: 'Collection not found' });
  }

  // Chặn tuyệt đối việc đổi ID bản ghi qua body (Immutable ID), kể cả chuỗi rỗng, null hay ID khác
  if ('id' in req.body) {
    const reqId = req.body.id;
    if (reqId === null || reqId === undefined || String(reqId).trim() === '' || String(reqId).trim() !== String(id).trim()) {
      return res.status(400).json({
        success: false,
        error: 'Không được phép thay đổi, làm rỗng hoặc xóa ID của bản ghi.',
        code: 'IMMUTABLE_ID'
      });
    }
  }

  const isObject = COLLECTION_TYPES[collection] === 'object';
  let data = getCollectionData(collection, isObject);

  if (isObject) {
    // Với object collection, id chính là petId
    const allPets = getCollectionData('pets', false);
    const pet = allPets.find(p => p.id === id);
    if (!pet && req.user.role !== 'system_admin') {
      return res.status(404).json({ success: false, error: 'Thú cưng không tồn tại.' });
    }
    
    if (req.user.role === 'pet_owner') {
      if (!pet || pet.ownerId !== req.user.id) {
        return res.status(403).json({ success: false, error: 'Bạn không có quyền chỉnh sửa thú cưng này.' });
      }
    }

    if (req.user.role === 'vet_doctor') {
      if (collection === 'lost_modes') {
        return res.status(403).json({ success: false, error: 'Bác sĩ không có quyền chỉnh sửa chế độ thất lạc của thú cưng.' });
      }
      const isAssigned = isVetAssignedToPet(req.user.id, id, allPets);
      if (!isAssigned) {
        return res.status(403).json({ success: false, error: 'Bác sĩ không được phân công chăm sóc thú cưng này.' });
      }
    }

    // Kiểm tra cân nặng nếu có gửi trong health_data
    if (collection === 'health_data') {
      const todayVn = getTodayVnDate();
      if (req.body.weightHistory !== undefined && req.body.weightHistory !== null) {
        const vResult = validatePetWeightHistory(req.body.weightHistory, todayVn);
        if (!vResult.valid) {
          return res.status(400).json({
            success: false,
            error: vResult.error,
            code: vResult.code
          });
        }
        req.body.weightHistory = vResult.sanitized;
        if (vResult.sanitized.length > 0) {
          req.body.weight = vResult.sanitized[vResult.sanitized.length - 1].weight;
        }
      }

      if (req.body.weight !== undefined && req.body.weight !== null && req.body.weight !== '') {
        if (!isValidPositiveNumber(req.body.weight)) {
          return res.status(400).json({
            success: false,
            error: 'Cân nặng trong hồ sơ sức khỏe phải là một số hữu hạn dương lớn hơn 0.',
            code: 'INVALID_WEIGHT'
          });
        }
      }
    }

    const updatedObject = { ...data, [id]: { ...(data[id] || {}), ...req.body } };

    // Đồng bộ cân nặng sang danh sách thú cưng nếu cập nhật health_data có trường weight
    if (collection === 'health_data' && req.body.weight !== undefined && req.body.weight !== null && req.body.weight !== '') {
      const petsList = getCollectionData('pets', false);
      const petIndex = petsList.findIndex(p => p.id === id);
      if (petIndex !== -1) {
        const updatedPets = petsList.map((p, idx) => idx === petIndex ? { ...p, weight: Number(req.body.weight) } : p);
        try {
          const ok = saveMultipleCollections([
            { collection: 'health_data', data: updatedObject, isObject: true },
            { collection: 'pets', data: updatedPets, isObject: false }
          ]);
          if (!ok) {
            return res.status(500).json({
              success: false,
              error: 'Lỗi ghi dữ liệu sức khỏe và đồng bộ thú cưng. Toàn bộ thay đổi đã được hoàn tác.',
              code: 'STORAGE_WRITE_ERROR'
            });
          }
        } catch (txErr) {
          if (txErr.code === 'ROLLBACK_FAILED') {
            return res.status(500).json({
              success: false,
              error: txErr.message,
              code: 'ROLLBACK_FAILED'
            });
          }
          throw txErr;
        }
        return res.json({ success: true, data: updatedObject[id] });
      }
    }

    const ok = saveCollectionData(collection, updatedObject);
    if (!ok) {
      return res.status(500).json({
        success: false,
        error: 'Lỗi ghi dữ liệu vào hệ thống lưu trữ.',
        code: 'STORAGE_WRITE_ERROR'
      });
    }

    return res.json({ success: true, data: updatedObject[id] });
  } else {
    const index = data.findIndex(item => item.id === id);
    if (index === -1) return res.status(404).json({ success: false, error: 'Bản ghi không tồn tại.' });

    const currentItem = data[index];

    // Chặn chủ nuôi sửa hồ sơ bệnh án hoặc đơn thuốc chuyên môn của bác sĩ
    if (req.user.role === 'pet_owner' && (collection === 'medical_records' || collection === 'prescriptions')) {
      return res.status(403).json({
        success: false,
        error: 'Chủ nuôi không có quyền chỉnh sửa bệnh án hoặc đơn thuốc chuyên môn của bác sĩ.'
      });
    }

    // Kiểm tra phân công ca khám: Nếu ca đã giao bác sĩ A, bác sĩ B không được sửa bệnh án/đơn thuốc của ca này
    if (collection === 'medical_records' || collection === 'prescriptions') {
      const apptId = currentItem.appointmentId || req.body.appointmentId;
      if (apptId && req.user.role === 'vet_doctor') {
        const allAppts = getCollectionData('appointments', false) || [];
        const targetAppt = allAppts.find(a => a.id === apptId);
        if (targetAppt) {
          const apptVetId = targetAppt.assignedVetId || targetAppt.vetId;
          if (apptVetId && apptVetId !== req.user.id) {
            return res.status(403).json({
              success: false,
              error: 'Bạn không phải là bác sĩ được phân công cho ca khám này. Không thể chỉnh sửa bệnh án hoặc đơn thuốc của ca khám khác.',
              code: 'FORBIDDEN_NOT_APPOINTMENT_VET'
            });
          }
        }
      }
    }

    // Chặn người nuôi tự gửi các trường đặc quyền hoặc sửa bản ghi đã xác minh
    if (req.user.role === 'pet_owner') {
      delete req.body.isFinal;
      delete req.body.confirmedBy;
      delete req.body.assignedVetId;
      delete req.body.isVerified;
      delete req.body.verifiedBy;
      delete req.body.verifiedAt;
      delete req.body.doctorLicense;
      if (req.body.source === 'vet_verified') {
        req.body.source = 'owner_declared';
      }

      if (collection === 'schedules') {
        if (currentItem.isVerified === true || currentItem.source === 'vet_verified') {
          return res.status(403).json({
            success: false,
            error: 'Chủ nuôi chỉ được chỉnh sửa bản ghi tự khai chưa xác nhận, không được sửa trực tiếp bản ghi đã được Bác sĩ thú y xác nhận.',
            code: 'FORBIDDEN_VERIFIED_RECORD'
          });
        }
      }
    }

    // Ghép bản ghi hiện tại với dữ liệu cập nhật trước khi validation toàn diện
    const merged = {
      ...currentItem,
      ...req.body,
      id: currentItem.id, // ID là bất biến
      ownerId: currentItem.ownerId // ownerId là bất biến
    };

    // 1. Validation Schema sau khi ghép (POST-MERGE VALIDATION)
    if (collection === 'pets') {
      const todayVn = getTodayVnDate();
      if (merged.birthDate && typeof merged.birthDate === 'string' && merged.birthDate.trim()) {
        const bDate = merged.birthDate.trim();
        if (isValidCalendarDate(bDate) && bDate > todayVn) {
          return res.status(400).json({
            success: false,
            error: `Ngày sinh của thú cưng (${bDate}) không được vượt quá ngày hiện tại (${todayVn}) theo giờ Việt Nam.`,
            code: 'FUTURE_BIRTH_DATE'
          });
        }
      }

      if (merged.weightHistory !== undefined && merged.weightHistory !== null) {
        const vResult = validatePetWeightHistory(merged.weightHistory, todayVn);
        if (!vResult.valid) {
          return res.status(400).json({
            success: false,
            error: vResult.error,
            code: vResult.code
          });
        }
        merged.weightHistory = vResult.sanitized;
      }

      if (Array.isArray(merged.weightHistory) && merged.weightHistory.length > 0) {
        // Luôn bảo đảm lịch sử sắp xếp tăng dần theo ngày ghi nhận thực tế YYYY-MM-DD
        const sortedHistory = [...merged.weightHistory]
          .filter(h => h && h.weight != null && !isNaN(h.weight) && Number(h.weight) > 0)
          .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        merged.weightHistory = sortedHistory;
        // Cân nặng hiện tại lấy từ bản ghi có ngày ghi nhận mới nhất
        merged.weight = sortedHistory.length > 0 ? Number(sortedHistory[sortedHistory.length - 1].weight) : null;
      } else if (merged.weight !== undefined && merged.weight !== null && merged.weight !== '') {
        if (!isValidPositiveNumber(merged.weight)) {
          return res.status(400).json({
            success: false,
            error: 'Cân nặng thú cưng phải là một số hữu hạn dương lớn hơn 0 (không nhận số âm, NaN hoặc sai kiểu).',
            code: 'INVALID_WEIGHT'
          });
        }
        merged.weight = Number(merged.weight);
      } else {
        merged.weight = null;
      }
    }

    if (collection === 'expenses') {
      if (!merged.title || typeof merged.title !== 'string' || !merged.title.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Tên khoản chi tiêu không được để trống hoặc xóa trắng.',
          code: 'MISSING_TITLE'
        });
      }
      merged.title = merged.title.trim();

      const amt = Number(merged.amount);
      if (
        typeof merged.amount === 'boolean' ||
        merged.amount === null ||
        merged.amount === undefined ||
        isNaN(amt) ||
        !Number.isFinite(amt) ||
        !Number.isInteger(amt) ||
        amt <= 0 ||
        amt > Number.MAX_SAFE_INTEGER
      ) {
        return res.status(400).json({
          success: false,
          error: 'Số tiền chi tiêu phải là một số nguyên dương hợp lệ lớn hơn 0 (VND, không nhận số âm, 0, số thập phân hoặc chữ).',
          code: 'INVALID_AMOUNT'
        });
      }
      merged.amount = amt;

      if (!isValidCalendarDate(merged.date)) {
        return res.status(400).json({
          success: false,
          error: 'Ngày chi tiêu không hợp lệ hoặc không tồn tại trên lịch thực tế (định dạng YYYY-MM-DD).',
          code: 'INVALID_DATE'
        });
      }
      const todayVn = getTodayVnDate();
      if (merged.date > todayVn) {
        return res.status(400).json({
          success: false,
          error: `Ngày chi tiêu (${merged.date}) không được nằm trong tương lai so với ngày hiện tại (${todayVn}) theo giờ Việt Nam.`,
          code: 'FUTURE_EXPENSE_DATE'
        });
      }

      const validCategories = ['food', 'medical', 'grooming', 'supplies', 'other'];
      if (!merged.category || !validCategories.includes(merged.category)) {
        merged.category = 'other';
      }

      if (!merged.petId || merged.petId === 'all' || merged.petId === 'shared' || merged.petId === 'none') {
        merged.petId = 'shared';
        merged.petName = 'Dùng chung';
      } else {
        const allPets = getCollectionData('pets', false) || [];
        const targetPet = allPets.find(p => p.id === merged.petId);
        if (!targetPet) {
          return res.status(400).json({
            success: false,
            error: 'Thú cưng liên kết không tồn tại trong hệ thống.',
            code: 'INVALID_PET_ID'
          });
        }
        if (req.user.role === 'pet_owner' && String(targetPet.ownerId).trim() !== String(req.user.id).trim()) {
          return res.status(403).json({
            success: false,
            error: 'Bạn không có quyền chuyển khoản chi sang thú cưng của người khác.',
            code: 'FORBIDDEN_PET_OWNERSHIP'
          });
        }
        merged.petName = targetPet.name;
      }
    }

    if (collection === 'budgets') {
      if (!merged.month || typeof merged.month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(merged.month.trim())) {
        return res.status(400).json({
          success: false,
          error: 'Tháng áp dụng ngân sách không hợp lệ (yêu cầu định dạng YYYY-MM).',
          code: 'INVALID_BUDGET_MONTH'
        });
      }
      merged.month = merged.month.trim();

      const amt = Number(merged.amount);
      if (
        typeof merged.amount === 'boolean' ||
        merged.amount === null ||
        merged.amount === undefined ||
        isNaN(amt) ||
        !Number.isFinite(amt) ||
        !Number.isInteger(amt) ||
        amt <= 0 ||
        amt > Number.MAX_SAFE_INTEGER
      ) {
        return res.status(400).json({
          success: false,
          error: 'Số tiền ngân sách phải là một số nguyên dương hợp lệ lớn hơn 0 VND.',
          code: 'INVALID_BUDGET_AMOUNT'
        });
      }
      merged.amount = amt;
    }

    if (collection === 'schedules') {
      const VALID_SCHEDULE_TYPES = [
        'vaccine',
        'deworm',
        'parasite',
        'grooming',
        'vet',
        'medicine',
        'feeding',
        'exercise',
        'other'
      ];

      if (req.body.type !== undefined) {
        if (!req.body.type || typeof req.body.type !== 'string' || !VALID_SCHEDULE_TYPES.includes(req.body.type.trim())) {
          return res.status(400).json({
            success: false,
            error: 'Loại sự kiện cập nhật không hợp lệ. Phải thuộc danh mục: vaccine, deworm, parasite, grooming, vet, medicine, feeding, exercise, other.',
            code: 'INVALID_SCHEDULE_TYPE'
          });
        }
        merged.type = req.body.type.trim();
      }

      if (!merged.petId || typeof merged.petId !== 'string' || !merged.petId.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Lịch chăm sóc phải luôn giữ thú cưng hợp lệ (petId bắt buộc không được xóa trắng).',
          code: 'MISSING_PET_ID'
        });
      }
      const title = merged.title || merged.task || merged.activity || merged.vaccineName || merged.medicationName;
      if (!title || typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Tiêu đề hoặc tên thuốc/vaccine không được để trống hoặc xóa trắng.',
          code: 'MISSING_TITLE'
        });
      }
      merged.title = title.trim();

      if (!isValidCalendarDate(merged.date)) {
        return res.status(400).json({
          success: false,
          error: 'Ngày ghi nhận không hợp lệ hoặc không tồn tại trên lịch thực tế (định dạng YYYY-MM-DD).',
          code: 'INVALID_DATE'
        });
      }

      const todayVn = getTodayVnDate();
      const isMedicalRecord = merged.type === 'vaccine' || merged.type === 'parasite' || merged.type === 'deworm';

      // Ngày tiêm / sử dụng thực tế không được nằm trong tương lai (Mục 3, Mục 4)
      if (isMedicalRecord && !merged.isPlanned && merged.completed !== false) {
        if (merged.date > todayVn) {
          return res.status(400).json({
            success: false,
            error: `Ngày thực hiện (${merged.date}) không được thuộc tương lai (vượt quá hôm nay ${todayVn}).`,
            code: 'FUTURE_ADMINISTRATION_DATE'
          });
        }
      }

      // Ngày nhắc tiếp theo nếu nhập phải sau ngày thực tế (Mục 3, Mục 4)
      if (merged.nextDueDate && String(merged.nextDueDate).trim()) {
        const nextDueStr = String(merged.nextDueDate).trim();
        if (!isValidCalendarDate(nextDueStr)) {
          return res.status(400).json({
            success: false,
            error: 'Ngày nhắc tiếp theo không hợp lệ (định dạng YYYY-MM-DD).',
            code: 'INVALID_NEXT_DUE_DATE'
          });
        }
        if (nextDueStr <= merged.date) {
          return res.status(400).json({
            success: false,
            error: `Ngày nhắc tiếp theo (${nextDueStr}) phải sau ngày thực hiện (${merged.date}).`,
            code: 'INVALID_NEXT_DUE_DATE_ORDER'
          });
        }
        merged.nextDueDate = nextDueStr;
      }

      // Liều và đơn vị nếu có (Mục 4, Mục 9)
      if (merged.dosage !== undefined && merged.dosage !== null && String(merged.dosage).trim() !== '') {
        if (!isValidPositiveNumber(merged.dosage)) {
          return res.status(400).json({
            success: false,
            error: 'Liều lượng phải là một số dương lớn hơn 0 (không nhận số âm, 0 hoặc NaN).',
            code: 'INVALID_DOSAGE_VALUE'
          });
        }
        merged.dosage = Number(merged.dosage);
        if (!merged.dosageUnit || typeof merged.dosageUnit !== 'string' || !merged.dosageUnit.trim()) {
          return res.status(400).json({
            success: false,
            error: 'Vui lòng cung cấp đơn vị cho liều lượng (ví dụ: viên, ml, tuýp, mg).',
            code: 'MISSING_DOSAGE_UNIT'
          });
        }
        merged.dosageUnit = merged.dosageUnit.trim();
      }

      if (req.user.role === 'vet_doctor' && req.body.isVerified === true) {
        merged.isVerified = true;
        merged.source = 'vet_verified';
        merged.verifiedBy = req.user.name;
        merged.verifiedAt = new Date().toISOString();
      }
    }

    if (collection === 'daily_logs') {
      if (!merged.petId || typeof merged.petId !== 'string' || !merged.petId.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Bản ghi nhật ký phải liên kết với một thú cưng (petId bắt buộc).',
          code: 'MISSING_PET_ID'
        });
      }
      if (!isValidCalendarDate(merged.date)) {
        return res.status(400).json({
          success: false,
          error: 'Ngày ghi nhận không hợp lệ hoặc không tồn tại trên lịch thực tế (định dạng YYYY-MM-DD).',
          code: 'INVALID_DATE'
        });
      }

      const logType = merged.type || 'observation';

      if (logType === 'activity') {
        const title = merged.title || merged.name;
        if (!title || typeof title !== 'string' || !title.trim()) {
          return res.status(400).json({
            success: false,
            error: 'Tên hoạt động gắn kết không được để trống.',
            code: 'MISSING_ACTIVITY_TITLE'
          });
        }
        merged.title = title.trim();

        // Không cho hoàn thành hoạt động đã hủy
        if (currentItem.status === 'cancelled' && merged.status === 'completed') {
          return res.status(400).json({
            success: false,
            error: 'Không thể xác nhận hoàn thành cho hoạt động đã bị hủy. Vui lòng phục hồi hoạt động trước khi hoàn thành.',
            code: 'CANNOT_COMPLETE_CANCELLED_ACTIVITY'
          });
        }

        if (merged.estimatedDuration !== undefined && merged.estimatedDuration !== null && merged.estimatedDuration !== '') {
          if (!isValidPositiveNumber(merged.estimatedDuration)) {
            return res.status(400).json({
              success: false,
              error: 'Thời lượng dự kiến phải là một số hữu hạn dương lớn hơn 0 phút.',
              code: 'INVALID_DURATION'
            });
          }
          merged.estimatedDuration = Number(merged.estimatedDuration);
        } else {
          merged.estimatedDuration = null;
        }

        if (merged.actualDuration !== undefined && merged.actualDuration !== null && merged.actualDuration !== '') {
          if (!isValidPositiveNumber(merged.actualDuration)) {
            return res.status(400).json({
              success: false,
              error: 'Thời lượng thực tế phải là một số hữu hạn dương lớn hơn 0 phút.',
              code: 'INVALID_ACTUAL_DURATION'
            });
          }
          merged.actualDuration = Number(merged.actualDuration);
        } else {
          merged.actualDuration = null;
        }

        if (merged.time && !isValidTimeFormat(merged.time)) {
          return res.status(400).json({
            success: false,
            error: 'Giờ thực hiện hoạt động không đúng định dạng HH:MM.',
            code: 'INVALID_TIME'
          });
        }

        const validStatuses = ['pending', 'completed', 'cancelled'];
        if (merged.status && !validStatuses.includes(merged.status)) {
          return res.status(400).json({
            success: false,
            error: 'Trạng thái hoạt động không hợp lệ.',
            code: 'INVALID_STATUS'
          });
        }
      }

      if (logType === 'behavior') {
        if (!merged.behavior || typeof merged.behavior !== 'string' || !merged.behavior.trim()) {
          return res.status(400).json({
            success: false,
            error: 'Biểu hiện hành vi không được để trống.',
            code: 'MISSING_BEHAVIOR'
          });
        }
        merged.behavior = merged.behavior.trim();

        if (merged.time && !isValidTimeFormat(merged.time)) {
          return res.status(400).json({
            success: false,
            error: 'Giờ quan sát không đúng định dạng HH:MM.',
            code: 'INVALID_TIME'
          });
        }

        const todayVn = getTodayVnDate();
        if (merged.date > todayVn) {
          return res.status(400).json({
            success: false,
            error: 'Thời điểm quan sát không được ở tương lai so với ngày hiện tại.',
            code: 'FUTURE_OBSERVATION_TIME'
          });
        }
        if (merged.date === todayVn && merged.time) {
          const currentVnTime = getCurrentVnTime();
          if (merged.time > currentVnTime) {
            return res.status(400).json({
              success: false,
              error: `Giờ quan sát (${merged.time}) không được ở tương lai so với giờ hiện tại (${currentVnTime}).`,
              code: 'FUTURE_OBSERVATION_TIME'
            });
          }
        }
      }

      if (logType === 'observation') {
        const todayVn = getTodayVnDate();
        if (merged.date > todayVn) {
          return res.status(400).json({
            success: false,
            error: 'Ngày quan sát không được ở tương lai so với ngày hiện tại.',
            code: 'FUTURE_OBSERVATION_DATE'
          });
        }
      }
    }

    // Xử lý riêng nghiệp vụ appointments
    if (collection === 'appointments') {
      if (!merged.petId || typeof merged.petId !== 'string' || !merged.petId.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Lịch khám phải liên kết với một thú cưng (petId bắt buộc không được xóa trắng).',
          code: 'MISSING_PET_ID'
        });
      }
      if (req.body.phone !== undefined || merged.phone !== undefined) {
        const phoneCheck = validateVietnamesePhoneNumber(merged.phone);
        if (!phoneCheck.isValid) {
          return res.status(400).json({
            success: false,
            error: phoneCheck.error,
            code: phoneCheck.code
          });
        }
        merged.phone = merged.phone.trim();
      }
      if (!isValidCalendarDate(merged.date)) {
        return res.status(400).json({
          success: false,
          error: 'Ngày hẹn không hợp lệ hoặc không tồn tại trên lịch thực tế (định dạng YYYY-MM-DD).',
          code: 'INVALID_DATE'
        });
      }
      const appTime = merged.time || merged.timeSlot;
      if (!isValidTimeFormat(appTime)) {
        return res.status(400).json({
          success: false,
          error: 'Giờ hẹn không đúng định dạng HH:MM hoặc vượt quá phạm vi giờ hợp lệ (00:00 - 23:59).',
          code: 'INVALID_TIME'
        });
      }

      // 1. Kiểm tra chuyển đổi trạng thái hợp lệ
      if (currentItem.status === 'cancelled') {
        if (req.body.status && (req.body.status === 'completed' || req.body.status === 'in_progress')) {
          return res.status(400).json({
            success: false,
            error: 'Lịch hẹn đã bị hủy không thể chuyển trực tiếp sang trạng thái đang khám hoặc hoàn thành.',
            code: 'INVALID_STATUS_TRANSITION'
          });
        }
      }

      if (currentItem.status === 'completed') {
        if (req.body.status && req.body.status !== 'completed') {
          return res.status(400).json({
            success: false,
            error: 'Lịch hẹn đã hoàn thành không thể thay đổi trạng thái.',
            code: 'INVALID_STATUS_TRANSITION'
          });
        }
      }

      // 2. Kiểm tra tính hợp lệ và phân quyền phân công bác sĩ
      if (req.body.assignedVetId !== undefined && req.body.assignedVetId !== currentItem.assignedVetId) {
        if (req.user.role !== 'system_admin') {
          return res.status(403).json({
            success: false,
            error: 'Chỉ Quản trị viên hoặc vai trò điều phối mới có quyền phân công bác sĩ cho ca khám.',
            code: 'FORBIDDEN_CANNOT_ASSIGN_VET'
          });
        }
        if (req.body.assignedVetId) {
          if (currentItem.status === 'in_progress' || currentItem.status === 'completed' || currentItem.status === 'cancelled') {
            return res.status(400).json({
              success: false,
              error: 'Không thể chuyển bác sĩ cho ca khám đang diễn ra, đã hoàn tất hoặc đã bị hủy.',
              code: 'CANNOT_REASSIGN_ACTIVE_OR_FINISHED'
            });
          }
          const allUsers = getUsers();
          const vet = allUsers.find(u => u.id === req.body.assignedVetId);
          if (!vet || vet.role !== 'vet_doctor' || vet.isLocked || (vet.vetStatus && vet.vetStatus !== 'approved')) {
            return res.status(400).json({
              success: false,
              error: 'Bác sĩ được phân công không tồn tại, đã bị khóa hoặc chưa được phê duyệt chứng chỉ hành nghề.',
              code: 'INVALID_ASSIGNED_VET'
            });
          }
          merged.assignedVet = vet.name.startsWith('BS.') ? vet.name : `BS. ${vet.name}`;
        }
      }

      // 3. Phân quyền Bác sĩ thú y thao tác trên ca khám
      if (req.user.role === 'vet_doctor') {
        const isMyAppointment = (currentItem.assignedVetId === req.user.id || currentItem.vetId === req.user.id);
        if (!isMyAppointment) {
          return res.status(403).json({
            success: false,
            error: 'Bạn không phải là bác sĩ được phân công cho ca khám này. Không thể cập nhật ca khám của bác sĩ khác.',
            code: 'FORBIDDEN_NOT_APPOINTMENT_VET'
          });
        }
        if (req.body.status === 'completed') {
          return res.status(400).json({
            success: false,
            error: 'Hoàn tất ca khám bắt buộc phải thông qua nghiệp vụ Chốt bệnh án SOAP và đơn thuốc (finalize-ehr), không được đổi trực tiếp sang completed.',
            code: 'MUST_FINALIZE_VIA_EHR'
          });
        }
      }

      if (req.user.role === 'pet_owner') {
        // Chặn hủy hoặc sửa nếu ca khám đã hoàn thành hoặc đang diễn ra
        if (currentItem.status === 'completed' || currentItem.status === 'in_progress') {
          return res.status(400).json({
            success: false,
            error: 'Không thể thay đổi hoặc hủy lịch khám đã hoàn thành hoặc đang diễn ra.'
          });
        }
        // Chủ nuôi chỉ được phép hủy (status: 'cancelled'), không được tự ý đổi sang status khác
        if (req.body.status && req.body.status !== 'cancelled') {
          return res.status(400).json({
            success: false,
            error: 'Chủ nuôi chỉ được phép hủy lịch hẹn (chuyển sang trạng thái đã hủy).'
          });
        }
      }

      // Kiểm tra trùng lịch khi dời ngày/giờ hoặc phân công bác sĩ (nếu không phải thao tác hủy)
      if ((req.body.date || req.body.time || req.body.timeSlot || req.body.assignedVetId) && req.body.status !== 'cancelled') {
        const targetDate = merged.date;
        const targetTime = merged.time || merged.timeSlot;
        const targetPetId = merged.petId;
        const targetVetId = merged.assignedVetId;

        const existingAppointments = getCollectionData('appointments', false) || [];
        const collision = existingAppointments.find(app => {
          if (app.id === id || app.status === 'cancelled') return false;
          const appTime = app.time || app.timeSlot;
          const sameTime = app.date === targetDate && appTime === targetTime;
          if (!sameTime) return false;
          if (app.petId === targetPetId) return true;
          if (targetVetId && app.assignedVetId === targetVetId) return true;
          return false;
        });

        if (collision) {
          return res.status(409).json({
            success: false,
            error: 'Khung giờ này đã có lịch hẹn khác cho thú cưng hoặc bác sĩ. Vui lòng chọn khung giờ khác.',
            code: 'APPOINTMENT_COLLISION'
          });
        }
      }
    }

    // 2. Kiểm tra quyền đối với petId và các quan hệ sau khi ghép
    const allPets = getCollectionData('pets', false);
    if (merged.petId && merged.petId !== 'shared' && merged.petId !== 'all') {
      const targetPet = allPets.find(p => p.id === merged.petId);
      if (!targetPet) {
        return res.status(400).json({
          success: false,
          error: 'Thú cưng liên kết không tồn tại trong hệ thống.',
          code: 'INVALID_PET_ID'
        });
      }

      if (req.user.role === 'pet_owner') {
        if (targetPet.ownerId !== req.user.id) {
          return res.status(403).json({
            success: false,
            error: 'Không thể chuyển hoặc liên kết bản ghi sang thú cưng của người khác.'
          });
        }
      } else if (req.user.role === 'vet_doctor') {
        if (collection === 'appointments') {
          const isAssignedToAppt = (currentItem.assignedVetId === req.user.id || currentItem.vetId === req.user.id);
          if (!isAssignedToAppt) {
            return res.status(403).json({
              success: false,
              error: 'Bác sĩ không được phân công phụ trách ca khám này.',
              code: 'FORBIDDEN_NOT_APPOINTMENT_VET'
            });
          }
        } else {
          const isAssigned = isVetAssignedToPet(req.user.id, targetPet.id, allPets);
          if (!isAssigned) {
            return res.status(403).json({
              success: false,
              error: 'Bác sĩ không được phân công chăm sóc thú cưng này.'
            });
          }
        }
      }
    }

    // Kiểm tra quyền tác vụ đối với bản ghi đang cập nhật
    if (req.user.role !== 'system_admin') {
      if (req.user.role === 'pet_owner' && String(currentItem.ownerId || '').trim() !== String(req.user.id || '').trim()) {
        return res.status(403).json({ success: false, error: 'Bạn không có quyền sửa bản ghi này.' });
      }
      
      if (req.user.role === 'vet_doctor') {
        if (collection === 'appointments') {
          const isAssignedToAppt = (currentItem.assignedVetId === req.user.id || currentItem.vetId === req.user.id);
          if (!isAssignedToAppt) {
            return res.status(403).json({ success: false, error: 'Bác sĩ không được phân công phụ trách ca khám này.' });
          }
        } else {
          const isAssigned = isVetAssignedToPet(req.user.id, currentItem.petId || id, allPets);
          const isAuthor = currentItem.authorId === req.user.id || currentItem.vetId === req.user.id;
          if (!isAssigned && !isAuthor) {
            return res.status(403).json({ success: false, error: 'Bác sĩ không được phân công phụ trách bản ghi này.' });
          }
        }
      }
    }

    // Bảo vệ bệnh án & đơn thuốc đã chốt/công bố (SOAP & Prescription finalized lock)
    if ((collection === 'medical_records' || collection === 'prescriptions') && (currentItem.isFinal || isRecordPublished(currentItem))) {
      if (collection === 'prescriptions') {
        return res.status(403).json({
          success: false,
          error: 'Đơn thuốc đã ký chốt / đã công bố không thể sửa trực tiếp.'
        });
      }
      const rawHistoryEntry = Array.isArray(req.body.history) && req.body.history.length > 0 ? req.body.history[req.body.history.length - 1] : null;
      const reason = req.body.amendmentReason || rawHistoryEntry?.reason;
      const addendumNote = req.body.addendumNote || rawHistoryEntry?.note || '';
      if (!reason && !addendumNote) {
        return res.status(403).json({
          success: false,
          error: 'Bệnh án đã ký chốt không thể sửa trực tiếp. Để bổ sung thông tin lâm sàng, vui lòng cung cấp lý do bổ sung (amendmentReason) và nội dung ghi chú (addendumNote).'
        });
      }

      const existingHistory = Array.isArray(currentItem.history) ? currentItem.history : [];
      const historyEntry = {
        version: existingHistory.length + 1,
        amendedAt: new Date().toISOString(),
        amendedBy: req.user.id,
        amendedByName: req.user.name,
        reason: reason || 'Bổ sung ghi chú lâm sàng',
        addendumNote: addendumNote,
        previousState: {
          assessment: currentItem.assessment,
          plan: currentItem.plan,
          notes: currentItem.notes
        }
      };

      const updatedRecord = {
        ...currentItem,
        history: [...existingHistory, historyEntry],
        lastAmendedAt: historyEntry.amendedAt,
        notes: req.body.notes !== undefined ? req.body.notes : currentItem.notes,
        ownerId: currentItem.ownerId
      };

      const updatedData = [...data];
      updatedData[index] = updatedRecord;
      const ok = saveCollectionData(collection, updatedData);
      if (!ok) {
        return res.status(500).json({
          success: false,
          error: 'Lỗi ghi dữ liệu bệnh án vào hệ thống lưu trữ.',
          code: 'STORAGE_WRITE_ERROR'
        });
      }
      return res.json({ success: true, data: updatedRecord });
    }

    const updatedData = [...data];
    updatedData[index] = merged;
    const ok = saveCollectionData(collection, updatedData);
    if (!ok) {
      return res.status(500).json({
        success: false,
        error: 'Lỗi ghi dữ liệu vào hệ thống lưu trữ.',
        code: 'STORAGE_WRITE_ERROR'
      });
    }
    return res.json({ success: true, data: merged });
  }
});

// ----------------------------------------------------------------------------
// 6. GENERIC DELETE (Xóa dây chuyền toàn vẹn: dọn cả medical_records, lost_modes, health_data)
// ----------------------------------------------------------------------------
router.delete('/:collection/:id', authenticateToken, (req, res) => {
  const { collection, id } = req.params;
  if (!getAllowedCollections().includes(collection)) {
    return res.status(404).json({ success: false, error: 'Collection not found' });
  }

  const isObject = COLLECTION_TYPES[collection] === 'object';
  let data = getCollectionData(collection, isObject);

    if (isObject) {
    const allPets = getCollectionData('pets', false);
    const pet = allPets.find(p => p.id === id);
    if (!pet && req.user.role !== 'system_admin') {
      return res.status(404).json({ success: false, error: 'Thú cưng không tồn tại.' });
    }

    if (req.user.role === 'pet_owner') {
      if (!pet || String(pet.ownerId || '').trim() !== String(req.user.id || '').trim()) {
        return res.status(403).json({ success: false, error: 'Bạn không có quyền xóa dữ liệu của thú cưng này.', code: 'FORBIDDEN_NOT_OWNER' });
      }
    } else if (req.user.role === 'vet_doctor') {
      if (collection === 'lost_modes') {
        return res.status(403).json({ success: false, error: 'Bác sĩ không có quyền xóa chế độ thất lạc của thú cưng.', code: 'FORBIDDEN_PERMISSION_DENIED' });
      }
      const isAssigned = isVetAssignedToPet(req.user.id, id, allPets);
      if (!isAssigned) {
        return res.status(403).json({ success: false, error: 'Bác sĩ không được phân công chăm sóc thú cưng này.', code: 'FORBIDDEN_NOT_ASSIGNED' });
      }
    }

    const updatedData = { ...data };
    delete updatedData[id];
    const ok = saveCollectionData(collection, updatedData);
    if (!ok) {
      return res.status(500).json({
        success: false,
        error: 'Lỗi ghi dữ liệu vào hệ thống lưu trữ.',
        code: 'STORAGE_WRITE_ERROR'
      });
    }
    return res.json({ success: true });
  } else {
    const index = data.findIndex(item => item.id === id || String(item.id).trim() === String(id).trim());
    if (index === -1) return res.status(404).json({ success: false, error: 'Bản ghi không tồn tại.' });

    const currentItem = data[index];
    if (req.user.role !== 'system_admin') {
      if (req.user.role === 'pet_owner') {
        if (collection === 'medical_records' || collection === 'prescriptions') {
          return res.status(403).json({ success: false, error: 'Chủ nuôi không có quyền xóa bệnh án hoặc đơn thuốc chuyên môn.', code: 'FORBIDDEN_PERMISSION_DENIED' });
        }
        if (collection === 'appointments') {
          return res.status(403).json({
            success: false,
            error: 'Chủ nuôi không được xóa vĩnh viễn hồ sơ lịch khám. Vui lòng sử dụng chức năng Hủy lịch khám.',
            code: 'FORBIDDEN_CANNOT_DELETE_APPOINTMENT'
          });
        }
        if (collection === 'schedules' && (currentItem.isVerified === true || currentItem.source === 'vet_verified')) {
          return res.status(403).json({
            success: false,
            error: 'Chủ nuôi chỉ được xóa bản ghi tự khai chưa xác nhận, không được xóa bản ghi đã được Bác sĩ thú y xác nhận.',
            code: 'FORBIDDEN_VERIFIED_RECORD'
          });
        }
        if (String(currentItem.ownerId || '').trim() !== String(req.user.id || '').trim()) {
          return res.status(403).json({ success: false, error: 'Bạn không có quyền xóa bản ghi này.', code: 'FORBIDDEN_NOT_OWNER' });
        }
      }
      if (req.user.role === 'vet_doctor') {
        return res.status(403).json({ success: false, error: 'Bác sĩ không có quyền xóa bản ghi này.', code: 'FORBIDDEN_DOCTOR_CANNOT_DELETE' });
      }
    }

    // Bệnh án & Đơn thuốc đã ký chốt / đã công bố không thể bị xóa bởi bất kỳ ai
    if ((collection === 'medical_records' || collection === 'prescriptions') && (currentItem.isFinal || isRecordPublished(currentItem))) {
      return res.status(403).json({ 
        success: false, 
        error: collection === 'prescriptions' ? 'Đơn thuốc đã ký chốt / đã công bố không thể bị xóa.' : 'Bệnh án đã ký chốt không thể bị xóa.' 
      });
    }

    // Xóa dây chuyền khi xóa thú cưng (Pets Cascade Delete với Atomic Rollback)
    if (collection === 'pets') {
      const operations = [];
      const updatedPets = data.filter(item => item.id !== id);
      operations.push({ collection: 'pets', data: updatedPets, isObject: false });

      const arrayCollections = ['schedules', 'expenses', 'daily_logs', 'prescriptions', 'daily_habits', 'appointments', 'medical_records'];
      arrayCollections.forEach(col => {
         let subData = getCollectionData(col, false);
         const initialLen = subData.length;
         const filtered = subData.filter(item => item.petId !== id);
         if (filtered.length !== initialLen) {
           operations.push({ collection: col, data: filtered, isObject: false });
         }
      });
      let lostModes = getCollectionData('lost_modes', true);
      if (lostModes[id]) {
        delete lostModes[id];
        operations.push({ collection: 'lost_modes', data: lostModes, isObject: true });
      }
      let healthData = getCollectionData('health_data', true);
      let healthModified = false;
      if (healthData[id]) {
        delete healthData[id];
        healthModified = true;
      }
      const k1 = `health_${id}`;
      if (healthData[k1]) {
        delete healthData[k1];
        healthModified = true;
      }
      if (healthModified) {
        operations.push({ collection: 'health_data', data: healthData, isObject: true });
      }

      try {
        const ok = saveMultipleCollections(operations);
        if (!ok) {
          return res.status(500).json({
            success: false,
            error: 'Lỗi ghi dữ liệu dây chuyền khi xóa thú cưng. Toàn bộ thay đổi đã được hoàn tác.',
            code: 'STORAGE_WRITE_ERROR'
          });
        }
      } catch (txErr) {
        if (txErr.code === 'ROLLBACK_FAILED') {
          return res.status(500).json({
            success: false,
            error: txErr.message,
            code: 'ROLLBACK_FAILED'
          });
        }
        throw txErr;
      }
      return res.json({ success: true });
    }

    let updatedData = data.filter(item => item.id !== id);
    if (collection === 'schedules') {
      // Dọn dẹp cả lịch nhắc liên kết (nếu có)
      updatedData = updatedData.filter(item => item.sourceRecordId !== id && (!currentItem.linkedReminderId || item.id !== currentItem.linkedReminderId));
    }
    const ok = saveCollectionData(collection, updatedData);
    if (!ok) {
      return res.status(500).json({
        success: false,
        error: 'Lỗi ghi dữ liệu vào hệ thống lưu trữ.',
        code: 'STORAGE_WRITE_ERROR'
      });
    }
    return res.json({ success: true });
  }
});


export default router;
