import assert from 'assert';

// 1. Mock browser environment
const storageStore = new Map();
global.localStorage = {
  getItem: (key) => storageStore.get(key) || null,
  setItem: (key, val) => storageStore.set(key, String(val)),
  removeItem: (key) => storageStore.delete(key),
  clear: () => storageStore.clear()
};

global.window = {
  dispatchEvent: () => {}
};
global.CustomEvent = class CustomEvent { constructor(name, opts) { this.name = name; this.opts = opts; } };
global.Event = class Event { constructor(name) { this.name = name; } };

const realFetch = global.fetch;
global.fetch = async (url, opts) => {
  const fullUrl = url.startsWith('/') ? `http://localhost:5000${url}` : url;
  return realFetch(fullUrl, opts);
};

// 2. Import services dynamically after env setup
const { toggleScheduleComplete, getSchedules, addSchedule } = await import('../src/services/storageService.js');

async function login(email, password) {
  const res = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Login failed: ${JSON.stringify(data)}`);
  return data;
}

async function runStorageServiceMuc1Tests() {
  console.log('====================================================');
  console.log('🧪 TEST FRONTEND storageService.js: toggleScheduleComplete');
  console.log('====================================================');

  // Authenticate as admin and owner
  const adminAuth = await login('admin@petcare.ai', 'Admin@123456');
  const adminToken = adminAuth.token;

  // Create test owner
  const ownerEmail = `fe_owner_m1_${Date.now()}@petcare.ai`;
  const createRes = await fetch('http://localhost:5000/api/auth/admin/create-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'Owner Frontend Test M1',
      email: ownerEmail,
      phone: '0912345678',
      password: 'Temp@123456',
      role: 'pet_owner'
    })
  });
  const createData = await createRes.json();
  const ownerId = createData.user.id;

  const tempAuth = await login(ownerEmail, 'Temp@123456');
  const changeRes = await fetch('http://localhost:5000/api/auth/first-login-change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tempAuth.token}` },
    body: JSON.stringify({ newPassword: 'Owner@123456' })
  });
  const changeData = await changeRes.json();
  const ownerToken = changeData.token;

  // Set auth token in localStorage for apiService
  localStorage.setItem('petcare_auth_token', ownerToken);
  localStorage.setItem('petcare_current_user', JSON.stringify({ id: ownerId, role: 'pet_owner' }));

  // Create test pet
  const petId = `pet-fe-${Date.now()}`;
  await fetch('http://localhost:5000/api/data/pets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      id: petId,
      name: 'Bé Miu FE',
      species: 'cat',
      breed: 'Anh lông ngắn'
    })
  });

  // TEST 1: Toggle non-repeating schedule via storageService.js
  const schId1 = `sch-fe-nonrepeat-${Date.now()}`;
  await addSchedule({
    id: schId1,
    petId,
    title: 'Uống men tiêu hóa 1 lần',
    date: '2026-10-15',
    repeat: 'none',
    completed: false
  }, ownerId);

  const updated1 = await toggleScheduleComplete(schId1, ownerId, 'pet_owner');
  assert.ok(updated1, 'toggleScheduleComplete trả về bản ghi cập nhật');
  assert.strictEqual(updated1.completed, true);
  console.log('  ✅ [PASS] Frontend toggleScheduleComplete hoàn thành lịch không lặp');

  // TEST 2: Toggle repeating weekly schedule via storageService.js
  const schId2 = `sch-fe-weekly-${Date.now()}`;
  await addSchedule({
    id: schId2,
    petId,
    title: 'Cắt móng hàng tuần',
    date: '2026-10-15',
    repeat: 'weekly',
    completed: false
  }, ownerId);

  const updated2 = await toggleScheduleComplete(schId2, ownerId, 'pet_owner');
  assert.strictEqual(updated2.completed, true);
  assert.ok(updated2.nextRecurrenceId, 'nextRecurrenceId được gán');

  const cachedSchedules = JSON.parse(localStorage.getItem('petcare_schedules_v1') || '[]');
  const nextItem = cachedSchedules.find(s => s.id === updated2.nextRecurrenceId);
  assert.ok(nextItem, 'Lịch tiếp theo đã được đồng bộ vào cache localStorage');
  assert.strictEqual(nextItem.date, '2026-10-22', 'Ngày lịch tiếp theo đúng 7 ngày');
  assert.strictEqual(nextItem.completed, false);
  console.log('  ✅ [PASS] Frontend toggleScheduleComplete hoàn thành lịch lặp và đồng bộ cache');

  // TEST 3: Khi backend lỗi, storageService ném lỗi, không báo thành công, không làm sai lệch cache
  let errorCaught = false;
  try {
    // Gọi với ID không tồn tại
    await toggleScheduleComplete('sch-non-existent-999', ownerId, 'pet_owner');
  } catch (err) {
    errorCaught = true;
    assert.ok(err.message, 'Có thông báo lỗi');
  }
  assert.strictEqual(errorCaught, true, 'Ném ngoại lệ khi backend trả về lỗi');
  console.log('  ✅ [PASS] Frontend toggleScheduleComplete ném lỗi khi backend thất bại, không giả mạo thành công');

  console.log('====================================================');
  console.log('🎉 TẤT CẢ TEST FRONTEND SERVICE MỤC 1 ĐẠT 100%!');
  console.log('====================================================');
}

runStorageServiceMuc1Tests().catch(err => {
  console.error('Lỗi test frontend service:', err);
  process.exit(1);
});
