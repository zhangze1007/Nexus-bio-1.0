'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import SimErrorBanner from '../ide/shared/SimErrorBanner';
import {
  runFullCFSPipeline,
  generateDefaultConstructs,
  generateDefaultParameters,
  computeReproducibility,
} from '../../services/CellFreeEngine';
import { catmullRomPath } from '../../utils/svgPath';
import type {
  CFSFullResult,
  GeneConstruct,
  CFSParameters,
  PlateReaderDataPoint,
} from '../../services/CellFreeEngine';
import { useWorkbenchStore } from '../../store/workbenchStore';
import type { ProvenanceEntry } from '../../types/assumptions';
import { createProvenanceEntry } from '../../utils/provenance';
import { buildCellFreeSeed } from './shared/workbenchDataflow';
import { SEMANTIC_RGB, PAPER_THEME } from '../charts/chartTheme';
import { SVGChartContainer, ChartGrid, ChartAxisLabels, ChartLegend } from '../charts/primitives';
import ScientificHero from './shared/ScientificHero';
import AlgorithmPanel from '../shared/AlgorithmPanel';
import ScientificFigureFrame from './shared/ScientificFigureFrame';
import ToolShell from './shared/ToolShell';
import ToolTabPanel from './shared/ToolTabPanel';
import FloatingControlRail from './shared/FloatingControlRail';
import InlineMetricOverlay from './shared/InlineMetricOverlay';
import type { ToolTab } from './shared/ToolTabBar';
import { getBRENDAKinetics } from '../../services/database/brendaClient';
import type { BRENDAKinetics } from '../../services/database/brendaClient';
import DataSourceBadge from '../ide/shared/DataSourceBadge';

/* ── Design Tokens (shared via useToolTheme) ──────────────────────── */

import { toolTokens } from '../../hooks/useToolTheme';
const { panelBg: PANEL_BG, border: BORDER, label: LABEL, value: VALUE,
        inputBg: INPUT_BG, inputBorder: INPUT_BORDER, inputText: INPUT_TEXT,
        glass: GLASS } = toolTokens;

const GENE_COLORS = [THEME.MINT, THEME.SKY, THEME.CORAL, THEME.APRICOT, THEME.LILAC];

/* ── Section Label ────────────────────────────────────────────────── */

import SectionLabel from './shared/SectionLabel';
import { THEME, TOOL_RESULT_PALETTE } from '../../theme';

/* ── SVG Helpers ──────────────────────────────────────────────────── */
/* GridLines is now ChartGrid from ../charts/primitives */

/* ── Time Course Tri-Panel Layout ─────────────────────────────────── */

