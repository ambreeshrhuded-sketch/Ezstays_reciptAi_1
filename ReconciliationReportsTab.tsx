import React, { useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Building2,
  Landmark,
  History,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  ReceiptPaymentRecord,
  BankTransactionRecord,
  ReconciliationRecord,
  ReconciliationAuditLog,
} from '../../types/reconciliation';

interface ReconciliationReportsTabProps {
  payments: ReceiptPaymentRecord[];
  bankTransactions: BankTransactionRecord[];
  auditLogs: ReconciliationAuditLog[];
}

export const ReconciliationReportsTab: React.FC<ReconciliationReportsTabProps> = ({
  payments,
  bankTransactions,
  auditLogs,
}) => {
  // Hostel Summary
  const hostelSummaries = useMemo(() => {
    const map = new Map<
      string,
      {
        hostel: string;
        totalReceipts: number;
        knockedCount: number;
        pendingCount: number;
        exceptionCount: number;
        totalAmount: number;
        knockedAmount: number;
      }
    >();

    payments.forEach((p) => {
      const hName = p.hostel_name || 'Unassigned Hostel';
      if (!map.has(hName)) {
        map.set(hName, {
          hostel: hName,
          totalReceipts: 0,
          knockedCount: 0,
          pendingCount: 0,
          exceptionCount: 0,
          totalAmount: 0,
          knockedAmount: 0,
        });
      }
      const item = map.get(hName)!;
      item.totalReceipts++;
      item.totalAmount += p.amount_received;

      if (p.reconciliation_status === 'knocked') {
        item.knockedCount++;
        item.knockedAmount += p.amount_received;
      } else if (p.reconciliation_status === 'pending') {
        item.pendingCount++;
      } else {
        item.exceptionCount++;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [payments]);

  // Source Summary
  const sourceSummaries = useMemo(() => {
    const map = new Map<
      string,
      {
        source: string;
        totalTxns: number;
        totalAmount: number;
        knockedCount: number;
        knockedAmount: number;
        availableCount: number;
        availableAmount: number;
      }
    >();

    bankTransactions.forEach((tx) => {
      const sName = tx.payment_source || 'Other';
      if (!map.has(sName)) {
        map.set(sName, {
          source: sName,
          totalTxns: 0,
          totalAmount: 0,
          knockedCount: 0,
          knockedAmount: 0,
          availableCount: 0,
          availableAmount: 0,
        });
      }
      const item = map.get(sName)!;
      item.totalTxns++;
      item.totalAmount += tx.bank_amount;

      if (tx.reconciliation_status === 'knocked') {
        item.knockedCount++;
        item.knockedAmount += tx.bank_amount;
      } else {
        item.availableCount++;
        item.availableAmount += tx.bank_amount;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [bankTransactions]);

  // Export to Excel handler
  const handleExportReconciliationExcel = () => {
    const wb = XLSX.utils.book_new();

    // 1. Knocked Payments Sheet
    const knockedRows = payments
      .filter((p) => p.reconciliation_status === 'knocked')
      .map((p) => ({
        'Student ID': p.student_id,
        'Student Name': p.student_name,
        'Hostel Name': p.hostel_name,
        'Receipt No': p.receipt_no,
        'Nature': p.nature,
        'Receipt Amount': p.amount_received,
        'Receipt UTR': p.payment_ref_no,
        'Receipt Date': p.payment_date || p.receipt_date,
        'Bank Source': p.matched_bank_transaction?.payment_source || '',
        'Bank Date': p.matched_bank_transaction?.bank_date || '',
        'Bank Amount': p.matched_bank_transaction?.bank_amount || '',
        'Bank UTR': p.matched_bank_transaction?.utr || '',
        'Bank Narration': p.matched_bank_transaction?.bank_narration || '',
        'Knocked By': p.knocked_by || '',
        'Knocked At': p.knocked_at || '',
        'Match Type': p.match_type || 'exact_match',
      }));
    const wsKnocked = XLSX.utils.json_to_sheet(knockedRows);
    XLSX.utils.book_append_sheet(wb, wsKnocked, 'Knocked Payments');

    // 2. Exceptions Sheet
    const exceptionRows = payments
      .filter((p) => p.reconciliation_status !== 'knocked')
      .map((p) => ({
        'Status': p.reconciliation_status,
        'Student ID': p.student_id,
        'Student Name': p.student_name,
        'Hostel Name': p.hostel_name,
        'Receipt No': p.receipt_no,
        'Nature': p.nature,
        'Claimed Amount': p.amount_received,
        'Claimed Mode': p.mode_of_receipt,
        'Claimed UTR': p.payment_ref_no,
        'Receipt Date': p.payment_date || p.receipt_date,
        'Engine Remark': p.remark,
        'Already Knocked To': p.duplicate_info?.already_knocked_to_student_name || '',
        'Duplicate Receipt No': p.duplicate_info?.already_knocked_to_receipt_no || '',
      }));
    const wsExceptions = XLSX.utils.json_to_sheet(exceptionRows);
    XLSX.utils.book_append_sheet(wb, wsExceptions, 'Exceptions & Pending');

    // 3. Bank Statement Sheet
    const bankRows = bankTransactions.map((tx) => ({
      'Bank Source': tx.payment_source,
      'Method': tx.transaction_method,
      'Date': tx.bank_date,
      'Narration': tx.bank_narration,
      'Amount': tx.bank_amount,
      'Type': tx.transaction_type,
      'UTR': tx.utr,
      'Status': tx.reconciliation_status,
      'Matched Student': tx.matched_student_name || '',
      'Matched Receipt': tx.matched_receipt_no || '',
    }));
    const wsBank = XLSX.utils.json_to_sheet(bankRows);
    XLSX.utils.book_append_sheet(wb, wsBank, 'Bank Transactions');

    // Save
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `HostelFlow_Reconciliation_Report_${dateStr}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Export Trigger */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Reconciliation Reports & Audit Ledger</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Detailed hostel collection knocking ratios, banking source settlement distribution, and chronological audit trail of all knocking operations.
          </p>
        </div>
        <button
          onClick={handleExportReconciliationExcel}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center space-x-2 shrink-0 self-start sm:self-auto"
        >
          <Download className="w-4 h-4" />
          <span>Export Reconciliation Excel</span>
        </button>
      </div>

      {/* Hostel Breakdown Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Hostel Collection Knocking Ratios
            </h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                <th className="py-2.5 px-4">Hostel Name</th>
                <th className="py-2.5 px-3 text-right">Receipts</th>
                <th className="py-2.5 px-3 text-right">Knocked</th>
                <th className="py-2.5 px-3 text-right">Exceptions</th>
                <th className="py-2.5 px-4 text-right">Total Claimed</th>
                <th className="py-2.5 px-4 text-right">Knocked Amount</th>
                <th className="py-2.5 px-4 text-right">Knocked %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {hostelSummaries.map((item) => {
                const pct = item.totalAmount > 0 ? Math.round((item.knockedAmount / item.totalAmount) * 100) : 0;
                return (
                  <tr key={item.hostel} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4 font-semibold text-slate-800">{item.hostel}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{item.totalReceipts}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-bold">
                      {item.knockedCount}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-rose-600">
                      {item.exceptionCount}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-medium text-slate-800">
                      ₹{item.totalAmount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-700">
                      ₹{item.knockedAmount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <span className="font-bold text-slate-800">{pct}%</span>
                        <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${pct === 100 ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Source Distribution */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Landmark className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Payment Source / Bank Settlement Summary
            </h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                <th className="py-2.5 px-4">Payment Source / Bank</th>
                <th className="py-2.5 px-3 text-right">Transactions</th>
                <th className="py-2.5 px-4 text-right">Total Statement Inflow</th>
                <th className="py-2.5 px-4 text-right">Knocked to Receipts</th>
                <th className="py-2.5 px-4 text-right">Unclaimed / Available</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sourceSummaries.map((s) => (
                <tr key={s.source} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-4 font-semibold text-slate-800">{s.source}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{s.totalTxns}</td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                    ₹{s.totalAmount.toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-emerald-700 font-bold">
                    ₹{s.knockedAmount.toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-slate-500 font-medium">
                    ₹{s.availableAmount.toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <History className="w-4 h-4 text-slate-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Reconciliation Audit Trail ({auditLogs.length})
            </h3>
          </div>
        </div>

        <div className="overflow-x-auto max-h-80">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 sticky top-0">
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">User</th>
                <th className="py-2.5 px-3">Receipt No</th>
                <th className="py-2.5 px-3">Student Name</th>
                <th className="py-2.5 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditLogs.length > 0 ? (
                auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                      {log.timestamp.replace('T', ' ').substring(0, 19)}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          log.action === 'KNOCK'
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.action === 'UNKNOCK'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 font-medium whitespace-nowrap">{log.user}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-700 whitespace-nowrap">
                      {log.receipt_no || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-800 font-medium whitespace-nowrap">
                      {log.student_name || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 text-[11px]">{log.details}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    No reconciliation audit events logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
