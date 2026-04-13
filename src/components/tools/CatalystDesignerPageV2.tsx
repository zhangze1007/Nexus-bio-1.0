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
} from '../../services/CatalystDesignerEngine';
import { useWorkbenchStore } from '../../store/workbenchStore';
import WorkbenchInlineContext from '../workbench/WorkbenchInlineContext';
import { buildCatalystSeed } from './shared/workbenchDataflow';
import { T } from '../ide/tokens';
import { PATHD_THEME } from '../workbench/workbenchTheme';
import CatalystViewer3D, { kdToQuality, bindingColorCSS } from '../molecular/CatalystViewer3D';
import type { ResidueClickData } from '../molecular/CatalystViewer3D';
import type { MutagenesisSite } from '../../services/CatalystDesignerEngine';
import BindingRadarChart from '../charts/BindingRadarChart';
import FluxCostChart from '../charts/FluxCostChart';
import BalancerChart from '../charts/BalancerChart';
import ParetoChart from '../charts/ParetoChart';
import MutagenesisChart from '../charts/MutagenesisChart';

/* ── Design Tokens (ported from V1) ──────────────────────────────── */

const BORDER = PATHD_THEME.sepiaPanelBorder;
const LABEL = PATHD_THEME.label;
const VALUE = PATHD_THEME.value;
const INPUT_BG = PATHD_THEME.panelInset;
const INPUT_BORDER = PATHD_THEME.sepiaPanelBorder;
const INPUT_TEXT = PATHD_THEME.value;

const GLASS: React.CSSProperties = {
  borderRadius: '24px',
  background: PATHD_THEME.panelSurface,
  border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
};

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

/* ── Small helpers ─────────────────────────────────────────────── */

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p style={{
    fontFamily: T.SANS, fontSize: '9px', textTransform: 'uppercase',
    letterSpacing: '0.1em', color: LABEL, margin: '0 0 10px',
  }}>
    {children}
  </p>
);

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

/* ── Sequence Design View (ported from V1, with heuristic label) ── */

