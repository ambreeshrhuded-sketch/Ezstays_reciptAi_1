import {
  auth,
  db,
  storage,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  orderBy,
  storageRef,
  uploadString,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from './config';
import { ReceiptRecord, BatchInfo, AppSettings, ExtractionStatus, ReceiptData } from '../types/receipt';
import { safeString } from '../utils/safeUtils';

const COLLECTION_RECEIPTS = 'receipts';
const COLLECTION_BATCHES = 'batches';
const COLLECTION_SETTINGS = 'settings';
const SETTINGS_DOC_ID = 'global_config';
const FIRESTORE_BATCH_CHUNK_SIZE = 25; // Safe chunk size well below Firestore 500 limit

/**
 * Builds the structured, collision-resistant Cloud Storage path:
 * receipts/{year}/{month}/{receiptRecordId}/{originalFileName}
 */
export function buildReceiptStoragePath(
  receiptRecordId: string,
  originalFileName: string,
  date: Date = new Date()
): string {
  const year = date.getFullYear().toString();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const safeName = originalFileName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'receipt.jpg';
  return `receipts/${year}/${month}/${receiptRecordId}/${safeName}`;
}

/**
 * Uploads a receipt image (base64 Data URL or File/Blob) to Cloud Storage
 * Returns the storage path and download/view URL, with graceful local fallback.
 */
export async function uploadReceiptImageToStorage(
  receiptRecordId: string,
  originalFileName: string,
  imagePayload: string | File | Blob,
  mimeType: string = 'image/jpeg'
): Promise<{ storagePath: string; receiptUrl: string }> {
  const fallbackUrl =
    typeof imagePayload === 'string'
      ? imagePayload.startsWith('data:')
        ? imagePayload
        : `data:${mimeType};base64,${imagePayload}`
      : '';

  // Storage rules require non-anonymous authenticated user. If not logged in, skip remote storage.
  if (!auth.currentUser || auth.currentUser.isAnonymous) {
    return {
      storagePath: buildReceiptStoragePath(receiptRecordId, originalFileName),
      receiptUrl: fallbackUrl,
    };
  }

  try {
    const storagePath = buildReceiptStoragePath(receiptRecordId, originalFileName);
    const fileRef = storageRef(storage, storagePath);

    if (typeof imagePayload === 'string') {
      if (imagePayload.startsWith('data:')) {
        // Base64 data URL format
        await uploadString(fileRef, imagePayload, 'data_url');
      } else {
        // Raw base64 string
        const formattedDataUrl = `data:${mimeType};base64,${imagePayload}`;
        await uploadString(fileRef, formattedDataUrl, 'data_url');
      }
    } else {
      // Blob or File object
      await uploadBytes(fileRef, imagePayload, { contentType: mimeType });
    }

    const receiptUrl = await getDownloadURL(fileRef);
    return { storagePath, receiptUrl };
  } catch (err: any) {
    console.warn(`[Firebase Storage] Upload notice for ${receiptRecordId}:`, err?.message || err);
    // Graceful fallback to local data URL so the app workflow never fails
    return {
      storagePath: buildReceiptStoragePath(receiptRecordId, originalFileName),
      receiptUrl: fallbackUrl,
    };
  }
}

/**
 * Maps a local/app ReceiptRecord to the Firestore document schema
 */
export function recordToFirestoreDoc(record: ReceiptRecord): Record<string, any> {
  const d = record.data || ({} as ReceiptData);
  const recordId = record.receipt_record_id || record.id;
  // Base64 is kept only in the browser's local cache. Firestore documents have
  // a 1 MiB limit, so persisting a camera image here can make the entire save
  // fail. The permanent image belongs in Cloud Storage.
  const receiptUrl = safeString(record.receipt_url);
  const firestoreReceiptUrl = receiptUrl.startsWith('data:') ? '' : receiptUrl;

  return {
    // Unique generated record ID
    receipt_record_id: recordId,
    
    // 33 standard fields
    hostel_name: safeString(d.hostel_name),
    final_hostel: safeString(d.final_hostel),
    entry_status: safeString(d.entry_status),
    old_new: safeString(d.old_new),
    knocked_by: safeString(d.knocked_by),
    room_no_bed_no: safeString(d.room_no_bed_no),
    final_status: safeString(d.final_status),
    student_id: safeString(d.student_id),
    receipt_no: safeString(d.receipt_no),
    nature: safeString(d.nature),
    student_name: safeString(d.student_name),
    student_phone_no: safeString(d.student_phone_no),
    student_id2: safeString(d.student_id2),
    father_name: safeString(d.father_name),
    father_phone_no: safeString(d.father_phone_no),
    address: safeString(d.address),
    college: safeString(d.college),
    course: safeString(d.course),
    year: safeString(d.year),
    room_type: safeString(d.room_type),
    total_fees: d.total_fees !== null && d.total_fees !== undefined ? Number(d.total_fees) : null,
    yearly_monthly: safeString(d.yearly_monthly),
    amount_received: d.amount_received !== null && d.amount_received !== undefined ? Number(d.amount_received) : null,
    cumulative_fee: d.cumulative_fee !== null && d.cumulative_fee !== undefined ? Number(d.cumulative_fee) : null,
    percentage_of_fees: safeString(d.percentage_of_fees),
    mode_of_receipt: safeString(d.mode_of_receipt),
    fees_channel: safeString(d.fees_channel),
    receipt_date: safeString(d.receipt_date),
    payment_ref_no: safeString(d.payment_ref_no),
    payment_date: safeString(d.payment_date),
    payment_month: safeString(d.payment_month),
    discount: d.discount !== null && d.discount !== undefined ? Number(d.discount) : null,
    remark: safeString(d.remark),

    // Extended receipt properties
    installment_no: safeString(d.installment_no),
    installment_no_raw: safeString(d.installment_no_raw),
    receipt_prefix: safeString(d.receipt_prefix),
    receipt_number_handwritten: safeString(d.receipt_number_handwritten),
    amount_received_words: safeString(d.amount_received_words),
    balance_amount: d.balance_amount !== null && d.balance_amount !== undefined ? Number(d.balance_amount) : null,
    next_installment_amount: d.next_installment_amount !== null && d.next_installment_amount !== undefined ? String(d.next_installment_amount) : '',
    next_due_date: safeString(d.next_due_date),
    bank_name: safeString(d.bank_name),
    ref: safeString(d.ref),
    payment_transactions: Array.isArray(record.payment_transactions)
      ? record.payment_transactions
      : Array.isArray(d.payment_transactions)
      ? d.payment_transactions
      : [],

    // Cloud storage & persistence references
    storage_path: record.storage_path || '',
    receipt_url: firestoreReceiptUrl,
    original_file_name: record.original_file_name || record.fileName || '',
    mime_type: record.mime_type || record.fileType || 'image/jpeg',
    file_size: record.file_size || record.fileSize || 0,
    processing_status: record.processing_status || record.status || 'pending',
    created_at: record.created_at || record.uploadedAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    approved_at: record.approved_at || (record.status === 'approved' ? new Date().toISOString() : null),
    rejected_at: record.rejected_at || (record.status === 'rejected' ? new Date().toISOString() : null),
    reviewed_by: record.reviewedBy || '',
    processing_error: record.processing_error || record.errorReason || '',

    // Internal applet metadata (preserved for review/audit)
    batch_id: record.batchId || '',
    overall_confidence: record.overallConfidence || 0,
    field_confidences: record.fieldConfidences || {},
    uncertain_fields: record.uncertainFields || [],
    extraction_notes: record.extractionNotes || '',
    model_used: record.modelUsed || '',
    is_escalated: !!record.isEscalated,
    is_duplicate: !!record.isDuplicate,
    duplicate_of_id: record.duplicateOfId || '',
    duplicate_reason: record.duplicateReason || '',
    is_reviewed: !!record.isReviewed,
    reviewed_at: record.reviewedAt || '',
    corrections_count: record.correctionsCount || 0,
    corrections_log: record.correctionsLog || [],
    validation_warnings: record.validationWarnings || [],
    debug_info: record.debugInfo || null,
  };
}

/**
 * Converts a Firestore document back into an in-app ReceiptRecord
 */
export function firestoreDocToRecord(docData: Record<string, any>, docId: string): ReceiptRecord {
  const recordId = docData.receipt_record_id || docId;

  const data: ReceiptData = {
    hostel_name: docData.hostel_name || '',
    final_hostel: docData.final_hostel || '',
    entry_status: docData.entry_status || '',
    old_new: docData.old_new || '',
    knocked_by: docData.knocked_by || '',
    room_no_bed_no: docData.room_no_bed_no || '',
    final_status: docData.final_status || '',
    student_id: docData.student_id || '',
    receipt_no: docData.receipt_no || '',
    nature: docData.nature || 'Hostel Fee',
    student_name: docData.student_name || '',
    student_phone_no: docData.student_phone_no || '',
    student_id2: docData.student_id2 || '',
    father_name: docData.father_name || '',
    father_phone_no: docData.father_phone_no || '',
    address: docData.address || '',
    college: docData.college || '',
    course: docData.course || '',
    year: docData.year || '',
    room_type: docData.room_type || '',
    total_fees: docData.total_fees !== undefined && docData.total_fees !== null ? Number(docData.total_fees) : null,
    yearly_monthly: docData.yearly_monthly || '',
    amount_received: docData.amount_received !== undefined && docData.amount_received !== null ? Number(docData.amount_received) : null,
    cumulative_fee: docData.cumulative_fee !== undefined && docData.cumulative_fee !== null ? Number(docData.cumulative_fee) : null,
    percentage_of_fees: docData.percentage_of_fees || '',
    mode_of_receipt: docData.mode_of_receipt || '',
    fees_channel: docData.fees_channel || '',
    receipt_date: docData.receipt_date || '',
    payment_ref_no: docData.payment_ref_no || '',
    payment_date: docData.payment_date || '',
    payment_month: docData.payment_month || '',
    discount: docData.discount !== undefined && docData.discount !== null ? Number(docData.discount) : null,
    remark: docData.remark || '',

    installment_no: docData.installment_no || '',
    installment_no_raw: docData.installment_no_raw || '',
    receipt_prefix: docData.receipt_prefix || '',
    receipt_number_handwritten: docData.receipt_number_handwritten || '',
    amount_received_words: docData.amount_received_words || '',
    balance_amount: docData.balance_amount !== undefined && docData.balance_amount !== null ? Number(docData.balance_amount) : null,
    next_installment_amount: docData.next_installment_amount || '',
    next_due_date: docData.next_due_date || '',
    bank_name: docData.bank_name || '',
    ref: docData.ref || '',
    payment_transactions: Array.isArray(docData.payment_transactions) ? docData.payment_transactions : [],
  };

  const status: ExtractionStatus = (docData.processing_status || docData.status || 'pending') as ExtractionStatus;

  return {
    id: recordId,
    batchId: docData.batch_id || '',
    fileName: docData.original_file_name || docData.fileName || 'receipt.jpg',
    fileSize: docData.file_size || 0,
    fileType: docData.mime_type || 'image/jpeg',
    imageUrl: docData.receipt_url || '',
    uploadedAt: docData.created_at || new Date().toISOString(),
    status,
    payment_transactions: Array.isArray(docData.payment_transactions) ? docData.payment_transactions : [],
    overallConfidence: docData.overall_confidence || 0,
    fieldConfidences: docData.field_confidences || {},
    uncertainFields: docData.uncertain_fields || [],
    extractionNotes: docData.extraction_notes || '',
    errorReason: docData.processing_error || undefined,
    data,
    
    // Cloud storage & persistence fields
    receipt_record_id: recordId,
    storage_path: docData.storage_path || '',
    receipt_url: docData.receipt_url || '',
    original_file_name: docData.original_file_name || '',
    mime_type: docData.mime_type || '',
    file_size: docData.file_size || 0,
    processing_status: status,
    created_at: docData.created_at || '',
    updated_at: docData.updated_at || '',
    approved_at: docData.approved_at || undefined,
    rejected_at: docData.rejected_at || undefined,
    processing_error: docData.processing_error || '',

    modelUsed: docData.model_used || '',
    isEscalated: !!docData.is_escalated,
    isDuplicate: !!docData.is_duplicate,
    duplicateOfId: docData.duplicate_of_id || '',
    duplicateReason: docData.duplicate_reason || '',
    isReviewed: !!docData.is_reviewed,
    reviewedBy: docData.reviewed_by || '',
    reviewedAt: docData.reviewed_at || '',
    correctionsCount: docData.corrections_count || 0,
    correctionsLog: docData.corrections_log || [],
    validationWarnings: docData.validation_warnings || [],
    debugInfo: docData.debug_info || undefined,
  };
}

// Firestore Quota exhaustion tracking state with daily persistence
const QUOTA_STORAGE_KEY = 'firestore_quota_exhausted_date';

function getTodayDateString(): string {
  try {
    return new Date().toISOString().split('T')[0];
  } catch {
    return '';
  }
}

function checkInitialQuotaState(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    const storedDate = localStorage.getItem(QUOTA_STORAGE_KEY);
    return storedDate === getTodayDateString();
  } catch {
    return false;
  }
}

