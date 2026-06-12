'use client';

/**
 * Shown when a user navigates to a feature whose module is not enabled by their
 * organization's plan (F27). Keeps the sync honest: the Super Owner disables a
 * module → tenant users see an upgrade prompt instead of a broken page.
 */
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function ModuleLocked({ module }: { module: string }) {
  const { tenantContext } = useAuth();
  const support = tenantContext?.platform?.supportEmail;
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-slate-200 bg-white px-6 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl">🔒</div>
      <div>
        <h2 className="text-lg font-semibold text-slate-900">This feature isn’t included in your plan</h2>
        <p className="mt-1 max-w-md text-sm text-slate-500">
          The <span className="font-medium">{module.replace('_', ' ')}</span> module is not enabled for your
          organization. Ask your administrator to upgrade your plan to unlock it.
        </p>
      </div>
      {support && (
        <a href={`mailto:${support}`} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Contact support
        </a>
      )}
    </div>
  );
}
