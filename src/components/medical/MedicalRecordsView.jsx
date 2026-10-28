import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  FileHeart, 
  Syringe, 
  Pill, 
  Stethoscope, 
  Printer, 
  CheckCircle2, 
  Clock, 
  ShieldCheck,
  AlertTriangle,
  Download,
  Building2,
  Calendar,
  PawPrint,
  Bell,
  FileText,
  Check,
  Plus,
  Trash2,
  Edit2,
  X,
  Upload,
  Image as ImageIcon,
  ExternalLink,
  ChevronDown,
  Lock,
  RefreshCw,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { SpeciesBadge } from '../common/Badges';
import { sound } from '../../services/soundService';
import { getTodayVnDate, formatDateVi, isValidCalendarDate } from '../../utils/dateUtils';
import { addSchedule, updateSchedule, deleteSchedule, uploadMedicalDocument, getAppointments } from '../../services/storageService';
import { exportHealthRecordPdf } from '../../utils/healthRecordPdfGenerator';
import { apiFetch } from '../../services/apiService';
import { PageContainer, PageHeader, Tabs, Card, EmptyState, Modal } from '../common/ui';

/**
 * Tính trạng thái lịch nhắc nhở từ nextDueDate (Mục 3, 4, 7)
 * Tuyệt đối không suy diễn "còn miễn dịch"
 */
const calculateNextDueStatus = (nextDueDateStr, todayVn = getTodayVnDate()) => {
  if (!nextDueDateStr || typeof nextDueDateStr !== 'string' || !nextDueDateStr.trim()) {
    return {
      type: 'none',
      label: 'Chưa có ngày nhắc',
      badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
      daysDiff: null
    };
  }

  const trimmed = nextDueDateStr.trim();
  if (!isValidCalendarDate(trimmed)) {
    return {
      type: 'invalid',
      label: 'Ngày nhắc không hợp lệ',
      badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200 dark:border-rose-800',
      daysDiff: null
    };
  }

  const due = new Date(trimmed);
  const today = new Date(todayVn);
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      type: 'overdue',
      label: `Quá hạn ${Math.abs(diffDays)} ngày`,
      badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300 border-rose-300 dark:border-rose-700 font-bold',
      daysDiff: diffDays
    };
  } else if (diffDays === 0) {
    return {
      type: 'due_today',
      label: 'Đến hạn hôm nay',
      badgeClass: 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200 border-amber-300 dark:border-amber-700 font-bold animate-pulse',
      daysDiff: 0
    };
  } else if (diffDays <= 14) {
    return {
      type: 'soon',
      label: `Sắp đến hạn (còn ${diffDays} ngày)`,
      badgeClass: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      daysDiff: diffDays
    };
  } else {
    return {
      type: 'upcoming',
      label: `Định kỳ nhắc: ${formatDateVi(trimmed)}`,
      badgeClass: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      daysDiff: diffDays
    };
  }
};

