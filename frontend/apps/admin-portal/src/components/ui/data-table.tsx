'use client';

import { useState } from 'react';
import { cn } from '@lynia/utils';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  loading?: boolean;
  selectable?: boolean;
  selectedKeys?: Set<string>;
  onSelectionChange?: (selectedKeys: Set<string>) => void;
}

type SortDir = 'asc' | 'desc' | null;

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage = 'No data available',
  loading,
  selectable,
  selectedKeys,
  onSelectionChange,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  function handleSort(key: string) {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc');
      else if (sortDir === 'desc') {
        setSortKey(null);
        setSortDir(null);
      }
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const allPageKeys = data.map(keyExtractor);
  const allSelected = selectable && selectedKeys && allPageKeys.length > 0 && allPageKeys.every((k) => selectedKeys.has(k));
  const someSelected = selectable && selectedKeys && !allSelected && allPageKeys.some((k) => selectedKeys.has(k));

  function handleSelectAll() {
    if (!onSelectionChange || !selectedKeys) return;
    if (allSelected) {
      const next = new Set(selectedKeys);
      allPageKeys.forEach((k) => next.delete(k));
      onSelectionChange(next);
    } else {
      const next = new Set(selectedKeys);
      allPageKeys.forEach((k) => next.add(k));
      onSelectionChange(next);
    }
  }

  function handleSelectRow(key: string) {
    if (!onSelectionChange || !selectedKeys) return;
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectionChange(next);
  }

  const sortedData = sortKey && sortDir
    ? [...data].sort((a, b) => {
        const aVal = (a as Record<string, unknown>)[sortKey];
        const bVal = (b as Record<string, unknown>)[sortKey];
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortDir === 'desc' ? -cmp : cmp;
      })
    : data;

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted">
          <tr>
            {selectable && (
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  checked={!!allSelected}
                  ref={(el) => { if (el) el.indeterminate = !!someSelected; }}
                  onChange={handleSelectAll}
                  className="h-4 w-4 rounded border-input text-brand-600 focus:ring-ring"
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground',
                  col.sortable && 'cursor-pointer select-none hover:text-foreground',
                  col.className
                )}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                <div className="flex items-center gap-1">
                  {col.header}
                  {col.sortable && (
                    <span className="text-muted-foreground">
                      {sortKey === col.key && sortDir === 'asc' ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : sortKey === col.key && sortDir === 'desc' ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronsUpDown className="h-3.5 w-3.5" />
                      )}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {selectable && (
                  <td className="w-10 px-3 py-3">
                    <div className="h-4 w-4 animate-pulse rounded bg-muted" />
                  </td>
                )}
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                  </td>
                ))}
              </tr>
            ))
          ) : sortedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-4 py-12 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sortedData.map((row) => {
              const rowKey = keyExtractor(row);
              const isSelected = selectable && selectedKeys?.has(rowKey);
              return (
                <tr
                  key={rowKey}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-accent',
                    isSelected && 'bg-brand-50'
                  )}
                >
                  {selectable && (
                    <td className="w-10 px-3 py-3">
                      <input
                        type="checkbox"
                        checked={!!isSelected}
                        onChange={() => handleSelectRow(rowKey)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 rounded border-input text-brand-600 focus:ring-ring"
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-4 py-3 text-sm text-foreground', col.className)}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
