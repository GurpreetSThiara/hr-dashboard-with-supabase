'use client';

/**
 * Responsive table primitive.
 *  - Desktop (≥md): a normal <table>.
 *  - Mobile (<md): each row becomes a card — the `primary` column is the card
 *    title, remaining columns render as label/value pairs, and `actions` (if
 *    provided) sit in a footer row.
 *
 * One column definition drives both layouts, so there's no duplicated markup.
 */
import React from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  /** Use this column as the card title on mobile. */
  primary?: boolean;
  /** Omit this column from the mobile card body. */
  hideOnCard?: boolean;
  /** Extra className for the desktop <td>. */
  cellClassName?: string;
  /** Right-align header + cell on desktop. */
  alignRight?: boolean;
}

interface ResponsiveTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  keyOf: (row: T) => string;
  /** Optional per-row actions (buttons). Rendered in the last column / card footer. */
  actions?: (row: T) => React.ReactNode;
  emptyText?: string;
  /** Optional click handler for a whole row/card. */
  onRowClick?: (row: T) => void;
}

export default function ResponsiveTable<T>({
  columns, rows, keyOf, actions, emptyText = 'No records', onRowClick,
}: ResponsiveTableProps<T>) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-8">{emptyText}</p>;
  }

  const primaryCol = columns.find(c => c.primary) || columns[0];
  const bodyCols = columns.filter(c => c !== primaryCol && !c.hideOnCard);

  return (
    <>
      {/* ── Desktop table ───────────────────────────────────────────── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {columns.map(c => (
                <th
                  key={c.key}
                  className={`px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide ${c.alignRight ? 'text-right' : 'text-left'}`}
                >
                  {c.header}
                </th>
              ))}
              {actions && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(row => (
              <tr
                key={keyOf(row)}
                className={`hover:bg-slate-50 ${onRowClick ? 'cursor-pointer' : ''}`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map(c => (
                  <td key={c.key} className={`px-4 py-3 align-middle ${c.alignRight ? 'text-right' : ''} ${c.cellClassName || ''}`}>
                    {c.render(row)}
                  </td>
                ))}
                {actions && <td className="px-4 py-3 text-right whitespace-nowrap">{actions(row)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Mobile cards ────────────────────────────────────────────── */}
      <div className="md:hidden space-y-2.5">
        {rows.map(row => (
          <div
            key={keyOf(row)}
            className={`bg-white border border-slate-200 rounded-xl p-3.5 ${onRowClick ? 'active:bg-slate-50' : ''}`}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            <div className="text-sm font-semibold text-slate-800 mb-2">{primaryCol.render(row)}</div>
            <dl className="space-y-1.5">
              {bodyCols.map(c => (
                <div key={c.key} className="flex items-start justify-between gap-3">
                  <dt className="text-[11px] font-medium text-slate-400 uppercase tracking-wide flex-shrink-0 pt-0.5">{c.header}</dt>
                  <dd className="text-xs text-slate-700 text-right min-w-0">{c.render(row)}</dd>
                </div>
              ))}
            </dl>
            {actions && (
              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2 justify-end">
                {actions(row)}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
