import React, { useState, useEffect, useRef } from 'react';
import { 
  Scan, 
  Upload, 
  Sparkles, 
  CheckCircle2, 
  RefreshCw, 
  AlertTriangle, 
  Stethoscope, 
  Bandage, 
  Microscope, 
  Info, 
  ShieldCheck, 
  AlertCircle, 
  FileText, 
  Trash2, 
  X, 
  Clock, 
  BookmarkPlus, 
  BookOpen,
  ArrowRight
} from 'lucide-react';
import { sound } from '../../services/soundService';
import { PageContainer, PageHeader, Card, Tabs, Modal, EmptyState } from '../common/ui';

// =========================================================================
// 1. TÀI LIỆU THAM KHẢO BỆNH LÝ DA LIỄU THÚ CƯNG THƯỜNG GẶP
// Tách biệt hoàn toàn khỏi luồng phân tích của AI. Không dùng ảnh mẫu để phân tích.
// =========================================================================
export const PET_PATHOLOGY_DATASET = {
  fad: {
    id: 'fad',
    name: 'Viêm da dị ứng bọ chét / ve rận (Flea Allergy Dermatitis - FAD)',
    category: 'Ngoại ký sinh trùng',
    riskLevel: 'Cần thăm khám',
    riskColor: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-500/10 dark:border-amber-500/20',
    symptoms: [
      'Mẩn đỏ li ti dạng hạt, tập trung nhiều ở vùng sống lưng, bẹn và gốc đuôi.',
      'Da sậm màu, dày sừng do cọ xát cắn gãi liên tục.',
      'Có thể thấy các chấm đen nhỏ li ti (phân bọ chét) bám sát chân lông.'
    ],
    careTips: [
      'Đeo vòng cổ chống liếm (loa Elizabeth) để tránh bé cắn rách da gây nhiễm trùng.',
      'Vệ sinh nhẹ nhàng bằng nước muối sinh lý ấm, không tự ý bôi thuốc mỡ của người.',
      'Sử dụng thuốc trị ngoại ký sinh trùng theo đúng chỉ định của bác sĩ thú y.'
    ],
    vetAdvice: 'Cần đưa đến phòng khám để bác sĩ kiểm tra lông da và chải phân bọ chét xác định nguyên nhân.'
  },
  ringworm: {
    id: 'ringworm',
    name: 'Nấm da tròn đồng xu (Ringworm / Dermatophytosis)',
    category: 'Nhiễm vi nấm biểu bì',
    riskLevel: 'Cần cách ly & thăm khám',
    riskColor: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-500/10 dark:border-amber-500/20',
    symptoms: [
      'Vùng rụng lông hình tròn viền gờ đỏ nổi rõ như đồng xu.',
      'Bề mặt da phủ vảy trắng xám như gàu, sợi lông khô giòn dễ gãy sát gốc.',
      'LƯU Ý: Bệnh có khả năng lây lan sang người và các thú cưng khác.'
    ],
    careTips: [
      'Cách ly thú cưng riêng biệt, khử trùng ổ nằm và khu vực sinh hoạt.',
      'Đeo găng tay khi tiếp xúc, tắm rửa hoặc bôi thuốc cho bé.',
      'Dùng dung dịch sát khuẩn dịu nhẹ, giữ vùng da tổn thương luôn khô ráo.'
    ],
    vetAdvice: 'Cần đưa đến bác sĩ để soi đèn Wood (Wood’s Lamp) phát quang và cấy nấm DTM định danh chủng nấm.'
  },
  demodex: {
    id: 'demodex',
    name: 'Xà mâu Demodex & Viêm nấm men Malassezia',
    category: 'Ký sinh trùng nang lông & Nấm men',
    riskLevel: 'Cần can thiệp y tế',
    riskColor: 'text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-300 dark:bg-rose-500/10 dark:border-rose-500/20',
    symptoms: [
      'Kẽ móng và đệm bàn chân sưng đỏ, nhờn rít, rỉ dịch mủ mùi chua nồng.',
      'Rụng lông quầng mắt và khóe mép sưng tấy, ngứa ngáy dữ dội.',
      'Bé thường xuyên cắn móng, liếm chân và đi khập khiễng do đau buốt.'
    ],
    careTips: [
      'Ngâm rửa chân bằng dung dịch sát khuẩn chuyên dụng theo hướng dẫn thú y.',
      'Sấy khô tuyệt đối kẽ móng sau khi tắm rửa (môi trường ẩm ướt kích thích nấm men phát triển).',
      'Không dùng xà phòng giữ ẩm vì dễ làm trầm trọng tình trạng nấm men.'
    ],
    vetAdvice: 'Cần cạo sâu biểu bì (Deep Scraping) đến khi rớm máu nhẹ để đếm mật độ ký sinh trùng dưới kính hiển vi.'
  },
  pyoderma: {
    id: 'pyoderma',
    name: 'Viêm da mủ & Viêm loét vi khuẩn (Pyoderma)',
    category: 'Nhiễm khuẩn tụ cầu da (Staphylococcus)',
    riskLevel: 'Cần can thiệp y tế',
    riskColor: 'text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-300 dark:bg-rose-500/10 dark:border-rose-500/20',
    symptoms: [
      'Nhiều bọc mụn mủ nhỏ li ti, vảy tiết đóng thành mảng màu mật ong.',
      'Vùng da trợt loét, sưng phù, chảy dịch và đau đớn khi chạm vào.',
      'Rụng lông nham nhở xung quanh vùng viêm nhiễm.'
    ],
    careTips: [
      'Tuyệt đối không bóp hoặc nặn các nốt mụn mủ tránh vi khuẩn ăn sâu vào mô dưới da.',
      'Chấm rửa nhẹ nhàng bằng cồn đỏ Povidine 10% pha loãng.',
      'Đeo vòng cổ Elizabeth liên tục để ngăn thú cưng liếm vết thương.'
    ],
    vetAdvice: 'Cần khám trực tiếp để bác sĩ làm kháng sinh đồ và kê đơn thuốc kháng sinh điều trị phù hợp.'
  }
};

