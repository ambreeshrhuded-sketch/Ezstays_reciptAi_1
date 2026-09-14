import React, { useState } from 'react';
import { ReceiptRecord, REQUIRED_EXCEL_COLUMNS } from '../types/receipt';
import {
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  FileText,
  CheckSquare,
  ShieldCheck,
  ExternalLink,
  Database,
  Layers,
} from 'lucide-react';
import { exportRecordsToExcel, exportRecordsToCSV, EXCEL_RECEIPT_LINK_COL } from '../utils/excelExporter';

interface ExportViewProps {
  records: ReceiptRecord[];
}

export const ExportView: React.FC<ExportViewProps> = ({ records }) => {
  const [exportScope, setExportScope] = useState<'approved' | 'all' | 'needs_review' | 'failed'>('approved');
  const [includeAuditCols, setIncludeAuditCols] = useState(false);
  const [includeReconCols, setIncludeReconCols] = useState(true);
  const [customFileName, setCustomFileName] = useState(
    `Hostel_Receipts_Master_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);

  const approvedCount = records.filter((r) => r.status === 'approved').length;
  const needsReviewCount = records.filter((r) => r.status === 'needs_review').length;
  const failedCount = records.filter((r) => r.status === 'failed').length;
  const totalCount = records.length;

  const getTargetRecords = () => {
    if (exportScope === 'approved') {
      return records.filter((r) => r.status === 'approved');
    }
    if (exportScope === 'needs_review') {
      return records.filter((r) => r.status === 'needs_review');
    }
    if (exportScope === 'failed') {
      return records.filter((r) => r.status === 'failed');
    }
    return records;
  };

  const targetRecords = getTargetRecords();

  const handleExportXLSX = async () => {
    try {
      setIsExporting(true);
      const res = await exportRecordsToExcel(targetRecords, {
        fileName: customFileName,
        includeAuditMetadata: includeAuditCols,
        includeReconciliationData: includeReconCols,
        filterStatus: exportScope,
        fetchFreshFromFirestore: true,
      });
      setExportSuccessMessage(`Successfully exported ${res.count} records from Cloud Firestore to ${res.fileName}`);
      setTimeout(() => setExportSuccessMessage(null), 5000);
    } catch (err: any) {
      alert(err?.message || 'Failed to export Excel file');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = () => {
    try {
      exportRecordsToCSV(targetRecords, {
        fileName: customFileName.replace('.xlsx', '.csv'),
        filterStatus: exportScope,
      });
    } catch (err: any) {
      alert(err?.message || 'Failed to export CSV file');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Standardized Delivery & Persistence</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            33-Column Excel Export with Clickable Receipt Links
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Export verified receipt records directly from Cloud Firestore into Microsoft Excel (.xlsx) with column #34 hyperlink (<span className="font-semibold text-indigo-600">"View Receipt"</span>) pointing to the original document.
          </p>
        </div>
      </div>

      {exportSuccessMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center space-x-3 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-bold">{exportSuccessMessage}</span>
        </div>
      )}

      {/* Export Options Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Configuration Card (1 col) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Export Parameters</h2>
            <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-bold">
              <Database className="w-3 h-3" /> Firestore Source
            </span>
          </div>

          {/* Scope Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider text-[10px]">
              Select Record Scope
            </label>
            <div className="space-y-2.5">
              <label className="flex items-center space-x-2.5 text-xs text-slate-700 cursor-pointer p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white transition">
                <input
                  type="radio"
                  name="scope"
                  checked={exportScope === 'approved'}
                  onChange={() => setExportScope('approved')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-semibold text-emerald-800">Only Approved Receipts ({approvedCount})</span>
              </label>

              <label className="flex items-center space-x-2.5 text-xs text-slate-700 cursor-pointer p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white transition">
                <input
                  type="radio"
                  name="scope"
                  checked={exportScope === 'all'}
                  onChange={() => setExportScope('all')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span>All Receipts in Database ({totalCount})</span>
              </label>

              <label className="flex items-center space-x-2.5 text-xs text-slate-700 cursor-pointer p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white transition">
                <input
                  type="radio"
                  name="scope"
                  checked={exportScope === 'needs_review'}
                  onChange={() => setExportScope('needs_review')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span>Unreviewed / Needs Review ({needsReviewCount})</span>
              </label>

              <label className="flex items-center space-x-2.5 text-xs text-slate-700 cursor-pointer p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white transition">
                <input
                  type="radio"
                  name="scope"
                  checked={exportScope === 'failed'}
                  onChange={() => setExportScope('failed')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span>Failed Extraction ({failedCount})</span>
              </label>
            </div>
          </div>

          {/* Output File Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider text-[10px]">
              Export File Name
            </label>
            <input
              type="text"
              value={customFileName}
              onChange={(e) => setCustomFileName(e.target.value)}
              className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
            />
          </div>

          {/* Reconciliation Audit Toggle */}
          <div className="pt-1">
            <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includeReconCols}
                onChange={(e) => setIncludeReconCols(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-semibold text-slate-800">Include Bank Reconciliation & Knocking Audit (UTR, Status, Source)</span>
            </label>
          </div>

          {/* Audit Toggle */}
          <div className="pt-1">
            <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includeAuditCols}
                onChange={(e) => setIncludeAuditCols(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-medium text-slate-600">Append Technical Metadata (Reviewer, Model, Cloud Path)</span>
            </label>
          </div>

          {/* Export Actions */}
          <div className="pt-4 border-t border-slate-100 space-y-2.5">
            <button
              onClick={handleExportXLSX}
              disabled={targetRecords.length === 0 || isExporting}
              className="w-full flex items-center justify-center space-x-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-200 transition disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{isExporting ? 'Querying Firestore...' : `Download Excel (.xlsx) - ${targetRecords.length} Rows`}</span>
            </button>

            <button
              onClick={handleExportCSV}
              disabled={targetRecords.length === 0}
              className="w-full flex items-center justify-center space-x-2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs transition disabled:opacity-50"
            >
              <FileText className="w-4 h-4" />
              <span>Download CSV</span>
            </button>
          </div>
        </div>

        {/* Column Reference & Link Guarantee Card (2 cols) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Official Schema (33 Business Columns + Clickable Link)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Exact column index mapping required for administrative finance audits.
              </p>
            </div>
            <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 font-mono text-[10px] font-bold rounded-lg">
              34 Total Columns
            </span>
          </div>

          {/* Cloud Storage & Link Info Banner */}
          <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-800 flex items-start space-x-2.5">
            <ExternalLink className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Column 34: Clickable "Receipt Link" Hyperlink</span>
              <span className="text-[11px] text-sky-700">
                Every exported row embeds a direct, clickable Excel hyperlink with display text <span className="font-semibold text-sky-900">"View Receipt"</span> referencing the original uploaded document in Firebase Storage.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {REQUIRED_EXCEL_COLUMNS.map((col, idx) => (
              <div
                key={col.key}
                className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between"
              >
                <span className="font-semibold text-slate-700 truncate mr-1">
                  <span className="text-slate-400 font-mono text-[10px] mr-1">{idx + 1}.</span>
                  {col.label}
                </span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                    col.type === 'number'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {col.type}
                </span>
              </div>
            ))}
            
            {/* 34th Column Highlighted */}
            <div className="p-2.5 bg-indigo-50 rounded-xl border border-indigo-200 flex items-center justify-between col-span-2 sm:col-span-3">
              <span className="font-bold text-indigo-900 flex items-center gap-1.5">
                <span className="text-indigo-400 font-mono text-[10px]">34.</span>
                Receipt Link (Hyperlink to Original File)
              </span>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded font-bold bg-indigo-200 text-indigo-800">
                hyperlink ("View Receipt")
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
