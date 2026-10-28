import React, { useState, useMemo } from 'react';
import { 
  DollarSign, 
  Plus, 
  Trash2, 
  Edit3, 
  Filter, 
  Calendar, 
  Search, 
  Download, 
  RotateCcw, 
  PawPrint, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle2, 
  X, 
  Utensils, 
  Stethoscope, 
  Sparkles, 
  Gamepad2, 
  Receipt, 
  HelpCircle,
  PiggyBank,
  ChevronRight,
  Info
} from 'lucide-react';
import { sound } from '../../services/soundService';
import { getTodayVnDate, getVnDateString } from '../../utils/dateUtils.js';
import { PageContainer, PageHeader, FilterBar, StatCard, Card, CardHeader, EmptyState, Modal } from '../common/ui';

// ============================================================================
// 1. DANH MỤC CHI TIÊU CHUẨN Y KHOA & ĐỜI SỐNG THÚ CƯNG
// ============================================================================
export const EXPENSE_CATEGORIES = {
  food: {
    key: 'food',
    label: 'Thức ăn',
    icon: Utensils,
    color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50',
    barColor: '#10b981' // emerald-500
  },
  medical: {
    key: 'medical',
    label: 'Y tế',
    icon: Stethoscope,
    color: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50',
    barColor: '#3b82f6' // blue-500
  },
  grooming: {
    key: 'grooming',
    label: 'Vệ sinh/Spa',
    icon: Sparkles,
    color: 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50',
    barColor: '#a855f7' // purple-500
  },
  supplies: {
    key: 'supplies',
    label: 'Đồ dùng',
    icon: Gamepad2,
    color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50',
    barColor: '#f59e0b' // amber-500
  },
  other: {
    key: 'other',
    label: 'Khác',
    icon: Receipt,
    color: 'bg-slate-100 text-slate-700 dark:bg-white/[0.08] dark:text-slate-300 border border-slate-200 dark:border-white/[0.1]',
    barColor: '#64748b' // slate-500
  }
};

// Chuẩn hóa danh mục tương thích ngược với dữ liệu cũ (toys, vaccine, hygiene...)
export const normalizeCategoryKey = (cat) => {
  const c = String(cat || '').toLowerCase().trim();
  if (c === 'food' || c === 'thức ăn') return 'food';
  if (c === 'medical' || c === 'y tế' || c === 'vaccine' || c === 'thuốc men') return 'medical';
  if (c === 'grooming' || c === 'vệ sinh/spa' || c === 'hygiene' || c === 'spa') return 'grooming';
  if (c === 'supplies' || c === 'đồ dùng' || c === 'toys' || c === 'phụ kiện') return 'supplies';
  return 'other';
};

// Helper định dạng tiền tệ VND chính xác: ví dụ 150.000 đ
export const formatVND = (num) => {
  if (num === null || num === undefined || isNaN(Number(num))) return '0 đ';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Math.round(Number(num)));
};

// Helper chống CSV Injection khi xuất tệp dữ liệu
export const sanitizeCsvCell = (value) => {
  if (value === null || value === undefined) return '""';
  let str = String(value).trim();
  // Nếu ký tự đầu là =, +, -, @, \t, \r thì prefix với dấu nháy đơn ' để tránh Excel thực thi công thức
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  return `"${str.replace(/"/g, '""')}"`;
};

