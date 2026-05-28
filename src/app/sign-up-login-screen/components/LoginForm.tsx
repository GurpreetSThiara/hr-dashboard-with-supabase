'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import AppLogo from '@/components/ui/AppLogo';
import { createClient } from '@/lib/supabase/client';

interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface DemoCredential {
  role: string;
  email: string;
  password: string;
  tier: number;
}

const DEMO_CREDENTIALS: DemoCredential[] = [
  { tier: 1, role: 'Super Admin', email: 'superadmin@hrcore.io', password: 'HRCore@SA1' },
  { tier: 2, role: 'Owner', email: 'owner@hrcore.io', password: 'HRCore@OW2' },
  { tier: 3, role: 'Admin', email: 'admin@hrcore.io', password: 'HRCore@AD3' },
  { tier: 4, role: 'HR Admin', email: 'hradmin@hrcore.io', password: 'HRCore@HA4' },
  { tier: 5, role: 'HR Manager', email: 'hrmanager@hrcore.io', password: 'HRCore@HM5' },
  { tier: 6, role: 'HR Executive', email: 'hrexec@hrcore.io', password: 'HRCore@HE6' },
  { tier: 7, role: 'Recruiter', email: 'recruiter@hrcore.io', password: 'HRCore@RC7' },
  { tier: 8, role: 'Payroll Manager', email: 'payroll@hrcore.io', password: 'HRCore@PM8' },
  { tier: 9, role: 'Finance/Accounts', email: 'finance@hrcore.io', password: 'HRCore@FA9' },
  { tier: 10, role: 'Compliance/Auditor', email: 'compliance@hrcore.io', password: 'HRCore@CA10' },
  { tier: 11, role: 'IT/Admin Ops', email: 'itops@hrcore.io', password: 'HRCore@IT11' },
  { tier: 12, role: 'Director', email: 'director@hrcore.io', password: 'HRCore@DR12' },
  { tier: 13, role: 'Manager', email: 'manager@hrcore.io', password: 'HRCore@MG13' },
  { tier: 14, role: 'Team Lead', email: 'teamlead@hrcore.io', password: 'HRCore@TL14' },
  { tier: 15, role: 'Employee', email: 'employee@hrcore.io', password: 'HRCore@EM15' },
  { tier: 16, role: 'Contractor', email: 'contractor@hrcore.io', password: 'HRCore@CT16' },
  { tier: 17, role: 'Intern', email: 'intern@hrcore.io', password: 'HRCore@IN17' },
  { tier: 18, role: 'Read-Only User', email: 'readonly@hrcore.io', password: 'HRCore@RO18' },
];

