'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';

interface Settings {
  max_past_days_regularization: number;
  checkin_checkout_allowed_tiers: number[];
  enable_checkin_checkout: boolean;
  enable_regularizations: boolean;
  updated_by?: string;
  updated_at?: string;
}

const ROLES = [
  { name: 'Super Admin',   tier: 1,  color: 'text-purple-750 bg-purple-100 border-purple-200' },
  { name: 'Owner',         tier: 2,  color: 'text-purple-700 bg-purple-50 border-purple-150' },
  { name: 'Admin',         tier: 3,  color: 'text-blue-750 bg-blue-100 border-blue-200' },
  { name: 'HR Admin',      tier: 4,  color: 'text-blue-700 bg-blue-50 border-blue-150' },
  { name: 'HR Manager',    tier: 5,  color: 'text-blue-600 bg-blue-50 border-blue-100' },
  { name: 'HR Executive',  tier: 6,  color: 'text-cyan-750 bg-cyan-100 border-cyan-200' },
  { name: 'Recruiter',     tier: 7,  color: 'text-cyan-700 bg-cyan-50 border-cyan-150' },
  { name: 'Payroll Manager', tier: 8, color: 'text-emerald-750 bg-emerald-100 border-emerald-200' },
  { name: 'Finance',       tier: 9,  color: 'text-emerald-750 bg-emerald-50 border-emerald-100' },
  { name: 'Compliance',    tier: 10, color: 'text-teal-750 bg-teal-100 border-teal-200' },
  { name: 'IT Ops',        tier: 11, color: 'text-teal-700 bg-teal-50 border-teal-150' },
  { name: 'Director',      tier: 12, color: 'text-amber-750 bg-amber-100 border-amber-200' },
  { name: 'Manager',       tier: 13, color: 'text-amber-700 bg-amber-50 border-amber-150' },
  { name: 'Team Lead',     tier: 14, color: 'text-orange-700 bg-orange-50 border-orange-100' },
  { name: 'Employee',      tier: 15, color: 'text-slate-700 bg-slate-100 border-slate-200' },
  { name: 'Contractor',    tier: 16, color: 'text-slate-600 bg-slate-50 border-slate-150' },
  { name: 'Intern',        tier: 17, color: 'text-slate-500 bg-slate-50 border-slate-100' },
  { name: 'Read-Only User',tier: 18, color: 'text-slate-400 bg-slate-50 border-slate-100' }
];

