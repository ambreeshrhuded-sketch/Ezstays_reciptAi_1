import React, { useState, useMemo } from 'react';
import {
  ReceiptRecord,
  REQUIRED_EXCEL_COLUMNS,
  ExtractionStatus,
  FieldKey,
} from '../types/receipt';
import {
  Search,
  Filter,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Eye,
  Trash2,
  ArrowUpDown,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CheckSquare,
} from 'lucide-react';
import { exportRecordsToExcel } from '../utils/excelExporter';

interface AllRecordsTableProps {
  records: ReceiptRecord[];
  onOpenReview: (recordId: string) => void;
  onDeleteRecord: (recordId: string) => void;
  onBulkApprove: (recordIds: string[]) => void;
  onBulkDelete: (recordIds: string[]) => void;
}

export const AllRecordsTable: React.FC<AllRecordsTableProps> = ({
  records,
  onOpenReview,
  onDeleteRecord,
  onBulkApprove,
  onBulkDelete,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [confidenceFilter, setConfidenceFilter] = useState<string>('all');
  const [hostelFilter, setHostelFilter] = useState<string>('all');
  const [paymentModeFilter, setPaymentModeFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<FieldKey | 'confidence' | 'date'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Extract unique hostels and payment modes for filter dropdowns
  const uniqueHostels = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.data.hostel_name) set.add(r.data.hostel_name);
    });
    return Array.from(set);
  }, [records]);

  const uniquePaymentModes = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.data.mode_of_receipt) set.add(r.data.mode_of_receipt);
    });
    return Array.from(set);
  }, [records]);

  // Filter and Sort Logic
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Search
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const d = r.data;
        const matches =
          (d.student_name && d.student_name.toLowerCase().includes(q)) ||
          (d.student_id && d.student_id.toLowerCase().includes(q)) ||
          (d.receipt_no && d.receipt_no.toLowerCase().includes(q)) ||
          (d.student_phone_no && d.student_phone_no.toLowerCase().includes(q)) ||
          (d.payment_ref_no && d.payment_ref_no.toLowerCase().includes(q)) ||
          (d.hostel_name && d.hostel_name.toLowerCase().includes(q)) ||
          (d.college && d.college.toLowerCase().includes(q)) ||
          r.fileName.toLowerCase().includes(q);

        if (!matches) return false;
      }

      // Status
      if (statusFilter !== 'all') {
        if (statusFilter === 'duplicate' && !r.isDuplicate) return false;
        if (statusFilter !== 'duplicate' && r.status !== statusFilter) return false;
      }

      // Confidence
      if (confidenceFilter === 'high' && r.overallConfidence < 0.85) return false;
      if (confidenceFilter === 'medium' && (r.overallConfidence < 0.6 || r.overallConfidence >= 0.85)) return false;
      if (confidenceFilter === 'low' && r.overallConfidence >= 0.6) return false;

      // Hostel
      if (hostelFilter !== 'all' && r.data.hostel_name !== hostelFilter) return false;

      // Payment Mode
      if (paymentModeFilter !== 'all' && r.data.mode_of_receipt !== paymentModeFilter) return false;

      return true;
    }).sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      if (sortField === 'confidence') {
        valA = a.overallConfidence;
        valB = b.overallConfidence;
      } else if (sortField === 'date') {
        valA = new Date(a.uploadedAt).getTime();
        valB = new Date(b.uploadedAt).getTime();
      } else {
        valA = (a.data as any)[sortField] ?? '';
        valB = (b.data as any)[sortField] ?? '';
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [records, searchQuery, statusFilter, confidenceFilter, hostelFilter, paymentModeFilter, sortField, sortOrder]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(paginatedRecords.map((r) => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleBulkApproveClick = () => {
    if (selectedIds.length === 0) return;
    onBulkApprove(selectedIds);
    setSelectedIds([]);
  };

  const handleBulkDeleteClick = () => {
    if (selectedIds.length === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedIds.length} records?`)) {
      onBulkDelete(selectedIds);
      setSelectedIds([]);
    }
  };

  const handleExportSelected = () => {
    const toExport = records.filter((r) => selectedIds.includes(r.id));
    if (toExport.length === 0) return;
    exportRecordsToExcel(toExport, { fileName: `Hostel_Receipts_Selected_${selectedIds.length}.xlsx` });
  };

  const toggleSort = (field: FieldKey | 'confidence' | 'date') => {
    if (sortField === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with Title & Quick Export */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Master Dataset</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            Hostel Fee Receipts Master Spreadsheet ({records.length})
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Horizontally scrollable full 33-column tabular dataset. Inspect, edit, bulk approve, and export directly.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          {selectedIds.length > 0 && (
            <>
              <button
                onClick={handleBulkApproveClick}
                className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Approve ({selectedIds.length})</span>
              </button>
              <button
                onClick={handleExportSelected}
                className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-200 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Selected</span>
              </button>
              <button
                onClick={handleBulkDeleteClick}
                className="p-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold transition"
                title="Delete Selected"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}

          <button
            onClick={() => exportRecordsToExcel(filteredRecords)}
            disabled={filteredRecords.length === 0}
            className="flex items-center space-x-2 px-4 py-2 bg-[#0F172A] hover:bg-slate-800 text-slate-100 text-xs font-bold rounded-xl border border-slate-800 shadow-sm transition disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Export Table ({filteredRecords.length})</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Search input */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Student, Receipt #, Phone, ID, UTR..."
              className="w-full text-xs pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-hidden transition"
            />
          </div>

          {/* Status filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition"
            >
              <option value="all">All Statuses</option>
              <option value="needs_review">Needs Review</option>
              <option value="approved">Approved</option>
              <option value="duplicate">Possible Duplicates</option>
              <option value="rejected">Rejected</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {/* Confidence filter */}
          <div>
            <select
              value={confidenceFilter}
              onChange={(e) => setConfidenceFilter(e.target.value)}
              className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition"
            >
              <option value="all">All Confidence Scores</option>
              <option value="high">High Confidence (≥85%)</option>
              <option value="medium">Medium Confidence (60-84%)</option>
              <option value="low">Low Confidence (&lt;60%)</option>
            </select>
          </div>

          {/* Hostel filter */}
          <div>
            <select
              value={hostelFilter}
              onChange={(e) => setHostelFilter(e.target.value)}
              className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition truncate"
            >
              <option value="all">All Hostels</option>
              {uniqueHostels.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Spreadsheet Data Table Container */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
        <div className="overflow-x-auto max-w-full">
          <table className="w-full text-left text-xs border-collapse divide-y divide-slate-200 whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-700 sticky top-0 z-20">
              <tr>
                {/* Select checkbox */}
                <th className="p-3.5 w-10 text-center sticky left-0 z-30 bg-slate-50 border-r border-slate-200">
                  <input
                    type="checkbox"
                    checked={paginatedRecords.length > 0 && selectedIds.length === paginatedRecords.length}
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>

                {/* Fixed Action & Status Columns */}
                <th className="p-3.5 font-bold text-slate-800 sticky left-10 z-30 bg-slate-50 border-r border-slate-200 shadow-xs">
                  Actions & Status
                </th>

                <th
                  onClick={() => toggleSort('confidence')}
                  className="p-3.5 font-bold text-slate-800 cursor-pointer hover:bg-slate-100"
                >
                  <div className="flex items-center space-x-1">
                    <span>AI Conf</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                {/* 33 Required Columns strictly rendered in exact order */}
                {REQUIRED_EXCEL_COLUMNS.map((col, index) => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className="p-3.5 font-bold text-slate-800 cursor-pointer hover:bg-slate-100"
                    title={`Column ${index + 1}: ${col.label}`}
                  >
                    <div className="flex items-center space-x-1">
                      <span className="text-[10px] text-indigo-500 font-mono">#{index + 1}</span>
                      <span>{col.label}</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-slate-700">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={REQUIRED_EXCEL_COLUMNS.length + 3} className="p-12 text-center text-slate-400">
                    No receipt records found matching your filters.
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((r) => {
                  const isSelected = selectedIds.includes(r.id);

                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-slate-50/80 transition ${
                        isSelected ? 'bg-indigo-50/40' : ''
                      }`}
                    >
                      {/* Checkbox column */}
                      <td className="p-3 text-center sticky left-0 z-10 bg-white border-r border-slate-200">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectOne(r.id)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>

                      {/* Action & Status sticky column */}
                      <td className="p-3 sticky left-10 z-10 bg-white border-r border-slate-200 shadow-xs">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => onOpenReview(r.id)}
                            className="px-3 py-1 text-[11px] font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg transition flex items-center space-x-1"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Review</span>
                          </button>

                          <button
                            onClick={async () => {
                              if (deletingId || !confirm(`Permanently delete receipt for ${r.data.student_name || r.fileName}?`)) return;
                              setDeletingId(r.id);
                              try {
                                await onDeleteRecord(r.id);
                              } finally {
                                setDeletingId(null);
                              }
                            }}
                            disabled={deletingId === r.id}
                            title="Delete receipt permanently"
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition disabled:opacity-40"
                          >
                            <Trash2 className={`w-3.5 h-3.5 ${deletingId === r.id ? 'animate-spin text-rose-500' : ''}`} />
                          </button>

                          {r.status === 'approved' && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              Approved
                            </span>
                          )}
                          {r.status === 'needs_review' && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                              Review
                            </span>
                          )}
                          {r.status === 'rejected' && (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                              Rejected
                            </span>
                          )}
                          {r.status === 'processing' && (
                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                              Extracting
                            </span>
                          )}
                          {r.isDuplicate && (
                            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              DUP
                            </span>
                          )}
                        </div>
                      </td>

                      {/* AI Confidence badge */}
                      <td className="p-3 font-semibold">
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full font-bold border ${
                            r.overallConfidence >= 0.85
                              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                              : r.overallConfidence >= 0.6
                              ? 'text-amber-700 bg-amber-50 border-amber-200'
                              : 'text-rose-700 bg-rose-50 border-rose-200'
                          }`}
                        >
                          {Math.round(r.overallConfidence * 100)}%
                        </span>
                      </td>

                      {/* 33 Columns strictly rendered */}
                      {REQUIRED_EXCEL_COLUMNS.map((col) => {
                        const val = (r.data as any)[col.key];
                        const isScoreLow = (r.fieldConfidences?.[col.key] ?? 1.0) < 0.85 && val !== '' && val !== null;

                        return (
                          <td
                            key={col.key}
                            className={`p-3 max-w-xs truncate ${
                              isScoreLow ? 'bg-amber-50/60 font-semibold text-amber-900 border-b border-amber-100' : ''
                            }`}
                            title={String(val || '')}
                          >
                            {val === null || val === undefined || val === '' ? (
                              <span className="text-slate-300 font-mono">-</span>
                            ) : col.type === 'number' ? (
                              <span className="font-mono">
                                {col.key === 'total_fees' || col.key === 'amount_received' || col.key === 'discount' || col.key === 'cumulative_fee'
                                  ? `₹${Number(val).toLocaleString('en-IN')}`
                                  : Number(val)}
                              </span>
                            ) : (
                              <span>{String(val)}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing <span className="font-semibold text-slate-700">{(currentPage - 1) * pageSize + 1}</span> to{' '}
            <span className="font-semibold text-slate-700">{Math.min(currentPage * pageSize, filteredRecords.length)}</span> of{' '}
            <span className="font-semibold text-slate-700">{filteredRecords.length}</span> records
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-medium hover:bg-slate-50 shadow-xs disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-2 font-bold text-slate-800">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-medium hover:bg-slate-50 shadow-xs disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
