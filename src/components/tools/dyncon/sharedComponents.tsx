'use client';
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { catmullRomPath } from '../../../utils/svgPath';
import { SVGChartContainer } from '../../charts/primitives';
import { PAPER_THEME } from '../../charts/chartTheme';
import { THEME } from '../../../theme';
import { toolTokens } from '../../../hooks/useToolTheme';
import { getToolValidity } from '../../../config/toolValidity';
import WorkbenchRangeSlider from '../shared/WorkbenchRangeSlider';
import SectionLabel from '../shared/SectionLabel';
import SimErrorBanner from '../../ide/shared/SimErrorBanner';
import { hillFeedback, DEFAULT_PARAMS } from '../../../data/mockDynCon';
import type { ODEState, HillParams } from '../../../types';
import type { ToolTab } from '../shared/ToolTabBar';

const { border: BORDER, label: LABEL, value: VALUE } = toolTokens;

/* ── Series definitions (6 state variables) ────────────────────────────────── */
export const SERIES = [
  { key: 'biomass',       label: 'Biomass',   color: `${THEME.LILAC}D1`, unit: 'g/L' },
  { key: 'substrate',     label: 'Substrate', color: `${THEME.APRICOT}E0`, unit: 'g/L' },
  { key: 'product',       label: 'Product',   color: `${THEME.MINT}E0`, unit: 'g/L' },
  { key: 'dissolvedO2',   label: 'DO₂',       color: `${THEME.SKY}E0`, unit: 'sat.' },
  { key: 'fpp',           label: 'FPP',       color: `${THEME.CORAL}E6`, unit: 'μM' },
  { key: 'adsExpression', label: 'ADS Expr',  color: `${THEME.LILAC}EB`, unit: 'a.u.' },
] as const;

/* ── Tab definitions ───────────────────────────────────────────────────────── */
export const DYNCON_TABS: ToolTab[] = [
  { id: 'trajectory', label: 'Trajectory', accent: THEME.SKY },
  { id: 'hill', label: 'Hill Curve', accent: THEME.LILAC },
  { id: 'convergence', label: 'Convergence', accent: THEME.APRICOT },
  { id: 'rbs', label: 'RBS Bridge', accent: THEME.MINT },
  { id: 'bioprocess', label: 'Bioprocess Opt.', accent: THEME.SKY },
  { id: 'digitaltwin', label: 'Digital Twin', accent: THEME.LILAC },
  { id: 'analytics', label: 'Analytics', accent: THEME.MINT },
];

/* ── Validity badge styles ─────────────────────────────────────────────────── */
export const VALIDITY_STYLES: Record<string, { bg: string; border: string; color: string; label: string }> = {
  real:    { bg: 'rgba(147, 203, 82, 0.16)',  border: 'rgba(147, 203, 82, 0.45)',  color: '#5d8a2f', label: 'REAL' },
  partial: { bg: 'rgba(232, 220, 200, 0.32)', border: 'rgba(180, 150, 100, 0.50)', color: '#8a6a30', label: 'PARTIAL' },
  demo:    { bg: 'rgba(250, 128, 114, 0.16)', border: 'rgba(250, 128, 114, 0.50)', color: '#a8453a', label: 'DEMO' },
};

/* ── Frontier Engine Badge ─────────────────────────────────────────────────── */
export function FrontierEngineBadge({ engineId }: { engineId: string }) {
  const validity = getToolValidity(engineId);
  if (!validity) return null;
  const style = VALIDITY_STYLES[validity.level] ?? VALIDITY_STYLES.partial;
  return (
    <div
      title={validity.caption}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        marginLeft: 'auto', marginRight: 16,
        fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', fontWeight: 700,
        letterSpacing: '0.10em', padding: '5px 9px',
        borderRadius: 'var(--nb-radius-md)',
        background: style.bg, border: `1px solid ${style.border}`, color: style.color,
        cursor: 'help', flexShrink: 0,
      }}
    >
      {style.label}
      <span style={{ fontWeight: 400, opacity: 0.7, letterSpacing: 0 }}>/ {engineId}</span>
    </div>
  );
}

