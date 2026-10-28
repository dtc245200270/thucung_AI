import React, { useState } from 'react';
import { 
  X, User, Mail, Phone, MapPin, Camera, 
  Lock, CheckCircle, AlertCircle, Shield, Key 
} from 'lucide-react';
import { updateProfile, changePassword } from '../../services/authService';
import { sound } from '../../services/soundService';

export function UserProfileModal({ isOpen, onClose, user, currentUser, onUserUpdated, initialTab = 'profile' }) {
  const activeUser = user || currentUser;
  const [activeTab, setActiveTab] = useState(initialTab); // 'profile' | 'password'

  // Profile form state
  const [name, setName] = useState(activeUser?.name || '');
  const [phone, setPhone] = useState(activeUser?.phone || '');
  const [address, setAddress] = useState(activeUser?.address || '');
  const [avatar, setAvatar] = useState(activeUser?.avatar || '');

  // Password form state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [message, setMessage] = useState({ text: '', type: '' }); // type: 'success' | 'error'

  if (!isOpen || !activeUser) return null;

  const sampleAvatars = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=300&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80'
  ];

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });
    try {
      const updated = await updateProfile({ name, phone, address, avatar });
      setMessage({ text: 'Cập nhật thông tin cá nhân thành công!', type: 'success' });
      if (onUserUpdated) onUserUpdated(updated);
    } catch (err) {
      setMessage({ text: err.message || 'Lỗi khi cập nhật', type: 'error' });
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });

    if (newPassword.length < 6) {
      setMessage({ text: 'Mật khẩu mới phải từ 6 ký tự trở lên.', type: 'error' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ text: 'Mật khẩu xác nhận không trùng khớp.', type: 'error' });
      return;
    }

    try {
      await changePassword(oldPassword, newPassword);
      setMessage({ text: 'Đổi mật khẩu thành công!', type: 'success' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setMessage({ text: err.message || 'Lỗi khi đổi mật khẩu', type: 'error' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0B132B] text-slate-100 border border-slate-800/80 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Quản Lý Tài Khoản</h3>
              <p className="text-xs text-slate-400">{activeUser?.email || 'user@petcare.ai'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-800/60 px-6 pt-3 gap-6 text-xs font-bold">
          <button
            onClick={() => { setActiveTab('profile'); setMessage({ text: '', type: '' }); }}
            className={`pb-3 transition-colors relative ${
              activeTab === 'profile'
                ? 'text-emerald-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Thông tin cá nhân</span>
            {activeTab === 'profile' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 rounded-full" />
            )}
          </button>

          <button
            onClick={() => { setActiveTab('password'); setMessage({ text: '', type: '' }); }}
            className={`pb-3 transition-colors relative ${
              activeTab === 'password'
                ? 'text-emerald-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Đổi mật khẩu</span>
            {activeTab === 'password' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 rounded-full" />
            )}
          </button>
        </div>

        {/* Status Alert */}
        {message.text && (
          <div className={`mx-6 mt-4 p-3 rounded-2xl text-xs flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="p-6">
          {activeTab === 'profile' && (
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              {/* Avatar Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">Ảnh đại diện:</label>
                <div className="flex items-center gap-3">
                  <img
                    src={avatar || user.avatar}
                    alt={name}
                    className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-500/50 shadow-md"
                  />
                  <div className="flex items-center gap-2">
                    {sampleAvatars.map((url, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => { setAvatar(url); sound.playClick(); }}
                        className={`w-9 h-9 rounded-xl overflow-hidden border transition-all ${
                          avatar === url ? 'border-emerald-400 ring-2 ring-emerald-400/30 scale-105' : 'border-slate-700 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img src={url} alt="sample" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Họ và tên:</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900/90 text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Số điện thoại:</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900/90 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Khu vực / Tỉnh thành:</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Hà Nội, VN"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900/90 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 active:scale-95"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          )}

          {activeTab === 'password' && (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Mật khẩu hiện tại:</label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900/90 text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Mật khẩu mới (tối thiểu 6 ký tự):</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900/90 text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Xác nhận mật khẩu mới:</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900/90 text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 active:scale-95"
                >
                  Xác nhận đổi mật khẩu
                </button>
              </div>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}

export default UserProfileModal;
