import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Coins,
  Search,
  Sparkles,
  RefreshCw,
  Landmark,
  Layers,
  FileText,
  BarChart3,
  HelpCircle,
} from 'lucide-react';
import { ReceiptRecord } from '../../types/receipt';
import {
  BankStatementRecord,
  BankTransactionRecord,
  ReceiptPaymentRecord,
  ReconciliationRecord,
  ReconciliationAuditLog,
} from '../../types/reconciliation';
import {
  getAllBankStatements,
  getAllBankTransactions,
  getAllReceiptPayments,
  getAllReconciliations,
  getAllAuditLogs,
  saveBankStatement,
  saveBankTransactions,
  saveReceiptPayments,
  normalizeReceiptsToPayments,
  knockPayment,
  unknockPayment,
} from '../../firebase/reconciliationStore';
import { runBatchMatching, normalizeDateToISO } from '../../utils/reconciliationMatcher';
import { SAMPLE_PHONEPE_STATEMENT } from '../../utils/sampleBankData';
import { BankStatementUploadTab } from './BankStatementUploadTab';
import { BankTransactionsTab } from './BankTransactionsTab';
import { MatchingKnockingTab } from './MatchingKnockingTab';
import { ExceptionsTab } from './ExceptionsTab';
import { ReconciliationReportsTab } from './ReconciliationReportsTab';
import { MatchDetailModal } from './MatchDetailModal';

export type ReconciliationTab = 'matching' | 'transactions' | 'upload' | 'exceptions' | 'reports';

interface ReconciliationViewProps {
  receipts: ReceiptRecord[];
  userEmail: string;
  onViewReceipt?: (receiptId: string) => void;
}

