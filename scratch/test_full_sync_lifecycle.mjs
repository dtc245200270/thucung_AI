import assert from 'assert';

const BASE_URL = 'http://localhost:5000';

async function req(endpoint, opts = {}) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('🧪 BỘ KIỂM THỬ TOÀN DIỆN ĐỒNG BỘ TÀI KHOẢN PETCARE AI');
  console.log('='.repeat(60));

  // ── BƯỚC 1: Đăng nhập admin ────────────────────────────────────────────
  const adminLoginRes = await req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@petcare.ai', password: 'Admin@123456' })
  });
  assert.strictEqual(adminLoginRes.status, 200, 'Đăng nhập admin phải thành công');
  const adminId = adminLoginRes.data.user.id;
  const adminToken = adminLoginRes.data.token;
  assert.ok(adminToken, 'Admin phải nhận token');
  console.log(`✅ [1] Đăng nhập Admin thành công (ID: ${adminId}) với JWT Token`);

  // ── BƯỚC 2: Tạo tài khoản chủ nuôi ───────────────────────────────────
  const testEmail = `luong_test_${Date.now()}@petcare.ai`;
  const testPassword = 'TempTest@123';

  const createRes = await req('/api/auth/admin/create-user', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'Lương Kiểm Thử',
      email: testEmail,
      phone: '0912.888.777',
      role: 'pet_owner',
      password: testPassword,
      isLocked: false
    })
  });
  assert.strictEqual(createRes.status, 200, `Tạo tài khoản phải thành công: ${createRes.data?.error || ''}`);
  assert(createRes.data.success && createRes.data.user, 'Phản hồi phải có success=true và user');
  const createdId = createRes.data.user.id;
  console.log(`✅ [2] Admin tạo tài khoản ${testEmail} thành công (ID: ${createdId})`);

  // ── BƯỚC 3: Đăng nhập bằng tài khoản vừa tạo ─────────────────────────
  const loginRes = await req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: testEmail, password: testPassword })
  });
  assert.strictEqual(loginRes.status, 200, 'Đăng nhập tài khoản mới phải thành công');
  assert.strictEqual(loginRes.data.user.id, createdId, 'ID phải khớp');
  console.log(`✅ [3] Đăng nhập bằng tài khoản mới thành công`);

  // ── BƯỚC 4: Admin xóa tài khoản ──────────────────────────────────────
  const deleteRes = await req('/api/auth/admin/delete-user', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      targetUserId: createdId,
      targetEmail: testEmail,
      confirmEmail: testEmail
    })
  });
  assert.strictEqual(deleteRes.status, 200, `Xóa tài khoản phải thành công: ${deleteRes.data?.error || ''}`);
  assert(deleteRes.data.success, 'Xóa phải trả success=true');
  console.log(`✅ [4] Admin xóa tài khoản ${testEmail} thành công`);

  // ── BƯỚC 5: Xác nhận tài khoản không còn tồn tại trên server ─────────
  const usersAfterDelete = await req('/api/auth/users', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(usersAfterDelete.ok, 'GET /api/auth/users phải thành công');
  const stillExists = usersAfterDelete.data.some(u => u.email === testEmail);
  assert(!stillExists, 'Tài khoản phải bị loại khỏi danh sách sau khi xóa');
  console.log(`✅ [5] Xác nhận tài khoản đã bị xóa khỏi danh sách backend`);

  // ── BƯỚC 6: Đăng nhập tài khoản đã xóa phải thất bại ─────────────────
  const loginAfterDelete = await req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: testEmail, password: testPassword })
  });
  assert.strictEqual(loginAfterDelete.status, 401, 'Đăng nhập tài khoản đã xóa phải trả 401');
  console.log(`✅ [6] Đăng nhập tài khoản đã xóa bị từ chối (401): "${loginAfterDelete.data?.error}"`);

  // ── BƯỚC 7: Tạo lại cùng email thành công ────────────────────────────
  const recreatePassword = 'NewPassword@456';
  const recreateRes = await req('/api/auth/admin/create-user', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'Lương Kiểm Thử (Tái Tạo)',
      email: testEmail,
      phone: '0912.999.888',
      role: 'pet_owner',
      password: recreatePassword,
      isLocked: false
    })
  });
  assert.strictEqual(recreateRes.status, 200, `Tạo lại cùng email phải thành công: ${recreateRes.data?.error || ''}`);
  const recreatedId = recreateRes.data.user.id;
  assert.notStrictEqual(recreatedId, createdId, 'ID mới phải khác ID cũ');
  console.log(`✅ [7] Tạo lại cùng email thành công (ID mới: ${recreatedId}, khác ID cũ: ${createdId})`);

  // ── BƯỚC 8: Đăng nhập bằng mật khẩu mới ─────────────────────────────
  const loginRecreated = await req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: testEmail, password: recreatePassword })
  });
  assert.strictEqual(loginRecreated.status, 200, 'Đăng nhập tài khoản tái tạo phải thành công');
  assert.strictEqual(loginRecreated.data.user.id, recreatedId, 'ID phải là ID mới');
  console.log(`✅ [8] Đăng nhập tài khoản tái tạo bằng mật khẩu mới thành công`);

  // ── BƯỚC 9: Tạo trùng email khi đang tồn tại phải bị từ chối ─────────
  const dupRes = await req('/api/auth/admin/create-user', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'Người Trùng Email',
      email: testEmail,
      phone: '0000000000',
      role: 'pet_owner',
      password: 'Password@123'
    })
  });
  assert.strictEqual(dupRes.status, 400, 'Tạo trùng email phải bị từ chối');
  assert.strictEqual(dupRes.data?.error, 'Địa chỉ email này đã tồn tại trong hệ thống.');
  console.log(`✅ [9] Tạo trùng email bị từ chối: "${dupRes.data?.error}"`);

  // ── BƯỚC 10: Kiểm tra backend offline response ────────────────────────
  const healthRes = await req('/api/health');
  assert.strictEqual(healthRes.status, 200, 'Backend phải đang chạy');
  console.log(`✅ [10] Backend hoạt động bình thường: ${healthRes.data?.status}`);

  // ── BƯỚC 11: Dọn dẹp sau kiểm thử ────────────────────────────────────
  const cleanupRes = await req('/api/auth/admin/delete-user', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      targetUserId: recreatedId,
      targetEmail: testEmail,
      confirmEmail: testEmail
    })
  });
  assert.strictEqual(cleanupRes.status, 200, 'Dọn dẹp sau test phải thành công');
  console.log(`✅ [11] Dọn dẹp hoàn tất - database trở về trạng thái sạch`);

  // ── Xác nhận trạng thái cuối ──────────────────────────────────────────
  const finalUsers = await req('/api/auth/users', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const finalEmails = finalUsers.data.map(u => u.email);
  assert(!finalEmails.includes(testEmail), 'Email kiểm thử phải đã bị dọn sạch');
  assert(finalEmails.includes('admin@petcare.ai'), 'Admin phải vẫn tồn tại');
  assert(finalEmails.includes('tester@petcare.ai'), 'Vet doctor phải vẫn tồn tại');
  console.log(`✅ Trạng thái cuối: ${finalUsers.data.length} tài khoản (${finalEmails.join(', ')})`);

  console.log('\n' + '='.repeat(60));
  console.log('🎉 TOÀN BỘ 11 BƯỚC KIỂM THỬ THÀNH CÔNG XUẤT SẮC!');
  console.log('   Backend là nguồn sự thật duy nhất ✓');
  console.log('   Xóa tài khoản được xác nhận backend trước ✓');
  console.log('   Tạo lại email đã xóa thành công ✓');
  console.log('   Email bị khóa khi đang tồn tại, không khi đã xóa ✓');
  console.log('   Dữ liệu các tài khoản khác nguyên vẹn ✓');
}

runTests().catch(err => {
  console.error('\n❌ KIỂM THỬ THẤT BẠI:', err.message);
  process.exit(1);
});
