import { ReceiptRecord, BatchInfo, AppSettings } from '../types/receipt';
import {
  saveRecordToFirestore,
  loadAllRecordsFromFirestore,
  deleteRecordFromFirestore,
  saveBatchRecordsToFirestore,
  saveBatchToFirestore,
  loadAllBatchesFromFirestore,
  saveSettingsToFirestore,
  loadSettingsFromFirestore,
} from '../firebase/receiptStore';

const DB_NAME = 'HostelReceiptDB';
const DB_VERSION = 1;
const STORE_RECORDS = 'records';
const STORE_BATCHES = 'batches';
const STORE_IMAGES = 'images';

const SETTINGS_KEY = 'hostel_receipt_settings';

export const DEFAULT_SETTINGS: AppSettings = {
  confidenceThreshold: 0.85,
  autoDerivePaymentMonth: true,
  autoFillFinalHostel: false,
  defaultHostelName: 'Tagore Block A Hostel',
  strictPhoneValidation: false,
  warningIfAmountExceedsTotal: true,
  knownHostels: [
    'Tagore Block A Hostel',
    'Sarojini Girls Hostel',
    'Kalam Boys Residence',
    'Ramanujan Block C',
    'Aryabhata Tower B',
    'Gargi International Hostel',
  ],
  knownColleges: [
    'National Institute of Technology',
    'St. Xavier Institute of Management',
    'Apex College of Engineering',
    'City University Law School',
    'Global Institute of Health Sciences',
  ],
  knownStaffMembers: ['Manoj Sharma', 'Pooja Verma', 'Rajesh Kulkarni', 'Anita Desai', 'Deepak Singh'],
  allowedPaymentModes: ['Cash', 'UPI', 'Bank Transfer', 'NEFT', 'RTGS', 'Cheque', 'Card', 'Online', 'Razorpay'],
  allowedFeeChannels: ['Online', 'Offline', 'Bank', 'Counter Cash', 'Razorpay Gateway', 'HDFC Virtual Acc'],
  allowedRoomTypes: ['Single AC', 'Single Non-AC', 'Double Sharing AC', 'Double Sharing Non-AC', '3 Sharing', '4 Sharing'],
  organizationName: 'EduHostel Management Group',
  currentUser: 'Admin Operator (Finance)',
};

let sharedDBInstance: IDBDatabase | null = null;
let sharedDBPromise: Promise<IDBDatabase> | null = null;

function openIndexedDB(): Promise<IDBDatabase> {
  if (sharedDBInstance) {
    return Promise.resolve(sharedDBInstance);
  }
  if (sharedDBPromise) {
    return sharedDBPromise;
  }

  sharedDBPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_RECORDS)) {
        db.createObjectStore(STORE_RECORDS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_BATCHES)) {
        db.createObjectStore(STORE_BATCHES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_IMAGES)) {
        db.createObjectStore(STORE_IMAGES, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => {
      sharedDBInstance = request.result;
      // If DB closes unexpectedly, reset cached instance
      sharedDBInstance.onclose = () => {
        sharedDBInstance = null;
        sharedDBPromise = null;
      };
      resolve(sharedDBInstance);
    };
    request.onerror = () => {
      sharedDBPromise = null;
      reject(request.error);
    };
  });

  return sharedDBPromise;
}

/**
 * Saves a record to Firestore (Primary Source of Truth) with local IndexedDB backup
 */
export async function saveRecord(record: ReceiptRecord): Promise<void> {
  // 1. Primary: Save to Cloud Firestore
  try {
    await saveRecordToFirestore(record);
  } catch (firestoreErr) {
    console.error('[Storage Layer] Firestore save failed, syncing to local cache:', firestoreErr);
  }

  // 2. Cache in local IndexedDB for instant UI responsiveness
  try {
    const db = await openIndexedDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_RECORDS], 'readwrite');
      const store = tx.objectStore(STORE_RECORDS);
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(new Error('Transaction aborted'));
    });
  } catch (idbErr) {
    console.warn('[Storage Layer] IndexedDB cache warning:', idbErr);
  }
}

/**
 * Saves multiple records to Firestore and local cache
 */
export async function saveBatchRecords(records: ReceiptRecord[]): Promise<void> {
  try {
    await saveBatchRecordsToFirestore(records);
  } catch (firestoreErr) {
    console.error('[Storage Layer] Firestore batch save failed:', firestoreErr);
  }

  try {
    const db = await openIndexedDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_RECORDS], 'readwrite');
      const store = tx.objectStore(STORE_RECORDS);
      records.forEach((r) => store.put(r));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(new Error('Transaction aborted'));
    });
  } catch (idbErr) {
    console.warn('[Storage Layer] Local batch cache warning:', idbErr);
  }
}

