'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { useRoleBasedAccess, Permission } from '@/lib/useRoleBasedAccess';
import { useAuth } from '@/contexts/AuthContext';

interface NavItem {
  id: string;
  label: string;
  icon: string;
  href: string;
  badge?: number;
  section?: string;
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface NavItemWithRole extends NavItem {
  requiredPermission?: Permission;
}

const NAV_ITEMS: NavItemWithRole[] = [
  { id: 'nav-dashboard', label: 'HR Dashboard',       icon: 'ChartBarSquareIcon', href: '/hr-dashboard',         section: 'OVERVIEW',   requiredPermission: 'view_dashboard'  },
  { id: 'nav-employees', label: 'Employees',          icon: 'UsersIcon',          href: '/employee-management',  section: 'PEOPLE',     requiredPermission: 'view_employees'  },
  { id: 'nav-leave',     label: 'Leave & Attendance', icon: 'CalendarDaysIcon',   href: '/leave-attendance',     section: 'OPERATIONS', requiredPermission: 'view_leaves'     },
  { id: 'nav-admin',     label: 'Admin Management',   icon: 'Cog6ToothIcon',      href: '/admin',                section: 'SYSTEM',     requiredPermission: 'admin_panel'     },
  
  // COMMENTED OUT FOR FUTURE USE
  // { id: 'nav-onboarding', label: 'Onboarding', icon: 'ClipboardDocumentCheckIcon', href: '/hr-dashboard', badge: 5, section: 'PEOPLE', requiredTier: 7 },
  // { id: 'nav-recruitment', label: 'Recruitment', icon: 'BriefcaseIcon', href: '/hr-dashboard', badge: 12, section: 'PEOPLE', requiredTier: 7 },
  // { id: 'nav-payroll', label: 'Payroll', icon: 'BanknotesIcon', href: '/hr-dashboard', section: 'OPERATIONS', requiredTier: 9 },
  // { id: 'nav-performance', label: 'Performance', icon: 'StarIcon', href: '/hr-dashboard', section: 'OPERATIONS', requiredTier: 7 },
  // { id: 'nav-calendar', label: 'Company Calendar', icon: 'CalendarIcon', href: '/hr-dashboard', section: 'COMPANY', requiredTier: 18 },
  // { id: 'nav-policies', label: 'Policies', icon: 'DocumentTextIcon', href: '/hr-dashboard', badge: 2, section: 'COMPANY', requiredTier: 7 },
  // { id: 'nav-terms', label: 'Terms & Conditions', icon: 'ScaleIcon', href: '/hr-dashboard', section: 'COMPANY', requiredTier: 7 },
  // { id: 'nav-reports', label: 'Reports & Analytics', icon: 'ChartPieIcon', href: '/hr-dashboard', section: 'COMPLIANCE', requiredTier: 11 },
  // { id: 'nav-compliance', label: 'Compliance', icon: 'ShieldCheckIcon', href: '/hr-dashboard', badge: 1, section: 'COMPLIANCE', requiredTier: 10 },
  // { id: 'nav-settings', label: 'Settings', icon: 'Cog6ToothIcon', href: '/hr-dashboard', section: 'SYSTEM', requiredTier: 15 },
];

const SECTIONS = ['OVERVIEW', 'PEOPLE', 'OPERATIONS', 'SYSTEM'];
// REMOVED: 'COMPANY', 'COMPLIANCE' (for future features)

const AVATAR_COLORS = [
  'bg-blue-600', 'bg-violet-600', 'bg-emerald-600', 'bg-amber-600',
  'bg-pink-600', 'bg-indigo-600', 'bg-teal-600', 'bg-rose-600',
];

function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = seed.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function getInitials(name: string | null | undefined, email: string) {
  if (name) {
    const parts = name.trim().split(' ');
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || (email[0] || '?').toUpperCase();
  }
  return (email[0] || '?').toUpperCase();
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const { hasPermission } = useRoleBasedAccess();
  const { profile, user, role } = useAuth();

  const visibleItems = NAV_ITEMS.filter(item =>
    !item.requiredPermission || hasPermission(item.requiredPermission)
  ).map(item => {
    if (item.id === 'nav-dashboard') {
      return {
        ...item,
        label: hasPermission('view_hr_dashboard') ? 'HR Dashboard' : 'My Dashboard',
      };
    }
    return item;
  });

  const userEmail = profile?.email || user?.email || '';
  const userName = profile?.full_name || (userEmail ? userEmail.split('@')[0] : 'User');
  const initials = getInitials(profile?.full_name, userEmail);
  const profileAvatarColor = userEmail ? avatarColor(userEmail) : 'bg-blue-600';

  return (
    <aside
      className="flex flex-col h-full transition-all duration-300 ease-in-out"
      style={{
        width: collapsed ? '64px' : '240px',
        background: 'hsl(222 47% 11%)',
        boxShadow: '2px 0 8px 0 rgb(0 0 0 / 0.12)',
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div className={`flex items-center h-16 border-b border-white/10 ${collapsed ? 'justify-center px-0' : 'px-4 gap-3'}`}>
        <div className="flex-shrink-0">
          <AppLogo size={32} />
        </div>
        {!collapsed && (
          <span className="font-bold text-white text-lg tracking-tight whitespace-nowrap overflow-hidden">
            HRCore
          </span>
        )}
      </div>

      {/* Nav Items */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 scrollbar-thin">
        {SECTIONS.map((section) => {
          const items = visibleItems.filter((i) => i.section === section);
          if (items.length === 0) return null;
          return (
            <div key={`section-${section}`} className="mb-1">
              {!collapsed && (
                <p className="px-4 pt-3 pb-1 text-xs font-semibold tracking-widest text-slate-500 uppercase">
                  {section}
                </p>
              )}
              {collapsed && <div className="mx-3 my-1 border-t border-white/10" />}
              {items.map((item) => {
                const isActive = pathname === item.href && item.href !== '/hr-dashboard' 
                  ? pathname === item.href 
                  : pathname === item.href;
                const exactActive = pathname === item.href;
                return (
                  <div
                    key={item.id}
                    className="relative px-2"
                    onMouseEnter={() => setHoveredItem(item.id)}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <Link
                      href={item.href}
                      className={`sidebar-nav-item ${exactActive ? 'active' : ''} ${collapsed ? 'justify-center' : ''}`}
                    >
                      <Icon
                        name={item.icon as Parameters<typeof Icon>[0]['name']}
                        size={18}
                        className="flex-shrink-0"
                      />
                      {!collapsed && (
                        <span className="flex-1 truncate text-sm">{item.label}</span>
                      )}
                      {!collapsed && item.badge && item.badge > 0 && (
                        <span className="ml-auto flex-shrink-0 bg-blue-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                          {item.badge}
                        </span>
                      )}
                      {collapsed && item.badge && item.badge > 0 && (
                        <span className="absolute top-1 right-2 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                          {item.badge > 9 ? '9+' : item.badge}
                        </span>
                      )}
                    </Link>
                    {/* Tooltip on collapsed */}
                    {collapsed && hoveredItem === item.id && (
                      <div
                        className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 pointer-events-none"
                        style={{ animation: 'fadeIn 0.15s ease-out' }}
                      >
                        <div className="bg-slate-900 text-white text-xs font-medium px-2.5 py-1.5 rounded-md shadow-dropdown whitespace-nowrap">
                          {item.label}
                          {item.badge ? ` (${item.badge})` : ''}
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-slate-900 rotate-45" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className={`border-t border-white/10 p-3 ${collapsed ? 'flex justify-center' : ''}`}>
        {collapsed ? (
          <div
            className={`w-8 h-8 rounded-full ${profileAvatarColor} flex items-center justify-center text-white text-xs font-bold cursor-pointer`}
            title={`${userName} · ${role}`}
          >
            {initials}
          </div>
        ) : (
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
            <div className={`w-8 h-8 rounded-full ${profileAvatarColor} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{userName}</p>
              <p className="text-xs text-slate-400 truncate">{role}</p>
            </div>
            <Icon name="EllipsisVerticalIcon" size={16} className="text-slate-400 flex-shrink-0" />
          </div>
        )}
      </div>

      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="flex items-center justify-center h-10 border-t border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <Icon
          name={collapsed ? 'ChevronRightIcon' : 'ChevronLeftIcon'}
          size={16}
        />
      </button>
    </aside>
  );
}
