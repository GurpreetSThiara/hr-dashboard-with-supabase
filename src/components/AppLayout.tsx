'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import BottomNav from './BottomNav';
import AuthGuard from './AuthGuard';
import FloatingTimer from './time/FloatingTimer';
import { Permission } from '@/lib/useRoleBasedAccess';

interface AppLayoutProps {
  children: React.ReactNode;
  pageTitle: string;
  breadcrumb?: string;
  /** If set, the page is gated behind this permission. */
  requiredPermission?: Permission;
}

export default function AppLayout({ children, pageTitle, breadcrumb, requiredPermission }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();

  // Close the mobile drawer on route change + lock body scroll while open.
  useEffect(() => { setMobileNavOpen(false); }, [pathname]);
  useEffect(() => {
    if (mobileNavOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [mobileNavOpen]);

  return (
    <AuthGuard requiredPermission={requiredPermission}>
      <div className="flex h-screen overflow-hidden bg-slate-50">
        {/* Desktop sidebar (in-flow, ≥ lg) */}
        <div className="hidden lg:flex">
          <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(v => !v)} />
        </div>

        {/* Mobile drawer (< lg) */}
        <div className={`lg:hidden ${mobileNavOpen ? '' : 'pointer-events-none'}`}>
          {/* Backdrop */}
          <div
            onClick={() => setMobileNavOpen(false)}
            className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${
              mobileNavOpen ? 'opacity-100' : 'opacity-0'
            }`}
            aria-hidden="true"
          />
          {/* Slide-out panel */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className={`fixed inset-y-0 left-0 z-50 w-[260px] max-w-[85vw] transform transition-transform duration-300 ease-in-out ${
              mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <Sidebar
              collapsed={false}
              mobile
              onToggle={() => {}}
              onNavigate={() => setMobileNavOpen(false)}
            />
          </div>
        </div>

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Topbar pageTitle={pageTitle} breadcrumb={breadcrumb} onOpenMobileNav={() => setMobileNavOpen(true)} />
          <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
            {/* Bottom padding on mobile so content clears the bottom nav + safe area. */}
            <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-4 sm:py-6 pb-[calc(64px+env(safe-area-inset-bottom))] lg:pb-6">
              {children}
            </div>
          </main>
        </div>

        {/* Mobile bottom navigation */}
        <BottomNav onOpenMenu={() => setMobileNavOpen(true)} />

        {/* Persistent timer (visible app-wide while a timer runs) */}
        <FloatingTimer />
      </div>
    </AuthGuard>
  );
}
