'use client';

import React, { useState, useRef, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

const AVATAR_COLORS = [
  'bg-blue-600', 'bg-violet-600', 'bg-emerald-600', 'bg-amber-600',
  'bg-pink-600', 'bg-indigo-600', 'bg-teal-600', 'bg-rose-600',
];

function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = seed.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function initials(name: string | null | undefined, email: string) {
  if (name) {
    const parts = name.trim().split(' ');
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || email[0]?.toUpperCase() || '?';
  }
  return email[0]?.toUpperCase() || '?';
}

const TIER_BADGE: Record<number, string> = {
  1: 'bg-purple-100 text-purple-700',  2: 'bg-purple-50 text-purple-600',
  3: 'bg-blue-100 text-blue-700',      4: 'bg-blue-50 text-blue-600',
  5: 'bg-blue-50 text-blue-500',       6: 'bg-cyan-100 text-cyan-700',
  7: 'bg-cyan-50 text-cyan-600',       8: 'bg-emerald-100 text-emerald-700',
  9: 'bg-emerald-50 text-emerald-600', 10: 'bg-teal-100 text-teal-700',
  11: 'bg-teal-50 text-teal-600',      12: 'bg-amber-100 text-amber-700',
  13: 'bg-amber-50 text-amber-600',    14: 'bg-orange-50 text-orange-600',
  15: 'bg-slate-100 text-slate-700',   16: 'bg-slate-50 text-slate-600',
  17: 'bg-slate-50 text-slate-500',    18: 'bg-slate-50 text-slate-400',
};

export default function UserMenu() {
  const { user, profile, role, tier, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';
  const email = profile?.email || user?.email || '';
  const department = profile?.department;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    try { await signOut(); } finally { setSigningOut(false); }
  }

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2.5 pl-3 border-l border-slate-200 cursor-pointer group hover:bg-slate-50 rounded-r-lg transition-colors px-2 py-1.5"
      >
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${avatarColor(email)}`}>
          {initials(profile?.full_name, email)}
        </div>
        <div className="hidden lg:block text-left">
          <p className="text-sm font-semibold text-slate-900 leading-tight">{displayName}</p>
          <p className="text-xs text-slate-500">{role}</p>
        </div>
        <Icon
          name="ChevronDownIcon"
          size={14}
          className={`text-slate-400 group-hover:text-slate-600 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl border border-slate-200 shadow-dropdown z-50 overflow-hidden">
          {/* Account header */}
          <div className="px-4 py-4 bg-gradient-to-br from-slate-50 to-blue-50 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white text-base font-bold flex-shrink-0 ${avatarColor(email)}`}>
                {initials(profile?.full_name, email)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900 truncate">{displayName}</p>
                <p className="text-xs text-slate-500 truncate">{email}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`px-1.5 py-0.5 text-xs font-semibold rounded ${TIER_BADGE[tier] || TIER_BADGE[15]}`}>
                    T{tier}
                  </span>
                  <span className="text-xs text-slate-500">{role}</span>
                </div>
              </div>
            </div>
            {department && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                <Icon name="BuildingOfficeIcon" size={12} />
                <span>{department}</span>
              </div>
            )}
          </div>

          {/* Switch user — quick deep link to login page */}
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-blue-50 transition-colors text-left disabled:opacity-50"
          >
            <Icon name="ArrowsRightLeftIcon" size={16} className="text-blue-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-slate-800">Switch User</p>
              <p className="text-xs text-slate-500">Sign in as a different role</p>
            </div>
          </button>

          <div className="border-t border-slate-100" />

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-red-50 transition-colors text-left disabled:opacity-50"
          >
            <Icon
              name={signingOut ? 'ArrowPathIcon' : 'ArrowRightStartOnRectangleIcon'}
              size={16}
              className={`text-red-600 flex-shrink-0 ${signingOut ? 'animate-spin' : ''}`}
            />
            <div>
              <p className="text-sm font-semibold text-red-600">
                {signingOut ? 'Signing out…' : 'Sign Out'}
              </p>
              <p className="text-xs text-slate-500">End your current session</p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
