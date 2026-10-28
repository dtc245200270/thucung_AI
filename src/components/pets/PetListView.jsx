import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Calendar, 
  Scale, 
  Edit, 
  Trash2, 
  Sparkles, 
  PawPrint,
  MoreVertical,
  CalendarPlus,
  RotateCcw,
  X,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { sound } from '../../services/soundService';
import { PageContainer, PageHeader, FilterBar, EmptyState } from '../common/ui';

// Chuẩn hóa chuỗi tìm kiếm không phân biệt dấu tiếng Việt
const removeDiacritics = (str) => {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
};

// Helper nhận dạng loài và icon hiển thị, hỗ trợ ánh xạ nhãn tiếng Việt & mã dữ liệu
export const getSpeciesInfo = (species) => {
  const s = String(species || '').toLowerCase().trim();
  if (s === 'dog' || s === 'chó' || s.includes('dog') || s.includes('chó')) {
    return { id: 'dog', icon: '🐕', label: 'Chó', aliases: ['chó', 'cho', 'dog', 'cún', 'cun'] };
  }
  if (s === 'cat' || s === 'mèo' || s === 'meo' || s.includes('cat') || s.includes('mèo') || s.includes('meo')) {
    return { id: 'cat', icon: '🐱', label: 'Mèo', aliases: ['mèo', 'meo', 'cat', 'miêu', 'mieu'] };
  }
  if (s === 'rabbit' || s === 'thỏ' || s === 'tho' || s.includes('rabbit') || s.includes('thỏ') || s.includes('tho')) {
    return { id: 'rabbit', icon: '🐰', label: 'Thỏ', aliases: ['thỏ', 'tho', 'rabbit'] };
  }
  if (s === 'hamster' || s === 'chuột' || s === 'chuot' || s.includes('hamster') || s.includes('chuột') || s.includes('chuot')) {
    return { id: 'hamster', icon: '🐹', label: 'Hamster', aliases: ['hamster', 'chuột', 'chuot', 'mouse'] };
  }
  if (s === 'bird' || s === 'chim' || s.includes('bird') || s.includes('chim')) {
    return { id: 'bird', icon: '🦜', label: 'Chim', aliases: ['chim', 'bird'] };
  }
  if (s === 'other' || s === 'khác' || s === 'khac') {
    return { id: 'other', icon: '🐾', label: 'Khác', aliases: ['khác', 'khac', 'other'] };
  }
  return { id: s || 'other', icon: '🐾', label: species || 'Thú cưng', aliases: [s] };
};

