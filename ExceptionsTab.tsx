import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  Coins,
  Calendar,
  Layers,
  HelpCircle,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import {
  ReceiptPaymentRecord,
  BankTransactionRecord,
  ReconciliationStatus,
} from '../../types/reconciliation';

interface ExceptionsTabProps {
  payments: ReceiptPaymentRecord[];
  bankTransactions: BankTransactionRecord[];
  onOpenDetailModal: (payment: ReceiptPaymentRecord) => void;
  onKnock: (payment: ReceiptPaymentRecord, transaction: BankTransactionRecord, notes?: string) => Promise<void>;
}

export const ExceptionsTab: React.FC<ExceptionsTabProps> = ({
  payments,
  bankTransactions,
  onOpenDetailModal,
  onKnock,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');

  // Filter only exceptions (exclude knocked and standard pending if not problematic)
  const exceptionPayments = useMemo(() => {
    return payments.filter(
      (p) =>
        p.reconciliation_status === 'duplicate' ||
        p.reconciliation_status === 'amount_mismatch' ||
        p.reconciliation_status === 'date_mismatch' ||
        p.reconciliation_status === 'not_found' ||
        p.reconciliation_status === 'cash_manual' ||
        p.reconciliation_status === 'multiple_matches' ||
        p.reconciliation_status === 'needs_review'
    );
  }, [payments]);

  // Group counts
  const counts = useMemo(() => {
    let duplicate = 0;
    let notFound = 0;
    let amountMismatch = 0;
    let dateMismatch = 0;
    let cashManual = 0;
    let multipleMatches = 0;

    payments.forEach((p) => {
      if (p.reconciliation_status === 'duplicate') duplicate++;
      else if (p.reconciliation_status === 'not_found') notFound++;
      else if (p.reconciliation_status === 'amount_mismatch') amountMismatch++;
      else if (p.reconciliation_status === 'date_mismatch') dateMismatch++;
      else if (p.reconciliation_status === 'cash_manual') cashManual++;
      else if (p.reconciliation_status === 'multiple_matches') multipleMatches++;
    });

    return {
      all: exceptionPayments.length,
      duplicate,
      notFound,
      amountMismatch,
      dateMismatch,
      cashManual,
      multipleMatches,
    };
  }, [payments, exceptionPayments]);

  const filteredExceptions = useMemo(() => {
    if (activeCategory === 'all') return exceptionPayments;
    return exceptionPayments.filter((p) => p.reconciliation_status === activeCategory);
  }, [exceptionPayments, activeCategory]);

  return (
    <div className="space-y-6">
      {/* Category Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            activeCategory === 'all'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          All Exceptions ({counts.all})
        </button>
        <button
          onClick={() => setActiveCategory('duplicate')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 ${
            activeCategory === 'duplicate'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-rose-700 hover:bg-rose-50'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Duplicates / Fraud ({counts.duplicate})</span>
        </button>
        <button
          onClick={() => setActiveCategory('not_found')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            activeCategory === 'not_found'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          Not in Bank ({counts.notFound})
        </button>
        <button
          onClick={() => setActiveCategory('amount_mismatch')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 ${
            activeCategory === 'amount_mismatch'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-amber-700 hover:bg-amber-50'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Amount Mismatch ({counts.amountMismatch})</span>
        </button>
        <button
          onClick={() => setActiveCategory('date_mismatch')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 ${
            activeCategory === 'date_mismatch'
              ? 'bg-orange-600 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-orange-700 hover:bg-orange-50'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Date Mismatch ({counts.dateMismatch})</span>
        </button>
        <button
          onClick={() => setActiveCategory('cash_manual')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 ${
            activeCategory === 'cash_manual'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-blue-700 hover:bg-blue-50'
          }`}
        >
          <Coins className="w-3.5 h-3.5" />
          <span>Cash - Manual ({counts.cashManual})</span>
        </button>
      </div>

      {/* Exception Cards List */}
      <div className="space-y-3">
        {filteredExceptions.length > 0 ? (
          filteredExceptions.map((p) => {
            const isDuplicate = p.reconciliation_status === 'duplicate';
            const isAmtMismatch = p.reconciliation_status === 'amount_mismatch';
            const isDateMismatch = p.reconciliation_status === 'date_mismatch';
            const isNotFound = p.reconciliation_status === 'not_found';
            const isCash = p.reconciliation_status === 'cash_manual';

            return (
              <div
                key={p.id}
                onClick={() => onOpenDetailModal(p)}
                className={`p-4 rounded-xl border bg-white shadow-sm hover:shadow-md transition cursor-pointer ${
                  isDuplicate
                    ? 'border-rose-200 bg-rose-50/20'
                    : isAmtMismatch
                    ? 'border-amber-200 bg-amber-50/20'
                    : isDateMismatch
                    ? 'border-orange-200 bg-orange-50/20'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-slate-900">{p.student_name}</span>
                      <span className="font-mono text-xs text-slate-500">
                        ({p.student_id || 'No ID'})
                      </span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="font-mono text-xs text-slate-600">
                        Rec: {p.receipt_no || '—'}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          isDuplicate
                            ? 'bg-rose-100 text-rose-800'
                            : isAmtMismatch
                            ? 'bg-amber-100 text-amber-800'
                            : isDateMismatch
                            ? 'bg-orange-100 text-orange-800'
                            : isCash
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {p.reconciliation_status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                      <div>
                        Claimed Amount: <strong className="text-slate-900 font-mono">₹{p.amount_received.toLocaleString('en-IN')}</strong>
                      </div>
                      <div>
                        Mode: <strong>{p.mode_of_receipt || '—'}</strong>
                      </div>
                      <div>
                        UTR / Ref: <strong className="font-mono text-indigo-700">{p.payment_ref_no || 'None'}</strong>
                      </div>
                      <div>
                        Date: <span className="font-mono">{p.payment_date || p.receipt_date || '—'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 self-end sm:self-auto">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDetailModal(p);
                      }}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition flex items-center space-x-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect & Resolve</span>
                    </button>
                  </div>
                </div>

                {/* Sub-Banner for Problem Detail */}
                {isDuplicate && p.duplicate_info && (
                  <div className="mt-3 p-2.5 bg-rose-100/70 rounded-lg text-rose-900 text-xs flex items-center space-x-2">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      <strong>Fraud Alert:</strong> UTR {p.duplicate_info.bank_utr} was ALREADY knocked to{' '}
                      <strong>{p.duplicate_info.already_knocked_to_student_name}</strong> (Receipt{' '}
                      {p.duplicate_info.already_knocked_to_receipt_no}, ₹
                      {p.duplicate_info.already_knocked_to_amount.toLocaleString('en-IN')}). Cannot knock again.
                    </span>
                  </div>
                )}

                {isAmtMismatch && (
                  <div className="mt-3 p-2.5 bg-amber-100/70 rounded-lg text-amber-900 text-xs flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      <strong>Amount Mismatch:</strong> Student claimed ₹{p.amount_received.toLocaleString('en-IN')},
                      but bank transaction credit is ₹{p.matched_bank_transaction?.bank_amount.toLocaleString('en-IN')}.
                    </span>
                  </div>
                )}

                {isDateMismatch && (
                  <div className="mt-3 p-2.5 bg-orange-100/70 rounded-lg text-orange-900 text-xs flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-orange-600 shrink-0" />
                    <span>
                      <strong>Date Gap:</strong> Bank credit posted {p.date_difference_days} days away from receipt payment date.
                    </span>
                  </div>
                )}

                {isNotFound && (
                  <div className="mt-3 p-2.5 bg-slate-100 rounded-lg text-slate-700 text-xs flex items-center space-x-2">
                    <HelpCircle className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>
                      {p.payment_ref_no
                        ? `Reference "${p.payment_ref_no}" was not found in any uploaded bank statement.`
                        : 'No payment reference/UTR recorded on receipt; cannot deterministically verify against bank.'}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-400">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <span className="font-semibold text-slate-700 block text-sm">No Exceptions in this Category!</span>
            <p className="mt-1">All payments matching this criteria have been resolved or are clear.</p>
          </div>
        )}
      </div>
    </div>
  );
};
