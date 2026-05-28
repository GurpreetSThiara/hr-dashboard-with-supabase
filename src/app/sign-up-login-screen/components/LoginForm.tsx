'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import AppLogo from '@/components/ui/AppLogo';
import { useAuth } from '@/contexts/AuthContext';

interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface DemoUser {
  id: string | null;
  email: string;
  full_name: string;
  role: string;
  tier: number;
  department: string;
  password: string;
}

const AVATAR_COLORS = [
  'bg-purple-600', 'bg-blue-600', 'bg-cyan-600', 'bg-emerald-600',
  'bg-amber-600', 'bg-orange-600', 'bg-pink-600', 'bg-violet-600',
];

function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = seed.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function getInitials(name: string) {
  const parts = name.trim().split(' ');
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}

const TIER_GROUPS: { label: string; min: number; max: number; color: string }[] = [
  { label: 'Privileged',       min: 1,  max: 2,  color: 'text-purple-700'   },
  { label: 'Admin & HR',       min: 3,  max: 7,  color: 'text-blue-700'     },
  { label: 'Finance & Ops',    min: 8,  max: 11, color: 'text-emerald-700'  },
  { label: 'Management',       min: 12, max: 14, color: 'text-amber-700'    },
  { label: 'Staff & Others',   min: 15, max: 18, color: 'text-slate-700'    },
];

