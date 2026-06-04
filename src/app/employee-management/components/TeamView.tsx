'use client';

/**
 * Team view — reporting-hierarchy centric (My Team / Extended Team / Reporting
 * Chain / Insights / Team Directory). Data comes from /api/team which is
 * reporting-scoped and returns public fields only.
 */
import React, { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';

interface Member {
  id: string;
  emp_id: string;
  first_name: string;
  last_name: string;
  email: string;
  designation: string;
  department: string;
  employment_type?: string;
  location?: string;
  status?: string;
  join_date?: string;
  attendance_pct?: number;
}
interface ChainNode {
  id: string; emp_id: string; first_name: string; last_name: string;
  email: string; designation: string; department: string; depth: number; relation: string;
}
interface Insights {
  teamSize: number; directCount: number; avgAttendance: number; onLeaveToday: number;
  pendingLeaveApprovals: number; pendingRegularizations: number;
  anniversariesThisMonth: (Member & { years: number })[];
}
interface TeamData {
  me: Member | null;
  directReports: Member[];
  extendedTeam: Member[];
  reportingChain: ChainNode[];
  insights: Insights;
}

const AVATAR_COLORS = [
  'bg-blue-600','bg-violet-600','bg-emerald-600','bg-amber-600','bg-pink-600',
  'bg-indigo-600','bg-teal-600','bg-rose-600','bg-cyan-600','bg-orange-600',
];
function avatarColor(s: string) {
  let h = 0; for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function MemberCard({ m }: { m: Member }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${avatarColor(m.emp_id)}`}>
        {m.first_name[0]}{m.last_name[0]}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800 truncate">{m.first_name} {m.last_name}</p>
        <p className="text-xs text-slate-500 truncate">{m.designation}</p>
        <p className="text-[11px] text-slate-400 truncate">{m.department}{m.location ? ` · ${m.location}` : ''}</p>
      </div>
      {m.status && <StatusBadge status={m.status as any} />}
    </div>
  );
}

export default function TeamView() {
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Team directory filters
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('All');
  const [loc, setLoc] = useState('All');
  const [status, setStatus] = useState('All');

  useEffect(() => {
    fetch('/api/team')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to load team'))))
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const allTeam = useMemo(
    () => (data ? [...data.directReports, ...data.extendedTeam] : []),
    [data]
  );

  const departments = useMemo(
    () => ['All', ...Array.from(new Set(allTeam.map((m) => m.department).filter(Boolean)))],
    [allTeam]
  );
  const locations = useMemo(
    () => ['All', ...Array.from(new Set(allTeam.map((m) => m.location).filter(Boolean) as string[]))],
    [allTeam]
  );

  const filteredDirectory = useMemo(() => {
    return allTeam.filter((m) => {
      const name = `${m.first_name} ${m.last_name}`.toLowerCase();
      const matchQ = !q || name.includes(q.toLowerCase()) || m.emp_id.toLowerCase().includes(q.toLowerCase()) || m.email.toLowerCase().includes(q.toLowerCase());
      const matchD = dept === 'All' || m.department === dept;
      const matchL = loc === 'All' || m.location === loc;
      const matchS = status === 'All' || m.status === status.toLowerCase();
      return matchQ && matchD && matchL && matchS;
    });
  }, [allTeam, q, dept, loc, status]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
        <Icon name="ArrowPathIcon" size={24} className="animate-spin mx-auto text-blue-600 mb-2" />
        <p className="text-sm text-slate-500">Loading your team…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-6 text-center text-red-600 text-sm">{error}</div>
    );
  }
  if (!data) return null;

  const ins = data.insights;
  const insightCards = [
    { label: 'Team Size', value: ins.teamSize, sub: `${ins.directCount} direct`, icon: 'UsersIcon', color: 'text-blue-600 bg-blue-50' },
    { label: 'Avg Attendance', value: `${ins.avgAttendance}%`, sub: 'team average', icon: 'CheckCircleIcon', color: 'text-emerald-600 bg-emerald-50' },
    { label: 'On Leave Today', value: ins.onLeaveToday, sub: 'team members', icon: 'CalendarDaysIcon', color: 'text-amber-600 bg-amber-50' },
    { label: 'Pending Leave', value: ins.pendingLeaveApprovals, sub: 'awaiting approval', icon: 'ClockIcon', color: 'text-orange-600 bg-orange-50' },
    { label: 'Pending Regularizations', value: ins.pendingRegularizations, sub: 'awaiting approval', icon: 'DocumentTextIcon', color: 'text-violet-600 bg-violet-50' },
  ];

  const noTeam = data.directReports.length === 0 && data.extendedTeam.length === 0;

  return (
    <div className="space-y-6">
      {/* Insights */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {insightCards.map((c) => (
          <div key={c.label} className="bg-white border border-slate-200 rounded-xl p-4">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${c.color}`}>
              <Icon name={c.icon as any} size={18} />
            </div>
            <p className="text-2xl font-bold text-slate-900">{c.value}</p>
            <p className="text-xs font-semibold text-slate-600">{c.label}</p>
            <p className="text-[11px] text-slate-400">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: My Team + Extended */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Icon name="UserGroupIcon" size={16} className="text-blue-600" /> My Team — Direct Reports
            </h3>
            {data.directReports.length === 0 ? (
              <EmptyState icon="UsersIcon" title="No direct reports" description="You don't have anyone reporting directly to you." />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.directReports.map((m) => <MemberCard key={m.id} m={m} />)}
              </div>
            )}
          </div>

          {data.extendedTeam.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Icon name="UsersIcon" size={16} className="text-violet-600" /> Extended Team — Indirect Reports ({data.extendedTeam.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.extendedTeam.map((m) => <MemberCard key={m.id} m={m} />)}
              </div>
            </div>
          )}

          {/* Team Directory (search/filter) */}
          {!noTeam && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Icon name="MagnifyingGlassIcon" size={16} className="text-slate-500" /> Team Directory
              </h3>
              <div className="flex flex-wrap gap-2 mb-4">
                <input
                  value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder="Search name, ID, email…"
                  className="flex-1 min-w-[180px] text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select value={dept} onChange={(e) => setDept(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-2">
                  {departments.map((d) => <option key={d} value={d}>{d === 'All' ? 'All depts' : d}</option>)}
                </select>
                <select value={loc} onChange={(e) => setLoc(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-2">
                  {locations.map((l) => <option key={l} value={l}>{l === 'All' ? 'All locations' : l}</option>)}
                </select>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-2">
                  {['All', 'Active', 'Onleave', 'Onboarding', 'Terminated'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {filteredDirectory.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No team members match your filters</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredDirectory.map((m) => <MemberCard key={m.id} m={m} />)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Reporting Chain + Anniversaries */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Icon name="ArrowTrendingUpIcon" size={16} className="text-indigo-600" /> Reporting Chain
            </h3>
            {data.me && (
              <div className="flex items-center gap-3 p-2.5 bg-blue-50 border border-blue-100 rounded-lg mb-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold ${avatarColor(data.me.emp_id)}`}>
                  {data.me.first_name[0]}{data.me.last_name[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{data.me.first_name} {data.me.last_name} (You)</p>
                  <p className="text-[11px] text-slate-500 truncate">{data.me.designation}</p>
                </div>
              </div>
            )}
            {data.reportingChain.length === 0 ? (
              <p className="text-xs text-slate-400">You are at the top of the reporting structure.</p>
            ) : (
              <div className="space-y-2">
                {data.reportingChain.map((n) => (
                  <div key={n.id} className="flex items-center gap-3 pl-3 border-l-2 border-slate-100">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold ${avatarColor(n.emp_id)}`}>
                      {n.first_name[0]}{n.last_name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{n.first_name} {n.last_name}</p>
                      <p className="text-[11px] text-slate-500 truncate">{n.designation}</p>
                      <span className="text-[10px] font-semibold text-indigo-600">{n.relation}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {ins.anniversariesThisMonth.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Icon name="SparklesIcon" size={16} className="text-amber-500" /> Work Anniversaries This Month
              </h3>
              <div className="space-y-2">
                {ins.anniversariesThisMonth.map((m) => (
                  <div key={m.id} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold ${avatarColor(m.emp_id)}`}>
                      {m.first_name[0]}{m.last_name[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800 truncate">{m.first_name} {m.last_name}</p>
                      <p className="text-[11px] text-slate-400">
                        {m.join_date ? new Date(m.join_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
                      </p>
                    </div>
                    {m.years > 0 && (
                      <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                        {m.years} yr{m.years > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
