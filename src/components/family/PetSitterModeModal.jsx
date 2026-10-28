import React, { useState } from 'react';
import { 
  X, QrCode, Shield, Copy, Check, ExternalLink, 
  AlertTriangle, Heart, Clock, Phone, Stethoscope, Sparkles 
} from 'lucide-react';
import { sound } from '../../services/soundService';

export default function PetSitterModeModal({ isOpen, onClose, pets = [], prescriptions = [] }) {
  const [selectedPetId, setSelectedPetId] = useState(pets[0]?.id || 'p1');
  const [copied, setCopied] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  if (!isOpen) return null;

  const currentPet = pets.find(p => p.id === selectedPetId) || pets[0];
  const petPrescriptions = prescriptions.filter(p => p.petId === selectedPetId);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const sitterUrl = `${baseUrl}/#sitter-${currentPet?.id || 'demo'}`;

  const handleCopyLink = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(sitterUrl);
    }
    setCopied(true);
    sound.playSuccess();
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Chế độ Bàn giao (Pet Sitter Mode)
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Mô phỏng Demo
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Thông tin chăm sóc cơ bản cho người trông giữ, bảo mật chi tiêu tài chính
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          
          {/* Demo notice */}
          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
            <div className="leading-relaxed">
              [Chế độ Demo]: Ứng dụng hiện lưu trữ cục bộ, chưa có dịch vụ máy chủ công khai qua Internet. Liên kết bên dưới sử dụng đường dẫn thực tế của dự án để xem trước trang bàn giao.
            </div>
          </div>

          {/* Select Pet */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Chọn thú cưng cần bàn giao:
            </label>
            <select
              value={selectedPetId}
              onChange={(e) => setSelectedPetId(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              {pets.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.species === 'dog' ? 'Chó' : 'Mèo'} - {p.breed || 'Chưa rõ giống'})</option>
              ))}
            </select>
          </div>

          {/* Sitter Link & QR Share Box */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200/60 dark:border-amber-900/40 space-y-3">
            <div className="text-xs font-bold text-amber-950 dark:text-amber-200 flex items-center justify-between">
              <span>Liên kết xem nhanh trang Bàn giao</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200/60 dark:bg-amber-800/40 text-amber-800 dark:text-amber-200 font-semibold">
                Liên kết dự án cục bộ
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={sitterUrl}
                className="flex-1 text-xs px-3 py-2 rounded-xl border border-amber-300/60 dark:border-amber-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 select-all"
              />
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Đã chép' : 'Chép link'}</span>
              </button>
            </div>
          </div>

          {/* Toggle Sitter Preview */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-white dark:bg-slate-850">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Giao diện người trông giữ được phép xem:
              </span>
              <button
                onClick={() => setPreviewMode(!previewMode)}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
              >
                {previewMode ? 'Thu nhỏ' : 'Xem chi tiết'}
              </button>
            </div>

            {/* Sitter Read-only Card with REAL PET DATA */}
            <div className="mt-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 space-y-3 text-xs">
              <div className="flex items-center gap-3">
                <img
                  src={currentPet?.avatar || 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=150'}
                  alt={currentPet?.name || 'Thú cưng'}
                  className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                />
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">{currentPet?.name || 'Chưa có tên'}</h4>
                  <p className="text-[11px] text-slate-500">
                    {currentPet?.breed || 'Chưa rõ giống'} • {currentPet?.weight ? `${currentPet.weight} kg` : 'Chưa cập nhật cân nặng'}
                  </p>
                </div>
              </div>

              {/* Crucial Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 font-medium">
                  <strong>⚠️ Ghi chú / Dị ứng:</strong>{' '}
                  {currentPet?.notes?.trim() || 'Chưa có ghi chú dị ứng / sức khỏe'}
                </div>
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 font-medium">
                  <strong>ℹ️ Thông tin:</strong> Giới tính: {currentPet?.gender === 'female' ? 'Cái' : 'Đực'} {currentPet?.isNeutered ? '• Đã triệt sản' : ''}
                </div>
              </div>

              {/* Medicines to give (Extracted from real petPrescriptions) */}
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 text-[11px]">
                <div className="font-bold flex items-center gap-1 mb-1">
                  <Clock className="w-3 h-3" /> Đơn thuốc đang điều trị:
                </div>
                {petPrescriptions.length > 0 ? (
                  <div className="space-y-1">
                    {petPrescriptions.slice(0, 3).map((p, idx) => (
                      <div key={idx}>• <strong>{p.medicineName}</strong>: {p.dosage || 'Theo chỉ định'}</div>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-500 dark:text-slate-400 italic">Bé không có đơn thuốc đang điều trị.</div>
                )}
              </div>

              {/* Emergency Contacts */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-100">
                  <Phone className="w-3 h-3 text-emerald-500" />
                  Chủ nuôi: {currentPet?.ownerPhone || 'Liên hệ qua ứng dụng'}
                </span>
                <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium">
                  <Stethoscope className="w-3 h-3" />
                  Microchip: {currentPet?.microchip || 'Chưa ghi nhận'}
                </span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 dark:text-slate-500 italic text-center">
            * Trang bàn giao bảo vệ thông tin cá nhân: Ẩn toàn bộ chi tiêu tài chính, nhật ký riêng tư và quyền xóa/sửa dữ liệu.
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold hover:opacity-90 transition-opacity"
          >
            Hoàn tất
          </button>
        </div>

      </div>
    </div>
  );
}
