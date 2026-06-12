'use client';

import { useCallback, useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { useRoleBasedAccess } from '@/lib/useRoleBasedAccess';
import { useTimer } from '@/contexts/TimerContext';
import type { TimeEntry } from '@/lib/timeTracking';
import { toDateStr, formatMinutes } from '@/lib/timeTracking';
import TimerBar from './components/TimerBar';
import EntriesList from './components/EntriesList';
import ManualEntryModal from './components/ManualEntryModal';
import WeeklyTimesheet from './components/WeeklyTimesheet';
import ApprovalsTab from './components/ApprovalsTab';
import Icon from '@/components/ui/AppIcon';

type Tab = 'today' | 'timesheet' | 'approvals';

export default function TimeTrackingPage() {
  const { hasPermission } = useRoleBasedAccess();
  const { running } = useTimer();
  const canApprove = hasPermission('approve_time');

  const [tab, setTab] = useState<Tab>('today');
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editing, setEditing] = useState<Partial<TimeEntry> | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const bump = useCallback(() => setRefreshKey((k) => k + 1), []);

  const loadToday = useCallback(async () => {
    setLoading(true);
    try {
      const today = toDateStr(new Date());
      const r = await fetch(`/api/time/entries?scope=mine&from=${today}T00:00:00&to=${today}T23:59:59`).then((res) => res.json());
      setEntries(r.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload today's entries when the tab is active, on refresh bumps, and when a
  // running timer stops (running → null).
  useEffect(() => { if (tab === 'today') loadToday(); }, [tab, refreshKey, loadToday]);
  useEffect(() => { if (!running) bump(); }, [running, bump]);

  const todayTotal = entries.reduce((s, e) => s + e.duration_minutes, 0);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'timesheet', label: 'Timesheet' },
    ...(canApprove ? [{ id: 'approvals' as Tab, label: 'Approvals' }] : []),
  ];

  return (
    <AppLayout pageTitle="Time Tracking" breadcrumb="Time" requiredPermission="view_time_tracking" requiredModule="time_tracking">
      <div className="space-y-6">
        <TimerBar onChange={bump} />

        <div className="flex items-center gap-0 border-b border-slate-200 overflow-x-auto scrollbar-none">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-3 font-medium border-b-2 whitespace-nowrap transition ${
                tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'today' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Today · <span className="font-semibold text-slate-700">{formatMinutes(todayTotal)}</span>
              </p>
              <button onClick={() => { setEditing(null); setModalOpen(true); }} className="btn-secondary">
                <Icon name="PlusIcon" size={16} /> Add entry
              </button>
            </div>
            <EntriesList
              entries={entries}
              loading={loading}
              onEdit={(e) => { setEditing(e); setModalOpen(true); }}
              onDuplicate={(e) => { setEditing({ ...e, id: undefined }); setModalOpen(true); }}
              onChanged={bump}
              emptyTitle="No time logged today"
              emptyDescription="Start the timer above or add a manual entry."
            />
          </div>
        )}

        {tab === 'timesheet' && <WeeklyTimesheet refreshKey={refreshKey} onChange={bump} />}
        {tab === 'approvals' && canApprove && <ApprovalsTab onChange={bump} />}

        <ManualEntryModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={bump} entry={editing} />
      </div>
    </AppLayout>
  );
}
