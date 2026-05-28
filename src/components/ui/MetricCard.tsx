import React from 'react';
import Icon from '@/components/ui/AppIcon';

interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: { value: string; direction: 'up' | 'down' | 'neutral'; positive?: boolean };
  icon: string;
  iconColor?: string;
  iconBg?: string;
  variant?: 'default' | 'alert' | 'warning' | 'success' | 'info';
  className?: string;
  children?: React.ReactNode;
}

const VARIANT_STYLES: Record<string, string> = {
  default: 'bg-white border-slate-200',
  alert: 'bg-red-50 border-red-200',
  warning: 'bg-amber-50 border-amber-200',
  success: 'bg-emerald-50 border-emerald-200',
  info: 'bg-blue-50 border-blue-200',
};

export default function MetricCard({
  label,
  value,
  subValue,
  trend,
  icon,
  iconColor = 'text-blue-600',
  iconBg = 'bg-blue-100',
  variant = 'default',
  className = '',
  children,
}: MetricCardProps) {
  const trendColor = trend
    ? trend.positive === false
      ? 'text-red-600'
      : trend.direction === 'up' ?'text-emerald-600'
      : trend.direction === 'down' ?'text-red-600' :'text-slate-500' :'';

  return (
    <div className={`metric-card border rounded-xl p-5 ${VARIANT_STYLES[variant]} ${className}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>
          <Icon name={icon as Parameters<typeof Icon>[0]['name']} size={20} className={iconColor} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-semibold ${trendColor}`}>
            <Icon
              name={trend.direction === 'up' ? 'ArrowUpIcon' : trend.direction === 'down' ? 'ArrowDownIcon' : 'MinusIcon'}
              size={12}
            />
            {trend.value}
          </div>
        )}
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
        <p className="text-2xl font-bold text-slate-900 font-mono-data leading-tight">{value}</p>
        {subValue && <p className="text-xs text-slate-500 mt-1">{subValue}</p>}
      </div>
      {children}
    </div>
  );
}