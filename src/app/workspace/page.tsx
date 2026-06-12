'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import CrudPanel, { FieldDef, DisplayCol } from '@/components/workspace/CrudPanel';

interface Feature { key: string; entity: string; label: string; group: string; title: string; description: string; fields: FieldDef[]; display: DisplayCol[]; toggleField?: string; }

const STATUS = (opts: string[]) => ({ type: 'select' as const, options: opts });

const FEATURES: Feature[] = [
  { key: 'announcements', entity: 'announcements', label: 'Announcements', group: 'Communication', title: 'Company Announcements', description: 'Internal posts for everyone in your organization.',
    fields: [{ name: 'title', label: 'Title', required: true }, { name: 'body', label: 'Message', type: 'textarea' }, { name: 'pinned', label: 'Pinned', type: 'checkbox' }],
    display: [{ name: 'title', label: 'Title' }, { name: 'pinned', label: 'Pinned', kind: 'bool' }, { name: 'author_email', label: 'Author' }, { name: 'created_at', label: 'Posted', kind: 'date' }] },
  { key: 'recognition', entity: 'recognition', label: 'Recognition', group: 'Communication', title: 'Kudos & Recognition', description: 'Celebrate teammates with public shout-outs.',
    fields: [{ name: 'to_employee_id', label: 'To (employee id)' }, { name: 'message', label: 'Message', type: 'textarea', required: true }, { name: 'badge', label: 'Badge', ...STATUS(['Team Player', 'Above & Beyond', 'Innovation', 'Customer Hero']) }],
    display: [{ name: 'message', label: 'Message' }, { name: 'badge', label: 'Badge', kind: 'badge' }, { name: 'from_email', label: 'From' }, { name: 'created_at', label: 'When', kind: 'date' }] },
  { key: 'events', entity: 'events', label: 'Events', group: 'Communication', title: 'Company Events', description: 'Upcoming events and important dates.',
    fields: [{ name: 'title', label: 'Title', required: true }, { name: 'event_date', label: 'Date', type: 'date' }, { name: 'location', label: 'Location' }, { name: 'description', label: 'Details', type: 'textarea' }],
    display: [{ name: 'title', label: 'Title' }, { name: 'event_date', label: 'Date', kind: 'date' }, { name: 'location', label: 'Location' }] },
  { key: 'surveys', entity: 'surveys', label: 'Surveys', group: 'Communication', title: 'Surveys & Polls', description: 'Gather feedback. Options are comma-separated.',
    fields: [{ name: 'title', label: 'Question', required: true }, { name: 'options', label: 'Options', type: 'csv' }, { name: 'is_open', label: 'Open', type: 'checkbox' }],
    display: [{ name: 'title', label: 'Question' }, { name: 'options', label: 'Options' }, { name: 'is_open', label: 'Open', kind: 'bool' }] },
  { key: 'tickets', entity: 'tickets', label: 'Helpdesk', group: 'Support', title: 'HR Helpdesk', description: 'Raise and track HR requests.',
    fields: [{ name: 'subject', label: 'Subject', required: true }, { name: 'body', label: 'Details', type: 'textarea' }, { name: 'category', label: 'Category', ...STATUS(['Payroll', 'Benefits', 'IT', 'Facilities', 'Other']) }, { name: 'priority', label: 'Priority', ...STATUS(['low', 'normal', 'high', 'urgent']) }, { name: 'status', label: 'Status', ...STATUS(['open', 'in_progress', 'resolved', 'closed']) }],
    display: [{ name: 'subject', label: 'Subject' }, { name: 'category', label: 'Category', kind: 'badge' }, { name: 'priority', label: 'Priority', kind: 'badge' }, { name: 'status', label: 'Status', kind: 'badge' }] },
  { key: 'notifications', entity: 'notifications', label: 'Notifications', group: 'Support', title: 'Notifications', description: 'Send/track in-app notifications.', toggleField: 'is_read',
    fields: [{ name: 'user_email', label: 'To (email)', required: true }, { name: 'title', label: 'Title', required: true }, { name: 'body', label: 'Body', type: 'textarea' }],
    display: [{ name: 'title', label: 'Title' }, { name: 'user_email', label: 'Recipient' }, { name: 'is_read', label: 'Read', kind: 'bool' }, { name: 'created_at', label: 'When', kind: 'date' }] },
  { key: 'todos', entity: 'todos', label: 'My To-dos', group: 'Support', title: 'My To-dos', description: 'Your personal task list.', toggleField: 'is_done',
    fields: [{ name: 'title', label: 'Task', required: true }, { name: 'due_date', label: 'Due', type: 'date' }],
    display: [{ name: 'title', label: 'Task' }, { name: 'due_date', label: 'Due', kind: 'date' }, { name: 'is_done', label: 'Done', kind: 'bool' }] },
  { key: 'documents', entity: 'documents', label: 'Documents', group: 'Records', title: 'Employee Documents', description: 'Track document metadata and links.',
    fields: [{ name: 'name', label: 'Name', required: true }, { name: 'category', label: 'Category', ...STATUS(['Contract', 'ID', 'Certificate', 'Policy', 'Other']) }, { name: 'url', label: 'Link (URL)' }, { name: 'employee_id', label: 'Employee id' }],
    display: [{ name: 'name', label: 'Name' }, { name: 'category', label: 'Category', kind: 'badge' }, { name: 'created_at', label: 'Added', kind: 'date' }] },
  { key: 'assets', entity: 'assets', label: 'Assets', group: 'Records', title: 'Asset Management', description: 'Company assets and assignments.',
    fields: [{ name: 'name', label: 'Asset', required: true }, { name: 'tag', label: 'Tag' }, { name: 'category', label: 'Category', ...STATUS(['Laptop', 'Phone', 'Monitor', 'Other']) }, { name: 'status', label: 'Status', ...STATUS(['available', 'assigned', 'retired']) }, { name: 'assigned_to_employee_id', label: 'Assigned to (id)' }],
    display: [{ name: 'name', label: 'Asset' }, { name: 'tag', label: 'Tag' }, { name: 'category', label: 'Category', kind: 'badge' }, { name: 'status', label: 'Status', kind: 'badge' }] },
  { key: 'expenses', entity: 'expenses', label: 'Expenses', group: 'Records', title: 'Expense Claims', description: 'Submit and track reimbursements.',
    fields: [{ name: 'title', label: 'Title', required: true }, { name: 'amount', label: 'Amount', type: 'number' }, { name: 'currency', label: 'Currency' }, { name: 'category', label: 'Category', ...STATUS(['Travel', 'Meals', 'Software', 'Equipment', 'Other']) }, { name: 'status', label: 'Status', ...STATUS(['pending', 'approved', 'rejected', 'reimbursed']) }, { name: 'notes', label: 'Notes', type: 'textarea' }],
    display: [{ name: 'title', label: 'Title' }, { name: 'amount', label: 'Amount' }, { name: 'currency', label: 'Cur' }, { name: 'status', label: 'Status', kind: 'badge' }] },
  { key: 'goals', entity: 'goals', label: 'Goals', group: 'Performance', title: 'Performance Goals', description: 'Set and track goals.',
    fields: [{ name: 'employee_id', label: 'Employee id' }, { name: 'title', label: 'Goal', required: true }, { name: 'description', label: 'Description', type: 'textarea' }, { name: 'progress', label: 'Progress %', type: 'number' }, { name: 'status', label: 'Status', ...STATUS(['active', 'on_track', 'at_risk', 'done']) }, { name: 'due_date', label: 'Due', type: 'date' }],
    display: [{ name: 'title', label: 'Goal' }, { name: 'progress', label: 'Progress' }, { name: 'status', label: 'Status', kind: 'badge' }, { name: 'due_date', label: 'Due', kind: 'date' }] },
  { key: 'training', entity: 'training', label: 'Training', group: 'Performance', title: 'Training & Certifications', description: 'Courses and certifications.',
    fields: [{ name: 'employee_id', label: 'Employee id' }, { name: 'course', label: 'Course', required: true }, { name: 'provider', label: 'Provider' }, { name: 'completed_on', label: 'Completed', type: 'date' }, { name: 'expires_on', label: 'Expires', type: 'date' }, { name: 'status', label: 'Status', ...STATUS(['in_progress', 'completed', 'expired']) }],
    display: [{ name: 'course', label: 'Course' }, { name: 'provider', label: 'Provider' }, { name: 'status', label: 'Status', kind: 'badge' }, { name: 'expires_on', label: 'Expires', kind: 'date' }] },
  { key: 'onboarding', entity: 'onboarding', label: 'Onboarding', group: 'Lifecycle', title: 'Onboarding Checklist', description: 'New-hire onboarding tasks.', toggleField: 'is_done',
    fields: [{ name: 'employee_id', label: 'Employee id' }, { name: 'title', label: 'Task', required: true }, { name: 'due_date', label: 'Due', type: 'date' }],
    display: [{ name: 'title', label: 'Task' }, { name: 'due_date', label: 'Due', kind: 'date' }, { name: 'is_done', label: 'Done', kind: 'bool' }] },
  { key: 'skills', entity: 'skills', label: 'Skills', group: 'Lifecycle', title: 'Skills Directory', description: 'Employee skills and levels.',
    fields: [{ name: 'employee_id', label: 'Employee id' }, { name: 'skill', label: 'Skill', required: true }, { name: 'level', label: 'Level', ...STATUS(['Beginner', 'Intermediate', 'Advanced', 'Expert']) }],
    display: [{ name: 'skill', label: 'Skill' }, { name: 'level', label: 'Level', kind: 'badge' }, { name: 'employee_id', label: 'Employee' }] },
  { key: 'exits', entity: 'exits', label: 'Offboarding', group: 'Lifecycle', title: 'Exit / Offboarding', description: 'Initiate and track exits.',
    fields: [{ name: 'employee_id', label: 'Employee id' }, { name: 'reason', label: 'Reason', type: 'textarea' }, { name: 'last_working_day', label: 'Last day', type: 'date' }, { name: 'status', label: 'Status', ...STATUS(['initiated', 'in_progress', 'completed']) }],
    display: [{ name: 'employee_id', label: 'Employee' }, { name: 'last_working_day', label: 'Last day', kind: 'date' }, { name: 'status', label: 'Status', kind: 'badge' }] },

  // ── HR v2 ───────────────────────────────────────────────────────────────────
  { key: 'departments', entity: 'departments', label: 'Departments', group: 'Org Structure', title: 'Departments', description: 'Departments and their heads.',
    fields: [{ name: 'name', label: 'Name', required: true }, { name: 'head_email', label: 'Head email' }, { name: 'description', label: 'Description', type: 'textarea' }],
    display: [{ name: 'name', label: 'Name' }, { name: 'head_email', label: 'Head' }] },
  { key: 'locations', entity: 'locations', label: 'Locations', group: 'Org Structure', title: 'Office Locations', description: 'Physical offices and sites.',
    fields: [{ name: 'name', label: 'Name', required: true }, { name: 'city', label: 'City' }, { name: 'country', label: 'Country' }, { name: 'timezone', label: 'Timezone' }],
    display: [{ name: 'name', label: 'Name' }, { name: 'city', label: 'City' }, { name: 'country', label: 'Country' }] },
  { key: 'designations', entity: 'designations', label: 'Designations', group: 'Org Structure', title: 'Designations', description: 'Job titles and levels.',
    fields: [{ name: 'title', label: 'Title', required: true }, { name: 'level', label: 'Level' }, { name: 'department', label: 'Department' }],
    display: [{ name: 'title', label: 'Title' }, { name: 'level', label: 'Level', kind: 'badge' }, { name: 'department', label: 'Department' }] },
  { key: 'job_openings', entity: 'job_openings', label: 'Job Openings', group: 'Recruitment', title: 'Job Openings', description: 'Open requisitions.',
    fields: [{ name: 'title', label: 'Title', required: true }, { name: 'department', label: 'Department' }, { name: 'location', label: 'Location' }, { name: 'employment_type', label: 'Type', ...STATUS(['Full-Time', 'Part-Time', 'Contract', 'Intern']) }, { name: 'openings', label: 'Openings', type: 'number' }, { name: 'status', label: 'Status', ...STATUS(['open', 'on_hold', 'closed']) }, { name: 'description', label: 'Description', type: 'textarea' }],
    display: [{ name: 'title', label: 'Title' }, { name: 'department', label: 'Dept' }, { name: 'openings', label: 'Seats' }, { name: 'status', label: 'Status', kind: 'badge' }] },
  { key: 'candidates', entity: 'candidates', label: 'Candidates', group: 'Recruitment', title: 'Candidates', description: 'Applicant pipeline.',
    fields: [{ name: 'name', label: 'Name', required: true }, { name: 'email', label: 'Email' }, { name: 'phone', label: 'Phone' }, { name: 'job_opening_id', label: 'Opening id' }, { name: 'stage', label: 'Stage', ...STATUS(['applied', 'screening', 'interview', 'offer', 'hired', 'rejected']) }, { name: 'source', label: 'Source' }, { name: 'notes', label: 'Notes', type: 'textarea' }],
    display: [{ name: 'name', label: 'Name' }, { name: 'email', label: 'Email' }, { name: 'stage', label: 'Stage', kind: 'badge' }, { name: 'source', label: 'Source' }] },
  { key: 'interviews', entity: 'interviews', label: 'Interviews', group: 'Recruitment', title: 'Interviews', description: 'Scheduled interviews.',
    fields: [{ name: 'candidate_id', label: 'Candidate id' }, { name: 'interviewer_email', label: 'Interviewer' }, { name: 'scheduled_at', label: 'When', type: 'date' }, { name: 'mode', label: 'Mode', ...STATUS(['Phone', 'Video', 'Onsite']) }, { name: 'status', label: 'Status', ...STATUS(['scheduled', 'completed', 'cancelled']) }, { name: 'feedback', label: 'Feedback', type: 'textarea' }],
    display: [{ name: 'interviewer_email', label: 'Interviewer' }, { name: 'scheduled_at', label: 'When', kind: 'date' }, { name: 'mode', label: 'Mode', kind: 'badge' }, { name: 'status', label: 'Status', kind: 'badge' }] },
  { key: 'referrals', entity: 'referrals', label: 'Referrals', group: 'Recruitment', title: 'Employee Referrals', description: 'Referred candidates.',
    fields: [{ name: 'candidate_name', label: 'Candidate', required: true }, { name: 'candidate_email', label: 'Email' }, { name: 'position', label: 'Position' }, { name: 'status', label: 'Status', ...STATUS(['submitted', 'reviewing', 'hired', 'closed']) }],
    display: [{ name: 'candidate_name', label: 'Candidate' }, { name: 'position', label: 'Position' }, { name: 'referrer_email', label: 'Referred by' }, { name: 'status', label: 'Status', kind: 'badge' }] },
  { key: 'shifts', entity: 'shifts', label: 'Shifts', group: 'Operations', title: 'Shift Scheduling', description: 'Work shifts and rosters.',
    fields: [{ name: 'name', label: 'Shift name', required: true }, { name: 'start_time', label: 'Start (HH:MM)' }, { name: 'end_time', label: 'End (HH:MM)' }, { name: 'days', label: 'Days' }, { name: 'employee_id', label: 'Employee id' }],
    display: [{ name: 'name', label: 'Shift' }, { name: 'start_time', label: 'Start' }, { name: 'end_time', label: 'End' }, { name: 'days', label: 'Days' }] },
  { key: 'vendors', entity: 'vendors', label: 'Vendors', group: 'Operations', title: 'Vendors', description: 'Suppliers and partners.',
    fields: [{ name: 'name', label: 'Name', required: true }, { name: 'category', label: 'Category' }, { name: 'contact_email', label: 'Contact email' }, { name: 'phone', label: 'Phone' }, { name: 'status', label: 'Status', ...STATUS(['active', 'inactive']) }],
    display: [{ name: 'name', label: 'Name' }, { name: 'category', label: 'Category', kind: 'badge' }, { name: 'contact_email', label: 'Contact' }, { name: 'status', label: 'Status', kind: 'badge' }] },
  { key: 'incidents', entity: 'incidents', label: 'Safety Incidents', group: 'Operations', title: 'Health & Safety Incidents', description: 'Report and track incidents.',
    fields: [{ name: 'location', label: 'Location' }, { name: 'severity', label: 'Severity', ...STATUS(['low', 'medium', 'high', 'critical']) }, { name: 'incident_date', label: 'Date', type: 'date' }, { name: 'description', label: 'Description', type: 'textarea', required: true }, { name: 'status', label: 'Status', ...STATUS(['reported', 'investigating', 'resolved']) }],
    display: [{ name: 'severity', label: 'Severity', kind: 'badge' }, { name: 'location', label: 'Location' }, { name: 'incident_date', label: 'Date', kind: 'date' }, { name: 'status', label: 'Status', kind: 'badge' }] },
  { key: 'travel', entity: 'travel', label: 'Travel', group: 'Requests', title: 'Travel Requests', description: 'Business travel approvals.',
    fields: [{ name: 'destination', label: 'Destination', required: true }, { name: 'purpose', label: 'Purpose' }, { name: 'start_date', label: 'From', type: 'date' }, { name: 'end_date', label: 'To', type: 'date' }, { name: 'estimated_cost', label: 'Est. cost', type: 'number' }, { name: 'status', label: 'Status', ...STATUS(['pending', 'approved', 'rejected']) }, { name: 'employee_id', label: 'Employee id' }],
    display: [{ name: 'destination', label: 'Destination' }, { name: 'start_date', label: 'From', kind: 'date' }, { name: 'estimated_cost', label: 'Cost' }, { name: 'status', label: 'Status', kind: 'badge' }] },
  { key: 'advances', entity: 'advances', label: 'Advances', group: 'Requests', title: 'Salary Advances / Loans', description: 'Advance and loan requests.',
    fields: [{ name: 'amount', label: 'Amount', type: 'number', required: true }, { name: 'currency', label: 'Currency' }, { name: 'reason', label: 'Reason', type: 'textarea' }, { name: 'status', label: 'Status', ...STATUS(['pending', 'approved', 'rejected', 'repaid']) }, { name: 'employee_id', label: 'Employee id' }],
    display: [{ name: 'amount', label: 'Amount' }, { name: 'currency', label: 'Cur' }, { name: 'status', label: 'Status', kind: 'badge' }, { name: 'requester_email', label: 'By' }] },
  { key: 'grievances', entity: 'grievances', label: 'Grievances', group: 'Requests', title: 'Grievances', description: 'Confidential concerns.',
    fields: [{ name: 'category', label: 'Category', ...STATUS(['Workplace', 'Harassment', 'Pay', 'Other']) }, { name: 'subject', label: 'Subject', required: true }, { name: 'details', label: 'Details', type: 'textarea' }, { name: 'confidential', label: 'Confidential', type: 'checkbox' }, { name: 'status', label: 'Status', ...STATUS(['open', 'reviewing', 'resolved']) }],
    display: [{ name: 'subject', label: 'Subject' }, { name: 'category', label: 'Category', kind: 'badge' }, { name: 'status', label: 'Status', kind: 'badge' }] },
  { key: 'suggestions', entity: 'suggestions', label: 'Idea Box', group: 'Requests', title: 'Suggestions / Idea Box', description: 'Employee ideas.',
    fields: [{ name: 'title', label: 'Idea', required: true }, { name: 'details', label: 'Details', type: 'textarea' }, { name: 'votes', label: 'Votes', type: 'number' }, { name: 'status', label: 'Status', ...STATUS(['new', 'under_review', 'planned', 'done', 'declined']) }],
    display: [{ name: 'title', label: 'Idea' }, { name: 'votes', label: 'Votes' }, { name: 'status', label: 'Status', kind: 'badge' }, { name: 'submitted_by', label: 'By' }] },
  { key: 'kb', entity: 'kb', label: 'Knowledge Base', group: 'Knowledge', title: 'Knowledge Base', description: 'FAQ and how-to articles.', toggleField: 'published',
    fields: [{ name: 'title', label: 'Title', required: true }, { name: 'category', label: 'Category' }, { name: 'body', label: 'Body', type: 'textarea' }, { name: 'published', label: 'Published', type: 'checkbox' }],
    display: [{ name: 'title', label: 'Title' }, { name: 'category', label: 'Category', kind: 'badge' }, { name: 'published', label: 'Published', kind: 'bool' }] },
  { key: 'handbook', entity: 'handbook', label: 'Handbook', group: 'Knowledge', title: 'Employee Handbook', description: 'Company policies & handbook.',
    fields: [{ name: 'title', label: 'Title', required: true }, { name: 'category', label: 'Category' }, { name: 'version', label: 'Version' }, { name: 'effective_date', label: 'Effective', type: 'date' }, { name: 'body', label: 'Body', type: 'textarea' }],
    display: [{ name: 'title', label: 'Title' }, { name: 'category', label: 'Category', kind: 'badge' }, { name: 'version', label: 'Version' }, { name: 'effective_date', label: 'Effective', kind: 'date' }] },
];

