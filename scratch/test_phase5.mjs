// Phase 5 Test Suite: Admin Portal, Audit Logs, AI Knowledge Docs, Doctor Assignment & Safeguards
const BASE_URL = 'http://localhost:5000';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  let data;
  try {
    data = await res.json();
  } catch (err) {
    data = null;
  }
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('🚀 Bắt đầu kiểm thử Phase 5: Admin Portal, Audit Logs, AI Docs & Safeguards...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Đăng nhập Admin
  console.log('1. Đăng nhập tài khoản Admin');
  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@petcare.ai', password: 'Admin@123456' })
  });
  assert(adminLogin.status === 200 && adminLogin.data.token, 'Admin đăng nhập thành công và nhận JWT');
  const adminToken = adminLogin.data?.token;

  // 2. Bảo vệ endpoint Admin: Người dùng thường không thể truy cập Audit Logs hoặc AI Docs
  console.log('\n2. Kiểm tra RBAC: Non-admin không được gọi endpoint quản trị');
  const vetLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'tester@petcare.ai', password: 'Doctor@123' })
  });
  const vetToken = vetLogin.data?.token;

  const vetAudit = await request('/api/admin/audit-logs', {
    headers: { Authorization: `Bearer ${vetToken}` }
  });
  assert(vetAudit.status === 403, 'Non-admin gọi /api/admin/audit-logs bị chặn với HTTP 403');

  const vetDocs = await request('/api/admin/docs', {
    headers: { Authorization: `Bearer ${vetToken}` }
  });
  assert(vetDocs.status === 403, 'Non-admin gọi /api/admin/docs bị chặn với HTTP 403');

  // 3. Admin gọi /api/admin/audit-logs thành công
  console.log('\n3. Admin truy vấn danh sách Audit Logs');
  const adminAudit = await request('/api/admin/audit-logs', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(adminAudit.status === 200 && Array.isArray(adminAudit.data.data), 'Admin lấy danh sách audit logs thành công (HTTP 200)');

  // 4. Tạo người dùng mới và kiểm tra ghi nhận USER_CREATE trong Audit Log
  console.log('\n4. Kiểm tra ghi nhận USER_CREATE trong Audit Logs khi Admin tạo tài khoản');
  const testUserEmail = `audit_test_${Date.now()}@example.com`;
  const createUserRes = await request('/api/auth/admin/create-user', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'Audit Test User',
      email: testUserEmail,
      phone: '0988776655',
      role: 'pet_owner',
      password: 'TempPassword123'
    })
  });
  assert(createUserRes.status === 200 && createUserRes.data.success, 'Admin tạo tài khoản người dùng thành công');
  const createdUserId = createUserRes.data.user.id;

  const auditAfterCreate = await request('/api/admin/audit-logs', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const createLog = auditAfterCreate.data.data.find(l => l.action === 'USER_CREATE' && l.targetId === createdUserId);
  assert(createLog && createLog.actorEmail === 'admin@petcare.ai', 'Nhật ký USER_CREATE được ghi nhận chính xác với thông tin người thực hiện');

  // 5. Khóa và Mở khóa tài khoản, kiểm tra ghi nhận USER_LOCK / USER_UNLOCK
  console.log('\n5. Kiểm tra ghi nhận USER_LOCK và USER_UNLOCK trong Audit Logs');
  const lockRes = await request(`/api/auth/users/${createdUserId}/toggle-lock`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(lockRes.status === 200 && lockRes.data.isLocked === true, 'Admin khóa tài khoản thành công');

  const auditAfterLock = await request('/api/admin/audit-logs', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const lockLog = auditAfterLock.data.data.find(l => l.action === 'USER_LOCK' && l.targetId === createdUserId);
  assert(lockLog && lockLog.result === 'SUCCESS', 'Nhật ký USER_LOCK được ghi nhận thành công');

  const unlockRes = await request(`/api/auth/users/${createdUserId}/toggle-lock`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(unlockRes.status === 200 && unlockRes.data.isLocked === false, 'Admin mở khóa tài khoản thành công');

  const auditAfterUnlock = await request('/api/admin/audit-logs', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const unlockLog = auditAfterUnlock.data.data.find(l => l.action === 'USER_UNLOCK' && l.targetId === createdUserId);
  assert(unlockLog && unlockLog.result === 'SUCCESS', 'Nhật ký USER_UNLOCK được ghi nhận thành công');

  // 6. Đặt lại mật khẩu tạm thời và kiểm tra USER_RESET_PASSWORD
  console.log('\n6. Kiểm tra ghi nhận USER_RESET_PASSWORD trong Audit Logs');
  const resetRes = await request('/api/auth/admin/reset-password', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      targetUserId: createdUserId,
      newTemporaryPassword: 'NewTempPassword123'
    })
  });
  assert(resetRes.status === 200 && resetRes.data.success, 'Admin đặt lại mật khẩu tạm thời thành công');

  const auditAfterReset = await request('/api/admin/audit-logs', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const resetLog = auditAfterReset.data.data.find(l => l.action === 'USER_RESET_PASSWORD' && l.targetId === createdUserId);
  assert(resetLog && resetLog.result === 'SUCCESS', 'Nhật ký USER_RESET_PASSWORD được ghi nhận thành công');

  // 7. Chặn tự khóa và tự xóa tài khoản Admin cuối cùng
  console.log('\n7. Kiểm tra cơ chế bảo vệ: Không cho phép tự khóa hoặc tự xóa Admin đang đăng nhập');
  const selfLockRes = await request(`/api/auth/users/${adminLogin.data.user.id}/toggle-lock`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(selfLockRes.status === 400, 'Tự khóa chính Admin đang đăng nhập bị chặn (HTTP 400)');

  const selfDeleteRes = await request('/api/auth/admin/delete-user', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      targetUserId: adminLogin.data.user.id,
      confirmEmail: adminLogin.data.user.email
    })
  });
  assert(selfDeleteRes.status === 400, 'Tự xóa chính Admin đang đăng nhập bị chặn (HTTP 400)');

  // 8. Xóa tài khoản người dùng thử nghiệm và kiểm tra USER_DELETE
  console.log('\n8. Kiểm tra ghi nhận USER_DELETE trong Audit Logs khi Admin xóa người dùng');
  const deleteRes = await request('/api/auth/admin/delete-user', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      targetUserId: createdUserId,
      confirmEmail: testUserEmail
    })
  });
  assert(deleteRes.status === 200 && deleteRes.data.success, 'Admin xóa tài khoản người dùng thành công');

  const auditAfterDelete = await request('/api/admin/audit-logs', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const deleteLog = auditAfterDelete.data.data.find(l => l.action === 'USER_DELETE' && l.targetId === createdUserId);
  assert(deleteLog && deleteLog.result === 'SUCCESS', 'Nhật ký USER_DELETE được ghi nhận thành công');

  // 9. Quản lý tài liệu tri thức AI: Xem, Thêm/Sửa, Xóa
  console.log('\n9. Kiểm tra Quản lý tài liệu tri thức AI (GET, POST, DELETE /api/admin/docs)');
  const docsListRes = await request('/api/admin/docs', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(docsListRes.status === 200 && docsListRes.data.data.length >= 3, 'Admin lấy danh sách tài liệu tri thức AI đầy đủ (>= 3 files)');

  const testDocFilename = 'test_quy_trinh_tiem_phong.md';
  const saveDocRes = await request('/api/admin/docs', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      filename: testDocFilename,
      content: '# Quy trình tiêm phòng chuẩn thú y\n\n1. Khám sàng lọc trước tiêm.\n2. Kiểm tra hạn dùng vắc-xin.\n3. Theo dõi 30 phút sau tiêm.'
    })
  });
  assert(saveDocRes.status === 200 && saveDocRes.data.success, 'Admin tạo tài liệu tri thức mới thành công');

  const auditAfterDocCreate = await request('/api/admin/audit-logs', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const docCreateLog = auditAfterDocCreate.data.data.find(l => l.action === 'DOC_UPDATE' && l.targetId === testDocFilename);
  assert(docCreateLog && docCreateLog.result === 'SUCCESS', 'Nhật ký DOC_UPDATE được ghi nhận thành công');

  const deleteDocRes = await request(`/api/admin/docs/${testDocFilename}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(deleteDocRes.status === 200 && deleteDocRes.data.success, 'Admin xóa tài liệu tri thức thành công');

  const auditAfterDocDelete = await request('/api/admin/audit-logs', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const docDeleteLog = auditAfterDocDelete.data.data.find(l => l.action === 'DOC_DELETE' && l.targetId === testDocFilename);
  assert(docDeleteLog && docDeleteLog.result === 'SUCCESS', 'Nhật ký DOC_DELETE được ghi nhận thành công');

  // 10. Phân công bác sĩ và kiểm tra chống xung đột lịch hẹn
  console.log('\n10. Kiểm tra phân công bác sĩ và kiểm soát xung đột lịch hẹn trên backend');
  // Lấy danh sách bác sĩ
  const usersRes = await request('/api/auth/users', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const doctor = usersRes.data.find(u => u.role === 'vet_doctor' && !u.isLocked);
  assert(Boolean(doctor), 'Tìm thấy tài khoản bác sĩ thú y đang hoạt động trong hệ thống');

  // Tạo appointment 1 cho bác sĩ vào ngày giờ cụ thể
  const targetDate = '2026-11-20';
  const targetTime = '09:30';
  const appt1Res = await request('/api/data/appointments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      petId: 'pet_01',
      petName: 'Mochi',
      ownerName: 'Test Owner',
      service: 'Khám tổng quát',
      date: targetDate,
      time: targetTime,
      assignedVetId: doctor.id,
      assignedVet: doctor.name,
      status: 'confirmed'
    })
  });
  assert(appt1Res.status === 200 || appt1Res.status === 201, 'Tạo lịch hẹn 1 có chỉ định bác sĩ thành công (HTTP 200/201)');

  // Tạo appointment 2 cùng bác sĩ, cùng ngày và khung giờ -> Server phải trả về HTTP 409
  const appt2ConflictRes = await request('/api/data/appointments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      petId: 'pet_02',
      petName: 'Bánh Bao',
      ownerName: 'Test Owner 2',
      service: 'Da liễu',
      date: targetDate,
      time: targetTime,
      assignedVetId: doctor.id,
      assignedVet: doctor.name,
      status: 'confirmed'
    })
  });
  assert(appt2ConflictRes.status === 409, 'Server phát hiện xung đột lịch khám cùng bác sĩ và từ chối với HTTP 409 (APPOINTMENT_COLLISION)');

  // Dọn dẹp appointment 1
  if (appt1Res.data?.data?.id) {
    await request(`/api/data/appointments/${appt1Res.data.data.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
  }

  console.log(`\n========================================`);
  console.log(`KẾT QUẢ KIỂM THỬ GIAI ĐOẠN 5: ${passed} PASS, ${failed} FAIL`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Lỗi thực thi test Phase 5:', err);
  process.exit(1);
});
