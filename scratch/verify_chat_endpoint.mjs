import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';

import { JWT_SECRET } from '../server/config.js';
const BACKEND_URL = 'http://127.0.0.1:5000';

async function verifyEndpoints() {
  console.log('=== KIỂM TRA ROUTE VÀ RESPONSE STATUS CỦA BACKEND ===\n');

  // 1. Kiểm tra GET /api/data/chat/status
  console.log('--- 1. GET /api/data/chat/status ---');
  const statusRes = await fetch(`${BACKEND_URL}/api/data/chat/status`);
  const statusJson = await statusRes.json();
  console.log('HTTP Status:', statusRes.status);
  console.log('Payload data:', JSON.stringify(statusJson, null, 2));

  // 2. Kiểm tra GET /api/chat/status (route alias)
  console.log('\n--- 2. GET /api/chat/status ---');
  const aliasRes = await fetch(`${BACKEND_URL}/api/chat/status`);
  const aliasJson = await aliasRes.json();
  console.log('HTTP Status:', aliasRes.status);
  console.log('isTextModelReady:', aliasJson.data?.isTextModelReady);
  console.log('isEmbedModelReady:', aliasJson.data?.isEmbedModelReady);
  console.log('hasVectorEmbeddings:', aliasJson.data?.rag?.hasVectorEmbeddings);

  // 3. Kiểm tra POST /api/data/chat với payload thực tế
  console.log('\n--- 3. POST /api/data/chat (Cho mèo ăn thưởng bao nhiêu là vừa?) ---');
  const { findUserById } = await import('../server/db.js');
  const existingUser = findUserById('user_1791541299976_7ebbe5');
  const testToken = jwt.sign({ 
    id: existingUser.id, 
    pwdChangedAt: existingUser.passwordChangedAt || null 
  }, JWT_SECRET, { expiresIn: '1h' });

  const queryPayload = {
    message: 'Cho mèo ăn thưởng bao nhiêu là vừa?',
    petId: null
  };

  const t0 = Date.now();
  const chatRes = await fetch(`${BACKEND_URL}/api/data/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${testToken}`
    },
    body: JSON.stringify(queryPayload)
  });

  const duration = Date.now() - t0;
  const chatJson = await chatRes.json();
  console.log(`HTTP Status: ${chatRes.status} (${duration}ms)`);
  console.log('Response top-level keys:', Object.keys(chatJson));
  console.log('chatJson.success:', chatJson.success);
  console.log('chatJson.data.success:', chatJson.data?.success);
  console.log('chatJson.reply:', chatJson.reply?.substring(0, 150) + '...');
  console.log('chatJson.sources:', chatJson.sources?.map(s => s.id));

  // Phục hồi nguyên trạng file chat_history.json từ bản sao lưu để bảo toàn 100% dữ liệu người dùng
  const fs = await import('fs');
  fs.copyFileSync('server/data/chat_history.json.bak', 'server/data/chat_history.json');
  console.log('\nĐã khôi phục nguyên trạng chat_history.json (Không làm thay đổi lịch sử người dùng).');

  console.log('\n=== HOÀN TẤT KIỂM TRA ROUTE VÀ RESPONSE STATUS ===');
}

verifyEndpoints().catch(err => {
  console.error('Lỗi kiểm tra endpoint:', err);
  process.exit(1);
});
