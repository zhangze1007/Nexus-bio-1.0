/**
 * FluxMap visualization tests.
 *
 * Verifies that the Escher-style flux map renders metabolite nodes,
 * reaction edges, flux-proportional widths, and responds to interactions.
 *
 * d3 is ESM-only so we mock it here. The mock runs a trivial "layout"
 * that assigns positions based on node order — enough to verify rendering.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";

// ── d3 mock ──────────────────────────────────────────────────────────────────
// Mock d3 modules so Jest (CJS) can parse them.

const mockNodes: any[] = [];

jest.mock("d3", () => {
  const mockSimulation = {
    force: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    tick: jest.fn().mockImplementation(function (this: any) {
      // Assign trivial grid positions to nodes
      for (let i = 0; i < mockNodes.length; i++) {
        mockNodes[i].x = 100 + (i % 3) * 200;
        mockNodes[i].y = 100 + Math.floor(i / 3) * 150;
      }
      return this;
    }),
  };

  const mockZoom = {
    scaleExtent: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
  };

  const mockSelection = {
    call: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    empty: jest.fn().mockReturnValue(true),
    attr: jest.fn().mockReturnThis(),
    transition: jest.fn().mockReturnThis(),
    duration: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
  };

  return {
    forceSimulation: jest.fn((nodes: any[]) => {
      mockNodes.length = 0;
      mockNodes.push(...nodes);
      return mockSimulation;
    }),
    forceLink: jest.fn(() => ({
      id: jest.fn().mockReturnThis(),
      distance: jest.fn().mockReturnThis(),
      strength: jest.fn().mockReturnThis(),
    })),
    forceManyBody: jest.fn(() => ({
      strength: jest.fn().mockReturnThis(),
    })),
    forceCenter: jest.fn(() => ({})),
    forceCollide: jest.fn(() => ({
      radius: jest.fn().mockReturnThis(),
    })),
    zoom: jest.fn(() => mockZoom),
    zoomIdentity: {},
    select: jest.fn(() => mockSelection),
  };
});

// Now import after mock is set up
import { FluxMap } from "../src/components/visualizations/FluxMap";
import type { FluxMapModel } from "../src/components/visualizations/FluxMap";

// ── Minimal test model ───────────────────────────────────────────────────────

const testModel: FluxMapModel = {
  metabolites: [
    { id: "glc", name: "Glucose" },
    { id: "g6p", name: "G6P" },
    { id: "f6p", name: "F6P" },
    { id: "pyr", name: "Pyruvate" },
    { id: "accoa", name: "AcCoA" },
  ],
  reactions: [
    {
      id: "GLCpts",
      name: "Glucose PTS",
      stoichiometry: { glc: -1, g6p: 1 },
      subsystem: "Glycolysis",
    },
    {
      id: "PGI",
      name: "Phosphoglucose isomerase",
      stoichiometry: { g6p: -1, f6p: 1 },
      subsystem: "Glycolysis",
    },
    {
      id: "PDH",
      name: "Pyruvate dehydrogenase",
      stoichiometry: { pyr: -1, accoa: 1 },
      subsystem: "TCA",
    },
  ],
};

const testFluxes: Record<string, number> = {
  GLCpts: 10.0,
  PGI: 9.5,
  PDH: -3.2, // reverse flux
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe("FluxMap", () => {
  it("renders without crashing", () => {
    render(<FluxMap model={testModel} fluxes={testFluxes} />);
    expect(screen.getByTestId("flux-map-container")).toBeTruthy();
    expect(screen.getByTestId("flux-map-svg")).toBeTruthy();
  });

  it("renders metabolite nodes", () => {
    render(<FluxMap model={testModel} fluxes={testFluxes} />);
    expect(screen.getByTestId("metabolite-node-glc")).toBeTruthy();
    expect(screen.getByTestId("metabolite-node-g6p")).toBeTruthy();
    expect(screen.getByTestId("metabolite-node-f6p")).toBeTruthy();
    expect(screen.getByTestId("metabolite-node-pyr")).toBeTruthy();
    expect(screen.getByTestId("metabolite-node-accoa")).toBeTruthy();
  });

  it("renders reaction edges", () => {
    render(<FluxMap model={testModel} fluxes={testFluxes} />);
    expect(screen.getByTestId("reaction-edge-GLCpts")).toBeTruthy();
    expect(screen.getByTestId("reaction-edge-PGI")).toBeTruthy();
    expect(screen.getByTestId("reaction-edge-PDH")).toBeTruthy();
  });

  it("renders subsystem background rectangles", () => {
    render(<FluxMap model={testModel} fluxes={testFluxes} />);
    expect(screen.getByTestId("subsystem-bg-Glycolysis")).toBeTruthy();
    expect(screen.getByTestId("subsystem-bg-TCA")).toBeTruthy();
  });

  it("applies flux-proportional edge widths (higher flux = wider edge)", () => {
    const { container } = render(
      <FluxMap model={testModel} fluxes={testFluxes} />,
    );
    // GLCpts has flux 10.0, PGI has flux 9.5 — both high
    // PDH has |flux| = 3.2 — should be narrower
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBeGreaterThan(0);

    const strokeWidths: number[] = [];
    paths.forEach((p) => {
      const sw = p.getAttribute("stroke-width");
      if (sw) strokeWidths.push(parseFloat(sw));
    });
    // We have 3 reactions, each producing one path
    expect(strokeWidths.length).toBeGreaterThanOrEqual(3);
    // GLCpts (10.0) should be wider than PDH (3.2)
    // Find widths by stroke color: GLCpts is mint (#BFDCCD), PDH is coral (#E8A3A1)
    const mintWidths: number[] = [];
    const coralWidths: number[] = [];
    paths.forEach((p) => {
      const sw = p.getAttribute("stroke-width");
      const stroke = p.getAttribute("stroke");
      if (!sw) return;
      if (stroke === "#BFDCCD") mintWidths.push(parseFloat(sw));
      if (stroke === "#E8A3A1") coralWidths.push(parseFloat(sw));
    });
    if (mintWidths.length > 0 && coralWidths.length > 0) {
      expect(Math.max(...mintWidths)).toBeGreaterThan(Math.min(...coralWidths));
    }
  });

  it("uses different colors for forward and reverse flux", () => {
    const { container } = render(
      <FluxMap model={testModel} fluxes={testFluxes} />,
    );
    const paths = container.querySelectorAll("path");
    const strokes = new Set<string>();
    paths.forEach((p) => {
      const s = p.getAttribute("stroke");
      if (s) strokes.add(s);
    });
    // Should have mint for forward and coral for reverse
    expect(strokes.has("#BFDCCD")).toBe(true); // forward
    expect(strokes.has("#E8A3A1")).toBe(true); // reverse
  });

  it("calls onReactionClick when a reaction edge is clicked", () => {
    const onClick = jest.fn();
    render(
      <FluxMap model={testModel} fluxes={testFluxes} onReactionClick={onClick} />,
    );
    const edge = screen.getByTestId("reaction-edge-GLCpts");
    fireEvent.click(edge);
    expect(onClick).toHaveBeenCalledWith("GLCpts");
  });

  it("calls onMetaboliteClick when a metabolite node is clicked", () => {
    const onClick = jest.fn();
    render(
      <FluxMap model={testModel} fluxes={testFluxes} onMetaboliteClick={onClick} />,
    );
    const node = screen.getByTestId("metabolite-node-glc");
    fireEvent.click(node);
    expect(onClick).toHaveBeenCalledWith("glc");
  });

  it("shows tooltip on metabolite hover", () => {
    render(<FluxMap model={testModel} fluxes={testFluxes} />);
    const node = screen.getByTestId("metabolite-node-glc");
    fireEvent.mouseEnter(node, { clientX: 100, clientY: 200 });
    expect(screen.getByTestId("flux-map-tooltip")).toBeTruthy();
    expect(screen.getByTestId("flux-map-tooltip").textContent).toContain("Glucose");
  });

  it("shows tooltip on reaction hover", () => {
    render(<FluxMap model={testModel} fluxes={testFluxes} />);
    const edge = screen.getByTestId("reaction-edge-GLCpts");
    fireEvent.mouseEnter(edge, { clientX: 100, clientY: 200 });
    expect(screen.getByTestId("flux-map-tooltip")).toBeTruthy();
    expect(screen.getByTestId("flux-map-tooltip").textContent).toContain("Glucose PTS");
  });

  it("handles empty model gracefully", () => {
    const emptyModel: FluxMapModel = { metabolites: [], reactions: [] };
    render(<FluxMap model={emptyModel} fluxes={{}} />);
    expect(screen.getByTestId("flux-map-container")).toBeTruthy();
  });

  it("handles zero flux (gray edges)", () => {
    const zeroFluxes = { GLCpts: 0, PGI: 0, PDH: 0 };
    const { container } = render(
      <FluxMap model={testModel} fluxes={zeroFluxes} />,
    );
    const paths = container.querySelectorAll("path");
    paths.forEach((p) => {
      expect(p.getAttribute("stroke")).toBe("#333");
    });
  });

  it("respects custom width and height", () => {
    render(<FluxMap model={testModel} fluxes={testFluxes} width={1200} height={800} />);
    const svg = screen.getByTestId("flux-map-svg");
    expect(svg.getAttribute("viewBox")).toBe("0 0 1200 800");
  });
});
