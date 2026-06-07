'use client';
import { useEffect, useMemo, useState } from 'react';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import SimErrorBanner from '../ide/shared/SimErrorBanner';
import {
  ENZYME_STRUCTURES,
  PATHWAY_STEPS,
  PATHWAY_CANDIDATES,
  RATE_LIMITING_ENZYME,
} from '../../data/mockCatalystDesigner';
import {
  predictBindingAffinity,
  designSequences,
  estimateMetabolicDrain,
  balancePathway,
  rankPathways,
  predictMutagenesisSites,
} from '../../services/CatalystDesignerEngine';
import type {
  BindingAffinityResult,
  SequenceDesignResult,
  MetabolicDrainResult,
  PathwayBalanceResult,
  ParetoFrontResult,
  MutagenesisResult,
  EnzymeStructure,
  MutagenesisSite,
} from '../../services/CatalystDesignerEngine';
import { useWorkbenchStore } from '../../store/workbenchStore';
import WorkbenchInlineContext from '../workbench/WorkbenchInlineContext';
import { buildCatalystSeed } from './shared/workbenchDataflow';
import { T } from '../ide/tokens';
import { PATHD_THEME } from '../workbench/workbenchTheme';
import CatalystViewer3D, { kdToQuality, bindingColorCSS } from '../molecular/CatalystViewer3D';
import type { ResidueClickData } from '../molecular/CatalystViewer3D';
import BindingRadarChart from '../charts/BindingRadarChart';
import FluxCostChart from '../charts/FluxCostChart';
import BalancerChart from '../charts/BalancerChart';
import ParetoChart from '../charts/ParetoChart';
import MutagenesisChart from '../charts/MutagenesisChart';

/* ── Shared tool components ──────────────────────────────────────── */
import ToolShell from './shared/ToolShell';
import ToolTabPanel from './shared/ToolTabPanel';
import FloatingControlRail from './shared/FloatingControlRail';
import ScientificHero from './shared/ScientificHero';
import InlineMetricOverlay from './shared/InlineMetricOverlay';
import ScientificFigureFrame from './shared/ScientificFigureFrame';
import SectionLabel from './shared/SectionLabel';
import type { ToolTab } from './shared/ToolTabBar';

/* ── Constants ───────────────────────────────────────────────────── */

const PHASE_COLORS: Record<string, string> = {
  binding:     '#BFDCCD',
  sequence:    '#AFC3D6',
  flux:        '#E7C7A9',
  balancing:   '#E8A3A1',
  pareto:      '#CFC4E3',
  mutagenesis: '#BFDCCD',
};

type ViewMode = 'Binding' | 'Sequences' | 'FluxCost' | 'Balancer' | 'Pareto' | 'Mutagenesis';

const VIEW_MODES: { key: ViewMode; label: string; color: string }[] = [
  { key: 'Binding',    label: 'Binding',    color: PHASE_COLORS.binding },
  { key: 'Sequences',  label: 'Sequences',  color: PHASE_COLORS.sequence },
  { key: 'FluxCost',   label: 'Flux Cost',  color: PHASE_COLORS.flux },
  { key: 'Balancer',   label: 'Balancer',   color: PHASE_COLORS.balancing },
  { key: 'Pareto',     label: 'Pareto',     color: PHASE_COLORS.pareto },
  { key: 'Mutagenesis',label: 'Mutagen.',   color: PHASE_COLORS.mutagenesis },
];

const CATDES_TABS: ToolTab[] = [
  { id: 'overview',  label: 'Overview',  accent: PATHD_THEME.sky },
  { id: 'residue',   label: 'Residue',   accent: PATHD_THEME.lilac },
  { id: 'stats',     label: 'Stats',     accent: PATHD_THEME.apricot },
  { id: 'analysis',  label: 'Analysis',  accent: PATHD_THEME.mint },
];

/* ── Quality helpers ─────────────────────────────────────────────── */