function TimeCourseChart({ result, constructs }: { result: CFSFullResult; constructs: GeneConstruct[] }) {
  const sim = result.simulation;
  const res = sim.resources;

  // ── TOP PANEL: smooth ODE curves with shaded area ─────────────────
  const TOP_W = 520, TOP_H = 220, TP = 40;
  const { tMax, pMax } = useMemo(() => {
    let tm = 0, pm = 0;
    sim.genes.forEach(g => {
      g.time.forEach(t => { if (t > tm) tm = t; });
      g.protein.forEach(p => { if (p > pm) pm = p; });
    });
    return { tMax: tm || 1, pMax: pm || 1 };
  }, [sim]);

  const tsx = (t: number) => TP + (t / tMax) * (TOP_W - TP * 2);
  const tsy = (p: number) => TOP_H - TP - (p / pMax) * (TOP_H - TP * 2);
  const BASE_Y = TOP_H - TP;

  // ── BOTTOM LEFT: stacked area resource depletion ───────────────────
  const BL_W = 260, BL_H = 200, BP = 36;
  const initAtp = res.atp[0] || 1;
  const initRib = res.ribosomeFree[0] || 1;
  const initAA  = res.aminoAcids[0] || 1;
  const btMax   = res.time[res.time.length - 1] || 1;
  const bsx = (t: number) => BP + (t / btMax) * (BL_W - BP - 16);
  const bsy = (f: number) => BL_H - BP - f * (BL_H - BP * 2);

  const RES_COLORS = { atp: THEME.CORAL, rib: THEME.SKY, aa: THEME.MINT };

  // Stacked area paths (atp + rib + aa stacked to 1)
  const stackedPath = useMemo(() => {
    const fwd: string[] = [], bwd: string[] = [];
    res.time.forEach((t, i) => {
      const fa = Math.min(1, Math.max(0, res.atp[i] / initAtp));
      const fr = Math.min(1, Math.max(0, res.ribosomeFree[i] / initRib));
      const faa = Math.min(1, Math.max(0, res.aminoAcids[i] / initAA));
      const a1 = fa / 3, a2 = (fa + fr) / 3, a3 = (fa + fr + faa) / 3;
      fwd.push(`${bsx(t).toFixed(1)},${bsy(a1).toFixed(1)}`);
      bwd.unshift(`${bsx(t).toFixed(1)},${bsy(0).toFixed(1)}`);
      // store for layered fill
      return { t, a1, a2, a3 };
    });
    return { atp: fwd, base: bwd };
  }, [res, initAtp, initRib, initAA, bsx, bsy]);

  // ── BOTTOM RIGHT: radar chart ──────────────────────────────────────
  const BR_W = 240, BR_H = 200, RADAR_CX = 120, RADAR_CY = 105, RADAR_R = 74;
  const AXES = ['Yield', 'Stability', 'Rate', 'Yield/ATP', 'Reproducibility'];
  const N_AXES = AXES.length;

  const radarScores = useMemo(() => {
    const repro = computeReproducibility(constructs, sim.parameters);
    const atpUsed = (res.atp[0] || 1) - (res.atp[res.atp.length - 1] || 0);
    return sim.genes.map((g) => {
      const maxP = Math.max(...g.protein);
      const stability = 1 - (Math.max(...g.protein) - g.protein[g.protein.length - 1]) / (Math.max(...g.protein) + 0.001);
      const rate = g.protein.length > 5 ? (g.protein[5] - g.protein[0]) / (pMax + 0.001) : 0.5;
      const efficiency = maxP / (pMax + 0.001);
      const yieldPerATP = Math.min(1, maxP / (atpUsed || 0.001) / (pMax + 0.001));
      return { geneId: g.geneId, geneName: g.geneName, scores: [efficiency, Math.max(0, Math.min(1, stability)), rate, yieldPerATP, repro] };
    });
  }, [sim.genes, sim.parameters, pMax, constructs, res]);

  function radarPt(score: number, axis: number): [number, number] {
    const ang = (axis / N_AXES) * 2 * Math.PI - Math.PI / 2;
    return [RADAR_CX + RADAR_R * score * Math.cos(ang), RADAR_CY + RADAR_R * score * Math.sin(ang)];
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      {/* TOP PANEL — ODE protein curves */}
      <svg role="img" aria-label="ODE time course" viewBox={`0 0 ${TOP_W} ${TOP_H}`} style={{ width: '100%' }}>
        <rect width={TOP_W} height={TOP_H} fill={PAPER_THEME.bg} rx={PAPER_THEME.borderRadius} />
        {Array.from({ length: 7 }).map((_, i) => {
          const gx = TP + (i / 6) * (TOP_W - TP * 2);
          const gy = TP + (i / 6) * (TOP_H - TP * 2);
          return <g key={i}>
            <line x1={gx} y1={TP} x2={gx} y2={BASE_Y} stroke={PAPER_THEME.grid} strokeWidth={0.5} />
            <line x1={TP} y1={gy} x2={TOP_W - TP} y2={gy} stroke={PAPER_THEME.grid} strokeWidth={0.5} />
          </g>;
        })}
        <line x1={TP} y1={BASE_Y} x2={TOP_W - TP} y2={BASE_Y} stroke={PAPER_THEME.axis} strokeWidth={0.75} />
        <line x1={TP} y1={TP} x2={TP} y2={BASE_Y} stroke={PAPER_THEME.axis} strokeWidth={0.75} />
        <text x={TOP_W / 2} y={TOP_H - 6} textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>Time (min)</text>
        <text x={12} y={TOP_H / 2} textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}
          transform={`rotate(-90,12,${TOP_H / 2})`}>Expression (a.u.)</text>
        {/* X-axis ticks */}
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
          <text key={i} x={tsx(tMax * f)} y={BASE_Y + 12} textAnchor="middle"
            fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>{Math.round(tMax * f)}</text>
        ))}
        {/* Y-axis ticks */}
        {[0, 0.5, 1].map((f, i) => (
          <text key={i} x={TP - 4} y={tsy(pMax * f) + 3} textAnchor="end"
            fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>{(pMax * f).toFixed(1)}</text>
        ))}
        {sim.genes.map((g, gi) => {
          const color = constructs.find(c => c.id === g.geneId)?.color ?? GENE_COLORS[gi % GENE_COLORS.length];
          const pts: [number, number][] = g.time.map((t, j) => [tsx(t), tsy(g.protein[j])]);
          if (pts.length < 2) return null;
          // Shaded area: path from curve down to baseline
          const areaD = catmullRomPath(pts) + ` L ${pts[pts.length-1][0].toFixed(1)} ${BASE_Y} L ${pts[0][0].toFixed(1)} ${BASE_Y} Z`;
          return (
            <g key={g.geneId}>
              <motion.path d={areaD} fill={color} opacity={0.12} initial={{ opacity: 0 }} animate={{ opacity: 0.12 }} transition={{ duration: 0.8, delay: gi * 0.15 }} />
              <motion.path d={catmullRomPath(pts)} fill="none" stroke={color} strokeWidth={1.9} opacity={0.88} initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.88 }} transition={{ duration: 1.2, ease: 'easeOut', delay: gi * 0.15 }} />
            </g>
          );
        })}
        {/* Legend */}
        {sim.genes.map((g, gi) => {
          const color = constructs.find(c => c.id === g.geneId)?.color ?? GENE_COLORS[gi % GENE_COLORS.length];
          return (
            <g key={`l${gi}`} transform={`translate(${TOP_W - TP - 110}, ${TP + 6 + gi * 15})`}>
              <line x1={0} y1={0} x2={13} y2={0} stroke={color} strokeWidth={2} />
              <text x={17} y={3.5} fontFamily={PAPER_THEME.legendFont} fontSize={PAPER_THEME.legendSize} fill={PAPER_THEME.labelColor}>{g.geneName}</text>
            </g>
          );
        })}
      </svg>

      {/* BOTTOM ROW */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {/* BOTTOM LEFT — resource depletion stacked area */}
        <svg role="img" aria-label="Resource depletion" viewBox={`0 0 ${BL_W} ${BL_H}`} style={{ flex: 1 }}>
          <rect width={BL_W} height={BL_H} fill={PAPER_THEME.bg} rx={PAPER_THEME.borderRadius} />
          <line x1={BP} y1={BL_H - BP} x2={BL_W - 16} y2={BL_H - BP} stroke={PAPER_THEME.axis} strokeWidth={0.75} />
          <line x1={BP} y1={BP} x2={BP} y2={BL_H - BP} stroke={PAPER_THEME.axis} strokeWidth={0.75} />
          <text x={(BL_W + BP) / 2} y={BL_H - 4} textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>Time (min)</text>
          <text x={10} y={BL_H / 2} textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}
            transform={`rotate(-90,10,${BL_H / 2})`}>Fraction remaining</text>
          {/* Stacked areas */}
          {([
            { key: 'atp' as const, initV: initAtp, color: RES_COLORS.atp },
            { key: 'ribosomeFree' as const, initV: initRib, color: RES_COLORS.rib },
            { key: 'aminoAcids' as const, initV: initAA, color: RES_COLORS.aa },
          ] as const).map(({ key, initV, color }, si) => {
            const pts: [number, number][] = res.time.map((t, i) => [bsx(t), bsy(Math.min(1, res[key][i] / initV))]);
            const areaD = catmullRomPath(pts) + ` L ${pts[pts.length-1][0].toFixed(1)} ${bsy(0)} L ${pts[0][0].toFixed(1)} ${bsy(0)} Z`;
            return (
              <g key={key}>
                <motion.path d={areaD} fill={color} opacity={0.25 + si * 0.05} initial={{ opacity: 0 }} animate={{ opacity: 0.25 + si * 0.05 }} transition={{ duration: 0.8, delay: si * 0.15 }} />
                <motion.path d={catmullRomPath(pts)} fill="none" stroke={color} strokeWidth={1.4} opacity={0.8} initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.8 }} transition={{ duration: 1.2, ease: 'easeOut', delay: si * 0.15 }} />
              </g>
            );
          })}
          {/* Legend */}
          {[['ATP', RES_COLORS.atp], ['Ribosomes', RES_COLORS.rib], ['Amino acids', RES_COLORS.aa]].map(([label, col], i) => (
            <g key={label} transform={`translate(${BP + 4}, ${BP + 4 + i * 13})`}>
              <rect width={8} height={4} fill={col} rx={1} opacity={0.8} />
              <text x={11} y={4.5} fontFamily={PAPER_THEME.legendFont} fontSize={PAPER_THEME.legendSize} fill={PAPER_THEME.legendColor}>{label}</text>
            </g>
          ))}
          {/* Y ticks */}
          {[0, 0.5, 1].map((f, i) => (
            <text key={i} x={BP - 3} y={bsy(f) + 3} textAnchor="end" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>
              {f.toFixed(1)}
            </text>
          ))}
        </svg>

        {/* BOTTOM RIGHT — radar spider chart */}
        <svg role="img" aria-label="Construct radar chart" viewBox={`0 0 ${BR_W} ${BR_H}`} style={{ flex: 1 }}>
          <rect width={BR_W} height={BR_H} fill={PAPER_THEME.bg} rx={PAPER_THEME.borderRadius} />
          <text x={RADAR_CX} y={12} textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.labelColor}>
            Construct performance
          </text>
          {/* Radar grid rings */}
          {[0.25, 0.5, 0.75, 1].map(scale => (
            <polygon key={scale}
              points={AXES.map((_, axis) => { const [x,y] = radarPt(scale, axis); return `${x.toFixed(1)},${y.toFixed(1)}`; }).join(' ')}
              fill="none" stroke={PAPER_THEME.grid} strokeWidth={0.5} />
          ))}
          {/* Axis spokes */}
          {AXES.map((label, axis) => {
            const [x, y] = radarPt(1, axis);
            const [lx, ly] = radarPt(1.18, axis);
            return (
              <g key={label}>
                <line x1={RADAR_CX} y1={RADAR_CY} x2={x.toFixed(1)} y2={y.toFixed(1)}
                  stroke={PAPER_THEME.grid} strokeWidth={0.5} />
                <text x={lx.toFixed(1)} y={ly.toFixed(1)} textAnchor="middle" dominantBaseline="middle"
                  fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>{label}</text>
              </g>
            );
          })}
          {/* Construct polygons */}
          {radarScores.map((rs, gi) => {
            const color = constructs.find(c => c.id === rs.geneId)?.color ?? GENE_COLORS[gi % GENE_COLORS.length];
            const poly = rs.scores.map((s, axis) => {
              const [x,y] = radarPt(s, axis);
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            }).join(' ');
            return (
              <g key={rs.geneId}>
                <polygon points={poly} fill={color} opacity={0.15} />
                <polygon points={poly} fill="none" stroke={color} strokeWidth={1.5} opacity={0.8} />
              </g>
            );
          })}
          {/* Legend */}
          {radarScores.map((rs, gi) => {
            const color = constructs.find(c => c.id === rs.geneId)?.color ?? GENE_COLORS[gi % GENE_COLORS.length];
            return (
              <g key={`rl${gi}`} transform={`translate(${BR_W - 80}, ${20 + gi * 13})`}>
                <rect width={8} height={4} fill={color} rx={1} />
                <text x={12} y={4} fontFamily={PAPER_THEME.legendFont} fontSize={PAPER_THEME.legendSize} fill={PAPER_THEME.legendColor}>{rs.geneName}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/* ── Resource Depletion Chart ─────────────────────────────────────── */

function ResourceChart({ result }: { result: CFSFullResult }) {
  const W = 520, H = 380, PAD = 44;
  const res = result.simulation.resources;

  const initials = useMemo(() => ({
    ribosomeFree: res.ribosomeFree[0] || 1,
    atp: res.atp[0] || 1,
    gtp: res.gtp[0] || 1,
    pep: res.pep[0] || 1,
    aminoAcids: res.aminoAcids[0] || 1,
  }), [res]);

  const tMax = res.time[res.time.length - 1] || 1;
  const depTime = result.simulation.energyDepletionTime;

  function sx(t: number) { return PAD + (t / tMax) * (W - PAD * 2); }
  function sy(f: number) { return H - PAD - f * (H - PAD * 2); }

  const series: { key: keyof typeof initials; label: string; color: string }[] = [
    { key: 'ribosomeFree', label: 'Ribosome (free)', color: THEME.MINT },
    { key: 'atp',          label: 'ATP',             color: THEME.CORAL },
    { key: 'gtp',          label: 'GTP',             color: THEME.SKY },
    { key: 'pep',          label: 'PEP',             color: THEME.APRICOT },
    { key: 'aminoAcids',   label: 'Amino Acids',     color: THEME.LILAC },
  ];

  return (
    <SVGChartContainer W={W} H={H} ariaLabel="Resource depletion over time" variant="paper">
      <ChartGrid W={W} H={H} PAD={PAD} gridCount={8} />
      {/* Y ticks */}
      {[0, 0.25, 0.5, 0.75, 1].map(v => (
        <text key={`yr${v}`} x={PAD - 6} y={sy(v) + 3} textAnchor="end"
          fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>{v.toFixed(2)}</text>
      ))}
      {/* X ticks */}
      {Array.from({ length: 6 }).map((_, i) => {
        const v = (tMax / 5) * i;
        return (
          <text key={`xr${i}`} x={sx(v)} y={H - PAD + 14} textAnchor="middle"
            fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>{Math.round(v)}</text>
        );
      })}
      <text x={W / 2} y={H - 6} textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>
        Time (min)
      </text>
      <text x={12} y={H / 2} textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}
        transform={`rotate(-90,12,${H / 2})`}>
        Fraction of Initial
      </text>
      {/* Energy depletion line */}
      {depTime > 0 && depTime < tMax && (
        <>
          <line x1={sx(depTime)} y1={PAD} x2={sx(depTime)} y2={H - PAD}
            stroke={`rgba(${SEMANTIC_RGB.fail}, 0.5)`} strokeWidth={1} strokeDasharray="4,3" />
          <text x={sx(depTime) + 4} y={PAD + 12} fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={`rgba(${SEMANTIC_RGB.fail}, 0.78)`}>
            Depletion
          </text>
        </>
      )}
      {/* Lines */}
      {series.map(s => {
        const raw = res[s.key];
        const init = initials[s.key];
        const pts = res.time.map((t, j) => `${sx(t)},${sy(Math.min(raw[j] / init, 1))}`).join(' ');
        return <polyline key={s.key} points={pts} fill="none" stroke={s.color} strokeWidth={1.5} opacity={0.8} />;
      })}
      {/* Legend */}
      <ChartLegend
        x={W - PAD - 120}
        y={PAD + 8}
        variant="line"
        items={series.map(s => ({ label: s.label, color: s.color }))}
      />
    </SVGChartContainer>
  );
}

/* ── Fitting Chart ────────────────────────────────────────────────── */

function FittingChart({ result }: { result: CFSFullResult }) {
  const W = 520, H = 380, PAD = 44;
  const fit = result.fitting;

  if (!fit) {
    return (
      <SVGChartContainer W={W} H={H} ariaLabel="Fitting chart" variant="paper">
        <text x={W / 2} y={H / 2} textAnchor="middle" fontFamily={THEME.SANS} fontSize="12" fill={LABEL}>
          No fitting data available
        </text>
      </SVGChartContainer>
    );
  }

  const curve = fit.fittedCurve;
  const cMax = Math.max(...curve.map(p => p.concentration), 1);
  const rMax = Math.max(...curve.map(p => p.rate), fit.vmax * 1.1, 1);

  const mainH = 280;
  const resH = 80;
  const resTop = mainH + 20;

  function sx(c: number) { return PAD + (c / cMax) * (W - PAD * 2); }
  function sy(r: number) { return PAD + (1 - r / rMax) * (mainH - PAD * 2); }

  const rMaxRes = Math.max(...fit.residuals.map(r => Math.abs(r)), 0.01);

  return (
    <SVGChartContainer W={W} H={H} ariaLabel="Fitting curve with residuals" variant="paper">
      {/* Main plot grid */}
      {Array.from({ length: 9 }).map((_, i) => {
        const gx = PAD + (i / 8) * (W - PAD * 2);
        const gy = PAD + (i / 8) * (mainH - PAD * 2);
        return (
          <g key={i}>
            <line x1={gx} y1={PAD} x2={gx} y2={mainH - PAD} stroke={PAPER_THEME.grid} strokeWidth={0.5} />
            <line x1={PAD} y1={gy} x2={W - PAD} y2={gy} stroke={PAPER_THEME.grid} strokeWidth={0.5} />
          </g>
        );
      })}
      <line x1={PAD} y1={mainH - PAD} x2={W - PAD} y2={mainH - PAD} stroke={PAPER_THEME.axis} strokeWidth={0.75} />
      <line x1={PAD} y1={PAD} x2={PAD} y2={mainH - PAD} stroke={PAPER_THEME.axis} strokeWidth={0.75} />
      {/* Scatter data points with error bars */}
      {curve.filter((_, i) => i % 3 === 0).map((p, i) => (
        <g key={`dp${i}`}>
          <line x1={sx(p.concentration)} y1={sy(p.rate * 0.9)} x2={sx(p.concentration)} y2={sy(p.rate * 1.1)}
            stroke={`${THEME.MINT}66`} strokeWidth={1} />
          <circle cx={sx(p.concentration)} cy={sy(p.rate)} r={3}
            fill={`${THEME.MINT}CC`} stroke={`${THEME.MINT}66`} strokeWidth={0.5} />
        </g>
      ))}
      {/* Fitted curve */}
      <polyline
        points={curve.map(p => `${sx(p.concentration)},${sy(p.rate)}`).join(' ')}
        fill="none" stroke={THEME.MINT} strokeWidth={1.8} opacity={0.85}
      />
      {/* Vmax line */}
      <line x1={PAD} y1={sy(fit.vmax)} x2={W - PAD} y2={sy(fit.vmax)}
        stroke={`${THEME.APRICOT}66`} strokeWidth={1} strokeDasharray="4,3" />
      <text x={W - PAD - 4} y={sy(fit.vmax) - 4} textAnchor="end"
        fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={`${THEME.APRICOT}E6`}>Vmax={fit.vmax.toFixed(2)}</text>
      {/* Stats text */}
      <text x={PAD + 8} y={PAD + 14} fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.titleColor}>
        Vmax={fit.vmax.toFixed(2)} [{fit.vmax_ci[0].toFixed(2)}, {fit.vmax_ci[1].toFixed(2)}]
      </text>
      <text x={PAD + 8} y={PAD + 26} fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.titleColor}>
        Kd={fit.kd.toFixed(2)} [{fit.kd_ci[0].toFixed(2)}, {fit.kd_ci[1].toFixed(2)}]
      </text>
      <text x={PAD + 8} y={PAD + 38} fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.titleColor}>
        R²={fit.r_squared.toFixed(4)}
      </text>
      {/* Axis labels */}
      <text x={W / 2} y={mainH - 4} textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>
        [DNA] (nM)
      </text>
      <text x={12} y={mainH / 2} textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}
        transform={`rotate(-90,12,${mainH / 2})`}>
        Rate (nM/min)
      </text>
      {/* ── Residual plot ──────────────── */}
      <line x1={PAD} y1={resTop + resH / 2} x2={W - PAD} y2={resTop + resH / 2}
        stroke={PAPER_THEME.axis} strokeWidth={0.5} />
      <line x1={PAD} y1={resTop} x2={PAD} y2={resTop + resH}
        stroke={PAPER_THEME.grid} strokeWidth={0.5} />
      {fit.residuals.map((r, i) => {
        const xp = PAD + (i / (fit.residuals.length - 1 || 1)) * (W - PAD * 2);
        const yp = resTop + resH / 2 - (r / rMaxRes) * (resH / 2 - 4);
        return (
          <circle key={`res${i}`} cx={xp} cy={yp} r={2}
            fill={r > 0 ? `rgba(${SEMANTIC_RGB.pass}, 0.72)` : `rgba(${SEMANTIC_RGB.fail}, 0.72)`} />
        );
      })}
      <text x={PAD + 4} y={resTop + 10} fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.labelColor}>Residuals</text>
    </SVGChartContainer>
  );
}

