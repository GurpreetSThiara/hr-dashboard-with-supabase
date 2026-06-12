import type { Permission } from '@/lib/useRoleBasedAccess';

/** Plan-gated module a nav item belongs to (matches `modules.code`). Items
 * without a module (e.g. My Dashboard) are always available. */
export type ModuleCode =
  | 'employees' | 'leave' | 'attendance' | 'time_tracking'
  | 'analytics' | 'organization' | 'admin';

export interface NavItemWithRole {
  id: string;
  label: string;
  icon: string;
  href: string;
  badge?: number;
  section?: string;
  requiredPermission?: Permission;
  /** If set, the item is shown only when the org's plan enables this module. */
  module?: ModuleCode;
}

/** Single source of truth for primary navigation (sidebar + mobile drawer + bottom nav). */
export const NAV_ITEMS: NavItemWithRole[] = [
  { id: 'nav-my-dashboard', label: 'My Dashboard',     icon: 'UserIcon',           href: '/my-dashboard',         section: 'OVERVIEW' },
  { id: 'nav-hr-dashboard', label: 'HR Dashboard',     icon: 'ChartBarSquareIcon', href: '/hr-dashboard',         section: 'OVERVIEW',   requiredPermission: 'view_hr_dashboard', module: 'analytics' },
  { id: 'nav-team',         label: 'Team',             icon: 'UsersIcon',          href: '/employee-management',  section: 'PEOPLE',     requiredPermission: 'view_employees',    module: 'employees' },
  { id: 'nav-organization', label: 'Organization',     icon: 'BuildingOffice2Icon',href: '/organization',         section: 'PEOPLE',     requiredPermission: 'view_dashboard',    module: 'organization' },
  { id: 'nav-workspace',    label: 'Workspace',        icon: 'Squares2X2Icon',     href: '/workspace',            section: 'PEOPLE' },
  { id: 'nav-leave',        label: 'Leave & Attendance',icon: 'CalendarDaysIcon',  href: '/leave-attendance',     section: 'OPERATIONS', requiredPermission: 'view_leaves',       module: 'leave' },
  { id: 'nav-time',         label: 'Time Tracking',    icon: 'ClockIcon',          href: '/time-tracking',        section: 'OPERATIONS', requiredPermission: 'view_time_tracking',module: 'time_tracking' },
  { id: 'nav-admin',        label: 'Admin Management', icon: 'Cog6ToothIcon',      href: '/admin',                section: 'SYSTEM',     requiredPermission: 'admin_panel',       module: 'admin' },
];

export const SECTIONS = ['OVERVIEW', 'PEOPLE', 'OPERATIONS', 'SYSTEM'];
