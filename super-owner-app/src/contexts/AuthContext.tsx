'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Me {
  email: string;
  role: string;
  isSuperOwner: boolean;
}

interface AuthContextValue {
  session: any | null;
  me: Me | null;
  loading: boolean;
  isSuperOwner: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [session, setSession] = useState<any>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    try {
      const res = await fetch('/api/me');
      setMe(res.ok ? await res.json() : null);
    } catch {
      setMe(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data: { session } }: any) => {
      if (!mounted) return;
      setSession(session);
      if (session) await loadMe();
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e: any, s: any) => {
      setSession(s);
      if (s) await loadMe();
      else setMe(null);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, [loadMe, supabase]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await loadMe();
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setMe(null);
  };

  const value: AuthContextValue = {
    session,
    me,
    loading,
    isSuperOwner: me?.isSuperOwner ?? false,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
