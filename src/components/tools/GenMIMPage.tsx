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
import ScientificFigureFrame from './shared/ScientificFigureFrame';
import ScientificMethodStrip from './shared/ScientificMethodStrip';

function GenomeMap({
  targets,
  selected,
  efficiencyThreshold,
}: {
  targets: CRISPRiTarget[];
  selected: CRISPRiTarget[];
  efficiencyThreshold: number;
}) {
  const W = 560, H = 560, cx = 280, cy = 280;
  const R_OUT = 240, R_IN = 200, R_EFF = 195;
  const GENOME_KB = 4641, GENE_KB = 80;
  const GAP = 0.018; // radians gap between gene arcs

  const selectedIds = new Set(selected.map(t => t.gene));
  const growthImpact = selected.reduce((a, t) => a + (t.growth_impact ?? 0), 0);
  const viability = Math.max(0, Math.round((1 + growthImpact) * 100));

  function posToRad(kb: number) {
    return (kb / GENOME_KB) * 2 * Math.PI - Math.PI / 2;
  }

  function mkArc(a1: number, a2: number, rOuter: number, rInner: number): string {
    if (a2 - a1 < 0.002) return '';
    const la = a2 - a1 > Math.PI ? 1 : 0;
    const x1o = cx + rOuter * Math.cos(a1), y1o = cy + rOuter * Math.sin(a1);
    const x2o = cx + rOuter * Math.cos(a2), y2o = cy + rOuter * Math.sin(a2);
    const x2i = cx + rInner * Math.cos(a2), y2i = cy + rInner * Math.sin(a2);
    const x1i = cx + rInner * Math.cos(a1), y1i = cy + rInner * Math.sin(a1);
    return `M ${x1o.toFixed(1)} ${y1o.toFixed(1)} A ${rOuter} ${rOuter} 0 ${la} 1 ${x2o.toFixed(1)} ${y2o.toFixed(1)} L ${x2i.toFixed(1)} ${y2i.toFixed(1)} A ${rInner} ${rInner} 0 ${la} 0 ${x1i.toFixed(1)} ${y1i.toFixed(1)} Z`;
  }

  function geneColor(t: CRISPRiTarget): string {
    if (selectedIds.has(t.gene)) return 'rgba(175,195,214,0.22)';
    if (t.essential) return PATHD_THEME.coral;
    if (t.knockdown_efficiency < efficiencyThreshold) return PATHD_THEME.apricot;
    return PATHD_THEME.mint;
  }

  const LEGEND = [
    { color: PATHD_THEME.coral, label: 'Essential' },
    { color: PATHD_THEME.apricot, label: 'Below threshold' },
    { color: PATHD_THEME.mint, label: 'Candidate' },
    { color: 'rgba(175,195,214,0.3)', label: 'Suppressed' },
  ];

  return (
    <svg role="img" aria-label="Circular E. coli genome map" viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={H} fill="#050505" rx="18" />

      {/* Title */}
      <text x="22" y="26" fontFamily={T.MONO} fontSize="9" fill="rgba(255,255,255,0.22)" letterSpacing="0.08em">
        E. COLI K-12 · 4.64 Mb
      </text>
      <text x="22" y="42" fontFamily={T.SANS} fontSize="12" fill="rgba(255,255,255,0.6)">
        CRISPRi target landscape
      </text>

      {/* Track backgrounds */}
      <circle cx={cx} cy={cy} r={(R_OUT + R_IN) / 2} fill="none"
        stroke="rgba(255,255,255,0.04)" strokeWidth={R_OUT - R_IN} />
      <circle cx={cx} cy={cy} r={(R_EFF + R_EFF - 60) / 2} fill="none"
        stroke="rgba(255,255,255,0.025)" strokeWidth={60} />
      <circle cx={cx} cy={cy} r={100} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={1} />

      {/* Compass tick marks */}
      {[0, 1, 2, 3].map(i => {
        const ang = i * Math.PI / 2 - Math.PI / 2;
        const x1 = cx + (R_OUT + 4) * Math.cos(ang), y1 = cy + (R_OUT + 4) * Math.sin(ang);
        const x2 = cx + (R_OUT + 10) * Math.cos(ang), y2 = cy + (R_OUT + 10) * Math.sin(ang);
        const tx = cx + (R_OUT + 20) * Math.cos(ang), ty = cy + (R_OUT + 20) * Math.sin(ang);
        const mb = ((i * GENOME_KB) / 4 / 1000).toFixed(2);
        return (
          <g key={i}>
            <line x1={x1.toFixed(1)} y1={y1.toFixed(1)} x2={x2.toFixed(1)} y2={y2.toFixed(1)}
              stroke="rgba(255,255,255,0.18)" strokeWidth={1} />
            <text x={tx.toFixed(1)} y={ty.toFixed(1)} textAnchor="middle" dominantBaseline="middle"
              fontFamily={T.MONO} fontSize="7" fill="rgba(255,255,255,0.28)">
              {mb}Mb
            </text>
          </g>
        );
      })}

      {/* Gene arcs — outer ring */}
      {targets.map(t => {
        const a1 = posToRad(t.position) + GAP;
        const a2 = posToRad(t.position + GENE_KB) - GAP;
        const d = mkArc(a1, a2, R_OUT, R_IN);
        if (!d) return null;
        const color = geneColor(t);
        const prominent = t.essential || selectedIds.has(t.gene);
        const aMid = (a1 + a2) / 2;
        const lx = cx + (R_OUT + 14) * Math.cos(aMid);
        const ly = cy + (R_OUT + 14) * Math.sin(aMid);
        // Rotate label tangent to arc; flip if in lower half
        const labelDeg = (aMid * 180 / Math.PI) + 90;
        const flip = aMid > Math.PI / 2 && aMid < 3 * Math.PI / 2;
        return (
          <g key={t.gene}>
            <path d={d} fill={color} opacity={selectedIds.has(t.gene) ? 0.7 : 0.88} />
            {prominent && (
              <text x={lx.toFixed(1)} y={ly.toFixed(1)}
                textAnchor="middle" dominantBaseline="middle"
                fontFamily={T.MONO} fontSize="6.5" fill={color}
                transform={`rotate(${(flip ? labelDeg + 180 : labelDeg).toFixed(1)}, ${lx.toFixed(1)}, ${ly.toFixed(1)})`}>
                {t.gene}
              </text>
            )}
          </g>
        );
      })}

      {/* CRISPRi efficiency bars — inner ring */}
      {targets.filter(t => !t.essential).map(t => {
        const aMid = posToRad(t.position + GENE_KB / 2);
        const barHalf = 0.04;
        const a1 = aMid - barHalf;
        const a2 = aMid + barHalf;
        const depth = t.knockdown_efficiency * 55;
        const d = mkArc(a1, a2, R_EFF, R_EFF - depth);
        if (!d) return null;
        const color = selectedIds.has(t.gene) ? PATHD_THEME.apricot : PATHD_THEME.sky;
        return <path key={`eff-${t.gene}`} d={d} fill={color} opacity={0.72} />;
      })}

      {/* KD efficiency threshold arc indicator */}
      <circle cx={cx} cy={cy} r={R_EFF - efficiencyThreshold * 55}
        fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={1} strokeDasharray="3 5" />

      {/* Center viability */}
      <text x={cx} y={cy - 12} textAnchor="middle" fontFamily={T.MONO}
        fontSize="30" fontWeight="700" fill="rgba(255,255,255,0.92)">
        {viability}%
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontFamily={T.MONO}
        fontSize="9" fill="rgba(255,255,255,0.32)" letterSpacing="0.12em">
        VIABILITY
      </text>
      <text x={cx} y={cy + 28} textAnchor="middle" fontFamily={T.MONO}
        fontSize="8" fill="rgba(255,255,255,0.2)">
        {selected.length} target{selected.length !== 1 ? 's' : ''} suppressed
      </text>

      {/* Legend */}
      {LEGEND.map((item, i) => (
        <g key={item.label} transform={`translate(${22 + i * 128}, ${H - 22})`}>
          <rect width={9} height={9} fill={item.color} rx="2" />
          <text x={13} y={8.5} fontFamily={T.SANS} fontSize="8.5" fill="rgba(255,255,255,0.5)">
            {item.label}
          </text>
        </g>
      ))}

      {/* Inner ring label */}
      <text x={cx + R_EFF - 30} y={cy - 2} textAnchor="middle" fontFamily={T.MONO}
        fontSize="6.5" fill="rgba(55,126,184,0.55)">
        KD eff
      </text>
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
  const figureMeta = useMemo(() => ({
    eyebrow: 'Genome minimization map',
    title: 'CRISPRi target landscape, selected schedule, and viability ledger are read as one chassis figure',
    caption: 'The page now treats chassis minimization as a genome-scale scientific figure rather than a parameter form, so suppression logic, viability, and target evidence stay in one reading surface.',
  }), []);

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
      <div className="nb-tool-page" style={{ background: PATHD_THEME.sepiaPanelMuted }}>
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

        <div style={{ padding: '0 16px 10px' }}>
          <ScientificMethodStrip
            label="Chassis bench"
            items={[
              {
                title: 'Suppression policy',
                detail: 'Efficiency threshold, target budget, and essential-gene protection now read as one minimization policy rather than disconnected control toggles.',
                accent: PATHD_THEME.apricot,
                note: `${maxTargets} target budget · ${(efficiency * 100).toFixed(0)}% minimum KD`,
              },
              {
                title: 'Genome figure',
                detail: 'The circular genome map becomes the main scientific figure, with selected targets, essential regions, and knockdown strength on one chassis canvas.',
                accent: PATHD_THEME.sky,
                note: `${schedule.length} selected targets`,
              },
              {
                title: 'Viability ledger',
                detail: 'Growth impact, average efficiency, and off-target burden remain visible so genome reduction stays grounded in host survival.',
                accent: PATHD_THEME.mint,
                note: `${(avgEfficiency * 100).toFixed(1)}% average KD`,
              },
            ]}
          />
        </div>

        {simError && (
          <div style={{ padding: '0 16px 8px' }}><SimErrorBanner message={simError} /></div>
        )}

        <div className="nb-tool-panels" style={{ flex: 1 }}>
          {/* Input panel */}
          <div className="nb-tool-sidebar" style={{ width: '240px', borderRight: `1px solid ${PATHD_THEME.paperBorder}`, background: PATHD_THEME.sepiaPanelMuted }}>
            <WorkbenchInlineContext
              toolId="genmim"
              title="Gene Minimization"
              summary="Translate analyzed bottlenecks into chassis-level genome minimization hypotheses so Stage 3 interventions remain linked to the same project object."
              compact
              isSimulated={!analyzeArtifact}
            />

            <p style={{ fontFamily: T.SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: PATHD_THEME.paperLabel, margin: '0 0 12px' }}>
              CRISPRi Parameters
            </p>

            {[
              { label: 'Min. knockdown efficiency', value: efficiency, min: 0.5, max: 1.0, step: 0.01, set: setEfficiency, display: (v: number) => `${(v * 100).toFixed(0)}%` },
              { label: 'Max targets', value: maxTargets, min: 1, max: 15, step: 1, set: setMaxTargets, display: (v: number) => `${v}` },
            ].map(s => (
              <div key={s.label} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontFamily: T.SANS, fontSize: '11px', color: PATHD_THEME.paperLabel }}>{s.label}</span>
                  <span style={{ fontFamily: T.MONO, fontSize: '11px', color: PATHD_THEME.paperValue }}>{s.display(s.value)}</span>
                </div>
                <input aria-label="Parameter slider" type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                  onChange={e => s.set(parseFloat(e.target.value) as never)}
                  className="nb-pathd-slider"
                  style={{ '--val': `${((s.value - s.min) / (s.max - s.min)) * 100}%` } as React.CSSProperties} />
              </div>
            ))}

            <button aria-label="Action" onClick={() => setProtectEssential(!protectEssential)} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              width: '100%', padding: '7px 10px', marginBottom: '16px',
              background: protectEssential ? 'rgba(231,199,169,0.18)' : PATHD_THEME.paperSurfaceStrong,
              border: `1px solid ${protectEssential ? 'rgba(231,199,169,0.34)' : PATHD_THEME.paperBorder}`,
              borderRadius: '8px', cursor: 'pointer',
              color: protectEssential ? PATHD_THEME.paperValue : PATHD_THEME.paperLabel,
              fontFamily: T.SANS, fontSize: '11px', textAlign: 'left',
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: protectEssential ? PATHD_THEME.apricot : 'transparent', border: `1px solid ${PATHD_THEME.apricot}`, flexShrink: 0 }} />
              Protect essential genes
            </button>

            <p style={{ fontFamily: T.SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: PATHD_THEME.paperLabel, margin: '0 0 8px' }}>
              Knockdown Schedule ({schedule.length} targets)
            </p>
            {schedule.map(t => (
              <div key={t.gene} style={{
                padding: '6px 8px', marginBottom: '4px',
                background: 'rgba(232,163,161,0.12)',
                border: '1px solid rgba(232,163,161,0.28)',
                borderRadius: '8px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: T.MONO, fontSize: '10px', color: PATHD_THEME.paperValue }}>{t.gene}</span>
                  <span style={{ fontFamily: T.MONO, fontSize: '10px', color: PATHD_THEME.paperLabel }}>{(t.knockdown_efficiency * 100).toFixed(0)}% KD</span>
                </div>
                <div style={{ fontFamily: T.SANS, fontSize: '10px', color: PATHD_THEME.paperLabel, marginTop: '2px' }}>
                  {t.phenotype} · GI: {((t.growth_impact ?? 0) * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>

          {/* Engine view — genome map + table */}
          <div className="nb-tool-center" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: PATHD_THEME.sepiaPanelMuted, minWidth: 0, padding: '12px' }}>
            <ScientificFigureFrame
              eyebrow={figureMeta.eyebrow}
              title={figureMeta.title}
              caption={figureMeta.caption}
              legend={[
                { label: 'Targets', value: `${schedule.length}`, accent: PATHD_THEME.coral },
                { label: 'Protection', value: protectEssential ? 'Essential on' : 'Aggressive', accent: PATHD_THEME.apricot },
                { label: 'Avg KD', value: `${(avgEfficiency * 100).toFixed(1)}%`, accent: PATHD_THEME.mint },
                { label: 'Growth', value: `${(growthImpact * 100).toFixed(1)}%`, accent: PATHD_THEME.sky },
              ]}
              footer={
                <div style={{ display: 'grid', gap: '6px' }}>
                  <div style={{ fontFamily: T.SANS, fontSize: '11px', color: PATHD_THEME.paperValue, lineHeight: 1.55 }}>
                    The page now keeps the selected schedule, full target ledger, and circular genome context in one figure so chassis-minimization decisions can be defended visually and biologically.
                  </div>
                  <div style={{ fontFamily: T.MONO, fontSize: '10px', color: PATHD_THEME.paperLabel }}>
                    recommended baseline {recommendedTargets} targets · {(recommendedEfficiency * 100).toFixed(0)}% KD · off-target {(offTargetRisk * 100).toFixed(0)}%
                  </div>
                </div>
              }
              minHeight="100%"
            >
              <div style={{ paddingBottom: '12px', borderBottom: `1px solid ${PATHD_THEME.paperBorder}`, flexShrink: 0 }}>
                <GenomeMap targets={CRISPRI_TARGETS} selected={schedule} efficiencyThreshold={efficiency} />
              </div>
              <div style={{ paddingTop: '12px', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${PATHD_THEME.paperBorderStrong}` }}>
                      {['Gene', 'Position', 'Essential', 'KD Eff.', 'Phenotype', 'Growth ΔΔ'].map(h => (
                        <th key={h} style={{ fontFamily: T.MONO, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.06em', color: PATHD_THEME.paperLabel, padding: '5px 8px', textAlign: 'left' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {CRISPRI_TARGETS.map((t, i) => {
                      const isSelected = schedule.some(s => s.gene === t.gene);
                      return (
                        <tr key={t.gene} style={{ background: isSelected ? 'rgba(232,163,161,0.10)' : i % 2 === 0 ? 'transparent' : PATHD_THEME.paperSurfaceMuted }}>
                          <td style={{ fontFamily: T.MONO, fontSize: '10px', padding: '4px 8px', color: isSelected ? PATHD_THEME.paperValue : PATHD_THEME.paperValue }}>{t.gene}</td>
                          <td style={{ fontFamily: T.MONO, fontSize: '10px', padding: '4px 8px', color: PATHD_THEME.paperLabel }}>{t.position.toLocaleString()}</td>
                          <td style={{ fontFamily: T.MONO, fontSize: '10px', padding: '4px 8px', color: t.essential ? PATHD_THEME.apricot : PATHD_THEME.paperLabel }}>{t.essential ? 'YES' : 'no'}</td>
                          <td style={{ fontFamily: T.MONO, fontSize: '10px', padding: '4px 8px', color: PATHD_THEME.paperValue }}>{t.essential ? '—' : `${(t.knockdown_efficiency * 100).toFixed(0)}%`}</td>
                          <td style={{ fontFamily: T.SANS, fontSize: '10px', padding: '4px 8px', color: PATHD_THEME.paperLabel }}>{t.phenotype}</td>
                          <td style={{ fontFamily: T.MONO, fontSize: '10px', padding: '4px 8px', color: PATHD_THEME.paperLabel }}>{t.essential ? '—' : `${((t.growth_impact ?? 0) * 100).toFixed(0)}%`}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </ScientificFigureFrame>
          </div>

          {/* Results panel */}
          <div className="nb-tool-right" style={{ width: '200px', borderLeft: `1px solid ${PATHD_THEME.paperBorder}`, background: PATHD_THEME.sepiaPanelMuted }}>
            <p style={{ fontFamily: T.SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: PATHD_THEME.paperLabel, margin: '0 0 12px' }}>
              Predicted Impact
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <MetricCard label="Targets Selected" value={schedule.length} highlight />
              <MetricCard label="Total Growth Impact" value={(growthImpact * 100).toFixed(1)} unit="%"
                warning={Math.abs(growthImpact) > 0.4 ? 'Growth penalty >40% — review schedule' : undefined} />
              <MetricCard label="Avg KD Efficiency" value={(avgEfficiency * 100).toFixed(1)} unit="%" />
              <MetricCard label="Off-target Risk" value={(offTargetRisk * 100).toFixed(0)} unit="%" />
            </div>

            <div style={{
              marginTop: '12px',
              padding: '12px',
              borderRadius: '12px',
              border: `1px solid ${PATHD_THEME.paperBorder}`,
              background: PATHD_THEME.paperSurfaceStrong,
              display: 'grid',
              gap: '6px',
            }}>
              <div style={{ fontFamily: T.MONO, fontSize: '9px', color: PATHD_THEME.paperLabel, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Readout
              </div>
              <div style={{ fontFamily: T.SANS, fontSize: '11px', color: PATHD_THEME.paperValue, lineHeight: 1.55 }}>
                {protectEssential
                  ? 'The current schedule is conservative enough to behave like a viable chassis-editing proposal rather than an aggressive pruning experiment.'
                  : 'Aggressive pruning is enabled, so this schedule should be interpreted as a stress-test of the chassis boundary rather than a default plan.'}
              </div>
            </div>
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${PATHD_THEME.paperBorder}`, padding: '8px 16px', display: 'flex', gap: '8px', flexShrink: 0, background: PATHD_THEME.sepiaPanelMuted }}>
          <ExportButton label="Export Schedule JSON" data={schedule} filename="genmim-schedule" format="json" />
          <ExportButton label="Export All Targets CSV" data={CRISPRI_TARGETS} filename="genmim-targets" format="csv" />
        </div>
      </div>
    </>
  );
}
