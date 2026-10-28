import React, { useState } from 'react';
import { 
  X, Mail, Lock, CheckCircle, 
  AlertCircle, ArrowRight, ShieldCheck, 
  Eye, EyeOff, HeartHandshake, Shield
} from 'lucide-react';
import { login, forgotPassword } from '../../services/authService';
import { sound } from '../../services/soundService';

export function AuthModal({ isOpen, onClose, onAuthSuccess, onSuccess, initialMode = 'login' }) {
  const handleSuccess = onAuthSuccess || onSuccess;
  const [mode, setMode] = useState(initialMode === 'forgot' ? 'forgot' : 'login');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem('petcare_remembered_email'));
  
  // Login form state
  const [email, setEmail] = useState(() => localStorage.getItem('petcare_remembered_email') || '');
  const [password, setPassword] = useState('');
  const [showDevAccounts, setShowDevAccounts] = useState(false);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const [forgotSuccessMessage, setForgotSuccessMessage] = useState('');
  const [forgotErrorMessage, setForgotErrorMessage] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Bộ đếm thời gian chờ gửi lại liên kết khôi phục (Cooldown 60s)
  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const user = await login(email, password, rememberMe);
      setIsLoading(false);
      if (handleSuccess) handleSuccess(user);
      onClose();
    } catch (err) {
      setIsLoading(false);
      sound.playAlert();
      setErrorMessage(err.message || 'Đăng nhập không thành công');
    }
  };

  const handleQuickDemoLogin = () => {
    setEmail('manhdinh2907@gmail.com');
    setPassword('123456');
    sound?.playClick?.();
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotErrorMessage('');

    const cleanEmail = (forgotEmail || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!cleanEmail) {
      setForgotErrorMessage('Vui lòng nhập địa chỉ email của bạn.');
      sound?.playAlert?.();
      return;
    }

    if (!emailRegex.test(cleanEmail)) {
      setForgotErrorMessage('Địa chỉ email không đúng định dạng (ví dụ: name@example.com).');
      sound?.playAlert?.();
      return;
    }

    setIsForgotLoading(true);
    try {
      const res = await forgotPassword(cleanEmail);
      setIsForgotLoading(false);
      setForgotSuccessMessage(
        res.message || 'Nếu email này đã được đăng ký, bạn sẽ nhận được liên kết đặt lại mật khẩu.'
      );
      setResendCooldown(60);
      sound?.playSuccess?.();
    } catch (err) {
      setIsForgotLoading(false);
      sound?.playAlert?.();
      setForgotErrorMessage(err.message || 'Đã xảy ra lỗi khi gửi liên kết khôi phục. Vui lòng thử lại sau.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0B132B] text-slate-100 border border-slate-800/80 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative">
        
        {/* Glow ambient background lights */}
        <div className="absolute top-0 left-1/4 -translate-y-1/2 w-64 h-32 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 translate-y-1/2 w-64 h-32 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-800/60 relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-tight text-white">PetCare</span>
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                  PRO AI
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {mode === 'forgot' ? 'Khôi phục mật khẩu' : 'Đăng nhập hệ thống'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form Body */}
        <div className="p-6 relative z-10">
          {mode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Email hoặc Tên đăng nhập:
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@petcare.ai"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Mật khẩu:
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-800 text-emerald-500 focus:ring-0"
                  />
                  <span>Ghi nhớ</span>
                </label>
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setErrorMessage(''); }}
                  className="text-emerald-400 hover:underline"
                >
                  Quên mật khẩu?
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
              >
                <span>{isLoading ? 'Đang xác thực...' : 'Đăng Nhập Ngay'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Hướng dẫn tài khoản do Quản trị viên cấp */}
              <div className="text-center pt-3 border-t border-slate-800/80">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Tài khoản được quản trị viên cấp. Vui lòng liên hệ quản trị viên để được hỗ trợ.
                </p>
              </div>

              {/* Chế độ Demo (Dành cho kiểm thử) */}
              <div className="text-center mt-2">
                <button
                  type="button"
                  onClick={() => setShowDevAccounts(!showDevAccounts)}
                  className="text-[11px] text-slate-500 hover:text-slate-400 transition-colors cursor-pointer"
                >
                  ⚙️ Điền thông tin tài khoản mẫu
                </button>
                {showDevAccounts && (
                  <div className="mt-2 p-2 rounded-xl bg-slate-900 border border-emerald-500/20 text-center animate-in fade-in">
                    <button
                      type="button"
                      onClick={handleQuickDemoLogin}
                      className="text-xs font-bold text-emerald-400 hover:text-emerald-300 cursor-pointer"
                    >
                      🐶 Điền nhanh tài khoản Chủ nuôi (Đinh Xuân Mạnh)
                    </button>
                  </div>
                )}
              </div>
            </form>
          ) : (
            /* SUB-MODE: FORGOT PASSWORD */
            <div className="space-y-4">
              {forgotSuccessMessage ? (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs space-y-2 text-center animate-in fade-in">
                  <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto" />
                  <p className="font-bold text-white text-sm">Yêu Cầu Đã Được Tiếp Nhận</p>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {forgotSuccessMessage}
                  </p>
                  <p className="text-[10px] text-emerald-400/80">
                    Liên kết có hiệu lực trong vòng 15 phút. Vui lòng kiểm tra cả thư mục Spam.
                  </p>

                  {forgotErrorMessage && (
                    <div className="p-2 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[11px] text-left">
                      {forgotErrorMessage}
                    </div>
                  )}

                  <div className="pt-2 flex flex-col gap-2">
                    <button
                      type="button"
                      disabled={resendCooldown > 0 || isForgotLoading}
                      onClick={handleForgotSubmit}
                      className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-50 text-white text-xs font-bold transition-all border border-emerald-400/30 cursor-pointer"
                    >
                      {resendCooldown > 0 ? `Gửi lại sau (${resendCooldown}s)` : 'Gửi lại liên kết'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setForgotSuccessMessage('');
                        setForgotErrorMessage('');
                        setMode('login');
                      }}
                      className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      ← Quay lại Đăng nhập
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Nhập email đăng ký để nhận liên kết khôi phục mật khẩu an toàn.
                  </p>

                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>

                  {forgotErrorMessage && (
                    <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                      {forgotErrorMessage}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isForgotLoading}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span>{isForgotLoading ? 'Đang gửi...' : 'Gửi Liên Kết Khôi Phục'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => setMode('login')}
                      className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      ← Quay lại Đăng nhập
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-4 bg-slate-900/60 border-t border-slate-800/60 text-center text-[10px] text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Hệ sinh thái PetCare PRO AI • Cơ chế cấp quyền tập trung</span>
        </div>

      </div>
    </div>
  );
}

export default AuthModal;
