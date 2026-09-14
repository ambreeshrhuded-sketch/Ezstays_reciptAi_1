export interface InternalExtractionData {
  hostel_name: string;
  receipt_prefix: string;
  receipt_number_handwritten: string;
  receipt_no: string;
  installment_no: string;
  installment_no_raw: string;
  ref: string;
  student_id: string;
  receipt_date: string;
  student_name: string;
  student_phone_no: string;
  father_name: string;
  father_phone_no: string;
  address: string;
  room_type: string;
  college: string;
  course: string;
  year: string;
  total_hostel_fee: number | null;
  amount_received: number | null;
  amount_received_words: string;
  balance_amount: number | null;
  next_installment_amount: string | number | null;
  next_due_date: string;
  payment_ref_no: string;
  payment_mode: string;
  bank_name: string;
  payment_date: string;
  cumulative_fee: number | null;
  discount: number | null;
  remark: string;
  payment_transactions?: Array<{
    transaction_index?: number;
    nature?: string;
    amount: number | null;
    payment_mode: string;
    payment_ref_no: string;
    payment_date: string;
    payment_month?: string;
    fees_channel?: string;
    remark?: string;
  }>;
}

export interface PaymentTransaction {
  transaction_index: number;
  nature: string;
  amount: number | null;
  payment_mode: string;
  payment_ref_no: string;
  payment_date: string;
  payment_month: string;
  fees_channel?: string;
  remark?: string;
}

export interface ReceiptData {
  // 33 Official Excel Columns
  hostel_name: string;
  final_hostel: string;
  entry_status: string;
  old_new: string;
  knocked_by: string;
  room_no_bed_no: string;
  final_status: string;
  student_id: string;
  receipt_no: string;
  nature: string;
  student_name: string;
  student_phone_no: string;
  student_id2: string;
  father_name: string;
  father_phone_no: string;
  address: string;
  college: string;
  course: string;
  year: string;
  room_type: string;
  total_fees: number | null;
  yearly_monthly: string;
  amount_received: number | null;
  cumulative_fee: number | null;
  percentage_of_fees: string;
  mode_of_receipt: string;
  fees_channel: string;
  receipt_date: string;
  payment_ref_no: string;
  payment_date: string;
  payment_month: string;
  discount: number | null;
  remark: string;

  // Extended Internal Fields (Preserved for business logic)
  installment_no?: string;
  installment_no_raw?: string;
  receipt_prefix?: string;
  receipt_number_handwritten?: string;
  amount_received_words?: string;
  balance_amount?: number | null;
  next_installment_amount?: string | number | null;
  next_due_date?: string;
  bank_name?: string;
  ref?: string;
  payment_transactions?: PaymentTransaction[];
}

export type FieldKey = keyof ReceiptData;

export interface FieldConfidence {
  [key: string]: number; // 0.0 to 1.0
}

export interface ValidationError {
  field: FieldKey | string;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export type ExtractionStatus = 'pending' | 'processing' | 'needs_review' | 'approved' | 'rejected' | 'failed';

export interface ExtractionDebugInfo {
  modelUsed?: string;
  isEscalated?: boolean;
  routingLog?: string[];
  executionTimeMs?: number;
  rawResponseText?: string;
  internalSchema?: InternalExtractionData;
  wordsMatchStatus?: 'matched' | 'mismatched' | 'not_present';
  wordsMatchMessage?: string;
  romanNumeralConverted?: boolean;
  prefixCombined?: boolean;
  specialRulesApplied?: string[];
  extractionTimestamp: string;
  errorStage?: 'image_ingestion' | 'gemini_request' | 'gemini_response' | 'json_parsing' | 'normalization' | 'validation' | 'storage' | string;
  errorMessage?: string;
  errorTimestamp?: string;
  missingFields?: string[];
  warnings?: string[];
}

export interface ReceiptRecord {
  id: string;
  batchId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  imageUrl: string; // base64 or blob URL
  thumbnailUrl?: string;
  uploadedAt: string;
  modelUsed?: string;
  isEscalated?: boolean;
  
  // Extraction metadata
  status: ExtractionStatus;
  overallConfidence: number;
  fieldConfidences: FieldConfidence;
  uncertainFields: string[];
  extractionNotes?: string;
  errorReason?: string;
  debugInfo?: ExtractionDebugInfo;
  
