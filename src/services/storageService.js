import { apiFetch, apiCreate, apiUpdate, apiDelete, syncAllDataToCache, archiveAppointment as apiArchiveAppointment, unarchiveAppointment as apiUnarchiveAppointment } from './apiService.js';
// Mock data removed as per requirements
import { generateAiCarePlan } from './aiService.js';

const STORAGE_KEYS = {
  PETS: 'petcare_pets_v1',
  SCHEDULES: 'petcare_schedules_v1',
  SETTINGS: 'petcare_settings_v1',
  EXPENSES: 'petcare_expenses_v1',
  DAILY_LOGS: 'petcare_daily_logs_v1',
  PRESCRIPTIONS: 'petcare_prescriptions_v1',
  FAMILY_MEMBERS: 'petcare_family_members_v1',
  DAILY_HABITS: 'petcare_daily_habits_v1',
  LOST_MODES: 'petcare_lost_modes_v1',
  THEME: 'petcare_theme_v1',
  APPOINTMENTS: 'petcare_appointments_v1',
  BUDGETS: 'petcare_budgets_v1'
};

const getStored = (key, fallback) => {
  try {
    const item = localStorage.getItem(key);
    if (!item) return fallback;
    return JSON.parse(item);
  } catch (error) {
    console.error(`Error reading ${key}:`, error);
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

// Re-export toàn bộ helper ngày giờ chuẩn hóa theo múi giờ Asia/Ho_Chi_Minh (MỤC 6)
export {
  VN_TIMEZONE,
  getTodayVnDate,
  getVnDateString,
  getLocalDateString,
  isValidCalendarDate,
  formatDateVi,
  formatDateKey,
  addDaysLocal,
  addMonthsClamped,
  addYearsClamped,
  getScheduleStatus,
  generateIcsCalendar
} from '../utils/dateUtils.js';

import {
  getTodayVnDate,
  getVnDateString,
  getLocalDateString,
  isValidCalendarDate,
  addDaysLocal,
  addMonthsClamped,
  addYearsClamped,
  generateIcsCalendar
} from '../utils/dateUtils.js';

// Tính toán chuỗi ngày streak liên tục thực tế từ mảng lịch sử completedDates
export const calculateStreak = (completedDates = []) => {
  if (!Array.isArray(completedDates) || completedDates.length === 0) return 0;
  const uniqueDates = Array.from(new Set(completedDates)).filter(Boolean).sort().reverse();
  if (uniqueDates.length === 0) return 0;
  const todayStr = getLocalDateString();
  
  let checkDate = new Date();
  const todayIncluded = uniqueDates.includes(todayStr);
  if (!todayIncluded) {
    checkDate.setDate(checkDate.getDate() - 1);
    const yesterdayStr = getLocalDateString(checkDate);
    if (!uniqueDates.includes(yesterdayStr)) {
      return 0; // Đã đứt chuỗi
    }
  }
  
  let streak = 0;
  let curr = new Date(todayIncluded ? todayStr : getLocalDateString(checkDate));
  while (true) {
    const currStr = getLocalDateString(curr);
    if (uniqueDates.includes(currStr)) {
      streak++;
      curr.setDate(curr.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
};

const SYSTEM_INIT_FLAG = 'petcare_system_initialized_v2';

// ----------------- PETS -----------------
export const getPets = (userId = null, userRole = null) => {
  const data = getStored(STORAGE_KEYS.PETS, null);
  let allPets = data;

  if (!Array.isArray(allPets)) {
    allPets = [];
    setStored(STORAGE_KEYS.PETS, allPets);
    localStorage.setItem(SYSTEM_INIT_FLAG, 'true');
  }

  // 1. Quản trị viên hệ thống hoặc không truyền userId (cho các bộ đếm tổng): Trả về toàn bộ hồ sơ thực tế
  if (!userId || userRole === 'system_admin') {
    return allPets;
  }

  // 2. Bác sĩ thú y (vet_doctor): Chỉ được truy cập hồ sơ được phân công khám hoặc chia sẻ hợp lệ
  if (userRole === 'vet_doctor') {
    const rawAppointments = getStored(STORAGE_KEYS.APPOINTMENTS, []) || [];
    const assignedPetIds = new Set(
      rawAppointments
        .filter(a => a.assignedVetId === userId || a.vetId === userId)
        .map(a => a.petId)
        .filter(Boolean)
    );
    return allPets.filter(p => 
      assignedPetIds.has(p.id) || 
      p.assignedVetId === userId || 
      (Array.isArray(p.sharedWithVetIds) && p.sharedWithVetIds.includes(userId))
    );
  }

  // 3. Chủ nuôi thường (pet_owner): Chỉ truy cập hồ sơ thuộc quyền sở hữu của chính mình
  return allPets.filter(p => String(p.ownerId).trim() === String(userId).trim());
};

export const savePets = (pets) => {
  setStored(STORAGE_KEYS.PETS, pets);
  return pets;
};

/**
 * XÓA DÂY CHUYỀN DỮ LIỆU KHI ADMIN XÓA TÀI KHOẢN (CASCADE DELETE BY OWNER):
 * - Xác định các thú cưng thuộc tài khoản bằng ownerId
 * - Xóa hồ sơ các thú cưng đó
 * - Xóa lịch chăm sóc, chi tiêu, nhật ký, đơn thuốc, thói quen, dữ liệu thất lạc gắn với các thú cưng bị xóa
 * - Xóa dữ liệu riêng của tài khoản và thu hồi phiên đăng nhập
 * - Không xóa hồ sơ của chủ nuôi khác
 * - Nếu xóa bác sĩ: chỉ thu hồi tài khoản và quyền phân công, KHÔNG xóa thú cưng của chủ nuôi
 */
export const handleUserDeletedCascade = (deletedUserId, deletedUserRole = null) => {
  if (!deletedUserId) return;
  const cleanId = String(deletedUserId).trim();

  // Tạo điểm khôi phục dự phòng (Transaction snapshot) để tránh xóa dở dang / partial deletion
  const snapshot = {
    pets: getStored(STORAGE_KEYS.PETS, null),
    schedules: getStored(STORAGE_KEYS.SCHEDULES, null),
    expenses: getStored(STORAGE_KEYS.EXPENSES, null),
    dailyLogs: getStored(STORAGE_KEYS.DAILY_LOGS, null),
    prescriptions: getStored(STORAGE_KEYS.PRESCRIPTIONS, null),
    familyMembers: getStored(STORAGE_KEYS.FAMILY_MEMBERS, null),
    dailyHabits: getStored(STORAGE_KEYS.DAILY_HABITS, null),
    lostModes: getStored(STORAGE_KEYS.LOST_MODES, null),
    appointments: getStored(STORAGE_KEYS.APPOINTMENTS, null),
    healthData: getStored(PETS_HEALTH_STORAGE_KEY, null)
  };

  try {
    // NẾU LÀ TÀI KHOẢN CHỦ NUÔI: XÓA THÚ CƯNG VÀ DỮ LIỆU CHĂM SÓC DÂY CHUYỀN
    if (deletedUserRole !== 'vet_doctor') {
      const allPets = snapshot.pets || [];
      const ownerPets = allPets.filter(p => String(p.ownerId).trim() === cleanId);
      const deleteIds = new Set(ownerPets.map(p => p.id));

      // 1. Xóa hồ sơ thú cưng
      const remainingPets = allPets.filter(p => String(p.ownerId).trim() !== cleanId);
      
      // Gỡ bỏ quyền chia sẻ của tài khoản này trên thú cưng của CHỦ NUÔI KHÁC (bảo toàn thú cưng người khác)
      remainingPets.forEach(p => {
        if (Array.isArray(p.sharedWithUserIds) && p.sharedWithUserIds.includes(cleanId)) {
          p.sharedWithUserIds = p.sharedWithUserIds.filter(id => id !== cleanId);
        }
      });
      setStored(STORAGE_KEYS.PETS, remainingPets);

      // 2. Xóa lịch chăm sóc
      const schedules = snapshot.schedules || [];
      const remainingSchedules = schedules.filter(s => 
        !deleteIds.has(s.petId) && String(s.ownerId).trim() !== cleanId
      );
      setStored(STORAGE_KEYS.SCHEDULES, remainingSchedules);

      // 3. Xóa chi tiêu
      const expenses = snapshot.expenses || [];
      const remainingExpenses = expenses.filter(e => 
        !deleteIds.has(e.petId) && String(e.ownerId).trim() !== cleanId
      );
      setStored(STORAGE_KEYS.EXPENSES, remainingExpenses);

      // 4. Xóa nhật ký hàng ngày
      const dailyLogs = snapshot.dailyLogs || [];
      const remainingDailyLogs = dailyLogs.filter(l => 
        !deleteIds.has(l.petId) && String(l.ownerId).trim() !== cleanId
      );
      setStored(STORAGE_KEYS.DAILY_LOGS, remainingDailyLogs);

      // 5. Xóa đơn thuốc
      const prescriptions = snapshot.prescriptions || [];
      const remainingPrescriptions = prescriptions.filter(pr => 
        !deleteIds.has(pr.petId) && String(pr.ownerId).trim() !== cleanId
      );
      setStored(STORAGE_KEYS.PRESCRIPTIONS, remainingPrescriptions);

      // 6. Xóa thói quen hàng ngày
      const dailyHabits = snapshot.dailyHabits || [];
      const remainingHabits = dailyHabits.filter(h => 
        !deleteIds.has(h.petId) && String(h.ownerId).trim() !== cleanId
      );
      setStored(STORAGE_KEYS.DAILY_HABITS, remainingHabits);

      // 7. Xóa thành viên gia đình
      const familyMembers = snapshot.familyMembers || [];
      const remainingFamily = familyMembers.filter(m => String(m.ownerId).trim() !== cleanId);
      setStored(STORAGE_KEYS.FAMILY_MEMBERS, remainingFamily);

      // 8. Xóa dữ liệu thất lạc
      const lostModes = snapshot.lostModes || {};
      if (typeof lostModes === 'object' && !Array.isArray(lostModes)) {
        const updatedLost = { ...lostModes };
        deleteIds.forEach(id => delete updatedLost[id]);
        setStored(STORAGE_KEYS.LOST_MODES, updatedLost);
      }

      // 9. Xóa lịch hẹn khám của các thú cưng bị xóa
      const appointments = snapshot.appointments || [];
      const remainingAppts = appointments.filter(a => !deleteIds.has(a.petId));
      setStored(STORAGE_KEYS.APPOINTMENTS, remainingAppts);

      // 10. Dọn dẹp dữ liệu cân nặng/sức khỏe
      if (snapshot.healthData && typeof snapshot.healthData === 'object') {
        const updatedHealth = { ...snapshot.healthData };
        ownerPets.forEach(p => {
          const k1 = normalizePetHealthKey(p.id);
          const k2 = normalizePetHealthKey(p.name);
          delete updatedHealth[k1];
          delete updatedHealth[k2];
        });
        setStored(PETS_HEALTH_STORAGE_KEY, updatedHealth);
      }

    } else {
      // NẾU LÀ TÀI KHOẢN BÁC SĨ THÚ Y: CHỈ THU HỒI TÀI KHOẢN VÀ PHÂN CÔNG, KHÔNG XÓA THÚ CƯNG CỦA CHỦ NUÔI
      const allPets = snapshot.pets || [];
      let petsChanged = false;
      const updatedPets = allPets.map(p => {
        let changed = false;
        const copy = { ...p };
        if (copy.assignedVetId && String(copy.assignedVetId).trim() === cleanId) {
          copy.assignedVetId = null;
          changed = true;
        }
        if (Array.isArray(copy.sharedWithVetIds) && copy.sharedWithVetIds.some(id => String(id).trim() === cleanId)) {
          copy.sharedWithVetIds = copy.sharedWithVetIds.filter(id => String(id).trim() !== cleanId);
          changed = true;
        }
        if (changed) {
          petsChanged = true;
          return copy;
        }
        return p;
      });
      if (petsChanged) setStored(STORAGE_KEYS.PETS, updatedPets);

      // Thu hồi phân công bác sĩ trong lịch hẹn
      const appointments = snapshot.appointments || [];
      let apptsChanged = false;
      const updatedAppts = appointments.map(a => {
        if (String(a.assignedVetId).trim() === cleanId) {
          apptsChanged = true;
          return { ...a, assignedVetId: null, vetDeleted: true };
        }
        return a;
      });
      if (apptsChanged) setStored(STORAGE_KEYS.APPOINTMENTS, updatedAppts);
    }
  } catch (txError) {
    // Transaction Rollback nếu có lỗi: khôi phục nguyên trạng để không để lại trạng thái xóa dở dang
    console.error('Lỗi transaction khi xóa tài khoản, khôi phục snapshot:', txError);
    if (snapshot.pets !== null) setStored(STORAGE_KEYS.PETS, snapshot.pets);
    if (snapshot.schedules !== null) setStored(STORAGE_KEYS.SCHEDULES, snapshot.schedules);
    if (snapshot.expenses !== null) setStored(STORAGE_KEYS.EXPENSES, snapshot.expenses);
    if (snapshot.dailyLogs !== null) setStored(STORAGE_KEYS.DAILY_LOGS, snapshot.dailyLogs);
    if (snapshot.prescriptions !== null) setStored(STORAGE_KEYS.PRESCRIPTIONS, snapshot.prescriptions);
    if (snapshot.familyMembers !== null) setStored(STORAGE_KEYS.FAMILY_MEMBERS, snapshot.familyMembers);
    if (snapshot.dailyHabits !== null) setStored(STORAGE_KEYS.DAILY_HABITS, snapshot.dailyHabits);
    if (snapshot.lostModes !== null) setStored(STORAGE_KEYS.LOST_MODES, snapshot.lostModes);
    if (snapshot.appointments !== null) setStored(STORAGE_KEYS.APPOINTMENTS, snapshot.appointments);
    if (snapshot.healthData !== null) setStored(PETS_HEALTH_STORAGE_KEY, snapshot.healthData);
    throw txError;
  }

  // 11. Thu hồi phiên đăng nhập nếu tài khoản bị xóa trùng với phiên hiện hành
  try {
    const activeUser = localStorage.getItem('petcare_active_user');
    const currentUser = localStorage.getItem('petcare_current_user');
    const checkSession = (str) => {
      if (!str) return false;
      try {
        const u = JSON.parse(str);
        return String(u?.id).trim() === cleanId;
      } catch {
        return false;
      }
    };

    if (checkSession(activeUser) || checkSession(currentUser)) {
      localStorage.removeItem('petcare_active_user');
      localStorage.removeItem('petcare_current_user');
      localStorage.removeItem('petcare_is_authenticated');
      localStorage.removeItem('petcare_auth_session_v1');
    }
  } catch (err) {
    console.error('Lỗi khi thu hồi phiên đăng nhập:', err);
  }

  // Kích hoạt sự kiện toàn cục để Dashboard và danh sách đồng bộ ngay
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('petcare_data_cleaned', { detail: { deletedUserId: cleanId } }));
  }
};

// Giữ bí danh tương thích ngược
export const handleUserDeletedDataRetention = handleUserDeletedCascade;

/**
 * KIỂM TRA & RÀ SOÁT TẤT CẢ HỒ SƠ THÚ CƯNG TRONG HỆ THỐNG (AUDIT PETS)
 * Phân loại minh bạch:
 * 1. confirmedDeletedOwnerPets: Chắc chắn thuộc tài khoản đã xóa (cần dọn dẹp)
 * 2. unclearOwnerPets: Thiếu hoặc không rõ ownerId (báo riêng để xử lý, không đoán rồi xóa)
 * 3. activeOwnerPets: Thuộc tài khoản còn tồn tại (bảo vệ tuyệt đối)
 */
export const auditOrphanedPets = () => {
  const allPets = getStored(STORAGE_KEYS.PETS, []) || [];
  const users = getStored('petcare_auth_users_v1', []) || [];
  const deletedUsers = getStored('petcare_deleted_users_v1', []) || [];

  const allActiveUserIds = new Set(
    users.map(u => String(u.id).trim())
  );
  const deletedUserIds = new Set(
    deletedUsers.map(d => String(d.id).trim())
  );
  const deletedEmails = new Set(
    deletedUsers.map(d => (d.email || '').toLowerCase().trim())
  );

  const confirmedDeletedOwnerPets = [];
  const activeOwnerPets = [];
  const unclearOwnerPets = [];

  allPets.forEach(pet => {
    const rawOwnerId = pet.ownerId ? String(pet.ownerId).trim() : '';

    // 1. Hồ sơ thiếu hoặc không rõ ownerId
    if (!rawOwnerId || rawOwnerId === 'undefined' || rawOwnerId === 'null') {
      unclearOwnerPets.push({
        ...pet,
        auditReason: 'Hồ sơ thiếu hoặc không có trường ownerId (cần xử lý riêng)'
      });
      return;
    }

    // 2. Chủ sở hữu còn tồn tại trong hệ thống
    if (allActiveUserIds.has(rawOwnerId)) {
      activeOwnerPets.push(pet);
      return;
    }

    // 3. Chủ sở hữu xác định chắc chắn đã bị xóa
    const isExplicitlyMarked = Boolean(pet.isOwnerDeleted || pet.ownerDeleted);
    const isKnownDeletedId = deletedUserIds.has(rawOwnerId);
    const isKnownDeletedEmail = pet.ownerEmail && deletedEmails.has(pet.ownerEmail.toLowerCase().trim());
    const isOwnerNotActive = !allActiveUserIds.has(rawOwnerId);

    if (isExplicitlyMarked || isKnownDeletedId || isKnownDeletedEmail || isOwnerNotActive) {
      const isSample = Boolean(pet.isSample);

      confirmedDeletedOwnerPets.push({
        ...pet,
        isSample,
        auditReason: isExplicitlyMarked
          ? 'Đã được đánh dấu chủ sở hữu bị xóa'
          : isKnownDeletedId
          ? `Chủ sở hữu (${rawOwnerId}) nằm trong danh sách tài khoản đã xóa`
          : `Chủ sở hữu (${rawOwnerId}) không còn tồn tại trong danh sách tài khoản hệ thống`
      });
      return;
    }

    // Không rõ trạng thái
    unclearOwnerPets.push({
      ...pet,
      auditReason: `Không rõ trạng thái chủ sở hữu (${rawOwnerId})`
    });
  });

  return {
    totalPets: allPets.length,
    confirmedDeletedOwnerPets,
    activeOwnerPets,
    unclearOwnerPets
  };
};

/**
 * THAO TÁC: DỌN DỮ LIỆU CỦA TÀI KHOẢN ĐÃ XÓA
 * Xóa dứt điểm các hồ sơ thú cưng và dữ liệu chăm sóc gắn với tài khoản đã xóa.
 * Không tự xóa hồ sơ thuộc tài khoản còn tồn tại hoặc hồ sơ thiếu ownerId.
 */
export const cleanupDeletedOwnersPets = (selectedPetIds = null) => {
  const audit = auditOrphanedPets();
  const targetPets = Array.isArray(selectedPetIds)
    ? audit.confirmedDeletedOwnerPets.filter(p => selectedPetIds.includes(p.id))
    : audit.confirmedDeletedOwnerPets;

  if (targetPets.length === 0) {
    return { success: true, count: 0, message: 'Không có hồ sơ nào của tài khoản đã xóa cần dọn dẹp.' };
  }

  const deleteIds = new Set(targetPets.map(p => p.id));
  const deleteOwnerIds = new Set(targetPets.map(p => String(p.ownerId).trim()).filter(Boolean));

  // Snapshot phục vụ Transaction Rollback
  const snapshot = {
    pets: getStored(STORAGE_KEYS.PETS, null),
    schedules: getStored(STORAGE_KEYS.SCHEDULES, null),
    expenses: getStored(STORAGE_KEYS.EXPENSES, null),
    dailyLogs: getStored(STORAGE_KEYS.DAILY_LOGS, null),
    prescriptions: getStored(STORAGE_KEYS.PRESCRIPTIONS, null),
    familyMembers: getStored(STORAGE_KEYS.FAMILY_MEMBERS, null),
    dailyHabits: getStored(STORAGE_KEYS.DAILY_HABITS, null),
    lostModes: getStored(STORAGE_KEYS.LOST_MODES, null),
    appointments: getStored(STORAGE_KEYS.APPOINTMENTS, null),
    healthData: getStored(PETS_HEALTH_STORAGE_KEY, null)
  };

  let remainingPetsCount = 0;

  try {
    // 1. Xóa hồ sơ thú cưng
    const allPets = snapshot.pets || [];
    const remainingPets = allPets.filter(p => !deleteIds.has(p.id));
    setStored(STORAGE_KEYS.PETS, remainingPets);
    remainingPetsCount = remainingPets.length;

    // 2. Xóa lịch chăm sóc
    const schedules = snapshot.schedules || [];
    const remainingSchedules = schedules.filter(s => 
      !deleteIds.has(s.petId) && (!s.ownerId || !deleteOwnerIds.has(String(s.ownerId).trim()))
    );
    setStored(STORAGE_KEYS.SCHEDULES, remainingSchedules);

    // 3. Xóa chi tiêu
    const expenses = snapshot.expenses || [];
    const remainingExpenses = expenses.filter(e => 
      !deleteIds.has(e.petId) && (!e.ownerId || !deleteOwnerIds.has(String(e.ownerId).trim()))
    );
    setStored(STORAGE_KEYS.EXPENSES, remainingExpenses);

    // 4. Xóa nhật ký hàng ngày
    const dailyLogs = snapshot.dailyLogs || [];
    const remainingDailyLogs = dailyLogs.filter(l => 
      !deleteIds.has(l.petId) && (!l.ownerId || !deleteOwnerIds.has(String(l.ownerId).trim()))
    );
    setStored(STORAGE_KEYS.DAILY_LOGS, remainingDailyLogs);

    // 5. Xóa đơn thuốc
    const prescriptions = snapshot.prescriptions || [];
    const remainingPrescriptions = prescriptions.filter(pr => 
      !deleteIds.has(pr.petId) && (!pr.ownerId || !deleteOwnerIds.has(String(pr.ownerId).trim()))
    );
    setStored(STORAGE_KEYS.PRESCRIPTIONS, remainingPrescriptions);

    // 6. Xóa thói quen hàng ngày
    const dailyHabits = snapshot.dailyHabits || [];
    const remainingHabits = dailyHabits.filter(h => 
      !deleteIds.has(h.petId) && (!h.ownerId || !deleteOwnerIds.has(String(h.ownerId).trim()))
    );
    setStored(STORAGE_KEYS.DAILY_HABITS, remainingHabits);

    // 7. Xóa thành viên gia đình
    const familyMembers = snapshot.familyMembers || [];
    const remainingFamily = familyMembers.filter(m => 
      !m.ownerId || !deleteOwnerIds.has(String(m.ownerId).trim())
    );
    setStored(STORAGE_KEYS.FAMILY_MEMBERS, remainingFamily);

    // 8. Xóa dữ liệu thất lạc
    const lostModes = snapshot.lostModes || {};
    if (typeof lostModes === 'object' && !Array.isArray(lostModes)) {
      const updatedLost = { ...lostModes };
      deleteIds.forEach(id => delete updatedLost[id]);
      setStored(STORAGE_KEYS.LOST_MODES, updatedLost);
    }

    // 9. Xóa lịch hẹn khám
    const appointments = snapshot.appointments || [];
    const remainingAppts = appointments.filter(a => !deleteIds.has(a.petId));
    setStored(STORAGE_KEYS.APPOINTMENTS, remainingAppts);

    // 10. Dọn dẹp dữ liệu cân nặng/sức khỏe
    if (snapshot.healthData && typeof snapshot.healthData === 'object') {
      const updatedHealth = { ...snapshot.healthData };
      targetPets.forEach(p => {
        const k1 = normalizePetHealthKey(p.id);
        const k2 = normalizePetHealthKey(p.name);
        delete updatedHealth[k1];
        delete updatedHealth[k2];
      });
      setStored(PETS_HEALTH_STORAGE_KEY, updatedHealth);
    }
  } catch (err) {
    console.error('Lỗi transaction khi dọn dẹp dữ liệu, khôi phục snapshot:', err);
    if (snapshot.pets !== null) setStored(STORAGE_KEYS.PETS, snapshot.pets);
    if (snapshot.schedules !== null) setStored(STORAGE_KEYS.SCHEDULES, snapshot.schedules);
    if (snapshot.expenses !== null) setStored(STORAGE_KEYS.EXPENSES, snapshot.expenses);
    if (snapshot.dailyLogs !== null) setStored(STORAGE_KEYS.DAILY_LOGS, snapshot.dailyLogs);
    if (snapshot.prescriptions !== null) setStored(STORAGE_KEYS.PRESCRIPTIONS, snapshot.prescriptions);
    if (snapshot.familyMembers !== null) setStored(STORAGE_KEYS.FAMILY_MEMBERS, snapshot.familyMembers);
    if (snapshot.dailyHabits !== null) setStored(STORAGE_KEYS.DAILY_HABITS, snapshot.dailyHabits);
    if (snapshot.lostModes !== null) setStored(STORAGE_KEYS.LOST_MODES, snapshot.lostModes);
    if (snapshot.appointments !== null) setStored(STORAGE_KEYS.APPOINTMENTS, snapshot.appointments);
    if (snapshot.healthData !== null) setStored(PETS_HEALTH_STORAGE_KEY, snapshot.healthData);
    throw err;
  }

  // Thông báo sự kiện toàn cục để Dashboard và danh sách tự cập nhật
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('petcare_data_cleaned', { detail: { count: targetPets.length } }));
  }

  return {
    success: true,
    count: targetPets.length,
    remainingCount: remainingPetsCount,
    message: `Đã dọn sạch ${targetPets.length} hồ sơ thú cưng của tài khoản đã xóa.`
  };
};

export const addPet = async (pet, autoGenerateSchedule = false, userId = null) => {
  const newPet = { ...pet, name: pet.name.trim(), weight: Number(pet.weight) || null };
  const res = await apiCreate('pets', newPet);
  await syncAllDataToCache();
  return res;
};

export const updatePet = async (updatedPet, userId = null, userRole = null) => {
  const res = await apiUpdate('pets', updatedPet.id, updatedPet);
  await syncAllDataToCache();
  return res;
};

export const deletePet = async (petId, userId = null, userRole = null) => {
  await apiDelete('pets', petId);
  await syncAllDataToCache();
  return getPets();
};

// ----------------- SCHEDULES -----------------
export const getSchedules = (userId = null, userRole = null) => {
  let allSchedules = getStored(STORAGE_KEYS.SCHEDULES, null);

  if (!Array.isArray(allSchedules)) {
    allSchedules = [];
    setStored(STORAGE_KEYS.SCHEDULES, allSchedules);
  }

  // Dọn đúng các bản ghi do test script của agent tạo dựa trên tiền tố ID xác định (không xóa theo từ khóa tên)
  const isAgentTestId = (id) => {
    if (!id || typeof id !== 'string') return false;
    return id.startsWith('sch-type-test-') ||
           id.startsWith('sch-invalid-type-') ||
           id.startsWith('sch-missing-type-') ||
           id.startsWith('sch-repeat-test-') ||
           id === 'sch-rollback-test';
  };

  const hasAgentArtifacts = allSchedules.some(s => isAgentTestId(s.id));
  if (hasAgentArtifacts) {
    allSchedules = allSchedules.filter(s => !isAgentTestId(s.id));
    setStored(STORAGE_KEYS.SCHEDULES, allSchedules);
  }

  if (!userId || userRole === 'system_admin') return allSchedules;

  // Lấy danh sách thú cưng mà user này có quyền truy cập
  const authorizedPets = getPets(userId, userRole);
  const authorizedPetIds = new Set(authorizedPets.map(p => p.id));

  // Lọc lịch trình thuộc về thú cưng của user hoặc do user tạo trực tiếp
  return allSchedules.filter(s => (s.petId && authorizedPetIds.has(s.petId)) || String(s.ownerId).trim() === String(userId).trim());
};

export const saveSchedules = (schedules) => {
  setStored(STORAGE_KEYS.SCHEDULES, schedules);
  return schedules;
};

export const addSchedule = async (schedule, userId = null) => {
  const res = await apiCreate('schedules', schedule);
  await syncAllDataToCache();
  return res;
};

export const addBatchSchedules = async (newSchedulesList, userId = null) => {
  const schedules = getStored(STORAGE_KEYS.SCHEDULES, []);
  let targetOwnerId = userId;
  if (!targetOwnerId) {
    try {
      const activeUser = getStored('petcare_active_user', null) || getStored('petcare_current_user', null);
      if (activeUser?.id) targetOwnerId = activeUser.id;
    } catch {}
  }
  if (!targetOwnerId) {
    console.warn('addBatchSchedules: Không xác định được ownerId, bỏ qua.');
    return [];
  }
  const prepared = [];

  for (let i = 0; i < newSchedulesList.length; i++) {
    const item = newSchedulesList[i];
    // Chống trùng lặp khi áp dụng nhiều lần: kiểm tra petId, title, date
    const isDuplicate = schedules.some(s =>
      s.petId === item.petId &&
      s.title === item.title &&
      s.date === item.date &&
      !s.completed
    );
    if (!isDuplicate) {
      const newSch = {
        ...item,
        id: item.id || `sch-${Date.now()}-${i}`,
        ownerId: item.ownerId || targetOwnerId,
        completed: false,
        createdAt: new Date().toISOString()
      };
      prepared.push(newSch);
      await apiCreate('schedules', newSch);
    }
  }

  await syncAllDataToCache();
  return getSchedules(targetOwnerId);
};

export const updateSchedule = async (updatedSchedule, userId = null, userRole = null) => {
  const res = await apiUpdate('schedules', updatedSchedule.id, updatedSchedule);
  await syncAllDataToCache();
  return res;
};

export const toggleScheduleComplete = async (scheduleId, userId = null, userRole = null) => {
  const schedules = getStored(STORAGE_KEYS.SCHEDULES, []);
  const currentSchedule = schedules.find(s => s.id === scheduleId);
  if (currentSchedule && userRole !== 'system_admin' && userId && currentSchedule.ownerId && currentSchedule.ownerId !== userId) {
    throw new Error('Bạn không có quyền thay đổi trạng thái lịch trình của người dùng khác.');
  }

  // Toàn bộ nghiệp vụ (cập nhật trạng thái + tạo lịch tiếp theo) được thực hiện trong 1 giao dịch duy nhất ở backend
  const res = await apiFetch(`/schedules/${scheduleId}/toggle-complete`, 'POST');
  await syncAllDataToCache();
  return res?.updatedSchedule || res;
};


export const deleteSchedule = async (scheduleId, userId = null, userRole = null) => {
  const schedules = getStored(STORAGE_KEYS.SCHEDULES, []);
  const target = schedules.find(s => s.id === scheduleId);
  if (!target) return schedules;

  if (userRole !== 'system_admin' && userId && target.ownerId && target.ownerId !== userId) {
    const permErr = new Error('Bạn không có quyền xóa lịch trình của người dùng khác.');
    permErr.status = 403;
    permErr.code = 'FORBIDDEN_NOT_OWNER';
    throw permErr;
  }

  try {
    await apiDelete('schedules', scheduleId);
    await syncAllDataToCache();
    return getSchedules(userId, userRole);
  } catch (err) {
    if (err.status === 404 || err.code === 'NOT_FOUND' || (err.message && err.message.includes('không tồn tại'))) {
      // Backend xác nhận bản ghi không còn tồn tại:
      // Tải lại nguồn dữ liệu có thẩm quyền và loại bỏ thẻ cũ khỏi cache
      const cleanList = schedules.filter(s => s.id !== scheduleId);
      setStored(STORAGE_KEYS.SCHEDULES, cleanList);
      try {
        await syncAllDataToCache();
      } catch {}
      const notFoundErr = new Error('Lịch này không còn tồn tại, danh sách đã được cập nhật.');
      notFoundErr.status = 404;
      notFoundErr.code = 'NOT_FOUND';
      notFoundErr.isGhostCleaned = true;
      throw notFoundErr;
    }
    // Lỗi mạng, 403 hoặc 500: Ném nguyên vẹn, không dọn dẹp cache và không giả thành công
    throw err;
  }
};

// ----------------- EXPENSES -----------------
export const getExpenses = (userId = null, userRole = null) => {
  const data = getStored(STORAGE_KEYS.EXPENSES, null);
  let allExpenses = data;

  if (!Array.isArray(allExpenses)) {
    allExpenses = [];
    setStored(STORAGE_KEYS.EXPENSES, allExpenses);
  }

  // Đảm bảo mọi khoản chi đều có trường petName trực tiếp (tra cứu từ danh sách pets thực tế)
  let hasUpdate = false;
  const allPetsForLookup = getStored(STORAGE_KEYS.PETS, []) || [];
  const enriched = allExpenses.map(exp => {
    const isShared = !exp.petId || exp.petId === 'shared' || exp.petId === 'all' || exp.petId === 'none';
    if (isShared && exp.petName !== 'Dùng chung') {
      hasUpdate = true;
      return { ...exp, petId: 'shared', petName: 'Dùng chung' };
    }
    if (!exp.petName && exp.petId && !isShared) {
      hasUpdate = true;
      const foundPet = allPetsForLookup.find(p => p.id === exp.petId);
      return { ...exp, petName: foundPet?.name || 'Thú cưng' };
    }
    return exp;
  });
  if (hasUpdate) {
    setStored(STORAGE_KEYS.EXPENSES, enriched);
    allExpenses = enriched;
  }

  if (!userId || userRole === 'system_admin') return allExpenses;

  // Lấy các thú cưng của user để lọc các khoản chi thuộc về petId của user hoặc do user tạo
  const authorizedPets = getPets(userId, userRole);
  const authorizedPetIds = new Set(authorizedPets.map(p => p.id));

  return allExpenses.filter(e => {
    const isOwner = String(e.ownerId || '').trim() === String(userId).trim();
    if (isOwner) return true;
    const isShared = !e.petId || e.petId === 'shared' || e.petId === 'all' || e.petId === 'none';
    if (e.petId && !isShared && authorizedPetIds.has(e.petId)) return true;
    return false;
  });
};

export const saveExpenses = (expenses) => {
  setStored(STORAGE_KEYS.EXPENSES, expenses);
  return expenses;
};

export const isSharedExpense = (petId) => {
  return !petId || petId === 'shared' || petId === 'all' || petId === 'none';
};

export const addExpense = async (expense, userId = null) => {
  let targetOwnerId = userId || expense.ownerId || null;
  if (!targetOwnerId) {
    try {
      const activeUser = getStored('petcare_active_user', null) || getStored('petcare_current_user', null);
      if (activeUser?.id) targetOwnerId = activeUser.id;
    } catch {}
  }

  const numericAmount = Number(expense.amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error('Số tiền chi tiêu phải lớn hơn 0.');
  }
  if (!expense.title || !expense.title.trim()) {
    throw new Error('Tiêu đề chi tiêu là bắt buộc.');
  }
  if (!expense.date) {
    throw new Error('Ngày chi tiêu là bắt buộc.');
  }

  const isShared = isSharedExpense(expense.petId);
  let finalPetId = 'shared';
  let defaultPetName = 'Dùng chung';

  if (!isShared) {
    // Nếu gắn với một pet cụ thể, kiểm tra pet đó thuộc quyền sở hữu của chủ nuôi
    const userPets = getPets(targetOwnerId);
    const foundPet = userPets.find(p => p.id === expense.petId);
    if (!foundPet) {
      throw new Error('Thú cưng được chọn không thuộc quyền quản lý của bạn.');
    }
    finalPetId = expense.petId;
    defaultPetName = expense.petName || foundPet.name || 'Thú cưng';
  }

  const newExp = {
    ...expense,
    title: expense.title.trim(),
    id: expense.id || `exp-${Date.now()}`,
    ownerId: targetOwnerId,
    petId: finalPetId,
    petName: defaultPetName,
    amount: numericAmount,
    date: expense.date || getLocalDateString(),
    createdAt: new Date().toISOString()
  };
  
  const res = await apiCreate('expenses', newExp);
  await syncAllDataToCache();
  return res || newExp;
};

export const updateExpense = async (id, updates, userId = null) => {
  let targetOwnerId = userId || updates?.ownerId || null;
  if (!targetOwnerId) {
    try {
      const activeUser = getStored('petcare_active_user', null) || getStored('petcare_current_user', null);
      if (activeUser?.id) targetOwnerId = activeUser.id;
    } catch {}
  }

  const cleanUpdates = { ...updates };

  if (cleanUpdates.title !== undefined) {
    if (!cleanUpdates.title || typeof cleanUpdates.title !== 'string' || !cleanUpdates.title.trim()) {
      throw new Error('Tên khoản chi tiêu không được để trống hoặc chỉ chứa khoảng trắng.');
    }
    cleanUpdates.title = cleanUpdates.title.trim();
  }

  if (cleanUpdates.amount !== undefined) {
    const amt = Number(cleanUpdates.amount);
    if (isNaN(amt) || amt <= 0) {
      throw new Error('Số tiền chi tiêu phải lớn hơn 0.');
    }
    cleanUpdates.amount = amt;
  }

  if (cleanUpdates.petId !== undefined) {
    const isShared = isSharedExpense(cleanUpdates.petId);
    if (isShared) {
      cleanUpdates.petId = 'shared';
      cleanUpdates.petName = 'Dùng chung';
    } else {
      if (targetOwnerId) {
        const userPets = getPets(targetOwnerId);
        const foundPet = userPets.find(p => p.id === cleanUpdates.petId);
        if (!foundPet) {
          throw new Error('Thú cưng được chọn không thuộc quyền quản lý của bạn.');
        }
        cleanUpdates.petName = cleanUpdates.petName || foundPet.name || 'Thú cưng';
      }
    }
  }

  const res = await apiUpdate('expenses', id, cleanUpdates);
  await syncAllDataToCache();
  return res;
};

export const deleteExpense = async (id, userId = null, userRole = null) => {
  await apiDelete('expenses', id);
  await syncAllDataToCache();
  return getExpenses(userId, userRole);
};

// ----------------- BUDGETS (NGÂN SÁCH THÁNG/PHẠM VI) -----------------
export const getBudgets = (userId = null) => {
  const data = getStored(STORAGE_KEYS.BUDGETS, []);
  if (!Array.isArray(data)) return [];
  if (!userId) return data;
  return data.filter(b => String(b.ownerId || '').trim() === String(userId).trim());
};

export const saveBudgets = (budgets) => {
  setStored(STORAGE_KEYS.BUDGETS, budgets);
  return budgets;
};

export const addBudget = async (budget, userId = null) => {
  let targetOwnerId = userId || budget.ownerId || null;
  if (!targetOwnerId) {
    try {
      const activeUser = getStored('petcare_active_user', null) || getStored('petcare_current_user', null);
      if (activeUser?.id) targetOwnerId = activeUser.id;
    } catch {}
  }
  const numericAmount = Math.round(Number(budget.amount));
  if (isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error('Số tiền ngân sách phải là số nguyên dương lớn hơn 0 VND.');
  }

  const newBudget = {
    ...budget,
    id: budget.id || `bg-${Date.now()}`,
    ownerId: targetOwnerId,
    amount: numericAmount,
    createdAt: new Date().toISOString()
  };

  const res = await apiCreate('budgets', newBudget);
  try {
    await syncAllDataToCache();
  } catch (syncErr) {
    console.warn('[Budgets] Đã lưu thành công nhưng sync cache gặp cảnh báo nhẹ:', syncErr);
  }
  return res || newBudget;
};

export const updateBudget = async (id, updates) => {
  const payload = { ...updates };
  if (payload.amount !== undefined) {
    payload.amount = Math.round(Number(payload.amount));
  }
  const res = await apiUpdate('budgets', id, payload);
  try {
    await syncAllDataToCache();
  } catch (syncErr) {
    console.warn('[Budgets] Đã cập nhật thành công nhưng sync cache gặp cảnh báo nhẹ:', syncErr);
  }
  return res;
};

export const deleteBudget = async (id, userId = null) => {
  await apiDelete('budgets', id);
  try {
    await syncAllDataToCache();
  } catch (syncErr) {
    console.warn('[Budgets] Đã xóa thành công nhưng sync cache gặp cảnh báo nhẹ:', syncErr);
  }
  return getBudgets(userId);
};

// ----------------- DAILY LOGS -----------------
export const getDailyLogs = (userId = null, userRole = null) => {
  const data = getStored(STORAGE_KEYS.DAILY_LOGS, null);
  let allLogs = data;

  if (!Array.isArray(allLogs)) {
    allLogs = [];
    setStored(STORAGE_KEYS.DAILY_LOGS, allLogs);
  }

  if (!userId || userRole === 'system_admin') return allLogs;

  const authorizedPets = getPets(userId, userRole);
  const authorizedPetIds = new Set(authorizedPets.map(p => p.id));
  return allLogs.filter(l => l.ownerId === userId || (l.petId && authorizedPetIds.has(l.petId)));
};

export const saveDailyLogs = (logs) => {
  setStored(STORAGE_KEYS.DAILY_LOGS, logs);
  return logs;
};

export const addDailyLog = async (log, userId = null) => {
  const res = await apiCreate('daily_logs', log);
  try { await syncAllDataToCache(); } catch (_) {}
  return res;
};

export const updateDailyLog = async (id, updates, userId = null) => {
  const res = await apiUpdate('daily_logs', id, updates);
  try { await syncAllDataToCache(); } catch (_) {}
  return res;
};

export const deleteDailyLog = async (id, userId = null) => {
  const res = await apiDelete('daily_logs', id);
  try { await syncAllDataToCache(); } catch (_) {}
  return res;
};

// ----------------- PRESCRIPTIONS -----------------
export const getPrescriptions = (userId = null, userRole = null) => {
  const data = getStored(STORAGE_KEYS.PRESCRIPTIONS, null);
  let allPrescriptions = data;

  if (!Array.isArray(allPrescriptions)) {
    allPrescriptions = [];
    setStored(STORAGE_KEYS.PRESCRIPTIONS, allPrescriptions);
  }

  if (!userId || userRole === 'system_admin') return allPrescriptions;

  if (userRole === 'vet_doctor') {
    const authorizedPets = getPets(userId, userRole);
    const authorizedPetIds = new Set(authorizedPets.map(p => p.id));
    return allPrescriptions.filter(p => (p.petId && authorizedPetIds.has(p.petId)) || p.prescribedByVetId === userId);
  }

  const authorizedPets = getPets(userId, userRole);
  const authorizedPetIds = new Set(authorizedPets.map(p => p.id));
  return allPrescriptions.filter(p => 
    (p.ownerId === userId || (p.petId && authorizedPetIds.has(p.petId))) &&
    (p.isFinal === true && p.status === 'published')
  );
};

export const savePrescriptions = (prescriptions) => {
  setStored(STORAGE_KEYS.PRESCRIPTIONS, prescriptions);
  return prescriptions;
};

export const addPrescription = async (pres, userId = null) => {
  const res = await apiCreate('prescriptions', pres);
  await syncAllDataToCache();
  return res;
};

export const deletePrescription = async (id, userId = null, userRole = null) => {
  await apiDelete('prescriptions', id);
  await syncAllDataToCache();
  return getPrescriptions();
};

// ----------------- FAMILY MEMBERS (Co-Parenting) -----------------
export const getFamilyMembers = (userId = null, userRole = null) => {
  const data = getStored(STORAGE_KEYS.FAMILY_MEMBERS, null);
  let allMembers = data;

  if (!Array.isArray(allMembers)) {
    allMembers = [];
    setStored(STORAGE_KEYS.FAMILY_MEMBERS, allMembers);
  }

  if (!userId || userRole === 'system_admin') return allMembers;
  return allMembers.filter(m => m.ownerId === userId);
};

export const saveFamilyMembers = (members) => {
  setStored(STORAGE_KEYS.FAMILY_MEMBERS, members);
  return members;
};

export const addFamilyMember = async (member, userId = null) => {
  const res = await apiCreate('family_members', member);
  await syncAllDataToCache();
  return res;
};

export const deleteFamilyMember = async (id, userId = null, userRole = null) => {
  await apiDelete('family_members', id);
  await syncAllDataToCache();
  return getFamilyMembers();
};

// ----------------- DAILY HABITS & STREAK -----------------
export const getDailyHabits = (userId = null, userRole = null) => {
  const data = getStored(STORAGE_KEYS.DAILY_HABITS, null);
  let habits = data;
  if (!Array.isArray(habits)) {
    habits = [];
    setStored(STORAGE_KEYS.DAILY_HABITS, habits);
  }

  // Reset completion theo từng ngày địa phương thực tế và tính streak thực tế
  const todayStr = getLocalDateString();
  const normalizedHabits = habits.map(h => {
    const completedDates = Array.isArray(h.completedDates) ? h.completedDates : (h.lastCompletedDate ? [h.lastCompletedDate] : []);
    const isCompletedToday = h.lastCompletedDate === todayStr || completedDates.includes(todayStr);
    const realStreak = calculateStreak(completedDates);
    return {
      ...h,
      completed: isCompletedToday,
      streak: realStreak,
      completedDates
    };
  });

  if (!userId || userRole === 'system_admin') return normalizedHabits;
  return normalizedHabits.filter(h => h.ownerId === userId);
};

export const saveDailyHabits = (habits) => {
  setStored(STORAGE_KEYS.DAILY_HABITS, habits);
  return habits;
};

export const toggleHabit = async (habitId, memberName = 'Bạn', userId = null) => {
  const habits = getStored(STORAGE_KEYS.DAILY_HABITS, []);
  const index = habits.findIndex(h => h.id === habitId);
  if (index === -1) return null;

  const currentHabit = habits[index];
  if (userId && currentHabit.ownerId && currentHabit.ownerId !== userId) {
    throw new Error('Bạn không có quyền cập nhật thói quen của tài khoản khác.');
  }

  const todayStr = getLocalDateString();
  let completedDates = Array.isArray(currentHabit.completedDates) 
    ? [...currentHabit.completedDates] 
    : (currentHabit.lastCompletedDate ? [currentHabit.lastCompletedDate] : []);
  
  const isCurrentlyCompleted = currentHabit.lastCompletedDate === todayStr || completedDates.includes(todayStr);
  const isNowCompleted = !isCurrentlyCompleted;

  if (isNowCompleted) {
    if (!completedDates.includes(todayStr)) {
      completedDates.push(todayStr);
    }
  } else {
    completedDates = completedDates.filter(d => d !== todayStr);
  }

  const updatedStreak = calculateStreak(completedDates);

  const updatedHabit = {
    ...currentHabit,
    completed: isNowCompleted,
    lastCompletedDate: isNowCompleted ? todayStr : (completedDates[completedDates.length - 1] || null),
    completedDates: completedDates,
    completedBy: isNowCompleted ? memberName : null,
    completedAt: isNowCompleted ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
    streak: updatedStreak
  };

  await apiUpdate('daily_habits', habitId, updatedHabit);
  await syncAllDataToCache();
  return updatedHabit;
};

export const addDailyHabit = async (habit, userId = null) => {
  const res = await apiCreate('daily_habits', habit);
  await syncAllDataToCache();
  return res;
};

export const deleteDailyHabit = async (id, userId = null, userRole = null) => {
  await apiDelete('daily_habits', id);
  await syncAllDataToCache();
  return getDailyHabits();
};

export const toggleDailyHabit = toggleHabit;

// ----------------- LOST MODE (Báo mất & Quản lý Thất Lạc) -----------------
export const getLostModes = () => {
  return getStored(STORAGE_KEYS.LOST_MODES, {});
};

export const setLostMode = (petId, isLost, details = {}) => {
  const modes = getLostModes();
  modes[petId] = {
    isLost: Boolean(isLost),
    lostDate: isLost ? (details.lostDate || getTodayVnDate()) : null,
    contactPhone: details.contactPhone || '0912 345 678',
    reward: details.reward || '2.000.000 đ',
    lastSeenLocation: details.lastSeenLocation || 'Khu vực gần nhà',
    notes: details.notes || 'Bé rất nhút nhát, có thể gọi tên bé để tiếp cận nhẹ nhàng.',
    gpsAlerts: modes[petId]?.gpsAlerts || []
  };
  setStored(STORAGE_KEYS.LOST_MODES, modes);
  return modes[petId];
};

export const updatePetLostMode = (petId, lostData = {}) => {
  // Update in pets array
  const pets = getPets();
  const index = pets.findIndex(p => p.id === petId);
  if (index !== -1) {
    pets[index] = {
      ...pets[index],
      lostMode: {
        ...pets[index].lostMode,
        ...lostData
      }
    };
    savePets(pets);
  }
  // Also sync in lost modes store
  setLostMode(petId, lostData.isLost, lostData);
  return pets[index] || null;
};

export const addGpsScanAlert = (petId, coords, phone = '') => {
  const modes = getLostModes();
  if (!modes[petId]) modes[petId] = { isLost: true, gpsAlerts: [] };
  if (!modes[petId].gpsAlerts) modes[petId].gpsAlerts = [];

  modes[petId].gpsAlerts.unshift({
    id: `alert-${Date.now()}`,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }),
    coords: coords || '21.0285° N, 105.8542° E (Hà Nội)',
    finderPhone: phone || 'Người lạ vừa quét mã vòng cổ'
  });

  setStored(STORAGE_KEYS.LOST_MODES, modes);
  return modes[petId];
};

