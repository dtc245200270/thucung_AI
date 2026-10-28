# BÁO CÁO KẾT QUẢ KIỂM THỬ HỆ THỐNG PETCARE PRO AI
**Ngày thực hiện kiểm thử:** 16/10/2026  
**Môi trường:** Node.js v26.8.2 | Windows | Express.js 5.2.1 | Vite 8.3.0 | React 19.2.8  
**Đơn vị thực hiện:** Kiểm thử tự động độc lập (Automated Test Suite Runner)

---

## 1. TỔNG QUAN KẾT QUẢ KIỂM THỬ

| STT | Tên bộ kiểm thử | File kịch bản | Thời gian chạy | Kết quả | Tỷ lệ Đạt |
|:---:|:---|:---|:---:|:---:|:---:|
| 1 | Bộ Kiểm Thử Hồi Quy 10 Mục Hệ Thống | `scratch/test_hardening_all.mjs` | 0.99s | **PASSED** | 100% |
| 2 | Nhóm Kiểm Thử Độc Lập (8 ca + Lỗi ghi Fixture + Hợp đồng Sync + Cache) | `tests/test_independent.mjs` | 0.86s | **PASSED** | 100% |
| 3 | Mục 1: Lịch Chăm Sóc Lặp, Đồng Thời & Phân Quyền | `scratch/test_muc1_schedules.mjs` | 0.99s | **PASSED** | 100% |
| 4 | Mục 2: Backend, Filesystem Rollback, Retry & Mismatch | `tests/test_muc2_backend_and_fs.mjs` | 0.64s | **PASSED** | 100% |
| 5 | Mục 3: Thống Nhất Đơn Thuốc, Khóa Chốt, Đơn Nháp & Tương Thích Cũ | `tests/test_muc3_prescriptions.mjs` | 1.32s | **PASSED** | 100% |
| 6 | Mục 6: Thống Nhất Ngày Giờ Asia/Ho_Chi_Minh & iCalendar | `tests/test_muc6_datetime.mjs` | 0.37s | **PASSED** | 100% |
| **Tổng** | **Toàn bộ 6 Bộ Kiểm Thử Tự Động** | `tests/run_all_suites.mjs` | **5.17s** | **6/6 ĐẠT** | **100%** |

---

## 2. CHI TIẾT CÁC HẠNG MỤC KIỂM THỬ ĐÃ XÁC MINH

### 2.1. Bộ Kiểm Thử Hồi Quy 10 Mục (`scratch/test_hardening_all.mjs`)
- **Xác thực & Phân quyền RBAC:** Đăng nhập, cấp JWT token thực tế, kiểm soát quyền hạn giữa Admin, Bác sĩ (`vet_doctor`), và Chủ nuôi (`pet_owner`).
- **Bảo mật mật khẩu:** Băm mật khẩu bằng PBKDF2 (SHA-512) kèm Salt ngẫu nhiên; xác minh quy trình đổi mật khẩu lần đầu (`first-login-change-password`).
- **Khóa & Mở khóa tài khoản:** Admin có toàn quyền khóa, mở khóa và thu hồi phiên người dùng lập tức.
- **Phê duyệt Bác sĩ:** Cơ chế kiểm duyệt trạng thái bác sĩ (`approved`/`pending`), ngăn chặn bác sĩ chưa phê duyệt thao tác nghiệp vụ y tế.
- **Khôi phục mật khẩu & Giới hạn tần suất:** Rate Limiting cho tính năng Quên mật khẩu, tạo mã token một lần SHA-256 an toàn.
- **Nhật ký kiểm toán (Audit Logs):** Ghi nhận chi tiết mọi thao tác nhạy cảm (Tạo tài khoản, Đổi quyền, Khóa/Mở, Sao lưu).
- **Sao lưu & Phục hồi dữ liệu:** Xuất và phục hồi snapshot toàn hệ thống qua API Quản trị viên.