export const AiVisionScannerView = ({
  pets = [],
  currentUser = null,
  onOpenAddSchedule,
  onOpenVetBooking
}) => {
  // 1. Quản lý Thú cưng & Thông tin quan sát
  const [selectedPetId, setSelectedPetId] = useState(() => pets?.[0]?.id || '');
  const [observationNotes, setObservationNotes] = useState({
    location: '',
    symptoms: '',
    duration: ''
  });

  // 2. Quản lý Ảnh (JPG, PNG, WebP tối đa 5 MB)
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageBase64, setImageBase64] = useState('');
  const [imageFileError, setImageFileError] = useState(null);

  // 3. Trạng thái phân tích & Hủy
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState(null);
  const abortControllerRef = useRef(null);
  const activeSessionIdRef = useRef(null);

  // 4. Trạng thái mô hình AI cục bộ
  const [modelStatus, setModelStatus] = useState(null);
  const [isCheckingModel, setIsCheckingModel] = useState(false);
  const [activeTab, setActiveTab] = useState('observe'); // 'observe' | 'reference'

  // 5. Lưu kết quả tham khảo & Đặt lịch
  const [isSavingObservation, setIsSavingObservation] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState(null);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isBookingConfirmOpen, setIsBookingConfirmOpen] = useState(false);

  const fileInputRef = useRef(null);

  // Đồng bộ selectedPetId khi danh sách thú cưng thay đổi
  useEffect(() => {
    if (pets?.length > 0 && !selectedPetId) {
      setSelectedPetId(pets[0].id);
    }
  }, [pets, selectedPetId]);

  // Kiểm tra trạng thái mô hình cục bộ — gọi backend thật, không suy diễn
  const fetchModelStatus = async () => {
    setIsCheckingModel(true);
    try {
      const res = await fetch('/api/ai/vision-status');
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setModelStatus(data);
      } else {
        setModelStatus({
          isRunning: false,
          isModelInstalled: false,
          supportsVision: false,
          configuredModel: data?.configuredModel || 'moondream:1.8b',
          statusCode: 'BACKEND_ERROR',
          message: data?.message || `Không thể kết nối đến backend PetCare (HTTP ${res.status}). Kiểm tra server đang chạy chưa.`
        });
      }
    } catch (err) {
      console.warn('[AI Vision] Lỗi kết nối backend khi kiểm tra Ollama:', err);
      setModelStatus({
        isRunning: false,
        isModelInstalled: false,
        supportsVision: false,
        configuredModel: 'moondream:1.8b',
        statusCode: 'NETWORK_ERROR',
        message: 'Không thể kết nối tới backend PetCare. Kiểm tra server đang chạy (npm run server) và thử lại.'
      });
    } finally {
      setIsCheckingModel(false);
    }
  };

  useEffect(() => {
    fetchModelStatus();
  }, []);

  // Đổi thú cưng: Xóa ảnh, mô tả và kết quả của lần phân tích trước để tránh gắn nhầm
  const handlePetChange = (newPetId) => {
    if (newPetId === selectedPetId) return;
    try { sound?.playPop?.(); } catch (_) {}
    setSelectedPetId(newPetId);
    handleClearImage();
    setObservationNotes({ location: '', symptoms: '', duration: '' });
    setScanResult(null);
    setScanError(null);
    setSaveSuccessMessage(null);
  };

  // Xóa ảnh đã chọn
  const handleClearImage = () => {
    if (selectedImage && selectedImage.startsWith('blob:')) {
      URL.revokeObjectURL(selectedImage);
    }
    setSelectedImage(null);
    setImageBase64('');
    setImageFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Xử lý đọc và chuẩn hóa dữ liệu ảnh (giữ chất lượng, canvas nén nhẹ nếu quá lớn, fallback FileReader)
  const processImageFile = (file) => {
    return new Promise((resolve, reject) => {
      // Helper đọc trực tiếp bằng FileReader
      const readDirectly = () => {
        const reader = new FileReader();
        reader.onload = () => {
          const res = reader.result;
          if (typeof res === 'string') {
            const b64 = res.includes(',') ? res.split(',')[1] : res;
            resolve(b64);
          } else {
            reject(new Error('Không thể đọc dữ liệu tệp ảnh.'));
          }
        };
        reader.onerror = () => reject(new Error('Lỗi khi đọc tệp ảnh.'));
        reader.readAsDataURL(file);
      };

      try {
        const img = new Image();
        const objUrl = URL.createObjectURL(file);
        img.src = objUrl;

        img.onload = () => {
          URL.revokeObjectURL(objUrl);
          try {
            const canvas = document.createElement('canvas');
            const maxDim = 1200;
            let { width, height } = img;
            if (width > height && width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const mime = file.type === 'image/png' ? 'image/png' : file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
            const dataUrl = canvas.toDataURL(mime, 0.9);
            const b64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
            resolve(b64);
          } catch {
            readDirectly();
          }
        };

        img.onerror = () => {
          URL.revokeObjectURL(objUrl);
          readDirectly();
        };
      } catch {
        readDirectly();
      }
    });
  };

  // Tải ảnh từ máy tính (Kiểm tra định dạng và dung lượng tối đa 5 MB)
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFileError(null);
    setScanError(null);
    setSaveSuccessMessage(null);

    // 1. Kiểm tra dung lượng (Tối đa 5 MB)
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      setImageFileError('Dung lượng tệp vượt quá 5 MB. Vui lòng chọn ảnh có dung lượng nhỏ hơn.');
      try { sound?.playPop?.(); } catch (_) {}
      return;
    }

    // 2. Kiểm tra loại tệp
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setImageFileError('Định dạng tệp không được hỗ trợ. Vui lòng chọn tệp ảnh JPG, PNG hoặc WebP.');
      try { sound?.playPop?.(); } catch (_) {}
      return;
    }

    try {
      sound?.playPop?.();
      const previewUrl = URL.createObjectURL(file);
      setSelectedImage(previewUrl);

      const b64 = await processImageFile(file);
      setImageBase64(b64);
      setScanResult(null);
    } catch (err) {
      setImageFileError('Không thể nạp tệp hình ảnh: ' + (err?.message || 'Lỗi xử lý'));
      handleClearImage();
    }
  };

  // Yêu cầu phân tích ảnh
  const handleTriggerAnalysis = async () => {
    if (isAnalyzing) return;
    if (!selectedPetId) {
      setScanError('Vui lòng chọn thú cưng để tiếp tục.');
      return;
    }
    if (!imageBase64) {
      setScanError('Vui lòng tải lên ảnh chụp vùng da/lông cần quan sát.');
      return;
    }

    // Kiểm tra tính khả dụng của mô hình
    if (!modelStatus?.isRunning) {
      setScanError('Dịch vụ AI cục bộ (Ollama) hiện chưa chạy tại máy chủ. Vui lòng khởi động Ollama trước khi phân tích.');
      return;
    }
    if (!modelStatus?.supportsVision) {
      setScanError(`Mô hình AI cục bộ đang cấu hình ("${modelStatus?.configuredModel || 'qwen3:1.7b'}") là mô hình văn bản, không hỗ trợ nhận diện hình ảnh. Hệ thống không tạo kết quả giả lập.`);
      return;
    }

    try { sound?.playPop?.(); } catch (_) {}
    setIsAnalyzing(true);
    setScanResult(null);
    setScanError(null);
    setSaveSuccessMessage(null);

    const sessionId = Date.now().toString();
    activeSessionIdRef.current = sessionId;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const token = localStorage.getItem('petcare_token') || localStorage.getItem('petcare_auth_token');
      const response = await fetch('/api/ai/vision-analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`
        },
        body: JSON.stringify({
          petId: selectedPetId,
          imageBase64,
          observationNotes
        }),
        signal: controller.signal
      });

      // Nếu phiên đã bị hủy hoặc chuyển sang phiên mới, bỏ qua kết quả
      if (activeSessionIdRef.current !== sessionId) return;

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        const errorMsg = data?.error || 'Chưa thể phân tích ảnh. Vui lòng thử lại sau.';
        setScanError(errorMsg);
        try { sound?.playPop?.(); } catch (_) {}
      } else {
        setScanResult(data.data);
        try { sound?.playSuccess?.(); } catch (_) {}
      }
    } catch (err) {
      if (activeSessionIdRef.current !== sessionId) return;
      if (err.name === 'AbortError') {
        setScanError('Đã hủy yêu cầu phân tích theo thao tác của bạn.');
      } else {
        setScanError('Chưa thể phân tích ảnh. Vui lòng thử lại sau.');
      }
    } finally {
      if (activeSessionIdRef.current === sessionId) {
        setIsAnalyzing(false);
      }
    }
  };

  // Nút Hủy phân tích
  const handleCancelAnalysis = () => {
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch (_) {}
    }
    activeSessionIdRef.current = null;
    setIsAnalyzing(false);
    setScanError('Đã hủy phân tích ảnh. Toàn bộ ảnh và mô tả của bạn vẫn được giữ nguyên.');
    try { sound?.playPop?.(); } catch (_) {}
  };

  // Lưu kết quả quan sát tham khảo (Chủ động xác nhận)
  const handleSaveObservationConfirm = async () => {
    if (!scanResult || !selectedPetId) return;
    setIsSavingObservation(true);
    try {
      const token = localStorage.getItem('petcare_token') || localStorage.getItem('petcare_auth_token');
      const res = await fetch('/api/ai/save-observation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`
        },
        body: JSON.stringify({
          petId: selectedPetId,
          observationNotes,
          aiFindings: scanResult.analysis,
          model: scanResult.model
        })
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setSaveSuccessMessage('Đã lưu kết quả quan sát tham khảo thành công. Kết quả này được lưu riêng, không ảnh hưởng đến bệnh án của bác sĩ.');
        setIsSaveModalOpen(false);
        try { sound?.playSuccess?.(); } catch (_) {}
      } else {
        alert(data?.error || 'Không thể lưu kết quả quan sát. Vui lòng thử lại.');
      }
    } catch (err) {
      console.error('Lỗi khi lưu kết quả:', err);
      alert('Lỗi kết nối máy chủ khi lưu kết quả.');
    } finally {
      setIsSavingObservation(false);
    }
  };

  // Xử lý chuyển sang đặt lịch khám
  const handleProceedBooking = (includeAiNotes) => {
    setIsBookingConfirmOpen(false);
    try { sound?.playClick?.(); } catch (_) {}

    let noteContent = '';
    if (includeAiNotes) {
      const parts = [];
      if (observationNotes.location) parts.push(`Vị trí: ${observationNotes.location}`);
      if (observationNotes.symptoms) parts.push(`Biểu hiện: ${observationNotes.symptoms}`);
      if (observationNotes.duration) parts.push(`Thời gian: ${observationNotes.duration}`);
      parts.push('Chủ nuôi yêu cầu Bác sĩ thăm khám trực tiếp vùng da lông.');
      noteContent = `[Quan sát ảnh AI tham khảo]: ${parts.join(' - ')}`;
    }

    if (typeof onOpenVetBooking === 'function') {
      onOpenVetBooking({
        petId: currentPet.id,
        service: 'Khám tổng quát & Da liễu',
        note: noteContent,
        isAiVision: Boolean(includeAiNotes),
        aiVisionPetId: includeAiNotes ? currentPet.id : null
      });
    } else if (typeof onOpenAddSchedule === 'function') {
      onOpenAddSchedule('vet', 'Khám tổng quát & Da liễu');
    }
  };

  const currentPet = pets?.find(p => p.id === selectedPetId) || pets?.[0] || {
    id: '',
    name: 'Chưa chọn thú cưng',
    species: '',
    breed: 'Chưa cập nhật',
    age: null,
    weight: null
  };

  return (
    <PageContainer id="ai-vision-page" className="space-y-6 pb-12">
      
      {/* 1. Header chính */}
      <PageHeader
        title="AI hỗ trợ quan sát ảnh thú cưng"
        subtitle="Hỗ trợ chủ nuôi ghi nhận hình ảnh và mô tả triệu chứng ban đầu. Xử lý an toàn trên thiết bị, không thay thế khám thú y trực tiếp."
        badge={
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
            <span className={`w-2 h-2 rounded-full ${
              modelStatus === null ? 'bg-slate-400 animate-pulse'
              : modelStatus?.supportsVision && modelStatus?.isRunning ? 'bg-emerald-500'
              : 'bg-slate-400'
            }`} />
            <span className={modelStatus?.supportsVision && modelStatus?.isRunning ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-500 dark:text-slate-400 font-medium'}>
              {modelStatus === null ? 'Đang kiểm tra...'
               : modelStatus?.supportsVision && modelStatus?.isRunning ? 'Sẵn sàng'
               : 'Chưa sẵn sàng'}
            </span>
          </span>
        }
        actions={
          <Tabs
            tabs={[
              { id: 'observe', label: 'Quan sát ảnh', icon: Scan },
              { id: 'reference', label: 'Tài liệu tham khảo', icon: BookOpen }
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        }
      />

      {/* 2. Cảnh báo y khoa bắt buộc */}
      <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-900 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-200 flex items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="font-semibold">
            Kết quả AI chỉ để tham khảo, không thay thế khám thú y trực tiếp.
          </span>
        </div>
        <span className="text-[11px] text-amber-700 dark:text-amber-300 hidden sm:inline">
          Khi có dấu hiệu bất thường, hãy đưa bé đến phòng khám thú y gần nhất.
        </span>
      </div>


      {/* 4. Tab 2: Tài liệu tham khảo da liễu thường gặp (Độc lập, không lẫn với AI) */}
      {activeTab === 'reference' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-500/30 text-xs space-y-1">
            <h3 className="font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Cẩm nang tham khảo các bệnh lý da liễu chó mèo thường gặp</span>
            </h3>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              Tài liệu được tổng hợp từ cẩm nang lâm sàng da liễu thú y cơ bản nhằm mục đích nâng cao kiến thức nhận biết cho chủ nuôi. 
              <strong> Tuyệt đối không dùng tài liệu để tự ý chẩn đoán hay mua thuốc điều trị tại nhà khi chưa có ý kiến của Bác sĩ Thú y.</strong>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.values(PET_PATHOLOGY_DATASET).map((item) => (
              <Card 
                key={item.id} 
                className="p-5 space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block mb-0.5">
                        {item.category}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                        {item.name}
                      </h4>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${item.riskColor}`}>
                      {item.riskLevel}
                    </span>
                  </div>

                  {/* Triệu chứng */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                      Dấu hiệu nhận biết điển hình:
                    </span>
                    <ul className="text-xs text-slate-600 dark:text-slate-400 pl-4 list-disc space-y-0.5 leading-relaxed">
                      {item.symptoms.map((s, idx) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Sơ cứu an toàn */}
                  <div className="space-y-1 pt-1">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                      Lưu ý chăm sóc & Sơ cứu tại nhà:
                    </span>
                    <ul className="text-xs text-slate-600 dark:text-slate-400 pl-4 list-disc space-y-0.5 leading-relaxed">
                      {item.careTips.map((c, idx) => (
                        <li key={idx}>{c}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                    <strong>Khuyến nghị chuyên môn:</strong> {item.vetAdvice}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 5. Tab 1: Luồng quan sát ảnh (Hai cột trên Desktop 55%/45%, một cột trên Mobile) */}
      {activeTab === 'observe' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* =============================================================== */}
          {/* CỘT TRÁI (~55%): CHỌN THÚ CƯNG, TẢI ẢNH & NHẬP THÔNG TIN MÔ TẢ   */}
          {/* =============================================================== */}
          <div className="lg:col-span-7 bg-white dark:bg-[#12192A] rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
            
            {/* Bước 1: Chọn thú cưng */}
            <div className="space-y-2">
              <label htmlFor="select-pet-observation" className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                1. Chọn thú cưng cần quan sát:
              </label>
              
              <select
                id="select-pet-observation"
                value={selectedPetId}
                onChange={(e) => handlePetChange(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
              >
                {pets && pets.length > 0 ? (
                  pets.map(pet => (
                    <option key={pet.id} value={pet.id}>
                      {pet.name} ({pet.species === 'cat' ? 'Mèo' : pet.species === 'dog' ? 'Chó' : (pet.species || 'Thú cưng')})
                    </option>
                  ))
                ) : (
                  <option value="">Chưa có thú cưng trong tài khoản</option>
                )}
              </select>

              {/* Thông tin thú cưng tóm tắt */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 text-xs grid grid-cols-3 gap-2">
                <div>
                  <span className="text-[11px] text-slate-400 block">Giống loài:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                    {currentPet.breed || 'Chưa cập nhật'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Tuổi:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                    {currentPet.age ? `${currentPet.age} tuổi` : 'Chưa cập nhật'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Cân nặng:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                    {currentPet.weight ? `${currentPet.weight} kg` : 'Chưa cập nhật'}
                  </span>
                </div>
              </div>
            </div>

            {/* Bước 2: Tải ảnh (Giới hạn chiều cao 220-280px) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                  2. Tải ảnh chụp cận cảnh (Tối đa 5 MB):
                </label>
                {selectedImage && (
                  <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                    Ảnh đã được nạp sẵn sàng
                  </span>
                )}
              </div>

              {/* Khung xem trước hoặc vùng kéo thả - Capped height */}
              <div className={`relative h-[220px] sm:h-[260px] w-full rounded-2xl overflow-hidden flex items-center justify-center border transition-all ${
                selectedImage
                  ? 'border-slate-300 dark:border-slate-700 bg-slate-950'
                  : 'bg-slate-50/80 border-2 border-dashed border-slate-200 dark:bg-slate-900/50 dark:border-slate-800'
              }`}>
                {selectedImage ? (
                  <>
                    <img
                      src={selectedImage}
                      alt="Ảnh quan sát thú cưng"
                      className="w-full h-full object-contain"
                    />

                    {/* Thanh công cụ khi đã có ảnh: Đổi ảnh / Xóa ảnh */}
                    <div className="absolute bottom-3 left-3 right-3 p-2 rounded-xl bg-slate-950/80 backdrop-blur-md border border-white/10 flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="h-9 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5 text-indigo-300" />
                        <span>Đổi ảnh khác</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleClearImage}
                        className="h-9 px-3 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        <span>Xóa ảnh</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center space-y-2.5">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-xs">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Chưa có ảnh nào được chọn
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Định dạng: JPG, PNG hoặc WebP • Tối đa 5 MB
                      </p>
                    </div>

                    <button
                      type="button"
                      id="btn-upload-pet-photo"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm transition-all cursor-pointer flex items-center gap-2 active:scale-98"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Chọn ảnh từ thiết bị</span>
                    </button>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>

              {imageFileError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{imageFileError}</span>
                </div>
              )}
            </div>

            {/* Bước 3: Nhập thông tin bổ sung */}
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                3. Thông tin mô tả thêm từ chủ nuôi (tùy chọn):
              </label>

              <div className="space-y-2.5">
                <div>
                  <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block mb-1">
                    Vị trí quan sát trên cơ thể:
                  </span>
                  <input
                    type="text"
                    value={observationNotes.location}
                    onChange={(e) => setObservationNotes({ ...observationNotes, location: e.target.value })}
                    placeholder="Ví dụ: Vùng da bụng, vành tai trái, sống lưng, kẽ móng chân sau..."
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>

                <div>
                  <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block mb-1">
                    Biểu hiện bất thường quan sát được:
                  </span>
                  <input
                    type="text"
                    value={observationNotes.symptoms}
                    onChange={(e) => setObservationNotes({ ...observationNotes, symptoms: e.target.value })}
                    placeholder="Ví dụ: Mẩn đỏ li ti, rụng lông thành mảng, đóng vảy trắng, ngứa gãi liên tục..."
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>

                <div>
                  <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block mb-1">
                    Thời gian xuất hiện (nếu biết):
                  </span>
                  <input
                    type="text"
                    value={observationNotes.duration}
                    onChange={(e) => setObservationNotes({ ...observationNotes, duration: e.target.value })}
                    placeholder="Ví dụ: Vừa thấy hôm nay, khoảng 2-3 ngày nay, hơn 1 tuần..."
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>
              </div>
            </div>

            {/* Bước 4: Nút Phân tích ảnh & Nút Hủy */}
            <div className="pt-2">
              {isAnalyzing ? (
                <div className="space-y-2">
                  <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 font-bold text-indigo-900 dark:text-indigo-300">
                      <RefreshCw className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" />
                      <span>Đang phân tích ảnh thú cưng...</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleCancelAnalysis}
                      className="h-8 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer transition-colors shadow-xs"
                    >
                      Hủy yêu cầu
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
                    Vui lòng chờ trong giây lát.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    id="btn-start-ai-analysis"
                    onClick={handleTriggerAnalysis}
                    disabled={!selectedImage || !selectedPetId || !modelStatus?.isRunning || !modelStatus?.supportsVision}
                    className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm shadow-md shadow-indigo-600/20 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Bắt đầu phân tích ảnh</span>
                  </button>

                  {/* Chú thích lý do vô hiệu hóa — lấy từ statusCode thực tế */}
                  {(!modelStatus?.isRunning || !modelStatus?.supportsVision) && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 text-center font-medium">
                      {modelStatus === null
                        ? '⏳ Đang kiểm tra trạng thái dịch vụ...'
                        : '⚠️ Dịch vụ phân tích ảnh chưa sẵn sàng. Vui lòng thử lại sau.'
                      }
                    </p>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* =============================================================== */}
          {/* CỘT PHẢI (~45%): KẾT QUẢ QUAN SÁT & HÀNH ĐỘNG TIẾP THEO          */}
          {/* =============================================================== */}
          <div className="lg:col-span-5 bg-white dark:bg-[#12192A] rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 h-auto">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Microscope className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Kết quả quan sát tham khảo
                </h3>
              </div>

              {scanResult && (
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{new Date(scanResult.analyzedAt).toLocaleTimeString('vi-VN')}</span>
                </span>
              )}
            </div>

            {/* Thông báo lỗi nếu có */}
            {scanError && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold block">Thông báo:</span>
                  <p className="leading-relaxed">{scanError}</p>
                </div>
              </div>
            )}

            {/* Thông báo lưu thành công */}
            {saveSuccessMessage && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{saveSuccessMessage}</span>
              </div>
            )}

            {/* TRẠNG THÁI 1: CHƯA PHÂN TÍCH */}
            {!scanResult && !isAnalyzing && (
              <div className="py-8 text-center text-slate-500 dark:text-slate-400 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center mx-auto text-slate-400">
                  <Info className="w-6 h-6 opacity-75 text-indigo-500" />
                </div>
                <div className="space-y-1 max-w-sm mx-auto">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Chưa có kết quả quan sát
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Tải ảnh chụp cận cảnh và nhấn <strong>“Bắt đầu phân tích ảnh”</strong> ở khung bên trái để nhận thông tin quan sát tham khảo.
                  </p>
                </div>
              </div>
            )}

            {/* TRẠNG THÁI 2: ĐANG PHÂN TÍCH */}
            {isAnalyzing && (
              <div className="py-10 text-center text-slate-500 dark:text-slate-400 space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-400 mx-auto" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Đang phân tích ảnh thú cưng...
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                    Vui lòng chờ trong giây lát.
                  </p>
                </div>
              </div>
            )}

            {/* TRẠNG THÁI 3: CÓ KẾT QUẢ THỰC TẾ (TÁCH BIỆT RÕ 4 PHẦN) */}
            {scanResult && !isAnalyzing && (
              <div className="space-y-3.5 text-xs">
                
                {/* 1. Thông tin người dùng cung cấp */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    1. Thông tin tiếp nhận:
                  </span>
                  <div className="text-slate-700 dark:text-slate-300 space-y-0.5 leading-relaxed">
                    <p>• <strong>Bệnh nhân:</strong> {currentPet.name} ({currentPet.species === 'cat' ? 'Mèo' : currentPet.species === 'dog' ? 'Chó' : currentPet.species})</p>
                    {observationNotes.location && <p>• <strong>Vị trí quan sát:</strong> {observationNotes.location}</p>}
                    {observationNotes.symptoms && <p>• <strong>Biểu hiện ghi nhận:</strong> {observationNotes.symptoms}</p>}
                    {observationNotes.duration && <p>• <strong>Thời gian:</strong> {observationNotes.duration}</p>}
                  </div>
                </div>

                {/* 2. Nội dung quan sát AI */}
                <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-500/30 space-y-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>KẾT QUẢ QUAN SÁT THAM KHẢO</span>
                  </span>
                  <div className="text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed text-xs">
                    {scanResult.analysis}
                  </div>
                  {scanResult.originalText && scanResult.originalText !== scanResult.analysis && (
                    <details className="pt-2 border-t border-indigo-100 dark:border-indigo-900/50 text-[11px] text-slate-500 dark:text-slate-400">
                      <summary className="cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors select-none font-medium">
                        Xem bản ghi nhận gốc tiếng Anh
                      </summary>
                      <p className="mt-1.5 p-2 rounded-lg bg-white/70 dark:bg-slate-900/60 font-mono text-[10px] leading-relaxed text-slate-600 dark:text-slate-300">
                        {scanResult.originalText}
                      </p>
                    </details>
                  )}
                </div>

                {/* 3. Giới hạn quang học & An toàn */}
                <div className="p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 text-[11px] text-amber-900 dark:text-amber-300/90 space-y-1">
                  <span className="font-bold text-amber-950 dark:text-amber-200 block">
                    Giới hạn quang học & Cảnh báo an toàn thú y:
                  </span>
                  <p className="leading-relaxed text-slate-600 dark:text-slate-300">
                    {scanResult.disclaimer || 'Ảnh chụp 2D không thể thay thế thăm khám trực tiếp, không đo đạc vi sinh vật hay vi nấm dưới biểu bì. Không kết luận thú cưng khỏe mạnh hay loại trừ bệnh tật từ hình ảnh. Tuyệt đối không tự ý dùng thuốc hay kê đơn khi chưa có chỉ định từ Bác sĩ Thú y.'}
                  </p>
                </div>

                {/* Các nút hành động: Lưu kết quả tham khảo & Đặt lịch khám */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsSaveModalOpen(true)}
                    className="flex-1 h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-white/[0.04] hover:bg-slate-100 dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <BookmarkPlus className="w-4 h-4 text-indigo-500" />
                    <span>Lưu kết quả tham khảo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsBookingConfirmOpen(true)}
                    className="flex-1 h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                  >
                    <Stethoscope className="w-4 h-4" />
                    <span>Đặt lịch khám với Bác sĩ</span>
                  </button>
                </div>

              </div>
            )}

          </div>

        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 1: XÁC NHẬN LƯU KẾT QUẢ THAM KHẢO                             */}
      {/* =================================================================== */}
      <Modal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        size="sm"
        title="Lưu kết quả quan sát tham khảo"
        subtitle={`Theo dõi riêng cho bé ${currentPet.name}`}
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={() => setIsSaveModalOpen(false)}
              disabled={isSavingObservation}
              className="h-10 px-4 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleSaveObservationConfirm}
              disabled={isSavingObservation}
              className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm flex items-center gap-2 cursor-pointer"
            >
              {isSavingObservation ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <span>Xác nhận lưu</span>
              )}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800">
            Kết quả này được lưu với nhãn <strong>“Quan sát AI tham khảo”</strong> trong hồ sơ của bạn. 
            <strong> Tuyệt đối không xuất hiện dưới dạng bệnh án của Bác sĩ Thú y.</strong>
          </p>
        </div>
      </Modal>

      {/* =================================================================== */}
      {/* MODAL 2: XÁC NHẬN CHUYỂN THÔNG TIN SANG ĐẶT LỊCH KHÁM                */}
      {/* =================================================================== */}
      <Modal
        isOpen={isBookingConfirmOpen}
        onClose={() => setIsBookingConfirmOpen(false)}
        size="sm"
        title="Chuyển sang Đặt lịch khám thú y"
        subtitle={`Thú cưng: ${currentPet.name}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Bạn có muốn chuyển thông tin quan sát ban đầu này vào mục <strong>Ghi chú / Lý do khám</strong> khi mở form đặt lịch để Bác sĩ nắm được tình trạng không?
          </p>

          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              onClick={() => handleProceedBooking(true)}
              className="w-full h-11 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
            >
              <span>Chuyển kèm nội dung quan sát</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => handleProceedBooking(false)}
              className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs cursor-pointer"
            >
              <span>Đặt lịch (Không chuyển nội dung AI)</span>
            </button>

            <button
              type="button"
              onClick={() => setIsBookingConfirmOpen(false)}
              className="w-full py-2 text-center text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              Hủy
            </button>
          </div>
        </div>
      </Modal>

    </PageContainer>
  );
};

export default AiVisionScannerView;
