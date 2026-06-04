'use client';

/**
 * Mobile bottom navigation (native-app pattern). Shown only below `lg`.
 * Displays up to 4 primary destinations + a "Menu" button that opens the full
 * drawer. Touch targets are ≥ 44px tall and it respects the iOS safe area.
 */
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { useRoleBasedAccess } from '@/lib/useRoleBasedAccess';
import { NAV_ITEMS } from '@/lib/navItems';

export default function BottomNav({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();
  const { hasPermission } = useRoleBasedAccess();

  const visible = NAV_ITEMS.filter(i => !i.requiredPermission || hasPermission(i.requiredPermission));
  const primary = visible.slice(0, 4);

  return (
    <nav
      aria-label="Primary"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 flex items-stretch
                 pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_8px_0_rgb(0_0_0/0.06)]"
    >
      {primary.map(item => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.id}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] px-1 ${
              active ? 'text-blue-600' : 'text-slate-500'
            }`}
          >
            <Icon name={item.icon as any} size={20} className={active ? 'text-blue-600' : ''} />
            <span className="text-[10px] font-medium leading-none truncate max-w-full">
              {item.label.split(' ')[0]}
            </span>
          </Link>
        );
      })}
      <button
        onClick={onOpenMenu}
        aria-label="Open menu"
        className="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] px-1 text-slate-500"
      >
        <Icon name="Bars3Icon" size={20} />
        <span className="text-[10px] font-medium leading-none">More</span>
      </button>
    </nav>
  );
}
