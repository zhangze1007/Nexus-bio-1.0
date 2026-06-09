'use client';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import ToolShell, { TOOL_TOKENS as T } from './shared/ToolShell';
import WorkbenchRangeSlider from './shared/WorkbenchRangeSlider';
import ScientificHero from './shared/ScientificHero';
import ScientificFigureFrame from './shared/ScientificFigureFrame';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import { SEMANTIC, SEMANTIC_RGB } from '../charts/chartTheme';
import { PATHWAY_STEPS, computeThermo } from '../../data/mockCETHX';
import type { PathwayKey } from '../../data/mockCETHX';
import type { ThermoStep } from '../../types';
import { useUIStore } from '../../store/uiStore';
import { useWorkbenchStore } from '../../store/workbenchStore';
import type { ProvenanceEntry } from '../../types/assumptions';
import { buildCETHXSeed } from './shared/workbenchDataflow';
import { createProvenanceEntry } from '../../utils/provenance';
import ToolTabPanel from './shared/ToolTabPanel';
import FloatingControlRail from './shared/FloatingControlRail';
import InlineMetricOverlay from './shared/InlineMetricOverlay';
import type { ToolTab } from './shared/ToolTabBar';
import { KEGG_REACTIONS } from '../../hooks/useEquilibrator';

// ── Breathing Waterfall Chart ──────────────────────────────────────────

import { catmullRomPath } from '../../utils/svgPath';
import { SVGChartContainer } from '../charts/primitives';
import { THEME } from '../../theme';

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
    <SVGChartContainer W={W} H={H} ariaLabel="Thermodynamic waterfall" rx={14} fill="#05070b">
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

      <text x={PAD.left} y={18} fontFamily={THEME.SANS} fontSize="10" fill={THEME.LABEL} letterSpacing="0.12em">
        THERMODYNAMIC WATERFALL
      </text>
      <text x={PAD.left} y={30} fontFamily={THEME.SANS} fontSize="11" fill={THEME.VALUE}>
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
          ? THEME.APRICOT
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
                fontFamily={THEME.MONO}
                fontSize="10"
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
                fontFamily={THEME.MONO}
                fontSize="10"
                fill={THEME.APRICOT}
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
                  fontFamily={THEME.MONO}
                  fontSize="10"
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
          stroke={THEME.APRICOT}
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
              fontFamily={THEME.MONO}
              fontSize="10"
              fill="rgba(255,255,255,0.34)"
              transform={`rotate(-38,${x},${H - 18})`}
            >
              {step.step.slice(0, 12)}
            </text>
            <text
              x={x}
              y={H - 34}
              textAnchor="middle"
              fontFamily={THEME.MONO}
              fontSize="10"
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
          <text x={PAD.left - 8} y={yPos(v) + 3} textAnchor="end" fontFamily={THEME.MONO} fontSize="10" fill="rgba(255,255,255,0.28)">
            {v}
          </text>
        </g>
      ) : null)}

      <text x={10} y={H / 2} textAnchor="middle" fontFamily={THEME.MONO} fontSize="10" fill="rgba(255,255,255,0.18)"
        transform={`rotate(-90,10,${H / 2})`}>ΔG (kJ/mol)</text>

      <g transform={`translate(${W - 174}, 14)`}>
        <rect width="154" height="54" rx="10" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" />
        <text x="12" y="17" fontFamily={THEME.MONO} fontSize="10" fill={THEME.LABEL}>CURRENT LIMITING STEP</text>
        <text x="12" y="31" fontFamily={THEME.SANS} fontSize="11" fill={THEME.VALUE}>
          {limitingStep?.step ?? '—'}
        </text>
        <text x="12" y="45" fontFamily={THEME.MONO} fontSize="10" fill={`rgba(${SEMANTIC_RGB.fail}, 0.85)`}>
          ΔG {limitingStep ? `${limitingStep.deltaG > 0 ? '+' : ''}${limitingStep.deltaG.toFixed(1)} kJ/mol` : '—'}
        </text>
      </g>

      {[
        { color: `rgba(${SEMANTIC_RGB.pass}, 0.82)`, label: 'Exergonic' },
        { color: SEMANTIC.fail, label: 'Infeasible (ΔG>0)' },
        { color: THEME.APRICOT, label: 'ATP-coupled' },
        { color: THEME.APRICOT, label: 'Energy landscape', line: true },
      ].map((l, i) => (
        <g key={l.label} transform={`translate(${PAD.left + i * 100},${PAD.top - 16})`}>
          {l.line
            ? <line x1={0} y1={4} x2={10} y2={4} stroke={l.color} strokeWidth={2} />
            : <rect width={10} height={8} rx={2} fill={l.color} opacity={0.78} />}
          <text x={14} y={8} fontFamily={THEME.SANS} fontSize={8} fill="rgba(255,255,255,0.28)">{l.label}</text>
        </g>
      ))}
    </SVGChartContainer>
  );
}

