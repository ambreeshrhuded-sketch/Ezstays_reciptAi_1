import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ReceiptRecord,
  BatchInfo,
  AppSettings,
  ReceiptData,
  ExtractionStatus,
} from './types/receipt';
import { Navbar, ActiveTab } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { UploadView, PendingUploadFile } from './components/UploadView';
import { ProcessingQueueView } from './components/ProcessingQueueView';
import { AllRecordsTable } from './components/AllRecordsTable';
import { DuplicatesView } from './components/DuplicatesView';
import { ReportsView } from './components/ReportsView';
import { ExportView } from './components/ExportView';
import { SettingsView } from './components/SettingsView';
import { TestDebugView } from './components/TestDebugView';
import { ReconciliationView } from './components/reconciliation/ReconciliationView';
import {
  getAllBankStatements,
  getAllBankTransactions,
  getAllReceiptPayments,
  getAllReconciliations,
} from './firebase/reconciliationStore';
import { ReviewModal } from './components/ReviewModal';
import { SampleReceiptsModal } from './components/SampleReceiptsModal';
import { AuthModal } from './components/AuthModal';
import {
  getAllRecords,
  saveRecord,
  saveBatchRecords,
  deleteRecordFromDB,
  clearAllRecordsFromDB,
  getAllBatches,
  saveBatch,
  getSettings,
  saveSettings,
  DEFAULT_SETTINGS,
} from './utils/storage';
import {
  uploadReceiptImageToStorage,
  buildReceiptStoragePath,
  subscribeToQuotaExhaustion,
  isQuotaExhausted,
} from './firebase/receiptStore';
import { checkForDuplicates } from './utils/duplicateDetector';
import { exportRecordsToExcel } from './utils/excelExporter';
import { SAMPLE_RECEIPTS_CATALOG, generateSampleReceiptImage } from './utils/sampleReceipts';
import { prepareTemporaryOcrImage } from './utils/imageOptimizer';
import { useAuth } from './firebase/AuthContext';
import { LogIn, Lock, Mail, ShieldAlert, KeyRound, CheckCircle2, HelpCircle, ExternalLink, AlertTriangle, X } from 'lucide-react';

// High-throughput concurrent worker pool for fast batch receipt extraction
const MAX_CONCURRENT_WORKERS = 3;
// This covers bounded server attempts without letting
// the browser cancel the request before the server has finished its work.
const EXTRACTION_TIMEOUT_MS = 60000;
const STUCK_PROCESSING_THRESHOLD_MS = 120000;

function getPayloadMimeType(payload: string, fallback: string): string {
  const match = /^data:([^;,]+)[;,]/i.exec(payload);
  return match?.[1] || fallback || 'image/jpeg';
}

