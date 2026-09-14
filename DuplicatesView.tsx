import React from 'react';
import { ReceiptRecord } from '../types/receipt';
import {
  CopyCheck,
  AlertTriangle,
  Eye,
  Check,
  Trash2,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

interface DuplicatesViewProps {
  records: ReceiptRecord[];
  onOpenReview: (recordId: string) => void;
  onDismissDuplicate: (recordId: string) => void;
  onDeleteRecord: (recordId: string) => void;
}

export const DuplicatesView: React.FC<DuplicatesViewProps> = ({
  records,
  onOpenReview,
  onDismissDuplicate,
  onDeleteRecord,
}) => {
  const duplicateRecords = records.filter((r) => r.isDuplicate);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Duplicate Guardian</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            Potential Duplicate Receipts ({duplicateRecords.length})
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Receipts matching existing records by Receipt Number, Student ID + Date + Amount, or Payment UTR.
          </p>
        </div>
      </div>

      {duplicateRecords.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center mb-3 border border-emerald-200">
            <CopyCheck className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">No Duplicate Receipts Detected</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            All uploaded receipts have distinct transaction references, receipt numbers, and student identities.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {duplicateRecords.map((r) => {
            const matched = records.find((other) => other.id === r.duplicateOfId);

            return (
              <div
                key={r.id}
                className="bg-white border border-rose-200 rounded-2xl p-5 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-rose-100 gap-3">
                  <div className="flex items-center space-x-2 text-rose-700 text-xs font-bold">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Duplicate Alert: {r.duplicateReason || 'Matching records detected'}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => onDismissDuplicate(r.id)}
                      className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                    >
                      Keep Both (Dismiss)
                    </button>
                    <button
                      onClick={() => onDeleteRecord(r.id)}
                      className="px-3.5 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-bold rounded-xl transition"
                    >
                      Delete Duplicate
                    </button>
                  </div>
                </div>

                {/* Comparison Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-xs">
                  {/* Current Record */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold text-slate-900">Current Uploaded Slip</span>
                      <span className="text-[10px] text-slate-400 font-mono">{r.fileName}</span>
                    </div>
                    <div className="space-y-1.5 text-slate-600">
                      <div><b className="text-slate-400 font-medium">Student:</b> <span className="font-bold text-slate-800">{r.data.student_name || 'N/A'}</span></div>
                      <div><b className="text-slate-400 font-medium">Student ID:</b> <span className="font-mono">{r.data.student_id || 'N/A'}</span></div>
                      <div><b className="text-slate-400 font-medium">Receipt #:</b> <span className="font-mono">{r.data.receipt_no || 'N/A'}</span></div>
                      <div><b className="text-slate-400 font-medium">Amount:</b> <span className="font-bold text-slate-900">₹{r.data.amount_received || 0}</span></div>
                      <div><b className="text-slate-400 font-medium">Date:</b> {r.data.receipt_date || 'N/A'}</div>
                      <div><b className="text-slate-400 font-medium">Payment Ref:</b> <span className="font-mono">{r.data.payment_ref_no || 'N/A'}</span></div>
                      <div><b className="text-slate-400 font-medium">Hostel:</b> {r.data.hostel_name || 'N/A'}</div>
                    </div>
                    <button
                      onClick={() => onOpenReview(r.id)}
                      className="mt-4 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-200 transition"
                    >
                      Inspect in Reviewer
                    </button>
                  </div>

                  {/* Matched Existing Record */}
                  <div className="p-4 bg-rose-50/40 rounded-xl border border-rose-200">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold text-slate-900">Existing Matched Slip</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {matched ? matched.fileName : 'Existing Entry'}
                      </span>
                    </div>
                    {matched ? (
                      <div className="space-y-1.5 text-slate-600">
                        <div><b className="text-slate-400 font-medium">Student:</b> <span className="font-bold text-slate-800">{matched.data.student_name || 'N/A'}</span></div>
                        <div><b className="text-slate-400 font-medium">Student ID:</b> <span className="font-mono">{matched.data.student_id || 'N/A'}</span></div>
                        <div><b className="text-slate-400 font-medium">Receipt #:</b> <span className="font-mono">{matched.data.receipt_no || 'N/A'}</span></div>
                        <div><b className="text-slate-400 font-medium">Amount:</b> <span className="font-bold text-slate-900">₹{matched.data.amount_received || 0}</span></div>
                        <div><b className="text-slate-400 font-medium">Date:</b> {matched.data.receipt_date || 'N/A'}</div>
                        <div><b className="text-slate-400 font-medium">Payment Ref:</b> <span className="font-mono">{matched.data.payment_ref_no || 'N/A'}</span></div>
                        <div><b className="text-slate-400 font-medium">Hostel:</b> {matched.data.hostel_name || 'N/A'}</div>
                        <button
                          onClick={() => onOpenReview(matched.id)}
                          className="mt-4 w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition"
                        >
                          View Existing Record
                        </button>
                      </div>
                    ) : (
                      <div className="text-slate-400 py-8 text-center text-xs">
                        Matching record was updated or removed.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
