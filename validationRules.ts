import { ReceiptData, ValidationError, AppSettings } from '../types/receipt';
import { verifyWordsAgainstAmount } from '../server/geminiExtractor';
import { safeString } from './safeUtils';

export function validateReceiptData(
  data: ReceiptData,
  settings?: Partial<AppSettings>
): ValidationError[] {
  const warnings: ValidationError[] = [];
  if (!data || typeof data !== 'object') {
    return warnings;
  }

  const hostelName = safeString(data.hostel_name);
  const receiptNo = safeString(data.receipt_no);
  const studentPhone = safeString(data.student_phone_no);
  const fatherPhone = safeString(data.father_phone_no);
  const studentName = safeString(data.student_name);
  const amountWords = safeString(data.amount_received_words);

  // 1. Hostel Name Rule: Special check for company brand vs property name
  if (hostelName) {
    if (/^ez\s*stays$/i.test(hostelName)) {
      warnings.push({
        field: 'hostel_name',
        severity: 'error',
        message: '"ez stays" is the company/brand name. The actual hostel name should be handwritten above the logo (e.g. Base Camp) or left blank.',
      });
    } else if (/^next\s*2\s*door/i.test(hostelName)) {
      warnings.push({
        field: 'hostel_name',
        severity: 'error',
        message: '"Next 2 Door Living Limited" is the legal entity, not the property name.',
      });
    }
  }

  // 2. Receipt Number construction check
  if (receiptNo) {
    if (/^\d{1,4}$/.test(receiptNo)) {
      warnings.push({
        field: 'receipt_no',
        severity: 'warning',
        message: 'Receipt No appears to be only a sequence number (e.g. 855). Check if a printed prefix (e.g. EZ-26-RG) exists to form "EZ-26-RG-855".',
      });
    }
  } else {
    warnings.push({
      field: 'receipt_no',
      severity: 'warning',
      message: 'Receipt No is missing or not extracted.',
    });
  }

  // 3. Amount in Words cross-validation
  if (data.amount_received !== null && data.amount_received !== undefined && amountWords) {
    const wordCheck = verifyWordsAgainstAmount(data.amount_received, amountWords);
    if (!wordCheck.matches) {
      warnings.push({
        field: 'amount_received',
        severity: 'warning',
        message: wordCheck.note,
      });
    }
  }

  // 4. Phone number validation (Preserve text, validate Indian format)
  if (studentPhone) {
    const cleanPhone = studentPhone.replace(/[\s\-\+]/g, '');
    const isIndianPhone = /^[6-9]\d{9}$/.test(cleanPhone) || /^91[6-9]\d{9}$/.test(cleanPhone);
    if (!isIndianPhone && cleanPhone.length > 0) {
      warnings.push({
        field: 'student_phone_no',
        severity: settings?.strictPhoneValidation ? 'error' : 'warning',
        message: 'Student phone number does not match standard 10-digit Indian format',
      });
    }
  }

  if (fatherPhone) {
    const cleanFatherPhone = fatherPhone.replace(/[\s\-\+]/g, '');
    const isIndianPhone = /^[6-9]\d{9}$/.test(cleanFatherPhone) || /^91[6-9]\d{9}$/.test(cleanFatherPhone);
    if (!isIndianPhone && cleanFatherPhone.length > 0) {
      warnings.push({
        field: 'father_phone_no',
        severity: 'warning',
        message: "Father's phone number format is non-standard",
      });
    }
  }

  // 5. Amounts check
  if (typeof data.amount_received === 'number' && typeof data.total_fees === 'number') {
    if (data.amount_received > data.total_fees && (settings?.warningIfAmountExceedsTotal ?? true)) {
      warnings.push({
        field: 'amount_received',
        severity: 'warning',
        message: `Amount Received (₹${data.amount_received}) exceeds Total Fees (₹${data.total_fees})`,
      });
    }
  }

  if (typeof data.cumulative_fee === 'number' && typeof data.total_fees === 'number') {
    if (data.cumulative_fee > data.total_fees) {
      warnings.push({
        field: 'cumulative_fee',
        severity: 'warning',
        message: `Cumulative Fee (₹${data.cumulative_fee}) is greater than Total Fees (₹${data.total_fees})`,
      });
    }
  }

  // 6. Essential field check
  if (!studentName) {
    warnings.push({
      field: 'student_name',
      severity: 'error',
      message: 'Student name is missing or empty',
    });
  }

  if (data.amount_received === null || data.amount_received === undefined || isNaN(data.amount_received)) {
    warnings.push({
      field: 'amount_received',
      severity: 'error',
      message: 'Amount received is missing or invalid number',
    });
  }

  return warnings;
}
