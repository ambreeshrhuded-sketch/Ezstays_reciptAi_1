import React, { useState, useMemo } from 'react';
import {
  Search,
  Landmark,
  ArrowDownLeft,
  ArrowUpRight,
  FileSpreadsheet,
  X,
  Copy,
  Check,
  Calendar,
  Hash,
  FileText,
  FileCode,
} from 'lucide-react';
import {
  BankTransactionRecord,
} from '../../types/reconciliation';
import { normalizeReference } from '../../utils/reconciliationMatcher';

interface BankTransactionsTabProps {
  transactions: BankTransactionRecord[];
  onSelectTransaction?: (tx: BankTransactionRecord) => void;
}

export const BankTransactionsTab: React.FC<BankTransactionsTabProps> = ({
  transactions,
  onSelectTransaction,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [selectedMethod, setSelectedMethod] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [inspectedTx, setInspectedTx] = useState<BankTransactionRecord | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const filteredTransactions = useMemo(() => {
    const term = searchTerm.trim();
    const cleanSearchRef = normalizeReference(term);
    const lowerTerm = term.toLowerCase();

    return transactions.filter((tx) => {
      if (selectedSource !== 'all' && tx.payment_source !== selectedSource) return false;
      if (selectedMethod !== 'all' && tx.transaction_method !== selectedMethod) return false;
      if (selectedStatus !== 'all' && tx.reconciliation_status !== selectedStatus) return false;
      if (selectedType !== 'all' && tx.transaction_type !== selectedType) return false;

      if (!term) return true;

      // Check normalized reference match first (e.g. searching 519589142019)
      if (cleanSearchRef && cleanSearchRef.length >= 4) {
        if (tx.normalized_reference && tx.normalized_reference.includes(cleanSearchRef)) return true;
        if (tx.utr && normalizeReference(tx.utr).includes(cleanSearchRef)) return true;
        if (tx.reference_number && normalizeReference(tx.reference_number).includes(cleanSearchRef)) return true;
        if (tx.transaction_id && normalizeReference(tx.transaction_id).includes(cleanSearchRef)) return true;
        if (tx.all_references && tx.all_references.some((r) => r.includes(cleanSearchRef))) return true;
        if (tx.raw_references && tx.raw_references.some((r) => normalizeReference(r).includes(cleanSearchRef))) return true;
        if (normalizeReference(tx.bank_narration).includes(cleanSearchRef)) return true;
      }

      // General substring match
      return (
        tx.bank_narration.toLowerCase().includes(lowerTerm) ||
        (tx.utr && tx.utr.toLowerCase().includes(lowerTerm)) ||
        (tx.reference_number && tx.reference_number.toLowerCase().includes(lowerTerm)) ||
        (tx.transaction_id && tx.transaction_id.toLowerCase().includes(lowerTerm)) ||
        (tx.source_file_name && tx.source_file_name.toLowerCase().includes(lowerTerm)) ||
        String(tx.bank_amount).includes(lowerTerm) ||
        (tx.matched_student_name && tx.matched_student_name.toLowerCase().includes(lowerTerm)) ||
        (tx.matched_receipt_no && tx.matched_receipt_no.toLowerCase().includes(lowerTerm)) ||
        tx.bank_date.includes(lowerTerm)
      );
    });
  }, [transactions, searchTerm, selectedSource, selectedMethod, selectedStatus, selectedType]);

  const stats = useMemo(() => {
    let availableCount = 0;
    let knockedCount = 0;
    let totalCredit = 0;
    let totalDebit = 0;

    transactions.forEach((tx) => {
      if (tx.reconciliation_status === 'knocked') knockedCount++;
      else availableCount++;

      if (tx.transaction_type === 'credit') totalCredit += tx.bank_amount;
      else totalDebit += tx.bank_amount;
    });

    return { availableCount, knockedCount, totalCredit, totalDebit };
  }, [transactions]);

  return (
    <div className="space-y-4">
      {/* Top Stats Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-slate-400 block text-[10px]">Total Bank Transactions</span>
          <span className="text-lg font-bold text-slate-900">{transactions.length.toLocaleString('en-IN')}</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-emerald-600 block text-[10px] font-semibold">Available for Knocking</span>
          <span className="text-lg font-bold text-emerald-700">{stats.availableCount.toLocaleString('en-IN')}</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-indigo-600 block text-[10px] font-semibold">Knocked / Claimed</span>
          <span className="text-lg font-bold text-indigo-700">{stats.knockedCount.toLocaleString('en-IN')}</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-slate-400 block text-[10px]">Total Bank Inflow (Credit)</span>
          <span className="text-lg font-bold text-slate-900">₹{stats.totalCredit.toLocaleString('en-IN')}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by UTR / Ref (e.g. 519589142019), amount, narration..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white font-mono"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Source Filter */}
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Sources</option>
            <option value="PhonePe">PhonePe</option>
            <option value="GPay">GPay</option>
            <option value="Axis Bank">Axis Bank</option>
            <option value="IDFC Bank">IDFC Bank</option>
            <option value="Canara Bank">Canara Bank</option>
            <option value="HDFC Bank">HDFC Bank</option>
            <option value="ICICI Bank">ICICI Bank</option>
            <option value="Other">Other</option>
          </select>

          {/* Method Filter */}
          <select
            value={selectedMethod}
            onChange={(e) => setSelectedMethod(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Methods</option>
            <option value="UPI">UPI</option>
            <option value="NEFT">NEFT</option>
            <option value="RTGS">RTGS</option>
            <option value="IMPS">IMPS</option>
            <option value="Cash">Cash</option>
            <option value="Bank Transfer">Bank Transfer</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="available">Available</option>
            <option value="knocked">Knocked</option>
            <option value="potential_match">Potential Match</option>
            <option value="needs_review">Needs Review</option>
          </select>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Credit & Debit</option>
            <option value="credit">Credit (Inflow)</option>
            <option value="debit">Debit (Outflow)</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                <th className="py-3 px-3">Bank / Source</th>
                <th className="py-3 px-3">Method</th>
                <th className="py-3 px-3">Bank Date</th>
                <th className="py-3 px-4">Narration / Particulars</th>
                <th className="py-3 px-3 text-right">Amount</th>
                <th className="py-3 px-3">Raw UTR / Ref</th>
                <th className="py-3 px-3">Normalized Ref</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Knocked To</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((tx) => {
                  const isCredit = tx.transaction_type === 'credit';
                  const isKnocked = tx.reconciliation_status === 'knocked';

                  return (
                    <tr
                      key={tx.bank_transaction_id}
                      onClick={() => {
                        setInspectedTx(tx);
                        onSelectTransaction?.(tx);
                      }}
                      className={`hover:bg-slate-50/80 transition cursor-pointer ${
                        isKnocked ? 'bg-indigo-50/20' : ''
                      }`}
                    >
                      <td className="py-3 px-3 font-semibold text-slate-800">
                        <div className="flex items-center space-x-1.5">
                          <Landmark className="w-3.5 h-3.5 text-slate-400" />
                          <span>{tx.payment_source}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 font-medium text-[11px] text-slate-700">
                          {tx.transaction_method}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">
                        {tx.bank_date}
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <p className="font-mono text-[11px] text-slate-700 truncate" title={tx.bank_narration}>
                          {tx.bank_narration}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <span
                          className={`font-mono font-bold text-xs flex items-center justify-end space-x-1 ${
                            isCredit ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {isCredit ? (
                            <ArrowDownLeft className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <ArrowUpRight className="w-3 h-3 text-rose-500" />
                          )}
                          <span>₹{tx.bank_amount.toLocaleString('en-IN')}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {tx.utr ? (
                          <span className="font-mono font-bold text-[11px] text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">
                            {tx.utr}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {tx.normalized_reference ? (
                          <span className="font-mono font-bold text-[11px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                            {tx.normalized_reference}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            isKnocked
                              ? 'bg-indigo-100 text-indigo-800'
                              : tx.reconciliation_status === 'potential_match'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {tx.reconciliation_status}
                        </span>
                      </td>
                      <td className="py-3 px-3 max-w-xs whitespace-nowrap">
                        {isKnocked ? (
                          <div className="text-[11px]">
                            <span className="font-bold text-indigo-900 block truncate">
                              {tx.matched_student_name || 'Matched Student'}
                            </span>
                            <span className="text-slate-500 font-mono text-[10px]">
                              Rec: {tx.matched_receipt_no || '—'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Available</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 text-xs">
                    <FileSpreadsheet className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <span>No bank transactions found matching "{searchTerm}".</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Inspection Modal / Panel */}
      {inspectedTx && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2">
                <Landmark className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Bank Transaction Audit</h3>
                  <p className="text-[11px] text-slate-500">Source statement record verification</p>
                </div>
              </div>
              <button
                onClick={() => setInspectedTx(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Bank Amount</span>
                  <span className="text-base font-bold font-mono text-emerald-700">
                    ₹{inspectedTx.bank_amount.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Bank Date</span>
                  <span className="text-sm font-bold font-mono text-slate-800 flex items-center space-x-1 mt-0.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{inspectedTx.bank_date}</span>
                  </span>
                </div>
              </div>

              {/* Raw UTR */}
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Raw UTR / Ref</span>
                  <span className="font-mono font-bold text-slate-900">{inspectedTx.utr || 'Not Present'}</span>
                </div>
                {inspectedTx.utr && (
                  <button
                    onClick={() => handleCopy(inspectedTx.utr, 'raw')}
                    className="p-1 hover:bg-slate-200 rounded text-slate-500"
                    title="Copy Raw UTR"
                  >
                    {copiedKey === 'raw' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>

              {/* Normalized Reference */}
              <div className="p-2.5 bg-indigo-50/50 rounded-lg border border-indigo-100 flex items-center justify-between">
                <div>
                  <span className="text-indigo-500 block text-[10px] uppercase font-bold">Normalized Reference (Engine Key)</span>
                  <span className="font-mono font-bold text-indigo-900">{inspectedTx.normalized_reference || 'None'}</span>
                </div>
                {inspectedTx.normalized_reference && (
                  <button
                    onClick={() => handleCopy(inspectedTx.normalized_reference, 'norm')}
                    className="p-1 hover:bg-indigo-100 rounded text-indigo-600"
                    title="Copy Normalized Reference"
                  >
                    {copiedKey === 'norm' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>

              {/* Transaction ID */}
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Transaction ID</span>
                  <span className="font-mono text-slate-700">{inspectedTx.transaction_id || inspectedTx.bank_transaction_id}</span>
                </div>
                <button
                  onClick={() => handleCopy(inspectedTx.transaction_id || inspectedTx.bank_transaction_id, 'txnid')}
                  className="p-1 hover:bg-slate-200 rounded text-slate-500"
                >
                  {copiedKey === 'txnid' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Narration */}
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Bank Statement Narration</span>
                <p className="font-mono text-[11px] text-slate-800 break-all">{inspectedTx.bank_narration}</p>
              </div>

              {/* Source Statement File */}
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Source Statement File:</span>
                <span className="font-semibold text-slate-800 truncate max-w-xs">{inspectedTx.source_file_name}</span>
              </div>

              {/* Status */}
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Reconciliation Status:</span>
                <span className={`font-bold uppercase tracking-wider ${inspectedTx.reconciliation_status === 'knocked' ? 'text-indigo-700' : 'text-emerald-700'}`}>
                  {inspectedTx.reconciliation_status}
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setInspectedTx(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
