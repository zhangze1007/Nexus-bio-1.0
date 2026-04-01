'use client';
import { useState, useMemo } from 'react';
import IDEShell from '../ide/IDEShell';
import AlgorithmInsight from '../ide/shared/AlgorithmInsight';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import SimErrorBanner from '../ide/shared/SimErrorBanner';
import { CRISPRI_TARGETS, greedyKnockdownSchedule } from '../../data/mockGenMIM';
import type { CRISPRiTarget } from '../../types';
import { T, TOOL_RESULT_PALETTE} from '../ide/tokens';

function GenomeMap({ targets, selected }: { targets: CRISPRiTarget[]; selected: CRISPRiTarget[] }) {
  const W = 440, H = 120;
  const selectedIds = new Set(selected.map(t => t.gene));

  return (
    <svg role="img" aria-label="Chart" viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={H} fill="#050505" />
      <rect x={20} y={H / 2 - 6} width={W - 40} height={12} rx="6"
        fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
      <text x={20} y={H / 2 + 22} fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.2)">0</text>
      <text x={W - 30} y={H / 2 + 22} fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.2)">4.6 Mb</text>
      {targets.map(t => {
        const x = 20 + (t.position / 4641) * (W - 40);
        const isSelected = selectedIds.has(t.gene);
        const isEssential = t.essential;
        const color = isEssential
          ? 'rgba(255,139,31,0.8)'
          : isSelected
          ? 'rgba(255,80,80,0.8)'
          : 'rgba(147,203,82,0.55)';
        const y = H / 2 - (isSelected || isEssential ? 22 : 12);
        return (
          <g key={t.gene}>
            <line x1={x} y1={H / 2 - 6} x2={x} y2={y + 6} stroke={color} strokeWidth={1.5} />
            <polygon points={`${x},${y} ${x - 3},${y + 6} ${x + 3},${y + 6}`} fill={color} />
            {(isSelected || isEssential) && (
              <text x={x} y={y - 3} textAnchor="middle" fontFamily={T.MONO} fontSize="7" fill={color}>
                {t.gene}
              </text>
            )}
          </g>
        );
      })}
      {[
        { color: 'rgba(255,139,31,0.8)', label: 'Essential' },
        { color: 'rgba(255,80,80,0.8)',  label: 'Knocked down' },
        { color: 'rgba(147,203,82,0.55)', label: 'Candidate' },
      ].map((l, i) => (
        <g key={l.label} transform={`translate(${20 + i * 120},${H - 16})`}>
          <line x1={0} y1={4} x2={12} y2={4} stroke={l.color} strokeWidth={2} />
          <text x={16} y={8} fontFamily={T.SANS} fontSize="8" fill="rgba(255,255,255,0.35)">{l.label}</text>
        </g>
      ))}
    </svg>
  );
}

