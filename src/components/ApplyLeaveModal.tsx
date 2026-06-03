'use client';

/**
 * Self-contained Apply Leave modal.
 *
 * Fetches the current user's employee record, leave balances, upcoming holidays
 * and conflict-checks against the selected date range — all in one place.
 *
 * Usage:
 *   <ApplyLeaveModal open={open} onClose={() => setOpen(false)} onSuccess={reload} />
 */

import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';
import { differenceInDays, parseISO, format, isWeekend } from 'date-fns';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LeaveBalance {
  total: number;
  used: number;
  pending: number;
  remaining: number;
  color?: string;
}

interface Holiday {
  id: string;
  name: string;
  date: string;
  holiday_type: 'mandatory' | 'optional';
  description?: string;
}

interface ApplyLeaveModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** Pre-fill a start date (e.g. when clicked from calendar) */
  prefillDate?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDisplay(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function countWorkingDays(start: string, end: string, holidays: Holiday[]): number {
  const s = parseISO(start);
  const e = parseISO(end);
  const holidayDates = new Set(holidays.filter(h => h.holiday_type === 'mandatory').map(h => h.date));
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const dateStr = format(cur, 'yyyy-MM-dd');
    if (!isWeekend(cur) && !holidayDates.has(dateStr)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ApplyLeaveModal({
  open,
  onClose,
  onSuccess,
  prefillDate,
}: ApplyLeaveModalProps) {
  const [leaveTypes, setLeaveTypes]       = useState<string[]>([]);
  const [balances, setBalances]           = useState<Record<string, LeaveBalance>>({});
  const [holidays, setHolidays]           = useState<Holiday[]>([]);
  const [overlappingLeaves, setOverlapping] = useState<any[]>([]);

  const [formType, setFormType]           = useState('');
  const [formStart, setFormStart]         = useState(prefillDate || '');
  const [formEnd, setFormEnd]             = useState(prefillDate || '');
  const [formReason, setFormReason]       = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [checkingOverlap, setCheckingOverlap] = useState(false);
  const [dataLoading, setDataLoading]     = useState(true);

  // ── Load leave types + balances ──────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setDataLoading(true);

    Promise.all([
      fetch('/api/leave-policies').then(r => r.json()),
      fetch('/api/leave-requests?limit=200').then(r => r.json()),
      fetch(`/api/holidays?year=${new Date().getFullYear()}`).then(r => r.json()),
    ]).then(([policiesData, leavesData, holidaysData]) => {
      const policies = policiesData.policies || [];
      const leaves   = leavesData.data       || [];
      const hols     = holidaysData.holidays  || [];

      setHolidays(hols);

      const bals: Record<string, LeaveBalance> = {};
      policies.forEach((p: any) => {
        bals[p.leave_type_name] = {
          total: p.days_per_year,
          used: 0, pending: 0,
          remaining: p.days_per_year,
          color: p.color,
        };
      });

      const currentYear = new Date().getFullYear();
      leaves.forEach((l: any) => {
        if (new Date(l.start_date).getFullYear() !== currentYear) return;
        const b = bals[l.leave_type];
        if (!b) return;
        if (l.status === 'approved') b.used += l.days_count;
        else if (l.status === 'pending') b.pending += l.days_count;
        b.remaining = Math.max(0, b.total - b.used);
      });

      setBalances(bals);
      setLeaveTypes(Object.keys(bals));
      setDataLoading(false);
    }).catch((err) => {
      console.error('ApplyLeaveModal load error:', err);
      setDataLoading(false);
    });
  }, [open]);

  // Pre-fill start date if provided
  useEffect(() => {
    if (prefillDate) {
      setFormStart(prefillDate);
      setFormEnd(prefillDate);
    }
  }, [prefillDate]);

  // ── Overlap check whenever dates change ──────────────────────────────────
  const checkOverlap = useCallback(async (start: string, end: string) => {
    if (!start || !end || start > end) { setOverlapping([]); return; }
    setCheckingOverlap(true);
    try {
      const res = await fetch(`/api/leave-requests?limit=200`);
      const data = await res.json();
      const leaves = data.data || [];
      const conflicts = leaves.filter((l: any) =>
        ['pending','approved'].includes(l.status) &&
        l.start_date <= end &&
        l.end_date   >= start
      );
      setOverlapping(conflicts);
    } catch {
      setOverlapping([]);
    } finally {
      setCheckingOverlap(false);
    }
  }, []);

  useEffect(() => {
    if (formStart && formEnd) checkOverlap(formStart, formEnd);
  }, [formStart, formEnd, checkOverlap]);

  // ── Derived values ────────────────────────────────────────────────────────
  const validRange  = formStart && formEnd && formStart <= formEnd;
  const calDays     = validRange ? differenceInDays(parseISO(formEnd), parseISO(formStart)) + 1 : 0;
  const workingDays = validRange ? countWorkingDays(formStart, formEnd, holidays) : 0;

  const holidaysInRange = validRange
    ? holidays.filter(h => h.date >= formStart && h.date <= formEnd)
    : [];

  const selectedBalance = balances[formType];
  const insufficientBalance = selectedBalance && workingDays > selectedBalance.remaining;

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formType || !formStart || !formEnd || !formReason) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (!validRange) {
      toast.error('Start date must be on or before end date');
      return;
    }
    if (overlappingLeaves.length > 0) {
      toast.error('Please resolve overlapping leave conflicts before submitting');
      return;
    }
    if (insufficientBalance) {
      toast.error(`Insufficient balance — you need ${workingDays}d but only have ${selectedBalance.remaining}d remaining`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/leave-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leave_type: formType,
          start_date: formStart,
          end_date:   formEnd,
          reason:     formReason,
          days_count: workingDays || calDays,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit leave request');

      toast.success('Leave request submitted successfully!');
      onSuccess?.();
      handleClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit leave request');
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    setFormType('');
    setFormStart(prefillDate || '');
    setFormEnd(prefillDate   || '');
    setFormReason('');
    setOverlapping([]);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-600 to-indigo-600">
          <h3 className="font-bold text-white flex items-center gap-2">
            <Icon name="CalendarDaysIcon" size={18} />
            Apply for Leave
          </h3>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition"
          >
            <Icon name="XMarkIcon" size={18} />
          </button>
        </div>

        {dataLoading ? (
          <div className="p-12 text-center">
            <Icon name="ArrowPathIcon" size={24} className="animate-spin mx-auto text-blue-600 mb-2" />
            <p className="text-sm text-slate-500">Loading your leave balances…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">

            {/* Leave Type */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Leave Type <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formType}
                onChange={e => setFormType(e.target.value)}
                className="input-field w-full"
              >
                <option value="">Select a leave type</option>
                {leaveTypes.map(type => {
                  const b = balances[type];
                  return (
                    <option key={type} value={type}>
                      {type} — {b.remaining}d remaining (of {b.total}d)
                    </option>
                  );
                })}
              </select>

              {formType && selectedBalance && (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[
                    { label: 'Total',   value: selectedBalance.total,     color: 'text-slate-600' },
                    { label: 'Used',    value: selectedBalance.used,      color: 'text-amber-600' },
                    { label: 'Balance', value: selectedBalance.remaining, color: insufficientBalance ? 'text-red-600 font-bold' : 'text-emerald-600 font-bold' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-slate-50 rounded-lg p-2 text-center">
                      <p className={`text-lg font-bold ${color}`}>{value}d</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formStart}
                  onChange={e => setFormStart(e.target.value)}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  End Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formEnd}
                  min={formStart}
                  onChange={e => setFormEnd(e.target.value)}
                  className="input-field w-full"
                />
              </div>
            </div>

            {/* Duration summary */}
            {validRange && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-blue-700 font-medium">Calendar days</span>
                  <span className="font-bold text-blue-900">{calDays}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-blue-700 font-medium">Working days (excl. weekends + mandatory holidays)</span>
                  <span className={`font-bold ${insufficientBalance ? 'text-red-600' : 'text-blue-900'}`}>
                    {workingDays}
                  </span>
                </div>
                {insufficientBalance && (
                  <p className="text-xs text-red-600 font-semibold pt-1">
                    ⚠ Insufficient balance — {workingDays - selectedBalance.remaining} extra day(s) needed
                  </p>
                )}
              </div>
            )}

            {/* Holidays in range */}
            {holidaysInRange.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs font-bold text-amber-800 mb-2 flex items-center gap-1">
                  <Icon name="SunIcon" size={12} />
                  {holidaysInRange.length} holiday{holidaysInRange.length > 1 ? 's' : ''} in this period
                </p>
                <div className="space-y-1">
                  {holidaysInRange.map(h => (
                    <div key={h.id} className="flex items-center justify-between text-xs">
                      <span className="text-amber-700">{h.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-amber-500">{fmtDisplay(h.date)}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          h.holiday_type === 'mandatory'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {h.holiday_type}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Overlap warning */}
            {overlappingLeaves.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs font-bold text-red-800 mb-2 flex items-center gap-1">
                  <Icon name="ExclamationTriangleIcon" size={12} />
                  {overlappingLeaves.length} conflicting leave request{overlappingLeaves.length > 1 ? 's' : ''}
                </p>
                <div className="space-y-1">
                  {overlappingLeaves.map(l => (
                    <div key={l.id} className="text-xs text-red-700">
                      <span className="font-semibold">{l.leave_type}</span>
                      {' '}— {fmtDisplay(l.start_date)} to {fmtDisplay(l.end_date)}
                      <span className="ml-1 px-1.5 py-0.5 rounded bg-red-100 text-[10px] font-semibold">{l.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {checkingOverlap && (
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Icon name="ArrowPathIcon" size={12} className="animate-spin" />
                Checking for conflicts…
              </p>
            )}

            {/* Reason */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                placeholder="Briefly describe the reason for your leave…"
                value={formReason}
                onChange={e => setFormReason(e.target.value)}
                className="input-field w-full min-h-[80px] resize-none"
                maxLength={500}
              />
              <p className="text-[11px] text-slate-400 text-right mt-0.5">{formReason.length}/500</p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || overlappingLeaves.length > 0 || !!insufficientBalance}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-semibold flex items-center gap-1.5 shadow disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting && <Icon name="ArrowPathIcon" size={14} className="animate-spin" />}
                Submit Request
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
