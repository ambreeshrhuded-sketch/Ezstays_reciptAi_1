import React, { useState, useEffect } from 'react';
import { AppSettings } from '../types/receipt';
import {
  Settings,
  Shield,
  Sliders,
  Building2,
  Users,
  CreditCard,
  CheckCircle2,
  Trash2,
  Plus,
  RotateCcw,
  Save,
  Cpu,
  Layers,
  Sparkles,
  FolderDown,
  Github,
  Terminal,
  ExternalLink,
} from 'lucide-react';
import { DEFAULT_SETTINGS } from '../utils/storage';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onClearAllData: () => void;
  onLoadDefaultDemoData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onClearAllData,
  onLoadDefaultDemoData,
}) => {
  const [formSettings, setFormSettings] = useState<AppSettings>({ ...settings });
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Model router settings state
  const [primaryModel, setPrimaryModel] = useState('gemini-3.1-flash-lite');
  const [escalationModel, setEscalationModel] = useState('gemini-flash-latest');
  const [modelCandidates, setModelCandidates] = useState<string[]>([
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
    'gemini-3.8-flash',
    'gemini-2.5-flash',
  ]);
  const [modelConfigStatus, setModelConfigStatus] = useState<'idle' | 'loading' | 'saved' | 'error'>('idle');

  useEffect(() => {
    fetch('/api/model-config')
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.config) {
          if (data.config.primaryModel) setPrimaryModel(data.config.primaryModel);
          if (data.config.escalationModel) setEscalationModel(data.config.escalationModel);
          if (Array.isArray(data.config.fallbackCandidates)) setModelCandidates(data.config.fallbackCandidates);
        }
      })
      .catch(() => {
        // use default states
      });
  }, []);

  const handleSaveModelConfig = async () => {
    setModelConfigStatus('loading');
    try {
      const res = await fetch('/api/model-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryModel,
          escalationModel,
          fallbackCandidates: Array.from(new Set([primaryModel, escalationModel, ...modelCandidates])),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setModelConfigStatus('saved');
        setTimeout(() => setModelConfigStatus('idle'), 3000);
      } else {
        setModelConfigStatus('error');
      }
    } catch {
      setModelConfigStatus('error');
    }
  };

  // New item inputs
  const [newHostel, setNewHostel] = useState('');
  const [newStaff, setNewStaff] = useState('');
  const [newCollege, setNewCollege] = useState('');

  const handleSave = () => {
    onUpdateSettings(formSettings);
    handleSaveModelConfig();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleResetDefaults = () => {
    if (confirm('Reset settings to factory defaults?')) {
      setFormSettings({ ...DEFAULT_SETTINGS });
      onUpdateSettings({ ...DEFAULT_SETTINGS });
      fetch('/api/model-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: true }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.config) {
            setPrimaryModel(data.config.primaryModel);
            setEscalationModel(data.config.escalationModel);
          }
        });
    }
  };

  const addHostel = () => {
    if (newHostel.trim() && !formSettings.knownHostels.includes(newHostel.trim())) {
      setFormSettings({
        ...formSettings,
        knownHostels: [...formSettings.knownHostels, newHostel.trim()],
      });
      setNewHostel('');
    }
  };

  const removeHostel = (h: string) => {
    setFormSettings({
      ...formSettings,
      knownHostels: formSettings.knownHostels.filter((x) => x !== h),
    });
  };

  const addStaff = () => {
    if (newStaff.trim() && !formSettings.knownStaffMembers.includes(newStaff.trim())) {
      setFormSettings({
        ...formSettings,
        knownStaffMembers: [...formSettings.knownStaffMembers, newStaff.trim()],
      });
      setNewStaff('');
    }
  };

  const removeStaff = (s: string) => {
    setFormSettings({
      ...formSettings,
      knownStaffMembers: formSettings.knownStaffMembers.filter((x) => x !== s),
    });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Settings & Rules</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            System Rules & Admin Configuration
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure OCR confidence thresholds, business validation rules, hostel rosters, and staff directories.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleResetDefaults}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
          <button
            onClick={handleSave}
            className="flex items-center space-x-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-200 transition"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Configuration</span>
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center space-x-3 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-bold">Configuration preferences updated and saved successfully.</span>
        </div>
      )}

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Section 1: AI & Confidence Threshold */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900">
              AI Confidence Thresholds
            </h2>
          </div>

          <div>
            <div className="flex justify-between text-xs font-bold text-slate-700 mb-1.5">
              <span>Review Trigger Threshold:</span>
              <span className="font-bold text-indigo-600 font-mono text-sm">
                {Math.round(formSettings.confidenceThreshold * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.50"
              max="0.99"
              step="0.01"
              value={formSettings.confidenceThreshold}
              onChange={(e) =>
                setFormSettings({
                  ...formSettings,
                  confidenceThreshold: parseFloat(e.target.value),
                })
              }
              className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <p className="text-[11px] text-slate-400 mt-1.5">
              Any receipt field with an AI extraction confidence below this score will be flagged for mandatory human review.
            </p>
          </div>

          <div className="space-y-3 pt-3 border-t border-slate-100 text-xs">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formSettings.autoDerivePaymentMonth}
                onChange={(e) =>
                  setFormSettings({
                    ...formSettings,
                    autoDerivePaymentMonth: e.target.checked,
                  })
                }
                className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="font-bold text-slate-800">
                  Auto-derive Payment Month
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  When Payment Date (e.g. 15-08-2026) is present but month is blank, automatically compute 'August 2026'.
                </p>
              </div>
            </label>

            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formSettings.autoFillFinalHostel}
                onChange={(e) =>
                  setFormSettings({
                    ...formSettings,
                    autoFillFinalHostel: e.target.checked,
                  })
                }
                className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="font-bold text-slate-800">
                  Auto-copy Hostel Name to Final Hostel
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Copy Hostel Name into Final Hostel when Final Hostel is not explicitly stated on the voucher.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Section 2: Validation Rules */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Validation & Quality Checks
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formSettings.warningIfAmountExceedsTotal}
                onChange={(e) =>
                  setFormSettings({
                    ...formSettings,
                    warningIfAmountExceedsTotal: e.target.checked,
                  })
                }
                className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="font-bold text-slate-800">
                  Warn if Amount Received &gt; Total Fees
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Highlights transaction if amount received exceeds the total fee schedule.
                </p>
              </div>
            </label>

            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formSettings.strictPhoneValidation}
                onChange={(e) =>
                  setFormSettings({
                    ...formSettings,
                    strictPhoneValidation: e.target.checked,
                  })
                }
                className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="font-bold text-slate-800">
                  Strict Indian Phone Number Check
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Flags phone numbers that do not strictly conform to 10-digit Indian telecom standards.
                </p>
              </div>
            </label>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider text-[10px]">
              Active Operator / Reviewer Identity
            </label>
            <input
              type="text"
              value={formSettings.currentUser}
              onChange={(e) =>
                setFormSettings({
                  ...formSettings,
                  currentUser: e.target.value,
                })
              }
              className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
            />
          </div>
        </div>

        {/* Section 3: Known Hostels List */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3.5">
          <div className="flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Hostels Directory ({formSettings.knownHostels.length})
            </h2>
          </div>

          <div className="flex space-x-2">
            <input
              type="text"
              value={newHostel}
              onChange={(e) => setNewHostel(e.target.value)}
              placeholder="Add new hostel name..."
              className="flex-1 text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
            />
            <button
              onClick={addHostel}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition shadow-sm"
            >
              Add
            </button>
          </div>

          <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 text-xs">
            {formSettings.knownHostels.map((h) => (
              <div key={h} className="py-2 flex items-center justify-between">
                <span className="font-semibold text-slate-700 truncate">{h}</span>
                <button
                  onClick={() => removeHostel(h)}
                  className="text-slate-400 hover:text-rose-500 p-1 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Staff (Knocked By) Directory */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3.5">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Staff / Knocked By Directory ({formSettings.knownStaffMembers.length})
            </h2>
          </div>

          <div className="flex space-x-2">
            <input
              type="text"
              value={newStaff}
              onChange={(e) => setNewStaff(e.target.value)}
              placeholder="Add staff member..."
              className="flex-1 text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
            />
            <button
              onClick={addStaff}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition shadow-sm"
            >
              Add
            </button>
          </div>

          <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 text-xs">
            {formSettings.knownStaffMembers.map((s) => (
              <div key={s} className="py-2 flex items-center justify-between">
                <span className="font-semibold text-slate-700 truncate">{s}</span>
                <button
                  onClick={() => removeStaff(s)}
                  className="text-slate-400 hover:text-rose-500 p-1 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* AI Model Routing Layer Configuration Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900">
              AI Model Routing & Escalation Policy
            </h2>
          </div>
          <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
            Multi-Tier Failover Active
          </span>
        </div>

        <p className="text-xs text-slate-500">
          The receipt processing pipeline routes incoming vouchers through a multi-tier model layer. If the primary model encounters rate limits (429) or transient spikes (503), it automatically escalates to the designated escalation model without interrupting workflow.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Primary Extraction Model (Default)
            </label>
            <select
              value={primaryModel}
              onChange={(e) => setPrimaryModel(e.target.value)}
              className="w-full text-xs font-mono px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
            >
              <option value="gemini-3.8-flash">gemini-3.8-flash (Recommended Primary - High Quota)</option>
              <option value="gemini-flash-latest">gemini-flash-latest (Standard Flash)</option>
              <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Ultra Fast & Lightweight)</option>
              <option value="gemini-2.5-flash">gemini-2.5-flash (Legacy 2.5 Flash)</option>
              <option value="gemini-3.6-flash">gemini-3.6-flash</option>
              <option value="gemini-3.7-flash">gemini-3.7-flash</option>
            </select>
            <span className="text-[10px] text-slate-400 mt-1 block">
              Default model invoked on initial receipt ingestion.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Escalation Model (Failover)
            </label>
            <select
              value={escalationModel}
              onChange={(e) => setEscalationModel(e.target.value)}
              className="w-full text-xs font-mono px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
            >
              <option value="gemini-flash-latest">gemini-flash-latest (Recommended Failover)</option>
              <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (High Availability Failover)</option>
              <option value="gemini-3.8-flash">gemini-3.8-flash (Primary Backup)</option>
              <option value="gemini-2.5-flash">gemini-2.5-flash (Standard Fallback)</option>
              <option value="gemini-3.6-flash">gemini-3.6-flash</option>
              <option value="gemini-3.7-flash">gemini-3.7-flash</option>
            </select>
            <span className="text-[10px] text-slate-400 mt-1 block">
              Target model when rate-limiting (429) or high-demand occurs.
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="flex items-center space-x-2 text-[11px] text-slate-500 font-mono">
            <span>Fallback Sequence:</span>
            <span className="text-indigo-600 font-bold">
              {Array.from(new Set([primaryModel, escalationModel, ...modelCandidates])).join(' → ')}
            </span>
          </div>
          <button
            onClick={handleSaveModelConfig}
            disabled={modelConfigStatus === 'loading'}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-xs"
          >
            <span>{modelConfigStatus === 'loading' ? 'Saving...' : modelConfigStatus === 'saved' ? 'Saved ✓' : 'Update Routing Config'}</span>
          </button>
        </div>
      </div>

      {/* Database Reset / Maintenance */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900 mb-1">
          Database Management & Maintenance
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Manage stored records in your local IndexedDB storage.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onLoadDefaultDemoData}
            className="px-4 py-2.5 bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 rounded-xl text-xs font-bold transition shadow-xs"
          >
            Load Realistic Demo Receipts (Preloaded Sample Batch)
          </button>

          <button
            onClick={() => {
              if (confirm('Clear all uploaded receipts and database records permanently?')) {
                onClearAllData();
              }
            }}
            className="px-4 py-2.5 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 rounded-xl text-xs font-bold transition"
          >
            Clear Entire Database
          </button>
        </div>
      </div>

      {/* GitHub Export & Repository ZIP */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 border border-slate-700/80 rounded-2xl p-6 text-white shadow-md">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
              <Github className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                Export to GitHub / Download Repository ZIP
              </h2>
              <p className="text-xs text-slate-300">
                Package this full-stack project for your GitHub portfolio or resume showcase.
              </p>
            </div>
          </div>
          <a
            href="/hostel-flow-repo.zip"
            download="hostel-receipt-ai-repo.zip"
            className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white font-semibold text-xs rounded-xl shadow-md transition"
          >
            <FolderDown className="w-4 h-4" />
            <span>Download ZIP Archive</span>
          </a>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-700/60 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
            <span className="font-semibold text-slate-200 block mb-1.5 flex items-center space-x-1.5">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>Step 1: Push to your GitHub Account</span>
            </span>
            <pre className="font-mono text-[11px] text-slate-300 bg-slate-900/90 p-2.5 rounded-lg overflow-x-auto leading-relaxed border border-slate-800">
{`unzip hostel-receipt-ai-repo.zip
cd hostel-receipt-ai
git init
git add .
git commit -m "feat: HostelReceipt AI & Reconciliation Engine"
git branch -M main
git remote add origin https://github.com/<your-user>/hostel-receipt-ai.git
git push -u origin main`}
            </pre>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between">
            <div>
              <span className="font-semibold text-slate-200 block mb-1.5 flex items-center space-x-1.5">
                <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                <span>Step 2: What's Included</span>
              </span>
              <ul className="space-y-1 text-slate-300 text-[11px] list-disc list-inside">
                <li>Production React 19 + TypeScript + Tailwind 4 codebase</li>
                <li>Express API proxy + Gemini 3.1-flash-lite model router</li>
                <li>Bank Statement OCR parser & Payment Knocking engine</li>
                <li>Comprehensive README with architecture diagrams</li>
                <li>Clean package without heavy node_modules (~189 KB)</li>
              </ul>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              Tip: You can also use AI Studio's top Settings &rarr; "Export to GitHub" for direct 1-click cloud synchronization.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
