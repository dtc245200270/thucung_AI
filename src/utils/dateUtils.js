/**
 * Hệ thống Xử lý Ngày Giờ Chuẩn Hóa - PetCare PRO AI (MỤC 6)
 * Thống nhất múi giờ nghiệp vụ: Asia/Ho_Chi_Minh (UTC+7)
 * Đảm bảo:
 * - Xác định chính xác "hôm nay" theo giờ Việt Nam (00:05 và 23:55).
 * - Tự động cập nhật qua nửa đêm (Midnight Rollover) không cần reload trang.
 * - Trường ngày YYYY-MM-DD giữ nguyên ngày đã chọn, không bị lệch do múi giờ.
 * - Phân biệt ngày lịch (YYYY-MM-DD) và timestamp điểm thời gian (createdAt/updatedAt UTC).
 * - Xử lý an toàn ranh giới cuối tháng, cuối năm, năm nhuận.
 * - Xuất tệp iCalendar (.ics) chuẩn RFC 5545, khóa chặt theo Asia/Ho_Chi_Minh,
 *   hỗ trợ sự kiện qua nửa đêm và escape ký tự đặc biệt.
 */

export const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

let customMockTime = null;

/**
 * Thiết lập mốc thời gian giả lập phục vụ kiểm thử (Mock Time)
 * @param {Date|number|string|null} mockTime
 */
export function setCustomVnDateMock(mockTime) {
  customMockTime = mockTime ? new Date(mockTime) : null;
  if (typeof window !== 'undefined') {
    window.__PETCARE_MOCK_TIME__ = mockTime ? new Date(mockTime).toISOString() : null;
  }
  triggerVnDateCheck(customMockTime);
}

export function getCustomVnDateMock() {
  if (customMockTime) return customMockTime;
  if (typeof window !== 'undefined' && window.__PETCARE_MOCK_TIME__) {
    const d = new Date(window.__PETCARE_MOCK_TIME__);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

if (typeof window !== 'undefined') {
  window.__PETCARE_SET_MOCK_TIME__ = setCustomVnDateMock;
}

/**
 * Lấy chuỗi ngày "hôm nay" theo giờ Việt Nam (Asia/Ho_Chi_Minh) dạng YYYY-MM-DD
 * @param {Date|number|string} [referenceTime]
 * @returns {string} YYYY-MM-DD
 */
export function getTodayVnDate(referenceTime) {
  let d;
  if (referenceTime !== undefined && referenceTime !== null) {
    d = referenceTime instanceof Date ? referenceTime : new Date(referenceTime);
  } else {
    const mock = getCustomVnDateMock();
    d = mock || new Date();
  }

  if (isNaN(d.getTime())) {
    d = new Date();
  }

  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: VN_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(d);
  } catch {
    // Fallback tính toán thuần toán học dựa trên offset UTC+7 (không bị ảnh hưởng DST)
    const vnMs = d.getTime() + 7 * 60 * 60 * 1000;
    const vn = new Date(vnMs);
    const y = vn.getUTCFullYear();
    const m = String(vn.getUTCMonth() + 1).padStart(2, '0');
    const day = String(vn.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}

/**
 * Kiểm tra chuỗi ngày có phải định dạng YYYY-MM-DD hợp lệ trên lịch thực tế không
 * Không chấp nhận ngày không có thật (vd: 2026-02-29, 2026-04-31)
 * @param {string} dateStr
 * @returns {boolean}
 */
export function isValidCalendarDate(dateStr) {
  if (typeof dateStr !== 'string') return false;
  const trimmed = dateStr.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return false;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && (d.getMonth() + 1) === month && d.getDate() === day;
}

/**
 * Chuẩn hóa input ngày thành chuỗi YYYY-MM-DD theo giờ Việt Nam
 * ĐẶC BIỆT: Nếu input đã là chuỗi YYYY-MM-DD thì GIỮ NGUYÊN TUYỆT ĐỐI,
 * không chuyển qua Date object để tránh bị lệch ngày khi chạy ở múi giờ khác!
 * @param {Date|string|number} input
 * @returns {string} YYYY-MM-DD
 */
export function getVnDateString(input) {
  if (input === null || input === undefined || input === '') {
    return getTodayVnDate();
  }

  // 1. Nếu đã là chuỗi thuần YYYY-MM-DD (calendar date), giữ nguyên không parse Date
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    // Nếu là chuỗi ISO datetime có phần giờ T... hoặc Z
    if (trimmed.includes('T')) {
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) {
        return getTodayVnDate(d);
      }
      return trimmed.split('T')[0];
    }
  }

  // 2. Nếu là Date object hoặc timestamp
  const d = input instanceof Date ? input : new Date(input);
  if (!isNaN(d.getTime())) {
    return getTodayVnDate(d);
  }

  return getTodayVnDate();
}

/**
 * Backward compatibility: thay thế getLocalDateString cũ
 */
export function getLocalDateString(d = new Date()) {
  return getVnDateString(d);
}

/**
 * Định dạng ngày Việt Nam hiển thị DD/MM/YYYY không bị lệch múi giờ
 * @param {string|Date} dateInput
 * @returns {string} DD/MM/YYYY
 */
export function formatDateVi(dateInput) {
  if (!dateInput) return '';
  const ymd = getVnDateString(dateInput);
  const parts = ymd.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  }
  return String(dateInput);
}

