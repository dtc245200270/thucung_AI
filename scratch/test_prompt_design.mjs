import fetch from 'node-fetch';
import { retrieveRelevantContext, initRagService } from '../server/ragService.js';

async function testPromptDesign() {
  initRagService();

  const testCases = [
    {
      label: '1. Kem đánh răng người cho mèo (Trực tiếp)',
      species: 'cat',
      query: 'Dùng kem đánh răng của người cho mèo được không?',
      expectedToFind: true,
      docId: 'PC-KB-002'
    },
    {
      label: '2. Kem đánh răng người cho mèo (Diễn đạt khác)',
      species: 'cat',
      query: 'Có thể lấy kem đánh răng của mình chải cho mèo không?',
      expectedToFind: true,
      docId: 'PC-KB-002'
    },
    {
      label: '3. Giới hạn đồ ăn thưởng cho mèo',
      species: 'cat',
      query: 'Cho mèo ăn thưởng bao nhiêu là vừa?',
      expectedToFind: true,
      docId: 'PC-KB-001'
    },
    {
      label: '4. Tẩy giun chung cho thú cưng',
      species: null,
      query: 'Có một lịch tẩy giun định kỳ chung cho mọi chó mèo không?',
      expectedToFind: true,
      docId: 'PC-KB-003'
    },
    {
      label: '5. Thuốc giảm đau của người cho chó mèo',
      species: 'dog',
      query: 'Chó bị đau chân có uống được thuốc giảm đau panadol hay paracetamol của người không?',
      expectedToFind: true,
      docId: 'PC-KB-008'
    },
    {
      label: '6. Ngoài phạm vi tài liệu (Vaccine cho thỏ)',
      species: 'rabbit',
      query: 'Lịch tiêm vaccine cho thỏ kiểng như thế nào?',
      expectedToFind: false
    }
  ];

  console.log('=== THỬ NGHIỆM PROMPT THIẾT KẾ CHO QWEN2.5:1.5B ===\n');

  for (const tc of testCases) {
    console.log(`\n======================================================`);
    console.log(`TEST: ${tc.label}`);
    console.log(`Câu hỏi: "${tc.query}"`);

    // Retrieval
    const ret = await retrieveRelevantContext(tc.query, {
      petSpecies: tc.species,
      topK: 2,
      threshold: 0.45
    });

    console.log(`Retrieval: method=${ret.method}, chunks=${ret.chunks.length}, maxScore=${ret.maxScore?.toFixed(4)}`);
    ret.chunks.forEach((c, idx) => console.log(`  - Chunk ${idx + 1}: [${c.docId}] ${c.title} (${c.score?.toFixed(4)})`));

    // Nếu không tìm thấy chunk nào
    if (!ret.chunks || ret.chunks.length === 0) {
      console.log('-> [INSUFFICIENT_EVIDENCE] RAG không tìm thấy tài liệu phù hợp (Đạt yêu cầu ngoài phạm vi).');
      continue;
    }

    const contextSnippet = ret.chunks.map((c, i) => `[Tài liệu ${i + 1}: ${c.title}]\n${c.text}`).join('\n\n');

    // Cấu trúc prompt tối ưu cho Qwen2.5 (ChatML format)
    const messages = [
      {
        role: 'system',
        content: `Bạn là "Trợ lý chăm sóc thú cưng" của hệ thống PetCare.
Nhiệm vụ: Trả lời câu hỏi của người nuôi thú cưng bằng tiếng Việt một cách chính xác, ngắn gọn, súc tích.
Quy tắc:
1. Dựa trên TÀI LIỆU THAM KHẢO được cung cấp trong câu hỏi để trả lời.
2. Nếu tài liệu trả lời trực tiếp câu hỏi (ví dụ: không dùng kem đánh răng người cho mèo, đồ ăn thưởng không quá 10%, không có lịch tẩy giun chung, tuyệt đối không dùng thuốc giảm đau người), hãy nêu rõ câu trả lời kèm lý do từ tài liệu.
3. Nếu tài liệu không chứa thông tin để trả lời câu hỏi, hãy nói rõ: "Chưa có thông tin phù hợp trong tài liệu được cung cấp."`
      },
      {
        role: 'user',
        content: `TÀI LIỆU THAM KHẢO:
${contextSnippet}

CÂU HỎI:
${tc.query}`
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
          temperature: 0.2,
          num_predict: 256,
          repeat_penalty: 1.15
        }
      })
    });

    const data = await res.json();
    const reply = data.message?.content || '';
    console.log(`-> QWEN2.5 PHẢN HỒI:\n${reply.trim()}`);
  }
}

testPromptDesign().catch(console.error);
