'use client';

import React, { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface HeadcountPoint { week: string; headcount: number; joiners: number; }

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-dropdown p-3 text-xs">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={`tooltip-row-${i}`} className="flex items-center justify-between gap-4">
          <span className="text-slate-500 capitalize">{p.name}</span>
          <span className="font-bold text-slate-900 font-mono-data">{p.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

export default function HeadcountTrendChart() {
  const [range, setRange] = useState<'12w' | '6w'>('12w');
  const [allData, setAllData] = useState<HeadcountPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics/headcount-trend?weeks=12')
      .then((r) => (r.ok ? r.json() : { points: [] }))
      .then((d) => setAllData(d.points || []))
      .catch(() => setAllData([]))
      .finally(() => setLoading(false));
  }, []);

  const data = range === '6w' ? allData.slice(6) : allData;
  const rangeNet = data.length > 0 ? data[data.length - 1].headcount - data[0].headcount : 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Headcount Trend</h3>
          <p className="text-xs text-slate-500 mt-0.5">Weekly employee count over the last {range === '12w' ? '12' : '6'} weeks</p>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          {(['6w', '12w'] as const).map((r) => (
            <button
              key={`range-${r}`}
              onClick={() => setRange(r)}
              className={`text-xs font-semibold px-3 py-1 rounded-md transition-all ${range === r ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="h-[200px] flex items-center justify-center text-xs text-slate-400">Loading…</div>
      ) : data.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-xs text-slate-400">No headcount data</div>
      ) : (
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="headcountGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="week"
            tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'DM Sans' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'DM Sans' }}
            axisLine={false}
            tickLine={false}
            domain={['dataMin - 20', 'dataMax + 20']}
            tickFormatter={(v) => v.toLocaleString()}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="headcount"
            stroke="#1d4ed8"
            strokeWidth={2}
            fill="url(#headcountGrad)"
            dot={false}
            activeDot={{ r: 4, fill: '#1d4ed8', stroke: '#fff', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
      )}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-700" />
          <span className="text-xs text-slate-500">Headcount</span>
        </div>
        <div className="text-xs text-slate-400">
          Net change this period:{' '}
          <span className={`font-semibold ${rangeNet >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {rangeNet >= 0 ? '+' : ''}{rangeNet} employee{Math.abs(rangeNet) === 1 ? '' : 's'}
          </span>
        </div>
      </div>
    </div>
  );
}