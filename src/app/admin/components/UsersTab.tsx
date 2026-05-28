'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────
interface SystemUser {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  tier: number;
  department: string | null;
  location: string | null;
  created_at: string;
}

interface Counts { total: number; privileged: number; hrManagement: number; staff: number; }

// ── Constants ─────────────────────────────────────────────────────────────────
const ALL_ROLES = [
  { name: 'Super Admin',    tier: 1 },  { name: 'Owner',         tier: 2 },
  { name: 'Admin',          tier: 3 },  { name: 'HR Admin',      tier: 4 },
  { name: 'HR Manager',     tier: 5 },  { name: 'HR Executive',  tier: 6 },
  { name: 'Recruiter',      tier: 7 },  { name: 'Payroll Manager', tier: 8 },
  { name: 'Finance',        tier: 9 },  { name: 'Compliance',    tier: 10 },
  { name: 'IT Ops',         tier: 11 }, { name: 'Director',      tier: 12 },
  { name: 'Manager',        tier: 13 }, { name: 'Team Lead',     tier: 14 },
  { name: 'Employee',       tier: 15 }, { name: 'Contractor',    tier: 16 },
  { name: 'Intern',         tier: 17 }, { name: 'Read-Only User', tier: 18 },
];

const TIER_COLOR: Record<number, string> = {
  1: 'bg-purple-100 text-purple-700 border-purple-200',
  2: 'bg-purple-50 text-purple-600 border-purple-200',
  3: 'bg-blue-100 text-blue-700 border-blue-200',
  4: 'bg-blue-50 text-blue-600 border-blue-200',
  5: 'bg-blue-50 text-blue-500 border-blue-100',
  6: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  7: 'bg-cyan-50 text-cyan-600 border-cyan-200',
  8: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  9: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  10:'bg-teal-100 text-teal-700 border-teal-200',
  11:'bg-teal-50 text-teal-600 border-teal-200',
  12:'bg-amber-100 text-amber-700 border-amber-200',
  13:'bg-amber-50 text-amber-600 border-amber-200',
  14:'bg-orange-50 text-orange-600 border-orange-200',
  15:'bg-slate-100 text-slate-700 border-slate-200',
  16:'bg-slate-50 text-slate-600 border-slate-200',
  17:'bg-slate-50 text-slate-500 border-slate-100',
  18:'bg-slate-50 text-slate-400 border-slate-100',
};

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-pink-500', 'bg-indigo-500', 'bg-teal-500', 'bg-rose-500',
];

