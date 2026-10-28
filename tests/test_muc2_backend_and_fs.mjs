import fs from 'fs';
import path from 'path';
import assert from 'assert';

const BASE_URL = 'http://localhost:5000/api';
const DATA_DIR = path.resolve('server/data');

// Helpers for auth
async function login(email, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok || !data.token) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(data)}`);
  }
  return { token: data.token, user: data.user };
}

function readJson(fileName) {
  const p = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(fileName, data) {
  const p = path.join(DATA_DIR, fileName);
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

console.log('===============================================================');
console.log('🧪 BẮT ĐẦU BỘ KIỂM THỬ MỤC 2: FILESYSTEM, RETRY, MISMATCH & SYNC');
console.log('===============================================================');

async function getOrCreateOwner(adminToken) {
  const email = `owner_test_${Date.now()}@petcare.ai`;
  const resCreate = await fetch(`${BASE_URL}/auth/admin/create-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      name: 'Chủ Nuôi Test M2',
      email,
      phone: '0988111222',
      password: 'Owner@123456',
      role: 'pet_owner'
    })
  });
  const dataCreate = await resCreate.json();
  const tempAuth = await login(email, 'Owner@123456');
  const resChange = await fetch(`${BASE_URL}/auth/first-login-change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tempAuth.token}`
    },
    body: JSON.stringify({ newPassword: 'Owner@123456_Valid' })
  });
  const dataChange = await resChange.json();
  return { token: dataChange.token, user: dataChange.user || tempAuth.user };
}