export const MedicalRecordsView = ({
  pets = [],
  schedules = [],
  medicalRecords = [],
  prescriptions = [],
  appointments = [],
  currentUser = null,
  onExportPdf = null,
  selectedPetId: propSelectedPetId = null,
  onSelectPet = null
}) => {
  const [selectedPetId, setSelectedPetId] = useState(() => {
    if (propSelectedPetId && pets.some(p => p.id === propSelectedPetId)) return propSelectedPetId;
    try {
      const saved = localStorage.getItem('petcare_selected_pet_id');
      if (saved && pets.some(p => p.id === saved)) return saved;
    } catch {}
    return pets[0]?.id || null;
  });

  const [activeTab, setActiveTab] = useState('vaccines'); // 'vaccines' | 'parasites' | 'soap' | 'prescriptions'

  // Bản đồ tra cứu lịch khám liên kết (để lấy lý do khám thực tế, cơ sở và bác sĩ chính thức)
  const appointmentsMap = useMemo(() => {
    const map = new Map();
    const source = Array.isArray(appointments) && appointments.length > 0
      ? appointments
      : getAppointments(currentUser?.id, currentUser?.role);
    (source || []).forEach(a => {
      if (a?.id) map.set(a.id, a);
    });
    return map;
  }, [appointments, currentUser]);

  // Quản lý đồng bộ bé cưng đang chọn từ prop và kiểm tra tính hợp lệ
  useEffect(() => {
    if (propSelectedPetId && pets.some(p => p.id === propSelectedPetId) && propSelectedPetId !== selectedPetId) {
      setSelectedPetId(propSelectedPetId);
    } else if (pets.length === 0) {
      setSelectedPetId(null);
    } else if (selectedPetId && !pets.find(p => p.id === selectedPetId)) {
      setSelectedPetId(pets[0].id);
    } else if (!selectedPetId && pets.length > 0) {
      setSelectedPetId(pets[0].id);
    }
  }, [propSelectedPetId, pets, selectedPetId]);

  const handlePetChange = (newPetId) => {
    setSelectedPetId(newPetId);
    try {
      localStorage.setItem('petcare_selected_pet_id', newPetId);
    } catch {}
    if (onSelectPet) onSelectPet(newPetId);
  };

  const selectedPet = useMemo(() => {
    return pets.find(p => p.id === selectedPetId) || null;
  }, [pets, selectedPetId]);

  // Ref lưu lượt request sequence ID để ngăn kết quả bất đồng bộ của thú cưng trước ghi đè lên thú cưng sau (Race condition guard)
  const prescriptionReqSeqRef = useRef(0);
  const [fetchedPrescriptions, setFetchedPrescriptions] = useState(null);
  const [isFetchingPrescriptions, setIsFetchingPrescriptions] = useState(false);

  // Nạp đơn thuốc bất đồng bộ an toàn theo petId
  useEffect(() => {
    if (!selectedPet?.id) {
      setFetchedPrescriptions([]);
      return;
    }

    const currentPetId = selectedPet.id;
    const seq = ++prescriptionReqSeqRef.current;
    setIsFetchingPrescriptions(true);
    setTabError(prev => ({ ...prev, prescriptions: null }));

    const loadPrescriptionsForPet = async () => {
      try {
        const res = await apiFetch(`/prescriptions?petId=${encodeURIComponent(currentPetId)}`);
        // BẢO VỆ BẤT ĐỒNG BỘ: Chỉ ghi nhận nếu lượt request này vẫn là lượt mới nhất và đúng thú cưng hiện tại
        if (seq !== prescriptionReqSeqRef.current) {
          return;
        }
        const list = Array.isArray(res) ? res : [];
        setFetchedPrescriptions(list.filter(p => p && String(p.petId || '').trim() === String(currentPetId).trim() && p.isFinal === true && p.status === 'published'));
      } catch (err) {
        if (seq === prescriptionReqSeqRef.current) {
          console.warn('[MedicalRecordsView] Lỗi nạp đơn thuốc từ API, fallback sang props/cache:', err?.message);
          const fallback = (prescriptions || []).filter(p => p && String(p.petId || '').trim() === String(currentPetId).trim() && p.isFinal === true && p.status === 'published');
          setFetchedPrescriptions(fallback);
        }
      } finally {
        if (seq === prescriptionReqSeqRef.current) {
          setIsFetchingPrescriptions(false);
        }
      }
    };

    loadPrescriptionsForPet();
  }, [selectedPet?.id]);

  // Loading & error state cho từng tab
  const [tabLoading, setTabLoading] = useState({
    vaccines: false,
    parasites: false,
    soap: false,
    prescriptions: false
  });
  const [tabError, setTabError] = useState({
    vaccines: null,
    parasites: null,
    soap: null,
    prescriptions: null
  });

  // Toast thông báo
  const [toastMessage, setToastMessage] = useState(null);
  const showToast = (msg, isError = false) => {
    try {
      if (isError) sound?.playWarning?.();
      else sound?.playSuccess?.();
    } catch {}
    setToastMessage({ text: msg, isError });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // State Modal Thêm/Sửa Vaccine hoặc Ký sinh trùng
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  const [recordType, setRecordType] = useState('vaccine'); // 'vaccine' | 'parasite'
  const [editingRecord, setEditingRecord] = useState(null);

  // Form Fields
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState(getTodayVnDate());
  const [formBatchNumber, setFormBatchNumber] = useState('');
  const [formFacility, setFormFacility] = useState('');
  const [formDoctor, setFormDoctor] = useState('');
  const [formNextDueDate, setFormNextDueDate] = useState('');
  const [formDosage, setFormDosage] = useState('');
  const [formDosageUnit, setFormDosageUnit] = useState('viên');
  const [formPurpose, setFormPurpose] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formDocumentPhoto, setFormDocumentPhoto] = useState(null);
  const [formCreateReminder, setFormCreateReminder] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Modal Xem ảnh tài liệu phóng to (Lightbox)
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null);

  // Modal Xác nhận xóa
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modal Xác nhận tạo lịch nhắc hẹn (Mục 7)
  const [reminderTarget, setReminderTarget] = useState(null);
  const [isCreatingReminder, setIsCreatingReminder] = useState(false);

  // Trạng thái xuất hồ sơ sức khỏe PDF (Mục 1 & 8)
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfExportError, setPdfExportError] = useState(null);
  const [popupBlockedData, setPopupBlockedData] = useState(null);

  // --------------------------------------------------------------------------
  // DỮ LIỆU ĐƯỢC LỌC CHUẨN XÁC THEO THÚ CƯNG ĐANG CHỌN (KHÔNG LẪN DỮ LIỆU)
  // --------------------------------------------------------------------------

  // 1. Tiêm chủng của thú cưng
  const petVaccines = useMemo(() => {
    if (!selectedPet) return [];
    return schedules
      .filter(s => s.petId === selectedPet.id && s.type === 'vaccine' && !s.isPlanned)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [schedules, selectedPet]);

  // 2. Phòng ký sinh trùng của thú cưng
  const petParasites = useMemo(() => {
    if (!selectedPet) return [];
    return schedules
      .filter(s => s.petId === selectedPet.id && (s.type === 'parasite' || s.type === 'deworm') && !s.isPlanned)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [schedules, selectedPet]);

  // 3. Bệnh án đã ký chốt / công bố chính thức của thú cưng (Mục 5)
  const petMedicalRecords = useMemo(() => {
    if (!selectedPet) return [];
    return medicalRecords
      .filter(r => r.petId === selectedPet.id && r.isFinal === true && r.status === 'published')
      .sort((a, b) => (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || ''));
  }, [medicalRecords, selectedPet]);

  // 4. Đơn thuốc đã ký chốt / công bố chính thức của thú cưng (Mục 6 - Lọc chặt chẽ theo petId)
  const petPrescriptions = useMemo(() => {
    if (!selectedPet?.id) return [];
    const source = fetchedPrescriptions !== null ? fetchedPrescriptions : (prescriptions || []);
    return source
      .filter(p => p && String(p.petId || '').trim() === String(selectedPet.id).trim() && p.isFinal === true && p.status === 'published')
      .sort((a, b) => (b.createdAt || b.confirmedAt || b.startDate || '').localeCompare(a.createdAt || a.confirmedAt || a.startDate || ''));
  }, [fetchedPrescriptions, prescriptions, selectedPet]);

  // Danh sách các lịch nhắc hẹn tương lai liên kết với bản ghi
  const linkedRemindersMap = useMemo(() => {
    if (!selectedPet) return new Map();
    const map = new Map();
    schedules
      .filter(s => s.petId === selectedPet.id && s.sourceRecordId)
      .forEach(s => {
        map.set(s.sourceRecordId, s);
      });
    return map;
  }, [schedules, selectedPet]);

  // Mở modal thêm bản ghi mới
  const handleOpenAddModal = (type) => {
    setRecordType(type);
    setModalMode('add');
    setEditingRecord(null);
    setFormTitle('');
    setFormDate(getTodayVnDate());
    setFormBatchNumber('');
    setFormFacility('');
    setFormDoctor('');
    setFormNextDueDate('');
    setFormDosage('');
    setFormDosageUnit(type === 'parasite' ? 'viên' : 'ml');
    setFormPurpose(type === 'parasite' ? 'Phòng ngừa giun sán định kỳ' : '');
    setFormNotes('');
    setFormDocumentPhoto(null);
    setFormCreateReminder(true);
    setFormError(null);
    setIsRecordModalOpen(true);
  };

  // Mở modal sửa bản ghi
  const handleOpenEditModal = (rec, type) => {
    // Chủ nuôi chỉ sửa bản tự khai chưa xác nhận
    if (rec.isVerified || rec.source === 'vet_verified') {
      showToast('Bản ghi đã được Bác sĩ thú y xác nhận chuyên môn, không thể chỉnh sửa.', true);
      return;
    }
    setRecordType(type);
    setModalMode('edit');
    setEditingRecord(rec);
    setFormTitle(rec.title || rec.vaccineName || rec.medicationName || '');
    setFormDate(rec.date || getTodayVnDate());
    setFormBatchNumber(rec.batchNumber || '');
    setFormFacility(rec.facility || rec.location || '');
    setFormDoctor(rec.doctor || '');
    setFormNextDueDate(rec.nextDueDate || '');
    setFormDosage(rec.dosage !== undefined && rec.dosage !== null ? String(rec.dosage) : '');
    setFormDosageUnit(rec.dosageUnit || (type === 'parasite' ? 'viên' : 'ml'));
    setFormPurpose(rec.purpose || '');
    setFormNotes(rec.notes || '');
    setFormDocumentPhoto(rec.documentPhoto || null);
    setFormCreateReminder(false);
    setFormError(null);
    setIsRecordModalOpen(true);
  };

  // Tải ảnh giấy tờ y tế / sổ tiêm
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setFormError('Dung lượng ảnh vượt quá 5 MB. Vui lòng chọn tệp nhỏ hơn.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Data = event.target.result;
      try {
        setFormError(null);
        // Tải ảnh trực tiếp lên server để bảo đảm tính toàn vẹn và dung lượng nhẹ
        const res = await uploadMedicalDocument(base64Data, selectedPet?.id);
        if (res && res.url) {
          setFormDocumentPhoto(res.url);
          showToast('Đã tải ảnh tài liệu y tế thành công.');
        } else {
          setFormDocumentPhoto(base64Data);
        }
      } catch (err) {
        console.warn('Lỗi tải ảnh lên backend, dùng base64 tạm thời:', err);
        setFormDocumentPhoto(base64Data);
      }
    };
    reader.readAsDataURL(file);
  };

  // Lưu bản ghi (POST / PUT)
  const handleSubmitRecord = async (e) => {
    e.preventDefault();
    if (!selectedPet) return;
    setFormError(null);

    // Validation cơ bản ở Client
    const trimmedTitle = formTitle.trim();
    if (!trimmedTitle) {
      setFormError(recordType === 'vaccine' ? 'Vui lòng nhập tên vaccine.' : 'Vui lòng nhập tên thuốc/chế phẩm.');
      return;
    }

    if (!isValidCalendarDate(formDate)) {
      setFormError('Ngày thực hiện không hợp lệ trên lịch thực tế (YYYY-MM-DD).');
      return;
    }

    const todayVn = getTodayVnDate();
    if (formDate > todayVn) {
      setFormError(`Ngày thực tế (${formDate}) không được ở tương lai (hôm nay là ${todayVn}). Ngày dự kiến vui lòng tạo dưới dạng lịch hẹn.`);
      return;
    }

    let cleanedNextDue = null;
    if (formNextDueDate && formNextDueDate.trim()) {
      cleanedNextDue = formNextDueDate.trim();
      if (!isValidCalendarDate(cleanedNextDue)) {
        setFormError(recordType === 'vaccine' ? 'Ngày tiêm nhắc tiếp theo không hợp lệ trên lịch (YYYY-MM-DD).' : 'Ngày dùng nhắc tiếp theo không hợp lệ trên lịch (YYYY-MM-DD).');
        return;
      }
      if (cleanedNextDue <= formDate) {
        setFormError(`Ngày nhắc tiếp theo (${cleanedNextDue}) phải sau ngày thực hiện (${formDate}).`);
        return;
      }
    }

    let parsedDosage = undefined;
    if (formDosage && String(formDosage).trim()) {
      const num = Number(formDosage);
      if (isNaN(num) || num <= 0) {
        setFormError('Liều lượng phải là một số dương lớn hơn 0.');
        return;
      }
      parsedDosage = num;
      if (!formDosageUnit.trim()) {
        setFormError('Vui lòng chọn hoặc nhập đơn vị cho liều lượng.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const recordPayload = {
        petId: selectedPet.id,
        ownerId: selectedPet.ownerId,
        type: recordType,
        title: trimmedTitle,
        vaccineName: recordType === 'vaccine' ? trimmedTitle : undefined,
        medicationName: recordType === 'parasite' ? trimmedTitle : undefined,
        date: formDate,
        batchNumber: formBatchNumber.trim() || undefined,
        facility: formFacility.trim() || undefined,
        location: formFacility.trim() || undefined,
        doctor: formDoctor.trim() || undefined,
        nextDueDate: cleanedNextDue || undefined,
        dosage: parsedDosage,
        dosageUnit: parsedDosage ? formDosageUnit.trim() : undefined,
        purpose: recordType === 'parasite' ? (formPurpose.trim() || 'Phòng ngừa ký sinh trùng') : undefined,
        notes: formNotes.trim() || undefined,
        documentPhoto: formDocumentPhoto || undefined,
        isVerified: false,
        source: 'owner_declared',
        completed: true, // Bản ghi lịch sử y tế đã thực hiện
        isPlanned: false
      };

      let savedRecord;
      if (modalMode === 'add') {
        savedRecord = await addSchedule(recordPayload, selectedPet.ownerId);
        showToast(recordType === 'vaccine' ? 'Đã thêm mũi tiêm khai báo thành công.' : 'Đã thêm bản ghi phòng ký sinh trùng thành công.');
        
        // Nếu bật tùy chọn tạo lịch nhắc hẹn tự động và có ngày nhắc
        if (formCreateReminder && cleanedNextDue && savedRecord?.id) {
          try {
            const reminderPayload = {
              petId: selectedPet.id,
              ownerId: selectedPet.ownerId,
              type: recordType,
              title: `[Nhắc hẹn] ${trimmedTitle}`,
              date: cleanedNextDue,
              sourceRecordId: savedRecord.id,
              isPlanned: true,
              completed: false,
              notes: `Lịch nhắc tự động theo mũi ngày ${formatDateVi(formDate)}`
            };
            await addSchedule(reminderPayload, selectedPet.ownerId);
            showToast(`Đã tạo lịch nhắc hẹn vào ngày ${formatDateVi(cleanedNextDue)}.`);
          } catch (remErr) {
            console.warn('Lỗi tạo lịch nhắc liên kết:', remErr);
          }
        }
      } else {
        // Mode edit
        const updatePayload = {
          ...editingRecord,
          ...recordPayload,
          id: editingRecord.id
        };
        savedRecord = await updateSchedule(updatePayload, selectedPet.ownerId, currentUser?.role);
        showToast('Đã cập nhật bản ghi thành công.');

        // Cập nhật lịch nhắc liên kết nếu có và ngày nhắc thay đổi
        const linkedReminder = linkedRemindersMap.get(editingRecord.id);
        if (linkedReminder && cleanedNextDue && linkedReminder.date !== cleanedNextDue) {
          try {
            await updateSchedule({ ...linkedReminder, date: cleanedNextDue }, selectedPet.ownerId, currentUser?.role);
          } catch (remErr) {
            console.warn('Lỗi cập nhật lịch nhắc liên kết:', remErr);
          }
        }
      }

      setIsRecordModalOpen(false);
    } catch (err) {
      console.error('Lỗi lưu bản ghi y tế:', err);
      // Giữ form để người dùng thử lại, không báo thành công giả
      setFormError(err?.message || 'Lỗi khi lưu dữ liệu vào hệ thống. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xác nhận xóa bản ghi
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteSchedule(deleteTarget.id, selectedPet?.ownerId, currentUser?.role);
      showToast('Đã xóa bản ghi thành công.');
      setDeleteTarget(null);
    } catch (err) {
      console.error('Lỗi khi xóa bản ghi:', err);
      showToast(err?.message || 'Lỗi khi xóa bản ghi. Vui lòng thử lại.', true);
    } finally {
      setIsDeleting(false);
    }
  };

  // Tạo lịch nhắc hẹn chủ động theo yêu cầu (Mục 7)
  const handleConfirmCreateReminder = async () => {
    if (!reminderTarget || !selectedPet) return;
    setIsCreatingReminder(true);
    try {
      const reminderPayload = {
        petId: selectedPet.id,
        ownerId: selectedPet.ownerId,
        type: reminderTarget.type,
        title: `[Nhắc hẹn] ${reminderTarget.title}`,
        date: reminderTarget.nextDueDate,
        sourceRecordId: reminderTarget.id,
        isPlanned: true,
        completed: false,
        notes: `Lịch nhắc hẹn tạo theo bản ghi ngày ${formatDateVi(reminderTarget.date)}`
      };
      await addSchedule(reminderPayload, selectedPet.ownerId);
      showToast(`Đã tạo lịch nhắc hẹn vào ngày ${formatDateVi(reminderTarget.nextDueDate)}.`);
      setReminderTarget(null);
    } catch (err) {
      console.error('Lỗi tạo lịch nhắc:', err);
      showToast(err?.message || 'Lỗi tạo lịch nhắc. Vui lòng thử lại.', true);
    } finally {
      setIsCreatingReminder(false);
    }
  };

  // Xuất hồ sơ sức khỏe PDF (Mở cửa sổ in thực tế hoặc tự động tải file khi bị chặn popup)
  const handleExportPdf = async () => {
    if (!selectedPet) {
      showToast('Vui lòng chọn thú cưng để xuất hồ sơ sức khỏe.', true);
      return;
    }

    if (isExportingPdf) return; // Khóa bấm lặp

    setIsExportingPdf(true);
    setPdfExportError(null);
    setPopupBlockedData(null);

    try {
      // Lấy dữ liệu đã lưu trên backend của đúng thú cưng đang chọn
      const petSchedules = (schedules || []).filter(s => s && s.petId === selectedPet.id);
      const petMedicalRecords = (medicalRecords || []).filter(m => m && m.petId === selectedPet.id);
      const petPrescriptions = (prescriptions || []).filter(p => p && p.petId === selectedPet.id);

      await exportHealthRecordPdf({
        pet: selectedPet,
        schedules: petSchedules,
        medicalRecords: petMedicalRecords,
        prescriptions: petPrescriptions,
        currentUser: currentUser
      });

      try { sound?.playSuccess?.(); } catch {}
      // CHỈ hiển thị thông báo thành công khi cửa sổ in thực tế đã được mở
      showToast(`Đã mở cửa sổ in hồ sơ sức khỏe cho ${selectedPet.name}. Bạn có thể chọn "Lưu dưới dạng PDF" (Save as PDF) hoặc In.`);
    } catch (err) {
      console.error('Lỗi khi xuất hồ sơ sức khỏe PDF:', err);
      if (err.message === 'POPUP_BLOCKED' || err.code === 'POPUP_BLOCKED' || err.name === 'SecurityError') {
        const blobUrl = err.blobUrl;
        const fileName = err.fileName || `Ho_so_suc_khoe_${selectedPet.name}.html`;
        setPopupBlockedData({
          blobUrl,
          fileName,
          petName: selectedPet.name
        });
        const errorMsg = 'Trình duyệt đã chặn cửa sổ bật lên (popup) để in trực tiếp. Hệ thống đã tự động tải file tài liệu về máy. Bạn cũng có thể bấm vào nút "Mở tab in trực tiếp" bên dưới.';
        setPdfExportError(errorMsg);
        showToast('Trình duyệt chặn popup. Đã tự động tải file tài liệu về máy.', true);
      } else {
        const errorMsg = err.message || 'Không thể xuất hồ sơ sức khỏe PDF. Vui lòng thử lại.';
        setPdfExportError(errorMsg);
        showToast(errorMsg, true);
      }
    } finally {
      setIsExportingPdf(false);
    }
  };

  // --------------------------------------------------------------------------
  // TRƯỜNG HỢP CHƯA CÓ THÚ CƯNG TRONG HỆ THỐNG
  // --------------------------------------------------------------------------
  if (!selectedPet) {
    return (
      <PageContainer id="medical-page">
        <PageHeader 
          title="Hồ sơ sức khỏe"
          subtitle="Theo dõi sổ tiêm chủng, lịch phòng ký sinh trùng và bệnh án điện tử"
        />
        <EmptyState
          icon={PawPrint}
          title="Chưa có thú cưng"
          description="Vui lòng thêm thông tin thú cưng vào hệ thống để bắt đầu theo dõi hồ sơ sức khỏe, tiêm chủng và bệnh án y tế."
          actionLabel="+ Thêm thú cưng mới"
          onAction={() => window.dispatchEvent(new CustomEvent('petcare_open_add_pet'))}
        />
      </PageContainer>
    );
  }

  // Thông số hiển thị của thú cưng đang chọn
  const petSpeciesLabel = selectedPet.species === 'cat' ? 'Mèo' : selectedPet.species === 'dog' ? 'Chó' : (selectedPet.species || 'Chưa cập nhật');
  const petBreedLabel = selectedPet.breed || 'Chưa cập nhật';
  const petBirthDateLabel = selectedPet.birthDate ? formatDateVi(selectedPet.birthDate) : 'Chưa cập nhật';
  const petWeightLabel = selectedPet.weight ? `${selectedPet.weight} kg` : 'Chưa cập nhật';
  const petGenderLabel = selectedPet.gender === 'male' || selectedPet.gender === 'Đực' ? 'Đực' : selectedPet.gender === 'female' || selectedPet.gender === 'Cái' ? 'Cái' : 'Chưa cập nhật';
  const petNeuteredLabel = selectedPet.isNeutered ? 'Đã triệt sản' : 'Chưa triệt sản';
  const petMicrochipLabel = selectedPet.microchip || 'Chưa cập nhật';

  return (
    <PageContainer id="medical-page">
      
      {/* Toast thông báo */}
      {toastMessage && (
        <div className={`fixed bottom-8 right-8 z-50 px-5 py-3.5 rounded-2xl bg-white/95 dark:bg-slate-900/90 border shadow-2xl backdrop-blur-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 ${
          toastMessage.isError 
            ? 'border-rose-400 text-rose-700 dark:text-rose-300' 
            : 'border-emerald-400 text-emerald-700 dark:text-emerald-300'
        }`}>
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
            toastMessage.isError ? 'bg-rose-500/20 text-rose-600' : 'bg-emerald-500/20 text-emerald-600'
          }`}>
            {toastMessage.isError ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          </div>
          <span className="font-semibold text-xs">{toastMessage.text}</span>
        </div>
      )}

      {/* Thông báo lỗi xuất PDF / Bị chặn Popup nếu có */}
      {pdfExportError && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200 shadow-sm animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">{pdfExportError}</p>
              {popupBlockedData && (
                <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
                  Mẹo: Để tự động mở cửa sổ in trong các lần sau, hãy bấm vào biểu tượng "Popup bị chặn" trên thanh địa chỉ của trình duyệt và chọn "Luôn cho phép".
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0 w-full md:w-auto justify-end">
            {popupBlockedData?.blobUrl && (
              <>
                <a
                  href={popupBlockedData.blobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Mở tab in trực tiếp
                </a>
                <a
                  href={popupBlockedData.blobUrl}
                  download={popupBlockedData.fileName}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition-colors border border-slate-300 dark:border-slate-700"
                >
                  <Download className="w-3.5 h-3.5" />
                  Tải lại file (.html)
                </a>
              </>
            )}
            {typeof onExportPdf === 'function' && (
              <button
                type="button"
                onClick={() => onExportPdf(selectedPet.id)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition-colors border border-slate-300 dark:border-slate-700 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                Xem trước trong trang
              </button>
            )}
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              Thử lại
            </button>
            <button
              type="button"
              onClick={() => {
                setPdfExportError(null);
                setPopupBlockedData(null);
              }}
              className="p-1.5 rounded-xl hover:bg-amber-200/50 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 cursor-pointer"
              title="Đóng thông báo"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 1. Header Trang & Thao tác xuất PDF */}
      <PageHeader
        title="Hồ sơ sức khỏe"
        subtitle={`Theo dõi sổ tiêm chủng, lịch phòng ngừa ký sinh trùng và bệnh án của ${selectedPet.name}`}
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            {pets.length > 1 && (
              <div className="relative">
                <select
                  value={selectedPetId || ''}
                  onChange={(e) => handlePetChange(e.target.value)}
                  className="appearance-none bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-xs font-semibold px-3.5 py-2.5 pr-9 rounded-xl border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm"
                >
                  {pets.map(p => (
                    <option key={p.id} value={p.id}>
                      🐾 {p.name} ({p.species === 'cat' ? 'Mèo' : p.species === 'dog' ? 'Chó' : p.species})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}

            <button
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed text-white dark:text-slate-950 font-semibold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
              title="Xuất hồ sơ sức khỏe PDF của thú cưng đang chọn"
            >
              {isExportingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang xuất...</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  <span>Xuất hồ sơ sức khỏe PDF</span>
                </>
              )}
            </button>
          </div>
        }
      />

      {/* 2. Thẻ thông tin thú cưng thu gọn */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#12192A] border border-slate-200 dark:border-white/10 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center shadow-xs">
              {selectedPet.avatar ? (
                <img
                  src={selectedPet.avatar}
                  alt={selectedPet.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div 
                className={`w-full h-full items-center justify-center text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 ${selectedPet.avatar ? 'hidden' : 'flex'}`}
              >
                <PawPrint className="w-7 h-7 stroke-[1.8]" />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {selectedPet.name}
              </h2>
              <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-400/30">
                {petSpeciesLabel}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {petGenderLabel} • {petNeuteredLabel}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
              <span>Giống: <strong className="font-semibold text-slate-800 dark:text-slate-200">{petBreedLabel}</strong></span>
              <span>•</span>
              <span>Ngày sinh: <strong className="font-semibold text-slate-800 dark:text-slate-200">{petBirthDateLabel}</strong></span>
              <span>•</span>
              <span>Cân nặng: <strong className="font-semibold text-slate-800 dark:text-slate-200">{petWeightLabel}</strong></span>
              <span>•</span>
              <span>Microchip: <strong className="font-mono text-slate-800 dark:text-slate-200">{petMicrochipLabel}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Phân loại 4 Tab đồng bộ */}
      <Tabs
        tabs={[
          { id: 'vaccines', label: 'Tiêm chủng', icon: Syringe, badge: petVaccines.length },
          { id: 'parasites', label: 'Phòng ký sinh trùng', icon: ShieldCheck, badge: petParasites.length },
          { id: 'soap', label: 'Bệnh án', icon: Stethoscope, badge: petMedicalRecords.length },
          { id: 'prescriptions', label: 'Đơn thuốc', icon: Pill, badge: petPrescriptions.length }
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
        variant="pill"
      />

      {/* ---------------------------------------------------------------------- */}
      {/* 3. NỘI DUNG TAB 1: TIÊM CHỦNG (MỤC 3)                                    */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'vaccines' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Lịch Sử Tiêm Chủng</span>
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                  ({petVaccines.length} bản ghi)
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ghi nhận các mũi vaccine đã tiêm và thời hạn nhắc nhở theo quy chuẩn
              </p>
            </div>

            <button
              onClick={() => handleOpenAddModal('vaccine')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Khai báo mũi tiêm</span>
            </button>
          </div>

          {/* Danh sách thẻ vaccine */}
          {petVaccines.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-10 text-center rounded-2xl bg-white dark:bg-[#12192A] border border-slate-200/80 dark:border-white/10">
              <Syringe className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Chưa có bản ghi tiêm chủng</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-4">
                Thú cưng chưa có mũi tiêm nào được ghi nhận. Chủ nuôi có thể bấm "Khai báo mũi tiêm" để lưu lại lịch sử tiêm phòng.
              </p>
              <button
                onClick={() => handleOpenAddModal('vaccine')}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all cursor-pointer"
              >
                Khai báo mũi tiêm đầu tiên
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {petVaccines.map((vax) => {
                const dueStatus = calculateNextDueStatus(vax.nextDueDate);
                const isVetVerified = vax.isVerified || vax.source === 'vet_verified';
                const linkedReminder = linkedRemindersMap.get(vax.id);

                return (
                  <div 
                    key={vax.id}
                    className="p-4.5 rounded-2xl bg-white dark:bg-[#12192A] border border-slate-200/80 dark:border-white/10 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-3"
                  >
                    <div>
                      {/* Tiêu đề & Nguồn bản ghi */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                            {vax.title}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            {isVetVerified ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                <span>Bác sĩ xác nhận {vax.verifiedBy ? `(${vax.verifiedBy})` : ''}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                <span>Chủ nuôi khai báo</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Huy hiệu hạn nhắc nhở */}
                        <span className={`px-2 py-0.5 rounded-md text-[10px] border shrink-0 ${dueStatus.badgeClass}`}>
                          {dueStatus.label}
                        </span>
                      </div>

                      {/* Chi tiết thông số */}
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs text-slate-600 dark:text-slate-400 py-2 border-t border-b border-slate-100 dark:border-white/5">
                        <div>
                          <span className="text-slate-400 dark:text-slate-500">Ngày tiêm: </span>
                          <strong className="font-semibold text-slate-800 dark:text-slate-200">{formatDateVi(vax.date)}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 dark:text-slate-500">Số lô: </span>
                          <strong className="font-mono text-slate-800 dark:text-slate-200">{vax.batchNumber || 'Chưa cập nhật'}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 dark:text-slate-500">Cơ sở / Bác sĩ: </span>
                          <span className="text-slate-800 dark:text-slate-200">{vax.facility || vax.location || vax.doctor || 'Chưa cập nhật'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 dark:text-slate-500">Tiêm nhắc tiếp theo: </span>
                          <strong className="text-slate-800 dark:text-slate-200">{vax.nextDueDate ? formatDateVi(vax.nextDueDate) : 'Chưa có'}</strong>
                        </div>
                      </div>

                      {/* Ghi chú hoặc hình ảnh đính kèm nếu có */}
                      {vax.notes && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 italic">
                          "{vax.notes}"
                        </p>
                      )}

                      {vax.documentPhoto && (
                        <div className="mt-2.5 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPreviewPhotoUrl(vax.documentPhoto)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors cursor-pointer"
                          >
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>Xem ảnh giấy tiêm chủng</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Thanh tác vụ: Đặt lịch nhắc & Sửa/Xóa theo phân quyền */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                      {/* Đặt lịch nhắc */}
                      {vax.nextDueDate ? (
                        linkedReminder ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                            <Check className="w-3.5 h-3.5" />
                            <span>Đã liên kết lịch nhắc ({formatDateVi(linkedReminder.date)})</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setReminderTarget(vax)}
                            className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-semibold cursor-pointer"
                          >
                            <Bell className="w-3.5 h-3.5" />
                            <span>Tạo lịch nhắc hẹn</span>
                          </button>
                        )
                      ) : (
                        <span className="text-[11px] text-slate-400 dark:text-slate-600">Không có ngày nhắc</span>
                      )}

                      {/* Tác vụ Sửa / Xóa */}
                      <div className="flex items-center gap-1.5">
                        {isVetVerified ? (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1" title="Bác sĩ xác nhận: Không thể chỉnh sửa trực tiếp">
                            <Lock className="w-3 h-3" />
                            <span>Đã khóa</span>
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(vax, 'vaccine')}
                              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                              title="Chỉnh sửa bản khai báo"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(vax)}
                              className="p-1.5 rounded-lg text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                              title="Xóa bản khai báo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 4. NỘI DUNG TAB 2: PHÒNG KÝ SINH TRÙNG (MỤC 4)                           */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'parasites' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Phòng Ngừa Ký Sinh Trùng</span>
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                  ({petParasites.length} bản ghi)
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ghi nhận các đợt uống thuốc tẩy giun sán, nhỏ gáy phòng ve rận bọ chét định kỳ
              </p>
            </div>

            <button
              onClick={() => handleOpenAddModal('parasite')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Khai báo phòng ký sinh trùng</span>
            </button>
          </div>

          {petParasites.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-10 text-center rounded-2xl bg-white dark:bg-[#12192A] border border-slate-200/80 dark:border-white/10">
              <ShieldCheck className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Chưa có lịch sử phòng ký sinh trùng</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-4">
                Chưa có ghi nhận nào về tẩy giun hoặc phòng ve rận. Chủ nuôi có thể bấm "Khai báo phòng ký sinh trùng" để ghi lại.
              </p>
              <button
                onClick={() => handleOpenAddModal('parasite')}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all cursor-pointer"
              >
                Khai báo đợt phòng ngừa đầu tiên
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {petParasites.map((item) => {
                const dueStatus = calculateNextDueStatus(item.nextDueDate);
                const isVetVerified = item.isVerified || item.source === 'vet_verified';
                const linkedReminder = linkedRemindersMap.get(item.id);

                return (
                  <div 
                    key={item.id}
                    className="p-4.5 rounded-2xl bg-white dark:bg-[#12192A] border border-slate-200/80 dark:border-white/10 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                            {item.title}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            {isVetVerified ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                <span>Bác sĩ xác nhận {item.verifiedBy ? `(${item.verifiedBy})` : ''}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                <span>Chủ nuôi khai báo</span>
                              </span>
                            )}
                          </div>
                        </div>

                        <span className={`px-2 py-0.5 rounded-md text-[10px] border shrink-0 ${dueStatus.badgeClass}`}>
                          {dueStatus.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs text-slate-600 dark:text-slate-400 py-2 border-t border-b border-slate-100 dark:border-white/5">
                        <div>
                          <span className="text-slate-400 dark:text-slate-500">Mục đích: </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{item.purpose || 'Phòng ngừa ký sinh trùng'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 dark:text-slate-500">Ngày sử dụng: </span>
                          <strong className="font-semibold text-slate-800 dark:text-slate-200">{formatDateVi(item.date)}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 dark:text-slate-500">Liều lượng: </span>
                          <span className="text-slate-800 dark:text-slate-200">
                            {item.dosage ? `${item.dosage} ${item.dosageUnit || ''}` : 'Chưa cập nhật'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 dark:text-slate-500">Ngày dùng nhắc: </span>
                          <strong className="text-slate-800 dark:text-slate-200">{item.nextDueDate ? formatDateVi(item.nextDueDate) : 'Chưa có'}</strong>
                        </div>
                      </div>

                      {item.notes && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 italic">
                          "{item.notes}"
                        </p>
                      )}

                      {item.documentPhoto && (
                        <div className="mt-2.5 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPreviewPhotoUrl(item.documentPhoto)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors cursor-pointer"
                          >
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>Xem ảnh giấy tờ / vỏ thuốc</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                      {item.nextDueDate ? (
                        linkedReminder ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                            <Check className="w-3.5 h-3.5" />
                            <span>Đã liên kết lịch nhắc ({formatDateVi(linkedReminder.date)})</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setReminderTarget(item)}
                            className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-semibold cursor-pointer"
                          >
                            <Bell className="w-3.5 h-3.5" />
                            <span>Tạo lịch nhắc hẹn</span>
                          </button>
                        )
                      ) : (
                        <span className="text-[11px] text-slate-400 dark:text-slate-600">Không có ngày nhắc</span>
                      )}

                      <div className="flex items-center gap-1.5">
                        {isVetVerified ? (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            <span>Đã khóa</span>
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(item, 'parasite')}
                              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                              title="Chỉnh sửa bản khai báo"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(item)}
                              className="p-1.5 rounded-lg text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                              title="Xóa bản khai báo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 5. NỘI DUNG TAB 3: BỆNH ÁN SOAP (MỤC 5)                                  */}
      {/* Chỉ xem bệnh án đã công bố (isFinal && published); không hiện bản nháp */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'soap' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Hồ Sơ Bệnh Án Điện Tử (SOAP)</span>
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                ({petMedicalRecords.length} ca khám đã chốt)
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Bệnh án do Bác sĩ thú y trực tiếp thăm khám, chẩn đoán và ký chốt lưu trữ chính thức
            </p>
          </div>

          {petMedicalRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-10 text-center rounded-2xl bg-white dark:bg-[#12192A] border border-slate-200/80 dark:border-white/10">
              <Stethoscope className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Chưa có bệnh án chính thức</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                Khi bé cưng đến khám tại cơ sở y tế và Bác sĩ hoàn thành chốt bệnh án SOAP, hồ sơ khám sẽ tự động xuất hiện tại đây.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {petMedicalRecords.map((record) => {
                const matchedAppt = record.appointmentId ? appointmentsMap.get(record.appointmentId) : null;
                const reasonText = (
                  record.chiefComplaint ||
                  record.reason ||
                  matchedAppt?.note ||
                  matchedAppt?.service ||
                  record.service ||
                  'Khám theo lịch hẹn'
                ).trim();

                const doctorText = (
                  record.vetName ||
                  record.doctor ||
                  record.confirmedBy ||
                  record.authorName ||
                  matchedAppt?.assignedVet ||
                  'Bác sĩ PetCare'
                ).trim();

                const facilityText = (
                  record.facility ||
                  record.clinic ||
                  matchedAppt?.facility ||
                  'Phòng khám PetCare'
                ).trim();

                // Đọc đúng nội dung SOAP từ record.soap hoặc root record, làm sạch khoảng trắng/ký tự thụt đầu dòng (\t)
                const rawSubjective = record.soap?.subjective !== undefined && record.soap?.subjective !== null
                  ? record.soap.subjective
                  : (record.subjective || record.symptoms || '');
                const subjectiveText = String(rawSubjective).trim();

                const rawObjective = record.soap?.objective !== undefined && record.soap?.objective !== null
                  ? record.soap.objective
                  : (record.objective || record.vitalSigns || '');
                const objectiveText = String(rawObjective).trim();

                const rawAssessment = record.soap?.assessment !== undefined && record.soap?.assessment !== null
                  ? record.soap.assessment
                  : (record.assessment || record.diagnosis || '');
                const assessmentText = String(rawAssessment).trim();

                const rawPlan = record.soap?.plan !== undefined && record.soap?.plan !== null
                  ? record.soap.plan
                  : (record.plan || record.treatmentPlan || '');
                const planText = String(rawPlan).trim();

                return (
                  <div 
                    key={record.id}
                    className="p-5 rounded-2xl bg-white dark:bg-[#12192A] border border-slate-200/80 dark:border-white/10 shadow-sm space-y-4"
                  >
                    {/* Header bệnh án: Ngày khám, Bác sĩ, Cơ sở, Lý do khám */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/5">
                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <span>Bệnh án chính thức đã công bố</span>
                          </span>
                          <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
                            Mã: {record.id}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                          Lý do khám: {reasonText}
                        </h3>
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-400 sm:text-right space-y-0.5">
                        <div>Ngày khám: <strong className="font-semibold text-slate-900 dark:text-slate-100">{formatDateVi(record.date || record.createdAt)}</strong></div>
                        <div>Bác sĩ: <strong className="text-slate-800 dark:text-slate-200">{doctorText}</strong></div>
                        <div>Cơ sở: <span className="text-slate-700 dark:text-slate-300">{facilityText}</span></div>
                      </div>
                    </div>

                    {/* Chi tiết 4 khối SOAP */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {/* S */}
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5">
                        <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <span>S (Subjective) • Triệu chứng chủ quan</span>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                          {subjectiveText || 'Chưa có thông tin ghi nhận.'}
                        </p>
                      </div>

                      {/* O */}
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5">
                        <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <span>O (Objective) • Dấu hiệu lâm sàng & Xét nghiệm</span>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                          {objectiveText || 'Chưa có thông tin ghi nhận.'}
                        </p>
                      </div>

                      {/* A */}
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5">
                        <div className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <span>A (Assessment) • Chẩn đoán chuyên môn</span>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line font-medium">
                          {assessmentText || 'Chưa có thông tin ghi nhận.'}
                        </p>
                      </div>

                      {/* P */}
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5">
                        <div className="text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <span>P (Plan) • Phác đồ điều trị</span>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                          {planText || 'Chưa có thông tin ghi nhận.'}
                        </p>
                      </div>
                    </div>

                    {/* Lời dặn & Hướng dẫn theo dõi */}
                    {(record.instructions || record.notes) && (
                      <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 text-xs text-indigo-900 dark:text-indigo-200">
                        <strong>Lời dặn của Bác sĩ: </strong>
                        <span>{record.instructions || record.notes}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 6. NỘI DUNG TAB 4: ĐƠN THUỐC (MỤC 6)                                    */}
      {/* Đọc từ nguồn thống nhất đã liên kết; không hiện đơn nháp                 */}
      {/* Không tự suy ra đã uống thuốc; Chủ nuôi không sửa/xóa/tạo đơn           */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'prescriptions' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Đơn Thuốc Chuyên Môn</span>
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                ({petPrescriptions.length} đơn thuốc chính thức)
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Đơn thuốc được cấp theo bệnh án khám chữa bệnh chính thức của Bác sĩ thú y
            </p>
          </div>

          {isFetchingPrescriptions ? (
            <div className="flex flex-col items-center justify-center p-10 text-center rounded-2xl bg-white dark:bg-[#12192A] border border-slate-200/80 dark:border-white/10">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-2" />
              <p className="text-xs text-slate-500 dark:text-slate-400">Đang đồng bộ đơn thuốc của {selectedPet.name}...</p>
            </div>
          ) : petPrescriptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-10 text-center rounded-2xl bg-white dark:bg-[#12192A] border border-slate-200/80 dark:border-white/10">
              <Pill className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Chưa có đơn thuốc chính thức</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                Đơn thuốc sẽ tự động hiển thị tại đây khi Bác sĩ hoàn thành chốt bệnh án và ban hành đơn thuốc.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {petPrescriptions.map((pres) => {
                const medsList = Array.isArray(pres.medications) && pres.medications.length > 0
                  ? pres.medications
                  : [{
                      name: pres.medicineName || 'Thuốc theo chỉ định',
                      dose: pres.dosage || 'Theo chỉ dẫn',
                      unit: 'Chưa có thông tin',
                      route: 'Chưa có thông tin',
                      freq: 'Chưa có thông tin',
                      days: pres.durationDays || 'Chưa có thông tin',
                      instructions: pres.notes || 'Chưa có thông tin'
                    }];

                return (
                  <div 
                    key={pres.id}
                    className="p-5 rounded-2xl bg-white dark:bg-[#12192A] border border-slate-200/80 dark:border-white/10 shadow-sm space-y-4"
                  >
                    {/* Header Đơn thuốc */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <span>Đơn thuốc đã ký chốt</span>
                          </span>
                          <span className="text-xs font-mono text-slate-400 dark:text-slate-500">Mã: {pres.id}</span>
                        </div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                          Chẩn đoán: {pres.diagnosis || pres.purpose || 'Điều trị theo chỉ định y tế'}
                        </h3>
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-400 sm:text-right space-y-0.5">
                        <div>Bác sĩ kê đơn: <strong className="font-semibold text-slate-800 dark:text-slate-200">{pres.prescribedBy || pres.vetName || 'Bác sĩ PetCare'}</strong></div>
                        <div>Ngày kê: <span className="font-medium text-slate-700 dark:text-slate-300">{formatDateVi(pres.createdAt || pres.confirmedAt || pres.startDate)}</span></div>
                      </div>
                    </div>

                    {/* Danh sách thuốc được kê */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400">
                            <th className="py-2 px-3 font-semibold">Tên thuốc</th>
                            <th className="py-2 px-3 font-semibold">Liều lượng</th>
                            <th className="py-2 px-3 font-semibold">Đường dùng</th>
                            <th className="py-2 px-3 font-semibold">Tần suất</th>
                            <th className="py-2 px-3 font-semibold">Thời gian</th>
                            <th className="py-2 px-3 font-semibold">Hướng dẫn sử dụng</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                          {medsList.map((m, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                              <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                                {m.name || 'Chưa có thông tin'}
                              </td>
                              <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                                {m.dose || m.dosage || 'Chưa có thông tin'} {m.unit || ''}
                              </td>
                              <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                                {m.route || 'Chưa có thông tin'}
                              </td>
                              <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                                {m.freq || 'Chưa có thông tin'}
                              </td>
                              <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                                {m.days || m.durationDays ? `${m.days || m.durationDays} ngày` : 'Chưa có thông tin'}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                                {m.instructions || m.usage || m.notes || 'Chưa có thông tin'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {pres.notes && (
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 text-xs text-slate-600 dark:text-slate-400">
                        <strong>Ghi chú đơn thuốc: </strong>
                        <span>{pres.notes}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 7. MODAL KHAI BÁO / CHỈNH SỬA BẢN GHI (TIÊM CHỦNG & KÝ SINH TRÙNG)      */}
      {/* ---------------------------------------------------------------------- */}
      <Modal
        isOpen={isRecordModalOpen}
        onClose={() => !isSubmitting && setIsRecordModalOpen(false)}
        title={modalMode === 'add' 
          ? (recordType === 'vaccine' ? 'Khai báo mũi tiêm mới' : 'Khai báo phòng ký sinh trùng') 
          : (recordType === 'vaccine' ? 'Chỉnh sửa bản khai tiêm chủng' : 'Chỉnh sửa phòng ký sinh trùng')}
        size="md"
      >
        {isRecordModalOpen && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Bé cưng: <strong className="text-slate-800 dark:text-slate-200">{selectedPet.name}</strong> • Nguồn: Chủ nuôi khai báo
            </p>

            {/* Error Banner */}
            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {/* Form Fields */}
            <form onSubmit={handleSubmitRecord} className="space-y-3.5">
              {/* Tên vaccine / Tên thuốc */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {recordType === 'vaccine' ? 'Tên Vaccine *' : 'Tên thuốc / Chế phẩm *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={recordType === 'vaccine' ? 'Ví dụ: Nobivac DHPPi, Rabisin...' : 'Ví dụ: Nexgard Spectra, Drontal...'}
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Mục đích phòng ngừa (Chỉ với ký sinh trùng) */}
              {recordType === 'parasite' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Mục đích phòng ngừa *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Tẩy giun sán định kỳ, Nhỏ gáy phòng ve rận..."
                    value={formPurpose}
                    onChange={(e) => setFormPurpose(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              {/* Ngày thực hiện & Ngày nhắc tiếp theo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {recordType === 'vaccine' ? 'Ngày tiêm thực tế *' : 'Ngày sử dụng thực tế *'}
                  </label>
                  <input
                    type="date"
                    required
                    max={getTodayVnDate()}
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Không chọn ngày tương lai</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Ngày nhắc tiếp theo (Nếu có)
                  </label>
                  <input
                    type="date"
                    min={formDate || getTodayVnDate()}
                    value={formNextDueDate}
                    onChange={(e) => setFormNextDueDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Phải sau ngày thực hiện</span>
                </div>
              </div>

              {/* Liều lượng và Đơn vị (Chỉ với ký sinh trùng hoặc vaccine có liều) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Liều lượng (Nếu có)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="Ví dụ: 1, 0.5..."
                    value={formDosage}
                    onChange={(e) => setFormDosage(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Đơn vị
                  </label>
                  <select
                    value={formDosageUnit}
                    onChange={(e) => setFormDosageUnit(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="viên">Viên</option>
                    <option value="ml">ml</option>
                    <option value="tuýp">Tuýp</option>
                    <option value="gói">Gói</option>
                    <option value="mg">mg</option>
                  </select>
                </div>
              </div>

              {/* Số lô & Bác sĩ / Cơ sở */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Số lô sản xuất (Nếu có)
                  </label>
                  <input
                    type="text"
                    placeholder="Ví dụ: LOT-2026A"
                    value={formBatchNumber}
                    onChange={(e) => setFormBatchNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {recordType === 'vaccine' ? 'Cơ sở tiêm / Bác sĩ (Nếu có)' : 'Cơ sở cấp phát / Bác sĩ / Nơi mua (Nếu có)'}
                  </label>
                  <input
                    type="text"
                    placeholder={recordType === 'vaccine' ? 'Ví dụ: PetCare Central, BS Nam...' : 'Ví dụ: Phòng khám thú y, Nhà thuốc, Tự cho uống tại nhà...'}
                    value={formFacility}
                    onChange={(e) => setFormFacility(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Tải ảnh giấy tờ sổ tiêm / vỏ thuốc */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {recordType === 'vaccine' ? 'Ảnh giấy tờ sổ tiêm / Vỏ thuốc (Tùy chọn)' : 'Ảnh vỏ thuốc / Vỉ chế phẩm / Hướng dẫn sử dụng (Tùy chọn)'}
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Chọn tệp ảnh</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                  {formDocumentPhoto && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Đã chọn ảnh</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setFormDocumentPhoto(null)}
                        className="text-xs text-rose-500 hover:text-rose-600 underline cursor-pointer"
                      >
                        Bỏ ảnh
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Ghi chú */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Ghi chú thêm
                </label>
                <textarea
                  rows={2}
                  placeholder={recordType === 'vaccine' ? 'Triệu chứng phản ứng sau tiêm hoặc lưu ý...' : 'Phản ứng sau khi dùng chế phẩm hoặc lưu ý theo dõi...'}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Checkbox tạo lịch nhắc hẹn tự động */}
              {modalMode === 'add' && formNextDueDate && (
                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 text-xs text-indigo-900 dark:text-indigo-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formCreateReminder}
                    onChange={(e) => setFormCreateReminder(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <span>Tự động tạo lịch nhắc hẹn vào ngày {formatDateVi(formNextDueDate)}</span>
                </label>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-white/10">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsRecordModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all active:scale-95 cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <span>{modalMode === 'add' ? 'Lưu bản khai báo' : 'Cập nhật bản ghi'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </Modal>

      {/* ---------------------------------------------------------------------- */}
      {/* 8. MODAL XÁC NHẬN XÓA BẢN GHI                                          */}
      {/* ---------------------------------------------------------------------- */}
      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        title="Xác nhận xóa bản ghi"
        size="sm"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Bạn có chắc chắn muốn xóa bản ghi <strong>"{deleteTarget.title}"</strong> ngày {formatDateVi(deleteTarget.date)}? Các lịch nhắc liên kết (nếu có) cũng sẽ được dọn dẹp.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-white/5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm cursor-pointer disabled:opacity-60"
              >
                {isDeleting ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ---------------------------------------------------------------------- */}
      {/* 9. MODAL XÁC NHẬN TẠO LỊCH NHẮC HẸN (MỤC 7)                             */}
      {/* ---------------------------------------------------------------------- */}
      <Modal
        isOpen={Boolean(reminderTarget)}
        onClose={() => !isCreatingReminder && setReminderTarget(null)}
        title="Tạo lịch nhắc hẹn"
        size="sm"
      >
        {reminderTarget && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5" />
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Hệ thống sẽ tạo một lịch nhắc hẹn cho <strong>{selectedPet.name}</strong> vào ngày <strong>{formatDateVi(reminderTarget.nextDueDate)}</strong> đối với nội dung: <strong>{reminderTarget.title}</strong>.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-white/5">
              <button
                type="button"
                disabled={isCreatingReminder}
                onClick={() => setReminderTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isCreatingReminder}
                onClick={handleConfirmCreateReminder}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm cursor-pointer disabled:opacity-60"
              >
                {isCreatingReminder ? 'Đang tạo...' : 'Xác nhận tạo lịch'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ---------------------------------------------------------------------- */}
      {/* 10. LIGHTBOX XEM ẢNH TÀI LIỆU PHÓNG TO                                  */}
      {/* ---------------------------------------------------------------------- */}
      <Modal
        isOpen={Boolean(previewPhotoUrl)}
        onClose={() => setPreviewPhotoUrl(null)}
        title="Ảnh tài liệu y tế / Giấy tờ hồ sơ"
        size="lg"
      >
        {previewPhotoUrl && (
          <div className="flex items-center justify-center p-2 max-h-[75vh] overflow-auto rounded-xl">
            <img 
              src={previewPhotoUrl} 
              alt="Tài liệu y tế" 
              className="max-w-full max-h-[70vh] object-contain rounded-xl"
            />
          </div>
        )}
      </Modal>

    </PageContainer>
  );
};

export default MedicalRecordsView;
