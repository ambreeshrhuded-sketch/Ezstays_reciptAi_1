import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  auth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  signInAnonymously,
  GoogleAuthProvider,
  signInWithPopup,
  User,
} from './config';

export function getFriendlyAuthErrorMessage(err: any): string {
  const code = err?.code || '';
  const msg = err?.message || '';

  if (code === 'auth/operation-not-allowed' || msg.includes('operation-not-allowed')) {
    return 'Email/Password sign-in is not permitted on this project tier. Please use "Sign in with Google" which is fully enabled and active.';
  }
  if (code === 'auth/popup-closed-by-user' || msg.includes('popup-closed-by-user')) {
    return 'The Google sign-in window was closed before completing. Please try again.';
  }
  if (code === 'auth/popup-blocked' || msg.includes('popup-blocked')) {
    return 'Google sign-in popup was blocked by your browser. Please allow popups for this site and try again.';
  }
  if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
    return 'Invalid credentials. Please verify your details or use Google Sign-In.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'An account with this email already exists. Please sign in instead.';
  }
  if (code === 'auth/weak-password') {
    return 'Password is too weak. Please use at least 6 characters.';
  }
  if (code === 'auth/invalid-email') {
    return 'Please enter a valid email address.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network connection error. Please check your internet connectivity.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many failed login attempts. Access is temporarily paused for security. Please try again in a few minutes or use Google Sign-In.';
  }
  return msg || 'Authentication error. Please try again.';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logOut: () => Promise<void>;
  signInAnonymous: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signInWithGoogle: async () => {},
  resetPassword: async () => {},
  logOut: async () => {},
  signInAnonymous: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for auth state changes without automatically signing in anonymously
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      // If user is anonymous or null, treat as logged out for company security
      if (currentUser && !currentUser.isAnonymous) {
        setUser(currentUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const res = await signInWithEmailAndPassword(auth, email.trim(), pass);
      setUser(res.user);
    } catch (err: any) {
      throw new Error(getFriendlyAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, pass: string) => {
    if (pass.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }
    setLoading(true);
    try {
      const res = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      setUser(res.user);
    } catch (err: any) {
      throw new Error(getFriendlyAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const res = await signInWithPopup(auth, provider);
      setUser(res.user);
    } catch (err: any) {
      throw new Error(getFriendlyAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    if (!email || !email.trim()) {
      throw new Error('Please enter your email address to receive a password reset link.');
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err: any) {
      throw new Error(getFriendlyAuthErrorMessage(err));
    }
  };

  const logOut = async () => {
    await signOut(auth);
    setUser(null);
  };

  const signInAnonymous = async () => {
    setLoading(true);
    try {
      const res = await signInAnonymously(auth);
      if (res.user && !res.user.isAnonymous) {
        setUser(res.user);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signInWithGoogle, resetPassword, logOut, signInAnonymous }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
