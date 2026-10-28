import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  Lock, 
  Unlock, 
  ShieldCheck, 
  Stethoscope, 
  User, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Edit3, 
  Eye, 
  EyeOff,
  AlertTriangle, 
  ChevronLeft, 
  ChevronRight, 
  X,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Save,
  Check,
  UserPlus,
  KeyRound,
  Copy,
  RefreshCw,
  Shield,
  Trash2
} from 'lucide-react';
import { 
  ROLES, 
  VET_STATUS,
  adminUpdateUser, 
  adminToggleLockUser, 
  adminChangeUserRole,
  adminCreateUser,
  adminResetUserPassword,
  adminDeleteUser
} from '../../services/authService';
import { 
  getPets,
  auditOrphanedPets
} from '../../services/storageService';
import { OrphanedPetsCleanupModal } from './OrphanedPetsCleanupModal';
import { sound } from '../../services/soundService';
import { VET_FACILITIES, findFacilityById } from '../../constants/clinicFacilities';

export const AdminAccountsView = ({
  users = [],
  usersLoading = false,
  usersError = null,
  onRetry = null,
  currentAdmin = null,
  onUsersUpdated
}) => {
  const [internalUsers, setInternalUsers] = useState(users);

  // Luôn đồng bộ danh sách nội bộ khi prop users từ tầng cha (App.jsx / Backend reload) thay đổi
  useEffect(() => {
    if (Array.isArray(users)) {
      setInternalUsers(users);
    }
  }, [users]);

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  // Trạng thái modal dọn dẹp dữ liệu tài khoản đã xóa
  const [isOrphanedModalOpen, setIsOrphanedModalOpen] = useState(false);
  const [orphanedAuditState, setOrphanedAuditState] = useState(() => auditOrphanedPets());

  // Modal State
  const [viewingUser, setViewingUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [confirmLockModal, setConfirmLockModal] = useState({ isOpen: false, user: null });
  const [confirmRoleModal, setConfirmRoleModal] = useState({ isOpen: false, user: null, targetRole: '' });

  // Provisioning & Password Modals State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: ROLES.PET_OWNER,
    password: '',
    confirmPassword: '',
    isLocked: false
  });
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showCreateConfirmPassword, setShowCreateConfirmPassword] = useState(false);
  const [createError, setCreateError] = useState('');
  const [isCreateSubmitting, setIsCreateSubmitting] = useState(false);

  // Reset Password Modal State
  const [resetPasswordModal, setResetPasswordModal] = useState({
    isOpen: false,
    user: null,
    temporaryPassword: ''
  });
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetError, setResetError] = useState('');
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);

  // Delete User Modal State (Xóa tài khoản)
  const [confirmDeleteModal, setConfirmDeleteModal] = useState({ isOpen: false, user: null });
  const [confirmDeleteEmail, setConfirmDeleteEmail] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleteSubmitting, setIsDeleteSubmitting] = useState(false);

  // Danh sách thú cưng của người dùng đang được mở modal xác nhận xóa
  const targetUserPets = useMemo(() => {
    if (!confirmDeleteModal.user || confirmDeleteModal.user.role === ROLES.VET_DOCTOR) return [];
    const all = getPets();
    const uid = String(confirmDeleteModal.user.id).trim();
    return (all || []).filter(p => String(p.ownerId).trim() === uid);
  }, [confirmDeleteModal.user]);

  // Lắng nghe sự kiện dọn dẹp để tự động cập nhật số liệu
  useEffect(() => {
    const handleCleaned = () => {
      setOrphanedAuditState(auditOrphanedPets());
    };
    window.addEventListener('petcare_data_cleaned', handleCleaned);
    return () => window.removeEventListener('petcare_data_cleaned', handleCleaned);
  }, []);

  // Modal hiển thị thông tin tài khoản vừa cấp/đặt lại để sao chép
  const [credentialModal, setCredentialModal] = useState(null); // { user, temporaryPassword, isReset }
  const [hasCopiedCredentials, setHasCopiedCredentials] = useState(false);
  
  // Notification banner state
  const [notice, setNotice] = useState(null); // { type: 'success' | 'error', text: '' }

  const showNotice = (text, type = 'success') => {
    setNotice({ text, type });
    if (type === 'success') {
      sound?.playSuccess?.();
    } else {
      sound?.playAlert?.();
    }
    setTimeout(() => {
      setNotice(null);
    }, 4000);
  };

  // Hàm tạo mật khẩu ngẫu nhiên an toàn
  const generateRandomPassword = () => {
    const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowers = 'abcdefghijkmnopqrstuvwxyz';
    const digits = '23456789';
    const specials = '!@#$%^&*';
    const all = uppers + lowers + digits + specials;

    let pass = '';
    pass += uppers[Math.floor(Math.random() * uppers.length)];
    pass += lowers[Math.floor(Math.random() * lowers.length)];
    pass += digits[Math.floor(Math.random() * digits.length)];
    pass += specials[Math.floor(Math.random() * specials.length)];
    for (let i = 4; i < 10; i++) {
      pass += all[Math.floor(Math.random() * all.length)];
    }
    return pass.split('').sort(() => 0.5 - Math.random()).join('');
  };

  // Lọc và Tìm kiếm danh sách tài khoản (sử dụng internalUsers để phản ánh tức thì)
  const filteredUsers = useMemo(() => {
    return (internalUsers || []).filter(u => {
      const matchSearch = !searchTerm.trim() || 
        (u.name || '').toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        (u.email || '').toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        (u.phone || '').includes(searchTerm.trim());

      const matchRole = roleFilter === 'all' || u.role === roleFilter;

      const matchStatus = statusFilter === 'all' || 
        (statusFilter === 'active' && !u.isLocked) ||
        (statusFilter === 'locked' && u.isLocked);

      return matchSearch && matchRole && matchStatus;
    });
  }, [internalUsers, searchTerm, roleFilter, statusFilter]);

  // Phân trang
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  // Handle Edit form submission (Chỉ cập nhật trường cho phép & cấu hình cơ sở bác sĩ)
  const [editFormData, setEditFormData] = useState({ name: '', phone: '', address: '', avatar: '', facilityId: '' });

  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setEditFormData({
      name: user.name || '',
      phone: user.phone || '',
      address: user.address || '',
      avatar: user.avatar || '',
      facilityId: user.facilityId || ''
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const updated = await adminUpdateUser(currentAdmin?.id, editingUser.id, editFormData);
      showNotice(`Đã cập nhật thông tin tài khoản "${editingUser.name}" thành công!`);
      setInternalUsers(prev => (prev || []).map(u => String(u.id) === String(editingUser.id) ? { ...u, ...editFormData, ...(updated || {}) } : u));
      setEditingUser(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('petcare_data_synced'));
      }
      if (onUsersUpdated) onUsersUpdated();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  };

  // Handle Lock / Unlock
  const handleConfirmToggleLock = async () => {
    const target = confirmLockModal.user;
    if (!target) return;
    if (target.role === ROLES.SYSTEM_ADMIN && !target.isLocked) {
      const activeAdmins = (internalUsers || []).filter(u => u.role === ROLES.SYSTEM_ADMIN && !u.isLocked);
      if (activeAdmins.length <= 1) {
        showNotice('Không thể khóa Quản trị viên hệ thống hoạt động cuối cùng của hệ thống!', 'error');
        setConfirmLockModal({ isOpen: false, user: null });
        return;
      }
    }
    try {
      await adminToggleLockUser(currentAdmin?.id, target.id);
      showNotice(target.isLocked ? `Đã mở khóa tài khoản "${target.name}".` : `Đã khóa tài khoản "${target.name}".`);
      setInternalUsers(prev => (prev || []).map(u => String(u.id) === String(target.id) ? { ...u, isLocked: !target.isLocked } : u));
      setConfirmLockModal({ isOpen: false, user: null });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('petcare_data_synced'));
      }
      if (onUsersUpdated) onUsersUpdated();
    } catch (err) {
      showNotice(err.message, 'error');
      setConfirmLockModal({ isOpen: false, user: null });
    }
  };

  // Handle Change Role (Chặn leo thang đặc quyền SYSTEM_ADMIN, chỉ cho phép giữa PET_OWNER và VET_DOCTOR)
  const handleConfirmRoleChange = async () => {
    const { user, targetRole } = confirmRoleModal;
    if (!user || !targetRole) return;

    // RÀNG BUỘC BẢO MẬT 1: Tuyệt đối không cho phép gán hoặc leo thang quyền SYSTEM_ADMIN
    if (targetRole === ROLES.SYSTEM_ADMIN || targetRole === 'system_admin') {
      showNotice('Không được phép gán hoặc thăng quyền Quản trị viên hệ thống qua giao diện!', 'error');
      setConfirmRoleModal({ isOpen: false, user: null, targetRole: '' });
      return;
    }

    // RÀNG BUỘC BẢO MẬT 2: Tuyệt đối không cho phép thay đổi vai trò của Quản trị viên hệ thống
    if (user.role === ROLES.SYSTEM_ADMIN || user.role === 'system_admin') {
      showNotice('Không thể thay đổi vai trò của Quản trị viên hệ thống!', 'error');
      setConfirmRoleModal({ isOpen: false, user: null, targetRole: '' });
      return;
    }

    // RÀNG BUỘC BẢO MẬT 3: Chỉ cho phép chuyển đổi giữa Chủ nuôi và Bác sĩ thú y
    if (targetRole !== ROLES.PET_OWNER && targetRole !== ROLES.VET_DOCTOR) {
      showNotice('Vai trò không hợp lệ. Chỉ cho phép chuyển đổi giữa Chủ nuôi và Bác sĩ thú y!', 'error');
      setConfirmRoleModal({ isOpen: false, user: null, targetRole: '' });
      return;
    }

    try {
      await adminChangeUserRole(currentAdmin?.id, user.id, targetRole);
      showNotice(`Đã đổi vai trò tài khoản "${user.name}" thành công.`);
      setInternalUsers(prev => (prev || []).map(u => String(u.id) === String(user.id) ? { ...u, role: targetRole } : u));
      setConfirmRoleModal({ isOpen: false, user: null, targetRole: '' });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('petcare_data_synced'));
      }
      if (onUsersUpdated) onUsersUpdated();
    } catch (err) {
      showNotice(err.message, 'error');
      setConfirmRoleModal({ isOpen: false, user: null, targetRole: '' });
    }
  };

  // Mở modal Tạo Tài Khoản Mới
  const handleOpenCreateModal = () => {
    const initialPass = generateRandomPassword();
    setCreateFormData({
      name: '',
      email: '',
      phone: '',
      role: ROLES.PET_OWNER,
      password: initialPass,
      confirmPassword: initialPass,
      isLocked: false
    });
    setCreateError('');
    setIsCreateModalOpen(true);
  };

  // Xử lý Admin Tạo Tài Khoản Mới
  const handleCreateAccountSubmit = async (e) => {
    e.preventDefault();
    setCreateError('');

    const cleanEmail = (createFormData.email || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!createFormData.name.trim()) {
      setCreateError('Vui lòng nhập Họ và tên.');
      sound?.playAlert?.();
      return;
    }

    if (!cleanEmail) {
      setCreateError('Vui lòng nhập Email đăng nhập.');
      sound?.playAlert?.();
      return;
    }

    if (!emailRegex.test(cleanEmail)) {
      setCreateError('Địa chỉ email không đúng định dạng (ví dụ: name@example.com).');
      sound?.playAlert?.();
      return;
    }


    if (!createFormData.password || createFormData.password.length < 6) {
      setCreateError('Mật khẩu tạm thời phải từ 6 ký tự trở lên.');
      sound?.playAlert?.();
      return;
    }

    if (createFormData.password !== createFormData.confirmPassword) {
      setCreateError('Xác nhận mật khẩu tạm thời không trùng khớp.');
      sound?.playAlert?.();
      return;
    }

    setIsCreateSubmitting(true);
    try {
      const createdUser = await adminCreateUser(currentAdmin?.id, {
        name: createFormData.name.trim(),
        email: cleanEmail,
        phone: createFormData.phone.trim(),
        role: createFormData.role,
        password: createFormData.password,
        isLocked: createFormData.isLocked
      });

      setIsCreateSubmitting(false);
      setIsCreateModalOpen(false);

      // Cập nhật trực tiếp danh sách state quản lý users nội bộ để phản ánh tức thì
      setInternalUsers(prev => {
        const list = Array.isArray(prev) ? prev : [];
        const exists = list.some(u => String(u.id).trim() === String(createdUser.id).trim());
        return exists
          ? list.map(u => String(u.id).trim() === String(createdUser.id).trim() ? createdUser : u)
          : [createdUser, ...list];
      });

      // Mở modal hiển thị mật khẩu tạm thời để admin sao chép ngay
      setCredentialModal({
        user: createdUser,
        temporaryPassword: createFormData.password,
        isReset: false
      });
      setHasCopiedCredentials(false);

      showNotice(`Đã tạo thành công tài khoản "${createdUser.name}"!`);

      // Kích hoạt đồng thời sự kiện toàn cục và callback làm mới dữ liệu
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('petcare_data_synced'));
      }
      if (onUsersUpdated) onUsersUpdated();
    } catch (err) {
      setIsCreateSubmitting(false);
      sound?.playAlert?.();
      setCreateError(err.message || 'Không thể tạo tài khoản.');
    }
  };

  // Mở modal Đặt Lại Mật Khẩu Tạm Thời
  const handleOpenResetPasswordModal = (user) => {
    const tempPass = generateRandomPassword();
    setResetPasswordModal({
      isOpen: true,
      user,
      temporaryPassword: tempPass
    });
    setResetError('');
  };

  // Xử lý Admin Đặt Lại Mật Khẩu
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setResetError('');

    if (!resetPasswordModal.temporaryPassword || resetPasswordModal.temporaryPassword.length < 6) {
      setResetError('Mật khẩu tạm thời phải từ 6 ký tự trở lên.');
      sound?.playAlert?.();
      return;
    }

    if (!resetPasswordModal.user) {
      setResetError('Không tìm thấy tài khoản người dùng.');
      return;
    }

    setIsResetSubmitting(true);
    try {
      const updatedUser = await adminResetUserPassword(
        currentAdmin?.id,
        resetPasswordModal.user.id,
        resetPasswordModal.temporaryPassword,
        resetPasswordModal.user.email
      );

      setIsResetSubmitting(false);
      const targetUser = resetPasswordModal.user;
      const pass = resetPasswordModal.temporaryPassword;
      setResetPasswordModal({ isOpen: false, user: null, temporaryPassword: '' });

      // Cập nhật trực tiếp danh sách state quản lý users nội bộ để phản ánh tức thì
      setInternalUsers(prev => {
        const list = Array.isArray(prev) ? prev : [];
        return list.map(u => String(u.id).trim() === String(targetUser.id).trim() ? { ...u, ...updatedUser } : u);
      });

      // Mở modal hiển thị mật khẩu mới để admin sao chép
      setCredentialModal({
        user: { ...targetUser, ...updatedUser },
        temporaryPassword: pass,
        isReset: true
      });
      setHasCopiedCredentials(false);

      showNotice(`Đã đặt lại mật khẩu tạm thời cho tài khoản "${targetUser.name}".`);

      // Kích hoạt đồng thời sự kiện toàn cục và callback làm mới dữ liệu
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('petcare_data_synced'));
      }
      if (onUsersUpdated) onUsersUpdated();
    } catch (err) {
      setIsResetSubmitting(false);
      sound?.playAlert?.();
      const msg = err.message || 'Không thể đặt lại mật khẩu.';
      setResetError(msg);
      // Nếu tài khoản đã bị xóa trong lúc mở hộp thoại, thông báo rõ và tải lại danh sách
      if (msg.toLowerCase().includes('đã bị xóa') || msg.toLowerCase().includes('không tìm thấy')) {
        showNotice(msg, 'error');
        setResetPasswordModal({ isOpen: false, user: null, temporaryPassword: '' });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('petcare_data_synced'));
        }
        if (onUsersUpdated) onUsersUpdated();
      }
    }
  };

  // Mở modal Xóa Tài Khoản
  const handleOpenDeleteModal = (user) => {
    setConfirmDeleteModal({ isOpen: true, user });
    setConfirmDeleteEmail('');
    setDeleteError('');
    setIsDeleteSubmitting(false);
  };

  // Xử lý Admin Xác Nhận Xóa Tài Khoản
  const handleConfirmDeleteUserSubmit = async (e) => {
    e.preventDefault();
    if (!confirmDeleteModal.user || isDeleteSubmitting) return;

    const target = confirmDeleteModal.user;
    const cleanConfirm = confirmDeleteEmail.trim().toLowerCase();

    if (cleanConfirm !== (target.email || '').trim().toLowerCase()) {
      setDeleteError('Email xác nhận không khớp với email của tài khoản.');
      sound?.playAlert?.();
      return;
    }

    setIsDeleteSubmitting(true);
    setDeleteError('');

    try {
      await adminDeleteUser(
        currentAdmin?.id,
        target.id,
        cleanConfirm,
        target.email
      );

      setIsDeleteSubmitting(false);
      setConfirmDeleteModal({ isOpen: false, user: null });
      setConfirmDeleteEmail('');

      // Cập nhật trực tiếp danh sách state quản lý users nội bộ để loại bỏ user tức thì
      setInternalUsers(prev => {
        const list = Array.isArray(prev) ? prev : [];
        return list.filter(u => String(u.id).trim() !== String(target.id).trim());
      });

      showNotice(`Đã xóa vĩnh viễn tài khoản "${target.name}" (${target.email}) thành công.`);

      // Điều chỉnh phân trang nếu trang hiện tại bị trống sau khi xóa
      if (currentPage > 1 && paginatedUsers.length === 1) {
        setCurrentPage(currentPage - 1);
      }

      // Kích hoạt đồng thời sự kiện toàn cục và callback làm mới dữ liệu
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('petcare_data_synced'));
      }
      if (onUsersUpdated) onUsersUpdated();
    } catch (err) {
      setIsDeleteSubmitting(false);
      sound?.playAlert?.();
      const msg = err.message || 'Không thể xóa tài khoản.';
      setDeleteError(msg);
      // Nếu tài khoản đã bị xóa trước đó, thông báo rõ và tải lại danh sách
      if (msg.toLowerCase().includes('đã bị xóa') || msg.toLowerCase().includes('không tìm thấy')) {
        showNotice(msg, 'error');
        setConfirmDeleteModal({ isOpen: false, user: null });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('petcare_data_synced'));
        }
        if (onUsersUpdated) onUsersUpdated();
      }
    }
  };

  // Sao chép thông tin tài khoản được cấp vào Clipboard
  const handleCopyCredentials = () => {
    if (!credentialModal) return;
    const { user, temporaryPassword, isReset } = credentialModal;
    const roleText = user.role === ROLES.VET_DOCTOR ? 'Bác sĩ thú y (Vet Doctor)' : user.role === ROLES.SYSTEM_ADMIN ? 'Quản trị viên (System Admin)' : 'Chủ nuôi (Pet Owner)';
    const statusText = user.isLocked ? 'Đang bị khóa' : 'Đang hoạt động';
    const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://petcare.ai';

    const textToCopy = `=== THÔNG TIN CẤP TÀI KHOẢN PETCARE PRO AI ===
Họ và tên: ${user.name}
Email đăng nhập: ${user.email}
Vai trò hệ thống: ${roleText}
Mật khẩu tạm thời: ${temporaryPassword}
Trạng thái: ${statusText}
Đường dẫn đăng nhập: ${appOrigin}/login

LƯU Ý: Đây là mật khẩu tạm thời do Quản trị viên cấp. Bạn vui lòng đăng nhập và đổi sang mật khẩu mới ở lần truy cập đầu tiên.
==============================================`;

    try {
      navigator.clipboard.writeText(textToCopy);
      setHasCopiedCredentials(true);
      sound?.playSuccess?.();
      setTimeout(() => setHasCopiedCredentials(false), 3000);
    } catch {
      showNotice('Không thể tự động sao chép. Vui lòng chọn và sao chép thủ công.', 'error');
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case ROLES.SYSTEM_ADMIN:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-400/30">
            <ShieldCheck className="w-3.5 h-3.5" /> Quản trị viên
          </span>
        );
      case ROLES.VET_DOCTOR:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-400/30">
            <Stethoscope className="w-3.5 h-3.5" /> Bác sĩ thú y
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-400/30">
            <User className="w-3.5 h-3.5" /> Chủ nuôi
          </span>
        );
    }
  };

  const formatDate = (dateStr) => {
    try {
      if (!dateStr) return 'N/A';
      const d = new Date(dateStr);
      return d.toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch {
      return 'N/A';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Thông báo kết quả thao tác */}
      {notice && (
        <div className={`p-4 rounded-2xl border text-sm font-semibold flex items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-200 ${
          notice.type === 'error'
            ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/30 text-rose-700 dark:text-rose-300'
            : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
        }`}>
          <div className="flex items-center gap-2">
            {notice.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
            <span>{notice.text}</span>
          </div>
          <button onClick={() => setNotice(null)} className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Banner Lỗi tải dữ liệu tài khoản từ máy chủ kèm nút Thử lại */}
      {usersError && (
        <div className="p-4 sm:p-5 rounded-3xl bg-rose-500/10 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in duration-200 shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Không thể tải danh sách tài khoản từ máy chủ</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-500/20 text-rose-600 dark:text-rose-300">
                  Lỗi kết nối
                </span>
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                {usersError}. Danh sách tài khoản hiển thị bên dưới có thể không đầy đủ hoặc bị gián đoạn.
              </p>
            </div>
          </div>

          {onRetry && (
            <button
              type="button"
              onClick={() => {
                sound?.playClick?.();
                onRetry();
              }}
              disabled={usersLoading}
              className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${usersLoading ? 'animate-spin' : ''}`} />
              <span>{usersLoading ? 'Đang tải lại...' : 'Thử lại'}</span>
            </button>
          )}
        </div>
      )}

      {/* Header & Bộ Lọc */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-[#E2E8F0] dark:border-white/10 shadow-sm text-[#1E293B] dark:text-slate-100 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>Danh Sách & Quản Trị Tài Khoản</span>
            </h2>
            <p className="text-xs text-[#475569] dark:text-slate-400 mt-0.5">
              Hệ thống cấp tài khoản tập trung: Tổng số {filteredUsers.length} tài khoản phù hợp
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(orphanedAuditState.confirmedDeletedOwnerPets.length > 0 || orphanedAuditState.unclearOwnerPets.length > 0) && (
              <button
                type="button"
                id="btn-admin-cleanup-orphaned"
                onClick={() => setIsOrphanedModalOpen(true)}
                className="px-3.5 py-2.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 active:scale-95 text-rose-600 dark:text-rose-300 font-bold text-xs border border-rose-500/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Dọn dữ liệu của tài khoản đã xóa ({orphanedAuditState.confirmedDeletedOwnerPets.length})</span>
              </button>
            )}

            {/* NÚT TẠO TÀI KHOẢN MỚI */}
            <button
              type="button"
              id="btn-admin-create-account"
              onClick={handleOpenCreateModal}
              className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Tạo tài khoản mới</span>
            </button>
          </div>
        </div>

        {/* Thanh tìm kiếm và bộ lọc */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {/* Tìm kiếm */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo tên, email, sđt..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-3.5 py-2.5 bg-[#F8FAFC] dark:bg-[#1c1d2e] border border-[#E2E8F0] dark:border-white/10 rounded-2xl text-xs text-[#1E293B] dark:text-white placeholder:text-[#64748B] focus:outline-hidden focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Lọc theo Vai trò */}
          <div>
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3.5 py-2.5 bg-[#F8FAFC] dark:bg-[#1c1d2e] border border-[#E2E8F0] dark:border-white/10 rounded-2xl text-xs text-[#1E293B] dark:text-white focus:outline-hidden focus:border-indigo-500 transition-colors cursor-pointer"
            >
              <option value="all">Tất cả vai trò</option>
              <option value={ROLES.PET_OWNER}>Chủ nuôi (Pet Owner)</option>
              <option value={ROLES.VET_DOCTOR}>Bác sĩ thú y (Vet Doctor)</option>
              <option value={ROLES.SYSTEM_ADMIN}>Quản trị viên (System Admin)</option>
            </select>
          </div>

          {/* Lọc theo Trạng thái khóa */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3.5 py-2.5 bg-[#F8FAFC] dark:bg-[#1c1d2e] border border-[#E2E8F0] dark:border-white/10 rounded-2xl text-xs text-[#1E293B] dark:text-white focus:outline-hidden focus:border-indigo-500 transition-colors cursor-pointer"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="locked">Đã bị khóa</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bảng Dữ Liệu Tài Khoản (Desktop & Tablet) */}
      <div className="rounded-3xl bg-white dark:bg-slate-900/80 border border-[#E2E8F0] dark:border-white/10 shadow-sm text-[#1E293B] dark:text-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.02] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Tài Khoản & Họ Tên</th>
                <th className="py-3.5 px-4">Email</th>
                <th className="py-3.5 px-4">Vai Trò</th>
                <th className="py-3.5 px-4">Trạng Thái</th>
                <th className="py-3.5 px-4">Ngày Tạo</th>
                <th className="py-3.5 px-4 text-right">Thao Tác Quản Trị</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Không tìm thấy tài khoản nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map(user => {
                  const isCurrentSelf = user.id === currentAdmin?.id;
                  return (
                    <tr 
                      key={user.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Họ tên & Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img 
                            src={user.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150"} 
                            alt="" 
                            className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-white/10 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white truncate">
                              {user.name} {isCurrentSelf && <span className="text-[10px] text-indigo-500 font-bold">(Bạn)</span>}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">
                              {user.phone || 'Chưa có SĐT'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-300">
                        {user.email}
                      </td>

                      {/* Vai trò */}
                      <td className="py-3.5 px-4">
                        {getRoleBadge(user.role)}
                        {user.role === ROLES.VET_DOCTOR && (
                          <div className="mt-1">
                            {user.facilityId ? (
                              <span className="inline-flex items-center gap-1 text-[10px] text-indigo-400 font-medium bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20" title={`Cơ sở công tác: ${findFacilityById(user.facilityId)?.name || user.facilityId}`}>
                                🏥 {findFacilityById(user.facilityId)?.name?.replace('Bệnh viện Thú y ', '').replace('Phòng khám ', '') || user.facilityId}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] text-amber-400/90 font-medium bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20" title="Chưa liên kết cơ sở công tác. Bấm nút Sửa để phân công cơ sở.">
                                ⚠️ Chưa gán cơ sở
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Trạng thái khóa & Cờ đổi mật khẩu */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          {user.isLocked ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                              <Lock className="w-3 h-3" /> Bị khóa
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                              <CheckCircle className="w-3 h-3" /> Hoạt động
                            </span>
                          )}

                          {user.mustChangePassword && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25" title="Người dùng cần đổi mật khẩu tạm thời ở lần đăng nhập tới">
                              <KeyRound className="w-3 h-3" /> Chưa đổi MK lần đầu
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Ngày tạo */}
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        {formatDate(user.createdAt)}
                      </td>

                      {/* Thao tác */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Nút Xem chi tiết */}
                          <button
                            onClick={() => setViewingUser(user)}
                            title="Xem chi tiết"
                            className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Nút Sửa thông tin */}
                          <button
                            onClick={() => handleOpenEdit(user)}
                            title="Sửa thông tin"
                            className="p-1.5 rounded-xl text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* Nút ĐẶT LẠI MẬT KHẨU TẠM THỜI */}
                          <button
                            onClick={() => handleOpenResetPasswordModal(user)}
                            title="Đặt lại mật khẩu tạm thời"
                            className="p-1.5 rounded-xl text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors cursor-pointer"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>

                          {/* Đổi vai trò (Chỉ chuyển đổi giữa Chủ nuôi và Bác sĩ thú y, chặn Quản trị viên hệ thống) */}
                          {(() => {
                            const isSystemAdmin = user.role === ROLES.SYSTEM_ADMIN || user.role === 'system_admin';
                            const nextRole = user.role === ROLES.VET_DOCTOR ? ROLES.PET_OWNER : ROLES.VET_DOCTOR;
                            const roleTooltip = isSystemAdmin
                              ? 'Không thể thay đổi vai trò của Quản trị viên hệ thống'
                              : `Đổi vai trò sang ${nextRole === ROLES.VET_DOCTOR ? 'Bác sĩ thú y' : 'Chủ nuôi'}`;

                            return (
                              <button
                                onClick={() => {
                                  if (isSystemAdmin) {
                                    showNotice(roleTooltip, 'error');
                                    return;
                                  }
                                  setConfirmRoleModal({ isOpen: true, user, targetRole: nextRole });
                                }}
                                disabled={isSystemAdmin}
                                title={roleTooltip}
                                aria-label={roleTooltip}
                                className={`px-2 py-1 rounded-xl border text-[11px] font-semibold transition-colors cursor-pointer ${
                                  isSystemAdmin
                                    ? 'border-slate-200 dark:border-white/5 text-slate-400 dark:text-slate-600 opacity-40 cursor-not-allowed'
                                    : 'border-slate-200 dark:border-white/10 hover:border-indigo-400 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                Đổi vai trò
                              </button>
                            );
                          })()}

                          {/* Khóa / Mở khóa */}
                          {(() => {
                            const isLastAdminToLock = user.role === ROLES.SYSTEM_ADMIN && !user.isLocked && 
                              (internalUsers || []).filter(u => u.role === ROLES.SYSTEM_ADMIN && !u.isLocked).length <= 1;
                            const isLockDisabled = isCurrentSelf || isLastAdminToLock;
                            const lockTitle = isCurrentSelf 
                              ? 'Không thể tự khóa tài khoản quản trị viên đang đăng nhập' 
                              : isLastAdminToLock 
                              ? 'Không thể khóa Quản trị viên hệ thống hoạt động cuối cùng của hệ thống' 
                              : user.isLocked ? 'Mở khóa tài khoản' : 'Khóa tài khoản';

                            return (
                              <button
                                onClick={() => {
                                  if (isCurrentSelf) {
                                    showNotice('Không thể tự khóa tài khoản quản trị viên đang đăng nhập!', 'error');
                                    return;
                                  }
                                  if (isLastAdminToLock) {
                                    showNotice('Không thể khóa Quản trị viên hệ thống hoạt động cuối cùng của hệ thống!', 'error');
                                    return;
                                  }
                                  setConfirmLockModal({ isOpen: true, user });
                                }}
                                disabled={isLockDisabled}
                                title={lockTitle}
                                className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                                  isLockDisabled 
                                    ? 'opacity-30 cursor-not-allowed text-slate-400'
                                    : user.isLocked 
                                    ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10' 
                                    : 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10'
                                }`}
                              >
                                {user.isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                              </button>
                            );
                          })()}

                          {/* Nút XÓA TÀI KHOẢN (Biểu tượng thùng rác màu đỏ) */}
                          {(() => {
                            const isSelf = String(user.id).trim() === String(currentAdmin?.id).trim() || 
                                           (user.email || '').toLowerCase() === (currentAdmin?.email || '').toLowerCase();
                            const isLastAdmin = user.role === ROLES.SYSTEM_ADMIN && 
                                                (internalUsers || []).filter(u => u.role === ROLES.SYSTEM_ADMIN && !u.isLocked).length <= 1;
                            const isDeleteDisabled = isSelf || isLastAdmin;
                            const deleteTooltip = isSelf 
                              ? 'Không thể xóa tài khoản admin đang đăng nhập' 
                              : isLastAdmin 
                              ? 'Không thể xóa quản trị viên hệ thống hoạt động cuối cùng' 
                              : `Xóa tài khoản ${user.name}`;

                            return (
                              <button
                                onClick={() => {
                                  if (isDeleteDisabled) {
                                    showNotice(deleteTooltip, 'error');
                                    return;
                                  }
                                  handleOpenDeleteModal(user);
                                }}
                                disabled={isDeleteDisabled}
                                title={deleteTooltip}
                                aria-label={deleteTooltip}
                                className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                                  isDeleteDisabled
                                    ? 'opacity-25 cursor-not-allowed text-slate-400'
                                    : 'text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-500/15'
                                }`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Thanh Phân Trang */}
        <div className="p-4 border-t border-slate-200 dark:border-white/[0.08] flex items-center justify-between gap-3 text-xs">
          <p className="text-slate-500 dark:text-slate-400">
            Trang <span className="font-bold text-slate-900 dark:text-white">{currentPage}</span> / {totalPages}
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* MODAL 0: ADMIN TẠO TÀI KHOẢN MỚI                             */}
      {/* ============================================================ */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#151622] rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-100 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-500" />
                <span>Tạo Tài Khoản Mới (Cấp Cho Người Dùng)</span>
              </h3>
              <button 
                onClick={() => setIsCreateModalOpen(false)} 
                className="p-1.5 text-slate-400 hover:text-white rounded-xl"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createError && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateAccountSubmit} className="space-y-3.5 text-xs">
              {/* Họ và tên */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Họ và tên *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn An hoặc BS. Trần Thuỳ Trang"
                  value={createFormData.name}
                  onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#1c1d2e] border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              {/* Email đăng nhập */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Email đăng nhập *
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@petcare.ai"
                  value={createFormData.email}
                  onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#1c1d2e] border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:border-indigo-500 font-mono"
                />
              </div>

              {/* Số điện thoại */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  placeholder="Ví dụ: 0988777666"
                  value={createFormData.phone}
                  onChange={(e) => setCreateFormData({ ...createFormData, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#1c1d2e] border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:border-indigo-500 font-mono"
                />
              </div>

              {/* Vai trò */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Vai trò tài khoản *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateFormData({ ...createFormData, role: ROLES.PET_OWNER })}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      createFormData.role === ROLES.PET_OWNER
                        ? 'bg-emerald-500/15 border-emerald-400 text-emerald-600 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                        : 'bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <User className="w-4 h-4" />
                    <span>Chủ nuôi (Pet Owner)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCreateFormData({ ...createFormData, role: ROLES.VET_DOCTOR })}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      createFormData.role === ROLES.VET_DOCTOR
                        ? 'bg-cyan-500/15 border-cyan-400 text-cyan-600 dark:text-cyan-300 ring-2 ring-cyan-500/20'
                        : 'bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Stethoscope className="w-4 h-4" />
                    <span>Bác sĩ thú y (Vet Doctor)</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {createFormData.role === ROLES.VET_DOCTOR 
                    ? '✨ Bác sĩ thú y do Admin tạo sẽ được cấp quyền hoạt động ngay, không cần chờ duyệt.' 
                    : '🐾 Tài khoản chủ nuôi có quyền quản lý thú cưng, lịch tiêm và dịch vụ cá nhân.'}
                </p>
              </div>

              {/* Mật khẩu tạm thời */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700 dark:text-slate-300 font-bold">
                    Mật khẩu tạm thời (tối thiểu 6 ký tự) *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const newP = generateRandomPassword();
                      setCreateFormData({ ...createFormData, password: newP, confirmPassword: newP });
                    }}
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Tạo ngẫu nhiên</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showCreatePassword ? 'text' : 'password'}
                    required
                    value={createFormData.password}
                    onChange={(e) => setCreateFormData({ ...createFormData, password: e.target.value })}
                    placeholder="Nhập hoặc bấm Tạo ngẫu nhiên"
                    className="w-full px-3.5 pr-10 py-2.5 bg-slate-50 dark:bg-[#1c1d2e] border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:border-indigo-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePassword(!showCreatePassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showCreatePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Xác nhận mật khẩu tạm thời */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Xác nhận mật khẩu tạm thời *
                </label>
                <div className="relative">
                  <input
                    type={showCreateConfirmPassword ? 'text' : 'password'}
                    required
                    value={createFormData.confirmPassword}
                    onChange={(e) => setCreateFormData({ ...createFormData, confirmPassword: e.target.value })}
                    placeholder="Nhập lại mật khẩu tạm thời"
                    className="w-full px-3.5 pr-10 py-2.5 bg-slate-50 dark:bg-[#1c1d2e] border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:border-indigo-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreateConfirmPassword(!showCreateConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showCreateConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Trạng thái tài khoản ban đầu */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Trạng thái tài khoản ban đầu
                </label>
                <select
                  value={createFormData.isLocked ? 'locked' : 'active'}
                  onChange={(e) => setCreateFormData({ ...createFormData, isLocked: e.target.value === 'locked' })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#1c1d2e] border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white"
                >
                  <option value="active">🟢 Đang hoạt động (Cho phép đăng nhập)</option>
                  <option value="locked">🔴 Bị khóa (Không cho phép đăng nhập)</option>
                </select>
              </div>

              <div className="p-3 rounded-2xl bg-indigo-50/50 dark:bg-white/[0.03] border border-indigo-100 dark:border-white/10 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                <p>• Người dùng sẽ được yêu cầu đổi mật khẩu ở lần đăng nhập đầu tiên.</p>
                <p>• Sau khi tạo, thông tin tài khoản và mật khẩu tạm sẽ hiện ra để bạn sao chép gửi cho người dùng.</p>
              </div>

              {/* Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 text-xs font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isCreateSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md shadow-indigo-500/20"
                >
                  {isCreateSubmitting ? (
                    <span>Đang tạo tài khoản...</span>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Xác nhận tạo tài khoản</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 0.1: ĐẶT LẠI MẬT KHẨU TẠM THỜI (ADMIN RESET PASSWORD)    */}
      {/* ============================================================ */}
      {resetPasswordModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#151622] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-500" />
                <span>Đặt Lại Mật Khẩu Tạm Thời</span>
              </h3>
              <button 
                onClick={() => setResetPasswordModal({ isOpen: false, user: null, temporaryPassword: '' })} 
                className="p-1.5 text-slate-400 hover:text-white rounded-xl"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 space-y-1 mb-4">
              <p className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Hộp thoại xác nhận đặt lại mật khẩu</span>
              </p>
              <p className="text-[11px] leading-relaxed">
                Tài khoản: <strong>{resetPasswordModal.user?.name}</strong> ({resetPasswordModal.user?.email}).
                Hành động này sẽ tạo mật khẩu tạm thời mới, vô hiệu hóa toàn bộ phiên đăng nhập cũ và yêu cầu người dùng đổi mật khẩu ở lần truy cập tiếp theo.
              </p>
            </div>

            {resetError && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{resetError}</span>
              </div>
            )}

            <form onSubmit={handleResetPasswordSubmit} className="space-y-3.5 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700 dark:text-slate-300 font-bold">
                    Mật khẩu tạm thời mới (tối thiểu 6 ký tự) *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetPasswordModal({
                        ...resetPasswordModal,
                        temporaryPassword: generateRandomPassword()
                      });
                    }}
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Tạo ngẫu nhiên</span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    value={resetPasswordModal.temporaryPassword}
                    onChange={(e) => setResetPasswordModal({ ...resetPasswordModal, temporaryPassword: e.target.value })}
                    className="w-full px-3.5 pr-10 py-2.5 bg-slate-50 dark:bg-[#1c1d2e] border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetPasswordModal({ isOpen: false, user: null, temporaryPassword: '' })}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 text-xs font-bold"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isResetSubmitting}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md shadow-amber-500/20"
                >
                  {isResetSubmitting ? (
                    <span>Đang xử lý...</span>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Xác nhận đặt lại mật khẩu</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 0.2: THÔNG BÁO VÀ SAO CHÉP THÔNG TIN CẤP TÀI KHOẢN       */}
      {/* ============================================================ */}
      {credentialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#151622] rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-emerald-500/30 text-slate-800 dark:text-slate-100 animate-in zoom-in-95 duration-200">
            <div className="text-center mb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-2.5 ring-4 ring-emerald-500/15">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {credentialModal.isReset ? 'Đã Đặt Lại Mật Khẩu Thành Công' : 'Đã Cấp Tài Khoản Thành Công'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Hãy sao chép thông tin tài khoản bên dưới và gửi trực tiếp cho người dùng.
              </p>
            </div>

            <div className="space-y-2.5 p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Họ và tên:</span>
                <span className="font-bold text-slate-900 dark:text-white">{credentialModal.user.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Email đăng nhập:</span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{credentialModal.user.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Vai trò:</span>
                <span>{getRoleBadge(credentialModal.user.role)}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-white/10">
                <span className="text-slate-500 font-bold">Mật khẩu tạm thời:</span>
                <span className="font-mono text-sm font-extrabold px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30 select-all">
                  {credentialModal.temporaryPassword}
                </span>
              </div>
            </div>

            <div className="mt-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300 space-y-1">
              <p className="font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Quy định bảo mật:</span>
              </p>
              <p>• Mật khẩu tạm thời này chỉ hiển thị một lần duy nhất tại đây.</p>
              <p>• Người dùng bắt buộc phải đổi mật khẩu ở lần đăng nhập đầu tiên.</p>
              <p>• Hệ thống không tự động gửi email hoặc tin nhắn.</p>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleCopyCredentials}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
              >
                {hasCopiedCredentials ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Đã sao chép vào bộ nhớ tạm!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Sao chép thông tin tài khoản</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setCredentialModal(null)}
                className="py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 text-xs font-bold cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 0.3: XÁC NHẬN XÓA TÀI KHOẢN VĨNH VIỄN (ADMIN DELETE)    */}
      {/* ============================================================ */}
      {confirmDeleteModal.isOpen && confirmDeleteModal.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#151622] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-500/30 text-slate-800 dark:text-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10 mb-4">
              <h3 className="text-base font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-500" />
                <span>Xác Nhận Xóa Tài Khoản</span>
              </h3>
              <button 
                onClick={() => !isDeleteSubmitting && setConfirmDeleteModal({ isOpen: false, user: null })} 
                disabled={isDeleteSubmitting}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl disabled:opacity-40 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Thông tin tài khoản cần xóa */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <img 
                  src={confirmDeleteModal.user.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150"} 
                  alt="" 
                  className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-white/10 shrink-0"
                />
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 dark:text-white truncate text-xs sm:text-sm">
                    {confirmDeleteModal.user.name}
                  </p>
                  <p className="text-xs font-mono text-slate-500 truncate">
                    {confirmDeleteModal.user.email}
                  </p>
                  <div className="mt-1">
                    {getRoleBadge(confirmDeleteModal.user.role)}
                  </div>
                </div>
              </div>

              {/* Huy hiệu số lượng thú cưng sẽ bị xóa đối với chủ nuôi */}
              {confirmDeleteModal.user.role !== ROLES.VET_DOCTOR && (
                <div className="text-right shrink-0">
                  <span className="text-[10px] text-slate-400 block">Thú cưng sở hữu:</span>
                  <span className={`inline-block font-mono font-bold text-xs px-2 py-0.5 rounded-lg border ${
                    targetUserPets.length > 0 
                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' 
                      : 'bg-slate-100 dark:bg-white/10 text-slate-500 border-slate-200 dark:border-white/10'
                  }`}>
                    {targetUserPets.length} hồ sơ
                  </span>
                </div>
              )}
            </div>

            {/* Danh sách chip các thú cưng sẽ bị xóa đối với chủ nuôi */}
            {confirmDeleteModal.user.role !== ROLES.VET_DOCTOR && targetUserPets.length > 0 && (
              <div className="p-3 rounded-2xl bg-rose-500/5 border border-rose-500/20 text-xs mb-3 space-y-1.5">
                <div className="flex items-center justify-between font-bold text-rose-700 dark:text-rose-300 text-[11px]">
                  <span>🐾 {targetUserPets.length} thú cưng sẽ bị xóa đồng thời:</span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {targetUserPets.map(p => (
                    <span 
                      key={p.id} 
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white dark:bg-[#1a1b2b] text-slate-800 dark:text-slate-200 text-[11px] font-semibold border border-rose-500/20 shadow-xs"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      <span>{p.name}</span>
                      <span className="text-[10px] text-slate-400">({p.breed || p.species || 'Chưa rõ giống'})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Cảnh báo hậu quả xóa an toàn theo vai trò */}
            {confirmDeleteModal.user.role === ROLES.VET_DOCTOR ? (
              <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 text-xs text-cyan-800 dark:text-cyan-200 space-y-1.5 mb-4">
                <p className="font-bold flex items-center gap-1.5 text-cyan-700 dark:text-cyan-300">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-cyan-500" />
                  <span>Xóa tài khoản Bác sĩ thú y (Không xóa thú cưng):</span>
                </p>
                <ul className="list-disc list-inside space-y-1 text-[11px] leading-relaxed pl-1 text-slate-700 dark:text-slate-300">
                  <li>Hệ thống <strong>chỉ thu hồi tài khoản bác sĩ</strong> và hủy các phân công phụ trách lịch khám trong hệ thống.</li>
                  <li><strong>Tuyệt đối KHÔNG xóa hồ sơ thú cưng</strong> hay dữ liệu của các chủ nuôi mà bác sĩ này từng phụ trách.</li>
                  <li>Toàn bộ phiên đăng nhập của bác sĩ này sẽ bị ngắt ngay lập tức.</li>
                </ul>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-700 dark:text-rose-300 space-y-1.5 mb-4">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>Cảnh báo xóa dây chuyền theo chủ sở hữu (Không thể hoàn tác):</span>
                </p>
                <ul className="list-disc list-inside space-y-1 text-[11px] leading-relaxed pl-1">
                  <li>Việc xóa tài khoản sẽ <strong>chấm dứt vĩnh viễn khả năng đăng nhập</strong> của tài khoản này.</li>
                  <li>Hệ thống sẽ <strong>xóa vĩnh viễn {targetUserPets.length} hồ sơ thú cưng</strong> thuộc tài khoản này.</li>
                  <li>Toàn bộ <strong>lịch chăm sóc, chi tiêu, nhật ký, đơn thuốc, thói quen, dữ liệu thất lạc và lịch hẹn</strong> gắn với các thú cưng bị xóa sẽ được dọn sạch.</li>
                  <li><strong>Không xóa hồ sơ của chủ nuôi khác</strong> chỉ vì tài khoản này từng được chia sẻ quyền xem hoặc chăm sóc.</li>
                  <li>Toàn bộ phiên đăng nhập hiện tại sẽ bị thu hồi ngay lập tức.</li>
                </ul>
              </div>
            )}

            {deleteError && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmDeleteUserSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Nhập lại email tài khoản (<span className="font-mono text-rose-600 dark:text-rose-400">{confirmDeleteModal.user.email}</span>) để xác nhận: *
                </label>
                <input
                  type="email"
                  required
                  disabled={isDeleteSubmitting}
                  placeholder={confirmDeleteModal.user.email}
                  value={confirmDeleteEmail}
                  onChange={(e) => setConfirmDeleteEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#1c1d2e] border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white font-mono focus:outline-hidden focus:border-rose-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isDeleteSubmitting}
                  onClick={() => setConfirmDeleteModal({ isOpen: false, user: null })}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 text-xs font-bold disabled:opacity-40 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isDeleteSubmitting || confirmDeleteEmail.trim().toLowerCase() !== confirmDeleteModal.user.email.toLowerCase()}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md shadow-rose-500/20 transition-all"
                >
                  {isDeleteSubmitting ? (
                    <span>Đang xóa tài khoản...</span>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Xóa tài khoản</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 1: XEM CHI TIẾT TÀI KHOẢN (KHÔNG HIỂN THỊ MẬT KHẨU)      */}
      {/* ============================================================ */}
      {viewingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#151622] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-500" />
                <span>Chi Tiết Tài Khoản</span>
              </h3>
              <button onClick={() => setViewingUser(null)} className="p-1.5 text-slate-400 hover:text-white rounded-xl">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.06]">
                <img 
                  src={viewingUser.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150"} 
                  alt="" 
                  className="w-14 h-14 rounded-2xl object-cover border border-slate-200 dark:border-white/10"
                />
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">{viewingUser.name}</h4>
                  <p className="text-xs text-slate-400 font-mono">{viewingUser.email}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    {getRoleBadge(viewingUser.role)}
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-white/[0.06]">
                  <span className="text-slate-500 flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> Số điện thoại:</span>
                  <span className="font-semibold">{viewingUser.phone || 'Chưa cập nhật'}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-white/[0.06]">
                  <span className="text-slate-500 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Địa chỉ:</span>
                  <span className="font-semibold">{viewingUser.address || 'Việt Nam'}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-white/[0.06]">
                  <span className="text-slate-500 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Ngày tạo:</span>
                  <span className="font-mono">{formatDate(viewingUser.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-white/[0.06]">
                  <span className="text-slate-500">Trạng thái tài khoản:</span>
                  <span>{viewingUser.isLocked ? '🔴 Đã bị khóa' : '🟢 Đang hoạt động'}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-white/[0.06]">
                  <span className="text-slate-500">Trạng thái đổi mật khẩu:</span>
                  <span>{viewingUser.mustChangePassword ? '⚠️ Chưa đổi mật khẩu lần đầu' : '✅ Đã đổi mật khẩu chính thức'}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setViewingUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-xs font-bold transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: SỬA CÁC TRƯỜNG THÔNG TIN ĐƯỢC PHÉP                     */}
      {/* ============================================================ */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#151622] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-500" />
                <span>Sửa Thông Tin Tài Khoản</span>
              </h3>
              <button onClick={() => setEditingUser(null)} className="p-1.5 text-slate-400 hover:text-white rounded-xl">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-bold mb-1">Email (Cố định, không thể sửa):</label>
                <input 
                  type="text" 
                  value={editingUser.email} 
                  disabled 
                  className="w-full px-3.5 py-2 bg-slate-100 dark:bg-white/[0.04] text-slate-400 border border-slate-200 dark:border-white/10 rounded-xl cursor-not-allowed font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Họ và tên:</label>
                <input 
                  type="text" 
                  required
                  value={editFormData.name} 
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-[#1c1d2e] border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Số điện thoại:</label>
                <input 
                  type="text" 
                  value={editFormData.phone} 
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-[#1c1d2e] border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Địa chỉ:</label>
                <input 
                  type="text" 
                  value={editFormData.address} 
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-[#1c1d2e] border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">URL Ảnh Đại Diện (Avatar):</label>
                <input 
                  type="text" 
                  value={editFormData.avatar} 
                  onChange={(e) => setEditFormData({ ...editFormData, avatar: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-[#1c1d2e] border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              {editingUser.role === ROLES.VET_DOCTOR && (
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Cơ sở / Bệnh viện Thú y công tác:
                  </label>
                  <select
                    value={editFormData.facilityId || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, facilityId: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-[#1c1d2e] border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:border-indigo-500 font-medium"
                  >
                    <option value="">-- Chưa gán cơ sở công tác (Bác sĩ tự do) --</option>
                    {VET_FACILITIES.map(fac => (
                      <option key={fac.id} value={fac.id}>
                        {fac.name} ({fac.id})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Bác sĩ chỉ xuất hiện trong form đặt lịch của đúng cơ sở được liên kết tại đây.
                  </p>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 dark:border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 text-xs font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Lưu Thay Đổi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 3: XÁC NHẬN KHÓA / MỞ KHÓA TÀI KHOẢN                     */}
      {/* ============================================================ */}
      {confirmLockModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#151622] rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-100 text-center space-y-4">
            <div className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center ${
              confirmLockModal.user?.isLocked 
                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
            }`}>
              {confirmLockModal.user?.isLocked ? <Unlock className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {confirmLockModal.user?.isLocked ? 'Mở Khóa Tài Khoản?' : 'Xác Nhận Khóa Tài Khoản?'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {confirmLockModal.user?.isLocked 
                  ? `Người dùng "${confirmLockModal.user?.name}" sẽ được phép đăng nhập lại bình thường.`
                  : `Tài khoản "${confirmLockModal.user?.name}" sẽ bị chặn đăng nhập và ngắt phiên ngay lập tức.`
                }
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setConfirmLockModal({ isOpen: false, user: null })}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 text-xs font-bold cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmToggleLock}
                className={`px-4 py-2 rounded-xl text-white text-xs font-bold transition-colors cursor-pointer ${
                  confirmLockModal.user?.isLocked ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {confirmLockModal.user?.isLocked ? 'Mở khóa ngay' : 'Khóa tài khoản'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 4: XÁC NHẬN THAY ĐỔI VAI TRÒ TÀI KHOẢN                   */}
      {/* ============================================================ */}
      {confirmRoleModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#151622] rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-100 space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 mb-3">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Thay Đổi Vai Trò Người Dùng
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Tài khoản: <strong className="text-slate-900 dark:text-white">{confirmRoleModal.user?.name}</strong>
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <label className="block text-slate-600 dark:text-slate-400 font-bold">Chọn vai trò mới:</label>
              <select
                value={confirmRoleModal.targetRole}
                onChange={(e) => setConfirmRoleModal({ ...confirmRoleModal, targetRole: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1c1d2e] border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white"
              >
                <option value={ROLES.PET_OWNER}>Chủ nuôi (Pet Owner)</option>
                <option value={ROLES.VET_DOCTOR}>Bác sĩ thú y (Vet Doctor)</option>
              </select>
              <p className="text-[11px] text-slate-400 italic">
                * Chỉ cho phép luân chuyển vai trò giữa Chủ nuôi và Bác sĩ thú y. Vai trò Quản trị viên hệ thống được bảo vệ nghiêm ngặt.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setConfirmRoleModal({ isOpen: false, user: null, targetRole: '' })}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 text-xs font-bold cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmRoleChange}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
              >
                Xác nhận đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 5: DỌN DẸP HỒ SƠ THÚ CƯNG CỦA TÀI KHOẢN ĐÃ XÓA          */}
      {/* ============================================================ */}
      <OrphanedPetsCleanupModal
        isOpen={isOrphanedModalOpen}
        onClose={() => setIsOrphanedModalOpen(false)}
        onSuccess={(res) => {
          setOrphanedAuditState(auditOrphanedPets());
          showNotice(`Dọn dẹp thành công! ${res.message || ''}`);
          if (onUsersUpdated) onUsersUpdated();
        }}
      />

    </div>
  );
};

export default AdminAccountsView;
