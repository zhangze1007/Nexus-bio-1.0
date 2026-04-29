'use client';
import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import ToolShell, { TOOL_TOKENS as T } from './shared/ToolShell';
import ModuleCard from './shared/ModuleCard';
import TactileSlider from './shared/TactileSlider';
import ScientificHero from './shared/ScientificHero';
import ScientificFigureFrame from './shared/ScientificFigureFrame';
import ScientificMethodStrip from './shared/ScientificMethodStrip';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import DemoBanner from '../ide/shared/DemoBanner';
import { PATHD_THEME } from '../workbench/workbenchTheme';
import { SEMANTIC, SEMANTIC_RGB } from '../charts/chartTheme';
import { PATHWAY_STEPS, computeThermo } from '../../data/mockCETHX';
import type { PathwayKey } from '../../data/mockCETHX';
import { useUIStore } from '../../store/uiStore';
import { useWorkbenchStore } from '../../store/workbenchStore';
import type { ProvenanceEntry } from '../../types/assumptions';
import { buildCETHXSeed } from './shared/workbenchDataflow';
import { createProvenanceEntry } from '../../utils/provenance';

// ── Breathing Waterfall Chart ──────────────────────────────────────────

function catmullRomPath(pts: [number, number][]): string {
  if (pts.length < 2) return '';
  const p = [pts[0], ...pts, pts[pts.length - 1]];
  let d = `M ${p[1][0].toFixed(1)} ${p[1][1].toFixed(1)}`;
  for (let i = 1; i < p.length - 2; i++) {
    const [x0, y0] = p[i - 1], [x1, y1] = p[i], [x2, y2] = p[i + 1], [x3, y3] = p[i + 2];
    const cp1x = x1 + (x2 - x0) / 6, cp1y = y1 + (y2 - y0) / 6;
    const cp2x = x2 - (x3 - x1) / 6, cp2y = y2 - (y3 - y1) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }
  return d;
}

