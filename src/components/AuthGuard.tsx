'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { useRoleBasedAccess, Permission } from '@/lib/useRoleBasedAccess';

interface Props {
  children: React.ReactNode;
  /** Permission required to view this page. Omit for any-authenticated. */
  requiredPermission?: Permission;
  /** Where to send users who lack permission (default: /hr-dashboard) */
  fallbackPath?: string;
}

/**
 * Wrap protected pages with <AuthGuard>:
 * 1) Redirects to /sign-up-login-screen if unauthenticated
 * 2) If requiredPermission is set, redirects to fallbackPath when user lacks it
 */
export default function AuthGuard({ children, requiredPermission, fallbackPath = '/hr-dashboard' }: Props) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { hasPermission } = useRoleBasedAccess();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/sign-up-login-screen');
      return;
    }

    if (requiredPermission && !hasPermission(requiredPermission)) {
      toast.error("You don't have access to this page.", { duration: 3000 });
      router.replace(fallbackPath);
    }
  }, [loading, user, requiredPermission, hasPermission, router, fallbackPath]);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Icon name="ArrowPathIcon" size={28} className="animate-spin text-blue-600" />
          <p className="text-sm text-slate-500">Loading…</p>
        </div>
      </div>
    );
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-2 text-center max-w-sm px-6">
          <Icon name="ShieldExclamationIcon" size={36} className="text-red-500 mb-2" />
          <h2 className="text-lg font-bold text-slate-900">Access Denied</h2>
          <p className="text-sm text-slate-500">
            You don't have permission to view this page. Redirecting…
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
