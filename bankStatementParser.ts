import * as XLSX from 'xlsx';
import {
  BankTransactionRecord,
  BankStatementRecord,
  PaymentSource,
  TransactionMethod,
  TransactionType,
} from '../types/reconciliation';
import { normalizeReference, normalizeAmount, normalizeDateToISO } from './reconciliationMatcher';

export interface ParseStatementResult {
  statementSummary: Omit<BankStatementRecord, 'id' | 'storage_path' | 'file_url'>;
  transactions: BankTransactionRecord[];
  columnMappingDetected: {
    dateCol?: string;
    narrationCol?: string;
    creditCol?: string;
    debitCol?: string;
    amountCol?: string;
    typeCol?: string;
    utrCol?: string;
  };
  sampleRows: BankTransactionRecord[];
}

/**
 * Automatically infers payment source from filename or content
 */
export function inferPaymentSource(fileName: string): PaymentSource {
  const lower = fileName.toLowerCase();
  if (lower.includes('phonepe') || lower.includes('phone_pe')) return 'PhonePe';
  if (lower.includes('gpay') || lower.includes('googlepay') || lower.includes('google_pay')) return 'GPay';
  if (lower.includes('axis')) return 'Axis Bank';
  if (lower.includes('idfc')) return 'IDFC Bank';
  if (lower.includes('canara')) return 'Canara Bank';
  if (lower.includes('hdfc')) return 'HDFC Bank';
  if (lower.includes('icici')) return 'ICICI Bank';
  if (lower.includes('sbi') || lower.includes('state bank')) return 'State Bank of India';
  if (lower.includes('kotak')) return 'Kotak Bank';
  return 'Other';
}

/**
 * Infers transaction method from narration or type
 */
export function inferTransactionMethod(narration: string, rawMethod?: string): TransactionMethod {
  const text = `${narration} ${rawMethod || ''}`.toUpperCase();
  if (text.includes('UPI') || text.includes('@') || text.includes('VPA') || text.includes('BHIM')) return 'UPI';
  if (text.includes('NEFT')) return 'NEFT';
  if (text.includes('RTGS')) return 'RTGS';
  if (text.includes('IMPS')) return 'IMPS';
  if (text.includes('CASH') || text.includes('BY CASH')) return 'Cash';
  if (text.includes('CARD') || text.includes('POS') || text.includes('DEBIT CARD') || text.includes('CREDIT CARD')) return 'Card';
  if (text.includes('TRF') || text.includes('TRANSFER') || text.includes('INB') || text.includes('FT')) return 'Bank Transfer';
  return 'UPI';
}

/**
 * Extracts cell text cleanly, preserving exact digits and leading zeroes
 * Transaction identifiers must ALWAYS be strings. Never use Number(), parseInt(), parseFloat().
 */
export function extractCellString(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') {
    if (isNaN(val)) return '';
    return val.toLocaleString('fullwide', { useGrouping: false });
  }
  return String(val).trim();
}

export function extractIdentifierString(val: any): string {
  return extractCellString(val);
}

/**
 * Extracts UTR/Reference from narration if no explicit column was matched
 */
export function extractUtrFromNarration(narration: string): string {
  if (!narration) return '';
  // Pattern 1: UPI/127163461851/... or UPI:519589142019
  const upiMatch = narration.match(/UPI[/:]([A-Z0-9]{8,22})/i);
  if (upiMatch) return upiMatch[1];

  // Pattern 2: UTR/NEFT/IMPS: UTR123456789 or IMPS/123456789012
  const impsMatch = narration.match(/(?:IMPS|NEFT|RTGS|REF|UTR|RRN)[/:]([A-Z0-9]{8,22})/i);
  if (impsMatch) return impsMatch[1];

  // Pattern 3: Standard 12-digit UPI RRN / UTR numbers
  const twelveDigits = narration.match(/\b\d{12}\b/);
  if (twelveDigits) return twelveDigits[0];

  return '';
}

