import React from 'react';

type StatusType =
  | 'active' |'onleave' |'onboarding' |'terminated' |'pending' |'approved' |'rejected' |'contractor' |'intern' |'processing' |'draft' |'disbursed' |'published' |'closed';

const STATUS_CONFIG: Record<StatusType, { label: string; className: string }> = {
  active: { label: 'Active', className: 'status-badge status-active' },
  onleave: { label: 'On Leave', className: 'status-badge status-onleave' },
  onboarding: { label: 'Onboarding', className: 'status-badge status-onboarding' },
  terminated: { label: 'Terminated', className: 'status-badge status-terminated' },
  pending: { label: 'Pending', className: 'status-badge status-pending' },
  approved: { label: 'Approved', className: 'status-badge status-approved' },
  rejected: { label: 'Rejected', className: 'status-badge status-rejected' },
  contractor: { label: 'Contractor', className: 'status-badge status-contractor' },
  intern: { label: 'Intern', className: 'status-badge status-intern' },
  processing: { label: 'Processing', className: 'status-badge bg-blue-50 text-blue-700 border border-blue-200' },
  draft: { label: 'Draft', className: 'status-badge bg-slate-100 text-slate-600 border border-slate-200' },
  disbursed: { label: 'Disbursed', className: 'status-badge status-approved' },
  published: { label: 'Published', className: 'status-badge status-active' },
  closed: { label: 'Closed', className: 'status-badge bg-slate-100 text-slate-500 border border-slate-200' },
};

interface StatusBadgeProps {
  status: StatusType;
  customLabel?: string;
}

export default function StatusBadge({ status, customLabel }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: 'status-badge bg-slate-100 text-slate-600 border border-slate-200' };
  return (
    <span className={config.className}>
      {customLabel ?? config.label}
    </span>
  );
}