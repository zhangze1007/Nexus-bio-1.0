'use client';
import { useEffect, useMemo, useState } from 'react';
import EmptyState from './EmptyState';
import Pagination from './Pagination';
import { T } from '../tokens';

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
  pageSizeOptions?: number[];
  emptyTitle?: string;
  emptyMessage?: string;
}

export default function DataTable<T extends object>({
  columns,
  rows,
  maxRows = 50,
  pageSizeOptions = [25, 50, 100],
  emptyTitle = 'No rows to display',
  emptyMessage = 'Adjust the current filters or parameters to populate this table.',
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(maxRows);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;

    return [...rows].sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortKey as string];
      const bv = (b as Record<string, unknown>)[sortKey as string];
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av ?? '').localeCompare(String(bv ?? ''));

      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortDir, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);

  useEffect(() => {
    setCurrentPage(1);
  }, [rows, pageSize]);

  useEffect(() => {
    if (safePage !== currentPage) setCurrentPage(safePage);
  }, [currentPage, safePage]);

  const visible = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [pageSize, safePage, sorted]);

  function onSort(key: keyof T) {
    if (sortKey === key) {
      setSortDir((direction) => (direction === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(key);
    setSortDir('asc');
  }

  return (
    <div
      style={{
        width: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ overflowX: 'auto', width: '100%', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  onClick={col.sortable !== false ? () => onSort(col.key) : undefined}
                  style={{
                    padding: '8px 12px',
                    textAlign: 'left',
                    fontFamily: T.MONO,
                    fontSize: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: sortKey === col.key ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)',
                    cursor: col.sortable !== false ? 'pointer' : 'default',
                    userSelect: 'none',
                    width: col.width,
                    whiteSpace: 'nowrap',
                    background: 'rgba(0,0,0,0.94)',
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
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
            {visible.length > 0 ? (
              visible.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    background: rowIndex % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                  }}
                >
                  {columns.map((col) => (
                    <td
                      key={String(col.key)}
                      style={{
                        padding: '7px 12px',
                        fontFamily: T.SANS,
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
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} style={{ padding: 0, height: '260px' }}>
                  <EmptyState title={emptyTitle} message={emptyMessage} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        totalItems={sorted.length}
        currentPage={safePage}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={pageSizeOptions}
        itemLabel="rows"
      />
    </div>
  );
}