  // Structured 33 Fields + Extended
  data: ReceiptData;
  originalExtractedData?: ReceiptData;
  payment_transactions?: PaymentTransaction[];
  
  // Duplicate detection
  isDuplicate?: boolean;
  duplicateOfId?: string;
  duplicateReason?: string;
  duplicateScore?: number;
  
  // Storage & Cloud Persistence
  receipt_record_id?: string;
  storage_path?: string;
  receipt_url?: string;
  original_file_name?: string;
  mime_type?: string;
  file_size?: number;
  processing_status?: ExtractionStatus;
  created_at?: string;
  updated_at?: string;
  approved_at?: string;
  rejected_at?: string;
  processing_error?: string;

  // Review & Audit
  isReviewed: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
  correctionsCount: number;
  correctionsLog?: Array<{
    field: FieldKey;
    oldValue: any;
    newValue: any;
    timestamp: string;
    user: string;
  }>;
  validationWarnings?: ValidationError[];
}

export interface BatchInfo {
  id: string;
  batchNumber: string;
  name: string;
  createdAt: string;
  totalCount: number;
  processedCount: number;
  approvedCount: number;
  needsReviewCount: number;
  rejectedCount?: number;
  failedCount?: number;
  duplicateCount?: number;
  status?: string;
}

export interface AppSettings {
  confidenceThreshold: number; // default 0.85
  autoDerivePaymentMonth: boolean;
  autoFillFinalHostel: boolean;
  defaultHostelName: string;
  strictPhoneValidation: boolean;
  warningIfAmountExceedsTotal: boolean;
  knownHostels: string[];
  knownColleges: string[];
  knownStaffMembers: string[];
  allowedPaymentModes: string[];
  allowedFeeChannels: string[];
  allowedRoomTypes: string[];
  organizationName: string;
  currentUser: string;
}

export const REQUIRED_EXCEL_COLUMNS: { key: FieldKey; label: string; type: 'string' | 'number' | 'date' }[] = [
  { key: 'hostel_name', label: 'Hostel Name', type: 'string' },
  { key: 'final_hostel', label: 'Final Hostel', type: 'string' },
  { key: 'entry_status', label: 'Entry Status', type: 'string' },
  { key: 'old_new', label: 'Old/New', type: 'string' },
  { key: 'knocked_by', label: 'Knocked By', type: 'string' },
  { key: 'room_no_bed_no', label: 'Room No & Bed No:', type: 'string' },
  { key: 'final_status', label: 'Final Status', type: 'string' },
  { key: 'student_id', label: 'Student ID', type: 'string' },
  { key: 'receipt_no', label: 'Receipt No:', type: 'string' },
  { key: 'nature', label: 'Nature', type: 'string' },
  { key: 'student_name', label: 'Student Name', type: 'string' },
  { key: 'student_phone_no', label: 'Student Phone No:', type: 'string' },
  { key: 'student_id2', label: 'Student ID2', type: 'string' },
  { key: 'father_name', label: 'Father Name', type: 'string' },
  { key: 'father_phone_no', label: 'Father Phone no:', type: 'string' },
  { key: 'address', label: 'Address', type: 'string' },
  { key: 'college', label: 'College', type: 'string' },
  { key: 'course', label: 'Course', type: 'string' },
  { key: 'year', label: 'Year', type: 'string' },
  { key: 'room_type', label: 'Room Type', type: 'string' },
  { key: 'total_fees', label: 'Total Fees', type: 'number' },
  { key: 'yearly_monthly', label: 'Yearly/Monthly', type: 'string' },
  { key: 'amount_received', label: 'Amount Received', type: 'number' },
  { key: 'cumulative_fee', label: 'Cumulative Fee', type: 'number' },
  { key: 'percentage_of_fees', label: '% Of Fees', type: 'string' },
  { key: 'mode_of_receipt', label: 'Mode Of Receipt', type: 'string' },
  { key: 'fees_channel', label: 'Fees Channel', type: 'string' },
  { key: 'receipt_date', label: 'Receipt Date', type: 'string' },
  { key: 'payment_ref_no', label: 'Payment ref No:', type: 'string' },
  { key: 'payment_date', label: 'Payment Date', type: 'string' },
  { key: 'payment_month', label: 'Payment Month', type: 'string' },
  { key: 'discount', label: 'Discount', type: 'number' },
  { key: 'remark', label: 'Remark', type: 'string' },
];
