import React, { useState } from 'react';
import { 
  X, Camera, Upload, Sparkles, CheckCircle, FileText, 
  Calendar, DollarSign, Pill, ArrowRight, AlertCircle, RefreshCw 
} from 'lucide-react';
import { sound } from '../../services/soundService';
import { getTodayVnDate } from '../../utils/dateUtils';

export default function AiMedicalOcrModal({ 
  isOpen = true, 
  isModal = true, 
  onClose, 
  pets = [], 
  onOcrComplete 
}) {
  const [selectedPetId, setSelectedPetId] = useState(pets[0]?.id || '');
  const [ocrType, setOcrType] = useState('vaccine_book'); // 'vaccine_book', 'prescription_invoice'
  const [imagePreview, setImagePreview] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [isApplied, setIsApplied] = useState(false);

  const [editableResult, setEditableResult] = useState(null);

  if (isModal && !isOpen) return null;

  const mockVaccineResult = {
    detectedType: 'Sổ tiêm chủng thú cưng (Nhập thủ công)',
    confidence: 100,
    vaccineName: '',
    manufacturer: '',
    batchNumber: '',
    injectedDate: getTodayVnDate(),
    nextDueDate: '',
    nextVisitDate: '',
    vetClinic: '',
    vetDoctor: '',
    cost: '',
    totalAmount: '',
    medicines: []
  };

  const mockPrescriptionResult = {
    detectedType: 'Đơn thuốc & Hóa đơn khám (Nhập thủ công)',
    confidence: 100,
    vetClinic: '',
    vetDoctor: '',
    treatmentDate: getTodayVnDate(),
    issueDate: getTodayVnDate(),
    diagnosis: '',
    followUpDate: '',
    nextVisitDate: '',
    nextDueDate: '',
    cost: '',
    totalAmount: '',
    medicines: []
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result);
        sound.playClick();
        triggerOcrScan();
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerOcrScan = () => {
    setIsProcessing(true);
    setOcrResult(null);
    setEditableResult(null);
    setIsApplied(false);

    // Simulate AI Vision analysis latency with mock dataset
    setTimeout(() => {
      setIsProcessing(false);
      sound.playSuccess();
      const res = ocrType === 'vaccine_book' ? { ...mockVaccineResult } : { ...mockPrescriptionResult };
      setOcrResult(res);
      setEditableResult(res);
    }, 1200);
  };

  const handleApplyTo3Pipelines = () => {
    if (!editableResult || isApplied || isProcessing) return;
    
    // Normalization
    const payload = {
      ...editableResult,
      cost: Number(editableResult.cost || editableResult.totalAmount || 0),
      totalAmount: Number(editableResult.totalAmount || editableResult.cost || 0),
      nextVisitDate: editableResult.nextVisitDate || editableResult.nextDueDate || editableResult.followUpDate,
      nextDueDate: editableResult.nextDueDate || editableResult.nextVisitDate || editableResult.followUpDate
    };

    try {
      if (onOcrComplete) {
        onOcrComplete(payload, selectedPetId);
      }
      setIsApplied(true);
      sound.playSuccess();
    } catch {
      alert('Không thể lưu kết quả OCR.');
    }
  };

  const content = (
    <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full shadow-xl overflow-hidden ${
      isModal ? 'max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200' : 'animate-in fade-in duration-200'
    }`}>
      
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Trợ lý OCR Y Tế
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 uppercase tracking-wider">
                Mô phỏng
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Quét sổ tiêm & đơn thuốc ➔ Tự động phân loại Lịch hẹn, Y bạ và Chi phí
            </p>
          </div>
        </div>
        {isModal && onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="mx-6 mt-4 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
        <div className="leading-relaxed">
          <span className="font-bold">[Nhập Thủ Công]:</span> Tính năng quét ảnh y tế đang được nâng cấp. Vui lòng tải ảnh lên hoặc nhập thủ công thông tin sổ tiêm, đơn thuốc vào các trường bên dưới.
        </div>
      </div>

      {/* Body */}
      <div className={`p-6 space-y-5 ${isModal ? 'max-h-[80vh] overflow-y-auto' : ''}`}>
        
        {/* Pet & Document Type Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Chọn Thú cưng áp dụng:
            </label>
            <select
              value={selectedPetId}
              onChange={(e) => setSelectedPetId(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              {pets.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.species === 'dog' ? 'Chó' : 'Mèo'} - {p.breed})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Loại tài liệu y tế:
            </label>
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs">
              <button
                type="button"
                onClick={() => { setOcrType('vaccine_book'); setOcrResult(null); }}
                className={`py-1.5 px-2 rounded-lg font-medium transition-all ${
                  ocrType === 'vaccine_book'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm font-semibold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                💉 Sổ tiêm chủng
              </button>
              <button
                type="button"
                onClick={() => { setOcrType('prescription_invoice'); setOcrResult(null); }}
                className={`py-1.5 px-2 rounded-lg font-medium transition-all ${
                  ocrType === 'prescription_invoice'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm font-semibold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                🧾 Đơn thuốc/Hóa đơn
              </button>
            </div>
          </div>
        </div>

        {/* Upload Dropzone */}
        <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-2xl p-6 text-center transition-all bg-slate-50/50 dark:bg-slate-800/30">
          {imagePreview ? (
            <div className="space-y-3">
              <div className="relative inline-block rounded-xl overflow-hidden shadow-md max-h-56 border border-slate-200 dark:border-slate-700">
                <img src={imagePreview} alt="Medical Document" className="max-h-56 object-cover mx-auto" />
                {isProcessing && (
                  <div className="absolute inset-0 bg-indigo-950/70 backdrop-blur-xs flex flex-col items-center justify-center text-white p-3">
                    <RefreshCw className="w-8 h-8 animate-spin text-indigo-400 mb-2" />
                    <span className="text-xs font-semibold">Bộ xử lý OCR mô phỏng đang trích xuất dữ liệu...</span>
                    <span className="text-[10px] text-slate-300 mt-1">Nhận diện thuốc, vắc-xin, ngày tái khám, chi phí</span>
                  </div>
                )}
              </div>
              <div>
                <label className="cursor-pointer text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1">
                  <Camera className="w-3.5 h-3.5" />
                  <span>Chọn ảnh khác hoặc chụp lại</span>
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>
          ) : (
            <div>
              <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Upload className="w-6 h-6" />
              </div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Tải lên ảnh chụp sổ tiêm hoặc hóa đơn thú y
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                Hỗ trợ định dạng JPG, PNG. AI sẽ tự động đọc tem nhãn thuốc và lịch tái khám.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <label className="cursor-pointer px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-500/20 active:scale-95 transition-all">
                  <span>Chọn ảnh từ thiết bị</span>
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setImagePreview('https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=600&auto=format&fit=crop&q=80');
                    triggerOcrScan();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all border border-slate-200 dark:border-slate-700 shadow-sm"
                >
                  ⚡ Mở form nhập dữ liệu
                </button>
              </div>
            </div>
          )}
        </div>

        {/* OCR Extracted Results Preview */}
        {ocrResult && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Kết quả nhận diện tự động ({ocrResult.confidence}% độ chính xác)
                </span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {ocrResult.detectedType}
              </span>
            </div>

            {/* Editable Fields Review */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Xem lại và chỉnh sửa thông tin trước khi lưu:</span>
                <span className="text-[11px] text-slate-400 font-normal">Chạm vào ô để sửa</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Title / Diagnosis / Vaccine */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    {ocrType === 'vaccine_book' ? 'Tên vắc-xin' : 'Chẩn đoán / Bệnh'}
                  </label>
                  <input
                    type="text"
                    disabled={isApplied}
                    value={ocrType === 'vaccine_book' ? (editableResult?.vaccineName || '') : (editableResult?.diagnosis || '')}
                    onChange={(e) => {
                      if (ocrType === 'vaccine_book') {
                        setEditableResult({ ...editableResult, vaccineName: e.target.value });
                      } else {
                        setEditableResult({ ...editableResult, diagnosis: e.target.value });
                      }
                    }}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                </div>

                {/* Next Date */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Ngày tái khám / Hạn tiêm nhắc lại
                  </label>
                  <input
                    type="date"
                    disabled={isApplied}
                    value={editableResult?.nextDueDate || editableResult?.nextVisitDate || editableResult?.followUpDate || ''}
                    onChange={(e) => {
                      setEditableResult({
                        ...editableResult,
                        nextDueDate: e.target.value,
                        nextVisitDate: e.target.value,
                        followUpDate: e.target.value
                      });
                    }}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                </div>

                {/* Clinic */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Cơ sở thú y / Phòng khám
                  </label>
                  <input
                    type="text"
                    disabled={isApplied}
                    value={editableResult?.vetClinic || ''}
                    onChange={(e) => setEditableResult({ ...editableResult, vetClinic: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                </div>

                {/* Doctor */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Bác sĩ phụ trách
                  </label>
                  <input
                    type="text"
                    disabled={isApplied}
                    value={editableResult?.vetDoctor || ''}
                    onChange={(e) => setEditableResult({ ...editableResult, vetDoctor: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                </div>

                {/* Amount / Cost */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Chi phí (VNĐ)
                  </label>
                  <input
                    type="number"
                    min="0"
                    disabled={isApplied}
                    value={editableResult?.cost ?? editableResult?.totalAmount ?? ''}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setEditableResult({ ...editableResult, cost: val, totalAmount: val });
                    }}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* 3 Pipeline Cards Showcase */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* 1. Schedule */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/40">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 dark:text-indigo-200 mb-2">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>1. Lịch hẹn tự sinh</span>
                </div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {editableResult?.vaccineName || editableResult?.diagnosis || 'Lịch theo dõi'}
                </div>
                <div className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-1 font-semibold">
                  Hạn: {editableResult?.nextDueDate || editableResult?.nextVisitDate || 'Chưa đặt'}
                </div>
              </div>

              {/* 2. Medical Record / Prescription */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 dark:text-emerald-200 mb-2">
                  <Pill className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>2. Sổ Y bạ / Thuốc</span>
                </div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                  {editableResult?.vetClinic || 'Phòng khám thú y'}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Bác sĩ: {editableResult?.vetDoctor || 'Chưa cập nhật'}
                </div>
              </div>

              {/* 3. Expense */}
              <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-200 mb-2">
                  <DollarSign className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>3. Chi phí khám</span>
                </div>
                <div className="text-xs font-bold text-amber-700 dark:text-amber-300">
                  {Number(editableResult?.cost || editableResult?.totalAmount || 0).toLocaleString('vi-VN')} đ
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Danh mục: Y tế / Thuốc
                </div>
              </div>
            </div>

            {/* Feedback Alert */}
            {isApplied ? (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  Đã đẩy dữ liệu thành công vào: Lịch hẹn, Sổ y bạ và Chi phí!
                </span>
                {isModal && onClose && (
                  <button onClick={onClose} className="underline text-[11px] cursor-pointer">Đóng modal</button>
                )}
              </div>
            ) : (
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleApplyTo3Pipelines}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer disabled:opacity-60"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Xác nhận & Tự động lưu 3-trong-1 (Lịch + Y bạ + Chi tiêu)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between text-xs text-slate-500">
        <span>Hỗ trợ nhận diện tiếng Việt & tiếng Anh</span>
        {isModal && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold transition-colors"
          >
            Đóng
          </button>
        )}
      </div>

    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        {content}
      </div>
    );
  }

  return content;
}
