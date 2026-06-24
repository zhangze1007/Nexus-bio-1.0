'use client';
import React from 'react';
import { THEME } from '../../../theme';
import { toolTokens } from '../../../hooks/useToolTheme';
import type { OmicsRow, OmicsLayer, EmbeddingPoint, BottleneckSignal, PerturbationResult } from '../../../types';
import type { VAETrainingResult } from '../../../services/MOIEngine';
import { LAYER_COLORS, SectionLabel } from './multiOHelpers';
import { TriPanelEmbedding } from './TriPanelEmbedding';
import ToolTabPanel from '../shared/ToolTabPanel';
import FloatingControlRail from '../shared/FloatingControlRail';
import ScientificFigureFrame from '../shared/ScientificFigureFrame';
import InlineMetricOverlay from '../shared/InlineMetricOverlay';
import WorkbenchRangeSlider from '../shared/WorkbenchRangeSlider';
import ActionButton from '../shared/ActionButton';

const { inputBg: INPUT_BG, inputBorder: INPUT_BORDER, inputText: INPUT_TEXT, label: LABEL, value: VALUE, glass: GLASS } = toolTokens;

interface EmbeddingTabProps {
  activeTab: string;
  filtered: OmicsRow[];
  embeddings: EmbeddingPoint[];
  bottleneck: BottleneckSignal;
  significant: OmicsRow[];
  activeLayers: Record<OmicsLayer, boolean>;
  selectedGene: string;
  setSelectedGene: (v: string) => void;
  geneNames: string[];
  showTranscript: boolean;
  setShowTranscript: (v: boolean) => void;
  showProtein: boolean;
  setShowProtein: (v: boolean) => void;
  showMetabolite: boolean;
  setShowMetabolite: (v: boolean) => void;
  fcThreshold: number;
  setFcThreshold: (v: number) => void;
  pvThreshold: number;
  setPvThreshold: (v: number) => void;
  perturbedExpr: number;
  setPerturbedExpr: (v: number) => void;
  handleSimulate: () => void;
  perturbResult: PerturbationResult | null;
  vaeResult: VAETrainingResult | null;
  vaeLoading: boolean;
  vaeError: string | null;
}

