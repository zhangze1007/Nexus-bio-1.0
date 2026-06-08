'use client';
import { useState, useMemo, useRef, useEffect } from 'react';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import SimErrorBanner from '../ide/shared/SimErrorBanner';
import { SimSkeleton } from '../shared/Skeleton';
import { usePersistedState } from '../ide/shared/usePersistedState';
import { useUIStore } from '../../store/uiStore';
import { useWorkbenchStore } from '../../store/workbenchStore';
import ScientificHero from './shared/ScientificHero';
import {
  METABOLIC_NODES, FLUX_EDGES, REACTION_DEFS,
  YEAST_NODES, YEAST_FLUX_EDGES, YEAST_REACTION_DEFS, SHARED_METABOLITES,
} from '../../data/mockFBA';
import type { FBAOutput, CommunityFBAOutput } from '../../data/mockFBA';
import type { ProvenanceEntry } from '../../types/assumptions';
import { buildFBASeed } from './shared/workbenchDataflow';
import { solveAuthorityCommunityFBAWithProvenance, solveAuthorityFBAWithProvenance } from '../../services/FBAAuthorityClient';
import { T, TOOL_RESULT_PALETTE} from '../ide/tokens';
import { PATHD_THEME } from '../workbench/workbenchTheme';
import { SCI_PALETTE, SCI_PASTEL } from '../charts/chartTheme';
import ScientificFigureFrame from './shared/ScientificFigureFrame';
import WorkbenchRangeSlider from './shared/WorkbenchRangeSlider';
import ToolShell from './shared/ToolShell';
import ToolTabPanel from './shared/ToolTabPanel';
import FloatingControlRail from './shared/FloatingControlRail';
import InlineMetricOverlay from './shared/InlineMetricOverlay';
import type { ToolTab } from './shared/ToolTabBar';

// ── Extracted sub-components (imported from fbasim/) ──
import { FluxMap, W, H, SUBSYSTEM_COLORS, FLUX_FWD_COLOR, FLUX_REV_COLOR, runForceLayout } from './fbasim/FluxMap';
import { COLORS, ParamSlider, GlassContainer, SharedMetaboliteBus, StrainPanel } from './fbasim/CommunityPanels';
import { round, createEmptyFBAOutput, createEmptyCommunityOutput, type SimMode } from './fbasim/fbaHelpers';

// ═══════════════════════════════════════════════════════════════════════════════
// ── MAIN COMPONENT ──
// ═══════════════════════════════════════════════════════════════════════════════

const FBA_TABS: ToolTab[] = [
  { id: 'flux', label: 'Flux Map', accent: PATHD_THEME.sky },
  { id: 'knockout', label: 'Knockout', accent: PATHD_THEME.coral },
  { id: 'shadows', label: 'Sensitivity', accent: PATHD_THEME.lilac },
  { id: 'community', label: 'Community', accent: PATHD_THEME.mint },
];

