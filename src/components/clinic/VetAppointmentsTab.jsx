import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  Clock, 
  Search, 
  Filter, 
  CheckCircle2, 
  PlayCircle, 
  XCircle, 
  AlertTriangle, 
  Flame, 
  User, 
  Phone, 
  Stethoscope, 
  Check, 
  X, 
  ChevronRight,
  RotateCcw,
  RefreshCw,
  Info,
  Archive,
  Loader2
} from 'lucide-react';
import { sound } from '../../services/soundService';
import { getTodayVnDate, getVnDateString, addDaysLocal, isPastVnDateTime } from '../../utils/dateUtils.js';
import { resolveOwnerInfo } from '../../utils/ownerUtils';

export const VetAppointmentsTab = ({
  appointments = [],
  pets = [],
  isLoading = false,
  loadError = null,
  onRetryLoad = () => {},
  onConfirmAppointment = async () => {},
  onStartExam = async () => {},
  onCancelAppointment = async () => {},
  onArchiveAppointment = async () => {},
  onUnarchiveAppointment = async () => {},
  onSelectAppointmentForExam = () => {},
  onViewMedicalRecord,
  confirmingAppId = null,
  startingAppId = null,
  cancellingAppId = null,
  actionErrorMap = {},
  onRetryConfirm,
  onOpenLateAdmission,
  onOpenNoShow,
  onOpenReschedule,
  currentUser
}) => {
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'archived'
  const [dateFilter, setDateFilter] = useState('all'); // Mặc định 'all' để hiển thị đầy đủ mọi ca khám được phân công
  const [customDate, setCustomDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal Hủy ca
  const [cancelModalItem, setCancelModalItem] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  // Modal Lưu trữ (Xóa khỏi danh sách) & Khôi phục
  const [archiveModalItem, setArchiveModalItem] = useState(null);
  const [isSubmittingArchive, setIsSubmittingArchive] = useState(false);
  const [archiveError, setArchiveError] = useState('');
  const [isUnarchivingId, setIsUnarchivingId] = useState(null);
  const [vetNotice, setVetNotice] = useState(null);

  // Modal Chi tiết ca khám
  const [detailModalItem, setDetailModalItem] = useState(null);

  const todayYMD = getTodayVnDate();
  const tomorrowYMD = addDaysLocal(todayYMD, 1);

  // Helper kiểm tra ca khám đã bị bác sĩ lưu trữ chưa
  const isArchivedForVet = (appt) => {
    const vetIdStr = String(currentUser?.id || '').trim();
    return Boolean(
      vetIdStr &&
      Array.isArray(appt?.archivedByUserIds) &&
      appt.archivedByUserIds.includes(vetIdStr)
    );
  };

  // Danh mục các trạng thái hợp lệ chuẩn hóa của ca khám
  const VALID_STATUSES = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];
  const isValidStatus = (status) => typeof status === 'string' && VALID_STATUSES.includes(status.trim().toLowerCase());

  // Thống kê TOÀN BỘ mọi ngày để luôn đối chiếu chính xác tổng số ca
  const totalAllDays = appointments.length;
  const totalActiveAllDays = useMemo(() => appointments.filter(a => !isArchivedForVet(a)), [appointments, currentUser?.id]);
  const totalPendingAllDays = useMemo(() => totalActiveAllDays.filter(a => a.status === 'pending').length, [totalActiveAllDays]);
  const totalConfirmedAllDays = useMemo(() => totalActiveAllDays.filter(a => a.status === 'confirmed').length, [totalActiveAllDays]);
  const totalInProgressAllDays = useMemo(() => totalActiveAllDays.filter(a => a.status === 'in_progress').length, [totalActiveAllDays]);
  const totalCompletedAllDays = useMemo(() => totalActiveAllDays.filter(a => a.status === 'completed').length, [totalActiveAllDays]);
  const totalCancelledAllDays = useMemo(() => totalActiveAllDays.filter(a => a.status === 'cancelled').length, [totalActiveAllDays]);
  const totalInvalidAllDays = useMemo(() => totalActiveAllDays.filter(a => !isValidStatus(a.status)).length, [totalActiveAllDays]);
  const totalArchivedAllDays = useMemo(() => appointments.filter(a => isArchivedForVet(a)).length, [appointments, currentUser?.id]);

  // Chuỗi tóm tắt động đối chiếu khớp 100% với tổng số ca mọi ngày
  const statusSummaryText = useMemo(() => {
    const parts = [];
    if (totalPendingAllDays > 0) parts.push(`${totalPendingAllDays} chờ xác nhận`);
    if (totalConfirmedAllDays > 0) parts.push(`${totalConfirmedAllDays} đã xác nhận`);
    if (totalInProgressAllDays > 0) parts.push(`${totalInProgressAllDays} đang khám`);
    if (totalCompletedAllDays > 0) parts.push(`${totalCompletedAllDays} đã hoàn tất`);
    if (totalCancelledAllDays > 0) parts.push(`${totalCancelledAllDays} đã hủy`);
    if (totalInvalidAllDays > 0) parts.push(`${totalInvalidAllDays} thiếu/sai trạng thái`);
    if (totalArchivedAllDays > 0) parts.push(`${totalArchivedAllDays} đã lưu trữ`);
    return parts.length > 0 ? parts.join(', ') : 'Chưa có ca khám';
  }, [totalPendingAllDays, totalConfirmedAllDays, totalInProgressAllDays, totalCompletedAllDays, totalCancelledAllDays, totalInvalidAllDays, totalArchivedAllDays]);

  // 1. Tập hợp các ca khám sau khi lọc theo Quyền bác sĩ (đã có trong appointments), Ngày và Từ khóa tìm kiếm
  const scopedAppointments = useMemo(() => {
    let list = [...appointments];

    // Lọc theo ngày
    if (dateFilter === 'today') {
      list = list.filter(a => (a.date ? getVnDateString(a.date) : '') === todayYMD);
    } else if (dateFilter === 'tomorrow') {
      list = list.filter(a => (a.date ? getVnDateString(a.date) : '') === tomorrowYMD);
    } else if (dateFilter === 'custom' && customDate) {
      list = list.filter(a => (a.date ? getVnDateString(a.date) : '') === customDate);
    }
    // Khi dateFilter === 'all': Tuyệt đối KHÔNG áp dụng ngày cụ thể ngầm

    // Lọc theo từ khóa tìm kiếm
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(a => {
        const petName = String(a.petName || '').toLowerCase();
        const ownerName = String(a.ownerName || '').toLowerCase();
        const phone = String(a.phone || '').toLowerCase();
        const id = String(a.id || '').toLowerCase();
        const service = String(a.service || '').toLowerCase();
        const note = String(a.note || '').toLowerCase();
        return petName.includes(q) || ownerName.includes(q) || phone.includes(q) || id.includes(q) || service.includes(q) || note.includes(q);
      });
    }

    return list;
  }, [appointments, dateFilter, customDate, searchQuery, todayYMD, tomorrowYMD]);

  // Tách biệt ca đang theo dõi và ca đã lưu trữ trong phạm vi ngày/từ khóa hiện tại
  const activeScopedAppointments = useMemo(() => {
    return scopedAppointments.filter(a => !isArchivedForVet(a));
  }, [scopedAppointments, currentUser?.id]);

  const archivedScopedAppointments = useMemo(() => {
    return scopedAppointments.filter(a => isArchivedForVet(a));
  }, [scopedAppointments, currentUser?.id]);

  // 2. Thống kê theo trạng thái ca của bác sĩ trong phạm vi lọc
  const countAll = activeScopedAppointments.length;
  const countPending = activeScopedAppointments.filter(a => a.status === 'pending').length;
  const countConfirmed = activeScopedAppointments.filter(a => a.status === 'confirmed').length;
  const countInProgress = activeScopedAppointments.filter(a => a.status === 'in_progress').length;
  const countCompleted = activeScopedAppointments.filter(a => a.status === 'completed').length;
  const countCancelled = activeScopedAppointments.filter(a => a.status === 'cancelled').length;
  const countInvalidStatus = activeScopedAppointments.filter(a => !isValidStatus(a.status)).length;
  const countArchived = archivedScopedAppointments.length;

  // 3. Lọc danh sách lịch khám theo trạng thái đã chọn (KHÔNG tự gán trạng thái hoặc ẩn lỗi)
  const filteredAppointments = useMemo(() => {
    let list = [];

    if (filterStatus === 'archived') {
      list = [...archivedScopedAppointments];
    } else if (filterStatus === 'all') {
      list = [...activeScopedAppointments];
    } else if (filterStatus === 'invalid') {
      list = activeScopedAppointments.filter(a => !isValidStatus(a.status));
    } else {
      list = activeScopedAppointments.filter(a => a.status === filterStatus);
    }

    // Sắp xếp: Ca cấp cứu lên trước, tiếp đến theo giờ hẹn
    list.sort((a, b) => {
      const aEmerg = Boolean(a.isEmergency || (a.service || '').includes('Cấp cứu'));
      const bEmerg = Boolean(b.isEmergency || (b.service || '').includes('Cấp cứu'));
      if (aEmerg && !bEmerg) return -1;
      if (!aEmerg && bEmerg) return 1;

      // Thứ tự trạng thái: in_progress -> confirmed -> pending -> completed -> cancelled
      const statusWeight = { in_progress: 1, confirmed: 2, pending: 3, completed: 4, cancelled: 5 };
      const wA = statusWeight[a.status] || 9;
      const wB = statusWeight[b.status] || 9;
      if (wA !== wB) return wA - wB;

      // Sắp xếp ngày & giờ
      const dateDiff = String(b.date || '').localeCompare(String(a.date || ''));
      if (dateDiff !== 0) return dateDiff;
      return String(a.time || '').localeCompare(String(b.time || ''));
    });

    return list;
  }, [activeScopedAppointments, archivedScopedAppointments, filterStatus]);

  // Nhãn mô tả phạm vi ngày đang chọn để hiển thị rõ ràng trên header
  const scopeDateLabel = useMemo(() => {
    if (dateFilter === 'today') return `Hôm nay (${todayYMD})`;
    if (dateFilter === 'tomorrow') return `Ngày mai (${tomorrowYMD})`;
    if (dateFilter === 'custom' && customDate) return `Ngày ${customDate}`;
    return 'Tất cả ngày';
  }, [dateFilter, customDate, todayYMD, tomorrowYMD]);

  const statusLabelMap = {
    all: 'tất cả trạng thái',
    pending: 'chờ xác nhận',
    confirmed: 'đã xác nhận',
    in_progress: 'đang khám',
    completed: 'đã hoàn tất',
    cancelled: 'đã hủy',
    invalid: 'thiếu/sai trạng thái',
    archived: 'đã lưu trữ'
  };

  // Xử lý gửi hủy ca
  const handleConfirmCancel = async () => {
    if (!cancelModalItem) return;
    if (!cancelReason.trim()) {
      alert('Vui lòng nhập lý do hủy ca khám.');
      return;
    }
    setIsSubmittingCancel(true);
    try {
      await onCancelAppointment(cancelModalItem.id, cancelReason.trim());
      setCancelModalItem(null);
      setCancelReason('');
    } catch (err) {
      alert(err.message || 'Lỗi khi hủy ca khám.');
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  // Xử lý xác nhận xóa khỏi danh sách (Lưu trữ) cho bác sĩ
  const handleConfirmArchive = async () => {
    if (!archiveModalItem || isSubmittingArchive) return;
    setIsSubmittingArchive(true);
    setArchiveError('');
    try {
      await onArchiveAppointment(archiveModalItem.id);
      sound?.playSuccess?.();
      const targetId = archiveModalItem.id;
      setArchiveModalItem(null);
      setDetailModalItem(null);
      setVetNotice({
        type: 'archived',
        message: `Đã xóa ca khám #${targetId} khỏi danh sách theo dõi của bác sĩ (đã chuyển vào mục "Đã lưu trữ").`
      });
      setTimeout(() => setVetNotice(null), 5000);
      await onRetryLoad();
    } catch (err) {
      console.error('Lỗi khi lưu trữ ca khám:', err);
      setArchiveError(err.message || 'Lỗi khi xóa ca khám khỏi danh sách. Vui lòng thử lại.');
    } finally {
      setIsSubmittingArchive(false);
    }
  };

  // Xử lý khôi phục ca khám
  const handleUnarchive = async (appId) => {
    if (!appId || isUnarchivingId) return;
    setIsUnarchivingId(appId);
    try {
      await onUnarchiveAppointment(appId);
      sound?.playSuccess?.();
      setVetNotice({
        type: 'restored',
        message: `Đã khôi phục ca khám #${appId} về danh sách theo dõi của bác sĩ.`
      });
      setTimeout(() => setVetNotice(null), 5000);
      if (detailModalItem?.id === appId) {
        setDetailModalItem(null);
      }
      await onRetryLoad();
    } catch (err) {
      console.error('Lỗi khi khôi phục ca khám:', err);
      alert(err.message || 'Lỗi khi khôi phục ca khám. Vui lòng thử lại.');
    } finally {
      setIsUnarchivingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200">
      
      {/* 1. Header & Quick Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800/80">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2 flex-wrap">
            <span>Danh sách ca khám phân công</span>
            {loadError ? (
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                <span>{filteredAppointments.length} ca (Dữ liệu lần tải trước - Máy chủ chưa phản hồi)</span>
              </span>
            ) : (
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                {filterStatus === 'all'
                  ? `${filteredAppointments.length} ca (${scopeDateLabel})`
                  : `${filteredAppointments.length} / ${countAll} ca ${statusLabelMap[filterStatus]} (${scopeDateLabel})`}
              </span>
            )}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {loadError ? (
              <span className="text-amber-700 dark:text-amber-400 font-medium">
                Đang hiển thị bản lưu gần nhất do kết nối máy chủ thất bại (Tổng dữ liệu đã lưu: {totalAllDays} ca). Nhấn "Làm mới" để thử lại khi kết nối phục hồi.
              </span>
            ) : (
              <span>
                Chỉ hiển thị các ca khám được phân công trực tiếp cho tài khoản bác sĩ của bạn (Tổng toàn bộ ngày: {totalAllDays} ca — {statusSummaryText}).
              </span>
            )}
          </p>
        </div>

        {/* Nút Làm mới dữ liệu */}
        <button
          type="button"
          disabled={isLoading}
          onClick={() => {
            try { sound?.playClick?.(); } catch {}
            onRetryLoad(true);
          }}
          className={`px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer self-start sm:self-auto ${
            isLoading ? 'opacity-70 cursor-not-allowed' : ''
          }`}
          title="Tải lại danh sách ca khám từ hệ thống"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-600' : ''}`} />
          <span>{isLoading ? 'Đang tải...' : 'Làm mới'}</span>
        </button>
      </div>

      {/* 2. Thanh lọc ngày & tìm kiếm */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#12192A] border border-slate-200 dark:border-slate-800/80 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          
          {/* Date Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar p-1 bg-slate-100 dark:bg-slate-800/70 rounded-xl">
            {[
              { id: 'today', label: 'Hôm nay' },
              { id: 'tomorrow', label: 'Ngày mai' },
              { id: 'all', label: 'Tất cả ngày' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  sound.playClick();
                  setDateFilter(tab.id);
                  setCustomDate('');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  dateFilter === tab.id
                    ? 'bg-emerald-600 text-white shadow-2xs ring-2 ring-emerald-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60'
                }`}
              >
                {tab.label}
              </button>
            ))}

            {/* Custom Date Input */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all ${
              dateFilter === 'custom'
                ? 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-500 text-emerald-800 dark:text-emerald-200 font-bold shadow-2xs'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 bg-white/60 dark:bg-slate-800/40'
            }`}>
              <Calendar className={`w-3.5 h-3.5 ${dateFilter === 'custom' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
              <span className="text-[11px] font-semibold whitespace-nowrap hidden sm:inline">Ngày:</span>
              <input
                type="date"
                value={customDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomDate(val);
                  if (val) {
                    setDateFilter('custom');
                  } else {
                    setDateFilter('all');
                  }
                }}
                className="bg-transparent text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden cursor-pointer"
                title="Chọn ngày khám cụ thể"
              />
              {dateFilter === 'custom' && customDate && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomDate('');
                    setDateFilter('all');
                  }}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5 cursor-pointer ml-0.5"
                  title="Xóa ngày cụ thể để xem tất cả"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Search Box */}
          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên bé, chủ, SĐT, mã..."
              className="w-full bg-slate-50 dark:bg-[#151b2b] border border-slate-200 dark:border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-emerald-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2 border-t border-slate-100 dark:border-slate-800/60">
          {[
            { id: 'all', label: 'Tất cả trạng thái', count: countAll },
            { id: 'pending', label: 'Chờ xác nhận', count: countPending, highlight: countPending > 0 },
            { id: 'confirmed', label: 'Đã xác nhận', count: countConfirmed },
            { id: 'in_progress', label: 'Đang khám', count: countInProgress },
            { id: 'completed', label: 'Đã hoàn tất', count: countCompleted },
            { id: 'cancelled', label: 'Đã hủy', count: countCancelled },
            ...(countInvalidStatus > 0 ? [
              { id: 'invalid', label: 'Thiếu/Sai trạng thái', count: countInvalidStatus, highlight: true, isWarning: true }
            ] : []),
            { id: 'archived', label: 'Đã lưu trữ', count: countArchived, highlight: countArchived > 0 }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                sound.playClick();
                setFilterStatus(tab.id);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                filterStatus === tab.id
                  ? tab.isWarning
                    ? 'bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-400 dark:border-rose-700 font-bold'
                    : 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-bold'
                  : tab.isWarning
                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 animate-pulse'
                    : tab.highlight
                      ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                filterStatus === tab.id
                  ? tab.isWarning
                    ? 'bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-100 font-bold'
                    : 'bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 font-bold'
                  : tab.isWarning
                    ? 'bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 font-bold'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Cảnh báo tính toàn vẹn dữ liệu khi phát hiện bản ghi thiếu/sai trạng thái */}
        {countInvalidStatus > 0 && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                <strong>Kiểm tra tính toàn vẹn:</strong> Có {countInvalidStatus} ca khám thiếu hoặc mang trạng thái không hợp lệ. Hệ thống hiển thị minh bạch dữ liệu gốc, không tự ý gán trạng thái hoặc ẩn lỗi.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setFilterStatus('invalid')}
              className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] shrink-0 cursor-pointer"
            >
              Xem ca bất thường
            </button>
          </div>
        )}
      </div>

      {/* Thông báo thao tác lưu trữ / khôi phục phía Bác sĩ */}
      {vetNotice && (
        <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-xs text-indigo-900 dark:text-indigo-200 flex items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="font-medium">{vetNotice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setVetNotice(null)}
            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 p-1 cursor-pointer"
            title="Đóng thông báo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 3. Phân biệt rõ các trạng thái: Đang tải / Lỗi tải / Trống thực tế / Không tìm thấy */}
      
      {/* 3.1. Đang tải ban đầu (chỉ khóa màn hình nếu danh sách hoàn toàn chưa có ca khám nào) */}
      {isLoading && appointments.length === 0 && (
        <div className="py-20 text-center space-y-3 bg-white dark:bg-[#12192A] rounded-2xl border border-slate-200 dark:border-slate-800 p-8">
          <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            Đang tải danh sách lịch khám của bác sĩ...
          </p>
        </div>
      )}

      {/* 3.2. Lỗi tải toàn màn hình khi chưa có dữ liệu */}
      {loadError && appointments.length === 0 && (
        <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
          <h3 className="text-base font-bold text-rose-900 dark:text-rose-200">
            Không thể tải danh sách ca khám
          </h3>
          <p className="text-xs text-rose-600 dark:text-rose-400 max-w-md mx-auto">
            {loadError}
          </p>
          <button
            type="button"
            onClick={() => onRetryLoad(true)}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* 3.2b. Thông báo lỗi nhẹ trên đầu nếu đã có dữ liệu nhưng đồng bộ nền thất bại */}
      {loadError && appointments.length > 0 && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 flex items-center justify-between gap-3 text-xs text-rose-800 dark:text-rose-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>Không thể cập nhật danh sách mới nhất từ máy chủ ({loadError}). Đang hiển thị bản lưu gần nhất.</span>
          </div>
          <button
            type="button"
            onClick={() => onRetryLoad(true)}
            className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shrink-0 cursor-pointer"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* 3.3. Danh sách thực sự rỗng (Chưa có ca nào được phân công) */}
      {!isLoading && !loadError && appointments.length === 0 && (
        <div className="py-20 text-center bg-white dark:bg-[#12192A] rounded-2xl border border-slate-200 dark:border-slate-800 p-8 space-y-3">
          <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            Chưa có ca khám nào được phân công
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Hiện tại chưa có lịch khám nào được chỉ định cho bạn. Khi chủ nuôi đặt lịch chọn bạn hoặc Quản trị viên phân công ca khám, lịch sẽ xuất hiện ngay tại đây.
          </p>
        </div>
      )}

      {/* 3.4. Có ca khám nhưng không tìm thấy theo bộ lọc hiện tại */}
      {appointments.length > 0 && filteredAppointments.length === 0 && (
        <div className="py-16 text-center bg-white dark:bg-[#12192A] rounded-2xl border border-slate-200 dark:border-slate-800 p-8 space-y-3">
          <Filter className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            Không có ca khám nào khớp với bộ lọc
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Hãy thử chọn lại trạng thái, ngày hoặc xóa từ khóa tìm kiếm.
          </p>
          <button
            type="button"
            onClick={() => {
              setFilterStatus('all');
              setDateFilter('all');
              setCustomDate('');
              setSearchQuery('');
            }}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer"
          >
            Xóa bộ lọc
          </button>
        </div>
      )}

      {/* 4. Danh sách ca khám hợp lệ (Hiển thị ngay khi có dữ liệu) */}
      {filteredAppointments.length > 0 && (
        <div className="space-y-3">
          {filteredAppointments.map((app) => {
            const pet = pets.find(p => p.id === app.petId);
            const ownerInfo = resolveOwnerInfo(app, pet, appointments);
            const isOverdue = (app.status === 'pending' || app.status === 'confirmed') && isPastVnDateTime(app.date, app.time);
            const isEmergency = Boolean(app.isEmergency || (app.service || '').includes('Cấp cứu'));
            const isArchived = isArchivedForVet(app);

            return (
              <div
                key={app.id}
                className={`p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#12192A] border shadow-2xs transition-all ${
                  isEmergency 
                    ? 'border-rose-400 dark:border-rose-700/80 bg-rose-50/20 dark:bg-rose-950/20' 
                    : app.status === 'in_progress'
                      ? 'border-purple-300 dark:border-purple-700/70 ring-1 ring-purple-400/30'
                      : isArchived
                        ? 'border-slate-200/60 dark:border-slate-800/60 opacity-85 bg-slate-50/50 dark:bg-slate-900/30'
                        : 'border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  
                  {/* Left: Thông tin giờ & Thú cưng */}
                  <div className="flex items-start gap-4 min-w-0">
                    
                    {/* Time Slot Block */}
                    <div className="text-center px-3.5 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 shrink-0">
                      <span className="text-sm font-mono font-bold text-slate-900 dark:text-white block">
                        {app.time || '--:--'}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 block mt-0.5">
                        {app.date}
                      </span>
                    </div>

                    {/* Patient & Service details */}
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-slate-400 dark:text-slate-500">
                          {app.id}
                        </span>

                        <strong className="text-base font-bold text-slate-900 dark:text-white">
                          {app.petName || 'Thú cưng'}
                        </strong>

                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          ({app.petType || pet?.breed || 'Chưa cập nhật loài'})
                        </span>

                        {isEmergency && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-800 animate-pulse">
                            🚨 Cấp cứu
                          </span>
                        )}

                        {isOverdue && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                            Quá giờ hẹn
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-3 flex-wrap">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {app.service}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
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
                        <p className="text-xs text-slate-500 dark:text-slate-400 italic line-clamp-2 bg-slate-50 dark:bg-slate-800/40 p-2 rounded-xl border border-slate-100 dark:border-slate-800/60 mt-1">
                          "{app.note}"
                        </p>
                      )}

                      {/* Hiển thị lý do hủy nếu ca bị hủy */}
                      {app.status === 'cancelled' && (
                        <div className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-2 rounded-xl border border-rose-200 dark:border-rose-800/60 mt-1">
                          <strong>Lý do hủy:</strong> {app.cancelReason || 'Ca khám đã bị hủy'}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Trạng thái & Nút thao tác tương ứng */}
                  <div className="flex items-center gap-2.5 self-end lg:self-center shrink-0 flex-wrap">
                    
                    {/* Badge trạng thái */}
                    {isArchived ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700 flex items-center gap-1">
                        <Archive className="w-3.5 h-3.5 text-slate-400" />
                        Đã lưu trữ
                      </span>
                    ) : (
                      <>
                        {app.status === 'pending' && (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                            Chờ xác nhận
                          </span>
                        )}
                        {app.status === 'confirmed' && (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800">
                            Đã xác nhận
                          </span>
                        )}
                        {app.status === 'in_progress' && (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800 flex items-center gap-1.5">
                            <PlayCircle className="w-3.5 h-3.5 animate-spin" />
                            Đang khám
                          </span>
                        )}
                        {app.status === 'completed' && (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Đã hoàn tất
                          </span>
                        )}
                        {app.status === 'cancelled' && (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700 flex items-center gap-1.5">
                            <XCircle className="w-3.5 h-3.5 text-rose-500" />
                            Đã hủy
                          </span>
                        )}
                        {!VALID_STATUSES.includes(app.status) && (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 border border-amber-400 dark:border-amber-700 flex items-center gap-1.5" title="Trạng thái không hợp lệ hoặc thiếu dữ liệu. Hệ thống giữ nguyên trạng thái gốc và không tự gán trạng thái.">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span>{app.status ? `Trạng thái lạ: "${app.status}"` : 'Thiếu trạng thái'}</span>
                          </span>
                        )}
                      </>
                    )}

                    {/* Nút Xem chi tiết */}
                    <button
                      type="button"
                      onClick={() => setDetailModalItem(app)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Chi tiết
                    </button>

                    {/* THAO TÁC THEO TRẠNG THÁI */}
                    {isArchived ? (
                      <button
                        type="button"
                        disabled={isUnarchivingId === app.id}
                        onClick={() => handleUnarchive(app.id)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                        title="Khôi phục ca khám này vào danh sách theo dõi của bác sĩ"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${isUnarchivingId === app.id ? 'animate-spin' : ''}`} />
                        <span>Khôi phục</span>
                      </button>
                    ) : (
                      <>
                        {/* 1. Khi pending: Nút Xác nhận lịch & Nút Hủy ca */}
                        {app.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              disabled={confirmingAppId === app.id}
                              onClick={async () => {
                                await onConfirmAppointment(app.id);
                              }}
                              className={`px-3.5 py-1.5 rounded-xl text-white font-bold text-xs shadow-2xs transition-all flex items-center gap-1.5 ${
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

                            <button
                              type="button"
                              disabled={confirmingAppId === app.id}
                              onClick={() => {
                                setCancelModalItem(app);
                                setCancelReason('');
                              }}
                              className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                            >
                              Hủy ca
                            </button>
                          </>
                        )}

                        {/* 2. Khi confirmed: Nút Bắt đầu khám & Tùy chọn Không đến / Đổi lịch */}
                        {app.status === 'confirmed' && (
                          <>
                            <button
                              type="button"
                              disabled={startingAppId === app.id}
                              onClick={async () => {
                                if (isOverdue && onOpenLateAdmission) {
                                  onOpenLateAdmission(app);
                                } else {
                                  await onStartExam(app.id);
                                }
                              }}
                              className={`px-3.5 py-1.5 rounded-xl text-white font-bold text-xs shadow-2xs transition-all flex items-center gap-1.5 ${
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
                              className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-600 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                              title="Đánh dấu khách không đến (No-show)"
                            >
                              Không đến
                            </button>

                            <button
                              type="button"
                              onClick={() => onOpenReschedule ? onOpenReschedule(app) : null}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-600 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                              title="Đổi sang ngày hoặc khung giờ hẹn khác"
                            >
                              Đổi lịch
                            </button>
                          </>
                        )}

                        {/* 3. Khi in_progress: Nút Tiếp tục khám SOAP */}
                        {app.status === 'in_progress' && (
                          <button
                            type="button"
                            onClick={() => {
                              try { sound?.playClick?.(); } catch {}
                              onSelectAppointmentForExam(app.id);
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-2xs active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            <Stethoscope className="w-3.5 h-3.5" />
                            <span>Tiếp tục khám SOAP</span>
                          </button>
                        )}

                        {/* 4. Khi completed: Nút Xem bệnh án & Nút Xóa khỏi DS */}
                        {app.status === 'completed' && (
                          <>
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
                              className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                              <span>Xem bệnh án SOAP</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setArchiveModalItem(app);
                                setArchiveError('');
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-600 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                              title="Xóa ca khám này khỏi danh sách theo dõi của bác sĩ (Lưu trữ)"
                            >
                              <Archive className="w-3.5 h-3.5" />
                              <span>Xóa khỏi DS</span>
                            </button>
                          </>
                        )}

                        {/* 5. Khi cancelled: Nút Xóa khỏi DS */}
                        {app.status === 'cancelled' && (
                          <button
                            type="button"
                            onClick={() => {
                              setArchiveModalItem(app);
                              setArchiveError('');
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-600 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                            title="Xóa ca khám đã hủy này khỏi danh sách theo dõi của bác sĩ (Lưu trữ)"
                          >
                            <Archive className="w-3.5 h-3.5" />
                            <span>Xóa khỏi DS</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Banner thông báo lỗi thao tác kèm nút Thử lại inline */}
                {actionErrorMap?.[app.id] && (
                  <div className="mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between gap-3 animate-fadeIn">
                    <div className="flex items-center gap-2 min-w-0">
                      <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                      <span className="font-medium truncate">{actionErrorMap[app.id].message || 'Thao tác không thành công.'}</span>
                    </div>
                    {app.status === 'pending' && (
                      <button
                        type="button"
                        disabled={confirmingAppId === app.id}
                        onClick={() => onRetryConfirm ? onRetryConfirm(app.id) : onConfirmAppointment(app.id)}
                        className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shrink-0 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
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

      {/* ========================================================================= */}
      {/* MODAL: HỦY CA KHÁM KÈM LÝ DO RÕ RÀNG                                      */}
      {/* ========================================================================= */}
      {cancelModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#12192A] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>Xác nhận hủy ca khám</span>
              </div>
              <button 
                type="button"
                onClick={() => setCancelModalItem(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Hủy lịch hẹn của bé <strong>{cancelModalItem.petName}</strong> (chủ nuôi: {cancelModalItem.ownerName}) vào lúc {cancelModalItem.time} ngày {cancelModalItem.date}.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Lý do hủy ca khám <span className="text-rose-500">*</span>:
              </label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ví dụ: Bác sĩ có ca phẫu thuật đột xuất, chủ nuôi không thể đưa bé đến..."
                className="w-full bg-slate-50 dark:bg-[#151b2b] border border-slate-200 dark:border-slate-700/80 rounded-xl p-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCancelModalItem(null)}
                disabled={isSubmittingCancel}
                className="px-3.5 py-2 rounded-xl text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isSubmittingCancel}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
              >
                {isSubmittingCancel ? (
                  <span>Đang xử lý...</span>
                ) : (
                  <span>Xác nhận hủy</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: XEM CHI TIẾT CA KHÁM                                               */}
      {/* ========================================================================= */}
      {detailModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#12192A] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                <Info className="w-4 h-4" />
                <span>Chi tiết ca khám {detailModalItem.id}</span>
              </div>
              <button 
                type="button"
                onClick={() => setDetailModalItem(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <div>
                  <span className="text-[11px] text-slate-400 block">Thú cưng:</span>
                  <strong className="text-sm font-bold text-slate-900 dark:text-white">
                    {detailModalItem.petName}
                  </strong>
                  <span className="text-slate-500 block">{detailModalItem.petType}</span>
                </div>
                {(() => {
                  const modalPet = pets.find(p => p.id === detailModalItem.petId);
                  const detailOwner = resolveOwnerInfo(detailModalItem, modalPet, appointments);
                  return (
                    <div>
                      <span className="text-[11px] text-slate-400 block">Chủ nuôi hiện tại:</span>
                      <strong className="text-sm font-bold text-slate-900 dark:text-white block">
                        {detailOwner.currentOwnerName}
                      </strong>
                      {detailOwner.isHistoricalDifferent && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 block font-normal mt-0.5">
                          Liên hệ lúc đặt: {detailOwner.historicalName}
                        </span>
                      )}
                      {detailOwner.currentOwnerPhone && (
                        <a href={`tel:${detailOwner.currentOwnerPhone}`} className="text-indigo-600 dark:text-indigo-400 font-mono hover:underline block mt-0.5">
                          {detailOwner.currentOwnerPhone}
                        </a>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className="space-y-1">
                <span className="text-[11px] text-slate-400 block">Dịch vụ đăng ký:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {detailModalItem.service}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] text-slate-400 block">Thời gian hẹn:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {detailModalItem.time} • Ngày {detailModalItem.date}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] text-slate-400 block">Cơ sở tiếp nhận:</span>
                <span>{detailModalItem.facility || 'Bệnh viện Thú y'}</span>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] text-slate-400 block">Mô tả triệu chứng ban đầu:</span>
                <p className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 italic">
                  "{detailModalItem.note || 'Không có mô tả'}"
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] text-slate-400 block">Trạng thái ca:</span>
                <span className="font-bold text-slate-900 dark:text-white capitalize">
                  {detailModalItem.status}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 flex-wrap gap-2">
              <div>
                {isArchivedForVet(detailModalItem) ? (
                  <button
                    type="button"
                    disabled={isUnarchivingId === detailModalItem.id}
                    onClick={() => handleUnarchive(detailModalItem.id)}
                    className="px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${isUnarchivingId === detailModalItem.id ? 'animate-spin' : ''}`} />
                    <span>Khôi phục vào danh sách</span>
                  </button>
                ) : (detailModalItem.status === 'completed' || detailModalItem.status === 'cancelled') ? (
                  <button
                    type="button"
                    onClick={() => {
                      const item = detailModalItem;
                      setArchiveModalItem(item);
                      setArchiveError('');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 text-slate-600 hover:text-rose-600 dark:text-slate-300 dark:hover:text-rose-400 font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>Xóa khỏi danh sách</span>
                  </button>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => setDetailModalItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: XÁC NHẬN XÓA KHỎI DANH SÁCH (LƯU TRỮ) CA KHÁM CHO BÁC SĨ            */}
      {/* ========================================================================= */}
      {archiveModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#12192A] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold text-sm">
                <Archive className="w-4 h-4 text-indigo-500" />
                <span>Xóa ca khám khỏi danh sách theo dõi</span>
              </div>
              <button 
                type="button"
                onClick={() => {
                  if (!isSubmittingArchive) {
                    setArchiveModalItem(null);
                    setArchiveError('');
                  }
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {archiveError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold">Lỗi lưu trữ ca khám</div>
                  <div className="text-[11px] text-rose-600 dark:text-rose-400">{archiveError}</div>
                </div>
              </div>
            )}

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Bạn có chắc chắn muốn xóa ca khám <strong>#{archiveModalItem.id}</strong> của bé <strong>{archiveModalItem.petName}</strong> (chủ nuôi: {archiveModalItem.ownerName}) khỏi danh sách hiển thị của bạn?
            </p>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Dịch vụ:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{archiveModalItem.service}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Thời gian hẹn:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{archiveModalItem.time} • Ngày {archiveModalItem.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Trạng thái hiện tại:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{statusLabelMap[archiveModalItem.status] || archiveModalItem.status}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 text-[11px] text-blue-800 dark:text-blue-300 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>Giải thích phạm vi:</span>
              </div>
              <p>
                Thao tác này chỉ ẩn ca khám khỏi danh sách theo dõi của bác sĩ và chuyển vào mục <strong>"Đã lưu trữ"</strong>.
              </p>
              <p className="text-slate-500 dark:text-slate-400">
                • Hồ sơ bệnh án, đơn thuốc và lịch sử khám y tế vẫn được lưu giữ an toàn.
                <br />
                • Lịch hẹn phía người nuôi không bị ảnh hưởng.
                <br />
                • Bác sĩ có thể khôi phục lại bất kỳ lúc nào từ tab <em>"Đã lưu trữ"</em>.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setArchiveModalItem(null);
                  setArchiveError('');
                }}
                disabled={isSubmittingArchive}
                className="px-3.5 py-2 rounded-xl text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Giữ lại
              </button>
              <button
                type="button"
                onClick={handleConfirmArchive}
                disabled={isSubmittingArchive}
                className={`px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs shadow-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSubmittingArchive ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              >
                {isSubmittingArchive && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <span>{isSubmittingArchive ? 'Đang lưu trữ...' : 'Xác nhận xóa khỏi DS'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default VetAppointmentsTab;