/* ── Param Slider ──────────────────────────────────────────────────────────── */
export function ParamSlider({ label, value, min, max, step = 0.1, onChange, unit }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; unit?: string;
}) {
  const decimals = step > 0 ? Math.max(2, Math.ceil(-Math.log10(step))) : 2;
  return (
    <WorkbenchRangeSlider
      label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      unit={unit}
      onChange={onChange}
      formatValue={(nextValue) => nextValue.toFixed(decimals)}
    />
  );
}

/* ── Stat Row ──────────────────────────────────────────────────────────────── */
export function StatRow({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0', borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>{label}</span>
      <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', fontWeight: 600, color: VALUE, textAlign: 'right' }}>
        {typeof value === 'number' ? value.toFixed(3) : value}{unit ? ` ${unit}` : ''}
      </span>
    </div>
  );
}

/* ── Time-Series SVG (6 series) ────────────────────────────────────────────── */
export function TimeSeriesSVG({ trajectory, setpoint, svgRef }: { trajectory: ODEState[]; setpoint: number; svgRef?: React.RefObject<SVGSVGElement | null> }) {
  if (trajectory.length < 2) return null;
  const W = 620;
  const H = 470;
  const PAD_X = 54;
  const laneH = 52;
  const laneGap = 16;
  const plotTop = 42;
  const lanes = [
    { key: 'product',       label: 'Product',   color: `${THEME.MINT}EB`, max: Math.max(0.001, ...trajectory.map((point) => point.product)),       unit: 'g/L'  },
    { key: 'biomass',       label: 'Biomass',   color: `${THEME.LILAC}EB`, max: Math.max(0.001, ...trajectory.map((point) => point.biomass)),        unit: 'g/L'  },
    { key: 'substrate',     label: 'Substrate', color: `${THEME.APRICOT}EB`, max: Math.max(0.001, ...trajectory.map((point) => point.substrate)),      unit: 'g/L'  },
    { key: 'dissolvedO2',   label: 'DO₂',       color: `${THEME.SKY}E6`,  max: 1,                                                                    unit: 'sat.' },
    { key: 'fpp',           label: 'FPP',       color: `${THEME.CORAL}F0`, max: Math.max(0.001, ...trajectory.map((point) => point.fpp ?? 0)),             unit: 'μM'   },
    { key: 'adsExpression', label: 'ADS',       color: `${THEME.LILAC}EB`, max: Math.max(0.001, ...trajectory.map((point) => point.adsExpression ?? 0)),   unit: 'a.u.' },
  ] as const;

  const tMax = trajectory[trajectory.length - 1].time;
  const plotWidth = W - PAD_X - 28;
  const PP_X = W - 118, PP_Y = plotTop + 2, PP_W = 104, PP_H = 80;

  function laneY(index: number) { return plotTop + index * (laneH + laneGap); }
  function normalize(value: number, max: number) { return max > 0 ? value / max : 0; }
  function toXY(pt: ODEState, index: number, key: keyof ODEState, max: number): [number, number] {
    const raw = pt[key];
    const value = typeof raw === 'number' ? raw : 0;
    return [PAD_X + (pt.time / tMax) * plotWidth, laneY(index) + laneH - normalize(value, max) * laneH];
  }

  const productMax = lanes[0].max, fppMax = lanes[4].max;
  const ppPts: [number, number][] = trajectory.map(pt => [
    PP_X + (normalize(pt.product, productMax)) * PP_W,
    PP_Y + PP_H - (normalize(pt.fpp ?? 0, fppMax)) * PP_H,
  ]);
  const ppPath = catmullRomPath(ppPts);

  return (
    <SVGChartContainer W={W} H={H + 36} ariaLabel="Closed-loop trajectory" variant="paper" svgRef={svgRef}>
      <text x="22" y="22" fontFamily={PAPER_THEME.tickFont} fontSize="10" fill={PAPER_THEME.tickColor}>
        Closed-loop trajectory
      </text>
      <text x="22" y="36" fontFamily={THEME.SANS} fontSize="12" fill={PAPER_THEME.labelColor}>
        Shared timeline for product, host state, oxygen control, precursor load, and expression
      </text>

      {lanes.map((lane, index) => {
        const y = laneY(index);
        const coords: [number, number][] = trajectory.map(pt => toXY(pt, index, lane.key, lane.max));
        const lastValue = trajectory[trajectory.length - 1][lane.key] as number;
        const markerX = PAD_X + plotWidth;
        const markerY = y + laneH - normalize(lastValue, lane.max) * laneH;
        const setpointY = lane.key === 'dissolvedO2'
          ? y + laneH - normalize(setpoint, lane.max) * laneH : null;
        const toxicityY = lane.key === 'fpp'
          ? y + laneH - normalize(DEFAULT_PARAMS.fppToxicThreshold, lane.max) * laneH : null;

        const smoothPath = catmullRomPath(coords);

        return (
          <g key={lane.key}>
            <rect x={PAD_X} y={y} width={plotWidth} height={laneH} rx="2" fill={PAPER_THEME.bgAlt} stroke={PAPER_THEME.border} />
            {[0.25, 0.5, 0.75].map((fraction) => (
              <line key={fraction} x1={PAD_X} y1={y + laneH - fraction * laneH}
                x2={PAD_X + plotWidth} y2={y + laneH - fraction * laneH}
                stroke={PAPER_THEME.grid} strokeWidth="1" />
            ))}
            {setpointY !== null && (
              <>
                <rect x={PAD_X} y={setpointY - 6} width={plotWidth} height={12} fill={`${THEME.SKY}0F`} />
                <line x1={PAD_X} y1={setpointY} x2={PAD_X + plotWidth} y2={setpointY} stroke={`${THEME.SKY}66`} strokeDasharray="4 4" />
              </>
            )}
            {toxicityY !== null && (
              <line x1={PAD_X} y1={toxicityY} x2={PAD_X + plotWidth} y2={toxicityY} stroke="rgba(255,49,49,0.35)" strokeDasharray="5 4" />
            )}
            <motion.path d={smoothPath} fill="none" stroke={lane.color} strokeWidth="2" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 1.2, ease: 'easeOut', delay: index * 0.1 }} />
            <motion.circle cx={markerX} cy={markerY} r="4" fill={lane.color} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, delay: 1.0 + index * 0.1 }} />
            <text x="20" y={y + 14} fontFamily={PAPER_THEME.tickFont} fontSize="10" fill={PAPER_THEME.tickColor}>{lane.label}</text>
            <text x="20" y={y + 28} fontFamily={THEME.SANS} fontSize="10" fill={PAPER_THEME.labelColor}>
              {(lastValue ?? 0).toFixed(lane.key === 'fpp' ? 1 : 2)} {lane.unit}
            </text>
            <text x={PAD_X + plotWidth + 8} y={y + 14} fontFamily={PAPER_THEME.tickFont} fontSize="10" fill={PAPER_THEME.tickColor}>
              {lane.max.toFixed(lane.key === 'fpp' ? 0 : 1)}
            </text>
            <text x={PAD_X + plotWidth + 8} y={y + laneH} fontFamily={PAPER_THEME.tickFont} fontSize="10" fill={PAPER_THEME.tickColor}>0</text>
          </g>
        );
      })}

      {[0, 25, 50, 75, 100].map((tick) => {
        const x = PAD_X + (tick / 100) * plotWidth;
        return (
          <g key={tick}>
            <line x1={x} y1={plotTop + lanes.length * (laneH + laneGap) - laneGap}
              x2={x} y2={plotTop + lanes.length * (laneH + laneGap) - laneGap + 6}
              stroke={PAPER_THEME.grid} />
            <text x={x} y={plotTop + lanes.length * (laneH + laneGap) - laneGap + 18}
              textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize="10" fill={PAPER_THEME.tickColor}>
              {tick}h
            </text>
          </g>
        );
      })}

      <text x={PAD_X} y={plotTop + lanes.length * (laneH + laneGap) - laneGap + 30}
        fontFamily={PAPER_THEME.tickFont} fontSize="9" fill={PAPER_THEME.tickColor} fontStyle="italic">
        Deterministic simulation — no uncertainty quantification
      </text>

      <rect x={PP_X - 4} y={PP_Y - 12} width={PP_W + 8} height={PP_H + 22} rx="2"
        fill={PAPER_THEME.bgAlt} stroke={PAPER_THEME.border} />
      <text x={PP_X + PP_W / 2} y={PP_Y - 4} textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize="10" fill={PAPER_THEME.tickColor}>
        PHASE PORTRAIT
      </text>
      <line x1={PP_X} y1={PP_Y} x2={PP_X} y2={PP_Y + PP_H} stroke={PAPER_THEME.grid} />
      <line x1={PP_X} y1={PP_Y + PP_H} x2={PP_X + PP_W} y2={PP_Y + PP_H} stroke={PAPER_THEME.grid} />
      <text x={PP_X + PP_W / 2} y={PP_Y + PP_H + 14} textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize="9" fill={PAPER_THEME.tickColor}>Product (g/L)</text>
      <text x={PP_X - 2} y={PP_Y + PP_H + 8} textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize="10" fill={PAPER_THEME.tickColor}>0</text>
      <text x={PP_X + PP_W} y={PP_Y + PP_H + 8} textAnchor="end" fontFamily={PAPER_THEME.tickFont} fontSize="10" fill={PAPER_THEME.tickColor}>→</text>
      <text x={PP_X - 4} y={PP_Y - 2} textAnchor="end" fontFamily={PAPER_THEME.tickFont} fontSize="9" fill={PAPER_THEME.tickColor}>FPP (μM)</text>
      {ppPath && <path d={ppPath} fill="none" stroke={`${THEME.CORAL}B2`} strokeWidth="1.2" />}
      {ppPts.length > 0 && (
        <circle cx={ppPts[ppPts.length - 1][0]} cy={ppPts[ppPts.length - 1][1]} r="2.5" fill={THEME.CORAL} />
      )}
    </SVGChartContainer>
  );
}