export default function AttendanceSettingsTab() {
  const [settings, setSettings] = useState<Settings>({
    max_past_days_regularization: 30,
    checkin_checkout_allowed_tiers: Array.from({ length: 18 }, (_, i) => i + 1),
    enable_checkin_checkout: true,
    enable_regularizations: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      setLoading(true);
      const res = await fetch('/api/attendance/settings');
      if (!res.ok) throw new Error('Failed to load settings');
      const data = await res.json();
      setSettings({
        max_past_days_regularization: Number(data.max_past_days_regularization) || 30,
        checkin_checkout_allowed_tiers: Array.isArray(data.checkin_checkout_allowed_tiers) 
          ? data.checkin_checkout_allowed_tiers.map(Number)
          : Array.from({ length: 18 }, (_, i) => i + 1),
        enable_checkin_checkout: data.enable_checkin_checkout !== false,
        enable_regularizations: data.enable_regularizations !== false,
        updated_by: data.updated_by,
        updated_at: data.updated_at
      });
    } catch (error) {
      toast.error('Failed to load attendance settings');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await fetch('/api/attendance/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save settings');
      }

      toast.success('Attendance settings saved successfully!');
      fetchSettings();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  function handleTierToggle(tier: number) {
    setSettings((prev) => {
      const allowed = [...prev.checkin_checkout_allowed_tiers];
      if (allowed.includes(tier)) {
        return {
          ...prev,
          checkin_checkout_allowed_tiers: allowed.filter((t) => t !== tier),
        };
      } else {
        return {
          ...prev,
          checkin_checkout_allowed_tiers: [...allowed, tier].sort((a, b) => a - b),
        };
      }
    });
  }

  function handleSelectAllTiers() {
    setSettings((prev) => ({
      ...prev,
      checkin_checkout_allowed_tiers: Array.from({ length: 18 }, (_, i) => i + 1),
    }));
  }

  function handleClearAllTiers() {
    setSettings((prev) => ({
      ...prev,
      checkin_checkout_allowed_tiers: [],
    }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Icon name="ArrowPathIcon" size={28} className="animate-spin text-blue-600" />
        <span className="ml-3 text-slate-500">Loading attendance settings...</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="bg-white rounded-xl border border-slate-200 shadow-sm max-w-4xl">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Icon name="ClockIcon" size={18} className="text-blue-600" />
          Attendance Policy Settings
        </h2>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-1.5 shadow"
        >
          {saving && <Icon name="ArrowPathIcon" size={14} className="animate-spin" />}
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      <div className="p-6 space-y-6 divide-y divide-slate-100">
        
        {/* Section 1: Module Toggles */}
        <div className="pb-6">
          <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wide mb-4">Module Enable / Disable</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="flex items-start gap-4 p-4 border border-slate-100 rounded-xl bg-slate-50/50">
              <button
                type="button"
                onClick={() => setSettings(prev => ({ ...prev, enable_checkin_checkout: !prev.enable_checkin_checkout }))}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                  settings.enable_checkin_checkout ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.enable_checkin_checkout ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
              <div>
                <label className="block text-sm font-bold text-slate-800">Check-in / Check-out Tracker</label>
                <span className="text-xs text-slate-400">Allows employees to track work hours on their dashboards.</span>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 border border-slate-100 rounded-xl bg-slate-50/50">
              <button
                type="button"
                onClick={() => setSettings(prev => ({ ...prev, enable_regularizations: !prev.enable_regularizations }))}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                  settings.enable_regularizations ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.enable_regularizations ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
              <div>
                <label className="block text-sm font-bold text-slate-800">Attendance Regularization Requests</label>
                <span className="text-xs text-slate-400">Allows employees to submit check-in corrections for approval.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Time boundaries */}
        <div className="py-6">
          <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wide mb-4">Time Boundaries</h3>
          
          <div className="max-w-md">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Max past days for regularization *
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={365}
                required
                value={settings.max_past_days_regularization}
                onChange={e => setSettings(prev => ({ ...prev, max_past_days_regularization: Math.max(1, Number(e.target.value)) }))}
                className="input-field w-32"
              />
              <span className="text-sm text-slate-500 font-medium">days</span>
            </div>
            <p className="text-xs text-slate-450 mt-1.5 leading-normal">
              Employees will be blocked from requesting corrections for dates older than this limit.
            </p>
          </div>
        </div>

        {/* Section 3: Allowed Roles Checklist */}
        <div className="py-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wide">Check-In / Out Role Permissions</h3>
              <p className="text-xs text-slate-450 mt-0.5">Restrict who is permitted to log work hours in the system.</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSelectAllTiers}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
              >
                Select All
              </button>
              <span className="text-slate-350 text-xs">|</span>
              <button
                type="button"
                onClick={handleClearAllTiers}
                className="text-xs font-semibold text-red-650 hover:text-red-800 transition"
              >
                Clear All
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {ROLES.map((role) => {
              const isAllowed = settings.checkin_checkout_allowed_tiers.includes(role.tier);
              return (
                <div
                  key={role.tier}
                  onClick={() => handleTierToggle(role.tier)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition cursor-pointer hover:border-slate-300 ${
                    isAllowed 
                      ? 'bg-blue-50/20 border-blue-500/30' 
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isAllowed}
                    onChange={() => {}} // Handled by div onClick
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-bold text-slate-800 block truncate leading-tight">
                      {role.name}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-450">
                      Tier {role.tier}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 4: Log context */}
        {(settings.updated_by || settings.updated_at) && (
          <div className="py-4 bg-slate-50/50 rounded-b-xl border-t border-slate-100 px-6 flex items-center justify-between text-xs text-slate-450">
            <span>
              Last updated by: <strong>{settings.updated_by || 'system'}</strong>
            </span>
            <span>
              {settings.updated_at ? new Date(settings.updated_at).toLocaleString() : ''}
            </span>
          </div>
        )}

      </div>
    </form>
  );
}
