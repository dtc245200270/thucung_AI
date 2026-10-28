import fs from 'fs';
import path from 'path';
import assert from 'assert';

const BASE_URL = 'http://localhost:5000/api';
const DATA_DIR = path.resolve('server/data');

console.log('================================================================');
console.log('🧪 BẮT ĐẦU BỘ KIỂM THỬ MỤC 3: THỐNG NHẤT ĐƠN THUỐC & BỆNH ÁN');
console.log('================================================================\n');

let totalPassed = 0;
let totalFailed = 0;

function pass(name) {
  console.log(`  ✅ [PASS] ${name}`);
  totalPassed++;
}

function fail(name, err) {
  console.error(`  ❌ [FAIL] ${name}:`, err);
  totalFailed++;
}

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

async function runMuc3Tests() {
  const admin = await login('admin@petcare.ai', 'Admin@123456');
  const doctor = await login('tester@petcare.ai', 'Doctor@123');

  // Tạo tài khoản Chủ nuôi test chuyên biệt
  const ownerEmail = `owner_muc3_${Date.now()}@petcare.ai`;
  const ownerCreateRes = await fetch(`${BASE_URL}/auth/admin/create-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${admin.token}`
    },
    body: JSON.stringify({
      name: 'Chủ Nuôi Test Mục 3',
      email: ownerEmail,
      phone: '0977665544',
      password: 'Owner@123456',
      role: 'pet_owner'
    })
  });
  const ownerCreateData = await ownerCreateRes.json();
  const tempOwnerAuth = await login(ownerEmail, 'Owner@123456');

  // Đổi mật khẩu lần đầu để kích hoạt tài khoản
  const ownerChangeRes = await fetch(`${BASE_URL}/auth/first-login-change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tempOwnerAuth.token}`
    },
    body: JSON.stringify({ newPassword: 'OwnerPassword@M3_Valid' })
  });
  const ownerChangeData = await ownerChangeRes.json();
  const owner = { token: ownerChangeData.token, user: ownerChangeData.user || tempOwnerAuth.user };

  // Tạo thú cưng test
  const petId = `pet-m3-${Date.now()}`;
  const petRes = await fetch(`${BASE_URL}/data/pets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${owner.token}`
    },
    body: JSON.stringify({
      id: petId,
      name: 'Bé Miu Mục 3',
      species: 'cat',
      breed: 'Mèo Anh Lông Dài',
      age: 2,
      weight: 4.2
    })
  });
  const petData = await petRes.json();
  assert.strictEqual(petRes.status, 200);

  // Phân công bác sĩ phụ trách thú cưng qua Admin
  const assignPetRes = await fetch(`${BASE_URL}/data/pets/${petId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${admin.token}`
    },
    body: JSON.stringify({
      assignedVetId: doctor.user.id
    })
  });
  assert.strictEqual(assignPetRes.status, 200, 'Admin phân công bác sĩ cho thú cưng');

  // --------------------------------------------------------------------------
  // TEST 1: KÊ MỘT/NHIỀU THUỐC, SỬA NHÁP, CHỐT VÀ OWNER ĐỌC LẠI SAU RELOAD
  // --------------------------------------------------------------------------
  console.log('\n--- CA 1: KÊ THUỐC, SỬA NHÁP, CHỐT BỆNH ÁN & OWNER ĐỌC LẠI ---');
  const appt1Id = `app-m3-1-${Date.now()}`;
  const appt1Res = await fetch(`${BASE_URL}/data/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${owner.token}`
    },
    body: JSON.stringify({
      id: appt1Id,
      petId,
      date: '2026-11-20',
      time: '09:00',
      service: 'Khám tổng quát & hô hấp'
    })
  });
  assert.strictEqual(appt1Res.status, 200);

  // Bác sĩ lưu nháp bệnh án có kê 2 loại thuốc
  const draftRecordId = `med-m3-draft-${Date.now()}`;
  const draftMeds = [
    { name: 'Amoxicillin 250mg', dose: '1 viên', route: 'Uống', freq: '2 lần/ngày', startDate: '2026-11-20', days: 7, instructions: 'Uống sau ăn 30 phút' },
    { name: 'Siro Bromhexin 4mg', dose: '2ml', route: 'Uống', freq: '3 lần/ngày', startDate: '2026-11-20', days: 5, instructions: 'Uống trước khi đi ngủ' }
  ];

  const draftRes = await fetch(`${BASE_URL}/data/medical_records`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${doctor.token}`
    },
    body: JSON.stringify({
      id: draftRecordId,
      appointmentId: appt1Id,
      petId,
      soap: {
        subjective: 'Miu hắt hơi và chảy nước mũi',
        objective: 'Thân nhiệt 39.2C, phổi có ran ẩm nhẹ',
        assessment: 'Viêm phế quản thể cấp',
        plan: 'Kháng sinh kết hợp long đờm',
        planMedications: draftMeds
      },
      isFinal: false,
      status: 'draft'
    })
  });
  assert.strictEqual(draftRes.status, 200, 'Bác sĩ lưu nháp bệnh án thành công');

  // Sửa nháp: Bác sĩ điều chỉnh liều thuốc Amoxicillin thành 1.5 viên và đổi số ngày thành 10 ngày
  const updatedDraftMeds = [
    { name: 'Amoxicillin 250mg', dose: '1.5 viên', route: 'Uống', freq: '2 lần/ngày', startDate: '2026-11-20', days: 10, instructions: 'Uống sau ăn no' },
    { name: 'Siro Bromhexin 4mg', dose: '2.5ml', route: 'Uống', freq: '3 lần/ngày', startDate: '2026-11-20', days: 5, instructions: 'Uống trước khi đi ngủ' }
  ];

  const updateDraftRes = await fetch(`${BASE_URL}/data/medical_records/${draftRecordId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${doctor.token}`
    },
    body: JSON.stringify({
      soap: {
        subjective: 'Miu hắt hơi và chảy nước mũi (đã khám bổ sung)',
        objective: 'Thân nhiệt 39.2C, phổi có ran ẩm nhẹ',
        assessment: 'Viêm phế quản thể cấp',
        plan: 'Kháng sinh kết hợp long đờm liều tăng cường',
        planMedications: updatedDraftMeds
      }
    })
  });
  assert.strictEqual(updateDraftRes.status, 200, 'Bác sĩ cập nhật nháp thành công');

  // Bác sĩ tiến hành CHỐT BỆNH ÁN (Finalize EHR)
  const finalizeRes1 = await fetch(`${BASE_URL}/data/medical-records/finalize-ehr`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${doctor.token}`
    },
    body: JSON.stringify({
      appointmentId: appt1Id,
      petId,
      recordId: draftRecordId,
      soap: {
        subjective: 'Miu hắt hơi và chảy nước mũi',
        objective: 'Thân nhiệt 39.2C, phổi có ran ẩm nhẹ',
        assessment: 'Viêm phế quản thể cấp',
        plan: 'Kháng sinh kết hợp long đờm liều tăng cường',
        planMedications: updatedDraftMeds
      }
    })
  });
  const finalizeData1 = await finalizeRes1.json();
  assert.strictEqual(finalizeRes1.status, 200, 'Chốt bệnh án thành công');
  assert.strictEqual(finalizeData1.success, true);
  assert.strictEqual(finalizeData1.data.medicalRecord.isFinal, true);
  assert.strictEqual(finalizeData1.data.appointment.status, 'completed');
  assert(finalizeData1.data.prescription != null, 'Đơn thuốc phải được tự động ban hành đồng thời trong cùng giao dịch');
  assert.strictEqual(finalizeData1.data.prescription.isFinal, true);
  assert.strictEqual(finalizeData1.data.prescription.status, 'published');
  assert.strictEqual(finalizeData1.data.prescription.ownerId, owner.user.id, 'Backend phải tự enforce ownerId từ pet thực tế');
  assert.strictEqual(finalizeData1.data.prescription.vetId, doctor.user.id, 'Backend phải tự enforce vetId từ session bác sĩ');
  assert.strictEqual(finalizeData1.data.prescription.medications.length, 2, 'Đơn thuốc phải có đủ 2 loại thuốc đã kê');
  assert.strictEqual(finalizeData1.data.prescription.medications[0].dose, '1.5 viên', 'Đơn thuốc phải lưu đúng liều sau khi sửa nháp');

  // Chủ nuôi đọc lại đơn thuốc qua API sau khi chốt
  const ownerGetPresRes = await fetch(`${BASE_URL}/data/prescriptions`, {
    headers: { 'Authorization': `Bearer ${owner.token}` }
  });
  const ownerPrescriptions = await ownerGetPresRes.json();
  const ownerFoundPres = ownerPrescriptions.find(p => p.appointmentId === appt1Id);
  assert(ownerFoundPres != null, 'Chủ nuôi phải đọc được đơn thuốc đã công bố');
  assert.strictEqual(ownerFoundPres.medications.length, 2);
  assert.strictEqual(ownerFoundPres.medications[0].name, 'Amoxicillin 250mg');
  assert.strictEqual(ownerFoundPres.medications[0].dose, '1.5 viên');
  pass('CA 1: Kê nhiều thuốc, sửa nháp, chốt bệnh án và Chủ nuôi đọc lại đơn thuốc chính xác sau khi reload');

  // --------------------------------------------------------------------------
  // TEST 2: CHỐT CA KHÔNG KÊ THUỐC (KHÔNG TẠO ĐƠN RỖNG GIẢ)
  // --------------------------------------------------------------------------
  console.log('\n--- CA 2: CHỐT CA KHÔNG KÊ THUỐC (ZERO DUMMY PRESCRIPTION) ---');
  const appt2Id = `app-m3-2-${Date.now()}`;
  await fetch(`${BASE_URL}/data/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${owner.token}` },
    body: JSON.stringify({
      id: appt2Id,
      petId,
      date: '2026-11-22',
      time: '10:30',
      service: 'Tái khám định kỳ không dùng thuốc'
    })
  });

  const presBeforeNoMed = readJson('prescriptions.json');
  const countBeforeNoMed = presBeforeNoMed.length;

  const finalizeRes2 = await fetch(`${BASE_URL}/data/medical-records/finalize-ehr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${doctor.token}` },
    body: JSON.stringify({
      appointmentId: appt2Id,
      petId,
      soap: {
        subjective: 'Tái khám sau điều trị, mèo ăn ngủ tốt',
        objective: 'Thân nhiệt 38.5C bình thường, phổi trong',
        assessment: 'Đã khỏi hoàn toàn, sức khỏe ổn định',
        plan: 'Duy trì dinh dưỡng hợp lý, không cần dùng thêm thuốc',
        planMedications: [] // Không kê thuốc
      }
    })
  });
  const finalizeData2 = await finalizeRes2.json();
  assert.strictEqual(finalizeRes2.status, 200, 'Chốt ca khám không dùng thuốc thành công');
  assert.strictEqual(finalizeData2.success, true);
  assert.strictEqual(finalizeData2.data.prescription, null, 'Chốt ca không kê thuốc thì data.prescription phải là null');

  const presAfterNoMed = readJson('prescriptions.json');
  assert.strictEqual(presAfterNoMed.length, countBeforeNoMed, 'Không được tạo đơn rỗng giả trong prescriptions.json');
  pass('CA 2: Chốt ca không kê thuốc hoàn tất bình thường và không tạo đơn rỗng giả');

  // --------------------------------------------------------------------------
  // TEST 3: SAI QUYỀN, SAI QUAN HỆ & BẢO VỆ ĐƠN THUỐC ĐÃ CHỐT KHỎI CRUD
  // --------------------------------------------------------------------------
  console.log('\n--- CA 3: SAI QUYỀN, SAI QUAN HỆ & BẢO VỆ ĐƠN ĐÃ CHỐT ---');
  // 3.1: Chủ nuôi tự tạo đơn thuốc -> Bị chặn 403
  const ownerPostPresRes = await fetch(`${BASE_URL}/data/prescriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${owner.token}` },
    body: JSON.stringify({
      petId,
      medicineName: 'Thuốc tự kê không có chỉ định bác sĩ'
    })
  });
  assert.strictEqual(ownerPostPresRes.status, 403, 'Chủ nuôi tự tạo đơn thuốc phải bị từ chối HTTP 403');

  // 3.2: Bác sĩ gửi petId không khớp với appointment -> Bị chặn RECORD_MISMATCH / 400
  const mismatchApptId = `app-m3-mismatch-${Date.now()}`;
  await fetch(`${BASE_URL}/data/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${owner.token}` },
    body: JSON.stringify({ id: mismatchApptId, petId, date: '2026-11-25', time: '14:00', service: 'Test mismatch' })
  });

  const mismatchRes = await fetch(`${BASE_URL}/data/medical-records/finalize-ehr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${doctor.token}` },
    body: JSON.stringify({
      appointmentId: mismatchApptId,
      petId: 'pet-fake-different-id', // Sai petId
      soap: { assessment: 'Test' }
    })
  });
  assert.strictEqual(mismatchRes.status, 400, 'petId sai lệch với lịch khám phải bị từ chối HTTP 400');

  // 3.3: Endpoint PUT không được sửa trực tiếp đơn thuốc đã chốt -> Bị chặn 403
  const finalizedPresId = finalizeData1.data.prescription.id;
  const editPresRes = await fetch(`${BASE_URL}/data/prescriptions/${finalizedPresId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${doctor.token}` },
    body: JSON.stringify({
      medicineName: 'Cố tình sửa đè thuốc trong đơn đã ký chốt'
    })
  });
  assert.strictEqual(editPresRes.status, 403, 'Đơn thuốc đã ký chốt không thể sửa trực tiếp qua PUT (HTTP 403)');

  // 3.4: Endpoint DELETE không được xóa đơn thuốc đã chốt -> Bị chặn 403
  const delPresRes = await fetch(`${BASE_URL}/data/prescriptions/${finalizedPresId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${doctor.token}` }
  });
  assert.strictEqual(delPresRes.status, 403, 'Đơn thuốc đã ký chốt không thể bị xóa qua DELETE (HTTP 403)');
  pass('CA 3: Phân quyền tạo đơn thuốc, kiểm tra quan hệ ca khám & chặn sửa/xóa đơn đã chốt');

  // --------------------------------------------------------------------------
  // TEST 4: LỖI GHI FILESYSTEM TẠI TỪNG BƯỚC VÀ ATOMIC ROLLBACK ĐA TỆP
  // --------------------------------------------------------------------------
  console.log('\n--- CA 4: LỖI GHI FILESYSTEM TẠI FILE THỨ 3 (PRESCRIPTIONS.JSON) & ROLLBACK ---');
  const appt3Id = `app-m3-3-${Date.now()}`;
  await fetch(`${BASE_URL}/data/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${owner.token}` },
    body: JSON.stringify({ id: appt3Id, petId, date: '2026-11-28', time: '16:00', service: 'Test FS Error M3' })
  });

  const dh = await import('../server/dataHandler.js');
  const medPath = path.join(DATA_DIR, 'medical_records.json');
  const appPath = path.join(DATA_DIR, 'appointments.json');
  const presPath = path.join(DATA_DIR, 'prescriptions.json');

  const medBefore4 = fs.readFileSync(medPath, 'utf8');
  const appBefore4 = fs.readFileSync(appPath, 'utf8');
  const presBefore4 = fs.readFileSync(presPath, 'utf8');

  // Gây lỗi có kiểm soát tại File thứ 3 (prescriptions.json)
  const origWrite = fs.writeFileSync;
  try {
    let interceptedPres = false;
    let file1VerifiedBeforeRollback = false;
    let file2VerifiedBeforeRollback = false;
    const testRecId4 = `rec-m3-test4-${Date.now()}`;

    fs.writeFileSync = function(filePath, data, options) {
      const norm = String(filePath).replace(/\\/g, '/');

      // Khi đến file thứ 3 (prescriptions.json)
      if (norm.includes('prescriptions.json')) {
        interceptedPres = true;

        // Đọc trực tiếp đĩa để chứng minh File 1 (medical_records) và File 2 (appointments) ĐÃ ĐƯỢC GHI THÀNH CÔNG trước khi File 3 lỗi!
        const medDisk = fs.readFileSync(medPath, 'utf8');
        const appDisk = fs.readFileSync(appPath, 'utf8');

        if (medDisk.includes(testRecId4)) file1VerifiedBeforeRollback = true;
        if (appDisk.includes(appt3Id)) file2VerifiedBeforeRollback = true;

        console.log(`  -> [CHỨNG MINH THỰC TẾ]: File 1 & File 2 đã ghi đĩa trước khi File 3 gặp lỗi!`);
        console.log(`     File 1 verified: ${file1VerifiedBeforeRollback}, File 2 verified: ${file2VerifiedBeforeRollback}`);

        const err = new Error('EIO: i/o error writing prescriptions');
        err.code = 'EIO';
        err.syscall = 'write';
        err.path = filePath;
        console.log(`  -> [FIXTURE INJECTION] Thao tác thất bại: fs.writeFileSync('prescriptions.json'), Syscall: write, Mã lỗi: EIO`);
        throw err;
      }

      return origWrite.call(fs, filePath, data, options);
    };

    const ops4 = [
      { collection: 'medical_records', data: [...JSON.parse(medBefore4), { id: testRecId4, isFinal: true }] },
      { collection: 'appointments', data: [...JSON.parse(appBefore4), { id: appt3Id, status: 'completed' }] },
      { collection: 'prescriptions', data: [...JSON.parse(presBefore4), { id: `pres-test4-${Date.now()}`, isFinal: true }] }
    ];

    const result4 = dh.saveMultipleCollections(ops4);
    assert.strictEqual(result4, false, 'Giao dịch 3 tệp phải trả về false khi tệp thứ 3 thất bại');
    assert.strictEqual(interceptedPres, true, 'Phải bắt đúng thao tác ghi File 3');
    assert.strictEqual(file1VerifiedBeforeRollback, true, 'File 1 phải được chứng minh đã cập nhật trước khi rollback');
    assert.strictEqual(file2VerifiedBeforeRollback, true, 'File 2 phải được chứng minh đã cập nhật trước khi rollback');

    // Đối chiếu toàn bộ 3 file trên đĩa sau rollback
    const medAfter4 = fs.readFileSync(medPath, 'utf8');
    const appAfter4 = fs.readFileSync(appPath, 'utf8');
    const presAfter4 = fs.readFileSync(presPath, 'utf8');

    assert.strictEqual(medAfter4, medBefore4, 'medical_records.json phải hoàn nguyên 100% về snapshot ban đầu');
    assert.strictEqual(appAfter4, appBefore4, 'appointments.json phải hoàn nguyên 100% về snapshot ban đầu');
    assert.strictEqual(presAfter4, presBefore4, 'prescriptions.json phải giữ nguyên snapshot ban đầu');
    pass('CA 4: Lỗi ghi tại File thứ 3 được bắt chuẩn, File 1 & 2 hoàn nguyên 100% về snapshot ban đầu (Atomic 3-Collection Rollback)');
  } finally {
    fs.writeFileSync = origWrite;
    fs.writeFileSync(medPath, medBefore4, 'utf8');
    fs.writeFileSync(appPath, appBefore4, 'utf8');
    fs.writeFileSync(presPath, presBefore4, 'utf8');
  }

  // --------------------------------------------------------------------------
  // TEST 5: RETRY SAU KHI SERVER ĐÃ COMMIT NHƯNG CLIENT MẤT PHẢN HỒI
  // --------------------------------------------------------------------------
  console.log('\n--- CA 5: RETRY CHỐT BỆNH ÁN KÈM ĐƠN THUỐC (IDEMPOTENCY & IMMUTABILITY) ---');
  const appt5Id = `app-m3-5-${Date.now()}`;
  await fetch(`${BASE_URL}/data/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${owner.token}` },
    body: JSON.stringify({ id: appt5Id, petId, date: '2026-11-29', time: '15:00', service: 'Test retry pres' })
  });

  // Chốt lần 1 thành công
  const resCommit1 = await fetch(`${BASE_URL}/data/medical-records/finalize-ehr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${doctor.token}` },
    body: JSON.stringify({
      appointmentId: appt5Id,
      petId,
      soap: {
        assessment: 'Chẩn đoán lần 1 hợp lệ',
        planMedications: [{ name: 'Thuốc Chuẩn Lần 1', dose: '1 viên', days: 5 }]
      }
    })
  });
  const dataCommit1 = await resCommit1.json();
  assert.strictEqual(resCommit1.status, 200);
  assert.strictEqual(dataCommit1.success, true);
  const committedPresId = dataCommit1.data.prescription.id;

  const presDiskBeforeRetry = readJson('prescriptions.json');
  const presCountBeforeRetry = presDiskBeforeRetry.length;

  // Giả lập client mất phản hồi mạng và gửi retry với payload bị thay đổi
  const resRetryPres = await fetch(`${BASE_URL}/data/medical-records/finalize-ehr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${doctor.token}` },
    body: JSON.stringify({
      appointmentId: appt5Id,
      petId,
      soap: {
        assessment: 'CỐ TÌNH SỬA CHẨN ĐOÁN TRONG RETRY',
        planMedications: [{ name: 'THUỐC RETRY GHI ĐÈ BẤT HỢP PHÁP', dose: '99 viên', days: 99 }]
      }
    })
  });
  const dataRetryPres = await resRetryPres.json();
  assert.strictEqual(resRetryPres.status, 200, 'Retry phải trả về HTTP 200 an toàn');
  assert.strictEqual(dataRetryPres.success, true);
  assert.strictEqual(dataRetryPres.data.prescription.id, committedPresId, 'Phải trả về đúng đơn thuốc đã chốt trước đó');
  assert.strictEqual(dataRetryPres.data.prescription.medications[0].name, 'Thuốc Chuẩn Lần 1', 'Nội dung thuốc đã chốt tuyệt đối không bị ghi đè bởi retry');

  const presDiskAfterRetry = readJson('prescriptions.json');
  assert.strictEqual(presDiskAfterRetry.length, presCountBeforeRetry, 'Retry không được tạo thêm bản ghi đơn thuốc mới');
  pass('CA 5: Server commit nhưng client retry: Không tạo đơn trùng và không ghi đè đơn đã chốt');

  // --------------------------------------------------------------------------
  // TEST 6: CHỦ NUÔI KHÔNG ĐỌC ĐƯỢC ĐƠN NHÁP & CHỦ NUÔI KHÁC KHÔNG ĐỌC ĐƯỢC ĐƠN
  // --------------------------------------------------------------------------
  console.log('\n--- CA 6: BẢO VỆ ĐƠN NHÁP & CÔ LẬP ĐƠN THUỐC GIỮA CÁC CHỦ NUÔI ---');
  // Tạo 1 đơn thuốc nháp trong database cho thú cưng của owner
  const currentPresList = readJson('prescriptions.json');
  const draftPresId = `pres-draft-hidden-${Date.now()}`;
  currentPresList.push({
    id: draftPresId,
    petId,
    ownerId: owner.user.id,
    vetId: doctor.user.id,
    medicineName: 'Thuốc Đang Thử Nghiệm Chưa Công Bố',
    status: 'draft',
    isFinal: false
  });
  writeJson('prescriptions.json', currentPresList);

  // Chủ nuôi gọi GET /data/prescriptions
  const ownerPresListRes = await fetch(`${BASE_URL}/data/prescriptions`, {
    headers: { 'Authorization': `Bearer ${owner.token}` }
  });
  const ownerPresList = await ownerPresListRes.json();
  const hasDraft = ownerPresList.some(p => p.id === draftPresId);
  assert.strictEqual(hasDraft, false, 'Chủ nuôi KHÔNG ĐƯỢC đọc đơn thuốc nháp (isFinal = false hoặc status = draft)');

  // Bác sĩ phụ trách gọi GET /data/prescriptions -> Bác sĩ xem được đơn nháp để tiếp tục kê
  const vetPresListRes = await fetch(`${BASE_URL}/data/prescriptions`, {
    headers: { 'Authorization': `Bearer ${doctor.token}` }
  });
  const vetPresList = await vetPresListRes.json();
  const vetHasDraft = vetPresList.some(p => p.id === draftPresId);
  assert.strictEqual(vetHasDraft, true, 'Bác sĩ phụ trách xem được đơn thuốc nháp để tiếp tục chỉnh sửa');

  // Dọn dẹp bản nháp test
  writeJson('prescriptions.json', currentPresList.filter(p => p.id !== draftPresId));

  // Tạo tài khoản Chủ nuôi thứ hai (Owner 2)
  const owner2Email = `owner2_muc3_${Date.now()}@petcare.ai`;
  await fetch(`${BASE_URL}/auth/admin/create-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${admin.token}` },
    body: JSON.stringify({ name: 'Chủ Nuôi Khác', email: owner2Email, phone: '0911223344', password: 'Owner@123456', role: 'pet_owner' })
  });
  const tempOwner2Auth = await login(owner2Email, 'Owner@123456');
  const owner2ChangeRes = await fetch(`${BASE_URL}/auth/first-login-change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tempOwner2Auth.token}` },
    body: JSON.stringify({ newPassword: 'Owner2Password@Valid123' })
  });
  const owner2Token = (await owner2ChangeRes.json()).token;

  // Chủ nuôi thứ hai gọi GET /data/prescriptions
  const owner2PresRes = await fetch(`${BASE_URL}/data/prescriptions`, {
    headers: { 'Authorization': `Bearer ${owner2Token}` }
  });
  const owner2Pres = await owner2PresRes.json();
  const hasOwner1Pres = owner2Pres.some(p => p.ownerId === owner.user.id || p.id === committedPresId);
  assert.strictEqual(hasOwner1Pres, false, 'Chủ nuôi khác tuyệt đối không đọc được đơn thuốc của người khác');
  pass('CA 6: Chủ nuôi không đọc được đơn nháp; Chủ nuôi khác không đọc được đơn của người khác');

  // --------------------------------------------------------------------------
  // TEST 7: DỮ LIỆU CŨ TRONG PRESCRIPTIONS.JSON VẪN ĐỌC ĐÚNG 100%
  // --------------------------------------------------------------------------
  console.log('\n--- CA 7: TƯƠNG THÍCH DỮ LIỆU CŨ TRONG PRESCRIPTIONS.JSON ---');
  const diskPres = readJson('prescriptions.json');
  const legacyPres1 = diskPres.find(p => p.id === 'pres-1');
  const legacyPres2 = diskPres.find(p => p.id === 'pres-2');

  assert(legacyPres1 != null, 'Dữ liệu cũ pres-1 phải còn nguyên vẹn trên đĩa');
  assert.strictEqual(legacyPres1.medicineName, 'Men vi sinh Biotic Pet & Kháng viêm dị ứng');
  assert.strictEqual(legacyPres1.dosage, '1 gói/ngày, chia 2 lần sáng/tối');
  assert.strictEqual(legacyPres1.durationDays, 7);

  assert(legacyPres2 != null, 'Dữ liệu cũ pres-2 phải còn nguyên vẹn trên đĩa');
  assert.strictEqual(legacyPres2.medicineName, 'Gel dinh dưỡng Nourse & Dầu cá Hồi hồi phục lông');
  assert.strictEqual(legacyPres2.durationDays, 30);
  pass('CA 7: Đọc tương thích 100% dữ liệu cũ (pres-1, pres-2), không làm mất hoặc thay đổi thuốc đã lưu');

  // --------------------------------------------------------------------------
  // TEST 8: BACKEND LƯU THÀNH CÔNG NHƯNG SYNC CACHE LỖI TRẢ VỀ SYNCWARNING
  // --------------------------------------------------------------------------
  console.log('\n--- CA 8: BACKEND LƯU THÀNH CÔNG NHƯNG ĐỒNG BỘ CACHE GẶP SỰ CỐ ---');
  const storageMap = new Map();
  globalThis.localStorage = {
    getItem: (key) => storageMap.has(key) ? storageMap.get(key) : null,
    setItem: (key, val) => storageMap.set(key, String(val)),
    removeItem: (key) => storageMap.delete(key),
    clear: () => storageMap.clear()
  };
  globalThis.window = {
    dispatchEvent: () => true
  };
  storageMap.set('petcare_auth_token', doctor.token);
  storageMap.set('petcare_token', doctor.token);
  storageMap.set('petcare_current_user_v1', JSON.stringify(doctor.user));

  const storageService = await import('../src/services/storageService.js');
  const appt8Id = `app-m3-8-${Date.now()}`;
  await fetch(`${BASE_URL}/data/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${owner.token}` },
    body: JSON.stringify({ id: appt8Id, petId, date: '2026-11-30', time: '17:00', service: 'Test sync warning pres' })
  });

  const origGlobalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options = {}) => {
      // Gọi endpoint finalize-ehr thực tế trên backend
      if (String(url).includes('/finalize-ehr')) {
        const fullUrl = String(url).startsWith('http') ? url : `http://localhost:5000${url}`;
        return origGlobalFetch(fullUrl, options);
      }
      // Giả lập lỗi khi đồng bộ các collection vào cache
      return {
        ok: false,
        status: 500,
        json: async () => ({ error: 'Sync failed' })
      };
    };

    const resSyncWarn = await storageService.finalizeEhrAndAppointment({
      appointmentId: appt8Id,
      petId,
      soap: {
        assessment: 'Viêm da dị ứng nhẹ',
        planMedications: [{ name: 'Kem bôi da Kẽm Oxyde', dose: 'Bôi 2 lần/ngày', days: 7 }]
      }
    });

    assert.strictEqual(resSyncWarn.success, true, 'Backend finalize đã thành công thì không báo chốt bệnh án thất bại');
    assert.strictEqual(resSyncWarn.syncWarning, true, 'syncAllDataToCache thất bại thì finalizeEhrAndAppointment phải trả syncWarning: true');
    assert(resSyncWarn.prescription != null, 'Đơn thuốc vẫn được lưu và trả về thành công');
    pass('CA 8: Backend lưu thành công nhưng syncAllDataToCache lỗi không bị báo thành lỗi lưu (trả về syncWarning)');
  } finally {
    globalThis.fetch = origGlobalFetch;
  }

  // --------------------------------------------------------------------------
  // TEST 9: THỐNG NHẤT QUYỀN THEO CA KHÁM (BÁC SĨ B CÙNG THÚ CƯNG KHÔNG ĐƯỢC CHỐT CA CỦA A)
  // --------------------------------------------------------------------------
  console.log('\n--- CA 9: THỐNG NHẤT QUYỀN THEO CA KHÁM (BÁC SĨ B KHÔNG ĐƯỢC CHỐT CA CỦA A) ---');
  // 9.1 Tạo tài khoản Bác sĩ thứ hai (Vet 2)
  const vet2Email = `vet2_muc3_${Date.now()}@petcare.ai`;
  await fetch(`${BASE_URL}/auth/admin/create-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${admin.token}` },
    body: JSON.stringify({
      name: 'BS. Bác Sĩ B (Cùng phụ trách thú cưng)',
      email: vet2Email,
      phone: '0933445566',
      password: 'Doctor@123456',
      role: 'vet_doctor'
    })
  });
  const tempVet2Auth = await login(vet2Email, 'Doctor@123456');
  const vet2ChangeRes = await fetch(`${BASE_URL}/auth/first-login-change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tempVet2Auth.token}` },
    body: JSON.stringify({ newPassword: 'DoctorB@Valid123' })
  });
  const vet2 = { token: (await vet2ChangeRes.json()).token, user: tempVet2Auth.user };

  // 9.2 Gán thú cưng cho CẢ HAI bác sĩ (Bác sĩ A phụ trách chính, Bác sĩ B trong sharedWithVetIds)
  const allPetsList = readJson('pets.json');
  const currentPetIdx = allPetsList.findIndex(p => p.id === petId);
  if (currentPetIdx !== -1) {
    allPetsList[currentPetIdx].assignedVetId = doctor.user.id;
    allPetsList[currentPetIdx].sharedWithVetIds = [vet2.user.id];
    writeJson('pets.json', allPetsList);
  }

  // 9.3 Tạo ca khám được phân công cụ thể cho Bác sĩ A (Doctor 1)
  const apptVetAId = `app-veta-${Date.now()}`;
  const apptDate = `2028-05-${String(Math.floor(Math.random() * 20) + 1).padStart(2, '0')}`;
  const apptTime = `11:${String(Math.floor(Math.random() * 45) + 10).padStart(2, '0')}`;
  const apptCreateRes = await fetch(`${BASE_URL}/data/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${admin.token}` },
    body: JSON.stringify({
      id: apptVetAId,
      petId,
      date: apptDate,
      time: apptTime,
      assignedVetId: doctor.user.id,
      vetId: doctor.user.id,
      service: 'Khám nội khoa hô hấp'
    })
  });
  const apptCreateData = await apptCreateRes.json();
  assert.strictEqual(apptCreateRes.status, 200, `Admin tạo ca khám cho BS A phải thành công: ${JSON.stringify(apptCreateData)}`);

  // 9.4 Bác sĩ B cố tình tạo bệnh án nháp cho ca khám của Bác sĩ A -> BỊ CHẶN 403
  const vet2DraftSoapRes = await fetch(`${BASE_URL}/data/medical_records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vet2.token}` },
    body: JSON.stringify({
      petId,
      appointmentId: apptVetAId,
      subjective: 'BS B can thiệp trái phép vào ca khám của BS A'
    })
  });
  assert.strictEqual(vet2DraftSoapRes.status, 403, 'Bác sĩ B không được phép tạo bệnh án nháp cho ca khám của Bác sĩ A (HTTP 403)');

  // 9.5 Bác sĩ B cố tình kê đơn thuốc cho ca khám của Bác sĩ A -> BỊ CHẶN 403
  const vet2PrescRes = await fetch(`${BASE_URL}/data/prescriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vet2.token}` },
    body: JSON.stringify({
      petId,
      appointmentId: apptVetAId,
      medicineName: 'Thuốc BS B kê lén',
      dosage: '1 viên'
    })
  });
  assert.strictEqual(vet2PrescRes.status, 403, 'Bác sĩ B không được phép kê đơn thuốc cho ca khám của Bác sĩ A (HTTP 403)');

  // 9.6 Bác sĩ B cố tình gọi finalize chốt ca của Bác sĩ A -> BỊ CHẶN 403
  const vet2FinalizeRes = await fetch(`${BASE_URL}/data/medical-records/finalize-ehr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vet2.token}` },
    body: JSON.stringify({
      appointmentId: apptVetAId,
      petId,
      soap: { assessment: 'BS B cố tình chốt ca của BS A' }
    })
  });
  assert.strictEqual(vet2FinalizeRes.status, 403, 'Bác sĩ B không thể chốt ca khám của Bác sĩ A dù cùng được gán cho thú cưng (HTTP 403)');

  // 9.7 Bác sĩ A (bác sĩ phụ trách chính ca khám) chốt ca thành công
  const vetAFinalizeRes = await fetch(`${BASE_URL}/data/medical-records/finalize-ehr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${doctor.token}` },
    body: JSON.stringify({
      appointmentId: apptVetAId,
      petId,
      soap: {
        assessment: 'Viêm mũi dị ứng cấp',
        planMedications: [{ name: 'Siro Clorpheniramin 2mg', dose: '2ml', days: 5 }]
      }
    })
  });
  assert.strictEqual(vetAFinalizeRes.status, 200, 'Bác sĩ A phụ trách ca khám chốt bệnh án và đơn thuốc thành công');
  pass('CA 9: Thống nhất quyền theo ca khám — Bác sĩ B cùng được gán thú cưng không thể chốt/lưu nháp/kê đơn trên ca của A');

  // --------------------------------------------------------------------------
  // TEST 10: PHÂN BIỆT ĐƠN CŨ VÀ ĐƠN NHÁP TOÀN DIỆN (GET DANH SÁCH & ĐỌC THEO ID)
  // --------------------------------------------------------------------------
  console.log('\n--- CA 10: PHÂN BIỆT ĐƠN CŨ VÀ ĐƠN NHÁP (GET LIST, GET BY ID, CỜ MÂU THUẪN & BẢO VỆ) ---');
  // 10.1 Tạo các trạng thái đơn thuốc: thiếu cờ, draft, cờ mâu thuẫn, đã công bố
  const testPresMissing = {
    id: `pres-missing-${Date.now()}`,
    petId,
    ownerId: owner.user.id,
    medicineName: 'Thuốc thiếu cờ hoàn toàn',
    dosage: '1 viên'
  };
  const testPresDraft = {
    id: `pres-draft-${Date.now()}`,
    petId,
    ownerId: owner.user.id,
    medicineName: 'Thuốc bản nháp',
    isFinal: false,
    status: 'draft',
    dosage: '1 viên'
  };
  const testPresConflict1 = {
    id: `pres-conflict1-${Date.now()}`,
    petId,
    ownerId: owner.user.id,
    medicineName: 'Thuốc cờ mâu thuẫn 1 (isFinal: true nhưng status: draft)',
    isFinal: true,
    status: 'draft',
    dosage: '1 viên'
  };
  const testPresConflict2 = {
    id: `pres-conflict2-${Date.now()}`,
    petId,
    ownerId: owner.user.id,
    medicineName: 'Thuốc cờ mâu thuẫn 2 (isFinal: false nhưng status: published)',
    isFinal: false,
    status: 'published',
    dosage: '1 viên'
  };
  const testPresPublished = {
    id: `pres-pub-${Date.now()}`,
    petId,
    ownerId: owner.user.id,
    medicineName: 'Thuốc đã chốt và công bố hợp lệ',
    isFinal: true,
    status: 'published',
    dosage: '1 viên'
  };

  const currentPresList10 = readJson('prescriptions.json');
  writeJson('prescriptions.json', [
    testPresMissing,
    testPresDraft,
    testPresConflict1,
    testPresConflict2,
    testPresPublished,
    ...currentPresList10
  ]);

  // 10.2 Chủ nuôi gọi GET /data/prescriptions (GET danh sách)
  const ownerListRes = await fetch(`${BASE_URL}/data/prescriptions`, {
    headers: { 'Authorization': `Bearer ${owner.token}` }
  });
  const ownerList = await ownerListRes.json();
  const ownerPresIds = new Set(ownerList.map(p => p.id));
  assert(ownerPresIds.has(testPresPublished.id), 'Chủ nuôi PHẢI thấy đơn đã chốt và công bố');
  assert(!ownerPresIds.has(testPresMissing.id), 'Chủ nuôi KHÔNG ĐƯỢC thấy đơn thiếu cờ');
  assert(!ownerPresIds.has(testPresDraft.id), 'Chủ nuôi KHÔNG ĐƯỢC thấy đơn draft');
  assert(!ownerPresIds.has(testPresConflict1.id), 'Chủ nuôi KHÔNG ĐƯỢC thấy đơn cờ mâu thuẫn 1 (isFinal: true, status: draft)');
  assert(!ownerPresIds.has(testPresConflict2.id), 'Chủ nuôi KHÔNG ĐƯỢC thấy đơn cờ mâu thuẫn 2 (isFinal: false, status: published)');

  // 10.3 Chủ nuôi gọi GET /data/prescriptions/:id (Đọc theo ID)
  const getPubById = await fetch(`${BASE_URL}/data/prescriptions/${testPresPublished.id}`, {
    headers: { 'Authorization': `Bearer ${owner.token}` }
  });
  assert.strictEqual(getPubById.status, 200, 'GET theo ID: Đơn đã công bố đọc thành công');

  const getMissingById = await fetch(`${BASE_URL}/data/prescriptions/${testPresMissing.id}`, {
    headers: { 'Authorization': `Bearer ${owner.token}` }
  });
  assert.strictEqual(getMissingById.status, 404, 'GET theo ID: Đơn thiếu cờ bị ẩn khỏi chủ nuôi (404)');

  const getDraftById = await fetch(`${BASE_URL}/data/prescriptions/${testPresDraft.id}`, {
    headers: { 'Authorization': `Bearer ${owner.token}` }
  });
  assert.strictEqual(getDraftById.status, 404, 'GET theo ID: Đơn draft bị ẩn khỏi chủ nuôi (404)');

  const getConflict1ById = await fetch(`${BASE_URL}/data/prescriptions/${testPresConflict1.id}`, {
    headers: { 'Authorization': `Bearer ${owner.token}` }
  });
  assert.strictEqual(getConflict1ById.status, 404, 'GET theo ID: Đơn cờ mâu thuẫn 1 bị ẩn khỏi chủ nuôi (404)');

  const getConflict2ById = await fetch(`${BASE_URL}/data/prescriptions/${testPresConflict2.id}`, {
    headers: { 'Authorization': `Bearer ${owner.token}` }
  });
  assert.strictEqual(getConflict2ById.status, 404, 'GET theo ID: Đơn cờ mâu thuẫn 2 bị ẩn khỏi chủ nuôi (404)');

  // 10.4 Chặn tạo đơn mới thiếu cờ hoặc tự gắn isFinal qua generic POST để vượt bộ lọc
  const bypassPostRes = await fetch(`${BASE_URL}/data/prescriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${doctor.token}` },
    body: JSON.stringify({
      petId,
      medicineName: 'Thuốc cố tình gắn isFinal qua POST',
      isFinal: true,
      status: 'published'
    })
  });
  const bypassData = await bypassPostRes.json();
  assert.strictEqual(bypassData.data.isFinal, false, 'Generic POST không cho phép bypass: isFinal bị buộc thành false');
  assert.strictEqual(bypassData.data.status, 'draft', 'Generic POST không cho phép bypass: status bị buộc thành draft');

  // 10.5 Bảo vệ PUT và DELETE nhất quán với quy tắc xác định đơn đã công bố
  const putPubRes = await fetch(`${BASE_URL}/data/prescriptions/${testPresPublished.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${doctor.token}` },
    body: JSON.stringify({ dosage: 'Thay đổi liều trái phép' })
  });
  assert.strictEqual(putPubRes.status, 403, 'PUT vào đơn đã công bố bị chặn tuyệt đối (HTTP 403)');

  const delPubRes = await fetch(`${BASE_URL}/data/prescriptions/${testPresPublished.id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${doctor.token}` }
  });
  assert.strictEqual(delPubRes.status, 403, 'DELETE vào đơn đã công bố bị chặn tuyệt đối (HTTP 403)');

  // 10.6 Xác minh file backup chuyển đổi có kiểm soát tồn tại
  const serverDataFiles = fs.readdirSync(DATA_DIR);
  const backupFiles = serverDataFiles.filter(f => f.startsWith('prescriptions_pre_migration_backup_'));
  assert(backupFiles.length > 0, 'Phải có tệp sao lưu dữ liệu cũ trước khi chuyển đổi');
  pass('CA 10: Phân biệt đơn cũ & đơn nháp toàn diện — GET list, GET by ID, cờ mâu thuẫn, chống bypass & bảo vệ PUT/DELETE');

  // --------------------------------------------------------------------------
  // TEST 11: MỤC 5 — LOẠI BỎ SUY DIỄN DỮ LIỆU CHƯA NHẬP
  // --------------------------------------------------------------------------
  console.log('\n--- CA 11: MỤC 5 — LOẠI BỎ SUY DIỄN DỮ LIỆU CHƯA NHẬP ---');
  const aiModule = await import('../src/services/aiService.js');

  // 11.1 Chưa có ngày sinh: Không mặc định 12 tháng/trưởng thành, không sinh vắc-xin phụ thuộc tuổi
  const planNoBirth = aiModule.generateAiCarePlan({ name: 'Chó Chưa Ngày Sinh', species: 'dog', birthDate: null });
  const hasPuppyVaccine = planNoBirth.some(p => p.title.includes('5 bệnh') || p.title.includes('mũi 1') || p.title.includes('nhắc lại hàng năm'));
  assert.strictEqual(hasPuppyVaccine, false, 'Không có ngày sinh: Tuyệt đối không tự suy diễn phác đồ vắc-xin chó con hoặc trưởng thành');
  const hasAdvisoryCheck = planNoBirth.some(p => p.type === 'health_check' && p.notes.includes('chưa cập nhật ngày sinh'));
  assert.strictEqual(hasAdvisoryCheck, true, 'Không có ngày sinh: Đề xuất khám thể trạng và tư vấn độ tuổi trước khi tiêm vắc-xin');

  // 11.2 Chưa có cân nặng: calculatePetNutrition trả hasMissingWeight: true và null
  const nutNoWeight = aiModule.calculatePetNutrition({ name: 'Miu Thiếu Cân Nặng', weight: null });
  assert.strictEqual(nutNoWeight.hasMissingWeight, true, 'Thiếu cân nặng: hasMissingWeight phải là true');
  assert.strictEqual(nutNoWeight.calories, null, 'Thiếu cân nặng: calories phải là null');
  assert.strictEqual(nutNoWeight.dailyCalories, null, 'Thiếu cân nặng: dailyCalories phải là null');

  // 11.3 Chưa có chi tiêu: analyzePetExpense không nhận xét cân bằng hoặc sinh ngân sách
  const expEmpty = aiModule.analyzePetExpense([], { name: 'Miu Thiếu Chi Tiêu' });
  assert.strictEqual(expEmpty.totalSpent, 0, 'Mảng chi tiêu rỗng: totalSpent = 0');
  assert.strictEqual(expEmpty.hasExpenses, false, 'Mảng chi tiêu rỗng: hasExpenses = false');

  pass('CA 11: Mục 5 — Loại bỏ suy diễn dữ liệu chưa nhập đạt yêu cầu tuyệt đối');

  // --------------------------------------------------------------------------
  // TỔNG KẾT
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`📊 TỔNG KẾT BỘ KIỂM THỬ MỤC 3: ${totalPassed} PASS, ${totalFailed} FAIL`);
  console.log('================================================================');
  if (totalFailed > 0) {
    process.exit(1);
  }
}

runMuc3Tests().catch(err => {
  console.error('\n❌ LỖI KHÔNG MONG ĐỢI TRONG BỘ TEST MỤC 3:', err);
  process.exit(1);
});
