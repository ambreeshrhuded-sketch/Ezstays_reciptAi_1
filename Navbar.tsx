import React from 'react';
import {
  LayoutDashboard,
  UploadCloud,
  Layers,
  CheckSquare,
  TableProperties,
  CopyCheck,
  BarChart3,
  FileSpreadsheet,
  Settings,
  Sparkles,
  Bug,
  ShieldCheck,
  User,
  Landmark,
  FolderDown,
} from 'lucide-react';
import { useAuth } from '../firebase/AuthContext';

export type ActiveTab =
  | 'dashboard'
  | 'upload'
  | 'processing'
  | 'review'
  | 'records'
  | 'duplicates'
  | 'reconciliation'
  | 'debug'
  | 'reports'
  | 'export'
  | 'settings';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  pendingReviewCount: number;
  duplicateCount: number;
  processingCount: number;
  onOpenSampleModal: () => void;
  onOpenAuthModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  pendingReviewCount,
  duplicateCount,
  processingCount,
  onOpenSampleModal,
  onOpenAuthModal,
}) => {
  const { user } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'upload', label: 'Upload', icon: UploadCloud },
    {
      id: 'processing',
      label: 'Processing Queue',
      icon: Layers,
      badge: processingCount > 0 ? processingCount : null,
      badgeColor: 'bg-indigo-500 text-white',
    },
    {
      id: 'review',
      label: 'Review Queue',
      icon: CheckSquare,
      badge: pendingReviewCount > 0 ? pendingReviewCount : null,
      badgeColor: 'bg-amber-500 text-white',
    },
    { id: 'records', label: 'All Records', icon: TableProperties },
    {
      id: 'duplicates',
      label: 'Duplicates',
      icon: CopyCheck,
      badge: duplicateCount > 0 ? duplicateCount : null,
      badgeColor: 'bg-rose-500 text-white',
    },
    { id: 'reconciliation', label: 'Bank Reconciliation', icon: Landmark },
    { id: 'debug', label: 'Test & Debug', icon: Bug },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'export', label: 'Export', icon: FileSpreadsheet },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#0F172A] border-b border-slate-800 text-slate-100 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Zone */}
          <div className="flex items-center space-x-3 shrink-0">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shadow-sm shadow-indigo-500/30">
              <span className="text-white font-bold text-lg">H</span>
            </div>
            <span className="text-white font-semibold text-lg tracking-tight">
              HostelFlow
            </span>
          </div>

          {/* Nav Zone */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as ActiveTab)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs lg:text-sm font-medium transition-all whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-white' : 'bg-slate-600'}`} />
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {item.badge !== null && item.badge !== undefined && (
                    <span
                      className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        item.badgeColor || 'bg-slate-700 text-slate-200'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Action Zone */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            <button
              onClick={onOpenAuthModal}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition-colors whitespace-nowrap"
              title="Firebase Authentication & Auditor Security Profile"
            >
              {user?.email ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline text-emerald-300 font-mono text-[11px] truncate max-w-[120px]">{user.email.split('@')[0]}</span>
                </>
              ) : (
                <>
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden sm:inline">Sign In</span>
                </>
              )}
            </button>

            <button
              onClick={onOpenSampleModal}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition-colors whitespace-nowrap"
              title="Test with pre-generated sample receipts"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Sample Slips</span>
            </button>

            <a
              href="/hostel-flow-repo.zip"
              download="hostel-receipt-ai-repo.zip"
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-sky-300 bg-sky-950/60 hover:bg-sky-900/80 border border-sky-700/60 transition-colors whitespace-nowrap"
              title="Download clean repository ZIP for GitHub export"
            >
              <FolderDown className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">GitHub Repo ZIP</span>
            </a>
            
            <button
              onClick={() => setActiveTab('upload')}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs lg:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm shadow-indigo-500/20 transition-all whitespace-nowrap"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload Batch</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Sub-Nav */}
      <div className="md:hidden overflow-x-auto border-t border-slate-800 bg-[#0F172A] px-2 py-2 flex space-x-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as ActiveTab)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                isActive ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
              {item.badge !== null && item.badge !== undefined && (
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-200">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
};
