import * as XLSX from 'xlsx';
import { ReceiptRecord, REQUIRED_EXCEL_COLUMNS } from '../types/receipt';
import { safeString, safeNumber } from './safeUtils';
import { loadAllRecordsFromFirestore } from '../firebase/receiptStore';
import { getAllReceiptPayments, getAllBankTransactions } from '../firebase/reconciliationStore';

export interface ExportOptions {
  fileName?: string;
  onlyApproved?: boolean;
  filterStatus?: 'approved' | 'needs_review' | 'all' | 'failed';
  selectedRecordIds?: string[];
  includeAuditMetadata?: boolean;
  includeReconciliationData?: boolean;
  fetchFreshFromFirestore?: boolean;
}

export const EXCEL_RECEIPT_LINK_COL = {
  key: 'receipt_link',
  label: 'Receipt Link',
};

/**
 * Exports receipt records to a strictly formatted Microsoft Excel file.
 * Features:
 * - 33 standardized business columns in exact order
 * - 34th column: Clickable "Receipt Link" hyperlink with visible text "View Receipt"
 * - Numeric fields stored as numbers for calculations (Total Fees, Amount Received, Discount)
 * - Dates and codes preserved cleanly
 * - Source of truth verification against Firestore
 */
export async function exportRecordsToExcel(
  records: ReceiptRecord[],
  options: ExportOptions = {}
): Promise<{ success: boolean; count: number; fileName: string }> {
  let exportData: ReceiptRecord[] = [];

  // Step 1: Ensure we export FROM FIRESTORE as the permanent source of truth
  if (options.fetchFreshFromFirestore !== false) {
    try {
      const firestoreRecords = await loadAllRecordsFromFirestore();
      if (firestoreRecords && firestoreRecords.length > 0) {
        exportData = firestoreRecords;
      } else {
        exportData = records || [];
      }
    } catch (err) {
      console.warn('[Excel Export] Could not query fresh Firestore records, using passed records:', err);
      exportData = records || [];
    }
  } else {
    exportData = records || [];
  }

  // Step 2: Apply Filters
  if (options.selectedRecordIds && options.selectedRecordIds.length > 0) {
    const idSet = new Set(options.selectedRecordIds);
    exportData = exportData.filter((r) => idSet.has(r.id) || (r.receipt_record_id && idSet.has(r.receipt_record_id)));
  } else if (options.onlyApproved || options.filterStatus === 'approved') {
    exportData = exportData.filter((r) => r.status === 'approved');
  } else if (options.filterStatus === 'needs_review') {
    exportData = exportData.filter((r) => r.status === 'needs_review');
  } else if (options.filterStatus === 'failed') {
    exportData = exportData.filter((r) => r.status === 'failed');
  }

  if (exportData.length === 0) {
    throw new Error('No matching records available to export.');
  }

  // Step 3: Prepare headers
  const columnHeaders = REQUIRED_EXCEL_COLUMNS.map((c) => c.label);
  // Add 34th column
  columnHeaders.push(EXCEL_RECEIPT_LINK_COL.label);

  // Optional: Reconciliation & Bank Knocking Metadata
  let receiptPaymentsMap = new Map<string, any>();
  let bankTransactionsMap = new Map<string, any>();
  const shouldIncludeRecon = options.includeReconciliationData !== false;

  if (shouldIncludeRecon) {
    try {
      const [allPymts, allTxns] = await Promise.all([
        getAllReceiptPayments(),
        getAllBankTransactions(),
      ]);
      allPymts.forEach((p) => {
        const key = `${p.receipt_id}_${p.transaction_index ?? 0}`;
        receiptPaymentsMap.set(key, p);
        if (!receiptPaymentsMap.has(p.receipt_id)) {
          receiptPaymentsMap.set(p.receipt_id, p);
        }
      });
      allTxns.forEach((tx) => {
        bankTransactionsMap.set(tx.bank_transaction_id, tx);
      });
    } catch (err) {
      console.warn('[Excel Export] Could not load reconciliation audit data:', err);
    }

    columnHeaders.push(
      'Reconciliation Status',
      'Matched Bank Source',
      'Matched Bank UTR',
      'Matched Bank Date',
      'Matched Bank Amount',
      'Knock Match Type'
    );
  }

  if (options.includeAuditMetadata) {
    columnHeaders.push(
      'Record ID',
      'Original File',
      'Processing Status',
      'AI Overall Confidence',
      'Model Used',
      'Storage Path',
      'Reviewed By',
      'Reviewed At'
    );
  }

  // Step 4: Build rows matrix for precise formula & hyperlink attachment
  const rows: any[][] = [];

  // Push header row
  rows.push(columnHeaders);

  // Array to store hyperlink coordinates
  const hyperlinksToAttach: Array<{ r: number; c: number; target: string; tooltip: string }> = [];

  exportData.forEach((rec) => {
    const d = rec?.data || ({} as any);
    const rawUrl = rec.receipt_url || rec.imageUrl || '';
    const isRealUrl = rawUrl.startsWith('http://') || rawUrl.startsWith('https://');
    const receiptLinkColIndex = REQUIRED_EXCEL_COLUMNS.length; // index 33 (34th column)

    // Check for multiple payment transactions (1:N relationship flattened into rows)
    const txList = (Array.isArray(rec.payment_transactions) && rec.payment_transactions.length > 0)
      ? rec.payment_transactions
      : (Array.isArray(d.payment_transactions) && d.payment_transactions.length > 0)
      ? d.payment_transactions
      : null;

    if (txList && txList.length > 1) {
      // Physical receipt with MULTIPLE payments -> 1 Excel row per transaction
      txList.forEach((tx) => {
        const currentRowIndex = rows.length; // 1-based row index in Excel
        const rowValues: any[] = [];

        // Build data overlay for this transaction
        const rowData = {
          ...d,
          nature: tx.nature || d.nature,
          amount_received: tx.amount !== null && tx.amount !== undefined ? tx.amount : d.amount_received,
          mode_of_receipt: tx.payment_mode || d.mode_of_receipt,
          payment_ref_no: tx.payment_ref_no || d.payment_ref_no,
          payment_date: tx.payment_date || d.payment_date,
          payment_month: tx.payment_month || d.payment_month,
          fees_channel: tx.fees_channel || d.fees_channel || '',
          remark: tx.remark || d.remark || '',
        };

        // Columns 1 to 33
        REQUIRED_EXCEL_COLUMNS.forEach((col) => {
          const val = rowData[col.key];
          if (val === null || val === undefined) {
            rowValues.push('');
          } else if (col.type === 'number') {
            const numResult = safeNumber(val);
            rowValues.push(numResult.value !== null ? numResult.value : '');
          } else {
            rowValues.push(safeString(val));
          }
        });

        // Column 34: Receipt Link (all split rows point to the same physical receipt image)
        if (isRealUrl) {
          hyperlinksToAttach.push({
            r: currentRowIndex,
            c: receiptLinkColIndex,
            target: rawUrl,
            tooltip: `View Original Receipt (${rec.fileName || 'Document'})`,
          });
          rowValues.push('View Receipt');
        } else {
          rowValues.push(rec.receipt_url ? 'View Receipt' : 'Stored in App');
        }

        // Reconciliation & Knocking Columns
        if (shouldIncludeRecon) {
          const pKey = `${rec.id || rec.receipt_record_id}_${tx.transaction_index ?? 0}`;
          const p = receiptPaymentsMap.get(pKey) || receiptPaymentsMap.get(rec.id) || receiptPaymentsMap.get(rec.receipt_record_id);
          const matchedTx = p?.matched_bank_transaction_id ? bankTransactionsMap.get(p.matched_bank_transaction_id) : null;

          const statusLabel = p?.reconciliation_status === 'knocked'
            ? 'Reconciled (Knocked)'
            : p?.reconciliation_status === 'exact_match'
            ? 'Exact Match Ready'
            : p?.reconciliation_status === 'amount_mismatch'
            ? 'Amount Variance'
            : p?.reconciliation_status === 'date_mismatch'
            ? 'Date Discrepancy'
            : p?.reconciliation_status === 'not_found'
            ? 'No Matching Bank Txn'
            : p?.reconciliation_status || 'Pending Bank Import';

          rowValues.push(
            statusLabel,
            matchedTx?.payment_source || '',
            matchedTx?.utr || matchedTx?.reference_number || p?.payment_ref_no || '',
            matchedTx?.bank_date || '',
            matchedTx?.bank_amount !== undefined && matchedTx?.bank_amount !== null ? matchedTx.bank_amount : '',
            p?.match_type || (matchedTx ? 'exact_match' : '')
          );
        }

        if (options.includeAuditMetadata) {
          rowValues.push(
            rec.receipt_record_id || rec.id || '',
            rec.original_file_name || rec.fileName || '',
            rec.processing_status || rec.status || '',
            `${Math.round((rec.overallConfidence || 0) * 100)}%`,
            rec.modelUsed || 'gemini-2.5-flash',
            rec.storage_path || '',
            rec.reviewedBy || 'Unreviewed',
            rec.reviewedAt || ''
          );
        }

        rows.push(rowValues);
      });
    } else {
      // Standard physical receipt with SINGLE payment -> 1 Excel row
      const currentRowIndex = rows.length;
      const rowValues: any[] = [];

      // Columns 1 to 33
      REQUIRED_EXCEL_COLUMNS.forEach((col) => {
        const val = d[col.key];
        if (val === null || val === undefined) {
          rowValues.push('');
        } else if (col.type === 'number') {
          const numResult = safeNumber(val);
          rowValues.push(numResult.value !== null ? numResult.value : '');
        } else {
          rowValues.push(safeString(val));
        }
      });

      // Column 34: Receipt Link (Display text: "View Receipt")
      if (isRealUrl) {
        hyperlinksToAttach.push({
          r: currentRowIndex,
          c: receiptLinkColIndex,
          target: rawUrl,
          tooltip: `View Original Receipt (${rec.fileName || 'Document'})`,
        });
        rowValues.push('View Receipt');
      } else {
        rowValues.push(rec.receipt_url ? 'View Receipt' : 'Stored in App');
      }

      // Reconciliation & Knocking Columns
      if (shouldIncludeRecon) {
        const pKey = `${rec.id || rec.receipt_record_id}_0`;
        const p = receiptPaymentsMap.get(pKey) || receiptPaymentsMap.get(rec.id) || receiptPaymentsMap.get(rec.receipt_record_id);
        const matchedTx = p?.matched_bank_transaction_id ? bankTransactionsMap.get(p.matched_bank_transaction_id) : null;

        const statusLabel = p?.reconciliation_status === 'knocked'
          ? 'Reconciled (Knocked)'
          : p?.reconciliation_status === 'exact_match'
          ? 'Exact Match Ready'
          : p?.reconciliation_status === 'amount_mismatch'
          ? 'Amount Variance'
          : p?.reconciliation_status === 'date_mismatch'
          ? 'Date Discrepancy'
          : p?.reconciliation_status === 'not_found'
          ? 'No Matching Bank Txn'
          : p?.reconciliation_status || 'Pending Bank Import';

        rowValues.push(
          statusLabel,
          matchedTx?.payment_source || '',
          matchedTx?.utr || matchedTx?.reference_number || p?.payment_ref_no || '',
          matchedTx?.bank_date || '',
          matchedTx?.bank_amount !== undefined && matchedTx?.bank_amount !== null ? matchedTx.bank_amount : '',
          p?.match_type || (matchedTx ? 'exact_match' : '')
        );
      }

      if (options.includeAuditMetadata) {
        rowValues.push(
          rec.receipt_record_id || rec.id || '',
          rec.original_file_name || rec.fileName || '',
          rec.processing_status || rec.status || '',
          `${Math.round((rec.overallConfidence || 0) * 100)}%`,
          rec.modelUsed || 'gemini-2.5-flash',
          rec.storage_path || '',
          rec.reviewedBy || 'Unreviewed',
          rec.reviewedAt || ''
        );
      }

      rows.push(rowValues);
    }
  });

  // Step 5: Convert aoa to sheet
  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  // Step 6: Attach real clickable Excel Hyperlinks
  hyperlinksToAttach.forEach((hl) => {
    const cellAddress = XLSX.utils.encode_cell({ r: hl.r, c: hl.c });
    if (!worksheet[cellAddress]) {
      worksheet[cellAddress] = { t: 's', v: 'View Receipt' };
    }
    worksheet[cellAddress].l = {
      Target: hl.target,
      Tooltip: hl.tooltip,
    };
  });

  // Step 7: Format Column Widths
  const colWidths = REQUIRED_EXCEL_COLUMNS.map((col) => {
    let maxLen = col.label.length;
    exportData.forEach((rec) => {
      const v = safeString(rec?.data ? (rec.data as any)[col.key] : '');
      if (v.length > maxLen) maxLen = v.length;
    });
    return { wch: Math.min(Math.max(maxLen + 4, 14), 40) };
  });

  // Column width for Receipt Link column (at least 18 characters)
  colWidths.push({ wch: 18 });

  if (options.includeAuditMetadata) {
    colWidths.push(
      { wch: 22 }, // Record ID
      { wch: 25 }, // Source File
      { wch: 16 }, // Status
      { wch: 20 }, // Confidence
      { wch: 18 }, // Model
      { wch: 35 }, // Storage Path
      { wch: 18 }, // Reviewed By
      { wch: 22 }  // Reviewed At
    );
  }

  worksheet['!cols'] = colWidths;

  // Step 8: Freeze header row
  worksheet['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 1, topLeftCell: 'A2', activeCell: 'A2' }];

  // Step 9: Create workbook and export
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Hostel Receipts');

  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate()
  ).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const outFileName = options.fileName || `Hostel_Receipts_Master_${dateStr}.xlsx`;

  XLSX.writeFile(workbook, outFileName);

  return {
    success: true,
    count: exportData.length,
    fileName: outFileName,
  };
}

export function exportRecordsToCSV(records: ReceiptRecord[], options: ExportOptions = {}): string {
  let exportData = records || [];
  if (options.onlyApproved || options.filterStatus === 'approved') {
    exportData = exportData.filter((r) => r.status === 'approved');
  }

  const allColumns = [...REQUIRED_EXCEL_COLUMNS.map((c) => c.label), EXCEL_RECEIPT_LINK_COL.label];
  const headers = allColumns.map((label) => `"${safeString(label).replace(/"/g, '""')}"`).join(',');

  const lines = exportData.map((rec) => {
    const rowValues = REQUIRED_EXCEL_COLUMNS.map((col) => {
      const v = rec?.data ? (rec.data as any)[col.key] : '';
      const strVal = v === null || v === undefined ? '' : safeString(v);
      return `"${strVal.replace(/"/g, '""')}"`;
    });
    // Add Receipt URL for CSV
    const url = rec.receipt_url || rec.imageUrl || '';
    rowValues.push(`"${url.replace(/"/g, '""')}"`);
    return rowValues.join(',');
  });

  const csvContent = [headers, ...lines].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', (options.fileName || `Hostel_Receipts_${Date.now()}`).replace('.xlsx', '.csv'));
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return csvContent;
}
