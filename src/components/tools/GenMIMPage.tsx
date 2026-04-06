'use client';
import { useState, useMemo, useEffect } from 'react';
import AlgorithmInsight from '../ide/shared/AlgorithmInsight';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import SimErrorBanner from '../ide/shared/SimErrorBanner';
import { CRISPRI_TARGETS, greedyKnockdownSchedule } from '../../data/mockGenMIM';
import type { CRISPRiTarget } from '../../types';
import { useWorkbenchStore } from '../../store/workbenchStore';
import { T, TOOL_RESULT_PALETTE} from '../ide/tokens';
import WorkbenchInlineContext from '../workbench/WorkbenchInlineContext';
import ScientificHero from './shared/ScientificHero';
import { PATHD_THEME } from '../workbench/workbenchTheme';

function GenomeMap({
  targets,
  selected,
  efficiencyThreshold,
}: {
  targets: CRISPRiTarget[];
  selected: CRISPRiTarget[];
  efficiencyThreshold: number;
}) {
  const W = 720;
  const H = 320;
  const genomeH = 118;
  const plotTop = 156;
  const plotH = 122;
  const selectedIds = new Set(selected.map((target) => target.gene));
  const selectedEfficiency = selected.map((target) => target.knockdown_efficiency);
  const avgSelectedEfficiency = selectedEfficiency.length > 0
    ? selectedEfficiency.reduce((sum, value) => sum + value, 0) / selectedEfficiency.length
    : 0;
  const maxImpact = Math.max(...targets.map((target) => Math.abs(target.growth_impact ?? 0)), 0.01);

  function plotX(efficiency: number) {
    return 62 + efficiency * 284;
  }

  function plotY(impact: number) {
    const normalized = (impact + maxImpact) / (maxImpact * 2);
    return plotTop + plotH - normalized * plotH;
  }

  return (
    <svg role="img" aria-label="Chart" viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={H} fill="#050505" rx="18" />
      <text x="22" y="24" fontFamily={T.MONO} fontSize="10" fill="rgba(255,255,255,0.24)">
        Chassis selection surface
      </text>
      <text x="22" y="40" fontFamily={T.SANS} fontSize="12" fill="rgba(255,255,255,0.72)">
        Genome occupancy and CRISPRi decision space for the active chassis program
      </text>

      <rect x="22" y="56" width="676" height={genomeH} rx="16" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)" />
      <rect x={42} y={108} width={W - 84} height={14} rx="999"
        fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
      <text x="42" y="144" fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.22)">0 Mb</text>
      <text x={W - 42} y="144" textAnchor="end" fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.22)">4.64 Mb</text>
      {targets.map((target) => {
        const x = 42 + (target.position / 4641) * (W - 84);
        const isSelected = selectedIds.has(target.gene);
        const isEssential = target.essential;
        const color = isEssential
          ? 'rgba(255,139,31,0.8)'
          : isSelected
            ? 'rgba(255,80,80,0.8)'
            : 'rgba(147,203,82,0.55)';
        // IGV-style horizontal arrow gene body
        const prominent = isSelected || isEssential;
        const aw = prominent ? 18 : 12; // arrow total width
        const ah = prominent ? 7 : 5;   // arrow height
        const tip = prominent ? 5 : 4;  // arrowhead extent
        const yBase = prominent ? 70 : 87; // y above chromosome
        const arrowPath = [
          `M ${(x - aw / 2).toFixed(1)} ${yBase}`,
          `L ${(x + aw / 2 - tip).toFixed(1)} ${yBase}`,
          `L ${(x + aw / 2).toFixed(1)} ${(yBase + ah / 2).toFixed(1)}`,
          `L ${(x + aw / 2 - tip).toFixed(1)} ${yBase + ah}`,
          `L ${(x - aw / 2).toFixed(1)} ${yBase + ah}`,
          'Z',
        ].join(' ');
        return (
          <g key={target.gene}>
            <line x1={x} y1={108} x2={x} y2={yBase + ah}
              stroke={color} strokeWidth={prominent ? 1.4 : 1.0} strokeOpacity={0.45} />
            <path d={arrowPath} fill={color} />
            {prominent && (
              <text x={x} y={yBase - 3} textAnchor="middle" fontFamily={T.MONO} fontSize="7" fill={color}>
                {target.gene}
              </text>
            )}
          </g>
        );
      })}
      {[
        { color: 'rgba(255,139,31,0.8)', label: 'Essential gene' },
        { color: 'rgba(255,80,80,0.8)', label: 'Selected knockdown' },
        { color: 'rgba(147,203,82,0.55)', label: 'Candidate locus' },
      ].map((legend, index) => (
        <g key={legend.label} transform={`translate(${42 + index * 156},148)`}>
          {/* IGV-style arrow legend marker */}
          <path d="M 0 2 L 7 2 L 7 0 L 12 4 L 7 8 L 7 6 L 0 6 Z" fill={legend.color} />
          <text x={16} y={8} fontFamily={T.SANS} fontSize="8" fill="rgba(255,255,255,0.35)">{legend.label}</text>
        </g>
      ))}

      <rect x="22" y={plotTop} width="332" height="142" rx="16" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)" />
      <text x="42" y={plotTop + 20} fontFamily={T.MONO} fontSize="9" fill="rgba(255,255,255,0.24)">
        Selection frontier
      </text>
      <text x="42" y={plotTop + 34} fontFamily={T.SANS} fontSize="11" fill="rgba(255,255,255,0.46)">
        KD efficiency vs growth penalty
      </text>
      <line x1="62" y1={plotTop + plotH} x2="346" y2={plotTop + plotH} stroke="rgba(255,255,255,0.08)" />
      <line x1="62" y1={plotTop} x2="62" y2={plotTop + plotH} stroke="rgba(255,255,255,0.08)" />
      <line x1={plotX(efficiencyThreshold)} y1={plotTop} x2={plotX(efficiencyThreshold)} y2={plotTop + plotH} stroke="rgba(81,124,255,0.4)" strokeDasharray="4 4" />
      <line x1="62" y1={plotY(0)} x2="346" y2={plotY(0)} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 4" />
      {targets.map((target) => {
        const isSelected = selectedIds.has(target.gene);
        const x = plotX(target.knockdown_efficiency);
        const y = plotY(target.growth_impact ?? 0);
        const color = target.essential
          ? 'rgba(255,139,31,0.9)'
          : isSelected
            ? 'rgba(255,80,80,0.95)'
            : 'rgba(147,203,82,0.42)';
        return (
          <g key={`${target.gene}-scatter`}>
            <circle cx={x} cy={y} r={isSelected ? 4.8 : 3.4} fill={color} stroke={isSelected ? 'rgba(255,255,255,0.75)' : 'none'} strokeWidth="1" />
            {isSelected ? (
              <text x={x + 7} y={y - 6} fontFamily={T.MONO} fontSize="7" fill="rgba(255,255,255,0.65)">
                {target.gene}
              </text>
            ) : null}
          </g>
        );
      })}
      <text x="204" y={plotTop + plotH + 22} textAnchor="middle" fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.2)">
        Knockdown efficiency
      </text>
      <text x="18" y={plotTop + plotH / 2} textAnchor="middle" fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.2)" transform={`rotate(-90, 18, ${plotTop + plotH / 2})`}>
        Growth impact
      </text>
      <text x={plotX(efficiencyThreshold) + 4} y={plotTop + 12} fontFamily={T.MONO} fontSize="7" fill="rgba(81,124,255,0.55)">
        KD threshold
      </text>
      {[-maxImpact, 0, maxImpact].map((tick, index) => (
        <text key={index} x="54" y={plotY(tick) + 3} textAnchor="end" fontFamily={T.MONO} fontSize="7" fill="rgba(255,255,255,0.2)">
          {(tick * 100).toFixed(0)}%
        </text>
      ))}
      {[0.5, 0.75, 1].map((tick, index) => (
        <text key={index} x={plotX(tick)} y={plotTop + plotH + 12} textAnchor="middle" fontFamily={T.MONO} fontSize="7" fill="rgba(255,255,255,0.2)">
          {(tick * 100).toFixed(0)}
        </text>
      ))}

      <rect x="372" y={plotTop} width="326" height="142" rx="16" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)" />
      <text x="392" y={plotTop + 20} fontFamily={T.MONO} fontSize="9" fill="rgba(255,255,255,0.24)">
        Program summary
      </text>
      <text x="392" y={plotTop + 38} fontFamily={T.SANS} fontSize="22" fontWeight="700" fill="rgba(255,255,255,0.9)">
        {selected.length} target{selected.length === 1 ? '' : 's'}
      </text>
      <text x="392" y={plotTop + 56} fontFamily={T.SANS} fontSize="11" fill="rgba(255,255,255,0.36)">
        avg KD {(avgSelectedEfficiency * 100).toFixed(0)}% · threshold {(efficiencyThreshold * 100).toFixed(0)}%
      </text>
      <rect x="392" y={plotTop + 72} width="276" height="10" rx="999" fill="rgba(255,255,255,0.08)" />
      <rect x="392" y={plotTop + 72} width={Math.max(8, avgSelectedEfficiency * 276)} height="10" rx="999" fill="rgba(81,124,255,0.9)" />
      <rect x="392" y={plotTop + 100} width="276" height="10" rx="999" fill="rgba(255,255,255,0.08)" />
      <rect x="392" y={plotTop + 100} width={Math.max(8, (selected.length / Math.max(1, targets.length)) * 276)} height="10" rx="999" fill="rgba(255,80,80,0.85)" />
      <text x="392" y={plotTop + 69} fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.3)">Average knockdown efficiency</text>
      <text x="392" y={plotTop + 97} fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.3)">Genome coverage of selected intervention set</text>
    </svg>
  );
}

