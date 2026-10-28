import fetch from 'node-fetch';

async function testSingleVsMultiple() {
  const doc2 = `[Tài liệu 1: Chăm sóc răng miệng cho mèo]
Chải răng thường xuyên giúp hạn chế tích tụ mảng bám ở mèo. Dùng bàn chải và kem hoặc gel dành riêng cho mèo; không dùng kem đánh răng của người. Cho mèo làm quen từ từ thay vì ép. Hôi miệng, chảy dãi hoặc khó ăn có thể liên quan bệnh răng miệng và cần khám. Nếu nướu đang viêm hoặc đau, hỏi bác sĩ trước khi chải; không cố chải vùng đau.`;

  const doc8 = `[Tài liệu 2: Không tự dùng thuốc giảm đau của người cho chó mèo]
Không tự cho chó mèo dùng thuốc giảm đau của người hoặc thuốc còn thừa được kê cho con khác. Thuốc phù hợp với người hay thú cưng khác vẫn có thể gây hại cho con đang cần chăm sóc. Hãy liên hệ bác sĩ trước khi dùng thuốc; chatbot không cung cấp liều ibuprofen, paracetamol hoặc thuốc giảm đau thay thế. Nếu đã cho uống, liên hệ thú y ngay và cung cấp tên thuốc, hàm lượng, lượng đã dùng và thời điểm dùng.`;

  const query = 'Dùng kem đánh răng của người cho mèo được không?';

  // Case A: Chỉ gửi doc2 (top 1)
  console.log('--- CASE A: Chỉ gửi Doc 2 (Răng miệng) ---');
  const resA = await fetch('http://127.0.0.1:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen2.5:1.5b',
      messages: [
        {
          role: 'system',
          content: 'Bạn là Trợ lý chăm sóc thú cưng PetCare. Hãy trả lời câu hỏi của người dùng bằng tiếng Việt dựa vào tài liệu tham khảo được cung cấp. Nếu tài liệu không chứa câu trả lời, hãy nói chưa có thông tin.'
        },
        {
          role: 'user',
          content: `TÀI LIỆU:\n${doc2}\n\nCÂU HỎI:\n${query}`
        }
      ],
      stream: false,
      options: { temperature: 0.2, num_predict: 256 }
    })
  });
  console.log('Case A Output:', (await resA.json()).message?.content);

  // Case B: Gửi cả doc2 và doc8 (top 2)
  console.log('\n--- CASE B: Gửi cả Doc 2 và Doc 8 ---');
  const resB = await fetch('http://127.0.0.1:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen2.5:1.5b',
      messages: [
        {
          role: 'system',
          content: 'Bạn là Trợ lý chăm sóc thú cưng PetCare. Hãy trả lời câu hỏi của người dùng bằng tiếng Việt dựa vào tài liệu tham khảo được cung cấp. Nếu tài liệu không chứa câu trả lời, hãy nói chưa có thông tin.'
        },
        {
          role: 'user',
          content: `TÀI LIỆU:\n${doc2}\n\n${doc8}\n\nCÂU HỎI:\n${query}`
        }
      ],
      stream: false,
      options: { temperature: 0.2, num_predict: 256 }
    })
  });
  console.log('Case B Output:', (await resB.json()).message?.content);

  // Case C: Thử format prompt khác
  console.log('\n--- CASE C: Format rõ ràng Context + Question ---');
  const resC = await fetch('http://127.0.0.1:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen2.5:1.5b',
      messages: [
        {
          role: 'system',
          content: 'Bạn là trợ lý thú y PetCare. Hãy đọc kỹ các đoạn tài liệu sau đây để trả lời câu hỏi của chủ nuôi thú cưng.'
        },
        {
          role: 'user',
          content: `Dưới đây là tài liệu tham khảo:
"""
${doc2}

${doc8}
"""

Dựa vào tài liệu trên, hãy trả lời câu hỏi sau:
${query}`
        }
      ],
      stream: false,
      options: { temperature: 0.2, num_predict: 256 }
    })
  });
  console.log('Case C Output:', (await resC.json()).message?.content);
}

testSingleVsMultiple().catch(console.error);
