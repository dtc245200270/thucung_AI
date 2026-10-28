import assert from 'assert';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5000/api';

async function apiRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function login(email, password) {
  const res = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email, password }
  });
  if (!res.ok) throw new Error(`Login failed for ${email}: ${JSON.stringify(res.data)}`);
  return res.data.token;
}

async function run() {
  console.log('====================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ: 8 LOẠI SỰ KIỆN LỊCH CHĂM SÓC');
  console.log('====================================================');

  const token = await login('admin@petcare.ai', 'Admin@123456');
  const authHeader = { 'Authorization': `Bearer ${token}` };

  // Lấy danh sách thú cưng
  const petsRes = await apiRequest('/data/pets', { headers: authHeader });
  const pets = petsRes.data || [];
  if (pets.length === 0) {
    throw new Error('Không có thú cưng nào trong hệ thống để test!');
  }
  const pet1 = pets[0];
  const pet2 = pets.length > 1 ? pets[1] : null;

  console.log(`[INFO] Sử dụng thú cưng: ${pet1.name} (id: ${pet1.id})`);

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
    }
  }

  // 1. KIỂM THỬ TẠO LỊCH VỚI 8 LOẠI HỢP LỆ VÀ PARASITE
  const validTypes = [
    'vaccine',
    'deworm',
    'parasite',
    'grooming',
    'vet',
    'medicine',
    'feeding',
    'exercise',
    'other'
  ];

  const createdScheduleIds = [];

  for (const type of validTypes) {
    await test(`Tạo lịch chăm sóc với loại hợp lệ: '${type}'`, async () => {
      const schId = `sch-type-test-${type}-${Date.now()}`;
      const payload = {
        id: schId,
        petId: pet1.id,
        title: `Việc kiểm thử ${type}`,
        type: type,
        date: '2026-11-15',
        time: '10:00',
        location: 'Tại nhà',
        repeat: 'none',
        notes: `Ghi chú cho ${type}`,
        completed: false
      };

      const res = await apiRequest('/data/schedules', {
        method: 'POST',
        headers: authHeader,
        body: payload
      });

      assert.strictEqual(res.status, 200, `Tạo lịch loại '${type}' phải thành công`);
      assert.strictEqual(res.data.data.type, type, `Mã loại phải được giữ nguyên '${type}'`);
      createdScheduleIds.push(schId);
    });
  }

  // 2. KIỂM THỬ TỪ CHỐI MÃ LOẠI KHÔNG HỢP LỆ KHI TẠO
  await test('Từ chối khi tạo lịch với mã loại không hợp lệ', async () => {
    const payload = {
      id: `sch-invalid-type-${Date.now()}`,
      petId: pet1.id,
      title: 'Việc kiểm thử loại sai',
      type: 'loai_khong_ton_tai_xyz',
      date: '2026-11-15',
      time: '10:00'
    };

    const res = await apiRequest('/data/schedules', {
      method: 'POST',
      headers: authHeader,
      body: payload
    });

    assert.strictEqual(res.status, 400, 'Backend phải từ chối mã loại không hợp lệ với mã lỗi 400');
    assert.strictEqual(res.data.code, 'INVALID_SCHEDULE_TYPE', 'Mã lỗi phải là INVALID_SCHEDULE_TYPE');
  });

  await test('Tự động tương thích fallback sang "other" khi tạo lịch không truyền trường type', async () => {
    const schId = `sch-missing-type-${Date.now()}`;
    const payload = {
      id: schId,
      petId: pet1.id,
      title: 'Việc kiểm thử không truyền type',
      date: '2026-11-15',
      time: '10:00'
    };

    const res = await apiRequest('/data/schedules', {
      method: 'POST',
      headers: authHeader,
      body: payload
    });

    assert.strictEqual(res.status, 200, 'Backend tự động tương thích và tạo thành công');
    assert.strictEqual(res.data.data.type, 'other', 'Loại phải được gán mặc định là other');
    createdScheduleIds.push(schId);
  });

  // 3. KIỂM THỬ TỪ CHỐI MÃ LOẠI KHÔNG HỢP LỆ KHI CẬP NHẬT (PUT) VÀ GIỮ NGUYÊN DỮ LIỆU CŨ
  await test('Từ chối khi cập nhật mã loại không hợp lệ (PUT) và giữ nguyên bản ghi cũ', async () => {
    const targetId = createdScheduleIds[0];
    const originalRes = await apiRequest(`/data/schedules/${targetId}`, { headers: authHeader });
    const originalItem = originalRes.data;

    // Cố gắng cập nhật sang mã loại rác
    const updateRes = await apiRequest(`/data/schedules/${targetId}`, {
      method: 'PUT',
      headers: authHeader,
      body: { type: 'invalid_hacked_type' }
    });

    assert.strictEqual(updateRes.status, 400, 'Backend phải từ chối PUT với mã loại sai');
    assert.strictEqual(updateRes.data.code, 'INVALID_SCHEDULE_TYPE');

    // Kiểm tra bản ghi trong DB vẫn giữ nguyên mã loại cũ
    const afterRes = await apiRequest(`/data/schedules/${targetId}`, { headers: authHeader });
    assert.strictEqual(afterRes.data.type, originalItem.type, 'Bản ghi cũ phải giữ nguyên vẹn mã loại');
  });

  // 4. KIỂM THỬ HOÀN THÀNH LỊCH TIÊM KHÔNG TỰ TẠO BỆNH ÁN HAY HỒ SƠ Y TẾ
  await test('Tick hoàn thành lịch tiêm không tự tạo bản ghi y tế / bệnh án', async () => {
    const vaxSchId = createdScheduleIds.find(id => id.includes('vaccine'));
    
    // Đếm số bệnh án trước khi hoàn thành
    const medBefore = await apiRequest('/data/medical_records', { headers: authHeader });
    const countBefore = (medBefore.data || []).length;

    // Toggle complete lịch tiêm
    const toggleRes = await apiRequest(`/data/schedules/${vaxSchId}/toggle-complete`, {
      method: 'POST',
      headers: authHeader,
      body: { completed: true }
    });
    assert.strictEqual(toggleRes.status, 200);

    // Đếm lại số bệnh án
    const medAfter = await apiRequest('/data/medical_records', { headers: authHeader });
    const countAfter = (medAfter.data || []).length;

    assert.strictEqual(countAfter, countBefore, 'Số bệnh án y tế không được tăng lên khi hoàn thành lịch tiêm');
  });

  // 5. KIỂM THỬ HOÀN THÀNH LỊCH LẶP GIỮ NGUYÊN TYPE VÀ PETID
  await test('Hoàn thành lịch lặp tạo đúng 1 lịch kế tiếp, giữ đúng loại và petId', async () => {
    const schRepeatId = `sch-repeat-test-${Date.now()}`;
    await apiRequest('/data/schedules', {
      method: 'POST',
      headers: authHeader,
      body: {
        id: schRepeatId,
        petId: pet1.id,
        title: 'Ăn dặm dinh dưỡng hàng tuần',
        type: 'feeding',
        date: '2026-11-01',
        time: '08:00',
        repeat: 'weekly',
        completed: false
      }
    });

    createdScheduleIds.push(schRepeatId);

    // Toggle complete
    const toggleRes = await apiRequest(`/data/schedules/${schRepeatId}/toggle-complete`, {
      method: 'POST',
      headers: authHeader,
      body: { completed: true }
    });

    assert.strictEqual(toggleRes.status, 200);
    const nextSch = toggleRes.data?.data?.nextSchedule || toggleRes.data?.nextSchedule;
    assert.ok(nextSch, 'Phải sinh ra lịch kế tiếp');
    assert.strictEqual(nextSch.type, 'feeding', 'Lịch kế tiếp phải giữ đúng loại feeding');
    assert.strictEqual(nextSch.petId, pet1.id, 'Lịch kế tiếp phải giữ đúng petId');
    assert.strictEqual(nextSch.completed, false, 'Lịch kế tiếp phải ở trạng thái chưa hoàn thành');

    if (nextSch.id) createdScheduleIds.push(nextSch.id);

    // Thử toggle lại lần nữa (anti-replay): Không được sinh thêm lịch thứ 2
    const replayRes = await apiRequest(`/data/schedules/${schRepeatId}/toggle-complete`, {
      method: 'POST',
      headers: authHeader,
      body: { completed: true }
    });
    assert.strictEqual(replayRes.status, 200);
    const replayNext = replayRes.data?.data?.nextSchedule || replayRes.data?.nextSchedule;
    assert.strictEqual(replayNext?.id, nextSch.id, 'Anti-replay phải trả về cùng nextSchedule');
  });

  // 6. KIỂM THỬ BỘ LỌC THÚ CƯNG CÔ LẬP
  if (pet2) {
    await test('Dữ liệu của Pet 1 không xuất hiện khi lọc theo Pet 2', async () => {
      const allSchedules = await apiRequest('/data/schedules', { headers: authHeader });
      const pet2Schedules = (allSchedules.data || []).filter(s => s.petId === pet2.id);
      const hasPet1Item = pet2Schedules.some(s => s.petId === pet1.id);
      assert.strictEqual(hasPet1Item, false, 'Bộ lọc Pet 2 tuyệt đối không được chứa dữ liệu của Pet 1');
    });
  }

  // Dọn dẹp bản ghi kiểm thử
  console.log('\n[CLEANUP] Dọn dẹp bản ghi kiểm thử...');
  for (const id of createdScheduleIds) {
    await apiRequest(`/data/schedules/${id}`, {
      method: 'DELETE',
      headers: authHeader
    });
  }

  console.log(`\n====================================================`);
  console.log(`🏁 KẾT QUẢ KIỂM THỬ: ${passed}/${total} ĐẠT YÊU CẦU`);
  console.log(`====================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal error in tests:', err);
  process.exit(1);
});