/* ── IvIv Chart ───────────────────────────────────────────────────── */

function IvIvChart({ result }: { result: CFSFullResult }) {
  const W = 520, H = 380, PAD = 44;
  const iviv = result.iviv;
  const sim = result.simulation;

  if (!iviv) {
    return (
      <SVGChartContainer W={W} H={H} ariaLabel="IVIV chart" variant="paper">
        <text x={W / 2} y={H / 2} textAnchor="middle" fontFamily={PAPER_THEME.labelFont} fontSize={PAPER_THEME.labelSize} fill={PAPER_THEME.labelColor}>
          IvIv estimate unavailable — fitting required
        </text>
      </SVGChartContainer>
    );
  }

  const invitro = sim.steadyState[0]?.maxProtein ?? 0;
  const invivo = iviv.invivo_expression;
  const barMax = Math.max(invitro, invivo, 1) * 1.2;

  const barW = 60;
  const barGap = 80;
  const barBaseY = H - PAD - 40;
  const barTopY = PAD + 20;
  const barRange = barBaseY - barTopY;

  const corrTop = PAD + 10;
  const corrLeft = W / 2 + 30;
  const corrBarW = 140;

  function barH(v: number) { return (v / barMax) * barRange; }

  const confAngle = iviv.confidence * 180;

  return (
    <SVGChartContainer W={W} H={H} ariaLabel="In-vitro to in-vivo translation" variant="paper">
      {/* Bar chart */}
      <rect x={PAD + 40} y={barBaseY - barH(invitro)} width={barW} height={barH(invitro)}
        fill={THEME.SKY} rx={4} opacity={0.8} />
      <text x={PAD + 40 + barW / 2} y={barBaseY + 14} textAnchor="middle"
        fontFamily={PAPER_THEME.labelFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.labelColor}>In vitro</text>
      <text x={PAD + 40 + barW / 2} y={barBaseY - barH(invitro) - 6} textAnchor="middle"
        fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.titleColor}>{invitro.toFixed(1)} nM</text>

      <rect x={PAD + 40 + barW + barGap} y={barBaseY - barH(invivo)} width={barW} height={barH(invivo)}
        fill={THEME.MINT} rx={4} opacity={0.8} />
      <text x={PAD + 40 + barW + barGap + barW / 2} y={barBaseY + 14} textAnchor="middle"
        fontFamily={PAPER_THEME.labelFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.labelColor}>In vivo (heuristic)</text>
      <text x={PAD + 40 + barW + barGap + barW / 2} y={barBaseY - barH(invivo) - 6} textAnchor="middle"
        fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.titleColor}>{invivo < 500 ? 'Low' : invivo < 5000 ? 'Moderate' : invivo < 20000 ? 'High' : 'Very High'}</text>

      {/* Baseline */}
      <line x1={PAD + 20} y1={barBaseY} x2={PAD + 40 + barW * 2 + barGap + 20} y2={barBaseY}
        stroke={PAPER_THEME.axis} strokeWidth={0.5} />

      {/* Correction factor bars */}
      <text x={corrLeft} y={corrTop} fontFamily={PAPER_THEME.labelFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.titleColor} fontWeight={600}>
        Correction Factors
      </text>
      {iviv.corrections.map((c, i) => {
        const adjMax = Math.max(...iviv.corrections.map(x => Math.abs(x.adjustment)), 0.1);
        const bw = (Math.abs(c.adjustment) / adjMax) * corrBarW;
        const y = corrTop + 18 + i * 22;
        const positive = c.adjustment >= 0;
        return (
          <g key={`cf${i}`}>
            <text x={corrLeft} y={y + 4} fontFamily={PAPER_THEME.labelFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.labelColor}>{c.factor}</text>
            <rect x={corrLeft} y={y + 8} width={bw} height={8}
              fill={positive ? `${THEME.MINT}80` : `${THEME.CORAL}80`} rx={2} />
            <text x={corrLeft + bw + 4} y={y + 16} fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize}
              fill={positive ? `${THEME.MINT}E6` : `${THEME.CORAL}E6`}>
              {c.adjustment > 0 ? '+' : ''}{c.adjustment.toFixed(2)}
            </text>
          </g>
        );
      })}

      {/* Confidence gauge */}
      {(() => {
        const cx = corrLeft + corrBarW / 2;
        const cy = H - PAD - 30;
        const r = 32;
        const startAngle = Math.PI;
        const endAngle = Math.PI + (confAngle * Math.PI) / 180;
        const x1 = cx + r * Math.cos(startAngle);
        const y1 = cy + r * Math.sin(startAngle);
        const x2 = cx + r * Math.cos(endAngle);
        const y2 = cy + r * Math.sin(endAngle);
        const largeArc = confAngle > 90 ? 1 : 0;
        return (
          <g>
            <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
              fill="none" stroke={PAPER_THEME.grid} strokeWidth={6} />
            <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
              fill="none" stroke={THEME.MINT} strokeWidth={6} strokeLinecap="round" />
            <text x={cx} y={cy - 4} textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize="14" fontWeight={700} fill={PAPER_THEME.titleColor}>
              {(iviv.confidence * 100).toFixed(0)}%
            </text>
            <text x={cx} y={cy + 10} textAnchor="middle" fontFamily={PAPER_THEME.labelFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.labelColor}>
              Confidence
            </text>
          </g>
        );
      })()}
    </SVGChartContainer>
  );
}

