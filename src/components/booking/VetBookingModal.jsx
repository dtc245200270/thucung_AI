import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  Stethoscope, 
  Building2, 
  AlertCircle, 
  CheckCircle2, 
  User, 
  Phone, 
  FileText, 
  Sparkles,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  UserCheck,
  Check,
  RefreshCw,
  Info
} from 'lucide-react';
import { sound } from '../../services/soundService';
import { addActiveAppointment, fetchAvailableAppointmentSlots, fetchActiveDoctors } from '../../services/storageService';
import { getCurrentUser } from '../../services/authService';
import { getTodayVnDate, getCurrentVnTime, formatDateVi, addDaysLocal, isPastVnDateTime } from '../../utils/dateUtils.js';
import { useCurrentVnDate } from '../../hooks/useCurrentVnDate';
import { VET_SERVICES, VET_FACILITIES } from '../../constants/clinicFacilities';

// Helper validation số điện thoại Việt Nam (10 số, bắt đầu bằng 0 hoặc +84)
const validateVietnamesePhone = (phoneStr) => {
  if (!phoneStr || typeof phoneStr !== 'string' || !phoneStr.trim()) {
    return {
      isValid: false,
      error: 'Vui lòng nhập số điện thoại liên hệ xác nhận.'
    };
  }

  const trimmed = phoneStr.trim();

  // 1. Kiểm tra ký tự không hợp lệ: từ chối chuỗi chữ cái và ký tự đặc biệt
  if (/[^0-9+\s.-]/.test(trimmed)) {
    return {
      isValid: false,
      error: 'Số điện thoại không hợp lệ: không được chứa chữ cái hoặc ký tự đặc biệt.'
    };
  }

  // 2. Ký tự '+' chỉ được phép ở đầu chuỗi (+84)
  if (trimmed.includes('+') && !trimmed.startsWith('+')) {
    return {
      isValid: false,
      error: 'Ký tự "+" chỉ được phép ở đầu số điện thoại (+84).'
    };
  }

  // 3. Chuẩn hóa: loại bỏ khoảng trắng, dấu chấm, dấu gạch nối
  const sanitized = trimmed.replace(/[\s.-]/g, '');

  // 4. Kiểm tra đầu số Việt Nam
  if (!sanitized.startsWith('0') && !sanitized.startsWith('+84') && !sanitized.startsWith('84')) {
    return {
      isValid: false,
      error: 'Số điện thoại phải bắt đầu bằng 0 hoặc +84 (Ví dụ: 0912 345 678).'
    };
  }

  let normalized = sanitized;
  if (normalized.startsWith('+84')) {
    normalized = '0' + normalized.slice(3);
  } else if (normalized.startsWith('84') && sanitized.length > 9) {
    normalized = '0' + normalized.slice(2);
  }

  if (!/^\d+$/.test(normalized)) {
    return {
      isValid: false,
      error: 'Số điện thoại chỉ được chứa các chữ số.'
    };
  }

  if (normalized.length < 10) {
    return {
      isValid: false,
      error: `Số điện thoại quá ngắn (${normalized.length}/10 số). Vui lòng nhập đủ 10 chữ số.`
    };
  }

  if (normalized.length > 11) {
    return {
      isValid: false,
      error: `Số điện thoại quá dài (${normalized.length} số). Số điện thoại Việt Nam gồm 10 chữ số.`
    };
  }

  // 7. Kiểm tra theo đầu số di động VN (03, 05, 07, 08, 09) hoặc bàn (02)
  const vnMobileRegex = /^(0)(3|5|7|8|9)[0-9]{8}$/;
  const vnLandlineRegex = /^(02)[0-9]{9}$/;

  if (!vnMobileRegex.test(normalized) && !vnLandlineRegex.test(normalized)) {
    if (normalized.length === 10 && !/^(0)(3|5|7|8|9)/.test(normalized)) {
      return {
        isValid: false,
        error: 'Đầu số không hợp lệ. Số di động Việt Nam bắt đầu bằng 03, 05, 07, 08, 09.'
      };
    }
    return {
      isValid: false,
      error: 'Số điện thoại không đúng định dạng mạng viễn thông Việt Nam.'
    };
  }

  return {
    isValid: true,
    error: '',
    sanitized: trimmed,
    normalized
  };
};

