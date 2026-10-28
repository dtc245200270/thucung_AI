import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { 
  getTodayVnDate, 
  getVnDateString, 
  formatDateVi, 
  formatDateKey, 
  addDaysLocal, 
  addMonthsClamped, 
  addYearsClamped, 
  getScheduleStatus, 
  generateIcsCalendar,
  VN_TIMEZONE
} from '../src/utils/dateUtils.js';

const BASE_URL = 'http://localhost:5000/api';

console.log('================================================================');
console.log('🧪 BẮT ĐẦU BỘ KIỂM THỬ MỤC 6: THỐNG NHẤT NGÀY GIỜ (ASIA/HO_CHI_MINH)');
console.log('================================================================\n');

let totalPassed = 0;
let totalFailed = 0;

function pass(name) {
  console.log(`  ✅ [PASS] ${name}`);
  totalPassed++;
}

function fail(name, err) {
  console.error(`  ❌ [FAIL] ${name}:`, err);
  totalFailed++;
}

async function login(email, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok || !data.token) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(data)}`);
  }
  return { token: data.token, user: data.user };
}

export async function runMuc6Tests() {
  console.log('--- TEST 1: 00:05 GIỜ VIỆT NAM VẪN XÁC ĐỊNH ĐÚNG NGÀY HÔM NAY ---');
  try {
    // 00:05 AM ngày 16/10/2026 giờ Việt Nam (UTC+7)
    // Tương ứng với UTC: 17:05:00 ngày 15/10/2026 (ngày hôm trước)
    const utcMidnightEarly = new Date('2026-10-15T17:05:00.000Z');
    
    // Nếu dùng toISOString().split('T')[0] sai lầm của UTC:
    const flawedUtcDate = utcMidnightEarly.toISOString().split('T')[0];
    assert.strictEqual(flawedUtcDate, '2026-10-15', 'Lỗi giả định: UTC date phải là ngày 15');

    // Hàm chuẩn hóa giờ Việt Nam phải trả về ngày 16:
    const vnDate = getTodayVnDate(utcMidnightEarly);
    assert.strictEqual(vnDate, '2026-10-16', '00:05 giờ VN phải là ngày 2026-10-16');

    // Kiểm tra thêm mốc 00:00:01 sáng giờ VN
    const vnOneSecondPastMidnight = new Date('2026-10-15T17:00:01.000Z');
    assert.strictEqual(getTodayVnDate(vnOneSecondPastMidnight), '2026-10-16', '00:00:01 sáng VN phải là ngày 16');

    pass('00:05 sáng giờ Việt Nam xác định đúng ngày hôm nay (2026-10-16), triệt tiêu lỗi toISOString()');
  } catch (err) {
    fail('00:05 giờ Việt Nam', err);
  }

  console.log('\n--- TEST 2: 23:55 GIỜ VIỆT NAM KHÔNG CHUYỂN SANG NGÀY KẾ TIẾP ---');
  try {
    // 23:55 PM ngày 15/10/2026 giờ Việt Nam (UTC+7)
    // Tương ứng với UTC: 16:55:00 ngày 15/10/2026
    const vnLateNight = new Date('2026-10-15T16:55:00.000Z');
    const vnDate = getTodayVnDate(vnLateNight);
    assert.strictEqual(vnDate, '2026-10-15', '23:55 giờ VN phải là ngày 2026-10-15, không nhảy sang ngày 16');

    // Kiểm tra mốc 23:59:59 đêm giờ VN
    const vnLastSecondOfDay = new Date('2026-10-15T16:59:59.000Z');
    assert.strictEqual(getTodayVnDate(vnLastSecondOfDay), '2026-10-15', '23:59:59 đêm VN vẫn là ngày 2026-10-15');

    pass('23:55 và 23:59:59 đêm giờ Việt Nam không bị nhảy sang ngày kế tiếp');
  } catch (err) {
    fail('23:55 giờ Việt Nam', err);
  }

  console.log('\n--- TEST 3: LỊCH HÔM NAY / QUÁ HẠN NHẤT QUÁN TRÊN DASHBOARD VÀ THÔNG BÁO ---');
  try {
    const fixedToday = '2026-10-15';

    const testSchedules = [
      { id: 's1', title: 'Uống thuốc sáng', date: '2026-10-14', completed: false }, // Quá hạn
      { id: 's2', title: 'Tẩy giun', date: '2026-10-15', completed: false },        // Hôm nay
      { id: 's3', title: 'Tắm spa', date: '2026-10-16', completed: false },         // Sắp tới
      { id: 's4', title: 'Khám răng', date: '2026-10-14', completed: true },        // Đã hoàn thành (dù ngày quá khứ)
      { id: 's5', title: 'Cắt móng', date: '2026-10-15', completed: true },         // Đã hoàn thành hôm nay
    ];

    // 1. Kiểm tra qua getScheduleStatus helper
    assert.strictEqual(getScheduleStatus(testSchedules[0], fixedToday), 'OVERDUE');
    assert.strictEqual(getScheduleStatus(testSchedules[1], fixedToday), 'TODAY');
    assert.strictEqual(getScheduleStatus(testSchedules[2], fixedToday), 'UPCOMING');
    assert.strictEqual(getScheduleStatus(testSchedules[3], fixedToday), 'COMPLETED');
    assert.strictEqual(getScheduleStatus(testSchedules[4], fixedToday), 'COMPLETED');

    // 2. Kiểm tra tính nhất quán giữa logic Navbar và NotificationDropdown
    const overdueList = testSchedules.filter(s => {
      const sDate = getVnDateString(s.date);
      return sDate && sDate < fixedToday && !s.completed;
    });
    const todayList = testSchedules.filter(s => {
      const sDate = getVnDateString(s.date);
      return sDate && sDate === fixedToday && !s.completed;
    });

    assert.strictEqual(overdueList.length, 1, 'Chỉ 1 lịch quá hạn (s1)');
    assert.strictEqual(todayList.length, 1, 'Chỉ 1 lịch hôm nay (s2)');
    assert.strictEqual(overdueList[0].id, 's1');
    assert.strictEqual(todayList[0].id, 's2');

    // Tổng số thông báo khẩn (Navbar badge = overdue + today)
    const urgentCount = overdueList.length + todayList.length;
    assert.strictEqual(urgentCount, 2, 'Tổng số thông báo khẩn trên Navbar phải bằng 2');

    pass('Lịch hôm nay, quá hạn và đã hoàn thành phân loại nhất quán 100% giữa Dashboard, Navbar và Notification');
  } catch (err) {
    fail('Nhất quán Dashboard & Thông báo', err);
  }

  console.log('\n--- TEST 4: CUỐI THÁNG, CUỐI NĂM, NĂM NHUẬN & GIỮ NGUYÊN YYYY-MM-DD ---');
  try {
    // 4.1. Cuối tháng không nhuận (31/01/2026 + 1 tháng -> 28/02/2026)
    const clampedJan = addMonthsClamped('2026-01-31', 1);
    assert.strictEqual(clampedJan, '2026-02-28', '31/01 năm thường + 1 tháng phải kẹp tại 28/02');

    // 4.2. Cuối tháng năm nhuận (31/01/2024 + 1 tháng -> 29/02/2024)
    const clampedLeapJan = addMonthsClamped('2024-01-31', 1);
    assert.strictEqual(clampedLeapJan, '2024-02-29', '31/01 năm nhuận + 1 tháng phải kẹp tại 29/02');

    // 4.3. Năm nhuận nhảy qua ngày 29 (28/02/2024 + 1 ngày -> 29/02/2024)
    const leapDayAdd = addDaysLocal('2024-02-28', 1);
    assert.strictEqual(leapDayAdd, '2024-02-29', '28/02/2024 + 1 ngày phải sang 29/02/2024');

    // 4.4. Năm nhuận nhảy sang năm sau (29/02/2024 + 1 năm -> 28/02/2025)
    const leapYearClamped = addYearsClamped('2024-02-29', 1);
    assert.strictEqual(leapYearClamped, '2025-02-28', '29/02/2024 + 1 năm phải kẹp về 28/02/2025');

    // 4.5. Chuyển giao cuối năm (31/12/2025 + 1 ngày -> 01/01/2026)
    const newYearDay = addDaysLocal('2025-12-31', 1);
    assert.strictEqual(newYearDay, '2026-01-01', '31/12/2025 + 1 ngày phải là 01/01/2026');

    // 4.6. Trừ ngày qua năm mới (01/01/2026 - 1 ngày -> 31/12/2025)
    const prevYearDay = addDaysLocal('2026-01-01', -1);
    assert.strictEqual(prevYearDay, '2025-12-31', '01/01/2026 - 1 ngày phải là 31/12/2025');

    // 4.7. Giữ nguyên chuỗi YYYY-MM-DD không bao giờ bị lệch múi giờ
    const rawSelectedDate = '2026-08-30';
    assert.strictEqual(getVnDateString(rawSelectedDate), '2026-08-30');
    assert.strictEqual(formatDateVi(rawSelectedDate), '30/08/2026');
    assert.strictEqual(formatDateKey(rawSelectedDate), '2026-08-30');

    pass('Các phép toán ngày cuối tháng, cuối năm, năm nhuận chính xác toán học, trường YYYY-MM-DD được bảo toàn');
  } catch (err) {
    fail('Cuối tháng, cuối năm, năm nhuận', err);
  }

  console.log('\n--- TEST 5: LƯU -> RELOAD -> ĐĂNG NHẬP PHIÊN KHÁC KHÔNG LỆCH NGÀY/GIỜ ---');
  try {
    // 1. Phiên 1: Đăng nhập và tạo lịch hẹn
    const session1 = await login('admin@petcare.ai', 'Admin@123456');

    const testSchedule = {
      id: `sch-datetime-test-${Date.now()}`,
      petId: 'pet-1',
      title: 'Khám sức khỏe tổng quát cuối năm',
      type: 'vet',
      date: '2026-12-31',
      time: '14:30',
      location: 'Bệnh viện thú y Hà Nội',
      notes: 'Kiểm tra khớp và siêu âm bụng',
      completed: false
    };

    const createRes = await fetch(`${BASE_URL}/data/schedules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session1.token}`
      },
      body: JSON.stringify(testSchedule)
    });
    assert.strictEqual(createRes.status, 200, 'Tạo lịch thành công');

    // 2. Reload (GET lại dữ liệu từ server trên phiên 1)
    const getRes1 = await fetch(`${BASE_URL}/data/schedules`, {
      headers: { 'Authorization': `Bearer ${session1.token}` }
    });
    const schedulesList1 = await getRes1.json();
    const savedItem1 = schedulesList1.find(s => s.id === testSchedule.id);
    assert.ok(savedItem1, 'Phải tìm thấy lịch vừa tạo sau khi reload');
    assert.strictEqual(savedItem1.date, '2026-12-31', 'Ngày sau reload phải giữ nguyên 2026-12-31');
    assert.strictEqual(savedItem1.time, '14:30', 'Giờ sau reload phải giữ nguyên 14:30');

    // 3. Đăng nhập một phiên làm việc mới (Phiên 2)
    // Giả lập người dùng đăng nhập ở thiết bị/tab khác, sinh JWT token mới
    const session2 = await login('admin@petcare.ai', 'Admin@123456');
    const getRes2 = await fetch(`${BASE_URL}/data/schedules`, {
      headers: { 'Authorization': `Bearer ${session2.token}` }
    });
    const schedulesList2 = await getRes2.json();
    const savedItem2 = schedulesList2.find(s => s.id === testSchedule.id);
    assert.ok(savedItem2, 'Phiên đăng nhập khác phải đọc được lịch');
    assert.strictEqual(savedItem2.date, '2026-12-31', 'Ngày ở phiên đăng nhập khác vẫn là 2026-12-31');
    assert.strictEqual(savedItem2.time, '14:30', 'Giờ ở phiên đăng nhập khác vẫn là 14:30');

    // 4. Kiểm tra thêm với trường hợp lưu cuộc hẹn lâm sàng (appointments)
    const testAppointment = {
      id: `app-datetime-test-${Date.now()}`,
      petId: 'pet-1',
      date: '2026-11-25',
      time: '10:15',
      service: 'Khám chuyên khoa da liễu',
      status: 'confirmed',
      notes: 'Bé bị ngứa ngáy vùng tai'
    };

    const createAppRes = await fetch(`${BASE_URL}/data/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session1.token}`
      },
      body: JSON.stringify(testAppointment)
    });
    assert.strictEqual(createAppRes.status, 200, 'Tạo cuộc hẹn thành công');

    const getAppRes = await fetch(`${BASE_URL}/data/appointments`, {
      headers: { 'Authorization': `Bearer ${session2.token}` }
    });
    const appointmentsList = await getAppRes.json();
    const savedApp = appointmentsList.find(a => a.id === testAppointment.id);
    assert.ok(savedApp, 'Phiên khác phải đọc được cuộc hẹn lâm sàng');
    assert.strictEqual(savedApp.date, '2026-11-25', 'Ngày khám phải bảo toàn 2026-11-25');
    assert.strictEqual(savedApp.time, '10:15', 'Giờ khám phải bảo toàn 10:15');

    // Dọn dẹp bản ghi test
    await fetch(`${BASE_URL}/data/schedules/${testSchedule.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${session1.token}` }
    });
    await fetch(`${BASE_URL}/data/appointments/${testAppointment.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${session1.token}` }
    });

    pass('Lưu -> Reload -> Đăng nhập phiên khác giữ nguyên 100% ngày YYYY-MM-DD và giờ HH:mm');
  } catch (err) {
    fail('Lưu - reload - đa phiên', err);
  }

  console.log('\n--- TEST 6: XUẤT ICS GIỮ ĐÚNG NGÀY VÀ GIỜ ĐÃ CHỌN ---');
  try {
    const testSchForIcs = [
      {
        id: 'ics-sch-01',
        petId: 'pet-1',
        petName: 'Mochi',
        title: 'Tiêm phòng dại Rabisin',
        date: '2026-11-20',
        time: '15:45',
        location: 'Phòng khám thú y Quốc Tế',
        notes: 'Mang theo hồ sơ WSAVA của bé'
      }
    ];

    const icsContent = generateIcsCalendar(testSchForIcs, [{ id: 'pet-1', name: 'Mochi' }]);
    
    // Kiểm tra cấu trúc RFC 5545
    assert.ok(icsContent.includes('BEGIN:VCALENDAR'), 'Phải có BEGIN:VCALENDAR');
    assert.ok(icsContent.includes('END:VCALENDAR'), 'Phải có END:VCALENDAR');
    
    // Kiểm tra định danh múi giờ Việt Nam
    assert.ok(icsContent.includes('BEGIN:VTIMEZONE'), 'Phải có khối VTIMEZONE');
    assert.ok(icsContent.includes('TZID:Asia/Ho_Chi_Minh'), 'Phải khai báo TZID:Asia/Ho_Chi_Minh');
    assert.ok(icsContent.includes('TZOFFSETFROM:+0700'), 'Phải có offset +0700');
    assert.ok(icsContent.includes('TZOFFSETTO:+0700'), 'Phải có offset to +0700');

    // Kiểm tra DTSTART và DTEND gắn chặt với TZID
    assert.ok(
      icsContent.includes('DTSTART;TZID=Asia/Ho_Chi_Minh:20261120T154500'),
      'DTSTART phải đúng 20261120T154500 và có TZID=Asia/Ho_Chi_Minh'
    );
    assert.ok(
      icsContent.includes('DTEND;TZID=Asia/Ho_Chi_Minh:20261120T164500'),
      'DTEND phải đúng 20261120T164500 và có TZID=Asia/Ho_Chi_Minh'
    );

    // Kiểm tra thông tin mô tả và địa điểm
    assert.ok(icsContent.includes('Mochi'), 'Phải có tên thú cưng');
    assert.ok(icsContent.includes('Tiêm phòng dại Rabisin'), 'Phải có tiêu đề');
    assert.ok(icsContent.includes('Phòng khám thú y Quốc Tế'), 'Phải có địa điểm');

    pass('Tệp iCalendar (.ics) chứa khối VTIMEZONE Asia/Ho_Chi_Minh chuẩn RFC 5545 và giữ đúng ngày giờ đã chọn');
  } catch (err) {
    fail('Xuất file ICS', err);
  }

  console.log('\n================================================================');
  console.log(`KẾT QUẢ BỘ KIỂM THỬ MỤC 6: ${totalPassed} PASS / ${totalFailed} FAIL`);
  console.log('================================================================\n');

  if (totalFailed > 0) {
    throw new Error(`Bộ kiểm thử Mục 6 thất bại với ${totalFailed} lỗi.`);
  }
}

// Chạy trực tiếp nếu file được thực thi bằng node
if (process.argv[1] && process.argv[1].endsWith('test_muc6_datetime.mjs')) {
  runMuc6Tests().catch(err => {
    console.error('Fatal error during Muc 6 tests:', err);
    process.exit(1);
  });
}
