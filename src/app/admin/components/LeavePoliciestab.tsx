'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface LeaveType {
  id: string;
  name: string;
  color: string;
  description: string;
}

interface LeavePolicy {
  id: string;
  leave_type_id: string;
  leave_type_name: string;
  days_per_year: number;
  carry_forward_allowed: boolean;
  max_carry_forward: number;
}

export default function LeavePoliciestab() {
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    leave_type_id: '',
    leave_type_name: '',
    days_per_year: 0,
    carry_forward_allowed: true,
    max_carry_forward: 0,
  });

  useEffect(() => {
    fetchPolicies();
  }, []);

  async function fetchPolicies() {
    try {
      setLoading(true);
      const response = await fetch('/api/leave-policies?includeTypes=true');
      const data = await response.json();
      setPolicies(data.policies || []);
      setTypes(data.types || []);
    } catch (error) {
      toast.error('Failed to fetch policies');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!formData.leave_type_id || !formData.days_per_year) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      const response = await fetch('/api/leave-policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to save policy');

      toast.success('Policy saved successfully');
      setEditingId(null);
      setFormData({
        leave_type_id: '',
        leave_type_name: '',
        days_per_year: 0,
        carry_forward_allowed: true,
        max_carry_forward: 0,
      });
      fetchPolicies();
    } catch (error) {
      toast.error('Error saving policy');
    }
  }

  function handleEdit(policy: LeavePolicy) {
    setEditingId(policy.id);
    setFormData({
      leave_type_id: policy.leave_type_id,
      leave_type_name: policy.leave_type_name,
      days_per_year: policy.days_per_year,
      carry_forward_allowed: policy.carry_forward_allowed,
      max_carry_forward: policy.max_carry_forward,
    });
  }

  function handleTypeChange(typeId: string) {
    const selectedType = types.find(t => t.id === typeId);
    if (selectedType) {
      setFormData({
        ...formData,
        leave_type_id: typeId,
        leave_type_name: selectedType.name,
      });
    }
  }

  if (loading) return <div className="text-center py-8">Loading policies...</div>;

  return (
    <div className="space-y-6">
      {/* Form Section */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Create/Edit Leave Policy</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Leave Type</label>
            <select
              value={formData.leave_type_id}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select Leave Type</option>
              {types.map(type => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Days Per Year</label>
            <input
              type="number"
              value={formData.days_per_year}
              onChange={(e) => setFormData({ ...formData, days_per_year: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              min="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Max Carry Forward</label>
            <input
              type="number"
              value={formData.max_carry_forward}
              onChange={(e) => setFormData({ ...formData, max_carry_forward: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              min="0"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.carry_forward_allowed}
                onChange={(e) => setFormData({ ...formData, carry_forward_allowed: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm font-medium text-slate-700">Allow Carry Forward</span>
            </label>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Save Policy
          </button>
          {editingId && (
            <button
              onClick={() => {
                setEditingId(null);
                setFormData({
                  leave_type_id: '',
                  leave_type_name: '',
                  days_per_year: 0,
                  carry_forward_allowed: true,
                  max_carry_forward: 0,
                });
              }}
              className="px-4 py-2 bg-slate-300 text-slate-700 rounded-lg hover:bg-slate-400"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Policies Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Leave Type</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Days/Year</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Carry Forward</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Max Carry</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {policies.map(policy => (
              <tr key={policy.id} className="hover:bg-slate-50">
                <td className="px-6 py-3 text-sm font-medium text-slate-900">{policy.leave_type_name}</td>
                <td className="px-6 py-3 text-sm text-slate-700">{policy.days_per_year} days</td>
                <td className="px-6 py-3 text-sm">{policy.carry_forward_allowed ? 'Yes' : 'No'}</td>
                <td className="px-6 py-3 text-sm text-slate-700">{policy.max_carry_forward} days</td>
                <td className="px-6 py-3 text-right">
                  <button
                    onClick={() => handleEdit(policy)}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