let isFirestoreQuotaExhausted = checkInitialQuotaState();
let quotaExhaustionListeners: Array<(exhausted: boolean) => void> = [];

export function isQuotaExhausted(): boolean {
  return isFirestoreQuotaExhausted;
}

export function subscribeToQuotaExhaustion(listener: (exhausted: boolean) => void): () => void {
  quotaExhaustionListeners.push(listener);
  if (isFirestoreQuotaExhausted) {
    listener(true);
  }
  return () => {
    quotaExhaustionListeners = quotaExhaustionListeners.filter((l) => l !== listener);
  };
}

export function resetQuotaExhaustionState() {
  isFirestoreQuotaExhausted = false;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.removeItem(QUOTA_STORAGE_KEY);
    } catch {}
  }
  quotaExhaustionListeners.forEach((l) => l(false));
}

function notifyQuotaExhausted() {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(QUOTA_STORAGE_KEY, getTodayDateString());
    } catch {}
  }
  if (!isFirestoreQuotaExhausted) {
    isFirestoreQuotaExhausted = true;
    console.warn(
      '[Firestore] Free daily write quota reached (20,000 writes/day). Seamlessly falling back to local storage.'
    );
    quotaExhaustionListeners.forEach((l) => l(true));
  }
}

function isQuotaError(err: any): boolean {
  const msg = err?.message || String(err || '');
  const code = err?.code || '';
  return (
    code === 'resource-exhausted' ||
    msg.includes('resource-exhausted') ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Free daily write units') ||
    msg.includes('Free daily read units') ||
    msg.includes('quota metric') ||
    msg.includes('Quota exceeded')
  );
}

