'use client';

import { useMemo } from 'react';
import { T } from '../../../ide/tokens';
import { PROEVOL_THEME, tableHeaderStyle, tableCellStyle, formatSigned } from '../shared';
import type { VariantEnrichmentEntry } from '../../../../services/proevolAnalysis';

interface VariantEvidenceTableProps {
  entries: VariantEnrichmentEntry[];
  highlightVariantId?: string | null;
  onSelectVariant?: (variantId: string) => void;
}

export default function VariantEvidenceTable({
  entries,
  highlightVariantId,
  onSelectVariant,
}: VariantEvidenceTableProps) {
  const sorted = useMemo(
    () => [...entries].sort((left, right) => right.log2EnrichmentVsWildType - left.log2EnrichmentVsWildType).slice(0, 12),
    [entries],
  );

  if (!sorted.length) {
    return (
      <div
        style={{
          padding: '20px',
          textAlign: 'center',
          fontFamily: T.SANS,
          fontSize: 12,
          color: PROEVOL_THEME.muted,
        }}
      >
        No variant entries to score yet. Run the campaign or upload an artifact.
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={tableHeaderStyle()}>Variant</th>
            <th style={tableHeaderStyle()}>Family</th>
            <th style={tableHeaderStyle()}>Mutations</th>
            <th style={{ ...tableHeaderStyle(), textAlign: 'right' }}>Burden</th>
            <th style={{ ...tableHeaderStyle(), textAlign: 'right' }}>Final freq.</th>
            <th style={{ ...tableHeaderStyle(), textAlign: 'right' }}>log₂ vs WT</th>
            <th style={{ ...tableHeaderStyle(), textAlign: 'right' }}>Selection s̄</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry) => {
            const isHighlighted = highlightVariantId === entry.variantId;
            return (
              <tr
                key={entry.variantId}
                onClick={() => onSelectVariant?.(entry.variantId)}
                style={{
                  cursor: onSelectVariant ? 'pointer' : 'default',
                  background: isHighlighted ? `${PROEVOL_THEME.successHigh}10` : 'transparent',
                  borderBottom: `1px solid ${PROEVOL_THEME.border}`,
                }}
              >
                <td style={{ ...tableCellStyle(), fontFamily: T.MONO, fontWeight: 600 }}>{entry.label}</td>
                <td style={tableCellStyle()}>{entry.familyLabel}</td>
                <td style={{ ...tableCellStyle(), fontFamily: T.MONO, fontSize: 10, color: PROEVOL_THEME.muted }}>
                  {entry.mutationString}
                </td>
                <td style={{ ...tableCellStyle(), textAlign: 'right', fontFamily: T.MONO }}>{entry.mutationBurden}</td>
                <td style={{ ...tableCellStyle(), textAlign: 'right', fontFamily: T.MONO }}>
                  {(entry.finalFrequency * 100).toFixed(2)}%
                  <div style={{ fontSize: 9, color: PROEVOL_THEME.muted }}>
                    [{(entry.finalFrequencyCi.lower * 100).toFixed(2)}–{(entry.finalFrequencyCi.upper * 100).toFixed(2)}%]
                  </div>
                </td>
                <td
                  style={{
                    ...tableCellStyle(),
                    textAlign: 'right',
                    fontFamily: T.MONO,
                    color:
                      entry.log2EnrichmentVsWildType > 0
                        ? PROEVOL_THEME.successHigh
                        : entry.log2EnrichmentVsWildType < -0.5
                          ? PROEVOL_THEME.riskMedium
                          : PROEVOL_THEME.value,
                  }}
                >
                  {formatSigned(entry.log2EnrichmentVsWildType, 2)}
                </td>
                <td
                  style={{
                    ...tableCellStyle(),
                    textAlign: 'right',
                    fontFamily: T.MONO,
                    color:
                      entry.meanSelectionCoefficient > 0
                        ? PROEVOL_THEME.successHigh
                        : entry.meanSelectionCoefficient < 0
                          ? PROEVOL_THEME.riskMedium
                          : PROEVOL_THEME.value,
                  }}
                >
                  {formatSigned(entry.meanSelectionCoefficient, 2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div
        style={{
          fontFamily: T.SANS,
          fontSize: 10,
          color: PROEVOL_THEME.muted,
          padding: '8px 4px 0',
          lineHeight: 1.55,
        }}
      >
        Top 12 variants by log₂ enrichment vs wild type. Frequency CIs computed from per-replicate variance (two-sided 95%).
        Selection coefficient s̄ is the mean across consecutive rounds of ln(f<sub>t</sub> / f<sub>t-1</sub>).
      </div>
    </div>
  );
}
