import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { config, JWT_SECRET } from './config.js';
import { 
  getUsers, 
  findUserByEmail, 
  findUserById, 
  findUser,
  createUser, 
  updateUser, 
  deleteUser,
  getDeletedUsers,
  getTokens,
  saveTokens,
  createResetToken, 
  verifyResetToken, 
  consumeResetTokenAndSetPassword,
  verifyPassword,
  hashPassword
} from './db.js';
import { sendPasswordResetEmail } from './mailer.js';
import { checkForgotPasswordRateLimit, recordForgotPasswordAttempt } from './rateLimiter.js';
import apiRouter, { authenticateToken } from './api.js';
import backupRouter from './backupHandler.js';
import { startEmbeddingModelWatcher } from './ragService.js';
import jwt from 'jsonwebtoken';
import { VET_FACILITIES } from '../src/constants/clinicFacilities.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Thư mục lưu trữ tệp tải lên (ảnh đại diện thú cưng thật)
const uploadsDir = path.join(process.cwd(), 'server', 'uploads');
const avatarsDir = path.join(uploadsDir, 'avatars');
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}
app.use('/api/uploads', express.static(uploadsDir));

// Middleware xác thực quyền Quản trị viên hệ thống (system_admin) từ JWT Token thật
const requireAdmin = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (!req.user || req.user.role !== 'system_admin' || req.user.isLocked) {
      return res.status(403).json({
        success: false,
        error: 'Truy cập bị từ chối: Yêu cầu quyền Quản trị viên hệ thống (system_admin).',
        code: 'FORBIDDEN_ADMIN_REQUIRED'
      });
    }
    next();
  });
};

app.use('/api/data', apiRouter);
app.use('/api/chat', (req, res, next) => {
  req.url = '/chat' + req.url;
  apiRouter(req, res, next);
});
app.use('/api/admin/rag', (req, res, next) => {
  req.url = '/admin/rag' + req.url;
  apiRouter(req, res, next);
});
app.use('/api/ai', (req, res, next) => {
  req.url = '/ai' + req.url;
  apiRouter(req, res, next);
});
app.use('/api/backup', requireAdmin, backupRouter);

// Helper lấy IP client
const getClientIp = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
         req.socket?.remoteAddress || 
         '127.0.0.1';
};

// ============================================================================
// HỆ THỐNG NHẬT KÝ KIỂM TOÁN (AUDIT LOGS) QUẢN TRỊ VIÊN
// ============================================================================
const AUDIT_LOG_FILE = path.join(process.cwd(), process.env.PETCARE_DATA_DIR || 'server/data', 'audit_logs.json');

const getAuditLogs = () => {
  try {
    if (!fs.existsSync(AUDIT_LOG_FILE)) return [];
    return JSON.parse(fs.readFileSync(AUDIT_LOG_FILE, 'utf8'));
  } catch {
    return [];
  }
};

const saveAuditLogs = (logs) => {
  try {
    fs.writeFileSync(AUDIT_LOG_FILE, JSON.stringify(logs, null, 2), 'utf8');
  } catch (err) {
    console.error('Lỗi lưu audit logs:', err);
  }
};

