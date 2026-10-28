import fs from 'fs';
import path from 'path';
import assert from 'assert';

const BASE_URL = 'http://localhost:5000/api';
const DATA_DIR = path.resolve('server/data');

async function testAll() {
  console.log('--- KIỂM TRA TOÀN VẸN VÀ XÁC MINH CÁC TIÊU CHÍ YÊU CẦU ---');

  // 1. Đăng nhập bác sĩ tester@petcare.ai
  console.log('\n[1] Đăng nhập tài khoản Bác sĩ:');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'tester@petcare.ai', password: 'Doctor@123' })
  });
  const loginData = await loginRes.json();
  assert.strictEqual(loginRes.status, 200, 'Đăng nhập bác sĩ thành công');
  const vetToken = loginData.token;
  console.log('✅ Đăng nhập thành công, Doctor ID:', loginData.user.id);

  // 2. Lấy danh sách ca khám của bác sĩ qua API
  console.log('\n[2] Gọi API GET /api/data/appointments:');
  const appRes = await fetch(`${BASE_URL}/data/appointments`, {
    headers: { 'Authorization': `Bearer ${vetToken}` }
  });
  const vetAppointments = await appRes.json();
  console.log('Tổng số ca của bác sĩ:', vetAppointments.length);

  // Xác minh app-test-fs-1793094738755-1 đã bị loại bỏ hoàn toàn
  const testApp = vetAppointments.find(a => a.id === 'app-test-fs-1793094738755-1');
  assert.strictEqual(testApp, undefined, 'Bản ghi fixture app-test-fs-1793094738755-1 phải KHÔNG CÒN tồn tại');
  console.log('✅ app-test-fs-1793094738755-1 KHÔNG CÒN xuất hiện trong danh sách ca của bác sĩ.');

  // Xác minh ca BK-1793103632301 còn nguyên vẹn
  const bkApp = vetAppointments.find(a => a.id === 'BK-1793103632301');
  assert(bkApp, 'Ca khám BK-1793103632301 phải còn nguyên vẹn');
  assert.strictEqual(bkApp.status, 'pending', 'Trạng thái ca BK-1793103632301 phải là pending');
  assert.strictEqual(bkApp.date, '2026-10-28', 'Ngày hẹn phải là 2026-10-28');
  assert.strictEqual(bkApp.petName, 'Cún Kiểm Thử', 'Tên bé phải là Cún Kiểm Thử');
  console.log('✅ Ca khám BK-1793103632301 bảo toàn 100% nguyên vẹn.');

  // 3. Kiểm tra file server/data/pets.json
  console.log('\n[3] Kiểm tra server/data/pets.json:');
  const pets = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'pets.json'), 'utf8'));
  console.log('Danh sách thú cưng:', pets.map(p => ({ id: p.id, name: p.name })));
  assert(pets.some(p => p.id === 'pet-1792128958474' && p.name === 'Cún Kiểm Thử'), 'Cún Kiểm Thử phải còn nguyên');
  assert(pets.some(p => p.id === 'pet-1792142788675' && p.name === 'Mèo Kiểm Thử'), 'Mèo Kiểm Thử phải còn nguyên');
  assert(!pets.some(p => p.id === 'pet-test-1793094738754'), 'pet-test-1793094738754 phải đã bị xóa');
  console.log('✅ Hai thú cưng nhập tay bảo toàn 100%, fixture pet-test đã bị loại bỏ.');

  // 4. Kiểm tra server/data/users.json
  console.log('\n[4] Kiểm tra server/data/users.json:');
  const users = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'users.json'), 'utf8'));
  const fixtureUser = users.find(u => u.id === 'user_1793094738588_7cb5d0');
  assert.strictEqual(fixtureUser, undefined, 'Fixture user_1793094738588_7cb5d0 phải đã bị xóa');
  console.log('✅ Fixture user_1793094738588_7cb5d0 đã bị loại bỏ sạch sẽ.');

  // 5. Kiểm tra bản ghi thiếu/sai trạng thái trong appointments.json
  console.log('\n[5] Kiểm tra bản ghi thiếu/sai trạng thái trong server/data/appointments.json:');
  const allApps = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'appointments.json'), 'utf8'));
  console.log('Danh sách appointments trên đĩa:', allApps.map(a => ({ id: a.id, status: a.status, date: a.date, petId: a.petId })));
  const errApp = allApps.find(a => a.id === 'app-err1-1793094737585');
  if (errApp) {
    console.log('-> Phát hiện bản ghi bất thường:', JSON.stringify(errApp));
    assert.strictEqual(errApp.date, undefined, 'Bản ghi thiếu ngày khám');
    assert.strictEqual(errApp.petId, undefined, 'Bản ghi thiếu petId');
    assert.strictEqual(errApp.vetId, undefined, 'Bản ghi thiếu vetId');
    console.log('✅ Đã xác định rõ ràng bản ghi thiếu trường/sai lệch dữ liệu.');
  }

  // 6. Kiểm tra thư mục backup
  console.log('\n[6] Kiểm tra thư mục backup dữ liệu trước khi xóa:');
  const backupDir = path.resolve('server/data_backup_before_fixture_cleanup_20261027_2036');
  assert(fs.existsSync(backupDir), 'Thư mục sao lưu phải tồn tại');
  const backedUpFiles = fs.readdirSync(backupDir);
  console.log('Các file đã sao lưu an toàn:', backedUpFiles);
  assert(backedUpFiles.includes('appointments.json'), 'appointments.json phải có trong bản backup');
  assert(backedUpFiles.includes('pets.json'), 'pets.json phải có trong bản backup');
  assert(backedUpFiles.includes('users.json'), 'users.json phải có trong bản backup');
  console.log('✅ Thư mục sao lưu an toàn đầy đủ 100%.');

  console.log('\n=============================================================');
  console.log('🎉 TẤT CẢ CÁC TIÊU CHÍ KIỂM TRA ĐỀU ĐẠT CHUẨN XÁC 100%!');
  console.log('=============================================================');
}

testAll().catch(err => {
  console.error('\n❌ TEST THẤT BẠI:', err);
  process.exit(1);
});
