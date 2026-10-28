import fetch from 'node-fetch';

async function testPromptVariations() {
  const query = 'Dùng kem đánh răng của người cho mèo được không?';
  const context = `[Tài liệu 1: Chăm sóc răng miệng cho mèo]
Chải răng thường xuyên giúp hạn chế tích tụ mảng bám ở mèo. Dùng bàn chải và kem hoặc gel dành riêng cho mèo; không dùng kem đánh răng của người. Cho mèo làm quen từ từ thay vì ép. Hôi miệng, chảy dãi hoặc khó ăn có thể liên quan bệnh răng miệng và cần khám. Nếu nướu đang viêm hoặc đau, hỏi bác sĩ trước khi chải; không cố chải vùng đau.`;

  console.log('--- TEST 1: Dùng /api/chat (chuẩn ChatML của Qwen) thay vì /api/generate ---');
  const chatMLRes = await fetch('http://127.0.0.1:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen2.5:1.5b',
      messages: [
        {
          role: 'system',
          content: `Bạn là trợ lý AI chăm sóc thú cưng PetCare.
Hãy trả lời câu hỏi của người dùng bằng tiếng Việt, dựa vào tài liệu tham khảo dưới đây.

TÀI LIỆU THAM KHẢO:
${context}

QUY TẮC:
- Trả lời đúng trọng tâm câu hỏi dựa trên thông tin trong tài liệu.
- Nếu tài liệu không có thông tin liên quan đến câu hỏi, trả lời: "Chưa có thông tin phù hợp trong tài liệu được cung cấp."`
        },
        {
          role: 'user',
          content: query
        }
      ],
      stream: false,
      options: {
        temperature: 0.2,
        num_predict: 256
      }
    })
  });
  const chatData = await chatMLRes.json();
  console.log('Kết quả Test 1 (/api/chat):');
  console.log(chatData.message?.content);

  console.log('\n--- TEST 2: Thử /api/generate với prompt hiện tại trong chatService.js ---');
  const currentSystemPrompt = `Bạn là "Trợ lý chăm sóc thú cưng" của hệ thống PetCare PRO AI.
Hãy trả lời câu hỏi của người dùng BẰNG TIẾNG VIỆT một cách NGẮN GỌN, CHUẨN XÁC, ÂN CẦN.

QUY TẮC BẮT BUỘC ĐỂ TRÁNH ẢO GIÁC:
1. Bạn CHỈ ĐƯỢC SỬ DỤNG thông tin có trong mục TÀI LIỆU THAM KHẢO CHÍNH THỨC và DỮ LIỆU THÚ CƯNG bên dưới.
2. Với câu hỏi về cân nặng, lịch khám, đơn thuốc của thú cưng: Trả lời chính xác theo DỮ LIỆU THÚ CƯNG. Nếu dữ liệu ghi "Chưa cập nhật" thì trả lời đúng là chưa cập nhật, không được bịa số liệu.
3. Với câu hỏi về dinh dưỡng, ăn thưởng: Phân biệt rõ phần thưởng không quá 10% tổng năng lượng hằng ngày, không suy số gam chỉ từ cân nặng.
4. Với câu hỏi về kem đánh răng: Không dùng kem đánh răng người cho mèo, dùng sản phẩm riêng cho mèo.
5. Với câu hỏi về tẩy giun: Không có một lịch chung cho mọi thú cưng, cần đánh giá nguy cơ từng con.
6. Với trường hợp khẩn cấp (khó thở, rặn tiểu không ra nước tiểu): Luôn khuyên đưa đi cơ sở thú y cấp cứu ngay lập tức, không chờ qua đêm.
7. Tuyệt đối KHÔNG tính liều thuốc người (Paracetamol, Ibuprofen...) hoặc kê đơn thuốc.
8. Nếu tài liệu không đủ thông tin để trả lời câu hỏi, hãy nói "Chưa có thông tin phù hợp trong tài liệu được cung cấp."
9. Không hiển thị suy nghĩ nội bộ (không sinh thẻ <think>).
10. Luôn giữ ghi chú ở cuối: "Thông tin chỉ mang tính tham khảo, không thay thế khám thú y."

=== TÀI LIỆU THAM KHẢO CHÍNH THỨC ===
${context}
====================================`;

  const genRes = await fetch('http://127.0.0.1:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen2.5:1.5b',
      prompt: query,
      system: currentSystemPrompt,
      stream: false,
      options: {
        num_ctx: 2048,
        temperature: 0.2,
        num_predict: 512
      }
    })
  });
  const genData = await genRes.json();
  console.log('Kết quả Test 2 (/api/generate với system prompt hiện tại):');
  console.log(genData.response);

  console.log('\n--- TEST 3: Đưa câu hỏi và context vào /api/chat theo chuẩn User message ---');
  const chat2Res = await fetch('http://127.0.0.1:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen2.5:1.5b',
      messages: [
        {
          role: 'system',
          content: 'Bạn là Trợ lý chăm sóc thú cưng PetCare. Nhiệm vụ của bạn là đọc tài liệu tham khảo và trả lời câu hỏi của người dùng bằng tiếng Việt một cách chính xác, ngắn gọn và hữu ích. Chỉ trả lời dựa trên tài liệu được cung cấp. Nếu tài liệu không đề cập đến vấn đề được hỏi, mới trả lời là chưa có thông tin phù hợp.'
        },
        {
          role: 'user',
          content: `TÀI LIỆU THAM KHẢO:
${context}

CÂU HỎI CỦA TÔI:
${query}`
        }
      ],
      stream: false,
      options: {
        temperature: 0.2,
        num_predict: 256
      }
    })
  });
  const chat2Data = await chat2Res.json();
  console.log('Kết quả Test 3:');
  console.log(chat2Data.message?.content);
}

testPromptVariations().catch(console.error);
