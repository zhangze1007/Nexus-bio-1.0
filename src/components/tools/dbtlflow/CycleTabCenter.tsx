'use client';
import React from 'react';
import type { DBTLIteration, DBTLPhase } from '../../../types';
import { THEME } from '../../../theme';
import ScientificFigureFrame from '../shared/ScientificFigureFrame';
import { PHASES, PHASE_PASTEL, Timeline, CycleProgressRing } from './sharedComponents';

/* ── Props ── */
interface CycleTabCenterProps {
  displayIterations: DBTLIteration[];
  currentPhase: DBTLPhase;
  passRate: string;
  bestIteration: DBTLIteration;
  hasCommittedFeedback: boolean;
  figureMeta: { eyebrow: string; title: string; caption: string };
  latestIteration: DBTLIteration | undefined;
}

export default function CycleTabCenter({
  displayIterations,
  currentPhase,
  passRate,
  bestIteration,
  hasCommittedFeedback,
  figureMeta,
  latestIteration,
}: CycleTabCenterProps) {
  return (
    <div className="nb-tool-center" style={{ flex: 1, background: THEME.sepiaPanelMuted, padding: '12px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <ScientificFigureFrame
        eyebrow={figureMeta.eyebrow}
        title={figureMeta.title}
        caption={figureMeta.caption}
        legend={[
          { label: 'Phase', value: currentPhase, accent: PHASE_PASTEL[currentPhase] },
          { label: 'Pass rate', value: `${passRate}%`, accent: THEME.mint },
          { label: 'Best result', value: `${bestIteration.result} ${bestIteration.unit}`, accent: THEME.apricot },
          { label: 'Feedback', value: hasCommittedFeedback ? 'Committed' : 'Draft only', accent: hasCommittedFeedback ? THEME.sky : THEME.coral },
        ]}
        footer={
          <div style={{ display: 'grid', gap: '6px' }}>
            <div style={{ fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-sm)', color: THEME.paperValue, lineHeight: 1.55 }}>
              The central panel now behaves like an experimental ledger figure. Phase state, campaign trajectory, and governance status stay in one reading path so loop health can be judged at a glance.
            </div>
            <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', color: THEME.paperLabel }}>
              latest iteration #{latestIteration?.id ?? '—'} · {latestIteration?.result ?? '—'} {latestIteration?.unit ?? ''} · feedback {hasCommittedFeedback ? 'requires approved delta' : 'still locked'}
            </div>
          </div>
        }
        minHeight="100%"
      >
        <div style={{ background: THEME.paperSurfaceStrong, border: `1px solid ${THEME.paperBorder}`, borderRadius: 'var(--nb-radius-xl)', padding: '8px 16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <CycleProgressRing currentPhase={currentPhase} iterationCount={displayIterations.length} />

          <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {PHASES.map(p => {
              const isActive = p === currentPhase;
              return (
                <div key={p} style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--nb-radius-sm)',
                  background: isActive ? `${PHASE_PASTEL[p]}33` : THEME.paperSurfaceMuted,
                  border: `1px solid ${isActive ? `${PHASE_PASTEL[p]}66` : THEME.paperBorder}`,
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: PHASE_PASTEL[p],
                    opacity: isActive ? 1 : 0.5,
                  }} />
                  <span style={{
                    fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xs)',
                    color: isActive ? THEME.paperValue : THEME.paperLabel,
                    fontWeight: isActive ? 600 : 400,
                  }}>
                    {p}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ minHeight: 0 }}>
          <Timeline iterations={displayIterations} />
        </div>
      </ScientificFigureFrame>
    </div>
  );
}
