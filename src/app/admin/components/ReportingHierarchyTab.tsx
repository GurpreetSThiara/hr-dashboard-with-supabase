'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface Employee {
  id: string;
  emp_id: string;
  first_name: string;
  last_name: string;
  email: string;
  designation: string;
  department: string;
  manager: string;
}

export default function ReportingHierarchyTab() {
  const supabase = createClient();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingManager, setEditingManager] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmployees();
  }, []);

  async function fetchEmployees() {
    try {
      setLoading(true);
      const { data } = await supabase
        .from('employees')
        .select('*')
        .eq('status', 'active')
        .order('emp_id', { ascending: true });
      
      setEmployees(data || []);
    } catch (error) {
      toast.error('Failed to fetch employees');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveManager(employeeId: string, newManager: string) {
    try {
      const { error } = await supabase
        .from('employees')
        .update({ manager: newManager || null })
        .eq('id', employeeId);

      if (error) throw error;

      toast.success('Manager updated successfully');
      setEditingId(null);
      fetchEmployees();
    } catch (error) {
      toast.error('Failed to update manager');
    }
  }

  if (loading) return <div className="text-center py-8">Loading employees...</div>;

  const managerOptions = employees.filter(e => e.id !== editingId);

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <p className="font-medium">Org Hierarchy Management</p>
        <p className="text-xs mt-1">Click "Edit" on any employee to reassign their reporting manager. HR Admin and above roles can make changes.</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Employee</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Designation</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Department</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Current Manager</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {employees.map(emp => (
              <React.Fragment key={emp.id}>
                <tr className="hover:bg-slate-50">
                  <td className="px-6 py-3">
                    <div className="font-medium text-slate-900">{emp.first_name} {emp.last_name}</div>
                    <div className="text-xs text-slate-500">{emp.email}</div>
                  </td>
                  <td className="px-6 py-3 text-sm text-slate-700">{emp.designation}</td>
                  <td className="px-6 py-3 text-sm text-slate-700">{emp.department}</td>
                  <td className="px-6 py-3 text-sm text-slate-700">{emp.manager || 'None'}</td>
                  <td className="px-6 py-3 text-right">
                    <button
                      onClick={() => {
                        setEditingId(emp.id);
                        setEditingManager(emp.manager || '');
                      }}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
                {editingId === emp.id && (
                  <tr className="bg-blue-50 border-b border-slate-200">
                    <td colSpan={5} className="px-6 py-4">
                      <div className="space-y-3">
                        <label className="block text-sm font-medium text-slate-700">
                          Select New Manager
                        </label>
                        <select
                          value={editingManager}
                          onChange={(e) => setEditingManager(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">No Manager</option>
                          {managerOptions.map(manager => (
                            <option key={manager.id} value={manager.email}>
                              {manager.first_name} {manager.last_name} ({manager.designation})
                            </option>
                          ))}
                        </select>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveManager(emp.id, editingManager)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-4 py-2 bg-slate-300 text-slate-700 rounded-lg hover:bg-slate-400 text-sm font-medium"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
