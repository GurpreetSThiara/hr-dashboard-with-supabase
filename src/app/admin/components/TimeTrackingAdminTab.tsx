'use client';

/**
 * Admin configuration for Time Tracking: manage clients, projects (with billing
 * rate + estimate + budget), and the tasks within each project.
 */
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Project, Client, Task } from '@/lib/timeTracking';
import { formatMinutes } from '@/lib/timeTracking';
import Icon from '@/components/ui/AppIcon';
import EmptyState from '@/components/ui/EmptyState';

export default function TimeTrackingAdminTab() {
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<(Project & { tracked_minutes?: number })[]>([]);
  const [loading, setLoading] = useState(true);

  const [newClient, setNewClient] = useState('');
  const [proj, setProj] = useState({ name: '', client_id: '', billing_rate: '', estimated_hours: '', is_billable: true });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Record<string, Task[]>>({});
  const [newTask, setNewTask] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, p] = await Promise.all([
        fetch('/api/time/clients').then((r) => r.json()),
        fetch('/api/time/projects').then((r) => r.json()),
      ]);
      setClients(c.data || []);
      setProjects(p.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function post(url: string, body: any, ok: string) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Request failed');
    toast.success(ok);
    return json.data;
  }

  async function addClient() {
    if (!newClient.trim()) return;
    try { await post('/api/time/clients', { name: newClient.trim() }, 'Client added'); setNewClient(''); load(); }
    catch (e: any) { toast.error(e.message); }
  }

  async function addProject() {
    if (!proj.name.trim()) { toast.error('Project name is required'); return; }
    try {
      await post('/api/time/projects', {
        name: proj.name.trim(),
        client_id: proj.client_id || null,
        is_billable: proj.is_billable,
        billing_rate: proj.billing_rate ? Number(proj.billing_rate) : null,
        estimated_hours: proj.estimated_hours ? Number(proj.estimated_hours) : null,
      }, 'Project created');
      setProj({ name: '', client_id: '', billing_rate: '', estimated_hours: '', is_billable: true });
      load();
    } catch (e: any) { toast.error(e.message); }
  }

  async function toggleProject(id: string) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    setNewTask('');
    if (!tasks[id]) {
      const r = await fetch(`/api/time/tasks?project_id=${id}`).then((res) => res.json());
      setTasks((prev) => ({ ...prev, [id]: r.data || [] }));
    }
  }

  async function addTask(projectId: string) {
    if (!newTask.trim()) return;
    try {
      const t = await post('/api/time/tasks', { project_id: projectId, name: newTask.trim() }, 'Task added');
      setTasks((prev) => ({ ...prev, [projectId]: [...(prev[projectId] || []), t] }));
      setNewTask('');
    } catch (e: any) { toast.error(e.message); }
  }

  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name ?? '—';

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Clients */}
      <section>
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Clients</h3>
        <div className="flex gap-2 mb-3">
          <input value={newClient} onChange={(e) => setNewClient(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addClient()}
            placeholder="New client name" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
          <button onClick={addClient} className="btn-primary"><Icon name="PlusIcon" size={16} /> Add</button>
        </div>
        {clients.length === 0 ? (
          <p className="text-sm text-slate-400">No clients yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {clients.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                <Icon name="BriefcaseIcon" size={14} className="text-slate-400" /> {c.name}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Projects */}
      <section>
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Projects</h3>
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 mb-4 items-end">
          <div className="sm:col-span-4">
            <label className="block text-xs text-slate-500 mb-1">Name</label>
            <input value={proj.name} onChange={(e) => setProj({ ...proj, name: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="sm:col-span-3">
            <label className="block text-xs text-slate-500 mb-1">Client</label>
            <select value={proj.client_id} onChange={(e) => setProj({ ...proj, client_id: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500">
              <option value="">None</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Rate/hr</label>
            <input type="number" value={proj.billing_rate} onChange={(e) => setProj({ ...proj, billing_rate: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Est. hrs</label>
            <input type="number" value={proj.estimated_hours} onChange={(e) => setProj({ ...proj, estimated_hours: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="sm:col-span-1">
            <button onClick={addProject} className="btn-primary w-full justify-center"><Icon name="PlusIcon" size={16} /></button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">{[0, 1].map((i) => <div key={i} className="h-12 rounded-lg bg-slate-100 animate-pulse" />)}</div>
        ) : projects.length === 0 ? (
          <EmptyState icon="FolderIcon" title="No projects" description="Create a project so time can be tracked against it." />
        ) : (
          <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
            {projects.map((p) => (
              <div key={p.id}>
                <button onClick={() => toggleProject(p.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                  <Icon name={expanded === p.id ? 'ChevronDownIcon' : 'ChevronRightIcon'} size={16} className="text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                    <p className="text-xs text-slate-500">{clientName(p.client_id)}{p.is_billable && p.billing_rate ? ` · $${p.billing_rate}/hr` : ''}</p>
                  </div>
                  <span className="text-xs text-slate-400">{formatMinutes(p.tracked_minutes || 0)} tracked</span>
                </button>
                {expanded === p.id && (
                  <div className="px-4 pb-4 pl-11 space-y-2">
                    {(tasks[p.id] || []).map((t) => (
                      <div key={t.id} className="flex items-center gap-2 text-sm text-slate-600">
                        <Icon name="CheckCircleIcon" size={14} className="text-slate-300" /> {t.name}
                      </div>
                    ))}
                    <div className="flex gap-2 pt-1">
                      <input value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTask(p.id)}
                        placeholder="New task" className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500" />
                      <button onClick={() => addTask(p.id)} className="btn-secondary text-sm">Add task</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