export function MultiOEmbeddingTab(props: EmbeddingTabProps) {
  const {
    activeTab, filtered, embeddings, bottleneck, significant, activeLayers,
    selectedGene, setSelectedGene, geneNames,
    showTranscript, setShowTranscript, showProtein, setShowProtein, showMetabolite, setShowMetabolite,
    fcThreshold, setFcThreshold, pvThreshold, setPvThreshold,
    perturbedExpr, setPerturbedExpr, handleSimulate, perturbResult,
    vaeResult, vaeLoading, vaeError,
  } = props;

  return (
    <ToolTabPanel tabId="embedding" activeId={activeTab}>
      <div style={{ display: 'flex', gap: '0', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <FloatingControlRail label="Omics Controls">
          {/* VAE Parameters */}
          <div style={{ marginBottom: '12px' }}>
            <SectionLabel>VAE Parameters</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Latent Dim</span>
                <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE, fontWeight: 700 }}>{vaeResult?.latentDim ?? 8}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>ELBO</span>
                <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: VALUE, fontWeight: 700 }}>{vaeResult?.elbo?.toFixed(3) ?? '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Status</span>
                <span style={{
                  fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', fontWeight: 700,
                  color: vaeLoading ? THEME.APRICOT : vaeError ? THEME.CORAL : THEME.MINT,
                }}>
                  {vaeLoading ? 'Training...' : vaeError ? 'Error' : 'Ready'}
                </span>
              </div>
            </div>
          </div>

          {/* Data Layers */}
          <SectionLabel>Data Layers</SectionLabel>
          {([
            { label: 'Transcriptomics', layer: 'transcriptomics' as OmicsLayer, val: showTranscript, set: setShowTranscript },
            { label: 'Proteomics',      layer: 'proteomics' as OmicsLayer,      val: showProtein,    set: setShowProtein },
            { label: 'Metabolomics',    layer: 'metabolomics' as OmicsLayer,    val: showMetabolite, set: setShowMetabolite },
          ]).map(({ label, layer, val, set }) => (
            <button aria-label={`Toggle ${label} layer`} key={label} onClick={() => set(!val)}
              className={`nb-tool-toggle ${val ? 'nb-tool-toggle--active' : ''}`}
              style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              width: '100%', padding: '7px 10px', marginBottom: '6px',
              background: val ? 'rgba(175,195,214,0.22)' : undefined,
              borderColor: val ? 'rgba(175,195,214,0.34)' : undefined,
              borderRadius: 'var(--nb-radius-sm)',
              color: val ? INPUT_TEXT : undefined,
              textAlign: 'left',
            }}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: val ? LAYER_COLORS[layer] : 'transparent',
                border: `1.5px solid ${LAYER_COLORS[layer]}`, flexShrink: 0,
              }} />
              {label}
            </button>
          ))}

          {/* Thresholds */}
          <SectionLabel>Thresholds</SectionLabel>
          <WorkbenchRangeSlider label="|FC| >" value={fcThreshold} min={0.5} max={5} step={0.1} formatValue={v => v.toFixed(1)} onChange={setFcThreshold} />
          <WorkbenchRangeSlider label="p <" value={pvThreshold} min={0.001} max={0.1} step={0.001} formatValue={v => v.toFixed(3)} onChange={setPvThreshold} />

          {/* Sensitivity sketch */}
          <SectionLabel>Sensitivity Sketch</SectionLabel>
          <select
            value={selectedGene}
            onChange={e => setSelectedGene(e.target.value)}
            style={{
              width: '100%', padding: '6px 8px', marginBottom: '8px',
              background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, borderRadius: 'var(--nb-radius-sm)',
              color: INPUT_TEXT, fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)',
              outline: '2px solid rgba(175,195,214,0.5)', outlineOffset: '2px', appearance: 'auto' as React.CSSProperties['appearance'],
            }}
          >
            {geneNames.map(g => (
              <option key={g} value={g} style={{ background: THEME.BG_PANEL }}>{g}</option>
            ))}
          </select>
          <WorkbenchRangeSlider label="Expression" value={perturbedExpr} min={-4} max={8} step={0.1} formatValue={v => v.toFixed(1)} onChange={setPerturbedExpr} />
          <ActionButton
            variant="primary"
            size="sm"
            aria-label="Run sensitivity analysis"
            onClick={handleSimulate}
            style={{ width: '100%' }}
          >
            Run Sensitivity
          </ActionButton>

          {/* Sensitivity Results */}
          {perturbResult && (
            <div style={{ marginTop: '14px' }}>
              <SectionLabel>Sensitivity Result</SectionLabel>
              <div style={{
                ...GLASS, borderRadius: 'var(--nb-radius-md)', padding: '10px', marginBottom: '10px',
              }}>
                {/* Yield change */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL }}>Demo Yield Δ</span>
                  <span style={{
                    fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-sm)', fontWeight: 700,
                    color: perturbResult.predicted_yield_change_percent >= 0
                      ? THEME.MINT : THEME.CORAL,
                  }}>
                    {perturbResult.predicted_yield_change_percent >= 0 ? '+' : ''}
                    {perturbResult.predicted_yield_change_percent.toFixed(1)}%
                  </span>
                </div>
                {/* Metabolite shifts */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                  {perturbResult.metabolite_shifts.map(ms => (
                    <span key={ms.metabolite} style={{
                      fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', padding: '2px 6px', borderRadius: '6px',
                      background: ms.direction === 'up' ? `${THEME.MINT}26` : `${THEME.CORAL}26`,
                      color: ms.direction === 'up' ? `${THEME.MINT}E6` : `${THEME.CORAL}E6`,
                      border: `1px solid ${ms.direction === 'up' ? `${THEME.MINT}33` : `${THEME.CORAL}33`}`,
                    }}>
                      {ms.metabolite} {ms.direction === 'up' ? '↑' : '↓'}{Math.abs(ms.delta).toFixed(1)}
                    </span>
                  ))}
                </div>
                {/* Reasoning chain */}
                {perturbResult.reasoning_chain.map((step, i) => (
                  <div key={i} style={{
                    padding: '4px 0',
                    borderTop: i > 0 ? `1px solid ${THEME.PANEL_BORDER}` : 'none',
                  }}>
                    <span style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: LAYER_COLORS.proteomics }}>
                      {i + 1}. {step.step}
                    </span>
                    <p style={{
                      fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)', color: LABEL,
                      margin: '2px 0 0', lineHeight: '1.35',
                    }}>
                      {step.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </FloatingControlRail>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, padding: '16px', overflow: 'auto' }}>
          <ScientificFigureFrame
            eyebrow="Cross-Layer Projection"
            title="Transcript, protein, and metabolite structure aligned in one figure field"
            caption="Deterministic projection first, bottleneck signal second, and pathway relevance always visible."
            minHeight="100%"
            legend={[
              { label: 'Bottleneck', value: bottleneck.dominant_layer, accent: LAYER_COLORS[bottleneck.dominant_layer] },
              { label: 'Gene', value: selectedGene, accent: THEME.LILAC },
              { label: 'Significant', value: `${significant.length}`, accent: THEME.MINT },
            ]}
          >
              <div style={{ minHeight: '520px', overflow: 'auto' }}>
                <TriPanelEmbedding
                  embeddings={embeddings}
                  data={filtered}
                  fcThreshold={fcThreshold}
                  pvThreshold={pvThreshold}
                  activeLayers={activeLayers}
                  highlightedGene={selectedGene}
                />
              </div>
          </ScientificFigureFrame>
          <InlineMetricOverlay
            position="top-right"
            metrics={[
              { label: 'Bottleneck', value: bottleneck.dominant_layer, accent: THEME.SKY },
              { label: 'Gene', value: selectedGene, accent: THEME.LILAC },
              { label: 'Significant', value: `${significant.length}`, accent: THEME.MINT },
            ]}
          />
        </div>
      </div>
    </ToolTabPanel>
  );
}