/**
 * Saves or updates a single receipt record in Firestore
 */
export async function saveRecordToFirestore(record: ReceiptRecord): Promise<void> {
  if (isFirestoreQuotaExhausted) {
    return; // Operating in resilient local mode
  }

  try {
    const recordId = record.receipt_record_id || record.id;
    if (!recordId) {
      console.warn('Cannot save record: missing receipt_record_id');
      return;
    }
    const docRef = doc(db, COLLECTION_RECEIPTS, recordId);
    const firestoreData = recordToFirestoreDoc(record);
    await setDoc(docRef, firestoreData, { merge: true });
  } catch (err: any) {
    if (isQuotaError(err)) {
      notifyQuotaExhausted();
      return;
    }
    console.warn(`[Firestore] Failed to save record ${record.id}:`, err);
  }
}

/**
 * Saves multiple records to Firestore using chunked writeBatch()
 * Respects safe batch size limits and prevents write flooding.
 */
export async function saveBatchRecordsToFirestore(records: ReceiptRecord[]): Promise<void> {
  if (!records || records.length === 0 || isFirestoreQuotaExhausted) return;

  try {
    // Process in chunks of FIRESTORE_BATCH_CHUNK_SIZE
    for (let i = 0; i < records.length; i += FIRESTORE_BATCH_CHUNK_SIZE) {
      const chunk = records.slice(i, i + FIRESTORE_BATCH_CHUNK_SIZE);
      const batch = writeBatch(db);

      for (const rec of chunk) {
        const recordId = rec.receipt_record_id || rec.id;
        if (recordId) {
          const docRef = doc(db, COLLECTION_RECEIPTS, recordId);
          batch.set(docRef, recordToFirestoreDoc(rec), { merge: true });
        }
      }

      await batch.commit();
    }
  } catch (err: any) {
    if (isQuotaError(err)) {
      notifyQuotaExhausted();
      return;
    }
    console.warn('[Firestore] writeBatch error:', err);
  }
}