const GROUPS = ['Communication', 'Support', 'Records', 'Performance', 'Lifecycle', 'Org Structure', 'Recruitment', 'Operations', 'Requests', 'Knowledge'];

function Overview({ counts }: { counts: Record<string, number> }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => { fetch('/api/me/hr-stats').then(r => r.ok ? r.json() : null).then(setD).catch(() => {}); }, []);
  const derived = d?.derived ?? {};
  const c = d?.counts ?? counts;
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Workspace Overview</h2>
        <p className="text-sm text-slate-500">Activity across all HR modules.</p>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[['Open positions', derived.openPositions], ['Pending approvals', derived.pendingApprovals], ['New hires (month)', derived.newHires], ['Upcoming interviews', derived.upcomingInterviews]].map(([l, v]) => (
          <div key={l as string} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">{l}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{v ?? 0}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Records per module</h3>
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-4">
          {FEATURES.map(f => (
            <div key={f.key} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span className="text-slate-600">{f.label}</span>
              <span className="font-semibold text-slate-900">{c[f.entity] ?? 0}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function WorkspacePage() {
  const [active, setActive] = useState('__overview');
  const f = FEATURES.find(x => x.key === active);

  return (
    <AppLayout pageTitle="Workspace" breadcrumb="People">
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="space-y-4">
          <button onClick={() => setActive('__overview')}
            className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold ${active === '__overview' ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-100'}`}>
            Overview
          </button>
          {GROUPS.map(g => (
            <div key={g}>
              <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{g}</p>
              {FEATURES.filter(x => x.group === g).map(x => (
                <button key={x.key} onClick={() => setActive(x.key)}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-medium ${active === x.key ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'}`}>
                  {x.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div>
          {active === '__overview' || !f
            ? <Overview counts={{}} />
            : <CrudPanel entity={f.entity} title={f.title} description={f.description} fields={f.fields} display={f.display} toggleField={f.toggleField} />}
        </div>
      </div>
    </AppLayout>
  );
}
