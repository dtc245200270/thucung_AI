import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { VetSidebar } from './VetSidebar';
import { VetNavbar } from './VetNavbar';
import { VetDashboardTab } from './VetDashboardTab';
import { VetAppointmentsTab } from './VetAppointmentsTab';
import { VetPatientsTab } from './VetPatientsTab';
import { VetSoapTab } from './VetSoapTab';
import { VetScheduleTab } from './VetScheduleTab';
import { MedicalRecordDetailModal } from './MedicalRecordDetailModal';
import { useTheme } from '../../context/ThemeContext';
import { sound } from '../../services/soundService';
import { getAppointments, getMedicalRecords, updateAppointmentStatus, updateAppointment } from '../../services/storageService';
import { syncAllDataToCache, archiveAppointment, unarchiveAppointment, apiFetch } from '../../services/apiService';
import { isPastVnDateTime, getTodayVnDate, getCurrentVnTime } from '../../utils/dateUtils';
import { 
  Clock, 
  PlayCircle, 
  CheckCircle2, 
  XCircle, 
  Calendar, 
  AlertTriangle, 
  User, 
  Phone, 
  RotateCcw, 
  Loader2, 
  X, 
  Check, 
  Stethoscope 
} from 'lucide-react';

export const ClinicWorkspaceView = ({
  pets = [],
  appointments = [],
  onUpdateAppointment,
  onNavigateTab,
  onBack,
  onBackToOwnerPortal,
  onSwitchPortal,
  onLogout,
  currentUser
}) => {
  const { theme, toggleTheme, isDark } = useTheme();

  // Tab đang hoạt động: 'dashboard' | 'appointments' | 'patients' | 'soap' | 'schedule'
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const savedTab = localStorage.getItem('petcare_vet_active_tab');
      const validTabs = ['dashboard', 'appointments', 'patients', 'soap', 'schedule'];
      if (savedTab && validTabs.includes(savedTab)) {
        return savedTab;
      }
    } catch {}
    return 'dashboard';
  });

  // ID ca khám đang được chọn để khám SOAP
  const [activeExamAppId, setActiveExamAppId] = useState(() => {
    try {
      return localStorage.getItem('petcare_vet_active_exam_id') || null;
    } catch {
      return null;
    }
  });

  // Duy trì activeTab khi chuyển đổi qua F5
  useEffect(() => {
    try {
      localStorage.setItem('petcare_vet_active_tab', activeTab);
    } catch {}
  }, [activeTab]);

  // Duy trì activeExamAppId qua F5
  useEffect(() => {
    try {
      if (activeExamAppId) {
        localStorage.setItem('petcare_vet_active_exam_id', activeExamAppId);
      }
    } catch {}
  }, [activeExamAppId]);

  // Trạng thái thu gọn Sidebar
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('petcare_vet_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleSidebarCollapse = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('petcare_vet_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  // Trạng thái menu mobile
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Danh sách lịch khám cục bộ đồng bộ
  const [localAppointments, setLocalAppointments] = useState(() => {
    return Array.isArray(appointments) && appointments.length > 0 ? appointments : [];
  });

  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Cập nhật khi props appointments thay đổi
  useEffect(() => {
    if (Array.isArray(appointments)) {
      setLocalAppointments(appointments);
    }
  }, [appointments]);

  // Tải lại lịch khám từ máy chủ backend và đồng bộ vào bộ nhớ
  const refreshAppointments = useCallback(async (isManual = false) => {
    const shouldForce = Boolean(isManual);
    if (localAppointments.length === 0 || shouldForce) {
      setIsLoading(true);
    }
    setLoadError(null); // Xóa ngay trạng thái lỗi cũ khi bắt đầu tải lại
    try {
      await syncAllDataToCache({ criticalOnly: false, force: shouldForce });
      const apps = getAppointments(currentUser?.id, currentUser?.role);
      setLocalAppointments(Array.isArray(apps) ? apps : []);
      setLoadError(null); // Đảm bảo xóa sạch lỗi khi thành công
    } catch (err) {
      console.error('Lỗi làm mới lịch khám:', err);
      setLoadError(err?.message || 'Không thể tải dữ liệu lịch khám từ máy chủ. Vui lòng kiểm tra kết nối.');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, localAppointments.length]);

  // Tự động đồng bộ tươi mới từ máy chủ khi mở không gian làm việc Bác sĩ (chỉ chạy nếu danh sách đang rỗng)
  useEffect(() => {
    if (currentUser?.id && localAppointments.length === 0) {
      refreshAppointments(false);
    }
  }, [currentUser?.id]); // Không đưa refreshAppointments vào dependency để tránh trigger lại liên tục

  // Lắng nghe sự kiện đồng bộ toàn hệ thống: CHỈ đọc từ cache cục bộ, KHÔNG gọi ngược lại syncAllDataToCache
  useEffect(() => {
    const handleSync = () => {
      const apps = getAppointments(currentUser?.id, currentUser?.role);
      if (Array.isArray(apps)) {
        setLocalAppointments(apps);
      }
    };
    window.addEventListener('petcare_appointments_updated', handleSync);
    window.addEventListener('petcare_data_synced', handleSync);
    return () => {
      window.removeEventListener('petcare_appointments_updated', handleSync);
      window.removeEventListener('petcare_data_synced', handleSync);
    };
  }, [currentUser?.id, currentUser?.role]);

  // Lọc ca khám thuộc về bác sĩ (hoặc tất cả nếu là admin)
  const doctorAppointments = useMemo(() => {
    return localAppointments.filter(a => {
      if (currentUser?.role === 'system_admin') return true;
      return a.assignedVetId === currentUser?.id || a.vetId === currentUser?.id;
    });
  }, [localAppointments, currentUser]);

  // Đếm ca chờ xác nhận
  const pendingCount = useMemo(() => {
    return doctorAppointments.filter(a => a.status === 'pending').length;
  }, [doctorAppointments]);

  // Đếm số bệnh nhân độc nhất
  const patientsCount = useMemo(() => {
    const petIds = new Set(doctorAppointments.map(a => a.petId).filter(Boolean));
    return petIds.size;
  }, [doctorAppointments]);

  // Helper lấy ID ca khám từ tham số dạng chuỗi hoặc đối tượng
  const getAppId = (target) => (typeof target === 'object' && target !== null) ? target.id : target;

  // Quản lý trạng thái đang xử lý (In-flight submit protection) & Lỗi thao tác
  const [confirmingAppId, setConfirmingAppId] = useState(null);
  const [startingAppId, setStartingAppId] = useState(null);
  const [cancellingAppId, setCancellingAppId] = useState(null);
  const [actionErrorMap, setActionErrorMap] = useState({}); // { [appId]: { message: string, status?: number, code?: string } }

  // Modals cho quy tắc nghiệp vụ ca hẹn
  const [lateAdmissionItem, setLateAdmissionItem] = useState(null);
  const [noShowItem, setNoShowItem] = useState(null);
  const [rescheduleItem, setRescheduleItem] = useState(null);
  const [rescheduleForm, setRescheduleForm] = useState({ date: '', time: '08:30', note: '' });
  const [rescheduleError, setRescheduleError] = useState('');
  const [isRescheduling, setIsRescheduling] = useState(false);

  // Xử lý xác nhận lịch khám (pending -> confirmed)
  // Truy vết: click -> service -> request backend -> phân quyền -> validation -> ghi dữ liệu
  const handleConfirmAppointment = async (target) => {
    const appId = getAppId(target);
    if (!appId || confirmingAppId === appId) return;

    setConfirmingAppId(appId);
    setActionErrorMap(prev => {
      const copy = { ...prev };
      delete copy[appId];
      return copy;
    });

    try {
      sound?.playClick?.();
      // Gửi duy nhất { status: 'confirmed' }, không gửi kèm assignedVetId để bảo đảm phân quyền chặt chẽ
      if (onUpdateAppointment) {
        await onUpdateAppointment(appId, { status: 'confirmed' });
      } else {
        await updateAppointment(appId, { status: 'confirmed' });
      }
      setLocalAppointments(prev => prev.map(a => a.id === appId ? { ...a, status: 'confirmed' } : a));
      try { sound?.playSuccess?.(); } catch {}
    } catch (err) {
      console.error('Lỗi khi xác nhận lịch khám:', err);
      const msg = err?.status 
        ? `[HTTP ${err.status}] ${err.message || 'Lỗi khi xác nhận lịch khám.'}`
        : (err.message || 'Lỗi khi xác nhận lịch khám.');
      setActionErrorMap(prev => ({
        ...prev,
        [appId]: { message: msg, status: err?.status, code: err?.code }
      }));
    } finally {
      setConfirmingAppId(null);
    }
  };

  // Xử lý thực thi bắt đầu khám
  const executeStartExam = async (appId) => {
    if (!appId || startingAppId === appId) return;
    setStartingAppId(appId);
    setActionErrorMap(prev => {
      const copy = { ...prev };
      delete copy[appId];
      return copy;
    });

    try {
      sound?.playClick?.();
      const updates = {
        status: 'in_progress',
        startedAt: new Date().toISOString()
      };
      if (onUpdateAppointment) {
        await onUpdateAppointment(appId, updates);
      } else {
        await updateAppointment(appId, updates);
      }
      setLocalAppointments(prev => prev.map(a => a.id === appId ? { ...a, ...updates } : a));
      setActiveExamAppId(appId);
      setActiveTab('soap');
      setLateAdmissionItem(null);
      try { sound?.playClick?.(); } catch {}
    } catch (err) {
      console.error('Lỗi khi bắt đầu khám:', err);
      const msg = err?.status 
        ? `[HTTP ${err.status}] ${err.message || 'Lỗi khi bắt đầu khám.'}`
        : (err.message || 'Lỗi khi bắt đầu khám.');
      setActionErrorMap(prev => ({
        ...prev,
        [appId]: { message: msg, status: err?.status, code: err?.code }
      }));
    } finally {
      setStartingAppId(null);
    }
  };

  // Xử lý bắt đầu khám (confirmed -> in_progress và chuyển sang tab SOAP)
  // Nếu ca quá giờ hẹn: Mở modal Tiếp nhận muộn với xác nhận rõ ràng
  const handleStartExam = async (target) => {
    const appId = getAppId(target);
    if (!appId || startingAppId === appId) return;

    const app = localAppointments.find(a => a.id === appId) || (typeof target === 'object' ? target : null);
    const isOverdue = app && (app.status === 'pending' || app.status === 'confirmed') && isPastVnDateTime(app.date, app.time);

    if (isOverdue) {
      setLateAdmissionItem(app);
      return;
    }

    await executeStartExam(appId);
  };

  // Xử lý hủy lịch khám
  const handleCancelAppointment = async (target, reason) => {
    const appId = getAppId(target);
    if (!appId) return;

    try {
      sound?.playClick?.();
      const updates = { 
        status: 'cancelled', 
        cancelReason: reason || 'Bác sĩ hủy lịch hẹn',
        cancelledAt: new Date().toISOString()
      };
      if (onUpdateAppointment) {
        await onUpdateAppointment(appId, updates);
      } else {
        await updateAppointment(appId, updates);
      }
      setLocalAppointments(prev => prev.map(a => a.id === appId ? { ...a, ...updates } : a));
    } catch (err) {
      console.error('Lỗi khi hủy lịch khám:', err);
      const msg = err?.status 
        ? `[HTTP ${err.status}] ${err.message || 'Lỗi khi hủy lịch khám.'}`
        : (err.message || 'Lỗi khi hủy lịch khám.');
      setActionErrorMap(prev => ({
        ...prev,
        [appId]: { message: msg, status: err?.status, code: err?.code }
      }));
    }
  };

  // Xử lý xác nhận khách không đến (No-show)
  const handleConfirmNoShow = async (appId) => {
    if (!appId || cancellingAppId === appId) return;
    setCancellingAppId(appId);
    setActionErrorMap(prev => {
      const copy = { ...prev };
      delete copy[appId];
      return copy;
    });

    try {
      sound?.playClick?.();
      const updates = {
        status: 'cancelled',
        cancelReason: 'Khách không đến (No-show)',
        isNoShow: true,
        cancelledAt: new Date().toISOString()
      };
      if (onUpdateAppointment) {
        await onUpdateAppointment(appId, updates);
      } else {
        await updateAppointment(appId, updates);
      }
      setLocalAppointments(prev => prev.map(a => a.id === appId ? { ...a, ...updates } : a));
      setNoShowItem(null);
      try { sound?.playSuccess?.(); } catch {}
    } catch (err) {
      console.error('Lỗi khi đánh dấu khách không đến:', err);
      const msg = err?.status 
        ? `[HTTP ${err.status}] ${err.message || 'Lỗi khi xử lý.'}`
        : (err.message || 'Lỗi khi xử lý.');
      setActionErrorMap(prev => ({
        ...prev,
        [appId]: { message: msg, status: err?.status, code: err?.code }
      }));
    } finally {
      setCancellingAppId(null);
    }
  };

  // Mở modal Đổi lịch hẹn
  const handleOpenReschedule = (app) => {
    setRescheduleItem(app);
    setRescheduleForm({
      date: app.date || getTodayVnDate(),
      time: app.time || '08:30',
      note: ''
    });
    setRescheduleError('');
  };

  // Xử lý lưu lịch hẹn mới (Reschedule)
  const handleSubmitReschedule = async () => {
    if (!rescheduleItem || !rescheduleForm.date || !rescheduleForm.time) {
      setRescheduleError('Vui lòng chọn ngày và giờ hẹn mới.');
      return;
    }

    setIsRescheduling(true);
    setRescheduleError('');

    try {
      sound?.playClick?.();
      const updates = {
        date: rescheduleForm.date,
        time: rescheduleForm.time,
        status: 'confirmed',
        rescheduleNote: rescheduleForm.note || 'Bác sĩ đổi lịch hẹn theo trao đổi với khách',
        rescheduledAt: new Date().toISOString()
      };

      if (onUpdateAppointment) {
        await onUpdateAppointment(rescheduleItem.id, updates);
      } else {
        await updateAppointment(rescheduleItem.id, updates);
      }

      setLocalAppointments(prev => prev.map(a => a.id === rescheduleItem.id ? { ...a, ...updates } : a));
      setRescheduleItem(null);
      try { sound?.playSuccess?.(); } catch {}
    } catch (err) {
      console.error('Lỗi khi đổi lịch hẹn:', err);
      setRescheduleError(err?.message || 'Không thể đổi lịch hẹn. Vui lòng thử lại.');
    } finally {
      setIsRescheduling(false);
    }
  };

  // Xử lý lưu trữ lịch khám (bác sĩ xóa khỏi danh sách cá nhân)
  const handleArchiveAppointment = async (appId) => {
    try {
      sound?.playClick?.();
      await archiveAppointment(appId);
      await refreshAppointments();
    } catch (err) {
      console.error('Lỗi khi lưu trữ lịch khám:', err);
      throw err;
    }
  };

  // Xử lý khôi phục lịch khám
  const handleUnarchiveAppointment = async (appId) => {
    try {
      sound?.playClick?.();
      await unarchiveAppointment(appId);
      await refreshAppointments();
    } catch (err) {
      console.error('Lỗi khi khôi phục lịch khám:', err);
      throw err;
    }
  };

  // Modal xem chi tiết bệnh án đã chốt (chỉ đọc)
  const [viewingRecordModal, setViewingRecordModal] = useState({
    isOpen: false,
    record: null,
    appointment: null,
    pet: null,
    error: null,
    isLoading: false
  });

  // Handler xem chi tiết bệnh án đã chốt tương ứng appointmentId / medicalRecordId
  // Nghiệp vụ: Chế độ chỉ đọc, tuyệt đối không gửi request cập nhật trạng thái (không đổi status thành in_progress)
  const handleViewMedicalRecord = async (target) => {
    const appId = getAppId(target);
    const app = localAppointments.find(a => a.id === appId) || (typeof target === 'object' ? target : null);
    if (!app && !appId) return;

    sound?.playClick?.();

    const targetPetId = app?.petId || (typeof target === 'object' ? target.petId : null);
    const pet = pets.find(p => p.id === targetPetId) || null;

    // 1. Tìm bệnh án từ cache cục bộ
    let records = [];
    try {
      const cached = getMedicalRecords(currentUser?.id, currentUser?.role);
      if (Array.isArray(cached)) records = cached;
    } catch {}

    let matchedRecord = records.find(r => 
      (appId && r.appointmentId === appId) || 
      (app?.medicalRecordId && r.id === app.medicalRecordId) ||
      (appId && r.id === appId)
    );

    // 2. Nếu chưa có trong cache, fetch từ API backend
    if (!matchedRecord) {
      setViewingRecordModal({
        isOpen: true,
        record: null,
        appointment: app,
        pet,
        error: null,
        isLoading: true
      });

      try {
        const fresh = await apiFetch('/medical_records');
        if (Array.isArray(fresh)) {
          try {
            localStorage.setItem('petcare_medical_records_v1', JSON.stringify(fresh));
          } catch {}
          matchedRecord = fresh.find(r => 
            (appId && r.appointmentId === appId) || 
            (app?.medicalRecordId && r.id === app.medicalRecordId) ||
            (appId && r.id === appId)
          );
        }
      } catch (fetchErr) {
        console.error('Lỗi tải bệnh án từ API:', fetchErr);
      }
    }

    if (!matchedRecord) {
      // Yêu cầu 7: "Nếu thiếu bệnh án liên kết, thông báo rõ; không tự tạo mới hoặc mở nhầm ca."
      const msg = `Ca khám ${appId || app?.id} chưa có hồ sơ bệnh án liên kết trên hệ thống.`;
      setActionErrorMap(prev => ({
        ...prev,
        [appId || app?.id]: { message: msg, code: 'RECORD_NOT_FOUND' }
      }));
      setViewingRecordModal({
        isOpen: true,
        record: null,
        appointment: app,
        pet,
        error: msg,
        isLoading: false
      });
      return;
    }

    // 3. Mở modal xem bệnh án đã chốt ở chế độ chỉ đọc, KHÔNG gửi request cập nhật trạng thái
    setViewingRecordModal({
      isOpen: true,
      record: matchedRecord,
      appointment: app,
      pet,
      error: null,
      isLoading: false
    });
  };

  // Điều hướng mở SOAP trực tiếp
  const handleOpenSoap = (appId, petId, recordId) => {
    sound?.playClick?.();
    if (appId) {
      setActiveExamAppId(appId);
      try {
        localStorage.setItem('petcare_vet_active_exam_id', appId);
      } catch {}
    }
    setActiveTab('soap');
  };

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden antialiased bg-[#EEF4F0] dark:bg-[#121714] text-[#18201D] dark:text-[#F1F5F2]">
      {/* 1. THANH NGANG TRÊN (VET NAVBAR) */}
      <VetNavbar
        activeTab={activeTab}
        theme={theme}
        onToggleTheme={toggleTheme}
        onToggleMobileMenu={() => setIsMobileMenuOpen(prev => !prev)}
        onOpenGlobalSearch={() => {
          setActiveTab('appointments');
        }}
        currentUser={currentUser}
      />

      {/* 2. KHUNG NỘI DUNG: SIDEBAR NỔI DƯỚI HEADER + VÙNG NỘI DUNG TỰ ĐIỀU CHỈNH */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* THANH ĐIỀU HƯỚNG DỌC (SIDEBAR BÁC SĨ NỔI BÊN DƯỚI HEADER) */}
        <VetSidebar
          activeTab={activeTab}
          setActiveTab={(tab) => {
            sound?.playClick?.();
            setActiveTab(tab);
          }}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={handleToggleSidebarCollapse}
          isMobileOpen={isMobileMenuOpen}
          setIsMobileOpen={setIsMobileMenuOpen}
          pendingCount={pendingCount}
          patientsCount={patientsCount}
          currentUser={currentUser}
          onLogout={onLogout}
        />

        {/* Khung nội dung theo tab */}
        <main className="flex-1 min-w-0 h-full overflow-hidden relative">
          {activeTab === 'dashboard' && (
            <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
              <div className="max-w-[1440px] mx-auto">
                <VetDashboardTab
                  appointments={doctorAppointments}
                  pets={pets}
                  onNavigateTab={(tab) => {
                    sound?.playClick?.();
                    setActiveTab(tab);
                  }}
                  onSelectAppointmentForExam={(target) => {
                    handleStartExam(getAppId(target));
                  }}
                  onViewMedicalRecord={handleViewMedicalRecord}
                  onConfirmAppointment={handleConfirmAppointment}
                  onStartExam={handleStartExam}
                  confirmingAppId={confirmingAppId}
                  startingAppId={startingAppId}
                  actionErrorMap={actionErrorMap}
                  onRetryConfirm={handleConfirmAppointment}
                  onOpenLateAdmission={setLateAdmissionItem}
                  onOpenNoShow={setNoShowItem}
                  onOpenReschedule={handleOpenReschedule}
                />
              </div>
            </div>
          )}

          {activeTab === 'appointments' && (
            <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
              <div className="max-w-[1440px] mx-auto">
                <VetAppointmentsTab
                  appointments={doctorAppointments}
                  pets={pets}
                  isLoading={isLoading}
                  loadError={loadError}
                  onRetryLoad={refreshAppointments}
                  onConfirmAppointment={handleConfirmAppointment}
                  onStartExam={handleStartExam}
                  onCancelAppointment={handleCancelAppointment}
                  onArchiveAppointment={handleArchiveAppointment}
                  onUnarchiveAppointment={handleUnarchiveAppointment}
                  onSelectAppointmentForExam={(target) => {
                    handleStartExam(getAppId(target));
                  }}
                  onViewMedicalRecord={handleViewMedicalRecord}
                  confirmingAppId={confirmingAppId}
                  startingAppId={startingAppId}
                  cancellingAppId={cancellingAppId}
                  actionErrorMap={actionErrorMap}
                  onRetryConfirm={handleConfirmAppointment}
                  onOpenLateAdmission={setLateAdmissionItem}
                  onOpenNoShow={setNoShowItem}
                  onOpenReschedule={handleOpenReschedule}
                  currentUser={currentUser}
                />
              </div>
            </div>
          )}

          {activeTab === 'patients' && (
            <div className="h-full overflow-hidden p-4 sm:p-6 lg:p-8">
              <div className="max-w-[1440px] mx-auto h-full">
                <VetPatientsTab
                  pets={pets}
                  appointments={doctorAppointments}
                  currentUser={currentUser}
                  onOpenSoap={handleOpenSoap}
                />
              </div>
            </div>
          )}

          {activeTab === 'soap' && (
            <div className="h-full overflow-hidden p-4 sm:p-6 lg:p-8">
              <div className="max-w-[1440px] mx-auto h-full">
                <VetSoapTab
                  appointments={doctorAppointments}
                  pets={pets}
                  currentUser={currentUser}
                  initialAppointmentId={activeExamAppId}
                  onSelectAppointment={(appId) => setActiveExamAppId(appId)}
                  onAppointmentCompleted={(completedAppId) => {
                    setLocalAppointments(prev => prev.map(a => 
                      a.id === completedAppId ? { ...a, status: 'completed' } : a
                    ));
                  }}
                  onConfirmAppointment={handleConfirmAppointment}
                  onStartExam={(target) => handleStartExam(getAppId(target))}
                  onOpenLateAdmission={setLateAdmissionItem}
                  confirmingAppId={confirmingAppId}
                  startingAppId={startingAppId}
                  actionErrorMap={actionErrorMap}
                />
              </div>
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="h-full overflow-hidden p-4 sm:p-6 lg:p-8">
              <div className="max-w-[1440px] mx-auto h-full">
                <VetScheduleTab
                  appointments={doctorAppointments}
                  currentUser={currentUser}
                  onOpenSoap={handleOpenSoap}
                />
              </div>
            </div>
          )}
        </main>
      </div>

      {/* 3. MODAL XEM CHI TIẾT BỆNH ÁN ĐÃ CHỐT (CHẾ ĐỘ CHỈ ĐỌC) */}
      <MedicalRecordDetailModal
        isOpen={viewingRecordModal.isOpen}
        onClose={() => setViewingRecordModal(prev => ({ ...prev, isOpen: false, error: null }))}
        record={viewingRecordModal.record}
        appointment={viewingRecordModal.appointment}
        pet={viewingRecordModal.pet}
        allAppointments={localAppointments}
        onOpenSoap={handleOpenSoap}
        isLoading={viewingRecordModal.isLoading}
        error={viewingRecordModal.error}
      />

      {/* 4. MODAL TIẾP NHẬN KHÁM MUỘN */}
      {lateAdmissionItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-[#151D2A] border border-amber-300 dark:border-amber-700/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400">
                <Clock className="w-5 h-5 shrink-0" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Tiếp nhận ca khám quá giờ hẹn
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setLateAdmissionItem(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400">Mã ca khám:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{lateAdmissionItem.id}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400">Thú cưng:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {lateAdmissionItem.petName} ({lateAdmissionItem.petType || 'Thú cưng'})
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400">Chủ nuôi:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {lateAdmissionItem.ownerName} • {lateAdmissionItem.phone}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-amber-200/60 dark:border-amber-800/40">
                  <span className="text-slate-500 dark:text-slate-400">Giờ hẹn theo lịch (giữ nguyên):</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {lateAdmissionItem.time} • {lateAdmissionItem.date}
                  </span>
                </div>
                <div className="flex justify-between items-center text-purple-700 dark:text-purple-300 font-medium">
                  <span>Thời gian tiếp nhận thực tế:</span>
                  <span className="font-mono font-bold">{getCurrentVnTime()} • {getTodayVnDate()}</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 text-[11px] leading-relaxed">
                ℹ️ <strong>Quy tắc hệ thống:</strong> Giờ hẹn gốc ({lateAdmissionItem.time}) được bảo toàn nguyên vẹn trong hồ sơ bệnh án. Thời gian tiếp nhận thực tế được ghi nhận vào trường <code className="font-mono font-bold">startedAt</code> và chuyển trạng thái sang <span className="font-semibold">Đang khám</span>.
              </div>

              {actionErrorMap[lateAdmissionItem.id] && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{actionErrorMap[lateAdmissionItem.id].message}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setLateAdmissionItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={startingAppId === lateAdmissionItem.id}
                onClick={() => executeStartExam(lateAdmissionItem.id)}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
              >
                {startingAppId === lateAdmissionItem.id ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang tiếp nhận...</span>
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-4 h-4" />
                    <span>Xác nhận tiếp nhận khám</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL KHÁCH KHÔNG ĐẾN (NO-SHOW) */}
      {noShowItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-[#151D2A] border border-rose-300 dark:border-rose-800/80 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <XCircle className="w-5 h-5 shrink-0" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Xác nhận khách không đến (No-show)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setNoShowItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
              <p>
                Bạn có chắc chắn muốn đánh dấu ca khám lúc <strong>{noShowItem.time}</strong> ngày <strong>{noShowItem.date}</strong> của thú cưng <strong>{noShowItem.petName}</strong> (Chủ nuôi: {noShowItem.ownerName}) là <strong>Khách không đến (No-show)</strong>?
              </p>
              <p className="text-slate-500 dark:text-slate-400 italic">
                * Ca khám sẽ được chuyển sang trạng thái "Đã hủy" với lý do cụ thể và đồng bộ tức thời đến tài khoản của chủ nuôi.
              </p>

              {actionErrorMap[noShowItem.id] && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{actionErrorMap[noShowItem.id].message}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setNoShowItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Bỏ qua
              </button>
              <button
                type="button"
                disabled={cancellingAppId === noShowItem.id}
                onClick={() => handleConfirmNoShow(noShowItem.id)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
              >
                {cancellingAppId === noShowItem.id ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <span>Xác nhận không đến</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL ĐỔI LỊCH HẸN (RESCHEDULE) */}
      {rescheduleItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-[#151D2A] border border-indigo-300 dark:border-indigo-800/80 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <Calendar className="w-5 h-5 shrink-0" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Đổi lịch hẹn khám
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRescheduleItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1">
                <div><span className="text-slate-500">Bệnh nhân:</span> <strong>{rescheduleItem.petName}</strong> ({rescheduleItem.ownerName})</div>
                <div><span className="text-slate-500">Giờ hẹn hiện tại:</span> <span className="font-mono">{rescheduleItem.time} • {rescheduleItem.date}</span></div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Ngày khám mới:</label>
                <input
                  type="date"
                  value={rescheduleForm.date}
                  min={getTodayVnDate()}
                  onChange={(e) => setRescheduleForm(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Khung giờ mới:</label>
                <select
                  value={rescheduleForm.time}
                  onChange={(e) => setRescheduleForm(prev => ({ ...prev, time: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-mono"
                >
                  {[
                    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
                    '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
                  ].map(slot => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Ghi chú đổi lịch:</label>
                <input
                  type="text"
                  placeholder="Lý do đổi lịch (ví dụ: Khách trao đổi dời sang khung giờ mới)"
                  value={rescheduleForm.note}
                  onChange={(e) => setRescheduleForm(prev => ({ ...prev, note: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs"
                />
              </div>

              {rescheduleError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{rescheduleError}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setRescheduleItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isRescheduling}
                onClick={handleSubmitReschedule}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
              >
                {isRescheduling ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <span>Lưu lịch hẹn mới</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export { ClinicOsView } from './ClinicOsView';
export default ClinicWorkspaceView;