interface HeaderScoreResult {
  score: number;
  hasDate: boolean;
  hasAmount: boolean;
  hasUtrOrRef: boolean;
  isPhonePe: boolean;
  matchedDescriptions: string[];
  cols: {
    date: number;
    time: number;
    amount: number;
    credit: number;
    debit: number;
    type: number;
    utr: number;
    phonepeRef: number;
    merchantRef: number;
    merchantOrder: number;
    merchantId: number;
    month: number;
    narration: number;
    method: number;
    knocking: number;
  };
}

function scoreCandidateHeader(row: any[]): HeaderScoreResult {
  const result: HeaderScoreResult = {
    score: 0,
    hasDate: false,
    hasAmount: false,
    hasUtrOrRef: false,
    isPhonePe: false,
    matchedDescriptions: [],
    cols: {
      date: -1,
      time: -1,
      amount: -1,
      credit: -1,
      debit: -1,
      type: -1,
      utr: -1,
      phonepeRef: -1,
      merchantRef: -1,
      merchantOrder: -1,
      merchantId: -1,
      month: -1,
      narration: -1,
      method: -1,
      knocking: -1,
    },
  };

  if (!row || !Array.isArray(row)) return result;
  const nonEmpty = row.map((c) => String(c || '').trim()).filter(Boolean);
  // Real header rows almost always have at least 3 distinct column labels
  if (nonEmpty.length < 3) return result;

  row.forEach((cell, idx) => {
    const raw = String(cell || '').trim();
    const c = raw.toLowerCase();
    if (!c || raw.length > 55) return;

    // 1. Date columns
    if (c === 'date' || c === 'txn date' || c === 'transaction date' || c === 'payment date') {
      result.hasDate = true;
      result.score += 25;
      result.cols.date = idx;
      result.matchedDescriptions.push(`Date(col ${idx}: "${raw}")`);
    } else if (
      result.cols.date === -1 &&
      (c === 'val date' || c === 'value date' || c === 'value dt' || c === 'dt')
    ) {
      result.hasDate = true;
      result.score += 15;
      result.cols.date = idx;
      result.matchedDescriptions.push(`Date(col ${idx}: "${raw}")`);
    } else if (
      result.cols.date === -1 &&
      c.includes('date') &&
      !c.includes('generated') &&
      !c.includes('duration') &&
      !c.includes('printed')
    ) {
      result.hasDate = true;
      result.score += 10;
      result.cols.date = idx;
      result.matchedDescriptions.push(`Date(col ${idx}: "${raw}")`);
    }

    // 2. Time column
    if (c.includes('time') || c.includes('timestamp')) {
      result.cols.time = idx;
      result.score += 5;
    }

    // 3. Amount columns
    if (c === 'total transaction amount' || c === 'transaction amount') {
      result.hasAmount = true;
      result.score += 30;
      result.cols.amount = idx;
      result.matchedDescriptions.push(`Amount(col ${idx}: "${raw}")`);
    } else if (c === 'amount' || c === 'net amount' || c === 'amt') {
      result.hasAmount = true;
      result.score += 20;
      result.cols.amount = idx;
      result.matchedDescriptions.push(`Amount(col ${idx}: "${raw}")`);
    } else if (c === 'credit' || c === 'deposit' || c === 'cr amount' || c === 'deposit amt' || c === 'paid in') {
      result.hasAmount = true;
      result.score += 20;
      result.cols.credit = idx;
      result.matchedDescriptions.push(`Credit(col ${idx}: "${raw}")`);
    } else if (c === 'debit' || c === 'withdrawal' || c === 'dr amount' || c === 'withdrawal amt' || c === 'paid out') {
      result.score += 15;
      result.cols.debit = idx;
      result.matchedDescriptions.push(`Debit(col ${idx}: "${raw}")`);
    } else if (result.cols.amount === -1 && c.includes('amount') && !c.includes('total amount:')) {
      result.hasAmount = true;
      result.score += 10;
      result.cols.amount = idx;
      result.matchedDescriptions.push(`Amount(col ${idx}: "${raw}")`);
    }

    // 4. UTR and Reference columns
    if (c === 'transaction utr' || c === 'utr') {
      result.hasUtrOrRef = true;
      result.score += 30;
      result.cols.utr = idx;
      result.matchedDescriptions.push(`UTR(col ${idx}: "${raw}")`);
    } else if (c === 'phonepe reference id' || c === 'phonepe reference' || c === 'phonepe ref') {
      result.hasUtrOrRef = true;
      result.isPhonePe = true;
      result.score += 25;
      result.cols.phonepeRef = idx;
      result.matchedDescriptions.push(`PhonePeRef(col ${idx}: "${raw}")`);
    } else if (c === 'merchant reference id' || c === 'merchant ref id') {
      result.hasUtrOrRef = true;
      result.isPhonePe = true;
      result.score += 20;
      result.cols.merchantRef = idx;
      result.matchedDescriptions.push(`MerchantRef(col ${idx}: "${raw}")`);
    } else if (c === 'merchant order id' || c === 'merchant order') {
      result.hasUtrOrRef = true;
      result.isPhonePe = true;
      result.score += 20;
      result.cols.merchantOrder = idx;
      result.matchedDescriptions.push(`MerchantOrder(col ${idx}: "${raw}")`);
    } else if (
      result.cols.utr === -1 &&
      (c === 'rrn' || c === 'upi ref' || c === 'upi reference' || c === 'bank ref' || c === 'bank reference' || c.includes('chq/ref'))
    ) {
      result.hasUtrOrRef = true;
      result.score += 20;
      result.cols.utr = idx;
      result.matchedDescriptions.push(`Ref(col ${idx}: "${raw}")`);
    } else if (
      result.cols.utr === -1 &&
      (c.includes('utr') || c.includes('rrn') || c.includes('reference') || c.includes('ref no'))
    ) {
      result.hasUtrOrRef = true;
      result.score += 12;
      result.cols.utr = idx;
      result.matchedDescriptions.push(`Ref(col ${idx}: "${raw}")`);
    }

    // 5. Transaction Type
    if (c === 'transaction type' || c === 'type' || c === 'txn type' || c === 'cr/dr' || c === 'dr/cr') {
      result.cols.type = idx;
      result.score += 10;
      result.matchedDescriptions.push(`Type(col ${idx}: "${raw}")`);
    }

    // 6. PhonePe specific indicators
    if (c === 'merchant id') {
      result.isPhonePe = true;
      result.cols.merchantId = idx;
      result.score += 10;
      result.matchedDescriptions.push(`MerchantId(col ${idx}: "${raw}")`);
    }
    if (c === 'month') {
      result.cols.month = idx;
      result.score += 8;
      result.matchedDescriptions.push(`Month(col ${idx}: "${raw}")`);
    }
    if (c.startsWith('knocking')) {
      result.isPhonePe = true;
      result.cols.knocking = idx;
      result.score += 10;
      result.matchedDescriptions.push(`Knocking(col ${idx}: "${raw}")`);
    }

    // 7. Narration / Particulars
    if (
      result.cols.narration === -1 &&
      (c === 'narration' ||
        c === 'particulars' ||
        c === 'description' ||
        c === 'remark' ||
        c === 'remarks' ||
        c === 'details' ||
        c === 'notes' ||
        c === 'memo')
    ) {
      result.cols.narration = idx;
      result.score += 15;
      result.matchedDescriptions.push(`Narration(col ${idx}: "${raw}")`);
    }

    // 8. Method / Channel
    if (
      result.cols.method === -1 &&
      (c === 'method' || c === 'payment method' || c === 'channel' || c === 'instrument' || c === 'mode')
    ) {
      result.cols.method = idx;
      result.score += 8;
      result.matchedDescriptions.push(`Method(col ${idx}: "${raw}")`);
    }
  });

  // Check synergy bonus
  if (result.hasDate && result.hasAmount) result.score += 30;
  if (result.hasDate && result.hasAmount && result.hasUtrOrRef) result.score += 40;
  if (result.isPhonePe) result.score += 25;

  return result;
}