export default function GenMIMPage() {
  const [efficiency, setEfficiency] = useState(0.8);
  const [maxTargets, setMaxTargets] = useState(5);
  const [protectEssential, setProtectEssential] = useState(true);

  const { data: schedule, error: simError } = useMemo(() => {
    try {
      return { data: greedyKnockdownSchedule(CRISPRI_TARGETS, maxTargets, efficiency, protectEssential), error: null as string | null };
    } catch (e) {
      return { data: [] as ReturnType<typeof greedyKnockdownSchedule>, error: e instanceof Error ? e.message : 'Knockdown scheduling failed' };
    }
  }, [efficiency, maxTargets, protectEssential]);

  const growthImpact = schedule.reduce((a, t) => a + (t.growth_impact ?? 0), 0);
  const avgEfficiency = schedule.length > 0
    ? schedule.reduce((a, t) => a + t.knockdown_efficiency, 0) / schedule.length : 0;
  const offTargetRisk = schedule.filter(t => t.knockdown_efficiency < 0.9).length / Math.max(schedule.length, 1);

  return (
    <IDEShell moduleId="genmim">
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#000000' }}>
        <AlgorithmInsight
          title="Gene Minimization via CRISPRi"
          description="Greedy knockdown scheduling: ranks non-essential genes by knockdown efficiency, bounded by max targets and growth tolerance."
          formula="score = KD_eff + (1 + GI) × 0.3"
        />

        {simError && (
          <div style={{ padding: '0 16px 8px' }}><SimErrorBanner message={simError} /></div>
        )}

        <div className="nb-tool-panels" style={{ flex: 1 }}>
          {/* Input panel */}
          <div className="nb-tool-sidebar" style={{ width: '240px', borderRight: '1px solid rgba(255,255,255,0.06)', background: '#000000' }}>
            <p style={{ fontFamily: T.SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', margin: '0 0 12px' }}>
              CRISPRi Parameters
            </p>

            {[
              { label: 'Min. knockdown efficiency', value: efficiency, min: 0.5, max: 1.0, step: 0.01, set: setEfficiency, display: (v: number) => `${(v * 100).toFixed(0)}%` },
              { label: 'Max targets', value: maxTargets, min: 1, max: 15, step: 1, set: setMaxTargets, display: (v: number) => `${v}` },
            ].map(s => (
              <div key={s.label} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontFamily: T.SANS, fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>{s.label}</span>
                  <span style={{ fontFamily: T.MONO, fontSize: '11px', color: 'rgba(255,255,255,0.55)' }}>{s.display(s.value)}</span>
                </div>
                <input aria-label="Parameter slider" type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                  onChange={e => s.set(parseFloat(e.target.value) as never)}
                  style={{ width: '100%', accentColor: 'rgba(120,180,255,0.8)' }} />
              </div>
            ))}

            <button aria-label="Action" onClick={() => setProtectEssential(!protectEssential)} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              width: '100%', padding: '7px 10px', marginBottom: '16px',
              background: protectEssential ? 'rgba(255,139,31,0.1)' : 'transparent',
              border: `1px solid ${protectEssential ? 'rgba(255,139,31,0.25)' : 'rgba(255,255,255,0.06)'}`,
              borderRadius: '8px', cursor: 'pointer',
              color: protectEssential ? 'rgba(255,139,31,0.9)' : 'rgba(255,255,255,0.35)',
              fontFamily: T.SANS, fontSize: '11px', textAlign: 'left',
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: protectEssential ? 'rgba(200,140,20,0.8)' : 'transparent', border: '1px solid rgba(200,140,20,0.5)', flexShrink: 0 }} />
              Protect essential genes
            </button>

            <p style={{ fontFamily: T.SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', margin: '0 0 8px' }}>
              Knockdown Schedule ({schedule.length} targets)
            </p>
            {schedule.map(t => (
              <div key={t.gene} style={{
                padding: '6px 8px', marginBottom: '4px',
                background: 'rgba(255,80,80,0.06)',
                border: '1px solid rgba(255,80,80,0.2)',
                borderRadius: '8px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: T.MONO, fontSize: '10px', color: 'rgba(255,120,120,0.9)' }}>{t.gene}</span>
                  <span style={{ fontFamily: T.MONO, fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>{(t.knockdown_efficiency * 100).toFixed(0)}% KD</span>
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>
                  {t.phenotype} · GI: {((t.growth_impact ?? 0) * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>

          {/* Engine view — genome map + table */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#050505' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
              <p style={{ fontFamily: T.MONO, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.25)', margin: '0 0 8px' }}>
                E. coli K-12 Genome Map
              </p>
              <GenomeMap targets={CRISPRI_TARGETS} selected={schedule} />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    {['Gene', 'Position', 'Essential', 'KD Eff.', 'Phenotype', 'Growth ΔΔ'].map(h => (
                      <th key={h} style={{ fontFamily: T.MONO, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.3)', padding: '5px 8px', textAlign: 'left' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CRISPRI_TARGETS.map((t, i) => {
                    const isSelected = schedule.some(s => s.gene === t.gene);
                    return (
                      <tr key={t.gene} style={{ background: isSelected ? 'rgba(255,80,80,0.04)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                        <td style={{ fontFamily: T.MONO, fontSize: '10px', padding: '4px 8px', color: isSelected ? 'rgba(255,120,120,0.85)' : 'rgba(255,255,255,0.55)' }}>{t.gene}</td>
                        <td style={{ fontFamily: T.MONO, fontSize: '10px', padding: '4px 8px', color: 'rgba(255,255,255,0.35)' }}>{t.position.toLocaleString()}</td>
                        <td style={{ fontFamily: T.MONO, fontSize: '10px', padding: '4px 8px', color: t.essential ? 'rgba(255,139,31,0.8)' : 'rgba(255,255,255,0.25)' }}>{t.essential ? '⚠ YES' : 'no'}</td>
                        <td style={{ fontFamily: T.MONO, fontSize: '10px', padding: '4px 8px', color: 'rgba(255,255,255,0.55)' }}>{t.essential ? '—' : `${(t.knockdown_efficiency * 100).toFixed(0)}%`}</td>
                        <td style={{ fontFamily: T.SANS, fontSize: '10px', padding: '4px 8px', color: 'rgba(255,255,255,0.4)' }}>{t.phenotype}</td>
                        <td style={{ fontFamily: T.MONO, fontSize: '10px', padding: '4px 8px', color: 'rgba(255,255,255,0.4)' }}>{t.essential ? '—' : `${((t.growth_impact ?? 0) * 100).toFixed(0)}%`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Results panel */}
          <div className="nb-tool-right" style={{ width: '200px', borderLeft: '1px solid rgba(255,255,255,0.06)', background: '#000000' }}>
            <p style={{ fontFamily: T.SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', margin: '0 0 12px' }}>
              Predicted Impact
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <MetricCard label="Targets Selected" value={schedule.length} highlight />
              <MetricCard label="Total Growth Impact" value={(growthImpact * 100).toFixed(1)} unit="%"
                warning={Math.abs(growthImpact) > 0.4 ? 'Growth penalty >40% — review schedule' : undefined} />
              <MetricCard label="Avg KD Efficiency" value={(avgEfficiency * 100).toFixed(1)} unit="%" />
              <MetricCard label="Off-target Risk" value={(offTargetRisk * 100).toFixed(0)} unit="%" />
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '8px 16px', display: 'flex', gap: '8px', flexShrink: 0, background: '#000000' }}>
          <ExportButton label="Export Schedule JSON" data={schedule} filename="genmim-schedule" format="json" />
          <ExportButton label="Export All Targets CSV" data={CRISPRI_TARGETS} filename="genmim-targets" format="csv" />
        </div>
      </div>
    </IDEShell>
  );
}
