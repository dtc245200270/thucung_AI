import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Stethoscope, 
  FileText, 
  Save, 
  CheckCircle2, 
  Lock, 
  Plus, 
  Trash2, 
  Calendar, 
  AlertCircle, 
  Clock, 
  User, 
  Phone, 
  PawPrint,
  Pill,
  Send,
  ShieldCheck,
  ChevronDown,
  X
} from 'lucide-react';
import { 
  getMedicalRecords, 
  addMedicalRecord, 
  updateMedicalRecord, 
  finalizeEhrAndAppointment,
  addSchedule
} from '../../services/storageService';
import { sound } from '../../services/soundService';

export const VetSoapTab = ({
  appointments = [],
  pets = [],
  currentUser,
  initialAppointmentId = null,
  onAppointmentCompleted,
  onConfirmAppointment,
  onStartExam,
  onOpenLateAdmission,
  onSelectAppointment,
  confirmingAppId = null,
  startingAppId = null,
  actionErrorMap = {}
}) => {
  // Helper kiểm tra ca khám quá giờ
  const isPastAppointment = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return false;
    try {
      const now = new Date();
      const [year, month, day] = dateStr.split('-').map(Number);
      const [hours, minutes] = timeStr.split(':').map(Number);
      const appDate = new Date(year, month - 1, day, hours || 0, minutes || 0);
      return now.getTime() > appDate.getTime();
    } catch {
      return false;
    }
  };
  // Lọc danh sách ca khám thuộc về bác sĩ (hoặc tất cả nếu là admin)
  const doctorAppointments = useMemo(() => {
    return appointments.filter(a => {
      if (currentUser?.role === 'system_admin') return true;
      return a.assignedVetId === currentUser?.id || a.vetId === currentUser?.id;
    });
  }, [appointments, currentUser]);

  // ID ca khám đang chọn
  const [selectedAppId, setSelectedAppId] = useState(() => {
    try {
      const savedExamId = localStorage.getItem('petcare_vet_active_exam_id');
      if (savedExamId && doctorAppointments.some(a => a.id === savedExamId)) {
        return savedExamId;
      }
    } catch {}
    if (initialAppointmentId && doctorAppointments.some(a => a.id === initialAppointmentId)) {
      return initialAppointmentId;
    }
    const inProgress = doctorAppointments.find(a => a.status === 'in_progress');
    if (inProgress) return inProgress.id;
    const confirmed = doctorAppointments.find(a => a.status === 'confirmed');
    if (confirmed) return confirmed.id;
    return doctorAppointments[0]?.id || '';
  });

  // Ref lưu vết initialAppointmentId để tránh ghi đè khi bác sĩ chủ động đổi ca trên dropdown
  const lastInitialAppIdRef = useRef(initialAppointmentId);

  // Cập nhật khi initialAppointmentId thay đổi từ bên ngoài (ví dụ bấm Bắt đầu khám từ tab khác hoặc xem chi tiết bệnh án)
  useEffect(() => {
    if (initialAppointmentId) {
      if (selectedAppId !== initialAppointmentId && doctorAppointments.some(a => a.id === initialAppointmentId)) {
        setSelectedAppId(initialAppointmentId);
      }
      lastInitialAppIdRef.current = initialAppointmentId;
    } else if (!selectedAppId && doctorAppointments.length > 0) {
      if (initialAppointmentId && doctorAppointments.some(a => a.id === initialAppointmentId)) {
        lastInitialAppIdRef.current = initialAppointmentId;
        setSelectedAppId(initialAppointmentId);
      } else {
        const inProgress = doctorAppointments.find(a => a.status === 'in_progress');
        const confirmed = doctorAppointments.find(a => a.status === 'confirmed');
        setSelectedAppId(inProgress?.id || confirmed?.id || doctorAppointments[0].id);
      }
    }
  }, [initialAppointmentId, doctorAppointments, selectedAppId]);

  // Lưu ca đang mở vào localStorage để khôi phục chính xác sau F5
  useEffect(() => {
    if (selectedAppId) {
      try {
        localStorage.setItem('petcare_vet_active_exam_id', selectedAppId);
      } catch {}
      onSelectAppointment?.(selectedAppId);
    }
  }, [selectedAppId, onSelectAppointment]);

  // Ca khám đang được chọn
  const selectedAppointment = useMemo(() => {
    return doctorAppointments.find(a => a.id === selectedAppId) || null;
  }, [doctorAppointments, selectedAppId]);

  // Thú cưng tương ứng
  const selectedPet = useMemo(() => {
    if (!selectedAppointment?.petId) return null;
    return pets.find(p => p.id === selectedAppointment.petId) || null;
  }, [selectedAppointment, pets]);

  // KHAI BÁO CÁC STATE CỦA TAB TRƯỚC KHI TÍNH TOÁN BIẾN PHỤ THUỘC (TRÁNH TEMPORAL DEAD ZONE)
  // Danh sách bệnh án từ máy chủ
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [isLoadingRecord, setIsLoadingRecord] = useState(false);

  // Form SOAP state
  const [soapData, setSoapData] = useState({
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
    temp: '',
    heartRate: '',
    respiratoryRate: '',
    weight: '',
    prescriptions: []
  });

  const [activeRecordId, setActiveRecordId] = useState(null);
  const [isFinalized, setIsFinalized] = useState(false);
  const [finalizedInfo, setFinalizedInfo] = useState(null);

  // Lưu nháp (Draft)
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftToast, setDraftToast] = useState('');

  // Modal chốt bệnh án
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState('');

  // Modal tạo nhắc lịch tái khám
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [reminderForm, setReminderForm] = useState({
    date: '',
    time: '09:00',
    title: 'Tái khám định kỳ theo phác đồ bác sĩ',
    notes: ''
  });
  const [isSavingReminder, setIsSavingReminder] = useState(false);
  const [reminderSuccessMsg, setReminderSuccessMsg] = useState('');
  const [reminderErrorMsg, setReminderErrorMsg] = useState('');
  const isSavingReminderRef = useRef(false);

  // Form SOAP chỉ mở khóa khi ca đang trong quá trình khám thực tế (in_progress) và chưa chốt
  const isFormDisabled = Boolean(
    isFinalized || 
    !selectedAppointment || 
    selectedAppointment.status !== 'in_progress'
  );

  // Ref lưu ID ca khám đã nạp dữ liệu để tránh nạp đè làm mất thông tin bác sĩ đang gõ
  const loadedAppIdRef = useRef(null);

  // Tải bệnh án gắn với ca khám hiện tại
  useEffect(() => {
    let isMounted = true;
    if (!selectedAppId) {
      loadedAppIdRef.current = null;
      setSoapData({
        subjective: '',
        objective: '',
        assessment: '',
        plan: '',
        temp: '',
        heartRate: '',
        respiratoryRate: '',
        weight: '',
        prescriptions: []
      });
      setIsFinalized(false);
      setActiveRecordId(null);
      return;
    }

    // Nếu ca khám không thay đổi và đã nạp rồi, không tự ý nạp đè làm mất dữ liệu bác sĩ đang gõ
    if (loadedAppIdRef.current === selectedAppId) {
      return;
    }

    const loadRecords = async () => {
      setIsLoadingRecord(true);
      try {
        const records = await getMedicalRecords(currentUser?.id, currentUser?.role);
        if (!isMounted) return;
        setMedicalRecords(Array.isArray(records) ? records : []);

        const matchedRecord = (records || []).find(r => r.appointmentId === selectedAppId);
        if (matchedRecord) {
          loadedAppIdRef.current = selectedAppId;
          setActiveRecordId(matchedRecord.id);
          setIsFinalized(Boolean(matchedRecord.isFinal || matchedRecord.status === 'published'));
          setFinalizedInfo({
            confirmedBy: matchedRecord.confirmedBy || matchedRecord.authorName,
            confirmedAt: matchedRecord.confirmedAt || matchedRecord.createdAt
          });

          const sp = matchedRecord.soap || {};
          const meds = Array.isArray(matchedRecord.prescriptions) && matchedRecord.prescriptions.length > 0 
            ? matchedRecord.prescriptions 
            : Array.isArray(sp.planMedications) ? sp.planMedications : [];

          setSoapData({
            subjective: sp.subjective || matchedRecord.subjective || '',
            objective: sp.objective || matchedRecord.objective || '',
            assessment: sp.assessment || matchedRecord.assessment || matchedRecord.diagnosis || '',
            plan: sp.plan || matchedRecord.plan || '',
            temp: sp.temp || '',
            heartRate: sp.heartRate || '',
            respiratoryRate: sp.respiratoryRate || '',
            weight: sp.weight || '',
            prescriptions: meds
          });
        } else {
          // Chưa có bệnh án: Tạo form rỗng với dữ liệu ban đầu từ lịch khám, không tự động gán cân nặng hồ sơ cũ thành số đo mới
          loadedAppIdRef.current = selectedAppId;
          setActiveRecordId(null);
          setIsFinalized(selectedAppointment?.status === 'completed');
          setSoapData({
            subjective: selectedAppointment?.note ? `Lý do khám: ${selectedAppointment.note}` : '',
            objective: '',
            assessment: '',
            plan: '',
            temp: '',
            heartRate: '',
            respiratoryRate: '',
            weight: '',
            prescriptions: []
          });
        }
      } catch (err) {
        console.error('Lỗi khi tải bệnh án cho ca khám:', err);
      } finally {
        if (isMounted) setIsLoadingRecord(false);
      }
    };

    loadRecords();
    return () => { isMounted = false; };
  }, [selectedAppId, selectedAppointment?.status, currentUser?.id]);

  // Xử lý thêm thuốc vào đơn
  const handleAddMedication = () => {
    if (isFinalized) return;
    setSoapData(prev => ({
      ...prev,
      prescriptions: [
        ...prev.prescriptions,
        {
          id: `med-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: '',
          dose: '',
          route: 'Uống',
          freq: '2 lần/ngày',
          days: 7,
          instructions: 'Uống sau ăn 30 phút'
        }
      ]
    }));
  };

  const handleUpdateMedication = (index, field, value) => {
    if (isFinalized) return;
    setSoapData(prev => {
      const updated = [...prev.prescriptions];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, prescriptions: updated };
    });
  };

  const handleRemoveMedication = (index) => {
    if (isFinalized) return;
    setSoapData(prev => ({
      ...prev,
      prescriptions: prev.prescriptions.filter((_, i) => i !== index)
    }));
  };

  // Lưu nháp (Draft)
  const handleSaveDraft = async () => {
    if (isFinalized || !selectedAppointment) return;
    if (selectedAppointment.status !== 'in_progress') {
      alert('Chỉ ca khám đang trong quá trình khám thực tế (Đang khám) mới có thể lưu nháp bệnh án.');
      return;
    }
    setIsSavingDraft(true);
    setDraftToast('');

    try {
      const recordPayload = {
        appointmentId: selectedAppointment.id,
        petId: selectedAppointment.petId,
        ownerId: selectedPet?.ownerId || selectedAppointment.ownerId,
        authorId: currentUser?.id,
        authorName: currentUser?.name,
        vetId: currentUser?.id,
        soap: {
          subjective: soapData.subjective,
          objective: soapData.objective,
          assessment: soapData.assessment,
          plan: soapData.plan,
          temp: soapData.temp,
          heartRate: soapData.heartRate,
          respiratoryRate: soapData.respiratoryRate,
          weight: soapData.weight,
          planMedications: soapData.prescriptions
        },
        assessment: soapData.assessment,
        plan: soapData.plan,
        prescriptions: soapData.prescriptions,
        isFinal: false,
        status: 'draft',
        updatedAt: new Date().toISOString()
      };

      if (activeRecordId) {
        await updateMedicalRecord(activeRecordId, recordPayload);
      } else {
        const created = await addMedicalRecord(recordPayload);
        if (created?.id) setActiveRecordId(created.id);
      }

      try { sound?.playSuccess?.(); } catch {}
      setDraftToast('Đã lưu bản nháp bệnh án thành công.');
      setTimeout(() => setDraftToast(''), 3000);
    } catch (err) {
      console.error('Lỗi khi lưu nháp:', err);
      alert('Không thể lưu nháp: ' + (err.message || 'Lỗi hệ thống.'));
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Chốt bệnh án nguyên tử (Finalize EHR)
  const handleFinalizeConfirm = async () => {
    if (!selectedAppointment || !selectedPet || isFinalizing) return;
    if (selectedAppointment.status !== 'in_progress') {
      alert('Không thể chốt bệnh án: Ca khám chưa được bắt đầu khám (yêu cầu trạng thái Đang khám).');
      return;
    }
    setIsFinalizing(true);
    setFinalizeError('');

    try {
      const res = await finalizeEhrAndAppointment({
        appointmentId: selectedAppointment.id,
        petId: selectedPet.id,
        soap: {
          subjective: soapData.subjective,
          objective: soapData.objective,
          assessment: soapData.assessment,
          plan: soapData.plan,
          temp: soapData.temp,
          heartRate: soapData.heartRate,
          respiratoryRate: soapData.respiratoryRate,
          weight: soapData.weight,
          planMedications: soapData.prescriptions
        },
        notes: soapData.plan
      });

      try { sound?.playSuccess?.(); } catch {}
      setIsFinalized(true);
      setFinalizedInfo({
        confirmedBy: currentUser?.name || 'Bác sĩ thú y',
        confirmedAt: new Date().toISOString()
      });
      setIsFinalizeModalOpen(false);

      if (onAppointmentCompleted) {
        onAppointmentCompleted(selectedAppointment.id);
      }

      if (res?.syncWarning) {
        alert('Bệnh án đã được chốt và ca khám hoàn tất trên máy chủ!');
      }
    } catch (err) {
      console.error('Lỗi chốt bệnh án:', err);
      setFinalizeError(err.message || 'Không thể chốt bệnh án. Vui lòng thử lại.');
    } finally {
      setIsFinalizing(false);
    }
  };

  // Tạo nhắc lịch tái khám
  const handleSaveReminder = async () => {
    if (isSavingReminder || isSavingReminderRef.current || !reminderForm.date || !selectedPet) return;
    isSavingReminderRef.current = true;
    setIsSavingReminder(true);
    setReminderSuccessMsg('');
    setReminderErrorMsg('');

    try {
      await addSchedule({
        petId: selectedPet.id,
        ownerId: selectedPet.ownerId || selectedAppointment?.ownerId,
        appointmentId: selectedAppointment?.id,
        sourceRecordId: activeRecordId || selectedAppointment?.id,
        title: reminderForm.title?.trim() || 'Tái khám định kỳ theo phác đồ bác sĩ',
        date: reminderForm.date,
        time: reminderForm.time?.trim() || '09:00',
        type: 'vet',
        notes: reminderForm.notes?.trim() || `Chỉ định từ BS. ${currentUser?.name || ''} theo ca khám ${selectedAppointment?.id || ''}`,
        source: 'vet_verified',
        isVerified: true,
        verifiedBy: currentUser?.name || 'Bác sĩ thú y',
        completed: false
      });

      try { sound?.playSuccess?.(); } catch {}
      setReminderSuccessMsg(`Đã tạo lịch tái khám ngày ${reminderForm.date} cho chủ nuôi thành công.`);
      setTimeout(() => {
        setIsReminderModalOpen(false);
        setReminderSuccessMsg('');
      }, 1500);
    } catch (err) {
      console.error('Lỗi tạo lịch tái khám:', err);
      // Khi lỗi: giữ toàn bộ dữ liệu form, không đóng form, không báo thành công, trả nút về trạng thái cho thử lại
      setReminderErrorMsg(err.message || 'Không thể tạo lịch tái khám: Lỗi hệ thống.');
    } finally {
      setIsSavingReminder(false);
      isSavingReminderRef.current = false;
    }
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-6 overflow-hidden">
      {/* THANH ĐIỀU KHIỂN & CHỌN CA KHÁM */}
      <div className="flex-shrink-0 bg-white dark:bg-[#151622] rounded-2xl border border-slate-200 dark:border-slate-800 p-4 mb-4 shadow-sm">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          {/* Bộ chọn ca khám */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
              <Stethoscope className="w-4 h-4 text-indigo-500" />
              <span>
                {selectedAppointment?.status === 'pending' ? 'Ca khám chờ xác nhận:' :
                 selectedAppointment?.status === 'confirmed' ? 'Ca khám đã xác nhận (Chờ bắt đầu):' :
                 selectedAppointment?.status === 'completed' ? 'Ca khám đã hoàn tất:' :
                 selectedAppointment?.status === 'cancelled' ? 'Ca khám đã hủy:' :
                 'Ca khám đang khám:'}
              </span>
            </div>
            
            <div className="relative flex-1 sm:w-80">
              <select
                value={selectedAppId}
                onChange={(e) => setSelectedAppId(e.target.value)}
                className="w-full appearance-none pl-3 pr-8 py-2 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {doctorAppointments.length === 0 ? (
                  <option value="">Không có ca khám nào được phân công</option>
                ) : (
                  doctorAppointments.map(app => (
                    <option key={app.id} value={app.id}>
                      [{app.id}] {app.petName || 'Thú cưng'} ({app.date} {app.time || ''}) - {
                        app.status === 'completed' ? 'Đã hoàn tất' :
                        app.status === 'in_progress' ? 'Đang khám' :
                        app.status === 'confirmed' ? 'Đã xác nhận' :
                        app.status === 'cancelled' ? 'Đã hủy' : 'Chờ xác nhận'
                      }
                    </option>
                  ))
                )}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {selectedAppointment && (
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                selectedAppointment.status === 'completed' ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' :
                selectedAppointment.status === 'in_progress' ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800' :
                selectedAppointment.status === 'confirmed' ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800' :
                selectedAppointment.status === 'cancelled' ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800' :
                'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
              }`}>
                {selectedAppointment.status === 'completed' ? 'Đã hoàn tất' :
                 selectedAppointment.status === 'in_progress' ? 'Đang khám' :
                 selectedAppointment.status === 'confirmed' ? 'Đã xác nhận' :
                 selectedAppointment.status === 'cancelled' ? 'Đã hủy' : 'Chờ xác nhận'}
              </span>
            )}
          </div>

          {/* Các nút hành động chính */}
          <div className="flex items-center gap-2.5 w-full lg:w-auto justify-end">
            {draftToast && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold animate-fade-in">
                {draftToast}
              </span>
            )}

            {isFinalized ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold">
                <Lock className="w-3.5 h-3.5" />
                <span>Bệnh án đã chốt</span>
              </div>
            ) : selectedAppointment?.status === 'in_progress' ? (
              <>
                <button
                  onClick={handleSaveDraft}
                  disabled={isSavingDraft || !selectedAppointment}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSavingDraft ? 'Đang lưu...' : 'Lưu nháp'}
                </button>

                <button
                  onClick={() => setIsFinalizeModalOpen(true)}
                  disabled={!selectedAppointment || !selectedPet}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Chốt bệnh án & Hoàn tất ca
                </button>
              </>
            ) : null}

            {/* Nút tạo nhắc tái khám */}
            <button
              onClick={() => {
                const nextWeek = new Date();
                nextWeek.setDate(nextWeek.getDate() + 7);
                setReminderForm(prev => ({
                  title: prev.title || 'Tái khám định kỳ theo phác đồ bác sĩ',
                  date: prev.date || nextWeek.toISOString().slice(0, 10),
                  time: prev.time || '09:00',
                  notes: prev.notes || `Tái khám theo dõi ca khám ${selectedAppointment?.id || ''}`
                }));
                setReminderErrorMsg('');
                setReminderSuccessMsg('');
                setIsReminderModalOpen(true);
              }}
              disabled={!selectedPet}
              className="px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <Calendar className="w-3.5 h-3.5" />
              Nhắc tái khám
            </button>
          </div>
        </div>

        {/* Thông báo bảo vệ bệnh án đã chốt */}
        {isFinalized && finalizedInfo && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>
                Bệnh án đã được chốt và công bố chính thức bởi <strong className="text-slate-700 dark:text-slate-300">{finalizedInfo.confirmedBy}</strong> lúc {new Date(finalizedInfo.confirmedAt).toLocaleString('vi-VN')}.
              </span>
            </div>
            <span className="text-[11px] text-slate-400">Dữ liệu được khóa an toàn</span>
          </div>
        )}
      </div>

      {/* NỘI DUNG CUỘN CHÍNH */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {/* BANNER HƯỚNG DẪN THAO TÁC THEO TRẠNG THÁI CA KHÁM */}
        {selectedAppointment && selectedAppointment.status === 'pending' && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  Lịch khám đang ở trạng thái chờ xác nhận
                </h4>
                <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                  Bác sĩ cần xác nhận lịch khám trước khi tiến hành khám lâm sàng và lập bệnh án SOAP.
                </p>
                {actionErrorMap?.[selectedAppointment.id] && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-1">
                    Lỗi: {actionErrorMap[selectedAppointment.id]}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onConfirmAppointment?.(selectedAppointment.id)}
              disabled={confirmingAppId === selectedAppointment.id}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm disabled:opacity-50 shrink-0"
            >
              <CheckCircle2 className="w-4 h-4" />
              {confirmingAppId === selectedAppointment.id ? 'Đang xác nhận...' : 'Xác nhận lịch khám ngay'}
            </button>
          </div>
        )}

        {selectedAppointment && selectedAppointment.status === 'confirmed' && (
          <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/80 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              {isPastAppointment(selectedAppointment.date, selectedAppointment.time) ? (
                <Clock className="w-5 h-5 text-amber-500 shrink-0" />
              ) : (
                <Stethoscope className="w-5 h-5 text-sky-500 shrink-0" />
              )}
              <div>
                <h4 className="text-xs font-bold text-sky-900 dark:text-sky-200">
                  {isPastAppointment(selectedAppointment.date, selectedAppointment.time)
                    ? `Ca khám đã quá giờ hẹn ban đầu (${selectedAppointment.time} ${selectedAppointment.date})`
                    : 'Lịch khám đã được xác nhận (Sẵn sàng tiếp đón)'}
                </h4>
                <p className="text-[11px] text-sky-700 dark:text-sky-400 mt-0.5">
                  {isPastAppointment(selectedAppointment.date, selectedAppointment.time)
                    ? 'Vui lòng tiếp nhận khám muộn với xác nhận rõ ràng để giữ giờ hẹn gốc và ghi nhận thời điểm bắt đầu thực tế.'
                    : 'Bác sĩ vui lòng bấm bắt đầu khám để mở khóa biểu mẫu bệnh án SOAP và kê đơn.'}
                </p>
                {actionErrorMap?.[selectedAppointment.id] && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-1">
                    Lỗi: {actionErrorMap[selectedAppointment.id]}
                  </p>
                )}
              </div>
            </div>
            {isPastAppointment(selectedAppointment.date, selectedAppointment.time) ? (
              <button
                type="button"
                onClick={() => onOpenLateAdmission?.(selectedAppointment)}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shrink-0"
              >
                <Clock className="w-4 h-4" />
                Tiếp nhận khám muộn
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onStartExam?.(selectedAppointment.id)}
                disabled={startingAppId === selectedAppointment.id}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm disabled:opacity-50 shrink-0"
              >
                <Stethoscope className="w-4 h-4" />
                {startingAppId === selectedAppointment.id ? 'Đang tiếp nhận...' : 'Bắt đầu khám ngay'}
              </button>
            )}
          </div>
        )}

        {selectedAppointment && selectedAppointment.status === 'cancelled' && (
          <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 p-4 rounded-2xl flex items-center gap-3 shadow-xs">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-rose-900 dark:text-rose-200">
                Ca khám này đã bị hủy
              </h4>
              <p className="text-[11px] text-rose-700 dark:text-rose-400 mt-0.5">
                {selectedAppointment.cancelReason ? `Lý do: ${selectedAppointment.cancelReason}` : 'Lịch khám không còn hiệu lực. Biểu mẫu được khóa an toàn.'}
              </p>
            </div>
          </div>
        )}

        {/* BANNER TÓM TẮT BỆNH NHÂN */}
        {selectedPet ? (
          <div className="bg-white dark:bg-[#151622] rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 flex-shrink-0">
                  {selectedPet.avatar ? (
                    <img src={selectedPet.avatar} alt={selectedPet.name} className="w-full h-full object-cover" />
                  ) : (
                    <PawPrint className="w-6 h-6 text-slate-400" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {selectedPet.name}
                    </h3>
                    <span className="text-xs px-2 py-0.5 rounded font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {selectedPet.breed || 'Chưa cập nhật giống'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Chủ nuôi: <strong className="text-slate-700 dark:text-slate-300">{selectedPet.ownerName || selectedAppointment?.ownerName || 'Chưa cập nhật'}</strong> • SĐT: {selectedPet.phone || selectedAppointment?.phone || 'Chưa cập nhật'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60 px-3.5 py-2 rounded-xl border border-slate-200/60 dark:border-slate-800">
                <div>
                  <span className="text-slate-400">Dịch vụ hẹn: </span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedAppointment?.service || 'Khám tổng quát'}</span>
                </div>
                <span>•</span>
                <div>
                  <span className="text-slate-400">Thời gian: </span>
                  <span className="font-semibold text-slate-900 dark:text-white">{selectedAppointment?.date} {selectedAppointment?.time || ''}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 p-4 rounded-2xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">
              Vui lòng chọn một ca khám từ danh sách phía trên để bắt đầu ghi nhận bệnh án SOAP.
            </p>
          </div>
        )}

        {/* 4 PHẦN CHUẨN SOAP QUỐC TẾ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* PHẦN S - SUBJECTIVE (CHỦ QUAN) */}
          <div className="bg-white dark:bg-[#151622] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold tracking-wider uppercase text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 flex items-center justify-center font-black">S</span>
                Subjective (Bệnh sử & Triệu chứng ban đầu)
              </h4>
            </div>
            <p className="text-[11px] text-slate-400">
              Lý do đến khám, lời khai của chủ nuôi, tiền sử bệnh, thay đổi hành vi hoặc thói quen ăn uống gần đây:
            </p>
            <textarea
              rows={4}
              disabled={isFormDisabled}
              value={soapData.subjective}
              onChange={(e) => setSoapData(prev => ({ ...prev, subjective: e.target.value }))}
              placeholder="VD: Bé bỏ ăn 2 ngày nay, nôn dịch vàng, mệt mỏi ít vận động..."
              className="w-full p-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-75 disabled:cursor-not-allowed"
            />
          </div>

          {/* PHẦN O - OBJECTIVE (KHÁM THỰC THỂ) */}
          <div className="bg-white dark:bg-[#151622] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold tracking-wider uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/80 flex items-center justify-center font-black">O</span>
                Objective (Khám lâm sàng & Chỉ số sinh tồn)
              </h4>
            </div>
            <p className="text-[11px] text-slate-400">
              Chỉ số sinh tồn và kết quả quan sát trực tiếp của bác sĩ:
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">Thân nhiệt (°C)</label>
                <input
                  type="text"
                  disabled={isFormDisabled}
                  value={soapData.temp}
                  onChange={(e) => setSoapData(prev => ({ ...prev, temp: e.target.value }))}
                  placeholder="VD: 38.5"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-75"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">Nhịp tim (bpm)</label>
                <input
                  type="text"
                  disabled={isFormDisabled}
                  value={soapData.heartRate}
                  onChange={(e) => setSoapData(prev => ({ ...prev, heartRate: e.target.value }))}
                  placeholder="VD: 110"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-75"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">Nhịp thở (lần/phút)</label>
                <input
                  type="text"
                  disabled={isFormDisabled}
                  value={soapData.respiratoryRate}
                  onChange={(e) => setSoapData(prev => ({ ...prev, respiratoryRate: e.target.value }))}
                  placeholder="VD: 24"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-75"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Cân nặng (kg)</label>
                  {selectedPet?.weight && !soapData.weight && !isFormDisabled && (
                    <button
                      type="button"
                      onClick={() => setSoapData(prev => ({ ...prev, weight: String(selectedPet.weight) }))}
                      className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      title="Sử dụng số đo cân nặng từ hồ sơ trước đó"
                    >
                      Dùng {selectedPet.weight} kg
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  disabled={isFormDisabled}
                  value={soapData.weight}
                  onChange={(e) => setSoapData(prev => ({ ...prev, weight: e.target.value }))}
                  placeholder="VD: 5.0"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-75"
                />
                {selectedPet?.weight && (
                  <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                    Hồ sơ trước: <span className="font-semibold text-slate-600 dark:text-slate-300">{selectedPet.weight} kg</span>
                    {selectedPet.updatedAt ? ` (${new Date(selectedPet.updatedAt).toLocaleDateString('vi-VN')})` : ''}
                  </p>
                )}
              </div>
            </div>

            <textarea
              rows={2}
              disabled={isFormDisabled}
              value={soapData.objective}
              onChange={(e) => setSoapData(prev => ({ ...prev, objective: e.target.value }))}
              placeholder="Ghi nhận khám: Niêm mạc hồng nhạt, mất nước nhẹ 5%, đau khi ấn vùng thượng vị..."
              className="w-full p-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-75 disabled:cursor-not-allowed"
            />
          </div>

          {/* PHẦN A - ASSESSMENT (CHẨN ĐOÁN) */}
          <div className="bg-white dark:bg-[#151622] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold tracking-wider uppercase text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-950/80 flex items-center justify-center font-black">A</span>
                Assessment (Chẩn đoán lâm sàng)
              </h4>
            </div>
            <p className="text-[11px] text-slate-400">
              Chẩn đoán xác định, chẩn đoán phân biệt dựa trên kết quả thăm khám:
            </p>
            <textarea
              rows={4}
              disabled={isFormDisabled}
              value={soapData.assessment}
              onChange={(e) => setSoapData(prev => ({ ...prev, assessment: e.target.value }))}
              placeholder="VD: Viêm dạ dày ruột cấp tính nghi do loạn khuẩn / ngộ độc thức ăn nhẹ. Loại trừ Parvovirus (Test nhanh Âm tính)."
              className="w-full p-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-75 disabled:cursor-not-allowed"
            />
          </div>

          {/* PHẦN P - PLAN (KẾ HOẠCH & DẶN DÒ) */}
          <div className="bg-white dark:bg-[#151622] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold tracking-wider uppercase text-sky-600 dark:text-sky-400 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-sky-50 dark:bg-sky-950/80 flex items-center justify-center font-black">P</span>
                Plan (Phác đồ điều trị & Lời dặn)
              </h4>
            </div>
            <p className="text-[11px] text-slate-400">
              Phương án can thiệp, dặn dò dinh dưỡng, chế độ chăm sóc tại nhà:
            </p>
            <textarea
              rows={4}
              disabled={isFormDisabled}
              value={soapData.plan}
              onChange={(e) => setSoapData(prev => ({ ...prev, plan: e.target.value }))}
              placeholder="VD: Bù nước điện giải Oresol, cho ăn cháo loãng thịt gà nạc chia nhỏ bữa. Tái khám sau 3 ngày nếu nôn tăng dần..."
              className="w-full p-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-75 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* KÊ ĐƠN THUỐC CHI TIẾT (PRESCRIPTIONS) */}
        <div className="bg-white dark:bg-[#151622] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Pill className="w-4 h-4 text-indigo-500" />
                Đơn thuốc điều trị kèm theo ({soapData.prescriptions.length} loại thuốc)
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Khi chốt bệnh án, đơn thuốc sẽ được tự động ban hành chính thức cho chủ nuôi xem trong mục Hồ sơ sức khỏe.
              </p>
            </div>

            {!isFormDisabled && (
              <button
                type="button"
                onClick={handleAddMedication}
                className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-indigo-200 dark:border-indigo-800"
              >
                <Plus className="w-3.5 h-3.5" />
                Thêm thuốc
              </button>
            )}
          </div>

          {soapData.prescriptions.length === 0 ? (
            <div className="p-6 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
              <Pill className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-1.5" />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Chưa có thuốc nào trong đơn. Nhấn "Thêm thuốc" nếu ca khám cần cấp phát thuốc điều trị.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              {soapData.prescriptions.map((med, index) => (
                <div key={med.id || index} className="p-3.5 bg-slate-50/50 dark:bg-slate-900/30 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                    <div className="sm:col-span-4">
                      <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                        Tên thuốc / Biệt dược *
                      </label>
                      <input
                        type="text"
                        disabled={isFormDisabled}
                        value={med.name}
                        onChange={(e) => handleUpdateMedication(index, 'name', e.target.value)}
                        placeholder="VD: Amoxicillin 250mg, Oresol..."
                        className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold disabled:opacity-75"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                        Liều dùng / Hàm lượng
                      </label>
                      <input
                        type="text"
                        disabled={isFormDisabled}
                        value={med.dose}
                        onChange={(e) => handleUpdateMedication(index, 'dose', e.target.value)}
                        placeholder="1 viên"
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-75"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                        Đường dùng
                      </label>
                      <select
                        disabled={isFormDisabled}
                        value={med.route || 'Uống'}
                        onChange={(e) => handleUpdateMedication(index, 'route', e.target.value)}
                        className="w-full px-2 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-75 cursor-pointer"
                      >
                        <option value="Uống">Uống</option>
                        <option value="Tiêm dưới da">Tiêm dưới da (SC)</option>
                        <option value="Tiêm bắp">Tiêm bắp (IM)</option>
                        <option value="Tiêm tĩnh mạch">Tiêm TM (IV)</option>
                        <option value="Bôi ngoài da">Bôi ngoài da</option>
                        <option value="Nhỏ mắt/tai">Nhỏ mắt / tai</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                        Tần suất / Ngày
                      </label>
                      <input
                        type="text"
                        disabled={isFormDisabled}
                        value={med.freq || '2 lần/ngày'}
                        onChange={(e) => handleUpdateMedication(index, 'freq', e.target.value)}
                        placeholder="2 lần/ngày"
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-75"
                      />
                    </div>

                    <div className="sm:col-span-1">
                      <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                        Số ngày
                      </label>
                      <input
                        type="number"
                        min="1"
                        disabled={isFormDisabled}
                        value={med.days || 7}
                        onChange={(e) => handleUpdateMedication(index, 'days', e.target.value)}
                        className="w-full px-2 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-75"
                      />
                    </div>

                    <div className="sm:col-span-1 flex items-end justify-center pt-4 sm:pt-0">
                      {!isFormDisabled && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMedication(index)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Xóa thuốc"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <input
                      type="text"
                      disabled={isFormDisabled}
                      value={med.instructions || ''}
                      onChange={(e) => handleUpdateMedication(index, 'instructions', e.target.value)}
                      placeholder="Hướng dẫn sử dụng chi tiết (VD: Uống sau ăn 30 phút, kiêng mỡ...)"
                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-75"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODAL XÁC NHẬN CHỐT BỆNH ÁN */}
      {isFinalizeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="max-w-md w-full bg-white dark:bg-[#151622] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Xác nhận chốt bệnh án SOAP
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ca khám: <strong className="text-slate-700 dark:text-slate-300">{selectedAppointment?.id}</strong> • Bệnh nhân: <strong className="text-slate-700 dark:text-slate-300">{selectedPet?.name}</strong>
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/80 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Lịch khám chuyển sang trạng thái <strong>Đã hoàn tất</strong>.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <span>Bệnh án được công bố chính thức cho chủ nuôi ({selectedPet?.ownerName}).</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                <span>Đơn thuốc ({soapData.prescriptions.length} mục) được đồng bộ vào sổ sức khỏe.</span>
              </div>
              <div className="flex items-center gap-2 text-rose-500">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span>Bệnh án đã chốt sẽ được khóa bảo vệ, không thể chỉnh sửa.</span>
              </div>
            </div>

            {finalizeError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400">
                {finalizeError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsFinalizeModalOpen(false)}
                disabled={isFinalizing}
                className="py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleFinalizeConfirm}
                disabled={isFinalizing}
                className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
              >
                {isFinalizing ? 'Đang chốt...' : 'Xác nhận chốt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TẠO NHẮC TÁI KHÁM */}
      {isReminderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="max-w-md w-full bg-white dark:bg-[#151622] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Tạo nhắc lịch tái khám cho chủ nuôi
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isSavingReminder) {
                    setIsReminderModalOpen(false);
                    setReminderErrorMsg('');
                  }
                }}
                disabled={isSavingReminder}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer disabled:opacity-50 p-1"
                title="Đóng cửa sổ"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* BỔ SUNG: XÁC NHẬN ĐỐI TƯỢNG (TÊN THÚ CƯNG VÀ CHỦ NUÔI) */}
            <div className="bg-slate-50 dark:bg-slate-900/70 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <PawPrint className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {selectedPet?.name || selectedAppointment?.petName || 'Thú cưng'}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                      {selectedPet?.breed || selectedAppointment?.petType || (selectedPet?.species === 'dog' ? 'Chó' : selectedPet?.species === 'cat' ? 'Mèo' : 'Thú cưng')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 truncate">
                    <User className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>Chủ nuôi: <strong className="text-slate-700 dark:text-slate-300">{selectedPet?.ownerName || selectedAppointment?.ownerName || 'Chưa cập nhật'}</strong></span>
                    {(selectedPet?.phone || selectedAppointment?.phone) && (
                      <>
                        <span>•</span>
                        <span>{selectedPet?.phone || selectedAppointment?.phone}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>
              {selectedAppointment?.id && (
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1 truncate">
                    <Stethoscope className="w-3 h-3 text-indigo-500 shrink-0" />
                    <span>Ca khám nguồn: <strong className="text-slate-700 dark:text-slate-300 font-mono">{selectedAppointment.id}</strong></span>
                  </span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold shrink-0">Lịch nhắc chăm sóc (vet)</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                  Tiêu đề nhắc hẹn *
                </label>
                <input
                  type="text"
                  value={reminderForm.title}
                  onChange={(e) => setReminderForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                    Ngày tái khám *
                  </label>
                  <input
                    type="date"
                    value={reminderForm.date}
                    onChange={(e) => setReminderForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                    Giờ hẹn
                  </label>
                  <input
                    type="time"
                    value={reminderForm.time}
                    onChange={(e) => setReminderForm(prev => ({ ...prev, time: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                  Ghi chú dặn dò
                </label>
                <textarea
                  rows={2}
                  value={reminderForm.notes}
                  onChange={(e) => setReminderForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Ghi chú cho chủ nuôi khi đến tái khám..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* THÔNG BÁO LỖI: GIỮ FORM, KHÔNG ĐÓNG, CHO THỬ LẠI */}
            {reminderErrorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start justify-between gap-2 animate-fade-in">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span className="font-semibold leading-relaxed">{reminderErrorMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setReminderErrorMsg('')}
                  className="text-rose-400 hover:text-rose-700 dark:hover:text-rose-200 p-0.5 shrink-0"
                  title="Đóng thông báo lỗi"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* THÔNG BÁO THÀNH CÔNG */}
            {reminderSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-2 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{reminderSuccessMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsReminderModalOpen(false);
                  setReminderErrorMsg('');
                }}
                disabled={isSavingReminder}
                className="py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleSaveReminder}
                disabled={isSavingReminder || !reminderForm.date}
                className="py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isSavingReminder ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  'Lưu vào lịch'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VetSoapTab;
