'use client';

/**
 * Primary timer control for the Time Tracking page. Pick project/task + a
 * description, then start. While running it shows the live clock and
 * pause/resume/stop. Changing the project and starting again "switches" tasks
 * (server auto-stops the previous timer).
 */
import { useEffect, useState } from 'react';
import { useTimer } from '@/contexts/TimerContext';
import { formatClock } from '@/lib/timeTracking';
import { useLookups } from './useLookups';
import Icon from '@/components/ui/AppIcon';

export default function TimerBar({ onChange }: { onChange?: () => void }) {
  const { running, elapsed, start, stop, pause, resume, loading } = useTimer();
  const { projects, tasksByProject, loadTasks } = useLookups();

  const [projectId, setProjectId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [description, setDescription] = useState('');
  const [billable, setBillable] = useState(true);

  useEffect(() => { if (projectId) loadTasks(projectId); }, [projectId, loadTasks]);

  const tasks = projectId ? tasksByProject[projectId] || [] : [];

  async function handleStart() {
    await start({
      project_id: projectId || null,
      task_id: taskId || null,
      description: description.trim() || null,
      is_billable: billable,
    });
    onChange?.();
  }

  async function handleStop() {
    await stop();
    setDescription('');
    onChange?.();
  }

  if (running) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className={`h-3 w-3 rounded-full shrink-0 ${running.is_paused ? 'bg-amber-400' : 'bg-emerald-500 animate-pulse'}`} />
            <div className="min-w-0">
              <p className="font-medium text-slate-800 truncate">
                {running.task_name || running.project_name || running.description || 'Untitled entry'}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {running.project_name ? `${running.project_name}${running.client_name ? ` · ${running.client_name}` : ''}` : 'No project'}
                {running.is_paused ? ' · paused' : ''}
              </p>
            </div>
          </div>
          <div className="font-mono text-2xl sm:text-3xl tabular-nums text-slate-900">{formatClock(elapsed)}</div>
          <div className="flex items-center gap-2">
            {running.is_paused ? (
              <button onClick={resume} disabled={loading} className="btn-secondary">
                <Icon name="PlayIcon" size={16} /> Resume
              </button>
            ) : (
              <button onClick={pause} disabled={loading} className="btn-secondary">
                <Icon name="PauseIcon" size={16} /> Pause
              </button>
            )}
            <button onClick={handleStop} disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-50">
              <Icon name="StopIcon" size={16} /> Stop
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
        <div className="md:col-span-4">
          <label className="block text-xs font-medium text-slate-500 mb-1">What are you working on?</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleStart(); }}
            placeholder="Description"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="md:col-span-3">
          <label className="block text-xs font-medium text-slate-500 mb-1">Project</label>
          <select
            value={projectId}
            onChange={(e) => { setProjectId(e.target.value); setTaskId(''); }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="">No project</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="md:col-span-3">
          <label className="block text-xs font-medium text-slate-500 mb-1">Task</label>
          <select
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            disabled={!projectId}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white disabled:bg-slate-50 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">No task</option>
            {tasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="md:col-span-2 flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-slate-600 select-none">
            <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} className="rounded border-slate-300" />
            Billable
          </label>
          <button
            onClick={handleStart}
            disabled={loading}
            className="ml-auto inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
          >
            <Icon name="PlayIcon" variant="solid" size={16} /> Start
          </button>
        </div>
      </div>
    </div>
  );
}