/* ── Hill Feedback Curve (mini SVG) ────────────────────────────────────────── */
export function HillCurveSVG({ hill, currentFPP }: { hill: HillParams; currentFPP: number }) {
  const W = 520, H = 120, PAD = 44;
  const fppMax = 200;
  const pts: string[] = [];
  for (let i = 0; i <= 100; i++) {
    const fpp = (i / 100) * fppMax;
    const expr = hillFeedback(fpp, hill);
    const x = PAD + (fpp / fppMax) * (W - PAD * 2);
    const y = H - PAD + 4 - (expr / hill.Vmax) * (H - PAD * 2 + 4);
    pts.push(`${x},${y}`);
  }
  const markerX = PAD + (Math.min(currentFPP, fppMax) / fppMax) * (W - PAD * 2);

  return (
    <SVGChartContainer W={W} H={H + 10} ariaLabel="Hill feedback curve" variant="paper" style={{ height: '132px' }}>
      <line x1={PAD} y1={H - PAD + 4} x2={W - PAD} y2={H - PAD + 4} stroke={PAPER_THEME.axis} />
      <line x1={PAD} y1={PAD - 8} x2={PAD} y2={H - PAD + 4} stroke={PAPER_THEME.axis} />
      <rect x={PAD} y={PAD - 8} width={W - PAD * 2} height={H - PAD * 2 + 12} fill={PAPER_THEME.bgAlt} rx="2" />
      <polyline points={pts.join(' ')} fill="none" stroke={THEME.MINT} strokeWidth={2.2} />
      <line x1={markerX} y1={PAD - 8} x2={markerX} y2={H - PAD + 4}
        stroke={`${THEME.CORAL}80`} strokeWidth={1} strokeDasharray="3 3" />
      <circle cx={markerX} cy={H - PAD + 4 - (hillFeedback(Math.min(currentFPP, fppMax), hill) / hill.Vmax) * (H - PAD * 2 + 4)}
        r={3} fill={THEME.CORAL} />
      <text x="20" y="18" fontFamily={PAPER_THEME.tickFont} fontSize="10" fill={PAPER_THEME.tickColor}>
        Repression response
      </text>
      <text x="20" y="32" fontFamily={THEME.SANS} fontSize="11" fill={PAPER_THEME.labelColor}>
        Operating point of the current precursor pool on the Hill feedback curve
      </text>
      <text x={W / 2} y={H + 6} fontFamily={THEME.MONO} fontSize="10" textAnchor="middle" fill={LABEL}>FPP (μM)</text>
      <text x={10} y={(PAD + H - PAD) / 2} fontFamily={THEME.MONO} fontSize="10" textAnchor="middle" fill={LABEL}
        transform={`rotate(-90, 10, ${(PAD + H - PAD) / 2})`}>ADS</text>
      <text x={W - PAD} y={H + 6} fontFamily={PAPER_THEME.tickFont} fontSize="10" textAnchor="end" fill={PAPER_THEME.tickColor}>200</text>
      <text x={PAD} y={H + 6} fontFamily={PAPER_THEME.tickFont} fontSize="10" textAnchor="start" fill={PAPER_THEME.tickColor}>0</text>
    </SVGChartContainer>
  );
}

