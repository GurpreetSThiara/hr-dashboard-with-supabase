'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/AppIcon';

interface TreeNode {
  id: string; emp_id: string; name: string; email: string;
  designation: string; department: string; location: string | null;
  reports: TreeNode[];
}

const AVATAR_COLORS = ['bg-blue-600','bg-violet-600','bg-emerald-600','bg-amber-600','bg-pink-600','bg-indigo-600','bg-teal-600','bg-rose-600','bg-cyan-600','bg-orange-600'];
function avatar(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h); return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]; }

function countDescendants(n: TreeNode): number {
  return n.reports.reduce((acc, r) => acc + 1 + countDescendants(r), 0);
}

function Node({ node, depth, filter }: { node: TreeNode; depth: number; filter: string }) {
  const [open, setOpen] = useState(depth < 2);
  const total = useMemo(() => countDescendants(node), [node]);
  const hasReports = node.reports.length > 0;

  // When filtering, auto-expand and only render matching subtrees
  const matches = (n: TreeNode): boolean => {
    if (!filter) return true;
    const f = filter.toLowerCase();
    const self = n.name.toLowerCase().includes(f) || n.designation.toLowerCase().includes(f) || n.department.toLowerCase().includes(f) || n.email.toLowerCase().includes(f);
    return self || n.reports.some(matches);
  };
  if (filter && !matches(node)) return null;
  const expanded = filter ? true : open;

  return (
    <div className="ml-0">
      <div className="flex items-center gap-2 py-1.5">
        <button
          onClick={() => setOpen((o) => !o)}
          disabled={!hasReports}
          className={`w-5 h-5 flex items-center justify-center rounded ${hasReports ? 'hover:bg-slate-100 text-slate-500' : 'text-transparent'}`}
        >
          <Icon name={expanded ? 'ChevronDownIcon' : 'ChevronRightIcon'} size={14} />
        </button>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${avatar(node.emp_id)}`}>
          {node.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">
            {node.name}
            {hasReports && <span className="ml-2 text-[10px] font-normal text-slate-400">{total} report{total > 1 ? 's' : ''}</span>}
          </p>
          <p className="text-xs text-slate-500 truncate">{node.designation} · {node.department}</p>
        </div>
      </div>
      {expanded && hasReports && (
        <div className="ml-4 border-l border-slate-200 pl-3">
          {node.reports.map((r) => <Node key={r.id} node={r} depth={depth + 1} filter={filter} />)}
        </div>
      )}
    </div>
  );
}

export default function OrgChart() {
  const [roots, setRoots] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetch('/api/organization/chart')
      .then((r) => (r.ok ? r.json() : { roots: [] }))
      .then((d) => setRoots(d.roots || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
        <Icon name="ArrowPathIcon" size={24} className="animate-spin mx-auto text-blue-600 mb-2" />
        <p className="text-sm text-slate-500">Loading organization structure…</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Icon name="ShareIcon" size={16} className="text-blue-600" /> Reporting Structure
        </h3>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search person, role, department…"
          className="text-xs border border-slate-200 rounded-lg px-3 py-2 w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {roots.length === 0 ? (
        <p className="text-sm text-slate-400">No organization data available.</p>
      ) : (
        <div className="overflow-x-auto">
          {roots.map((r) => <Node key={r.id} node={r} depth={0} filter={filter} />)}
        </div>
      )}
    </div>
  );
}
