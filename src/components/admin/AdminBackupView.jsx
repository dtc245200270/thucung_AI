import React, { useState } from 'react';
import { 
  HardDrive, 
  Download, 
  Upload, 
  RotateCcw, 
  ShieldAlert, 
  CheckCircle, 
  AlertTriangle, 
  Check, 
  X,
  FileCode,
  Server,
  Database,
  Lock,
  Layers
} from 'lucide-react';
import { 
  exportSystemData, 
  importSystemData, 
  resetSystemData 
} from '../../services/storageService';
import { sound } from '../../services/soundService';
import { getTodayVnDate } from '../../utils/dateUtils';

export const AdminBackupView = ({
  currentAdmin = null,
  onDataChanged
}) => {
  const [importStatus, setImportStatus] = useState(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);
  const [pendingImportContent, setPendingImportContent] = useState(null);
  const [importPreview, setImportPreview] = useState(null);

  // 1. Xuất sao lưu toàn hệ thống
  const handleExportSystem = async () => {
    try {
      const jsonString = await exportSystemData();
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `petcare_SYSTEM_BACKUP_${getTodayVnDate()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      sound?.playSuccess?.();
    } catch (err) {
      alert(`Lỗi xuất file hệ thống: ${err.message}`);
    }
  };

  // 2. Chọn file và tiền kiểm tra cấu trúc (Preview)
  const handleSelectFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        try {
          const parsed = JSON.parse(content);
          if (!parsed || typeof parsed !== 'object') {
            throw new Error('Nội dung file không phải là JSON object.');
          }

          // Tiền kiểm tra các mảng dữ liệu
          setPendingImportContent(content);
          setImportPreview({
            usersCount: Array.isArray(parsed.users) ? parsed.users.length : 0,
            petsCount: Array.isArray(parsed.pets) ? parsed.pets.length : 0,
            schedulesCount: Array.isArray(parsed.schedules) ? parsed.schedules.length : 0,
            expensesCount: Array.isArray(parsed.expenses) ? parsed.expenses.length : 0,
            appointmentsCount: Array.isArray(parsed.appointments) ? parsed.appointments.length : 0,
            medicalRecordsCount: Array.isArray(parsed.medicalRecords || parsed.medical_records) ? (parsed.medicalRecords || parsed.medical_records).length : 0
          });
          setIsImportConfirmOpen(true);
        } catch (err) {
          sound?.playAlert?.();
          setImportStatus({
            type: 'error',
            message: `Lỗi đọc file: ${err.message || 'File JSON không hợp lệ!'}`
          });
        }
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input file
  };

  // 3. Thực hiện khôi phục hệ thống sau khi đã xác nhận
  const handleConfirmImport = async () => {
    if (!pendingImportContent) return;
    const res = await importSystemData(pendingImportContent);
    setIsImportConfirmOpen(false);
    setPendingImportContent(null);
    setImportPreview(null);

    if (res.success) {
      sound?.playSuccess?.();
      setImportStatus({
        type: 'success',
        message: 'Khôi phục toàn bộ cơ sở dữ liệu hệ thống thành công!'
      });
      if (onDataChanged) onDataChanged();
    } else {
      sound?.playAlert?.();
      setImportStatus({
        type: 'error',
        message: res.message
      });
    }
  };

  // 4. Đặt lại dữ liệu mẫu hệ thống (An toàn: Không dùng localStorage.clear)
  const handleConfirmReset = () => {
    resetSystemData();
    setIsResetConfirmOpen(false);
    sound?.playTrash?.() || sound?.playSuccess?.();
    setImportStatus({
      type: 'success',
      message: 'Đã hoàn tất đặt lại dữ liệu nghiệp vụ mẫu. Tài khoản quản trị và phiên làm việc đã được bảo toàn nguyên vẹn!'
    });
    if (onDataChanged) onDataChanged();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Banner Tiêu Đề */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-[#E2E8F0] dark:border-white/10 shadow-sm text-[#1E293B] dark:text-slate-100 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>Sao Lưu, Khôi Phục & Quản Trị Dữ Liệu Toàn Hệ Thống</span>
          </h2>
          <p className="text-xs text-[#475569] dark:text-slate-400 mt-0.5">
            Phân hệ dành riêng cho Quản trị viên hệ thống (system_admin). Tác động trực tiếp đến toàn bộ người dùng, thú cưng và lịch trình.
          </p>
        </div>
      </div>

      {/* Thông báo trạng thái */}
      {importStatus && (
        <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-200 ${
          importStatus.type === 'error'
            ? 'bg-rose-50 dark:bg-rose-500/20 border-rose-200 dark:border-rose-400/30 text-rose-700 dark:text-rose-200'
            : 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-200 dark:border-emerald-400/30 text-emerald-700 dark:text-emerald-200'
        }`}>
          <div className="flex items-center gap-2">
            {importStatus.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
            <span>{importStatus.message}</span>
          </div>
          <button onClick={() => setImportStatus(null)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/20">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3 Thao Tác Quản Trị Cốt Lõi */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* 1. Xuất file sao lưu hệ thống */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-[#E2E8F0] dark:border-white/10 shadow-sm text-[#1E293B] dark:text-slate-100 flex flex-col justify-between space-y-4">
          <div>
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-white/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-white/20 flex items-center justify-center mb-3 shadow-xs">
              <Download className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">
              Sao Lưu Toàn Bộ Hệ Thống
            </h3>
            <p className="text-xs text-[#475569] dark:text-slate-400 mt-1 leading-relaxed">
              Tải tệp JSON chứa toàn bộ tài khoản người dùng (mật khẩu đã được ẩn), tất cả thú cưng, lịch trình, chi tiêu và lịch hẹn khám.
            </p>
          </div>

          <button
            onClick={handleExportSystem}
            className="w-full py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/25 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Tải Bản Sao Lưu JSON</span>
          </button>
        </div>

        {/* 2. Khôi phục từ file JSON */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-[#E2E8F0] dark:border-white/10 shadow-sm text-[#1E293B] dark:text-slate-100 flex flex-col justify-between space-y-4">
          <div>
            <div className="w-10 h-10 rounded-2xl bg-cyan-50 dark:bg-white/10 text-cyan-600 dark:text-cyan-400 border border-cyan-100 dark:border-white/20 flex items-center justify-center mb-3 shadow-xs">
              <Upload className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">
              Khôi Phục Toàn Bộ Hệ Thống
            </h3>
            <p className="text-xs text-[#475569] dark:text-slate-400 mt-1 leading-relaxed">
              Nạp tệp JSON đã sao lưu trước đó. Hệ thống sẽ kiểm tra cấu trúc dữ liệu, kiểu giá trị và bảo vệ tài khoản admin trước khi áp dụng.
            </p>
          </div>

          <label className="w-full py-2.5 rounded-2xl border border-cyan-200 dark:border-cyan-400/40 bg-cyan-50 dark:bg-cyan-500/20 hover:bg-cyan-100 dark:hover:bg-cyan-500/30 text-cyan-700 dark:text-cyan-200 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 text-center shadow-xs">
            <Upload className="w-4 h-4" />
            <span>Chọn Tệp JSON Khôi Phục</span>
            <input
              type="file"
              accept=".json"
              onChange={handleSelectFile}
              className="hidden"
            />
          </label>
        </div>

        {/* 3. Đặt lại dữ liệu mẫu hệ thống */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-[#E2E8F0] dark:border-white/10 shadow-sm text-[#1E293B] dark:text-slate-100 flex flex-col justify-between space-y-4">
          <div>
            <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-white/10 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-white/20 flex items-center justify-center mb-3 shadow-xs">
              <RotateCcw className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">
              Đặt Lại Dữ Liệu Mẫu Hệ Thống
            </h3>
            <p className="text-xs text-[#475569] dark:text-slate-400 mt-1 leading-relaxed">
              Khôi phục các bảng nghiệp vụ (thú cưng, lịch tiêm, chi tiêu) về trạng thái mẫu chuẩn. <strong>Tuyệt đối không xóa tài khoản người dùng hoặc phiên đăng nhập.</strong>
            </p>
          </div>

          <button
            onClick={() => setIsResetConfirmOpen(true)}
            className="w-full py-2.5 rounded-2xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Đặt Lại Dữ Liệu Nghiệp Vụ</span>
          </button>
        </div>

      </div>

      {/* ============================================================ */}
      {/* KHỐI BÁO CÁO GIỚI HẠN BẢO MẬT (SECURITY LIMITATIONS STATEMENT) */}
      {/* ============================================================ */}
      <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-amber-500/10 via-slate-900/10 to-indigo-500/10 dark:from-amber-950/20 dark:via-[#151622] dark:to-indigo-950/20 border border-amber-500/30 backdrop-blur-2xl shadow-md space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
              Tuyên Bố Kiến Trúc & Giới Hạn Bảo Mật (Security Architecture Statement)
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Nguyên tắc minh bạch kỹ thuật theo yêu cầu thiết kế hệ thống
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
          <div className="p-4 rounded-2xl bg-white/70 dark:bg-white/[0.03] border border-amber-500/20 space-y-2">
            <h4 className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <Layers className="w-4 h-4" /> Hiện trạng triển khai (Client-Side Storage)
            </h4>
            <p>
              Hệ thống hiện tại hoạt động theo mô hình <strong>Single Page Application (React + Vite)</strong> với toàn bộ cơ sở dữ liệu lưu trữ tại <code>localStorage</code> của trình duyệt.
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              ⚠️ Cơ chế phân quyền RBAC và cô lập dữ liệu người dùng ở máy khách đóng vai trò định tuyến luồng, ngăn chặn truy cập giao diện và mô phỏng bảo mật ứng dụng. Do nằm ở phía trình duyệt, người dùng có kỹ năng kỹ thuật có thể can thiệp qua DevTools. Đây chưa phải là bảo mật hoàn chỉnh cho hệ thống sản phẩm (Production).
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/70 dark:bg-white/[0.03] border border-indigo-500/20 space-y-2">
            <h4 className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
              <Server className="w-4 h-4" /> Lộ trình nâng cấp Server-Side Production
            </h4>
            <ul className="space-y-1 text-[11px] list-disc list-inside text-slate-600 dark:text-slate-400">
              <li>Xây dựng Backend REST API (Node.js/Express, Python FastAPI hoặc Go).</li>
              <li>Băm mật khẩu người dùng phía máy chủ bằng thuật toán <strong>bcrypt / Argon2</strong>.</li>
              <li>Quản lý phiên đăng nhập qua <strong>JWT (HttpOnly Cookie)</strong> hoặc Redis Session.</li>
              <li>Thiết lập Row Level Security (RLS) và ràng buộc khóa ngoại (Foreign Keys) trên PostgreSQL.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* MODAL XÁC NHẬN NHẬP DỮ LIỆU HỆ THỐNG */}
      {isImportConfirmOpen && importPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#151622] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-100 space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 mb-3">
                <Upload className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Xác Nhận Khôi Phục Toàn Hệ Thống?
              </h3>
              <p className="text-xs text-rose-500 font-bold mt-1">
                ⚠️ Hành động này sẽ ghi đè dữ liệu hiện tại bằng dữ liệu trong file!
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 text-xs space-y-1.5">
              <p className="font-bold text-slate-700 dark:text-slate-300">Nội dung tệp sao lưu chuẩn bị nạp:</p>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                <div>• Tài khoản: <strong>{importPreview.usersCount}</strong></div>
                <div>• Thú cưng: <strong>{importPreview.petsCount}</strong></div>
                <div>• Lịch trình: <strong>{importPreview.schedulesCount}</strong></div>
                <div>• Lịch hẹn: <strong>{importPreview.appointmentsCount}</strong></div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => {
                  setIsImportConfirmOpen(false);
                  setPendingImportContent(null);
                  setImportPreview(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 text-xs font-bold cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmImport}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer"
              >
                Xác nhận khôi phục
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN ĐẶT LẠI DỮ LIỆU MẪU */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#151622] rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-100 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center bg-rose-500/10 text-rose-500 border border-rose-500/20">
              <RotateCcw className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Đặt Lại Dữ Liệu Nghiệp Vụ Mẫu?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Các hồ sơ thú cưng, lịch tiêm phòng và chi tiêu sẽ được khôi phục về bộ mẫu ban đầu. <strong>Tài khoản Quản trị viên và phiên làm việc của bạn sẽ được bảo toàn an toàn.</strong>
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 text-xs font-bold cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmReset}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
              >
                Đồng ý đặt lại
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