// ----------------- AUTOMATED 3-WAY OCR PIPELINE -----------------
export const applyOcrAutoPipeline = (ocrData, petId, userId = null) => {
  if (!ocrData || !petId) {
    throw new Error('Thiếu dữ liệu OCR hoặc mã thú cưng');
  }

  const results = { scheduleAdded: null, prescriptionsAdded: [], expenseAdded: null };
  const targetOwnerId = userId || 'user_owner_demo';

  // Chuẩn hóa tên trường thống nhất giữa OCR và hệ thống lưu trữ:
  // Lịch hẹn: nextVisitDate || nextDueDate || followUpDate
  const followUpDate = ocrData.nextVisitDate || ocrData.nextDueDate || ocrData.followUpDate;
  // Ngày lập: issueDate || treatmentDate || injectedDate
  const issueDate = ocrData.issueDate || ocrData.treatmentDate || ocrData.injectedDate || getLocalDateString();
  // Chi phí: totalAmount || cost
  const totalAmount = Number(ocrData.totalAmount ?? ocrData.cost ?? 0);
  // Phòng khám & bác sĩ
  const clinic = ocrData.clinicName || ocrData.vetClinic || 'Phòng khám thú y';
  const doctor = ocrData.doctorName || ocrData.vetDoctor || 'Bác sĩ thú y';

  // 1. Tự động thêm Lịch tái khám / Tiêm nhắc lại nếu có ngày hẹn
  if (followUpDate) {
    const title = ocrData.vaccineName
      ? `Tiêm nhắc lại: ${ocrData.vaccineName}`
      : (ocrData.diagnosis ? `Tái khám: ${ocrData.diagnosis}` : 'Tái khám sức khỏe định kỳ');

    // Chống tạo lịch trùng lặp khi bấm áp dụng nhiều lần
    const existingSchedules = getSchedules(targetOwnerId);
    const isDupSchedule = existingSchedules.some(s => 
      s.petId === petId && 
      s.date === followUpDate && 
      s.title === title && 
      !s.completed
    );

    if (!isDupSchedule) {
      results.scheduleAdded = addSchedule({
        petId: petId,
        title: title,
        type: ocrData.vaccineName ? 'vaccine' : 'treatment',
        date: followUpDate,
        time: '09:00',
        location: clinic,
        notes: `Trích xuất từ hồ sơ y tế ngày ${issueDate}. Bác sĩ phụ trách: ${doctor}.`
      }, targetOwnerId);
    }
  }

  // 2. Tự động thêm Đơn thuốc vào Y Bạ
  const medicinesList = Array.isArray(ocrData.medicines) && ocrData.medicines.length > 0
    ? ocrData.medicines
    : (ocrData.medicineName ? [{ name: ocrData.medicineName, dosage: ocrData.dosage || 'Theo chỉ định bác sĩ' }] : []);

  if (medicinesList.length > 0) {
    const existingPrescriptions = getPrescriptions(targetOwnerId);
    medicinesList.forEach((med, mIdx) => {
      const medName = med.name || med.medicineName || 'Thuốc điều trị';
      const isDupMed = existingPrescriptions.some(p => 
        p.petId === petId && 
        p.medicineName === medName && 
        p.startDate === issueDate
      );

      if (!isDupMed) {
        const addedPres = addPrescription({
          petId: petId,
          medicineName: medName,
          dosage: med.dosage || ocrData.dosage || 'Theo chỉ định bác sĩ',
          startDate: issueDate,
          durationDays: Number(med.durationDays || ocrData.durationDays) || 7,
          prescribedBy: doctor,
          purpose: ocrData.diagnosis || 'Điều trị theo toa phòng khám',
          notes: `Cơ sở: ${clinic}. Đơn thuốc trích xuất từ chứng từ y tế.`
        }, targetOwnerId);
        results.prescriptionsAdded.push(addedPres);
      }
    });
  }

  // 3. Tự động ghi nhận Chi tiêu nếu có số tiền > 0
  if (totalAmount > 0) {
    const existingExpenses = getExpenses(targetOwnerId);
    const expTitle = `Chi phí y tế: ${ocrData.vaccineName || ocrData.diagnosis || 'Khám chữa bệnh'}`;
    const isDupExpense = existingExpenses.some(e => 
      e.petId === petId && 
      e.date === issueDate && 
      Number(e.amount) === totalAmount && 
      e.title === expTitle
    );

    if (!isDupExpense) {
      results.expenseAdded = addExpense({
        petId: petId,
        category: ocrData.vaccineName ? 'vaccine' : 'medical',
        title: expTitle,
        amount: totalAmount,
        date: issueDate,
        notes: `Hóa đơn tại ${clinic}. Bác sĩ phụ trách: ${doctor}.`
      }, targetOwnerId);
    }
  }

  return results;
};

