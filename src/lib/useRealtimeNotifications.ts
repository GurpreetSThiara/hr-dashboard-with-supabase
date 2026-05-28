import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface Notification {
  id: string;
  type: 'leave_approved' | 'leave_rejected' | 'employee_added' | 'employee_deleted' | 'leave_submitted';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export function useRealtimeNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const supabase = createClient();
  let channel: RealtimeChannel | null = null;

  useEffect(() => {
    async function subscribeToChanges() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        // Subscribe to leave request changes
        channel = supabase
          .channel(`leave_requests_${session.user.id}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'leave_requests',
            },
            (payload) => {
              const data = payload.new as any;
              if (data.status !== 'pending') {
                const notification: Notification = {
                  id: data.id,
                  type: data.status === 'approved' ? 'leave_approved' : 'leave_rejected',
                  title: data.status === 'approved' ? 'Leave Approved!' : 'Leave Rejected',
                  message: `Your leave request for ${data.reason} has been ${data.status}.`,
                  timestamp: new Date().toISOString(),
                  read: false,
                };
                setNotifications((prev) => [notification, ...prev]);
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'leave_requests',
            },
            (payload) => {
              const data = payload.new as any;
              const notification: Notification = {
                id: data.id,
                type: 'leave_submitted',
                title: 'New Leave Request',
                message: `${data.employee_name} has submitted a leave request.`,
                timestamp: new Date().toISOString(),
                read: false,
              };
              setNotifications((prev) => [notification, ...prev]);
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'employees',
            },
            (payload) => {
              const data = payload.new as any;
              const notification: Notification = {
                id: data.id,
                type: 'employee_added',
                title: 'New Employee Added',
                message: `${data.first_name} ${data.last_name} has been added to the system.`,
                timestamp: new Date().toISOString(),
                read: false,
              };
              setNotifications((prev) => [notification, ...prev]);
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'DELETE',
              schema: 'public',
              table: 'employees',
            },
            (payload) => {
              const data = payload.old as any;
              const notification: Notification = {
                id: data.id,
                type: 'employee_deleted',
                title: 'Employee Removed',
                message: `${data.first_name} ${data.last_name} has been removed from the system.`,
                timestamp: new Date().toISOString(),
                read: false,
              };
              setNotifications((prev) => [notification, ...prev]);
            }
          )
          .subscribe();
      } catch (error) {
        console.error('Error subscribing to changes:', error);
      }
    }

    subscribeToChanges();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
    markAsRead,
    clearAll,
  };
}
