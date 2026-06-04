'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

type EmployeeStatus = 'active' | 'onleave' | 'onboarding' | 'terminated';
type EmploymentType = 'Full-Time' | 'Part-Time' | 'Contractor' | 'Intern';

interface Employee {
  id: string;
  emp_id: string;
  first_name: string;
  last_name: string;
  email: string;
  department: string;
  designation: string;
  employment_type: EmploymentType;
  manager: string;
  status: EmployeeStatus;
  location: string;
  salary_band: string;
  join_date: string;
  attendance_pct: number;
}

interface EditEmployeeData {
  first_name: string;
  last_name: string;
  email: string;
  department: string;
  designation: string;
  employment_type: string;
  manager: string;
  status: string;
  location: string;
  salary_band: string;
  join_date: string;
}

interface Props {
  isOpen: boolean;
  employee: Employee | null;
  onClose: () => void;
  onSuccess: (updated: Employee) => void;
}

const DEPARTMENTS = ['Engineering', 'Marketing', 'Sales', 'Finance', 'HR', 'Operations', 'Legal', 'Design'];
const EMP_TYPES = ['Full-Time', 'Part-Time', 'Contractor', 'Intern'];
const STATUSES: { value: string; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'onleave', label: 'On Leave' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'terminated', label: 'Terminated' },
];
const SALARY_BANDS = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'];
const LOCATIONS = ['New York', 'London', 'Bangalore', 'Mumbai', 'Stockholm', 'Berlin', 'Tokyo', 'Dubai', 'Warsaw', 'Copenhagen', 'Accra', 'Mexico City', 'Dakar'];

export default function EditEmployeeModal({ isOpen, employee, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [managers, setManagers] = useState<{ id: string; name: string }[]>([]);
  const supabase = createClient();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<EditEmployeeData>();

  useEffect(() => {
    if (!isOpen) return;
    supabase
      .from('employees')
      .select('id, first_name, last_name')
      .neq('status', 'terminated')
      .order('first_name')
      .then(({ data }) => {
        if (data) setManagers(data.map(e => ({ id: e.id, name: `${e.first_name} ${e.last_name}` })));
      });
  }, [isOpen]);

  useEffect(() => {
    if (employee) {
      reset({
        first_name: employee.first_name,
        last_name: employee.last_name,
        email: employee.email,
        department: employee.department,
        designation: employee.designation,
        employment_type: employee.employment_type,
        manager: employee.manager || '',
        status: employee.status,
        location: employee.location,
        salary_band: employee.salary_band,
        join_date: employee.join_date,
      });
    }
  }, [employee, reset]);

  async function onSubmit(data: EditEmployeeData) {
    if (!employee) return;
    setLoading(true);
    try {
      // Update via the secured, audited API (authorization + field-level
      // permissions + change history enforced server-side).
      const res = await fetch(`/api/employees/${employee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const updated = await res.json();
      if (!res.ok) throw new Error(updated.error || 'Failed to update employee');

      toast.success(`${data.first_name} ${data.last_name} updated successfully!`);
      onClose();
      onSuccess(updated as Employee);
    } catch (e: any) {
      toast.error(e.message || 'Failed to update employee');
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen || !employee) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl border border-slate-200 max-w-2xl w-full my-8 shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Icon name="PencilSquareIcon" size={20} className="text-blue-600" />
            Edit Employee
            <span className="text-sm font-normal text-slate-400 ml-1">— {employee.emp_id}</span>
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <Icon name="XMarkIcon" size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5 max-h-[calc(100vh-200px)] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">First Name *</label>
              <input type="text" className="input-field" {...register('first_name', { required: 'Required' })} />
              {errors.first_name && <p className="text-xs text-red-600 mt-1">{errors.first_name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Last Name *</label>
              <input type="text" className="input-field" {...register('last_name', { required: 'Required' })} />
              {errors.last_name && <p className="text-xs text-red-600 mt-1">{errors.last_name.message}</p>}
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Work Email *</label>
              <input type="email" className="input-field" {...register('email', { required: 'Required' })} />
              {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Department</label>
              <select className="input-field" {...register('department')}>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Designation</label>
              <input type="text" className="input-field" placeholder="Senior Engineer" {...register('designation')} />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Employment Type</label>
              <select className="input-field" {...register('employment_type')}>
                {EMP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Status</label>
              <select className="input-field" {...register('status')}>
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Manager</label>
              <select className="input-field" {...register('manager')}>
                <option value="">— No Manager —</option>
                {managers
                  .filter(m => m.id !== employee.id)
                  .map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Location</label>
              <select className="input-field" {...register('location')}>
                {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Salary Band</label>
              <select className="input-field" {...register('salary_band')}>
                {SALARY_BANDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Join Date</label>
              <input type="date" className="input-field" {...register('join_date')} />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-slate-200">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <Icon name="ArrowPathIcon" size={16} className="animate-spin" />}
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
