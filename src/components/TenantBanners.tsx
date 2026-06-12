'use client';

/**
 * Renders Super-Owner-controlled notices for the current organization:
 * platform announcements, suspended/archived/maintenance states, subscription
 * expiry, and seat-limit warnings. Driven entirely by /api/me/context via
 * AuthContext, keeping the HR app in sync with the Super Owner app.
 */
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const LEVEL_STYLES: Record<string, string> = {
  info: 'bg-blue-50 text-blue-800 border-blue-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  critical: 'bg-red-50 text-red-800 border-red-200',
};

const DISMISS_KEY = 'hrcore_dismissed_announcements';

function Banner({ level, children, onDismiss }: { level: string; children: React.ReactNode; onDismiss?: () => void }) {
  return (
    <div className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-2.5 text-sm font-medium ${LEVEL_STYLES[level] ?? LEVEL_STYLES.info}`}>
      <div>{children}</div>
      {onDismiss && <button onClick={onDismiss} aria-label="Dismiss" className="shrink-0 opacity-60 hover:opacity-100">✕</button>}
    </div>
  );
}

export default function TenantBanners() {
  const { tenantContext: ctx } = useAuth();
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    try { setDismissed(JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]')); } catch { /* ignore */ }
  }, []);
  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  if (!ctx || ctx.isSuperOwner) return null;

  const notices: React.ReactNode[] = [];

  if (ctx.status === 'suspended') {
    notices.push(<Banner key="susp" level="critical">Your organization is suspended. Contact {ctx.platform.supportEmail ?? 'support'}.</Banner>);
  } else if (ctx.status === 'archived') {
    notices.push(<Banner key="arch" level="critical">Your organization has been archived and is read-only.</Banner>);
  }
  if (ctx.subscription.expired) {
    notices.push(<Banner key="exp" level="critical">Your subscription has expired. Some features are disabled until it is renewed.</Banner>);
  } else if (ctx.subscription.endsAt) {
    const days = Math.ceil((new Date(ctx.subscription.endsAt).getTime() - Date.now()) / 86400000);
    if (days <= 14) notices.push(<Banner key="trial" level="warning">Your {ctx.plan.name ?? 'plan'} subscription ends in {days} day{days === 1 ? '' : 's'}.</Banner>);
  }
  if (ctx.maintenanceMode) {
    notices.push(<Banner key="maint" level="warning">Maintenance mode is on — the app is temporarily read-only.</Banner>);
  }
  if (ctx.seat.limit !== null && ctx.seat.remaining !== null && ctx.seat.remaining <= Math.max(2, Math.ceil(ctx.seat.limit * 0.1))) {
    notices.push(
      <Banner key="seat" level={ctx.seat.remaining === 0 ? 'critical' : 'warning'}>
        {ctx.seat.remaining === 0
          ? `Seat limit reached (${ctx.seat.used}/${ctx.seat.limit}). Upgrade your plan to add employees.`
          : `${ctx.seat.remaining} of ${ctx.seat.limit} employee seats remaining.`}
      </Banner>
    );
  }
  for (const a of ctx.announcements) {
    if (dismissed.includes(a.id)) continue;
    notices.push(
      <Banner key={a.id} level={a.level} onDismiss={() => dismiss(a.id)}>
        <span className="font-semibold">{a.title}</span>{a.body ? ` — ${a.body}` : ''}
      </Banner>
    );
  }

  if (notices.length === 0) return null;
  return <div className="mb-4 space-y-2">{notices}</div>;
}
