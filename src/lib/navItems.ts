import type { Permission } from '@/lib/useRoleBasedAccess';

export interface NavItemWithRole {
  id: string;
  label: string;
  icon: string;
  href: string;
  badge?: number;
  section?: string;
  requiredPermission?: Permission;
}

/** Single source of truth for primary navigation (sidebar + mobile drawer + bottom nav). */
export const NAV_ITEMS: NavItemWithRole[] = [
  { id: 'nav-my-dashboard', label: 'My Dashboard',     icon: 'UserIcon',           href: '/my-dashboard',         section: 'OVERVIEW' },
  { id: 'nav-hr-dashboard', label: 'HR Dashboard',     icon: 'ChartBarSquareIcon', href: '/hr-dashboard',         section: 'OVERVIEW',   requiredPermission: 'view_hr_dashboard' },
  { id: 'nav-team',         label: 'Team',             icon: 'UsersIcon',          href: '/employee-management',  section: 'PEOPLE',     requiredPermission: 'view_employees' },
  { id: 'nav-organization', label: 'Organization',     icon: 'BuildingOffice2Icon',href: '/organization',         section: 'PEOPLE',     requiredPermission: 'view_dashboard' },
  { id: 'nav-leave',        label: 'Leave & Attendance',icon: 'CalendarDaysIcon',  href: '/leave-attendance',     section: 'OPERATIONS', requiredPermission: 'view_leaves' },
  { id: 'nav-admin',        label: 'Admin Management', icon: 'Cog6ToothIcon',      href: '/admin',                section: 'SYSTEM',     requiredPermission: 'admin_panel' },
];

export const SECTIONS = ['OVERVIEW', 'PEOPLE', 'OPERATIONS', 'SYSTEM'];