// ============================================================================
// 2. COMPONENT CHÍNH EXPENSEVIEW
// ============================================================================
export const ExpenseView = ({
  expenses = [],
  pets = [],
  budgets = [],
  onAddExpense = async () => {},
  onUpdateExpense = async () => {},
  onDeleteExpense = async () => {},
  onAddBudget = async () => {},
  onUpdateBudget = async () => {},
  onDeleteBudget = async () => {},
  currentUser,
  onReloadData = () => {}
}) => {
  const todayVn = getTodayVnDate();
  const currentMonthStr = todayVn.slice(0, 7); // 'YYYY-MM'

  // --- STATE BỘ LỌC ---
  const [selectedPetId, setSelectedPetId] = useState('all'); // 'all' | 'shared' | petId
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr); // 'all' | 'YYYY-MM'
  const [selectedCategory, setSelectedCategory] = useState('all'); // 'all' | 'food' | 'medical' | 'grooming' | 'supplies' | 'other'
  const [searchTerm, setSearchTerm] = useState('');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [isCustomDateRange, setIsCustomDateRange] = useState(false);

  // --- MODAL THÊM / SỬA KHOẢN CHI ---
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState(null);
  const [expenseFormData, setExpenseFormData] = useState({
    title: '',
    petId: 'shared',
    category: 'food',
    amount: '',
    date: todayVn,
    notes: ''
  });
  const [expenseFormError, setExpenseFormError] = useState('');
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  // --- MODAL THIẾT LẬP / SỬA NGÂN SÁCH ---
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [budgetToEdit, setBudgetToEdit] = useState(null);
  const [budgetFormData, setBudgetFormData] = useState({
    month: currentMonthStr,
    scope: 'all',
    amount: ''
  });
  const [budgetFormError, setBudgetFormError] = useState('');
  const [isSubmittingBudget, setIsSubmittingBudget] = useState(false);

  // --- MODAL XÁC NHẬN XÓA ---
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const [budgetToDelete, setBudgetToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Trích xuất danh sách tháng có sẵn từ dữ liệu chi tiêu + tháng hiện tại
  const availableMonths = useMemo(() => {
    const set = new Set();
    set.add(currentMonthStr);
    (expenses || []).forEach(e => {
      if (e && e.date && e.date.length >= 7) {
        set.add(e.date.slice(0, 7));
      }
    });
    return Array.from(set).sort().reverse();
  }, [expenses, currentMonthStr]);

  // --------------------------------------------------------------------------
  // 3. LOGIC LỌC KHOẢN CHI & QUY TẮC DÙNG CHUNG
  // --------------------------------------------------------------------------
  // Quy tắc nghiệp vụ Mục 3:
  // - Khi lọc "Tất cả thú cưng" (all): tính cả các khoản chi của từng bé và khoản Dùng chung (khoản dùng chung tính 1 lần).
  // - Khi lọc riêng 1 thú cưng: CHỈ tính khoản chi của bé đó (e.petId === selectedPetId). KHÔNG cộng khoản dùng chung vào bé!
  // - Khi lọc riêng "Dùng chung" (shared): chỉ tính các khoản có e.petId === 'shared' hoặc e.petId === 'all'.
  const filteredExpenses = useMemo(() => {
    return (expenses || []).filter(exp => {
      if (!exp) return false;

      // 1. Lọc theo Thú cưng / Dùng chung
      if (selectedPetId === 'shared') {
        const isShared = !exp.petId || exp.petId === 'shared' || exp.petId === 'all';
        if (!isShared) return false;
      } else if (selectedPetId !== 'all') {
        // Lọc riêng một bé cụ thể -> Không nhận khoản dùng chung
        if (exp.petId !== selectedPetId) return false;
      }

      // 2. Lọc theo Thời gian
      const expDate = getVnDateString(exp.date);
      if (isCustomDateRange) {
        if (customStartDate && expDate < customStartDate) return false;
        if (customEndDate && expDate > customEndDate) return false;
      } else if (selectedMonth !== 'all') {
        if (!expDate.startsWith(selectedMonth)) return false;
      }

      // 3. Lọc theo Danh mục
      if (selectedCategory !== 'all') {
        const normCat = normalizeCategoryKey(exp.category);
        if (normCat !== selectedCategory) return false;
      }

      // 4. Lọc theo Từ khóa tìm kiếm
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const titleMatch = (exp.title || '').toLowerCase().includes(term);
        const notesMatch = (exp.notes || '').toLowerCase().includes(term);
        const petMatch = (exp.petName || '').toLowerCase().includes(term);
        if (!titleMatch && !notesMatch && !petMatch) return false;
      }

      return true;
    }).sort((a, b) => {
      // Sắp xếp ngày mới nhất lên đầu
      const dateA = getVnDateString(a.date);
      const dateB = getVnDateString(b.date);
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  }, [expenses, selectedPetId, selectedMonth, selectedCategory, searchTerm, isCustomDateRange, customStartDate, customEndDate]);

  // Tổng tiền trong phạm vi lọc
  const totalSpent = useMemo(() => {
    return filteredExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [filteredExpenses]);

  // --------------------------------------------------------------------------
  // 4. LOGIC NGÂN SÁCH ĐỘC LẬP & SO SÁNH VỚI CHI THỰC TẾ
  // --------------------------------------------------------------------------
  // Quy tắc Mục 6:
  // - Ngân sách gắn với 1 tháng (YYYY-MM) và 1 phạm vi (all | shared | petId).
  // - Xác định kỳ & phạm vi của ngân sách đang xem:
  const activeBudgetMonth = isCustomDateRange 
    ? (customStartDate ? customStartDate.slice(0, 7) : currentMonthStr)
    : (selectedMonth !== 'all' ? selectedMonth : currentMonthStr);

  const activeBudgetScope = selectedPetId; // 'all' | 'shared' | petId

  // Tìm ngân sách tương ứng đã lưu ở backend
  const activeBudget = useMemo(() => {
    return (budgets || []).find(b => 
      b && 
      b.month === activeBudgetMonth && 
      (b.scope || 'all') === activeBudgetScope
    ) || null;
  }, [budgets, activeBudgetMonth, activeBudgetScope]);

  // Chi thực tế của đúng phạm vi & tháng để so sánh ngân sách (không phụ thuộc bộ lọc danh mục!)
  const actualSpentForBudget = useMemo(() => {
    return (expenses || []).reduce((sum, exp) => {
      if (!exp || !exp.date) return sum;
      const expDate = getVnDateString(exp.date);
      if (!expDate.startsWith(activeBudgetMonth)) return sum;

      if (activeBudgetScope === 'shared') {
        const isShared = !exp.petId || exp.petId === 'shared' || exp.petId === 'all';
        if (!isShared) return sum;
      } else if (activeBudgetScope !== 'all') {
        if (exp.petId !== activeBudgetScope) return sum;
      }
      return sum + (Number(exp.amount) || 0);
    }, 0);
  }, [expenses, activeBudgetMonth, activeBudgetScope]);

  // Phân tích chênh lệch ngân sách
  const budgetComparison = useMemo(() => {
    if (!activeBudget || typeof activeBudget.amount !== 'number' || activeBudget.amount <= 0) {
      return null;
    }
    const budgetAmount = activeBudget.amount;
    const diff = budgetAmount - actualSpentForBudget;
    const isOver = diff < 0;
    const overAmount = isOver ? Math.abs(diff) : 0;
    const remainingAmount = !isOver ? diff : 0;
    const percentUsed = Math.min(100, Math.round((actualSpentForBudget / budgetAmount) * 100));

    return {
      budgetAmount,
      actualSpent: actualSpentForBudget,
      isOver,
      overAmount,
      remainingAmount,
      percentUsed
    };
  }, [activeBudget, actualSpentForBudget]);

  // --------------------------------------------------------------------------
  // 5. THỐNG KÊ PHÂN BỔ THEO DANH MỤC (KHI CÓ DỮ LIỆU)
  // --------------------------------------------------------------------------
  const categoryStats = useMemo(() => {
    if (totalSpent <= 0) return [];

    const grouped = {
      food: { amount: 0, count: 0 },
      medical: { amount: 0, count: 0 },
      grooming: { amount: 0, count: 0 },
      supplies: { amount: 0, count: 0 },
      other: { amount: 0, count: 0 }
    };

    filteredExpenses.forEach(exp => {
      const catKey = normalizeCategoryKey(exp.category);
      const amt = Number(exp.amount) || 0;
      if (grouped[catKey]) {
        grouped[catKey].amount += amt;
        grouped[catKey].count += 1;
      } else {
        grouped.other.amount += amt;
        grouped.other.count += 1;
      }
    });

    return Object.entries(grouped)
      .map(([key, data]) => {
        const config = EXPENSE_CATEGORIES[key] || EXPENSE_CATEGORIES.other;
        const percent = totalSpent > 0 ? Math.round((data.amount / totalSpent) * 100) : 0;
        return {
          key,
          label: config.label,
          icon: config.icon,
          color: config.color,
          barColor: config.barColor,
          amount: data.amount,
          count: data.count,
          percent
        };
      })
      .filter(item => item.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses, totalSpent]);

  // --------------------------------------------------------------------------
  // 6. THAO TÁC FORM THÊM / SỬA KHOẢN CHI
  // --------------------------------------------------------------------------
  const handleOpenAddExpense = () => {
    sound?.playClick?.();
    setExpenseToEdit(null);
    setExpenseFormData({
      title: '',
      petId: selectedPetId !== 'all' ? selectedPetId : 'shared',
      category: 'food',
      amount: '',
      date: todayVn,
      notes: ''
    });
    setExpenseFormError('');
    setIsExpenseModalOpen(true);
  };

  const handleOpenEditExpense = (exp) => {
    sound?.playClick?.();
    setExpenseToEdit(exp);
    const isShared = !exp.petId || exp.petId === 'shared' || exp.petId === 'all' || exp.petId === 'none';
    setExpenseFormData({
      title: exp.title || '',
      petId: isShared ? 'shared' : exp.petId,
      category: normalizeCategoryKey(exp.category),
      amount: String(exp.amount || ''),
      date: getVnDateString(exp.date) || todayVn,
      notes: exp.notes || ''
    });
    setExpenseFormError('');
    setIsExpenseModalOpen(true);
  };

  const handleSubmitExpense = async (e) => {
    e.preventDefault();
    if (isSubmittingExpense) return;

    setExpenseFormError('');

    // 1. Validation Tên khoản chi
    const cleanTitle = expenseFormData.title.trim();
    if (!cleanTitle) {
      setExpenseFormError('Tên khoản chi tiêu không được để trống hoặc chỉ chứa khoảng trắng.');
      return;
    }

    // 2. Validation Số tiền: Số nguyên hữu hạn lớn hơn 0
    const rawAmt = Number(expenseFormData.amount);
    if (
      isNaN(rawAmt) ||
      !Number.isFinite(rawAmt) ||
      !Number.isInteger(rawAmt) ||
      rawAmt <= 0 ||
      rawAmt > Number.MAX_SAFE_INTEGER
    ) {
      setExpenseFormError('Số tiền chi tiêu phải là một số nguyên dương lớn hơn 0 (VND, không nhập số âm, 0, số lẻ hoặc chữ).');
      return;
    }

    // 3. Validation Ngày chi thực tế: Không ở tương lai
    const rawDate = expenseFormData.date;
    if (!rawDate) {
      setExpenseFormError('Vui lòng chọn ngày chi tiêu thực tế.');
      return;
    }
    if (rawDate > todayVn) {
      setExpenseFormError(`Ngày chi tiêu (${rawDate}) không được nằm trong tương lai so với ngày hiện tại (${todayVn}) tại Việt Nam.`);
      return;
    }

    // 4. Chuẩn hóa thú cưng & Tên hiển thị
    const isShared = !expenseFormData.petId || expenseFormData.petId === 'shared' || expenseFormData.petId === 'all' || expenseFormData.petId === 'none';
    let assignedPetId = 'shared';
    let assignedPetName = 'Dùng chung';
    if (!isShared) {
      const foundPet = pets.find(p => p.id === expenseFormData.petId);
      assignedPetId = expenseFormData.petId;
      assignedPetName = foundPet ? foundPet.name : 'Thú cưng';
    }

    setIsSubmittingExpense(true);
    try {
      if (expenseToEdit) {
        await onUpdateExpense(expenseToEdit.id, {
          title: cleanTitle,
          amount: rawAmt,
          date: rawDate,
          category: expenseFormData.category,
          petId: assignedPetId,
          petName: assignedPetName,
          notes: expenseFormData.notes.trim()
        });
      } else {
        await onAddExpense({
          title: cleanTitle,
          amount: rawAmt,
          date: rawDate,
          category: expenseFormData.category,
          petId: assignedPetId,
          petName: assignedPetName,
          notes: expenseFormData.notes.trim()
        });
      }
      sound?.playSuccess?.();
      setIsExpenseModalOpen(false);
      onReloadData();
    } catch (err) {
      setExpenseFormError(err.message || 'Lỗi lưu khoản chi tiêu. Dữ liệu đã được giữ nguyên để bạn chỉnh sửa.');
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  // --------------------------------------------------------------------------
  // 7. THAO TÁC FORM THIẾT LẬP / SỬA NGÂN SÁCH
  // --------------------------------------------------------------------------
  const handleOpenBudgetModal = (budget = null) => {
    sound?.playClick?.();
    setBudgetToEdit(budget || activeBudget);
    setBudgetFormData({
      month: activeBudgetMonth,
      scope: activeBudgetScope,
      amount: (budget || activeBudget)?.amount ? String((budget || activeBudget).amount) : ''
    });
    setBudgetFormError('');
    setIsBudgetModalOpen(true);
  };

  const handleSubmitBudget = async (e) => {
    e.preventDefault();
    if (isSubmittingBudget) return;

    setBudgetFormError('');

    // Validation Số tiền ngân sách
    const rawAmt = Number(budgetFormData.amount);
    if (
      isNaN(rawAmt) ||
      !Number.isFinite(rawAmt) ||
      !Number.isInteger(rawAmt) ||
      rawAmt <= 0 ||
      rawAmt > Number.MAX_SAFE_INTEGER
    ) {
      setBudgetFormError('Số tiền ngân sách phải là một số nguyên dương lớn hơn 0 VND.');
      return;
    }

    setIsSubmittingBudget(true);
    try {
      if (budgetToEdit) {
        await onUpdateBudget(budgetToEdit.id, {
          amount: rawAmt
        });
      } else {
        await onAddBudget({
          month: budgetFormData.month,
          scope: budgetFormData.scope,
          amount: rawAmt
        });
      }
      sound?.playSuccess?.();
      setIsBudgetModalOpen(false);
      onReloadData();
    } catch (err) {
      setBudgetFormError(err.message || 'Lỗi lưu ngân sách.');
    } finally {
      setIsSubmittingBudget(false);
    }
  };

  // --------------------------------------------------------------------------
  // 8. XÓA BẢN GHI CÓ XÁC NHẬN
  // --------------------------------------------------------------------------
  const handleConfirmDeleteExpense = async () => {
    if (!expenseToDelete) return;
    setIsDeleting(true);
    try {
      await onDeleteExpense(expenseToDelete.id);
      sound?.playTrash?.();
      setExpenseToDelete(null);
      onReloadData();
    } catch (err) {
      alert(err.message || 'Lỗi khi xóa khoản chi tiêu.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmDeleteBudget = async () => {
    if (!budgetToDelete) return;
    setIsDeleting(true);
    try {
      await onDeleteBudget(budgetToDelete.id);
      sound?.playTrash?.();
      setBudgetToDelete(null);
      setIsBudgetModalOpen(false);
      onReloadData();
    } catch (err) {
      alert(err.message || 'Lỗi khi xóa ngân sách.');
    } finally {
      setIsDeleting(false);
    }
  };

  // --------------------------------------------------------------------------
  // 9. XUẤT CSV AN TOÀN CHỐNG CSV INJECTION
  // --------------------------------------------------------------------------
  const handleExportCsv = () => {
    sound?.playPop?.();
    if (filteredExpenses.length === 0) {
      alert('Không có dữ liệu chi tiêu nào trong phạm vi bộ lọc hiện tại để xuất CSV.');
      return;
    }

    try {
      const headers = ['Mã khoản chi', 'Tên khoản chi', 'Thú cưng', 'Danh mục', 'Số tiền (VND)', 'Ngày chi', 'Ghi chú'];
      const rows = filteredExpenses.map(exp => {
        const catConfig = EXPENSE_CATEGORIES[normalizeCategoryKey(exp.category)] || EXPENSE_CATEGORIES.other;
        const petLabel = (!exp.petId || exp.petId === 'shared' || exp.petId === 'all') 
          ? 'Dùng chung cả nhà' 
          : (exp.petName || 'Thú cưng');

        return [
          sanitizeCsvCell(exp.id),
          sanitizeCsvCell(exp.title),
          sanitizeCsvCell(petLabel),
          sanitizeCsvCell(catConfig.label),
          sanitizeCsvCell(exp.amount),
          sanitizeCsvCell(exp.date),
          sanitizeCsvCell(exp.notes || '')
        ].join(',');
      });

      // Dòng tổng cộng
      const summaryRow = [
        sanitizeCsvCell('TỔNG CỘNG'),
        sanitizeCsvCell(`${filteredExpenses.length} khoản chi`),
        sanitizeCsvCell(''),
        sanitizeCsvCell(''),
        sanitizeCsvCell(totalSpent),
        sanitizeCsvCell(''),
        sanitizeCsvCell('')
      ].join(',');

      const csvContent = '\uFEFF' + [headers.join(','), ...rows, summaryRow].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `chi-tieu-thu-cung-${todayVn}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Lỗi khi xuất tệp CSV:', err);
      alert('Lỗi xuất file CSV: ' + err.message);
    }
  };

  // Reset toàn bộ bộ lọc
  const handleResetFilters = () => {
    sound?.playClick?.();
    setSelectedPetId('all');
    setSelectedMonth(currentMonthStr);
    setSelectedCategory('all');
    setSearchTerm('');
    setIsCustomDateRange(false);
    setCustomStartDate('');
    setCustomEndDate('');
  };

  // Label kỳ đang xem
  const periodLabel = useMemo(() => {
    if (isCustomDateRange) {
      if (customStartDate && customEndDate) return `Từ ${customStartDate} đến ${customEndDate}`;
      if (customStartDate) return `Từ ${customStartDate}`;
      if (customEndDate) return `Đến ${customEndDate}`;
      return 'Tùy chọn khoảng ngày';
    }
    if (selectedMonth === 'all') return 'Tất cả các kỳ';
    const [y, m] = selectedMonth.split('-');
    return `Tháng ${m}/${y}`;
  }, [isCustomDateRange, customStartDate, customEndDate, selectedMonth]);

  return (
    <PageContainer id="expense-page">
      
      {/* ==================================================================== */}
      {/* 1. TIÊU ĐỀ & NÚT CHÍNH "THÊM KHOẢN CHI"                             */}
      {/* ==================================================================== */}
      <PageHeader
        title="Chi tiêu thú cưng"
        subtitle="Theo dõi chi phí thực tế và quản lý ngân sách nuôi thú cưng chặt chẽ, minh bạch"
        actions={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer border border-slate-200 dark:border-white/10 shadow-sm"
              title="Xuất file CSV danh sách chi tiêu theo bộ lọc hiện tại"
            >
              <Download className="w-4 h-4" />
              <span>Xuất CSV</span>
            </button>
            <button
              type="button"
              onClick={handleOpenAddExpense}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm khoản chi</span>
            </button>
          </div>
        }
      />

      {/* ==================================================================== */}
      {/* 2. THANH BỘ LỌC TẬP TRUNG                                            */}
      {/* ==================================================================== */}
      <div className="bg-white dark:bg-[#12192A] rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-white/10 shadow-sm space-y-4">
        
        {/* Hàng 1: Bộ chọn Thú cưng / Dùng chung */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <PawPrint className="w-3.5 h-3.5" /> Thú cưng:
          </span>

          <button
            type="button"
            onClick={() => {
              sound?.playClick?.();
              setSelectedPetId('all');
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
              selectedPetId === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-white/[0.1]'
            }`}
          >
            <span>Tất cả</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sound?.playClick?.();
              setSelectedPetId('shared');
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer border ${
              selectedPetId === 'shared'
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 ring-2 ring-indigo-400/30'
                : 'border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] text-slate-700 dark:text-slate-300 hover:border-slate-300'
            }`}
          >
            <span>Dùng chung cả nhà</span>
          </button>

          {pets.map((p) => {
            if (!p) return null;
            const isSelected = selectedPetId === p.id;
            return (
              <button
                type="button"
                key={p.id}
                onClick={() => {
                  sound?.playClick?.();
                  setSelectedPetId(p.id);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer border ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 ring-2 ring-indigo-400/30'
                    : 'border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] text-slate-700 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                <span>{p.name}</span>
              </button>
            );
          })}
        </div>

        {/* Hàng 2: Bộ lọc kỳ chi tiêu, danh mục, tìm kiếm và nút reset */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-white/5">
          
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Chọn kỳ tháng/năm */}
            {!isCustomDateRange ? (
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-xs"
              >
                <option value="all">Tất cả các tháng</option>
                {availableMonths.map(m => {
                  const [y, mon] = m.split('-');
                  return (
                    <option key={m} value={m}>Tháng {mon}/{y}</option>
                  );
                })}
              </select>
            ) : (
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Từ ngày"
                />
                <span className="text-xs text-slate-400">-</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Đến ngày"
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsCustomDateRange(!isCustomDateRange)}
              className="text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5"
            >
              {isCustomDateRange ? 'Chọn theo tháng' : 'Tùy chọn ngày'}
            </button>

            {/* Dropdown danh mục */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-xs"
            >
              <option value="all">Tất cả danh mục</option>
              {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>

            {/* Tìm kiếm tên khoản chi */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm tên khoản chi..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 w-36 sm:w-48 shadow-xs"
              />
            </div>

            {/* Nút Xóa bộ lọc */}
            {(selectedPetId !== 'all' || selectedMonth !== currentMonthStr || selectedCategory !== 'all' || searchTerm.trim() || isCustomDateRange) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-rose-600 transition-colors cursor-pointer underline ml-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Xóa bộ lọc</span>
              </button>
            )}

          </div>

        </div>

        {/* Dòng ghi chú quy tắc tính khoản chi dùng chung (Mục 3) */}
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 text-[11px] text-slate-500 dark:text-slate-400">
          <Info className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span>
            <strong>Quy tắc chi tiêu:</strong> Khoản chi <em>Dùng chung</em> chỉ được tính 1 lần trong Tổng toàn bộ, không tự chia đều hay cộng dồn vào tổng riêng của từng thú cưng khi lọc riêng từng bé.
          </span>
        </div>

      </div>

      {/* ==================================================================== */}
      {/* 3. BỐN THẺ TÓM TẮT (METRIC CARDS) - CÙNG KÍCH THƯỚC TRANG KHÁC       */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <StatCard
          label="Tổng chi trong kỳ"
          value={formatVND(totalSpent)}
          subtext={periodLabel}
          icon={DollarSign}
          color="indigo"
        />
        <StatCard
          label="Số khoản chi"
          value={filteredExpenses.length}
          subtext={selectedPetId === 'all' ? 'Tất cả thú cưng' : selectedPetId === 'shared' ? 'Dùng chung' : `Bé ${pets.find(p => p.id === selectedPetId)?.name || ''}`}
          icon={Receipt}
          color="purple"
        />
        <StatCard
          label="Ngân sách kỳ này"
          value={activeBudget ? formatVND(activeBudget.amount) : 'Chưa đặt'}
          subtext={activeBudget ? `Áp dụng: ${activeBudgetScope === 'all' ? 'Toàn bộ' : activeBudgetScope === 'shared' ? 'Dùng chung' : 'Riêng bé'}` : 'Đặt hạn mức nuôi'}
          icon={PiggyBank}
          color="emerald"
        />
        <StatCard
          label="Tình trạng ngân sách"
          value={budgetComparison ? (budgetComparison.isOver ? `Vượt ${formatVND(budgetComparison.overAmount)}` : `Còn ${formatVND(budgetComparison.remainingAmount)}`) : 'Chưa thiết lập'}
          subtext={budgetComparison ? `Đã dùng ${budgetComparison.percentUsed}%` : 'Theo dõi chi phí'}
          icon={budgetComparison?.isOver ? TrendingUp : TrendingDown}
          color={budgetComparison ? (budgetComparison.isOver ? 'rose' : 'emerald') : 'slate'}
        />
      </div>

      {/* ==================================================================== */}
      {/* 4. DESKTOP: BIỂU ĐỒ 2/3 & NGÂN SÁCH 1/3                              */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Cột trái: 2/3 Biểu đồ phân bổ theo danh mục */}
        <div className="lg:col-span-2">
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#12192A] border border-slate-200 dark:border-white/10 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Phân bổ chi tiêu theo danh mục
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tỷ lệ chi tiêu thực tế trong kỳ ({periodLabel})
                </p>
              </div>
              {totalSpent > 0 && (
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Tổng: {formatVND(totalSpent)}
                </span>
              )}
            </div>

            {totalSpent <= 0 ? (
              <div className="py-4 px-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-dashed border-slate-200 dark:border-white/10 text-center text-slate-400 dark:text-slate-500 text-xs">
                Chưa có khoản chi nào trong kỳ lọc để hiển thị biểu đồ phân bổ.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Thanh phân bổ đa đoạn */}
                <div className="w-full h-3.5 bg-slate-100 dark:bg-white/[0.06] rounded-full overflow-hidden flex">
                  {categoryStats.map(stat => (
                    <div
                      key={stat.key}
                      style={{ width: `${stat.percent}%`, backgroundColor: stat.barColor }}
                      className="h-full transition-all duration-300 first:rounded-l-full last:rounded-r-full"
                      title={`${stat.label}: ${stat.percent}% (${formatVND(stat.amount)})`}
                    />
                  ))}
                </div>

                {/* Danh mục thống kê */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
                  {categoryStats.map(stat => (
                    <div 
                      key={stat.key}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-1"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: stat.barColor }} />
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {stat.label}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">
                        {formatVND(stat.amount)}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center justify-between">
                        <span>{stat.percent}%</span>
                        <span>{stat.count} khoản</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Cột phải: 1/3 Kế hoạch & tình trạng ngân sách */}
        <div className="lg:col-span-1">
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#12192A] border border-slate-200 dark:border-white/10 shadow-sm space-y-4 flex flex-col justify-between h-full">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Kế hoạch ngân sách
                </h3>
                {activeBudget ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenBudgetModal(activeBudget)}
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Sửa
                    </button>
                    <span className="text-slate-300 dark:text-slate-600">•</span>
                    <button
                      type="button"
                      onClick={() => setBudgetToDelete(activeBudget)}
                      className="text-xs font-semibold text-rose-500 hover:underline cursor-pointer"
                    >
                      Xóa
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleOpenBudgetModal()}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Thiết lập
                  </button>
                )}
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Hạn mức kỳ {activeBudgetMonth}</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {activeBudget ? formatVND(activeBudget.amount) : 'Chưa đặt'}
                  </span>
                </div>

                {budgetComparison && (
                  <div className="space-y-1.5 pt-1">
                    <div className="w-full bg-slate-200 dark:bg-white/[0.08] rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          budgetComparison.isOver ? 'bg-rose-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${budgetComparison.percentUsed}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span>Đã chi: {formatVND(budgetComparison.actualSpent)}</span>
                      <span className={budgetComparison.isOver ? 'text-rose-500 font-bold' : 'text-emerald-600 font-bold'}>
                        {budgetComparison.percentUsed}%
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
                Áp dụng cho: <strong>{activeBudgetScope === 'all' ? 'Tất cả thú cưng' : activeBudgetScope === 'shared' ? 'Dùng chung cả nhà' : `Bé ${pets.find(p => p.id === activeBudgetScope)?.name || ''}`}</strong>.
              </p>
            </div>

            {!activeBudget && (
              <button
                type="button"
                onClick={() => handleOpenBudgetModal()}
                className="w-full py-2.5 px-4 rounded-xl border border-dashed border-indigo-300 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-xs font-semibold transition-colors cursor-pointer text-center"
              >
                + Đặt ngân sách chi tiêu tháng này
              </button>
            )}
          </div>
        </div>

      </div>

      {/* ==================================================================== */}
      {/* 5. DANH SÁCH CÁC KHOẢN CHI TIÊU & THAO TÁC SỬA / XÓA                */}
      {/* ==================================================================== */}
      <div className="bg-white dark:bg-[#0B0F19]/90 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-4">
        
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              Danh sách chi phí ghi nhận
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Hiển thị {filteredExpenses.length} trên tổng số {expenses.length} khoản chi
            </p>
          </div>

          <button
            type="button"
            onClick={onReloadData}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-emerald-600 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Làm mới</span>
          </button>
        </div>

        {/* Bảng danh sách hoặc trạng thái rỗng */}
        {expenses.length === 0 ? (
          <div className="py-12 text-center text-slate-400 dark:text-slate-500 space-y-3">
            <PiggyBank className="w-12 h-12 mx-auto opacity-30" />
            <div className="max-w-md mx-auto space-y-1">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Bạn chưa có khoản chi tiêu nào
              </h4>
              <p className="text-xs">
                Hãy bắt đầu quản lý tài chính nuôi thú cưng bằng cách thêm khoản chi đầu tiên.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenAddExpense}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm khoản chi ngay</span>
            </button>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="py-12 text-center text-slate-400 dark:text-slate-500 space-y-2">
            <Search className="w-10 h-10 mx-auto opacity-30" />
            <p className="text-xs font-medium">
              Không tìm thấy khoản chi nào phù hợp với bộ lọc hiện tại.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs font-bold text-emerald-600 hover:underline cursor-pointer"
            >
              Đặt lại toàn bộ bộ lọc
            </button>
          </div>
        ) : (
          <div className="border border-slate-200/80 dark:border-white/[0.08] rounded-2xl overflow-hidden overflow-x-auto">
            <table className="w-full text-xs text-left divide-y divide-slate-100 dark:divide-white/[0.06]">
              <thead className="bg-slate-50 dark:bg-white/[0.03] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Tên khoản chi</th>
                  <th className="py-3 px-4">Thú cưng</th>
                  <th className="py-3 px-4">Danh mục</th>
                  <th className="py-3 px-4">Ngày chi</th>
                  <th className="py-3 px-4 text-right">Số tiền (VND)</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04] bg-white dark:bg-[#0B0F19]/50">
                {filteredExpenses.map((exp) => {
                  const catConfig = EXPENSE_CATEGORIES[normalizeCategoryKey(exp.category)] || EXPENSE_CATEGORIES.other;
                  const isShared = !exp.petId || exp.petId === 'shared' || exp.petId === 'all';
                  const displayPetName = isShared ? 'Dùng chung' : (exp.petName || 'Thú cưng');

                  return (
                    <tr 
                      key={exp.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors group"
                    >
                      <td className="py-3 px-4">
                        <div className="font-extrabold text-slate-900 dark:text-white">
                          {exp.title}
                        </div>
                        {exp.notes && (
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 italic line-clamp-1 mt-0.5">
                            "{exp.notes}"
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold ${
                          isShared 
                            ? 'bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300' 
                            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                        }`}>
                          <PawPrint className="w-3 h-3 text-slate-400" />
                          <span>{displayPetName}</span>
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${catConfig.color}`}>
                          {catConfig.label}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap font-medium">
                        {exp.date}
                      </td>

                      <td className="py-3 px-4 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm whitespace-nowrap">
                        {formatVND(exp.amount)}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditExpense(exp)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                            title="Chỉnh sửa khoản chi"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setExpenseToDelete(exp)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Xóa khoản chi này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* ==================================================================== */}
      {/* 6. MODAL THÊM / SỬA KHOẢN CHI                                       */}
      {/* ==================================================================== */}
      <Modal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        title={expenseToEdit ? 'Chỉnh sửa khoản chi' : 'Thêm khoản chi mới'}
        size="md"
      >
        {isExpenseModalOpen && (
          <div className="space-y-4">
            {expenseFormError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300 font-semibold flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{expenseFormError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitExpense} className="space-y-3.5 text-xs">
              
              {/* Tên khoản chi */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tên khoản chi *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Mua bao hạt Royal Canin 2kg, Tiêm phòng vắc-xin..."
                  value={expenseFormData.title}
                  onChange={(e) => setExpenseFormData({ ...expenseFormData, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                />
              </div>

              {/* Thú cưng */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Áp dụng cho thú cưng:
                </label>
                <select
                  value={expenseFormData.petId}
                  onChange={(e) => setExpenseFormData({ ...expenseFormData, petId: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white font-medium cursor-pointer"
                >
                  <option value="shared">Dùng chung cho cả nhà</option>
                  {pets.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.breed || 'Thú cưng'})</option>
                  ))}
                </select>
              </div>

              {/* Danh mục */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Danh mục chi tiêu:
                </label>
                <select
                  value={expenseFormData.category}
                  onChange={(e) => setExpenseFormData({ ...expenseFormData, category: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white font-medium cursor-pointer"
                >
                  {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>

              {/* Số tiền & Ngày chi */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Số tiền (VND) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="1"
                    placeholder="Ví dụ: 150000"
                    value={expenseFormData.amount}
                    onChange={(e) => setExpenseFormData({ ...expenseFormData, amount: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white font-bold"
                  />
                  {expenseFormData.amount && Number(expenseFormData.amount) > 0 && (
                    <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                      {formatVND(expenseFormData.amount)}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Ngày chi thực tế *
                  </label>
                  <input
                    type="date"
                    required
                    max={todayVn}
                    value={expenseFormData.date}
                    onChange={(e) => setExpenseFormData({ ...expenseFormData, date: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white font-medium"
                  />
                </div>
              </div>

              {/* Ghi chú */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ghi chú thêm (tùy chọn):
                </label>
                <textarea
                  rows={2}
                  placeholder="Nơi mua, đợt khuyến mãi, liều lượng..."
                  value={expenseFormData.notes}
                  onChange={(e) => setExpenseFormData({ ...expenseFormData, notes: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white resize-none"
                />
              </div>

              {/* Nút hành động */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  disabled={isSubmittingExpense}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingExpense}
                  className={`px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all ${
                    isSubmittingExpense ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                >
                  {isSubmittingExpense ? 'Đang lưu...' : (expenseToEdit ? 'Lưu thay đổi' : 'Lưu khoản chi')}
                </button>
              </div>

            </form>
          </div>
        )}
      </Modal>

      {/* ==================================================================== */}
      {/* 7. MODAL THIẾT LẬP / SỬA NGÂN SÁCH                                  */}
      {/* ==================================================================== */}
      <Modal
        isOpen={isBudgetModalOpen}
        onClose={() => setIsBudgetModalOpen(false)}
        title={budgetToEdit ? 'Chỉnh sửa ngân sách' : 'Thiết lập ngân sách chi tiêu'}
        size="md"
      >
        {isBudgetModalOpen && (
          <div className="space-y-4">
            {budgetFormError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300 font-semibold flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{budgetFormError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitBudget} className="space-y-3.5 text-xs">
              
              {/* Tháng áp dụng */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tháng áp dụng:
                </label>
                <input
                  type="month"
                  required
                  disabled={Boolean(budgetToEdit)}
                  value={budgetFormData.month}
                  onChange={(e) => setBudgetFormData({ ...budgetFormData, month: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white font-medium disabled:opacity-60"
                />
              </div>

              {/* Phạm vi áp dụng */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Phạm vi giới hạn:
                </label>
                <select
                  disabled={Boolean(budgetToEdit)}
                  value={budgetFormData.scope}
                  onChange={(e) => setBudgetFormData({ ...budgetFormData, scope: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white font-medium disabled:opacity-60 cursor-pointer"
                >
                  <option value="all">Tất cả thú cưng (Tổng hạn mức cả nhà)</option>
                  <option value="shared">Chỉ các khoản chi dùng chung</option>
                  {pets.map(p => (
                    <option key={p.id} value={p.id}>Chỉ riêng bé {p.name}</option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  * Ngân sách toàn bộ và ngân sách từng bé là các giới hạn độc lập, không cộng dồn nhau.
                </p>
              </div>

              {/* Số tiền ngân sách VND */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Hạn mức ngân sách (VND) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="1"
                  placeholder="Ví dụ: 2000000"
                  value={budgetFormData.amount}
                  onChange={(e) => setBudgetFormData({ ...budgetFormData, amount: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white font-bold"
                />
                {budgetFormData.amount && Number(budgetFormData.amount) > 0 && (
                  <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                    {formatVND(budgetFormData.amount)}
                  </div>
                )}
              </div>

              {/* Nút hành động */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-white/5">
                {budgetToEdit ? (
                  <button
                    type="button"
                    onClick={() => {
                      setBudgetToDelete(budgetToEdit);
                      setIsBudgetModalOpen(false);
                    }}
                    className="text-xs font-semibold text-rose-500 hover:underline cursor-pointer"
                  >
                    Xóa ngân sách
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsBudgetModalOpen(false)}
                    disabled={isSubmittingBudget}
                    className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingBudget}
                    className={`px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all ${
                      isSubmittingBudget ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    {isSubmittingBudget ? 'Đang lưu...' : 'Lưu ngân sách'}
                  </button>
                </div>
              </div>

            </form>
          </div>
        )}
      </Modal>

      {/* ==================================================================== */}
      {/* 8. HỘP THOẠI XÁC NHẬN XÓA KHOẢN CHI                                 */}
      {/* ==================================================================== */}
      <Modal
        isOpen={Boolean(expenseToDelete)}
        onClose={() => setExpenseToDelete(null)}
        title="Xóa khoản chi tiêu"
        size="sm"
      >
        {expenseToDelete && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Bạn có chắc chắn muốn xóa khoản chi <strong>"{expenseToDelete.title}"</strong> ({formatVND(expenseToDelete.amount)}) ngày <strong>{expenseToDelete.date}</strong>?
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-white/5">
              <button
                type="button"
                onClick={() => setExpenseToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteExpense}
                disabled={isDeleting}
                className={`px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition-all ${
                  isDeleting ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                {isDeleting ? 'Đang xóa...' : 'Xóa khoản chi'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ==================================================================== */}
      {/* 9. HỘP THOẠI XÁC NHẬN XÓA NGÂN SÁCH                                */}
      {/* ==================================================================== */}
      <Modal
        isOpen={Boolean(budgetToDelete)}
        onClose={() => setBudgetToDelete(null)}
        title="Xóa thiết lập ngân sách"
        size="sm"
      >
        {budgetToDelete && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Bạn có chắc chắn muốn xóa ngân sách <strong>{formatVND(budgetToDelete.amount)}</strong> của tháng <strong>{budgetToDelete.month}</strong>? Sau khi xóa, trạng thái sẽ trở về "Chưa thiết lập".
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-white/5">
              <button
                type="button"
                onClick={() => setBudgetToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteBudget}
                disabled={isDeleting}
                className={`px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition-all ${
                  isDeleting ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                {isDeleting ? 'Đang xóa...' : 'Xóa ngân sách'}
              </button>
            </div>
          </div>
        )}
      </Modal>

    </PageContainer>
  );
};

export const ExpenseTrackerView = ExpenseView;
export default ExpenseView;
