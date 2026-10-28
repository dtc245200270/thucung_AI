import React, { useState, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { sound } from '../../services/soundService';
import { getTodayVnDate, getVnDateString, formatDateKey } from '../../utils/dateUtils.js';
import { useCurrentVnDate } from '../../hooks/useCurrentVnDate';

export { formatDateKey };

/**
 * Helper: Lấy ngày Thứ 2 đầu tuần cho bất kỳ ngày nào theo lịch địa phương/VN
 */
export const getMonday = (d) => {
  let date;
  if (typeof d === 'string') {
    const clean = getVnDateString(d);
    const [y, m, dayNum] = clean.split('-').map(Number);
    date = new Date(y, m - 1, dayNum);
  } else {
    date = new Date(d);
  }
  date.setHours(0, 0, 0, 0);
  const day = date.getDay(); // 0: Chủ Nhật, 1: Thứ Hai, ..., 6: Thứ Bảy
  const diff = day === 0 ? -6 : 1 - day; // Chuyển Thứ 2 thành ngày đầu tuần
  date.setDate(date.getDate() + diff);
  return date;
};

/**
 * Helper: Tạo Tiêu đề tháng thông minh:
 * - Trong cùng 1 tháng: "Tháng MM, YYYY" (vd: Tháng 10, 2026)
 * - Trải dài qua 2 tháng: "Tháng MM - MM, YYYY" (vd: Tháng 09 - 10, 2026)
 * - Trải dài qua 2 năm: "Tháng MM, YYYY - Tháng MM, YYYY" (vd: Tháng 12, 2026 - Tháng 01, 2027)
 */
export const getSmartMonthTitle = (monday, sunday) => {
  const startMonth = monday.getMonth() + 1;
  const endMonth = sunday.getMonth() + 1;
  const startYear = monday.getFullYear();
  const endYear = sunday.getFullYear();

  const mStartStr = String(startMonth).padStart(2, '0');
  const mEndStr = String(endMonth).padStart(2, '0');

  if (startYear === endYear) {
    if (startMonth === endMonth) {
      return `Tháng ${mStartStr}, ${startYear}`;
    }
    return `Tháng ${mStartStr} - ${mEndStr}, ${startYear}`;
  }

  return `Tháng ${mStartStr}, ${startYear} - Tháng ${mEndStr}, ${endYear}`;
};

const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const FULL_DAY_LABELS = [
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
  'Chủ Nhật'
];

/**
 * Component WeeklyCalendar (Lịch tuần trực quan)
 * Tự động tính toán tuần động, xử lý chuyển giao tháng, giao diện Light/Dark Mode tinh tế.
 */
export const WeeklyCalendar = ({
  selectedDate = new Date(),
  onSelectDate = () => {},
  schedules = [],
  className = ''
}) => {
  // Quản lý tuần hiện tại người dùng đang xem (offset số tuần so với tuần hiện tại)
  const [weekOffset, setWeekOffset] = useState(0);

  // Ngày hôm nay (Thời gian thực theo chuẩn Asia/Ho_Chi_Minh, tự cập nhật qua nửa đêm)
  const todayKey = useCurrentVnDate();

  // Thứ 2 của tuần được hiển thị
  const currentMonday = useMemo(() => {
    const [y, m, d] = todayKey.split('-').map(Number);
    const ref = new Date(y, m - 1, d);
    ref.setDate(ref.getDate() + weekOffset * 7);
    return getMonday(ref);
  }, [todayKey, weekOffset]);

  // Chủ nhật của tuần được hiển thị
  const currentSunday = useMemo(() => {
    const sun = new Date(currentMonday);
    sun.setDate(currentMonday.getDate() + 6);
    return sun;
  }, [currentMonday]);

  // Tiêu đề tháng thông minh
  const smartMonthTitle = useMemo(() => {
    return getSmartMonthTitle(currentMonday, currentSunday);
  }, [currentMonday, currentSunday]);

  // Danh sách 7 ngày trong tuần
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, index) => {
      const d = new Date(currentMonday);
      d.setDate(currentMonday.getDate() + index);
      const dateKey = formatDateKey(d);
      
      // Ngày thuộc tháng khác tháng bắt đầu tuần (thường là tháng kế tiếp)
      const isNextMonth = d.getMonth() !== currentMonday.getMonth();

      return {
        date: d,
        dateKey,
        dayLabel: DAY_LABELS[index],
        fullDayLabel: FULL_DAY_LABELS[index],
        dateNumber: String(d.getDate()).padStart(2, '0'),
        monthNumber: d.getMonth() + 1,
        isNextMonth,
        isToday: dateKey === todayKey
      };
    });
  }, [currentMonday, todayKey]);

  // Tập hợp các ngày có lịch hẹn / tác vụ
  const scheduleDatesCount = useMemo(() => {
    const countMap = {};
    if (Array.isArray(schedules)) {
      schedules.forEach(s => {
        if (s?.date) {
          countMap[s.date] = (countMap[s.date] || 0) + 1;
        }
      });
    }
    return countMap;
  }, [schedules]);

  const selectedKey = useMemo(() => {
    return selectedDate ? formatDateKey(selectedDate) : todayKey;
  }, [selectedDate, todayKey]);

  const handlePrevWeek = () => {
    try { sound?.playClick?.(); } catch {}
    setWeekOffset(prev => prev - 1);
  };

  const handleNextWeek = () => {
    try { sound?.playClick?.(); } catch {}
    setWeekOffset(prev => prev + 1);
  };

  const handleResetToday = () => {
    try { sound?.playClick?.(); } catch {}
    setWeekOffset(0);
    onSelectDate(new Date());
  };

  const isCurrentWeek = weekOffset === 0;

  // Lấy thông tin ngày đang chọn để hiển thị chi tiết
  const currentSelectedDayInfo = useMemo(() => {
    const targetKey = selectedKey;
    const found = weekDays.find(w => w.dateKey === targetKey);
    if (found) return found;

    const d = new Date(selectedDate);
    const dayIndex = d.getDay();
    const viIndex = dayIndex === 0 ? 6 : dayIndex - 1;
    return {
      date: d,
      dateKey: targetKey,
      dayLabel: DAY_LABELS[viIndex] || 'T2',
      fullDayLabel: FULL_DAY_LABELS[viIndex] || 'Hôm nay',
      dateNumber: String(d.getDate()).padStart(2, '0'),
      monthNumber: d.getMonth() + 1,
      isToday: targetKey === todayKey
    };
  }, [selectedKey, weekDays, selectedDate, todayKey]);

  return (
    <div className={`shrink-0 bg-white dark:bg-slate-900/80 border border-[#E2E8F0] dark:border-white/10 rounded-3xl p-3.5 sm:p-4 shadow-sm dark:shadow-xl relative group transition-colors ${className}`}>
      
      {/* 1. Header: Icon, Tiêu đề Lịch Tuần & Tiêu đề Tháng Thông Minh kèm Điều Hướng */}
      <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0] dark:border-white/10 mb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-2xl bg-[#F1F5F9] dark:bg-white/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-[#E2E8F0] dark:border-white/10 shadow-xs">
            <CalendarIcon className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold text-[#0F172A] dark:text-white uppercase tracking-wider">
            Lịch Tuần Trực Quan
          </span>
        </div>

        {/* Cụm điều hướng tuần & Tiêu đề tháng thông minh */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          <button
            type="button"
            onClick={handlePrevWeek}
            title="Tuần trước"
            className="w-6 h-6 rounded-xl bg-[#F8FAFC] dark:bg-white/10 hover:bg-[#F1F5F9] dark:hover:bg-white/20 border border-[#E2E8F0] dark:border-white/10 text-[#475569] dark:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-xs"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {/* Tiêu đề tháng thông minh */}
          <span 
            title={smartMonthTitle}
            className="text-[10px] font-mono font-bold text-[#0F172A] dark:text-white bg-[#F1F5F9] dark:bg-white/10 px-2 py-0.5 rounded-xl border border-[#E2E8F0] dark:border-white/10 whitespace-nowrap shadow-xs"
          >
            {smartMonthTitle}
          </span>

          <button
            type="button"
            onClick={handleNextWeek}
            title="Tuần sau"
            className="w-6 h-6 rounded-xl bg-[#F8FAFC] dark:bg-white/10 hover:bg-[#F1F5F9] dark:hover:bg-white/20 border border-[#E2E8F0] dark:border-white/10 text-[#475569] dark:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-xs"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Nút quay lại tuần hiện tại nếu đang ở tuần khác */}
          {!isCurrentWeek && (
            <button
              type="button"
              onClick={handleResetToday}
              title="Quay lại tuần này"
              className="ml-0.5 px-2 py-0.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/25 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-200 text-[9px] font-bold border border-indigo-200 dark:border-indigo-400/40 flex items-center gap-1 transition-all cursor-pointer shadow-xs"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span className="hidden sm:inline">Nay</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Hàng 7 ngày trong tuần */}
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center">
        {weekDays.map(item => {
          const isSelected = item.dateKey === selectedKey;
          const scheduleCount = scheduleDatesCount[item.dateKey] || 0;

          return (
            <button
              key={item.dateKey}
              type="button"
              onClick={() => {
                try { sound?.playClick?.(); } catch {}
                onSelectDate(item.date);
              }}
              title={`${item.fullDayLabel}, ngày ${item.dateNumber}/${String(item.monthNumber).padStart(2, '0')}${item.isToday ? ' (Hôm nay)' : ''}${scheduleCount > 0 ? ` • ${scheduleCount} lịch trình` : ''}`}
              className={`relative flex flex-col items-center justify-between py-1.5 sm:py-2 px-1 rounded-2xl transition-all duration-200 cursor-pointer select-none group/day min-h-[58px] ${
                isSelected
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25 ring-2 ring-indigo-400 font-bold scale-[1.03] z-10'
                  : item.isToday
                  ? 'bg-indigo-50 dark:bg-indigo-500/20 text-[#0F172A] dark:text-white ring-1.5 ring-indigo-300 dark:ring-indigo-400 border border-indigo-200 dark:border-indigo-400/40 hover:bg-indigo-100 dark:hover:bg-indigo-500/30 hover:scale-[1.02]'
                  : 'bg-[#F8FAFC] dark:bg-white/5 border border-[#E2E8F0] dark:border-white/10 text-[#1E293B] dark:text-white hover:bg-[#F1F5F9] dark:hover:bg-white/10 hover:scale-[1.02]'
              }`}
            >
              {/* Nhãn thứ (T2, T3, CN...) */}
              <span className={`text-[9px] uppercase tracking-wider font-extrabold ${
                isSelected
                  ? 'text-indigo-100'
                  : item.isToday
                  ? 'text-indigo-600 dark:text-indigo-300'
                  : 'text-[#475569] dark:text-slate-400'
              }`}>
                {item.dayLabel}
              </span>

              {/* Con số ngày + Chỉ số tháng phụ tinh tế nếu thuộc tháng kế tiếp */}
              <div className="flex flex-col items-center justify-center my-0.5">
                <span className={`text-xs font-black tracking-tight leading-tight ${
                  isSelected ? 'text-white' : 'text-[#0F172A] dark:text-white'
                }`}>
                  {item.dateNumber}
                </span>

                {/* Chỉ số tháng phụ (Secondary Month Indicator) */}
                {item.isNextMonth && (
                  <span className={`text-[7.5px] font-bold px-1 py-0.2 rounded-full uppercase leading-tight mt-0.5 tracking-tighter ${
                    isSelected
                      ? 'bg-white/25 text-white border border-white/30'
                      : 'bg-indigo-100 dark:bg-indigo-500/30 text-indigo-700 dark:text-cyan-200 border border-indigo-200 dark:border-indigo-400/40'
                  }`}>
                    Th.{item.monthNumber}
                  </span>
                )}
              </div>

              {/* Chấm tròn trạng thái */}
              <div className="flex items-center justify-center gap-0.5 h-2">
                {isSelected ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-white shadow-xs animate-pulse" />
                ) : item.isToday ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                ) : scheduleCount > 0 ? (
                  <span className="w-1 h-1 rounded-full bg-cyan-500 group-hover/day:scale-125 transition-transform" />
                ) : (
                  <span className="w-1 h-1 rounded-full bg-transparent" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* 3. Dòng thông tin phụ: Đang chọn ngày nào & Trạng thái lịch trình */}
      <div className="mt-2.5 pt-2 border-t border-[#E2E8F0] dark:border-white/10 flex items-center justify-between text-[10px] text-[#475569] dark:text-slate-400">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
          <span className="truncate">
            <strong className="text-[#0F172A] dark:text-white font-semibold">
              {currentSelectedDayInfo.fullDayLabel}, {currentSelectedDayInfo.dateNumber}/{String(currentSelectedDayInfo.monthNumber).padStart(2, '0')}
            </strong>
            {currentSelectedDayInfo.isToday && (
              <span className="ml-1 text-[9px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-400/30 px-1.5 py-0.2 rounded-md">
                Hôm nay
              </span>
            )}
          </span>
        </div>

        <span className="text-[9px] font-mono text-indigo-600 dark:text-indigo-300 font-medium shrink-0">
          {scheduleDatesCount[selectedKey] 
            ? `${scheduleDatesCount[selectedKey]} lịch hẹn` 
            : 'Lịch trình khả dụng'}
        </span>
      </div>

    </div>
  );
};

export default WeeklyCalendar;
