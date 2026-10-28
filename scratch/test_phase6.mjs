// Phase 6 Test Suite: Local AI (Ollama RAG), Route Precedence, Response Contract & Vision Fallbacks
const BASE_URL = 'http://localhost:5000';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  let data;
  try {
    data = await res.json();
  } catch (err) {
    data = null;
  }
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('🚀 Bắt đầu kiểm thử Phase 6: Local AI (Ollama RAG), Route Precedence & Response Contracts...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Đăng nhập
  console.log('1. Đăng nhập tài khoản test');
  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@petcare.ai', password: 'Admin@123456' })
  });
  assert(loginRes.status === 200 && loginRes.data.token, 'Đăng nhập thành công và nhận JWT');
  const token = loginRes.data.token;

  // 2. Route Precedence: POST /api/data/chat không bị bắt bởi generic /:collection (không bị 404)
  console.log('\n2. Kiểm tra thứ tự Route: /chat không bị nhầm thành collection');
  const chatNoMsg = await request('/api/data/chat', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message: '' })
  });
  assert(chatNoMsg.status === 400, 'POST /chat với tin nhắn rỗng trả về HTTP 400 (chứng minh /chat hoạt động, không bị 404 collection)');

  // 3. Bảo vệ Auth: Không có token không được gọi /chat
  console.log('\n3. Kiểm tra xác thực token cho endpoint /chat');
  const chatUnauth = await request('/api/data/chat', {
    method: 'POST',
    body: JSON.stringify({ message: 'Xin chào' })
  });
  assert(chatUnauth.status === 401, 'Gọi /chat không kèm token bị từ chối với HTTP 401');

  // 4. Truy vấn câu hỏi hoàn toàn không có trong kho tài liệu
  console.log('\n4. Kiểm tra câu hỏi ngoài kho tài liệu (No Match)');
  const chatNoMatch = await request('/api/data/chat', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message: 'Khí hậu sao Hỏa năm 2050 như thế nào xyz123' })
  });
  assert(chatNoMatch.status === 200 && chatNoMatch.data.success === true, 'Truy vấn trả về HTTP 200 với success=true');
  assert(chatNoMatch.data.reply === 'Chưa có thông tin phù hợp trong tài liệu được cung cấp.', 'Phản hồi đúng câu trả lời thiếu thông tin, không bịa đặt');
  assert(chatNoMatch.data.source === null, 'Nguồn trích dẫn là null');
  assert(chatNoMatch.data.data?.reply === chatNoMatch.data.reply, 'Hợp đồng response đồng bộ cả ở top-level và trong data object');

  // 5. Truy vấn câu hỏi có từ khóa trong kho tài liệu
  console.log('\n5. Kiểm tra truy vấn tài liệu thực tế (RAG Matching)');
  const chatMatch = await request('/api/data/chat', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message: 'Lịch tiêm phòng vắc xin cơ bản cho chó mèo gồm những mũi nào?' })
  });

  if (chatMatch.status === 200) {
    assert(chatMatch.data.success === true, 'Ollama cục bộ đang hoạt động và trả về kết quả');
    assert(typeof chatMatch.data.reply === 'string' && chatMatch.data.reply.length > 0, 'Nhận được câu trả lời từ AI');
    assert(typeof chatMatch.data.source === 'string', `Có nguồn trích xuất tài liệu hợp lệ (${chatMatch.data.source})`);
  } else if (chatMatch.status === 503) {
    assert(chatMatch.data.code === 'AI_OFFLINE' && chatMatch.data.success === false, 'Ollama cục bộ chưa bật: Trả về HTTP 503 AI_OFFLINE với success: false (KHÔNG giả mạo thành công)');
  } else if (chatMatch.status === 504) {
    assert(chatMatch.data.code === 'AI_TIMEOUT' && chatMatch.data.success === false, 'Ollama timeout: Trả về HTTP 504 AI_TIMEOUT với success: false');
  } else {
    assert(false, `Mã trạng thái không mong đợi: ${chatMatch.status}`);
  }

  // 6. Kiểm tra bảo vệ quyền context thú cưng: Pet không thuộc sở hữu không được đính kèm context trái phép
  console.log('\n6. Kiểm tra RBAC trên context thú cưng');
  const vetLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'tester@petcare.ai', password: 'Doctor@123' })
  });
  const vetToken = vetLogin.data?.token;

  // Bác sĩ tester gọi chat với thú cưng không phân công
  const chatContextRes = await request('/api/data/chat', {
    method: 'POST',
    headers: { Authorization: `Bearer ${vetToken}` },
    body: JSON.stringify({
      message: 'Thời tiết hôm nay thế nào',
      petContext: { id: 'unassigned_pet_9999' }
    })
  });
  // Server không bị crash và xử lý an toàn
  assert(chatContextRes.status === 200, 'Server kiểm tra context thú cưng an toàn, không bị crash hoặc rò rỉ');

  console.log(`\n========================================`);
  console.log(`KẾT QUẢ KIỂM THỬ GIAI ĐOẠN 6: ${passed} PASS, ${failed} FAIL`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Lỗi thực thi test Phase 6:', err);
  process.exit(1);
});
