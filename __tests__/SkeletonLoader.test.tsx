/**
 * Tests for SkeletonLoader components.
 *
 * Covers: SkeletonLine, SkeletonCard, SkeletonTable, SkeletonChart.
 * Verifies rendering, props, shimmer animation, and dark-theme colors.
 */

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  SkeletonLine,
  SkeletonCard,
  SkeletonTable,
  SkeletonChart,
} from "../src/components/shared/SkeletonLoader";

// ── Helpers ────────────────────────────────────────────────────────────

/** Collect all skeleton-bone divs inside a container. */
function bones(container: HTMLElement) {
  return container.querySelectorAll('[data-testid="skeleton-bone"]');
}

// ── SkeletonLine ───────────────────────────────────────────────────────

describe("SkeletonLine", () => {
  it("renders a single bone when count=1", () => {
    const { container } = render(<SkeletonLine />);
    expect(bones(container)).toHaveLength(1);
  });

  it("renders the requested number of lines", () => {
    const { container } = render(<SkeletonLine count={4} />);
    // count>1 wraps in a group div; bones are children of that group
    const group = screen.getByTestId("skeleton-line-group");
    expect(group.children).toHaveLength(4);
  });

  it("applies custom width and height to single line", () => {
    const { container } = render(<SkeletonLine width="60%" height={20} />);
    const bone = bones(container)[0] as HTMLElement;
    expect(bone.style.width).toBe("60%");
    expect(bone.style.height).toBe("20px");
  });

  it("shortens the last line when count > 1", () => {
    const { container } = render(<SkeletonLine count={3} width="100%" />);
    const allBones = bones(container);
    const lastBone = allBones[allBones.length - 1] as HTMLElement;
    expect(lastBone.style.width).toBe("70%");
  });

  it("uses CSS shimmer animation", () => {
    const { container } = render(<SkeletonLine />);
    const bone = bones(container)[0] as HTMLElement;
    expect(bone.style.animation).toContain("shimmer");
  });
});

// ── SkeletonCard ───────────────────────────────────────────────────────

describe("SkeletonCard", () => {
  it("renders a card container with border radius", () => {
    render(<SkeletonCard />);
    const card = screen.getByTestId("skeleton-card");
    expect(card).toBeInTheDocument();
    expect(card.style.borderRadius).toBeTruthy();
  });

  it("renders header by default (avatar + title bones)", () => {
    const { container } = render(<SkeletonCard showHeader={true} />);
    // Card header: 2 bones (circle avatar + line)
    const card = screen.getByTestId("skeleton-card");
    const firstRow = card.firstElementChild as HTMLElement;
    expect(bones(firstRow)).toHaveLength(2);
  });

  it("hides header when showHeader=false", () => {
    const { container } = render(<SkeletonCard showHeader={false} bodyLines={2} />);
    const card = screen.getByTestId("skeleton-card");
    // First child should be the body flex container, not a header row
    const allBones = bones(card);
    // Only body lines, no header bones
    expect(allBones).toHaveLength(2);
  });

  it("renders the requested number of body lines", () => {
    const { container } = render(<SkeletonCard bodyLines={5} />);
    const card = screen.getByTestId("skeleton-card");
    // Header: 2 bones, body: 5 bones = 7 total
    expect(bones(card)).toHaveLength(7);
  });

  it("applies dark-theme base color", () => {
    render(<SkeletonCard />);
    const card = screen.getByTestId("skeleton-card");
    // BASE_COLOR = #10131a — jsdom normalizes hex to rgb()
    expect(card.style.background).toMatch(/rgb\(16,\s*19,\s*26\)/);
  });
});

// ── SkeletonTable ──────────────────────────────────────────────────────

describe("SkeletonTable", () => {
  it("renders a header row by default", () => {
    render(<SkeletonTable />);
    expect(screen.getByTestId("skeleton-table-header")).toBeInTheDocument();
  });

  it("hides header when showHeader=false", () => {
    render(<SkeletonTable showHeader={false} />);
    expect(screen.queryByTestId("skeleton-table-header")).not.toBeInTheDocument();
  });

  it("renders the correct number of data rows", () => {
    render(<SkeletonTable rows={3} />);
    const rows = screen.getAllByTestId("skeleton-table-row");
    expect(rows).toHaveLength(3);
  });

  it("renders the correct number of columns per row", () => {
    render(<SkeletonTable columns={5} rows={1} />);
    const row = screen.getAllByTestId("skeleton-table-row")[0];
    // Each column gets a bone
    expect(bones(row)).toHaveLength(5);
  });

  it("uses grid layout with repeat columns", () => {
    render(<SkeletonTable columns={3} />);
    const header = screen.getByTestId("skeleton-table-header");
    expect(header.style.gridTemplateColumns).toBe("repeat(3, 1fr)");
  });

  it("alternates row background colors", () => {
    render(<SkeletonTable rows={3} />);
    const rows = screen.getAllByTestId("skeleton-table-row");
    const bg0 = (rows[0] as HTMLElement).style.background;
    const bg1 = (rows[1] as HTMLElement).style.background;
    expect(bg0).not.toBe(bg1);
  });
});

// ── SkeletonChart ──────────────────────────────────────────────────────

describe("SkeletonChart", () => {
  it("renders the chart container", () => {
    render(<SkeletonChart />);
    expect(screen.getByTestId("skeleton-chart")).toBeInTheDocument();
  });

  it("renders axes by default", () => {
    render(<SkeletonChart />);
    expect(screen.getByTestId("skeleton-chart-yaxis")).toBeInTheDocument();
    expect(screen.getByTestId("skeleton-chart-xaxis")).toBeInTheDocument();
  });

  it("hides axes when showAxes=false", () => {
    render(<SkeletonChart showAxes={false} />);
    expect(screen.queryByTestId("skeleton-chart-yaxis")).not.toBeInTheDocument();
    expect(screen.queryByTestId("skeleton-chart-xaxis")).not.toBeInTheDocument();
  });

  it("renders the requested number of bars", () => {
    render(<SkeletonChart bars={8} />);
    const barsContainer = screen.getByTestId("skeleton-chart-bars");
    // Each bar is wrapped in a flex column div
    expect(barsContainer.children).toHaveLength(8);
  });

  it("applies custom height to container", () => {
    render(<SkeletonChart height={300} />);
    const chart = screen.getByTestId("skeleton-chart") as HTMLElement;
    expect(chart.style.height).toBe("300px");
  });
});

// ── Cross-cutting: shimmer animation & dark theme ─────────────────────

describe("shimmer animation & dark theme", () => {
  it("all bones use shimmer animation", () => {
    const { container } = render(
      <>
        <SkeletonLine />
        <SkeletonCard />
        <SkeletonChart />
      </>,
    );
    const allBones = bones(container);
    expect(allBones.length).toBeGreaterThan(0);
    allBones.forEach((bone) => {
      expect((bone as HTMLElement).style.animation).toContain("shimmer");
    });
  });

  it("no bone uses a light background color", () => {
    const { container } = render(
      <>
        <SkeletonLine />
        <SkeletonCard />
        <SkeletonTable />
      </>,
    );
    const allBones = bones(container);
    allBones.forEach((bone) => {
      const bg = (bone as HTMLElement).style.background;
      // Must not contain white or light backgrounds
      expect(bg).not.toContain("#fff");
      expect(bg).not.toContain("#FFF");
      expect(bg).not.toContain("#f5f7fa");
      expect(bg).not.toContain("#F5F7FA");
    });
  });
});
