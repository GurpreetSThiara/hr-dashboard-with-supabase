'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface Notification {
  id: string;
  type:
    | 'leave_approved'
    | 'leave_rejected'
    | 'employee_added'
    | 'employee_deleted'
    | 'leave_submitted'
    | 'regularization_updated';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

// HR/manager roles that see all new leave submissions
const APPROVER_ROLES = new Set([
  'Super Admin', 'Owner', 'Admin', 'HR Admin',
  'HR Manager', 'HR Executive', 'Director', 'Manager',
]);

export function useRealtimeNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  // useRef so cleanup always references the live channel, not a stale let-binding
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabase = createClient();

  const addNotification = useCallback((n: Notification) => {
    setNotifications((prev) => [n, ...prev.slice(0, 49)]); // cap at 50
  }, []);

  useEffect(() => {
    let active = true;

    async function subscribe() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user || !active) return;

        const userId = session.user.id;
        const userEmail = session.user.email ?? '';

        // Fetch user role to determine notification scope
        const { data: profile } = await supabase
          .from('users')
          .select('role')
          .eq('id', userId)
          .single();
        const userRole: string = profile?.role ?? 'Employee';
        const isApprover = APPROVER_ROLES.has(userRole);

        if (!active) return;

        const ch = supabase.channel(`hrcore_notifications_${userId}`)

          // ── Leave approved / rejected — notify the employee who owns it ──
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'leave_requests' },
            (payload) => {
              const data = payload.new as any;
              const old = payload.old as any;
              // Only fire if status actually changed
              if (data.status === old.status) return;
              // Notify the employee whose leave it is (match by email if stored)
              const isMyLeave =
                data.employee_email === userEmail ||
                (!data.employee_email && data.employee_id === userId);
              if (isMyLeave && (data.status === 'approved' || data.status === 'rejected')) {
                addNotification({
                  id: `lr-upd-${data.id}-${Date.now()}`,
                  type: data.status === 'approved' ? 'leave_approved' : 'leave_rejected',
                  title: data.status === 'approved' ? 'Leave Approved! ✅' : 'Leave Rejected',
                  message: `Your ${data.leave_type || ''} leave request (${data.start_date} → ${data.end_date}) has been ${data.status}.`,
                  timestamp: new Date().toISOString(),
                  read: false,
                });
              }
              // Also notify approvers that a request was just processed (by someone else)
              if (isApprover && !isMyLeave && (data.status === 'approved' || data.status === 'rejected')) {
                addNotification({
                  id: `lr-proc-${data.id}-${Date.now()}`,
                  type: data.status === 'approved' ? 'leave_approved' : 'leave_rejected',
                  title: `Leave ${data.status === 'approved' ? 'Approved' : 'Rejected'}`,
                  message: `${data.employee_name}'s leave request has been ${data.status}.`,
                  timestamp: new Date().toISOString(),
                  read: false,
                });
              }
            }
          )

          // ── New leave submitted — notify approvers only ──
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'leave_requests' },
            (payload) => {
              if (!isApprover) return;
              const data = payload.new as any;
              addNotification({
                id: `lr-new-${data.id}`,
                type: 'leave_submitted',
                title: 'New Leave Request',
                message: `${data.employee_name} submitted a ${data.leave_type || ''} leave (${data.start_date} → ${data.end_date}).`,
                timestamp: new Date().toISOString(),
                read: false,
              });
            }
          )

          // ── New employee added ──
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'employees' },
            (payload) => {
              const data = payload.new as any;
              addNotification({
                id: `emp-add-${data.id}`,
                type: 'employee_added',
                title: 'New Employee Added',
                message: `${data.first_name} ${data.last_name} has joined the team.`,
                timestamp: new Date().toISOString(),
                read: false,
              });
            }
          )

          // ── Employee removed ──
          .on(
            'postgres_changes',
            { event: 'DELETE', schema: 'public', table: 'employees' },
            (payload) => {
              const data = payload.old as any;
              if (!isApprover) return;
              addNotification({
                id: `emp-del-${data.id}-${Date.now()}`,
                type: 'employee_deleted',
                title: 'Employee Removed',
                message: `${data.first_name ?? ''} ${data.last_name ?? ''} has been removed from the system.`,
                timestamp: new Date().toISOString(),
                read: false,
              });
            }
          )

          // ── Regularization status updated ──
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'regularization_requests' },
            (payload) => {
              const data = payload.new as any;
              const old = payload.old as any;
              if (data.status === old.status) return;
              if (data.employee_id !== userId && data.employee_email !== userEmail) return;
              addNotification({
                id: `reg-upd-${data.id}-${Date.now()}`,
                type: 'regularization_updated',
                title: `Regularization ${data.status === 'approved' ? 'Approved' : 'Rejected'}`,
                message: `Your attendance regularization request for ${data.regularization_date} has been ${data.status}.`,
                timestamp: new Date().toISOString(),
                read: false,
              });
            }
          )

          .subscribe();

        if (active) {
          channelRef.current = ch;
        } else {
          supabase.removeChannel(ch);
        }
      } catch (err) {
        console.error('Error setting up realtime notifications:', err);
      }
    }

    subscribe();

    return () => {
      active = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
    markAsRead,
    markAllRead,
    clearAll,
  };
}
