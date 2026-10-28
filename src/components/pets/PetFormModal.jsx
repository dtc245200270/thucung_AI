import React, { useState, useEffect, useRef } from 'react';
import { X, PawPrint, Camera, Check, Sparkles, Upload, Trash2 } from 'lucide-react';
import { SPECIES_LIST } from '../../constants/mockData';
import { uploadPetAvatar } from '../../services/apiService.js';

export const PetFormModal = ({ isOpen, onClose, onSave, petToEdit = null }) => {
  const [formData, setFormData] = useState({
    name: '',
    species: 'dog',
    breed: '',
    gender: 'male',
    birthDate: '',
    weight: '',
    color: '',
    microchip: '',
    isNeutered: false,
    avatar: null,
    notes: ''
  });

  const [autoGenerateSchedule, setAutoGenerateSchedule] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [isAvatarRemoved, setIsAvatarRemoved] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const todayStr = (() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  })();
  useEffect(() => {
    setErrorMsg('');
    if (petToEdit) {
      let initialWeight = '';
      if (Array.isArray(petToEdit.weightHistory) && petToEdit.weightHistory.length > 0) {
        const sorted = [...petToEdit.weightHistory]
          .filter(h => h && h.weight != null && !isNaN(h.weight) && Number(h.weight) > 0)
          .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        if (sorted.length > 0) initialWeight = String(sorted[sorted.length - 1].weight);
      } else if (petToEdit.weight != null && petToEdit.weight !== '') {
        initialWeight = String(petToEdit.weight);
      }

      setFormData({
        ...petToEdit,
        weight: initialWeight
      });
      setPreviewUrl(petToEdit.avatar || null);
      setSelectedFile(null);
      setSelectedFileName('');
      setIsAvatarRemoved(false);
      setAutoGenerateSchedule(false);
    } else {
      setFormData({
        name: '',
        species: 'dog',
        breed: '',
        gender: 'male',
        birthDate: '',
        weight: '',
        color: '',
        microchip: '',
        isNeutered: false,
        avatar: null,
        notes: ''
      });
      setPreviewUrl(null);
      setSelectedFile(null);
      setSelectedFileName('');
      setIsAvatarRemoved(false);
      setAutoGenerateSchedule(false);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [petToEdit, isOpen]);

  const handleFileChange = (e) => {
    setErrorMsg('');
    const file = e.target.files?.[0];
    if (!file) return;

    // Kiểm tra định dạng (JPG, JPEG, PNG, WebP)
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const validExtensions = /\.(jpg|jpeg|png|webp)$/i;
    if (!validTypes.includes(file.type.toLowerCase()) && !validExtensions.test(file.name)) {
      setErrorMsg('Định dạng tệp không được hỗ trợ. Vui lòng chọn ảnh JPG, JPEG, PNG hoặc WebP.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Kiểm tra dung lượng (Tối đa 5 MB = 5 * 1024 * 1024 bytes)
    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setErrorMsg(`Dung lượng ảnh vượt quá giới hạn tối đa 5 MB (${sizeMb} MB). Vui lòng chọn ảnh nhỏ hơn.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Đọc preview cục bộ
    const reader = new FileReader();
    reader.onload = (event) => {
      setPreviewUrl(event.target.result);
      setSelectedFile(file);
      setSelectedFileName(file.name);
      setIsAvatarRemoved(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setPreviewUrl(null);
    setSelectedFile(null);
    setSelectedFileName('');
    setIsAvatarRemoved(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.name.trim()) {
      setErrorMsg('Vui lòng nhập tên thú cưng!');
      return;
    }

    if (formData.weight !== '') {
      const parsedWeight = parseFloat(formData.weight);
      if (isNaN(parsedWeight) || parsedWeight <= 0) {
        setErrorMsg('Cân nặng phải là một số dương hợp lệ (lớn hơn 0 kg)!');
        return;
      }
    }

    if (formData.birthDate && formData.birthDate > todayStr) {
      setErrorMsg('Ngày sinh không được nằm trong tương lai!');
      return;
    }

    try {
      setIsUploading(true);
      let finalAvatar = petToEdit?.avatar || null;

      // 1. Nếu người dùng chọn ảnh mới: Tải lên máy chủ thật
      if (selectedFile) {
        finalAvatar = await uploadPetAvatar(selectedFile, petToEdit?.id);
      } else if (isAvatarRemoved) {
        // Người dùng đã bấm Xóa ảnh
        finalAvatar = null;
      }

      const weightVal = formData.weight !== '' && !isNaN(parseFloat(String(formData.weight).replace(',', '.'))) 
        ? parseFloat(String(formData.weight).replace(',', '.')) 
        : null;
      const birthDateVal = formData.birthDate || null;
      const microchipVal = formData.microchip && formData.microchip.trim() ? formData.microchip.trim() : null;
      const breedVal = formData.breed && formData.breed.trim() ? formData.breed.trim() : null;
      const colorVal = formData.color && formData.color.trim() ? formData.color.trim() : null;
      const notesVal = formData.notes && formData.notes.trim() ? formData.notes.trim() : null;

      let updatedHistory = Array.isArray(petToEdit?.weightHistory) ? [...petToEdit.weightHistory] : [];
      let finalWeight = weightVal;

      if (weightVal !== null) {
        if (!petToEdit) {
          // Thêm thú cưng mới: khởi tạo bản ghi đo đầu tiên
          updatedHistory = [{ date: todayStr, weight: weightVal }];
          finalWeight = weightVal;
        } else {
          // Chỉnh sửa thú cưng: kiểm tra bản ghi mới nhất theo ngày
          const sortedHistory = [...updatedHistory]
            .filter(h => h && h.weight != null && !isNaN(h.weight) && Number(h.weight) > 0)
            .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
          const currentLatestRecord = sortedHistory.length > 0 ? sortedHistory[sortedHistory.length - 1] : null;

          if (!currentLatestRecord || currentLatestRecord.weight !== weightVal) {
            updatedHistory.push({ date: todayStr, weight: weightVal });
          }

          const reSorted = [...updatedHistory]
            .filter(h => h && h.weight != null && !isNaN(h.weight) && Number(h.weight) > 0)
            .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
          updatedHistory = reSorted;
          const latest = reSorted.length > 0 ? reSorted[reSorted.length - 1] : null;
          finalWeight = latest ? latest.weight : weightVal;
        }
      } else {
        finalWeight = null;
      }

      await onSave({
        ...formData,
        name: formData.name.trim(),
        avatar: finalAvatar,
        weight: finalWeight,
        birthDate: birthDateVal,
        microchip: microchipVal,
        breed: breedVal,
        color: colorVal,
        notes: notesVal,
        weightHistory: updatedHistory
      }, autoGenerateSchedule);
    } catch (err) {
      // Upload hoặc lưu thất bại: báo lỗi rõ, giữ form để thử lại, không báo thành công
      setErrorMsg(err.message || 'Lỗi lưu thông tin thú cưng');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-[#E2E8F0] dark:border-white/10 my-8 max-h-[90vh] overflow-y-auto text-[#1E293B] dark:text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0] dark:border-white/10 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-white/10 border border-indigo-100 dark:border-white/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
              <PawPrint className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#0F172A] dark:text-white">
                {petToEdit ? 'Chỉnh Sửa Thông Tin Thú Cưng' : 'Thêm Thú Cưng Mới'}
              </h2>
              <p className="text-xs text-[#475569] dark:text-slate-400">Nhập đầy đủ thông tin để AI đưa ra phác đồ chính xác</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#475569] hover:text-[#0F172A] dark:text-slate-400 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Species Selector */}
          <div>
            <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 uppercase tracking-wider mb-2">
              Loài thú cưng *
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {SPECIES_LIST.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setFormData({ ...formData, species: item.id })}
                  className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                    formData.species === item.id
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold shadow-xs'
                      : 'border-[#E2E8F0] dark:border-slate-700 hover:border-slate-300 text-[#475569] dark:text-slate-300 bg-[#F8FAFC] dark:bg-slate-800'
                  }`}
                >
                  <span className="text-xl">{item.emoji}</span>
                  <span className="text-xs">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Name & Breed */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 uppercase tracking-wider mb-1.5">
                Tên thú cưng *
              </label>
              <input
                type="text"
                required
                placeholder="Ví dụ: Bông, Lu, Miu..."
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl text-[#1E293B] dark:text-white placeholder:text-[#64748B] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden text-sm transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 uppercase tracking-wider mb-1.5">
                Giống loài (Breed)
              </label>
              <input
                type="text"
                placeholder="Ví dụ: Golden Retriever, Mèo Anh lông ngắn..."
                value={formData.breed}
                onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl text-[#1E293B] dark:text-white placeholder:text-[#64748B] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden text-sm transition-all"
              />
            </div>
          </div>

          {/* Gender & Birth Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 uppercase tracking-wider mb-1.5">
                Giới tính
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, gender: 'male' })}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                    formData.gender === 'male'
                      ? 'bg-blue-50 border-blue-400 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                      : 'border-[#E2E8F0] dark:border-slate-700 text-[#475569] dark:text-slate-300 bg-[#F8FAFC] dark:bg-slate-800'
                  }`}
                >
                  ♂ Đực
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, gender: 'female' })}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                    formData.gender === 'female'
                      ? 'bg-rose-50 border-rose-400 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                      : 'border-[#E2E8F0] dark:border-slate-700 text-[#475569] dark:text-slate-300 bg-[#F8FAFC] dark:bg-slate-800'
                  }`}
                >
                  ♀ Cái
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 uppercase tracking-wider mb-1.5">
                Ngày sinh / Ước tính
              </label>
              <input
                type="date"
                max={todayStr}
                value={formData.birthDate}
                onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                className="w-full px-3 py-2 bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl text-[#1E293B] dark:text-white placeholder:text-[#64748B] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden text-xs transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 uppercase tracking-wider mb-1.5">
                Cân nặng (kg)
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="Ví dụ: 4.5"
                value={formData.weight}
                onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                className="w-full px-3 py-2 bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl text-[#1E293B] dark:text-white placeholder:text-[#64748B] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden text-xs transition-all"
              />
            </div>
          </div>

          {/* Color & Microchip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 uppercase tracking-wider mb-1.5">
                Màu lông
              </label>
              <input
                type="text"
                placeholder="Ví dụ: Vàng kim, Tam thể, Xám xanh..."
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl text-[#1E293B] dark:text-white placeholder:text-[#64748B] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden text-sm transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 uppercase tracking-wider mb-1.5">
                Mã số Microchip (nếu có)
              </label>
              <input
                type="text"
                placeholder="Ví dụ: VN-9820003412"
                value={formData.microchip}
                onChange={(e) => setFormData({ ...formData, microchip: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl text-[#1E293B] dark:text-white placeholder:text-[#64748B] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden text-sm transition-all"
              />
            </div>
          </div>

          {/* Neutered Checkbox */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#F8FAFC] dark:bg-slate-800/40 border border-[#E2E8F0] dark:border-slate-700">
            <input
              type="checkbox"
              id="isNeutered"
              checked={formData.isNeutered}
              onChange={(e) => setFormData({ ...formData, isNeutered: e.target.checked })}
              className="w-4 h-4 rounded-sm text-indigo-600 focus:ring-indigo-500 border-slate-300"
            />
            <label htmlFor="isNeutered" className="text-xs font-medium text-[#1E293B] dark:text-slate-300 cursor-pointer">
              Đã triệt sản / thiến (Giúp AI tính toán chính xác khẩu phần dinh dưỡng & hành vi)
            </label>
          </div>

          {/* Avatar Upload Section */}
          <div>
            <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 uppercase tracking-wider mb-2">
              Ảnh đại diện thú cưng
            </label>
            
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 rounded-2xl bg-[#F8FAFC] dark:bg-slate-800/40 border border-[#E2E8F0] dark:border-slate-700">
              {/* Preview Box */}
              <div className="relative w-28 h-28 rounded-2xl overflow-hidden border border-[#E2E8F0] dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xs shrink-0 flex items-center justify-center">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Xem trước ảnh thú cưng"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1.5 text-slate-400 p-2 text-center">
                    <PawPrint className="w-8 h-8 stroke-[1.5] text-[#64748B]" />
                    <span className="text-[11px] font-semibold text-[#64748B]">Chưa có ảnh</span>
                  </div>
                )}
              </div>

              {/* Action Buttons & Info */}
              <div className="flex-1 flex flex-col justify-center space-y-2 text-center sm:text-left">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    {previewUrl ? 'Đổi ảnh' : 'Tải ảnh từ máy'}
                  </button>

                  {previewUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="inline-flex items-center gap-1 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-xl border border-rose-200 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Xóa ảnh
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-[#475569] dark:text-slate-400 font-medium">
                  Định dạng: JPG, JPEG, PNG, WebP • Dung lượng tối đa: 5 MB
                </p>
                {selectedFileName && (
                  <p className="text-[11px] text-indigo-700 dark:text-indigo-400 font-semibold truncate max-w-xs">
                    ✓ Đã chọn: {selectedFileName}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 uppercase tracking-wider mb-1.5">
              Bệnh sử, dị ứng & ghi chú tính cách
            </label>
            <textarea
              rows={3}
              placeholder="Ví dụ: Thích bơi, sợ sấm sét, dị ứng thịt bò, đã mổ sỏi thận năm 2024..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl text-[#1E293B] dark:text-white placeholder:text-[#64748B] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden text-sm transition-all"
            />
          </div>

          {/* Care Schedule Suggestion Note */}
          {!petToEdit && (
            <div className="p-3.5 rounded-2xl bg-[#F8FAFC] dark:bg-slate-800/40 border border-[#E2E8F0] dark:border-slate-700/60 flex items-start gap-3">
              <span className="text-base select-none">📅</span>
              <div className="text-xs text-[#475569] dark:text-slate-300">
                <span className="font-bold text-[#0F172A] dark:text-slate-200 block mb-0.5">
                  Lịch chăm sóc & sinh hoạt thường nhật
                </span>
                Sau khi thêm thú cưng, bạn có thể vào tab <strong>Lịch chăm sóc</strong> để xem trước và xác nhận các lịch trình sinh hoạt (cho ăn, đi dạo, chải lông) phù hợp với bé. Hệ thống không tự động chèn phác đồ y tế khi chưa có chỉ định của Bác sĩ thú y.
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E2E8F0] dark:border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-[#475569] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isUploading ? 'Đang tải ảnh & lưu...' : (petToEdit ? 'Lưu Thay Đổi' : 'Tạo Hồ Sơ Thú Cưng')}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