const recordAuditLog = ({ action, actor, targetType, targetId, details, result = 'SUCCESS' }) => {
  const logs = getAuditLogs();
  const entry = {
    id: `AUDIT-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    timestamp: new Date().toISOString(),
    action,
    actorId: actor?.id || 'system',
    actorName: actor?.name || 'Hệ thống',
    actorEmail: actor?.email || 'system@petcare.ai',
    targetType,
    targetId,
    details: details || '',
    result
  };
  logs.unshift(entry);
  if (logs.length > 500) logs.length = 500;
  saveAuditLogs(logs);
  return entry;
};

// GET /api/admin/audit-logs
app.get('/api/admin/audit-logs', requireAdmin, (req, res) => {
  const logs = getAuditLogs();
  res.json({ success: true, data: logs });
});

// GET /api/admin/docs
app.get('/api/admin/docs', requireAdmin, (req, res) => {
  try {
    const docsDir = path.join(process.cwd(), 'server', 'data', 'docs');
    if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
    const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.md') || f.endsWith('.txt'));
    const docList = files.map(filename => {
      const filePath = path.join(docsDir, filename);
      const stat = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      return {
        filename,
        size: stat.size,
        updatedAt: stat.mtime.toISOString(),
        version: '1.0',
        title: content.split('\n')[0].replace(/^#+\s*/, '') || filename,
        content
      };
    });
    res.json({ success: true, data: docList });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/admin/docs
app.post('/api/admin/docs', requireAdmin, (req, res) => {
  try {
    const { filename, content } = req.body;
    if (!filename || !content) {
      return res.status(400).json({ success: false, error: 'Tên file và nội dung tài liệu không được để trống.' });
    }
    const cleanFilename = filename.endsWith('.md') || filename.endsWith('.txt') ? filename : `${filename}.md`;
    const docsDir = path.join(process.cwd(), 'server', 'data', 'docs');
    if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
    const filePath = path.join(docsDir, cleanFilename);
    fs.writeFileSync(filePath, content, 'utf8');

    recordAuditLog({
      action: 'DOC_UPDATE',
      actor: req.user,
      targetType: 'AI_DOC',
      targetId: cleanFilename,
      details: `Cập nhật tài liệu tri thức AI: ${cleanFilename}`
    });

    res.json({ success: true, message: 'Lưu tài liệu thành công', filename: cleanFilename });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/admin/docs/:filename
app.delete('/api/admin/docs/:filename', requireAdmin, (req, res) => {
  try {
    const { filename } = req.params;
    if (filename === 'README.md') {
      return res.status(400).json({ success: false, error: 'Không thể xóa tệp README hệ thống.' });
    }
    const filePath = path.join(process.cwd(), 'server', 'data', 'docs', filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      recordAuditLog({
        action: 'DOC_DELETE',
        actor: req.user,
        targetType: 'AI_DOC',
        targetId: filename,
        details: `Xóa tài liệu tri thức AI: ${filename}`
      });
      return res.json({ success: true, message: `Đã xóa tài liệu ${filename}` });
    }
    res.status(404).json({ success: false, error: 'Không tìm thấy tài liệu.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------------------------------
// 1. HEALTH CHECK
// ----------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'PetCare PRO AI Auth & Recovery Service'
  });
});

// ----------------------------------------------------------------------------
// 2. YÊU CẦU KHÔI PHỤC MẬT KHẨU (FORGOT PASSWORD)
// - Kiểm tra định dạng email
// - Giới hạn tần suất (Rate limit) theo IP và Email
// - Tạo token ngẫu nhiên an toàn, lưu bản băm SHA-256 (hết hạn 15 phút)
// - Gửi email thực tế với liên kết đặt lại
// - Thông báo chung trung tính: Không tiết lộ sự tồn tại của email
// - Không báo thành công nếu dịch vụ gửi email bị lỗi
// ----------------------------------------------------------------------------
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const clientIp = getClientIp(req);

    // 1. Kiểm tra định dạng email
    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp địa chỉ email.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Địa chỉ email không đúng định dạng (ví dụ: name@example.com).'
      });
    }

    // 2. Kiểm tra giới hạn tần suất
    const rateCheck = checkForgotPasswordRateLimit(clientIp, cleanEmail);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: rateCheck.message,
        retryAfter: rateCheck.retryAfter
      });
    }

    // 3. Tìm tài khoản trong kho người dùng thống nhất
    const user = findUserByEmail(cleanEmail);

    // Ghi nhận lượt yêu cầu để tính toán cooldown
    recordForgotPasswordAttempt(clientIp, cleanEmail);

    // Nếu email tồn tại và không bị khóa -> Tạo token và gửi email thật
    if (user && !user.isLocked) {
      const { rawToken } = createResetToken(user.id, user.email);
      const resetUrl = `${config.APP_URL}/reset-password?token=${rawToken}`;

      // Gửi email thực tế qua mailer
      await sendPasswordResetEmail(user.email, resetUrl, user.name);
    } else if (user && user.isLocked) {
      // Tài khoản bị khóa: không gửi email khôi phục vì tài khoản bị cấm truy cập
      console.warn(`[Forgot Password] Bỏ qua gửi email cho tài khoản đang bị khóa: ${cleanEmail}`);
    } else {
      // Email chưa từng đăng ký: Không tiết lộ ra bên ngoài
      console.log(`[Forgot Password] Yêu cầu cho email chưa đăng ký: ${cleanEmail}`);
    }

    // Luôn trả về thông báo chung trung tính để bảo mật danh tính người dùng
    return res.json({
      success: true,
      message: 'Nếu email này đã được đăng ký trong hệ sinh thái PetCare, bạn sẽ nhận được liên kết đặt lại mật khẩu trong hộp thư đến (vui lòng kiểm tra cả thư mục Spam/Rác).'
    });

  } catch (error) {
    console.error('Lỗi trong luồng forgot-password:', error);
    // Bắt buộc báo lỗi khi dịch vụ email thất bại - Không báo thành công giả
    return res.status(500).json({
      success: false,
      error: error.message || 'Đã xảy ra lỗi khi gửi thư khôi phục mật khẩu. Vui lòng thử lại sau.'
    });
  }
});

// ----------------------------------------------------------------------------
// 3. XÁC MINH TOKEN KHÔI PHỤC (VERIFY RESET TOKEN)
// ----------------------------------------------------------------------------
app.get('/api/auth/verify-reset-token', (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({
        valid: false,
        reason: 'missing_token',
        error: 'Thiếu mã token khôi phục.'
      });
    }

    const verification = verifyResetToken(String(token));
    if (!verification.valid) {
      return res.status(400).json({
        valid: false,
        reason: verification.reason,
        error: verification.message
      });
    }

    return res.json({
      valid: true,
      user: {
        email: verification.user.email,
        name: verification.user.name
      }
    });
  } catch (error) {
    return res.status(500).json({
      valid: false,
      error: error.message || 'Lỗi hệ thống khi xác minh liên kết khôi phục.'
    });
  }
});

// ----------------------------------------------------------------------------
// 4. ĐẶT LẠI MẬT KHẨU MỚI (RESET PASSWORD)
// - Kiểm tra mật khẩu khớp và độ dài >= 6
// - Kiểm tra token hợp lệ và chưa dùng
// - Băm mật khẩu mới tại backend (PBKDF2)
// - Cập nhật nguyên tử, đánh dấu token đã dùng
// - Cập nhật passwordChangedAt để vô hiệu hóa các phiên cũ
// - Không tự động mở khóa tài khoản, không đổi vai trò
// ----------------------------------------------------------------------------
app.post('/api/auth/reset-password', (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Mã token khôi phục không hợp lệ.'
      });
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Mật khẩu mới phải chứa ít nhất 6 ký tự.'
      });
    }

    // Tiêu thụ token và cập nhật mật khẩu mới
    const updatedUser = consumeResetTokenAndSetPassword(token, newPassword);

    return res.json({
      success: true,
      message: 'Mật khẩu đã được đặt lại thành công. Bạn có thể đăng nhập bằng mật khẩu mới.',
      userId: updatedUser.id
    });
  } catch (error) {
    console.error('Lỗi khi reset-password:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Không thể đặt lại mật khẩu.'
    });
  }
});

// ----------------------------------------------------------------------------
// 5. ĐĂNG NHẬP (LOGIN)
// - Xác thực mật khẩu băm tại backend
// - Chặn tài khoản bị khóa
// - Trả về người dùng an toàn (ẩn password)
// ----------------------------------------------------------------------------
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp đầy đủ email và mật khẩu.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = findUserByEmail(cleanEmail);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Tài khoản email này chưa được đăng ký trong hệ thống.'
      });
    }

    if (user.isLocked) {
      return res.status(403).json({
        success: false,
        error: 'Tài khoản này đã bị khóa bởi Quản trị viên hệ thống. Vui lòng liên hệ hỗ trợ để biết thêm chi tiết.'
      });
    }

    if (!verifyPassword(password, user.password)) {
      return res.status(401).json({
        success: false,
        error: 'Mật khẩu không chính xác. Vui lòng kiểm tra lại!'
      });
    }

    const safeUser = { ...user };
    delete safeUser.password;

    const token = jwt.sign({ id: user.id, pwdChangedAt: user.passwordChangedAt || null }, JWT_SECRET, { expiresIn: '7d' });

    return res.json({
      success: true,
      user: safeUser,
      token,
      authTime: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Lỗi máy chủ khi đăng nhập.'
    });
  }
});

// ----------------------------------------------------------------------------
// 6. ĐĂNG KÝ (REGISTER) - ĐÃ BỊ VÔ HIỆU HÓA HOÀN TOÀN
// Hệ thống chuyển sang cơ chế tài khoản do Quản trị viên cấp
// ----------------------------------------------------------------------------
app.post('/api/auth/register', (req, res) => {
  return res.status(403).json({
    success: false,
    error: 'Chức năng tự đăng ký đã bị tắt. Tài khoản do Quản trị viên cấp. Vui lòng liên hệ quản trị viên để được hỗ trợ.'
  });
});

// ----------------------------------------------------------------------------
// 6.1. QUẢN TRỊ VIÊN TẠO TÀI KHOẢN MỚI (ADMIN CREATE USER)
// - Xác thực quyền system_admin của caller
// - Kiểm tra tính hợp lệ và duy nhất của email
// - Mật khẩu tạm thời được băm bằng PBKDF2 SHA-512
// - Đặt mustChangePassword: true
// - Bác sĩ do admin tạo được cấp quyền ngay lập tức (approved)
// ----------------------------------------------------------------------------
app.post('/api/auth/admin/create-user', requireAdmin, (req, res) => {
  try {
    const { name, email, phone, role, password, isLocked } = req.body;
    const caller = req.user;

    // 1. Kiểm tra dữ liệu bắt buộc
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập Họ và tên.' });
    }

    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập Email đăng nhập.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ success: false, error: 'Địa chỉ email không đúng định dạng.' });
    }

    if (findUserByEmail(cleanEmail)) {
      return res.status(400).json({ success: false, error: 'Địa chỉ email này đã tồn tại trong hệ thống.' });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ success: false, error: 'Mật khẩu tạm thời phải từ 6 ký tự trở lên.' });
    }

    if (role !== 'pet_owner' && role !== 'vet_doctor') {
      return res.status(400).json({ success: false, error: 'Vai trò không hợp lệ. Chỉ được chọn Chủ nuôi hoặc Bác sĩ thú y.' });
    }

    // 2. Tạo tài khoản trong cơ sở dữ liệu chung
    const newUser = createUser({
      name: name.trim(),
      email: cleanEmail,
      password,
      phone: phone ? phone.trim() : '',
      role,
      isLocked: Boolean(isLocked),
      vetStatus: role === 'vet_doctor' ? 'approved' : null,
      mustChangePassword: true
    });

    const safeUser = { ...newUser };
    delete safeUser.password;

    recordAuditLog({
      action: 'USER_CREATE',
      actor: caller,
      targetType: 'USER',
      targetId: newUser.id,
      details: `Tạo tài khoản mới: ${newUser.name} (${newUser.email}), vai trò: ${newUser.role}`
    });

    return res.json({
      success: true,
      message: 'Tạo tài khoản thành công.',
      user: safeUser
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ----------------------------------------------------------------------------
// 6.2. QUẢN TRỊ VIÊN ĐẶT LẠI MẬT KHẨU TẠM THỜI (ADMIN RESET PASSWORD)
// - Xác thực quyền system_admin của caller từ Token
// - Cập nhật mật khẩu tạm thời mới (băm PBKDF2)
// - Bật mustChangePassword: true
// - Cập nhật passwordChangedAt để vô hiệu hóa tất cả các phiên đăng nhập cũ
// ----------------------------------------------------------------------------
app.post('/api/auth/admin/reset-password', requireAdmin, (req, res) => {
  try {
    const { targetUserId, targetEmail, newTemporaryPassword } = req.body;
    const caller = req.user;

    // Tìm kiếm bằng ID hoặc Email fallback
    const target = findUser(targetUserId, targetEmail);
    if (!target) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản người dùng hoặc tài khoản đã bị xóa.' });
    }

    if (!newTemporaryPassword || newTemporaryPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Mật khẩu tạm thời phải từ 6 ký tự trở lên.' });
    }

    const nowStr = new Date().toISOString();
    const updated = updateUser(target.id, {
      password: hashPassword(newTemporaryPassword),
      mustChangePassword: true,
      passwordChangedAt: nowStr
    });

    // Vô hiệu hóa tất cả các reset token cũ chưa dùng của tài khoản này
    const tokens = getTokens();
    let tokensChanged = false;
    tokens.forEach(t => {
      if ((String(t.userId).trim() === String(target.id).trim() || (t.userEmail || '').toLowerCase() === target.email.toLowerCase()) && !t.used) {
        t.used = true;
        t.invalidatedReason = 'admin_reset_password';
        tokensChanged = true;
      }
    });
    if (tokensChanged) saveTokens(tokens);

    const safeUser = { ...updated };
    delete safeUser.password;

    recordAuditLog({
      action: 'USER_RESET_PASSWORD',
      actor: caller,
      targetType: 'USER',
      targetId: target.id,
      details: `Đặt lại mật khẩu tạm thời cho tài khoản: ${target.name} (${target.email})`
    });

    return res.json({
      success: true,
      message: `Đã đặt lại mật khẩu tạm thời cho tài khoản ${target.name}.`,
      user: safeUser
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ----------------------------------------------------------------------------
// 6.2.1. QUẢN TRỊ VIÊN XÓA TÀI KHOẢN (ADMIN DELETE USER)
// - Chỉ quản trị viên hệ thống (system_admin) có quyền thực hiện
// - Chặn tự xóa chính tài khoản admin đang đăng nhập
// - Chặn xóa quản trị viên hệ thống hoạt động cuối cùng
// - Yêu cầu xác nhận đúng email của tài khoản
// - Thu hồi phiên và token khôi phục
// ----------------------------------------------------------------------------
app.post('/api/auth/admin/delete-user', requireAdmin, (req, res) => {
  try {
    const { targetUserId, targetEmail, confirmEmail } = req.body;
    const caller = req.user;

    // 1. Tìm tài khoản cần xóa
    const target = findUser(targetUserId, targetEmail);
    if (!target) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy tài khoản người dùng hoặc tài khoản đã bị xóa.'
      });
    }

    // 2. Chặn tự xóa tài khoản admin đang đăng nhập
    if (String(caller.id).trim() === String(target.id).trim() || 
        caller.email.trim().toLowerCase() === target.email.trim().toLowerCase()) {
      return res.status(400).json({
        success: false,
        error: 'Không thể tự xóa tài khoản quản trị viên đang đăng nhập.'
      });
    }

    // 3. Chặn xóa admin hoạt động cuối cùng
    const allUsers = getUsers();
    if (target.role === 'system_admin') {
      const activeAdmins = allUsers.filter(u => u.role === 'system_admin' && !u.isLocked);
      if (activeAdmins.length <= 1) {
        return res.status(400).json({
          success: false,
          error: 'Không thể xóa quản trị viên hệ thống hoạt động cuối cùng.'
        });
      }
    }

    // 4. Kiểm tra email xác nhận
    if (!confirmEmail || confirmEmail.trim().toLowerCase() !== target.email.trim().toLowerCase()) {
      return res.status(400).json({
        success: false,
        error: 'Email xác nhận không trùng khớp với email của tài khoản cần xóa.'
      });
    }

    // 5. Thực hiện xóa an toàn
    const deleted = deleteUser(target.id, target.email);

    recordAuditLog({
      action: 'USER_DELETE',
      actor: caller,
      targetType: 'USER',
      targetId: deleted.id,
      details: `Xóa tài khoản: ${deleted.name} (${deleted.email}), vai trò: ${target.role}`
    });

    return res.json({
      success: true,
      message: `Đã xóa tài khoản ${deleted.name} (${deleted.email}) thành công.`,
      deletedUser: {
        id: deleted.id,
        email: deleted.email,
        name: deleted.name
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ----------------------------------------------------------------------------
// 6.3. ĐỔI MẬT KHẨU BẮT BUỘC Ở LẦN ĐĂNG NHẬP ĐẦU TIÊN (FIRST LOGIN CHANGE PASSWORD)
// - Người dùng cập nhật mật khẩu mới thay thế mật khẩu tạm thời
// - Bắt buộc xác thực từ Token của chính người dùng đó
// - Đặt mustChangePassword: false
// - Cấp token mới cho phiên tiếp theo
// ----------------------------------------------------------------------------
app.post('/api/auth/first-login-change-password', authenticateToken, (req, res) => {
  try {
    const { newPassword } = req.body;
    const userId = req.user.id;

    // Chặn người dùng đổi mật khẩu của tài khoản khác
    if (req.body.userId && String(req.body.userId).trim() !== String(userId).trim()) {
      return res.status(403).json({
        success: false,
        error: 'Bảo mật: Không được phép đổi mật khẩu cho tài khoản người dùng khác!'
      });
    }

    const user = findUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản người dùng.' });
    }

    // Chỉ cho phép dùng endpoint này khi tài khoản thật sự có mustChangePassword=true
    if (!user.mustChangePassword) {
      return res.status(400).json({
        success: false,
        error: 'Tài khoản không ở trạng thái yêu cầu đổi mật khẩu lần đầu. Vui lòng sử dụng tính năng Đổi mật khẩu thông thường kèm mật khẩu hiện tại.'
      });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Mật khẩu mới phải từ 6 ký tự trở lên.' });
    }

    const nowStr = new Date().toISOString();
    const updated = updateUser(userId, {
      password: hashPassword(newPassword),
      mustChangePassword: false,
      passwordChangedAt: nowStr
    });

    const safeUser = { ...updated };
    delete safeUser.password;

    const token = jwt.sign({ id: user.id, pwdChangedAt: updated.passwordChangedAt }, JWT_SECRET, { expiresIn: '7d' });

    return res.json({
      success: true,
      message: 'Mật khẩu đã được cập nhật thành công.',
      user: safeUser,
      token
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ----------------------------------------------------------------------------
// 6.4. CẬP NHẬT THÔNG TIN CÁ NHÂN (UPDATE PROFILE)
// - Xác thực Token hợp lệ của chính người dùng
// - Lưu bền vững trên cơ sở dữ liệu Server
// - Không cho phép đổi email, role hoặc password qua endpoint này
// ----------------------------------------------------------------------------
app.put('/api/auth/profile', authenticateToken, (req, res) => {
  try {
    const { name, phone, address, avatar } = req.body;
    const userId = req.user.id;
    const user = findUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản người dùng.' });
    }

    const updates = {};
    if (typeof name === 'string' && name.trim()) updates.name = name.trim();
    if (typeof phone === 'string') updates.phone = phone.trim();
    if (typeof address === 'string') updates.address = address.trim();
    if (typeof avatar === 'string') updates.avatar = avatar.trim();

    const updated = updateUser(userId, updates);
    const safeUser = { ...updated };
    delete safeUser.password;

    return res.json({
      success: true,
      message: 'Cập nhật thông tin cá nhân thành công.',
      user: safeUser
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ----------------------------------------------------------------------------
// 7. ĐỔI MẬT KHẨU TỪ PROFILE (CHANGE PASSWORD)
// - Bắt buộc kiểm tra đúng mật khẩu hiện tại
// - Băm mật khẩu mới
// - Cập nhật passwordChangedAt
// - Cấp token mới cho phiên hiện tại trong khi các phiên cũ bị thu hồi
// ----------------------------------------------------------------------------
app.post('/api/auth/change-password', authenticateToken, (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Chặn người dùng đổi mật khẩu của tài khoản khác
    if (req.body.userId && String(req.body.userId).trim() !== String(userId).trim()) {
      return res.status(403).json({
        success: false,
        error: 'Bảo mật: Không được phép đổi mật khẩu cho tài khoản người dùng khác!'
      });
    }

    const user = findUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản.' });
    }

    if (!verifyPassword(currentPassword, user.password)) {
      return res.status(400).json({ success: false, error: 'Mật khẩu hiện tại không chính xác.' });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Mật khẩu mới phải từ 6 ký tự trở lên.' });
    }

    const updated = updateUser(userId, {
      password: hashPassword(newPassword),
      passwordChangedAt: new Date().toISOString()
    });

    const token = jwt.sign({ id: user.id, pwdChangedAt: updated.passwordChangedAt }, JWT_SECRET, { expiresIn: '7d' });

    return res.json({ 
      success: true, 
      message: 'Đổi mật khẩu thành công.',
      token 
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ----------------------------------------------------------------------------
// 8. ĐỒNG BỘ / DANH SÁCH TÀI KHOẢN CHO QUẢN TRỊ VIÊN (ADMIN ENDPOINTS)
// - Bảo vệ nghiêm ngặt: Chỉ system_admin có token hợp lệ mới được truy cập
// ----------------------------------------------------------------------------
app.get('/api/auth/users', requireAdmin, (req, res) => {
  try {
    const users = getUsers();
    const safeUsers = users.map(u => {
      const copy = { ...u };
      delete copy.password;
      return copy;
    });
    return res.json(safeUsers);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------------------------------
// 8.1. DANH SÁCH BÁC SĨ THÚ Y THỰC TẾ (HỖ TRỢ LỌC THEO CƠ SỞ CÔNG TÁC)
// - Dành cho người nuôi đặt lịch & phòng khám phân công ca
// - Chỉ trả về tài khoản vet_doctor đang hoạt động (không bị khóa, đã phê duyệt)
// ----------------------------------------------------------------------------
app.get('/api/doctors', (req, res) => {
  try {
    const { facilityId } = req.query;
    const users = getUsers();
    let doctors = users.filter(u => 
      u.role === 'vet_doctor' && 
      !u.isLocked && 
      (!u.vetStatus || u.vetStatus === 'approved')
    );

    if (facilityId && facilityId !== 'all') {
      doctors = doctors.filter(doc => {
        const facs = Array.isArray(doc.facilityIds) 
          ? doc.facilityIds 
          : (doc.facilityId ? [doc.facilityId] : []);
        return facs.includes(facilityId);
      });
    }

    const safeDoctors = doctors.map(d => ({
      id: d.id,
      name: d.name.startsWith('BS.') ? d.name : `BS. ${d.name}`,
      email: d.email,
      phone: d.phone || '',
      avatar: d.avatar || '',
      role: d.role,
      facilityId: d.facilityId || null,
      facilityIds: Array.isArray(d.facilityIds) ? d.facilityIds : (d.facilityId ? [d.facilityId] : []),
      address: d.address || ''
    }));

    return res.json({ success: true, data: safeDoctors });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ----------------------------------------------------------------------------
// 8.2. QUẢN TRỊ VIÊN CẬP NHẬT HỒ SƠ & CẤU HÌNH CƠ SỞ CHO TÀI KHOẢN
// ----------------------------------------------------------------------------
app.post('/api/auth/users/:id/update', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, address, avatar, facilityId, facilityIds } = req.body;
    const caller = req.user;

    const target = findUserById(id);
    if (!target) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản người dùng.' });
    }

    const updates = {};
    if (typeof name === 'string' && name.trim()) updates.name = name.trim();
    if (typeof phone === 'string') updates.phone = phone.trim();
    if (typeof address === 'string') updates.address = address.trim();
    if (typeof avatar === 'string' && avatar.trim()) updates.avatar = avatar.trim();

    // Cấu hình cơ sở công tác (dành riêng cho bác sĩ thú y)
    if (target.role === 'vet_doctor' && (facilityId !== undefined || facilityIds !== undefined)) {
      const validFacilityIds = VET_FACILITIES.map(f => f.id);
      let assignedId = null;
      let assignedIds = [];

      if (facilityId && facilityId !== 'none' && facilityId !== 'unassigned' && facilityId !== '') {
        if (!validFacilityIds.includes(facilityId)) {
          return res.status(400).json({
            success: false,
            error: `Cơ sở "${facilityId}" không hợp lệ. Danh mục hợp lệ: ${validFacilityIds.join(', ')}`
          });
        }
        assignedId = facilityId;
        assignedIds = [facilityId];
      } else if (Array.isArray(facilityIds)) {
        assignedIds = facilityIds.filter(fid => validFacilityIds.includes(fid));
        assignedId = assignedIds[0] || null;
      }

      updates.facilityId = assignedId;
      updates.facilityIds = assignedIds;
    }

    const updated = updateUser(id, updates);
    const copy = { ...updated };
    delete copy.password;

    recordAuditLog({
      action: 'USER_ADMIN_UPDATE',
      actor: caller,
      targetType: 'USER',
      targetId: id,
      details: `Cập nhật thông tin tài khoản ${target.name} (${target.email})${updates.facilityId !== undefined ? ' - Cơ sở: ' + (updates.facilityId || 'Chưa phân công') : ''}`
    });

    return res.json({ success: true, user: copy });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/auth/deleted-users', requireAdmin, (req, res) => {
  try {
    const list = getDeletedUsers();
    return res.json(list);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/users/:id/toggle-lock', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const caller = req.user;

    // 1. Tìm tài khoản mục tiêu
    const user = findUserById(id);
    if (!user) return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản.' });

    // 2. Chặn tự khóa chính tài khoản admin đang thao tác
    if (String(caller.id).trim() === String(user.id).trim() || 
        caller.email.trim().toLowerCase() === user.email.trim().toLowerCase()) {
      return res.status(400).json({
        success: false,
        error: 'Không thể tự khóa tài khoản quản trị viên đang đăng nhập!'
      });
    }

    // 3. Chặn khóa Quản trị viên hệ thống hoạt động cuối cùng
    if (user.role === 'system_admin' && !user.isLocked) {
      const activeAdmins = getUsers().filter(u => u.role === 'system_admin' && !u.isLocked);
      if (activeAdmins.length <= 1) {
        return res.status(400).json({
          success: false,
          error: 'Không thể khóa Quản trị viên hệ thống hoạt động cuối cùng của hệ thống!'
        });
      }
    }

    const newLocked = !user.isLocked;
    const updates = { isLocked: newLocked };
    // Khi khóa tài khoản, lập tức thu hồi mọi phiên đăng nhập của người dùng đó
    if (newLocked) {
      updates.passwordChangedAt = new Date().toISOString();
    }

    const updated = updateUser(id, updates);
    const copy = { ...updated };
    delete copy.password;

    recordAuditLog({
      action: newLocked ? 'USER_LOCK' : 'USER_UNLOCK',
      actor: caller,
      targetType: 'USER',
      targetId: id,
      details: `${newLocked ? 'Khóa' : 'Mở khóa'} tài khoản: ${user.name} (${user.email})`
    });

    return res.json(copy);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/users/:id/approve-vet', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { isApproved } = req.body;
    const caller = req.user;

    // 1. Tìm tài khoản mục tiêu
    const user = findUserById(id);
    if (!user) return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản.' });
    if (user.role !== 'vet_doctor') {
      return res.status(400).json({ success: false, error: 'Tài khoản này không đăng ký vai trò Bác sĩ thú y.' });
    }

    const updated = updateUser(id, { 
      vetStatus: isApproved ? 'approved' : 'rejected' 
    });
    const copy = { ...updated };
    delete copy.password;

    recordAuditLog({
      action: isApproved ? 'VET_APPROVE' : 'VET_REJECT',
      actor: caller,
      targetType: 'USER',
      targetId: id,
      details: `${isApproved ? 'Duyệt hồ sơ' : 'Từ chối hồ sơ'} bác sĩ: ${user.name} (${user.email})`
    });

    return res.json(copy);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/users/:id/change-role', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const caller = req.user;

    // 1. Chặn leo thang đặc quyền: Tuyệt đối không cho phép gán vai trò system_admin
    if (role === 'system_admin') {
      return res.status(403).json({
        success: false,
        error: 'Bảo mật: Tuyệt đối không được phép thăng quyền lên Quản trị viên hệ thống!'
      });
    }

    // 2. Chỉ cho phép chuyển đổi vai trò giữa pet_owner và vet_doctor
    if (role !== 'pet_owner' && role !== 'vet_doctor') {
      return res.status(400).json({
        success: false,
        error: 'Vai trò không hợp lệ. Chỉ cho phép chuyển đổi giữa Chủ nuôi và Bác sĩ thú y.'
      });
    }

    // 3. Kiểm tra tài khoản mục tiêu
    const target = findUserById(id);
    if (!target) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản người dùng.' });
    }

    // 4. Tuyệt đối không cho phép thay đổi vai trò của Quản trị viên hệ thống
    if (target.role === 'system_admin') {
      return res.status(403).json({
        success: false,
        error: 'Không thể thay đổi vai trò của Quản trị viên hệ thống!'
      });
    }

    const updates = {
      role,
      vetStatus: role === 'vet_doctor' ? 'approved' : null
    };
    const updated = updateUser(id, updates);
    const copy = { ...updated };
    delete copy.password;

    recordAuditLog({
      action: 'USER_CHANGE_ROLE',
      actor: caller,
      targetType: 'USER',
      targetId: id,
      details: `Đổi vai trò tài khoản ${target.name} (${target.email}) thành: ${role}`
    });

    return res.json({ success: true, user: copy });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Khởi chạy server
app.listen(config.PORT, () => {
  console.log(`\n=============================================================`);
  console.log(`🚀 PetCare PRO AI Auth Backend đang chạy tại http://localhost:${config.PORT}`);
  console.log(`🌐 Website Frontend: ${config.APP_URL}`);
  console.log(`📧 Trạng thái SMTP: ${config.SMTP_HOST ? `Đã cấu hình (${config.SMTP_HOST}:${config.SMTP_PORT})` : 'CHƯA CẤU HÌNH (Cần thiết lập trong .env)'}`);
  console.log(`🛠️  Chế độ Dev Console Email: ${config.DEV_MODE_ALLOW_CONSOLE_EMAIL ? 'BẬT' : 'TẮT'}`);
  console.log(`=============================================================\n`);

  // Kích hoạt tiến trình theo dõi mô hình RAG cục bộ
  startEmbeddingModelWatcher();
});
