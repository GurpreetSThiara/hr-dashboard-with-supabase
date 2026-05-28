import React from 'react';
import AppLayout from '@/components/AppLayout';
import EmployeeSummaryCards from './components/EmployeeSummaryCards';
import EmployeeTableSection from './components/EmployeeTableSection';

export default function EmployeeManagementPage() {
  return (
    <AppLayout pageTitle="Employee Management" breadcrumb="People" requiredPermission="view_employees">
      <EmployeeSummaryCards />
      <div className="mt-6">
        <EmployeeTableSection />
      </div>
    </AppLayout>
  );
}