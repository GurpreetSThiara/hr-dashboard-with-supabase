'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Icon from '@/components/ui/AppIcon';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import AddEmployeeModal from './AddEmployeeModal';
import EditEmployeeModal from './EditEmployeeModal';
import EmployeeProfileDrawer from './EmployeeProfileDrawer';
import DeleteConfirmModal from './DeleteConfirmModal';

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
  join_date: string;
  status: EmployeeStatus;
  attendance_pct: number;
  salary_band: string;
  location: string;
}

const DEPARTMENTS = ['All', 'Engineering', 'Marketing', 'Sales', 'Finance', 'HR', 'Operations', 'Legal', 'Design'];
const STATUSES = ['All', 'Active', 'On Leave', 'Onboarding', 'Terminated'];
const EMP_TYPES = ['All', 'Full-Time', 'Contractor', 'Intern', 'Part-Time'];
const LOCATIONS = ['All', 'New York', 'London', 'Bangalore', 'Mumbai', 'Stockholm', 'Berlin', 'Tokyo', 'Dubai', 'Warsaw', 'Copenhagen', 'Accra', 'Mexico City', 'Dakar'];

const DEPT_COLORS: Record<string, string> = {
  Engineering: 'bg-blue-100 text-blue-700',
  Marketing: 'bg-pink-100 text-pink-700',
  Sales: 'bg-amber-100 text-amber-700',
  Finance: 'bg-emerald-100 text-emerald-700',
  HR: 'bg-violet-100 text-violet-700',
  Operations: 'bg-orange-100 text-orange-700',
  Legal: 'bg-slate-100 text-slate-700',
  Design: 'bg-cyan-100 text-cyan-700',
};

const AVATAR_COLORS = [
  'bg-blue-600', 'bg-violet-600', 'bg-emerald-600', 'bg-amber-600',
  'bg-pink-600', 'bg-indigo-600', 'bg-teal-600', 'bg-rose-600',
  'bg-cyan-600', 'bg-orange-600',
];

type SortKey = keyof Employee;
type SortDir = 'asc' | 'desc';

