import React from 'react';
import {
  FileText,
  Lock,
  X,
  Pill,
  Stethoscope,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { resolveOwnerInfo } from '../../utils/ownerUtils';

export const MedicalRecordDetailModal = ({
  isOpen,
  onClose,
  record,
  appointment,
  pet,
  allAppointments = [],
  onOpenSoap,
  isLoading = false,
  error = null
}) => {
  if (!isOpen) return null;

  const linkedAppt = appointment || null;
  const ownerInfo = resolveOwnerInfo(linkedAppt, pet, allAppointments);

  return (
    <div 
      id="medical-record-detail-modal" 
      data-modal="medical-record-detail"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scaleUp">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/40">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  Hồ sơ bệnh án chi tiết
                </h3>
                {record && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-amber-500" />
                    <span>ĐÃ CHỐT (CHỈ ĐỌC)</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                {record ? (
                  <>
                    Mã BA: <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{record.id}</span>
                    {' • '}
                    Ca khám: <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">{record.appointmentId || linkedAppt?.id || '—'}</span>
                  </>
                ) : (
                  <>Ca khám: <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">{linkedAppt?.id || '—'}</span></>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            data-btn="close-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {isLoading && (
            <div className="py-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-medium">Đang tải thông tin bệnh án từ máy chủ...</p>
            </div>
          )}

          {error && !isLoading && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 space-y-2">
              <div className="flex items-center gap-2 font-bold text-xs">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>Không tìm thấy hồ sơ bệnh án</span>
              </div>
              <p className="text-xs leading-relaxed">{error}</p>
              <p className="text-[11px] text-rose-500/80 italic">
                Hệ thống không tự ý tạo mới hoặc mở nhầm ca khám khác để đảm bảo tính toàn vẹn dữ liệu.
              </p>
            </div>
          )}

          {record && !isLoading && (
            <>
              {/* Thẻ tóm tắt thông tin ca khám & Chủ nuôi */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block">Thú cưng:</span>
                  <strong className="text-slate-800 dark:text-slate-200 font-semibold">{pet?.name || record.petName || 'Thú cưng'}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Chủ nuôi hiện tại:</span>
                  <strong className="text-slate-800 dark:text-slate-200 font-semibold block">{ownerInfo.currentOwnerName}</strong>
                  {ownerInfo.isHistoricalDifferent && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 block font-normal mt-0.5" title="Thông tin liên hệ ghi nhận tại thời điểm đặt lịch">
                      Liên hệ lúc đặt: {ownerInfo.historicalName} {ownerInfo.historicalPhone ? `(${ownerInfo.historicalPhone})` : ''}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Thời gian ca khám:</span>
                  <strong className="text-indigo-600 dark:text-indigo-400 font-semibold">
                    {linkedAppt ? `${linkedAppt.date} ${linkedAppt.time || ''}` : record.confirmedAt ? new Date(record.confirmedAt).toLocaleDateString('vi-VN') : '—'}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Bác sĩ chốt bệnh án:</span>
                  <strong className="text-slate-800 dark:text-slate-200 font-semibold">
                    {record.confirmedBy || record.authorName || record.vetName || 'Bác sĩ phụ trách'}
                  </strong>
                </div>
              </div>

              {/* Chỉ số sinh tồn */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block">Thân nhiệt</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {record.soap?.temp ? `${record.soap.temp} °C` : '—'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block">Nhịp tim</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {record.soap?.heartRate ? `${record.soap.heartRate} bpm` : '—'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block">Nhịp thở</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {record.soap?.respiratoryRate ? `${record.soap.respiratoryRate} rpm` : '—'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block">Cân nặng</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {record.soap?.weight ? `${record.soap.weight} kg` : pet?.weight ? `${pet.weight} kg` : '—'}
                  </span>
                </div>
              </div>

              {/* 4 Khối SOAP */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* S */}
                <div className="p-3.5 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 space-y-1">
                  <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                    S • Subjective (Triệu chứng & Lời khai)
                  </span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                    {record.soap?.subjective || record.subjective || 'Chưa có thông tin ghi nhận.'}
                  </p>
                </div>

                {/* O */}
                <div className="p-3.5 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 space-y-1">
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                    O • Objective (Khám thực thể & Lâm sàng)
                  </span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                    {record.soap?.objective || record.objective || 'Chưa có thông tin ghi nhận.'}
                  </p>
                </div>

                {/* A */}
                <div className="p-3.5 rounded-xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 space-y-1">
                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                    A • Assessment (Chẩn đoán lâm sàng)
                  </span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed font-semibold">
                    {record.soap?.assessment || record.assessment || record.diagnosis || 'Chưa có thông tin ghi nhận.'}
                  </p>
                </div>

                {/* P */}
                <div className="p-3.5 rounded-xl bg-cyan-50/40 dark:bg-cyan-950/20 border border-cyan-100 dark:border-cyan-900/40 space-y-1">
                  <span className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider block">
                    P • Plan (Phác đồ & Kế hoạch điều trị)
                  </span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                    {record.soap?.plan || record.plan || 'Chưa có thông tin ghi nhận.'}
                  </p>
                </div>
              </div>

              {/* ĐƠN THUỐC LIÊN KẾT */}
              <div className="space-y-2 pt-2">
                {(() => {
                  const meds = (Array.isArray(record.prescriptions) && record.prescriptions.length > 0)
                    ? record.prescriptions
                    : (Array.isArray(record.soap?.planMedications) ? record.soap.planMedications : []);

                  return (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Pill className="w-4 h-4 text-emerald-500" />
                          <span>Đơn thuốc kèm theo ({meds.length} loại thuốc)</span>
                        </span>
                      </div>

                      {meds.length === 0 ? (
                        <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                          <p className="text-xs text-slate-400">
                            Ca khám này không kê đơn thuốc kèm theo (0 đơn thuốc).
                          </p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                              <tr>
                                <th className="py-2 px-3 font-semibold">Tên thuốc</th>
                                <th className="py-2 px-3 font-semibold">Liều lượng</th>
                                <th className="py-2 px-3 font-semibold">Đường dùng</th>
                                <th className="py-2 px-3 font-semibold">Tần suất</th>
                                <th className="py-2 px-3 font-semibold">Thời gian</th>
                                <th className="py-2 px-3 font-semibold">Hướng dẫn</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900/40">
                              {meds.map((m, idx) => (
                                <tr key={idx}>
                                  <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">{(m.name || '').trim()}</td>
                                  <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{(m.dose || m.dosage || '—').trim?.() || (m.dose || m.dosage || '—')}</td>
                                  <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{m.route || 'Uống'}</td>
                                  <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{m.freq || '—'}</td>
                                  <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{m.days ? `${m.days} ngày` : '—'}</td>
                                  <td className="py-2 px-3 text-slate-500">{m.instructions || m.usage || m.notes || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Thông báo khóa chỉ đọc */}
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Bệnh án đã chốt và công bố chính thức. Toàn bộ thông tin được bảo vệ ở chế độ chỉ đọc.</span>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/40">
          <button
            type="button"
            data-btn="close-modal-btn"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Đóng
          </button>
          {record && onOpenSoap && (record.appointmentId || linkedAppt?.id) && (
            <button
              type="button"
              onClick={() => {
                onOpenSoap(record.appointmentId || linkedAppt?.id, record.petId || pet?.id, record.id);
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-indigo-500/20"
            >
              <Stethoscope className="w-4 h-4" />
              <span>Mở trong tab SOAP ({record.appointmentId || linkedAppt?.id})</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MedicalRecordDetailModal;
