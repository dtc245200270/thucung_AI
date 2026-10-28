import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Search, 
  Filter, 
  RefreshCw, 
  ShieldCheck, 
  AlertTriangle, 
  Lock, 
  Trash2, 
  UserPlus, 
  KeyRound, 
  FileText, 
  Download,
  Calendar,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { sound } from '../../services/soundService';
import { getTodayVnDate } from '../../utils/dateUtils';

export const AdminAuditLogsView = ({ currentAdmin }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  const fetchAuditLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('petcare_token');
      const response = await fetch('/api/admin/audit-logs', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        setLogs(data.data);
      } else {
        throw new Error(data.error || 'Không thể tải nhật ký kiểm toán');
      }
    } catch (err) {
      console.error('Lỗi tải audit logs:', err);
      setError(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const handleRefresh = () => {
    sound?.playClick?.();
    fetchAuditLogs();
  };

  const handleExportJson = () => {
    sound?.playSuccess?.();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `petcare_audit_logs_${getTodayVnDate()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Lọc logs
  const filteredLogs = logs.filter(log => {
    const matchAction = actionFilter === 'ALL' || log.action === actionFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchQuery = !q || (
      (log.actorName || '').toLowerCase().includes(q) ||
      (log.actorEmail || '').toLowerCase().includes(q) ||
      (log.details || '').toLowerCase().includes(q) ||
      (log.targetId || '').toLowerCase().includes(q) ||
      (log.action || '').toLowerCase().includes(q)
    );
    return matchAction && matchQuery;
  });

  const getActionBadge = (action) => {
    switch (action) {
      case 'USER_CREATE':
        return { label: 'Tạo tài khoản', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', icon: UserPlus };
      case 'USER_DELETE':
        return { label: 'Xóa tài khoản', color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20', icon: Trash2 };
      case 'USER_LOCK':
        return { label: 'Khóa tài khoản', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', icon: Lock };
      case 'USER_UNLOCK':
        return { label: 'Mở khóa', color: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20', icon: CheckCircle2 };
      case 'USER_RESET_PASSWORD':
        return { label: 'Đặt lại mật khẩu', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20', icon: KeyRound };
      case 'VET_APPROVE':
        return { label: 'Duyệt bác sĩ', color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20', icon: ShieldCheck };
      case 'VET_REJECT':
        return { label: 'Từ chối bác sĩ', color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20', icon: AlertTriangle };
      case 'DOC_UPDATE':
        return { label: 'Cập nhật tài liệu', color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20', icon: FileText };
      case 'DOC_DELETE':
        return { label: 'Xóa tài liệu', color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20', icon: Trash2 };
      default:
        return { label: action, color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20', icon: Activity };
    }
  };

  const formatVietnamTime = (isoString) => {
    if (!isoString) return 'Chưa cập nhật';
    try {
      const d = new Date(isoString);
      return d.toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header & Quick stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-white/10">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-indigo-500" />
            Nhật Ký Kiểm Toán Hệ Thống (Audit Logs)
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Ghi nhận mọi thao tác nhạy cảm: danh tính người thực hiện, thời gian thực tế, đối tượng tác động và kết quả.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-[#1a1b2e] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-all cursor-pointer shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>

          <button
            onClick={handleExportJson}
            disabled={logs.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất JSON</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white dark:bg-[#151622] p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo người thực hiện, email, chi tiết hoặc ID đối tượng..."
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          >
            <option value="ALL">Tất cả hành động ({logs.length})</option>
            <option value="USER_CREATE">Tạo tài khoản</option>
            <option value="USER_DELETE">Xóa tài khoản</option>
            <option value="USER_LOCK">Khóa tài khoản</option>
            <option value="USER_UNLOCK">Mở khóa</option>
            <option value="USER_RESET_PASSWORD">Đặt lại mật khẩu</option>
            <option value="VET_APPROVE">Duyệt bác sĩ</option>
            <option value="DOC_UPDATE">Cập nhật tài liệu AI</option>
            <option value="DOC_DELETE">Xóa tài liệu AI</option>
          </select>
        </div>
      </div>

      {/* Table or Empty State */}
      <div className="bg-white dark:bg-[#151622] rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500 dark:text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-3" />
            <p className="text-sm font-medium">Đang tải dữ liệu nhật ký kiểm toán...</p>
          </div>
        ) : error ? (
          <div className="py-16 text-center text-rose-500">
            <AlertTriangle className="w-8 h-8 mx-auto mb-3" />
            <p className="text-sm font-bold">{error}</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-16 text-center text-slate-500 dark:text-slate-400">
            <Clock className="w-8 h-8 mx-auto text-slate-400 mb-3" />
            <p className="text-sm font-bold">Chưa có nhật ký nào phù hợp</p>
            <p className="text-xs text-slate-400 mt-1">Các thao tác của Quản trị viên sẽ được ghi nhận tự động tại đây.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3.5 px-4">Thời Gian (VN)</th>
                  <th className="py-3.5 px-4">Người Thực Hiện</th>
                  <th className="py-3.5 px-4">Hành Động</th>
                  <th className="py-3.5 px-4">Đối Tượng</th>
                  <th className="py-3.5 px-4">Chi Tiết Thao Tác</th>
                  <th className="py-3.5 px-4 text-center">Kết Quả</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06] text-xs">
                {filteredLogs.map(log => {
                  const badge = getActionBadge(log.action);
                  const Icon = badge.icon;
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {formatVietnamTime(log.timestamp)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800 dark:text-slate-200">{log.actorName || 'Hệ thống'}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{log.actorEmail || 'system'}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${badge.color}`}>
                          <Icon className="w-3 h-3" />
                          <span>{badge.label}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-bold text-slate-700 dark:text-slate-300">{log.targetType}:</span> {log.targetId || 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300 max-w-md">
                        {log.details || '—'}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.result === 'SUCCESS' 
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                        }`}>
                          {log.result === 'SUCCESS' ? 'Thành công' : 'Thất bại'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
