import fetch from 'node-fetch';
import { retrieveRelevantContext, initRagService } from '../server/ragService.js';

initRagService();

async function test() {
  const ret = await retrieveRelevantContext('Dùng kem đánh răng của người cho mèo được không?');
  const contextSnippet = ret.chunks.map((c, i) => `[Tài liệu ${i + 1}: ${c.title}]\n${c.text}`).join('\n\n');
  
  // Generic prompt hoàn toàn KHÔNG có bất kỳ quy tắc hay từ khóa cụ thể nào về kem đánh răng, 10% hay thuốc
  const messages = [
    {
      role: 'system',
      content: `Bạn là Trợ lý chăm sóc thú cưng PetCare. Dựa trên TÀI LIỆU THAM KHẢO và DỮ LIỆU THÚ CƯNG được cung cấp, hãy trả lời câu hỏi của người dùng bằng tiếng Việt một cách chính xác, ngắn gọn và hữu ích.
Nếu tài liệu có thông tin, hãy trả lời đúng theo nội dung và cảnh báo an toàn trong tài liệu. Không bịa đặt hoặc suy đoán thông tin y khoa.`
    },
    {
      role: 'user',
      content: `TÀI LIỆU THAM KHẢO:\n${contextSnippet}\n\nCÂU HỎI:\nDùng kem đánh răng của người cho mèo được không?`
    }
  ];

  const res = await fetch('http://127.0.0.1:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen2.5:1.5b',
      messages,
      stream: false,
      options: {
        num_ctx: 2048,
        temperature: 0.2,
        num_predict: 256,
        repeat_penalty: 1.15
      }
    })
  });

  const data = await res.json();
  console.log('REPLY TỪ MÔ HÌNH VỚI PROMPT TRUNG LẬP/TỔNG QUÁT:');
  console.log(data.message?.content);
}

test().catch(console.error);
