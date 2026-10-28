import React, { useState } from 'react';
import { 
  Eye, EyeOff, Sparkles, ArrowLeft, AlertCircle, 
  CheckCircle, Mail, Lock, ArrowRight, ShieldCheck, ChevronDown
} from 'lucide-react';
import { ToothlessMascot } from './ToothlessMascot';
import { ForestBackgroundIllustration } from './ForestBackgroundIllustration';
import { FallingPawsBackground } from './FallingPawsBackground';
import { sound } from '../../services/soundService';
import { 
  login, 
  forgotPassword,
  ROLES 
} from '../../services/authService';

export function LoginPage({ 
  onLoginSuccess, 
  onBackToHome, 
  showBackHome = false, 
  initialMode = 'login' 
}) {
  // 1. Chế độ: 'login' | 'forgot' (Đã bỏ hoàn toàn luồng tự đăng ký)
  const [mode, setMode] = useState(initialMode === 'forgot' ? 'forgot' : 'login');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showDevAccounts, setShowDevAccounts] = useState(false);

  // Login form inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Forgot password form input & states
  const [forgotEmail, setForgotEmail] = useState('');
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const [forgotSuccessMessage, setForgotSuccessMessage] = useState('');
  const [forgotErrorMessage, setForgotErrorMessage] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Focus tracking for Toothless chibi mascot interaction
  const [isUsernameFocused, setIsUsernameFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
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

  // ============================================================================
  // 1. HÀM ĐĂNG NHẬP NHANH 1-CLICK DÀNH CHO CÁC VAI TRÒ (RBAC DEMO)
  // Thực hiện đăng nhập đúng thông tin tài khoản và mật khẩu chuẩn
  // ============================================================================
  const handleQuickTestLogin = async (targetType = 'owner') => {
    setErrorMessage('');
    setSuccessMessage('');
    try {
      let targetEmail = '';
      let targetPass = '';
      if (targetType === 'admin') {
        targetEmail = 'admin@petcare.ai';
        targetPass = 'Admin@123456';
      } else if (targetType === 'vet') {
        targetEmail = 'tester@petcare.ai';
        targetPass = 'Doctor@123';
      } else {
        targetEmail = 'manhdinh2907@gmail.com';
        targetPass = '123456';
      }

      setEmail(targetEmail);
      setPassword(targetPass);
      const user = await login(targetEmail, targetPass, true);
      sound?.playSuccess?.();
      if (onLoginSuccess) {
        onLoginSuccess(user);
      }
    } catch (err) {
      sound?.playAlert?.();
      setErrorMessage(err.message || 'Lỗi đăng nhập');
    }
  };

  // ============================================================================
  // 2. XỬ LÝ SỰ KIỆN ĐĂNG NHẬP FORM (SIGN IN) - XÁC MINH NGHIÊM NGẶT
  // ============================================================================
  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const emailInput = (email || '').trim().toLowerCase();
    if (!emailInput) {
      setErrorMessage('Vui lòng nhập địa chỉ Email.');
      sound?.playAlert?.();
      return;
    }

    if (!password) {
      setErrorMessage('Vui lòng nhập Mật khẩu.');
      sound?.playAlert?.();
      return;
    }

    setIsLoading(true);
    try {
      const user = await login(emailInput, password, rememberMe);
      setIsLoading(false);
      if (onLoginSuccess) {
        onLoginSuccess(user);
      }
    } catch (err) {
      setIsLoading(false);
      sound?.playAlert?.();
      setErrorMessage(err.message || 'Đăng nhập không thành công.');
    }
  };

  // ============================================================================
  // 3. XỬ LÝ GỬI LIÊN KẾT KHÔI PHỤC MẬT KHẨU THỰC TẾ (FORGOT PASSWORD FLOW)
  // ============================================================================
  const handleForgotSubmit = async (e) => {
    if (e) e.preventDefault();
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
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#184232] relative px-4 py-8 select-none overflow-x-hidden selection:bg-emerald-500 selection:text-white font-sans">
      
      {/* Background Illustrations */}
      <ForestBackgroundIllustration />
      <FallingPawsBackground />

      {/* Top Bar: Back button */}
      {showBackHome && onBackToHome && (
        <div className="w-full max-w-[440px] mb-3 flex items-center justify-start z-20">
          <button
            type="button"
            onClick={() => {
              sound?.playClick?.();
              if (onBackToHome) onBackToHome();
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-100 hover:text-white transition-colors group px-3.5 py-1.5 rounded-xl bg-[#102B21]/75 border border-emerald-400/25 hover:border-emerald-300/50 backdrop-blur-md cursor-pointer shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
            <span>Trang chủ</span>
          </button>
        </div>
      )}

      {/* Chibi Mascot */}
      <div className="w-full max-w-[440px] relative z-20 flex justify-center -mb-8 pointer-events-none">
        <ToothlessMascot
          isPasswordFocused={isPasswordFocused}
          showPassword={showPassword}
          isUsernameFocused={isUsernameFocused}
          usernameLength={email.length}
          isSubmitting={isLoading}
        />
      </div>

      {/* Frosted Glass Card Container */}
      <div className="w-full max-w-[440px] bg-[#122A23]/75 border border-emerald-400/25 hover:border-emerald-400/40 rounded-[32px] shadow-[0_25px_60px_-15px_rgba(3,20,14,0.7),0_0_35px_rgba(16,185,129,0.15)] backdrop-blur-2xl p-6 sm:p-8 pt-8 z-10 flex flex-col relative transition-all duration-300">
        
        {/* Card Rim Highlight */}
        <div className="absolute top-0 left-10 right-10 h-[1.5px] bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent pointer-events-none" />

        {/* Card Header */}
        <div className="text-left mb-5 pt-1">
          {mode === 'forgot' ? (
            <>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Khôi Phục Mật Khẩu
              </h1>
              <p className="text-xs text-emerald-100/75 mt-1 font-normal tracking-wide">
                Nhập email để nhận liên kết đặt lại mật khẩu an toàn
              </p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-black tracking-tight text-white">
                Welcome back
              </h1>
              <p className="text-xs text-emerald-100/75 mt-1 font-normal tracking-wide">
                Đăng nhập để vào hệ sinh thái PetCare PRO AI
              </p>
            </>
          )}
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2.5 animate-shake backdrop-blur-md">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        {/* Success Notification */}
        {successMessage && (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs flex items-center gap-2.5 backdrop-blur-md">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="font-medium">{successMessage}</span>
          </div>
        )}

        {/* SUB-MODE: FORGOT PASSWORD */}
        {mode === 'forgot' ? (
          <div className="space-y-4">
            {forgotSuccessMessage ? (
              <div className="text-center py-4 space-y-3 animate-in fade-in">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center mx-auto ring-4 ring-emerald-500/15 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                  <CheckCircle className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="text-base font-bold text-white">Yêu Cầu Đã Được Tiếp Nhận</h3>
                <p className="text-xs text-emerald-100/90 max-w-xs mx-auto leading-relaxed">
                  {forgotSuccessMessage}
                </p>
                <div className="p-3 rounded-2xl bg-white/[0.06] border border-emerald-400/20 text-[11px] text-emerald-200/80 text-left space-y-1">
                  <p>• Liên kết đặt lại mật khẩu có hiệu lực trong vòng <strong>15 phút</strong>.</p>
                  <p>• Vui lòng kiểm tra hộp thư đến và cả thư mục <em>Spam / Thư rác</em>.</p>
                </div>

                {forgotErrorMessage && (
                  <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-400/30 text-rose-200 text-xs flex items-start gap-2 text-left">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{forgotErrorMessage}</span>
                  </div>
                )}

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="button"
                    id="btn-resend-recovery-link"
                    disabled={resendCooldown > 0 || isForgotLoading}
                    onClick={handleForgotSubmit}
                    className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition-all border border-emerald-400/30 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isForgotLoading ? (
                      <span>Đang gửi lại liên kết...</span>
                    ) : resendCooldown > 0 ? (
                      <span>Gửi lại liên kết sau ({resendCooldown}s)</span>
                    ) : (
                      <span>Gửi lại liên kết khôi phục</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setForgotSuccessMessage('');
                      setForgotErrorMessage('');
                      setMode('login');
                    }}
                    className="text-xs text-emerald-200/80 hover:text-white transition-colors cursor-pointer py-1"
                  >
                    ← Quay lại Đăng nhập
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <p className="text-xs text-emerald-100/80">
                  Nhập địa chỉ email của bạn để nhận liên kết đặt lại mật khẩu an toàn.
                </p>

                <div className="rounded-2xl bg-white/[0.08] border border-emerald-400/20 px-4 py-2.5 backdrop-blur-md">
                  <label className="block text-[11px] font-medium text-emerald-200/80 mb-0.5">
                    Địa chỉ Email của bạn
                  </label>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-emerald-400/70 shrink-0" />
                    <input
                      type="email"
                      id="input-forgot-email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full bg-transparent text-white text-sm placeholder-emerald-100/35 focus:outline-none font-medium"
                      autoFocus
                    />
                  </div>
                </div>

                {forgotErrorMessage && (
                  <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-400/30 text-rose-200 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{forgotErrorMessage}</span>
                  </div>
                )}

                <button
                  type="submit"
                  id="btn-forgot-password-submit"
                  disabled={isForgotLoading}
                  className="w-full py-3 px-5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-white font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isForgotLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Gửi Liên Kết Khôi Phục</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="text-xs text-emerald-200/80 hover:text-white transition-colors cursor-pointer"
                  >
                    ← Quay lại Đăng nhập
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          /* CHẾ ĐỘ CHÍNH: ĐĂNG NHẬP (LOGIN FORM) */
          <form onSubmit={handleLogin} className="space-y-4">
            
            {/* Username / Email Input */}
            <div 
              className={`rounded-2xl bg-white/[0.08] border px-4 py-2.5 backdrop-blur-md transition-all duration-300 ${
                isUsernameFocused 
                  ? 'ring-2 ring-emerald-400/30 border-emerald-400/60 bg-white/[0.12] shadow-[0_0_20px_rgba(16,185,129,0.2)]' 
                  : 'border-emerald-400/20 hover:border-emerald-400/35'
              }`}
            >
              <label className="block text-[11px] font-medium text-emerald-200/80 tracking-wide mb-0.5">
                Email hoặc Tên đăng nhập
              </label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setIsUsernameFocused(true)}
                onBlur={() => setIsUsernameFocused(false)}
                placeholder="name@petcare.ai hoặc email của bạn"
                className="w-full bg-transparent text-white text-sm placeholder-emerald-100/35 focus:outline-none font-medium"
                autoComplete="username"
              />
            </div>

            {/* Password Input */}
            <div 
              className={`rounded-2xl bg-white/[0.08] border px-4 py-2.5 backdrop-blur-md transition-all duration-300 relative ${
                isPasswordFocused 
                  ? 'ring-2 ring-emerald-400/30 border-emerald-400/60 bg-white/[0.12] shadow-[0_0_20px_rgba(16,185,129,0.2)]' 
                  : 'border-emerald-400/20 hover:border-emerald-400/35'
              }`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <label className="block text-[11px] font-medium text-emerald-200/80 tracking-wide">
                  Mật khẩu
                </label>
                <button
                  type="button"
                  onClick={() => {
                    sound?.playClick?.();
                    setShowPassword(!showPassword);
                  }}
                  className="text-emerald-200/70 hover:text-white transition-colors cursor-pointer p-0.5"
                  title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-emerald-300 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setIsPasswordFocused(true)}
                onBlur={() => setIsPasswordFocused(false)}
                placeholder="Nhập mật khẩu"
                className="w-full bg-transparent text-white text-sm placeholder-emerald-100/35 focus:outline-none font-medium"
                autoComplete="current-password"
              />
            </div>

            {/* Remember Me & Forgot Password Row */}
            <div className="flex items-center justify-between text-xs pt-0.5 pb-1">
              <label className="flex items-center gap-2 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded-md bg-white/10 border border-emerald-400/30 text-emerald-500 focus:ring-0 focus:ring-offset-0 transition-colors cursor-pointer"
                />
                <span className="text-emerald-100/80 group-hover:text-white transition-colors">
                  Ghi nhớ đăng nhập
                </span>
              </label>

              <button
                type="button"
                onClick={() => {
                  sound?.playClick?.();
                  setMode('forgot');
                  setErrorMessage('');
                }}
                className="text-emerald-200/80 hover:text-white transition-colors cursor-pointer hover:underline"
              >
                Quên mật khẩu?
              </button>
            </div>

            {/* Nút Đăng Nhập Chính (Sign In) */}
            <button
              type="submit"
              id="btn-sign-in-submit"
              disabled={isLoading}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-white font-bold text-sm shadow-[0_4px_20px_rgba(16,185,129,0.35)] hover:shadow-[0_6px_25px_rgba(16,185,129,0.5)] hover:-translate-y-0.5 active:scale-98 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-emerald-200" />
                  <span>Đăng Nhập Vào Hệ Thống (Sign In)</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>

            {/* Hướng dẫn tài khoản do Quản trị viên cấp (Theo Yêu Cầu 3) */}
            <div className="text-center pt-3 mt-1 border-t border-emerald-400/15">
              <p className="text-xs text-emerald-100/80 leading-relaxed font-medium">
                Tài khoản được quản trị viên cấp. Vui lòng liên hệ quản trị viên để được hỗ trợ.
              </p>
            </div>

          </form>
        )}

      </div>

      {/* Security Footer Notice */}
      <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-emerald-100/80 font-medium">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
        <span>Bảo mật chuẩn y khoa • Hệ sinh thái PetCare PRO AI 2026</span>
      </div>

      {/* Chế độ Demo (Dành cho kiểm thử) */}
      <div className="text-center mt-6 relative z-20">
        <button 
          type="button" 
          onClick={() => {
            sound?.playClick?.();
            setShowDevAccounts(!showDevAccounts);
          }} 
          className="text-xs text-emerald-800/40 hover:text-emerald-800/80 dark:text-emerald-200/40 dark:hover:text-emerald-200/80 transition-colors cursor-pointer inline-flex items-center gap-1.5 py-1 px-3 rounded-lg hover:bg-white/5"
        >
          <span>⚙️ Chế độ Demo (Dành cho kiểm thử)</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${showDevAccounts ? 'rotate-180' : ''}`} />
        </button>

        {showDevAccounts && (
          <div className="mt-2.5 p-3 rounded-2xl bg-[#0f251d]/95 border border-emerald-400/30 backdrop-blur-xl shadow-2xl max-w-sm mx-auto animate-in fade-in slide-in-from-bottom-2 duration-200 space-y-2">
            <p className="text-[10px] text-emerald-200/70 font-semibold uppercase tracking-wider">
              Chọn tài khoản demo nhanh:
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                id="btn-test-admin"
                onClick={() => handleQuickTestLogin('admin')}
                className="py-2 px-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 text-xs font-bold border border-purple-400/40 transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer active:scale-95"
              >
                <span>🛡️</span>
                <span className="truncate text-[11px]">Admin QT</span>
              </button>
              <button
                type="button"
                id="btn-test-clinic-admin"
                onClick={() => handleQuickTestLogin('vet')}
                className="py-2 px-1.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-200 text-xs font-bold border border-teal-400/40 transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer active:scale-95"
              >
                <span>🩺</span>
                <span className="truncate text-[11px]">Bác Sĩ</span>
              </button>
              <button
                type="button"
                id="btn-test-owner"
                onClick={() => handleQuickTestLogin('owner')}
                className="py-2 px-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-xs font-bold border border-emerald-400/40 transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer active:scale-95"
              >
                <span>🐶</span>
                <span className="truncate text-[11px]">Chủ Nuôi</span>
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

export default LoginPage;
