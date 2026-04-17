'use client';
/**
 * AutomationDrawer — PR-2b read-only surface over the Axon orchestrator.
 *
 * This is the first visible "an agent is actually doing work" view in
 * Nexus-Bio. It is intentionally restrained:
 *
 *   • read-only — no start/stop/cancel buttons yet
 *   • no fake spinners — the "running" row pulses once every 1.6s,
 *     nothing more. Ambient, not theatrical.
 *   • no invented progress percentages
 *   • feature-flagged at the caller (NEXAIPage). When the flag is off
 *     this component is not mounted and the normal copilot flow is
 *     untouched.
 *
 * Anything that looks like it should live here but doesn't — task
 * cancellation, live logs, retry controls, queue re-ordering — is
 * deferred to PR-3 on purpose. The UI shows what the orchestrator can
 * honestly report today.
 */
import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import type { AxonTask, AxonTaskStatus } from '../../../services/AxonOrchestrator';
import { TOOL_TOKENS as T } from '../shared/ToolShell';
import { PATHD_THEME } from '../../workbench/workbenchTheme';

export interface AutomationDrawerProps {
  tasks: AxonTask[];
  /** When false the drawer does not render. This is the feature flag. */
  enabled: boolean;
  onClear?: () => void;
  /** PR-4: explicit queue controls. */
  onCancel?: (taskId: string) => void;
  onRetry?: (taskId: string) => void;
  onReorder?: (taskId: string, newIndex: number) => { ok: boolean; reason?: string };
}

function controlBtn(disabled: boolean): CSSProperties {
  return {
    fontFamily: T.MONO,
    fontSize: '9px',
    padding: '2px 6px',
    borderRadius: '5px',
    border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
    background: disabled ? 'transparent' : 'rgba(10,14,22,0.35)',
    color: disabled ? PATHD_THEME.label : PATHD_THEME.value,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    minWidth: '20px',
  };
}

function statusTone(status: AxonTaskStatus): { bg: string; border: string; fg: string; label: string } {
  switch (status) {
    case 'pending':
      return { bg: 'rgba(175,195,214,0.14)', border: 'rgba(175,195,214,0.26)', fg: PATHD_THEME.label, label: 'Pending' };
    case 'running':
      return { bg: 'rgba(200,224,208,0.18)', border: 'rgba(200,224,208,0.34)', fg: PATHD_THEME.value, label: 'Running' };
    case 'done':
      return { bg: 'rgba(147,203,82,0.16)', border: 'rgba(147,203,82,0.34)', fg: PATHD_THEME.value, label: 'Done' };
    case 'error':
      return { bg: 'rgba(250,128,114,0.16)', border: 'rgba(250,128,114,0.42)', fg: '#FA8072', label: 'Error' };
    case 'cancelled':
      return { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.16)', fg: PATHD_THEME.label, label: 'Cancelled' };
  }
}

function formatMillis(ms?: number): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '—';
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function summariseResult(task: AxonTask): string | null {
  if (task.status === 'error') return task.error ?? 'Unknown error';
  if (task.status === 'done' && task.result && typeof task.result === 'object') {
    const r = task.result as Record<string, unknown>;
    if (task.tool === 'pathd') {
      const nodes = typeof r.nodeCount === 'number' ? r.nodeCount : null;
      const bottle = typeof r.bottleneckCount === 'number' ? r.bottleneckCount : null;
      const provider = typeof r.provider === 'string' ? r.provider : null;
      const parts: string[] = [];
      if (nodes !== null) parts.push(`${nodes} node${nodes === 1 ? '' : 's'}`);
      if (bottle !== null) parts.push(`${bottle} bottleneck${bottle === 1 ? '' : 's'}`);
      if (provider) parts.push(provider);
      return parts.join(' · ') || null;
    }
    if (task.tool === 'fbasim') {
      const obj = typeof r.objectiveValue === 'number' ? r.objectiveValue.toFixed(3) : null;
      const flux = typeof r.fluxCount === 'number' ? r.fluxCount : null;
      const species = typeof r.species === 'string' ? r.species : null;
      const parts: string[] = [];
      if (species) parts.push(species);
      if (obj) parts.push(`obj=${obj}`);
      if (flux !== null) parts.push(`${flux} flux`);
      return parts.join(' · ') || null;
    }
  }
  return null;
}

