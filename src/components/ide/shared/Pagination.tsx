'use client';

const SANS = "'Inter',-apple-system,sans-serif";
const MONO = "'JetBrains Mono','Fira Code',monospace";

interface PaginationProps {
  totalItems: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
}

function buildPageRange(currentPage: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis-right', totalPages] as const;
  }

  if (currentPage >= totalPages - 3) {
    return [1, 'ellipsis-left', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages] as const;
  }

  return [1, 'ellipsis-left', currentPage - 1, currentPage, currentPage + 1, 'ellipsis-right', totalPages] as const;
}

export default function Pagination({
  totalItems,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
  itemLabel = 'items',
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const rangeStart = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = totalItems === 0 ? 0 : Math.min(totalItems, safePage * pageSize);

  if (totalItems <= 0) return null;

  const pages = buildPageRange(safePage, totalPages);

  return (
    <div
      className="nb-pagination"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        flexWrap: 'wrap',
        padding: '14px 16px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <p
          style={{
            margin: 0,
            fontFamily: SANS,
            fontSize: '12px',
            color: 'rgba(255,255,255,0.68)',
          }}
        >
          Showing <span style={{ color: '#ffffff', fontWeight: 600 }}>{rangeStart}-{rangeEnd}</span> of{' '}
          <span style={{ color: '#ffffff', fontWeight: 600 }}>{totalItems}</span> {itemLabel}
        </p>

        {onPageSizeChange && (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontFamily: MONO,
              fontSize: '10px',
              color: 'rgba(255,255,255,0.42)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Page size
            <select
              aria-label="Results per page"
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              style={{
                minHeight: '36px',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(11,15,22,0.92)',
                color: 'rgba(255,255,255,0.82)',
                padding: '0 10px',
                fontFamily: SANS,
                fontSize: '12px',
              }}
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        {[
          { label: 'First', ariaLabel: 'Go to first page', target: 1, disabled: safePage === 1 },
          { label: 'Prev', ariaLabel: 'Go to previous page', target: safePage - 1, disabled: safePage === 1 },
        ].map((control) => (
          <button
            key={control.label}
            type="button"
            onClick={() => onPageChange(control.target)}
            disabled={control.disabled}
            aria-label={control.ariaLabel}
            style={{
              minHeight: '36px',
              padding: '0 12px',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: control.disabled ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.05)',
              color: control.disabled ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.8)',
              cursor: control.disabled ? 'not-allowed' : 'pointer',
              fontFamily: SANS,
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            {control.label}
          </button>
        ))}

        {pages.map((page) => {
          if (typeof page !== 'number') {
            return (
              <span
                key={page}
                aria-hidden="true"
                style={{
                  minWidth: '28px',
                  textAlign: 'center',
                  color: 'rgba(255,255,255,0.3)',
                  fontFamily: MONO,
                  fontSize: '11px',
                }}
              >
                …
              </span>
            );
          }

          const isActive = page === safePage;

          return (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={`Go to page ${page}`}
              style={{
                minWidth: '36px',
                minHeight: '36px',
                padding: '0 10px',
                borderRadius: '10px',
                border: isActive ? '1px solid rgba(255,255,255,0.22)' : '1px solid rgba(255,255,255,0.08)',
                background: isActive ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                color: isActive ? '#ffffff' : 'rgba(255,255,255,0.72)',
                cursor: 'pointer',
                fontFamily: MONO,
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              {page}
            </button>
          );
        })}

        {[
          { label: 'Next', ariaLabel: 'Go to next page', target: safePage + 1, disabled: safePage === totalPages },
          { label: 'Last', ariaLabel: 'Go to last page', target: totalPages, disabled: safePage === totalPages },
        ].map((control) => (
          <button
            key={control.label}
            type="button"
            onClick={() => onPageChange(control.target)}
            disabled={control.disabled}
            aria-label={control.ariaLabel}
            style={{
              minHeight: '36px',
              padding: '0 12px',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: control.disabled ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.05)',
              color: control.disabled ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.8)',
              cursor: control.disabled ? 'not-allowed' : 'pointer',
              fontFamily: SANS,
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            {control.label}
          </button>
        ))}
      </div>
    </div>
  );
}