export const ReconciliationView: React.FC<ReconciliationViewProps> = ({
  receipts,
  userEmail,
  onViewReceipt,
}) => {
  const [activeTab, setActiveTab] = useState<ReconciliationTab>('matching');
  const [loading, setLoading] = useState(true);
  const [isMatching, setIsMatching] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Entities
  const [statements, setStatements] = useState<BankStatementRecord[]>([]);
  const [bankTransactions, setBankTransactions] = useState<BankTransactionRecord[]>([]);
  const [payments, setPayments] = useState<ReceiptPaymentRecord[]>([]);
  const [reconciliations, setReconciliations] = useState<ReconciliationRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<ReconciliationAuditLog[]>([]);

  // Modal State
  const [selectedPayment, setSelectedPayment] = useState<ReceiptPaymentRecord | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Load initial data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [stmts, txns, storedPayments, recons, logs] = await Promise.all([
        getAllBankStatements(),
        getAllBankTransactions(),
        getAllReceiptPayments(),
        getAllReconciliations(),
        getAllAuditLogs(),
      ]);

      // Normalize receipts into payments
      const normalizedPayments = normalizeReceiptsToPayments(receipts, storedPayments);

      // Run matching logic to identify candidates and duplicates
      const batchResult = runBatchMatching(normalizedPayments, txns);
      const evaluatedPayments = batchResult.updatedPayments;

      setStatements(stmts);
      setBankTransactions(txns);
      setPayments(evaluatedPayments);
      setReconciliations(recons);
      setAuditLogs(logs);

      // Persist normalized payments
      await saveReceiptPayments(evaluatedPayments);
    } catch (err: any) {
      console.error('Failed to load reconciliation state:', err);
      setStatusMessage({ type: 'error', text: 'Error loading reconciliation records.' });
    } finally {
      setLoading(false);
    }
  }, [receipts]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Top KPI Metrics
  const kpis = useMemo(() => {
    let totalClaimedAmount = 0;
    let knockedCount = 0;
    let knockedAmount = 0;
    let pendingCount = 0;
    let duplicateCount = 0;
    let amountMismatchCount = 0;
    let dateMismatchCount = 0;
    let notFoundCount = 0;
    let cashCount = 0;

    payments.forEach((p) => {
      totalClaimedAmount += p.amount_received;
      if (p.reconciliation_status === 'knocked') {
        knockedCount++;
        knockedAmount += p.amount_received;
      } else if (p.reconciliation_status === 'exact_match' || p.reconciliation_status === 'pending') {
        pendingCount++;
      } else if (p.reconciliation_status === 'duplicate') {
        duplicateCount++;
      } else if (p.reconciliation_status === 'amount_mismatch') {
        amountMismatchCount++;
      } else if (p.reconciliation_status === 'date_mismatch') {
        dateMismatchCount++;
      } else if (p.reconciliation_status === 'not_found') {
        notFoundCount++;
      } else if (p.reconciliation_status === 'cash_manual') {
        cashCount++;
      }
    });

    const knockedPct = totalClaimedAmount > 0 ? Math.round((knockedAmount / totalClaimedAmount) * 100) : 0;

    return {
      totalPayments: payments.length,
      totalClaimedAmount,
      knockedCount,
      knockedAmount,
      knockedPct,
      pendingCount,
      duplicateCount,
      amountMismatchCount,
      dateMismatchCount,
      notFoundCount,
      cashCount,
      totalExceptions: duplicateCount + amountMismatchCount + dateMismatchCount + notFoundCount,
    };
  }, [payments]);

  // Knock Action Handler
  const handleKnock = async (payment: ReceiptPaymentRecord, transaction: BankTransactionRecord, notes?: string) => {
    try {
      const parentRec = receipts.find((r) => r.id === payment.receipt_id);
      const result = await knockPayment({
        receiptPayment: payment,
        bankTransaction: transaction,
        userEmail,
        notes,
        parentReceipt: parentRec,
      });

      setStatusMessage({ type: 'success', text: result.message });
      setIsDetailModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error('Knock failed:', err);
      setStatusMessage({ type: 'error', text: err?.message || 'Failed to knock payment.' });
    }
  };

  // Unknock Action Handler
  const handleUnknock = async (payment: ReceiptPaymentRecord) => {
    const recon = reconciliations.find(
      (r) => r.receipt_payment_id === payment.id && r.status === 'active'
    );
    const matchedTx = bankTransactions.find(
      (tx) => tx.bank_transaction_id === payment.matched_bank_transaction_id
    );

    if (!recon || !matchedTx) {
      setStatusMessage({ type: 'error', text: 'Reconciliation record not found.' });
      return;
    }

    const reason = window.prompt('Enter reason for unknocking this payment:');
    if (reason === null) return;

    try {
      const parentRec = receipts.find((r) => r.id === payment.receipt_id);
      await unknockPayment({
        reconciliation: recon,
        receiptPayment: payment,
        bankTransaction: matchedTx,
        userEmail,
        reason: reason || 'Manual revision by user',
        parentReceipt: parentRec,
      });

      setStatusMessage({ type: 'info', text: 'Payment unknocked successfully.' });
      setIsDetailModalOpen(false);
      await loadData();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Failed to unknock payment.' });
    }
  };

  // Run Batch Auto Match
  const handleAutoMatchAll = async () => {
    setIsMatching(true);
    setStatusMessage(null);
    try {
      let knockedCounter = 0;
      for (const p of payments) {
        // Only auto-knock exact matches
        if ((p.reconciliation_status === 'exact_match' || p.reconciliation_status === 'pending') && p.matched_bank_transaction_id && p.match_type === 'exact_match') {
          const matchedTx = bankTransactions.find((tx) => tx.bank_transaction_id === p.matched_bank_transaction_id);
          if (matchedTx && matchedTx.reconciliation_status === 'available') {
            const parentRec = receipts.find((r) => r.id === p.receipt_id);
            await knockPayment({
              receiptPayment: p,
              bankTransaction: matchedTx,
              userEmail,
              matchType: 'exact_match',
              matchScore: 100,
              dateDifferenceDays: p.date_difference_days || 0,
              notes: 'Auto-knocked via Exact Reference Match',
              parentReceipt: parentRec,
            });
            knockedCounter++;
          }
        }
      }

      setStatusMessage({
        type: 'success',
        text: `Auto-matching complete! Knocked ${knockedCounter} exact payment matches.`,
      });
      await loadData();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Auto-matching encountered an error.' });
    } finally {
      setIsMatching(false);
    }
  };

  // Confirm Import of Statement
  const handleConfirmImport = async (stmt: BankStatementRecord, txns: BankTransactionRecord[]) => {
    await saveBankStatement(stmt);
    await saveBankTransactions(txns);
    setStatusMessage({
      type: 'success',
      text: `Successfully imported "${stmt.file_name}" with ${txns.length} bank transactions!`,
    });
    await loadData();
    setActiveTab('matching');
  };

  // Load PhonePe Sample Statement
  const handleLoadSampleStatement = async () => {
    try {
      await saveBankStatement(SAMPLE_PHONEPE_STATEMENT.summary);
      await saveBankTransactions(SAMPLE_PHONEPE_STATEMENT.transactions);
      setStatusMessage({
        type: 'success',
        text: 'PhonePe July 2026 reference statement loaded successfully!',
      });
      await loadData();
      setActiveTab('matching');
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'Failed to load sample statement.' });
    }
  };

  // Modal helpers
  const handleOpenDetailModal = (payment: ReceiptPaymentRecord) => {
    setSelectedPayment(payment);
    setIsDetailModalOpen(true);
  };

  const selectedMatchedTx = useMemo(() => {
    if (!selectedPayment || !selectedPayment.matched_bank_transaction_id) return null;
    return (
      bankTransactions.find(
        (tx) => tx.bank_transaction_id === selectedPayment.matched_bank_transaction_id
      ) || null
    );
  }, [selectedPayment, bankTransactions]);

  const selectedCandidateTxns = useMemo(() => {
    if (!selectedPayment) return [];
    const paymentDateStr = selectedPayment.payment_date || selectedPayment.receipt_date;
    const paymentDateIso = normalizeDateToISO(paymentDateStr);

    return bankTransactions
      .filter((tx) => {
        if (tx.reconciliation_status !== 'available') return false;
        // Strict amount match
        if (Math.abs(tx.bank_amount - selectedPayment.amount_received) > 1) return false;

        // Date check: within ±7 days max, never unrelated months or years
        if (paymentDateIso && tx.bank_date) {
          const pTime = new Date(paymentDateIso).getTime();
          const bTime = new Date(tx.bank_date).getTime();
          if (!isNaN(pTime) && !isNaN(bTime)) {
            const diffDays = Math.abs(bTime - pTime) / (1000 * 60 * 60 * 24);
            if (diffDays > 7) return false;
          }
        }
        return true;
      })
      .slice(0, 5);
  }, [selectedPayment, bankTransactions]);

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  Bank Reconciliation & Payment Knocking
                </h1>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                  Phase 2
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Verify student fee claims against official bank statements, detect reused UTRs and duplicate receipts, and maintain a 1:1 knocking audit trail.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {bankTransactions.length === 0 && (
            <button
              onClick={handleLoadSampleStatement}
              className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl border border-indigo-200 transition flex items-center space-x-1.5"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Load PhonePe Sample</span>
            </button>
          )}

          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition border border-slate-200"
            title="Refresh reconciliation data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Top Status Banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-xs font-medium flex items-center justify-between shadow-sm ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
              : statusMessage.type === 'error'
              ? 'bg-rose-50 border border-rose-200 text-rose-900'
              : 'bg-indigo-50 border border-indigo-200 text-indigo-900'
          }`}
        >
          <div className="flex items-center space-x-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : statusMessage.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <HelpCircle className="w-4 h-4 text-indigo-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-slate-700">
            ×
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
        {/* Total Payments */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-slate-400 block text-[11px] font-medium">Receipt Payments</span>
          <span className="text-xl font-bold text-slate-900 block">{kpis.totalPayments}</span>
          <span className="text-[10px] text-slate-500 font-mono">
            ₹{kpis.totalClaimedAmount.toLocaleString('en-IN')}
          </span>
        </div>

        {/* Knocked */}
        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm space-y-1">
          <span className="text-emerald-700 block text-[11px] font-bold">Knocked (Matched)</span>
          <span className="text-xl font-bold text-emerald-700 block">{kpis.knockedCount}</span>
          <span className="text-[10px] text-emerald-600 font-mono">
            ₹{kpis.knockedAmount.toLocaleString('en-IN')} ({kpis.knockedPct}%)
          </span>
        </div>

        {/* Pending */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-slate-500 block text-[11px] font-medium">Pending Match</span>
          <span className="text-xl font-bold text-slate-700 block">{kpis.pendingCount}</span>
          <span className="text-[10px] text-slate-400">Awaiting bank proof</span>
        </div>

        {/* Duplicates / Fraud */}
        <div
          onClick={() => setActiveTab('exceptions')}
          className={`p-4 rounded-xl border shadow-sm space-y-1 cursor-pointer transition ${
            kpis.duplicateCount > 0
              ? 'bg-rose-50 border-rose-300 text-rose-900'
              : 'bg-white border-slate-200'
          }`}
        >
          <span className="text-rose-700 block text-[11px] font-bold flex items-center space-x-1">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Duplicates / Fraud</span>
          </span>
          <span className="text-xl font-bold text-rose-700 block">{kpis.duplicateCount}</span>
          <span className="text-[10px] text-rose-600">Reused UTR claims</span>
        </div>

        {/* Amount Mismatches */}
        <div
          onClick={() => setActiveTab('exceptions')}
          className={`p-4 rounded-xl border shadow-sm space-y-1 cursor-pointer transition ${
            kpis.amountMismatchCount > 0
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-white border-slate-200'
          }`}
        >
          <span className="text-amber-700 block text-[11px] font-bold flex items-center space-x-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Amount Mismatch</span>
          </span>
          <span className="text-xl font-bold text-amber-700 block">{kpis.amountMismatchCount}</span>
          <span className="text-[10px] text-amber-600">Claimed != Bank</span>
        </div>

        {/* Not in Bank */}
        <div
          onClick={() => setActiveTab('exceptions')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1 cursor-pointer"
        >
          <span className="text-slate-500 block text-[11px] font-medium">Not in Bank</span>
          <span className="text-xl font-bold text-slate-700 block">{kpis.notFoundCount}</span>
          <span className="text-[10px] text-slate-400">UTR missing in statement</span>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="border-b border-slate-200 flex items-center space-x-1 sm:space-x-4 overflow-x-auto text-xs font-semibold">
        <button
          onClick={() => setActiveTab('matching')}
          className={`pb-3 px-3 flex items-center space-x-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'matching'
              ? 'border-indigo-600 text-indigo-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Matching & Knocking</span>
          <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px]">
            {payments.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('transactions')}
          className={`pb-3 px-3 flex items-center space-x-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'transactions'
              ? 'border-indigo-600 text-indigo-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Landmark className="w-4 h-4" />
          <span>Bank Transactions</span>
          <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px]">
            {bankTransactions.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('upload')}
          className={`pb-3 px-3 flex items-center space-x-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'upload'
              ? 'border-indigo-600 text-indigo-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UploadCloud className="w-4 h-4" />
          <span>Upload Bank Statement</span>
          <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px]">
            {statements.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('exceptions')}
          className={`pb-3 px-3 flex items-center space-x-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'exceptions'
              ? 'border-rose-600 text-rose-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Exceptions</span>
          {kpis.totalExceptions > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
              {kpis.totalExceptions}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`pb-3 px-3 flex items-center space-x-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'reports'
              ? 'border-indigo-600 text-indigo-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Reports & Audit</span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'matching' && (
        <MatchingKnockingTab
          payments={payments}
          bankTransactions={bankTransactions}
          onOpenDetailModal={handleOpenDetailModal}
          onKnock={handleKnock}
          onUnknock={handleUnknock}
          onAutoMatchAll={handleAutoMatchAll}
          isMatching={isMatching}
        />
      )}

      {activeTab === 'transactions' && (
        <BankTransactionsTab
          transactions={bankTransactions}
          onSelectTransaction={(tx) => {
            // Find matched payment if knocked
            if (tx.matched_receipt_payment_id) {
              const matchedPayment = payments.find((p) => p.id === tx.matched_receipt_payment_id);
              if (matchedPayment) handleOpenDetailModal(matchedPayment);
            }
          }}
        />
      )}

      {activeTab === 'upload' && (
        <BankStatementUploadTab
          userEmail={userEmail}
          onConfirmImport={handleConfirmImport}
          onLoadSampleStatement={handleLoadSampleStatement}
        />
      )}

      {activeTab === 'exceptions' && (
        <ExceptionsTab
          payments={payments}
          bankTransactions={bankTransactions}
          onOpenDetailModal={handleOpenDetailModal}
          onKnock={handleKnock}
        />
      )}

      {activeTab === 'reports' && (
        <ReconciliationReportsTab
          payments={payments}
          bankTransactions={bankTransactions}
          auditLogs={auditLogs}
        />
      )}

      {/* 4-Section Match Detail Modal */}
      <MatchDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedPayment(null);
        }}
        payment={selectedPayment}
        matchedTransaction={selectedMatchedTx}
        candidateTransactions={selectedCandidateTxns}
        onKnock={handleKnock}
        onUnknock={handleUnknock}
        onViewReceipt={onViewReceipt}
        reconciliationsHistory={reconciliations}
      />
    </div>
  );
};
