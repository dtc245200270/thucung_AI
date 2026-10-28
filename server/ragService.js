import fs from 'fs';
import path from 'path';
import { config } from './config.js';

// ============================================================================
// HỆ THỐNG RAG CỤC BỘ PETCARE (LOCAL AI + RAG ENGINE)
// Collection ID: petcare-rag-vi-v1 (Phiên bản: 1.0.0)
// ============================================================================

const RAG_DIR = path.join(process.cwd(), 'server', 'data', 'rag');
const DOCS_FILE = path.join(RAG_DIR, 'petcare-rag-vi-v1.docs.json');
const SOURCES_FILE = path.join(RAG_DIR, 'petcare-rag-vi-v1.sources.json');
const INDEX_FILE = path.join(RAG_DIR, 'petcare-rag-vi-v1.index.json');

export const COLLECTION_METADATA = {
  id: 'petcare-rag-vi-v1',
  version: '1.0.0',
  description: 'Bộ tài liệu tham khảo thú y phục vụ đồ án PetCare PRO AI, chưa được bác sĩ thú y thẩm định độc lập.',
  sourceCheckedAt: '2026-10-28',
  reviewStatus: 'source_checked_for_course_demo',
  disclaimer: 'Tài liệu tham khảo phục vụ đồ án, chưa được bác sĩ thú y thẩm định độc lập. Thông tin chỉ mang tính tham khảo, không thay thế khám thú y.'
};

// 7 NGUỒN CHÍNH THỨC (PHẦN 5)
export const INITIAL_SOURCES = [
  {
    id: 'SRC-AAHA-NUTRITION',
    org: 'American Animal Hospital Association (AAHA)',
    title: 'Prevention of Obesity — 2021 AAHA Nutrition and Weight Management Guidelines',
    url: 'https://www.aaha.org/resources/2021-aaha-nutrition-and-weight-management-guidelines/prevention-of-obesity/'
  },
  {
    id: 'SRC-CORNELL-DENTAL',
    org: 'Cornell University College of Veterinary Medicine',
    title: 'Feline Dental Disease',
    url: 'https://www.vet.cornell.edu/departments-centers-and-institutes/cornell-feline-health-center/health-information/feline-health-topics/feline-dental-disease'
  },
  {
    id: 'SRC-ESCCAP-WORMS',
    org: 'European Scientific Counsel Companion Animal Parasites (ESCCAP)',
    title: 'Scheme for individual deworming of dogs',
    url: 'https://www.esccap.org/deworming-dogs/'
  },
  {
    id: 'SRC-CORNELL-BREATHING',
    org: 'Cornell University College of Veterinary Medicine',
    title: 'Dyspnea (Difficulty Breathing)',
    url: 'https://www.vet.cornell.edu/departments-centers-and-institutes/cornell-feline-health-center/health-information/feline-health-topics/dyspnea-difficulty-breathing'
  },
  {
    id: 'SRC-CORNELL-URINARY',
    org: 'Cornell University College of Veterinary Medicine',
    title: 'Feline Lower Urinary Tract Disease',
    url: 'https://www.vet.cornell.edu/departments-centers-and-institutes/cornell-feline-health-center/health-information/feline-health-topics/feline-lower-urinary-tract-disease'
  },
  {
    id: 'SRC-AVMA-CAT',
    org: 'American Veterinary Medical Association (AVMA)',
    title: 'Selecting a pet cat',
    url: 'https://www.avma.org/resources/pet-owners/petcare/selecting-pet-cat'
  },
  {
    id: 'SRC-FDA-MEDICINES',
    org: 'U.S. Food and Drug Administration (FDA)',
    title: 'Get the Facts about Pain Relievers for Pets',
    url: 'https://www.fda.gov/animal-veterinary/animal-health-literacy/get-facts-about-pain-relievers-pets'
  }
];