const kdQuality = (kd: number) => {
  if (kd < 1) return { icon: '▲', label: 'Excellent', color: '#93CB52' };
  if (kd < 10) return { icon: '▲', label: 'Good', color: '#93CB52' };
  if (kd < 100) return { icon: '~', label: 'Moderate', color: '#FFFB1F' };
  if (kd < 1000) return { icon: '▼', label: 'Weak', color: '#E7C7A9' };
  return { icon: '▼', label: 'Very weak', color: 'rgba(255,120,120,0.7)' };
};

const kcatQuality = (kcat: number) => {
  if (kcat > 100) return { icon: '▲', label: 'Excellent', color: '#93CB52' };
  if (kcat > 10) return { icon: '▲', label: 'Good', color: '#93CB52' };
  if (kcat > 1) return { icon: '~', label: 'Moderate', color: '#FFFB1F' };
  return { icon: '▼', label: 'Slow', color: 'rgba(255,120,120,0.7)' };
};

const fitQuality = (fit: number) => {
  if (fit > 0.8) return { icon: '▲', label: 'Great', color: '#93CB52' };
  if (fit > 0.6) return { icon: '~', label: 'OK', color: '#FFFB1F' };
  return { icon: '▼', label: 'Poor', color: 'rgba(255,120,120,0.7)' };
};

/* ── Sequence Design View ────────────────────────────────────────── */

