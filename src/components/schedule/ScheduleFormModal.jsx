import React, { useState, useEffect } from 'react';
import { 
  X, 
  CalendarPlus, 
  Check, 
  Clock, 
  MapPin, 
  Syringe, 
  Pill, 
  Sparkles, 
  Stethoscope, 
  Activity, 
  Utensils, 
  Footprints, 
  HelpCircle, 
  Info 
} from 'lucide-react';
import { SCHEDULE_TYPES } from '../../constants/mockData';
import { getTodayVnDate, getVnDateString } from '../../utils/dateUtils.js';

const ICON_MAP = {
  Syringe,
  Pill,
  Sparkles,
  Stethoscope,
  Activity,
  Utensils,
  Footprints,
  HelpCircle
};

export const ScheduleFormModal = ({
  isOpen,
  onClose,
  onSave,
  pets = [],
  scheduleToEdit = null,
  initialDate = null,
  initialType = null,
  initialTitle = null,
  initialPetId = null,
  onOpenVetBooking = null
}) => {
  // Helper chuẩn hóa mã thú cưng theo danh sách thực tế
  const resolveTargetPetId = (targetId, petsList = []) => {
    if (!targetId || !Array.isArray(petsList) || petsList.length === 0) {
      return petsList?.[0]?.id || '';
    }
    const directMatch = petsList.find(p => p.id === targetId);
    if (directMatch) return directMatch.id;

    const targetStr = String(targetId).toLowerCase().trim();
    const match = petsList.find(p => {
      const pId = String(p.id).toLowerCase().trim();
      const pName = String(p.name || '').toLowerCase().trim();
      return pId === targetStr || pName === targetStr;
    });

    return match ? match.id : (petsList[0]?.id || '');
  };

  // Helper chuẩn hóa mã loại sự kiện
  const resolveTargetType = (rawType) => {
    if (!rawType) return 'vaccine';
    if (rawType === 'parasite') return 'deworm';
    return SCHEDULE_TYPES[rawType] ? rawType : 'other';
  };

  const [formData, setFormData] = useState({
    petId: resolveTargetPetId(initialPetId, pets),
    title: initialTitle || '',
    type: resolveTargetType(initialType),
    date: initialDate ? getVnDateString(initialDate) : getTodayVnDate(),
    time: '09:00',
    location: '',
    repeat: 'none',
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (scheduleToEdit) {
      setFormData({
        ...scheduleToEdit,
        petId: resolveTargetPetId(scheduleToEdit.petId, pets),
        type: resolveTargetType(scheduleToEdit.type)
      });
    } else {
      setFormData({
        petId: resolveTargetPetId(initialPetId, pets),
        title: initialTitle || '',
        type: resolveTargetType(initialType),
        date: initialDate ? getVnDateString(initialDate) : getTodayVnDate(),
        time: '09:00',
        location: '',
        repeat: 'none',
        notes: ''
      });
    }
  }, [scheduleToEdit, initialDate, initialType, initialTitle, initialPetId, pets, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!formData.title.trim()) {
      alert('Vui lòng nhập tên việc chăm sóc!');
      return;
    }
    if (!formData.petId) {
      alert('Vui lòng chọn thú cưng!');
      return;
    }
    if (!formData.date) {
      alert('Vui lòng chọn ngày dự kiến!');
      return;
    }
    if (!formData.time) {
      alert('Vui lòng chọn giờ thực hiện!');
      return;
    }

    const matchedPet = pets.find(p => p.id === formData.petId);
    const resolvedPetName = matchedPet?.name || 'Thú cưng';

    setIsSubmitting(true);
    try {
      // Đính kèm cả petName và petId để đồng bộ dữ liệu chuẩn xác
      await onSave({
        ...formData,
        petName: resolvedPetName,
        petId: formData.petId,
        id: formData.id || `sch-${Date.now()}`
      });
      onClose();
    } catch (err) {
      alert(err.message || 'Lỗi lưu lịch trình. Dữ liệu đã được giữ nguyên.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-[#E2E8F0] dark:border-white/10 my-8 text-[#1E293B] dark:text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0] dark:border-white/10 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-white/10 border border-indigo-100 dark:border-white/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
              <CalendarPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#0F172A] dark:text-white">
                {scheduleToEdit ? 'Chỉnh Sửa Việc Chăm Sóc' : 'Thêm Lịch Chăm Sóc Mới'}
              </h2>
              <p className="text-xs text-[#475569] dark:text-slate-400">Thiết lập mốc thời gian và kế hoạch chăm sóc cho bé</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[#475569] hover:text-[#0F172A] dark:text-slate-400 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Select Pet */}
          <div>
            <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 uppercase tracking-wider mb-1.5">
              Áp dụng cho Thú cưng *
            </label>
            <select
              required
              value={formData.petId}
              onChange={(e) => setFormData(prev => ({ ...prev, petId: e.target.value }))}
              className="w-full px-3.5 py-2.5 bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-500 text-sm font-semibold text-[#1E293B] dark:text-white outline-hidden"
            >
              {pets.map((pet) => (
                <option key={pet.id} value={pet.id}>
                  {pet.name} ({pet.breed} - {pet.species === 'cat' ? 'Mèo' : pet.species === 'dog' ? 'Chó' : pet.species})
                </option>
              ))}
            </select>
          </div>

          {/* Schedule Type (8 Standard Types, Responsive Grid) */}
          <div>
            <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 uppercase tracking-wider mb-1.5">
              Loại sự kiện *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(SCHEDULE_TYPES).map(([typeKey, config]) => {
                const isSelected = formData.type === typeKey || (typeKey === 'deworm' && formData.type === 'parasite');
                const IconComponent = ICON_MAP[config.icon] || HelpCircle;
                return (
                  <button
                    type="button"
                    key={typeKey}
                    data-type={typeKey}
                    onClick={() => setFormData(prev => ({ ...prev, type: typeKey }))}
                    className={`p-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-2 select-none text-left ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-600 dark:border-indigo-400 text-indigo-700 dark:text-indigo-300 font-bold shadow-xs ring-2 ring-indigo-400/20'
                        : 'border-[#E2E8F0] dark:border-slate-700 text-[#475569] dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 bg-[#F8FAFC] dark:bg-slate-800'
                    }`}
                  >
                    <IconComponent className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                    <span className="truncate leading-tight">{config.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Context-sensitive Notices */}
          {formData.type === 'vet' && (
            <div className="p-3 rounded-2xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-blue-900 dark:text-blue-100">
                    Lời nhắc này chưa phải lịch khám được cơ sở xác nhận.
                  </p>
                  <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">
                    Đây là lời nhắc việc cá nhân. Để đặt lịch khám có xác nhận từ cơ sở thú y, vui lòng sử dụng chức năng Đặt lịch khám.
                  </p>
                </div>
              </div>
              {onOpenVetBooking && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenVetBooking({ petId: formData.petId });
                  }}
                  className="self-start sm:self-center px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs whitespace-nowrap shadow-xs cursor-pointer transition-all shrink-0 active:scale-95"
                >
                  Đặt lịch khám tại cơ sở →
                </button>
              )}
            </div>
          )}

          {(formData.type === 'vaccine' || formData.type === 'deworm' || formData.type === 'parasite') && (
            <div className="p-2.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                Lịch tiêm phòng / tẩy giun là kế hoạch chăm sóc cá nhân. Hoàn thành lời nhắc không tự động tạo bản ghi tiêm chủng hay bệnh án xác nhận bởi bác sĩ.
              </span>
            </div>
          )}

          {formData.type === 'medicine' && (
            <div className="p-2.5 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-[11px] text-rose-800 dark:text-rose-300 flex items-center gap-2">
              <Info className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>
                Lời nhắc uống thuốc theo thông tin bạn tự nhập. Vui lòng ghi chi tiết liều dùng hoặc chỉ định của bác sĩ vào ô Ghi chú bên dưới.
              </span>
            </div>
          )}

          {/* Tên việc chăm sóc (Title) */}
          <div>
            <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 uppercase tracking-wider mb-1.5">
              Tên việc chăm sóc *
            </label>
            <input
              type="text"
              required
              placeholder="Chải lông, thay nước uống, đi dạo..."
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3.5 py-2.5 bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-500 outline-hidden text-sm text-[#1E293B] dark:text-white placeholder:text-[#64748B]"
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 uppercase tracking-wider mb-1.5">
                Ngày dự kiến *
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl text-xs outline-hidden focus:border-indigo-500 text-[#1E293B] dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 uppercase tracking-wider mb-1.5">
                Giờ thực hiện
              </label>
              <input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                className="w-full px-3 py-2 bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl text-xs outline-hidden focus:border-indigo-500 text-[#1E293B] dark:text-white"
              />
            </div>
          </div>

          {/* Location & Repeat */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 uppercase tracking-wider mb-1.5">
                Địa điểm
              </label>
              <input
                type="text"
                placeholder="Ví dụ: Tại nhà, Bệnh viện thú y..."
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                className="w-full px-3 py-2 bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl text-xs outline-hidden focus:border-indigo-500 text-[#1E293B] dark:text-white placeholder:text-[#64748B]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 uppercase tracking-wider mb-1.5">
                Lặp lại chu kỳ
              </label>
              <select
                value={formData.repeat}
                onChange={(e) => setFormData(prev => ({ ...prev, repeat: e.target.value }))}
                className="w-full px-3 py-2 bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl text-xs outline-hidden focus:border-indigo-500 font-medium text-[#1E293B] dark:text-white"
              >
                <option value="none">Không lặp lại (1 lần)</option>
                <option value="daily">Hàng ngày</option>
                <option value="weekly">Hàng tuần</option>
                <option value="monthly">Hàng tháng</option>
                <option value="quarterly">Mỗi 3 tháng (Tẩy giun)</option>
                <option value="yearly">Hàng năm (Vắc-xin dại/7 bệnh)</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 uppercase tracking-wider mb-1.5">
              Ghi chú & Dặn dò
            </label>
            <textarea
              rows={2}
              placeholder="Ví dụ: Nhịn ăn sáng, mang theo sổ tiêm chủng, cân lại trước khi uống thuốc..."
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full px-3.5 py-2 bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-500 outline-hidden text-xs text-[#1E293B] dark:text-white placeholder:text-[#64748B]"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E2E8F0] dark:border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-[#475569] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-1.5 ${isSubmitting ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Đang lưu...' : (scheduleToEdit ? 'Lưu Thay Đổi' : 'Tạo Lịch Chăm Sóc')}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

export default ScheduleFormModal;