// 8 TÀI LIỆU KIẾN THỨC CHUẨN (PHẦN 5)
export const INITIAL_DOCUMENTS = [
  {
    id: 'PC-KB-001',
    title: 'Dinh dưỡng và đồ ăn thưởng cho chó mèo',
    species: ['dog', 'cat'],
    keywords: ['dinh dưỡng', 'béo phì', 'ăn thưởng', 'snack', 'khẩu phần'],
    sourceIds: ['SRC-AAHA-NUTRITION'],
    version: '1.0.0',
    sourceCheckedAt: '2026-10-28',
    reviewStatus: 'source_checked_for_course_demo',
    enabled: true,
    content: 'Đồ ăn thưởng và thức ăn bổ sung cần được tính vào tổng năng lượng hằng ngày. AAHA khuyến nghị phần bổ sung không vượt quá 10% tổng năng lượng để tránh làm mất cân đối khẩu phần chính. Không suy ra số gam thức ăn chỉ từ cân nặng: cần xét loại thức ăn, tình trạng cơ thể và nhu cầu từng con. Khi muốn thay khẩu phần hoặc giảm cân, trao đổi với bác sĩ thú y để có kế hoạch phù hợp.'
  },
  {
    id: 'PC-KB-002',
    title: 'Chăm sóc răng miệng cho mèo',
    species: ['cat'],
    keywords: ['răng', 'nướu', 'đánh răng', 'hôi miệng', 'kem đánh răng'],
    sourceIds: ['SRC-CORNELL-DENTAL'],
    version: '1.0.0',
    sourceCheckedAt: '2026-10-28',
    reviewStatus: 'source_checked_for_course_demo',
    enabled: true,
    content: 'Chải răng thường xuyên giúp hạn chế tích tụ mảng bám ở mèo. Dùng bàn chải và kem hoặc gel dành riêng cho mèo; không dùng kem đánh răng của người. Cho mèo làm quen từ từ thay vì ép. Hôi miệng, chảy dãi hoặc khó ăn có thể liên quan bệnh răng miệng và cần khám. Nếu nướu đang viêm hoặc đau, hỏi bác sĩ trước khi chải; không cố chải vùng đau.'
  },
  {
    id: 'PC-KB-003',
    title: 'Vì sao không áp dụng một lịch tẩy giun cho mọi thú cưng',
    species: ['dog', 'cat'],
    keywords: ['tẩy giun', 'ký sinh trùng', 'lịch tẩy giun', 'ăn sống', 'săn bắt'],
    sourceIds: ['SRC-ESCCAP-WORMS'],
    version: '1.0.0',
    sourceCheckedAt: '2026-10-28',
    reviewStatus: 'source_checked_for_course_demo',
    enabled: true,
    content: 'Kiểm soát giun cần dựa vào nguy cơ của từng thú cưng, không có một lịch chung đúng cho tất cả. Bác sĩ cân nhắc môi trường sống, nguy cơ địa phương, việc săn bắt hoặc ăn thịt sống và tiền sử phơi nhiễm. Hãy cung cấp lịch dùng sản phẩm gần nhất và hỏi bác sĩ về xét nghiệm, phòng ngừa phù hợp. Không tự chọn sản phẩm hoặc liều theo câu trả lời chatbot; hướng dẫn theo bối cảnh châu Âu không thay thế đánh giá tại Việt Nam.'
  },
  {
    id: 'PC-KB-004',
    title: 'Mèo khó thở cần được đánh giá khẩn cấp',
    species: ['cat'],
    keywords: ['khó thở', 'thở gắng sức', 'há miệng thở', 'hô hấp', 'cấp cứu'],
    sourceIds: ['SRC-CORNELL-BREATHING'],
    version: '1.0.0',
    sourceCheckedAt: '2026-10-28',
    reviewStatus: 'source_checked_for_course_demo',
    enabled: true,
    content: 'Khó thở ở mèo có nhiều nguyên nhân và không thể xác định chỉ qua chat hoặc một tấm ảnh. Mèo có dấu hiệu khó thở cần được bác sĩ thú y đánh giá ngay vì chậm xử trí có thể nguy hiểm đến tính mạng. Liên hệ cơ sở thú y có khả năng tiếp nhận cấp cứu; không chờ chatbot chẩn đoán hay tự thử thuốc tại nhà. Không kết luận mèo bị hen, bệnh tim hoặc bệnh khác chỉ từ mô tả.'
  },
  {
    id: 'PC-KB-005',
    title: 'Mèo rặn tiểu nhưng ít hoặc không có nước tiểu',
    species: ['cat'],
    keywords: ['bí tiểu', 'rặn tiểu', 'không tiểu được', 'khay cát', 'tắc niệu đạo'],
    sourceIds: ['SRC-CORNELL-URINARY'],
    version: '1.0.0',
    sourceCheckedAt: '2026-10-28',
    reviewStatus: 'source_checked_for_course_demo',
    enabled: true,
    content: 'Đi khay cát nhiều lần, rặn, đau hoặc chỉ ra ít hay không có nước tiểu có thể gặp khi đường tiểu bị tắc. Nghi ngờ tắc niệu đạo là tình huống cấp cứu, cần liên hệ và đưa mèo đi thú y ngay. Không chờ qua đêm để theo dõi hoặc chỉ đổi thức ăn. Các dấu hiệu đường tiểu có nhiều nguyên nhân; chatbot không thể xác định nguyên nhân hoặc kê điều trị. Việc kiểm tra và xét nghiệm thuộc bác sĩ.'
  },
  {
    id: 'PC-KB-006',
    title: 'Môi trường sống và làm quen cho mèo',
    species: ['cat'],
    keywords: ['mèo mới', 'làm quen', 'đồ chơi', 'cào móng', 'khay vệ sinh'],
    sourceIds: ['SRC-AVMA-CAT'],
    version: '1.0.0',
    sourceCheckedAt: '2026-10-28',
    reviewStatus: 'source_checked_for_course_demo',
    enabled: true,
    content: 'Mèo cần chỗ nghỉ, thức ăn, nước, khu vệ sinh và cơ hội chơi, khám phá, cào móng phù hợp. Khi đưa mèo mới về nhà có thú cưng khác, cho làm quen từ từ, có giám sát và khoảng thời gian tách riêng. Dây hoặc ruy băng không phải đồ chơi an toàn nếu mèo nuốt phải. Chuẩn bị đồ chơi thích hợp và trao đổi bác sĩ khi việc làm quen gặp khó khăn.'
  },
  {
    id: 'PC-KB-007',
    title: 'Khám phòng ngừa và lịch vaccine của mèo',
    species: ['cat'],
    keywords: ['vaccine', 'tiêm chủng', 'khám định kỳ', 'phòng bệnh', 'sổ tiêm'],
    sourceIds: ['SRC-AVMA-CAT'],
    version: '1.0.0',
    sourceCheckedAt: '2026-10-28',
    reviewStatus: 'source_checked_for_course_demo',
    enabled: true,
    content: 'Mèo cần khám thú y định kỳ. Chương trình vaccine và chăm sóc phòng ngừa nên được bác sĩ lựa chọn theo lối sống và nguy cơ bệnh tại khu vực. Cung cấp tuổi nếu biết và hồ sơ tiêm đã có; không tự coi thông tin chưa rõ là đã tiêm hoặc chưa tiêm. Tài liệu này không quy định tuổi bắt đầu, khoảng cách các mũi hay yêu cầu pháp lý ở Việt Nam; cần hỏi cơ sở thú y về trường hợp cụ thể.'
  },
  {
    id: 'PC-KB-008',
    title: 'Không tự dùng thuốc giảm đau của người cho chó mèo',
    species: ['dog', 'cat'],
    keywords: ['thuốc người', 'giảm đau', 'ibuprofen', 'paracetamol', 'acetaminophen'],
    sourceIds: ['SRC-FDA-MEDICINES'],
    version: '1.0.0',
    sourceCheckedAt: '2026-10-28',
    reviewStatus: 'source_checked_for_course_demo',
    enabled: true,
    content: 'Không tự cho chó mèo dùng thuốc giảm đau của người hoặc thuốc còn thừa được kê cho con khác. Thuốc phù hợp với người hay thú cưng khác vẫn có thể gây hại cho con đang cần chăm sóc. Hãy liên hệ bác sĩ trước khi dùng thuốc; chatbot không cung cấp liều ibuprofen, paracetamol hoặc thuốc giảm đau thay thế. Nếu đã cho uống, liên hệ thú y ngay và cung cấp tên thuốc, hàm lượng, lượng đã dùng và thời điểm dùng.'
  }
];

