"use client";
import React from "react";
import type { GateType } from "../../../data/mockGECAIR";
import { hillInhibition } from "../../../data/mockGECAIR";
import { THEME } from "../../../theme";
import { PAPER_THEME } from "../../charts/chartTheme";
import { SVGChartContainer } from "../../charts/primitives";
import { PART_COLORS, resolveGateOutput, viridisColor } from "./sharedComponents";

export function CircuitSVG({
  inputA,
  inputB,
  gateType,
  view = "full",
}: {
  inputA: number;
  inputB: number;
  gateType: GateType;
  view?: "full" | "phasespace" | "transfer" | "dynamics";
}) {
  // outA / outB are the repressed signal levels from each input repressor.
  // resolveGateOutput combines these repressed signals directly — it does NOT
  // apply hillInhibition again internally, so there is no double-transformation.
  const outA = hillInhibition(inputA);
  const outB = hillInhibition(inputB);
  const outC = resolveGateOutput(outA, outB, gateType);
  const W = 720;
  const H = 500;

  // ── SBOL circuit layout ──
  const bbY = 108; // backbone Y center
  const bbX1 = 52,
    bbX2 = 308;
  const exprLevel = outC; // expression level 0-1

  // Phase space heatmap (30×30 viridis)
  const PS_LEFT = 42,
    PS_TOP = 158,
    PS_SIZE = 260,
    GRID = 30;
  const cellSize = PS_SIZE / GRID;
  const phaseHeat = Array.from({ length: GRID }, (_, yi) =>
    Array.from({ length: GRID }, (_, xi) => {
      const a = xi / (GRID - 1);
      const b = 1 - yi / (GRID - 1);
      return resolveGateOutput(hillInhibition(a), hillInhibition(b), gateType);
    }),
  );

  // Right panel: transfer curves
  function responseCurve(inputId: "A" | "B") {
    const pts: string[] = [];
    for (let i = 0; i <= 48; i++) {
      const xValue = i / 48;
      const yValue = hillInhibition(xValue);
      const x = 348 + xValue * 148;
      const y = 118 - yValue * 72;
      pts.push(`${x},${y}`);
    }
    const markerInput = inputId === "A" ? inputA : inputB;
    const markerOutput = hillInhibition(markerInput);
    return {
      points: pts.join(" "),
      markerX: 348 + markerInput * 148,
      markerY: 118 - markerOutput * 72,
      markerOutput,
    };
  }

  const curveA = responseCurve("A");
  const curveB = responseCurve("B");
  const nodeRows = [
    { label: "Sensor A", value: outA, tone: THEME.coral, detail: "Hill repression from input A" },
    { label: "Sensor B", value: outB, tone: THEME.apricot, detail: "Hill repression from input B" },
    { label: `${gateType} Output`, value: outC, tone: THEME.mint, detail: "Combined gate expression state" },
  ];

  return (
    <SVGChartContainer W={W} H={H} ariaLabel="Gene circuit diagram" variant="paper">
      <text
        x="24"
        y="22"
        fontFamily={PAPER_THEME.tickFont}
        fontSize={PAPER_THEME.tickSize}
        fill={PAPER_THEME.tickColor}
      >
        GENE CIRCUIT · SBOL NOTATION
      </text>
      <text
        x="24"
        y="36"
        fontFamily={PAPER_THEME.titleFont}
        fontSize={PAPER_THEME.labelSize}
        fill={PAPER_THEME.titleColor}
      >
        {gateType} gate — biological parts and 2D phase space response
      </text>

      {/* ── SBOL circuit diagram ── */}
      <rect
        x={bbX1 - 8}
        y={bbY - 44}
        width={bbX2 - bbX1 + 16}
        height={96}
        rx={PAPER_THEME.borderRadius}
        fill={PAPER_THEME.bgAlt}
        stroke={PAPER_THEME.border}
      />
      <text
        x={bbX1 - 4}
        y={bbY - 36}
        fontFamily={PAPER_THEME.tickFont}
        fontSize={PAPER_THEME.tickSize}
        fill={PAPER_THEME.tickColor}
      >
        GENETIC ARCHITECTURE
      </text>
      {/* Backbone line */}
      <line x1={bbX1} y1={bbY} x2={bbX2} y2={bbY} stroke={PAPER_THEME.axis} strokeWidth="2" />

      {/* Promoter — purple filled pentagon/arrow at x=65 */}
      <polygon
        points={`65,${bbY} 80,${bbY} 80,${bbY - 22} 90,${bbY - 12} 80,${bbY - 2} 80,${bbY - 22}`}
        fill="rgba(207,196,227,0.85)"
        stroke={PART_COLORS.promoter}
        strokeWidth="1"
      />
      <text x={77} y={bbY + 14} textAnchor="middle" fontFamily={THEME.MONO} fontSize="10" fill={PART_COLORS.promoter}>
        P
      </text>

      {/* RBS — blue half-circle arc above backbone at x=116 */}
      <path
        d={`M 106,${bbY} A 10 10 0 0 1 126,${bbY}`}
        fill="rgba(175,195,214,0.82)"
        stroke={PART_COLORS.rbs}
        strokeWidth="1"
      />
      <text x={116} y={bbY + 14} textAnchor="middle" fontFamily={THEME.MONO} fontSize="10" fill={PART_COLORS.rbs}>
        RBS
      </text>

      {/* CDS — orange arrow rectangle at x=148 */}
      <polygon
        points={`138,${bbY - 16} 190,${bbY - 16} 206,${bbY} 190,${bbY + 16} 138,${bbY + 16}`}
        fill={`rgba(231,199,169,${0.3 + exprLevel * 0.55})`}
        stroke={PART_COLORS.cds}
        strokeWidth="1.2"
      />
      <text x={172} y={bbY + 4} textAnchor="middle" fontFamily={THEME.MONO} fontSize="10" fill={PART_COLORS.cds}>
        {gateType}
      </text>

      {/* Terminator — red T-shape at x=252 */}
      <line x1={252} y1={bbY - 20} x2={252} y2={bbY + 2} stroke={PART_COLORS.terminator} strokeWidth="2.5" />
      <line x1={240} y1={bbY - 20} x2={264} y2={bbY - 20} stroke={PART_COLORS.terminator} strokeWidth="2.5" />
      <text
        x={252}
        y={bbY + 14}
        textAnchor="middle"
        fontFamily={THEME.MONO}
        fontSize="10"
        fill={PART_COLORS.terminator}
      >
        T
      </text>

      {/* Output arrow at right end */}
      <line
        x1={bbX2}
        y1={bbY}
        x2={bbX2 + 18}
        y2={bbY}
        stroke={PAPER_THEME.axis}
        strokeWidth="1.5"
        markerEnd="url(#gecair-arrow)"
      />
      <defs>
        <marker id="gecair-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <polygon points="0 0.5, 5.5 3, 0 5.5" fill={PAPER_THEME.axis} />
        </marker>
      </defs>
      <text
        x={bbX2 + 22}
        y={bbY + 4}
        fontFamily={PAPER_THEME.tickFont}
        fontSize={PAPER_THEME.tickSize}
        fill={PAPER_THEME.tickColor}
      >
        {(outC * 100).toFixed(0)}%
      </text>

      {/* ── 2D Phase Space heatmap (viridis, 30×30) ── */}
      <text
        x={PS_LEFT}
        y={PS_TOP - 10}
        fontFamily={PAPER_THEME.tickFont}
        fontSize={PAPER_THEME.tickSize}
        fill={PAPER_THEME.tickColor}
      >
        PHASE SPACE · Output = {viridisColor(0).includes("68") ? "low" : ""} → high (viridis)
      </text>
      <rect
        x={PS_LEFT - 2}
        y={PS_TOP - 2}
        width={PS_SIZE + 4}
        height={PS_SIZE + 4}
        rx={PAPER_THEME.borderRadius}
        fill="none"
        stroke={PAPER_THEME.border}
      />

      {/* Heatmap cells */}
      {phaseHeat.map((row, yi) =>
        row.map((val, xi) => (
          <rect
            key={`ps-${xi}-${yi}`}
            x={PS_LEFT + xi * cellSize}
            y={PS_TOP + yi * cellSize}
            width={cellSize}
            height={cellSize}
            fill={viridisColor(val)}
            opacity={0.9}
          />
        )),
      )}

      {/* Isocontour lines (marching squares) */}
      <g opacity="0.4">
        {[0.25, 0.5, 0.75].map((level) => {
          const GRID = phaseHeat.length;
          const paths: string[] = [];

          for (let yi = 0; yi < GRID - 1; yi++) {
            for (let xi = 0; xi < GRID - 1; xi++) {
              const v00 = phaseHeat[yi][xi];
              const v10 = phaseHeat[yi][xi + 1];
              const v01 = phaseHeat[yi + 1][xi];
              const v11 = phaseHeat[yi + 1][xi + 1];

              const code =
                (v00 >= level ? 1 : 0) | (v10 >= level ? 2 : 0) | (v11 >= level ? 4 : 0) | (v01 >= level ? 8 : 0);

              if (code === 0 || code === 15) continue;

              const x0 = PS_LEFT + xi * cellSize + cellSize / 2;
              const y0 = PS_TOP + yi * cellSize + cellSize / 2;
              const x1 = PS_LEFT + (xi + 1) * cellSize + cellSize / 2;
              const y1 = PS_TOP + (yi + 1) * cellSize + cellSize / 2;

              const interpX = (va: number, vb: number, a: number, b: number) => {
                const t = (level - va) / (vb - va);
                return a + t * (b - a);
              };

              const top = { x: interpX(v00, v10, x0, x1), y: y0 };
              const bottom = { x: interpX(v01, v11, x0, x1), y: y1 };
              const left = { x: x0, y: interpX(v00, v01, y0, y1) };
              const right = { x: x1, y: interpX(v10, v11, y0, y1) };

              const seg = (ax: number, ay: number, bx: number, by: number) =>
                `M${ax.toFixed(1)},${ay.toFixed(1)}L${bx.toFixed(1)},${by.toFixed(1)}`;

              switch (code) {
                case 1:
                case 14:
                  paths.push(seg(top.x, top.y, left.x, left.y));
                  break;
                case 2:
                case 13:
                  paths.push(seg(top.x, top.y, right.x, right.y));
                  break;
                case 3:
                case 12:
                  paths.push(seg(left.x, left.y, right.x, right.y));
                  break;
                case 4:
                case 11:
                  paths.push(seg(right.x, right.y, bottom.x, bottom.y));
                  break;
                case 5:
                  paths.push(seg(top.x, top.y, right.x, right.y));
                  paths.push(seg(left.x, left.y, bottom.x, bottom.y));
                  break;
                case 6:
                case 9:
                  paths.push(seg(top.x, top.y, bottom.x, bottom.y));
                  break;
                case 7:
                case 8:
                  paths.push(seg(left.x, left.y, bottom.x, bottom.y));
                  break;
                case 10:
                  paths.push(seg(top.x, top.y, left.x, left.y));
                  paths.push(seg(right.x, right.y, bottom.x, bottom.y));
                  break;
              }
            }
          }

          return paths.length > 0 ? (
            <path key={`contour-${level}`} d={paths.join("")} fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="0.8" />
          ) : null;
        })}
      </g>

      {/* Crosshair at current (inputA, inputB) */}
      <line
        x1={PS_LEFT + inputA * PS_SIZE}
        y1={PS_TOP}
        x2={PS_LEFT + inputA * PS_SIZE}
        y2={PS_TOP + PS_SIZE}
        stroke={PAPER_THEME.axis}
        strokeWidth="1"
        strokeDasharray="3 2"
      />
      <line
        x1={PS_LEFT}
        y1={PS_TOP + (1 - inputB) * PS_SIZE}
        x2={PS_LEFT + PS_SIZE}
        y2={PS_TOP + (1 - inputB) * PS_SIZE}
        stroke={PAPER_THEME.axis}
        strokeWidth="1"
        strokeDasharray="3 2"
      />
      <circle
        cx={PS_LEFT + inputA * PS_SIZE}
        cy={PS_TOP + (1 - inputB) * PS_SIZE}
        r={6}
        fill="none"
        stroke={PAPER_THEME.scatterStroke}
        strokeWidth="1.8"
      />
      {/* Axes */}
      <text
        x={PS_LEFT + PS_SIZE / 2}
        y={PS_TOP + PS_SIZE + 16}
        textAnchor="middle"
        fontFamily={PAPER_THEME.tickFont}
        fontSize={PAPER_THEME.tickSize}
        fill={PAPER_THEME.tickColor}
      >
        Input A (0→1)
      </text>
      <text
        x={PS_LEFT - 14}
        y={PS_TOP + PS_SIZE / 2}
        textAnchor="middle"
        fontFamily={PAPER_THEME.tickFont}
        fontSize={PAPER_THEME.tickSize}
        fill={PAPER_THEME.tickColor}
        transform={`rotate(-90,${PS_LEFT - 14},${PS_TOP + PS_SIZE / 2})`}
      >
        Input B (0→1)
      </text>
      {/* Tick marks */}
      {[0, 0.5, 1].map((tick) => (
        <g key={tick}>
          <text
            x={PS_LEFT + tick * PS_SIZE}
            y={PS_TOP + PS_SIZE + 8}
            textAnchor="middle"
            fontFamily={PAPER_THEME.tickFont}
            fontSize={PAPER_THEME.tickSize}
            fill={PAPER_THEME.tickColor}
          >
            {tick.toFixed(1)}
          </text>
          <text
            x={PS_LEFT - 4}
            y={PS_TOP + (1 - tick) * PS_SIZE + 3}
            textAnchor="end"
            fontFamily={PAPER_THEME.tickFont}
            fontSize={PAPER_THEME.tickSize}
            fill={PAPER_THEME.tickColor}
          >
            {tick.toFixed(1)}
          </text>
        </g>
      ))}
      {/* Viridis color bar */}
      <defs>
        <linearGradient id="gecair-viridis" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={viridisColor(0)} />
          <stop offset="25%" stopColor={viridisColor(0.25)} />
          <stop offset="50%" stopColor={viridisColor(0.5)} />
          <stop offset="75%" stopColor={viridisColor(0.75)} />
          <stop offset="100%" stopColor={viridisColor(1)} />
        </linearGradient>
      </defs>
      <rect x={PS_LEFT + PS_SIZE + 8} y={PS_TOP} width="10" height={PS_SIZE} fill="url(#gecair-viridis)" rx="3" />
      <text
        x={PS_LEFT + PS_SIZE + 22}
        y={PS_TOP + 6}
        fontFamily={PAPER_THEME.tickFont}
        fontSize={PAPER_THEME.tickSize}
        fill={PAPER_THEME.tickColor}
      >
        1.0
      </text>
      <text
        x={PS_LEFT + PS_SIZE + 22}
        y={PS_TOP + PS_SIZE + 2}
        fontFamily={PAPER_THEME.tickFont}
        fontSize={PAPER_THEME.tickSize}
        fill={PAPER_THEME.tickColor}
      >
        0.0
      </text>

      {/* ── Right: Transfer curves ── */}
      <rect
        x="324"
        y="54"
        width="382"
        height="92"
        rx={PAPER_THEME.borderRadius}
        fill={PAPER_THEME.bgAlt}
        stroke={PAPER_THEME.border}
      />
      <text
        x="338"
        y="74"
        fontFamily={PAPER_THEME.tickFont}
        fontSize={PAPER_THEME.tickSize}
        fill={PAPER_THEME.tickColor}
      >
        TRANSFER CURVES
      </text>

      {/* Area fill under Hill curves */}
      <polygon
        points={`${curveA.points} ${curveA.points.split(" ").pop()?.split(",")[0]},146 348,146`}
        fill={THEME.coral}
        fillOpacity="0.18"
      />
      <polygon
        points={`${curveB.points} ${curveB.points.split(" ").pop()?.split(",")[0]},146 348,146`}
        fill={THEME.apricot}
        fillOpacity="0.18"
      />

      {/* Curve lines */}
      <polyline points={curveA.points} fill="none" stroke={THEME.coral} strokeWidth="2" />
      <polyline points={curveB.points} fill="none" stroke={THEME.apricot} strokeWidth="2" />

      {/* Operating point markers */}
      <circle cx={curveA.markerX} cy={curveA.markerY} r="4" fill={THEME.coral} />
      <circle cx={curveB.markerX} cy={curveB.markerY} r="4" fill={THEME.apricot} />
      <text x="348" y="133" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={THEME.coral}>
        A: {(curveA.markerOutput * 100).toFixed(0)}%
      </text>
      <text x="420" y="133" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={THEME.apricot}>
        B: {(curveB.markerOutput * 100).toFixed(0)}%
      </text>

      <rect
        x="324"
        y="164"
        width="382"
        height="160"
        rx={PAPER_THEME.borderRadius}
        fill={PAPER_THEME.bgAlt}
        stroke={PAPER_THEME.border}
      />
      <text
        x="338"
        y="182"
        fontFamily={PAPER_THEME.tickFont}
        fontSize={PAPER_THEME.tickSize}
        fill={PAPER_THEME.tickColor}
      >
        NODE STATE LEDGER
      </text>
      {nodeRows.map((row, index) => {
        const y = 204 + index * 40;
        return (
          <g key={row.label}>
            <text
              x="338"
              y={y}
              fontFamily={PAPER_THEME.labelFont}
              fontSize={PAPER_THEME.labelSize}
              fill={PAPER_THEME.labelColor}
            >
              {row.label}
            </text>
            <rect x="338" y={y + 8} width="220" height="10" rx="999" fill={PAPER_THEME.grid} />
            <rect
              x="338"
              y={y + 8}
              width={Math.max(8, row.value * 220)}
              height="10"
              rx="999"
              fill={row.tone}
              opacity={0.85}
            />
            <text
              x="564"
              y={y + 17}
              textAnchor="end"
              fontFamily={PAPER_THEME.tickFont}
              fontSize={PAPER_THEME.tickSize}
              fontWeight="600"
              fill={PAPER_THEME.labelColor}
            >
              {(row.value * 100).toFixed(1)}%
            </text>
            <text
              x="338"
              y={y + 31}
              fontFamily={PAPER_THEME.labelFont}
              fontSize={PAPER_THEME.tickSize}
              fill={PAPER_THEME.tickColor}
            >
              {row.detail}
            </text>
          </g>
        );
      })}

      {/* SBOL Legend */}
      <rect
        x="324"
        y="340"
        width="382"
        height="140"
        rx={PAPER_THEME.borderRadius}
        fill={PAPER_THEME.bgAlt}
        stroke={PAPER_THEME.border}
      />
      <text
        x="338"
        y="358"
        fontFamily={PAPER_THEME.tickFont}
        fontSize={PAPER_THEME.tickSize}
        fill={PAPER_THEME.tickColor}
      >
        SBOL2 NOTATION LEGEND
      </text>
      {[
        { label: "Promoter", color: PART_COLORS.promoter, shape: "pentagon" },
        { label: "RBS", color: PART_COLORS.rbs, shape: "arc" },
        { label: "CDS/Gate", color: PART_COLORS.cds, shape: "arrow" },
        { label: "Terminator", color: PART_COLORS.terminator, shape: "T" },
      ].map((item, i) => (
        <g key={item.label} transform={`translate(338,${372 + i * 26})`}>
          <rect width="10" height="10" rx="2" fill={item.color} opacity={0.8} />
          <text
            x="16"
            y="9"
            fontFamily={PAPER_THEME.labelFont}
            fontSize={PAPER_THEME.tickSize}
            fill={PAPER_THEME.labelColor}
          >
            {item.label}
          </text>
          <text
            x="100"
            y="9"
            fontFamily={PAPER_THEME.tickFont}
            fontSize={PAPER_THEME.tickSize}
            fill={PAPER_THEME.tickColor}
          >
            {item.shape}
          </text>
        </g>
      ))}
      <text
        x="338"
        y="476"
        fontFamily={PAPER_THEME.tickFont}
        fontSize={PAPER_THEME.tickSize}
        fill={PAPER_THEME.tickColor}
      >
        Expression level → CDS height · Phase space → viridis output
      </text>
    </SVGChartContainer>
  );
}
