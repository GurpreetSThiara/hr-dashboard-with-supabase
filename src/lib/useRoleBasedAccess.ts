import { useAuth } from '@/contexts/AuthContext';

export type Permission =
  | 'view_dashboard'
  | 'view_employees'
  | 'manage_employees'
  | 'view_leaves'
  | 'approve_leaves'
  | 'manage_policies'
  | 'view_attendance'
  | 'manage_attendance'
  | 'view_hierarchy'
  | 'manage_hierarchy'
  | 'admin_panel';

// Role tier definitions (lower number = higher privilege)
export const ROLE_TIERS: Record<string, number> = {
  'Super Admin': 1, 'Owner': 2, 'Admin': 3, 'HR Admin': 4, 'HR Manager': 5,
  'HR Executive': 6, 'Recruiter': 7, 'Payroll Manager': 8, 'Finance': 9,
  'Compliance': 10, 'IT Ops': 11, 'Director': 12, 'Manager': 13,
  'Team Lead': 14, 'Employee': 15, 'Contractor': 16, 'Intern': 17, 'Read-Only User': 18,
};

// Hardcoded defaults — used when the DB has no custom config or is unreachable
const DEFAULT_PERMISSIONS: Record<Permission, number[]> = {
  view_dashboard:    [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18],
  view_employees:    [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
  manage_employees:  [1,2,3,4,5,6,7],
  view_leaves:       [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18],
  approve_leaves:    [1,2,3,4,5,6,12,13],
  manage_policies:   [1,2],
  view_attendance:   [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
  manage_attendance: [1,2,3,4,5],
  view_hierarchy:    [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
  manage_hierarchy:  [1,2,3,4],
  admin_panel:       [1,2],
};

export function useRoleBasedAccess() {
  const { role, tier, customPermissions } = useAuth();

  // Use DB-loaded permissions if available, else fall back to hardcoded defaults
  const activePermissions: Record<string, number[]> = customPermissions || DEFAULT_PERMISSIONS;

  function hasPermission(permission: Permission): boolean {
    if (!tier) return false;
    const allowedTiers = activePermissions[permission];
    if (!allowedTiers) return false;
    return allowedTiers.includes(tier);
  }

  function canViewTab(tabName: string): boolean {
    const tabPermissions: Record<string, Permission> = {
      dashboard:  'view_dashboard',
      employees:  'view_employees',
      leaves:     'view_leaves',
      attendance: 'view_attendance',
      admin:      'admin_panel',
      hierarchy:  'view_hierarchy',
    };
    const permission = tabPermissions[tabName];
    return permission ? hasPermission(permission) : false;
  }

  function canEditData(dataType: string): boolean {
    const editPermissions: Record<string, Permission> = {
      employee:   'manage_employees',
      leave:      'approve_leaves',
      policy:     'manage_policies',
      attendance: 'manage_attendance',
      hierarchy:  'manage_hierarchy',
    };
    const permission = editPermissions[dataType];
    return permission ? hasPermission(permission) : false;
  }

  return {
    role,
    tier,
    hasPermission,
    canViewTab,
    canEditData,
    isUsingCustomPermissions: customPermissions !== null,
  };
}
