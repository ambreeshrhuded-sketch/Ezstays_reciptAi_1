export type PaymentSource =
  | 'PhonePe'
  | 'GPay'
  | 'Axis Bank'
  | 'IDFC Bank'
  | 'Canara Bank'
  | 'HDFC Bank'
  | 'ICICI Bank'
  | 'State Bank of India'
  | 'Kotak Bank'
  | 'Other';

export type TransactionMethod =
  | 'UPI'
  | 'NEFT'
  | 'RTGS'
  | 'IMPS'
  | 'Cash'
  | 'Card'
  | 'Bank Transfer'
  | 'Internal Transfer'
  | 'Other';

export type TransactionType = 'credit' | 'debit';

export type BankTransactionReconciliationStatus =
  | 'available'
  | 'knocked'
  | 'potential_match'
  | 'needs_review';

export type BankTransactionStatus = BankTransactionReconciliationStatus;

export type ReceiptPaymentReconciliationStatus =
  | 'pending'
  | 'exact_match'
  | 'knocked'
  | 'duplicate'
  | 'not_found'
  | 'amount_mismatch'
  | 'date_mismatch'
  | 'multiple_matches'
  | 'cash_manual'
  | 'needs_review';

export type ReconciliationStatus = ReceiptPaymentReconciliationStatus;

export type MatchType =
  | 'exact_match'
  | 'date_difference'
  | 'narration_ref'
  | 'amount_date_candidate'
  | 'manual_knock'
  | 'cash_approved';

export interface BankStatementRecord {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_path?: string;
  file_url?: string;
  payment_source: PaymentSource | string;
  total_transactions: number;
  credit_count: number;
  debit_count: number;
  total_credit_amount: number;
  total_debit_amount: number;
  date_range_start?: string;
  date_range_end?: string;
  imported_at: string;
  imported_by: string;
  import_status: 'preview' | 'imported' | 'failed';
  notes?: string;
}

export interface BankTransactionRecord {
  bank_transaction_id: string;
  source_file_id: string;
  source_file_name: string;

  payment_source: PaymentSource | string;
  transaction_method: TransactionMethod | string;

  bank_date: string;
  value_date?: string;
  transaction_time?: string;

  bank_narration: string;
  bank_amount: number;

  utr: string;
  reference_number: string;
  bank_reference: string;
  upi_reference: string;
  transaction_id: string;
  phonepe_reference?: string;
  phonepe_reference_id?: string;
  merchant_reference_id?: string;
  merchant_order_id?: string;
  rrn?: string;
  raw_references?: string[];
  all_references?: string[];
  reference_aliases?: string[];
  raw_row?: any;

  // Standardized field aliases
  transaction_date?: string;
  narration?: string;
  amount?: number;

  transaction_type: TransactionType;
  credit_or_debit: TransactionType;

  normalized_reference: string;
  normalized_amount: number;

  imported_at: string;
  imported_by: string;

  reconciliation_status: BankTransactionReconciliationStatus;
  matched_receipt_payment_id?: string | null;
  matched_student_name?: string;
  matched_student_id?: string;
  matched_receipt_no?: string;
  knocked_at?: string;
  knocked_by?: string;
}

export interface DuplicateKnockingInfo {
  already_knocked_to_student_name: string;
  already_knocked_to_student_id: string;
  already_knocked_to_receipt_no: string;
  already_knocked_to_nature: string;
  already_knocked_to_amount: number;
  already_knocked_to_payment_date: string;
  bank_utr: string;
}

export interface ReceiptPaymentRecord {
  id: string; // e.g. `${receipt_id}_p${index}`
  receipt_id: string;
  receipt_record_id?: string;
  transaction_index?: number;
  hostel_name: string;
  student_id: string;
  student_name: string;
  receipt_no: string;
  nature: string;
  amount_received: number;
  mode_of_receipt: string;
  fees_channel: string;
  receipt_date: string;
  payment_ref_no: string;
  payment_date: string;
  payment_month?: string;
  receipt_link?: string;
  receipt_image_url?: string;

  normalized_ref: string;
  normalized_amount: number;

  reconciliation_status: ReceiptPaymentReconciliationStatus;
  matched_bank_transaction_id?: string | null;
  matched_bank_transaction?: BankTransactionRecord | null;
  knocked_by?: string;
  knocked_at?: string;
  match_type?: MatchType;
  match_score?: number; // 0 to 100
  date_difference_days?: number;
  remark?: string;

  candidate_transaction_ids?: string[];
  duplicate_info?: DuplicateKnockingInfo;
  created_at: string;
  updated_at: string;
}

export interface ReconciliationRecord {
  id: string;
  receipt_payment_id: string;
  bank_transaction_id: string;
  receipt_id: string;
  receipt_no: string;
  student_id: string;
  student_name: string;
  nature: string;
  receipt_amount: number;
  bank_amount: number;
  receipt_utr: string;
  bank_utr: string;
  match_type: MatchType;
  match_score: number;
  date_difference_days: number;
  knocked_at: string;
  knocked_by: string;
  notes?: string;
  status: 'active' | 'unknocked';
  unknocked_at?: string;
  unknocked_by?: string;
  unknock_reason?: string;
}

export interface ReconciliationAuditLog {
  id: string;
  action: 'KNOCK' | 'UNKNOCK' | 'AUTO_MATCH' | 'MANUAL_OVERRIDE' | 'STATEMENT_IMPORT' | 'STATEMENT_DELETE';
  receipt_payment_id?: string;
  bank_transaction_id?: string;
  reconciliation_id?: string;
  statement_id?: string;
  receipt_no?: string;
  student_name?: string;
  user: string;
  timestamp: string;
  details: string;
  metadata?: Record<string, any>;
}

export interface ReconciliationKPIs {
  totalReceiptPayments: number;
  knockedCount: number;
  pendingCount: number;
  duplicateCount: number;
  amountMismatchCount: number;
  notFoundCount: number;
  cashManualCount: number;
  dateMismatchCount: number;
  multipleMatchesCount: number;
  needsReviewCount: number;
  totalKnockedAmount: number;
  totalPendingAmount: number;
}
