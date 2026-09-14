import { routeGeneration } from './modelRouter';
import { safeCleanBase64, safeString, safeNumber } from '../utils/safeUtils';
import {
  BankTransactionRecord,
  BankStatementRecord,
  PaymentSource,
  TransactionMethod,
  TransactionType,
} from '../types/reconciliation';
import { normalizeReference, normalizeAmount, normalizeDateToISO } from '../utils/reconciliationMatcher';

export interface AiStatementExtractionResult {
  statementSummary: Omit<BankStatementRecord, 'id' | 'storage_path' | 'file_url'>;
  transactions: BankTransactionRecord[];
  sampleRows: BankTransactionRecord[];
  rawText?: string;
  modelUsed?: string;
}

const BANK_STATEMENT_PROMPT = `You are an expert banking and payment statement parser.
Your task is to extract every transaction row from the provided bank statement image/PDF.

Return ONLY a valid JSON object matching this schema:
{
  "payment_source": "PhonePe" | "GPay" | "Axis Bank" | "IDFC Bank" | "Canara Bank" | "HDFC Bank" | "ICICI Bank" | "State Bank of India" | "Kotak Bank" | "Other",
  "transactions": [
    {
      "date": "DD-MM-YYYY",
      "time": "HH:MM:SS or empty",
      "narration": "Full narration or transaction particulars",
      "amount": 50000,
      "type": "credit" or "debit",
      "utr": "12-digit UTR, RRN, or reference ID if visible, else empty",
      "transaction_method": "UPI" | "NEFT" | "RTGS" | "IMPS" | "Cash" | "Card" | "Bank Transfer"
    }
  ]
}

CRITICAL RULES:
1. Extract ALL visible transaction rows accurately.
2. For "type", determine if amount was incoming (credit/deposit) or outgoing (debit/withdrawal).
3. Extract UTR / Reference number accurately from UTR columns or embedded in UPI narration (e.g. UPI/127163461851 -> UTR: 127163461851).
4. Amount must be a positive number without commas or currency symbols.
5. Return ONLY raw JSON with no markdown wrapping or preamble.`;

export async function extractStatementFromPdfOrImage(
  base64Data: string,
  mimeType: string,
  fileName: string,
  userEmail: string,
  fileId: string
): Promise<AiStatementExtractionResult> {
  const cleanBase64 = safeCleanBase64(base64Data);

  const requestParts = [
    { text: BANK_STATEMENT_PROMPT },
    {
      inlineData: {
        mimeType: mimeType || 'image/jpeg',
        data: cleanBase64,
      },
    },
  ];

  const routingResult = await routeGeneration({
    requestParts,
    responseMimeType: 'application/json',
    contextLabel: `StatementAiExtractor:${fileName}`,
  });

  let rawJson = safeString(routingResult.text);
  // Clean potential markdown fences
  if (rawJson.startsWith('```')) {
    rawJson = rawJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  }

  let parsedData: any = {};
  try {
    parsedData = JSON.parse(rawJson);
  } catch (err: any) {
    console.error('[Statement AI] JSON parse failed, text:', rawJson);
    throw new Error(`Failed to parse AI response into JSON: ${err?.message || err}`);
  }

  const detectedSource: PaymentSource = parsedData.payment_source || 'Other';
  const rawTxns = Array.isArray(parsedData.transactions) ? parsedData.transactions : [];

  const transactions: BankTransactionRecord[] = [];
  let creditCount = 0;
  let debitCount = 0;
  let totalCreditAmount = 0;
  let totalDebitAmount = 0;
  let minDate = '';
  let maxDate = '';

  rawTxns.forEach((tx: any, idx: number) => {
    const rawAmt = safeNumber(tx.amount).value || 0;
    if (rawAmt <= 0) return;

    const type: TransactionType = String(tx.type).toLowerCase().includes('dr') || String(tx.type).toLowerCase().includes('debit')
      ? 'debit'
      : 'credit';

    const bDate = normalizeDateToISO(tx.date);
    if (type === 'credit') {
      creditCount++;
      totalCreditAmount += rawAmt;
    } else {
      debitCount++;
      totalDebitAmount += rawAmt;
    }

    if (bDate) {
      if (!minDate || bDate < minDate) minDate = bDate;
      if (!maxDate || bDate > maxDate) maxDate = bDate;
    }

    const rawUtr = safeString(tx.utr);
    const normalizedRef = normalizeReference(rawUtr);
    const txnId = `btx_${fileId}_${idx + 1}`;

    transactions.push({
      bank_transaction_id: txnId,
      source_file_id: fileId,
      source_file_name: fileName,
      payment_source: detectedSource,
      transaction_method: (tx.transaction_method as TransactionMethod) || 'UPI',
      bank_date: bDate || new Date().toISOString().split('T')[0],
      value_date: bDate || new Date().toISOString().split('T')[0],
      transaction_time: safeString(tx.time),
      bank_narration: safeString(tx.narration) || `Payment via ${detectedSource}`,
      bank_amount: rawAmt,
      utr: rawUtr,
      reference_number: rawUtr,
      bank_reference: rawUtr,
      upi_reference: rawUtr,
      transaction_id: txnId,
      transaction_type: type,
      credit_or_debit: type,
      normalized_reference: normalizedRef,
      normalized_amount: rawAmt,
      imported_at: new Date().toISOString(),
      imported_by: userEmail || 'finance_team',
      reconciliation_status: 'available',
      matched_receipt_payment_id: null,
    });
  });

  const statementSummary: Omit<BankStatementRecord, 'id' | 'storage_path' | 'file_url'> = {
    file_name: fileName,
    file_size: Math.round(cleanBase64.length * 0.75),
    mime_type: mimeType,
    payment_source: detectedSource,
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
    notes: `Extracted with AI (${routingResult.modelUsed || 'Gemini'})`,
  };

  return {
    statementSummary,
    transactions,
    sampleRows: transactions.slice(0, 5),
    rawText: rawJson,
    modelUsed: routingResult.modelUsed,
  };
}