export default function FBASimPage() {
  const [simMode, setSimMode] = useState<SimMode>('single');
  const chartRef = useRef<SVGSVGElement>(null);
  const project = useWorkbenchStore((s) => s.project);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const pathdPayload = useWorkbenchStore((s) => s.toolPayloads.pathd);
  const dbtlPayload = useWorkbenchStore((s) => s.toolPayloads.dbtlflow);
  const setToolPayload = useWorkbenchStore((s) => s.setToolPayload);

  // Single-species state (persisted)
  const [glucoseUptake, setGlucoseUptake] = usePersistedState('nexus-bio:fba:glucose', 10);
  const [oxygenUptake, setOxygenUptake] = usePersistedState('nexus-bio:fba:oxygen', 12);
  const [objective, setObjective] = useState<'biomass' | 'atp' | 'product'>('biomass');
  const [knockouts, setKnockouts] = useState<string[]>([]);

  // Community state (persisted)
  const [ecoliGlucose, setEcoliGlucose] = usePersistedState('nexus-bio:fba:ecoli-glucose', 10);
  const [ecoliOxygen, setEcoliOxygen] = usePersistedState('nexus-bio:fba:ecoli-oxygen', 12);
  const [ecoliKO, setEcoliKO] = useState<string[]>([]);
  const [yeastGlucose, setYeastGlucose] = usePersistedState('nexus-bio:fba:yeast-glucose', 8);
  const [yeastOxygen, setYeastOxygen] = usePersistedState('nexus-bio:fba:yeast-oxygen', 6);
  const [yeastKO, setYeastKO] = useState<string[]>([]);
  const [singleResult, setSingleResult] = useState<FBAOutput>(() => createEmptyFBAOutput());
  const [singleRunProvenance, setSingleRunProvenance] = useState<ProvenanceEntry | undefined>(undefined);
  const [singleError, setSingleError] = useState<string | null>(null);
  const [singleLoading, setSingleLoading] = useState(true);
  const [communityResult, setCommunityResult] = useState<CommunityFBAOutput>(() => createEmptyCommunityOutput());
  const [communityRunProvenance, setCommunityRunProvenance] = useState<ProvenanceEntry | undefined>(undefined);
  const [communityError, setCommunityError] = useState<string | null>(null);
  const [communityLoading, setCommunityLoading] = useState(true);
  const recommendedSeed = useMemo(
    () => buildFBASeed(project, analyzeArtifact, dbtlPayload, pathdPayload),
    [analyzeArtifact?.generatedAt, analyzeArtifact?.id, dbtlPayload?.feedbackSource, dbtlPayload?.result.improvementRate, dbtlPayload?.result.latestPhase, dbtlPayload?.result.passRate, dbtlPayload?.updatedAt, pathdPayload?.updatedAt, project?.id, project?.updatedAt],
  );

  // P1.2: track the seed signature that was last applied. Without this, every
  // upstream update silently overwrites persisted local edits (E. coli / yeast
  // glucose & oxygen) — non-monotonic and surprising. We now (a) only re-seed
  // when the upstream signature actually changes and (b) surface a dismissible
  // notice when the new seed is replacing locally-modified persisted values.
  const seedSignature = useMemo(
    () => `${recommendedSeed.mode}|${recommendedSeed.objective}|${recommendedSeed.glucoseUptake}|${recommendedSeed.oxygenUptake}|${recommendedSeed.knockouts.join(',')}`,
    [recommendedSeed.glucoseUptake, recommendedSeed.knockouts, recommendedSeed.mode, recommendedSeed.objective, recommendedSeed.oxygenUptake],
  );
  const lastAppliedSeedRef = useRef<string | null>(null);
  const [seedOverwriteNotice, setSeedOverwriteNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('flux');

  useEffect(() => {
    if (lastAppliedSeedRef.current === seedSignature) return;

    const expectedEcoliGlc = Math.max(3, round(recommendedSeed.glucoseUptake * 0.58));
    const expectedEcoliO2  = Math.max(3, round(recommendedSeed.oxygenUptake  * 0.65));
    const expectedYeastGlc = Math.max(2, round(recommendedSeed.glucoseUptake * 0.42));
    const expectedYeastO2  = Math.max(2, round(recommendedSeed.oxygenUptake  * 0.45));

    // Detect divergence: only meaningful after we have applied at least one seed.
    if (lastAppliedSeedRef.current !== null) {
      const localDiverged =
        ecoliGlucose !== expectedEcoliGlc ||
        ecoliOxygen  !== expectedEcoliO2  ||
        yeastGlucose !== expectedYeastGlc ||
        yeastOxygen  !== expectedYeastO2;
      if (localDiverged) {
        setSeedOverwriteNotice('Upstream FBA seed has changed and your local Two-Species uptake edits were just replaced. Re-apply manual values if needed.');
      }
    }

    setSimMode(recommendedSeed.mode);
    setObjective(recommendedSeed.objective);
    setGlucoseUptake(recommendedSeed.glucoseUptake);
    setOxygenUptake(recommendedSeed.oxygenUptake);
    setKnockouts(recommendedSeed.knockouts);
    setEcoliGlucose(expectedEcoliGlc);
    setEcoliOxygen(expectedEcoliO2);
    setYeastGlucose(expectedYeastGlc);
    setYeastOxygen(expectedYeastO2);
    setEcoliKO(recommendedSeed.knockouts.slice(0, 1));
    setYeastKO(recommendedSeed.knockouts.slice(1));
    lastAppliedSeedRef.current = seedSignature;
  }, [
    seedSignature,
    recommendedSeed.glucoseUptake,
    recommendedSeed.knockouts,
    recommendedSeed.mode,
    recommendedSeed.objective,
    recommendedSeed.oxygenUptake,
    ecoliGlucose,
    ecoliOxygen,
    yeastGlucose,
    yeastOxygen,
    setEcoliGlucose,
    setEcoliOxygen,
    setGlucoseUptake,
    setOxygenUptake,
    setObjective,
    setYeastGlucose,
    setYeastOxygen,
  ]);

  useEffect(() => {
    const controller = new AbortController();
    setSingleLoading(true);
    setSingleError(null);

    solveAuthorityFBAWithProvenance(
      {
        objective,
        glucoseUptake,
        oxygenUptake,
        knockouts,
      },
      controller.signal,
    ).then(({ result, provenance }) => {
      setSingleResult(result);
      setSingleRunProvenance(provenance);
      setSingleError(null);
    }).catch((error) => {
      if (controller.signal.aborted) return;
      setSingleResult(createEmptyFBAOutput());
      setSingleRunProvenance(undefined);
      setSingleError(error instanceof Error ? error.message : 'Authoritative FBA solve failed');
    }).finally(() => {
      if (!controller.signal.aborted) {
        setSingleLoading(false);
      }
    });

    return () => controller.abort();
  }, [glucoseUptake, knockouts, objective, oxygenUptake]);

  useEffect(() => {
    const controller = new AbortController();
    setCommunityLoading(true);
    setCommunityError(null);

    solveAuthorityCommunityFBAWithProvenance(
      {
        objective,
        ecoli: {
          glucoseUptake: ecoliGlucose,
          oxygenUptake: ecoliOxygen,
          knockouts: ecoliKO,
        },
        yeast: {
          glucoseUptake: yeastGlucose,
          oxygenUptake: yeastOxygen,
          knockouts: yeastKO,
        },
      },
      controller.signal,
    ).then(({ result, provenance }) => {
      setCommunityResult(result);
      setCommunityRunProvenance(provenance);
      setCommunityError(null);
    }).catch((error) => {
      if (controller.signal.aborted) return;
      setCommunityResult(createEmptyCommunityOutput());
      setCommunityRunProvenance(undefined);
      setCommunityError(error instanceof Error ? error.message : 'Authority-backed two-species demo failed');
    }).finally(() => {
      if (!controller.signal.aborted) {
        setCommunityLoading(false);
      }
    });

    return () => controller.abort();
  }, [ecoliGlucose, ecoliKO, ecoliOxygen, objective, yeastGlucose, yeastKO, yeastOxygen]);

  const top5 = useMemo(() => {
    return REACTION_DEFS
      .map(r => ({ ...r, flux: singleResult.fluxes[r.id] ?? 0 }))
      .sort((a, b) => Math.abs(b.flux) - Math.abs(a.flux))
      .slice(0, 5);
  }, [singleResult]);

  const maxTopFlux = Math.abs(top5[0]?.flux ?? 1) || 1;
  const figureMeta = useMemo(() => {
    if (simMode === 'single') {
      return {
        eyebrow: 'Figure A · Host Flux State',
        title: 'Constraint-resolved flux map for the active host context',
        caption: 'The central flux map is framed as a model figure: objective, uptake limits, and sensitivity-coefficient interpretation are treated as part of the same scientific panel.',
      };
    }
    return {
      eyebrow: 'Figure B · Two-Species Demo Exchange',
      title: 'Independent host solves with illustrative exchange',
      caption: 'Two-species demo mode becomes a comparative figure where strain-specific optima and post-hoc exchange-like values are read together without claiming shared-pool stoichiometric coupling.',
    };
  }, [simMode]);

  function toggleKO(id: string) {
    setKnockouts(prev => prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id]);
  }
  function toggleEcoliKO(id: string) {
    setEcoliKO(prev => prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id]);
  }
  function toggleYeastKO(id: string) {
    setYeastKO(prev => prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id]);
  }

  const exportData = simMode === 'single' ? singleResult : communityResult;

  /* ── Console logging ─────────────────────────────────────────────────── */
  const appendConsole = useUIStore((s) => s.appendConsole);
  useEffect(() => {
    if ((simMode === 'single' && singleLoading) || (simMode === 'community' && communityLoading)) {
      return;
    }
    const error = simMode === 'single' ? singleError : communityError;
    if (error) {
      appendConsole({ level: 'error', module: 'FBASIM', message: `FBA error: ${error}` });
    } else if (simMode === 'single') {
      appendConsole({
        level: 'info',
        module: 'FBASIM',
        message: `FBA complete — μ=${singleResult.growthRate.toFixed(4)} h⁻¹ | ATP=${singleResult.atpYield.toFixed(1)} mol/mol | C-eff=${singleResult.carbonEfficiency.toFixed(1)}% | KO=[${knockouts.join(',')||'none'}]`,
      });
    } else {
      appendConsole({
        level: 'info',
        module: 'FBASIM',
        message: `Two-species heuristic demo — E.coli μ=${communityResult.ecoli.growthRate.toFixed(4)} | Yeast μ=${communityResult.yeast.growthRate.toFixed(4)} | blended μ=${communityResult.communityGrowthRate.toFixed(4)}`,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appendConsole, communityError, communityLoading, communityResult, simMode, singleError, singleLoading, singleResult]);

  useEffect(() => {
    const now = Date.now();
    const activeResult = simMode === 'single'
      ? singleResult
      : {
          fluxes: communityResult.ecoli.fluxes,
          growthRate: communityResult.communityGrowthRate,
          atpYield: (communityResult.ecoli.atpYield + communityResult.yeast.atpYield) / 2,
          nadhProduction: (communityResult.ecoli.nadhProduction + communityResult.yeast.nadhProduction) / 2,
          carbonEfficiency: (communityResult.ecoli.carbonEfficiency + communityResult.yeast.carbonEfficiency) / 2,
          feasible: communityResult.feasible,
          sensitivityCoefficients: {
            glc: (communityResult.ecoli.sensitivityCoefficients.glc + communityResult.yeast.sensitivityCoefficients.glc) / 2,
            o2: (communityResult.ecoli.sensitivityCoefficients.o2 + communityResult.yeast.sensitivityCoefficients.o2) / 2,
            atp: (communityResult.ecoli.sensitivityCoefficients.atp + communityResult.yeast.sensitivityCoefficients.atp) / 2,
          },
        };

    if (singleLoading || communityLoading) return;
    if (singleError && simMode === 'single') return;
    if (communityError && simMode === 'community') return;

    setToolPayload('fbasim', {
      validity: simMode === 'single' ? 'partial' : 'demo',
      runProvenance: simMode === 'single' ? singleRunProvenance : communityRunProvenance,
      toolId: 'fbasim',
      targetProduct: recommendedSeed.targetProduct,
      pathwayFocus: recommendedSeed.pathwayFocus,
      sourceArtifactId: analyzeArtifact?.id,
      mode: simMode,
      objective,
      glucoseUptake,
      oxygenUptake,
      knockouts,
      result: {
        growthRate: activeResult.growthRate,
        atpYield: activeResult.atpYield,
        nadhProduction: activeResult.nadhProduction,
        carbonEfficiency: activeResult.carbonEfficiency,
        feasible: activeResult.feasible,
        sensitivityCoefficients: activeResult.sensitivityCoefficients,
        topFluxes: Object.entries(activeResult.fluxes)
          .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))
          .slice(0, 5)
          .map(([reactionId, flux]) => ({ reactionId, flux })),
      },
      updatedAt: now,
    });
  }, [
    analyzeArtifact?.id,
    communityLoading,
    communityError,
    communityRunProvenance,
    communityResult,
    glucoseUptake,
    knockouts,
    objective,
    oxygenUptake,
    recommendedSeed.pathwayFocus,
    recommendedSeed.targetProduct,
    setToolPayload,
    simMode,
    singleLoading,
    singleError,
    singleResult,
    singleRunProvenance,
  ]);

  return (
    <ToolShell
      moduleId="fbasim"
      title="Flux Balance Analysis"
      description={simMode === 'single' ? 'Server-side GLPK solves a stoichiometric LP for the current host context' : 'Two-species heuristic demo comparison'}
      formula={simMode === 'single' ? 'max cᵀv s.t. Sv=0, lb≤v≤ub' : 'μ_demo = (1-α)μ₁ + αμ₂'}
      hero={
        <ScientificHero
            eyebrow={`Stage 2 · ${simMode === 'single' ? 'Host Flux Solve' : 'Two-Species Heuristic Demo'}`}
            title={simMode === 'single' ? 'Authority-backed metabolic flux state' : 'Side-by-side host flux comparison'}
            summary={simMode === 'single'
              ? 'FBASim is the first point where the pathway object becomes a constrained production model. The key question is no longer “can the route exist,” but “what does it cost the host and which uptake constraints dominate the present solution.”'
              : 'Community mode remains a two-species heuristic demo. It compares independent host solves and post-hoc exchange values; it does not create a shared stoichiometric pool or a real ecological operating state.'}
            aside={
              <>
                <div style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: 'rgba(205,214,236,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Current route focus
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-sm)', color: 'rgba(247,249,255,0.92)', fontWeight: 700 }}>
                  {recommendedSeed.pathwayFocus || recommendedSeed.targetProduct}
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-sm)', color: 'rgba(205,214,236,0.6)', lineHeight: 1.55 }}>
                  Objective {objective === 'biomass' ? 'maximizes biomass resilience' : objective === 'atp' ? 'prioritizes energetic yield' : 'pushes product-oriented flux through the current route'}.
                </div>
              </>
            }
            signals={simMode === 'single'
              ? [
                  {
                    label: 'Growth Rate',
                    value: `${singleResult.growthRate.toFixed(4)} h⁻¹`,
                    detail: singleLoading ? 'Server authority solve is recomputing this host state.' : singleResult.feasible ? 'Host remains feasible under the present uptake and objective settings.' : 'Infeasible host state under the current constraints.',
                    tone: singleResult.feasible ? 'cool' : 'alert',
                  },
                  {
                    label: 'Carbon Efficiency',
                    value: `${singleResult.carbonEfficiency.toFixed(1)}%`,
                    detail: `${singleResult.atpYield.toFixed(2)} ATP yield · ${singleResult.nadhProduction.toFixed(2)} NADH production`,
                    tone: singleResult.carbonEfficiency >= 50 ? 'cool' : 'warm',
                  },
                  {
                    label: 'Primary Constraint',
                    value: `∂μ/∂Glc ${singleResult.sensitivityCoefficients.glc.toFixed(4)}`,
                    detail: `O₂ sens. ${singleResult.sensitivityCoefficients.o2.toFixed(4)} · ATP sens. ${singleResult.sensitivityCoefficients.atp.toFixed(4)}`,
                    tone: 'neutral',
                  },
                  {
                    label: 'Top Active Route',
                    value: top5[0]?.id ?? 'Pending',
                    detail: top5[0] ? `${Math.abs(top5[0].flux).toFixed(2)} mmol/gDW/h through the strongest reaction channel.` : 'No active reactions ranked yet.',
                    tone: 'neutral',
                  },
                ]
              : [
                  {
                    label: 'Demo Blended Growth',
                    value: `${communityResult.communityGrowthRate.toFixed(4)} h⁻¹`,
                    detail: communityLoading ? 'Recomputing two independent host solves for the heuristic comparison.' : communityResult.feasible ? 'Both independent host solves are feasible before post-hoc exchange scaling.' : 'At least one independent host solve is infeasible.',
                    tone: communityResult.feasible ? 'cool' : 'alert',
                  },
                  {
                    label: 'Demo Biomass Blend',
                    value: `${communityResult.communityBiomassObjective.toFixed(3)}`,
                    detail: `E. coli ${communityResult.ecoli.growthRate.toFixed(3)} · Yeast ${communityResult.yeast.growthRate.toFixed(3)}`,
                    tone: 'neutral',
                  },
                  {
                    label: 'Illustrative Exchange',
                    value: `${communityResult.exchangeFluxes.filter((entry) => Math.abs(entry.flux) > 0.01).length} active links`,
                    detail: communityResult.exchangeFluxes[0] ? `${communityResult.exchangeFluxes[0].metabolite} ${communityResult.exchangeFluxes[0].flux.toFixed(2)} mmol/h` : 'No exchange fluxes detected yet.',
                    tone: 'warm',
                  },
                  {
                    label: 'Pathway Focus',
                    value: recommendedSeed.pathwayFocus || recommendedSeed.targetProduct,
                    detail: 'This route focus is what downstream thermodynamics and catalyst design will inherit from the current systems solve.',
                    tone: 'neutral',
                  },
                ]}
          />
      }
      tabs={FBA_TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      advancedTabIds={['knockout', 'shadows', 'community']}
      footer={
        <>
          <ExportButton label="Export JSON" data={exportData} filename={`fbasim-${simMode}-result`} format="json" />
          <ExportButton label="Export CSV" data={
            simMode === 'single'
              ? REACTION_DEFS.map(r => ({ id: r.id, name: r.name, subsystem: r.subsystem, flux: singleResult.fluxes[r.id] ?? 0, knocked_out: knockouts.includes(r.id) }))
              : [
                  ...REACTION_DEFS.map(r => ({ strain: 'ecoli', id: r.id, name: r.name, subsystem: r.subsystem, flux: communityResult.ecoli.fluxes[r.id] ?? 0, knocked_out: ecoliKO.includes(r.id) })),
                  ...YEAST_REACTION_DEFS.map(r => ({ strain: 'yeast', id: r.id, name: r.name, subsystem: r.subsystem, flux: communityResult.yeast.fluxes[r.id] ?? 0, knocked_out: yeastKO.includes(r.id) })),
                  ...communityResult.exchangeFluxes.map(e => ({ strain: 'exchange', id: e.id, name: e.metabolite, subsystem: 'Exchange', flux: e.flux, knocked_out: false })),
                ]
          } filename={`fbasim-${simMode}-fluxes`} format="csv" />
          <ExportButton label="Export SVG" data={null} filename={`fbasim-${simMode}-chart`} format="svg" svgRef={chartRef} />
        </>
      }
    >
      {/* ── Flux Map Tab ── */}
      <ToolTabPanel tabId="flux" activeId={activeTab}>
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <FloatingControlRail label="Flux Parameters" defaultCollapsed={false} width={220}>
            <p style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.55)', margin: '0 0 8px' }}>
              Uptake Limits
            </p>
            <ParamSlider label="Glucose uptake" value={glucoseUptake} min={0} max={20} onChange={setGlucoseUptake} unit="mmol/gDW/h" />
            <ParamSlider label="O₂ uptake" value={oxygenUptake} min={0} max={20} onChange={setOxygenUptake} unit="mmol/gDW/h" />
            <p style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.55)', margin: '12px 0 8px' }}>
              Objective
            </p>
            {(['biomass', 'atp', 'product'] as const).map(opt => (
              <button key={opt} onClick={() => setObjective(opt)}
                className={`nb-tool-toggle ${objective === opt ? 'nb-tool-toggle--active' : ''}`}
                style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '5px 8px', marginBottom: '3px',
                background: objective === opt ? PATHD_THEME.panelSurface : undefined,
                borderColor: objective === opt ? PATHD_THEME.panelBorderStrong : undefined,
                borderRadius: 'var(--nb-radius-sm)',
                color: objective === opt ? 'rgba(255,255,255,0.85)' : undefined,
              }}>
                {opt === 'biomass' ? 'Max Biomass' : opt === 'atp' ? 'Max ATP' : 'Max Product'}
              </button>
            ))}
          </FloatingControlRail>

          <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {singleError && <div style={{ padding: '0 16px 8px' }}><SimErrorBanner message={singleError} /></div>}
            {singleLoading && (
              <div style={{ padding: '0 16px 8px' }}>
                <div style={{ padding: '6px 10px', borderRadius: 'var(--nb-radius-md)', border: '1px solid rgba(81,81,205,0.22)', background: 'rgba(81,81,205,0.08)', color: 'rgba(240,245,255,0.78)', fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', marginBottom: '8px' }}>
                  Authority engine recomputing server-side LP.
                </div>
                <SimSkeleton />
              </div>
            )}

            <ScientificFigureFrame
              eyebrow={figureMeta.eyebrow}
              title={figureMeta.title}
              caption={figureMeta.caption}
              minHeight="100%"
              legend={[
                { label: 'Objective', value: objective, accent: PATHD_THEME.apricot },
                { label: 'Glucose', value: `${glucoseUptake.toFixed(1)} mmol/gDW/h`, accent: PATHD_THEME.coral },
                { label: 'Oxygen', value: `${oxygenUptake.toFixed(1)} mmol/gDW/h`, accent: PATHD_THEME.sky },
              ]}
            >
              <div style={{ minHeight: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FluxMap result={singleResult} nodes={METABOLIC_NODES} edges={FLUX_EDGES} knockouts={knockouts} svgRef={chartRef} />
              </div>
            </ScientificFigureFrame>

            <InlineMetricOverlay
              position="top-right"
              metrics={[
                { label: 'Growth', value: `${singleResult.growthRate.toFixed(4)} h⁻¹`, accent: singleResult.feasible ? PATHD_THEME.mint : PATHD_THEME.coral },
                { label: 'ATP Yield', value: `${singleResult.atpYield.toFixed(2)} mol/mol`, accent: PATHD_THEME.sky },
                { label: 'C Efficiency', value: `${singleResult.carbonEfficiency.toFixed(1)}%`, accent: singleResult.carbonEfficiency >= 50 ? PATHD_THEME.mint : PATHD_THEME.apricot },
              ]}
            />
          </div>
        </div>
      </ToolTabPanel>

      {/* ── Knockout Tab ── */}
      <ToolTabPanel tabId="knockout" activeId={activeTab}>
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <FloatingControlRail label="Gene Knockouts" defaultCollapsed={false} width={240}>
            <p style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.55)', margin: '0 0 8px' }}>
              Toggle Reactions
            </p>
            {REACTION_DEFS.map(r => {
              const isKO = knockouts.includes(r.id);
              return (
                <button key={r.id} onClick={() => toggleKO(r.id)}
                  className={`nb-tool-toggle ${isKO ? 'nb-tool-toggle--active' : ''}`}
                  style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '4px 6px', marginBottom: '2px',
                  background: isKO ? 'rgba(255,80,80,0.14)' : undefined,
                  borderColor: isKO ? 'rgba(255,80,80,0.38)' : undefined,
                  borderRadius: 'var(--nb-radius-sm)',
                }}>
                  <span style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: isKO ? 'rgba(255,120,120,0.9)' : 'rgba(255,255,255,0.5)' }}>{r.id}</span>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isKO ? 'rgba(255,80,80,0.7)' : 'rgba(255,255,255,0.12)', flexShrink: 0 }} />
                </button>
              );
            })}
            {knockouts.length > 0 && (
              <button onClick={() => setKnockouts([])}
                className="nb-tool-toggle"
                style={{
                display: 'block', width: '100%', marginTop: '6px',
                padding: '4px 6px', borderRadius: 'var(--nb-radius-sm)',
                color: 'rgba(255,255,255,0.3)',
              }}>
                Clear knockouts ({knockouts.length})
              </button>
            )}
          </FloatingControlRail>

          <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {singleError && <div style={{ padding: '0 16px 8px' }}><SimErrorBanner message={singleError} /></div>}

            <ScientificFigureFrame
              eyebrow="Knockout Analysis"
              title="Flux Map with Gene Knockouts"
              caption="Red-highlighted reactions show knocked-out genes and their flux impact."
              minHeight="100%"
              legend={[
                { label: 'Knockouts', value: knockouts.length ? knockouts.join(', ') : 'none', accent: PATHD_THEME.coral },
                { label: 'Growth', value: `${singleResult.growthRate.toFixed(4)} h⁻¹`, accent: singleResult.feasible ? PATHD_THEME.mint : PATHD_THEME.coral },
              ]}
            >
              <div style={{ minHeight: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FluxMap result={singleResult} nodes={METABOLIC_NODES} edges={FLUX_EDGES} knockouts={knockouts} svgRef={chartRef} />
              </div>
            </ScientificFigureFrame>

            <InlineMetricOverlay
              position="top-right"
              metrics={[
                { label: 'Growth', value: `${singleResult.growthRate.toFixed(4)} h⁻¹`, accent: singleResult.feasible ? PATHD_THEME.mint : PATHD_THEME.coral },
                { label: 'ATP Yield', value: `${singleResult.atpYield.toFixed(2)} mol/mol`, accent: PATHD_THEME.sky },
                { label: 'Feasible', value: singleResult.feasible ? 'YES' : 'NO', accent: singleResult.feasible ? PATHD_THEME.mint : PATHD_THEME.coral },
              ]}
            />
          </div>
        </div>
      </ToolTabPanel>

      {/* ── Shadow Prices Tab ── */}
      <ToolTabPanel tabId="shadows" activeId={activeTab}>
        <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0, overflow: 'auto', padding: '12px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.55)', margin: '0 0 10px' }}>FBA Results</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
              <MetricCard label="Growth Rate (μ)" value={singleResult.growthRate} unit="h⁻¹" highlight />
              <MetricCard label="ATP Yield" value={singleResult.atpYield} unit="mol/mol glc" />
              <MetricCard label="NADH Production" value={singleResult.nadhProduction} unit="mmol/gDW/h" />
              <MetricCard label="Carbon Efficiency" value={singleResult.carbonEfficiency} unit="%" />
              <MetricCard label="Feasible" value={singleResult.feasible ? 'YES' : 'NO'} />
            </div>
            <p style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.55)', margin: '0 0 8px' }}>Shadow Prices (∂μ/∂uptake)</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <MetricCard label="∂μ/∂Glucose" value={singleResult.sensitivityCoefficients.glc.toFixed(4)} unit="h⁻¹·gDW/mmol" />
              <MetricCard label="∂μ/∂Oxygen"  value={singleResult.sensitivityCoefficients.o2.toFixed(4)}  unit="h⁻¹·gDW/mmol" />
              <MetricCard label="∂μ/∂ATP"     value={singleResult.sensitivityCoefficients.atp.toFixed(4)} unit="h⁻¹·gDW/mmol" />
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.55)', margin: '0 0 10px' }}>Top 5 Active Reactions</p>
            {top5.map(r => (
              <div key={r.id} style={{
                padding: '6px 8px', marginBottom: '4px',
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${knockouts.includes(r.id) ? 'rgba(255,80,80,0.2)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 'var(--nb-radius-sm)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: knockouts.includes(r.id) ? 'rgba(255,120,120,0.7)' : 'rgba(255,255,255,0.6)' }}>{r.id}</span>
                  <span style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', fontWeight: 600, color: r.flux > 0 ? 'rgba(20,140,80,0.9)' : 'rgba(255,80,80,0.6)', textAlign: 'right' }}>{r.flux.toFixed(2)}</span>
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', color: 'rgba(255,255,255,0.55)', marginTop: '2px' }}>{r.name}</div>
                <div style={{ marginTop: '4px', height: '2px', background: 'rgba(255,255,255,0.06)', borderRadius: '1px' }}>
                  <div style={{ height: '100%', borderRadius: '1px', width: `${Math.abs(r.flux / maxTopFlux) * 100}%`, background: knockouts.includes(r.id) ? 'rgba(255,80,80,0.3)' : 'rgba(20,140,80,0.4)', transition: 'width 0.3s' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </ToolTabPanel>

      {/* ── Community Tab ── */}
      <ToolTabPanel tabId="community" activeId={activeTab}>
        <div style={{ padding: '8px 12px', background: 'rgba(232,220,200,0.1)', borderRadius: 'var(--nb-radius-sm)', fontSize: 'var(--nb-fs-sm)', opacity: 0.8, margin: '8px 12px' }}>
          ℹ️ Community FBA uses sequential single-species optimization with shared resource constraints.
          This is an approximation — for true joint optimization, consider SteCom or BioME frameworks.
        </div>
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <FloatingControlRail label="Strain Parameters" defaultCollapsed={false} width={260}>
            <StrainPanel label="E. coli" color={COLORS.strainABg} borderColor={COLORS.strainABorder} accentColor={COLORS.strainA}
              glucoseUptake={ecoliGlucose} oxygenUptake={ecoliOxygen} knockouts={ecoliKO}
              reactions={REACTION_DEFS} result={communityResult.ecoli}
              onGlucoseChange={setEcoliGlucose} onOxygenChange={setEcoliOxygen}
              onToggleKO={toggleEcoliKO} onClearKO={() => setEcoliKO([])} />
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '8px 0' }} />
            <StrainPanel label="S. cerevisiae" color={COLORS.strainBBg} borderColor={COLORS.strainBBorder} accentColor={COLORS.strainB}
              glucoseUptake={yeastGlucose} oxygenUptake={yeastOxygen} knockouts={yeastKO}
              reactions={YEAST_REACTION_DEFS} result={communityResult.yeast}
              onGlucoseChange={setYeastGlucose} onOxygenChange={setYeastOxygen}
              onToggleKO={toggleYeastKO} onClearKO={() => setYeastKO([])} />
          </FloatingControlRail>

          <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {communityError && <div style={{ padding: '0 16px 8px' }}><SimErrorBanner message={communityError} /></div>}
            {communityLoading && (
              <div style={{ padding: '0 16px 8px' }}>
                <div style={{ padding: '6px 10px', borderRadius: 'var(--nb-radius-md)', border: '1px solid rgba(81,81,205,0.22)', background: 'rgba(81,81,205,0.08)', color: 'rgba(240,245,255,0.78)', fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)' }}>
                  Solving two independent single-species LPs.
                </div>
              </div>
            )}

            <ScientificFigureFrame
              eyebrow="Community FBA"
              title="Two-Species Metabolic Community"
              caption="Independent LP solutions per species with shared metabolite exchange."
              minHeight="100%"
            >
              <div style={{ display: 'grid', gap: '12px', minHeight: '500px' }}>
                <GlassContainer color={COLORS.sharedBg} borderColor={COLORS.sharedBorder}
                  style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-sm)', color: 'rgba(255,255,255,0.55)' }}>Demo Biomass Blend</span>
                  <span style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-sm)', fontWeight: 600, color: COLORS.sharedPool }}>μ_demo = {communityResult.communityGrowthRate.toFixed(4)} h⁻¹</span>
                </GlassContainer>
                <div style={{ display: 'flex', gap: '12px', flex: 1, minHeight: 0 }}>
                  <GlassContainer color={COLORS.strainABg} borderColor={COLORS.strainABorder} style={{ flex: 1, padding: '6px', display: 'flex', flexDirection: 'column' }}>
                    <p style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: COLORS.strainA, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>E. coli</p>
                    <div style={{ flex: 1, minHeight: 0 }}><FluxMap result={communityResult.ecoli} nodes={METABOLIC_NODES} edges={FLUX_EDGES} knockouts={ecoliKO} compact /></div>
                  </GlassContainer>
                  <GlassContainer color={COLORS.strainBBg} borderColor={COLORS.strainBBorder} style={{ flex: 1, padding: '6px', display: 'flex', flexDirection: 'column' }}>
                    <p style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: COLORS.strainB, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>S. cerevisiae</p>
                    <div style={{ flex: 1, minHeight: 0 }}><FluxMap result={communityResult.yeast} nodes={YEAST_NODES} edges={YEAST_FLUX_EDGES} knockouts={yeastKO} compact /></div>
                  </GlassContainer>
                </div>
                <SharedMetaboliteBus exchangeFluxes={communityResult.exchangeFluxes} />
              </div>
            </ScientificFigureFrame>

            <InlineMetricOverlay
              position="top-right"
              metrics={[
                { label: 'Blend μ', value: `${communityResult.communityGrowthRate.toFixed(4)} h⁻¹`, accent: communityResult.feasible ? PATHD_THEME.mint : PATHD_THEME.coral },
                { label: 'E. coli μ', value: `${communityResult.ecoli.growthRate.toFixed(3)}`, accent: COLORS.strainA },
                { label: 'Yeast μ', value: `${communityResult.yeast.growthRate.toFixed(3)}`, accent: COLORS.strainB },
              ]}
            />
          </div>
        </div>
      </ToolTabPanel>
    </ToolShell>
  );
}
