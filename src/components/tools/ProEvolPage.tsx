'use client';

import { THEME } from '../../theme';
import SimErrorBanner from '../ide/shared/SimErrorBanner';
import DataSourceBadge from '../ide/shared/DataSourceBadge';
import { PROEVOL_THEME, StatusPill } from './proevol/shared';
import { useProEvolState } from './proevol/useProEvolState';
import { kicker } from './proevol/sharedComponents';
import { scanMutations, predictFitness, analyzeConservation } from '../../services/ProEvolCampaignEngine';
import ToolShell from './shared/ToolShell';
import ToolTabPanel from './shared/ToolTabPanel';
import EvolutionCampaignContextCard from './proevol/EvolutionCampaignContextCard';
import NextRoundRecommendationCard from './proevol/NextRoundRecommendationCard';
import LineageTracePanel from './proevol/LineageTracePanel';
import VariantLibraryTable from './proevol/VariantLibraryTable';
import VariantTrajectoryChart from './proevol/research/VariantTrajectoryChart';
import MullerPlot from './proevol/research/MullerPlot';
import EnrichmentBurdenScatter from './proevol/research/EnrichmentBurdenScatter';
import DiversityConvergenceCurve from './proevol/research/DiversityConvergenceCurve';
import { ChartShell } from './proevol/sharedComponents';
import LandscapeTab from './proevol/LandscapeTab';
import MutationScannerTab from './proevol/MutationScannerTab';
import SequenceDesignTab from './proevol/SequenceDesignTab';
import MLGuidedTab from './proevol/MLGuidedTab';

