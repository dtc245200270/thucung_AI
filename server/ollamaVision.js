/**
 * server/ollamaVision.js
 * Module tập trung xử lý giao tiếp với Ollama cho chức năng quan sát ảnh thú cưng.
 * Đọc cấu hình từ config.js — không gán cứng URL hay tên model ở đây.
 *
 * Luồng:
 *   checkOllamaStatus()     → kiểm tra Ollama đang chạy, model được cài chưa
 *   analyzeImageWithOllama() → gửi base64 thật + prompt → nhận text mô tả từ model
 *
 * Quy tắc:
 * - KHÔNG trả dữ liệu giả/cache khi model lỗi — trả lỗi thật.
 * - KHÔNG load thêm model không cần thiết song song.
 * - Tất cả timeout và model name đọc từ config.
 */

import { config } from './config.js';

const BASE_URL = config.OLLAMA_BASE_URL;
const VISION_MODEL = config.OLLAMA_VISION_MODEL;
const TEXT_MODEL = config.OLLAMA_TEXT_MODEL || 'qwen2.5:1.5b';
const TIMEOUT_MS = config.OLLAMA_VISION_TIMEOUT_MS;

// Danh sách tag con đã biết có khả năng Vision (multimodal)
// moondream, llava, minicpm-v, bakllava, llava-phi3, ...
// Dùng để kiểm tra nhanh mà không cần Ollama phơi capabilities API
const KNOWN_VISION_MODEL_PREFIXES = [
  'moondream',
  'llava',
  'minicpm-v',
  'bakllava',
  'llava-phi',
  'llava-llama',
];

/**
 * Kiểm tra một tên model có hỗ trợ vision không,
 * dựa vào tiền tố đã biết (không gọi API phụ).
 * @param {string} modelName
 * @returns {boolean}
 */
function isKnownVisionModel(modelName) {
  if (!modelName || typeof modelName !== 'string') return false;
  const lower = modelName.toLowerCase();
  return KNOWN_VISION_MODEL_PREFIXES.some(prefix => lower.startsWith(prefix));
}

/**
 * Lấy danh sách model đang có trong Ollama.
 * @returns {Promise<{ok: boolean, models: Array<{name: string}>, error?: string}>}
 */
async function listOllamaModels() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000); // timeout ngắn cho status check
  try {
    const res = await fetch(`${BASE_URL}/api/tags`, {
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' }
    });
    clearTimeout(timer);
    if (!res.ok) {
      return { ok: false, models: [], error: `Ollama trả HTTP ${res.status}` };
    }
    const data = await res.json();
    return { ok: true, models: Array.isArray(data?.models) ? data.models : [] };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return { ok: false, models: [], error: 'Hết thời gian kết nối tới Ollama (timeout 5s)' };
    }
    return { ok: false, models: [], error: 'Không thể kết nối tới dịch vụ Ollama' };
  }
}

/**
 * Kiểm tra trạng thái đầy đủ của Ollama + model Vision.
 * Trả về đối tượng trạng thái để frontend hiển thị chính xác.
 *
 * Phân biệt các case:
 *  1. Không kết nối được Ollama
 *  2. Ollama chạy nhưng chưa cài model Vision
 *  3. Model cấu hình không hỗ trợ Vision (text-only)
 *  4. Sẵn sàng
 *
 * @returns {Promise<{
 *   isRunning: boolean,
 *   isModelInstalled: boolean,
 *   supportsVision: boolean,
 *   configuredModel: string,
 *   ollamaVersion?: string,
 *   availableModels: string[],
 *   statusCode: string,
 *   message: string
 * }>}
 */
