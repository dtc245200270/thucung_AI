import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import assert from 'assert';
import fs from 'fs';
import path from 'path';

import { JWT_SECRET } from '../server/config.js';
import { findUserById } from '../server/db.js';

const BACKEND_URL = 'http://127.0.0.1:5000';
const CHAT_HISTORY_FILE = path.join(process.cwd(), 'server', 'data', 'chat_history.json');

async function verifyLiveHttpChat() {
  console.log('================================================================');
  console.log('🌐 KIỂM THỬ TRỰC TIẾP ENDPOINT HTTP POST /api/data/chat');
  console.log('================================================================\n');

  // Sao lưu chat_history.json trước khi chạy để đảm bảo không lưu rác vào tài khoản
  let backupHistory = null;
  if (fs.existsSync(CHAT_HISTORY_FILE)) {
    backupHistory = fs.readFileSync(CHAT_HISTORY_FILE, 'utf8');
  }

  const existingUser = findUserById('user_1791541299976_7ebbe5');
  const token = jwt.sign({ 
    id: existingUser.id, 
    pwdChangedAt: existingUser.passwordChangedAt || null 
  }, JWT_SECRET, { expiresIn: '1h' });

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const DOG_ID = 'pet-1792128958474';
  const CAT_ID = 'pet-1792142788675';

  try {
    // 1. Cún: Nhắc tái khám
    console.log('--- 1. Cún: "Bé có nhắc tái khám khi nào?" ---');
    const res1 = await fetch(`${BACKEND_URL}/api/data/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message: 'Bé có nhắc tái khám khi nào?', petId: DOG_ID })
    });
    const json1 = await res1.json();
    console.log('HTTP Status:', res1.status);
    console.log('Status code in payload:', json1.status);
    console.log('Reply:', json1.reply);
    console.log('Sources:', json1.sources);

    assert.strictEqual(res1.status, 200);
    assert.strictEqual(json1.status, 'answered');
    assert.ok(json1.reply.includes('04/11/2026'), 'Phải có ngày 04/11/2026');
    assert.ok(json1.reply.includes('09:00'), 'Phải có giờ 09:00');
    assert.strictEqual(json1.sources[0]?.type, 'pet_schedule');
    assert.ok(!json1.sources.some(s => s.id.includes('CORNELL') || s.id.includes('AAHA')));
    console.log('-> [PASS] Lịch nhắc tái khám trả đủ ngày và giờ, nguồn chuẩn pet_schedule\n');

    // 2. Cún: Cân nặng
    console.log('--- 2. Cún: "Bé hiện nặng bao nhiêu" ---');
    const res2 = await fetch(`${BACKEND_URL}/api/data/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message: 'Bé hiện nặng bao nhiêu', petId: DOG_ID })
    });
    const json2 = await res2.json();
    console.log('Reply:', json2.reply);
    console.log('Sources:', json2.sources);

    assert.strictEqual(res2.status, 200);
    assert.strictEqual(json2.status, 'answered');
    assert.ok(json2.reply.includes('5.6 kg'), 'Phải có 5.6 kg');
    assert.ok(json2.reply.includes('16/10/2026'), 'Phải có ngày 16/10/2026');
    assert.strictEqual(json2.sources[0]?.type, 'pet_profile');
    console.log('-> [PASS] Cân nặng Cún trả đúng 5.6 kg và ngày ghi nhận\n');

    // 3. Mèo: Cân nặng chưa ghi nhận
    console.log('--- 3. Mèo: "Bé hiện nặng bao nhiêu?" ---');
    const res3 = await fetch(`${BACKEND_URL}/api/data/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message: 'Bé hiện nặng bao nhiêu?', petId: CAT_ID })
    });
    const json3 = await res3.json();
    console.log('Reply:', json3.reply);

    assert.strictEqual(res3.status, 200);
    assert.strictEqual(json3.status, 'answered');
    assert.ok(json3.reply.includes('chưa ghi nhận cân nặng') || json3.reply.includes('chưa cập nhật'));
    console.log('-> [PASS] Mèo báo đúng chưa ghi nhận cân nặng\n');

    // 4. Mèo: Đơn thuốc
    console.log('--- 4. Mèo: "Bé có đơn thuốc nào?" ---');
    const res4 = await fetch(`${BACKEND_URL}/api/data/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message: 'Bé có đơn thuốc nào?', petId: CAT_ID })
    });
    const json4 = await res4.json();
    console.log('Reply:', json4.reply);

    assert.strictEqual(res4.status, 200);
    assert.strictEqual(json4.status, 'answered');
    assert.ok(!json4.reply.includes('THUỐC KIỂM THỬ A'), 'Mèo không được có đơn của Cún');
    assert.ok(json4.reply.includes('chưa có đơn thuốc đã phát hành'));
    console.log('-> [PASS] Mèo không rò rỉ đơn thuốc của Cún\n');

    // 5. Hỏi đáp chung (petId = null): Hỏi dữ liệu cá nhân
    console.log('--- 5. Hỏi đáp chung: "Bé hiện nặng bao nhiêu?" ---');
    const res5 = await fetch(`${BACKEND_URL}/api/data/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message: 'Bé hiện nặng bao nhiêu?', petId: null })
    });
    const json5 = await res5.json();
    console.log('Reply:', json5.reply);

    assert.strictEqual(res5.status, 200);
    assert.strictEqual(json5.status, 'answered');
    assert.ok(json5.reply.includes('Hỏi đáp chung') && json5.reply.includes('chọn'));
    console.log('-> [PASS] Hỏi đáp chung yêu cầu chọn thú cưng trước khi tra cứu\n');

    // 6. Kiểm tra không lặp disclaimer
    const disclaimerMatches = (json1.reply.match(/Thông tin chỉ mang tính tham khảo/gi) || []).length;
    assert.strictEqual(disclaimerMatches, 0, 'Reply không được chứa disclaimer lặp lại');
    console.log('-> [PASS] Reply hoàn toàn sạch sẽ, không lặp disclaimer\n');

    console.log('================================================================');
    console.log('🎉 TẤT CẢ CÁC CA KIỂM TRA HTTP ENDPOINT ĐỀU THÀNH CÔNG 100%!');
    console.log('================================================================');

  } finally {
    // Phục hồi nguyên vẹn chat_history.json
    if (backupHistory !== null) {
      fs.writeFileSync(CHAT_HISTORY_FILE, backupHistory, 'utf8');
      console.log('\n🔒 [BẢO TOÀN DỮ LIỆU]: Đã khôi phục nguyên trạng server/data/chat_history.json.');
    }
  }
}

verifyLiveHttpChat().catch(err => {
  console.error('Lỗi kiểm tra live HTTP chat:', err);
  process.exit(1);
});
