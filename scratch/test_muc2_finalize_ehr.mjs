import assert from 'assert';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5000/api';
const DATA_DIR = path.resolve('./server/data');

async function apiRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function login(email, password) {
  const res = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email, password }
  });
  if (!res.ok) throw new Error(`Login failed for ${email}: ${JSON.stringify(res.data)}`);
  return res.data.token;
}

function backupFile(filename) {
  const p = path.join(DATA_DIR, filename);
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  return null;
}

function restoreFile(filename, content) {
  const p = path.join(DATA_DIR, filename);
  if (content !== null) {
    fs.writeFileSync(p, content, 'utf8');
  } else if (fs.existsSync(p)) {
    fs.unlinkSync(p);
  }
}

async function runMuc2Tests() {
  console.log('================================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ HỒI QUY: MỤC 2 - CHỐT BỆNH ÁN & HOÀN THÀNH KHÁM');
  console.log('================================================================');

  const appointmentsBackup = backupFile('appointments.json');
  const medicalRecordsBackup = backupFile('medical_records.json');
  const petsBackup = backupFile('pets.json');
  const usersBackup = backupFile('users.json');

  let passed = 0;
  let total = 0;

  async function asyncTest(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
    }
  }

  try {
    // 1. Authenticate users
    const adminToken = await login('admin@petcare.ai', 'Admin@123456');
    const vetRes = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email: 'tester@petcare.ai', password: 'Doctor@123' }
    });
    const vet1Token = vetRes.data.token;
    const vet1Id = vetRes.data.user.id;

    // Tạo thêm vet2 (bác sĩ không được phân công)
    const vet2Email = `vet2_test_${Date.now()}@petcare.ai`;
    await apiRequest('/auth/admin/create-user', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: 'BS. Trần Văn Hai (Vet 2)',
        email: vet2Email,
        phone: '0977888999',
        password: 'Doctor@123456',
        role: 'vet_doctor'
      }
    });
    const vet2Login = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email: vet2Email, password: 'Doctor@123456' }
    });
    const vet2TempToken = vet2Login.data.token;
    const vet2ChangePwd = await apiRequest('/auth/first-login-change-password', {
      method: 'POST',
      headers: { Authorization: `Bearer ${vet2TempToken}` },
      body: { newPassword: 'Doctor@123456_Changed' }
    });
    const vet2Token = vet2ChangePwd.data.token;
    const vet2Id = vet2ChangePwd.data.user.id;

    // Tạo tài khoản chủ nuôi test
    const ownerEmail = `owner_muc2_${Date.now()}@petcare.ai`;
    await apiRequest('/auth/admin/create-user', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: 'Chủ Nuôi Test MỤC 2',
        email: ownerEmail,
        phone: '0988222333',
        password: 'Temp@123456',
        role: 'pet_owner'
      }
    });
    const tempAuth = await login(ownerEmail, 'Temp@123456');
    const changePwdRes = await apiRequest('/auth/first-login-change-password', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tempAuth}` },
      body: { newPassword: 'Owner@123456' }
    });
    const ownerToken = changePwdRes.data.token;
    const ownerId = changePwdRes.data.user.id;

    // Tạo thú cưng chính
    const petAId = `pet-m2-a-${Date.now()}`;
    await apiRequest('/data/pets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: {
        id: petAId,
        name: 'Bé Miu M2',
        species: 'cat',
        breed: 'Anh lông dài'
      }
    });

    // Tạo thú cưng thứ hai (dùng để test sai quan hệ)
    const petBId = `pet-m2-b-${Date.now()}`;
    await apiRequest('/data/pets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: {
        id: petBId,
        name: 'Bé Vàng M2',
        species: 'dog',
        breed: 'Corgi'
      }
    });

    // Admin phân công vet1 cho petA
    await apiRequest(`/data/pets/${petAId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { id: petAId, assignedVetId: vet1Id }
    });

    // Helper tạo lịch hẹn khám (sử dụng thời gian tăng dần để tránh trùng collision check)
    let appTimeCounter = 0;
    async function createAppointment(appId, petId, assignedVetId, status = 'confirmed') {
      appTimeCounter++;
      const hour = String(8 + Math.floor(appTimeCounter / 60)).padStart(2, '0');
      const minute = String(appTimeCounter % 60).padStart(2, '0');
      const day = String((appTimeCounter % 28) + 1).padStart(2, '0');
      const res = await apiRequest('/data/appointments', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: {
          id: appId,
          petId,
          assignedVetId,
          date: `2026-11-${day}`,
          time: `${hour}:${minute}`,
          service: 'Khám chuyên khoa da liễu',
          status
        }
      });
      if (!res.ok) {
        throw new Error(`Failed to create appointment ${appId}: ${JSON.stringify(res.data)}`);
      }
      return res.data;
    }

    // -----------------------------------------------------------------
    // TEST 1: CHỐT BỆNH ÁN THÀNH CÔNG VÀ CHUYỂN LỊCH KHÁM SANG COMPLETED
    // -----------------------------------------------------------------
    await asyncTest('2.1. Chốt bệnh án & chuyển lịch sang completed thành công trong cùng 1 nghiệp vụ backend', async () => {
      const appId = `app-happy-${Date.now()}`;
      await createAppointment(appId, petAId, vet1Id, 'in_progress');

      const finalizeRes = await apiRequest('/data/medical-records/finalize-ehr', {
        method: 'POST',
        headers: { Authorization: `Bearer ${vet1Token}` },
        body: {
          appointmentId: appId,
          petId: petAId,
          soap: {
            subjective: 'Bé ngứa da, rụng lông vùng cổ',
            objective: 'Da đỏ nhẹ, không có mủ',
            assessment: 'Viêm da dị ứng tiếp xúc',
            plan: 'Bôi kem và uống kháng histamin 5 ngày'
          }
        }
      });

      assert.strictEqual(finalizeRes.status, 200, 'Trả về HTTP 200 thành công');
      assert.strictEqual(finalizeRes.data.success, true);
      assert.strictEqual(finalizeRes.data.data.appointment.status, 'completed', 'Lịch khám đã chuyển sang completed');
      assert.ok(finalizeRes.data.data.appointment.completedAt, 'completedAt được ghi nhận');

      const medRecord = finalizeRes.data.data.medicalRecord;
      assert.ok(medRecord, 'Bệnh án đã được tạo');
      assert.strictEqual(medRecord.isFinal, true, 'isFinal là true');
      assert.strictEqual(medRecord.status, 'published', 'status là published');
      assert.strictEqual(medRecord.appointmentId, appId);
      assert.strictEqual(medRecord.petId, petAId);
      assert.strictEqual(medRecord.ownerId, ownerId, 'ownerId được gán đúng chủ nuôi');

      // Kiểm tra trong database: appointments và medical_records đều đã lưu
      const appList = await apiRequest('/data/appointments', { headers: { Authorization: `Bearer ${adminToken}` } });
      const savedApp = appList.data.find(a => a.id === appId);
      assert.strictEqual(savedApp.status, 'completed');

      const medList = await apiRequest('/data/medical_records', { headers: { Authorization: `Bearer ${adminToken}` } });
      const savedMed = medList.data.find(m => m.appointmentId === appId);
      assert.ok(savedMed);
      assert.strictEqual(savedMed.isFinal, true);

      // Chủ nuôi đọc được bệnh án đã công bố (isFinal: true)
      const ownerMedList = await apiRequest('/data/medical_records', { headers: { Authorization: `Bearer ${ownerToken}` } });
      const ownerCanSee = ownerMedList.data.find(m => m.appointmentId === appId);
      assert.ok(ownerCanSee, 'Chủ nuôi đọc được bệnh án đã ký chốt');
    });

    // -----------------------------------------------------------------
    // TEST 2: KIỂM TRA PHÂN QUYỀN (BÁC SĨ ĐƯỢC PHÂN CÔNG VS CHỦ NUÔI / VET KHÁC)
    // -----------------------------------------------------------------
    await asyncTest('2.2. Chủ nuôi không có quyền chốt bệnh án (HTTP 403 Forbidden)', async () => {
      const appId = `app-owner-forbidden-${Date.now()}`;
      await createAppointment(appId, petAId, vet1Id, 'in_progress');

      const res = await apiRequest('/data/medical-records/finalize-ehr', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: {
          appointmentId: appId,
          petId: petAId,
          soap: { subjective: 'Test', assessment: 'Test' }
        }
      });

      assert.strictEqual(res.status, 403, 'Chủ nuôi bị từ chối với 403 Forbidden');
    });

    await asyncTest('2.3. Bác sĩ không được phân công bị từ chối khi cố chốt bệnh án (HTTP 403 Forbidden)', async () => {
      const appId = `app-wrong-vet-${Date.now()}`;
      // Ca khám được giao rõ ràng cho vet1
      await createAppointment(appId, petAId, vet1Id, 'in_progress');

      // vet2 cố chốt bệnh án ca khám này
      const res = await apiRequest('/data/medical-records/finalize-ehr', {
        method: 'POST',
        headers: { Authorization: `Bearer ${vet2Token}` },
        body: {
          appointmentId: appId,
          petId: petAId,
          soap: { subjective: 'Vet 2 cố chốt bệnh án', assessment: 'Lậu' }
        }
      });

      assert.strictEqual(res.status, 403, 'Bác sĩ không được phân công bị từ chối 403');
      assert.strictEqual(res.data.code, 'FORBIDDEN_NOT_ASSIGNED_VET');

      // Kiểm tra trạng thái ca khám KHÔNG bị đổi sang completed
      const appList = await apiRequest('/data/appointments', { headers: { Authorization: `Bearer ${adminToken}` } });
      const currentApp = appList.data.find(a => a.id === appId);
      assert.strictEqual(currentApp.status, 'in_progress', 'Lịch khám vẫn giữ nguyên in_progress');
    });

    // -----------------------------------------------------------------
    // TEST 3: KIỂM TRA QUAN HỆ LỊCH KHÁM – THÚ CƯNG (APPOINTMENTID – PETID)
    // -----------------------------------------------------------------
    await asyncTest('2.4. Sai quan hệ appointmentId–petId bị từ chối (HTTP 400 PET_MISMATCH)', async () => {
      const appId = `app-pet-mismatch-${Date.now()}`;
      // Lịch khám liên kết với petA
      await createAppointment(appId, petAId, vet1Id, 'in_progress');

      // Request gửi lên petB thay vì petA
      const res = await apiRequest('/data/medical-records/finalize-ehr', {
        method: 'POST',
        headers: { Authorization: `Bearer ${vet1Token}` },
        body: {
          appointmentId: appId,
          petId: petBId, // SAI PET ID!
          soap: { subjective: 'Nhầm thú cưng', assessment: 'Nhầm lẫn' }
        }
      });

      assert.strictEqual(res.status, 400, 'Từ chối HTTP 400');
      assert.strictEqual(res.data.code, 'PET_MISMATCH');

      // Kiểm tra database: cả 2 bản ghi không bị thay đổi
      const appList = await apiRequest('/data/appointments', { headers: { Authorization: `Bearer ${adminToken}` } });
      const currentApp = appList.data.find(a => a.id === appId);
      assert.strictEqual(currentApp.status, 'in_progress');

      const medList = await apiRequest('/data/medical_records', { headers: { Authorization: `Bearer ${adminToken}` } });
      const currentMed = medList.data.find(m => m.appointmentId === appId);
      assert.strictEqual(currentMed, undefined, 'Không có bệnh án nào được tạo');
    });

    // -----------------------------------------------------------------
    // TEST 4: KIỂM TRA TRẠNG THÁI HIỆN TẠI (LỊCH ĐÃ HỦY)
    // -----------------------------------------------------------------
    await asyncTest('2.5. Lịch khám đã bị hủy không thể chốt bệnh án (HTTP 400 INVALID_STATUS)', async () => {
      const appId = `app-cancelled-${Date.now()}`;
      await createAppointment(appId, petAId, vet1Id, 'cancelled');

      const res = await apiRequest('/data/medical-records/finalize-ehr', {
        method: 'POST',
        headers: { Authorization: `Bearer ${vet1Token}` },
        body: {
          appointmentId: appId,
          petId: petAId,
          soap: { subjective: 'Ca đã hủy', assessment: 'Không hợp lệ' }
        }
      });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.data.code, 'INVALID_STATUS');
    });

    // -----------------------------------------------------------------
    // TEST 5: LỖI GHI GIỮA CHỪNG & HOÀN TÁC TOÀN BỘ (ATOMIC ROLLBACK)
    // -----------------------------------------------------------------
    await asyncTest('2.6. Lỗi ghi giữa chừng: Hoàn tác toàn bộ, không lưu dở dang bệnh án hay lịch khám', async () => {
      const appId = `app-rollback-${Date.now()}`;
      await createAppointment(appId, petAId, vet1Id, 'in_progress');

      // Mô phỏng ghi appointments thất bại sau khi đã ghi medical_records
      const failRes = await apiRequest('/data/medical-records/finalize-ehr', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${vet1Token}`,
          'x-simulate-save-failure': 'appointments'
        },
        body: {
          appointmentId: appId,
          petId: petAId,
          soap: {
            subjective: 'Ca kiểm thử rollback',
            assessment: 'Không được lưu dở dang'
          }
        }
      });

      assert.strictEqual(failRes.status, 500, 'Trả về lỗi HTTP 500 khi một bước ghi thất bại');
      assert.strictEqual(failRes.data.code, 'TRANSACTION_ROLLBACK');

      // Kiểm tra database trên đĩa:
      // 1. appointments PHẢI GIỮ NGUYÊN trạng thái cũ 'in_progress'
      const appList = await apiRequest('/data/appointments', { headers: { Authorization: `Bearer ${adminToken}` } });
      const appOnDisk = appList.data.find(a => a.id === appId);
      assert.strictEqual(appOnDisk.status, 'in_progress', 'Lịch hẹn giữ nguyên trạng thái cũ');

      // 2. medical_records PHẢI ĐƯỢC ROLLBACK, không có bệnh án isFinal nào được lưu dở dang!
      const medList = await apiRequest('/data/medical_records', { headers: { Authorization: `Bearer ${adminToken}` } });
      const medOnDisk = medList.data.find(m => m.appointmentId === appId);
      assert.strictEqual(medOnDisk, undefined, 'Bệnh án đã được hoàn tác sạch sẽ, không có bản ghi dở dang');
    });

    // -----------------------------------------------------------------
    // TEST 6: CHỐNG CHỐT LẶP & GỬI LẶP REQUEST (IDEMPOTENCY / ANTI-REPLAY)
    // -----------------------------------------------------------------
    await asyncTest('2.7. Gửi lại request sau khi chốt không tạo thêm bản ghi và không gây lỗi', async () => {
      const appId = `app-idempotent-${Date.now()}`;
      await createAppointment(appId, petAId, vet1Id, 'in_progress');

      // Lần 1: chốt thành công
      const res1 = await apiRequest('/data/medical-records/finalize-ehr', {
        method: 'POST',
        headers: { Authorization: `Bearer ${vet1Token}` },
        body: {
          appointmentId: appId,
          petId: petAId,
          soap: { subjective: 'Khám tai', assessment: 'Viêm tai ngoài' }
        }
      });
      assert.strictEqual(res1.status, 200);
      const recordId1 = res1.data.data.medicalRecord.id;

      // Lần 2: gửi lại request y hệt (replay/retry)
      const res2 = await apiRequest('/data/medical-records/finalize-ehr', {
        method: 'POST',
        headers: { Authorization: `Bearer ${vet1Token}` },
        body: {
          appointmentId: appId,
          petId: petAId,
          soap: { subjective: 'Khám tai', assessment: 'Viêm tai ngoài' }
        }
      });
      assert.strictEqual(res2.status, 200, 'Gửi lại request vẫn trả về HTTP 200 an toàn');
      assert.strictEqual(res2.data.data.medicalRecord.id, recordId1, 'Vẫn giữ đúng bản ghi cũ');

      // Kiểm tra database: chỉ có duy nhất 1 bản ghi medical_record cho appointmentId này
      const medList = await apiRequest('/data/medical_records', { headers: { Authorization: `Bearer ${adminToken}` } });
      const matching = medList.data.filter(m => m.appointmentId === appId);
      assert.strictEqual(matching.length, 1, 'Chỉ có ĐÚNG 1 bản ghi bệnh án, không bị nhân bản!');
    });

    await asyncTest('2.8. Gửi nhiều request đồng thời chỉ tạo đúng một bệnh án và hoàn tất ca khám một lần', async () => {
      const appId = `app-concurrent-${Date.now()}`;
      await createAppointment(appId, petAId, vet1Id, 'in_progress');

      // Bắn 4 request đồng thời
      const promises = [1, 2, 3, 4].map(() =>
        apiRequest('/data/medical-records/finalize-ehr', {
          method: 'POST',
          headers: { Authorization: `Bearer ${vet1Token}` },
          body: {
            appointmentId: appId,
            petId: petAId,
            soap: { subjective: 'Đồng thời', assessment: 'Concurrent test' }
          }
        })
      );

      const results = await Promise.all(promises);
      for (const res of results) {
        assert.strictEqual(res.status, 200, 'Tất cả các request đồng thời đều thành công an toàn');
      }

      // Kiểm tra database
      const medList = await apiRequest('/data/medical_records', { headers: { Authorization: `Bearer ${adminToken}` } });
      const matching = medList.data.filter(m => m.appointmentId === appId);
      assert.strictEqual(matching.length, 1, 'Chỉ có đúng 1 bản ghi bệnh án trong database');

      const appList = await apiRequest('/data/appointments', { headers: { Authorization: `Bearer ${adminToken}` } });
      const finalApp = appList.data.find(a => a.id === appId);
      assert.strictEqual(finalApp.status, 'completed');
    });

    // -----------------------------------------------------------------
    // TEST 7: BẢO VỆ BỆNH ÁN ĐÃ CHỐT (KHÓA SỬA ĐỔI TRỰC TIẾP & KHÓA XÓA)
    // -----------------------------------------------------------------
    await asyncTest('2.9. Bệnh án đã chốt bị khóa, không cho sửa trực tiếp nếu thiếu lý do bổ sung (HTTP 403)', async () => {
      const appId = `app-locked-test-${Date.now()}`;
      await createAppointment(appId, petAId, vet1Id, 'in_progress');

      const finRes = await apiRequest('/data/medical-records/finalize-ehr', {
        method: 'POST',
        headers: { Authorization: `Bearer ${vet1Token}` },
        body: {
          appointmentId: appId,
          petId: petAId,
          soap: { assessment: 'Chẩn đoán gốc' }
        }
      });
      const medId = finRes.data.data.medicalRecord.id;

      // Cố tình gọi generic PUT sửa thẳng mà không có amendmentReason
      const putRes = await apiRequest(`/data/medical_records/${medId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${vet1Token}` },
        body: {
          id: medId,
          assessment: 'Cố tình sửa đè trái phép'
        }
      });

      assert.strictEqual(putRes.status, 403, 'Bị chặn sửa đè với HTTP 403');
    });

  } finally {
    // Dọn dẹp dữ liệu kiểm thử
    restoreFile('appointments.json', appointmentsBackup);
    restoreFile('medical_records.json', medicalRecordsBackup);
    restoreFile('pets.json', petsBackup);
    restoreFile('users.json', usersBackup);
  }

  console.log('================================================================');
  console.log(`📊 KẾT QUẢ MỤC 2: ${passed}/${total} TESTS ĐẠT`);
  console.log('================================================================');
  if (passed !== total) process.exit(1);
}

runMuc2Tests().catch(err => {
  console.error('Lỗi thực thi kiểm thử MỤC 2:', err);
  process.exit(1);
});
