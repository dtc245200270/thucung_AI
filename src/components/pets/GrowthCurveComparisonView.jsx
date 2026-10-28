import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, Scale, AlertCircle, CheckCircle, 
  Info, Activity, ShieldCheck, Calendar,
  AlertTriangle
} from 'lucide-react';
import { BREED_GROWTH_STANDARDS } from '../../constants/mockData';

export default function GrowthCurveComparisonView({ pet }) {
  // 1. Kiểm tra giống trong hồ sơ thú cưng có khớp với chuẩn nào không
  const petBreed = pet?.breed;
  const matchedBreedKey = useMemo(() => {
    if (!petBreed) return '';
    const breedTrimmed = petBreed.trim().toLowerCase();
    const found = Object.keys(BREED_GROWTH_STANDARDS).find(
      k => k.toLowerCase() === breedTrimmed
    );
    return found || '';
  }, [petBreed]);

  // Không tự ý gán mặc định "Golden Retriever" nếu hồ sơ chưa nhập giống
  const [selectedOverride, setSelectedOverride] = useState(null);
  const [prevPetId, setPrevPetId] = useState(pet?.id);

  if (pet?.id !== prevPetId) {
    setPrevPetId(pet?.id);
    setSelectedOverride(null);
  }

  const selectedStandardBreed = selectedOverride !== null ? selectedOverride : matchedBreedKey;

  // 2. Dữ liệu chuẩn giống loài (chỉ lấy khi người dùng đã chọn chuẩn hoặc hồ sơ có giống)
  const rawStandard = selectedStandardBreed ? BREED_GROWTH_STANDARDS[selectedStandardBreed] : null;

  const standard = useMemo(() => {
    if (!rawStandard) return null;
    const curve = (rawStandard.monthlyStandards || []).map(s => ({
      month: s.month,
      min: s.min,
      max: s.max,
      avg: s.ideal
    }));
    return {
      ...rawStandard,
      breedName: selectedStandardBreed,
      curve,
      idealAdultWeight: rawStandard.adultWeightRange 
        ? `${rawStandard.adultWeightRange[0]} - ${rawStandard.adultWeightRange[1]} kg` 
        : 'Chưa có dữ liệu'
    };
  }, [rawStandard, selectedStandardBreed]);

  // 3. Số đo cân nặng hiện tại (ưu tiên bản ghi mới nhất theo ngày ghi nhận)
  const currentWeight = useMemo(() => {
    if (Array.isArray(pet?.weightHistory) && pet.weightHistory.length > 0) {
      const sortedH = [...pet.weightHistory]
        .filter(item => item && item.weight != null && !isNaN(item.weight) && parseFloat(item.weight) > 0)
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      if (sortedH.length > 0) return sortedH[sortedH.length - 1].weight;
    }
    return (pet?.weight !== null && pet?.weight !== undefined && !isNaN(pet?.weight) && parseFloat(pet.weight) > 0)
      ? parseFloat(pet.weight)
      : null;
  }, [pet]);

  // 4. Kiểm tra ngày sinh & tính độ tuổi thực tế
  const petBirthDate = pet?.birthDate;
  const birthDateObj = useMemo(() => {
    if (!petBirthDate) return null;
    const d = new Date(petBirthDate);
    return isNaN(d.getTime()) ? null : d;
  }, [petBirthDate]);

  const hasBirthDate = birthDateObj !== null;

  const currentAgeInfo = useMemo(() => {
    if (!birthDateObj) return null;
    const today = new Date();
    const diffMonths = (today.getFullYear() - birthDateObj.getFullYear()) * 12 + (today.getMonth() - birthDateObj.getMonth());
    if (diffMonths < 0) return null;
    const years = Math.floor(diffMonths / 12);
    const remainingMonths = diffMonths % 12;
    let label = `${diffMonths} tháng tuổi`;
    if (years > 0) {
      label = remainingMonths > 0 ? `${years} tuổi ${remainingMonths} tháng` : `${years} tuổi`;
    }
    return {
      totalMonths: diffMonths,
      label
    };
  }, [birthDateObj]);

  // 5. Chuẩn hóa lịch sử đo thực tế (giữ nguyên số đo thật, không tự gán tháng tuổi nếu chưa có ngày sinh)
  const rawHistory = useMemo(() => {
    if (!pet) return [];
    if (Array.isArray(pet.weightHistory) && pet.weightHistory.length > 0) {
      return [...pet.weightHistory]
        .filter(item => item && item.weight !== null && item.weight !== undefined && !isNaN(item.weight) && parseFloat(item.weight) > 0)
        .map(item => ({
          date: item.date || 'Chưa ghi ngày',
          weight: parseFloat(item.weight)
        }))
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    }
    if (currentWeight !== null) {
      return [{
        date: pet.updatedAt ? pet.updatedAt.split('T')[0] : 'Số đo hiện tại',
        weight: currentWeight
      }];
    }
    return [];
  }, [pet, currentWeight]);

  // 6. Rà soát thông tin còn thiếu
  const missingFields = useMemo(() => {
    const fields = [];
    if (!hasBirthDate) {
      fields.push({
        key: 'birthDate',
        label: 'Ngày sinh',
        message: 'Cần ngày sinh để tính độ tuổi theo tháng và đối chiếu vào đúng mốc tăng trưởng.'
      });
    }
    if (!petBreed && !selectedStandardBreed) {
      fields.push({
        key: 'breed',
        label: 'Giống thú cưng',
        message: 'Hồ sơ chưa có giống loài. Bạn có thể chọn giống tham khảo ở bộ lọc trên để xem dải chuẩn đối chiếu.'
      });
    }
    if (currentWeight === null) {
      fields.push({
        key: 'weight',
        label: 'Cân nặng',
        message: 'Chưa có số đo cân nặng nào được ghi nhận trong hồ sơ.'
      });
    }
    return fields;
  }, [hasBirthDate, petBreed, selectedStandardBreed, currentWeight]);

  // 7. Đánh giá thể trạng - Chỉ tính toán khi có ĐỦ CĂN CỨ: Cân nặng + Ngày sinh + Chuẩn giống
  const evaluation = useMemo(() => {
    if (currentWeight === null) {
      return {
        canEvaluate: false,
        reason: 'Chưa có số đo cân nặng',
        healthStatus: 'insufficient_data',
        statusTitle: 'Chưa đủ dữ liệu',
        statusDesc: 'Vui lòng ghi nhận cân nặng trong tab Cân Nặng.',
        weightDiff: null,
        diffPercent: null
      };
    }

    if (!hasBirthDate || !currentAgeInfo) {
      return {
        canEvaluate: false,
        reason: 'Thiếu ngày sinh',
        healthStatus: 'insufficient_data',
        statusTitle: 'Chưa đủ căn cứ đánh giá',
        statusDesc: 'Cần ngày sinh để tính độ tuổi của bé và đối chiếu với dải tăng trưởng chuẩn.',
        weightDiff: null,
        diffPercent: null
      };
    }

    if (!standard || !standard.curve || standard.curve.length === 0) {
      return {
        canEvaluate: false,
        reason: 'Chưa chọn chuẩn giống',
        healthStatus: 'insufficient_data',
        statusTitle: 'Chưa chọn chuẩn giống',
        statusDesc: 'Vui lòng chọn một giống tham khảo ở bộ lọc trên để xem dải đối chiếu.',
        weightDiff: null,
        diffPercent: null
      };
    }

    // Đã có đầy đủ cả độ tuổi và chuẩn giống
    const ageMonths = currentAgeInfo.totalMonths;
    let targetMilestone = null;

    if (ageMonths >= 12) {
      targetMilestone = standard.curve.find(c => c.month === 12) || standard.curve[standard.curve.length - 1];
    } else {
      targetMilestone = standard.curve.reduce((prev, curr) => {
        return Math.abs(curr.month - ageMonths) < Math.abs(prev.month - ageMonths) ? curr : prev;
      });
    }

    if (!targetMilestone) {
      return {
        canEvaluate: false,
        reason: 'Không tìm thấy mốc chuẩn',
        healthStatus: 'insufficient_data',
        statusTitle: 'Chưa có mốc đối chiếu',
        statusDesc: 'Chưa có dữ liệu chuẩn cho độ tuổi này.',
        weightDiff: null,
        diffPercent: null
      };
    }

    const diff = (currentWeight - targetMilestone.avg).toFixed(1);
    const percent = Math.round(((currentWeight - targetMilestone.avg) / targetMilestone.avg) * 100);

    let status = 'ideal';
    let title = 'Thể trạng lý tưởng';
    let desc = `Cân nặng ${currentWeight} kg nằm trong dải chuẩn (${targetMilestone.min} - ${targetMilestone.max} kg) ở mốc ${targetMilestone.month} tháng tuổi của ${standard.breedName}.`;

    if (currentWeight < targetMilestone.min) {
      status = 'underweight';
      title = `Nhẹ cân so với chuẩn (${percent}%)`;
      desc = `Thấp hơn dải chuẩn (${targetMilestone.min} - ${targetMilestone.max} kg) ở mốc ${targetMilestone.month} tháng tuổi của ${standard.breedName}.`;
    } else if (currentWeight > targetMilestone.max) {
      status = 'overweight';
      title = `Vượt chuẩn cân nặng (+${percent}%)`;
      desc = `Cao hơn dải chuẩn (${targetMilestone.min} - ${targetMilestone.max} kg) ở mốc ${targetMilestone.month} tháng tuổi của ${standard.breedName}.`;
    }

    return {
      canEvaluate: true,
      healthStatus: status,
      statusTitle: title,
      statusDesc: desc,
      weightDiff: diff,
      diffPercent: percent,
      milestone: targetMilestone
    };
  }, [currentWeight, hasBirthDate, currentAgeInfo, standard]);

  // 8. Đánh giá xu hướng tăng/giảm - Không dựng xu hướng khi chỉ có 1 lần đo
  const trendInfo = useMemo(() => {
    if (rawHistory.length === 0) {
      return {
        hasTrend: false,
        text: 'Chưa có dữ liệu đo lường cân nặng thực tế'
      };
    }
    if (rawHistory.length === 1) {
      return {
        hasTrend: false,
        text: `Mới ghi nhận 1 lần đo (${rawHistory[0].weight} kg) — Cần thêm ít nhất 2 lần đo ở các thời điểm khác nhau để xác định xu hướng tăng/giảm.`
      };
    }

    const last = rawHistory[rawHistory.length - 1];
    const prev = rawHistory[rawHistory.length - 2];
    const diff = (last.weight - prev.weight).toFixed(2);
    const diffNum = Number(diff);

    if (diffNum > 0) {
      return {
        hasTrend: true,
        text: `Xu hướng tăng: +${diff} kg so với lần đo ngày ${prev.date} (${prev.weight} kg → ${last.weight} kg).`
      };
    }
    if (diffNum < 0) {
      return {
        hasTrend: true,
        text: `Xu hướng giảm: ${diff} kg so với lần đo ngày ${prev.date} (${prev.weight} kg → ${last.weight} kg).`
      };
    }
    return {
      hasTrend: true,
      text: `Cân nặng duy trì ổn định (${last.weight} kg) so với lần đo ngày ${prev.date}.`
    };
  }, [rawHistory]);

  if (!pet) return null;

  return (
    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-6 shadow-sm space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Đường Cong Tăng Trưởng & Chuẩn Giống Loài</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 uppercase">
                Dữ Liệu Tham Khảo
              </span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Đối chiếu số đo thực tế của {pet.name} với đường cong tăng trưởng chuẩn quốc tế
            </p>
          </div>
        </div>

        {/* Standard Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Chuẩn đối chiếu:</span>
          <select
            value={selectedStandardBreed}
            onChange={(e) => setSelectedOverride(e.target.value)}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer"
          >
            <option value="" className="bg-white dark:bg-slate-800 text-slate-500">
              -- Chọn giống để tham khảo --
            </option>
            {Object.keys(BREED_GROWTH_STANDARDS).map(breed => (
              <option key={breed} value={breed} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                {breed} ({BREED_GROWTH_STANDARDS[breed].species === 'dog' ? 'Chó' : BREED_GROWTH_STANDARDS[breed].species === 'cat' ? 'Mèo' : 'Thỏ'})
              </option>
            ))}
          </select>
          {selectedStandardBreed && (
            <button
              type="button"
              onClick={() => setSelectedOverride('')}
              className="text-[11px] font-medium text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 underline transition-colors"
              title="Bỏ chọn chuẩn tham khảo"
            >
              Bỏ chọn
            </button>
          )}
        </div>
      </div>

      {/* Medical Principle Notice */}
      <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2.5 shadow-xs">
        <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5 leading-relaxed">
          <div className="font-bold text-slate-900 dark:text-slate-100">Nguyên tắc minh bạch dữ liệu y tế:</div>
          <p className="text-[11px] text-slate-600 dark:text-slate-300">
            Dữ liệu chuẩn giống loài là cơ sở tham khảo độc lập, không tự ý suy đoán tuổi hay giống khi chưa có thông tin và không tự động ghi đè vào hồ sơ gốc của thú cưng.
          </p>
        </div>
      </div>

      {/* Missing Information Notice */}
      {missingFields.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 shadow-xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5 flex-1">
              <div className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
                Cần bổ sung thông tin để đánh giá chuẩn xác ({missingFields.length} trường):
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                {missingFields.map(f => (
                  <div key={f.key} className="text-xs bg-white/70 dark:bg-slate-900/60 p-2.5 rounded-xl border border-amber-500/20">
                    <div className="font-bold text-amber-950 dark:text-amber-200">📌 {f.label}</div>
                    <div className="text-slate-700 dark:text-slate-300 text-[11px] mt-0.5">{f.message}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assessment Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        
        {/* Card 1: Actual Weight */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Cân nặng thực tế
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {currentWeight !== null ? (
              <>
                {currentWeight} <span className="text-sm font-bold text-slate-500">kg</span>
              </>
            ) : (
              <span className="text-base font-bold text-slate-400">Chưa có dữ liệu</span>
            )}
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
            {rawHistory.length === 1
              ? `Ghi nhận 1 lần đo (${rawHistory[0].date})`
              : rawHistory.length > 1
              ? `${rawHistory.length} lần đo (gần nhất: ${rawHistory[rawHistory.length - 1].date})`
              : 'Vui lòng cập nhật cân nặng trong hồ sơ'}
          </div>
        </div>

        {/* Card 2: Reference Standard */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
            <span>Chuẩn tham khảo</span>
            {standard && (
              <span className="text-[10px] font-normal text-indigo-600 dark:text-indigo-400">
                12 tháng
              </span>
            )}
          </div>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
            {standard ? standard.idealAdultWeight : <span className="text-base font-bold text-slate-400">Chưa chọn giống</span>}
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
            {standard ? `Theo chuẩn ${standard.breedName} (chỉ tham khảo)` : 'Chọn giống từ danh sách trên để đối chiếu'}
          </div>
        </div>

        {/* Card 3: Assessment */}
        <div className={`p-4 rounded-2xl border shadow-xs ${
          !evaluation.canEvaluate
            ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
            : evaluation.healthStatus === 'ideal'
            ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
            : evaluation.healthStatus === 'overweight'
            ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800/60 text-amber-900 dark:text-amber-200'
            : 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800/60 text-rose-900 dark:text-rose-200'
        }`}>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Đánh giá thể trạng
          </div>
          <div className="text-base font-black mt-1 flex items-center gap-1.5">
            {!evaluation.canEvaluate ? (
              <>
                <Info className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{evaluation.statusTitle}</span>
              </>
            ) : evaluation.healthStatus === 'ideal' ? (
              <>
                <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{evaluation.statusTitle}</span>
              </>
            ) : evaluation.healthStatus === 'overweight' ? (
              <>
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>{evaluation.statusTitle}</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{evaluation.statusTitle}</span>
              </>
            )}
          </div>
          <div className="text-xs mt-1 text-slate-600 dark:text-slate-300 leading-relaxed">
            {evaluation.statusDesc}
          </div>
        </div>
      </div>

      {/* Growth Chart / Timeline Visualizer */}
      <div className="p-5 rounded-2xl bg-slate-900 text-white shadow-xl space-y-4 border border-slate-800">
        
        {/* Visualizer Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold text-white">
              {hasBirthDate ? 'Biểu đồ đối sánh theo tháng tuổi (kg)' : 'Nhật ký số đo thực tế theo ngày ghi nhận (kg)'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-indigo-300 font-semibold">
              <span className="w-3 h-1.5 bg-indigo-500 rounded-full inline-block"></span> Bé {pet.name} (Số đo thật)
            </span>
            {standard && (
              <span className="flex items-center gap-1.5 text-slate-300 font-semibold">
                <span className="w-3 h-1.5 bg-slate-500 rounded-full border border-dashed inline-block"></span> Dải chuẩn {standard.breedName}
              </span>
            )}
          </div>
        </div>

        {/* Visualizer Body: Trường hợp CHƯA CÓ NGÀY SINH */}
        {!hasBirthDate ? (
          <div className="space-y-4 py-2">
            
            {/* Cảnh báo rõ ràng: Không xếp mốc tháng tuổi khi chưa có ngày sinh */}
            <div className="p-3.5 rounded-xl bg-slate-800/90 border border-slate-700 text-xs text-slate-300 flex items-start gap-2.5">
              <Calendar className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white">Chưa có ngày sinh để xếp mốc tháng tuổi (T2, T4, T12...)</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Các số đo được lưu giữ nguyên vẹn theo ngày ghi nhận thực tế dưới đây. Hệ thống không tự tiện đặt số đo vào tháng tuổi giả lập.
                </p>
              </div>
            </div>

            {/* Danh sách các lần cân thực tế */}
            {rawHistory.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-xl">
                <Scale className="w-7 h-7 text-slate-600 mx-auto mb-2 opacity-50" />
                <p className="font-semibold text-slate-300">Chưa có dữ liệu đo lường cân nặng nào của bé {pet.name}.</p>
              </div>
            ) : (
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Lịch sử đo lường thực tế ({rawHistory.length} mốc):
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {rawHistory.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-800/90 border border-slate-700 flex items-center justify-between">
                      <div>
                        <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{item.date}</span>
                        </div>
                        <div className="text-xl font-black text-white mt-0.5">
                          {item.weight} <span className="text-xs font-normal text-slate-400">kg</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {rawHistory.length === 1 ? 'Lần đo duy nhất' : `Lần #${idx + 1}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mốc tăng trưởng chuẩn tham khảo nếu người dùng đã chọn giống */}
            {standard ? (
              <div className="pt-2 border-t border-slate-800">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Mốc chuẩn tăng trưởng giống {standard.breedName} (Dữ liệu tham khảo):</span>
                  <span className="text-[10px] font-normal text-slate-400 italic">Không gán vào hồ sơ bé</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                  {standard.curve.map(point => (
                    <div key={point.month} className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-center">
                      <div className="text-[10px] font-bold text-indigo-400">T{point.month} ({point.month} tháng)</div>
                      <div className="text-sm font-black text-white mt-0.5">{point.avg} kg</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{point.min}-{point.max} kg</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 text-xs text-slate-400 text-center">
                💡 Chọn một giống từ danh sách chuẩn đối chiếu ở trên nếu bạn muốn tham khảo các mốc cân nặng lý tưởng theo lứa tuổi.
              </div>
            )}

          </div>
        ) : (
          /* Visualizer Body: Trường hợp ĐÃ CÓ NGÀY SINH */
          <div className="space-y-4">
            {!standard ? (
              <div className="py-10 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-xl space-y-2">
                <Scale className="w-8 h-8 text-slate-600 mx-auto opacity-50" />
                <p className="font-semibold text-slate-300">
                  Bé {pet.name} có ngày sinh ({pet.birthDate}) — Độ tuổi: {currentAgeInfo?.label || 'Chưa rõ'}.
                </p>
                <p className="text-[11px] text-slate-400">
                  Vui lòng chọn một giống ở bộ lọc &quot;Chuẩn đối chiếu&quot; phía trên để vẽ biểu đồ so sánh tương ứng.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 pt-6 pb-2 items-end h-52 border-b border-slate-800 px-2">
                {standard.curve.map(point => {
                  // Tìm điểm đo thật khớp với tháng tuổi này (+-1 tháng)
                  const matchingActual = rawHistory.find(h => {
                    if (!h.date || !birthDateObj) return false;
                    const d = new Date(h.date);
                    if (isNaN(d.getTime())) return false;
                    const m = (d.getFullYear() - birthDateObj.getFullYear()) * 12 + (d.getMonth() - birthDateObj.getMonth());
                    return m === point.month;
                  });

                  const lastPoint = standard.curve[standard.curve.length - 1];
                  const maxVal = ((lastPoint?.max || 35)) * 1.15;
                  const stdHeight = Math.max(12, Math.round((point.avg / maxVal) * 100));
                  const actHeight = matchingActual ? Math.max(12, Math.round((matchingActual.weight / maxVal) * 100)) : 0;

                  return (
                    <div key={point.month} className="flex flex-col items-center h-full justify-end group">
                      <div className="flex items-end gap-1.5 w-full justify-center h-full">
                        {/* Cột chuẩn giống */}
                        <div 
                          style={{ height: `${stdHeight}%` }}
                          className="w-3 sm:w-4.5 bg-slate-700 rounded-t-md transition-all group-hover:bg-slate-600 relative border border-slate-600/50"
                          title={`Chuẩn ${standard.breedName} T${point.month}: ${point.min} - ${point.max} kg (Lý tưởng: ${point.avg} kg)`}
                        >
                          <span className="opacity-0 group-hover:opacity-100 absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] bg-slate-800 px-1 py-0.5 rounded text-slate-200 border border-slate-700 whitespace-nowrap z-10 pointer-events-none">
                            {point.avg}kg
                          </span>
                        </div>

                        {/* Cột thực tế bé */}
                        {matchingActual && (
                          <div 
                            style={{ height: `${actHeight}%` }}
                            className="w-3 sm:w-4.5 bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-md transition-all shadow-md shadow-indigo-500/30 relative border border-indigo-300/40"
                            title={`Thực tế bé ${pet.name} (T${point.month}): ${matchingActual.weight} kg (${matchingActual.date})`}
                          >
                            <span className="opacity-0 group-hover:opacity-100 absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] bg-indigo-600 px-1 py-0.5 rounded text-white font-bold whitespace-nowrap z-10 pointer-events-none shadow-xs">
                              {matchingActual.weight}kg
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="text-[10px] font-bold text-slate-300 mt-2">
                        T{point.month}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Visualizer Footer: Trend & Disclaimer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-800 text-xs">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{trendInfo.text}</span>
          </div>
          <div className="text-[11px] text-slate-400">
            * Dữ liệu đối chiếu chỉ mang tính tham khảo y khoa
          </div>
        </div>

      </div>

    </div>
  );
}
