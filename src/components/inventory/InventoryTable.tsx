"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { THEME } from "../../theme";
import DataTable, { type TableColumn } from "../ide/shared/DataTable";

interface InventoryTableProps<T extends object> {
  items: T[];
  columns: TableColumn<T>[];
  onRowClick?: (item: T) => void;
  onAdd?: () => void;
  searchPlaceholder?: string;
  emptyMessage?: string;
  addLabel?: string;
  isLoading?: boolean;
  /** External search value — if provided, component is controlled */
  externalSearch?: string;
  onSearchChange?: (value: string) => void;
}

export default function InventoryTable<T extends object>({
  items,
  columns,
  onRowClick,
  onAdd,
  searchPlaceholder = "Search...",
  emptyMessage = "No items found.",
  addLabel = "Add Item",
  isLoading = false,
  externalSearch,
  onSearchChange,
}: InventoryTableProps<T>) {
  const [internalSearch, setInternalSearch] = useState("");
  const search = externalSearch !== undefined ? externalSearch : internalSearch;
  const setSearch = onSearchChange ?? setInternalSearch;

  // Reset page on search change is handled by DataTable internally
  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const term = search.toLowerCase();
    return items.filter((item) =>
      columns.some((col) => {
        const val = item[col.key];
        return val !== null && val !== undefined && String(val).toLowerCase().includes(term);
      })
    );
  }, [items, search, columns]);

  // Wrap columns to add row click behavior
  const tableColumns = useMemo(() => {
    if (!onRowClick) return columns;
    return columns.map((col) => ({
      ...col,
      render: col.render
        ? (value: T[keyof T], row: T) => (
            <span
              onClick={() => onRowClick(row)}
              style={{ cursor: "pointer" }}
            >
              {col.render!(value, row)}
            </span>
          )
        : undefined,
    }));
  }, [columns, onRowClick]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: THEME.SP_SM,
        width: "100%",
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: THEME.SP_SM,
          flexWrap: "wrap",
        }}
      >
        {/* Search input */}
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: "200px" }}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke={THEME.INK_SOFT}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
            }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            style={{
              width: "100%",
              padding: "8px 12px 8px 34px",
              borderRadius: THEME.R_SM,
              border: `1px solid ${THEME.BORDER}`,
              background: THEME.INPUT_BG,
              color: THEME.INPUT_TEXT,
              fontFamily: THEME.SANS,
              fontSize: THEME.FS_SM,
              outline: "none",
              transition: "border-color 0.15s ease",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = THEME.BORDER_ACTIVE;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = THEME.BORDER;
            }}
          />
        </div>

        {/* Item count */}
        <span
          style={{
            fontFamily: THEME.MONO,
            fontSize: THEME.FS_XS,
            color: THEME.INK_SOFT,
            whiteSpace: "nowrap",
          }}
        >
          {filtered.length} {filtered.length === 1 ? "item" : "items"}
        </span>

        {/* Add button */}
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              borderRadius: THEME.R_SM,
              border: `1px solid ${THEME.MINT}33`,
              background: `${THEME.MINT}15`,
              color: THEME.MINT,
              fontFamily: THEME.SANS,
              fontSize: THEME.FS_SM,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `${THEME.MINT}25`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = `${THEME.MINT}15`;
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {addLabel}
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "200px",
            color: THEME.INK_SOFT,
            fontFamily: THEME.SANS,
            fontSize: THEME.FS_SM,
          }}
        >
          Loading...
        </div>
      ) : (
        <DataTable
          columns={tableColumns}
          rows={filtered}
          emptyTitle="No items"
          emptyMessage={emptyMessage}
          maxRows={20}
          pageSizeOptions={[20, 50, 100]}
        />
      )}
    </div>
  );
}