/* ── Digital Twin Panel ────────────────────────────────────────────────────── */

export function DigitalTwinPanel() {
  const [readings, setReadings] = useState(10);
  const [result, setResult] = useState<import('../../../server/digitalTwinEngine').DigitalTwinResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [dtError, setDtError] = useState<string | null>(null);

  const handleRun = React.useCallback(async () => {
    setLoading(true);
    try {
      const { runDigitalTwin } = await import('../../../server/digitalTwinEngine');
      const config = {
        volume: 1, temperature: 37, pH: 7.0, dissolvedO2: 100,
        muMax: 0.5, ks: 0.5, yieldCoeff: 0.5, maintenanceCoeff: 0.02,
        productYield: 0.1, feedConcentration: 10, feedRate: 0.01,
        processNoise: 1.0, measurementNoise: 1.0, initialUncertainty: 1.0,
      };
      const sensorReadings = Array.from({ length: readings }, (_, i) => ({
        timestamp: i * 0.5,
        biomass: 0.1 * Math.exp(0.3 * i) + (Math.random() - 0.5) * 0.02,
        substrate: Math.max(0, 10 - 0.5 * i + (Math.random() - 0.5) * 0.1),
        product: 0.05 * i + (Math.random() - 0.5) * 0.01,
      }));
      const res = runDigitalTwin(config, sensorReadings, 12);
      setResult(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Digital twin simulation failed';
      setDtError(msg);
    } finally {
      setLoading(false);
    }
  }, [readings]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 16,
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
        border: `1px solid ${THEME.BORDER}`,
      }}>
        <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Sensor Readings
        </span>
        <input type="number" min={5} max={100} value={readings}
          onChange={(e) => setReadings(Number(e.target.value))}
          style={{ width: 60, padding: '4px 8px', background: THEME.INPUT_BG, border: `1px solid ${THEME.INPUT_BORDER}`, borderRadius: 'var(--nb-radius-sm)', color: THEME.INPUT_TEXT, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', outline: 'none' }}
        />
        <button onClick={handleRun} disabled={loading} className="nb-tool-toggle"
          style={{ padding: '6px 14px', fontSize: 'var(--nb-fs-sm)', opacity: loading ? 0.4 : 1 }}
        >
          {loading ? 'Synchronizing...' : 'Run Digital Twin'}
        </button>
        {result && (
          <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: 'rgba(255,255,255,0.4)' }}>
            R²={result.diagnostics.modelFit.toFixed(3)} • {result.diagnostics.anomalyCount} anomalies
          </span>
        )}
      </div>

      {dtError && <SimErrorBanner message={dtError} onRetry={() => setDtError(null)} />}

      {result && (
        <div style={{
          background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 12,
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10,
          border: `1px solid ${THEME.BORDER}`,
        }}>
          {[
            { label: 'Biomass', value: `${result.currentState.biomass.toFixed(3)} g/L`, color: THEME.MINT },
            { label: 'Substrate', value: `${result.currentState.substrate.toFixed(3)} g/L`, color: THEME.SKY },
            { label: 'Product', value: `${result.currentState.product.toFixed(3)} g/L`, color: THEME.APRICOT },
            { label: 'μ (growth)', value: `${result.currentState.specificGrowthRate.toFixed(4)} h⁻¹`, color: THEME.LILAC },
            { label: 'μ_max drift', value: `${result.diagnostics.parameterDrift.muMax}%`, color: Math.abs(result.diagnostics.parameterDrift.muMax) > 10 ? 'rgba(250,128,114,0.7)' : 'rgba(147,203,82,0.7)' },
            { label: 'Model Fit', value: `R² ${result.diagnostics.modelFit.toFixed(3)}`, color: result.diagnostics.modelFit > 0.9 ? 'rgba(147,203,82,0.7)' : 'rgba(250,128,114,0.7)' },
          ].map((m, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--nb-radius-sm)', padding: '8px 10px',
              border: `1px solid rgba(255,255,255,0.05)`,
            }}>
              <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                {m.label}
              </div>
              <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', color: m.color, fontWeight: 600 }}>
                {m.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {result && result.forecast.length > 0 && (
        <div style={{ background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 12, border: `1px solid ${THEME.BORDER}` }}>
          <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            12h Forecast (Monte Carlo, 95% CI)
          </div>
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 4 }}>
            {result.forecast.filter((_, i) => i % 4 === 0).map((f, i) => (
              <div key={i} style={{
                minWidth: 80, padding: '6px 8px', background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)', borderRadius: 'var(--nb-radius-sm)',
                textAlign: 'center',
              }}>
                <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: 'rgba(255,255,255,0.3)' }}>
                  {f.time.toFixed(0)}h
                </div>
                <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.MINT }}>
                  {f.biomass.mean.toFixed(2)}
                </div>
                <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: 'rgba(255,255,255,0.25)' }}>
                  [{f.biomass.ci95[0].toFixed(2)}, {f.biomass.ci95[1].toFixed(2)}]
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {result && result.designNotes.length > 0 && (
        <div style={{
          background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 12,
          fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6,
          border: `1px solid ${THEME.BORDER}`,
        }}>
          {result.designNotes.map((n, i) => <div key={i}>• {n}</div>)}
        </div>
      )}
    </div>
  );
}

