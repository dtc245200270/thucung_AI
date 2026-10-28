import React, { useState } from 'react';
import { 
  X, 
  FlaskConical, 
  Package, 
  CreditCard, 
  Sparkles, 
  Upload, 
  CheckCircle2, 
  AlertTriangle,
  Receipt
} from 'lucide-react';

export const VetUtilitiesModal = ({
  isOpen,
  onClose,
  currentUser
}) => {
  const [activeUtilTab, setActiveUtilTab] = useState('lab'); // 'lab' | 'fefo' | 'pos'

  // AI Lab OCR State
  const [labResult, setLabResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleSimulateLab = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      setLabResult({
        wbc: '16.5 K/uL (Tăng nhẹ - cảnh báo viêm)',
        rbc: '6.8 M/uL (Bình thường)',
        plt: '310 K/uL (Bình thường)',
        alt: '52 U/L (Bình thường)',
        creatinine: '1.2 mg/dL (Bình thường)',
        conclusion: 'Hình ảnh sinh hóa máu tương thích với tình trạng viêm nhiễm đường tiêu hóa nhẹ, chức năng gan thận bình thường.'
      });
      setIsAnalyzing(false);
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="max-w-2xl w-full max-h-[90vh] bg-white dark:bg-[#151622] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Tiện ích lâm sàng bổ trợ
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  Công cụ hỗ trợ
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Các module hỗ trợ phân tích kết quả xét nghiệm, theo dõi dược và tính phí
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-5 pt-3 gap-3">
          <button
            onClick={() => setActiveUtilTab('lab')}
            className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeUtilTab === 'lab'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            AI Lab OCR (Xét nghiệm máu / X-quang)
          </button>
          <button
            onClick={() => setActiveUtilTab('fefo')}
            className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeUtilTab === 'fefo'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Package className="w-4 h-4" />
            Kho Dược FEFO (Mô phỏng)
          </button>
          <button
            onClick={() => setActiveUtilTab('pos')}
            className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeUtilTab === 'pos'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            POS Viện phí (Mô phỏng)
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeUtilTab === 'lab' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60 text-xs text-indigo-900 dark:text-indigo-300 space-y-1">
                <span className="font-bold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  Trợ lý phân tích ảnh xét nghiệm
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  Hỗ trợ trích xuất chỉ số sinh hóa máu (CBC, BioChem) hoặc film X-quang giúp bác sĩ tiết kiệm thời gian nhập liệu vào bệnh án SOAP.
                </p>
              </div>

              <div className="p-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-3">
                <Upload className="w-8 h-8 text-slate-400 mx-auto" />
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Tải lên phiếu xét nghiệm hoặc film X-quang
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Định dạng hỗ trợ: JPG, PNG, PDF (Tối đa 10MB)
                  </p>
                </div>
                <button
                  onClick={handleSimulateLab}
                  disabled={isAnalyzing}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isAnalyzing ? 'Đang phân tích chỉ số qua OCR...' : 'Chạy thử nghiệm mô phỏng'}
                </button>
              </div>

              {labResult && (
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Kết quả nhận diện tự động
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-400 block text-[10px]">Bạch cầu (WBC):</span>
                      <strong className="text-rose-600 dark:text-rose-400">{labResult.wbc}</strong>
                    </div>
                    <div className="p-2 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-400 block text-[10px]">Hồng cầu (RBC):</span>
                      <strong className="text-slate-800 dark:text-slate-200">{labResult.rbc}</strong>
                    </div>
                    <div className="p-2 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-400 block text-[10px]">Tiểu cầu (PLT):</span>
                      <strong className="text-slate-800 dark:text-slate-200">{labResult.plt}</strong>
                    </div>
                    <div className="p-2 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-400 block text-[10px]">Men gan (ALT):</span>
                      <strong className="text-slate-800 dark:text-slate-200">{labResult.alt}</strong>
                    </div>
                  </div>
                  <div className="p-2.5 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
                    <strong>Đánh giá tóm tắt: </strong> {labResult.conclusion}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeUtilTab === 'fefo' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-300 space-y-1">
                <span className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Mô phỏng nguyên tắc FEFO (First Expired, First Out)
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  Ưu tiên xuất kho những lô thuốc có hạn dùng gần nhất trước, tránh thất thoát do quá hạn tại phòng khám.
                </p>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-900/60 font-semibold grid grid-cols-4 text-slate-500">
                  <span>Mã lô</span>
                  <span>Tên thuốc</span>
                  <span>Hạn dùng (Expiry)</span>
                  <span>Trạng thái xuất</span>
                </div>
                <div className="p-3 grid grid-cols-4 items-center">
                  <span className="font-mono">LOT-2024-A1</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">Amoxicillin 250mg</span>
                  <span className="text-rose-500 font-semibold">15/11/2026</span>
                  <span className="px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 text-[10px] font-bold w-fit">
                    Ưu tiên 1 (Sắp hết hạn)
                  </span>
                </div>
                <div className="p-3 grid grid-cols-4 items-center">
                  <span className="font-mono">LOT-2024-B4</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">Amoxicillin 250mg</span>
                  <span className="text-slate-600 dark:text-slate-400">30/03/2027</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 text-[10px] font-semibold w-fit">
                    Ưu tiên 2
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeUtilTab === 'pos' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 text-xs text-sky-900 dark:text-sky-300 space-y-1">
                <span className="font-bold flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-sky-500" />
                  Mô phỏng thanh toán viện phí tại quầy
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  Tính toán tự động chi phí khám, xét nghiệm và tiền thuốc theo đơn để chủ nuôi thanh toán qua chuyển khoản VietQR hoặc tiền mặt.
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 bg-slate-50 dark:bg-slate-900/40 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Phí khám lâm sàng tổng quát</span>
                  <span className="font-semibold text-slate-900 dark:text-white">150.000 đ</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Xét nghiệm sinh hóa máu</span>
                  <span className="font-semibold text-slate-900 dark:text-white">250.000 đ</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Đơn thuốc SOAP điều trị</span>
                  <span className="font-semibold text-slate-900 dark:text-white">180.000 đ</span>
                </div>
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between text-sm font-black text-slate-900 dark:text-white">
                  <span>Tổng viện phí thanh toán:</span>
                  <span className="text-indigo-600 dark:text-indigo-400">580.000 đ</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
          >
            Đóng tiện ích
          </button>
        </div>
      </div>
    </div>
  );
};

export default VetUtilitiesModal;