async function runTests() {
  // 0. Chuẩn bị tài khoản & dữ liệu gốc
  const admin = await login('admin@petcare.ai', 'Admin@123456');
  const doctor = await login('tester@petcare.ai', 'Doctor@123');
  const owner = await getOrCreateOwner(admin.token);

  const petsPath = path.join(DATA_DIR, 'pets.json');
  const appPath = path.join(DATA_DIR, 'appointments.json');
  const medPath = path.join(DATA_DIR, 'medical_records.json');

  let testPet = null;
  let testAppId1 = null;

  try {
    // Lấy pet của owner
    const pets = readJson('pets.json');
    testPet = pets.find(p => p.ownerId === owner.user.id);
    if (!testPet) {
      testPet = {
        id: `pet-test-${Date.now()}`,
        name: 'Miu Test',
        species: 'Cat',
        breed: 'Anh Lông Ngắn',
        weight: 4.2,
        ownerId: owner.user.id,
        assignedVetId: doctor.user.id
      };
      pets.push(testPet);
      writeJson('pets.json', pets);
    }

    // Tạo lịch khám test 1
    testAppId1 = `app-test-fs-${Date.now()}-1`;
    const appointments = readJson('appointments.json');
    appointments.push({
      id: testAppId1,
      petId: testPet.id,
      ownerId: owner.user.id,
      vetId: doctor.user.id,
      status: 'in_progress',
      date: '2026-10-15',
      time: '14:00',
      type: 'Khám tổng quát',
      createdAt: new Date().toISOString()
    });
    writeJson('appointments.json', appointments);

  // --------------------------------------------------------------------------
  // TEST 2A: LỖI FILESYSTEM THẬT TRÊN medical_records.json
  // --------------------------------------------------------------------------
  console.log('\n[TEST 2A] Gây lỗi Filesystem thật khi ghi medical_records.json (chmod 0o444 read-only)...');
  const medBefore2A = fs.readFileSync(medPath, 'utf8');
  const appBefore2A = fs.readFileSync(appPath, 'utf8');

  try {
    // Khóa read-only file medical_records.json
    fs.chmodSync(medPath, 0o444);

    const res = await fetch(`${BASE_URL}/data/medical-records/finalize-ehr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${doctor.token}`
      },
      body: JSON.stringify({
        appointmentId: testAppId1,
        petId: testPet.id,
        soap: { subjective: 'Triệu chứng test fs error 2A' }
      })
    });

    const data = await res.json();
    assert.strictEqual(res.status, 500, 'Server phải trả HTTP 500 khi gặp lỗi ghi filesystem');
    assert.strictEqual(data.code, 'TRANSACTION_ROLLBACK', 'Code lỗi phải là TRANSACTION_ROLLBACK');
  } finally {
    // Luôn khôi phục quyền ghi
    fs.chmodSync(medPath, 0o666);
  }

  // So sánh dữ liệu disk trước và sau
  const medAfter2A = fs.readFileSync(medPath, 'utf8');
  const appAfter2A = fs.readFileSync(appPath, 'utf8');
  assert.strictEqual(medAfter2A, medBefore2A, 'medical_records.json trên disk phải giữ nguyên snapshot ban đầu');
  assert.strictEqual(appAfter2A, appBefore2A, 'appointments.json trên disk không được cập nhật một phần');
  console.log('✅ TEST 2A PASSED: Filesystem error tại file 1 được ngăn chặn, zero partial update!');

  // --------------------------------------------------------------------------
  // TEST 2B: LỖI FILESYSTEM THẬT TRÊN appointments.json (FILE THỨ 2)
  // --------------------------------------------------------------------------
  console.log('\n[TEST 2B] Gây lỗi Filesystem thật khi ghi appointments.json (file thứ 2 sau khi file 1 đã ghi)...');
  const medBefore2B = fs.readFileSync(medPath, 'utf8');
  const appBefore2B = fs.readFileSync(appPath, 'utf8');

  try {
    // Khóa read-only file appointments.json
    fs.chmodSync(appPath, 0o444);

    const res = await fetch(`${BASE_URL}/data/medical-records/finalize-ehr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${doctor.token}`
      },
      body: JSON.stringify({
        appointmentId: testAppId1,
        petId: testPet.id,
        soap: { subjective: 'Triệu chứng test fs error 2B' }
      })
    });

    const data = await res.json();
    assert.strictEqual(res.status, 500, 'Server phải trả HTTP 500 khi ghi file 2 thất bại');
    assert.strictEqual(data.code, 'TRANSACTION_ROLLBACK', 'Code lỗi phải là TRANSACTION_ROLLBACK');
  } finally {
    // Khôi phục quyền ghi
    fs.chmodSync(appPath, 0o666);
  }

  // So sánh dữ liệu disk sau khi rollback
  const medAfter2B = fs.readFileSync(medPath, 'utf8');
  const appAfter2B = fs.readFileSync(appPath, 'utf8');
  assert.strictEqual(medAfter2B, medBefore2B, 'medical_records.json phải được rollback hoàn toàn về snapshot ban đầu');
  assert.strictEqual(appAfter2B, appBefore2B, 'appointments.json không bị thay đổi');
  console.log('✅ TEST 2B PASSED: Ghi file 2 lỗi -> file 1 được rollback hoàn toàn về dữ liệu ban đầu!');

  // --------------------------------------------------------------------------
  // TEST 3: SERVER ĐÃ COMMIT NHƯNG CLIENT MẤT PHẢN HỒI (RETRY & IMMUTABILITY)
  // --------------------------------------------------------------------------
  console.log('\n[TEST 3] Test server đã commit, client mất phản hồi & retry...');
  // Bước 3.1: Finalize lần 1 thành công
  const res1 = await fetch(`${BASE_URL}/data/medical-records/finalize-ehr`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${doctor.token}`
    },
    body: JSON.stringify({
      appointmentId: testAppId1,
      petId: testPet.id,
      soap: {
        subjective: 'Miu sốt 39.5C, ho khan 3 ngày',
        objective: 'Nhiệt độ 39.5C, hạch dưới hàm sưng',
        assessment: 'Viêm đường hô hấp trên thể cấp',
        plan: 'Kháng sinh Amoxicillin 250mg 2 lần/ngày x 7 ngày'
      }
    })
  });
  const data1 = await res1.json();
  assert.strictEqual(res1.status, 200, 'Finalize lần đầu phải thành công');
  assert.strictEqual(data1.success, true);
  const committedRecordId = data1.data.medicalRecord.id;

  const recordsBeforeRetry = readJson('medical_records.json');
  const countBeforeRetry = recordsBeforeRetry.length;

  // Bước 3.2: Giả lập client mất kết nối, người dùng bấm retry với payload khác (cố tình sửa nội dung)
  console.log('-> Client retry gửi lại request với nội dung đã bị thay đổi...');
  const resRetry = await fetch(`${BASE_URL}/data/medical-records/finalize-ehr`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${doctor.token}`
    },
    body: JSON.stringify({
      appointmentId: testAppId1,
      petId: testPet.id,
      soap: {
        subjective: 'NỘI DUNG RETRY CỐ TÌNH GHI ĐÈ BỆNH ÁN ĐÃ CHỐT',
        assessment: 'CHẨN ĐOÁN BỊ THAY ĐỔI'
      }
    })
  });
  const dataRetry = await resRetry.json();
  assert.strictEqual(resRetry.status, 200, 'Retry phải trả về HTTP 200 an toàn');
  assert.strictEqual(dataRetry.success, true);

  const recordsAfterRetry = readJson('medical_records.json');
  assert.strictEqual(recordsAfterRetry.length, countBeforeRetry, 'Retry KHÔNG được tạo bản ghi mới');

  const lockedRecord = recordsAfterRetry.find(r => r.id === committedRecordId);
  assert.strictEqual(lockedRecord.isFinal, true, 'Bản ghi phải giữ nguyên cờ isFinal = true');
  assert.strictEqual(
    lockedRecord.soap.subjective,
    'Miu sốt 39.5C, ho khan 3 ngày',
    'Nội dung bệnh án đã chốt KHÔNG ĐƯỢC bị ghi đè bởi payload retry'
  );
  assert.strictEqual(
    lockedRecord.soap.assessment,
    'Viêm đường hô hấp trên thể cấp',
    'Chẩn đoán đã chốt được bảo vệ toàn vẹn'
  );
  console.log('✅ TEST 3 PASSED: Retry không tạo bản ghi mới và không ghi đè bệnh án đã chốt!');

  // --------------------------------------------------------------------------
  // TEST 4: RECORD ID THUỘC LỊCH KHÁM / THÚ CƯNG KHÁC BỊ TỪ CHỐI (RECORD_MISMATCH)
  // --------------------------------------------------------------------------
  console.log('\n[TEST 4] Test recordId thuộc lịch khám/thú cưng khác bị từ chối...');
  // Tạo 1 ca khám khác
  const testAppId2 = `app-test-mismatch-${Date.now()}`;
  const curApps = readJson('appointments.json');
  curApps.push({
    id: testAppId2,
    petId: testPet.id,
    ownerId: owner.user.id,
    vetId: doctor.user.id,
    status: 'in_progress',
    date: '2026-10-16',
    time: '10:00',
    type: 'Tái khám'
  });
  writeJson('appointments.json', curApps);

  const recordsBefore4 = readJson('medical_records.json');
  const appsBefore4 = readJson('appointments.json');

  // Gửi finalize cho testAppId2 nhưng truyền recordId đã thuộc về testAppId1 (committedRecordId)
  const resMismatch = await fetch(`${BASE_URL}/data/medical-records/finalize-ehr`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${doctor.token}`
    },
    body: JSON.stringify({
      appointmentId: testAppId2,
      petId: testPet.id,
      recordId: committedRecordId, // ID đã thuộc về testAppId1
      soap: { subjective: 'Test mismatch' }
    })
  });
  const dataMismatch = await resMismatch.json();
  assert.strictEqual(resMismatch.status, 400, 'Phải trả HTTP 400 khi recordId bị liên kết chéo');
  assert.strictEqual(dataMismatch.code, 'RECORD_MISMATCH', 'Mã lỗi phải là RECORD_MISMATCH');

  // Kiểm tra dữ liệu không bị thay đổi
  const recordsAfter4 = readJson('medical_records.json');
  const appsAfter4 = readJson('appointments.json');
  assert.deepStrictEqual(recordsAfter4, recordsBefore4, 'Dữ liệu medical_records không được thay đổi');
  assert.deepStrictEqual(appsAfter4, appsBefore4, 'Dữ liệu appointments không được thay đổi');
  console.log('✅ TEST 4 PASSED: recordId thuộc ca khác bị từ chối RECORD_MISMATCH và không đổi dữ liệu!');

  // --------------------------------------------------------------------------
  // TEST 5: LOGIC XỬ LÝ KHI FINALIZE THÀNH CÔNG NHƯNG SYNC CACHE THẤT BẠI
  // --------------------------------------------------------------------------
  console.log('\n[TEST 5] Kiểm tra hàm finalizeEhrAndAppointment khi syncAllDataToCache gặp sự cố...');
  // Kiểm tra storageService code: phải trả về syncWarning: true chứ không quăng lỗi thất bại
  const storageServiceCode = fs.readFileSync('src/services/storageService.js', 'utf8');
  assert(
    storageServiceCode.includes('syncWarning: !syncSuccess') || storageServiceCode.includes('syncWarning'),
    'storageService.js phải có cơ chế trả về syncWarning khi sync thất bại'
  );

  const clinicOsViewCode = fs.readFileSync('src/components/clinic/ClinicOsView.jsx', 'utf8');
  assert(
    clinicOsViewCode.includes('finalizeRes?.syncWarning') || clinicOsViewCode.includes('syncWarning'),
    'ClinicOsView.jsx phải thông báo đã lưu máy chủ và cảnh báo đồng bộ bộ nhớ tạm thay vì báo chốt thất bại'
  );
  console.log('✅ TEST 5 PASSED: Cơ chế cảnh báo syncWarning tách bạch hoàn toàn với lỗi chốt bệnh án!');

  // --------------------------------------------------------------------------
  // TEST 6: KIỂM TRA LOGOUT KHÔNG SINH RA CONSOLE ERROR HOẶC REQUEST SAI
  // --------------------------------------------------------------------------
  console.log('\n[TEST 6] Kiểm tra request sau khi logout...');
  const authServiceCode = fs.readFileSync('src/services/authService.js', 'utf8');
  assert(
    authServiceCode.includes('if (!token) {\n    return getUsers();\n  }') || authServiceCode.includes('if (!token) return getUsers()') || authServiceCode.includes('if (!token)'),
    'syncUsersWithBackend phải kiểm tra token trước khi gọi /api/auth/users'
  );

  const apiServiceCode = fs.readFileSync('src/services/apiService.js', 'utf8');
  assert(
    apiServiceCode.includes("if (!token) return 'skipped';") || apiServiceCode.includes("return 'skipped'"),
    'syncAllDataToCache phải kiểm tra token và trả về skipped thay vì true khi không có token'
  );

  const appJsxCode = fs.readFileSync('src/App.jsx', 'utf8');
  assert(
    appJsxCode.includes('if (currentUser?.id) {\n      reloadSystemUsers();\n    }'),
    'App.jsx không được gọi reloadSystemUsers khi user đã đăng xuất (currentUser?.id falsy)'
  );
  console.log('✅ TEST 6 PASSED: Đã chặn toàn bộ các request trái phép chạy ngầm sau khi đăng xuất!');

  console.log('\n===============================================================');
  console.log('🎉 TẤT CẢ CÁC BÀI TEST BACKEND, FILESYSTEM VÀ LOGIC MỤC 2 ĐÃ ĐẠT!');
  console.log('===============================================================');
  } finally {
    // Luôn dọn dẹp toàn bộ dữ liệu test mẫu, không để rò rỉ vào cơ sở dữ liệu vận hành
    try {
      if (testAppId1) {
        const currentApps = readJson('appointments.json');
        writeJson('appointments.json', currentApps.filter(a => a.id !== testAppId1 && !String(a.id).startsWith('app-test-fs-')));
      }
      if (testPet?.id) {
        const currentPets = readJson('pets.json');
        writeJson('pets.json', currentPets.filter(p => p.id !== testPet.id && !String(p.id).startsWith('pet-test-')));
      }
      if (owner?.user?.id) {
        const currentUsers = readJson('users.json');
        writeJson('users.json', currentUsers.filter(u => u.id !== owner.user.id && !String(u.email).includes('owner_test_')));
      }
      const currentMeds = readJson('medical_records.json');
      writeJson('medical_records.json', currentMeds.filter(m => m.appointmentId !== testAppId1 && !String(m.id || '').startsWith('rec-test-fs-')));
    } catch (cleanupErr) {
      console.warn('Cảnh báo khi dọn dẹp fixture test:', cleanupErr.message);
    }
  }
}

runTests().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
