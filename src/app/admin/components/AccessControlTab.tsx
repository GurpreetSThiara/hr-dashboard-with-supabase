'use client';

/**
 * Access Control — manage Role Groups and Permission Sets (additive grants).
 * Admin only (the parent /admin page is gated to admin_panel).
 */
import React, { useEffect, useState, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';

type SubTab = 'groups' | 'sets';

interface RoleGroup { id: string; name: string; description: string | null; member_count: number; }
interface Member { id: string; user_email: string; first_name?: string; last_name?: string; role?: string; }
interface PermissionSet { id: string; name: string; description: string | null; permissions: string[]; assignment_count: number; }
interface Assignment { id: string; principal_type: string; principal_id: string; expires_at: string | null; expired: boolean; group_name?: string | null; }

export default function AccessControlTab() {
  const [sub, setSub] = useState<SubTab>('groups');
  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {([['groups', 'Role Groups', 'UserGroupIcon'], ['sets', 'Permission Sets', 'KeyIcon']] as const).map(([id, label, icon]) => (
          <button key={id} onClick={() => setSub(id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition ${sub === id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
            <Icon name={icon as any} size={13} /> {label}
          </button>
        ))}
      </div>
      {sub === 'groups' ? <RoleGroupsPanel /> : <PermissionSetsPanel />}
    </div>
  );
}

// ── Role Groups ────────────────────────────────────────────────────────────────

function RoleGroupsPanel() {
  const [groups, setGroups] = useState<RoleGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [selected, setSelected] = useState<RoleGroup | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [newMember, setNewMember] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/role-groups').then(r => r.json())
      .then(d => setGroups(d.groups || [])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const loadMembers = useCallback((g: RoleGroup) => {
    setSelected(g);
    fetch(`/api/admin/role-groups/${g.id}`).then(r => r.json()).then(d => setMembers(d.members || []));
  }, []);

  async function create() {
    if (!name.trim()) return;
    const res = await fetch('/api/admin/role-groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description: desc }) });
    if (!res.ok) { toast.error((await res.json()).error); return; }
    toast.success('Role group created'); setName(''); setDesc(''); load();
  }
  async function addMember() {
    if (!selected || !newMember.trim()) return;
    const res = await fetch(`/api/admin/role-groups/${selected.id}/members`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_email: newMember }) });
    if (!res.ok) { toast.error((await res.json()).error); return; }
    toast.success('Member added'); setNewMember(''); loadMembers(selected); load();
  }
  async function removeMember(email: string) {
    if (!selected) return;
    const res = await fetch(`/api/admin/role-groups/${selected.id}/members`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_email: email }) });
    if (!res.ok) { toast.error((await res.json()).error); return; }
    toast.success('Member removed'); loadMembers(selected); load();
  }
  async function del(g: RoleGroup) {
    if (!confirm(`Delete role group "${g.name}"?`)) return;
    const res = await fetch(`/api/admin/role-groups/${g.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error((await res.json()).error); return; }
    toast.success('Deleted'); if (selected?.id === g.id) setSelected(null); load();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-3">Role Groups</h3>
        <div className="flex gap-2 mb-4">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Group name" className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2" />
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description" className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2" />
          <button onClick={create} className="px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg">Add</button>
        </div>
        {loading ? <p className="text-xs text-slate-400">Loading…</p> : groups.length === 0 ? <p className="text-xs text-slate-400">No role groups yet.</p> : (
          <div className="space-y-2">
            {groups.map(g => (
              <div key={g.id} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer ${selected?.id === g.id ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`} onClick={() => loadMembers(g)}>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{g.name}</p>
                  <p className="text-[11px] text-slate-400">{g.description || '—'} · {g.member_count} member{g.member_count !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); del(g); }} className="text-xs text-red-500 hover:text-red-700">Delete</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-3">{selected ? `Members — ${selected.name}` : 'Members'}</h3>
        {!selected ? <p className="text-xs text-slate-400">Select a group to manage members.</p> : (
          <>
            <div className="flex gap-2 mb-4">
              <input value={newMember} onChange={e => setNewMember(e.target.value)} placeholder="user@company.com" className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2" />
              <button onClick={addMember} className="px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg">Add member</button>
            </div>
            {members.length === 0 ? <p className="text-xs text-slate-400">No members.</p> : (
              <div className="space-y-1.5">
                {members.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                    <div>
                      <p className="text-xs font-medium text-slate-700">{m.first_name ? `${m.first_name} ${m.last_name}` : m.user_email}</p>
                      <p className="text-[11px] text-slate-400">{m.user_email}{m.role ? ` · ${m.role}` : ''}</p>
                    </div>
                    <button onClick={() => removeMember(m.user_email)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Permission Sets ─────────────────────────────────────────────────────────────

function PermissionSetsPanel() {
  const [sets, setSets] = useState<PermissionSet[]>([]);
  const [known, setKnown] = useState<string[]>([]);
  const [groups, setGroups] = useState<RoleGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<{ name: string; description: string; permissions: string[] }>({ name: '', description: '', permissions: [] });
  const [selected, setSelected] = useState<PermissionSet | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assign, setAssign] = useState<{ principal_type: 'user' | 'role_group'; principal_id: string; expires_at: string }>({ principal_type: 'user', principal_id: '', expires_at: '' });

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/admin/permission-sets').then(r => r.json()),
      fetch('/api/admin/role-groups').then(r => r.json()),
    ]).then(([s, g]) => {
      setSets(s.sets || []); setKnown(s.knownPermissions || []); setGroups(g.groups || []);
    }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const loadAssignments = useCallback((s: PermissionSet) => {
    setSelected(s);
    fetch(`/api/admin/permission-sets/${s.id}/assignments`).then(r => r.json()).then(d => setAssignments(d.assignments || []));
  }, []);

  async function create() {
    if (!form.name.trim()) return;
    const res = await fetch('/api/admin/permission-sets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (!res.ok) { toast.error((await res.json()).error); return; }
    toast.success('Permission set created'); setForm({ name: '', description: '', permissions: [] }); load();
  }
  async function doAssign() {
    if (!selected || !assign.principal_id.trim()) return;
    const res = await fetch(`/api/admin/permission-sets/${selected.id}/assign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...assign, expires_at: assign.expires_at || null }) });
    if (!res.ok) { toast.error((await res.json()).error); return; }
    toast.success('Granted'); setAssign({ principal_type: 'user', principal_id: '', expires_at: '' }); loadAssignments(selected); load();
  }
  async function revoke(a: Assignment) {
    if (!selected) return;
    const res = await fetch(`/api/admin/permission-sets/${selected.id}/assign`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assignment_id: a.id }) });
    if (!res.ok) { toast.error((await res.json()).error); return; }
    toast.success('Revoked'); loadAssignments(selected); load();
  }
  async function del(s: PermissionSet) {
    if (!confirm(`Delete permission set "${s.name}"?`)) return;
    const res = await fetch(`/api/admin/permission-sets/${s.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error((await res.json()).error); return; }
    toast.success('Deleted'); if (selected?.id === s.id) setSelected(null); load();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-3">Create Permission Set</h3>
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Set name (e.g. HR Power Users)" className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 mb-2" />
        <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description" className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 mb-3" />
        <p className="text-[11px] font-semibold text-slate-500 uppercase mb-1.5">Permissions</p>
        <div className="grid grid-cols-2 gap-1.5 mb-3">
          {known.map(p => (
            <label key={p} className="flex items-center gap-1.5 text-[11px] text-slate-700">
              <input type="checkbox" checked={form.permissions.includes(p)}
                onChange={e => setForm(f => ({ ...f, permissions: e.target.checked ? [...f.permissions, p] : f.permissions.filter(x => x !== p) }))} />
              {p}
            </label>
          ))}
        </div>
        <button onClick={create} className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg">Create Set</button>

        <div className="mt-5 border-t border-slate-100 pt-4">
          <h4 className="text-xs font-bold text-slate-700 mb-2">Existing Sets</h4>
          {loading ? <p className="text-xs text-slate-400">Loading…</p> : sets.length === 0 ? <p className="text-xs text-slate-400">None yet.</p> : (
            <div className="space-y-2">
              {sets.map(s => (
                <div key={s.id} className={`p-3 rounded-lg border cursor-pointer ${selected?.id === s.id ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`} onClick={() => loadAssignments(s)}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800">{s.name}</p>
                    <button onClick={(e) => { e.stopPropagation(); del(s); }} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                  </div>
                  <p className="text-[11px] text-slate-400">{s.permissions.length} permissions · {s.assignment_count} active grant{s.assignment_count !== 1 ? 's' : ''}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-3">{selected ? `Grants — ${selected.name}` : 'Grants'}</h3>
        {!selected ? <p className="text-xs text-slate-400">Select a set to manage grants.</p> : (
          <>
            <div className="space-y-2 mb-4">
              <div className="flex gap-2">
                <select value={assign.principal_type} onChange={e => setAssign(a => ({ ...a, principal_type: e.target.value as any, principal_id: '' }))} className="text-xs border border-slate-200 rounded-lg px-2 py-2">
                  <option value="user">User</option>
                  <option value="role_group">Role Group</option>
                </select>
                {assign.principal_type === 'user' ? (
                  <input value={assign.principal_id} onChange={e => setAssign(a => ({ ...a, principal_id: e.target.value }))} placeholder="user@company.com" className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2" />
                ) : (
                  <select value={assign.principal_id} onChange={e => setAssign(a => ({ ...a, principal_id: e.target.value }))} className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-2">
                    <option value="">Select group…</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                )}
              </div>
              <div className="flex gap-2 items-center">
                <label className="text-[11px] text-slate-500">Expires (optional)</label>
                <input type="date" value={assign.expires_at} onChange={e => setAssign(a => ({ ...a, expires_at: e.target.value }))} className="text-xs border border-slate-200 rounded-lg px-2 py-2" />
                <button onClick={doAssign} className="ml-auto px-3 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg">Grant</button>
              </div>
            </div>
            {assignments.length === 0 ? <p className="text-xs text-slate-400">No active grants.</p> : (
              <div className="space-y-1.5">
                {assignments.map(a => (
                  <div key={a.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                    <div>
                      <p className="text-xs font-medium text-slate-700">
                        {a.principal_type === 'role_group' ? `Group: ${a.group_name || a.principal_id}` : a.principal_id}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {a.expires_at ? `Expires ${new Date(a.expires_at).toLocaleDateString('en-GB')}` : 'Permanent'}
                        {a.expired && <span className="text-red-500 font-semibold"> · EXPIRED</span>}
                      </p>
                    </div>
                    <button onClick={() => revoke(a)} className="text-xs text-red-500 hover:text-red-700">Revoke</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