// Trạng thái nạp trong bộ nhớ
let inMemorySources = null;
let inMemoryDocs = null;
let inMemoryIndex = null;
let isReindexing = false;

// Đảm bảo thư mục lưu trữ tồn tại
function ensureRagDirectory() {
  if (!fs.existsSync(RAG_DIR)) {
    fs.mkdirSync(RAG_DIR, { recursive: true });
  }
}

// Khởi tạo RAG Service
export function initRagService() {
  ensureRagDirectory();

  // 1. Nạp hoặc khởi tạo Sources
  if (!fs.existsSync(SOURCES_FILE)) {
    fs.writeFileSync(SOURCES_FILE, JSON.stringify(INITIAL_SOURCES, null, 2), 'utf8');
    inMemorySources = INITIAL_SOURCES;
  } else {
    try {
      inMemorySources = JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf8'));
    } catch (e) {
      console.error('[RAG] Lỗi đọc sources file, dùng initial:', e);
      inMemorySources = INITIAL_SOURCES;
    }
  }

  // 2. Nạp hoặc khởi tạo Documents
  if (!fs.existsSync(DOCS_FILE)) {
    fs.writeFileSync(DOCS_FILE, JSON.stringify(INITIAL_DOCUMENTS, null, 2), 'utf8');
    inMemoryDocs = INITIAL_DOCUMENTS;
  } else {
    try {
      inMemoryDocs = JSON.parse(fs.readFileSync(DOCS_FILE, 'utf8'));
    } catch (e) {
      console.error('[RAG] Lỗi đọc docs file, dùng initial:', e);
      inMemoryDocs = INITIAL_DOCUMENTS;
    }
  }

  // 3. Nạp hoặc khởi tạo Index trên đĩa
  if (fs.existsSync(INDEX_FILE)) {
    try {
      inMemoryIndex = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
      console.log(`[RAG] Đã nạp chỉ mục có sẵn: ${inMemoryIndex.chunks?.length || 0} đoạn.`);
    } catch (e) {
      console.warn('[RAG] Chỉ mục hiện tại chưa hợp lệ, tạo lại từ tài liệu:', e.message);
      inMemoryIndex = null;
    }
  }

  if (!inMemoryIndex || !Array.isArray(inMemoryIndex.chunks) || inMemoryIndex.chunks.length === 0) {
    const enabledDocs = (inMemoryDocs || INITIAL_DOCUMENTS).filter(d => d.enabled !== false);
    const initialChunks = enabledDocs.map(doc => ({
      chunkId: `${doc.id}#chunk-1`,
      docId: doc.id,
      title: doc.title,
      species: doc.species,
      keywords: doc.keywords,
      sourceIds: doc.sourceIds,
      version: doc.version,
      text: doc.content,
      fullText: `${doc.title}. ${doc.content}`.trim(),
      embedding: null
    }));

    const initialIndex = {
      collectionId: COLLECTION_METADATA.id,
      version: COLLECTION_METADATA.version,
      embeddingModel: process.env.OLLAMA_EMBED_MODEL || 'embeddinggemma',
      indexedAt: new Date().toISOString(),
      docCount: enabledDocs.length,
      chunkCount: initialChunks.length,
      chunks: initialChunks,
      isPendingEmbeddings: true
    };

    try {
      fs.writeFileSync(INDEX_FILE, JSON.stringify(initialIndex, null, 2), 'utf8');
      inMemoryIndex = initialIndex;
      console.log(`[RAG] Đã tạo tệp chỉ mục ban đầu trên đĩa (${INDEX_FILE}) với ${initialChunks.length} đoạn tài liệu.`);
    } catch (writeErr) {
      console.error('[RAG] Không thể ghi tệp chỉ mục:', writeErr.message);
    }
  }
}