function exportToCSV(employees: Employee[]) {
  const headers = ['EMP ID', 'First Name', 'Last Name', 'Email', 'Department', 'Designation', 'Type', 'Status', 'Location', 'Manager', 'Salary Band', 'Join Date', 'Attendance %'];
  const rows = employees.map(e => [
    e.emp_id, e.first_name, e.last_name, e.email, e.department,
    e.designation, e.employment_type, e.status, e.location,
    e.manager, e.salary_band, e.join_date, e.attendance_pct,
  ]);
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `employees-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function EmployeeTableSection() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Filters & sort
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All');
  const [sortKey, setSortKey] = useState<SortKey>('emp_id');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showFilters, setShowFilters] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Selection
  const [selectedRows, setSelectedRows] = useState<string[]>([]);

  // Modals & drawers
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [deletingInProgress, setDeletingInProgress] = useState(false);

  const supabase = createClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;
      supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single()
        .then(({ data }) => setUserRole(data?.role || 'Employee'));
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    supabase
      .from('employees')
      .select('*')
      .order('emp_id', { ascending: true })
      .then(({ data, error }) => {
        if (error) setError('Failed to load employees');
        else setEmployees(data || []);
        setLoading(false);
      });
  }, []);

  // ── Realtime: sync employee rows ──────────────────────────────────────────
  useEffect(() => {
    const ch = supabase
      .channel('emp_table_live')

      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'employees' }, (payload) => {
        const row = payload.new as Employee;
        setEmployees((prev) => {
          if (prev.some((e) => e.id === row.id)) return prev;
          return [...prev, row].sort((a, b) => a.emp_id.localeCompare(b.emp_id));
        });
        toast.success(`New employee added: ${row.first_name} ${row.last_name}`, { duration: 3000 });
      })

      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'employees' }, (payload) => {
        const row = payload.new as Employee;
        setEmployees((prev) => prev.map((e) => (e.id === row.id ? { ...e, ...row } : e)));
      })

      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'employees' }, (payload) => {
        const row = payload.old as { id: string };
        setEmployees((prev) => prev.filter((e) => e.id !== row.id));
      })

      .subscribe();

    channelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, []);

  const canEdit = ['Super Admin', 'Owner', 'Admin', 'HR Admin', 'HR Manager', 'HR Executive', 'Director', 'Manager'].includes(userRole || '');
  const canDelete = ['Super Admin', 'Owner', 'Admin', 'HR Admin'].includes(userRole || '');
  const canAdd = ['Super Admin', 'Owner', 'Admin', 'HR Admin', 'HR Manager', 'Recruiter'].includes(userRole || '');

  const filtered = useMemo(() => employees.filter(emp => {
    const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
    const matchSearch =
      !search ||
      fullName.includes(search.toLowerCase()) ||
      emp.emp_id.toLowerCase().includes(search.toLowerCase()) ||
      emp.email.toLowerCase().includes(search.toLowerCase()) ||
      emp.designation.toLowerCase().includes(search.toLowerCase());
    const matchDept = deptFilter === 'All' || emp.department === deptFilter;
    const matchStatus =
      statusFilter === 'All' ||
      (statusFilter === 'Active' && emp.status === 'active') ||
      (statusFilter === 'On Leave' && emp.status === 'onleave') ||
      (statusFilter === 'Onboarding' && emp.status === 'onboarding') ||
      (statusFilter === 'Terminated' && emp.status === 'terminated');
    const matchType = typeFilter === 'All' || emp.employment_type === typeFilter;
    const matchLocation = locationFilter === 'All' || emp.location === locationFilter;
    return matchSearch && matchDept && matchStatus && matchType && matchLocation;
  }), [search, deptFilter, statusFilter, typeFilter, locationFilter, employees]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === 'string' && typeof bv === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
    return 0;
  }), [filtered, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paginated = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function toggleSort(key: SortKey) {
    setSortKey(prev => {
      if (prev === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
      else { setSortDir('asc'); }
      return key;
    });
    setCurrentPage(1);
  }

  function toggleRow(id: string) {
    setSelectedRows(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  }

  function toggleAll() {
    setSelectedRows(prev => prev.length === paginated.length ? [] : paginated.map(e => e.id));
  }

  async function handleDeleteConfirmed() {
    if (!confirmDelete) return;
    setDeletingInProgress(true);
    try {
      const { error } = await supabase.from('employees').delete().eq('id', confirmDelete.id);
      if (error) throw error;
      setEmployees(prev => prev.filter(e => e.id !== confirmDelete.id));
      setSelectedRows(prev => prev.filter(id => id !== confirmDelete.id));
      toast.success(`${confirmDelete.name} removed from directory`);
      setConfirmDelete(null);
    } catch {
      toast.error('Failed to delete employee');
    } finally {
      setDeletingInProgress(false);
    }
  }

  async function handleBulkStatusChange(newStatus: string) {
    if (!canEdit || !newStatus || selectedRows.length === 0) return;
    try {
      const { error } = await supabase
        .from('employees')
        .update({ status: newStatus })
        .in('id', selectedRows);
      if (error) throw error;
      setEmployees(prev => prev.map(e => selectedRows.includes(e.id) ? { ...e, status: newStatus as EmployeeStatus } : e));
      toast.success(`Status updated for ${selectedRows.length} employee${selectedRows.length > 1 ? 's' : ''}`);
      setSelectedRows([]);
    } catch {
      toast.error('Failed to update status');
    }
  }

  async function handleBulkDelete() {
    if (!canDelete || selectedRows.length === 0) return;
    try {
      const { error } = await supabase.from('employees').delete().in('id', selectedRows);
      if (error) throw error;
      setEmployees(prev => prev.filter(e => !selectedRows.includes(e.id)));
      toast.success(`${selectedRows.length} employees removed`);
      setSelectedRows([]);
    } catch {
      toast.error('Failed to delete employees');
    }
  }

  function getAvatarColor(empId: string) {
    let hash = 0;
    for (let i = 0; i < empId.length; i++) hash = empId.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <Icon name="ChevronUpDownIcon" size={13} className="text-slate-300 ml-1" />;
    return sortDir === 'asc'
      ? <Icon name="ChevronUpIcon" size={13} className="text-blue-600 ml-1" />
      : <Icon name="ChevronDownIcon" size={13} className="text-blue-600 ml-1" />;
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
        <Icon name="ArrowPathIcon" size={28} className="animate-spin mx-auto text-blue-600 mb-3" />
        <p className="text-slate-500 text-sm">Loading employees...</p>
      </div>
    );
  }

  if (error) {
    return <EmptyState icon="ExclamationTriangleIcon" title="Error" description={error} />;
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Toolbar */}
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative flex-1 max-w-sm">
              <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, ID, email, or role..."
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <Icon name="XMarkIcon" size={14} />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters(f => !f)}
              className={`px-3 py-2 border rounded-lg text-sm transition-colors flex items-center gap-2 ${showFilters ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
            >
              <Icon name="FunnelIcon" size={16} />
              Filters
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => exportToCSV(selectedRows.length > 0 ? employees.filter(e => selectedRows.includes(e.id)) : sorted)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2"
              title={selectedRows.length > 0 ? `Export ${selectedRows.length} selected` : 'Export all filtered'}
            >
              <Icon name="ArrowDownTrayIcon" size={16} />
              Export {selectedRows.length > 0 ? `(${selectedRows.length})` : ''}
            </button>
            {canAdd && (
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Icon name="UserPlusIcon" size={16} />
                Add Employee
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="border-b border-slate-200 px-6 py-3 bg-slate-50 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { value: deptFilter, options: DEPARTMENTS, onChange: (v: string) => { setDeptFilter(v); setCurrentPage(1); }, placeholder: 'Department' },
              { value: statusFilter, options: STATUSES, onChange: (v: string) => { setStatusFilter(v); setCurrentPage(1); }, placeholder: 'Status' },
              { value: typeFilter, options: EMP_TYPES, onChange: (v: string) => { setTypeFilter(v); setCurrentPage(1); }, placeholder: 'Type' },
              { value: locationFilter, options: LOCATIONS, onChange: (v: string) => { setLocationFilter(v); setCurrentPage(1); }, placeholder: 'Location' },
            ].map(({ value, options, onChange, placeholder }) => (
              <select
                key={placeholder}
                value={value}
                onChange={e => onChange(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {options.map(o => <option key={o} value={o}>{o === 'All' ? `All ${placeholder}s` : o}</option>)}
              </select>
            ))}
          </div>
        )}

        {/* Bulk action bar */}
        {selectedRows.length > 0 && (
          <div className="border-b border-blue-200 bg-blue-50 px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
            <span className="text-sm font-semibold text-blue-800">
              <Icon name="CheckCircleIcon" size={16} className="inline mr-1.5 text-blue-600" />
              {selectedRows.length} employee{selectedRows.length > 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => exportToCSV(employees.filter(e => selectedRows.includes(e.id)))}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5"
              >
                <Icon name="ArrowDownTrayIcon" size={13} />
                Export Selected
              </button>
              {canEdit && (
                <select
                  defaultValue=""
                  onChange={e => { if (e.target.value) { handleBulkStatusChange(e.target.value); e.target.value = ''; } }}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <option value="" disabled>Change Status…</option>
                  <option value="active">Set Active</option>
                  <option value="onleave">Set On Leave</option>
                  <option value="onboarding">Set Onboarding</option>
                  <option value="terminated">Set Terminated</option>
                </select>
              )}
              {canDelete && (
                <button
                  onClick={handleBulkDelete}
                  className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1.5"
                >
                  <Icon name="TrashIcon" size={13} />
                  Delete Selected
                </button>
              )}
              <button
                onClick={() => setSelectedRows([])}
                className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
              >
                Deselect All
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        {employees.length === 0 ? (
          <EmptyState icon="UsersIcon" title="No Employees" description="No employee records found." />
        ) : (
          <>
            {/* Results summary */}
            {(search || deptFilter !== 'All' || statusFilter !== 'All' || typeFilter !== 'All' || locationFilter !== 'All') && (
              <div className="px-6 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-700">
                Showing <strong>{sorted.length}</strong> of <strong>{employees.length}</strong> employees
                {search && <span> matching <em>"{search}"</em></span>}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="w-10 px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedRows.length === paginated.length && paginated.length > 0}
                        onChange={toggleAll}
                        className="w-4 h-4 rounded border-slate-300 cursor-pointer"
                      />
                    </th>
                    {[
                      { key: 'emp_id', label: 'ID' },
                      { key: 'first_name', label: 'Employee' },
                      { key: 'department', label: 'Department' },
                      { key: 'designation', label: 'Designation' },
                      { key: 'status', label: 'Status' },
                      { key: 'attendance_pct', label: 'Attendance' },
                    ].map(({ key, label }) => (
                      <th
                        key={key}
                        className="px-6 py-3 text-left text-slate-700 font-semibold cursor-pointer hover:bg-slate-100 transition-colors select-none"
                        onClick={() => toggleSort(key as SortKey)}
                      >
                        <div className="flex items-center">
                          {label}
                          <SortIcon col={key as SortKey} />
                        </div>
                      </th>
                    ))}
                    <th className="px-6 py-3 text-right text-slate-700 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginated.map(emp => (
                    <tr
                      key={emp.id}
                      className={`hover:bg-slate-50 transition-colors ${selectedRows.includes(emp.id) ? 'bg-blue-50/40' : ''}`}
                    >
                      <td className="w-10 px-6 py-3">
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(emp.id)}
                          onChange={() => toggleRow(emp.id)}
                          className="w-4 h-4 rounded border-slate-300 cursor-pointer"
                        />
                      </td>
                      <td className="px-6 py-3 text-slate-500 font-mono text-xs">{emp.emp_id}</td>
                      <td className="px-6 py-3">
                        <div
                          className="flex items-center gap-3 cursor-pointer group"
                          onClick={() => setViewingEmployee(emp)}
                        >
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${getAvatarColor(emp.emp_id)}`}>
                            {emp.first_name[0]}{emp.last_name[0]}
                          </div>
                          <div>
                            <div className="text-slate-900 font-semibold group-hover:text-blue-600 transition-colors text-sm">
                              {emp.first_name} {emp.last_name}
                            </div>
                            <div className="text-xs text-slate-400">{emp.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${DEPT_COLORS[emp.department] || 'bg-slate-100 text-slate-600'}`}>
                          {emp.department}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-slate-600 text-sm">{emp.designation}</td>
                      <td className="px-6 py-3">
                        <StatusBadge status={emp.status} />
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2 w-24">
                          <div className="flex-1 bg-slate-200 rounded-full h-1.5">
                            <div
                              className={`h-full rounded-full transition-all ${emp.attendance_pct >= 90 ? 'bg-emerald-500' : emp.attendance_pct >= 75 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${emp.attendance_pct}%` }}
                            />
                          </div>
                          <span className="text-slate-700 font-semibold text-xs w-8 text-right">{emp.attendance_pct}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setViewingEmployee(emp)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            title="View Profile"
                          >
                            <Icon name="EyeIcon" size={15} />
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => setEditingEmployee(emp)}
                              className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit Employee"
                            >
                              <Icon name="PencilIcon" size={15} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => setConfirmDelete({ id: emp.id, name: `${emp.first_name} ${emp.last_name}` })}
                              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Employee"
                            >
                              <Icon name="TrashIcon" size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">Show</span>
                <select
                  value={pageSize}
                  onChange={e => { setPageSize(parseInt(e.target.value)); setCurrentPage(1); }}
                  className="px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none"
                >
                  {[10, 25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
                </select>
                <span className="text-sm text-slate-500">
                  of <strong>{sorted.length}</strong> employees
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-600 px-1">
                  {currentPage} / {totalPages || 1}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modals & Drawers */}
      <AddEmployeeModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          supabase.from('employees').select('*').order('emp_id', { ascending: true }).then(({ data }) => setEmployees(data || []));
        }}
      />

      <EditEmployeeModal
        isOpen={editingEmployee !== null}
        employee={editingEmployee}
        onClose={() => setEditingEmployee(null)}
        onSuccess={updated => {
          setEmployees(prev => prev.map(e => e.id === updated.id ? updated : e));
          setEditingEmployee(null);
          if (viewingEmployee?.id === updated.id) setViewingEmployee(updated);
        }}
      />

      <EmployeeProfileDrawer
        employee={viewingEmployee}
        onClose={() => setViewingEmployee(null)}
        onEdit={emp => {
          setViewingEmployee(null);
          setEditingEmployee(emp);
        }}
        canEdit={canEdit}
      />

      <DeleteConfirmModal
        isOpen={confirmDelete !== null}
        employeeName={confirmDelete?.name || ''}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setConfirmDelete(null)}
        loading={deletingInProgress}
      />
    </>
  );
}
