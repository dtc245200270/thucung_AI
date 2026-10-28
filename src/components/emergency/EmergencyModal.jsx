import React, { useState } from 'react';
import { 
  AlertTriangle, 
  PhoneCall, 
  MapPin, 
  X, 
  ShieldAlert, 
  Zap, 
  Flame, 
  Wind, 
  AlertOctagon, 
  Send, 
  CheckCircle2, 
  ChevronRight, 
  HeartPulse, 
  Radio
} from 'lucide-react';
import { sound } from '../../services/soundService';
import { saveActiveAppointments, getActiveAppointments } from '../../services/storageService';
import { getTodayVnDate } from '../../utils/dateUtils';
import { VET_FACILITIES } from '../../constants/clinicFacilities';

/**
 * EmergencyModal - Trung tâm Cấp Cứu Thú Y 24/7 & Hồi Sức Tích Cực
 * Hỗ trợ:
 * - Gọi điện cấp cứu khẩn cấp 1-chạm: tel:02473000899
 * - Chỉ đường tới viện gần nhất: 128 Cầu Giấy (Cách 1.2km)
 * - Phát tín hiệu báo động đỏ tới bác sĩ trực phòng khám (Trigger Emergency Triage)
 * - 4 Thẻ hướng dẫn sơ cứu nhanh tại chỗ chuẩn WSAVA
 */