// Lấy danh sách nguồn
export function getSources() {
  if (!inMemorySources) initRagService();
  return inMemorySources || INITIAL_SOURCES;
}

// Lấy danh sách tài liệu
export function getDocuments() {
  if (!inMemoryDocs) initRagService();
  return inMemoryDocs || INITIAL_DOCUMENTS;
}

// Lấy chi tiết tài liệu theo ID
export function getDocumentById(id) {
  const docs = getDocuments();
  return docs.find(d => d.id === id) || null;
}

// Cập nhật tài liệu
export function saveDocuments(newDocs) {
  ensureRagDirectory();
  inMemoryDocs = newDocs;
  fs.writeFileSync(DOCS_FILE, JSON.stringify(newDocs, null, 2), 'utf8');
}

// Bật / tắt tài liệu (enable / disable)
export async function toggleDocumentStatus(id, enabled) {
  const docs = getDocuments();
  const idx = docs.findIndex(d => d.id === id);
  if (idx === -1) {
    throw new Error(`Không tìm thấy tài liệu với ID "${id}"`);
  }
  docs[idx].enabled = typeof enabled === 'boolean' ? enabled : !docs[idx].enabled;
  docs[idx].updatedAt = new Date().toISOString();
  saveDocuments(docs);

  // Cập nhật lại chỉ mục ngay sau khi thay đổi trạng thái
  return await reindexAll();
}

// Thêm hoặc sửa một tài liệu
export async function upsertDocument(docData) {
  const docs = getDocuments();
  const idx = docs.findIndex(d => d.id === docData.id);
  const now = new Date().toISOString().split('T')[0];

  const standardizedDoc = {
    id: docData.id,
    title: docData.title,
    species: Array.isArray(docData.species) ? docData.species : [docData.species || 'all'],
    keywords: Array.isArray(docData.keywords) ? docData.keywords : (docData.keywords || '').split(',').map(k => k.trim()),
    sourceIds: Array.isArray(docData.sourceIds) ? docData.sourceIds : [docData.sourceIds || 'SRC-MANUAL'],
    version: docData.version || '1.0.0',
    sourceCheckedAt: docData.sourceCheckedAt || now,
    reviewStatus: docData.reviewStatus || 'source_checked_for_course_demo',
    enabled: docData.enabled !== false,
    content: docData.content
  };

  if (idx >= 0) {
    docs[idx] = { ...docs[idx], ...standardizedDoc, updatedAt: new Date().toISOString() };
  } else {
    docs.push(standardizedDoc);
  }

  saveDocuments(docs);
  return await reindexAll();
}

