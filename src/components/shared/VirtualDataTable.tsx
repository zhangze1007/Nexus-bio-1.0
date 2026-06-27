"use client";

import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { THEME } from "../../theme";

// ── Types ──────────────────────────────────────────────────────────────

export interface ColumnDef<T = Record<string, unknown>> {
  key: string;
  header: string;
  width?: number | string;
  render?: (value: unknown, row: T, rowIndex: number) => React.ReactNode;
  sortable?: boolean;
}

export interface VirtualDataTableHandle {
  /** Programmatically scroll so that `index` is visible. */
  scrollToIndex: (index: number) => void;
}

interface VirtualDataTableProps<T = Record<string, unknown>> {
  rows: T[];
  columns: ColumnDef<T>[];
  /** Fixed pixel height of every data row (header excluded). */
  rowHeight: number;
  /** Extra rows rendered above and below the viewport. Default 5. */
  overscan?: number;
  /** Optional className on the outer wrapper div. */
  className?: string;
  /** Callback when a row is clicked. */
  onRowClick?: (row: T, index: number) => void;
  /** Currently focused row index (for controlled keyboard nav). */
  focusedIndex?: number;
}

// ── Component ──────────────────────────────────────────────────────────

function VirtualDataTableInner<T extends Record<string, unknown>>(
  {
    rows,
    columns,
    rowHeight,
    overscan = 5,
    className,
    onRowClick,
    focusedIndex: controlledFocus,
  }: VirtualDataTableProps<T>,
  ref: React.ForwardedRef<VirtualDataTableHandle>,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // Internal focus state, initialized from controlled prop if provided
  const [focusIdx, setFocusIdx] = useState(() => controlledFocus ?? -1);

  // Sync controlled prop changes into internal state
  const prevControlled = useRef(controlledFocus);
  useEffect(() => {
    if (
      controlledFocus !== undefined &&
      controlledFocus !== prevControlled.current
    ) {
      setFocusIdx(controlledFocus);
      prevControlled.current = controlledFocus;
    }
  }, [controlledFocus]);

  // ── ResizeObserver to track container height ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    ro.observe(el);
    // Initial measurement
    setContainerHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  // ── Scroll handler ──
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setScrollTop(el.scrollTop);
  }, []);

  // ── Derived virtual range ──
  const totalHeight = rows.length * rowHeight;

  const { startIndex, endIndex, offsetY } = useMemo(() => {
    if (containerHeight === 0 || rows.length === 0) {
      return { startIndex: 0, endIndex: -1, offsetY: 0 };
    }

    const rawStart = Math.floor(scrollTop / rowHeight);
    const visibleCount = Math.ceil(containerHeight / rowHeight);

    const start = Math.max(0, rawStart - overscan);
    const end = Math.min(rows.length - 1, rawStart + visibleCount + overscan);

    return {
      startIndex: start,
      endIndex: end,
      offsetY: start * rowHeight,
    };
  }, [scrollTop, containerHeight, rowHeight, overscan, rows.length]);

  const visibleRows = useMemo(() => {
    if (startIndex > endIndex) return [];
    return rows.slice(startIndex, endIndex + 1).map((row, i) => ({
      row,
      absoluteIndex: startIndex + i,
    }));
  }, [rows, startIndex, endIndex]);

  // ── Imperative handle ──
  useImperativeHandle(
    ref,
    () => ({
      scrollToIndex(index: number) {
        const clamped = Math.max(0, Math.min(index, rows.length - 1));
        const el = containerRef.current;
        if (!el) return;

        const rowTop = clamped * rowHeight;
        const rowBottom = rowTop + rowHeight;

        // Scroll so the row is visible
        if (rowTop < el.scrollTop) {
          el.scrollTop = rowTop;
        } else if (rowBottom > el.scrollTop + el.clientHeight) {
          el.scrollTop = rowBottom - el.clientHeight;
        }

        setScrollTop(el.scrollTop);
        setFocusIdx(clamped);
      },
    }),
    [rows.length, rowHeight],
  );

  // ── Keyboard navigation ──
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (rows.length === 0) return;

      let nextFocus = focusIdx;
      const pageSize = Math.max(1, Math.floor(containerHeight / rowHeight));

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          nextFocus = Math.min(
            rows.length - 1,
            Math.max(0, focusIdx) + 1,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          nextFocus = Math.max(0, focusIdx - 1);
          break;
        case "PageDown":
          e.preventDefault();
          nextFocus = Math.min(
            rows.length - 1,
            Math.max(0, focusIdx) + pageSize,
          );
          break;
        case "PageUp":
          e.preventDefault();
          nextFocus = Math.max(0, focusIdx - pageSize);
          break;
        case "Home":
          e.preventDefault();
          nextFocus = 0;
          break;
        case "End":
          e.preventDefault();
          nextFocus = rows.length - 1;
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (focusIdx >= 0 && focusIdx < rows.length && onRowClick) {
            onRowClick(rows[focusIdx], focusIdx);
          }
          return;
        default:
          return;
      }

      if (nextFocus !== focusIdx) {
        setFocusIdx(nextFocus);
        // Scroll focused row into view
        const el = containerRef.current;
        if (el) {
          const rowTop = nextFocus * rowHeight;
          const rowBottom = rowTop + rowHeight;
          if (rowTop < el.scrollTop) {
            el.scrollTop = rowTop;
          } else if (rowBottom > el.scrollTop + el.clientHeight) {
            el.scrollTop = rowBottom - el.clientHeight;
          }
          setScrollTop(containerRef.current?.scrollTop ?? 0);
        }
      }
    },
    [focusIdx, rows, rowHeight, containerHeight, onRowClick],
  );

  // ── Empty state ──
  if (rows.length === 0) {
    return (
      <div
        className={className}
        style={{
          background: THEME.BG_CANVAS,
          borderRadius: THEME.R_SM,
          border: `1px solid ${THEME.BORDER}`,
          overflow: "hidden",
        }}
      >
        {/* Fixed header */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "fixed",
          }}
        >
          <thead>
            <tr style={{ borderBottom: `1px solid ${THEME.BORDER}` }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    padding: "10px 12px",
                    textAlign: "left",
                    fontFamily: THEME.MONO,
                    fontSize: THEME.FS_XS,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: THEME.INK_SOFT,
                    width: col.width,
                    whiteSpace: "nowrap",
                    background: THEME.BG_CANVAS,
                    position: "sticky",
                    top: 0,
                    zIndex: 2,
                  }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
        </table>
        <div
          style={{
            padding: "40px 12px",
            textAlign: "center",
            fontFamily: THEME.SANS,
            fontSize: THEME.FS_SM,
            color: THEME.DIM,
          }}
        >
          No rows to display.
        </div>
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        background: THEME.BG_CANVAS,
        borderRadius: THEME.R_SM,
        border: `1px solid ${THEME.BORDER}`,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Fixed header */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          tableLayout: "fixed",
          flexShrink: 0,
        }}
      >
        <thead>
          <tr style={{ borderBottom: `1px solid ${THEME.BORDER}` }}>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  padding: "10px 12px",
                  textAlign: "left",
                  fontFamily: THEME.MONO,
                  fontSize: THEME.FS_XS,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: THEME.INK_SOFT,
                  width: col.width,
                  whiteSpace: "nowrap",
                  background: THEME.BG_CANVAS,
                  position: "sticky",
                  top: 0,
                  zIndex: 2,
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
      </table>

      {/* Virtualized scroll container */}
      <div
        ref={containerRef}
        role="grid"
        tabIndex={0}
        aria-rowcount={rows.length}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        data-testid="virtual-scroll-container"
        style={{
          flex: 1,
          overflow: "auto",
          outline: "none",
          position: "relative",
        }}
      >
        {/* Spacer to enforce total scroll height */}
        <div
          data-testid="scroll-spacer"
          style={{ height: totalHeight, position: "relative" }}
        >
          {/* Visible rows positioned absolutely */}
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              tableLayout: "fixed",
              position: "absolute",
              top: 0,
              left: 0,
              transform: `translateY(${offsetY}px)`,
            }}
          >
            <tbody>
              {visibleRows.map(({ row, absoluteIndex }) => {
                const isFocused = absoluteIndex === focusIdx;
                return (
                  <tr
                    key={absoluteIndex}
                    role="row"
                    aria-rowindex={absoluteIndex + 1}
                    data-testid={`virtual-row-${absoluteIndex}`}
                    onClick={() => onRowClick?.(row, absoluteIndex)}
                    style={{
                      height: rowHeight,
                      borderBottom: `1px solid ${THEME.BORDER}`,
                      background: isFocused
                        ? "rgba(175, 195, 214, 0.08)"
                        : absoluteIndex % 2 === 0
                          ? "transparent"
                          : "rgba(255,255,255,0.02)",
                      cursor: onRowClick ? "pointer" : "default",
                      transition: "background 0.1s ease",
                    }}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        style={{
                          padding: "0 12px",
                          fontFamily: THEME.SANS,
                          fontSize: THEME.FS_SM,
                          color: THEME.INK,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          width: col.width,
                          height: rowHeight,
                          boxSizing: "border-box",
                        }}
                      >
                        {col.render
                          ? col.render(
                              (row as Record<string, unknown>)[col.key],
                              row,
                              absoluteIndex,
                            )
                          : String(
                              (row as Record<string, unknown>)[col.key] ?? "",
                            )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row count footer */}
      <div
        data-testid="row-count"
        style={{
          padding: "6px 12px",
          fontFamily: THEME.MONO,
          fontSize: "10px",
          color: THEME.DIM,
          borderTop: `1px solid ${THEME.BORDER}`,
          flexShrink: 0,
          background: THEME.BG_CANVAS,
        }}
      >
        {rows.length.toLocaleString()} row{rows.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}

// ── Forward-ref wrapper ────────────────────────────────────────────────

const VirtualDataTable = React.forwardRef(VirtualDataTableInner) as (
  props: VirtualDataTableProps & { ref?: React.Ref<VirtualDataTableHandle> },
) => React.JSX.Element;

export default VirtualDataTable;