export default function LoginForm() {
  const router = useRouter();
  const supabase = createClient();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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

  async function onSubmit(data: LoginFormData) {
    setIsLoading(true);

    try {
      // Verify credentials against demo list
      const validCred = DEMO_CREDENTIALS.find(
        (c) => c.email === data.email && c.password === data.password
      );

      if (!validCred) {
        setIsLoading(false);
        setError('email', {
          message: 'Invalid credentials — use the demo accounts below to sign in',
        });
        return;
      }

      // Use API endpoint for login (creates user if doesn't exist)
      const response = await fetch('/api/auth/login/simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Login failed');
      }

      // Store user info and token in localStorage for demo
      if (result.session && result.user) {
        localStorage.setItem('hrcore_user', JSON.stringify(result.user));
        localStorage.setItem('hrcore_token', result.session.access_token);
        localStorage.setItem('hrcore_refresh', result.session.refresh_token);
      }

      toast.success(`Welcome back! Signed in as ${result.user.role}`, {
        description: 'Redirecting to your dashboard...',
      });

      await new Promise((r) => setTimeout(r, 800));
      router.push('/hr-dashboard');
    } catch (error: any) {
      setError('email', {
        message: error?.message || 'Failed to sign in. Please try again.',
      });
      toast.error('Sign in failed');
    } finally {
      setIsLoading(false);
    }
  }

  function autofill(cred: DemoCredential) {
    setValue('email', cred.email);
    setValue('password', cred.password);
    toast.info(`Demo credentials loaded for ${cred.role}`);
  }

  const displayedRoles = showAllRoles ? DEMO_CREDENTIALS : DEMO_CREDENTIALS.slice(0, 6);

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
            Enter your credentials to access your HR workspace.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Work Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              className={`input-field ${errors.email ? 'error' : ''}`}
              {...register('email', {
                required: 'Email address is required',
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address' },
              })}
            />
            {errors.email && (
              <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                <Icon name="ExclamationCircleIcon" size={12} />
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
                Password
              </label>
              <button type="button" className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors">
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
                  minLength: { value: 6, message: 'Password must be at least 6 characters' },
                })}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
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

          {/* Remember me */}
          <div className="flex items-center gap-2.5">
            <input
              id="rememberMe"
              type="checkbox"
              className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer"
              {...register('rememberMe')}
            />
            <label htmlFor="rememberMe" className="text-sm text-slate-600 cursor-pointer select-none">
              Keep me signed in for 30 days
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full py-3 text-base"
            style={{ minHeight: '46px' }}
          >
            {isLoading ? (
              <>
                <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                Sign in to HRCore
                <Icon name="ArrowRightIcon" size={16} />
              </>
            )}
          </button>
        </form>

        {/* SSO Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-xs text-slate-400 font-medium">OR</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        {/* SSO Button */}
        <button className="btn-secondary w-full py-2.5 gap-3">
          <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center">
            <Icon name="BuildingOfficeIcon" size={12} className="text-white" />
          </div>
          Continue with Corporate SSO
        </button>

        {/* Demo Credentials */}
        <div className="mt-8 border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Icon name="KeyIcon" size={14} className="text-blue-600" />
              <span className="text-xs font-semibold text-slate-700">Demo Credentials — 18 Role Tiers</span>
            </div>
            <span className="text-[10px] text-slate-400 bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
              DEMO ONLY
            </span>
          </div>
          <div className="max-h-52 overflow-y-auto scrollbar-thin">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-2 text-slate-500 font-semibold">Tier</th>
                  <th className="text-left px-4 py-2 text-slate-500 font-semibold">Role</th>
                  <th className="text-left px-4 py-2 text-slate-500 font-semibold">Email</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {displayedRoles.map((cred) => (
                  <tr
                    key={`cred-${cred.tier}`}
                    className="border-b border-slate-50 hover:bg-blue-50/50 transition-colors"
                  >
                    <td className="px-4 py-2 text-slate-400 font-mono-data">T{cred.tier}</td>
                    <td className="px-4 py-2 font-semibold text-slate-700">{cred.role}</td>
                    <td className="px-4 py-2 text-slate-500 font-mono-data text-[11px]">{cred.email}</td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => autofill(cred)}
                        className="px-2.5 py-1 text-[11px] font-semibold bg-blue-700 text-white rounded hover:bg-blue-800 transition-colors active:scale-95"
                      >
                        Use
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!showAllRoles && DEMO_CREDENTIALS.length > 6 && (
            <button
              onClick={() => setShowAllRoles(true)}
              className="w-full py-2.5 text-xs text-blue-600 font-semibold hover:bg-blue-50 transition-colors border-t border-slate-100"
            >
              Show all {DEMO_CREDENTIALS.length} roles ↓
            </button>
          )}
          {showAllRoles && (
            <button
              onClick={() => setShowAllRoles(false)}
              className="w-full py-2.5 text-xs text-slate-500 font-semibold hover:bg-slate-50 transition-colors border-t border-slate-100"
            >
              Show fewer ↑
            </button>
          )}
        </div>

        {/* Footer links */}
        <p className="text-center text-xs text-slate-400 mt-6">
          By signing in, you agree to HRCore&apos;s{' '}
          <a href="#" className="text-blue-600 hover:underline">
            Terms of Service
          </a>
          {' '}and{' '}
          <a href="#" className="text-blue-600 hover:underline">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}
