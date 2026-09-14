import React, { useState } from 'react';
import { useAuth } from '../firebase/AuthContext';
import { LogIn, UserCheck, Lock, Mail, ShieldAlert, LogOut, KeyRound, HelpCircle } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { user, signIn, signUp, signInWithGoogle, resetPassword, logOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      setSuccessMsg('Signed in with Google successfully!');
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Google sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (isResetMode) {
      if (!email) {
        setErrorMsg('Please enter your auditor email.');
        return;
      }
      setLoading(true);
      try {
        await resetPassword(email);
        setSuccessMsg('Password reset link sent to your email address!');
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to send reset link.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!email || !password) {
      setErrorMsg('Please provide both email and password.');
      return;
    }
    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(email, password);
        setSuccessMsg('Account created successfully!');
      } else {
        await signIn(email, password);
        setSuccessMsg('Signed in successfully!');
      }
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Authentication operation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {user ? 'Firebase Security Profile' : isResetMode ? 'Reset Auditor Password' : isSignUp ? 'Create Auditor Account' : 'Sign In to EduHostel'}
              </h2>
              <p className="text-xs text-slate-500">
                {user ? `Authenticated as ${user.email || 'Auditor Session'}` : isResetMode ? 'Enter registered email to receive reset instructions' : 'Authorized staff access for receipt auditing'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start space-x-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-left leading-relaxed">{errorMsg}</div>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-start space-x-2">
            <UserCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-left leading-relaxed">{successMsg}</div>
          </div>
        )}

        {user ? (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">User UID:</span>
                <span className="font-mono text-slate-700 font-bold truncate max-w-[200px]">{user.uid}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Email:</span>
                <span className="font-semibold text-slate-900">{user.email || 'Auditor'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Role:</span>
                <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold">Authorized Finance Admin</span>
              </div>
            </div>

            <button
              onClick={async () => {
                await logOut();
                onClose();
              }}
              className="w-full flex items-center justify-center space-x-2 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs transition"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out Session</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {!isResetMode && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full py-2.5 bg-white hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold transition shadow-xs border border-slate-200 disabled:opacity-50 flex items-center justify-center space-x-2.5 cursor-pointer"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>Sign In with Google</span>
                </button>

                <div className="relative flex items-center justify-center">
                  <div className="border-t border-slate-200 w-full"></div>
                  <span className="bg-white px-2.5 text-[10px] text-slate-400 uppercase tracking-widest font-semibold">or email</span>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Auditor / Staff Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="auditor@hostel.edu"
                  required
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-hidden"
                />
              </div>
            </div>

            {!isResetMode && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Password
                  </label>
                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsResetMode(true);
                        setErrorMsg(null);
                        setSuccessMsg(null);
                      }}
                      className="text-[11px] text-indigo-600 hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-hidden"
                  />
                </div>
                {isSignUp && (
                  <p className="text-[10px] text-slate-500 mt-1">Must be at least 6 characters</p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center space-x-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-200 transition disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" />
              <span>{loading ? 'Processing...' : isResetMode ? 'Send Reset Link' : isSignUp ? 'Create Authorized Account' : 'Sign In'}</span>
            </button>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              {isResetMode ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsResetMode(false);
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="text-indigo-600 hover:underline font-semibold"
                >
                  ← Back to sign in
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="text-indigo-600 hover:underline font-semibold"
                >
                  {isSignUp ? 'Already have an account? Sign in' : 'Need an auditor account? Sign up'}
                </button>
              )}
            </div>
          </form>
          </div>
        )}
      </div>
    </div>
  );
};
