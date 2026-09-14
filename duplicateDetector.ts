import { ReceiptRecord, ReceiptData } from '../types/receipt';
import { safeString } from './safeUtils';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateOfId?: string;
  matchedRecord?: ReceiptRecord;
  reason?: string;
  score: number; // 0 to 1
}

export function checkDuplicate(
  recordData: ReceiptData,
  fileName: string,
  existingRecords: ReceiptRecord[],
  currentRecordId?: string
): DuplicateCheckResult {
  if (!recordData || typeof recordData !== 'object') {
    return { isDuplicate: false, score: 0 };
  }

  const others = (existingRecords || []).filter((r) => r && r.id !== currentRecordId);
  if (others.length === 0) {
    return { isDuplicate: false, score: 0 };
  }

  const currentReceiptNo = safeString(recordData.receipt_no).toLowerCase();
  const currentPaymentRef = safeString(recordData.payment_ref_no).toLowerCase();
  const currentStudentId = safeString(recordData.student_id).toLowerCase();
  const currentStudentName = safeString(recordData.student_name).toLowerCase();
  const currentReceiptDate = safeString(recordData.receipt_date);
  const currentFileName = safeString(fileName).toLowerCase();

  for (const existing of others) {
    if (!existing || !existing.data) continue;
    const exData = existing.data;
    let matchScore = 0;
    const reasons: string[] = [];

    const exReceiptNo = safeString(exData.receipt_no).toLowerCase();
    const exPaymentRef = safeString(exData.payment_ref_no).toLowerCase();
    const exStudentId = safeString(exData.student_id).toLowerCase();
    const exStudentName = safeString(exData.student_name).toLowerCase();
    const exReceiptDate = safeString(exData.receipt_date);
    const exFileName = safeString(existing.fileName).toLowerCase();

    // Signal 1: Exact Receipt Number (high confidence)
    if (currentReceiptNo && exReceiptNo && currentReceiptNo === exReceiptNo) {
      matchScore += 0.85;
      reasons.push(`Matching Receipt No: ${recordData.receipt_no}`);
    }

    // Signal 2: Payment Ref No (high confidence)
    if (currentPaymentRef && exPaymentRef && currentPaymentRef === exPaymentRef) {
      matchScore += 0.90;
      reasons.push(`Matching Transaction/Payment Ref: ${recordData.payment_ref_no}`);
    }

    // Signal 3: Student ID + Amount + Date match
    const sameStudentId = currentStudentId && exStudentId && currentStudentId === exStudentId;
    const sameAmount =
      recordData.amount_received !== null &&
      recordData.amount_received !== undefined &&
      exData.amount_received !== null &&
      exData.amount_received !== undefined &&
      recordData.amount_received === exData.amount_received;
    const sameDate = currentReceiptDate && exReceiptDate && currentReceiptDate === exReceiptDate;

    if (sameStudentId && sameAmount && sameDate) {
      matchScore += 0.90;
      reasons.push(`Identical Student ID (${recordData.student_id}), Amount (₹${recordData.amount_received}) & Date (${recordData.receipt_date})`);
    } else if (sameStudentId && sameAmount) {
      matchScore += 0.60;
      reasons.push(`Same Student ID (${recordData.student_id}) & Amount (₹${recordData.amount_received})`);
    }

    // Signal 4: Student Name + Amount + Date match
    const sameName = currentStudentName && exStudentName && currentStudentName === exStudentName && currentStudentName.length > 3;

    if (sameName && sameAmount && sameDate) {
      matchScore += 0.75;
      reasons.push(`Matching Student Name (${recordData.student_name}), Amount (₹${recordData.amount_received}) & Date (${recordData.receipt_date})`);
    }

    // Signal 5: Identical File Name (accidental re-upload)
    if (currentFileName && exFileName && currentFileName === exFileName) {
      matchScore += 0.50;
      reasons.push(`Identical filename (${fileName})`);
    }

    if (matchScore >= 0.70) {
      return {
        isDuplicate: true,
        duplicateOfId: existing.id,
        matchedRecord: existing,
        reason: reasons.join('; '),
        score: Math.min(matchScore, 1.0),
      };
    }
  }

  return { isDuplicate: false, score: 0 };
}

export function checkForDuplicates(
  recordData: ReceiptData,
  existingRecords: ReceiptRecord[],
  currentRecordId?: string,
  fileName?: string
): DuplicateCheckResult {
  return checkDuplicate(recordData, fileName || '', existingRecords, currentRecordId);
}
