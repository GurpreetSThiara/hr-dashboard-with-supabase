'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Project, Client, Task } from '@/lib/timeTracking';

/** Loads projects + clients once, and tasks on demand per project. */
export function useLookups() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [tasksByProject, setTasksByProject] = useState<Record<string, Task[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [p, c] = await Promise.all([
          fetch('/api/time/projects?status=active').then((r) => r.json()),
          fetch('/api/time/clients').then((r) => r.json()),
        ]);
        if (!alive) return;
        setProjects(p.data || []);
        setClients(c.data || []);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const loadTasks = useCallback(async (projectId: string) => {
    if (!projectId || tasksByProject[projectId]) return;
    const r = await fetch(`/api/time/tasks?project_id=${projectId}`).then((res) => res.json());
    setTasksByProject((prev) => ({ ...prev, [projectId]: r.data || [] }));
  }, [tasksByProject]);

  return { projects, clients, tasksByProject, loadTasks, loading };
}
