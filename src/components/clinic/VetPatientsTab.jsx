import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  PawPrint, 
  User, 
  Phone, 
  Calendar, 
  FileText, 
  ChevronRight, 
  Clock, 
  Stethoscope, 
  HeartPulse, 
  AlertCircle,
  Activity,
  Plus,
  Eye,
  Lock,
  ShieldCheck,
  CheckCircle2,
  Pill,
  X
} from 'lucide-react';
import { getMedicalRecords } from '../../services/storageService';
import { apiFetch } from '../../services/apiService';
import { MedicalRecordDetailModal } from './MedicalRecordDetailModal';

export const VetPatientsTab = ({
  pets = [],
  appointments = [],
  currentUser,
  onOpenSoap
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPetId, setSelectedPetId] = useState(null);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [selectedRecordForDetail, setSelectedRecordForDetail] = useState(null);

  // Lấy danh sách bệnh án thật từ backend / cache
  useEffect(() => {
    let isMounted = true;
    const fetchRecords = async () => {
      setIsLoadingRecords(true);
      try {
        // 1. Đọc ngay từ cache cục bộ (nếu có) để UI hiển thị nhanh
        const cached = getMedicalRecords(currentUser?.id, currentUser?.role);
        if (isMounted && Array.isArray(cached) && cached.length > 0) {
          setMedicalRecords(cached);
        }

        // 2. Fetch trực tiếp từ API backend để luôn nhận dữ liệu đầy đủ, mới nhất
        const fresh = await apiFetch('/medical_records');
        if (isMounted && Array.isArray(fresh)) {
          try {
            localStorage.setItem('petcare_medical_records_v1', JSON.stringify(fresh));
          } catch {}
          setMedicalRecords(fresh);
        }
      } catch (err) {
        console.error('Lỗi tải bệnh án:', err);
      } finally {
        if (isMounted) setIsLoadingRecords(false);
      }
    };

    fetchRecords();

    const handleUpdate = () => {
      fetchRecords();
    };
    window.addEventListener('petcare_medical_records_updated', handleUpdate);
    window.addEventListener('petcare_data_synced', handleUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener('petcare_medical_records_updated', handleUpdate);
      window.removeEventListener('petcare_data_synced', handleUpdate);
    };
  }, [currentUser]);

  // Danh sách thú cưng liên quan đến bác sĩ:
  // Thú cưng có lịch hẹn phân công cho bác sĩ hoặc có bệnh án do bác sĩ lập
  const doctorPets = useMemo(() => {
    const doctorAppPetIds = new Set(
      appointments
        .filter(a => a.assignedVetId === currentUser?.id || a.vetId === currentUser?.id)
        .map(a => a.petId)
        .filter(Boolean)
    );
    const doctorRecordPetIds = new Set(
      medicalRecords
        .filter(r => r.vetId === currentUser?.id || r.authorId === currentUser?.id)
        .map(r => r.petId)
        .filter(Boolean)
    );

    // Lọc từ danh sách pets thật
    let relevantPets = pets.filter(p => doctorAppPetIds.has(p.id) || doctorRecordPetIds.has(p.id));

    // Nếu bác sĩ chưa có ca khám hoặc là Admin/Bác sĩ xem chung, hiển thị các pet có trong lịch khám
    if (relevantPets.length === 0 && currentUser?.role === 'system_admin') {
      relevantPets = pets;
    }

    if (!searchQuery.trim()) return relevantPets;

    const q = searchQuery.toLowerCase().trim();
    return relevantPets.filter(p => {
      const name = String(p.name || '').toLowerCase();
      const breed = String(p.breed || '').toLowerCase();
      const ownerName = String(p.ownerName || '').toLowerCase();
      const id = String(p.id || '').toLowerCase();
      return name.includes(q) || breed.includes(q) || ownerName.includes(q) || id.includes(q);
    });
  }, [pets, appointments, medicalRecords, currentUser, searchQuery]);

  // Thiết lập thú cưng được chọn mặc định
  useEffect(() => {
    if (!selectedPetId && doctorPets.length > 0) {
      setSelectedPetId(doctorPets[0].id);
    }
  }, [doctorPets, selectedPetId]);

  const selectedPet = useMemo(() => {
    return pets.find(p => p.id === selectedPetId) || null;
  }, [pets, selectedPetId]);

  // Lịch sử khám của thú cưng đang chọn
  const petAppointments = useMemo(() => {
    if (!selectedPetId) return [];
    return appointments
      .filter(a => a.petId === selectedPetId)
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [appointments, selectedPetId]);

  // Bệnh án của thú cưng đang chọn
  const petRecords = useMemo(() => {
    if (!selectedPetId) return [];
    return medicalRecords
      .filter(r => r.petId === selectedPetId)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [medicalRecords, selectedPetId]);

  // Tính tuổi thật không giả định
  const calculateAge = (birthDate) => {
    if (!birthDate) return 'Chưa cập nhật';
    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) return 'Chưa cập nhật';
    const now = new Date();
    const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
    if (months < 1) return 'Dưới 1 tháng';
    if (months < 12) return `${months} tháng tuổi`;
    const years = Math.floor(months / 12);
    const remMonths = months % 12;
    return remMonths > 0 ? `${years} tuổi ${remMonths} tháng` : `${years} tuổi`;
  };

  return (
    <div className="h-full flex flex-col md:flex-row gap-6 p-4 md:p-6 overflow-hidden">
      {/* CỘT TRÁI: DANH SÁCH BỆNH NHÂN */}
      <div className="w-full md:w-80 lg:w-96 flex flex-col flex-shrink-0 bg-white dark:bg-[#151622] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Header & Tìm kiếm */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <PawPrint className="w-5 h-5 text-indigo-500" />
              Hồ sơ bệnh nhân
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50">
              {doctorPets.length} bệnh nhân
            </span>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên bé, giống loài..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Danh sách cuộn */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-2 space-y-1">
          {doctorPets.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <PawPrint className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {searchQuery ? 'Không tìm thấy bệnh nhân phù hợp.' : 'Chưa có bệnh nhân nào được phân công cho bác sĩ.'}
              </p>
            </div>
          ) : (
            doctorPets.map(pet => {
              const isSelected = pet.id === selectedPetId;
              return (
                <button
                  key={pet.id}
                  onClick={() => setSelectedPetId(pet.id)}
                  className={`w-full text-left p-3 rounded-xl transition-all flex items-center gap-3 cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 shadow-sm'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 border border-transparent'
                  }`}
                >
                  <div className="w-11 h-11 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 border border-slate-200 dark:border-slate-700">
                    {pet.avatar ? (
                      <img src={pet.avatar} alt={pet.name} className="w-full h-full object-cover" />
                    ) : (
                      <PawPrint className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className={`text-xs font-bold truncate ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-white'}`}>
                        {pet.name}
                      </h3>
                      <span className="text-[10px] text-slate-400 capitalize">
                        {pet.species || pet.type || 'Chưa rõ'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {pet.breed || 'Chưa cập nhật giống'}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                      <span>{pet.weight ? `${pet.weight} kg` : 'Chưa cân'}</span>
                      <span>•</span>
                      <span>{calculateAge(pet.birthDate)}</span>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 ${isSelected ? 'text-indigo-500' : 'text-slate-300 dark:text-slate-600'}`} />
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* CỘT PHẢI: CHI TIẾT BỆNH NHÂN & LỊCH SỬ LÂM SÀNG */}
      <div className="flex-1 flex flex-col bg-white dark:bg-[#151622] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {selectedPet ? (
          <div className="flex-1 flex flex-col overflow-y-auto">
            {/* Header thông tin thú cưng */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-200 dark:bg-slate-800 flex items-center justify-center border-2 border-white dark:border-slate-700 shadow-sm">
                    {selectedPet.avatar ? (
                      <img src={selectedPet.avatar} alt={selectedPet.name} className="w-full h-full object-cover" />
                    ) : (
                      <PawPrint className="w-8 h-8 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                        {selectedPet.name}
                      </h1>
                      <span className="text-xs px-2 py-0.5 rounded-md font-medium bg-slate-200/60 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {selectedPet.gender === 'male' || selectedPet.gender === 'Đực' ? '♂ Đực' : selectedPet.gender === 'female' || selectedPet.gender === 'Cái' ? '♀ Cái' : 'Chưa rõ giới tính'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {selectedPet.breed || 'Chưa cập nhật giống'} • {selectedPet.species || selectedPet.type || 'Thú cưng'}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-600 dark:text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Tuổi: {calculateAge(selectedPet.birthDate)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-slate-400" />
                        Cân nặng: {selectedPet.weight ? `${selectedPet.weight} kg` : 'Chưa cập nhật'}
                      </span>
                      {selectedPet.microchip && (
                        <span className="flex items-center gap-1.5 font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                          Chip: {selectedPet.microchip}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Nút hành động */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (onOpenSoap) {
                        const activeApp = petAppointments.find(a => a.status === 'in_progress' || a.status === 'confirmed') || petAppointments[0];
                        onOpenSoap(activeApp?.id, selectedPet.id);
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <Stethoscope className="w-4 h-4" />
                    Khám SOAP cho bé
                  </button>
                </div>
              </div>

              {/* Thông tin chủ nuôi */}
              {(() => {
                const latestAppt = petAppointments[0] || null;
                const accountOwnerName = selectedPet.ownerName || latestAppt?.ownerName || 'Chưa cập nhật';
                const accountPhone = selectedPet.ownerPhone || 'Chưa đăng ký SĐT tài khoản';
                const apptPhone = latestAppt?.phone ? `${latestAppt.phone} (${latestAppt.id})` : 'Chưa có SĐT ca khám';

                return (
                  <div className="mt-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                      <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] text-slate-400 block">Chủ tài khoản:</span>
                        <span className="font-semibold truncate block">{accountOwnerName}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                      <Phone className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] text-slate-400 block">SĐT tài khoản:</span>
                        <span className="font-semibold truncate block">{accountPhone}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                      <Phone className="w-4 h-4 text-sky-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] text-slate-400 block">SĐT liên hệ ca khám:</span>
                        <span className="font-semibold truncate block">{apptPhone}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                      <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] text-slate-400 block">Mã thú cưng:</span>
                        <span className="font-mono text-[11px] truncate block">{selectedPet.id}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Nội dung chi tiết: Bệnh án & Lịch khám */}
            <div className="p-6 space-y-6">
              {/* PHẦN 1: BỆNH ÁN LÂM SÀNG (MEDICAL RECORDS) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    Lịch sử Bệnh án lâm sàng ({petRecords.length})
                  </h3>
                </div>

                {isLoadingRecords ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    Đang tải dữ liệu bệnh án...
                  </div>
                ) : petRecords.length === 0 ? (
                  <div className="p-6 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Chưa có bệnh án lâm sàng nào được tạo cho thú cưng này.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {petRecords.map(rec => (
                      <div
                        key={rec.id}
                        data-appointment-id={rec.appointmentId}
                        data-record-id={rec.id}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              rec.isFinal || rec.status === 'published'
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                            }`}>
                              {rec.isFinal || rec.status === 'published' ? 'Đã chốt & Công bố' : 'Bản nháp'}
                            </span>
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {rec.assessment || rec.diagnosis || 'Bệnh án khám lâm sàng'}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {rec.confirmedAt ? new Date(rec.confirmedAt).toLocaleDateString('vi-VN') : new Date(rec.createdAt || 0).toLocaleDateString('vi-VN')}
                          </span>
                        </div>

                        {rec.soap && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900/60 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                            <div>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">Triệu chứng (S): </span>
                              {rec.soap.subjective || 'Chưa ghi nhận'}
                            </div>
                            <div>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">Khám thực thể (O): </span>
                              {rec.soap.objective || 'Chưa ghi nhận'}
                            </div>
                            <div className="sm:col-span-2">
                              <span className="font-semibold text-slate-700 dark:text-slate-300">Chỉ định / Kế hoạch (P): </span>
                              {rec.soap.plan || rec.plan || 'Chưa ghi nhận'}
                            </div>
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>Bác sĩ: <strong className="text-slate-700 dark:text-slate-300">{rec.confirmedBy || rec.authorName || 'Bác sĩ thú y'}</strong></span>
                            <span>•</span>
                            <span className="font-mono text-[10px]">Mã BA: {rec.id}</span>
                            {rec.appointmentId && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-[10px] text-indigo-500 font-semibold">Ca: {rec.appointmentId}</span>
                              </>
                            )}
                          </div>
                          <button
                            type="button"
                            data-btn="view-detail"
                            data-appointment-id={rec.appointmentId}
                            onClick={() => setSelectedRecordForDetail(rec)}
                            className="self-end sm:self-auto px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
                            title="Xem chi tiết bệnh án và đơn thuốc liên kết"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Xem chi tiết</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* PHẦN 2: LỊCH HẸN KHÁM CỦA THÚ CƯNG */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-indigo-500" />
                  Lịch sử lịch khám ({petAppointments.length})
                </h3>

                {petAppointments.length === 0 ? (
                  <div className="p-6 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Chưa có lịch hẹn nào của bé trong hệ thống.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    {petAppointments.map(app => (
                      <div key={app.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {app.service || 'Khám tổng quát'}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">({app.id})</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {app.date} {app.time || app.timeSlot || ''}
                            </span>
                            {app.assignedVet && (
                              <span>BS: {app.assignedVet}</span>
                            )}
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                          app.status === 'completed' ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400' :
                          app.status === 'in_progress' ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400' :
                          app.status === 'confirmed' ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400' :
                          app.status === 'cancelled' ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400' :
                          'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                        }`}>
                          {app.status === 'completed' ? 'Đã hoàn tất' :
                           app.status === 'in_progress' ? 'Đang khám' :
                           app.status === 'confirmed' ? 'Đã xác nhận' :
                           app.status === 'cancelled' ? 'Đã hủy' : 'Chờ xác nhận'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <PawPrint className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Chưa chọn bệnh nhân
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
              Vui lòng chọn một thú cưng từ danh sách bên trái để xem chi tiết bệnh án lâm sàng và lịch khám.
            </p>
          </div>
        )}
      </div>
      {/* MODAL XEM CHI TIẾT BỆNH ÁN LÂM SÀNG & ĐƠN THUỐC (CHỈ ĐỌC) */}
      <MedicalRecordDetailModal
        isOpen={Boolean(selectedRecordForDetail)}
        onClose={() => setSelectedRecordForDetail(null)}
        record={selectedRecordForDetail}
        appointment={appointments.find(a => a.id === selectedRecordForDetail?.appointmentId)}
        pet={selectedPet}
        allAppointments={appointments}
        onOpenSoap={onOpenSoap}
      />
    </div>
  );
};

export default VetPatientsTab;
