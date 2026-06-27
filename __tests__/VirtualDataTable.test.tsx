/**
 * Tests for VirtualDataTable component.
 *
 * Covers:
 * - Basic rendering with rows and columns
 * - Fixed header rendering
 * - Virtualization (only visible rows in DOM)
 * - Overscan buffer
 * - Empty state
 * - Row click callback
 * - Keyboard navigation (ArrowDown, ArrowUp, Home, End, Enter)
 * - scrollToIndex via imperative handle
 * - Row count footer
 * - Custom cell render functions
 * - Focused row highlight
 * - Controlled focus prop
 */

import React, { createRef, act } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import VirtualDataTable, {
  type ColumnDef,
  type VirtualDataTableHandle,
} from "../src/components/shared/VirtualDataTable";

// ── Helpers ────────────────────────────────────────────────────────────

function makeRows(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    name: `Row ${i}`,
    value: i * 10,
  }));
}

const columns: ColumnDef[] = [
  { key: "id", header: "ID", width: 60 },
  { key: "name", header: "Name" },
  { key: "value", header: "Value", width: 80 },
];

const ROW_HEIGHT = 36;
const CONTAINER_HEIGHT = 360; // fits 10 rows

// ── Mocks ──────────────────────────────────────────────────────────────

// Mock ResizeObserver since jsdom doesn't implement it.
let resizeCallback: ResizeObserverCallback | null = null;

class MockResizeObserver {
  constructor(cb: ResizeObserverCallback) {
    resizeCallback = cb;
  }
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}

// Simulate ResizeObserver firing with a given height (wrapped in act)
function simulateResize(height: number) {
  act(() => {
    if (resizeCallback) {
      resizeCallback(
        [
          {
            contentRect: { height } as DOMRectReadOnly,
            target: document.createElement("div"),
            borderBoxSize: [],
            contentBoxSize: [],
            devicePixelContentBoxSize: [],
          },
        ] as unknown as ResizeObserverEntry[],
        {} as ResizeObserver,
      );
    }
  });
}

beforeEach(() => {
  global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
  resizeCallback = null;
});

// ── Tests ──────────────────────────────────────────────────────────────

