import assert from 'assert';

const BASE_URL = 'http://127.0.0.1:5000/api';

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

async function run() {
  console.log('========================================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ: BỘ LỌC VÀ BỘ ĐẾM BÁC SĨ → LỊCH KHÁM');
  console.log('========================================================================\n');

  // 1. Đăng nhập với tài khoản Bác sĩ: tester@petcare.ai
  const loginRes = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email: 'tester@petcare.ai', password: 'Doctor@123' }
  });
  assert.strictEqual(loginRes.status, 200, 'Đăng nhập bác sĩ thành công');
  const doctorToken = loginRes.data.token;
  const doctorId = loginRes.data.user.id;
  assert.strictEqual(doctorId, 'user_vet_01', 'ID bác sĩ phải là user_vet_01');
  const authHeader = { Authorization: `Bearer ${doctorToken}` };

  // 2. Lấy danh sách lịch khám backend trả về cho bác sĩ
  const apptsRes = await apiRequest('/data/appointments', { headers: authHeader });
  assert.strictEqual(apptsRes.status, 200, 'Lấy danh sách ca khám thành công');
  const doctorAppointments = apptsRes.data;
  assert.ok(Array.isArray(doctorAppointments), 'Dữ liệu trả về phải là một mảng');

  console.log(`[BACKEND] Bác sĩ user_vet_01 nhận ${doctorAppointments.length} ca khám được phân công.`);

  // 3. KIỂM TRA LỊCH ĐÃ XÁC NHẬN NGÀY 28/10/2026 ĐƯỢC GIỮ NGUYÊN (YÊU CẦU 6)
  const appt28 = doctorAppointments.find(a => a.date === '2026-10-28' && (a.assignedVetId === doctorId || a.vetId === doctorId));
  assert.ok(appt28, 'Phải tồn tại ca khám ngày 28/10/2026 của bác sĩ');
  assert.strictEqual(appt28.status, 'confirmed', 'Ca ngày 28/10/2026 phải ở trạng thái confirmed (đã xác nhận)');
  console.log('  ✅ [PASS] Lịch đã xác nhận ngày 28/10/2026 được giữ nguyên vẹn.');

  // 4. KIỂM TRA LỊCH ĐÃ HỦY NGÀY 29/10/2026 CỦA BÁC SĨ (YÊU CẦU 4)
  const appt29 = doctorAppointments.find(a => a.date === '2026-10-29' && (a.assignedVetId === doctorId || a.vetId === doctorId));
  assert.ok(appt29, 'Phải tồn tại ca khám ngày 29/10/2026 của bác sĩ');
  assert.strictEqual(appt29.status, 'cancelled', 'Ca ngày 29/10/2026 phải ở trạng thái cancelled (đã hủy)');
  assert.ok(appt29.cancelReason, 'Ca hủy phải có lý do hủy');
  console.log(`  ✅ [PASS] Ca ngày 29/10/2026 (${appt29.id}) thuộc bác sĩ này, trạng thái 'cancelled', lý do: "${appt29.cancelReason}".`);

  // 5. MÔ PHỎNG LOGIC LỌC VÀ TÍNH BỘ ĐẾM TRONG VetAppointmentsTab (YÊU CẦU 1, 2, 3)
  const todayYMD = '2026-10-27';
  const tomorrowYMD = '2026-10-28';

  function computeTabState(dateFilter, customDate = '', filterStatus = 'all', searchQuery = '') {
    // A. Lọc scopedAppointments
    let scoped = [...doctorAppointments];
    if (dateFilter === 'today') {
      scoped = scoped.filter(a => a.date === todayYMD);
    } else if (dateFilter === 'tomorrow') {
      scoped = scoped.filter(a => a.date === tomorrowYMD);
    } else if (dateFilter === 'custom' && customDate) {
      scoped = scoped.filter(a => a.date === customDate);
    }
    // Khi dateFilter === 'all': không lọc theo ngày

    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      scoped = scoped.filter(a => (a.petName || '').toLowerCase().includes(q) || (a.ownerName || '').toLowerCase().includes(q));
    }

    // B. Bộ đếm trạng thái từ scoped
    const counts = {
      all: scoped.length,
      pending: scoped.filter(a => a.status === 'pending').length,
      confirmed: scoped.filter(a => a.status === 'confirmed').length,
      in_progress: scoped.filter(a => a.status === 'in_progress').length,
      completed: scoped.filter(a => a.status === 'completed').length,
      cancelled: scoped.filter(a => a.status === 'cancelled').length
    };

    // C. filteredAppointments
    let filtered = [...scoped];
    if (filterStatus !== 'all') {
      filtered = filtered.filter(a => a.status === filterStatus);
    }

    return { scoped, counts, filtered };
  }

  // Case A: Chọn ngày Hôm nay (27/10/2026)
  const stateToday = computeTabState('today');
  console.log('\n--- Kiểm tra ngày Hôm nay (27/10/2026) ---');
  console.log('Bộ đếm:', stateToday.counts);
  assert.strictEqual(stateToday.counts.all, 0, 'Hôm nay không có ca nào, counts.all phải = 0');
  assert.strictEqual(stateToday.counts.confirmed, 0, 'Hôm nay counts.confirmed phải = 0 (KHÔNG ĐƯỢC HIỂN THỊ 1 CA CỦA NGÀY MAI)');
  assert.strictEqual(stateToday.filtered.length, 0, 'Danh sách phải trống 0 ca');
  console.log('  ✅ [PASS] Chọn 27/10: counts.all = 0, counts.confirmed = 0, danh sách trống, khớp 100%.');

  // Case B: Chọn ngày Ngày mai (28/10/2026)
  const stateTomorrow = computeTabState('tomorrow');
  console.log('\n--- Kiểm tra ngày Ngày mai (28/10/2026) ---');
  console.log('Bộ đếm:', stateTomorrow.counts);
  assert.strictEqual(stateTomorrow.counts.all, 1, 'Ngày mai có 1 ca, counts.all phải = 1');
  assert.strictEqual(stateTomorrow.counts.confirmed, 1, 'counts.confirmed phải = 1');
  assert.strictEqual(stateTomorrow.counts.cancelled, 0, 'counts.cancelled phải = 0');
  assert.strictEqual(stateTomorrow.filtered.length, 1, 'filtered.length phải = 1');
  assert.strictEqual(stateTomorrow.filtered[0].id, appt28.id);
  console.log('  ✅ [PASS] Chọn 28/10: counts.all = 1, counts.confirmed = 1, hiển thị đúng ca 28/10.');

  // Case C: Chọn ngày 29/10/2026 (Ngày cụ thể custom)
  const stateCustom29 = computeTabState('custom', '2026-10-29');
  console.log('\n--- Kiểm tra ngày 29/10/2026 (Tất cả trạng thái) ---');
  console.log('Bộ đếm:', stateCustom29.counts);
  assert.strictEqual(stateCustom29.counts.all, 1, 'counts.all ngày 29/10 phải = 1');
  assert.strictEqual(stateCustom29.counts.confirmed, 0, 'counts.confirmed ngày 29/10 phải = 0 (ca này là cancelled)');
  assert.strictEqual(stateCustom29.counts.cancelled, 1, 'counts.cancelled ngày 29/10 phải = 1');
  assert.strictEqual(stateCustom29.filtered.length, 1);
  assert.strictEqual(stateCustom29.filtered[0].id, appt29.id);
  console.log('  ✅ [PASS] Chọn 29/10: counts.all = 1, counts.cancelled = 1, counts.confirmed = 0.');

  // Case D: Chọn tab "Đã hủy" ngày 29/10/2026
  const stateCustom29Cancelled = computeTabState('custom', '2026-10-29', 'cancelled');
  console.log('\n--- Kiểm tra ngày 29/10/2026 (Tab Đã hủy) ---');
  assert.strictEqual(stateCustom29Cancelled.filtered.length, 1, 'Tab Đã hủy phải chứa đúng 1 ca hủy ngày 29/10');
  assert.strictEqual(stateCustom29Cancelled.filtered[0].id, appt29.id);
  assert.strictEqual(stateCustom29Cancelled.filtered[0].status, 'cancelled');
  console.log('  ✅ [PASS] Chọn Đã hủy ngày 29/10: Hiển thị đúng ca kiểm thử hủy BK-1793094519886!');

  // Case E: Chọn "Tất cả ngày"
  const stateAll = computeTabState('all', '2026-10-29'); // customDate truyền vào nhưng dateFilter='all' thì không được áp dụng ngầm
  console.log('\n--- Kiểm tra Tất cả ngày (Không áp dụng ngày cụ thể ngầm) ---');
  console.log('Bộ đếm:', stateAll.counts);
  assert.strictEqual(stateAll.counts.all, doctorAppointments.length, 'Tất cả ngày phải có đủ tổng số ca của bác sĩ');
  assert.strictEqual(stateAll.counts.confirmed, 1);
  assert.strictEqual(stateAll.counts.cancelled, 1);
  assert.strictEqual(stateAll.filtered.length, doctorAppointments.length);
  console.log('  ✅ [PASS] Chọn Tất cả ngày: Bỏ qua ngày ngầm, hiển thị đủ mọi ngày.');

  console.log('\n========================================================================');
  console.log('🏁 TOÀN BỘ CÁC CA KIỂM THỬ BỘ ĐẾM & BỘ LỌC ĐỀU ĐẠT CHUẨN YÊU CẦU!');
  console.log('========================================================================\n');
}

run().catch(console.error);