/**
 * Định dạng ngày YYYY-MM-DD dùng làm key (tương thích WeeklyCalendar)
 * @param {string|Date} dateInput
 * @returns {string} YYYY-MM-DD
 */
export function formatDateKey(dateInput) {
  return getVnDateString(dateInput);
}

/**
 * Cộng/trừ số ngày trên chuỗi YYYY-MM-DD an toàn toán học UTC
 * Bảo đảm đúng hạn cuối tháng, cuối năm, năm nhuận
 * @param {string} dateStr YYYY-MM-DD
 * @param {number} daysToAdd
 * @returns {string} YYYY-MM-DD
 */
export function addDaysLocal(dateStr, daysToAdd) {
  const clean = getVnDateString(dateStr);
  const [y, m, d] = clean.split('-').map(Number);
  const u = new Date(Date.UTC(y, m - 1, d));
  u.setUTCDate(u.getUTCDate() + Number(daysToAdd));
  const resY = u.getUTCFullYear();
  const resM = String(u.getUTCMonth() + 1).padStart(2, '0');
  const resD = String(u.getUTCDate()).padStart(2, '0');
  return `${resY}-${resM}-${resD}`;
}

/**
 * Cộng/trừ số tháng an toàn có kẹp ngày cuối tháng (Clamping)
 * Ví dụ: 31/01 + 1 tháng -> 28/02 (hoặc 29/02 năm nhuận)
 * @param {string} dateStr YYYY-MM-DD
 * @param {number} monthsToAdd
 * @returns {string} YYYY-MM-DD
 */
