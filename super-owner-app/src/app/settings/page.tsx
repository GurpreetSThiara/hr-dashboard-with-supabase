'use client';

import React, { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api } from '@/lib/api';
import { Card, Button, PageHeader, Loading, ErrorBanner, Field, inputClass } from '@/components/ui';

interface Settings { signups_enabled: boolean; default_plan_code: string | null; support_email: string | null; }
interface Plan { id: string; code: string; name: string; }

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api<Settings>('/api/settings'), api<{ data: Plan[] }>('/api/plans')])
      .then(([s, p]) => { setSettings(s); setPlans(p.data); })
      .catch(e => setError(e.message));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setBusy(true); setError(null); setSaved(false);
    try {
      const updated = await api<Settings>('/api/settings', { method: 'PUT', body: JSON.stringify(settings) });
      setSettings(updated); setSaved(true);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <Shell>
      <PageHeader title="Platform Settings" subtitle="Global controls that affect every organization." />
      <ErrorBanner message={error} />

      {!settings ? <Loading /> : (
        <Card className="max-w-xl p-6">
          <form onSubmit={save} className="space-y-5">
            <label className="flex items-center justify-between gap-4">
              <span>
                <span className="block text-sm font-medium text-slate-700">Allow new sign-ups</span>
                <span className="block text-xs text-slate-400">When off, the HR app blocks new registrations.</span>
              </span>
              <input type="checkbox" checked={settings.signups_enabled}
                onChange={e => setSettings(s => ({ ...s!, signups_enabled: e.target.checked }))}
                className="h-5 w-5 rounded border-slate-300 text-brand-600" />
            </label>

            <Field label="Default plan for new organizations">
              <select className={inputClass} value={settings.default_plan_code ?? ''}
                onChange={e => setSettings(s => ({ ...s!, default_plan_code: e.target.value || null }))}>
                <option value="">None</option>
                {plans.map(p => <option key={p.id} value={p.code}>{p.name}</option>)}
              </select>
            </Field>

            <Field label="Support email">
              <input className={inputClass} value={settings.support_email ?? ''}
                onChange={e => setSettings(s => ({ ...s!, support_email: e.target.value }))} placeholder="support@platform.io" />
            </Field>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</Button>
              {saved && <span className="text-sm text-emerald-600">Saved.</span>}
            </div>
          </form>
        </Card>
      )}
    </Shell>
  );
}
