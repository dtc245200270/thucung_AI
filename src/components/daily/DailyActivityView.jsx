import React, { useState } from 'react';
import { 
  Activity, 
  Plus, 
  Smile, 
  Meh, 
  Frown, 
  Footprints, 
  Droplet, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  HeartPulse,
  Calendar,
  ShieldAlert
} from 'lucide-react';
import { analyzeDailyHealthTrend } from '../../services/aiService';
import { getTodayVnDate } from '../../utils/dateUtils';

export const DailyActivityView = ({
  dailyLogs = [],
  pets = [],
  onAddDailyLog
}) => {
  const [selectedPetId, setSelectedPetId] = useState(pets[0]?.id || '');
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    petId: pets[0]?.id || '',
    date: getTodayVnDate(),
    poopStatus: 'normal',
    peeStatus: 'normal',
    walkMinutes: 30,
    mealStatus: 'good',
    mood: 'happy',
    notes: ''
  });

  const selectedPet = pets.find(p => p.id === selectedPetId) || pets[0];
  const petLogs = dailyLogs.filter(l => l.petId === selectedPetId);

  const aiTrend = analyzeDailyHealthTrend(petLogs, selectedPet);

  const handleSave = (e) => {
    e.preventDefault();
    onAddDailyLog({
      ...formData,
      petId: selectedPetId,
      walkMinutes: Number(formData.walkMinutes) || 0
    });
    setIsLogModalOpen(false);
  };

  const POOP_MAP = {
    normal: { label: 'Khuôn bình thường', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
    soft: { label: 'Phân mềm', color: 'bg-amber-50 text-amber-800 border-amber-200' },
    diarrhea: { label: 'Tiêu chảy / Lỏng', color: 'bg-rose-100 text-rose-800 border-rose-300 font-bold' },
    constipated: { label: 'Táo bón / Khó đi', color: 'bg-orange-50 text-orange-800 border-orange-200' }
  };

  const PEE_MAP = {
    normal: { label: 'Vàng nhạt bình thường', color: 'bg-emerald-50 text-emerald-800' },
    dark: { label: 'Sẫm màu / Nước ít', color: 'bg-amber-100 text-amber-800 font-bold' },
    painful: { label: 'Rặn khó / Lẫn máu', color: 'bg-rose-100 text-rose-800 font-black animate-pulse' }
  };

  const MOOD_MAP = {
    happy: { label: 'Vui vẻ / Năng động', icon: '😄' },
    calm: { label: 'Thư thái / Bình thường', icon: '😌' },
    anxious: { label: 'Bồn chồn / Lo âu', icon: '😟' },
    lethargic: { label: 'Lừ đừ / Mệt mỏi', icon: '🤒' }
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <HeartPulse className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            Nhật Ký Sinh Hoạt & Theo Dõi Sức Khỏe Hàng Ngày
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Ghi nhận thói quen vệ sinh, vận động, ăn uống để AI phát hiện sớm các nguy cơ sỏi tiết niệu và tiêu hóa.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {/* Select Pet */}
          <select
            value={selectedPetId}
            onChange={(e) => setSelectedPetId(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 rounded-xl outline-hidden shadow-xs"
          >
            {pets.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.breed})</option>
            ))}
          </select>

          <button
            onClick={() => setIsLogModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" /> Ghi Nhật Ký Hôm Nay
          </button>
        </div>
      </div>

      {/* AI Health Trend Alert Box */}
      {aiTrend && (
        <div className={`p-5 rounded-3xl border shadow-md flex items-start gap-4 ${
          aiTrend.status === 'CRITICAL'
            ? 'bg-rose-50 border-rose-300 text-rose-950'
            : aiTrend.status === 'WARNING'
            ? 'bg-amber-50 border-amber-300 text-amber-950'
            : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
        }`}>
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
            aiTrend.status === 'CRITICAL'
              ? 'bg-rose-600 text-white'
              : aiTrend.status === 'WARNING'
              ? 'bg-amber-500 text-white'
              : 'bg-emerald-600 text-white'
          }`}>
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold uppercase tracking-wider mb-1">
              {aiTrend.title || 'AI Đánh Giá Sức Khỏe Sinh Hoạt'}
            </h3>
            <p className="text-xs leading-relaxed">
              {aiTrend.message}
            </p>
          </div>
        </div>
      )}

      {/* Logs Timeline */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          Lịch Sử Theo Dõi Của {selectedPet ? selectedPet.name : 'Bé'} ({petLogs.length})
        </h3>

        {petLogs.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700">
            <Activity className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Chưa có nhật ký nào cho bé này</h4>
            <p className="text-xs text-slate-400 mt-1">Bấm nút "Ghi Nhật Ký Hôm Nay" để theo dõi phân, nước tiểu và vận động.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {petLogs.map((log) => {
              const poop = POOP_MAP[log.poopStatus] || POOP_MAP.normal;
              const pee = PEE_MAP[log.peeStatus] || PEE_MAP.normal;
              const mood = MOOD_MAP[log.mood] || MOOD_MAP.happy;

              return (
                <div 
                  key={log.id} 
                  className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600" /> Ngày: {log.date}
                    </span>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700">
                      {mood.icon} {mood.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/50 space-y-1">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Vệ sinh Phân</span>
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold border ${poop.color}`}>
                        {poop.label}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/50 space-y-1">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Nước tiểu</span>
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${pee.color}`}>
                        {pee.label}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 pt-1">
                    <div className="flex items-center gap-1.5">
                      <Footprints className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Vận động: <strong>{log.walkMinutes} phút</strong></span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span>Bữa ăn: <strong>{log.mealStatus === 'good' ? 'Ăn ngon miệng' : log.mealStatus === 'picky' ? 'Kén ăn' : 'Bỏ ăn'}</strong></span>
                    </div>
                  </div>

                  {log.notes && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-700/40 p-2.5 rounded-xl">
                      "{log.notes}"
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Add Daily Log */}
      {isLogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-700">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
              Ghi Nhật Ký Sinh Hoạt Cho {selectedPet ? selectedPet.name : 'Bé'}
            </h3>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Ngày ghi:</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Tình trạng Phân:</label>
                <select
                  value={formData.poopStatus}
                  onChange={(e) => setFormData({ ...formData, poopStatus: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-hidden"
                >
                  <option value="normal">Khuôn mềm đẹp, màu nâu bình thường</option>
                  <option value="soft">Phân mềm hơi nhão</option>
                  <option value="diarrhea">Tiêu chảy lỏng / Mùi tanh khắm</option>
                  <option value="constipated">Táo bón khô cứng / Rặn khó</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Tình trạng Nước tiểu:</label>
                <select
                  value={formData.peeStatus}
                  onChange={(e) => setFormData({ ...formData, peeStatus: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-hidden"
                >
                  <option value="normal">Vàng nhạt trong suốt, tiểu êm</option>
                  <option value="dark">Vàng đậm / Màu nâu sẫm</option>
                  <option value="painful">Rặn kêu đau / Tiểu rắt nhiều lần / Có máu</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Thời gian dạo (phút):</label>
                  <input
                    type="number"
                    value={formData.walkMinutes}
                    onChange={(e) => setFormData({ ...formData, walkMinutes: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Khẩu phần ăn:</label>
                  <select
                    value={formData.mealStatus}
                    onChange={(e) => setFormData({ ...formData, mealStatus: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-hidden"
                  >
                    <option value="good">Ăn hết sạch</option>
                    <option value="picky">Kén ăn / Bỏ thừa</option>
                    <option value="refused">Bỏ ăn hoàn toàn</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Tâm trạng & Tinh thần:</label>
                <select
                  value={formData.mood}
                  onChange={(e) => setFormData({ ...formData, mood: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-hidden"
                >
                  <option value="happy">😄 Vui vẻ / Đùa giỡn tích cực</option>
                  <option value="calm">😌 Ngoan ngoãn / Thư thái</option>
                  <option value="anxious">😟 Bồn chồn / Hay giật mình sợ hãi</option>
                  <option value="lethargic">🤒 Lừ đừ / Nằm yên một chỗ</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Ghi chú thêm:</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Hôm nay bé đi dạo công viên, ăn pate cá hồi..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsLogModalOpen(false)}
                  className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl shadow-xs"
                >
                  Lưu Nhật Ký
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