export function addMonthsClamped(dateStr, monthsToAdd) {
  const clean = getVnDateString(dateStr);
  const [y, m, d] = clean.split('-').map(Number);
  const totalMonths = y * 12 + (m - 1) + Number(monthsToAdd);
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12; // 0-indexed (0=Jan..11=Dec)
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(d, daysInTargetMonth);
  return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

/**
 * Cộng/trừ số năm an toàn có kẹp năm nhuận (29/02 -> 28/02 năm thường)
 * @param {string} dateStr YYYY-MM-DD
 * @param {number} yearsToAdd
 * @returns {string} YYYY-MM-DD
 */
export function addYearsClamped(dateStr, yearsToAdd) {
  const clean = getVnDateString(dateStr);
  const [y, m, d] = clean.split('-').map(Number);
  const targetYear = y + Number(yearsToAdd);
  const daysInTargetMonth = new Date(Date.UTC(targetYear, m, 0)).getUTCDate();
  const clampedDay = Math.min(d, daysInTargetMonth);
  return `${targetYear}-${String(m).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

/**
 * Phân loại trạng thái lịch trình / ca khám thống nhất cho Dashboard và Thông báo
 * @param {Object} item { date, completed, status }
 * @param {string} [todayVn=getTodayVnDate()]
 * @returns {'COMPLETED'|'OVERDUE'|'TODAY'|'UPCOMING'|'UNKNOWN'}
 */
export function getScheduleStatus(item, todayVn = getTodayVnDate()) {
  if (!item) return 'UNKNOWN';

  const isCompleted = Boolean(
    item.completed || 
    item.status === 'completed' || 
    item.status === 'COMPLETED' || 
    item.status === 'hoàn thành'
  );
  if (isCompleted) return 'COMPLETED';

  const isCancelled = Boolean(
    item.status === 'cancelled' || 
    item.status === 'CANCELLED' || 
    item.status === 'đã hủy'
  );
  if (isCancelled) return 'CANCELLED';

  const itemDate = item.date ? getVnDateString(item.date) : '';
  if (!itemDate) return 'UPCOMING';

  if (itemDate < todayVn) return 'OVERDUE';
  if (itemDate === todayVn) return 'TODAY';
  return 'UPCOMING';
}

/**
 * Thoát ký tự đặc biệt theo chuẩn RFC 5545 Text Formatting
 * (Dấu phẩy, chấm phẩy, gạch chéo ngược, xuống dòng)
 * @param {string} text
 * @returns {string}
 */
export function escapeIcsText(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Xuất file iCalendar chuẩn RFC 5545, khóa chặt theo múi giờ Asia/Ho_Chi_Minh
 * Giữ nguyên ngày và giờ người dùng đã chọn
 * Xử lý chính xác sự kiện qua nửa đêm và thoát ký tự an toàn.
 * @param {Array} schedules
 * @param {Array} pets
 * @returns {string}
 */
export function generateIcsCalendar(schedules = [], pets = []) {
  const petMap = {};
  if (Array.isArray(pets)) {
    pets.forEach(p => {
      if (p && p.id) petMap[p.id] = p.name;
    });
  }

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PetCare PRO AI//Smart Pet Calendar VN//VI',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    // Khối VTIMEZONE chuẩn quốc tế cho Asia/Ho_Chi_Minh (UTC+7)
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Ho_Chi_Minh',
    'TZURL:http://tzurl.org/zoneinfo-outlook/Asia/Ho_Chi_Minh',
    'X-LIC-LOCATION:Asia/Ho_Chi_Minh',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0700',
    'TZOFFSETTO:+0700',
    'TZNAME:+07',
    'DTSTART:19700101T000000',
    'END:STANDARD',
    'END:VTIMEZONE'
  ];

  const nowStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  (Array.isArray(schedules) ? schedules : []).forEach((sch, index) => {
    if (!sch || !sch.date) return;
    const schDateStr = getVnDateString(sch.date);
    const cleanStartDate = schDateStr.replace(/-/g, '');
    const rawTime = (sch.time || '09:00').trim();
    const cleanTime = (rawTime.includes(':') ? rawTime.replace(':', '') : rawTime.padStart(4, '0')) + '00';

    const startHour = parseInt(cleanTime.slice(0, 2), 10) || 0;
    const startMin = parseInt(cleanTime.slice(2, 4), 10) || 0;
    const durationMinutes = Number(sch.durationMinutes) || 60; // Mặc định 60 phút

    // Tính toán ngày và giờ kết thúc chuẩn xác qua nửa đêm
    const totalStartMinutes = startHour * 60 + startMin;
    const totalEndMinutes = totalStartMinutes + durationMinutes;
    const daysToAdd = Math.floor(totalEndMinutes / (24 * 60));
    const endMinutesInDay = totalEndMinutes % (24 * 60);
    const endHour = Math.floor(endMinutesInDay / 60);
    const endMin = endMinutesInDay % 60;

    const endDateStr = daysToAdd > 0 ? addDaysLocal(schDateStr, daysToAdd) : schDateStr;
    const cleanEndDate = endDateStr.replace(/-/g, '');
    const cleanEndTime = String(endHour).padStart(2, '0') + String(endMin).padStart(2, '0') + '00';

    const petName = sch.petName || petMap[sch.petId] || 'Thú cưng';
    const uid = sch.id ? `uid-${sch.id}@petcare.ai` : `uid-${cleanStartDate}-${cleanTime}-${index}@petcare.ai`;
    const title = sch.title || 'Lịch chăm sóc thú cưng';
    const notes = sch.notes || 'Nhắc nhở tự động từ PetCare PRO AI.';
    const location = sch.location || 'Tại nhà / Phòng khám';

    icsLines.push('BEGIN:VEVENT');
    icsLines.push(`UID:${uid}`);
    icsLines.push(`DTSTAMP:${nowStamp}`);
    icsLines.push(`DTSTART;TZID=Asia/Ho_Chi_Minh:${cleanStartDate}T${cleanTime}`);
    icsLines.push(`DTEND;TZID=Asia/Ho_Chi_Minh:${cleanEndDate}T${cleanEndTime}`);
    icsLines.push(`SUMMARY:🐾 [PetCare AI] ${escapeIcsText(title)} (${escapeIcsText(petName)})`);
    icsLines.push(`DESCRIPTION:${escapeIcsText(notes)}`);
    icsLines.push(`LOCATION:${escapeIcsText(location)}`);
    icsLines.push('STATUS:CONFIRMED');
    icsLines.push('END:VEVENT');
  });

  icsLines.push('END:VCALENDAR');
  return icsLines.join('\r\n');
}

// ============================================================================
// HỆ THỐNG THEO DÕI QUA NỬA ĐÊM (MIDNIGHT ROLLOVER OBSERVER)
// ============================================================================
const dateChangeListeners = new Set();
let lastKnownVnDate = getTodayVnDate();
let checkIntervalId = null;

export function getCachedTodayVnDate() {
  return lastKnownVnDate;
}

/**
 * Kiểm tra xem ngày Việt Nam đã chuyển đổi chưa, thông báo cho toàn bộ subscribers
 * @param {Date|number|string} [customNow]
 * @returns {boolean}
 */
export function triggerVnDateCheck(customNow) {
  const currentVn = getTodayVnDate(customNow);
  if (currentVn !== lastKnownVnDate) {
    const prev = lastKnownVnDate;
    lastKnownVnDate = currentVn;
    dateChangeListeners.forEach(cb => {
      try { cb(currentVn, prev); } catch (e) { console.warn('Date listener error:', e); }
    });
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('petcare:date-changed', {
        detail: { todayVn: currentVn, previousVn: prev }
      }));
    }
    return true;
  }
  return false;
}

/**
 * Đăng ký lắng nghe thay đổi ngày qua nửa đêm (dọn dẹp khi unmount)
 * @param {Function} callback (newDate, oldDate) => void
 * @returns {Function} unsubscribe cleanup function
 */
export function subscribeVnDateChange(callback) {
  if (typeof callback !== 'function') return () => {};
  dateChangeListeners.add(callback);

  if (typeof window !== 'undefined' && checkIntervalId === null) {
    // Kiểm tra định kỳ mỗi 15 giây
    checkIntervalId = setInterval(() => {
      triggerVnDateCheck();
    }, 15000);

    const onVisibilityOrFocus = () => {
      triggerVnDateCheck();
    };

    window.addEventListener('visibilitychange', onVisibilityOrFocus);
    window.addEventListener('focus', onVisibilityOrFocus);
  }

  return () => {
    dateChangeListeners.delete(callback);
    if (dateChangeListeners.size === 0 && checkIntervalId !== null) {
      clearInterval(checkIntervalId);
      checkIntervalId = null;
    }
  };
}

/**
 * Lấy chuỗi giờ hiện tại theo giờ Việt Nam (Asia/Ho_Chi_Minh) dạng HH:MM
 * @param {Date|number|string} [referenceTime]
 * @returns {string} HH:MM
 */
export function getCurrentVnTime(referenceTime) {
  let d;
  if (referenceTime !== undefined && referenceTime !== null) {
    d = referenceTime instanceof Date ? referenceTime : new Date(referenceTime);
  } else {
    const mock = getCustomVnDateMock();
    d = mock || new Date();
  }
  if (isNaN(d.getTime())) d = new Date();

  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: VN_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    return formatter.format(d);
  } catch {
    const vnMs = d.getTime() + 7 * 60 * 60 * 1000;
    const vn = new Date(vnMs);
    const h = String(vn.getUTCHours()).padStart(2, '0');
    const m = String(vn.getUTCMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
}

/**
 * Kiểm tra chuỗi giờ có đúng định dạng HH:MM (00:00 - 23:59) hay không
 * @param {string} timeStr
 * @returns {boolean}
 */
export function isValidTimeFormat(timeStr) {
  if (typeof timeStr !== 'string') return false;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(timeStr.trim());
  return Boolean(match);
}

/**
 * Kiểm tra mốc ngày và giờ có thuộc quá khứ theo giờ Việt Nam hay không
 * @param {string} dateStr YYYY-MM-DD
 * @param {string} [timeStr] HH:MM
 * @param {Date|number|string} [referenceTime]
 * @returns {boolean}
 */
export function isPastVnDateTime(dateStr, timeStr, referenceTime) {
  const todayVn = getTodayVnDate(referenceTime);
  if (!dateStr || dateStr < todayVn) return true;
  if (dateStr > todayVn) return false;
  // dateStr === todayVn
  if (!timeStr) return false;
  const currentVnTime = getCurrentVnTime(referenceTime);
  return timeStr <= currentVnTime;
}

/**
 * Định dạng giờ 24 giờ HH:mm chuẩn hóa (00:00 - 23:59)
 * - Nếu input là chuỗi 24 giờ HH:mm (như "20:00", "19:30", "08:00", "07:30") -> GIỮ NGUYÊN TUYỆT ĐỐI.
 * - Nếu input là chuỗi H:mm (như "8:00", "7:30") -> chuẩn hóa thành "08:00", "07:30".
 * - Nếu input có chứa SA/CH hoặc AM/PM (như "08:00 CH", "07:30 PM", "8:00 SA") -> chuyển chính xác sang 24 giờ:
 *     "08:00 CH" / "08:00 PM" -> "20:00"
 *     "07:30 CH" / "07:30 PM" -> "19:30"
 *     "08:00 SA" / "08:00 AM" -> "08:00"
 *     "07:30 SA" / "07:30 AM" -> "07:30"
 *     "12:00 SA" / "12:00 AM" -> "00:00"
 *     "12:00 CH" / "12:00 PM" -> "12:00"
 * - TUYỆT ĐỐI KHÔNG chuyển giờ 24h (như 20:00, 19:30) thành 12h thiếu SA/CH (08:00, 07:30).
 * - Nếu timeInput không có hoặc rỗng, fallback trích xuất giờ 24h từ isoTimestamp (theo múi giờ Asia/Ho_Chi_Minh).
 * @param {string} [timeInput]
 * @param {string|Date} [isoTimestamp]
 * @returns {string} HH:mm hoặc ''
 */
export function formatTime24h(timeInput, isoTimestamp) {
  if (timeInput && typeof timeInput === 'string' && timeInput.trim()) {
    const raw = timeInput.trim();

    // 1. Kiểm tra nếu có định dạng 12 giờ kèm SA/CH hoặc AM/PM
    const match12 = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(SA|CH|AM|PM)$/i.exec(raw);
    if (match12) {
      let h = parseInt(match12[1], 10);
      const m = match12[2];
      const meridiem = match12[3].toUpperCase();

      if (meridiem === 'CH' || meridiem === 'PM') {
        if (h < 12) h += 12;
      } else if (meridiem === 'SA' || meridiem === 'AM') {
        if (h === 12) h = 0;
      }
      return `${String(h).padStart(2, '0')}:${m}`;
    }

    // 2. Nếu đã là chuỗi giờ HH:mm hoặc H:mm chuẩn 24 giờ
    const match24 = /^([01]?\d|2[0-3]):([0-5]\d)/.exec(raw);
    if (match24) {
      const h = match24[1].padStart(2, '0');
      const m = match24[2];
      return `${h}:${m}`;
    }

    return raw;
  }

  // 3. Fallback: Nếu không có timeInput nhưng có isoTimestamp (createdAt/updatedAt)
  if (isoTimestamp) {
    try {
      const d = isoTimestamp instanceof Date ? isoTimestamp : new Date(isoTimestamp);
      if (!isNaN(d.getTime())) {
        return getCurrentVnTime(d);
      }
    } catch (_) {}
  }

  return '';
}


