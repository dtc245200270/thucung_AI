import React, { useState, useEffect } from 'react';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { DashboardView } from './components/dashboard/DashboardView';
import { PetListView } from './components/pets/PetListView';
import { PetFormModal } from './components/pets/PetFormModal';
import { PetDetailModal } from './components/pets/PetDetailModal';
import { ScheduleView } from './components/schedule/ScheduleView';
import { ScheduleFormModal } from './components/schedule/ScheduleFormModal';
import { AiScheduleModal } from './components/schedule/AiScheduleModal';
import { AiChatView } from './components/ai/AiChatView';
import { AiNutritionView } from './components/ai/AiNutritionView';
import { AiVisionScannerView } from './components/ai/AiVisionScannerView';
import { ExpenseView } from './components/expenses/ExpenseView';
import { DailyActivityView } from './components/daily/DailyActivityView';
import DailyStreakChecklist from './components/daily/DailyStreakChecklist';
import PetBondingView from './components/bonding/PetBondingView';
import FamilyManagementView from './components/family/FamilyManagementView';
import PetSitterModeModal from './components/family/PetSitterModeModal';
import OmniChannelAlertModal from './components/schedule/OmniChannelAlertModal';
import AiMedicalOcrModal from './components/ai/AiMedicalOcrModal';
import { PrescriptionsView } from './components/medical/PrescriptionsView';
import { MedicalRecordsView } from './components/medical/MedicalRecordsView';
import { WsavaPassportModal } from './components/medical/WsavaPassportModal';
import { PetServicesView } from './components/services/PetServicesView';
import { VetBookingModal } from './components/booking/VetBookingModal';
import { VetAppointmentsAdminView } from './components/booking/VetAppointmentsAdminView';
import { ClinicWorkspaceView, ClinicOsView } from './components/clinic/ClinicWorkspaceView';
import { AdminPortal } from './components/admin/AdminPortal';
import { SettingsModal } from './components/settings/SettingsModal';
import { FamilyGroupSettingsModal } from './components/family/FamilyGroupSettingsModal';
import { GlobalSearchModal } from './components/layout/GlobalSearchModal';
import { LoginPage } from './components/auth/LoginPage';
import { ResetPasswordPage } from './components/auth/ResetPasswordPage';
import { UserProfileModal } from './components/auth/UserProfileModal';
import { FirstLoginPasswordModal } from './components/auth/FirstLoginPasswordModal';
import { GlobalErrorBoundary } from './components/common/GlobalErrorBoundary';
import { AuraBackground } from './components/common/AuraBackground';
import { useTheme } from './context/ThemeContext';
import { ROLES, getCurrentUser, getUsers, syncUsersWithBackend, logout as authLogout } from './services/authService';
import { syncAllDataToCache } from './services/apiService';
import { sound } from './services/soundService';
import { Sparkles, Bot, Stethoscope, ShieldAlert, HeartPulse, Calendar, ArrowRight, PhoneCall, Sun, Moon } from 'lucide-react';

import { 
  getPets, 
  getSchedules, 
  addPet, 
  updatePet, 
  deletePet, 
  addSchedule, 
  updateSchedule, 
  deleteSchedule, 
  toggleScheduleComplete,
  addBatchSchedules,
  getExpenses,
  addExpense,
  updateExpense,
  deleteExpense,
  getBudgets,
  addBudget,
  updateBudget,
  deleteBudget,
  getDailyLogs,
  addDailyLog,
  getPrescriptions,
  addPrescription,
  deletePrescription,
  getFamilyMembers,
  addFamilyMember,
  deleteFamilyMember,
  getDailyHabits,
  toggleDailyHabit,
  addDailyHabit,
  deleteDailyHabit,
  applyOcrAutoPipeline,
  getTheme,
  setTheme,
  getAppointments,
  addAppointment,
  updateAppointment,
  deleteAppointment,
  getMedicalRecords
} from './services/storageService';
import { getTodayVnDate, getVnDateString } from './utils/dateUtils';
import { useCurrentVnDate } from './hooks/useCurrentVnDate';