describe("VirtualDataTable", () => {
  // 1. Basic rendering
  it("renders header column labels", () => {
    const rows = makeRows(5);
    render(
      <VirtualDataTable
        rows={rows}
        columns={columns}
        rowHeight={ROW_HEIGHT}
      />,
    );

    expect(screen.getByText("ID")).toBeTruthy();
    expect(screen.getByText("Name")).toBeTruthy();
    expect(screen.getByText("Value")).toBeTruthy();
  });

  // 2. Fixed header
  it("renders the header as a separate fixed table", () => {
    const rows = makeRows(5);
    const { container } = render(
      <VirtualDataTable
        rows={rows}
        columns={columns}
        rowHeight={ROW_HEIGHT}
      />,
    );

    // Two <table> elements: header table + body table
    const tables = container.querySelectorAll("table");
    expect(tables.length).toBeGreaterThanOrEqual(2);

    // First table has the <thead>
    expect(tables[0].querySelector("thead")).toBeTruthy();
  });

  // 3. Virtualization — only renders visible rows
  it("renders only a subset of rows when list is large", () => {
    const rows = makeRows(1000);
    render(
      <VirtualDataTable
        rows={rows}
        columns={columns}
        rowHeight={ROW_HEIGHT}
      />,
    );
    simulateResize(CONTAINER_HEIGHT);

    const dataRows = screen
      .queryAllByRole("row")
      .filter((r) =>
        r.getAttribute("data-testid")?.startsWith("virtual-row-"),
      );

    // 1000 rows should NOT all be in the DOM
    expect(dataRows.length).toBeLessThan(1000);
    // Should have at least visible rows + some overscan
    expect(dataRows.length).toBeGreaterThanOrEqual(10);
  });

  // 4. Overscan buffer
  it("respects custom overscan prop", () => {
    const rows = makeRows(100);
    render(
      <VirtualDataTable
        rows={rows}
        columns={columns}
        rowHeight={ROW_HEIGHT}
        overscan={2}
      />,
    );
    simulateResize(CONTAINER_HEIGHT);

    const dataRows = screen
      .getAllByRole("row")
      .filter((r) =>
        r.getAttribute("data-testid")?.startsWith("virtual-row-"),
      );

    // With overscan=2, 10 visible rows => ~14 rows rendered (10 + 2 + 2)
    expect(dataRows.length).toBeLessThanOrEqual(15);
  });

  // 5. Empty state
  it("renders empty state when rows is empty", () => {
    render(
      <VirtualDataTable rows={[]} columns={columns} rowHeight={ROW_HEIGHT} />,
    );

    expect(screen.getByText("No rows to display.")).toBeTruthy();
    expect(screen.getByText("ID")).toBeTruthy();
  });

  // 6. Row click callback
  it("calls onRowClick when a row is clicked", () => {
    const rows = makeRows(5);
    const onRowClick = jest.fn();
    render(
      <VirtualDataTable
        rows={rows}
        columns={columns}
        rowHeight={ROW_HEIGHT}
        onRowClick={onRowClick}
      />,
    );
    simulateResize(CONTAINER_HEIGHT);

    fireEvent.click(screen.getByTestId("virtual-row-0"));
    expect(onRowClick).toHaveBeenCalledWith(rows[0], 0);
  });

  // 7. Keyboard: ArrowDown
  it("moves focus down with ArrowDown", () => {
    const rows = makeRows(20);
    const onRowClick = jest.fn();
    render(
      <VirtualDataTable
        rows={rows}
        columns={columns}
        rowHeight={ROW_HEIGHT}
        onRowClick={onRowClick}
      />,
    );
    simulateResize(CONTAINER_HEIGHT);

    const container = screen.getByTestId("virtual-scroll-container");

    fireEvent.keyDown(container, { key: "ArrowDown" });
    fireEvent.keyDown(container, { key: "ArrowDown" });
    fireEvent.keyDown(container, { key: "Enter" });

    expect(onRowClick).toHaveBeenCalledWith(rows[2], 2);
  });

  // 8. Keyboard: ArrowUp
  it("moves focus up with ArrowUp", () => {
    const rows = makeRows(20);
    const onRowClick = jest.fn();
    render(
      <VirtualDataTable
        rows={rows}
        columns={columns}
        rowHeight={ROW_HEIGHT}
        focusedIndex={5}
        onRowClick={onRowClick}
      />,
    );
    simulateResize(CONTAINER_HEIGHT);

    const container = screen.getByTestId("virtual-scroll-container");

    fireEvent.keyDown(container, { key: "ArrowUp" });
    fireEvent.keyDown(container, { key: "Enter" });

    expect(onRowClick).toHaveBeenCalledWith(rows[4], 4);
  });

  // 9. Keyboard: Home
  it("jumps to first row with Home key", () => {
    const rows = makeRows(20);
    const onRowClick = jest.fn();
    render(
      <VirtualDataTable
        rows={rows}
        columns={columns}
        rowHeight={ROW_HEIGHT}
        focusedIndex={15}
        onRowClick={onRowClick}
      />,
    );
    simulateResize(CONTAINER_HEIGHT);

    const container = screen.getByTestId("virtual-scroll-container");

    fireEvent.keyDown(container, { key: "Home" });
    fireEvent.keyDown(container, { key: "Enter" });

    expect(onRowClick).toHaveBeenCalledWith(rows[0], 0);
  });

  // 10. Keyboard: End
  it("jumps to last row with End key", () => {
    const rows = makeRows(20);
    const onRowClick = jest.fn();
    render(
      <VirtualDataTable
        rows={rows}
        columns={columns}
        rowHeight={ROW_HEIGHT}
        onRowClick={onRowClick}
      />,
    );
    simulateResize(CONTAINER_HEIGHT);

    const container = screen.getByTestId("virtual-scroll-container");

    fireEvent.keyDown(container, { key: "End" });
    fireEvent.keyDown(container, { key: "Enter" });

    expect(onRowClick).toHaveBeenCalledWith(rows[19], 19);
  });

  // 11. scrollToIndex via ref
  it("scrolls to a specific index via imperative handle", () => {
    const rows = makeRows(100);
    const ref = createRef<VirtualDataTableHandle>();

    render(
      <VirtualDataTable
        ref={ref}
        rows={rows}
        columns={columns}
        rowHeight={ROW_HEIGHT}
      />,
    );
    simulateResize(CONTAINER_HEIGHT);

    // scrollToIndex should not throw; wrap in act for state updates
    expect(() => {
      act(() => {
        ref.current?.scrollToIndex(50);
      });
    }).not.toThrow();
  });

  // 12. Row count footer
  it("displays the row count footer", () => {
    const rows = makeRows(42);
    render(
      <VirtualDataTable
        rows={rows}
        columns={columns}
        rowHeight={ROW_HEIGHT}
      />,
    );

    const footer = screen.getByTestId("row-count");
    expect(footer.textContent).toContain("42");
    expect(footer.textContent).toContain("rows");
  });

  // 13. Singular "row" for count of 1
  it("uses singular 'row' when there is exactly 1 row", () => {
    const rows = makeRows(1);
    render(
      <VirtualDataTable
        rows={rows}
        columns={columns}
        rowHeight={ROW_HEIGHT}
      />,
    );

    const footer = screen.getByTestId("row-count");
    expect(footer.textContent).toContain("1 row");
    expect(footer.textContent).not.toContain("1 rows");
  });

  // 14. Custom render function
  it("uses custom render function for cell values", () => {
    const rows = makeRows(3);
    const customColumns: ColumnDef[] = [
      {
        key: "name",
        header: "Name",
        render: (_val, row) => (
          <span data-testid={`custom-${(row as Record<string, unknown>).id}`}>
            CUSTOM: {(row as Record<string, unknown>).name as string}
          </span>
        ),
      },
    ];

    render(
      <VirtualDataTable
        rows={rows}
        columns={customColumns}
        rowHeight={ROW_HEIGHT}
      />,
    );
    simulateResize(CONTAINER_HEIGHT);

    expect(screen.getByTestId("custom-0").textContent).toBe(
      "CUSTOM: Row 0",
    );
    expect(screen.getByTestId("custom-1").textContent).toBe(
      "CUSTOM: Row 1",
    );
  });

  // 15. Focused row highlight
  it("applies highlight style to the focused row", () => {
    const rows = makeRows(10);
    render(
      <VirtualDataTable
        rows={rows}
        columns={columns}
        rowHeight={ROW_HEIGHT}
        focusedIndex={3}
      />,
    );
    simulateResize(CONTAINER_HEIGHT);

    const focusedRow = screen.getByTestId("virtual-row-3");
    expect(focusedRow.style.background).toContain("rgba(175, 195, 214");
  });

  // 16. Keyboard: Space activates focused row
  it("activates focused row with Space key", () => {
    const rows = makeRows(10);
    const onRowClick = jest.fn();
    render(
      <VirtualDataTable
        rows={rows}
        columns={columns}
        rowHeight={ROW_HEIGHT}
        focusedIndex={2}
        onRowClick={onRowClick}
      />,
    );
    simulateResize(CONTAINER_HEIGHT);

    const container = screen.getByTestId("virtual-scroll-container");
    fireEvent.keyDown(container, { key: " " });

    expect(onRowClick).toHaveBeenCalledWith(rows[2], 2);
  });

  // 17. Keyboard: PageDown jumps by page
  it("jumps forward by page size with PageDown", () => {
    const rows = makeRows(100);
    const onRowClick = jest.fn();
    render(
      <VirtualDataTable
        rows={rows}
        columns={columns}
        rowHeight={ROW_HEIGHT}
        focusedIndex={0}
        onRowClick={onRowClick}
      />,
    );
    simulateResize(CONTAINER_HEIGHT);

    const container = screen.getByTestId("virtual-scroll-container");
    fireEvent.keyDown(container, { key: "PageDown" });
    fireEvent.keyDown(container, { key: "Enter" });

    // 360 / 36 = 10 rows per page, so focus should be at index 10
    expect(onRowClick).toHaveBeenCalledWith(rows[10], 10);
  });

  // 18. Keyboard: PageUp jumps back by page
  it("jumps backward by page size with PageUp", () => {
    const rows = makeRows(100);
    const onRowClick = jest.fn();
    render(
      <VirtualDataTable
        rows={rows}
        columns={columns}
        rowHeight={ROW_HEIGHT}
        focusedIndex={20}
        onRowClick={onRowClick}
      />,
    );
    simulateResize(CONTAINER_HEIGHT);

    const container = screen.getByTestId("virtual-scroll-container");
    fireEvent.keyDown(container, { key: "PageUp" });
    fireEvent.keyDown(container, { key: "Enter" });

    // Should be at index 10 (20 - 10)
    expect(onRowClick).toHaveBeenCalledWith(rows[10], 10);
  });

  // 19. Updates when rows change
  it("re-renders correctly when rows prop changes", () => {
    const initialRows = makeRows(5);
    const { rerender } = render(
      <VirtualDataTable
        rows={initialRows}
        columns={columns}
        rowHeight={ROW_HEIGHT}
      />,
    );

    expect(screen.getByTestId("row-count").textContent).toContain("5");

    const newRows = makeRows(50);
    rerender(
      <VirtualDataTable
        rows={newRows}
        columns={columns}
        rowHeight={ROW_HEIGHT}
      />,
    );

    expect(screen.getByTestId("row-count").textContent).toContain("50");
  });

  // 20. scroll-spacer enforces total height
  it("creates a scroll spacer with total height = rows * rowHeight", () => {
    const rows = makeRows(100);
    render(
      <VirtualDataTable
        rows={rows}
        columns={columns}
        rowHeight={ROW_HEIGHT}
      />,
    );

    const spacer = screen.getByTestId("scroll-spacer");
    expect(spacer.style.height).toBe(`${100 * ROW_HEIGHT}px`);
  });
});
