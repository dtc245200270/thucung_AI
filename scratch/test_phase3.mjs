import { calculatePetNutrition, generateAiCarePlan, analyzePetExpense } from '../src/services/aiService.js';

const AUTH_URL = 'http://localhost:5000/api/auth';
const DATA_URL = 'http://localhost:5000/api/data';

const runTest = async () => {
  console.log('====================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ GIAI ĐOẠN 3: CỔNG NGƯỜI NUÔI VÀ LỊCH CHĂM SÓC');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, name, details = '') => {
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name} ${details ? `(${details})` : ''}`);
      failed++;
    }
  };

  // Helper đăng nhập
  const login = async (email, password) => {
    const res = await fetch(`${AUTH_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return res.json();
  };

  try {
    // 1. Đăng nhập với Admin và Vet
    const adminLogin = await login('admin@petcare.ai', 'Admin@123456');
    const adminToken = adminLogin.token;

    const vetLogin = await login('tester@petcare.ai', 'Doctor@123');
    const vetToken = vetLogin.token;
    const vetId = vetLogin.user.id;

    // Tạo tài khoản Chủ Nuôi kiểm thử độc lập
    const ownerEmail = `qa_owner_${Date.now()}@petcare.ai`;
    const createOwnerRes = await fetch(`${AUTH_URL}/admin/create-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: 'Chủ Nuôi QA Phase 3',
        email: ownerEmail,
        phone: '0987654321',
        password: 'Temp@123456',
        role: 'pet_owner'
      })
    });
    const createOwnerData = await createOwnerRes.json();

    // Login với mật khẩu tạm
    const tempLogin = await login(ownerEmail, 'Temp@123456');
    const tempToken = tempLogin.token;

    // Đổi mật khẩu lần đầu
    await fetch(`${AUTH_URL}/first-login-change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tempToken}`
      },
      body: JSON.stringify({
        newPassword: 'Owner@123456'
      })
    });

    // Login chính thức
    const ownerLogin = await login(ownerEmail, 'Owner@123456');
    const ownerToken = ownerLogin.token;
    const ownerId = ownerLogin.user.id;

    assert(adminToken && ownerToken && vetToken, '1. Đăng nhập thành công 3 vai trò với JWT token hợp lệ');

    // 2. Tạo thú cưng kiểm thử cho Owner (không nhập cân nặng, ngày sinh)
    const uniquePetName = `PetQA_${Date.now()}`;
    const createPetRes = await fetch(`${DATA_URL}/pets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        name: uniquePetName,
        species: 'dog',
        breed: 'Golden Retriever',
        weight: null,
        birthDate: null
      })
    });
    const createdPetData = await createPetRes.json();
    const testPet = createdPetData.data;

    assert(createPetRes.status === 200 && testPet && testPet.weight === null, 
      '2. Tạo thú cưng với weight null lưu chính xác null trên server (không tự sinh cân nặng giả)');

    // 3. Phân công thú cưng cho bác sĩ
    await fetch(`${DATA_URL}/pets/${testPet.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ assignedVetId: vetId })
    });

    // 4. Đặt lịch khám lần 1 cho thú cưng
    const testDate = '2026-11-20';
    const testTime = '14:30';
    const appt1Res = await fetch(`${DATA_URL}/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        petId: testPet.id,
        petName: testPet.name,
        service: 'Khám tổng quát',
        date: testDate,
        time: testTime,
        assignedVetId: vetId,
        status: 'pending'
      })
    });
    const appt1Data = await appt1Res.json();
    const appt1 = appt1Data.data;

    assert(appt1Res.status === 200 && appt1 && appt1.id, 
      '3. Người nuôi đặt lịch hẹn thành công (status: pending, ngày giờ hợp lệ)');

    // 5. Thử đặt lịch trùng khung giờ và ngày cho cùng thú cưng (Collision check 1)
    const collisionRes1 = await fetch(`${DATA_URL}/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        petId: testPet.id,
        petName: testPet.name,
        service: 'Khám da liễu',
        date: testDate,
        time: testTime,
        status: 'pending'
      })
    });
    const collisionData1 = await collisionRes1.json();
    assert(collisionRes1.status === 409 && collisionData1.code === 'APPOINTMENT_COLLISION',
      '4. Backend phát hiện và chặn trùng lịch (Collision 409) cho cùng thú cưng trên cùng khung giờ');

    // Admin phân công bác sĩ cho appt1
    await fetch(`${DATA_URL}/appointments/${appt1.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ assignedVetId: vetId })
    });

    // 6. Thử tạo lịch hẹn thứ 2 trùng khung giờ cho cùng bác sĩ (Collision check 2)
    const pet2Res = await fetch(`${DATA_URL}/pets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        name: `PetQA2_${Date.now()}`,
        species: 'cat',
        weight: 3.5
      })
    });
    const pet2Data = await pet2Res.json();
    const testPet2 = pet2Data.data;

    const collisionRes2 = await fetch(`${DATA_URL}/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        petId: testPet2.id,
        petName: testPet2.name,
        service: 'Tiêm phòng',
        date: testDate,
        time: testTime,
        assignedVetId: vetId,
        status: 'pending'
      })
    });
    const collisionData2 = await collisionRes2.json();
    assert(collisionRes2.status === 409 && collisionData2.code === 'APPOINTMENT_COLLISION',
      '5. Backend chặn trùng lịch (Collision 409) khi bác sĩ đã có hẹn trong cùng khung giờ');

    // 7. Người nuôi thử gửi trường đặc quyền khi tạo lịch hẹn (isFinal, confirmedBy, status='completed')
    const privilegeApptRes = await fetch(`${DATA_URL}/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        petId: testPet2.id,
        date: '2026-11-21',
        time: '10:00',
        status: 'completed',
        isFinal: true,
        confirmedBy: 'Hacker'
      })
    });
    const privilegeApptData = await privilegeApptRes.json();
    const createdPrivilegeAppt = privilegeApptData.data;

    assert(createdPrivilegeAppt.status === 'pending' && !createdPrivilegeAppt.isFinal && !createdPrivilegeAppt.confirmedBy,
      '6. Server lọc bỏ các trường đặc quyền khi người nuôi gửi (isFinal, confirmedBy bị xóa, status buộc thành pending)');

    // 8. Bác sĩ hoàn thành ca khám appt1 (status: completed)
    await fetch(`${DATA_URL}/appointments/${appt1.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${vetToken}`
      },
      body: JSON.stringify({ status: 'completed' })
    });

    // 9. Người nuôi cố gắng hủy ca khám đã completed -> Phải bị từ chối với HTTP 400
    const cancelCompletedRes = await fetch(`${DATA_URL}/appointments/${appt1.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerToken}`
      },
      body: JSON.stringify({ status: 'cancelled' })
    });
    const cancelCompletedData = await cancelCompletedRes.json();
    assert(cancelCompletedRes.status === 400 && cancelCompletedData.success === false,
      '7. Người nuôi không thể hủy hoặc thay đổi lịch khám đã hoàn thành (completed) hoặc đang diễn ra');

    // 10. Người nuôi hủy lịch hẹn pending hợp lệ (privilegeAppt)
    const cancelPendingRes = await fetch(`${DATA_URL}/appointments/${createdPrivilegeAppt.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerToken}`
      },
      body: JSON.stringify({ status: 'cancelled' })
    });
    const cancelPendingData = await cancelPendingRes.json();
    assert(cancelPendingRes.status === 200 && cancelPendingData.data.status === 'cancelled',
      '8. Người nuôi hủy thành công lịch hẹn đang pending theo đúng quyền');

    // 11. Bác sĩ tạo SOAP Medical Record cho testPet
    const soapRes = await fetch(`${DATA_URL}/medical_records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${vetToken}`
      },
      body: JSON.stringify({
        petId: testPet.id,
        appointmentId: appt1.id,
        subjective: 'Bé mệt mỏi, ăn ít',
        objective: 'Nhiệt độ 38.6, không sốt',
        assessment: 'Viêm dạ dày nhẹ',
        plan: 'Uống men tiêu hóa 5 ngày',
        isFinal: true
      })
    });
    const soapData = await soapRes.json();
    const createdSoap = soapData.data;

    assert(soapRes.status === 200 && createdSoap.ownerId === ownerId,
      '9. Bệnh án SOAP do bác sĩ tạo tự động gán đúng ownerId của chủ nuôi để người nuôi xem được');

    // 12. Người nuôi truy vấn bệnh án của thú cưng mình
    const ownerMedicalRes = await fetch(`${DATA_URL}/medical_records`, {
      headers: { 'Authorization': `Bearer ${ownerToken}` }
    });
    const ownerMedicalList = await ownerMedicalRes.json();
    const foundRecord = ownerMedicalList.find(r => r.id === createdSoap.id);

    assert(foundRecord && foundRecord.petId === testPet.id,
      '10. Người nuôi xem đúng bệnh án SOAP của thú cưng trong cổng của mình');

    // 13. Kiểm tra hàm dinh dưỡng AI khi thiếu cân nặng (không tự sinh số 15kg/4kg)
    const nutResult = calculatePetNutrition({ name: 'Bé QA', weight: null });
    assert(nutResult.hasMissingWeight === true && nutResult.calories === null,
      '11. calculatePetNutrition trả hasMissingWeight: true và calories: null khi thú cưng chưa có cân nặng');

    // 14. Kiểm tra hàm kế hoạch AI khi thiếu cân nặng (không tự sinh 20kg)
    const planResult = generateAiCarePlan({ name: 'Bé QA', weight: null });
    const hasFake20kg = JSON.stringify(planResult).includes('20kg') || JSON.stringify(planResult).includes('20 kg');
    assert(!hasFake20kg,
      '12. generateAiCarePlan không tự chèn 20kg giả định khi chưa có cân nặng');

    // 15. Kiểm tra hàm phân tích chi tiêu khi chưa có khoản chi (không khen ngân sách cân bằng)
    const expenseAnalysis = analyzePetExpense([], { name: 'Bé QA' });
    assert(expenseAnalysis.totalSpent === 0 && expenseAnalysis.advice.includes('Chưa có khoản chi tiêu nào'),
      '13. analyzePetExpense không tự nhận xét cân bằng tài chính khi mảng chi tiêu rỗng');

    // 16. Dọn dẹp dữ liệu kiểm thử
    await fetch(`${DATA_URL}/pets/${testPet.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    await fetch(`${DATA_URL}/pets/${testPet2.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    await fetch(`${DATA_URL}/appointments/${appt1.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    await fetch(`${DATA_URL}/appointments/${createdPrivilegeAppt.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    console.log(`\n====================================================`);
    console.log(`📊 KẾT QUẢ KIỂM THỬ: ${passed} PASS, ${failed} FAIL`);
    console.log(`====================================================\n`);

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('Lỗi ngoại lệ trong quá trình kiểm thử:', error);
    process.exit(1);
  }
};

runTest();
