/**
 * Danh Mục Cơ Sở Thú Y & Dịch Vụ Khám Được Quản Lý Trong Hệ Thống
 * Tuyệt đối không gắn đánh giá sao giả (4.9 ★) hoặc số ca điều trị giả không có nguồn.
 * Mỗi cơ sở có thông tin địa chỉ, hotline và lịch làm việc thực tế (workingDays, workingHours).
 */

export const VET_SERVICES = [
  {
    id: 'general',
    name: 'Khám tổng quát định kỳ',
    desc: 'Đo nhịp tim, nhiệt độ, kiểm tra mắt, tai và thể trạng tổng thể',
    icon: '🩺',
    badge: 'Định kỳ',
    isEmergency: false
  },
  {
    id: 'dermatology',
    name: 'Da liễu & Vết nấm/ve rận',
    desc: 'Soi kính hiển vi tìm vi nấm, bọ chét, xét nghiệm tế bào học da',
    icon: '🩹',
    badge: 'Chuyên khoa',
    isEmergency: false
  },
  {
    id: 'vaccine',
    name: 'Tiêm vắc-xin & Tẩy giun',
    desc: 'Vắc-xin 5/7 bệnh chó, 4 bệnh mèo, phòng dại và xổ giun định kỳ',
    icon: '💉',
    badge: 'Phòng ngừa',
    isEmergency: false
  },
  {
    id: 'emergency',
    name: 'Cấp cứu tiêu hóa/nôn mửa',
    desc: 'Tiêu chảy ra máu, nuốt dị vật, co giật, bỏ ăn kéo dài',
    icon: '🚨',
    badge: 'Ưu tiên cấp cứu',
    isEmergency: true
  },
  {
    id: 'dental_spa',
    name: 'Khám răng & Spa móng',
    desc: 'Cạo vôi răng siêu âm, vệ sinh tuyến hôi, cắt tỉa móng và tai',
    icon: '✂️',
    badge: 'Vệ sinh',
    isEmergency: false
  }
];

export const VET_FACILITIES = [
  {
    id: '2vet',
    name: 'Bệnh viện Thú y 2Vet Hospital',
    address: '335 Kim Ngưu, Hai Bà Trưng, Hà Nội',
    hotline: '098 335 8126 (Cấp cứu 24/7)',
    workingDays: [0, 1, 2, 3, 4, 5, 6], // Thứ 2 đến Chủ nhật (mở cả tuần)
    workingHours: ['08:30', '10:00', '14:00', '16:30', '19:30'],
    slotCapacity: 2,
    isActive: true
  }
];

// Danh mục cơ sở ngừng hoạt động / lưu trữ lịch sử để bảo toàn liên kết dữ liệu cũ
export const INACTIVE_OR_HISTORICAL_FACILITIES = [
  {
    id: 'pethealth',
    name: 'Bệnh viện Thú y PetHealth 262 Quang Trung',
    address: '262 Quang Trung, Hà Đông, Hà Nội',
    hotline: '1900 6868 (Cấp cứu 24/7)',
    isActive: false,
    decommissionedAt: '2026-10-28'
  },
  {
    id: 'sammi',
    name: 'Phòng khám Sammi Animal Clinic',
    address: 'Số 18 ngõ 282 Lạc Long Quân, Tây Hồ, Hà Nội',
    hotline: '024 2246 8899',
    isActive: false,
    decommissionedAt: '2026-10-28'
  }
];

export const ALL_FACILITIES = [...VET_FACILITIES, ...INACTIVE_OR_HISTORICAL_FACILITIES];

export const findFacilityById = (id) => ALL_FACILITIES.find(f => f.id === id) || null;

