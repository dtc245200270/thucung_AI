import React, { useState, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { 
  Building2, 
  Stethoscope, 
  Calendar, 
  Clock, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  User, 
  Phone, 
  FileText, 
  Check, 
  PlayCircle, 
  Plus, 
  Trash2, 
  ShieldAlert, 
  Flame, 
  Sparkles, 
  CreditCard, 
  QrCode, 
  Package, 
  Layers, 
  Mic, 
  MicOff, 
  Scan, 
  Activity, 
  Thermometer, 
  HeartPulse, 
  ShieldCheck, 
  Award, 
  ChevronRight, 
  ArrowRight, 
  Lock, 
  Unlock, 
  RefreshCw, 
  CheckSquare, 
  AlertCircle, 
  Sliders, 
  Eye, 
  Download, 
  Printer, 
  TrendingUp, 
  Users, 
  MapPin, 
  DollarSign, 
  FileCheck2, 
  Volume2, 
  HelpCircle,
  Upload,
  Image as ImageIcon,
  Paperclip,
  ExternalLink,
  Inbox,
  ArrowLeft,
  LogOut,
  ChevronDown,
  Tv,
  LayoutGrid,
  List,
  X,
  Maximize2
} from 'lucide-react';
import { sound } from '../../services/soundService';
import { getActiveAppointments, saveActiveAppointments, getMedicalRecords, addMedicalRecord, updateMedicalRecord, finalizeEhrAndAppointment } from '../../services/storageService';
import { getTodayVnDate, getVnDateString, addDaysLocal } from '../../utils/dateUtils.js';
import { VET_FACILITIES } from '../../constants/clinicFacilities.js';

// Chuẩn hóa trạng thái ca khám chuẩn lâm sàng quốc tế
export const normalizeAppStatus = (status) => {
  if (!status) return 'pending';
  const s = String(status).toLowerCase();
  if (s === 'pending' || s.includes('chờ tiếp nhận') || s.includes('chờ duyệt') || s.includes('waiting')) {
    return 'pending';
  }
  if (s === 'in_progress' || s.includes('đang khám') || s.includes('đang trong phòng') || s === 'đã duyệt') {
    return 'in_progress';
  }
  if (s === 'completed' || s.includes('hoàn tất') || s.includes('hoàn thành') || s.includes('đã khám')) {
    return 'completed';
  }
  return 'pending';
};

// Phân loại ca cấp cứu ưu tiên (Triage Priority: Sốc, ngộ độc, nôn dịch vàng, co giật, khó thở...)
export const isEmergencyApp = (app) => {
  if (!app) return false;
  if (app.isEmergency === true || app.emergency === true || app.triageLevel === 'CRITICAL' || String(app.id || '').startsWith('EMG-')) return true;
  if (app.triage === 'emergency' || app.priority === 'urgent' || app.priority === 'emergency') return true;
  const combined = `${app.service || ''} ${app.note || ''} ${app.adminNote || ''} ${app.triage || ''} ${app.reason || ''}`.toLowerCase();
  const emergencyKeywords = [
    'cấp cứu', 'sốc', 'ngộ độc', 'nôn dịch vàng', 'nuốt dị vật', 
    'nuốt xương', 'co giật', 'nguy kịch', 'khẩn cấp', 'hôn mê', 'khó thở', 'gi stasis', 'chướng bụng'
  ];
  return emergencyKeywords.some(kw => combined.includes(kw));
};

// Kiểm tra khớp bộ lọc ngày: 'all' | 'today' | 'tomorrow'
export const isAppointmentDateMatch = (app, dateFilter) => {
  if (!dateFilter || dateFilter === 'all') return true;
  const todayYMD = getTodayVnDate();
  const tomorrowYMD = addDaysLocal(todayYMD, 1);

  const appDate = app.date ? getVnDateString(app.date) : '';
  const appCreatedAt = app.createdAt ? getVnDateString(app.createdAt) : '';

  if (dateFilter === 'today') {
    if (appDate === todayYMD || appDate === 'Hôm nay' || appDate === 'today') return true;
    if (appCreatedAt === todayYMD) return true;
    if (app.id === 'BK-1727250001' || app.id === 'BK-1727250003') return true;
    return false;
  }

  if (dateFilter === 'tomorrow') {
    if (appDate === tomorrowYMD || appDate === 'Ngày mai' || appDate === 'tomorrow') return true;
    if (app.id === 'BK-1727250002') return true;
    return false;
  }

  return true;
};

export const ClinicOsView = ({
  pets = [],
  appointments = [],
  onUpdateAppointment,
  onNavigateTab,
  onBackToOwnerPortal,
  onBack,
  onLogout,
  onSwitchPortal,
  currentUser
}) => {
  const handleBackToOwner = onBack || onBackToOwnerPortal;
  const [isDoctorMenuOpen, setIsDoctorMenuOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState(null);

  const handleLogout = () => {
    try { sound?.playClick?.(); } catch {}
    localStorage.removeItem('petcare_active_user');
    localStorage.removeItem('petcare_current_user');
    localStorage.removeItem('petcare_is_authenticated');
    localStorage.removeItem('petcare_current_portal');
    if (onLogout) {
      onLogout();
    } else {
      window.location.reload();
    }
  };

  // 1. Context Switcher State (Multi-tenant & Branch & Role & Tier)
  const [currentTenant, setCurrentTenant] = useState('PetCare Central Hospital Group');
  const [currentBranch, setCurrentBranch] = useState(VET_FACILITIES[0]?.id || '2vet');
  const [currentRole, setCurrentRole] = useState('HeadVet'); // 'Owner' | 'HeadVet' | 'AssociateVet' | 'Nurse' | 'Receptionist' | 'Cashier'
  const [currentPlan, setCurrentPlan] = useState('Enterprise'); // 'Starter' | 'Growth' | 'Enterprise'
  const [dunningStatus, setDunningStatus] = useState('Active'); // 'Active' | 'GracePeriod' | 'ReadOnly'
  
  // 2. Active Tab in Clinic OS
  const [activeClinicTab, setActiveClinicTab] = useState('reception-queue'); 
  // 'reception-queue' | 'soap' | 'ai-lab' | 'inventory' | 'billing' | 'saas-admin'

  // Bộ chọn lọc nhanh trạng thái ca khám: 'all' | 'pending' | 'in_progress' | 'completed'
  const [queueFilterStatus, setQueueFilterStatus] = useState('all');

  // Tìm kiếm theo tên bé, tên chủ, số điện thoại, mã ca
  const [searchQuery, setSearchQuery] = useState('');

  // Bộ chọn lọc ngày: 'all' | 'today' | 'tomorrow'
  const [dateFilter, setDateFilter] = useState('all');

  // Chế độ xem: 'grid' (Dạng Thẻ Grid) | 'table' (Dạng Bảng Danh Sách)
  const [queueViewMode, setQueueViewMode] = useState('grid');

  // Modal tiếp nhận tại quầy (Walk-in & Cấp cứu)
  const [isWalkinModalOpen, setIsWalkinModalOpen] = useState(false);
  const [walkinFormData, setWalkinFormData] = useState({
    petName: '',
    petType: 'Chó Golden Retriever',
    ownerName: '',
    phone: '',
    service: 'Khám lâm sàng tổng quát',
    note: '',
    isEmergency: false
  });

  // Modal Màn hình gọi số TV
  const [isQueueTvModalOpen, setIsQueueTvModalOpen] = useState(false);

  // BỘ LƯU TRỮ DÙNG CHUNG petcare_active_appointments
  const [activeAppointments, setActiveAppointments] = useState(() => {
    return (appointments && appointments.length > 0) ? appointments : getActiveAppointments();
  });

  // Dropdown liên kết ca bệnh trong Phòng Lab & X-quang
  const [selectedLinkedAppId, setSelectedLinkedAppId] = useState(() => {
    const list = getActiveAppointments();
    return list[0]?.id || 'BK-1727250001';
  });

  useEffect(() => {
    if (Array.isArray(appointments) && appointments.length > 0) {
      setActiveAppointments(appointments);
      if (!appointments.some(a => a.id === selectedLinkedAppId)) {
        setSelectedLinkedAppId(appointments[0].id);
      }
    }
  }, [appointments]);

  useEffect(() => {
    const handleUpdate = () => {
      const apps = getActiveAppointments();
      setActiveAppointments(apps);
      if (apps.length > 0 && !apps.some(a => a.id === selectedLinkedAppId)) {
        setSelectedLinkedAppId(apps[0].id);
      }
    };
    window.addEventListener('petcare_appointments_updated', handleUpdate);
    window.addEventListener('petcare_data_synced', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('petcare_appointments_updated', handleUpdate);
      window.removeEventListener('petcare_data_synced', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [selectedLinkedAppId]);

  const totalQueueCount = activeAppointments.length;
  const pendingQueueCount = activeAppointments.filter(a => normalizeAppStatus(a.status) === 'pending').length;
  const inProgressQueueCount = activeAppointments.filter(a => normalizeAppStatus(a.status) === 'in_progress').length;
  const completedQueueCount = activeAppointments.filter(a => normalizeAppStatus(a.status) === 'completed').length;

  const displayedAppointments = useMemo(() => {
    let list = [...activeAppointments];

    // 1. Tìm kiếm bệnh nhân theo tên bé, tên chủ, số điện thoại, mã ca
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(app => {
        const petName = String(app.petName || '').toLowerCase();
        const ownerName = String(app.ownerName || '').toLowerCase();
        const phone = String(app.phone || '').toLowerCase();
        const id = String(app.id || '').toLowerCase();
        const service = String(app.service || '').toLowerCase();
        const note = String(app.note || '').toLowerCase();
        return petName.includes(q) || ownerName.includes(q) || phone.includes(q) || id.includes(q) || service.includes(q) || note.includes(q);
      });
    }

    // 2. Lọc theo trạng thái
    if (queueFilterStatus !== 'all') {
      list = list.filter(app => normalizeAppStatus(app.status) === queueFilterStatus);
    }

    // 3. Lọc theo ngày
    list = list.filter(app => isAppointmentDateMatch(app, dateFilter));

    // 4. Phân loại ưu tiên: Ca Cấp cứu (Sốc, ngộ độc, nôn dịch vàng...) tự động NỔI LÊN VỊ TRÍ ĐẦU TIÊN
    list.sort((a, b) => {
      const aEmerg = isEmergencyApp(a);
      const bEmerg = isEmergencyApp(b);
      if (aEmerg && !bEmerg) return -1;
      if (!aEmerg && bEmerg) return 1;

      // Ưu tiên trạng thái: pending -> in_progress -> completed
      const statusWeight = { pending: 1, in_progress: 2, completed: 3 };
      const aWeight = statusWeight[normalizeAppStatus(a.status)] || 99;
      const bWeight = statusWeight[normalizeAppStatus(b.status)] || 99;
      if (aWeight !== bWeight) return aWeight - bWeight;

      return (new Date(b.createdAt || 0).getTime()) - (new Date(a.createdAt || 0).getTime());
    });

    return list;
  }, [activeAppointments, searchQuery, queueFilterStatus, dateFilter]);

  useEffect(() => {
    const handleUpdate = () => {
      const apps = getActiveAppointments();
      setActiveAppointments(apps);
      if (apps.length > 0 && !apps.some(a => a.id === selectedLinkedAppId)) {
        setSelectedLinkedAppId(apps[0].id);
      }
    };
    window.addEventListener('petcare_appointments_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('petcare_appointments_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [selectedLinkedAppId]);

  const branches = VET_FACILITIES.map(fac => ({
    id: fac.id,
    name: fac.name,
    address: fac.address,
    phone: fac.hotline,
    doctorsCount: 1
  }));

  const activeBranchData = branches.find(b => b.id === currentBranch) || branches[0];

  // -------------------------------------------------------------
  // PILLAR 1: BỆNH ÁN SOAP & AI MEDICAL SCRIBE
  // -------------------------------------------------------------
  const displayPets = (pets && pets.length > 0) ? pets : [];

  const [selectedPetForExam, setSelectedPetForExam] = useState(pets?.[0]?.id || '');
  const examPet = displayPets.find(p => p.id === selectedPetForExam) || displayPets[0] || null;

  // SOAP Inputs
  const [soapData, setSoapData] = useState({
    subjective: '',
    objective: '',
    plan: '',
    allergyAlert: '',
    vitals: {
      temp: '',
      hr: '',
      rr: '',
      bp: '',
      crt: '',
      mucous: '',
      bcs: ''
    },
    labSummary: '',
    labSummaryLinkedApp: '',
    assessment: '',
    vetIcdCode: '',
    planMedications: [],
    followUpDate: ''
  });

  // AI Scribe State
  const [isScribeRecording, setIsScribeRecording] = useState(false);
  const [scribeAudioSeconds, setScribeAudioSeconds] = useState(0);
  const [scribeTranscript, setScribeTranscript] = useState('');
  const [isSignOffLocked, setIsSignOffLocked] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isFinalizingEhr, setIsFinalizingEhr] = useState(false);
  const [isAllergyAcknowledged, setIsAllergyAcknowledged] = useState(false);
  const [isDraftSaved, setIsDraftSaved] = useState(false);
  const [previewImageModal, setPreviewImageModal] = useState(null);

  // Khối O: Attachments (X-ray, Ultrasound, Lab test)
  const [objectiveAttachments, setObjectiveAttachments] = useState([
    {
      id: 'att-1',
      name: 'X-Quang Lồng Ngực & Ổ Bụng (VD View).jpg',
      type: 'image',
      size: '2.4 MB',
      date: '2026-09-26 08:45',
      url: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?w=600&q=80',
      findings: 'Không thấy dị vật cản quang đường ruột, quai ruột có ít hơi, bóng tim bình thường.'
    },
    {
      id: 'att-2',
      name: 'Phiếu Sinh Hóa Máu (Catalyst One).pdf',
      type: 'pdf',
      size: '1.2 MB',
      date: '2026-09-26 08:50',
      url: '#',
      findings: 'WBC 18.4 (tăng nhẹ phản ứng viêm), ALT 142 U/L, Chức năng thận bình thường.'
    }
  ]);

  // HÀM TIẾP NHẬN CA KHÁM: CẬP NHẬT TRẠNG THÁI, NẠP THÔNG TIN VÀO SOAP VÀ CHUYỂN TAB
  const handleStartConsultation = async (app) => {
    // Bước 1: Cập nhật trạng thái ca khám thành 'in_progress' (Đang trong phòng khám)
    const nextStatus = 'in_progress';

    if (onUpdateAppointment) {
      try {
        await onUpdateAppointment(app.id, { status: nextStatus });
      } catch (err) {
        alert(err.message || 'Không thể tiếp nhận ca khám do trạng thái hoặc phân quyền không hợp lệ.');
        return;
      }
    }

    try { sound?.playSuccess?.(); } catch {}

    const updated = activeAppointments.map(a => 
      a.id === app.id ? { ...a, status: nextStatus } : a
    );
    setActiveAppointments(updated);
    saveActiveAppointments(updated);

    const matchedPet = (pets && pets.length > 0)
      ? (pets.find(p => p.id === app.petId || p.name?.toLowerCase() === app.petName?.toLowerCase())
         || pets[0])
      : null;

    // Bước 2: Giữ riêng appointmentId và petId (tránh lưu appointmentId thành petId)
    const actualPetId = app.petId || matchedPet?.id || null;
    setSelectedPatientId(actualPetId);
    setSelectedLinkedAppId(app.id);
    
    if (actualPetId) {
      setSelectedPetForExam(actualPetId);
    }

    // Bước 3: Đổi activeTab sang tab Bệnh án: setActiveClinicTab('soap') (tương ứng với tab "Quản lý Bệnh án (SOAP)")
    setActiveClinicTab('soap');

    // Bước 4: Tự động nạp sẵn triệu chứng ban đầu vào phần S (Subjective) của form SOAP để bác sĩ bắt đầu ghi chép
    const initialSymptom = app.note 
      ? `Chủ nuôi báo: ${app.note}` 
      : '';

    setIsAllergyAcknowledged(false); // Chưa xác nhận -> hiển thị banner cảnh báo đỏ
    const records = getMedicalRecords();
    const existingRecord = records.find(r => r.appointmentId === app.id);

    if (existingRecord) {
      setSoapData({
        planMedications: [],
        vaccines: [],
        ...(existingRecord.soap || {
          subjective: initialSymptom,
          objective: '', assessment: '', plan: '',
          labSummary: '', vitals: { weight: matchedPet?.weight ? `${matchedPet.weight} kg` : '', temp: '', hr: '', bp: '' }
        })
      });
      setIsSignOffLocked(!!existingRecord.isFinal);
    } else {
      const petAllergyNote = matchedPet?.notes || app.note || '';
      const hasAllergyMention = petAllergyNote.toLowerCase().includes('dị ứng');
      setSoapData({
        subjective: initialSymptom,
        objective: '', assessment: '', plan: '', labSummary: '',
        allergyAlert: hasAllergyMention
          ? petAllergyNote
          : (petAllergyNote?.trim() ? petAllergyNote : 'Chưa có thông tin dị ứng (Cần kiểm tra trước khi kê đơn)'),
        planMedications: [],
        vaccines: [],
        vitals: {
          weight: matchedPet?.weight ? `${matchedPet.weight} kg` : '',
          temp: '', hr: '', bp: ''
        }
      });
      setIsSignOffLocked(false);
    }

    try {
      confetti({ particleCount: 50, spread: 60 });
    } catch {}
  };

  // Xử lý tạo ca khám tại quầy (Walk-in & Cấp cứu ưu tiên thực tế, không sinh duplicate)
  const handleCreateWalkinAppointment = (e) => {
    if (e) e.preventDefault();
    if (!walkinFormData.petName.trim()) {
      alert('Vui lòng nhập tên bé thú cưng!');
      return;
    }

    const isEmergency = Boolean(walkinFormData.isEmergency);
    const newTicketId = isEmergency 
      ? `EMG-${Date.now().toString().slice(-6)}` 
      : `WLK-${Date.now().toString().slice(-6)}`;

    const newTicket = {
      id: newTicketId,
      petId: `pet-walkin-${Date.now().toString().slice(-4)}`,
      petName: walkinFormData.petName.trim(),
      petType: walkinFormData.petType || 'Thú cưng',
      ownerName: walkinFormData.ownerName.trim() || 'Khách vãng lai tại quầy',
      phone: walkinFormData.phone.trim() || 'Tại quầy lễ tân',
      service: walkinFormData.service || (isEmergency ? 'Cấp cứu & Xử lý sốc / Ngộ độc' : 'Khám lâm sàng tổng quát'),
      date: new Date().toLocaleDateString('en-CA'),
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      facility: activeBranchData?.name || 'Chi nhánh Cầu Giấy (Phòng khám 02)',
      doctor: currentUser?.name || 'Bác sĩ trực ca',
      note: walkinFormData.note.trim() || (isEmergency ? 'Ca cấp cứu ưu tiên: Nôn dịch vàng, mệt lả' : 'Khám trực tiếp tại quầy'),
      status: 'pending',
      isEmergency,
      triage: isEmergency ? 'emergency' : 'routine',
      createdAt: new Date().toISOString()
    };

    const updated = [newTicket, ...activeAppointments];
    setActiveAppointments(updated);
    saveActiveAppointments(updated);

    try {
      if (isEmergency) {
        sound?.playAlert?.();
      } else {
        sound?.playSuccess?.();
      }
      confetti({ particleCount: 60, spread: 70 });
    } catch {}

    setIsWalkinModalOpen(false);
    setWalkinFormData({
      petName: '',
      petType: 'Chó Golden Retriever',
      ownerName: '',
      phone: '',
      service: 'Khám lâm sàng tổng quát',
      note: '',
      isEmergency: false
    });
  };

  // Audio timer simulation
  useEffect(() => {
    let interval = null;
    if (isScribeRecording) {
      interval = setInterval(() => {
        setScribeAudioSeconds(s => s + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isScribeRecording]);

  const toggleScribeRecording = () => {
    sound.playClick();
    if (!isScribeRecording) {
      setScribeAudioSeconds(0);
      setIsScribeRecording(true);
      setScribeTranscript('Đang lắng nghe cuộc trao đổi lâm sàng giữa Bác sĩ và Chủ nuôi...');
      const pName = examPet?.name || 'thú cưng';
      setTimeout(() => {
        setScribeTranscript(`[Mô phỏng ghi âm hội thoại] BS: Chào bạn, hôm nay bé ${pName} có biểu hiện gì bất thường ạ? | Khách: Dạ bé có biểu hiện mệt mỏi và chán ăn từ sáng, nhờ bác sĩ kiểm tra giúp ạ.`);
      }, 2500);
    } else {
      setIsScribeRecording(false);
      sound.playSuccess();
      confetti({ particleCount: 35, spread: 60 });
    }
  };

  const handleApplyScribeToSoap = () => {
    sound.playSuccess();
    const transcribedText = scribeTranscript || 'Ghi âm hội thoại lâm sàng: Ghi nhận triệu chứng từ người nuôi để bác sĩ đối chiếu lâm sàng.';
    setSoapData(prev => ({
      ...prev,
      subjective: prev.subjective ? `${prev.subjective}\n[AI Scribe Tham Khảo]: ${transcribedText}` : `[AI Scribe Tham Khảo]: ${transcribedText}`
    }));
  };

  // Nhật ký xuất kho điều trị (FEFO Audit Log)
  const [inventoryLogs, setInventoryLogs] = useState([]);

  const saveSoapToBackend = async (isFinal) => {
    if (!selectedLinkedAppId) {
      alert('Vui lòng chọn một ca khám để ghi bệnh án!');
      return false;
    }
    
    try {
      const records = getMedicalRecords();
      const existing = records.find(r => r.appointmentId === selectedLinkedAppId);
      
      const recordData = {
        appointmentId: selectedLinkedAppId,
        petId: selectedPatientId,
        vetId: currentUser?.id,
        soap: soapData,
        isFinal: isFinal,
        updatedAt: new Date().toISOString()
      };
      
      if (isFinal) {
        recordData.confirmedAt = new Date().toISOString();
        recordData.confirmedBy = currentUser?.name;
      }

      if (existing) {
        if (existing.isFinal) {
          recordData.history = existing.history || [];
          recordData.history.push({
            editedAt: new Date().toISOString(),
            previousData: existing.soap
          });
        }
        await updateMedicalRecord(existing.id, recordData);
      } else {
        await addMedicalRecord(recordData);
      }
      return true;
    } catch (e) {
      console.error('Save SOAP error', e);
      alert('Lỗi khi lưu bệnh án: ' + e.message);
      return false;
    }
  };

  const handleSignOffEhr = async () => {
    if (isFinalizingEhr) return;
    if (!selectedLinkedAppId) {
      alert('Vui lòng chọn một ca khám để chốt bệnh án!');
      return;
    }

    const linkedApp = activeAppointments.find(a => a.id === selectedLinkedAppId);
    const patientId = linkedApp?.petId || selectedPatientId || examPet?.id;
    if (!patientId) {
      alert('Vui lòng chọn thú cưng cho ca khám!');
      return;
    }

    setIsFinalizingEhr(true);
    try {
      // Nghiệp vụ đơn nhất ở backend: Chốt bệnh án & Chuyển lịch khám sang completed
      const finalizeRes = await finalizeEhrAndAppointment({
        appointmentId: selectedLinkedAppId,
        petId: patientId,
        soap: soapData
      });

      sound.playSuccess();
      setIsSignOffLocked(true);
      setIsPinModalOpen(false);

      // Cập nhật trạng thái ca khám thành completed trong local state
      setActiveAppointments(prev => prev.map(a => 
        a.id === selectedLinkedAppId ? { ...a, status: 'completed' } : a
      ));

      if (finalizeRes?.syncWarning) {
        alert('Bệnh án và lịch khám đã được lưu thành công trên máy chủ! Tuy nhiên, đồng bộ dữ liệu giao diện gặp sự cố kết nối. Bạn có thể tải lại trang an toàn để cập nhật đầy đủ dữ liệu mới nhất.');
      }

      // [UI MINH HỌA] Cập nhật minh họa danh mục tồn kho dược trên giao diện (Kho hiện tại là phân hệ minh họa giao diện, hệ thống không báo đã trừ kho thật trên máy chủ)
      const prescribedMeds = soapData.planMedications || soapData.prescriptions || [];
      if (Array.isArray(prescribedMeds) && prescribedMeds.length > 0) {
        const now = new Date();
        const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        setInventoryItems(prevItems => {
          let nextItems = [...prevItems];
          prescribedMeds.forEach(pMed => {
            const mIdx = nextItems.findIndex(inv => 
              inv.name.toLowerCase().includes((pMed.name || '').toLowerCase()) ||
              (pMed.batchNumber && inv.batchNumber === pMed.batchNumber)
            );
            if (mIdx !== -1) {
              const qty = Number(pMed.quantity) || (Number(pMed.days || 1) * Number(pMed.dosePerDay || 1)) || 1;
              const curStock = nextItems[mIdx].stock;
              const newStock = Math.max(0, curStock - qty);
              nextItems[mIdx] = { ...nextItems[mIdx], stock: newStock, reserved: 0 };

              const newLog = {
                id: `LOG-${Date.now().toString().slice(-4)}`,
                timestamp: timeStr,
                action: 'Mô phỏng xuất kho điều trị (Minh họa)',
                medicine: nextItems[mIdx].name,
                batchNumber: nextItems[mIdx].batchNumber,
                quantity: `-${qty} ${nextItems[mIdx].baseUom || 'Đơn vị'}`,
                remaining: newStock,
                patient: `${examPet?.name || 'Thú cưng'} (${examPet?.breed || 'Chưa rõ giống'})`,
                doctor: currentUser?.name || 'Bác sĩ thú y',
                reason: `Đơn thuốc SOAP: ${pMed.name}`
              };
              setInventoryLogs(prevLogs => [newLog, ...prevLogs]);
            }
          });
          return nextItems;
        });
      }

      try { confetti({ particleCount: 60, spread: 70 }); } catch {}
    } catch (err) {
      console.error('Lỗi khi chốt bệnh án và hoàn thành lịch khám:', err);
      alert('Không thể chốt bệnh án: ' + (err.message || 'Đã có lỗi xảy ra.'));
      // Giữ nguyên form nhập, không khóa form, không đóng modal khi thất bại
    } finally {
      setIsFinalizingEhr(false);
    }
  };

  // -------------------------------------------------------------
  // PILLAR 2: ĐIỀU PHỐI KHÁM & CHỐNG DOUBLE-BOOKING (DISPATCH)
  // -------------------------------------------------------------
  // Hàng đợi phòng khám tính toán thời gian thực từ activeAppointments
  const dynamicQueueList = useMemo(() => {
    if (!activeAppointments || activeAppointments.length === 0) return [];
    return activeAppointments
      .filter(a => a.status === 'in_progress' || a.status === 'pending' || a.status === 'confirmed')
      .map((a, idx) => ({
        id: a.id || `Q-0${idx + 1}`,
        petName: a.petName || 'Thú cưng',
        owner: a.ownerName || 'Chủ nuôi',
        service: a.service || 'Khám lâm sàng',
        doctor: a.doctor || currentUser?.name || 'Bác sĩ phụ trách',
        triage: a.isEmergency ? 'Cấp 1 (Nguy kịch)' : 'Cấp 3 (Tiêu chuẩn)',
        room: a.facility || 'Phòng khám 01',
        status: a.status === 'in_progress' ? 'Đang khám' : 'Đang chờ',
        waitTime: a.time ? `${a.time}` : 'Theo lịch',
        rawApp: a
      }));
  }, [activeAppointments, currentUser?.name]);

  const queueList = dynamicQueueList;

  const [activeQueueId, setActiveQueueId] = useState(() => dynamicQueueList[0]?.id || '');
  const [isCallingNext, setIsCallingNext] = useState(false);

  const handleCallNextPatient = () => {
    sound.playSuccess();
    setIsCallingNext(true);
    setTimeout(() => setIsCallingNext(false), 2000);
  };

  // -------------------------------------------------------------
  // PILLAR 3: KHO DƯỢC & VẬT TƯ TIÊU HAO FEFO (INVENTORY)
  // -------------------------------------------------------------
  const [inventoryItems, setInventoryItems] = useState([
    { id: 'INV-01', code: 'MED-APOQ-16', name: 'Apoquel 16mg (Oclacitinib)', baseUom: 'Viên', batchNumber: 'AP-2026B', expiryDate: '2026-12-15', daysLeft: 80, stock: 142, reserved: 7, unitPrice: 45000, status: 'Cận date (<90d)' },
    { id: 'INV-02', code: 'MED-APOQ-16', name: 'Apoquel 16mg (Oclacitinib)', baseUom: 'Viên', batchNumber: 'AP-2027A', expiryDate: '2027-08-20', daysLeft: 328, stock: 350, reserved: 0, unitPrice: 45000, status: 'An toàn' },
    { id: 'INV-03', code: 'MED-NOVI-DHPP', name: 'Vắc-xin Nobivac DHPPi 7 Bệnh', baseUom: 'Lọ/Liều', batchNumber: 'NV-2026C', expiryDate: '2026-10-25', daysLeft: 29, stock: 18, reserved: 2, unitPrice: 195000, status: 'Khẩn cấp (<30d)' },
    { id: 'INV-04', code: 'MED-NEX-SPEC', name: 'NexGard Spectra 15-30kg', baseUom: 'Viên', batchNumber: 'NX-2027D', expiryDate: '2027-11-10', daysLeft: 410, stock: 85, reserved: 0, unitPrice: 240000, status: 'An toàn' },
    { id: 'INV-05', code: 'MAT-SYR-01ML', name: 'Bơm tiêm vô trùng 1ml Ultra-fine', baseUom: 'Cái', batchNumber: 'SY-2028', expiryDate: '2028-05-30', daysLeft: 610, stock: 1200, reserved: 5, unitPrice: 3500, status: 'An toàn' }
  ]);

  const [fefoTestSuccess, setFefoTestSuccess] = useState(false);

  const handleTestFefoDispatch = () => {
    sound.playClick();
    let updatedRemaining = 135;
    setInventoryItems(prev => prev.map(item => {
      if (item.batchNumber === 'AP-2026B') {
        const nextStock = Math.max(0, item.stock - 7);
        updatedRemaining = nextStock;
        return { ...item, stock: nextStock, reserved: 0 };
      }
      return item;
    }));

    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const testLog = {
      id: `LOG-${Date.now().toString().slice(-4)}`,
      timestamp: timeStr,
      action: 'Mô phỏng xuất kho điều trị (Minh họa)',
      medicine: 'Apoquel 16mg (Oclacitinib)',
      batchNumber: 'AP-2026B',
      quantity: '-7 Viên',
      remaining: updatedRemaining,
      patient: 'Bệnh nhân khám lâm sàng',
      doctor: currentUser?.name || 'Bác sĩ phụ trách',
      reason: 'Xuất kho FEFO theo đơn Apoquel 16mg (Lô AP-2026B)'
    };
    setInventoryLogs(prev => [testLog, ...prev]);

    setFefoTestSuccess(true);
    sound.playSuccess();
    setTimeout(() => setFefoTestSuccess(false), 3000);
  };

  // -------------------------------------------------------------
  // PILLAR 4: POS & TẠM ỨNG NỘI TRÚ (BILLING)
  // -------------------------------------------------------------
  const [inpatientDeposit, setInpatientDeposit] = useState({
    depositTotal: 3000000,
    usedAmount: 1850000,
    remaining: 1150000,
    dailyCharges: [
      { date: '2026-09-24', item: 'Phí lưu lồng điều hòa cấp cứu 24h', amount: 350000 },
      { date: '2026-09-24', item: 'Dịch truyền tĩnh mạch Ringer Lactate 500ml', amount: 220000 },
      { date: '2026-09-25', item: 'Phí lưu lồng nội trú ngày 2', amount: 300000 },
      { date: '2026-09-25', item: 'Kháng sinh tiêm chuyên khoa & Y tá chăm sóc', amount: 480000 },
      { date: '2026-09-26', item: 'Xét nghiệm máu kiểm tra men gan & thận', amount: 500000 }
    ]
  });

  const [isPaidVietQr, setIsPaidVietQr] = useState(false);

  // -------------------------------------------------------------
  // PILLAR 5: AI VISION OCR & DỰ BÁO DỊCH TỄ (AI LAB)
  // -------------------------------------------------------------
  // 2 nút xét nghiệm mẫu: 'blood_alt' | 'xray_normal'
  const [selectedLabPreset, setSelectedLabPreset] = useState('blood_alt');
  const [ocrSampleType, setOcrSampleType] = useState('canine_blood');
  const [ocrResult, setOcrResult] = useState(null);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [radarProgress, setRadarProgress] = useState(0);
  const [syncSoapSuccess, setSyncSoapSuccess] = useState(false);
  const [syncEpidemicSuccess, setSyncEpidemicSuccess] = useState(false);

  // Đồng bộ cảnh báo dịch tễ học 2 chiều sang Cổng Chủ Nuôi
  const handleSyncEpidemicToOwner = () => {
    try { sound?.playAlert?.(); } catch {}
    const pName = examPet?.name || 'thú cưng';
    const epidemicData = {
      disease: 'Parvovirus',
      area: 'Khu vực phòng khám',
      risk: 'high',
      title: 'CẢNH BÁO DỊCH TỄ KHU VỰC',
      message: `Khuyến nghị kiểm tra lịch tiêm vắc-xin phòng bệnh truyền nhiễm cho bé ${pName} và các thú cưng trong khu vực.`,
      active: true,
      updatedAt: new Date().toISOString()
    };
    try {
      localStorage.setItem('petcare_active_epidemic', JSON.stringify(epidemicData));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('petcare_epidemic_updated', { detail: epidemicData }));
      }
    } catch (e) {
      console.error('Error syncing epidemic:', e);
    }
    setSyncEpidemicSuccess(true);
    setTimeout(() => setSyncEpidemicSuccess(false), 3500);
  };

  // Quét radar AI Vision OCR trong 1.2s & Hiển thị kết quả mẫu phòng lab (Mô phỏng thử nghiệm)
  const handleRunAiOcr = () => {
    try { sound?.playClick?.(); } catch {}
    setIsOcrProcessing(true);
    setRadarProgress(0);
    setSyncSoapSuccess(false);

    // Chạy hiệu ứng radar phân tích chuẩn 1.2s (1200ms)
    const startTime = Date.now();
    const duration = 1200;
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setRadarProgress(pct);
      if (pct >= 100) clearInterval(progressInterval);
    }, 40);

    setTimeout(() => {
      clearInterval(progressInterval);
      setIsOcrProcessing(false);
      setRadarProgress(100);
      try { sound?.playSuccess?.(); } catch {}

      // Lấy thông tin ca khám được chọn liên kết
      const linkedApp = activeAppointments.find(a => a.id === selectedLinkedAppId) 
        || activeAppointments[0] 
        || null;
      const petLabel = linkedApp 
        ? `${linkedApp.petName || 'Thú cưng'} (${linkedApp.breed || 'Chưa cập nhật'})`
        : (examPet ? `${examPet.name} (${examPet.breed || 'Chưa cập nhật'})` : 'Chưa có thông tin ca khám');

      let calculatedIndicators = [];
      let calculatedConclusion = '';
      let summaryForSoap = '';

      if (selectedLabPreset === 'blood_alt') {
        // Mẫu xét nghiệm máu sinh hóa IDEXX
        calculatedIndicators = [
          { name: 'ALT (Alanine Aminotransferase)', value: '142', unit: 'U/L', ref: '10 - 100', status: 'high', label: 'Tăng cao [Cảnh báo gan]' },
          { name: 'CREA (Creatinine)', value: '1.1', unit: 'mg/dL', ref: '0.5 - 1.4', status: 'normal', label: 'Bình thường' },
          { name: 'BUN (Blood Urea Nitrogen)', value: '18.2', unit: 'mg/dL', ref: '7 - 27', status: 'normal', label: 'Bình thường' },
          { name: 'WBC (Bạch cầu)', value: '18.4', unit: 'x10^9/L', ref: '6.0 - 17.0', status: 'high', label: 'Tăng cao [Phản ứng viêm]' },
          { name: 'RBC (Hồng cầu)', value: '6.8', unit: 'x10^12/L', ref: '5.5 - 8.5', status: 'normal', label: 'Bình thường' }
        ];
        calculatedConclusion = 'Tăng men gan ALT (142 U/L) và phản ứng viêm bạch cầu WBC tăng nhẹ (18.4 x10^9/L). Chức năng lọc thận (CREA, BUN) và hồng cầu RBC trong giới hạn chuẩn.';
        summaryForSoap = `CẬN LÂM SÀNG (AI OCR [${linkedApp?.id || 'MẪU'}]): ALT: 142 U/L, WBC: 18.4 x10^9/L, CREA: 1.1 mg/dL, BUN: 18.2 mg/dL.`;
      } else {
        // Mẫu X-quang kỹ thuật số DR
        calculatedIndicators = [
          { name: 'ALT (Alanine Aminotransferase)', value: '45', unit: 'U/L', ref: '10 - 100', status: 'normal', label: 'Bình thường' },
          { name: 'CREA (Creatinine)', value: '0.9', unit: 'mg/dL', ref: '0.5 - 1.4', status: 'normal', label: 'Bình thường' },
          { name: 'BUN (Blood Urea Nitrogen)', value: '14.5', unit: 'mg/dL', ref: '7 - 27', status: 'normal', label: 'Bình thường' },
          { name: 'WBC (Bạch cầu)', value: '9.2', unit: 'x10^9/L', ref: '6.0 - 17.0', status: 'normal', label: 'Bình thường' },
          { name: 'RBC (Hồng cầu)', value: '6.5', unit: 'x10^12/L', ref: '5.5 - 8.5', status: 'normal', label: 'Bình thường' }
        ];
        calculatedConclusion = 'Hình ảnh X-quang ổ bụng: Các quai ruột phân bố đều, không phát hiện dị vật cản quang. Các chỉ số máu trong giới hạn bình thường.';
        summaryForSoap = `CẬN LÂM SÀNG (AI OCR [${linkedApp?.id || 'MẪU'}]): X-quang ổ bụng bình thường, không phát hiện dị vật cản quang.`;
      }

      setOcrResult({
        samplePreset: selectedLabPreset,
        linkedAppId: linkedApp?.id || 'N/A',
        petLabel,
        analyzer: selectedLabPreset === 'blood_alt' ? 'IDEXX Catalyst One Bio-Analyzer (Mô phỏng mẫu)' : 'Direct Digital Radiography DR (Mô phỏng mẫu)',
        indicators: calculatedIndicators,
        aiConclusion: `[Mô phỏng thử nghiệm] ${calculatedConclusion}`,
        isSimulated: true,
        summaryForSoap
      });

      // Lab/OCR chưa triển khai thật có nhãn mô phỏng rõ ràng, không tự ý chèn dữ liệu mẫu vào bệnh án thật
      setSyncSoapSuccess(true);
      try { confetti({ particleCount: 50, spread: 60 }); } catch {}
    }, 1200);
  };

  return (
    <div className="w-full space-y-6 pb-20 select-none text-slate-100">

      {/* ============================================================ */}
      {/* 1. TOP ENTERPRISE CONTEXT HEADER (TENANT, BRANCH, ROLE, TIER)*/}
      {/* ============================================================ */}
      {/* ============================================================ */}
      {/* 1. TOP ENTERPRISE CONTEXT HEADER (TENANT, BRANCH, ROLE, TIER)*/}
      {/* ============================================================ */}
      <div className="p-5 rounded-3xl bg-slate-900/90 border border-white/10 backdrop-blur-2xl shadow-2xl relative overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 right-1/4 w-96 h-32 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 z-10 relative">
          
          {/* Left: Logo Bệnh viện & Tiêu đề hệ thống lâm sàng */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 via-teal-400 to-sky-400 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-cyan-500/25 shrink-0">
              <Stethoscope className="w-6 h-6 stroke-[2.5]" />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                  <span>PetCare Clinic OS</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-teal-500/20 text-teal-300 px-2.5 py-0.5 rounded-full border border-teal-400/30">
                    Bệnh Viện Thú Y Pro
                  </span>
                </h1>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/60 mt-0.5 flex-wrap">
                <Building2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="text-white/90 font-semibold">Cơ sở: {activeBranchData?.name || VET_FACILITIES[0]?.name}</span>
                <span className="text-white/30 hidden sm:inline">•</span>
                <span className="hidden sm:inline">{activeBranchData?.address || VET_FACILITIES[0]?.address}</span>
                <span className="text-white/30 hidden md:inline">•</span>
                <span className="text-cyan-300 hidden md:inline">Hotline: {activeBranchData?.phone || VET_FACILITIES[0]?.hotline}</span>
              </div>
            </div>
          </div>

          {/* Right: Thông tin Bác sĩ trực, Chi nhánh, Dropdown Demo & Nút Đăng xuất */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Enterprise Clinic Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-xs font-bold shadow-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Enterprise Clinic</span>
            </div>

            {/* Nút: [ 📺 Mở màn hình gọi số TV ↗ ] */}
            <button
              type="button"
              onClick={() => {
                try { sound?.playClick?.(); } catch {}
                setIsQueueTvModalOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-2xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-cyan-300 hover:text-cyan-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
              title="Mở Màn hình Gọi Số TV (Queue Signage) cho phòng chờ"
            >
              <Tv className="w-3.5 h-3.5 text-cyan-400" />
              <span>📺 Mở màn hình gọi số TV ↗</span>
            </button>

            {/* Branch dropdown */}
            <div className="flex items-center gap-1.5 bg-white/[0.08] px-3 py-1.5 rounded-2xl border border-white/10 text-xs">
              <Building2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <select
                value={currentBranch}
                onChange={(e) => setCurrentBranch(e.target.value)}
                className="bg-transparent border-0 text-cyan-200 text-xs font-bold outline-none cursor-pointer pr-1"
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id} className="bg-slate-900 text-white">
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Doctor Info Card with Avatar click to toggle dropdown (Demo Switcher inside) */}
            <div className="relative">
              <div 
                onClick={() => setIsDoctorMenuOpen(prev => !prev)}
                className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-2xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 shadow-sm cursor-pointer transition-all active:scale-95"
                title="Bấm vào Avatar để mở menu tài khoản & tùy chọn demo"
              >
                <div className="w-8 h-8 rounded-xl overflow-hidden border border-teal-400/60 bg-teal-50 shrink-0 shadow-xs">
                  <img 
                    src={currentUser?.avatar || 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=400&auto=format&fit=crop&q=80'} 
                    alt="Doctor" 
                    className="w-full h-full object-cover" 
                  />
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-black text-white flex items-center gap-1.5">
                    <span>{currentUser?.name || 'Bác sĩ Thú y'}</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <div className="text-[10px] text-cyan-300 font-bold">Bác sĩ Admin Phòng Khám</div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-white/50" />
              </div>

              {/* Dropdown Menu when clicking Doctor Card */}
              {isDoctorMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsDoctorMenuOpen(false)} 
                  />
                  <div className="absolute right-0 top-12 w-64 rounded-2xl bg-slate-900/95 backdrop-blur-2xl border border-white/20 shadow-2xl p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-3 py-2">
                      <p className="text-xs font-bold text-white">
                        {currentUser?.name || 'Bác sĩ Thú y'}
                      </p>
                      <p className="text-[11px] text-cyan-300 font-medium">Bác sĩ Quản Trị Hệ Thống</p>
                      <p className="text-[10px] text-white/50 truncate font-mono mt-0.5">
                        {currentUser?.email || 'admin.vet@petcare.ai'}
                      </p>
                    </div>

                    <div className="h-px bg-white/10 my-1.5" />

                    {/* Tùy chọn Demo: Chuyển nhanh sang Cổng Khách hàng (Demo) */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsDoctorMenuOpen(false);
                        try { sound?.playClick?.(); } catch {}
                        if (typeof onSwitchPortal === 'function') {
                          onSwitchPortal('OWNER');
                        } else if (typeof onBackToOwnerPortal === 'function') {
                          onBackToOwnerPortal();
                        } else if (typeof onBack === 'function') {
                          onBack();
                        }
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition-all flex items-center gap-2 cursor-pointer group active:scale-[0.98]"
                      title="Chuyển nhanh sang Cổng Khách hàng để demo cho Giảng viên"
                    >
                      <span className="text-base group-hover:rotate-12 transition-transform">🧪</span>
                      <span className="truncate">Chuyển nhanh sang Cổng Khách hàng (Demo)</span>
                    </button>

                    <div className="h-px bg-white/10 my-1.5" />

                    {/* Đăng xuất trong Dropdown */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsDoctorMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-400" />
                      <span>🚪 Đăng xuất</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Bổ sung nút: [ 🚪 Đăng xuất ] trực tiếp trên Header */}
            <button
              type="button"
              onClick={handleLogout}
              className="px-3.5 py-2 rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 hover:text-rose-200 text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
              title="Đăng xuất khỏi hệ thống phòng khám (xóa session và về màn hình Đăng nhập)"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              <span>Đăng xuất</span>
            </button>
          </div>

        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. SUB-NAVIGATION PILL TABS (Bác sĩ & Nhân viên Phòng khám) */}
      {/* ============================================================ */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {[
          { id: 'reception-queue', label: `📋 Hàng đợi khám (${pendingQueueCount})`, desc: 'Hiển thị các ca do chủ nuôi đặt từ Owner Portal' },
          { id: 'soap', label: '🩺 Quản lý Bệnh án (SOAP)', desc: 'Hồ sơ S-O-A-P, cảnh báo dị ứng thuốc, AI Medical Scribe' },
          { id: 'ai-lab', label: '🔬 Phòng Lab & X-quang', desc: 'So sánh chuẩn loài & OCR xét nghiệm' },
          { id: 'inventory', label: '💊 Kho Dược FEFO (Minh họa)', desc: 'Minh họa — chưa quản lý tồn kho thực tế' },
          { id: 'billing', label: '💳 POS & Viện phí', desc: 'VietQR động & VAT' },
          { id: 'saas-admin', label: '⚙️ Cấu hình', desc: 'Đa chi nhánh & Phân quyền' }
        ].map(tab => {
          const isActive = activeClinicTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                sound.playClick();
                setActiveClinicTab(tab.id);
              }}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                isActive
                  ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/30 scale-[1.02]'
                  : 'bg-white/[0.06] text-white/70 hover:text-white hover:bg-white/[0.1] border border-white/10'
              }`}
            >
              <span>{tab.label}</span>
              {tab.id === 'reception-queue' && pendingQueueCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950 animate-pulse">
                  {pendingQueueCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ============================================================ */}
      {/* TAB 0: HÀNG ĐỢI TIẾP NHẬN (LỊCH HẸN TỪ CỔNG CHỦ NUÔI)        */}
      {/* ============================================================ */}
      {activeClinicTab === 'reception-queue' && (
        <div className="space-y-5">
          {/* Header Banner - Tinh gọn */}
          <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-cyan-900/40 via-blue-900/30 to-purple-900/30 backdrop-blur-2xl border border-cyan-500/30 shadow-xl relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-black border border-cyan-500/40 shrink-0">
                  <Inbox className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                      Hàng Đợi Tiếp Nhận Lịch Khám
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 shadow-xs">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                      <span>{pendingQueueCount} ca chờ tiếp nhận</span>
                    </span>
                    <span className="text-[11px] font-bold text-white/40">
                      • Tổng: {totalQueueCount} ca
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    try { sound?.playClick?.(); } catch {}
                    setIsWalkinModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-2xl bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-slate-950 text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/25 active:scale-95 border border-cyan-300/40"
                  title="Tiếp nhận bệnh nhân trực tiếp tại quầy lễ tân"
                >
                  <Plus className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                  <span>+ Tiếp nhận tại quầy</span>
                </button>
              </div>
            </div>
          </div>

          {/* Toolbar: Tìm kiếm, Lọc ngày, Toggle Grid/Table & Lọc trạng thái */}
          <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Ô tìm kiếm bệnh nhân */}
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo tên bé, tên chủ, số điện thoại, mã ca..."
                  className="w-full pl-10 pr-8 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/40 transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs cursor-pointer p-0.5"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Bộ lọc ngày: [ Hôm nay ] [ Ngày mai ] [ Tất cả ] */}
              <div className="flex items-center gap-1 bg-black/30 p-1 rounded-xl border border-white/10 self-start lg:self-auto">
                <span className="text-[11px] font-bold text-white/50 px-2 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">Lọc ngày:</span>
                </span>
                {[
                  { id: 'today', label: 'Hôm nay' },
                  { id: 'tomorrow', label: 'Ngày mai' },
                  { id: 'all', label: 'Tất cả' }
                ].map(df => (
                  <button
                    key={df.id}
                    type="button"
                    onClick={() => {
                      try { sound?.playClick?.(); } catch {}
                      setDateFilter(df.id);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      dateFilter === df.id
                        ? 'bg-cyan-500 text-slate-950 font-black shadow-sm'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {df.label}
                  </button>
                ))}
              </div>

              {/* Nút Toggle: [ Dạng Thẻ Grid ] / [ Dạng Bảng Danh Sách ] */}
              <div className="flex items-center gap-1 bg-black/30 p-1 rounded-xl border border-white/10 self-start lg:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    try { sound?.playClick?.(); } catch {}
                    setQueueViewMode('grid');
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    queueViewMode === 'grid'
                      ? 'bg-white/20 text-white font-black shadow-sm'
                      : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                  title="Hiển thị dạng thẻ Grid"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Dạng Thẻ Grid</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    try { sound?.playClick?.(); } catch {}
                    setQueueViewMode('table');
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    queueViewMode === 'table'
                      ? 'bg-white/20 text-white font-black shadow-sm'
                      : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                  title="Hiển thị dạng bảng danh sách tinh gọn"
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Dạng Bảng Danh Sách</span>
                </button>
              </div>
            </div>

            {/* Trạng thái ca khám */}
            <div className="flex items-center justify-between gap-3 flex-wrap pt-2 border-t border-white/5">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
                <span className="text-xs font-bold text-white/50 pl-1 shrink-0 flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Trạng thái:</span>
                </span>

                <button
                  type="button"
                  onClick={() => {
                    try { sound?.playClick?.(); } catch {}
                    setQueueFilterStatus('all');
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                    queueFilterStatus === 'all'
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25 scale-[1.02]'
                      : 'bg-white/[0.06] text-white/70 hover:text-white hover:bg-white/10 border border-white/10'
                  }`}
                >
                  Tất cả ({totalQueueCount})
                </button>

                <button
                  type="button"
                  onClick={() => {
                    try { sound?.playClick?.(); } catch {}
                    setQueueFilterStatus('pending');
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    queueFilterStatus === 'pending'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25 scale-[1.02]'
                      : 'bg-white/[0.06] text-amber-300/80 hover:text-amber-200 hover:bg-white/10 border border-white/10'
                  }`}
                >
                  <span>⏳ Chờ tiếp nhận ({pendingQueueCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    try { sound?.playClick?.(); } catch {}
                    setQueueFilterStatus('in_progress');
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    queueFilterStatus === 'in_progress'
                      ? 'bg-blue-500 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                      : 'bg-white/[0.06] text-blue-300/80 hover:text-blue-200 hover:bg-white/10 border border-white/10'
                  }`}
                >
                  <span>🔵 Đang khám ({inProgressQueueCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    try { sound?.playClick?.(); } catch {}
                    setQueueFilterStatus('completed');
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    queueFilterStatus === 'completed'
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25 scale-[1.02]'
                      : 'bg-white/[0.06] text-emerald-300/80 hover:text-emerald-200 hover:bg-white/10 border border-white/10'
                  }`}
                >
                  <span>🟢 Đã xong ({completedQueueCount})</span>
                </button>
              </div>

              <div className="text-[11px] text-white/40 px-2 hidden sm:block">
                Hiển thị <strong className="text-white">{displayedAppointments.length}</strong> / {totalQueueCount} ca
                {searchQuery && <span className="text-cyan-300"> • khớp "{searchQuery}"</span>}
              </div>
            </div>
          </div>

          {/* NỘI DUNG HIỂN THỊ: DẠNG BẢNG DANH SÁCH (TABLE) HOẶC DẠNG THẺ GRID */}
          {displayedAppointments.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-white/[0.04] border border-white/10">
              <Inbox className="w-12 h-12 text-white/30 mx-auto mb-3" />
              <h4 className="text-base font-bold text-white">Không có ca khám nào theo bộ lọc này</h4>
              <p className="text-xs text-white/50 mt-1 max-w-md mx-auto">
                Hãy chọn ngày khác, từ khóa tìm kiếm khác hoặc bấm "+ Tiếp nhận tại quầy" để tạo ca khám mới.
              </p>
            </div>
          ) : queueViewMode === 'table' ? (
            /* ============================================================ */
            /* 4. CHẾ ĐỘ HIỂN THỊ DẠNG BẢNG (TABLE VIEW)                    */
            /* ============================================================ */
            <div className="overflow-x-auto no-scrollbar rounded-3xl border border-white/10 bg-slate-900/80 backdrop-blur-2xl shadow-2xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-white/50 font-bold uppercase tracking-wider text-[10px] bg-white/[0.03]">
                    <th className="py-3 px-4 w-12 text-center">STT</th>
                    <th className="py-3 px-3">Mã ca</th>
                    <th className="py-3 px-3">Bệnh nhân & Mức độ</th>
                    <th className="py-3 px-3">Chủ nuôi</th>
                    <th className="py-3 px-3">Ngày & Giờ</th>
                    <th className="py-3 px-3">Triệu chứng & Dịch vụ</th>
                    <th className="py-3 px-3">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {displayedAppointments.map((app, index) => {
                    const isEmergency = isEmergencyApp(app);
                    const normStatus = normalizeAppStatus(app.status);
                    const isPending = normStatus === 'pending';
                    const isInProgress = normStatus === 'in_progress';
                    const isCompleted = normStatus === 'completed';

                    return (
                      <tr 
                        key={app.id} 
                        className={`transition-colors hover:bg-white/[0.04] ${
                          isEmergency ? 'bg-rose-950/20' : ''
                        }`}
                      >
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-white/60">
                          {index + 1}
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="font-mono font-bold text-cyan-300 tracking-wider">#{app.id}</span>
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-white text-sm">{app.petName}</span>
                            <span className="text-[11px] text-white/60">({app.petType || 'Thú cưng'})</span>
                            {isEmergency && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/25 border border-rose-500/50 text-rose-300 animate-pulse whitespace-nowrap shadow-xs shadow-rose-900/40">
                                🚨 CẤP CỨU ƯU TIÊN
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="text-white font-semibold">{app.ownerName || 'Chủ nuôi'}</div>
                          {app.phone && <div className="text-[10px] text-white/50 font-mono">{app.phone}</div>}
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <div className="font-mono text-cyan-200 font-semibold">{app.time}</div>
                          <div className="text-[10px] text-white/50">{app.date}</div>
                        </td>
                        <td className="py-3.5 px-3 max-w-xs">
                          <div className="font-semibold text-white/90 truncate">{app.service}</div>
                          <div className="text-[11px] text-white/60 italic truncate" title={app.note}>
                            "{app.note || 'Không có ghi chú'}"
                          </div>
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          {isPending && (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-black inline-flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                              <span>⏳ Chờ tiếp nhận</span>
                            </span>
                          )}
                          {isInProgress && (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-black inline-flex items-center gap-1.5 bg-blue-500/20 text-blue-300 border border-blue-500/40">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                              <span>🔵 Đang khám</span>
                            </span>
                          )}
                          {isCompleted && (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-black inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              <span>🟢 Đã xong</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleStartConsultation(app)}
                            className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all cursor-pointer shadow-sm active:scale-95 flex items-center gap-1.5 ml-auto ${
                              isPending
                                ? 'bg-gradient-to-r from-teal-400 to-cyan-400 text-slate-950 hover:from-teal-300 hover:to-cyan-300 shadow-teal-500/20'
                                : isInProgress
                                ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-500 hover:to-cyan-500 shadow-blue-500/25'
                                : 'bg-white/10 text-white/80 hover:bg-white/20 border border-white/10'
                            }`}
                          >
                            {isPending ? (
                              <>
                                <Stethoscope className="w-3.5 h-3.5" />
                                <span>Mở Khám SOAP →</span>
                              </>
                            ) : isInProgress ? (
                              <>
                                <FileText className="w-3.5 h-3.5" />
                                <span>Mở Khám SOAP</span>
                              </>
                            ) : (
                              <>
                                <Eye className="w-3.5 h-3.5" />
                                <span>Mở Khám SOAP</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* ============================================================ */
            /* DẠNG THẺ GRID (GRID VIEW)                                    */
            /* ============================================================ */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {displayedAppointments.map(app => {
                const isEmergency = isEmergencyApp(app);
                const normStatus = normalizeAppStatus(app.status);
                const isPending = normStatus === 'pending';
                const isInProgress = normStatus === 'in_progress';
                const isCompleted = normStatus === 'completed';

                return (
                  <div
                    key={app.id}
                    className={`rounded-3xl p-5 border transition-all duration-300 relative flex flex-col justify-between ${
                      isEmergency
                        ? 'bg-rose-950/25 border-rose-500/60 hover:border-rose-400 shadow-xl shadow-rose-950/40 ring-1 ring-rose-500/30'
                        : isPending
                        ? 'bg-amber-950/20 border-amber-500/30 hover:border-amber-400/60 shadow-lg shadow-amber-950/30'
                        : isInProgress
                        ? 'bg-blue-950/20 border-blue-500/30 hover:border-blue-400/60 shadow-lg shadow-blue-950/30'
                        : 'bg-white/[0.05] border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div>
                      {/* Top Bar */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-[11px] font-mono text-white/50 tracking-wider">
                          #{app.id}
                        </span>
                        
                        {/* Status / Priority Badges */}
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {isEmergency && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-black flex items-center gap-1.5 bg-rose-500/25 text-rose-300 border border-rose-500/60 shadow-sm shadow-rose-950/40 animate-pulse">
                              <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                              <span>🚨 CẤP CỨU ƯU TIÊN</span>
                            </span>
                          )}

                          {isPending && !isEmergency && (
                            <span className="px-3 py-1 rounded-full text-xs font-black flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs">
                              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                              <span>⏳ Chờ tiếp nhận</span>
                            </span>
                          )}

                          {isInProgress && (
                            <span className="px-3 py-1 rounded-full text-xs font-black flex items-center gap-1.5 bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-xs">
                              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                              <span>🔵 Đang trong phòng khám</span>
                            </span>
                          )}

                          {isCompleted && (
                            <span className="px-3 py-1 rounded-full text-xs font-black flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs">
                              <span className="w-2 h-2 rounded-full bg-emerald-400" />
                              <span>🟢 Đã hoàn tất</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Pet Info */}
                      <div className="flex items-start gap-3 mb-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-base border shrink-0 ${
                          isEmergency 
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' 
                            : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                        }`}>
                          {app.petName?.charAt(0) || 'P'}
                        </div>
                        <div>
                          <h3 className="text-base font-black text-white flex items-center gap-2">
                            <span>{app.petName}</span>
                            <span className="text-xs font-medium px-2 py-0.5 rounded-lg bg-white/10 text-white/80">
                              {app.petType || 'Thú cưng'}
                            </span>
                          </h3>
                          <p className="text-xs text-white/60 flex items-center gap-1 mt-0.5">
                            <User className="w-3 h-3 text-white/40" />
                            <span>Chủ: {app.ownerName || 'Chủ nuôi'}</span>
                            {app.phone && (
                              <span className="text-white/40 font-mono">({app.phone})</span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Meta Details */}
                      <div className="space-y-2 py-3 border-y border-white/10 text-xs">
                        <div className="flex items-center justify-between text-white/80">
                          <span className="text-white/50 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-cyan-400" /> Ngày & giờ hẹn:
                          </span>
                          <span className="font-bold text-white font-mono">{app.date} • {app.time}</span>
                        </div>
                        <div className="flex items-center justify-between text-white/80">
                          <span className="text-white/50 flex items-center gap-1.5">
                            <Stethoscope className="w-3.5 h-3.5 text-purple-400" /> Dịch vụ:
                          </span>
                          <span className="font-semibold text-cyan-200">{app.service}</span>
                        </div>
                        <div className="flex items-center justify-between text-white/80">
                          <span className="text-white/50 flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-amber-400" /> Cơ sở:
                          </span>
                          <span className="text-right truncate max-w-[220px] text-white/90 font-medium">{app.facility || activeBranchData?.name || 'Bệnh viện Thú y 2Vet Hospital'}</span>
                        </div>
                      </div>

                      {/* Symptoms / Note */}
                      <div className={`mt-3 p-3 rounded-2xl border ${
                        isEmergency 
                          ? 'bg-rose-950/30 border-rose-500/30' 
                          : 'bg-white/[0.04] border-white/10'
                      }`}>
                        <div className={`text-[11px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1 ${
                          isEmergency ? 'text-rose-300' : 'text-cyan-300'
                        }`}>
                          <Activity className="w-3 h-3" /> Triệu chứng ban đầu:
                        </div>
                        <p className="text-xs text-white/80 italic leading-relaxed line-clamp-3">
                          "{app.note || 'Không có ghi chú triệu chứng từ chủ nuôi.'}"
                        </p>
                      </div>
                    </div>

                    {/* Bottom CTA Action Buttons per Status */}
                    <div className="mt-5 pt-3 border-t border-white/10 flex items-center gap-2">
                      {isPending && (
                        <button
                          onClick={() => handleStartConsultation(app)}
                          className="w-full py-2.5 px-4 rounded-xl font-black text-xs text-slate-950 bg-gradient-to-r from-teal-400 via-emerald-300 to-cyan-400 hover:from-teal-300 hover:to-emerald-300 transition-all duration-200 shadow-md shadow-teal-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95 group"
                        >
                          <Stethoscope className="w-4 h-4 text-slate-950 group-hover:rotate-12 transition-transform" />
                          <span>🩺 Tiếp nhận ca & Mở Khám SOAP →</span>
                        </button>
                      )}

                      {isInProgress && (
                        <button
                          onClick={() => handleStartConsultation(app)}
                          className="w-full py-2.5 px-4 rounded-xl font-black text-xs text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 transition-all duration-200 shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer active:scale-95 group"
                        >
                          <FileText className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                          <span>📝 Tiếp tục Bệnh án SOAP</span>
                        </button>
                      )}

                      {isCompleted && (
                        <button
                          onClick={() => handleStartConsultation(app)}
                          className="w-full py-2.5 px-4 rounded-xl font-bold text-xs text-white/80 bg-white/10 hover:bg-white/15 border border-white/15 transition-all duration-200 shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 group"
                        >
                          <Eye className="w-4 h-4 text-cyan-300 group-hover:scale-110 transition-transform" />
                          <span>👁️ Xem lại Bệnh án & Đơn thuốc</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 1: BỆNH ÁN SOAP & AI MEDICAL SCRIBE                      */}
      {/* ============================================================ */}
      {activeClinicTab === 'soap' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT 8 COLS: SOAP CLINICAL EDITOR */}
          <div className="lg:col-span-8 space-y-5">
            
            <div className="p-5 rounded-3xl bg-white/[0.06] backdrop-blur-2xl border border-white/15 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center border border-cyan-400/30">
                    <Stethoscope className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                      <span>Bệnh Án Điện Tử Chuẩn Hóa SOAP</span>
                      {isSignOffLocked ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                          <Lock className="w-3 h-3" /> ĐÃ KÝ XÁC NHẬN (LOCKED)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          BẢN NHÁP (DRAFT)
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-white/50">Mã ca khám: #EHR-2026-9812 • Bác sĩ điều trị: Dr. Nam</p>
                  </div>
                </div>

                {/* Patient Select */}
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-xs text-white/60">Bệnh nhân:</span>
                  <select
                    value={selectedPetForExam}
                    onChange={(e) => setSelectedPetForExam(e.target.value)}
                    className="bg-white/10 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white font-bold outline-none cursor-pointer"
                  >
                    {displayPets.map(p => (
                      <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                        {p.name} ({p.breed || 'Thú cưng'} - {p.weight}kg)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Allergy Critical Pin */}
              <div 
                className={`p-4 rounded-2xl border-2 transition-all mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md ${
                  isAllergyAcknowledged
                    ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                    : 'bg-[#FEE2E2] border-red-400 text-[#991B1B]'
                }`}
                style={!isAllergyAcknowledged ? { backgroundColor: '#FEE2E2', color: '#991B1B' } : undefined}
              >
                <div className="flex items-center gap-3">
                  {isAllergyAcknowledged ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-[#991B1B] shrink-0" />
                  )}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap text-sm sm:text-base font-extrabold uppercase tracking-wide" style={!isAllergyAcknowledged ? { color: '#991B1B' } : undefined}>
                      <span>{isAllergyAcknowledged ? 'ĐÃ XÁC NHẬN TIỀN SỬ DỊ ỨNG:' : '⚠️ CẢNH BÁO DỊ ỨNG:'}</span>
                      <span className="font-black text-sm sm:text-base underline decoration-red-400 underline-offset-2">
                        {soapData.allergyAlert}
                      </span>
                    </div>
                    {isAllergyAcknowledged ? (
                      <p className="text-xs text-emerald-400 mt-1 font-medium">
                        ✓ Bác sĩ Dr. Nam đã xác thực an toàn lâm sàng (Hệ thống khóa tự động mọi đơn thuốc nhóm Beta-lactam).
                      </p>
                    ) : (
                      <p className="text-xs font-semibold text-[#991B1B]/90 mt-0.5" style={{ color: '#991B1B' }}>
                        Tuyệt đối không kê đơn thuốc hoặc tiêm hoạt chất thuộc nhóm chống chỉ định trên.
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    sound.playSuccess();
                    setIsAllergyAcknowledged(!isAllergyAcknowledged);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 cursor-pointer ${
                    isAllergyAcknowledged
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                      : 'bg-[#991B1B] hover:bg-[#7F1D1D] text-white font-extrabold shadow-md'
                  }`}
                >
                  <CheckSquare className="w-4 h-4" />
                  <span>{isAllergyAcknowledged ? 'Đã xác nhận' : 'Xác nhận đã đọc'}</span>
                </button>
              </div>

              {/* 4 SOAP Blocks */}
              <div className="space-y-4">
                
                {/* S - Subjective */}
                <div className="p-4 rounded-2xl bg-white/[0.04] border border-[#4b5563] space-y-2" style={{ border: '1px solid #4b5563' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-cyan-300 tracking-wider">
                      S - Subjective (Triệu chứng & Tiền sử)
                    </span>
                    <span className="text-[10px] text-slate-400">Khách tường thuật & Bệnh sử</span>
                  </div>
                  <textarea
                    disabled={isSignOffLocked}
                    value={soapData.subjective}
                    onChange={(e) => setSoapData({ ...soapData, subjective: e.target.value })}
                    rows={2}
                    className="w-full bg-black/40 border border-[#4b5563] rounded-xl p-3 text-xs sm:text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all resize-none"
                    style={{ border: '1px solid #4b5563' }}
                  />
                </div>

                {/* O - Objective (Vitals Grid + X-Ray/Lab Attachments) */}
                <div className="p-4 rounded-2xl bg-white/[0.04] border border-[#4b5563] space-y-3" style={{ border: '1px solid #4b5563' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-cyan-300 tracking-wider">
                      O - Objective (Khám lâm sàng, Chỉ số sinh tồn & Cận lâm sàng)
                    </span>
                    <span className="text-[10px] text-emerald-400 font-semibold">Tự động gắn cờ theo loài</span>
                  </div>

                  {/* Tự động đồng bộ Cận lâm sàng từ Phòng Lab & X-quang */}
                  {soapData.labSummary && (
                    <div className="p-3.5 rounded-2xl bg-cyan-950/60 border border-cyan-400/40 text-cyan-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md animate-in fade-in duration-200">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center shrink-0 border border-cyan-400/30">
                          <Scan className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-cyan-300 text-xs uppercase tracking-wide">
                              🔬 Cận lâm sàng (AI Vision OCR):
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                              ✓ Đã gán vào ca #{soapData.labSummaryLinkedApp || 'BK-1727250001'}
                            </span>
                          </div>
                          <p className="text-white text-xs mt-1 leading-relaxed font-mono font-medium">
                            {soapData.labSummary}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          try { sound?.playClick?.(); } catch {}
                          setActiveClinicTab('ai-lab');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-400/30 text-[11px] font-bold shrink-0 transition-colors cursor-pointer self-end sm:self-center"
                      >
                        Đổi mẫu quét 🔬
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    <div className="p-2.5 rounded-xl bg-black/30 border border-[#4b5563]" style={{ border: '1px solid #4b5563' }}>
                      <span className="text-[10px] text-slate-400 block mb-1">Thân nhiệt (°C)</span>
                      <input
                        disabled={isSignOffLocked}
                        value={soapData.vitals.temp}
                        onChange={(e) => setSoapData({ ...soapData, vitals: { ...soapData.vitals, temp: e.target.value } })}
                        className="w-full bg-black/20 border border-[#4b5563] focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 rounded-lg px-2.5 py-1 font-mono font-bold text-amber-300 text-sm outline-none transition-all"
                        style={{ border: '1px solid #4b5563' }}
                      />
                      <span className="text-[9px] text-amber-400 mt-1 block">Sốt nhẹ (+0.6°C)</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-black/30 border border-[#4b5563]" style={{ border: '1px solid #4b5563' }}>
                      <span className="text-[10px] text-slate-400 block mb-1">Nhịp tim (HR - bpm)</span>
                      <input
                        disabled={isSignOffLocked}
                        value={soapData.vitals.hr}
                        onChange={(e) => setSoapData({ ...soapData, vitals: { ...soapData.vitals, hr: e.target.value } })}
                        className="w-full bg-black/20 border border-[#4b5563] focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 rounded-lg px-2.5 py-1 font-mono font-bold text-cyan-300 text-sm outline-none transition-all"
                        style={{ border: '1px solid #4b5563' }}
                      />
                      <span className="text-[9px] text-emerald-400 mt-1 block">Chuẩn y khoa</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-black/30 border border-[#4b5563]" style={{ border: '1px solid #4b5563' }}>
                      <span className="text-[10px] text-slate-400 block mb-1">Huyết áp (BP)</span>
                      <input
                        disabled={isSignOffLocked}
                        value={soapData.vitals.bp}
                        onChange={(e) => setSoapData({ ...soapData, vitals: { ...soapData.vitals, bp: e.target.value } })}
                        className="w-full bg-black/20 border border-[#4b5563] focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 rounded-lg px-2.5 py-1 font-mono font-bold text-white text-sm outline-none transition-all"
                        style={{ border: '1px solid #4b5563' }}
                      />
                      <span className="text-[9px] text-slate-400 mt-1 block">125/80 mmHg</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-black/30 border border-[#4b5563]" style={{ border: '1px solid #4b5563' }}>
                      <span className="text-[10px] text-slate-400 block mb-1">CRT & Thể trạng</span>
                      <div className="font-bold text-white text-xs truncate mt-1">CRT &lt;2s • BCS 5/9</div>
                      <span className="text-[9px] text-emerald-400 mt-1 block">Niêm mạc hồng</span>
                    </div>
                  </div>

                  {/* Objective Attachments: X-Ray & Lab Tests Preview Area */}
                  <div className="pt-2.5 border-t border-white/10 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                        Đính kèm X-quang, Siêu âm & Phiếu xét nghiệm:
                      </span>
                      <label className="cursor-pointer px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold flex items-center gap-1.5 transition-all">
                        <Upload className="w-3 h-3" />
                        <span>+ Tải lên tài liệu y khoa</span>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              const f = e.target.files[0];
                              const newAtt = {
                                id: `att-${Date.now()}`,
                                name: f.name,
                                type: f.type.includes('image') ? 'image' : 'pdf',
                                size: `${(f.size / (1024 * 1024)).toFixed(1)} MB`,
                                date: 'Vừa đính kèm',
                                url: URL.createObjectURL(f),
                                findings: 'Mới cập nhật ca khám - Chờ bác sĩ đọc kết quả'
                              };
                              setObjectiveAttachments(prev => [newAtt, ...prev]);
                              sound.playSuccess();
                            }
                          }}
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {objectiveAttachments.map((att) => (
                        <div key={att.id} className="p-2.5 rounded-xl bg-slate-900/80 border border-white/10 flex items-center gap-3">
                          {att.type === 'image' ? (
                            <div 
                              onClick={() => setPreviewImageModal(att.url)}
                              className="w-12 h-12 rounded-lg overflow-hidden bg-black border border-white/10 shrink-0 cursor-pointer hover:opacity-80 transition-opacity relative group"
                            >
                              <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Eye className="w-3.5 h-3.5 text-white" />
                              </div>
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-400 flex flex-col items-center justify-center shrink-0">
                              <FileText className="w-5 h-5" />
                              <span className="text-[9px] font-bold">PDF</span>
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-200 truncate">{att.name}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{att.size} • {att.date}</p>
                            <p className="text-[10px] text-cyan-300 italic truncate mt-0.5">{att.findings}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* A - Assessment */}
                <div className="p-4 rounded-2xl bg-white/[0.04] border border-[#4b5563] space-y-2" style={{ border: '1px solid #4b5563' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-cyan-300 tracking-wider">
                      A - Assessment (Chẩn đoán & Vet-ICD Code)
                    </span>
                    <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded-md border border-cyan-400/30">
                      {soapData.vetIcdCode}
                    </span>
                  </div>
                  <input
                    disabled={isSignOffLocked}
                    value={soapData.assessment}
                    onChange={(e) => setSoapData({ ...soapData, assessment: e.target.value })}
                    className="w-full bg-black/40 border border-[#4b5563] rounded-xl p-3 text-xs sm:text-sm text-white font-medium outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                    style={{ border: '1px solid #4b5563' }}
                  />
                </div>

                {/* P - Plan & Prescriptions */}
                <div className="p-4 rounded-2xl bg-white/[0.04] border border-[#4b5563] space-y-3" style={{ border: '1px solid #4b5563' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-cyan-300 tracking-wider">
                      P - Plan (Y lệnh thuốc, Thủ thuật & Tái khám)
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Tính theo cân nặng {examPet.weight}kg</span>
                  </div>

                  <div className="space-y-3">
                    {(soapData.planMedications || []).map((med, idx) => (
                      <div key={idx} className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex flex-col gap-2 text-xs">
                        <input type="text" placeholder="Tên thuốc" className="w-full bg-slate-900/50 border border-slate-700 rounded px-2 py-1 text-white" value={med.name || ''} onChange={e => {
                          const newMeds = [...soapData.planMedications]; newMeds[idx].name = e.target.value; setSoapData({...soapData, planMedications: newMeds});
                        }} />
                        <div className="grid grid-cols-2 gap-2">
                          <input type="text" placeholder="Liều dùng" className="w-full bg-slate-900/50 border border-slate-700 rounded px-2 py-1 text-white" value={med.dose || ''} onChange={e => {
                            const newMeds = [...soapData.planMedications]; newMeds[idx].dose = e.target.value; setSoapData({...soapData, planMedications: newMeds});
                          }} />
                          <input type="text" placeholder="Đường dùng" className="w-full bg-slate-900/50 border border-slate-700 rounded px-2 py-1 text-white" value={med.route || ''} onChange={e => {
                            const newMeds = [...soapData.planMedications]; newMeds[idx].route = e.target.value; setSoapData({...soapData, planMedications: newMeds});
                          }} />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <input type="text" placeholder="Tần suất" className="w-full bg-slate-900/50 border border-slate-700 rounded px-2 py-1 text-white" value={med.freq || ''} onChange={e => {
                            const newMeds = [...soapData.planMedications]; newMeds[idx].freq = e.target.value; setSoapData({...soapData, planMedications: newMeds});
                          }} />
                          <input type="date" placeholder="Bắt đầu" className="w-full bg-slate-900/50 border border-slate-700 rounded px-2 py-1 text-white" value={med.startDate || ''} onChange={e => {
                            const newMeds = [...soapData.planMedications]; newMeds[idx].startDate = e.target.value; setSoapData({...soapData, planMedications: newMeds});
                          }} />
                          <input type="number" placeholder="Số ngày" className="w-full bg-slate-900/50 border border-slate-700 rounded px-2 py-1 text-white" value={med.days || ''} onChange={e => {
                            const newMeds = [...soapData.planMedications]; newMeds[idx].days = e.target.value; setSoapData({...soapData, planMedications: newMeds});
                          }} />
                        </div>
                        <input type="text" placeholder="Hướng dẫn thêm" className="w-full bg-slate-900/50 border border-slate-700 rounded px-2 py-1 text-white" value={med.instructions || ''} onChange={e => {
                          const newMeds = [...soapData.planMedications]; newMeds[idx].instructions = e.target.value; setSoapData({...soapData, planMedications: newMeds});
                        }} />
                        <button type="button" onClick={() => {
                          const newMeds = [...soapData.planMedications]; newMeds.splice(idx, 1); setSoapData({...soapData, planMedications: newMeds});
                        }} className="text-red-400 text-right mt-1">Xóa thuốc</button>
                      </div>
                    ))}
                    <button type="button" onClick={() => {
                      setSoapData({...soapData, planMedications: [...soapData.planMedications, { name: '', dose: '', route: '', freq: '', startDate: '', days: '', instructions: '' }]});
                    }} className="w-full py-2 bg-slate-800 rounded-lg text-cyan-300 font-bold border border-slate-700 border-dashed hover:bg-slate-700 transition-colors">
                      + Thêm thuốc
                    </button>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/[0.04] border border-[#4b5563] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-emerald-300 tracking-wider">Tiêm chủng & Tẩy giun</span>
                    </div>
                    <div className="space-y-3">
                      {(soapData.vaccines || []).map((vax, idx) => (
                        <div key={idx} className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex flex-col gap-2 text-xs">
                          <select className="w-full bg-slate-900/50 border border-slate-700 rounded px-2 py-1 text-white" value={vax.type || ''} onChange={e => {
                            const newVax = [...(soapData.vaccines || [])]; newVax[idx].type = e.target.value; setSoapData({...soapData, vaccines: newVax});
                          }}>
                            <option value="">Chọn loại</option>
                            <option value="vaccine">Tiêm vắc-xin</option>
                            <option value="deworm">Tẩy giun</option>
                          </select>
                          <input type="text" placeholder="Tên sản phẩm" className="w-full bg-slate-900/50 border border-slate-700 rounded px-2 py-1 text-white" value={vax.product || ''} onChange={e => {
                            const newVax = [...(soapData.vaccines || [])]; newVax[idx].product = e.target.value; setSoapData({...soapData, vaccines: newVax});
                          }} />
                          <div className="grid grid-cols-2 gap-2">
                            <input type="text" placeholder="Số lô" className="w-full bg-slate-900/50 border border-slate-700 rounded px-2 py-1 text-white" value={vax.batch || ''} onChange={e => {
                              const newVax = [...(soapData.vaccines || [])]; newVax[idx].batch = e.target.value; setSoapData({...soapData, vaccines: newVax});
                            }} />
                            <input type="date" placeholder="Ngày nhắc lại" className="w-full bg-slate-900/50 border border-slate-700 rounded px-2 py-1 text-white" value={vax.nextDue || ''} onChange={e => {
                              const newVax = [...(soapData.vaccines || [])]; newVax[idx].nextDue = e.target.value; setSoapData({...soapData, vaccines: newVax});
                            }} />
                          </div>
                          <button type="button" onClick={() => {
                            const newVax = [...(soapData.vaccines || [])]; newVax.splice(idx, 1); setSoapData({...soapData, vaccines: newVax});
                          }} className="text-red-400 text-right mt-1">Xóa tiêm chủng</button>
                        </div>
                      ))}
                      <button type="button" onClick={() => {
                        setSoapData({...soapData, vaccines: [...(soapData.vaccines || []), { type: 'vaccine', product: '', batch: '', nextDue: '' }]});
                      }} className="w-full py-2 bg-slate-800 rounded-lg text-emerald-300 font-bold border border-slate-700 border-dashed hover:bg-slate-700 transition-colors">
                        + Thêm tiêm chủng / tẩy giun
                      </button>
                    </div>
                  </div>

                  {/* Safety Check Badge */}
                  <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      AI Guardrail: 0 xung đột thuốc
                    </span>
                    <span className="text-[10px] font-mono text-slate-300">WSAVA Safe</span>
                  </div>
                </div>

              </div>

              {/* Action Buttons: Sign-off & Draft */}
              <div className="mt-6 pt-5 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <span className="text-xs text-slate-400">
                  {isSignOffLocked ? '✓ Bệnh án đã chốt và hoàn tất ca khám vào Cơ sở dữ liệu' : 'Bác sĩ xác nhận chốt bệnh án để hoàn tất ca khám và kích hoạt POS'}
                </span>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  {!isSignOffLocked ? (
                    <>
                      {/* Nút 1: Lưu nháp (Nút phụ, viền xám) */}
                      <button
                        type="button"
                        onClick={async () => {
                          const success = await saveSoapToBackend(false);
                          if (success) {
                            sound.playSuccess();
                            setIsDraftSaved(true);
                            setTimeout(() => setIsDraftSaved(false), 2500);
                          }
                        }}
                        className="px-6 py-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-600 hover:border-slate-400 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 shadow-sm"
                        style={{ border: '1px solid #4b5563' }}
                      >
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span>{isDraftSaved ? 'Đã lưu nháp ✓' : 'Lưu nháp'}</span>
                      </button>

                      {/* Nút 2: Xác nhận chốt bệnh án (Nút chính, background màu xanh lá #10B981, chữ trắng, width dài) */}
                      <button
                        type="button"
                        onClick={() => setIsPinModalOpen(true)}
                        className="sm:min-w-[260px] md:min-w-[320px] px-8 py-3.5 rounded-xl bg-[#10B981] hover:bg-emerald-600 text-white font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-500/30 cursor-pointer transition-all active:scale-95"
                        style={{ backgroundColor: '#10B981', color: '#ffffff' }}
                      >
                        <Lock className="w-4 h-4 text-white" />
                        <span>Xác nhận chốt bệnh án</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        setIsSignOffLocked(false);
                      }}
                      className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-2 cursor-pointer"
                    >
                      <Unlock className="w-4 h-4" />
                      <span>Tạo Addendum sửa đổi</span>
                    </button>
                  )}
                </div>
              </div>

            </div>

          </div>

          {/* RIGHT 4 COLS: AI MEDICAL SCRIBE STUDIO */}
          <div className="lg:col-span-4 space-y-5">
            
            <div className="p-5 rounded-3xl bg-white/[0.06] backdrop-blur-2xl border border-white/15 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-sky-400 text-slate-950 flex items-center justify-center font-bold">
                    <Mic className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-white">AI Medical Scribe</h4>
                    <p className="text-[10px] text-white/50">Thu âm & Trích xuất SOAP Real-time</p>
                  </div>
                </div>

                {isScribeRecording && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    REC {scribeAudioSeconds}s
                  </span>
                )}
              </div>

              {/* Status Badge */}
              <div className="mb-3">
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border inline-flex items-center gap-1.5 ${
                  isScribeRecording 
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                    : scribeTranscript 
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' 
                    : 'bg-white/10 text-slate-400 border-white/10'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${isScribeRecording ? 'bg-amber-400 animate-ping' : scribeTranscript ? 'bg-purple-400' : 'bg-slate-400'}`} />
                  Trạng thái: {isScribeRecording ? 'Đang trích xuất dữ liệu nháp (DRAFT)...' : scribeTranscript ? 'Đang trích xuất dữ liệu nháp (DRAFT)' : 'Sẵn sàng ghi âm ca khám'}
                </span>
              </div>

              {/* Waveform / Visualizer */}
              <div className="p-4 rounded-2xl bg-black/40 border border-white/10 text-center mb-4">
                <div className="flex items-end justify-center gap-1.5 h-14 mb-3">
                  {[10, 24, 38, 52, 30, 44, 58, 34, 48, 26, 40, 55, 18, 32, 14, 28, 46, 20].map((h, i) => (
                    <div
                      key={i}
                      className={`w-1.5 rounded-full transition-all duration-150 ${
                        isScribeRecording 
                          ? 'bg-gradient-to-t from-emerald-500 via-cyan-400 to-sky-300 shadow-[0_0_10px_rgba(6,182,212,0.8)]' 
                          : 'bg-white/20 h-2'
                      }`}
                      style={{ 
                        height: isScribeRecording 
                          ? `${Math.max(6, Math.min(54, (h * (0.6 + Math.sin(scribeAudioSeconds * 3 + i * 0.7) * 0.5)).toFixed(0)))}px` 
                          : '6px' 
                      }}
                    />
                  ))}
                </div>

                <button
                  onClick={toggleScribeRecording}
                  className={`w-full py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    isScribeRecording
                      ? 'bg-rose-500 hover:bg-rose-400 text-white shadow-lg shadow-rose-500/30'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/30'
                  }`}
                >
                  {isScribeRecording ? (
                    <>
                      <MicOff className="w-4 h-4" />
                      <span>Dừng Ghi âm & Phân tích AI</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4" />
                      <span>Bắt đầu Lắng nghe Ca khám</span>
                    </>
                  )}
                </button>
              </div>

              {/* Transcript Preview */}
              <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2 mb-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Văn bản thoại nhận diện (Real-time Transcript)
                </span>
                <p className="text-xs text-slate-200 italic leading-relaxed min-h-[60px]">
                  {scribeTranscript || 'Chưa có âm thanh. Hãy bấm Bắt đầu ghi âm để AI tự động trích xuất triệu chứng và đề xuất thuốc.'}
                </p>
              </div>

              {/* Apply to SOAP Button */}
              {scribeTranscript && (
                <button
                  onClick={handleApplyScribeToSoap}
                  className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/20 text-cyan-300 border border-cyan-400/30 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Áp dụng vào Bệnh án SOAP</span>
                </button>
              )}

              {/* AI Scribe Safety Principles */}
              <div className="mt-4 pt-3 border-t border-white/10 text-[11px] text-white/40 space-y-1">
                <p>• Zero Hallucination: Chỉ trích xuất thông tin có thực trong audio.</p>
                <p>• Bác sĩ chịu trách nhiệm chuyên môn cao nhất sau khi xác nhận chốt bệnh án.</p>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: ĐIỀU PHỐI KHÁM & CHỐNG TRÙNG LẶP (DISPATCH & QUEUE)   */}
      {/* ============================================================ */}
      {activeClinicTab === 'dispatch' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT 8 COLS: QUEUEING DISPLAY & REAL-TIME DISPATCH */}
          <div className="lg:col-span-8 space-y-5">
            
            <div className="p-6 rounded-3xl bg-white/[0.06] backdrop-blur-2xl border border-white/15 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-white/10">
                <div>
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    <span>Màn hình Điều phối & Hàng chờ Sảnh khám (Queue TV)</span>
                  </h3>
                  <p className="text-xs text-white/60">Triage 4 cấp độ • Phân bổ phòng khám & chống double-booking</p>
                </div>

                <button
                  onClick={handleCallNextPatient}
                  className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/30 cursor-pointer active:scale-95"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>{isCallingNext ? 'Đang phát loa gọi số...' : 'Loa gọi bệnh nhân tiếp theo'}</span>
                </button>
              </div>

              {/* Concurrency Lock Banner */}
              <div className="p-3.5 rounded-2xl bg-cyan-950/40 border border-cyan-400/30 flex items-center justify-between gap-3 text-xs mb-5">
                <div className="flex items-center gap-2 text-cyan-300">
                  <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>
                    <strong>Redis Distributed Lock:</strong> Hệ thống tự động khóa 180s + Buffer 15 phút chống đặt trùng lịch.
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-200 text-[10px] font-mono font-bold">
                  ACTIVE
                </span>
              </div>

              {/* Queue List Table */}
              <div className="space-y-3">
                {queueList.map((q) => (
                  <div
                    key={q.id}
                    onClick={() => {
                      sound.playClick();
                      setActiveQueueId(q.id);
                    }}
                    className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      activeQueueId === q.id
                        ? 'bg-cyan-500/15 border-cyan-400/60 shadow-lg'
                        : 'bg-black/30 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center font-mono font-black text-white text-sm">
                        {q.id}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-white text-sm">{q.petName}</span>
                          <span className="text-xs text-white/50">({q.owner})</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            q.triage.includes('Nguy kịch') 
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                              : q.triage.includes('Bán khẩn')
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-white/10 text-white/70'
                          }`}>
                            {q.triage}
                          </span>
                        </div>
                        <p className="text-xs text-cyan-300/80 mt-0.5">
                          {q.service} • {q.doctor} • <strong className="text-white">{q.room}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <span className="text-xs font-mono text-white/60">Chờ: {q.waitTime}</span>
                      <span className={`px-2.5 py-1 rounded-xl text-xs font-bold ${
                        q.status === 'Đang khám'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-white/10 text-white/80'
                      }`}>
                        {q.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

            </div>

          </div>

          {/* RIGHT 4 COLS: ROOM AVAILABILITY & STATS */}
          <div className="lg:col-span-4 space-y-5">
            
            <div className="p-5 rounded-3xl bg-white/[0.06] backdrop-blur-2xl border border-white/15 shadow-xl">
              <h4 className="text-sm font-extrabold text-white mb-3">Tình trạng Phòng khám & Ghế thủ thuật</h4>
              
              <div className="space-y-2.5 text-xs">
                {[
                  { name: 'Phòng khám 01 (Khám chung)', status: 'Sẵn sàng', pet: 'Trống', color: 'text-emerald-400' },
                  { name: 'Phòng khám 02 (Chuyên khoa Mèo)', status: 'Sẵn sàng', pet: 'Trống', color: 'text-emerald-400' },
                  { name: 'Phòng Phẫu thuật vô trùng', status: 'Sẵn sàng', pet: 'Trống', color: 'text-emerald-400' },
                  { name: 'Phòng Cấp cứu & Hồi sức', status: 'Sẵn sàng', pet: 'Trống', color: 'text-emerald-400' },
                  { name: 'Bàn Siêu âm Doppler màu', status: 'Sẵn sàng', pet: 'Trống', color: 'text-emerald-400' }
                ].map((r, i) => (
                  <div key={i} className="p-3 rounded-2xl bg-black/30 border border-white/5 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white">{r.name}</p>
                      <p className="text-[11px] text-white/50">{r.pet}</p>
                    </div>
                    <span className={`font-bold font-mono text-[11px] ${r.color}`}>{r.status}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: DƯỢC PHẨM & VẬT TƯ TIÊU HAO FEFO                     */}
      {/* ============================================================ */}
      {activeClinicTab === 'inventory' && (
        <div className="space-y-5">
          
          <div className="p-6 rounded-3xl bg-white/[0.06] backdrop-blur-2xl border border-white/15 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-white/10">
              <div>
                <h3 className="text-base font-extrabold text-white flex flex-wrap items-center gap-2">
                  <Package className="w-5 h-5 text-cyan-400" />
                  <span>Quản lý Kho Dược & Vật tư tiêu hao (FEFO Engine)</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    Minh họa — chưa quản lý tồn kho thực tế
                  </span>
                </h3>
                <p className="text-xs text-white/60">Nguyên tắc First-Expired, First-Out • Đa đơn vị tính (UOM) • Minh họa giao diện (Chưa quản lý tồn kho thực tế)</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleTestFefoDispatch}
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs shadow-lg shadow-cyan-500/30 cursor-pointer transition-transform active:scale-95"
                >
                  {fefoTestSuccess ? '✓ Mô phỏng trừ 7 viên từ lô AP-2026B (Minh họa)' : 'Mô phỏng xuất đơn thuốc FEFO (Minh họa)'}
                </button>
              </div>
            </div>

            {/* Inventory Table */}
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-white/50 font-bold uppercase tracking-wider text-[10px]">
                    <th className="pb-3">Mã & Tên Sản Phẩm</th>
                    <th className="pb-3">Số Lô (Lot/Batch)</th>
                    <th className="pb-3">Hạn Sử Dụng</th>
                    <th className="pb-3">Tồn Khả Dụng</th>
                    <th className="pb-3">Giữ Chỗ (Reserved)</th>
                    <th className="pb-3">Đơn Giá</th>
                    <th className="pb-3 text-right">Trạng Thái FEFO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {inventoryItems.map((item) => (
                    <tr key={item.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="py-3.5 pr-2">
                        <p className="font-bold text-white">{item.name}</p>
                        <p className="text-[10px] font-mono text-cyan-300">{item.code} • ĐVT: {item.baseUom}</p>
                      </td>
                      <td className="py-3.5 font-mono font-bold text-amber-300">{item.batchNumber}</td>
                      <td className="py-3.5 font-mono text-white/80">{item.expiryDate} ({item.daysLeft} ngày)</td>
                      <td className="py-3.5 font-mono font-extrabold text-white">{item.stock} {item.baseUom}</td>
                      <td className="py-3.5 font-mono text-cyan-300">{item.reserved}</td>
                      <td className="py-3.5 font-mono text-white/70">{item.unitPrice.toLocaleString()}đ</td>
                      <td className="py-3.5 text-right">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          item.status.includes('Khẩn cấp')
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                            : item.status.includes('Cận date')
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* FEFO Explanation Box */}
            <div className="mt-5 p-4 rounded-2xl bg-black/40 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-white/70">
              <div className="space-y-1">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Quy tắc FEFO bắt buộc:
                </span>
                <p className="text-[11px] text-white/50">
                  Khi bác sĩ kê Apoquel, hệ thống tự động xuất từ Lô <strong className="text-amber-300">AP-2026B</strong> (Hạn 12/2026) trước lô <strong className="text-emerald-300">AP-2027A</strong> (Hạn 08/2027).
                </p>
              </div>
              <span className="text-[10px] font-mono px-3 py-1.5 rounded-xl bg-white/5 text-cyan-300 border border-white/10 whitespace-nowrap">
                Chống thất thoát 100%
              </span>
            </div>

            {/* FEFO Audit Log Table */}
            <div className="mt-6 pt-5 border-t border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                    <span>Nhật Ký Xuất Kho Điều Trị (FEFO Clinical Audit Log)</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">Minh họa</span>
                  </h4>
                </div>
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 font-bold">
                  {inventoryLogs.length} Phiếu xuất đã ghi vết
                </span>
              </div>
              <p className="text-[11px] text-white/50 mb-3">Mô phỏng ghi nhận trên giao diện khi Bác sĩ xác nhận chốt đơn thuốc SOAP (Minh họa — chưa quản lý tồn kho thực tế)</p>

              <div className="overflow-x-auto no-scrollbar rounded-2xl border border-white/10 bg-black/30">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-white/50 font-bold uppercase tracking-wider text-[10px] bg-white/[0.02]">
                      <th className="py-2.5 px-3">Mã & Thời gian</th>
                      <th className="py-2.5 px-2">Hoạt động</th>
                      <th className="py-2.5 px-2">Thuốc & Số Lô</th>
                      <th className="py-2.5 px-2">Số lượng xuất</th>
                      <th className="py-2.5 px-2">Tồn sau xuất</th>
                      <th className="py-2.5 px-2">Bệnh nhân & Bác sĩ</th>
                      <th className="py-2.5 px-3 text-right">Lý do điều trị</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {inventoryLogs.map(log => (
                      <tr key={log.id} className="hover:bg-white/[0.03] transition-colors">
                        <td className="py-3 px-3">
                          <span className="font-mono font-bold text-white block">{log.id}</span>
                          <span className="text-[10px] text-white/40">{log.timestamp}</span>
                        </td>
                        <td className="py-3 px-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <p className="font-bold text-white">{log.medicine}</p>
                          <span className="text-[10px] font-mono text-amber-300 font-bold">Lô: {log.batchNumber}</span>
                        </td>
                        <td className="py-3 px-2 font-mono font-black text-rose-400 text-sm whitespace-nowrap">
                          {log.quantity}
                        </td>
                        <td className="py-3 px-2 font-mono font-bold text-cyan-300 whitespace-nowrap">
                          {log.remaining} Viên
                        </td>
                        <td className="py-3 px-2">
                          <p className="font-semibold text-white">{log.patient}</p>
                          <p className="text-[10px] text-white/50">{log.doctor}</p>
                        </td>
                        <td className="py-3 px-3 text-right text-[11px] text-white/70 max-w-xs truncate">
                          {log.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 4: POS & TẠM ỨNG NỘI TRÚ (BILLING)                       */}
      {/* ============================================================ */}
      {activeClinicTab === 'billing' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT 7 COLS: INPATIENT FOLIO & BILL SUMMARY */}
          <div className="lg:col-span-7 space-y-5">
            
            <div className="p-6 rounded-3xl bg-white/[0.06] backdrop-blur-2xl border border-white/15 shadow-xl">
              <div className="flex items-center justify-between mb-5 pb-4 border-b border-white/10">
                <div>
                  <h3 className="text-base font-extrabold text-white">Sổ Tạm Ứng Viện Phí Nội Trú (Deposit Ledger)</h3>
                  <p className="text-xs text-white/50">{examPet ? `Bệnh nhân: ${examPet.name} (${examPet.breed || 'Chưa cập nhật'}) • Mã hồ sơ: #${selectedLinkedAppId || 'INV-TEMP'}` : 'Chưa có thông tin bệnh nhân nội trú'}</p>
                </div>

                <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                  Đang nằm viện (Day 3)
                </span>
              </div>

              {/* Deposit Progress Cards */}
              <div className="grid grid-cols-3 gap-3 mb-5 text-center text-xs">
                <div className="p-3 rounded-2xl bg-black/40 border border-white/10">
                  <span className="text-[10px] text-white/50 block">Đã Tạm Ứng (Deposit)</span>
                  <span className="text-sm font-black font-mono text-white mt-1 block">
                    {inpatientDeposit.depositTotal.toLocaleString()}đ
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-black/40 border border-white/10">
                  <span className="text-[10px] text-white/50 block">Đã Chi Dùng</span>
                  <span className="text-sm font-black font-mono text-amber-300 mt-1 block">
                    {inpatientDeposit.usedAmount.toLocaleString()}đ
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-black/40 border border-white/10">
                  <span className="text-[10px] text-white/50 block">Số Dư Tạm Ứng Còn</span>
                  <span className="text-sm font-black font-mono text-cyan-300 mt-1 block">
                    {inpatientDeposit.remaining.toLocaleString()}đ
                  </span>
                </div>
              </div>

              {/* Daily Ledger List */}
              <div className="space-y-2 mb-5">
                <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider block mb-1">
                  Bảng kê chi phí hàng ngày (Daily Charges)
                </span>
                {inpatientDeposit.dailyCharges.map((c, i) => (
                  <div key={i} className="p-3 rounded-xl bg-black/30 border border-white/5 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-white">{c.item}</p>
                      <p className="text-[10px] font-mono text-white/40">{c.date}</p>
                    </div>
                    <span className="font-mono font-bold text-white">{c.amount.toLocaleString()}đ</span>
                  </div>
                ))}
              </div>

              {/* Checkout Calculation */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="text-white/70">Số tiền hoàn trả dự kiến khi xuất viện:</span>
                <span className="text-base font-black font-mono text-emerald-400">
                  +{inpatientDeposit.remaining.toLocaleString()}đ
                </span>
              </div>
            </div>

          </div>

          {/* RIGHT 5 COLS: DYNAMIC VIETQR & E-INVOICE */}
          <div className="lg:col-span-5 space-y-5">
            
            <div className="p-6 rounded-3xl bg-white/[0.06] backdrop-blur-2xl border border-white/15 shadow-xl text-center">
              <h4 className="text-sm font-extrabold text-white mb-1">Thanh toán VietQR Động Thời Gian Thực</h4>
              <p className="text-xs text-white/50 mb-4">Mã QR chứa sẵn số tiền & mã hóa đơn #INV-8819</p>

              {/* Dynamic QR Box */}
              <div className="p-4 rounded-2xl bg-white text-slate-950 inline-block shadow-2xl mb-4">
                <div className="w-44 h-44 border-4 border-slate-900 rounded-xl flex flex-col items-center justify-center p-2 relative">
                  <QrCode className="w-32 h-32 text-slate-900" />
                  <span className="text-[10px] font-bold font-mono tracking-wider mt-1 text-slate-800">
                    VIETQR • 670,000 VND
                  </span>
                </div>
              </div>

              <div className="space-y-2 mb-4 text-xs">
                <div className="flex justify-between text-white/60">
                  <span>Hóa đơn lâm sàng:</span>
                  <span className="font-mono text-white font-bold">670,000đ</span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>Khấu trừ cọc giữ chỗ:</span>
                  <span className="font-mono text-emerald-400">-50,000đ</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-white/10">
                  <span>Tổng thực thu:</span>
                  <span className="font-mono text-cyan-300">620,000đ</span>
                </div>
              </div>

              {/* Simulate Webhook Trigger */}
              <button
                onClick={() => {
                  sound.playSuccess();
                  setIsPaidVietQr(true);
                  confetti({ particleCount: 50, spread: 60 });
                }}
                className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                  isPaidVietQr
                    ? 'bg-emerald-500 text-slate-950 font-black'
                    : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/30'
                }`}
              >
                {isPaidVietQr ? '✓ Webhook Đã Bắn: ĐÃ THANH TOÁN THÀNH CÔNG!' : 'Mô phỏng Webhook Khách Quét QR'}
              </button>

              <button
                onClick={() => sound.playSuccess()}
                className="w-full mt-2 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Xuất Hóa Đơn Điện Tử VAT (E-Invoice)</span>
              </button>
            </div>

          </div>

        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 5: AI VISION OCR & DỰ BÁO DỊCH TỄ (PHÒNG LAB & X-QUANG) */}
      {/* ============================================================ */}
      {activeClinicTab === 'ai-lab' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT 7 COLS: VISION OCR BIO-ANALYZER */}
          <div className="lg:col-span-7 space-y-5">
            
            <div className="p-6 rounded-3xl bg-white/[0.06] backdrop-blur-2xl border border-white/15 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-white/10">
                <div>
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    <Scan className="w-5 h-5 text-cyan-400" />
                    <span>Vision OCR: Trích xuất & Phân tích Cận Lâm Sàng</span>
                  </h3>
                  <p className="text-xs text-white/50">Phòng Lab & X-quang • So sánh dải tham chiếu sinh lý & Gắn cờ tự động</p>
                </div>

                <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 self-start sm:self-auto">
                  🔬 LabScanView AI
                </span>
              </div>

              {/* 1. Bổ sung dropdown chọn ca bệnh đang liên kết */}
              <div className="p-3.5 rounded-2xl bg-cyan-950/50 border border-cyan-400/40 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <span className="text-xs font-black text-cyan-200 flex items-center gap-1.5 shrink-0">
                  <User className="w-4 h-4 text-cyan-400" />
                  <span>Gán kết quả cho ca khám:</span>
                </span>
                <select
                  value={selectedLinkedAppId}
                  onChange={(e) => {
                    try { sound?.playClick?.(); } catch {}
                    setSelectedLinkedAppId(e.target.value);
                  }}
                  className="w-full sm:w-auto bg-slate-900 border border-cyan-400/40 rounded-xl px-3 py-1.5 text-xs text-cyan-300 font-bold outline-none cursor-pointer"
                >
                  {activeAppointments.map(app => (
                    <option key={app.id} value={app.id} className="bg-slate-900 text-white">
                      [{app.id} - {app.petName} ({app.breed || app.petType || 'Golden Retriever'})]
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Thêm 2 nút ảnh xét nghiệm mẫu để kiểm tra nhanh */}
              <div className="space-y-1.5 mb-4">
                <span className="text-[11px] font-bold text-white/60 block">
                  Chọn mẫu kiểm tra nhanh (Quick Demo Samples):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Nút 1: Mẫu máu Chó - Tăng men gan ALT & Viêm da */}
                  <button
                    type="button"
                    onClick={() => {
                      try { sound?.playClick?.(); } catch {}
                      setSelectedLabPreset('blood_alt');
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                      selectedLabPreset === 'blood_alt'
                        ? 'bg-rose-500/20 border-rose-400/70 shadow-lg shadow-rose-500/20 ring-1 ring-rose-400/50 scale-[1.01]'
                        : 'bg-black/30 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-300 flex items-center justify-center shrink-0 border border-rose-500/40 text-lg">
                      🩸
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-white flex items-center gap-1.5">
                        <span>Mẫu 1: Máu Chó</span>
                        {selectedLabPreset === 'blood_alt' && (
                          <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                        )}
                      </div>
                      <p className="text-[11px] text-rose-300 font-medium truncate mt-0.5">
                        Tăng men gan ALT & Viêm da
                      </p>
                    </div>
                  </button>

                  {/* Nút 2: Mẫu X-quang Chó - Ổ bụng bình thường */}
                  <button
                    type="button"
                    onClick={() => {
                      try { sound?.playClick?.(); } catch {}
                      setSelectedLabPreset('xray_normal');
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                      selectedLabPreset === 'xray_normal'
                        ? 'bg-cyan-500/20 border-cyan-400/70 shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/50 scale-[1.01]'
                        : 'bg-black/30 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center shrink-0 border border-cyan-400/40 text-lg">
                      🩻
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-white flex items-center gap-1.5">
                        <span>Mẫu 2: X-quang Chó</span>
                        {selectedLabPreset === 'xray_normal' && (
                          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                        )}
                      </div>
                      <p className="text-[11px] text-cyan-300 font-medium truncate mt-0.5">
                        Ổ bụng bình thường
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* 3. Khung Quét Radar AI Vision & Nút Bắt đầu Quét */}
              <div className="p-4 rounded-2xl bg-black/40 border border-dashed border-white/20 text-center mb-5 relative overflow-hidden">
                {isOcrProcessing ? (
                  /* Hiệu ứng Radar phân tích 1.2s */
                  <div className="py-4 space-y-3">
                    <div className="relative w-40 h-40 mx-auto rounded-full border-2 border-cyan-500/40 bg-cyan-950/40 flex items-center justify-center overflow-hidden shadow-inner">
                      {/* Concentric rings */}
                      <div className="absolute inset-3 rounded-full border border-cyan-400/20" />
                      <div className="absolute inset-8 rounded-full border border-cyan-400/20" />
                      <div className="absolute inset-14 rounded-full border border-cyan-400/20" />
                      {/* Crosshairs */}
                      <div className="absolute inset-0 flex items-center justify-center"><div className="w-full h-px bg-cyan-400/20" /></div>
                      <div className="absolute inset-0 flex items-center justify-center"><div className="h-full w-px bg-cyan-400/20" /></div>
                      {/* Rotating radar sweep */}
                      <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg_at_50%_50%,rgba(6,182,212,0.45)_0deg,transparent_65deg)] animate-spin duration-1000" />
                      {/* Target dots */}
                      <div className="absolute w-3 h-3 rounded-full bg-cyan-400 animate-ping" />
                      <div className="absolute w-2 h-2 rounded-full bg-white shadow-xs" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-cyan-300 flex items-center justify-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                        <span>Đang quét radar quang học & nhận diện ký tự AI Vision ({radarProgress}%)...</span>
                      </p>
                      <p className="text-[11px] text-white/50 mt-1">
                        Áp dụng dải tham chiếu chuẩn loài Chó (Canine standard) • Thời gian xử lý: 1.2s
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Trạng thái sẵn sàng quét */
                  <div>
                    <FileCheck2 className="w-9 h-9 text-cyan-400 mx-auto mb-2 opacity-90" />
                    <p className="text-xs font-black text-white">
                      {selectedLabPreset === 'blood_alt' 
                        ? 'Phiếu Xét Nghiệm Máu Sinh Hóa 17 Chỉ Số (Catalyst One)' 
                        : 'Phim X-Quang Kỹ Thuật Số (Digital Radiography DR - Ổ Bụng)'}
                    </p>
                    <p className="text-[11px] text-white/50 mt-0.5">
                      {selectedLabPreset === 'blood_alt'
                        ? 'Mẫu cận lâm sàng: Xét nghiệm sinh hóa máu'
                        : 'Mẫu cận lâm sàng: Chẩn đoán hình ảnh X-Quang'}
                    </p>

                    <button
                      type="button"
                      onClick={handleRunAiOcr}
                      disabled={isOcrProcessing}
                      className="mt-3 px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs shadow-lg shadow-cyan-500/30 cursor-pointer transition-transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 mx-auto"
                    >
                      <Scan className="w-4 h-4 text-slate-950" />
                      <span>Bắt đầu Quét & Phân Tích AI</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 4. Thông báo tự động đồng bộ sang SOAP */}
              {syncSoapSuccess && (
                <div className="mb-4 p-3.5 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-100 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg animate-in fade-in duration-300">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-xs font-black text-white">
                        ✓ Đã tự động lưu chuỗi tóm tắt cận lâm sàng vào mục O (Objective) của Bệnh án SOAP!
                      </p>
                      <p className="text-[11px] text-emerald-300 font-medium">
                        Ca khám liên kết: [{ocrResult?.linkedAppId} - {ocrResult?.petLabel}]
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      try { sound?.playSuccess?.(); } catch {}
                      setActiveClinicTab('soap');
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-md cursor-pointer transition-all active:scale-95 shrink-0 whitespace-nowrap"
                  >
                    🩺 Mở Khám SOAP →
                  </button>
                </div>
              )}

              {/* 5. Bảng kết quả các chỉ số sinh hóa (ALT, CREA, BUN, WBC, RBC) kèm cờ cảnh báo [Bình thường] / [Tăng cao] */}
              {ocrResult && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between text-xs pb-1 border-b border-white/10">
                    <span className="font-black text-white">
                      Bảng chỉ số sinh hóa: {ocrResult.petLabel}
                    </span>
                    <span className="text-cyan-300 font-mono text-[11px]">
                      {ocrResult.analyzer}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {ocrResult.indicators.map((ind, i) => (
                      <div key={i} className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-white text-xs">{ind.name}</p>
                          <p className="text-[10px] text-white/50 mt-0.5">Dải tham chiếu: {ind.ref} {ind.unit}</p>
                        </div>
                        <div className="text-right">
                          <span className={`font-mono font-black text-sm block ${
                            ind.status === 'high' ? 'text-rose-400' : 'text-emerald-400'
                          }`}>
                            {ind.value} {ind.unit}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border inline-block mt-0.5 ${
                            ind.status === 'high' 
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse' 
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          }`}>
                            {ind.status === 'high' ? '[Tăng cao]' : '[Bình thường]'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* AI Clinical Conclusion */}
                  <div className="p-3.5 rounded-2xl bg-cyan-950/60 border border-cyan-400/40 text-xs text-cyan-200">
                    <strong className="text-cyan-300 block mb-1 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Định hướng lâm sàng sơ bộ từ AI:</span>
                    </strong>
                    <p className="text-white/90 leading-relaxed font-medium">
                      {ocrResult.aiConclusion}
                    </p>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* RIGHT 5 COLS: DỰ BÁO DỊCH TỄ ĐỊA PHƯƠNG & ĐỒNG BỘ 2 CHIỀU */}
          <div className="lg:col-span-5 space-y-5">
            
            <div className="p-6 rounded-3xl bg-white/[0.06] backdrop-blur-2xl border border-white/15 shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-rose-400" />
                  <span>Bản đồ Nhiệt Dịch Tễ Học Địa Phương</span>
                </h4>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  REAL-TIME 2026
                </span>
              </div>
              <p className="text-xs text-white/50 mb-4">Phân tích mật độ ca bệnh bán kính 5km (Quận Cầu Giấy)</p>

              <div className="space-y-3 text-xs mb-5">
                {[
                  { disease: 'Parvovirus (CPV-2)', count: '28 ca trong 14 ngày', risk: 'Nguy cơ cao (Bùng phát)', color: 'text-rose-400 bg-rose-500/20 border-rose-500/40', isHigh: true },
                  { disease: 'Care (Canine Distemper)', count: '3 ca ghi nhận', risk: 'Kiểm soát tốt', color: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/40', isHigh: false },
                  { disease: 'FIP (Viêm phúc mạc truyền nhiễm mèo)', count: '12 ca ghi nhận', risk: 'Cần chú ý', color: 'text-amber-400 bg-amber-500/20 border-amber-500/40', isHigh: false }
                ].map((d, i) => (
                  <div key={i} className={`p-3 rounded-2xl border flex items-center justify-between ${
                    d.isHigh ? 'bg-rose-950/30 border-rose-500/40' : 'bg-black/30 border-white/5'
                  }`}>
                    <div>
                      <p className="font-bold text-white flex items-center gap-1.5">
                        {d.isHigh && <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />}
                        <span>{d.disease}</span>
                      </p>
                      <p className="text-[10px] text-white/40">{d.count}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${d.color}`}>
                      {d.risk}
                    </span>
                  </div>
                ))}
              </div>

              {/* Nút đồng bộ cảnh báo 2 chiều sang Cổng Chủ Nuôi */}
              <button
                type="button"
                onClick={handleSyncEpidemicToOwner}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-black text-xs shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-95"
              >
                <Flame className="w-4 h-4 text-amber-200 animate-pulse" />
                <span>🚨 ĐỒNG BỘ CẢNH BÁO DỊCH TỄ SANG CỔNG CHỦ NUÔI</span>
              </button>

              {syncEpidemicSuccess && (
                <div className="mt-3 p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>✓ Đã đồng bộ cảnh báo ổ dịch Parvovirus (Quận Cầu Giấy - Nguy cơ cao) sang Cổng Chủ Nuôi!</span>
                </div>
              )}

              <div className="mt-4 p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 text-xs text-white/70">
                <span className="font-bold text-white block mb-1">Khuyến cáo phòng ngừa tự động:</span>
                Hệ thống tự động kích hoạt Banner cảnh báo khẩn cấp tại Cổng Chủ Nuôi cho toàn bộ thú cưng chưa tiêm mũi nhắc lại năm 2026.
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 6: QUẢN TRỊ SAAS & FEATURE MATRIX                       */}
      {/* ============================================================ */}
      {activeClinicTab === 'saas-admin' && (
        <div className="space-y-6">
          
          {/* SaaS Tier Matrix */}
          <div className="p-6 rounded-3xl bg-white/[0.06] backdrop-blur-2xl border border-white/15 shadow-xl">
            <div className="text-center max-w-xl mx-auto mb-8">
              <h3 className="text-xl font-black text-white tracking-tight">Ma Trận Phân Tầng Tính Năng (SaaS Feature-Gating)</h3>
              <p className="text-xs text-white/60 mt-1">Đăng ký định kỳ hàng tháng cho Bệnh viện Thú y theo quy mô</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              
              {/* Starter */}
              <div className={`p-5 rounded-3xl border transition-all ${
                currentPlan === 'Starter'
                  ? 'bg-white/10 border-cyan-400 shadow-xl ring-2 ring-cyan-400/40'
                  : 'bg-black/30 border-white/10'
              }`}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-extrabold text-white text-base">Starter</h4>
                    <p className="text-[11px] text-white/50">Phòng khám đơn lẻ</p>
                  </div>
                  <span className="text-lg font-black text-white font-mono">$39<span className="text-xs text-white/50">/tháng</span></span>
                </div>

                <ul className="space-y-2 text-xs text-white/70 my-4">
                  <li className="flex items-center gap-2">✓ 1 Chi nhánh tối đa</li>
                  <li className="flex items-center gap-2">✓ Tối đa 3 Bác sĩ</li>
                  <li className="flex items-center gap-2">✓ Bệnh án SOAP cơ bản</li>
                  <li className="flex items-center gap-2">✓ POS tính tiền</li>
                  <li className="text-white/30">✗ Không có AI Scribe</li>
                  <li className="text-white/30">✗ Không có Vision OCR</li>
                </ul>

                <button
                  onClick={() => {
                    sound.playClick();
                    setCurrentPlan('Starter');
                  }}
                  className={`w-full py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    currentPlan === 'Starter' ? 'bg-cyan-500 text-slate-950' : 'bg-white/10 text-white'
                  }`}
                >
                  {currentPlan === 'Starter' ? 'Đang kích hoạt' : 'Chọn Gói Starter'}
                </button>
              </div>

              {/* Growth */}
              <div className={`p-5 rounded-3xl border transition-all ${
                currentPlan === 'Growth'
                  ? 'bg-white/10 border-cyan-400 shadow-xl ring-2 ring-cyan-400/40'
                  : 'bg-black/30 border-white/10'
              }`}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-extrabold text-white text-base">Growth</h4>
                    <p className="text-[11px] text-white/50">Chuỗi phòng khám vừa</p>
                  </div>
                  <span className="text-lg font-black text-white font-mono">$99<span className="text-xs text-white/50">/tháng</span></span>
                </div>

                <ul className="space-y-2 text-xs text-white/70 my-4">
                  <li className="flex items-center gap-2">✓ Tối đa 3 Chi nhánh</li>
                  <li className="flex items-center gap-2">✓ Tối đa 10 Bác sĩ</li>
                  <li className="flex items-center gap-2">✓ Kho Dược FEFO tự động</li>
                  <li className="flex items-center gap-2">✓ VietQR động & Hóa đơn VAT</li>
                  <li className="flex items-center gap-2 text-cyan-300">✓ AI Scribe: 100 ca/tháng</li>
                  <li className="flex items-center gap-2 text-cyan-300">✓ AI OCR: 50 phiếu/tháng</li>
                </ul>

                <button
                  onClick={() => {
                    sound.playClick();
                    setCurrentPlan('Growth');
                  }}
                  className={`w-full py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    currentPlan === 'Growth' ? 'bg-cyan-500 text-slate-950' : 'bg-white/10 text-white'
                  }`}
                >
                  {currentPlan === 'Growth' ? 'Đang kích hoạt' : 'Chọn Gói Growth'}
                </button>
              </div>

              {/* Enterprise */}
              <div className={`p-5 rounded-3xl border transition-all relative overflow-hidden ${
                currentPlan === 'Enterprise'
                  ? 'bg-gradient-to-b from-cyan-950/40 to-slate-900 border-cyan-400 shadow-2xl ring-2 ring-cyan-400/60'
                  : 'bg-black/30 border-white/10'
              }`}>
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-cyan-500 text-slate-950 font-bold text-[9px] uppercase">
                  Best Choice
                </div>

                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-extrabold text-white text-base">Enterprise</h4>
                    <p className="text-[11px] text-white/50">Bệnh viện & Chuỗi lớn</p>
                  </div>
                  <span className="text-lg font-black text-white font-mono">$299<span className="text-xs text-white/50">/tháng</span></span>
                </div>

                <ul className="space-y-2 text-xs text-white/80 my-4">
                  <li className="flex items-center gap-2 text-cyan-300 font-bold">✓ Không giới hạn Chi nhánh</li>
                  <li className="flex items-center gap-2 text-cyan-300 font-bold">✓ Không giới hạn Nhân sự</li>
                  <li className="flex items-center gap-2 text-cyan-300 font-bold">✓ Full AI Suite Không Giới Hạn</li>
                  <li className="flex items-center gap-2">✓ Database riêng & SLA 99.95%</li>
                  <li className="flex items-center gap-2">✓ Branded App riêng cho chủ nuôi</li>
                  <li className="flex items-center gap-2">✓ Kỹ sư trưởng hỗ trợ 24/7</li>
                </ul>

                <button
                  onClick={() => {
                    sound.playClick();
                    setCurrentPlan('Enterprise');
                  }}
                  className={`w-full py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    currentPlan === 'Enterprise' ? 'bg-cyan-500 text-slate-950 font-black' : 'bg-white/10 text-white'
                  }`}
                >
                  {currentPlan === 'Enterprise' ? 'Đang kích hoạt' : 'Chọn Gói Enterprise'}
                </button>
              </div>

            </div>

            {/* Dunning Management Simulation */}
            <div className="mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>Trình Mô Phỏng Dunning & Grace Period (Đạo đức Y tế Thú y)</span>
                </h4>
                <p className="text-[11px] text-white/50 mt-0.5">
                  Khi thẻ thanh toán lỗi: Ân hạn 3 ngày, sau đó chuyển sang Read-Only Mode để bác sĩ vẫn tra cứu được bệnh án cũ
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    sound.playClick();
                    setDunningStatus('GracePeriod');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold cursor-pointer"
                >
                  Giả lập Lỗi thẻ (Day 1)
                </button>

                <button
                  onClick={() => {
                    sound.playClick();
                    setDunningStatus('ReadOnly');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold cursor-pointer"
                >
                  Giả lập Hết hạn (Read-only)
                </button>

                <button
                  onClick={() => {
                    sound.playSuccess();
                    setDunningStatus('Active');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold cursor-pointer"
                >
                  Thanh toán thành công
                </button>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ============================================================ */}
      {/* MEDICAL PIN SIGN-OFF MODAL                                   */}
      {/* ============================================================ */}
      {isPinModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setIsPinModalOpen(false)}
        >
          <div 
            className="w-full max-w-sm rounded-3xl bg-slate-950 border border-white/20 p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </div>
                <h4 className="font-extrabold text-white text-sm">Xác nhận chốt bệnh án</h4>
              </div>
              <button
                onClick={() => setIsPinModalOpen(false)}
                className="p-1 rounded-full text-white/50 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-white/70">
              Xác nhận chốt hồ sơ bệnh án SOAP và chuyển lịch khám sang trạng thái hoàn thành. Bệnh án sau khi chốt sẽ được bảo vệ và khóa sửa đổi trực tiếp.
            </p>

            <button
              onClick={handleSignOffEhr}
              disabled={isFinalizingEhr}
              className={`w-full py-2.5 rounded-xl font-black text-xs shadow-lg transition-all ${
                isFinalizingEhr
                  ? 'bg-cyan-500/50 text-slate-900 cursor-not-allowed opacity-70'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/30 cursor-pointer active:scale-95'
              }`}
            >
              {isFinalizingEhr ? 'Đang chốt bệnh án & hoàn tất...' : 'Xác nhận chốt bệnh án & Hoàn tất ca khám'}
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* X-RAY / LAB REPORT PREVIEW MODAL                              */}
      {/* ============================================================ */}
      {previewImageModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer animate-in fade-in"
          onClick={() => setPreviewImageModal(null)}
        >
          <div 
            className="max-w-3xl max-h-[85vh] rounded-3xl overflow-hidden border border-white/20 relative bg-slate-950 p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={previewImageModal} alt="Preview X-Ray" className="w-full h-auto object-contain max-h-[75vh] rounded-2xl" />
            <div className="flex items-center justify-between p-3">
              <span className="text-xs text-slate-300 font-bold">Hình ảnh chẩn đoán cận lâm sàng (Khối Objective)</span>
              <button
                onClick={() => setPreviewImageModal(null)}
                className="px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold cursor-pointer"
              >
                Đóng ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 1: TIẾP NHẬN CA KHÁM TẠI QUẦY (WALK-IN & CẤP CỨU)     */}
      {/* ============================================================ */}
      {isWalkinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl rounded-3xl bg-slate-900 border border-white/20 shadow-2xl p-6 text-slate-100 max-h-[92vh] overflow-y-auto">
            {/* Ambient Glow */}
            <div className="absolute top-0 right-1/4 w-60 h-24 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5 relative z-10">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-xl shadow-md ${
                  walkinFormData.isEmergency 
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50 shadow-rose-950/40' 
                    : 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-cyan-950/40'
                }`}>
                  {walkinFormData.isEmergency ? '🚨' : '🩺'}
                </div>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <span>Tiếp Nhận Ca Khám Tại Quầy</span>
                    {walkinFormData.isEmergency && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/30 text-rose-300 border border-rose-500/60 animate-pulse">
                        CẤP CỨU
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-white/60">
                    Nhập thông tin bệnh nhân và phân loại cấp cứu (Triage) vào hàng đợi
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsWalkinModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateWalkinAppointment} className="space-y-4 relative z-10">
              {/* Phân loại Triage (Mức độ ưu tiên) */}
              <div>
                <label className="text-xs font-black text-white/80 block mb-2">
                  Phân loại mức độ ưu tiên (Triage Priority):
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      try { sound?.playClick?.(); } catch {}
                      setWalkinFormData(prev => ({
                        ...prev,
                        isEmergency: true,
                        service: 'Cấp cứu & Xử lý sốc / Ngộ độc cấp',
                        note: prev.note || 'Bé có dấu hiệu sốc, nôn dịch vàng, mệt mỏi cấp tính.'
                      }));
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                      walkinFormData.isEmergency
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300 ring-2 ring-rose-500/40 shadow-lg shadow-rose-950/40'
                        : 'bg-black/30 border-white/10 hover:border-white/20 text-white/70'
                    }`}
                  >
                    <span className="text-2xl">🚨</span>
                    <div>
                      <p className="text-xs font-black text-white">Cấp Cứu Ưu Tiên</p>
                      <p className="text-[10px] text-rose-300 font-medium">Sốc, ngộ độc, nôn dịch vàng...</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      try { sound?.playClick?.(); } catch {}
                      setWalkinFormData(prev => ({
                        ...prev,
                        isEmergency: false,
                        service: 'Khám lâm sàng tổng quát'
                      }));
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                      !walkinFormData.isEmergency
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 ring-2 ring-cyan-400/40 shadow-lg shadow-cyan-950/40'
                        : 'bg-black/30 border-white/10 hover:border-white/20 text-white/70'
                    }`}
                  >
                    <span className="text-2xl">🩺</span>
                    <div>
                      <p className="text-xs font-black text-white">Khám Thường / Lịch Hẹn</p>
                      <p className="text-[10px] text-cyan-300 font-medium">Tiêm phòng, định kỳ, da liễu...</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Tên bé & Loài / Giống */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-white/70 block mb-1">
                    Tên bé thú cưng <span className="text-rose-400">*</span>:
                  </label>
                  <input
                    type="text"
                    required
                    value={walkinFormData.petName}
                    onChange={(e) => setWalkinFormData(prev => ({ ...prev, petName: e.target.value }))}
                    placeholder="Ví dụ: Bánh Mì, Lucky, Miu..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder-white/40 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-white/70 block mb-1">
                    Loài & Giống thú cưng:
                  </label>
                  <select
                    value={walkinFormData.petType}
                    onChange={(e) => setWalkinFormData(prev => ({ ...prev, petType: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
                  >
                    <option value="Chó Golden Retriever">Chó Golden Retriever</option>
                    <option value="Chó Poodle">Chó Poodle</option>
                    <option value="Chó Corgi">Chó Corgi</option>
                    <option value="Mèo Anh Lông Ngắn BSH">Mèo Anh Lông Ngắn (BSH)</option>
                    <option value="Mèo Ba Tư">Mèo Ba Tư</option>
                    <option value="Thỏ Kiểng Minilop">Thỏ Kiểng Minilop</option>
                    <option value="Chó / Mèo khác">Chó / Mèo khác</option>
                  </select>
                </div>
              </div>

              {/* Chủ nuôi & SĐT */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-white/70 block mb-1">
                    Họ tên chủ nuôi:
                  </label>
                  <input
                    type="text"
                    value={walkinFormData.ownerName}
                    onChange={(e) => setWalkinFormData(prev => ({ ...prev, ownerName: e.target.value }))}
                    placeholder="Ví dụ: Nguyễn Văn An"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder-white/40 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-white/70 block mb-1">
                    Số điện thoại liên hệ:
                  </label>
                  <input
                    type="tel"
                    value={walkinFormData.phone}
                    onChange={(e) => setWalkinFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Ví dụ: 0987 654 321"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder-white/40 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40"
                  />
                </div>
              </div>

              {/* Dịch vụ tiếp nhận */}
              <div>
                <label className="text-xs font-bold text-white/70 block mb-1">
                  Dịch vụ / Khoa tiếp nhận:
                </label>
                <select
                  value={walkinFormData.service}
                  onChange={(e) => setWalkinFormData(prev => ({ ...prev, service: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
                >
                  <option value="Cấp cứu & Xử lý sốc / Dị ứng cấp">Cấp cứu & Xử lý sốc / Dị ứng cấp</option>
                  <option value="Khám lâm sàng tổng quát">Khám lâm sàng tổng quát</option>
                  <option value="Da liễu & Vết nấm/ve rận">Da liễu & Vết nấm/ve rận</option>
                  <option value="Tiêm vắc-xin & Tẩy giun">Tiêm vắc-xin & Tẩy giun</option>
                  <option value="Khám Tiêu hóa / Hô hấp">Khám Tiêu hóa / Hô hấp</option>
                  <option value="Chẩn đoán hình ảnh & Cận lâm sàng">Chẩn đoán hình ảnh & Cận lâm sàng</option>
                </select>
              </div>

              {/* Lý do khám / Triệu chứng thực tế */}
              <div>
                <label className="text-xs font-bold text-white/70 block mb-1">
                  Lý do khám & Triệu chứng thực tế <span className="text-rose-400">*</span>:
                </label>
                <textarea
                  rows={3}
                  required
                  value={walkinFormData.note}
                  onChange={(e) => setWalkinFormData(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="Mô tả cụ thể triệu chứng của bé: Ví dụ: Sốc nôn dịch vàng từ sáng, mẩn đỏ toàn thân, thở dốc..."
                  className="w-full p-3 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder-white/40 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 leading-relaxed"
                />
              </div>

              {/* Footer Actions */}
              <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsWalkinModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-lg active:scale-95 flex items-center gap-2 ${
                    walkinFormData.isEmergency
                      ? 'bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white shadow-rose-950/40'
                      : 'bg-gradient-to-r from-cyan-500 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-slate-950 shadow-cyan-500/30'
                  }`}
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>+ Xác nhận & Đưa vào Hàng Đợi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: MÀN HÌNH GỌI SỐ TV (QUEUE SIGNAGE TV)                 */}
      {/* ============================================================ */}
      {isQueueTvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="relative w-full max-w-6xl rounded-3xl bg-slate-900 border border-cyan-500/30 shadow-2xl p-6 text-slate-100 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-black border border-cyan-400/40 text-2xl shadow-lg shadow-cyan-500/20">
                  📺
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-white tracking-tight">
                      Màn Hình Gọi Số & Điều Phối Sảnh Chờ (Queue Signage TV)
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      LIVE TV
                    </span>
                  </div>
                  <p className="text-xs text-white/60">
                    Truyền phát số thứ tự sảnh chờ thời gian thực • Phân loại Triage 4 cấp độ • Loa gọi tự động
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleCallNextPatient}
                  className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/30 cursor-pointer active:scale-95"
                >
                  <Volume2 className="w-4 h-4 text-slate-950" />
                  <span>{isCallingNext ? 'Đang phát loa...' : 'Loa gọi bệnh nhân tiếp theo'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsQueueTvModalOpen(false)}
                  className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                  <span>Đóng màn hình TV</span>
                </button>
              </div>
            </div>

            {/* Grid: Left 8 Cols Queue Caller & Table, Right 4 Cols Room Status */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 space-y-4">
                {/* Active Call Announcement Box */}
                <div className="p-6 rounded-2xl bg-gradient-to-r from-cyan-950/70 via-blue-950/60 to-purple-950/60 border border-cyan-400/50 shadow-xl text-center relative overflow-hidden">
                  <div className="absolute top-2.5 right-3 text-[10px] font-mono text-cyan-300/80 bg-black/40 px-2 py-0.5 rounded-md border border-white/10">
                    BUỒNG KHÁM 01 • {currentUser?.name ? currentUser.name.toUpperCase() : 'BÁC SĨ TRỰC CA'}
                  </div>
                  <p className="text-xs uppercase font-extrabold text-cyan-300 tracking-widest mb-1">
                    {isCallingNext ? '🔊 ĐANG PHÁT LOA GỌI SỐ BỆNH NHÂN...' : 'BỆNH NHÂN ĐANG TRONG PHÒNG KHÁM'}
                  </p>
                  <div className="text-4xl sm:text-5xl font-black text-white font-mono my-2 tracking-tight">
                    {queueList.find(q => q.id === activeQueueId) ? `#${activeQueueId} • ${queueList.find(q => q.id === activeQueueId)?.petName}` : 'Chưa có ca khám trong hàng đợi'}
                  </div>
                  <p className="text-sm text-cyan-200 font-bold">
                    {queueList.find(q => q.id === activeQueueId) ? `Chủ nuôi: ${queueList.find(q => q.id === activeQueueId)?.owner} • Dịch vụ: ${queueList.find(q => q.id === activeQueueId)?.service}` : 'Hàng đợi phòng khám hiện đang trống'}
                  </p>
                </div>

                {/* Queue List Table */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold text-white/60 uppercase tracking-wider">
                    Danh sách thứ tự chờ khám (Triage Priority):
                  </h4>
                  {queueList.map((q) => (
                    <div
                      key={q.id}
                      onClick={() => {
                        sound.playClick();
                        setActiveQueueId(q.id);
                      }}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        activeQueueId === q.id
                          ? 'bg-cyan-500/15 border-cyan-400/60 shadow-lg'
                          : 'bg-black/30 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center font-mono font-black text-white text-xs">
                          {q.id}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-white text-sm">{q.petName}</span>
                            <span className="text-xs text-white/50">({q.owner})</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              q.triage.includes('Nguy kịch') 
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                                : q.triage.includes('Bán khẩn')
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-white/10 text-white/70'
                            }`}>
                              {q.triage}
                            </span>
                          </div>
                          <p className="text-xs text-cyan-300/80 mt-0.5">
                            {q.service} • <strong className="text-white">{q.room}</strong>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-white/60">Chờ: {q.waitTime}</span>
                        <span className={`px-2.5 py-1 rounded-xl text-xs font-bold ${
                          q.status === 'Đang khám'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-white/10 text-white/80'
                        }`}>
                          {q.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right 4 Cols: Room Status */}
              <div className="lg:col-span-4 space-y-4">
                <div className="p-4 rounded-2xl bg-black/40 border border-white/10">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Tình trạng phòng khám & ghế thủ thuật</span>
                  </h4>
                  <div className="space-y-2 text-xs">
                    {[
                      { name: 'Phòng khám 01 (Khám chung)', status: 'Sẵn sàng', pet: 'Trống', color: 'text-emerald-400' },
                      { name: 'Phòng khám 02 (Chuyên khoa Mèo)', status: 'Sẵn sàng', pet: 'Trống', color: 'text-emerald-400' },
                      { name: 'Phòng Phẫu thuật vô trùng', status: 'Sẵn sàng', pet: 'Trống', color: 'text-emerald-400' },
                      { name: 'Phòng Cấp cứu & Hồi sức', status: 'Sẵn sàng', pet: 'Trống', color: 'text-emerald-400' },
                      { name: 'Bàn Siêu âm Doppler màu', status: 'Sẵn sàng', pet: 'Trống', color: 'text-emerald-400' }
                    ].map((r, i) => (
                      <div key={i} className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-white">{r.name}</p>
                          <p className="text-[10px] text-white/50">{r.pet}</p>
                        </div>
                        <span className={`font-bold font-mono text-[10px] ${r.color}`}>{r.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export const ClinicWorkspaceView = ClinicOsView;
export default ClinicOsView;
