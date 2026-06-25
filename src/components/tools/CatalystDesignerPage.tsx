'use client';
/**
 * CatalystDesignerPage -- Orchestrator for the Catalyst Designer tool.
 * Delegates to sub-components in ./catdes/ for view panels and tab content.
 */
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import ExportButton from '../ide/shared/ExportButton';
import SimErrorBanner from '../ide/shared/SimErrorBanner';
import CatalystViewer3D from '../molecular/CatalystViewer3D';
import type { ResidueClickData } from '../molecular/CatalystViewer3D';
import {
  ENZYME_STRUCTURES, PATHWAY_STEPS, PATHWAY_CANDIDATES, RATE_LIMITING_ENZYME,
} from '../../data/mockCatalystDesigner';
import {
  predictBindingAffinity, designSequences, estimateMetabolicDrain,
  balancePathway, rankPathways, predictMutagenesisSites, identifyBottlenecks,
} from '../../services/CatalystDesignerEngine';
import { useWorkbenchStore } from '../../store/workbenchStore';
import { buildCatalystSeed } from './shared/workbenchDataflow';
import CatDesSidebar from './catdes/CatDesSidebar';
import { useNavigation } from '../../contexts/NavigationContext';
import AlgorithmPanel from '../shared/AlgorithmPanel';
import ToolTabPanel from './shared/ToolTabPanel';
import InlineMetricOverlay from './shared/InlineMetricOverlay';
import ToolTabBar, { type ToolTab } from './shared/ToolTabBar';
import MetricCard from '../ide/shared/MetricCard';
import NextStepButton from '../NextStepButton';
import { THEME } from '../../theme';
import { toolTokens } from '../../hooks/useToolTheme';
import {
  PHASE_COLORS, kdQuality, kcatQuality, fitQuality, computeMutationImpact,
} from './catdes/catdesShared';
import { FrontierEngineBadge, ParetoView } from './catdes/CatDesViewComponents';
import CatDesOverviewTab from './catdes/CatDesOverviewTab';
import CatDesInverseFoldingTab from './catdes/CatDesInverseFoldingTab';
import CatDesExpressionTab from './catdes/CatDesExpressionTab';
import CatDesPlasmidTab from './catdes/CatDesPlasmidTab';
import CatDesRNATab from './catdes/CatDesRNATab';
import CatDesRegulatoryTab from './catdes/CatDesRegulatoryTab';
import CatDesBiosensorTab from './catdes/CatDesBiosensorTab';
import { useCatDesState } from './catdes/useCatDesState';

/* -- Design Tokens --------------------------------------------------- */

const { border: BORDER, label: LABEL, value: VALUE,
        inputBg: INPUT_BG, inputBorder: INPUT_BORDER, inputText: INPUT_TEXT } = toolTokens;
const GLASS: React.CSSProperties = { ...toolTokens.glass, borderRadius: 'var(--nb-radius-xl)' };

/* -- Main Component -------------------------------------------------- */

