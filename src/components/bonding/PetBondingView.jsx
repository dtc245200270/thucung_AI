import React, { useState, useEffect, useMemo, useRef } from 'react';
import confetti from 'canvas-confetti';
import { 
  Activity, 
  Calendar, 
  Clock, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Eye, 
  Target, 
  BookOpen, 
  History, 
  RotateCcw, 
  Play, 
  Pause, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Info, 
  Filter, 
  ChevronRight, 
  CalendarDays,
  Smile,
  Meh,
  Frown,
  Heart,
  Lightbulb,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { sound } from '../../services/soundService';
import { apiGetAll, apiCreate, apiUpdate, apiDelete, syncAllDataToCache } from '../../services/apiService';
import { getTodayVnDate, getCurrentVnTime, formatDateVi, addDaysLocal, isPastVnDateTime, formatTime24h } from '../../utils/dateUtils';
import { useCurrentVnDate } from '../../hooks/useCurrentVnDate';
import { REFERENCE_DATA, getPetReferenceData } from '../../constants/petBehaviorReference';
import { PageContainer, PageHeader, Tabs, FilterBar, EmptyState, Modal } from '../common/ui';

// Danh mục trạng thái quan sát thân thiện
const MOOD_OPTIONS = [
  { id: 'happy', label: 'Vui vẻ, hoạt bát', icon: '✨', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  { id: 'relaxed', label: 'Thư thái, thoải mái', icon: '🌿', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  { id: 'curious', label: 'Tò mò, năng động', icon: '🧐', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' },
  { id: 'alert', label: 'Cảnh giác, chú ý cao', icon: '👀', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  { id: 'lethargic', label: 'Uể oải, ít vận động', icon: '🥱', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
  { id: 'anxious', label: 'Lo lắng, sợ sệt', icon: '😟', color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' },
  { id: 'stressed', label: 'Căng thẳng, bồn chồn', icon: '⚡', color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' },
  { id: 'other', label: 'Khác (tự nhập mô tả)', icon: '✏️', color: 'text-slate-300 bg-slate-800 border-slate-700' }
];

export const PetBondingView = ({ pets = [], currentUser }) => {
  const todayVn = useCurrentVnDate();

  // 1. Quản lý Thú cưng và Ngày đang xem
  const [selectedPetId, setSelectedPetId] = useState(() => (pets.length > 0 ? pets[0].id : null));
  const [selectedDate, setSelectedDate] = useState(todayVn);

  // 2. Tab điều hướng chính trong phân hệ (Mặc định 'observation')
  const [activeTab, setActiveTab] = useState('observation');

  // 3. Dữ liệu từ Server
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [syncWarning, setSyncWarning] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 4. State Form Quan sát
  const [isEditingObs, setIsEditingObs] = useState(false);
  const [obsMood, setObsMood] = useState('happy');
  const [obsBehavior, setObsBehavior] = useState('');
  const [obsNotes, setObsNotes] = useState('');

  // 5. State Form Hoạt động gắn kết
  const [isAddingAct, setIsAddingAct] = useState(false);
  const [editingActId, setEditingActId] = useState(null);
  const [actTitle, setActTitle] = useState('');
  const [actTime, setActTime] = useState('');
  const [actEstDuration, setActEstDuration] = useState('');
  const [actNote, setActNote] = useState('');
  const [actError, setActError] = useState('');

  // Modal hoàn thành hoạt động
  const [completingAct, setCompletingAct] = useState(null);
  const [completeActualDuration, setCompleteActualDuration] = useState('');
  const [completeReaction, setCompleteReaction] = useState('Hào hứng, thích thú');
  const [completeReactionNote, setCompleteReactionNote] = useState('');
  const [completeError, setCompleteError] = useState('');

  // Bộ bấm giờ tương tác cho hoạt động
  const [timerActId, setTimerActId] = useState(null);
  const [timerSecondsLeft, setTimerSecondsLeft] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // 6. State Form Nhật ký hành vi
  const [isAddingBhv, setIsAddingBhv] = useState(false);
  const [editingBhvId, setEditingBhvId] = useState(null);
  const [bhvDate, setBhvDate] = useState(todayVn);
  const [bhvTime, setBhvTime] = useState(() => getCurrentVnTime().slice(0, 5));
  const [bhvBehavior, setBhvBehavior] = useState('');
  const [bhvContext, setBhvContext] = useState('');
  const [bhvNote, setBhvNote] = useState('');
  const [bhvError, setBhvError] = useState('');

  // 7. State Bộ lọc Lịch sử
  const [histFromDate, setHistFromDate] = useState(() => addDaysLocal(todayVn, -14));
  const [histToDate, setHistToDate] = useState(todayVn);
  const [histTypeFilter, setHistTypeFilter] = useState('all'); // 'all' | 'observation' | 'activity' | 'behavior'
  const [histPetFilter, setHistPetFilter] = useState('selected'); // 'selected' | 'all'

  // Đồng bộ chọn thú cưng khi danh sách thú cưng cập nhật
  useEffect(() => {
    if (pets.length > 0) {
      if (!selectedPetId || !pets.some(p => p.id === selectedPetId)) {
        setSelectedPetId(pets[0].id);
      }
    } else {
      setSelectedPetId(null);
    }
  }, [pets, selectedPetId]);

  // Tải dữ liệu nhật ký từ Backend Server
  const loadData = async () => {
    setIsLoading(true);
    setLoadError('');
    setActionError('');
    setSyncWarning('');

    try {
      const data = await apiGetAll('daily_logs');
      if (Array.isArray(data)) {
        setLogs(data);
      } else {
        setLogs([]);
      }
    } catch (err) {
      console.error('[PetCare Activities] Lỗi tải dữ liệu:', err);
      setLoadError(err.message || 'Không thể kết nối đến máy chủ để tải dữ liệu hoạt động & nhật ký.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser?.id]);

  // Reset bộ đếm giờ khi đổi thú cưng hoặc ngày
  useEffect(() => {
    setIsTimerRunning(false);
    setTimerActId(null);
    setTimerSecondsLeft(0);
  }, [selectedPetId, selectedDate]);

  // Đồng hồ đếm ngược hoạt động (TUYỆT ĐỐI KHÔNG TỰ HOÀN THÀNH KHI VỀ 0)
  useEffect(() => {
    let interval = null;
    if (isTimerRunning && timerSecondsLeft > 0) {
      interval = setInterval(() => {
        setTimerSecondsLeft(prev => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            try { sound?.playPop?.(); } catch (_) {}
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSecondsLeft]);

  // Thú cưng hiện tại
  const currentPet = useMemo(() => {
    return pets.find(p => p.id === selectedPetId) || pets[0] || null;
  }, [pets, selectedPetId]);

  // Dữ liệu tham khảo sinh học theo loài
  const refData = useMemo(() => {
    return getPetReferenceData(currentPet?.species || '');
  }, [currentPet]);

  // Phân tách các bản ghi theo Thú cưng và Ngày
  const petLogs = useMemo(() => {
    if (!currentPet) return [];
    return logs.filter(l => l && l.petId === currentPet.id);
  }, [logs, currentPet]);

  const dayLogs = useMemo(() => {
    return petLogs.filter(l => l && l.date === selectedDate);
  }, [petLogs, selectedDate]);

  // 1. Quan sát hôm nay (type === 'observation' hoặc bản ghi cũ có mood)
  const currentObservation = useMemo(() => {
    return dayLogs.find(l => l.type === 'observation' || (!l.type && (l.mood || l.behavior || l.notes))) || null;
  }, [dayLogs]);

  // 2. Danh sách Hoạt động gắn kết của ngày
  const dayActivities = useMemo(() => {
    return dayLogs.filter(l => l.type === 'activity' || (!l.type && l.title));
  }, [dayLogs]);

  // 3. Tiến độ hoạt động (Công thức: hoàn thành / tổng hoạt động chưa bị hủy)
  const { totalActiveActivities, completedActivitiesCount, progressPercent } = useMemo(() => {
    const active = dayActivities.filter(a => a.status !== 'cancelled');
    const completed = active.filter(a => a.status === 'completed');
    if (active.length === 0) {
      return { totalActiveActivities: 0, completedActivitiesCount: 0, progressPercent: null };
    }
    const percent = Math.round((completed.length / active.length) * 100);
    return {
      totalActiveActivities: active.length,
      completedActivitiesCount: completed.length,
      progressPercent: percent
    };
  }, [dayActivities]);

  // 4. Danh sách Nhật ký hành vi của ngày
  const dayBehaviors = useMemo(() => {
    return dayLogs.filter(l => l.type === 'behavior' || (!l.type && l.behavior && !l.title && !l.mood));
  }, [dayLogs]);

  // 5. Danh sách Lịch sử lọc theo khoảng ngày
  const historyList = useMemo(() => {
    let list = logs.filter(l => {
      if (!l || !l.date) return false;
      if (histPetFilter === 'selected' && currentPet && l.petId !== currentPet.id) return false;
      if (histFromDate && l.date < histFromDate) return false;
      if (histToDate && l.date > histToDate) return false;

      const recordType = l.type || (l.title ? 'activity' : l.behavior && !l.mood ? 'behavior' : 'observation');
      if (histTypeFilter !== 'all' && recordType !== histTypeFilter) return false;
      return true;
    });

    // Sắp xếp giảm dần theo ngày, sau đó đến giờ/thời điểm tạo (chuẩn 24h)
    return list.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      const timeA = formatTime24h(a.time, a.createdAt) || '00:00';
      const timeB = formatTime24h(b.time, b.createdAt) || '00:00';
      return timeB.localeCompare(timeA);
    });
  }, [logs, histPetFilter, currentPet, histFromDate, histToDate, histTypeFilter]);

  // Thống kê Lịch sử
  const historyStats = useMemo(() => {
    let totalActs = 0;
    let completedActs = 0;
    let cancelledActs = 0;
    let totalBhvs = 0;
    let totalObs = 0;

    historyList.forEach(item => {
      const type = item.type || (item.title ? 'activity' : item.behavior && !item.mood ? 'behavior' : 'observation');
      if (type === 'activity') {
        totalActs++;
        if (item.status === 'completed') completedActs++;
        if (item.status === 'cancelled') cancelledActs++;
      } else if (type === 'behavior') {
        totalBhvs++;
      } else if (type === 'observation') {
        totalObs++;
      }
    });

    return { totalActs, completedActs, cancelledActs, totalBhvs, totalObs };
  }, [historyList]);

  // Helper định dạng giờ mm:ss cho timer
  const formatTimerDisplay = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ============================================================================
  // XỬ LÝ QUAN SÁT NGÀY (DAILY OBSERVATION)
  // ============================================================================
  const handleOpenEditObservation = () => {
    if (currentObservation) {
      setObsMood(currentObservation.mood || 'happy');
      setObsBehavior(currentObservation.behavior || '');
      setObsNotes(currentObservation.notes || '');
    } else {
      setObsMood('happy');
      setObsBehavior('');
      setObsNotes('');
    }
    setIsEditingObs(true);
    setActionError('');
  };

  const handleSaveObservation = async (e) => {
    e?.preventDefault();
    if (isSubmitting || !currentPet) return;

    if (selectedDate > todayVn) {
      setActionError('Ngày quan sát không được ở tương lai so với ngày hiện tại.');
      return;
    }

    setIsSubmitting(true);
    setActionError('');
    setSyncWarning('');

    const payload = {
      id: currentObservation?.id || `obs_${currentPet.id}_${selectedDate}_${Date.now()}`,
      petId: currentPet.id,
      ownerId: currentUser?.id,
      date: selectedDate,
      type: 'observation',
      mood: obsMood,
      behavior: obsBehavior.trim(),
      notes: obsNotes.trim(),
      // Bảo toàn các trường dữ liệu cũ nếu có
      questsDone: currentObservation?.questsDone || [],
      gesturesRecorded: currentObservation?.gesturesRecorded || [],
      updatedAt: new Date().toISOString()
    };

    try {
      let saved;
      if (currentObservation?.id) {
        saved = await apiUpdate('daily_logs', currentObservation.id, payload);
      } else {
        saved = await apiCreate('daily_logs', payload);
      }

      setLogs(prev => {
        const withoutOld = prev.filter(l => l.id !== payload.id);
        return [saved || payload, ...withoutOld];
      });

      setIsEditingObs(false);
      try { sound?.playSuccess?.(); } catch (_) {}

      // Đồng bộ nhẹ nhàng vào cache
      try {
        await syncAllDataToCache();
      } catch (syncErr) {
        setSyncWarning('Dữ liệu đã được lưu thành công trên máy chủ. Bạn có thể tải lại trang (F5) nếu chưa thấy hiển thị ngay.');
      }
    } catch (err) {
      console.error('[PetCare] Lỗi lưu quan sát:', err);
      setActionError(err.message || 'Không thể lưu ghi nhận quan sát. Vui lòng kiểm tra kết nối.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteObservation = async () => {
    if (!currentObservation || isSubmitting) return;
    if (!window.confirm('Bạn có chắc chắn muốn xóa ghi nhận quan sát này?')) return;

    setIsSubmitting(true);
    setActionError('');
    try {
      await apiDelete('daily_logs', currentObservation.id);
      setLogs(prev => prev.filter(l => l.id !== currentObservation.id));
      setIsEditingObs(false);
      try { sound?.playPop?.(); } catch (_) {}

      try { await syncAllDataToCache(); } catch (_) {}
    } catch (err) {
      console.error('[PetCare] Lỗi xóa quan sát:', err);
      setActionError(err.message || 'Không thể xóa ghi nhận quan sát.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================================================
  // XỬ LÝ HOẠT ĐỘNG GẮN KẾT (BONDING ACTIVITIES)
  // ============================================================================
  const handleOpenAddActivity = () => {
    setEditingActId(null);
    setActTitle('');
    setActTime('');
    setActEstDuration('');
    setActNote('');
    setActError('');
    setIsAddingAct(true);
  };

  const handleOpenEditActivity = (act) => {
    setEditingActId(act.id);
    setActTitle(act.title || '');
    setActTime(act.time || '');
    setActEstDuration(act.estimatedDuration ? String(act.estimatedDuration) : '');
    setActNote(act.note || '');
    setActError('');
    setIsAddingAct(true);
  };

  const handleSaveActivity = async (e) => {
    e?.preventDefault();
    if (isSubmitting || !currentPet) return;

    if (!actTitle || !actTitle.trim()) {
      setActError('Vui lòng nhập tên hoạt động gắn kết.');
      return;
    }

    if (actEstDuration && (isNaN(actEstDuration) || Number(actEstDuration) <= 0)) {
      setActError('Thời lượng dự kiến phải là số lớn hơn 0 phút.');
      return;
    }

    setIsSubmitting(true);
    setActError('');
    setActionError('');
    setSyncWarning('');

    const isEdit = Boolean(editingActId);
    const existing = isEdit ? dayActivities.find(a => a.id === editingActId) : null;

    const payload = {
      ...(existing || {}),
      id: editingActId || `act_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      petId: currentPet.id,
      ownerId: currentUser?.id,
      date: selectedDate,
      type: 'activity',
      title: actTitle.trim(),
      time: actTime ? formatTime24h(actTime) : null,
      estimatedDuration: actEstDuration ? Number(actEstDuration) : null,
      note: actNote.trim(),
      status: existing?.status || 'pending',
      updatedAt: new Date().toISOString()
    };

    if (!isEdit) {
      payload.createdAt = new Date().toISOString();
    }

    try {
      let saved;
      if (isEdit) {
        saved = await apiUpdate('daily_logs', editingActId, payload);
      } else {
        saved = await apiCreate('daily_logs', payload);
      }

      setLogs(prev => {
        const withoutOld = prev.filter(l => l.id !== payload.id);
        return [saved || payload, ...withoutOld];
      });

      setIsAddingAct(false);
      setEditingActId(null);
      try { sound?.playSuccess?.(); } catch (_) {}

      try { await syncAllDataToCache(); } catch (_) {}
    } catch (err) {
      console.error('[PetCare] Lỗi lưu hoạt động:', err);
      setActError(err.message || 'Không thể lưu hoạt động gắn kết.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xác nhận hoàn thành hoạt động
  const handleOpenCompleteModal = (act) => {
    if (act.status === 'cancelled') {
      setActionError('Không thể hoàn thành hoạt động đã bị hủy. Vui lòng phục hồi hoạt động trước.');
      return;
    }
    setCompletingAct(act);
    setCompleteActualDuration(act.estimatedDuration ? String(act.estimatedDuration) : '');
    setCompleteReaction(act.petReaction || 'Hào hứng, thích thú');
    setCompleteReactionNote(act.reactionNote || '');
    setCompleteError('');
  };

  const handleSubmitComplete = async (e) => {
    e?.preventDefault();
    if (isSubmitting || !completingAct) return;

    if (completeActualDuration && (isNaN(completeActualDuration) || Number(completeActualDuration) <= 0)) {
      setCompleteError('Thời lượng thực tế phải là một số lớn hơn 0 phút.');
      return;
    }

    setIsSubmitting(true);
    setCompleteError('');
    setActionError('');
    setSyncWarning('');

    const updates = {
      status: 'completed',
      actualDuration: completeActualDuration ? Number(completeActualDuration) : null,
      petReaction: completeReaction,
      reactionNote: completeReactionNote.trim(),
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      const saved = await apiUpdate('daily_logs', completingAct.id, updates);

      setLogs(prev => prev.map(l => (l.id === completingAct.id ? (saved || { ...l, ...updates }) : l)));

      setCompletingAct(null);
      if (timerActId === completingAct.id) {
        setIsTimerRunning(false);
        setTimerActId(null);
      }

      try {
        sound?.playSuccess?.();
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      } catch (_) {}

      try { await syncAllDataToCache(); } catch (_) {}
    } catch (err) {
      console.error('[PetCare] Lỗi hoàn thành hoạt động:', err);
      setCompleteError(err.message || 'Không thể xác nhận hoàn thành hoạt động.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Hủy hoạt động
  const handleCancelActivity = async (act) => {
    if (isSubmitting) return;
    if (!window.confirm(`Bạn có chắc chắn muốn hủy hoạt động "${act.title}"?`)) return;

    setIsSubmitting(true);
    setActionError('');
    try {
      const updates = {
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const saved = await apiUpdate('daily_logs', act.id, updates);
      setLogs(prev => prev.map(l => (l.id === act.id ? (saved || { ...l, ...updates }) : l)));

      if (timerActId === act.id) {
        setIsTimerRunning(false);
        setTimerActId(null);
      }
      try { sound?.playClick?.(); } catch (_) {}
      try { await syncAllDataToCache(); } catch (_) {}
    } catch (err) {
      console.error('[PetCare] Lỗi hủy hoạt động:', err);
      setActionError(err.message || 'Không thể hủy hoạt động.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Phục hồi hoạt động đã hủy
  const handleRestoreActivity = async (act) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setActionError('');
    try {
      const updates = {
        status: 'pending',
        cancelledAt: null,
        updatedAt: new Date().toISOString()
      };
      const saved = await apiUpdate('daily_logs', act.id, updates);
      setLogs(prev => prev.map(l => (l.id === act.id ? (saved || { ...l, ...updates }) : l)));
      try { sound?.playSuccess?.(); } catch (_) {}
      try { await syncAllDataToCache(); } catch (_) {}
    } catch (err) {
      console.error('[PetCare] Lỗi phục hồi hoạt động:', err);
      setActionError(err.message || 'Không thể phục hồi hoạt động.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xóa hoạt động
  const handleDeleteActivity = async (act) => {
    if (isSubmitting) return;
    if (!window.confirm(`Xóa hoàn toàn hoạt động "${act.title}"?`)) return;

    setIsSubmitting(true);
    setActionError('');
    try {
      await apiDelete('daily_logs', act.id);
      setLogs(prev => prev.filter(l => l.id !== act.id));
      if (timerActId === act.id) {
        setIsTimerRunning(false);
        setTimerActId(null);
      }
      try { sound?.playPop?.(); } catch (_) {}
      try { await syncAllDataToCache(); } catch (_) {}
    } catch (err) {
      console.error('[PetCare] Lỗi xóa hoạt động:', err);
      setActionError(err.message || 'Không thể xóa hoạt động.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Điều khiển Timer
  const handleToggleTimer = (act) => {
    if (timerActId === act.id) {
      setIsTimerRunning(!isTimerRunning);
      try { sound?.playClick?.(); } catch (_) {}
    } else {
      const durMinutes = act.estimatedDuration || 10;
      setTimerActId(act.id);
      setTimerSecondsLeft(durMinutes * 60);
      setIsTimerRunning(true);
      try { sound?.playClick?.(); } catch (_) {}
    }
  };

  const handleResetTimer = (act) => {
    const durMinutes = act.estimatedDuration || 10;
    setTimerSecondsLeft(durMinutes * 60);
    setIsTimerRunning(false);
    try { sound?.playClick?.(); } catch (_) {}
  };

  // ============================================================================
  // XỬ LÝ NHẬT KÝ HÀNH VI (BEHAVIORAL LOG)
  // ============================================================================
  const handleOpenAddBehavior = () => {
    setEditingBhvId(null);
    setBhvDate(selectedDate);
    setBhvTime(getCurrentVnTime().slice(0, 5));
    setBhvBehavior('');
    setBhvContext('');
    setBhvNote('');
    setBhvError('');
    setIsAddingBhv(true);
  };

  const handleOpenEditBehavior = (bhv) => {
    setEditingBhvId(bhv.id);
    setBhvDate(bhv.date || selectedDate);
    setBhvTime(bhv.time || getCurrentVnTime().slice(0, 5));
    setBhvBehavior(bhv.behavior || '');
    setBhvContext(bhv.context || '');
    setBhvNote(bhv.note || '');
    setBhvError('');
    setIsAddingBhv(true);
  };

  const handleSaveBehavior = async (e) => {
    e?.preventDefault();
    if (isSubmitting || !currentPet) return;

    if (!bhvBehavior || !bhvBehavior.trim()) {
      setBhvError('Vui lòng nhập biểu hiện hành vi quan sát được.');
      return;
    }

    if (bhvDate > todayVn) {
      setBhvError('Ngày quan sát không được ở tương lai so với ngày hiện tại.');
      return;
    }

    if (bhvDate === todayVn && bhvTime) {
      const currentVn = getCurrentVnTime().slice(0, 5);
      if (bhvTime > currentVn) {
        setBhvError(`Giờ quan sát (${bhvTime}) không được ở tương lai so với giờ hiện tại (${currentVn}) tại Việt Nam.`);
        return;
      }
    }

    setIsSubmitting(true);
    setBhvError('');
    setActionError('');
    setSyncWarning('');

    const isEdit = Boolean(editingBhvId);
    const existing = isEdit ? dayBehaviors.find(b => b.id === editingBhvId) : null;

    const payload = {
      ...(existing || {}),
      id: editingBhvId || `bhv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      petId: currentPet.id,
      ownerId: currentUser?.id,
      date: bhvDate,
      time: bhvTime ? formatTime24h(bhvTime) : null,
      type: 'behavior',
      behavior: bhvBehavior.trim(),
      context: bhvContext.trim(),
      note: bhvNote.trim(),
      updatedAt: new Date().toISOString()
    };

    if (!isEdit) {
      payload.createdAt = new Date().toISOString();
    }

    try {
      let saved;
      if (isEdit) {
        saved = await apiUpdate('daily_logs', editingBhvId, payload);
      } else {
        saved = await apiCreate('daily_logs', payload);
      }

      setLogs(prev => {
        const withoutOld = prev.filter(l => l.id !== payload.id);
        return [saved || payload, ...withoutOld];
      });

      setIsAddingBhv(false);
      setEditingBhvId(null);
      try { sound?.playSuccess?.(); } catch (_) {}
      try { await syncAllDataToCache(); } catch (_) {}
    } catch (err) {
      console.error('[PetCare] Lỗi lưu nhật ký hành vi:', err);
      setBhvError(err.message || 'Không thể lưu nhật ký hành vi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBehavior = async (bhv) => {
    if (isSubmitting) return;
    if (!window.confirm('Bạn có chắc chắn muốn xóa bản ghi nhật ký hành vi này?')) return;

    setIsSubmitting(true);
    setActionError('');
    try {
      await apiDelete('daily_logs', bhv.id);
      setLogs(prev => prev.filter(l => l.id !== bhv.id));
      try { sound?.playPop?.(); } catch (_) {}
      try { await syncAllDataToCache(); } catch (_) {}
    } catch (err) {
      console.error('[PetCare] Lỗi xóa nhật ký hành vi:', err);
      setActionError(err.message || 'Không thể xóa nhật ký hành vi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================================================
  // EMPTY STATE KHI CHƯA CÓ THÚ CƯNG
  // ============================================================================
  if (!pets || pets.length === 0) {
    return (
      <PageContainer id="bonding-page">
        <EmptyState
          icon={Activity}
          title="Chưa có hồ sơ thú cưng"
          description="Vui lòng thêm thú cưng để bắt đầu ghi nhận quan sát hôm nay, tạo hoạt động gắn kết và theo dõi nhật ký hành vi."
          actionText="Thêm thú cưng ngay"
          onAction={() => {
            try { sound?.playClick?.(); } catch (_) {}
            window.dispatchEvent(new CustomEvent('petcare_open_add_pet'));
          }}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer id="bonding-page">
      {/* 1. Header chuẩn hóa */}
      <PageHeader
        title="Hoạt động & Nhật ký"
        subtitle="Theo dõi sức khỏe tinh thần, lịch trình gắn kết và biểu hiện thực tế từng ngày"
        actions={
          totalActiveActivities > 0 ? (
            <div className="flex items-center gap-2 h-11 px-4 rounded-xl bg-white dark:bg-[#12192A] border border-slate-200 dark:border-white/10 text-xs shadow-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Tiến độ hôm nay:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {completedActivitiesCount}/{totalActiveActivities} ({progressPercent}%)
              </span>
            </div>
          ) : null
        }
      />

      {/* 2. Bộ chọn thú cưng và ngày thành 1 hàng công cụ FilterBar */}
      <FilterBar>
        {/* Bộ chọn thú cưng */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {pets.map(p => {
            const isSelected = p.id === selectedPetId;
            return (
              <button
                key={p.id}
                onClick={() => {
                  try { sound?.playClick?.(); } catch (_) {}
                  setSelectedPetId(p.id);
                }}
                className={`h-10 px-3.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 shrink-0 cursor-pointer border ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white dark:bg-[#12192A] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5'
                }`}
              >
                {p.avatar ? (
                  <img src={p.avatar} alt={p.name} className="w-4 h-4 rounded-full object-cover" />
                ) : (
                  <span className="text-xs">🐾</span>
                )}
                <span>{p.name}</span>
              </button>
            );
          })}
        </div>

        {/* Bộ chọn ngày */}
        <div className="flex items-center gap-2 ml-auto">
          <div className="flex items-center gap-1.5 bg-white dark:bg-[#12192A] border border-slate-200 dark:border-white/10 rounded-xl px-3 h-10 shadow-xs">
            <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                try { sound?.playClick?.(); } catch (_) {}
                setSelectedDate(e.target.value);
              }}
              className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
            />
          </div>
          {selectedDate !== todayVn && (
            <button
              onClick={() => {
                try { sound?.playClick?.(); } catch (_) {}
                setSelectedDate(todayVn);
              }}
              className="h-10 px-3 text-xs font-semibold rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-100 transition-all cursor-pointer"
            >
              Hôm nay
            </button>
          )}
        </div>
      </FilterBar>

      {/* 3. Tabs: Quan sát, Hoạt động, Nhật ký, Lịch sử */}
      <Tabs
        tabs={[
          { id: 'observation', label: 'Quan sát', icon: Eye },
          { id: 'activities', label: 'Hoạt động', icon: Target, badge: dayActivities.length },
          { id: 'behavior', label: 'Nhật ký', icon: BookOpen, badge: dayBehaviors.length },
          { id: 'history', label: 'Lịch sử', icon: History }
        ]}
        activeTab={activeTab}
        onChange={(id) => {
          try { sound?.playClick?.(); } catch (_) {}
          setActiveTab(id);
        }}
        variant="pill"
      />

      {/* Thông báo lỗi nếu có */}
      {loadError && (
        <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{loadError}</span>
          </div>
          <button
            onClick={loadData}
            className="px-2.5 py-1 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors cursor-pointer text-[11px]"
          >
            Thử lại
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            onClick={() => setActionError('')}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {syncWarning && (
        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0" />
            <span>{syncWarning}</span>
          </div>
          <button
            onClick={() => setSyncWarning('')}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 4. Nội dung chính (cuộn tự nhiên theo trang, không lồng scroll container) */}
      <div className="space-y-6">
        
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Đang tải dữ liệu hoạt động & nhật ký từ máy chủ...
            </span>
          </div>
        ) : (
          <>
            {/* -------------------------------------------------------------- */}
            {/* PHÂN MỤC 1: QUAN SÁT HÔM NAY (DAILY OBSERVATION)               */}
            {/* -------------------------------------------------------------- */}
            {activeTab === 'observation' && (
              <section className="bg-white dark:bg-[#121626] border border-slate-200 dark:border-white/10 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
                
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5 flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">👁️</span>
                    <div>
                      <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                        Quan Sát Trong Ngày ({formatDateVi(selectedDate)})
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                        Ghi nhận trạng thái tâm lý, năng lượng và biểu hiện thực tế của bé.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {currentObservation && !isEditingObs && (
                      <button
                        onClick={handleDeleteObservation}
                        disabled={isSubmitting}
                        className="px-3 py-1.5 text-xs font-semibold rounded-xl text-rose-500 hover:bg-rose-500/10 border border-rose-500/20 transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Xóa</span>
                      </button>
                    )}
                    <button
                      onClick={isEditingObs ? () => setIsEditingObs(false) : handleOpenEditObservation}
                      className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      {isEditingObs ? (
                        <>
                          <X className="w-3.5 h-3.5" />
                          <span>Hủy chỉnh sửa</span>
                        </>
                      ) : currentObservation ? (
                        <>
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Chỉnh sửa ghi nhận</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Thêm quan sát</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Form Nhập/Sửa Quan Sát */}
                {isEditingObs ? (
                  <form onSubmit={handleSaveObservation} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 space-y-4">
                    
                    {/* Trạng thái chọn nhanh */}
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
                        Trạng thái quan sát được:
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {MOOD_OPTIONS.map(opt => {
                          const isSel = obsMood === opt.id;
                          return (
                            <button
                              type="button"
                              key={opt.id}
                              onClick={() => setObsMood(opt.id)}
                              className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                                isSel 
                                  ? `${opt.color} ring-2 ring-indigo-500/30 font-bold shadow-sm` 
                                  : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                              }`}
                            >
                              <span className="text-base">{opt.icon}</span>
                              <span className="text-[11px] truncate">{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Biểu hiện thực tế quan sát được */}
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Biểu hiện quan sát thực tế (tùy chọn):
                      </label>
                      <input
                        type="text"
                        value={obsBehavior}
                        onChange={(e) => setObsBehavior(e.target.value)}
                        placeholder="Ví dụ: Vẫy đuôi mừng rỡ khi thấy chủ, nằm một góc thở dài, cào cửa đòi ra ngoài..."
                        className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    {/* Ghi chú thêm */}
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Ghi chú bổ sung (tùy chọn):
                      </label>
                      <textarea
                        rows={2}
                        value={obsNotes}
                        onChange={(e) => setObsNotes(e.target.value)}
                        placeholder="Ghi chú thêm về điều kiện thời tiết, ăn uống hoặc biểu hiện khác..."
                        className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsEditingObs(false)}
                        className="px-4 py-2 text-xs font-medium rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                      >
                        {isSubmitting ? 'Đang lưu...' : 'Lưu ghi nhận'}
                      </button>
                    </div>

                  </form>
                ) : currentObservation ? (
                  /* Hiển thị chi tiết Quan sát đã ghi nhận */
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {(() => {
                          const opt = MOOD_OPTIONS.find(m => m.id === currentObservation.mood) || MOOD_OPTIONS[0];
                          return (
                            <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${opt.color}`}>
                              <span>{opt.icon}</span>
                              <span>{opt.label}</span>
                            </span>
                          );
                        })()}
                        <span className="text-[11px] text-slate-400 font-mono">
                          Ghi nhận ngày {currentObservation.date}
                        </span>
                      </div>

                      {currentObservation.behavior && (
                        <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100">
                          Biểu hiện: <span className="font-normal">{currentObservation.behavior}</span>
                        </p>
                      )}

                      {currentObservation.notes && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 italic">
                          "{currentObservation.notes}"
                        </p>
                      )}
                    </div>

                    <button
                      onClick={handleOpenEditObservation}
                      className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-white/20 transition-all shrink-0 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Sửa ghi nhận</span>
                    </button>
                  </div>
                ) : (
                  /* Trạng thái chưa ghi nhận */
                  <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-300 dark:border-white/15 text-center space-y-2">
                    <span className="text-2xl block">📋</span>
                    <span className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 block">
                      Chưa ghi nhận quan sát cho ngày {formatDateVi(selectedDate)}
                    </span>
                    <p className="text-xs text-slate-500 dark:text-slate-500 max-w-sm mx-auto">
                      Hãy dành 1 phút quan sát biểu hiện của bé hôm nay để lưu lại nhật ký theo dõi.
                    </p>
                    <button
                      onClick={handleOpenEditObservation}
                      className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm ghi nhận hôm nay</span>
                    </button>
                  </div>
                )}

                {/* THÔNG TIN THAM KHẢO THEO LOÀI: DẠNG KHỐI MỞ RỘNG COLLAPSIBLE */}
                <details className="mt-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-500/20 p-3.5 group">
                  <summary className="flex items-center justify-between cursor-pointer select-none">
                    <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                      <Lightbulb className="w-4 h-4 text-amber-500" />
                      Thông tin tham khảo sinh học theo loài ({refData.speciesName})
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 group-open:rotate-180 transition-transform">
                      ▼
                    </span>
                  </summary>
                  <div className="pt-3 space-y-1.5 border-t border-indigo-200/50 dark:border-indigo-500/20 mt-2.5">
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
                      {refData.advice}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                      Nghiên cứu tập tính: {refData.science}
                    </p>
                  </div>
                </details>

              </section>
            )}

            {/* -------------------------------------------------------------- */}
            {/* PHÂN MỤC 2: HOẠT ĐỘNG GẮN KẾT (BONDING ACTIVITIES)             */}
            {/* -------------------------------------------------------------- */}
            {activeTab === 'activities' && (
              <section className="bg-white dark:bg-[#12192A] border border-slate-200 dark:border-white/10 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
                
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5 flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">🎯</span>
                    <div>
                      <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                        Hoạt Động Gắn Kết Trong Ngày ({dayActivities.length})
                      </h2>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        Người dùng chủ động tạo hoạt động tương tác, đặt giờ và xác nhận kết quả thực tế.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleOpenAddActivity}
                    className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Thêm hoạt động</span>
                  </button>
                </div>

                {/* Form Thêm/Sửa Hoạt Động */}
                {isAddingAct && (
                  <form onSubmit={handleSaveActivity} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 space-y-3">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      {editingActId ? 'Chỉnh sửa hoạt động' : 'Tạo hoạt động gắn kết mới'}
                    </h3>

                    {actError && (
                      <div className="text-xs text-rose-500 font-bold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{actError}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-6">
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          Tên hoạt động <span className="text-rose-500">*</span>:
                        </label>
                        <input
                          type="text"
                          value={actTitle}
                          onChange={(e) => setActTitle(e.target.value)}
                          placeholder="Ví dụ: Chải lông thư giãn, Vờn cần câu, Đi dạo công viên..."
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          Giờ thực hiện (tùy chọn):
                        </label>
                        <input
                          type="time"
                          value={actTime}
                          onChange={(e) => setActTime(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          Dự kiến (phút, tùy chọn):
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="240"
                          value={actEstDuration}
                          onChange={(e) => setActEstDuration(e.target.value)}
                          placeholder="Số phút > 0"
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Ghi chú hướng dẫn / chuẩn bị (tùy chọn):
                      </label>
                      <input
                        type="text"
                        value={actNote}
                        onChange={(e) => setActNote(e.target.value)}
                        placeholder="Chuẩn bị bánh thưởng, đồ chơi yêu thích hoặc địa điểm..."
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => { setIsAddingAct(false); setEditingActId(null); }}
                        className="px-3.5 py-1.5 text-xs font-bold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-4 py-1.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isSubmitting ? 'Đang lưu...' : 'Lưu hoạt động'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Danh sách các hoạt động trong ngày */}
                {dayActivities.length > 0 ? (
                  <div className="space-y-3">
                    {dayActivities.map(act => {
                      const isCompleted = act.status === 'completed';
                      const isCancelled = act.status === 'cancelled';
                      const isTimerActive = timerActId === act.id;

                      return (
                        <div
                          key={act.id}
                          className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                            isCompleted
                              ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-500/30'
                              : isCancelled
                              ? 'bg-slate-100/80 dark:bg-slate-900/40 border-slate-300 dark:border-white/5 opacity-75'
                              : isTimerActive
                              ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-400 dark:border-indigo-500/50 shadow-md ring-1 ring-indigo-500/20'
                              : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                          }`}
                        >
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className={`text-xs sm:text-sm font-bold ${
                                isCompleted 
                                  ? 'text-emerald-800 dark:text-emerald-300' 
                                  : isCancelled
                                  ? 'line-through text-slate-500 dark:text-slate-400'
                                  : 'text-slate-900 dark:text-white'
                              }`}>
                                {act.title}
                              </h4>

                              {isCompleted && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                  <Check className="w-3 h-3 stroke-[3]" />
                                  Đã hoàn thành
                                </span>
                              )}

                              {isCancelled && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                  Đã hủy
                                </span>
                              )}

                              {act.time && (
                                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-indigo-500" /> {formatTime24h(act.time)}
                                </span>
                              )}

                              {act.estimatedDuration && (
                                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                  (Dự kiến: {act.estimatedDuration} phút)
                                </span>
                              )}
                            </div>

                            {/* Ghi chú dự kiến */}
                            {act.note && (
                              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                {act.note}
                              </p>
                            )}

                            {/* Chi tiết khi đã hoàn thành */}
                            {isCompleted && (
                              <div className="mt-2 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-500/20 text-xs space-y-1">
                                <div className="flex items-center gap-2 flex-wrap font-medium">
                                  <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                                    Thực tế: {act.actualDuration !== null && act.actualDuration !== undefined ? `${act.actualDuration} phút` : 'Chưa ghi nhận thời lượng'}
                                  </span>
                                  {act.petReaction && (
                                    <span className="text-slate-600 dark:text-slate-300">
                                      • Phản ứng: <strong>{act.petReaction}</strong>
                                    </span>
                                  )}
                                </div>
                                {act.reactionNote && (
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                                    Ghi chú phản ứng: "{act.reactionNote}"
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Bộ nút thao tác trên hoạt động */}
                          <div className="flex items-center gap-2 flex-wrap self-end md:self-center shrink-0">
                            
                            {/* Bộ hẹn giờ cho hoạt động đang chờ */}
                            {!isCompleted && !isCancelled && (
                              <>
                                {isTimerActive ? (
                                  <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-indigo-400 dark:border-indigo-500/40 px-2.5 py-1 rounded-xl shadow-inner">
                                    <span className="font-mono text-xs font-black text-indigo-600 dark:text-indigo-400">
                                      {formatTimerDisplay(timerSecondsLeft)}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleTimer(act)}
                                      className="p-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer"
                                      title={isTimerRunning ? 'Tạm dừng' : 'Tiếp tục'}
                                    >
                                      {isTimerRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-white" />}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleResetTimer(act)}
                                      className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                                      title="Đặt lại"
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleTimer(act)}
                                    className="px-2.5 py-1 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-slate-300 transition-all flex items-center gap-1 cursor-pointer"
                                  >
                                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                                    <span>Hẹn giờ</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleOpenCompleteModal(act)}
                                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  <span>Hoàn thành</span>
                                </button>
                              </>
                            )}

                            {/* Nút sửa */}
                            <button
                              type="button"
                              onClick={() => handleOpenEditActivity(act)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
                              title="Chỉnh sửa hoạt động"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {/* Nút Hủy / Phục hồi */}
                            {!isCancelled ? (
                              <button
                                type="button"
                                onClick={() => handleCancelActivity(act)}
                                className="px-2.5 py-1 rounded-lg text-xs font-medium text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              >
                                Hủy
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRestoreActivity(act)}
                                className="px-2.5 py-1 rounded-lg text-xs font-medium text-indigo-500 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                              >
                                Phục hồi
                              </button>
                            )}

                            {/* Nút Xóa */}
                            <button
                              type="button"
                              onClick={() => handleDeleteActivity(act)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                              title="Xóa hoạt động"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                          </div>

                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-300 dark:border-white/15 text-center space-y-2">
                    <span className="text-2xl block">🎯</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400 block">
                      Chưa có hoạt động gắn kết nào trong ngày {formatDateVi(selectedDate)}
                    </span>
                    <p className="text-xs text-slate-500 dark:text-slate-500 max-w-sm mx-auto">
                      Hãy tạo một hoạt động vui chơi, tập luyện hoặc chăm sóc cùng bé để ghi nhận tiến độ.
                    </p>
                    <button
                      onClick={handleOpenAddActivity}
                      className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow transition-all cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tạo hoạt động đầu tiên</span>
                    </button>
                  </div>
                )}

              </section>
            )}

            {/* -------------------------------------------------------------- */}
            {/* PHÂN MỤC 3: NHẬT KÝ HÀNH VI (BEHAVIORAL LOG)                    */}
            {/* -------------------------------------------------------------- */}
            {activeTab === 'behavior' && (
              <section className="bg-white dark:bg-[#12192A] border border-slate-200 dark:border-white/10 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
                
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5 flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">📝</span>
                    <div>
                      <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                        Nhật Ký Hành Vi ({dayBehaviors.length})
                      </h2>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        Ghi nhận các biểu hiện, thói quen và hoàn cảnh thực tế mà không tự gán chẩn đoán bệnh.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleOpenAddBehavior}
                    className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Ghi nhận hành vi</span>
                  </button>
                </div>

                {/* Form Thêm/Sửa Nhật Ký Hành Vi */}
                {isAddingBhv && (
                  <form onSubmit={handleSaveBehavior} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 space-y-3">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      {editingBhvId ? 'Chỉnh sửa nhật ký hành vi' : 'Ghi nhận hành vi mới'}
                    </h3>

                    {bhvError && (
                      <div className="text-xs text-rose-500 font-bold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{bhvError}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-6">
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          Ngày quan sát <span className="text-rose-500">*</span>:
                        </label>
                        <input
                          type="date"
                          max={todayVn}
                          value={bhvDate}
                          onChange={(e) => setBhvDate(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="sm:col-span-6">
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          Giờ quan sát (tùy chọn):
                        </label>
                        <input
                          type="time"
                          value={bhvTime}
                          onChange={(e) => setBhvTime(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Biểu hiện hành vi quan sát thấy <span className="text-rose-500">*</span>:
                      </label>
                      <input
                        type="text"
                        value={bhvBehavior}
                        onChange={(e) => setBhvBehavior(e.target.value)}
                        placeholder="Ví dụ: Cào móng vào sofa, giật mình khi có sấm chớp, sủa người lạ đi ngang..."
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Hoàn cảnh xuất hiện (tùy chọn):
                      </label>
                      <input
                        type="text"
                        value={bhvContext}
                        onChange={(e) => setBhvContext(e.target.value)}
                        placeholder="Ví dụ: Khi chủ vừa rời nhà, sau khi ăn xong, khi khách bấm chuông..."
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Ghi chú bổ sung (tùy chọn):
                      </label>
                      <textarea
                        rows={2}
                        value={bhvNote}
                        onChange={(e) => setBhvNote(e.target.value)}
                        placeholder="Ghi chú chi tiết thêm về phản ứng hoặc biện pháp xử lý..."
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => { setIsAddingBhv(false); setEditingBhvId(null); }}
                        className="px-3.5 py-1.5 text-xs font-bold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-4 py-1.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isSubmitting ? 'Đang lưu...' : 'Lưu nhật ký'}
                      </button>
                    </div>

                  </form>
                )}

                {/* Danh sách các bản ghi nhật ký hành vi trong ngày */}
                {dayBehaviors.length > 0 ? (
                  <div className="space-y-3">
                    {dayBehaviors.map(bhv => (
                      <div
                        key={bhv.id}
                        className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3"
                      >
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                              {bhv.behavior}
                            </span>
                            {bhv.time && (
                              <span className="text-[10px] font-mono text-slate-600 dark:text-slate-300 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span>{formatTime24h(bhv.time)}</span>
                              </span>
                            )}
                          </div>

                          {bhv.context && (
                            <p className="text-xs text-slate-600 dark:text-slate-300">
                              Hoàn cảnh: <strong className="font-semibold text-indigo-600 dark:text-indigo-400">{bhv.context}</strong>
                            </p>
                          )}

                          {bhv.note && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                              "{bhv.note}"
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                          <button
                            type="button"
                            onClick={() => handleOpenEditBehavior(bhv)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
                            title="Sửa nhật ký"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBehavior(bhv)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Xóa nhật ký"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-300 dark:border-white/15 text-center space-y-2">
                    <span className="text-2xl block">📖</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400 block">
                      Chưa có nhật ký hành vi nào trong ngày {formatDateVi(selectedDate)}
                    </span>
                    <p className="text-xs text-slate-500 dark:text-slate-500 max-w-sm mx-auto">
                      Ghi nhận lại các biểu hiện đặc biệt để bác sĩ thú y có căn cứ chính xác khi thăm khám.
                    </p>
                    <button
                      onClick={handleOpenAddBehavior}
                      className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow transition-all cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Ghi nhận hành vi đầu tiên</span>
                    </button>
                  </div>
                )}

              </section>
            )}

            {/* -------------------------------------------------------------- */}
            {/* PHÂN MỤC 4: LỊCH SỬ & THỐNG KÊ (HISTORY)                       */}
            {/* -------------------------------------------------------------- */}
            {activeTab === 'history' && (
              <section className="bg-white dark:bg-[#12192A] border border-slate-200 dark:border-white/10 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
                
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5 flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">📜</span>
                    <div>
                      <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                        Lịch Sử & Thống Kê Thực Tế ({historyList.length} bản ghi)
                      </h2>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        Tra cứu các quan sát, hoạt động và hành vi đã lưu theo khoảng thời gian thực tế.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bộ lọc khoảng ngày & phân loại */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                  
                  {/* Khoảng ngày */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-600 dark:text-slate-400">Từ:</span>
                    <input
                      type="date"
                      value={histFromDate}
                      onChange={(e) => setHistFromDate(e.target.value)}
                      className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-100 font-medium"
                    />
                    <span className="font-bold text-slate-600 dark:text-slate-400">Đến:</span>
                    <input
                      type="date"
                      value={histToDate}
                      onChange={(e) => setHistToDate(e.target.value)}
                      className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-100 font-medium"
                    />
                  </div>

                  {/* Lọc loại bản ghi */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-600 dark:text-slate-400">Loại:</span>
                    <select
                      value={histTypeFilter}
                      onChange={(e) => setHistTypeFilter(e.target.value)}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-100 font-medium cursor-pointer"
                    >
                      <option value="all">Tất cả loại bản ghi</option>
                      <option value="observation">Chỉ quan sát ngày</option>
                      <option value="activity">Chỉ hoạt động gắn kết</option>
                      <option value="behavior">Chỉ nhật ký hành vi</option>
                    </select>

                    <select
                      value={histPetFilter}
                      onChange={(e) => setHistPetFilter(e.target.value)}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-100 font-medium cursor-pointer"
                    >
                      <option value="selected">Chỉ {currentPet?.name || 'thú cưng này'}</option>
                      <option value="all">Tất cả thú cưng của tôi</option>
                    </select>
                  </div>

                </div>

                {/* Khối Thống kê thực tế (KHÔNG TỰ TẠO SỐ LIỆU GIẢ) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Hoạt động tạo</span>
                    <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                      {historyStats.totalActs}
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase block">Đã hoàn thành</span>
                    <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
                      {historyStats.completedActs}
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center">
                    <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase block">Đã hủy</span>
                    <span className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400">
                      {historyStats.cancelledActs}
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-center">
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase block">Hành vi ghi nhận</span>
                    <span className="text-base sm:text-lg font-black text-indigo-600 dark:text-indigo-400">
                      {historyStats.totalBhvs}
                    </span>
                  </div>
                </div>

                {/* Danh sách Dòng thời gian Lịch sử */}
                {historyList.length > 0 ? (
                  <div className="space-y-2.5">
                    {historyList.map(item => {
                      const itemPet = pets.find(p => p.id === item.petId);
                      const type = item.type || (item.title ? 'activity' : item.behavior && !item.mood ? 'behavior' : 'observation');

                      return (
                        <div
                          key={item.id}
                          className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                <span>{item.date}</span>
                                {formatTime24h(item.time, item.createdAt) && (
                                  <>
                                    <span className="text-slate-400">•</span>
                                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                                    <span>{formatTime24h(item.time, item.createdAt)}</span>
                                  </>
                                )}
                              </span>

                              {itemPet && histPetFilter === 'all' && (
                                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                  [{itemPet.name}]
                                </span>
                              )}

                              {type === 'observation' && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20">
                                  Quan sát: {item.mood || 'Đã ghi nhận'}
                                </span>
                              )}

                              {type === 'activity' && (
                                <span className={`px-2 py-0.5 rounded-full font-bold border ${
                                  item.status === 'completed'
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                    : item.status === 'cancelled'
                                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                    : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                                }`}>
                                  Hoạt động: {item.status === 'completed' ? 'Hoàn thành' : item.status === 'cancelled' ? 'Đã hủy' : 'Chờ thực hiện'}
                                </span>
                              )}

                              {type === 'behavior' && (
                                <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold border border-cyan-500/20">
                                  Hành vi
                                </span>
                              )}
                            </div>

                            {/* Chi tiết nội dung */}
                            <p className="text-slate-800 dark:text-slate-200 font-medium">
                              {type === 'activity' ? (
                                <>
                                  <strong className="text-slate-900 dark:text-white">{item.title}</strong>
                                  {item.actualDuration !== null && item.actualDuration !== undefined && (
                                    <span className="text-slate-500 ml-2">
                                      (Thực tế: {item.actualDuration} phút)
                                    </span>
                                  )}
                                  {item.status === 'completed' && item.actualDuration === null && (
                                    <span className="text-slate-400 ml-2 italic">
                                      (Chưa ghi nhận thời lượng)
                                    </span>
                                  )}
                                  {item.petReaction && (
                                    <span className="text-emerald-600 dark:text-emerald-400 ml-2">
                                      • Phản ứng: {item.petReaction}
                                    </span>
                                  )}
                                </>
                              ) : type === 'behavior' ? (
                                <>
                                  <strong className="text-slate-900 dark:text-white">{item.behavior}</strong>
                                  {item.context && (
                                    <span className="text-slate-500 ml-2">
                                      [Hoàn cảnh: {item.context}]
                                    </span>
                                  )}
                                </>
                              ) : (
                                <>
                                  {item.behavior && <span>Biểu hiện: {item.behavior}</span>}
                                  {item.notes && <span className="italic text-slate-500 ml-2">"{item.notes}"</span>}
                                </>
                              )}
                            </p>
                          </div>

                          <div className="shrink-0 self-end sm:self-center">
                            <button
                              onClick={() => {
                                try { sound?.playClick?.(); } catch (_) {}
                                setSelectedDate(item.date);
                                if (type === 'observation') setActiveTab('observation');
                                else if (type === 'activity') setActiveTab('activities');
                                else if (type === 'behavior') setActiveTab('behavior');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-indigo-600 transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <span>Xem ngày này</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-300 dark:border-white/15 text-center space-y-1">
                    <span className="text-xl block">📂</span>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block">
                      Không tìm thấy bản ghi nào trong khoảng thời gian đã chọn
                    </span>
                  </div>
                )}

              </section>
            )}
          </>
        )}

      </div>

      {/* ==================================================================== */}
      {/* 4. MODAL XÁC NHẬN HOÀN THÀNH HOẠT ĐỘNG                                */}
      {/* ==================================================================== */}
      <Modal
        isOpen={Boolean(completingAct)}
        onClose={() => setCompletingAct(null)}
        title="Xác nhận hoàn thành hoạt động"
        size="md"
      >
        {completingAct && (
          <form onSubmit={handleSubmitComplete} className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
              Hoạt động: <strong className="text-slate-900 dark:text-white">{completingAct.title}</strong>
            </p>

            {completeError && (
              <div className="text-xs text-rose-500 font-bold flex items-center gap-1.5 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{completeError}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Thời lượng thực tế (phút, tùy chọn):
              </label>
              <input
                type="number"
                min="1"
                max="480"
                value={completeActualDuration}
                onChange={(e) => setCompleteActualDuration(e.target.value)}
                placeholder="Nhập số phút thực tế đã thực hiện"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Phản ứng của bé:
              </label>
              <select
                value={completeReaction}
                onChange={(e) => setCompleteReaction(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="Hào hứng, thích thú">Hào hứng, thích thú</option>
                <option value="Hợp tác, ngoan ngoãn">Hợp tác, ngoan ngoãn</option>
                <option value="Thờ ơ, ít quan tâm">Thờ ơ, ít quan tâm</option>
                <option value="Căng thẳng, khó chịu">Căng thẳng, khó chịu</option>
                <option value="Khác (tự ghi chú)">Khác (tự ghi chú)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Ghi chú phản ứng thực tế (tùy chọn):
              </label>
              <textarea
                rows={2}
                value={completeReactionNote}
                onChange={(e) => setCompleteReactionNote(e.target.value)}
                placeholder="Bé rất thích đồ chơi này, hay ngáp nhẹ khi xoa cằm..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-white/5">
              <button
                type="button"
                onClick={() => setCompletingAct(null)}
                className="px-4 py-2.5 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{isSubmitting ? 'Đang lưu...' : 'Xác nhận hoàn thành'}</span>
              </button>
            </div>
          </form>
        )}
      </Modal>

    </PageContainer>
  );
};

export default PetBondingView;
