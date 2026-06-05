'use client';

/**
 * Persistent floating timer widget — visible on every authenticated page while
 * a timer is running. Touch-friendly controls; collapses to a compact pill on
 * small screens.
 */
import Link from 'next/link';
import { useTimer } from '@/contexts/TimerContext';
import { formatClock } from '@/lib/timeTracking';
import Icon from '@/components/ui/AppIcon';

export default function FloatingTimer() {
  const { running, elapsed, pause, resume, stop, loading, canTrack } = useTimer();
  if (!canTrack || !running) return null;

  const label = running.task_name || running.project_name || running.description || 'Untitled';

  return (
    <div className="fixed z-50 bottom-[calc(72px+env(safe-area-inset-bottom))] right-3 lg:bottom-5 lg:right-5">
      <div className="flex items-center gap-2 rounded-full bg-slate-900 text-white shadow-lg ring-1 ring-black/10 pl-3 pr-2 py-2">
        <span className={`h-2.5 w-2.5 rounded-full ${running.is_paused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
        <Link href="/time-tracking" className="flex flex-col leading-tight min-w-0">
          <span className="font-mono text-sm tabular-nums">{formatClock(elapsed)}</span>
          <span className="hidden sm:block text-[11px] text-slate-300 truncate max-w-[160px]">{label}</span>
        </Link>
        <div className="flex items-center gap-1 ml-1">
          {running.is_paused ? (
            <button
              onClick={resume}
              disabled={loading}
              aria-label="Resume timer"
              className="grid place-items-center h-8 w-8 rounded-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50"
            >
              <Icon name="PlayIcon" variant="solid" size={16} className="text-white" />
            </button>
          ) : (
            <button
              onClick={pause}
              disabled={loading}
              aria-label="Pause timer"
              className="grid place-items-center h-8 w-8 rounded-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50"
            >
              <Icon name="PauseIcon" variant="solid" size={16} className="text-white" />
            </button>
          )}
          <button
            onClick={stop}
            disabled={loading}
            aria-label="Stop timer"
            className="grid place-items-center h-8 w-8 rounded-full bg-rose-500 hover:bg-rose-400 disabled:opacity-50"
          >
            <Icon name="StopIcon" variant="solid" size={16} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
