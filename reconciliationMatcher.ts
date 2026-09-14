import {
  ReceiptPaymentRecord,
  BankTransactionRecord,
  ReceiptPaymentReconciliationStatus,
  MatchType,
  DuplicateKnockingInfo,
} from '../types/reconciliation';

/**
 * Normalizes a payment reference / UTR by:
 * - Converting numbers safely without scientific notation
 * - Trimming spaces
 * - Stripping noise words (e.g., 'UPI-', 'TXN', 'UTR:', 'REF:', 'RRN:', 'CHQ')
 * - Removing all non-alphanumeric separators (spaces, dashes, slashes, dots, etc.)
 * - Uppercasing
 * - NEVER converts to numeric / float
 */
export function normalizeReference(rawRef: string | number | null | undefined): string {
  if (rawRef === null || rawRef === undefined || rawRef === '') return '';

  let str = '';
  if (typeof rawRef === 'number') {
    if (isNaN(rawRef)) return '';
    // Prevent scientific notation for large integer numbers
    str = rawRef.toLocaleString('fullwide', { useGrouping: false });
  } else {
    str = String(rawRef);
  }

  let ref = str.trim().toUpperCase();

  // If scientific notation string was passed (e.g. 5.19589142019E+11 or 5.19589E11)
  const sciMatch = ref.match(/^(\d+)(?:\.(\d+))?E\+?(\d+)$/i);
  if (sciMatch) {
    const whole = sciMatch[1];
    const frac = sciMatch[2] || '';
    const exp = parseInt(sciMatch[3], 10);
    const combined = whole + frac;
    ref = combined.padEnd(whole.length + exp, '0').slice(0, whole.length + exp);
  }

  // Strip leading noise prefixes: UTR, REF, TXN, UPI, NO, ID, RRN, CHQ, CHEQUE, etc.
  ref = ref.replace(/^(UTR|REF|TXN|UPI|NO|#|ID|RRN|CHQ|CHEQUE)[\s:-]+/i, '');
  // Remove all non-alphanumeric characters (spaces, tabs, newlines, dashes, slashes, periods, colons, underscores)
  ref = ref.replace(/[^A-Z0-9]/g, '');

  return ref;
}

/**
 * Normalizes an amount into a positive number rounded to 2 decimal places.
 */
export function normalizeAmount(rawAmount: any): number {
  if (rawAmount === null || rawAmount === undefined) return 0;
  if (typeof rawAmount === 'number') {
    return isNaN(rawAmount) ? 0 : Math.round(Math.abs(rawAmount) * 100) / 100;
  }
  const cleaned = String(rawAmount)
    .replace(/[₹$,\s]/g, '')
    .trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.round(Math.abs(parsed) * 100) / 100;
}

/**
 * Standardizes any date format into YYYY-MM-DD.
 * Supports:
 * - DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY
 * - DD-MMM-YY, DD-MMM-YYYY, DD MMM YYYY, DD/MMM/YY (e.g., 14-Jul-25, 14-Jul-2025, 14 Jul 2025)
 * - YYYY-MM-DD
 * - Excel serial date numbers (e.g. 45852)
 * - JS Date objects (uses local calendar to prevent UTC offset day-shift bugs)
 */
export function normalizeDateToISO(rawDate: string | number | Date | null | undefined): string {
  if (!rawDate) return '';

  // 1. If Date object: extract local year, month, day to avoid UTC timezone day-loss
  if (rawDate instanceof Date) {
    if (isNaN(rawDate.getTime())) return '';
    const y = rawDate.getFullYear();
    const m = String(rawDate.getMonth() + 1).padStart(2, '0');
    const d = String(rawDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 2. Excel serial date number (e.g. 45852 -> 2025-07-14)
  if (typeof rawDate === 'number') {
    if (isNaN(rawDate) || rawDate <= 0) return '';
    const totalDays = Math.floor(rawDate);
    // Excel 1900 date system leap year quirk: epoch is 1899-12-30
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const targetDate = new Date(excelEpoch.getTime() + totalDays * 86400000);
    if (isNaN(targetDate.getTime())) return '';
    const y = targetDate.getUTCFullYear();
    const m = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
    const d = String(targetDate.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const str = String(rawDate).trim();
  if (!str) return '';

  // 3. YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const MONTH_MAP: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };

  // 4. DD-MMM-YY or DD-MMM-YYYY or DD MMM YY/YYYY (e.g., 14-Jul-25, 14-Jul-2025, 14 Jul 2025)
  const dMmmY = str.match(/^(\d{1,2})[\s\-_/.]([a-zA-Z]{3,9})[\s\-_/.](\d{2,4})/);
  if (dMmmY) {
    const day = dMmmY[1].padStart(2, '0');
    const monKey = dMmmY[2].toLowerCase().substring(0, 3);
    const month = MONTH_MAP[monKey] || '01';
    let year = dMmmY[3];
    if (year.length === 2) {
      const yy = parseInt(year, 10);
      year = yy <= 69 ? `20${year}` : `19${year}`;
    }
    return `${year}-${month}-${day}`;
  }

  // 5. MMM DD, YYYY (e.g., Jul 14, 2025)
  const mmmDY = str.match(/^([a-zA-Z]{3,9})[\s\-_/.](\d{1,2})(?:st|nd|rd|th)?[\s\-_/.,]+(\d{2,4})/);
  if (mmmDY) {
    const monKey = mmmDY[1].toLowerCase().substring(0, 3);
    const month = MONTH_MAP[monKey] || '01';
    const day = mmmDY[2].padStart(2, '0');
    let year = mmmDY[3];
    if (year.length === 2) {
      const yy = parseInt(year, 10);
      year = yy <= 69 ? `20${year}` : `19${year}`;
    }
    return `${year}-${month}-${day}`;
  }

  // 6. DD-MM-YYYY or DD/MM/YYYY or DD-MM-YY or DD/MM/YY (e.g., 14-07-2025, 14/07/2025, 14-07-25)
  const dmyMatch = str.match(/^(\d{1,2})[\s\-_/.](\d{1,2})[\s\-_/.](\d{2,4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    let year = dmyMatch[3];
    if (year.length === 2) {
      const yy = parseInt(year, 10);
      year = yy <= 69 ? `20${year}` : `19${year}`;
    }
    return `${year}-${month}-${day}`;
  }

  // 7. Fallback standard parse with local date components
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return str;
}

/**
 * Calculates absolute difference between two date strings in days.
 */
export function calculateDateDifferenceInDays(date1: string, date2: string): number {
  const d1 = normalizeDateToISO(date1);
  const d2 = normalizeDateToISO(date2);
  if (!d1 || !d2) return 999;
  const time1 = new Date(d1).getTime();
  const time2 = new Date(d2).getTime();
  if (isNaN(time1) || isNaN(time2)) return 999;
  const diffMs = Math.abs(time1 - time2);
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Checks if payment mode indicates Cash / Manual handling
 */
export function isCashPayment(modeOfReceipt: string | undefined, nature?: string): boolean {
  const mode = (modeOfReceipt || '').toLowerCase();
  const nat = (nature || '').toLowerCase();
  return (
    mode.includes('cash') ||
    mode === 'offline' ||
    nat.includes('cash')
  );
}

/**
 * Comprehensive check across all reference fields of a bank transaction.
 * Searches: UTR, Transaction ID, Reference Number, Bank Reference,
 * UPI Reference, PhonePe Reference, RRN, and Narration.
 */
export function matchesBankTransactionReference(
  b: BankTransactionRecord,
  normalizedTargetRef: string
): boolean {
  if (!normalizedTargetRef || normalizedTargetRef.length < 4) return false;

  // 1. Direct normalized reference
  if (b.normalized_reference && b.normalized_reference === normalizedTargetRef) return true;

  // 2. Check candidate reference fields
  const candidateFields = [
    b.utr,
    b.reference_number,
    b.bank_reference,
    b.upi_reference,
    b.transaction_id,
    b.phonepe_reference,
    b.phonepe_reference_id,
    b.merchant_reference_id,
    b.merchant_order_id,
    b.rrn,
    ...(b.raw_references || []),
    ...(b.all_references || []),
    ...(b.reference_aliases || []),
  ];

  for (const raw of candidateFields) {
    if (!raw) continue;
    const norm = normalizeReference(raw);
    if (norm === normalizedTargetRef) return true;
  }

  // 3. Search inside narration
  if (b.bank_narration) {
    const cleanNarration = normalizeReference(b.bank_narration);
    if (cleanNarration.includes(normalizedTargetRef)) return true;
  }

  return false;
}

export interface MatchEvaluationResult {
  status: ReceiptPaymentReconciliationStatus;
  matchedTransaction: BankTransactionRecord | null;
  matchType?: MatchType;
  matchScore: number;
  dateDifferenceDays: number;
  remark: string;
  candidateTransactions: BankTransactionRecord[];
  duplicateInfo?: DuplicateKnockingInfo;
}

/**
 * Evaluates a receipt payment against the pool of bank transactions.
 * Strict, deterministic, rule-based matching engine.
 * 
 * Flow:
 * 1. Cash / Offline => cash_manual
 * 2. If already knocked => return existing knocked record
 * 3. Search bank transactions for matching Reference / UTR
 *    - If duplicate used on another receipt => DUPLICATE / FRAUD (block knock)
 *    - If UTR matches:
 *      - Amount mismatch => AMOUNT MISMATCH (do not say Not Found)
 *      - Amount matches:
 *        - Date diff <= 0 days => EXACT MATCH (100%), Ready for [ Confirm Knock ]
 *        - Date diff 1-2 days => POSTING DATE DIFFERENCE (95%), Ready for [ Confirm Knock ]
 *        - Date diff > 2 days => DATE MISMATCH (70%), Needs review
 * 4. If reference missing on receipt:
 *    - Candidate matching: ONLY Amount match AND Date within ±2 days (or max ±7 days)
 *    - NEVER suggest same-amount transactions from unrelated months or years!
 * 5. If reference provided but not found => NOT FOUND in bank
 */
export function evaluateReceiptPaymentMatch(
  payment: ReceiptPaymentRecord,
  allBankTransactions: BankTransactionRecord[],
  allReceiptPayments: ReceiptPaymentRecord[]
): MatchEvaluationResult {
  // Rule 1: Cash Handling
  if (isCashPayment(payment.mode_of_receipt, payment.nature)) {
    return {
      status: 'cash_manual',
      matchedTransaction: null,
      matchType: 'cash_approved',
      matchScore: 100,
      dateDifferenceDays: 0,
      remark: 'Cash payment. Verified via physical hostel counter. Manual finance approval required.',
      candidateTransactions: [],
    };
  }

  const pRef = payment.normalized_ref || normalizeReference(payment.payment_ref_no);
  const pAmount = payment.normalized_amount || normalizeAmount(payment.amount_received);
  const pDate = normalizeDateToISO(payment.payment_date || payment.receipt_date);

  // Filter bank transactions: only credits are eligible for receipt payment matching
  const creditTxns = allBankTransactions.filter(
    (b) => b.transaction_type === 'credit' || b.credit_or_debit === 'credit' || b.bank_amount > 0
  );

  // Check if this payment is already knocked
  if (payment.reconciliation_status === 'knocked' && payment.matched_bank_transaction_id) {
    const existingMatch = allBankTransactions.find(
      (b) => b.bank_transaction_id === payment.matched_bank_transaction_id
    );
    if (existingMatch) {
      const dateDiff = calculateDateDifferenceInDays(pDate, existingMatch.bank_date);
      return {
        status: 'knocked',
        matchedTransaction: existingMatch,
        matchType: payment.match_type || 'exact_match',
        matchScore: payment.match_score || 100,
        dateDifferenceDays: dateDiff,
        remark: payment.remark || `Knocked against bank transaction ${existingMatch.bank_transaction_id}`,
        candidateTransactions: [],
      };
    }
  }

  // Find candidate bank transactions matching the reference
  let refMatches: BankTransactionRecord[] = [];
  if (pRef && pRef.length >= 4) {
    refMatches = creditTxns.filter((b) => matchesBankTransactionReference(b, pRef));
  }

  // Reference matches found
  if (refMatches.length > 0) {
    // Check for DUPLICATE / REUSED UTR
    // If any matched bank transaction is already knocked to a DIFFERENT receipt payment
    for (const bTx of refMatches) {
      if (
        bTx.reconciliation_status === 'knocked' &&
        bTx.matched_receipt_payment_id &&
        bTx.matched_receipt_payment_id !== payment.id
      ) {
        // Find the other receipt payment it was knocked to
        const priorPayment = allReceiptPayments.find((rp) => rp.id === bTx.matched_receipt_payment_id);
        const dupInfo: DuplicateKnockingInfo = {
          already_knocked_to_student_name: priorPayment?.student_name || bTx.matched_student_name || 'Another Student',
          already_knocked_to_student_id: priorPayment?.student_id || bTx.matched_student_id || 'Unknown',
          already_knocked_to_receipt_no: priorPayment?.receipt_no || bTx.matched_receipt_no || 'Unknown',
          already_knocked_to_nature: priorPayment?.nature || 'Installment',
          already_knocked_to_amount: priorPayment?.amount_received || bTx.bank_amount,
          already_knocked_to_payment_date: priorPayment?.payment_date || bTx.bank_date,
          bank_utr: bTx.utr || bTx.reference_number || pRef,
        };

        return {
          status: 'duplicate',
          matchedTransaction: bTx,
          matchScore: 0,
          dateDifferenceDays: calculateDateDifferenceInDays(pDate, bTx.bank_date),
          remark: `DUPLICATE PAYMENT / UTR ALREADY USED. Bank transaction already knocked against Student ${dupInfo.already_knocked_to_student_name} (${dupInfo.already_knocked_to_student_id}), Receipt ${dupInfo.already_knocked_to_receipt_no}.`,
          candidateTransactions: refMatches,
          duplicateInfo: dupInfo,
        };
      }
    }

    // Pick target candidate (prefer unknocked)
    const availableRefMatches = refMatches.filter((b) => b.reconciliation_status !== 'knocked');
    const targetCandidate = availableRefMatches.length > 0 ? availableRefMatches[0] : refMatches[0];
    const bAmount = targetCandidate.normalized_amount || normalizeAmount(targetCandidate.bank_amount);
    const dateDiff = calculateDateDifferenceInDays(pDate, targetCandidate.bank_date);

    // 1. AMOUNT CHECK: If reference matches, but amount differs
    if (Math.abs(pAmount - bAmount) > 0.5) {
      return {
        status: 'amount_mismatch',
        matchedTransaction: targetCandidate,
        matchScore: 50,
        dateDifferenceDays: dateDiff,
        remark: `UTR found but amount mismatch. Receipt claimed ₹${pAmount.toLocaleString('en-IN')}; Bank actual ₹${bAmount.toLocaleString('en-IN')}.`,
        candidateTransactions: refMatches,
      };
    }

    // 2. EXACT MATCH: Reference matches + Amount matches + Date diff == 0 days
    if (dateDiff === 0) {
      const isNarrationMatch = targetCandidate.normalized_reference !== pRef;
      return {
        status: 'exact_match',
        matchedTransaction: targetCandidate,
        matchType: isNarrationMatch ? 'narration_ref' : 'exact_match',
        matchScore: 100,
        dateDifferenceDays: 0,
        remark: `Exact match found. UTR ${pRef} + Amount ₹${pAmount.toLocaleString('en-IN')} + Same-day settlement with ${targetCandidate.payment_source}.`,
        candidateTransactions: refMatches,
      };
    }

    // 3. POSTING DATE DIFFERENCE: Reference matches + Amount matches + Date diff 1-2 days
    if (dateDiff <= 2) {
      return {
        status: 'exact_match',
        matchedTransaction: targetCandidate,
        matchType: 'date_difference',
        matchScore: 95,
        dateDifferenceDays: dateDiff,
        remark: `Matched on UTR + Amount with ${dateDiff}-day posting delay.`,
        candidateTransactions: refMatches,
      };
    }

    // 4. DATE MISMATCH: Reference matches + Amount matches + Date diff > 2 days
    return {
      status: 'date_mismatch',
      matchedTransaction: targetCandidate,
      matchType: 'exact_match',
      matchScore: 70,
      dateDifferenceDays: dateDiff,
      remark: `Date mismatch. Receipt payment date (${payment.payment_date || 'N/A'}) differs from bank statement date (${targetCandidate.bank_date}) by ${dateDiff} days.`,
      candidateTransactions: refMatches,
    };
  }

  // Reference NOT recorded on receipt (or missing)
  // Candidate matching: ONLY suggest bank transactions where Amount matches AND Date is within ±2 days (or ±7 days max)
  // NEVER suggest same-amount transactions from unrelated months or years!
  const candidateByAmountDate = creditTxns.filter((b) => {
    if (b.reconciliation_status === 'knocked') return false;
    const bAmt = b.normalized_amount || normalizeAmount(b.bank_amount);
    if (Math.abs(bAmt - pAmount) > 0.5) return false;
    const diff = calculateDateDifferenceInDays(pDate, b.bank_date);
    // Strict window: max 7 days difference, strictly reject outside this window
    return diff <= 7;
  });

  if (candidateByAmountDate.length === 1) {
    const candidate = candidateByAmountDate[0];
    const diff = calculateDateDifferenceInDays(pDate, candidate.bank_date);
    return {
      status: 'needs_review',
      matchedTransaction: candidate,
      matchType: 'amount_date_candidate',
      matchScore: diff <= 2 ? 85 : 70,
      dateDifferenceDays: diff,
      remark: `Single bank candidate found for ₹${pAmount.toLocaleString('en-IN')} (Bank date ${candidate.bank_date}, ${diff} days apart). Reference not recorded on receipt; requires finance review.`,
      candidateTransactions: candidateByAmountDate,
    };
  }

  if (candidateByAmountDate.length > 1) {
    return {
      status: 'multiple_matches',
      matchedTransaction: null,
      matchScore: 60,
      dateDifferenceDays: 0,
      remark: `${candidateByAmountDate.length} candidate bank transactions found with matching amount ₹${pAmount.toLocaleString('en-IN')} within 7-day window. Manual selection required.`,
      candidateTransactions: candidateByAmountDate,
    };
  }

  // Not Found in Bank
  return {
    status: 'not_found',
    matchedTransaction: null,
    matchScore: 0,
    dateDifferenceDays: 0,
    remark: pRef
      ? `Reference ${pRef} not found in any imported bank statement.`
      : `No bank credit transaction found matching amount ₹${pAmount.toLocaleString('en-IN')} within 7 days of payment date.`,
    candidateTransactions: [],
  };
}

/**
 * Runs batch matching across all unknocked receipt payments.
 * Returns updated payment records and evaluated matches ready for confirmation.
 */
export function runBatchMatching(
  receiptPayments: ReceiptPaymentRecord[],
  bankTransactions: BankTransactionRecord[]
): {
  updatedPayments: ReceiptPaymentRecord[];
  autoKnockedCount: number;
  autoKnockedList: Array<{ payment: ReceiptPaymentRecord; transaction: BankTransactionRecord }>;
} {
  const updatedPayments: ReceiptPaymentRecord[] = [];
  const autoKnockedList: Array<{ payment: ReceiptPaymentRecord; transaction: BankTransactionRecord }> = [];
  let autoKnockedCount = 0;

  // Track claimed bank transactions in this batch to enforce 1:1 knock rule
  const claimedBankTxnIds = new Set<string>();
  bankTransactions.forEach((b) => {
    if (b.reconciliation_status === 'knocked') {
      claimedBankTxnIds.add(b.bank_transaction_id);
    }
  });

  for (const payment of receiptPayments) {
    // If already manually or previously knocked, keep it untouched
    if (payment.reconciliation_status === 'knocked') {
      updatedPayments.push(payment);
      continue;
    }

    const evalResult = evaluateReceiptPaymentMatch(payment, bankTransactions, receiptPayments);

    const updated: ReceiptPaymentRecord = {
      ...payment,
      reconciliation_status: evalResult.status,
      matched_bank_transaction_id: evalResult.matchedTransaction?.bank_transaction_id || null,
      matched_bank_transaction: evalResult.matchedTransaction,
      match_type: evalResult.matchType,
      match_score: evalResult.matchScore,
      date_difference_days: evalResult.dateDifferenceDays,
      remark: evalResult.remark,
      candidate_transaction_ids: evalResult.candidateTransactions.map((c) => c.bank_transaction_id),
      duplicate_info: evalResult.duplicateInfo,
      updated_at: new Date().toISOString(),
    };

    if (evalResult.status === 'exact_match' && evalResult.matchedTransaction) {
      autoKnockedList.push({ payment: updated, transaction: evalResult.matchedTransaction });
      autoKnockedCount++;
    }

    updatedPayments.push(updated);
  }

  return { updatedPayments, autoKnockedCount, autoKnockedList };
}

/**
 * Computes top-level KPIs for dashboard
 */
export function computeReconciliationKPIs(
  payments: ReceiptPaymentRecord[],
  bankTransactions: BankTransactionRecord[]
) {
  let knockedCount = 0;
  let exactMatchCount = 0;
  let pendingCount = 0;
  let duplicateCount = 0;
  let amountMismatchCount = 0;
  let notFoundCount = 0;
  let cashManualCount = 0;
  let dateMismatchCount = 0;
  let multipleMatchesCount = 0;
  let needsReviewCount = 0;
  let totalKnockedAmount = 0;
  let totalPendingAmount = 0;

  payments.forEach((p) => {
    const amt = p.amount_received || 0;
    switch (p.reconciliation_status) {
      case 'knocked':
        knockedCount++;
        totalKnockedAmount += amt;
        break;
      case 'exact_match':
        exactMatchCount++;
        totalPendingAmount += amt;
        break;
      case 'duplicate':
        duplicateCount++;
        break;
      case 'amount_mismatch':
        amountMismatchCount++;
        break;
      case 'not_found':
        notFoundCount++;
        totalPendingAmount += amt;
        break;
      case 'cash_manual':
        cashManualCount++;
        break;
      case 'date_mismatch':
        dateMismatchCount++;
        break;
      case 'multiple_matches':
        multipleMatchesCount++;
        break;
      case 'needs_review':
        needsReviewCount++;
        break;
      case 'pending':
      default:
        pendingCount++;
        totalPendingAmount += amt;
        break;
    }
  });

  return {
    totalReceiptPayments: payments.length,
    knockedCount,
    exactMatchCount,
    pendingCount,
    duplicateCount,
    amountMismatchCount,
    notFoundCount,
    cashManualCount,
    dateMismatchCount,
    multipleMatchesCount,
    needsReviewCount,
    totalKnockedAmount,
    totalPendingAmount,
  };
}