/* ── Bioreactor Analytics Panel ────────────────────────────────────────────── */

export function BioreactorAnalyticsPanel() {
  const [readings, setReadings] = useState(20);
  const [result, setResult] = useState<import('../../../server/bioreactorAnalyticsEngine').BioreactorAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [baError, setBaError] = useState<string | null>(null);

  const handleRun = React.useCallback(async () => {
    setLoading(true);
    try {
      const { analyzeBioreactorData } = await import('../../../server/bioreactorAnalyticsEngine');
      const data = Array.from({ length: readings }, (_, i) => ({
        time: i * 0.5,
        biomass: 0.1 * Math.exp(0.15 * i),
        substrate: Math.max(0, 10 - 0.3 * i),
        product: 0.04 * i,
        dissolvedO2: 80 - i * 0.5,
        pH: 7.0,
        temperature: 37,
      }));
      const res = analyzeBioreactorData(data);
      setResult(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Bioreactor analytics failed';
      setBaError(msg);
    } finally {
      setLoading(false);
    }
  }, [readings]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 16,
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
        border: `1px solid ${THEME.BORDER}`,
      }}>
        <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Batch Data Points
        </span>
        <input type="number" min={10} max={200} value={readings}
          onChange={(e) => setReadings(Number(e.target.value))}
          style={{ width: 60, padding: '4px 8px', background: THEME.INPUT_BG, border: `1px solid ${THEME.INPUT_BORDER}`, borderRadius: 'var(--nb-radius-sm)', color: THEME.INPUT_TEXT, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', outline: 'none' }}
        />
        <button onClick={handleRun} disabled={loading} className="nb-tool-toggle"
          style={{ padding: '6px 14px', fontSize: 'var(--nb-fs-sm)', opacity: loading ? 0.4 : 1 }}
        >
          {loading ? 'Analyzing...' : 'Run Analytics'}
        </button>
        {result && (
          <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: 'rgba(255,255,255,0.4)' }}>
            {result.anomalies.length} anomalies • {result.phases.length} phases • μmax={result.kinetics.muMax}
          </span>
        )}
      </div>

      {baError && <SimErrorBanner message={baError} onRetry={() => setBaError(null)} />}

      {result && (
        <>
          <div style={{ background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 12, border: `1px solid ${THEME.BORDER}` }}>
            <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, marginBottom: 6 }}>Growth Phases</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {result.phases.map((p, i) => (
                <span key={i} style={{
                  padding: '3px 8px',
                  background: p.phase === 'exponential' ? 'rgba(147,203,82,0.1)' : p.phase === 'stationary' ? 'rgba(200,216,232,0.1)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${p.phase === 'exponential' ? 'rgba(147,203,82,0.2)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: '3px',
                  fontFamily: THEME.MONO,
                  fontSize: 'var(--nb-fs-xs)',
                  color: p.phase === 'exponential' ? 'rgba(147,203,82,0.8)' : 'rgba(255,255,255,0.5)',
                }}>
                  {p.phase} ({p.duration.toFixed(1)}h)
                  {p.growthRate !== undefined && ` μ=${p.growthRate}`}
                </span>
              ))}
            </div>
          </div>

          <div style={{ background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, border: `1px solid ${THEME.BORDER}` }}>
            {[
              { label: 'μmax', value: `${result.kinetics.muMax} h⁻¹`, color: THEME.MINT },
              { label: 'Ks', value: `${result.kinetics.ks} g/L`, color: THEME.SKY },
              { label: 'Yxs', value: `${result.kinetics.yieldCoeff} g/g`, color: THEME.APRICOT },
              { label: 'R²', value: result.kinetics.r2.toString(), color: result.kinetics.r2 > 0.8 ? 'rgba(147,203,82,0.7)' : 'rgba(250,128,114,0.7)' },
            ].map((m, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.LABEL }}>{m.label}</div>
                <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', color: m.color, fontWeight: 600 }}>{m.value}</div>
              </div>
            ))}
          </div>

          {result.recommendations.length > 0 && (
            <div style={{ background: THEME.PANEL_SURFACE, borderRadius: 'var(--nb-radius-lg)', padding: 12, border: `1px solid ${THEME.BORDER}` }}>
              <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, marginBottom: 6 }}>Recommendations</div>
              {result.recommendations.map((r, i) => (
                <div key={i} style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
                  • {r}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