### 2.2. Nhóm Kiểm Thử Độc Lập (`tests/test_independent.mjs`)
- Chạy toàn bộ 8 ca kiểm thử độc lập (`scratch/test_regression_part2.mjs`) bao gồm:
  - Cô lập dữ liệu giữa các chủ nuôi.
  - Bảo vệ tính toàn vẹn hồ sơ thú cưng khi cập nhật đồng thời.
  - Hợp đồng đồng bộ hóa dữ liệu (Sync Contract) giữa LocalStorage và Backend JSON.
  - Phục hồi ngoại tuyến (Offline Resilience) với Smart Cache.
- **Mô phỏng lỗi ghi đĩa có kiểm soát (Fault Injection):**
  - Giả lập lỗi I/O (`EIO`) khi ghi `medical_records.json` và `appointments.json`.
  - Kiểm chứng giao dịch ghi đa tệp (Multi-collection Transaction) tự động hoàn tác (Rollback) 100% về snapshot ban đầu khi có tệp thất bại.

### 2.3. Mục 1: Lịch Chăm Sóc Lặp & Phân Quyền (`scratch/test_muc1_schedules.mjs`)
- Quản lý lịch định kỳ: hàng ngày, hàng tuần, hàng tháng, tùy chỉnh chu kỳ.
- Đồng thời cập nhật trạng thái lịch chăm sóc giữa nhiều phiên.
- Phân quyền nghiêm ngặt: Chủ nuôi chỉ chỉnh sửa lịch của thú cưng do mình sở hữu.

### 2.4. Mục 2: Filesystem Rollback, Retry & Mismatch (`tests/test_muc2_backend_and_fs.mjs`)
- Cơ chế thử lại an toàn (Idempotent Retry) khi kết nối mạng chập chờn.
- Đồng bộ nhất quán giữa Client Cache và Server Storage, ngăn ngừa hiện tượng mismatch dữ liệu.
- Cơ chế chống ghi đè một phần (Atomic Multi-File Write).

### 2.5. Mục 3: Thống Nhất Đơn Thuốc & Bệnh Án (`tests/test_muc3_prescriptions.mjs`)
- **Phân tách Đơn nháp & Đơn đã công bố:** Chủ nuôi tuyệt đối không thấy đơn nháp của bác sĩ; đơn đã chốt (`isFinal: true, status: 'published'`) bị khóa cứng, không thể sửa hoặc xóa trái phép.
- **Chống đơn thuốc rỗng (Zero Dummy Prescription):** Chốt ca khám không kê thuốc sẽ hoàn tất sạch sẽ mà không tạo bản ghi rỗng.
- **Phân quyền theo ca khám:** Bác sĩ B không thể can thiệp vào ca khám hoặc kê đơn trên ca khám của Bác sĩ A.
- **Tương thích dữ liệu cũ (Legacy Migration):** Chuyển đổi có kiểm soát các đơn thuốc cũ sang trạng thái hợp lệ, tự động tạo tệp sao lưu trước chuyển đổi.
- **Loại bỏ suy diễn dữ liệu:** Không tự ý tính toán vắc-xin khi thiếu ngày sinh, không tự suy diễn calo khi thiếu cân nặng.

### 2.6. Mục 6: Thống Nhất Múi Giờ & Xuất iCalendar (`tests/test_muc6_datetime.mjs`)
- Chuẩn hóa múi giờ hệ thống theo `Asia/Ho_Chi_Minh` (GMT+7).
- Triệt tiêu lỗi lệch ngày do hàm `toISOString()` ở các mốc giờ biên (00:05 sáng và 23:55 đêm).
- Bảo toàn tuyệt đối trường định dạng `YYYY-MM-DD` qua chu trình Lưu -> Tải lại -> Phiên đăng nhập mới.
- Xuất tệp lịch hẹn `.ics` chuẩn RFC 5545 tích hợp khối `VTIMEZONE Asia/Ho_Chi_Minh`.

---

## 3. HƯỚNG DẪN TÁI HIỆN BÁO CÁO KIỂM THỬ

Để chạy lại toàn bộ kiểm thử độc lập:
```bash
# 1. Khởi động Backend server (ở một terminal)
npm run server

# 2. Chạy toàn bộ các bộ kiểm thử
npm test

# 3. Hoặc chạy từng bộ riêng lẻ:
npm run test:independent
npm run test:muc1
npm run test:muc2
npm run test:muc3
npm run test:regression
```
