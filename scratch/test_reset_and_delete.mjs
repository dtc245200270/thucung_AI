import assert from 'assert';

const BASE_URL = 'http://localhost:5000';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (response.status >= 400 && data.error) {
    // console.log(`[HTTP ${response.status}] ${endpoint}:`, data.error);
  }
  return { status: response.status, ok: response.ok, data };
}

async function runTests() {
  console.log('🚀 Bắt đầu bộ kiểm thử toàn diện: Đặt lại mật khẩu & Xóa tài khoản (Phase 1 & 2 Auth/RBAC)...');

  // 1. Health check
  const health = await request('/api/health');
  assert.strictEqual(health.status, 200, 'Health check phải trả về 200');
  console.log('✅ 1. Health check: OK');

  // Lấy danh sách admin ban đầu
  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@petcare.ai', password: 'Admin@123456' })
  });
  assert.strictEqual(adminLogin.status, 200, 'Đăng nhập admin ban đầu phải thành công');
  const adminId = adminLogin.data.user.id;
  const adminToken = adminLogin.data.token;
  assert.ok(adminToken, 'Admin phải nhận được JWT token hợp lệ');
  console.log(`✅ 2. Đăng nhập admin thành công (ID: ${adminId}) với JWT Token`);

  // Kiểm tra bảo mật: Gửi callerId giả mạo không kèm Token phải bị từ chối 401
  const spoofAttempt = await request('/api/auth/admin/create-user', {
    method: 'POST',
    body: JSON.stringify({
      callerId: adminId,
      name: 'Kẻ giả mạo',
      email: 'attacker@petcare.ai',
      role: 'pet_owner',
      password: 'TempPassword@123'
    })
  });
  assert.strictEqual(spoofAttempt.status, 401, 'Gửi callerId không có Authorization Token phải bị từ chối (401)');
  console.log('✅ 3. Bảo mật: Server không tin callerId trong body, bắt buộc xác thực token (401)');

  // Tạo tài khoản chủ nuôi thử nghiệm bằng adminToken hợp lệ
  const testOwnerEmail = `test_owner_${Date.now()}@petcare.ai`;
  const createOwner = await request('/api/auth/admin/create-user', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'Chủ Nuôi Kiểm Thử',
      email: testOwnerEmail,
      phone: '0912334455',
      role: 'pet_owner',
      password: 'TempPassword@123',
      isLocked: false
    })
  });
  assert.strictEqual(createOwner.status, 200, 'Admin tạo tài khoản chủ nuôi phải thành công');
  const testOwner = createOwner.data.user;
  console.log(`✅ 4. Tạo tài khoản chủ nuôi kiểm thử thành công: ${testOwner.email} (ID: ${testOwner.id})`);

  // Tạo tài khoản bác sĩ thử nghiệm
  const testVetEmail = `test_vet_${Date.now()}@petcare.ai`;
  const createVet = await request('/api/auth/admin/create-user', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'BS. Kiểm Thử Thú Y',
      email: testVetEmail,
      phone: '0988112233',
      role: 'vet_doctor',
      password: 'VetPassword@123',
      isLocked: false
    })
  });
  assert.strictEqual(createVet.status, 200, 'Admin tạo tài khoản bác sĩ phải thành công');
  const testVet = createVet.data.user;
  console.log(`✅ 5. Tạo tài khoản bác sĩ kiểm thử thành công: ${testVet.email} (ID: ${testVet.id})`);

  // =========================================================================
  // PHẦN 1: KIỂM THỬ ĐẶT LẠI MẬT KHẨU (RESET PASSWORD)
  // =========================================================================

  // Test 1.1: Admin đặt lại mật khẩu bằng ID và Email fallback cho chủ nuôi
  const newOwnerTempPass = 'NewOwnerPass@789';
  const resetOwner = await request('/api/auth/admin/reset-password', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      targetUserId: testOwner.id,
      targetEmail: testOwner.email,
      newTemporaryPassword: newOwnerTempPass
    })
  });
  assert.strictEqual(resetOwner.status, 200, 'Admin đặt lại mật khẩu cho chủ nuôi phải thành công');
  assert.strictEqual(resetOwner.data.user.mustChangePassword, true, 'mustChangePassword phải là true');
  console.log('✅ 6. Admin đặt lại mật khẩu bằng ID & Email cho chủ nuôi thành công');

  // Test 1.2: Mật khẩu cũ bị từ chối
  const loginOldPass = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: testOwnerEmail, password: 'TempPassword@123' })
  });
  assert.strictEqual(loginOldPass.status, 401, 'Đăng nhập bằng mật khẩu cũ phải bị từ chối (401)');
  console.log('✅ 7. Mật khẩu cũ bị từ chối chính xác (401)');

  // Test 1.3: Mật khẩu tạm thời mới đăng nhập được
  const loginNewPass = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: testOwnerEmail, password: newOwnerTempPass })
  });
  assert.strictEqual(loginNewPass.status, 200, 'Đăng nhập bằng mật khẩu tạm thời mới phải thành công');
  assert.strictEqual(loginNewPass.data.user.mustChangePassword, true, 'Tài khoản đăng nhập phải có cờ mustChangePassword: true');
  const ownerTempToken = loginNewPass.data.token;
  console.log('✅ 8. Đăng nhập bằng mật khẩu tạm thời mới thành công, nhận token tạm thời');

  // Test 1.4: Tài khoản mustChangePassword bị chặn truy cập API dữ liệu nghiệp vụ
  const dataAccessBlocked = await request('/api/data/pets', {
    headers: { Authorization: `Bearer ${ownerTempToken}` }
  });
  assert.strictEqual(dataAccessBlocked.status, 403, 'Tài khoản chưa đổi mật khẩu lần đầu phải bị chặn vào API dữ liệu (403)');
  console.log('✅ 9. Middleware chặn tài khoản mustChangePassword truy cập dữ liệu nghiệp vụ (403)');

  // Test 1.5: Đổi mật khẩu lần đầu cho tài khoản khác -> Bị chặn 403
  const impersonateChange = await request('/api/auth/first-login-change-password', {
    method: 'POST',
    headers: { Authorization: `Bearer ${ownerTempToken}` },
    body: JSON.stringify({ userId: 'different_user_id', newPassword: 'HackedPassword@123' })
  });
  assert.strictEqual(impersonateChange.status, 403, 'Không được phép đổi mật khẩu cho tài khoản người khác (403)');
  console.log('✅ 10. Chặn đổi mật khẩu tài khoản khác ở endpoint first-login-change-password (403)');

  // Test 1.6: Đổi mật khẩu bắt buộc ở lần đăng nhập đầu tiên của chính mình
  const finalPass = 'FinalOwnerSecurePass@999';
  const firstChange = await request('/api/auth/first-login-change-password', {
    method: 'POST',
    headers: { Authorization: `Bearer ${ownerTempToken}` },
    body: JSON.stringify({ userId: testOwner.id, newPassword: finalPass })
  });
  assert.strictEqual(firstChange.status, 200, 'Đổi mật khẩu lần đầu phải thành công');
  assert.strictEqual(firstChange.data.user.mustChangePassword, false, 'mustChangePassword phải tắt thành false');
  console.log('✅ 11. Đổi mật khẩu lần đầu thành công (mustChangePassword -> false)');

  // Test 1.7: Token cũ trước khi đổi mật khẩu bị thu hồi (Revocation check)
  const oldTokenRevoked = await request('/api/data/pets', {
    headers: { Authorization: `Bearer ${ownerTempToken}` }
  });
  assert.strictEqual(oldTokenRevoked.status, 401, 'Token cũ trước thời điểm đổi mật khẩu bị vô hiệu hóa (401 SESSION_REVOKED)');
  console.log('✅ 12. Token cũ trước thời điểm đổi mật khẩu bị thu hồi ngay lập tức (401)');

  // Test 1.8: Mật khẩu tạm thời cũ không còn đăng nhập được sau khi đổi
  const loginTempAgain = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: testOwnerEmail, password: newOwnerTempPass })
  });
  assert.strictEqual(loginTempAgain.status, 401, 'Mật khẩu tạm thời cũ không còn đăng nhập được sau khi đổi');
  console.log('✅ 13. Mật khẩu tạm thời cũ đã bị vô hiệu hóa hoàn toàn');

  // Test 1.9: Mật khẩu chính thức mới đăng nhập thành công
  const loginFinalPass = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: testOwnerEmail, password: finalPass })
  });
  assert.strictEqual(loginFinalPass.status, 200, 'Mật khẩu mới đăng nhập thành công');
  assert.strictEqual(loginFinalPass.data.user.mustChangePassword, false);
  const ownerActiveToken = loginFinalPass.data.token;
  console.log('✅ 14. Mật khẩu chính thức mới đăng nhập thành công');

  // =========================================================================
  // PHẦN 2: KIỂM THỬ XÓA TÀI KHOẢN (DELETE ACCOUNT) VÀ RÀNG BUỘC BẢO MẬT
  // =========================================================================

  // Test 2.1: Người dùng thường gọi chức năng xóa -> Bị từ chối (403)
  const nonAdminDelete = await request('/api/auth/admin/delete-user', {
    method: 'POST',
    headers: { Authorization: `Bearer ${ownerActiveToken}` },
    body: JSON.stringify({
      targetUserId: testVet.id,
      targetEmail: testVet.email,
      confirmEmail: testVet.email
    })
  });
  assert.strictEqual(nonAdminDelete.status, 403, 'Người dùng thường gọi xóa tài khoản phải bị từ chối (403)');
  console.log('✅ 15. Chặn người dùng thường gọi chức năng xóa tài khoản (403 Forbidden)');

  // Test 2.2: Admin tự xóa tài khoản của chính mình -> Bị từ chối (400)
  const selfDelete = await request('/api/auth/admin/delete-user', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      targetUserId: adminId,
      targetEmail: 'admin@petcare.ai',
      confirmEmail: 'admin@petcare.ai'
    })
  });
  assert.strictEqual(selfDelete.status, 400, 'Không được phép tự xóa tài khoản admin đang đăng nhập (400)');
  console.log('✅ 16. Chặn admin tự xóa chính tài khoản đang đăng nhập (400 Bad Request)');

  // Test 2.3: Xóa quản trị viên hoạt động cuối cùng -> Bị từ chối (400)
  const lastAdminDelete = await request('/api/auth/admin/delete-user', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      targetUserId: 'user_admin_01',
      targetEmail: 'admin@petcare.ai',
      confirmEmail: 'admin@petcare.ai'
    })
  });
  assert.strictEqual(lastAdminDelete.status, 400, 'Không được xóa quản trị viên cuối cùng (400)');
  console.log('✅ 17. Chặn xóa quản trị viên hoạt động duy nhất còn lại (400)');

  // Test 2.4: Nhập sai email xác nhận -> Bị từ chối (400)
  const wrongEmailConfirm = await request('/api/auth/admin/delete-user', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      targetUserId: testOwner.id,
      targetEmail: testOwner.email,
      confirmEmail: 'wrong_email@petcare.ai'
    })
  });
  assert.strictEqual(wrongEmailConfirm.status, 400, 'Email xác nhận không khớp phải bị từ chối (400)');
  console.log('✅ 18. Bắt buộc nhập chính xác email để xác nhận xóa (400 nếu sai)');

  // Test 2.5: Admin xác nhận xóa tài khoản Chủ nuôi
  const deleteOwner = await request('/api/auth/admin/delete-user', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      targetUserId: testOwner.id,
      targetEmail: testOwner.email,
      confirmEmail: testOwner.email
    })
  });
  assert.strictEqual(deleteOwner.status, 200, 'Admin xóa tài khoản chủ nuôi phải thành công');
  console.log(`✅ 19. Admin xóa thành công tài khoản chủ nuôi: ${testOwner.email}`);

  // Test 2.6: Tài khoản chủ nuôi đã xóa không thể đăng nhập nữa
  const loginDeletedOwner = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: testOwnerEmail, password: finalPass })
  });
  assert.strictEqual(loginDeletedOwner.status, 401, 'Tài khoản đã xóa không được phép đăng nhập');
  console.log('✅ 20. Tài khoản chủ nuôi đã xóa không thể đăng nhập (401)');

  // Test 2.7: Admin xác nhận xóa tài khoản Bác sĩ thú y
  const deleteVet = await request('/api/auth/admin/delete-user', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      targetUserId: testVet.id,
      targetEmail: testVet.email,
      confirmEmail: testVet.email
    })
  });
  assert.strictEqual(deleteVet.status, 200, 'Admin xóa tài khoản bác sĩ phải thành công');
  console.log(`✅ 21. Admin xóa thành công tài khoản bác sĩ: ${testVet.email}`);

  // Test 2.8: Tài khoản bác sĩ đã xóa không thể đăng nhập nữa
  const loginDeletedVet = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: testVetEmail, password: 'VetPassword@123' })
  });
  assert.strictEqual(loginDeletedVet.status, 401, 'Tài khoản bác sĩ đã xóa không thể đăng nhập');
  console.log('✅ 22. Tài khoản bác sĩ đã xóa không thể đăng nhập (401)');

  // Test 2.9: Danh sách users không còn chứa 2 tài khoản đã xóa
  const usersList = await request('/api/auth/users', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.strictEqual(usersList.status, 200);
  const userEmails = usersList.data.map(u => u.email.toLowerCase());
  assert.ok(!userEmails.includes(testOwnerEmail.toLowerCase()), 'Tài khoản chủ nuôi đã xóa không được xuất hiện trong danh sách');
  assert.ok(!userEmails.includes(testVetEmail.toLowerCase()), 'Tài khoản bác sĩ đã xóa không được xuất hiện trong danh sách');
  console.log('✅ 23. Danh sách tài khoản đã đồng bộ, không còn chứa các tài khoản đã xóa');

  // Test 2.10: Xóa lại tài khoản vừa xóa trả về 404 rõ ràng
  const deleteAgain = await request('/api/auth/admin/delete-user', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      targetUserId: testOwner.id,
      targetEmail: testOwner.email,
      confirmEmail: testOwner.email
    })
  });
  assert.strictEqual(deleteAgain.status, 404, 'Xóa tài khoản đã xóa phải trả về 404');
  console.log('✅ 24. Báo rõ khi tài khoản đã bị xóa trước đó (404)');

  console.log('\n=============================================================');
  console.log('🎉 TẤT CẢ 24/24 BÀI KIỂM THỬ ĐÃ VƯỢT QUA XUẤT SẮC!');
  console.log('=============================================================\n');
}

runTests().catch(err => {
  console.error('❌ Kiểm thử thất bại:', err);
  process.exit(1);
});
