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
  storageRef,
  uploadBytes,
  getDownloadURL,
} from './config';
import {
  BankStatementRecord,
  BankTransactionRecord,
  ReceiptPaymentRecord,
  ReconciliationRecord,
  ReconciliationAuditLog,
  MatchType,
} from '../types/reconciliation';
import { ReceiptRecord } from '../types/receipt';
import { normalizeReference, normalizeAmount, normalizeDateToISO } from '../utils/reconciliationMatcher';
import { safeString } from '../utils/safeUtils';
import { saveRecordToFirestore } from './receiptStore';

const DB_NAME = 'hostelflow_phase2_db';
const DB_VERSION = 1;
const STORE_STATEMENTS = 'bank_statements';
const STORE_TRANSACTIONS = 'bank_transactions';
const STORE_RECEIPT_PAYMENTS = 'receipt_payments';
const STORE_RECONCILIATIONS = 'reconciliations';
const STORE_AUDIT_LOGS = 'audit_logs';

const FIRESTORE_CHUNK_SIZE = 25;

// ==================== IndexedDB Local Cache ====================

function openPhase2DB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_STATEMENTS)) {
        db.createObjectStore(STORE_STATEMENTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_TRANSACTIONS)) {
        db.createObjectStore(STORE_TRANSACTIONS, { keyPath: 'bank_transaction_id' });
      }
      if (!db.objectStoreNames.contains(STORE_RECEIPT_PAYMENTS)) {
        db.createObjectStore(STORE_RECEIPT_PAYMENTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_RECONCILIATIONS)) {
        db.createObjectStore(STORE_RECONCILIATIONS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_AUDIT_LOGS)) {
        db.createObjectStore(STORE_AUDIT_LOGS, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getFromStore<T>(storeName: string): Promise<T[]> {
  try {
    const idb = await openPhase2DB();
    return new Promise((resolve) => {
      const tx = idb.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

async function putToStore<T>(storeName: string, items: T[]): Promise<void> {
  try {
    const idb = await openPhase2DB();
    const tx = idb.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    for (const item of items) {
      store.put(item);
    }
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

// ==================== Storage Helper ====================

export async function uploadBankStatementFile(
  file: File | Blob,
  statementId: string,
  fileName: string
): Promise<{ storagePath: string; fileUrl: string }> {
  const date = new Date();
  const year = date.getFullYear().toString();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'statement.xlsx';
  const path = `bank_statements/${year}/${month}/${statementId}/${safeName}`;

  if (!auth.currentUser || auth.currentUser.isAnonymous) {
    return { storagePath: path, fileUrl: '' };
  }

  try {
    const fileRef = storageRef(storage, path);
    await uploadBytes(fileRef, file);
    const fileUrl = await getDownloadURL(fileRef);
    return { storagePath: path, fileUrl };
  } catch (err) {
    console.warn('[Storage] Bank statement upload error:', err);
    return { storagePath: path, fileUrl: '' };
  }
}

// ==================== Bank Statements ====================

export async function saveBankStatement(statement: BankStatementRecord): Promise<void> {
  await putToStore(STORE_STATEMENTS, [statement]);
  if (auth.currentUser && !auth.currentUser.isAnonymous) {
    try {
      const docRef = doc(db, 'bankStatements', statement.id);
      await setDoc(docRef, statement, { merge: true });
    } catch (err) {
      console.warn('[Firestore] saveBankStatement error:', err);
    }
  }
}

export async function getAllBankStatements(): Promise<BankStatementRecord[]> {
  const local = await getFromStore<BankStatementRecord>(STORE_STATEMENTS);
  if (auth.currentUser && !auth.currentUser.isAnonymous) {
    try {
      const colRef = collection(db, 'bankStatements');
      const snap = await getDocs(colRef);
      if (!snap.empty) {
        const remote = snap.docs.map((d) => d.data() as BankStatementRecord);
        await putToStore(STORE_STATEMENTS, remote);
        return remote;
      }
    } catch (err) {
      console.warn('[Firestore] getAllBankStatements fallback:', err);
    }
  }
  return local;
}

// ==================== Bank Transactions ====================

export async function saveBankTransactions(transactions: BankTransactionRecord[]): Promise<void> {
  if (!transactions || transactions.length === 0) return;
  await putToStore(STORE_TRANSACTIONS, transactions);

  if (auth.currentUser && !auth.currentUser.isAnonymous) {
    try {
      for (let i = 0; i < transactions.length; i += FIRESTORE_CHUNK_SIZE) {
        const chunk = transactions.slice(i, i + FIRESTORE_CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((tx) => {
          const docRef = doc(db, 'bankTransactions', tx.bank_transaction_id);
          batch.set(docRef, tx, { merge: true });
        });
        await batch.commit();
      }
    } catch (err) {
      console.warn('[Firestore] saveBankTransactions batch error:', err);
    }
  }
}

export async function getAllBankTransactions(): Promise<BankTransactionRecord[]> {
  const local = await getFromStore<BankTransactionRecord>(STORE_TRANSACTIONS);
  if (auth.currentUser && !auth.currentUser.isAnonymous) {
    try {
      const colRef = collection(db, 'bankTransactions');
      const snap = await getDocs(colRef);
      if (!snap.empty) {
        const remote = snap.docs.map((d) => d.data() as BankTransactionRecord);
        await putToStore(STORE_TRANSACTIONS, remote);
        return remote;
      }
    } catch (err) {
      console.warn('[Firestore] getAllBankTransactions fallback:', err);
    }
  }
  return local;
}

// ==================== Receipt Payments Normalization ====================

/**
 * Normalizes Phase 1 ReceiptRecords into ReceiptPaymentRecords.
 * Crucial: 1 physical receipt can have multiple payment split rows.
 * Each split gets its own ReceiptPaymentRecord with references to parent receipt.
 */
export function normalizeReceiptsToPayments(
  receipts: ReceiptRecord[],
  existingPayments: ReceiptPaymentRecord[] = []
): ReceiptPaymentRecord[] {
  const existingMap = new Map(existingPayments.map((p) => [p.id, p]));
  const result: ReceiptPaymentRecord[] = [];

  receipts.forEach((rec) => {
    const d = rec.data || ({} as any);
    const rawUrl = rec.receipt_url || rec.imageUrl || '';

    // Check for payment splits
    const splits =
      Array.isArray(rec.payment_transactions) && rec.payment_transactions.length > 0
        ? rec.payment_transactions
        : Array.isArray(d.payment_transactions) && d.payment_transactions.length > 0
        ? d.payment_transactions
        : null;

    if (splits && splits.length > 1) {
      splits.forEach((split, idx) => {
        const paymentId = `${rec.id}_split_${idx}`;
        const existing = existingMap.get(paymentId);

        const amt = split.amount !== null && split.amount !== undefined ? split.amount : d.amount_received || 0;
        const refNo = safeString(split.payment_ref_no) || safeString(d.payment_ref_no);
        const pDate = safeString(split.payment_date) || safeString(d.payment_date) || safeString(d.receipt_date);
        const natureVal = safeString(split.nature) || safeString(d.nature) || 'Installment';
        const modeVal = safeString(split.payment_mode) || safeString(d.mode_of_receipt) || 'UPI';

        const paymentRecord: ReceiptPaymentRecord = {
          id: paymentId,
          receipt_id: rec.id,
          receipt_record_id: rec.receipt_record_id || rec.id,
          hostel_name: safeString(d.hostel_name),
          student_id: safeString(d.student_id),
          student_name: safeString(d.student_name),
          receipt_no: safeString(d.receipt_no),
          nature: natureVal,
          amount_received: amt,
          mode_of_receipt: modeVal,
          fees_channel: safeString(split.fees_channel) || safeString(d.fees_channel),
          receipt_date: safeString(d.receipt_date),
          payment_ref_no: refNo,
          payment_date: pDate,
          payment_month: safeString(split.payment_month) || safeString(d.payment_month),
          receipt_link: rawUrl,
          receipt_image_url: rawUrl,
          normalized_ref: normalizeReference(refNo),
          normalized_amount: normalizeAmount(amt),
          reconciliation_status: existing?.reconciliation_status || 'pending',
          matched_bank_transaction_id: existing?.matched_bank_transaction_id || null,
          matched_bank_transaction: existing?.matched_bank_transaction || null,
          knocked_by: existing?.knocked_by,
          knocked_at: existing?.knocked_at,
          match_type: existing?.match_type,
          match_score: existing?.match_score,
          date_difference_days: existing?.date_difference_days,
          remark: existing?.remark || safeString(split.remark) || safeString(d.remark),
          created_at: existing?.created_at || rec.uploadedAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        result.push(paymentRecord);
      });
    } else {
      // Single payment receipt
      const paymentId = `${rec.id}_single`;
      const existing = existingMap.get(paymentId);
      const amt = d.amount_received || 0;
      const refNo = safeString(d.payment_ref_no);
      const pDate = safeString(d.payment_date) || safeString(d.receipt_date);

      const paymentRecord: ReceiptPaymentRecord = {
        id: paymentId,
        receipt_id: rec.id,
        receipt_record_id: rec.receipt_record_id || rec.id,
        hostel_name: safeString(d.hostel_name),
        student_id: safeString(d.student_id),
        student_name: safeString(d.student_name),
        receipt_no: safeString(d.receipt_no),
        nature: safeString(d.nature) || 'Installment',
        amount_received: amt,
        mode_of_receipt: safeString(d.mode_of_receipt) || 'UPI',
        fees_channel: safeString(d.fees_channel),
        receipt_date: safeString(d.receipt_date),
        payment_ref_no: refNo,
        payment_date: pDate,
        payment_month: safeString(d.payment_month),
        receipt_link: rawUrl,
        receipt_image_url: rawUrl,
        normalized_ref: normalizeReference(refNo),
        normalized_amount: normalizeAmount(amt),
        reconciliation_status: existing?.reconciliation_status || (d.entry_status === 'Knocked' ? 'knocked' : 'pending'),
        matched_bank_transaction_id: existing?.matched_bank_transaction_id || null,
        matched_bank_transaction: existing?.matched_bank_transaction || null,
        knocked_by: existing?.knocked_by || d.knocked_by,
        knocked_at: existing?.knocked_at,
        match_type: existing?.match_type || (d.final_status === 'Matched' ? 'exact_match' : undefined),
        match_score: existing?.match_score,
        date_difference_days: existing?.date_difference_days,
        remark: existing?.remark || safeString(d.remark),
        created_at: existing?.created_at || rec.uploadedAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      result.push(paymentRecord);
    }
  });

  return result;
}

export async function saveReceiptPayments(payments: ReceiptPaymentRecord[]): Promise<void> {
  if (!payments || payments.length === 0) return;
  await putToStore(STORE_RECEIPT_PAYMENTS, payments);

  if (auth.currentUser && !auth.currentUser.isAnonymous) {
    try {
      for (let i = 0; i < payments.length; i += FIRESTORE_CHUNK_SIZE) {
        const chunk = payments.slice(i, i + FIRESTORE_CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((p) => {
          const docRef = doc(db, 'receiptPayments', p.id);
          batch.set(docRef, p, { merge: true });
        });
        await batch.commit();
      }
    } catch (err) {
      console.warn('[Firestore] saveReceiptPayments batch error:', err);
    }
  }
}

export async function getAllReceiptPayments(): Promise<ReceiptPaymentRecord[]> {
  const local = await getFromStore<ReceiptPaymentRecord>(STORE_RECEIPT_PAYMENTS);
  if (auth.currentUser && !auth.currentUser.isAnonymous) {
    try {
      const colRef = collection(db, 'receiptPayments');
      const snap = await getDocs(colRef);
      if (!snap.empty) {
        const remote = snap.docs.map((d) => d.data() as ReceiptPaymentRecord);
        await putToStore(STORE_RECEIPT_PAYMENTS, remote);
        return remote;
      }
    } catch (err) {
      console.warn('[Firestore] getAllReceiptPayments fallback:', err);
    }
  }
  return local;
}

// ==================== Reconciliations & Audit Logs ====================

export async function saveReconciliation(record: ReconciliationRecord): Promise<void> {
  await putToStore(STORE_RECONCILIATIONS, [record]);
  if (auth.currentUser && !auth.currentUser.isAnonymous) {
    try {
      const docRef = doc(db, 'reconciliations', record.id);
      await setDoc(docRef, record, { merge: true });
    } catch (err) {
      console.warn('[Firestore] saveReconciliation error:', err);
    }
  }
}

export async function getAllReconciliations(): Promise<ReconciliationRecord[]> {
  const local = await getFromStore<ReconciliationRecord>(STORE_RECONCILIATIONS);
  if (auth.currentUser && !auth.currentUser.isAnonymous) {
    try {
      const colRef = collection(db, 'reconciliations');
      const snap = await getDocs(colRef);
      if (!snap.empty) {
        const remote = snap.docs.map((d) => d.data() as ReconciliationRecord);
        await putToStore(STORE_RECONCILIATIONS, remote);
        return remote;
      }
    } catch (err) {
      console.warn('[Firestore] getAllReconciliations fallback:', err);
    }
  }
  return local;
}

export async function saveAuditLog(log: ReconciliationAuditLog): Promise<void> {
  await putToStore(STORE_AUDIT_LOGS, [log]);
  if (auth.currentUser && !auth.currentUser.isAnonymous) {
    try {
      const docRef = doc(db, 'auditLogs', log.id);
      await setDoc(docRef, log, { merge: true });
    } catch (err) {
      console.warn('[Firestore] saveAuditLog error:', err);
    }
  }
}

export async function getAllAuditLogs(): Promise<ReconciliationAuditLog[]> {
  const local = await getFromStore<ReconciliationAuditLog>(STORE_AUDIT_LOGS);
  if (auth.currentUser && !auth.currentUser.isAnonymous) {
    try {
      const colRef = collection(db, 'auditLogs');
      const snap = await getDocs(colRef);
      if (!snap.empty) {
        const remote = snap.docs.map((d) => d.data() as ReconciliationAuditLog);
        await putToStore(STORE_AUDIT_LOGS, remote);
        return remote;
      }
    } catch (err) {
      console.warn('[Firestore] getAllAuditLogs fallback:', err);
    }
  }
  return local;
}

// ==================== KNOCK & UNKNOCK ACTIONS ====================

/**
 * Knocks a receipt payment to a bank transaction.
 * Enforces:
 * 1. Bank transaction can only be knocked ONCE.
 * 2. Updates receiptPayment and bankTransaction status.
 * 3. Writes reconciliation document and audit log.
 * 4. Propagates knocking status to parent ReceiptRecord (entry_status: 'Knocked', knocked_by, final_status: 'Matched', remark).
 */
export async function knockPayment(params: {
  receiptPayment: ReceiptPaymentRecord;
  bankTransaction: BankTransactionRecord;
  userEmail: string;
  matchType?: MatchType;
  matchScore?: number;
  dateDifferenceDays?: number;
  notes?: string;
  parentReceipt?: ReceiptRecord;
}): Promise<{ success: boolean; reconciliationId: string; message: string }> {
  const {
    receiptPayment,
    bankTransaction,
    userEmail,
    matchType = 'exact_match',
    matchScore = 100,
    dateDifferenceDays = 0,
    notes,
    parentReceipt,
  } = params;

  // Verify bank transaction is not already knocked to another payment
  if (
    bankTransaction.reconciliation_status === 'knocked' &&
    bankTransaction.matched_receipt_payment_id &&
    bankTransaction.matched_receipt_payment_id !== receiptPayment.id
  ) {
    throw new Error(
      `Bank transaction ${bankTransaction.bank_transaction_id} is already knocked to Student ${bankTransaction.matched_student_name || 'Another Student'}!`
    );
  }

  const now = new Date().toISOString();
  const reconId = `recon_${receiptPayment.id}_${bankTransaction.bank_transaction_id}`;

  const reconRecord: ReconciliationRecord = {
    id: reconId,
    receipt_payment_id: receiptPayment.id,
    bank_transaction_id: bankTransaction.bank_transaction_id,
    receipt_id: receiptPayment.receipt_id,
    receipt_no: receiptPayment.receipt_no,
    student_id: receiptPayment.student_id,
    student_name: receiptPayment.student_name,
    nature: receiptPayment.nature,
    receipt_amount: receiptPayment.amount_received,
    bank_amount: bankTransaction.bank_amount,
    receipt_utr: receiptPayment.payment_ref_no,
    bank_utr: bankTransaction.utr || bankTransaction.reference_number,
    match_type: matchType,
    match_score: matchScore,
    date_difference_days: dateDifferenceDays,
    knocked_at: now,
    knocked_by: userEmail || 'finance_team',
    notes: notes || `Knocked via ${matchType} with ${bankTransaction.payment_source}`,
    status: 'active',
  };

  const updatedBankTxn: BankTransactionRecord = {
    ...bankTransaction,
    reconciliation_status: 'knocked',
    matched_receipt_payment_id: receiptPayment.id,
    matched_student_name: receiptPayment.student_name,
    matched_student_id: receiptPayment.student_id,
    matched_receipt_no: receiptPayment.receipt_no,
    knocked_at: now,
    knocked_by: userEmail || 'finance_team',
  };

  const updatedPayment: ReceiptPaymentRecord = {
    ...receiptPayment,
    reconciliation_status: 'knocked',
    matched_bank_transaction_id: bankTransaction.bank_transaction_id,
    matched_bank_transaction: updatedBankTxn,
    knocked_by: userEmail || 'finance_team',
    knocked_at: now,
    match_type: matchType,
    match_score: matchScore,
    date_difference_days: dateDifferenceDays,
    remark: notes || `Knocked against ${bankTransaction.payment_source} statement (${bankTransaction.bank_date})`,
    updated_at: now,
  };

  const auditLog: ReconciliationAuditLog = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    action: 'KNOCK',
    receipt_payment_id: receiptPayment.id,
    bank_transaction_id: bankTransaction.bank_transaction_id,
    reconciliation_id: reconId,
    receipt_no: receiptPayment.receipt_no,
    student_name: receiptPayment.student_name,
    user: userEmail || 'finance_team',
    timestamp: now,
    details: `Payment knocked: Receipt ${receiptPayment.receipt_no} (₹${receiptPayment.amount_received}) <-> Bank Txn ${bankTransaction.bank_transaction_id} (₹${bankTransaction.bank_amount}) via ${matchType}`,
    metadata: { matchScore, dateDifferenceDays },
  };

  // Persist all Phase 2 entities
  await Promise.all([
    saveReconciliation(reconRecord),
    saveBankTransactions([updatedBankTxn]),
    saveReceiptPayments([updatedPayment]),
    saveAuditLog(auditLog),
  ]);

  // Propagate to parent receipt if passed
  if (parentReceipt) {
    const updatedParent: ReceiptRecord = {
      ...parentReceipt,
      data: {
        ...parentReceipt.data,
        entry_status: 'Knocked',
        knocked_by: userEmail || 'finance_team',
        final_status: 'Matched',
        remark: notes || `Knocked against ${bankTransaction.payment_source} (Bank Date: ${bankTransaction.bank_date})`,
      },
      updated_at: now,
    };
    await saveRecordToFirestore(updatedParent);
  }

  return {
    success: true,
    reconciliationId: reconId,
    message: `Payment successfully knocked against ${bankTransaction.payment_source}!`,
  };
}

/**
 * Unknocks a previously knocked payment.
 * Restores bank transaction to available.
 * Restores receipt payment to pending.
 * Marks reconciliation record as unknocked and logs to audit.
 */
export async function unknockPayment(params: {
  reconciliation: ReconciliationRecord;
  receiptPayment: ReceiptPaymentRecord;
  bankTransaction: BankTransactionRecord;
  userEmail: string;
  reason: string;
  parentReceipt?: ReceiptRecord;
}): Promise<{ success: boolean; message: string }> {
  const { reconciliation, receiptPayment, bankTransaction, userEmail, reason, parentReceipt } = params;

  const now = new Date().toISOString();

  const updatedRecon: ReconciliationRecord = {
    ...reconciliation,
    status: 'unknocked',
    unknocked_at: now,
    unknocked_by: userEmail || 'finance_team',
    unknock_reason: reason || 'Unknocked by finance user',
  };

  const updatedBankTxn: BankTransactionRecord = {
    ...bankTransaction,
    reconciliation_status: 'available',
    matched_receipt_payment_id: null,
    matched_student_name: undefined,
    matched_student_id: undefined,
    matched_receipt_no: undefined,
    knocked_at: undefined,
    knocked_by: undefined,
  };

  const updatedPayment: ReceiptPaymentRecord = {
    ...receiptPayment,
    reconciliation_status: 'pending',
    matched_bank_transaction_id: null,
    matched_bank_transaction: null,
    knocked_by: undefined,
    knocked_at: undefined,
    match_type: undefined,
    match_score: undefined,
    date_difference_days: undefined,
    remark: `Unknocked on ${now.split('T')[0]}: ${reason || 'Manual revision'}`,
    updated_at: now,
  };

  const auditLog: ReconciliationAuditLog = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    action: 'UNKNOCK',
    receipt_payment_id: receiptPayment.id,
    bank_transaction_id: bankTransaction.bank_transaction_id,
    reconciliation_id: reconciliation.id,
    receipt_no: receiptPayment.receipt_no,
    student_name: receiptPayment.student_name,
    user: userEmail || 'finance_team',
    timestamp: now,
    details: `Unknocked: Receipt ${receiptPayment.receipt_no} from Bank Txn ${bankTransaction.bank_transaction_id}. Reason: ${reason}`,
  };

  await Promise.all([
    saveReconciliation(updatedRecon),
    saveBankTransactions([updatedBankTxn]),
    saveReceiptPayments([updatedPayment]),
    saveAuditLog(auditLog),
  ]);

  // Propagate to parent receipt
  if (parentReceipt) {
    const updatedParent: ReceiptRecord = {
      ...parentReceipt,
      data: {
        ...parentReceipt.data,
        entry_status: 'Pending',
        knocked_by: '',
        final_status: 'Pending',
        remark: `Unknocked: ${reason}`,
      },
      updated_at: now,
    };
    await saveRecordToFirestore(updatedParent);
  }

  return {
    success: true,
    message: 'Reconciliation link removed. Bank transaction is now available for other matches.',
  };
}
