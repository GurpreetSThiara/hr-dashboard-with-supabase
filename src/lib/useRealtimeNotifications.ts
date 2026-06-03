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
  /** true when this notification is backed by a row in the notifications table */
  persisted?: boolean;
  link?: string;
}

// Roles that get the ephemeral "employee removed" notice.
const APPROVER_ROLES = new Set([
  'Super Admin', 'Owner', 'Admin', 'HR Admin',
  'HR Manager', 'HR Executive', 'Director', 'Manager',
]);

const VALID_TYPES = new Set([
  'leave_approved', 'leave_rejected', 'employee_added',
  'employee_deleted', 'leave_submitted', 'regularization_updated',
]);

function mapRow(row: any): Notification {
  return {
    id: row.id,
    type: VALID_TYPES.has(row.type) ? row.type : 'leave_submitted',
    title: row.title,
    message: row.message ?? '',
    timestamp: row.created_at ?? new Date().toISOString(),
    read: !!row.read,
    persisted: true,
    link: row.link ?? undefined,
  };
}

export function useRealtimeNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const emailRef = useRef<string>('');
  const supabase = createClient();

  const addNotification = useCallback((n: Notification) => {
    setNotifications((prev) => {
      if (prev.some((x) => x.id === n.id)) return prev;
      return [n, ...prev.slice(0, 49)]; // cap at 50
    });
  }, []);

  useEffect(() => {
    let active = true;

    async function subscribe() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user || !active) return;

        const userId = session.user.id;
        const userEmail = (session.user.email ?? '').toLowerCase();
        emailRef.current = userEmail;

        // Role (for the ephemeral employee-removed notice)
        const { data: profile } = await supabase
          .from('users')
          .select('role')
          .eq('id', userId)
          .single();
        const isApprover = APPROVER_ROLES.has(profile?.role ?? 'Employee');

        // ── 1. Load persisted notifications for this user ──────────────────
        const { data: existing } = await supabase
          .from('notifications')
          .select('*')
          .eq('recipient_email', userEmail)
          .order('created_at', { ascending: false })
          .limit(50);

        if (!active) return;
        if (existing) setNotifications(existing.map(mapRow));

        // ── 2. Realtime subscriptions ─────────────────────────────────────
        const ch = supabase.channel(`hrcore_notifications_${userId}`)

          // Persisted notifications addressed to me (leave submit/approve/reject)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'notifications' },
            (payload) => {
              const row = payload.new as any;
              if ((row.recipient_email ?? '').toLowerCase() !== userEmail) return;
              addNotification(mapRow(row));
            }
          )

          // Ephemeral: new employee added (informational, not persisted)
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

          // Ephemeral: employee removed (approvers only)
          .on(
            'postgres_changes',
            { event: 'DELETE', schema: 'public', table: 'employees' },
            (payload) => {
              if (!isApprover) return;
              const data = payload.old as any;
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

          // Ephemeral: my regularization decision
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'regularization_requests' },
            (payload) => {
              const data = payload.new as any;
              const old = payload.old as any;
              if (data.status === old.status) return;
              if (data.employee_id !== userId && (data.employee_email ?? '').toLowerCase() !== userEmail) return;
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
    setNotifications((prev) => {
      const target = prev.find((n) => n.id === id);
      if (target?.persisted) {
        supabase.from('notifications').update({ read: true }).eq('id', id).then(() => {});
      }
      return prev.map((n) => (n.id === id ? { ...n, read: true } : n));
    });
  }, [supabase]);

  const markAllRead = useCallback(() => {
    if (emailRef.current) {
      supabase
        .from('notifications')
        .update({ read: true })
        .eq('recipient_email', emailRef.current)
        .eq('read', false)
        .then(() => {});
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [supabase]);

  const clearAll = useCallback(() => {
    if (emailRef.current) {
      supabase
        .from('notifications')
        .delete()
        .eq('recipient_email', emailRef.current)
        .then(() => {});
    }
    setNotifications([]);
  }, [supabase]);

  return {
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
    markAsRead,
    markAllRead,
    clearAll,
  };
}
