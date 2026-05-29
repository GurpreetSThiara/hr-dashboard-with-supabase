'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useRealtimeNotifications } from '@/lib/useRealtimeNotifications';

export default function NotificationsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllRead, clearAll } = useRealtimeNotifications();

  const getIcon = (type: string) => {
    switch (type) {
      case 'leave_approved':
        return <Icon name="CheckCircleIcon" size={16} className="text-green-600" />;
      case 'leave_rejected':
        return <Icon name="XCircleIcon" size={16} className="text-red-600" />;
      case 'employee_added':
        return <Icon name="UserPlusIcon" size={16} className="text-blue-600" />;
      case 'employee_deleted':
        return <Icon name="UserMinusIcon" size={16} className="text-orange-600" />;
      case 'leave_submitted':
        return <Icon name="DocumentCheckIcon" size={16} className="text-indigo-600" />;
      case 'regularization_updated':
        return <Icon name="ClockIcon" size={16} className="text-amber-600" />;
      default:
        return <Icon name="BellIcon" size={16} className="text-slate-600" />;
    }
  };

  return (
    <div className="relative">
      {/* Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-600 hover:text-slate-900 transition-colors"
        aria-label="Notifications"
      >
        <Icon name="BellIcon" size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-slate-200 shadow-lg z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-900">Notifications</h3>
              <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>
            {notifications.length > 0 && (
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs text-slate-500 hover:text-slate-700 font-medium transition-colors"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={clearAll}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Icon name="BellIcon" size={32} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => markAsRead(notif.id)}
                    className={`px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer ${
                      !notif.read ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 mt-1">{getIcon(notif.type)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{notif.title}</p>
                        <p className="text-sm text-slate-600 mt-0.5">{notif.message}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {new Date(notif.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                      {!notif.read && (
                        <div className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-600 mt-2" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