export function App() {
  const { user, loading: authLoading, signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [records, setRecords] = useState<ReceiptRecord[]>([]);
  const [batches, setBatches] = useState<BatchInfo[]>([]);
  const [currentBatch, setCurrentBatch] = useState<BatchInfo | null>(null);
  const [settings, setSettingsState] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isQuotaNoticeDismissed, setIsQuotaNoticeDismissed] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(() => isQuotaExhausted());

  // Listen for quota limit events
  useEffect(() => {
    return subscribeToQuotaExhaustion((exhausted) => {
      setQuotaExceeded(exhausted);
    });
  }, []);
  
  // Login Gate State (when not authenticated)
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // UI Modal States
  const [reviewRecordId, setReviewRecordId] = useState<string | null>(null);
  const [isSampleModalOpen, setIsSampleModalOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isProcessingQueue, setIsProcessingQueue] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'info' | 'success' | 'error' } | null>(null);
  const [reconSummary, setReconSummary] = useState({
    statementsCount: 0,
    transactionsCount: 0,
    knockedCount: 0,
    totalPayments: 0,
  });

  const refreshReconSummary = useCallback(async () => {
    try {
      const [stmts, txns, recons, pymts] = await Promise.all([
        getAllBankStatements(),
        getAllBankTransactions(),
        getAllReconciliations(),
        getAllReceiptPayments(),
      ]);
      setReconSummary({
        statementsCount: stmts.length,
        transactionsCount: txns.length,
        knockedCount: recons.length,
        totalPayments: pymts.length || records.length,
      });
    } catch (e) {
      console.warn('[App] Could not load reconciliation summary stats:', e);
    }
  }, [records.length]);

  useEffect(() => {
    refreshReconSummary();
  }, [refreshReconSummary, activeTab]);

  // Queue runner refs to guarantee single worker loop and prevent duplicate claims
  const isRunningRef = useRef(false);
  const isQueueActiveLockRef = useRef(false);
  const claimedRecordIdsRef = useRef<Set<string>>(new Set());
  const recordsRef = useRef<ReceiptRecord[]>([]);
  recordsRef.current = records;
  const currentBatchRef = useRef<BatchInfo | null>(null);
  currentBatchRef.current = currentBatch;

  // Load initial data only when user is authenticated and recover stuck records
  useEffect(() => {
    if (!user) {
      setRecords([]);
      setBatches([]);
      return;
    }

    async function loadData() {
      try {
        const loadedRecords = await getAllRecords();
        const loadedBatches = await getAllBatches();
        const loadedSettings = await getSettings();
        
        const now = Date.now();
        let hasRecoveredRecords = false;

        const recoveredRecords = loadedRecords.map((rec) => {
          if (rec.status === 'processing' || rec.processing_status === 'processing') {
            const updatedAtTime = rec.updated_at ? new Date(rec.updated_at).getTime() : 0;
            if (now - updatedAtTime > STUCK_PROCESSING_THRESHOLD_MS) {
              console.log(`[Queue] Recovered stuck processing record on startup: ${rec.id}`);
              hasRecoveredRecords = true;
              return {
                ...rec,
                status: 'pending' as ExtractionStatus,
                processing_status: 'pending' as ExtractionStatus,
                errorReason: 'Recovered from interrupted processing session. Queued for extraction.',
              };
            }
          }
          return rec;
        });

        if (hasRecoveredRecords) {
          const changed = recoveredRecords.filter((r) => r.status === 'pending');
          await saveBatchRecords(changed);
        }

        setRecords(recoveredRecords);
        setBatches(loadedBatches);
        setSettingsState(loadedSettings);

        // If no records at all, load the sample initial records so the user immediately sees a functioning dashboard!
        if (recoveredRecords.length === 0) {
          loadDemoInitialData(loadedSettings);
        }
      } catch (err) {
        console.error('Error loading initial data from DB:', err);
      }
    }
    loadData();
  }, [user]);

  const showToast = (text: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Preload realistic demo data for initial impression
  const loadDemoInitialData = async (activeSettings: AppSettings) => {
    const demoBatchId = `batch-demo-${Date.now()}`;
    const initialDemoRecords: ReceiptRecord[] = SAMPLE_RECEIPTS_CATALOG.map((sample, idx) => {
      const b64 = generateSampleReceiptImage(sample.id);
      const isReviewRequired = idx === 1; // Mark 2nd as review required for demo
      const overallConf = isReviewRequired ? 0.76 : 0.96;

      const record: ReceiptRecord = {
        id: `rec-demo-${sample.id}`,
        batchId: demoBatchId,
        fileName: sample.fileName,
        fileSize: 45000,
        fileType: 'image/jpeg',
        imageUrl: b64,
        uploadedAt: new Date(Date.now() - idx * 3600000).toISOString(),
        status: isReviewRequired ? 'needs_review' : 'approved',
        data: {
          hostel_name: sample.expectedData.hostelName,
          final_hostel: sample.id === 'sample-ezstays-basecamp' ? '' : sample.expectedData.hostelName,
          entry_status: sample.id === 'sample-ezstays-basecamp' ? '' : 'Regular',
          old_new: sample.id === 'sample-ezstays-basecamp' ? '' : 'New Admission',
          knocked_by: sample.expectedData.cashier || '',
          room_no_bed_no: sample.expectedData.roomBed || '',
          final_status: sample.id === 'sample-ezstays-basecamp' ? '' : 'Confirmed',
          student_id: sample.expectedData.studentId || '',
          receipt_no: sample.expectedData.receiptNo,
          nature: sample.expectedData.installmentNo ? `Installment ${sample.expectedData.installmentNo}` : 'Hostel Fee',
          student_name: sample.expectedData.studentName,
          student_phone_no: sample.expectedData.phone || '9140536862',
          student_id2: '',
          father_name: sample.expectedData.fatherName || '',
          father_phone_no: sample.expectedData.fatherPhone || '',
          address: sample.expectedData.address || 'Ghazipur (U.P)',
          college: sample.expectedData.college || 'Bennett',
          course: sample.expectedData.course || 'B.Tech',
          year: sample.expectedData.year || '1st',
          room_type: sample.expectedData.roomType || '3 & 6 beds A.C.',
          total_fees: sample.expectedData.totalFee || (sample.expectedData.amount + 5000),
          yearly_monthly: '',
          amount_received: sample.expectedData.amount,
          cumulative_fee: null,
          percentage_of_fees: '',
          mode_of_receipt: sample.expectedData.paymentMode || 'PhonePe',
          fees_channel: '',
          receipt_date: sample.expectedData.date || '11-08-2026',
          payment_ref_no: sample.expectedData.refNo || '30054851268',
          payment_date: sample.expectedData.date || '11-08-2026',
          payment_month: 'August 2026',
          discount: null,
          remark: '',
          // Extended fields
          installment_no: sample.expectedData?.installmentNo || '1',
          installment_no_raw: sample.expectedData?.installmentNo ? 'I' : '',
          receipt_prefix: sample.expectedData?.receiptNo && String(sample.expectedData.receiptNo).includes('-')
            ? String(sample.expectedData.receiptNo).split('-').slice(0, 3).join('-')
            : 'EZ-26-RG',
          receipt_number_handwritten: sample.expectedData?.receiptNo && String(sample.expectedData.receiptNo).includes('-')
            ? String(sample.expectedData.receiptNo).split('-').pop() || '855'
            : '855',
          amount_received_words: sample.expectedData?.amountInWords || 'Ten thousand Rupees Only',
          balance_amount: sample.expectedData?.balanceAmount || null,
          bank_name: sample.expectedData?.bankName || 'IDFC',
          ref: sample.id === 'sample-ezstays-basecamp' ? 'PR' : '',
        },
        overallConfidence: overallConf,
        uncertainFields: isReviewRequired ? ['student_phone_no', 'payment_ref_no'] : [],
        fieldConfidences: {
          student_name: 0.98,
          student_id: 0.96,
          receipt_no: 0.97,
          amount_received: 0.99,
          total_fees: 0.98,
          student_phone_no: isReviewRequired ? 0.72 : 0.95,
          payment_ref_no: isReviewRequired ? 0.68 : 0.96,
          hostel_name: 0.98,
        },
        isDuplicate: false,
        isReviewed: !isReviewRequired,
        reviewedBy: isReviewRequired ? undefined : 'Senior Warden',
        reviewedAt: isReviewRequired ? undefined : new Date().toISOString(),
        correctionsCount: 0,
      };
      return record;
    });

    const demoBatch: BatchInfo = {
      id: demoBatchId,
      name: 'Batch #001 - Preloaded Admission Samples',
      batchNumber: 'Batch #001',
      totalCount: initialDemoRecords.length,
      processedCount: initialDemoRecords.length,
      needsReviewCount: 1,
      approvedCount: 3,
      createdAt: new Date().toISOString(),
      status: 'completed',
    };

    await saveBatchRecords(initialDemoRecords);
    await saveBatch(demoBatch);

    setRecords(initialDemoRecords);
    setBatches([demoBatch]);
    setCurrentBatch(demoBatch);
  };

  // Start Batch Extraction: Persists ONLY new records in chunked batches
  const handleStartBatch = async (files: PendingUploadFile[], name: string) => {
    if (files.length === 0) return;

    console.log(`[Queue] Batch started: "${name}" with ${files.length} receipts`);
    const newBatchId = `batch-${Date.now()}`;
    const batchNumber = `Batch #${String(batches.length + 1).padStart(3, '0')}`;

    const newRecords: ReceiptRecord[] = files.map((f, i) => {
      const uniqueRecId = `rec-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`;
      const safePath = buildReceiptStoragePath(uniqueRecId, f.name);
      return {
        id: uniqueRecId,
        receipt_record_id: uniqueRecId,
        batchId: newBatchId,
        fileName: f.name,
        original_file_name: f.name,
        fileSize: f.size,
        fileType: f.type,
        mime_type: f.type,
        imageUrl: f.base64Data,
        receipt_url: f.base64Data,
        storage_path: safePath,
        uploadedAt: new Date().toISOString(),
        created_at: new Date().toISOString(),
        status: 'pending',
        processing_status: 'pending',
        data: {
          hostel_name: null,
          final_hostel: null,
          entry_status: null,
          old_new: null,
          knocked_by: null,
          room_no_bed_no: null,
          final_status: null,
          student_id: null,
          receipt_no: null,
          nature: null,
          student_name: null,
          student_phone_no: null,
          student_id2: null,
          father_name: null,
          father_phone_no: null,
          address: null,
          college: null,
          course: null,
          year: null,
          room_type: null,
          total_fees: null,
          yearly_monthly: null,
          amount_received: null,
          cumulative_fee: null,
          percentage_of_fees: null,
          mode_of_receipt: null,
          fees_channel: null,
          receipt_date: null,
          payment_ref_no: null,
          payment_date: null,
          payment_month: null,
          discount: null,
          remark: null,
        },
        overallConfidence: 0,
        uncertainFields: [],
        fieldConfidences: {},
        isDuplicate: false,
        isReviewed: false,
        correctionsCount: 0,
      };
    });

    const newBatch: BatchInfo = {
      id: newBatchId,
      name,
      batchNumber,
      totalCount: files.length,
      processedCount: 0,
      needsReviewCount: 0,
      approvedCount: 0,
      createdAt: new Date().toISOString(),
      status: 'processing',
    };

    // Update state
    const updatedRecords = [...newRecords, ...records];
    setRecords(updatedRecords);

    const updatedBatches = [newBatch, ...batches];
    setBatches(updatedBatches);
    setCurrentBatch(newBatch);

    // Save newly uploaded records only
    console.log(`[Queue] Persisting ${newRecords.length} new records...`);
    try {
      await saveBatchRecords(newRecords);
      await saveBatch(newBatch);
      console.log(`[Queue] Persistence complete for new records.`);
    } catch (saveErr) {
      console.error('[Queue] Error persisting new records before queue start:', saveErr);
      showToast('Warning: Pre-saving receipts encountered an issue, starting queue...', 'info');
    }

    setActiveTab('processing');
    showToast(`Batch queued: ${files.length} receipts being processed`, 'info');

    // Start process queue with duplicate worker lock
    startOrResumeQueue(newBatch);
  };

  // Robust queue worker starter with duplicate guard
  const startOrResumeQueue = async (targetBatch?: BatchInfo | null) => {
    if (isQueueActiveLockRef.current) {
      console.log('[Queue] Worker controller already active. Skipping redundant startup.');
      isRunningRef.current = true;
      setIsProcessingQueue(true);
      return;
    }

    isQueueActiveLockRef.current = true;
    isRunningRef.current = true;
    setIsProcessingQueue(true);
    console.log('[Queue] Worker started');

    try {
      await runQueueLoop(targetBatch);
    } finally {
      isQueueActiveLockRef.current = false;
      setIsProcessingQueue(false);
      console.log('[Queue] Worker released');
    }
  };

  // Continuous pulling worker loop with 3 concurrent workers and atomic claims
  const runQueueLoop = async (targetBatch?: BatchInfo | null) => {
    const workerTask = async (workerId: number): Promise<void> => {
      // Lightweight stagger to avoid burst collision while starting workers
      if (workerId > 1) {
        await new Promise((resolve) => setTimeout(resolve, (workerId - 1) * 120));
      }

      while (isRunningRef.current) {
        // Find next pending record that is not currently claimed by any worker
        const currentList = recordsRef.current;
        const currentBatchObj = targetBatch || currentBatchRef.current;

        const nextPending = currentList.find((r) => {
          if (r.status !== 'pending') return false;
          if (claimedRecordIdsRef.current.has(r.id)) return false;
          if (currentBatchObj && currentBatchObj.id) {
            return r.batchId === currentBatchObj.id;
          }
          return true;
        });

        // No more pending items found for this worker
        if (!nextPending) {
          break;
        }

        // Claim record immediately in synchronized ref Set
        claimedRecordIdsRef.current.add(nextPending.id);

        try {
          await processSingleReceipt(nextPending.id, workerId, currentBatchObj);
        } finally {
          claimedRecordIdsRef.current.delete(nextPending.id);
        }

        // Fast pacing between subsequent records for rapid batch completion
        if (isRunningRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    };

    // Keep extraction requests serialized to stay within Gemini request limits.
    const workerPromises = Array.from({ length: MAX_CONCURRENT_WORKERS }, (_, i) => workerTask(i + 1));
    await Promise.all(workerPromises);

    // Final batch synchronization check
    console.log('[Queue] Queue processing completed');
    const finalBatch = targetBatch || currentBatchRef.current;
    if (finalBatch) {
      const batchRecs = recordsRef.current.filter((r) => r.batchId === finalBatch.id);
      const isStillPending = batchRecs.some((r) => r.status === 'pending' || r.status === 'processing');
      if (!isStillPending) {
        const updatedBatch: BatchInfo = {
          ...finalBatch,
          processedCount: batchRecs.filter((r) => r.status !== 'pending' && r.status !== 'processing').length,
          needsReviewCount: batchRecs.filter((r) => r.status === 'needs_review').length,
          approvedCount: batchRecs.filter((r) => r.status === 'approved').length,
          status: 'completed',
        };
        setBatches((prev) => prev.map((b) => (b.id === updatedBatch.id ? updatedBatch : b)));
        setCurrentBatch(updatedBatch);
        await saveBatch(updatedBatch);
      }
    }
  };

  // Process a single receipt with decoupled Storage upload & automatic OCR preparation
  const processSingleReceipt = async (
    recordId: string,
    workerId: number,
    targetBatch?: BatchInfo | null
  ): Promise<void> => {
    const rec = recordsRef.current.find((r) => r.id === recordId);
    if (!rec) return;

    console.log(`[Queue] [Worker ${workerId}] Starting receipt ${rec.id} (${rec.fileName})`);

    // 1. Mark as processing synchronously in state first so recordsRef and UI reflect immediately
    const processingRecord: ReceiptRecord = {
      ...rec,
      status: 'processing',
      processing_status: 'processing',
      errorReason: undefined,
      updated_at: new Date().toISOString(),
    };

    // Update records state and recordsRef immediately
    recordsRef.current = recordsRef.current.map((r) => (r.id === recordId ? processingRecord : r));
    setRecords((prev) => prev.map((r) => (r.id === recordId ? processingRecord : r)));
    saveRecord(processingRecord).catch((e) => console.warn('[Queue] Background save warning:', e));

    const abortController = new AbortController();
    const timeoutHandle = setTimeout(() => {
      abortController.abort();
    }, EXTRACTION_TIMEOUT_MS);

    try {
      // Resolve image payload
      let imagePayload = rec.imageUrl;
      if (!imagePayload || imagePayload.length < 50) {
        throw new Error('Receipt image is unavailable. Please upload the original receipt again.');
      }

      // PHASE 8: Decouple Cloud Storage upload from Gemini extraction
      // Start storage upload in background so network delays never block OCR
      const storageUploadPromise = uploadReceiptImageToStorage(
        rec.id,
        rec.fileName,
        imagePayload,
        rec.fileType || 'image/jpeg'
      ).catch((storageErr) => {
        console.warn('[Cloud Storage Upload] Notice:', storageErr);
        return null;
      });

      // PHASE 3 & 4: Automatic temporary OCR preparation for Gemini
      // Creates an in-memory lightweight copy (max 1600px, 0.85 quality) for OCR speed while preserving original file
      const ocrImagePayload = await prepareTemporaryOcrImage(imagePayload, rec.fileType || 'image/jpeg');
      const ocrMimeType = getPayloadMimeType(ocrImagePayload, rec.fileType || 'image/jpeg');

      // Gemini Extraction Request with AbortController timeout
      console.log(`[Queue] [Worker ${workerId}] Gemini OCR request started for ${rec.id}`);
      const response = await fetch('/api/extract-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          base64Data: ocrImagePayload,
          // Sending the image twice nearly doubles every request and can push
          // camera photos past the server's body-size limit.
          mimeType: ocrMimeType,
          fileName: rec.fileName,
        }),
      });

      clearTimeout(timeoutHandle);

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const err = new Error(errBody.error || `Extraction failed with server status ${response.status}`);
        (err as any).failedModel = errBody.failed_model || errBody.modelUsed || 'gemini-3.8-flash';
        (err as any).isQuotaError = Boolean(errBody.isQuotaError);
        (err as any).isRetryable = Boolean(errBody.isRetryable);
        throw err;
      }

      const extractResult = await response.json();
      console.log(`[Queue] [Worker ${workerId}] Gemini request completed for ${rec.id}`);

      // Check if background storage upload settled, without blocking more than 2 seconds
      let cloudStoragePath = rec.storage_path || buildReceiptStoragePath(rec.id, rec.fileName);
      let cloudReceiptUrl = rec.imageUrl;

      const storageResult = await Promise.race([
        storageUploadPromise,
        new Promise<null>((res) => setTimeout(() => res(null), 2000)),
      ]);
      if (storageResult) {
        cloudStoragePath = storageResult.storagePath;
        cloudReceiptUrl = storageResult.receiptUrl;
      }

      const extractedData: ReceiptData = extractResult.data || extractResult.result?.data;
      const confidences: Record<string, number> = extractResult.confidenceScores || extractResult.fieldConfidences || extractResult.result?.fieldConfidences || {};
      const overallConf = extractResult.overallConfidence ?? extractResult.result?.overallConfidence ?? 0.88;
      const uncertainFields: string[] = extractResult.uncertainFields || extractResult.result?.uncertainFields || [];

      // Check duplicates against current records in state
      const dupCheck = checkForDuplicates(extractedData, recordsRef.current, rec.id);

      // Determine review necessity
      const reviewFields = extractResult.fields_needing_review || extractResult.result?.fields_needing_review || [];
      const isNeedsReview =
        overallConf < settings.confidenceThreshold ||
        uncertainFields.length > 0 ||
        reviewFields.length > 0 ||
        dupCheck.isDuplicate ||
        !extractedData?.amount_received ||
        !extractedData?.receipt_no;

      const extractedModel =
        extractResult.modelUsed ||
        extractResult.debugInfo?.modelUsed ||
        extractResult.result?.debugInfo?.modelUsed ||
        'gemini-2.5-flash';

      const finalStatus: ExtractionStatus = isNeedsReview ? 'needs_review' : 'approved';
      const paymentTransactions = extractResult.payment_transactions || extractResult.result?.payment_transactions || extractedData?.payment_transactions || [];

      const updatedRecord: ReceiptRecord = {
        ...rec,
        receipt_record_id: rec.id,
        storage_path: cloudStoragePath,
        receipt_url: cloudReceiptUrl || rec.imageUrl,
        imageUrl: cloudReceiptUrl || rec.imageUrl,
        original_file_name: rec.fileName,
        mime_type: rec.fileType || 'image/jpeg',
        file_size: rec.fileSize,
        processing_status: finalStatus,
        status: finalStatus,
        data: extractedData,
        payment_transactions: paymentTransactions,
        modelUsed: extractedModel,
        isEscalated: extractResult.isEscalated || extractResult.debugInfo?.isEscalated,
        overallConfidence: overallConf,
        uncertainFields: uncertainFields as any,
        fieldConfidences: confidences as any,
        extractionNotes: extractResult.notes || extractResult.result?.extractionNotes,
        debugInfo: extractResult.debugInfo || extractResult.result?.debugInfo,
        isDuplicate: dupCheck.isDuplicate,
        duplicateOfId: dupCheck.duplicateOfId,
        duplicateReason: dupCheck.reason,
        isReviewed: !isNeedsReview,
        reviewedBy: !isNeedsReview ? settings.currentUser : undefined,
        reviewedAt: !isNeedsReview ? new Date().toISOString() : undefined,
        approved_at: !isNeedsReview ? new Date().toISOString() : undefined,
        errorReason: undefined,
        processing_error: undefined,
        updated_at: new Date().toISOString(),
      };

      // PHASE 9: Immediate UI Update per receipt
      recordsRef.current = recordsRef.current.map((r) => (r.id === recordId ? updatedRecord : r));
      setRecords((prev) => prev.map((r) => (r.id === recordId ? updatedRecord : r)));
      await saveRecord(updatedRecord);

      // Storage is intentionally allowed to finish after OCR. When that
      // happens, persist the real Cloud Storage URL as a follow-up instead of
      // leaving the base64 payload in the record/Firestore document.
      void storageUploadPromise.then(async (lateStorageResult) => {
        if (!lateStorageResult) return;
        const currentRecord = recordsRef.current.find((r) => r.id === recordId);
        if (!currentRecord) return;
        const cloudRecord: ReceiptRecord = {
          ...currentRecord,
          storage_path: lateStorageResult.storagePath,
          receipt_url: lateStorageResult.receiptUrl,
          imageUrl: lateStorageResult.receiptUrl,
          updated_at: new Date().toISOString(),
        };
        recordsRef.current = recordsRef.current.map((r) => (r.id === recordId ? cloudRecord : r));
        setRecords((prev) => prev.map((r) => (r.id === recordId ? cloudRecord : r)));
        await saveRecord(cloudRecord);
      });
      console.log(`[Queue] [Worker ${workerId}] Receipt completed: ${rec.id} -> ${finalStatus}`);

    } catch (err: any) {
      clearTimeout(timeoutHandle);
      const isTimeout = err.name === 'AbortError' || err.message?.includes('aborted');
      let errorMsg = isTimeout
        ? `Extraction timed out after ${EXTRACTION_TIMEOUT_MS / 1000}s`
        : err.message || 'Gemini extraction failed';

      // Format clean user-friendly message for 429 quota or JSON blobs
      if (err.isQuotaError || /429|resource_exhausted|quota exceeded/i.test(errorMsg)) {
        errorMsg = 'Gemini API rate limit or free tier quota reached. Fallbacks attempted. Please retry in a moment.';
        showToast('Gemini API quota/rate-limit reached. Please retry in a moment.', 'error');
      }
      const failedModel = err.failedModel || rec.modelUsed || 'gemini-3.8-flash';

      console.error(`[Queue] [Worker ${workerId}] Receipt failed for ${rec.id} (Model: ${failedModel}):`, errorMsg);

      const failedRecord: ReceiptRecord = {
        ...rec,
        status: 'failed',
        processing_status: 'failed',
        modelUsed: failedModel,
        errorReason: errorMsg,
        extractionNotes: `Extraction error (${failedModel}): ${errorMsg}`,
        debugInfo: {
          ...(rec.debugInfo || {}),
          modelUsed: failedModel,
          errorMessage: errorMsg,
          errorTimestamp: new Date().toISOString(),
          extractionTimestamp: rec.debugInfo?.extractionTimestamp || new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      };

      recordsRef.current = recordsRef.current.map((r) => (r.id === recordId ? failedRecord : r));
      setRecords((prev) => prev.map((r) => (r.id === recordId ? failedRecord : r)));
      await saveRecord(failedRecord);

    } finally {
      clearTimeout(timeoutHandle);

      // Update current batch counters immediately
      const activeBatch = targetBatch || currentBatchRef.current;
      if (activeBatch) {
        const batchRecords = recordsRef.current.filter((r) => r.batchId === activeBatch.id);
        const updatedBatch: BatchInfo = {
          ...activeBatch,
          processedCount: batchRecords.filter((r) => r.status !== 'pending' && r.status !== 'processing').length,
          needsReviewCount: batchRecords.filter((r) => r.status === 'needs_review').length,
          approvedCount: batchRecords.filter((r) => r.status === 'approved').length,
          status: batchRecords.some((r) => r.status === 'pending' || r.status === 'processing') ? 'processing' : 'completed',
        };
        setBatches((prev) => prev.map((b) => (b.id === updatedBatch.id ? updatedBatch : b)));
        setCurrentBatch(updatedBatch);
        await saveBatch(updatedBatch);
      }
    }
  };

  // Re-run single extraction with complete state updates
  const handleReprocessSingle = async (record: ReceiptRecord) => {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    // 1. Mark as processing in DB & UI
    const processingRecord: ReceiptRecord = {
      ...record,
      status: 'processing',
      processing_status: 'processing',
      errorReason: undefined,
    };
    await handleSaveRecord(processingRecord);

    try {
      // Resolve image payload with sample fallback if necessary
      let imagePayload = record.imageUrl;
      if (!imagePayload || imagePayload.length < 50) {
        throw new Error('Receipt image is unavailable. Please upload the original receipt again.');
      }

      const ocrPayload = await prepareTemporaryOcrImage(imagePayload, record.fileType || 'image/jpeg');
      const ocrMimeType = getPayloadMimeType(ocrPayload, record.fileType || 'image/jpeg');
      const abortController = new AbortController();
      timeoutHandle = setTimeout(() => abortController.abort(), EXTRACTION_TIMEOUT_MS);

      const response = await fetch('/api/extract-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          base64Data: ocrPayload,
          mimeType: ocrMimeType,
          fileName: record.fileName,
        }),
      });
      clearTimeout(timeoutHandle);
      timeoutHandle = undefined;

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const err = new Error(errJson.error || errJson.error_message || `Server extraction failed (${response.status})`);
        (err as any).failedModel = errJson.failed_model || errJson.modelUsed || 'gemini-2.5-flash';
        (err as any).isQuotaError = Boolean(errJson.isQuotaError);
        throw err;
      }

      const res = await response.json();
      const extractedData: ReceiptData = res.data || res.result?.data;
      const dupCheck = checkForDuplicates(extractedData, recordsRef.current, record.id);
      const overallConf = res.overallConfidence ?? res.result?.overallConfidence ?? 0.88;
      const uncertainFields = res.uncertainFields || res.result?.uncertainFields || [];

      const reviewFields = res.fields_needing_review || res.result?.fields_needing_review || [];
      const isNeedsReview =
        overallConf < settings.confidenceThreshold ||
        uncertainFields.length > 0 ||
        reviewFields.length > 0 ||
        dupCheck.isDuplicate ||
        !extractedData?.amount_received ||
        !extractedData?.receipt_no;

      const extractedModel =
        res.modelUsed ||
        res.debugInfo?.modelUsed ||
        res.result?.debugInfo?.modelUsed ||
        'gemini-2.5-flash';

      const paymentTransactions = res.payment_transactions || res.result?.payment_transactions || extractedData?.payment_transactions || [];

      const updated: ReceiptRecord = {
        ...record,
        imageUrl: imagePayload || record.imageUrl,
        status: isNeedsReview ? 'needs_review' : 'approved',
        processing_status: isNeedsReview ? 'needs_review' : 'approved',
        data: extractedData,
        payment_transactions: paymentTransactions,
        modelUsed: extractedModel,
        isEscalated: res.isEscalated || res.debugInfo?.isEscalated,
        overallConfidence: overallConf,
        uncertainFields: uncertainFields as any,
        fieldConfidences: res.confidenceScores || res.fieldConfidences || res.result?.fieldConfidences || {},
        extractionNotes: res.notes || res.result?.extractionNotes,
        debugInfo: res.debugInfo || res.result?.debugInfo,
        isDuplicate: dupCheck.isDuplicate,
        duplicateOfId: dupCheck.duplicateOfId,
        duplicateReason: dupCheck.reason,
        errorReason: undefined,
      };

      await handleSaveRecord(updated);
      showToast('Receipt reprocessed successfully', 'success');
    } catch (err: any) {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      console.error('[Reprocess error]', err);
      const failedModel = err.failedModel || record.modelUsed || 'gemini-2.5-flash';
      const failedRecord: ReceiptRecord = {
        ...record,
        status: 'failed',
        processing_status: 'failed',
        modelUsed: failedModel,
        errorReason: err.message,
        extractionNotes: `Reprocess failed (${failedModel}): ${err.message}`,
        debugInfo: {
          ...(record.debugInfo || {}),
          modelUsed: failedModel,
          errorMessage: err.message,
          errorTimestamp: new Date().toISOString(),
          extractionTimestamp: record.debugInfo?.extractionTimestamp || new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      };
      await handleSaveRecord(failedRecord);
      showToast(`Reprocess error (${failedModel}): ${err.message}`, 'error');
    }
  };

  // Save record changes
  const handleSaveRecord = async (updated: ReceiptRecord) => {
    const next = records.map((r) => (r.id === updated.id ? updated : r));
    setRecords(next);
    await saveRecord(updated);
  };

  // Approve Record
  const handleApproveRecord = async (recordId: string, updatedData?: ReceiptData) => {
    const existing = records.find((r) => r.id === recordId);
    if (!existing) return;

    const finalData = updatedData || existing.data;
    const updated: ReceiptRecord = {
      ...existing,
      status: 'approved',
      data: finalData,
      payment_transactions: finalData.payment_transactions || existing.payment_transactions || [],
      isReviewed: true,
      reviewedBy: settings.currentUser,
      reviewedAt: new Date().toISOString(),
      isDuplicate: false, // User explicitly approves it
      errorReason: undefined,
    };

    await handleSaveRecord(updated);
    showToast(`Receipt for ${updated.data.student_name || 'student'} approved`, 'success');
  };

  // Reject Record
  const handleRejectRecord = async (recordId: string, reason?: string) => {
    const existing = records.find((r) => r.id === recordId);
    if (!existing) return;

    const updated: ReceiptRecord = {
      ...existing,
      status: 'rejected',
      isReviewed: true,
      reviewedBy: settings.currentUser,
      reviewedAt: new Date().toISOString(),
      extractionNotes: reason ? `Rejected: ${reason}` : 'Rejected by reviewer',
    };

    await handleSaveRecord(updated);
    showToast(`Receipt marked as rejected`, 'info');
  };

  // Bulk Actions
  const handleBulkApprove = async (ids: string[]) => {
    const next = records.map((r) => {
      if (ids.includes(r.id)) {
        return {
          ...r,
          status: 'approved' as ExtractionStatus,
          isReviewed: true,
          reviewedBy: settings.currentUser,
          reviewedAt: new Date().toISOString(),
          isDuplicate: false,
          errorReason: undefined,
        };
      }
      return r;
    });
    setRecords(next);
    const approvedRecs = next.filter((r) => ids.includes(r.id));
    await saveBatchRecords(approvedRecs);
    showToast(`Bulk approved ${ids.length} receipts`, 'success');
  };

  const handleBulkDelete = async (ids: string[]) => {
    for (const id of ids) {
      await deleteRecordFromDB(id);
    }
    const next = records.filter((r) => !ids.includes(r.id));
    setRecords(next);
    showToast(`Deleted ${ids.length} records`, 'info');
  };

  const handleDeleteRecord = async (id: string) => {
    await deleteRecordFromDB(id);
    setRecords((prev) => prev.filter((r) => r.id !== id));
    if (reviewRecordId === id) {
      setReviewRecordId(null);
    }
    showToast('Record permanently deleted', 'info');
  };

  const handleDismissDuplicate = async (id: string) => {
    const existing = records.find((r) => r.id === id);
    if (!existing) return;
    const updated = { ...existing, isDuplicate: false, duplicateReason: undefined };
    await handleSaveRecord(updated);
    showToast('Duplicate flag cleared for this record', 'success');
  };

  const handleClearAllData = async () => {
    await clearAllRecordsFromDB();
    setRecords([]);
    setBatches([]);
    setCurrentBatch(null);
    showToast('Database reset and cleared', 'info');
  };

  const handleUpdateSettings = async (newSettings: AppSettings) => {
    setSettingsState(newSettings);
    await saveSettings(newSettings);
    showToast('Settings saved', 'success');
  };

  // Handle Google Sign In
  const handleGoogleSignIn = async () => {
    setAuthSubmitting(true);
    setAuthError(null);
    setAuthSuccess(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setAuthError(err?.message || 'Google authentication failed.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  // Handle Login / Sign Up / Reset Submit for Gate Screen
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    if (isResetMode) {
      if (!loginEmail) {
        setAuthError('Please enter your auditor email address.');
        return;
      }
      setAuthSubmitting(true);
      try {
        await resetPassword(loginEmail);
        setAuthSuccess('Password reset link sent! Please check your inbox.');
      } catch (err: any) {
        setAuthError(err?.message || 'Failed to send reset link.');
      } finally {
        setAuthSubmitting(false);
      }
      return;
    }

    if (!loginEmail || !loginPassword) {
      setAuthError('Please enter both email and password.');
      return;
    }
    setAuthSubmitting(true);
    try {
      if (isSignUpMode) {
        await signUp(loginEmail, loginPassword);
      } else {
        await signIn(loginEmail, loginPassword);
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  // Open review modal
  const handleOpenReview = (recordId: string) => {
    setReviewRecordId(recordId);
  };

  const activeReviewRecord = records.find((r) => r.id === reviewRecordId) || null;

  // Header Counters
  const pendingReviewCount = records.filter((r) => r.status === 'needs_review').length;
  const duplicateCount = records.filter((r) => r.isDuplicate).length;
  const processingCount = records.filter((r) => r.status === 'processing' || r.status === 'pending').length;

  // 1. Initial Auth Loading State
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-slate-400 font-mono">Verifying credentials...</p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated Login Gate Screen
  if (!user) {
    const isProviderDisabled = authError && authError.toLowerCase().includes('email/password sign-in is disabled');

    return (
      <div className="min-h-screen bg-[#090D16] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
              <KeyRound className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">HostelFlow Finance Portal</h1>
            <p className="text-xs text-slate-400">
              {isResetMode
                ? 'Send password recovery link to your auditor email'
                : 'Authorized access required for hostel receipt processing and finance records.'}
            </p>
          </div>

          {authError && (
            <div className="p-3.5 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-300 text-xs flex items-start space-x-2.5">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-left leading-relaxed">{authError}</div>
            </div>
          )}

          {authSuccess && (
            <div className="p-3.5 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-emerald-300 text-xs flex items-start space-x-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-left leading-relaxed">{authSuccess}</div>
            </div>
          )}

          {/* Dedicated Firebase Console Helper Card */}
          {isProviderDisabled && (
            <div className="p-4 bg-amber-950/40 border border-amber-800/60 rounded-2xl text-xs text-amber-200 space-y-2.5">
              <div className="flex items-center space-x-2 font-bold text-amber-300">
                <HelpCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Google Sign-In is Enabled:</span>
              </div>
              <p className="text-[11px] text-amber-200/90 leading-relaxed">
                Your Firebase project has <strong className="text-white">Google Sign-In enabled</strong>. Use the button below to sign in instantly with your auditor account.
              </p>
            </div>
          )}

          {/* One-Click Google Sign-In (Primary Supported Provider) */}
          {!isResetMode && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={authSubmitting}
                className="w-full py-3 bg-white hover:bg-slate-100 text-slate-900 rounded-xl text-xs font-bold transition shadow-lg shadow-black/30 disabled:opacity-50 flex items-center justify-center space-x-2.5 cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>Sign in with Google</span>
              </button>

              <div className="relative flex items-center justify-center pt-2">
                <div className="border-t border-slate-800 w-full"></div>
                <span className="bg-slate-900 px-3 text-[10px] text-slate-500 uppercase tracking-widest font-semibold">or email & password</span>
              </div>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Auditor Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="auditor@hostel.edu"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {!isResetMode && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Password
                  </label>
                  {!isSignUpMode && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsResetMode(true);
                        setAuthError(null);
                        setAuthSuccess(null);
                      }}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                {isSignUpMode && (
                  <p className="text-[10px] text-slate-400 mt-1">Minimum 6 characters required</p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/20 disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              <LogIn className="w-4 h-4" />
              <span>
                {authSubmitting
                  ? 'Authenticating...'
                  : isResetMode
                  ? 'Send Password Reset Link'
                  : isSignUpMode
                  ? 'Create Auditor Account'
                  : 'Sign In'}
              </span>
            </button>
          </form>

          <div className="text-center pt-2">
            {isResetMode ? (
              <button
                type="button"
                onClick={() => {
                  setIsResetMode(false);
                  setAuthError(null);
                  setAuthSuccess(null);
                }}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition"
              >
                ← Back to sign in
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsSignUpMode(!isSignUpMode);
                  setAuthError(null);
                  setAuthSuccess(null);
                }}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition"
              >
                {isSignUpMode ? 'Already have an account? Sign in' : 'Need an auditor account? Register here'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 3. Authenticated App UI (Runs when user != null)
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans">
      
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingReviewCount={pendingReviewCount}
        duplicateCount={duplicateCount}
        processingCount={processingCount}
        onOpenSampleModal={() => setIsSampleModalOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-4">
        
        {/* Firestore Quota Exceeded Notification Banner */}
        {quotaExceeded && !isQuotaNoticeDismissed && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start justify-between text-amber-900 shadow-sm animate-in fade-in duration-300">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <h4 className="text-xs font-bold text-amber-900">Firestore Free Tier Daily Write Quota Reached</h4>
                  <span className="px-2 py-0.5 bg-amber-200/80 text-amber-800 rounded-full text-[10px] font-semibold">Local Mode Active</span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed max-w-3xl">
                  The daily free write limit (20,000 writes/day on the Spark free tier) has been reached for project <code className="bg-amber-100 px-1 py-0.5 rounded text-[11px] font-mono">decisive-span-bq6d2</code>. Your data is <strong>safely saved to local IndexedDB</strong> and all receipt extractions, exports, and edits continue working normally. The cloud quota resets daily at midnight UTC.
                </p>
                <div className="pt-1 flex items-center space-x-3">
                  <a
                    href="https://console.firebase.google.com/project/decisive-span-bq6d2/firestore/databases/ai-studio-hostelreceiptaia-6aa837d2-aa0d-4aa6-933b-237f62c4f45e/data?openUpgradeDialog=true"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1.5 text-xs font-semibold text-amber-900 hover:text-amber-950 underline underline-offset-2"
                  >
                    <span>Open Firebase Console to upgrade quota</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <span className="text-amber-300">•</span>
                  <a
                    href="https://firebase.google.com/pricing#cloud-firestore"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-amber-700 hover:text-amber-900 underline underline-offset-2"
                  >
                    View Firestore Pricing &amp; Quotas
                  </a>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsQuotaNoticeDismissed(true)}
              className="text-amber-500 hover:text-amber-800 p-1 rounded-lg transition"
              title="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Toast alert */}
        {toastMessage && (
          <div
            className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold flex items-center space-x-2 transition-all ${
              toastMessage.type === 'success'
                ? 'bg-slate-900 text-emerald-400 border-slate-800'
                : toastMessage.type === 'error'
                ? 'bg-slate-900 text-rose-400 border-slate-800'
                : 'bg-slate-900 text-white border-slate-800'
            }`}
          >
            <span>{toastMessage.text}</span>
          </div>
        )}

        {/* View Switcher */}
        {activeTab === 'dashboard' && (
          <DashboardView
            records={records}
            batches={batches}
            setActiveTab={setActiveTab}
            onOpenReview={handleOpenReview}
            reconciliationSummary={reconSummary}
            onExportApproved={() => {
              const approved = records.filter((r) => r.status === 'approved');
              exportRecordsToExcel(approved, { includeReconciliationData: true });
            }}
          />
        )}

        {activeTab === 'upload' && (
          <UploadView
            onStartBatch={handleStartBatch}
            onOpenSampleModal={() => setIsSampleModalOpen(true)}
          />
        )}

        {activeTab === 'processing' && (
          <ProcessingQueueView
            currentBatch={currentBatch}
            records={records}
            isProcessing={isProcessingQueue}
            onPauseResume={() => {
              if (isProcessingQueue) {
                console.log('[Queue] Worker paused by user');
                isRunningRef.current = false;
                setIsProcessingQueue(false);
              } else {
                console.log('[Queue] Worker resumed by user');
                startOrResumeQueue(currentBatch);
              }
            }}
            onRetryFailed={async () => {
              const failed = records.filter((r) => r.status === 'failed');
              if (failed.length > 0) {
                console.log(`[Queue] Retrying ${failed.length} failed receipts...`);
                const resetFailed = failed.map((r) => ({
                  ...r,
                  status: 'pending' as ExtractionStatus,
                  processing_status: 'pending' as ExtractionStatus,
                  errorReason: undefined,
                }));
                const updated = records.map((r) => {
                  const match = resetFailed.find((rf) => rf.id === r.id);
                  return match || r;
                });
                setRecords(updated);
                await saveBatchRecords(resetFailed);
                startOrResumeQueue(currentBatch);
              } else {
                showToast('No failed records to retry', 'info');
              }
            }}
            onOpenReview={handleOpenReview}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'review' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Human Verification</span>
                </div>
                <h1 className="text-xl font-bold text-slate-900">
                  Review & Approval Queue ({pendingReviewCount})
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Side-by-side inspection with zoom and high contrast filters for low-confidence fields or missing values.
                </p>
              </div>
              {pendingReviewCount > 0 && (
                <span className="px-3 py-1 bg-amber-50 text-amber-700 text-xs font-semibold rounded-full border border-amber-200 self-start sm:self-auto">
                  {pendingReviewCount} Needs Review
                </span>
              )}
            </div>

            {pendingReviewCount === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center mb-3 text-lg font-bold border border-emerald-200">
                  ✓
                </div>
                <h2 className="text-base font-bold text-slate-900">Review Queue is Clear!</h2>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  All extracted receipts have passed automated checks or been approved by staff.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {records
                  .filter((r) => r.status === 'needs_review')
                  .map((r) => (
                    <div
                      key={r.id}
                      className="bg-white border border-slate-200 hover:border-indigo-300 rounded-2xl p-5 shadow-sm flex flex-col justify-between transition-all"
                    >
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-sm font-bold text-slate-900 truncate">
                            {r.data.student_name || r.fileName}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                            {Math.round(r.overallConfidence * 100)}% Conf
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1 font-medium">
                          {r.data.hostel_name || 'No hostel assigned'}
                        </div>
                        <div className="mt-4 p-3 bg-slate-50 rounded-xl space-y-1.5 text-xs text-slate-600 border border-slate-100">
                          <div className="flex justify-between"><span className="text-slate-400">Amount:</span> <span className="font-bold text-slate-800">₹{r.data.amount_received || 0}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Receipt #:</span> <span className="font-mono text-slate-700">{r.data.receipt_no || 'Missing'}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Date:</span> <span className="text-slate-700">{r.data.receipt_date || 'Missing'}</span></div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleOpenReview(r.id)}
                        className="mt-5 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200 transition"
                      >
                        Inspect & Review
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'records' && (
          <AllRecordsTable
            records={records}
            onOpenReview={handleOpenReview}
            onDeleteRecord={handleDeleteRecord}
            onBulkApprove={handleBulkApprove}
            onBulkDelete={handleBulkDelete}
          />
        )}

        {activeTab === 'duplicates' && (
          <DuplicatesView
            records={records}
            onOpenReview={handleOpenReview}
            onDismissDuplicate={handleDismissDuplicate}
            onDeleteRecord={handleDeleteRecord}
          />
        )}

        {activeTab === 'reconciliation' && (
          <ReconciliationView
            receipts={records}
            userEmail={user?.email || 'finance@hostelflow.com'}
            onViewReceipt={(receiptId) => handleOpenReview(receiptId)}
          />
        )}

        {activeTab === 'debug' && (
          <TestDebugView
            records={records}
            settings={settings}
            onSaveRecord={handleSaveRecord}
          />
        )}

        {activeTab === 'reports' && <ReportsView records={records} />}

        {activeTab === 'export' && <ExportView records={records} />}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onClearAllData={handleClearAllData}
            onLoadDefaultDemoData={() => loadDemoInitialData(settings)}
          />
        )}
      </main>

      {/* Side-by-Side Human Review Modal */}
      {activeReviewRecord && (
        <ReviewModal
          record={activeReviewRecord}
          allRecords={records}
          settings={settings}
          isOpen={true}
          onClose={() => setReviewRecordId(null)}
          onSaveRecord={handleSaveRecord}
          onApproveRecord={handleApproveRecord}
          onRejectRecord={handleRejectRecord}
          onReprocessRecord={handleReprocessSingle}
          onDeleteRecord={handleDeleteRecord}
          onNavigateRecord={(nextId) => setReviewRecordId(nextId)}
        />
      )}

      {/* Sample Receipts Modal */}
      <SampleReceiptsModal
        isOpen={isSampleModalOpen}
        onClose={() => setIsSampleModalOpen(false)}
        onSelectSampleForProcessing={(files) => {
          handleStartBatch(files, 'Batch #Sample - Realistic Hostel Receipts');
        }}
      />

      {/* Firebase Authentication & Auditor Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}

export default App;
