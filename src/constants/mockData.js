import { getTodayVnDate, addDaysLocal } from '../utils/dateUtils';

// Mock data ban đầu phong phú và chuẩn thú y
export const INITIAL_PETS = [];

// Cơ sở dữ liệu Vắc-xin chuẩn y khoa theo từng cá thể & loài thú cưng
export const petVaccineDatabase = {
  mochi: {
    id: 'mochi',
    name: 'Mochi',
    species: 'Golden Retriever',
    microchip: '98200036412',
    stats: { completed: 3, nextDue: '18/01/2027', dewormCount: 2 },
    vaccines: [
      { name: 'Nobivac DHPPi + L4 (7 Bệnh)', lot: 'NV-2026-8892', date: '10/05/2026', nextDue: '18/01/2027', remainingDays: 106, vet: 'BS. Nam - CCHN-0981' },
      { name: 'Rabisin (Vắc-xin Dại Quốc Tế)', lot: 'RB-2026-4412', date: '15/04/2026', nextDue: '15/04/2027', remainingDays: 193, vet: 'BS. Trần Thị Mai - CCHN-1204' },
      { name: 'Bordetella Bronchiseptica (Ho cũi chó)', lot: 'KC-2026-1102', date: '20/09/2026', nextDue: '20/09/2027', remainingDays: 351, vet: 'BS. Nam - CCHN-0981' }
    ]
  },
  luna: {
    id: 'luna',
    name: 'Luna',
    species: 'Mèo Anh Lông Ngắn (BSH)',
    microchip: 'VN-9820008871',
    stats: { completed: 2, nextDue: '12/03/2027', dewormCount: 3 },
    vaccines: [
      { name: 'Purevax RCPCh (Vắc-xin 4 Bệnh Mèo)', lot: 'PV-2026-3391', date: '12/03/2026', nextDue: '12/03/2027', remainingDays: 159, vet: 'BS. Trần Thị Mai - CCHN-1204' },
      { name: 'Rabisin (Phòng Dại Cho Mèo)', lot: 'RB-2026-9021', date: '15/04/2026', nextDue: '15/04/2027', remainingDays: 193, vet: 'BS. Nam - CCHN-0981' }
    ]
  },
  banhbao: {
    id: 'banhbao',
    name: 'Bánh Bao',
    species: 'Thỏ Minilop',
    microchip: 'VN-9820001905',
    stats: { completed: 1, nextDue: '05/11/2026', dewormCount: 1 },
    vaccines: [
      { name: 'Filavac VHD K C+V (Bại huyết Thỏ RHDV1 & RHDV2)', lot: 'FL-2026-0418', date: '05/11/2025', nextDue: '05/11/2026', remainingDays: 32, vet: 'BS. Nam - CCHN-0981' }
    ]
  }
};