/**
 * Parses XLSX, XLS, or CSV files directly into normalized BankTransactionRecords.
 * - Reads all worksheet rows
 * - Does not assume headers are on row 1
 * - Scans first 10-25 rows across all sheets for candidate header rows
 * - Strictly preserves string identifiers and leading zeroes
 */
export async function parseSpreadsheetStatement(
  file: File,
  fileId: string,
  userEmail: string,
  overriddenPaymentSource?: PaymentSource
): Promise<ParseStatementResult> {
  const arrayBuffer = await file.arrayBuffer();
  // Enable cellText and cellNF to preserve formatted string text with leading zeroes
  const workbook = XLSX.read(arrayBuffer, {
    type: 'array',
    cellDates: true,
    cellText: true,
    cellNF: true,
  });

  const sheetNames = workbook.SheetNames || [];
  console.log('[Bank Import Debug] Workbook sheet names:', sheetNames);

  if (sheetNames.length === 0) {
    throw new Error('Workbook contains no readable worksheets.');
  }

  // Iterate over all worksheets to locate candidate header rows and parseable transactions
  const candidateHeaderLogs: string[] = [];

  interface SheetCandidate {
    sheetName: string;
    headerRowIndex: number;
    headerScore: HeaderScoreResult;
    rawRows: any[][];
    headerRow: string[];
    dataRows: any[][];
    estimatedValidRows: number;
  }

  const sheetCandidates: SheetCandidate[] = [];

  for (const sheetName of sheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    // Convert to 2D array (header: 1)
    const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      raw: false,
    });

    console.log(`[Bank Import Debug] Sheet "${sheetName}": ${rawRows.length} rows read`);
    console.log(`[Bank Import Debug] First 15 raw rows of "${sheetName}":`, rawRows.slice(0, 15));

    if (rawRows.length < 2) continue;

    // Scan first 10-25 rows for candidate headers
    const scanLimit = Math.min(rawRows.length, 25);
    let bestRowIndex = -1;
    let bestHeaderResult: HeaderScoreResult | null = null;
    let maxScore = 0;

    for (let i = 0; i < scanLimit; i++) {
      const row = rawRows[i];
      const scoreRes = scoreCandidateHeader(row);
      if (scoreRes.score > 0) {
        candidateHeaderLogs.push(
          `Sheet "${sheetName}" Row ${i + 1} (score: ${scoreRes.score}): ${scoreRes.matchedDescriptions.join(', ')}`
        );
      }

      if (scoreRes.score > maxScore && scoreRes.hasDate && (scoreRes.hasAmount || scoreRes.cols.credit !== -1)) {
        maxScore = scoreRes.score;
        bestRowIndex = i;
        bestHeaderResult = scoreRes;
      }
    }

    if (bestRowIndex !== -1 && bestHeaderResult) {
      const headerRow = rawRows[bestRowIndex].map((h) => String(h || '').trim());
      const dataRows = rawRows.slice(bestRowIndex + 1);

      // Probe how many rows below have valid date and amount
      let validProbeCount = 0;
      for (let j = 0; j < Math.min(dataRows.length, 10); j++) {
        const dRow = dataRows[j];
        if (!dRow || dRow.every((c: any) => c === '' || c === null || c === undefined)) continue;
        const rawDate = bestHeaderResult.cols.date !== -1 ? dRow[bestHeaderResult.cols.date] : '';
        const isoDate = normalizeDateToISO(rawDate);
        if (isoDate) validProbeCount++;
      }

      sheetCandidates.push({
        sheetName,
        headerRowIndex: bestRowIndex,
        headerScore: bestHeaderResult,
        rawRows,
        headerRow,
        dataRows,
        estimatedValidRows: validProbeCount,
      });
    }
  }

  console.log('[Bank Import Debug] Candidate header rows analyzed:', candidateHeaderLogs);

  // If no candidate header row was found across any sheet
  if (sheetCandidates.length === 0) {
    const errorMsg = `No transaction table could be detected in this spreadsheet.\nDetected sheets: [${sheetNames.join(
      ', '
    )}]\nDetected candidate header rows: [${
      candidateHeaderLogs.slice(0, 5).join('; ') || 'None'
    }]\nPlease check column mapping.`;
    console.error('[Bank Import Debug] ' + errorMsg);
    throw new Error(errorMsg);
  }

  // Sort candidates by synergy score and valid probe rows
  sheetCandidates.sort((a, b) => {
    if (b.estimatedValidRows !== a.estimatedValidRows) {
      return b.estimatedValidRows - a.estimatedValidRows;
    }
    return b.headerScore.score - a.headerScore.score;
  });

  const chosen = sheetCandidates[0];
  const { sheetName, headerRowIndex, headerScore, headerRow, dataRows } = chosen;
  const cols = headerScore.cols;

  console.log(
    `[Bank Import Debug] Detected header row number: Row ${headerRowIndex + 1} (index ${headerRowIndex}) on sheet "${sheetName}"`
  );
  console.log(
    `[Bank Import Debug] Detected column names:`,
    headerScore.matchedDescriptions
  );

  // Fallbacks for UTR/Reference columns
  let effectiveUtrCol = cols.utr;
  if (effectiveUtrCol === -1) {
    if (cols.phonepeRef !== -1) effectiveUtrCol = cols.phonepeRef;
    else if (cols.merchantRef !== -1) effectiveUtrCol = cols.merchantRef;
    else if (cols.merchantOrder !== -1) effectiveUtrCol = cols.merchantOrder;
  }

  // Determine payment source
  let paymentSource: PaymentSource = overriddenPaymentSource || 'Other';
  if (!overriddenPaymentSource) {
    if (
      headerScore.isPhonePe ||
      cols.phonepeRef !== -1 ||
      cols.merchantOrder !== -1 ||
      cols.merchantRef !== -1 ||
      cols.knocking !== -1 ||
      file.name.toLowerCase().includes('phonepe') ||
      file.name.toLowerCase().includes('phone_pe')
    ) {
      paymentSource = 'PhonePe';
    } else {
      paymentSource = inferPaymentSource(file.name);
    }
  }

  const transactions: BankTransactionRecord[] = [];
  let creditCount = 0;
  let debitCount = 0;
  let totalCreditAmount = 0;
  let totalDebitAmount = 0;
  let minDate = '';
  let maxDate = '';

  const rejectionReasons: Record<string, number> = {};

  dataRows.forEach((row, rowIndex) => {
    // 1. Skip completely blank or empty rows
    if (!row || row.every((c: any) => c === '' || c === null || c === undefined)) {
      rejectionReasons['blank_row'] = (rejectionReasons['blank_row'] || 0) + 1;
      return;
    }

    // 2. Date parsing & normalization
    const rawDate = cols.date !== -1 ? row[cols.date] : '';
    const bankDate = normalizeDateToISO(rawDate);
    if (!bankDate) {
      rejectionReasons['invalid_or_missing_date'] =
        (rejectionReasons['invalid_or_missing_date'] || 0) + 1;
      return;
    }

    // 3. Amount parsing & normalization
    let transactionType: TransactionType = 'credit';
    let bankAmount = 0;

    if (cols.credit !== -1 && cols.debit !== -1) {
      const crVal = normalizeAmount(row[cols.credit]);
      const drVal = normalizeAmount(row[cols.debit]);
      if (crVal > 0) {
        transactionType = 'credit';
        bankAmount = crVal;
      } else if (drVal > 0) {
        transactionType = 'debit';
        bankAmount = drVal;
      } else {
        rejectionReasons['zero_amount_credit_debit'] =
          (rejectionReasons['zero_amount_credit_debit'] || 0) + 1;
        return;
      }
    } else if (cols.amount !== -1) {
      const rawAmt = row[cols.amount];
      bankAmount = normalizeAmount(rawAmt);
      if (bankAmount <= 0) {
        rejectionReasons['zero_or_negative_amount'] =
          (rejectionReasons['zero_or_negative_amount'] || 0) + 1;
        return;
      }

      if (cols.type !== -1) {
        const typeStr = String(row[cols.type] || '').toUpperCase();
        if (
          typeStr.includes('DR') ||
          typeStr.includes('DEBIT') ||
          typeStr.includes('REFUND') ||
          typeStr.includes('OUT')
        ) {
          transactionType = 'debit';
        } else {
          transactionType = 'credit';
        }
      } else {
        const rawAmtStr = String(rawAmt);
        if (rawAmtStr.includes('-') || rawAmtStr.toUpperCase().includes('DR')) {
          transactionType = 'debit';
        } else {
          transactionType = 'credit';
        }
      }
    } else if (cols.credit !== -1) {
      bankAmount = normalizeAmount(row[cols.credit]);
      transactionType = 'credit';
      if (bankAmount <= 0) {
        rejectionReasons['zero_credit_amount'] =
          (rejectionReasons['zero_credit_amount'] || 0) + 1;
        return;
      }
    } else {
      rejectionReasons['no_amount_column'] =
        (rejectionReasons['no_amount_column'] || 0) + 1;
      return;
    }

    // 4. Reference Extraction (CRITICAL: Strings only, preserve exact digits and leading zeroes)
    const rawUtrVal = effectiveUtrCol !== -1 ? extractIdentifierString(row[effectiveUtrCol]) : '';
    const rawPhonePeRef = cols.phonepeRef !== -1 ? extractIdentifierString(row[cols.phonepeRef]) : '';
    const rawMerchantRef = cols.merchantRef !== -1 ? extractIdentifierString(row[cols.merchantRef]) : '';
    const rawMerchantOrder = cols.merchantOrder !== -1 ? extractIdentifierString(row[cols.merchantOrder]) : '';
    const rawNarration = cols.narration !== -1 ? extractCellString(row[cols.narration]) : '';
    const rawTime = cols.time !== -1 ? extractCellString(row[cols.time]) : '';

    let primaryUtr = rawUtrVal;
    if (!primaryUtr && rawNarration) {
      primaryUtr = extractUtrFromNarration(rawNarration);
    }
    if (!primaryUtr && rawPhonePeRef) {
      primaryUtr = rawPhonePeRef;
    }

    // Reference aliases for search and reconciliation
    const referenceAliases: string[] = [
      primaryUtr,
      rawPhonePeRef,
      rawMerchantRef,
      rawMerchantOrder,
    ].filter(Boolean);

    // If primary UTR is an 11-digit number missing a leading 0, also add the 12-digit version
    if (/^\d{11}$/.test(primaryUtr)) {
      referenceAliases.push(`0${primaryUtr}`);
    } else if (/^0\d{11}$/.test(primaryUtr)) {
      // Also add without leading 0 for safety
      referenceAliases.push(primaryUtr.slice(1));
    }

    const uniqueAliases = Array.from(new Set(referenceAliases));
    const allNormalizedRefs = uniqueAliases.map((r) => normalizeReference(r)).filter(Boolean);
    const normalizedRef = normalizeReference(primaryUtr);

    // 5. Narration construction
    let bankNarration = rawNarration;
    if (!bankNarration) {
      if (paymentSource === 'PhonePe') {
        const orderPart = rawMerchantOrder ? ` [Order: ${rawMerchantOrder}]` : '';
        bankNarration = `PhonePe UPI ${primaryUtr || rawPhonePeRef || ''} (${transactionType === 'credit' ? 'PAYMENT' : 'REFUND'})${orderPart}`.trim();
      } else {
        bankNarration = `Bank transaction ${primaryUtr} via ${paymentSource}`.trim();
      }
    }

    // 6. Transaction Method
    let transactionMethod: TransactionMethod = 'UPI';
    if (paymentSource === 'PhonePe') {
      transactionMethod = 'UPI';
    } else {
      transactionMethod = inferTransactionMethod(
        bankNarration,
        cols.method !== -1 ? extractCellString(row[cols.method]) : undefined
      );
    }

    // 7. Update KPIs
    if (transactionType === 'credit') {
      creditCount++;
      totalCreditAmount += bankAmount;
    } else {
      debitCount++;
      totalDebitAmount += bankAmount;
    }

    if (!minDate || bankDate < minDate) minDate = bankDate;
    if (!maxDate || bankDate > maxDate) maxDate = bankDate;

    // 8. Raw row dictionary
    const rawRowDict: Record<string, any> = {};
    headerRow.forEach((colName, cIdx) => {
      if (colName) rawRowDict[colName] = row[cIdx];
    });

    const txnId = `btx_${fileId}_${rowIndex + 1}`;

    // 9. Standardized row record
    const txnRecord: BankTransactionRecord = {
      bank_transaction_id: txnId,
      source_file_id: fileId,
      source_file_name: file.name,
      payment_source: paymentSource,
      transaction_method: transactionMethod,

      bank_date: bankDate,
      value_date: bankDate,
      transaction_time: rawTime,

      bank_narration: bankNarration,
      bank_amount: bankAmount,

      utr: primaryUtr,
      reference_number: primaryUtr || rawPhonePeRef || rawMerchantRef,
      bank_reference: rawMerchantRef || primaryUtr,
      upi_reference: transactionMethod === 'UPI' ? primaryUtr : '',
      transaction_id: rawMerchantOrder || rawPhonePeRef || txnId,
      phonepe_reference: rawPhonePeRef,

      phonepe_reference_id: rawPhonePeRef,
      merchant_reference_id: rawMerchantRef,
      merchant_order_id: rawMerchantOrder,

      transaction_type: transactionType,
      credit_or_debit: transactionType,

      normalized_reference: normalizedRef,
      normalized_amount: bankAmount,

      raw_references: uniqueAliases,
      all_references: allNormalizedRefs,
      reference_aliases: uniqueAliases,

      // Standardized field aliases
      transaction_date: bankDate,
      narration: bankNarration,
      amount: bankAmount,
      raw_row: rawRowDict,

      imported_at: new Date().toISOString(),
      imported_by: userEmail || 'finance_team',
      reconciliation_status: 'available',
      matched_receipt_payment_id: null,
    };

    transactions.push(txnRecord);
  });

  const rejectedCount = Object.values(rejectionReasons).reduce((a, b) => a + b, 0);

  console.log(`[Bank Import Debug] Parsed transaction count: ${transactions.length}`);
  console.log(
    `[Bank Import Debug] Rejected/skipped row count: ${rejectedCount}. Reasons:`,
    rejectionReasons
  );

  // If 0 transactions were parsed, DO NOT ALLOW IMPORT - throw error
  if (transactions.length === 0) {
    const errorMsg = `No transaction table could be detected in this spreadsheet.\nDetected sheets: [${sheetNames.join(
      ', '
    )}]\nDetected candidate header rows: [${
      candidateHeaderLogs.slice(0, 5).join('; ') || 'None'
    }]\nPlease check column mapping.`;
    console.error('[Bank Import Debug] ' + errorMsg);
    throw new Error(errorMsg);
  }

  const statementSummary: Omit<BankStatementRecord, 'id' | 'storage_path' | 'file_url'> = {
    file_name: file.name,
    file_size: file.size,
    mime_type: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    payment_source: paymentSource,
    total_transactions: transactions.length,
    credit_count: creditCount,
    debit_count: debitCount,
    total_credit_amount: Math.round(totalCreditAmount * 100) / 100,
    total_debit_amount: Math.round(totalDebitAmount * 100) / 100,
    date_range_start: minDate,
    date_range_end: maxDate,
    imported_at: new Date().toISOString(),
    imported_by: userEmail || 'finance_team',
    import_status: 'preview',
  };

  return {
    statementSummary,
    transactions,
    columnMappingDetected: {
      dateCol: cols.date !== -1 ? headerRow[cols.date] : undefined,
      narrationCol: cols.narration !== -1 ? headerRow[cols.narration] : undefined,
      creditCol: cols.credit !== -1 ? headerRow[cols.credit] : undefined,
      debitCol: cols.debit !== -1 ? headerRow[cols.debit] : undefined,
      amountCol: cols.amount !== -1 ? headerRow[cols.amount] : undefined,
      typeCol: cols.type !== -1 ? headerRow[cols.type] : undefined,
      utrCol: effectiveUtrCol !== -1 ? headerRow[effectiveUtrCol] : undefined,
    },
    sampleRows: transactions.slice(0, 5),
  };
}
