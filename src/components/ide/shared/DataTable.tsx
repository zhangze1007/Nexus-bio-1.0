'use client';
import { useState } from 'react';

const MONO = "'JetBrains Mono','Fira Code',monospace";
const SANS = "'Inter',-apple-system,sans-serif";

export interface TableColumn<T> {
  key: keyof T;
  header: string;
  width?: number;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T extends object> {
  columns: TableColumn<T>[];
  rows: T[];
  maxRows?: number;
}

export default function DataTable<T extends object>({ columns, rows, maxRows = 50 }: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sorted = sortKey
    ? [...rows].sort((a, b) => {
        const av = (a as Record<string, unknown>)[sortKey as string];
        const bv = (b as Record<string, unknown>)[sortKey as string];
        const cmp = typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv));
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : rows;

  const visible = sorted.slice(0, maxRows);

  function onSort(key: keyof T) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  return (
    <div style={{ overflowX: 'auto', width: '100%' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            {columns.map(col => (
              <th
                key={String(col.key)}
                onClick={col.sortable !== false ? () => onSort(col.key) : undefined}
                style={{
                  padding: '6px 10px',
                  textAlign: 'left',
                  fontFamily: MONO,
                  fontSize: '9px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: sortKey === col.key ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)',
                  cursor: col.sortable !== false ? 'pointer' : 'default',
                  userSelect: 'none',
                  width: col.width,
                  whiteSpace: 'nowrap',
                }}
              >
                {col.header}
                {sortKey === col.key && (
                  <span style={{ marginLeft: '4px' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row, ri) => (
            <tr
              key={ri}
              style={{
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                background: ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
              }}
            >
              {columns.map(col => (
                <td
                  key={String(col.key)}
                  style={{
                    padding: '5px 10px',
                    fontFamily: SANS,
                    fontSize: '11px',
                    color: 'rgba(255,255,255,0.65)',
                    whiteSpace: 'nowrap',
                    width: col.width,
                  }}
                >
                  {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > maxRows && (
        <p style={{ fontFamily: MONO, fontSize: '10px', color: 'rgba(255,255,255,0.2)', padding: '6px 10px', margin: 0 }}>
          Showing {maxRows} of {rows.length} rows
        </p>
      )}
    </div>
  );
}
