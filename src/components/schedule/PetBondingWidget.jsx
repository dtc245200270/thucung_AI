import React, { useState, useEffect, useMemo, useRef } from 'react';
import confetti from 'canvas-confetti';
import { 
  Heart, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  Circle, 
  Play, 
  Pause, 
  RotateCcw, 
  ChevronDown, 
  ChevronUp, 
  Award, 
  BookOpen
} from 'lucide-react';
import { sound } from '../../services/soundService';
import { normalizePetHealthKey } from '../../services/storageService';
import { getTodayVnDate } from '../../utils/dateUtils.js';

import { getPetReferenceData } from '../../constants/petBehaviorReference';

export const PET_BONDING_DATA = {};
export const petPersonalityData = {};

const BONDING_STORAGE_KEY = 'petcare_bonding_tasks_v2';

export default function PetBondingWidget({ pet, petKey }) {
  // Chuẩn hóa key thú cưng đang chọn
  const activeKey = normalizePetHealthKey(petKey || pet?.id || pet?.name || '');
  // Get reference data for this pet
  const refData = getPetReferenceData(pet?.species || '');
  const currentTask = refData.quests && refData.quests.length > 0 ? refData.quests[0] : { title: 'Tương tác nhẹ nhàng', duration: 300, id: 'q1' };

  // Ngày hôm nay dạng YYYY-MM-DD theo Asia/Ho_Chi_Minh
  const todayStr = useMemo(() => getTodayVnDate(), []);
  const taskStorageId = `${todayStr}_${pet?.id || 'guest'}_${currentTask.id}`;

  // State hoàn thành nhiệm vụ (lưu trữ theo ngày & từng bé)
  const [isCompleted, setIsCompleted] = useState(() => {
    try {
      const stored = localStorage.getItem(BONDING_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return Boolean(parsed[taskStorageId]);
      }
    } catch {}
    return currentTask.completed;
  });

  // State thu gọn / mở rộng widget
  const [isExpanded, setIsExpanded] = useState(true);

  // State hiển thị góc chuyên gia hành vi Dr. Paw
  const [showInsight, setShowInsight] = useState(false);

  // State đồng hồ bấm giờ tương tác (Interactive Bonding Timer)
  const [isTimerOpen, setIsTimerOpen] = useState(false);
  const [timerSecondsLeft, setTimerSecondsLeft] = useState(currentTask.timerSeconds || 180);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef(null);

  // Lưu trạng thái hoàn thành vào LocalStorage
  const saveTaskCompletion = (completed) => {
    try {
      const stored = localStorage.getItem(BONDING_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : {};
      parsed[taskStorageId] = completed;
      localStorage.setItem(BONDING_STORAGE_KEY, JSON.stringify(parsed));
    } catch {}
  };

  // Hoàn thành từ Timer
  const handleFinishExercise = () => {
    setIsCompleted(true);
    saveTaskCompletion(true);
    setIsTimerRunning(false);
    try { sound?.playSuccess?.(); } catch {}
    try {
      confetti({
        particleCount: 80,
        spread: 80,
        origin: { y: 0.6 }
      });
    } catch {}
  };

  // Đồng bộ trạng thái khi đổi thú cưng
  useEffect(() => {
    try {
      const stored = localStorage.getItem(BONDING_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setIsCompleted(Boolean(parsed[taskStorageId]));
      } else {
        setIsCompleted(currentTask.completed);
      }
    } catch {
      setIsCompleted(currentTask.completed);
    }
    // Reset timer khi đổi pet
    setIsTimerRunning(false);
    setIsTimerOpen(false);
    setTimerSecondsLeft(currentTask.timerSeconds || 180);
  }, [taskStorageId, activeKey, currentTask.completed, currentTask.timerSeconds]);

  // Bộ đếm thời gian
  useEffect(() => {
    if (isTimerRunning && timerSecondsLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimerSecondsLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setIsTimerRunning(false);
            handleFinishExercise();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }

    return () => clearInterval(timerRef.current);
  }, [isTimerRunning, timerSecondsLeft, taskStorageId]);

  // Toggle hoàn thành nhiệm vụ
  const handleToggleComplete = () => {
    const nextVal = !isCompleted;
    setIsCompleted(nextVal);
    saveTaskCompletion(nextVal);

    if (nextVal) {
      try { sound?.playSuccess?.(); } catch {}
      try {
        confetti({
          particleCount: 50,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch {}
    } else {
      try { sound?.playClick?.(); } catch {}
    }
  };

  // Bắt đầu / Tạm dừng hẹn giờ
  const handleToggleTimer = () => {
    try { sound?.playClick?.(); } catch {}
    setIsTimerRunning(!isTimerRunning);
  };

  // Đặt lại hẹn giờ
  const handleResetTimer = () => {
    try { sound?.playClick?.(); } catch {}
    setIsTimerRunning(false);
    setTimerSecondsLeft(currentTask.timerSeconds || 180);
  };

  // Định dạng phút:giây
  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Điểm gắn kết động (cộng thêm 2 điểm nếu đã hoàn thành nhiệm vụ hôm nay)
  const currentBondingScore = isCompleted 
    ? Math.min(100, petProfile.bondingScore + 2) 
    : petProfile.bondingScore;

  // Helper nhãn màu sắc theo tag tính cách
  const getTagStyle = (tag) => {
    if (tag.startsWith('Thích') || tag.startsWith('Mê')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30';
    }
    if (tag.startsWith('Sợ') || tag.startsWith('Ghét')) {
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30';
    }
    return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/30';
  };

  // Helper icon cho tag tính cách
  const getTagIcon = (tag) => {
    if (tag.startsWith('Thích') || tag.startsWith('Mê')) return '❤️';
    if (tag.startsWith('Sợ')) return '⚡';
    if (tag.startsWith('Ghét')) return '⚠️';
    return '💡';
  };

  return (
    <div className={`relative rounded-3xl border transition-all duration-300 overflow-hidden shadow-sm ${petProfile.borderGlow} bg-gradient-to-br ${petProfile.bgGradient} bg-white dark:bg-slate-900/80 backdrop-blur-xl mb-3`}>
      
      {/* ========================================================== */}
      {/* 1. HEADER COMPONENT: TÍNH CÁCH & ĐIỂM GẮN KẾT */}
      {/* ========================================================== */}
      <div className="p-4 sm:p-5 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          {/* Cụm Tiêu Đề & Archetype Badge */}
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-400 text-white flex items-center justify-center shrink-0 shadow-md shadow-rose-500/20">
              <Heart className="w-5 h-5 fill-white animate-pulse" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5">
                  <span>Hồ Sơ Tính Cách & Gắn Kết</span>
                  <span className="text-rose-500 text-xs font-mono">• {petProfile.name}</span>
                </h3>

                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>{petProfile.archetypeTag}</span>
                </span>
              </div>

              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5 truncate">
                {petProfile.archetype}
              </p>
            </div>
          </div>

          {/* Cụm Điểm Gắn Kết (Bonding Score & Level Badge) & Nút Thu Gọn */}
          <div className="flex items-center gap-2.5 self-end sm:self-center">
            
            {/* Điểm gắn kết & Level */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-white/10 shadow-2xs">
              <div className="text-right">
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1 justify-end">
                  <Award className="w-3 h-3 text-amber-500" />
                  <span>{petProfile.levelTitle}</span>
                </div>
                <div className="text-xs font-black text-slate-900 dark:text-white font-mono flex items-center gap-1">
                  <span className="text-rose-500 font-extrabold">{currentBondingScore}%</span>
                  <span className="text-[10px] text-slate-600 dark:text-slate-300">Gắn kết</span>
                  {isCompleted && (
                    <span className="text-[9px] px-1 py-0.2 rounded-md bg-emerald-500 text-white font-bold animate-bounce">
                      +2% 🎉
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Nút Thu Gọn / Mở Rộng */}
            <button
              type="button"
              onClick={() => {
                sound?.playClick?.();
                setIsExpanded(!isExpanded);
              }}
              title={isExpanded ? 'Thu gọn widget' : 'Mở rộng widget'}
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-all cursor-pointer border border-slate-200/80 dark:border-white/10"
            >
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

        </div>

        {/* Thanh Đo Thang Điểm Gắn Kết (Bonding Score Progress Bar) */}
        <div className="mt-3 space-y-1">
          <div className="flex justify-between items-center text-[10px] text-slate-600 dark:text-slate-300 font-bold">
            <span className="flex items-center gap-1">
              <span>Tiến độ gắn kết hôm nay</span>
              <span className="text-rose-500">❤️</span>
            </span>
            <span className="font-mono">{currentBondingScore}/100</span>
          </div>

          <div className="w-full h-2 bg-slate-200/70 dark:bg-slate-800/80 rounded-full overflow-hidden p-0.5">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-amber-400 via-rose-400 to-rose-500 shadow-sm transition-all duration-700"
              style={{ width: `${currentBondingScore}%` }}
            />
          </div>
        </div>
      </div>

      {/* ========================================================== */}
      {/* 2. NỘI DUNG CHI TIẾT (KHI EXPANDED) */}
      {/* ========================================================== */}
      {isExpanded && (
        <div className="px-4 sm:p-5 pt-0 pb-4 space-y-3">
          
          {/* Hàng Tags Tính Cách Đặc Trưng */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mr-1 flex items-center gap-1">
              <span>Đặc điểm:</span>
            </span>
            {petProfile.tags.map((tag, idx) => (
              <span
                key={idx}
                className={`inline-flex items-center gap-1 px-2.5 py-0.8 rounded-xl text-xs font-semibold border shadow-2xs transition-transform hover:scale-105 select-none ${getTagStyle(tag)}`}
              >
                <span>{getTagIcon(tag)}</span>
                <span>{tag}</span>
              </span>
            ))}
          </div>

          {/* THẺ NHIỆM VỤ GẮN KẾT HÔM NAY (TODAY BONDING TASK CARD) */}
          <div className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
            isCompleted 
              ? 'bg-emerald-50/80 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-500/30' 
              : 'bg-white/90 dark:bg-slate-800/80 border-slate-200/80 dark:border-white/10 shadow-xs'
          }`}>
            
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
              
              {/* Phần thông tin nhiệm vụ bên trái */}
              <div className="flex items-start gap-3 min-w-0 flex-1">
                
                {/* Nút check hoàn thành */}
                <button
                  type="button"
                  onClick={handleToggleComplete}
                  className="mt-0.5 text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition-all shrink-0 active:scale-90 cursor-pointer"
                  title={isCompleted ? 'Đánh dấu chưa hoàn thành' : 'Đánh dấu đã hoàn thành nhiệm vụ'}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 fill-emerald-100 dark:fill-emerald-950" />
                  ) : (
                    <Circle className="w-6 h-6 hover:stroke-emerald-500" />
                  )}
                </button>

                {/* Tiêu đề & Hướng dẫn */}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30 flex items-center gap-1">
                      <span>{currentTask.categoryIcon || '🎯'}</span>
                      <span>{currentTask.category}</span>
                    </span>

                    <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-md border border-slate-200 dark:border-white/10">
                      <Clock className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                      <span>{currentTask.duration}</span>
                    </span>

                    {isCompleted && (
                      <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/20 px-2 py-0.5 rounded-md">
                        ✓ Đã hoàn thành hôm nay
                      </span>
                    )}
                  </div>

                  <h4 className={`text-sm sm:text-base font-bold leading-snug ${
                    isCompleted ? 'line-through text-slate-600 dark:text-slate-300' : 'text-slate-900 dark:text-white'
                  }`}>
                    {currentTask.title}
                  </h4>

                  {/* Hướng dẫn chi tiết */}
                  <div className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-black/20 p-2.5 rounded-xl border border-slate-200/70 dark:border-white/5 leading-relaxed flex items-start gap-2">
                    <span className="text-amber-500 text-sm shrink-0">💡</span>
                    <span className="flex-1 font-normal">
                      <strong className="font-semibold text-slate-800 dark:text-slate-200">Hướng dẫn: </strong>
                      {currentTask.guide}
                    </span>
                  </div>

                  {/* Toggle Góc chuyên gia AI tâm lý hành vi */}
                  <div className="pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        sound?.playClick?.();
                        setShowInsight(!showInsight);
                      }}
                      className="text-[11px] font-semibold text-cyan-700 dark:text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <BookOpen size={12} />
                      <span>{showInsight ? 'Ẩn cơ sở khoa học' : 'Vì sao bài tập này hiệu quả? (Khoa học hành vi)'}</span>
                    </button>

                    {showInsight && (
                      <div className="mt-1.5 p-2.5 rounded-xl bg-cyan-50/70 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-500/20 text-xs text-slate-700 dark:text-slate-300 leading-relaxed space-y-1 animate-fadeIn">
                        <div className="flex items-center gap-1 font-bold text-cyan-800 dark:text-cyan-300 text-[11px]">
                          <span>🔬 Góc Chuyên Gia Dr. Paw:</span>
                        </div>
                        <p className="text-[11px]">{petProfile.psychologyInsight}</p>
                      </div>
                    )}
                  </div>

                </div>

              </div>

              {/* Phần tương tác bấm giờ bên phải */}
              <div className="shrink-0 flex items-center md:flex-col md:items-end justify-between gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-white/5">
                
                {/* Nút mở bộ bấm giờ bài tập */}
                {!isTimerOpen ? (
                  <button
                    type="button"
                    onClick={() => {
                      sound?.playClick?.();
                      setIsTimerOpen(true);
                      setIsTimerRunning(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                  >
                    <Play size={13} className="fill-slate-950" />
                    <span>Bấm giờ bài tập</span>
                  </button>
                ) : (
                  /* Bộ bấm giờ tương tác mini */
                  <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-xl">
                    <span className="font-mono font-black text-xs px-2 text-cyan-700 dark:text-cyan-400">
                      {formatTime(timerSecondsLeft)}
                    </span>
                    <button
                      type="button"
                      onClick={handleToggleTimer}
                      title={isTimerRunning ? 'Tạm dừng' : 'Tiếp tục'}
                      className="p-1 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      {isTimerRunning ? <Pause size={12} /> : <Play size={12} className="fill-current" />}
                    </button>
                    <button
                      type="button"
                      onClick={handleResetTimer}
                      title="Đặt lại"
                      className="p-1 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      <RotateCcw size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={handleFinishExercise}
                      title="Hoàn thành ngay"
                      className="px-2 py-0.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-[10px] cursor-pointer"
                    >
                      Xong
                    </button>
                  </div>
                )}

                {/* Nút hành động nhanh toggle */}
                <button
                  type="button"
                  onClick={handleToggleComplete}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                    isCompleted 
                      ? 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'
                      : 'text-emerald-700 dark:text-emerald-300 hover:underline'
                  }`}
                >
                  {isCompleted ? 'Hoàn tác' : 'Đánh dấu xong'}
                </button>

              </div>

            </div>

          </div>

        </div>
      )}

      {/* Phiên bản thu gọn (Mini Banner khi collapsed) */}
      {!isExpanded && (
        <div className="px-4 py-2.5 flex items-center justify-between text-xs bg-slate-50/50 dark:bg-white/[0.02] border-t border-slate-200/60 dark:border-white/5">
          <div className="flex items-center gap-2 truncate">
            <span className="font-bold text-slate-800 dark:text-slate-200">
              Nhiệm vụ hôm nay:
            </span>
            <span className="truncate text-slate-600 dark:text-slate-400">
              {currentTask.title}
            </span>
            <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400">
              ({currentTask.duration})
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleToggleComplete}
              className={`text-[11px] font-bold px-2 py-0.5 rounded-md cursor-pointer ${
                isCompleted 
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                  : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
              }`}
            >
              {isCompleted ? '✓ Đã xong' : 'Làm ngay'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
