/**
 * Shared types + pure helpers for the Time Tracking module (client + server).
 * No DB or React imports here so it can be used from anywhere.
 */

export type TimeEntrySource = 'timer' | 'manual';
export type TimesheetStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'returned';

export interface TimeEntry {
  id: string;
  employee_email: string;
  employee_id: string | null;
  client_id: string | null;
  project_id: string | null;
  task_id: string | null;
  timesheet_id: string | null;
  activity_type: string | null;
  description: string | null;
  tags: string[] | null;
  department: string | null;
  cost_center: string | null;
  is_billable: boolean;
  billing_rate: number | null;
  billable_amount: number | null;
  source: TimeEntrySource;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number;
  is_running: boolean;
  is_paused: boolean;
  paused_at: string | null;
  paused_accumulated_seconds: number;
  // Joined display fields (optional)
  project_name?: string | null;
  task_name?: string | null;
  client_name?: string | null;
}

export interface Timesheet {
  id: string;
  employee_id: string | null;
  employee_email: string;
  period_type: string;
  period_start: string;
  period_end: string;
  status: TimesheetStatus;
  total_minutes: number;
  billable_minutes: number;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  reviewer_comment: string | null;
}

export interface Project {
  id: string;
  name: string;
  code: string | null;
  client_id: string | null;
  status: string;
  color: string | null;
  is_billable: boolean;
  billing_rate: number | null;
  estimated_hours: number | null;
  budget_amount: number | null;
  client_name?: string | null;
}

export interface Client {
  id: string;
  name: string;
  code: string | null;
  status: string;
  color: string | null;
}

export interface Task {
  id: string;
  project_id: string;
  name: string;
  status: string;
  is_billable: boolean;
  estimated_hours: number | null;
}

/** Standard full-time week, in minutes (40h). Hours beyond this are overtime. */
export const WEEKLY_OVERTIME_THRESHOLD_MIN = 40 * 60;

/** ISO-week Monday (local time) for a given date, at 00:00. */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1) - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  return d;
}

export function endOfWeek(date: Date): Date {
  const s = startOfWeek(date);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}

/** YYYY-MM-DD in local time. */
export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Elapsed seconds of a (possibly running/paused) entry, as of `now`. */
export function elapsedSeconds(entry: Pick<TimeEntry,
  'started_at' | 'ended_at' | 'is_running' | 'is_paused' | 'paused_at' | 'paused_accumulated_seconds' | 'duration_minutes'>,
  now: Date = new Date()
): number {
  if (!entry.is_running) {
    return entry.duration_minutes * 60;
  }
  let secs = entry.paused_accumulated_seconds || 0;
  if (!entry.is_paused) {
    const since = entry.paused_at ? new Date(entry.paused_at) : new Date(entry.started_at);
    secs += Math.max(0, Math.floor((now.getTime() - since.getTime()) / 1000));
  }
  return secs;
}

/** Format minutes as "Hh Mm" (e.g. 90 → "1h 30m"). */
export function formatMinutes(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h > 0 ? `${h}h ${r}m` : `${r}m`;
}

/** Format seconds as HH:MM:SS for a live timer. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}
