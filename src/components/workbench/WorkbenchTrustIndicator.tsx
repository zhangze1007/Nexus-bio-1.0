'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, ShieldAlert, ShieldX, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { useWorkbenchStore } from '../../store/workbenchStore';
import type { GateDecision, GateStatus, ClaimSurface } from '../../protocol/nexusTrustRuntime';
import type { ClaimSurfaceBlockCode } from '../../domain/claimSurfacePolicy';
import { CLAIM_SURFACE_REASON_CATALOG } from '../../domain/claimSurfaceReasonCatalog';
import { THEME } from '../../theme';

// ── Status visual mapping ──────────────────────────────────────────────

interface StatusVisual {
  icon: typeof ShieldCheck;
  label: string;
  color: string;
  border: string;
  background: string;
}

const STATUS_VISUALS: Record<GateStatus, StatusVisual> = {
  ok: {
    icon: ShieldCheck,
    label: 'OK',
    color: THEME.MINT,
    border: 'rgba(191,220,205,0.30)',
    background: 'rgba(191,220,205,0.08)',
  },
  demoOnly: {
    icon: Eye,
    label: 'Demo Only',
    color: THEME.APRICOT,
    border: 'rgba(231,199,169,0.30)',
    background: 'rgba(231,199,169,0.08)',
  },
  gated: {
    icon: ShieldAlert,
    label: 'Gated',
    color: THEME.APRICOT,
    border: 'rgba(231,199,169,0.30)',
    background: 'rgba(231,199,169,0.10)',
  },
  blocked: {
    icon: ShieldX,
    label: 'Blocked',
    color: THEME.CORAL,
    border: 'rgba(232,163,161,0.32)',
    background: 'rgba(232,163,161,0.10)',
  },
};

// ── Block code to user-facing action mapping ───────────────────────────

interface CompletionAction {
  label: string;
  description: string;
}

function getCompletionAction(blockCode: ClaimSurfaceBlockCode | undefined, decision: GateDecision): CompletionAction | null {
  if (!blockCode) return null;

  const reason = CLAIM_SURFACE_REASON_CATALOG[blockCode];
  if (!reason) return null;

  switch (blockCode) {
    case 'PROVENANCE_REQUIRED':
      return {
        label: 'Re-run with provenance',
        description: reason.suggestedAction,
      };
    case 'HUMAN_GATE_REQUIRED':
      return decision.overridePath === 'human-review'
        ? { label: 'Request human review', description: reason.suggestedAction }
        : { label: 'Pending review', description: reason.suggestedAction };
    case 'TIER_NOT_ALLOWED_FOR_SURFACE':
      return { label: 'Upgrade validity tier', description: reason.suggestedAction };
    case 'DRAFT_OUTPUT_NOT_EXPORTABLE':
      return { label: 'Commit output', description: reason.suggestedAction };
    case 'DEMO_OUTPUT_PROTOCOL_BLOCKED':
      return { label: 'Use as exploratory only', description: reason.suggestedAction };
    case 'EXTERNAL_HANDOFF_BLOCKED':
      return { label: 'Keep in workbench', description: reason.suggestedAction };
    case 'MISSING_POLICY':
      return { label: 'Define policy', description: reason.suggestedAction };
    default:
      return { label: 'Resolve', description: reason.suggestedAction };
  }
}

// ── Missing items analysis ─────────────────────────────────────────────

interface MissingItem {
  id: string;
  label: string;
  color: string;
}

function getMissingItems(decision: GateDecision): MissingItem[] {
  const items: MissingItem[] = [];
  const blockCode = decision.blockCode as ClaimSurfaceBlockCode | undefined;

  if (blockCode === 'PROVENANCE_REQUIRED') {
    items.push({ id: 'provenance', label: 'Provenance', color: THEME.SKY });
  }
  if (blockCode === 'HUMAN_GATE_REQUIRED') {
    items.push({ id: 'human-gate', label: 'Human Gate', color: THEME.LILAC });
  }
  if (decision.blockedSurfaces.length > 0) {
    items.push({ id: 'evidence', label: 'Evidence', color: THEME.APRICOT });
  }
  if (blockCode === 'TIER_NOT_ALLOWED_FOR_SURFACE') {
    items.push({ id: 'validity', label: 'Higher Validity Tier', color: THEME.CORAL });
  }

  return items;
}

// ── Props ──────────────────────────────────────────────────────────────

export interface WorkbenchTrustIndicatorProps {
  /** Tool ID to show trust status for (e.g. 'fbasim') */
  toolId: string;
  /** Compact mode — single-line chip; expanded mode shows details */
  compact?: boolean;
  /** Surface to display (defaults to 'payload') */
  surface?: ClaimSurface;
  /** Called when user clicks a completion action */
  onAction?: (action: string, toolId: string) => void;
}

// ── Component ──────────────────────────────────────────────────────────

