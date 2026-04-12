'use client';

import { useMemo, useState } from 'react';
import type { RoundResult, VariantCandidate } from '../../../services/ProEvolCampaignEngine';
import { T } from '../../ide/tokens';
import {
  ProEvolCard,
  PROEVOL_THEME,
  StatusPill,
  formatSigned,
  tableCellStyle,
  tableHeaderStyle,
} from './shared';

type SortKey = 'score' | 'activity' | 'stability' | 'burden' | 'confidence' | 'status';
type SortDirection = 'asc' | 'desc';

const STATUS_ORDER: Record<VariantCandidate['status'], number> = {
  selected: 0,
  rejected: 1,
  'wild-type': 2,
};

function sortVariants(variants: VariantCandidate[], sortKey: SortKey, direction: SortDirection) {
  const factor = direction === 'asc' ? 1 : -1;
  return [...variants].sort((left, right) => {
    let difference = 0;
    if (sortKey === 'score') difference = left.score.composite - right.score.composite;
    if (sortKey === 'activity') difference = left.predictedActivity - right.predictedActivity;
    if (sortKey === 'stability') difference = left.predictedStability - right.predictedStability;
    if (sortKey === 'burden') difference = left.mutationBurden - right.mutationBurden;
    if (sortKey === 'confidence') difference = left.confidence - right.confidence;
    if (sortKey === 'status') difference = STATUS_ORDER[left.status] - STATUS_ORDER[right.status];
    if (difference !== 0) return difference * factor;
    return (left.libraryRank - right.libraryRank) * factor;
  });
}

function toneForStatus(status: VariantCandidate['status']) {
  if (status === 'selected') return 'cool' as const;
  if (status === 'rejected') return 'warm' as const;
  return 'neutral' as const;
}

export default function VariantLibraryTable({
  roundResult,
  selectedVariantId,
  onSelectVariant,
}: {
  roundResult: RoundResult;
  selectedVariantId: string | null;
  onSelectVariant: (variantId: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const variants = useMemo(
    () => sortVariants(roundResult.variantLibrary.candidates, sortKey, sortDirection),
    [roundResult.variantLibrary.candidates, sortDirection, sortKey],
  );

  function handleSort(nextKey: SortKey) {
    if (nextKey === sortKey) {
      setSortDirection((current) => current === 'desc' ? 'asc' : 'desc');
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === 'burden' || nextKey === 'status' ? 'asc' : 'desc');
  }

  return (
    <ProEvolCard
      eyebrow="Variant Library / Round Results"
      title={`Round ${roundResult.roundNumber} library ranking`}
      subtitle="Variants are ranked as campaign candidates, not abstract search steps. The table keeps survivors, rejected branches, burden, score deltas, and decision reasons in one auditable view."
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
          <thead>
            <tr>
              {[
                { label: 'Variant' },
                { label: 'Family' },
                { label: 'Mutation string' },
                { label: 'Score', sortKey: 'score' as SortKey },
                { label: 'ΔWT' },
                { label: 'Activity', sortKey: 'activity' as SortKey },
                { label: 'Stability', sortKey: 'stability' as SortKey },
                { label: 'Burden', sortKey: 'burden' as SortKey },
                { label: 'Confidence', sortKey: 'confidence' as SortKey },
                { label: 'Decision reason' },
              ].map(({ label, sortKey: columnSortKey }) => (
                <th key={label} style={tableHeaderStyle()}>
                  {columnSortKey ? (
                    <button
                      type="button"
                      onClick={() => handleSort(columnSortKey)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        color: PROEVOL_THEME.label,
                        fontFamily: T.MONO,
                        fontSize: '9px',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                      }}
                    >
                      {label}
                    </button>
                  ) : (
                    label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {variants.map((variant, index) => {
              const isSelected = selectedVariantId === variant.id;
              return (
                <tr
                  key={variant.id}
                  onClick={() => onSelectVariant(variant.id)}
                  style={{
                    cursor: 'pointer',
                    background: isSelected
                      ? 'rgba(175,195,214,0.12)'
                      : variant.status === 'selected'
                        ? 'rgba(191,220,205,0.06)'
                        : index % 2 === 0
                          ? 'transparent'
                          : 'rgba(255,255,255,0.015)',
                    borderBottom: `1px solid ${PROEVOL_THEME.border}`,
                  }}
                >
                  <td style={tableCellStyle()}>
                    <div style={{ display: 'grid', gap: '4px' }}>
                      <span style={{ fontFamily: T.SANS, fontWeight: 600 }}>{variant.name}</span>
                      <span style={{ fontFamily: T.MONO, fontSize: '9px', color: PROEVOL_THEME.label }}>
                        parent {variant.parentId ?? 'WT'} · rank {variant.libraryRank + 1}
                      </span>
                    </div>
                  </td>
                  <td style={tableCellStyle()}>
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <span>{variant.familyLabel}</span>
                      <StatusPill tone={toneForStatus(variant.status)}>{variant.status}</StatusPill>
                    </div>
                  </td>
                  <td style={{ ...tableCellStyle(), fontFamily: T.MONO }}>{variant.mutationString}</td>
                  <td style={{ ...tableCellStyle(), fontFamily: T.MONO }}>{variant.score.composite.toFixed(1)}</td>
                  <td style={{ ...tableCellStyle(), fontFamily: T.MONO, color: variant.score.deltaFromWildType >= 0 ? PROEVOL_THEME.mint : PROEVOL_THEME.coral }}>
                    {formatSigned(variant.score.deltaFromWildType, 1)}
                  </td>
                  <td style={{ ...tableCellStyle(), fontFamily: T.MONO }}>{variant.predictedActivity.toFixed(1)}</td>
                  <td style={{ ...tableCellStyle(), fontFamily: T.MONO }}>{variant.predictedStability.toFixed(1)}</td>
                  <td style={{ ...tableCellStyle(), fontFamily: T.MONO }}>
                    {variant.mutationBurden}
                    {variant.riskFlags.length ? (
                      <div style={{ fontSize: '9px', color: PROEVOL_THEME.label }}>{variant.riskFlags.join(', ')}</div>
                    ) : null}
                  </td>
                  <td style={{ ...tableCellStyle(), fontFamily: T.MONO }}>{variant.confidence.toFixed(1)}%</td>
                  <td style={{ ...tableCellStyle(), color: PROEVOL_THEME.muted, lineHeight: 1.55 }}>
                    {variant.status === 'selected' ? variant.selectionReason : variant.rejectionReason}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </ProEvolCard>
  );
}
