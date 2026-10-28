const AUTH_URL = 'http://localhost:5000/api/auth';
const DATA_URL = 'http://localhost:5000/api/data';

const runTest = async () => {
  console.log('====================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ GIAI ĐOẠN 4: LỊCH KHÁM VÀ BÁC SĨ THÚ Y');
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

  const login = async (email, password) => {
    const res = await fetch(`${AUTH_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return res.json();
  };

  try {
    // 1. Đăng nhập Admin và Vet 1 (tester@petcare.ai)
    const adminLogin = await login('admin@petcare.ai', 'Admin@123456');
    const adminToken = adminLogin.token;

    const vetLogin = await login('tester@petcare.ai', 'Doctor@123');
    const vetToken = vetLogin.token;
    const vetId = vetLogin.user.id;

    // 2. Tạo Vet 2 độc lập để kiểm tra phân quyền giữa 2 bác sĩ
    const vet2Email = `vet2_${Date.now()}@petcare.ai`;
    await fetch(`${AUTH_URL}/admin/create-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: 'BS. Bác Sĩ Hai',
        email: vet2Email,
        phone: '0977112233',
        password: 'Doctor@123',
        role: 'vet_doctor'
      })
    });
    const vet2TempLogin = await login(vet2Email, 'Doctor@123');
    await fetch(`${AUTH_URL}/first-login-change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${vet2TempLogin.token}`
      },
      body: JSON.stringify({ newPassword: 'Doctor@456' })
    });
    const vet2Login = await login(vet2Email, 'Doctor@456');
    const vet2Token = vet2Login.token;
    const vet2Id = vet2Login.user.id;

    // 3. Tạo Chủ Nuôi và Thú Cưng
    const ownerEmail = `owner_p4_${Date.now()}@petcare.ai`;
    await fetch(`${AUTH_URL}/admin/create-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: 'Chủ Nuôi Phase 4',
        email: ownerEmail,
        phone: '0988001122',
        password: 'Owner@123',
        role: 'pet_owner'
      })
    });
    const ownerTempLogin = await login(ownerEmail, 'Owner@123');
    await fetch(`${AUTH_URL}/first-login-change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerTempLogin.token}`
      },
      body: JSON.stringify({ newPassword: 'Owner@456' })
    });
    const ownerLogin = await login(ownerEmail, 'Owner@456');
    const ownerToken = ownerLogin.token;
    const ownerId = ownerLogin.user.id;

    // Tạo Thú Cưng A
    const petRes = await fetch(`${DATA_URL}/pets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        name: 'Bé Corgi QA',
        species: 'dog',
        breed: 'Pembroke Welsh Corgi',
        weight: 11.2,
        notes: 'Chưa ghi nhận dị ứng'
      })
    });
    const petData = await petRes.json();
    const petA = petData.data;

    assert(petA && petA.id, '1. Khởi tạo tài khoản và Thú Cưng phục vụ ca khám lâm sàng');

    // 4. Đặt lịch khám và phân công cho Vet 1
    const apptRes = await fetch(`${DATA_URL}/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        petId: petA.id,
        petName: petA.name,
        service: 'Khám nội khoa',
        date: '2026-12-01',
        time: '09:00',
        assignedVetId: vetId,
        status: 'confirmed'
      })
    });
    const apptData = await apptRes.json();
    const appt1 = apptData.data;

    // Phân công thú cưng cho Vet 1
    await fetch(`${DATA_URL}/pets/${petA.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ assignedVetId: vetId })
    });

    assert(appt1 && appt1.assignedVetId === vetId, '2. Lịch khám được phân công chính xác cho Bác sĩ 1');

    // 5. Kiểm tra phân quyền: Vet 2 (không được phân công) cố tình tạo bệnh án cho thú cưng -> Phải trả về 403 Forbidden
    const unassignedSoapRes = await fetch(`${DATA_URL}/medical_records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${vet2Token}`
      },
      body: JSON.stringify({
        petId: petA.id,
        appointmentId: appt1.id,
        subjective: 'Bác sĩ không phân công cố ghi bệnh án',
        assessment: 'Chặn quyền',
        plan: 'Không cho phép',
        isFinal: false
      })
    });
    const unassignedSoapData = await unassignedSoapRes.json();
    assert(unassignedSoapRes.status === 403 && unassignedSoapData.success === false,
      '3. Bác sĩ không được phân công bị chặn quyền tạo bệnh án (HTTP 403 Forbidden)');

    // 6. Vet 1 (được phân công) tạo bệnh án lưu nháp (isFinal: false)
    const draftSoapRes = await fetch(`${DATA_URL}/medical_records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${vetToken}`
      },
      body: JSON.stringify({
        petId: petA.id,
        appointmentId: appt1.id,
        subjective: 'Chủ nuôi báo bé bỏ ăn 1 ngày',
        objective: 'Thân nhiệt 38.8C, bụng mềm',
        assessment: 'Rối loạn tiêu hóa nhẹ',
        plan: 'Bổ sung men vi sinh và điện giải',
        isFinal: false
      })
    });
    const draftSoapData = await draftSoapRes.json();
    const soapRecord = draftSoapData.data;

    assert(draftSoapRes.status === 200 && soapRecord && soapRecord.isFinal === false,
      '4. Bác sĩ phụ trách lưu nháp bệnh án SOAP thành công (isFinal: false)');

    // 7. Vet 1 cập nhật bệnh án nháp (chưa chốt) -> Hợp lệ
    const updateDraftRes = await fetch(`${DATA_URL}/medical_records/${soapRecord.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${vetToken}`
      },
      body: JSON.stringify({
        subjective: 'Chủ nuôi báo bé bỏ ăn 1 ngày, uống ít nước hơn thường lệ'
      })
    });
    const updateDraftData = await updateDraftRes.json();
    assert(updateDraftRes.status === 200 && updateDraftData.data.subjective.includes('uống ít nước'),
      '5. Cập nhật nội dung bệnh án khi đang ở trạng thái bản nháp thành công');

    // 8. Vet 1 chốt bệnh án (isFinal: true) và hoàn thành ca khám (status: 'completed')
    const finalizeRes = await fetch(`${DATA_URL}/medical_records/${soapRecord.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${vetToken}`
      },
      body: JSON.stringify({
        isFinal: true,
        confirmedAt: new Date().toISOString(),
        confirmedBy: 'BS. Hoàng Hải Nam'
      })
    });
    const finalizeData = await finalizeRes.json();
    assert(finalizeRes.status === 200 && finalizeData.data.isFinal === true,
      '6. Bác sĩ ký số chốt bệnh án (isFinal: true)');

    // Hoàn thành ca khám đồng bộ trên server
    await fetch(`${DATA_URL}/appointments/${appt1.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${vetToken}`
      },
      body: JSON.stringify({ status: 'completed' })
    });

    // 9. Cố tình sửa trực tiếp bệnh án đã chốt mà KHÔNG qua history -> Phải trả về 403
    const illegalEditRes = await fetch(`${DATA_URL}/medical_records/${soapRecord.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${vetToken}`
      },
      body: JSON.stringify({
        assessment: 'Thay đổi chẩn đoán trái phép'
      })
    });
    const illegalEditData = await illegalEditRes.json();
    assert(illegalEditRes.status === 403 && illegalEditData.success === false,
      '7. Bệnh án đã chốt (isFinal: true) bị khóa chặt, chặn sửa trực tiếp trái phép (HTTP 403)');

    // 10. Bác sĩ bổ sung phụ lục có phiên bản, lý do, tác giả và thời gian vào history -> Hợp lệ
    const addendumRes = await fetch(`${DATA_URL}/medical_records/${soapRecord.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${vetToken}`
      },
      body: JSON.stringify({
        history: [
          {
            editedAt: new Date().toISOString(),
            authorId: vetId,
            authorName: 'BS. Hoàng Hải Nam',
            reason: 'Bổ sung kết quả xét nghiệm phân sau 2 giờ',
            note: 'Âm tính với ký sinh trùng đường ruột'
          }
        ]
      })
    });
    const addendumData = await addendumRes.json();
    assert(addendumRes.status === 200 && addendumData.data.history.length === 1,
      '8. Bổ sung ghi chú có phiên bản trong history được server chấp nhận hợp lệ');

    // 11. Vet 1 kê đơn thuốc gắn đúng ca khám, thú cưng và bác sĩ
    const prescRes = await fetch(`${DATA_URL}/prescriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${vetToken}`
      },
      body: JSON.stringify({
        appointmentId: appt1.id,
        petId: petA.id,
        petName: petA.name,
        medicines: [
          { name: 'Men tiêu hóa Enterogermina', dose: '1 ống/ngày', days: 5 },
          { name: 'Oresol bổ sung điện giải', dose: '1 gói/ngày', days: 3 }
        ]
      })
    });
    const prescData = await prescRes.json();
    const createdPresc = prescData.data;

    assert(prescRes.status === 200 && createdPresc.ownerId === ownerId && createdPresc.authorId === vetId,
      '9. Đơn thuốc gắn đúng thú cưng, bác sĩ và tự động liên kết ownerId để chủ nuôi xem được');

    // 12. Chủ nuôi truy cập danh sách đơn thuốc và thấy đơn thuốc của thú cưng mình
    const ownerPrescRes = await fetch(`${DATA_URL}/prescriptions`, {
      headers: { 'Authorization': `Bearer ${ownerToken}` }
    });
    const ownerPrescList = await ownerPrescRes.json();
    const foundPresc = ownerPrescList.find(p => p.id === createdPresc.id);

    assert(foundPresc && foundPresc.appointmentId === appt1.id,
      '10. Người nuôi xem đúng đơn thuốc được bác sĩ kê trong phiên khám của mình');

    // 13. Dọn dẹp dữ liệu kiểm thử
    await fetch(`${DATA_URL}/pets/${petA.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${adminToken}` } });
    await fetch(`${DATA_URL}/appointments/${appt1.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${adminToken}` } });
    await fetch(`${DATA_URL}/medical_records/${soapRecord.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${adminToken}` } });
    await fetch(`${DATA_URL}/prescriptions/${createdPresc.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${adminToken}` } });

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
