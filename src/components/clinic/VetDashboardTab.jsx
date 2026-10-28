import React from 'react';
import { 
  CalendarDays, 
  Clock, 
  CheckCircle2, 
  PlayCircle, 
  AlertTriangle, 
  Flame, 
  User, 
  Phone, 
  Stethoscope, 
  PawPrint,
  ArrowRight,
  Check,
  Loader2,
  RotateCcw
} from 'lucide-react';
import { sound } from '../../services/soundService';
import { getTodayVnDate, getVnDateString, isPastVnDateTime } from '../../utils/dateUtils.js';
import { resolveOwnerInfo } from '../../utils/ownerUtils';

export const VetDashboardTab = ({
  appointments = [],
  pets = [],
  onNavigateTab = () => {},
  onSelectAppointmentForExam = () => {},
  onConfirmAppointment = () => {},
  onStartExam,
  onViewMedicalRecord,
  confirmingAppId = null,
  startingAppId = null,
  actionErrorMap = {},
  onRetryConfirm,
  onOpenLateAdmission,
  onOpenNoShow,
  onOpenReschedule
}) => {
  const todayYMD = getTodayVnDate();

  // Ca khám hôm nay
  const todayAppointments = appointments.filter(a => {
    const appDate = a.date ? getVnDateString(a.date) : '';
    return appDate === todayYMD;
  });

  // Danh mục trạng thái hợp lệ
  const VALID_STATUSES = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];
  const isValidStatus = (status) => typeof status === 'string' && VALID_STATUSES.includes(status.trim().toLowerCase());

  const pendingToday = todayAppointments.filter(a => a.status === 'pending');
  const confirmedToday = todayAppointments.filter(a => a.status === 'confirmed');
  const inProgressToday = todayAppointments.filter(a => a.status === 'in_progress');
  const completedToday = todayAppointments.filter(a => a.status === 'completed');
  const cancelledToday = todayAppointments.filter(a => a.status === 'cancelled');
  const invalidToday = todayAppointments.filter(a => !isValidStatus(a.status));
  const emergencyToday = todayAppointments.filter(a => Boolean(a.isEmergency || (a.service || '').includes('Cấp cứu')));

  // Hàng đợi tiếp theo: Sắp xếp theo giờ hẹn
  const sortedQueue = [...todayAppointments].sort((a, b) => {
    // Cấp cứu ưu tiên trước
    if (a.isEmergency && !b.isEmergency) return -1;
    if (!a.isEmergency && b.isEmergency) return 1;
    // Thứ tự trạng thái: in_progress -> pending -> confirmed -> completed
    const weight = { in_progress: 1, confirmed: 2, pending: 3, completed: 4, cancelled: 5 };
    const wA = weight[a.status] || 9;
    const wB = weight[b.status] || 9;
    if (wA !== wB) return wA - wB;
    return String(a.time || '').localeCompare(String(b.time || ''));
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200">
      
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800/80">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>Tổng quan ngày hôm nay</span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              {todayYMD}
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Theo dõi hàng đợi tiếp nhận, ca khám đang diễn ra và hồ sơ bệnh nhân được phân công.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              try { sound?.playClick?.(); } catch {}
              onNavigateTab('appointments');
            }}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm shadow-emerald-600/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <CalendarDays className="w-4 h-4" />
            <span>Xem toàn bộ lịch hẹn</span>
          </button>
        </div>
      </div>

      {/* Cảnh báo toàn vẹn nếu có ca khám hôm nay thiếu hoặc sai trạng thái */}
      {invalidToday.length > 0 && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>Kiểm tra toàn vẹn:</strong> Phát hiện {invalidToday.length} ca khám hôm nay có trạng thái không hợp lệ. Hệ thống giữ nguyên trạng thái gốc và không tự gán trạng thái giả để làm khớp bộ đếm.
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('appointments')}
            className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] shrink-0 cursor-pointer"
          >
            Kiểm tra ca khám
          </button>
        </div>
      )}

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Tổng ca hôm nay */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#12192A] border border-slate-200 dark:border-slate-800/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Hôm nay</span>
            <CalendarDays className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {todayAppointments.length}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">lịch hẹn</span>
          </div>
        </div>

        {/* Chờ xác nhận */}
        <div className={`p-4 rounded-2xl bg-white dark:bg-[#12192A] border shadow-2xs transition-all ${
          pendingToday.length > 0 
            ? 'border-amber-300 dark:border-amber-700/60 bg-amber-50/30 dark:bg-amber-950/20' 
            : 'border-slate-200 dark:border-slate-800/80'
        }`}>
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
            <span className="text-xs font-bold uppercase tracking-wider">Chờ xác nhận</span>
            {pendingToday.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            )}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">
              {pendingToday.length}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">cần duyệt</span>
          </div>
        </div>

        {/* Đang khám */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#12192A] border border-purple-200 dark:border-purple-800/60 shadow-2xs">
          <div className="flex items-center justify-between text-purple-600 dark:text-purple-400">
            <span className="text-xs font-bold uppercase tracking-wider">Đang khám</span>
            <PlayCircle className="w-4 h-4 text-purple-600 dark:text-purple-400 animate-spin" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-purple-600 dark:text-purple-400">
              {inProgressToday.length}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">trong phòng</span>
          </div>
        </div>

        {/* Đã hoàn tất */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#12192A] border border-emerald-200 dark:border-emerald-800/60 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
            <span className="text-xs font-bold uppercase tracking-wider">Đã hoàn tất</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
              {completedToday.length}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">đã ký chốt</span>
          </div>
        </div>
      </div>

      {/* Ca cấp cứu khẩn cấp nếu có */}
      {emergencyToday.length > 0 && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800/60 flex items-center justify-between gap-3 text-rose-800 dark:text-rose-200">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 animate-pulse">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <strong className="text-xs sm:text-sm font-bold block">
                Phát hiện {emergencyToday.length} ca cấp cứu ưu tiên hôm nay
              </strong>
              <p className="text-[11px] text-rose-600 dark:text-rose-300">
                Ưu tiên tiếp nhận và xử lý triệu chứng khẩn cấp trước các ca khám định kỳ.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              try { sound?.playClick?.(); } catch {}
              onNavigateTab('appointments');
            }}
            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shrink-0 cursor-pointer"
          >
            Xem ngay
          </button>
        </div>
      )}

      {/* 3. Hàng đợi tiếp nhận hôm nay (Next Up Queue) */}
      <div className="rounded-2xl bg-white dark:bg-[#12192A] border border-slate-200 dark:border-slate-800/80 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Hàng đợi tiếp nhận hôm nay ({sortedQueue.length})
            </h3>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Sắp xếp theo thứ tự ưu tiên & khung giờ
          </span>
        </div>

        {sortedQueue.length === 0 ? (
          <div className="py-16 text-center text-slate-400 dark:text-slate-500 p-4">
            <CalendarDays className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <p className="font-bold text-sm text-slate-700 dark:text-slate-300">
              Hôm nay chưa có ca khám nào được phân công
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Các ca khám do chủ nuôi đặt hoặc do Quản trị viên phân công sẽ xuất hiện tại đây.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {sortedQueue.map((app) => {
              const isOverdue = (app.status === 'pending' || app.status === 'confirmed') && isPastVnDateTime(app.date, app.time);
              const pet = pets.find(p => p.id === app.petId);
              const ownerInfo = resolveOwnerInfo(app, pet, appointments);

              return (
                <div 
                  key={app.id} 
                  className="p-4 sm:p-5 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors space-y-2.5"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left: Time & Pet Info */}
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="text-center px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
                      <span className="text-xs font-mono font-bold text-slate-900 dark:text-white block">
                        {app.time || '--:--'}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">
                        {app.date}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {app.petName || 'Thú cưng'}
                        </strong>
                        <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          ({app.petType || pet?.breed || 'Chưa cập nhật loài'})
                        </span>

                        {app.isEmergency && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-800">
                            🚨 Cấp cứu
                          </span>
                        )}

                        {isOverdue && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                            Quá giờ hẹn
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-300 mt-1 flex items-center gap-3 flex-wrap">
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          {app.service}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="font-medium text-slate-800 dark:text-slate-200">{ownerInfo.currentOwnerName}</span>
                          {ownerInfo.isHistoricalDifferent && (
                            <span 
                              className="text-[10px] text-amber-700 dark:text-amber-400 ml-1 font-normal bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800"
                              title="Thông tin liên hệ ghi nhận tại thời điểm đặt lịch"
                            >
                              Liên hệ đặt lịch: {ownerInfo.historicalName}
                            </span>
                          )}
                        </span>
                        {ownerInfo.currentOwnerPhone && (
                          <a 
                            href={`tel:${ownerInfo.currentOwnerPhone}`} 
                            className="font-mono text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                          >
                            <Phone className="w-3 h-3" />
                            {ownerInfo.currentOwnerPhone}
                          </a>
                        )}
                      </div>

                      {app.note && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic line-clamp-1">
                          "{app.note}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Status badge & Action buttons */}
                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    {/* Status badge */}
                    {app.status === 'pending' && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                        Chờ xác nhận
                      </span>
                    )}
                    {app.status === 'confirmed' && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800">
                        Đã xác nhận
                      </span>
                    )}
                    {app.status === 'in_progress' && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800 flex items-center gap-1">
                        <PlayCircle className="w-3 h-3 animate-spin" />
                        Đang khám
                      </span>
                    )}
                    {app.status === 'completed' && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Đã hoàn tất
                      </span>
                    )}

                    {/* Quick action button */}
                    {app.status === 'pending' && (
                      <button
                        type="button"
                        disabled={confirmingAppId === app.id}
                        onClick={() => onConfirmAppointment(app.id)}
                        className={`px-3 py-1.5 rounded-xl text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 ${
                          confirmingAppId === app.id
                            ? 'bg-emerald-400 cursor-not-allowed opacity-80'
                            : 'bg-emerald-600 hover:bg-emerald-500 active:scale-95 cursor-pointer'
                        }`}
                      >
                        {confirmingAppId === app.id ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Đang xác nhận...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Xác nhận</span>
                          </>
                        )}
                      </button>
                    )}

                    {app.status === 'confirmed' && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={startingAppId === app.id}
                          onClick={() => {
                            if (isOverdue && onOpenLateAdmission) {
                              onOpenLateAdmission(app);
                            } else if (onStartExam) {
                              onStartExam(app);
                            } else {
                              onSelectAppointmentForExam(app.id);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 ${
                            startingAppId === app.id
                              ? 'bg-purple-400 cursor-not-allowed opacity-80'
                              : 'bg-purple-600 hover:bg-purple-500 active:scale-95 cursor-pointer'
                          }`}
                        >
                          {startingAppId === app.id ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Đang vào khám...</span>
                            </>
                          ) : (
                            <>
                              <PlayCircle className="w-3.5 h-3.5" />
                              <span>{isOverdue ? 'Bắt đầu khám (Tiếp nhận muộn)' : 'Bắt đầu khám'}</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenNoShow ? onOpenNoShow(app) : null}
                          className="px-2 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-600 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                          title="Đánh dấu khách không đến (No-show)"
                        >
                          Không đến
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenReschedule ? onOpenReschedule(app) : null}
                          className="px-2 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-600 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                          title="Đổi sang ngày hoặc khung giờ hẹn khác"
                        >
                          Đổi lịch
                        </button>
                      </div>
                    )}

                    {app.status === 'in_progress' && (
                      <button
                        type="button"
                        onClick={() => onSelectAppointmentForExam(app.id)}
                        className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Stethoscope className="w-3.5 h-3.5" />
                        <span>Tiếp tục khám</span>
                      </button>
                    )}

                    {app.status === 'completed' && (
                      <button
                        type="button"
                        data-btn={`view-record-${app.id}`}
                        onClick={() => {
                          try { sound?.playClick?.(); } catch {}
                          if (onViewMedicalRecord) {
                            onViewMedicalRecord(app);
                          } else {
                            onSelectAppointmentForExam(app.id);
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <span>Xem bệnh án</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Banner thông báo lỗi thao tác kèm nút Thử lại inline */}
                {actionErrorMap?.[app.id] && (
                  <div className="mt-2.5 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between gap-3 animate-fadeIn">
                    <div className="flex items-center gap-2 min-w-0">
                      <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                      <span className="font-medium truncate">{actionErrorMap[app.id].message || 'Thao tác không thành công.'}</span>
                    </div>
                    {app.status === 'pending' && (
                      <button
                        type="button"
                        disabled={confirmingAppId === app.id}
                        onClick={() => onRetryConfirm ? onRetryConfirm(app.id) : onConfirmAppointment(app.id)}
                        className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shrink-0 transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
                      >
                        <RotateCcw className={`w-3 h-3 ${confirmingAppId === app.id ? 'animate-spin' : ''}`} />
                        <span>Thử lại</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};

export default VetDashboardTab;
