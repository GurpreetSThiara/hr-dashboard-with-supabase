'use client';

/** Employee self-service: view + edit your own contact details (F: profile). */
import React, { useEffect, useState } from 'react';

interface Profile {
  first_name: string; last_name: string; email: string; designation: string; department: string;
  phone: string | null; address: string | null; emergency_contact: string | null; bio: string | null; date_of_birth: string | null;
}

const input = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';

export default function ProfileCard() {
  const [p, setP] = useState<Profile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/me/profile').then(r => r.ok ? r.json() : null).then(d => { setP(d); setLoaded(true); }).catch(() => setLoaded(true));
  }, []);

  if (!loaded || !p) return null; // no linked employee record → hide

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setSaved(false);
    try {
      const res = await fetch('/api/me/profile', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: p!.phone, address: p!.address, emergency_contact: p!.emergency_contact, bio: p!.bio, date_of_birth: p!.date_of_birth }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Save failed');
      setSaved(true);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  const set = (k: keyof Profile, v: string) => setP(prev => ({ ...prev!, [k]: v }));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">My Profile</h3>
          <p className="text-xs text-slate-400">{p.designation} · {p.department}</p>
        </div>
        {saved && <span className="text-sm text-emerald-600">Saved</span>}
      </div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm"><span className="mb-1 block font-medium text-slate-600">Phone</span><input className={input} value={p.phone ?? ''} onChange={e => set('phone', e.target.value)} /></label>
        <label className="text-sm"><span className="mb-1 block font-medium text-slate-600">Date of birth</span><input type="date" className={input} value={p.date_of_birth ? p.date_of_birth.slice(0, 10) : ''} onChange={e => set('date_of_birth', e.target.value)} /></label>
        <label className="text-sm sm:col-span-2"><span className="mb-1 block font-medium text-slate-600">Address</span><input className={input} value={p.address ?? ''} onChange={e => set('address', e.target.value)} /></label>
        <label className="text-sm sm:col-span-2"><span className="mb-1 block font-medium text-slate-600">Emergency contact</span><input className={input} value={p.emergency_contact ?? ''} onChange={e => set('emergency_contact', e.target.value)} /></label>
        <label className="text-sm sm:col-span-2"><span className="mb-1 block font-medium text-slate-600">Bio</span><textarea className={input} rows={2} value={p.bio ?? ''} onChange={e => set('bio', e.target.value)} /></label>
        <div className="sm:col-span-2">
          <button type="submit" disabled={busy} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{busy ? 'Saving…' : 'Save profile'}</button>
        </div>
      </form>
    </div>
  );
}
