'use client';

/**
 * Responsive modal primitive.
 *  - Mobile (<sm): a bottom sheet (slides from the bottom, rounded top, grab
 *    handle, safe-area padding, max-h-[90vh] with internal scroll).
 *  - Desktop (≥sm): a centered dialog capped at `maxWidth`.
 *
 * Handles Escape-to-close, backdrop click, and body-scroll lock.
 */
import React, { useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Desktop max width (Tailwind class). */
  maxWidth?: string;
}

export default function Sheet({ open, onClose, title, children, footer, maxWidth = 'sm:max-w-lg' }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative w-full ${maxWidth} bg-white shadow-2xl flex flex-col
                    max-h-[90vh] sm:max-h-[85vh]
                    rounded-t-2xl sm:rounded-xl
                    pb-[env(safe-area-inset-bottom)] sm:pb-0 animate-fade-in`}
      >
        {/* Mobile grab handle */}
        <div className="sm:hidden mx-auto mt-2 mb-1 w-10 h-1 rounded-full bg-slate-200 flex-shrink-0" aria-hidden="true" />

        {title !== undefined && (
          <div className="flex items-center justify-between px-5 py-3 sm:py-3.5 border-b border-slate-200 flex-shrink-0">
            <h3 className="text-sm font-bold text-slate-900 truncate pr-2">{title}</h3>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-9 h-9 -mr-1.5 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 flex-shrink-0"
            >
              <Icon name="XMarkIcon" size={18} />
            </button>
          </div>
        )}

        <div className="overflow-y-auto px-5 py-4 flex-1 overscroll-contain">{children}</div>

        {footer && (
          <div className="px-5 py-3 border-t border-slate-200 flex-shrink-0 flex gap-2 justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