export default function WorkbenchTrustIndicator({
  toolId,
  compact = false,
  surface = 'payload',
  onAction,
}: WorkbenchTrustIndicatorProps) {
  const [expanded, setExpanded] = useState(false);

  const decision = useWorkbenchStore(
    (s) => s.payloadAdmissionDecisionsByToolId[toolId],
  );

  // No decision recorded yet — tool hasn't run
  if (!decision) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          height: compact ? '22px' : '26px',
          padding: '0 8px',
          borderRadius: '999px',
          border: `1px solid ${THEME.BORDER}`,
          background: 'rgba(255,255,255,0.03)',
          fontFamily: THEME.MONO,
          fontSize: '10px',
          color: THEME.LABEL,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        <ShieldCheck size={compact ? 11 : 13} color="rgba(226,232,240,0.3)" />
        No trust data
      </div>
    );
  }

  const visual = STATUS_VISUALS[decision.status];
  const Icon = visual.icon;
  const blockCode = decision.blockCode as ClaimSurfaceBlockCode | undefined;
  const completionAction = getCompletionAction(blockCode, decision);
  const missingItems = getMissingItems(decision);
  const reasonCatalog = blockCode ? CLAIM_SURFACE_REASON_CATALOG[blockCode] : null;

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-label={`Trust status: ${visual.label}. ${decision.reason}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          height: '22px',
          padding: '0 8px',
          borderRadius: '999px',
          border: `1px solid ${visual.border}`,
          background: visual.background,
          fontFamily: THEME.MONO,
          fontSize: '10px',
          color: visual.color,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          transition: 'background 0.15s ease, border-color 0.15s ease',
          whiteSpace: 'nowrap',
        }}
      >
        <Icon size={11} color={visual.color} />
        {visual.label}
        {missingItems.length > 0 && (
          <span
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '999px',
              background: visual.color,
              marginLeft: '2px',
            }}
          />
        )}
      </button>
    );
  }

  // ── Full expanded card ──
  return (
    <div
      style={{
        borderRadius: '12px',
        border: `1px solid ${visual.border}`,
        background: visual.background,
        padding: '10px 12px',
        display: 'grid',
        gap: '8px',
        transition: 'border-color 0.2s ease',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
          <Icon size={15} color={visual.color} style={{ flexShrink: 0 }} />
          <div style={{ display: 'grid', gap: '2px', minWidth: 0 }}>
            <div
              style={{
                fontFamily: THEME.MONO,
                fontSize: '11px',
                color: visual.color,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontWeight: 600,
              }}
            >
              Trust: {visual.label}
            </div>
            <div
              style={{
                fontFamily: THEME.SANS,
                fontSize: '11px',
                color: THEME.LABEL,
                lineHeight: 1.4,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={decision.reason}
            >
              {decision.reason}
            </div>
          </div>
        </div>
        {decision.blockCode && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse details' : 'Expand details'}
            style={{
              width: '22px',
              height: '22px',
              borderRadius: '999px',
              border: `1px solid ${THEME.BORDER}`,
              background: 'rgba(255,255,255,0.04)',
              color: THEME.LABEL,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}
      </div>

      {/* Missing items chips */}
      {missingItems.length > 0 && (
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          {missingItems.map((item) => (
            <span
              key={item.id}
              style={{
                borderRadius: '999px',
                border: `1px solid ${item.color}33`,
                background: `${item.color}12`,
                padding: '2px 7px',
                fontFamily: THEME.MONO,
                fontSize: '10px',
                color: item.color,
                lineHeight: 1.3,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span
                style={{
                  width: '4px',
                  height: '4px',
                  borderRadius: '999px',
                  background: item.color,
                }}
              />
              {item.label}
            </span>
          ))}
        </div>
      )}

      {/* Allowed / Blocked surfaces */}
      {(decision.allowedSurfaces.length > 0 || decision.blockedSurfaces.length > 0) && (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {decision.allowedSurfaces.map((s) => (
            <span
              key={`allow-${s}`}
              style={{
                borderRadius: '999px',
                border: '1px solid rgba(191,220,205,0.18)',
                background: 'rgba(191,220,205,0.06)',
                padding: '1px 6px',
                fontFamily: THEME.MONO,
                fontSize: '9px',
                color: 'rgba(191,220,205,0.7)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {s}
            </span>
          ))}
          {decision.blockedSurfaces.map((s) => (
            <span
              key={`block-${s}`}
              style={{
                borderRadius: '999px',
                border: '1px solid rgba(232,163,161,0.18)',
                background: 'rgba(232,163,161,0.06)',
                padding: '1px 6px',
                fontFamily: THEME.MONO,
                fontSize: '9px',
                color: 'rgba(232,163,161,0.6)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                textDecoration: 'line-through',
              }}
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Expanded detail section */}
      <AnimatePresence>
        {expanded && reasonCatalog && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                borderTop: `1px solid ${THEME.BORDER}`,
                paddingTop: '8px',
                display: 'grid',
                gap: '6px',
              }}
            >
              {/* Block code */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    fontFamily: THEME.MONO,
                    fontSize: '10px',
                    color: THEME.LABEL,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  Code:
                </span>
                <span
                  style={{
                    fontFamily: THEME.MONO,
                    fontSize: '10px',
                    color: visual.color,
                    background: `${visual.color}15`,
                    padding: '1px 6px',
                    borderRadius: '4px',
                  }}
                >
                  {decision.blockCode}
                </span>
              </div>

              {/* Explanation */}
              <div
                style={{
                  fontFamily: THEME.SANS,
                  fontSize: '11px',
                  color: THEME.LABEL,
                  lineHeight: 1.5,
                }}
              >
                {reasonCatalog.explanation}
              </div>

              {/* Completion action */}
              {completionAction && (
                <button
                  type="button"
                  onClick={() => onAction?.(decision.blockCode ?? 'unknown', toolId)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '5px 10px',
                    borderRadius: '8px',
                    border: `1px solid ${visual.border}`,
                    background: `${visual.color}12`,
                    color: visual.color,
                    fontFamily: THEME.SANS,
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                    alignSelf: 'start',
                  }}
                >
                  {completionAction.label}
                </button>
              )}

              {/* Override path */}
              {decision.overridePath && decision.overridePath !== 'not-allowed' && (
                <div
                  style={{
                    fontFamily: THEME.MONO,
                    fontSize: '10px',
                    color: THEME.LILAC,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span style={{ width: '4px', height: '4px', borderRadius: '999px', background: THEME.LILAC }} />
                  Override: {decision.overridePath}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
