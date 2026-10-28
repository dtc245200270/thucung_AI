import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  X, 
  Sparkles, 
  Check, 
  Calendar, 
  ShieldAlert, 
  CheckCircle2, 
  Circle, 
  Info, 
  Bot,
  PawPrint
} from 'lucide-react';
import { generateAiCarePlan } from '../../services/aiService';
import { ScheduleBadge } from '../common/Badges';

export const AiScheduleModal = ({
  isOpen,
  onClose,
  pets = [],
  initialPetId = null,
  onApplyCarePlan
}) => {
  const [selectedPetId, setSelectedPetId] = useState(initialPetId || pets[0]?.id || '');
  const [generatedPlan, setGeneratedPlan] = useState([]);
  const [selectedIndexes, setSelectedIndexes] = useState({});

  const selectedPet = pets.find(p => p.id === selectedPetId) || pets[0];

  useEffect(() => {
    if (initialPetId) {
      setSelectedPetId(initialPetId);
    } else if (pets.length > 0 && !selectedPetId) {
      setSelectedPetId(pets[0].id);
    }
  }, [initialPetId, pets]);

  useEffect(() => {
    if (selectedPet) {
      const plan = generateAiCarePlan(selectedPet);
      setGeneratedPlan(plan);
      // Mặc định chọn tất cả
      const initialMap = {};
      plan.forEach((_, idx) => { initialMap[idx] = true; });
      setSelectedIndexes(initialMap);
    }
  }, [selectedPetId, selectedPet]);

  if (!isOpen) return null;

  const toggleSelectIndex = (idx) => {
    setSelectedIndexes(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const handleApply = () => {
    const selectedPlans = generatedPlan
      .filter((_, idx) => selectedIndexes[idx])
      .map(item => ({
        ...item,
        petId: selectedPet.id
      }));

    if (selectedPlans.length === 0) {
      alert('Vui lòng chọn ít nhất 1 mốc chăm sóc!');
      return;
    }

    onApplyCarePlan(selectedPlans);
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-[#E2E8F0] dark:border-white/10 my-8 max-h-[92vh] overflow-y-auto text-[#1E293B] dark:text-slate-100">
        
        {/* Header with AI Gradient */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0] dark:border-white/10 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-[#0F172A] dark:text-white">AI Sinh Lộ Trình Chăm Sóc</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-400/30 uppercase tracking-wider">
                  Chuẩn WSAVA
                </span>
              </div>
              <p className="text-xs text-[#475569] dark:text-slate-400">Tự động tính toán các mốc vắc-xin, tẩy giun và spa theo tuổi & giống loài</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-[#475569] hover:text-[#0F172A] dark:text-slate-400 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pet Selection Dropdown */}
        <div className="mb-5 p-4 rounded-2xl bg-[#F8FAFC] dark:bg-slate-800/40 border border-[#E2E8F0] dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Bot className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="text-xs font-bold text-[#0F172A] dark:text-white">Chọn thú cưng cần AI lên lịch:</span>
          </div>

          <select
            value={selectedPetId}
            onChange={(e) => setSelectedPetId(e.target.value)}
            className="px-3.5 py-2 bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl text-xs font-bold text-[#1E293B] dark:text-white shadow-xs outline-hidden"
          >
            {pets.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.breed} • {p.weight}kg)
              </option>
            ))}
          </select>
        </div>

        {/* AI Insight Box */}
        {selectedPet && (
          <div className="mb-5 p-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 text-xs text-[#1E293B] dark:text-slate-300 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-[#0F172A] dark:text-white">Đánh giá AI cho {selectedPet.name}:</strong> Dựa trên giống {selectedPet.breed}, cân nặng {selectedPet.weight}kg và độ tuổi, hệ thống đã tối ưu phác đồ tiêm ngừa và phòng ngừa ký sinh trùng phù hợp nhất.
            </div>
          </div>
        )}

        {/* Care Plan Generated List */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between text-xs font-bold text-[#475569] dark:text-slate-400 uppercase tracking-wider px-1">
            <span>Danh sách các mốc thời gian ({generatedPlan.length})</span>
            <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
              Đã chọn {Object.values(selectedIndexes).filter(Boolean).length}/{generatedPlan.length}
            </span>
          </div>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {generatedPlan.map((item, idx) => {
              const isSelected = !!selectedIndexes[idx];

              return (
                <div
                  key={idx}
                  onClick={() => toggleSelectIndex(idx)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                    isSelected
                      ? 'bg-white dark:bg-slate-800 border-indigo-500 shadow-xs'
                      : 'bg-[#F8FAFC] dark:bg-slate-800/40 border-[#E2E8F0] dark:border-slate-700 opacity-70'
                  }`}
                >
                  <button className="mt-0.5 text-indigo-600 dark:text-indigo-400 shrink-0">
                    {isSelected ? (
                      <CheckCircle2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 fill-indigo-100 dark:fill-indigo-950" />
                    ) : (
                      <Circle className="w-5 h-5 text-[#64748B]" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                      <h4 className="text-xs font-bold text-[#0F172A] dark:text-white">{item.title}</h4>
                      <ScheduleBadge type={item.type} />
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-[#475569] dark:text-slate-400 mb-1">
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Ngày: {item.date}
                      </span>
                      <span>•</span>
                      <span>Lặp lại: {item.repeat === 'none' ? 'Một lần' : item.repeat}</span>
                    </div>

                    {item.notes && (
                      <p className="text-[11px] text-[#475569] dark:text-slate-400 italic bg-[#F8FAFC] dark:bg-slate-800/80 p-1.5 rounded-lg border border-[#E2E8F0] dark:border-slate-700">
                        {item.notes}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-[#E2E8F0] dark:border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-[#475569] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            Hủy bỏ
          </button>

          <button
            onClick={handleApply}
            className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Thêm Các Mốc Đã Chọn Vào Lịch</span>
          </button>
        </div>

      </div>
    </div>
  );
};
