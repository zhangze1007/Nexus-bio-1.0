'use client';
import { useState, useMemo, useCallback } from 'react';
import IDEShell from '../ide/IDEShell';
import AlgorithmInsight from '../ide/shared/AlgorithmInsight';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import DataTable from '../ide/shared/DataTable';
import type { TableColumn } from '../ide/shared/DataTable';
import { OMICS_DATA } from '../../data/mockMultiO';
import { OmicsFoundationModel } from '../../services/OmicsIntegrator';
import type {
  OmicsRow,
  OmicsLayer,
  EmbeddingPoint,
  BottleneckSignal,
  PerturbationResult,
  InternalThought,
} from '../../types';

/* ── Design Tokens ────────────────────────────────────────────────── */

const MONO = "'JetBrains Mono','Fira Code',monospace";
const SANS = "'Inter',-apple-system,sans-serif";

const LAYER_COLORS: Record<OmicsLayer, string> = {
  transcriptomics: '#DBCDF0',
  proteomics:      '#C6DEF1',
  metabolomics:    '#F2C6DE',
};

const PANEL_BG = '#10131a';
const BORDER = 'rgba(255,255,255,0.06)';
const LABEL = 'rgba(255,255,255,0.28)';
const VALUE = 'rgba(255,255,255,0.65)';
const INPUT_BG = 'rgba(255,255,255,0.05)';
const INPUT_BORDER = 'rgba(255,255,255,0.08)';
const INPUT_TEXT = 'rgba(255,255,255,0.7)';

const GLASS: React.CSSProperties = {
  borderRadius: '24px',
  backdropFilter: 'blur(10px)',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
};

type ViewMode = 'Embedding' | 'Volcano' | 'Table';

/* ── VolcanoPlot (preserved) ──────────────────────────────────────── */

function VolcanoPlot({ data, fcThreshold, pvThreshold }: {
  data: OmicsRow[]; fcThreshold: number; pvThreshold: number;
}) {
  const W = 360, H = 300, PAD = 36;
  const fcMax = 6, pvMax = 5;

  function xPos(fc: number) { return PAD + ((fc + fcMax) / (fcMax * 2)) * (W - PAD * 2); }
  function yPos(pv: number) { return H - PAD - (Math.min(Math.max(0, -Math.log10(Math.max(pv, 1e-5))), pvMax) / pvMax) * (H - PAD * 2); }

  const pvLine = H - PAD - (-Math.log10(pvThreshold) / pvMax) * (H - PAD * 2);
  const fcLineL = xPos(-fcThreshold);
  const fcLineR = xPos(fcThreshold);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={H} fill="#0d0f14" />
      <line x1={PAD} y1={pvLine} x2={W - PAD} y2={pvLine}
        stroke="rgba(255,255,255,0.12)" strokeWidth={1} strokeDasharray="4 3" />
      <line x1={fcLineL} y1={PAD} x2={fcLineL} y2={H - PAD}
        stroke="rgba(255,255,255,0.08)" strokeWidth={1} strokeDasharray="4 3" />
      <line x1={fcLineR} y1={PAD} x2={fcLineR} y2={H - PAD}
        stroke="rgba(255,255,255,0.08)" strokeWidth={1} strokeDasharray="4 3" />
      {data.map(row => {
        const fc = row.fold_change ?? 0;
        const pv = row.pValue ?? 1;
        const sig = pv < pvThreshold && Math.abs(fc) > fcThreshold;
        const up = fc > 0;
        const color = sig
          ? (up ? 'rgba(120,220,180,0.85)' : 'rgba(255,100,100,0.85)')
          : 'rgba(255,255,255,0.18)';
        return (
          <circle key={row.id}
            cx={xPos(fc)} cy={yPos(pv)} r={sig ? 4 : 2.5}
            fill={color}>
            <title>{row.gene}: FC={fc.toFixed(2)}, p={pv.toFixed(4)}</title>
          </circle>
        );
      })}
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="rgba(255,255,255,0.1)" />
      <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="rgba(255,255,255,0.1)" />
      <text x={W / 2} y={H - 4} textAnchor="middle" fontFamily={MONO} fontSize="8" fill="rgba(255,255,255,0.25)">
        log₂ Fold Change
      </text>
      <text x={10} y={H / 2} textAnchor="middle" fontFamily={MONO} fontSize="8" fill="rgba(255,255,255,0.25)"
        transform={`rotate(-90,10,${H / 2})`}>
        -log₁₀(p)
      </text>
      <text x={W - PAD} y={H - PAD + 12} textAnchor="end" fontFamily={MONO} fontSize="7" fill="rgba(255,255,255,0.2)">+{fcMax}</text>
      <text x={PAD} y={H - PAD + 12} textAnchor="start" fontFamily={MONO} fontSize="7" fill="rgba(255,255,255,0.2)">-{fcMax}</text>
    </svg>
  );
}