// ----------------- THEME (Dark / Light) -----------------
export const getTheme = () => {
  try {
    const saved = localStorage.getItem('petcare_theme') || localStorage.getItem(STORAGE_KEYS.THEME);
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'dark';
  } catch {
    return 'dark';
  }
};

export const setTheme = (theme) => {
  try {
    localStorage.setItem('petcare_theme', theme);
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      const body = document.body;
      if (theme === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
        body?.classList.add('dark');
        body?.classList.remove('light');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.remove('dark');
        root.classList.add('light');
        body?.classList.remove('dark');
        body?.classList.add('light');
        root.style.colorScheme = 'light';
      }
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('petcare_theme_changed', { detail: theme }));
    }
  } catch (e) {
    console.error('Error setting theme:', e);
  }
  return theme;
};

// ----------------- EXPORT iCALENDAR (.ics) -----------------
// (Đã được import và re-export chuẩn hóa theo Asia/Ho_Chi_Minh từ dateUtils.js)


// ----------------- SETTINGS & BACKUP -----------------
export const getSettings = () => {
  const settings = getStored(STORAGE_KEYS.SETTINGS, {
    clinicPhone: '1900 6868',
    soundEnabled: true,
    omniChannel: {
      webPush: true,
      telegramBotToken: '',
      telegramChatId: '',
      zaloZnsPhone: ''
    }
  });

  // Loại bỏ hoàn toàn cấu hình cũ của Gemini
  delete settings.geminiApiKey;
  delete settings.selectedModel;

  return settings;
};

