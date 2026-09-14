import React from 'react';
import { ReceiptRecord } from '../types/receipt';
import {
  BarChart3,
  CreditCard,
  Building2,
  Users,
  ShieldCheck,
  TrendingUp,
  FileSpreadsheet,
} from 'lucide-react';
import { exportRecordsToExcel } from '../utils/excelExporter';

interface ReportsViewProps {
  records: ReceiptRecord[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({ records }) => {
  const totalReceived = records.reduce((acc, r) => acc + (r.data.amount_received || 0), 0);
  const totalFees = records.reduce((acc, r) => acc + (r.data.total_fees || 0), 0);
  const totalDiscounts = records.reduce((acc, r) => acc + (r.data.discount || 0), 0);

  // Group by Payment Mode
  const paymentModeStats: Record<string, { count: number; amount: number }> = {};
  records.forEach((r) => {
    const mode = r.data.mode_of_receipt || 'Unspecified Mode';
    if (!paymentModeStats[mode]) paymentModeStats[mode] = { count: 0, amount: 0 };
    paymentModeStats[mode].count += 1;
    paymentModeStats[mode].amount += r.data.amount_received || 0;
  });

  // Group by Hostel
  const hostelStats: Record<string, { count: number; amount: number; totalFee: number }> = {};
  records.forEach((r) => {
    const h = r.data.hostel_name || 'Unspecified Hostel';
    if (!hostelStats[h]) hostelStats[h] = { count: 0, amount: 0, totalFee: 0 };
    hostelStats[h].count += 1;
    hostelStats[h].amount += r.data.amount_received || 0;
    hostelStats[h].totalFee += r.data.total_fees || 0;
  });

  // Group by Knocked By (Staff)
  const staffStats: Record<string, { count: number; amount: number }> = {};
  records.forEach((r) => {
    const staff = r.data.knocked_by || 'Unassigned';
    if (!staffStats[staff]) staffStats[staff] = { count: 0, amount: 0 };
    staffStats[staff].count += 1;
    staffStats[staff].amount += r.data.amount_received || 0;
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Institutional Intelligence</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            Hostel Financial & Extraction Analytics
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Aggregated fee collection reports, payment mode distribution, and staff audit summaries.
          </p>
        </div>
        <button
          onClick={() => exportRecordsToExcel(records)}
          className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-200 transition"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Export Complete Dataset</span>
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Net Collections</div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {formatCurrency(totalReceived)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Across {records.length} extracted receipts</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Invoiced Fees</div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {formatCurrency(totalFees)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Collection Rate:{' '}
            <span className="font-bold text-indigo-600">
              {totalFees > 0 ? `${Math.min(Math.round((totalReceived / totalFees) * 100), 100)}%` : '100%'}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Concessions & Discounts</div>
          <div className="text-2xl font-black text-amber-600 mt-1">
            {formatCurrency(totalDiscounts)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Scholarships & early-bird rebates</div>
        </div>
      </div>

      {/* Breakdowns Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Hostel Collection Breakdown */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center space-x-2 mb-4">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Fee Collections by Hostel
            </h2>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {Object.entries(hostelStats).map(([name, stats]) => (
              <div key={name} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800">{name}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{stats.count} receipts processed</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-900">{formatCurrency(stats.amount)}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Target: {formatCurrency(stats.totalFee)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Mode Breakdown */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center space-x-2 mb-4">
            <CreditCard className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Payment Mode Breakdown
            </h2>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {Object.entries(paymentModeStats).map(([mode, stats]) => (
              <div key={mode} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800">{mode}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{stats.count} transactions</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-emerald-600">{formatCurrency(stats.amount)}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {totalReceived > 0 ? `${Math.round((stats.amount / totalReceived) * 100)}% of total` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Staff / Knocked By Performance */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center space-x-2 mb-4">
            <Users className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Counter Staff & Cashier Verification Audit (Knocked By)
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
            {Object.entries(staffStats).map(([staff, stats]) => (
              <div key={staff} className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-xs">
                <div className="font-bold text-slate-900 truncate">{staff}</div>
                <div className="text-[11px] text-slate-500 mt-1">{stats.count} receipts collected</div>
                <div className="text-sm font-bold text-slate-900 mt-1">
                  {formatCurrency(stats.amount)}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