/* ── DataTable COLUMNS (preserved) ────────────────────────────────── */

const COLUMNS: TableColumn<OmicsRow>[] = [
  { key: 'gene',        header: 'Gene',        width: 80  },
  { key: 'transcript',  header: 'RNA',         width: 55, render: v => typeof v === 'number' ? v.toFixed(1) : '—' },
  { key: 'protein',     header: 'Prot.',       width: 55, render: v => typeof v === 'number' ? v.toFixed(1) : '—' },
  { key: 'metabolite',  header: 'Met.',        width: 55, render: v => typeof v === 'number' ? v.toFixed(1) : '—' },
  { key: 'fold_change', header: 'FC',          width: 55, render: v => typeof v === 'number'
    ? <span style={{ color: (v as number) > 0 ? 'rgba(120,220,180,0.85)' : 'rgba(255,100,100,0.8)', fontFamily: "'JetBrains Mono',monospace", fontSize: '10px' }}>
        {(v as number) > 0 ? '+' : ''}{(v as number).toFixed(2)}
      </span>
    : '—'
  },
  { key: 'pValue',      header: 'p-val',       width: 60, render: v => typeof v === 'number'
    ? <span style={{ color: (v as number) < 0.05 ? 'rgba(255,200,80,0.85)' : 'rgba(255,255,255,0.35)', fontFamily: "'JetBrains Mono',monospace", fontSize: '10px' }}>
        {(v as number).toFixed(3)}
      </span>
    : '—'
  },
];

/* ── 3D→2D Embedding Scatter (SVG) ───────────────────────────────── */

