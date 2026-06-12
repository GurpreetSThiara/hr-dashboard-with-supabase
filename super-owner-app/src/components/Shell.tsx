'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Icon from './Icon';
import { Loading } from './ui';

const NAV = [
  { href: '/dashboard', label: 'Overview', icon: 'home' as const },
  { href: '/organizations', label: 'Organizations', icon: 'building' as const },
  { href: '/plans', label: 'Plans', icon: 'layers' as const },
  { href: '/modules', label: 'Modules', icon: 'grid' as const },
  { href: '/announcements', label: 'Announcements', icon: 'shield' as const },
  { href: '/flags', label: 'Feature Flags', icon: 'layers' as const },
  { href: '/audit', label: 'Audit Log', icon: 'check' as const },
  { href: '/settings', label: 'Settings', icon: 'grid' as const },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, session, isSuperOwner, me, signOut } = useAuth();

  useEffect(() => {
    if (!loading && (!session || !isSuperOwner)) router.replace('/login');
  }, [loading, session, isSuperOwner, router]);

  if (loading || !session || !isSuperOwner) {
    return <div className="flex min-h-screen items-center justify-center"><Loading /></div>;
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex items-center gap-2.5 px-6 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Icon name="shield" className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight text-slate-900">Super Owner</p>
            <p className="text-xs text-slate-400">Platform Console</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href} href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon name={item.icon} className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-200 p-3">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
              {(me?.email?.[0] ?? 'S').toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-700">{me?.email}</p>
              <p className="text-xs text-slate-400">Super Owner</p>
            </div>
          </div>
          <button
            onClick={() => signOut().then(() => router.replace('/login'))}
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <Icon name="logout" className="w-5 h-5" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white"><Icon name="shield" className="w-4 h-4" /></div>
            <span className="font-semibold text-slate-900">Super Owner</span>
          </div>
          <button onClick={() => signOut().then(() => router.replace('/login'))} className="text-slate-500"><Icon name="logout" /></button>
        </header>
        {/* Mobile nav */}
        <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-2 py-2 lg:hidden">
          {NAV.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link key={item.href} href={item.href}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${active ? 'bg-brand-50 text-brand-700' : 'text-slate-600'}`}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-screen-xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
