'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, session, isSuperOwner, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    if (!loading && session && isSuperOwner) router.replace('/dashboard');
  }, [loading, session, isSuperOwner, router]);

  // Discover whether one-click demo login is available.
  useEffect(() => {
    fetch('/api/auth/demo-user')
      .then(r => r.json())
      .then(d => setDemoMode(!!d.demoMode))
      .catch(() => setDemoMode(false));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Sign in failed');
    } finally {
      setBusy(false);
    }
  }

  // One-click demo login: ensure the demo Super Owner exists, then sign in.
  async function demoLogin() {
    setBusy(true);
    setError(null);
    try {
      await fetch('/api/auth/seed-demo-user', { method: 'POST' });
      const cred = await (await fetch('/api/auth/demo-user')).json();
      if (!cred.password) throw new Error('Demo login is disabled in this environment');
      await signIn(cred.email, cred.password);
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Demo login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Super Owner</h1>
        <p className="mt-1 text-sm text-slate-500">Platform administration sign in</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <input
            type="email" required value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="password" required value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit" disabled={busy}
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {demoMode && (
          <>
            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-slate-200" />
              <span className="text-xs text-slate-400">or</span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>
            <button
              type="button" onClick={demoLogin} disabled={busy}
              className="w-full rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              Login as Demo Super Owner
            </button>
          </>
        )}
      </div>
    </div>
  );
}
