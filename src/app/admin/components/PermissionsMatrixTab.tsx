'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

// ── Types ────────────────────────────────────────────────────────────────────
type PermMatrix = Record<string, number[]>;

interface RoleMeta {
  name: string;
  tier: number;
  color: string;
  bgColor: string;
}

interface PermInfo {
  label: string;
  description: string;
  category: 'view' | 'manage' | 'system';
  critical?: boolean; // can never be revoked from tier 1
}

// ── Constants ─────────────────────────────────────────────────────────────────
const ROLES: RoleMeta[] = [
  { name: 'Super Admin',   tier: 1,  color: 'text-purple-700', bgColor: 'bg-purple-100' },
  { name: 'Owner',         tier: 2,  color: 'text-purple-600', bgColor: 'bg-purple-50'  },
  { name: 'Admin',         tier: 3,  color: 'text-blue-700',   bgColor: 'bg-blue-100'   },
  { name: 'HR Admin',      tier: 4,  color: 'text-blue-600',   bgColor: 'bg-blue-50'    },
  { name: 'HR Manager',    tier: 5,  color: 'text-blue-500',   bgColor: 'bg-blue-50'    },
  { name: 'HR Executive',  tier: 6,  color: 'text-cyan-700',   bgColor: 'bg-cyan-100'   },
  { name: 'Recruiter',     tier: 7,  color: 'text-cyan-600',   bgColor: 'bg-cyan-50'    },
  { name: 'Payroll Manager', tier: 8, color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
  { name: 'Finance',       tier: 9,  color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
  { name: 'Compliance',    tier: 10, color: 'text-teal-700',   bgColor: 'bg-teal-100'   },
  { name: 'IT Ops',        tier: 11, color: 'text-teal-600',   bgColor: 'bg-teal-50'    },
  { name: 'Director',      tier: 12, color: 'text-amber-700',  bgColor: 'bg-amber-100'  },
  { name: 'Manager',       tier: 13, color: 'text-amber-600',  bgColor: 'bg-amber-50'   },
  { name: 'Team Lead',     tier: 14, color: 'text-orange-600', bgColor: 'bg-orange-50'  },
  { name: 'Employee',      tier: 15, color: 'text-slate-700',  bgColor: 'bg-slate-100'  },
  { name: 'Contractor',    tier: 16, color: 'text-slate-600',  bgColor: 'bg-slate-50'   },
  { name: 'Intern',        tier: 17, color: 'text-slate-500',  bgColor: 'bg-slate-50'   },
  { name: 'Read-Only User',tier: 18, color: 'text-slate-400',  bgColor: 'bg-slate-50'   },
];

const PERMISSIONS: Record<string, PermInfo> = {
  view_dashboard:    { label: 'View Dashboard',         description: 'Access the main dashboard page',                                      category: 'view' },
  view_hr_dashboard: { label: 'View HR Analytics Dashboard', description: 'Access the company-wide HR metrics, headcount, and analytics widgets. If disabled, users see the self-service dashboard.', category: 'view' },
  view_employees:    { label: 'View Employee Directory', description: 'Browse the employee list and view profiles',              category: 'view' },
  view_leaves:       { label: 'View Leave Requests',     description: 'See leave requests and the leave calendar',               category: 'view' },
  view_attendance:   { label: 'View Attendance',         description: 'Access attendance records and check-in/out logs',         category: 'view' },
  view_hierarchy:    { label: 'View Org Hierarchy',      description: 'See the organisational reporting structure',              category: 'view' },
  manage_employees:  { label: 'Manage Employees',        description: 'Add, edit, and delete employee records',                  category: 'manage' },
  approve_leaves:    { label: 'Approve Leave Requests',  description: 'Review and approve or reject leave requests',             category: 'manage' },
  manage_policies:   { label: 'Manage Leave Policies',   description: 'Create and configure leave type policies',                category: 'manage' },
  manage_attendance: { label: 'Manage Attendance',       description: 'Edit and correct attendance records',                     category: 'manage' },
  manage_hierarchy:  { label: 'Manage Org Hierarchy',    description: 'Reassign managers and restructure the org chart',         category: 'manage' },
  admin_panel:       { label: 'Admin Panel Access',      description: 'Access the admin panel, manage permissions and system settings', category: 'system', critical: true },
};

const CATEGORIES = [
  { key: 'view',   label: 'View Permissions',       icon: 'EyeIcon',          color: 'text-slate-600', bg: 'bg-slate-50' },
  { key: 'manage', label: 'Management Permissions', icon: 'WrenchScrewdriverIcon', color: 'text-blue-600', bg: 'bg-blue-50' },
  { key: 'system', label: 'System Permissions',     icon: 'ShieldCheckIcon',  color: 'text-purple-600', bg: 'bg-purple-50' },
] as const;

const DEFAULT_MATRIX: PermMatrix = {
  view_dashboard:   [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18],
  view_hr_dashboard:[1,2,3,4,5,6,7,8,9,10,11],
  view_employees:   [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
  manage_employees: [1,2,3,4,5,6,7],
  view_leaves:      [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18],
  approve_leaves:   [1,2,3,4,5,6,12,13],
  manage_policies:  [1,2],
  view_attendance:  [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
  manage_attendance:[1,2,3,4,5],
  view_hierarchy:   [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
  manage_hierarchy: [1,2,3,4],
  admin_panel:      [1,2],
};

// ── Toggle Switch ─────────────────────────────────────────────────────────────
function Toggle({ enabled, onChange, disabled }: { enabled: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
      } ${enabled ? 'bg-blue-600' : 'bg-slate-300'}`}
      aria-checked={enabled}
      role="switch"
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function PermissionsMatrixTab() {
  const { user } = useAuth();
  const supabase = createClient();

  const [matrix, setMatrix] = useState<PermMatrix>(DEFAULT_MATRIX);
  const [savedMatrix, setSavedMatrix] = useState<PermMatrix>(DEFAULT_MATRIX);
  const [selectedTier, setSelectedTier] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDefault, setIsDefault] = useState(true);
  const [roleSearch, setRoleSearch] = useState('');
  const [userCounts, setUserCounts] = useState<Record<number, number>>({});
  const [copyFromTier, setCopyFromTier] = useState<string>('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [pendingSwitchTier, setPendingSwitchTier] = useState<number | null>(null);

  const isDirty = JSON.stringify(matrix) !== JSON.stringify(savedMatrix);
  const totalPermissions = Object.keys(PERMISSIONS).length;

  // ── Loaders ────────────────────────────────────────────────────────────────
  const loadMatrix = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/role-permissions');
      const data = await res.json();
      setMatrix(data.matrix);
      setSavedMatrix(data.matrix);
      setIsDefault(data.isDefault);
    } catch {
      toast.error('Failed to load permissions');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUserCounts = useCallback(async () => {
    const { data } = await supabase.from('users').select('tier');
    if (!data) return;
    const counts: Record<number, number> = {};
    data.forEach((u: any) => { counts[u.tier] = (counts[u.tier] || 0) + 1; });
    setUserCounts(counts);
  }, []);

  useEffect(() => {
    loadMatrix();
    loadUserCounts();
  }, []);

  // ── Computed helpers ───────────────────────────────────────────────────────
  const grantedCount = useCallback(
    (tier: number) => Object.values(matrix).filter(tiers => tiers.includes(tier)).length,
    [matrix]
  );

  const isProtected = (perm: string, tier: number) =>
    PERMISSIONS[perm]?.critical && tier <= 2;

  const hasChanged = (perm: string, tier: number) =>
    matrix[perm]?.includes(tier) !== savedMatrix[perm]?.includes(tier);

  const selectedGrantedPerms = useMemo(
    () => Object.keys(PERMISSIONS).filter(p => (matrix[p] || []).includes(selectedTier)),
    [matrix, selectedTier]
  );

  const filteredRoles = ROLES.filter(r =>
    r.name.toLowerCase().includes(roleSearch.toLowerCase())
  );

  // ── Actions ────────────────────────────────────────────────────────────────
  function togglePermission(perm: string, tier: number) {
    if (isProtected(perm, tier)) {
      toast.error('This permission is protected and cannot be removed from Super Admin or Owner.', { duration: 3000 });
      return;
    }
    setMatrix(prev => {
      const current = prev[perm] || [];
      const has = current.includes(tier);
      return { ...prev, [perm]: has ? current.filter(t => t !== tier) : [...current, tier].sort((a, b) => a - b) };
    });
  }

  function handleRoleSwitch(tier: number) {
    if (isDirty) {
      setPendingSwitchTier(tier);
      setShowUnsavedWarning(true);
    } else {
      setSelectedTier(tier);
    }
  }

  function confirmSwitchWithoutSaving() {
    setMatrix(savedMatrix);
    if (pendingSwitchTier !== null) setSelectedTier(pendingSwitchTier);
    setPendingSwitchTier(null);
    setShowUnsavedWarning(false);
  }

  function copyPermissionsFrom(sourceTier: number) {
    const sourcePerms = Object.keys(PERMISSIONS).filter(p => (matrix[p] || []).includes(sourceTier));
    const newMatrix = { ...matrix };
    for (const perm of Object.keys(PERMISSIONS)) {
      const current = newMatrix[perm] || [];
      const shouldHave = sourcePerms.includes(perm);
      const has = current.includes(selectedTier);
      if (isProtected(perm, selectedTier)) continue;
      if (shouldHave && !has) {
        newMatrix[perm] = [...current, selectedTier].sort((a, b) => a - b);
      } else if (!shouldHave && has) {
        newMatrix[perm] = current.filter(t => t !== selectedTier);
      }
    }
    setMatrix(newMatrix);
    toast.success(`Permissions copied from ${ROLES.find(r => r.tier === sourceTier)?.name}`);
    setCopyFromTier('');
  }

  async function saveChanges() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/role-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matrix,
          updatedBy: user?.email || 'admin',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setSavedMatrix(matrix);
      setIsDefault(false);
      toast.success('Permission matrix saved successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  }

  function resetToDefaults() {
    setMatrix(DEFAULT_MATRIX);
    setShowResetConfirm(false);
    toast.success('Matrix reset to defaults — click Save Changes to persist.');
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const selectedRole = ROLES.find(r => r.tier === selectedTier)!;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Icon name="ArrowPathIcon" size={28} className="animate-spin text-blue-600" />
        <span className="ml-3 text-slate-500">Loading permission matrix...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* Header strip */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-900">Roles &amp; Permissions</h2>
          {isDefault ? (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
              Using Defaults
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
              Custom Config
            </span>
          )}
          {isDirty && (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-orange-500 rounded-full inline-block" />
              Unsaved changes
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowResetConfirm(true)}
            className="px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Reset to Defaults
          </button>
          <button
            onClick={saveChanges}
            disabled={!isDirty || saving}
            className="px-4 py-1.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center gap-2"
          >
            {saving && <Icon name="ArrowPathIcon" size={15} className="animate-spin" />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex gap-0 border border-slate-200 rounded-xl overflow-hidden flex-1">

        {/* LEFT: Role list */}
        <div className="w-60 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
          <div className="p-3 border-b border-slate-200">
            <div className="relative">
              <Icon name="MagnifyingGlassIcon" size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search roles…"
                value={roleSearch}
                onChange={e => setRoleSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1 py-1">
            {filteredRoles.map(role => {
              const granted = grantedCount(role.tier);
              const isSelected = selectedTier === role.tier;
              const changed = Object.keys(PERMISSIONS).some(p => hasChanged(p, role.tier));
              return (
                <button
                  key={role.tier}
                  onClick={() => handleRoleSwitch(role.tier)}
                  className={`w-full text-left px-3 py-2.5 transition-colors hover:bg-slate-50 border-b border-slate-100 last:border-0 ${
                    isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${role.bgColor} ${role.color} flex-shrink-0`}>
                        T{role.tier}
                      </span>
                      <span className={`text-sm font-semibold truncate ${isSelected ? 'text-blue-700' : 'text-slate-800'}`}>
                        {role.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {changed && (
                        <span className="w-1.5 h-1.5 bg-orange-400 rounded-full" title="Unsaved changes" />
                      )}
                      {role.tier <= 2 && (
                        <Icon name="LockClosedIcon" size={11} className="text-slate-400" />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-1 pl-7">
                    <span className="text-xs text-slate-500">{granted}/{totalPermissions} permissions</span>
                    {userCounts[role.tier] !== undefined && (
                      <span className="text-xs text-slate-400">{userCounts[role.tier]} user{userCounts[role.tier] !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Permission editor */}
        <div className="flex-1 bg-white overflow-y-auto flex flex-col min-w-0">
          {/* Role header */}
          <div className={`px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3 ${selectedRole.bgColor}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedRole.bgColor} border border-slate-200`}>
                <span className={`text-sm font-bold ${selectedRole.color}`}>T{selectedRole.tier}</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900">{selectedRole.name}</h3>
                  {selectedRole.tier <= 2 && (
                    <span className="px-1.5 py-0.5 text-xs font-semibold bg-purple-100 text-purple-700 rounded border border-purple-200 flex items-center gap-1">
                      <Icon name="LockClosedIcon" size={11} />
                      Protected
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-slate-500">
                    {selectedGrantedPerms.length}/{totalPermissions} permissions granted
                  </span>
                  {userCounts[selectedRole.tier] !== undefined && (
                    <span className="text-xs text-slate-500">
                      {userCounts[selectedRole.tier]} user{userCounts[selectedRole.tier] !== 1 ? 's' : ''} with this role
                    </span>
                  )}
                </div>
              </div>
            </div>
            {/* Copy from role */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Copy from:</span>
              <select
                value={copyFromTier}
                onChange={e => { if (e.target.value) copyPermissionsFrom(parseInt(e.target.value)); setCopyFromTier(''); }}
                className="text-sm border border-slate-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Choose role…</option>
                {ROLES.filter(r => r.tier !== selectedTier).map(r => (
                  <option key={r.tier} value={r.tier}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Permission categories */}
          <div className="p-6 space-y-6">
            {CATEGORIES.map(cat => {
              const permsInCat = Object.entries(PERMISSIONS).filter(([, info]) => info.category === cat.key);
              return (
                <div key={cat.key}>
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${cat.bg} mb-3`}>
                    <Icon name={cat.icon as any} size={16} className={cat.color} />
                    <span className={`text-xs font-bold uppercase tracking-wider ${cat.color}`}>{cat.label}</span>
                    <span className="ml-auto text-xs text-slate-400">
                      {permsInCat.filter(([p]) => (matrix[p] || []).includes(selectedTier)).length}/{permsInCat.length} enabled
                    </span>
                  </div>
                  <div className="space-y-1">
                    {permsInCat.map(([permKey, permInfo]) => {
                      const granted = (matrix[permKey] || []).includes(selectedTier);
                      const protected_ = isProtected(permKey, selectedTier);
                      const changed = hasChanged(permKey, selectedTier);
                      const affectedUsers = userCounts[selectedTier] || 0;
                      return (
                        <div
                          key={permKey}
                          className={`flex items-center gap-4 px-4 py-3 rounded-lg transition-colors ${
                            changed ? 'bg-orange-50 border border-orange-200' :
                            granted ? 'bg-slate-50 hover:bg-slate-100' : 'hover:bg-slate-50'
                          }`}
                        >
                          <Toggle
                            enabled={granted}
                            onChange={() => togglePermission(permKey, selectedTier)}
                            disabled={protected_}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm font-semibold ${granted ? 'text-slate-900' : 'text-slate-500'}`}>
                                {permInfo.label}
                              </span>
                              {protected_ && (
                                <span className="px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded flex items-center gap-1">
                                  <Icon name="LockClosedIcon" size={10} />
                                  Protected
                                </span>
                              )}
                              {permInfo.critical && !protected_ && (
                                <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded flex items-center gap-1">
                                  <Icon name="ExclamationTriangleIcon" size={10} />
                                  Sensitive
                                </span>
                              )}
                              {changed && (
                                <span className="px-1.5 py-0.5 text-xs bg-orange-100 text-orange-700 rounded">
                                  Changed
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">{permInfo.description}</p>
                          </div>
                          {affectedUsers > 0 && (
                            <span className="text-xs text-slate-400 flex-shrink-0">
                              {affectedUsers} user{affectedUsers !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer save row */}
          {isDirty && (
            <div className="sticky bottom-0 border-t border-orange-200 bg-orange-50 px-6 py-3 flex items-center justify-between">
              <span className="text-sm text-orange-700 font-medium flex items-center gap-2">
                <Icon name="ExclamationCircleIcon" size={16} />
                You have unsaved changes to the permission matrix.
              </span>
              <div className="flex items-center gap-2">
                <button onClick={() => setMatrix(savedMatrix)} className="px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-white transition-colors">
                  Discard
                </button>
                <button
                  onClick={saveChanges}
                  disabled={saving}
                  className="px-4 py-1.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <Icon name="ArrowPathIcon" size={14} className="animate-spin" />}
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}

      {/* Unsaved-changes warning when switching role */}
      {showUnsavedWarning && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <Icon name="ExclamationTriangleIcon" size={20} className="text-orange-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Unsaved Changes</h3>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              You have unsaved changes to <strong>{selectedRole.name}</strong>. Do you want to save before switching, or discard?
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowUnsavedWarning(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">
                Keep Editing
              </button>
              <button onClick={confirmSwitchWithoutSaving} className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
                Discard &amp; Switch
              </button>
              <button
                onClick={async () => { await saveChanges(); if (pendingSwitchTier !== null) setSelectedTier(pendingSwitchTier); setPendingSwitchTier(null); setShowUnsavedWarning(false); }}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Save &amp; Switch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset-to-defaults confirm */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Icon name="ArrowUturnLeftIcon" size={20} className="text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Reset to Defaults</h3>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              This will restore the original permission matrix for <strong>all 18 roles</strong>.
              Your custom configuration will be replaced. You will still need to click <em>Save Changes</em> to persist the reset.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowResetConfirm(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={resetToDefaults} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700">
                Reset All Permissions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
