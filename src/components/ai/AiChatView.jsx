import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
  Bot, 
  Send, 
  Sparkles, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle, 
  User, 
  ChevronDown, 
  Check, 
  Stethoscope, 
  HeartPulse, 
  X, 
  RotateCcw, 
  ExternalLink,
  BookOpen,
  Info,
  RefreshCw,
  ShieldCheck,
  Database
} from 'lucide-react';
import { sendChatMessage, fetchChatHistory, clearChatHistory, fetchChatStatus } from '../../services/chatService.js';
import { sound } from '../../services/soundService';

// Định dạng inline (in đậm, in nghiêng)
const renderInlineFormat = (text) => {
  if (!text) return '';
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-bold text-slate-900 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
      return (
        <em key={index} className="italic text-purple-700 dark:text-purple-300">
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
};

// Formatter Markdown cao cấp dành cho tin nhắn phản hồi của Trợ lý AI
const FormattedAiMessage = ({ text }) => {
  if (!text) return null;
  // Loại bỏ hoàn toàn dòng disclaimer nếu có trong văn bản để chỉ render 1 lần duy nhất ở footer
  const lines = text.split('\n').filter(l => !/thông tin chỉ mang tính tham khảo/i.test(l));

  return (
    <div className="space-y-1.5 text-xs sm:text-sm leading-relaxed text-slate-800 dark:text-slate-200">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-0.5" />;
        }

        // Callout cảnh báo (> ...)
        if (trimmed.startsWith('>')) {
          const content = trimmed.substring(1).trim();
          return (
            <div 
              key={idx}
              className="p-2.5 my-1.5 rounded-xl bg-purple-50 dark:bg-purple-500/10 border-l-2 border-purple-500 dark:border-purple-400 text-purple-900 dark:text-purple-200 text-xs font-medium flex items-start gap-2 shadow-xs"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
              <div>{renderInlineFormat(content)}</div>
            </div>
          );
        }

        // Header 3 (### )
        if (trimmed.startsWith('###')) {
          const headerText = trimmed.replace(/^###\s*/, '');
          let badgeColor = 'from-purple-600 to-indigo-600 text-white';
          let icon = <Stethoscope className="w-3.5 h-3.5" />;

          if (headerText.includes('Đánh giá') || headerText.includes('Khám')) {
            badgeColor = 'from-purple-600 to-indigo-500 text-white';
            icon = <Stethoscope className="w-3.5 h-3.5" />;
          } else if (headerText.includes('Hướng dẫn') || headerText.includes('Sơ cứu') || headerText.includes('Chăm sóc')) {
            badgeColor = 'from-emerald-600 to-teal-500 text-white';
            icon = <HeartPulse className="w-3.5 h-3.5" />;
          } else if (headerText.includes('Cấp cứu') || headerText.includes('Nguy hiểm') || headerText.includes('Cảnh báo')) {
            badgeColor = 'from-rose-600 to-red-500 text-white';
            icon = <ShieldAlert className="w-3.5 h-3.5" />;
          }

          return (
            <div key={idx} className="pt-2 pb-0.5">
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-black bg-gradient-to-r ${badgeColor} shadow-xs mb-1`}>
                {icon}
                <span>{headerText}</span>
              </div>
            </div>
          );
        }

        // Bullet point
        if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 dark:bg-purple-400 shrink-0 mt-1.5" />
              <div className="flex-1 text-slate-800 dark:text-slate-200">
                {renderInlineFormat(trimmed.replace(/^[-•*]\s*/, ''))}
              </div>
            </div>
          );
        }

        // Numbered list
        const numMatch = trimmed.match(/^(\d+)\.\s*(.*)/);
        if (numMatch) {
          const num = numMatch[1];
          const rest = numMatch[2];
          return (
            <div key={idx} className="flex items-start gap-2 pl-1.5">
              <span className="w-4 h-4 rounded-full bg-purple-100 dark:bg-purple-900/60 border border-purple-300 dark:border-purple-500/30 text-purple-800 dark:text-purple-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                {num}
              </span>
              <div className="flex-1 text-slate-800 dark:text-slate-200">
                {renderInlineFormat(rest)}
              </div>
            </div>
          );
        }

        return (
          <p key={idx} className="text-slate-800 dark:text-slate-200">
            {renderInlineFormat(trimmed)}
          </p>
        );
      })}
    </div>
  );
};

export const AiChatView = ({
  pets = [],
  activePetContextId = null,
  isOpen = false,
  onToggleOpen = () => {},
  initialPrompt = null
}) => {
  // Lựa chọn thú cưng: null hoặc 'general' là Hỏi đáp chung
  const [selectedPetId, setSelectedPetId] = useState(() => {
    return activePetContextId || 'general';
  });

  const [isPetDropdownOpen, setIsPetDropdownOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [lastFailedMessage, setLastFailedMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  // Trạng thái kiểm tra sức khỏe thực tế của AI & RAG (Yêu cầu 5)
  const [systemHealth, setSystemHealth] = useState({
    checking: true,
    isOllamaRunning: false,
    isTextModelReady: false,
    isEmbedModelReady: false,
    textModel: 'qwen2.5:1.5b',
    embedModel: 'embeddinggemma'
  });

  const modalRef = useRef(null);
  const petDropdownRef = useRef(null);
  const messagesEndRef = useRef(null);
  const chatScrollContainerRef = useRef(null);
  const activeRequestRef = useRef(0);

  // Thú cưng hiện tại đang chọn
  const selectedPet = useMemo(() => {
    if (!selectedPetId || selectedPetId === 'general') return null;
    return pets.find(p => p.id === selectedPetId) || null;
  }, [selectedPetId, pets]);

  // Đồng bộ prop activePetContextId nếu thay đổi từ bên ngoài
  useEffect(() => {
    if (activePetContextId) {
      setSelectedPetId(activePetContextId);
    }
  }, [activePetContextId]);

  // Tải lịch sử chat tương ứng khi chọn thú cưng hoặc vào Hỏi đáp chung
  const loadHistoryForCurrentScope = useCallback(async (petId) => {
    const currentScopePetId = petId === 'general' ? null : petId;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const history = await fetchChatHistory(currentScopePetId);
      if (Array.isArray(history) && history.length > 0) {
        setMessages(history.map((m, idx) => ({
          id: m.id || `hist-${idx}-${Date.now()}`,
          sender: m.sender || (m.role === 'user' ? 'user' : 'ai'),
          status: m.status || 'answered',
          text: (m.text || m.content || '').replace(/\*?\s*(?:Lưu ý:\s*)?Thông tin chỉ mang tính tham khảo[^*]*?\*?/gi, '').trim(),
          sources: Array.isArray(m.sources) ? m.sources : [],
          timestamp: m.timestamp ? (m.timestamp.includes('T') ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : m.timestamp) : ''
        })));
      } else {
        // Lịch sử trống -> Tin chào mừng mặc định
        const petLabel = petId && petId !== 'general' 
          ? (pets.find(p => p.id === petId)?.name || 'thú cưng') 
          : 'thú cưng của bạn';
        setMessages([
          {
            id: `welcome-${Date.now()}`,
            sender: 'ai',
            text: `Xin chào! Tôi là **Trợ lý chăm sóc thú cưng** PetCare.\n\nTôi hỗ trợ bạn tra cứu hồ sơ sức khỏe, nhắc lịch khám, đơn thuốc và giải đáp kiến thức chăm sóc theo tài liệu tham khảo chính thống cho **${petLabel}**.`,
            sources: [],
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }
    } catch (err) {
      console.warn('Lỗi tải lịch sử:', err);
    } finally {
      setIsLoading(false);
    }
  }, [pets]);

  // Theo dõi khi đổi selectedPetId
  useEffect(() => {
    loadHistoryForCurrentScope(selectedPetId);
  }, [selectedPetId, loadHistoryForCurrentScope]);

  // Nạp prompt ban đầu nếu có
  useEffect(() => {
    if (initialPrompt && typeof initialPrompt === 'string') {
      setInputMessage(initialPrompt);
    }
  }, [initialPrompt]);

  // Kiểm tra sức khỏe thực tế của Ollama & RAG
  const checkHealth = useCallback(async () => {
    try {
      const res = await fetchChatStatus();
      if (res?.success && res.data) {
        setSystemHealth({
          checking: false,
          isOllamaRunning: Boolean(res.data.isOllamaRunning),
          isTextModelReady: Boolean(res.data.isTextModelReady),
          isEmbedModelReady: Boolean(res.data.isEmbedModelReady),
          textModel: res.data.textModel || 'qwen2.5:1.5b',
          embedModel: res.data.embedModel || 'embeddinggemma',
          rag: res.data.rag || null
        });
      } else {
        setSystemHealth(prev => ({ ...prev, checking: false, isOllamaRunning: false }));
      }
    } catch (_) {
      setSystemHealth(prev => ({ ...prev, checking: false, isOllamaRunning: false }));
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      checkHealth();
      const interval = setInterval(checkHealth, 15000);
      return () => clearInterval(interval);
    }
  }, [isOpen, checkHealth]);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (petDropdownRef.current && !petDropdownRef.current.contains(e.target)) {
        setIsPetDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Tự cuộn thông minh: chỉ cuộn xuống nếu user ở gần đáy
  const scrollToBottom = (force = false) => {
    const container = chatScrollContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
    if (force || isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Xử lý gửi tin nhắn (isRetry = true khi bấm Thử lại để không tạo trùng tin nhắn người dùng)
  const handleSendMessage = async (textToSend = null, isRetry = false) => {
    const message = (textToSend || inputMessage).trim();
    if (!message || isLoading) return;

    const reqId = ++activeRequestRef.current;
    const petIdParam = selectedPetId === 'general' ? null : selectedPetId;

    try { sound?.playPop?.(); } catch {}

    if (isRetry) {
      setMessages(prev => prev.filter(m => !m.isError));
    } else {
      const userMsg = {
        id: `user-${Date.now()}`,
        sender: 'user',
        text: message,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, userMsg]);
      setInputMessage('');
    }

    setLastFailedMessage(null);
    setErrorMessage(null);
    setIsLoading(true);
    setTimeout(() => scrollToBottom(true), 50);

    try {
      const res = await sendChatMessage({
        message,
        petId: petIdParam
      });

      if (reqId !== activeRequestRef.current) return;

      if (!res.success) {
        throw new Error(res.error || 'Trợ lý AI chưa thể trả lời câu hỏi lúc này. Vui lòng thử lại.');
      }

      try { sound?.playSuccess?.(); } catch {}

      const aiMsg = {
        id: res.requestId || `ai-${Date.now()}`,
        sender: 'ai',
        status: res.status || 'answered',
        text: (res.reply || 'Không có phản hồi.').replace(/\*?\s*(?:Lưu ý:\s*)?Thông tin chỉ mang tính tham khảo[^*]*?\*?/gi, '').trim(),
        sources: Array.isArray(res.sources) ? res.sources : [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, aiMsg]);
      setInputMessage('');
      setLastFailedMessage(null);
      setErrorMessage(null);
      setTimeout(() => scrollToBottom(true), 50);
    } catch (err) {
      if (reqId !== activeRequestRef.current) return;
      console.error('[ChatView] Lỗi gửi chat:', err);
      try { sound?.playPop?.(); } catch {}
      
      const errText = err.message || 'Không thể kết nối đến Trợ lý chăm sóc thú cưng.';
      setErrorMessage(errText);
      setInputMessage(message);
      setLastFailedMessage(message);

      const errAiMsg = {
        id: `ai-err-${Date.now()}`,
        sender: 'ai',
        isError: true,
        text: `⚠️ **Thông báo hệ thống:**\n${errText}`,
        sources: [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errAiMsg]);
    } finally {
      if (reqId === activeRequestRef.current) {
        setIsLoading(false);
      }
    }
  };

  const handleRetryLast = () => {
    const questionSource = lastFailedMessage || inputMessage;
    if (questionSource && questionSource.trim()) {
      handleSendMessage(questionSource.trim(), true);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Làm mới cuộc trò chuyện (có xác nhận)
  const handleConfirmReset = async () => {
    setShowConfirmReset(false);
    try { sound?.playClick?.(); } catch {}
    const petIdParam = selectedPetId === 'general' ? null : selectedPetId;
    await clearChatHistory(petIdParam);
    await loadHistoryForCurrentScope(selectedPetId);
  };

  return (
    <>
      {/* =================================================================== */}
      {/* 1. NÚT MỞ CHATBOT CỐ ĐỊNH GÓC DƯỚI BÊN PHẢI (CÁCH CẠNH 20-24PX)      */}
      {/* =================================================================== */}
      <div className="fixed bottom-5 sm:bottom-6 right-5 sm:right-6 z-40 select-none">
        <button
          type="button"
          onClick={() => onToggleOpen(!isOpen)}
          className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-indigo-700 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-indigo-500/30 flex items-center justify-center relative group border border-white/20 cursor-pointer"
          title={isOpen ? "Thu nhỏ Trợ lý chăm sóc thú cưng" : "Mở Trợ lý chăm sóc thú cưng"}
        >
          <Bot className={`w-7 h-7 text-white transition-transform duration-200 ${isOpen ? 'rotate-12' : 'group-hover:rotate-6'}`} />
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 pointer-events-none">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-400 border-2 border-white dark:border-slate-900" />
          </span>
        </button>
      </div>

      {/* =================================================================== */}
      {/* 2. KHUNG CHAT CỐ ĐỊNH CÙNG GÓC, PHÍA TRÊN NÚT MỞ (RỘNG 380-400PX)   */}
      {/* =================================================================== */}
      {isOpen && (
        <div 
          ref={modalRef}
          className="fixed z-50 right-3 sm:right-6 bottom-22 sm:bottom-24 w-[calc(100vw-1.5rem)] sm:w-[390px] h-[580px] max-h-[min(600px,calc(100vh-115px))] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl sm:rounded-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {/* HEADER CỐ ĐỊNH TRONG KHUNG */}
          <div className="bg-slate-50/95 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 p-3 sm:p-3.5 shrink-0 relative z-20 select-none">
            <div className="flex items-center justify-between gap-2">
              {/* Tiêu đề & trạng thái sức khỏe hệ thống */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-2xl bg-indigo-50 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-400/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Bot className="w-5 h-5" />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm tracking-wide truncate">
                      Trợ lý thú cưng
                    </h3>
                    {systemHealth.checking ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />
                        Đang kiểm tra...
                      </span>
                    ) : !systemHealth.isOllamaRunning ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 bg-rose-50 dark:text-rose-400 dark:bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-500/20 shrink-0" title="Dịch vụ Ollama chưa bật">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        Ollama tắt
                      </span>
                    ) : !systemHealth.isTextModelReady ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-500/20 shrink-0" title="Chưa có model text">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Thiếu model
                      </span>
                    ) : (systemHealth.rag?.isReindexing) ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 dark:text-indigo-300 dark:bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-500/20 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                        Đang lập chỉ mục...
                      </span>
                    ) : !systemHealth.isEmbedModelReady ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-500/20 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Sẵn sàng (Cơ sở)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/20 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Sẵn sàng
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {selectedPet ? `Đang xem: ${selectedPet.name}` : 'Chế độ: Hỏi đáp chung'}
                  </p>
                </div>
              </div>

              {/* Nút hành động */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowConfirmReset(true)}
                  className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer"
                  title="Cuộc trò chuyện mới"
                >
                  <RotateCcw size={14} />
                </button>

                <button
                  type="button"
                  onClick={() => onToggleOpen(false)}
                  className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer"
                  title="Đóng khung chat"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          </div>

          {/* MODAL XÁC NHẬN CUỘC TRÒ CHUYỆN MỚI */}
          {showConfirmReset && (
            <div className="absolute inset-x-3 top-16 z-30 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <p className="text-xs font-bold text-slate-900 dark:text-white mb-1">Bắt đầu cuộc trò chuyện mới?</p>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mb-3 leading-relaxed">
                Lịch sử trao đổi trong phạm vi {selectedPet ? `"${selectedPet.name}"` : 'Hỏi đáp chung'} sẽ được làm mới.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmReset(false)}
                  className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-medium cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReset}
                  className="px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
                >
                  Xác nhận xóa
                </button>
              </div>
            </div>
          )}

          {/* THANH CHỌN PHẠM VI (CỐ ĐỊNH DƯỚI HEADER) */}
          <div className="px-3.5 py-2 bg-slate-100/70 dark:bg-slate-950/40 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between shrink-0 relative z-20">
            <div className="relative" ref={petDropdownRef}>
              <button 
                type="button"
                onClick={() => setIsPetDropdownOpen(!isPetDropdownOpen)}
                className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <span>🐾</span>
                <span className="truncate max-w-[190px]">
                  {selectedPet ? `${selectedPet.name} (${selectedPet.species === 'cat' ? 'Mèo' : selectedPet.species === 'dog' ? 'Chó' : 'Thú cưng'})` : 'Hỏi đáp chung'}
                </span>
                <ChevronDown size={12} className={`text-slate-500 dark:text-slate-400 transition-transform ${isPetDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isPetDropdownOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-64 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 px-2.5 py-1 uppercase tracking-wider">
                    Phạm vi tư vấn:
                  </p>
                  <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
                    {/* Lựa chọn Hỏi đáp chung */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPetId('general');
                        setIsPetDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                        selectedPetId === 'general' 
                          ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-500/30' 
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>🌐 Hỏi đáp chung (Không gắn hồ sơ)</span>
                      {selectedPetId === 'general' && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                    </button>

                    {/* Danh sách thú cưng của người nuôi */}
                    {pets.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedPetId(p.id);
                          setIsPetDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                          selectedPetId === p.id 
                            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-500/30' 
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="truncate">
                          🐶 {p.name} ({p.species === 'cat' ? 'Mèo' : p.species === 'dog' ? 'Chó' : 'Thú cưng'} • {p.weight != null ? `${p.weight}kg` : 'Chưa cân'})
                        </span>
                        {selectedPetId === p.id && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>
              RAG Cục bộ
            </span>
          </div>

          {/* DANH SÁCH TIN NHẮN (DUY NHẤT CUỘN) */}
          <div 
            ref={chatScrollContainerRef}
            className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3.5 bg-slate-50/50 dark:bg-slate-900/60 custom-scrollbar"
          >
            {messages.map((msg) => {
              const isAi = msg.sender === 'ai';

              return (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 max-w-[94%] ${isAi ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}
                >
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                    isAi 
                      ? 'bg-indigo-50 text-indigo-600 border border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-400 dark:border-indigo-400/30' 
                      : 'bg-gradient-to-tr from-indigo-500 to-purple-600 text-white'
                  }`}>
                    {isAi ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>

                  {/* Bong bóng tin nhắn */}
                  <div className={`rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed max-w-[90%] break-words ${
                    isAi
                      ? (msg.isError 
                          ? 'bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/50 dark:border-rose-500/30 dark:text-rose-200' 
                          : 'bg-white border border-slate-200/90 text-slate-800 shadow-xs dark:bg-slate-800/95 dark:border-slate-700/80 dark:text-slate-100 rounded-tl-xs')
                      : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-tr-xs shadow-xs'
                  }`}>
                    {/* Nội dung markdown */}
                    <FormattedAiMessage text={msg.text} />

                    {/* KHU VỰC NGUỒN DỮ LIỆU & TÀI LIỆU THAM KHẢO */}
                    {isAi && Array.isArray(msg.sources) && msg.sources.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-200/80 dark:border-slate-700/80 space-y-2">
                        {/* 1. Nguồn dữ liệu từ Hồ sơ / Lịch / Bệnh án nội bộ */}
                        {msg.sources.some(s => s.type?.startsWith('pet_')) && (
                          <div className="space-y-1">
                            <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span>Nguồn dữ liệu hồ sơ:</span>
                            </div>
                            {msg.sources.filter(s => s.type?.startsWith('pet_')).map((src, sIdx) => (
                              <div 
                                key={`pet-src-${sIdx}`}
                                className="bg-emerald-50/80 dark:bg-emerald-950/30 rounded-xl p-2 border border-emerald-200 dark:border-emerald-500/25 text-[11px] space-y-0.5"
                              >
                                <div className="font-semibold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                                  <Database className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  <span>{src.title || src.name}</span>
                                </div>
                                {src.organization && (
                                  <div className="text-[10px] text-emerald-700 dark:text-emerald-400/80 pl-4.5">
                                    Cơ sở dữ liệu: {src.organization}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 2. Nguồn tài liệu y khoa chính thống từ RAG (Cornell, AAHA...) */}
                        {msg.sources.some(s => !s.type?.startsWith('pet_')) && (
                          <div className="space-y-1">
                            <div className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                              <BookOpen className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                              <span>
                                {msg.status === 'insufficient_evidence' 
                                  ? 'Tài liệu liên quan (chưa đủ căn cứ trực tiếp trả lời):' 
                                  : 'Nguồn tài liệu y khoa tham khảo:'}
                              </span>
                            </div>
                            {msg.sources.filter(s => !s.type?.startsWith('pet_')).map((src, sIdx) => (
                              <div 
                                key={`rag-src-${sIdx}`}
                                className="bg-indigo-50/70 dark:bg-slate-850 rounded-xl p-2 border border-indigo-200/80 dark:border-slate-700 text-[11px] space-y-0.5"
                              >
                                <div className="font-semibold text-slate-900 dark:text-slate-100">
                                  {src.name || src.title || src.sourceId}
                                </div>
                                {src.organization && (
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                    Tổ chức: {src.organization}
                                  </div>
                                )}
                                {src.url && (
                                  <a
                                    href={src.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline pt-0.5"
                                  >
                                    <span>Đọc thêm tài liệu gốc</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Ghi chú y tế bắt buộc cho tin nhắn AI */}
                    {isAi && !msg.isError && (
                      <div className="mt-2 text-[10px] text-slate-400 dark:text-slate-500 italic flex items-center gap-1 border-t border-slate-100 dark:border-slate-700/60 pt-1.5">
                        <Info className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" />
                        <span>Thông tin chỉ mang tính tham khảo, không thay thế khám thú y.</span>
                      </div>
                    )}

                    {/* Timestamp */}
                    <span className={`block text-[9px] mt-1 text-right ${isAi ? 'text-slate-400 dark:text-slate-500' : 'text-purple-200/90'}`}>
                      {msg.timestamp}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Trạng thái Đang trả lời */}
            {isLoading && (
              <div className="flex gap-2.5 max-w-[85%] mr-auto animate-in fade-in duration-200">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-400/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 animate-pulse" />
                </div>
                <div className="bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-2xl p-2.5 text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2.5 shadow-xs">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '180ms' }} />
                    <span className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '360ms' }} />
                  </div>
                  <span className="font-semibold text-xs">
                    Đang trả lời…
                  </span>
                </div>
              </div>
            )}

            {/* Nút thử lại nếu câu hỏi vừa rồi gặp lỗi */}
            {errorMessage && lastFailedMessage && !isLoading && (
              <div className="flex justify-center pt-1 pb-1">
                <button
                  type="button"
                  onClick={handleRetryLast}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/20 hover:bg-indigo-100 dark:hover:bg-indigo-500/30 border border-indigo-200 dark:border-indigo-500/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold cursor-pointer transition-all active:scale-95 shadow-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Thử lại câu hỏi vừa rồi</span>
                </button>
              </div>
            )}

            <div ref={messagesEndRef} className="h-2" />
          </div>

          {/* Ô NHẬP LIỆU CỐ ĐỊNH Ở ĐÁY */}
          <div className="shrink-0 bg-white dark:bg-slate-950/90 border-t border-slate-200 dark:border-slate-800 p-3">
            <div className="flex items-center gap-2">
              <textarea
                rows={1}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                placeholder={
                  selectedPet 
                    ? `Hỏi về ${selectedPet.name}... (Enter để gửi)` 
                    : 'Nhập câu hỏi chăm sóc... (Enter để gửi)'
                }
                className="flex-1 rounded-2xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 focus:border-indigo-500 dark:focus:border-indigo-400 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none text-xs sm:text-sm px-4 py-2.5 transition-all shadow-inner resize-none disabled:opacity-50"
              />

              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!inputMessage.trim() || isLoading}
                className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-30 shadow-xs text-white flex items-center justify-center shrink-0 active:scale-95 transition-all cursor-pointer"
                title="Gửi tin nhắn"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AiChatView;
