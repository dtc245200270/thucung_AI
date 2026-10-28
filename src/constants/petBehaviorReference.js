// ============================================================================
// DỮ LIỆU THAM KHẢO SINH HỌC THEO LOÀI (THAM KHẢO CHUNG, KHÔNG PHẢI KẾT LUẬN CỦA BÉ CỤ THỂ)
// ============================================================================
export const REFERENCE_DATA = {
  dog: {
    speciesName: 'Chó',
    archetype: 'Tập tính bầy đàn & Giao tiếp bằng ánh mắt',
    advice: 'Không ép chó nhìn mắt trực diện khi đang căng thẳng; chỉ tập giao tiếp khi bé cảm thấy an toàn và thoải mái bên bạn.',
    science: 'Các nghiên cứu tập tính học chứng minh giao tiếp ánh mắt tích cực giữa chó và chủ kích hoạt sản sinh hormone Oxytocin gắn kết cho cả hai.',
    tags: ['Tương tác bầy đàn', 'Khứu giác tích cực', 'Thích khen thưởng'],
    quests: [
      { id: 'q1', title: 'Giao tiếp ánh mắt tích cực', duration: 180, category: 'Gắn Kết' }
    ]
  },
  cat: {
    speciesName: 'Mèo',
    archetype: 'Tập tính độc lập & Nhạy cảm với kích thích',
    advice: 'Tuyệt đối không nhìn trừng trừng vào mắt mèo. Hãy thực hành chớp mắt thật chậm rãi rồi quay nhẹ đầu sang hướng khác để thể hiện sự tôn trọng không gian.',
    science: 'Chớp mắt chậm ở mèo tương đương với nụ cười hòa bình, giúp giảm nhịp tim và xây dựng lòng tin cậy dài hạn.',
    tags: ['Cần không gian riêng', 'Chớp mắt chậm', 'Nhạy cảm âm thanh'],
    quests: [
      { id: 'q1', title: 'Thực hành chớp mắt chậm', duration: 120, category: 'Ranh Giới' }
    ]
  },
  other: {
    speciesName: 'Thú cưng khác',
    archetype: 'Quan sát hành vi tự nhiên',
    advice: 'Tôn trọng nhịp sinh học tự nhiên và dành thời gian quan sát khoảng cách an toàn mà bé cảm thấy thoải mái nhất.',
    science: 'Môi trường sống ổn định và sự kiên nhẫn của người nuôi giúp vật nuôi thích nghi tốt hơn và giảm các biểu hiện căng thẳng.',
    tags: ['Kiên nhẫn', 'Môi trường yên tĩnh', 'Quan sát tự do'],
    quests: [
      { id: 'q1', title: 'Tương tác nhẹ nhàng', duration: 300, category: 'Thấu Hiểu' }
    ]
  }
};

export const getPetReferenceData = (species = '') => {
  const s = String(species).toLowerCase();
  if (s.includes('chó') || s.includes('dog')) return REFERENCE_DATA.dog;
  if (s.includes('mèo') || s.includes('cat')) return REFERENCE_DATA.cat;
  return REFERENCE_DATA.other;
};
