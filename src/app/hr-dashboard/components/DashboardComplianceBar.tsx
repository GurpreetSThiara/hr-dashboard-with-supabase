'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';

const ALERTS = [
  { id: 'alert-001', type: 'urgent', message: 'Q1 Statutory Filing due in 3 days — Apr 26, 2026', action: 'Review Filing' },
  { id: 'alert-002', type: 'warning', message: '23 employees have not acknowledged the updated IT Security Policy', action: 'Send Reminder' },
];

export default function DashboardComplianceBar() {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const visible = ALERTS.filter((a) => !dismissed.includes(a.id));

  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 mb-5">
      {visible.map((alert) => (
        <div
          key={alert.id}
          className={`compliance-alert ${alert.type} animate-fade-in`}
        >
          <Icon
            name={alert.type === 'urgent' ? 'ExclamationTriangleIcon' : 'InformationCircleIcon'}
            size={16}
            className="flex-shrink-0 mt-0.5"
          />
          <div className="flex-1 min-w-0">
            <span className="font-medium">{alert.message}</span>
          </div>
          <button
            className={`flex-shrink-0 text-xs font-semibold px-3 py-1 rounded-md transition-colors ${
              alert.type === 'urgent' ?'bg-red-200 text-red-800 hover:bg-red-300' :'bg-amber-200 text-amber-800 hover:bg-amber-300'
            }`}
          >
            {alert.action}
          </button>
          <button
            onClick={() => setDismissed((p) => [...p, alert.id])}
            className="flex-shrink-0 ml-1 text-current opacity-50 hover:opacity-100 transition-opacity"
            aria-label="Dismiss alert"
          >
            <Icon name="XMarkIcon" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}