function EmbeddingScatter({ embeddings, fcThreshold, activeLayers }: {
  embeddings: EmbeddingPoint[];
  fcThreshold: number;
  activeLayers: Record<OmicsLayer, boolean>;
}) {
  const W = 520, H = 420, PAD = 44;

  const visible = useMemo(
    () => embeddings.filter(p => activeLayers[p.layer]),
    [embeddings, activeLayers],
  );

  const projected = useMemo(() => {
    const pts = visible.map(p => ({
      ...p,
      px: p.coords[0] * 0.866 - p.coords[2] * 0.866,
      py: -p.coords[1] + p.coords[0] * 0.5 + p.coords[2] * 0.5,
    }));
    if (pts.length === 0) return [];
    const xs = pts.map(p => p.px);
    const ys = pts.map(p => p.py);
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const yMin = Math.min(...ys), yMax = Math.max(...ys);
    const xRange = xMax - xMin || 1;
    const yRange = yMax - yMin || 1;
    return pts.map(p => ({
      ...p,
      sx: PAD + ((p.px - xMin) / xRange) * (W - PAD * 2),
      sy: PAD + ((p.py - yMin) / yRange) * (H - PAD * 2),
    }));
  }, [visible, W, H]);

  const geneFC = useMemo(() => {
    const map: Record<string, number> = {};
    OMICS_DATA.forEach(r => { map[r.gene] = Math.abs(r.fold_change ?? 0); });
    return map;
  }, []);

  const GRID_COUNT = 8;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={H} fill="#0d0f14" rx={12} />
      {/* Grid */}
      {Array.from({ length: GRID_COUNT + 1 }).map((_, i) => {
        const x = PAD + (i / GRID_COUNT) * (W - PAD * 2);
        const y = PAD + (i / GRID_COUNT) * (H - PAD * 2);
        return (
          <g key={i}>
            <line x1={x} y1={PAD} x2={x} y2={H - PAD} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
            <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
          </g>
        );
      })}
      {/* Axes */}
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="rgba(255,255,255,0.1)" />
      <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="rgba(255,255,255,0.1)" />
      <text x={W / 2} y={H - 6} textAnchor="middle" fontFamily={MONO} fontSize="8" fill={LABEL}>
        UMAP-1 (projected)
      </text>
      <text x={12} y={H / 2} textAnchor="middle" fontFamily={MONO} fontSize="8" fill={LABEL}
        transform={`rotate(-90,12,${H / 2})`}>
        UMAP-2 (projected)
      </text>
      {/* Points */}
      {projected.map(p => {
        const sig = (geneFC[p.gene] ?? 0) > fcThreshold;
        return (
          <circle
            key={p.id}
            cx={p.sx}
            cy={p.sy}
            r={sig ? 6 : 4}
            fill={LAYER_COLORS[p.layer]}
            opacity={sig ? 1.0 : 0.7}
            style={{ transition: 'opacity 0.2s' }}
          >
            <title>{p.gene} [{p.layer}] val={p.normalizedValue.toFixed(2)}</title>
          </circle>
        );
      })}
      {/* Legend */}
      {(['transcriptomics', 'proteomics', 'metabolomics'] as OmicsLayer[]).map((layer, i) => (
        <g key={layer} transform={`translate(${W - PAD - 110}, ${PAD + 6 + i * 16})`}>
          <circle cx={0} cy={0} r={4} fill={LAYER_COLORS[layer]} opacity={activeLayers[layer] ? 1 : 0.25} />
          <text x={10} y={3.5} fontFamily={SANS} fontSize="9" fill={activeLayers[layer] ? VALUE : LABEL}>
            {layer.charAt(0).toUpperCase() + layer.slice(1)}
          </text>
        </g>
      ))}
    </svg>
  );
}

/* ── Main Component ───────────────────────────────────────────────── */

