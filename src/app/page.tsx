'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/AppIcon';

export default function RootPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? '/my-dashboard' : '/sign-up-login-screen');
  }, [loading, user, router]);

  return (
    <div className="flex items-center justify-center h-screen bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <Icon name="ArrowPathIcon" size={28} className="animate-spin text-blue-600" />
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    </div>
  );
}