export default function GenMIMPage() {
  const project = useWorkbenchStore((s) => s.project);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const fbaPayload = useWorkbenchStore((s) => s.toolPayloads.fbasim);
  const dynconPayload = useWorkbenchStore((s) => s.toolPayloads.dyncon);
  const setToolPayload = useWorkbenchStore((s) => s.setToolPayload);
  const [efficiency, setEfficiency] = useState(0.8);
  const [maxTargets, setMaxTargets] = useState(5);
  const [protectEssential, setProtectEssential] = useState(true);
  const recommendedEfficiency = useMemo(() => {
    const value = 0.72
      + (fbaPayload?.result.feasible ? 0.08 : 0)
      + (dynconPayload?.result.stable ? 0.04 : -0.03);
    return Math.min(1, Math.max(0.5, Math.round(value * 100) / 100));
  }, [dynconPayload?.result.stable, fbaPayload?.result.feasible]);
  const recommendedTargets = useMemo(() => {
    const count = 3
      + (analyzeArtifact?.bottleneckAssumptions.length ?? 0)
      + ((fbaPayload?.result.carbonEfficiency ?? 0) > 60 ? 1 : 0);
    return Math.min(15, Math.max(1, count));
  }, [analyzeArtifact?.bottleneckAssumptions.length, fbaPayload?.result.carbonEfficiency]);

  useEffect(() => {
    setEfficiency(recommendedEfficiency);
    setMaxTargets(recommendedTargets);
    setProtectEssential((dynconPayload?.result.doRmse ?? 0.05) <= 0.08);
  }, [dynconPayload?.result.doRmse, recommendedEfficiency, recommendedTargets]);

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

  useEffect(() => {
    setToolPayload('genmim', {
      toolId: 'genmim',
      targetProduct: analyzeArtifact?.targetProduct || project?.targetProduct || project?.title || 'Target Product',
      sourceArtifactId: analyzeArtifact?.id,
      efficiencyThreshold: efficiency,
      maxTargets,
      protectEssential,
      result: {
        selectedTargets: schedule.length,
        growthImpact,
        avgEfficiency,
        offTargetRisk,
        topGenes: schedule.slice(0, 5).map((target) => target.gene),
      },
      updatedAt: Date.now(),
    });
  }, [
    analyzeArtifact?.id,
    analyzeArtifact?.targetProduct,
    avgEfficiency,
    efficiency,
    growthImpact,
    maxTargets,
    offTargetRisk,
    project?.targetProduct,
    project?.title,
    protectEssential,
    schedule,
    setToolPayload,
  ]);

  return (
    <>
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', background: '#000000', minHeight: '100%', flex: 1 }}>
        <AlgorithmInsight
          title="Gene Minimization via CRISPRi"
          description="Greedy knockdown scheduling: ranks non-essential genes by knockdown efficiency, bounded by max targets and growth tolerance."
          formula="score = KD_eff + (1 + GI) × 0.3"
        />

        <div style={{ padding: '0 16px 10px' }}>
          <ScientificHero
            eyebrow="Stage 3 · Chassis Minimization"
            title="Minimal chassis decisions with explicit growth tradeoffs"
            summary="GENMIM now foregrounds the chassis question instead of burying it in a schedule table. You can read immediately how many targets are being proposed, how much growth is being sacrificed, and whether the current protection policy is conservative enough for the active project."
            aside={
              <>
                <div style={{ fontFamily: T.MONO, fontSize: '10px', color: PATHD_THEME.label, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Current minimization policy
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: '13px', color: PATHD_THEME.value, fontWeight: 700 }}>
                  {protectEssential ? 'Essential genes protected' : 'Aggressive pruning mode'}
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: '11px', color: PATHD_THEME.label, lineHeight: 1.55 }}>
                  This policy is already influenced by flux feasibility and control stability so genome reduction does not detach from the rest of the workbench.
                </div>
              </>
            }
            signals={[
              {
                label: 'Selected Targets',
                value: `${schedule.length}`,
                detail: `Max target budget ${maxTargets} under the current efficiency threshold`,
                tone: schedule.length > 6 ? 'warm' : 'cool',
              },
              {
                label: 'Growth Impact',
                value: `${(growthImpact * 100).toFixed(1)}%`,
                detail: Math.abs(growthImpact) > 0.4 ? 'This schedule is expensive in host fitness and should be treated cautiously.' : 'Predicted host penalty remains in a manageable chassis-engineering band.',
                tone: Math.abs(growthImpact) > 0.4 ? 'alert' : 'cool',
              },
              {
                label: 'Average KD',
                value: `${(avgEfficiency * 100).toFixed(1)}%`,
                detail: `Off-target risk ${(offTargetRisk * 100).toFixed(0)}% across the current guide schedule`,
                tone: avgEfficiency > 0.85 ? 'cool' : 'warm',
              },
              {
                label: 'Lead Gene',
                value: schedule[0]?.gene ?? 'Pending',
                detail: schedule[0] ? `${schedule[0].phenotype} · GI ${((schedule[0].growth_impact ?? 0) * 100).toFixed(0)}%` : 'No knockdown schedule has been generated yet.',
                tone: 'neutral',
              },
            ]}
          />
        </div>

        {simError && (
          <div style={{ padding: '0 16px 8px' }}><SimErrorBanner message={simError} /></div>
        )}

        <div className="nb-tool-panels" style={{ flex: 1 }}>
          {/* Input panel */}
          <div className="nb-tool-sidebar" style={{ width: '240px', borderRight: '1px solid rgba(255,255,255,0.06)', background: '#000000' }}>
            <WorkbenchInlineContext
              toolId="genmim"
              title="Gene Minimization"
              summary="Translate analyzed bottlenecks into chassis-level genome minimization hypotheses so Stage 3 interventions remain linked to the same project object."
              compact
              isSimulated={!analyzeArtifact}
            />

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
          <div className="nb-tool-center" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#050505', minWidth: 0 }}>
            <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
              <p style={{ fontFamily: T.MONO, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.25)', margin: '0 0 8px' }}>
                E. coli K-12 Genome Map
              </p>
              <GenomeMap targets={CRISPRI_TARGETS} selected={schedule} efficiencyThreshold={efficiency} />
            </div>
            <div style={{ flex: 1, padding: '12px' }}>
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
    </>
  );
}
