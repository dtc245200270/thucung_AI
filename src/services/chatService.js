import { apiFetch, getStoredAuthToken } from './apiService.js';

/**
 * Service Chatbot AI PetCare kết nối trực tiếp với backend cục bộ
 * Tuân thủ kiến trúc Local + RAG, bảo toàn phân quyền và lịch sử
 */

/**
 * Gửi tin nhắn hỏi đáp tư vấn tới Trợ lý chăm sóc thú cưng
 * @param {Object} params
 * @param {string} params.message - Nội dung câu hỏi của người dùng
 * @param {string|null} params.petId - ID thú cưng được chọn, hoặc null nếu Hỏi đáp chung
 * @returns {Promise<Object>} Phản hồi từ backend bao gồm { reply, sources, petContext }
 */
export const sendChatMessage = async ({ message, petId = null }) => {
  const token = getStoredAuthToken();
  if (!token) {
    throw new Error('Vui lòng đăng nhập để sử dụng Trợ lý chăm sóc thú cưng.');
  }

  // Gọi qua backend PetCare (route /api/chat hoặc /api/data/chat)
  const rawRes = await apiFetch('/chat', 'POST', {
    message,
    petId: petId || null
  });

  // Chuẩn hóa đảm bảo luôn trả về success, reply, sources, error bất kể apiFetch có bóc .data hay không
  const reply = rawRes?.reply || rawRes?.data?.reply || '';
  const sources = Array.isArray(rawRes?.sources)
    ? rawRes.sources
    : (Array.isArray(rawRes?.data?.sources) ? rawRes.data.sources : []);
  const error = rawRes?.error || rawRes?.data?.error || null;
  const code = rawRes?.code || rawRes?.data?.code || null;
  const technicalDetail = rawRes?.technicalDetail || rawRes?.data?.technicalDetail || null;
  const requestId = rawRes?.requestId || rawRes?.data?.requestId || null;
  const status = rawRes?.status || rawRes?.data?.status || (reply ? 'answered' : 'service_error');

  return {
    success: rawRes?.success !== false && Boolean(reply),
    requestId,
    status,
    reply,
    sources,
    error,
    code,
    technicalDetail
  };
};

/**
 * Tải lịch sử trò chuyện theo người dùng và phạm vi thú cưng
 * @param {string|null} petId - ID thú cưng hoặc null cho Hỏi đáp chung
 * @returns {Promise<Array>} Danh sách tin nhắn
 */
export const fetchChatHistory = async (petId = null) => {
  const token = getStoredAuthToken();
  if (!token) return [];

  const query = petId ? `?petId=${encodeURIComponent(petId)}` : '';
  try {
    const res = await apiFetch(`/chat/history${query}`, 'GET');
    return Array.isArray(res?.history) ? res.history : [];
  } catch (err) {
    console.warn('[ChatService] Lỗi tải lịch sử chat:', err);
    return [];
  }
};

/**
 * Xóa sạch lịch sử hội thoại của phạm vi hiện tại
 * @param {string|null} petId - ID thú cưng hoặc null cho Hỏi đáp chung
 * @returns {Promise<boolean>}
 */
export const clearChatHistory = async (petId = null) => {
  const token = getStoredAuthToken();
  if (!token) return false;

  const query = petId ? `?petId=${encodeURIComponent(petId)}` : '';
  const res = await apiFetch(`/chat/history${query}`, 'DELETE');
  return Boolean(res?.success);
};

/**
 * Lấy trạng thái hoạt động của trợ lý AI và dịch vụ cục bộ
 * @returns {Promise<Object>}
 */
export const fetchChatStatus = async () => {
  try {
    return await apiFetch('/chat/status', 'GET');
  } catch (err) {
    return {
      ollamaOnline: false,
      modelReady: false,
      embedReady: false,
      message: 'Không thể kết nối đến máy chủ AI.'
    };
  }
};
