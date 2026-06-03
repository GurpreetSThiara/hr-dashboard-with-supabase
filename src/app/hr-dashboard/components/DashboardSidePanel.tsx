'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';

interface LeaveRequest {
  id: string;
  employee_name: string;
  employee_initials: string;
  avatar_color: string;
  department: string;
  leave_type: string;
  days: number;
  start_date: string;
  reason: string;
  status: string;
  created_at: string;
}

interface ActivityFeed {
  id: string;
  icon: string;
  icon_color: string;
  icon_bg: string;
  description: string;
  created_at: string;
}

export default function DashboardSidePanel() {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityFeed[]>([]);
  const [activeTab, setActiveTab] = useState<'approvals' | 'activity'>('approvals');
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);

  const supabase = createClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Fetch user role
  useEffect(() => {
    async function fetchUserRole() {
      if (!user) return;
      const { data } = await supabase.from('users').select('role').eq('id', user.id).single();
      setUserRole(data?.role || 'Employee');
    }
    fetchUserRole();
  }, [user]);

  // Fetch leave requests (memoised so realtime can call it too)
  const fetchLeaveRequests = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLeaves(data || []);
    } catch (err) {
      console.error('Error fetching leave requests:', err);
      setLeaves([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchActivityFeed = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('activity_feed')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      setActivityFeed(data || []);
    } catch {
      setActivityFeed([]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchLeaveRequests();
    fetchActivityFeed();
  }, []);

  // ── Realtime subscriptions ──────────────────────────────────────────────────
  useEffect(() => {
    const ch = supabase
      .channel('sidepanel_live')

      // New pending leave submitted → add to list
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leave_requests' }, (payload) => {
        const row = payload.new as any;
        if (row.status === 'pending') {
          setLeaves((prev) => {
            if (prev.some((l) => l.id === row.id)) return prev;
            return [row, ...prev];
          });
          toast.info(`New leave request from ${row.employee_name}`, { duration: 4000 });
        }
      })

      // Leave status changed → remove from pending list if no longer pending
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leave_requests' }, (payload) => {
        const row = payload.new as any;
        if (row.status !== 'pending') {
          setLeaves((prev) => prev.filter((l) => l.id !== row.id));
        } else {
          // Still pending — update in place (e.g., employee edited it)
          setLeaves((prev) => prev.map((l) => (l.id === row.id ? { ...l, ...row } : l)));
        }
      })

      // New activity feed entry
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_feed' }, (payload) => {
        const row = payload.new as ActivityFeed;
        setActivityFeed((prev) => [row, ...prev.slice(0, 19)]);
      })

      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED');
      });

    channelRef.current = ch;

    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
      setIsLive(false);
    };
  }, []);

  // Role-based access check for approval
  const canApprove = ['Super Admin', 'Owner', 'Admin', 'HR Admin', 'HR Manager', 'HR Executive', 'Payroll Manager', 'Director', 'Manager'].includes(userRole || '');

  async function handleApprove(id: string, name: string) {
    if (!canApprove) { toast.error('You do not have permission to approve leave requests'); return; }
    try {
      await supabase.from('leave_requests').update({ status: 'approved' }).eq('id', id);
      // Realtime UPDATE event will remove it from the list automatically
      toast.success(`Leave approved for ${name}`, { description: 'Employee notified.' });
    } catch (err) {
      toast.error('Failed to approve leave request');
      console.error(err);
    }
  }

  async function handleReject(id: string, name: string) {
    if (!canApprove) { toast.error('You do not have permission to reject leave requests'); return; }
    try {
      await supabase.from('leave_requests').update({ status: 'rejected' }).eq('id', id);
      toast.error(`Leave rejected for ${name}`, { description: 'Employee notified.' });
    } catch (err) {
      toast.error('Failed to reject leave request');
      console.error(err);
    }
  }

  const getTimeAgo = (date: string) => {
    const now = new Date();
    const created = new Date(date);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden h-full flex flex-col">
      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {([
          { id: 'approvals', label: 'Pending Approvals', count: leaves.length },
          { id: 'activity', label: 'Activity Feed', count: null },
        ] as const).map((tab) => (
          <button
            key={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
              activeTab === tab.id
                ? 'text-blue-700 border-b-2 border-blue-700 -mb-px bg-blue-50/50'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            {tab.label}
            {tab.count !== null && tab.count > 0 && (
              <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${
                activeTab === tab.id ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
        {/* Live indicator */}
        <div className="flex items-center px-3">
          <span className={`flex items-center gap-1 text-[10px] font-semibold ${isLive ? 'text-emerald-600' : 'text-slate-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
            {isLive ? 'Live' : '—'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {activeTab === 'approvals' && (
          <div>
            {loading ? (
              <div className="p-4 text-center">
                <Icon name="ArrowPathIcon" size={20} className="animate-spin mx-auto text-blue-600" />
              </div>
            ) : leaves.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mb-3">
                  <Icon name="CheckCircleIcon" size={24} className="text-emerald-600" />
                </div>
                <p className="text-sm font-semibold text-slate-700">All caught up!</p>
                <p className="text-xs text-slate-500 mt-1">No pending leave approvals</p>
              </div>
            ) : (
              leaves.map((leave) => (
                <div key={leave.id} className="p-4 border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-full ${leave.avatar_color || 'bg-blue-600'} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                      {leave.employee_initials || (leave.employee_name?.slice(0, 2).toUpperCase() ?? '?')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900 truncate">{leave.employee_name}</p>
                          <p className="text-xs text-slate-500">{leave.department}</p>
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0">{getTimeAgo(leave.created_at)}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                          {leave.leave_type}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {leave.days}d from {leave.start_date}
                        </span>
                      </div>
                      {leave.reason && (
                        <p className="text-xs text-slate-500 mt-1 italic truncate">"{leave.reason}"</p>
                      )}
                      {canApprove && (
                        <div className="flex items-center gap-2 mt-2.5">
                          <button
                            onClick={() => handleApprove(leave.id, leave.employee_name)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition-colors active:scale-95"
                          >
                            <Icon name="CheckIcon" size={12} />
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(leave.id, leave.employee_name)}
                            className="flex items-center gap-1 px-3 py-1.5 border border-red-200 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-50 transition-colors active:scale-95"
                          >
                            <Icon name="XMarkIcon" size={12} />
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="p-4 space-y-0">
            {activityFeed.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-8">No recent activity</p>
            )}
            {activityFeed.map((item, idx) => (
              <div key={item.id} className="flex items-start gap-3 py-3 relative">
                {idx < activityFeed.length - 1 && (
                  <div className="absolute left-[18px] top-10 bottom-0 w-px bg-slate-100" />
                )}
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 z-10 ${item.icon_bg}`}>
                  <Icon name={item.icon as Parameters<typeof Icon>[0]['name']} size={15} className={item.icon_color} />
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <p className="text-xs text-slate-700 leading-relaxed">{item.description}</p>
                  <p className="text-[11px] text-slate-400 mt-1">{getTimeAgo(item.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer — only the approvals tab has a real destination */}
      {activeTab === 'approvals' && (
        <div className="border-t border-slate-100 px-4 py-2.5">
          <Link
            href="/leave-attendance"
            className="text-xs text-blue-600 hover:text-blue-700 font-semibold transition-colors w-full text-center block"
          >
            View all leave requests →
          </Link>
        </div>
      )}
    </div>
  );
}
