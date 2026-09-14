import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Landmark,
  ExternalLink,
  ShieldAlert,
  Coins,
  Check,
  AlertCircle,
} from 'lucide-react';
import {
  ReceiptPaymentRecord,
  BankTransactionRecord,
  ReconciliationRecord,
} from '../../types/reconciliation';

interface MatchDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: ReceiptPaymentRecord | null;
  matchedTransaction: BankTransactionRecord | null;
  candidateTransactions: BankTransactionRecord[];
  onKnock: (payment: ReceiptPaymentRecord, transaction: BankTransactionRecord, notes?: string) => Promise<void>;
  onUnknock?: (payment: ReceiptPaymentRecord) => Promise<void>;
  onViewReceipt?: (receiptId: string) => void;
  reconciliationsHistory?: ReconciliationRecord[];
}

export const MatchDetailModal: React.FC<MatchDetailModalProps> = ({
  isOpen,
  onClose,
  payment,
  matchedTransaction,
  candidateTransactions,
  onKnock,
  onUnknock,
  onViewReceipt,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen || !payment) return null;

  const isKnocked = payment.reconciliation_status === 'knocked';
  const isDuplicate = payment.reconciliation_status === 'duplicate';
  const isAmountMismatch = payment.reconciliation_status === 'amount_mismatch';
  const isDateMismatch = payment.reconciliation_status === 'date_mismatch';
  const isCash = payment.reconciliation_status === 'cash_manual';
  const isExactMatch = payment.reconciliation_status === 'exact_match' || (payment.match_type === 'exact_match' && !isKnocked);

  // Verification checklist items
  const utrMatches = Boolean(
    matchedTransaction &&
    (payment.match_type === 'exact_match' ||
      payment.match_type === 'date_difference' ||
      payment.match_type === 'manual_review' ||
      isKnocked)
  );

  const amountMatches = Boolean(
    matchedTransaction &&
    payment.normalized_amount === matchedTransaction.normalized_amount
  );

  const dateDifferenceDays = payment.date_difference_days ?? 0;
  const isDateDifference = Math.abs(dateDifferenceDays) >= 1 && Math.abs(dateDifferenceDays) <= 2;
  const dateMatchesExact = dateDifferenceDays === 0;

  const handleConfirmKnock = async () => {
    if (!matchedTransaction && !isCash) return;
    setIsProcessing(true);
    try {
      if (isCash) {
        await onKnock(payment, {} as any, 'Verified cash branch receipt');
      } else if (matchedTransaction) {
        await onKnock(payment, matchedTransaction, payment.remark || 'Confirmed by finance reviewer');
      }
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnknockPayment = async () => {
    if (!onUnknock) return;
    setIsProcessing(true);
    try {
      await onUnknock(payment);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-slate-900">Payment Verification & Knocking</h2>
                {isExactMatch && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                    Exact Match (100%)
                  </span>
                )}
                {isKnocked && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 uppercase tracking-wider">
                    Knocked
                  </span>
                )}
                {isDuplicate && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 uppercase tracking-wider">
                    Duplicate / Fraud
                  </span>
                )}
                {isAmountMismatch && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 uppercase tracking-wider">
                    Amount Mismatch
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Receipt {payment.receipt_no || 'N/A'} • Student: {payment.student_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Duplicate Payment Alert */}
          {isDuplicate && payment.duplicate_info && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900">
              <div className="flex items-start space-x-3">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <span className="font-bold text-sm block text-rose-700">
                    DUPLICATE PAYMENT / UTR ALREADY USED
                  </span>
                  <p>
                    The claimed bank transaction UTR (<strong>{payment.duplicate_info.bank_utr}</strong>) has ALREADY been knocked to another student.
                  </p>
                  <div className="mt-2 p-3 bg-white rounded-lg border border-rose-200 font-mono text-[11px] grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Already Knocked To:</span>
                      <strong className="text-slate-900">{payment.duplicate_info.already_knocked_to_student_name}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Student ID:</span>
                      <strong className="text-slate-900">{payment.duplicate_info.already_knocked_to_student_id}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Receipt No:</span>
                      <strong className="text-slate-900">{payment.duplicate_info.already_knocked_to_receipt_no}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Amount:</span>
                      <strong className="text-slate-900">₹{payment.duplicate_info.already_knocked_to_amount.toLocaleString('en-IN')}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Payment Date:</span>
                      <strong className="text-slate-900">{payment.duplicate_info.already_knocked_to_payment_date}</strong>
                    </div>
                  </div>
                  <p className="text-[11px] text-rose-700 font-semibold mt-1">
                    Knocking is blocked to prevent double-crediting or fraud.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Side-by-Side: RECEIPT CLAIMED vs BANK ACTUAL */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* RECEIPT CLAIMED */}
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/60 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    RECEIPT CLAIMED
                  </h3>
                </div>
                {onViewReceipt && (
                  <button
                    onClick={() => onViewReceipt(payment.receipt_id)}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center space-x-1 font-medium"
                  >
                    <span>View Receipt</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-slate-500">Student:</span>
                  <span className="font-bold text-slate-900">{payment.student_name}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-slate-500">Receipt No:</span>
                  <span className="font-mono font-medium text-slate-800">{payment.receipt_no || '—'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-slate-500">Amount Received:</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    ₹{payment.amount_received.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-slate-500">Payment Ref / UTR:</span>
                  <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                    {payment.payment_ref_no || 'Not Recorded'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-slate-500">Payment Date:</span>
                  <span className="font-mono text-slate-800">{payment.payment_date || payment.receipt_date || '—'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-slate-500">Payment Mode:</span>
                  <span className="font-medium text-slate-800">{payment.mode_of_receipt || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Hostel Name:</span>
                  <span className="text-slate-700">{payment.hostel_name || '—'}</span>
                </div>
              </div>
            </div>

            {/* BANK ACTUAL */}
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/60 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center space-x-2">
                  <Landmark className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    BANK ACTUAL
                  </h3>
                </div>
                {matchedTransaction && (
                  <span className="text-[11px] font-mono text-slate-400">
                    {matchedTransaction.bank_transaction_id}
                  </span>
                )}
              </div>

              {matchedTransaction ? (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-500">Bank Amount:</span>
                    <span className="font-mono font-bold text-emerald-700 text-sm">
                      ₹{matchedTransaction.bank_amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-500">UTR / Ref:</span>
                    <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded">
                      {matchedTransaction.utr || matchedTransaction.reference_number || 'None'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-500">Bank Date:</span>
                    <span className="font-mono text-slate-800">{matchedTransaction.bank_date}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-500">Source:</span>
                    <span className="font-semibold text-slate-800">
                      {matchedTransaction.payment_source} ({matchedTransaction.source_file_name})
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-500">Method:</span>
                    <span className="font-medium text-slate-700">{matchedTransaction.transaction_method}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-500 block text-[11px]">Bank Narration:</span>
                    <p className="font-mono text-[11px] text-slate-800 bg-white p-2 rounded border border-slate-200 break-all">
                      {matchedTransaction.bank_narration}
                    </p>
                  </div>
                </div>
              ) : isCash ? (
                <div className="py-8 text-center text-slate-500 text-xs space-y-2">
                  <Coins className="w-8 h-8 text-blue-500 mx-auto" />
                  <p className="font-semibold text-slate-700">Cash Payment Record</p>
                  <p className="text-[11px] text-slate-500">
                    Receipt is marked as Cash. Manual finance confirmation required.
                  </p>
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs space-y-2">
                  <AlertTriangle className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="font-semibold text-slate-700">No Matching Bank Transaction Found</p>
                  <p className="text-[11px] text-slate-500">
                    The claimed reference ({payment.payment_ref_no || 'None'}) was not found in any uploaded bank statement.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* STATUS & THREE-POINT VERIFICATION */}
          {matchedTransaction && (
            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Verification Status
                  </span>
                  <div className="text-sm font-bold mt-0.5">
                    {isKnocked ? (
                      <span className="text-indigo-700 flex items-center space-x-1.5">
                        <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                        <span>KNOCKED & RECONCILED</span>
                      </span>
                    ) : isDuplicate ? (
                      <span className="text-rose-700 flex items-center space-x-1.5">
                        <ShieldAlert className="w-4 h-4 text-rose-600" />
                        <span>DUPLICATE PAYMENT / UTR ALREADY USED</span>
                      </span>
                    ) : isAmountMismatch ? (
                      <span className="text-amber-700 flex items-center space-x-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span>AMOUNT MISMATCH</span>
                      </span>
                    ) : isDateDifference ? (
                      <span className="text-emerald-700 flex items-center space-x-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>MATCH - POSTING DATE DIFFERENCE ({dateDifferenceDays > 0 ? `+${dateDifferenceDays}` : dateDifferenceDays} days)</span>
                      </span>
                    ) : dateMatchesExact ? (
                      <span className="text-emerald-700 flex items-center space-x-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>EXACT MATCH (100%)</span>
                      </span>
                    ) : (
                      <span className="text-slate-800">
                        {payment.reconciliation_status.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Score Pill */}
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Match Confidence
                  </span>
                  <span className="text-base font-mono font-bold text-slate-800">
                    {payment.match_score || (isKnocked || isExactMatch ? 100 : 0)}%
                  </span>
                </div>
              </div>

              {/* 3-Point Checklist: UTR, Amount, Date */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-xs">
                {/* UTR Check */}
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center space-x-2">
                  {utrMatches ? (
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 stroke-[2.5]" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  )}
                  <div>
                    <span className="text-slate-500 block text-[10px] font-medium">UTR / Ref</span>
                    <span className={`font-bold ${utrMatches ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {utrMatches ? 'Match' : 'Mismatch'}
                    </span>
                  </div>
                </div>

                {/* Amount Check */}
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center space-x-2">
                  {amountMatches ? (
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 stroke-[2.5]" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  )}
                  <div>
                    <span className="text-slate-500 block text-[10px] font-medium">Amount</span>
                    <span className={`font-bold ${amountMatches ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {amountMatches ? 'Match' : `Diff: ₹${Math.abs(payment.amount_received - (matchedTransaction?.bank_amount || 0))}`}
                    </span>
                  </div>
                </div>

                {/* Date Check */}
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center space-x-2">
                  {dateMatchesExact ? (
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 stroke-[2.5]" />
                  ) : isDateDifference ? (
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  )}
                  <div>
                    <span className="text-slate-500 block text-[10px] font-medium">Date</span>
                    <span className={`font-bold ${dateMatchesExact ? 'text-emerald-700' : isDateDifference ? 'text-amber-700' : 'text-rose-600'}`}>
                      {dateMatchesExact ? 'Match' : `${dateDifferenceDays > 0 ? `+${dateDifferenceDays}` : dateDifferenceDays}d Delay`}
                    </span>
                  </div>
                </div>
              </div>

              {payment.remark && (
                <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-200">
                  <strong>Engine Summary:</strong> {payment.remark}
                </p>
              )}
            </div>
          )}

          {/* Other Candidate Matches (if any) */}
          {candidateTransactions && candidateTransactions.length > 0 && !isDuplicate && (
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 space-y-2 text-xs">
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] block">
                Alternative Statement Candidates ({candidateTransactions.length})
              </span>
              <div className="space-y-1.5">
                {candidateTransactions.map((cand) => (
                  <div
                    key={cand.bank_transaction_id}
                    className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-800">{cand.payment_source}</span> •{' '}
                      <span className="font-mono text-emerald-700 font-bold">
                        ₹{cand.bank_amount.toLocaleString('en-IN')}
                      </span>{' '}
                      • <span className="font-mono text-slate-500">{cand.bank_date}</span>
                      <p className="font-mono text-[10px] text-slate-500 truncate max-w-md">
                        {cand.bank_narration}
                      </p>
                    </div>
                    {!isKnocked && (
                      <button
                        onClick={() => onKnock(payment, cand, 'Manually selected alternative candidate')}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 font-semibold text-[11px] rounded border border-slate-200"
                      >
                        Select Match
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div>
            {isKnocked && (
              <span className="text-xs text-slate-500">
                Knocked by <strong>{payment.knocked_by || 'Finance'}</strong> on {payment.knocked_at?.split('T')[0]}
              </span>
            )}
            {!isKnocked && isDuplicate && (
              <span className="text-xs text-rose-600 font-medium">
                Action blocked: This transaction is already claimed.
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition"
            >
              Close
            </button>

            {isKnocked && onUnknock && (
              <button
                onClick={handleUnknockPayment}
                disabled={isProcessing}
                className="px-4 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-semibold rounded-lg transition disabled:opacity-50"
              >
                Unknock Payment
              </button>
            )}

            {!isKnocked && matchedTransaction && !isDuplicate && (
              <button
                onClick={handleConfirmKnock}
                disabled={isProcessing}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center space-x-1.5 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isProcessing ? 'Confirming...' : 'Confirm Knock'}</span>
              </button>
            )}

            {!isKnocked && isCash && (
              <button
                onClick={handleConfirmKnock}
                disabled={isProcessing}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center space-x-1.5 disabled:opacity-50"
              >
                <Coins className="w-4 h-4" />
                <span>{isProcessing ? 'Confirming...' : 'Confirm Cash Knock'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
