import React, { useState, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  PawPrint, 
  CheckCircle2, 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  Stethoscope
} from 'lucide-react';

const STANDARD_TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
];

export const VetScheduleTab = ({
  appointments = [],
  currentUser,
  onOpenSoap
}) => {
  const getTodayString = () => new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(getTodayString);

  // Lọc lịch khám được phân công cho bác sĩ này (hoặc tất cả nếu là admin)
  const doctorAppointments = useMemo(() => {
    return appointments.filter(a => {
      if (a.status === 'cancelled') return false; // Không tính ca đã hủy vào lịch làm việc hoạt động
      if (currentUser?.role === 'system_admin') return true;
      return a.assignedVetId === currentUser?.id || a.vetId === currentUser?.id;
    });
  }, [appointments, currentUser]);

  // Lịch khám trong ngày đang chọn
  const dayAppointments = useMemo(() => {
    return doctorAppointments.filter(a => a.date === selectedDate);
  }, [doctorAppointments, selectedDate]);

  // Phân bổ ca khám theo từng khung giờ
  const slotMap = useMemo(() => {
    const map = {};
    dayAppointments.forEach(app => {
      const time = (app.time || app.timeSlot || '').trim();
      if (!map[time]) map[time] = [];
      map[time].push(app);
    });
    return map;
  }, [dayAppointments]);

  // Điều hướng ngày
  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const isToday = selectedDate === getTodayString();

  return (
    <div className="h-full flex flex-col p-4 md:p-6 overflow-hidden">
      {/* HEADER & THANH CHỌN NGÀY */}
      <div className="flex-shrink-0 bg-white dark:bg-[#151622] rounded-2xl border border-slate-200 dark:border-slate-800 p-4 mb-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Lịch làm việc bác sĩ
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Liên thông trực tiếp với các khung giờ người nuôi đặt trên hệ thống
              </p>
            </div>
          </div>

          {/* Bộ điều khiển ngày */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <button
              onClick={handlePrevDay}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              />
              {!isToday && (
                <button
                  onClick={() => setSelectedDate(getTodayString())}
                  className="px-2.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 text-xs font-bold hover:bg-indigo-100 transition-colors cursor-pointer"
                >
                  Hôm nay
                </button>
              )}
            </div>

            <button
              onClick={handleNextDay}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Thống kê nhanh trong ngày */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Tổng ca trong ngày</span>
            <span className="text-base font-black text-slate-900 dark:text-white">{dayAppointments.length}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60">
            <span className="text-[11px] text-amber-600 dark:text-amber-400 block">Chờ xác nhận</span>
            <span className="text-base font-black text-amber-700 dark:text-amber-300">
              {dayAppointments.filter(a => a.status === 'pending').length}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60">
            <span className="text-[11px] text-indigo-600 dark:text-indigo-400 block">Đang khám</span>
            <span className="text-base font-black text-indigo-700 dark:text-indigo-300">
              {dayAppointments.filter(a => a.status === 'in_progress').length}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60">
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block">Đã hoàn tất</span>
            <span className="text-base font-black text-emerald-700 dark:text-emerald-300">
              {dayAppointments.filter(a => a.status === 'completed').length}
            </span>
          </div>
        </div>
      </div>

      {/* DANH SÁCH KHUNG GIỜ LÀM VIỆC (SLOTS) */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-[#151622] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-3">
        {STANDARD_TIME_SLOTS.map(slot => {
          const slotAppointments = slotMap[slot] || [];
          const hasAppointments = slotAppointments.length > 0;

          return (
            <div
              key={slot}
              className={`p-3.5 rounded-xl border transition-all ${
                hasAppointments
                  ? 'bg-slate-50/80 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700'
                  : 'bg-white dark:bg-[#151622] border-dashed border-slate-200 dark:border-slate-800/80 opacity-75'
              }`}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                {/* Cột thời gian */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono text-xs font-bold text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {slot}
                  </div>
                  {!hasAppointments && (
                    <span className="text-xs text-slate-400 italic">
                      Khung giờ trống - Sẵn sàng nhận lịch
                    </span>
                  )}
                </div>

                {/* Danh sách các ca khám trong khung giờ */}
                {hasAppointments && (
                  <div className="flex-1 sm:pl-4 space-y-2 w-full">
                    {slotAppointments.map(app => (
                      <div
                        key={app.id}
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <PawPrint className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900 dark:text-white">
                                {app.petName || 'Thú cưng'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">({app.id})</span>
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                app.status === 'completed' ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400' :
                                app.status === 'in_progress' ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400' :
                                app.status === 'confirmed' ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400' :
                                'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                              }`}>
                                {app.status === 'completed' ? 'Đã hoàn tất' :
                                 app.status === 'in_progress' ? 'Đang khám' :
                                 app.status === 'confirmed' ? 'Đã xác nhận' : 'Chờ xác nhận'}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                              <span>Dịch vụ: <strong>{app.service || 'Khám tổng quát'}</strong></span>
                              <span>•</span>
                              <span>Chủ nuôi: <strong>{app.ownerName || 'Chưa cập nhật'}</strong> ({app.phone || 'Không có SĐT'})</span>
                            </div>
                          </div>
                        </div>

                        {/* Nút thao tác nhanh */}
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                          <button
                            onClick={() => onOpenSoap && onOpenSoap(app.id, app.petId)}
                            className="px-3 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Stethoscope className="w-3 h-3" />
                            Mở SOAP
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VetScheduleTab;