function SequenceView({ result }: { result: SequenceDesignResult }) {
  const caiColor = (v: number) =>
    v >= 0.75 ? '#93CB52' : v >= 0.55 ? '#FFFB1F' : 'rgba(255,120,120,0.7)';
  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <SectionLabel>Designed Sequences — {result.targetEnzyme}</SectionLabel>
      <p style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', color: 'rgba(255,255,255,0.35)', margin: '0 0 8px', fontStyle: 'italic' }}>
        Stability estimates are heuristic screening scores (BLOSUM62-based), not rigorous ΔΔG values.
      </p>
      {result.designs.map(d => (
        <div key={d.rank} style={{
          padding: '10px 14px', marginBottom: 8,
          borderRadius: 'var(--nb-radius-md)',
          background: PATHD_THEME.panelGlass, border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-sm)', color: PHASE_COLORS.sequence, fontWeight: 600 }}>#{d.rank}</span>
            <span style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: PATHD_THEME.value }}>Score {d.score.toFixed(2)}</span>
            <span style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: PATHD_THEME.label }}>Recovery {(d.recoveryRate * 100).toFixed(1)}%</span>
            <span style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: caiColor(d.cai) }}>CAI {d.cai.toFixed(2)}</span>
            <span style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: PATHD_THEME.label }}>GC {(d.gcContent * 100).toFixed(1)}%</span>
            <span style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: d.rareCodons > 3 ? 'rgba(255,120,120,0.7)' : PATHD_THEME.value }}>{d.rareCodons} rare</span>
          </div>
          <div style={{
            fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: 'rgba(255,255,255,0.45)',
            letterSpacing: '0.04em', overflowX: 'auto', whiteSpace: 'nowrap',
            padding: '4px 6px', background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--nb-radius-sm)',
          }}>
            {d.dnaSequence.slice(0, 60)}
            {d.dnaSequence.length > 60 && <span style={{ color: PATHD_THEME.label }}> …</span>}
          </div>
        </div>
      ))}
      {result.consensusMotifs.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <SectionLabel>Consensus Motifs</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {result.consensusMotifs.map((m, i) => (
              <span key={i} style={{
                fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: PHASE_COLORS.sequence,
                padding: '2px 8px', borderRadius: 'var(--nb-radius-sm)',
                background: 'rgba(81,81,205,0.1)', border: '1px solid rgba(81,81,205,0.15)',
              }}>{m}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Main Component — CatalystDesignerPageV2
   ══════════════════════════════════════════════════════════════════════ */

export default function CatalystDesignerPageV2() {
  /* ── Workbench state ─────────────────────────────────────────── */
  const project = useWorkbenchStore((s) => s.project);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const fbaPayload = useWorkbenchStore((s) => s.toolPayloads.fbasim);
  const cethxPayload = useWorkbenchStore((s) => s.toolPayloads.cethx);
  const dbtlPayload = useWorkbenchStore((s) => s.toolPayloads.dbtlflow);
  const setToolPayload = useWorkbenchStore((s) => s.setToolPayload);

  /* ── Local state ─────────────────────────────────────────────── */
  const [selectedEnzymeIdx, setSelectedEnzymeIdx] = useState<number>(2);
  const [viewMode, setViewMode] = useState<ViewMode>('Binding');
  const [renderMode, setRenderMode] = useState<'cartoon' | 'surface' | 'confidence'>('cartoon');
  const [spinEnabled, setSpinEnabled] = useState(true);
  const [selectedResidue, setSelectedResidue] = useState<ResidueClickData | null>(null);
  const [pendingMutation, setPendingMutation] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  /* ── Workbench seed ──────────────────────────────────────────── */
  const recommendedSeed = useMemo(
    () => buildCatalystSeed(project, analyzeArtifact, fbaPayload, cethxPayload, dbtlPayload),
    [analyzeArtifact?.generatedAt, analyzeArtifact?.id, cethxPayload?.updatedAt, dbtlPayload?.feedbackSource, dbtlPayload?.result.improvementRate, dbtlPayload?.result.latestPhase, dbtlPayload?.result.passRate, dbtlPayload?.updatedAt, fbaPayload?.updatedAt, project?.id, project?.updatedAt],
  );
  useEffect(() => { setSelectedEnzymeIdx(recommendedSeed.enzymeIndex); }, [recommendedSeed.enzymeIndex]);

  /* ── Derived enzyme & computations ───────────────────────────── */
  const enzyme = ENZYME_STRUCTURES[selectedEnzymeIdx];
  const { data: binding, error: simError } = useMemo(() => {
    try { return { data: predictBindingAffinity(enzyme), error: null as string | null }; }
    catch (e) { return { data: predictBindingAffinity(ENZYME_STRUCTURES[selectedEnzymeIdx]), error: e instanceof Error ? e.message : 'Binding prediction failed' }; }
  }, [enzyme, selectedEnzymeIdx]);
  const sequences = useMemo(() => designSequences(enzyme, recommendedSeed.designCount), [enzyme, recommendedSeed.designCount]);
  const drain = useMemo(() => estimateMetabolicDrain(enzyme, recommendedSeed.requiredFlux), [enzyme, recommendedSeed.requiredFlux]);
  const balance = useMemo(() => balancePathway(PATHWAY_STEPS), []);
  const pareto = useMemo(() => rankPathways(PATHWAY_CANDIDATES), []);
  const mutagenesis = useMemo(() => predictMutagenesisSites(enzyme, 5), [enzyme]);
  const bestPathway = pareto.candidates.find(c => c.id === pareto.bestOverall);

  /* ── Residue detail for inspector ────────────────────────────── */
  const selectedCatalyticResidue = selectedResidue?.catalyticResidue ?? null;

  /* ── Mutagenesis site for selected residue ──────────────────── */
  const selectedMutagenesisSite: MutagenesisSite | null = selectedResidue
    ? mutagenesis.sites.find(s => s.position === selectedResidue.position) ?? null
    : null;

  /* ── Workbench write-back ────────────────────────────────────── */
  useEffect(() => {
    if (simError) return;
    setToolPayload('catdes', {
      validity: 'partial',
      toolId: 'catdes',
      targetProduct: analyzeArtifact?.targetProduct || project?.targetProduct || project?.title || 'Target Product',
      sourceArtifactId: analyzeArtifact?.id,
      selectedEnzymeId: enzyme.id,
      selectedEnzymeName: enzyme.name,
      selectedView: viewMode,
      requiredFlux: recommendedSeed.requiredFlux,
      designCount: recommendedSeed.designCount,
      result: {
        bindingKd: binding.predictedKd,
        overallBinding: binding.overallScore,
        bestSequenceScore: sequences.designs[0]?.score ?? 0,
        bestCAI: sequences.designs[0]?.cai ?? 0,
        totalMetabolicDrain: drain.totalMetabolicDrain,
        growthPenalty: drain.growthPenalty,
        isViable: drain.isViable,
        bestPathway: bestPathway?.name ?? 'No ranked pathway',
        topMutationSites: mutagenesis.sites.filter((site) => site.predictedEffect === 'beneficial').length,
        recommendation: drain.recommendation,
      },
      updatedAt: Date.now(),
    });
  }, [
    analyzeArtifact?.id, analyzeArtifact?.targetProduct, bestPathway?.name,
    binding.overallScore, binding.predictedKd, drain.growthPenalty,
    drain.isViable, drain.recommendation, drain.totalMetabolicDrain,
    enzyme.id, enzyme.name, mutagenesis.sites, project?.targetProduct,
    project?.title, recommendedSeed.designCount, recommendedSeed.requiredFlux,
    sequences.designs, setToolPayload, simError, viewMode,
  ]);

  /* ── Derived quality scores ──────────────────────────────────── */
  const kdQ = kdQuality(binding.predictedKd);
  const kcatQ = kcatQuality(enzyme.kcat);
  const fitQ = fitQuality(binding.overallScore);
  const beneficialCount = mutagenesis.sites.filter(s => s.predictedEffect === 'beneficial').length;

  /* ── Residue click handler ───────────────────────────────────── */
  const handleResidueClick = (data: ResidueClickData) => {
    setSelectedResidue(data);
    setPendingMutation(null);
    setActiveTab('residue');
  };

  return (
    <ToolShell
      moduleId="catdes"
      title="Catalyst Designer"
      description="Enzyme binding affinity, sequence design, metabolic drain, pathway balancing, and mutagenesis targeting"
      formula="ΔG = ΔH − TΔS"
      tabs={CATDES_TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      advancedTabIds={['analysis']}
      hero={
        <ScientificHero
          eyebrow="Stage 2 · Component Optimization"
          title="Catalyst Designer"
          summary="Predict binding affinity, design protein sequences, estimate metabolic drain, balance pathway flux, and identify mutagenesis targets for enzyme optimization."
          signals={[
            { label: 'Enzyme', value: enzyme.name, detail: `EC ${enzyme.ecNumber}`, tone: 'neutral' },
            { label: 'Kd', value: `${binding.predictedKd.toFixed(1)} μM`, detail: kdQ.label, tone: binding.predictedKd < 10 ? 'cool' : 'warm' },
            { label: 'kcat', value: `${enzyme.kcat.toFixed(1)} s⁻¹`, detail: kcatQ.label, tone: enzyme.kcat > 10 ? 'cool' : 'warm' },
            { label: 'Fit', value: binding.overallScore.toFixed(2), detail: fitQ.label, tone: binding.overallScore > 0.7 ? 'cool' : 'warm' },
          ]}
          dismissible
        />
      }
      footer={
        <>
          <div style={{ flex: 1, minWidth: 0 }}>
            <WorkbenchInlineContext
              toolId="catdes"
              title="Catalyst Designer"
              summary={`${enzyme.name} — Kd ${binding.predictedKd.toFixed(1)} μM, ${beneficialCount} beneficial sites`}
              compact
            />
          </div>
          <ExportButton label="Export JSON"
            data={{ enzyme: enzyme.id, binding, sequences, drain, balance, pareto, mutagenesis }}
            filename="catalyst-design" format="json" />
        </>
      }
    >
      {/* ── Error banner ──────────────────────────────────────── */}
      {simError && <SimErrorBanner message={simError} />}

      {/* ── Overview Tab: 3D Viewport ─────────────────────────── */}
      <ToolTabPanel tabId="overview" activeId={activeTab}>
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <FloatingControlRail label="Enzyme" defaultCollapsed={false} width={240}>
            <SectionLabel>Target Enzyme</SectionLabel>
            <select
              value={selectedEnzymeIdx}
              onChange={e => { setSelectedEnzymeIdx(Number(e.target.value)); setSelectedResidue(null); setPendingMutation(null); }}
              style={{
                width: '100%', fontFamily: T.SANS, fontSize: 'var(--nb-fs-sm)', fontWeight: 600,
                color: PATHD_THEME.value, background: PATHD_THEME.panelInset,
                border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
                borderRadius: 'var(--nb-radius-sm)', padding: '4px 8px', cursor: 'pointer', marginBottom: 10,
              }}
            >
              {ENZYME_STRUCTURES.map((enz, i) => (
                <option key={enz.id} value={i}>{enz.name} · EC {enz.ecNumber}</option>
              ))}
            </select>
            {enzyme.id === RATE_LIMITING_ENZYME.id && (
              <span style={{
                display: 'inline-block', fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: '#FFFB1F',
                background: 'rgba(255,251,31,0.12)', padding: '1px 5px', borderRadius: 'var(--nb-radius-sm)', marginBottom: 10,
              }}>Rate-limiting</span>
            )}
            <SectionLabel>Substrate → Product</SectionLabel>
            <p style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', color: PATHD_THEME.label, margin: '0 0 10px' }}>
              {enzyme.substrate} → {enzyme.product}
            </p>
            <SectionLabel>Render Mode</SectionLabel>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
              {(['cartoon', 'surface', 'confidence'] as const).map(mode => (
                <button key={mode} type="button" onClick={() => setRenderMode(mode)}
                  className={`nb-tool-toggle ${renderMode === mode ? 'nb-tool-toggle--active' : ''}`}
                  style={{
                    borderColor: renderMode === mode ? 'rgba(200,232,240,0.3)' : undefined,
                    background: renderMode === mode ? 'rgba(200,232,240,0.12)' : undefined,
                    color: renderMode === mode ? '#C8E8F0' : undefined,
                    fontSize: 'var(--nb-fs-xs)', borderRadius: 'var(--nb-radius-sm)', padding: '3px 8px',
                  }}>
                  {mode === 'confidence' ? 'pLDDT' : mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setSpinEnabled(!spinEnabled)}
              className={`nb-tool-toggle ${spinEnabled ? 'nb-tool-toggle--active' : ''}`}
              style={{ width: '100%', fontSize: 'var(--nb-fs-xs)', borderRadius: 'var(--nb-radius-sm)', padding: '4px 8px' }}>
              {spinEnabled ? 'Auto-spin: On' : 'Auto-spin: Off'}
            </button>
          </FloatingControlRail>
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            <CatalystViewer3D
              enzyme={enzyme}
              renderMode={renderMode}
              spinEnabled={spinEnabled}
              onResidueClick={handleResidueClick}
              selectedResidue={selectedResidue?.position ?? null}
              bindingQuality={kdToQuality(binding.predictedKd)}
              style={{ flex: 1, minHeight: 0 }}
            />
            <InlineMetricOverlay position="top-right" metrics={[
              { label: 'Kd', value: `${binding.predictedKd.toFixed(1)} μM`, accent: bindingColorCSS(kdToQuality(binding.predictedKd)) },
              { label: 'kcat', value: `${enzyme.kcat.toFixed(1)} s⁻¹`, accent: kcatQ.color },
              { label: 'Fit', value: binding.overallScore.toFixed(2), accent: fitQ.color },
            ]} />
          </div>
        </div>
      </ToolTabPanel>

      {/* ── Residue Tab ───────────────────────────────────────── */}
      <ToolTabPanel tabId="residue" activeId={activeTab}>
        {selectedResidue ? (
          <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
            <FloatingControlRail label="Residue Info" defaultCollapsed={false} width={260}>
              <div style={{
                padding: '8px 10px', borderRadius: 'var(--nb-radius-md)',
                background: PATHD_THEME.panelGlass, border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`, marginBottom: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-md)', color: PATHD_THEME.value, fontWeight: 700 }}>
                    {selectedResidue.name}
                  </span>
                  <span style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: PATHD_THEME.label }}>
                    pos {selectedResidue.position}
                  </span>
                  {selectedResidue.isCatalytic && (
                    <span style={{
                      fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: '#93CB52',
                      background: 'rgba(147,203,82,0.12)', padding: '1px 5px', borderRadius: 'var(--nb-radius-sm)',
                    }}>catalytic</span>
                  )}
                </div>
                {selectedCatalyticResidue ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                    <span style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', color: PATHD_THEME.label }}>Role</span>
                    <span style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: PATHD_THEME.value }}>{selectedCatalyticResidue.role.replace('_', ' ')}</span>
                    <span style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', color: PATHD_THEME.label }}>Dist</span>
                    <span style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: PATHD_THEME.value }}>{selectedCatalyticResidue.distanceToSubstrate.toFixed(1)} Å</span>
                    <span style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', color: PATHD_THEME.label }}>Angle</span>
                    <span style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: PATHD_THEME.value }}>{selectedCatalyticResidue.orientationAngle.toFixed(0)}°</span>
                    <span style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', color: PATHD_THEME.label }}>pKa shift</span>
                    <span style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: Math.abs(selectedCatalyticResidue.pKaShift) > 0.5 ? '#FA8072' : PATHD_THEME.value }}>
                      {selectedCatalyticResidue.pKaShift > 0 ? '+' : ''}{selectedCatalyticResidue.pKaShift.toFixed(2)}
                    </span>
                    {selectedResidue.distanceToSubstrate != null && (
                      <>
                        <span style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', color: PATHD_THEME.label }}>→ Substrate</span>
                        <span style={{ fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: PATHD_THEME.value }}>{selectedResidue.distanceToSubstrate.toFixed(1)} Å</span>
                      </>
                    )}
                  </div>
                ) : (
                  <p style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', color: PATHD_THEME.label, margin: 0 }}>
                    Non-catalytic — {selectedResidue.residueLetter} at position {selectedResidue.position}
                  </p>
                )}
              </div>

              <SectionLabel>Mutate to…</SectionLabel>
              <select
                value={pendingMutation ?? ''}
                onChange={e => setPendingMutation(e.target.value || null)}
                style={{
                  width: '100%', fontFamily: T.MONO, fontSize: 'var(--nb-fs-sm)',
                  color: PATHD_THEME.value, background: PATHD_THEME.panelInset,
                  border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
                  borderRadius: 'var(--nb-radius-sm)', padding: '4px 8px', cursor: 'pointer',
                }}
              >
                <option value="">— select amino acid —</option>
                {['A','R','N','D','C','E','Q','G','H','I','L','K','M','F','P','S','T','W','Y','V']
                  .filter(aa => aa !== selectedResidue.residueLetter)
                  .map(aa => {
                    const names: Record<string, string> = {
                      A:'Ala',R:'Arg',N:'Asn',D:'Asp',C:'Cys',E:'Glu',Q:'Gln',G:'Gly',
                      H:'His',I:'Ile',L:'Leu',K:'Lys',M:'Met',F:'Phe',P:'Pro',S:'Ser',
                      T:'Thr',W:'Trp',Y:'Tyr',V:'Val',
                    };
                    const isSuggested = selectedMutagenesisSite?.suggestedMutants.includes(aa);
                    return (
                      <option key={aa} value={aa}>
                        {aa} ({names[aa]}) {isSuggested ? '★ suggested' : ''}
                      </option>
                    );
                  })}
              </select>
            </FloatingControlRail>

            <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
              {pendingMutation ? (
                <ScientificFigureFrame
                  eyebrow="Mutation Preview"
                  title={`${selectedResidue.residueLetter}${selectedResidue.position}${pendingMutation}`}
                  caption="BLOSUM62 heuristic screening score — not rigorous ΔΔG"
                  legend={[
                    { label: 'Effect', value: selectedMutagenesisSite?.suggestedMutants.includes(pendingMutation) ? selectedMutagenesisSite.predictedEffect : 'Unknown', accent: selectedMutagenesisSite?.suggestedMutants.includes(pendingMutation) ? (selectedMutagenesisSite.predictedEffect === 'beneficial' ? '#93CB52' : selectedMutagenesisSite.predictedEffect === 'neutral' ? '#FFFB1F' : '#FA8072') : PATHD_THEME.label },
                  ]}
                >
                  {selectedMutagenesisSite && selectedMutagenesisSite.suggestedMutants.includes(pendingMutation) ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                      <MetricCard label="Δkcat" value={`${selectedMutagenesisSite.predictedDeltaKcat.toFixed(2)}×`} highlight={selectedMutagenesisSite.predictedDeltaKcat > 1} />
                      <MetricCard label="ΔKm" value={`${selectedMutagenesisSite.predictedDeltaKm.toFixed(2)}×`} />
                      <MetricCard label="Effect" value={selectedMutagenesisSite.predictedEffect} />
                      <MetricCard label="Confidence" value={`${(selectedMutagenesisSite.confidence * 100).toFixed(0)}%`} />
                    </div>
                  ) : (
                    <p style={{ fontFamily: T.SANS, fontSize: 'var(--nb-fs-sm)', color: PATHD_THEME.label, margin: 0 }}>
                      No screening data for this substitution.
                    </p>
                  )}
                </ScientificFigureFrame>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: PATHD_THEME.label, fontFamily: T.SANS, fontSize: 'var(--nb-fs-sm)' }}>
                  Select a mutation target from the dropdown, or click a residue on the 3D model.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: PATHD_THEME.label, fontFamily: T.SANS, fontSize: 'var(--nb-fs-sm)' }}>
            Click a residue on the 3D model to inspect it.
          </div>
        )}
      </ToolTabPanel>

      {/* ── Stats Tab ─────────────────────────────────────────── */}
      <ToolTabPanel tabId="stats" activeId={activeTab}>
        <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
          <SectionLabel>Kinetic Parameters</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ flex: 1 }}><MetricCard label="Kd" value={binding.predictedKd.toFixed(2)} unit="μM" /></div>
              <span style={{
                fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: bindingColorCSS(kdToQuality(binding.predictedKd)),
                padding: '2px 6px', borderRadius: 'var(--nb-radius-sm)',
                background: `${bindingColorCSS(kdToQuality(binding.predictedKd))}18`,
                whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 6,
              }}>{kdQ.icon} {kdQ.label}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ flex: 1 }}><MetricCard label="kcat" value={enzyme.kcat.toFixed(2)} unit="s⁻¹" /></div>
              <span style={{
                fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: kcatQ.color,
                padding: '2px 6px', borderRadius: 'var(--nb-radius-sm)', background: `${kcatQ.color}18`,
                whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 6,
              }}>{kcatQ.icon} {kcatQ.label}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ flex: 1 }}><MetricCard label="Km" value={enzyme.km.toFixed(3)} unit="mM" /></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ flex: 1 }}><MetricCard label="Fit" value={binding.overallScore.toFixed(2)} /></div>
              <span style={{
                fontFamily: T.MONO, fontSize: 'var(--nb-fs-xs)', color: fitQ.color,
                padding: '2px 6px', borderRadius: 'var(--nb-radius-sm)', background: `${fitQ.color}18`,
                whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 6,
              }}>{fitQ.icon} {fitQ.label}</span>
            </div>
          </div>

          <SectionLabel>Design Summary</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <MetricCard label="Metabolic Drain" value={(drain.totalMetabolicDrain * 100).toFixed(1)} unit="%" warning={!drain.isViable ? 'Non-viable' : undefined} />
            <MetricCard label="Pathway" value={balance.isBalanced ? 'Balanced' : 'Imbalanced'} highlight={balance.isBalanced} />
            <MetricCard label="Best Pathway" value={bestPathway?.name ?? '—'} />
            <MetricCard label="Beneficial Sites" value={beneficialCount.toString()} />
          </div>
        </div>
      </ToolTabPanel>

      {/* ── Analysis Tab ──────────────────────────────────────── */}
      <ToolTabPanel tabId="analysis" activeId={activeTab}>
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <FloatingControlRail label="View Mode" defaultCollapsed={false} width={200}>
            <SectionLabel>Analysis Type</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {VIEW_MODES.map(vm => (
                <button key={vm.key} type="button" onClick={() => setViewMode(vm.key)}
                  className={`nb-tool-toggle ${viewMode === vm.key ? 'nb-tool-toggle--active' : ''}`}
                  style={{
                    width: '100%', textAlign: 'left',
                    fontFamily: T.SANS, fontSize: 'var(--nb-fs-xs)', fontWeight: viewMode === vm.key ? 600 : 400,
                    padding: '5px 8px', borderRadius: 'var(--nb-radius-sm)',
                    borderColor: viewMode === vm.key ? vm.color : undefined,
                    background: viewMode === vm.key ? `${vm.color}18` : undefined,
                    color: viewMode === vm.key ? vm.color : undefined,
                  }}>
                  {vm.label}
                </button>
              ))}
            </div>
          </FloatingControlRail>
          <div style={{ flex: 1, position: 'relative', overflow: 'auto', padding: '12px' }}>
            <ScientificFigureFrame
              eyebrow={VIEW_MODES.find(vm => vm.key === viewMode)?.label ?? ''}
              title={viewMode === 'Binding' ? 'Binding Affinity Radar' :
                     viewMode === 'Sequences' ? 'Designed Sequences' :
                     viewMode === 'FluxCost' ? 'Metabolic Drain Analysis' :
                     viewMode === 'Balancer' ? 'Pathway Balance' :
                     viewMode === 'Pareto' ? 'Pareto Front Ranking' :
                     'Mutagenesis Target Sites'}
              caption={viewMode === 'Binding' ? 'Multi-dimensional binding affinity scores for the selected enzyme.' :
                       viewMode === 'Sequences' ? 'Codon-optimized DNA sequences with stability and expression metrics.' :
                       viewMode === 'FluxCost' ? 'ATP cost and growth penalty of enzyme expression.' :
                       viewMode === 'Balancer' ? 'Flux convergence across pathway steps.' :
                       viewMode === 'Pareto' ? 'Trade-off ranking of candidate pathways.' :
                       'Predicted mutagenesis sites with effect classification.'}
              legend={[
                { label: 'Enzyme', value: enzyme.name, accent: PATHD_THEME.sky },
                { label: 'View', value: viewMode, accent: VIEW_MODES.find(vm => vm.key === viewMode)?.color ?? PATHD_THEME.apricot },
              ]}
            >
              {viewMode === 'Binding' && <BindingRadarChart result={binding} />}
              {viewMode === 'Sequences' && <SequenceView result={sequences} />}
              {viewMode === 'FluxCost' && <FluxCostChart result={drain} />}
              {viewMode === 'Balancer' && <BalancerChart result={balance} />}
              {viewMode === 'Pareto' && <ParetoChart result={pareto} />}
              {viewMode === 'Mutagenesis' && <MutagenesisChart result={mutagenesis} enzyme={enzyme} />}
            </ScientificFigureFrame>
          </div>
        </div>
      </ToolTabPanel>
    </ToolShell>
  );
}