function BreathingWaterfall({ steps }: { steps: ReturnType<typeof computeThermo>['steps'] }) {
  const W = 520, H = 356, PAD = { top: 42, right: 26, bottom: 62, left: 58 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const minG = Math.min(0, ...steps.map(s => s.cumulative));
  const maxG = Math.max(0, ...steps.map(s => s.cumulative), ...steps.map(s => s.deltaG));
  const range = maxG - minG || 1;
  function yPos(v: number) { return PAD.top + innerH - ((v - minG) / range) * innerH; }
  const barW = Math.max(18, innerW / steps.length - 10);
  const limitingStep = [...steps].sort((left, right) => right.deltaG - left.deltaG)[0];

  // Energy landscape Catmull-Rom spline through cumulative ΔG points
  const splinePts: [number, number][] = steps.map((s, i) => [
    PAD.left + (i / steps.length) * innerW + barW / 2,
    yPos(s.cumulative),
  ]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <rect x="0" y="0" width={W} height={H} rx="14" fill="#05070b" />
      <rect
        x={PAD.left - 22}
        y={PAD.top - 18}
        width={innerW + 34}
        height={innerH + 30}
        rx="14"
        fill="rgba(255,255,255,0.02)"
        stroke="rgba(255,255,255,0.06)"
      />
      {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
        const y = PAD.top + tick * innerH;
        return (
          <line
            key={`grid-${tick}`}
            x1={PAD.left}
            y1={y}
            x2={W - PAD.right}
            y2={y}
            stroke="rgba(255,255,255,0.045)"
            strokeWidth={0.8}
          />
        );
      })}
      <line x1={PAD.left} y1={yPos(0)} x2={W - PAD.right} y2={yPos(0)}
        stroke="rgba(255,255,255,0.08)" strokeWidth={1} />

      <text x={PAD.left} y={18} fontFamily={T.SANS} fontSize="9" fill={PATHD_THEME.label} letterSpacing="0.12em">
        THERMODYNAMIC WATERFALL
      </text>
      <text x={PAD.left} y={30} fontFamily={T.SANS} fontSize="11" fill={PATHD_THEME.value}>
        Stepwise free-energy burden with cumulative load and ATP-coupled events
      </text>

      <motion.polyline
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
        points={steps.map((s, i) => {
          const x = PAD.left + (i / steps.length) * innerW + barW / 2;
          return `${x},${yPos(s.cumulative)}`;
        }).join(' ')}
        fill="none" stroke="rgba(240,248,255,0.52)" strokeWidth={1.7} strokeDasharray="4 2"
      />

      {steps.map((step, i) => {
        const x = PAD.left + (i / steps.length) * innerW + 2;
        const isNeg = step.deltaG < 0;
        const isInfeasible = step.deltaG > 0;
        const color = step.atpYield > 0
          ? PATHD_THEME.orange
          : isNeg ? `rgba(${SEMANTIC_RGB.pass}, 0.82)` : SEMANTIC.fail;
        const topY = Math.min(yPos(step.cumulative), yPos(step.cumulative - step.deltaG));
        const h = Math.abs(yPos(step.cumulative) - yPos(step.cumulative - step.deltaG));
        const cx = x + (barW - 4) / 2;
        const isLimiting = step.step === limitingStep?.step;

        return (
          <g key={step.step + i}>
            <rect
              x={x}
              y={topY}
              width={barW - 4}
              height={h}
              rx={4}
              fill={color}
              opacity={0.82}
            />
            <rect
              x={x}
              y={topY}
              width={barW - 4}
              height={h}
              rx={4}
              fill="none"
              stroke={isLimiting ? 'rgba(255,255,255,0.7)' : isInfeasible ? `rgba(${SEMANTIC_RGB.fail}, 0.55)` : 'rgba(255,255,255,0.12)'}
              strokeWidth={isLimiting ? 1.4 : 0.8}
            />
            <circle cx={cx} cy={yPos(step.cumulative)} r={3.5} fill="rgba(247,249,255,0.95)" />
            {isInfeasible && (
              <text
                x={cx}
                y={topY - 5}
                textAnchor="middle"
                fontFamily={T.MONO}
                fontSize="6"
                fill={SEMANTIC.fail}
              >
                INFEASIBLE
              </text>
            )}
            {step.atpYield > 0 && !isInfeasible && (
              <text
                x={cx}
                y={topY - 8}
                textAnchor="middle"
                fontFamily={T.MONO}
                fontSize="7"
                fill={PATHD_THEME.orange}
              >
                ATP +{step.atpYield.toFixed(0)}
              </text>
            )}
            {isLimiting && (
              <>
                <line
                  x1={cx}
                  y1={topY - 10}
                  x2={cx}
                  y2={PAD.top - 6}
                  stroke="rgba(255,255,255,0.24)"
                  strokeDasharray="4 3"
                />
                <text
                  x={cx}
                  y={PAD.top - 14}
                  textAnchor="middle"
                  fontFamily={T.MONO}
                  fontSize="7"
                  fill="rgba(255,255,255,0.72)"
                >
                  LIMITING
                </text>
              </>
            )}
          </g>
        );
      })}

      {/* Energy landscape spline overlay */}
      {splinePts.length > 1 && (
        <path
          d={catmullRomPath(splinePts)}
          fill="none"
          stroke="#FF7F00"
          strokeWidth={2}
          strokeOpacity={0.85}
        />
      )}

      {steps.map((step, i) => {
        const x = PAD.left + (i / steps.length) * innerW + barW / 2;
        return (
          <g key={`lbl${i}`}>
            <text
              x={x}
              y={H - 18}
              textAnchor="middle"
              fontFamily={T.MONO}
              fontSize="7"
              fill="rgba(255,255,255,0.34)"
              transform={`rotate(-38,${x},${H - 18})`}
            >
              {step.step.slice(0, 12)}
            </text>
            <text
              x={x}
              y={H - 34}
              textAnchor="middle"
              fontFamily={T.MONO}
              fontSize="7"
              fill={step.deltaG < 0 ? `rgba(${SEMANTIC_RGB.pass}, 0.85)` : `rgba(${SEMANTIC_RGB.fail}, 0.85)`}
            >
              {step.deltaG > 0 ? '+' : ''}{step.deltaG.toFixed(1)}
            </text>
          </g>
        );
      })}

      {[-40, -20, 0, 20].map(v => v >= minG && v <= maxG ? (
        <g key={v}>
          <line x1={PAD.left - 4} y1={yPos(v)} x2={PAD.left} y2={yPos(v)} stroke="rgba(255,255,255,0.08)" />
          <text x={PAD.left - 8} y={yPos(v) + 3} textAnchor="end" fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.28)">
            {v}
          </text>
        </g>
      ) : null)}

      <text x={10} y={H / 2} textAnchor="middle" fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.18)"
        transform={`rotate(-90,10,${H / 2})`}>ΔG (kJ/mol)</text>

      <g transform={`translate(${W - 174}, 14)`}>
        <rect width="154" height="54" rx="10" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" />
        <text x="12" y="17" fontFamily={T.MONO} fontSize="7" fill={PATHD_THEME.label}>CURRENT LIMITING STEP</text>
        <text x="12" y="31" fontFamily={T.SANS} fontSize="11" fill={PATHD_THEME.value}>
          {limitingStep?.step ?? '—'}
        </text>
        <text x="12" y="45" fontFamily={T.MONO} fontSize="8" fill={`rgba(${SEMANTIC_RGB.fail}, 0.85)`}>
          ΔG {limitingStep ? `${limitingStep.deltaG > 0 ? '+' : ''}${limitingStep.deltaG.toFixed(1)} kJ/mol` : '—'}
        </text>
      </g>

      {[
        { color: `rgba(${SEMANTIC_RGB.pass}, 0.82)`, label: 'Exergonic' },
        { color: SEMANTIC.fail, label: 'Infeasible (ΔG>0)' },
        { color: PATHD_THEME.orange, label: 'ATP-coupled' },
        { color: '#FF7F00', label: 'Energy landscape', line: true },
      ].map((l, i) => (
        <g key={l.label} transform={`translate(${PAD.left + i * 100},${PAD.top - 16})`}>
          {l.line
            ? <line x1={0} y1={4} x2={10} y2={4} stroke={l.color} strokeWidth={2} />
            : <rect width={10} height={8} rx={2} fill={l.color} opacity={0.78} />}
          <text x={14} y={8} fontFamily={T.SANS} fontSize={8} fill="rgba(255,255,255,0.28)">{l.label}</text>
        </g>
      ))}
    </svg>
  );
}

