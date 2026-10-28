import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  FileText, 
  Plus, 
  Edit3, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  Eye, 
  Save, 
  X, 
  Database, 
  Info,
  Power,
  Layers,
  BookOpen,
  Calendar,
  Check
} from 'lucide-react';
import { sound } from '../../services/soundService';

export const AdminAiDocsView = () => {
  const [collection, setCollection] = useState(null);
  const [docs, setDocs] = useState([]);
  const [sources, setSources] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [formId, setFormId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formSpecies, setFormSpecies] = useState('dog, cat');
  const [formKeywords, setFormKeywords] = useState('');
  const [formSourceIds, setFormSourceIds] = useState('SRC-AAHA-NUTRITION');
  const [formContent, setFormContent] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const fetchDocs = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('petcare_token') || localStorage.getItem('petcare_auth_token');
      const res = await fetch('/api/admin/rag/docs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.collection) {
        setCollection(data.collection);
        setDocs(Array.isArray(data.collection.documents) ? data.collection.documents : []);
        setSources(data.sources || {});
      } else {
        throw new Error(data.error || 'Không thể tải kho tài liệu tri thức RAG');
      }
    } catch (err) {
      console.error('Lỗi tải docs:', err);
      setError(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const handleStartCreate = () => {
    sound?.playClick?.();
    setFormId(`PC-KB-00${docs.length + 1}`);
    setFormTitle('');
    setFormSpecies('dog, cat');
    setFormKeywords('');
    setFormSourceIds('SRC-AAHA-NUTRITION');
    setFormContent('');
    setIsCreating(true);
    setIsEditing(true);
    setSelectedDoc(null);
  };

  const handleStartEdit = (doc) => {
    sound?.playClick?.();
    setFormId(doc.id);
    setFormTitle(doc.title);
    setFormSpecies(Array.isArray(doc.species) ? doc.species.join(', ') : (doc.species || ''));
    setFormKeywords(Array.isArray(doc.keywords) ? doc.keywords.join(', ') : (doc.keywords || ''));
    setFormSourceIds(Array.isArray(doc.sourceIds) ? doc.sourceIds.join(', ') : (doc.sourceIds || ''));
    setFormContent(doc.content);
    setIsCreating(false);
    setIsEditing(true);
    setSelectedDoc(doc);
  };

  const handleToggleDoc = async (docId, currentEnabled) => {
    sound?.playClick?.();
    try {
      const token = localStorage.getItem('petcare_token') || localStorage.getItem('petcare_auth_token');
      const res = await fetch(`/api/admin/rag/docs/${encodeURIComponent(docId)}/toggle`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        sound?.playSuccess?.();
        setStatusMessage({
          type: 'success',
          text: `Đã ${currentEnabled ? 'vô hiệu hóa' : 'kích hoạt'} tài liệu "${docId}". Chỉ mục vector đã được cập nhật.`
        });
        fetchDocs();
      } else {
        throw new Error(data.error || 'Lỗi khi cập nhật trạng thái');
      }
    } catch (err) {
      sound?.playPop?.();
      setStatusMessage({ type: 'error', text: err.message || 'Lỗi cập nhật trạng thái' });
    }
  };

  const handleReindex = async () => {
    if (!window.confirm('Xác nhận quét lại toàn bộ tài liệu hợp lệ và lập lại chỉ mục vector?')) return;
    setReindexing(true);
    setStatusMessage(null);
    try {
      const token = localStorage.getItem('petcare_token') || localStorage.getItem('petcare_auth_token');
      const res = await fetch('/api/admin/rag/reindex', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        sound?.playSuccess?.();
        setStatusMessage({
          type: 'success',
          text: `Tái lập chỉ mục RAG thành công! Đã xử lý ${data.indexedChunks} đoạn tài liệu (${data.documentCount} tài liệu).`
        });
        fetchDocs();
      } else {
        throw new Error(data.error || 'Lỗi khi tái lập chỉ mục');
      }
    } catch (err) {
      sound?.playPop?.();
      setStatusMessage({ type: 'error', text: err.message || 'Lỗi khi tái lập chỉ mục' });
    } finally {
      setReindexing(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formId.trim() || !formTitle.trim() || !formContent.trim()) {
      alert('Vui lòng điền đầy đủ ID, tiêu đề và nội dung tài liệu.');
      return;
    }
    setSaveLoading(true);
    setStatusMessage(null);
    try {
      const token = localStorage.getItem('petcare_token') || localStorage.getItem('petcare_auth_token');
      const payload = {
        id: formId.trim(),
        title: formTitle.trim(),
        species: formSpecies.split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
        keywords: formKeywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean),
        sourceIds: formSourceIds.split(',').map(s => s.trim()).filter(Boolean),
        content: formContent.trim()
      };

      const res = await fetch('/api/admin/rag/docs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        sound?.playSuccess?.();
        setStatusMessage({ type: 'success', text: 'Đã lưu tài liệu và cập nhật chỉ mục RAG thành công.' });
        setIsEditing(false);
        setIsCreating(false);
        fetchDocs();
      } else {
        throw new Error(data.error || 'Lỗi khi lưu tài liệu');
      }
    } catch (err) {
      sound?.playPop?.();
      setStatusMessage({ type: 'error', text: err.message || 'Không thể lưu tài liệu' });
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm(`Xác nhận xóa tài liệu "${docId}"?\nChỉ mục vector sẽ được cập nhật ngay lập tức.`)) {
      return;
    }
    try {
      const token = localStorage.getItem('petcare_token') || localStorage.getItem('petcare_auth_token');
      const res = await fetch(`/api/admin/rag/docs/${encodeURIComponent(docId)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        sound?.playSuccess?.();
        fetchDocs();
        if (selectedDoc?.id === docId) setSelectedDoc(null);
      } else {
        throw new Error(data.error || 'Lỗi khi xóa tài liệu');
      }
    } catch (err) {
      alert(err.message || 'Lỗi khi xóa tài liệu');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-white/10">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <Bot className="w-6 h-6 text-indigo-500" />
            Quản Lý Tri Thức RAG Cục Bộ ({collection?.id || 'petcare-rag-vi-v1'})
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Bộ tài liệu tham khảo chính thức phục vụ đồ án (phiên bản {collection?.version || '1.0.0'}). Lập chỉ mục vector qua Ollama và tra cứu Cosine Similarity.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReindex}
            disabled={reindexing || loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-500/20 transition-all cursor-pointer disabled:opacity-50"
            title="Quét lại toàn bộ tài liệu và lập lại vector embedding"
          >
            <Database className={`w-3.5 h-3.5 ${reindexing ? 'animate-spin' : ''}`} />
            <span>{reindexing ? 'Đang lập chỉ mục…' : 'Lập lại chỉ mục RAG'}</span>
          </button>

          <button
            onClick={() => { sound?.playClick?.(); fetchDocs(); }}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-[#1a1b2e] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-all cursor-pointer shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>

          <button
            onClick={handleStartCreate}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm tài liệu</span>
          </button>
        </div>
      </div>

      {/* Thông tin Metadata Collection bắt buộc theo yêu cầu */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
          <div className="text-[10px] uppercase font-bold text-slate-400">Trạng thái thẩm định</div>
          <div className="text-xs font-bold text-indigo-400 mt-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            {collection?.reviewStatus || 'source_checked_for_course_demo'}
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
          <div className="text-[10px] uppercase font-bold text-slate-400">Ngày kiểm tra nguồn</div>
          <div className="text-xs font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            {collection?.sourceCheckedAt || '2026-10-28'}
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
          <div className="text-[10px] uppercase font-bold text-slate-400">Quy mô kho kiến thức</div>
          <div className="text-xs font-bold text-purple-400 mt-1 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            {docs.length} tài liệu • {docs.filter(d => d.enabled).length} đang kích hoạt
          </div>
        </div>
      </div>

      {/* Dòng ghi chú bắt buộc */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-500/10 border border-amber-200/80 dark:border-amber-500/20 text-xs text-amber-900 dark:text-amber-200">
        <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Ghi chú quan trọng: </span>
          {collection?.disclaimer || 'Tài liệu tham khảo phục vụ đồ án, chưa được bác sĩ thú y thẩm định độc lập.'}
        </div>
      </div>

      {statusMessage && (
        <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30'
            : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/30'
        }`}>
          {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Bố cục 2 cột: Danh sách tài liệu & Khung xem/sửa */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Danh sách 8 tài liệu */}
        <div className="lg:col-span-1 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Danh sách tài liệu ({docs.length})</span>
          </div>

          <div className="space-y-2 max-h-[550px] overflow-y-auto scrollbar-thin">
            {docs.map(doc => {
              const isSelected = selectedDoc?.id === doc.id;
              return (
                <div
                  key={doc.id}
                  onClick={() => { setSelectedDoc(doc); setIsEditing(false); }}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50/80 dark:bg-indigo-500/15 border-indigo-500 shadow-sm'
                      : 'bg-white dark:bg-[#1a1b2e] border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                  } ${!doc.enabled ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-200">
                          {doc.id}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          doc.enabled 
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-slate-500/15 text-slate-400 border border-slate-500/20'
                        }`}>
                          {doc.enabled ? 'Kích hoạt' : 'Đã vô hiệu'}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                        {doc.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        {doc.content}
                      </p>
                    </div>

                    {/* Nút Toggle Bật/Tắt */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleDoc(doc.id, doc.enabled);
                      }}
                      className={`p-1.5 rounded-lg border transition-all cursor-pointer shrink-0 ${
                        doc.enabled
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                          : 'bg-slate-500/10 text-slate-400 border-slate-500/30 hover:bg-slate-500/20'
                      }`}
                      title={doc.enabled ? 'Nhấp để vô hiệu hóa' : 'Nhấp để kích hoạt lại'}
                    >
                      <Power className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Khung Chi tiết hoặc Chỉnh sửa */}
        <div className="lg:col-span-2">
          {isEditing ? (
            <div className="p-5 rounded-2xl bg-white dark:bg-[#1a1b2e] border border-slate-200 dark:border-white/10 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-indigo-500" />
                  <span>{isCreating ? 'Tạo tài liệu tri thức mới' : `Chỉnh sửa: ${formId}`}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-3.5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Mã tài liệu (ID):</label>
                    <input
                      type="text"
                      value={formId}
                      onChange={e => setFormId(e.target.value)}
                      disabled={!isCreating}
                      placeholder="VD: PC-KB-009"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Áp dụng loài (species):</label>
                    <input
                      type="text"
                      value={formSpecies}
                      onChange={e => setFormSpecies(e.target.value)}
                      placeholder="dog, cat"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Tiêu đề tài liệu:</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    placeholder="Nhập tiêu đề..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Từ khóa (phân cách bởi dấu phẩy):</label>
                    <input
                      type="text"
                      value={formKeywords}
                      onChange={e => setFormKeywords(e.target.value)}
                      placeholder="dinh dưỡng, ăn thưởng, ..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Nguồn tham khảo (sourceIds):</label>
                    <input
                      type="text"
                      value={formSourceIds}
                      onChange={e => setFormSourceIds(e.target.value)}
                      placeholder="SRC-AAHA-NUTRITION"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Nội dung tóm tắt kiến thức:</label>
                  <textarea
                    rows={8}
                    value={formContent}
                    onChange={e => setFormContent(e.target.value)}
                    placeholder="Nội dung kiến thức chuẩn y khoa..."
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white leading-relaxed font-sans"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-bold"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={saveLoading}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-500/20 disabled:opacity-50 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>{saveLoading ? 'Đang lưu…' : 'Lưu & Lập lại chỉ mục'}</span>
                  </button>
                </div>
              </form>
            </div>
          ) : selectedDoc ? (
            <div className="p-5 rounded-2xl bg-white dark:bg-[#1a1b2e] border border-slate-200 dark:border-white/10 shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-white/10">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      {selectedDoc.id}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      selectedDoc.enabled 
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' 
                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                    }`}>
                      {selectedDoc.enabled ? 'Đang kích hoạt' : 'Đã vô hiệu hóa'}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {selectedDoc.title}
                  </h3>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(selectedDoc)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold border border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-100 transition-all cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Sửa</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(selectedDoc.id)}
                    className="p-1.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 text-xs font-bold border border-rose-200 dark:border-rose-500/30 transition-all cursor-pointer"
                    title="Xóa tài liệu"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Thông tin metadata */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Loài áp dụng</span>
                  <span className="font-semibold text-slate-200">
                    {Array.isArray(selectedDoc.species) ? selectedDoc.species.join(', ') : selectedDoc.species}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Nguồn tham chiếu</span>
                  <span className="font-semibold text-indigo-400 font-mono">
                    {Array.isArray(selectedDoc.sourceIds) ? selectedDoc.sourceIds.join(', ') : selectedDoc.sourceIds}
                  </span>
                </div>
              </div>

              {/* Nội dung chi tiết */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                {selectedDoc.content}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center rounded-2xl bg-white dark:bg-[#1a1b2e] border border-slate-200 dark:border-white/10 text-slate-400">
              <FileText className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm font-semibold">Chọn một tài liệu bên trái để xem nội dung hoặc chỉnh sửa.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default AdminAiDocsView;
