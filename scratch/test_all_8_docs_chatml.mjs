import fetch from 'node-fetch';
import { retrieveRelevantContext, initRagService, getDocuments } from '../server/ragService.js';

async function testAll8Documents() {
  initRagService();

  const testSuite = [
    // 1. PC-KB-001: Dinh dưỡng & đồ ăn thưởng
    {
      docId: 'PC-KB-001',
      label: 'PC-KB-001 (Trực tiếp): Đồ ăn thưởng cho mèo',
      species: 'cat',
      query: 'Cho mèo ăn thưởng bao nhiêu là vừa?',
      keyPoints: ['10%', 'năng lượng']
    },
    {
      docId: 'PC-KB-001',
      label: 'PC-KB-001 (Diễn đạt khác): Snack cho chó',
      species: 'dog',
      query: 'Có thể cho chó ăn snack thoải mái được không và tính lượng thế nào?',
      keyPoints: ['10%', 'khẩu phần']
    },

    // 2. PC-KB-002: Răng miệng cho mèo
    {
      docId: 'PC-KB-002',
      label: 'PC-KB-002 (Trực tiếp): Kem đánh răng người cho mèo',
      species: 'cat',
      query: 'Dùng kem đánh răng của người cho mèo được không?',
      keyPoints: ['không', 'người', 'riêng']
    },
    {
      docId: 'PC-KB-002',
      label: 'PC-KB-002 (Diễn đạt khác): Lấy kem đánh răng của mình chải cho mèo',
      species: 'cat',
      query: 'Có thể lấy kem đánh răng của mình chải cho mèo không?',
      keyPoints: ['không', 'dành riêng']
    },

    // 3. PC-KB-003: Lịch tẩy giun theo nguy cơ
    {
      docId: 'PC-KB-003',
      label: 'PC-KB-003 (Trực tiếp): Lịch tẩy giun chung',
      species: null,
      query: 'Có lịch tẩy giun chung áp dụng cho mọi chó mèo không?',
      keyPoints: ['không', 'nguy cơ']
    },
    {
      docId: 'PC-KB-003',
      label: 'PC-KB-003 (Diễn đạt khác): Bao lâu tẩy giun một lần cho tất cả thú cưng',
      species: null,
      query: 'Bao lâu thì tẩy giun định kỳ một lần cho tất cả thú cưng theo quy định chung?',
      keyPoints: ['không có lịch chung', 'nguy cơ']
    },

    // 4. PC-KB-004: Khó thở (Cấp cứu)
    {
      docId: 'PC-KB-004',
      label: 'PC-KB-004 (Trực tiếp): Mèo thở dốc há miệng',
      species: 'cat',
      query: 'Mèo thở dốc và há miệng thở gắng sức thì làm sao?',
      keyPoints: ['cấp cứu', 'thú y ngay', 'không chờ']
    },
    {
      docId: 'PC-KB-004',
      label: 'PC-KB-004 (Diễn đạt khác): Mèo khó thở có tự cho uống thuốc ở nhà được không',
      species: 'cat',
      query: 'Mèo đang khó thở tôi có thể tự theo dõi qua đêm hoặc cho uống thuốc gì không?',
      keyPoints: ['cấp cứu', 'không']
    },

    // 5. PC-KB-005: Tiết niệu rặn tiểu (Cấp cứu)
    {
      docId: 'PC-KB-005',
      label: 'PC-KB-005 (Trực tiếp): Mèo rặn tiểu không ra',
      species: 'cat',
      query: 'Mèo đi khay cát rặn nhiều lần đau đớn nhưng không có nước tiểu ra?',
      keyPoints: ['cấp cứu', 'tắc', 'thú y']
    },
    {
      docId: 'PC-KB-005',
      label: 'PC-KB-005 (Diễn đạt khác): Mèo bí tiểu có chờ qua đêm đổi thức ăn được không',
      species: 'cat',
      query: 'Mèo đái rắt và không ra nước tiểu, có chờ theo dõi qua đêm được không?',
      keyPoints: ['cấp cứu', 'không']
    },

    // 6. PC-KB-006: Làm quen mèo mới
    {
      docId: 'PC-KB-006',
      label: 'PC-KB-006 (Trực tiếp): Làm quen mèo mới',
      species: 'cat',
      query: 'Làm thế nào để hai con mèo mới làm quen với nhau an toàn?',
      keyPoints: ['tách riêng', 'mùi', 'từ từ']
    },
    {
      docId: 'PC-KB-006',
      label: 'PC-KB-006 (Diễn đạt khác): Vừa đón mèo mới về nhà',
      species: 'cat',
      query: 'Vừa đón thêm bé mèo mới về, có nên thả cho gặp mèo cũ ngay lập tức không?',
      keyPoints: ['không', 'tách riêng', 'từ từ']
    },

    // 7. PC-KB-007: Khám phòng ngừa & Vaccine
    {
      docId: 'PC-KB-007',
      label: 'PC-KB-007 (Trực tiếp): Lịch khám định kỳ cho mèo',
      species: 'cat',
      query: 'Mèo trưởng thành cần đi khám sức khỏe định kỳ bao lâu một lần?',
      keyPoints: ['hằng năm', 'ít nhất 1 năm', 'khám']
    },
    {
      docId: 'PC-KB-007',
      label: 'PC-KB-007 (Diễn đạt khác): Mèo già có cần khám thường xuyên hơn không',
      species: 'cat',
      query: 'Mèo già lớn tuổi có cần đi khám thú y thường xuyên hơn mèo trẻ không?',
      keyPoints: ['thường xuyên hơn', '6 tháng']
    },

    // 8. PC-KB-008: Thuốc giảm đau của người
    {
      docId: 'PC-KB-008',
      label: 'PC-KB-008 (Trực tiếp): Cho chó uống Paracetamol / Ibuprofen',
      species: 'dog',
      query: 'Cho chó uống Paracetamol hoặc Ibuprofen của người để giảm đau được không?',
      keyPoints: ['không', 'độc', 'hại']
    },
    {
      docId: 'PC-KB-008',
      label: 'PC-KB-008 (Diễn đạt khác): Tự cho mèo uống thuốc giảm đau còn thừa',
      species: 'cat',
      query: 'Mèo bị đau chân có tự cho uống thuốc giảm đau của người hay thuốc cũ còn thừa không?',
      keyPoints: ['không']
    },

    // 9. Ngoài phạm vi / Sai loài
    {
      docId: null,
      label: 'Ngoài phạm vi (Vaccine cho thỏ)',
      species: 'rabbit',
      query: 'Lịch tiêm vaccine cho thỏ kiểng tại nhà như thế nào?',
      shouldRefuse: true
    },
    {
      docId: null,
      label: 'Ngoài phạm vi (Dinh dưỡng cho rùa)',
      species: 'turtle',
      query: 'Rùa cảnh ăn thịt bò sống hằng ngày có tốt không?',
      shouldRefuse: true
    }
  ];

  console.log('=== KIỂM TRA TOÀN DIỆN 8 TÀI LIỆU RAG VÀ CÁC TRƯỜNG HỢP NGOẠI PHẠM VI ===\n');

  let passedCount = 0;

  for (const t of testSuite) {
    console.log(`\n--------------------------------------------------------------`);
    console.log(`[TEST]: ${t.label}`);
    console.log(`Câu hỏi: "${t.query}" (Loài: ${t.species || 'all'})`);

    const ret = await retrieveRelevantContext(t.query, {
      petSpecies: t.species,
      topK: 2,
      threshold: 0.45
    });

    console.log(`Retrieval: method=${ret.method}, Chunks=${ret.chunks.length}, MaxScore=${ret.maxScore?.toFixed(4)}`);
    ret.chunks.forEach((c, idx) => console.log(`  Chunk ${idx + 1}: [${c.docId}] "${c.title}" (${c.score?.toFixed(4)})`));

    // Nếu câu hỏi ngoài phạm vi
    if (t.shouldRefuse) {
      if (ret.chunks.length === 0) {
        console.log(`-> KẾT QUẢ: TỪ CHỐI CHÍNH XÁC (Không có tài liệu ngoài phạm vi trong RAG) [ĐẠT]`);
        passedCount++;
      } else {
        console.log(`-> KẾT QUẢ: RAG tìm thấy nhầm tài liệu cho loài ngoài phạm vi! [TRƯỢT]`);
      }
      continue;
    }

    // Kiểm tra retrieval tìm thấy đúng docId mong đợi
    const foundDoc = ret.chunks.some(c => c.docId === t.docId);
    if (!foundDoc) {
      console.log(`-> LỖI RETRIEVAL: Không tìm thấy [${t.docId}]! [TRƯỢT]`);
      continue;
    }

    const contextSnippet = ret.chunks.map((c, i) => `[Tài liệu ${i + 1}: ${c.title}]\n${c.text}`).join('\n\n');

    const messages = [
      {
        role: 'system',
        content: `Bạn là Trợ lý chăm sóc thú cưng PetCare. Dựa trên tài liệu tham khảo được cung cấp trong câu hỏi, hãy trả lời câu hỏi của người dùng bằng tiếng Việt một cách chính xác, ngắn gọn và hữu ích.
Nêu rõ lời khuyên hoặc cảnh báo an toàn từ tài liệu.`
      },
      {
        role: 'user',
        content: `TÀI LIỆU THAM KHẢO:
${contextSnippet}

CÂU HỎI:
${t.query}`
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
    const reply = (data.message?.content || '').trim();
    console.log(`-> QWEN2.5 PHẢN HỒI:\n${reply}`);

    // Đánh giá ý cần có
    const lowerReply = reply.toLowerCase();
    const hasKeyPoints = t.keyPoints.some(kp => lowerReply.includes(kp.toLowerCase()));
    const isRefusal = lowerReply.includes('chưa có thông tin phù hợp');

    if (!isRefusal && hasKeyPoints) {
      console.log(`-> ĐÁNH GIÁ: ĐẠT CHẤT LƯỢNG (Có ý chính, không từ chối giả mạo)`);
      passedCount++;
    } else {
      console.log(`-> ĐÁNH GIÁ: CHƯA ĐẠT (isRefusal=${isRefusal}, hasKeyPoints=${hasKeyPoints})`);
    }
  }

  console.log(`\n==============================================================`);
  console.log(`TỔNG KẾT: ${passedCount}/${testSuite.length} ca kiểm tra ĐẠT!`);
}

testAll8Documents().catch(console.error);