function avatarColor(email: string) {
  let h = 0;
  for (let i = 0; i < email.length; i++) h = email.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function initials(user: SystemUser) {
  if (user.full_name) {
    const parts = user.full_name.trim().split(' ');
    return (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
  }
  return user.email[0]?.toUpperCase() || '?';
}

// ── Role Change Modal ─────────────────────────────────────────────────────────
interface RoleChangeModalProps {
  target: SystemUser;
  requesterTier: number;
  onClose: () => void;
  onSuccess: (updated: SystemUser) => void;
}

function RoleChangeModal({ target, requesterTier, onClose, onSuccess }: RoleChangeModalProps) {
  const [selectedRole, setSelectedRole] = useState(target.role);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();

  const selectedTier = ALL_ROLES.find(r => r.name === selectedRole)?.tier ?? target.tier;
  const isEscalation = selectedTier < target.tier;
  const isDemotion = selectedTier > target.tier;
  const isPrivEscalation = selectedTier < requesterTier;
  const hasChange = selectedRole !== target.role;

  async function handleSave() {
    if (!hasChange) { onClose(); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${target.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newRole: selectedRole,
          requesterId: user?.id,
          requesterTier,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update role');
      toast.success(`Role updated: ${target.role} → ${selectedRole}`);
      onSuccess({ ...target, role: selectedRole, tier: selectedTier });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Icon name="UserCircleIcon" size={22} className="text-blue-600" />
            Change Role
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <Icon name="XMarkIcon" size={20} />
          </button>
        </div>

        {/* User info */}
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg mb-5">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${avatarColor(target.email)}`}>
            {initials(target)}
          </div>
          <div>
            <p className="font-semibold text-slate-900">{target.full_name || target.email}</p>
            <p className="text-xs text-slate-500">{target.email}</p>
          </div>
          <div className="ml-auto text-right">
            <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${TIER_COLOR[target.tier] || TIER_COLOR[15]}`}>
              {target.role}
            </span>
            <p className="text-xs text-slate-400 mt-0.5">Current role</p>
          </div>
        </div>

        {/* New role selector */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-slate-700 mb-2">New Role</label>
          <select
            value={selectedRole}
            onChange={e => setSelectedRole(e.target.value)}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            {ALL_ROLES
              .filter(r => r.tier >= requesterTier) // can't assign higher privilege than own
              .map(r => (
                <option key={r.tier} value={r.name}>
                  {r.name} (Tier {r.tier})
                </option>
              ))}
          </select>
        </div>

        {/* Impact preview */}
        {hasChange && (
          <div className={`flex items-start gap-3 p-3 rounded-lg mb-5 text-sm ${
            isPrivEscalation ? 'bg-red-50 border border-red-200' :
            isEscalation ? 'bg-blue-50 border border-blue-200' :
            isDemotion ? 'bg-amber-50 border border-amber-200' :
            'bg-slate-50 border border-slate-200'
          }`}>
            <Icon
              name={isPrivEscalation ? 'ExclamationTriangleIcon' : isEscalation ? 'ArrowUpCircleIcon' : 'ArrowDownCircleIcon'}
              size={18}
              className={isPrivEscalation ? 'text-red-600' : isEscalation ? 'text-blue-600' : 'text-amber-600'}
            />
            <div>
              {isPrivEscalation ? (
                <p className="text-red-700 font-semibold">
                  You cannot assign a role with higher privileges than your own.
                </p>
              ) : isEscalation ? (
                <>
                  <p className="text-blue-700 font-semibold">Privilege increase</p>
                  <p className="text-blue-600 text-xs mt-0.5">
                    {target.full_name || target.email} will gain additional permissions including those associated with {selectedRole}.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-amber-700 font-semibold">Privilege decrease</p>
                  <p className="text-amber-600 text-xs mt-0.5">
                    {target.full_name || target.email} will lose some permissions. Ensure they don't have active tasks requiring higher access.
                  </p>
                </>
              )}
              <p className="text-xs mt-1 font-medium">
                {target.role} <Icon name="ArrowRightIcon" size={11} className="inline" /> {selectedRole}
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChange || saving || isPrivEscalation}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 flex items-center gap-2"
          >
            {saving && <Icon name="ArrowPathIcon" size={15} className="animate-spin" />}
            {saving ? 'Saving…' : 'Confirm Change'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Deactivate Confirm Modal ──────────────────────────────────────────────────
interface DeactivateModalProps {
  target: SystemUser;
  requesterTier: number;
  onClose: () => void;
  onSuccess: () => void;
}

function DeactivateModal({ target, requesterTier, onClose, onSuccess }: DeactivateModalProps) {
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();

  async function handleDeactivate() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${target.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesterId: user?.id, requesterTier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`${target.full_name || target.email} has been deactivated.`);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <Icon name="UserMinusIcon" size={20} className="text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Deactivate User</h3>
            <p className="text-sm text-slate-500">This will block their login access.</p>
          </div>
        </div>
        <p className="text-sm text-slate-700 mb-6">
          Are you sure you want to deactivate{' '}
          <strong>{target.full_name || target.email}</strong>?
          They will no longer be able to sign in.
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={handleDeactivate}
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Icon name="ArrowPathIcon" size={15} className="animate-spin" />}
            Deactivate
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function UsersTab() {
  const { user: currentUser, tier: requesterTier } = useAuth();

  const [users, setUsers] = useState<SystemUser[]>([]);
  const [counts, setCounts] = useState<Counts>({ total: 0, privileged: 0, hrManagement: 0, staff: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('');
  const [roleModal, setRoleModal] = useState<SystemUser | null>(null);
  const [deactivateModal, setDeactivateModal] = useState<SystemUser | null>(null);
  const [deactivatedIds, setDeactivatedIds] = useState<Set<string>>(new Set());

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (tierFilter) params.set('tier', tierFilter);
      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUsers(data.users || []);
      setCounts(data.counts || { total: 0, privileged: 0, hrManagement: 0, staff: 0 });
    } catch (err: any) {
      toast.error(`Failed to load users: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [search, tierFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function handleRoleSuccess(updated: SystemUser) {
    setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
    setRoleModal(null);
  }

  function canChangeRole(target: SystemUser) {
    if (target.id === currentUser?.id) return false;
    if (target.tier < (requesterTier || 99)) return false;
    return true;
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Users',       value: counts.total,       icon: 'UsersIcon',           color: 'text-blue-600',   bg: 'bg-blue-100'   },
          { label: 'Super Admin / Owner', value: counts.privileged,  icon: 'ShieldCheckIcon',     color: 'text-purple-600', bg: 'bg-purple-100' },
          { label: 'HR & Management',   value: counts.hrManagement, icon: 'BuildingOfficeIcon',  color: 'text-amber-600',  bg: 'bg-amber-100'  },
          { label: 'Staff & Others',    value: counts.staff,        icon: 'UserGroupIcon',       color: 'text-slate-600',  bg: 'bg-slate-100'  },
        ].map(c => (
          <div key={c.label} className="bg-white border border-slate-200 rounded-xl p-5">
            <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center mb-3`}>
              <Icon name={c.icon as any} size={18} className={c.color} />
            </div>
            <p className="text-2xl font-bold text-slate-900">{loading ? '—' : c.value}</p>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email, role, department…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <Icon name="XMarkIcon" size={14} />
              </button>
            )}
          </div>
          <select
            value={tierFilter}
            onChange={e => setTierFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none"
          >
            <option value="">All Roles</option>
            {ALL_ROLES.map(r => (
              <option key={r.tier} value={r.tier}>{r.name}</option>
            ))}
          </select>
          <button
            onClick={fetchUsers}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2"
          >
            <Icon name="ArrowPathIcon" size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <span className="ml-auto text-sm text-slate-500">
            {loading ? 'Loading…' : `${users.length} user${users.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Icon name="ArrowPathIcon" size={28} className="animate-spin text-blue-600" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Icon name="UsersIcon" size={36} className="mb-3" />
            <p className="font-semibold">No users found</p>
            {(search || tierFilter) && (
              <button onClick={() => { setSearch(''); setTierFilter(''); }} className="mt-2 text-sm text-blue-600 hover:underline">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold text-slate-700">User</th>
                  <th className="px-5 py-3 text-left font-semibold text-slate-700">Role</th>
                  <th className="px-5 py-3 text-left font-semibold text-slate-700">Department</th>
                  <th className="px-5 py-3 text-left font-semibold text-slate-700">Joined</th>
                  <th className="px-5 py-3 text-right font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(u => {
                  const isCurrentUser = u.id === currentUser?.id;
                  const isDeactivated = deactivatedIds.has(u.id);
                  const canChange = canChangeRole(u);
                  return (
                    <tr
                      key={u.id}
                      className={`transition-colors hover:bg-slate-50 ${isDeactivated ? 'opacity-50' : ''}`}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${avatarColor(u.email)}`}>
                            {initials(u)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                              {u.full_name || '—'}
                              {isCurrentUser && (
                                <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-600 rounded-full">You</span>
                              )}
                              {isDeactivated && (
                                <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-600 rounded-full">Deactivated</span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${TIER_COLOR[u.tier] || TIER_COLOR[15]}`}>
                          {u.role}
                        </span>
                        <span className="ml-2 text-xs text-slate-400">T{u.tier}</span>
                      </td>
                      <td className="px-5 py-3 text-slate-500">{u.department || '—'}</td>
                      <td className="px-5 py-3 text-slate-500 text-xs">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {canChange ? (
                            <>
                              <button
                                onClick={() => setRoleModal(u)}
                                className="px-2.5 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1"
                              >
                                <Icon name="UserCircleIcon" size={13} />
                                Change Role
                              </button>
                              {!isDeactivated && u.tier > 1 && (
                                <button
                                  onClick={() => setDeactivateModal(u)}
                                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Deactivate user"
                                >
                                  <Icon name="UserMinusIcon" size={15} />
                                </button>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <Icon name="LockClosedIcon" size={13} />
                              {isCurrentUser ? 'You' : 'Protected'}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {roleModal && (
        <RoleChangeModal
          target={roleModal}
          requesterTier={requesterTier || 1}
          onClose={() => setRoleModal(null)}
          onSuccess={handleRoleSuccess}
        />
      )}
      {deactivateModal && (
        <DeactivateModal
          target={deactivateModal}
          requesterTier={requesterTier || 1}
          onClose={() => setDeactivateModal(null)}
          onSuccess={() => {
            setDeactivatedIds(prev => new Set([...prev, deactivateModal.id]));
            setDeactivateModal(null);
          }}
        />
      )}
    </div>
  );
}
