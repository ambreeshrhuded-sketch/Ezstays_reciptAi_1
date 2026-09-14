import React, { useState, useMemo } from 'react';
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Coins,
  Sparkles,
  RefreshCw,
  Eye,
  RotateCcw,
  CheckCheck,
} from 'lucide-react';
import {
  ReceiptPaymentRecord,
  BankTransactionRecord,
  ReconciliationRecord,
  ReconciliationStatus,
} from '../../types/reconciliation';

interface MatchingKnockingTabProps {
  payments: ReceiptPaymentRecord[];
  bankTransactions: BankTransactionRecord[];
  onOpenDetailModal: (payment: ReceiptPaymentRecord) => void;
  onKnock: (payment: ReceiptPaymentRecord, transaction: BankTransactionRecord, notes?: string) => Promise<void>;
  onUnknock: (payment: ReceiptPaymentRecord) => Promise<void>;
  onAutoMatchAll: () => Promise<void>;
  isMatching: boolean;
}

export const MatchingKnockingTab: React.FC<MatchingKnockingTabProps> = ({
  payments,
  bankTransactions,
  onOpenDetailModal,
  onKnock,
  onUnknock,
  onAutoMatchAll,
  isMatching,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [hostelFilter, setHostelFilter] = useState<string>('all');
  const [modeFilter, setModeFilter] = useState<string>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [showAutoMatchConfirm, setShowAutoMatchConfirm] = useState(false);

  // Bank transactions map for quick lookups
  const bankTxnMap = useMemo(() => {
    return new Map(bankTransactions.map((tx) => [tx.bank_transaction_id, tx]));
  }, [bankTransactions]);

  // Unique hostels for dropdown
  const uniqueHostels = useMemo(() => {
    const set = new Set<string>();
    payments.forEach((p) => {
      if (p.hostel_name) set.add(p.hostel_name);
    });
    return Array.from(set).sort();
  }, [payments]);

  // Unique modes for dropdown
  const uniqueModes = useMemo(() => {
    const set = new Set<string>();
    payments.forEach((p) => {
      if (p.mode_of_receipt) set.add(p.mode_of_receipt);
    });
    return Array.from(set).sort();
  }, [payments]);

  // Count ready auto-matchable payments
  const autoMatchReadyCount = useMemo(() => {
    return payments.filter(
      (p) =>
        p.reconciliation_status === 'pending' &&
        p.matched_bank_transaction_id &&
        p.match_type === 'exact_match'
    ).length;
  }, [payments]);

  // Filtered payments
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (statusFilter !== 'all' && p.reconciliation_status !== statusFilter) return false;
      if (hostelFilter !== 'all' && p.hostel_name !== hostelFilter) return false;
      if (modeFilter !== 'all' && p.mode_of_receipt !== modeFilter) return false;

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        p.student_name.toLowerCase().includes(term) ||
        (p.student_id && p.student_id.toLowerCase().includes(term)) ||
        (p.receipt_no && p.receipt_no.toLowerCase().includes(term)) ||
        (p.payment_ref_no && p.payment_ref_no.toLowerCase().includes(term)) ||
        (p.hostel_name && p.hostel_name.toLowerCase().includes(term)) ||
        String(p.amount_received).includes(term)
      );
    });
  }, [payments, statusFilter, hostelFilter, modeFilter, searchTerm]);

  const handleKnock = async (payment: ReceiptPaymentRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!payment.matched_bank_transaction_id) {
      onOpenDetailModal(payment);
      return;
    }
    const matchedTx = bankTxnMap.get(payment.matched_bank_transaction_id);
    if (!matchedTx) {
      onOpenDetailModal(payment);
      return;
    }
    setActionLoadingId(payment.id);
    try {
      await onKnock(payment, matchedTx);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUnknock = async (payment: ReceiptPaymentRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoadingId(payment.id);
    try {
      await onUnknock(payment);
    } finally {
      setActionLoadingId(null);
    }
  };

  const getStatusBadge = (status: ReconciliationStatus) => {
    switch (status) {
      case 'exact_match':
        return (
          <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase tracking-wider">
            <CheckCircle2 className="w-3 h-3" />
            <span>Exact Match</span>
          </span>
        );
      case 'knocked':
        return (
          <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 uppercase tracking-wider">
            <CheckCircle2 className="w-3 h-3" />
            <span>Knocked</span>
          </span>
        );
      case 'duplicate':
        return (
          <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 uppercase tracking-wider animate-pulse">
            <ShieldAlert className="w-3 h-3" />
            <span>Duplicate</span>
          </span>
        );
      case 'amount_mismatch':
        return (
          <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 uppercase tracking-wider">
            <AlertTriangle className="w-3 h-3" />
            <span>Amt Mismatch</span>
          </span>
        );
      case 'date_mismatch':
        return (
          <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 uppercase tracking-wider">
            <AlertTriangle className="w-3 h-3" />
            <span>Date Mismatch</span>
          </span>
        );
      case 'cash_manual':
        return (
          <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 uppercase tracking-wider">
            <Coins className="w-3 h-3" />
            <span>Cash (Manual)</span>
          </span>
        );
      case 'not_found':
        return (
          <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase tracking-wider">
            <span>Not In Bank</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase tracking-wider">
            <span>Pending</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Controls Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search student, UTR, receipt no, hostel..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          >
            <option value="all">All Statuses ({payments.length})</option>
            <option value="exact_match">Exact Match</option>
            <option value="pending">Pending</option>
            <option value="knocked">Knocked</option>
            <option value="duplicate">Duplicate / Fraud</option>
            <option value="amount_mismatch">Amount Mismatch</option>
            <option value="date_mismatch">Date Mismatch</option>
            <option value="not_found">Not Found in Bank</option>
            <option value="cash_manual">Cash - Manual</option>
          </select>

          {/* Hostel Filter */}
          <select
            value={hostelFilter}
            onChange={(e) => setHostelFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          >
            <option value="all">All Hostels</option>
            {uniqueHostels.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>

          {/* Mode Filter */}
          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          >
            <option value="all">All Modes</option>
            {uniqueModes.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          {/* Auto Match Button */}
          <button
            onClick={() => setShowAutoMatchConfirm(true)}
            disabled={isMatching}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm transition flex items-center space-x-1.5 disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Auto Match All</span>
          </button>
        </div>
      </div>

      {/* Auto Match Confirmation Modal */}
      {showAutoMatchConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Run Deterministic Auto-Matching</h3>
                <p className="text-xs text-slate-500">Exact Reference & Amount Knocking Engine</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2 text-slate-600">
              <p>
                The rule-based engine will scan all <strong>{payments.length} receipt payment rows</strong> against <strong>{bankTransactions.length} bank transactions</strong>.
              </p>
              <div className="space-y-1 text-[11px]">
                <div className="flex items-center justify-between">
                  <span>Exact UTR Matches Ready:</span>
                  <span className="font-bold text-emerald-700">{autoMatchReadyCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>One-to-One Duplicate Enforcement:</span>
                  <span className="font-bold text-slate-800">Strictly Enforced</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowAutoMatchConfirm(false)}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setShowAutoMatchConfirm(false);
                  await onAutoMatchAll();
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center space-x-1.5"
              >
                <CheckCheck className="w-4 h-4" />
                <span>Confirm & Run Auto-Match</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Matching Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                <th className="py-3 px-3">Student Name / ID</th>
                <th className="py-3 px-3">Receipt No</th>
                <th className="py-3 px-3">Nature</th>
                <th className="py-3 px-3 text-right">Amount</th>
                <th className="py-3 px-3">Mode</th>
                <th className="py-3 px-3">Claimed UTR / Ref</th>
                <th className="py-3 px-3">Payment Date</th>
                <th className="py-3 px-3">Bank Match Candidate</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPayments.length > 0 ? (
                filteredPayments.map((p) => {
                  const isKnocked = p.reconciliation_status === 'knocked';
                  const isDuplicate = p.reconciliation_status === 'duplicate';
                  const matchedTx = p.matched_bank_transaction_id
                    ? bankTxnMap.get(p.matched_bank_transaction_id)
                    : null;

                  return (
                    <tr
                      key={p.id}
                      onClick={() => onOpenDetailModal(p)}
                      className={`hover:bg-slate-50/80 transition cursor-pointer ${
                        isKnocked
                          ? 'bg-emerald-50/20'
                          : isDuplicate
                          ? 'bg-rose-50/30'
                          : p.reconciliation_status === 'amount_mismatch'
                          ? 'bg-amber-50/20'
                          : ''
                      }`}
                    >
                      {/* Student Info */}
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-900 block truncate max-w-[140px]">
                          {p.student_name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {p.student_id || 'No ID'}
                        </span>
                      </td>

                      {/* Receipt No */}
                      <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap">
                        {p.receipt_no || '—'}
                      </td>

                      {/* Nature */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[11px]">
                          {p.nature || 'Installment'}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        ₹{p.amount_received.toLocaleString('en-IN')}
                      </td>

                      {/* Mode */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="text-slate-600 font-medium text-[11px]">
                          {p.mode_of_receipt || '—'}
                        </span>
                      </td>

                      {/* Claimed UTR */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {p.payment_ref_no ? (
                          <span className="font-mono font-bold text-[11px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                            {p.payment_ref_no}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">Not Recorded</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">
                        {p.payment_date || p.receipt_date || '—'}
                      </td>

                      {/* Matched Bank Transaction Candidate */}
                      <td className="py-3 px-3 max-w-xs">
                        {matchedTx ? (
                          <div className="text-[11px]">
                            <div className="flex items-center space-x-1">
                              <span className="font-bold text-slate-800">{matchedTx.payment_source}</span>
                              <span className="text-slate-400 font-mono text-[10px]">({matchedTx.bank_date})</span>
                            </div>
                            <span className="font-mono text-emerald-700 font-semibold block">
                              ₹{matchedTx.bank_amount.toLocaleString('en-IN')} • {matchedTx.utr || 'No UTR'}
                            </span>
                          </div>
                        ) : p.reconciliation_status === 'cash_manual' ? (
                          <span className="text-blue-600 text-[11px] font-medium">
                            Cash payment (Branch collection)
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">No bank match</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {getStatusBadge(p.reconciliation_status)}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          {isKnocked ? (
                            <button
                              onClick={(e) => handleUnknock(p, e)}
                              disabled={actionLoadingId === p.id}
                              className="px-2 py-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded text-[11px] font-semibold transition border border-transparent hover:border-rose-200"
                              title="Unknock"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          ) : matchedTx && !isDuplicate ? (
                            <button
                              onClick={(e) => handleKnock(p, e)}
                              disabled={actionLoadingId === p.id}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-[11px] shadow-sm transition flex items-center space-x-1"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Confirm Knock</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => onOpenDetailModal(p)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-[11px] transition flex items-center space-x-1"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Inspect</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 text-xs">
                    <span>No receipt payment records match the filter criteria.</span>
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