export default function LoginForm() {
  const router = useRouter();
  const { signIn, user, loading: authLoading } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [demoUsers, setDemoUsers] = useState<DemoUser[]>([]);
  const [loadingDemo, setLoadingDemo] = useState(true);
  const [seededInDb, setSeededInDb] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [showAllRoles, setShowAllRoles] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors },
  } = useForm<LoginFormData>({
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  // ── Already-signed-in users go straight to dashboard ─────────────────────
  useEffect(() => {
    if (!authLoading && user) router.replace('/hr-dashboard');
  }, [authLoading, user, router]);

  // ── Load demo users from API ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/demo-users')
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        setDemoUsers(data.users || []);
        setSeededInDb(!!data.seeded);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingDemo(false); });
    return () => { cancelled = true; };
  }, []);

  // ── Group demo users ──────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    return TIER_GROUPS.map(g => ({
      ...g,
      users: demoUsers.filter(u => u.tier >= g.min && u.tier <= g.max),
    })).filter(g => g.users.length > 0);
  }, [demoUsers]);

  // ── Sign in handler ───────────────────────────────────────────────────────
  async function performSignIn(email: string, password: string, friendly: string) {
    setIsSubmitting(true);
    try {
      await signIn(email, password);
      toast.success(`Welcome back! Signed in as ${friendly}`, { description: 'Loading your workspace…' });
      // Auth context picks up the new session; explicit redirect for snappy UX
      await new Promise(r => setTimeout(r, 200));
      router.push('/hr-dashboard');
    } catch (err: any) {
      setError('email', { message: err?.message || 'Failed to sign in. Please check your credentials.' });
      toast.error('Sign in failed', { description: err?.message || 'Check that demo users have been seeded.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onSubmit(data: LoginFormData) {
    const match = demoUsers.find(u => u.email === data.email);
    await performSignIn(data.email, data.password, match?.role || data.email);
  }

  function quickLogin(user: DemoUser) {
    setValue('email', user.email);
    setValue('password', user.password);
    performSignIn(user.email, user.password, user.role);
  }

  async function handleSeed() {
    setSeeding(true);
    try {
      const res = await fetch('/api/auth/seed-demo-users', { method: 'POST' });
      let data: any;
      try {
        data = await res.json();
      } catch {
        throw new Error(`Server returned non-JSON response (status ${res.status}). Check the server logs.`);
      }
      if (!res.ok || !data.success) {
        const detail = [data?.error, data?.hint, ...(data?.errors || [])].filter(Boolean).join(' — ');
        throw new Error(detail || data?.message || 'Seeding failed.');
      }
      toast.success(data.message, { duration: 4000 });
      // Refresh demo users list
      const refresh = await fetch('/api/auth/demo-users').then(r => r.json()).catch(() => ({ users: [], seeded: false }));
      setDemoUsers(refresh.users || []);
      setSeededInDb(!!refresh.seeded);
    } catch (err: any) {
      toast.error('Failed to seed demo users', { description: err?.message, duration: 6000 });
    } finally {
      setSeeding(false);
    }
  }

  const displayedGroups = showAllRoles ? grouped : grouped.slice(0, 2);

  return (
    <div className="flex-1 flex flex-col justify-center px-8 md:px-12 xl:px-16 bg-white overflow-y-auto">
      <div className="max-w-md w-full mx-auto py-8">
        {/* Mobile logo */}
        <div className="flex items-center gap-2.5 mb-8 lg:hidden">
          <AppLogo size={36} />
          <span className="text-xl font-bold text-slate-900">HRCore</span>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Sign in to HRCore</h2>
          <p className="text-slate-500 text-sm">
            Enter your credentials or use a demo account to test as any of the 18 roles.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5">Work Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              className={`input-field ${errors.email ? 'error' : ''}`}
              {...register('email', {
                required: 'Email is required',
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' },
              })}
            />
            {errors.email && (
              <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                <Icon name="ExclamationCircleIcon" size={12} />
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700">Password</label>
              <button type="button" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••••"
                className={`input-field pr-10 ${errors.password ? 'error' : ''}`}
                {...register('password', {
                  required: 'Password is required',
                  minLength: { value: 6, message: 'Minimum 6 characters' },
                })}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <Icon name={showPassword ? 'EyeSlashIcon' : 'EyeIcon'} size={16} />
              </button>
            </div>
            {errors.password && (
              <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                <Icon name="ExclamationCircleIcon" size={12} />
                {errors.password.message}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <input id="rememberMe" type="checkbox" className="w-4 h-4 rounded border-slate-300 text-blue-600" {...register('rememberMe')} />
            <label htmlFor="rememberMe" className="text-sm text-slate-600 cursor-pointer">Keep me signed in</label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full py-3 text-base"
            style={{ minHeight: '46px' }}
          >
            {isSubmitting ? (
              <><Icon name="ArrowPathIcon" size={16} className="animate-spin" /> Signing in…</>
            ) : (
              <>Sign in to HRCore <Icon name="ArrowRightIcon" size={16} /></>
            )}
          </button>
        </form>

        {/* Quick login section */}
        <div className="mt-8 border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Icon name="BoltIcon" size={14} className="text-blue-600" />
              <span className="text-xs font-semibold text-slate-700">Quick login as a demo role</span>
            </div>
            {seededInDb ? (
              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                Seeded in DB
              </span>
            ) : (
              <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                NOT SEEDED
              </span>
            )}
          </div>

          {/* Seed banner */}
          {!seededInDb && !loadingDemo && (
            <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center justify-between gap-3">
              <div className="text-xs text-amber-800">
                <p className="font-semibold">Demo users not yet seeded in Supabase</p>
                <p className="text-amber-700 mt-0.5">Click to create all 18 demo users so you can log in.</p>
              </div>
              <button
                onClick={handleSeed}
                disabled={seeding}
                className="px-3 py-1.5 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
              >
                {seeding && <Icon name="ArrowPathIcon" size={12} className="animate-spin" />}
                {seeding ? 'Seeding…' : 'Seed Demo Users'}
              </button>
            </div>
          )}

          {/* User list */}
          <div className="max-h-72 overflow-y-auto scrollbar-thin">
            {loadingDemo ? (
              <div className="p-6 text-center text-sm text-slate-400">
                <Icon name="ArrowPathIcon" size={16} className="animate-spin mx-auto mb-2" />
                Loading demo users…
              </div>
            ) : demoUsers.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400">No demo users available.</div>
            ) : (
              displayedGroups.map(group => (
                <div key={group.label}>
                  <div className="px-4 pt-3 pb-1 bg-slate-50 sticky top-0 z-10">
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${group.color}`}>
                      {group.label}
                    </p>
                  </div>
                  {group.users.map(user => (
                    <button
                      key={user.email}
                      type="button"
                      onClick={() => quickLogin(user)}
                      disabled={isSubmitting}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 transition-colors border-b border-slate-50 last:border-0 disabled:opacity-50 group text-left"
                    >
                      <div className={`w-9 h-9 rounded-full ${avatarColor(user.email)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                        {getInitials(user.full_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800 truncate">
                            {user.full_name}
                          </span>
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-500">
                            T{user.tier}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs text-slate-500 truncate">{user.role}</span>
                          <span className="text-slate-300">·</span>
                          <span className="text-xs text-slate-400 truncate">{user.email}</span>
                        </div>
                      </div>
                      <Icon name="ArrowRightIcon" size={14} className="text-slate-300 group-hover:text-blue-600 transition-colors flex-shrink-0" />
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>

          {!loadingDemo && grouped.length > 2 && (
            <button
              onClick={() => setShowAllRoles(v => !v)}
              className="w-full py-2.5 text-xs text-blue-600 font-semibold hover:bg-blue-50 transition-colors border-t border-slate-100"
            >
              {showAllRoles ? `Show fewer ↑` : `Show all ${demoUsers.length} roles ↓`}
            </button>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          By signing in, you agree to HRCore&apos;s{' '}
          <a href="#" className="text-blue-600 hover:underline">Terms of Service</a> and{' '}
          <a href="#" className="text-blue-600 hover:underline">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
