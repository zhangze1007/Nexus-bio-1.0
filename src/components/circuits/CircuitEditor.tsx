"use client";
/**
 * CircuitEditor — main visual drag-and-drop genetic circuit editor.
 *
 * Uses React Flow v12 for node placement, edge wiring, and canvas interaction.
 * Integrates with GatePalette for drag-drop, and circuitSimulator for simulation.
 *
 * Features:
 *   - Drag-and-drop node placement from GatePalette
 *   - Connect nodes by dragging handles
 *   - Delete nodes/edges with Delete/Backspace
 *   - Simulate button exports circuit definition
 *   - Zoom/pan canvas
 */
import React, { useCallback, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  Background,
  Controls,
  MiniMap,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { THEME } from "../../theme";
import { circuitNodeTypes, type CircuitNodeData } from "./CircuitNodes";
import GatePalette from "./GatePalette";
import SimulationResults from "./SimulationResults";
import {
  extractCircuitDefinition,
  simulateCircuit,
  type CircuitDefinition,
  type GateType,
  type SimulationResult,
} from "./circuitSimulator";

// ── Types ───────────────────────────────────────────────────────────────

export interface CircuitEditorProps {
  initialNodes?: Node<CircuitNodeData>[];
  initialEdges?: Edge[];
  onChange?: (nodes: Node<CircuitNodeData>[], edges: Edge[]) => void;
  onSimulate?: (circuit: CircuitDefinition) => void;
}

// ── Default starter nodes ───────────────────────────────────────────────

const DEFAULT_NODES: Node<CircuitNodeData>[] = [
  {
    id: "p1",
    type: "promoter",
    position: { x: 50, y: 100 },
    data: { label: "pTetR", gateType: "promoter" },
  },
  {
    id: "g1",
    type: "andGate",
    position: { x: 320, y: 80 },
    data: { label: "AND1", gateType: "andGate" },
  },
  {
    id: "r1",
    type: "reporter",
    position: { x: 600, y: 100 },
    data: { label: "GFP", gateType: "reporter" },
  },
];

const DEFAULT_EDGES: Edge[] = [
  { id: "e-p1-g1", source: "p1", target: "g1", sourceHandle: null, targetHandle: "in1" },
];

// ── Inner Editor (needs ReactFlowProvider) ──────────────────────────────

let nodeIdCounter = 10;

function CircuitEditorInner({
  initialNodes,
  initialEdges,
  onChange,
  onSimulate,
}: CircuitEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes ?? DEFAULT_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges ?? DEFAULT_EDGES);
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [showResults, setShowResults] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  // ── Edge connection ─────────────────────────────────────────────────

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, animated: true }, eds));
    },
    [setEdges],
  );

  // ── Drag-and-drop from palette ──────────────────────────────────────

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData("application/circuitnode");
      if (!raw) return;

      const item = JSON.parse(raw) as { type: GateType; label: string };
      const position = screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      const id = `node_${++nodeIdCounter}`;
      const newNode: Node<CircuitNodeData> = {
        id,
        type: item.type,
        position,
        data: { label: item.label, gateType: item.type },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [screenToFlowPosition, setNodes],
  );

  // ── Change callback ─────────────────────────────────────────────────

  const handleNodesChange: typeof onNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes);
      // Defer onChange to next tick so state has updated
      setTimeout(() => {
        setNodes((currentNodes) => {
          setEdges((currentEdges) => {
            onChange?.(currentNodes, currentEdges);
            return currentEdges;
          });
          return currentNodes;
        });
      }, 0);
    },
    [onNodesChange, onChange, setNodes, setEdges],
  );

  const handleEdgesChange: typeof onEdgesChange = useCallback(
    (changes) => {
      onEdgesChange(changes);
      setTimeout(() => {
        setNodes((currentNodes) => {
          setEdges((currentEdges) => {
            onChange?.(currentNodes, currentEdges);
            return currentEdges;
          });
          return currentNodes;
        });
      }, 0);
    },
    [onEdgesChange, onChange, setNodes, setEdges],
  );

  // ── Simulate ────────────────────────────────────────────────────────

  const handleSimulate = useCallback(() => {
    const flowNodes = nodes.map((n) => ({
      id: n.id,
      type: n.type ?? "promoter",
      data: {
        label: (n.data as CircuitNodeData).label,
        gateType: (n.data as CircuitNodeData).gateType,
        params: (n.data as CircuitNodeData).params,
      },
    }));
    const flowEdges = edges.map((e) => ({ source: e.source, target: e.target }));
    const circuit = extractCircuitDefinition(flowNodes, flowEdges);

    onSimulate?.(circuit);

    // Auto-simulate with default inputs (all promoters get concentration 1.0)
    const autoInputs: Record<string, number> = {};
    for (const node of nodes) {
      if ((node.data as CircuitNodeData).gateType === "promoter") {
        autoInputs[node.id] = 1.0;
      }
    }

    try {
      const result = simulateCircuit(circuit, autoInputs, 15, 0.05);
      setSimResult(result);
      setShowResults(true);
    } catch (err) {
      console.error("Simulation failed:", err);
    }
  }, [nodes, edges, onSimulate]);

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", height: "100%", width: "100%" }}>
      {/* Palette */}
      <GatePalette />

      {/* Canvas */}
      <div
        ref={reactFlowWrapper}
        style={{
          flex: 1,
          position: "relative",
          background: THEME.BG_CANVAS,
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={circuitNodeTypes}
          fitView
          deleteKeyCode={["Delete", "Backspace"]}
          defaultEdgeOptions={{
            animated: true,
            style: { stroke: THEME.SKY, strokeWidth: 2 },
          }}
          style={{ background: THEME.BG_CANVAS }}
          proOptions={{ hideAttribution: true }}
        >
          <Background color={THEME.BORDER} gap={20} size={1} />
          <Controls
            style={{
              background: THEME.PANEL_STRONG,
              borderColor: THEME.BORDER,
              borderRadius: THEME.R_SM,
            }}
          />
          <MiniMap
            nodeColor={(n) => {
              const gt = (n.data as CircuitNodeData)?.gateType;
              const colors: Record<string, string> = {
                promoter: THEME.SKY,
                andGate: THEME.MINT,
                orGate: THEME.LILAC,
                notGate: THEME.CORAL,
                norGate: THEME.APRICOT,
                nandGate: "#E8D0A1",
                reporter: THEME.MINT,
              };
              return colors[gt ?? ""] ?? THEME.LABEL;
            }}
            style={{
              background: THEME.PANEL_STRONG,
              border: `1px solid ${THEME.BORDER}`,
              borderRadius: THEME.R_SM,
            }}
            maskColor="rgba(5,5,5,0.7)"
          />
        </ReactFlow>

        {/* Simulate Button */}
        <button
          onClick={handleSimulate}
          style={{
            position: "absolute",
            bottom: 16,
            right: 16,
            padding: "10px 24px",
            background: `linear-gradient(135deg, ${THEME.MINT}, ${THEME.SKY})`,
            color: "#050505",
            border: "none",
            borderRadius: THEME.R_SM,
            fontFamily: THEME.SANS,
            fontSize: THEME.FS_MD,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: THEME.SHADOW_MEDIUM,
            zIndex: 10,
            transition: "transform 0.1s, box-shadow 0.1s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = THEME.SHADOW_HIGH;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = THEME.SHADOW_MEDIUM;
          }}
        >
          Simulate Circuit
        </button>

        {/* Simulation Results Overlay */}
        {showResults && simResult && (
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              width: 420,
              background: THEME.BG_SIDEBAR,
              borderLeft: `1px solid ${THEME.BORDER}`,
              zIndex: 20,
              overflowY: "auto",
            }}
          >
            <SimulationResults
              result={simResult}
              circuit={extractCircuitDefinition(
                nodes.map((n) => ({
                  id: n.id,
                  type: n.type ?? "promoter",
                  data: n.data as CircuitNodeData,
                })),
                edges.map((e) => ({ source: e.source, target: e.target })),
              )}
              onClose={() => setShowResults(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Wrapped with Provider ───────────────────────────────────────────────

export default function CircuitEditor(props: CircuitEditorProps) {
  return (
    <ReactFlowProvider>
      <CircuitEditorInner {...props} />
    </ReactFlowProvider>
  );
}
