'use client';
import { useState, useMemo } from 'react';
import IDEShell from '../ide/IDEShell';
import AlgorithmInsight from '../ide/shared/AlgorithmInsight';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import DataTable from '../ide/shared/DataTable';
import type { TableColumn } from '../ide/shared/DataTable';
import { OMICS_DATA } from '../../data/mockMultiO';
import type { OmicsRow } from '../../types';

const MONO = "'JetBrains Mono','Fira Code',monospace";
const SANS = "'Inter',-apple-system,sans-serif";

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

export default function MultiOPage() {
  const [showTranscript, setShowTranscript] = useState(true);
  const [showProtein, setShowProtein] = useState(true);
  const [showMetabolite, setShowMetabolite] = useState(true);
  const [fcThreshold, setFcThreshold] = useState(1.5);
  const [pvThreshold, setPvThreshold] = useState(0.05);

  const filtered = useMemo(() =>
    OMICS_DATA.filter(r => Math.abs(r.fold_change ?? 0) > 0),
    []
  );

  const significant = filtered.filter(r => (r.pValue ?? 1) < pvThreshold && Math.abs(r.fold_change ?? 0) > fcThreshold);
  const upregulated = significant.filter(r => (r.fold_change ?? 0) > 0).length;
  const downregulated = significant.filter(r => (r.fold_change ?? 0) < 0).length;

  const layerColors = {
    Transcriptomics: 'rgba(120,180,255,0.7)',
    Proteomics: 'rgba(255,190,60,0.7)',
    Metabolomics: 'rgba(120,220,180,0.7)',
  };

  return (
    <IDEShell moduleId="multio">
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#10131a' }}>
        <AlgorithmInsight
          title="Multi-Omics Integrator"
          description="Pearson correlation across transcript / protein / metabolite layers. Significance: p < threshold after Benjamini-Hochberg correction."
          formula="r = Σ(xi-x̄)(yi-ȳ) / (n·σxσy)"
        />

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          {/* Input panel */}
          <div style={{ width: '200px', flexShrink: 0, overflowY: 'auto', padding: '16px', borderRight: '1px solid rgba(255,255,255,0.06)', background: '#10131a' }}>
            <p style={{ fontFamily: SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', margin: '0 0 12px' }}>
              Data Layers
            </p>
            {[
              { label: 'Transcriptomics', val: showTranscript, set: setShowTranscript, color: layerColors.Transcriptomics },
              { label: 'Proteomics', val: showProtein, set: setShowProtein, color: layerColors.Proteomics },
              { label: 'Metabolomics', val: showMetabolite, set: setShowMetabolite, color: layerColors.Metabolomics },
            ].map(({ label, val, set, color }) => (
              <button key={label} onClick={() => set(!val)} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                width: '100%', padding: '7px 10px', marginBottom: '6px',
                background: val ? 'rgba(255,255,255,0.06)' : 'transparent',
                border: `1px solid ${val ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: '8px', cursor: 'pointer',
                color: val ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)',
                fontFamily: SANS, fontSize: '11px', textAlign: 'left',
              }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: val ? color : 'transparent', border: `1.5px solid ${color}`, flexShrink: 0 }} />
                {label}
              </button>
            ))}

            <p style={{ fontFamily: SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', margin: '16px 0 8px' }}>
              Thresholds
            </p>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontFamily: SANS, fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>|FC| &gt;</span>
                <span style={{ fontFamily: MONO, fontSize: '11px', color: 'rgba(255,255,255,0.55)' }}>{fcThreshold.toFixed(1)}</span>
              </div>
              <input type="range" min={0.5} max={5} step={0.1} value={fcThreshold}
                onChange={e => setFcThreshold(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'rgba(120,180,255,0.8)' }} />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontFamily: SANS, fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>p &lt;</span>
                <span style={{ fontFamily: MONO, fontSize: '11px', color: 'rgba(255,255,255,0.55)' }}>{pvThreshold.toFixed(3)}</span>
              </div>
              <input type="range" min={0.001} max={0.1} step={0.001} value={pvThreshold}
                onChange={e => setPvThreshold(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'rgba(120,180,255,0.8)' }} />
            </div>
          </div>

          {/* Engine view — split: table + volcano */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0d0f14' }}>
            <div style={{ flex: 1, overflow: 'auto', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <DataTable<OmicsRow> columns={COLUMNS} rows={filtered} maxRows={50} />
            </div>
            <div style={{ height: '240px', flexShrink: 0, padding: '8px', display: 'flex', justifyContent: 'center' }}>
              <VolcanoPlot data={filtered} fcThreshold={fcThreshold} pvThreshold={pvThreshold} />
            </div>
          </div>

          {/* Results panel */}
          <div style={{ width: '200px', flexShrink: 0, overflowY: 'auto', padding: '16px', borderLeft: '1px solid rgba(255,255,255,0.06)', background: '#10131a' }}>
            <p style={{ fontFamily: SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', margin: '0 0 12px' }}>
              Enrichment Summary
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <MetricCard label="Significant Genes" value={significant.length} highlight />
              <MetricCard label="Upregulated" value={upregulated} />
              <MetricCard label="Downregulated" value={downregulated} />
              <MetricCard label="Total Genes" value={OMICS_DATA.length} />
            </div>

            <p style={{ fontFamily: SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', margin: '16px 0 8px' }}>
              Top Hits
            </p>
            {significant.slice(0, 5).map(r => (
              <div key={r.id} style={{ padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: MONO, fontSize: '10px', color: 'rgba(255,255,255,0.65)' }}>{r.gene}</span>
                  <span style={{ fontFamily: MONO, fontSize: '10px', color: (r.fold_change ?? 0) > 0 ? 'rgba(20,140,80,0.85)' : 'rgba(180,40,40,0.85)' }}>
                    {(r.fold_change ?? 0) > 0 ? '+' : ''}{r.fold_change?.toFixed(1)}×
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '8px 16px', display: 'flex', gap: '8px', flexShrink: 0, background: '#10131a' }}>
          <ExportButton label="Export All CSV" data={OMICS_DATA} filename="multio-all" format="csv" />
          <ExportButton label="Export Significant JSON" data={significant} filename="multio-significant" format="json" />
        </div>
      </div>
    </IDEShell>
  );
}
