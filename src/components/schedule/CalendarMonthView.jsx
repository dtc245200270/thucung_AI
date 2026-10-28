import React, { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  MapPin, 
  Plus,
  PawPrint,
  UserCheck,
  CalendarDays,
  AlertCircle
} from 'lucide-react';
import { getTodayVnDate, getVnDateString } from '../../utils/dateUtils.js';

// Avatar an toàn: nếu thiếu ảnh hoặc ảnh lỗi -> dùng icon trung tính
function PetAvatarMini({ pet, size = 'sm' }) {
  const [hasError, setHasError] = useState(false);
  const sizeClass = size === 'sm' ? 'w-5 h-5' : 'w-7 h-7';
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

  if (!pet || !pet.avatar || hasError) {
    return (
      <div className={`${sizeClass} rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800/50`}>
        <PawPrint className={iconSize} />
      </div>
    );
  }

  return (
    <img
      src={pet.avatar}
      alt={pet.name || 'Thú cưng'}
      onError={() => setHasError(true)}
      className={`${sizeClass} rounded-full object-cover shrink-0 border border-slate-200 dark:border-white/10`}
    />
  );
}

export const CalendarMonthView = ({
  items = [],
  tabType = 'care', // 'appointments' | 'care'
  pets = [],
  onSelectItem = () => {},
  onToggleComplete = () => {},
  onOpenCreate = () => {}
}) => {
  const todayStr = getTodayVnDate();
  const [currentDate, setCurrentDate] = useState(() => {
    const [y, m, d] = todayStr.split('-').map(Number);
    return new Date(y, m - 1, d || 1);
  });

  const [selectedDayStr, setSelectedDayStr] = useState(todayStr);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const startDay = firstDayOfMonth.getDay();
  const totalDays = lastDayOfMonth.getDate();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    const [y, m, d] = todayStr.split('-').map(Number);
    setCurrentDate(new Date(y, m - 1, d || 1));
    setSelectedDayStr(todayStr);
  };

  const monthNames = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
  ];

  const safeItems = Array.isArray(items) ? items : [];
  const safePets = Array.isArray(pets) ? pets : [];

  // Gom lịch theo ngày YYYY-MM-DD
  const itemsByDate = safeItems.reduce((acc, item) => {
    if (!item || !item.date) return acc;
    const dateKey = getVnDateString(item.date);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(item);
    return acc;
  }, {});

  const selectedDayItems = itemsByDate[selectedDayStr] || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Cột lịch tháng (2 cột trên desktop) */}
      <div className="lg:col-span-2 bg-white dark:bg-[#0B0F19]/90 rounded-3xl p-4 sm:p-6 border border-slate-200/80 dark:border-white/[0.08] shadow-xs">
        
        {/* Điều hướng tháng */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2 sm:gap-3">
            <h3 className="text-base sm:text-xl font-black text-slate-900 dark:text-white">
              {monthNames[month]} {year}
            </h3>
            <button
              onClick={goToToday}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 px-3 py-1 rounded-xl transition-colors cursor-pointer border border-emerald-200/60 dark:border-emerald-800/40"
            >
              Hôm nay
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={prevMonth}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.08] text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              title="Tháng trước"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={nextMonth}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.08] text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              title="Tháng sau"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tiêu đề thứ trong tuần */}
        <div className="grid grid-cols-7 gap-1 text-center font-bold text-[11px] text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wider">
          <div className="text-rose-500 dark:text-rose-400">CN</div>
          <div>T2</div>
          <div>T3</div>
          <div>T4</div>
          <div>T5</div>
          <div>T6</div>
          <div>T7</div>
        </div>

        {/* Lưới các ngày trong tháng */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {/* Ô trống trước ngày đầu tháng */}
          {Array.from({ length: startDay }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[58px] sm:min-h-[72px] rounded-2xl bg-slate-50/50 dark:bg-white/[0.01] opacity-20" />
          ))}

          {/* Các ngày trong tháng */}
          {Array.from({ length: totalDays }).map((_, i) => {
            const dayNum = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const dayItems = itemsByDate[dateStr] || [];
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDayStr;

            return (
              <button
                type="button"
                key={dateStr}
                onClick={() => setSelectedDayStr(dateStr)}
                className={`min-h-[58px] sm:min-h-[72px] p-1.5 sm:p-2 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 ring-2 ring-emerald-400/40 shadow-xs'
                    : isToday
                    ? 'border-emerald-300 dark:border-emerald-700/60 bg-emerald-50/30 dark:bg-emerald-950/20'
                    : 'border-slate-100 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/[0.15] bg-slate-50/30 dark:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`text-xs font-bold ${
                    isToday 
                      ? 'w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]' 
                      : isSelected 
                      ? 'text-emerald-700 dark:text-emerald-300' 
                      : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    {dayNum}
                  </span>
                  {dayItems.length > 0 && (
                    <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 px-1 py-0.2 rounded-md bg-slate-100 dark:bg-white/[0.08]">
                      {dayItems.length}
                    </span>
                  )}
                </div>

                {/* Các sự kiện thu nhỏ */}
                <div className="space-y-0.5 overflow-hidden w-full mt-1">
                  {dayItems.slice(0, 2).map((item) => {
                    const isCancelled = item.status === 'cancelled';
                    const isCompleted = item.completed || item.status === 'completed';
                    
                    let bgClass = 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300';
                    if (isCancelled) {
                      bgClass = 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 line-through';
                    } else if (isCompleted) {
                      bgClass = 'bg-slate-100 text-slate-400 dark:bg-white/[0.04] dark:text-slate-500 line-through';
                    } else if (tabType === 'appointments') {
                      bgClass = 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300';
                    } else {
                      bgClass = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300';
                    }

                    const displayTitle = tabType === 'appointments' 
                      ? (item.service || 'Khám bệnh') 
                      : (item.title || item.task || 'Chăm sóc');

                    return (
                      <div
                        key={item.id}
                        className={`text-[9px] truncate px-1 py-0.5 rounded-md font-medium ${bgClass}`}
                        title={displayTitle}
                      >
                        {displayTitle}
                      </div>
                    );
                  })}
                  {dayItems.length > 2 && (
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold block truncate">
                      +{dayItems.length - 2} việc khác
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

      </div>

      {/* Cột Chi tiết ngày được chọn (1 cột trên desktop) */}
      <div className="bg-white dark:bg-[#0B0F19]/90 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-white/[0.08] shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-white/[0.08] mb-4">
            <div>
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Lịch trong ngày
              </span>
              <h4 className="text-base font-black text-slate-900 dark:text-white">
                {selectedDayStr === todayStr ? `Hôm nay (${selectedDayStr})` : selectedDayStr}
              </h4>
            </div>
            <button
              onClick={() => onOpenCreate(selectedDayStr)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-xl transition-colors cursor-pointer border border-emerald-200/60 dark:border-emerald-800/40"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{tabType === 'appointments' ? 'Đặt khám' : 'Thêm việc'}</span>
            </button>
          </div>

          {selectedDayItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500 space-y-2">
              <CalendarDays className="w-10 h-10 mx-auto opacity-30" />
              <p className="text-xs font-medium">
                {tabType === 'appointments' 
                  ? 'Không có lịch khám nào trong ngày này.' 
                  : 'Không có việc chăm sóc nào trong ngày này.'}
              </p>
              <button
                onClick={() => onOpenCreate(selectedDayStr)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline pt-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{tabType === 'appointments' ? 'Đặt lịch khám cho ngày này' : 'Thêm lịch chăm sóc cho ngày này'}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
              {selectedDayItems.map((item) => {
                if (!item) return null;
                const pet = safePets.find(p => p && p.id === item.petId);
                const petName = item.petName || pet?.name || 'Thú cưng';

                if (tabType === 'appointments') {
                  // Hiển thị thẻ lịch khám
                  const statusKey = String(item.status || 'pending').toLowerCase();
                  const isCancelled = statusKey === 'cancelled';
                  const isCompleted = statusKey === 'completed';

                  let statusBadge = (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                      Chờ xác nhận
                    </span>
                  );
                  if (statusKey === 'confirmed') {
                    statusBadge = (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
                        Đã xác nhận
                      </span>
                    );
                  } else if (statusKey === 'in_progress') {
                    statusBadge = (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50">
                        Đang khám
                      </span>
                    );
                  } else if (isCompleted) {
                    statusBadge = (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                        Hoàn thành
                      </span>
                    );
                  } else if (isCancelled) {
                    statusBadge = (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50">
                        Đã hủy
                      </span>
                    );
                  }

                  const doctorDisplay = item.assignedVet && item.assignedVet !== 'Cơ sở phân công'
                    ? item.assignedVet
                    : 'Chưa phân công (Cơ sở tiếp nhận phân công)';

                  return (
                    <div
                      key={item.id}
                      onClick={() => onSelectItem(item)}
                      className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#14182b] hover:border-emerald-500/50 transition-all cursor-pointer shadow-xs space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <PetAvatarMini pet={pet} />
                          <div>
                            <span className="text-xs font-black text-slate-900 dark:text-white block">
                              {petName}
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">
                              Mã: #{item.id}
                            </span>
                          </div>
                        </div>
                        {statusBadge}
                      </div>

                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {item.service || 'Khám tổng quát'}
                      </div>

                      <div className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>Giờ khám: <strong>{item.time || '08:30'}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5 truncate">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{item.facility || 'Cơ sở thú y'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">Bác sĩ: {doctorDisplay}</span>
                        </div>
                      </div>
                    </div>
                  );
                } else {
                  // Hiển thị thẻ lịch chăm sóc
                  const isDone = Boolean(item.completed);
                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isDone 
                          ? 'bg-slate-50/70 dark:bg-white/[0.02] border-slate-200/60 dark:border-white/[0.05] opacity-75' 
                          : 'bg-white dark:bg-[#14182b] border-slate-200/80 dark:border-white/[0.08] shadow-xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <button
                            type="button"
                            onClick={() => onToggleComplete(item.id)}
                            className="mt-0.5 text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer shrink-0"
                            title={isDone ? 'Đánh dấu chưa làm' : 'Đánh dấu hoàn thành'}
                          >
                            {isDone ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600 hover:border-emerald-500" />
                            )}
                          </button>
                          <div>
                            <div 
                              onClick={() => onSelectItem(item)}
                              className={`text-xs font-bold cursor-pointer hover:text-emerald-600 ${
                                isDone ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'
                              }`}
                            >
                              {item.title || item.task || 'Lịch chăm sóc'}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                              <PetAvatarMini pet={pet} size="sm" />
                              <span>{petName}</span>
                              {item.time && (
                                <>
                                  <span>•</span>
                                  <span>{item.time}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isDone 
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' 
                            : 'bg-slate-100 text-slate-600 dark:bg-white/[0.08] dark:text-slate-300'
                        }`}>
                          {isDone ? 'Đã xong' : 'Chưa làm'}
                        </span>
                      </div>
                    </div>
                  );
                }
              })}
            </div>
          )}
        </div>

        <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-white/[0.08] text-center">
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Bấm vào bất kỳ ngày nào trên lịch để lọc và xem chi tiết danh sách sự kiện của ngày đó.
          </p>
        </div>
      </div>

    </div>
  );
};

export default CalendarMonthView;
