'use client';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import ToolShell, { TOOL_TOKENS as T } from './shared/ToolShell';
import WorkbenchRangeSlider from './shared/WorkbenchRangeSlider';
import ScientificHero from './shared/ScientificHero';
import AlgorithmPanel from '../shared/AlgorithmPanel';
import ScientificFigureFrame from './shared/ScientificFigureFrame';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import { SEMANTIC, SEMANTIC_RGB, PAPER_THEME } from '../charts/chartTheme';
import { PATHWAY_STEPS, computeThermo } from '../../data/mockCETHX';
import type { PathwayKey } from '../../data/mockCETHX';
import type { ThermoStep } from '../../types';
import { calcTransformedGibbs, calcTransformedKeq } from '../../services/thermoEngine';
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

// ── Per-step proton stoichiometry for Alberty transform ──────────────────
// Estimated nH (net H+ absorbed) and Δz² (charge change squared) per step.
// Source: reaction stoichiometry from KEGG, typical physiological protonation.
// Steps with NAD+/NADH involve -1 nH; kinase steps with ATP/ADP are ~0 nH.
const STEP_PROTON_STOICH: Record<PathwayKey, Array<{ nH: number; dz2: number }>> = {
  glycolysis: [
    { nH: 0, dz2: -2 },  // Glc → G6P (kinase: ATP→ADP)
    { nH: 0, dz2: 0 },   // G6P → F6P (isomerase)
    { nH: 0, dz2: -2 },  // F6P → FBP (kinase: ATP→ADP)
    { nH: 0, dz2: 0 },   // FBP → DHAP+GAP (aldolase)
    { nH: 0, dz2: 0 },   // DHAP → GAP (isomerase)
    { nH: -1, dz2: 1 },  // GAP → 1,3-BPG (dehydrogenase: NAD+→NADH)
    { nH: 0, dz2: 2 },   // 1,3-BPG → 3PG (kinase: ADP→ATP)
    { nH: 0, dz2: 0 },   // 3PG → 2PG (mutase)
    { nH: 0, dz2: 0 },   // 2PG → PEP (enolase)
    { nH: 0, dz2: 0 },   // PEP → Pyr (kinase: ADP→ATP)
  ],
  tca: [
    { nH: 0, dz2: 0 },   // AcCoA + OAA → Citrate (synthase)
    { nH: 0, dz2: 0 },   // Citrate → Isocitrate (aconitase)
    { nH: -1, dz2: 1 },  // Isocitrate → α-KG (dehydrogenase: NAD+→NADH)
    { nH: -1, dz2: 1 },  // α-KG → Succinyl-CoA (dehydrogenase: NAD+→NADH)
    { nH: 0, dz2: 2 },   // Succinyl-CoA → Succinate (kinase: GDP→GTP)
    { nH: -1, dz2: 0 },  // Succinate → Fumarate (dehydrogenase: FAD→FADH2)
    { nH: 0, dz2: 0 },   // Fumarate → Malate (hydratase)
    { nH: -1, dz2: 1 },  // Malate → OAA (dehydrogenase: NAD+→NADH)
  ],
  ppp: [
    { nH: -1, dz2: 1 },  // G6P → 6-PGL (dehydrogenase: NADP+→NADPH)
    { nH: 0, dz2: 0 },   // 6-PGL → 6-PG (lactonase)
    { nH: -1, dz2: 1 },  // 6-PG → Ribulose-5P (decarboxylating dehydrogenase)
    { nH: 0, dz2: 0 },   // Ribulose-5P → Ribose-5P (isomerase)
    { nH: 0, dz2: 0 },   // Transketolase
    { nH: 0, dz2: 0 },   // Transaldolase
  ],
};

/** Feasibility classification for a single step */
type StepFeasibility = 'feasible' | 'marginal' | 'infeasible';

function classifyFeasibility(dG: number): StepFeasibility {
  if (dG < -5) return 'feasible';
  if (dG <= 5) return 'marginal';
  return 'infeasible';
}

