import React from 'react';
import { ReceiptRecord, BatchInfo } from '../types/receipt';
import {
  Layers,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Play,
  Pause,
  RefreshCw,
  ArrowRight,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { ActiveTab } from './Navbar';

interface ProcessingQueueViewProps {
  currentBatch: BatchInfo | null;
  records: ReceiptRecord[];
  isProcessing: boolean;
  onPauseResume: () => void;
  onRetryFailed: () => void;
  onOpenReview: (recordId: string) => void;
  setActiveTab: (tab: ActiveTab) => void;
}

export const ProcessingQueueView: React.FC<ProcessingQueueViewProps> = ({
  currentBatch,
  records,
  isProcessing,
  onPauseResume,
  onRetryFailed,
  onOpenReview,
  setActiveTab,
}) => {
  const batchRecords = currentBatch
    ? records.filter((r) => r.batchId === currentBatch.id)
    : records;

  const total = batchRecords.length;
  const processed = batchRecords.filter(
    (r) => r.status !== 'pending' && r.status !== 'processing'
  ).length;
  const inProgress = batchRecords.filter((r) => r.status === 'processing').length;
  const pending = batchRecords.filter((r) => r.status === 'pending').length;
  const needsReview = batchRecords.filter((r) => r.status === 'needs_review').length;
  const approved = batchRecords.filter((r) => r.status === 'approved').length;
  const failed = batchRecords.filter((r) => r.status === 'failed').length;

  const progressPercent = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Top Batch Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 uppercase tracking-wider">
                {currentBatch?.batchNumber || 'Batch #001'}
              </span>
              <h1 className="text-xl font-bold text-slate-900">
                {currentBatch?.name || 'Active Processing Queue'}
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Gemini OCR engine extracting 33 structured fields, validating numbers/dates, and scoring confidence.
            </p>
          </div>

          <div className="flex items-center space-x-2.5 shrink-0">
            <button
              onClick={onPauseResume}
              className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition ${
                isProcessing
                  ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
              }`}
            >
              {isProcessing ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause Queue</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Resume Queue</span>
                </>
              )}
            </button>

            {failed > 0 && (
              <button
                onClick={onRetryFailed}
                className="flex items-center space-x-1.5 px-3.5 py-2 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 rounded-xl text-xs font-bold transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry {failed} Failed</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('review')}
              className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
            >
              <span>Go to Review Screen</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-5 space-y-2">
          <div className="flex justify-between text-xs font-medium text-slate-600">
            <span>
              Processing Progress: <span className="font-bold text-slate-900">{processed} / {total}</span> Completed ({progressPercent}%)
            </span>
            <span className="text-slate-400 font-semibold">
              {isProcessing ? '⚡ Active (Gemini OCR Extracting)' : 'Idle / Complete'}
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden flex">
            <div
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{ width: `${total > 0 ? (approved / total) * 100 : 0}%` }}
              title={`${approved} Approved`}
            />
            <div
              className="bg-amber-500 h-full transition-all duration-300"
              style={{ width: `${total > 0 ? (needsReview / total) * 100 : 0}%` }}
              title={`${needsReview} Needs Review`}
            />
            <div
              className="bg-indigo-600 h-full animate-pulse transition-all duration-300"
              style={{ width: `${total > 0 ? (inProgress / total) * 100 : 0}%` }}
              title={`${inProgress} Currently Extracting`}
            />
            <div
              className="bg-rose-500 h-full transition-all duration-300"
              style={{ width: `${total > 0 ? (failed / total) * 100 : 0}%` }}
              title={`${failed} Failed`}
            />
          </div>
        </div>

        {/* Status Counters */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2 pt-3.5 border-t border-slate-100 text-xs">
          <div className="flex items-center space-x-2 text-slate-600">
            <Layers className="w-4 h-4 text-indigo-500" />
            <span>Total: <b>{total}</b></span>
          </div>
          <div className="flex items-center space-x-2 text-emerald-600">
            <CheckCircle2 className="w-4 h-4" />
            <span>Approved: <b>{approved}</b></span>
          </div>
          <div className="flex items-center space-x-2 text-amber-600">
            <AlertTriangle className="w-4 h-4" />
            <span>Needs Review: <b>{needsReview}</b></span>
          </div>
          <div className="flex items-center space-x-2 text-indigo-600">
            <Clock className="w-4 h-4" />
            <span>Pending/Working: <b>{inProgress + pending}</b></span>
          </div>
          <div className="flex items-center space-x-2 text-rose-600">
            <XCircle className="w-4 h-4" />
            <span>Failed: <b>{failed}</b></span>
          </div>
        </div>
      </div>

      {/* Receipts Status Grid */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900 mb-4">
          Receipt Items in Current Batch
        </h2>

        {batchRecords.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            No receipts in processing queue. Go to Upload to start a new batch.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 max-h-[600px] overflow-y-auto p-1">
            {batchRecords.map((r) => {
              return (
                <div
                  key={r.id}
                  className={`border rounded-xl p-4 text-xs flex flex-col justify-between transition-all ${
                    r.status === 'processing'
                      ? 'border-indigo-300 bg-indigo-50/40'
                      : r.status === 'approved'
                      ? 'border-emerald-200 bg-emerald-50/30'
                      : r.status === 'needs_review'
                      ? 'border-amber-200 bg-amber-50/30'
                      : r.status === 'failed'
                      ? 'border-rose-200 bg-rose-50/30'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="truncate">
                      <div className="font-bold text-slate-900 truncate" title={r.fileName}>
                        {r.data.student_name || r.fileName}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">
                        {r.data.hostel_name || r.fileName}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="shrink-0">
                      {r.status === 'processing' && (
                        <span className="flex items-center space-x-1 text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2.5 py-0.5 rounded-full animate-pulse">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Extracting</span>
                        </span>
                      )}
                      {r.status === 'pending' && (
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          Queued
                        </span>
                      )}
                      {r.status === 'approved' && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          Approved
                        </span>
                      )}
                      {r.status === 'needs_review' && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          Review Required
                        </span>
                      )}
                      {r.status === 'failed' && (
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                          Failed
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Details row if processed */}
                  {r.status !== 'pending' && r.status !== 'processing' && (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                      {r.status === 'failed' ? (
                        <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-700">
                          <div className="font-semibold leading-tight">{r.errorReason || 'Extraction failed'}</div>
                          {r.modelUsed && (
                            <div className="text-[10px] text-rose-600 mt-1 font-mono">
                              Model: {r.modelUsed}
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-500">Amount:</span>
                            <span className="font-bold text-slate-900">
                              ₹{r.data.amount_received ?? '---'}
                            </span>
                          </div>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-500">Receipt No:</span>
                            <span className="font-mono text-slate-700">
                              {r.data.receipt_no || '---'}
                            </span>
                          </div>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-500">AI Model:</span>
                            <span className="font-mono text-[10px] text-slate-600 flex items-center gap-1">
                              {r.modelUsed || r.debugInfo?.modelUsed || 'Active Flash'}
                              {r.isEscalated && (
                                <span className="bg-amber-100 text-amber-800 text-[9px] px-1 py-0.2 rounded font-sans font-bold">
                                  Escalated
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-500">Confidence:</span>
                            <span
                              className={`font-bold ${
                                r.overallConfidence >= 0.85
                                  ? 'text-emerald-600'
                                  : r.overallConfidence >= 0.6
                                  ? 'text-amber-600'
                                  : 'text-rose-600'
                              }`}
                            >
                              {Math.round(r.overallConfidence * 100)}%
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-[10px] text-slate-400">
                      {new Date(r.uploadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button
                      onClick={() => onOpenReview(r.id)}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
                    >
                      <span>Review Details</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
