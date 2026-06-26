"use client";
/**
 * Custom React Flow node types for the Gene Circuit Visual Editor.
 *
 * Node types:
 *   - promoter: Input node (sensor/promoter), has output handle only
 *   - andGate / orGate / notGate / norGate / nandGate: Logic gate nodes
 *   - reporter: Output node (reporter gene), has input handle only
 *
 * All nodes use the Nexus-Bio dark theme and pastel accent palette.
 */
import React, { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { THEME } from "../../theme";
import type { GateType } from "./circuitSimulator";

// ── Node Data Types ─────────────────────────────────────────────────────

export interface CircuitNodeData extends Record<string, unknown> {
  label: string;
  gateType: GateType;
  params?: { K?: number; n?: number; tau?: number };
}

export type PromoterNode = Node<CircuitNodeData, "promoter">;
export type AndGateNode = Node<CircuitNodeData, "andGate">;
export type OrGateNode = Node<CircuitNodeData, "orGate">;
export type NotGateNode = Node<CircuitNodeData, "notGate">;
export type NorGateNode = Node<CircuitNodeData, "norGate">;
export type NandGateNode = Node<CircuitNodeData, "nandGate">;
export type ReporterNode = Node<CircuitNodeData, "reporter">;

export type CircuitFlowNode =
  | PromoterNode
  | AndGateNode
  | OrGateNode
  | NotGateNode
  | NorGateNode
  | NandGateNode
  | ReporterNode;

// ── Shared Styles ───────────────────────────────────────────────────────

const NODE_BASE: React.CSSProperties = {
  minWidth: 140,
  padding: "10px 14px",
  borderRadius: THEME.R_SM,
  fontFamily: THEME.MONO,
  fontSize: THEME.FS_SM,
  color: THEME.VALUE,
  border: `1px solid ${THEME.BORDER}`,
  cursor: "grab",
  userSelect: "none",
};

const HANDLE_STYLE: React.CSSProperties = {
  width: 10,
  height: 10,
  border: `2px solid ${THEME.BORDER_STRONG}`,
  background: THEME.PANEL_STRONG,
};

const HANDLE_INPUT: React.CSSProperties = {
  ...HANDLE_STYLE,
  left: -6,
};

const HANDLE_OUTPUT: React.CSSProperties = {
  ...HANDLE_STYLE,
  right: -6,
};

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: THEME.SANS,
  fontSize: THEME.FS_XS,
  color: THEME.LABEL,
  marginTop: 2,
};

const NAME_STYLE: React.CSSProperties = {
  fontFamily: THEME.MONO,
  fontSize: THEME.FS_MD,
  fontWeight: 600,
  color: THEME.VALUE,
};

// ── Gate Type Metadata ──────────────────────────────────────────────────

const GATE_COLORS: Record<GateType, string> = {
  promoter: THEME.SKY,
  andGate: THEME.MINT,
  orGate: THEME.LILAC,
  notGate: THEME.CORAL,
  norGate: THEME.APRICOT,
  nandGate: "#E8D0A1",
  reporter: THEME.MINT,
};

const GATE_SYMBOLS: Record<string, string> = {
  promoter: "▶", // right triangle
  andGate: "AND",
  orGate: "OR",
  notGate: "NOT",
  norGate: "NOR",
  nandGate: "NAND",
  reporter: "◆", // diamond
};

// ── Promoter Node ───────────────────────────────────────────────────────

export const PromoterNode = memo(function PromoterNode({ data }: NodeProps<PromoterNode>) {
  const accent = GATE_COLORS.promoter;
  return (
    <div
      style={{
        ...NODE_BASE,
        background: `linear-gradient(135deg, ${THEME.PANEL_STRONG}, ${THEME.PANEL_SURFACE})`,
        borderColor: accent,
        boxShadow: `0 0 12px ${accent}22`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: accent, fontSize: THEME.FS_MD }}>{GATE_SYMBOLS.promoter}</span>
        <span style={NAME_STYLE}>{data.label}</span>
      </div>
      <div style={LABEL_STYLE}>Promoter / Sensor</div>
      <Handle type="source" position={Position.Right} style={{ ...HANDLE_OUTPUT, background: accent }} />
    </div>
  );
});

// ── Gate Node Factory ───────────────────────────────────────────────────

function makeGateNode(gateType: Exclude<GateType, "promoter" | "reporter">) {
  const Component = memo(function GateNodeComponent({ data }: NodeProps<AndGateNode>) {
    const accent = GATE_COLORS[gateType];
    const symbol = GATE_SYMBOLS[gateType];
    const isSingleInput = gateType === "notGate";

    return (
      <div
        style={{
          ...NODE_BASE,
          background: `linear-gradient(135deg, ${THEME.PANEL_STRONG}, ${THEME.PANEL_SURFACE})`,
          borderColor: accent,
          boxShadow: `0 0 12px ${accent}22`,
        }}
      >
        <Handle type="target" position={Position.Left} id="in1" style={{ ...HANDLE_INPUT, background: accent }} />
        {!isSingleInput && (
          <Handle
            type="target"
            position={Position.Left}
            id="in2"
            style={{ ...HANDLE_INPUT, background: accent, top: "70%" }}
          />
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              background: `${accent}22`,
              color: accent,
              padding: "2px 8px",
              borderRadius: 4,
              fontFamily: THEME.MONO,
              fontSize: THEME.FS_XS,
              fontWeight: 700,
              letterSpacing: 1,
            }}
          >
            {symbol}
          </span>
          <span style={NAME_STYLE}>{data.label}</span>
        </div>
        <div style={LABEL_STYLE}>Logic Gate</div>
        <Handle type="source" position={Position.Right} style={{ ...HANDLE_OUTPUT, background: accent }} />
      </div>
    );
  });
  Component.displayName = `${gateType}Node`;
  return Component;
}

export const AndGateNode = makeGateNode("andGate");
export const OrGateNode = makeGateNode("orGate");
export const NotGateNode = makeGateNode("notGate");
export const NorGateNode = makeGateNode("norGate");
export const NandGateNode = makeGateNode("nandGate");

// ── Reporter Node ───────────────────────────────────────────────────────

export const ReporterNode = memo(function ReporterNode({ data }: NodeProps<ReporterNode>) {
  const accent = GATE_COLORS.reporter;
  return (
    <div
      style={{
        ...NODE_BASE,
        background: `linear-gradient(135deg, ${THEME.PANEL_STRONG}, ${THEME.PANEL_SURFACE})`,
        borderColor: accent,
        boxShadow: `0 0 12px ${accent}22`,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ ...HANDLE_INPUT, background: accent }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: accent, fontSize: THEME.FS_MD }}>{GATE_SYMBOLS.reporter}</span>
        <span style={NAME_STYLE}>{data.label}</span>
      </div>
      <div style={LABEL_STYLE}>Reporter / Gene</div>
    </div>
  );
});

// ── Node Type Map (for React Flow) ──────────────────────────────────────

export const circuitNodeTypes = {
  promoter: PromoterNode,
  andGate: AndGateNode,
  orGate: OrGateNode,
  notGate: NotGateNode,
  norGate: NorGateNode,
  nandGate: NandGateNode,
  reporter: ReporterNode,
};
