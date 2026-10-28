import React, { useState, useEffect } from 'react';
import { 
  X, 
  Settings, 
  Key, 
  Download, 
  Upload, 
  RotateCcw, 
  Check, 
  ShieldCheck, 
  Info,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { 
  getSettings, 
  saveSettings, 
  exportUserData, 
  importUserData, 
  resetUserData 
} from '../../services/storageService';
import { sound } from '../../services/soundService';
import { getTodayVnDate } from '../../utils/dateUtils';

export const SettingsModal = ({
  isOpen,
  onClose,
  onDataChanged,
  currentUser = null
}) => {
  const [importStatus, setImportStatus] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setImportStatus(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentUserId = currentUser?.id || 'user_owner_demo';

  const handleExport = () => {
    try {
      const jsonString = exportUserData(currentUserId);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `petcare_user_${currentUserId}_${getTodayVnDate()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      sound?.playSuccess?.();
    } catch (err) {
      alert(`Lỗi xuất dữ liệu: ${err.message}`);
    }
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        const res = importUserData(content, currentUserId);
        if (res.success) {
          sound?.playSuccess?.();
          setImportStatus('Khôi phục dữ liệu cá nhân thành công!');
          if (onDataChanged) onDataChanged();
          setTimeout(() => {
            onClose();
          }, 1000);
        } else {
          sound?.playAlert?.();
          setImportStatus(`Lỗi: ${res.message || 'File dữ liệu không đúng định dạng!'}`);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleResetData = () => {
    if (window.confirm('Bạn có chắc chắn muốn đặt lại dữ liệu thú cưng và nhật ký của tài khoản này? Dữ liệu của các tài khoản khác và thông tin đăng nhập sẽ không bị ảnh hưởng.')) {
      resetUserData(currentUserId);
      sound?.playTrash?.() || sound?.playClick?.();
      if (onDataChanged) onDataChanged();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#151622] rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200/80 dark:border-white/[0.08] my-8 text-slate-800 dark:text-slate-100 transition-colors">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/[0.08] mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Cài Đặt & Dữ Liệu Cá Nhân</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Tài khoản: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{currentUser?.name || 'Chủ nuôi'}</span></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Section: Personal Backup & Restore */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Sao Lưu & Nhập Dữ Liệu Của Bạn
              </h4>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">Chỉ áp dụng dữ liệu của bạn</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleExport}
                className="p-3 rounded-2xl border border-slate-200 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10 text-slate-700 dark:text-slate-200 transition-all flex flex-col items-center gap-1 text-center cursor-pointer"
              >
                <Download className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-bold">Xuất Dữ Liệu Cá Nhân</span>
                <span className="text-[10px] text-slate-400">File JSON riêng của bạn</span>
              </button>

              <label className="p-3 rounded-2xl border border-slate-200 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10 text-slate-700 dark:text-slate-200 transition-all flex flex-col items-center gap-1 text-center cursor-pointer">
                <Upload className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-bold">Nhập Dữ Liệu Cá Nhân</span>
                <span className="text-[10px] text-slate-400">Khôi phục vào tài khoản</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </label>
            </div>

            {importStatus && (
              <p className={`text-xs font-semibold text-center p-2 rounded-xl border ${
                importStatus.includes('Lỗi')
                  ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20'
                  : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
              }`}>
                {importStatus}
              </p>
            )}
          </div>

          {/* Section 3: Reset personal data */}
          <div className="pt-4 border-t border-slate-100 dark:border-white/[0.08] flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Đặt lại dữ liệu cá nhân</div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500">Xóa thú cưng và nhật ký thuộc tài khoản này</div>
            </div>

            <button
              onClick={handleResetData}
              className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Đặt lại dữ liệu
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
