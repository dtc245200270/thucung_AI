import React, { useState, useMemo } from 'react';
import { 
  CalendarDays, 
  Calendar, 
  LayoutList, 
  Plus, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  Edit3, 
  Repeat, 
  Filter, 
  PawPrint, 
  AlertTriangle, 
  ChevronRight, 
  Download, 
  Stethoscope, 
  UserCheck, 
  Phone, 
  User, 
  FileText, 
  X, 
  Trash2, 
  AlertCircle, 
  Info,
  CalendarCheck,
  RotateCcw,
  Archive
} from 'lucide-react';
import { CalendarMonthView } from './CalendarMonthView';
import { sound } from '../../services/soundService';
import { generateIcsCalendar } from '../../utils/dateUtils.js';
import { getTodayVnDate, getCurrentVnTime, getVnDateString } from '../../utils/dateUtils.js';
import { PageContainer, PageHeader, Tabs, FilterBar, EmptyState, Modal } from '../common/ui';
import { SCHEDULE_TYPES } from '../../constants/mockData';
import { ScheduleBadge } from '../common/Badges';
import { archiveAppointment, unarchiveAppointment } from '../../services/storageService';

// ============================================================================
// COMPONENT AVATAR THÚ CƯNG AN TOÀN (CHỐNG LỖI ẢNH, DÙNG ICON TRUNG TÍNH)
// ============================================================================
export const SafePetAvatar = ({ pet, size = 'md', className = '' }) => {
  const [hasError, setHasError] = useState(false);
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-11 h-11'
  }[size] || 'w-8 h-8';

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  }[size] || 'w-4 h-4';

  if (!pet || !pet.avatar || hasError) {
    return (
      <div 
        className={`${sizeClasses} rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-200/80 dark:border-emerald-800/50 ${className}`}
        title={pet?.name || 'Thú cưng'}
      >
        <PawPrint className={iconSizes} />
      </div>
    );
  }

  return (
    <img
      src={pet.avatar}
      alt={pet.name || 'Thú cưng'}
      onError={() => setHasError(true)}
      className={`${sizeClasses} rounded-full object-cover shrink-0 border border-slate-200 dark:border-white/10 ${className}`}
    />
  );
};

// ============================================================================
// HELPER CHUẨN HÓA TRẠNG THÁI NGHIỆP VỤ & NHÃN THỜI GIAN LỊCH KHÁM
// ============================================================================
export const getAppointmentStatusInfo = (rawStatus) => {
  const s = String(rawStatus || '').toLowerCase().trim();
  if (s === 'pending' || s === 'chờ duyệt' || s === 'chờ xác nhận') {
    return {
      key: 'pending',
      label: 'Chờ xác nhận',
      badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800/50'
    };
  }
  if (s === 'confirmed' || s === 'đã duyệt' || s === 'đã xác nhận') {
    return {
      key: 'confirmed',
      label: 'Đã xác nhận',
      badgeClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800/50'
    };
  }
  if (s === 'in_progress' || s === 'đang khám') {
    return {
      key: 'in_progress',
      label: 'Đang khám',
      badgeClass: 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200 dark:border-purple-800/50'
    };
  }
  if (s === 'completed' || s === 'hoàn thành') {
    return {
      key: 'completed',
      label: 'Hoàn thành',
      badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50'
    };
  }
  if (s === 'cancelled' || s === 'đã hủy') {
    return {
      key: 'cancelled',
      label: 'Đã hủy',
      badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800/50'
    };
  }
  return {
    key: 'pending',
    label: 'Chờ xác nhận',
    badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800/50'
  };
};

