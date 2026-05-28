'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

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
    } catch (error) {
      toast.error('Failed to fetch employees');
    }
  }

  useEffect(() => {
    if (selectedEmployeeId) {
      fetchLogs();
    }
  }, [selectedEmployeeId]);

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
    } catch (error) {
      toast.error('Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  }

  function formatTime(dateString: string) {
    return new Date(dateString).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
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
      {/* Selection and Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Select Employee</label>
          <select
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Choose employee...</option>
            {employees.map(emp => (
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
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold">Check-in/Out Logs</h2>
          </div>
          
          {loading ? (
            <div className="px-6 py-8 text-center text-slate-500">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="px-6 py-8 text-center text-slate-500">No check-in/out records found</div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Date</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Check-in</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Check-out</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Duration</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Location</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Device</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3 text-sm text-slate-700">{formatDate(log.check_in_time)}</td>
                    <td className="px-6 py-3 text-sm font-medium text-slate-900">{formatTime(log.check_in_time)}</td>
                    <td className="px-6 py-3 text-sm text-slate-700">{log.check_out_time ? formatTime(log.check_out_time) : '-'}</td>
                    <td className="px-6 py-3 text-sm text-slate-700">{formatDuration(log.duration_minutes)}</td>
                    <td className="px-6 py-3 text-sm text-slate-700">{log.location || '-'}</td>
                    <td className="px-6 py-3 text-sm text-slate-700">{log.device || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
