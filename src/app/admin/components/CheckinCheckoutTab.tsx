'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { RealtimeChannel } from '@supabase/supabase-js';
import ResponsiveTable from '@/components/ui/ResponsiveTable';

interface CheckinLog {
  id: string;
  employee_id: string;
  check_in_time: string;
  check_out_time: string | null;
  duration_minutes: number | null;
  location: string;
  device: string;
  created_at: string;
}

interface Employee {
  id: string;
  emp_id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
}

export default function CheckinCheckoutTab() {
  const supabase = createClient();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [logs, setLogs] = useState<CheckinLog[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    fetchEmployees();
  }, []);

  async function fetchEmployees() {
    try {
      const { data } = await supabase
        .from('employees')
        .select('*')
        .eq('status', 'active')
        .order('first_name', { ascending: true });
      setEmployees(data || []);
    } catch {
      toast.error('Failed to fetch employees');
    }
  }

  useEffect(() => {
    if (selectedEmployeeId) {
      fetchLogs();
      subscribeToLogs(selectedEmployeeId);
    } else {
      setLogs([]);
      cleanupChannel();
    }

    return () => cleanupChannel();
  }, [selectedEmployeeId]);

  function cleanupChannel() {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      setIsLive(false);
    }
  }

  async function fetchLogs() {
    try {
      setLoading(true);
      const { data } = await supabase
        .from('checkin_checkout_logs')
        .select('*')
        .eq('employee_id', selectedEmployeeId)
        .order('created_at', { ascending: false })
        .limit(30);
      setLogs(data || []);
    } catch {
      toast.error('Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  }

  function subscribeToLogs(empId: string) {
    cleanupChannel();

    const ch = supabase
      .channel(`checkin_logs_${empId}`)

      // New check-in → prepend to list
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'checkin_checkout_logs' },
        (payload) => {
          const row = payload.new as CheckinLog;
          if (row.employee_id !== empId) return;
          setLogs((prev) => {
            if (prev.some((l) => l.id === row.id)) return prev;
            return [row, ...prev.slice(0, 29)]; // keep max 30
          });
          toast.info('New check-in recorded', { duration: 2500 });
        }
      )

      // Check-out updated → update row in place
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'checkin_checkout_logs' },
        (payload) => {
          const row = payload.new as CheckinLog;
          if (row.employee_id !== empId) return;
          setLogs((prev) => prev.map((l) => (l.id === row.id ? { ...l, ...row } : l)));
        }
      )

      .subscribe((status) => setIsLive(status === 'SUBSCRIBED'));

    channelRef.current = ch;
  }

  function formatTime(dateString: string) {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString();
  }

  function formatDuration(minutes: number | null) {
    if (!minutes) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }

  return (
    <div className="space-y-6">
      {/* Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Select Employee</label>
          <select
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Choose employee...</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.first_name} {emp.last_name} ({emp.emp_id})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Table */}
      {selectedEmployeeId && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Check-in/Out Logs</h2>
            <span className={`flex items-center gap-1.5 text-xs font-semibold ${isLive ? 'text-emerald-600' : 'text-slate-400'}`}>
              <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
              {isLive ? 'Live — updates as events occur' : 'Connecting…'}
            </span>
          </div>

          {loading ? (
            <div className="px-4 sm:px-6 py-6 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-11 bg-slate-100 rounded-lg animate-pulse" />)}
            </div>
          ) : (
            <div className="p-3 sm:p-0">
            <ResponsiveTable
              rows={logs}
              keyOf={(l) => l.id}
              emptyText="No check-in/out records found"
              columns={[
                { key: 'date', header: 'Date', primary: true, render: (l) => formatDate(l.check_in_time) },
                { key: 'in', header: 'Check-in', render: (l) => <span className="font-medium text-slate-900">{formatTime(l.check_in_time)}</span> },
                { key: 'out', header: 'Check-out', render: (l) => l.check_out_time ? formatTime(l.check_out_time) : (
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
                  </span>
                )},
                { key: 'dur', header: 'Duration', render: (l) => formatDuration(l.duration_minutes) },
                { key: 'loc', header: 'Location', render: (l) => l.location || '-' },
                { key: 'dev', header: 'Device', render: (l) => l.device || '-' },
              ]}
            />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
