'use client';

import React, { useState, useRef, useEffect } from 'react';

import Icon from '@/components/ui/AppIcon';
import UserMenu from '@/components/UserMenu';
import { useRealtimeNotifications } from '@/lib/useRealtimeNotifications';
// import CheckinCheckoutButton from '@/components/CheckinCheckoutButton'; // Commented out

const notifTypeColors: Record<string, string> = {
  leave_submitted: 'bg-amber-100 text-amber-600',
  leave_approved: 'bg-emerald-100 text-emerald-600',
  leave_rejected: 'bg-red-100 text-red-600',
  employee_added: 'bg-blue-100 text-blue-600',
  employee_deleted: 'bg-slate-100 text-slate-600',
  regularization_updated: 'bg-violet-100 text-violet-600',
};

const notifTypeIcons: Record<string, string> = {
  leave_submitted: 'CalendarDaysIcon',
  leave_approved: 'CheckCircleIcon',
  leave_rejected: 'XCircleIcon',
  employee_added: 'UserPlusIcon',
  employee_deleted: 'UserMinusIcon',
  regularization_updated: 'ClockIcon',
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Math.max(0, Date.now() - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB');
}

interface TopbarProps {
  pageTitle: string;
  breadcrumb?: string;
  /** Opens the mobile navigation drawer (hamburger). */
  onOpenMobileNav?: () => void;
}

export default function Topbar({ pageTitle, breadcrumb, onOpenMobileNav }: TopbarProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const notifRef = useRef<HTMLDivElement>(null);

  const { notifications, unreadCount, markAsRead, markAllRead, clearAll } =
    useRealtimeNotifications();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 flex-shrink-0 z-30 gap-2">
      {/* Left: hamburger (mobile) + page title */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onOpenMobileNav}
          aria-label="Open navigation menu"
          className="lg:hidden flex items-center justify-center h-11 w-11 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
        >
          <Icon name="Bars3Icon" size={22} />
        </button>
        <div className="min-w-0">
          {breadcrumb && (
            <p className="text-xs text-slate-400 font-medium mb-0.5 truncate">{breadcrumb}</p>
          )}
          <h1 className="text-base sm:text-lg font-semibold text-slate-900 truncate">{pageTitle}</h1>
        </div>
      </div>

      {/* Right: Search + Actions */}
      <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
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
            <div className="absolute right-0 top-full mt-2 w-[min(24rem,calc(100vw-1rem))] bg-white rounded-xl border border-slate-200 shadow-dropdown z-50 animate-fade-in overflow-hidden">
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
                {notifications.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <Icon name="BellIcon" size={24} className="mx-auto text-slate-300" />
                    <p className="text-sm text-slate-400 mt-2">No notifications yet</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`flex items-start gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors ${!n.read ? 'bg-blue-50/30' : ''}`}
                      onClick={() => markAsRead(n.id)}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${notifTypeColors[n.type] ?? 'bg-slate-100 text-slate-600'}`}>
                        <Icon name={(notifTypeIcons[n.type] ?? 'BellIcon') as Parameters<typeof Icon>[0]['name']} size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm font-medium truncate ${!n.read ? 'text-slate-900' : 'text-slate-700'}`}>{n.title}</p>
                          {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-xs text-slate-400 mt-1">{relativeTime(n.timestamp)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {notifications.length > 0 && (
                <div className="px-4 py-2.5 border-t border-slate-100">
                  <button
                    onClick={clearAll}
                    className="text-xs text-slate-500 hover:text-red-600 font-medium w-full text-center transition-colors"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Help (hidden on the smallest screens to reduce header crowding) */}
        <button className="hidden sm:flex w-9 h-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors" aria-label="Help">
          <Icon name="QuestionMarkCircleIcon" size={18} />
        </button>

        {/* User menu with logout */}
        <UserMenu />
      </div>
    </header>
  );
}