// ── Pathway list ───────────────────────────────────────────────────────

const PATHWAYS: { id: PathwayKey; label: string; desc: string }[] = [
  { id: 'glycolysis', label: 'Glycolysis', desc: 'Glucose → 2 Pyruvate' },
  { id: 'tca',        label: 'TCA Cycle',  desc: 'Acetyl-CoA → CO₂ + energy' },
  { id: 'ppp',        label: 'Pentose ℙ',  desc: 'G6P → Ribose-5P + NADPH' },
];

// ── Main Page ──────────────────────────────────────────────────────────

export default function CETHXPage() {
  const project = useWorkbenchStore((s) => s.project);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const pathdPayload = useWorkbenchStore((s) => s.toolPayloads.pathd);
  const fbaPayload = useWorkbenchStore((s) => s.toolPayloads.fbasim);
  const setToolPayload = useWorkbenchStore((s) => s.setToolPayload);
  const [pathway, setPathway] = useState<PathwayKey>('glycolysis');
  const [tempC, setTempC] = useState(37);
  const [pH, setPH] = useState(7.4);
  const recommendedSeed = useMemo(
    () => buildCETHXSeed(project, analyzeArtifact, fbaPayload, pathdPayload),
    [analyzeArtifact?.generatedAt, analyzeArtifact?.id, fbaPayload?.updatedAt, pathdPayload?.updatedAt, project?.id, project?.updatedAt],
  );

  useEffect(() => {
    setPathway(recommendedSeed.pathway);
    setTempC(recommendedSeed.tempC);
    setPH(recommendedSeed.pH);
  }, [recommendedSeed.pH, recommendedSeed.pathway, recommendedSeed.tempC]);

  const thermo = useMemo(() =>
    computeThermo(PATHWAY_STEPS[pathway], tempC, pH),
    [pathway, tempC, pH]
  );
  const limitingStep = useMemo(
    () => [...thermo.steps].sort((left, right) => right.deltaG - left.deltaG)[0]?.step ?? null,
    [thermo.steps],
  );

  useEffect(() => {
    const now = Date.now();
    const upstreamProvenance = [fbaPayload?.runProvenance, pathdPayload?.runProvenance]
      .filter((entry): entry is ProvenanceEntry => Boolean(entry))
      .map((entry) => `${entry.toolId}:${entry.timestamp}`);
    setToolPayload('cethx', {
      validity: 'demo',
      runProvenance: createProvenanceEntry({
        toolId: 'cethx',
        outputAssumptions: [
          'cethx.thermodynamics_demo_only',
          'cethx.missing_condition_aware_backend',
          'cethx.uncertainty_not_calculated',
          'cethx.uniform_ph_factor',
          'cethx.linear_temperature_only',
          'cethx.no_ionic_strength_correction',
          'cethx.lehninger_lookup',
          'cethx.atp_yields_hardcoded',
        ],
        evidence: [{
          id: `cethx-${now}`,
          source: 'mock',
          reference: 'MOCK_DATA: no peer-reviewed source for this placeholder thermodynamics calculation.',
          confidence: 'demo',
          notes: 'CETHX remains demo; output ΔG values are not for thermodynamic feasibility decisions.',
        }],
        upstreamProvenance,
      }),
      toolId: 'cethx',
      targetProduct: analyzeArtifact?.targetProduct || project?.targetProduct || project?.title || 'Target Product',
      sourceArtifactId: analyzeArtifact?.id,
      pathway,
      tempC,
      pH,
      result: {
        atpYield: thermo.atp_yield,
        nadhYield: thermo.nadh_yield,
        gibbsFreeEnergy: thermo.gibbs_free_energy,
        entropyProduction: thermo.entropy_production,
        efficiency: thermo.efficiency,
        limitingStep,
      },
      updatedAt: now,
    });
  }, [analyzeArtifact?.id, analyzeArtifact?.targetProduct, fbaPayload?.runProvenance, pathdPayload?.runProvenance, pathway, pH, project?.targetProduct, project?.title, setToolPayload, tempC, thermo]);

  // Console logging
  const appendConsole = useUIStore((s) => s.appendConsole);
  useEffect(() => {
    appendConsole({
      level: thermo.gibbs_free_energy < 0 ? 'info' : 'warn',
      module: 'CETHX',
      message: `CETHX demo — ${pathway} @ ${tempC}°C pH${pH} | reference ΔG°'=${thermo.gibbs_free_energy.toFixed(1)} kJ/mol | uncertainty not calculated`,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thermo]);

  const fba = fbaPayload;

  return (
    <ToolShell
      moduleId="cethx"
      title="Cell Thermodynamics Engine"
      description="Demo thermodynamics explainer — Lehninger/NIST reference ΔG°′ with no condition-aware backend"
      formula="reference ΔG°′ table · uncertainty not calculated"
      grid="'side main main' 'side steps metrics'"
      columns="240px 1fr 220px"
      rows="2fr 1fr"
      gap={6}
      workbenchSummary="Demo thermodynamics explainer that keeps reference Delta-G, ATP/NADH yield, and limiting-step context visible without making condition-aware feasibility claims."
      workbenchSimulated={!analyzeArtifact}
      hero={
        <>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-4 flex items-start gap-3">
            <AlertTriangle
              className="text-amber-400 shrink-0 mt-0.5"
              size={20}
            />
            <div className="text-amber-200 text-sm leading-relaxed">
              <strong className="font-semibold">Demonstration Tool</strong>
              {' — '}
              CETHX uses Lehninger/NIST reference values only. It is not a
              condition-aware ΔG′ backend: uncertainty, ionic strength, pMg,
              and compound mapping are not calculated. Outputs are for UI
              illustration only and are not formal thermodynamic claims.
            </div>
          </div>
          <ScientificHero
            eyebrow="Stage 2 · Demo Thermodynamics"
            title={`${PATHWAYS.find((entry) => entry.id === pathway)?.label ?? pathway} as reference energy bookkeeping`}
            summary="CETHX keeps an energy ledger visible for workflow exploration. It exposes reference step values, total free-energy burden, and ATP/NADH bookkeeping without claiming condition-aware thermodynamic feasibility."
            aside={fba ? (
              <>
                <div style={{ fontFamily: T.MONO, fontSize: '10px', color: PATHD_THEME.label, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Linked authority flux state
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: '13px', color: PATHD_THEME.value, fontWeight: 700 }}>
                  {`μ=${fba.result.growthRate.toFixed(4)} h⁻¹ · ηC=${fba.result.carbonEfficiency.toFixed(1)}%`}
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: '11px', color: PATHD_THEME.label, lineHeight: 1.55 }}>
                  Shadow prices stay attached here as context, but CETHX remains a demo reference ledger rather than a condition-aware decision backend.
                </div>
              </>
            ) : (
              <>
                <div style={{ fontFamily: T.MONO, fontSize: '10px', color: PATHD_THEME.label, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Flux linkage
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: '13px', color: PATHD_THEME.value, fontWeight: 700 }}>
                  Awaiting upstream authority solve
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: '11px', color: PATHD_THEME.label, lineHeight: 1.55 }}>
                  Reference thermodynamic context is visible, but shadow-price context becomes stronger once FBASim has completed the current route.
                </div>
              </>
            )}
            signals={[
              {
                label: 'Reference Delta-G',
                value: `${thermo.gibbs_free_energy.toFixed(1)} kJ/mol`,
                detail: thermo.gibbs_free_energy < 0 ? 'Reference total is negative; not a condition-aware feasibility result.' : 'Positive reference burden suggests a demo-level redesign question, not a formal feasibility result.',
                tone: thermo.gibbs_free_energy < 0 ? 'cool' : 'warm',
              },
              {
                label: 'Efficiency',
                value: `${thermo.efficiency.toFixed(1)}%`,
                detail: `${thermo.atp_yield.toFixed(1)} ATP · ${thermo.nadh_yield.toFixed(1)} NADH`,
                tone: thermo.efficiency > 50 ? 'cool' : 'warm',
              },
              {
                label: 'Limiting Step',
                value: limitingStep ?? 'Pending',
                detail: 'This is the reaction most likely to constrain downstream catalyst or control choices.',
                tone: 'neutral',
              },
              {
                label: 'Displayed Conditions',
                value: `${tempC.toFixed(0)}°C · pH ${pH.toFixed(1)}`,
                detail: 'Temperature and pH are displayed with the payload, but no Alberty transform or uncertainty calculation is applied.',
                tone: 'neutral',
              },
            ]}
          />
          <ScientificMethodStrip
            label="Demo thermodynamic bench"
            items={[
              {
                title: 'Route selection',
                detail: 'Pathway choice, temperature, and pH stay visible as context, but they do not drive a condition-aware backend calculation.',
                accent: PATHD_THEME.apricot,
                note: `${PATHWAYS.find((entry) => entry.id === pathway)?.label ?? pathway}`,
              },
              {
                title: 'Energy figure',
                detail: 'The main waterfall becomes a single evidence panel showing step burden, cumulative load, ATP coupling, and the route-limiting reaction together.',
                accent: PATHD_THEME.sky,
                note: limitingStep ?? 'limiting step pending',
              },
              {
                title: 'Decision ledger',
                detail: 'Step breakdown and ATP/NADH metrics remain attached as demo context so downstream tools inherit an honest reference signal.',
                accent: PATHD_THEME.mint,
                note: `${thermo.efficiency.toFixed(1)}% efficiency`,
              },
            ]}
          />
        </>
      }
      footer={
        <>
          {fba && (
            <div role="status" style={{ padding: '6px 14px', background: 'rgba(175,195,214,0.14)', border: '1px solid rgba(175,195,214,0.28)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              <span style={{ fontFamily: T.MONO, fontSize: '9px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: 'rgba(175,195,214,0.22)', border: '1px solid rgba(175,195,214,0.34)', color: T.VALUE, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
                FBASim
              </span>
              <span style={{ fontFamily: T.SANS, fontSize: '11px', color: T.LABEL }}>
                {'✓ Flux data loaded — '}
                <span style={{ fontFamily: T.MONO, color: T.VALUE }}>
                  {`μ=${fba.result.growthRate.toFixed(4)} h⁻¹ · ∂μ/∂Glc=${fba.result.shadowPrices.glc.toFixed(4)} · ∂μ/∂O₂=${fba.result.shadowPrices.o2.toFixed(4)}`}
                </span>
              </span>
            </div>
          )}
          <DemoBanner context="Glycolysis / TCA / Pentose Phosphate thermodynamics" />
          <ExportButton label="Export JSON" data={thermo} filename="cethx-thermodynamics" format="json" />
          <ExportButton label="Export CSV" data={thermo.steps} filename="cethx-steps" format="csv" />
        </>
      }
    >
      {/* ── Sidebar: Pathway + Sliders ──────────────────────── */}
      <ModuleCard area="side" title="Parameters" active={true}>
        <div style={{ flex: 1, paddingTop: '4px' }}>
          {/* Pathway selector */}
          <div style={{ marginBottom: '16px' }}>
            {PATHWAYS.map(p => (
              <motion.button
                key={p.id}
                onClick={() => setPathway(p.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '8px 10px', marginBottom: '4px',
                  background: pathway === p.id ? 'rgba(231,199,169,0.22)' : PATHD_THEME.panelSurface,
                  border: pathway === p.id
                    ? `1px solid rgba(231,199,169,0.34)`
                    : `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
                  borderRadius: '10px', cursor: 'pointer',
                }}
              >
                <span style={{
                  fontFamily: T.SANS, fontSize: '11px', fontWeight: 500,
                  color: pathway === p.id ? T.VALUE : T.LABEL,
                  display: 'block',
                }}>
                  {p.label}
                </span>
                <span style={{
                  fontFamily: T.MONO, fontSize: '8px',
                  color: T.DIM,
                }}>
                  {p.desc}
                </span>
              </motion.button>
            ))}
          </div>

          {/* TactileSliders */}
          <TactileSlider
            label="Temperature" value={tempC} min={20} max={60} step={1}
            unit="°C" onChange={setTempC}
          />
          <TactileSlider
            label="pH" value={pH} min={5.5} max={9.0} step={0.1}
            onChange={setPH} color="rgba(120,180,255,0.9)"
          />
        </div>
      </ModuleCard>

      {/* ── Center: Breathing Waterfall ─────────────────────── */}
      <ModuleCard area="main" flush>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px', background: PATHD_THEME.panelInset,
        }}>
          <ScientificFigureFrame
            eyebrow="Thermodynamic waterfall"
            title="Free-energy burden, ATP coupling, and cumulative route load are read in one figure"
            caption="The central figure behaves like a publication panel instead of a dashboard chart, so limiting chemistry and operating-window assumptions stay legible in the same place."
            legend={[
              { label: 'Pathway', value: PATHWAYS.find((entry) => entry.id === pathway)?.label ?? pathway, accent: PATHD_THEME.apricot },
              { label: 'Window', value: `${tempC.toFixed(0)}°C / pH ${pH.toFixed(1)}`, accent: PATHD_THEME.sky },
              { label: 'Delta-G', value: `${thermo.gibbs_free_energy.toFixed(1)} kJ/mol`, accent: PATHD_THEME.coral },
              { label: 'ATP', value: `${thermo.atp_yield.toFixed(1)}`, accent: PATHD_THEME.mint },
            ]}
            footer={
              <div style={{ display: 'grid', gap: '6px' }}>
                <div style={{ fontFamily: T.SANS, fontSize: '11px', color: T.VALUE, lineHeight: 1.55 }}>
                  The page now makes thermodynamic feasibility readable as a route-level scientific figure, which is the right framing for deciding whether to redesign the enzyme, shift the operating window, or continue into control work.
                </div>
                <div style={{ fontFamily: T.MONO, fontSize: '10px', color: T.LABEL }}>
                  limiting step {limitingStep ?? 'pending'} · entropy {thermo.entropy_production.toFixed(3)} · NADH {thermo.nadh_yield.toFixed(1)}
                </div>
              </div>
            }
            minHeight="100%"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={pathway}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ width: '100%', maxWidth: '600px' }}
              >
                <BreathingWaterfall steps={thermo.steps} />
              </motion.div>
            </AnimatePresence>
          </ScientificFigureFrame>
        </div>
      </ModuleCard>

      {/* ── Bottom-left: Step breakdown ─────────────────────── */}
      <ModuleCard area="steps" title="Step Breakdown">
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {thermo.steps.map((s, i) => (
            <motion.div
              key={s.step + i}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, duration: 0.2 }}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '4px 0',
                borderBottom: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
              }}
            >
              <span style={{
                fontFamily: T.SANS, fontSize: '9px',
                color: T.LABEL,
                maxWidth: '140px', overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {s.step}
              </span>
              <span style={{
                fontFamily: T.MONO, fontSize: '10px', fontWeight: 600,
                textAlign: 'right',
                color: s.deltaG < 0 ? PATHD_THEME.mint : PATHD_THEME.coral,
              }}>
                {s.deltaG > 0 ? '+' : ''}{s.deltaG.toFixed(1)}
              </span>
            </motion.div>
          ))}
        </div>
      </ModuleCard>

      {/* ── Right: Metrics ──────────────────────────────────── */}
      <ModuleCard area="metrics" title="Demo Thermodynamics">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <MetricCard label="Net ATP Yield" value={thermo.atp_yield} unit="mol/mol" highlight />
          <MetricCard label="NADH Yield" value={thermo.nadh_yield} unit="mol/mol" />
          <MetricCard label="Reference ΔG Total" value={thermo.gibbs_free_energy} unit="kJ/mol" />
          <MetricCard label="Entropy" value={thermo.entropy_production.toFixed(3)} unit="kJ/mol/K" />

          {/* Efficiency gauge */}
          <div style={{
            marginTop: '8px', padding: '10px',
            borderRadius: '12px',
            background: PATHD_THEME.panelInset,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontFamily: T.SANS, fontSize: '9px', color: T.LABEL }}>Efficiency</span>
              <motion.span
                key={thermo.efficiency}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  fontFamily: T.MONO, fontSize: '16px', fontWeight: 700,
                  color: thermo.efficiency > 50 ? T.VALUE : PATHD_THEME.coral,
                }}
              >
                {thermo.efficiency.toFixed(1)}%
              </motion.span>
            </div>
            <div style={{ width: '100%', height: `${PATHD_THEME.progressHeight}px`, borderRadius: `${PATHD_THEME.progressRadius}px`, background: PATHD_THEME.progressTrack }}>
              <motion.div
                animate={{ width: `${Math.min(100, thermo.efficiency)}%` }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                style={{
                  height: '100%', borderRadius: `${PATHD_THEME.progressRadius}px`,
                  background: thermo.efficiency > 50
                    ? PATHD_THEME.progressGradient
                    : 'linear-gradient(90deg, rgba(232,163,161,0.45), rgba(232,163,161,0.95))',
                  boxShadow: thermo.efficiency > 50
                    ? PATHD_THEME.progressGlow
                    : '0 0 8px rgba(232,163,161,0.32)',
                }}
              />
            </div>
          </div>

          <div style={{
            padding: '12px',
            borderRadius: '12px',
            border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
            background: PATHD_THEME.panelInset,
            display: 'grid',
            gap: '6px',
          }}>
            <div style={{ fontFamily: T.MONO, fontSize: '9px', color: T.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Interpretation
            </div>
            <div style={{ fontFamily: T.SANS, fontSize: '11px', color: T.VALUE, lineHeight: 1.55 }}>
              {thermo.gibbs_free_energy < 0
                ? 'The reference table total is negative, but this is not a condition-aware feasibility claim or backend-backed Delta-G prime result.'
                : 'The reference table total is positive, so this remains a demo-level redesign prompt rather than a formal thermodynamic block.'}
            </div>
          </div>
        </div>
      </ModuleCard>
    </ToolShell>
  );
}