// Dữ liệu tẩy giun & ký sinh trùng chuẩn y khoa cho từng loài
export const petDewormDatabase = {
  mochi: [
    {
      id: 'deworm-m-1',
      title: 'Drontal Plus Flavour',
      diseaseDesc: 'Tẩy sán dây, giun tròn, giun móc, giun tóc đường ruột',
      batchNumber: 'DT-2026-0988',
      date: '01/08/2026',
      nextDueDate: '01/11/2026',
      doctor: 'BS. Lê Minh Hoàng (Khoa Dược)',
      facility: 'Phòng khám PetCare Chi nhánh 1',
      completed: true,
      repeat: '3 tháng/lần',
      notes: 'Uống sau ăn no, đường ruột sạch, thể trạng ổn định.'
    },
    {
      id: 'deworm-m-2',
      title: 'NexGard Spectra 15-30kg',
      diseaseDesc: 'Dự phòng giun tim, tẩy giun phổi & phòng diệt ve rận, ghẻ demodex',
      batchNumber: 'NX-2027-5501',
      date: '01/09/2026',
      nextDueDate: '01/10/2026',
      doctor: 'Dược sĩ Thú y Khoa Dược',
      facility: 'Hệ thống PetCare Hub',
      completed: true,
      repeat: '1 tháng/lần',
      notes: 'Viên nhai vị bò thơm ngon, dự phòng ngoại ký sinh trùng tuyệt đối.'
    }
  ],
  luna: [
    {
      id: 'deworm-l-1',
      title: 'Broadline Spot-on (Cho mèo 2.5 - 7.5kg)',
      diseaseDesc: 'Nhỏ gáy phòng trị ve rận, bọ chét, giun tim & sán dây cho mèo',
      batchNumber: 'BL-2026-1190',
      date: '15/08/2026',
      nextDueDate: '15/09/2026',
      doctor: 'BS. Trần Thị Mai - CCHN-1204',
      facility: 'Bệnh Viện Thú Y PetCare Central',
      completed: true,
      repeat: '1 tháng/lần',
      notes: 'Nhỏ gáy tại nhà, lông khô sạch, không kích ứng da.'
    },
    {
      id: 'deworm-l-2',
      title: 'Revolution Plus (Mèo 2.5 - 5kg)',
      diseaseDesc: 'Phòng ngừa giun tim, ghẻ tai, diệt ve rận và bọ chét chuyên biệt mèo',
      batchNumber: 'RP-2026-4421',
      date: '15/07/2026',
      nextDueDate: '15/08/2026',
      doctor: 'BS. Lê Minh Hoàng (Khoa Dược)',
      facility: 'Hệ thống PetCare Hub',
      completed: true,
      repeat: '1 tháng/lần',
      notes: 'Bảo vệ ngoại ký sinh và giun chỉ toàn diện.'
    },
    {
      id: 'deworm-l-3',
      title: 'Milbemax Chewable Cat',
      diseaseDesc: 'Viên nhai tẩy giun tròn, giun móc và sán dây nội tạng cho mèo',
      batchNumber: 'MB-2026-0032',
      date: '12/03/2026',
      nextDueDate: '12/06/2026',
      doctor: 'BS. Nam - CCHN-0981',
      facility: 'Phòng khám PetCare Chi nhánh 1',
      completed: true,
      repeat: '3 tháng/lần',
      notes: 'Tẩy giun nội tạng định kỳ, tiêu hóa ổn định.'
    }
  ],
  banhbao: [
    {
      id: 'deworm-b-1',
      title: 'Panacur Rabbit Oral Paste (Fenbendazole)',
      diseaseDesc: 'Gel uống phòng ngừa ký sinh trùng nội tạng và vi bào tử trùng E. Cuniculi ở thỏ',
      batchNumber: 'PC-2026-7819',
      date: '05/08/2026',
      nextDueDate: '05/02/2027',
      doctor: 'BS. Nam - CCHN-0981',
      facility: 'Bệnh Viện Thú Y PetCare Central',
      completed: true,
      repeat: '6 tháng/lần',
      notes: 'Uống trực tiếp hoặc trộn cỏ Timothy, đường ruột khỏe mạnh.'
    }
  ]
};

// Helper lấy khóa của thú cưng
export const getPetKey = (pet) => {
  if (!pet) return '';
  return String(pet.id || '').trim();
};

// Helper tính ngày linh động tương đối theo hôm nay
const getOffsetDate = (days) => addDaysLocal(getTodayVnDate(), days);

export const INITIAL_SCHEDULES = [];

export const SCHEDULE_TYPES = {
  vaccine: {
    label: 'Tiêm phòng',
    icon: 'Syringe',
    color: 'emerald',
    bgLight: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800/50 dark:text-emerald-300',
    badge: 'bg-emerald-100 text-emerald-800'
  },
  deworm: {
    label: 'Tẩy giun / Phòng ký sinh trùng',
    icon: 'Pill',
    color: 'amber',
    bgLight: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800/50 dark:text-amber-300',
    badge: 'bg-amber-100 text-amber-800'
  },
  grooming: {
    label: 'Vệ sinh / Làm đẹp',
    icon: 'Sparkles',
    color: 'purple',
    bgLight: 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-950/40 dark:border-purple-800/50 dark:text-purple-300',
    badge: 'bg-purple-100 text-purple-800'
  },
  vet: {
    label: 'Nhắc khám / Tái khám',
    icon: 'Stethoscope',
    color: 'blue',
    bgLight: 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/40 dark:border-blue-800/50 dark:text-blue-300',
    badge: 'bg-blue-100 text-blue-800'
  },
  medicine: {
    label: 'Uống thuốc / Điều trị',
    icon: 'Activity',
    color: 'rose',
    bgLight: 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800/50 dark:text-rose-300',
    badge: 'bg-rose-100 text-rose-800'
  },
  feeding: {
    label: 'Ăn uống',
    icon: 'Utensils',
    color: 'orange',
    bgLight: 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950/40 dark:border-orange-800/50 dark:text-orange-300',
    badge: 'bg-orange-100 text-orange-800'
  },
  exercise: {
    label: 'Vận động / Vui chơi',
    icon: 'Footprints',
    color: 'teal',
    bgLight: 'bg-teal-50 border-teal-200 text-teal-700 dark:bg-teal-950/40 dark:border-teal-800/50 dark:text-teal-300',
    badge: 'bg-teal-100 text-teal-800'
  },
  other: {
    label: 'Khác',
    icon: 'HelpCircle',
    color: 'slate',
    bgLight: 'bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300',
    badge: 'bg-slate-100 text-slate-800'
  }
};