function ReactorTwin3D({ result, constructs, params }: { result: CFSFullResult; constructs: GeneConstruct[]; params: CFSParameters }) {
  const steadyMap = useMemo(
    () => Object.fromEntries(result.simulation.steadyState.map(entry => [entry.geneId, entry])),
    [result.simulation.steadyState],
  );
  const maxYield = Math.max(...result.simulation.steadyState.map(entry => entry.maxProtein), 1);
  const energyPool = params.initialEnergy.atp + params.initialEnergy.gtp + params.initialEnergy.pep;
  const depletionRatio = Math.min(1, result.simulation.energyDepletionTime / params.simulationTime);
  const reactorHeight = 240;
  const vesselTop = 72;
  const fillHeight = Math.max(36, depletionRatio * 142);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '420px', borderRadius: 'var(--nb-radius-lg)', overflow: 'hidden', border: `1px solid ${PAPER_THEME.border}`, background: PAPER_THEME.bg, position: 'relative' }}>
      <svg role="img" aria-label="Chart" viewBox="0 0 720 420" style={{ width: '100%', height: '100%' }}>
        <rect width="720" height="420" fill={PAPER_THEME.bg} />
        <rect x="26" y="24" width="668" height="372" rx={PAPER_THEME.borderRadius} fill={PAPER_THEME.bgAlt} stroke={PAPER_THEME.border} />
        <text x="44" y="20" fontFamily={PAPER_THEME.labelFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.labelColor} letterSpacing="0.12em">CELL-FREE REACTOR TWIN</text>
        <text x="44" y="34" fontFamily={PAPER_THEME.labelFont} fontSize={PAPER_THEME.labelSize} fill={PAPER_THEME.titleColor}>Resource state, construct yield, and IVIV translation in one reactor-facing schematic</text>

        <rect x="54" y={vesselTop} width="156" height={reactorHeight} rx="22" fill={PAPER_THEME.bgAlt} stroke={PAPER_THEME.border} />
        <rect x="66" y={vesselTop + reactorHeight - fillHeight - 12} width="132" height={fillHeight} rx="18" fill={`rgba(${SEMANTIC_RGB.pass}, 0.32)`} stroke={`rgba(${SEMANTIC_RGB.pass}, 0.48)`} />
        <line x1="66" y1={vesselTop + reactorHeight - fillHeight - 12} x2="198" y2={vesselTop + reactorHeight - fillHeight - 12} stroke={`rgba(${SEMANTIC_RGB.pass}, 0.85)`} strokeDasharray="4 3" />
        <text x="76" y={vesselTop + reactorHeight + 24} fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.labelColor}>reaction volume</text>
        <text x="76" y={vesselTop + reactorHeight + 38} fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.titleColor}>{(depletionRatio * 100).toFixed(0)}% energy-support window</text>

        {constructs.map((construct, index) => {
          const steady = steadyMap[construct.id];
          const normalized = steady ? steady.maxProtein / maxYield : 0.15;
          const height = 42 + normalized * 128;
          const x = 272 + index * 86;
          const y = 290 - height;
          return (
            <g key={construct.id}>
              <rect x={x} y={y} width="34" height={height} rx="10" fill={GENE_COLORS[index % GENE_COLORS.length]} opacity="0.86" />
              <rect x={x} y={y} width="34" height={height} rx="10" fill="none" stroke={PAPER_THEME.border} />
              <text x={x + 17} y="312" textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.titleColor}>{construct.name.slice(0, 6)}</text>
              <text x={x + 17} y={y - 8} textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.titleColor}>{steady ? steady.maxProtein.toFixed(1) : '0.0'}</text>
            </g>
          );
        })}
        <text x="272" y="332" fontFamily={PAPER_THEME.labelFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.labelColor}>Construct yield skyline</text>

        {[
          { label: 'ATP', value: params.initialEnergy.atp / energyPool, x: 546, color: THEME.CORAL },
          { label: 'GTP', value: params.initialEnergy.gtp / energyPool, x: 596, color: THEME.SKY },
          { label: 'PEP', value: params.initialEnergy.pep / energyPool, x: 646, color: THEME.APRICOT },
        ].map((resource) => {
          const height = 46 + resource.value * 118;
          return (
            <g key={resource.label}>
              <rect x={resource.x} y={290 - height} width="26" height={height} rx="8" fill={resource.color} opacity="0.82" />
              <text x={resource.x + 13} y="312" textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.titleColor}>{resource.label}</text>
            </g>
          );
        })}
        <text x="546" y="332" fontFamily={PAPER_THEME.labelFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.labelColor}>Resource reservoirs</text>

        <rect x="246" y="62" width="448" height="70" rx={PAPER_THEME.borderRadius} fill={PAPER_THEME.bgAlt} stroke={PAPER_THEME.border} />
        <text x="264" y="82" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.labelColor}>TRANSLATION SUMMARY</text>
        <text x="264" y="104" fontFamily={PAPER_THEME.labelFont} fontSize={PAPER_THEME.labelSize} fill={PAPER_THEME.titleColor}>
          {result.simulation.totalProteinYield.toFixed(1)} nM in vitro total yield · {result.simulation.energyDepletionTime.toFixed(0)} min depletion horizon
        </text>
        <text x="264" y="122" fontFamily={PAPER_THEME.labelFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>
          {result.iviv
            ? `Heuristic IVIV confidence ${(result.iviv.confidence * 100).toFixed(0)}% — expression range: ${result.iviv.invivo_expression < 500 ? 'Low' : result.iviv.invivo_expression < 5000 ? 'Moderate' : result.iviv.invivo_expression < 20000 ? 'High' : 'Very High'} (not a trained model)`
            : 'IVIV estimate unavailable until fitting converges.'}
        </text>
      </svg>

      <div style={{ position: 'absolute', top: '10px', left: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ padding: '3px 8px', borderRadius: '999px', background: PAPER_THEME.bgAlt, color: PAPER_THEME.labelColor, fontSize: 'var(--nb-fs-xs)', fontFamily: PAPER_THEME.tickFont, border: `1px solid ${PAPER_THEME.border}` }}>
          Reactor body = active TX-TL volume
        </span>
        <span style={{ padding: '3px 8px', borderRadius: '999px', background: PAPER_THEME.bgAlt, color: PAPER_THEME.labelColor, fontSize: 'var(--nb-fs-xs)', fontFamily: PAPER_THEME.tickFont, border: `1px solid ${PAPER_THEME.border}` }}>
          Yield skyline = construct-level protein output
        </span>
      </div>
      <div style={{ position: 'absolute', top: '10px', right: '12px', width: 'min(260px, calc(100% - 24px))' }}>
        <div style={{ padding: '10px 12px', borderRadius: 'var(--nb-radius-md)', border: `1px solid ${PAPER_THEME.border}`, background: PAPER_THEME.tooltipBg, boxShadow: PAPER_THEME.tooltipShadow }}>
          <p style={{ margin: '0 0 6px', color: PAPER_THEME.labelColor, fontSize: 'var(--nb-fs-xs)', fontFamily: PAPER_THEME.tickFont, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Evidence trace
          </p>
          <p style={{ margin: '0 0 8px', color: PAPER_THEME.titleColor, fontSize: 'var(--nb-fs-xs)', lineHeight: 1.55, fontFamily: PAPER_THEME.labelFont }}>
            Reactor 3D binds the simulated TX-TL state to one scene: depletion timing drives tank fill, gene yield drives tower height, and ATP/GTP/PEP are kept visible as explicit resource assumptions.
          </p>
          <div style={{ display: 'grid', gap: '6px' }}>
            <span style={{ padding: '3px 8px', borderRadius: '999px', background: PAPER_THEME.bgAlt, color: PAPER_THEME.labelColor, fontSize: 'var(--nb-fs-xs)', fontFamily: PAPER_THEME.tickFont, border: `1px solid ${PAPER_THEME.border}` }}>
              depletion · {result.simulation.energyDepletionTime.toFixed(0)} min
            </span>
            <span style={{ padding: '3px 8px', borderRadius: '999px', background: PAPER_THEME.bgAlt, color: PAPER_THEME.labelColor, fontSize: 'var(--nb-fs-xs)', fontFamily: PAPER_THEME.tickFont, border: `1px solid ${PAPER_THEME.border}` }}>
              total yield · {result.simulation.totalProteinYield.toFixed(1)} nM
            </span>
            <span style={{ padding: '3px 8px', borderRadius: '999px', background: PAPER_THEME.bgAlt, color: PAPER_THEME.labelColor, fontSize: 'var(--nb-fs-xs)', fontFamily: PAPER_THEME.tickFont, border: `1px solid ${PAPER_THEME.border}` }}>
              energy pool · {(params.initialEnergy.atp + params.initialEnergy.gtp + params.initialEnergy.pep).toFixed(1)} mM
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

const CELLFREE_TABS: ToolTab[] = [
  { id: 'timecourse', label: 'Time Course', accent: THEME.SKY },
  { id: 'resources', label: 'Resources', accent: THEME.LILAC },
  { id: 'fitting', label: 'Fitting', accent: THEME.APRICOT },
  { id: 'iviv', label: 'IVIV', accent: THEME.MINT },
  { id: 'reactor', label: 'Reactor 3D', accent: THEME.CORAL },
];

/* ── Main Component ───────────────────────────────────────────────── */

export default React.memo(function CellFreePage() {
  const project = useWorkbenchStore((s) => s.project);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const catalystPayload = useWorkbenchStore((s) => s.toolPayloads.catdes);
  const dynconPayload = useWorkbenchStore((s) => s.toolPayloads.dyncon);
  const cethxPayload = useWorkbenchStore((s) => s.toolPayloads.cethx);
  const dbtlPayload = useWorkbenchStore((s) => s.toolPayloads.dbtlflow);
  const setToolPayload = useWorkbenchStore((s) => s.setToolPayload);
  const [constructs, setConstructs] = useState<GeneConstruct[]>(() => generateDefaultConstructs());
  const [params, setParams] = useState<CFSParameters>(() => generateDefaultParameters());
  const recommendedSeed = useMemo(
    () => buildCellFreeSeed(project, analyzeArtifact, catalystPayload, dynconPayload, cethxPayload, dbtlPayload),
    [analyzeArtifact?.generatedAt, analyzeArtifact?.id, catalystPayload?.updatedAt, cethxPayload?.updatedAt, dbtlPayload?.feedbackSource, dbtlPayload?.result.improvementRate, dbtlPayload?.result.latestPhase, dbtlPayload?.result.passRate, dbtlPayload?.updatedAt, dynconPayload?.updatedAt, project?.id, project?.updatedAt],
  );

  useEffect(() => {
    setConstructs(recommendedSeed.constructs);
    setParams(recommendedSeed.params);
  }, [recommendedSeed]);

  const [activeTab, setActiveTab] = useState('timecourse');
  const [userData, setUserData] = useState<PlateReaderDataPoint[] | null>(null);
  const [brendaEcInput, setBrendaEcInput] = useState('');
  const [brendaData, setBrendaData] = useState<BRENDAKinetics | null>(null);
  const [brendaSource, setBrendaSource] = useState<'live' | 'mock'>('mock');
  const [brendaLoading, setBrendaLoading] = useState(false);

  const handleBrendaLookup = useCallback(async () => {
    if (!brendaEcInput.trim()) return;
    setBrendaLoading(true);
    try {
      const result = await getBRENDAKinetics(brendaEcInput.trim());
      setBrendaData(result.data);
      setBrendaSource(result.source);
    } finally {
      setBrendaLoading(false);
    }
  }, [brendaEcInput]);

  const { data: result, error: simError } = useMemo(() => {
    try { return { data: runFullCFSPipeline(constructs, params, userData ?? undefined), error: null as string | null }; }
    catch (e) { return { data: runFullCFSPipeline([], generateDefaultParameters()), error: e instanceof Error ? e.message : 'CFS pipeline failed' }; }
  }, [constructs, params, userData]);

  const handleCsvUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.trim().split('\n');
      const data: PlateReaderDataPoint[] = [];
      lines.slice(1).forEach((line, i) => {
        const cols = line.split(',').map(s => s.trim());
        const time = Number(cols[0]);
        const fluorescence = Number(cols[1]);
        if (isNaN(time) || isNaN(fluorescence)) return;
        // 3-column format: time, fluorescence, concentration
        // 2-column format: time, fluorescence (assign well and concentration from row index)
        const concentration = cols.length >= 3 ? Number(cols[2]) : 0;
        const well = cols.length >= 4 ? cols[3] : `R${i + 1}`;
        data.push({ time, fluorescence, concentration: isNaN(concentration) ? 0 : concentration, well });
      });
      setUserData(data);
    };
    reader.readAsText(file);
  }, []);

  const sim = result.simulation;
  const fit = result.fitting;
  const iviv = result.iviv;
  const invitroMaxProtein = useMemo(
    () => Math.max(...sim.steadyState.map((entry) => entry.maxProtein), 0),
    [sim.steadyState],
  );

  useEffect(() => {
    if (simError) return;
    const now = Date.now();
    const upstreamProvenance = [cethxPayload?.runProvenance, catalystPayload?.runProvenance, dynconPayload?.runProvenance]
      .filter((entry): entry is ProvenanceEntry => Boolean(entry))
      .map((entry) => `${entry.toolId}:${entry.timestamp}`);
    setToolPayload('cellfree', {
      validity: 'demo',
      runProvenance: createProvenanceEntry({
        toolId: 'cellfree',
        outputAssumptions: [
          'cellfree.parameters_unsourced',
          'cellfree.tx_tl_kinetics_ref',
          'cellfree.no_chassis_specificity',
          'cellfree.lm_fitting_local',
          'cellfree.iviv_heuristic_unfit',
        ],
        evidence: [{
          id: `cellfree-${now}`,
          source: 'mock',
          reference: 'MOCK_DATA: no calibrated source for the bundled cell-free parameter defaults.',
          confidence: 'demo',
          notes: 'Tier/code mismatch is preserved honestly; no parameter calibration or chassis-specific TXTL model is claimed.',
        }],
        upstreamProvenance,
      }),
      toolId: 'cellfree',
      targetProduct: analyzeArtifact?.targetProduct || project?.targetProduct || project?.title || 'Target Product',
      sourceArtifactId: analyzeArtifact?.id,
      targetConstruct: constructs[1]?.name || constructs[0]?.name || 'Primary construct',
      constructCount: constructs.length,
      temperature: params.temperature,
      simulationTime: params.simulationTime,
      result: {
        totalProteinYield: sim.totalProteinYield,
        energyDepletionTime: sim.energyDepletionTime,
        isResourceLimited: sim.isResourceLimited,
        invitroMaxProtein,
        invivoExpression: iviv?.invivo_expression ?? null,
        confidence: iviv?.confidence ?? null,
      },
      updatedAt: now,
    });
  }, [
    analyzeArtifact?.id,
    analyzeArtifact?.targetProduct,
    catalystPayload?.runProvenance,
    constructs,
    cethxPayload?.runProvenance,
    dynconPayload?.runProvenance,
    invitroMaxProtein,
    iviv?.confidence,
    iviv?.invivo_expression,
    params.simulationTime,
    params.temperature,
    project?.targetProduct,
    project?.title,
    setToolPayload,
    sim.energyDepletionTime,
    sim.isResourceLimited,
    sim.totalProteinYield,
    simError,
  ]);

  const exportData = useMemo(() => {
    const rows: Record<string, unknown>[] = [];
    sim.genes.forEach(g => {
      g.time.forEach((t, i) => {
        rows.push({ gene: g.geneName, time: t, protein: g.protein[i], mRNA: g.mRNA[i] });
      });
    });
    return rows;
  }, [sim]);
  return (
    <ToolShell
      moduleId="cellfree"
      title="Cell-Free Prototyping"
      formula="dP/dt = k_tl · [mRNA] · R_free / (K_tl + R_free)"
      hero={
        <ScientificHero
          eyebrow="Stage 4 · Pre-Build Simulation"
          title="Cell-free prototyping as a fast exploratory gate before DBTL"
          summary="Cell-free should read like a simulation bench, not a calibrated prediction. Yield, depletion timing, heuristic in-vitro-to-in-vivo confidence, and construct count are elevated here with parameter-sourcing limits visible."
          signals={[
            { label: 'Total Yield', value: `${sim.totalProteinYield.toFixed(1)} nM`, detail: `${invitroMaxProtein.toFixed(1)} nM max single-construct expression.`, tone: sim.totalProteinYield > 100 ? 'cool' : 'warm' },
            { label: 'Depletion Gate', value: `${sim.energyDepletionTime.toFixed(0)} min`, detail: sim.isResourceLimited ? 'Resource-limited run.' : 'Resources adequate.', tone: sim.isResourceLimited ? 'alert' : 'cool' },
            { label: 'IVIV Confidence', value: iviv ? `${(iviv.confidence * 100).toFixed(0)}%` : 'Pending', detail: iviv ? `${iviv.invivo_expression < 500 ? 'Low' : iviv.invivo_expression < 5000 ? 'Moderate' : iviv.invivo_expression < 20000 ? 'High' : 'Very High'} expression (heuristic)` : 'Fitting required.', tone: iviv && iviv.confidence > 0.65 ? 'cool' : 'neutral' },
            { label: 'Constructs', value: `${constructs.length}`, detail: `${params.temperature}°C · ${params.simulationTime} min`, tone: 'neutral' },
          ]}
        />
      }
      tabs={CELLFREE_TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      advancedTabIds={['fitting', 'iviv', 'reactor']}
      footer={
        <>
          <ExportButton label="Export Simulation JSON" data={result} filename="cellfree-simulation" format="json" />
          <ExportButton label="Export Time Series CSV" data={exportData} filename="cellfree-timeseries" format="csv" />
        </>
      }
    >
      {simError && (
        <div style={{ padding: '0 0 8px' }}><SimErrorBanner message={simError} /></div>
      )}

      {/* ── Algorithm Transparency ── */}
      <div style={{ padding: '8px 16px' }}>
        <AlgorithmPanel
          name="Cell-Free Expression ODE Model"
          description="Models gene expression in cell-free systems using coupled ODEs for transcription, translation, and resource competition. Includes ribosome dynamics, energy depletion (ATP/GTP), and amino acid consumption."
          assumptions={[
            'Well-mixed reactor (no spatial gradients)',
            'Michaelis-Menten kinetics for transcription/translation',
            'Ribosome as limiting resource',
            'ATP/GTP regeneration via energy mix',
            'No protein degradation during experiment',
          ]}
          limitations={[
            'Does not model DNA template degradation',
            'Simplified tRNA dynamics',
            'No explicit folding kinetics',
            'Calibration data from specific extract batch',
          ]}
          citation={{
            authors: 'Stögbauer T, Windhager L, Zimmer R, Rädler JO',
            title: 'Experiment and mathematical modeling of gene expression dynamics in a cell-free system',
            journal: 'Integr Biol',
            year: 2012,
            doi: '10.1039/c2ib00108k',
          }}
        />
      </div>

      {/* ── Time Course Tab ── */}
      <ToolTabPanel tabId="timecourse" activeId={activeTab}>
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <FloatingControlRail label="Bench Setup" defaultCollapsed={false}>
            <SectionLabel>Gene Constructs</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {constructs.map((g, i) => (
                <div key={g.id} style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: GENE_COLORS[i % GENE_COLORS.length], flexShrink: 0 }} />
                    <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', fontWeight: 600, color: VALUE }}>{g.name.length > 20 ? g.name.slice(0, 20) + '…' : g.name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Promoter</span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE }}>{g.promoter}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>DNA conc.</span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE }}>{g.dnaConcentration} nM</span>
                  </div>
                </div>
              ))}
            </div>
            <SectionLabel>Reaction Parameters</SectionLabel>
            <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '10px', marginBottom: '16px' }}>
              {[
                { label: 'Ribosome Total', value: `${params.ribosomeTotal} nM` },
                { label: 'RNAP Total', value: `${params.rnap_total} nM` },
                { label: 'Temperature', value: `${params.temperature} °C` },
                { label: 'Volume', value: `${params.reactionVolume} μL` },
                { label: 'Sim Time', value: `${params.simulationTime} min` },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>{item.label}</span>
                  <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE }}>{item.value}</span>
                </div>
              ))}
            </div>
            <SectionLabel>Energy Status</SectionLabel>
            <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '10px' }}>
              {[
                { label: 'ATP', value: `${params.initialEnergy.atp} mM` },
                { label: 'GTP', value: `${params.initialEnergy.gtp} mM` },
                { label: 'PEP', value: `${params.initialEnergy.pep} mM` },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>{item.label}</span>
                  <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE }}>{item.value}</span>
                </div>
              ))}
            </div>
          </FloatingControlRail>

          <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0, padding: '12px' }}>
            <ScientificFigureFrame
              eyebrow="Expression timecourse"
              title="Protein production, resource depletion, and construct quality"
              caption="The timecourse lens is treated as a figure plate — expression, depletion, and comparative construct quality live inside one evidence surface."
              legend={[
                { label: 'Constructs', value: `${constructs.length}`, accent: THEME.APRICOT },
                { label: 'Yield', value: `${sim.totalProteinYield.toFixed(1)} nM`, accent: THEME.MINT },
                { label: 'Depletion', value: `${sim.energyDepletionTime.toFixed(0)} min`, accent: THEME.CORAL },
              ]}
              footer={<div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>setup {params.temperature}°C · {params.simulationTime} min · {sim.isResourceLimited ? 'resource-limited run' : 'resources adequate'}</div>}
              minHeight="100%"
            >
              <div style={{ padding: '4px 0', overflowY: 'auto' }}>
                <TimeCourseChart result={result} constructs={constructs} />
              </div>
            </ScientificFigureFrame>
            <InlineMetricOverlay
              position="top-right"
              metrics={[
                { label: 'Yield', value: `${sim.totalProteinYield.toFixed(1)} nM`, accent: THEME.MINT },
                { label: 'Depletion', value: `${sim.energyDepletionTime.toFixed(0)} min`, accent: sim.isResourceLimited ? THEME.CORAL : THEME.SKY },
                { label: 'Constructs', value: `${constructs.length}`, accent: THEME.APRICOT },
              ]}
            />
          </div>
        </div>
      </ToolTabPanel>

      {/* ── Resources Tab ── */}
      <ToolTabPanel tabId="resources" activeId={activeTab}>
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <FloatingControlRail label="Bench Setup" defaultCollapsed={true}>
            <SectionLabel>Energy Status</SectionLabel>
            <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '10px' }}>
              {[
                { label: 'ATP', value: `${params.initialEnergy.atp} mM` },
                { label: 'GTP', value: `${params.initialEnergy.gtp} mM` },
                { label: 'PEP', value: `${params.initialEnergy.pep} mM` },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>{item.label}</span>
                  <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE }}>{item.value}</span>
                </div>
              ))}
            </div>
          </FloatingControlRail>
          <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0, padding: '12px' }}>
            <ScientificFigureFrame
              eyebrow="Resource ledger"
              title="ATP, ribosome, and amino-acid drawdown"
              caption="Resource exhaustion governs whether a construct bundle should remain exploratory before slower experimental loops."
              legend={[
                { label: 'Yield', value: `${sim.totalProteinYield.toFixed(1)} nM`, accent: THEME.MINT },
                { label: 'Depletion', value: `${sim.energyDepletionTime.toFixed(0)} min`, accent: THEME.CORAL },
              ]}
              minHeight="100%"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 0' }}>
                <div style={{ width: '100%', maxWidth: '600px' }}>
                  <ResourceChart result={result} />
                </div>
              </div>
            </ScientificFigureFrame>
            <InlineMetricOverlay
              position="top-right"
              metrics={[
                { label: 'Depletion', value: `${sim.energyDepletionTime.toFixed(0)} min`, accent: sim.isResourceLimited ? THEME.CORAL : THEME.SKY },
                { label: 'Resource Ltd', value: sim.isResourceLimited ? 'Yes' : 'No', accent: sim.isResourceLimited ? THEME.CORAL : THEME.MINT },
              ]}
            />
          </div>
        </div>
      </ToolTabPanel>

      {/* ── Fitting Tab ── */}
      <ToolTabPanel tabId="fitting" activeId={activeTab}>
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <FloatingControlRail label="Parameters" defaultCollapsed={true}>
            <SectionLabel>Reaction Parameters</SectionLabel>
            <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '10px' }}>
              {[
                { label: 'Temperature', value: `${params.temperature} °C` },
                { label: 'Sim Time', value: `${params.simulationTime} min` },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>{item.label}</span>
                  <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE }}>{item.value}</span>
                </div>
              ))}
            </div>
          </FloatingControlRail>
          <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0, padding: '12px', overflowY: 'auto', gap: '16px' }}>
            {/* CSV Upload + Fitting Mode Indicator */}
            <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '12px' }}>
              <SectionLabel>Data Source</SectionLabel>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <label style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '6px 12px', borderRadius: 'var(--nb-radius-sm)',
                  border: `1px solid ${INPUT_BORDER}`, background: INPUT_BG,
                  color: VALUE, fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)',
                  cursor: 'pointer', transition: 'border-color 0.15s',
                }}>
                  <span>Upload CSV</span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCsvUpload}
                    style={{ display: 'none' }}
                    aria-label="Upload CSV file for fitting"
                  />
                </label>
                <span style={{
                  padding: '3px 10px', borderRadius: '999px',
                  background: userData ? `rgba(${SEMANTIC_RGB.warn}, 0.15)` : 'rgba(255,255,255,0.06)',
                  color: userData ? `rgba(${SEMANTIC_RGB.warn}, 0.92)` : VALUE,
                  fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)',
                  border: userData ? `1px solid rgba(${SEMANTIC_RGB.warn}, 0.3)` : '1px solid rgba(255,255,255,0.08)',
                }}>
                  {userData ? 'User Data' : 'Demo'}
                </span>
                {userData && (
                  <button
                    onClick={() => setUserData(null)}
                    style={{
                      padding: '4px 10px', borderRadius: 'var(--nb-radius-sm)',
                      border: `1px solid ${INPUT_BORDER}`, background: 'transparent',
                      color: LABEL, fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)',
                      cursor: 'pointer',
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
              {userData && (
                <p style={{
                  margin: '8px 0 0', fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)',
                  color: `rgba(${SEMANTIC_RGB.warn}, 0.85)`, lineHeight: 1.5,
                }}>
                  Partial — user data not independently validated. Fitting uses your uploaded {userData.length}-point dataset. CSV format: header row + columns (time, fluorescence, concentration). 2-column CSV accepted but requires concentration for Michaelis-Menten fitting.
                </p>
              )}
              {!userData && (
                <p style={{
                  margin: '8px 0 0', fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)',
                  color: LABEL, lineHeight: 1.5,
                }}>
                  Using built-in demo plate reader data. Upload a CSV (columns: time, fluorescence) to fit your own data.
                </p>
              )}
            </div>
            {/* BRENDA Kinetics Lookup */}
            <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <SectionLabel>BRENDA Reference Kinetics</SectionLabel>
                <DataSourceBadge source={brendaSource} />
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input
                  value={brendaEcInput}
                  onChange={e => setBrendaEcInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleBrendaLookup(); }}
                  placeholder="EC number (e.g. 2.7.1.1)"
                  style={{ flex: 1, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: INPUT_TEXT, background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, borderRadius: 6, padding: '5px 8px', outline: 'none' }}
                />
                <button
                  onClick={handleBrendaLookup}
                  disabled={brendaLoading}
                  style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: VALUE, background: 'rgba(175,195,214,0.12)', border: `1px solid ${INPUT_BORDER}`, borderRadius: 6, padding: '5px 10px', cursor: brendaLoading ? 'wait' : 'pointer', opacity: brendaLoading ? 0.6 : 1 }}
                >
                  {brendaLoading ? '...' : 'Fetch'}
                </button>
              </div>
              {brendaData && brendaData.km.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {brendaData.km.map((k, i) => (
                    <div key={`km-${i}`} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Km ({k.substrate})</span>
                      <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE }}>{k.value} {k.unit}</span>
                    </div>
                  ))}
                  {brendaData.kcat.map((k, i) => (
                    <div key={`kcat-${i}`} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Vmax ({k.substrate})</span>
                      <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE }}>{k.value} {k.unit}</span>
                    </div>
                  ))}
                </div>
              )}
              {brendaData && brendaData.km.length === 0 && (
                <p style={{ margin: 0, fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, opacity: 0.7 }}>
                  No kinetics data found for {brendaData.ecNumber}
                </p>
              )}
              {!brendaData && (
                <p style={{ margin: 0, fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, opacity: 0.6 }}>
                  Search an EC number to compare BRENDA reference Km/Vmax against your fitted parameters.
                </p>
              )}
            </div>
            <ScientificFigureFrame
              eyebrow="Plate fitting"
              title="Parameter-fit quality for cell-free readout"
              caption="Fitting is presented as evidence for how trustworthy the cell-free readout is."
              legend={[
                { label: 'R²', value: fit ? fit.r_squared.toFixed(4) : '—', accent: THEME.MINT },
              ]}
              minHeight="300px"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 0' }}>
                <div style={{ width: '100%', maxWidth: '600px' }}>
                  <FittingChart result={result} />
                </div>
              </div>
            </ScientificFigureFrame>
            {fit && (
              <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '12px' }}>
                <SectionLabel>Fitting Results</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Vmax</span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE }}>{fit.vmax.toFixed(3)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Kd</span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE }}>{fit.kd.toFixed(3)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>R²</span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: `rgba(${SEMANTIC_RGB.pass}, 0.92)` }}>{fit.r_squared.toFixed(4)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Vmax CI</span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>[{fit.vmax_ci[0].toFixed(2)}, {fit.vmax_ci[1].toFixed(2)}]</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Kd CI</span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>[{fit.kd_ci[0].toFixed(2)}, {fit.kd_ci[1].toFixed(2)}]</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </ToolTabPanel>

      {/* ── IVIV Tab ── */}
      <ToolTabPanel tabId="iviv" activeId={activeTab}>
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <FloatingControlRail label="Parameters" defaultCollapsed={true}>
            <SectionLabel>Gene Constructs</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {constructs.map((g, i) => (
                <div key={g.id} style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: GENE_COLORS[i % GENE_COLORS.length], flexShrink: 0 }} />
                    <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', fontWeight: 600, color: VALUE }}>{g.name.length > 20 ? g.name.slice(0, 20) + '…' : g.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </FloatingControlRail>
          <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0, padding: '12px', overflowY: 'auto', gap: '16px' }}>
            <ScientificFigureFrame
              eyebrow="Translation bridge"
              title="In-vitro to in-vivo translation estimate"
              caption="Estimated in-vivo expression, heuristic confidence, and rationale — parameter limits stay legible."
              legend={[
                { label: 'Confidence', value: iviv ? `${(iviv.confidence * 100).toFixed(0)}%` : '—', accent: THEME.LILAC },
                { label: 'Estimate', value: iviv ? 'Heuristic' : '—', accent: THEME.MINT },
              ]}
              minHeight="300px"
            >
              <div style={{ display: 'flex', flexDirection: 'column', padding: '8px 0', gap: '16px' }}>
                <div style={{ width: '100%', maxWidth: '600px', margin: '0 auto' }}>
                  <IvIvChart result={result} />
                </div>
                {iviv && (
                  <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-lg)', padding: '14px 18px', maxWidth: '600px', margin: '0 auto', width: '100%' }}>
                    <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', textTransform: 'uppercase', letterSpacing: '0.1em', color: LABEL, margin: '0 0 6px' }}>Reasoning</p>
                    <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: VALUE, margin: 0, lineHeight: 1.6 }}>{iviv.reasoning}</p>
                  </div>
                )}
              </div>
            </ScientificFigureFrame>
            {iviv && (
              <>
                <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '12px' }}>
                  <SectionLabel>IvIv Estimate</SectionLabel>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Expression Range</span>
                      <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE }}>{iviv.invivo_expression < 500 ? 'Low' : iviv.invivo_expression < 5000 ? 'Moderate' : iviv.invivo_expression < 20000 ? 'High' : 'Very High'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Fold Change</span>
                      <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE }}>{iviv.invivo_foldChange < 0.5 ? 'Below median' : iviv.invivo_foldChange < 2 ? 'Near median' : iviv.invivo_foldChange < 10 ? 'Above median' : 'Well above median'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Confidence</span>
                      <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: iviv.confidence > 0.7 ? `rgba(${SEMANTIC_RGB.pass}, 0.92)` : iviv.confidence > 0.4 ? `rgba(${SEMANTIC_RGB.warn}, 0.9)` : `rgba(${SEMANTIC_RGB.fail}, 0.9)` }}>{(iviv.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Scaling Factor</span>
                      <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE }}>{iviv.scalingFactor < 1 ? 'Reduced' : iviv.scalingFactor < 5 ? 'Comparable' : 'Amplified'}</span>
                    </div>
                  </div>
                </div>
                <div style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '10px 12px', border: `1px solid rgba(${SEMANTIC_RGB.warn}, 0.3)` }}>
                  <p style={{ margin: 0, fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: `rgba(${SEMANTIC_RGB.warn}, 0.9)`, lineHeight: 1.5 }}>
                    This is a heuristic estimate, not a trained model. Weights are deterministic (SeededRNG 12345) but not fitted to experimental data. Use qualitative ranges only.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </ToolTabPanel>

      {/* ── Reactor 3D Tab ── */}
      <ToolTabPanel tabId="reactor" activeId={activeTab}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: '12px', gap: '10px' }}>
          <div style={{ maxWidth: '760px', margin: '0 auto', width: '100%' }}>
            <div style={{ padding: '8px 12px', borderRadius: 'var(--nb-radius-md)', border: `1px solid ${BORDER}`, background: THEME.PANEL_INSET }}>
              <p style={{ margin: '0 0 3px', color: VALUE, fontSize: 'var(--nb-fs-sm)', fontFamily: THEME.SANS }}>Reactor 3D turns the CFPS run into a digital twin: construct yield, energy pool and depletion timing are mapped into one spatial scene.</p>
              <p style={{ margin: 0, color: LABEL, fontSize: 'var(--nb-fs-xs)', fontFamily: THEME.MONO }}>center tank = resource state · rear towers = expression output · right bars = ATP / GTP / PEP allocation</p>
            </div>
          </div>
          <div style={{ minHeight: '420px', maxWidth: '760px', margin: '0 auto', width: '100%', position: 'relative' }}>
            <ReactorTwin3D result={result} constructs={constructs} params={params} />
            <InlineMetricOverlay
              position="top-right"
              metrics={[
                { label: 'Yield', value: `${sim.totalProteinYield.toFixed(1)} nM`, accent: THEME.MINT },
                { label: 'Depletion', value: `${sim.energyDepletionTime.toFixed(0)} min`, accent: sim.isResourceLimited ? THEME.CORAL : THEME.SKY },
                { label: 'Constructs', value: `${constructs.length}`, accent: THEME.APRICOT },
              ]}
            />
          </div>
          {/* Per-Gene Stats */}
          <SectionLabel>Per-Gene Stats</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
            {sim.steadyState.map((ss, i) => {
              const gene = constructs.find(c => c.id === ss.geneId);
              const color = GENE_COLORS[i % GENE_COLORS.length];
              return (
                <div key={ss.geneId} style={{ ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '8px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', fontWeight: 600, color: VALUE }}>{gene ? (gene.name.length > 18 ? gene.name.slice(0, 18) + '…' : gene.name) : ss.geneId}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Peak Protein</span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE }}>{ss.maxProtein.toFixed(1)} nM</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Time to Half</span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE }}>{ss.timeToHalf.toFixed(0)} min</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Yield/DNA</span>
                    <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE }}>{ss.yieldPerDNA.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </ToolTabPanel>
    </ToolShell>
  );
});