export default function App() {
  // 1. Authentication State with RBAC (Role-Based Access Control)
  // Xác minh phiên làm việc ngay khi khởi tạo; nếu phiên không hợp lệ hoặc tài khoản bị xóa, tự động thu hồi
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return getCurrentUser();
    } catch { 
      return null; 
    }
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    try {
      return Boolean(getCurrentUser());
    } catch {
      return false;
    }
  });

  // 2. Data States: Khởi tạo trực tiếp từ cache phân tách theo người dùng hiện tại (Instant UI Shell)
  const [pets, setPets] = useState(() => (currentUser ? getPets(currentUser.id, currentUser.role) : []));
  const [isPetsLoading, setIsPetsLoading] = useState(false);
  const [petsLoadError, setPetsLoadError] = useState(null);
  const [schedules, setSchedules] = useState(() => (currentUser ? getSchedules(currentUser.id, currentUser.role) : []));
  const [expenses, setExpenses] = useState(() => (currentUser ? getExpenses(currentUser.id) : []));
  const [budgets, setBudgets] = useState(() => (currentUser ? getBudgets(currentUser.id) : []));
  const [dailyLogs, setDailyLogs] = useState(() => (currentUser ? getDailyLogs(currentUser.id) : []));
  const [prescriptions, setPrescriptions] = useState(() => (currentUser ? getPrescriptions(currentUser.id) : []));
  const [medicalRecords, setMedicalRecords] = useState(() => (currentUser ? getMedicalRecords(currentUser.id, currentUser.role) : []));
  const [familyMembers, setFamilyMembers] = useState(() => (currentUser ? getFamilyMembers(currentUser.id) : []));
  const [dailyHabits, setDailyHabits] = useState(() => (currentUser ? getDailyHabits(currentUser.id) : []));
  const { theme, isDark, toggleTheme, setTheme: setContextTheme } = useTheme();
  const [appointments, setAppointments] = useState(() => (currentUser ? getAppointments(currentUser.id, currentUser.role) : []));
  const [isVetBookingModalOpen, setIsVetBookingModalOpen] = useState(false);
  const [vetBookingInitialData, setVetBookingInitialData] = useState({});

  // Danh sách tài khoản hệ thống tập trung (chỉ dành cho Quản trị viên hệ thống)
  const [systemUsers, setSystemUsers] = useState(() => (currentUser?.role === 'system_admin' ? getUsers() : []));
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState(null);

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileModalTab, setProfileModalTab] = useState('profile');

  const VALID_OWNER_TABS = [
    'dashboard', 
    'pets', 
    'schedule', 
    'bonding', 
    'medical', 
    'expenses', 
    'ai-vision', 
    'family', 
    'prescriptions', 
    'services', 
    'ai-nutrition'
  ];

  // Route state supporting standalone /login page, /reset-password, URL hash (#/pets, etc.) and F5 reload persistence
  const getInitialTab = () => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const params = new URLSearchParams(window.location.search);
      if (path === '/reset-password' || params.has('token')) {
        return 'reset-password';
      }
    }
    const verifiedUser = getCurrentUser();
    if (!verifiedUser) {
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.history.replaceState(null, '', '/login');
      }
      return 'login';
    }
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path === '/login' || window.location.hash === '#/login') {
        return 'login';
      }
      // Check URL hash first (e.g. #/pets, #/schedule, #/bonding, #/medical, #/expenses, #/ai-vision, #/dashboard)
      const rawHash = window.location.hash?.replace(/^#\/?/, '').trim();
      if (rawHash && VALID_OWNER_TABS.includes(rawHash)) {
        return rawHash;
      }
      // Check localStorage for saved tab across page reloads
      const savedTab = localStorage.getItem('petcare_active_tab');
      if (savedTab && VALID_OWNER_TABS.includes(savedTab)) {
        return savedTab;
      }
    }
    return 'dashboard';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [loginInitialMode, setLoginInitialMode] = useState('login');

  // 1. QUẢN LÝ TRẠNG THÁI PHÂN HỆ TOÀN CỤC (GLOBAL PORTAL ROUTER):
  const [currentPortal, setCurrentPortal] = useState(() => {
    try {
      const liveUser = getCurrentUser();
      if (liveUser) {
        if (liveUser.role === ROLES.SYSTEM_ADMIN || liveUser.role === 'system_admin') {
          return localStorage.getItem('petcare_current_portal') || 'ADMIN';
        }
        if (liveUser.role === 'CLINIC_ADMIN' || (liveUser.role === ROLES.VET_DOCTOR && liveUser.vetStatus === 'approved')) {
          return localStorage.getItem('petcare_current_portal') || 'CLINIC';
        }
      }
      return 'OWNER';
    } catch {
      return 'OWNER';
    }
  });

  const [selectedPetId, setSelectedPetId] = useState(() => {
    try {
      return localStorage.getItem('petcare_selected_pet_id') || 'all';
    } catch {
      return 'all';
    }
  });

  const handleSelectPet = (id) => {
    setSelectedPetId(id);
    try {
      if (id) localStorage.setItem('petcare_selected_pet_id', id);
    } catch {}
  };
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth >= 768 && window.innerWidth < 1024) {
        return true; // Tablet defaults to collapsed
      }
      return localStorage.getItem('petcare_sidebar_collapsed') === 'true';
    }
    return false;
  });

  const handleToggleSidebarCollapse = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('petcare_sidebar_collapsed', String(next));
      }
      return next;
    });
  };

  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);

  // Modals state
  const [isAddPetModalOpen, setIsAddPetModalOpen] = useState(false);
  const [petToEdit, setPetToEdit] = useState(null);
  const [viewingPetDetail, setViewingPetDetail] = useState(null);

  const [isAddScheduleModalOpen, setIsAddScheduleModalOpen] = useState(false);
  const [scheduleToEdit, setScheduleToEdit] = useState(null);
  const [scheduleInitialDate, setScheduleInitialDate] = useState(null);
  const [scheduleInitialType, setScheduleInitialType] = useState(null);
  const [scheduleInitialTitle, setScheduleInitialTitle] = useState(null);
  const [scheduleInitialPetId, setScheduleInitialPetId] = useState(null);

  const [isAiScheduleModalOpen, setIsAiScheduleModalOpen] = useState(false);
  const [aiSchedulePetId, setAiSchedulePetId] = useState(null);

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isFamilyGroupModalOpen, setIsFamilyGroupModalOpen] = useState(false);
  const [isWsavaPdfModalOpen, setIsWsavaPdfModalOpen] = useState(false);
  const [aiInitialPrompt, setAiInitialPrompt] = useState(null);
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);

  const [isOmniAlertModalOpen, setIsOmniAlertModalOpen] = useState(false);
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [isPetSitterModalOpen, setIsPetSitterModalOpen] = useState(false);

  // 3. Core Handlers & Data Loaders
  const handleLogout = () => {
    try { sound?.playClick?.(); } catch {}
    setIsAuthenticated(false);
    setCurrentUser(null);
    setCurrentPortal('OWNER');
    // Xóa sạch dữ liệu bộ nhớ để không hiển thị rò rỉ phiên làm việc trước
    setPets([]);
    setSchedules([]);
    setExpenses([]);
    setDailyLogs([]);
    setPrescriptions([]);
    setMedicalRecords([]);
    setFamilyMembers([]);
    setDailyHabits([]);
    setAppointments([]);
    setSystemUsers([]);
    try { authLogout(); } catch {}
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/login');
    }
    setActiveTab('login');
  };

  const loadData = (userId = currentUser?.id, userRole = currentUser?.role) => {
    try {
      const token = typeof localStorage !== 'undefined' ? (localStorage.getItem('petcare_token') || localStorage.getItem('petcare_auth_token')) : null;
      if (!userId || !token) {
        setPets([]);
        setSchedules([]);
        setExpenses([]);
        setBudgets([]);
        setDailyLogs([]);
        setPrescriptions([]);
        setFamilyMembers([]);
        setDailyHabits([]);
        setAppointments([]);
        setMedicalRecords([]);
        setSystemUsers([]);
        return;
      }
      setPets(getPets(userId, userRole));
      setSchedules(getSchedules(userId, userRole));
      setExpenses(getExpenses(userId));
      setBudgets(getBudgets(userId));
      setDailyLogs(getDailyLogs(userId));
      setPrescriptions(getPrescriptions(userId));
      setFamilyMembers(getFamilyMembers(userId));
      setDailyHabits(getDailyHabits(userId));
      setAppointments(getAppointments(userId, userRole));
      setMedicalRecords(getMedicalRecords(userId, userRole));
      if (userRole === 'system_admin') {
        setSystemUsers(getUsers());
      } else {
        setSystemUsers([]);
      }
      const currentTheme = getTheme();
      if (setContextTheme) {
        setContextTheme(currentTheme);
      }
      setTheme(currentTheme);
    } catch (err) {
      console.warn('Error loading data:', err);
    }
  };

  // Đồng bộ toàn bộ dữ liệu ứng dụng & danh sách thú cưng từ máy chủ backend (Stale-While-Revalidate)
  const syncPetsAndAppData = async (force = false) => {
    const token = typeof localStorage !== 'undefined' ? (localStorage.getItem('petcare_token') || localStorage.getItem('petcare_auth_token')) : null;
    const userId = currentUser?.id;
    if (!token || !userId) {
      setIsPetsLoading(false);
      setPetsLoadError(null);
      return;
    }
    // Chỉ hiển thị skeleton loader nếu chưa có dữ liệu nào trong cache hoặc khi người dùng yêu cầu force reload
    const hasExistingPets = Array.isArray(pets) && pets.length > 0;
    if (!hasExistingPets || force) {
      setIsPetsLoading(true);
    }
    setPetsLoadError(null);
    try {
      const res = await syncAllDataToCache({ force, criticalOnly: false });
      if (res === 'skipped') {
        console.warn('[PetCare] Phiên đã đổi hoặc chưa có token, bỏ qua ghi cache.');
      }
      loadData(userId, currentUser?.role);
    } catch (err) {
      console.error('[PetCare] Lỗi đồng bộ dữ liệu thú cưng từ máy chủ:', err);
      // Nếu đã có cache sẵn, không hiển thị banner lỗi đỏ che mất dữ liệu, chỉ báo log
      if (!hasExistingPets || force) {
        setPetsLoadError(err?.message || 'Không thể tải danh sách thú cưng từ máy chủ. Vui lòng thử lại.');
      }
    } finally {
      setIsPetsLoading(false);
    }
  };

  const reloadSystemUsers = async () => {
    const initialToken = localStorage.getItem('petcare_token') || localStorage.getItem('petcare_auth_token');
    const initialUserId = currentUser?.id;
    if (!initialToken || !initialUserId || (currentUser?.role !== 'system_admin' && currentUser?.role !== ROLES.SYSTEM_ADMIN)) {
      setSystemUsers([]);
      setUsersError(null);
      setUsersLoading(false);
      return;
    }
    setUsersLoading(true);
    setUsersError(null);
    try {
      const updated = await syncUsersWithBackend();
      const currentToken = localStorage.getItem('petcare_token') || localStorage.getItem('petcare_auth_token');
      const currentSession = getCurrentUser();
      if (!currentToken || currentToken !== initialToken || currentSession?.id !== initialUserId) {
        setSystemUsers([]);
        return;
      }
      if (Array.isArray(updated) && updated.length > 0) {
        setSystemUsers(updated);
      } else {
        const cached = getUsers();
        if (cached.length > 0) {
          setSystemUsers(cached);
        } else {
          setUsersError('Không thể tải danh sách tài khoản từ máy chủ.');
        }
      }
    } catch (err) {
      console.warn('[PetCare Admin] Không thể đồng bộ từ backend:', err?.message || err);
      const currentToken = localStorage.getItem('petcare_token') || localStorage.getItem('petcare_auth_token');
      const currentSession = getCurrentUser();
      if (currentToken === initialToken && currentSession?.id === initialUserId) {
        setUsersError(err?.message || 'Lỗi kết nối máy chủ khi tải danh sách tài khoản.');
      }
    } finally {
      const currentToken = localStorage.getItem('petcare_token') || localStorage.getItem('petcare_auth_token');
      const currentSession = getCurrentUser();
      if (currentToken === initialToken && currentSession?.id === initialUserId) {
        setUsersLoading(false);
      }
    }
  };

  const handleSwitchPortal = (portal) => {
    try { sound?.playClick?.(); } catch {}
    // Kiểm tra phân quyền khi chuyển cổng:
    if (portal === 'ADMIN' && currentUser?.role !== ROLES.SYSTEM_ADMIN && currentUser?.role !== 'system_admin') {
      console.warn('Unauthorized attempt to switch to ADMIN portal');
      return;
    }
    if (portal === 'CLINIC') {
      const isApprovedVet = (
        currentUser?.role === ROLES.SYSTEM_ADMIN ||
        currentUser?.role === 'system_admin' ||
        currentUser?.role === 'CLINIC_ADMIN' ||
        (currentUser?.role === ROLES.VET_DOCTOR && currentUser?.vetStatus === 'approved')
      );
      if (!isApprovedVet) {
        alert('Tài khoản của bạn chưa được cấp quyền Bác sĩ!');
        return;
      }
    }
    setCurrentPortal(portal);
    try {
      localStorage.setItem('petcare_current_portal', portal);
    } catch (e) {
      // storage safe
    }
  };

  // 4. Effects
  // Lắng nghe sự kiện toàn cục dọn dẹp hoặc đồng bộ dữ liệu
  useEffect(() => {
    const handleDataCleaned = () => {
      loadData(currentUser?.id, currentUser?.role);
      if (currentUser?.role === 'system_admin' || currentUser?.role === ROLES.SYSTEM_ADMIN) {
        reloadSystemUsers();
      }
    };
    const handleDataSynced = () => {
      loadData(currentUser?.id, currentUser?.role);
    };
    window.addEventListener('petcare_data_cleaned', handleDataCleaned);
    window.addEventListener('petcare_data_synced', handleDataSynced);
    window.addEventListener('petcare_pets_updated', handleDataSynced);
    return () => {
      window.removeEventListener('petcare_data_cleaned', handleDataCleaned);
      window.removeEventListener('petcare_data_synced', handleDataSynced);
      window.removeEventListener('petcare_pets_updated', handleDataSynced);
    };
  }, [currentUser?.id, currentUser?.role]);

  useEffect(() => {
    if (currentUser?.id) {
      loadData(currentUser.id, currentUser.role);
      syncPetsAndAppData();
      if (currentUser.role === 'system_admin' || currentUser.role === ROLES.SYSTEM_ADMIN) {
        reloadSystemUsers();
      }
    }
  }, [currentUser?.id, currentUser?.role]);

  // Lắng nghe sự kiện xuất Hộ Chiếu WSAVA toàn cục từ Header hoặc bất kỳ đâu
  useEffect(() => {
    const handleGlobalExportWsava = (event) => {
      try { sound?.playSuccess?.(); } catch {}
      if (event?.detail?.petId) {
        setSelectedPetId(event.detail.petId);
      }
      setIsWsavaPdfModalOpen(true);
    };
    window.addEventListener('petcare_export_wsava_pdf', handleGlobalExportWsava);
    return () => {
      window.removeEventListener('petcare_export_wsava_pdf', handleGlobalExportWsava);
    };
  }, []);

  // Lắng nghe sự kiện thu hồi phiên / khóa tài khoản từ Backend API
  useEffect(() => {
    const handleSessionRevoked = (event) => {
      const code = event?.detail?.code;
      const err = event?.detail?.error || 'Phiên làm việc đã bị thu hồi hoặc tài khoản đã bị khóa. Vui lòng đăng nhập lại.';
      try { sound?.playAlert?.(); } catch {}
      if (code === 'ACCOUNT_LOCKED') {
        alert('Tài khoản của bạn đã bị khóa bởi Quản trị viên!');
      } else if (code === 'USER_NOT_FOUND') {
        alert('Tài khoản không tồn tại hoặc đã bị xóa khỏi hệ thống.');
      } else if (code === 'SESSION_REVOKED') {
        alert('Phiên làm việc đã hết hạn hoặc mật khẩu đã bị đổi. Vui lòng đăng nhập lại.');
      } else {
        alert('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      }
      handleLogout();
    };
    window.addEventListener('petcare_session_revoked', handleSessionRevoked);
    return () => {
      window.removeEventListener('petcare_session_revoked', handleSessionRevoked);
    };
  }, []);

  // Chuyển hướng nếu có yêu cầu mở tab ai-assistant cũ sang mở cửa sổ chat nổi
  useEffect(() => {
    if (activeTab === 'ai-assistant') {
      setActiveTab('dashboard');
      setIsAiDrawerOpen(true);
    }
    if (activeTab === 'clinic-os' || activeTab === 'vet-portal' || activeTab === 'soap') {
      setActiveTab('dashboard');
      handleSwitchPortal('CLINIC');
    }
    if (activeTab === 'admin-portal-switch') {
      setActiveTab('dashboard');
      if (currentUser?.role === 'system_admin' || currentUser?.role === ROLES.SYSTEM_ADMIN) {
        handleSwitchPortal('ADMIN');
      }
    }
  }, [activeTab, currentUser]);

  // Đồng bộ lịch khám hai chiều theo thời gian thực
  useEffect(() => {
    const handleAppointmentsUpdated = () => {
      setAppointments(getAppointments(currentUser?.id, currentUser?.role));
    };
    window.addEventListener('petcare_appointments_updated', handleAppointmentsUpdated);
    window.addEventListener('storage', handleAppointmentsUpdated);
    return () => {
      window.removeEventListener('petcare_appointments_updated', handleAppointmentsUpdated);
      window.removeEventListener('storage', handleAppointmentsUpdated);
    };
  }, [currentUser?.id, currentUser?.role]);

  // Auth Guard Effect: automatically redirect to /login if unauthenticated
  // [SECURITY FIX] Bắt buộc kiểm tra định kỳ trạng thái isLocked thời gian thực:
  // Nếu tài khoản bị khóa trong lúc đang sử dụng, hiển thị thông báo và ép buộc đăng xuất về /login ngay lập tức
  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.history.replaceState(null, '', '/login');
      }
      setActiveTab('login');
      return;
    }

    // Hàm kiểm tra trạng thái khóa tài khoản thời gian thực
    const checkLockStatus = () => {
      // 1. Kiểm tra session hiện tại
      const verifiedUser = getCurrentUser();
      if (!verifiedUser) {
        // Chưa đăng nhập hoặc phiên đã kết thúc
        return false;
      }

      // 2. Đối chiếu trực tiếp với kho users mới nhất
      const allUsers = getUsers();
      if (!Array.isArray(allUsers) || allUsers.length === 0) {
        // Cache rỗng hoặc chưa tải xong: Không suy diễn là tài khoản bị khóa
        return false;
      }

      const currentId = currentUser?.id ? String(currentUser.id).trim() : '';
      const currentEmail = currentUser?.email ? currentUser.email.toLowerCase().trim() : '';
      const liveRecord = allUsers.find(u => 
        (currentId && u.id && String(u.id).trim() === currentId) ||
        (currentEmail && u.email && u.email.toLowerCase().trim() === currentEmail)
      );

      // CHỈ KHI có bằng chứng rõ ràng liveRecord tồn tại và isLocked === true
      const isAccountLocked = Boolean(liveRecord && liveRecord.isLocked === true);

      if (isAccountLocked) {
        try { sound?.playAlert?.(); } catch {}
        alert('Tài khoản của bạn đã bị khóa bởi Quản trị viên!');
        handleLogout();
        return true;
      }
      return false;
    };

    // Kiểm tra ngay lập tức khi effect kích hoạt
    const wasLocked = checkLockStatus();
    if (wasLocked) return;

    if (activeTab === 'login') {
      if (typeof window !== 'undefined' && window.location.pathname === '/login') {
        window.history.replaceState(null, '', '/');
      }
      setActiveTab('dashboard');
    }

    // Bổ sung định kỳ kiểm tra trạng thái currentUser.isLocked thời gian thực (mỗi 5 giây để giảm tải main thread)
    const lockCheckInterval = setInterval(() => {
      checkLockStatus();
    }, 5000);

    // Lắng nghe thay đổi storage từ các tab khác
    const handleStorageEvent = (e) => {
      if (!e.key || e.key === 'petcare_users_v1' || e.key === 'petcare_auth_session' || e.key === 'petcare_is_authenticated') {
        checkLockStatus();
      }
    };

    window.addEventListener('storage', handleStorageEvent);

    return () => {
      clearInterval(lockCheckInterval);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [isAuthenticated, currentUser?.id, currentUser?.email]);

  // Bảo vệ phân hệ: chặn người dùng thường truy cập trái phép cổng ADMIN hoặc CLINIC
  useEffect(() => {
    if (currentPortal === 'ADMIN' && currentUser?.role !== ROLES.SYSTEM_ADMIN && currentUser?.role !== 'system_admin') {
      setCurrentPortal('OWNER');
    }
    if (currentPortal === 'CLINIC') {
      const isApprovedVet = (
        currentUser?.role === ROLES.SYSTEM_ADMIN ||
        currentUser?.role === 'system_admin' ||
        currentUser?.role === 'CLINIC_ADMIN' ||
        (currentUser?.role === ROLES.VET_DOCTOR && currentUser?.vetStatus === 'approved')
      );
      if (!isApprovedVet) {
        setCurrentPortal('OWNER');
      }
    }
  }, [currentPortal, currentUser?.role, currentUser?.vetStatus]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        sound.playPop();
        setIsGlobalSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);


  // Sync activeTab to URL hash (#/pets, etc.) and localStorage
  useEffect(() => {
    if (activeTab && activeTab !== 'login' && activeTab !== 'reset-password') {
      if (typeof window !== 'undefined') {
        const currentHash = window.location.hash?.replace(/^#\/?/, '').trim();
        if (currentHash !== activeTab) {
          window.location.hash = `#/${activeTab}`;
        }
        localStorage.setItem('petcare_active_tab', activeTab);
      }
    }
  }, [activeTab]);

  // Sync with browser URL popstate and hashchange (Back/Forward buttons)
  useEffect(() => {
    const handleUrlChange = () => {
      const path = window.location.pathname;
      const params = new URLSearchParams(window.location.search);
      const rawHash = window.location.hash?.replace(/^#\/?/, '').trim();

      if (path === '/reset-password' || params.has('token')) {
        setActiveTab('reset-password');
      } else if (!isAuthenticated || !currentUser || path === '/login' || window.location.hash === '#/login') {
        setActiveTab('login');
      } else if (rawHash && VALID_OWNER_TABS.includes(rawHash)) {
        setActiveTab(rawHash);
      } else if (activeTab === 'login' || activeTab === 'reset-password') {
        setActiveTab('dashboard');
      }
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, [activeTab, isAuthenticated, currentUser]);

  const handleToggleTheme = () => {
    sound.playClick();
    toggleTheme();
  };

  // Standalone Login Navigation
  const navigateToLogin = () => {
    sound.playClick();
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.history.pushState(null, '', '/login');
    }
    setActiveTab('login');
  };

  const navigateToDashboard = () => {
    sound.playClick();
    if (typeof window !== 'undefined' && window.location.pathname === '/login') {
      window.history.pushState(null, '', '/');
    }
    setActiveTab('dashboard');
  };

  // Auth helpers & Route protection
  const ensureAuth = (actionCallback) => {
    if (!isAuthenticated || !currentUser) {
      sound.playPop();
      navigateToLogin();
      return false;
    }
    if (actionCallback) actionCallback();
    return true;
  };

  useEffect(() => {
    const handleOpenAddPet = () => {
      ensureAuth(() => {
        sound.playClick();
        setPetToEdit(null);
        setIsAddPetModalOpen(true);
      });
    };
    window.addEventListener('petcare_open_add_pet', handleOpenAddPet);
    return () => window.removeEventListener('petcare_open_add_pet', handleOpenAddPet);
  }, [isAuthenticated, currentUser]);

  // Pets Handlers
  const handleSavePet = async (petData, autoSchedule = false) => {
    if (petToEdit) {
      await updatePet({ ...petToEdit, ...petData }, currentUser?.id, currentUser?.role);
    } else {
      await addPet(petData, autoSchedule, currentUser?.id);
    }
    loadData(currentUser?.id, currentUser?.role);
    setPetToEdit(null);
    setIsAddPetModalOpen(false);
    sound.playSuccess();
  };

  const handleDeletePet = async (petId) => {
    const pet = pets.find(p => p.id === petId);
    const petName = pet ? pet.name : 'thú cưng';
    if (window.confirm(`CẢNH BÁO XÓA THÚ CƯNG:\nBạn có chắc chắn muốn xóa bé "${petName}"?\n\nToàn bộ dữ liệu liên quan gồm Lịch chăm sóc, Chi tiêu, Nhật ký, Đơn thuốc, Thói quen và Thông tin thất lạc của bé sẽ bị dọn sạch vĩnh viễn và không thể khôi phục.`)) {
      try {
        await deletePet(petId, currentUser?.id, currentUser?.role);
        loadData(currentUser?.id, currentUser?.role);
        if (selectedPetId === petId) {
          setSelectedPetId('all');
        }
        if (viewingPetDetail?.id === petId) {
          setViewingPetDetail(null);
        }
        sound.playTrash();
      } catch (err) {
        if (err.isAuthFailure) return;
        alert(err.message || 'Lỗi xóa thú cưng');
      }
    }
  };

  const handleUpdatePetWeight = async (petId, newWeight, newHistory) => {
    const pet = pets.find(p => p.id === petId);
    if (pet) {
      try {
        const sortedHistory = Array.isArray(newHistory)
          ? [...newHistory]
              .filter(h => h && h.weight != null && !isNaN(h.weight) && Number(h.weight) > 0)
              .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
          : [];
        const latestRecord = sortedHistory.length > 0 ? sortedHistory[sortedHistory.length - 1] : null;
        const currentWeightVal = latestRecord ? latestRecord.weight : (newWeight || pet.weight);

        const updated = await updatePet({
          ...pet,
          weight: currentWeightVal,
          weightHistory: sortedHistory
        }, currentUser?.id, currentUser?.role);
        await loadData(currentUser?.id, currentUser?.role);
        setViewingPetDetail(updated);
        sound.playSuccess();
        return updated;
      } catch (err) {
        console.error('Lỗi cập nhật cân nặng:', err);
        throw err;
      }
    }
  };

  // Schedules Handlers
  const handleSaveSchedule = async (scheduleData) => {
    try {
      if (scheduleToEdit) {
        await updateSchedule({ ...scheduleToEdit, ...scheduleData }, currentUser?.id, currentUser?.role);
      } else {
        await addSchedule(scheduleData, currentUser?.id);
      }
      loadData(currentUser?.id, currentUser?.role);
      setScheduleToEdit(null);
      setScheduleInitialDate(null);
      setScheduleInitialType(null);
      setScheduleInitialTitle(null);
      sound.playSuccess();
    } catch (err) {
      alert(err.message || 'Lỗi lưu lịch trình');
      throw err;
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    try {
      await deleteSchedule(scheduleId, currentUser?.id, currentUser?.role);
      loadData(currentUser?.id, currentUser?.role);
    } catch (err) {
      if (err.status === 404 || err.isGhostCleaned) {
        loadData(currentUser?.id, currentUser?.role);
      }
      throw err;
    }
  };

  const handleToggleComplete = async (scheduleId) => {
    try {
      await toggleScheduleComplete(scheduleId, currentUser?.id, currentUser?.role);
      loadData(currentUser?.id, currentUser?.role);
      sound.playSuccess();
    } catch (err) {
      alert(err.message || 'Lỗi cập nhật lịch');
      throw err;
    }
  };

  const handleApplyBatchAiSchedule = async (newSchedules) => {
    try {
      await addBatchSchedules(newSchedules, currentUser?.id);
      loadData(currentUser?.id, currentUser?.role);
      sound.playSuccess();
    } catch (err) {
      alert(err.message || 'Lỗi tạo lịch AI');
    }
  };

  // Expenses Handlers
  const handleAddExpense = async (exp) => {
    try {
      await addExpense(exp, currentUser?.id);
      loadData(currentUser?.id, currentUser?.role);
      sound.playSuccess();
    } catch (err) {
      console.error('Lỗi thêm chi tiêu:', err);
      throw err;
    }
  };

  const handleUpdateExpense = async (id, updates) => {
    try {
      await updateExpense(id, updates, currentUser?.id);
      loadData(currentUser?.id, currentUser?.role);
      sound.playSuccess();
    } catch (err) {
      console.error('Lỗi cập nhật chi tiêu:', err);
      throw err;
    }
  };

  const handleDeleteExpense = async (id) => {
    try {
      await deleteExpense(id, currentUser?.id);
      loadData(currentUser?.id, currentUser?.role);
      sound.playTrash();
    } catch (err) {
      alert(err.message || 'Lỗi xóa chi tiêu');
      throw err;
    }
  };

  // Budgets Handlers
  const handleAddBudget = async (budgetData) => {
    try {
      await addBudget(budgetData, currentUser?.id);
      loadData(currentUser?.id, currentUser?.role);
      sound.playSuccess();
    } catch (err) {
      alert(err.message || 'Lỗi thiết lập ngân sách');
      throw err;
    }
  };

  const handleUpdateBudget = async (id, updates) => {
    try {
      await updateBudget(id, updates);
      loadData(currentUser?.id, currentUser?.role);
      sound.playSuccess();
    } catch (err) {
      alert(err.message || 'Lỗi cập nhật ngân sách');
      throw err;
    }
  };

  const handleDeleteBudget = async (id) => {
    try {
      await deleteBudget(id, currentUser?.id);
      loadData(currentUser?.id, currentUser?.role);
      sound.playTrash();
    } catch (err) {
      alert(err.message || 'Lỗi xóa ngân sách');
      throw err;
    }
  };

  // Daily Logs Handler
  const handleAddDailyLog = async (log) => {
    try {
      await addDailyLog(log, currentUser?.id);
      loadData(currentUser?.id, currentUser?.role);
      sound.playSuccess();
    } catch (err) {
      alert(err.message || 'Lỗi thêm nhật ký');
    }
  };

  // Prescriptions Handlers
  const handleAddPrescription = async (pres) => {
    try {
      await addPrescription(pres, currentUser?.id);
      loadData(currentUser?.id, currentUser?.role);
      sound.playSuccess();
    } catch (err) {
      alert(err.message || 'Lỗi thêm đơn thuốc');
    }
  };

  const handleDeletePrescription = async (id) => {
    if (window.confirm('Xóa đơn thuốc này?')) {
      try {
        await deletePrescription(id, currentUser?.id);
        loadData(currentUser?.id, currentUser?.role);
        sound.playTrash();
      } catch (err) {
        alert(err.message || 'Lỗi xóa đơn thuốc');
      }
    }
  };

  // Daily Habits Handlers
  const handleToggleHabit = async (id, memberId) => {
    try {
      await toggleDailyHabit(id, memberId, currentUser?.id);
      loadData(currentUser?.id, currentUser?.role);
    } catch (err) {
      alert(err.message || 'Lỗi cập nhật thói quen');
    }
  };

  const handleAddHabit = async (habitData) => {
    try {
      await addDailyHabit(habitData, currentUser?.id);
      loadData(currentUser?.id, currentUser?.role);
    } catch (err) {
      alert(err.message || 'Lỗi thêm thói quen');
    }
  };

  const handleDeleteHabit = async (id) => {
    try {
      await deleteDailyHabit(id, currentUser?.id);
      loadData(currentUser?.id, currentUser?.role);
    } catch (err) {
      alert(err.message || 'Lỗi xóa thói quen');
    }
  };

  // Family Members Handlers
  const handleAddFamilyMember = async (memberData) => {
    try {
      await addFamilyMember(memberData, currentUser?.id);
      loadData(currentUser?.id, currentUser?.role);
    } catch (err) {
      alert(err.message || 'Lỗi thêm thành viên');
    }
  };

  const handleDeleteFamilyMember = async (id) => {
    if (window.confirm('Xóa thành viên gia đình này?')) {
      sound.playTrash();
      try {
        await deleteFamilyMember(id, currentUser?.id);
        loadData(currentUser?.id, currentUser?.role);
      } catch (err) {
        alert(err.message || 'Lỗi xóa thành viên');
      }
    }
  };

  // Medical OCR Pipeline Handler (Auto push 3-in-1: Schedule + Prescription + Expense)
  const handleOcrComplete = (ocrResult, petId) => {
    try {
      applyOcrAutoPipeline(ocrResult, petId, currentUser?.id);
      loadData(currentUser?.id, currentUser?.role);
    } catch (err) {
      alert(err.message || 'Lỗi xử lý OCR');
    }
  };

  // Omni-Channel Schedule Action (Done / Snooze)
  const handleOmniActionConfirm = async (scheduleId, action) => {
    if (action === 'done') {
      try {
        await toggleScheduleComplete(scheduleId, currentUser?.id, currentUser?.role);
        loadData(currentUser?.id, currentUser?.role);
      } catch (err) {
        alert(err.message || 'Lỗi cập nhật lịch');
      }
    } else if (action === 'snooze') {
      try {
        const sched = schedules.find(s => s.id === scheduleId);
        if (sched) {
          let newTime = '09:00';
          if (sched.time) {
            const [h, m] = sched.time.split(':').map(Number);
            const nextH = ((isNaN(h) ? 8 : h) + 1) % 24;
            const nextM = isNaN(m) ? 0 : m;
            newTime = `${String(nextH).padStart(2, '0')}:${String(nextM).padStart(2, '0')}`;
          }
          await updateSchedule({ ...sched, time: newTime }, currentUser?.id, currentUser?.role);
        }
      } catch (err) {
        alert(err.message || 'Lỗi hoãn lịch');
      }
    }
    loadData(currentUser?.id, currentUser?.role);
  };

  // 2-Way Vet Appointments Handlers
  const handleOpenVetBooking = (initialData = {}) => {
    sound.playPop();
    setVetBookingInitialData(initialData || {});
    setIsVetBookingModalOpen(true);
    // Nếu danh sách pets rỗng và người dùng đã đăng nhập, tự động kích hoạt đồng bộ từ máy chủ
    if (pets.length === 0 && currentUser?.id) {
      syncPetsAndAppData(true);
    }
  };

  const handleSaveAppointment = (savedAppointment) => {
    try {
      if (!savedAppointment) return;
      // VetBookingModal đã lưu trực tiếp qua addActiveAppointment.
      // handleSaveAppointment chỉ là callback nhận kết quả đã lưu và cập nhật state.
      // Tuyệt đối không POST/PUT lại, kể cả khi cache chưa có bản ghi.
      const current = getAppointments(currentUser?.id, currentUser?.role);
      const exists = current.some(a => a.id === savedAppointment.id);
      if (exists) {
        setAppointments(current);
      } else {
        setAppointments([savedAppointment, ...current]);
      }
      return savedAppointment;
    } catch (err) {
      console.error('Lỗi khi cập nhật state lịch hẹn:', err);
    }
  };

  const handleUpdateAppointment = async (id, updates) => {
    try {
      const res = await updateAppointment(id, updates);
      setAppointments(getAppointments(currentUser?.id, currentUser?.role));
      return res;
    } catch (err) {
      console.error('Lỗi khi cập nhật lịch hẹn:', err);
      throw err;
    }
  };

  const handleCancelAppointment = async (id, reason) => {
    try {
      const res = await updateAppointment(id, {
        status: 'cancelled',
        cancelReason: reason || 'Chủ nuôi yêu cầu hủy lịch',
        cancelledAt: new Date().toISOString()
      });
      setAppointments(getAppointments(currentUser?.id, currentUser?.role));
      sound?.playClick?.();
      return res;
    } catch (err) {
      alert(err.message || 'Lỗi khi hủy lịch hẹn.');
      throw err;
    }
  };

  const handleDeleteAppointment = async (id) => {
    try {
      sound?.playTrash?.() || sound?.playClick?.();
      await deleteAppointment(id);
      setAppointments(getAppointments(currentUser?.id, currentUser?.role));
    } catch (err) {
      alert(err.message || 'Lỗi khi xóa lịch hẹn.');
      throw err;
    }
  };

  const pendingAppointmentsCount = (appointments || []).filter(a => a.status === 'Chờ duyệt').length;

  // Filtered schedules for current pet filter
  const displayedSchedules = selectedPetId === 'all'
    ? schedules
    : schedules.filter(s => s.petId === selectedPetId);

  const todayStr = useCurrentVnDate();
  const overdueCount = schedules.filter(s => {
    const sDate = getVnDateString(s.date);
    return sDate && sDate < todayStr && !s.completed;
  }).length;
  const todayCount = schedules.filter(s => {
    const sDate = getVnDateString(s.date);
    return sDate && sDate === todayStr && !s.completed;
  }).length;

  // ROUTE KHÔI PHỤC MẬT KHẨU (RESET PASSWORD):
  if (activeTab === 'reset-password') {
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const currentToken = urlParams ? urlParams.get('token') : '';

    return (
      <GlobalErrorBoundary>
        <AuraBackground>
          <ResetPasswordPage
            token={currentToken}
            onBackToLogin={() => {
              if (typeof window !== 'undefined') {
                window.history.pushState(null, '', '/login');
              }
              setLoginInitialMode('login');
              setActiveTab('login');
            }}
            onRequestNewLink={() => {
              if (typeof window !== 'undefined') {
                window.history.pushState(null, '', '/login');
              }
              setLoginInitialMode('forgot');
              setActiveTab('login');
            }}
          />
        </AuraBackground>
      </GlobalErrorBoundary>
    );
  }

  // PROTECTED ROUTE / AUTH GUARD:
  // Nếu chưa đăng nhập (!isAuthenticated || !currentUser) hoặc đang ở route /login:
  // Chặn Dashboard, ẩn hoàn toàn Sidebar và Header, chỉ hiển thị duy nhất form đăng nhập căn giữa toàn màn hình.
  if (!isAuthenticated || !currentUser || activeTab === 'login') {
    return (
      <GlobalErrorBoundary>
        <AuraBackground>
          <LoginPage
            initialMode={loginInitialMode}
            onLoginSuccess={(user) => {
              setIsAuthenticated(true);
              setCurrentUser(user);
              try {
                localStorage.setItem('petcare_active_user', JSON.stringify(user));
                localStorage.setItem('petcare_current_user', JSON.stringify(user));
                localStorage.setItem('petcare_is_authenticated', 'true');
              } catch {}

              let targetPortal = 'OWNER';
              if (user?.role === ROLES.SYSTEM_ADMIN || user?.role === 'system_admin') {
                targetPortal = 'ADMIN';
              } else if ((user?.role === 'CLINIC_ADMIN' || user?.role === ROLES.VET_DOCTOR) && user?.vetStatus === 'approved') {
                targetPortal = 'CLINIC';
              }
              setCurrentPortal(targetPortal);
              try {
                localStorage.setItem('petcare_current_portal', targetPortal);
              } catch {}

              loadData(user?.id, user?.role);
              syncPetsAndAppData(true);
              navigateToDashboard();
            }}
            onBackToHome={navigateToDashboard}
            showBackHome={false}
          />
        </AuraBackground>
      </GlobalErrorBoundary>
    );
  }

  // ============================================================================
  // GUARD TOÀN CỤC: BẮT BUỘC ĐỔI MẬT KHẨU TẠM THỜI Ở LẦN ĐĂNG NHẬP ĐẦU TIÊN
  // Tài khoản do Admin cấp phải đổi mật khẩu trước khi dùng bất kỳ chức năng nào
  // ============================================================================
  if (isAuthenticated && currentUser?.mustChangePassword) {
    return (
      <GlobalErrorBoundary>
        <AuraBackground>
          <div className="h-screen w-full flex items-center justify-center bg-transparent antialiased font-sans">
            <FirstLoginPasswordModal
              currentUser={currentUser}
              onSuccess={(updatedUser) => {
                setCurrentUser(updatedUser);
                reloadSystemUsers();
              }}
              onLogout={handleLogout}
            />
          </div>
        </AuraBackground>
      </GlobalErrorBoundary>
    );
  }

  // ============================================================================
  // WORKSPACE 0: CỔNG QUẢN TRỊ VIÊN HỆ THỐNG (SYSTEM ADMIN PORTAL)
  // Chỉ dành riêng cho Quản trị viên hệ thống (system_admin)
  // ============================================================================
  if (currentPortal === 'ADMIN' && (currentUser?.role === ROLES.SYSTEM_ADMIN || currentUser?.role === 'system_admin')) {
    return (
      <GlobalErrorBoundary>
        <AuraBackground>
          <div className="h-screen w-full flex flex-col overflow-hidden bg-transparent antialiased font-sans">
            <AdminPortal
              currentUser={currentUser}
              users={systemUsers}
              usersLoading={usersLoading}
              usersError={usersError}
              onRetryLoadUsers={reloadSystemUsers}
              pets={pets}
              schedules={schedules}
              appointments={appointments}
              onUpdateAppointment={handleUpdateAppointment}
              onDeleteAppointment={handleDeleteAppointment}
              onOpenCreateBooking={handleOpenVetBooking}
              onLogout={handleLogout}
              onSwitchPortal={(portal) => handleSwitchPortal(portal)}
              onUsersUpdated={reloadSystemUsers}
              onDataChanged={() => {
                reloadSystemUsers();
                setPets(getPets());
                setSchedules(getSchedules());
                setAppointments(getAppointments());
              }}
            />
          </div>
        </AuraBackground>
      </GlobalErrorBoundary>
    );
  }

  // ============================================================================
  // WORKSPACE 1: CỔNG BÁC SĨ THÚ Y (CLINIC WORKSPACE / CLINIC OS - B2B)
  // Dành riêng cho Bác Sĩ / Quản trị viên phòng khám (CLINIC_ADMIN)
  // ============================================================================
  if (currentPortal === 'CLINIC') {
    const isApprovedVet = (
      currentUser?.role === ROLES.SYSTEM_ADMIN ||
      currentUser?.role === 'system_admin' ||
      currentUser?.role === 'CLINIC_ADMIN' ||
      (currentUser?.role === ROLES.VET_DOCTOR && currentUser?.vetStatus === 'approved')
    );
    if (!isApprovedVet) {
      return (
        <GlobalErrorBoundary>
          <AuraBackground>
            <div className="h-screen w-full flex items-center justify-center p-4">
              <div className="max-w-md w-full p-6 rounded-3xl bg-white/90 dark:bg-[#151622]/95 border border-amber-500/30 text-center shadow-2xl backdrop-blur-2xl">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 text-3xl flex items-center justify-center mx-auto mb-4 border border-amber-500/30">
                  ⏳
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                  Quyền Bác sĩ chưa được kích hoạt
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-6">
                  {currentUser?.vetStatus === 'pending'
                    ? 'Đơn đăng ký hành nghề Bác sĩ của bạn đang chờ Quản trị viên hệ thống xét duyệt.'
                    : currentUser?.vetStatus === 'rejected'
                    ? 'Đơn đăng ký quyền Bác sĩ của bạn đã bị từ chối.'
                    : 'Bạn không có quyền truy cập vào Cổng Bác sĩ / Bệnh viện thú y.'}
                </p>
                <button
                  onClick={() => handleSwitchPortal('OWNER')}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/30 transition-all cursor-pointer"
                >
                  🐾 Quay lại Cổng Chủ Nuôi
                </button>
              </div>
            </div>
          </AuraBackground>
        </GlobalErrorBoundary>
      );
    }

    return (
      <GlobalErrorBoundary>
        <AuraBackground>
          <div className="h-screen w-full flex overflow-hidden antialiased">
            <ClinicWorkspaceView
              pets={pets}
              appointments={appointments}
              onUpdateAppointment={handleUpdateAppointment}
              onNavigateTab={(tab) => {
                try { sound?.playClick?.(); } catch {}
                if (tab === 'dashboard' || tab === 'pets' || tab === 'schedule' || tab === 'medical') {
                  setCurrentPortal('OWNER');
                  setActiveTab(tab);
                }
              }}
              onBack={() => setCurrentPortal('OWNER')}
              onBackToOwnerPortal={() => setCurrentPortal('OWNER')}
              onSwitchPortal={(portal) => handleSwitchPortal(portal)}
              onLogout={handleLogout}
              currentUser={currentUser}
            />

            {/* User Profile Modal */}
            <UserProfileModal
              isOpen={isProfileModalOpen}
              onClose={() => setIsProfileModalOpen(false)}
              currentUser={currentUser}
              initialTab={profileModalTab}
              onUserUpdated={(updatedUser) => {
                setCurrentUser(updatedUser);
              }}
            />
          </div>
        </AuraBackground>
      </GlobalErrorBoundary>
    );
  }

  return (
    <GlobalErrorBoundary>
      <AuraBackground>
        <div className="h-screen w-full flex flex-col overflow-hidden antialiased bg-transparent text-slate-800 dark:text-white">
          {/* Top Header: 64px, Logo on left, Centered Pill Menu, Capsule utilities on right */}
          <Navbar
            pets={pets}
            schedules={schedules}
            activeTab={activeTab}
            setActiveTab={(tab) => {
              sound.playClick();
              if (tab === 'clinic-os' || tab === 'vet-portal') {
                setCurrentPortal('CLINIC');
                return;
              }
              if (!currentUser && (tab === 'pets' || tab === 'schedule' || tab === 'family')) {
                navigateToLogin();
                return;
              }
              if (window.location.pathname === '/login') {
                window.history.pushState(null, '', '/');
              }
              setActiveTab(tab);
            }}
            theme={theme}
            onToggleTheme={handleToggleTheme}
            onToggleComplete={handleToggleComplete}
            onOpenGlobalSearch={() => {
              sound.playPop();
              setIsGlobalSearchOpen(true);
            }}
            onToggleMobileMenu={() => setIsMobileMenuOpen(prev => !prev)}
          />

          {/* Under-header Layout: Centered Main View */}
          <div className="flex-1 min-w-0 flex overflow-hidden">
            {/* Mobile Sidebar Drawer (Off-canvas) */}
            <Sidebar
              activeTab={activeTab}
              setActiveTab={(tab) => {
                sound.playClick();
                if (tab === 'clinic-os' || tab === 'vet-portal') {
                  setCurrentPortal('CLINIC');
                  return;
                }
                if (!currentUser && (tab === 'pets' || tab === 'schedule' || tab === 'family')) {
                  navigateToLogin();
                  return;
                }
                if (window.location.pathname === '/login') {
                  window.history.pushState(null, '', '/');
                }
                setActiveTab(tab);
              }}
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={handleToggleSidebarCollapse}
              isMobileOpen={isMobileMenuOpen}
              setIsMobileOpen={setIsMobileMenuOpen}
              overdueCount={overdueCount}
              todayCount={todayCount}
              pendingAppointmentsCount={pendingAppointmentsCount}
              currentUser={currentUser}
              onOpenProfileModal={(tab = 'profile') => {
                sound.playClick();
                setProfileModalTab(tab);
                setIsProfileModalOpen(true);
              }}
              onLogout={handleLogout}
              onSwitchPortal={(portal) => handleSwitchPortal(portal)}
            />

            {/* 2. Main Scrollable Content Area: max-w-7xl tràn đều toàn màn hình, pt-[100px] tránh bị navbar che */}
            <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-[100px] pb-6 h-full overflow-y-auto overflow-x-hidden custom-scrollbar">
          
          {activeTab === 'dashboard' && (
            <DashboardView
              pets={pets}
              schedules={schedules}
              displayedSchedules={displayedSchedules}
              appointments={appointments}
              expenses={expenses}
              budgets={budgets}
              medicalRecords={medicalRecords}
              prescriptions={prescriptions}
              currentUser={currentUser}
              onToggleComplete={handleToggleComplete}
              onOpenAddSchedule={() => {
                ensureAuth(() => {
                  sound.playClick();
                  setScheduleToEdit(null);
                  setScheduleInitialDate(null);
                  setScheduleInitialType(null);
                  setScheduleInitialTitle(null);
                  setIsAddScheduleModalOpen(true);
                });
              }}
              onOpenAddPet={() => {
                ensureAuth(() => {
                  sound.playClick();
                  setPetToEdit(null);
                  setIsAddPetModalOpen(true);
                });
              }}
              onOpenAiSchedule={() => {
                sound.playPop();
                setAiSchedulePetId(null);
                setIsAiScheduleModalOpen(true);
              }}
              onSelectPet={(petId) => {
                sound.playClick();
                const p = pets.find(item => item.id === petId);
                if (p) setViewingPetDetail(p);
              }}
              onNavigateTab={(tab) => {
                sound.playClick();
                setActiveTab(tab);
              }}
              onAskAiPrompt={(prompt) => {
                sound.playPop();
                setAiInitialPrompt(prompt);
                setIsAiDrawerOpen(true);
              }}
              onOpenVetBooking={handleOpenVetBooking}
            />
          )}

          {activeTab === 'pets' && (
            <PetListView
              pets={pets}
              petsLoading={isPetsLoading}
              petsError={petsLoadError}
              onRetryLoadPets={() => syncPetsAndAppData(true)}
              onOpenAddPet={() => {
                ensureAuth(() => {
                  sound.playClick();
                  setPetToEdit(null);
                  setIsAddPetModalOpen(true);
                });
              }}
              onOpenEditPet={(pet) => {
                sound.playClick();
                setPetToEdit(pet);
                setIsAddPetModalOpen(true);
              }}
              onDeletePet={handleDeletePet}
              onViewPetDetail={(pet) => {
                sound.playPop();
                setViewingPetDetail(pet);
              }}
              onOpenAiScheduleForPet={(pet) => {
                sound.playPop();
                setAiSchedulePetId(pet.id);
                setIsAiScheduleModalOpen(true);
              }}
              onOpenVetBooking={handleOpenVetBooking}
            />
          )}

          {activeTab === 'schedule' && (
            <ScheduleView
              schedules={schedules}
              appointments={appointments}
              pets={pets}
              selectedPetId={selectedPetId}
              onSelectPet={setSelectedPetId}
              onToggleComplete={handleToggleComplete}
              onOpenAddSchedule={(date, type, title, petId) => {
                ensureAuth(() => {
                  sound.playClick();
                  setScheduleToEdit(null);
                  setScheduleInitialDate(date);
                  setScheduleInitialType(type || null);
                  setScheduleInitialTitle(title || null);
                  setScheduleInitialPetId(petId || null);
                  setIsAddScheduleModalOpen(true);
                });
              }}
              onOpenEditSchedule={(sch) => {
                sound.playClick();
                setScheduleToEdit(sch);
                setIsAddScheduleModalOpen(true);
              }}
              onDeleteSchedule={handleDeleteSchedule}
              onCancelAppointment={handleCancelAppointment}
              onUpdateAppointment={handleUpdateAppointment}
              onOpenVetBooking={handleOpenVetBooking}
              currentUser={currentUser}
              onReloadData={() => loadData(currentUser?.id, currentUser?.role)}
            />
          )}

          {activeTab === 'bonding' && (
            <PetBondingView pets={pets} currentUser={currentUser} />
          )}

          {activeTab === 'daily' && (
            <div className="space-y-6">
              <DailyStreakChecklist
                habits={dailyHabits}
                pets={pets}
                familyMembers={familyMembers}
                currentMemberId="fam-1"
                onToggleHabit={handleToggleHabit}
                onAddHabit={handleAddHabit}
                onDeleteHabit={handleDeleteHabit}
              />
              <DailyActivityView
                dailyLogs={dailyLogs}
                pets={pets}
                onAddDailyLog={handleAddDailyLog}
              />
            </div>
          )}

          {activeTab === 'family' && (
            <FamilyManagementView
              familyMembers={familyMembers}
              habits={dailyHabits}
              pets={pets}
              appointments={appointments}
              onAddMember={handleAddFamilyMember}
              onDeleteMember={handleDeleteFamilyMember}
              onOpenPetSitterModal={() => setIsPetSitterModalOpen(true)}
            />
          )}

          {activeTab === 'ocr' && (
            <div className="space-y-6">
              <AiMedicalOcrModal
                isModal={false}
                pets={pets}
                onOcrComplete={handleOcrComplete}
              />
            </div>
          )}

          {activeTab === 'ai-vision' && (
            <AiVisionScannerView
              pets={pets}
              currentUser={currentUser}
              onOpenAddSchedule={(type) => {
                sound.playPop();
                setScheduleToEdit(null);
                setScheduleInitialType(type || 'vet');
                setScheduleInitialTitle('Khám thú y kiểm tra da liễu & mắt');
                setIsAddScheduleModalOpen(true);
              }}
              onOpenVetBooking={handleOpenVetBooking}
            />
          )}

          {activeTab === 'ai-nutrition' && (
            <AiNutritionView pets={pets} />
          )}

          {activeTab === 'expenses' && (
            <ExpenseView
              expenses={expenses}
              pets={pets}
              budgets={budgets}
              onAddExpense={handleAddExpense}
              onUpdateExpense={handleUpdateExpense}
              onDeleteExpense={handleDeleteExpense}
              onAddBudget={handleAddBudget}
              onUpdateBudget={handleUpdateBudget}
              onDeleteBudget={handleDeleteBudget}
              currentUser={currentUser}
              onReloadData={() => loadData(currentUser?.id, currentUser?.role)}
            />
          )}

          {activeTab === 'prescriptions' && (
            <PrescriptionsView
              prescriptions={prescriptions}
              pets={pets}
              onAddPrescription={handleAddPrescription}
              onDeletePrescription={handleDeletePrescription}
              selectedPetId={selectedPetId}
              onSelectPet={handleSelectPet}
            />
          )}

          {activeTab === 'medical' && (
            <MedicalRecordsView 
              pets={pets} 
              schedules={schedules} 
              medicalRecords={medicalRecords}
              prescriptions={prescriptions}
              appointments={appointments}
              currentUser={currentUser}
              selectedPetId={selectedPetId !== 'all' ? selectedPetId : null}
              onSelectPet={handleSelectPet}
              onExportPdf={(petId) => {
                try { sound?.playSuccess?.(); } catch {}
                if (petId) handleSelectPet(petId);
                setIsWsavaPdfModalOpen(true);
              }}
            />
          )}

          {activeTab === 'services' && (
            <PetServicesView />
          )}

            </main>
          </div>

      {/* ALL MODALS */}
      <PetFormModal
        isOpen={isAddPetModalOpen}
        onClose={() => {
          setIsAddPetModalOpen(false);
          setPetToEdit(null);
        }}
        onSave={handleSavePet}
        petToEdit={petToEdit}
      />

      <PetDetailModal
        isOpen={Boolean(viewingPetDetail)}
        onClose={() => setViewingPetDetail(null)}
        pet={viewingPetDetail}
        schedules={schedules}
        onUpdatePetWeight={handleUpdatePetWeight}
        onOpenAiScheduleForPet={(pet) => {
          setAiSchedulePetId(pet.id);
          setIsAiScheduleModalOpen(true);
        }}
      />

      <ScheduleFormModal
        isOpen={isAddScheduleModalOpen}
        onClose={() => {
          setIsAddScheduleModalOpen(false);
          setScheduleToEdit(null);
          setScheduleInitialDate(null);
          setScheduleInitialType(null);
          setScheduleInitialTitle(null);
          setScheduleInitialPetId(null);
        }}
        onSave={handleSaveSchedule}
        pets={pets}
        scheduleToEdit={scheduleToEdit}
        initialDate={scheduleInitialDate}
        initialType={scheduleInitialType}
        initialTitle={scheduleInitialTitle}
        initialPetId={scheduleInitialPetId}
        onOpenVetBooking={(opts) => {
          setBookingInitialPetId(opts?.petId || null);
          setIsVetBookingModalOpen(true);
        }}
      />

      <AiScheduleModal
        isOpen={isAiScheduleModalOpen}
        onClose={() => {
          setIsAiScheduleModalOpen(false);
          setAiSchedulePetId(null);
        }}
        pets={pets}
        initialPetId={aiSchedulePetId}
        onApplyCarePlan={handleApplyBatchAiSchedule}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        currentUser={currentUser}
        onDataChanged={() => loadData(currentUser?.id, currentUser?.role)}
      />

      <GlobalSearchModal
        isOpen={isGlobalSearchOpen}
        onClose={() => setIsGlobalSearchOpen(false)}
        pets={pets}
        schedules={schedules}
        expenses={expenses}
        prescriptions={prescriptions}
        onNavigateTab={(tab) => {
          sound.playClick();
          setActiveTab(tab);
        }}
        onSelectPet={(id) => {
          sound.playClick();
          setSelectedPetId(id);
        }}
      />

      {/* 5 NEW PILLARS MODALS */}
      <OmniChannelAlertModal
        isOpen={isOmniAlertModalOpen}
        onClose={() => setIsOmniAlertModalOpen(false)}
        schedules={displayedSchedules}
        onActionConfirm={handleOmniActionConfirm}
      />

      <AiMedicalOcrModal
        isOpen={isOcrModalOpen}
        onClose={() => setIsOcrModalOpen(false)}
        pets={pets}
        onOcrComplete={handleOcrComplete}
      />

      <PetSitterModeModal
        isOpen={isPetSitterModalOpen}
        onClose={() => setIsPetSitterModalOpen(false)}
        pets={pets}
        prescriptions={prescriptions}
      />

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={currentUser}
        initialTab={profileModalTab}
        onUserUpdated={(updatedUser) => {
          setCurrentUser(updatedUser);
        }}
      />

      {/* CỬA SỔ CHAT NỔI THÔNG MINH DR. PAW AI (CYBERPUNK FLOATING WIDGET DRAWER) */}
      <AiChatView
        key={currentUser?.id || 'guest'}
        pets={pets}
        activePetContextId={selectedPetId !== 'all' ? selectedPetId : null}
        onOpenSettings={() => {
          sound.playClick();
          setIsSettingsModalOpen(true);
        }}
        initialPrompt={aiInitialPrompt}
        isOpen={isAiDrawerOpen}
        onToggleOpen={setIsAiDrawerOpen}
        onOpenAddSchedule={(type, title) => {
          sound.playPop();
          setScheduleToEdit(null);
          setIsAddScheduleModalOpen(true);
        }}
      />

      {/* 2-Way Vet Appointments Booking Modal */}
      <VetBookingModal
        isOpen={isVetBookingModalOpen}
        onClose={() => {
          setIsVetBookingModalOpen(false);
          setVetBookingInitialData({});
        }}
        pets={pets}
        petsLoading={isPetsLoading}
        petsError={petsLoadError}
        onRetryLoadPets={() => syncPetsAndAppData(true)}
        initialPetId={vetBookingInitialData.petId}
        initialService={vetBookingInitialData.service}
        initialNote={vetBookingInitialData.note}
        initialFacility={vetBookingInitialData.facility}
        initialIsAiVision={Boolean(vetBookingInitialData.isAiVision)}
        initialAiVisionPetId={vetBookingInitialData.aiVisionPetId}
        onBookingSuccess={handleSaveAppointment}
        users={systemUsers}
      />

      {/* Modal Cài đặt nhóm Gia đình cùng chăm sóc */}
      <FamilyGroupSettingsModal
        isOpen={isFamilyGroupModalOpen}
        onClose={() => setIsFamilyGroupModalOpen(false)}
        familyMembers={familyMembers}
        onAddMember={handleAddFamilyMember}
        onDeleteMember={handleDeleteFamilyMember}
      />

      {/* Xuất hồ sơ sức khỏe PDF Toàn Cục */}
      <WsavaPassportModal
        isOpen={isWsavaPdfModalOpen}
        onClose={() => setIsWsavaPdfModalOpen(false)}
        pets={pets}
        selectedPetId={selectedPetId}
        schedules={schedules}
        medicalRecords={medicalRecords}
        prescriptions={prescriptions}
        currentUser={currentUser}
      />

    </div>
    </AuraBackground>
    </GlobalErrorBoundary>
  );
}