export const PetListView = ({
  pets = [],
  petsLoading = false,
  petsError = null,
  onRetryLoadPets = null,
  onOpenAddPet,
  onOpenEditPet,
  onDeletePet,
  onViewPetDetail,
  onOpenAiScheduleForPet,
  onOpenVetBooking = () => {}
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSpecies, setFilterSpecies] = useState('all');
  const [openMenuPetId, setOpenMenuPetId] = useState(null);

  const handleClearSearchAndFilter = () => {
    try { sound?.playClick?.(); } catch {}
    setSearchTerm('');
    setFilterSpecies('all');
  };

  // Đảm bảo dữ liệu danh sách thú cưng an toàn và hỗ trợ dữ liệu rỗng/null
  const safePets = Array.isArray(pets) ? pets : [];

  // Chuẩn hóa từ khóa tìm kiếm
  const normalizedSearch = searchTerm.trim().replace(/\s+/g, ' ');
  const searchTokens = normalizedSearch ? normalizedSearch.toLowerCase().split(' ').filter(Boolean) : [];

  const filteredPets = safePets.filter((pet) => {
    if (!pet) return false;
    const speciesInfo = getSpeciesInfo(pet.species);

    let matchSearch = true;
    if (searchTokens.length > 0) {
      const pName = String(pet.name || '').toLowerCase();
      const pNameNorm = removeDiacritics(pName);
      const pBreed = String(pet.breed || '').toLowerCase();
      const pBreedNorm = removeDiacritics(pBreed);
      const pSpeciesRaw = String(pet.species || '').toLowerCase();
      const pSpeciesRawNorm = removeDiacritics(pSpeciesRaw);
      const pSpeciesLabel = String(speciesInfo.label || '').toLowerCase();
      const pSpeciesLabelNorm = removeDiacritics(pSpeciesLabel);
      const aliases = Array.isArray(speciesInfo.aliases) ? speciesInfo.aliases : [];

      matchSearch = searchTokens.every((token) => {
        const tokenNorm = removeDiacritics(token);
        const nameMatch = pName.includes(token) || pNameNorm.includes(tokenNorm);
        const breedMatch = pBreed.includes(token) || pBreedNorm.includes(tokenNorm);
        const speciesRawMatch = pSpeciesRaw.includes(token) || pSpeciesRawNorm.includes(tokenNorm);
        const speciesLabelMatch = pSpeciesLabel.includes(token) || pSpeciesLabelNorm.includes(tokenNorm);
        const aliasMatch = aliases.some((a) => {
          const aLower = String(a).toLowerCase();
          const aNorm = removeDiacritics(aLower);
          return aLower.includes(token) || aNorm.includes(tokenNorm);
        });

        return nameMatch || breedMatch || speciesRawMatch || speciesLabelMatch || aliasMatch;
      });
    }

    const matchSpecies = filterSpecies === 'all' || 
                         pet.species === filterSpecies || 
                         speciesInfo.id === filterSpecies;

    return matchSearch && matchSpecies;
  });

  const calculateAge = (birthDate, fallbackAge) => {
    if (fallbackAge) return fallbackAge;
    if (!birthDate) return 'Chưa cập nhật';
    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) return 'Chưa cập nhật';
    const now = new Date();
    const diffMonths = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
    if (diffMonths < 1) return 'Dưới 1 tháng';
    if (diffMonths < 12) return `${diffMonths} tháng`;
    const years = Math.floor(diffMonths / 12);
    const remainingMonths = diffMonths % 12;
    return remainingMonths > 0 ? `${years} tuổi ${remainingMonths} tháng` : `${years} tuổi`;
  };

  const handleViewDetails = (pet) => {
    try { sound?.playPop?.(); } catch {}
    onViewPetDetail(pet);
  };

  const handleBookAppointment = (pet) => {
    try { sound?.playClick?.(); } catch {}
    onOpenVetBooking({
      petId: pet.id,
      petName: pet.name,
      note: ''
    });
  };

  return (
    <PageContainer id="pet-list-page">
      {/* 1. Header chuẩn hóa */}
      <PageHeader
        title="Hồ sơ thú cưng"
        subtitle="Quản lý căn cước điện tử, sổ y bạ số, vi-chip nhận dạng và đặc tính riêng biệt từng bé"
        badge={
          petsLoading
            ? { label: 'Đang tải...', variant: 'indigo' }
            : petsError
            ? { label: 'Lỗi tải', variant: 'rose' }
            : { label: `${safePets.length} bé`, variant: 'indigo' }
        }
        actions={
          <button
            onClick={() => {
              try { sound?.playClick?.(); } catch {}
              onOpenAddPet();
            }}
            className="inline-flex items-center justify-center gap-2 h-11 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl shadow-sm active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Thêm thú cưng</span>
          </button>
        }
      />

      {/* 2. Thanh tìm kiếm và bộ lọc loài */}
      <FilterBar
        onReset={searchTerm || filterSpecies !== 'all' ? handleClearSearchAndFilter : null}
      >
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo tên hoặc giống loài..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-11 pl-10 pr-10 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-slate-800 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                try { sound?.playClick?.(); } catch {}
                setSearchTerm('');
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-200/50 dark:hover:bg-white/10 cursor-pointer"
              title="Xóa từ khóa"
              aria-label="Xóa từ khóa tìm kiếm"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'dog', label: '🐶 Chó' },
            { id: 'cat', label: '🐱 Mèo' },
            { id: 'rabbit', label: '🐰 Thỏ' },
            { id: 'hamster', label: '🐹 Chuột' },
            { id: 'bird', label: '🦜 Chim' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                try { sound?.playClick?.(); } catch {}
                setFilterSpecies(item.id);
              }}
              className={`h-11 px-4 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                filterSpecies === item.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white dark:bg-[#12192A] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200 dark:border-white/10'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </FilterBar>

      {/* 3. Đang tải dữ liệu ban đầu (chỉ hiển thị skeleton to nếu chưa có bất kỳ thú cưng nào trong cache) */}
      {petsLoading && safePets.length === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((idx) => (
            <div key={idx} className="bg-white dark:bg-[#12192A] rounded-2xl p-5 border border-slate-200/80 dark:border-white/10 shadow-sm animate-pulse min-h-[380px] flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-full h-48 rounded-xl bg-slate-200 dark:bg-white/10" />
                <div className="h-5 w-3/4 rounded-lg bg-slate-200 dark:bg-white/10" />
                <div className="h-4 w-1/2 rounded-lg bg-slate-200 dark:bg-white/10" />
              </div>
              <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex gap-2">
                <div className="h-10 flex-1 rounded-xl bg-slate-200 dark:bg-white/10" />
                <div className="h-10 flex-1 rounded-xl bg-slate-200 dark:bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4. Lỗi kết nối máy chủ */}
      {petsError && (
        <div className="p-4 sm:p-5 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-900 dark:text-rose-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-xl shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Không thể tải danh sách thú cưng từ máy chủ
              </h3>
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">
                {petsError || 'Đã có lỗi xảy ra trong quá trình kết nối hoặc đồng bộ dữ liệu.'}
              </p>
            </div>
          </div>
          {onRetryLoadPets && (
            <button
              type="button"
              onClick={() => {
                try { sound?.playClick?.(); } catch {}
                onRetryLoadPets();
              }}
              className="inline-flex items-center gap-2 h-9 px-4 bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs rounded-xl shadow-sm active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Thử lại</span>
            </button>
          )}
        </div>
      )}

      {/* 5. Trạng thái rỗng: Chưa có thú cưng nào */}
      {!petsLoading && !petsError && safePets.length === 0 && (
        <EmptyState
          icon={PawPrint}
          title="Bạn chưa có hồ sơ thú cưng nào"
          description="Hãy thêm bé cưng đầu tiên để theo dõi sức khỏe, lịch tiêm phòng, lịch khám và tạo thẻ căn cước điện tử."
          actionText="Thêm thú cưng đầu tiên"
          onAction={() => {
            try { sound?.playClick?.(); } catch {}
            onOpenAddPet();
          }}
        />
      )}

      {/* 6. Trạng thái rỗng: Tìm kiếm không khớp */}
      {!petsLoading && safePets.length > 0 && filteredPets.length === 0 && (
        <EmptyState
          icon={Search}
          title="Không tìm thấy thú cưng phù hợp"
          description="Không có hồ sơ nào khớp với từ khóa tìm kiếm hoặc bộ lọc loài hiện tại. Vui lòng thử từ khóa khác hoặc xóa bộ lọc."
          actionText="Xóa bộ lọc tìm kiếm"
          onAction={handleClearSearchAndFilter}
        />
      )}

      {/* 7. Lưới danh sách 3 cột chuẩn hóa (Hiển thị ngay lập tức khi có dữ liệu) */}
      {filteredPets.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPets.map((pet, idx) => {
            if (!pet) return null;
            const speciesInfo = getSpeciesInfo(pet.species);
            const hasAvatar = Boolean(pet.avatar && String(pet.avatar).trim());
            const petGender = pet.gender === 'male' || pet.gender === 'Đực' 
              ? '♂ Đực' 
              : pet.gender === 'female' || pet.gender === 'Cái' 
              ? '♀ Cái' 
              : 'Chưa rõ';
            const petAge = calculateAge(pet.birthDate, pet.age);
            const petColor = (pet.color && String(pet.color).trim()) ? String(pet.color).trim() : 'Chưa cập nhật';
            let resolvedWeight = pet.weight;
            if (Array.isArray(pet.weightHistory) && pet.weightHistory.length > 0) {
              const sortedH = [...pet.weightHistory]
                .filter(h => h && h.weight != null && !isNaN(h.weight) && Number(h.weight) > 0)
                .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
              if (sortedH.length > 0) {
                resolvedWeight = sortedH[sortedH.length - 1].weight;
              }
            }
            const petWeight = (resolvedWeight != null && resolvedWeight !== '') ? `${resolvedWeight} kg` : 'Chưa cập nhật';
            const petNote = (pet.notes && String(pet.notes).trim()) || (pet.note && String(pet.note).trim()) || 'Chưa có ghi chú đặc biệt';

            return (
              <div 
                key={pet.id || `pet-${idx}`}
                className="bg-white dark:bg-[#12192A] border border-slate-200/80 dark:border-white/10 hover:border-indigo-400/50 dark:hover:border-indigo-400/50 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between group"
              >
                {/* Ảnh bé + Huy hiệu trạng thái trên ảnh */}
                <div className="relative h-48 w-full bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center overflow-hidden">
                  {hasAvatar ? (
                    <>
                      <img 
                        src={pet.avatar} 
                        alt={pet.name || 'Thú cưng'} 
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
                        onError={(e) => {
                          e.target.style.display = 'none';
                          if (e.target.nextElementSibling) {
                            e.target.nextElementSibling.style.display = 'flex';
                          }
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-black/10 pointer-events-none" />
                    </>
                  ) : null}

                  {/* Placeholder ảnh KHÔNG CÓ gradient đen như ảnh thật */}
                  <div 
                    className={`w-full h-full flex flex-col items-center justify-center gap-1.5 text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/40 ${hasAvatar ? 'hidden' : 'flex'}`}
                  >
                    <PawPrint className="w-10 h-10 stroke-[1.5] text-slate-300 dark:text-slate-600" />
                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500">Chưa có ảnh</span>
                  </div>
                  
                  {/* Huy hiệu loài & triệt sản */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap z-10">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-white/95 dark:bg-slate-900/90 text-slate-800 dark:text-slate-200 shadow-sm border border-slate-200/60 dark:border-white/10">
                      {speciesInfo.icon} {speciesInfo.label}
                    </span>
                    {pet.isNeutered && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/90 text-white shadow-sm">
                        ✓ Đã triệt sản
                      </span>
                    )}
                  </div>

                  {/* Giới tính góc phải */}
                  <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/95 dark:bg-slate-900/90 text-slate-800 dark:text-slate-200 shadow-sm border border-slate-200/60 dark:border-white/10 z-10">
                    {petGender}
                  </span>
                </div>

                {/* Nội dung thông tin bé */}
                <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-baseline justify-between gap-1">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate">{pet.name || 'Chưa đặt tên'}</h3>
                      <span className="text-xs text-indigo-600 dark:text-indigo-400 font-mono shrink-0">
                        {pet.microchip ? `Chip #${pet.microchip}` : 'Chưa gắn microchip'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">{pet.breed || 'Chưa cập nhật'} • {petColor}</p>

                    {/* Thông số Tuổi & Cân nặng */}
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <div className="bg-slate-50 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/5 rounded-xl px-3 py-2 flex items-center gap-2">
                        <Calendar className="text-indigo-500 shrink-0" size={14} />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{petAge}</span>
                      </div>
                      <div className="bg-slate-50 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/5 rounded-xl px-3 py-2 flex items-center gap-2">
                        <Scale className="text-emerald-500 shrink-0" size={14} />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{petWeight}</span>
                      </div>
                    </div>

                    {/* Ghi chú */}
                    <div className="mt-3 bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/5 rounded-xl p-2.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed italic line-clamp-2">
                      💬 {petNote}
                    </div>
                  </div>

                  {/* Cụm Nút Hành Động Ở Đáy Thẻ */}
                  <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex items-center gap-2 relative">
                    <button 
                      type="button"
                      onClick={() => handleViewDetails(pet)}
                      className="flex-1 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-white/5 dark:hover:bg-white/10 text-xs font-medium dark:text-slate-200 dark:hover:text-white transition-all text-center cursor-pointer active:scale-95"
                    >
                      Chi tiết
                    </button>

                    <button 
                      type="button"
                      onClick={() => handleBookAppointment(pet)}
                      className="flex-1 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-medium text-white transition-all shadow-sm text-center flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <CalendarPlus size={14} />
                      <span>Đặt khám</span>
                    </button>

                    {/* Dropdown Menu Tùy chọn khác */}
                    <div className="relative">
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          try { sound?.playClick?.(); } catch {}
                          setOpenMenuPetId(openMenuPetId === pet.id ? null : pet.id);
                        }}
                        className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                          openMenuPetId === pet.id
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-400/40'
                            : 'bg-slate-100 hover:bg-slate-200 border-slate-200/80 text-slate-500 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 dark:text-slate-400 dark:hover:text-white'
                        }`}
                        title="Tùy chọn khác"
                        aria-label="Tùy chọn khác"
                      >
                        <MoreVertical size={15} />
                      </button>

                      {openMenuPetId === pet.id && (
                        <>
                          <div 
                            className="fixed inset-0 z-40" 
                            onClick={() => setOpenMenuPetId(null)} 
                          />
                          <div 
                            className="absolute right-0 bottom-full mb-2 w-48 p-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/15 shadow-xl backdrop-blur-2xl z-50 space-y-1 text-slate-700 dark:text-slate-300 animate-in fade-in zoom-in-95 duration-150"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuPetId(null);
                                try { sound?.playPop?.(); } catch {}
                                onOpenAiScheduleForPet(pet);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/10 transition-all cursor-pointer text-left"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                              <span>AI Lộ trình chăm sóc</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuPetId(null);
                                try { sound?.playClick?.(); } catch {}
                                onOpenEditPet(pet);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/10 transition-all cursor-pointer text-left"
                            >
                              <Edit className="w-3.5 h-3.5 text-blue-500" />
                              <span>Chỉnh sửa thông tin</span>
                            </button>

                            <div className="h-[1px] bg-slate-100 dark:bg-white/10 my-1" />

                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuPetId(null);
                                onDeletePet(pet.id);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:text-rose-200 dark:hover:bg-rose-500/20 transition-all cursor-pointer text-left"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                              <span>Xóa hồ sơ</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
};

export default PetListView;
