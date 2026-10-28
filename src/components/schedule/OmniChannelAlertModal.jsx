import React, { useState } from 'react';
import { 
  X, Bell, Send, CheckCircle, Clock, Calendar, 
  Smartphone, MessageSquare, Download, Sparkles, Check, AlertTriangle 
} from 'lucide-react';
import { sound } from '../../services/soundService';
import { generateIcsCalendar, getTodayVnDate } from '../../utils/dateUtils.js';

export default function OmniChannelAlertModal({ isOpen, onClose, schedules = [], onActionConfirm }) {
  const [activeChannel, setActiveChannel] = useState('telegram'); // 'telegram', 'zalo', 'webpush'
  const [telegramChatId, setTelegramChatId] = useState('@my_petcare_family');
  const [zaloPhone, setZaloPhone] = useState('0912345678');
  const [webPushEnabled, setWebPushEnabled] = useState(true);
  const [isSimulatingAlert, setIsSimulatingAlert] = useState(false);
  const [simulatedStatus, setSimulatedStatus] = useState(null); // 'done', 'snoozed', null

  if (!isOpen) return null;

  // Lịch hẹn mẫu sắp tới để gửi test
  const sampleSchedule = schedules[0] || null;

  const handleDownloadICS = () => {
    sound.playSuccess();
    // Generate valid iCalendar (.ics) format khóa múi giờ Asia/Ho_Chi_Minh
    const icsContent = generateIcsCalendar(schedules, []);

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `petcare-schedules-${getTodayVnDate()}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleTriggerSimulatedAlert = () => {
    sound.playClick();
    setIsSimulatingAlert(true);
    setSimulatedStatus(null);
  };

  const handleAlertAction = (action) => {
    if (action === 'done') {
      sound.playSuccess();
      setSimulatedStatus('done');
      if (onActionConfirm) onActionConfirm(sampleSchedule.id, 'done');
    } else if (action === 'snooze') {
      sound.playClick();
      setSimulatedStatus('snoozed');
      if (onActionConfirm) onActionConfirm(sampleSchedule.id, 'snooze');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Đồng bộ Lịch & Thông báo Đa kênh
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Google Calendar, Apple iCal, Telegram Bot & Zalo ZNS
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

        {/* Modal Content */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          
          {/* Calendar Sync Section */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200/60 dark:border-blue-900/40">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 font-bold text-sm text-blue-950 dark:text-blue-200">
                  <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Xuất lịch chuẩn iCalendar (.ics)</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Đồng bộ tức thì với Google Calendar, Apple Calendar, Outlook trên điện thoại và máy tính.
                </p>
              </div>
              <button
                onClick={handleDownloadICS}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20 active:scale-95 transition-all flex-shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>Tải tệp .ics</span>
              </button>
            </div>
          </div>

          {/* Notification Channels Configuration */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
              Kênh nhận thông báo đẩy tức thì
            </label>

            {/* Channel Tabs */}
            <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800">
              <button
                onClick={() => setActiveChannel('telegram')}
                className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl transition-all ${
                  activeChannel === 'telegram'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Send className="w-3.5 h-3.5 text-sky-500" />
                <span>Telegram Bot</span>
              </button>

              <button
                onClick={() => setActiveChannel('zalo')}
                className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl transition-all ${
                  activeChannel === 'zalo'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                <span>Zalo ZNS</span>
              </button>

              <button
                onClick={() => setActiveChannel('webpush')}
                className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl transition-all ${
                  activeChannel === 'webpush'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5 text-emerald-500" />
                <span>Web Push</span>
              </button>
            </div>

            {/* Channel Body */}
            <div className="mt-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40">
              {activeChannel === 'telegram' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Telegram Chat / Group ID:</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">Đã kết nối</span>
                  </div>
                  <input
                    type="text"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                    placeholder="@channel_or_chat_id"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Bot sẽ gửi tin nhắn kèm 2 nút bấm tương tác: <strong>[Đã cho uống]</strong> và <strong>[Hoãn 1 tiếng]</strong>.
                  </p>
                </div>
              )}

              {activeChannel === 'zalo' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Số điện thoại Zalo nhận tin (ZNS):</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">Xác thực OTP</span>
                  </div>
                  <input
                    type="tel"
                    value={zaloPhone}
                    onChange={(e) => setZaloPhone(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                    placeholder="09..."
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Gửi thông báo CSKH Zalo Official Account tự động vào tin nhắn Zalo của chủ nuôi và gia đình.
                  </p>
                </div>
              )}

              {activeChannel === 'webpush' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Thông báo trình duyệt (Browser Push)</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">Hoạt động ngay cả khi tắt tab ứng dụng</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={webPushEnabled}
                        onChange={(e) => setWebPushEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Interactive Simulation Preview */}
          <div className="p-4 rounded-2xl bg-slate-900 text-white shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Mô phỏng Thông báo Đẩy Tương tác (Interactive Push)</span>
              </div>
              <button
                onClick={handleTriggerSimulatedAlert}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
              >
                Gửi tin thử nghiệm
              </button>
            </div>

            {/* Notification Card */}
            <div className="mt-3 p-3.5 rounded-xl bg-slate-800/90 border border-slate-700 text-xs space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span className="flex items-center gap-1 font-semibold text-indigo-400">
                  <Bell className="w-3 h-3" /> PetCare AI Assistant
                </span>
                <span>Vừa xong</span>
              </div>
              
              {sampleSchedule ? (
                <>
                  <div className="font-bold text-white text-sm">
                    🚨 Đến giờ: {sampleSchedule.title}
                  </div>
                  <p className="text-slate-300 text-xs">
                    Bé <strong>{sampleSchedule.petName || 'Thú cưng'}</strong> cần dùng thuốc/tiêm chủng đúng giờ theo phác đồ thú y.
                  </p>
                </>
              ) : (
                <div className="font-bold text-slate-400 text-sm italic">
                  Chưa có lịch trình nhắc nhở nào.
                </div>
              )}

              {/* Status after action */}
              {simulatedStatus === 'done' && (
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 font-semibold text-center text-xs flex items-center justify-center gap-1.5 animate-in zoom-in-95">
                  <CheckCircle className="w-4 h-4" />
                  Đã ghi nhận! Thói quen đã đánh dấu hoàn thành & cập nhật chuỗi Streak.
                </div>
              )}

              {simulatedStatus === 'snoozed' && sampleSchedule && (
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 font-semibold text-center text-xs flex items-center justify-center gap-1.5 animate-in zoom-in-95">
                  <Clock className="w-4 h-4" />
                  Đã hoãn lại 1 tiếng! Hệ thống sẽ re-alert lúc {(parseInt(sampleSchedule.time || '09') + 1)}:00.
                </div>
              )}

              {/* Action Buttons */}
              {!simulatedStatus && (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={() => handleAlertAction('done')}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all active:scale-95"
                  >
                    <Check className="w-3.5 h-3.5" />
                    [Đã cho uống]
                  </button>
                  <button
                    onClick={() => handleAlertAction('snooze')}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-amber-300 font-semibold text-xs transition-all active:scale-95"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    [Hoãn 1 tiếng]
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-500/20 transition-all"
          >
            Lưu cài đặt kênh
          </button>
        </div>

      </div>
    </div>
  );
}
