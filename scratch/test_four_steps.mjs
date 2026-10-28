import fetch from 'node-fetch';

async function runStepTest() {
  console.log('=== BẮT ĐẦU KIỂM TRA 4 BƯỚC TỪ TIẾN TRÌNH BACKEND ===\n');

  const OLLAMA_BASE = 'http://127.0.0.1:11434';
  const query = 'Cho mèo ăn thưởng bao nhiêu là vừa?';

  // BƯỚC 1: KẾT NỐI TỚI OLLAMA
  console.log('--- BƯỚC 1: KẾT NỐI TỚI OLLAMA (GET /api/tags) ---');
  const t0 = Date.now();
  let tagsRes;
  try {
    tagsRes = await fetch(`${OLLAMA_BASE}/api/tags`);
  } catch (err) {
    console.error('LỖI BƯỚC 1: Không thể kết nối tới Ollama:', err.message);
    process.exit(1);
  }
  const tagsData = await tagsRes.json();
  const models = (tagsData.models || []).map(m => m.name);
  console.log(`[BƯỚC 1 ĐẠT] HTTP ${tagsRes.status} (${Date.now() - t0}ms)`);
  console.log('Các mô hình hiện có:', models);

  const hasQwen = models.some(m => m.startsWith('qwen2.5:1.5b'));
  const hasEmbed = models.some(m => m.startsWith('embeddinggemma'));
  console.log(`- qwen2.5:1.5b: ${hasQwen ? 'SẴN SÀNG' : 'CHƯA CÓ'}`);
  console.log(`- embeddinggemma: ${hasEmbed ? 'SẴN SÀNG' : 'CHƯA CÓ'}`);

  // BƯỚC 2: TẠO EMBEDDING BẰNG EMBEDDINGGEMMA
  console.log('\n--- BƯỚC 2: TẠO EMBEDDING BẰNG EMBEDDINGGEMMA (/api/embeddings hoặc /api/embed) ---');
  const t1 = Date.now();
  let embedVector = null;
  let embedMethod = '';
  try {
    // Thử /api/embed trước
    const embedRes = await fetch(`${OLLAMA_BASE}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'embeddinggemma',
        input: query
      })
    });
    if (embedRes.ok) {
      const data = await embedRes.json();
      if (Array.isArray(data.embeddings) && data.embeddings[0]) {
        embedVector = data.embeddings[0];
        embedMethod = '/api/embed';
      }
    }
    if (!embedVector) {
      // Fallback sang /api/embeddings
      const embedRes2 = await fetch(`${OLLAMA_BASE}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'embeddinggemma',
          prompt: query
        })
      });
      if (embedRes2.ok) {
        const data2 = await embedRes2.json();
        embedVector = data2.embedding;
        embedMethod = '/api/embeddings';
      } else {
        const errText = await embedRes2.text();
        throw new Error(`HTTP ${embedRes2.status}: ${errText}`);
      }
    }
  } catch (err) {
    console.error('LỖI BƯỚC 2: Tạo embedding thất bại:', err.message);
    process.exit(1);
  }
  const tEmbed = Date.now() - t1;
  console.log(`[BƯỚC 2 ĐẠT] Endpoint: ${embedMethod}, Chiều dài vector: ${embedVector.length}, Thời gian: ${tEmbed}ms`);

  // BƯỚC 3: TRUY XUẤT TÀI LIỆU DINH DƯỠNG TRONG CHỈ MỤC
  console.log('\n--- BƯỚC 3: TRUY XUẤT TÀI LIỆU DINH DƯỠNG TRONG CHỈ MỤC ---');
  const { retrieveRelevantContext, reindexAll, getRagStatus, initRagService } = await import('../server/ragService.js');
  initRagService();
  
  // Tái lập chỉ mục vector ngay khi đã có embeddinggemma
  console.log('Tiến hành kiểm tra & cập nhật chỉ mục vector...');
  const tIndexStart = Date.now();
  const reindexRes = await reindexAll();
  console.log(`[LẬP CHỈ MỤC XONG] ${reindexRes.chunkCount} chunks trong ${Date.now() - tIndexStart}ms`);

  const tRetrieveStart = Date.now();
  const retrieved = await retrieveRelevantContext(query, {
    petSpecies: 'cat',
    topK: 2,
    threshold: 0.40
  });
  const tRetrieve = Date.now() - tRetrieveStart;
  console.log(`[BƯỚC 3 ĐẠT] Phương pháp: ${retrieved.method}, Tìm thấy: ${retrieved.chunks.length} đoạn (${tRetrieve}ms)`);
  retrieved.chunks.forEach((c, idx) => {
    console.log(`  Đoạn ${idx + 1}: [${c.docId}] "${c.title}" (Score: ${(c.score || 0).toFixed(4)})`);
  });
  console.log('  Nguồn tham chiếu:', (retrieved.sources || []).map(s => `${s.id} (${s.title})`).join(', '));

  // BƯỚC 4: GỌI QWEN2.5:1.5B SINH CÂU TRẢ LỜI
  console.log('\n--- BƯỚC 4: GỌI QWEN2.5:1.5B SINH CÂU TRẢ LỜI ---');
  const tGenStart = Date.now();
  const contextSnippet = retrieved.chunks.map(c => `[Tài liệu: ${c.title}]\n${c.text}`).join('\n\n');
  const systemPrompt = `Bạn là PetCare Assistant, trợ lý AI tư vấn chăm sóc thú cưng uy tín.
Quy tắc an toàn:
1. Dựa trên tài liệu được cung cấp để trả lời súc tích, chính xác bằng tiếng Việt.
2. Không tự ý kê đơn hoặc chẩn đoán thay bác sĩ thú y.
3. Luôn kèm lời khuyên tham khảo bác sĩ thú y khi cần thiết.

TÀI LIỆU THAM KHẢO:
${contextSnippet}`;

  const genRes = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen2.5:1.5b',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query }
      ],
      stream: false,
      options: {
        temperature: 0.3,
        num_predict: 512
      }
    })
  });

  if (!genRes.ok) {
    const genErrText = await genRes.text();
    console.error(`LỖI BƯỚC 4: HTTP ${genRes.status}: ${genErrText}`);
    process.exit(1);
  }

  const genData = await genRes.json();
  const tGen = Date.now() - tGenStart;
  const reply = genData.message?.content || '';
  console.log(`[BƯỚC 4 ĐẠT] Thời gian sinh câu trả lời: ${tGen}ms`);
  console.log('\n--- PHẢN HỒI SINH RA TỪ QWEN2.5:1.5B ---');
  console.log(reply);
  console.log('----------------------------------------');
  console.log('\n=== TẤT CẢ 4 BƯỚC ĐỀU THÀNH CÔNG RỰC RỠ ===');
}

runStepTest().catch(err => {
  console.error('Lỗi thực thi kiểm tra 4 bước:', err);
  process.exit(1);
});
