'use client';
/**
 * AgentSessionViewer — PR-5 session-first NEXAI surface.
 *
 * This is the center of gravity for the new Axon agent experience. It
 * consumes the derived session from AxonOrchestratorProvider and renders
 * one coherent "what did Axon just do, and what is it doing now?" view.
 *
 * Honesty rules (non-negotiable):
 *   • Every step card is bound to a real plan step, log phase, or task —
 *     the derivation in axonSessionView enforces this. No "thinking…" or
 *     "searching the web…" cards are ever fabricated here.
 *   • Previews render the exact shape emitted by the derivation. When a
 *     preview is `unavailable`, we show the plain reason, never a
 *     placeholder value.
 *   • Off-domain sessions display only the classification and advisory
 *     card; the biosynthesis planner never runs for them.
 *   • Final outcome cards distinguish completed / partial / failed /
 *     cancelled / interrupted / off-domain / unsupported visually and
 *     textually — they are not collapsed into a single "done" state.
 *
 * The component is read-only: it does not enqueue, cancel, or mutate
 * anything. Actions belong to AutomationDrawer and the PlanPanel.
 */
import { useMemo } from 'react';
import type {
  AxonSession,
  AxonSessionStep,
  AxonSessionStepStatus,
  AxonSessionPreview,
  AxonSessionStatus,
} from '../../services/axonSessionView';
import {
  sessionStatusLabel,
  sessionStepStatusLabel,
} from '../../services/axonSessionView';
import { domainCategoryLabel } from '../../services/axonDomainClassifier';
import { PATHD_THEME } from '../workbench/workbenchTheme';
import { T } from './tokens';

const STATUS_TONE: Record<AxonSessionStatus, { fg: string; dot: string; label: string }> = {
  idle:        { fg: PATHD_THEME.label,  dot: 'rgba(255,255,255,0.18)', label: 'Idle' },
  planning:    { fg: PATHD_THEME.value,  dot: '#AFC3D6',                 label: 'Planning' },
  running:     { fg: '#93CB52',          dot: '#93CB52',                 label: 'Running' },
  waiting:     { fg: '#E7C7A9',          dot: '#E7C7A9',                 label: 'Waiting' },
  completed:   { fg: '#93CB52',          dot: '#93CB52',                 label: 'Completed' },
  partial:     { fg: '#E7C7A9',          dot: '#E7C7A9',                 label: 'Partial' },
  failed:      { fg: '#FA8072',          dot: '#FA8072',                 label: 'Failed' },
  cancelled:   { fg: PATHD_THEME.label,  dot: 'rgba(255,255,255,0.40)', label: 'Cancelled' },
  interrupted: { fg: '#E7C7A9',          dot: '#E7C7A9',                 label: 'Interrupted' },
  'off-domain':{ fg: '#CFC4E3',          dot: '#CFC4E3',                 label: 'Off-domain' },
  unsupported: { fg: '#E7C7A9',          dot: '#E7C7A9',                 label: 'Unsupported' },
};

const STEP_STATUS_TONE: Record<AxonSessionStepStatus, { fg: string; border: string; bg: string }> = {
  planned:      { fg: PATHD_THEME.label, border: 'rgba(175,195,214,0.26)', bg: 'rgba(175,195,214,0.08)' },
  running:      { fg: '#93CB52',          border: 'rgba(147,203,82,0.42)',  bg: 'rgba(147,203,82,0.14)' },
  waiting:      { fg: '#E7C7A9',          border: 'rgba(231,199,169,0.38)', bg: 'rgba(231,199,169,0.10)' },
  done:         { fg: '#93CB52',          border: 'rgba(147,203,82,0.36)',  bg: 'rgba(147,203,82,0.10)' },
  failed:       { fg: '#FA8072',          border: 'rgba(250,128,114,0.42)', bg: 'rgba(250,128,114,0.12)' },
  cancelled:    { fg: PATHD_THEME.label,  border: 'rgba(255,255,255,0.18)', bg: 'rgba(255,255,255,0.04)' },
  unsupported:  { fg: '#E7C7A9',          border: 'rgba(231,199,169,0.38)', bg: 'rgba(231,199,169,0.10)' },
  blocked:      { fg: '#E7C7A9',          border: 'rgba(231,199,169,0.38)', bg: 'rgba(231,199,169,0.10)' },
  interrupted:  { fg: '#E7C7A9',          border: 'rgba(231,199,169,0.38)', bg: 'rgba(231,199,169,0.10)' },
  info:         { fg: PATHD_THEME.label,  border: 'rgba(255,255,255,0.12)', bg: 'rgba(255,255,255,0.04)' },
};