export const EmergencyModal = ({
  isOpen = false,
  onClose = () => {},
  currentPet = null,
  onEmergencyTriggered = () => {}
}) => {
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'choking' | 'poison' | 'seizure' | 'heatstroke'
  const [isSendingAlert, setIsSendingAlert] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [hasSentAlert, setHasSentAlert] = useState(false);

  if (!isOpen) return null;

  // Lấy thông tin bé cưng từ state hiện tại
  const petName = currentPet?.name || 'Thú cưng';
  const petBreed = currentPet?.breed || (currentPet?.species === 'cat' ? 'Mèo' : currentPet?.species === 'dog' ? 'Chó' : (currentPet?.species || 'Chưa rõ giống'));
  const petWeight = currentPet?.weight ? `${currentPet.weight}kg` : 'Chưa rõ cân nặng';
  const petEmergencyTitle = currentPet ? `${petName} - ${petBreed}, ${petWeight}` : 'Chưa chọn thú cưng';

  // Xử lý gửi tín hiệu báo động đỏ tới phòng khám (Trigger Emergency Triage)
  const handleTriggerEmergencyTriage = () => {
    setIsSendingAlert(true);
    try {
      sound.playAlert();
    } catch (_) {}

    const newEmergencyTicket = {
      id: 'EMG-' + Date.now(),
      petName: petName,
      petType: petBreed,
      emergency: true,
      isEmergency: true,
      status: 'pending',
      triageLevel: 'CRITICAL',
      priority: 'emergency',
      note: 'Báo động cấp cứu khẩn cấp từ chủ nuôi qua nút SOS',
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      date: getTodayVnDate(),
      ownerName: 'Nguyễn Văn An (Chủ nuôi)',
      phone: '0912 345 678',
      service: '🚨 CẤP CỨU KHẨN CẤP (BÁO ĐỘNG ĐỎ)',
      facility: VET_FACILITIES[0]?.name || 'Bệnh viện Thú y 2Vet Hospital',
      facilityId: VET_FACILITIES[0]?.id || '2vet',
      clinicId: VET_FACILITIES[0]?.id || '2vet',
      assignedVet: 'Bác sĩ trực cấp cứu ICU',
      createdAt: new Date().toISOString()
    };

    // 1. Lưu vào localStorage dùng chung petcare_shared_appointments
    let existingList = [];
    try {
      const raw = localStorage.getItem('petcare_shared_appointments') || localStorage.getItem('petcare_active_appointments');
      if (raw) {
        existingList = JSON.parse(raw);
      }
    } catch (e) {
      console.error('Error reading shared appointments:', e);
    }

    if (!Array.isArray(existingList) || existingList.length === 0) {
      existingList = getActiveAppointments();
    }

    // Đưa ca cấp cứu lên đầu danh sách với mức ưu tiên cao nhất
    const updatedList = [newEmergencyTicket, ...existingList.filter(a => a.id !== newEmergencyTicket.id)];
    try {
      localStorage.setItem('petcare_shared_appointments', JSON.stringify(updatedList));
      saveActiveAppointments(updatedList);
      // Dispatch storage event để các tab khác / Admin workspace đồng bộ ngay lập tức
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('petcare_emergency_triggered', { detail: newEmergencyTicket }));
    } catch (e) {
      console.error('Error saving emergency ticket:', e);
    }

    // 2. Hiển thị Toast thông báo và tự động đóng modal
    setHasSentAlert(true);
    setIsSendingAlert(false);
    setToastMessage('🚨 Đã gửi tín hiệu báo động đỏ! Bác sĩ trực tại phòng khám đã nhận được thông tin tiếp đón khẩn cấp.');

    try {
      sound.playSuccess();
    } catch (_) {}

    onEmergencyTriggered(newEmergencyTicket);

    // Tự động đóng modal sau khi người dùng nhìn thấy Toast xác nhận
    setTimeout(() => {
      setToastMessage(null);
      onClose();
    }, 2000);
  };

  // 4 thẻ hướng dẫn sơ cứu nhanh tại nhà
  const firstAidGuides = [
    {
      id: 'choking',
      title: 'Sặc dị vật / Khó thở',
      badge: 'NGẠT ĐƯỜNG THỞ',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      icon: Wind,
      color: 'from-amber-500/20 to-orange-500/10 border-amber-500/30 text-amber-400',
      summary: 'Cách vỗ lưng và ép bụng kiểu Heimlich cho cún.',
      steps: [
        'Mở mõm kiểm tra khoang họng, kéo lưỡi nhẹ nhàng sang một bên. Nếu nhìn thấy dị vật, dùng nhíp hoặc ngón tay gắp ra cẩn thận.',
        'Đứng sau lưng bé hoặc nâng 2 chân sau lên (tư thế xe cút kít), dùng mu bàn tay vỗ 4-5 lần dứt khoát vào giữa 2 bả vai.',
        'Thực hiện thủ thuật Heimlich: Nắm chặt bàn tay đặt vào hõm bụng (ngay dưới xương sườn cuối), ép dứt khoát hướng lên trên theo góc 45°.'
      ]
    },
    {
      id: 'poison',
      title: 'Ngộ độc / Nuốt phải bả, hóa chất',
      badge: 'CHẤT KỊCH ĐỘC',
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      icon: AlertOctagon,
      color: 'from-rose-500/20 to-red-500/10 border-rose-500/30 text-rose-400',
      summary: 'Không tự ý gây nôn nếu nuốt axit; giữ mẫu vật mang đến viện.',
      steps: [
        'TUYỆT ĐỐI KHÔNG tự ý gây nôn bằng oxy già hay nước muối nếu bé nuốt phải axit, kiềm, nước tẩy bồn cầu hoặc pin (nguy cơ thủng thực quản).',
        'Thu thập ngay bao bì, nhãn mác, bả bẫy hoặc một phần bãi nôn vào túi nilon sạch để bác sĩ xác định hoạt chất độc.',
        'Nếu bé còn tỉnh táo và chất độc không phải axit: Cho uống than hoạt tính (Activated Charcoal) theo chỉ dẫn của bác sĩ trực.'
      ]
    },
    {
      id: 'seizure',
      title: 'Co giật / Động kinh',
      badge: 'THẦN KINH CẤP',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      icon: Zap,
      color: 'from-purple-500/20 to-indigo-500/10 border-purple-500/30 text-purple-400',
      summary: 'Đặt bé nằm nghiêng trên đệm mềm, dọn vật cản, tuyệt đối không thò tay vào miệng.',
      steps: [
        'Dọn dẹp ngay các vật sắc nhọn, bàn ghế xung quanh; đặt bé nằm nghiêng một bên trên mặt sàn phẳng hoặc đệm mềm.',
        'TUYỆT ĐỐI KHÔNG thò tay hoặc thìa vào mõm bé - động vật không nuốt lưỡi khi co giật nhưng có thể cắn dập ngón tay vô thức.',
        'Tắt đèn sáng, giảm tiếng ồn, dùng điện thoại quay video lại cơn co giật để cung cấp dữ liệu chẩn đoán chính xác cho bác sĩ thần kinh.'
      ]
    },
    {
      id: 'heatstroke',
      title: 'Sốc nhiệt (Say nắng)',
      badge: 'HẠ THÂN NHIỆT KHẨN',
      badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
      icon: Flame,
      color: 'from-orange-500/20 to-red-500/10 border-orange-500/30 text-orange-400',
      summary: 'Dùng khăn mát lau 4 đệm bàn chân, nách và bẹn; không xối nước đá lạnh đột ngột.',
      steps: [
        'Đưa ngay bé vào phòng máy lạnh hoặc bóng râm có quạt gió lưu thông tối đa.',
        'Dùng khăn nhúng nước mát (khoảng 20 - 25°C) áp liên tục vào 4 đệm lòng bàn chân, bẹn, nách và sau gáy bé.',
        'TUYỆT ĐỐI KHÔNG dội nước đá lạnh hoặc ngâm bé vào nước đá vì sẽ gây co thắt mạch ngoại vi đột ngột, giữ nhiệt lại nội tạng gây tử vong.'
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-slate-900/95 border-2 border-red-500/80 rounded-3xl shadow-[0_0_60px_rgba(239,68,68,0.45)] text-white overflow-hidden my-4 max-h-[92vh] flex flex-col">
        
        {/* Thanh trang trí viền LED cảnh báo đỏ */}
        <div className="h-1.5 w-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 animate-pulse" />

        {/* ---------------------------------------------------- */}
        {/* 1. HEADER CẢNH BÁO                                   */}
        {/* ---------------------------------------------------- */}
        <div className="p-5 sm:p-6 border-b border-white/10 bg-gradient-to-b from-red-950/40 to-transparent flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            {/* Biểu tượng còi báo động nhấp nháy */}
            <div className="w-12 h-12 rounded-2xl bg-red-600/20 border border-red-500/50 flex items-center justify-center text-red-500 shrink-0 shadow-[0_0_20px_rgba(239,68,68,0.5)] animate-pulse">
              <ShieldAlert className="w-7 h-7 stroke-[2.5]" />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-wide uppercase">
                  TRUNG TÂM CẤP CỨU THÚ Y 24/7
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-red-600 text-white animate-pulse shadow-xs">
                  🚨 BÁO ĐỘNG ĐỎ
                </span>
              </div>

              {/* Tên bé gặp nạn: Tự động lấy thông tin từ pet đang chọn */}
              <div className="mt-1 flex items-center gap-2 flex-wrap text-xs sm:text-sm">
                <span className="text-slate-400">Bệnh nhân cần cấp cứu:</span>
                <span className="font-extrabold text-amber-300 bg-amber-500/10 px-2.5 py-0.5 rounded-lg border border-amber-500/30">
                  {petEmergencyTitle}
                </span>
              </div>
            </div>
          </div>

          {/* Nút đóng modal (X) */}
          <button
            onClick={() => {
              try { sound.playClick(); } catch (_) {}
              onClose();
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
            aria-label="Đóng cửa sổ cấp cứu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ---------------------------------------------------- */}
        {/* TOAST THÔNG BÁO NỔI BẬT                             */}
        {/* ---------------------------------------------------- */}
        {toastMessage && (
          <div className="mx-6 mt-4 p-4 rounded-2xl bg-red-600/90 border border-red-400 text-white shadow-xl flex items-center gap-3 animate-in slide-in-from-top-2 duration-300">
            <CheckCircle2 className="w-6 h-6 text-white shrink-0 animate-bounce" />
            <p className="text-xs sm:text-sm font-black leading-relaxed">
              {toastMessage}
            </p>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* BODY NỘI DUNG CUỘN ĐƯỢC                              */}
        {/* ---------------------------------------------------- */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">

          {/* ================================================== */}
          {/* 2. KHỐI HÀNH ĐỘNG KHẨN CẤP (PHẦN QUAN TRỌNG NHẤT)   */}
          {/* ================================================== */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-red-400 flex items-center gap-2">
              <Radio className="w-4 h-4 animate-ping text-red-500" />
              <span>Hành Động Khẩn Cấp Ngay Lập Tức</span>
            </h3>

            {/* 1. Nút gọi điện khẩn cấp 1-chạm (Bấm là gọi ngay) */}
            <a 
              href="tel:0983358126"
              className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2.5 shadow-[0_0_30px_rgba(239,68,68,0.5)] border border-red-400/60 transition-all transform active:scale-98 text-sm sm:text-base text-center cursor-pointer"
            >
              <PhoneCall className="w-5 h-5 fill-current animate-bounce shrink-0" />
              <span>📞 GỌI XE CẤP CỨU NGAY (098 335 8126 - 2Vet)</span>
            </a>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 2. Nút Chỉ đường cấp cứu gần nhất */}
              <a 
                href="https://maps.google.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 border border-slate-700 hover:border-slate-500 transition-all text-xs sm:text-sm text-center shadow-md cursor-pointer"
              >
                <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>📍 Bệnh viện 2Vet: 335 Kim Ngưu, Hai Bà Trưng</span>
              </a>

              {/* 3. Nút Phát Tín Hiệu Báo Động Đỏ Tới Phòng Khám */}
              <button
                type="button"
                onClick={handleTriggerEmergencyTriage}
                disabled={isSendingAlert || hasSentAlert}
                className={`w-full py-3.5 px-4 rounded-2xl font-black flex items-center justify-center gap-2 transition-all text-xs sm:text-sm border shadow-lg cursor-pointer ${
                  hasSentAlert
                    ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300 cursor-default'
                    : 'bg-gradient-to-r from-red-700 via-rose-600 to-amber-600 hover:from-red-600 hover:to-amber-500 text-white border-red-400/80 shadow-[0_0_25px_rgba(225,29,72,0.4)] active:scale-98'
                }`}
              >
                {hasSentAlert ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>✓ ĐÃ BÁO ĐỘNG ĐỎ CHO BÁC SĨ TRỰC</span>
                  </>
                ) : isSendingAlert ? (
                  <>
                    <Send className="w-4 h-4 animate-spin" />
                    <span>Đang phát tín hiệu khẩn...</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-300 animate-pulse" />
                    <span>🚨 Gửi Tín Hiệu Cấp Cứu Tới Bác Sĩ Trực</span>
                  </>
                )}
              </button>
            </div>
            
            <p className="text-[11px] text-slate-400 text-center italic">
              * Tín hiệu báo động đỏ sẽ ưu tiên đẩy ca của {petName} lên vị trí khẩn cấp số 1 trên màn hình tiếp đón của phòng khám.
            </p>
          </div>

          {/* ================================================== */}
          {/* 3. TAB HƯỚNG DẪN SƠ CỨU NHANH TẠI NHÀ             */}
          {/* ================================================== */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <HeartPulse className="w-4 h-4 text-rose-400" />
                  <span>Hướng Dẫn Sơ Cứu Nhanh Tại Nhà</span>
                </h3>
                <p className="text-xs text-slate-400">Các bước xử lý khẩn cấp trong thời gian chờ xe cấp cứu hoặc di chuyển tới viện</p>
              </div>

              {/* Bộ lọc tab sơ cứu nhanh */}
              <div className="hidden sm:flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-white/10 text-xs">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    activeTab === 'all' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Tất cả (4)
                </button>
                <button
                  onClick={() => setActiveTab('choking')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    activeTab === 'choking' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Sặc dị vật
                </button>
                <button
                  onClick={() => setActiveTab('poison')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    activeTab === 'poison' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Ngộ độc
                </button>
              </div>
            </div>

            {/* 4 Thẻ hướng dẫn sơ cứu */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {firstAidGuides
                .filter(guide => activeTab === 'all' || activeTab === guide.id)
                .map((guide) => {
                  const GuideIcon = guide.icon;
                  return (
                    <div 
                      key={guide.id}
                      className="p-4 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-850/80 border border-white/10 hover:border-red-500/40 transition-all flex flex-col justify-between space-y-3 shadow-md"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${guide.color} bg-white/5`}>
                              <GuideIcon className="w-5 h-5" />
                            </div>
                            <h4 className="text-sm font-black text-white">{guide.title}</h4>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${guide.badgeColor}`}>
                            {guide.badge}
                          </span>
                        </div>

                        {/* Điểm nhấn hướng dẫn theo yêu cầu nghiệp vụ */}
                        <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 text-xs text-amber-200 font-semibold leading-relaxed">
                          ⚠️ {guide.summary}
                        </div>

                        {/* Chi tiết từng bước sơ cứu */}
                        <ul className="space-y-1.5 pt-1">
                          {guide.steps.map((step, idx) => (
                            <li key={idx} className="text-xs text-slate-300 leading-relaxed flex items-start gap-2">
                              <span className="w-4 h-4 rounded-full bg-white/10 text-cyan-300 font-mono text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                                {idx + 1}
                              </span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

        </div>

        {/* ---------------------------------------------------- */}
        {/* FOOTER MODAL                                         */}
        {/* ---------------------------------------------------- */}
        <div className="p-4 bg-slate-950/60 border-t border-white/10 flex items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Đường dây nóng cấp cứu sẵn sàng 24/7/365</span>
          </div>

          <button
            onClick={() => {
              try { sound.playClick(); } catch (_) {}
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-colors cursor-pointer text-xs"
          >
            Đóng cửa sổ
          </button>
        </div>

      </div>
    </div>
  );
};

export default EmergencyModal;
