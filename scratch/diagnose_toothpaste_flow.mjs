import fetch from 'node-fetch';
import { retrieveRelevantContext, initRagService, getDocuments } from '../server/ragService.js';
import { processChatConsultation } from '../server/chatService.js';

async function diagnoseToothpaste() {
  console.log('=== CHẨN ĐOÁN TOÀN LUỒNG CÂU HỎI KEM ĐÁNH RĂNG ===\n');

  initRagService();

  const query = 'Dùng kem đánh răng của người cho mèo được không?';
  console.log(`Câu hỏi chẩn đoán: "${query}"\n`);

  // 1. Kiểm tra tài liệu PC-KB-002 trên đĩa
  const doc2 = getDocuments().find(d => d.id === 'PC-KB-002');
  console.log('1. Tài liệu PC-KB-002:');
  console.log('   - Title:', doc2?.title);
  console.log('   - Enabled:', doc2?.enabled);
  console.log('   - Content:', doc2?.content);
  console.log('   - Có chứa "không dùng kem đánh răng của người":', doc2?.content?.includes('không dùng kem đánh răng của người'));

  // 2. Chạy retrieval trực tiếp
  console.log('\n2. Chạy retrieveRelevantContext(query, { petSpecies: "cat" }):');
  const retRes = await retrieveRelevantContext(query, {
    petSpecies: 'cat',
    topK: 2,
    threshold: 0.48
  });

  console.log('   - Method:', retRes.method);
  console.log('   - Chunks count:', retRes.chunks?.length);
  console.log('   - Max score:', retRes.maxScore);
  retRes.chunks?.forEach((c, idx) => {
    console.log(`     Chunk ${idx + 1}: [${c.docId}] "${c.title}" (Score: ${(c.score || 0).toFixed(4)})`);
    console.log(`     Snippet: ${c.text?.substring(0, 100)}...`);
  });
  console.log('   - Sources:', retRes.sources?.map(s => `${s.id}: ${s.title}`));

  // 3. Test trực tiếp gọi Ollama với context này
  console.log('\n3. Kiểm tra phản hồi thô của Qwen2.5:1.5b khi nhận context này:');
  const contextSnippet = retRes.chunks?.map((c, i) => `[Đoạn ${i + 1} - ${c.title}]:\n${c.text}`).join('\n\n') || '';
  
  const systemPrompt = `Bạn là "Trợ lý chăm sóc thú cưng" của hệ thống PetCare PRO AI.
Hãy trả lời câu hỏi của người dùng BẰNG TIẾNG VIỆT một cách NGẮN GỌN, CHUẨN XÁC, ÂN CẦN.

QUY TẮC BẮT BUỘC ĐỂ TRÁNH ẢO GIÁC:
1. Bạn CHỈ ĐƯỢC SỬ DỤNG thông tin có trong mục TÀI LIỆU THAM KHẢO CHÍNH THỨC bên dưới.
2. Với câu hỏi về kem đánh răng: Không dùng kem đánh răng người cho mèo, dùng sản phẩm riêng cho mèo.
3. Nếu tài liệu không đủ thông tin để trả lời câu hỏi, hãy nói "Chưa có thông tin phù hợp trong tài liệu được cung cấp."
4. Luôn giữ ghi chú ở cuối: "Thông tin chỉ mang tính tham khảo, không thay thế khám thú y."

=== TÀI LIỆU THAM KHẢO CHÍNH THỨC ===
${contextSnippet}
====================================`;

  const ollamaRes = await fetch('http://127.0.0.1:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen2.5:1.5b',
      prompt: query,
      system: systemPrompt,
      stream: false,
      options: {
        num_ctx: 2048,
        temperature: 0.2,
        num_predict: 512,
        repeat_penalty: 1.15
      }
    })
  });

  const ollamaData = await ollamaRes.json();
  console.log('   - Raw response từ Qwen2.5:1.5b:');
  console.log(ollamaData.response);

  // 4. Test gọi qua processChatConsultation
  console.log('\n4. Gọi qua processChatConsultation({ message: query }):');
  const consultRes = await processChatConsultation({
    userId: 'diag_test_user',
    userRole: 'pet_owner',
    message: query,
    petId: null
  });
  console.log('   - Success:', consultRes.success);
  console.log('   - Reply:\n' + consultRes.reply);
  console.log('   - Sources:', consultRes.sources?.map(s => s.id));
}

diagnoseToothpaste().catch(console.error);