export async function checkOllamaStatus() {
  const configuredModel = VISION_MODEL;
  const configuredTextModel = TEXT_MODEL;

  // 1. Thử kết nối Ollama
  const { ok, models, error } = await listOllamaModels();

  if (!ok) {
    return {
      isRunning: false,
      isModelInstalled: false,
      supportsVision: false,
      configuredModel,
      configuredTextModel,
      isTextModelInstalled: false,
      availableModels: [],
      statusCode: 'OLLAMA_NOT_RUNNING',
      message: `Không kết nối được tới Ollama tại ${BASE_URL}. ${error || ''}. Hãy khởi động Ollama trước khi phân tích ảnh.`
    };
  }

  // 2. Ollama chạy — kiểm tra model
  const availableModelNames = models.map(m => m.name || '');

  // Kiểm tra model thị giác có được cài chưa
  const isModelInstalled = availableModelNames.some(name => {
    return name === configuredModel ||
           name.startsWith(configuredModel + ':') ||
           (configuredModel.includes(':') && name === configuredModel.split(':')[0]);
  });

  // Kiểm tra model dịch thuật văn bản có được cài chưa
  const isTextModelInstalled = availableModelNames.some(name => {
    return name === configuredTextModel ||
           name.startsWith(configuredTextModel + ':') ||
           (configuredTextModel.includes(':') && name === configuredTextModel.split(':')[0]);
  });

  if (!isModelInstalled) {
    const supportsVisionByName = isKnownVisionModel(configuredModel);
    return {
      isRunning: true,
      isModelInstalled: false,
      supportsVision: false,
      configuredModel,
      configuredTextModel,
      isTextModelInstalled,
      availableModels: availableModelNames,
      statusCode: 'MODEL_NOT_INSTALLED',
      message: `Ollama đang chạy nhưng chưa cài model thị giác "${configuredModel}". Chạy lệnh: ollama pull ${configuredModel}`
    };
  }

  // 3. Model đã cài — kiểm tra khả năng Vision
  const supportsVision = isKnownVisionModel(configuredModel);

  if (!supportsVision) {
    return {
      isRunning: true,
      isModelInstalled: true,
      supportsVision: false,
      configuredModel,
      configuredTextModel,
      isTextModelInstalled,
      availableModels: availableModelNames,
      statusCode: 'MODEL_TEXT_ONLY',
      message: `Model "${configuredModel}" là model văn bản (text-only), không hỗ trợ phân tích hình ảnh. Hãy đổi OLLAMA_VISION_MODEL thành "moondream:1.8b" trong file .env.`
    };
  }

  // 4. Sẵn sàng
  return {
    isRunning: true,
    isModelInstalled: true,
    supportsVision: true,
    configuredModel,
    configuredTextModel,
    isTextModelInstalled,
    availableModels: availableModelNames,
    statusCode: 'READY',
    message: `Sẵn sàng phân tích ảnh với "${configuredModel}" và chuyển ngữ "${configuredTextModel}" qua Ollama tại ${BASE_URL}.`
  };
}

/**
 * Chuẩn hóa và xác thực dữ liệu ảnh Base64 / Data URL
 * @param {string} rawInput
 * @returns {{ valid: boolean, error?: string, code?: string, cleanBase64?: string, buffer?: Buffer, format?: string, sizeBytes?: number }}
 */
