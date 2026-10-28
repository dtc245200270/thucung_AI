import { formatDateVi, getTodayVnDate } from './dateUtils.js';

/**
 * Tránh lỗi XSS khi nhúng dữ liệu vào HTML in
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Tính tuổi hiển thị thân thiện từ birthDate
 */
export function getPetAgeText(birthDateStr) {
  if (!birthDateStr) return 'Chưa cập nhật ngày sinh';
  try {
    const birth = new Date(birthDateStr);
    const now = new Date();
    if (isNaN(birth.getTime())) return 'Chưa cập nhật ngày sinh';
    let years = now.getFullYear() - birth.getFullYear();
    let months = now.getMonth() - birth.getMonth();
    if (months < 0) {
      years--;
      months += 12;
    }
    if (years <= 0) return `${Math.max(1, months)} tháng tuổi`;
    return months > 0 ? `${years} tuổi ${months} tháng` : `${years} tuổi`;
  } catch {
    return 'Chưa cập nhật';
  }
}

/**
 * Tạo tài liệu HTML A4 hoàn chỉnh cho Hồ Sơ Sức Khỏe PetCare
 */
export function generateHealthRecordPdfHtml({
  pet,
  schedules = [],
  medicalRecords = [],
  prescriptions = [],
  currentUser = null
}) {
  if (!pet || !pet.id) {
    throw new Error('Dữ liệu thú cưng không hợp lệ để tạo hồ sơ.');
  }

  const todayVn = getTodayVnDate();
  const todayFormatted = formatDateVi(todayVn);

  // 1. Chuẩn hóa thông tin thú cưng & chủ nuôi
  const petName = pet.name || 'Thú cưng';
  const petSpecies = pet.species === 'cat' ? 'Mèo' : pet.species === 'dog' ? 'Chó' : (pet.species || 'Chưa cập nhật');
  const petBreed = pet.breed || 'Chưa cập nhật';
  const petGender = pet.gender === 'male' || pet.gender === 'Đực' ? 'Đực' : pet.gender === 'female' || pet.gender === 'Cái' ? 'Cái' : 'Chưa cập nhật';
  const petBirthDate = pet.birthDate ? formatDateVi(pet.birthDate) : 'Chưa cập nhật';
  const petAge = getPetAgeText(pet.birthDate);
  const petWeight = pet.weight != null && !isNaN(Number(pet.weight)) && Number(pet.weight) > 0 ? `${pet.weight} kg` : 'Chưa cập nhật';
  const petNeutered = pet.isNeutered ? 'Đã triệt sản' : 'Chưa triệt sản';
  const petColor = (pet.color && String(pet.color).trim()) ? String(pet.color).trim() : 'Chưa cập nhật';
  const petMicrochip = pet.microchip || 'Chưa cập nhật';

  const ownerName = currentUser?.name || pet.ownerName || 'Chưa cập nhật';
  const ownerPhone = currentUser?.phone || pet.ownerPhone || 'Chưa cập nhật';
  const ownerAddress = currentUser?.address || pet.ownerAddress || 'Chưa cập nhật';

  // 2. Danh sách tiêm chủng (type === 'vaccine', không lấy bản dự kiến)
  const vaccines = schedules
    .filter(s => s && s.petId === pet.id && s.type === 'vaccine' && !s.isPlanned)
    .map(v => {
      const isVetVerified = v.isVerified === true || v.source === 'vet_verified';
      return {
        id: v.id,
        title: v.title || v.vaccineName || 'Vaccine phòng bệnh',
        batchNumber: v.batchNumber || 'Chưa cập nhật',
        date: formatDateVi(v.date),
        nextDueDate: v.nextDueDate ? formatDateVi(v.nextDueDate) : 'Chưa có',
        facility: (v.facility || v.location || '') + (v.doctor ? ` (${v.doctor})` : '') || 'Chưa cập nhật',
        sourceText: isVetVerified ? `Bác sĩ xác nhận${v.verifiedBy ? ` (${v.verifiedBy})` : ''}` : 'Chủ nuôi khai báo',
        isVetVerified
      };
    });

  // 3. Danh sách phòng ký sinh trùng (type === 'parasite' | 'deworm', không lấy bản dự kiến)
  const parasites = schedules
    .filter(s => s && s.petId === pet.id && (s.type === 'parasite' || s.type === 'deworm') && !s.isPlanned)
    .map(p => {
      const isVetVerified = p.isVerified === true || p.source === 'vet_verified';
      return {
        id: p.id,
        title: p.title || p.medicationName || 'Chế phẩm phòng ký sinh trùng',
        purpose: p.purpose || 'Phòng ngừa ký sinh trùng',
        dosage: p.dosage ? `${p.dosage} ${p.dosageUnit || ''}`.trim() : 'Chưa cập nhật',
        date: formatDateVi(p.date),
        nextDueDate: p.nextDueDate ? formatDateVi(p.nextDueDate) : 'Chưa có',
        facility: (p.facility || p.location || '') + (p.doctor ? ` (${p.doctor})` : '') || 'Chưa cập nhật',
        sourceText: isVetVerified ? `Bác sĩ xác nhận${p.verifiedBy ? ` (${p.verifiedBy})` : ''}` : 'Chủ nuôi khai báo',
        isVetVerified
      };
    });

  // 4. Bệnh án đã chốt & công bố chính thức (isFinal === true && status === 'published')
  const publishedRecords = medicalRecords
    .filter(r => r && r.petId === pet.id && r.isFinal === true && r.status === 'published')
    .map(r => ({
      id: r.id,
      date: formatDateVi(r.date || r.createdAt),
      doctor: r.vetName || r.doctor || r.confirmedBy || r.authorName || 'Bác sĩ phụ trách',
      facility: r.facility || r.clinic || 'Cơ sở khám',
      reason: r.chiefComplaint || r.reason || 'Khám bệnh',
      diagnosis: r.soap?.assessment || r.assessment || r.diagnosis || 'Chưa ghi nhận',
      plan: r.soap?.plan || r.plan || r.treatmentPlan || 'Theo dõi y khoa'
    }));

  // 5. Đơn thuốc đã ký chốt (isFinal === true && status === 'published')
  const publishedPrescriptions = prescriptions
    .filter(p => p && p.petId === pet.id && p.isFinal === true && p.status === 'published')
    .map(p => {
      const meds = Array.isArray(p.medications) && p.medications.length > 0
        ? p.medications.map(m => `${m.name || 'Thuốc'} (${[m.dose, m.unit, m.route, m.freq].filter(Boolean).join(' ')})`).join('; ')
        : (p.medicineName || 'Theo chỉ định của bác sĩ');
      return {
        id: p.id,
        date: formatDateVi(p.createdAt || p.confirmedAt || p.startDate),
        doctor: p.prescribedBy || p.vetName || 'Bác sĩ kê đơn',
        diagnosis: p.diagnosis || p.purpose || 'Theo dõi y khoa',
        medications: meds
      };
    });

  // Tạo HTML string
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Ho-So-Suc-Khoe-${escapeHtml(petName)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm 15mm 15mm;
    }
    *, *:before, *:after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 11px;
      line-height: 1.45;
    }
    .document-container {
      width: 100%;
      max-width: 820px;
      margin: 0 auto;
      padding: 10px 16px;
    }
    .header-box {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .system-title {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 1px;
      color: #4338ca;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .main-title {
      font-size: 17px;
      font-weight: 900;
      text-transform: uppercase;
      margin: 0 0 3px 0;
      color: #020617;
      letter-spacing: -0.3px;
    }
    .sub-title {
      font-size: 11px;
      color: #475569;
      margin: 0;
    }
    .meta-box {
      text-align: right;
      font-size: 10px;
      color: #334155;
    }
    .section-box {
      margin-bottom: 14px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .section-title {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1.5px solid #cbd5e1;
      padding-bottom: 4px;
      margin-bottom: 8px;
      color: #0f172a;
      display: flex;
      justify-content: space-between;
    }
    .info-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background-color: #f8fafc;
      padding: 10px 12px;
      display: flex;
      gap: 16px;
      align-items: center;
    }
    .pet-avatar-box {
      width: 70px;
      height: 84px;
      border: 1px solid #94a3b8;
      border-radius: 4px;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      flex-shrink: 0;
    }
    .pet-avatar-box img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .pet-avatar-placeholder {
      font-size: 8px;
      color: #94a3b8;
      text-align: center;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 5px 14px;
      font-size: 11px;
      width: 100%;
    }
    .info-item span.label {
      color: #64748b;
    }
    .info-item strong {
      color: #0f172a;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      margin-top: 4px;
    }
    table.data-table th, table.data-table td {
      border: 1px solid #cbd5e1;
      padding: 5px 7px;
      text-align: left;
    }
    table.data-table th {
      background-color: #f1f5f9;
      font-weight: 700;
      color: #1e293b;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 700;
    }
    .badge-owner {
      background-color: #f1f5f9;
      color: #334155;
      border: 1px solid #cbd5e1;
    }
    .badge-vet {
      background-color: #ecfdf5;
      color: #047857;
      border: 1px solid #a7f3d0;
    }
    .empty-note {
      font-size: 11px;
      font-style: italic;
      color: #64748b;
      padding: 6px 0;
    }
    .footer-box {
      border-top: 2px solid #0f172a;
      padding-top: 8px;
      margin-top: 14px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .footer-signatures {
      display: flex;
      justify-content: space-between;
      text-align: center;
      margin-bottom: 12px;
    }
    .signature-col {
      width: 45%;
    }
    .sig-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #1e293b;
    }
    .sig-sub {
      font-size: 9px;
      font-style: italic;
      color: #64748b;
      margin-top: 2px;
    }
    .sig-space {
      height: 36px;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      font-weight: 600;
      font-size: 11px;
      color: #0f172a;
    }
    .disclaimer {
      font-size: 9px;
      color: #64748b;
      text-align: justify;
      border-top: 1px solid #e2e8f0;
      padding-top: 6px;
      line-height: 1.35;
    }
    @media print {
      body {
        margin: 0;
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <!-- Action toolbar hiển thị trên màn hình, ẩn khi in hoặc xuất PDF -->
  <div class="no-print" style="background: #f8fafc; border-bottom: 1px solid #cbd5e1; padding: 10px 20px; display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    <div style="display: flex; align-items: center; gap: 10px;">
      <span style="font-weight: 700; color: #0f172a;">📄 Hồ sơ sức khỏe: ${escapeHtml(petName)}</span>
      <span style="color: #64748b; font-size: 11px;">(Định dạng A4 - Tiếng Việt có dấu - Tự động hiển thị hộp thoại in/lưu PDF)</span>
    </div>
    <div style="display: flex; align-items: center; gap: 8px;">
      <button onclick="window.print()" style="cursor: pointer; background: #0f172a; color: #ffffff; border: none; padding: 7px 16px; border-radius: 6px; font-weight: 700; font-size: 11px; display: inline-flex; align-items: center; gap: 6px;">
        🖨️ In / Lưu file PDF (Save as PDF)
      </button>
      <button onclick="window.close()" style="cursor: pointer; background: #e2e8f0; color: #334155; border: 1px solid #cbd5e1; padding: 7px 14px; border-radius: 6px; font-weight: 600; font-size: 11px;">
        ✕ Đóng tab
      </button>
    </div>
  </div>

  <div class="document-container">
    
    <!-- HEADER -->
    <div class="header-box">
      <div>
        <div class="system-title">HỆ THỐNG QUẢN LÝ THÚ CƯNG PETCARE</div>
        <h1 class="main-title">HỒ SƠ SỨC KHỎE VÀ LỊCH SỬ Y TẾ THÚ CƯNG</h1>
        <p class="sub-title">Sổ theo dõi tiêm chủng, phòng ngừa ký sinh trùng & bệnh án điều trị</p>
      </div>
      <div class="meta-box">
        <div>Mã thú cưng: <strong class="font-mono">${escapeHtml(pet.id)}</strong></div>
        <div style="margin-top: 2px;">Ngày trích xuất: <strong>${escapeHtml(todayFormatted)}</strong></div>
      </div>
    </div>

    <!-- KHỐI 1: THÔNG TIN THÚ CƯNG & CHỦ NUÔI -->
    <div class="section-box">
      <div class="section-title">
        <span>I. THÔNG TIN THÚ CƯNG & CHỦ NUÔI</span>
      </div>
      <div class="info-card">
        <div class="pet-avatar-box">
          ${pet.avatar ? `<img src="${escapeHtml(pet.avatar)}" alt="${escapeHtml(petName)}" />` : `<div class="pet-avatar-placeholder">Không có ảnh</div>`}
        </div>
        <div class="info-grid">
          <div class="info-item"><span class="label">Tên thú cưng: </span><strong>${escapeHtml(petName)}</strong></div>
          <div class="info-item"><span class="label">Loài: </span><strong>${escapeHtml(petSpecies)}</strong></div>
          <div class="info-item"><span class="label">Giống: </span><strong>${escapeHtml(petBreed)}</strong></div>
          
          <div class="info-item"><span class="label">Giới tính: </span><strong>${escapeHtml(petGender)}</strong></div>
          <div class="info-item"><span class="label">Ngày sinh: </span><strong>${escapeHtml(petBirthDate)}</strong></div>
          <div class="info-item"><span class="label">Độ tuổi: </span><strong>${escapeHtml(petAge)}</strong></div>

          <div class="info-item"><span class="label">Cân nặng: </span><strong>${escapeHtml(petWeight)}</strong></div>
          <div class="info-item"><span class="label">Triệt sản: </span><strong>${escapeHtml(petNeutered)}</strong></div>
          <div class="info-item"><span class="label">Màu lông: </span><strong>${escapeHtml(petColor)}</strong></div>

          <div class="info-item"><span class="label">Mã Microchip: </span><strong class="font-mono">${escapeHtml(petMicrochip)}</strong></div>
          <div class="info-item"><span class="label">Chủ sở hữu: </span><strong>${escapeHtml(ownerName)}</strong></div>
          <div class="info-item"><span class="label">Số điện thoại: </span><strong>${escapeHtml(ownerPhone)}</strong></div>
        </div>
      </div>
    </div>

    <!-- KHỐI 2: LỊCH SỬ TIÊM CHỦNG -->
    <div class="section-box">
      <div class="section-title">
        <span>II. LỊCH SỬ TIÊM CHỦNG VẮC-XIN</span>
        <span style="font-weight: 500; font-size: 10px; color: #64748b;">Tổng số: ${vaccines.length} mũi</span>
      </div>
      ${vaccines.length === 0 ? `
        <div class="empty-note">Chưa có bản ghi tiêm chủng nào được lưu trong hệ thống.</div>
      ` : `
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 26%;">Tên Vaccine</th>
              <th style="width: 14%;" class="text-center">Số lô</th>
              <th style="width: 12%;" class="text-center">Ngày tiêm</th>
              <th style="width: 12%;" class="text-center">Tiêm nhắc</th>
              <th style="width: 20%;">Cơ sở / Bác sĩ</th>
              <th style="width: 16%;" class="text-center">Nguồn ghi nhận</th>
            </tr>
          </thead>
          <tbody>
            ${vaccines.map(v => `
              <tr>
                <td><strong>${escapeHtml(v.title)}</strong></td>
                <td class="text-center font-mono">${escapeHtml(v.batchNumber)}</td>
                <td class="text-center font-mono">${escapeHtml(v.date)}</td>
                <td class="text-center font-mono">${escapeHtml(v.nextDueDate)}</td>
                <td>${escapeHtml(v.facility)}</td>
                <td class="text-center">
                  <span class="badge ${v.isVetVerified ? 'badge-vet' : 'badge-owner'}">
                    ${escapeHtml(v.sourceText)}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </div>

    <!-- KHỐI 3: PHÒNG NGỪA KÝ SINH TRÙNG -->
    <div class="section-box">
      <div class="section-title">
        <span>III. PHÒNG NGỪA KÝ SINH TRÙNG (TẨY GIUN & PHÒNG VE RẬN)</span>
        <span style="font-weight: 500; font-size: 10px; color: #64748b;">Tổng số: ${parasites.length} đợt</span>
      </div>
      ${parasites.length === 0 ? `
        <div class="empty-note">Chưa có bản ghi phòng ngừa ký sinh trùng nào được lưu trong hệ thống.</div>
      ` : `
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 24%;">Tên thuốc / Chế phẩm</th>
              <th style="width: 20%;">Mục đích</th>
              <th style="width: 10%;" class="text-center">Liều lượng</th>
              <th style="width: 11%;" class="text-center">Ngày sử dụng</th>
              <th style="width: 11%;" class="text-center">Ngày dùng nhắc</th>
              <th style="width: 12%;">Cơ sở / Bác sĩ</th>
              <th style="width: 12%;" class="text-center">Nguồn ghi nhận</th>
            </tr>
          </thead>
          <tbody>
            ${parasites.map(p => `
              <tr>
                <td><strong>${escapeHtml(p.title)}</strong></td>
                <td>${escapeHtml(p.purpose)}</td>
                <td class="text-center">${escapeHtml(p.dosage)}</td>
                <td class="text-center font-mono">${escapeHtml(p.date)}</td>
                <td class="text-center font-mono">${escapeHtml(p.nextDueDate)}</td>
                <td>${escapeHtml(p.facility)}</td>
                <td class="text-center">
                  <span class="badge ${p.isVetVerified ? 'badge-vet' : 'badge-owner'}">
                    ${escapeHtml(p.sourceText)}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </div>

    <!-- KHỐI 4: BỆNH ÁN & ĐƠN THUỐC CHÍNH THỨC -->
    <div class="section-box">
      <div class="section-title">
        <span>IV. BỆNH ÁN ĐIỀU TRỊ & KHÁM LÂM SÀNG (ĐÃ KÝ CHỐT)</span>
        <span style="font-weight: 500; font-size: 10px; color: #64748b;">Chính thức</span>
      </div>
      ${publishedRecords.length === 0 ? `
        <div class="empty-note">Chưa ghi nhận bệnh án đã ký chốt trong hệ thống.</div>
      ` : `
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 14%;" class="text-center">Ngày khám</th>
              <th style="width: 22%;">Bác sĩ & Cơ sở</th>
              <th style="width: 32%;">Lý do khám & Chẩn đoán</th>
              <th style="width: 32%;">Hướng điều trị</th>
            </tr>
          </thead>
          <tbody>
            ${publishedRecords.map(r => `
              <tr>
                <td class="text-center font-mono">${escapeHtml(r.date)}</td>
                <td>
                  <div><strong>${escapeHtml(r.doctor)}</strong></div>
                  <div style="font-size: 9px; color: #64748b;">${escapeHtml(r.facility)}</div>
                </td>
                <td>
                  <div><strong>Lý do: </strong>${escapeHtml(r.reason)}</div>
                  <div><strong>Chẩn đoán: </strong>${escapeHtml(r.diagnosis)}</div>
                </td>
                <td>${escapeHtml(r.plan)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </div>

    <!-- KHỐI 5: ĐƠN THUỐC Y TẾ CHÍNH THỨC -->
    <div class="section-box">
      <div class="section-title">
        <span>V. ĐƠN THUỐC Y TẾ (ĐÃ KÝ CHỐT)</span>
        <span style="font-weight: 500; font-size: 10px; color: #64748b;">Chính thức</span>
      </div>
      ${publishedPrescriptions.length === 0 ? `
        <div class="empty-note">Chưa ghi nhận đơn thuốc đã ký chốt trong hệ thống.</div>
      ` : `
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 14%;" class="text-center">Ngày kê đơn</th>
              <th style="width: 22%;">Bác sĩ kê đơn</th>
              <th style="width: 28%;">Chẩn đoán</th>
              <th style="width: 36%;">Danh mục thuốc chỉ định</th>
            </tr>
          </thead>
          <tbody>
            ${publishedPrescriptions.map(p => `
              <tr>
                <td class="text-center font-mono">${escapeHtml(p.date)}</td>
                <td><strong>${escapeHtml(p.doctor)}</strong></td>
                <td>${escapeHtml(p.diagnosis)}</td>
                <td>${escapeHtml(p.medications)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </div>

    <!-- FOOTER -->
    <div class="footer-box">
      <div class="footer-signatures">
        <div class="signature-col">
          <div class="sig-title">CHỦ NUÔI XÁC NHẬN</div>
          <div class="sig-sub">(Ký và ghi rõ họ tên)</div>
          <div class="sig-space">${escapeHtml(ownerName)}</div>
        </div>
        <div class="signature-col">
          <div class="sig-title">TRÍCH XUẤT HỆ THỐNG PETCARE</div>
          <div class="sig-sub">(Tài liệu xuất tự động ngày ${escapeHtml(todayFormatted)})</div>
          <div class="sig-space">Mã hồ sơ: ${escapeHtml(pet.id)}</div>
        </div>
      </div>
      <div class="disclaimer">
        * Ghi chú miễn trừ: Hồ sơ sức khỏe này được trích xuất từ Hệ thống Quản lý Y tế Thú cưng PetCare nhằm mục đích theo dõi sức khỏe và lịch sử tiêm phòng cá nhân của thú cưng. Mọi thông tin tự khai báo được giữ nguyên tính xác thực ban đầu của người dùng. Tài liệu này không phải là hộ chiếu kiểm dịch xuất nhập cảnh quốc tế.
      </div>
    </div>

  </div>

  <!-- THANH CÔNG CỤ IN VÀ LƯU PDF NỔI (ẨN HOÀN TOÀN KHI IN) -->
  <div class="print-toolbar no-print" style="position: fixed; top: 12px; left: 50%; transform: translateX(-50%); z-index: 999999; background: #0f172a; color: #ffffff; padding: 10px 18px; border-radius: 9999px; display: flex; align-items: center; gap: 12px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="font-size: 14px;">🐾</span>
      <span style="font-size: 12px; font-weight: 700;">Hồ sơ sức khỏe: ${escapeHtml(petName)}</span>
    </div>
    <div style="height: 16px; width: 1px; background: rgba(255,255,255,0.25);"></div>
    <button onclick="triggerPrint()" style="display: flex; align-items: center; gap: 6px; background: #4f46e5; hover: background: #4338ca; color: white; border: none; padding: 6px 14px; border-radius: 9999px; font-weight: 700; font-size: 11px; cursor: pointer; transition: all 0.2s;">
      🖨️ In / Lưu PDF (A4)
    </button>
    <button onclick="window.close()" style="background: rgba(255,255,255,0.1); color: #cbd5e1; border: none; padding: 6px 12px; border-radius: 9999px; font-size: 11px; cursor: pointer; transition: all 0.2s;">
      ✕ Đóng
    </button>
  </div>

  <script>
    function triggerPrint() {
      try {
        window.focus();
        window.print();
      } catch (e) {
        console.warn('Lỗi khi kích hoạt hộp thoại in:', e);
      }
    }
    // Kích hoạt in tự động ngay khi trang sẵn sàng
    if (document.readyState === 'complete') {
      setTimeout(triggerPrint, 350);
    } else {
      window.addEventListener('load', function() {
        setTimeout(triggerPrint, 350);
      });
      // Dự phòng nếu sự kiện load đã trôi qua
      setTimeout(triggerPrint, 800);
    }
  </script>
</body>
</html>`;
}

/**
 * Thực hiện toàn bộ quy trình xuất hồ sơ sức khỏe PDF:
 * 1. Kiểm tra dữ liệu thú cưng
 * 2. Tạo nội dung HTML A4 và Blob URL dự phòng
 * 3. Mở cửa sổ in / tab mới
 * 4. Kiểm tra phát hiện popup bị chặn: Tự động kích hoạt tải file về máy và ném lỗi rõ ràng
 * 5. Ghi nội dung HTML và kích hoạt hộp thoại in
 */
export async function exportHealthRecordPdf({
  pet,
  schedules = [],
  medicalRecords = [],
  prescriptions = [],
  currentUser = null
}) {
  if (!pet || !pet.id) {
    throw new Error('Vui lòng chọn thú cưng để xuất hồ sơ sức khỏe.');
  }

  // 1. Sinh nội dung HTML A4 chuẩn in
  const htmlContent = generateHealthRecordPdfHtml({
    pet,
    schedules,
    medicalRecords,
    prescriptions,
    currentUser
  });

  // 2. Tạo Blob URL dự phòng cho trường hợp popup bị chặn hoặc tải file offline
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  const safePetName = (pet.name || 'thu_cung').replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]/g, '_');
  const fileName = `Ho_so_suc_khoe_${safePetName}.html`;

  // 3. Thử mở cửa sổ in / tab mới
  let printWindow = null;
  let isPopupBlocked = false;

  try {
    printWindow = window.open('', '_blank');
    if (!printWindow || printWindow.closed || typeof printWindow.closed === 'undefined') {
      isPopupBlocked = true;
    }
  } catch {
    isPopupBlocked = true;
  }

  // 4. Xử lý khi trình duyệt chặn cửa sổ bật lên (Popup Blocked)
  if (isPopupBlocked || !printWindow) {
    // Tự động kích hoạt tải file tài liệu về máy làm phương án dự phòng ngay lập tức
    try {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (downloadErr) {
      console.warn('Lỗi khi kích hoạt tải file tự động:', downloadErr);
    }

    const popupError = new Error('POPUP_BLOCKED');
    popupError.code = 'POPUP_BLOCKED';
    popupError.blobUrl = blobUrl;
    popupError.fileName = fileName;
    popupError.petName = pet.name || 'Thú cưng';
    throw popupError;
  }

  // 5. Ghi nội dung vào tab mới và kích hoạt in
  try {
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    return {
      success: true,
      mode: 'window',
      blobUrl,
      fileName
    };
  } catch (err) {
    console.error('Lỗi khi ghi nội dung tài liệu:', err);
    if (printWindow && !printWindow.closed) {
      try { printWindow.close(); } catch {}
    }
    throw err;
  }
}
