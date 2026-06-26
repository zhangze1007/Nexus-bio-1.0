"use client";
/**
 * GatePalette — sidebar palette of draggable circuit components.
 *
 * Users drag items from this palette onto the CircuitEditor canvas.
 * Each item carries a `nodeType` and default data in the drag event's
 * dataTransfer so the editor can create the correct React Flow node.
 */
import React, { useCallback } from "react";
import { THEME } from "../../theme";
import type { GateType } from "./circuitSimulator";

// ── Palette Item Definitions ────────────────────────────────────────────

interface PaletteItem {
  type: GateType;
  label: string;
  accent: string;
}

const PROMOTERS: PaletteItem[] = [
  { type: "promoter", label: "pTetR", accent: THEME.SKY },
  { type: "promoter", label: "pLac", accent: THEME.SKY },
  { type: "promoter", label: "pAra", accent: THEME.SKY },
  { type: "promoter", label: "pBAD", accent: THEME.SKY },
];

const GATES: PaletteItem[] = [
  { type: "andGate", label: "AND", accent: THEME.MINT },
  { type: "orGate", label: "OR", accent: THEME.LILAC },
  { type: "notGate", label: "NOT", accent: THEME.CORAL },
  { type: "norGate", label: "NOR", accent: THEME.APRICOT },
  { type: "nandGate", label: "NAND", accent: "#E8D0A1" },
];

const REPORTERS: PaletteItem[] = [
  { type: "reporter", label: "GFP", accent: THEME.MINT },
  { type: "reporter", label: "RFP", accent: THEME.CORAL },
  { type: "reporter", label: "LacZ", accent: THEME.SKY },
  { type: "reporter", label: "Luc", accent: THEME.LILAC },
];

// ── Palette Item Component ──────────────────────────────────────────────

function PaletteItemCard({ item }: { item: PaletteItem }) {
  const onDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData("application/circuitnode", JSON.stringify(item));
      e.dataTransfer.effectAllowed = "move";
    },
    [item],
  );

  return (
    <div
      draggable
      onDragStart={onDragStart}
      style={{
        padding: "8px 12px",
        background: THEME.PANEL_SURFACE,
        border: `1px solid ${item.accent}33`,
        borderRadius: THEME.R_SM,
        cursor: "grab",
        fontFamily: THEME.MONO,
        fontSize: THEME.FS_SM,
        color: THEME.VALUE,
        display: "flex",
        alignItems: "center",
        gap: 8,
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = `${item.accent}88`;
        (e.currentTarget as HTMLElement).style.boxShadow = `0 0 8px ${item.accent}22`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = `${item.accent}33`;
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: item.accent,
          flexShrink: 0,
        }}
      />
      <span>{item.label}</span>
    </div>
  );
}

// ── Section Component ───────────────────────────────────────────────────

function PaletteSection({ title, items }: { title: string; items: PaletteItem[] }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontFamily: THEME.SANS,
          fontSize: THEME.FS_XS,
          color: THEME.LABEL,
          textTransform: "uppercase",
          letterSpacing: 1.5,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {items.map((item) => (
          <PaletteItemCard key={`${item.type}-${item.label}`} item={item} />
        ))}
      </div>
    </div>
  );
}

// ── Gate Palette ────────────────────────────────────────────────────────

export interface GatePaletteProps {
  style?: React.CSSProperties;
}

export default function GatePalette({ style }: GatePaletteProps) {
  return (
    <div
      style={{
        width: 200,
        padding: 16,
        background: THEME.BG_SIDEBAR,
        borderRight: `1px solid ${THEME.BORDER}`,
        overflowY: "auto",
        fontFamily: THEME.SANS,
        ...style,
      }}
    >
      <div
        style={{
          fontFamily: THEME.BRAND,
          fontSize: THEME.FS_MD,
          fontWeight: 700,
          color: THEME.VALUE,
          marginBottom: 16,
        }}
      >
        Circuit Components
      </div>

      <PaletteSection title="Inputs" items={PROMOTERS} />
      <PaletteSection title="Gates" items={GATES} />
      <PaletteSection title="Outputs" items={REPORTERS} />

      <div
        style={{
          marginTop: 24,
          padding: 12,
          background: THEME.PANEL_SURFACE,
          borderRadius: THEME.R_SM,
          fontSize: THEME.FS_XS,
          color: THEME.DIM,
          lineHeight: 1.5,
        }}
      >
        <div style={{ fontWeight: 600, color: THEME.LABEL, marginBottom: 4 }}>How to use</div>
        Drag components onto the canvas. Connect output handles (right) to input handles (left).
        Press <kbd style={{ background: THEME.INPUT_BG, padding: "1px 4px", borderRadius: 3, fontSize: 10 }}>Del</kbd> to remove selected.
      </div>
    </div>
  );
}
