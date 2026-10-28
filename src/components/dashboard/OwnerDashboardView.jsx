import React, { useState, useMemo, useEffect } from 'react';
import { getMonday, getSmartMonthTitle, formatDateKey } from './WeeklyCalendar';
import { getPetsHealthData, updatePetWeight, normalizePetHealthKey } from '../../services/storageService';
import { getTodayVnDate, formatDateVi } from '../../utils/dateUtils.js';
import { useCurrentVnDate } from '../../hooks/useCurrentVnDate';
import { PageContainer, Card, Modal } from '../common/ui';
import { SCHEDULE_TYPES } from '../../constants/mockData';
import { 
  Calendar, 
  Clock, 
  Plus, 
  Stethoscope, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronRight, 
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  Scale, 
  DollarSign, 
  Activity, 
  Bell, 
  User, 
  Sparkles, 
  X, 
  Info, 
  PawPrint, 
  CalendarDays, 
  RotateCcw,
  ShieldCheck,
  FileText
} from 'lucide-react';
import { sound } from '../../services/soundService';

/**
 * Helper: Định dạng tiền tệ VND an toàn
 */
const formatVND = (amt) => {
  const num = Number(amt) || 0;
  return new Intl.NumberFormat('vi-VN').format(num) + ' đ';
};

/**
 * Helper: Chuẩn hóa trạng thái lịch khám
 */
