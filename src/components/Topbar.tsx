'use client';

import React, { useState, useRef, useEffect } from 'react';

import Icon from '@/components/ui/AppIcon';
// import CheckinCheckoutButton from '@/components/CheckinCheckoutButton'; // Commented out

interface Notification {
  id: string;
  type: 'leave' | 'payroll' | 'compliance' | 'onboarding' | 'policy';
  title: string;
  message: string;
  time: string;
  read: boolean;
}

// TODO: Replace with real notifications from database
// COMMENTED OUT - Mock notifications (feature not implemented yet)
const MOCK_NOTIFICATIONS: Notification[] = [
  // { id: 'notif-001', type: 'leave', title: 'Leave Request Pending', message: 'Marcus Chen requested 3 days annual leave starting Apr 28', time: '12m ago', read: false },
  // { id: 'notif-002', type: 'compliance', title: 'Compliance Deadline', message: 'Q1 statutory filing due in 3 days — Apr 26, 2026', time: '1h ago', read: false },
  // { id: 'notif-003', type: 'onboarding', title: 'Onboarding Incomplete', message: 'Priya Sharma (EMP-0214) has 4 pending onboarding tasks', time: '2h ago', read: false },
  // { id: 'notif-004', type: 'payroll', title: 'Payroll Cycle Open', message: 'April 2026 payroll run is ready for review and approval', time: '4h ago', read: true },
  // { id: 'notif-005', type: 'policy', title: 'Policy Acknowledgement', message: '23 employees have not acknowledged the updated IT Security Policy', time: '1d ago', read: true },
];

const notifTypeColors: Record<string, string> = {
  leave: 'bg-amber-100 text-amber-600',
  payroll: 'bg-emerald-100 text-emerald-600',
  compliance: 'bg-red-100 text-red-600',
  onboarding: 'bg-blue-100 text-blue-600',
  policy: 'bg-violet-100 text-violet-600',
};

const notifTypeIcons: Record<string, string> = {
  leave: 'CalendarDaysIcon',
  payroll: 'BanknotesIcon',
  compliance: 'ShieldExclamationIcon',
  onboarding: 'ClipboardDocumentCheckIcon',
  policy: 'DocumentTextIcon',
};

interface TopbarProps {
  pageTitle: string;
  breadcrumb?: string;
}

export default function Topbar({ pageTitle, breadcrumb }: TopbarProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const [searchValue, setSearchValue] = useState('');
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0 z-30">
      {/* Left: Page title */}
      <div>
        {breadcrumb && (
          <p className="text-xs text-slate-400 font-medium mb-0.5">{breadcrumb}</p>
        )}
        <h1 className="text-lg font-semibold text-slate-900">{pageTitle}</h1>
      </div>

      {/* Right: Search + Actions */}
      <div className="flex items-center gap-4">
        {/* Check-in/Check-out Button - COMMENTED OUT (feature not displayed)
        <div className="hidden md:block border-r border-slate-200 pr-4">
          <CheckinCheckoutButton />
        </div> */}
        {/* Search */}
        <div className="relative hidden md:block">
          <Icon name="MagnifyingGlassIcon" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search employees, leaves, payroll..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all w-72"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-mono border border-slate-200 rounded px-1 py-0.5 hidden lg:block">
            ⌘K
          </kbd>
        </div>

        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="relative w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            aria-label="Notifications"
          >
            <Icon name="BellIcon" size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl border border-slate-200 shadow-dropdown z-50 animate-fade-in overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
                  <p className="text-xs text-slate-500">{unreadCount} unread</p>
                </div>
                <button onClick={markAllRead} className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors">
                  Mark all read
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto scrollbar-thin">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors ${!n.read ? 'bg-blue-50/30' : ''}`}
                    onClick={() => setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x))}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${notifTypeColors[n.type]}`}>
                      <Icon name={notifTypeIcons[n.type] as Parameters<typeof Icon>[0]['name']} size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium truncate ${!n.read ? 'text-slate-900' : 'text-slate-700'}`}>{n.title}</p>
                        {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-xs text-slate-400 mt-1">{n.time}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2.5 border-t border-slate-100">
                <button className="text-xs text-blue-600 hover:text-blue-700 font-medium w-full text-center transition-colors">
                  View all notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Help */}
        <button className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors" aria-label="Help">
          <Icon name="QuestionMarkCircleIcon" size={18} />
        </button>

        {/* User avatar */}
        <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200 cursor-pointer group">
          <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-white text-xs font-bold">
            SM
          </div>
          <div className="hidden lg:block">
            <p className="text-sm font-semibold text-slate-900 leading-tight">Sarah Mitchell</p>
            <p className="text-xs text-slate-500">HR Manager</p>
          </div>
          <Icon name="ChevronDownIcon" size={14} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
        </div>
      </div>
    </header>
  );
}
