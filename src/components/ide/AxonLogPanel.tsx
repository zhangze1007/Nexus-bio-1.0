'use client';
/**
 * AxonLogPanel — shared live execution trace.
 *
 * PR-4 requirement: "Users must be able to see what Axon is actually
 * doing, in a truthful way." This panel renders the bounded log from
 * the AxonOrchestratorProvider.
 *
 * Design rules:
 *   • Reverse-chronological — newest phase at the top.
 *   • Plain phase names (see phaseLabel); no fake spinners, no fake
 *     streaming tokens, no "thinking…" theatre.
 *   • Metadata is a small, optional <details> disclosure so the feed
 *     stays calm.
 *   • When the log is empty we say so plainly.
 */
import { useMemo, useState } from 'react';
import type { AxonLogEntry } from '../../services/axonExecutionLog';
import { phaseLabel } from '../../services/axonExecutionLog';
import { PATHD_THEME } from '../workbench/workbenchTheme';
import { T } from './tokens';

const PHASE_TONE: Record<string, { bg: string; border: string; fg: string }> = {
  'plan-created': { bg: 'rgba(175,195,214,0.14)', border: 'rgba(175,195,214,0.3)', fg: PATHD_THEME.value },
  'plan-warning': { bg: 'rgba(229,143,70,0.14)', border: 'rgba(229,143,70,0.34)', fg: '#E8C49A' },
  enqueued: { bg: 'rgba(175,195,214,0.12)', border: 'rgba(175,195,214,0.26)', fg: PATHD_THEME.value },
  'context-attached': { bg: 'rgba(207,196,227,0.14)', border: 'rgba(207,196,227,0.3)', fg: '#DDD0E8' },
  started: { bg: 'rgba(200,224,208,0.16)', border: 'rgba(200,224,208,0.32)', fg: '#C8E0D0' },
  'adapter-invoked': { bg: 'rgba(175,195,214,0.10)', border: 'rgba(175,195,214,0.22)', fg: PATHD_THEME.label },
  'writeback-emitted': { bg: 'rgba(147,203,82,0.12)', border: 'rgba(147,203,82,0.28)', fg: '#B8DE8A' },
  completed: { bg: 'rgba(147,203,82,0.16)', border: 'rgba(147,203,82,0.34)', fg: '#93CB52' },
  failed: { bg: 'rgba(250,128,114,0.14)', border: 'rgba(250,128,114,0.36)', fg: '#FA8072' },
  cancelled: { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.14)', fg: PATHD_THEME.label },
  interrupted: { bg: 'rgba(229,143,70,0.12)', border: 'rgba(229,143,70,0.3)', fg: '#E8C49A' },
  retried: { bg: 'rgba(175,195,214,0.14)', border: 'rgba(175,195,214,0.3)', fg: PATHD_THEME.value },
  reordered: { bg: 'rgba(175,195,214,0.10)', border: 'rgba(175,195,214,0.22)', fg: PATHD_THEME.label },
  'blocked-dependency': { bg: 'rgba(229,143,70,0.12)', border: 'rgba(229,143,70,0.3)', fg: '#E8C49A' },
  info: { bg: 'transparent', border: 'rgba(255,255,255,0.10)', fg: PATHD_THEME.label },
  planned: { bg: 'rgba(175,195,214,0.12)', border: 'rgba(175,195,214,0.24)', fg: PATHD_THEME.label },
};

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export interface AxonLogPanelProps {
  logs: AxonLogEntry[];
  /** Optional max rows rendered — the full log can be several hundred. */
  maxRows?: number;
  /** Compact mode drops padding for embedding inside slim panels. */
  compact?: boolean;
}

export default function AxonLogPanel({ logs, maxRows = 80, compact }: AxonLogPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sliced = useMemo(() => logs.slice(0, maxRows), [logs, maxRows]);

  if (sliced.length === 0) {
    return (
      <div
        data-testid="axon-log-empty"
        style={{
          padding: compact ? '10px 12px' : '14px',
          borderRadius: '10px',
          border: `1px dashed ${PATHD_THEME.sepiaPanelBorder}`,
          color: PATHD_THEME.label,
          fontFamily: T.SANS,
          fontSize: '11px',
          lineHeight: 1.5,
        }}
      >
        No execution trace yet. Enqueue a task or ask Axon to plan and the
        log will populate with honest lifecycle events.
      </div>
    );
  }

  return (
    <div
      data-testid="axon-log-panel"
      style={{
        display: 'grid',
        gap: '4px',
        fontFamily: T.MONO,
        fontSize: '10px',
      }}
    >
      {sliced.map((entry) => {
        const tone = PHASE_TONE[entry.phase] ?? PHASE_TONE.info;
        const hasMeta = entry.metadata && Object.keys(entry.metadata).length > 0;
        return (
          <div
            key={entry.id}
            data-testid={`axon-log-entry-${entry.phase}`}
            data-phase={entry.phase}
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto',
              alignItems: 'baseline',
              columnGap: '8px',
              padding: compact ? '4px 8px' : '6px 10px',
              borderRadius: '8px',
              border: `1px solid ${tone.border}`,
              background: tone.bg,
            }}
          >
            <span style={{ color: PATHD_THEME.label, whiteSpace: 'nowrap' }}>
              {formatTime(entry.timestamp)}
            </span>
            <div style={{ display: 'grid', gap: '2px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    color: tone.fg,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    fontSize: '9px',
                  }}
                >
                  {phaseLabel(entry.phase)}
                </span>
                {entry.tool && (
                  <span
                    style={{
                      padding: '1px 5px',
                      borderRadius: '4px',
                      background: 'rgba(10,14,22,0.45)',
                      color: PATHD_THEME.value,
                      fontSize: '8px',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {entry.tool}
                  </span>
                )}
                {entry.taskId && (
                  <span style={{ color: PATHD_THEME.label, fontSize: '8px' }}>
                    {entry.taskId}
                  </span>
                )}
              </div>
              <span
                style={{
                  fontFamily: T.SANS,
                  fontSize: '11px',
                  color: PATHD_THEME.value,
                  lineHeight: 1.4,
                  overflowWrap: 'anywhere',
                }}
              >
                {entry.message}
              </span>
              {hasMeta && expandedId === entry.id && (
                <pre
                  data-testid={`axon-log-meta-${entry.id}`}
                  style={{
                    margin: '4px 0 0',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    background: 'rgba(5,7,11,0.6)',
                    color: PATHD_THEME.label,
                    fontSize: '9px',
                    lineHeight: 1.4,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: '160px',
                    overflow: 'auto',
                  }}
                >
                  {JSON.stringify(entry.metadata, null, 2)}
                </pre>
              )}
            </div>
            {hasMeta ? (
              <button
                type="button"
                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                aria-label="Toggle metadata"
                data-testid={`axon-log-meta-toggle-${entry.id}`}
                style={{
                  padding: '2px 6px',
                  borderRadius: '4px',
                  border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
                  background: 'transparent',
                  color: PATHD_THEME.label,
                  fontSize: '9px',
                  cursor: 'pointer',
                }}
              >
                {expandedId === entry.id ? '–' : '+'}
              </button>
            ) : (
              <span />
            )}
          </div>
        );
      })}
    </div>
  );
}
