import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserCheck, 
  Stethoscope, 
  Lock, 
  PawPrint, 
  ShieldCheck, 
  AlertTriangle, 
  ArrowUpRight, 
  HardDrive, 
  Activity,
  CheckCircle2,
  Clock,
  KeyRound,
  Shield,
  UserPlus,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { auditOrphanedPets } from '../../services/storageService';
import { OrphanedPetsCleanupModal } from './OrphanedPetsCleanupModal';
import { sound } from '../../services/soundService';

export const AdminOverviewView = ({
  users = [],
  usersLoading = false,
  usersError = null,
  onRetry = null,
  pets = [],
  schedules = [],
  onNavigateTab
}) => {
  const [isOrphanedModalOpen, setIsOrphanedModalOpen] = useState(false);
  const [orphanedAudit, setOrphanedAudit] = useState(() => auditOrphanedPets());

  useEffect(() => {
    const handleCleaned = () => {
      setOrphanedAudit(auditOrphanedPets());
    };
    window.addEventListener('petcare_data_cleaned', handleCleaned);
    return () => window.removeEventListener('petcare_data_cleaned', handleCleaned);
  }, []);

  // Tính toán số liệu trực tiếp từ nguồn tài khoản thực tế (Không viết số liệu cố định)
  const totalAccounts = users.length;
  const ownerCount = users.filter(u => u.role === 'pet_owner').length;
  const vetCount = users.filter(u => u.role === 'vet_doctor').length;
  const adminCount = users.filter(u => u.role === 'system_admin').length;
  const lockedCount = users.filter(u => u.isLocked).length;
  const activeCount = users.filter(u => !u.isLocked).length;
  const pendingPasswordCount = users.filter(u => u.mustChangePassword).length;
  const totalPets = pets.length;

  // Đo lường dung lượng bộ nhớ localStorage hiện tại của ứng dụng
  const getStorageEstimate = () => {
    try {
      let totalBytes = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const val = localStorage.getItem(key);
        totalBytes += (key?.length || 0) + (val?.length || 0);
      }
      const kb = (totalBytes / 1024).toFixed(1);
      return `${kb} KB`;
    } catch {
      return 'N/A';
    }
  };

  // 6 Thẻ Thống Kê Chuẩn Nghiệp Vụ Quản Trị Hệ Thống
  const statCards = [
    {
      title: 'Tổng Tài Khoản',
      value: usersError ? '—' : (usersLoading ? '...' : totalAccounts),
      sub: usersError ? 'Không thể tải từ máy chủ' : `${activeCount} đang hoạt động, gồm cả Admin`,
      icon: Users,
      badge: usersError ? 'Lỗi kết nối' : (usersLoading ? 'Đang tải...' : `${totalAccounts} tài khoản`),
      highlight: Boolean(usersError)
    },
    {
      title: 'Quản Trị Viên (Admin)',
      value: usersError ? '—' : (usersLoading ? '...' : adminCount),
      sub: usersError ? 'Không thể tải từ máy chủ' : 'Quyền vận hành & kiểm soát hệ thống',
      icon: ShieldCheck,
      badge: usersError ? 'Lỗi kết nối' : (usersLoading ? 'Đang tải...' : `${adminCount} quản trị viên`),
      highlight: Boolean(usersError)
    },
    {
      title: 'Bác Sĩ Thú Y (Vet Doctor)',
      value: usersError ? '—' : (usersLoading ? '...' : vetCount),
      sub: usersError ? 'Không thể tải từ máy chủ' : 'Được cấp quyền khám & Clinic OS',
      icon: Stethoscope,
      badge: usersError ? 'Lỗi kết nối' : (usersLoading ? 'Đang tải...' : `${vetCount} bác sĩ`),
      highlight: Boolean(usersError)
    },
    {
      title: 'Chủ Nuôi (Pet Owner)',
      value: usersError ? '—' : (usersLoading ? '...' : ownerCount),
      sub: usersError ? 'Không thể tải từ máy chủ' : `${totalAccounts > 0 ? ((ownerCount / totalAccounts) * 100).toFixed(0) : 0}% tổng người dùng`,
      icon: UserCheck,
      badge: usersError ? 'Lỗi kết nối' : (usersLoading ? 'Đang tải...' : `${ownerCount} chủ nuôi`),
      highlight: Boolean(usersError)
    },
    {
      title: 'Tài Khoản Bị Khóa',
      value: usersError ? '—' : (usersLoading ? '...' : lockedCount),
      sub: usersError ? 'Không thể tải từ máy chủ' : (lockedCount > 0 ? 'Bị chặn đăng nhập & ngắt phiên' : 'Không có tài khoản bị khóa'),
      icon: Lock,
      highlight: usersError ? false : lockedCount > 0,
      badge: usersError ? 'Lỗi kết nối' : (lockedCount > 0 ? 'Cảnh báo bảo mật' : 'An toàn')
    },
    {
      title: 'Hồ Sơ Thú Cưng',
      value: totalPets,
      sub: orphanedAudit.confirmedDeletedOwnerPets.length > 0 
        ? `⚠️ Có ${orphanedAudit.confirmedDeletedOwnerPets.length} hồ sơ tài khoản đã xóa cần dọn` 
        : (totalPets === 0 ? 'Hiện chưa có hồ sơ thú cưng' : `${totalPets} thú cưng đang hoạt động`),
      icon: PawPrint,
      highlight: orphanedAudit.confirmedDeletedOwnerPets.length > 0,
      badge: `${totalPets} thú cưng`
    }
  ];

  const recentUsers = users.slice(0, 5);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-indigo-900/40 via-[#151622] to-violet-900/30 border border-indigo-500/20 backdrop-blur-2xl shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-400/30 text-indigo-400 text-xs font-bold mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Phân Hệ Quản Trị Hệ Thống (System Admin)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Trung Tâm Điều Hành & Giám Sát PET_Ai
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Theo dõi số liệu thời gian thực, cấp tài khoản cho chủ nuôi & bác sĩ thú y, đặt lại mật khẩu tạm thời và kiểm soát an ninh hệ sinh thái.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                sound?.playClick?.();
                onNavigateTab('accounts');
              }}
              className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-500/25 flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              <span>Tạo & Quản Lý Tài Khoản</span>
            </button>
            <button
              onClick={() => {
                sound?.playClick?.();
                onNavigateTab('backup');
              }}
              className="px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-white/[0.08] hover:bg-slate-200 dark:hover:bg-white/[0.12] text-slate-800 dark:text-white text-xs font-bold transition-all border border-slate-200/80 dark:border-white/10 flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <HardDrive className="w-4 h-4 text-indigo-500" />
              <span>Sao Lưu Hệ Thống</span>
            </button>
          </div>
        </div>

        {/* Ambient background decoration */}
        <div className="absolute right-0 top-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Banner Lỗi tải dữ liệu tài khoản kèm nút Thử lại */}
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
                {usersError}. Số liệu hiển thị có thể chưa đầy đủ hoặc không phản ánh đúng cơ sở dữ liệu. Vui lòng bấm "Thử lại" để tải lại.
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

      {/* Banner Cảnh báo Dọn Dẹp Dữ Liệu Tồn Đọng của Tài Khoản Đã Xóa */}
      {orphanedAudit.confirmedDeletedOwnerPets.length > 0 && (
        <div className="p-4 sm:p-5 rounded-3xl bg-rose-500/10 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in duration-200 shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Phát hiện dữ liệu tồn đọng từ các tài khoản đã xóa</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-500/20 text-rose-600 dark:text-rose-300">
                  {orphanedAudit.confirmedDeletedOwnerPets.length} hồ sơ
                </span>
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Hệ thống kiểm định phát hiện {orphanedAudit.confirmedDeletedOwnerPets.length} hồ sơ thú cưng thuộc các tài khoản chủ nuôi đã bị xóa trước đó. Cần thực hiện dọn dẹp để đưa danh sách và bộ đếm thống kê về chính xác 0 hồ sơ khi không còn tài khoản chủ nuôi nào tồn tại.
              </p>
            </div>
          </div>

          <button
            type="button"
            id="btn-admin-overview-cleanup"
            onClick={() => {
              sound?.playClick?.();
              setIsOrphanedModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-bold transition-all shadow-lg shadow-rose-500/25 flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <Trash2 className="w-4 h-4" />
            <span>Dọn dữ liệu của tài khoản đã xóa</span>
          </button>
        </div>
      )}

      {/* Grid 6 Thẻ Thống Kê Thời Gian Thực Khớp Thực Tế */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div 
              key={idx}
              className={`p-5 rounded-3xl bg-white dark:bg-slate-900/80 border transition-all duration-300 shadow-sm text-[#1E293B] dark:text-slate-100 ${
                card.highlight 
                  ? 'border-rose-300 dark:border-rose-400/60 bg-rose-50/50 dark:bg-rose-500/10' 
                  : 'border-[#E2E8F0] dark:border-white/10 hover:border-indigo-300 dark:hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-white/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-white/20 flex items-center justify-center shadow-xs">
                  <Icon className="w-5 h-5" />
                </div>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                  card.highlight
                    ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-200 border-rose-200 dark:border-rose-400/30'
                    : 'bg-slate-100 dark:bg-white/10 text-[#475569] dark:text-slate-300 border-[#E2E8F0] dark:border-white/10'
                }`}>
                  {card.badge}
                </span>
              </div>

              <div className="mt-1">
                <p className="text-xs font-semibold text-[#475569] dark:text-slate-400 uppercase tracking-wider">
                  {card.title}
                </p>
                <div className="text-3xl font-extrabold text-[#0F172A] dark:text-white mt-1">
                  {card.value}
                </div>
                <p className="text-xs text-[#475569] dark:text-slate-400 mt-1 flex items-center gap-1">
                  <span>{card.sub}</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Row 2: Danh sách tài khoản gần đây & Sức khỏe hệ thống */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Bảng tổng quan danh sách tài khoản được cấp */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-[#E2E8F0] dark:border-white/10 shadow-sm text-[#1E293B] dark:text-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-white/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-white/20 flex items-center justify-center shadow-xs">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">
                  Tài Khoản Trong Hệ Thống ({users.length} tài khoản)
                </h3>
                <p className="text-xs text-[#475569] dark:text-slate-400">
                  Cơ chế cấp tài khoản tập trung bởi Quản trị viên, không đăng ký tự do
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                sound?.playClick?.();
                onNavigateTab('accounts');
              }}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Xem chi tiết</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {recentUsers.map(u => (
              <div 
                key={u.id}
                className="p-3.5 rounded-2xl bg-[#F8FAFC] dark:bg-white/5 border border-[#E2E8F0] dark:border-white/10 hover:border-indigo-300 dark:hover:border-white/20 flex items-center justify-between gap-3 transition-all duration-300"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img 
                    src={u.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150"} 
                    alt="" 
                    className="w-9 h-9 rounded-full object-cover border border-[#E2E8F0] dark:border-white/20 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#0F172A] dark:text-white truncate">
                      {u.name}
                    </p>
                    <p className="text-[11px] text-[#475569] dark:text-slate-400 truncate font-mono">
                      {u.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {u.role === 'system_admin' ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-400/30">
                      Quản trị viên
                    </span>
                  ) : u.role === 'vet_doctor' ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-200 border border-cyan-200 dark:border-cyan-400/30">
                      Bác sĩ thú y
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-400/30">
                      Chủ nuôi
                    </span>
                  )}

                  {u.isLocked ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-200 border border-rose-200 dark:border-rose-400/30">
                      Khóa
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-400/30">
                      Hoạt động
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Thông số Tài nguyên & Bảo Mật */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-[#E2E8F0] dark:border-white/10 shadow-sm text-[#1E293B] dark:text-slate-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-500/20 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">
                  Cơ Chế Quản Lý & Bảo Mật
                </h3>
                <p className="text-xs text-[#475569] dark:text-slate-400">Trạng thái xác thực tập trung</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-2xl bg-[#F8FAFC] dark:bg-white/[0.03] border border-[#E2E8F0] dark:border-white/[0.06] flex items-center justify-between">
                <span className="text-xs text-[#475569] dark:text-slate-400">Cơ chế tài khoản:</span>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Admin cấp phát</span>
              </div>

              <div className="p-3 rounded-2xl bg-[#F8FAFC] dark:bg-white/[0.03] border border-[#E2E8F0] dark:border-white/[0.06] flex items-center justify-between">
                <span className="text-xs text-[#475569] dark:text-slate-400">Bảo mật mật khẩu:</span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">PBKDF2 SHA-512</span>
              </div>

              <div className="p-3 rounded-2xl bg-[#F8FAFC] dark:bg-white/[0.03] border border-[#E2E8F0] dark:border-white/[0.06] flex items-center justify-between">
                <span className="text-xs text-[#475569] dark:text-slate-400">Tài khoản chưa đổi MK lần đầu:</span>
                <span className="text-xs font-mono font-bold text-amber-500">{pendingPasswordCount}</span>
              </div>

              <div className="p-3 rounded-2xl bg-[#F8FAFC] dark:bg-white/[0.03] border border-[#E2E8F0] dark:border-white/[0.06] flex items-center justify-between">
                <span className="text-xs text-[#475569] dark:text-slate-400">Lưu lượng Web Storage:</span>
                <span className="text-xs font-mono font-bold text-[#0F172A] dark:text-white">{getStorageEstimate()}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#E2E8F0] dark:border-white/[0.06]">
            <p className="text-[11px] text-[#475569] dark:text-slate-400 leading-normal flex items-start gap-1.5">
              <Shield className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <span>Chức năng tự đăng ký công khai đã bị khóa hoàn toàn. Toàn bộ tài khoản chủ nuôi và bác sĩ thú y do Admin tạo và cấp phát qua mục Quản lý tài khoản.</span>
            </p>
          </div>
        </div>

      </div>

      {/* Modal Dọn Dẹp Dữ Liệu Tồn Đọng Của Tài Khoản Đã Xóa */}
      <OrphanedPetsCleanupModal
        isOpen={isOrphanedModalOpen}
        onClose={() => setIsOrphanedModalOpen(false)}
        onSuccess={() => {
          setOrphanedAudit(auditOrphanedPets());
        }}
      />

    </div>
  );
};

export default AdminOverviewView;
