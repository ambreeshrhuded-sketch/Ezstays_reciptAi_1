import React from 'react';
import {
  ReceiptRecord,
  BatchInfo,
  REQUIRED_EXCEL_COLUMNS,
} from '../types/receipt';
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Copy,
  TrendingUp,
  CreditCard,
  Percent,
  UploadCloud,
  FileSpreadsheet,
  ArrowRight,
  ShieldCheck,
  Building2,
  Landmark,
  Sparkles,
} from 'lucide-react';
import { ActiveTab } from './Navbar';

export interface DashboardReconciliationSummary {
  statementsCount: number;
  transactionsCount: number;
  knockedCount: number;
  totalPayments: number;
}

interface DashboardViewProps {
  records: ReceiptRecord[];
  batches: BatchInfo[];
  setActiveTab: (tab: ActiveTab) => void;
  onOpenReview: (recordId: string) => void;
  onExportApproved: () => void;
  reconciliationSummary?: DashboardReconciliationSummary;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  records,
  batches,
  setActiveTab,
  onOpenReview,
  onExportApproved,
  reconciliationSummary,
}) => {
  const totalCount = records.length;
  const processedCount = records.filter(
    (r) => r.status !== 'pending' && r.status !== 'processing'
  ).length;
  const pendingCount = records.filter((r) => r.status === 'processing' || r.status === 'pending').length;
  const needsReviewCount = records.filter((r) => r.status === 'needs_review').length;
  const approvedCount = records.filter((r) => r.status === 'approved').length;
  const rejectedCount = records.filter((r) => r.status === 'rejected').length;
  const failedCount = records.filter((r) => r.status === 'failed').length;
  const duplicateCount = records.filter((r) => r.isDuplicate).length;

  // Financial totals
  const totalFees = records.reduce((acc, r) => acc + (r.data.total_fees || 0), 0);
  const totalAmountReceived = records.reduce((acc, r) => acc + (r.data.amount_received || 0), 0);
  const totalDiscount = records.reduce((acc, r) => acc + (r.data.discount || 0), 0);

  // Review & Correction metrics
  const reviewedRecords = records.filter((r) => r.isReviewed);
  const correctedRecords = reviewedRecords.filter((r) => r.correctionsCount > 0);
  const autoAcceptRate = reviewedRecords.length > 0
    ? Math.round(((reviewedRecords.length - correctedRecords.length) / reviewedRecords.length) * 100)
    : 0;

  // Group by Hostel
  const hostelBreakdown: Record<string, { count: number; totalReceived: number }> = {};
  records.forEach((r) => {
    const h = r.data.hostel_name || 'Unassigned / Not Found';
    if (!hostelBreakdown[h]) {
      hostelBreakdown[h] = { count: 0, totalReceived: 0 };
    }
    hostelBreakdown[h].count += 1;
    hostelBreakdown[h].totalReceived += r.data.amount_received || 0;
  });

  const topHostels = Object.entries(hostelBreakdown).sort((a, b) => b[1].totalReceived - a[1].totalReceived).slice(0, 5);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 text-white flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">Automated Pipeline</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Hostel Receipt AI Processing</h1>
          <p className="text-slate-400 text-sm mt-1 max-w-2xl">
            High-precision OCR extraction with per-field confidence scoring, side-by-side verification, and standardized 33-column Excel export.
          </p>
        </div>
        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={() => setActiveTab('upload')}
            className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-semibold shadow-sm shadow-indigo-500/30 transition-all"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Batch</span>
          </button>
          <button
            onClick={onExportApproved}
            disabled={approvedCount === 0}
            className="flex items-center space-x-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-semibold transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Export ({approvedCount})</span>
          </button>
        </div>
      </div>

      {/* 5-Step End-to-End Workflow Pipeline Tracker */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">End-to-End Financial Pipeline Workflow</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              5-stage automated pipeline from physical receipt image to verified bank statement knocking and Excel delivery.
            </p>
          </div>
          <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg self-start sm:self-auto">
            Current Stage: {pendingCount > 0 ? '2: OCR Processing' : needsReviewCount > 0 ? '3: Human Verification' : (reconciliationSummary?.transactionsCount || 0) === 0 ? '4: Bank Statement Import' : (reconciliationSummary?.knockedCount || 0) < Math.max(1, totalCount) ? '4: Payment Knocking' : '5: Ready for Export'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Step 1: Upload Receipts */}
          <div
            onClick={() => setActiveTab('upload')}
            className="group relative p-3.5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20 transition-all cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Step 1</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  totalCount > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                }`}>
                  {totalCount > 0 ? `${totalCount} Ingested` : 'Get Started'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <div className="font-bold text-xs text-slate-900 group-hover:text-indigo-600 transition">
                  Ingest Receipts
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-2">
                Upload image slips, camera captures, or batch multi-page PDFs.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-indigo-600">
              <span>Go to Upload</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* Step 2: AI Processing Queue */}
          <div
            onClick={() => setActiveTab('processing')}
            className="group relative p-3.5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20 transition-all cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Step 2</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  pendingCount > 0 ? 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}>
                  {pendingCount > 0 ? `${pendingCount} Queued` : `${processedCount} Extracted`}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="font-bold text-xs text-slate-900 group-hover:text-indigo-600 transition">
                  AI OCR Queue
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-2">
                Serialized queue with per-field confidence scoring and extraction.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-indigo-600">
              <span>View Queue</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* Step 3: Human Verification */}
          <div
            onClick={() => setActiveTab('review')}
            className="group relative p-3.5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20 transition-all cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Step 3</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  needsReviewCount > 0 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}>
                  {needsReviewCount > 0 ? `${needsReviewCount} Needs Review` : 'Verified'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="font-bold text-xs text-slate-900 group-hover:text-indigo-600 transition">
                  Review & Verify
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-2">
                Side-by-side slip image audit, split transactions, and duplicate checks.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-indigo-600">
              <span>Audit Slips</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* Step 4: Bank Statement & Knocking */}
          <div
            onClick={() => setActiveTab('reconciliation')}
            className="group relative p-3.5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20 transition-all cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Step 4</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  (reconciliationSummary?.knockedCount || 0) > 0
                    ? 'bg-purple-50 text-purple-700 border border-purple-200'
                    : (reconciliationSummary?.transactionsCount || 0) > 0
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {(reconciliationSummary?.knockedCount || 0) > 0
                    ? `${reconciliationSummary?.knockedCount} Knocked`
                    : (reconciliationSummary?.transactionsCount || 0) > 0
                    ? `${reconciliationSummary?.transactionsCount} Bank Txns`
                    : 'Import Excel'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold shrink-0">
                  <Landmark className="w-4 h-4" />
                </div>
                <div className="font-bold text-xs text-slate-900 group-hover:text-indigo-600 transition">
                  Bank Knocking
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-2">
                PhonePe & bank statement importer; 7-step automated matching rule engine.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-indigo-600">
              <span>Open Knocking</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* Step 5: 33-Column Reconciled Excel Export */}
          <div
            onClick={() => setActiveTab('export')}
            className="group relative p-3.5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20 transition-all cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Step 5</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {approvedCount} Ready
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div className="font-bold text-xs text-slate-900 group-hover:text-indigo-600 transition">
                  Reconciled Export
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-2">
                Official 33-column spreadsheet with receipt links and reconciliation status.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-indigo-600">
              <span>Export Delivery</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold mt-2 text-slate-900">{totalCount}</div>
          <div className="text-[10px] text-slate-400 mt-1">Receipts in system</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-indigo-500">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Processed</span>
            <CheckCircle2 className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold mt-2 text-indigo-600">{processedCount}</div>
          <div className="text-[10px] text-slate-400 mt-1">Extraction done</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-amber-500">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Review</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold mt-2 text-amber-600">{needsReviewCount}</div>
          <div className="text-[10px] text-amber-600 font-medium mt-1">Requires check</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-emerald-500">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Approved</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold mt-2 text-emerald-600">{approvedCount}</div>
          <div className="text-[10px] text-emerald-600 font-medium mt-1">Ready for Excel</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-rose-500">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Duplicates</span>
            <Copy className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold mt-2 text-rose-600">{duplicateCount}</div>
          <div className="text-[10px] text-slate-400 mt-1">Flagged entries</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Pending</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold mt-2 text-slate-700">{pendingCount}</div>
          <div className="text-[10px] text-slate-400 mt-1">In parsing queue</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Rejected</span>
            <XCircle className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold mt-2 text-slate-700">{rejectedCount}</div>
          <div className="text-[10px] text-slate-400 mt-1">Marked invalid</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Failed</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold mt-2 text-slate-700">{failedCount}</div>
          <div className="text-[10px] text-slate-400 mt-1">Unreadable slip</div>
        </div>
      </div>

      {/* Financial Overview & Accuracy */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Financial Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
              <CreditCard className="w-4 h-4 text-indigo-600" />
              <span>Financial Aggregates</span>
            </h2>
            <span className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-600 font-bold rounded uppercase">
              Live Audited
            </span>
          </div>
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-500">Total Fees Invoiced</span>
              <span className="text-sm font-bold text-slate-900">{formatCurrency(totalFees)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-500">Total Amount Received</span>
              <span className="text-sm font-bold text-emerald-600">
                {formatCurrency(totalAmountReceived)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-500">Total Discounts</span>
              <span className="text-sm font-bold text-amber-600">{formatCurrency(totalDiscount)}</span>
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-semibold text-slate-500">Collection Realization</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {totalFees > 0 ? `${Math.min(Math.round((totalAmountReceived / totalFees) * 100), 100)}%` : '100%'}
              </span>
            </div>
          </div>
        </div>

        {/* Human Review & Quality Assurance */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Review & Quality Assurance</span>
            </h2>
            <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-600 font-bold rounded uppercase">
              OCR Engine
            </span>
          </div>
          <div className="mt-5 space-y-4">
            <div>
              <div className="flex justify-between text-xs text-slate-600 mb-1.5">
                <span className="font-medium">Audited by Staff</span>
                <span className="font-bold text-slate-900">
                  {reviewedRecords.length} / {totalCount} ({totalCount > 0 ? Math.round((reviewedRecords.length / totalCount) * 100) : 0}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all"
                  style={{ width: `${totalCount > 0 ? (reviewedRecords.length / totalCount) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Flawless Extraction</div>
                <div className="text-lg font-black text-slate-900 mt-1">
                  {reviewedRecords.length - correctedRecords.length}
                </div>
                <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">{autoAcceptRate}% auto-accepted</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Human Adjustments</div>
                <div className="text-lg font-black text-slate-900 mt-1">
                  {correctedRecords.length}
                </div>
                <div className="text-[10px] text-amber-600 font-semibold mt-0.5">Fields refined</div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Hostel Collections */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <span>Hostel Distribution</span>
            </h2>
            <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 font-bold rounded uppercase">
              Top Hostels
            </span>
          </div>
          <div className="mt-4 divide-y divide-slate-100 max-h-48 overflow-y-auto">
            {topHostels.length === 0 ? (
              <div className="text-xs text-slate-400 py-6 text-center">No receipts uploaded yet</div>
            ) : (
              topHostels.map(([hName, stats]) => (
                <div key={hName} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="truncate max-w-[170px]">
                    <div className="font-semibold text-slate-800 truncate">{hName}</div>
                    <div className="text-[10px] text-slate-400">{stats.count} receipts collected</div>
                  </div>
                  <div className="font-bold text-slate-900 shrink-0">
                    {formatCurrency(stats.totalReceived)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Action Center & Needs Review Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Needs Review List */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-800">
                Pending Human Review ({needsReviewCount})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Receipts with low confidence scores, potential duplicates, or validation warnings.
              </p>
            </div>
            {needsReviewCount > 0 && (
              <button
                onClick={() => setActiveTab('review')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center space-x-1"
              >
                <span>Open Full Reviewer</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {needsReviewCount === 0 ? (
            <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <div className="text-sm font-bold text-slate-800">
                All Receipts Reviewed & In Order!
              </div>
              <div className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No items currently require manual review. You can proceed to export approved receipts into Excel.
              </div>
              <button
                onClick={onExportApproved}
                disabled={approvedCount === 0}
                className="mt-4 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200 disabled:opacity-50 transition"
              >
                Export Excel ({approvedCount} Approved)
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {records
                .filter((r) => r.status === 'needs_review')
                .slice(0, 5)
                .map((r) => (
                  <div key={r.id} className="py-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-slate-900">
                          {r.data.student_name || 'Name Missing'}
                        </span>
                        {r.data.receipt_no && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                            #{r.data.receipt_no}
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            r.overallConfidence >= 0.85
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : r.overallConfidence >= 0.60
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}
                        >
                          {Math.round(r.overallConfidence * 100)}% Conf
                        </span>
                        {r.isDuplicate && (
                          <span className="text-[10px] bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-bold">
                            DUPLICATE
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center space-x-3">
                        <span>{r.data.hostel_name || 'No Hostel'}</span>
                        <span>•</span>
                        <span className="font-semibold text-slate-700">₹{r.data.amount_received || 0}</span>
                        <span>•</span>
                        <span>{r.data.receipt_date || 'No Date'}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => onOpenReview(r.id)}
                      className="shrink-0 px-4 py-2 text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl transition"
                    >
                      Review
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Right 1 Col: Quick Workflow Guides & Batches */}
        <div className="space-y-4">
          <div className="bg-[#0F172A] text-white rounded-2xl p-6 border border-slate-800 shadow-sm">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-2">33-Column Excel Standard</p>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              All extracted receipts strictly map to the required 33 columns in exact order with pure text formatting.
            </p>
            <div className="space-y-2 text-[11px] text-slate-400">
              <div className="flex justify-between">
                <span>1. Hostel Name</span>
                <span className="text-slate-300 font-mono">18. Course</span>
              </div>
              <div className="flex justify-between">
                <span>8. Student ID (Text)</span>
                <span className="text-slate-300 font-mono">21. Total Fees</span>
              </div>
              <div className="flex justify-between">
                <span>9. Receipt No: (Text)</span>
                <span className="text-slate-300 font-mono">23. Amount Received</span>
              </div>
              <div className="flex justify-between">
                <span>11. Student Name</span>
                <span className="text-slate-300 font-mono">28. Receipt Date</span>
              </div>
              <div className="flex justify-between">
                <span>12. Student Phone No:</span>
                <span className="text-slate-300 font-mono">29. Payment Ref No:</span>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('records')}
              className="mt-5 w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 rounded-xl transition"
            >
              View Full Table Grid
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-3">Batches Overview</h3>
            {batches.length === 0 ? (
              <div className="text-xs text-slate-400 py-3">No batches recorded yet. Upload your first batch!</div>
            ) : (
              <div className="space-y-2.5">
                {batches.slice(0, 3).map((b) => (
                  <div key={b.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                    <div className="flex justify-between font-bold text-slate-800">
                      <span>{b.batchNumber}: {b.name}</span>
                      <span className="text-slate-500 font-medium">{b.totalCount} items</span>
                    </div>
                    <div className="flex space-x-2 text-[10px] mt-1.5">
                      <span className="text-emerald-700 font-bold">{b.approvedCount} approved</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-amber-700 font-bold">{b.needsReviewCount} review</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