export default function MultiOPage() {
  /* Layer toggles */
  const [showTranscript, setShowTranscript] = useState(true);
  const [showProtein, setShowProtein] = useState(true);
  const [showMetabolite, setShowMetabolite] = useState(true);

  /* View mode */
  const [viewMode, setViewMode] = useState<ViewMode>('Embedding');

  /* Thresholds */
  const [fcThreshold, setFcThreshold] = useState(1.5);
  const [pvThreshold, setPvThreshold] = useState(0.05);

  /* Perturbation state */
  const [selectedGene, setSelectedGene] = useState<string>(OMICS_DATA[0]?.gene ?? '');
  const [perturbedExpr, setPerturbedExpr] = useState<number>(4);
  const [perturbResult, setPerturbResult] = useState<PerturbationResult | null>(null);

  /* Foundation model */
  const model = useMemo(() => new OmicsFoundationModel(OMICS_DATA), []);
  const embeddings = useMemo(() => model.computeEmbeddings(), [model]);
  const bottleneck = useMemo(() => model.analyzeBottleneck(), [model]);
  const correlations = useMemo(() => model.computeCorrelationMatrix(), [model]);

  /* Derived data */
  const filtered = useMemo(
    () => OMICS_DATA.filter(r => Math.abs(r.fold_change ?? 0) > 0),
    [],
  );

  const significant = filtered.filter(
    r => (r.pValue ?? 1) < pvThreshold && Math.abs(r.fold_change ?? 0) > fcThreshold,
  );
  const upregulated = significant.filter(r => (r.fold_change ?? 0) > 0).length;
  const downregulated = significant.filter(r => (r.fold_change ?? 0) < 0).length;

  const thoughts = useMemo(() => model.getThoughts(), [model, perturbResult]);

  const activeLayers: Record<OmicsLayer, boolean> = {
    transcriptomics: showTranscript,
    proteomics: showProtein,
    metabolomics: showMetabolite,
  };

  /* Attention weights aggregated per layer */
  const layerAttention = useMemo(() => {
    const acc: Record<OmicsLayer, number> = { transcriptomics: 0, proteomics: 0, metabolomics: 0 };
    bottleneck.attention_heads.forEach(h => { acc[h.layer] += h.weight; });
    return acc;
  }, [bottleneck]);
  const maxAtt = Math.max(...Object.values(layerAttention), 0.01);

  /* Gene list for perturbation dropdown */
  const geneNames = useMemo(() => [...new Set(OMICS_DATA.map(r => r.gene))], []);

  /* Correlation label helper */
  const corrLabel = (a: OmicsLayer, b: OmicsLayer) => {
    const short: Record<OmicsLayer, string> = { transcriptomics: 'T', proteomics: 'P', metabolomics: 'M' };
    return `${short[a]}↔${short[b]}`;
  };

  const handleSimulate = useCallback(() => {
    const result = model.simulatePerturbation(selectedGene, perturbedExpr);
    setPerturbResult(result);
  }, [model, selectedGene, perturbedExpr]);

  /* Section label helper */
  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <p style={{
      fontFamily: SANS, fontSize: '9px', textTransform: 'uppercase',
      letterSpacing: '0.1em', color: LABEL, margin: '0 0 10px',
    }}>
      {children}
    </p>
  );

  return (
    <IDEShell moduleId="multio">
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: PANEL_BG }}>
        <AlgorithmInsight
          title="Biological Foundation Model"
          description="Multi-head attention across transcript / protein / metabolite latent embeddings. Bottleneck analysis identifies rate-limiting omics layer. Perturbation simulator predicts downstream metabolite shifts."
          formula="z = Softmax(QKᵀ/√d)·V  |  ΔG = −RT ln(K)"
        />

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

          {/* ── LEFT SIDEBAR (240px) ──────────────────────────────── */}
          <div style={{
            width: '240px', flexShrink: 0, overflowY: 'auto', padding: '16px',
            borderRight: `1px solid ${BORDER}`, background: PANEL_BG,
          }}>
            {/* Data Layers */}
            <SectionLabel>Data Layers</SectionLabel>
            {([
              { label: 'Transcriptomics', layer: 'transcriptomics' as OmicsLayer, val: showTranscript, set: setShowTranscript },
              { label: 'Proteomics',      layer: 'proteomics' as OmicsLayer,      val: showProtein,    set: setShowProtein },
              { label: 'Metabolomics',    layer: 'metabolomics' as OmicsLayer,    val: showMetabolite, set: setShowMetabolite },
            ]).map(({ label, layer, val, set }) => (
              <button key={label} onClick={() => set(!val)} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                width: '100%', padding: '7px 10px', marginBottom: '6px',
                background: val ? 'rgba(255,255,255,0.06)' : 'transparent',
                border: `1px solid ${val ? 'rgba(255,255,255,0.15)' : BORDER}`,
                borderRadius: '8px', cursor: 'pointer',
                color: val ? INPUT_TEXT : 'rgba(255,255,255,0.4)',
                fontFamily: SANS, fontSize: '11px', textAlign: 'left',
              }}>
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: val ? LAYER_COLORS[layer] : 'transparent',
                  border: `1.5px solid ${LAYER_COLORS[layer]}`, flexShrink: 0,
                }} />
                {label}
              </button>
            ))}

            {/* View Mode Tabs */}
            <SectionLabel>View Mode</SectionLabel>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
              {(['Embedding', 'Volcano', 'Table'] as ViewMode[]).map(mode => (
                <button key={mode} onClick={() => setViewMode(mode)} style={{
                  flex: 1, padding: '5px 0', borderRadius: '6px', cursor: 'pointer',
                  fontFamily: SANS, fontSize: '10px', border: 'none',
                  background: viewMode === mode ? 'rgba(255,255,255,0.12)' : INPUT_BG,
                  color: viewMode === mode ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.4)',
                }}>
                  {mode}
                </button>
              ))}
            </div>

            {/* Thresholds */}
            <SectionLabel>Thresholds</SectionLabel>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontFamily: SANS, fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>|FC| &gt;</span>
                <span style={{ fontFamily: MONO, fontSize: '11px', color: 'rgba(255,255,255,0.55)' }}>{fcThreshold.toFixed(1)}</span>
              </div>
              <input type="range" min={0.5} max={5} step={0.1} value={fcThreshold}
                onChange={e => setFcThreshold(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: LAYER_COLORS.proteomics }} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontFamily: SANS, fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>p &lt;</span>
                <span style={{ fontFamily: MONO, fontSize: '11px', color: 'rgba(255,255,255,0.55)' }}>{pvThreshold.toFixed(3)}</span>
              </div>
              <input type="range" min={0.001} max={0.1} step={0.001} value={pvThreshold}
                onChange={e => setPvThreshold(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: LAYER_COLORS.proteomics }} />
            </div>

            {/* Perturbation Simulator */}
            <SectionLabel>Perturbation Simulator</SectionLabel>
            <select
              value={selectedGene}
              onChange={e => setSelectedGene(e.target.value)}
              style={{
                width: '100%', padding: '6px 8px', marginBottom: '8px',
                background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, borderRadius: '8px',
                color: INPUT_TEXT, fontFamily: MONO, fontSize: '10px',
                outline: 'none', appearance: 'auto' as React.CSSProperties['appearance'],
              }}
            >
              {geneNames.map(g => (
                <option key={g} value={g} style={{ background: '#1a1d24' }}>{g}</option>
              ))}
            </select>
            <div style={{ marginBottom: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontFamily: SANS, fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>Expression</span>
                <span style={{ fontFamily: MONO, fontSize: '10px', color: VALUE }}>{perturbedExpr.toFixed(1)}</span>
              </div>
              <input type="range" min={-4} max={8} step={0.1} value={perturbedExpr}
                onChange={e => setPerturbedExpr(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: LAYER_COLORS.metabolomics }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: MONO, fontSize: '8px', color: LABEL }}>-4</span>
                <span style={{ fontFamily: MONO, fontSize: '8px', color: LABEL }}>+8</span>
              </div>
            </div>
            <button onClick={handleSimulate} style={{
              width: '100%', padding: '7px 0', borderRadius: '8px', cursor: 'pointer',
              fontFamily: SANS, fontSize: '11px', fontWeight: 600,
              border: `1px solid ${LAYER_COLORS.metabolomics}40`,
              background: `${LAYER_COLORS.metabolomics}18`,
              color: LAYER_COLORS.metabolomics,
            }}>
              Simulate
            </button>

            {/* Perturbation Results */}
            {perturbResult && (
              <div style={{ marginTop: '14px' }}>
                <SectionLabel>Perturbation Result</SectionLabel>
                <div style={{
                  ...GLASS, borderRadius: '14px', padding: '10px', marginBottom: '10px',
                }}>
                  {/* Yield change */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontFamily: SANS, fontSize: '9px', color: LABEL }}>Yield Δ</span>
                    <span style={{
                      fontFamily: MONO, fontSize: '13px', fontWeight: 700,
                      color: perturbResult.predicted_yield_change_percent >= 0
                        ? 'rgba(120,220,180,0.95)' : 'rgba(255,100,100,0.95)',
                    }}>
                      {perturbResult.predicted_yield_change_percent >= 0 ? '+' : ''}
                      {perturbResult.predicted_yield_change_percent.toFixed(1)}%
                    </span>
                  </div>
                  {/* Metabolite shifts */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                    {perturbResult.metabolite_shifts.map(ms => (
                      <span key={ms.metabolite} style={{
                        fontFamily: MONO, fontSize: '8px', padding: '2px 6px', borderRadius: '6px',
                        background: ms.direction === 'up' ? 'rgba(120,220,180,0.15)' : 'rgba(255,100,100,0.15)',
                        color: ms.direction === 'up' ? 'rgba(120,220,180,0.9)' : 'rgba(255,100,100,0.9)',
                        border: `1px solid ${ms.direction === 'up' ? 'rgba(120,220,180,0.2)' : 'rgba(255,100,100,0.2)'}`,
                      }}>
                        {ms.metabolite} {ms.direction === 'up' ? '↑' : '↓'}{Math.abs(ms.delta).toFixed(1)}
                      </span>
                    ))}
                  </div>
                  {/* Reasoning chain */}
                  {perturbResult.reasoning_chain.map((step, i) => (
                    <div key={i} style={{
                      padding: '4px 0',
                      borderTop: i > 0 ? `1px solid ${BORDER}` : 'none',
                    }}>
                      <span style={{ fontFamily: MONO, fontSize: '8px', color: LAYER_COLORS.proteomics }}>
                        {i + 1}. {step.step}
                      </span>
                      <p style={{
                        fontFamily: SANS, fontSize: '9px', color: 'rgba(255,255,255,0.45)',
                        margin: '2px 0 0', lineHeight: '1.35',
                      }}>
                        {step.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── CENTER ENGINE ────────────────────────────────────── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0d0f14' }}>
            {viewMode === 'Table' && (
              <div style={{ flex: 1, overflow: 'auto' }}>
                <DataTable<OmicsRow> columns={COLUMNS} rows={filtered} maxRows={50} />
              </div>
            )}
            {viewMode === 'Volcano' && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                <div style={{ width: '100%', maxWidth: '520px', aspectRatio: '360/300' }}>
                  <VolcanoPlot data={filtered} fcThreshold={fcThreshold} pvThreshold={pvThreshold} />
                </div>
              </div>
            )}
            {viewMode === 'Embedding' && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                <div style={{ width: '100%', maxWidth: '600px' }}>
                  <EmbeddingScatter
                    embeddings={embeddings}
                    fcThreshold={fcThreshold}
                    activeLayers={activeLayers}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT PANEL (260px) ──────────────────────────────── */}
          <div style={{
            width: '260px', flexShrink: 0, overflowY: 'auto', padding: '16px',
            borderLeft: `1px solid ${BORDER}`, background: PANEL_BG,
          }}>
            {/* Enrichment Summary */}
            <SectionLabel>Enrichment Summary</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
              <MetricCard label="Significant" value={significant.length} highlight />
              <MetricCard label="Upregulated" value={upregulated} />
              <MetricCard label="Downregulated" value={downregulated} />
              <MetricCard label="Total" value={OMICS_DATA.length} />
            </div>

            {/* Attention Analysis */}
            <SectionLabel>Attention Analysis</SectionLabel>
            <div style={{ ...GLASS, borderRadius: '14px', padding: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div>
                  <span style={{ fontFamily: SANS, fontSize: '9px', color: LABEL, display: 'block', marginBottom: '2px' }}>
                    Dominant Layer
                  </span>
                  <span style={{
                    fontFamily: MONO, fontSize: '12px', fontWeight: 600,
                    color: LAYER_COLORS[bottleneck.dominant_layer],
                  }}>
                    {bottleneck.dominant_layer}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontFamily: SANS, fontSize: '9px', color: LABEL, display: 'block', marginBottom: '2px' }}>
                    Confidence
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: '12px', color: VALUE }}>
                    {(bottleneck.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              {/* Attention bars */}
              {(['transcriptomics', 'proteomics', 'metabolomics'] as OmicsLayer[]).map(layer => {
                const w = (layerAttention[layer] / maxAtt) * 100;
                return (
                  <div key={layer} style={{ marginBottom: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span style={{ fontFamily: SANS, fontSize: '9px', color: 'rgba(255,255,255,0.45)' }}>
                        {layer.charAt(0).toUpperCase() + layer.slice(1)}
                      </span>
                      <span style={{ fontFamily: MONO, fontSize: '9px', color: VALUE, textAlign: 'right' }}>
                        {layerAttention[layer].toFixed(3)}
                      </span>
                    </div>
                    <div style={{
                      width: '100%', height: '6px', borderRadius: '3px',
                      background: 'rgba(255,255,255,0.06)',
                    }}>
                      <div style={{
                        width: `${w}%`, height: '100%', borderRadius: '3px',
                        background: LAYER_COLORS[layer],
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Cross-Layer Correlations */}
            <SectionLabel>Cross-Layer Correlations</SectionLabel>
            <div style={{ ...GLASS, borderRadius: '14px', padding: '10px', marginBottom: '16px' }}>
              {correlations.map((c, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '4px 0',
                  borderTop: i > 0 ? `1px solid ${BORDER}` : 'none',
                }}>
                  <span style={{ fontFamily: SANS, fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>
                    {corrLabel(c.layers[0], c.layers[1])}
                  </span>
                  <span style={{
                    fontFamily: MONO, fontSize: '11px', textAlign: 'right',
                    color: Math.abs(c.r) > 0.5 ? 'rgba(120,220,180,0.9)' : VALUE,
                  }}>
                    r={c.r.toFixed(3)}
                  </span>
                  <span style={{
                    fontFamily: MONO, fontSize: '9px', textAlign: 'right',
                    color: c.p_approx < 0.05 ? 'rgba(255,200,80,0.85)' : 'rgba(255,255,255,0.3)',
                  }}>
                    p={c.p_approx.toFixed(3)}
                  </span>
                </div>
              ))}
            </div>

            {/* Internal Thoughts */}
            <SectionLabel>Internal Thoughts</SectionLabel>
            <div style={{
              maxHeight: '220px', overflowY: 'auto',
              display: 'flex', flexDirection: 'column', gap: '6px',
            }}>
              {(thoughts.length > 0 ? thoughts.slice(-5) : []).map((t, i) => (
                <div key={i} style={{
                  ...GLASS, borderRadius: '10px', padding: '8px 10px',
                }}>
                  <p style={{
                    fontFamily: MONO, fontSize: '9px', color: 'rgba(255,255,255,0.55)',
                    margin: 0, lineHeight: '1.4', whiteSpace: 'pre-wrap',
                  }}>
                    {t.thought}
                  </p>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                    {t.layer_context.map(l => (
                      <span key={l} style={{
                        fontFamily: MONO, fontSize: '7px', padding: '1px 5px',
                        borderRadius: '4px', background: `${LAYER_COLORS[l]}20`,
                        color: LAYER_COLORS[l],
                      }}>
                        {l.slice(0, 5)}
                      </span>
                    ))}
                  </div>
                  <span style={{
                    fontFamily: MONO, fontSize: '7px', color: LABEL, display: 'block', marginTop: '3px',
                  }}>
                    → {t.action_taken}
                  </span>
                </div>
              ))}
              {thoughts.length === 0 && (
                <p style={{ fontFamily: SANS, fontSize: '10px', color: LABEL, fontStyle: 'italic', margin: 0 }}>
                  Run a simulation to see Axon's reasoning…
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Bottom Export Bar ──────────────────────────────────── */}
        <div style={{
          borderTop: `1px solid ${BORDER}`, padding: '8px 16px',
          display: 'flex', gap: '8px', flexShrink: 0, background: PANEL_BG,
        }}>
          <ExportButton label="Export All CSV" data={OMICS_DATA} filename="multio-all" format="csv" />
          <ExportButton label="Export Significant JSON" data={significant} filename="multio-significant" format="json" />
        </div>
      </div>
    </IDEShell>
  );
}