export const getAppointmentTemporalTag = (dateStr, timeStr) => {
  if (!dateStr) return { key: 'upcoming', label: 'Sắp tới', className: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40' };
  const todayVn = getTodayVnDate();
  const currentVnTime = getCurrentVnTime();
  const cleanDate = getVnDateString(dateStr);

  if (cleanDate < todayVn) {
    return { key: 'past', label: 'Đã qua giờ hẹn', className: 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/[0.06]' };
  }
  if (cleanDate === todayVn) {
    if (timeStr && timeStr < currentVnTime) {
      return { key: 'past', label: 'Đã qua giờ hẹn', className: 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/[0.06]' };
    }
    return { key: 'today', label: 'Hôm nay', className: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 font-bold' };
  }
  return { key: 'upcoming', label: 'Sắp tới', className: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40' };
};

export const getCareTemporalTag = (dateStr) => {
  if (!dateStr) return { key: 'upcoming', label: 'Sắp tới', className: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40' };
  const todayVn = getTodayVnDate();
  const cleanDate = getVnDateString(dateStr);

  if (cleanDate < todayVn) {
    return { key: 'past', label: 'Đã qua ngày', className: 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/[0.06]' };
  }
  if (cleanDate === todayVn) {
    return { key: 'today', label: 'Hôm nay', className: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 font-bold' };
  }
  return { key: 'upcoming', label: 'Sắp tới', className: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40' };
};

export const formatRecurrenceLabel = (repeatVal) => {
  switch (repeatVal) {
    case 'daily': return 'Hàng ngày';
    case 'weekly': return 'Hàng tuần';
    case 'monthly': return 'Hàng tháng';
    case 'quarterly': return 'Mỗi 3 tháng';
    case 'yearly': return 'Hàng năm';
    default: return null;
  }
};

// ============================================================================
// COMPONENT CHÍNH SCHEDULEVIEW
// ============================================================================
export const ScheduleView = ({
  schedules = [],
  appointments = [],
  pets = [],
  selectedPetId: propSelectedPetId,
  onSelectPet: propOnSelectPet,
  onToggleComplete = () => {},
  onOpenAddSchedule = () => {},
  onOpenEditSchedule = () => {},
  onDeleteSchedule = () => {},
  onCancelAppointment,
  onUpdateAppointment,
  onOpenVetBooking = () => {},
  currentUser,
  onReloadData = () => {}
}) => {
  // 1. Tab chính: 'appointments' (Lịch khám) hoặc 'care' (Lịch chăm sóc)
  const [activeMainTab, setActiveMainTab] = useState('appointments');

  // 2. Chế độ xem: 'list' (Danh sách) hoặc 'month' (Lịch tháng)
  const [viewMode, setViewMode] = useState('list');

  // 3. Bộ chọn thú cưng: Đồng bộ với state prop hoặc dùng local state
  const [internalPetId, setInternalPetId] = useState('all');
  const activePetId = propSelectedPetId !== undefined ? propSelectedPetId : internalPetId;
  const handlePetChange = (id) => {
    sound?.playClick?.();
    setInternalPetId(id);
    if (propOnSelectPet) propOnSelectPet(id);
  };

  // 4. Bộ lọc ngày: 'all' | 'today' | 'upcoming' | 'past'
  const [dateFilter, setDateFilter] = useState('all');

  // 5. Bộ lọc trạng thái:
  // Lịch khám: 'all' | 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'archived'
  // Lịch chăm sóc: 'all' | 'todo' | 'done'
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState('all');
  const [careStatusFilter, setCareStatusFilter] = useState('all');
  const [careTypeFilter, setCareTypeFilter] = useState('all');

  // 6. Modal chi tiết & thao tác
  const [selectedAppointmentDetail, setSelectedAppointmentDetail] = useState(null);
  const [appointmentToCancel, setAppointmentToCancel] = useState(null);
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // Lưu trữ (Xóa khỏi danh sách) & Khôi phục lịch khám
  const [appointmentToArchive, setAppointmentToArchive] = useState(null);
  const [isSubmittingArchive, setIsSubmittingArchive] = useState(false);
  const [archiveError, setArchiveError] = useState('');
  const [isUnarchivingId, setIsUnarchivingId] = useState(null);
  const [archiveNotice, setArchiveNotice] = useState(null);

  const [selectedCareDetail, setSelectedCareDetail] = useState(null);
  const [careToDelete, setCareToDelete] = useState(null);
  const [isDeletingCare, setIsDeletingCare] = useState(false);

  const todayVn = getTodayVnDate();
  const currentVnTime = getCurrentVnTime();

  // --------------------------------------------------------------------------
  // LỌC DỮ LIỆU LỊCH KHÁM (APPOINTMENTS)
  // --------------------------------------------------------------------------
  const currentUserIdStr = String(currentUser?.id || '').trim();

  const filteredAppointments = useMemo(() => {
    const list = Array.isArray(appointments) ? appointments : [];
    return list.filter(appt => {
      if (!appt) return false;

      // 0. Phân biệt trạng thái lưu trữ theo tài khoản người dùng
      const isArchived = Boolean(
        currentUserIdStr &&
        Array.isArray(appt.archivedByUserIds) &&
        appt.archivedByUserIds.includes(currentUserIdStr)
      );

      if (appointmentStatusFilter === 'archived') {
        if (!isArchived) return false;
      } else {
        if (isArchived) return false;

        // 3. Lọc theo trạng thái nghiệp vụ khi không ở chế độ xem lưu trữ
        if (appointmentStatusFilter !== 'all') {
          const statusInfo = getAppointmentStatusInfo(appt.status);
          if (statusInfo.key !== appointmentStatusFilter) return false;
        }
      }

      // 1. Lọc theo thú cưng
      if (activePetId !== 'all' && appt.petId !== activePetId) {
        return false;
      }

      // 2. Lọc theo khoảng ngày
      const apptDate = getVnDateString(appt.date);
      const apptTime = (appt.time || '').trim();

      if (dateFilter === 'today') {
        if (apptDate !== todayVn) return false;
      } else if (dateFilter === 'upcoming') {
        if (apptDate < todayVn) return false;
        if (apptDate === todayVn && apptTime && apptTime < currentVnTime) return false;
      } else if (dateFilter === 'past') {
        if (apptDate > todayVn) return false;
        if (apptDate === todayVn && (!apptTime || apptTime >= currentVnTime)) return false;
      }

      return true;
    }).sort((a, b) => {
      // Sắp xếp ngày mới nhất/gần nhất lên đầu
      const dateA = `${getVnDateString(a.date)} ${a.time || '00:00'}`;
      const dateB = `${getVnDateString(b.date)} ${b.time || '00:00'}`;
      return dateA.localeCompare(dateB);
    });
  }, [appointments, activePetId, dateFilter, appointmentStatusFilter, todayVn, currentVnTime, currentUserIdStr]);

  const unarchivedAppointmentsCount = useMemo(() => {
    const list = Array.isArray(appointments) ? appointments : [];
    return list.filter(a => {
      const isArchived = Boolean(
        currentUserIdStr &&
        Array.isArray(a.archivedByUserIds) &&
        a.archivedByUserIds.includes(currentUserIdStr)
      );
      return !isArchived;
    }).length;
  }, [appointments, currentUserIdStr]);


  // --------------------------------------------------------------------------
  // LỌC DỮ LIỆU LỊCH CHĂM SÓC (CARE SCHEDULES)
  // --------------------------------------------------------------------------
  const filteredSchedules = useMemo(() => {
    const list = Array.isArray(schedules) ? schedules : [];
    return list.filter(sch => {
      if (!sch) return false;

      // 1. Lọc theo thú cưng
      if (activePetId !== 'all' && sch.petId !== activePetId) {
        return false;
      }

      // 2. Lọc theo khoảng ngày
      const schDate = getVnDateString(sch.date);
      if (dateFilter === 'today') {
        if (schDate !== todayVn) return false;
      } else if (dateFilter === 'upcoming') {
        if (schDate < todayVn) return false;
      } else if (dateFilter === 'past') {
        if (schDate >= todayVn) return false;
      }

      // 3. Lọc theo loại sự kiện chăm sóc
      if (careTypeFilter !== 'all') {
        if (careTypeFilter === 'deworm') {
          if (sch.type !== 'deworm' && sch.type !== 'parasite') return false;
        } else {
          if (sch.type !== careTypeFilter) return false;
        }
      }

      // 4. Lọc theo trạng thái hoàn thành
      if (careStatusFilter === 'todo' && sch.completed) return false;
      if (careStatusFilter === 'done' && !sch.completed) return false;

      return true;
    }).sort((a, b) => {
      const dateA = `${getVnDateString(a.date)} ${a.time || '00:00'}`;
      const dateB = `${getVnDateString(b.date)} ${b.time || '00:00'}`;
      return dateA.localeCompare(dateB);
    });
  }, [schedules, activePetId, dateFilter, careTypeFilter, careStatusFilter, todayVn]);

  // Tên thú cưng đang lọc để hiển thị trên banner
  const selectedPetObject = useMemo(() => {
    if (activePetId === 'all') return null;
    return (pets || []).find(p => p && p.id === activePetId) || null;
  }, [pets, activePetId]);

  // --------------------------------------------------------------------------
  // HÀNH ĐỘNG HỦY LỊCH KHÁM (CHỦ NUÔI)
  // --------------------------------------------------------------------------
  const handleConfirmCancelAppointment = async (e) => {
    e?.preventDefault?.();
    if (!appointmentToCancel) return;

    const reason = cancelReasonInput.trim() || 'Chủ nuôi yêu cầu hủy lịch';
    setIsCancelling(true);

    try {
      if (onCancelAppointment) {
        await onCancelAppointment(appointmentToCancel.id, reason);
      } else if (onUpdateAppointment) {
        await onUpdateAppointment(appointmentToCancel.id, {
          status: 'cancelled',
          cancelReason: reason,
          cancelledAt: new Date().toISOString()
        });
      }
      sound?.playSuccess?.();
      setAppointmentToCancel(null);
      setSelectedAppointmentDetail(null);
      setCancelReasonInput('');
      onReloadData();
    } catch (err) {
      alert(err.message || 'Lỗi khi hủy lịch khám. Vui lòng thử lại.');
    } finally {
      setIsCancelling(false);
    }
  };

  // --------------------------------------------------------------------------
  // HÀNH ĐỘNG XÓA KHỎI DANH SÁCH (LƯU TRỮ) & KHÔI PHỤC LỊCH KHÁM
  // --------------------------------------------------------------------------
  const handleConfirmArchiveAppointment = async () => {
    if (!appointmentToArchive || isSubmittingArchive) return;
    setIsSubmittingArchive(true);
    setArchiveError('');
    try {
      await archiveAppointment(appointmentToArchive.id);
      sound?.playSuccess?.();
      const targetId = appointmentToArchive.id;
      setAppointmentToArchive(null);
      setSelectedAppointmentDetail(null);
      setArchiveNotice({
        type: 'archived',
        message: `Đã xóa lịch #${targetId} khỏi danh sách hiển thị của bạn (đã lưu trữ). Bạn có thể xem lại tại bộ lọc "Đã lưu trữ".`
      });
      setTimeout(() => setArchiveNotice(null), 6000);
      await onReloadData();
    } catch (err) {
      console.error('Lỗi khi lưu trữ lịch khám:', err);
      setArchiveError(err.message || 'Lỗi khi xóa lịch khỏi danh sách. Vui lòng thử lại.');
    } finally {
      setIsSubmittingArchive(false);
    }
  };

  const handleUnarchiveAppointment = async (apptId) => {
    if (!apptId || isUnarchivingId) return;
    setIsUnarchivingId(apptId);
    try {
      await unarchiveAppointment(apptId);
      sound?.playSuccess?.();
      setArchiveNotice({
        type: 'restored',
        message: `Đã khôi phục lịch #${apptId} về danh sách hiển thị.`
      });
      setTimeout(() => setArchiveNotice(null), 5000);
      if (selectedAppointmentDetail?.id === apptId) {
        setSelectedAppointmentDetail(null);
      }
      await onReloadData();
    } catch (err) {
      console.error('Lỗi khi khôi phục lịch khám:', err);
      alert(err.message || 'Lỗi khi khôi phục lịch. Vui lòng thử lại.');
    } finally {
      setIsUnarchivingId(null);
    }
  };

  // --------------------------------------------------------------------------
  // HÀNH ĐỘNG XÓA LỊCH CHĂM SÓC
  // --------------------------------------------------------------------------
  const [deleteError, setDeleteError] = useState(null);
  const [deleteNotice, setDeleteNotice] = useState(null);

  const handleConfirmDeleteCare = async () => {
    if (!careToDelete || isDeletingCare) return;
    setIsDeletingCare(true);
    setDeleteError(null);
    try {
      await onDeleteSchedule(careToDelete.id);
      sound?.playTrash?.();
      setCareToDelete(null);
      setSelectedCareDetail(null);
      setDeleteError(null);
      onReloadData();
    } catch (err) {
      console.error('Lỗi khi xóa lịch chăm sóc:', err);
      if (err.status === 404 || err.code === 'NOT_FOUND' || err.isGhostCleaned || (err.message && err.message.includes('không tồn tại'))) {
        // Backend xác nhận bản ghi không còn tồn tại: tải lại nguồn dữ liệu có thẩm quyền để loại thẻ cũ; thông báo rõ ràng
        setCareToDelete(null);
        setSelectedCareDetail(null);
        setDeleteError(null);
        setDeleteNotice('Lịch này không còn tồn tại, danh sách đã được cập nhật.');
        setTimeout(() => setDeleteNotice(null), 5000);
        onReloadData();
      } else {
        // Hiển thị lỗi trong modal thay cho alert trình duyệt; không giả thành công khi lỗi mạng, 403 hoặc lỗi hệ thống
        setDeleteError({
          title: err.status === 403 ? 'Không có quyền thực hiện' : 'Xóa lịch thất bại',
          message: err.message || 'Lỗi khi xóa lịch chăm sóc. Vui lòng thử lại.'
        });
      }
    } finally {
      setIsDeletingCare(false);
    }
  };

  // --------------------------------------------------------------------------
  // XUẤT LỊCH (.ICS) THEO PHẠM VI BỘ LỌC ĐANG CHỌN (CHUẨN ASIA/HO_CHI_MINH)
  // --------------------------------------------------------------------------
  const handleExportIcs = () => {
    sound?.playPop?.();
    const isAppt = activeMainTab === 'appointments';
    const targetItems = isAppt ? filteredAppointments : filteredSchedules;

    if (targetItems.length === 0) {
      alert('Không có lịch nào trong phạm vi bộ lọc hiện tại để xuất file .ics.');
      return;
    }

    // Chuẩn hóa item cho generateIcsCalendar
    const normalizedList = targetItems.map(item => {
      if (isAppt) {
        return {
          id: item.id,
          date: item.date,
          time: item.time || '08:30',
          title: `Khám thú y: ${item.service || 'Khám tổng quát'}`,
          notes: `Cơ sở: ${item.facility || 'Cơ sở thú y'}\nBác sĩ: ${item.assignedVet || 'Chưa phân công'}\nLiên hệ: ${item.phone || ''}\nGhi chú: ${item.note || 'Không có'}`,
          location: item.facility || 'Bệnh viện thú y',
          petId: item.petId,
          petName: item.petName
        };
      }
      return item;
    });

    try {
      const icsString = generateIcsCalendar(normalizedList, pets);
      const blob = new Blob([icsString], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', isAppt ? 'lich-kham-petcare.ics' : 'lich-cham-soc-petcare.ics');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Lỗi khi xuất file .ics:', err);
      alert('Lỗi tạo tệp lịch .ics: ' + err.message);
    }
  };

  // Mô tả phạm vi bộ lọc cho banner
  const filterSummaryText = useMemo(() => {
    const parts = [];
    parts.push(selectedPetObject ? `Bé ${selectedPetObject.name}` : 'Tất cả thú cưng');

    if (dateFilter === 'today') parts.push('Hôm nay');
    else if (dateFilter === 'upcoming') parts.push('Sắp tới');
    else if (dateFilter === 'past') parts.push('Đã qua ngày/giờ hẹn');
    else parts.push('Tất cả ngày');

    if (activeMainTab === 'appointments') {
      if (appointmentStatusFilter === 'archived') parts.push('Đã lưu trữ');
      else if (appointmentStatusFilter === 'pending') parts.push('Chờ xác nhận');
      else if (appointmentStatusFilter === 'confirmed') parts.push('Đã xác nhận');
      else if (appointmentStatusFilter === 'in_progress') parts.push('Đang khám');
      else if (appointmentStatusFilter === 'completed') parts.push('Hoàn thành');
      else if (appointmentStatusFilter === 'cancelled') parts.push('Đã hủy');
    } else {
      if (careTypeFilter !== 'all') {
        const typeLabel = SCHEDULE_TYPES[careTypeFilter]?.label;
        if (typeLabel) parts.push(typeLabel);
      }
      if (careStatusFilter === 'todo') parts.push('Chưa hoàn thành');
      else if (careStatusFilter === 'done') parts.push('Đã hoàn thành');
    }

    return parts.join(' • ');
  }, [selectedPetObject, dateFilter, activeMainTab, appointmentStatusFilter, careStatusFilter, careTypeFilter]);

  const currentCount = activeMainTab === 'appointments' ? filteredAppointments.length : filteredSchedules.length;
  const totalCount = activeMainTab === 'appointments' 
    ? (appointmentStatusFilter === 'archived' ? filteredAppointments.length : unarchivedAppointmentsCount) 
    : (schedules || []).length;

  return (
    <PageContainer id="schedule-page">
      {/* 1. Tiêu đề và nút tạo lịch trên cùng một hàng */}
      <PageHeader
        title="Lịch trình"
        subtitle="Theo dõi lịch hẹn khám thú y và kế hoạch chăm sóc định kỳ cho thú cưng"
        actions={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportIcs}
              className="inline-flex items-center gap-1.5 h-11 px-4 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-[#12192A] hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all cursor-pointer border border-slate-200 dark:border-white/10 shadow-xs active:scale-95"
              title="Xuất tệp lịch .ics theo phạm vi bộ lọc đang chọn"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span className="hidden sm:inline">Xuất lịch (.ics)</span>
              <span className="sm:hidden">.ics</span>
            </button>

            {activeMainTab === 'appointments' ? (
              <button
                type="button"
                onClick={() => onOpenVetBooking({
                  petId: activePetId !== 'all' ? activePetId : null
                })}
                className="inline-flex items-center gap-2 h-11 px-5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm active:scale-95 transition-all cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Đặt lịch khám</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onOpenAddSchedule(
                  null, 
                  null, 
                  null, 
                  activePetId !== 'all' ? activePetId : null
                )}
                className="inline-flex items-center gap-2 h-11 px-5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm active:scale-95 transition-all cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Thêm việc chăm sóc</span>
              </button>
            )}
          </div>
        }
      />

      {/* 2. Tabs Lịch khám / Lịch chăm sóc ngay dưới tiêu đề */}
      <Tabs
        tabs={[
          { id: 'appointments', label: 'Lịch khám', icon: Stethoscope, badge: unarchivedAppointmentsCount },
          { id: 'care', label: 'Lịch chăm sóc', icon: CalendarDays, badge: (schedules || []).length }
        ]}
        activeTab={activeMainTab}
        onChange={(id) => {
          try { sound?.playClick?.(); } catch {}
          setActiveMainTab(id);
        }}
        variant="pill"
      />

      {/* 3. Bộ lọc gọn, xuống hàng có chủ đích khi thiếu chỗ */}
      <FilterBar
        onReset={(dateFilter !== 'all' || (activeMainTab === 'appointments' ? appointmentStatusFilter !== 'all' : careStatusFilter !== 'all') || activePetId !== 'all') ? () => {
          handlePetChange('all');
          setDateFilter('all');
          setAppointmentStatusFilter('all');
          setCareStatusFilter('all');
        } : null}
      >
        {/* Bộ chọn thú cưng */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 max-w-full">
          <button
            type="button"
            onClick={() => handlePetChange('all')}
            className={`h-10 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activePetId === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-[#12192A] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200 dark:border-white/10'
            }`}
          >
            Tất cả ({pets.length})
          </button>

          {pets.map((p) => {
            if (!p) return null;
            const isSelected = activePetId === p.id;
            return (
              <button
                type="button"
                key={p.id}
                onClick={() => handlePetChange(p.id)}
                className={`inline-flex items-center gap-2 h-10 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer border ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-400/30'
                    : 'border-slate-200 dark:border-white/10 bg-white dark:bg-[#12192A] text-slate-700 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                <SafePetAvatar pet={p} size="sm" />
                <span>{p.name}</span>
              </button>
            );
          })}
        </div>

        {/* Dropdown Ngày */}
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="h-10 px-3 bg-white dark:bg-[#12192A] border border-slate-200 dark:border-white/10 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500 cursor-pointer"
        >
          <option value="all">Tất cả ngày</option>
          <option value="today">Hôm nay</option>
          <option value="upcoming">Sắp tới</option>
          <option value="past">Đã qua</option>
        </select>

        {/* Dropdown Trạng thái theo từng tab */}
        {activeMainTab === 'appointments' ? (
          <select
            value={appointmentStatusFilter}
            onChange={(e) => setAppointmentStatusFilter(e.target.value)}
            className="h-10 px-3 bg-white dark:bg-[#12192A] border border-slate-200 dark:border-white/10 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="all">Tất cả trạng thái khám</option>
            <option value="pending">Chờ xác nhận</option>
            <option value="confirmed">Đã xác nhận</option>
            <option value="in_progress">Đang khám</option>
            <option value="completed">Hoàn thành</option>
            <option value="cancelled">Đã hủy</option>
            <option value="archived">Đã lưu trữ (Ẩn khỏi danh sách)</option>
          </select>
        ) : (
          <>
            {/* Dropdown Loại việc chăm sóc (8 loại) */}
            <select
              value={careTypeFilter}
              onChange={(e) => setCareTypeFilter(e.target.value)}
              className="h-10 px-3 bg-white dark:bg-[#12192A] border border-slate-200 dark:border-white/10 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">Tất cả loại việc</option>
              {Object.entries(SCHEDULE_TYPES).map(([typeKey, cfg]) => (
                <option key={typeKey} value={typeKey}>{cfg.label}</option>
              ))}
            </select>

            <select
              value={careStatusFilter}
              onChange={(e) => setCareStatusFilter(e.target.value)}
              className="h-10 px-3 bg-white dark:bg-[#12192A] border border-slate-200 dark:border-white/10 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">Tất cả trạng thái việc</option>
              <option value="todo">Chưa hoàn thành</option>
              <option value="done">Đã hoàn thành</option>
            </select>
          </>
        )}

        {/* Chế độ Danh sách / Lịch tháng */}
        <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-white/[0.06] border border-slate-200/60 dark:border-white/[0.08] ml-auto">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              viewMode === 'list'
                ? 'bg-white dark:bg-[#14182b] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
            }`}
            title="Chế độ Danh sách"
          >
            <LayoutList className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Danh sách</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('month')}
            className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              viewMode === 'month'
                ? 'bg-white dark:bg-[#14182b] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
            }`}
            title="Chế độ Lịch tháng"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Lịch tháng</span>
          </button>
        </div>
      </FilterBar>

      {/* 4. Dòng đếm & Tải lại */}
      <div className="flex items-center justify-between text-xs px-1 text-slate-500 dark:text-slate-400">
        <div>
          Hiển thị <strong>{currentCount}</strong> / <strong>{totalCount}</strong> {activeMainTab === 'appointments' ? 'lịch khám' : 'việc chăm sóc'}
          <span className="hidden sm:inline text-slate-400 dark:text-slate-500 ml-2">
            ({filterSummaryText})
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            sound?.playClick?.();
            onReloadData();
          }}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
          title="Tải lại dữ liệu từ hệ thống"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Làm mới</span>
        </button>
      </div>

      {/* 5. Nội dung chính */}
      {viewMode === 'month' ? (
        <CalendarMonthView
          items={activeMainTab === 'appointments' ? filteredAppointments : filteredSchedules}
          tabType={activeMainTab}
          pets={pets}
          onSelectItem={(item) => {
            sound?.playPop?.();
            if (activeMainTab === 'appointments') {
              setSelectedAppointmentDetail(item);
            } else {
              setSelectedCareDetail(item);
            }
          }}
          onToggleComplete={(id) => onToggleComplete(id)}
          onOpenCreate={(selectedDate) => {
            if (activeMainTab === 'appointments') {
              onOpenVetBooking({
                petId: activePetId !== 'all' ? activePetId : null,
                initialDate: selectedDate
              });
            } else {
              onOpenAddSchedule(
                selectedDate,
                null,
                null,
                activePetId !== 'all' ? activePetId : null
              );
            }
          }}
        />
      ) : activeMainTab === 'appointments' ? (
        /* TAB LỊCH KHÁM: Lưới 3 cột desktop, 2 cột tablet, 1 cột mobile (min 320px) */
        <div className="space-y-4">
          {archiveNotice && (
            <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-xs text-indigo-900 dark:text-indigo-200 flex items-center justify-between gap-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="font-medium">{archiveNotice.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setArchiveNotice(null)}
                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 p-1 cursor-pointer"
                title="Đóng thông báo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {filteredAppointments.length === 0 ? (
            <EmptyState
              icon={appointmentStatusFilter === 'archived' ? Archive : Stethoscope}
              title={appointmentStatusFilter === 'archived' ? 'Không có lịch khám nào đã lưu trữ' : 'Không tìm thấy lịch khám nào'}
              description={appointmentStatusFilter === 'archived' 
                ? 'Bạn chưa lưu trữ lịch khám nào. Khi xóa bớt các ca đã hoàn tất hoặc đã hủy, chúng sẽ xuất hiện tại đây.' 
                : `Chưa có lịch khám nào phù hợp với bộ lọc (${filterSummaryText}).`}
              actionText={appointmentStatusFilter === 'archived' ? null : 'Đặt lịch khám ngay'}
              onAction={appointmentStatusFilter === 'archived' ? null : () => onOpenVetBooking({ petId: activePetId !== 'all' ? activePetId : null })}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredAppointments.map((appt) => {
                if (!appt) return null;
                const pet = (pets || []).find(p => p && p.id === appt.petId);
                const petName = appt.petName || pet?.name || 'Thú cưng';
                const statusInfo = getAppointmentStatusInfo(appt.status);
                const temporalTag = getAppointmentTemporalTag(appt.date, appt.time);

                const doctorDisplay = appt.assignedVet && appt.assignedVet !== 'Cơ sở phân công'
                  ? appt.assignedVet
                  : 'Chưa phân công';

                const isArchived = Boolean(
                  currentUserIdStr &&
                  Array.isArray(appt.archivedByUserIds) &&
                  appt.archivedByUserIds.includes(currentUserIdStr)
                );

                const canCancel = (statusInfo.key === 'pending' || statusInfo.key === 'confirmed') && !isArchived;
                const canArchive = (statusInfo.key === 'completed' || statusInfo.key === 'cancelled') && !isArchived;
                const canUnarchive = isArchived;

                return (
                  <div
                    key={appt.id}
                    onClick={() => {
                      sound?.playPop?.();
                      setSelectedAppointmentDetail(appt);
                    }}
                    className={`bg-white dark:bg-[#12192A] rounded-2xl p-5 border transition-all cursor-pointer flex flex-col justify-between space-y-4 group min-w-[320px] ${
                      isArchived
                        ? 'border-slate-200/60 dark:border-white/5 opacity-85 bg-slate-50/50 dark:bg-white/[0.01]'
                        : 'border-slate-200/80 dark:border-white/10 hover:border-indigo-400/50 dark:hover:border-indigo-400/50 shadow-sm hover:shadow-md'
                    }`}
                  >
                    {/* Trong thẻ: Thú cưng / dịch vụ */}
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <SafePetAvatar pet={pet} size="md" />
                          <div>
                            <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {petName}
                            </div>
                            <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                              #{appt.id}
                            </div>
                          </div>
                        </div>

                        {/* Trạng thái */}
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {isArchived && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-white/[0.08] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 flex items-center gap-1">
                              <Archive className="w-3 h-3 text-slate-400" />
                              Đã lưu trữ
                            </span>
                          )}
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${statusInfo.badgeClass}`}>
                            {statusInfo.label}
                          </span>
                        </div>
                      </div>

                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-2">
                        {appt.service || 'Khám tổng quát thú cưng'}
                      </div>
                    </div>

                    {/* Ngày giờ / cơ sở / bác sĩ */}
                    <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 pt-3 border-t border-slate-100 dark:border-white/5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
                          <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span>{appt.time || '08:30'} • {appt.date}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold ${temporalTag.className}`}>
                          {temporalTag.label}
                        </span>
                      </div>

                      <div className="flex items-start gap-1.5 text-slate-500 dark:text-slate-400">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-1">{appt.facility || 'Cơ sở thú y'}</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                          Bác sĩ: <strong>{doctorDisplay}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Thao tác */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-white/5 gap-2 flex-wrap">
                      <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5 group-hover:underline">
                        Xem chi tiết <ChevronRight className="w-3.5 h-3.5" />
                      </span>

                      <div className="flex items-center gap-1.5">
                        {canCancel && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              sound?.playClick?.();
                              setAppointmentToCancel(appt);
                              setCancelReasonInput('');
                            }}
                            className="h-8 px-3 text-xs font-medium text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 rounded-lg transition-colors cursor-pointer"
                            title="Hủy lịch hẹn khám này"
                          >
                            Hủy lịch
                          </button>
                        )}

                        {canArchive && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              sound?.playClick?.();
                              setAppointmentToArchive(appt);
                              setArchiveError('');
                            }}
                            className="h-8 px-2.5 text-xs font-medium text-slate-600 hover:text-rose-600 dark:text-slate-300 dark:hover:text-rose-400 bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                            title="Xóa lịch này khỏi danh sách hiển thị của bạn (Lưu trữ)"
                          >
                            <Archive className="w-3.5 h-3.5" />
                            <span>Xóa khỏi DS</span>
                          </button>
                        )}

                        {canUnarchive && (
                          <button
                            type="button"
                            disabled={isUnarchivingId === appt.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnarchiveAppointment(appt.id);
                            }}
                            className="h-8 px-2.5 text-xs font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                            title="Khôi phục lịch này trở lại danh sách hiển thị"
                          >
                            <RotateCcw className={`w-3.5 h-3.5 ${isUnarchivingId === appt.id ? 'animate-spin' : ''}`} />
                            <span>Khôi phục</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* TAB LỊCH CHĂM SÓC: Lưới 3 cột desktop, 2 cột tablet, 1 cột mobile (min 320px) */
        <div className="space-y-4">
          {deleteNotice && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between gap-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="font-medium">{deleteNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setDeleteNotice(null)}
                className="text-amber-600 dark:text-amber-400 hover:text-amber-800 p-1 cursor-pointer"
                title="Đóng thông báo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {filteredSchedules.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Không có lịch chăm sóc nào"
              description={`Chưa có công việc chăm sóc nào phù hợp với bộ lọc (${filterSummaryText}).`}
              actionText="Thêm việc chăm sóc"
              onAction={() => onOpenAddSchedule(null, null, null, activePetId !== 'all' ? activePetId : null)}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredSchedules.map((sch) => {
              if (!sch) return null;
              const pet = (pets || []).find(p => p && p.id === sch.petId);
              const petName = sch.petName || pet?.name || 'Thú cưng';
              const isDone = Boolean(sch.completed);
              const temporalTag = getCareTemporalTag(sch.date);
              const recurrenceLabel = formatRecurrenceLabel(sch.repeat);

              return (
                <div
                  key={sch.id}
                  className={`rounded-2xl p-5 border transition-all flex flex-col justify-between space-y-4 min-w-[320px] ${
                    isDone 
                      ? 'bg-slate-50/70 dark:bg-white/[0.02] border-slate-200/60 dark:border-white/5 opacity-80' 
                      : 'bg-white dark:bg-[#12192A] border border-slate-200/80 dark:border-white/10 shadow-sm hover:shadow-md hover:border-indigo-400/50'
                  }`}
                >
                  {/* Trong thẻ: Thú cưng / việc chăm sóc */}
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => onToggleComplete(sch.id)}
                          className="mt-0.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer shrink-0"
                          title={isDone ? 'Đánh dấu chưa hoàn thành' : 'Đánh dấu hoàn thành'}
                        >
                          {isDone ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600 hover:border-indigo-500" />
                          )}
                        </button>
                        <div>
                          <div 
                            onClick={() => setSelectedCareDetail(sch)}
                            className={`text-sm font-bold cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors ${
                              isDone ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {sch.title || sch.task || 'Lịch chăm sóc'}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                            <SafePetAvatar pet={pet} size="sm" />
                            <span className="font-medium">{petName}</span>
                            <span className="text-slate-300 dark:text-slate-600">•</span>
                            <ScheduleBadge type={sch.type} />
                          </div>
                        </div>
                      </div>

                      {/* Trạng thái */}
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0 ${
                        isDone 
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40' 
                          : 'bg-slate-100 text-slate-600 dark:bg-white/[0.08] dark:text-slate-300'
                      }`}>
                        {isDone ? 'Đã hoàn thành' : 'Chưa làm'}
                      </span>
                    </div>

                    {sch.notes && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 pl-8 line-clamp-2 italic">
                        "{sch.notes}"
                      </p>
                    )}
                  </div>

                  {/* Ngày giờ / lặp / địa điểm */}
                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 pt-3 border-t border-slate-100 dark:border-white/5 pl-8">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-white">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{sch.date} {sch.time ? `• ${sch.time}` : ''}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold ${temporalTag.className}`}>
                        {temporalTag.label}
                      </span>
                    </div>

                    {recurrenceLabel && (
                      <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-medium">
                        <Repeat className="w-3.5 h-3.5 shrink-0" />
                        <span>Lặp lại: {recurrenceLabel}</span>
                      </div>
                    )}

                    {sch.location && (
                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 truncate">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{sch.location}</span>
                      </div>
                    )}
                  </div>

                  {/* Thao tác */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-white/5 pl-8">
                    <button
                      type="button"
                      onClick={() => setSelectedCareDetail(sch)}
                      className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Chi tiết
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenEditSchedule(sch)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                        title="Sửa lịch chăm sóc"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setCareToDelete(sch)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="Xóa lịch chăm sóc này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    )}

      {/* 6. Modal xem chi tiết lịch khám */}
      <Modal
        isOpen={Boolean(selectedAppointmentDetail)}
        onClose={() => setSelectedAppointmentDetail(null)}
        title="Chi tiết lịch hẹn khám"
        size="md"
        footer={
          <div className="flex items-center justify-between w-full flex-wrap gap-2">
            <div className="flex items-center gap-2">
              {(() => {
                if (!selectedAppointmentDetail) return null;
                const statusKey = getAppointmentStatusInfo(selectedAppointmentDetail.status).key;
                const isArchived = Boolean(
                  currentUserIdStr &&
                  Array.isArray(selectedAppointmentDetail.archivedByUserIds) &&
                  selectedAppointmentDetail.archivedByUserIds.includes(currentUserIdStr)
                );

                if (statusKey === 'pending' || statusKey === 'confirmed') {
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        setAppointmentToCancel(selectedAppointmentDetail);
                        setCancelReasonInput('');
                      }}
                      className="h-10 px-4 text-xs font-medium text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 rounded-xl transition-colors cursor-pointer"
                    >
                      Hủy lịch khám này
                    </button>
                  );
                }

                if ((statusKey === 'completed' || statusKey === 'cancelled') && !isArchived) {
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        setAppointmentToArchive(selectedAppointmentDetail);
                        setArchiveError('');
                      }}
                      className="h-10 px-4 text-xs font-medium text-slate-700 hover:text-rose-600 dark:text-slate-300 dark:hover:text-rose-400 bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>Xóa khỏi danh sách</span>
                    </button>
                  );
                }

                if (isArchived) {
                  return (
                    <button
                      type="button"
                      disabled={isUnarchivingId === selectedAppointmentDetail.id}
                      onClick={() => handleUnarchiveAppointment(selectedAppointmentDetail.id)}
                      className="h-10 px-4 text-xs font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isUnarchivingId === selectedAppointmentDetail.id ? 'animate-spin' : ''}`} />
                      <span>Khôi phục vào danh sách</span>
                    </button>
                  );
                }

                return null;
              })()}
            </div>

            <button
              type="button"
              onClick={() => setSelectedAppointmentDetail(null)}
              className="h-10 px-5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            >
              Đóng
            </button>
          </div>
        }
      >
        {selectedAppointmentDetail && (
          <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
            {/* Trạng thái & Nhãn thời gian */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/10">
              <div>
                <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                  Trạng thái
                </span>
                <span className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getAppointmentStatusInfo(selectedAppointmentDetail.status).badgeClass}`}>
                  {getAppointmentStatusInfo(selectedAppointmentDetail.status).label}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                  Thời điểm
                </span>
                <span className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold ${getAppointmentTemporalTag(selectedAppointmentDetail.date, selectedAppointmentDetail.time).className}`}>
                  {getAppointmentTemporalTag(selectedAppointmentDetail.date, selectedAppointmentDetail.time).label}
                </span>
              </div>
            </div>

            {/* Thông tin khám */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50/50 dark:bg-white/[0.01] border border-slate-100 dark:border-white/5">
              <div>
                <span className="text-slate-400 dark:text-slate-500 block text-[11px]">Thú cưng:</span>
                <div className="font-bold text-slate-900 dark:text-white mt-0.5 flex items-center gap-1.5">
                  <PawPrint className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{selectedAppointmentDetail.petName || 'Thú cưng'}</span>
                </div>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 block text-[11px]">Dịch vụ:</span>
                <div className="font-semibold text-slate-900 dark:text-white mt-0.5">
                  {selectedAppointmentDetail.service || 'Khám tổng quát'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-slate-400 dark:text-slate-500 block text-[11px]">Ngày khám:</span>
                <div className="font-semibold text-slate-900 dark:text-white mt-0.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{selectedAppointmentDetail.date}</span>
                </div>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 block text-[11px]">Giờ khám:</span>
                <div className="font-semibold text-slate-900 dark:text-white mt-0.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{selectedAppointmentDetail.time || '08:30'}</span>
                </div>
              </div>
            </div>

            <div>
              <span className="text-slate-400 dark:text-slate-500 block text-[11px]">Cơ sở tiếp nhận:</span>
              <div className="font-semibold text-slate-900 dark:text-white mt-0.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{selectedAppointmentDetail.facility || 'Cơ sở thú y'}</span>
              </div>
            </div>

            <div>
              <span className="text-slate-400 dark:text-slate-500 block text-[11px]">Bác sĩ phụ trách:</span>
              <div className="font-semibold text-slate-900 dark:text-white mt-0.5 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>
                  {selectedAppointmentDetail.assignedVet && selectedAppointmentDetail.assignedVet !== 'Cơ sở phân công'
                    ? selectedAppointmentDetail.assignedVet
                    : 'Chưa phân công'}
                </span>
              </div>
            </div>

            {/* Thông tin liên hệ */}
            <div className="p-3 rounded-xl bg-slate-50/50 dark:bg-white/[0.01] border border-slate-100 dark:border-white/5 space-y-1">
              <span className="text-slate-400 dark:text-slate-500 block text-[11px] font-semibold uppercase tracking-wider">
                Thông tin liên hệ
              </span>
              <div className="flex items-center justify-between text-xs pt-1">
                <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>{selectedAppointmentDetail.ownerName || 'Chủ nuôi'}</span>
                </div>
                <div className="flex items-center gap-1.5 font-semibold text-indigo-600 dark:text-indigo-400">
                  <Phone className="w-3.5 h-3.5" />
                  <span>{selectedAppointmentDetail.phone || 'Chưa cung cấp SĐT'}</span>
                </div>
              </div>
            </div>

            {/* Ghi chú */}
            <div>
              <span className="text-slate-400 dark:text-slate-500 block text-[11px] font-semibold uppercase tracking-wider mb-1">
                Ghi chú từ chủ nuôi
              </span>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/10 text-xs">
                {selectedAppointmentDetail.note || <span className="italic text-slate-400">Không có ghi chú thêm</span>}
              </div>
            </div>

            {selectedAppointmentDetail.adminNote && (
              <div>
                <span className="text-slate-400 dark:text-slate-500 block text-[11px] font-semibold uppercase tracking-wider mb-1">
                  Phản hồi từ phòng khám
                </span>
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/30 text-xs text-blue-900 dark:text-blue-200">
                  {selectedAppointmentDetail.adminNote}
                </div>
              </div>
            )}

            {selectedAppointmentDetail.status === 'cancelled' && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/30 text-xs text-rose-800 dark:text-rose-200 space-y-1">
                <span className="font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Lý do hủy lịch:
                </span>
                <p>{selectedAppointmentDetail.cancelReason || 'Chủ nuôi yêu cầu hủy lịch'}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 7. Modal xác nhận hủy lịch khám */}
      <Modal
        isOpen={Boolean(appointmentToCancel)}
        onClose={() => setAppointmentToCancel(null)}
        title="Xác nhận hủy lịch khám"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={() => setAppointmentToCancel(null)}
              disabled={isCancelling}
              className="h-10 px-4 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            >
              Không, giữ lịch
            </button>
            <button
              type="button"
              onClick={handleConfirmCancelAppointment}
              disabled={isCancelling}
              className={`h-10 px-4 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition-all ${
                isCancelling ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              {isCancelling ? 'Đang hủy...' : 'Xác nhận hủy lịch'}
            </button>
          </div>
        }
      >
        {appointmentToCancel && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Bạn có chắc chắn muốn hủy lịch khám ngày <strong>{appointmentToCancel.date}</strong> lúc <strong>{appointmentToCancel.time || '08:30'}</strong> cho bé <strong>{appointmentToCancel.petName || 'Thú cưng'}</strong>?
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Lý do hủy lịch (tùy chọn):
              </label>
              <textarea
                rows={2}
                value={cancelReasonInput}
                onChange={(e) => setCancelReasonInput(e.target.value)}
                placeholder="Ví dụ: Bận đột xuất, bé đã khỏe hơn..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-xl text-xs outline-none focus:border-rose-500 text-slate-900 dark:text-white"
              />
            </div>

            <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">
              Lưu ý: Lịch khám sau khi hủy vẫn được lưu giữ an toàn trong lịch sử với trạng thái "Đã hủy".
            </p>
          </div>
        )}
      </Modal>

      {/* Modal xác nhận xóa khỏi danh sách (Lưu trữ) lịch khám */}
      <Modal
        isOpen={Boolean(appointmentToArchive)}
        onClose={() => {
          if (!isSubmittingArchive) {
            setAppointmentToArchive(null);
            setArchiveError('');
          }
        }}
        title="Xóa khỏi danh sách (Lưu trữ lịch khám)"
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={() => {
                setAppointmentToArchive(null);
                setArchiveError('');
              }}
              disabled={isSubmittingArchive}
              className="h-10 px-4 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            >
              Giữ lại
            </button>
            <button
              type="button"
              onClick={handleConfirmArchiveAppointment}
              disabled={isSubmittingArchive}
              className={`h-10 px-4 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl shadow-sm transition-all flex items-center gap-1.5 ${
                isSubmittingArchive ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              {isSubmittingArchive && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              <span>{isSubmittingArchive ? 'Đang lưu trữ...' : 'Xác nhận xóa khỏi danh sách'}</span>
            </button>
          </div>
        }
      >
        {appointmentToArchive && (
          <div className="space-y-4">
            {archiveError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold">Không thể lưu trữ lịch khám</div>
                  <div className="text-[11px] text-rose-600 dark:text-rose-400">{archiveError}</div>
                </div>
              </div>
            )}

            <p className="text-xs text-slate-700 dark:text-slate-200">
              Bạn có chắc chắn muốn xóa lịch khám này khỏi danh sách hiển thị của mình?
            </p>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/10 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Thú cưng:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {(pets || []).find(p => p && p.id === appointmentToArchive.petId)?.name || appointmentToArchive.petName || 'Thú cưng'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Dịch vụ:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{appointmentToArchive.service || 'Khám tổng quát'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Thời gian hẹn:</span>
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                  {appointmentToArchive.time || '08:30'} • {appointmentToArchive.date}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Mã lịch khám:</span>
                <span className="font-mono text-slate-500">#{appointmentToArchive.id}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 text-[11px] text-blue-800 dark:text-blue-300 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>Giải thích phạm vi lưu trữ:</span>
              </div>
              <p>
                Thao tác này chỉ ẩn lịch khỏi danh sách hiển thị cá nhân của bạn (tài khoản hiện tại) và chuyển vào mục <strong>"Đã lưu trữ"</strong>.
              </p>
              <p className="text-slate-500 dark:text-slate-400">
                • Hồ sơ bệnh án, đơn thuốc, lịch sử y tế và liên kết dữ liệu vẫn được bảo toàn nguyên vẹn.
                <br />
                • Lịch hẹn phía Bác sĩ/Phòng khám không bị ảnh hưởng.
                <br />
                • Bạn có thể xem lại và bấm <strong>"Khôi phục"</strong> bất kỳ lúc nào từ bộ lọc <em>"Đã lưu trữ"</em>.
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* 8. Modal xem chi tiết lịch chăm sóc */}
      <Modal
        isOpen={Boolean(selectedCareDetail)}
        onClose={() => setSelectedCareDetail(null)}
        title="Chi tiết lịch chăm sóc"
        size="md"
        footer={
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={() => {
                const care = selectedCareDetail;
                setSelectedCareDetail(null);
                onOpenEditSchedule(care);
              }}
              className="h-10 px-4 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-colors cursor-pointer"
            >
              Chỉnh sửa
            </button>

            <button
              type="button"
              onClick={() => setSelectedCareDetail(null)}
              className="h-10 px-5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            >
              Đóng
            </button>
          </div>
        }
      >
        {selectedCareDetail && (
          <div className="space-y-3.5 text-xs text-slate-700 dark:text-slate-300">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/10 flex items-center justify-between">
              <div>
                <span className="text-slate-400 dark:text-slate-500 text-[11px] block">Công việc:</span>
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  {selectedCareDetail.title || selectedCareDetail.task}
                </span>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                selectedCareDetail.completed 
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' 
                  : 'bg-slate-100 text-slate-600 dark:bg-white/[0.08] dark:text-slate-300'
              }`}>
                {selectedCareDetail.completed ? 'Đã hoàn thành' : 'Chưa làm'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-slate-400 dark:text-slate-500 text-[11px] block">Thú cưng:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {selectedCareDetail.petName || 'Thú cưng'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 text-[11px] block">Loại việc:</span>
                <div className="mt-0.5">
                  <ScheduleBadge type={selectedCareDetail.type} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-slate-400 dark:text-slate-500 text-[11px] block">Ngày dự kiến:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {selectedCareDetail.date}
                </span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 text-[11px] block">Giờ thực hiện:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {selectedCareDetail.time || '09:00'}
                </span>
              </div>
            </div>

            {selectedCareDetail.repeat && selectedCareDetail.repeat !== 'none' && (
              <div>
                <span className="text-slate-400 dark:text-slate-500 text-[11px] block">Quy tắc lặp:</span>
                <span className="font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 mt-0.5">
                  <Repeat className="w-3.5 h-3.5" /> {formatRecurrenceLabel(selectedCareDetail.repeat)}
                </span>
              </div>
            )}

            {selectedCareDetail.location && (
              <div>
                <span className="text-slate-400 dark:text-slate-500 text-[11px] block">Địa điểm:</span>
                <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" /> {selectedCareDetail.location}
                </span>
              </div>
            )}

            {selectedCareDetail.notes && (
              <div>
                <span className="text-slate-400 dark:text-slate-500 text-[11px] block">Ghi chú & dặn dò:</span>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/10 mt-1 text-xs">
                  {selectedCareDetail.notes}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 9. Modal xác nhận xóa lịch chăm sóc */}
      <Modal
        isOpen={Boolean(careToDelete)}
        onClose={() => {
          if (!isDeletingCare) {
            setCareToDelete(null);
            setDeleteError(null);
          }
        }}
        title="Xóa việc chăm sóc"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={() => {
                setCareToDelete(null);
                setDeleteError(null);
              }}
              disabled={isDeletingCare}
              className="h-10 px-4 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            >
              {deleteError ? 'Đóng' : 'Hủy bỏ'}
            </button>
            <button
              type="button"
              onClick={handleConfirmDeleteCare}
              disabled={isDeletingCare}
              className={`h-10 px-4 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition-all flex items-center gap-1.5 ${
                isDeletingCare ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              {isDeletingCare && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              <span>{isDeletingCare ? 'Đang xóa...' : deleteError ? 'Thử lại' : 'Xóa lịch'}</span>
            </button>
          </div>
        }
      >
        {careToDelete && (
          <div className="space-y-3">
            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold">{deleteError.title}</div>
                  <div className="text-[11px] text-rose-600 dark:text-rose-400">{deleteError.message}</div>
                </div>
              </div>
            )}
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Bạn có chắc chắn muốn xóa lịch chăm sóc <strong>"{careToDelete.title || careToDelete.task || 'Lịch chăm sóc'}"</strong> của bé <strong>{(pets || []).find(p => p && p.id === careToDelete.petId)?.name || careToDelete.petName || 'Thú cưng'}</strong>?
            </p>
          </div>
        )}
      </Modal>
    </PageContainer>
  );
};

export default ScheduleView;
