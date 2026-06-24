'use client';
import React from 'react';
import { THEME } from '../../theme';
import { toolTokens } from '../../hooks/useToolTheme';
import SimErrorBanner from '../ide/shared/SimErrorBanner';
import ExportButton from '../ide/shared/ExportButton';
import DataSourceBadge from '../ide/shared/DataSourceBadge';
import WorkflowStepper from './shared/WorkflowStepper';
import ResultSummaryPanel from './shared/ResultSummaryPanel';
import ScientificHero from './shared/ScientificHero';
import ToolShell from './shared/ToolShell';
import ToolTabPanel from './shared/ToolTabPanel';
import { MLPredictPanel } from './multio/MLPredictPanel';
import { MultiOEmbeddingTab } from './multio/MultiOEmbeddingTab';
import { MultiOMOFATab } from './multio/MultiOMOFATab';
import { MultiOFluxomicsTab } from './multio/MultiOFluxomicsTab';
import { MultiOMfa13cTab } from './multio/MultiOMfa13cTab';
import { MultiOVolcanoTab, MultiOFactorsTab, MultiOProjectionTab, MultiOEfficiencyTab } from './multio/MultiOSmallTabs';
import { MULTIO_TABS, LAYER_COLORS } from './multio/multiOHelpers';
import { useMultiOState } from './multio/useMultiOState';

const { label: LABEL } = toolTokens;

