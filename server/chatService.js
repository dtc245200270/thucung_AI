import fs from 'fs';
import path from 'path';
import { config } from './config.js';
import { 
  retrieveRelevantContext, 
  analyzeGuardrailsAndSafety, 
  getRagStatus 
} from './ragService.js';

// ============================================================================
// DỊCH VỤ CHATBOT CỤC BỘ (LOCAL AI CHATBOT SERVICE)
// Model: qwen2.5:1.5b (Ollama Local) + RAG (embeddinggemma)
// ============================================================================

const CHAT_HISTORY_FILE = path.join(process.cwd(), 'server', 'data', 'chat_history.json');
const PETS_FILE = path.join(process.cwd(), 'server', 'data', 'pets.json');
const SCHEDULES_FILE = path.join(process.cwd(), 'server', 'data', 'schedules.json');
const APPOINTMENTS_FILE = path.join(process.cwd(), 'server', 'data', 'appointments.json');
const MEDICAL_RECORDS_FILE = path.join(process.cwd(), 'server', 'data', 'medical_records.json');
const PRESCRIPTIONS_FILE = path.join(process.cwd(), 'server', 'data', 'prescriptions.json');

// Khóa đồng thời (Concurrency Queue - tối đa 1 generation request tại một thời điểm)
let activeGenerationCount = 0;
const MAX_CONCURRENT_GENERATIONS = 1;

