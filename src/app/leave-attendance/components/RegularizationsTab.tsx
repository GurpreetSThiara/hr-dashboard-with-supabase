'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
  Calendar as CalendarIcon,
  Clock,
  Send,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  User,
  ShieldCheck,
  HelpCircle,
  Plus,
  X,
  MessageSquare
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';

interface RegularizationRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  date: string;
  requested_check_in: string | null;
  requested_check_out: string | null;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approver_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface RegularizationsTabProps {
  prefillDate?: string | null;
  onClearPrefillDate?: () => void;
}

export default function RegularizationsTab({ prefillDate, onClearPrefillDate }: RegularizationsTabProps) {
  const supabase = createClient();

  // Settings
  const [settings, setSettings] = useState<any>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Modal / Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formDate, setFormDate] = useState('');
  const [formCheckIn, setFormCheckIn] = useState('09:00');
  const [formCheckOut, setFormCheckOut] = useState('18:00');
  const [formReason, setFormReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Data States
  const [myRequests, setMyRequests] = useState<RegularizationRequest[]>([]);
  const [adminRequests, setAdminRequests] = useState<RegularizationRequest[]>([]);
  const [adminTab, setAdminTab] = useState<'pending' | 'all'>('pending');
  const [loadingData, setLoadingData] = useState(true);

  // Approver Input States
  const [approverNotes, setApproverNotes] = useState<Record<string, string>>({});
  const [actioningId, setActioningId] = useState<string | null>(null);

  // Whether THIS user can approve — decided by the API (reporting-based), not a
  // hardcoded role list, so the actual reporting manager always sees the queue.
  const [canApprove, setCanApprove] = useState(false);

  // 1. Fetch settings
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/attendance/settings');
        if (res.ok) {
          const data = await res.json();
          setSettings(data);
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
      } finally {
        setLoadingSettings(false);
      }
    }
    loadSettings();
  }, []);

  // 2. Fetch requests (User logs and Admin requests if applicable)
  async function fetchRequests() {
    try {
      setLoadingData(true);
      // Fetch user requests
      const userRes = await fetch('/api/regularizations');
      if (userRes.ok) {
        const data = await userRes.json();
        setMyRequests(data);
      }

      // Attempt to fetch the approval queue. The API authorizes by reporting
      // relationship; a 200 means this user can approve (HR or a manager).
      const adminRes = await fetch(`/api/admin/regularizations?status=${adminTab}`);
      if (adminRes.ok) {
        setCanApprove(true);
        setAdminRequests(await adminRes.json());
      } else {
        setCanApprove(false);
        setAdminRequests([]);
      }
    } catch (err) {
      console.error('Error fetching regularizations:', err);
      toast.error('Failed to load requests list');
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => {
    fetchRequests();
  }, [adminTab]);

  // Handle prefillDate trigger
  useEffect(() => {
    if (prefillDate) {
      setFormDate(prefillDate);
      setIsModalOpen(true);
    }
  }, [prefillDate]);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormDate('');
    setFormReason('');
    if (onClearPrefillDate) onClearPrefillDate();
  };

  // Submit regularization
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDate || !formReason.trim()) {
      toast.error('Please specify a date and reason.');
      return;
    }

    // Client-side validations using loaded settings
    const maxPastDays = settings?.max_past_days_regularization ?? 30;
    const today = new Date();
    const target = parseISO(formDate);
    const diff = differenceInDays(today, target);

    if (diff < 0) {
      toast.error('Regularization cannot be requested for future dates.');
      return;
    }

    if (diff > maxPastDays) {
      toast.error(`Policy block: selected date was ${diff} days ago. Max allowed past days is ${maxPastDays}.`);
      return;
    }

    try {
      setSubmitting(true);
      // Construct requested check-in and check-out times as full ISO strings
      const checkInISO = new Date(`${formDate}T${formCheckIn}:00`).toISOString();
      const checkOutISO = new Date(`${formDate}T${formCheckOut}:00`).toISOString();

      const res = await fetch('/api/regularizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: formDate,
          requested_check_in: checkInISO,
          requested_check_out: checkOutISO,
          reason: formReason
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit regularization');

      toast.success('Regularization request submitted successfully!');
      handleCloseModal();
      fetchRequests();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error submitting request');
    } finally {
      setSubmitting(false);
    }
  };

  // Approve/Reject action
  const handleAction = async (id: string, action: 'approved' | 'rejected') => {
    setActioningId(id);
    const notes = approverNotes[id] || '';

    try {
      const res = await fetch(`/api/admin/regularizations/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          approver_notes: notes
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action} request`);

      toast.success(`Request successfully ${action}!`);
      // Clear notes field
      setApproverNotes(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      fetchRequests();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || `Error executing ${action}`);
    } finally {
      setActioningId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, string> = {
      pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      rejected: 'bg-rose-50 text-rose-700 border-rose-200'
    };
    const label = status.charAt(0).toUpperCase() + status.slice(1);
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${config[status] || 'bg-slate-50 text-slate-600'}`}>
        {status === 'pending' && <Clock className="w-3.5 h-3.5" />}
        {status === 'approved' && <CheckCircle className="w-3.5 h-3.5" />}
        {status === 'rejected' && <XCircle className="w-3.5 h-3.5" />}
        {label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Policy banner if regularizations are disabled */}
      {!loadingSettings && settings && !settings.enable_regularizations && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-red-800 font-sans">Regularizations Disabled</h4>
            <p className="text-xs text-red-700 mt-0.5 leading-relaxed font-sans">
              Submitting new attendance regularization requests is currently locked by the HR administrator.
            </p>
          </div>
        </div>
      )}

      {/* Main Grid: Split between My requests and Approvals */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left: My Regularizations Log (takes 2 cols if admin panel is shown, else 3) */}
        <div className={`xl:col-span-${canApprove ? '2' : '3'} space-y-6`}>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">My Regularization Log</h3>
              </div>

              {(!settings || settings.enable_regularizations) && (
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  Apply Request
                </button>
              )}
            </div>

            {loadingData ? (
              <div className="py-20 text-center text-slate-400 text-xs">Loading requests logs...</div>
            ) : myRequests.length === 0 ? (
              <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                <HelpCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-500">No requests submitted</p>
                <p className="text-xs text-slate-400 mt-1">When you request corrections for past dates, they will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-bold uppercase tracking-wider pb-3">
                      <th className="pb-3 pr-4">Request Date</th>
                      <th className="pb-3 px-4">Status</th>
                      <th className="pb-3 px-4">Requested Shift</th>
                      <th className="pb-3 px-4">Reason</th>
                      <th className="pb-3 pl-4">Approver Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                    {myRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/50">
                        <td className="py-3.5 pr-4 font-bold text-slate-800">
                          {format(new Date(req.date), 'MMM d, yyyy')}
                        </td>
                        <td className="py-3.5 px-4">
                          {getStatusBadge(req.status)}
                        </td>
                        <td className="py-3.5 px-4 font-mono-data text-slate-500">
                          {req.requested_check_in ? format(new Date(req.requested_check_in), 'hh:mm a') : '--'} 
                          {' - '}
                          {req.requested_check_out ? format(new Date(req.requested_check_out), 'hh:mm a') : '--'}
                        </td>
                        <td className="py-3.5 px-4 max-w-[200px] truncate" title={req.reason}>
                          {req.reason}
                        </td>
                        <td className="py-3.5 pl-4 max-w-[200px] truncate text-slate-400 font-medium" title={req.approver_notes || ''}>
                          {req.approver_notes || '--'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right: Admin Approvals Panel (only visible for HR/Managers) */}
        {canApprove && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Approvals Interface</h3>
                </div>

                <div className="flex bg-slate-100 p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setAdminTab('pending')}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition ${
                      adminTab === 'pending' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    Pending
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminTab('all')}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition ${
                      adminTab === 'all' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    All History
                  </button>
                </div>
              </div>

              {loadingData ? (
                <div className="py-12 text-center text-slate-400 text-xs">Loading approvals queue...</div>
              ) : adminRequests.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <CheckCircle className="w-8 h-8 text-emerald-100 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-500">No requests in this queue</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Everything looks fully processed!</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                  {adminRequests.map((req) => (
                    <div key={req.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-slate-800 flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {req.employee_name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Shift Correction: {format(new Date(req.date), 'MMM d, yyyy')}
                          </p>
                        </div>
                        {req.status !== 'pending' && getStatusBadge(req.status)}
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-slate-200/50 text-[11px] text-slate-600 space-y-1.5">
                        <div className="flex justify-between font-mono-data">
                          <span className="text-slate-400">Proposed Times</span>
                          <span className="font-bold">
                            {req.requested_check_in ? format(new Date(req.requested_check_in), 'hh:mm a') : '--'} 
                            {' - '}
                            {req.requested_check_out ? format(new Date(req.requested_check_out), 'hh:mm a') : '--'}
                          </span>
                        </div>
                        <div className="border-t border-slate-100 pt-1.5 mt-1.5">
                          <span className="text-slate-400 block font-semibold mb-0.5">Reason:</span>
                          <p className="italic text-slate-500 leading-normal">{req.reason}</p>
                        </div>
                      </div>

                      {req.status === 'pending' && (
                        <div className="space-y-2 pt-1">
                          <div className="relative">
                            <MessageSquare className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Remarks/notes (optional)..."
                              value={approverNotes[req.id] || ''}
                              onChange={(e) =>
                                setApproverNotes((prev) => ({ ...prev, [req.id]: e.target.value }))
                              }
                              className="w-full pl-8 pr-3 py-1.5 text-[11px] border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              disabled={actioningId !== null}
                              onClick={() => handleAction(req.id, 'rejected')}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold rounded-lg transition border border-rose-200 flex items-center justify-center gap-1"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Reject
                            </button>
                            <button
                              type="button"
                              disabled={actioningId !== null}
                              onClick={() => handleAction(req.id, 'approved')}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition shadow-xs flex items-center justify-center gap-1"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Approve
                            </button>
                          </div>
                        </div>
                      )}

                      {req.status !== 'pending' && req.approver_notes && (
                        <div className="bg-white p-2 rounded-lg border border-slate-100 text-[10px] text-slate-500">
                          <span className="font-bold text-slate-400 uppercase tracking-wider block text-[9px] mb-0.5">Approver Remarks</span>
                          {req.approver_notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4. Apply Regularization Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden animate-fade-in flex flex-col">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <CalendarIcon className="w-4 h-4 text-blue-600" />
                Apply for Shift Correction
              </h4>
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1">
              {/* Date selection */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date to Regularize</label>
                <input
                  type="date"
                  required
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500"
                />
                {settings && (
                  <p className="text-[10px] text-slate-400">
                    Max past days allowed: <span className="font-bold text-slate-600">{settings.max_past_days_regularization} days</span>.
                  </p>
                )}
              </div>

              {/* Time inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Correct Check-In</label>
                  <input
                    type="time"
                    required
                    value={formCheckIn}
                    onChange={(e) => setFormCheckIn(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Correct Check-Out</label>
                  <input
                    type="time"
                    required
                    value={formCheckOut}
                    onChange={(e) => setFormCheckOut(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Reason input */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Justification Reason</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explain why check-in/out logs were missed or need correction..."
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50"
                >
                  {submitting && <Clock className="w-3.5 h-3.5 animate-spin" />}
                  <Send className="w-3.5 h-3.5" />
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
