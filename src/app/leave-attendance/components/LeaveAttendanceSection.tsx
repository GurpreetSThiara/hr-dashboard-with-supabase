'use client';

import React, { useState, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

interface LeaveRequest {
  id: string;
  employee_name: string;
  employee_email: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approver_notes?: string;
  created_at: string;
}

type TabType = 'pending' | 'approved' | 'rejected' | 'all';

export default function LeaveAttendanceSection() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [approverNotes, setApproverNotes] = useState<Record<string, string>>({});

  const supabase = createClient();

  // Fetch user role
  useEffect(() => {
    async function fetchUserRole() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: userProfile } = await supabase
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .single();
          setUserRole(userProfile?.role || 'Employee');
        }
      } catch (err) {
        console.error('Error fetching user role:', err);
      }
    }
    fetchUserRole();
  }, []);

  // Fetch leave requests
  useEffect(() => {
    async function fetchLeaves() {
      try {
        setLoading(true);
        let query = supabase.from('leave_requests').select('*').order('created_at', { ascending: false });

        if (activeTab !== 'all') {
          query = query.eq('status', activeTab);
        }

        const { data, error } = await query;
        if (error) throw error;
        setLeaves(data || []);
      } catch (err) {
        console.error('Error fetching leaves:', err);
        toast.error('Failed to load leave requests');
      } finally {
        setLoading(false);
      }
    }

    fetchLeaves();
  }, [activeTab]);

  // Role-based permission check
  const canApprove = ['Super Admin', 'Owner', 'Admin', 'HR Admin', 'HR Manager', 'HR Executive', 'Director', 'Manager'].includes(userRole || '');

  async function handleApprove(id: string) {
    if (!canApprove) {
      toast.error('You do not have permission to approve leaves');
      return;
    }

    setApprovingId(id);
    try {
      const response = await fetch(`/api/leave-requests/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approved',
          approver_notes: approverNotes[id] || '',
        }),
      });

      if (!response.ok) throw new Error('Failed to approve leave');

      setLeaves((prev) =>
        prev.map((l) => (l.id === id ? { ...l, status: 'approved' } : l))
      );
      toast.success('Leave request approved');
    } catch (error) {
      toast.error('Failed to approve leave');
      console.error(error);
    } finally {
      setApprovingId(null);
    }
  }

  async function handleReject(id: string) {
    if (!canApprove) {
      toast.error('You do not have permission to reject leaves');
      return;
    }

    setRejectingId(id);
    try {
      const response = await fetch(`/api/leave-requests/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rejected',
          approver_notes: approverNotes[id] || '',
        }),
      });

      if (!response.ok) throw new Error('Failed to reject leave');

      setLeaves((prev) =>
        prev.map((l) => (l.id === id ? { ...l, status: 'rejected' } : l))
      );
      toast.success('Leave request rejected');
    } catch (error) {
      toast.error('Failed to reject leave');
      console.error(error);
    } finally {
      setRejectingId(null);
    }
  }

  function getLeaveTypeColor(type: string) {
    const colors: Record<string, string> = {
      'Sick Leave': 'bg-red-100 text-red-700',
      'Vacation': 'bg-green-100 text-green-700',
      'Personal': 'bg-blue-100 text-blue-700',
      'Maternity': 'bg-pink-100 text-pink-700',
      'Paternity': 'bg-indigo-100 text-indigo-700',
      'Unpaid': 'bg-slate-100 text-slate-700',
    };
    return colors[type] || 'bg-slate-100 text-slate-700';
  }

  const filteredLeaves = leaves;

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <Icon name="ArrowPathIcon" size={24} className="animate-spin mx-auto text-blue-600 mb-2" />
        <p className="text-slate-500">Loading leave requests...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Tabs */}
      <div className="border-b border-slate-200 px-6 py-4">
        <div className="flex gap-4 overflow-x-auto">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((tab) => {
            const count = leaves.filter((l) => tab === 'all' || l.status === tab).length;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors rounded-lg ${
                  activeTab === tab
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Leave Requests List */}
      <div className="divide-y divide-slate-200">
        {filteredLeaves.length === 0 ? (
          <EmptyState
            icon="CalendarIcon"
            title="No Leave Requests"
            description={`No ${activeTab === 'all' ? '' : activeTab} leave requests found.`}
          />
        ) : (
          filteredLeaves.map((leave) => (
            <div key={leave.id} className="p-6 hover:bg-slate-50 transition-colors">
              <div className="flex items-start justify-between gap-4">
                {/* Left Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-sm font-semibold text-slate-900">{leave.employee_name}</h3>
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${getLeaveTypeColor(leave.leave_type)}`}>
                      {leave.leave_type}
                    </span>
                    <StatusBadge
                      status={leave.status === 'pending' ? 'onboarding' : leave.status === 'approved' ? 'active' : 'terminated'}
                      customLabel={leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                    />
                  </div>

                  <p className="text-xs text-slate-500 mb-3">{leave.employee_email}</p>

                  {/* Date Range */}
                  <div className="flex items-center gap-2 text-sm text-slate-700 mb-2">
                    <Icon name="CalendarIcon" size={14} className="text-slate-400" />
                    {new Date(leave.start_date).toLocaleDateString()} to {new Date(leave.end_date).toLocaleDateString()}
                  </div>

                  {/* Reason */}
                  <p className="text-sm text-slate-600 mb-2">
                    <span className="font-semibold">Reason:</span> {leave.reason}
                  </p>

                  {/* Approver Notes */}
                  {leave.approver_notes && (
                    <p className="text-sm text-slate-600">
                      <span className="font-semibold">Notes:</span> {leave.approver_notes}
                    </p>
                  )}
                </div>

                {/* Right Actions */}
                {leave.status === 'pending' && canApprove && (
                  <div className="flex flex-col gap-2 min-w-fit">
                    <div className="mb-2">
                      <textarea
                        placeholder="Approval notes (optional)"
                        value={approverNotes[leave.id] || ''}
                        onChange={(e) =>
                          setApproverNotes((prev) => ({
                            ...prev,
                            [leave.id]: e.target.value,
                          }))
                        }
                        className="input-field text-xs p-2 resize-none w-40"
                        rows={2}
                      />
                    </div>
                    <button
                      onClick={() => handleApprove(leave.id)}
                      disabled={approvingId === leave.id}
                      className="px-3 py-1.5 text-xs font-semibold bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      {approvingId === leave.id && (
                        <Icon name="ArrowPathIcon" size={12} className="animate-spin" />
                      )}
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(leave.id)}
                      disabled={rejectingId === leave.id}
                      className="px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      {rejectingId === leave.id && (
                        <Icon name="ArrowPathIcon" size={12} className="animate-spin" />
                      )}
                      Reject
                    </button>
                  </div>
                )}

                {leave.status !== 'pending' && (
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Processed</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(leave.created_at).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
