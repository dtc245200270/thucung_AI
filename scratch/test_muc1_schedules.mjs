import assert from 'assert';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5000/api';
const DATA_DIR = path.resolve('./server/data');

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

// Backup file data to restore afterwards
function backupFile(filename) {
  const p = path.join(DATA_DIR, filename);
  if (fs.existsSync(p)) {
    return fs.readFileSync(p, 'utf8');
  }
  return null;
}

function restoreFile(filename, content) {
  const p = path.join(DATA_DIR, filename);
  if (content !== null) {
    fs.writeFileSync(p, content, 'utf8');
  } else if (fs.existsSync(p)) {
    fs.unlinkSync(p);
  }
}

async function runMuc1Tests() {
  console.log('====================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ HỒI QUY: MỤC 1 - LỊCH CHĂM SÓC LẶP');
  console.log('====================================================');

  const schedulesBackup = backupFile('schedules.json');
  const petsBackup = backupFile('pets.json');
  const usersBackup = backupFile('users.json');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
    }
  }

  async function asyncTest(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
    }
  }

  try {
    // 1. Authenticate users
    const adminToken = await login('admin@petcare.ai', 'Admin@123456');
    const vetRes = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email: 'tester@petcare.ai', password: 'Doctor@123' }
    });
    const vetToken = vetRes.data.token;
    const vetId = vetRes.data.user.id;

    // Helper to create and setup a test owner
    async function createTestOwner(name) {
      const email = `owner_muc1_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@petcare.ai`;
      const createRes = await apiRequest('/auth/admin/create-user', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: {
          name,
          email,
          phone: '0987111222',
          password: 'Temp@123456',
          role: 'pet_owner'
        }
      });
      const tempToken = createRes.data.user ? (await login(email, 'Temp@123456')) : null;
      // First login change password
      const changeRes = await apiRequest('/auth/first-login-change-password', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tempToken}` },
        body: { newPassword: 'Owner@123456' }
      });
      return { email, token: changeRes.data.token, user: changeRes.data.user };
    }

    const owner1 = await createTestOwner('Chủ nuôi 1 MỤC 1');
    const ownerToken = owner1.token;
    const owner1Id = owner1.user.id;

    const owner2 = await createTestOwner('Chủ nuôi 2 MỤC 1');
    const owner2Token = owner2.token;

    // Setup an owned pet for owner1
    const testPetId = `pet-muc1-${Date.now()}`;
    const createPetRes = await apiRequest('/data/pets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: {
        id: testPetId,
        name: 'Mực Mực Test M1',
        species: 'dog',
        breed: 'Poodle',
        weight: 5.5
      }
    });
    assert.strictEqual(createPetRes.status, 200, 'Tạo pet test owner1 thành công');

    // Admin phân công bác sĩ vetId cho testPetId
    const assignRes = await apiRequest(`/data/pets/${testPetId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { id: testPetId, assignedVetId: vetId }
    });
    assert.strictEqual(assignRes.status, 200, 'Admin phân công bác sĩ cho thú cưng');

    let testWeeklyParentId = null;

    // ---------------------------------------------------------
    // TEST 1: Hoàn thành lịch không lặp (Non-repeating schedule)
    // ---------------------------------------------------------
    await asyncTest('1.1. Hoàn thành lịch không lặp: chỉ đổi trạng thái, không tạo lịch tiếp theo', async () => {
      const schId = `sch-nonrepeat-${Date.now()}`;
      await apiRequest('/data/schedules', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: {
          id: schId,
          petId: testPetId,
          title: 'Uống thuốc kháng sinh 1 liều duy nhất',
          date: '2026-10-15',
          repeat: 'none',
          completed: false
        }
      });

      const toggleRes = await apiRequest(`/data/schedules/${schId}/toggle-complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` }
      });

      assert.strictEqual(toggleRes.status, 200, 'Toggle complete trả về HTTP 200');
      assert.strictEqual(toggleRes.data.success, true);
      assert.strictEqual(toggleRes.data.data.updatedSchedule.completed, true);
      assert.ok(toggleRes.data.data.updatedSchedule.completedAt, 'completedAt được ghi nhận');
      assert.strictEqual(toggleRes.data.data.nextSchedule, null, 'nextSchedule phải là null vì lịch không lặp');

      // Kiểm tra trong database
      const listRes = await apiRequest('/data/schedules', {
        headers: { Authorization: `Bearer ${ownerToken}` }
      });
      const items = listRes.data.filter(s => s.title === 'Uống thuốc kháng sinh 1 liều duy nhất');
      assert.strictEqual(items.length, 1, 'Chỉ có đúng 1 bản ghi, không sinh lịch kế tiếp');
      assert.strictEqual(items[0].completed, true);
    });

    // ---------------------------------------------------------
    // TEST 2: Hoàn thành lịch lặp hàng tuần (Weekly recurrence)
    // ---------------------------------------------------------
    await asyncTest('1.2. Hoàn thành lịch lặp weekly: tạo đúng 1 lịch tiếp theo sau 7 ngày', async () => {
      const schId = `sch-weekly-${Date.now()}`;
      testWeeklyParentId = schId;
      await apiRequest('/data/schedules', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: {
          id: schId,
          petId: testPetId,
          title: 'Tắm gội định kỳ cho cún',
          date: '2026-10-15',
          repeat: 'weekly',
          completed: false
        }
      });

      const toggleRes = await apiRequest(`/data/schedules/${schId}/toggle-complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` }
      });

      assert.strictEqual(toggleRes.status, 200);
      assert.strictEqual(toggleRes.data.data.updatedSchedule.completed, true);
      const nextSch = toggleRes.data.data.nextSchedule;
      assert.ok(nextSch, 'Phải tạo nextSchedule');
      assert.strictEqual(nextSch.date, '2026-10-22', 'Ngày lịch tiếp theo phải là 2026-10-22 (cộng 7 ngày)');
      assert.strictEqual(nextSch.parentScheduleId, schId, 'parentScheduleId trỏ về lịch cũ');
      assert.strictEqual(nextSch.completed, false, 'Lịch tiếp theo chưa hoàn thành');

      // Đọc lại từ backend
      const listRes = await apiRequest('/data/schedules', {
        headers: { Authorization: `Bearer ${ownerToken}` }
      });
      const current = listRes.data.find(s => s.id === schId);
      const createdNext = listRes.data.find(s => s.id === nextSch.id);
      assert.strictEqual(current.completed, true);
      assert.strictEqual(current.nextRecurrenceId, nextSch.id);
      assert.ok(createdNext, 'Lịch mới có trong database');
      assert.strictEqual(createdNext.completed, false);
    });

    // ---------------------------------------------------------
    // TEST 3: Giữ nguyên quy tắc ngày cuối tháng và năm nhuận
    // ---------------------------------------------------------
    await asyncTest('1.3. Lịch monthly cuối tháng năm nhuận (2024-01-31 -> 2024-02-29)', async () => {
      const schId = `sch-leap-month-${Date.now()}`;
      await apiRequest('/data/schedules', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: {
          id: schId,
          petId: testPetId,
          title: 'Nhỏ gáy trị ve hàng tháng',
          date: '2024-01-31',
          repeat: 'monthly',
          completed: false
        }
      });

      const toggleRes = await apiRequest(`/data/schedules/${schId}/toggle-complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` }
      });

      assert.strictEqual(toggleRes.status, 200);
      const nextSch = toggleRes.data.data.nextSchedule;
      assert.ok(nextSch);
      assert.strictEqual(nextSch.date, '2024-02-29', 'Tháng 2 năm nhuận 2024 phải clamp ngày 29');
    });

    await asyncTest('1.4. Lịch monthly cuối tháng năm không nhuận (2025-01-31 -> 2025-02-28)', async () => {
      const schId = `sch-nonleap-month-${Date.now()}`;
      await apiRequest('/data/schedules', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: {
          id: schId,
          petId: testPetId,
          title: 'Nhỏ gáy trị ve năm 2025',
          date: '2025-01-31',
          repeat: 'monthly',
          completed: false
        }
      });

      const toggleRes = await apiRequest(`/data/schedules/${schId}/toggle-complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` }
      });

      assert.strictEqual(toggleRes.status, 200);
      const nextSch = toggleRes.data.data.nextSchedule;
      assert.ok(nextSch);
      assert.strictEqual(nextSch.date, '2025-02-28', 'Tháng 2 năm thường 2025 phải clamp ngày 28');
    });

    await asyncTest('1.5. Lịch yearly từ 29/02 năm nhuận (2024-02-29 -> 2025-02-28)', async () => {
      const schId = `sch-yearly-leap-${Date.now()}`;
      await apiRequest('/data/schedules', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: {
          id: schId,
          petId: testPetId,
          title: 'Khám tổng quát định kỳ hàng năm',
          date: '2024-02-29',
          repeat: 'yearly',
          completed: false
        }
      });

      const toggleRes = await apiRequest(`/data/schedules/${schId}/toggle-complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` }
      });

      assert.strictEqual(toggleRes.status, 200);
      const nextSch = toggleRes.data.data.nextSchedule;
      assert.ok(nextSch);
      assert.strictEqual(nextSch.date, '2025-02-28', 'Năm sau không nhuận phải chuyển an toàn về 28/02');
    });

    // ---------------------------------------------------------
    // TEST 4: Chống tạo trùng khi gửi lại request hoặc bấm nhanh
    // ---------------------------------------------------------
    await asyncTest('1.6. Chống tạo trùng: Gửi nhiều request đồng thời chỉ tạo đúng một lịch tiếp theo', async () => {
      const schId = `sch-concurrency-${Date.now()}`;
      await apiRequest('/data/schedules', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: {
          id: schId,
          petId: testPetId,
          title: 'Cắt móng cho cún lặp weekly',
          date: '2026-10-15',
          repeat: 'weekly',
          completed: false
        }
      });

      // Bắn 5 request đồng thời mô phỏng người dùng click nhanh liên hồi
      const promises = [1, 2, 3, 4, 5].map(() =>
        apiRequest(`/data/schedules/${schId}/toggle-complete`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${ownerToken}` },
          body: { completed: true }
        })
      );

      const results = await Promise.all(promises);
      for (const res of results) {
        assert.strictEqual(res.status, 200, 'Tất cả các request đều trả về thành công');
      }

      // Kiểm tra trong database: Phải có ĐÚNG 1 bản ghi kế tiếp
      const listRes = await apiRequest('/data/schedules', {
        headers: { Authorization: `Bearer ${ownerToken}` }
      });
      const parent = listRes.data.find(s => s.id === schId);
      assert.strictEqual(parent.completed, true);

      const nextRecurrences = listRes.data.filter(s => s.parentScheduleId === schId);
      assert.strictEqual(nextRecurrences.length, 1, 'Chỉ tạo ĐÚNG 1 bản ghi kế tiếp mặc dù gửi 5 request đồng thời!');
    });

    await asyncTest('1.7. Chống tạo trùng: Gửi lại request tuần tự sau khi đã hoàn thành không tạo thêm bản ghi', async () => {
      const schId = `sch-replay-${Date.now()}`;
      await apiRequest('/data/schedules', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: {
          id: schId,
          petId: testPetId,
          title: 'Tiêm phòng dại lặp yearly',
          date: '2026-10-15',
          repeat: 'yearly',
          completed: false
        }
      });

      // Lần 1: hoàn thành
      const res1 = await apiRequest(`/data/schedules/${schId}/toggle-complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: { completed: true }
      });
      assert.strictEqual(res1.status, 200);
      const nextId1 = res1.data.data.nextSchedule?.id;
      assert.ok(nextId1);

      // Lần 2: gửi lại request hoàn thành (replay/retry sau lỗi mạng)
      const res2 = await apiRequest(`/data/schedules/${schId}/toggle-complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: { completed: true }
      });
      assert.strictEqual(res2.status, 200);
      assert.strictEqual(res2.data.data.nextSchedule?.id, nextId1, 'Vẫn trả về bản ghi kế tiếp ban đầu, không tạo mới');

      // Lần 3: gửi lại tiếp
      const res3 = await apiRequest(`/data/schedules/${schId}/toggle-complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: { completed: true }
      });
      assert.strictEqual(res3.status, 200);

      // Kiểm tra database
      const listRes = await apiRequest('/data/schedules', {
        headers: { Authorization: `Bearer ${ownerToken}` }
      });
      const children = listRes.data.filter(s => s.parentScheduleId === schId);
      assert.strictEqual(children.length, 1, 'Sau 3 lần gửi chỉ có đúng 1 bản ghi kế tiếp');
    });

    // ---------------------------------------------------------
    // TEST 5: Lỗi ghi giữa chừng không để dữ liệu cập nhật một phần
    // ---------------------------------------------------------
    await asyncTest('1.8. Lỗi ghi đĩa giữa chừng: Hoàn tác toàn bộ, lịch hiện tại giữ nguyên trạng thái cũ', async () => {
      const schId = `sch-rollback-${Date.now()}`;
      await apiRequest('/data/schedules', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: {
          id: schId,
          petId: testPetId,
          title: 'Tập thể dục buổi sáng',
          date: '2026-10-15',
          repeat: 'weekly',
          completed: false
        }
      });

      // Gửi request toggle kèm mô phỏng lỗi ghi đĩa
      const failRes = await apiRequest(`/data/schedules/${schId}/toggle-complete`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ownerToken}`,
          'x-simulate-save-failure': 'schedules'
        }
      });

      assert.strictEqual(failRes.status, 500, 'Trả về lỗi 500 khi ghi đĩa thất bại');
      assert.strictEqual(failRes.data.success, false);

      // Đọc lại từ backend: Lịch ban đầu PHẢI GIỮ NGUYÊN completed: false và KHÔNG có lịch kế tiếp
      const listRes = await apiRequest('/data/schedules', {
        headers: { Authorization: `Bearer ${ownerToken}` }
      });
      const scheduleOnDisk = listRes.data.find(s => s.id === schId);
      assert.strictEqual(scheduleOnDisk.completed, false, 'Lịch hiện tại PHẢI giữ trạng thái cũ (completed: false)');
      assert.strictEqual(scheduleOnDisk.completedAt || null, null);

      const nextRecurrences = listRes.data.filter(s => s.parentScheduleId === schId);
      assert.strictEqual(nextRecurrences.length, 0, 'KHÔNG ĐƯỢC có lịch tiếp theo nào được tạo một phần trên đĩa!');
    });

    // ---------------------------------------------------------
    // TEST 6: Phân quyền truy cập
    // ---------------------------------------------------------
    await asyncTest('1.9. Chủ nuôi khác không được phép toggle lịch của người khác (403 Forbidden)', async () => {
      const schId = `sch-owner-auth-${Date.now()}`;
      await apiRequest('/data/schedules', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: {
          id: schId,
          petId: testPetId,
          title: 'Uống vitamin A',
          date: '2026-10-15',
          repeat: 'none',
          completed: false
        }
      });

      // owner2 cố tình toggle lịch của owner1
      const res = await apiRequest(`/data/schedules/${schId}/toggle-complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner2Token}` }
      });

      assert.strictEqual(res.status, 403, 'Trả về HTTP 403 Forbidden');
    });

    await asyncTest('1.10. Bác sĩ được phân công phụ trách thú cưng có quyền toggle lịch', async () => {
      const schId = `sch-vet-auth-${Date.now()}`;
      await apiRequest('/data/schedules', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: {
          id: schId,
          petId: testPetId,
          title: 'Uống thuốc kê đơn của bác sĩ Nam',
          date: '2026-10-15',
          repeat: 'none',
          completed: false
        }
      });

      // vet1 phụ trách pet này nên có quyền
      const res = await apiRequest(`/data/schedules/${schId}/toggle-complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${vetToken}` }
      });

      assert.strictEqual(res.status, 200, 'Bác sĩ phụ trách thú cưng được phép toggle');
      assert.strictEqual(res.data.data.updatedSchedule.completed, true);
    });

    // ---------------------------------------------------------
    // TEST 7: Reload và đăng nhập phiên khác vẫn đọc đúng
    // ---------------------------------------------------------
    await asyncTest('1.11. Reload và đăng nhập từ phiên admin đọc đúng toàn bộ dữ liệu đã lưu', async () => {
      // Đăng nhập lại với phiên admin mới
      const newAdminToken = await login('admin@petcare.ai', 'Admin@123456');

      const adminListRes = await apiRequest('/data/schedules', {
        headers: { Authorization: `Bearer ${newAdminToken}` }
      });

      assert.strictEqual(adminListRes.status, 200);
      const allSchedules = adminListRes.data;
      assert.ok(Array.isArray(allSchedules));

      // Kiểm tra các lịch đã tạo trong các test trước vẫn tồn tại và nhất quán
      const weeklyParent = allSchedules.find(s => s.id === testWeeklyParentId);
      assert.ok(weeklyParent, 'Lịch weekly tồn tại');
      assert.strictEqual(weeklyParent.completed, true);
      assert.ok(weeklyParent.nextRecurrenceId, 'nextRecurrenceId được lưu chính xác');

      const weeklyChild = allSchedules.find(s => s.id === weeklyParent.nextRecurrenceId);
      assert.ok(weeklyChild, 'Lịch con tồn tại');
      assert.strictEqual(weeklyChild.date, '2026-10-22');
      assert.strictEqual(weeklyChild.completed, false);
    });

  } finally {
    // Dọn dẹp dữ liệu kiểm thử
    restoreFile('schedules.json', schedulesBackup);
    restoreFile('pets.json', petsBackup);
    restoreFile('users.json', usersBackup);
  }

  console.log('====================================================');
  console.log(`📊 KẾT QUẢ MỤC 1: ${passed}/${total} TESTS ĐẠT`);
  console.log('====================================================');
  if (passed !== total) {
    process.exit(1);
  }
}

runMuc1Tests().catch(err => {
  console.error('Lỗi thực thi kiểm thử MỤC 1:', err);
  process.exit(1);
});