export default function AutomationDrawer({
  tasks,
  enabled,
  onClear,
  onCancel,
  onRetry,
  onReorder,
}: AutomationDrawerProps) {
  if (!enabled) return null;

  // Pending-order indexes used for reorder button guards. Computed once
  // per render so each row can find its own position without scanning.
  const pendingIds = tasks.filter((t) => t.status === 'pending').map((t) => t.id);

  const pending = tasks.filter((t) => t.status === 'pending').length;
  const running = tasks.filter((t) => t.status === 'running').length;
  const done = tasks.filter((t) => t.status === 'done').length;
  const errored = tasks.filter((t) => t.status === 'error').length;
  const terminalCount = done + errored;

  return (
    <div
      data-testid="nexai-automation-drawer"
      style={{
        borderRadius: '14px',
        border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
        background: PATHD_THEME.panelInset,
        padding: '12px 14px',
        display: 'grid',
        gap: '10px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            aria-hidden
            style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: running > 0 ? '#93CB52' : PATHD_THEME.label,
              boxShadow: running > 0 ? '0 0 0 3px rgba(147,203,82,0.22)' : 'none',
            }}
          />
          <span style={{ fontFamily: T.MONO, fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: PATHD_THEME.label }}>
            Automation queue
          </span>
          <span style={{ fontFamily: T.MONO, fontSize: '9px', color: PATHD_THEME.label }}>
            {pending} pending · {running} running · {done} done · {errored} error
          </span>
        </div>
        {onClear && terminalCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            data-testid="nexai-automation-clear"
            style={{
              fontFamily: T.MONO, fontSize: '9px',
              padding: '3px 8px', borderRadius: '6px',
              border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
              background: 'transparent', cursor: 'pointer',
              color: PATHD_THEME.label, letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            Clear terminal
          </button>
        )}
      </div>

      {tasks.length === 0 ? (
        <div
          data-testid="nexai-automation-empty"
          style={{
            padding: '14px', borderRadius: '10px',
            border: `1px dashed ${PATHD_THEME.sepiaPanelBorder}`,
            color: PATHD_THEME.label, fontFamily: T.SANS, fontSize: '11px',
            lineHeight: 1.55,
          }}
        >
          No automated tasks yet. Enable agentic mode and ask Axon to design a pathway or run a flux-balance simulation.
        </div>
      ) : (
        <div data-testid="nexai-automation-task-list" style={{ display: 'grid', gap: '6px' }}>
          {tasks.map((task) => {
            const tone = statusTone(task.status);
            const summary = summariseResult(task);
            return (
              <motion.div
                key={task.id}
                data-testid={`nexai-automation-task-${task.id}`}
                data-status={task.status}
                data-tool={task.tool}
                animate={task.status === 'running' ? { opacity: [0.72, 1, 0.72] } : { opacity: 1 }}
                transition={task.status === 'running' ? { duration: 1.6, repeat: Infinity } : { duration: 0.2 }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  borderRadius: '10px',
                  border: `1px solid ${tone.border}`,
                  background: tone.bg,
                }}
              >
                <div style={{ display: 'grid', gap: '3px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{
                      fontFamily: T.MONO, fontSize: '9px',
                      padding: '1px 5px', borderRadius: '4px',
                      background: 'rgba(10,14,22,0.45)',
                      color: PATHD_THEME.value, letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}>
                      {task.tool}
                    </span>
                    <span style={{
                      fontFamily: T.SANS, fontSize: '12px', color: PATHD_THEME.value,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {task.label}
                    </span>
                  </div>
                  <div style={{
                    fontFamily: T.MONO, fontSize: '9px', color: PATHD_THEME.label,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    queued {formatMillis(task.createdAt)}
                    {task.startedAt ? ` · started ${formatMillis(task.startedAt)}` : ''}
                    {task.finishedAt ? ` · finished ${formatMillis(task.finishedAt)}` : ''}
                    {task.retryCount > 0 ? ` · retry ${task.retryCount}/${task.maxRetries}` : ''}
                  </div>
                  {summary && (
                    <div
                      data-testid={`nexai-automation-task-summary-${task.id}`}
                      style={{
                        fontFamily: T.SANS, fontSize: '11px', color: tone.fg,
                        lineHeight: 1.5,
                      }}
                    >
                      {summary}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <span
                    style={{
                      fontFamily: T.MONO, fontSize: '9px',
                      padding: '3px 8px', borderRadius: '6px',
                      background: 'rgba(10,14,22,0.35)', color: tone.fg,
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                    }}
                  >
                    {tone.label}
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {task.status === 'pending' && onReorder && pendingIds.length > 1 && (
                      <>
                        <button
                          type="button"
                          data-testid={`nexai-automation-reorder-up-${task.id}`}
                          title="Move earlier"
                          aria-label="Move task earlier"
                          onClick={() => {
                            const idx = pendingIds.indexOf(task.id);
                            if (idx > 0) onReorder(task.id, idx - 1);
                          }}
                          disabled={pendingIds.indexOf(task.id) === 0}
                          style={controlBtn(pendingIds.indexOf(task.id) === 0)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          data-testid={`nexai-automation-reorder-down-${task.id}`}
                          title="Move later"
                          aria-label="Move task later"
                          onClick={() => {
                            const idx = pendingIds.indexOf(task.id);
                            if (idx < pendingIds.length - 1) onReorder(task.id, idx + 1);
                          }}
                          disabled={pendingIds.indexOf(task.id) === pendingIds.length - 1}
                          style={controlBtn(pendingIds.indexOf(task.id) === pendingIds.length - 1)}
                        >
                          ↓
                        </button>
                      </>
                    )}
                    {(task.status === 'pending' || task.status === 'running') && onCancel && (
                      <button
                        type="button"
                        data-testid={`nexai-automation-cancel-${task.id}`}
                        title="Cancel task"
                        aria-label="Cancel task"
                        onClick={() => onCancel(task.id)}
                        style={controlBtn(false)}
                      >
                        Cancel
                      </button>
                    )}
                    {(task.status === 'error' || task.status === 'cancelled') && onRetry && (
                      <button
                        type="button"
                        data-testid={`nexai-automation-retry-${task.id}`}
                        title="Retry task"
                        aria-label="Retry task"
                        onClick={() => onRetry(task.id)}
                        style={controlBtn(false)}
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