export default function ProEvolPage() {
  const state = useProEvolState();
  const {
    catalystPayload, csvArtifact,
    activeTab, setActiveTab, tabs,
    proevolError, setProevolError,
    campaign, activeResearch, bandSemantic, selectedVariantId, setSelectedVariantId,
    focusedVariant,
    // Guard state needs
    scanSequence, setScanSequence,
    pdbText, setPdbText,
    pdbLoading, setPdbLoading,
    setScanResult,
    setConservationResult,
    setFitnessResult,
    uploadError, isParsing,
    handleDrop, handleDragOver, handleFileInputChange,
    fileInputRef,
    // Design guard state
    setDesignResult, setLibraryResult, setDesignLoading,
    conservationResult,
  } = state;

  return (
    <ToolShell
      moduleId="proevol"
      title="Protein Evolution"
      description="Directed evolution campaign management with fitness landscape analysis"
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      advancedTabIds={['lineage', 'campaign']}
    >
      {proevolError && (
        <div style={{ padding: '0 0 8px' }}><SimErrorBanner message={proevolError} onRetry={() => setProevolError(null)} /></div>
      )}

      {/* ═══ Guard: no upstream CatDes data and no CSV upload ═══ */}
      {!catalystPayload && !csvArtifact ? (
        <>
          <div style={{
            padding: '24px', textAlign: 'center',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '12px',
            margin: '16px',
          }}>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', marginBottom: '8px' }}>
              ProEvol requires upstream data from CatDes to run meaningful evolution campaigns.
            </p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
              Run CatDes first to generate binding affinity and sequence data, then return here.
            </p>
          </div>

          {/* CSV upload still available without upstream data */}
          <ToolTabPanel activeId={activeTab} tabId="landscape">
            <div style={{ display: 'grid', gap: '10px', padding: '10px 12px 14px' }}>
              <div
                style={{
                  padding: '10px 12px', borderRadius: 'var(--nb-radius-md)',
                  border: `1px dashed ${PROEVOL_THEME.border}`,
                  background: PROEVOL_THEME.surface,
                  display: 'grid', gap: '8px',
                }}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={kicker}>CSV Data Upload</span>
                  <StatusPill tone="neutral">No upstream data</StatusPill>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <div
                    style={{
                      fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: PROEVOL_THEME.muted,
                      lineHeight: 1.5, flex: '1 1 260px',
                    }}
                  >
                    Upload a CSV with columns: <code style={{ fontFamily: THEME.MONO, color: PROEVOL_THEME.sky, fontSize: 'var(--nb-fs-xs)' }}>variant_id, round, replicate, read_count</code>.
                    Drop a file here or click to browse.
                  </div>
                  <label
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      padding: '6px 14px', borderRadius: '999px',
                      background: 'rgba(191,220,205,0.12)', color: PROEVOL_THEME.mint,
                      fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', letterSpacing: '0.06em',
                      textTransform: 'uppercase', cursor: 'pointer',
                      border: `1px solid ${PROEVOL_THEME.mint}44`,
                    }}
                  >
                    {isParsing ? 'Parsing...' : 'Choose CSV'}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleFileInputChange}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
                {uploadError ? (
                  <div style={{
                    fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: PROEVOL_THEME.coral,
                    padding: '6px 10px', borderRadius: 'var(--nb-radius-sm)',
                    background: 'rgba(232,163,161,0.08)', border: `1px solid ${PROEVOL_THEME.coral}33`,
                    lineHeight: 1.5,
                  }}>
                    {uploadError}
                  </div>
                ) : null}
              </div>
            </div>
          </ToolTabPanel>

          {/* Scanner and Design tabs still work without upstream data */}
          <ToolTabPanel activeId={activeTab} tabId="scanner">
            <div style={{ padding: '16px', display: 'grid', gap: '12px' }}>
              <div style={{ border: `1px solid ${PROEVOL_THEME.border}`, background: PROEVOL_THEME.surface, borderRadius: 'var(--nb-radius-md)', padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={kicker}>Protein Sequence Input</span>
                  <DataSourceBadge source={pdbText ? 'live' : 'mock'} label={pdbText ? 'AlphaFold Live' : 'AlphaFold'} />
                </div>
                <textarea
                  placeholder="Paste protein sequence (one-letter amino acid codes)..."
                  value={scanSequence}
                  onChange={e => setScanSequence(e.target.value.toUpperCase().replace(/[^ACDEFGHIKLMNPQRSTVWY]/g, ''))}
                  style={{
                    width: '100%', height: 60, resize: 'vertical',
                    fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: PROEVOL_THEME.value,
                    background: PROEVOL_THEME.inset, border: `1px solid ${PROEVOL_THEME.border}`,
                    borderRadius: 'var(--nb-radius-sm)', padding: '8px',
                  }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    onClick={async () => {
                      if (!scanSequence) return;
                      setPdbLoading(true);
                      try {
                        const res = await fetch(`/api/alphafold?id=${scanSequence.substring(0, 6)}`);
                        if (res.ok) { const text = await res.text(); setPdbText(text); }
                      } finally { setPdbLoading(false); }
                    }}
                    disabled={!scanSequence || pdbLoading}
                    style={{
                      padding: '6px 12px', borderRadius: 'var(--nb-radius-sm)',
                      background: pdbLoading ? 'rgba(255,255,255,0.04)' : 'rgba(175,195,214,0.12)',
                      border: `1px solid ${pdbLoading ? 'rgba(255,255,255,0.08)' : 'rgba(175,195,214,0.25)'}`,
                      color: pdbLoading ? 'rgba(255,255,255,0.35)' : PROEVOL_THEME.sky,
                      fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', cursor: 'pointer',
                    }}
                  >
                    {pdbLoading ? 'Fetching...' : 'Fetch PDB (optional)'}
                  </button>
                  <button
                    onClick={() => {
                      if (!scanSequence) return;
                      try {
                        setConservationResult(analyzeConservation(scanSequence, pdbText ?? undefined));
                        if (pdbText) {
                          const result = scanMutations(pdbText, scanSequence);
                          setScanResult(result);
                          const ddgMap = new Map<string, number>();
                          for (const r of result.results) ddgMap.set(`${r.position}:${r.mut}`, r.ddg);
                          const fitness = predictFitness({
                            sequence: scanSequence,
                            mutations: result.results.map(r => ({ position: r.position, mut: r.mut })),
                            pdbText,
                            ddgResults: ddgMap,
                          });
                          setFitnessResult(fitness.predictions);
                        } else {
                          const conserved = conservationResult?.conservedPositions ?? [];
                          const variable = conservationResult?.variablePositions ?? [];
                          const mutations = variable.slice(0, 20).flatMap(pos => {
                            const wt = scanSequence[pos - 1];
                            return 'ACDEFGHIKLMNPQRSTVWY'.split('').filter(aa => aa !== wt).slice(0, 3).map(aa => ({ position: pos, mut: aa }));
                          });
                          const fitness = predictFitness({ sequence: scanSequence, mutations });
                          setFitnessResult(fitness.predictions);
                        }
                      } catch (err) {
                        const msg = err instanceof Error ? err.message : 'Mutation analysis failed';
                        setProevolError(msg);
                      }
                    }}
                    disabled={!scanSequence}
                    style={{
                      padding: '6px 12px', borderRadius: 'var(--nb-radius-sm)',
                      background: !scanSequence ? 'rgba(255,255,255,0.04)' : 'rgba(191,220,205,0.14)',
                      border: `1px solid ${!scanSequence ? 'rgba(255,255,255,0.08)' : 'rgba(191,220,205,0.3)'}`,
                      color: !scanSequence ? 'rgba(255,255,255,0.35)' : PROEVOL_THEME.mint,
                      fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', cursor: 'pointer',
                    }}
                  >
                    Run Analysis
                  </button>
                </div>
              </div>
            </div>
          </ToolTabPanel>

          <ToolTabPanel activeId={activeTab} tabId="design">
            <div style={{ padding: '16px', display: 'grid', gap: '12px' }}>
              <div style={{ border: `1px solid ${PROEVOL_THEME.border}`, background: PROEVOL_THEME.surface, borderRadius: 'var(--nb-radius-md)', padding: '14px' }}>
                <span style={kicker}>Inverse Folding Design</span>
                <p style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, margin: '4px 0 12px' }}>
                  Paste a sequence in the Mutation Scanner tab first, then return here to design sequences.
                </p>
              </div>
            </div>
          </ToolTabPanel>

          {/* Remaining tabs show placeholder */}
          {['trajectory', 'library', 'ml'].map((tabId) => (
            <ToolTabPanel key={tabId} activeId={activeTab} tabId={tabId}>
              <div style={{ padding: '24px', textAlign: 'center' }}>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
                  Run CatDes first or upload a CSV to view this analysis.
                </p>
              </div>
            </ToolTabPanel>
          ))}
        </>
      ) : (
      <>
      {/* ═══════ LANDSCAPE TAB (default) ═══════ */}
      <ToolTabPanel activeId={activeTab} tabId="landscape">
        <LandscapeTab state={state} />
      </ToolTabPanel>

      {/* ═══════ MUTATION SCANNER TAB ═══════ */}
      <ToolTabPanel activeId={activeTab} tabId="scanner">
        <MutationScannerTab state={state} />
      </ToolTabPanel>

      {/* ═══════ SEQUENCE DESIGN TAB ═══════ */}
      <ToolTabPanel activeId={activeTab} tabId="design">
        <SequenceDesignTab state={state} />
      </ToolTabPanel>

      {/* ═══════ TRAJECTORY TAB ═══════ */}
      <ToolTabPanel activeId={activeTab} tabId="trajectory">
        <div style={{ padding: '16px' }}>
          <div style={{ display: 'grid', gap: '12px' }}>
            <ChartShell title="Variant trajectory · top 6" footnote={`Frequencies use Laplace pseudocount (+1). Hover for ${bandSemantic === 'modeled' ? 'model spread' : '95% CI'} range.`}>
              <VariantTrajectoryChart trajectories={activeResearch.topVariants} bandSemantic={bandSemantic} highlightVariantId={selectedVariantId} onSelectVariant={setSelectedVariantId} />
            </ChartShell>
            <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: '1fr 1fr' }}>
              <ChartShell title="Family share · Muller stack">
                <MullerPlot data={activeResearch.familyShares} />
              </ChartShell>
              <ChartShell title="Diversity & convergence">
                <DiversityConvergenceCurve data={activeResearch.diversity} bandSemantic={bandSemantic} />
              </ChartShell>
            </div>
            <ChartShell title="Enrichment vs mutation burden">
              <EnrichmentBurdenScatter entries={activeResearch.enrichment} highlightVariantId={selectedVariantId} onSelectVariant={setSelectedVariantId} />
            </ChartShell>
          </div>
        </div>
      </ToolTabPanel>

      {/* ═══════ LIBRARY TAB ═══════ */}
      <ToolTabPanel activeId={activeTab} tabId="library">
        <div style={{ padding: '16px' }}>
          <VariantLibraryTable roundResult={campaign.currentRoundResult} selectedVariantId={focusedVariant?.id ?? null} onSelectVariant={setSelectedVariantId} />
        </div>
      </ToolTabPanel>

      {/* ═══════ LINEAGE TAB ═══════ */}
      <ToolTabPanel activeId={activeTab} tabId="lineage">
        <div style={{ padding: '16px' }}>
          <LineageTracePanel campaign={campaign} selectedVariantId={selectedVariantId} onSelectVariant={setSelectedVariantId} />
        </div>
      </ToolTabPanel>

      {/* ═══════ CAMPAIGN TAB ═══════ */}
      <ToolTabPanel activeId={activeTab} tabId="campaign">
        <div style={{ padding: '16px' }}>
          <div style={{ display: 'grid', gap: '12px' }}>
            <EvolutionCampaignContextCard campaign={campaign} totalRounds={state.totalRounds} librarySize={state.librarySize} survivorCount={state.survivorCount} selectionStringency={state.selectionStringency} onTotalRoundsChange={state.setTotalRounds} onLibrarySizeChange={state.setLibrarySize} onSurvivorCountChange={state.setSurvivorCount} onSelectionStringencyChange={state.setSelectionStringency} />
            <NextRoundRecommendationCard campaign={campaign} />
          </div>
        </div>
      </ToolTabPanel>

      {/* ═══════ ML-GUIDED TAB ═══════ */}
      <ToolTabPanel activeId={activeTab} tabId="ml">
        <MLGuidedTab state={state} />
      </ToolTabPanel>
      </>
      )}
    </ToolShell>
  );
}