export const saveSettings = (newSettings) => {
  const current = getSettings();
  const merged = { ...current, ...newSettings };
  delete merged.geminiApiKey;
  delete merged.selectedModel;
  
  if (typeof window !== 'undefined') {
    localStorage.removeItem('petcare_gemini_api_key');
    localStorage.removeItem('gemini_api_key');
    localStorage.removeItem('geminiApiKey');
  }

  setStored(STORAGE_KEYS.SETTINGS, merged);
  return merged;
};

// ----------------- PERSONAL BACKUP & RESTORE (SCOPED TO CURRENT USER) -----------------
export const exportUserData = (userId) => {
  if (!userId) throw new Error('Cần định danh tài khoản để xuất dữ liệu cá nhân.');
  return JSON.stringify({
    format: 'petcare_user_backup_v1',
    exportDate: new Date().toISOString(),
    userId,
    pets: getPets(userId, 'pet_owner'),
    schedules: getSchedules(userId, 'pet_owner'),
    expenses: getExpenses(userId, 'pet_owner'),
    dailyLogs: getDailyLogs(userId, 'pet_owner'),
    prescriptions: getPrescriptions(userId, 'pet_owner'),
    familyMembers: getFamilyMembers(userId, 'pet_owner'),
    dailyHabits: getDailyHabits(userId, 'pet_owner')
  }, null, 2);
};