export const SPECIES_LIST = [
  { id: 'dog', label: 'Chó', emoji: '🐶', icon: 'Dog' },
  { id: 'cat', label: 'Mèo', emoji: '🐱', icon: 'Cat' },
  { id: 'rabbit', label: 'Thỏ', emoji: '🐰', icon: 'Rabbit' },
  { id: 'hamster', label: 'Hamster / Chuột kiểng', emoji: '🐹', icon: 'Mouse' },
  { id: 'bird', label: 'Chim cảnh', emoji: '🦜', icon: 'Bird' },
  { id: 'other', label: 'Khác', emoji: '🐾', icon: 'PawPrint' }
];

export const DAILY_AI_TIPS = [
  {
    title: 'Thời tiết ấm lên - Đề phòng ve rận & bọ chét',
    petType: 'all',
    content: 'Khi độ ẩm và nhiệt độ tăng, trứng ve rận phát triển rất nhanh. Hãy kiểm tra kẽ tai, đệm bàn chân và định kỳ nhỏ gáy phòng ngừa cho thú cưng mỗi tháng 1 lần.',
    tag: 'Phòng bệnh'
  },
  {
    title: 'Chăm sóc răng miệng cho Chó Golden & các giống chó lớn',
    petType: 'dog',
    content: 'Trên 80% chó từ 3 tuổi trở lên có dấu hiệu viêm nha chu. Cho gặm xương đồ chơi chuyên dụng và đánh răng bằng kem đánh răng thú y vị thịt 2-3 lần/tuần để tránh hôi miệng.',
    tag: 'Răng miệng'
  },
  {
    title: 'Khuyến khích mèo uống nhiều nước để ngừa sỏi thận',
    petType: 'cat',
    content: 'Mèo có thói quen lười uống nước đọng. Sử dụng đài phun nước lưu động hoặc bổ sung pate ướt trộn nước ấm sẽ giúp giảm 70% nguy cơ viêm bàng quang và sỏi tiết niệu.',
    tag: 'Dinh dưỡng'
  }
];

// Danh mục Chi tiêu Thú cưng
export const EXPENSE_CATEGORIES = {
  food: { label: 'Thức ăn & Bánh thưởng', icon: 'Utensils', color: 'bg-emerald-100 text-emerald-800' },
  medical: { label: 'Khám thú y & Thuốc men', icon: 'Stethoscope', color: 'bg-blue-100 text-blue-800' },
  grooming: { label: 'Spa & Cắt tỉa lông', icon: 'Sparkles', color: 'bg-purple-100 text-purple-800' },
  toys: { label: 'Đồ chơi & Phụ kiện', icon: 'Gamepad2', color: 'bg-amber-100 text-amber-800' },
  vaccine: { label: 'Tiêm phòng vắc-xin', icon: 'Syringe', color: 'bg-teal-100 text-teal-800' },
  hygiene: { label: 'Vệ sinh & Cát vệ sinh', icon: 'Trash2', color: 'bg-rose-100 text-rose-800' },
  other: { label: 'Chi phí khác', icon: 'Receipt', color: 'bg-slate-100 text-slate-800' }
};

export const INITIAL_EXPENSES = [];

