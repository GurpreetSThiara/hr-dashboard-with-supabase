'use client';

/**
 * App-wide timer engine.
 *
 * - Hydrates the running entry from the server on mount (survives refresh / tab
 *   close — the server is the source of truth).
 * - Caches a lightweight snapshot in localStorage for instant render before the
 *   network responds.
 * - Ticks once per second, computing elapsed time from the entry's timestamps
 *   (so a backgrounded tab catches up correctly on focus).
 *
 * Provided app-wide; no-ops cleanly when the user is signed out or lacks the
 * manage_own_time permission.
 */
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useRoleBasedAccess } from '@/lib/useRoleBasedAccess';
import { elapsedSeconds, type TimeEntry } from '@/lib/timeTracking';

export interface TimerStartInput {
  project_id?: string | null;
  task_id?: string | null;
  client_id?: string | null;
  description?: string | null;
  activity_type?: string | null;
  is_billable?: boolean;
  tags?: string[];
}

interface TimerContextValue {
  running: TimeEntry | null;
  elapsed: number; // seconds
  loading: boolean;
  canTrack: boolean;
  start: (input?: TimerStartInput) => Promise<void>;
  stop: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  refresh: () => Promise<void>;
}

const TimerContext = createContext<TimerContextValue | null>(null);

export const useTimer = () => {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimer must be used within TimerProvider');
  return ctx;
};

const LS_KEY = 'hrcore_active_timer';

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { hasPermission } = useRoleBasedAccess();
  const canTrack = !!user && hasPermission('manage_own_time');

  const [running, setRunning] = useState<TimeEntry | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(false);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  // Instant hydrate from cache (before network).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cached = localStorage.getItem(LS_KEY);
    if (cached) {
      try { setRunning(JSON.parse(cached)); } catch {}
    }
  }, []);

  const persist = useCallback((entry: TimeEntry | null) => {
    setRunning(entry);
    if (typeof window === 'undefined') return;
    if (entry) localStorage.setItem(LS_KEY, JSON.stringify(entry));
    else localStorage.removeItem(LS_KEY);
  }, []);

  const refresh = useCallback(async () => {
    if (!canTrack) return;
    try {
      const res = await fetch('/api/time/timer');
      if (!res.ok) return;
      const { data } = await res.json();
      persist(data ?? null);
    } catch {
      /* keep cached value on network error */
    }
  }, [canTrack, persist]);

  // Hydrate from server when auth becomes available.
  useEffect(() => {
    if (canTrack) refresh();
    else persist(null);
  }, [canTrack, refresh, persist]);

  // 1s tick — recompute elapsed from timestamps.
  useEffect(() => {
    if (tick.current) clearInterval(tick.current);
    if (!running) { setElapsed(0); return; }
    const update = () => setElapsed(elapsedSeconds(running));
    update();
    tick.current = setInterval(update, 1000);
    return () => { if (tick.current) clearInterval(tick.current); };
  }, [running]);

  // Catch up after the tab regains focus.
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [refresh]);

  const act = useCallback(
    async (method: string, body?: any, errMsg?: string) => {
      if (!canTrack) return;
      setLoading(true);
      try {
        const res = await fetch('/api/time/timer', {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || errMsg || 'Timer action failed');
        // stop returns { stopped:true }; others return the running entry.
        if (json?.data?.stopped) persist(null);
        else persist(json.data ?? null);
      } catch (e: any) {
        toast.error(e.message || errMsg || 'Timer action failed');
      } finally {
        setLoading(false);
      }
    },
    [canTrack, persist]
  );

  const start = useCallback((input?: TimerStartInput) => act('POST', input ?? {}, 'Could not start timer'), [act]);
  const stop = useCallback(() => act('PATCH', { action: 'stop' }, 'Could not stop timer'), [act]);
  const pause = useCallback(() => act('PATCH', { action: 'pause' }, 'Could not pause timer'), [act]);
  const resume = useCallback(() => act('PATCH', { action: 'resume' }, 'Could not resume timer'), [act]);

  return (
    <TimerContext.Provider value={{ running, elapsed, loading, canTrack, start, stop, pause, resume, refresh }}>
      {children}
    </TimerContext.Provider>
  );
}
