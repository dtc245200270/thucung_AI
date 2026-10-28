import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getUsers, saveUsers, hashPassword } from './db.js';
import { getCollectionData, saveCollectionData } from './dataHandler.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, './data');

const ALL_COLLECTIONS = [
  'pets',
  'schedules',
  'expenses',
  'daily_logs',
  'prescriptions',
  'family_members',
  'daily_habits',
  'appointments',
  'medical_records',
  'lost_modes',
  'health_data'
];

/**
 * GET /api/backup/export
 * Xuất toàn bộ dữ liệu hệ thống (Users và tất cả Collections)
 */
router.get('/export', (req, res) => {
  try {
    const rawUsers = getUsers();
    const safeUsers = rawUsers.map(u => {
      const copy = { ...u };
      delete copy.password;
      return copy;
    });

    const backupData = {
      format: 'petcare_system_enterprise_backup_v2',
      version: '2.0',
      exportDate: new Date().toISOString(),
      exportedBy: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name
      },
      users: safeUsers,
      pets: getCollectionData('pets', false),
      schedules: getCollectionData('schedules', false),
      expenses: getCollectionData('expenses', false),
      dailyLogs: getCollectionData('daily_logs', false),
      prescriptions: getCollectionData('prescriptions', false),
      familyMembers: getCollectionData('family_members', false),
      dailyHabits: getCollectionData('daily_habits', false),
      appointments: getCollectionData('appointments', false),
      medicalRecords: getCollectionData('medical_records', false),
      lostModes: getCollectionData('lost_modes', true),
      healthData: getCollectionData('health_data', true),
      stats: {
        usersCount: safeUsers.length,
        petsCount: getCollectionData('pets', false).length,
        appointmentsCount: getCollectionData('appointments', false).length,
        medicalRecordsCount: getCollectionData('medical_records', false).length
      }
    };

    return res.json({ success: true, backup: backupData });
  } catch (error) {
    console.error('Lỗi khi xuất backup hệ thống:', error);
    return res.status(500).json({ success: false, error: 'Lỗi máy chủ khi tạo bản sao lưu: ' + error.message });
  }
});

/**
 * POST /api/backup/restore
 * Khôi phục toàn bộ hệ thống từ bản sao lưu JSON
 * - Kiểm tra cấu trúc schema
 * - Kiểm tra toàn vẹn quan hệ (Relational integrity)
 * - Tạo bản sao lưu dự phòng trước khi ghi
 * - Rollback toàn diện nếu có bất kỳ lỗi nào trong quá trình khôi phục
 */