// ── Pathway list ───────────────────────────────────────────────────────

const PATHWAYS: { id: PathwayKey; label: string; desc: string }[] = [
  { id: 'glycolysis', label: 'Glycolysis', desc: 'Glucose → 2 Pyruvate' },
  { id: 'tca',        label: 'TCA Cycle',  desc: 'Acetyl-CoA → CO₂ + energy' },
  { id: 'ppp',        label: 'Pentose ℙ',  desc: 'G6P → Ribose-5P + NADPH' },
];

const CETHX_TABS: ToolTab[] = [
  { id: 'waterfall', label: 'Waterfall', accent: THEME.SKY },
  { id: 'atp', label: 'ATP Ledger', accent: THEME.LILAC },
  { id: 'feasibility', label: 'Feasibility', accent: THEME.APRICOT },
];

// ── Main Page ──────────────────────────────────────────────────────────

export default React.memo(function CETHXPage() {
  const project = useWorkbenchStore((s) => s.project);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const pathdPayload = useWorkbenchStore((s) => s.toolPayloads.pathd);
  const fbaPayload = useWorkbenchStore((s) => s.toolPayloads.fbasim);
  const setToolPayload = useWorkbenchStore((s) => s.setToolPayload);
  const [pathway, setPathway] = useState<PathwayKey>('glycolysis');
  const [tempC, setTempC] = useState(37);
  const [pH, setPH] = useState(7.4);
  const [equilibratorData, setEquilibratorData] = useState<Map<string, { dG_prime: number; dG_prime_uncertainty: number }>>(new Map());
  const [isRealData, setIsRealData] = useState(false);
  const [isLoadingEquilibrator, setIsLoadingEquilibrator] = useState(false);

  const recommendedSeed = useMemo(
    () => buildCETHXSeed(project, analyzeArtifact, fbaPayload, pathdPayload),
    [analyzeArtifact?.generatedAt, analyzeArtifact?.id, fbaPayload?.updatedAt, pathdPayload?.updatedAt, project?.id, project?.updatedAt],
  );

  useEffect(() => {
    setPathway(recommendedSeed.pathway);
    setTempC(recommendedSeed.tempC);
    setPH(recommendedSeed.pH);
  }, [recommendedSeed.pH, recommendedSeed.pathway, recommendedSeed.tempC]);

  // Fetch real eQuilibrator data when conditions change
  useEffect(() => {
    const reactions = KEGG_REACTIONS[pathway];
    if (!reactions) return;

    setIsLoadingEquilibrator(true);
    const newData = new Map<string, { dG_prime: number; dG_prime_uncertainty: number }>();

    const fetchAll = async () => {
      try {
        const promises = Object.entries(reactions).map(async ([stepName, formula]) => {
          try {
            const response = await fetch('/api/equilibrator', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                reaction: formula,
                pH: pH,
                temperature: tempC + 273.15,
                ionic_strength: 0.25,
              }),
            });

            if (response.ok) {
              const result = await response.json();
              if (!result.error && result.dG_prime !== undefined) {
                newData.set(stepName, {
                  dG_prime: result.dG_prime,
                  dG_prime_uncertainty: result.dG_prime_uncertainty || 0,
                });
              }
            }
          } catch {
            // Individual reaction failed - skip
          }
        });

        await Promise.allSettled(promises);

        if (newData.size > 0) {
          setEquilibratorData(newData);
          setIsRealData(true);
        } else {
          setIsRealData(false);
        }
      } catch {
        setIsRealData(false);
      } finally {
        setIsLoadingEquilibrator(false);
      }
    };

    fetchAll();
  }, [pathway, tempC, pH]);

  // Compute thermo with eQuilibrator data when available
  const thermo = useMemo(() => {
    const baseThermo = computeThermo(PATHWAY_STEPS[pathway], tempC, pH);

    if (!isRealData || equilibratorData.size === 0) {
      return baseThermo;
    }

    // Merge real data with reference data
    const mergedSteps = baseThermo.steps.map(step => {
      const realData = equilibratorData.get(step.step);
      if (realData) {
        return {
          ...step,
          deltaG: realData.dG_prime,
          uncertainty: realData.dG_prime_uncertainty,
        };
      }
      return step;
    });

    // Recalculate cumulative
    let cum = 0;
    const stepsWithCumulative = mergedSteps.map(step => {
      cum += step.deltaG;
      return { ...step, cumulative: cum };
    });

    const totalDeltaG = cum;
    const atpNet = stepsWithCumulative.reduce((a, s) => a + s.atpYield, 0);
    const nadhYield = stepsWithCumulative.reduce((a, s) => a + ((s as ThermoStep & { nadhYield?: number }).nadhYield ?? 0), 0);
    const T = tempC + 273.15;
    const dissipationKJ = -totalDeltaG;
    const entropyChange = dissipationKJ / T;
    const efficiency = Math.max(0, Math.min(100, (-totalDeltaG / 2870) * 100));

    return {
      steps: stepsWithCumulative,
      atp_yield: atpNet,
      nadh_yield: nadhYield,
      entropy_production: entropyChange,
      dissipation_kJ_per_mol: dissipationKJ,
      gibbs_free_energy: totalDeltaG,
      efficiency,
    };
  }, [pathway, tempC, pH, isRealData, equilibratorData]);

  const limitingStep = useMemo(
    () => [...thermo.steps].sort((left, right) => right.deltaG - left.deltaG)[0]?.step ?? null,
    [thermo.steps],
  );

  useEffect(() => {
    const now = Date.now();
    const upstreamProvenance = [fbaPayload?.runProvenance, pathdPayload?.runProvenance]
      .filter((entry): entry is ProvenanceEntry => Boolean(entry))
      .map((entry) => `${entry.toolId}:${entry.timestamp}`);

    const assumptions = isRealData
      ? [
          'cethx.equilibrator_backend',
          'cethx.alberty_transform',
          'cethx.condition_aware',
          'cethx.uncertainty_calculated',
        ]
      : [
          'cethx.thermodynamics_demo_only',
          'cethx.missing_condition_aware_backend',
          'cethx.uncertainty_not_calculated',
          'cethx.uniform_ph_factor',
          'cethx.linear_temperature_only',
          'cethx.no_ionic_strength_correction',
          'cethx.lehninger_lookup',
          'cethx.atp_yields_hardcoded',
        ];

    const evidence = isRealData
      ? [{
          id: `cethx-${now}`,
          source: 'computation' as const,
          reference: 'Beber et al. 2022, Nucleic Acids Research. DOI: 10.1093/nar/gkab1106',
          confidence: 'high' as const,
          notes: `Condition-aware ΔG' at pH ${pH}, ${tempC}°C, I=0.25M. Alberty transform applied via eQuilibrator 3 (ComponentContribution).`,
        }]
      : [{
          id: `cethx-${now}`,
          source: 'mock' as const,
          reference: 'MOCK_DATA: no peer-reviewed source for this placeholder thermodynamics calculation.',
          confidence: 'demo' as const,
          notes: 'CETHX remains demo; output ΔG values are not for thermodynamic feasibility decisions.',
        }];

    setToolPayload('cethx', {
      validity: isRealData ? 'real' : 'demo',
      runProvenance: createProvenanceEntry({
        toolId: 'cethx',
        outputAssumptions: assumptions,
        evidence,
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
  }, [analyzeArtifact?.id, analyzeArtifact?.targetProduct, fbaPayload?.runProvenance, pathdPayload?.runProvenance, pathway, pH, project?.targetProduct, project?.title, setToolPayload, tempC, thermo, isRealData]);

  // Console logging
  const appendConsole = useUIStore((s) => s.appendConsole);
  useEffect(() => {
    const source = isRealData ? 'eQuilibrator' : 'reference';
    const uncertainty = isRealData ? '± uncertainty' : 'no uncertainty';
    appendConsole({
      level: thermo.gibbs_free_energy < 0 ? 'info' : 'warn',
      module: 'CETHX',
      message: `CETHX ${source} — ${pathway} @ ${tempC}°C pH${pH} | ΔG'=${thermo.gibbs_free_energy.toFixed(1)} kJ/mol | ${uncertainty}`,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thermo, isRealData]);

  const fba = fbaPayload;

  const [activeTab, setActiveTab] = useState('waterfall');

  return (
    <ToolShell
      moduleId="cethx"
      title="Cell Thermodynamics Engine"
      description={isRealData
        ? "Condition-aware thermodynamics — eQuilibrator 3 with Alberty transform"
        : "Demo thermodynamics explainer — Lehninger/NIST reference ΔG°′ with no condition-aware backend"
      }
      formula={isRealData
        ? "ΔG' = ΔG°' + RT·ln(Q) · Alberty transform · Debye-Hückel"
        : "reference ΔG°′ table · uncertainty not calculated"
      }
      tabs={CETHX_TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      advancedTabIds={['feasibility']}
      hero={
        <ScientificHero
          eyebrow={isRealData ? "Stage 2 · Real Thermodynamics" : "Stage 2 · Demo Thermodynamics"}
          title={`${PATHWAYS.find((entry) => entry.id === pathway)?.label ?? pathway} ${isRealData ? 'with condition-aware ΔG′' : 'as reference energy bookkeeping'}`}
          summary={isRealData
            ? "CETHX uses eQuilibrator 3 (ComponentContribution) for condition-aware thermodynamic calculations with Alberty transform, Debye-Hückel ionic strength correction, and uncertainty quantification."
            : "CETHX keeps an energy ledger visible for workflow exploration. It exposes reference step values, total free-energy burden, and ATP/NADH bookkeeping without claiming condition-aware thermodynamic feasibility."
          }
          signals={[
            {
              label: isRealData ? "ΔG′" : 'Reference ΔG',
              value: `${thermo.gibbs_free_energy.toFixed(1)} kJ/mol`,
              detail: thermo.gibbs_free_energy < 0
                ? (isRealData ? 'Thermodynamically favorable.' : 'Reference total is negative.')
                : (isRealData ? 'Thermodynamically unfavorable.' : 'Positive reference burden.'),
              tone: thermo.gibbs_free_energy < 0 ? 'cool' : 'warm'
            },
            {
              label: 'Efficiency',
              value: `${thermo.efficiency.toFixed(1)}%`,
              detail: `${thermo.atp_yield.toFixed(1)} ATP · ${thermo.nadh_yield.toFixed(1)} NADH`,
              tone: thermo.efficiency > 50 ? 'cool' : 'warm'
            },
            {
              label: 'Limiting Step',
              value: limitingStep ?? 'Pending',
              detail: 'Reaction most likely to constrain downstream choices.',
              tone: 'neutral'
            },
            {
              label: 'Conditions',
              value: `${tempC.toFixed(0)}°C · pH ${pH.toFixed(1)}`,
              detail: isRealData ? 'Alberty transform applied.' : 'No Alberty transform applied.',
              tone: 'neutral'
            },
            ...(isLoadingEquilibrator ? [{
              label: 'Status',
              value: 'Loading...',
              detail: 'Fetching eQuilibrator data',
              tone: 'neutral' as const,
            }] : []),
            ...(isRealData ? [{
              label: 'Source',
              value: 'eQuilibrator 3',
              detail: 'ComponentContribution with uncertainty',
              tone: 'cool' as const,
            }] : []),
          ]}
        />
      }
      footer={
        <>
          {fba && (
            <div role="status" style={{ padding: '6px 14px', background: 'rgba(175,195,214,0.14)', border: '1px solid rgba(175,195,214,0.28)', borderRadius: 'var(--nb-radius-md)', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: 'rgba(175,195,214,0.22)', border: '1px solid rgba(175,195,214,0.34)', color: THEME.VALUE, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
                FBASim
              </span>
              <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.LABEL }}>
                {'✓ Flux data loaded — '}
                <span style={{ fontFamily: THEME.MONO, color: THEME.VALUE }}>
                  {`μ=${fba.result.growthRate.toFixed(4)} h⁻¹ · ∂μ/∂Glc=${fba.result.sensitivityCoefficients.glc.toFixed(4)} · ∂μ/∂O₂=${fba.result.sensitivityCoefficients.o2.toFixed(4)}`}
                </span>
              </span>
            </div>
          )}
          <ExportButton label="Export JSON" data={thermo} filename="cethx-thermodynamics" format="json" />
          <ExportButton label="Export CSV" data={thermo.steps} filename="cethx-steps" format="csv" />
        </>
      }
    >
      {/* ── Waterfall Tab ── */}
      <ToolTabPanel tabId="waterfall" activeId={activeTab}>
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <FloatingControlRail label="Parameters" defaultCollapsed={false}>
            <div style={{ marginBottom: '16px' }}>
              {PATHWAYS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPathway(p.id)}
                  className={`nb-tool-toggle${pathway === p.id ? ' nb-tool-toggle--active' : ''}`}
                  aria-pressed={pathway === p.id}
                  aria-label={`Select ${p.label} pathway`}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '8px 10px', marginBottom: '4px',
                    borderRadius: 'var(--nb-radius-md)',
                  }}
                >
                  <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', fontWeight: 500, color: pathway === p.id ? THEME.VALUE : THEME.LABEL, display: 'block' }}>
                    {p.label}
                  </span>
                  <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.DIM }}>
                    {p.desc}
                  </span>
                </button>
              ))}
            </div>
            <WorkbenchRangeSlider label="Temperature" value={tempC} min={20} max={60} step={1} unit="°C" onChange={setTempC} />
            <WorkbenchRangeSlider label="pH" value={pH} min={5.5} max={9.0} step={0.1} onChange={setPH} />
          </FloatingControlRail>

          <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px', background: THEME.PANEL_INSET }}>
            <ScientificFigureFrame
              eyebrow="Thermodynamic waterfall"
              title="Free-energy burden, ATP coupling, and cumulative route load"
              caption="Publication-quality waterfall showing step-by-step ΔG cascade with limiting chemistry highlighted."
              legend={[
                { label: 'Pathway', value: PATHWAYS.find((entry) => entry.id === pathway)?.label ?? pathway, accent: THEME.APRICOT },
                { label: 'Window', value: `${tempC.toFixed(0)}°C / pH ${pH.toFixed(1)}`, accent: THEME.SKY },
                { label: 'Delta-G', value: `${thermo.gibbs_free_energy.toFixed(1)} kJ/mol`, accent: THEME.CORAL },
                { label: 'ATP', value: `${thermo.atp_yield.toFixed(1)}`, accent: THEME.MINT },
              ]}
              footer={
                <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL }}>
                  limiting step {limitingStep ?? 'pending'} · entropy {thermo.entropy_production.toFixed(3)} · NADH {thermo.nadh_yield.toFixed(1)}
                </div>
              }
              minHeight="100%"
            >
              <AnimatePresence mode="wait">
                <motion.div key={pathway} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} style={{ width: '100%', maxWidth: '600px' }}>
                  <BreathingWaterfall steps={thermo.steps} />
                </motion.div>
              </AnimatePresence>
            </ScientificFigureFrame>

            <InlineMetricOverlay
              position="top-right"
              metrics={[
                { label: 'ΔG', value: `${thermo.gibbs_free_energy.toFixed(1)} kJ/mol`, accent: thermo.gibbs_free_energy < 0 ? THEME.MINT : THEME.CORAL },
                { label: 'ATP', value: `${thermo.atp_yield.toFixed(1)}`, accent: THEME.MINT },
                { label: 'NADH', value: `${thermo.nadh_yield.toFixed(1)}`, accent: THEME.SKY },
                { label: 'Efficiency', value: `${thermo.efficiency.toFixed(1)}%`, accent: THEME.APRICOT },
              ]}
            />
          </div>
        </div>
      </ToolTabPanel>

      {/* ── ATP Ledger Tab ── */}
      <ToolTabPanel tabId="atp" activeId={activeTab}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '20px' }}>
            <MetricCard label="Net ATP Yield" value={thermo.atp_yield} unit="mol/mol" highlight />
            <MetricCard label="NADH Yield" value={thermo.nadh_yield} unit="mol/mol" />
            <MetricCard label="Reference ΔG Total" value={thermo.gibbs_free_energy} unit="kJ/mol" />
            <MetricCard label="Entropy" value={thermo.entropy_production.toFixed(3)} unit="kJ/mol/K" />
          </div>

          <div style={{ padding: '12px', borderRadius: 'var(--nb-radius-md)', background: THEME.PANEL_INSET, marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL }}>Efficiency</span>
              <motion.span
                key={thermo.efficiency}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-md)', fontWeight: 700, color: thermo.efficiency > 50 ? THEME.VALUE : THEME.CORAL }}
              >
                {thermo.efficiency.toFixed(1)}%
              </motion.span>
            </div>
            <div style={{ width: '100%', height: `${THEME.PROGRESS_HEIGHT}px`, borderRadius: `${THEME.PROGRESS_RADIUS}px`, background: THEME.PROGRESS_TRACK }}>
              <motion.div
                animate={{ width: `${Math.min(100, thermo.efficiency)}%` }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                style={{
                  height: '100%', borderRadius: `${THEME.PROGRESS_RADIUS}px`,
                  background: thermo.efficiency > 50 ? THEME.PROGRESS_GRADIENT : 'linear-gradient(90deg, rgba(232,163,161,0.45), rgba(232,163,161,0.95))',
                  boxShadow: thermo.efficiency > 50 ? THEME.PROGRESS_GLOW : '0 0 8px rgba(232,163,161,0.32)',
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', textTransform: 'uppercase', letterSpacing: '0.1em', color: THEME.LABEL, marginBottom: '10px' }}>
              Step Breakdown
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {thermo.steps.map((s, i) => (
                <motion.div
                  key={s.step + i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.2 }}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '4px 0', borderBottom: `1px solid ${THEME.BORDER}`,
                  }}
                >
                  <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.step}
                  </span>
                  <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', fontWeight: 600, textAlign: 'right', color: s.deltaG < 0 ? THEME.MINT : THEME.CORAL }}>
                    {s.deltaG > 0 ? '+' : ''}{s.deltaG.toFixed(1)}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </ToolTabPanel>

      {/* ── Feasibility Tab ── */}
      <ToolTabPanel tabId="feasibility" activeId={activeTab}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          <div style={{
            padding: '12px', borderRadius: 'var(--nb-radius-md)',
            border: `1px solid ${THEME.BORDER}`,
            background: THEME.PANEL_INSET, display: 'grid', gap: '6px', marginBottom: '20px',
          }}>
            <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Interpretation
            </div>
            <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.VALUE, lineHeight: 1.55 }}>
              {thermo.gibbs_free_energy < 0
                ? 'The reference table total is negative, but this is not a condition-aware feasibility claim or backend-backed Delta-G prime result.'
                : 'The reference table total is positive, so this remains a demo-level redesign prompt rather than a formal thermodynamic block.'}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '20px' }}>
            <MetricCard label="Limiting Step" value={limitingStep ?? 'Pending'} />
            <MetricCard label="Reference ΔG" value={thermo.gibbs_free_energy} unit="kJ/mol" />
            <MetricCard label="Efficiency" value={thermo.efficiency} unit="%" />
          </div>

          <div style={{
            padding: '12px', borderRadius: 'var(--nb-radius-md)',
            border: `1px solid ${THEME.BORDER}`,
            background: THEME.PANEL_INSET, display: 'grid', gap: '6px',
          }}>
            <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Conditions
            </div>
            <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.VALUE, lineHeight: 1.55 }}>
              {`Pathway: ${PATHWAYS.find((entry) => entry.id === pathway)?.label ?? pathway} · ${tempC.toFixed(0)}°C · pH ${pH.toFixed(1)} · No Alberty transform applied. This is a reference ΔG°′ table — not a condition-aware feasibility determination.`}
            </div>
          </div>
        </div>
      </ToolTabPanel>
    </ToolShell>
  );
});
