'use client';

import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import AuthGuard from './AuthGuard';
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

  return (
    <AuthGuard requiredPermission={requiredPermission}>
      <div className="flex h-screen overflow-hidden bg-slate-50">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(v => !v)}
        />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Topbar pageTitle={pageTitle} breadcrumb={breadcrumb} />
          <main className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 py-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