// Đọc tệp nghiêm ngặt: không giấu lỗi tệp hỏng thành "chưa có dữ liệu"
function readJsonFileStrict(filePath, defaultValue = []) {
  if (!fs.existsSync(filePath)) return defaultValue;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[ChatService] Lỗi nghiêm trọng khi đọc file ${filePath}:`, err.message);
    const readErr = new Error(`Lỗi hệ thống: Không thể truy xuất dữ liệu từ ${path.basename(filePath)}.`);
    readErr.code = 'DATABASE_READ_ERROR';
    readErr.statusCode = 500;
    readErr.technicalDetail = err.message;
    throw readErr;
  }
}

function writeJsonFileSafe(filePath, data) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`[ChatService] Lỗi ghi file ${filePath}:`, err.message);
  }
}

// Helper định dạng ngày Việt Nam chuẩn DD/MM/YYYY
export function formatDateVi(dateStr) {
  if (!dateStr) return '';
  const clean = String(dateStr).split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  }
  return dateStr;
}

// Lấy ngày giờ hiện tại theo múi giờ Việt Nam (Asia/Ho_Chi_Minh)
export function getVietnamNow() {
  const now = new Date();
  const vnTimeStr = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
  const vnDate = new Date(vnTimeStr);
  const yyyy = vnDate.getFullYear();
  const mm = String(vnDate.getMonth() + 1).padStart(2, '0');
  const dd = String(vnDate.getDate()).padStart(2, '0');
  const hh = String(vnDate.getHours()).padStart(2, '0');
  const min = String(vnDate.getMinutes()).padStart(2, '0');
  return {
    todayStr: `${yyyy}-${mm}-${dd}`,
    currentTimeStr: `${hh}:${min}`,
    year: yyyy
  };
}

// ----------------------------------------------------------------------------
// 1. QUẢN LÝ LỊCH SỬ TRÒ CHUYỆN (THEO USER VÀ THÚ CƯNG)
// ----------------------------------------------------------------------------

export function getChatSessionKey(userId, petId) {
  const cleanUser = String(userId || 'anonymous');
  const cleanPet = petId ? String(petId) : 'general';
  return `${cleanUser}::${cleanPet}`;
}

export function getChatHistory(userId, petId) {
  const allHistory = readJsonFileStrict(CHAT_HISTORY_FILE, {});
  const key = getChatSessionKey(userId, petId);
  return Array.isArray(allHistory[key]) ? allHistory[key] : [];
}

export function appendChatMessage(userId, petId, messageItem) {
  const allHistory = readJsonFileStrict(CHAT_HISTORY_FILE, {});
  const key = getChatSessionKey(userId, petId);
  if (!Array.isArray(allHistory[key])) {
    allHistory[key] = [];
  }

  allHistory[key].push({
    id: messageItem.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    sender: messageItem.sender, // 'user' | 'assistant'
    text: messageItem.text,
    sources: messageItem.sources || null,
    timestamp: messageItem.timestamp || new Date().toISOString()
  });

  // Giới hạn 20 tin nhắn gần nhất để tối ưu ngữ cảnh
  if (allHistory[key].length > 20) {
    allHistory[key] = allHistory[key].slice(-20);
  }

  writeJsonFileSafe(CHAT_HISTORY_FILE, allHistory);
  return allHistory[key];
}

export function clearChatHistory(userId, petId) {
  const allHistory = readJsonFileStrict(CHAT_HISTORY_FILE, {});
  const key = getChatSessionKey(userId, petId);
  if (allHistory[key]) {
    delete allHistory[key];
    writeJsonFileSafe(CHAT_HISTORY_FILE, allHistory);
  }
  return { success: true, message: 'Đã xóa lịch sử cuộc trò chuyện.' };
}

// ----------------------------------------------------------------------------
// 2. PHÂN LOẠI NHU CẦU & NHẬN DIỆN Ý ĐỊNH HỘI THOẠI (INTENT DETECTION)
// ----------------------------------------------------------------------------

export function detectPetQueryIntent(message, petContext = null) {
  const lower = String(message || '').toLowerCase().trim();

  // A. Cân nặng
  const isWeight = /(cân nặng|can nang|nặng bao|nang bao|bao nhiêu kg|bao nhieu kg|mấy cân|may can|bao nhiêu cân|bao nhieu can|trọng lượng|trong luong|cân đo|can do|số cân|so can|nặng\s*\d+|nang\s*\d+)/i.test(lower);

  // B. Lịch nhắc tái khám, lịch hẹn khám, lịch chăm sóc
  const isSchedule = /(tái khám|tai kham|lịch hẹn|lich hen|nhắc khám|nhac kham|khi nào khám|khi nao kham|đi khám|di kham|khám tiếp|kham tiep|hẹn gặp bác sĩ|hen gap bac si|nhắc tái khám|nhac tai kham|lịch nhắc|lich nhac|lịch sắp tới|lich sap toi)/i.test(lower) ||
    (/(lịch khám|lich kham)/i.test(lower) && !/(định kỳ|dinh ky|hằng năm|hang nam|bao lâu|quy định)/i.test(lower)) ||
    (/(lịch tiêm|tiêm phòng|tiêm nhắc)/i.test(lower) && /(bé|nhắc|sắp tới|khi nào|bao giờ)/i.test(lower));

  // C. Đơn thuốc
  const isPrescription = /(đơn thuốc|don thuoc|toa thuốc|toa thuoc|thuốc đang uống|thuoc dang uong|đang uống thuốc gì|dang uong thuoc gi|uống thuốc gì|uong thuoc gi|thuốc được kê|thuoc duoc ke|thuốc điều trị|thuoc dieu tri|có đơn thuốc nào|co don thuoc nao)/i.test(lower);

  // D. Bệnh án & tiền sử khám
  const isMedicalHistory = /(bệnh án|benh an|tiền sử bệnh|tien su benh|tiền sử khám|tien su kham|kết quả khám|ket qua kham|chẩn đoán trước đây|chan doan truoc day|từng bị bệnh gì|tung bi benh gi|lịch sử khám|lich su kham)/i.test(lower);

  // E. Thông tin chung hồ sơ
  const isProfile = /(giống gì|giong gi|triệt sản chưa|triet san chua|bao nhiêu tuổi|bao nhieu tuoi|mấy tuổi|may tuoi|ngày sinh|ngay sinh|thông tin của bé|thong tin cua be|hồ sơ của bé|ho so cua be)/i.test(lower);

  const isAskingPersonalData = isWeight || isSchedule || isPrescription || isMedicalHistory || isProfile;

  // F. Hỏi kết hợp: Dữ liệu cá nhân + Lời khuyên chăm sóc / Dinh dưỡng / RAG
  const isCombinedWithCare = isAskingPersonalData && /(cho ăn|ăn thưởng|bao nhiêu calo|calo|kem đánh răng|tẩy giun|chuẩn bị gì|lưu ý gì|chăm sóc thế nào|có được tắm|có nên|uống được không)/i.test(lower);

  // G. Nhận diện lệch loài thú cưng (Species mismatch)
  let speciesMismatch = null;
  if (petContext) {
    const isAskingDog = /(chó|cho|cún|cun|puppy|dog)/i.test(lower);
    const isAskingCat = /(mèo|meo|miêu|kitten|cat)/i.test(lower);

    if (petContext.species === 'dog' && isAskingCat && !isAskingDog) {
      speciesMismatch = { current: 'Chó', target: 'Mèo' };
    } else if (petContext.species === 'cat' && isAskingDog && !isAskingCat) {
      speciesMismatch = { current: 'Mèo', target: 'Chó/Cún' };
    }
  }

  return {
    isWeight,
    isSchedule,
    isPrescription,
    isMedicalHistory,
    isProfile,
    isAskingPersonalData,
    isCombinedWithCare,
    speciesMismatch,
    originalMessage: message
  };
}

// ----------------------------------------------------------------------------
// 3. TRUY VẤN DỮ LIỆU CÓ CẤU TRÚC VÀ ĐỊNH DẠNG CHUẨN XÁC (DETERMINISTIC PET DATA)
// ----------------------------------------------------------------------------

export function queryPetStructuredData(petId, user, intent) {
  const pets = readJsonFileStrict(PETS_FILE, []);
  const pet = pets.find(p => p.id === petId);
  if (!pet) {
    const err = new Error('Không tìm thấy thông tin thú cưng được chỉ định.');
    err.statusCode = 404;
    err.code = 'PET_NOT_FOUND';
    throw err;
  }

  // Phân quyền: chủ sở hữu, hoặc bác sĩ, hoặc quản trị viên
  const isOwner = String(pet.ownerId) === String(user.id);
  const isPrivileged = user.role === 'system_admin' || user.role === 'vet_doctor';
  if (!isOwner && !isPrivileged) {
    const err = new Error('Bạn không có quyền truy cập dữ liệu của thú cưng này.');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  const { todayStr, currentTimeStr } = getVietnamNow();

  // 1. TRUY VẤN CÂN NẶNG
  if (intent.isWeight) {
    if (pet.weight !== null && pet.weight !== undefined && !isNaN(Number(pet.weight))) {
      let latestDateStr = '';
      let historyText = '';
      if (Array.isArray(pet.weightHistory) && pet.weightHistory.length > 0) {
        const sortedHistory = [...pet.weightHistory].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        if (sortedHistory[0]?.date) {
          latestDateStr = formatDateVi(sortedHistory[0].date);
        }
        if (sortedHistory.length > 1) {
          const prev = sortedHistory.slice(1, 4).map(w => `${w.weight} kg (ngày ${formatDateVi(w.date)})`).join(', ');
          historyText = `\n\n• Lịch sử các lần cân đo trước: ${prev}.`;
        }
      }

      const reply = `Theo hồ sơ thú cưng của **${pet.name}**, cân nặng ghi nhận là **${pet.weight} kg**${latestDateStr ? ` (lần cập nhật gần nhất: ngày ${latestDateStr})` : ''}.${historyText}\n\n*(Lưu ý: Đây là số đo đã lưu trong hồ sơ hệ thống, không phải số đo mới cân hôm nay).*`;

      return {
        reply,
        sources: [
          {
            id: 'SRC-PET-PROFILE',
            title: `Hồ sơ thú cưng — Cân nặng (${pet.name})`,
            organization: 'Hệ thống hồ sơ PetCare',
            type: 'pet_profile'
          }
        ]
      };
    } else {
      const reply = `Hồ sơ của **${pet.name}** hiện **chưa ghi nhận cân nặng**. Bạn có thể cập nhật cân nặng của bé tại mục Quản lý thú cưng để tiện theo dõi thể trạng.`;
      return {
        reply,
        sources: [
          {
            id: 'SRC-PET-PROFILE',
            title: `Hồ sơ thú cưng (${pet.name})`,
            organization: 'Hệ thống hồ sơ PetCare',
            type: 'pet_profile'
          }
        ]
      };
    }
  }

  // 2. TRUY VẤN LỊCH NHẮC TÁI KHÁM & LỊCH HẸN KHÁM
  if (intent.isSchedule) {
    const schedules = readJsonFileStrict(SCHEDULES_FILE, [])
      .filter(s => s.petId === pet.id && s.isDeleted !== true && s.completed !== true);

    const appointments = readJsonFileStrict(APPOINTMENTS_FILE, [])
      .filter(a => a.petId === pet.id && a.status !== 'cancelled' && a.status !== 'completed');

    // Lọc lịch sắp tới (ngày > hôm nay hoặc ngày == hôm nay và giờ chưa qua)
    const upcomingSchedules = schedules.filter(s => {
      if (!s.date) return false;
      if (s.date > todayStr) return true;
      if (s.date === todayStr) {
        if (!s.time) return true;
        return s.time >= currentTimeStr;
      }
      return false;
    }).sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      if (cmp !== 0) return cmp;
      return (a.time || '').localeCompare(b.time || '');
    });

    const upcomingAppointments = appointments.filter(a => {
      if (!a.date) return false;
      if (a.date > todayStr) return true;
      if (a.date === todayStr) {
        if (!a.time) return true;
        return a.time >= currentTimeStr;
      }
      return false;
    }).sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      if (cmp !== 0) return cmp;
      return (a.time || '').localeCompare(b.time || '');
    });

    const isAskingRecheckSpecific = /(tái khám|tai kham|nhắc tái khám|nhac tai kham)/i.test(intent.originalMessage || '');

    if (upcomingSchedules.length === 0 && upcomingAppointments.length === 0) {
      const reply = isAskingRecheckSpecific
        ? `Hiện tại **${pet.name}** **chưa có lịch nhắc tái khám** nào sắp tới trong hệ thống.`
        : `Hiện tại **${pet.name}** **chưa có lịch nhắc chăm sóc hoặc lịch hẹn khám sắp tới** nào trong hệ thống.`;

      return {
        reply,
        sources: [
          {
            id: 'SRC-PET-SCHEDULE',
            title: `Lịch chăm sóc & Lịch hẹn (${pet.name})`,
            organization: 'Hệ thống lịch PetCare',
            type: 'pet_schedule'
          }
        ]
      };
    }

    const items = [];

    // Nhắc tái khám / Lịch chăm sóc từ schedules.json
    upcomingSchedules.forEach(s => {
      const timeFormatted = s.time ? `lúc **${s.time}** ` : '';
      const dateFormatted = `ngày **${formatDateVi(s.date)}**`;
      const doctor = s.isVerified && s.verifiedBy ? ` *(Chỉ định bởi: ${s.verifiedBy})*` : '';
      const notes = s.notes ? `\n    Ghi chú: ${s.notes}` : '';
      items.push(`• **${s.title}**: ${timeFormatted}${dateFormatted}${doctor}${notes}`);
    });

    // Ca hẹn khám từ appointments.json
    upcomingAppointments.forEach(a => {
      const timeFormatted = a.time ? `lúc **${a.time}** ` : '';
      const dateFormatted = `ngày **${formatDateVi(a.date)}**`;
      const facility = a.facility ? ` tại ${a.facility}` : '';
      const statusStr = a.status === 'confirmed' ? 'Đã xác nhận' : 'Chờ phòng khám xác nhận';
      const vet = a.assignedVet ? ` (Bác sĩ: ${a.assignedVet})` : '';
      items.push(`• **${a.service || 'Khám bệnh'}** (${statusStr}): ${timeFormatted}${dateFormatted}${facility}${vet}`);
    });

    const reply = `**${pet.name}** có các lịch nhắc và ca khám sắp tới như sau:\n\n${items.join('\n\n')}`;

    return {
      reply,
      sources: [
        {
          id: 'SRC-PET-SCHEDULE',
          title: `Lịch chăm sóc & Lịch hẹn (${pet.name})`,
          organization: 'Hệ thống lịch PetCare',
          type: 'pet_schedule'
        }
      ]
    };
  }

  // 3. TRUY VẤN ĐƠN THUỐC
  if (intent.isPrescription) {
    const prescriptions = readJsonFileStrict(PRESCRIPTIONS_FILE, [])
      .filter(p => p.petId === pet.id && (p.status === 'published' || p.isFinal === true));

    if (prescriptions.length === 0) {
      const reply = `Hồ sơ của **${pet.name}** hiện **chưa có đơn thuốc đã phát hành** nào trong hệ thống.`;
      return {
        reply,
        sources: [
          {
            id: 'SRC-PET-PRESCRIPTION',
            title: `Đơn thuốc điện tử (${pet.name})`,
            organization: 'Bệnh án & Đơn thuốc PetCare',
            type: 'pet_prescription'
          }
        ]
      };
    }

    prescriptions.sort((a, b) => new Date(b.confirmedAt || b.createdAt || 0) - new Date(a.confirmedAt || a.createdAt || 0));

    const prescList = prescriptions.slice(0, 3).map(p => {
      const prescDate = formatDateVi(p.confirmedAt || p.createdAt || p.startDate);
      const doctor = p.vetName || p.prescribedBy || 'Bác sĩ Thú y';
      const title = p.title || p.medicineName || 'Đơn thuốc điều trị';

      let medDetails = '';
      if (Array.isArray(p.medications) && p.medications.length > 0) {
        medDetails = p.medications.map(m => {
          const doseStr = m.dose || m.dosage || 'Theo chỉ định';
          const freqStr = m.freq ? `, ${m.freq}` : '';
          const routeStr = m.route ? `, đường ${m.route}` : '';
          const daysStr = m.days || m.durationDays ? `, dùng trong ${m.days || m.durationDays} ngày` : '';
          const instrStr = m.instructions ? `\n    Hướng dẫn: ${m.instructions}` : '';
          return `  - **${m.name}**: Liều ${doseStr}${freqStr}${routeStr}${daysStr}.${instrStr}`;
        }).join('\n');
      } else {
        medDetails = `  - **${p.medicineName || 'Thuốc'}**: Liều ${p.dosage || 'Theo chỉ định'}`;
      }

      let durationNote = '';
      if (p.startDate && p.durationDays) {
        const start = new Date(p.startDate);
        const end = new Date(start.getTime() + (p.durationDays * 24 * 60 * 60 * 1000));
        const now = new Date(todayStr);
        if (now <= end && now >= start) {
          const remainingDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
          durationNote = `\n  *(Trạng thái: Đang trong liệu trình điều trị — còn khoảng ${remainingDays} ngày).*`;
        } else if (now > end) {
          durationNote = `\n  *(Trạng thái: Đơn thuốc đã hoàn tất liệu trình điều trị).*`;
        }
      }

      return `• **${title}**\n  Bác sĩ kê đơn: **${doctor}** (ngày ${prescDate})\n${medDetails}${durationNote}`;
    });

    const reply = `Hồ sơ của **${pet.name}** có đơn thuốc đã phát hành như sau:\n\n${prescList.join('\n\n')}`;

    return {
      reply,
      sources: [
        {
          id: 'SRC-PET-PRESCRIPTION',
          title: `Đơn thuốc điện tử (${pet.name})`,
          organization: 'Bệnh án & Đơn thuốc PetCare',
          type: 'pet_prescription'
        }
      ]
    };
  }

  // 4. TRUY VẤN BỆNH ÁN & TIỀN SỬ BỆNH
  if (intent.isMedicalHistory) {
    const records = readJsonFileStrict(MEDICAL_RECORDS_FILE, [])
      .filter(r => r.petId === pet.id && (r.status === 'published' || r.status === 'completed' || r.isFinal === true))
      .sort((a, b) => new Date(b.confirmedAt || b.completedAt || b.date || 0) - new Date(a.confirmedAt || a.completedAt || a.date || 0));

    if (records.length === 0) {
      const reply = `Hồ sơ của **${pet.name}** hiện **chưa có bệnh án đã hoàn thành** nào trong hệ thống.`;
      return {
        reply,
        sources: [
          {
            id: 'SRC-PET-MEDICAL',
            title: `Bệnh án điện tử (${pet.name})`,
            organization: 'Bệnh án & Đơn thuốc PetCare',
            type: 'pet_medical'
          }
        ]
      };
    }

    const recList = records.slice(0, 3).map(r => {
      const recDate = formatDateVi(r.confirmedAt || r.completedAt || r.date);
      const doc = r.doctor || r.vetName || r.authorName || 'Bác sĩ Thú y';
      const reason = r.reason || r.chiefComplaint || r.subjective || 'Khám bệnh';
      const diag = r.assessment || r.diagnosis || 'Đã kiểm tra lâm sàng';
      const plan = r.plan ? `\n    Hướng điều trị: ${r.plan}` : '';
      return `• **Ca khám ngày ${recDate}** (Bác sĩ: ${doc})\n  - Lý do khám: ${reason}\n  - Chẩn đoán: ${diag}${plan}`;
    });

    const reply = `Tiền sử khám bệnh của **${pet.name}** như sau:\n\n${recList.join('\n\n')}`;

    return {
      reply,
      sources: [
        {
          id: 'SRC-PET-MEDICAL',
          title: `Bệnh án điện tử (${pet.name})`,
          organization: 'Bệnh án & Đơn thuốc PetCare',
          type: 'pet_medical'
        }
      ]
    };
  }

  // 5. TRUY VẤN THÔNG TIN HỒ SƠ CHUNG
  if (intent.isProfile) {
    const bDate = pet.birthDate ? formatDateVi(pet.birthDate) : 'Chưa cập nhật ngày sinh';
    const neutered = pet.isNeutered ? 'Đã triệt sản' : 'Chưa triệt sản';
    const breed = pet.breed || 'Chưa rõ giống';
    const species = pet.species === 'cat' ? 'Mèo' : pet.species === 'dog' ? 'Chó' : pet.species;

    const reply = `Thông tin hồ sơ của **${pet.name}**:\n\n• Loài: **${species}** (Giống: **${breed}**)\n• Ngày sinh: **${bDate}**\n• Tình trạng triệt sản: **${neutered}**\n• Cân nặng hồ sơ: **${pet.weight ? `${pet.weight} kg` : 'Chưa ghi nhận'}**`;

    return {
      reply,
      sources: [
        {
          id: 'SRC-PET-PROFILE',
          title: `Hồ sơ thú cưng (${pet.name})`,
          organization: 'Hệ thống hồ sơ PetCare',
          type: 'pet_profile'
        }
      ]
    };
  }

  return null;
}

// ----------------------------------------------------------------------------
// 4. TỔNG HỢP PET CONTEXT CHO PROMPT CÂU HỎI KẾT HỢP
// ----------------------------------------------------------------------------

export function getPetContextForChat(petId, user) {
  if (!petId || petId === 'general') return null;

  const pets = readJsonFileStrict(PETS_FILE, []);
  const pet = pets.find(p => p.id === petId);
  if (!pet) {
    throw new Error('Không tìm thấy thông tin thú cưng được chỉ định.');
  }

  const isOwner = String(pet.ownerId) === String(user.id);
  const isPrivileged = user.role === 'system_admin' || user.role === 'vet_doctor';
  if (!isOwner && !isPrivileged) {
    throw new Error('Bạn không có quyền truy cập dữ liệu của thú cưng này.');
  }

  const { todayStr, currentTimeStr } = getVietnamNow();

  // 1. Cân nặng
  let weightInfo = '';
  if (pet.weight) {
    weightInfo += `Cân nặng hồ sơ: ${pet.weight} kg. `;
  } else {
    weightInfo += 'Cân nặng hồ sơ: Chưa cập nhật. ';
  }

  if (Array.isArray(pet.weightHistory) && pet.weightHistory.length > 0) {
    const sorted = [...pet.weightHistory].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    const recent = sorted.slice(0, 3).map(w => `${w.weight} kg (ngày ${formatDateVi(w.date)})`).join(', ');
    weightInfo += `Số đo gần nhất: ${recent}.`;
  } else {
    weightInfo += 'Chưa có lịch sử các lần cân đo trước.';
  }

  // 2. Lịch chăm sóc & Lịch hẹn (bảo toàn ngày giờ và loại bỏ đã hoàn tất / đã hủy)
  const schedules = readJsonFileStrict(SCHEDULES_FILE, [])
    .filter(s => s.petId === pet.id && s.isDeleted !== true && s.completed !== true);
  const appointments = readJsonFileStrict(APPOINTMENTS_FILE, [])
    .filter(a => a.petId === pet.id && a.status !== 'cancelled' && a.status !== 'completed');

  const upcomingSchedules = schedules.filter(s => {
    if (!s.date) return false;
    if (s.date > todayStr) return true;
    if (s.date === todayStr) {
      if (!s.time) return true;
      return s.time >= currentTimeStr;
    }
    return false;
  }).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);

  const upcomingAppointments = appointments.filter(a => {
    if (!a.date) return false;
    if (a.date > todayStr) return true;
    if (a.date === todayStr) {
      if (!a.time) return true;
      return a.time >= currentTimeStr;
    }
    return false;
  }).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);

  let scheduleInfo = '';
  if (upcomingAppointments.length > 0) {
    scheduleInfo += `Lịch khám sắp tới: ${upcomingAppointments.map(a => `${a.service || 'Khám bệnh'} lúc ${a.time || ''} ngày ${formatDateVi(a.date)} (Trạng thái: ${a.status === 'confirmed' ? 'Đã xác nhận' : 'Chờ xác nhận'})`).join('; ')}. `;
  }
  if (upcomingSchedules.length > 0) {
    scheduleInfo += `Lịch chăm sóc sắp tới: ${upcomingSchedules.map(s => `${s.title} lúc ${s.time || ''} ngày ${formatDateVi(s.date)}`).join('; ')}.`;
  }
  if (!scheduleInfo) {
    scheduleInfo = 'Hiện không có lịch khám hoặc nhắc nhở chăm sóc sắp tới nào trong hệ thống.';
  }

  // 3. Bệnh án đã chốt & Đơn thuốc đã phát hành
  const records = readJsonFileStrict(MEDICAL_RECORDS_FILE, [])
    .filter(r => r.petId === pet.id && (r.status === 'completed' || r.status === 'published' || r.isFinal === true))
    .sort((a, b) => new Date(b.confirmedAt || b.completedAt || b.date || 0) - new Date(a.confirmedAt || a.completedAt || a.date || 0))
    .slice(0, 2);

  let medicalInfo = '';
  if (records.length > 0) {
    medicalInfo = records.map(r => {
      const diag = r.assessment || r.diagnosis || r.clinicalNotes || 'Khám tổng quát';
      const dr = r.doctor || r.vetName || r.authorName ? ` (Bác sĩ: ${r.doctor || r.vetName || r.authorName})` : '';
      return `Ca khám ngày ${formatDateVi(r.confirmedAt || r.completedAt || r.date)}: ${diag}${dr}`;
    }).join('; ');
  } else {
    medicalInfo = 'Chưa có hồ sơ bệnh án hoàn thành nào.';
  }

  const prescriptions = readJsonFileStrict(PRESCRIPTIONS_FILE, [])
    .filter(p => p.petId === pet.id && (p.status === 'published' || p.isFinal === true))
    .slice(0, 3);

  let prescriptionInfo = '';
  if (prescriptions.length > 0) {
    prescriptionInfo = prescriptions.map(p => `${p.medicineName || 'Thuốc'} [Liều: ${p.dosage || 'Theo chỉ định'}]`).join('; ');
  } else {
    prescriptionInfo = 'Không có đơn thuốc đang điều trị.';
  }

  return {
    id: pet.id,
    name: pet.name,
    species: pet.species,
    breed: pet.breed || 'Chưa rõ giống',
    birthDate: pet.birthDate ? formatDateVi(pet.birthDate) : 'Chưa cập nhật ngày sinh',
    isNeutered: pet.isNeutered ? 'Đã triệt sản' : 'Chưa triệt sản',
    weightInfo,
    scheduleInfo,
    medicalInfo,
    prescriptionInfo
  };
}

// ----------------------------------------------------------------------------
// 5. XỬ LÝ HỘI THOẠI TOÀN LUỒNG (LOCAL AI + RAG + PET DATA)
// ----------------------------------------------------------------------------

export async function processChatConsultation({ userId, userRole, message, petId }) {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  if (!message || typeof message !== 'string' || !message.trim()) {
    throw new Error('Tin nhắn của bạn không được để trống.');
  }

  const cleanMessage = message.trim();
  const ollamaUrl = (config.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
  const modelName = process.env.OLLAMA_TEXT_MODEL || 'qwen2.5:1.5b';

  // 1. Đọc context thú cưng (nếu có chọn) và kiểm tra phân quyền
  let petContext = null;
  if (petId && petId !== 'general') {
    petContext = getPetContextForChat(petId, { id: userId, role: userRole });
  }

  // 2. Phân tích an toàn, cấp cứu và rào chắn (Guardrails) - Ưu tiên hàng đầu
  const safety = analyzeGuardrailsAndSafety(cleanMessage, {
    petName: petContext?.name,
    petSpecies: petContext?.species
  });

  // Nếu là yêu cầu từ chối an toàn hoặc loài ngoài phạm vi đã xác định
  if (safety.isRefusal || safety.isOutOfCoverage || safety.isOutOfDomain) {
    const finalReply = safety.message;
    appendChatMessage(userId, petId, { sender: 'user', text: cleanMessage });
    appendChatMessage(userId, petId, { 
      sender: 'assistant', 
      text: finalReply, 
      sources: [] 
    });
    return {
      success: true,
      requestId,
      status: 'insufficient_evidence',
      reply: finalReply,
      sources: [],
      petContext: petContext ? { id: petContext.id, name: petContext.name, species: petContext.species } : null
    };
  }

  // Nếu là tình huống cấp cứu khẩn cấp (khó thở, rặn tiểu không ra)
  if (safety.isEmergency) {
    const emergencyReply = safety.message;
    appendChatMessage(userId, petId, { sender: 'user', text: cleanMessage });
    appendChatMessage(userId, petId, { sender: 'assistant', text: emergencyReply, sources: [] });
    return {
      success: true,
      requestId,
      status: 'answered',
      reply: emergencyReply,
      sources: [],
      petContext: petContext ? { id: petContext.id, name: petContext.name, species: petContext.species } : null
    };
  }

  // 3. Nhận diện ý định hội thoại (Intent Detection)
  const intent = detectPetQueryIntent(cleanMessage, petContext);

  // A. Nếu người dùng hỏi dữ liệu cá nhân thú cưng nhưng ĐANG Ở "HỎI ĐÁP CHUNG"
  if (intent.isAskingPersonalData && (!petId || petId === 'general')) {
    const promptReply = 'Bạn đang ở chế độ Hỏi đáp chung nên tôi chưa xác định được bé thú cưng bạn muốn tra cứu. Vui lòng chọn bé (ví dụ: Cún Kiểm Thử hoặc Mèo Kiểm Thử) ở danh sách phía trên để tôi tra cứu thông tin chính xác cho bạn nhé!';
    appendChatMessage(userId, petId, { sender: 'user', text: cleanMessage });
    appendChatMessage(userId, petId, { sender: 'assistant', text: promptReply, sources: [] });
    return {
      success: true,
      requestId,
      status: 'answered',
      reply: promptReply,
      sources: [],
      petContext: null
    };
  }

  // B. Nếu người dùng chọn một bé nhưng câu hỏi nhắc đến loài/tên pet khác
  if (intent.isAskingPersonalData && intent.speciesMismatch && petContext) {
    const mismatchReply = `Bạn đang chọn hồ sơ của **${petContext.name}** (${intent.speciesMismatch.current}), nhưng câu hỏi của bạn đang nhắc đến **${intent.speciesMismatch.target.toLowerCase()}**. Để đảm bảo thông tin chính xác, bạn vui lòng chuyển sang hồ sơ của bé tương ứng ở thanh chọn phía trên nhé!`;
    appendChatMessage(userId, petId, { sender: 'user', text: cleanMessage });
    appendChatMessage(userId, petId, { sender: 'assistant', text: mismatchReply, sources: [] });
    return {
      success: true,
      requestId,
      status: 'answered',
      reply: mismatchReply,
      sources: [],
      petContext: { id: petContext.id, name: petContext.name, species: petContext.species }
    };
  }

  // C. Nếu là câu hỏi dữ kiện cá nhân ĐƠN THUẦN (Cân nặng, Lịch khám, Đơn thuốc, Bệnh án, Hồ sơ)
  // Trả kết quả định dạng cấu trúc chuẩn xác trực tiếp, không bắt LLM tự tính hoặc làm mất ngày giờ
  if (intent.isAskingPersonalData && !intent.isCombinedWithCare && petContext) {
    const structuredData = queryPetStructuredData(petId, { id: userId, role: userRole }, intent);
    if (structuredData) {
      appendChatMessage(userId, petId, { sender: 'user', text: cleanMessage });
      appendChatMessage(userId, petId, { 
        sender: 'assistant', 
        text: structuredData.reply, 
        sources: structuredData.sources 
      });
      return {
        success: true,
        requestId,
        status: 'answered',
        reply: structuredData.reply,
        sources: structuredData.sources,
        petContext: { id: petContext.id, name: petContext.name, species: petContext.species }
      };
    }
  }

  // 4. Truy xuất RAG từ kho tài liệu petcare-rag-vi-v1
  let retrievedData = { chunks: [], sources: [] };
  try {
    retrievedData = await retrieveRelevantContext(cleanMessage, {
      petSpecies: petContext?.species || null,
      topK: 2,
      threshold: 0.45 // Ngưỡng liên quan cosine similarity
    });
  } catch (ragErr) {
    console.warn('[ChatService] Lỗi khi truy xuất RAG:', ragErr.message);
  }

  // Nếu RAG không tìm thấy đoạn nào phù hợp và không phải câu hỏi kết hợp dữ liệu cá nhân
  if (!intent.isAskingPersonalData && (!retrievedData.chunks || retrievedData.chunks.length === 0)) {
    // Nếu có cảnh báo khẩn cấp tiềm ẩn (khó thở, rặn tiểu không ra)
    if (safety.isEmergency) {
      const emergencyReply = safety.message;
      appendChatMessage(userId, petId, { sender: 'user', text: cleanMessage });
      appendChatMessage(userId, petId, { sender: 'assistant', text: emergencyReply, sources: [] });
      return {
        success: true,
        requestId,
        status: 'answered',
        reply: emergencyReply,
        sources: [],
        petContext: petContext ? { id: petContext.id, name: petContext.name, species: petContext.species } : null
      };
    }

    const noDocReply = 'Chưa có thông tin phù hợp trong tài liệu được cung cấp.';
    appendChatMessage(userId, petId, { sender: 'user', text: cleanMessage });
    appendChatMessage(userId, petId, { sender: 'assistant', text: noDocReply, sources: [] });
    return {
      success: true,
      requestId,
      status: 'insufficient_evidence',
      reply: noDocReply,
      sources: [],
      petContext: petContext ? { id: petContext.id, name: petContext.name, species: petContext.species } : null
    };
  }

  // 5. Kiểm tra kết nối Ollama và tính sẵn sàng của mô hình Text
  let installedModels = [];
  try {
    const pingRes = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!pingRes.ok) {
      const err = new Error(`Dịch vụ Ollama phản hồi mã lỗi HTTP ${pingRes.status}.`);
      err.statusCode = 503;
      err.code = 'OLLAMA_HTTP_ERROR';
      err.technicalDetail = `Ollama /api/tags returned HTTP ${pingRes.status}`;
      throw err;
    }
    const tagsData = await pingRes.json();
    installedModels = (tagsData.models || []).map(m => m.name);
  } catch (pingErr) {
    if (pingErr.code === 'OLLAMA_HTTP_ERROR') throw pingErr;
    console.error('[ChatService] Không thể kết nối tới Ollama:', pingErr.message);
    const connErr = new Error('Dịch vụ Ollama chưa bật hoặc không thể kết nối tại cổng 11434. Vui lòng chạy lệnh: ollama serve');
    connErr.statusCode = 503;
    connErr.code = 'OLLAMA_DISCONNECTED';
    connErr.technicalDetail = `fetch(${ollamaUrl}/api/tags) failed: ${pingErr.message}`;
    throw connErr;
  }

  const isModelReady = installedModels.some(m => m === modelName || m.startsWith(`${modelName}:`));
  if (!isModelReady) {
    const modelErr = new Error(`Mô hình AI "${modelName}" chưa được cài đặt trong Ollama. Vui lòng chạy: ollama pull ${modelName}`);
    modelErr.statusCode = 503;
    modelErr.code = 'MODEL_NOT_FOUND';
    modelErr.technicalDetail = `Model "${modelName}" not found in [${installedModels.join(', ')}]`;
    throw modelErr;
  }

  // 6. Chuẩn bị ngữ cảnh & Prompt theo chuẩn ChatML (/api/chat)
  let retrievedKnowledgeText = '';
  if (retrievedData.chunks && retrievedData.chunks.length > 0) {
    retrievedKnowledgeText = retrievedData.chunks.map((c, i) => {
      return `[Đoạn ${i + 1} - ${c.title}]:\n${c.text}`;
    }).join('\n\n');
  }

  let petDataPromptSection = '';
  if (petContext) {
    petDataPromptSection = `
=== DỮ LIỆU THÚ CƯNG CỦA NGƯỜI DÙNG ===
- Tên bé: ${petContext.name} (${petContext.species === 'cat' ? 'Mèo' : petContext.species === 'dog' ? 'Chó' : petContext.species}, giống ${petContext.breed})
- Ngày sinh: ${petContext.birthDate}
- Tình trạng: ${petContext.isNeutered}
- Cân nặng: ${petContext.weightInfo}
- Lịch khám & Chăm sóc: ${petContext.scheduleInfo}
- Tiền sử khám bệnh: ${petContext.medicalInfo}
- Đơn thuốc: ${petContext.prescriptionInfo}
=======================================`;
  }

  // Lấy lịch sử hội thoại gần nhất (tối đa 4 tin gần nhất)
  const recentHistory = getChatHistory(userId, petId).slice(-4);
  const historyMessages = [];
  recentHistory.forEach(h => {
    if (h.sender === 'user') {
      historyMessages.push({ role: 'user', content: h.text });
    } else if (h.sender === 'assistant' && h.text) {
      historyMessages.push({ role: 'assistant', content: h.text });
    }
  });

  const systemInstructions = `Bạn là Trợ lý chăm sóc thú cưng PetCare.
Nhiệm vụ: Trả lời câu hỏi của người nuôi thú cưng bằng tiếng Việt một cách chính xác, ngắn gọn, súc tích và đúng trọng tâm.
Quy tắc:
1. Dựa trên TÀI LIỆU THAM KHẢO CHÍNH THỨC và DỮ LIỆU THÚ CƯNG được cung cấp trong yêu cầu của người dùng để trả lời.
2. Trả lời trung thực theo nội dung tài liệu, nêu rõ các lưu ý hoặc cảnh báo an toàn có trong tài liệu.
3. Không bịa đặt, không tự suy đoán thông tin y khoa ngoài tài liệu.
4. Không hiển thị suy nghĩ nội bộ (không sinh thẻ <think>).`;

  let userTurnContent = '';
  if (retrievedKnowledgeText) {
    userTurnContent += `TÀI LIỆU THAM KHẢO CHÍNH THỨC:\n${retrievedKnowledgeText}\n\n`;
  }
  if (petDataPromptSection) {
    userTurnContent += `${petDataPromptSection}\n\n`;
  }
  userTurnContent += `CÂU HỎI:\n${cleanMessage}`;

  const messages = [
    { role: 'system', content: systemInstructions },
    ...historyMessages,
    { role: 'user', content: userTurnContent }
  ];

  // 7. Kiểm soát số lượng request đồng thời (Concurrency control)
  if (activeGenerationCount >= MAX_CONCURRENT_GENERATIONS) {
    let waited = 0;
    while (activeGenerationCount >= MAX_CONCURRENT_GENERATIONS && waited < 5000) {
      await new Promise(r => setTimeout(r, 500));
      waited += 500;
    }
    if (activeGenerationCount >= MAX_CONCURRENT_GENERATIONS) {
      const busyErr = new Error('Máy chủ AI cục bộ đang xử lý câu hỏi khác. Vui lòng thử lại sau vài giây.');
      busyErr.statusCode = 429;
      busyErr.code = 'CONCURRENCY_LIMIT';
      busyErr.technicalDetail = `activeGenerationCount=${activeGenerationCount} reached limit ${MAX_CONCURRENT_GENERATIONS}`;
      throw busyErr;
    }
  }

  activeGenerationCount++;
  const controller = new AbortController();
  const timeoutMs = parseInt(config.OLLAMA_CHAT_TIMEOUT_MS || '30000', 10);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        messages,
        stream: false,
        options: {
          num_ctx: 2048,
          temperature: 0.2,
          num_predict: 512,
          repeat_penalty: 1.15
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      const genErr = new Error(`Ollama phản hồi mã lỗi: HTTP ${res.status}`);
      genErr.statusCode = res.status >= 500 ? 502 : res.status;
      genErr.code = 'OLLAMA_GENERATE_ERROR';
      genErr.technicalDetail = `POST /api/chat returned HTTP ${res.status}: ${errBody}`;
      throw genErr;
    }

    const data = await res.json();
    let rawReply = (data.message?.content || '').trim();
    rawReply = rawReply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    // Làm sạch triệt để mọi biến thể disclaimer nếu mô hình vô tình sinh trong reply
    rawReply = rawReply.replace(/\*?\s*(?:Lưu ý:\s*)?Thông tin chỉ mang tính tham khảo[^*]*?\*?/gi, '').trim();

    const isRefusal = !rawReply || /chưa có thông tin phù hợp|không có thông tin phù hợp/i.test(rawReply);

    let finalReply = rawReply;
    let finalStatus = 'answered';
    let finalSources = [];

    if (isRefusal) {
      finalReply = 'Chưa có thông tin phù hợp trong tài liệu được cung cấp.';
      finalStatus = 'insufficient_evidence';
      finalSources = [];
    } else {
      // Nếu câu hỏi kết hợp giữa dữ liệu thú cưng và RAG
      if (intent.isCombinedWithCare && petContext) {
        finalSources = [
          {
            id: 'SRC-PET-PROFILE',
            title: `Hồ sơ thú cưng (${petContext.name})`,
            organization: 'Hệ thống hồ sơ PetCare',
            type: 'pet_profile'
          },
          ...(retrievedData.sources || [])
        ];
      } else {
        finalSources = retrievedData.sources || [];
      }
    }

    // 8. Lưu vào lịch sử trò chuyện
    appendChatMessage(userId, petId, { sender: 'user', text: cleanMessage });
    appendChatMessage(userId, petId, { 
      sender: 'assistant', 
      text: finalReply, 
      sources: finalSources 
    });

    return {
      success: true,
      requestId,
      status: finalStatus,
      reply: finalReply,
      sources: finalSources,
      petContext: petContext ? { id: petContext.id, name: petContext.name, species: petContext.species } : null
    };
  } catch (err) {
    clearTimeout(timeoutId);
    console.error('[ChatService] Lỗi khi gọi Ollama chat:', err.message);

    if (err.code) {
      throw err;
    }

    if (err.name === 'AbortError') {
      const timeoutErr = new Error(`Quá thời gian chờ phản hồi từ AI cục bộ (${Math.round(timeoutMs / 1000)}s). Vui lòng thử lại.`);
      timeoutErr.statusCode = 504;
      timeoutErr.code = 'AI_TIMEOUT';
      timeoutErr.technicalDetail = `Ollama generation aborted after ${timeoutMs}ms`;
      throw timeoutErr;
    }

    const offlineErr = new Error(err.message || 'Trợ lý AI cục bộ hiện chưa sẵn sàng. Vui lòng kiểm tra lại dịch vụ Ollama.');
    offlineErr.statusCode = 503;
    offlineErr.code = 'AI_OFFLINE';
    offlineErr.technicalDetail = err.stack || err.message;
    throw offlineErr;
  } finally {
    activeGenerationCount = Math.max(0, activeGenerationCount - 1);
  }
}