export const VetBookingModal = ({
  isOpen,
  onClose,
  pets = [],
  petsLoading = false,
  petsError = null,
  onRetryLoadPets = null,
  initialPetId = null,
  initialService = null,
  initialNote = null,
  initialFacility = null,
  initialIsAiVision = false,
  initialAiVisionPetId = null,
  onBookingSuccess,
  users = []
}) => {
  const todayVn = useCurrentVnDate();

  // BƯỚC FORM: 1 = Thú cưng & Nhu cầu | 2 = Nơi tiếp nhận & Thời gian | 3 = Liên hệ & Xác nhận
  const [currentStep, setCurrentStep] = useState(1);

  // Dữ liệu Bước 1: Thú cưng & Nhu cầu khám
  const [selectedPetId, setSelectedPetId] = useState('');
  const [selectedService, setSelectedService] = useState('Khám tổng quát định kỳ');
  const [symptomsNote, setSymptomsNote] = useState('');
  const [isAiVisionSource, setIsAiVisionSource] = useState(false);
  const [aiVisionBoundPetId, setAiVisionBoundPetId] = useState(null);

  // Dữ liệu Bước 2: Nơi tiếp nhận & Thời gian
  const [selectedFacilityId, setSelectedFacilityId] = useState(VET_FACILITIES[0].id);
  const [selectedDoctorId, setSelectedDoctorId] = useState('auto'); // 'auto' = Cơ sở phân công
  const [selectedDate, setSelectedDate] = useState(() => addDaysLocal(getTodayVnDate(), 1));
  const [selectedTime, setSelectedTime] = useState('');
  
  // Trạng thái tải khung giờ khả dụng ở Bước 2
  const [availableSlots, setAvailableSlots] = useState([]);
  const [bookedSlots, setBookedSlots] = useState([]);
  const [hasWorkSchedule, setHasWorkSchedule] = useState(true);
  const [scheduleNotice, setScheduleNotice] = useState('');
  const [isSlotsLoading, setIsSlotsLoading] = useState(false);

  // Dữ liệu Bước 3: Thông tin liên hệ
  const user = getCurrentUser();
  const [ownerName, setOwnerName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');

  // Trạng thái lỗi theo từng trường để focus
  const [step1Error, setStep1Error] = useState('');
  const [step2Error, setStep2Error] = useState('');
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isAuthExpired, setIsAuthExpired] = useState(false);
  const [syncWarningMessage, setSyncWarningMessage] = useState('');

  // Trạng thái gửi và hoàn tất
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdAppointment, setCreatedAppointment] = useState(null);

  // Refs để focus đến trường lỗi đầu tiên
  const petSectionRef = useRef(null);
  const dateInputRef = useRef(null);
  const timeSectionRef = useRef(null);
  const nameInputRef = useRef(null);
  const phoneInputRef = useRef(null);

  // Cơ sở đang được chọn
  const currentFacility = useMemo(() => {
    return VET_FACILITIES.find(f => f.id === selectedFacilityId) || VET_FACILITIES[0];
  }, [selectedFacilityId]);

  // Trạng thái danh sách bác sĩ thực tế theo cơ sở đã chọn (Tải động từ backend, không dùng mock)
  const [facilityDoctors, setFacilityDoctors] = useState([]);
  const [isDoctorsLoading, setIsDoctorsLoading] = useState(false);

  // Tải danh sách bác sĩ hoạt động thuộc về cơ sở đang chọn từ backend
  useEffect(() => {
    let isCancelled = false;
    async function loadDoctors() {
      if (!isOpen) return;
      setIsDoctorsLoading(true);
      try {
        const docs = await fetchActiveDoctors(selectedFacilityId);
        if (!isCancelled) {
          const list = Array.isArray(docs) ? docs : [];
          setFacilityDoctors(list);

          // YÊU CẦU 5: Khi đổi cơ sở, xóa lựa chọn bác sĩ cũ nếu không còn hợp lệ tại cơ sở mới
          setSelectedDoctorId(prevDocId => {
            if (!prevDocId || prevDocId === 'auto') return 'auto';
            const stillValid = list.some(d => d.id === prevDocId);
            return stillValid ? prevDocId : 'auto';
          });
        }
      } catch (err) {
        console.warn('[Booking] Lỗi tải bác sĩ theo cơ sở:', err);
        if (!isCancelled) setFacilityDoctors([]);
      } finally {
        if (!isCancelled) setIsDoctorsLoading(false);
      }
    }
    loadDoctors();
    return () => { isCancelled = true; };
  }, [isOpen, selectedFacilityId]);

  // Danh sách bác sĩ hiển thị trong dropdown (Bao gồm "Cơ sở phân công" ở đầu)
  const availableDoctors = useMemo(() => {
    const list = [{ id: 'auto', name: 'Cơ sở phân công (Bác sĩ trực ca)' }];
    for (const doc of facilityDoctors) {
      const docName = doc.name.startsWith('BS.') ? doc.name : `BS. ${doc.name}`;
      list.push({ id: doc.id, name: docName, address: doc.address || '', facilityId: doc.facilityId });
    }
    return list;
  }, [facilityDoctors]);

  // Tên bác sĩ tóm tắt hiển thị ở Bước 3
  const summaryDoctorName = useMemo(() => {
    if (selectedDoctorId && selectedDoctorId !== 'auto') {
      const d = availableDoctors.find(doc => doc.id === selectedDoctorId);
      return d ? d.name : 'Bác sĩ chuyên khoa';
    }
    return 'Cơ sở phân công (Bác sĩ trực ca)';
  }, [selectedDoctorId, availableDoctors]);

  // Khởi tạo và thiết lập lại dữ liệu form mỗi khi mở modal
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setStep1Error('');
      setStep2Error('');
      setNameError('');
      setPhoneError('');
      setSubmitError('');
      setIsAuthExpired(false);
      setSyncWarningMessage('');
      setCreatedAppointment(null);

      const activeUser = getCurrentUser();
      setOwnerName(activeUser?.name || '');
      setPhone(activeUser?.phone || '');

      // 1. Khởi tạo thú cưng: Nếu mở từ thẻ thú cưng thì chọn đúng bé đó
      const validInitialPet = pets.find(p => p.id === initialPetId);
      if (validInitialPet) {
        setSelectedPetId(validInitialPet.id);
      } else if (pets.length > 0) {
        setSelectedPetId(pets[0].id);
      } else {
        setSelectedPetId('');
      }

      // 2. Dịch vụ khám
      if (initialService) {
        const found = VET_SERVICES.find(s => 
          s.name === initialService || 
          s.id === initialService || 
          initialService.toLowerCase().includes(s.name.toLowerCase()) || 
          s.name.toLowerCase().includes(initialService.toLowerCase()) ||
          (initialService.toLowerCase().includes('da liễu') && s.id === 'dermatology')
        );
        setSelectedService(found ? found.name : initialService);
      } else {
        setSelectedService('Khám tổng quát định kỳ');
      }

      // 3. Lý do khám: Không tự điền triệu chứng giả.
      // Chỉ nhận khi có thao tác chuyển kết quả Vision rõ ràng và đúng petId.
      if (initialIsAiVision === true && initialNote && (validInitialPet ? validInitialPet.id === initialAiVisionPetId : true)) {
        setSymptomsNote(initialNote);
        setIsAiVisionSource(true);
        setAiVisionBoundPetId(validInitialPet ? validInitialPet.id : initialAiVisionPetId);
      } else {
        // Mở thông thường hoặc mở từ thẻ: KHÔNG tự điền triệu chứng giả
        setSymptomsNote('');
        setIsAiVisionSource(false);
        setAiVisionBoundPetId(null);
      }

      // 4. Cơ sở tiếp nhận
      if (initialFacility) {
        const foundFac = VET_FACILITIES.find(f => f.name === initialFacility || f.id === initialFacility);
        if (foundFac) setSelectedFacilityId(foundFac.id);
      } else {
        setSelectedFacilityId(VET_FACILITIES[0].id);
      }

      // 5. Ngày khám: Mặc định ngày mai hoặc hôm nay (Asia/Ho_Chi_Minh)
      setSelectedDate(addDaysLocal(getTodayVnDate(), 1));
      setSelectedDoctorId('auto');
      setSelectedTime('');
    }
  }, [isOpen, initialPetId, initialService, initialNote, initialFacility, initialIsAiVision, initialAiVisionPetId, pets]);

  // Tải khung giờ khả dụng khi thay đổi Cơ sở, Bác sĩ hoặc Ngày hẹn
  useEffect(() => {
    let isCancelled = false;

    async function loadSlots() {
      if (!isOpen || !selectedDate) return;

      setIsSlotsLoading(true);
      setScheduleNotice('');

      try {
        const res = await fetchAvailableAppointmentSlots({
          facility: currentFacility.name,
          facilityId: currentFacility.id,
          doctorId: selectedDoctorId,
          date: selectedDate,
          petId: selectedPetId || null
        });

        if (isCancelled) return;

        if (res && res.success) {
          setHasWorkSchedule(res.hasWorkSchedule !== false);
          setAvailableSlots(res.availableSlots || []);
          setBookedSlots(res.bookedSlots || []);

          if (res.hasWorkSchedule === false) {
            setScheduleNotice(res.message || 'Cơ sở không có ca trực / lịch làm việc vào ngày này. Vui lòng chọn ngày khác.');
            setSelectedTime('');
          } else {
            // Nếu khung giờ đang chọn không còn nằm trong danh sách khả dụng -> hủy chọn giờ cũ
            if (selectedTime && !res.availableSlots.includes(selectedTime)) {
              setSelectedTime('');
            }
          }
        } else {
          setHasWorkSchedule(false);
          setScheduleNotice(res?.error || 'Không thể tải lịch làm việc của cơ sở.');
          setSelectedTime('');
        }
      } catch (err) {
        if (isCancelled) return;
        console.warn('[Booking] Lỗi tải khung giờ:', err.message);
        // Fallback an toàn dựa trên cấu hình cơ sở nếu máy chủ gặp trục trặc
        const dayOfWeek = new Date(selectedDate + 'T00:00:00+07:00').getDay();
        if (!currentFacility.workingDays.includes(dayOfWeek)) {
          setHasWorkSchedule(false);
          setScheduleNotice(`Cơ sở ${currentFacility.name} không có lịch làm việc vào ngày này. Vui lòng chọn ngày khác.`);
          setAvailableSlots([]);
          setSelectedTime('');
        } else {
          setHasWorkSchedule(true);
          const base = currentFacility.workingHours.filter(slot => !isPastVnDateTime(selectedDate, slot));
          setAvailableSlots(base);
          if (selectedTime && !base.includes(selectedTime)) {
            setSelectedTime('');
          }
        }
      } finally {
        if (!isCancelled) setIsSlotsLoading(false);
      }
    }

    loadSlots();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, selectedFacilityId, selectedDoctorId, selectedDate, selectedPetId, currentFacility]);

  // Thú cưng được chọn hiện tại
  const validPet = pets.find(p => p.id === selectedPetId);
  const isEmergencySelected = (selectedService || '').includes('Cấp cứu');

  // Đổi bé thú cưng: Nếu là ghi chú Vision của bé cũ thì xóa sạch
  const handleSelectPet = (newPetId) => {
    sound.playClick();
    setSelectedPetId(newPetId);
    setStep1Error('');

    if (isAiVisionSource && aiVisionBoundPetId && aiVisionBoundPetId !== newPetId) {
      setSymptomsNote('');
      setIsAiVisionSource(false);
      setAiVisionBoundPetId(null);
    }
  };

  // ============================================================================
  // ĐIỀU HƯỚNG BƯỚC 1 -> BƯỚC 2
  // ============================================================================
  const handleNextStep1 = () => {
    sound.playClick();
    setStep1Error('');

    if (petsLoading) {
      setStep1Error('Đang tải danh sách thú cưng của bạn. Vui lòng đợi trong giây lát...');
      return;
    }

    if (pets.length === 0) {
      setStep1Error('Bạn chưa có hồ sơ thú cưng nào. Vui lòng thêm thú cưng vào hệ thống trước khi đặt lịch.');
      return;
    }

    if (!selectedPetId || !validPet) {
      setStep1Error('Vui lòng chọn một thú cưng cần khám từ danh sách của bạn.');
      petSectionRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (!selectedService) {
      setStep1Error('Vui lòng chọn dịch vụ khám.');
      return;
    }

    setCurrentStep(2);
  };

  // ============================================================================
  // ĐIỀU HƯỚNG BƯỚC 2 -> BƯỚC 3
  // ============================================================================
  const handleNextStep2 = () => {
    sound.playClick();
    setStep2Error('');

    if (!selectedDate) {
      setStep2Error('Vui lòng chọn ngày hẹn khám.');
      dateInputRef.current?.focus();
      return;
    }

    if (selectedDate < todayVn) {
      setStep2Error(`Ngày hẹn khám (${formatDateVi(selectedDate)}) không được ở quá khứ. Vui lòng chọn từ ngày hôm nay trở đi.`);
      dateInputRef.current?.focus();
      return;
    }

    if (!hasWorkSchedule) {
      setStep2Error('Cơ sở không có ca trực / lịch làm việc vào ngày này. Vui lòng chọn ngày khác.');
      return;
    }

    if (!selectedTime) {
      setStep2Error('Vui lòng chọn một khung giờ tiếp nhận khả dụng.');
      timeSectionRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (!availableSlots.includes(selectedTime)) {
      setStep2Error('Khung giờ bạn chọn không còn khả dụng. Vui lòng chọn khung giờ khác.');
      return;
    }

    setCurrentStep(3);
  };

  // Quay lại bước trước
  const handlePrevStep = () => {
    sound.playClick();
    setSubmitError('');
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // ============================================================================
  // XỬ LÝ GỬI YÊU CẦU ĐẶT KHÁM (BƯỚC 3)
  // ============================================================================
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setSubmitError('');
    setNameError('');
    setPhoneError('');
    setIsAuthExpired(false);
    setSyncWarningMessage('');

    // 1. Kiểm tra họ tên
    if (!ownerName || !ownerName.trim()) {
      setNameError('Vui lòng nhập họ tên chủ nuôi.');
      nameInputRef.current?.focus();
      return;
    }

    // 2. Kiểm tra số điện thoại Việt Nam
    const phoneValidation = validateVietnamesePhone(phone);
    if (!phoneValidation.isValid) {
      setPhoneError(phoneValidation.error);
      phoneInputRef.current?.focus();
      return;
    }

    // 3. Kiểm tra lại tính hợp lệ của ngày giờ
    if (isPastVnDateTime(selectedDate, selectedTime)) {
      setSubmitError('Khung giờ hẹn này đã trôi qua so với giờ thực tế tại Việt Nam. Vui lòng quay lại Bước 2 để chọn khung giờ khác.');
      return;
    }

    if (isSubmitting) return;

    setIsSubmitting(true);
    try { sound.playPop(); } catch (_) {}

    const selectedDocObj = availableDoctors.find(d => d.id === selectedDoctorId);
    const assignedVetLabel = (selectedDoctorId && selectedDoctorId !== 'auto' && selectedDocObj) 
      ? selectedDocObj.name 
      : 'Cơ sở phân công';

    const newAppointment = {
      id: 'BK-' + Date.now(),
      ownerId: user?.id || validPet?.ownerId || null,
      petId: validPet.id,
      petName: validPet.name || 'Thú cưng',
      petType: `${validPet.species === 'cat' ? 'Mèo' : validPet.species === 'rabbit' ? 'Thỏ' : 'Chó'} ${validPet.breed || ''}`.trim(),
      ownerName: ownerName.trim(),
      phone: phoneValidation.normalized,
      service: selectedService,
      facility: currentFacility.name,
      facilityId: currentFacility.id,
      clinicId: currentFacility.id,
      assignedVetId: (selectedDoctorId && selectedDoctorId !== 'auto') ? selectedDoctorId : null,
      assignedVet: assignedVetLabel,
      date: selectedDate,
      time: selectedTime,
      note: symptomsNote.trim() || 'Đặt lịch kiểm tra sức khỏe qua PetCare PRO AI',
      status: 'pending', // Luôn ở trạng thái Chờ xác nhận
      adminNote: '',
      isEmergency: isEmergencySelected,
      createdAt: new Date().toISOString()
    };

    try {
      const saved = await addActiveAppointment(newAppointment);

      // Nếu lưu thành công trên máy chủ nhưng đồng bộ cache gặp cảnh báo nhẹ
      if (saved?._syncWarning) {
        setSyncWarningMessage('Lịch hẹn đã được lưu thành công trên hệ thống. Bạn có thể tải lại trang (F5) nếu chưa thấy hiển thị ngay.');
      }

      // Callback thông báo cho App cập nhật state (KHÔNG gửi lại PUT/POST)
      if (typeof onBookingSuccess === 'function') {
        try {
          await onBookingSuccess(saved || newAppointment);
        } catch (cbErr) {
          console.warn('[Booking] Callback update state cảnh báo:', cbErr);
        }
      }

      setCreatedAppointment(saved || newAppointment);
      try { sound.playSuccess(); } catch (_) {}
    } catch (err) {
      console.error('[Booking] Lỗi gửi đặt lịch:', err);

      if (err.status === 401 || err.isAuthFailure || err.code === 'TOKEN_EXPIRED' || err.code === 'INVALID_TOKEN') {
        setIsAuthExpired(true);
        setSubmitError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục (dữ liệu bạn nhập đã được giữ nguyên).');
      } else if (err.status === 409 || err.code === 'APPOINTMENT_COLLISION') {
        setSubmitError(err.message || 'Khung giờ này vừa có lịch hẹn khác trùng khớp. Vui lòng quay lại Bước 2 và chọn khung giờ khác.');
      } else {
        setSubmitError(err.message || 'Không thể gửi yêu cầu đặt khám. Vui lòng kiểm tra kết nối mạng và thử lại.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-[#0f1322] border border-purple-500/30 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] flex flex-col max-h-[92vh] overflow-hidden my-auto">
        
        {/* Neon Glow Accents */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-purple-500 via-emerald-400 to-indigo-500 z-30" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* ==================================================================== */}
        {/* MODAL HEADER: Cố định ở đầu                                         */}
        {/* ==================================================================== */}
        <div className="p-4 sm:p-5 border-b border-white/[0.08] relative z-20 shrink-0 bg-[#0f1322]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg ${
                isEmergencySelected
                  ? 'bg-gradient-to-tr from-rose-600 to-red-500 shadow-rose-600/30 animate-pulse'
                  : 'bg-gradient-to-tr from-purple-600 to-indigo-500 shadow-purple-600/30'
              }`}>
                <Stethoscope className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                    Đặt Lịch Khám Thú Y
                  </h2>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                    Tiếp Nhận 2 Chiều
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Kết nối trực tiếp lịch khám với đội ngũ Bác sĩ Thú y & Phòng khám liên kết.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Đóng cửa sổ"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Thanh Tiến Trình 3 Bước (Stepper Navigation) */}
          {!createdAppointment && (
            <div className="grid grid-cols-3 gap-2 mt-3.5 pt-3 border-t border-white/[0.05]">
              {[
                { step: 1, label: '1. Thú cưng & Nhu cầu' },
                { step: 2, label: '2. Nơi tiếp nhận & Giờ' },
                { step: 3, label: '3. Xác nhận & Gửi' }
              ].map((item) => {
                const isActive = currentStep === item.step;
                const isPassed = currentStep > item.step;
                return (
                  <div
                    key={item.step}
                    className={`py-1.5 px-2.5 rounded-xl text-center text-[11px] font-bold transition-all border ${
                      isActive
                        ? 'bg-purple-600/25 border-purple-500 text-purple-200 shadow-sm shadow-purple-500/20'
                        : isPassed
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                        : 'bg-slate-900/40 border-white/[0.05] text-slate-500'
                    }`}
                  >
                    <span className="truncate block">{item.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ==================================================================== */}
        {/* MODAL BODY: Cuộn nội dung bên trong, không che trường nhập            */}
        {/* ==================================================================== */}
        <div className="p-4 sm:p-6 overflow-y-auto min-h-0 flex-1 space-y-5 relative z-10 text-xs">
          
          {/* ------------------------------------------------------------------ */}
          {/* TRƯỜNG HỢP: ĐÃ GỬI THÀNH CÔNG -> HIỂN THỊ MÀN HÌNH XÁC NHẬN        */}
          {/* ------------------------------------------------------------------ */}
          {createdAppointment ? (
            <div className="space-y-4 py-3 animate-in zoom-in-95">
              <div className="p-5 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base font-black text-emerald-300 tracking-tight">
                    Yêu Cầu Đặt Lịch Khám Đã Gửi Thành Công!
                  </h3>
                  <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-emerald-500/30 text-xs font-mono text-emerald-300">
                    <span>Mã lịch:</span>
                    <strong className="text-white font-bold">{createdAppointment.id}</strong>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-900/60 border border-white/10 text-left text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Trạng thái tiếp nhận:</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Chờ xác nhận
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Bé khám:</span>
                    <strong className="text-white">{createdAppointment.petName} ({createdAppointment.petType})</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Dịch vụ:</span>
                    <strong className="text-white">{createdAppointment.service}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Cơ sở tiếp nhận:</span>
                    <strong className="text-white">{createdAppointment.facility}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Thời gian hẹn:</span>
                    <strong className="text-teal-300">{formatDateVi(createdAppointment.date)} lúc {createdAppointment.time}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Người liên hệ:</span>
                    <strong className="text-white">{createdAppointment.ownerName} ({createdAppointment.phone})</strong>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300/90 text-[11px] text-left leading-relaxed">
                  <p>
                    <strong>Lưu ý quan trọng:</strong> Yêu cầu của bạn hiện đang ở trạng thái <strong>Chờ xác nhận</strong>. Cơ sở thú y sẽ liên hệ qua số điện thoại <strong>{createdAppointment.phone}</strong> để xác nhận lịch trước khi tiếp nhận trực tiếp tại phòng khám.
                  </p>
                </div>

                {syncWarningMessage && (
                  <p className="text-[11px] text-cyan-300 italic">
                    ℹ️ {syncWarningMessage}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* ============================================================== */}
              {/* BƯỚC 1: THÚ CƯNG VÀ NHU CẦU KHÁM                               */}
              {/* ============================================================== */}
              {currentStep === 1 && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  
                  {/* 1.1. Chọn bé thú cưng */}
                  <div ref={petSectionRef}>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <span>🐾 Chọn bé thú cưng cần khám <span className="text-rose-500 font-bold">*</span>:</span>
                      </label>
                      {!petsLoading && pets.length > 0 && (
                        <span className="text-[11px] text-slate-400 font-medium">
                          {pets.length} bé trong hồ sơ
                        </span>
                      )}
                    </div>

                    {/* Trạng thái A: Đang tải thú cưng */}
                    {petsLoading && (
                      <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-300 flex items-center justify-center gap-2.5">
                        <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin shrink-0" />
                        <span className="text-xs font-semibold">Đang tải danh sách thú cưng của bạn...</span>
                      </div>
                    )}

                    {/* Trạng thái B: Lỗi tải thú cưng */}
                    {!petsLoading && petsError && pets.length === 0 && (
                      <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs">
                          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                          <span>{petsError}</span>
                        </div>
                        {typeof onRetryLoadPets === 'function' && (
                          <button
                            type="button"
                            onClick={() => onRetryLoadPets()}
                            className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 text-xs font-bold transition-all cursor-pointer shrink-0"
                          >
                            Thử lại
                          </button>
                        )}
                      </div>
                    )}

                    {/* Trạng thái C: Chưa có thú cưng nào */}
                    {!petsLoading && !petsError && pets.length === 0 && (
                      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center gap-2.5 text-xs">
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Bạn chưa có hồ sơ thú cưng nào. Vui lòng thêm thú cưng vào hệ thống trước khi đặt lịch khám.</span>
                      </div>
                    )}

                    {/* Trạng thái D: Danh sách thú cưng hợp lệ */}
                    {!petsLoading && pets.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {pets.map((pet) => {
                          const isSelected = selectedPetId === pet.id;
                          return (
                            <button
                              key={pet.id}
                              type="button"
                              onClick={() => handleSelectPet(pet.id)}
                              className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-2.5 cursor-pointer ${
                                isSelected
                                  ? 'bg-purple-600/20 border-purple-500 text-white shadow-md shadow-purple-500/10 ring-1 ring-purple-500/50'
                                  : 'bg-slate-900/60 border-white/[0.08] text-slate-300 hover:bg-slate-800/80 hover:border-white/20'
                              }`}
                            >
                              <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-800 shrink-0 border border-white/10">
                                {pet.avatar || pet.photoUrl ? (
                                  <img src={pet.avatar || pet.photoUrl} alt={pet.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-xs font-bold text-purple-400">
                                    {(pet.name || 'P').charAt(0)}
                                  </div>
                                )}
                              </div>
                              <div className="truncate">
                                <strong className="block text-xs font-bold truncate">{pet.name}</strong>
                                <span className="text-[10px] text-slate-400 truncate block">
                                  {pet.species === 'cat' ? 'Mèo' : pet.species === 'rabbit' ? 'Thỏ' : 'Chó'} {pet.breed || ''}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 1.2. Chọn dịch vụ khám từ danh mục hệ thống */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <span>🩺 Dịch vụ khám cần đặt <span className="text-rose-500 font-bold">*</span>:</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {VET_SERVICES.map((srv) => {
                        const isSelected = selectedService === srv.name;
                        return (
                          <button
                            key={srv.id}
                            type="button"
                            onClick={() => { sound.playClick(); setSelectedService(srv.name); }}
                            className={`p-3 rounded-2xl border text-left transition-all flex items-start gap-2.5 cursor-pointer ${
                              isSelected
                                ? srv.isEmergency
                                  ? 'bg-rose-500/20 border-rose-500 text-white shadow-md shadow-rose-500/20'
                                  : 'bg-emerald-500/20 border-emerald-500 text-white shadow-md shadow-emerald-500/20'
                                : 'bg-slate-900/60 border-white/[0.08] text-slate-300 hover:bg-slate-800/80 hover:border-white/20'
                            }`}
                          >
                            <span className="text-xl shrink-0 mt-0.5">{srv.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <strong className="text-xs font-bold truncate">{srv.name}</strong>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                                  srv.isEmergency ? 'bg-rose-500/30 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
                                }`}>
                                  {srv.badge}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug line-clamp-1">
                                {srv.desc}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 1.3. Nhập lý do khám/triệu chứng lâm sàng (Không tự điền triệu chứng giả) */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-amber-400" />
                        <span>Mô tả triệu chứng / Lý do khám:</span>
                      </label>
                      {isAiVisionSource && aiVisionBoundPetId === selectedPetId && (
                        <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30 animate-in fade-in">
                          <Sparkles className="w-3 h-3 text-emerald-400" /> Đã nạp từ AI Thị Giác
                        </span>
                      )}
                    </div>
                    <textarea
                      rows={3}
                      value={symptomsNote}
                      onChange={(e) => {
                        setSymptomsNote(e.target.value);
                        // Ghi chú nhập tay không được gắn nhãn nguồn AI
                        setIsAiVisionSource(false);
                      }}
                      placeholder="Mô tả các biểu hiện bất thường hoặc nhu cầu của bé (ví dụ: sốt, nôn mửa, ngứa da gãi nhiều, bỏ ăn...)"
                      className="w-full bg-slate-900 border border-white/10 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 transition-colors leading-relaxed"
                    />
                  </div>

                  {/* Lỗi xác thực Bước 1 */}
                  {step1Error && (
                    <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 flex items-center gap-2 text-xs animate-in fade-in">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{step1Error}</span>
                    </div>
                  )}
                </div>
              )}

              {/* ============================================================== */}
              {/* BƯỚC 2: NƠI TIẾP NHẬN VÀ THỜI GIAN                             */}
              {/* ============================================================== */}
              {currentStep === 2 && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  
                  {/* 2.1. Chọn Cơ sở Thú y (Dữ liệu thực, không có rating giả) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Cơ sở / Bệnh viện Thú y tiếp nhận <span className="text-rose-500 font-bold">*</span>:</span>
                    </label>
                    <div className="space-y-2">
                      {VET_FACILITIES.map((fac) => {
                        return (
                          <div
                            key={fac.id}
                            className="p-3.5 rounded-2xl border text-left bg-indigo-600/15 border-indigo-500/50 text-white shadow-sm ring-1 ring-indigo-500/30 flex items-start gap-3"
                          >
                            <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                              ✓
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <strong className="text-xs font-bold text-white">{fac.name}</strong>
                                <span className="text-[10px] text-emerald-400 font-mono font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                  {fac.workingDays.length === 7 ? 'Mở cửa cả tuần' : 'T2 - T7'}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-300 mt-0.5">{fac.address}</p>
                              <span className="text-[10px] text-emerald-400 font-mono block mt-0.5">
                                📞 Hotline: {fac.hotline}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2.2. Chọn Bác sĩ phụ trách (Hỗ trợ "Cơ sở phân công") */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-purple-400" />
                        <span>Bác sĩ phụ trách:</span>
                      </label>
                      {isDoctorsLoading && (
                        <span className="text-[10px] text-indigo-400 flex items-center gap-1">
                          <RefreshCw className="w-3 h-3 animate-spin" /> Đang cập nhật danh sách bác sĩ...
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <select
                        value={selectedDoctorId}
                        onChange={(e) => { sound.playClick(); setSelectedDoctorId(e.target.value); }}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-400 transition-colors"
                      >
                        {availableDoctors.map((doc) => (
                          <option key={doc.id} value={doc.id} className="bg-slate-900 text-white">
                            {doc.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {facilityDoctors.length === 0 ? (
                      <div className="mt-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-[11px] leading-relaxed flex items-start gap-2.5">
                        <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block text-amber-200 font-semibold mb-0.5">
                            Cơ sở chưa có Bác sĩ liên kết nhận lịch chỉ định riêng
                          </strong>
                          <span>
                            Tại <strong>{currentFacility.name}</strong>, hiện chưa có tài khoản Bác sĩ nào được phân công liên kết để nhận lịch hẹn đích danh. Hệ thống áp dụng <em>"Cơ sở phân công (Bác sĩ trực ca)"</em> để cơ sở chủ động sắp xếp bác sĩ trực ca phù hợp nhất tiếp nhận bé khi đến khám.
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Có <strong>{facilityDoctors.length}</strong> bác sĩ thú y đang hoạt động tại cơ sở này. Bạn có thể chọn đích danh hoặc để cơ sở tự phân công.</span>
                      </p>
                    )}
                  </div>

                  {/* 2.3. Ngày hẹn khám (Asia/Ho_Chi_Minh, chặn quá khứ) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Ngày hẹn khám <span className="text-rose-500 font-bold">*</span>:</span>
                      </label>
                      <input
                        ref={dateInputRef}
                        type="date"
                        value={selectedDate}
                        min={todayVn}
                        onChange={(e) => { setSelectedDate(e.target.value); setStep2Error(''); }}
                        required
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-400 transition-colors"
                      />
                      <span className="text-[10px] text-slate-400 block mt-1">
                        Hôm nay: <strong className="text-slate-300 font-mono">{formatDateVi(todayVn)}</strong> (Giờ VN)
                      </span>
                    </div>

                    {/* 2.4. Khung giờ tiếp nhận (Tải động theo cơ sở và lịch trực) */}
                    <div ref={timeSectionRef}>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-teal-400" />
                          <span>Khung giờ tiếp nhận <span className="text-rose-500 font-bold">*</span>:</span>
                        </label>
                        {isSlotsLoading && (
                          <span className="text-[10px] text-purple-300 flex items-center gap-1">
                            <RefreshCw className="w-3 h-3 animate-spin" /> Đang kiểm tra ca...
                          </span>
                        )}
                      </div>

                      {/* Trạng thái 1: Cơ sở không có lịch làm việc ngày này */}
                      {!hasWorkSchedule ? (
                        <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <span>{scheduleNotice || 'Cơ sở không có ca trực / lịch làm việc vào ngày này. Vui lòng chọn ngày khác.'}</span>
                        </div>
                      ) : availableSlots.length === 0 && !isSlotsLoading ? (
                        /* Trạng thái 2: Đã kín lịch hoặc đã qua giờ tiếp nhận */
                        <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <span>Tất cả các khung giờ trong ngày đã kín lịch hoặc đã qua giờ tiếp nhận hôm nay. Vui lòng chọn ngày khác.</span>
                        </div>
                      ) : (
                        /* Trạng thái 3: Hiển thị các khung giờ khả dụng */
                        <div className="flex flex-wrap gap-1.5">
                          {currentFacility.workingHours.map((slot) => {
                            const isAvailable = availableSlots.includes(slot);
                            const isBooked = bookedSlots.includes(slot);
                            const isPast = isPastVnDateTime(selectedDate, slot);
                            const isSelected = selectedTime === slot;

                            let btnStyle = 'bg-slate-900 border border-white/10 text-slate-300 hover:bg-slate-800 cursor-pointer';
                            if (isSelected) {
                              btnStyle = 'bg-teal-500 text-slate-950 font-black shadow-md shadow-teal-500/20 scale-105 cursor-pointer';
                            } else if (!isAvailable) {
                              btnStyle = 'bg-slate-900/40 border border-white/5 text-slate-600 line-through cursor-not-allowed opacity-50';
                            }

                            return (
                              <button
                                key={slot}
                                type="button"
                                disabled={!isAvailable}
                                onClick={() => {
                                  if (isAvailable) {
                                    sound.playClick();
                                    setSelectedTime(slot);
                                    setStep2Error('');
                                  }
                                }}
                                title={!isAvailable ? (isPast ? 'Đã qua giờ' : isBooked ? 'Đã có người đặt' : 'Không khả dụng') : 'Bấm để chọn'}
                                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${btnStyle}`}
                              >
                                {slot}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Lỗi xác thực Bước 2 */}
                  {step2Error && (
                    <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 flex items-center gap-2 text-xs animate-in fade-in">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{step2Error}</span>
                    </div>
                  )}
                </div>
              )}

              {/* ============================================================== */}
              {/* BƯỚC 3: THÔNG TIN LIÊN HỆ, KIỂM TRA VÀ GỬI YÊU CẦU             */}
              {/* ============================================================== */}
              {currentStep === 3 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  
                  {/* 3.1. Thông tin liên hệ chủ nuôi */}
                  <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 space-y-3">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-purple-400" />
                      <span>Thông tin liên hệ xác nhận hẹn:</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                          Họ tên chủ nuôi <span className="text-rose-500 font-bold">*</span>:
                        </label>
                        <input
                          ref={nameInputRef}
                          type="text"
                          value={ownerName}
                          onChange={(e) => { setOwnerName(e.target.value); setNameError(''); setSubmitError(''); }}
                          required
                          placeholder="Ví dụ: Đinh Xuân Mạnh"
                          className={`w-full bg-slate-900 border rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition-colors ${
                            nameError ? 'border-rose-500 focus:border-rose-400 ring-1 ring-rose-500/30' : 'border-white/10 focus:border-purple-400'
                          }`}
                        />
                        {nameError && (
                          <p className="text-[11px] text-rose-400 font-medium mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 shrink-0" /> {nameError}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                          Số điện thoại liên hệ <span className="text-rose-500 font-bold">*</span>:
                        </label>
                        <input
                          ref={phoneInputRef}
                          type="tel"
                          value={phone}
                          onChange={(e) => {
                            setPhone(e.target.value);
                            setPhoneError('');
                            setSubmitError('');
                          }}
                          onBlur={() => {
                            if (phone.trim()) {
                              const check = validateVietnamesePhone(phone);
                              if (!check.isValid) setPhoneError(check.error);
                            }
                          }}
                          placeholder="0912 345 678 hoặc +84 912 345 678"
                          required
                          className={`w-full bg-slate-900 border rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono transition-colors ${
                            phoneError ? 'border-rose-500 focus:border-rose-400 ring-1 ring-rose-500/30' : 'border-white/10 focus:border-purple-400'
                          }`}
                        />
                        {phoneError ? (
                          <p className="text-[11px] text-rose-400 font-medium mt-1 flex items-center gap-1 animate-in fade-in">
                            <AlertCircle className="w-3 h-3 shrink-0" /> {phoneError}
                          </p>
                        ) : (
                          <p className="text-[10px] text-slate-400 mt-1">
                            Định dạng 10 số (bắt đầu bằng 0 hoặc +84).
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 3.2. Thẻ Tóm Tắt Kiểm Tra Trước Khi Gửi (Review Summary Card) */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-950/30 to-indigo-950/30 border border-purple-500/30 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                      <span className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                        <span>Tóm tắt lịch hẹn khám:</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Chờ xác nhận
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Thú cưng:</span>
                        <strong className="text-white">{validPet?.name || 'Chưa chọn'} ({validPet?.species === 'cat' ? 'Mèo' : validPet?.species === 'rabbit' ? 'Thỏ' : 'Chó'})</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Dịch vụ:</span>
                        <strong className="text-white">{selectedService}</strong>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-slate-400 block text-[10px]">Nơi tiếp nhận:</span>
                        <strong className="text-white block">{currentFacility.name}</strong>
                        <span className="text-slate-400 text-[11px] block">{currentFacility.address} - Hotline: {currentFacility.hotline}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Bác sĩ phụ trách:</span>
                        <strong className="text-white">{summaryDoctorName}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Thời gian hẹn:</span>
                        <strong className="text-teal-300">{formatDateVi(selectedDate)} lúc {selectedTime}</strong>
                      </div>
                      {symptomsNote && (
                        <div className="sm:col-span-2 pt-1 border-t border-white/[0.05]">
                          <span className="text-slate-400 block text-[10px]">Ghi chú triệu chứng:</span>
                          <p className="text-slate-300 text-[11px] italic bg-slate-900/60 p-2 rounded-xl mt-0.5 border border-white/5">
                            "{symptomsNote}"
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Thông báo lỗi nếu gửi thất bại */}
                  {submitError && (
                    <div className="p-3.5 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-300 flex items-start gap-2.5 animate-in fade-in">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div className="flex-1 text-xs">
                        <strong className="block font-bold text-rose-200">Không thể gửi yêu cầu:</strong>
                        <span>{submitError}</span>
                        {isAuthExpired && (
                          <div className="mt-2">
                            <span className="text-[11px] text-amber-300 block">
                              Vui lòng mở một tab khác hoặc đăng nhập lại hệ thống rồi quay lại đây bấm thử lại (dữ liệu bạn nhập sẽ không bị mất).
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              )}
            </>
          )}

        </div>

        {/* ==================================================================== */}
        {/* MODAL FOOTER: Cố định ở dưới                                        */}
        {/* ==================================================================== */}
        <div className="p-4 sm:p-5 border-t border-white/[0.08] relative z-20 shrink-0 bg-[#0f1322] flex items-center justify-between gap-3">
          {createdAppointment ? (
            <div className="w-full flex items-center justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
              >
                Đóng Cửa Sổ
              </button>
            </div>
          ) : (
            <>
              {/* Nút Trái: Hủy bỏ (ở Bước 1) hoặc Quay lại (ở Bước 2, 3) */}
              {currentStep === 1 ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-900 border border-white/10 hover:bg-slate-800 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Quay lại</span>
                </button>
              )}

              {/* Nút Phải: Tiếp tục (ở Bước 1, 2) hoặc Gửi yêu cầu đặt khám (ở Bước 3) */}
              {currentStep === 1 && (
                <button
                  type="button"
                  onClick={handleNextStep1}
                  disabled={petsLoading || pets.length === 0}
                  className="px-6 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-md shadow-purple-600/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>Tiếp tục</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              {currentStep === 2 && (
                <button
                  type="button"
                  onClick={handleNextStep2}
                  disabled={!hasWorkSchedule || isSlotsLoading || availableSlots.length === 0}
                  className="px-6 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-md shadow-purple-600/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>Tiếp tục</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              {currentStep === 3 && (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className={`px-6 py-2.5 rounded-xl font-bold text-xs text-white flex items-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    isEmergencySelected
                      ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-rose-600/30'
                      : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/30'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Đang gửi yêu cầu...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Gửi yêu cầu đặt khám</span>
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
};

export default VetBookingModal;