export function validateAndNormalizeImage(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') {
    return { valid: false, error: 'Thiếu dữ liệu hình ảnh.', code: 'MISSING_IMAGE' };
  }
  let str = rawInput.trim();

  // Chặn nếu truyền URL thay vì nội dung ảnh
  if (/^(https?:\/\/|blob:|file:\/\/)/i.test(str)) {
    return { valid: false, error: 'Dữ liệu ảnh không được là đường dẫn URL hoặc blob URL. Vui lòng tải dữ liệu ảnh thật.', code: 'INVALID_IMAGE_URL' };
  }
  // Chặn nếu truyền đường dẫn tệp trên ổ đĩa
  if (/^[a-zA-Z]:\\/i.test(str) || /^(\/home\/|\/Users\/|\/var\/|\/tmp\/|\/uploads\/|\.\/|\.\.\/)/i.test(str)) {
    return { valid: false, error: 'Dữ liệu ảnh không được là đường dẫn tệp trên máy tính. Vui lòng tải dữ liệu ảnh thật.', code: 'INVALID_IMAGE_PATH' };
  }

  // Tách tiền tố data URL nếu có (data:image/jpeg;base64,...)
  let base64Part = str;
  if (str.startsWith('data:')) {
    const commaIdx = str.indexOf(',');
    if (commaIdx === -1) {
      return { valid: false, error: 'Định dạng Data URL không hợp lệ.', code: 'INVALID_DATA_URL' };
    }
    base64Part = str.slice(commaIdx + 1).trim();
  }

  // Loại bỏ khoảng trắng và ký tự xuống dòng
  base64Part = base64Part.replace(/\s+/g, '');

  if (base64Part.length < 100) {
    return { valid: false, error: 'Dữ liệu ảnh quá ngắn hoặc không hoàn chỉnh.', code: 'IMAGE_TOO_SHORT' };
  }

  // Kiểm tra bảng ký tự Base64 chuẩn [A-Za-z0-9+/=]
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64Part)) {
    return { valid: false, error: 'Dữ liệu ảnh chứa ký tự không hợp lệ trong định dạng base64.', code: 'INVALID_BASE64_CHARS' };
  }

  let buffer;
  try {
    buffer = Buffer.from(base64Part, 'base64');
  } catch {
    return { valid: false, error: 'Không thể giải mã dữ liệu base64 của ảnh.', code: 'DECODE_ERROR' };
  }

  // Giới hạn dung lượng tối đa 5 MB (5 * 1024 * 1024 bytes)
  const MAX_SIZE = 5 * 1024 * 1024;
  if (buffer.length > MAX_SIZE) {
    const sizeMb = (buffer.length / (1024 * 1024)).toFixed(2);
    return { valid: false, error: `Dung lượng tệp ảnh (${sizeMb} MB) vượt quá giới hạn tối đa cho phép là 5 MB.`, code: 'FILE_TOO_LARGE' };
  }

  if (buffer.length < 50) {
    return { valid: false, error: 'Nội dung tệp ảnh không hoàn chỉnh hoặc kích thước quá nhỏ.', code: 'EMPTY_FILE' };
  }

  // Xác thực định dạng bằng Magic Bytes
  const isJpeg = buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  const isPng = buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
  const isWebp = buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';

  if (!isJpeg && !isPng && !isWebp) {
    return {
      valid: false,
      error: 'Định dạng tệp không được hỗ trợ. Hệ thống chỉ chấp nhận ảnh định dạng JPG, PNG hoặc WebP hợp lệ.',
      code: 'UNSUPPORTED_IMAGE_FORMAT'
    };
  }

  const format = isJpeg ? 'jpeg' : isPng ? 'png' : 'webp';

  return {
    valid: true,
    cleanBase64: buffer.toString('base64'),
    buffer,
    format,
    sizeBytes: buffer.length
  };
}

/**
 * Chuyển ngữ bản mô tả quan sát thị giác từ tiếng Anh sang tiếng Việt qua mô hình văn bản cục bộ.
 * Tuân thủ nghiêm ngặt các nguyên tắc y khoa và an toàn thú cưng:
 * 1. Giữ nguyên ý nghĩa và mức độ không chắc chắn, không thêm bớt chi tiết.
 * 2. Không suy diễn các bộ phận ngoài khung hình (như bàn chân, dáng đứng/ngồi).
 * 3. Không kết luận thú cưng khỏe mạnh hay loại trừ bệnh tật.
 * 4. Phân biệt rõ "không quan sát rõ bất thường trong vùng ảnh" với việc loại trừ bệnh tật.
 * 5. Không kê đơn thuốc hoặc tạo bệnh án y khoa.
 * 6. Tiếng Việt thuần túy, tự nhiên, chuẩn xác thuật ngữ thú y.
 *
 * @param {{ rawEnglishText: string, signal?: AbortSignal }} params
 * @returns {Promise<string>}
 */