export default React.memo(function CatalystDesignerPage() {
  const { handleBack } = useNavigation();
  const project = useWorkbenchStore((s) => s.project);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const fbaPayload = useWorkbenchStore((s) => s.toolPayloads.fbasim);
  const cethxPayload = useWorkbenchStore((s) => s.toolPayloads.cethx);
  const dbtlPayload = useWorkbenchStore((s) => s.toolPayloads.dbtlflow);
  const setToolPayload = useWorkbenchStore((s) => s.setToolPayload);

  /* -- Core UI state ------------------------------------------------- */
  const [selectedEnzyme, setSelectedEnzyme] = useState<number>(2);
  const [renderMode, setRenderMode] = useState<'cartoon' | 'surface' | 'confidence'>('cartoon');
  const [spinEnabled, setSpinEnabled] = useState(true);
  const [selectedResidue, setSelectedResidue] = useState<number | null>(null);
  const [selectedMutation, setSelectedMutation] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  /* -- Feature state hook -------------------------------------------- */
  const fs = useCatDesState(ENZYME_STRUCTURES[selectedEnzyme], selectedEnzyme);

  /* -- Seed management ----------------------------------------------- */
  const recommendedSeed = useMemo(
    () => buildCatalystSeed(project, analyzeArtifact, fbaPayload, cethxPayload, dbtlPayload),
    [analyzeArtifact?.generatedAt, analyzeArtifact?.id, cethxPayload?.updatedAt, dbtlPayload?.feedbackSource, dbtlPayload?.result.improvementRate, dbtlPayload?.result.latestPhase, dbtlPayload?.result.passRate, dbtlPayload?.updatedAt, fbaPayload?.updatedAt, project?.id, project?.updatedAt],
  );
  const seedSignature = useMemo(
    () => `${recommendedSeed.enzymeIndex}|${recommendedSeed.requiredFlux}|${recommendedSeed.designCount}`,
    [recommendedSeed.enzymeIndex, recommendedSeed.requiredFlux, recommendedSeed.designCount],
  );
  const lastAppliedSeedRef = useRef<string | null>(null);

  const enzyme = ENZYME_STRUCTURES[selectedEnzyme];
  const { activeEnzyme } = fs;

  useEffect(() => {
    if (lastAppliedSeedRef.current === seedSignature) return;
    setSelectedEnzyme(recommendedSeed.enzymeIndex);
    lastAppliedSeedRef.current = seedSignature;
  }, [seedSignature, recommendedSeed.enzymeIndex]);

  /* -- Computed values ----------------------------------------------- */
  const { data: binding, error: simError } = useMemo(() => {
    try { return { data: predictBindingAffinity(enzyme), error: null as string | null }; }
    catch (e) { return { data: predictBindingAffinity(ENZYME_STRUCTURES[selectedEnzyme]), error: e instanceof Error ? e.message : 'Binding prediction failed' }; }
  }, [enzyme]);
  const sequences = useMemo(() => designSequences(enzyme, recommendedSeed.designCount), [enzyme, recommendedSeed.designCount]);
  const drain = useMemo(() => estimateMetabolicDrain(activeEnzyme, recommendedSeed.requiredFlux), [activeEnzyme, recommendedSeed.requiredFlux]);
  const balance = useMemo(() => balancePathway(PATHWAY_STEPS), []);
  const pareto = useMemo(() => rankPathways(PATHWAY_CANDIDATES), []);
  const mutagenesis = useMemo(() => predictMutagenesisSites(enzyme, 5), [enzyme]);
  const bottlenecks = useMemo(() => identifyBottlenecks({
    pathwaySteps: PATHWAY_STEPS.map(s => ({ enzymeId: s.enzyme, enzymeName: s.enzyme, substrate: s.substrate, product: s.product })),
    fbaData: fbaPayload?.result ? { shadowPrices: fbaPayload.result.sensitivityCoefficients, fluxes: Object.fromEntries(fbaPayload.result.topFluxes.map(f => [f.reactionId, f.flux])), feasible: fbaPayload.result.feasible } : undefined,
    cethxData: cethxPayload?.result ? { overallFeasible: cethxPayload.result.gibbsFreeEnergy < 0 } : undefined,
    dbtlflowData: dbtlPayload?.result ? { passRate: dbtlPayload.result.passRate } : undefined,
  }), [fbaPayload, cethxPayload, dbtlPayload]);
  const bestPathway = pareto.candidates.find(c => c.id === pareto.bestOverall);
  const selectedCatResidue = enzyme.catalyticResidues.find(r => r.position === selectedResidue);
  const mutationImpact = useMemo(() => computeMutationImpact(selectedResidue, selectedMutation, selectedCatResidue, enzyme.sequence, binding.predictedKd), [selectedResidue, selectedMutation, selectedCatResidue, enzyme.sequence, binding.predictedKd]);

  const handleResidueClick = useCallback((data: ResidueClickData) => {
    setSelectedResidue(data.position);
    setSelectedMutation(null);
  }, []);

  /* -- Tool payload sync --------------------------------------------- */
  useEffect(() => {
    if (simError) return;
    setToolPayload('catdes', {
      validity: 'partial',
      toolId: 'catdes',
      targetProduct: analyzeArtifact?.targetProduct || project?.targetProduct || project?.title || 'Target Product',
      sourceArtifactId: analyzeArtifact?.id,
      selectedEnzymeId: enzyme.id,
      selectedEnzymeName: enzyme.name,
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
    binding.overallScore, binding.predictedKd, drain.growthPenalty, drain.isViable,
    drain.recommendation, drain.totalMetabolicDrain, enzyme.id, enzyme.name,
    mutagenesis.sites, project?.targetProduct, project?.title,
    recommendedSeed.designCount, recommendedSeed.requiredFlux,
    sequences.designs, setToolPayload, simError,
  ]);

  /* -- Quality indicators -------------------------------------------- */
  const kdQ = kdQuality(binding.predictedKd);
  const kcatQ = kcatQuality(activeEnzyme.kcat);
  const fitQ = fitQuality(binding.overallScore);

  const CATDES_TABS: ToolTab[] = [
    { id: 'overview', label: 'Overview', accent: THEME.CORAL },
    { id: 'balance', label: 'Pathway Balance', accent: THEME.MINT },
    { id: 'pareto', label: 'Pareto', accent: THEME.LILAC },
    { id: 'inversefold', label: 'Inverse Folding', accent: THEME.LILAC },
    { id: 'expression', label: 'Expression', accent: THEME.MINT },
    { id: 'plasmid', label: 'Plasmid', accent: THEME.APRICOT },
    { id: 'rna', label: 'RNA Engineering', accent: THEME.MINT },
    { id: 'biosensor', label: 'Biosensor', accent: THEME.SKY },
    { id: 'regulatory', label: 'Regulatory', accent: THEME.APRICOT },
  ];

  /* ================================================================
     Render
     ================================================================ */

  return (
    <div style={{
      position: 'relative', display: 'flex', flexDirection: 'column',
      background: `linear-gradient(180deg, ${THEME.PANEL_MUTED} 0%, ${THEME.PANEL_BG} 100%)`,
      fontFamily: THEME.SANS, flex: 1, minHeight: '100%',
    }}>
      {/* ── Custom Header ── */}
      <header
        className="nb-tool-shell__header nb-slide-up"
        style={{
          padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          flexShrink: 0, borderBottom: `1px solid ${THEME.BORDER}`,
          background: THEME.PANEL_MUTED, backdropFilter: 'blur(18px)',
        }}
      >
        <button
          type="button"
          onClick={handleBack}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 28,
            padding: '0 7px', borderRadius: 'var(--nb-radius-md)',
            border: `1px solid ${THEME.BORDER}`, background: THEME.PANEL_GLASS_STRONG,
            color: THEME.LABEL, cursor: 'pointer', fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', flexShrink: 0,
          }}
          title="Back to Tools"
        >
          &larr; Tools
        </button>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 28, padding: '0 8px', borderRadius: 'var(--nb-radius-md)', border: `1px solid ${THEME.BORDER}`, background: 'rgba(231, 199, 169, 0.24)', color: THEME.VALUE, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
          CATDES
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', fontWeight: 700, color: THEME.VALUE, letterSpacing: '-0.01em' }}>
            Catalyst Designer
          </div>
          <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, marginTop: 2 }}>
            Enzyme engineering: binding affinity, sequence design, metabolic drain, Pareto optimization
          </div>
        </div>
        <FrontierEngineBadge engineId="inversefolding" />
        <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.VALUE, padding: '5px 8px', background: THEME.PANEL_GLASS_STRONG, border: `1px solid ${THEME.BORDER}`, borderRadius: 'var(--nb-radius-md)' }}>
          {'Δ'}G_bind = {'Σ'}(group contributions) + solvation
        </div>
      </header>

      {/* ── Error Banners ── */}
      {simError && (
        <div style={{ padding: '4px 16px 0' }}><SimErrorBanner message={simError} /></div>
      )}
      {fs.catdesError && (
        <div style={{ padding: '4px 16px 0' }}><SimErrorBanner message={fs.catdesError} onRetry={() => fs.setCatdesError(null)} /></div>
      )}

      {/* ── Main Split: 55% Left (3D Viewer + Controls) | 45% Right (Sidebar) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '55% 45%', flex: 1, minHeight: 0, borderBottom: `1px solid ${THEME.BORDER}` }}>

        {/* ── LEFT COLUMN: Controls + 3D Viewer ── */}
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: `1px solid ${THEME.BORDER}` }}>
          {/* Compact Controls Bar */}
          <div style={{ padding: '8px 12px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, borderBottom: `1px solid ${THEME.BORDER}`, background: THEME.PANEL_MUTED, flexShrink: 0 }}>
            {/* Enzyme selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xxs)', color: LABEL, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Enzyme</span>
              <select
                value={selectedEnzyme}
                onChange={e => { setSelectedEnzyme(Number(e.target.value)); setSelectedResidue(null); setSelectedMutation(null); }}
                style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', fontWeight: 600, color: VALUE, background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, borderRadius: 6, padding: '3px 6px', cursor: 'pointer', outline: 'none' }}
              >
                {ENZYME_STRUCTURES.map((enz, i) => (
                  <option key={enz.id} value={i}>{enz.name} · EC {enz.ecNumber}</option>
                ))}
              </select>
              {enzyme.id === RATE_LIMITING_ENZYME.id && (
                <span style={{ fontFamily: THEME.MONO, fontSize: '10px', color: THEME.RISK_LOW, background: 'rgba(255,251,31,0.12)', padding: '1px 6px', borderRadius: 6 }}>Rate-limiting</span>
              )}
            </div>
            {/* Render mode */}
            <div style={{ display: 'flex', gap: 2 }}>
              {(['cartoon', 'surface', 'confidence'] as const).map(mode => (
                <button key={mode} onClick={() => setRenderMode(mode)}
                  className={`nb-tool-toggle ${renderMode === mode ? 'nb-tool-toggle--active' : ''}`}
                  style={{ padding: '3px 8px', borderRadius: 4, fontSize: 'var(--nb-fs-xxs)', borderColor: renderMode === mode ? THEME.SKY : undefined, background: renderMode === mode ? 'rgba(175,195,214,0.15)' : undefined, color: renderMode === mode ? THEME.SKY : undefined }}>
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
            {/* Spin toggle */}
            <button onClick={() => setSpinEnabled(!spinEnabled)}
              className={`nb-tool-toggle ${spinEnabled ? 'nb-tool-toggle--active' : ''}`}
              style={{ padding: '3px 8px', borderRadius: 4, fontSize: 'var(--nb-fs-xxs)', borderColor: spinEnabled ? THEME.MINT : undefined, background: spinEnabled ? 'rgba(191,220,205,0.15)' : undefined, color: spinEnabled ? THEME.MINT : undefined }}>
              {spinEnabled ? 'Spin' : 'Spin Off'}
            </button>
            {/* PDB Upload */}
            <div
              style={{ padding: '3px 8px', borderRadius: 4, border: `1px dashed ${fs.uploadedPdb ? THEME.MINT : INPUT_BORDER}`, background: fs.uploadedPdb ? 'rgba(147,203,82,0.06)' : 'transparent', cursor: 'pointer', fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xxs)', color: fs.uploadedPdb ? THEME.MINT : LABEL }}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file'; input.accept = '.pdb';
                input.onchange = async (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (!file) return;
                  try {
                    const text = await file.text();
                    if (text.length < 100) throw new Error('File too small');
                    fs.setUploadedPdb(text); fs.setUploadedPdbName(file.name); fs.setCatdesError(null);
                  } catch (err) { fs.setCatdesError(err instanceof Error ? err.message : 'Failed to read PDB'); }
                };
                input.click();
              }}
            >
              {fs.uploadedPdbName ?? 'Upload PDB'}
            </div>
            {fs.uploadedPdb && (
              <button onClick={() => { fs.setUploadedPdb(null); fs.setUploadedPdbName(null); }}
                style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xxs)', color: THEME.CORAL, background: 'rgba(250,128,114,0.08)', border: `1px solid rgba(250,128,114,0.2)`, borderRadius: 4, padding: '2px 6px', cursor: 'pointer' }}>
                Clear
              </button>
            )}
            {/* ESMFold */}
            <button onClick={fs.handleESMFoldPredict} disabled={fs.esmfoldLoading || !activeEnzyme?.sequence}
              className="nb-tool-toggle"
              style={{ padding: '3px 8px', borderRadius: 4, fontSize: 'var(--nb-fs-xxs)', opacity: fs.esmfoldLoading ? 0.5 : 1 }}>
              {fs.esmfoldLoading ? 'Folding...' : fs.esmfoldPdb ? 'ESMFold Done' : 'ESMFold'}
            </button>
            {/* Docking */}
            <button onClick={fs.handleDocking} disabled={fs.dockingLoading || !enzyme.pdbId}
              className="nb-tool-toggle"
              style={{ padding: '3px 8px', borderRadius: 4, fontSize: 'var(--nb-fs-xxs)', opacity: fs.dockingLoading ? 0.5 : 1 }}>
              {fs.dockingLoading ? 'Docking...' : 'Dock'}
            </button>
          </div>

          {/* 3D Viewer */}
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            <CatalystViewer3D enzyme={enzyme} renderMode={renderMode} spinEnabled={spinEnabled} onResidueClick={handleResidueClick} selectedResidue={selectedResidue} bindingQuality={binding.overallScore} pdbText={fs.uploadedPdb || fs.esmfoldPdb} style={{ height: '100%' }} />
            <InlineMetricOverlay
              position="top-right"
              metrics={[
                { label: 'Kd', value: `${binding.predictedKd.toFixed(1)} uM`, accent: kdQ.color },
                { label: 'Km', value: `${activeEnzyme.km.toFixed(2)} mM`, accent: THEME.SKY },
                { label: 'Kcat', value: `${activeEnzyme.kcat.toFixed(2)} s-1`, accent: kcatQ.color },
                ...(activeEnzyme.km > 0 && activeEnzyme.kcat > 0
                  ? [{ label: 'kcat/Km', value: `${(activeEnzyme.kcat / activeEnzyme.km).toFixed(1)} mM-1s-1`, accent: THEME.MINT }]
                  : []),
                { label: 'Fit', value: binding.overallScore.toFixed(2), accent: fitQ.color },
                { label: 'Tm', value: `${enzyme.meltingTemp.toFixed(0)}C`, accent: THEME.APRICOT },
              ]}
            />
          </div>
        </div>

        {/* ── RIGHT COLUMN: Sidebar ── */}
        <div style={{ minHeight: 0, overflow: 'hidden' }}>
          <CatDesSidebar
            enzyme={enzyme}
            activeEnzyme={activeEnzyme}
            brendaData={fs.brendaData}
            brendaSource={fs.brendaSource}
            binding={binding}
            dockingResult={fs.dockingResult}
            selectedResidue={selectedResidue}
            selectedCatResidue={selectedCatResidue ?? null}
            selectedMutation={selectedMutation}
            onMutationChange={setSelectedMutation}
            mutationImpact={mutationImpact ? { deltaG: mutationImpact.deltaG, newKd: mutationImpact.newKd, confidence: mutationImpact.confidence } : null}
          />
        </div>
      </div>

      {/* ── Algorithm Transparency (collapsible above tabs) ── */}
      <div style={{ padding: '8px 16px', flexShrink: 0 }}>
        <AlgorithmPanel
          name="Enzyme Design Pipeline"
          description="Combines binding affinity estimation (deltaG decomposition), sequence optimization (CAI + codon harmonization), and mutagenesis targeting. Uses BLOSUM62 substitution matrices and energy-based screening."
          assumptions={[
            'Lock-and-key binding model (rigid body)',
            'Additive free energy contributions per residue',
            'CAI reflects translation efficiency',
            'BLOSUM62 captures evolutionary conservation',
            'Single-point mutations only (no epistasis)',
          ]}
          limitations={[
            'No molecular dynamics simulation',
            'Simplified solvation model',
            'No allosteric effects considered',
            'Requires experimental validation of predictions',
          ]}
          citation={{
            authors: 'Kortemme T, Baker D',
            title: 'A simple physical model for binding energy hot spots in protein-protein complexes',
            journal: 'Proc Natl Acad Sci USA',
            year: 2002,
            doi: '10.1073/pnas.202485799',
          }}
        />
      </div>

      {/* ── Tab Bar ── */}
      <ToolTabBar tabs={CATDES_TABS} activeId={activeTab} onChange={setActiveTab} />

      {/* ── Overview Tab ── */}
      <ToolTabPanel tabId="overview" activeId={activeTab}>
        <CatDesOverviewTab
          enzyme={enzyme}
          binding={binding}
          sequences={sequences}
          drain={drain}
          balance={balance}
          pareto={pareto}
          mutagenesis={mutagenesis}
          bottlenecks={bottlenecks}
          bestPathway={bestPathway}
          kdQ={kdQ}
          kcatQ={kcatQ}
          fitQ={fitQ}
          activeEnzyme={activeEnzyme}
        />
      </ToolTabPanel>

      {/* ── Pathway Balance Tab ── */}
      <ToolTabPanel tabId="balance" activeId={activeTab}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          <div style={{ ...GLASS, borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: 8 }}>
              <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Pathway Balance (Newton-Raphson)
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                <MetricCard label="Converged" value={balance.isBalanced ? 'Yes' : 'No'} />
                <MetricCard label="Objective" value={balance.objectiveValue.toFixed(4)} />
                <MetricCard label="Iterations" value={String(balance.iterations)} />
                <MetricCard label="Toxicity" value={balance.toxicIntermediates.length > 0 ? '⚠ Flagged' : '✓ OK'} />
              </div>
            </div>
          </div>
        </div>
      </ToolTabPanel>

      {/* ── Pareto Tab ── */}
      <ToolTabPanel tabId="pareto" activeId={activeTab}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          <div style={{ ...GLASS, borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: 8 }}><ParetoView result={pareto} /></div>
          </div>
        </div>
      </ToolTabPanel>

      {/* ── Inverse Folding Tab ── */}
      <ToolTabPanel tabId="inversefold" activeId={activeTab}>
        <CatDesInverseFoldingTab
          invFoldSeqCount={fs.invFoldSeqCount}
          setInvFoldSeqCount={fs.setInvFoldSeqCount}
          invFoldTemp={fs.invFoldTemp}
          setInvFoldTemp={fs.setInvFoldTemp}
          invFoldLoading={fs.invFoldLoading}
          invFoldResult={fs.invFoldResult}
          handleInverseFolding={fs.handleInverseFolding}
        />
      </ToolTabPanel>

      {/* ── Expression Prediction Tab ── */}
      <ToolTabPanel tabId="expression" activeId={activeTab}>
        <CatDesExpressionTab
          exprResult={fs.exprResult}
          exprLoading={fs.exprLoading}
          exprPromoter={fs.exprPromoter}
          setExprPromoter={fs.setExprPromoter}
          exprRbs={fs.exprRbs}
          setExprRbs={fs.setExprRbs}
          exprTerminator={fs.exprTerminator}
          setExprTerminator={fs.setExprTerminator}
          handleExpressionPrediction={fs.handleExpressionPrediction}
        />
      </ToolTabPanel>

      {/* ── Plasmid Design Tab ── */}
      <ToolTabPanel tabId="plasmid" activeId={activeTab}>
        <CatDesPlasmidTab
          plasmidResult={fs.plasmidResult}
          plasmidLoading={fs.plasmidLoading}
          plasmidHost={fs.plasmidHost}
          setPlasmidHost={fs.setPlasmidHost}
          expressionLevel={fs.expressionLevel}
          setExpressionLevel={fs.setExpressionLevel}
          assemblyMethod={fs.assemblyMethod}
          setAssemblyMethod={fs.setAssemblyMethod}
          copyNumber={fs.copyNumber}
          setCopyNumber={fs.setCopyNumber}
          handlePlasmidDesign={fs.handlePlasmidDesign}
        />
      </ToolTabPanel>

      {/* ── RNA Engineering Tab ── */}
      <ToolTabPanel tabId="rna" activeId={activeTab}>
        <CatDesRNATab
          rnaDesignType={fs.rnaDesignType}
          setRnaDesignType={fs.setRnaDesignType}
          rnaTargetSeq={fs.rnaTargetSeq}
          setRnaTargetSeq={fs.setRnaTargetSeq}
          rnaMaxLength={fs.rnaMaxLength}
          setRnaMaxLength={fs.setRnaMaxLength}
          rnaResult={fs.rnaResult}
          rnaLoading={fs.rnaLoading}
          handleRNADesign={fs.handleRNADesign}
        />
      </ToolTabPanel>

      {/* ── Biosensor Design Tab ── */}
      <ToolTabPanel tabId="biosensor" activeId={activeTab}>
        <CatDesBiosensorTab
          bioResult={fs.bioResult}
          bioLoading={fs.bioLoading}
          bioTargetLigand={fs.bioTargetLigand}
          setBioTargetLigand={fs.setBioTargetLigand}
          bioDynamicRange={fs.bioDynamicRange}
          setBioDynamicRange={fs.setBioDynamicRange}
          bioSensitivity={fs.bioSensitivity}
          setBioSensitivity={fs.setBioSensitivity}
          bioHost={fs.bioHost}
          setBioHost={fs.setBioHost}
          handleBiosensorDesign={fs.handleBiosensorDesign}
        />
      </ToolTabPanel>

      {/* ── Regulatory Design Tab ── */}
      <ToolTabPanel tabId="regulatory" activeId={activeTab}>
        <CatDesRegulatoryTab
          regResult={fs.regResult}
          regLoading={fs.regLoading}
          regTargetStrength={fs.regTargetStrength}
          setRegTargetStrength={fs.setRegTargetStrength}
          regHost={fs.regHost}
          setRegHost={fs.setRegHost}
          regCodonOptimize={fs.regCodonOptimize}
          setRegCodonOptimize={fs.setRegCodonOptimize}
          handleRegulatoryDesign={fs.handleRegulatoryDesign}
        />
      </ToolTabPanel>

      {/* ── Footer ── */}
      <div style={{ padding: '8px 16px', display: 'flex', gap: 8, flexShrink: 0, borderTop: `1px solid ${THEME.BORDER}`, background: THEME.PANEL_MUTED }}>
        <ExportButton label="Export JSON"
          data={{ enzyme: enzyme.id, binding, sequences, drain, balance, pareto, mutagenesis, docking: fs.dockingResult }}
          filename="catalyst-design" format="json" />
        <ExportButton label="Export CSV"
          data={sequences.designs} filename="catalyst-sequences" format="csv" />
      </div>

      <NextStepButton currentStepId="catdes" />
    </div>
  );
});