function SequenceView({ result }: { result: SequenceDesignResult }) {
  const caiColor = (v: number) =>
    v >= 0.75 ? '#93CB52' : v >= 0.55 ? '#FFFB1F' : 'rgba(255,120,120,0.7)';
  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 16 }}>
      <SectionLabel>Designed Sequences — {result.targetEnzyme}</SectionLabel>
      <p style={{ fontFamily: T.SANS, fontSize: '9px', color: 'rgba(255,255,255,0.35)', margin: '0 0 8px', fontStyle: 'italic' }}>
        Stability estimates are heuristic screening scores (BLOSUM62-based), not rigorous ΔΔG values.
      </p>
      {result.designs.map(d => (
        <div key={d.rank} style={{ ...GLASS, padding: '10px 14px', marginBottom: 8, borderRadius: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontFamily: T.MONO, fontSize: '11px', color: PHASE_COLORS.sequence, fontWeight: 600 }}>#{d.rank}</span>
            <span style={{ fontFamily: T.MONO, fontSize: '10px', color: VALUE }}>Score {d.score.toFixed(2)}</span>
            <span style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL }}>Recovery {(d.recoveryRate * 100).toFixed(1)}%</span>
            <span style={{ fontFamily: T.MONO, fontSize: '10px', color: caiColor(d.cai) }}>CAI {d.cai.toFixed(2)}</span>
            <span style={{ fontFamily: T.MONO, fontSize: '10px', color: LABEL }}>GC {(d.gcContent * 100).toFixed(1)}%</span>
            <span style={{ fontFamily: T.MONO, fontSize: '10px', color: d.rareCodons > 3 ? 'rgba(255,120,120,0.7)' : VALUE }}>{d.rareCodons} rare</span>
          </div>
          <div style={{
            fontFamily: T.MONO, fontSize: '9px', color: 'rgba(255,255,255,0.45)',
            letterSpacing: '0.04em', overflowX: 'auto', whiteSpace: 'nowrap',
            padding: '4px 6px', background: 'rgba(0,0,0,0.3)', borderRadius: 6,
          }}>
            {d.dnaSequence.slice(0, 60)}
            {d.dnaSequence.length > 60 && <span style={{ color: LABEL }}> …</span>}
          </div>
        </div>
      ))}
      {result.consensusMotifs.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <SectionLabel>Consensus Motifs</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {result.consensusMotifs.map((m, i) => (
              <span key={i} style={{
                fontFamily: T.MONO, fontSize: '10px', color: PHASE_COLORS.sequence,
                padding: '2px 8px', borderRadius: 8,
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
  const [selectedEnzymeIdx, setSelectedEnzymeIdx] = useState<number>(2); // ADS default
  const [viewMode, setViewMode] = useState<ViewMode>('Binding'); // used in inspector Analysis tab
  const [renderMode, setRenderMode] = useState<'cartoon' | 'surface' | 'confidence'>('cartoon');
  const [spinEnabled, setSpinEnabled] = useState(true);
  const [selectedResidue, setSelectedResidue] = useState<ResidueClickData | null>(null);
  const [pendingMutation, setPendingMutation] = useState<string | null>(null);
  type InspectorTab = 'residue' | 'stats' | 'analysis';
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('stats');

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

  /* ── Workbench write-back (identical to V1) ──────────────────── */
  useEffect(() => {
    if (simError) return;
    setToolPayload('catdes', {
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

  /* ── Render ──────────────────────────────────────────────────── */
  const kdQ = kdQuality(binding.predictedKd);
  const kcatQ = kcatQuality(enzyme.kcat);
  const fitQ = fitQuality(binding.overallScore);

  return (
    <div className="nb-tool-page" style={{ display: 'flex', flexDirection: 'column' }}>

      {/* ── Compact Header: enzyme selector + key metrics ───── */}
      <div style={{
        margin: '0 12px 6px', padding: '6px 12px', ...GLASS, borderRadius: 14,
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flexShrink: 0,
      }}>
        <select
          value={selectedEnzymeIdx}
          onChange={e => { setSelectedEnzymeIdx(Number(e.target.value)); setSelectedResidue(null); setPendingMutation(null); }}
          style={{
            fontFamily: T.SANS, fontSize: '11px', fontWeight: 600,
            color: VALUE, background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`,
            borderRadius: 8, padding: '3px 8px', cursor: 'pointer',
          }}
        >
          {ENZYME_STRUCTURES.map((enz, i) => (
            <option key={enz.id} value={i}>{enz.name} · EC {enz.ecNumber}</option>
          ))}
        </select>
        {enzyme.id === RATE_LIMITING_ENZYME.id && (
          <span style={{
            fontFamily: T.MONO, fontSize: '7px', color: '#FFFB1F',
            background: 'rgba(255,251,31,0.12)', padding: '1px 5px', borderRadius: 4,
          }}>Rate-limiting</span>
        )}
        <span style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL }}>
          {enzyme.substrate} → {enzyme.product}
        </span>
        {/* Inline key metrics */}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontFamily: T.MONO, fontSize: '10px', color: bindingColorCSS(kdToQuality(binding.predictedKd)) }}>
            Kd {binding.predictedKd.toFixed(1)} μM
          </span>
          <span style={{ fontFamily: T.MONO, fontSize: '10px', color: kcatQ.color }}>
            kcat {enzyme.kcat.toFixed(1)} s⁻¹
          </span>
          <span style={{ fontFamily: T.MONO, fontSize: '10px', color: fitQ.color }}>
            Fit {binding.overallScore.toFixed(2)}
          </span>
          {enzyme.pdbId && (
            <span style={{ fontFamily: T.MONO, fontSize: '8px', color: 'rgba(255,255,255,0.25)' }}>
              PDB {enzyme.pdbId}
            </span>
          )}
        </span>
      </div>

      {simError && <div style={{ padding: '0 12px 4px' }}><SimErrorBanner message={simError} /></div>}

      {/* ── 3D Viewport (60%) + Inspector (40%) ──────────────── */}
      <div style={{
        display: 'flex', gap: 12, padding: '0 16px 12px',
        flex: 1, minHeight: 0, overflow: 'hidden',
      }}>
        {/* 3D Viewport */}
        <div style={{ flex: '0 0 60%', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <CatalystViewer3D
            enzyme={enzyme}
            renderMode={renderMode}
            spinEnabled={spinEnabled}
            onResidueClick={(data) => { setSelectedResidue(data); setPendingMutation(null); setInspectorTab('residue'); }}
            selectedResidue={selectedResidue?.position ?? null}
            bindingQuality={kdToQuality(binding.predictedKd)}
            style={{ flex: 1, minHeight: 0 }}
          />
          {/* Render mode controls */}
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexShrink: 0 }}>
            {(['cartoon', 'surface', 'confidence'] as const).map(mode => (
              <button key={mode} type="button" onClick={() => setRenderMode(mode)} style={{
                border: `1px solid ${renderMode === mode ? 'rgba(200,232,240,0.3)' : 'rgba(255,255,255,0.08)'}`,
                background: renderMode === mode ? 'rgba(200,232,240,0.12)' : 'rgba(255,255,255,0.03)',
                color: renderMode === mode ? '#C8E8F0' : 'rgba(255,255,255,0.45)',
                fontSize: 9, borderRadius: 999, padding: '3px 8px', cursor: 'pointer',
                transition: 'all 0.2s',
              }}>
                {mode === 'confidence' ? 'pLDDT' : mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
            <button type="button" onClick={() => setSpinEnabled(!spinEnabled)} style={{
              border: '1px solid rgba(255,255,255,0.08)',
              background: spinEnabled ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: 'rgba(255,255,255,0.5)', fontSize: 9,
              borderRadius: 999, padding: '3px 8px', cursor: 'pointer',
            }}>
              {spinEnabled ? 'Auto-spin' : 'Static'}
            </button>
          </div>
        </div>

        {/* Inspector Panel — glassmorphism, tabbed */}
        <div style={{
          flex: '0 0 38%', minWidth: 0,
          background: 'rgba(13,15,20,0.72)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: `1px solid ${BORDER}`, borderRadius: 16,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Tab bar */}
          <div style={{
            display: 'flex', gap: 0, borderBottom: `1px solid ${BORDER}`, flexShrink: 0,
          }}>
            {([
              { key: 'residue' as const, label: 'Residue' },
              { key: 'stats' as const, label: 'Stats' },
              { key: 'analysis' as const, label: 'Analysis' },
            ]).map(tab => (
              <button key={tab.key} type="button" onClick={() => setInspectorTab(tab.key)} style={{
                flex: 1, padding: '7px 0', border: 'none', cursor: 'pointer',
                fontFamily: T.SANS, fontSize: '9px', letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: inspectorTab === tab.key ? VALUE : LABEL,
                background: inspectorTab === tab.key ? 'rgba(255,255,255,0.05)' : 'transparent',
                borderBottom: inspectorTab === tab.key ? '2px solid rgba(200,216,232,0.5)' : '2px solid transparent',
                transition: 'all 0.15s ease',
              }}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content — scrollable */}
          <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>

            {/* ── RESIDUE TAB ──────────────────────────────────── */}
            {inspectorTab === 'residue' && (
              selectedResidue ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ ...GLASS, borderRadius: 12, padding: '8px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontFamily: T.MONO, fontSize: '14px', color: VALUE, fontWeight: 700 }}>
                        {selectedResidue.name}
                      </span>
                      <span style={{ fontFamily: T.MONO, fontSize: '9px', color: LABEL }}>
                        pos {selectedResidue.position}
                      </span>
                      {selectedResidue.isCatalytic && (
                        <span style={{
                          fontFamily: T.MONO, fontSize: '7px', color: '#93CB52',
                          background: 'rgba(147,203,82,0.12)', padding: '1px 5px', borderRadius: 4,
                        }}>catalytic</span>
                      )}
                    </div>
                    {selectedCatalyticResidue ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                        <span style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL }}>Role</span>
                        <span style={{ fontFamily: T.MONO, fontSize: '10px', color: VALUE }}>{selectedCatalyticResidue.role.replace('_', ' ')}</span>
                        <span style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL }}>Dist</span>
                        <span style={{ fontFamily: T.MONO, fontSize: '10px', color: VALUE }}>{selectedCatalyticResidue.distanceToSubstrate.toFixed(1)} Å</span>
                        <span style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL }}>Angle</span>
                        <span style={{ fontFamily: T.MONO, fontSize: '10px', color: VALUE }}>{selectedCatalyticResidue.orientationAngle.toFixed(0)}°</span>
                        <span style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL }}>pKa shift</span>
                        <span style={{ fontFamily: T.MONO, fontSize: '10px', color: Math.abs(selectedCatalyticResidue.pKaShift) > 0.5 ? '#FA8072' : VALUE }}>
                          {selectedCatalyticResidue.pKaShift > 0 ? '+' : ''}{selectedCatalyticResidue.pKaShift.toFixed(2)}
                        </span>
                        {selectedResidue.distanceToSubstrate != null && (
                          <>
                            <span style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL }}>→ Substrate</span>
                            <span style={{ fontFamily: T.MONO, fontSize: '10px', color: VALUE }}>{selectedResidue.distanceToSubstrate.toFixed(1)} Å</span>
                          </>
                        )}
                      </div>
                    ) : (
                      <p style={{ fontFamily: T.SANS, fontSize: '10px', color: LABEL, margin: 0 }}>
                        Non-catalytic residue — {selectedResidue.residueLetter} at position {selectedResidue.position}
                      </p>
                    )}
                  </div>

                  {/* Mutation Dropdown */}
                  <div>
                    <SectionLabel>Mutate to…</SectionLabel>
                    <select
                      value={pendingMutation ?? ''}
                      onChange={e => setPendingMutation(e.target.value || null)}
                      style={{
                        width: '100%', fontFamily: T.MONO, fontSize: '11px',
                        color: INPUT_TEXT, background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`,
                        borderRadius: 8, padding: '4px 8px', cursor: 'pointer',
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

                    {pendingMutation && (
                      <div style={{ ...GLASS, borderRadius: 10, padding: '8px 10px', marginTop: 6 }}>
                        <div style={{ fontFamily: T.MONO, fontSize: '11px', color: VALUE, marginBottom: 4 }}>
                          {selectedResidue.residueLetter}{selectedResidue.position}{pendingMutation}
                        </div>
                        {selectedMutagenesisSite && selectedMutagenesisSite.suggestedMutants.includes(pendingMutation) ? (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                            <span style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL }}>Δkcat</span>
                            <span style={{ fontFamily: T.MONO, fontSize: '10px', color: selectedMutagenesisSite.predictedDeltaKcat > 1 ? '#93CB52' : '#FA8072' }}>
                              {selectedMutagenesisSite.predictedDeltaKcat.toFixed(2)}×
                            </span>
                            <span style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL }}>ΔKm</span>
                            <span style={{ fontFamily: T.MONO, fontSize: '10px', color: selectedMutagenesisSite.predictedDeltaKm < 1 ? '#93CB52' : '#FA8072' }}>
                              {selectedMutagenesisSite.predictedDeltaKm.toFixed(2)}×
                            </span>
                            <span style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL }}>Effect</span>
                            <span style={{ fontFamily: T.MONO, fontSize: '10px', color:
                              selectedMutagenesisSite.predictedEffect === 'beneficial' ? '#93CB52' :
                              selectedMutagenesisSite.predictedEffect === 'neutral' ? '#FFFB1F' : '#FA8072'
                            }}>
                              {selectedMutagenesisSite.predictedEffect}
                            </span>
                            <span style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL }}>Confidence</span>
                            <span style={{ fontFamily: T.MONO, fontSize: '10px', color: VALUE }}>
                              {(selectedMutagenesisSite.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                        ) : (
                          <p style={{ fontFamily: T.SANS, fontSize: '9px', color: LABEL, margin: 0 }}>
                            No screening data for this substitution.
                          </p>
                        )}
                        <p style={{ fontFamily: T.SANS, fontSize: '7px', color: 'rgba(255,255,255,0.25)', margin: '5px 0 0', fontStyle: 'italic' }}>
                          BLOSUM62 heuristic screening score — not rigorous ΔΔG
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p style={{ fontFamily: T.SANS, fontSize: '10px', color: LABEL, margin: 0 }}>
                  Click a residue on the 3D model to inspect it.
                </p>
              )
            )}

            {/* ── STATS TAB ────────────────────────────────────── */}
            {inspectorTab === 'stats' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <SectionLabel>Kinetic Parameters</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}><MetricCard label="Kd" value={binding.predictedKd.toFixed(2)} unit="μM" /></div>
                    <span style={{
                      fontFamily: T.MONO, fontSize: '9px', color: bindingColorCSS(kdToQuality(binding.predictedKd)),
                      padding: '2px 6px', borderRadius: 6,
                      background: `${bindingColorCSS(kdToQuality(binding.predictedKd))}18`,
                      whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 6,
                    }}>{kdQ.icon} {kdQ.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}><MetricCard label="kcat" value={enzyme.kcat.toFixed(2)} unit="s⁻¹" /></div>
                    <span style={{
                      fontFamily: T.MONO, fontSize: '9px', color: kcatQ.color,
                      padding: '2px 6px', borderRadius: 6, background: `${kcatQ.color}18`,
                      whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 6,
                    }}>{kcatQ.icon} {kcatQ.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}><MetricCard label="Km" value={enzyme.km.toFixed(3)} unit="mM" /></div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}><MetricCard label="Fit" value={binding.overallScore.toFixed(2)} /></div>
                    <span style={{
                      fontFamily: T.MONO, fontSize: '9px', color: fitQ.color,
                      padding: '2px 6px', borderRadius: 6, background: `${fitQ.color}18`,
                      whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 6,
                    }}>{fitQ.icon} {fitQ.label}</span>
                  </div>
                </div>

                <SectionLabel>Design Summary</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <MetricCard label="Metabolic Drain" value={(drain.totalMetabolicDrain * 100).toFixed(1)} unit="%" warning={!drain.isViable ? 'Non-viable' : undefined} />
                  <MetricCard label="Pathway" value={balance.isBalanced ? 'Balanced' : 'Imbalanced'} highlight={balance.isBalanced} />
                  <MetricCard label="Best Pathway" value={bestPathway?.name ?? '—'} />
                  <MetricCard label="Beneficial Sites" value={mutagenesis.sites.filter(s => s.predictedEffect === 'beneficial').length.toString()} />
                </div>
              </div>
            )}

            {/* ── ANALYSIS TAB — 6 SVG sub-views ──────────────── */}
            {inspectorTab === 'analysis' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Sub-tab selector */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {VIEW_MODES.map(vm => (
                    <button key={vm.key} type="button" onClick={() => setViewMode(vm.key)} style={{
                      fontFamily: T.SANS, fontSize: '8px', fontWeight: viewMode === vm.key ? 600 : 400,
                      padding: '3px 8px', borderRadius: 10, cursor: 'pointer',
                      border: viewMode === vm.key ? `1px solid ${vm.color}` : `1px solid ${INPUT_BORDER}`,
                      background: viewMode === vm.key ? `${vm.color}18` : 'transparent',
                      color: viewMode === vm.key ? vm.color : INPUT_TEXT,
                      transition: 'all 0.15s ease',
                    }}>
                      {vm.label}
                    </button>
                  ))}
                </div>
                {/* SVG view content */}
                <div style={{ transition: 'opacity 0.2s ease' }}>
                  {viewMode === 'Binding' && <BindingRadarChart result={binding} />}
                  {viewMode === 'Sequences' && <SequenceView result={sequences} />}
                  {viewMode === 'FluxCost' && <FluxCostChart result={drain} />}
                  {viewMode === 'Balancer' && <BalancerChart result={balance} />}
                  {viewMode === 'Pareto' && <ParetoChart result={pareto} />}
                  {viewMode === 'Mutagenesis' && <MutagenesisChart result={mutagenesis} enzyme={enzyme} />}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ── Compact Footer: workbench context + export ─────── */}
      <div style={{
        padding: '4px 16px 6px', display: 'flex', alignItems: 'center', gap: 8,
        borderTop: `1px solid ${BORDER}`, flexShrink: 0,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <WorkbenchInlineContext
            toolId="catdes"
            title="Catalyst Designer"
            summary={`${enzyme.name} — Kd ${binding.predictedKd.toFixed(1)} μM, ${mutagenesis.sites.filter(s => s.predictedEffect === 'beneficial').length} beneficial sites`}
            compact
          />
        </div>
        <ExportButton label="Export JSON"
          data={{ enzyme: enzyme.id, binding, sequences, drain, balance, pareto, mutagenesis }}
          filename="catalyst-design" format="json" />
      </div>
    </div>
  );
}
