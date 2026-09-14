import React, { useState, useEffect } from 'react';
import {
  ReceiptRecord,
  ReceiptData,
  FieldKey,
  REQUIRED_EXCEL_COLUMNS,
  AppSettings,
  PaymentTransaction,
} from '../types/receipt';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Save,
  Copy,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Terminal,
  Trash2,
  SkipForward,
  Edit3,
  Check,
  RotateCcw,
  Sliders,
  ExternalLink,
  Plus,
  CreditCard,
  Layers,
} from 'lucide-react';
import { validateReceiptData } from '../utils/validationRules';
import { SAMPLE_RECEIPTS_CATALOG, generateSampleReceiptImage } from '../utils/sampleReceipts';
import {
  installmentToNature,
  formatSplitNature,
  derivePaymentMonth,
} from '../utils/safeUtils';

interface ReviewModalProps {
  record: ReceiptRecord;
  allRecords: ReceiptRecord[];
  settings: AppSettings;
  isOpen: boolean;
  onClose: () => void;
  onSaveRecord: (updatedRecord: ReceiptRecord) => Promise<void> | void;
  onApproveRecord: (recordId: string, updatedData?: ReceiptData) => Promise<void> | void;
  onRejectRecord: (recordId: string, reason?: string) => Promise<void> | void;
  onReprocessRecord: (record: ReceiptRecord) => Promise<void>;
  onDeleteRecord?: (recordId: string) => Promise<void> | void;
  onNavigateRecord: (nextRecordId: string) => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  record,
  allRecords,
  settings,
  isOpen,
  onClose,
  onSaveRecord,
  onApproveRecord,
  onRejectRecord,
  onReprocessRecord,
  onDeleteRecord,
  onNavigateRecord,
}) => {
  if (!isOpen || !record) return null;

  const [formData, setFormData] = useState<ReceiptData>({ ...record.data });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'all' | 'student' | 'hostel' | 'financial' | 'payment' | 'debug'>('all');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [minimalTestResult, setMinimalTestResult] = useState<any>(null);
  const [isTestingMinimal, setIsTestingMinimal] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Rejection Dialog State
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('Illegible / blurry receipt handwriting');
  const [isRejecting, setIsRejecting] = useState(false);

  // Delete Confirmation State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Helper to initialize payment transactions list
  const getInitialTransactions = (rec: ReceiptRecord, currentFormData?: ReceiptData): PaymentTransaction[] => {
    if (Array.isArray(rec.payment_transactions) && rec.payment_transactions.length > 0) {
      return rec.payment_transactions;
    }
    if (Array.isArray(rec.data?.payment_transactions) && rec.data.payment_transactions.length > 0) {
      return rec.data.payment_transactions;
    }
    const natureVal = currentFormData?.nature || rec.data?.nature || 'First';
    const cleanNature = installmentToNature(natureVal) || 'First';
    const amountVal = currentFormData?.amount_received ?? rec.data?.amount_received ?? null;
    const modeVal = currentFormData?.mode_of_receipt || rec.data?.mode_of_receipt || 'UPI';
    const refVal = currentFormData?.payment_ref_no || rec.data?.payment_ref_no || '';
    const dateVal = currentFormData?.payment_date || rec.data?.payment_date || currentFormData?.receipt_date || rec.data?.receipt_date || '';
    return [
      {
        transaction_index: 0,
        nature: cleanNature,
        amount: amountVal,
        payment_mode: modeVal,
        payment_ref_no: refVal,
        payment_date: dateVal,
        payment_month: currentFormData?.payment_month || rec.data?.payment_month || derivePaymentMonth(dateVal),
        fees_channel: currentFormData?.fees_channel || rec.data?.fees_channel || '',
        remark: currentFormData?.remark || rec.data?.remark || '',
      },
    ];
  };

  const [paymentTransactions, setPaymentTransactions] = useState<PaymentTransaction[]>(() =>
    getInitialTransactions(record, record.data)
  );

  // Sync form data when record changes or when reprocessed record arrives
  useEffect(() => {
    setFormData({ ...record.data });
    setPaymentTransactions(getInitialTransactions(record, record.data));
    setHasUnsavedChanges(false);
    setSaveFeedback(false);
    setZoomLevel(1);
    setRotation(0);
    setMinimalTestResult(null);
    setIsRejectDialogOpen(false);
    setIsDeleteDialogOpen(false);
  }, [record.id, record.data, record.payment_transactions, record.updated_at]);

  // Find index and next/prev record IDs
  const currentIndex = allRecords.findIndex((r) => r.id === record.id);
  const prevRecord = currentIndex > 0 ? allRecords[currentIndex - 1] : null;
  const nextRecord = currentIndex < allRecords.length - 1 ? allRecords[currentIndex + 1] : null;

  const handleNext = () => {
    if (nextRecord) onNavigateRecord(nextRecord.id);
  };

  const handlePrev = () => {
    if (prevRecord) onNavigateRecord(prevRecord.id);
  };

  const handleSkip = () => {
    if (nextRecord) {
      onNavigateRecord(nextRecord.id);
    } else {
      onClose();
    }
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        if (e.key === 'Escape') {
          if (isRejectDialogOpen) setIsRejectDialogOpen(false);
          else if (isDeleteDialogOpen) setIsDeleteDialogOpen(false);
        }
        return;
      }

      if (e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        handleApprove();
      } else if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNext();
      } else if (e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handlePrev();
      } else if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        if (isRejectDialogOpen) setIsRejectDialogOpen(false);
        else if (isDeleteDialogOpen) setIsDeleteDialogOpen(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [record.id, formData, allRecords, isRejectDialogOpen, isDeleteDialogOpen]);

  // Validation
  const validationWarnings = validateReceiptData(formData, settings);

  const handleUpdateTransaction = (index: number, patch: Partial<PaymentTransaction>) => {
    setPaymentTransactions((prev) => {
      const updated = [...prev];
      const current = { ...updated[index], ...patch };
      if (patch.payment_date && !patch.payment_month) {
        current.payment_month = derivePaymentMonth(patch.payment_date);
      }
      updated[index] = current;
      return updated;
    });
    setHasUnsavedChanges(true);
  };

  const handleAddTransaction = () => {
    setPaymentTransactions((prev) => {
      const baseNature = installmentToNature(formData.nature || 'First') || 'First';
      const newIndex = prev.length;
      const newTx: PaymentTransaction = {
        transaction_index: newIndex,
        nature: formatSplitNature(baseNature, newIndex),
        amount: null,
        payment_mode: 'UPI',
        payment_ref_no: '',
        payment_date: formData.payment_date || formData.receipt_date || '',
        payment_month: derivePaymentMonth(formData.payment_date || formData.receipt_date || ''),
        fees_channel: '',
        remark: '',
      };
      return [...prev, newTx];
    });
    setHasUnsavedChanges(true);
  };

  const handleRemoveTransaction = (index: number) => {
    setPaymentTransactions((prev) => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter((_, i) => i !== index);
      const baseNature = installmentToNature(formData.nature || 'First') || 'First';
      return filtered.map((tx, i) => ({
        ...tx,
        transaction_index: i,
        nature: formatSplitNature(baseNature, i),
      }));
    });
    setHasUnsavedChanges(true);
  };

  const handleFieldChange = (field: FieldKey, value: any) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      
      // Auto-derive Payment Month if configured and payment_date changed
      if (field === 'payment_date' && settings.autoDerivePaymentMonth && typeof value === 'string' && value.includes('-')) {
        const parts = value.split('-');
        if (parts.length === 3) {
          const monthIndex = parseInt(parts[1], 10) - 1;
          const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
          if (monthNames[monthIndex] && !next.payment_month) {
            next.payment_month = `${monthNames[monthIndex]} ${parts[2]}`;
          }
        }
      }

      // Auto-copy Final Hostel if configured
      if (field === 'hostel_name' && settings.autoFillFinalHostel && !next.final_hostel) {
        next.final_hostel = value;
      }

      return next;
    });

    if (field === 'nature') {
      const cleanBase = installmentToNature(value) || 'First';
      setPaymentTransactions((prev) =>
        prev.map((tx, i) => ({
          ...tx,
          nature: formatSplitNature(cleanBase, i),
        }))
      );
    }

    setHasUnsavedChanges(true);
    setSaveFeedback(false);
  };

  const totalDetectedSplitAmount = paymentTransactions.reduce(
    (acc, t) => acc + (Number(t.amount) || 0),
    0
  );
  const receiptTotalAmount = Number(formData.amount_received) || 0;
  const hasMultipleSplits = paymentTransactions.length > 1;
  const isSplitAmountMismatch =
    hasMultipleSplits &&
    receiptTotalAmount > 0 &&
    Math.abs(totalDetectedSplitAmount - receiptTotalAmount) > 0.01;

  if (isSplitAmountMismatch) {
    validationWarnings.push({
      field: 'amount_received',
      message: `Multiple payment splits sum (₹${totalDetectedSplitAmount.toLocaleString('en-IN')}) does not match receipt total (₹${receiptTotalAmount.toLocaleString('en-IN')})`,
      severity: 'warning',
    });
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const changesCount = Object.keys(formData).filter((k) => (formData as any)[k] !== (record.data as any)[k]).length;
      const updated: ReceiptRecord = {
        ...record,
        data: {
          ...formData,
          payment_transactions: paymentTransactions,
        },
        payment_transactions: paymentTransactions,
        isReviewed: true,
        reviewedBy: settings.currentUser,
        reviewedAt: new Date().toISOString(),
        correctionsCount: (record.correctionsCount || 0) + changesCount,
      };
      await onSaveRecord(updated);
      setHasUnsavedChanges(false);
      setSaveFeedback(true);
      setTimeout(() => setSaveFeedback(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await onApproveRecord(record.id, {
        ...formData,
        payment_transactions: paymentTransactions,
      });
      if (nextRecord) {
        onNavigateRecord(nextRecord.id);
      } else {
        onClose();
      }
    } finally {
      setIsApproving(false);
    }
  };

  const handleConfirmReject = async () => {
    setIsRejecting(true);
    try {
      await onRejectRecord(record.id, rejectionReason);
      setIsRejectDialogOpen(false);
      if (nextRecord) {
        onNavigateRecord(nextRecord.id);
      } else {
        onClose();
      }
    } finally {
      setIsRejecting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!onDeleteRecord) return;
    setIsDeleting(true);
    try {
      await onDeleteRecord(record.id);
      setIsDeleteDialogOpen(false);
      if (nextRecord) {
        onNavigateRecord(nextRecord.id);
      } else if (prevRecord) {
        onNavigateRecord(prevRecord.id);
      } else {
        onClose();
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReprocess = async () => {
    setIsReprocessing(true);
    try {
      await onReprocessRecord(record);
      setSaveFeedback(false);
    } finally {
      setIsReprocessing(false);
    }
  };

  const handleRunMinimalTest = async () => {
    setIsTestingMinimal(true);
    try {
      let imagePayload = record.imageUrl;
      if (!imagePayload || imagePayload.length < 50) {
        const matchingSample = SAMPLE_RECEIPTS_CATALOG.find(
          (s) =>
            s.fileName === record.fileName ||
            s.id === record.id.replace(/^rec-demo-/, '') ||
            (record.fileName && (record.fileName.includes('855') || record.fileName.includes('RG') || record.fileName.includes('BaseCamp')))
        );
        if (matchingSample) {
          imagePayload = generateSampleReceiptImage(matchingSample.id);
        } else {
          imagePayload = generateSampleReceiptImage('sample-ezstays-basecamp');
        }
      }

      const res = await fetch('/api/test-minimal-extraction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64Data: imagePayload,
          image: imagePayload,
          mimeType: record.fileType || 'image/jpeg',
          fileName: record.fileName,
        }),
      });
      const data = await res.json();
      setMinimalTestResult(data);
    } catch (err: any) {
      setMinimalTestResult({ success: false, error: err.message });
    } finally {
      setIsTestingMinimal(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Count non-empty fields in record
  const filledFieldsCount = Object.values(formData).filter((v) => v !== '' && v !== null && v !== undefined).length;

  // Helper to render field confidence badge
  const renderConfidenceBadge = (fieldKey: FieldKey) => {
    const score = record.fieldConfidences?.[fieldKey] ?? 0.9;
    const isUncertain = record.uncertainFields?.includes(fieldKey) || score < settings.confidenceThreshold;
    const val = formData[fieldKey];

    if (val === '' || val === null) return null;

    return (
      <span
        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
          score >= 0.85
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : score >= 0.6
            ? 'bg-amber-50 text-amber-700 border border-amber-300'
            : 'bg-rose-50 text-rose-700 border border-rose-300'
        }`}
        title={`AI OCR confidence: ${Math.round(score * 100)}%`}
      >
        {Math.round(score * 100)}%
      </span>
    );
  };

  const renderFieldInput = (key: FieldKey, label: string, type: 'string' | 'number' | 'date', helper?: string) => {
    const val = formData[key];
    const score = record.fieldConfidences?.[key] ?? 0.9;
    const isUncertain = (record.uncertainFields?.includes(key) || score < settings.confidenceThreshold) && val !== '' && val !== null;
    const warning = validationWarnings.find((w) => w.field === key);

    return (
      <div className={`p-3 rounded-xl border transition ${
        isUncertain
          ? 'bg-amber-50/70 border-amber-300'
          : warning
          ? 'bg-rose-50/70 border-rose-300'
          : 'bg-white border-slate-200 shadow-xs'
      }`}>
        <div className="flex items-center justify-between gap-1 mb-1">
          <label className={`text-[10px] font-bold uppercase tracking-wider truncate ${
            isUncertain ? 'text-amber-700' : warning ? 'text-rose-700' : 'text-slate-400'
          }`} title={label}>
            {label} {isUncertain && '(Needs Review)'}
          </label>
          <div className="flex items-center space-x-1 shrink-0">
            {renderConfidenceBadge(key)}
          </div>
        </div>

        {type === 'number' ? (
          <div className="relative">
            <span className="absolute left-3 top-2 text-slate-400 text-xs font-semibold">₹</span>
            <input
              type="number"
              value={val === null || val === undefined ? '' : Number(val)}
              onChange={(e) => handleFieldChange(key, e.target.value === '' ? null : parseFloat(e.target.value))}
              placeholder="0"
              className={`w-full text-xs font-medium pl-6 pr-3 py-1.5 bg-white border rounded-lg outline-none transition ${
                isUncertain
                  ? 'border-amber-300 ring-2 ring-amber-200/50'
                  : 'border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
              }`}
            />
          </div>
        ) : (
          <div className="relative">
            <input
              type="text"
              value={val === null || val === undefined ? '' : String(val)}
              onChange={(e) => handleFieldChange(key, e.target.value)}
              placeholder={`Enter ${label}...`}
              className={`w-full text-xs font-medium px-3 py-1.5 bg-white border rounded-lg outline-none transition ${
                isUncertain
                  ? 'border-amber-300 ring-2 ring-amber-200/50'
                  : 'border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
              }`}
            />
          </div>
        )}

        {isUncertain && (
          <p className="text-[9px] text-amber-600 mt-1 font-medium italic">
            * Extraction confidence below threshold ({settings.confidenceThreshold})
          </p>
        )}

        {warning && (
          <p className="text-[10px] text-rose-600 mt-1 flex items-center space-x-1 font-medium">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span>{warning.message}</span>
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-7xl h-[92vh] flex flex-col overflow-hidden text-slate-900">
        
        {/* Top Control Bar */}
        <div className="h-16 px-6 border-b border-slate-200 bg-white flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1.5 text-xs text-slate-500">
              <button
                onClick={handlePrev}
                disabled={!prevRecord}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                title="Previous receipt (Alt+P)"
              >
                <ChevronLeft className="w-4 h-4 text-slate-700" />
              </button>
              <span className="font-bold text-slate-800 px-1 text-xs">
                Record #{currentIndex + 1} of {allRecords.length}
              </span>
              <button
                onClick={handleNext}
                disabled={!nextRecord}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                title="Next receipt (Alt+N)"
              >
                <ChevronRight className="w-4 h-4 text-slate-700" />
              </button>
            </div>

            <div className="h-4 w-px bg-slate-200" />

            <div className="truncate max-w-[240px]">
              <span className="text-sm font-bold text-slate-900 truncate block">
                {formData.student_name || record.data.student_name || record.fileName}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-slate-400 font-mono truncate">
                  {record.fileName}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-[10px] font-mono font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                  {record.modelUsed || record.debugInfo?.modelUsed || 'AI Flash'}
                  {record.isEscalated && (
                    <span className="ml-1 text-[9px] font-bold text-amber-700 bg-amber-100 px-1 py-0.2 rounded">
                      Escalated
                    </span>
                  )}
                </span>
              </div>
            </div>

            {record.isDuplicate && (
              <span className="px-3 py-1 bg-red-50 text-red-700 text-xs font-semibold rounded-full border border-red-200 flex items-center space-x-1">
                <Copy className="w-3.5 h-3.5" />
                <span>Duplicate Flag</span>
              </span>
            )}

            {saveFeedback && (
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200 flex items-center space-x-1 animate-pulse">
                <Check className="w-3.5 h-3.5" />
                <span>Saved!</span>
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowDebugPanel(!showDebugPanel)}
              className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition ${
                showDebugPanel
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
              title="Toggle Raw Pipeline & AI Debug Panel"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Pipeline Trace</span>
            </button>

            <button
              onClick={handleReprocess}
              disabled={isReprocessing}
              className="flex items-center space-x-1.5 px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition"
              title="Re-run Gemini AI OCR on this receipt"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isReprocessing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isReprocessing ? 'Extracting...' : 'Reprocess AI'}</span>
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl transition border ${
                hasUnsavedChanges
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-transparent shadow-sm shadow-indigo-200'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
              title="Save manual edits (Alt+S)"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save'}</span>
            </button>

            <button
              onClick={handleSkip}
              className="flex items-center space-x-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-xl transition"
              title="Skip this receipt without changing status"
            >
              <SkipForward className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Skip</span>
            </button>

            <button
              onClick={() => setIsRejectDialogOpen(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200 text-slate-700 text-xs font-semibold rounded-xl transition"
              title="Reject receipt"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Reject</span>
            </button>

            {onDeleteRecord && (
              <button
                onClick={() => setIsDeleteDialogOpen(true)}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                title="Delete this receipt"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={handleApprove}
              disabled={isApproving}
              className="flex items-center space-x-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-200 transition disabled:opacity-50"
              title="Approve and proceed to next (Alt+A)"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isApproving ? 'Approving...' : 'Approve & Next (Alt+A)'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 ml-1 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Extraction Failure Alert Banner (If status is failed or error occurred) */}
        {record.status === 'failed' && (
          <div className="bg-rose-50 border-b border-rose-200 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <div>
                <span className="text-xs font-bold text-rose-900 block">Extraction Failed for this Receipt</span>
                <span className="text-[11px] text-rose-700 font-mono block">
                  {record.errorReason || record.extractionNotes || 'Server or Gemini API returned an error'}
                </span>
                <span className="text-[10px] text-rose-500 font-mono mt-0.5 block">
                  Model: {record.modelUsed || record.debugInfo?.modelUsed || 'gemini-3.6-flash'}
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleRunMinimalTest}
                disabled={isTestingMinimal}
                className="px-3 py-1.5 bg-white border border-rose-300 text-rose-800 text-xs font-semibold rounded-lg hover:bg-rose-100 transition"
              >
                {isTestingMinimal ? 'Testing...' : 'Run 5-Field Test'}
              </button>
              <button
                onClick={handleReprocess}
                disabled={isReprocessing}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition"
              >
                {isReprocessing ? 'Retrying...' : 'Retry Extraction'}
              </button>
            </div>
          </div>
        )}

        {/* Split View Body */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-[#F8FAFC]">
          
          {/* LEFT SIDE: Original Receipt Image Viewer (5 cols) */}
          <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-900 flex flex-col relative overflow-hidden">
            {/* Image Toolbar */}
            <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Original Receipt Preview</span>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(z - 0.25, 0.5))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-mono w-10 text-center text-slate-300">{Math.round(zoomLevel * 100)}%</span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(z + 0.25, 3))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                  title="Rotate 90°"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsHighContrast(!isHighContrast)}
                  className={`p-1.5 rounded-lg text-xs font-semibold ${isHighContrast ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                  title="High Contrast / Sharpen Filter"
                >
                  Filter
                </button>
                {record.imageUrl && (
                  <a
                    href={record.receipt_url || record.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center gap-1 text-[11px]"
                    title="Open original receipt in full tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                <button
                  onClick={() => {
                    setZoomLevel(1);
                    setRotation(0);
                    setIsHighContrast(false);
                  }}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs"
                  title="Reset View"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Receipt Image Canvas Area */}
            <div className="flex-1 overflow-auto flex items-center justify-center p-6 bg-slate-950/90 select-none">
              {record.imageUrl ? (
                <div
                  className="transition-transform duration-100 ease-out origin-center"
                  style={{
                    transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                    filter: isHighContrast ? 'contrast(160%) brightness(95%) grayscale(40%)' : 'none',
                  }}
                >
                  <img
                    src={record.imageUrl}
                    alt="Hostel Receipt"
                    className="max-h-[68vh] max-w-full object-contain rounded-xl shadow-2xl border border-slate-700/60"
                  />
                </div>
              ) : (
                <div className="text-slate-500 text-xs">No image preview available</div>
              )}
            </div>

            {/* Image Footer Details */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
              <div className="truncate">
                <span className="font-mono text-[11px]">{record.fileName}</span>
                <span className="text-slate-600 ml-2">({Math.round((record.fileSize || 0) / 1024)} KB)</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Uploaded: {new Date(record.uploadedAt).toLocaleTimeString()}
              </div>
            </div>
          </div>

          {/* RIGHT SIDE: 33 Standardized Columns & Form Fields (7 cols) */}
          <div className="lg:col-span-7 flex flex-col overflow-hidden bg-white">
            
            {/* Category Filter Tabs */}
            <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => setActiveCategory('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    activeCategory === 'all'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  All 33 Fields ({filledFieldsCount}/33)
                </button>
                <button
                  onClick={() => setActiveCategory('student')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    activeCategory === 'student'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Student & Contact
                </button>
                <button
                  onClick={() => setActiveCategory('hostel')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    activeCategory === 'hostel'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Hostel & Room
                </button>
                <button
                  onClick={() => setActiveCategory('financial')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    activeCategory === 'financial'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Fees & Installments
                </button>
                <button
                  onClick={() => setActiveCategory('payment')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    activeCategory === 'payment'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Payment & Transaction
                </button>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <span className="text-[11px] text-slate-400 font-medium">
                  {validationWarnings.length > 0 ? (
                    <span className="text-amber-600 font-bold">{validationWarnings.length} Warnings</span>
                  ) : (
                    <span className="text-emerald-600 font-bold">✓ Valid</span>
                  )}
                </span>
              </div>
            </div>

            {/* Diagnostic Minimal Test Trigger banner if fields are empty */}
            {filledFieldsCount === 0 && record.status !== 'failed' && (
              <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2 text-amber-800 font-medium">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Fields are currently empty. You can enter details manually or test extraction.</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleRunMinimalTest}
                    disabled={isTestingMinimal}
                    className="px-3 py-1 bg-white border border-amber-300 text-amber-900 rounded-lg font-bold hover:bg-amber-100 transition"
                  >
                    {isTestingMinimal ? 'Testing...' : 'Run 5-Field Test'}
                  </button>
                </div>
              </div>
            )}

            {/* Debug & Trace Panel */}
            {showDebugPanel && (
              <div className="p-4 bg-slate-900 text-slate-200 border-b border-slate-800 text-xs max-h-72 overflow-y-auto font-mono space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-bold text-amber-400">=== AI EXTRACTION PIPELINE DIAGNOSTIC TRACE ===</span>
                  <button
                    onClick={() => setShowDebugPanel(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-1">
                  <div className="text-slate-400 font-semibold">// Record Metadata & Cloud Storage</div>
                  <div>Record ID: {record.receipt_record_id || record.id}</div>
                  <div>Filename: {record.original_file_name || record.fileName} ({record.mime_type || record.fileType})</div>
                  <div>Cloud Storage Path: <span className="text-sky-300 font-mono text-[10px]">{record.storage_path || 'Pending upload'}</span></div>
                  <div>Receipt URL: <span className="text-indigo-300 font-mono text-[10px] truncate block">{record.receipt_url || record.imageUrl ? 'Available' : 'None'}</span></div>
                  <div>Status: <span className="text-indigo-400 font-bold">{record.status}</span></div>
                  <div>Model Used: <span className="text-emerald-400 font-bold">{record.modelUsed || record.debugInfo?.modelUsed || 'Auto-routed'}</span> {record.isEscalated ? '(ESCALATED)' : '(PRIMARY)'}</div>
                  {record.debugInfo?.executionTimeMs ? <div>Execution Time: {record.debugInfo.executionTimeMs}ms</div> : null}
                  <div>Overall Confidence: {Math.round(record.overallConfidence * 100)}%</div>
                  <div>Duplicate Flag: {record.isDuplicate ? `YES (${record.duplicateReason})` : 'NO'}</div>
                </div>

                {record.debugInfo?.routingLog && record.debugInfo.routingLog.length > 0 && (
                  <div className="space-y-1 pt-2 border-t border-slate-800">
                    <div className="text-amber-300 font-semibold">// Model Routing Log</div>
                    <ul className="list-disc pl-5 text-slate-300 text-[11px] space-y-0.5">
                      {record.debugInfo.routingLog.map((logItem, idx) => (
                        <li key={idx} className="text-slate-300">{logItem}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {record.debugInfo && (
                  <div className="space-y-1 pt-2 border-t border-slate-800">
                    <div className="text-slate-400 font-semibold">// OCR Interpretations & Rules</div>
                    {record.debugInfo.errorStage && (
                      <div className="text-rose-400 font-bold">Error Stage: {record.debugInfo.errorStage}</div>
                    )}
                    {record.debugInfo.errorMessage && (
                      <div className="text-rose-300">Error Message: {record.debugInfo.errorMessage}</div>
                    )}
                    <div>Words Match Status: <span className={record.debugInfo.wordsMatchStatus === 'matched' ? 'text-emerald-400' : 'text-amber-400'}>{record.debugInfo.wordsMatchStatus || 'not_present'}</span></div>
                    <div>Words Message: {record.debugInfo.wordsMatchMessage || 'N/A'}</div>
                    <div>Roman Numeral Converted: {record.debugInfo.romanNumeralConverted ? 'YES' : 'NO'}</div>
                    <div>Prefix Combined: {record.debugInfo.prefixCombined ? 'YES' : 'NO'}</div>
                    <div>Rules Applied:</div>
                    <ul className="list-disc pl-5 text-slate-300">
                      {(record.debugInfo.specialRulesApplied || []).map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {minimalTestResult && (
                  <div className="space-y-1 pt-2 border-t border-slate-800">
                    <div className="text-emerald-400 font-bold">// 5-Field Minimal Test Result:</div>
                    <pre className="bg-slate-950 p-2.5 rounded text-[11px] overflow-x-auto text-emerald-300">
                      {JSON.stringify(minimalTestResult, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Scrollable Form Fields Grid */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Group 1: Student & Identity Information */}
              {(activeCategory === 'all' || activeCategory === 'student') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                      <span>Student & Guardian Profile</span>
                    </h3>
                    <span className="text-[10px] text-slate-400">Columns 8-16</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {renderFieldInput('student_name', 'Student Name', 'string')}
                    {renderFieldInput('student_id', 'Student ID', 'string')}
                    {renderFieldInput('student_phone_no', 'Student Phone No', 'string')}
                    {renderFieldInput('student_id2', 'Student ID 2 (Optional)', 'string')}
                    {renderFieldInput('father_name', "Father's Name", 'string')}
                    {renderFieldInput('father_phone_no', "Father's Phone No", 'string')}
                    <div className="sm:col-span-2 lg:col-span-3">
                      {renderFieldInput('address', 'Permanent Address', 'string')}
                    </div>
                  </div>
                </div>
              )}

              {/* Group 2: Hostel, College & Room Details */}
              {(activeCategory === 'all' || activeCategory === 'hostel') && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>Hostel, Room & Academic Data</span>
                    </h3>
                    <span className="text-[10px] text-slate-400">Columns 1-7, 17-20</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {renderFieldInput('hostel_name', 'Hostel Name (Handwritten)', 'string')}
                    {renderFieldInput('final_hostel', 'Final Hostel', 'string')}
                    {renderFieldInput('room_no_bed_no', 'Room / Bed No', 'string')}
                    {renderFieldInput('room_type', 'Room Type (e.g. 3 & 6 beds A.C.)', 'string')}
                    {renderFieldInput('college', 'College (e.g. Bennett)', 'string')}
                    {renderFieldInput('course', 'Course (e.g. B.Tech)', 'string')}
                    {renderFieldInput('year', 'Year (e.g. 1st)', 'string')}
                    {renderFieldInput('entry_status', 'Entry Status (Regular/Lateral)', 'string')}
                    {renderFieldInput('old_new', 'Old / New Admission', 'string')}
                    {renderFieldInput('final_status', 'Final Status (Confirmed)', 'string')}
                  </div>
                </div>
              )}

              {/* Group 3: Financial & Fee Details */}
              {(activeCategory === 'all' || activeCategory === 'financial') && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      <span>Hostel Fees & Installment Breakdown</span>
                    </h3>
                    <span className="text-[10px] text-slate-400">Columns 9, 21-25, 32</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {renderFieldInput('amount_received', 'Amount Received', 'number')}
                    {renderFieldInput('total_fees', 'Total Hostel Fee', 'number')}
                    {renderFieldInput('nature', 'Nature (e.g. Installment 1)', 'string')}
                    {renderFieldInput('yearly_monthly', 'Yearly / Monthly', 'string')}
                    {renderFieldInput('cumulative_fee', 'Cumulative Fee', 'number')}
                    {renderFieldInput('percentage_of_fees', '% of Fees Received', 'string')}
                    {renderFieldInput('discount', 'Discount (if applicable)', 'number')}
                  </div>
                </div>
              )}

              {/* Group 4: Payment & Banking Transaction Details */}
              {(activeCategory === 'all' || activeCategory === 'payment') && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                      <span>Transaction & Payment Settlement</span>
                    </h3>
                    <span className="text-[10px] text-slate-400">Columns 26-31, 33</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {renderFieldInput('receipt_no', 'Receipt No (Prefix + Handwritten)', 'string')}
                    {renderFieldInput('receipt_date', 'Receipt Date (DD-MM-YYYY)', 'string')}
                    {renderFieldInput('mode_of_receipt', 'Mode (PhonePe, Cash, NEFT)', 'string')}
                    {renderFieldInput('fees_channel', 'Fees Channel', 'string')}
                    {renderFieldInput('payment_ref_no', 'Payment Ref / UTR / Cheque #', 'string')}
                    {renderFieldInput('payment_date', 'Payment Date (DD-MM-YYYY)', 'string')}
                    {renderFieldInput('payment_month', 'Payment Month', 'string')}
                    {renderFieldInput('knocked_by', 'Knocked By', 'string')}
                    {renderFieldInput('remark', 'Remark', 'string')}
                  </div>

                  {/* Physical Receipt: Multiple Payments Breakdown */}
                  <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            PHYSICAL RECEIPT
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            Receipt No: <span className="font-mono text-indigo-700">{formData.receipt_no || record.data.receipt_no || '—'}</span>
                          </span>
                        </div>
                        <h4 className="text-xs font-semibold text-slate-500 mt-0.5 flex items-center space-x-1.5">
                          <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                          <span>Detected Payments ({paymentTransactions.length} transaction{paymentTransactions.length > 1 ? 's' : ''})</span>
                        </h4>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={handleAddTransaction}
                          className="flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl transition shadow-xs"
                          title="Add another payment transaction recorded on this physical receipt"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Payment</span>
                        </button>
                      </div>
                    </div>

                    {/* Total Detected Comparison & Balance Check */}
                    <div className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs ${
                      isSplitAmountMismatch
                        ? 'bg-amber-50 border-amber-300 text-amber-900'
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}>
                      <div className="flex flex-wrap items-center gap-4">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Detected</span>
                          <span className="text-base font-bold text-slate-900 font-mono">
                            ₹{totalDetectedSplitAmount.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="text-slate-300">|</div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Physical Receipt Total</span>
                          <span className="text-base font-bold text-slate-900 font-mono">
                            ₹{receiptTotalAmount.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>

                      <div>
                        {isSplitAmountMismatch ? (
                          <span className="inline-flex items-center space-x-1 text-xs font-bold text-amber-800 bg-amber-100/90 px-3 py-1 rounded-lg border border-amber-300">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                            <span>Mismatch: Differs by ₹{Math.abs(totalDetectedSplitAmount - receiptTotalAmount).toLocaleString('en-IN')} (Needs Review)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>✓ Sum Matches Physical Receipt Total</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Detected Payments List */}
                    <div className="space-y-2">
                      {paymentTransactions.map((tx, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-white border border-slate-200 hover:border-indigo-300 rounded-xl shadow-xs transition space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-300 text-slate-700 text-[11px] font-bold flex items-center justify-center font-mono">
                                {idx + 1}
                              </span>
                              <span className="text-xs font-bold text-indigo-700 font-mono bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                                {tx.nature}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                (Nature column: <strong>{tx.nature}</strong>)
                              </span>
                            </div>

                            {paymentTransactions.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveTransaction(idx)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                title="Remove this split payment"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                            {/* Amount */}
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Amount (₹)
                              </label>
                              <div className="relative">
                                <span className="absolute left-2.5 top-2 text-slate-400 font-semibold text-xs">₹</span>
                                <input
                                  type="number"
                                  value={tx.amount ?? ''}
                                  onChange={(e) =>
                                    handleUpdateTransaction(idx, {
                                      amount: e.target.value === '' ? null : Number(e.target.value),
                                    })
                                  }
                                  placeholder="0"
                                  className="w-full pl-6 pr-2 py-1.5 text-xs font-bold font-mono border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none"
                                />
                              </div>
                            </div>

                            {/* Mode */}
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Payment Mode
                              </label>
                              <select
                                value={tx.payment_mode || 'UPI'}
                                onChange={(e) =>
                                  handleUpdateTransaction(idx, {
                                    payment_mode: e.target.value,
                                    payment_ref_no: e.target.value.toLowerCase() === 'cash' && !tx.payment_ref_no ? 'Cash' : tx.payment_ref_no,
                                  })
                                }
                                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none bg-white"
                              >
                                <option value="UPI">UPI (PhonePe, GPay, Paytm)</option>
                                <option value="Cash">Cash</option>
                                <option value="Online">Online / Net Banking</option>
                                <option value="NEFT">NEFT / RTGS</option>
                                <option value="Cheque">Cheque / Pay Order</option>
                                <option value="Bank Transfer">Bank Transfer</option>
                              </select>
                            </div>

                            {/* Reference / UTR */}
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Payment Ref / UTR
                              </label>
                              <input
                                type="text"
                                value={tx.payment_ref_no || ''}
                                onChange={(e) =>
                                  handleUpdateTransaction(idx, {
                                    payment_ref_no: e.target.value,
                                  })
                                }
                                placeholder={tx.payment_mode === 'Cash' ? 'Cash' : 'UTR / Ref No'}
                                className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none"
                              />
                            </div>

                            {/* Date */}
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Payment Date
                              </label>
                              <input
                                type="text"
                                value={tx.payment_date || ''}
                                onChange={(e) =>
                                  handleUpdateTransaction(idx, {
                                    payment_date: e.target.value,
                                  })
                                }
                                placeholder="DD-MM-YYYY"
                                className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Group 5: Extended Layout Fields (Internal Business Schema) */}
              <div className="space-y-3 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-indigo-700 uppercase tracking-wider flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Special Layout & Internal Fields</span>
                  </h3>
                  <span className="text-[10px] text-slate-400 font-medium">Retained internally for business intelligence</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Installment No (Roman → Arabic)</span>
                    <div className="flex items-center space-x-2 font-mono">
                      <span className="bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700">
                        Raw: {formData.installment_no_raw || 'I'}
                      </span>
                      <span>→</span>
                      <span className="bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 font-bold text-indigo-700">
                        {formData.installment_no || '1'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Receipt No Construction</span>
                    <div className="text-slate-800 font-mono text-[11px] truncate">
                      Prefix: <strong>{formData.receipt_prefix || 'EZ-26-RG'}</strong> | Num: <strong>{formData.receipt_number_handwritten || '855'}</strong>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Rupees (In Words)</span>
                    <div className="font-medium text-slate-800 italic truncate" title={formData.amount_received_words}>
                      "{formData.amount_received_words || 'Not specified'}"
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Balance Amount</span>
                    <div className="font-bold text-slate-800">
                      ₹{formData.balance_amount ? formData.balance_amount.toLocaleString('en-IN') : '—'}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Next Inst. & Due Date</span>
                    <div className="text-slate-800 text-[11px]">
                      {formData.next_installment_amount || '—'} / {formData.next_due_date || '—'}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Bank Name & Slip Ref</span>
                    <div className="text-slate-800 font-medium text-[11px]">
                      Bank: {formData.bank_name || '—'} | Ref: {formData.ref || '—'}
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Bottom Status & Quick Guide */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 shrink-0">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Overall Extraction: </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${record.overallConfidence >= 0.85 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                  {Math.round(record.overallConfidence * 100)}% Conf
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-500 font-medium">Corrections: {record.correctionsCount || 0}</span>
              </div>
              <div className="flex items-center space-x-2 text-[11px]">
                <span className="hidden sm:inline text-slate-400">Keys:</span>
                <kbd className="px-2 py-0.5 bg-white border border-slate-200 shadow-xs rounded font-mono text-[10px] text-slate-600">Alt+A (Approve)</kbd>
                <kbd className="px-2 py-0.5 bg-white border border-slate-200 shadow-xs rounded font-mono text-[10px] text-slate-600">Alt+S (Save)</kbd>
                <kbd className="px-2 py-0.5 bg-white border border-slate-200 shadow-xs rounded font-mono text-[10px] text-slate-600">Alt+N (Next)</kbd>
                <kbd className="px-2 py-0.5 bg-white border border-slate-200 shadow-xs rounded font-mono text-[10px] text-slate-600">Alt+P (Prev)</kbd>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Reject Confirmation Dialog */}
      {isRejectDialogOpen && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <XCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-900">Reject Fee Receipt</h3>
            </div>
            <p className="text-xs text-slate-500">
              Please specify the reason for rejecting this receipt slip. The record will be marked as Rejected and logged in the database.
            </p>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                Rejection Reason
              </label>
              <select
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none"
              >
                <option value="Illegible / blurry receipt handwriting">Illegible / blurry receipt handwriting</option>
                <option value="Invalid document / Not a hostel fee slip">Invalid document / Not a hostel fee slip</option>
                <option value="Duplicate payment submission">Duplicate payment submission</option>
                <option value="Inconsistent student name / ID details">Inconsistent student name / ID details</option>
                <option value="Amount mismatch with university records">Amount mismatch with university records</option>
                <option value="Custom reason">Other custom reason...</option>
              </select>

              {rejectionReason === 'Custom reason' && (
                <input
                  type="text"
                  placeholder="Type specific rejection details..."
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl mt-2 outline-none"
                />
              )}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsRejectDialogOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={isRejecting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                {isRejecting ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {isDeleteDialogOpen && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <Trash2 className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-900">Delete Receipt Record</h3>
            </div>
            <p className="text-xs text-slate-600">
              Are you sure you want to permanently delete this receipt for <strong>{formData.student_name || record.fileName}</strong>? This will remove it from IndexedDB and all master spreadsheets.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsDeleteDialogOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