export default React.memo(function MultiOPage() {
  const s = useMultiOState();

  return (
    <ToolShell
      moduleId="multio"
      title="Deterministic Multi-Omics Integration"
      formula="z-score + ALS factors + linear projection | sensitivity Δ"
      tabs={MULTIO_TABS}
      activeTab={s.activeTab}
      onTabChange={s.setActiveTab}
      advancedTabIds={['factors', 'mofaplus', 'projection', 'efficiency', 'fluxomics', 'mfa13c']}
      hero={
        <ScientificHero
            eyebrow="Stage 4 · Deterministic Multi-Omics Demo"
            title="Result-centered omics synthesis instead of isolated plots"
            summary="MULTIO behaves as an exploratory integration surface: significant genes, deterministic layer signals, sensitivity sketches, and efficiency context sit above the visualization layer without claiming posterior uncertainty or a reference-model backend."
            aside={
              <>
                <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.LABEL, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Current analytical lens
                </div>
                <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.VALUE, fontWeight: 700 }}>
                  {MULTIO_TABS.find(t => t.id === s.activeTab)?.label ?? 'Embedding'} · {Object.values(s.activeLayers).filter(Boolean).length}/3 omics layers active
                </div>
                <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.LABEL, lineHeight: 1.55 }}>
                  The current lens is anchored to {s.analyzeArtifact?.targetProduct ?? s.project?.targetProduct ?? s.project?.title ?? 'the active project object'}, so bottleneck claims stay attached to the same scientific context.
                </div>
              </>
            }
            signals={[
              {
                label: 'Significant Signals',
                value: `${s.significant.length}`,
                detail: `${s.upregulated} upregulated · ${s.downregulated} downregulated under current thresholds`,
                tone: s.significant.length > 12 ? 'warm' : 'cool',
              },
              {
                label: 'Dominant Layer',
                value: s.bottleneck.dominant_layer,
                detail: `Deterministic score ${(s.bottleneck.confidence * 100).toFixed(0)}% for the leading bottleneck interpretation`,
                tone: 'cool',
              },
              {
                label: 'Lead Gene',
                value: s.significant[0]?.gene ?? s.selectedGene,
                detail: s.perturbResult
                  ? `Sensitivity sketch estimates ${s.perturbResult.predicted_yield_change_percent >= 0 ? '+' : ''}${s.perturbResult.predicted_yield_change_percent.toFixed(1)}% demo yield shift`
                  : 'Use the sensitivity sketch to explore how omics signals might relate to pathway context.',
                tone: s.perturbResult && s.perturbResult.predicted_yield_change_percent < 0 ? 'alert' : 'neutral',
              },
              {
                label: 'Best Efficiency Score',
                value: `${Math.max(...s.efficiencyScores.map((entry) => entry.score)).toFixed(2)}`,
                detail: 'Efficiency scores let omics interpretation stay tied to production relevance, not just statistical significance.',
                tone: 'neutral',
              },
            ]}
          />
      }
      footer={
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <DataSourceBadge source={s.dataSource === 'uploaded' ? 'live' : 'mock'} label={s.dataSource === 'uploaded' ? 'User CSV' : 'Demo Data'} />
          <input ref={s.fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={s.handleFileUpload} />
          <button
            onClick={() => s.fileInputRef.current?.click()}
            style={{
              padding: '4px 10px', borderRadius: 6, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)',
              background: s.dataSource === 'uploaded' ? 'rgba(191,220,205,0.14)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${s.dataSource === 'uploaded' ? 'rgba(191,220,205,0.3)' : 'rgba(255,255,255,0.08)'}`,
              color: s.dataSource === 'uploaded' ? 'rgba(191,220,205,0.9)' : 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
            }}
          >
            {s.dataSource === 'uploaded' ? `✓ ${s.activeData.length} genes loaded` : 'Upload CSV'}
          </button>
          {s.dataSource === 'uploaded' && (
            <button
              onClick={() => s.setUploadedData(null)}
              style={{
                padding: '4px 8px', borderRadius: 6, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)',
                background: 'rgba(232,163,161,0.1)', border: '1px solid rgba(232,163,161,0.2)',
                color: 'rgba(232,163,161,0.7)', cursor: 'pointer',
              }}
            >
              Reset to demo
            </button>
          )}
          <div style={{ flex: 1 }} />
          <ExportButton label="Export All CSV" data={s.activeData} filename="multio-all" format="csv" />
          <ExportButton label="Export Significant JSON" data={s.significant} filename="multio-significant" format="json" />
        </div>
      }
    >
      {s.simError && (
        <div style={{ padding: '0 16px 8px' }}><SimErrorBanner message={s.simError} /></div>
      )}
      {s.multioError && (
        <div style={{ padding: '0 16px 8px' }}><SimErrorBanner message={s.multioError} onRetry={() => s.setMultioError(null)} /></div>
      )}

      {/* Workflow Stepper */}
      <div style={{ padding: '0 16px 4px' }}>
        <WorkflowStepper steps={s.workflowSteps} activeIndex={s.workflowSteps.findIndex(st => st.status === 'active')} />
      </div>

      {/* Result Summary Panel */}
      <div style={{ padding: '0 16px 8px' }}>
        <ResultSummaryPanel
          metrics={[
            { label: 'Samples', value: s.activeData.length, accent: THEME.SKY },
            { label: 'Clusters', value: s.mofaResult.factors.length, accent: THEME.LILAC },
            { label: 'Var. Explained', value: `${(s.mofaResult.totalVarianceExplained * 100).toFixed(1)}%`, unit: '', accent: THEME.MINT },
            { label: 'Significant', value: s.significant.length, accent: THEME.APRICOT, trend: s.significant.length > 10 ? 'up' : 'flat' },
          ]}
        />
      </div>

      {/* ── Embedding Tab ── */}
      <MultiOEmbeddingTab
        activeTab={s.activeTab}
        filtered={s.filtered}
        embeddings={s.embeddings}
        bottleneck={s.bottleneck}
        significant={s.significant}
        activeLayers={s.activeLayers}
        selectedGene={s.selectedGene}
        setSelectedGene={s.setSelectedGene}
        geneNames={s.geneNames}
        showTranscript={s.showTranscript}
        setShowTranscript={s.setShowTranscript}
        showProtein={s.showProtein}
        setShowProtein={s.setShowProtein}
        showMetabolite={s.showMetabolite}
        setShowMetabolite={s.setShowMetabolite}
        fcThreshold={s.fcThreshold}
        setFcThreshold={s.setFcThreshold}
        pvThreshold={s.pvThreshold}
        setPvThreshold={s.setPvThreshold}
        perturbedExpr={s.perturbedExpr}
        setPerturbedExpr={s.setPerturbedExpr}
        handleSimulate={s.handleSimulate}
        perturbResult={s.perturbResult}
        vaeResult={s.vaeResult}
        vaeLoading={s.vaeLoading}
        vaeError={s.vaeError}
      />

      {/* ── Volcano Tab ── */}
      <MultiOVolcanoTab
        activeTab={s.activeTab}
        filtered={s.filtered}
        selectedGene={s.selectedGene}
        setSelectedGene={s.setSelectedGene}
        geneNames={s.geneNames}
        fcThreshold={s.fcThreshold}
        setFcThreshold={s.setFcThreshold}
        pvThreshold={s.pvThreshold}
        setPvThreshold={s.setPvThreshold}
        significant={s.significant}
        upregulated={s.upregulated}
        downregulated={s.downregulated}
      />

      {/* ── Factors Tab ── */}
      <MultiOFactorsTab
        activeTab={s.activeTab}
        mofaResult={s.mofaResult}
        scspatialPayload={s.scspatialPayload}
      />

      {/* ── MOFA+ Tab ── */}
      <MultiOMOFATab
        activeTab={s.activeTab}
        activeData={s.activeData}
        mofaPlusResult={s.mofaPlusResult}
        mofaPlusLoading={s.mofaPlusLoading}
        handleRunMOFA={s.handleRunMOFA}
        pipelineResult={s.pipelineResult}
        setPipelineResult={s.setPipelineResult}
        pipelineLoading={s.pipelineLoading}
        setPipelineLoading={s.setPipelineLoading}
        pipelineError={s.pipelineError}
        setPipelineError={s.setPipelineError}
        fcThreshold={s.fcThreshold}
        pvThreshold={s.pvThreshold}
        activeLayers={s.activeLayers}
      />

      {/* ── Projection Tab ── */}
      <MultiOProjectionTab
        activeTab={s.activeTab}
        vaeResult={s.vaeResult}
        vaeLoading={s.vaeLoading}
        vaeError={s.vaeError}
      />

      {/* ── Efficiency Tab ── */}
      <MultiOEfficiencyTab
        activeTab={s.activeTab}
        efficiencyScores={s.efficiencyScores}
      />

      {/* ── ML Predict Tab ── */}
      <ToolTabPanel tabId="mlpredict" activeId={s.activeTab}>
        <MLPredictPanel />
      </ToolTabPanel>

      {/* ── Fluxomics Tab ── */}
      <MultiOFluxomicsTab
        activeTab={s.activeTab}
        fluxomicsResult={s.fluxomicsResult}
        fluxomicsLoading={s.fluxomicsLoading}
        handleRunFluxomics={s.handleRunFluxomics}
      />

      {/* ── 13C-MFA Tab ── */}
      <MultiOMfa13cTab
        activeTab={s.activeTab}
        mfa13cResult={s.mfa13cResult}
        mfa13cLoading={s.mfa13cLoading}
        mfa13cMCResult={s.mfa13cMCResult}
        mfa13cMCTrials={s.mfa13cMCTrials}
        setMfa13cMCTrials={s.setMfa13cMCTrials}
        handleRunMFA13C={s.handleRunMFA13C}
      />
    </ToolShell>
  );
});