/**
 * Loads all receipt records from Firestore as the permanent source of truth
 */
export async function loadAllRecordsFromFirestore(): Promise<ReceiptRecord[]> {
  if (isFirestoreQuotaExhausted) {
    return [];
  }
  try {
    if (!auth.currentUser || auth.currentUser.isAnonymous) {
      return [];
    }

    const colRef = collection(db, COLLECTION_RECEIPTS);
    const snapshot = await getDocs(colRef);
    const records: ReceiptRecord[] = [];

    snapshot.forEach((d) => {
      const data = d.data();
      records.push(firestoreDocToRecord(data, d.id));
    });

    // Sort newest first
    records.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    return records;
  } catch (err: any) {
    if (isQuotaError(err)) {
      notifyQuotaExhausted();
      return [];
    }
    console.warn('[Firestore] Failed to load records:', err);
    return [];
  }
}

/**
 * Deletes a receipt record from Firestore and deletes its file in Cloud Storage
 */
export async function deleteRecordFromFirestore(recordId: string, storagePath?: string): Promise<void> {
  if (isFirestoreQuotaExhausted) {
    return;
  }
  try {
    const docRef = doc(db, COLLECTION_RECEIPTS, recordId);
    await deleteDoc(docRef);

    if (storagePath) {
      try {
        const fileRef = storageRef(storage, storagePath);
        await deleteObject(fileRef);
      } catch (storageErr) {
        console.warn(`[Cloud Storage] Could not delete file ${storagePath}:`, storageErr);
      }
    }
  } catch (err: any) {
    if (isQuotaError(err)) {
      notifyQuotaExhausted();
      return;
    }
    console.warn(`[Firestore] Failed to delete record ${recordId}:`, err);
  }
}

