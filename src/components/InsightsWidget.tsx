'use client';

/** Derived HR widgets: birthdays, work anniversaries, who's on leave today,
 * upcoming events, and my open to-dos. Reads /api/me/insights (org-scoped). */
import React, { useEffect, useState } from 'react';

interface Insights {
  birthdays: { first_name: string; last_name: string; date_of_birth: string }[];
  anniversaries: { first_name: string; last_name: string; years: number }[];
  onLeaveToday: { employee_name: string; leave_type: string; end_date: string }[];
  myOpenTodos: number;
  upcomingEvents: { title: string; event_date: string; location: string | null }[];
}

function Tile({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold text-slate-900">{title}</h3>
      {children}
    </div>
  );
}

export default function InsightsWidget() {
  const [d, setD] = useState<Insights | null>(null);
  useEffect(() => { fetch('/api/me/insights').then(r => r.ok ? r.json() : null).then(setD).catch(() => {}); }, []);
  if (!d) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Tile title="🎂 Birthdays this month">
        {d.birthdays.length ? <ul className="space-y-1 text-sm text-slate-600">{d.birthdays.map((b, i) => <li key={i}>{b.first_name} {b.last_name}</li>)}</ul> : <p className="text-sm text-slate-400">None</p>}
      </Tile>
      <Tile title="🎉 Work anniversaries">
        {d.anniversaries.length ? <ul className="space-y-1 text-sm text-slate-600">{d.anniversaries.map((a, i) => <li key={i}>{a.first_name} {a.last_name} · {a.years}y</li>)}</ul> : <p className="text-sm text-slate-400">None</p>}
      </Tile>
      <Tile title="🌴 On leave today">
        {d.onLeaveToday.length ? <ul className="space-y-1 text-sm text-slate-600">{d.onLeaveToday.map((l, i) => <li key={i}>{l.employee_name} <span className="text-slate-400">({l.leave_type})</span></li>)}</ul> : <p className="text-sm text-slate-400">Everyone's in</p>}
      </Tile>
      <Tile title="📅 Upcoming events">
        {d.upcomingEvents.length ? <ul className="space-y-1 text-sm text-slate-600">{d.upcomingEvents.map((e, i) => <li key={i}>{e.title} <span className="text-slate-400">{new Date(e.event_date).toLocaleDateString()}</span></li>)}</ul> : <p className="text-sm text-slate-400">Nothing scheduled</p>}
        {d.myOpenTodos > 0 && <p className="mt-2 text-xs font-medium text-brand-600">You have {d.myOpenTodos} open to-do{d.myOpenTodos === 1 ? '' : 's'}</p>}
      </Tile>
    </div>
  );
}
