import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  FileText,
  Image,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Landmark,
  Layers,
  ArrowRight,
} from 'lucide-react';
import {
  BankStatementRecord,
  BankTransactionRecord,
  PaymentSource,
} from '../../types/reconciliation';
import { parseSpreadsheetStatement } from '../../utils/bankStatementParser';
import { uploadBankStatementFile } from '../../firebase/reconciliationStore';

interface BankStatementUploadTabProps {
  userEmail: string;
  onConfirmImport: (statement: BankStatementRecord, transactions: BankTransactionRecord[]) => Promise<void>;
  onCancelPreview?: () => void;
  onLoadSampleStatement?: () => void;
}

const SUPPORTED_EXTENSIONS = ['.xlsx', '.xls', '.csv', '.pdf', '.jpg', '.jpeg', '.png'];

export const BankStatementUploadTab: React.FC<BankStatementUploadTabProps> = ({
  userEmail,
  onConfirmImport,
  onLoadSampleStatement,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Preview state before saving
  const [previewStatement, setPreviewStatement] = useState<BankStatementRecord | null>(null);
  const [previewTransactions, setPreviewTransactions] = useState<BankTransactionRecord[]>([]);
  const [previewSampleRows, setPreviewSampleRows] = useState<BankTransactionRecord[]>([]);
  const [selectedSource, setSelectedSource] = useState<PaymentSource>('PhonePe');
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setSelectedFile(file);
    setParseError(null);
    setIsParsing(true);

    const statementId = `stmt_${Date.now()}`;
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    try {
      if (['.xlsx', '.xls', '.csv'].includes(ext)) {
        // Structured spreadsheet parsing (SheetJS)
        const parseResult = await parseSpreadsheetStatement(file, statementId, userEmail);
        if (!parseResult.transactions || parseResult.transactions.length === 0) {
          throw new Error(
            'No transaction table could be detected in this spreadsheet. Please check column mapping.'
          );
        }
        const fullStatement: BankStatementRecord = {
          ...parseResult.statementSummary,
          id: statementId,
          payment_source: parseResult.statementSummary.payment_source,
        };
        setSelectedSource(fullStatement.payment_source as PaymentSource);
        setPreviewStatement(fullStatement);
        setPreviewTransactions(parseResult.transactions);
        setPreviewSampleRows(parseResult.sampleRows);
      } else if (['.pdf', '.jpg', '.jpeg', '.png'].includes(ext)) {
        // PDF or Image parsing using Server AI Extraction
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
        });
        reader.readAsDataURL(file);
        const base64Data = await base64Promise;

        const res = await fetch('/api/extract-bank-statement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base64Data,
            fileName: file.name,
            mimeType: file.type,
            userEmail,
            fileId: statementId,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Server returned HTTP ${res.status}`);
        }

        const data = await res.json();
        if (!data.transactions || data.transactions.length === 0) {
          throw new Error(
            'No transaction table could be detected in this statement file. Please check column mapping.'
          );
        }
        const fullStatement: BankStatementRecord = {
          ...data.statementSummary,
          id: statementId,
        };
        setSelectedSource(fullStatement.payment_source as PaymentSource);
        setPreviewStatement(fullStatement);
        setPreviewTransactions(data.transactions || []);
        setPreviewSampleRows(data.sampleRows || (data.transactions || []).slice(0, 5));
      } else {
        throw new Error(`Unsupported file type (${ext}). Please upload an XLSX, XLS, CSV, PDF, or image file.`);
      }
    } catch (err: any) {
      console.error('Error parsing bank statement:', err);
      setParseError(err?.message || 'Failed to parse bank statement file.');
      setPreviewStatement(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleConfirm = async () => {
    if (!previewStatement || !selectedFile) return;
    setIsSaving(true);
    try {
      // 1. Upload original file to Firebase Storage
      let storagePath = '';
      let fileUrl = '';
      try {
        const uploadRes = await uploadBankStatementFile(selectedFile, previewStatement.id, selectedFile.name);
        storagePath = uploadRes.storagePath;
        fileUrl = uploadRes.fileUrl;
      } catch (err) {
        console.warn('Storage upload note:', err);
      }

      // Update with final source selection and storage paths
      const finalStatement: BankStatementRecord = {
        ...previewStatement,
        payment_source: selectedSource,
        storage_path: storagePath,
        file_url: fileUrl,
        import_status: 'imported',
      };

      const finalTransactions = previewTransactions.map((tx) => ({
        ...tx,
        payment_source: selectedSource,
      }));

      await onConfirmImport(finalStatement, finalTransactions);

      // Reset
      setSelectedFile(null);
      setPreviewStatement(null);
      setPreviewTransactions([]);
      setPreviewSampleRows([]);
    } catch (err: any) {
      setParseError(err?.message || 'Failed to save imported bank statement.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setPreviewStatement(null);
    setPreviewTransactions([]);
    setPreviewSampleRows([]);
    setParseError(null);
  };

  return (
    <div className="space-y-6">
      {/* Informational Header */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Upload Bank Statement</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Import official settlement reports, UPI Merchant logs (PhonePe, GPay), or netbanking statements (Axis, IDFC, Canara, HDFC).
            Spreadsheets are parsed locally without modifying the original file; PDFs and images use secure server-side OCR.
          </p>
        </div>
        {onLoadSampleStatement && !previewStatement && (
          <button
            onClick={onLoadSampleStatement}
            className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg border border-indigo-200 transition shrink-0 self-start sm:self-auto flex items-center space-x-1.5"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Load PhonePe Jul 2026 Sample</span>
          </button>
        )}
      </div>

      {/* Upload Zone (when no preview active) */}
      {!previewStatement && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50/40 scale-[0.99]'
              : 'border-slate-300 bg-white hover:border-indigo-400 hover:bg-slate-50/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFile(e.target.files[0]);
              }
            }}
          />

          <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 shadow-sm">
            {isParsing ? (
              <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
            ) : (
              <UploadCloud className="w-7 h-7" />
            )}
          </div>

          <h3 className="text-sm font-bold text-slate-800">
            {isParsing ? 'Parsing Statement Structure...' : 'Choose or Drag & Drop Bank Statement'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Supports XLSX, XLS, CSV (Direct Structured Parse), and PDF, JPG, PNG (AI Tabular Extraction).
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-400">
            <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200">PhonePe / GPay</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200">Axis / IDFC / Canara</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200">HDFC / ICICI / SBI</span>
          </div>
        </div>
      )}

      {/* Parse Error Notification */}
      {parseError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{parseError}</span>
          </div>
          <button onClick={() => setParseError(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* PREVIEW SCREEN (Section 2 Requirement: Before saving, show preview screen) */}
      {previewStatement && previewTransactions.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                Step 2: Statement Import Preview
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                File: {previewStatement.file_name}
              </h3>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isSaving || previewTransactions.length === 0}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center space-x-1.5 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving to Database...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Import ({previewTransactions.length} Transactions)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 block text-[10px]">Detected Transactions</span>
                <span className="text-lg font-bold text-slate-800">
                  {previewStatement.total_transactions.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-emerald-600 block text-[10px] font-semibold">Credit Transactions</span>
                <span className="text-lg font-bold text-emerald-700">
                  {previewStatement.credit_count.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-emerald-600 block mt-0.5">
                  ₹{previewStatement.total_credit_amount.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200">
                <span className="text-rose-600 block text-[10px] font-semibold">Debit Transactions</span>
                <span className="text-lg font-bold text-rose-700">
                  {previewStatement.debit_count.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-rose-600 block mt-0.5">
                  ₹{previewStatement.total_debit_amount.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200">
                <span className="text-indigo-600 block text-[10px] font-semibold">Detected Date Range</span>
                <span className="text-xs font-mono font-bold text-indigo-900 block mt-1">
                  {previewStatement.date_range_start || 'N/A'} → {previewStatement.date_range_end || 'N/A'}
                </span>
              </div>
            </div>

            {/* Source Confirmation */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-2">
                <Landmark className="w-4 h-4 text-slate-600" />
                <span className="font-semibold text-slate-800">Confirm Payment Source / Bank:</span>
              </div>
              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value as PaymentSource)}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="PhonePe">PhonePe (UPI Merchant)</option>
                <option value="GPay">GPay (Google Pay)</option>
                <option value="Axis Bank">Axis Bank</option>
                <option value="IDFC Bank">IDFC Bank</option>
                <option value="Canara Bank">Canara Bank</option>
                <option value="HDFC Bank">HDFC Bank</option>
                <option value="ICICI Bank">ICICI Bank</option>
                <option value="State Bank of India">State Bank of India</option>
                <option value="Kotak Bank">Kotak Bank</option>
                <option value="Other">Other Bank / Source</option>
              </select>
            </div>

            {/* Sample Rows Table Preview */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Sample Extracted Rows (First {previewSampleRows.length} of {previewTransactions.length})
              </h4>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Method/Source</th>
                      <th className="py-2.5 px-3">Narration</th>
                      <th className="py-2.5 px-3">Amount</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">UTR / Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewSampleRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        <td className="py-2 px-3 font-mono text-slate-600">{row.bank_date}</td>
                        <td className="py-2 px-3 font-medium text-slate-700">
                          {row.payment_source} • {row.transaction_method}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-600 max-w-xs truncate" title={row.bank_narration}>
                          {row.bank_narration}
                        </td>
                        <td className="py-2 px-3 font-bold font-mono text-slate-900">
                          ₹{row.bank_amount.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              row.transaction_type === 'credit'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {row.transaction_type}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono text-indigo-700 font-semibold">
                          {row.utr || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px]">
              <strong>Important Rule:</strong> Clicking &quot;Confirm Import&quot; will commit these {previewTransactions.length} records into the bank transaction pool. Automated and manual knocking can then be performed against student receipt claims.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