// Xóa tài liệu
export async function deleteDocument(id) {
  const docs = getDocuments();
  const filtered = docs.filter(d => d.id !== id);
  if (filtered.length === docs.length) {
    throw new Error(`Không tìm thấy tài liệu "${id}" để xóa.`);
  }
  saveDocuments(filtered);
  return await reindexAll();
}

// Tính Cosine Similarity giữa 2 vector
export function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Gọi Ollama để lấy embedding vector qua embeddinggemma
export async function fetchEmbeddingFromOllama(text) {
  const ollamaUrl = (config.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
  const embedModel = process.env.OLLAMA_EMBED_MODEL || 'embeddinggemma';

  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new Error('Văn bản cần tạo vector embedding không được rỗng.');
  }

  // Cách 1: Thử POST /api/embed (Ollama API mới hỗ trợ mảng input)
  try {
    const res = await fetch(`${ollamaUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: embedModel,
        input: text.trim()
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.embeddings) && data.embeddings.length > 0) {
        return data.embeddings[0];
      }
    }
  } catch (_) {
    // Tiếp tục fallback bên dưới
  }

  // Cách 2: POST /api/embeddings (Ollama API tiêu chuẩn)
  const res2 = await fetch(`${ollamaUrl}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: embedModel,
      prompt: text.trim()
    })
  });

  if (!res2.ok) {
    const errorText = await res2.text().catch(() => '');
    throw new Error(`Ollama embedding error (${res2.status}): ${errorText || res2.statusText}`);
  }

  const data2 = await res2.json();
  if (!Array.isArray(data2.embedding)) {
    throw new Error(`Phản hồi từ Ollama (${embedModel}) không chứa mảng vector embedding hợp lệ.`);
  }

  return data2.embedding;
}

