import React, { useState, useEffect } from 'react';
import { 
  Search, 
  X, 
  PawPrint, 
  CalendarDays, 
  DollarSign, 
  Pill, 
  Building2,
  ArrowRight
} from 'lucide-react';
import { PET_SERVICES } from '../../constants/mockData';

export const GlobalSearchModal = ({
  isOpen,
  onClose,
  pets = [],
  schedules = [],
  expenses = [],
  prescriptions = [],
  onNavigateTab,
  onSelectPet
}) => {
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // Toggle search
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const kw = keyword.toLowerCase().trim();

  const matchingPets = kw ? pets.filter(p => p.name.toLowerCase().includes(kw) || p.breed.toLowerCase().includes(kw)) : [];
  const matchingSchedules = kw ? schedules.filter(s => s.title.toLowerCase().includes(kw) || (s.location && s.location.toLowerCase().includes(kw))) : [];
  const matchingExpenses = kw ? expenses.filter(e => e.title.toLowerCase().includes(kw)) : [];
  const matchingPrescriptions = kw ? prescriptions.filter(pr => pr.medicineName.toLowerCase().includes(kw) || (pr.purpose && pr.purpose.toLowerCase().includes(kw))) : [];
  const matchingClinics = kw ? PET_SERVICES.filter(c => c.name.toLowerCase().includes(kw) || c.address.toLowerCase().includes(kw)) : [];

  const totalResults = matchingPets.length + matchingSchedules.length + matchingExpenses.length + matchingPrescriptions.length + matchingClinics.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-slate-950/60 backdrop-blur-md">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full shadow-2xl border border-[#E2E8F0] dark:border-white/10 overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-[#1E293B] dark:text-white">
        
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#E2E8F0] dark:border-white/10 gap-3">
          <Search className="w-5 h-5 text-[#64748B]" />
          <input
            type="text"
            autoFocus
            placeholder="Tìm thú cưng, vắc-xin, chi tiêu, đơn thuốc, phòng khám..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="flex-1 bg-transparent text-sm font-semibold text-[#0F172A] dark:text-white outline-hidden placeholder:text-[#64748B]"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#475569] hover:text-[#0F172A] dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-4 space-y-4 text-xs">
          {!kw ? (
            <div className="py-8 text-center text-[#475569] dark:text-slate-400">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Gõ từ khóa bất kỳ để tìm kiếm tức thì trong toàn bộ hệ thống PetCare</p>
            </div>
          ) : totalResults === 0 ? (
            <div className="py-8 text-center text-[#475569] dark:text-slate-400">
              <p>Không tìm thấy kết quả nào khớp với "{keyword}"</p>
            </div>
          ) : (
            <>
              {/* Pets */}
              {matchingPets.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold text-[#475569] dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                    Thú cưng ({matchingPets.length})
                  </span>
                  <div className="space-y-1">
                    {matchingPets.map(p => (
                      <div
                        key={p.id}
                        onClick={() => {
                          onSelectPet(p.id);
                          onNavigateTab('pets');
                          onClose();
                        }}
                        className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <PawPrint className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          <div>
                            <span className="font-bold text-[#0F172A] dark:text-white">{p.name}</span>
                            <span className="text-[#475569] dark:text-slate-400 ml-2">{p.breed} • {p.weight}kg</span>
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-[#64748B]" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Schedules */}
              {matchingSchedules.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold text-[#475569] dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                    Lịch chăm sóc ({matchingSchedules.length})
                  </span>
                  <div className="space-y-1">
                    {matchingSchedules.map(s => (
                      <div
                        key={s.id}
                        onClick={() => {
                          onNavigateTab('schedule');
                          onClose();
                        }}
                        className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <CalendarDays className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                          <div>
                            <span className="font-bold text-[#0F172A] dark:text-white">{s.title}</span>
                            <span className="text-[#475569] dark:text-slate-400 ml-2">Ngày: {s.date}</span>
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-[#64748B]" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Expenses */}
              {matchingExpenses.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold text-[#475569] dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                    Khoản chi tiêu ({matchingExpenses.length})
                  </span>
                  <div className="space-y-1">
                    {matchingExpenses.map(e => (
                      <div
                        key={e.id}
                        onClick={() => {
                          onNavigateTab('expenses');
                          onClose();
                        }}
                        className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <div>
                            <span className="font-bold text-[#0F172A] dark:text-white">{e.title}</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold ml-2">{Number(e.amount).toLocaleString('vi-VN')} đ</span>
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-[#64748B]" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Prescriptions */}
              {matchingPrescriptions.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold text-[#475569] dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                    Đơn thuốc ({matchingPrescriptions.length})
                  </span>
                  <div className="space-y-1">
                    {matchingPrescriptions.map(pr => (
                      <div
                        key={pr.id}
                        onClick={() => {
                          onNavigateTab('prescriptions');
                          onClose();
                        }}
                        className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <Pill className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          <div>
                            <span className="font-bold text-[#0F172A] dark:text-white">{pr.medicineName}</span>
                            <span className="text-[#475569] dark:text-slate-400 ml-2">{pr.dosage}</span>
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-[#64748B]" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Clinics */}
              {matchingClinics.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold text-[#475569] dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                    Phòng khám & Cứu hộ ({matchingClinics.length})
                  </span>
                  <div className="space-y-1">
                    {matchingClinics.map(cl => (
                      <div
                        key={cl.id}
                        onClick={() => {
                          onNavigateTab('services');
                          onClose();
                        }}
                        className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <Building2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                          <div>
                            <span className="font-bold text-[#0F172A] dark:text-white">{cl.name}</span>
                            <span className="text-[#475569] dark:text-slate-400 ml-2">{cl.phone}</span>
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-[#64748B]" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer tip */}
        <div className="px-4 py-2.5 bg-[#F8FAFC] dark:bg-slate-950/40 border-t border-[#E2E8F0] dark:border-white/10 text-center text-[10px] text-[#475569] dark:text-slate-400">
          Mẹo: Nhấn phím <strong>ESC</strong> để đóng cửa sổ tìm kiếm.
        </div>

      </div>
    </div>
  );
};
