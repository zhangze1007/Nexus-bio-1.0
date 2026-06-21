'use client';
/**
 * RiskPanel — Detailed risk assessment display
 *
 * Shows full risk assessment with reason, trigger rule, and recommended action.
 * Reusable across all modules. Only displays — does not compute.
 */

import React from 'react';
import type { RiskAssessment } from '../../core/safety/riskModel';
import { getRiskColor, getRiskLabel } from '../../core/safety/riskModel';
import { RiskBadge } from './RiskBadge';

interface RiskPanelProps {
  assessment: RiskAssessment;
  /** Show the recommended action section */
  showAction?: boolean;
  /** Compact mode */
  compact?: boolean;
}

export function RiskPanel({ assessment, showAction = true, compact = false }: RiskPanelProps) {
  const color = getRiskColor(assessment.level);

  if (compact) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '4px 8px', background: `${color}08`, borderRadius: 6,
        border: `1px solid ${color}20`,
      }}>
        <RiskBadge level={assessment.level} score={assessment.score} size="sm" />
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{assessment.reason}</span>
      </div>
    );
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      borderRadius: 8,
      border: `1px solid ${color}30`,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', background: `${color}08`,
        borderBottom: `1px solid ${color}15`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RiskBadge level={assessment.level} score={assessment.score} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
            Rule: {assessment.triggerRule}
          </span>
        </div>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
          {assessment.canProceed ? '✓ Can proceed' : '✗ Blocked'}
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px' }}>
        <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>
          {assessment.reason}
        </p>

        {showAction && (
          <div style={{
            marginTop: 10, padding: '8px 10px',
            background: 'rgba(255,255,255,0.03)', borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Recommended Action
            </span>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>
              {assessment.recommendedAction}
            </p>
          </div>
        )}

        {assessment.requiresHumanReview && (
          <div style={{
            marginTop: 8, padding: '6px 10px',
            background: 'rgba(220,38,38,0.08)', borderRadius: 6,
            border: '1px solid rgba(220,38,38,0.15)',
            fontSize: 11, color: 'rgba(220,38,38,0.8)',
            fontWeight: 500,
          }}>
            ⚠ Human review required before proceeding
          </div>
        )}
      </div>
    </div>
  );
}