function formatTime(ms: number | undefined | null): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDuration(startedAt?: number, finishedAt?: number): string {
  if (!startedAt || !finishedAt) return '—';
  const ms = Math.max(0, finishedAt - startedAt);
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  const rem = Math.floor(s % 60);
  return `${m}m ${rem}s`;
}

// ── Preview renderers ───────────────────────────────────────────────

function PreviewFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '8px 10px',
        borderRadius: '10px',
        background: 'rgba(5,7,11,0.35)',
        border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
        display: 'grid',
        gap: '6px',
      }}
    >
      <div
        style={{
          fontFamily: T.MONO,
          fontSize: '9px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: PATHD_THEME.label,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function KeyValRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '8px', alignItems: 'baseline' }}>
      <span style={{ fontFamily: T.MONO, fontSize: '9px', color: PATHD_THEME.label, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </span>
      <span style={{ fontFamily: T.SANS, fontSize: '11px', color: PATHD_THEME.value, lineHeight: 1.45, overflowWrap: 'anywhere' }}>
        {value}
      </span>
    </div>
  );
}

function renderPreview(preview: AxonSessionPreview) {
  switch (preview.kind) {
    case 'planner':
      return (
        <PreviewFrame title="Planner output">
          <KeyValRow label="Tool chain" value={preview.toolChain} />
          <KeyValRow label="Step count" value={`${preview.stepCount}`} />
          <KeyValRow label="Request" value={preview.request} />
          {preview.warnings.length > 0 && (
            <div style={{ display: 'grid', gap: '3px' }}>
              <div style={{ fontFamily: T.MONO, fontSize: '9px', color: '#E7C7A9', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Warnings
              </div>
              {preview.warnings.map((w, i) => (
                <div key={i} style={{ fontFamily: T.SANS, fontSize: '10px', color: '#E7C7A9', lineHeight: 1.4 }}>
                  • {w}
                </div>
              ))}
            </div>
          )}
        </PreviewFrame>
      );
    case 'evidence':
      return (
        <PreviewFrame title="Evidence adapters">
          <KeyValRow
            label="Wired"
            value={preview.sourcesAvailable.length ? preview.sourcesAvailable.join(', ') : 'None'}
          />
          <KeyValRow
            label="Extension"
            value={preview.sourcesUnimplemented.length ? preview.sourcesUnimplemented.join(', ') : 'None'}
          />
          <KeyValRow label="Saved items" value={`${preview.savedEvidenceCount}`} />
          <div style={{ fontFamily: T.SANS, fontSize: '10px', color: PATHD_THEME.label, lineHeight: 1.4 }}>
            {preview.note}
          </div>
        </PreviewFrame>
      );
    case 'context':
      return (
        <PreviewFrame title="Workbench context">
          <KeyValRow label="Target" value={preview.targetProduct ?? '—'} />
          <KeyValRow
            label="Evidence"
            value={`${preview.evidenceSelected}/${preview.evidenceTotal} selected`}
          />
          <KeyValRow label="Active tool" value={preview.currentTool ?? '—'} />
          <div style={{ fontFamily: T.SANS, fontSize: '10px', color: PATHD_THEME.label, lineHeight: 1.4 }}>
            {preview.summary}
          </div>
        </PreviewFrame>
      );
    case 'metadata':
      return (
        <PreviewFrame title="Metadata">
          {preview.entries.length === 0 ? (
            <div style={{ fontFamily: T.SANS, fontSize: '10px', color: PATHD_THEME.label }}>
              No metadata captured.
            </div>
          ) : (
            preview.entries.map((e, i) => (
              <KeyValRow key={i} label={e.label} value={e.value} />
            ))
          )}
        </PreviewFrame>
      );
    case 'result':
      return (
        <PreviewFrame title={`${preview.tool.toUpperCase()} result`}>
          <div style={{ fontFamily: T.SANS, fontSize: '11px', color: PATHD_THEME.value, lineHeight: 1.45 }}>
            {preview.summary}
          </div>
          {preview.entries.map((e, i) => (
            <KeyValRow key={i} label={e.label} value={e.value} />
          ))}
        </PreviewFrame>
      );
    case 'writeback':
      return (
        <PreviewFrame title={`Writeback · ${preview.tool.toUpperCase()}`}>
          <KeyValRow label="Status" value={preview.status} />
          <KeyValRow label="Summary" value={preview.summary} />
        </PreviewFrame>
      );
    case 'off-domain':
      return (
        <PreviewFrame title="Off-domain advisory">
          <KeyValRow label="Category" value={domainCategoryLabel(preview.category)} />
          <KeyValRow label="Reason" value={preview.reason} />
          <KeyValRow
            label="Signals"
            value={preview.signals.length > 0 ? preview.signals.join(', ') : '—'}
          />
          <div style={{ fontFamily: T.SANS, fontSize: '10px', color: '#CFC4E3', lineHeight: 1.45 }}>
            The biosynthesis planner was not invoked. Rephrase with pathway, enzyme,
            or flux-analysis intent to route this through a Nexus-Bio tool.
          </div>
        </PreviewFrame>
      );
    case 'unavailable':
      return (
        <PreviewFrame title="Preview unavailable">
          <div style={{ fontFamily: T.SANS, fontSize: '11px', color: PATHD_THEME.label, lineHeight: 1.45 }}>
            {preview.reason}
          </div>
        </PreviewFrame>
      );
  }
}

// ── Step card ──────────────────────────────────────────────────────

function StepCard({
  step,
  isCurrent,
}: {
  step: AxonSessionStep;
  isCurrent: boolean;
}) {
  const tone = STEP_STATUS_TONE[step.status];
  return (
    <div
      data-testid={`agent-session-step-${step.id}`}
      data-step-kind={step.kind}
      data-step-status={step.status}
      style={{
        display: 'grid',
        gap: '8px',
        padding: '10px 12px',
        borderRadius: '12px',
        border: `1px solid ${tone.border}`,
        background: tone.bg,
        boxShadow: isCurrent ? `0 0 0 2px ${tone.border}` : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <span
            aria-hidden
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: tone.fg,
              boxShadow: isCurrent ? `0 0 0 3px ${tone.border}` : 'none',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: T.SANS,
              fontSize: '12px',
              fontWeight: 600,
              color: PATHD_THEME.value,
              lineHeight: 1.35,
              overflowWrap: 'anywhere',
            }}
          >
            {step.title}
          </span>
          {step.tool && (
            <span
              style={{
                padding: '1px 6px',
                borderRadius: '5px',
                background: 'rgba(10,14,22,0.55)',
                color: PATHD_THEME.value,
                fontFamily: T.MONO,
                fontSize: '9px',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {step.tool}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {isCurrent && (
            <span
              style={{
                padding: '1px 6px',
                borderRadius: '5px',
                background: 'rgba(147,203,82,0.22)',
                color: '#B8DE8A',
                fontFamily: T.MONO,
                fontSize: '9px',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              Now
            </span>
          )}
          <span
            style={{
              padding: '2px 7px',
              borderRadius: '6px',
              border: `1px solid ${tone.border}`,
              color: tone.fg,
              fontFamily: T.MONO,
              fontSize: '9px',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            {sessionStepStatusLabel(step.status)}
          </span>
        </div>
      </div>

      {step.detail && (
        <div style={{ fontFamily: T.SANS, fontSize: '11px', color: PATHD_THEME.label, lineHeight: 1.5 }}>
          {step.detail}
        </div>
      )}

      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
        {step.startedAt && (
          <span style={{ fontFamily: T.MONO, fontSize: '9px', color: PATHD_THEME.label, letterSpacing: '0.05em' }}>
            start {formatTime(step.startedAt)}
          </span>
        )}
        {step.finishedAt && (
          <span style={{ fontFamily: T.MONO, fontSize: '9px', color: PATHD_THEME.label, letterSpacing: '0.05em' }}>
            end {formatTime(step.finishedAt)}
          </span>
        )}
        {step.startedAt && step.finishedAt && (
          <span style={{ fontFamily: T.MONO, fontSize: '9px', color: PATHD_THEME.label, letterSpacing: '0.05em' }}>
            dur {formatDuration(step.startedAt, step.finishedAt)}
          </span>
        )}
      </div>

      {renderPreview(step.preview)}
    </div>
  );
}

// ── Outcome card ───────────────────────────────────────────────────

function OutcomeCard({ session }: { session: AxonSession }) {
  const tone = STATUS_TONE[session.status];

  const messages: Record<AxonSessionStatus, string> = {
    idle: 'No active session. Ask Axon a question to begin.',
    planning: 'Planner is assembling steps.',
    running: 'At least one tool step is executing now.',
    waiting: 'All queued steps are waiting on upstream dependencies or the scheduler.',
    completed: 'Every supported step completed. Evidence has been written back to the workbench ledger.',
    partial: 'Some steps completed, others failed. See step cards for specifics.',
    failed: 'One or more steps failed. Use the automation drawer to inspect or retry.',
    cancelled: 'Session cancelled before completion. No further automatic writeback will occur.',
    interrupted: 'Previous session ended mid-run (page reload or navigation). Running tasks were marked interrupted, not failed.',
    'off-domain': 'Request routed outside Nexus-Bio scope. Planner was not invoked and no biosynthesis prompt was called.',
    unsupported: 'Planner produced no actionable step — requested tool is not registered or no trigger matched.',
  };

  return (
    <div
      data-testid="agent-session-outcome"
      data-status={session.status}
      style={{
        display: 'grid',
        gap: '6px',
        padding: '10px 12px',
        borderRadius: '12px',
        border: `1px solid ${tone.dot}`,
        background: 'rgba(5,7,11,0.45)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span
          aria-hidden
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: tone.dot,
          }}
        />
        <span style={{ fontFamily: T.MONO, fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: tone.fg }}>
          {tone.label}
        </span>
        <span style={{ fontFamily: T.MONO, fontSize: '10px', color: PATHD_THEME.label, letterSpacing: '0.04em' }}>
          · {session.outcome.headline}
        </span>
      </div>
      <div style={{ fontFamily: T.SANS, fontSize: '11px', color: PATHD_THEME.value, lineHeight: 1.5 }}>
        {messages[session.status]}
      </div>
      {session.outcome.userActionNeeded && (
        <div
          style={{
            marginTop: '2px',
            padding: '6px 8px',
            borderRadius: '8px',
            background: 'rgba(229,143,70,0.12)',
            border: '1px solid rgba(229,143,70,0.3)',
            fontFamily: T.SANS,
            fontSize: '10px',
            color: '#E7C7A9',
            lineHeight: 1.4,
          }}
        >
          User action suggested — use the automation drawer to retry failed or cancelled steps.
        </div>
      )}
    </div>
  );
}

// ── Header ─────────────────────────────────────────────────────────

function SessionHeader({ session }: { session: AxonSession }) {
  const tone = STATUS_TONE[session.status];
  return (
    <div
      data-testid="agent-session-header"
      style={{
        display: 'grid',
        gap: '8px',
        padding: '12px 14px',
        borderRadius: '14px',
        border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
        background: PATHD_THEME.panelSurface,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'grid', gap: '2px', minWidth: 0 }}>
          <div style={{ fontFamily: T.MONO, fontSize: '9px', letterSpacing: '0.08em', textTransform: 'uppercase', color: PATHD_THEME.label }}>
            Agent session
          </div>
          <div style={{ fontFamily: T.SANS, fontSize: '13px', fontWeight: 700, color: PATHD_THEME.value, overflowWrap: 'anywhere' }}>
            {session.title}
          </div>
        </div>
        <div
          data-testid="agent-session-status-chip"
          data-status={session.status}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '10px',
            border: `1px solid ${tone.dot}`,
            background: 'rgba(5,7,11,0.35)',
          }}
        >
          <span aria-hidden style={{ width: '8px', height: '8px', borderRadius: '50%', background: tone.dot }} />
          <span style={{ fontFamily: T.MONO, fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: tone.fg, fontWeight: 700 }}>
            {sessionStatusLabel(session.status)}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
        {session.domain && (
          <div
            data-testid="agent-session-domain-chip"
            data-category={session.domain.category}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 8px',
              borderRadius: '8px',
              background: 'rgba(207,196,227,0.10)',
              border: '1px solid rgba(207,196,227,0.28)',
            }}
          >
            <span style={{ fontFamily: T.MONO, fontSize: '9px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#CFC4E3' }}>
              Domain
            </span>
            <span style={{ fontFamily: T.SANS, fontSize: '10px', color: PATHD_THEME.value }}>
              {domainCategoryLabel(session.domain.category)}
            </span>
          </div>
        )}
        {session.startedAt && (
          <span style={{ fontFamily: T.MONO, fontSize: '9px', color: PATHD_THEME.label, letterSpacing: '0.04em' }}>
            started {formatTime(session.startedAt)}
          </span>
        )}
        {session.lastActivityAt && (
          <span style={{ fontFamily: T.MONO, fontSize: '9px', color: PATHD_THEME.label, letterSpacing: '0.04em' }}>
            last activity {formatTime(session.lastActivityAt)}
          </span>
        )}
      </div>
      {session.request && (
        <div
          style={{
            fontFamily: T.SANS,
            fontSize: '11px',
            color: PATHD_THEME.label,
            lineHeight: 1.5,
            padding: '6px 10px',
            borderRadius: '8px',
            background: 'rgba(5,7,11,0.35)',
            border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
            overflowWrap: 'anywhere',
          }}
        >
          <span style={{ color: PATHD_THEME.value, fontWeight: 600 }}>Request · </span>
          {session.request}
        </div>
      )}
    </div>
  );
}

// ── Public component ───────────────────────────────────────────────

export interface AgentSessionViewerProps {
  session: AxonSession;
  /** When true, the header is hidden (host page owns its own chrome). */
  hideHeader?: boolean;
  /** Max step cards rendered. Default 40 — the derivation already bounds logs. */
  maxSteps?: number;
}

export default function AgentSessionViewer({
  session,
  hideHeader,
  maxSteps = 40,
}: AgentSessionViewerProps) {
  const steps = useMemo(() => session.steps.slice(0, maxSteps), [session.steps, maxSteps]);

  if (session.status === 'idle' && steps.length === 0) {
    return (
      <div
        data-testid="agent-session-viewer"
        data-session-status="idle"
        style={{
          display: 'grid',
          gap: '10px',
          padding: '16px',
          borderRadius: '14px',
          border: `1px dashed ${PATHD_THEME.sepiaPanelBorder}`,
          background: PATHD_THEME.panelInset,
          color: PATHD_THEME.label,
          fontFamily: T.SANS,
          fontSize: '12px',
          lineHeight: 1.55,
        }}
      >
        <div style={{ fontFamily: T.MONO, fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Agent session · idle
        </div>
        Ask Axon a question to start a real session. The viewer will show the classifier
        decision, the plan, each tool step, evidence adapter status, writebacks, and
        every lifecycle phase — nothing is fabricated.
      </div>
    );
  }

  return (
    <div
      data-testid="agent-session-viewer"
      data-session-status={session.status}
      data-session-id={session.id}
      style={{ display: 'grid', gap: '10px' }}
    >
      {!hideHeader && <SessionHeader session={session} />}
      <OutcomeCard session={session} />
      <div
        data-testid="agent-session-timeline"
        style={{
          display: 'grid',
          gap: '8px',
          padding: '10px 12px',
          borderRadius: '14px',
          border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
          background: PATHD_THEME.panelInset,
        }}
      >
        <div
          style={{
            fontFamily: T.MONO,
            fontSize: '10px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: PATHD_THEME.label,
          }}
        >
          Session timeline · {steps.length} step{steps.length === 1 ? '' : 's'}
        </div>
        {steps.length === 0 ? (
          <div style={{ fontFamily: T.SANS, fontSize: '11px', color: PATHD_THEME.label, lineHeight: 1.5 }}>
            No steps in this session. See the outcome card above for the reason.
          </div>
        ) : (
          steps.map((step) => (
            <StepCard
              key={step.id}
              step={step}
              isCurrent={session.currentStepId === step.id}
            />
          ))
        )}
      </div>
    </div>
  );
}