// Nhật ký sinh hoạt hàng ngày
export const INITIAL_DAILY_LOGS = [];

// Đơn thuốc đang điều trị
export const INITIAL_PRESCRIPTIONS = [];

// Danh bạ cứu hộ & bệnh viện thú y uy tín
export const PET_SERVICES = [
  {
    id: 'srv-1',
    name: 'Bệnh viện Thú y 2Vet Hospital',
    type: 'hospital',
    address: '335 Kim Ngưu, Hai Bà Trưng, Hà Nội',
    phone: '098 335 8126',
    hotline: '098 335 8126',
    is247: true,
    rating: 5.0,
    services: ['Cấp cứu 24/7', 'Phẫu thuật ngoại khoa', 'X-Quang & Siêu âm', 'Xét nghiệm sinh hóa máu', 'Khám nội trú']
  },
  {
    id: 'srv-2',
    name: 'Paddy Spa & Pet Grooming Lounge',
    type: 'spa',
    address: '88 Trần Não, P. An Khánh, TP. Thủ Đức',
    phone: '0938 123 789',
    hotline: '0938 123 789',
    is247: false,
    rating: 4.9,
    services: ['Tắm sấy tạo kiểu', 'Nhuộm lông an toàn', 'Vệ sinh tai móng', 'Khách sạn thú cưng']
  }
];

// Thành viên gia đình cùng đồng chăm sóc (Co-Parenting)
export const INITIAL_FAMILY_MEMBERS = [];

// Thói quen & Công việc hàng ngày (Daily Habits & Streak)
export const INITIAL_DAILY_HABITS = [];

// Đường cong tăng trưởng chuẩn của các giống loài (Growth Curves Standard)
export const BREED_GROWTH_STANDARDS = {
  'Golden Retriever': {
    species: 'dog',
    adultWeightRange: [25, 34], // kg
    monthlyStandards: [
      { month: 2, min: 4.5, max: 7.0, ideal: 5.8 },
      { month: 4, min: 11.0, max: 15.0, ideal: 13.0 },
      { month: 6, min: 18.0, max: 22.0, ideal: 20.0 },
      { month: 9, min: 22.0, max: 28.0, ideal: 25.0 },
      { month: 12, min: 25.0, max: 32.0, ideal: 28.5 },
      { month: 18, min: 26.0, max: 34.0, ideal: 30.0 },
      { month: 24, min: 27.0, max: 34.0, ideal: 30.5 }
    ],
    growthNotes: 'Chó Golden phát triển hệ khung xương mạnh nhất từ 3-8 tháng tuổi. Cần bổ sung Canxi Nano và Glucosamine để chống hạ bàn.'
  },
  'Mèo Anh Lông Ngắn (BSH)': {
    species: 'cat',
    adultWeightRange: [3.5, 6.5],
    monthlyStandards: [
      { month: 2, min: 0.8, max: 1.2, ideal: 1.0 },
      { month: 4, min: 1.6, max: 2.3, ideal: 2.0 },
      { month: 6, min: 2.4, max: 3.4, ideal: 2.9 },
      { month: 9, min: 3.2, max: 4.5, ideal: 3.8 },
      { month: 12, min: 3.5, max: 5.5, ideal: 4.4 },
      { month: 18, min: 3.8, max: 6.0, ideal: 4.8 },
      { month: 24, min: 4.0, max: 6.5, ideal: 5.0 }
    ],
    growthNotes: 'Mèo Anh lông ngắn có khung xương to, nọng má phúng phính. Cần kiểm soát lượng hạt sau khi triệt sản để tránh béo phì.'
  },
  'Thỏ Minilop': {
    species: 'rabbit',
    adultWeightRange: [1.4, 2.0],
    monthlyStandards: [
      { month: 2, min: 0.5, max: 0.8, ideal: 0.65 },
      { month: 4, min: 0.9, max: 1.3, ideal: 1.1 },
      { month: 6, min: 1.2, max: 1.7, ideal: 1.45 },
      { month: 12, min: 1.4, max: 2.0, ideal: 1.65 }
    ],
    growthNotes: 'Cần ăn 80% cỏ khô Timothy để mài răng cửa và bảo vệ hệ tiêu hóa.'
  }
};