export async function translateObservationToVietnamese({ rawEnglishText, signal }) {
  if (!rawEnglishText || typeof rawEnglishText !== 'string') return '';

  // 1. Tiền xử lý bản tiếng Anh: thay thế các quán tính pretraining của model thị giác
  let sanitizedEnglish = rawEnglishText
    .replace(/\b(appears to be in good health|in good health|appears healthy|seems healthy)\b/gi, 
      'no obvious surface abnormalities are observed in this visible frame')
    .replace(/\b(no visible signs of (?:disease|illness|distress|injury)|no signs of (?:disease|illness|distress|injury))\b/gi, 
      'no obvious surface lesions or abnormalities observed in this visible area')
    .replace(/\b(healthy and well-maintained|well-maintained and healthy)\b/gi, 
      'clear and unobstructed')
    .trim();

  const messages = [
    {
      role: 'system',
      content: `Bạn là chuyên viên dịch thuật thú y chuyên nghiệp, trung thực và chính xác.
Nhiệm vụ: Dịch bản ghi nhận quan sát thú cưng sau từ tiếng Anh sang tiếng Việt tự nhiên, chính xác, giữ nguyên nghĩa và mức độ khách quan.

QUY TẮC BẮT BUỘC:
1. DỊCH TRUNG THỰC VÀ GIỮ NGUYÊN Ý NGHĨA: Dịch sát nghĩa từng câu, giữ nguyên sắc thái và mức độ chắc chắn của bản gốc. Tuyệt đối KHÔNG tự ý bổ sung chi tiết, không suy diễn thêm bất kỳ bộ phận cơ thể hay thông tin nào không có trong bản gốc.
2. KHÔNG KẾT LUẬN LOẠI TRỪ BỆNH: Dịch các câu quan sát bề mặt một cách khách quan (ví dụ: "không ghi nhận dấu hiệu bất thường rõ rệt trên bề mặt trong vùng quan sát"). Không khẳng định thú cưng hoàn toàn khỏe mạnh hay không có bệnh toàn thân.
3. THUẬT NGỮ THUẦN VIỆT CHUẨN XÁC:
   - whiskers -> ria mép (tuyệt đối không dịch thành ngón tay hay ngón chân)
   - nose -> mũi (không dịch thành nốt ruồi)
   - ears -> tai (không dịch thành ngón tai)
   - paws -> bàn chân, toes -> ngón chân, claws -> móng vuốt
   - fur -> lông, coat -> bộ lông, fluffy -> mềm mại/bông xù
   - close-up -> góc chụp cận cảnh, face -> khuôn mặt, eyes -> mắt
   - alert -> lanh lợi hoặc tỉnh táo
   Tuyệt đối không dùng chữ Hán hoặc ký tự ngoại lai.
4. Chỉ xuất duy nhất bản dịch tiếng Việt hoàn chỉnh, không kèm lời bình, lời mào đầu, chú thích hay dấu ngoặc kép bọc ngoài.`
    },
    {
      role: 'user',
      content: 'The cat has a few white whiskers and a pink nose.'
    },
    {
      role: 'assistant',
      content: 'Con mèo có vài sợi ria mép màu trắng và chiếc mũi màu hồng.'
    },
    {
      role: 'user',
      content: 'A close-up shot of the cat face. The eyes and ears are clearly visible.'
    },
    {
      role: 'assistant',
      content: 'Ảnh chụp cận cảnh khuôn mặt con mèo. Mắt và tai có thể quan sát rõ ràng.'
    },
    {
      role: 'user',
      content: `Dịch đoạn quan sát sau sang tiếng Việt:\n\n${sanitizedEnglish}`
    }
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout cho bước dịch
  if (signal) {
    signal.addEventListener('abort', () => {
      clearTimeout(timeoutId);
      controller.abort();
    });
  }

  try {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: TEXT_MODEL,
        messages,
        stream: false,
        options: {
          temperature: 0.1,
          repeat_penalty: 1.15,
          num_predict: 350
        }
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[Translation] Ollama /api/chat trả status ${res.status}`);
      return sanitizedEnglish;
    }

    const data = await res.json();
    let text = (data?.message?.content || '').trim();
    if (!text) return sanitizedEnglish;

    // 2. Hậu xử lý: chuẩn hóa văn phong và lọc bỏ triệt để các khẳng định loại trừ bệnh tuyệt đối
    text = text.replace(/^["'“`]+|["'”`]+$/g, '').trim();
    // Bỏ câu mào đầu của LLM nếu có
    text = text.replace(/^(đoạn quan sát được dịch sang tiếng việt như sau:?|bản dịch tiếng việt:?|dưới đây là bản dịch:?|đoạn dịch:?)\s*/i, '').trim();

    text = text.replace(/(được cho là|trông như đang|trông|có vẻ|hoàn toàn)\s+khỏe mạnh/gi, 
      'không quan sát rõ bất thường trên bề mặt trong vùng ảnh');
    text = text.replace(/không có bất kỳ dấu hiệu (nào )?(của |về )?(bệnh tật|thương tổn|tổn thương|bệnh lý)(\s+hoặc\s+(thương tổn|tổn thương|bệnh tật))?/gi, 
      'không quan sát rõ tổn thương hoặc bất thường bề mặt trong phạm vi góc chụp này');
    text = text.replace(/\bkhỏe mạnh\b/gi, 'bình thường trong phạm vi quan sát');

    // Chuyển đổi và làm sạch ký tự CJK còn sót từ pretraining đa ngữ
    text = text.replace(/绒毛/g, 'mềm mịn');
    text = text.replace(/四肢/g, 'các chi');
    text = text.replace(/[\u4e00-\u9fff]/g, '');

    // Chuẩn hóa một số từ vựng sai lệch hiếm gặp từ model nhỏ
    text = text.replace(/\bngón tai\b/gi, 'tai');

    return text.trim();
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(`[Translation] Lỗi khi chuyển ngữ qua ${TEXT_MODEL}:`, err?.message || err);
    return sanitizedEnglish;
  }
}

/**
 * Phân tích ảnh thú cưng qua Ollama với model Vision và chuyển ngữ sang tiếng Việt.
 *
 * Quy tắc:
 * - imageBase64 phải là dữ liệu ảnh thật (không phải tên file hay URL).
 * - Không trả kết quả giả khi model lỗi — throw Error thật.
 * - Có AbortSignal để caller hủy khi cần.
 *
 * @param {{
 *   imageBase64: string,
 *   petInfo: {name: string, species: string, breed?: string, age?: any, weight?: any},
 *   observationNotes: {location?: string, symptoms?: string, duration?: string},
 *   signal?: AbortSignal
 * }} params
 * @returns {Promise<{analysis: string, rawText: string, model: string, visionModel: string, textModel: string, analyzedAt: string}>}
 */
export async function analyzeImageWithOllama({ imageBase64, petInfo, observationNotes, signal }) {
  const model = VISION_MODEL;

  // Xác thực và chuẩn hóa dữ liệu ảnh thật (chấp nhận cả Base64 thuần và Data URL, nhận diện JPEG /9j/)
  const validation = validateAndNormalizeImage(imageBase64);
  if (!validation.valid) {
    throw new Error(validation.error || 'Dữ liệu ảnh không hợp lệ.');
  }
  const cleanImageBase64 = validation.cleanBase64;

  // Xây dựng ngữ cảnh thú cưng và ghi chú của chủ nuôi
  const speciesLabel = petInfo.species === 'cat' ? 'mèo' : petInfo.species === 'dog' ? 'chó' : (petInfo.species || 'thú cưng');
  const breedLabel = petInfo.breed && petInfo.breed !== 'Chưa cập nhật' ? petInfo.breed : 'chưa rõ giống';
  const ageLabel = petInfo.age ? `${petInfo.age} tuổi` : 'chưa rõ tuổi';
  const weightLabel = petInfo.weight ? `${petInfo.weight} kg` : 'chưa rõ cân nặng';

  const contextParts = [];
  if (observationNotes?.location) contextParts.push(`Vị trí quan sát: ${observationNotes.location}`);
  if (observationNotes?.symptoms) contextParts.push(`Biểu hiện chủ nuôi mô tả: ${observationNotes.symptoms}`);
  if (observationNotes?.duration) contextParts.push(`Thời gian xuất hiện: ${observationNotes.duration}`);

  // Prompt cho mô hình thị giác moondream:1.8b:
  // Tập trung tích cực vào các đặc điểm thực tế xuất hiện trong khung hình.
  // Tuyệt đối không dùng negative priming (tránh các từ cấm như 'paws', 'sitting', 'toes' làm kích hoạt token bịa đặt ở model nhỏ).
  const englishSpecies = petInfo.species === 'cat' ? 'cat' : petInfo.species === 'dog' ? 'dog' : 'pet';
  const prompt = `Observe this ${englishSpecies} photo (${breedLabel}).${contextParts.length > 0 ? ' User notes: ' + contextParts.join('; ') + '.' : ''}
Describe strictly what is directly visible inside the framed view:
- Observable physical features in this frame (fur coloration, eyes, face, ears, or visible coat).
- Confine the description strictly to the framed region; do not speculate on areas outside the frame.
- Note any visible skin or coat markings, discharge, or redness in the visible region, or note if no abnormalities are observed in this view.
- State visual facts only without medical diagnosis or declaring overall health.`;

  // Gọi Ollama API với dữ liệu ảnh thật
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  // Nếu caller có signal hủy riêng, lắng nghe nó
  if (signal) {
    signal.addEventListener('abort', () => {
      clearTimeout(timeoutId);
      controller.abort();
    });
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        images: [cleanImageBase64],   // Ollama nhận mảng base64 strings chuẩn sạch
        stream: false,
        options: {
          temperature: 0.1,      // Thấp để hạn chế bịa đặt
          num_predict: 350,      // Giới hạn độ dài output
        }
      }),
      signal: controller.signal
    });
  } catch (fetchErr) {
    clearTimeout(timeoutId);
    if (fetchErr.name === 'AbortError') {
      if (signal?.aborted) {
        throw new Error('ABORTED');  // Caller chủ động hủy
      }
      throw new Error(`Quá thời gian xử lý (${Math.round(TIMEOUT_MS / 1000)} giây). Mô hình AI cục bộ có thể đang bận hoặc chưa đủ tài nguyên.`);
    }
    throw new Error(`Lỗi kết nối tới Ollama: ${fetchErr.message}`);
  }

  clearTimeout(timeoutId);

  if (!response.ok) {
    let errDetail = '';
    try {
      const errBody = await response.json();
      errDetail = errBody?.error || '';
    } catch (_) {}
    throw new Error(`Ollama trả lỗi HTTP ${response.status}${errDetail ? ': ' + errDetail : ''}. Kiểm tra lại model "${model}" đã được cài đúng chưa.`);
  }

  let result;
  try {
    result = await response.json();
  } catch (_) {
    throw new Error('Ollama trả phản hồi không hợp lệ (không phải JSON). Vui lòng thử lại.');
  }

  const rawEnglish = (result?.response || '').trim();
  if (!rawEnglish) {
    throw new Error('Mô hình AI trả về nội dung rỗng. Có thể ảnh không chứa thú cưng hoặc không đủ ánh sáng để phân tích.');
  }

  // Chuyển ngữ sang tiếng Việt bằng mô hình ngôn ngữ cục bộ
  let vietnameseAnalysis = '';
  try {
    vietnameseAnalysis = await translateObservationToVietnamese({
      rawEnglishText: rawEnglish,
      signal
    });
  } catch (transErr) {
    console.warn('[Vision Analyze] Lỗi bước chuyển ngữ:', transErr?.message || transErr);
    vietnameseAnalysis = rawEnglish;
  }

  return {
    analysis: vietnameseAnalysis || rawEnglish,
    rawText: rawEnglish,
    model: `${model} + ${TEXT_MODEL}`,
    visionModel: model,
    textModel: TEXT_MODEL,
    analyzedAt: new Date().toISOString()
  };
}