/**
 * Batch management in Firestore
 */
export async function saveBatchToFirestore(batch: BatchInfo): Promise<void> {
  if (isFirestoreQuotaExhausted) return;
  try {
    const docRef = doc(db, COLLECTION_BATCHES, batch.id);
    await setDoc(docRef, { ...batch, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err: any) {
    if (isQuotaError(err)) {
      notifyQuotaExhausted();
      return;
    }
    console.warn(`[Firestore] Failed to save batch ${batch.id}:`, err);
  }
}

export async function loadAllBatchesFromFirestore(): Promise<BatchInfo[]> {
  if (isFirestoreQuotaExhausted) return [];
  try {
    if (!auth.currentUser || auth.currentUser.isAnonymous) {
      return [];
    }
    const colRef = collection(db, COLLECTION_BATCHES);
    const snapshot = await getDocs(colRef);
    const batches: BatchInfo[] = [];
    snapshot.forEach((d) => {
      batches.push(d.data() as BatchInfo);
    });
    batches.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return batches;
  } catch (err: any) {
    if (isQuotaError(err)) {
      notifyQuotaExhausted();
      return [];
    }
    console.warn('[Firestore] Failed to load batches:', err);
    return [];
  }
}

/**
 * App Settings persistence in Firestore
 */
export async function saveSettingsToFirestore(settings: AppSettings): Promise<void> {
  if (isFirestoreQuotaExhausted) return;
  try {
    const docRef = doc(db, COLLECTION_SETTINGS, SETTINGS_DOC_ID);
    await setDoc(docRef, { ...settings, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err: any) {
    if (isQuotaError(err)) {
      notifyQuotaExhausted();
      return;
    }
    console.warn('[Firestore] Failed to save settings to Firestore:', err);
  }
}

export async function loadSettingsFromFirestore(): Promise<AppSettings | null> {
  if (isFirestoreQuotaExhausted) return null;
  try {
    if (!auth.currentUser || auth.currentUser.isAnonymous) {
      return null;
    }
    const docRef = doc(db, COLLECTION_SETTINGS, SETTINGS_DOC_ID);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as AppSettings;
    }
  } catch (err: any) {
    if (isQuotaError(err)) {
      notifyQuotaExhausted();
      return null;
    }
    console.warn('[Firestore] Failed to load settings from Firestore:', err);
  }
  return null;
}