// Kiểm tra xem mô hình embedding đã sẵn sàng trong Ollama chưa
export async function isEmbeddingModelReady() {
  const ollamaUrl = (config.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
  const embedModel = process.env.OLLAMA_EMBED_MODEL || 'embeddinggemma';
  try {
    const res = await fetch(`${ollamaUrl}/api/tags`);
    if (!res.ok) return false;
    const data = await res.json();
    const installed = data.models?.some(m => m.name === embedModel || m.name?.startsWith(`${embedModel}:`));
    return Boolean(installed);
  } catch (_) {
    return false;
  }
}

// Tái lập chỉ mục toàn bộ tài liệu (Re-index)
export async function reindexAll() {
  if (isReindexing) {
    throw new Error('Hệ thống đang trong quá trình lập chỉ mục. Vui lòng chờ.');
  }

  isReindexing = true;
  ensureRagDirectory();

  const embedModel = process.env.OLLAMA_EMBED_MODEL || 'embeddinggemma';
  const docs = getDocuments();
  const enabledDocs = docs.filter(d => d.enabled !== false);

  try {
    console.log(`[RAG] Bắt đầu lập chỉ mục cho ${enabledDocs.length} tài liệu với mô hình ${embedModel}...`);
    const newChunks = [];

    for (const doc of enabledDocs) {
      // Chia đoạn theo ý nghĩa: mỗi tài liệu ngắn chia thành 1 chunk hoàn chỉnh bao gồm Title + Nội dung
      // Để vector bắt trọn ngữ cảnh cả tiêu đề và nội dung
      const chunkText = `${doc.title}. ${doc.content}`.trim();
      
      const embedding = await fetchEmbeddingFromOllama(chunkText);
      newChunks.push({
        chunkId: `${doc.id}#chunk-1`,
        docId: doc.id,
        title: doc.title,
        species: doc.species,
        keywords: doc.keywords,
        sourceIds: doc.sourceIds,
        version: doc.version,
        text: doc.content,
        fullText: chunkText,
        embedding
      });
    }

    const newIndex = {
      collectionId: COLLECTION_METADATA.id,
      version: COLLECTION_METADATA.version,
      embeddingModel: embedModel,
      indexedAt: new Date().toISOString(),
      docCount: enabledDocs.length,
      chunkCount: newChunks.length,
      chunks: newChunks
    };

    // Lưu file index
    fs.writeFileSync(INDEX_FILE, JSON.stringify(newIndex, null, 2), 'utf8');
    inMemoryIndex = newIndex;

    console.log(`[RAG] Lập chỉ mục thành công: ${newChunks.length} chunks đã sẵn sàng.`);
    return {
      success: true,
      message: `Đã lập chỉ mục thành công cho ${enabledDocs.length} tài liệu (${newChunks.length} đoạn vector).`,
      docCount: enabledDocs.length,
      chunkCount: newChunks.length,
      indexedAt: newIndex.indexedAt
    };
  } catch (err) {
    console.error('[RAG] Lập chỉ mục thất bại:', err.message);
    // Khi lập chỉ mục lỗi, GIỮ chỉ mục hợp lệ trước đó và báo lỗi (Phần 4)
    throw new Error(`Lập chỉ mục RAG thất bại: ${err.message}. Hệ thống đang giữ nguyên chỉ mục hợp lệ trước đó.`);
  } finally {
    isReindexing = false;
  }
}

// Lấy thông tin trạng thái RAG hiện tại
export function getRagStatus() {
  if (!inMemoryDocs) initRagService();
  const embedModel = process.env.OLLAMA_EMBED_MODEL || 'embeddinggemma';
  const hasVectorEmbeddings = inMemoryIndex?.chunks && 
                              inMemoryIndex.chunks.length > 0 && 
                              inMemoryIndex.chunks.some(c => Array.isArray(c.embedding) && c.embedding.length > 0);
  return {
    collectionId: COLLECTION_METADATA.id,
    version: COLLECTION_METADATA.version,
    embeddingModel: embedModel,
    totalDocs: inMemoryDocs ? inMemoryDocs.length : 0,
    enabledDocs: inMemoryDocs ? inMemoryDocs.filter(d => d.enabled !== false).length : 0,
    indexedChunks: inMemoryIndex?.chunks ? inMemoryIndex.chunks.length : 0,
    hasVectorEmbeddings: Boolean(hasVectorEmbeddings),
    lastIndexedAt: inMemoryIndex?.indexedAt || null,
    isReindexing
  };
}

// ============================================================================
// BỘ LỌC CẢNH BÁO AN TOÀN & DẤU HIỆU CẤP CỨU (GUARDRAILS & TRIAGE)
// ============================================================================

export function analyzeGuardrailsAndSafety(query, { petName = null, petSpecies = null } = {}) {
  const lower = String(query || '').toLowerCase().trim();

  // 1. Dấu hiệu khó thở cấp cứu ở mèo hoặc chó (PC-KB-004)
  const isBreathingEmergency = /(khó thở|kho tho|thở (?:rất |cực kỳ |hơi )?khó|tho (?:rat |cuc ky |hoi )?kho|thở gắng sức|tho gang suc|há miệng thở|ha mieng tho|thở dốc|tho doc|thở gấp|tho gap|thở khò khè|ngạt thở|ngat tho)/i.test(lower);
  if (isBreathingEmergency) {
    return {
      isEmergency: true,
      emergencyType: 'BREATHING',
      suggestedDocId: 'PC-KB-004',
      message: '🚨 CẢNH BÁO CẤP CỨU HÔ HẤP: Dấu hiệu khó thở hoặc thở gắng sức là tình huống đe dọa tính mạng. Vui lòng liên hệ và đưa thú cưng đến bệnh viện hoặc cơ sở thú y có khả năng cấp cứu ngay lập tức. Tuyệt đối không chờ theo dõi qua đêm hay tự cho uống thuốc tại nhà.'
    };
  }

  // 2. Dấu hiệu bí tiểu, rặn tiểu không ra nước tiểu (PC-KB-005)
  const isUrinaryEmergency = /(bí tiểu|bi tieu|rặn tiểu|ran tieu|không tiểu được|khong tieu duoc|khay cát liên tục|ngồi khay cát lâu|tắc niệu đạo|tac nieu dao|tiểu ra máu buốt)/i.test(lower);
  if (isUrinaryEmergency) {
    return {
      isEmergency: true,
      emergencyType: 'URINARY',
      suggestedDocId: 'PC-KB-005',
      message: '🚨 CẢNH BÁO CẤP CỨU ĐƯỜNG TIỂU: Đi khay cát nhiều lần nhưng rặn đau hoặc không ra nước tiểu có thể là dấu hiệu tắc niệu đạo cấp tính. Đây là tình huống cấp cứu khẩn cấp, cần đưa bé đến bác sĩ thú y ngay. Không chờ qua đêm để theo dõi hoặc chỉ đổi thức ăn.'
    };
  }

  // 3. Yêu cầu liều lượng hoặc tự dùng thuốc người cho thú cưng (PC-KB-008)
  const isHumanMedication = /(paracetamol|acetaminophen|ibuprofen|panadol|aspirin|thuốc giảm đau của người|thuoc giam dau cua nguoi|tính liều|tinh lieu)/i.test(lower);
  if (isHumanMedication && (lower.includes('liều') || lower.includes('cho uống') || lower.includes('dùng được không') || lower.includes('uống được không') || lower.includes('tính liều'))) {
    return {
      isRefusal: true,
      refusalType: 'HUMAN_MEDICATION_DOSAGE',
      suggestedDocId: 'PC-KB-008',
      message: '⚠️ CẢNH BÁO AN TOÀN DÙNG THUỐC: Tuyệt đối không tự cho thú cưng dùng thuốc giảm đau của người (như Paracetamol, Ibuprofen). Thuốc của người có thể gây suy gan cấp, hoại tử hồng cầu và tử vong ở chó mèo. Chatbot không tính liều hoặc cung cấp liều thuốc giảm đau thay thế. Nếu bé đã lỡ uống, hãy mang theo mẫu thuốc và đưa bé đến bác sĩ thú y cấp cứu ngay.'
    };
  }

  // 4. Loài không nằm trong phạm vi tài liệu (ví dụ: thỏ, chim, chuột hamster...)
  const isNonCoveredSpecies = /(thỏ|tho|rabbit|chim|hamster|chuột|bò sát|rùa)/i.test(lower) || (petSpecies && ['rabbit', 'thỏ', 'bird', 'hamster'].includes(String(petSpecies).toLowerCase()));
  if (isNonCoveredSpecies && (lower.includes('vaccine') || lower.includes('vắc-xin') || lower.includes('tiêm') || lower.includes('tẩy giun') || lower.includes('bệnh') || lower.includes('thuốc'))) {
    return {
      isOutOfCoverage: true,
      coverageType: 'SPECIES_UNSUPPORTED',
      message: 'Hiện tại tài liệu tham khảo chính thống trong hệ thống chưa có quy định hoặc hướng dẫn chuyên sâu cho loài này. Vui lòng tham vấn trực tiếp Bác sĩ Thú y tại phòng khám để có chỉ định an toàn và phù hợp cho bé.'
    };
  }

  // 5. Câu hỏi hoàn toàn ngoài lề thú cưng
  const isOutOfDomain = /(thời tiết|thoi tiet|chứng khoán|chung khoan|bóng đá|bong da|code python|lập trình|chính trị|viet nam vo dich|xổ số)/i.test(lower);
  if (isOutOfDomain) {
    return {
      isOutOfDomain: true,
      message: 'Xin lỗi, tôi là trợ lý chuyên biệt hỗ trợ thông tin chăm sóc thú cưng của PetCare. Câu hỏi này nằm ngoài phạm vi hỗ trợ của tôi.'
    };
  }

  // 6. Yêu cầu phá vỡ quy tắc / bịa tên bác sĩ phê duyệt
  const isJailbreakOrFakeDoctor = /(bỏ qua quy tắc|ignore previous instructions|bịa tên bác sĩ|tên bác sĩ phê duyệt|ai đã phê duyệt|bác sĩ nào kiểm duyệt)/i.test(lower);
  if (isJailbreakOrFakeDoctor) {
    return {
      isRefusal: true,
      refusalType: 'POLICY_VIOLATION',
      message: 'Toàn bộ nội dung trong hệ thống là tài liệu tham khảo phục vụ đồ án, chưa được bác sĩ thú y thẩm định độc lập. Trợ lý tuân thủ nghiêm ngặt quy định y khoa và không cung cấp tên bác sĩ giả mạo hoặc thông tin chưa được kiểm chứng.'
    };
  }

  return { isSafe: true };
}

// ============================================================================
// TRUY XUẤT NGỮ CẢNH RAG (RETRIEVAL)
// ============================================================================

export async function retrieveRelevantContext(query, { petSpecies = null, topK = 2, threshold = 0.48 } = {}) {
  ensureRagDirectory();
  if (!inMemoryDocs) initRagService();

  const docs = getDocuments().filter(d => d.enabled !== false);
  const sourcesMap = new Map();
  getSources().forEach(s => sourcesMap.set(s.id, s));
  const normalizedSpecies = petSpecies ? String(petSpecies).toLowerCase().trim() : null;
  const cleanQuery = String(query || '').toLowerCase().trim();

  // 1. Thử tạo Vector qua Ollama (embeddinggemma) nếu chỉ mục đã có vector embeddings
  let queryEmbedding = null;
  const hasVectorIndex = inMemoryIndex?.chunks && 
                         inMemoryIndex.chunks.length > 0 && 
                         inMemoryIndex.chunks.some(c => Array.isArray(c.embedding) && c.embedding.length > 0);

  if (hasVectorIndex) {
    try {
      queryEmbedding = await fetchEmbeddingFromOllama(query);
    } catch (err) {
      // Embedding model đang bận hoặc gặp sự cố, fallback sang semantic/keyword matching
    }
  }

  // 2. Nếu có Vector Embedding: Sử dụng Cosine Similarity
  if (queryEmbedding && hasVectorIndex) {
    const scoredChunks = [];

    for (const chunk of inMemoryIndex.chunks) {
      if (!Array.isArray(chunk.embedding) || chunk.embedding.length === 0) continue;

      // Lọc theo loài nếu tài liệu chuyên biệt
      if (normalizedSpecies && Array.isArray(chunk.species)) {
        const isSpeciesMatch = chunk.species.includes(normalizedSpecies) || 
                               (normalizedSpecies === 'chó' && chunk.species.includes('dog')) ||
                               (normalizedSpecies === 'mèo' && chunk.species.includes('cat'));
        if (!isSpeciesMatch && !chunk.species.includes('all')) {
          continue;
        }
      }

      const score = cosineSimilarity(queryEmbedding, chunk.embedding);
      if (score >= threshold) {
        scoredChunks.push({
          ...chunk,
          score
        });
      }
    }

    if (scoredChunks.length > 0) {
      scoredChunks.sort((a, b) => b.score - a.score);
      const selectedChunks = scoredChunks.slice(0, topK);

      const sourceSet = new Set();
      selectedChunks.forEach(c => {
        if (Array.isArray(c.sourceIds)) {
          c.sourceIds.forEach(id => sourceSet.add(id));
        }
      });

      return {
        success: true,
        method: 'cosine_vector',
        chunks: selectedChunks,
        sources: Array.from(sourceSet).map(id => sourcesMap.get(id)).filter(Boolean),
        maxScore: selectedChunks.length > 0 ? selectedChunks[0].score : 0
      };
    }
    // Nếu cosine similarity không tìm thấy tài liệu trên ngưỡng threshold, rơi xuống Fallback bước 3
  }

  // 3. Fallback: So khớp chính xác từ khóa & ngữ nghĩa theo danh mục tài liệu RAG chuẩn
  const matchedDocs = [];

  for (const doc of docs) {
    // Kiểm tra loài
    if (normalizedSpecies && Array.isArray(doc.species)) {
      const isSpeciesMatch = doc.species.includes(normalizedSpecies) || 
                             (normalizedSpecies === 'chó' && doc.species.includes('dog')) ||
                             (normalizedSpecies === 'mèo' && doc.species.includes('cat'));
      if (!isSpeciesMatch && !doc.species.includes('all')) {
        continue;
      }
    }

    let matchScore = 0;
    // Kiểm tra từ khóa
    if (Array.isArray(doc.keywords)) {
      for (const kw of doc.keywords) {
        const cleanKw = kw.toLowerCase().trim();
        if (cleanQuery.includes(cleanKw)) {
          matchScore += 2;
        }
      }
    }

    // Kiểm tra tiêu đề
    const lowerTitle = doc.title.toLowerCase();
    const titleWords = lowerTitle.split(/\s+/).filter(w => w.length > 2);
    for (const tw of titleWords) {
      if (cleanQuery.includes(tw)) {
        matchScore += 1;
      }
    }

    if (matchScore >= 2) {
      matchedDocs.push({
        chunkId: `${doc.id}#chunk-1`,
        docId: doc.id,
        title: doc.title,
        species: doc.species,
        keywords: doc.keywords,
        sourceIds: doc.sourceIds,
        version: doc.version,
        text: doc.content,
        score: matchScore
      });
    }
  }

  matchedDocs.sort((a, b) => b.score - a.score);
  const selectedChunks = matchedDocs.slice(0, topK);

  const sourceSet = new Set();
  selectedChunks.forEach(c => {
    if (Array.isArray(c.sourceIds)) {
      c.sourceIds.forEach(id => sourceSet.add(id));
    }
  });

  return {
    success: true,
    method: 'keyword_semantic',
    chunks: selectedChunks,
    sources: Array.from(sourceSet).map(id => sourcesMap.get(id)).filter(Boolean),
    maxScore: selectedChunks.length > 0 ? selectedChunks[0].score : 0
  };
}

// Tự động kiểm tra và lập chỉ mục ngay khi mô hình embedding tải xong
let watcherInterval = null;
export function startEmbeddingModelWatcher() {
  if (watcherInterval) return;

  watcherInterval = setInterval(async () => {
    try {
      const ready = await isEmbeddingModelReady();
      const hasEmbeddings = inMemoryIndex?.chunks && 
                            inMemoryIndex.chunks.length > 0 && 
                            inMemoryIndex.chunks.some(c => Array.isArray(c.embedding) && c.embedding.length > 0);
      if (ready && !hasEmbeddings && !isReindexing) {
        console.log('[RAG Watcher] Phát hiện mô hình embeddinggemma đã sẵn sàng trong Ollama. Bắt đầu tự động lập chỉ mục vector...');
        await reindexAll();
        console.log('[RAG Watcher] Tự động lập chỉ mục vector hoàn tất thành công!');
        clearInterval(watcherInterval);
        watcherInterval = null;
      }
    } catch (err) {
      console.warn('[RAG Watcher] Lỗi kiểm tra chỉ mục:', err.message);
    }
  }, 10000); // 10 giây/lần
}