const FEASIBILITY_TONE: Record<StepFeasibility, 'cool' | 'neutral' | 'warm'> = {
  feasible: 'cool',
  marginal: 'neutral',
  infeasible: 'warm',
};

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
    <SVGChartContainer W={W} H={H} ariaLabel="Thermodynamic waterfall" variant="paper">
      <rect
        x={PAD.left - 22}
        y={PAD.top - 18}
        width={innerW + 34}
        height={innerH + 30}
        rx="14"
        fill={PAPER_THEME.bgAlt}
        stroke={PAPER_THEME.border}
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
            stroke={PAPER_THEME.grid}
            strokeWidth={0.5}
          />
        );
      })}
      <line x1={PAD.left} y1={yPos(0)} x2={W - PAD.right} y2={yPos(0)}
        stroke={PAPER_THEME.axis} strokeWidth={0.75} />

      <text x={PAD.left} y={18} fontFamily={PAPER_THEME.labelFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.labelColor} letterSpacing="0.12em">
        THERMODYNAMIC WATERFALL
      </text>
      <text x={PAD.left} y={30} fontFamily={PAPER_THEME.labelFont} fontSize={PAPER_THEME.labelSize} fill={PAPER_THEME.titleColor}>
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
        fill="none" stroke={PAPER_THEME.axis} strokeWidth={1.5} strokeDasharray="4 2"
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
              stroke={isLimiting ? PAPER_THEME.titleColor : isInfeasible ? `rgba(${SEMANTIC_RGB.fail}, 0.55)` : PAPER_THEME.border}
              strokeWidth={isLimiting ? 1.4 : 0.8}
            />
            <circle cx={cx} cy={yPos(step.cumulative)} r={3.5} fill={PAPER_THEME.scatterStroke} />
            {isInfeasible && (
              <text
                x={cx}
                y={topY - 5}
                textAnchor="middle"
                fontFamily={PAPER_THEME.tickFont}
                fontSize={PAPER_THEME.tickSize}
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
                fontFamily={PAPER_THEME.tickFont}
                fontSize={PAPER_THEME.tickSize}
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
                  stroke={PAPER_THEME.grid}
                  strokeDasharray="4 3"
                />
                <text
                  x={cx}
                  y={PAD.top - 14}
                  textAnchor="middle"
                  fontFamily={PAPER_THEME.tickFont}
                  fontSize={PAPER_THEME.tickSize}
                  fill={PAPER_THEME.labelColor}
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
              fontFamily={PAPER_THEME.tickFont}
              fontSize={PAPER_THEME.tickSize}
              fill={PAPER_THEME.tickColor}
              transform={`rotate(-38,${x},${H - 18})`}
            >
              {step.step.slice(0, 12)}
            </text>
            <text
              x={x}
              y={H - 34}
              textAnchor="middle"
              fontFamily={PAPER_THEME.tickFont}
              fontSize={PAPER_THEME.tickSize}
              fill={step.deltaG < 0 ? `rgba(${SEMANTIC_RGB.pass}, 0.85)` : `rgba(${SEMANTIC_RGB.fail}, 0.85)`}
            >
              {step.deltaG > 0 ? '+' : ''}{step.deltaG.toFixed(1)}
            </text>
          </g>
        );
      })}

      {[-40, -20, 0, 20].map(v => v >= minG && v <= maxG ? (
        <g key={v}>
          <line x1={PAD.left - 4} y1={yPos(v)} x2={PAD.left} y2={yPos(v)} stroke={PAPER_THEME.grid} />
          <text x={PAD.left - 8} y={yPos(v) + 3} textAnchor="end" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.tickColor}>
            {v}
          </text>
        </g>
      ) : null)}

      <text x={10} y={H / 2} textAnchor="middle" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.labelColor}
        transform={`rotate(-90,10,${H / 2})`}>ΔG (kJ/mol)</text>

      <g transform={`translate(${W - 174}, 14)`}>
        <rect width="154" height="54" rx={PAPER_THEME.borderRadius} fill={PAPER_THEME.bgAlt} stroke={PAPER_THEME.border} />
        <text x="12" y="17" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={PAPER_THEME.labelColor}>CURRENT LIMITING STEP</text>
        <text x="12" y="31" fontFamily={PAPER_THEME.labelFont} fontSize={PAPER_THEME.labelSize} fill={PAPER_THEME.titleColor}>
          {limitingStep?.step ?? '—'}
        </text>
        <text x="12" y="45" fontFamily={PAPER_THEME.tickFont} fontSize={PAPER_THEME.tickSize} fill={`rgba(${SEMANTIC_RGB.fail}, 0.85)`}>
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
          <text x={14} y={8} fontFamily={PAPER_THEME.legendFont} fontSize={PAPER_THEME.legendSize} fill={PAPER_THEME.legendColor}>{l.label}</text>
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

  // Compute thermo with eQuilibrator data when available,
  // otherwise apply Alberty transform via calcTransformedGibbs from thermoEngine.
  const thermo = useMemo(() => {
    const T = tempC + 273.15;
    const ionicStrength = 0.25; // physiological ionic strength (M)

    // Source 1: eQuilibrator API data (best)
    if (isRealData && equilibratorData.size > 0) {
      const baseThermo = computeThermo(PATHWAY_STEPS[pathway], tempC, pH);
      const mergedSteps = baseThermo.steps.map(step => {
        const realData = equilibratorData.get(step.step);
        if (realData) {
          return { ...step, deltaG: realData.dG_prime, uncertainty: realData.dG_prime_uncertainty };
        }
        return step;
      });

      let cum = 0;
      const stepsWithCumulative = mergedSteps.map(step => { cum += step.deltaG; return { ...step, cumulative: cum }; });
      const totalDeltaG = cum;
      const atpNet = stepsWithCumulative.reduce((a, s) => a + s.atpYield, 0);
      const nadhYield = stepsWithCumulative.reduce((a, s) => a + ((s as ThermoStep & { nadhYield?: number }).nadhYield ?? 0), 0);
      const dissipationKJ = -totalDeltaG;
      const entropyChange = dissipationKJ / T;
      const efficiency = Math.max(0, Math.min(100, (-totalDeltaG / 2870) * 100));
      return {
        steps: stepsWithCumulative,
        atp_yield: atpNet, nadh_yield: nadhYield,
        entropy_production: entropyChange, dissipation_kJ_per_mol: dissipationKJ,
        gibbs_free_energy: totalDeltaG, efficiency,
      };
    }

    // Source 2: Alberty-transformed reference ΔG° via calcTransformedGibbs (local real calculation)
    const refSteps = PATHWAY_STEPS[pathway];
    const stoich = STEP_PROTON_STOICH[pathway];

    const transformedSteps = refSteps.map((refStep, i) => {
      const { nH, dz2 } = stoich?.[i] ?? { nH: 0, dz2: 0 };
      const transformedDG = calcTransformedGibbs(refStep.deltaG, pH, ionicStrength, T, nH, dz2);
      return { ...refStep, deltaG: transformedDG, uncertainty: Math.abs(transformedDG) * 0.15 };
    });

    let cum = 0;
    const stepsWithCumulative = transformedSteps.map(step => { cum += step.deltaG; return { ...step, cumulative: cum }; });
    const totalDeltaG = cum;
    const atpNet = stepsWithCumulative.reduce((a, s) => a + s.atpYield, 0);
    const nadhYield = stepsWithCumulative.reduce((a, s) => a + ((s as ThermoStep & { nadhYield?: number }).nadhYield ?? 0), 0);
    const dissipationKJ = -totalDeltaG;
    const entropyChange = dissipationKJ / T;
    const efficiency = Math.max(0, Math.min(100, (-totalDeltaG / 2870) * 100));
    return {
      steps: stepsWithCumulative,
      atp_yield: atpNet, nadh_yield: nadhYield,
      entropy_production: entropyChange, dissipation_kJ_per_mol: dissipationKJ,
      gibbs_free_energy: totalDeltaG, efficiency,
    };
  }, [pathway, tempC, pH, isRealData, equilibratorData]);

  const limitingStep = useMemo(
    () => [...thermo.steps].sort((left, right) => right.deltaG - left.deltaG)[0]?.step ?? null,
    [thermo.steps],
  );

  // Per-step feasibility classification using the transformed ΔG values
  const feasibilityData = useMemo(() => {
    const stepResults = thermo.steps.map((s) => ({
      step: s.step,
      deltaG: s.deltaG,
      feasibility: classifyFeasibility(s.deltaG),
      tone: FEASIBILITY_TONE[classifyFeasibility(s.deltaG)],
      keq: calcTransformedKeq(s.deltaG, tempC + 273.15),
    }));
    const feasibleCount = stepResults.filter(r => r.feasibility === 'feasible').length;
    const marginalCount = stepResults.filter(r => r.feasibility === 'marginal').length;
    const infeasibleCount = stepResults.filter(r => r.feasibility === 'infeasible').length;
    const overallFeasible = infeasibleCount === 0;
    return { stepResults, feasibleCount, marginalCount, infeasibleCount, overallFeasible };
  }, [thermo.steps, tempC]);

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
          'cethx.alberty_transform_local',
          'cethx.group_contribution_reference',
          'cethx.condition_aware_ph_ionic',
          'cethx.uncertainty_estimated',
          'cethx.lehninger_reference_dg0',
          'cethx.atp_yields_hardcoded',
          'cethx.proton_stoich_estimated',
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
          source: 'computation' as const,
          reference: 'Alberty (2003) Thermodynamics of Biochemical Reactions; Mavrovouniotis (1991) J Biol Chem 266(22):14440-14445',
          confidence: 'medium' as const,
          notes: `Alberty-transformed ΔG' from Lehninger reference ΔG° at pH ${pH}, ${tempC}°C, I=0.25M via calcTransformedGibbs. Proton stoichiometry estimated from KEGG reaction equations.`,
        }];

    setToolPayload('cethx', {
      validity: 'real',
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
    const source = isRealData ? 'eQuilibrator' : 'Alberty-local';
    appendConsole({
      level: thermo.gibbs_free_energy < 0 ? 'info' : 'warn',
      module: 'CETHX',
      message: `CETHX ${source} — ${pathway} @ ${tempC}°C pH${pH} | ΔG'=${thermo.gibbs_free_energy.toFixed(1)} kJ/mol | feasible=${feasibilityData.overallFeasible}`,
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
        : "Condition-aware thermodynamics — Alberty transform with Lehninger reference ΔG°"
      }
      formula="ΔG' = ΔG° + RT·ln(10)·(pH-7)·nH + Debye-Hückel(Δz², I)"
      tabs={CETHX_TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      advancedTabIds={['feasibility']}
      hero={
        <ScientificHero
          eyebrow="Stage 2 · Condition-Aware Thermodynamics"
          title={`${PATHWAYS.find((entry) => entry.id === pathway)?.label ?? pathway} with condition-aware ΔG′`}
          summary={isRealData
            ? "CETHX uses eQuilibrator 3 (ComponentContribution) for condition-aware thermodynamic calculations with Alberty transform, Debye-Hückel ionic strength correction, and uncertainty quantification."
            : "CETHX applies the Alberty transform (Alberty 2003) to Lehninger reference ΔG° values, adjusting for pH and ionic strength via Debye-Hückel theory. Per-step feasibility is assessed from the transformed ΔG′."
          }
          signals={[
            {
              label: "ΔG′",
              value: `${thermo.gibbs_free_energy.toFixed(1)} kJ/mol`,
              detail: thermo.gibbs_free_energy < 0
                ? 'Thermodynamically favorable.'
                : 'Thermodynamically unfavorable.',
              tone: thermo.gibbs_free_energy < 0 ? 'cool' : 'warm'
            },
            {
              label: 'Efficiency',
              value: `${thermo.efficiency.toFixed(1)}%`,
              detail: `${thermo.atp_yield.toFixed(1)} ATP · ${thermo.nadh_yield.toFixed(1)} NADH`,
              tone: thermo.efficiency > 50 ? 'cool' : 'warm'
            },
            {
              label: 'Feasibility',
              value: feasibilityData.overallFeasible ? 'All steps feasible' : `${feasibilityData.infeasibleCount} infeasible`,
              detail: `${feasibilityData.feasibleCount} feasible · ${feasibilityData.marginalCount} marginal · ${feasibilityData.infeasibleCount} infeasible`,
              tone: feasibilityData.overallFeasible ? 'cool' : 'warm'
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
              detail: 'Alberty transform · Debye-Hückel I=0.25M',
              tone: 'neutral'
            },
            ...(isLoadingEquilibrator ? [{
              label: 'Status',
              value: 'Loading...',
              detail: 'Fetching eQuilibrator data',
              tone: 'neutral' as const,
            }] : []),
            {
              label: 'Source',
              value: isRealData ? 'eQuilibrator 3' : 'Alberty Transform',
              detail: isRealData ? 'ComponentContribution with uncertainty' : 'calcTransformedGibbs from thermoEngine',
              tone: 'cool' as const,
            },
          ]}
        />
      }
      footer={
        <>
          {fba && (
            <div role="status" style={{ padding: '6px 14px', background: `${THEME.SKY}24`, border: `1px solid ${THEME.SKY}47`, borderRadius: 'var(--nb-radius-md)', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: `${THEME.SKY}38`, border: `1px solid ${THEME.SKY}57`, color: THEME.VALUE, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
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
      {/* ── Algorithm Transparency ── */}
      <div style={{ padding: '8px 16px' }}>
        <AlgorithmPanel
          name="Alberty Transformed Gibbs Energy"
          description="Applies the Alberty formalism to transform standard Gibbs energy (ΔG°) values from Lehninger reference tables into condition-aware ΔG′ values. Accounts for pH-dependent protonation via RT·ln(10)·(pH-7)·nH and ionic strength effects via Debye-Hückel theory: 9.205·Δz²·√I/(1+1.6·√I)."
          assumptions={[
            `Temperature: ${tempC}°C (${(tempC + 273.15).toFixed(2)} K)`,
            `pH: ${pH.toFixed(1)}`,
            'Ionic strength I = 0.25 M (physiological)',
            'Aqueous phase reactions only',
            'Proton stoichiometry estimated from KEGG reaction equations',
            'Reference ΔG° values from Lehninger/NIST tables',
          ]}
          limitations={[
            'Reference ΔG° values are at standard conditions (25°C, pH 7)',
            'Proton stoichiometry (nH) is estimated, not from measured pKa values',
            'Charge change (Δz²) is approximate',
            'Does not account for magnesium binding effects',
            'Compartment-specific ΔG′ adjustments not included',
          ]}
          citation={{
            authors: 'Alberty RA',
            title: 'Thermodynamics of Biochemical Reactions',
            journal: 'Wiley-Interscience',
            year: 2003,
            doi: '10.1002/0471332607',
          }}
        />
      </div>

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
                {isLoadingEquilibrator ? (
                  <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ width: '100%', maxWidth: '600px' }}>
                    <div style={{ display: 'grid', gap: '8px', padding: '16px' }}>
                      <div style={{ height: '14px', width: '40%', borderRadius: '4px', background: `linear-gradient(90deg, ${THEME.PANEL_STRONG} 25%, rgba(255,255,255,0.06) 50%, ${THEME.PANEL_STRONG} 75%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.5s ease-in-out infinite' }} />
                      <div style={{ height: '280px', borderRadius: '12px', background: `linear-gradient(90deg, ${THEME.PANEL_STRONG} 25%, rgba(255,255,255,0.06) 50%, ${THEME.PANEL_STRONG} 75%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.5s ease-in-out infinite' }} />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {[1,2,3].map(i => <div key={i} style={{ height: '48px', flex: 1, borderRadius: '8px', background: `linear-gradient(90deg, ${THEME.PANEL_STRONG} 25%, rgba(255,255,255,0.06) 50%, ${THEME.PANEL_STRONG} 75%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.5s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />)}
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key={pathway} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} style={{ width: '100%', maxWidth: '600px' }}>
                    <BreathingWaterfall steps={thermo.steps} />
                  </motion.div>
                )}
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
                  background: thermo.efficiency > 50 ? THEME.PROGRESS_GRADIENT : `linear-gradient(90deg, ${THEME.CORAL}73, ${THEME.CORAL}F2)`,
                  boxShadow: thermo.efficiency > 50 ? THEME.PROGRESS_GLOW : `0 0 8px ${THEME.CORAL}52`,
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
          {/* Overall feasibility banner */}
          <div style={{
            padding: '14px 16px', borderRadius: 'var(--nb-radius-md)',
            border: `1px solid ${feasibilityData.overallFeasible ? `${THEME.MINT}57` : `${THEME.CORAL}57`}`,
            background: feasibilityData.overallFeasible ? `${THEME.MINT}12` : `${THEME.CORAL}12`,
            display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px',
          }}>
            <span style={{
              fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', fontWeight: 700,
              padding: '4px 10px', borderRadius: '999px',
              background: feasibilityData.overallFeasible ? `${THEME.MINT}28` : `${THEME.CORAL}28`,
              color: feasibilityData.overallFeasible ? THEME.MINT : THEME.CORAL,
            }}>
              {feasibilityData.overallFeasible ? 'FEASIBLE' : 'INFEASIBLE STEPS'}
            </span>
            <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.VALUE, lineHeight: 1.5 }}>
              {feasibilityData.overallFeasible
                ? `All ${thermo.steps.length} steps have ΔG′ < 0 (exergonic) or are marginal. The pathway is thermodynamically feasible under current conditions.`
                : `${feasibilityData.infeasibleCount} of ${thermo.steps.length} steps have ΔG′ > 0 (endergonic). These require coupling or substrate channeling to proceed.`}
            </span>
          </div>

          {/* Summary metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
            <MetricCard label="Overall ΔG′" value={thermo.gibbs_free_energy} unit="kJ/mol" highlight={thermo.gibbs_free_energy < 0} />
            <MetricCard label="Feasible Steps" value={feasibilityData.feasibleCount} unit={`/ ${thermo.steps.length}`} />
            <MetricCard label="Infeasible Steps" value={feasibilityData.infeasibleCount} />
            <MetricCard label="Limiting Step" value={limitingStep ?? 'Pending'} />
          </div>

          {/* Per-step feasibility table */}
          <div style={{
            padding: '12px', borderRadius: 'var(--nb-radius-md)',
            border: `1px solid ${THEME.BORDER}`,
            background: THEME.PANEL_INSET, marginBottom: '16px',
          }}>
            <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
              Per-Step Feasibility Assessment
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 90px', gap: '2px 8px', alignItems: 'center' }}>
              {/* Header */}
              <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.DIM, letterSpacing: '0.06em' }}>STEP</span>
              <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.DIM, textAlign: 'right', letterSpacing: '0.06em' }}>ΔG′ (kJ/mol)</span>
              <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.DIM, textAlign: 'right', letterSpacing: '0.06em' }}>K′eq</span>
              <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', color: THEME.DIM, textAlign: 'center', letterSpacing: '0.06em' }}>STATUS</span>
              {/* Rows */}
              {feasibilityData.stepResults.map((r, i) => (
                <React.Fragment key={r.step + i}>
                  <motion.span
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.2 }}
                    style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.VALUE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '3px 0', borderBottom: `1px solid ${THEME.BORDER}` }}
                  >
                    {r.step}
                  </motion.span>
                  <span style={{
                    fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', fontWeight: 600, textAlign: 'right',
                    color: r.deltaG < 0 ? THEME.MINT : r.deltaG <= 5 ? THEME.APRICOT : THEME.CORAL,
                    padding: '3px 0', borderBottom: `1px solid ${THEME.BORDER}`,
                  }}>
                    {r.deltaG > 0 ? '+' : ''}{r.deltaG.toFixed(1)}
                  </span>
                  <span style={{
                    fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', textAlign: 'right',
                    color: THEME.DIM,
                    padding: '3px 0', borderBottom: `1px solid ${THEME.BORDER}`,
                  }}>
                    {r.keq >= 1e3 ? r.keq.toExponential(1) : r.keq <= 1e-3 ? r.keq.toExponential(1) : r.keq.toFixed(2)}
                  </span>
                  <span style={{ padding: '3px 0', borderBottom: `1px solid ${THEME.BORDER}`, textAlign: 'center' }}>
                    <span style={{
                      fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xxs)', fontWeight: 600,
                      padding: '2px 8px', borderRadius: '999px', letterSpacing: '0.04em',
                      background: r.feasibility === 'feasible' ? `${THEME.MINT}22` : r.feasibility === 'marginal' ? `${THEME.APRICOT}22` : `${THEME.CORAL}22`,
                      color: r.feasibility === 'feasible' ? THEME.MINT : r.feasibility === 'marginal' ? THEME.APRICOT : THEME.CORAL,
                    }}>
                      {r.feasibility.toUpperCase()}
                    </span>
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Interpretation */}
          <div style={{
            padding: '12px', borderRadius: 'var(--nb-radius-md)',
            border: `1px solid ${THEME.BORDER}`,
            background: THEME.PANEL_INSET, display: 'grid', gap: '6px', marginBottom: '16px',
          }}>
            <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Interpretation
            </div>
            <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.VALUE, lineHeight: 1.55 }}>
              {thermo.gibbs_free_energy < 0
                ? `The Alberty-transformed total ΔG′ = ${thermo.gibbs_free_energy.toFixed(1)} kJ/mol at pH ${pH.toFixed(1)}, ${tempC}°C is negative, indicating thermodynamic favorability. ${feasibilityData.infeasibleCount > 0 ? `However, ${feasibilityData.infeasibleCount} individual step(s) are endergonic and may require substrate channeling or coupling to proceed.` : 'All individual steps are exergonic or marginal.'}`
                : `The total ΔG′ = ${thermo.gibbs_free_energy.toFixed(1)} kJ/mol is positive. The pathway is thermodynamically unfavorable under these conditions. Consider adjusting pH, temperature, or metabolite concentrations to shift equilibrium.`}
            </div>
          </div>

          {/* Conditions */}
          <div style={{
            padding: '12px', borderRadius: 'var(--nb-radius-md)',
            border: `1px solid ${THEME.BORDER}`,
            background: THEME.PANEL_INSET, display: 'grid', gap: '6px',
          }}>
            <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Conditions
            </div>
            <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.VALUE, lineHeight: 1.55 }}>
              {`Pathway: ${PATHWAYS.find((entry) => entry.id === pathway)?.label ?? pathway} · ${tempC.toFixed(0)}°C · pH ${pH.toFixed(1)} · I = 0.25 M · Alberty transform with Debye-Hückel ionic strength correction. ${isRealData ? 'eQuilibrator 3 (ComponentContribution) backend.' : 'Reference ΔG° from Lehninger, transformed via calcTransformedGibbs.'}`}
            </div>
          </div>
        </div>
      </ToolTabPanel>
    </ToolShell>
  );
});
