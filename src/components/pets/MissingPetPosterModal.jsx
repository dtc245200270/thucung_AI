import React, { useState, useRef } from 'react';
import { 
  X, Download, Share2, Printer, Sparkles, 
  Phone, MapPin, DollarSign, AlertTriangle, QrCode, Check, PawPrint 
} from 'lucide-react';
import { sound } from '../../services/soundService';

export default function MissingPetPosterModal({ isOpen, onClose, pet }) {
  const [posterFormat, setPosterFormat] = useState('story'); // 'story' (9:16) or 'a4' (3:4)
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const posterRef = useRef(null);

  if (!isOpen || !pet) return null;

  const publicUrl = `https://petcare.ai/id/${pet.id || 'p1'}?source=poster_qr`;
  const reward = pet.lostMode?.reward || '5.000.000 VNĐ';
  const emergencyPhone = pet.lostMode?.emergencyPhone || '0912.345.678';
  const lastLocation = pet.lostMode?.lastSeenLocation || 'Khu vực Cầu Giấy, Hà Nội';

  const handleDownload = () => {
    sound.playSuccess();
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2500);

    // Mock download print poster
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Trình Tạo Poster Tìm Thú Lạc (Missing Pet Poster)
              </h3>
              <p className="text-xs text-slate-500">Tự động gắn mã QR và thông tin hậu tạ chuẩn đồ họa</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 bg-slate-100 dark:bg-slate-800/50 flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Định dạng:</span>
            <button
              onClick={() => setPosterFormat('story')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                posterFormat === 'story'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              📱 Story (9:16 Mạng xã hội)
            </button>
            <button
              onClick={() => setPosterFormat('a4')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                posterFormat === 'a4'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              📄 Khổ In Ấn (A4)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-500/20 active:scale-95 transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{downloadSuccess ? 'Đang xuất in...' : 'In / Lưu Poster'}</span>
            </button>
          </div>
        </div>

        {/* Preview Area */}
        <div className="p-6 overflow-y-auto flex-1 flex justify-center bg-slate-950/40">
          
          {/* Printable Poster Canvas */}
          <div 
            ref={posterRef}
            className={`bg-white text-slate-900 border-4 border-rose-600 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-center transition-all ${
              posterFormat === 'story'
                ? 'w-[320px] sm:w-[360px] aspect-[9/16]'
                : 'w-[360px] sm:w-[420px] aspect-[1/1.414]'
            }`}
          >
            {/* Top Red Alert Header */}
            <div className="bg-rose-600 text-white p-4 uppercase tracking-widest font-black">
              <div className="text-2xl sm:text-3xl leading-none">TÌM {pet.species === 'dog' ? 'CHÓ' : 'MÈO'} LẠC</div>
              <div className="text-xs font-bold tracking-widest mt-1 text-rose-100">MISSING PET • XIN HÃY GIÚP ĐỠ</div>
            </div>

            {/* Photo */}
            <div className="p-3 pb-2 flex-1 flex flex-col justify-center">
              <div className="relative rounded-xl overflow-hidden border-2 border-slate-900 mx-auto max-h-[42%] w-full bg-slate-100 flex items-center justify-center">
                {pet.avatar ? (
                  <img
                    src={pet.avatar}
                    alt={pet.name}
                    className="w-full h-44 sm:h-52 object-cover"
                  />
                ) : (
                  <div className="w-full h-44 sm:h-52 flex flex-col items-center justify-center gap-2 text-slate-400">
                    <PawPrint className="w-12 h-12 stroke-[1.5] text-slate-300" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Chưa có ảnh</span>
                  </div>
                )}
              </div>

              {/* Pet Details */}
              <div className="mt-2 space-y-1">
                <div className="text-xl font-black text-slate-900 uppercase">
                  Tên bé: <span className="text-rose-600">{pet.name}</span>
                </div>
                <div className="text-xs font-semibold text-slate-700">
                  {(pet.breed && String(pet.breed).trim()) ? String(pet.breed).trim() : 'Chưa cập nhật'} • {pet.gender === 'male' || pet.gender === 'Đực' ? 'Đực' : 'Cái'} • Nặng {pet.weight ? `${pet.weight}kg` : 'Chưa cập nhật'} • Màu {(pet.color && String(pet.color).trim()) ? String(pet.color).trim() : 'Chưa cập nhật'}
                </div>
                <div className="text-[11px] text-slate-600 font-medium px-2 py-1 rounded-md bg-slate-100 border border-slate-200">
                  <MapPin className="w-3 h-3 inline text-rose-600 mr-1" />
                  Mất tại: <strong>{lastLocation}</strong>
                </div>
              </div>

              {/* Big Reward Box */}
              <div className="mt-2 p-2 rounded-xl bg-amber-400 text-slate-950 font-black border-2 border-slate-950 shadow-sm">
                <div className="text-[10px] uppercase tracking-wider">HẬU TẠ XỨNG ĐÁNG / TIỀN CHUỘC</div>
                <div className="text-lg sm:text-xl leading-tight text-red-700">{reward}</div>
              </div>
            </div>

            {/* Bottom Contact & QR Code */}
            <div className="bg-slate-900 text-white p-3 flex items-center justify-between gap-3 text-left">
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase text-rose-400 font-bold">Liên hệ 24/7 (Gia đình):</div>
                <div className="text-base sm:text-lg font-black text-white tracking-tight truncate flex items-center gap-1">
                  <Phone className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  {emergencyPhone}
                </div>
                <div className="text-[10px] text-slate-300 truncate">
                  Xin gọi bất kỳ lúc nào nếu nhìn thấy bé!
                </div>
              </div>

              {/* QR Code */}
              <div className="bg-white p-1 rounded-xl flex-shrink-0">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(publicUrl)}`}
                  alt="QR Contact"
                  className="w-14 h-14 object-contain"
                />
              </div>
            </div>

          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between text-xs text-slate-500">
          <span>Gợi ý: Chia sẻ trực tiếp poster này lên các hội nhóm Cứu trợ chó mèo địa phương</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
}
