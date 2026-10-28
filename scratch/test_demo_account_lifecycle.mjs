import assert from 'assert';

const BASE_URL = 'http://localhost:5000';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, ok: response.ok, data };
}

async function runTest() {
  console.log('🧪 BẮT ĐẦU KIỂM THỬ VÒNG ĐỜI TÀI KHOẢN VỚI EMAIL: demo@petcare.ai');

  // 1. Đăng nhập admin
  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@petcare.ai', password: 'Admin@123456' })
  });
  assert.strictEqual(adminLogin.status, 200, 'Đăng nhập admin phải thành công');
  const adminId = adminLogin.data.user.id;
  const adminToken = adminLogin.data.token;
  assert.ok(adminToken, 'Admin phải có token');
  console.log(`✅ [1/6] Đăng nhập Admin thành công (Admin ID: ${adminId})`);

  // 2. Tạo tài khoản với email demo@petcare.ai (tài khoản mẫu từng bị xóa)
  const targetEmail = 'demo@petcare.ai';
  const newPassword = 'NewOwnerPassword@123';
  
  const createRes1 = await request('/api/auth/admin/create-user', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'Đinh Xuân Mạnh (Tái Tạo)',
      email: targetEmail,
      phone: '0912.888.999',
      role: 'pet_owner',
      password: newPassword,
      isLocked: false
    })
  });

  assert.strictEqual(createRes1.status, 200, `Tạo lại ${targetEmail} phải thành công (200), nhận được: ${createRes1.status} - ${createRes1.data?.error || ''}`);
  const createdUser1 = createRes1.data.user;
  console.log(`✅ [2/6] Tạo lại email ${targetEmail} thành công:`);
  console.log(`     - ID mới: ${createdUser1.id} (khác ID gốc user_owner_demo: ${createdUser1.id !== 'user_owner_demo'})`);
  console.log(`     - Vai trò: ${createdUser1.role}`);
  console.log(`     - Bắt buộc đổi MK: ${createdUser1.mustChangePassword}`);
  assert.notStrictEqual(createdUser1.id, 'user_owner_demo', 'Tài khoản mới phải có ID mới');

  // 3. Thử tạo lại email đang tồn tại (Phải bị từ chối)
  const createDup = await request('/api/auth/admin/create-user', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'Người trùng email',
      email: targetEmail,
      phone: '0912.111.222',
      role: 'pet_owner',
      password: 'SomePassword@123'
    })
  });
  assert.strictEqual(createDup.status, 400, 'Tạo trùng email phải bị từ chối với status 400');
  assert.strictEqual(createDup.data?.error, 'Địa chỉ email này đã tồn tại trong hệ thống.');
  console.log(`✅ [3/6] Kiểm tra chặn trùng email: Thành công (Bị từ chối chính xác: "${createDup.data?.error}")`);

  // 4. Đăng nhập bằng mật khẩu vừa cấp
  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: targetEmail, password: newPassword })
  });
  assert.strictEqual(loginRes.status, 200, 'Đăng nhập bằng tài khoản và mật khẩu vừa cấp phải thành công');
  assert.strictEqual(loginRes.data.user.id, createdUser1.id, 'ID người dùng đăng nhập phải khớp với tài khoản mới');
  console.log(`✅ [4/6] Đăng nhập bằng mật khẩu vừa cấp thành công:`);
  console.log(`     - Session ID: ${loginRes.data.user.id}`);
  console.log(`     - mustChangePassword: ${loginRes.data.user.mustChangePassword}`);

  // 5. Xóa tài khoản vừa tạo
  const deleteRes = await request('/api/auth/admin/delete-user', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      targetUserId: createdUser1.id,
      targetEmail: targetEmail,
      confirmEmail: targetEmail
    })
  });
  assert.strictEqual(deleteRes.status, 200, 'Xóa tài khoản vừa tạo phải thành công');
  console.log(`✅ [5/6] Xóa tài khoản ${targetEmail} (ID: ${createdUser1.id}) thành công.`);

  // 6. Tạo lại cùng email lần thứ 2
  const secondPassword = 'SecondNewPassword@456';
  const createRes2 = await request('/api/auth/admin/create-user', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'Đinh Xuân Mạnh (Tái Tạo Lần 2)',
      email: targetEmail,
      phone: '0912.999.888',
      role: 'pet_owner',
      password: secondPassword,
      isLocked: false
    })
  });
  assert.strictEqual(createRes2.status, 200, 'Tạo lại cùng email lần thứ 2 phải thành công');
  const createdUser2 = createRes2.data.user;
  assert.notStrictEqual(createdUser2.id, createdUser1.id, 'Lần tạo thứ 2 phải sinh ID mới khác lần 1');
  assert.notStrictEqual(createdUser2.id, 'user_owner_demo', 'Lần tạo thứ 2 phải khác ID gốc');
  console.log(`✅ [6/6] Tạo lại cùng email lần thứ 2 thành công rực rỡ:`);
  console.log(`     - ID lần 2: ${createdUser2.id} (khác ID lần 1: ${createdUser1.id})`);

  // Dọn dẹp an toàn sau kiểm thử: Xóa tài khoản lần 2 để đưa database về trạng thái sạch (chỉ còn Admin & Bác sĩ)
  const cleanupRes = await request('/api/auth/admin/delete-user', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      targetUserId: createdUser2.id,
      targetEmail: targetEmail,
      confirmEmail: targetEmail
    })
  });
  assert.strictEqual(cleanupRes.status, 200, 'Dọn dẹp sau test thành công');
  console.log('🎉 TOÀN BỘ 6 BƯỚC KIỂM THỬ VÒNG ĐỜI VỚI demo@petcare.ai ĐÃ HOÀN TẤT XUẤT SẮC!');
}

runTest().catch(err => {
  console.error('❌ Kiểm thử thất bại:', err);
  process.exit(1);
});