router.post('/restore', (req, res) => {
  try {
    if (req.headers['x-test-simulate-write-failure'] && process.env.NODE_ENV !== 'test') {
      return res.status(403).json({ success: false, error: 'Mô phỏng lỗi kiểm thử không được phép trên môi trường thực tế.' });
    }

    const data = req.body.backupData || req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ success: false, error: 'Dữ liệu bản sao lưu không hợp lệ hoặc rỗng.' });
    }

    if (data.format !== 'petcare_system_enterprise_backup_v2' && data.format !== 'petcare_system_enterprise_backup_v1') {
      return res.status(400).json({ success: false, error: 'Định dạng bản sao lưu không được hỗ trợ.' });
    }

    // 1. KIỂM TRA CẤU TRÚC KIỂU DỮ LIỆU (TYPE SCHEMA CHECKS)
    const arrayFields = [
      ['pets', data.pets],
      ['schedules', data.schedules],
      ['expenses', data.expenses],
      ['dailyLogs', data.dailyLogs || data.daily_logs],
      ['prescriptions', data.prescriptions],
      ['familyMembers', data.familyMembers || data.family_members],
      ['dailyHabits', data.dailyHabits || data.daily_habits],
      ['appointments', data.appointments],
      ['medicalRecords', data.medicalRecords || data.medical_records]
    ];

    for (const [name, val] of arrayFields) {
      if (val !== undefined && val !== null && !Array.isArray(val)) {
        return res.status(400).json({
          success: false,
          error: `Trường dữ liệu '${name}' phải là một mảng danh sách hợp lệ.`
        });
      }
    }

    if (data.lostModes && typeof data.lostModes !== 'object') {
      return res.status(400).json({ success: false, error: "Trường 'lostModes' phải là đối tượng hợp lệ." });
    }
    if (data.healthData && typeof data.healthData !== 'object') {
      return res.status(400).json({ success: false, error: "Trường 'healthData' phải là đối tượng hợp lệ." });
    }

    // 2. KIỂM TRA TOÀN VẸN QUAN HỆ (RELATIONAL INTEGRITY CHECKS)
    // - Danh sách users nếu có phải chứa ít nhất 1 admin hoạt động
    const currentUsers = getUsers();
    let incomingUsers = Array.isArray(data.users) ? data.users : null;
    if (incomingUsers) {
      const hasActiveAdmin = incomingUsers.some(u => u.role === 'system_admin' && !u.isLocked);
      if (!hasActiveAdmin) {
        return res.status(400).json({
          success: false,
          error: 'Bản sao lưu không chứa Quản trị viên hệ thống (system_admin) đang hoạt động. Khôi phục bị từ chối để tránh khóa hệ thống!'
        });
      }
    }

    const effectiveUsers = incomingUsers || currentUsers;
    const userIds = new Set(effectiveUsers.map(u => String(u.id).trim()));

    // 2.1. Thú cưng: ownerId phải hợp lệ
    const incomingPets = Array.isArray(data.pets) ? data.pets : [];
    for (const p of incomingPets) {
      if (!p.id || !p.name) {
        return res.status(400).json({
          success: false,
          error: `Bản ghi thú cưng không hợp lệ: thiếu ID hoặc Tên thú cưng.`
        });
      }
      if (p.ownerId && !userIds.has(String(p.ownerId).trim())) {
        return res.status(400).json({
          success: false,
          error: `Toàn vẹn quan hệ bị vi phạm: Thú cưng '${p.name}' (${p.id}) gắn với chủ sở hữu không tồn tại (${p.ownerId}).`
        });
      }
    }

    const petIds = new Set(incomingPets.map(p => String(p.id).trim()));

    // 2.2. Lịch chăm sóc: petId và ownerId phải tồn tại
    const incomingSchedules = Array.isArray(data.schedules) ? data.schedules : [];
    for (const s of incomingSchedules) {
      if (s.petId && !petIds.has(String(s.petId).trim())) {
        return res.status(400).json({
          success: false,
          error: `Toàn vẹn quan hệ bị vi phạm: Lịch chăm sóc (${s.id || s.title || 'N/A'}) tham chiếu đến thú cưng không tồn tại (${s.petId}).`
        });
      }
      if (s.ownerId && !userIds.has(String(s.ownerId).trim())) {
        return res.status(400).json({
          success: false,
          error: `Toàn vẹn quan hệ bị vi phạm: Lịch chăm sóc (${s.id || s.title || 'N/A'}) gắn với chủ sở hữu không tồn tại (${s.ownerId}).`
        });
      }
    }

    // 2.3. Lịch hẹn (Appointments): petId, ownerId và assignedVetId phải tồn tại
    const incomingAppointments = Array.isArray(data.appointments) ? data.appointments : [];
    for (const a of incomingAppointments) {
      if (a.petId && !petIds.has(String(a.petId).trim())) {
        return res.status(400).json({
          success: false,
          error: `Toàn vẹn quan hệ bị vi phạm: Lịch hẹn (${a.id || 'N/A'}) tham chiếu đến thú cưng không tồn tại (${a.petId}).`
        });
      }
      if (a.ownerId && !userIds.has(String(a.ownerId).trim())) {
        return res.status(400).json({
          success: false,
          error: `Toàn vẹn quan hệ bị vi phạm: Lịch hẹn (${a.id || 'N/A'}) gắn với chủ sở hữu không tồn tại (${a.ownerId}).`
        });
      }
      if (a.assignedVetId && !userIds.has(String(a.assignedVetId).trim())) {
        return res.status(400).json({
          success: false,
          error: `Toàn vẹn quan hệ bị vi phạm: Lịch hẹn (${a.id || 'N/A'}) phân công bác sĩ không tồn tại (${a.assignedVetId}).`
        });
      }
    }

    // 2.4. Bệnh án: petId phải tồn tại trong danh sách pets
    const incomingMedRecords = Array.isArray(data.medicalRecords || data.medical_records)
      ? (data.medicalRecords || data.medical_records)
      : [];
    for (const mr of incomingMedRecords) {
      if (mr.petId && !petIds.has(String(mr.petId).trim())) {
        return res.status(400).json({
          success: false,
          error: `Toàn vẹn quan hệ bị vi phạm: Bệnh án (${mr.id || 'N/A'}) tham chiếu đến thú cưng không tồn tại (${mr.petId}).`
        });
      }
      if (mr.ownerId && !userIds.has(String(mr.ownerId).trim())) {
        return res.status(400).json({
          success: false,
          error: `Toàn vẹn quan hệ bị vi phạm: Bệnh án (${mr.id || 'N/A'}) gắn với chủ sở hữu không tồn tại (${mr.ownerId}).`
        });
      }
    }

    // 2.5. Đơn thuốc: petId phải tồn tại
    const incomingPrescriptions = Array.isArray(data.prescriptions) ? data.prescriptions : [];
    for (const pr of incomingPrescriptions) {
      if (pr.petId && !petIds.has(String(pr.petId).trim())) {
        return res.status(400).json({
          success: false,
          error: `Toàn vẹn quan hệ bị vi phạm: Đơn thuốc (${pr.id || 'N/A'}) tham chiếu đến thú cưng không tồn tại (${pr.petId}).`
        });
      }
    }

    // 2.6. Chi tiêu: petId nếu có phải tồn tại
    const incomingExpenses = Array.isArray(data.expenses) ? data.expenses : [];
    for (const ex of incomingExpenses) {
      if (ex.petId && !petIds.has(String(ex.petId).trim())) {
        return res.status(400).json({
          success: false,
          error: `Toàn vẹn quan hệ bị vi phạm: Khoản chi tiêu (${ex.id || 'N/A'}) tham chiếu đến thú cưng không tồn tại (${ex.petId}).`
        });
      }
      if (ex.ownerId && !userIds.has(String(ex.ownerId).trim())) {
        return res.status(400).json({
          success: false,
          error: `Toàn vẹn quan hệ bị vi phạm: Khoản chi tiêu (${ex.id || 'N/A'}) gắn với chủ sở hữu không tồn tại (${ex.ownerId}).`
        });
      }
    }

    // 2.7. Thói quen và nhật ký: petId phải tồn tại
    const incomingHabits = Array.isArray(data.dailyHabits || data.daily_habits) ? (data.dailyHabits || data.daily_habits) : [];
    for (const h of incomingHabits) {
      if (h.petId && !petIds.has(String(h.petId).trim())) {
        return res.status(400).json({
          success: false,
          error: `Toàn vẹn quan hệ bị vi phạm: Thói quen (${h.id || 'N/A'}) tham chiếu đến thú cưng không tồn tại (${h.petId}).`
        });
      }
    }

    // 2.8. Dữ liệu đối tượng (lostModes, healthData): key phải là petId hợp lệ
    if (data.lostModes && typeof data.lostModes === 'object') {
      for (const k of Object.keys(data.lostModes)) {
        if (!petIds.has(String(k).trim())) {
          return res.status(400).json({
            success: false,
            error: `Toàn vẹn quan hệ bị vi phạm: Chế độ thất lạc tham chiếu đến thú cưng không tồn tại (${k}).`
          });
        }
      }
    }
    if (data.healthData && typeof data.healthData === 'object') {
      for (const k of Object.keys(data.healthData)) {
        const rawPetId = k.replace(/^health_/, '');
        if (!petIds.has(String(rawPetId).trim())) {
          return res.status(400).json({
            success: false,
            error: `Toàn vẹn quan hệ bị vi phạm: Dữ liệu sức khỏe tham chiếu đến thú cưng không tồn tại (${k}).`
          });
        }
      }
    }

    // 3. TẠO BẢN SAO DỰ PHÒNG TRƯỚC KHI THỰC THI (PRE-RESTORE SNAPSHOT)
    const snapshot = {};
    try {
      snapshot['users'] = fs.readFileSync(path.join(DATA_DIR, 'users.json'), 'utf8');
    } catch { snapshot['users'] = '[]'; }

    ALL_COLLECTIONS.forEach(col => {
      try {
        const filePath = path.join(DATA_DIR, `${col}.json`);
        if (fs.existsSync(filePath)) {
          snapshot[col] = fs.readFileSync(filePath, 'utf8');
        } else {
          snapshot[col] = null;
        }
      } catch {
        snapshot[col] = null;
      }
    });

    // 4. ÁP DỤNG KHÔI PHỤC VỚI ROLLBACK TOÀN DIỆN VÀ PHÁT HIỆN MỌI LỖI GHI
    try {
      // Khôi phục users nếu có trong file (bảo lưu mật khẩu của user cũ nếu user mới không cung cấp password)
      if (incomingUsers) {
        const passwordMap = new Map(currentUsers.map(u => [String(u.id).trim(), u.password]));
        const mergedUsers = incomingUsers.map(u => ({
          ...u,
          password: u.password || passwordMap.get(String(u.id).trim()) || hashPassword('User@123456')
        }));
        const ok = saveUsers(mergedUsers);
        if (!ok) throw new Error('Không thể ghi tệp users.json khi khôi phục.');
      }

      const collectionsToSave = [
        ['pets', data.pets],
        ['schedules', data.schedules],
        ['expenses', data.expenses],
        ['daily_logs', data.dailyLogs || data.daily_logs],
        ['prescriptions', data.prescriptions],
        ['family_members', data.familyMembers || data.family_members],
        ['daily_habits', data.dailyHabits || data.daily_habits],
        ['appointments', data.appointments],
        ['medical_records', data.medicalRecords || data.medical_records],
        ['lost_modes', data.lostModes],
        ['health_data', data.healthData]
      ];

      for (const [col, colData] of collectionsToSave) {
        if (colData !== undefined && colData !== null) {
          // Hook kiểm thử: mô phỏng lỗi ghi đĩa giữa chừng để xác minh cơ chế rollback toàn diện (CHỈ BẬT KHI NODE_ENV === 'test')
          if (process.env.NODE_ENV === 'test' && req.headers['x-test-simulate-write-failure'] === col) {
            throw new Error(`Mô phỏng lỗi ghi tệp ${col}.json phục vụ kiểm thử rollback.`);
          }
          const ok = saveCollectionData(col, colData);
          if (!ok) {
            throw new Error(`Không thể ghi tệp dữ liệu ${col}.json khi khôi phục.`);
          }
        }
      }

      return res.json({
        success: true,
        message: 'Khôi phục toàn bộ hệ thống thành công.',
        restoredAt: new Date().toISOString()
      });
    } catch (writeErr) {
      console.error('Lỗi khi ghi dữ liệu khôi phục, thực hiện Rollback khẩn cấp:', writeErr);
      // ROLLBACK TOÀN DIỆN
      const rollbackErrors = [];
      try {
        if (snapshot['users']) {
          try {
            fs.writeFileSync(path.join(DATA_DIR, 'users.json'), snapshot['users'], 'utf8');
          } catch (uErr) {
            rollbackErrors.push(`Lỗi hoàn tác users.json: ${uErr.message}`);
          }
        }
        ALL_COLLECTIONS.forEach(col => {
          const filePath = path.join(DATA_DIR, `${col}.json`);
          try {
            if (snapshot[col] !== null) {
              fs.writeFileSync(filePath, snapshot[col], 'utf8');
            } else if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath); // Dọn dẹp tệp mới sinh ra giữa chừng
            }
          } catch (cErr) {
            rollbackErrors.push(`Lỗi hoàn tác ${col}.json: ${cErr.message}`);
          }
        });
      } catch (rollbackErr) {
        rollbackErrors.push(rollbackErr.message);
      }

      // Không bỏ qua lỗi rollback nếu hoàn tác thất bại
      if (rollbackErrors.length > 0) {
        console.error('Rollback thất bại nghiêm trọng:', rollbackErrors);
        return res.status(500).json({
          success: false,
          error: `Khôi phục thất bại và xảy ra lỗi nghiêm trọng khi Rollback: ${rollbackErrors.join('; ')}`,
          code: 'ROLLBACK_FAILED'
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Khôi phục thất bại giữa chừng. Hệ thống đã tự động Rollback về trạng thái trước đó. Chi tiết: ' + writeErr.message,
        code: 'TRANSACTION_ROLLBACK'
      });
    }
  } catch (error) {
    console.error('Lỗi khi xử lý restore:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
