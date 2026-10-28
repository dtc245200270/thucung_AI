import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Printer, 
  X, 
  FileText, 
  ChevronDown, 
  Calendar, 
  Stethoscope, 
  PawPrint, 
  Building2,
  CheckCircle2,
  ShieldCheck,
  Syringe,
  Pill,
  User
} from 'lucide-react';
import { sound } from '../../services/soundService';
import { formatDateVi, getTodayVnDate } from '../../utils/dateUtils';

/**
 * Tính tuổi hiển thị thân thiện từ birthDate
 */
const getAgeText = (birthDateStr) => {
  if (!birthDateStr) return 'Chưa cập nhật ngày sinh';
  try {
    const birth = new Date(birthDateStr);
    const now = new Date();
    let years = now.getFullYear() - birth.getFullYear();
    let months = now.getMonth() - birth.getMonth();
    if (months < 0) {
      years--;
      months += 12;
    }
    if (years <= 0) return `${Math.max(1, months)} tháng tuổi`;
    return months > 0 ? `${years} tuổi ${months} tháng` : `${years} tuổi`;
  } catch {
    return 'Chưa cập nhật';
  }
};

export const WsavaPassportModal = ({
  isOpen = false,
  onClose = () => {},
  pets = [],
  selectedPetId = null,
  schedules = [],
  medicalRecords = [],
  prescriptions = [],
  currentUser = null
}) => {
  // Xác định thú cưng được chọn
  const [activePetId, setActivePetId] = useState(selectedPetId || pets[0]?.id || null);

  useEffect(() => {
    if (isOpen) {
      if (selectedPetId && selectedPetId !== 'all') {
        const match = pets.find(p => p.id === selectedPetId);
        if (match) {
          setActivePetId(match.id);
          return;
        }
      }
      if (pets[0]) {
        setActivePetId(pets[0].id);
      }
    }
  }, [isOpen, selectedPetId, pets]);

  // Thông tin thú cưng được kích hoạt
  const activePet = useMemo(() => {
    const found = pets.find(p => p.id === activePetId) || pets[0] || {};
    
    return {
      ...found,
      name: found.name || 'Thú cưng',
      breed: found.breed || 'Chưa cập nhật',
      species: found.species === 'cat' ? 'Mèo' : found.species === 'dog' ? 'Chó' : (found.species || 'Chưa cập nhật'),
      gender: found.gender === 'male' || found.gender === 'Đực' ? 'Đực' : found.gender === 'female' || found.gender === 'Cái' ? 'Cái' : 'Chưa cập nhật',
      weight: found.weight != null ? `${found.weight} kg` : 'Chưa cập nhật',
      microchip: found.microchip || 'Chưa cập nhật',
      birthDate: found.birthDate ? formatDateVi(found.birthDate) : 'Chưa cập nhật',
      age: getAgeText(found.birthDate),
      isNeutered: found.isNeutered ? 'Đã triệt sản' : 'Chưa triệt sản',
      color: (found.color && String(found.color).trim()) ? String(found.color).trim() : 'Chưa cập nhật',
      avatar: found.avatar || null,
      ownerName: currentUser?.name || found.ownerName || 'Chưa cập nhật',
      ownerPhone: currentUser?.phone || found.ownerPhone || 'Chưa cập nhật',
      ownerAddress: currentUser?.address || found.ownerAddress || 'Chưa cập nhật'
    };
  }, [pets, activePetId, currentUser]);

  // Danh sách mũi tiêm chủng của thú cưng đang chọn
  const vaccines = useMemo(() => {
    const vaxData = schedules.filter(s => s.petId === activePetId && s.type === 'vaccine' && !s.isPlanned);
    return vaxData.map((v) => {
      const isVetVerified = v.isVerified || v.source === 'vet_verified';
      return {
        id: v.id,
        title: v.title || v.vaccineName || 'Vaccine phòng bệnh',
        batchNumber: v.batchNumber || 'Chưa cập nhật',
        date: formatDateVi(v.date),
        nextDueDate: v.nextDueDate ? formatDateVi(v.nextDueDate) : 'Chưa có',
        doctor: v.doctor || (isVetVerified ? (v.verifiedBy || 'Bác sĩ PetCare') : 'Chưa cập nhật'),
        facility: v.facility || v.location || 'Chưa cập nhật',
        sourceText: isVetVerified ? 'Bác sĩ xác nhận' : 'Chủ nuôi khai báo',
        isVetVerified
      };
    });
  }, [schedules, activePetId]);

  // Danh sách phòng ký sinh trùng của thú cưng đang chọn
  const parasites = useMemo(() => {
    const pData = schedules.filter(s => s.petId === activePetId && (s.type === 'parasite' || s.type === 'deworm') && !s.isPlanned);
    return pData.map((d) => {
      const isVetVerified = d.isVerified || d.source === 'vet_verified';
      return {
        id: d.id,
        title: d.title || d.medicationName || 'Chế phẩm phòng ký sinh trùng',
        purpose: d.purpose || 'Phòng ngừa ký sinh trùng',
        dosage: d.dosage ? `${d.dosage} ${d.dosageUnit || ''}` : 'Chưa cập nhật',
        date: formatDateVi(d.date),
        nextDueDate: d.nextDueDate ? formatDateVi(d.nextDueDate) : 'Chưa có',
        doctor: d.doctor || (isVetVerified ? (d.verifiedBy || 'Bác sĩ PetCare') : 'Chưa cập nhật'),
        facility: d.facility || d.location || 'Chưa cập nhật',
        sourceText: isVetVerified ? 'Bác sĩ xác nhận' : 'Chủ nuôi khai báo',
        isVetVerified
      };
    });
  }, [schedules, activePetId]);

  // Bệnh án đã chốt/công bố chính thức của thú cưng đang chọn
  const publishedRecords = useMemo(() => {
    return medicalRecords
      .filter(r => r.petId === activePetId && r.isFinal === true && r.status === 'published')
      .map(r => ({
        id: r.id,
        date: formatDateVi(r.date || r.createdAt),
        doctor: r.vetName || r.doctor || r.confirmedBy || r.authorName || 'Bác sĩ PetCare',
        facility: r.facility || r.clinic || 'Phòng khám PetCare',
        reason: r.chiefComplaint || r.reason || 'Khám bệnh',
        diagnosis: r.soap?.assessment || r.assessment || r.diagnosis || 'Chưa ghi nhận',
        plan: r.soap?.plan || r.plan || r.treatmentPlan || 'Tuân thủ chỉ định điều trị'
      }));
  }, [medicalRecords, activePetId]);

  // Đơn thuốc đã ký chốt của thú cưng đang chọn
  const publishedPrescriptions = useMemo(() => {
    return prescriptions
      .filter(p => p.petId === activePetId && p.isFinal === true && p.status === 'published')
      .map(p => {
        const meds = Array.isArray(p.medications) && p.medications.length > 0
          ? p.medications.map(m => `${m.name || 'Thuốc'} (${m.dose || ''} ${m.unit || ''}, ${m.route || ''}, ${m.freq || ''})`).join('; ')
          : (p.medicineName || 'Thuốc theo chỉ định');
        return {
          id: p.id,
          date: formatDateVi(p.createdAt || p.confirmedAt || p.startDate),
          doctor: p.prescribedBy || p.vetName || 'Bác sĩ PetCare',
          diagnosis: p.diagnosis || p.purpose || 'Điều trị theo bệnh án',
          medications: meds
        };
      });
  }, [prescriptions, activePetId]);

  // Quản lý Esc và class in ấn
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('wsava-modal-active');
    } else {
      document.body.classList.remove('wsava-modal-active');
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.classList.remove('wsava-modal-active');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Gọi in trình duyệt
  const handlePrint = () => {
    try { sound?.playSuccess?.(); } catch {}
    setTimeout(() => {
      window.print();
    }, 150);
  };

  if (!isOpen) return null;

  if (pets.length === 0 || !activePet.id) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] overflow-y-auto flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity" onClick={onClose} />
        <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 text-center shadow-2xl border border-slate-200 dark:border-slate-800">
           <PawPrint className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
           <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">Chưa có thú cưng</h3>
           <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Bạn cần thêm thông tin thú cưng vào hệ thống trước khi xuất hồ sơ sức khỏe PDF.</p>
           <button onClick={onClose} className="px-5 py-2.5 w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-all cursor-pointer">
             Đóng
           </button>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div id="wsava-print-portal" className="fixed inset-0 z-[9999] overflow-y-auto">
      {/* Backdrop (ẩn khi in) */}
      <div 
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity no-print"
        onClick={onClose}
      />

      <div className="relative min-h-screen flex flex-col items-center justify-start p-2 sm:p-6 no-print-wrapper">
        
        {/* ============================================================ */}
        {/* THANH ĐIỀU KHIỂN HUD TRÊN CÙNG (ẨN KHI IN)                   */}
        {/* ============================================================ */}
        <div className="sticky top-2 sm:top-4 z-20 w-full max-w-4xl mb-4 p-3 rounded-2xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 shadow-lg flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                Xuất Hồ Sơ Sức Khỏe PDF
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Xuất file PDF khổ A4 theo dõi tiêm phòng, ký sinh trùng & bệnh án thú cưng
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Bộ chọn thú cưng nếu có nhiều bé */}
            {pets.length > 1 && (
              <div className="relative">
                <select
                  value={activePetId}
                  onChange={(e) => setActivePetId(e.target.value)}
                  className="appearance-none bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white text-xs font-semibold px-3 py-2 pr-8 rounded-xl border border-slate-200 dark:border-white/15 focus:outline-none cursor-pointer"
                >
                  {pets.map(p => (
                    <option key={p.id} value={p.id}>
                      🐾 {p.name} ({p.species === 'cat' ? 'Mèo' : p.species === 'dog' ? 'Chó' : p.species})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}

            {/* Nút In / Xuất PDF */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
              title="Mở hộp thoại In / Lưu file PDF của trình duyệt"
            >
              <Printer className="w-4 h-4" />
              <span>In / Lưu PDF (A4)</span>
            </button>

            {/* Nút Đóng */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors cursor-pointer"
              title="Đóng cửa sổ"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* TỜ GIẤY A4 HỒ SƠ SỨC KHỎE CHUẨN IN VÀ XEM TRƯỚC              */}
        {/* Không cắt bảng, không in nền ứng dụng, không huy hiệu giả     */}
        {/* ============================================================ */}
        <div 
          id="wsava-print-document"
          className="relative w-full max-w-[840px] bg-white text-slate-900 shadow-2xl rounded-sm p-6 sm:p-10 border border-slate-200 print:border-none print:shadow-none print:p-0 print:m-0"
        >
          {/* HEADER: PETCARE HEALTH RECORD */}
          <div className="border-b-2 border-slate-900 pb-3 mb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-bold tracking-widest text-indigo-700 uppercase">
                  HỆ THỐNG QUẢN LÝ THÚ CƯNG PETCARE
                </div>
                <h1 className="text-base sm:text-xl font-black text-slate-950 uppercase tracking-tight leading-snug">
                  HỒ SƠ SỨC KHỎE VÀ LỊCH SỬ Y TẾ THÚ CƯNG
                </h1>
                <p className="text-[11px] text-slate-600 font-medium">
                  Sổ theo dõi tiêm chủng, phòng ký sinh trùng & bệnh án điều trị
                </p>
              </div>

              <div className="text-right shrink-0">
                <div className="text-xs font-bold text-slate-900">
                  Mã thú cưng: <span className="font-mono">{activePet.id}</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Ngày xuất bản: <strong>{formatDateVi(getTodayVnDate())}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* KHỐI 1: THÔNG TIN THÚ CƯNG & CHỦ NUÔI                        */}
          {/* ============================================================ */}
          <div className="border border-slate-300 rounded-lg p-3 bg-slate-50/60 mb-4 wsava-avoid-break">
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-900 pb-1.5 mb-2 border-b border-slate-200">
              I. THÔNG TIN THÚ CƯNG & CHỦ NUÔI
            </div>

            <div className="grid grid-cols-12 gap-3 items-center">
              {/* Ảnh thú cưng (dùng placeholder trung tính nếu không có ảnh) */}
              <div className="col-span-3 sm:col-span-2 flex flex-col items-center">
                <div className="w-20 h-24 rounded border border-slate-400 overflow-hidden bg-white p-0.5 flex items-center justify-center">
                  {activePet.avatar ? (
                    <img
                      src={activePet.avatar}
                      alt={activePet.name}
                      className="w-full h-full object-cover rounded-xs"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <PawPrint className="w-8 h-8 mb-1" />
                      <span className="text-[8px] text-slate-400">Không có ảnh</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Thông tin 2 cột */}
              <div className="col-span-9 sm:col-span-10 grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5 text-[11px]">
                <div>
                  <span className="text-slate-500">Tên thú cưng: </span>
                  <strong className="font-bold text-slate-900">{activePet.name}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Loài: </span>
                  <strong className="text-slate-900">{activePet.species}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Giống: </span>
                  <strong className="text-slate-900">{activePet.breed}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Giới tính: </span>
                  <strong className="text-slate-900">{activePet.gender}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Ngày sinh: </span>
                  <strong className="text-slate-900">{activePet.birthDate}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Cân nặng: </span>
                  <strong className="text-slate-900">{activePet.weight}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Triệt sản: </span>
                  <strong className="text-slate-900">{activePet.isNeutered}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Mã Microchip: </span>
                  <strong className="font-mono text-slate-900">{activePet.microchip}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Chủ nuôi: </span>
                  <strong className="text-slate-900">{activePet.ownerName}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* KHỐI 2: LỊCH SỬ TIÊM CHỦNG                                   */}
          {/* ============================================================ */}
          <div className="mb-4 wsava-avoid-break">
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-900 pb-1 mb-1.5 border-b border-slate-300 flex items-center justify-between">
              <span>II. LỊCH SỬ TIÊM CHỦNG (VACCINATIONS)</span>
              <span className="text-[10px] font-normal text-slate-500">Tổng: {vaccines.length} mũi</span>
            </div>

            {vaccines.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic py-2">Chưa có bản ghi tiêm chủng nào được lưu.</p>
            ) : (
              <table className="w-full text-[10px] border-collapse wsava-print-table">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 border-b border-slate-400">
                    <th className="p-1.5 text-left font-bold border border-slate-300">Tên Vaccine</th>
                    <th className="p-1.5 text-center font-bold border border-slate-300 w-20">Ngày tiêm</th>
                    <th className="p-1.5 text-left font-bold border border-slate-300 w-24">Số lô</th>
                    <th className="p-1.5 text-left font-bold border border-slate-300">Cơ sở / Bác sĩ</th>
                    <th className="p-1.5 text-center font-bold border border-slate-300 w-24">Tiêm nhắc</th>
                    <th className="p-1.5 text-center font-bold border border-slate-300 w-28">Nguồn bản ghi</th>
                  </tr>
                </thead>
                <tbody>
                  {vaccines.map((vax, idx) => (
                    <tr key={idx} className="border-b border-slate-200">
                      <td className="p-1.5 border border-slate-300 font-semibold">{vax.title}</td>
                      <td className="p-1.5 border border-slate-300 text-center font-mono">{vax.date}</td>
                      <td className="p-1.5 border border-slate-300 font-mono">{vax.batchNumber}</td>
                      <td className="p-1.5 border border-slate-300">{vax.facility} {vax.doctor ? `(${vax.doctor})` : ''}</td>
                      <td className="p-1.5 border border-slate-300 text-center font-mono">{vax.nextDueDate}</td>
                      <td className="p-1.5 border border-slate-300 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          vax.isVetVerified ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {vax.sourceText}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ============================================================ */}
          {/* KHỐI 3: PHÒNG NGỪA KÝ SINH TRÙNG                             */}
          {/* ============================================================ */}
          <div className="mb-4 wsava-avoid-break">
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-900 pb-1 mb-1.5 border-b border-slate-300 flex items-center justify-between">
              <span>III. PHÒNG NGỪA KÝ SINH TRÙNG (DEWORMING & PARASITE PREVENTION)</span>
              <span className="text-[10px] font-normal text-slate-500">Tổng: {parasites.length} đợt</span>
            </div>

            {parasites.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic py-2">Chưa có bản ghi phòng ký sinh trùng nào.</p>
            ) : (
              <table className="w-full text-[10px] border-collapse wsava-print-table">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 border-b border-slate-400">
                    <th className="p-1.5 text-left font-bold border border-slate-300">Tên thuốc / Chế phẩm</th>
                    <th className="p-1.5 text-left font-bold border border-slate-300">Mục đích</th>
                    <th className="p-1.5 text-center font-bold border border-slate-300 w-20">Ngày dùng</th>
                    <th className="p-1.5 text-left font-bold border border-slate-300 w-20">Liều dùng</th>
                    <th className="p-1.5 text-center font-bold border border-slate-300 w-24">Dùng nhắc</th>
                    <th className="p-1.5 text-center font-bold border border-slate-300 w-28">Nguồn bản ghi</th>
                  </tr>
                </thead>
                <tbody>
                  {parasites.map((p, idx) => (
                    <tr key={idx} className="border-b border-slate-200">
                      <td className="p-1.5 border border-slate-300 font-semibold">{p.title}</td>
                      <td className="p-1.5 border border-slate-300">{p.purpose}</td>
                      <td className="p-1.5 border border-slate-300 text-center font-mono">{p.date}</td>
                      <td className="p-1.5 border border-slate-300">{p.dosage}</td>
                      <td className="p-1.5 border border-slate-300 text-center font-mono">{p.nextDueDate}</td>
                      <td className="p-1.5 border border-slate-300 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          p.isVetVerified ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {p.sourceText}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ============================================================ */}
          {/* KHỐI 4: LỊCH SỬ BỆNH ÁN & ĐƠN THUỐC ĐÃ CÔNG BỐ               */}
          {/* ============================================================ */}
          <div className="mb-4 wsava-avoid-break">
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-900 pb-1 mb-1.5 border-b border-slate-300 flex items-center justify-between">
              <span>IV. BỆNH ÁN KHÁM BỆNH & ĐƠN THUỐC CHÍNH THỨC</span>
              <span className="text-[10px] font-normal text-slate-500">Đã chốt & công bố</span>
            </div>

            {publishedRecords.length === 0 && publishedPrescriptions.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic py-2">Chưa có bệnh án hoặc đơn thuốc chính thức nào được lưu hành.</p>
            ) : (
              <table className="w-full text-[10px] border-collapse wsava-print-table">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 border-b border-slate-400">
                    <th className="p-1.5 text-center font-bold border border-slate-300 w-20">Ngày khám</th>
                    <th className="p-1.5 text-left font-bold border border-slate-300 w-32">Bác sĩ / Cơ sở</th>
                    <th className="p-1.5 text-left font-bold border border-slate-300">Lý do & Chẩn đoán</th>
                    <th className="p-1.5 text-left font-bold border border-slate-300">Phác đồ / Đơn thuốc</th>
                  </tr>
                </thead>
                <tbody>
                  {publishedRecords.map((rec, idx) => {
                    const presMatch = publishedPrescriptions.find(p => p.date === rec.date);
                    return (
                      <tr key={idx} className="border-b border-slate-200">
                        <td className="p-1.5 border border-slate-300 text-center font-mono">{rec.date}</td>
                        <td className="p-1.5 border border-slate-300">
                          <div><strong>{rec.doctor}</strong></div>
                          <div className="text-[9px] text-slate-500">{rec.facility}</div>
                        </td>
                        <td className="p-1.5 border border-slate-300">
                          <div><strong>Lý do:</strong> {rec.reason}</div>
                          <div><strong>Chẩn đoán:</strong> {rec.diagnosis}</div>
                        </td>
                        <td className="p-1.5 border border-slate-300">
                          <div>{rec.plan}</div>
                          {presMatch && (
                            <div className="mt-1 text-[9px] text-indigo-700">
                              <strong>Thuốc: </strong>{presMatch.medications}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* ============================================================ */}
          {/* FOOTER: KHUYẾN CÁO VÀ CHỮ KÝ                                 */}
          {/* ============================================================ */}
          <div className="border-t-2 border-slate-900 pt-3 mt-4 wsava-avoid-break">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-[10px] font-bold text-slate-800 uppercase">CHỦ NUÔI KHAI BÁO</div>
                <div className="text-[9px] text-slate-500 italic mt-0.5">(Ký và ghi rõ họ tên)</div>
                <div className="h-12 flex items-end justify-center">
                  <span className="text-xs font-semibold text-slate-800">{activePet.ownerName}</span>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold text-slate-800 uppercase">TRÍCH XUẤT HỆ THỐNG PETCARE</div>
                <div className="text-[9px] text-slate-500 italic mt-0.5">(Tài liệu xuất tự động)</div>
                <div className="h-12 flex items-end justify-center">
                  <span className="text-xs font-semibold text-slate-800">Mã thú cưng: {activePet.id}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-2 border-t border-slate-200 text-[9px] text-slate-500 leading-normal text-justify">
              * Ghi chú miễn trừ: Hồ sơ sức khỏe này được trích xuất từ Hệ thống Quản lý Y tế Thú cưng PetCare nhằm mục đích theo dõi sức khỏe và lịch sử tiêm phòng cá nhân của thú cưng. Tài liệu này không phải là hộ chiếu kiểm dịch xuất nhập cảnh quốc tế và không thay thế giấy kiểm dịch động vật của cơ quan quản lý nhà nước có thẩm quyền.
            </div>
          </div>

        </div>

      </div>
    </div>,
    document.body
  );
};

export default WsavaPassportModal;