export const importUserData = (jsonString, userId) => {
  if (!userId) throw new Error('Cần định danh tài khoản để nhập dữ liệu.');
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') {
      return { success: false, message: 'Định dạng file không hợp lệ (yêu cầu JSON object)!' };
    }

    // Kiểm tra cấu trúc cơ bản
    const dataSources = parsed.data || parsed;
    
    // 1. Nhập thú cưng: Gán triệt để ownerId = userId để tránh chèn dữ liệu chéo
    if (Array.isArray(dataSources.pets)) {
      const sanitizedPets = dataSources.pets.map(p => ({
        ...p,
        id: p.id || `pet-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        ownerId: userId
      }));
      // Giữ lại thú cưng của các user khác, thay thế thú cưng của user này
      const allPets = getStored(STORAGE_KEYS.PETS, []).filter(p => p.ownerId !== userId);
      savePets([...sanitizedPets, ...allPets]);
    }

    // 2. Nhập lịch trình
    if (Array.isArray(dataSources.schedules)) {
      const sanitizedSchedules = dataSources.schedules.map(s => ({
        ...s,
        id: s.id || `sch-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        ownerId: userId
      }));
      const allSchedules = getStored(STORAGE_KEYS.SCHEDULES, []).filter(s => s.ownerId !== userId);
      saveSchedules([...sanitizedSchedules, ...allSchedules]);
    }

    // 3. Nhập chi tiêu
    if (Array.isArray(dataSources.expenses)) {
      const sanitizedExpenses = dataSources.expenses.map(e => ({
        ...e,
        id: e.id || `exp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        ownerId: userId
      }));
      const allExpenses = getStored(STORAGE_KEYS.EXPENSES, []).filter(e => e.ownerId !== userId);
      saveExpenses([...sanitizedExpenses, ...allExpenses]);
    }

    // 4. Nhập nhật ký
    if (Array.isArray(dataSources.dailyLogs)) {
      const sanitizedLogs = dataSources.dailyLogs.map(l => ({
        ...l,
        id: l.id || `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        ownerId: userId
      }));
      const allLogs = getStored(STORAGE_KEYS.DAILY_LOGS, []).filter(l => l.ownerId !== userId);
      saveDailyLogs([...sanitizedLogs, ...allLogs]);
    }

    // 5. Nhập đơn thuốc
    if (Array.isArray(dataSources.prescriptions)) {
      const sanitizedPres = dataSources.prescriptions.map(p => ({
        ...p,
        id: p.id || `pres-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        ownerId: userId
      }));
      const allPres = getStored(STORAGE_KEYS.PRESCRIPTIONS, []).filter(p => p.ownerId !== userId);
      savePrescriptions([...sanitizedPres, ...allPres]);
    }

    // 6. Nhập thành viên gia đình
    if (Array.isArray(dataSources.familyMembers)) {
      const sanitizedFamily = dataSources.familyMembers.map(m => ({
        ...m,
        id: m.id || `mem-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        ownerId: userId
      }));
      const allMembers = getStored(STORAGE_KEYS.FAMILY_MEMBERS, []).filter(m => m.ownerId !== userId);
      saveFamilyMembers([...sanitizedFamily, ...allMembers]);
    }

    // 7. Nhập thói quen
    if (Array.isArray(dataSources.dailyHabits)) {
      const sanitizedHabits = dataSources.dailyHabits.map(h => ({
        ...h,
        id: h.id || `habit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        ownerId: userId
      }));
      const allHabits = getStored(STORAGE_KEYS.DAILY_HABITS, []).filter(h => h.ownerId !== userId);
      saveDailyHabits([...sanitizedHabits, ...allHabits]);
    }

    return { success: true, message: 'Nhập dữ liệu cá nhân thành công!' };
  } catch (error) {
    return { success: false, message: `Lỗi đọc file: ${error.message}` };
  }
};

export const resetUserData = (userId) => {
  if (!userId) return;
  // CHẶN BẢO MẬT: Tuyệt đối KHÔNG dùng localStorage.clear()
  // Chỉ xóa dữ liệu thuộc về chính userId này
  const pets = getStored(STORAGE_KEYS.PETS, []).filter(p => p.ownerId !== userId);
  savePets(pets);
  const schedules = getStored(STORAGE_KEYS.SCHEDULES, []).filter(s => s.ownerId !== userId);
  saveSchedules(schedules);
  const expenses = getStored(STORAGE_KEYS.EXPENSES, []).filter(e => e.ownerId !== userId);
  saveExpenses(expenses);
  const dailyLogs = getStored(STORAGE_KEYS.DAILY_LOGS, []).filter(l => l.ownerId !== userId);
  saveDailyLogs(dailyLogs);
  const prescriptions = getStored(STORAGE_KEYS.PRESCRIPTIONS, []).filter(p => p.ownerId !== userId);
  savePrescriptions(prescriptions);
  const familyMembers = getStored(STORAGE_KEYS.FAMILY_MEMBERS, []).filter(m => m.ownerId !== userId);
  saveFamilyMembers(familyMembers);
  const dailyHabits = getStored(STORAGE_KEYS.DAILY_HABITS, []).filter(h => h.ownerId !== userId);
  saveDailyHabits(dailyHabits);
};

// ----------------- SYSTEM ADMIN BACKUP & RESTORE (BACKEND SYNC) -----------------
export const exportSystemData = async () => {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('petcare_auth_token') : null;
  const res = await fetch('/api/backup/export', {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Lỗi khi xuất bản sao lưu từ máy chủ.');
  }
  const data = await res.json();
  return JSON.stringify(data.backup, null, 2);
};

export const importSystemData = async (jsonString) => {
  try {
    const backupData = JSON.parse(jsonString);
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('petcare_auth_token') : null;
    const res = await fetch('/api/backup/restore', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ backupData })
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok || !result.success) {
      return { success: false, message: result.error || 'Máy chủ từ chối khôi phục dữ liệu.' };
    }
    // Sau khi server khôi phục thành công, đồng bộ lại cache trình duyệt
    await syncAllDataToCache();
    return { success: true, message: result.message || 'Khôi phục toàn hệ thống thành công!' };
  } catch (error) {
    return { success: false, message: `Lỗi phân tích file hệ thống: ${error.message}` };
  }
};

export const resetSystemData = () => {
  // Reset các bảng nghiệp vụ về mẫu ban đầu nhưng BẢO TOÀN toàn bộ tài khoản người dùng và phiên đăng nhập
  savePets([]);
  saveSchedules([]);
  saveExpenses([]);
  saveDailyLogs([]);
  savePrescriptions([]);
  saveFamilyMembers([]);
  saveDailyHabits([]);
  saveActiveAppointments([]);
};

// Giữ tương thích ngược với các component cũ
export const exportAllData = exportSystemData;
export const importAllData = importSystemData;
export const resetToDefaultData = resetSystemData;

// ----------------- VET APPOINTMENTS (ĐẶT LỊCH KHÁM 2 CHIỀU) -----------------
const _getTodayIsoDate = () => new Date().toLocaleDateString('en-CA');
const _getTomorrowIsoDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString('en-CA');
};

export const INITIAL_APPOINTMENTS = [];

export const SHARED_APPOINTMENTS_KEY = 'petcare_shared_appointments';
export const ACTIVE_APPOINTMENTS_KEY = 'petcare_active_appointments';

export const getActiveAppointments = () => {
  let appointments = null;
  try {
    // Luôn ưu tiên khóa chuẩn STORAGE_KEYS.APPOINTMENTS (vừa sync từ backend)
    const canonicalRaw = localStorage.getItem(STORAGE_KEYS.APPOINTMENTS);
    if (canonicalRaw !== null && canonicalRaw !== undefined) {
      appointments = JSON.parse(canonicalRaw);
      // Dọn dẹp an toàn các khóa legacy để tránh bị lệch cache hoặc danh sách rỗng cũ che khuất
      try {
        localStorage.removeItem(SHARED_APPOINTMENTS_KEY);
        localStorage.removeItem(ACTIVE_APPOINTMENTS_KEY);
        localStorage.removeItem('petcare_appointments');
      } catch {}
    } else {
      // Nếu chưa có khóa canonical, tìm trong các khóa cũ, migrate sang canonical và dọn dẹp
      const legacyRaw = localStorage.getItem(SHARED_APPOINTMENTS_KEY) || 
                        localStorage.getItem(ACTIVE_APPOINTMENTS_KEY) || 
                        localStorage.getItem('petcare_appointments');
      if (legacyRaw) {
        appointments = JSON.parse(legacyRaw);
        localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(appointments));
        try {
          localStorage.removeItem(SHARED_APPOINTMENTS_KEY);
          localStorage.removeItem(ACTIVE_APPOINTMENTS_KEY);
          localStorage.removeItem('petcare_appointments');
        } catch {}
      }
    }
  } catch (e) {
    console.error('Error reading active appointments:', e);
  }

  // Danh sách rỗng hoặc null là trạng thái hoàn toàn hợp lệ - KHÔNG khôi phục dữ liệu mẫu
  if (!Array.isArray(appointments)) {
    appointments = [];
  }

  if (appointments.length > 0) {
    // Dedup đơn giản theo ID và signature, không nhắm vào tên cố định
    let hasNormalization = false;
    const seenIds = new Set();
    const seenSignatures = new Set();
    const cleanList = [];
    const todayDateStr = _getTodayIsoDate();

    for (const a of appointments) {
      if (!a) continue;
      const pName = String(a.petName || '').toLowerCase().trim();
      const srv = String(a.service || a.title || '').toLowerCase().trim();
      const d = String(a.date || '').split('T')[0];
      const t = String(a.time || '').trim();

      const idKey = a.id ? String(a.id) : null;
      const sigKey = `${pName}__${d}__${t}__${srv}`;

      if ((idKey && seenIds.has(idKey)) || seenSignatures.has(sigKey)) {
        hasNormalization = true;
        continue;
      }

      if (idKey) seenIds.add(idKey);
      seenSignatures.add(sigKey);
      cleanList.push(a);
    }

    // Chuẩn hóa trạng thái (pending, in_progress, overdue, completed):
    appointments = cleanList.map(a => {
      let updatedItem = { ...a };
      const s = String(a.status || '').toLowerCase().trim();
      const aDate = a.date ? String(a.date).split('T')[0] : '';
      const isDone = Boolean(a.completed) || s === 'completed' || s === 'hoàn thành' || s === 'đã khám';

      if (isDone) {
        updatedItem.status = 'completed';
        updatedItem.completed = true;
      } else if (s === 'cancelled' || s === 'đã hủy') {
        updatedItem.status = 'cancelled';
      } else if (s === 'confirmed' || s === 'đã xác nhận') {
        updatedItem.status = 'confirmed';
      } else if (s === 'chờ tiếp nhận' || s === 'chờ duyệt' || !a.status || s === 'pending') {
        updatedItem.status = 'pending';
      } else if (s === 'đang khám' || s === 'đã duyệt' || s === 'in_progress') {
        updatedItem.status = 'in_progress';
      }

      return updatedItem;
    });

    if (hasNormalization) {
      saveActiveAppointments(appointments);
    }
  }

  return appointments;
};

export const saveActiveAppointments = (appointments) => {
  try {
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(appointments));
    localStorage.setItem(SHARED_APPOINTMENTS_KEY, JSON.stringify(appointments));
    localStorage.setItem(ACTIVE_APPOINTMENTS_KEY, JSON.stringify(appointments));
    localStorage.setItem('petcare_appointments', JSON.stringify(appointments));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('petcare_appointments_updated', { detail: appointments }));
    }
  } catch (e) {
    console.error('Error saving active appointments:', e);
  }
  return appointments;
};

export const getAppointments = (userId = null, userRole = null) => {
  const all = getActiveAppointments();
  if (!userId || userRole === 'system_admin') return all;
  if (userRole === 'vet_doctor') {
    // Bác sĩ chỉ xem được các ca được phân công trực tiếp cho mình qua assignedVetId hoặc vetId
    return all.filter(a => 
      String(a.assignedVetId || '').trim() === String(userId).trim() ||
      String(a.vetId || '').trim() === String(userId).trim()
    );
  }
  // Chủ nuôi chỉ xem lịch hẹn của chính mình, lọc bằng ownerId thực tế
  return all.filter(a => String(a.ownerId || '').trim() === String(userId).trim());
};
export const saveAppointments = saveActiveAppointments;

export const assignAppointmentDoctor = async (appointmentId, vetId, vetName = '') => {
  const res = await apiFetch(`/appointments/${appointmentId}/assign-vet`, 'POST', {
    vetId,
    assignedVetId: vetId,
    assignedVet: vetName
  });
  await syncAllDataToCache();
  return res?.data || res;
};

export const fetchActiveDoctors = async (facilityId = null) => {
  try {
    const q = facilityId ? `?facilityId=${encodeURIComponent(facilityId)}` : '';
    const res = await apiFetch(`/doctors${q}`);
    if (res && res.success && Array.isArray(res.data)) {
      return res.data;
    }
    // Fallback gọi trực tiếp /api/doctors nếu apiFetch gặp sự cố
    const directRes = await fetch(`/api/doctors${q}`);
    const directData = await directRes.json().catch(() => null);
    if (directRes.ok && directData?.success && Array.isArray(directData?.data)) {
      return directData.data;
    }
    return [];
  } catch (err) {
    console.warn('[Storage] Lỗi tải danh sách bác sĩ từ máy chủ:', err.message);
    return [];
  }
};

export const fetchAvailableAppointmentSlots = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.facility) query.append('facility', params.facility);
  if (params.facilityId) query.append('facilityId', params.facilityId);
  if (params.doctor) query.append('doctor', params.doctor);
  if (params.doctorId) query.append('doctorId', params.doctorId);
  if (params.date) query.append('date', params.date);
  if (params.petId) query.append('petId', params.petId);

  return await apiFetch(`/appointments/available-slots?${query.toString()}`);
};

export const addActiveAppointment = async (appointmentData, userId = null) => {
  let targetOwnerId = userId || appointmentData.ownerId || null;
  if (!targetOwnerId) {
    try {
      const activeUser = getStored('petcare_active_user', null) || getStored('petcare_current_user', null);
      if (activeUser?.id) targetOwnerId = activeUser.id;
    } catch {}
  }
  const newAppointment = {
    id: appointmentData.id || `BK-${Date.now()}`,
    ownerId: targetOwnerId,
    petId: appointmentData.petId || '',
    petName: appointmentData.petName || 'Thú cưng',
    petType: appointmentData.petType || 'Chưa rõ loài',
    ownerName: appointmentData.ownerName || 'Chủ nuôi',
    phone: appointmentData.phone || '',
    service: appointmentData.service || 'Khám tổng quát định kỳ',
    facility: appointmentData.facility || 'Bệnh viện Thú y 2Vet Hospital',
    facilityId: appointmentData.facilityId || appointmentData.clinicId || '2vet',
    clinicId: appointmentData.clinicId || appointmentData.facilityId || '2vet',
    assignedVetId: appointmentData.assignedVetId || null,
    assignedVet: appointmentData.assignedVet || 'Cơ sở phân công',
    date: appointmentData.date || getTodayVnDate(),
    time: appointmentData.time || '08:30',
    note: appointmentData.note || '',
    status: 'pending', // Luôn ở trạng thái Chờ xác nhận
    adminNote: '',
    isEmergency: Boolean(appointmentData.isEmergency || (appointmentData.service || '').includes('Cấp cứu')),
    createdAt: new Date().toISOString()
  };

  const res = await apiCreate('appointments', newAppointment);

  // Bảo vệ: Nếu backend đã lưu thành công nhưng syncAllDataToCache gặp sự cố nhỏ
  // KHÔNG được ném lỗi khiến người dùng tưởng lưu thất bại và ấn đặt trùng!
  try {
    await syncAllDataToCache();
  } catch (syncErr) {
    console.warn('[Appointment] Lưu thành công nhưng sync cache gặp lỗi nhẹ:', syncErr);
    return { ...(res || newAppointment), _syncWarning: true };
  }

  return res || newAppointment;
};

export const addAppointment = addActiveAppointment;

export const updateAppointment = async (appointmentId, updates) => {
  const res = await apiUpdate('appointments', appointmentId, updates);
  const updatedRecord = (res && typeof res === 'object') ? res : { id: appointmentId, ...updates };

  // Cập nhật ngay lập tức vào bộ nhớ đệm localStorage để tránh đọc lại dữ liệu cũ khi sync bị throttle
  try {
    const currentRaw = localStorage.getItem(STORAGE_KEYS.APPOINTMENTS);
    let list = currentRaw ? JSON.parse(currentRaw) : [];
    if (Array.isArray(list)) {
      const idx = list.findIndex(a => a && (a.id === appointmentId || String(a.id).trim() === String(appointmentId).trim()));
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...updatedRecord };
      } else {
        list.push(updatedRecord);
      }
      saveActiveAppointments(list);
    }
  } catch (cacheErr) {
    console.warn('Lỗi ghi đè cache cuộc hẹn:', cacheErr);
  }

  // Đồng bộ lại từ máy chủ với cờ force: true để cập nhật toàn diện
  try {
    await syncAllDataToCache({ force: true });
  } catch (syncErr) {
    console.warn('[Appointment] Cập nhật thành công nhưng syncAllDataToCache gặp lỗi nhẹ:', syncErr);
  }

  return updatedRecord;
};

export const updateAppointmentStatus = async (appointmentId, status, extra = {}) => {
  return await updateAppointment(appointmentId, { status, ...extra });
};

export const deleteAppointment = async (appointmentId) => {
  await apiDelete('appointments', appointmentId);
  await syncAllDataToCache();
  return getAppointments();
};

export const archiveAppointment = async (appointmentId) => {
  const res = await apiArchiveAppointment(appointmentId);
  await syncAllDataToCache();
  return res;
};

export const unarchiveAppointment = async (appointmentId) => {
  const res = await apiUnarchiveAppointment(appointmentId);
  await syncAllDataToCache();
  return res;
};

// ----------------- DỊCH TỄ HỌC 2 CHIỀU (EPIDEMIC ALERT) -----------------
export const EPIDEMIC_ALERT_KEY = 'petcare_active_epidemic';

export const getActiveEpidemicAlert = () => {
  try {
    const raw = localStorage.getItem(EPIDEMIC_ALERT_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading epidemic alert:', e);
  }
  // Không có cảnh báo dịch tễ thì trả null, không tự tạo dữ liệu mẫu
  return null;
};

export const saveActiveEpidemicAlert = (alertData) => {
  try {
    localStorage.setItem(EPIDEMIC_ALERT_KEY, JSON.stringify(alertData));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('petcare_epidemic_updated', { detail: alertData }));
    }
  } catch (e) {
    console.error('Error saving epidemic alert:', e);
  }
  return alertData;
};

// ----------------- HEALTH & WEIGHT TRACKER (ĐỒNG BỘ 2 CHIỀU) -----------------
export const PETS_HEALTH_STORAGE_KEY = 'petcare_pets_health_data';
export const WEIGHT_TRACKER_STORAGE_KEY = 'petcare_weight_tracker_histories';

// Hàm chuẩn hóa key sức khỏe: trả về chính petId thực tế, KHÔNG ánh xạ sang mochi/luna/banhbao
export const normalizePetHealthKey = (idOrName) => {
  if (!idOrName) return '';
  return String(idOrName).trim();
};

export const getPetsHealthData = () => {
  try {
    const raw = localStorage.getItem(PETS_HEALTH_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Lỗi đọc pets health data:', err);
  }
  // Không có dữ liệu → trả object rỗng, KHÔNG tạo dữ liệu mẫu
  return {};
};

export const savePetsHealthData = (data, shouldNotify = true) => {
  try {
    localStorage.setItem(PETS_HEALTH_STORAGE_KEY, JSON.stringify(data));

    // Đồng bộ cân nặng vào danh sách PETS (STORAGE_KEYS.PETS) theo petId thực tế
    try {
      const rawPets = localStorage.getItem('petcare_pets_v1');
      if (rawPets) {
        const petsList = JSON.parse(rawPets);
        if (Array.isArray(petsList)) {
          let hasChange = false;
          const updatedPets = petsList.map(p => {
            // Dùng p.id trực tiếp làm key, không ánh xạ qua tên
            const petKey = p.id;
            if (petKey && data[petKey] && data[petKey].weight != null) {
              if (p.weight !== data[petKey].weight) {
                hasChange = true;
                return { ...p, weight: data[petKey].weight };
              }
            }
            return p;
          });
          if (hasChange) {
            localStorage.setItem('petcare_pets_v1', JSON.stringify(updatedPets));
          }
        }
      }
    } catch {}

    // Kích hoạt sự kiện toàn cục để Dashboard và Schedule tự động cập nhật
    if (shouldNotify && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('petcare_weight_updated', { detail: data }));
    }
  } catch (err) {
    console.error('Lỗi lưu pets health data:', err);
  }
  return data;
};

export const updatePetWeight = async (petId, newWeight, note = '') => {
  if (!petId) return getPetsHealthData();
  const key = String(petId).trim();

  // Kiểm tra quyền (ownerId)
  let activeUser = null;
  try {
    activeUser = getStored('petcare_active_user', null) || getStored('petcare_current_user', null);
  } catch {}
  if (activeUser && activeUser.role !== 'system_admin' && activeUser.role !== 'vet_doctor') {
    const userPets = getPets(activeUser.id, activeUser.role);
    if (!userPets.some(p => p.id === key)) {
      console.warn('Unauthorized attempt to update weight for pet:', key);
      return getPetsHealthData();
    }
  }

  const cleanWeight = String(newWeight || '').trim().replace(',', '.');
  const numWeight = parseFloat(cleanWeight);
  if (isNaN(numWeight) || numWeight <= 0) {
    throw new Error('Cân nặng phải là một số dương lớn hơn 0 kg.');
  }

  const todayVn = getTodayVnDate();
  let recordDate = todayVn;
  if (note && typeof note === 'string') {
    const trimmedNote = note.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedNote)) {
      if (!isValidCalendarDate(trimmedNote)) {
        throw new Error(`Ngày ghi nhận cân nặng '${trimmedNote}' không hợp lệ hoặc không tồn tại trên lịch thực tế (định dạng YYYY-MM-DD).`);
      }
      if (trimmedNote > todayVn) {
        throw new Error(`Ngày ghi nhận cân nặng (${trimmedNote}) không được vượt quá hôm nay (${todayVn}) theo giờ Việt Nam.`);
      }
      recordDate = trimmedNote;
    }
  }

  const data = getPetsHealthData();
  const petData = data[key] ? { ...data[key] } : { petId: key, weight: null, weightHistory: [] };

  const history = Array.isArray(petData.weightHistory) ? [...petData.weightHistory] : [];
  const idStr = `w-${Date.now()}`;

  // Luôn THÊM bản ghi mới có ngày đo đầy đủ
  history.push({
    id: idStr,
    weight: numWeight,
    date: recordDate,
    fullDate: new Date().toISOString(),
    note: typeof note === 'string' && !isValidCalendarDate(note) ? note : ''
  });

  // Sắp xếp tăng dần theo ngày ghi nhận
  history.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  // Cân nặng hiện tại lấy từ bản ghi hợp lệ mới nhất theo ngày ghi nhận
  const latestRecord = history[history.length - 1];
  petData.weight = latestRecord ? latestRecord.weight : numWeight;
  petData.weightHistory = history;

  const initialToken = typeof localStorage !== 'undefined' ? (localStorage.getItem('petcare_token') || localStorage.getItem('petcare_auth_token')) : null;
  const initialSessionUser = typeof localStorage !== 'undefined' ? (localStorage.getItem('petcare_active_user') || localStorage.getItem('petcare_current_user')) : null;

  // Lưu lên máy chủ qua endpoint xác thực PUT /api/data/health_data/:petId
  try {
    await apiUpdate('health_data', key, petData);
    await syncAllDataToCache();
  } catch (err) {
    console.error('Lỗi khi lưu cân nặng lên máy chủ:', err);
    throw err;
  }

  const currentToken = typeof localStorage !== 'undefined' ? (localStorage.getItem('petcare_token') || localStorage.getItem('petcare_auth_token')) : null;
  const currentSessionUser = typeof localStorage !== 'undefined' ? (localStorage.getItem('petcare_active_user') || localStorage.getItem('petcare_current_user')) : null;
  if (currentToken && currentToken === initialToken && currentSessionUser === initialSessionUser) {
    data[key] = petData;
    savePetsHealthData(data);
  }
  return data;
};

// ----------------- MIGRATION: KHÔNG TỰ Ý XÓA DỮ LIỆU THEO TÊN/ID PHỎNG ĐOÁN -----------------
// (Đã loại bỏ cơ chế xóa tự động dựa trên tên hoặc ID phỏng đoán để bảo đảm toàn vẹn dữ liệu người dùng)

export const getMedicalRecords = (userId = null, userRole = null) => {
  const all = getStored('petcare_medical_records_v1', []);
  if (!userId || userRole === 'system_admin') return all;
  if (userRole === 'vet_doctor') {
    return all.filter(r => r.authorId === userId || r.vetId === userId);
  }
  const userPets = getStored('petcare_pets_v1', []).filter(p => String(p.ownerId).trim() === String(userId).trim());
  const userPetIds = new Set(userPets.map(p => p.id));
  return all.filter(r => {
    const isOwner = String(r.ownerId).trim() === String(userId).trim() || userPetIds.has(r.petId);
    return isOwner && (r.isFinal === true || r.status === 'published');
  });
};

export const addMedicalRecord = async (record) => {
  const res = await apiCreate('medical_records', record);
  await syncAllDataToCache();
  return res;
};

export const updateMedicalRecord = async (id, updates) => {
  const res = await apiUpdate('medical_records', id, updates);
  await syncAllDataToCache();
  return res;
};

// Nghiệp vụ chốt bệnh án và hoàn thành lịch khám trong cùng 1 giao dịch nguyên tử ở backend
export const finalizeEhrAndAppointment = async ({ appointmentId, petId, soap, notes, recordId }) => {
  const res = await apiFetch('/medical-records/finalize-ehr', 'POST', {
    appointmentId,
    petId,
    soap,
    notes,
    recordId
  });
  let syncSuccess = false;
  try {
    const syncRes = await syncAllDataToCache();
    syncSuccess = (syncRes === true);
  } catch (syncErr) {
    console.warn('[PetCare] syncAllDataToCache warning after finalize-ehr:', syncErr);
    syncSuccess = false;
  }
  return { ...res, success: true, syncWarning: !syncSuccess };
};

export const uploadMedicalDocument = async (fileData, petId) => {
  return await apiFetch('/medical/upload-document', 'POST', { fileData, petId });
};


