'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function CheckinCheckoutButton() {
  const supabase = createClient();
  const { user } = useAuth();
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [duration, setDuration] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.email) {
      checkTodayStatus();
    }
  }, [user?.email]);

  async function checkTodayStatus() {
    try {
      // Get employee
      const { data: emp } = await supabase
        .from('employees')
        .select('id')
        .eq('email', user?.email)
        .single();

      if (!emp) return;

      // Check today's log
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: logs } = await supabase
        .from('checkin_checkout_logs')
        .select('*')
        .eq('employee_id', emp.id)
        .gte('check_in_time', `${today}T00:00:00`)
        .lte('check_in_time', `${today}T23:59:59`)
        .single();

      if (logs) {
        setIsCheckedIn(!logs.check_out_time);
        setCheckInTime(logs.check_in_time);
        if (logs.duration_minutes) {
          const hours = Math.floor(logs.duration_minutes / 60);
          const mins = logs.duration_minutes % 60;
          setDuration(`${hours}h ${mins}m`);
        }
      }
    } catch (error) {
      // No log today, employee is not checked in
    }
  }

  async function handleCheckIn() {
    try {
      setLoading(true);

      const { data: emp } = await supabase
        .from('employees')
        .select('id')
        .eq('email', user?.email)
        .single();

      if (!emp) {
        toast.error('Employee not found');
        return;
      }

      const now = new Date().toISOString();

      const { error } = await supabase
        .from('checkin_checkout_logs')
        .insert({
          employee_id: emp.id,
          check_in_time: now,
          location: 'Office',
          device: navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop',
        });

      if (error) throw error;

      setIsCheckedIn(true);
      setCheckInTime(now);
      toast.success('Checked in successfully');
      checkTodayStatus();
    } catch (error) {
      toast.error('Failed to check in');
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckOut() {
    try {
      setLoading(true);

      const { data: emp } = await supabase
        .from('employees')
        .select('id')
        .eq('email', user?.email)
        .single();

      if (!emp) {
        toast.error('Employee not found');
        return;
      }

      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: log } = await supabase
        .from('checkin_checkout_logs')
        .select('*')
        .eq('employee_id', emp.id)
        .gte('check_in_time', `${today}T00:00:00`)
        .lte('check_in_time', `${today}T23:59:59`)
        .single();

      if (!log) {
        toast.error('No check-in record found');
        return;
      }

      const checkOutTime = new Date().toISOString();
      const durationMs = new Date(checkOutTime).getTime() - new Date(log.check_in_time).getTime();
      const durationMinutes = Math.floor(durationMs / 60000);

      const { error } = await supabase
        .from('checkin_checkout_logs')
        .update({
          check_out_time: checkOutTime,
          duration_minutes: durationMinutes,
        })
        .eq('id', log.id);

      if (error) throw error;

      setIsCheckedIn(false);
      const hours = Math.floor(durationMinutes / 60);
      const mins = durationMinutes % 60;
      setDuration(`${hours}h ${mins}m`);
      toast.success('Checked out successfully');
      checkTodayStatus();
    } catch (error) {
      toast.error('Failed to check out');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      {isCheckedIn ? (
        <>
          <div className="text-sm">
            <p className="text-slate-600">Checked in at</p>
            <p className="font-semibold text-slate-900">
              {checkInTime ? format(new Date(checkInTime), 'hh:mm a') : '-'}
            </p>
          </div>
          <button
            onClick={handleCheckOut}
            disabled={loading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Check Out'}
          </button>
        </>
      ) : (
        <button
          onClick={handleCheckIn}
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Check In'}
        </button>
      )}
      {duration && (
        <div className="text-sm text-slate-600">
          Today: <span className="font-semibold">{duration}</span>
        </div>
      )}
    </div>
  );
}
