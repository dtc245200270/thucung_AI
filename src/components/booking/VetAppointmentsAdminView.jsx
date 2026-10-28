import React, { useState, useEffect } from 'react';
import { 
  Stethoscope, 
  Calendar, 
  Clock, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  User, 
  Phone, 
  Building2, 
  FileText, 
  Check, 
  UserCheck, 
  PlayCircle, 
  RotateCcw, 
  Plus, 
  Trash2, 
  ShieldAlert,
  Flame,
  ArrowRight,
  Sparkles,
  ExternalLink,
  MessageSquare
} from 'lucide-react';
import { sound } from '../../services/soundService';
import { getUsers } from '../../services/authService';



export const VetAppointmentsAdminView = ({
  appointments = [],
  onUpdateAppointment,
  onDeleteAppointment,
  onOpenCreateBooking,
  pets = [],
  users = []
}) => {
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'unassigned' | 'Chờ duyệt' | 'Đã duyệt' | 'Đang khám' | 'Hoàn thành' | 'Đã hủy'
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFacility, setFilterFacility] = useState('all');

  // Chuẩn hóa trạng thái lịch khám (hỗ trợ cả mã tiếng Anh và nhãn tiếng Việt)
  // TUYỆT ĐỐI KHÔNG TỰ GÁN TRẠNG THÁI pending KHI THIẾU STATUS ĐỂ TRÁNH LÀM SAI LỆCH DỮ LIỆU
  const normalizeStatus = (status) => {
    if (!status || typeof status !== 'string' || !status.trim()) return 'unspecified';
    const s = String(status).toLowerCase().trim();
    if (s === 'pending' || s === 'chờ duyệt' || s === 'chờ xác nhận') return 'Chờ duyệt';
    if (s === 'confirmed' || s === 'đã duyệt' || s === 'đã xác nhận') return 'Đã duyệt';
    if (s === 'in_progress' || s === 'đang khám') return 'Đang khám';
    if (s === 'completed' || s === 'hoàn thành' || s === 'đã hoàn tất') return 'Hoàn thành';
    if (s === 'cancelled' || s === 'đã hủy') return 'Đã hủy';
    return 'unspecified';
  };

  // Helper nhận diện lịch chưa phân công bác sĩ phụ trách
  const isAppointmentUnassigned = (app) => {
    if (!app) return false;
    if (!app.assignedVetId || app.assignedVetId === 'auto' || String(app.assignedVetId).trim() === '') return true;
    const av = String(app.assignedVet || '').toLowerCase();
    return av === 'đang xếp lịch' || av === 'cơ sở phân công' || av === 'chưa phân công';
  };

  // Danh sách bác sĩ thực tế từ cơ sở dữ liệu tài khoản (không dùng mock)
  const availableVetDoctors = React.useMemo(() => {
    const list = (users && users.length > 0) ? users : (getUsers() || []);
    const fromUsers = list.filter(u => u.role === 'vet_doctor' && (!u.vetStatus || u.vetStatus === 'approved') && !u.isLocked);
    return fromUsers.map(u => ({
      id: u.id,
      name: u.name.startsWith('BS.') ? u.name : `BS. ${u.name}`,
      spec: u.specialty || 'Khoa Khám & Điều trị Thú y',
      facilityId: u.facilityId || null,
      facilityIds: Array.isArray(u.facilityIds) ? u.facilityIds : (u.facilityId ? [u.facilityId] : [])
    }));
  }, [users]);

  // Modal đổi giờ / từ chối
  const [rescheduleItem, setRescheduleItem] = useState(null);
  const [rescheduleNote, setRescheduleNote] = useState('');
  const [newTimeSlot, setNewTimeSlot] = useState('');

  // Modal chỉ định Bác sĩ
  const [assignDoctorItem, setAssignDoctorItem] = useState(null);
  const [selectedDoctor, setSelectedDoctor] = useState(availableVetDoctors[0]?.name || '');

  // Thống kê nhanh minh bạch mọi trạng thái
  const totalCount = appointments.length;
  const unassignedCount = appointments.filter(a => isAppointmentUnassigned(a) && normalizeStatus(a.status) !== 'Đã hủy').length;
  const pendingCount = appointments.filter(a => normalizeStatus(a.status) === 'Chờ duyệt').length;
  const approvedCount = appointments.filter(a => normalizeStatus(a.status) === 'Đã duyệt').length;
  const inProgressCount = appointments.filter(a => normalizeStatus(a.status) === 'Đang khám').length;
  const completedCount = appointments.filter(a => normalizeStatus(a.status) === 'Hoàn thành').length;
  const cancelledCount = appointments.filter(a => normalizeStatus(a.status) === 'Đã hủy').length;
  const unspecifiedCount = appointments.filter(a => normalizeStatus(a.status) === 'unspecified').length;
  const emergencyCount = appointments.filter(a => Boolean(a.isEmergency || (a.service || '').includes('Cấp cứu'))).length;

  // Lọc danh sách lịch khám
  const filteredAppointments = appointments.filter(app => {
    if (filterStatus === 'unassigned') {
      return isAppointmentUnassigned(app) && normalizeStatus(app.status) !== 'Đã hủy';
    }
    const norm = normalizeStatus(app.status);
    const matchStatus = filterStatus === 'all' || norm === filterStatus;
    const matchFacility = filterFacility === 'all' || (app.facility || '').includes(filterFacility);
    
    const q = searchQuery.toLowerCase().trim();
    const matchQuery = !q || (
      (app.petName || '').toLowerCase().includes(q) ||
      (app.ownerName || '').toLowerCase().includes(q) ||
      (app.phone || '').includes(q) ||
      (app.id || '').toLowerCase().includes(q) ||
      (app.service || '').toLowerCase().includes(q)
    );

    return matchStatus && matchFacility && matchQuery;
  });

  // 1. Duyệt lịch khám (YÊU CẦU 7: Không tự gán bác sĩ cho ca "Cơ sở phân công")
  const handleApprove = (appointment) => {
    try { sound.playSuccess(); } catch (_) {}
    onUpdateAppointment(appointment.id, {
      status: 'confirmed',
      assignedVet: appointment.assignedVet || 'Cơ sở phân công',
      assignedVetId: appointment.assignedVetId || null,
      adminNote: appointment.adminNote || ''
    });
  };

  // 2. Chuyển sang Đang khám
  const handleStartExam = (appointment) => {
    try { sound.playClick(); } catch (_) {}
    onUpdateAppointment(appointment.id, {
      status: 'in_progress',
      adminNote: appointment.adminNote || ''
    });
  };

  // 3. Hoàn thành khám
  const handleCompleteExam = (appointment) => {
    try { sound.playSuccess(); } catch (_) {}
    onUpdateAppointment(appointment.id, {
      status: 'completed',
      adminNote: appointment.adminNote || ''
    });
  };

  // 4. Mở modal phân công bác sĩ
  const handleOpenAssign = (appointment) => {
    try { sound.playClick(); } catch (_) {}
    setAssignDoctorItem(appointment);
    const existingDoc = availableVetDoctors.find(d => d.id === appointment.assignedVetId || d.name === appointment.assignedVet);
    setSelectedDoctor(existingDoc ? existingDoc.name : availableVetDoctors[0].name);
  };

  const handleSaveAssign = async () => {
    if (!assignDoctorItem) return;
    try { sound.playSuccess(); } catch (_) {}
    const chosenDoc = availableVetDoctors.find(d => d.name === selectedDoctor || d.id === selectedDoctor) || availableVetDoctors[0];
    try {
      // Phân công không tự chuyển pending thành confirmed; bác sĩ vẫn phải xác nhận ca!
      await onUpdateAppointment(assignDoctorItem.id, {
        assignedVet: chosenDoc.name,
        assignedVetId: chosenDoc.id
      });
      setAssignDoctorItem(null);
    } catch (err) {
      alert(err.message || 'Lỗi khi phân công bác sĩ. Vui lòng kiểm tra xung đột trùng lịch khám.');
    }
  };

  // 5. Mở modal từ chối / đổi giờ
  const handleOpenReschedule = (appointment) => {
    try { sound.playPop(); } catch (_) {}
    setRescheduleItem(appointment);
    setRescheduleNote(appointment.adminNote || '');
    setNewTimeSlot(appointment.time || '15:30');
  };

  const handleSaveReschedule = (isRejected = false) => {
    if (!rescheduleItem) return;
    try { sound.playPop(); } catch (_) {}
    onUpdateAppointment(rescheduleItem.id, {
      status: isRejected ? 'Đã hủy' : 'Đã đổi giờ',
      time: isRejected ? rescheduleItem.time : (newTimeSlot || rescheduleItem.time),
      adminNote: rescheduleNote.trim() || ''
    });
    setRescheduleItem(null);
  };

  return (
    <div className="space-y-6 pb-16">
      
      {/* 1. Header Banner & Quick Actions */}
      <div className="bg-[#0f1322] border border-purple-500/20 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 left-1/3 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border border-purple-500/40 text-purple-300 flex items-center gap-1.5">
                <Stethoscope className="w-3.5 h-3.5 text-purple-400" />
                CỔNG TIẾP NHẬN BÁC SĨ & PHÒNG KHÁM
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                LIVE 2-WAY SYNC
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-2 flex items-center gap-2">
              Quản Lý Đặt Lịch Khám Thú Y 2 Chiều
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Tiếp nhận yêu cầu khám từ chủ nuôi, điều phối bác sĩ phụ trách, xử lý duyệt/đổi giờ và theo dõi bệnh án theo thời gian thực.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start lg:self-auto shrink-0">
            <button
              onClick={() => { sound.playClick(); onOpenCreateBooking(); }}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/25 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Tiếp Nhận Lịch Mới (Hotline / Walk-in)</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Thống kê nhanh (5 KPI Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        
        {/* Tổng số */}
        <div className="bg-[#121526] border border-white/[0.08] rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tổng Lịch Hẹn</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-white">{totalCount}</span>
            <span className="text-xs text-slate-400 font-mono">ca</span>
          </div>
        </div>

        {/* Chờ duyệt (Flashing Amber) */}
        <div className={`bg-[#121526] border rounded-2xl p-4 shadow-sm flex flex-col justify-between transition-all ${
          pendingCount > 0 
            ? 'border-amber-500/50 bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.15)]' 
            : 'border-white/[0.08]'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Chờ Duyệt</span>
            {pendingCount > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            )}
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-amber-300">{pendingCount}</span>
            <span className="text-xs text-amber-400/80 font-bold">Cần xử lý</span>
          </div>
        </div>

        {/* Đã duyệt */}
        <div className="bg-[#121526] border border-cyan-500/30 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">Đã Duyệt Hẹn</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-cyan-300">{approvedCount}</span>
            <span className="text-xs text-cyan-400/80 font-mono">sẵn sàng</span>
          </div>
        </div>

        {/* Ca Cấp Cứu (Flashing Rose) */}
        <div className={`bg-[#121526] border rounded-2xl p-4 shadow-sm flex flex-col justify-between ${
          emergencyCount > 0 
            ? 'border-rose-500/50 bg-rose-500/10 shadow-[0_0_20px_rgba(244,63,94,0.2)] animate-pulse' 
            : 'border-white/[0.08]'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">🚨 Ca Cấp Cứu</span>
            {emergencyCount > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
            )}
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-rose-300">{emergencyCount}</span>
            <span className="text-xs text-rose-400/80 font-bold">Ưu tiên số 1</span>
          </div>
        </div>

        {/* Đang khám & Hoàn thành */}
        <div className="bg-[#121526] border border-emerald-500/30 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Đang Khám / Xong</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-emerald-300">{inProgressCount + completedCount}</span>
            <span className="text-xs text-emerald-400/80 font-mono">{inProgressCount} đang khám</span>
          </div>
        </div>

      </div>

      {/* 3. Bộ lọc & Tìm kiếm (Filter & Search Bar) */}
      <div className="bg-[#0f1322] border border-white/[0.08] rounded-2xl p-3 sm:p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          
          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto no-scrollbar p-1 bg-slate-900/80 rounded-xl border border-white/[0.06]">
            {[
              { id: 'all', label: `Tất cả (${totalCount})` },
              { id: 'unassigned', label: `Chờ phân công (${unassignedCount})`, highlight: unassignedCount > 0 },
              { id: 'Chờ duyệt', label: `Chờ duyệt (${pendingCount})`, highlight: pendingCount > 0 },
              { id: 'Đã duyệt', label: `Đã duyệt (${approvedCount})` },
              { id: 'Đang khám', label: `Đang khám (${inProgressCount})` },
              { id: 'Hoàn thành', label: `Hoàn thành (${completedCount})` },
              { id: 'Đã hủy', label: `Đã hủy (${cancelledCount})` },
              ...(unspecifiedCount > 0 ? [
                { id: 'unspecified', label: `Thiếu/Sai trạng thái (${unspecifiedCount})`, highlight: true, isWarning: true }
              ] : [])
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { sound.playClick(); setFilterStatus(tab.id); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  filterStatus === tab.id
                    ? tab.isWarning
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'bg-purple-600 text-white shadow-sm'
                    : tab.isWarning
                      ? 'text-amber-300 bg-amber-500/20 border border-amber-500/40 animate-pulse'
                      : tab.highlight
                        ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên bé, chủ, SĐT..."
              className="w-full bg-slate-900 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 transition-colors"
            />
          </div>

        </div>

        {/* Cảnh báo tính toàn vẹn dữ liệu nếu có ca thiếu/sai trạng thái */}
        {unspecifiedCount > 0 && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Kiểm tra toàn vẹn dữ liệu:</strong> Phát hiện {unspecifiedCount} ca khám thiếu hoặc sai trạng thái làm tổng ca không khớp bộ đếm chuẩn. Hệ thống giữ nguyên dữ liệu gốc, không tự gán 'Chờ duyệt' để làm khớp số liệu giả mạo.
              </span>
            </div>
            <button
              onClick={() => setFilterStatus('unspecified')}
              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 font-bold text-[11px] shrink-0 cursor-pointer"
            >
              Xem ca bất thường
            </button>
          </div>
        )}
      </div>

      {/* 4. Bảng danh sách lịch hẹn chi tiết (Table & Cards) */}
      <div className="bg-[#0f1322] border border-white/[0.08] rounded-3xl overflow-hidden shadow-2xl">
        {filteredAppointments.length === 0 ? (
          <div className="py-20 text-center text-slate-400 space-y-3">
            <Stethoscope className="w-12 h-12 mx-auto text-purple-400/50" />
            <h3 className="text-sm font-bold text-slate-200">Không tìm thấy lịch khám nào phù hợp</h3>
            <p className="text-xs text-slate-500">Hãy thử đổi bộ lọc trạng thái hoặc từ khóa tìm kiếm.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Mã & Ngày tạo</th>
                  <th className="py-3.5 px-4">Bé & Chủ nuôi</th>
                  <th className="py-3.5 px-4">Dịch vụ & Ghi chú triệu chứng</th>
                  <th className="py-3.5 px-4">Khung giờ hẹn</th>
                  <th className="py-3.5 px-4">Bác sĩ phụ trách</th>
                  <th className="py-3.5 px-4">Trạng thái</th>
                  <th className="py-3.5 px-4 text-right">Thao tác xử lý</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {filteredAppointments.map((app) => {
                  const isEmergency = app.isEmergency || (app.service || '').includes('Cấp cứu');
                  return (
                    <tr 
                      key={app.id} 
                      className={`hover:bg-white/[0.02] transition-colors ${
                        isEmergency ? 'bg-rose-500/[0.04]' : ''
                      }`}
                    >
                      {/* Cột 1: Mã & Ngày tạo */}
                      <td className="py-4 px-4 align-top whitespace-nowrap">
                        <div className="font-mono font-bold text-purple-400 flex items-center gap-1.5">
                          <span>{app.id}</span>
                          {isEmergency && (
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {new Date(app.createdAt || Date.now()).toLocaleDateString('vi-VN', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </td>

                      {/* Cột 2: Bé & Chủ nuôi */}
                      <td className="py-4 px-4 align-top">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span className="text-emerald-400">🐾</span>
                          <span>{app.petName}</span>
                        </div>
                        <span className="text-[11px] text-slate-400 block">
                          {app.petType}
                        </span>
                        <div className="mt-1 pt-1 border-t border-white/[0.05] text-[11px] text-slate-300">
                          <span className="font-semibold">{app.ownerName}</span>
                          <a 
                            href={`tel:${app.phone}`} 
                            className="block text-[11px] font-mono text-cyan-400 hover:underline mt-0.5"
                          >
                            📞 {app.phone}
                          </a>
                        </div>
                      </td>

                      {/* Cột 3: Dịch vụ & Triệu chứng */}
                      <td className="py-4 px-4 align-top max-w-xs">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border mb-1 ${
                          isEmergency
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                        }`}>
                          {app.service}
                        </span>
                        <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed mt-0.5 bg-slate-900/40 p-2 rounded-xl border border-white/[0.04]">
                          {app.note || 'Không có mô tả triệu chứng'}
                        </p>
                        {app.adminNote && (
                          <div className="text-[10px] text-amber-300/90 italic mt-1 flex items-center gap-1">
                            <MessageSquare className="w-3 h-3 text-amber-400 shrink-0" />
                            <span>Phòng khám: {app.adminNote}</span>
                          </div>
                        )}
                      </td>

                      {/* Cột 4: Ngày & Khung giờ hẹn */}
                      <td className="py-4 px-4 align-top whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-bold text-white">
                          <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{app.date}</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-cyan-300 font-bold text-xs mt-1">
                          <Clock className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{app.time}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-1 line-clamp-1 max-w-[180px]">
                          🏥 {app.facility}
                        </span>
                      </td>

                      {/* Cột 5: Bác sĩ phụ trách */}
                      <td className="py-4 px-4 align-top">
                        <button
                          onClick={() => handleOpenAssign(app)}
                          className="px-2.5 py-1 rounded-xl text-left bg-slate-900 border border-purple-500/30 hover:border-purple-400 transition-colors group cursor-pointer block"
                          title="Bấm để đổi bác sĩ"
                        >
                          <span className="text-[10px] text-slate-400 block group-hover:text-purple-300">Phân công:</span>
                          <strong className="text-xs text-purple-300 group-hover:text-white font-bold block truncate max-w-[140px]">
                            {app.assignedVet || 'Đang xếp lịch'}
                          </strong>
                        </button>
                      </td>

                      {/* Cột 6: Trạng thái */}
                      <td className="py-4 px-4 align-top whitespace-nowrap">
                        {isAppointmentUnassigned(app) && normalizeStatus(app.status) !== 'Đã hủy' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1 mb-1 block w-fit">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                            Chờ phân công
                          </span>
                        )}
                        {normalizeStatus(app.status) === 'Chờ duyệt' && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            Chờ xác nhận
                          </span>
                        )}
                        {normalizeStatus(app.status) === 'Đã duyệt' && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                            Đã xác nhận
                          </span>
                        )}
                        {normalizeStatus(app.status) === 'Đang khám' && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 inline-flex items-center gap-1">
                            <PlayCircle className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                            Đang khám
                          </span>
                        )}
                        {normalizeStatus(app.status) === 'Hoàn thành' && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1">
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            Đã hoàn tất
                          </span>
                        )}
                        {normalizeStatus(app.status) === 'Đã hủy' && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700 inline-flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5 text-rose-400" />
                            Đã hủy
                          </span>
                        )}
                        {normalizeStatus(app.status) === 'unspecified' && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1" title="Trạng thái không hợp lệ hoặc thiếu dữ liệu. Hệ thống không tự ý gán trạng thái.">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>{app.status ? `Sai: "${app.status}"` : 'Thiếu trạng thái'}</span>
                          </span>
                        )}
                      </td>

                      {/* Cột 7: Thao tác */}
                      <td className="py-4 px-4 align-top text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          
                          {/* Nút Phân công bác sĩ nếu chưa phân công */}
                          {isAppointmentUnassigned(app) && normalizeStatus(app.status) !== 'Đã hủy' && (
                            <button
                              onClick={() => handleOpenAssign(app)}
                              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs shadow-sm active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                              title="Phân công bác sĩ cho ca khám này"
                            >
                              <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                              <span>Phân Công</span>
                            </button>
                          )}

                          {/* Nút Duyệt Lịch */}
                          {normalizeStatus(app.status) === 'Chờ duyệt' && !isAppointmentUnassigned(app) && (
                            <button
                              onClick={() => handleApprove(app)}
                              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-sm shadow-emerald-600/30 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                              title="Xác nhận duyệt lịch hẹn"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Duyệt Lịch</span>
                            </button>
                          )}

                          {/* Nút Bắt đầu khám */}
                          {normalizeStatus(app.status) === 'Đã duyệt' && (
                            <button
                              onClick={() => handleStartExam(app)}
                              className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-sm shadow-purple-600/30 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                              title="Chuyển sang trạng thái đang khám"
                            >
                              <PlayCircle className="w-3.5 h-3.5" />
                              <span>Vào Khám</span>
                            </button>
                          )}

                          {/* Nút Hoàn thành khám */}
                          {normalizeStatus(app.status) === 'Đang khám' && (
                            <button
                              onClick={() => handleCompleteExam(app)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm shadow-emerald-600/30 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                              title="Hoàn tất hồ sơ bệnh án"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Hoàn Tất</span>
                            </button>
                          )}

                          {/* Nút Đổi giờ / Từ chối */}
                          <button
                            onClick={() => handleOpenReschedule(app)}
                            className="p-1.5 rounded-xl bg-slate-900 border border-white/10 hover:border-amber-400 text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
                            title="Đổi giờ hẹn hoặc nhập lý do từ chối"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>

                          {/* Nút Phân công BS */}
                          <button
                            onClick={() => handleOpenAssign(app)}
                            className="p-1.5 rounded-xl bg-slate-900 border border-white/10 hover:border-purple-400 text-slate-400 hover:text-purple-300 transition-colors cursor-pointer"
                            title="Phân công bác sĩ"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>

                          {/* Nút Xóa */}
                          <button
                            onClick={() => {
                              if (confirm(`Bạn có chắc chắn muốn xóa lịch hẹn ${app.id}?`)) {
                                sound.playPop();
                                onDeleteAppointment(app.id);
                              }
                            }}
                            className="p-1.5 rounded-xl bg-slate-900 border border-white/10 hover:border-rose-500 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Xóa lịch hẹn"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: ĐỔI GIỜ / TỪ CHỐI LỊCH KHÁM                                     */}
      {/* ========================================================================= */}
      {rescheduleItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0f1322] border border-amber-500/30 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                <RotateCcw className="w-4 h-4" />
                <span>Đổi Khung Giờ / Phản Hồi Cho Chủ Nuôi</span>
              </div>
              <button 
                onClick={() => setRescheduleItem(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Lịch khám của bé <strong>{rescheduleItem.petName}</strong> (chủ nuôi {rescheduleItem.ownerName}):
            </p>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Đề xuất khung giờ mới:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {['09:00', '10:30', '14:30', '15:30', '17:00', '18:30'].map(slot => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setNewTimeSlot(slot)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      newTimeSlot === slot
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : 'bg-slate-900 border border-white/10 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Lý do / Hướng dẫn gửi đến người dùng:
              </label>
              <textarea
                rows={3}
                value={rescheduleNote}
                onChange={(e) => setRescheduleNote(e.target.value)}
                placeholder="Ví dụ: Slot giờ này Bác sĩ đang bận ca mổ cấp cứu, phòng khám đề xuất dời sang 15:30..."
                className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => handleSaveReschedule(true)}
                className="px-3 py-2 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/10 border border-rose-500/30 transition-colors cursor-pointer"
              >
                Hủy Ca Khám Này
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRescheduleItem(null)}
                  className="px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveReschedule(false)}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  Xác Nhận Đổi Giờ
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CHỈ ĐỊNH BÁC SĨ PHỤ TRÁCH                                        */}
      {/* ========================================================================= */}
      {assignDoctorItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0f1322] border border-purple-500/30 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2 text-purple-300 font-bold text-sm">
                <UserCheck className="w-4 h-4 text-purple-400" />
                <span>Chỉ Định Bác Sĩ Điều Phối</span>
              </div>
              <button 
                onClick={() => setAssignDoctorItem(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Chọn Bác sĩ chuyên khoa phụ trách ca khám của bé <strong>{assignDoctorItem.petName}</strong> ({assignDoctorItem.service}):
            </p>

            <div className="space-y-2">
              {availableVetDoctors.map((doc) => {
                const isSelected = selectedDoctor === doc.name;
                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => { sound.playClick(); setSelectedDoctor(doc.name); }}
                    className={`w-full p-3 rounded-2xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                      isSelected
                        ? 'bg-purple-600/25 border-purple-500 text-white shadow-md shadow-purple-500/10'
                        : 'bg-slate-900 border-white/10 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold shrink-0">
                      👨‍⚕️
                    </div>
                    <div>
                      <strong className="block text-xs font-bold text-white">{doc.name}</strong>
                      <span className="text-[11px] text-slate-400">{doc.spec}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setAssignDoctorItem(null)}
                className="px-3.5 py-2 rounded-xl text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveAssign}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-purple-600/30 cursor-pointer"
              >
                Lưu Phân Công
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default VetAppointmentsAdminView;