const normalizeAppStatus = (status) => {
  const s = String(status || '').toLowerCase().trim();
  if (s === 'completed' || s === 'hoàn thành' || s === 'đã khám') {
    return { label: 'Đã khám', color: 'text-purple-700 bg-purple-50 border-purple-200 dark:text-purple-300 dark:bg-purple-500/20 dark:border-purple-500/30' };
  }
  if (s === 'in_progress' || s === 'đang khám') {
    return { label: 'Đang khám', color: 'text-cyan-700 bg-cyan-50 border-cyan-200 dark:text-cyan-300 dark:bg-cyan-500/20 dark:border-cyan-500/30' };
  }
  if (s === 'confirmed' || s === 'đã xác nhận' || s === 'đã duyệt') {
    return { label: 'Đã xác nhận', color: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-500/20 dark:border-emerald-500/30' };
  }
  if (s === 'cancelled' || s === 'hủy' || s === 'đã hủy') {
    return { label: 'Đã hủy', color: 'text-slate-600 bg-slate-100 border-slate-200 dark:text-slate-400 dark:bg-slate-800 dark:border-slate-700' };
  }
  return { label: 'Chờ xác nhận', color: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-500/20 dark:border-amber-500/30' };
};

/**
 * Helper: Kiểm tra lịch khám đã qua giờ chưa (theo giờ Việt Nam)
 */
const isAppointmentOverdue = (apt, today) => {
  if (!apt || !apt.date) return false;
  const s = String(apt.status || '').toLowerCase().trim();
  if (s === 'completed' || s === 'hoàn thành' || s === 'đã khám' || s === 'cancelled' || s === 'hủy' || s === 'đã hủy') {
    return false;
  }
  if (apt.date < today) return true;
  if (apt.date === today && apt.time) {
    try {
      const [h, m] = apt.time.split(':').map(Number);
      const now = new Date();
      const vnNowStr = new Intl.DateTimeFormat('en-GB', { 
        timeZone: 'Asia/Ho_Chi_Minh', 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: false 
      }).format(now);
      const [vnH, vnM] = vnNowStr.split(':').map(Number);
      if (vnH > h || (vnH === h && vnM > m)) return true;
    } catch (_) {}
  }
  return false;
};

/**
 * Tổng quan chăm sóc (Owner Dashboard)
 * Tích hợp dữ liệu thực từ các phân hệ: Việc chăm sóc, Lịch khám, Hồ sơ sức khỏe, Chi tiêu
 */
export const OwnerDashboardView = ({
  pets = [],
  schedules = [],
  appointments = [],
  expenses = [],
  budgets = [],
  medicalRecords = [],
  prescriptions = [],
  currentUser = null,
  onToggleComplete = () => {},
  onOpenAddSchedule = () => {},
  onOpenAddPet = () => {},
  onNavigateTab = () => {},
  onOpenVetBooking = () => {}
}) => {
  // 1. Ngày hôm nay theo Asia/Ho_Chi_Minh
  const todayVn = useCurrentVnDate();
  const currentMonth = todayVn.slice(0, 7); // 'YYYY-MM'

  // 2. Bộ lọc thú cưng ('all' | pet.id)
  const [selectedPetFilter, setSelectedPetFilter] = useState('all');

  // 3. Ngày đang chọn trên lịch tuần
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => getTodayVnDate());

  // 4. Modal xem chi tiết lịch khám
  const [selectedAppointmentDetail, setSelectedAppointmentDetail] = useState(null);

  // 5. Modal ghi nhận cân nặng nhanh
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
  const [weightInputPetId, setWeightInputPetId] = useState('');
  const [weightInputValue, setWeightInputValue] = useState('');
  const [weightInputDate, setWeightInputDate] = useState(() => getTodayVnDate());
  const [weightInputNote, setWeightInputNote] = useState('');
  const [weightInputError, setWeightInputError] = useState(null);
  const [isSavingWeight, setIsSavingWeight] = useState(false);

  // 6. Trạng thái toggle hoàn thành việc chăm sóc
  const [completingTaskId, setCompletingTaskId] = useState(null);

  // 7. Đồng bộ dữ liệu cân nặng từ storageService
  const [healthDataMap, setHealthDataMap] = useState(() => getPetsHealthData());

  useEffect(() => {
    const handleSync = () => {
      setHealthDataMap(getPetsHealthData());
    };
    window.addEventListener('petcare_weight_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('petcare_weight_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // Lấy thú cưng đang chọn nếu lọc đơn lẻ
  const activePet = useMemo(() => {
    if (selectedPetFilter === 'all') return null;
    return pets.find(p => p.id === selectedPetFilter) || null;
  }, [pets, selectedPetFilter]);

  // 8. Quản lý tuần (offset) cho thẻ Lịch chăm sóc
  const [weekOffset, setWeekOffset] = useState(0);

  // 9. Trạng thái thu gọn/mở rộng thông báo
  const [isNotifExpanded, setIsNotifExpanded] = useState(false);

  // Tính Thứ 2 & Chủ nhật của tuần đang xem
  const currentMonday = useMemo(() => {
    const [y, m, d] = todayVn.split('-').map(Number);
    const ref = new Date(y, m - 1, d);
    ref.setDate(ref.getDate() + weekOffset * 7);
    return getMonday(ref);
  }, [todayVn, weekOffset]);

  const currentSunday = useMemo(() => {
    const sun = new Date(currentMonday);
    sun.setDate(currentMonday.getDate() + 6);
    return sun;
  }, [currentMonday]);

  const smartMonthTitle = useMemo(() => {
    return getSmartMonthTitle(currentMonday, currentSunday);
  }, [currentMonday, currentSunday]);

  const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const FULL_DAY_LABELS = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, index) => {
      const d = new Date(currentMonday);
      d.setDate(currentMonday.getDate() + index);
      const dateKey = formatDateKey(d);
      return {
        date: d,
        dateKey,
        dayLabel: DAY_LABELS[index],
        fullDayLabel: FULL_DAY_LABELS[index],
        dateNumber: String(d.getDate()).padStart(2, '0'),
        monthNumber: d.getMonth() + 1,
        isToday: dateKey === todayVn
      };
    });
  }, [currentMonday, todayVn]);

  const scheduleDatesCount = useMemo(() => {
    const countMap = {};
    if (Array.isArray(schedules)) {
      schedules.forEach(s => {
        if (s?.date) {
          if (selectedPetFilter !== 'all' && s.petId !== selectedPetFilter) return;
          countMap[s.date] = (countMap[s.date] || 0) + 1;
        }
      });
    }
    return countMap;
  }, [schedules, selectedPetFilter]);

  const currentSelectedDayInfo = useMemo(() => {
    const found = weekDays.find(w => w.dateKey === selectedCalendarDate);
    if (found) return found;
    const [y, m, dNum] = (selectedCalendarDate || todayVn).split('-').map(Number);
    const d = new Date(y, m - 1, dNum);
    const dayIdx = d.getDay();
    const viIdx = dayIdx === 0 ? 6 : dayIdx - 1;
    return {
      date: d,
      dateKey: selectedCalendarDate,
      dayLabel: DAY_LABELS[viIdx] || 'T2',
      fullDayLabel: FULL_DAY_LABELS[viIdx] || 'Ngày đã chọn',
      dateNumber: String(dNum).padStart(2, '0'),
      monthNumber: m,
      isToday: selectedCalendarDate === todayVn
    };
  }, [weekDays, selectedCalendarDate, todayVn]);

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
    setSelectedCalendarDate(todayVn);
  };

  // =========================================================================
  // BỘ ĐẾM VÀ TÓM TẮT HÀNG TRÊN (METRIC CARDS)
  // =========================================================================

  // 1. Số thú cưng
  const petCountDisplay = useMemo(() => {
    if (selectedPetFilter === 'all') return pets.length;
    return 1;
  }, [pets, selectedPetFilter]);

  // 2. Việc chăm sóc hôm nay (chưa hoàn thành)
  const todayTasks = useMemo(() => {
    return (schedules || []).filter(s => {
      if (!s || !s.date) return false;
      if (s.date !== todayVn) return false;
      if (selectedPetFilter !== 'all' && s.petId !== selectedPetFilter) return false;
      return true;
    });
  }, [schedules, todayVn, selectedPetFilter]);

  const todayUncompletedTasksCount = useMemo(() => {
    return todayTasks.filter(s => !s.completed).length;
  }, [todayTasks]);

  const todayCompletedTasksCount = useMemo(() => {
    return todayTasks.filter(s => Boolean(s.completed)).length;
  }, [todayTasks]);

  // 3. Lịch khám hôm nay
  const todayAppointments = useMemo(() => {
    return (appointments || []).filter(a => {
      if (!a || !a.date) return false;
      if (a.date !== todayVn) return false;
      if (selectedPetFilter !== 'all' && a.petId !== selectedPetFilter) return false;
      const st = String(a.status || '').toLowerCase().trim();
      return st !== 'cancelled' && st !== 'hủy' && st !== 'đã hủy';
    });
  }, [appointments, todayVn, selectedPetFilter]);

  const todayActiveAppointmentsCount = useMemo(() => {
    return todayAppointments.filter(a => {
      const st = String(a.status || '').toLowerCase().trim();
      return st !== 'completed' && st !== 'hoàn thành' && st !== 'đã khám';
    }).length;
  }, [todayAppointments]);

  // 4. Việc chăm sóc quá hạn (ngày < hôm nay và chưa hoàn thành)
  const overdueTasksCount = useMemo(() => {
    return (schedules || []).filter(s => {
      if (!s || !s.date) return false;
      if (s.date >= todayVn) return false;
      if (Boolean(s.completed)) return false;
      if (selectedPetFilter !== 'all' && s.petId !== selectedPetFilter) return false;
      return true;
    }).length;
  }, [schedules, todayVn, selectedPetFilter]);

  // =========================================================================
  // KHỐI A: VIỆC CHĂM SÓC CẦN LÀM THEO NGÀY TRÊN LỊCH TUẦN
  // =========================================================================
  const selectedDateTasks = useMemo(() => {
    return (schedules || []).filter(s => {
      if (!s || !s.date) return false;
      if (s.date !== selectedCalendarDate) return false;
      if (selectedPetFilter !== 'all' && s.petId !== selectedPetFilter) return false;
      return true;
    }).sort((a, b) => (a.time || '23:59').localeCompare(b.time || '23:59'));
  }, [schedules, selectedCalendarDate, selectedPetFilter]);

  // Xử lý tick hoàn thành việc chăm sóc (gọi backend nguyên tử)
  const handleToggleTask = async (task) => {
    if (completingTaskId) return;
    setCompletingTaskId(task.id);
    try {
      sound.playClick();
      await onToggleComplete(task.id, !task.completed);
    } catch (err) {
      console.error('Lỗi khi hoàn thành việc chăm sóc:', err);
    } finally {
      setCompletingTaskId(null);
    }
  };

  // =========================================================================
  // KHỐI B: LỊCH KHÁM SẮP TỚI (TỪ HÔM NAY TRỞ ĐI)
  // =========================================================================
  const upcomingAppointments = useMemo(() => {
    return (appointments || [])
      .filter(a => {
        if (!a || !a.date) return false;
        if (selectedPetFilter !== 'all' && a.petId !== selectedPetFilter) return false;
        const st = String(a.status || '').toLowerCase().trim();
        if (st === 'cancelled' || st === 'hủy' || st === 'đã hủy') return false;
        // Chỉ lấy các ca từ hôm nay trở đi, hoặc ca hôm nay chưa kết thúc
        return a.date >= todayVn;
      })
      .sort((a, b) => {
        const timeA = a.time ? (a.time.length === 5 ? a.time : a.time.padStart(5, '0')) : '09:00';
        const timeB = b.time ? (b.time.length === 5 ? b.time : b.time.padStart(5, '0')) : '09:00';
        return `${a.date} ${timeA}`.localeCompare(`${b.date} ${timeB}`);
      });
  }, [appointments, todayVn, selectedPetFilter]);

  // =========================================================================
  // KHỐI C: TÓM TẮT HỒ SƠ SỨC KHỎE
  // =========================================================================
  const getPetHealthSummary = (pet) => {
    if (!pet) return null;
    const hData = healthDataMap[normalizePetHealthKey(pet.id)] || {};
    const wHistory = Array.isArray(hData.weightHistory) ? [...hData.weightHistory] : [];
    wHistory.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    const latestWRecord = wHistory.length > 0 ? wHistory[wHistory.length - 1] : null;
    const currentWeight = latestWRecord ? latestWRecord.weight : (pet.weight || null);
    const weightDate = latestWRecord ? latestWRecord.date : null;

    // Tìm lịch tiêm chủng gần nhất hoặc sắp tới
    const petVax = (schedules || []).filter(s => s.petId === pet.id && s.type === 'vaccine');
    petVax.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const latestVax = petVax[0] || null;

    // Tìm lịch tẩy giun / ký sinh trùng gần nhất hoặc sắp tới
    const petParasites = (schedules || []).filter(s => s.petId === pet.id && (s.type === 'deworm' || s.type === 'parasite'));
    petParasites.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const latestParasite = petParasites[0] || null;

    return {
      pet,
      currentWeight,
      weightDate,
      weightHistory: wHistory,
      latestVax,
      latestParasite
    };
  };

  const singlePetHealth = useMemo(() => {
    if (selectedPetFilter === 'all') return null;
    const pet = pets.find(p => p.id === selectedPetFilter);
    return getPetHealthSummary(pet);
  }, [pets, selectedPetFilter, healthDataMap, schedules]);

  const allPetsHealthList = useMemo(() => {
    if (selectedPetFilter !== 'all') return [];
    return (pets || []).map(p => getPetHealthSummary(p));
  }, [pets, selectedPetFilter, healthDataMap, schedules]);

  // Xử lý lưu cân nặng thực tế
  const handleSaveWeight = async (e) => {
    e.preventDefault();
    setWeightInputError(null);
    const num = Number(weightInputValue);
    if (!num || isNaN(num) || num <= 0 || num > 150) {
      setWeightInputError('Vui lòng nhập cân nặng hợp lệ (0.1 - 150 kg).');
      return;
    }
    if (!weightInputDate || weightInputDate > todayVn) {
      setWeightInputError('Ngày ghi nhận không được vượt quá hôm nay.');
      return;
    }

    setIsSavingWeight(true);
    try {
      await updatePetWeight(weightInputPetId, num, weightInputDate, weightInputNote);
      setIsWeightModalOpen(false);
      setWeightInputValue('');
      setWeightInputNote('');
      try { sound?.playSuccess?.(); } catch (_) {}
    } catch (err) {
      setWeightInputError(err.message || 'Lỗi khi lưu cân nặng lên máy chủ.');
    } finally {
      setIsSavingWeight(false);
    }
  };

  // =========================================================================
  // KHỐI D: CHI TIÊU THÁNG HIỆN TẠI
  // =========================================================================
  const currentMonthExpenses = useMemo(() => {
    return (expenses || []).filter(e => {
      if (!e || !e.date) return false;
      const eMonth = e.date.slice(0, 7);
      if (eMonth !== currentMonth) return false;

      if (selectedPetFilter === 'all') {
        // Khi chọn Tất cả: tính tất cả khoản chi của từng bé và khoản dùng chung (đúng 1 lần)
        return true;
      } else {
        // Khi chọn 1 bé cụ thể: chỉ tính khoản chi của bé đó, KHÔNG cộng khoản dùng chung
        return e.petId === selectedPetFilter;
      }
    });
  }, [expenses, currentMonth, selectedPetFilter]);

  const totalSpentThisMonth = useMemo(() => {
    return currentMonthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [currentMonthExpenses]);

  const currentMonthBudget = useMemo(() => {
    const targetScope = selectedPetFilter === 'all' ? 'all' : selectedPetFilter;
    return (budgets || []).find(b => b.month === currentMonth && (b.scope === targetScope || b.petId === targetScope)) || null;
  }, [budgets, currentMonth, selectedPetFilter]);

  // =========================================================================
  // KHỐI E: THÔNG BÁO VÀ LỜI NHẮN Y TẾ THỰC TẾ TỪ HỆ THỐNG
  // =========================================================================
  const realSystemNotifications = useMemo(() => {
    const list = [];

    // 1. Nhắc lịch khám hôm nay
    todayAppointments.forEach(a => {
      const p = pets.find(pet => pet.id === a.petId);
      list.push({
        id: `apt_${a.id}`,
        type: 'appointment',
        title: `Lịch khám hôm nay: ${a.service || 'Khám bệnh'}`,
        content: `Bé ${p ? p.name : 'thú cưng'} có lịch hẹn lúc ${a.time || '09:00'} tại ${a.facility || 'Cơ sở thú y'}.`,
        timeStr: a.time || 'Hôm nay',
        badge: 'Lịch khám',
        badgeColor: 'text-cyan-700 bg-cyan-50 border-cyan-200 dark:text-cyan-300 dark:bg-cyan-500/20'
      });
    });

    // 2. Cảnh báo việc chăm sóc quá hạn
    if (overdueTasksCount > 0) {
      list.push({
        id: 'overdue_alert',
        type: 'warning',
        title: `Có ${overdueTasksCount} việc chăm sóc quá hạn`,
        content: 'Bạn có các lịch chăm sóc chưa hoàn thành từ các ngày trước. Vui lòng kiểm tra và xử lý.',
        timeStr: 'Cần xử lý',
        badge: 'Quá hạn',
        badgeColor: 'text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-300 dark:bg-rose-500/20',
        actionTab: 'schedule'
      });
    }

    // 3. Lời dặn thực sự từ bác sĩ (từ hồ sơ bệnh án gần nhất có ghi dặn dò)
    (medicalRecords || [])
      .filter(m => {
        if (selectedPetFilter !== 'all' && m.petId !== selectedPetFilter) return false;
        return m.doctorAdvice || m.treatmentPlan || m.notes;
      })
      .slice(0, 1)
      .forEach(m => {
        const p = pets.find(pet => pet.id === m.petId);
        list.push({
          id: `advice_${m.id}`,
          type: 'doctor_note',
          title: `Dặn dò chuyên môn cho bé ${p ? p.name : ''}`,
          content: m.doctorAdvice || m.treatmentPlan || m.notes,
          timeStr: m.date || 'Hồ sơ bệnh án',
          badge: 'Bác sĩ dặn dò',
          badgeColor: 'text-indigo-700 bg-indigo-50 border-indigo-200 dark:text-indigo-300 dark:bg-indigo-500/20',
          actionTab: 'medical'
        });
      });

    return list;
  }, [todayAppointments, overdueTasksCount, medicalRecords, pets, selectedPetFilter]);

  return (
    <PageContainer id="owner-dashboard-page" className="space-y-5">
      
      {/* =================================================================== */}
      {/* 1. HEADER GỌN: TIÊU ĐỀ, NGÀY VIỆT NAM & BỘ CHỌN THÚ CƯNG            */}
      {/* =================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-0.5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0F172A] dark:text-white">
            Tổng quan
          </h1>
          <p className="text-xs text-[#475569] dark:text-slate-400 mt-0.5">
            Hôm nay là {formatDateVi(todayVn)} (Giờ Việt Nam)
          </p>
        </div>

        {/* Bộ chọn thú cưng bên phải dạng capsule gọn */}
        <div data-testid="pet-selector" className="flex items-center gap-1.5 self-start sm:self-auto bg-white dark:bg-slate-900/90 p-1 rounded-full border border-[#E2E8F0] dark:border-white/10 shadow-xs overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => {
              try { sound?.playPop?.(); } catch (_) {}
              setSelectedPetFilter('all');
            }}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              selectedPetFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-[#475569] hover:text-[#0F172A] hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'
            }`}
          >
            <PawPrint className="w-3.5 h-3.5" />
            <span>Tất cả ({pets.length})</span>
          </button>

          {pets.map(pet => (
            <button
              key={pet.id}
              type="button"
              onClick={() => {
                try { sound?.playPop?.(); } catch (_) {}
                setSelectedPetFilter(pet.id);
              }}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 ${
                selectedPetFilter === pet.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-[#475569] hover:text-[#0F172A] hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'
              }`}
            >
              <span>{pet.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* =================================================================== */}
      {/* 2. 4 THẺ THỐNG KÊ THU GỌN CÙNG CHIỀU CAO, KHOẢNG CÁCH ĐỀU 16-20PX    */}
      {/* =================================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Thẻ 1: Thú cưng */}
        <div data-testid="stat-card-pets" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between h-[104px]">
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
            <span className="font-bold truncate">{selectedPetFilter === 'all' ? 'Tổng số thú cưng' : 'Thú cưng chọn'}</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <PawPrint className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
              {petCountDisplay} <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">bé</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {pets.length > 0 ? 'Hồ sơ đã kích hoạt' : 'Chưa có hồ sơ'}
            </p>
          </div>
        </div>

        {/* Thẻ 2: Chăm sóc hôm nay */}
        <div data-testid="stat-card-tasks" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between h-[104px]">
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
            <span className="font-bold truncate">Chăm sóc hôm nay</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
              {todayUncompletedTasksCount} <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">việc cần làm</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {todayTasks.length > 0 ? `Đã xong ${todayCompletedTasksCount}/${todayTasks.length} việc` : 'Không có việc trong ngày'}
            </p>
          </div>
        </div>

        {/* Thẻ 3: Lịch khám hôm nay */}
        <div
          data-testid="stat-card-appointments"
          onClick={() => onNavigateTab('schedule')}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between h-[104px] cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-500/40 transition-all"
        >
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
            <span className="font-bold truncate">Lịch khám hôm nay</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Stethoscope className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
              {todayActiveAppointmentsCount} <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">ca</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {todayAppointments.length > 0 ? 'Tại cơ sở thú y' : 'Không có lịch khám hôm nay'}
            </p>
          </div>
        </div>

        {/* Thẻ 4: Việc quá hạn */}
        <div
          data-testid="stat-card-overdue"
          onClick={overdueTasksCount > 0 ? () => onNavigateTab('schedule') : undefined}
          className={`bg-white dark:bg-slate-900 border rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between h-[104px] transition-all ${
            overdueTasksCount > 0 
              ? 'border-rose-300 dark:border-rose-500/40 cursor-pointer hover:border-rose-500' 
              : 'border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
            <span className="font-bold truncate">Việc quá hạn</span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              overdueTasksCount > 0 ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}>
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className={`text-xl sm:text-2xl font-black leading-tight ${
              overdueTasksCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
            }`}>
              {overdueTasksCount} <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">việc</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {overdueTasksCount > 0 ? 'Cần kiểm tra xử lý sớm' : 'Không có việc quá hạn'}
            </p>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 3. THANH THAO TÁC NHANH: THANH GỌN NGAY DƯỚI CÁC THẺ THỐNG KÊ        */}
      {/* =================================================================== */}
      <div data-testid="quick-actions-card" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 sm:p-3 shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {/* 1. Thêm thú cưng */}
          <button
            type="button"
            onClick={onOpenAddPet}
            className="h-9 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-xs"
          >
            <PawPrint className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate">Thêm thú cưng</span>
          </button>

          {/* 2. Thêm việc chăm sóc */}
          <button
            type="button"
            onClick={onOpenAddSchedule}
            className="h-9 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-xs"
          >
            <CalendarDays className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate">Thêm việc làm</span>
          </button>

          {/* 3. Ghi cân nặng */}
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setWeightInputPetId(selectedPetFilter !== 'all' ? selectedPetFilter : (pets[0]?.id || ''));
              setWeightInputValue('');
              setWeightInputNote('');
              setWeightInputError(null);
              setWeightInputDate(todayVn);
              setIsWeightModalOpen(true);
            }}
            className="h-9 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-xs"
          >
            <Scale className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="truncate">Ghi cân nặng</span>
          </button>

          {/* 4. Ghi khoản chi */}
          <button
            type="button"
            onClick={() => onNavigateTab('expenses')}
            className="h-9 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-xs"
          >
            <DollarSign className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="truncate">Ghi khoản chi</span>
          </button>

          {/* 5. Đặt lịch khám */}
          <button
            type="button"
            onClick={() => onOpenVetBooking({ petId: selectedPetFilter !== 'all' ? selectedPetFilter : null })}
            className="col-span-2 sm:col-span-1 h-9 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-98"
          >
            <Stethoscope className="w-3.5 h-3.5" />
            <span className="truncate">Đặt lịch khám</span>
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 4. HÀNG NỘI DUNG THỨ NHẤT: 2/3 LỊCH CHĂM SÓC | 1/3 LỊCH KHÁM          */}
      {/* Khoảng cách giữa các khối chuẩn 16-20px (gap-4 sm:gap-5)             */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 items-start">
        
        {/* CỘT TRÁI (2/3): THẺ GỘP LỊCH CHĂM SÓC (LỊCH TUẦN + VIỆC CẦN LÀM) */}
        <Card data-testid="care-schedule-card" padding="p-4 sm:p-5" className="lg:col-span-2 space-y-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          {/* Header duy nhất của thẻ Lịch chăm sóc */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Lịch chăm sóc
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                • {currentSelectedDayInfo.fullDayLabel}, {currentSelectedDayInfo.dateNumber}/{String(currentSelectedDayInfo.monthNumber).padStart(2, '0')}
                {selectedCalendarDate === todayVn ? ' (Hôm nay)' : ''}
              </span>
            </div>

            {/* Điều hướng tuần & Thao tác */}
            <div className="flex items-center gap-1.5 self-start sm:self-auto">
              <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs shadow-xs">
                <button
                  type="button"
                  onClick={handlePrevWeek}
                  title="Tuần trước"
                  className="w-6 h-6 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-200 flex items-center justify-center cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-bold text-slate-900 dark:text-white px-2 whitespace-nowrap">
                  {smartMonthTitle}
                </span>
                <button
                  type="button"
                  onClick={handleNextWeek}
                  title="Tuần sau"
                  className="w-6 h-6 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-200 flex items-center justify-center cursor-pointer transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {(weekOffset !== 0 || selectedCalendarDate !== todayVn) && (
                <button
                  type="button"
                  onClick={handleResetToday}
                  className="px-2 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-500/20 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-200 dark:border-indigo-400/30 flex items-center gap-1 cursor-pointer transition-all shadow-xs"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Hôm nay</span>
                </button>
              )}

              <button
                type="button"
                onClick={onOpenAddSchedule}
                className="px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Thêm việc</span>
              </button>
            </div>
          </div>

          {/* Thanh chọn 7 ngày gọn gàng phía trên */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {weekDays.map(item => {
              const isSelected = item.dateKey === selectedCalendarDate;
              const taskCount = scheduleDatesCount[item.dateKey] || 0;

              return (
                <button
                  key={item.dateKey}
                  data-testid={`day-strip-${item.dateKey}`}
                  type="button"
                  onClick={() => setSelectedCalendarDate(item.dateKey)}
                  className={`py-2 px-1 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer select-none text-center ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25 ring-2 ring-indigo-400/30'
                      : item.isToday
                      ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-300 dark:border-indigo-500/40 text-indigo-700 dark:text-indigo-300 font-bold'
                      : 'bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <span className={`text-[10px] uppercase font-bold ${
                    isSelected ? 'text-indigo-100' : item.isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'
                  }`}>
                    {item.dayLabel}
                  </span>
                  <span className="text-xs sm:text-sm font-extrabold leading-none">
                    {item.dateNumber}
                  </span>
                  {taskCount > 0 ? (
                    <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                      isSelected ? 'bg-white' : 'bg-indigo-500'
                    }`} />
                  ) : (
                    <span className="w-1.5 h-1.5 mt-0.5 opacity-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Danh sách việc của ngày được chọn ngay bên dưới */}
          <div className="pt-1 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 pb-0.5">
              <span className="font-bold text-slate-900 dark:text-white">
                Danh sách việc ngày {formatDateVi(selectedCalendarDate)}
              </span>
              <span className="text-[11px]">
                {selectedDateTasks.length} việc
              </span>
            </div>

            {selectedDateTasks.length > 0 ? (
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
                {selectedDateTasks.map(task => {
                  const taskPet = pets.find(p => p.id === task.petId);
                  const isOverdue = task.date < todayVn && !task.completed;
                  const isCompleting = completingTaskId === task.id;

                  return (
                    <div
                      key={task.id}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        task.completed
                          ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-70'
                          : isOverdue
                          ? 'bg-rose-50/70 dark:bg-rose-500/15 border-rose-200 dark:border-rose-400/30'
                          : 'bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => handleToggleTask(task)}
                          disabled={isCompleting}
                          className={`w-6 h-6 rounded-xl flex items-center justify-center border transition-all shrink-0 cursor-pointer ${
                            task.completed
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'border-slate-300 dark:border-slate-600 hover:border-emerald-500'
                          }`}
                        >
                          {task.completed && <CheckCircle2 className="w-4 h-4 stroke-[3]" />}
                        </button>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-bold truncate ${
                              task.completed 
                                ? 'line-through text-slate-400 dark:text-slate-500' 
                                : 'text-slate-900 dark:text-white'
                            }`}>
                              {task.title}
                            </span>
                            {isOverdue && (
                              <span className="px-1.5 py-0.2 rounded-md bg-rose-100 dark:bg-rose-500/30 text-rose-700 dark:text-rose-200 text-[10px] font-bold">
                                Quá hạn
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                            <span>{taskPet ? taskPet.name : 'Chung'}</span>
                            <span>•</span>
                            <span>{task.time ? `${task.time}` : 'Cả ngày'}</span>
                          </p>
                        </div>
                      </div>

                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0">
                        {SCHEDULE_TYPES[task.type === 'parasite' ? 'deworm' : task.type]?.label || 'Khác'}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-4 text-center text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                <span>Không có việc chăm sóc nào trong ngày này.</span>
                <button
                  type="button"
                  onClick={onOpenAddSchedule}
                  className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm việc</span>
                </button>
              </div>
            )}
          </div>
        </Card>

        {/* CỘT PHẢI (1/3): LỊCH KHÁM (TIÊU ĐỀ TRUNG TÍNH, KHÔNG BỊ KÉO DÀI BỞI THAO TÁC NHANH) */}
        <Card data-testid="upcoming-appointments-card" padding="p-4 sm:p-5" className="lg:col-span-1 space-y-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Lịch khám
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onOpenVetBooking({ petId: selectedPetFilter !== 'all' ? selectedPetFilter : null })}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Đặt khám</span>
            </button>
          </div>

          {upcomingAppointments.length > 0 ? (
            <div className="space-y-2">
              {upcomingAppointments.slice(0, 3).map(apt => {
                const aptPet = pets.find(p => p.id === apt.petId);
                const statusInfo = normalizeAppStatus(apt.status);
                const isOverdue = isAppointmentOverdue(apt, todayVn);

                return (
                  <div
                    key={apt.id}
                    onClick={() => setSelectedAppointmentDetail(apt)}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-slate-700 transition-all cursor-pointer space-y-1.5 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {apt.service || 'Khám tổng quát'}
                          <span className="text-slate-500 dark:text-slate-400 font-normal ml-1">
                            ({aptPet ? aptPet.name : 'Thú cưng'})
                          </span>
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {apt.facility || 'Cơ sở thú y'}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-800">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-indigo-500" />
                        <span>{apt.date} • {apt.time || '09:00'}</span>
                      </span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-0.5">
                        <span>Chi tiết</span>
                        <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                );
              })}

              {upcomingAppointments.length > 3 && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('schedule')}
                  className="w-full py-1.5 text-center text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  Xem tất cả ({upcomingAppointments.length} lịch khám) →
                </button>
              )}
            </div>
          ) : (
            <div className="py-3 text-center text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center gap-2">
              <span>Không có lịch khám nào.</span>
              <button
                type="button"
                onClick={() => onOpenVetBooking({ petId: selectedPetFilter !== 'all' ? selectedPetFilter : null })}
                className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                Đặt khám ngay
              </button>
            </div>
          )}
        </Card>

      </div>

      {/* =================================================================== */}
      {/* 5. HÀNG THÔNG TIN PHỤ: 1/2 TÓM TẮT SỨC KHỎE | 1/2 CHI TIÊU THÁNG    */}
      {/* Khoảng cách giữa các khối chuẩn 16-20px (gap-4 sm:gap-5)             */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 items-start">
        
        {/* KHỐI C: TÓM TẮT HỒ SƠ SỨC KHỎE */}
        <Card data-testid="health-summary-card" padding="p-4 sm:p-5" className="space-y-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Tóm tắt sức khỏe
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('medical')}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>Hồ sơ chi tiết</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* TRƯỜNG HỢP 1: CHỌN MỘT THÚ CƯNG CỤ THỂ */}
          {selectedPetFilter !== 'all' && singlePetHealth && (
            <div className="space-y-3">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
                    Thú cưng: <strong className="text-slate-900 dark:text-white">{singlePetHealth.pet.name}</strong>
                  </span>
                  <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mt-0.5">
                    Cân nặng: {singlePetHealth.currentWeight ? `${singlePetHealth.currentWeight} kg` : 'Chưa cập nhật'}
                    {singlePetHealth.weightDate && (
                      <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1.5">
                        (ngày {singlePetHealth.weightDate})
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setWeightInputPetId(singlePetHealth.pet.id);
                    setWeightInputValue('');
                    setWeightInputDate(todayVn);
                    setWeightInputError(null);
                    setIsWeightModalOpen(true);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 cursor-pointer shadow-xs transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ghi cân nặng</span>
                </button>
              </div>

              {/* Tiêm chủng & Ký sinh trùng */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-0.5">
                  <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block">Tiêm chủng gần nhất:</span>
                  <p className="font-semibold text-slate-900 dark:text-white text-xs">
                    {singlePetHealth.latestVax ? (singlePetHealth.latestVax.title || singlePetHealth.latestVax.vaccineName) : 'Chưa cập nhật'}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {singlePetHealth.latestVax?.date ? `Ngày: ${singlePetHealth.latestVax.date}` : 'Chưa có ngày ghi nhận'}
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-0.5">
                  <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block">Ký sinh trùng gần nhất:</span>
                  <p className="font-semibold text-slate-900 dark:text-white text-xs">
                    {singlePetHealth.latestParasite ? (singlePetHealth.latestParasite.title || singlePetHealth.latestParasite.medicationName) : 'Chưa cập nhật'}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {singlePetHealth.latestParasite?.date ? `Ngày: ${singlePetHealth.latestParasite.date}` : 'Chưa có ngày ghi nhận'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TRƯỜNG HỢP 2: CHỌN TẤT CẢ THÚ CƯNG */}
          {selectedPetFilter === 'all' && (
            <div className="space-y-2">
              {allPetsHealthList.length > 0 ? (
                allPetsHealthList.map(item => (
                  <div
                    key={item.pet.id}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-slate-700 flex items-center justify-between gap-3 shadow-xs transition-all"
                  >
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {item.pet.name} <span className="text-slate-500 dark:text-slate-400 font-normal">({item.pet.breed || (item.pet.species === 'cat' ? 'Mèo' : item.pet.species === 'dog' ? 'Chó' : item.pet.species)})</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Cân nặng: <strong className="text-slate-900 dark:text-white font-bold">{item.currentWeight ? `${item.currentWeight} kg` : 'Chưa cập nhật'}</strong>
                        {item.weightDate ? ` (${item.weightDate})` : ''}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        Tiêm phòng: {item.latestVax ? (item.latestVax.title || item.latestVax.date) : 'Chưa cập nhật'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setWeightInputPetId(item.pet.id);
                        setWeightInputValue('');
                        setWeightInputDate(todayVn);
                        setWeightInputError(null);
                        setIsWeightModalOpen(true);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 font-bold text-[11px] shrink-0 cursor-pointer border border-slate-200 dark:border-slate-700 shadow-xs transition-all"
                    >
                      + Cân nặng
                    </button>
                  </div>
                ))
              ) : (
                <p className="py-3 text-center text-xs text-slate-500 dark:text-slate-400">Chưa có thú cưng trong tài khoản.</p>
              )}
            </div>
          )}
        </Card>

        {/* KHỐI D: CHI TIÊU THÁNG HIỆN TẠI */}
        <Card data-testid="monthly-expenses-card" padding="p-4 sm:p-5" className="space-y-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Chi tiêu tháng {todayVn.slice(5, 7)}/{todayVn.slice(0, 4)}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('expenses')}
              className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>Chi tiết</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-2.5 shadow-xs">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
                  {selectedPetFilter === 'all' 
                    ? 'Tổng chi trong tháng (toàn bộ):' 
                    : `Chi tiêu riêng bé ${activePet ? activePet.name : ''}:`}
                </span>
                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                  {formatVND(totalSpentThisMonth)}
                </div>
              </div>

              <span className="text-[11px] font-mono px-2 py-0.5 rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 shrink-0 font-bold border border-amber-200 dark:border-amber-400/30">
                {currentMonthExpenses.length} khoản chi
              </span>
            </div>

            {/* Ngân sách */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Hạn mức ngân sách:</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {currentMonthBudget ? formatVND(currentMonthBudget.amount) : 'Chưa cập nhật'}
              </span>
            </div>

            {/* Tình trạng ngân sách nếu có */}
            {currentMonthBudget ? (
              (() => {
                const remaining = currentMonthBudget.amount - totalSpentThisMonth;
                const isOver = remaining < 0;
                const pct = Math.min(100, Math.round((totalSpentThisMonth / currentMonthBudget.amount) * 100));

                return (
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className={isOver ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>
                        {isOver ? `Vượt ngân sách: ${formatVND(Math.abs(remaining))}` : `Còn lại: ${formatVND(remaining)}`}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">{pct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${isOver ? 'bg-rose-500' : 'bg-emerald-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })()
            ) : null}
          </div>
        </Card>

      </div>

      {/* =================================================================== */}
      {/* 6. THÔNG BÁO & DẶN DÒ Y TẾ (DÒNG TÓM TẮT CÓ THỂ MỞ RỘNG)            */}
      {/* Khi không có thông báo thì không chiếm một thẻ lớn                   */}
      {/* =================================================================== */}
      {realSystemNotifications.length > 0 && (
        <div data-testid="system-notifications-banner" className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs p-3.5 transition-all">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                Thông báo & Dặn dò y tế ({realSystemNotifications.length})
              </span>
              {!isNotifExpanded && (
                <span className="hidden sm:inline text-xs text-slate-500 dark:text-slate-400 truncate">
                  • {realSystemNotifications[0]?.title}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsNotifExpanded(!isNotifExpanded)}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>{isNotifExpanded ? 'Thu gọn' : 'Xem chi tiết'}</span>
                {isNotifExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {isNotifExpanded && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-3 mt-2.5 border-t border-slate-200 dark:border-slate-800">
              {realSystemNotifications.map(item => (
                <div
                  key={item.id}
                  onClick={() => {
                    if (item.actionTab) onNavigateTab(item.actionTab);
                  }}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-slate-700 text-xs space-y-1 transition-all cursor-pointer shadow-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full border ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{item.timeStr}</span>
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white leading-snug">
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {item.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 1: XEM CHI TIẾT LỊCH KHÁM                                     */}
      {/* =================================================================== */}
      <Modal
        isOpen={Boolean(selectedAppointmentDetail)}
        onClose={() => setSelectedAppointmentDetail(null)}
        title="Chi tiết ca hẹn khám thú y"
        subtitle={selectedAppointmentDetail?.facility || 'Bệnh viện Thú y PetCare'}
        size="md"
        footer={
          <button
            type="button"
            onClick={() => setSelectedAppointmentDetail(null)}
            className="h-10 px-5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-[#1E293B] dark:text-white cursor-pointer"
          >
            Đóng
          </button>
        }
      >
        {selectedAppointmentDetail && (
          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-[#F8FAFC] dark:bg-white/5 border border-[#E2E8F0] dark:border-white/10 space-y-1">
              <span className="text-[11px] text-[#475569] dark:text-slate-400 block font-medium">Dịch vụ:</span>
              <p className="font-bold text-[#0F172A] dark:text-white text-sm">
                {selectedAppointmentDetail.service || 'Khám tổng quát'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-2xl bg-[#F8FAFC] dark:bg-white/5 border border-[#E2E8F0] dark:border-white/10">
                <span className="text-[11px] text-[#475569] dark:text-slate-400 block font-medium">Thú cưng:</span>
                <p className="font-bold text-[#0F172A] dark:text-white mt-0.5">
                  {pets.find(p => p.id === selectedAppointmentDetail.petId)?.name || 'Chưa rõ'}
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-[#F8FAFC] dark:bg-white/5 border border-[#E2E8F0] dark:border-white/10">
                <span className="text-[11px] text-[#475569] dark:text-slate-400 block font-medium">Thời gian:</span>
                <p className="font-bold text-[#0F172A] dark:text-white mt-0.5">
                  {selectedAppointmentDetail.date} • {selectedAppointmentDetail.time || '09:00'}
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-[#F8FAFC] dark:bg-white/5 border border-[#E2E8F0] dark:border-white/10">
              <span className="text-[11px] text-[#475569] dark:text-slate-400 block font-medium">Trạng thái tiếp nhận:</span>
              <div className="mt-1">
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${normalizeAppStatus(selectedAppointmentDetail.status).color}`}>
                  {normalizeAppStatus(selectedAppointmentDetail.status).label}
                </span>
              </div>
            </div>

            {selectedAppointmentDetail.note && (
              <div className="p-3 rounded-2xl bg-[#F8FAFC] dark:bg-white/5 border border-[#E2E8F0] dark:border-white/10">
                <span className="text-[11px] text-[#475569] dark:text-slate-400 block font-medium">Lý do / Ghi chú triệu chứng:</span>
                <p className="text-[#1E293B] dark:text-slate-100 mt-0.5 leading-relaxed">
                  {selectedAppointmentDetail.note}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* =================================================================== */}
      {/* MODAL 2: GHI CÂN NẶNG NHANH CHO THÚ CƯNG                            */}
      {/* =================================================================== */}
      <Modal
        isOpen={isWeightModalOpen}
        onClose={() => setIsWeightModalOpen(false)}
        title="Ghi nhận cân nặng thực tế"
        subtitle="Cập nhật chỉ số cân nặng theo dõi thể trạng cho thú cưng"
        size="md"
        footer={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsWeightModalOpen(false)}
              disabled={isSavingWeight}
              className="h-10 px-4 rounded-xl text-xs font-bold text-[#475569] dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-all duration-300"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleSaveWeight}
              disabled={isSavingWeight}
              className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-500/25 flex items-center gap-2 cursor-pointer transition-all duration-300"
            >
              {isSavingWeight ? 'Đang lưu...' : 'Lưu cân nặng'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleSaveWeight} className="space-y-4 text-xs">
          <div>
            <label className="text-xs font-bold text-[#0F172A] dark:text-white block mb-1">
              Thú cưng:
            </label>
            <select
              value={weightInputPetId}
              onChange={(e) => setWeightInputPetId(e.target.value)}
              className="w-full h-10 px-3 rounded-2xl bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 text-xs font-bold text-[#1E293B] dark:text-white cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-indigo-400"
            >
              {pets.map(p => (
                <option key={p.id} value={p.id} className="text-[#1E293B] bg-white dark:bg-slate-800">{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-[#0F172A] dark:text-white block mb-1">
              Cân nặng (kg) *:
            </label>
            <input
              type="number"
              step="0.05"
              min="0.1"
              max="150"
              required
              value={weightInputValue}
              onChange={(e) => setWeightInputValue(e.target.value)}
              placeholder="Ví dụ: 4.5"
              className="w-full h-10 px-3 rounded-2xl bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 text-xs font-bold text-[#1E293B] dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-400 placeholder:text-[#64748B]"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#0F172A] dark:text-white block mb-1">
              Ngày ghi nhận *:
            </label>
            <input
              type="date"
              max={todayVn}
              required
              value={weightInputDate}
              onChange={(e) => setWeightInputDate(e.target.value)}
              className="w-full h-10 px-3 rounded-2xl bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 text-xs text-[#1E293B] dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#0F172A] dark:text-white block mb-1">
              Ghi chú thể trạng (tùy chọn):
            </label>
            <input
              type="text"
              value={weightInputNote}
              onChange={(e) => setWeightInputNote(e.target.value)}
              placeholder="Ví dụ: Sau ăn sáng, bé khỏe mạnh..."
              className="w-full h-10 px-3 rounded-2xl bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 text-xs text-[#1E293B] dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-400 placeholder:text-[#64748B]"
            />
          </div>

          {weightInputError && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 dark:bg-rose-500/20 dark:border-rose-400/40 text-rose-700 dark:text-rose-200 text-xs font-medium">
              {weightInputError}
            </div>
          )}
        </form>
      </Modal>

    </PageContainer>
  );
};

export default OwnerDashboardView;
