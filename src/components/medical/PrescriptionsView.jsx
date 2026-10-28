import React, { useState } from 'react';
import { getTodayVnDate, getVnDateString, addDaysLocal } from '../../utils/dateUtils.js';
import { 
  Pill, 
  Plus, 
  Trash2, 
  Clock, 
  CheckCircle2, 
  Calendar, 
  UserCheck,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

export const PrescriptionsView = ({
  prescriptions = [],
  pets = [],
  onAddPrescription,
  onDeletePrescription,
  selectedPetId: propSelectedPetId = null,
  onSelectPet = null
}) => {
  const [selectedPetId, setSelectedPetId] = useState(() => {
    if (propSelectedPetId && propSelectedPetId !== 'all' && pets.some(p => p.id === propSelectedPetId)) {
      return propSelectedPetId;
    }
    try {
      const saved = localStorage.getItem('petcare_selected_pet_id');
      if (saved && (saved === 'all' || pets.some(p => p.id === saved))) return saved;
    } catch {}
    return pets[0]?.id || 'all';
  });

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Đồng bộ hai chiều với prop từ tầng App / Navbar
  React.useEffect(() => {
    if (propSelectedPetId && propSelectedPetId !== selectedPetId) {
      if (propSelectedPetId === 'all' || pets.some(p => p.id === propSelectedPetId)) {
        setSelectedPetId(propSelectedPetId);
      }
    }
  }, [propSelectedPetId, pets, selectedPetId]);

  const [formData, setFormData] = useState({
    petId: pets[0]?.id || '',
    medicineName: '',
    dosage: '',
    startDate: getTodayVnDate(),
    durationDays: 7,
    prescribedBy: '',
    purpose: '',
    notes: ''
  });

  const handleSelectPetChange = (newPetId) => {
    setSelectedPetId(newPetId);
    try {
      localStorage.setItem('petcare_selected_pet_id', newPetId);
    } catch {}
    if (onSelectPet) {
      onSelectPet(newPetId);
    }
  };

  const filtered = prescriptions.filter(p => {
    if (!p) return false;
    if (selectedPetId === 'all') return true;
    return String(p.petId || '').trim() === String(selectedPetId).trim();
  });

  const handleSave = (e) => {
    e.preventDefault();
    if (!formData.medicineName.trim()) return;

    onAddPrescription(formData);
    setFormData({
      petId: pets[0]?.id || '',
      medicineName: '',
      dosage: '',
      startDate: getTodayVnDate(),
      durationDays: 7,
      prescribedBy: '',
      purpose: '',
      notes: ''
    });
    setIsAddModalOpen(false);
  };

  // Tính số ngày còn lại theo chuẩn Asia/Ho_Chi_Minh
  const calculateDaysRemaining = (startDateStr, durationDays) => {
    const startStr = getVnDateString(startDateStr);
    const endStr = addDaysLocal(startStr, Number(durationDays) || 7);
    const todayStr = getTodayVnDate();
    const [ey, em, ed] = endStr.split('-').map(Number);
    const [ty, tm, td] = todayStr.split('-').map(Number);
    const endUtc = Date.UTC(ey, em - 1, ed);
    const todayUtc = Date.UTC(ty, tm - 1, td);
    return Math.round((endUtc - todayUtc) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Pill className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            Quản Lý Đơn Thuốc & Liệu Trình Điều Trị
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Theo dõi liều lượng, giờ uống thuốc và đếm ngược số ngày điều trị cho thú cưng.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <select
            value={selectedPetId}
            onChange={(e) => handleSelectPetChange(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 rounded-xl outline-hidden shadow-xs"
          >
            <option value="all">Tất cả thú cưng</option>
            {pets.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.breed})</option>
            ))}
          </select>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" /> Thêm Đơn Thuốc
          </button>
        </div>
      </div>

      {/* Prescriptions List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700">
            <Pill className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Không có đơn thuốc nào đang điều trị</h4>
            <p className="text-xs text-slate-400 mt-1">Các bé cưng hiện đang khỏe mạnh hoặc chưa có toa thuốc mới.</p>
          </div>
        ) : (
          filtered.map((pres) => {
            const pet = pets.find(p => p.id === pres.petId);
            const daysLeft = calculateDaysRemaining(pres.startDate, pres.durationDays);
            const isFinished = daysLeft <= 0;
            const progressPercent = Math.min(100, Math.max(0, Math.round(((pres.durationDays - Math.max(0, daysLeft)) / pres.durationDays) * 100)));

            return (
              <div 
                key={pres.id}
                className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-700 shadow-xs flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400">
                        {pet ? pet.name : 'Thú cưng'}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                        {pres.title || pres.medicineName || 'Đơn thuốc điều trị'}
                      </h3>
                    </div>

                    {!pres.isFinal ? (
                      <button
                        onClick={() => onDeletePrescription(pres.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                        title="Xóa đơn thuốc"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                        ✓ Đã ký chốt
                      </span>
                    )}
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-700/50 space-y-1 text-xs mb-3">
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Liều dùng:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{pres.dosage}</span>
                    </div>
                    {pres.purpose && (
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Công dụng:</span>
                        <span className="text-slate-700 dark:text-slate-300 font-medium">{pres.purpose}</span>
                      </div>
                    )}
                    {pres.prescribedBy && (
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Bác sĩ kê đơn:</span>
                        <span className="text-slate-700 dark:text-slate-300">{pres.prescribedBy}</span>
                      </div>
                    )}
                  </div>

                  {pres.notes && (
                    <p className="text-xs text-slate-500 italic bg-amber-50 dark:bg-amber-950/30 p-2 rounded-xl border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200">
                      💡 {pres.notes}
                    </p>
                  )}
                </div>

                {/* Progress Bar & Countdown */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-500">Tiến độ liệu trình:</span>
                    <span className={isFinished ? 'text-emerald-600' : 'text-amber-600'}>
                      {isFinished ? 'Đã hoàn thành đợt thuốc' : `Còn lại ${daysLeft} ngày`}
                    </span>
                  </div>

                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      style={{ width: `${progressPercent}%` }}
                      className={`h-full rounded-full transition-all ${
                        isFinished ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-500 to-emerald-500'
                      }`}
                    />
                  </div>
                </div>

              </div>
            );
          })
        )}
      </div>

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-700">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
              Thêm Đơn Thuốc Điều Trị Mới
            </h3>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Thú cưng *:</label>
                <select
                  value={formData.petId}
                  onChange={(e) => setFormData({ ...formData, petId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-hidden"
                >
                  {pets.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.breed})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Tên thuốc *:</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Kháng sinh Clavamox, Men Biotic..."
                  value={formData.medicineName}
                  onChange={(e) => setFormData({ ...formData, medicineName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Liều dùng & Tần suất *:</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: 1 viên/ngày chia 2 lần sau ăn..."
                  value={formData.dosage}
                  onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Ngày bắt đầu:</label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Số ngày uống (ngày):</label>
                  <input
                    type="number"
                    required
                    value={formData.durationDays}
                    onChange={(e) => setFormData({ ...formData, durationDays: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Bác sĩ / Phòng khám kê:</label>
                <input
                  type="text"
                  placeholder="Ví dụ: BS. Nguyễn Văn A - BV 2Vet"
                  value={formData.prescribedBy}
                  onChange={(e) => setFormData({ ...formData, prescribedBy: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Dặn dò bổ sung:</label>
                <input
                  type="text"
                  placeholder="Trộn vào pate ấm, tránh cho uống cùng sữa..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl shadow-xs"
                >
                  Lưu Đơn Thuốc
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
