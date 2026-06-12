'use client';

/**
 * Self-service plan & usage card for tenant users (F25/F26). Reads the unified
 * tenant context so it always reflects the Super Owner's current settings.
 */
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function PlanUsageCard() {
  const { tenantContext: ctx } = useAuth();
  if (!ctx || ctx.isSuperOwner || !ctx.organizationId) return null;

  const { plan, seat, modules, subscription } = ctx;
  const pct = seat.limit ? Math.min(100, Math.round((seat.used / seat.limit) * 100)) : 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Current plan</p>
          <p className="text-lg font-semibold text-slate-900">{plan.name ?? 'No plan'}</p>
        </div>
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
          {modules.length} modules
        </span>
      </div>

      {seat.limit !== null && (
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-slate-500">Employee seats</span>
            <span className="font-medium text-slate-700">{seat.used} / {seat.limit}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {subscription.endsAt && (
        <p className="mt-3 text-xs text-slate-400">
          {subscription.expired ? 'Subscription expired on ' : 'Renews/expires '} {new Date(subscription.endsAt).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