/**
 * Loads all records with Firestore as the Permanent Source of Truth
 */
export async function loadAllRecords(): Promise<ReceiptRecord[]> {
  try {
    const firestoreRecords = await loadAllRecordsFromFirestore();
    if (firestoreRecords && firestoreRecords.length > 0) {
      // Sync fresh records to local cache
      try {
        const db = await openIndexedDB();
        const tx = db.transaction([STORE_RECORDS], 'readwrite');
        const store = tx.objectStore(STORE_RECORDS);
        firestoreRecords.forEach((r) => store.put(r));
      } catch (e) {
        // ignore cache write error
      }
      return firestoreRecords;
    }
  } catch (firestoreErr) {
    console.warn('[Storage Layer] Firestore read failed or offline, loading from local cache:', firestoreErr);
  }

  // Fallback to local cache if offline
  try {
    const db = await openIndexedDB();
    const tx = db.transaction([STORE_RECORDS], 'readonly');
    const store = tx.objectStore(STORE_RECORDS);
    const request = store.getAll();
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch (err) {
    return [];
  }
}

/**
 * Deletes a record with safe sequential execution:
 * 1. Delete Firestore document
 * 2. Delete Storage file
 * 3. Delete IndexedDB records with full transaction completion await
 */
export async function deleteRecordFromDB(id: string, storagePath?: string): Promise<void> {
  console.log(`[Delete] Started for receipt ${id}`);

  // Step 1 & 2: Firestore & Cloud Storage
  try {
    await deleteRecordFromFirestore(id, storagePath);
    console.log(`[Delete] Firestore & Storage deleted for ${id}`);
  } catch (err: any) {
    console.warn('[Delete] Firestore delete warning:', err);
  }

  // Step 3 & 4: IndexedDB record & cached image with full transaction completion
  try {
    const db = await openIndexedDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_RECORDS, STORE_IMAGES], 'readwrite');
      tx.objectStore(STORE_RECORDS).delete(id);
      tx.objectStore(STORE_IMAGES).delete(id);
      tx.oncomplete = () => {
        console.log(`[Delete] IndexedDB transaction complete for ${id}`);
        resolve();
      };
      tx.onerror = () => {
        console.error(`[Delete] IndexedDB transaction error for ${id}:`, tx.error);
        reject(tx.error);
      };
      tx.onabort = () => {
        console.warn(`[Delete] IndexedDB transaction aborted for ${id}`);
        reject(new Error('IndexedDB deletion transaction aborted'));
      };
    });
  } catch (err) {
    console.warn('[Storage Layer] Local IndexedDB delete error:', err);
  }

  console.log(`[Delete] Completed for receipt ${id}`);
}


export async function clearAllRecordsFromDB(): Promise<void> {
  try {
    const db = await openIndexedDB();
    const tx = db.transaction([STORE_RECORDS, STORE_BATCHES, STORE_IMAGES], 'readwrite');
    tx.objectStore(STORE_RECORDS).clear();
    tx.objectStore(STORE_BATCHES).clear();
    tx.objectStore(STORE_IMAGES).clear();
  } catch (err) {
    console.warn('clearAllRecordsFromDB error', err);
  }
}

export async function saveBatches(batches: BatchInfo[]): Promise<void> {
  for (const b of batches) {
    await saveBatchToFirestore(b);
  }
}

export async function loadBatches(): Promise<BatchInfo[]> {
  const fromFirestore = await loadAllBatchesFromFirestore();
  if (fromFirestore && fromFirestore.length > 0) {
    return fromFirestore;
  }
  try {
    const db = await openIndexedDB();
    const tx = db.transaction([STORE_BATCHES], 'readonly');
    const store = tx.objectStore(STORE_BATCHES);
    const request = store.getAll();
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function saveBatch(batch: BatchInfo): Promise<void> {
  await saveBatchToFirestore(batch);
  try {
    const db = await openIndexedDB();
    const tx = db.transaction([STORE_BATCHES], 'readwrite');
    const store = tx.objectStore(STORE_BATCHES);
    store.put(batch);
  } catch (e) {
    // ignore
  }
}

export async function getSettings(): Promise<AppSettings> {
  const cloudSettings = await loadSettingsFromFirestore();
  if (cloudSettings) return cloudSettings;

  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn('Failed to parse saved settings', e);
  }
  return DEFAULT_SETTINGS;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await saveSettingsToFirestore(settings);
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save settings', e);
  }
}

export const getAllRecords = loadAllRecords;
export const saveAllRecords = saveBatchRecords;
export const getAllBatches = loadBatches;
export const loadSettings = () => DEFAULT_SETTINGS;
