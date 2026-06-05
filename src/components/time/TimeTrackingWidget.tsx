'use client';

/**
 * Dashboard widget: the signed-in user's time roll-up (today / this week /
 * billable / active projects) plus the live timer state. Renders nothing if the
 * user lacks time-tracking access.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRoleBasedAccess } from '@/lib/useRoleBasedAccess';
import { useTimer } from '@/contexts/TimerContext';
import { formatMinutes, formatClock } from '@/lib/timeTracking';
import Icon from '@/components/ui/AppIcon';

interface Summary {
  today: { total_minutes: number; billable_minutes: number };
  week: { total_minutes: number; billable_minutes: number; overtime_minutes: number };
  active_projects: number;
}

export default function TimeTrackingWidget() {
  const { hasPermission } = useRoleBasedAccess();
  const { running, elapsed } = useTimer();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const canView = hasPermission('view_time_tracking');

  useEffect(() => {
    if (!canView) return;
    let alive = true;
    fetch('/api/time/summary')
      .then((r) => r.json())
      .then((d) => { if (alive && !d.error) setSummary(d); })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [canView, running]);

  if (!canView) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon name="ClockIcon" size={18} className="text-blue-600" />
          <h3 className="font-semibold text-slate-800">Time Tracking</h3>
        </div>
        <Link href="/time-tracking" className="text-sm text-blue-600 hover:underline">Open</Link>
      </div>

      {running ? (
        <Link href="/time-tracking" className="flex items-center gap-2 mb-4 rounded-lg bg-slate-900 text-white px-3 py-2">
          <span className={`h-2 w-2 rounded-full ${running.is_paused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
          <span className="font-mono text-sm tabular-nums">{formatClock(elapsed)}</span>
          <span className="text-xs text-slate-300 truncate">
            {running.task_name || running.project_name || running.description || 'Tracking…'}
          </span>
        </Link>
      ) : (
        <Link href="/time-tracking" className="flex items-center justify-center gap-2 mb-4 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600">
          <Icon name="PlayIcon" size={16} /> Start a timer
        </Link>
      )}

      {loading ? (
        <div className="grid grid-cols-3 gap-3">{[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-lg bg-slate-100 animate-pulse" />)}</div>
      ) : summary ? (
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-lg font-semibold text-slate-800">{formatMinutes(summary.today.total_minutes)}</p>
            <p className="text-[11px] text-slate-500">Today</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-800">{formatMinutes(summary.week.total_minutes)}</p>
            <p className="text-[11px] text-slate-500">This week</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-emerald-600">{formatMinutes(summary.week.billable_minutes)}</p>
            <p className="text-[11px] text-slate-500">Billable</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
