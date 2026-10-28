// Comprehensive Regression Test Suite for PetCare Hardening
const API_URL = 'http://localhost:5000';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ TOÀN DIỆN HỆ THỐNG PETCARE (10 MỤC)');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // 0. ĐĂNG NHẬP ADMIN ĐỂ LẤY TOKEN
  console.log('--- BƯỚC 0: ĐĂNG NHẬP ADMIN ---');
  let adminRes = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@petcare.ai', password: 'Admin@123456' })
  });
  let adminData = await adminRes.json();
  const adminToken = adminData.token;
  assert(adminToken != null, 'Admin đăng nhập thành công và nhận JWT token');

  // Đăng nhập Bác sĩ
  let vetRes = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'tester@petcare.ai', password: 'Doctor@123' })
  });
  let vetData = await vetRes.json();
  const vetToken = vetData.token;
  const vetUser = vetData.user;
  assert(vetToken != null, 'Bác sĩ đăng nhập thành công');

  // Tạo và kích hoạt tài khoản Chủ nuôi test chuyên biệt
  const ownerEmail = `test_owner_${Date.now()}@petcare.ai`;
  let createOwnerRes = await fetch(`${API_URL}/api/auth/admin/create-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({
      callerId: adminData.user.id,
      name: 'Chủ Nuôi QA Test',
      email: ownerEmail,
      role: 'pet_owner',
      password: 'OwnerPassword@123'
    })
  });
  let createOwnerData = await createOwnerRes.json();
  const ownerUser = createOwnerData.user;

  let loginOwnerTemp = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ownerEmail, password: 'OwnerPassword@123' })
  });
  let ownerTempData = await loginOwnerTemp.json();

  let firstLoginRes = await fetch(`${API_URL}/api/auth/first-login-change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerTempData.token}` },
    body: JSON.stringify({ userId: ownerUser.id, newPassword: 'OwnerPassword@Real123' })
  });
  let firstLoginData = await firstLoginRes.json();
  const ownerToken = firstLoginData.token;
  assert(ownerToken != null, 'Chủ nuôi test tạo và kích hoạt mật khẩu chính thức thành công');

  // =========================================================================
  // MỤC 1: ĐÓNG CÁC ĐƯỜNG VƯỢT KIỂM TRA XÁC THỰC
  // =========================================================================
  console.log('\n--- MỤC 1: ĐÓNG CÁC ĐƯỜNG VƯỢT KIỂM TRA XÁC THỰC ---');

  // Tạo một tài khoản test có mustChangePassword = true
  const testEmail = `mustchange_${Date.now()}@petcare.ai`;
  let createRes = await fetch(`${API_URL}/api/auth/admin/create-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({
      callerId: adminData.user.id,
      name: 'Test Must Change',
      email: testEmail,
      role: 'pet_owner',
      password: 'TempPassword@123'
    })
  });
  let createData = await createRes.json();
  assert(createData.success && createData.user.mustChangePassword === true, 'Admin tạo user có mustChangePassword = true');

  // Đăng nhập user này để lấy token
  let loginMustChange = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: 'TempPassword@123' })
  });
  let mustChangeData = await loginMustChange.json();
  const mustChangeToken = mustChangeData.token;

  // 1.1: Thử bypass qua query string /api/data/pets?bypass=first-login-change-password
  let bypassRes = await fetch(`${API_URL}/api/data/pets?bypass=first-login-change-password`, {
    headers: { 'Authorization': `Bearer ${mustChangeToken}` }
  });
  assert(bypassRes.status === 403, 'Chặn vượt xác thực bằng query string (status 403 MUST_CHANGE_PASSWORD)');

  // 1.2: Endpoint first-login-change-password từ chối user đã hoàn tất đổi mật khẩu (mustChangePassword: false)
  let invalidFirstLogin = await fetch(`${API_URL}/api/auth/first-login-change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify({ userId: ownerUser.id, newPassword: 'NewPassword@999' })
  });
  let invalidFirstLoginData = await invalidFirstLogin.json();
  assert(invalidFirstLogin.status === 400 && invalidFirstLoginData.error.includes('yêu cầu đổi mật khẩu lần đầu'),
    'Chặn dùng endpoint first-login-change-password khi mustChangePassword = false');

  // 1.3: User thật sự có mustChangePassword = true hoàn tất đổi mật khẩu lần đầu thành công và được cấp token mới
  let validFirstLogin = await fetch(`${API_URL}/api/auth/first-login-change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${mustChangeToken}` },
    body: JSON.stringify({ userId: mustChangeData.user.id, newPassword: 'PermanentPassword@123' })
  });
  let validFirstLoginData = await validFirstLogin.json();
  assert(validFirstLogin.status === 200 && validFirstLoginData.token != null, 
    'Đổi mật khẩu lần đầu hợp lệ thành công và nhận token mới');

  // 1.4: Token cũ bị thu hồi sau khi đổi mật khẩu
  let oldTokenRes = await fetch(`${API_URL}/api/data/pets`, {
    headers: { 'Authorization': `Bearer ${mustChangeToken}` }
  });
  assert(oldTokenRes.status === 401, 'Phiên đăng nhập cũ bị thu hồi sau khi đổi mật khẩu (HTTP 401)');

  // =========================================================================
  // MỤC 2: SỬA MIGRATION ĐỂ KHÔNG BỎ QUA PHÂN QUYỀN
  // =========================================================================
  console.log('\n--- MỤC 2: SỬA MIGRATION ĐỂ KHÔNG BỎ QUA PHÂN QUYỀN ---');

  // Tạo một thú cưng thuộc owner demo
  const testPetId = `pet-test-${Date.now()}`;
  let addPetRes = await fetch(`${API_URL}/api/data/pets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify({
      id: testPetId,
      name: 'Bé Mochi Test',
      species: 'Chó Golden',
      weight: 12
    })
  });
  assert(addPetRes.status === 200, 'Tạo thú cưng hợp lệ cho Chủ nuôi');

  // Chủ nuôi khác (mustChangeUser sau khi đổi pass thành công) gọi migrate cố tình nhận vơ testPetId
  let owner2Token = validFirstLoginData.token;
  let fakeMigrateRes = await fetch(`${API_URL}/api/data/migrate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${owner2Token}` },
    body: JSON.stringify({
      pets: [{ id: testPetId, name: 'Bé Mochi Hack', ownerId: 'other' }],
      medical_records: [{ id: 'mr-hack', petId: testPetId, isFinal: true, confirmedBy: 'Bác sĩ giả' }],
      prescriptions: [{ id: 'pr-hack', petId: testPetId, doctorName: 'BS Fake' }],
      health_data: { [testPetId]: { weight: 99 } }
    })
  });
  assert(fakeMigrateRes.status === 200, 'Gọi /migrate xử lý kiểm tra an toàn');

  // Xác minh: testPetId trong DB vẫn thuộc về owner 1, không bị chuyển sang owner 2
  let checkPetsRes = await fetch(`${API_URL}/api/data/pets`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  let allPets = await checkPetsRes.json();
  let verifiedPet = allPets.find(p => p.id === testPetId);
  assert(verifiedPet && verifiedPet.ownerId === ownerUser.id, 'Migration không cho phép nhận vơ ID thú cưng của người khác');

  // Xác minh: medical_records và prescriptions do owner gửi lên bị từ chối/bỏ qua hoàn toàn
  let checkMedRes = await fetch(`${API_URL}/api/data/medical_records`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  let allMeds = await checkMedRes.json();
  assert(!allMeds.some(m => m.id === 'mr-hack'), 'Migration chặn chủ nuôi tự chèn hồ sơ bác sĩ hoặc xác nhận chuyên môn giả');

  // =========================================================================
  // MỤC 3: BẢO VỆ BỆNH ÁN VÀ ĐƠN THUỐC TRÊN SERVER
  // =========================================================================
  console.log('\n--- MỤC 3: BẢO VỆ BỆNH ÁN VÀ ĐƠN THUỐC TRÊN SERVER ---');

  // Phân công Bác sĩ phụ trách thú cưng test (chuẩn RBAC Bác sĩ)
  await fetch(`${API_URL}/api/data/pets/${testPetId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({ assignedVetId: vetUser.id })
  });

  // Bác sĩ tạo 1 bệnh án nháp (isFinal: false)
  const draftRecordId = `mr-draft-${Date.now()}`;
  let createDraftRes = await fetch(`${API_URL}/api/data/medical_records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vetToken}` },
    body: JSON.stringify({
      id: draftRecordId,
      petId: testPetId,
      vetId: vetUser.id,
      isFinal: false,
      soap: { subjective: 'Bé mệt', objective: 'Nhiệt độ 38.5', assessment: 'Viêm da', plan: 'Thuốc thoa' }
    })
  });
  assert(createDraftRes.status === 200, 'Bác sĩ tạo thành công bệnh án nháp');

  // 3.1: Chủ nuôi đọc medical_records -> không được thấy bệnh án nháp (isFinal: false)
  let ownerReadMeds = await fetch(`${API_URL}/api/data/medical_records`, {
    headers: { 'Authorization': `Bearer ${ownerToken}` }
  });
  let ownerMedsList = await ownerReadMeds.json();
  assert(!ownerMedsList.some(m => m.id === draftRecordId), 'Chủ nuôi không đọc được bệnh án nháp chưa công bố');

  // 3.2: Chủ nuôi cố tình tạo đơn thuốc chuyên môn -> bị chặn 403
  let ownerFakePres = await fetch(`${API_URL}/api/data/prescriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify({
      id: `pr-fake-${Date.now()}`,
      petId: testPetId,
      doctorName: 'BS. Hack',
      medicines: [{ name: 'Thuốc kháng sinh' }]
    })
  });
  assert(ownerFakePres.status === 403, 'Chặn chủ nuôi tạo đơn thuốc chuyên môn (HTTP 403)');

  // Bác sĩ ký chốt bệnh án (isFinal: true)
  const finalRecordId = `mr-final-${Date.now()}`;
  await fetch(`${API_URL}/api/data/medical_records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vetToken}` },
    body: JSON.stringify({
      id: finalRecordId,
      petId: testPetId,
      vetId: vetUser.id,
      isFinal: true,
      soap: { subjective: 'Sốt cao', assessment: 'Viêm phế quản cấp' }
    })
  });

  // 3.3: Chủ nuôi cố sửa SOAP bệnh án của bác sĩ -> bị chặn 403
  let ownerEditMed = await fetch(`${API_URL}/api/data/medical_records/${finalRecordId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify({ assessment: 'Bé bình thường' })
  });
  assert(ownerEditMed.status === 403, 'Chặn chủ nuôi sửa bệnh án của bác sĩ (HTTP 403)');

  // 3.4: Sửa bệnh án đã chốt trực tiếp mà không có lý do -> bị chặn 403
  let vetDirectEdit = await fetch(`${API_URL}/api/data/medical_records/${finalRecordId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vetToken}` },
    body: JSON.stringify({ assessment: 'Sửa bừa không lý do' })
  });
  assert(vetDirectEdit.status === 403, 'Bệnh án đã chốt bị khóa, không cho sửa trực tiếp nếu thiếu lý do bổ sung');

  // 3.5: Bổ sung bệnh án có lý do -> server tự động ghi nhận history
  let vetAmended = await fetch(`${API_URL}/api/data/medical_records/${finalRecordId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vetToken}` },
    body: JSON.stringify({
      amendmentReason: 'Cập nhật diễn biến ngày 2',
      addendumNote: 'Bé đã hạ sốt sau khi dùng kháng sinh'
    })
  });
  let amendedData = await vetAmended.json();
  assert(amendedData.success && amendedData.data.history?.length > 0 && amendedData.data.history[0].version === 1,
    'Server tự tạo version history từ dữ liệu trước thay đổi, không tin client history');

  // 3.6: Xóa bệnh án đã chốt -> bị chặn 403
  let deleteFinal = await fetch(`${API_URL}/api/data/medical_records/${finalRecordId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(deleteFinal.status === 403, 'Chặn xóa bệnh án đã chốt (isFinal: true) (HTTP 403)');

  // =========================================================================
  // MỤC 4: ĐỒNG NHẤT QUYỀN CHO DELETE OBJECT
  // =========================================================================
  console.log('\n--- MỤC 4: ĐỒNG NHẤT QUYỀN CHO DELETE OBJECT ---');

  // Tạo 1 thú cưng khác KHÔNG phân công cho bác sĩ (unassigned pet)
  const unassignedPetId = `pet-unassigned-${Date.now()}`;
  await fetch(`${API_URL}/api/data/pets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify({
      id: unassignedPetId,
      name: 'Bé Không Phân Công',
      species: 'Mèo Mướp'
    })
  });

  // Bác sĩ chưa được phân công cố tình xóa health_data của thú cưng khác
  let vetDeleteHealth = await fetch(`${API_URL}/api/data/health_data/${unassignedPetId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${vetToken}` }
  });
  assert(vetDeleteHealth.status === 403, 'Bác sĩ không được phân công bị chặn xóa health_data của thú cưng khác (HTTP 403)');

  // Bác sĩ cố tình xóa lost_modes -> bị chặn 403
  let vetDeleteLost = await fetch(`${API_URL}/api/data/lost_modes/${unassignedPetId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${vetToken}` }
  });
  assert(vetDeleteLost.status === 403, 'Bác sĩ bị chặn xóa lost_modes của thú cưng (HTTP 403)');

  // =========================================================================
  // MỤC 5: BỔ SUNG VALIDATION VÀ RÀNG BUỘC DỮ LIỆU
  // =========================================================================
  console.log('\n--- MỤC 5: BỔ SUNG VALIDATION VÀ RÀNG BUỘC DỮ LIỆU ---');

  // 5.1: Chi tiêu số âm hoặc 0 -> trả về 400
  let negExpense = await fetch(`${API_URL}/api/data/expenses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify({
      id: `exp-${Date.now()}`,
      petId: testPetId,
      amount: -50000,
      title: 'Mua cát vệ sinh'
    })
  });
  assert(negExpense.status === 400, 'Chặn chi tiêu âm (HTTP 400 INVALID_AMOUNT)');

  // 5.2: Lịch chăm sóc thiếu petId hoặc title -> trả về 400
  let missingSched = await fetch(`${API_URL}/api/data/schedules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify({
      id: `sch-${Date.now()}`,
      title: '   ',
      date: '2026-10-16'
    })
  });
  assert(missingSched.status === 400, 'Chặn lịch thiếu thông tin bắt buộc (HTTP 400)');

  // 5.3: Trùng ID trên POST -> trả về 409 Conflict
  let dupId = `sch-dup-${Date.now()}`;
  await fetch(`${API_URL}/api/data/schedules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify({ id: dupId, petId: testPetId, title: 'Cho ăn sáng', date: '2026-10-16' })
  });
  let dupRes = await fetch(`${API_URL}/api/data/schedules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify({ id: dupId, petId: testPetId, title: 'Cho ăn chiều', date: '2026-10-16' })
  });
  assert(dupRes.status === 409, 'Chặn ID trùng lặp trên POST (HTTP 409 CONFLICT)');

  // 5.4: Sửa ID qua PUT -> trả về 400 IMMUTABLE_ID
  let changeIdRes = await fetch(`${API_URL}/api/data/schedules/${dupId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify({ id: 'sch-new-id', title: 'Cho ăn trưa' })
  });
  assert(changeIdRes.status === 400, 'Chặn sửa ID bản ghi qua body trên PUT (HTTP 400 IMMUTABLE_ID)');

  // =========================================================================
  // MỤC 6: HOÀN THIỆN TRẠNG THÁI LỊCH KHÁM
  // =========================================================================
  console.log('\n--- MỤC 6: HOÀN THIỆN TRẠNG THÁI LỊCH KHÁM ---');

  // 6.1: Owner tạo lịch với confirmed -> Server tự động ép về pending
  const apptId = `app-test-${Date.now()}`;
  let createAppt = await fetch(`${API_URL}/api/data/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify({
      id: apptId,
      petId: testPetId,
      service: 'Khám da liễu',
      date: '2026-10-20',
      time: '10:00',
      status: 'confirmed'
    })
  });
  let apptData = await createAppt.json();
  assert(apptData.success && apptData.data.status === 'pending', 'Owner tạo lịch luôn được server đặt về status: pending');

  // 6.2: Hủy lịch sau đó cố chuyển sang completed -> trả về 400
  await fetch(`${API_URL}/api/data/appointments/${apptId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify({ status: 'cancelled' })
  });
  let invalidTransition = await fetch(`${API_URL}/api/data/appointments/${apptId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({ status: 'completed' })
  });
  assert(invalidTransition.status === 400, 'Ca khám đã bị hủy không thể chuyển thẳng sang completed (HTTP 400)');

  // 6.3: Phân công cho ID bác sĩ không tồn tại hoặc sai vai trò -> trả về 400
  const apptId2 = `app-test-2-${Date.now()}`;
  await fetch(`${API_URL}/api/data/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify({ id: apptId2, petId: testPetId, service: 'Tiêm phòng', date: '2026-10-21', time: '14:00' })
  });
  let assignFakeVet = await fetch(`${API_URL}/api/data/appointments/${apptId2}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({ assignedVetId: 'vet-does-not-exist' })
  });
  assert(assignFakeVet.status === 400, 'Chặn phân công cho ID bác sĩ không tồn tại hoặc sai vai trò (HTTP 400)');

  // =========================================================================
  // MỤC 8: CẬP NHẬT PROFILE VÀ LƯU CÂN NẶNG LÊN SERVER
  // =========================================================================
  console.log('\n--- MỤC 8: CẬP NHẬT PROFILE VÀ LƯU CÂN NẶNG LÊN SERVER ---');

  // 8.1: Cập nhật profile qua PUT /api/auth/profile
  let updateProfileRes = await fetch(`${API_URL}/api/auth/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify({
      name: 'Đinh Xuân Mạnh Pro',
      phone: '0912.999.888',
      address: 'Hà Nội Mới'
    })
  });
  let profileData = await updateProfileRes.json();
  assert(profileData.success && profileData.user.name === 'Đinh Xuân Mạnh Pro' && profileData.user.phone === '0912.999.888',
    'Cập nhật thông tin profile qua PUT /api/auth/profile thành công');

  // 8.2: Lưu cân nặng qua PUT /api/data/health_data/:petId
  let updateWeightRes = await fetch(`${API_URL}/api/data/health_data/${testPetId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify({
      petId: testPetId,
      weight: 15.5,
      weightHistory: [{ date: '2026-10-15', weight: 15.5, note: 'Khám sức khỏe' }]
    })
  });
  let weightData = await updateWeightRes.json();
  assert(weightData.success && weightData.data.weight === 15.5, 'Lưu cân nặng vào health_data qua API xác thực thành công');

  // Kiểm tra đồng bộ sang pets collection trên server
  let checkPetsWeight = await fetch(`${API_URL}/api/data/pets`, {
    headers: { 'Authorization': `Bearer ${ownerToken}` }
  });
  let petsAfterWeight = await checkPetsWeight.json();
  let updatedPetItem = petsAfterWeight.find(p => p.id === testPetId);
  assert(updatedPetItem && updatedPetItem.weight === 15.5, 'Cân nặng tự động đồng bộ sang pet.weight trong bảng pets trên server');

  // =========================================================================
  // MỤC 10: SỬA RESTORE ĐỂ THỰC SỰ TOÀN VẸN VÀ NGUYÊN TỬ
  // =========================================================================
  console.log('\n--- MỤC 10: SỬA RESTORE ĐỂ THỰC SỰ TOÀN VẸN VÀ NGUYÊN TỬ ---');

  // 10.1: Restore dữ liệu vi phạm quan hệ (lịch tham chiếu thú cưng không tồn tại) -> từ chối 400
  let invalidRelationPayload = {
    format: 'petcare_system_enterprise_backup_v2',
    pets: [{ id: 'p-valid', name: 'Chó Valid', ownerId: ownerUser.id }],
    schedules: [{ id: 'sch-invalid', petId: 'p-non-existent', title: 'Lịch ảo', date: '2026-10-16' }]
  };
  let rejectRestore = await fetch(`${API_URL}/api/backup/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify(invalidRelationPayload)
  });
  assert(rejectRestore.status === 400, 'Restore từ chối lịch tham chiếu đến thú cưng không tồn tại (HTTP 400)');

  // 10.2: Test Rollback nguyên tử: Mô phỏng lỗi ghi đĩa giữa chừng
  let rollbackPayload = {
    format: 'petcare_system_enterprise_backup_v2',
    pets: [{ id: 'pet-rollback-test', name: 'Rollback Pet', ownerId: ownerUser.id }],
    schedules: [{ id: 'sch-rollback-test', petId: 'pet-rollback-test', title: 'Lịch Rollback', date: '2026-10-16', ownerId: ownerUser.id }]
  };

  // Gửi request kèm header test mô phỏng lỗi ghi tại schedules
  let failedRestore = await fetch(`${API_URL}/api/backup/restore`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
      'x-test-simulate-write-failure': 'schedules'
    },
    body: JSON.stringify(rollbackPayload)
  });
  let failedRestoreData = await failedRestore.clone().json().catch(() => ({}));
  if (failedRestore.status !== 500) {
    console.log('failedRestore debug info: status =', failedRestore.status, 'data =', failedRestoreData);
  }
  assert(failedRestore.status === 500 && failedRestoreData.error?.includes('Rollback'),
    'Restore phát hiện lỗi ghi đĩa giữa chừng và kích hoạt rollback (HTTP 500)');

  // Kiểm tra dữ liệu sau rollback: pet-rollback-test không được tồn tại (đã rollback hoàn toàn)
  let afterPetsRes = await fetch(`${API_URL}/api/data/pets`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  let afterPets = await afterPetsRes.json();
  assert(!afterPets.some(p => p.id === 'pet-rollback-test'), 'Rollback thành công: Không để lại dữ liệu dở dang (pets giữ nguyên snapshot)');

  // Dọn dẹp pet test
  await fetch(`${API_URL}/api/data/pets/${testPetId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  await fetch(`${API_URL}/api/data/pets/${unassignedPetId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  console.log('\n====================================================');
  console.log(`📊 KẾT QUẢ KIỂM THỬ: ${passed} PASS, ${failed} FAIL`);
  console.log('====================================================');

  if (failed === 0) {
    console.log('🎉 TẤT CẢ CÁC CA KIỂM THỬ ĐÃ VƯỢT QUA 100%!');
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Lỗi thực thi kiểm thử:', err);
  process.exit(1);
});
