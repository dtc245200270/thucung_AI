import assert from 'assert';
import { 
  getPetContextForChat, 
  detectPetQueryIntent, 
  queryPetStructuredData,
  processChatConsultation,
  formatDateVi,
  getVietnamNow
} from '../server/chatService.js';

console.log('================================================================');
console.log('🧪 BẮT ĐẦU KIỂM THỬ CÔ LẬP LUỒNG TRUY VẤN DỮ LIỆU THÚ CƯNG');
console.log('================================================================\n');

const OWNER_USER = { id: 'user_1791541299976_7ebbe5', role: 'pet_owner' };
const DOG_PET_ID = 'pet-1792128958474'; // Cún Kiểm Thử
const CAT_PET_ID = 'pet-1792142788675'; // Mèo Kiểm Thử
const INTRUDER_USER = { id: 'user_stranger_intruder', role: 'pet_owner' };

let passed = 0;
let total = 0;

function runSync(name, fn) {
  total++;
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}:`, err.message);
  }
}

async function runAsync(name, fn) {
  total++;
  try {
    await fn();
    console.log(`✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}:`, err.message);
  }
}

// 1. Kiểm tra Helper định dạng ngày Việt Nam
runSync('1. formatDateVi định dạng đúng DD/MM/YYYY', () => {
  assert.strictEqual(formatDateVi('2026-11-04'), '04/11/2026');
  assert.strictEqual(formatDateVi('2026-10-28T07:58:58.845Z'), '28/10/2026');
});

// 2. Nhận diện intent câu hỏi
runSync('2.1. Nhận diện câu hỏi cân nặng', () => {
  const i1 = detectPetQueryIntent('Bé nặng bao nhiêu kg?');
  assert.strictEqual(i1.isWeight, true);
  assert.strictEqual(i1.isAskingPersonalData, true);
  assert.strictEqual(i1.isCombinedWithCare, false);

  const i2 = detectPetQueryIntent('Cân nặng hiện tại của bé là mấy cân?');
  assert.strictEqual(i2.isWeight, true);
});

runSync('2.2. Nhận diện câu hỏi lịch tái khám & lịch hẹn', () => {
  const i1 = detectPetQueryIntent('Bé có lịch nhắc tái khám khi nào?');
  assert.strictEqual(i1.isSchedule, true);
  assert.strictEqual(i1.isAskingPersonalData, true);

  const i2 = detectPetQueryIntent('Khi nào thì đi khám tiếp?');
  assert.strictEqual(i2.isSchedule, true);
});

runSync('2.3. Nhận diện câu hỏi đơn thuốc', () => {
  const i1 = detectPetQueryIntent('Bé có đơn thuốc nào không?');
  assert.strictEqual(i1.isPrescription, true);

  const i2 = detectPetQueryIntent('Bé đang uống thuốc gì?');
  assert.strictEqual(i2.isPrescription, true);
});

runSync('2.4. Nhận diện câu hỏi kết hợp (Personal data + Care advice)', () => {
  const i1 = detectPetQueryIntent('Bé Cún nặng 5.6kg thì cho ăn bánh thưởng bao nhiêu là vừa?');
  assert.strictEqual(i1.isWeight, true);
  assert.strictEqual(i1.isCombinedWithCare, true);
});

runSync('2.5. Nhận diện lệch loài (Species mismatch)', () => {
  const petDog = { name: 'Cún Kiểm Thử', species: 'dog' };
  const iMismatch = detectPetQueryIntent('Mèo nhà tôi nặng bao nhiêu kg?', petDog);
  assert.ok(iMismatch.speciesMismatch);
  assert.strictEqual(iMismatch.speciesMismatch.current, 'Chó');
  assert.strictEqual(iMismatch.speciesMismatch.target, 'Mèo');
});

// 3. Phân quyền truy cập hồ sơ
runSync('3.1. Chặn người dùng lạ truy cập dữ liệu thú cưng', () => {
  assert.throws(() => {
    queryPetStructuredData(DOG_PET_ID, INTRUDER_USER, { isWeight: true });
  }, /không có quyền truy cập/i);
});

// 4. Truy vấn cân nặng Cún và Mèo
runSync('4.1. Cún: Cân nặng ghi nhận 5.6 kg và ngày 16/10/2026', () => {
  const res = queryPetStructuredData(DOG_PET_ID, OWNER_USER, { isWeight: true });
  assert.ok(res.reply.includes('5.6 kg'), 'Phải chứa 5.6 kg');
  assert.ok(res.reply.includes('16/10/2026'), 'Phải chứa ngày 16/10/2026');
  assert.ok(!res.reply.includes('Chưa ghi nhận'), 'Cún đã có cân nặng, không được báo chưa ghi nhận');
  assert.strictEqual(res.sources[0].type, 'pet_profile');
  assert.ok(!res.sources.some(s => s.id === 'SRC-AAHA-NUTRITION' || s.id === 'SRC-CORNELL-DENTAL'));
});

runSync('4.2. Mèo: Chưa ghi nhận cân nặng', () => {
  const res = queryPetStructuredData(CAT_PET_ID, OWNER_USER, { isWeight: true });
  assert.ok(res.reply.includes('chưa ghi nhận cân nặng') || res.reply.includes('chưa cập nhật'), 'Mèo phải báo chưa ghi nhận cân nặng');
  assert.strictEqual(res.sources[0].type, 'pet_profile');
});

// 5. Truy vấn lịch nhắc tái khám & lịch hẹn
runSync('5.1. Cún: Lịch nhắc tái khám trả đủ ngày 04/11/2026 VÀ giờ 09:00', () => {
  const res = queryPetStructuredData(DOG_PET_ID, OWNER_USER, { isSchedule: true, originalMessage: 'Bé có lịch nhắc tái khám khi nào?' });
  assert.ok(res.reply.includes('04/11/2026'), 'Phải có ngày 04/11/2026');
  assert.ok(res.reply.includes('09:00'), 'Phải có giờ 09:00');
  assert.ok(res.reply.includes('Nhắc tái khám kiểm thử'), 'Phải có tiêu đề lịch nhắc');
  assert.strictEqual(res.sources[0].type, 'pet_schedule');
  assert.ok(!res.sources.some(s => s.id.includes('CORNELL') || s.id.includes('AAHA')));
});

runSync('5.2. Mèo: Không có lịch tái khám của Cún', () => {
  const res = queryPetStructuredData(CAT_PET_ID, OWNER_USER, { isSchedule: true, originalMessage: 'Bé có lịch nhắc tái khám khi nào?' });
  assert.ok(!res.reply.includes('Nhắc tái khám kiểm thử – Cún Kiểm Thử'), 'Mèo không được có lịch của Cún');
  assert.ok(res.reply.includes('chưa có lịch nhắc tái khám') || res.reply.includes('chưa có lịch nhắc chăm sóc'));
});

// 6. Truy vấn đơn thuốc
runSync('6.1. Cún: Có 1 đơn thuốc đã chốt "THUỐC KIỂM THỬ A – KHÔNG SỬ DỤNG"', () => {
  const res = queryPetStructuredData(DOG_PET_ID, OWNER_USER, { isPrescription: true });
  assert.ok(res.reply.includes('THUỐC KIỂM THỬ A – KHÔNG SỬ DỤNG'));
  assert.ok(res.reply.includes('BS. Nguyễn Văn A'));
  assert.strictEqual(res.sources[0].type, 'pet_prescription');
});

runSync('6.2. Mèo: Không có đơn thuốc của Cún', () => {
  const res = queryPetStructuredData(CAT_PET_ID, OWNER_USER, { isPrescription: true });
  assert.ok(!res.reply.includes('THUỐC KIỂM THỬ A – KHÔNG SỬ DỤNG'), 'Mèo không được rò rỉ đơn thuốc của Cún');
  assert.ok(res.reply.includes('chưa có đơn thuốc đã phát hành'));
});

// 7. End-to-End Chat Consultation với xử lý phiên & Hỏi đáp chung
await runAsync('7.1. Khi chưa chọn pet (Hỏi đáp chung): Hỏi cân nặng -> Yêu cầu chọn pet', async () => {
  const res = await processChatConsultation({
    userId: OWNER_USER.id,
    userRole: OWNER_USER.role,
    message: 'Bé nặng bao nhiêu kg?',
    petId: null // Hỏi đáp chung
  });

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.status, 'answered');
  assert.ok(res.reply.includes('Hỏi đáp chung') || res.reply.includes('chọn'));
  assert.strictEqual(res.sources.length, 0, 'Sources phải rỗng khi chỉ hướng dẫn');
});

await runAsync('7.2. Khi chọn Cún nhưng hỏi về Mèo -> Yêu cầu chuyển hồ sơ', async () => {
  const res = await processChatConsultation({
    userId: OWNER_USER.id,
    userRole: OWNER_USER.role,
    message: 'Mèo nhà tôi nặng bao nhiêu kg?',
    petId: DOG_PET_ID // Đang chọn Cún
  });

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.status, 'answered');
  assert.ok(res.reply.includes('Cún Kiểm Thử') && (res.reply.includes('mèo') || res.reply.includes('Mèo')));
});

await runAsync('7.3. Cún: Hỏi nhắc tái khám -> Trả đủ ngày 04/11/2026 và giờ 09:00', async () => {
  const res = await processChatConsultation({
    userId: OWNER_USER.id,
    userRole: OWNER_USER.role,
    message: 'Bé có lịch nhắc tái khám khi nào?',
    petId: DOG_PET_ID
  });

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.status, 'answered');
  assert.ok(res.reply.includes('04/11/2026'), 'Phải có ngày 04/11/2026');
  assert.ok(res.reply.includes('09:00'), 'Phải có giờ 09:00');
  assert.strictEqual(res.sources[0].type, 'pet_schedule');
  assert.ok(!res.sources.some(s => s.id.includes('CORNELL') || s.id.includes('AAHA')));
});

await runAsync('7.4. Bảo toàn câu hỏi RAG kem đánh răng (không bị hồi quy)', async () => {
  const res = await processChatConsultation({
    userId: 'test-eval-non-regress',
    userRole: 'pet_owner',
    message: 'Dùng kem đánh răng của người cho mèo được không?',
    petId: null
  });

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.status, 'answered');
  assert.ok(res.sources.some(s => s.id === 'SRC-CORNELL-DENTAL'));
  assert.ok(res.reply.toLowerCase().includes('không') || res.reply.toLowerCase().includes('tránh'));
});

console.log(`\n================================================================`);
console.log(`📊 TỔNG KẾT: ${passed}/${total} tests PASSED!`);
console.log('================================================================\n');
