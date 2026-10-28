// Test Suite: Part 2 Independent Defect Coverage & Regression
import fetch from 'node-fetch';

const API_URL = 'http://localhost:5000';

async function runPart2Tests() {
  console.log('================================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ ĐỘC LẬP BỔ SUNG: 8 CA KIỂM THỬ BẮT BUỘC');
  console.log('================================================================\n');

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

  // -------------------------------------------------------------
  // BƯỚC 0: CHUẨN BỊ MÔI TRƯỜNG & TÀI KHOẢN TEST
  // -------------------------------------------------------------
  console.log('--- KHỞI TẠO TÀI KHOẢN VÀ THÚ CƯNG TEST ---');
  const adminRes = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@petcare.ai', password: 'Admin@123456' })
  });
  const adminData = await adminRes.json();
  const adminToken = adminData.token;
  assert(adminToken != null, 'Admin đăng nhập thành công');

  const vetRes = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'tester@petcare.ai', password: 'Doctor@123' })
  });
  const vetData = await vetRes.json();
  const vetToken = vetData.token;
  assert(vetToken != null, 'Bác sĩ đăng nhập thành công');

  const ownerEmail = `owner_reg_${Date.now()}@petcare.ai`;
  const createOwnerRes = await fetch(`${API_URL}/api/auth/admin/create-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({
      callerId: adminData.user.id,
      name: 'Chủ Nuôi Nghiệm Thu',
      email: ownerEmail,
      role: 'pet_owner',
      phone: '0988776655',
      password: 'OwnerPassword@123'
    })
  });
  const ownerCreated = await createOwnerRes.json();
  const ownerUser = ownerCreated.user;

  const loginOwnerTemp = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ownerEmail, password: 'OwnerPassword@123' })
  });
  const ownerTempData = await loginOwnerTemp.json();

  const firstLoginRes = await fetch(`${API_URL}/api/auth/first-login-change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerTempData.token}` },
    body: JSON.stringify({
      userId: ownerUser.id,
      newPassword: 'OwnerPassword@Real123'
    })
  });
  const firstLoginData = await firstLoginRes.json();
  const ownerToken = firstLoginData.token;
  assert(ownerToken != null, 'Chủ nuôi đổi mật khẩu lần đầu và nhận token hợp lệ');

  // Tạo thú cưng ban đầu cho chủ nuôi
  const createPetRes = await fetch(`${API_URL}/api/data/pets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify({
      id: `pet-reg-${Date.now()}`,
      name: 'Bé Bông Nghiệm Thu',
      species: 'dog',
      breed: 'Poodle',
      weight: 4.5
    })
  });
  const petCreated = await createPetRes.json();
  const testPetId = petCreated.data?.id;
  assert(testPetId != null, `Đã tạo thú cưng ban đầu: ${testPetId}`);

  // -------------------------------------------------------------
  // CA 1: ĐẶT LỊCH QUA ĐÚNG CALLBACK GIAO DIỆN KHÔNG GỬI LƯU THỪA
  // -------------------------------------------------------------
  console.log('\n--- CA 1: LUỒNG ĐẶT LỊCH ĐƠN NHẤT & CALLBACK GIAO DIỆN ---');
  // 1. Modal thực hiện POST /api/data/appointments thành công
  const bookingApptData = {
    id: `BK-TEST-${Date.now()}`,
    petId: testPetId,
    petName: 'Bé Bông Nghiệm Thu',
    ownerName: 'Chủ Nuôi Nghiệm Thu',
    phone: '0988776655',
    service: 'Khám tổng quát định kỳ',
    facility: 'Chi nhánh Cầu Giấy',
    date: '2026-10-25',
    time: '09:30',
    status: 'pending',
    note: 'Kiểm tra sức khỏe tổng quát'
  };

  const modalPostRes = await fetch(`${API_URL}/api/data/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify(bookingApptData)
  });
  const modalPostData = await modalPostRes.json();
  assert(modalPostRes.ok && modalPostData.success === true, 'VetBookingModal tạo lịch hẹn thành công (lần 1)');

  // 2. Mô phỏng callback handleSaveAppointment nhận bản ghi đã lưu:
  // Nếu callback phát hiện bản ghi đã tồn tại trong danh sách, chỉ cập nhật state giao diện
  // KHÔNG gọi updateAppointment (PUT với status: pending)
  const existingApptsRes = await fetch(`${API_URL}/api/data/appointments`, {
    headers: { 'Authorization': `Bearer ${ownerToken}` }
  });
  const existingAppts = await existingApptsRes.json();
  const found = Array.isArray(existingAppts) && existingAppts.find(a => a.id === bookingApptData.id);
  assert(found != null, 'Lịch khám đã có sẵn trong danh sách sau khi modal lưu');

  // Kiểm tra: nếu gửi PUT /appointments với status: pending từ owner, server từ chối vì owner chỉ được cancel
  const redundantPutRes = await fetch(`${API_URL}/api/data/appointments/${bookingApptData.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify(bookingApptData)
  });
  assert(redundantPutRes.status === 400, 'Server từ chối yêu cầu PUT đè status: pending từ chủ nuôi (chứng minh logic mới chặn gọi thừa là thiết yếu)');

  // Kiểm tra chỉ duy nhất 1 bản ghi được tạo
  const matchCount = Array.isArray(existingAppts) ? existingAppts.filter(a => a.id === bookingApptData.id).length : 0;
  assert(matchCount === 1, 'Chỉ có duy nhất 1 bản ghi lịch hẹn được tạo, không bị duplicate');

  // -------------------------------------------------------------
  // CA 2: BACKEND TỪ CHỐI CÂN NẶNG ÂM / SAI KIỂU
  // -------------------------------------------------------------
  console.log('\n--- CA 2: BACKEND TỪ CHỐI CÂN NẶNG ÂM HOẶC SAI KIỂU ---');
  // POST cân nặng âm
  const negWeightPost = await fetch(`${API_URL}/api/data/pets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify({ name: 'Chó âm cân', weight: -3.5 })
  });
  assert(negWeightPost.status === 400, 'POST từ chối cân nặng âm -3.5 kg (HTTP 400)');

  // POST cân nặng sai kiểu chuỗi
  const strWeightPost = await fetch(`${API_URL}/api/data/pets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify({ name: 'Chó chữ cân', weight: 'không_biết' })
  });
  assert(strWeightPost.status === 400, 'POST từ chối cân nặng sai kiểu "không_biết" (HTTP 400)');

  // POST cân nặng bằng 0 hoặc boolean
  const boolWeightPost = await fetch(`${API_URL}/api/data/pets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify({ name: 'Chó bool', weight: true })
  });
  assert(boolWeightPost.status === 400, 'POST từ chối cân nặng kiểu boolean (HTTP 400)');

  // PUT cân nặng âm trên thú cưng hiện tại
  const negWeightPut = await fetch(`${API_URL}/api/data/pets/${testPetId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify({ weight: -10 })
  });
  assert(negWeightPut.status === 400, 'PUT từ chối cân nặng âm -10 kg (HTTP 400)');

  // PUT cân nặng âm trên health_data
  const negHealthWeight = await fetch(`${API_URL}/api/data/health_data/${testPetId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify({ weight: -2.5 })
  });
  assert(negHealthWeight.status === 400, 'PUT health_data từ chối cân nặng âm -2.5 kg (HTTP 400)');

  // Xác minh dữ liệu cũ của thú cưng vẫn được giữ nguyên
  const petCheckRes = await fetch(`${API_URL}/api/data/pets`, {
    headers: { 'Authorization': `Bearer ${ownerToken}` }
  });
  const currentPets = await petCheckRes.json();
  const originalPet = currentPets.find(p => p.id === testPetId);
  assert(originalPet.weight === 4.5, `Cân nặng thú cưng giữ nguyên giá trị hợp lệ cũ (${originalPet.weight} kg)`);

  // -------------------------------------------------------------
  // CA 3: PUT KHÔNG ĐỔI ID SANG RỖNG / NULL / ID KHÁC
  // -------------------------------------------------------------
  console.log('\n--- CA 3: PUT KHÔNG CHO ĐỔI ID TRONG MỌI TRƯỜNG HỢP ---');
  // Đổi sang ID khác
  const diffIdPut = await fetch(`${API_URL}/api/data/pets/${testPetId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify({ id: 'pet-new-hacked-id', name: 'Đổi tên' })
  });
  assert(diffIdPut.status === 400, 'PUT từ chối đổi sang ID khác (HTTP 400 IMMUTABLE_ID)');

  // Đổi sang chuỗi rỗng
  const emptyIdPut = await fetch(`${API_URL}/api/data/pets/${testPetId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify({ id: '', name: 'Đổi tên' })
  });
  assert(emptyIdPut.status === 400, 'PUT từ chối ID là chuỗi rỗng (HTTP 400 IMMUTABLE_ID)');

  // Đổi sang null
  const nullIdPut = await fetch(`${API_URL}/api/data/pets/${testPetId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify({ id: null, name: 'Đổi tên' })
  });
  assert(nullIdPut.status === 400, 'PUT từ chối ID là null (HTTP 400 IMMUTABLE_ID)');

  // -------------------------------------------------------------
  // CA 4: PUT KHÔNG XÓA TRẮNG PETID / NGÀY CỦA LỊCH CHĂM SÓC
  // -------------------------------------------------------------
  console.log('\n--- CA 4: PUT KHÔNG XÓA TRẮNG TRƯỜNG BẮT BUỘC CỦA LỊCH CHĂM SÓC ---');
  // Tạo lịch chăm sóc mẫu
  const schId = `sch-test-${Date.now()}`;
  const createSchRes = await fetch(`${API_URL}/api/data/schedules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify({
      id: schId,
      petId: testPetId,
      title: 'Tắm spa trị nấm',
      date: '2026-10-22'
    })
  });
  assert(createSchRes.ok, 'Tạo lịch chăm sóc mẫu thành công');

  // PUT xóa trắng petId
  const blankPetSch = await fetch(`${API_URL}/api/data/schedules/${schId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify({ petId: '' })
  });
  assert(blankPetSch.status === 400, 'PUT từ chối xóa trắng petId về chuỗi rỗng (HTTP 400)');

  // PUT xóa trắng tiêu đề
  const blankTitleSch = await fetch(`${API_URL}/api/data/schedules/${schId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify({ title: '   ' })
  });
  assert(blankTitleSch.status === 400, 'PUT từ chối xóa trắng tiêu đề về khoảng trắng (HTTP 400)');

  // PUT gán ngày không hợp lệ
  const invalidDateSch = await fetch(`${API_URL}/api/data/schedules/${schId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify({ date: 'not-a-date' })
  });
  assert(invalidDateSch.status === 400, 'PUT từ chối ngày không hợp lệ (HTTP 400)');

  // Xác minh dữ liệu lịch cũ không bị biến mất hoặc hỏng
  const getSchRes = await fetch(`${API_URL}/api/data/schedules`, {
    headers: { 'Authorization': `Bearer ${ownerToken}` }
  });
  const allSch = await getSchRes.json();
  const currentSch = allSch.find(s => s.id === schId);
  assert(currentSch.petId === testPetId && currentSch.title === 'Tắm spa trị nấm' && currentSch.date === '2026-10-22', 'Dữ liệu lịch chăm sóc cũ được giữ nguyên vẹn 100%');

  // -------------------------------------------------------------
  // CA 5: NGÀY GIỜ HẸN SAI BỊ TỪ CHỐI
  // -------------------------------------------------------------
  console.log('\n--- CA 5: NGÀY GIỜ HẸN SAI BỊ TỪ CHỐI CHẶT CHẼ ---');
  // Ngày không tồn tại: 2026-02-29 (2026 không phải năm nhuận)
  const leapDatePost = await fetch(`${API_URL}/api/data/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify({
      petId: testPetId,
      date: '2026-02-29',
      time: '10:00'
    })
  });
  assert(leapDatePost.status === 400, 'Từ chối ngày không tồn tại 2026-02-29 (năm không nhuận) (HTTP 400)');

  // Ngày không tồn tại: 2026-04-31 (tháng 4 chỉ có 30 ngày)
  const april31Post = await fetch(`${API_URL}/api/data/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify({
      petId: testPetId,
      date: '2026-04-31',
      time: '10:00'
    })
  });
  assert(april31Post.status === 400, 'Từ chối ngày không tồn tại 2026-04-31 (tháng 4 có 30 ngày) (HTTP 400)');

  // Giờ sai phạm vi: 99:99
  const time99Post = await fetch(`${API_URL}/api/data/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify({
      petId: testPetId,
      date: '2026-10-25',
      time: '99:99'
    })
  });
  assert(time99Post.status === 400, 'Từ chối giờ hẹn sai định dạng/phạm vi "99:99" (HTTP 400)');

  // Giờ sai phạm vi: 25:00
  const time25Post = await fetch(`${API_URL}/api/data/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify({
      petId: testPetId,
      date: '2026-10-25',
      time: '25:00'
    })
  });
  assert(time25Post.status === 400, 'Từ chối giờ hẹn vượt quá 24h "25:00" (HTTP 400)');

  // -------------------------------------------------------------
  // CA 6: GHI FILE THẤT BẠI TRẢ LỖI VÀ KHÔNG TẠO BẢN GHI
  // -------------------------------------------------------------
  console.log('\n--- CA 6: GHI FILE THẤT BẠI TRẢ LỖI VÀ KHÔNG TẠO BẢN GHI ---');
  const failApptId = `BK-FAIL-${Date.now()}`;
  const saveFailPost = await fetch(`${API_URL}/api/data/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`,
      'x-simulate-save-failure': 'appointments'
    },
    body: JSON.stringify({
      id: failApptId,
      petId: testPetId,
      date: '2026-10-26',
      time: '15:00'
    })
  });
  assert(saveFailPost.status === 500, 'Ghi file appointments thất bại trả HTTP 500 STORAGE_WRITE_ERROR');

  // Kiểm tra bản ghi tuyệt đối không được ghi nhận trong danh sách
  const checkFailRes = await fetch(`${API_URL}/api/data/appointments`, {
    headers: { 'Authorization': `Bearer ${ownerToken}` }
  });
  const checkFailAppts = await checkFailRes.json();
  const phantomRecord = checkFailAppts.find(a => a.id === failApptId);
  assert(phantomRecord == null, 'Bản ghi không hề tồn tại trong bộ nhớ hay file sau khi ghi thất bại');

  // -------------------------------------------------------------
  // CA 7: GHI NHIỀU FILE THẤT BẠI KHÔNG ĐỂ TRẠNG THÁI MỘT PHẦN
  // -------------------------------------------------------------
  console.log('\n--- CA 7: GHI NHIỀU FILE THẤT BẠI KHÔNG ĐỂ TRẠNG THÁI MỘT PHẦN (ATOMIC ROLLBACK) ---');
  // Cập nhật health_data đồng bộ sang pets, nhưng mô phỏng lỗi ghi file pets
  const prevHealthRes = await fetch(`${API_URL}/api/data/health_data`, {
    headers: { 'Authorization': `Bearer ${ownerToken}` }
  });
  const prevHealthData = await prevHealthRes.json();
  const prevWeight = prevHealthData[testPetId]?.weight || originalPet.weight;

  const multiFailPut = await fetch(`${API_URL}/api/data/health_data/${testPetId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`,
      'x-simulate-save-failure': 'pets' // Làm fail file thứ 2 trong transaction
    },
    body: JSON.stringify({ weight: 99.9, note: 'Khám sức khỏe giao dịch nguyên tử' })
  });
  assert(multiFailPut.status === 500, 'Giao dịch đa tệp thất bại ở tệp thứ hai trả HTTP 500');

  // Kiểm tra cả health_data và pets đều không bị cập nhật dở dang (đã rollback)
  const afterHealthRes = await fetch(`${API_URL}/api/data/health_data`, {
    headers: { 'Authorization': `Bearer ${ownerToken}` }
  });
  const afterHealthData = await afterHealthRes.json();
  assert(afterHealthData[testPetId]?.weight !== 99.9, 'health_data không bị ghi nhận giá trị dở dang 99.9 kg (đã rollback)');

  const afterPetRes = await fetch(`${API_URL}/api/data/pets`, {
    headers: { 'Authorization': `Bearer ${ownerToken}` }
  });
  const afterPets = await afterPetRes.json();
  const rollbackPet = afterPets.find(p => p.id === testPetId);
  assert(rollbackPet.weight === 4.5, `pets.weight vẫn giữ nguyên ${rollbackPet.weight} kg, không bị trạng thái một phần`);

  // -------------------------------------------------------------
  // CA 8: CÁC CA ĐÚNG VẪN LƯU ĐƯỢC VÀ TỒN TẠI SAU RELOAD/PHIÊN KHÁC
  // -------------------------------------------------------------
  console.log('\n--- CA 8: CÁC DỮ LIỆU ĐÚNG VẪN LƯU VÀ TỒN TẠI BỀN VỮNG ---');
  // 1. Tạo thú cưng hợp lệ
  const validPetRes = await fetch(`${API_URL}/api/data/pets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify({
      id: `pet-valid-${Date.now()}`,
      name: 'Miu Miu Bền Vững',
      species: 'cat',
      breed: 'Anh lông ngắn',
      weight: 3.8
    })
  });
  const validPetData = await validPetRes.json();
  const validPetId = validPetData.data.id;
  assert(validPetRes.ok && validPetData.data.weight === 3.8, 'Tạo thú cưng hợp lệ thành công');

  // 2. Tạo lịch chăm sóc hợp lệ
  const validSchRes = await fetch(`${API_URL}/api/data/schedules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify({
      id: `sch-valid-${Date.now()}`,
      petId: validPetId,
      title: 'Tiêm phòng 4 bệnh mèo',
      date: '2026-11-05'
    })
  });
  const validSchData = await validSchRes.json();
  assert(validSchRes.ok && validSchData.data.title === 'Tiêm phòng 4 bệnh mèo', 'Tạo lịch chăm sóc hợp lệ thành công');

  // 3. Tạo lịch khám hợp lệ
  const validApptRes = await fetch(`${API_URL}/api/data/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify({
      id: `BK-VALID-${Date.now()}`,
      petId: validPetId,
      date: '2026-11-05',
      time: '14:00',
      status: 'pending',
      service: 'Tiêm vắc-xin & Tẩy giun'
    })
  });
  const validApptData = await validApptRes.json();
  assert(validApptRes.ok && validApptData.data.time === '14:00', 'Tạo lịch khám hợp lệ thành công');

  // 4. Giả lập đăng xuất và đăng nhập phiên mới hoàn toàn
  const newSessionLogin = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ownerEmail, password: 'OwnerPassword@Real123' })
  });
  const newSessionData = await newSessionLogin.json();
  const newOwnerToken = newSessionData.token;
  assert(newOwnerToken != null, 'Đăng nhập phiên mới hoàn toàn thành công');

  // 5. Kiểm tra dữ liệu tồn tại bền vững qua phiên mới
  const verifyPets = await (await fetch(`${API_URL}/api/data/pets`, { headers: { 'Authorization': `Bearer ${newOwnerToken}` } })).json();
  const verifySchs = await (await fetch(`${API_URL}/api/data/schedules`, { headers: { 'Authorization': `Bearer ${newOwnerToken}` } })).json();
  const verifyAppts = await (await fetch(`${API_URL}/api/data/appointments`, { headers: { 'Authorization': `Bearer ${newOwnerToken}` } })).json();

  const persistedPet = verifyPets.find(p => p.id === validPetId);
  const persistedSch = verifySchs.find(s => s.id === validSchData.data.id);
  const persistedAppt = verifyAppts.find(a => a.id === validApptData.data.id);

  assert(persistedPet && persistedPet.name === 'Miu Miu Bền Vững' && persistedPet.weight === 3.8, 'Thú cưng tồn tại bền vững qua phiên đăng nhập mới');
  assert(persistedSch && persistedSch.title === 'Tiêm phòng 4 bệnh mèo', 'Lịch chăm sóc tồn tại bền vững qua phiên đăng nhập mới');
  assert(persistedAppt && persistedAppt.date === '2026-11-05' && persistedAppt.time === '14:00', 'Lịch khám tồn tại bền vững qua phiên đăng nhập mới');

  // -------------------------------------------------------------
  // TỔNG KẾT
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`📊 KẾT QUẢ KIỂM THỬ BỔ SUNG: ${passed} PASS, ${failed} FAIL`);
  console.log('================================================================');
  if (failed > 0) {
    process.exit(1);
  }
}

runPart2Tests().catch(err => {
  console.error('Lỗi thực thi kiểm thử bổ sung:', err);
  process.exit(1);
});
