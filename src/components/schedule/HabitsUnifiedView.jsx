import React, { useState, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { 
  Flame, 
  CheckCircle2, 
  Circle, 
  Plus, 
  Trash2, 
  Edit3, 
  Clock, 
  Repeat, 
  MapPin, 
  Calendar, 
  RefreshCw, 
  Sparkles, 
  Sun, 
  Utensils, 
  Moon, 
  AlertCircle,
  Home,
  Check,
  Award,
  PawPrint
} from 'lucide-react';
import { sound } from '../../services/soundService';
import { updatePetWeight, normalizePetHealthKey } from '../../services/storageService';
import { getTodayVnDate } from '../../utils/dateUtils.js';

// 1. KHAI BÁO STATE DANH SÁCH CÔNG VIỆC BAN ĐẦU (Rỗng, chờ dữ liệu thật)
export const INITIAL_HABIT_TASKS = [];

export default function HabitsUnifiedView({
  pets = [],
  homeRoutinesList = [],
  setHomeRoutinesList = () => {},
  selectedRoutinePetId = '',
  setSelectedRoutinePetId = () => {},
  petsHealthData = {},
  setPetsHealthData = () => {},
  onOpenAddSchedule = () => {},
  onOpenEditSchedule = () => {},
  onDeleteSchedule = () => {},
  onResetHomeRoutines = () => {},
  familyMembers = [],
  currentMemberId = 'fam-1',
  todayStr = getTodayVnDate()
}) {
  // Bộ lọc trạng thái & ca trong ngày
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL' | 'TODAY' | 'UPCOMING' | 'OVERDUE' | 'COMPLETED'
  const [timeFilter, setTimeFilter] = useState('ALL');     // 'ALL' | 'MORNING' | 'NOON' | 'EVENING'

  // Bé thú cưng đang chọn
  const safePets = pets && pets.length > 0 ? pets : [];
  const currentPet = safePets.find(p => 
    p.id === selectedRoutinePetId || 
    p.altId === selectedRoutinePetId || 
    String(p.name).toLowerCase() === String(selectedRoutinePetId).toLowerCase()
  ) || safePets[0] || null;

  // Trạng thái cân nặng inline
  const [isEditingWeight, setIsEditingWeight] = useState(false);
  const activePetKey = currentPet ? normalizePetHealthKey(currentPet.id) : null;
  const activePetWeightVal = activePetKey ? (petsHealthData?.[activePetKey]?.weight || '') : '';
  const [currentWeightInput, setCurrentWeightInput] = useState(String(activePetWeightVal));

  useEffect(() => {
    setCurrentWeightInput(String(activePetWeightVal));
  }, [activePetWeightVal, selectedRoutinePetId]);

  // 1. STATE DANH SÁCH CÔNG VIỆC TẠI NHÀ (QUẢN LÝ REACTIVE & PERSISTENT)
  const [tasks, setTasks] = useState(() => {
    try {
      const stored = localStorage.getItem('petcare_home_routines');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Chuẩn hóa và làm sạch triệt để chuỗi note nếu từng bị lặp
          return parsed.map(t => {
            let cleanNote = t.note || t.notes || '';
            return {
              ...t,
              note: cleanNote,
              notes: cleanNote,
              category: t.category || (
                t.type === 'deworm' || t.type === 'parasite' ? 'Tẩy giun / Phòng ký sinh trùng' :
                t.type === 'medicine' ? 'Uống thuốc / Điều trị' :
                t.type === 'feeding' ? 'Ăn uống' :
                t.type === 'exercise' ? 'Vận động / Vui chơi' :
                t.type === 'vet' ? 'Nhắc khám / Tái khám' :
                t.type === 'vaccine' ? 'Tiêm phòng' :
                'Vệ sinh / Làm đẹp'
              ),
              frequency: t.frequency || (t.repeat === 'daily' ? 'Hàng ngày' : t.repeat === 'weekly' ? 'Hàng tuần' : t.repeat === 'monthly' ? 'Hàng tháng' : 'Định kỳ'),
              completed: Boolean(t.completed)
            };
          });
        }
      }
    } catch {}
    return INITIAL_HABIT_TASKS;
  });

  // Xác định thành viên gia đình
  const getMemberName = (memberId) => {
    const mem = (familyMembers || []).find(m => m.id === memberId);
    return mem ? mem.name : 'Người thân';
  };

  // 2. HÀM XỬ LÝ CLICK TICK HOÀN THÀNH (BẮT BUỘC ĐẢM BẢO TÍNH REACTIVE 100%)
  const handleToggleTask = (taskId) => {
    let willComplete = false;
    const nowTimeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const memberName = getMemberName(currentMemberId);

    const nextTasks = tasks.map(task => {
      if (String(task.id) === String(taskId)) {
        const nextCompleted = !task.completed;
        willComplete = nextCompleted;
        return {
          ...task,
          completed: nextCompleted,
          status: nextCompleted ? 'COMPLETED' : 'OVERDUE',
          completedAt: nextCompleted ? nowTimeStr : null,
          completedBy: nextCompleted ? memberName : null
        };
      }
      return task;
    });

    setTasks(nextTasks);
    try {
      localStorage.setItem('petcare_home_routines', JSON.stringify(nextTasks));
    } catch {}
    if (typeof setHomeRoutinesList === 'function') {
      setHomeRoutinesList(nextTasks);
    }

    // Hiệu ứng âm thanh & Pháo hoa chúc mừng
    if (willComplete) {
      try { sound?.playSuccess?.(); } catch {}
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 }
        });
      } catch {}
    } else {
      try { sound?.playClick?.(); } catch {}
    }
  };

  // Helper kiểm tra task thuộc về pet đang chọn
  const isTaskForCurrentPet = (task) => {
    if (!currentPet) return false;
    const curId = String(currentPet.id || '').trim();
    const taskPetId = String(task.petId || '').trim();
    if (taskPetId && taskPetId === curId) return true;
    if (task.petName && currentPet.name && task.petName.trim().toLowerCase() === currentPet.name.trim().toLowerCase()) return true;
    return false;
  };

  // 3. TỰ ĐỘNG TÍNH TOÁN DỮ LIỆU ĐỒNG BỘ (DERIVED STATE)
  const currentPetTasks = useMemo(() => {
    return tasks.filter(isTaskForCurrentPet);
  }, [tasks, currentPet]);

  const totalTasks = currentPetTasks.length;
  const completedTasks = currentPetTasks.filter(t => t.completed).length;
  const overdueTasks = currentPetTasks.filter(t => !t.completed && (String(t.status).toUpperCase() === 'OVERDUE')).length;
  const todayTasks = currentPetTasks.filter(t => !t.completed && (String(t.status).toUpperCase() === 'TODAY')).length;
  const upcomingTasks = currentPetTasks.filter(t => !t.completed && (String(t.status).toUpperCase() === 'UPCOMING')).length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const isAllDone = totalTasks > 0 && completedTasks === totalTasks;

  // Lọc theo ca trong ngày
  const getTimeSlot = (t) => {
    const time = t.time || '08:00';
    if (time < '11:30') return 'MORNING';
    if (time < '17:00') return 'NOON';
    return 'EVENING';
  };

  // Danh sách công việc hiển thị sau bộ lọc
  const displayedTasks = useMemo(() => {
    return currentPetTasks.filter(task => {
      const statusUpper = (task.status || (task.completed ? 'COMPLETED' : 'OVERDUE')).toUpperCase();

      // Bộ lọc trạng thái
      if (filterStatus === 'COMPLETED' && !task.completed) return false;
      if (filterStatus === 'OVERDUE' && (task.completed || statusUpper !== 'OVERDUE')) return false;
      if (filterStatus === 'TODAY' && (task.completed || statusUpper !== 'TODAY')) return false;
      if (filterStatus === 'UPCOMING' && (task.completed || statusUpper !== 'UPCOMING')) return false;

      // Bộ lọc ca trong ngày
      if (timeFilter !== 'ALL') {
        const slot = getTimeSlot(task);
        if (slot !== timeFilter) return false;
      }

      return true;
    });
  }, [currentPetTasks, filterStatus, timeFilter]);

  // Gamification Chuỗi Streak (Chỉ tính khi có công việc thực tế, không sinh số liệu giả)
  const currentActiveStreak = currentPetTasks.length === 0 ? 0 : (overdueTasks > 0 ? 0 : (isAllDone ? 1 : 0));

  // Cập nhật cân nặng không lặp chuỗi
  const handleQuickUpdateWeight = async (e) => {
    e?.preventDefault?.();
    const val = parseFloat(currentWeightInput);
    if (isNaN(val) || val < 0.5 || val > 150) {
      alert('Vui lòng nhập cân nặng hợp lệ từ 0.5 đến 150 kg!');
      return;
    }

    try {
      const updatedHealth = await updatePetWeight(activePetKey, val);
      try { sound?.playSuccess?.(); } catch {}
      if (typeof setPetsHealthData === 'function') {
        setPetsHealthData(updatedHealth);
      }

      // Gán chuỗi sạch duy nhất, không dùng regex append
      const cleanNote = `Liều lượng ${(val / 10).toFixed(1)} viên theo cân nặng ${val}kg. Cho uống kèm thức ăn buổi sáng.`;
      setTasks(prevTasks =>
        prevTasks.map(t => {
          if (isTaskForCurrentPet(t) && (t.title?.includes('Drontal') || t.title?.toLowerCase()?.includes('tẩy giun'))) {
            return {
              ...t,
              note: cleanNote,
              notes: cleanNote
            };
          }
          return t;
        })
      );
      setIsEditingWeight(false);
    } catch (err) {
      alert(err.message || 'Không thể lưu cân nặng lên máy chủ. Vui lòng thử lại.');
    }
  };


  // Xóa công việc
  const handleDeleteTask = (taskId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa việc này?')) return;
    try { sound?.playClick?.(); } catch {}
    setTasks(prev => prev.filter(t => String(t.id) !== String(taskId)));
    if (typeof onDeleteSchedule === 'function') {
      onDeleteSchedule(taskId);
    }
  };

  const handleResetTasks = () => {
    if (!currentPet) return;
    if (!window.confirm(`Bạn có chắc chắn muốn BỎ ĐÁNH DẤU HOÀN THÀNH (reset) tất cả thói quen của bé ${currentPet.name}?`)) return;
    try { sound?.playClick?.(); } catch {}
    setTasks(prevTasks => prevTasks.map(t => {
      if (isTaskForCurrentPet(t)) {
        return { ...t, completed: false };
      }
      return t;
    }));
  };

  if (!currentPet) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-3xl bg-white dark:bg-[#12192A] backdrop-blur-xl border border-slate-200/80 dark:border-white/10 shadow-lg mt-8 h-full">
        <Home className="w-16 h-16 text-slate-300 dark:text-slate-600 mb-4 opacity-50" />
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Bạn chưa có thú cưng</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
          Vui lòng thêm thú cưng vào hệ thống để bắt đầu thiết lập thói quen và lịch chăm sóc hàng ngày.
        </p>
        <button 
          onClick={(e) => {
            try { sound?.playClick?.(); } catch {}
            window.dispatchEvent(new CustomEvent('petcare_open_add_pet'));
          }}
          className="mt-6 px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Thêm Thú Cưng
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-5 flex-1 min-h-0 h-full overflow-hidden">
      
      {/* ========================================================== */}
      {/* A. CỘT TRÁI: SIDEBAR THÚ CƯNG & ĐỒNG BỘ 4 THẺ THỐNG KÊ */}
      {/* ========================================================== */}
      <div className="w-full lg:w-[340px] xl:w-[360px] flex-shrink-0 h-full flex flex-col gap-3 overflow-hidden">
        
        {/* 1. Bộ chọn thú cưng (Tabs Avatar 3 bé) */}
        <div className="flex-shrink-0 bg-white dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 rounded-2xl p-2.5 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] dark:shadow-lg">
          <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2 py-0.5 flex justify-between items-center mb-1">
            <span>Chọn Thú Cưng</span>
            <span className="text-cyan-600 dark:text-cyan-400 font-mono">{safePets.length} bé</span>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            {safePets.map((pet) => {
              const isSelected = currentPet.id === pet.id;
              const petTasks = tasks.filter(t => {
                const curId = String(pet.id).toLowerCase();
                const taskPetId = String(t.petId || '').toLowerCase();
                return taskPetId === curId || taskPetId.includes(curId);
              });
              const petOverdue = petTasks.filter(t => !t.completed && String(t.status).toUpperCase() === 'OVERDUE').length;

              return (
                <button
                  key={pet.id}
                  type="button"
                  onClick={() => {
                    try { sound?.playClick?.(); } catch {}
                    setSelectedRoutinePetId(pet.id);
                  }}
                  className={`relative flex flex-col items-center py-2 px-1 rounded-xl transition-all duration-200 border cursor-pointer ${
                    isSelected
                      ? 'bg-cyan-50 dark:bg-cyan-500/20 border-cyan-300 dark:border-cyan-400 text-cyan-900 dark:text-white shadow-xs scale-[1.02]'
                      : 'bg-slate-50/50 dark:bg-white/[0.02] border-slate-200/60 dark:border-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-100/60 dark:hover:bg-white/5 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <div className="relative mb-1">
                    {pet.avatar ? (
                      <img
                        src={pet.avatar}
                        alt={pet.name}
                        className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-white/20"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div className={`w-8 h-8 rounded-full border border-slate-200 dark:border-white/20 bg-slate-100 dark:bg-slate-800 items-center justify-center text-slate-400 ${pet.avatar ? 'hidden' : 'flex'}`}>
                      <PawPrint className="w-4 h-4" />
                    </div>
                    {petOverdue > 0 && (
                      <span className="absolute -top-1 -right-1.5 px-1 min-w-[14px] h-[14px] bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900 animate-pulse">
                        {petOverdue}
                      </span>
                    )}
                  </div>

                  <span className={`text-xs font-bold truncate max-w-full ${isSelected ? 'text-cyan-700 dark:text-cyan-300' : 'text-slate-700 dark:text-slate-300'}`}>
                    {pet.name}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">{petTasks.length} việc</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Thẻ hồ sơ bé đang chọn & 4 Thẻ thống kê đồng bộ */}
        <div className="flex-1 bg-white dark:bg-slate-900/60 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 rounded-3xl p-4 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] dark:shadow-2xl flex flex-col justify-between overflow-hidden gap-3">
          
          {/* Header bé */}
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              {currentPet.avatar ? (
                <img
                  src={currentPet.avatar}
                  alt={currentPet.name}
                  className="w-13 h-13 rounded-2xl object-cover border-2 border-cyan-400/60 shadow-lg shadow-cyan-500/20"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div className={`w-13 h-13 rounded-2xl border-2 border-slate-200 dark:border-white/20 bg-slate-100 dark:bg-slate-800 items-center justify-center text-slate-400 ${currentPet.avatar ? 'hidden' : 'flex'}`}>
                <PawPrint className="w-6 h-6" />
              </div>
              <span className="absolute -bottom-1 -right-1 text-[9px] bg-amber-500 text-slate-950 font-black px-1.5 py-0.2 rounded-md uppercase">
                {currentPet.gender || 'Đực'}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">{currentPet.name}</h3>
                <span className="text-[10px] px-2 py-0.2 rounded-full bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/20 truncate">
                  {currentPet.species}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {currentPet.age || '2.5 Tuổi'} • <span className="text-emerald-600 dark:text-emerald-400 font-bold">{activePetWeightVal} kg</span>
              </p>
            </div>
          </div>

          {/* Widget Cập nhật cân nặng */}
          {!isEditingWeight ? (
            <div className="pt-2 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm">⚖️</span>
                <span className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                  {activePetWeightVal} kg
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30">
                  Chuẩn thể trạng
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  sound?.playClick?.();
                  setIsEditingWeight(true);
                }}
                title="Chỉnh sửa cân nặng"
                className="p-1.5 rounded-xl text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-all cursor-pointer"
              >
                <Edit3 size={14} />
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleQuickUpdateWeight}
              className="pt-2 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                <span>⚖️</span>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="150"
                  autoFocus
                  value={currentWeightInput}
                  onChange={(e) => setCurrentWeightInput(e.target.value)}
                  className="w-18 px-2 py-1 text-xs font-bold text-center bg-slate-50 dark:bg-slate-900 border border-cyan-400 rounded-lg text-cyan-700 dark:text-cyan-300 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
                <span className="text-xs text-slate-400">kg</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="submit"
                  className="px-2.5 py-1 text-[11px] font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-teal-400 hover:opacity-90 rounded-lg shadow transition-all cursor-pointer active:scale-95"
                >
                  Lưu
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentWeightInput(String(activePetWeightVal));
                    setIsEditingWeight(false);
                  }}
                  className="px-2 py-1 text-[11px] font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white rounded-lg transition-all cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </form>
          )}

          {/* Thanh Tiến Độ Chăm Sóc Cột Trái */}
          <div className="bg-slate-50 dark:bg-white/[0.03] p-2.5 rounded-2xl border border-slate-200/80 dark:border-white/5 space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Tiến độ chăm sóc</span>
              <span className="text-cyan-700 dark:text-cyan-300 font-bold font-mono">
                {completedTasks}/{totalTasks} ({progressPercent}%)
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* 4 Thẻ Thống Kê Số Học Đồng Bộ Tuyệt Đối */}
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5 rounded-xl p-2.5">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">TỔNG VIỆC</span>
              <span className="text-base font-black text-slate-900 dark:text-white font-mono mt-0.5 block">{totalTasks}</span>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-2.5">
              <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold uppercase block">ĐÃ XONG</span>
              <span className="text-base font-black text-emerald-700 dark:text-emerald-400 font-mono mt-0.5 block">{completedTasks}</span>
            </div>
            <div className="bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/20 rounded-xl p-2.5">
              <span className="text-[10px] text-sky-700 dark:text-sky-300 font-bold uppercase block">HÔM NAY</span>
              <span className="text-base font-black text-sky-700 dark:text-sky-400 font-mono mt-0.5 block">{todayTasks}</span>
            </div>
            <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl p-2.5">
              <span className="text-[10px] text-rose-700 dark:text-rose-300 font-bold uppercase block">QUÁ HẠN</span>
              <span className="text-base font-black text-rose-700 dark:text-rose-400 font-mono mt-0.5 block">{overdueTasks}</span>
            </div>
          </div>

          {/* Nút Thêm Việc Cho Bé */}
          <button
            type="button"
            onClick={(e) => onOpenAddSchedule(e, 'deworm', null, currentPet.altId || currentPet.id)}
            className="w-full py-2.5 px-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/20 transition-all active:scale-[0.98] cursor-pointer"
          >
            <Plus size={15} className="stroke-[3]" />
            <span>+ Thêm việc cho {currentPet.name}</span>
          </button>
        </div>

      </div>

      {/* ========================================================== */}
      {/* B. CỘT PHẢI: CHECKLIST & LỊCH TRÌNH CHĂM SÓC REACTIVE */}
      {/* ========================================================== */}
      <div className="flex-1 min-w-0 h-full flex flex-col min-h-0 overflow-hidden bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 rounded-3xl p-4 sm:p-5 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)]">
        
        {/* 1. Header: Cập nhật Streak thời gian thực & Tiến độ ngày */}
        <div className="flex-shrink-0 pb-3 mb-3 border-b border-slate-200/80 dark:border-white/10 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                <Flame className="w-5 h-5 fill-amber-500 text-amber-500 animate-pulse" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  <span>Daily Care & Habit Tracker</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-400/30 font-bold">
                    {currentPet.name}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tiến độ hôm nay: {completedTasks}/{totalTasks} việc ({progressPercent}%)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              {/* Badge Chuỗi thay đổi theo trạng thái hoàn thành */}
              {isAllDone ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold animate-pulse shadow-xs">
                  <Flame className="w-4 h-4 fill-amber-500 text-amber-500"/>
                  <span>ĐÃ GIỮ CHUỖI: {currentActiveStreak} ngày liên tục</span>
                  <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.2 rounded-full font-bold">+1 🎉</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-bold">
                  <span>⚠️ Còn {totalTasks - completedTasks} việc chưa xong</span>
                </div>
              )}

              {/* Nút Thêm Việc Mới */}
              <button
                type="button"
                onClick={(e) => onOpenAddSchedule(e, 'deworm', null, currentPet.altId || currentPet.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold shadow-md shadow-cyan-500/20 transition-all active:scale-95 cursor-pointer"
              >
                <Plus size={14} className="stroke-[3]" />
                <span>+ Thêm việc mới</span>
              </button>

              {/* Nút Khôi phục dữ liệu mẫu */}
              <button
                type="button"
                onClick={handleResetTasks}
                title="Khôi phục danh sách việc mẫu chuẩn thú y"
                className="p-1.5 rounded-xl text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200/80 dark:border-white/10 transition-all cursor-pointer"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {/* Thanh Progress Bar cột phải */}
          <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-300 ${
                isAllDone 
                  ? 'bg-gradient-to-r from-teal-400 to-emerald-400' 
                  : 'bg-gradient-to-r from-amber-400 via-cyan-400 to-teal-400'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* 2. Thanh Bộ Lọc Tích Hợp (Filter Bar: Trạng thái & Ca) */}
        <div className="flex-shrink-0 mb-3 space-y-2">
          {/* Hàng chip lọc trạng thái */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {[
              { id: 'ALL', label: 'Tất cả', count: totalTasks },
              { id: 'TODAY', label: 'Hôm nay', count: todayTasks },
              { id: 'UPCOMING', label: 'Sắp tới', count: upcomingTasks },
              { id: 'OVERDUE', label: 'Quá hạn', count: overdueTasks, isAlert: overdueTasks > 0 },
              { id: 'COMPLETED', label: 'Đã xong', count: completedTasks }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  try { sound?.playClick?.(); } catch {}
                  setFilterStatus(tab.id);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterStatus === tab.id
                    ? tab.isAlert
                      ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30 font-black'
                      : 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30 font-black'
                    : tab.isAlert
                    ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30'
                    : 'bg-slate-100/80 hover:bg-slate-200/70 border border-slate-200/80 text-slate-700 dark:bg-white/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  filterStatus === tab.id ? 'bg-black/20 text-current' : 'bg-slate-200/60 dark:bg-white/10 text-slate-600 dark:text-slate-400'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Hàng chip lọc ca trong ngày */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 pl-1 shrink-0">
              Ca trong ngày:
            </span>
            {[
              { id: 'ALL', label: 'Tất cả buổi' },
              { id: 'MORNING', label: '🌅 Sáng' },
              { id: 'NOON', label: '☀️ Trưa' },
              { id: 'EVENING', label: '🌙 Tối' }
            ].map(slot => (
              <button
                key={slot.id}
                type="button"
                onClick={() => {
                  try { sound?.playClick?.(); } catch {}
                  setTimeFilter(slot.id);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  timeFilter === slot.id
                    ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-950 font-bold shadow-xs'
                    : 'bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-white/10'
                }`}
              >
                {slot.label}
              </button>
            ))}
          </div>
        </div>

        {/* 3. DANH SÁCH THẺ CÔNG VIỆC CHĂM SÓC (CUỘN MƯỢT VỚI PB-32) */}
        <div className="flex-1 min-h-0 overflow-y-auto pb-32 space-y-3 pr-1 custom-scrollbar">
          {displayedTasks.length === 0 ? (
            /* EMPTY STATE */
            <div className="p-8 sm:p-10 rounded-3xl bg-slate-50 dark:bg-[#1E293B]/70 border border-dashed border-slate-300 dark:border-white/15 text-center space-y-4 shadow-xs my-auto">
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-400/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mx-auto shadow-inner">
                <Calendar className="w-7 h-7" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  {filterStatus === 'ALL' && timeFilter === 'ALL'
                    ? `Bé ${currentPet.name} chưa có việc chăm sóc nào`
                    : `Không tìm thấy việc nào theo bộ lọc đang chọn`}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Thiết lập việc chăm sóc định kỳ hoặc khôi phục dữ liệu mẫu chuẩn y khoa cho bé {currentPet.name}.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2.5 flex-wrap">
                <button
                  type="button"
                  onClick={(e) => onOpenAddSchedule(e, 'deworm', null, currentPet.altId || currentPet.id)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-teal-400 hover:opacity-95 shadow-md shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  <Plus size={14} className="stroke-[3]" />
                  <span>Thêm việc cho {currentPet.name}</span>
                </button>
              </div>
            </div>
          ) : (
            displayedTasks.map(task => {
              const isOverdue = !task.completed && String(task.status).toUpperCase() === 'OVERDUE';
              const isToday = !task.completed && String(task.status).toUpperCase() === 'TODAY';
              const isUpcoming = !task.completed && String(task.status).toUpperCase() === 'UPCOMING';

              return (
                <div
                  key={task.id}
                  className={`p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 space-y-2.5 ${
                    task.completed
                      ? 'bg-slate-50/70 dark:bg-[#1E293B]/40 border-slate-200/60 dark:border-white/5 opacity-70'
                      : isOverdue
                      ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-500/40 shadow-xs'
                      : isToday
                      ? 'bg-cyan-50/70 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-500/40 shadow-xs'
                      : 'bg-white dark:bg-[#1E293B] border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    
                    {/* BÊN TRÁI & NỘI DUNG THẺ */}
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      
                      {/* NÚT TICK HOÀN THÀNH: BẮT BUỘC DÙNG BUTTON CÓ ONCLICK REACTIVE */}
                      <button
                        type="button"
                        onClick={() => handleToggleTask(task.id)}
                        aria-label={task.completed ? 'Đánh dấu chưa hoàn thành' : 'Đánh dấu hoàn thành'}
                        title={task.completed ? 'Đánh dấu chưa hoàn thành' : 'Đánh dấu hoàn thành'}
                        className={`w-6 h-6 rounded-full mt-0.5 flex items-center justify-center border-2 transition-all shrink-0 cursor-pointer ${
                          task.completed
                            ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                            : 'border-slate-300 dark:border-white/20 hover:border-teal-500 bg-white dark:bg-slate-800'
                        }`}
                      >
                        {task.completed && <Check className="w-3.5 h-3.5 stroke-[3]"/>}
                      </button>

                      {/* Thông tin công việc */}
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className={`text-sm sm:text-base font-bold leading-snug truncate ${
                            task.completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'
                          }`}>
                            {task.title}
                          </h4>
                          {task.completed && (
                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-500/30">
                              Đã xong {task.completedAt ? `lúc ${task.completedAt}` : ''}
                            </span>
                          )}
                        </div>

                        {/* Hàng tags meta: Category • Giờ • Tần suất • Địa điểm */}
                        <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-600 dark:text-slate-300">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold border bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/30">
                            {task.category || 'Vệ sinh & Spa'}
                          </span>

                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-300">
                            <Clock className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                            <span className="font-mono font-bold">{task.time}</span>
                          </span>

                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/20 text-teal-700 dark:text-teal-300 font-semibold">
                            <Repeat className="w-3 h-3" />
                            <span>{task.frequency}</span>
                          </span>

                          {task.location && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100/60 dark:bg-white/[0.03] text-slate-500 dark:text-slate-400">
                              <MapPin className="w-3 h-3" />
                              <span className="truncate max-w-[140px]">{task.location}</span>
                            </span>
                          )}
                        </div>

                        {/* Ghi chú hướng dẫn sạch sẽ, chuẩn y khoa (ĐÃ SỬA LỖI LẶP CHUỖI) */}
                        {(task.note || task.notes) && (
                          <div className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-black/30 p-2.5 rounded-xl border border-slate-200/80 dark:border-white/5 leading-relaxed flex items-start gap-2 mt-2">
                            <span className="text-amber-500 dark:text-amber-400 text-sm shrink-0">💡</span>
                            <span className="flex-1 font-normal">
                              {task.note || task.notes}
                            </span>
                          </div>
                        )}

                        {/* Người thực hiện nếu đã xong */}
                        {task.completed && task.completedBy && (
                          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-medium pt-0.5">
                            <span>👤 Thực hiện bởi: {task.completedBy}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* BÊN PHẢI THẺ: BADGES & ACTIONS */}
                    <div className="shrink-0 flex items-center gap-2">
                      {/* Badge trạng thái */}
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border ${
                        task.completed 
                          ? 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-white/5 dark:text-slate-400 dark:border-white/10'
                          : isOverdue
                          ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30 animate-pulse'
                          : isToday
                          ? 'bg-cyan-50 text-cyan-600 border-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/30'
                          : 'bg-sky-50 text-sky-600 border-sky-200 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-500/30'
                      }`}>
                        {task.completed ? 'Đã xong' : isOverdue ? 'Quá hạn' : isToday ? 'Hôm nay' : 'Sắp tới'}
                      </span>

                      {/* Nút Sửa ✏️ */}
                      <button
                        type="button"
                        onClick={() => {
                          try { sound?.playClick?.(); } catch {}
                          onOpenEditSchedule(task);
                        }}
                        className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-300 dark:hover:text-white transition-all text-xs font-semibold flex items-center cursor-pointer border border-slate-200 dark:border-white/5"
                        title="Sửa việc"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {/* Nút Xóa 🗑️ */}
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:text-rose-400 transition-all text-xs font-semibold flex items-center cursor-pointer border border-rose-200 dark:border-rose-500/20"
                        title="Xóa việc"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>

    </div>
  );
}
