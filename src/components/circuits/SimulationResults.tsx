"use client";
/**
 * SimulationResults — panel displaying circuit simulation output.
 *
 * Shows:
 *   - Line chart of node concentrations over time (Recharts)
 *   - Steady-state values table
 *   - Close button to dismiss
 */
import React, { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { THEME } from "../../theme";
import type { CircuitDefinition, SimulationResult, GateType } from "./circuitSimulator";

// ── Node accent colors ──────────────────────────────────────────────────

const GATE_COLORS: Record<string, string> = {
  promoter: THEME.SKY,
  andGate: THEME.MINT,
  orGate: THEME.LILAC,
  notGate: THEME.CORAL,
  norGate: THEME.APRICOT,
  nandGate: "#E8D0A1",
  reporter: THEME.MINT,
};

// ── Props ───────────────────────────────────────────────────────────────

interface SimulationResultsProps {
  result: SimulationResult;
  circuit: CircuitDefinition;
  onClose: () => void;
}

// ── Component ───────────────────────────────────────────────────────────

export default function SimulationResults({ result, circuit, onClose }: SimulationResultsProps) {
  // Build node name map for display
  const nodeNameMap = useMemo(() => {
    const map: Record<string, { name: string; type: GateType }> = {};
    for (const node of circuit.nodes) {
      map[node.id] = { name: node.name, type: node.type };
    }
    return map;
  }, [circuit]);

  // Build chart data: sample every Nth point to keep chart responsive
  const chartData = useMemo(() => {
    const { timePoints, concentrations } = result;
    const totalPoints = timePoints.length;
    const step = Math.max(1, Math.floor(totalPoints / 200));

    const data: Array<Record<string, number>> = [];
    for (let i = 0; i < totalPoints; i += step) {
      const row: Record<string, number> = { time: Number(timePoints[i].toFixed(3)) };
      for (const nodeId of Object.keys(concentrations)) {
        const name = nodeNameMap[nodeId]?.name ?? nodeId;
        row[name] = Number(concentrations[nodeId][i].toFixed(4));
      }
      data.push(row);
    }
    return data;
  }, [result, nodeNameMap]);

  // Line colors
  const lineColors = useMemo(() => {
    const colors: Record<string, string> = {};
    for (const node of circuit.nodes) {
      colors[node.name] = GATE_COLORS[node.type] ?? THEME.LABEL;
    }
    return colors;
  }, [circuit]);

  // Steady state entries sorted by execution order
  const steadyEntries = useMemo(() => {
    return circuit.nodes.map((node) => ({
      id: node.id,
      name: node.name,
      type: node.type,
      value: result.steadyState[node.id] ?? 0,
      color: GATE_COLORS[node.type] ?? THEME.LABEL,
    }));
  }, [circuit, result]);

  return (
    <div
      style={{
        padding: 16,
        fontFamily: THEME.SANS,
        color: THEME.VALUE,
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div
          style={{
            fontFamily: THEME.BRAND,
            fontSize: THEME.FS_LG,
            fontWeight: 700,
          }}
        >
          Simulation Results
        </div>
        <button
          onClick={onClose}
          style={{
            background: "transparent",
            border: `1px solid ${THEME.BORDER}`,
            borderRadius: THEME.R_SM,
            color: THEME.LABEL,
            padding: "4px 10px",
            cursor: "pointer",
            fontFamily: THEME.MONO,
            fontSize: THEME.FS_SM,
          }}
        >
          Close
        </button>
      </div>

      {/* Concentration Time Series Chart */}
      <div
        style={{
          background: THEME.PANEL_SURFACE,
          borderRadius: THEME.R_MD,
          padding: 16,
          border: `1px solid ${THEME.BORDER}`,
        }}
      >
        <div
          style={{
            fontFamily: THEME.SANS,
            fontSize: THEME.FS_SM,
            color: THEME.LABEL,
            marginBottom: 12,
            fontWeight: 600,
          }}
        >
          Concentration vs Time
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData}>
            <XAxis
              dataKey="time"
              stroke={THEME.DIM}
              tick={{ fontSize: 10, fontFamily: THEME.MONO }}
              label={{
                value: "Time",
                position: "insideBottomRight",
                offset: -5,
                style: { fontSize: 10, fill: THEME.DIM },
              }}
            />
            <YAxis
              domain={[0, 1]}
              stroke={THEME.DIM}
              tick={{ fontSize: 10, fontFamily: THEME.MONO }}
              label={{
                value: "Conc.",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 10, fill: THEME.DIM },
              }}
            />
            <Tooltip
              contentStyle={{
                background: THEME.PANEL_STRONG,
                border: `1px solid ${THEME.BORDER}`,
                borderRadius: THEME.R_SM,
                fontFamily: THEME.MONO,
                fontSize: THEME.FS_XS,
                color: THEME.VALUE,
              }}
              labelStyle={{ color: THEME.LABEL }}
            />
            <Legend
              wrapperStyle={{
                fontFamily: THEME.MONO,
                fontSize: THEME.FS_XS,
              }}
            />
            {circuit.nodes.map((node) => (
              <Line
                key={node.id}
                type="monotone"
                dataKey={node.name}
                stroke={GATE_COLORS[node.type] ?? THEME.LABEL}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Steady-State Values Table */}
      <div
        style={{
          background: THEME.PANEL_SURFACE,
          borderRadius: THEME.R_MD,
          padding: 16,
          border: `1px solid ${THEME.BORDER}`,
        }}
      >
        <div
          style={{
            fontFamily: THEME.SANS,
            fontSize: THEME.FS_SM,
            color: THEME.LABEL,
            marginBottom: 12,
            fontWeight: 600,
          }}
        >
          Steady-State Concentrations
        </div>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily: THEME.MONO,
            fontSize: THEME.FS_SM,
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  textAlign: "left",
                  padding: "6px 8px",
                  color: THEME.DIM,
                  borderBottom: `1px solid ${THEME.BORDER}`,
                }}
              >
                Node
              </th>
              <th
                style={{
                  textAlign: "left",
                  padding: "6px 8px",
                  color: THEME.DIM,
                  borderBottom: `1px solid ${THEME.BORDER}`,
                }}
              >
                Type
              </th>
              <th
                style={{
                  textAlign: "right",
                  padding: "6px 8px",
                  color: THEME.DIM,
                  borderBottom: `1px solid ${THEME.BORDER}`,
                }}
              >
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {steadyEntries.map((entry) => (
              <tr key={entry.id}>
                <td style={{ padding: "6px 8px", borderBottom: `1px solid ${THEME.BORDER}33` }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: entry.color,
                      marginRight: 8,
                    }}
                  />
                  {entry.name}
                </td>
                <td style={{ padding: "6px 8px", color: THEME.LABEL, borderBottom: `1px solid ${THEME.BORDER}33` }}>
                  {entry.type}
                </td>
                <td
                  style={{
                    padding: "6px 8px",
                    textAlign: "right",
                    fontWeight: 600,
                    borderBottom: `1px solid ${THEME.BORDER}33`,
                  }}
                >
                  {entry.value.toFixed(4)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Simulation Metadata */}
      <div
        style={{
          fontSize: THEME.FS_XS,
          color: THEME.DIM,
          fontFamily: THEME.MONO,
        }}
      >
        {result.timePoints.length} time points | t = 0 to {result.timePoints[result.timePoints.length - 1]?.toFixed(1)}
      </div>
    </div>
  );
}
