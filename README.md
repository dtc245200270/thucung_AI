# PetCare PRO AI - Nền Tảng Chăm Sóc Thú Cưng & Quản Trị Y Tế Thông Minh

Hệ thống quản lý chăm sóc thú cưng toàn diện kết hợp trí tuệ nhân tạo, hồ sơ bệnh án điện tử (SOAP EHR), lịch chăm sóc chuẩn y tế và phân quyền người dùng đa tầng (Quản trị viên hệ thống, Bác sĩ thú y, Chủ nuôi).

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy Nhanh

### 1. Yêu Cầu Môi Trường
- **Node.js**: Phiên bản 18 trở lên (Khuyến nghị Node 20+)
- **NPM**: Đi kèm Node.js

### 2. Cài Đặt Thư Viện
Sử dụng `npm ci` để cài đặt chính xác các phụ thuộc theo `package-lock.json`:
```bash
npm ci
```

### 3. Cấu Hình Biến Môi Trường
Sao chép tệp mẫu `.env.example` thành `.env`:
```bash
cp .env.example .env
```
*(Trên Windows PowerShell: `Copy-Item .env.example .env`)*

### 4. Khởi Chạy Ứng Dụng

Mở 2 cửa sổ terminal:

- **Terminal 1 - Khởi chạy Backend Server (Cổng 5000):**
  ```bash
  npm run server
  ```
  Backend quản lý xác thực JWT, REST API, lưu trữ JSON an toàn và giao dịch dữ liệu đa tệp.

- **Terminal 2 - Khởi chạy Frontend Dev Server (Cổng 5173):**
  ```bash
  npm run dev
  ```
  Truy cập trình duyệt tại: **http://localhost:5173** (Hệ thống đã tự động proxy các yêu cầu `/api` sang Backend cổng 5000).

---

## 🔑 Tài Khoản Thử Nghiệm Mặc Định (Seed Fixtures)

Hệ thống đi kèm bộ tài khoản giả lập chuẩn để kiểm thử phân quyền:

| Vai trò | Email | Mật khẩu mặc định | Ghi chú |
|:---|:---|:---|:---|
| **Quản trị viên (System Admin)** | `admin@petcare.ai` | `Admin@123456` | Toàn quyền quản trị tài khoản, phân quyền, xem nhật ký kiểm toán, sao lưu & phục hồi |
| **Bác sĩ thú y (Vet Doctor)** | `tester@petcare.ai` | `Doctor@123` | Quyền khám bệnh, lập bệnh án SOAP, kê đơn thuốc và quản lý lịch hẹn |
| **Chủ nuôi mẫu (Pet Owner)** | `demo@petcare.ai` | `Owner@123` | Quản lý thú cưng của mình, xem đơn thuốc đã phát hành, đặt lịch khám |

---

## 🧪 Chạy Kiểm Thử Độc Lập (Automated Testing)

Đảm bảo Backend server đang chạy (`npm run server`) trước khi chạy test suites:

- **Chạy toàn bộ 6 bộ kiểm thử tự động:**
  ```bash
  npm test
  ```
- **Chạy nhóm kiểm thử độc lập (8 ca kiểm thử + lỗi ghi đĩa + sync):**
  ```bash
  npm run test:independent
  ```
- **Chạy kiểm thử Mục 1 (Lịch chăm sóc lặp & phân quyền):**
  ```bash
  npm run test:muc1
  ```
- **Chạy kiểm thử Mục 2 (Filesystem rollback & retry):**
  ```bash
  npm run test:muc2
  ```
- **Chạy kiểm thử Mục 3 (Thống nhất đơn thuốc, khóa chốt & dữ liệu cũ):**
  ```bash
  npm run test:muc3
  ```
- **Chạy kiểm thử hồi quy 10 mục:**
  ```bash
  npm run test:regression
  ```

Chi tiết kết quả kiểm định mới nhất xem tại: [`TEST_REPORT.md`](./TEST_REPORT.md).

---

## 📂 Cấu Trúc Mã Nguồn

```text
├── assets/             # Biểu đồ thiết kế kiến trúc hệ thống (PNG độ phân giải cao)
├── public/             # Tài nguyên tĩnh, ảnh mô phỏng 3D thú cưng & hình ảnh bệnh học
├── scratch/            # Các kịch bản kiểm thử tích hợp & công cụ hỗ trợ
├── server/             # Backend Express.js
│   ├── api.js          # REST API router & middleware xác thực
│   ├── backupHandler.js# Quản lý sao lưu/phục hồi snapshot
│   ├── config.js       # Quản lý cấu hình & nạp .env
│   ├── dataHandler.js  # Tầng truy xuất dữ liệu & giao dịch rollback đa collection
│   ├── db.js           # Quản lý tài khoản, băm PBKDF2 & khởi tạo seed
│   └── data/           # Cơ sở dữ liệu JSON & tài liệu nghiệp vụ
├── src/                # Mã nguồn Frontend React 19 + Tailwind CSS + Lucide Icons
│   ├── components/     # Các view & modal theo nghiệp vụ (admin, medical, booking, pets, ai...)
│   ├── constants/      # Dữ liệu tĩnh & mockData chuẩn
│   ├── hooks/          # Custom hooks (useCurrentVnDate, usePets, useAuth...)
│   └── services/       # Service layer (apiService, authService, storageService, aiService)
├── tests/              # Runner & các bộ test suites chính thức
├── .env.example        # Mẫu biến môi trường
├── package.json        # Cấu hình dự án & scripts kiểm thử
├── TEST_REPORT.md      # Báo cáo kiểm thử tự động độc lập mới nhất
└── vite.config.js      # Cấu hình Vite & Proxy
```
