'use client';
/**
 * GlobalAutomationDock — cross-page automation queue view.
 *
 * PR-3 spec: "AutomationDrawer and queue state shared across pages —
 * read from shared provider, remain visible across /tools/* navigation,
 * preserve non-agentic UX." This component is the bridge.
 *
 * Behaviour:
 *   • Renders only when agentic mode is ON. When it is OFF the dock
 *     never mounts, so the non-agentic UX is byte-identical to before.
 *   • Hidden on /tools/nexai, because NEXAIPage already embeds the
 *     full AutomationDrawer inline as its own reading-room surface —
 *     we do not want two copies overlapping.
 *   • Collapsed by default when there are no tasks; expands to show
 *     the shared drawer so the user can see queue state while they
 *     navigate between PATHD / FBASIM / etc.
 *   • Reads tasks from the shared AxonOrchestratorProvider, so every
 *     /tools/* route sees the same live queue.
 */
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import AutomationDrawer from '../tools/nexai/AutomationDrawer';
import AxonLogPanel from './AxonLogPanel';
import { useAxonOrchestratorOptional } from '../../providers/AxonOrchestratorProvider';
import { sessionStatusLabel } from '../../services/axonSessionView';
import { PATHD_THEME } from '../workbench/workbenchTheme';

const DOCK_WIDTH = 360;

export default function GlobalAutomationDock() {
  const axon = useAxonOrchestratorOptional();
  const pathname = usePathname() ?? '';
  const [expanded, setExpanded] = useState(false);

  if (!axon) return null;
  if (!axon.agenticMode) return null;
  if (pathname.startsWith('/tools/nexai')) return null;

  const { tasks, clearTerminal, cancelTask, retryTask, reorderTask, logs, session } = axon;
  const running = tasks.filter((t) => t.status === 'running').length;
  const pending = tasks.filter((t) => t.status === 'pending').length;
  // PR-5: the dock shows *session status* (not just a queue counter) so
  // cross-tool navigation gives an honest agent-state signal at a glance.
  // The full AgentSessionViewer stays inside /tools/nexai — this dock
  // deliberately only exposes the chip + drawer to avoid duplicating the
  // reading-room surface.
  const SESSION_DOT: Record<string, string> = {
    idle: 'rgba(255,255,255,0.18)',
    planning: '#AFC3D6',
    running: '#93CB52',
    waiting: '#E7C7A9',
    completed: '#93CB52',
    partial: '#E7C7A9',
    failed: '#FA8072',
    cancelled: 'rgba(255,255,255,0.40)',
    interrupted: '#E7C7A9',
    'off-domain': '#CFC4E3',
    unsupported: '#E7C7A9',
  };
  const sessionDot = SESSION_DOT[session.status] ?? PATHD_THEME.label;

  return (
    <div
      data-testid="global-automation-dock"
      data-expanded={expanded || undefined}
      style={{
        position: 'fixed',
        left: '96px',
        bottom: '84px',
        zIndex: 94,
        width: expanded ? DOCK_WIDTH : 'auto',
        maxWidth: '90vw',
        pointerEvents: 'auto',
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        data-testid="global-automation-dock-toggle"
        aria-expanded={expanded}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 10px',
          marginBottom: expanded ? '8px' : 0,
          borderRadius: '10px',
          border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
          background: PATHD_THEME.panelInset,
          color: PATHD_THEME.value,
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '10px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >
        <span
          aria-hidden
          data-testid="global-automation-dock-session-dot"
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: sessionDot,
            boxShadow: session.status === 'running' ? '0 0 0 3px rgba(147,203,82,0.22)' : 'none',
          }}
        />
        <span
          data-testid="global-automation-dock-session-label"
          data-status={session.status}
        >
          Axon · {sessionStatusLabel(session.status)}
        </span>
        <span style={{ color: PATHD_THEME.label, letterSpacing: 0, textTransform: 'none' }}>
          {pending}P · {running}R · {tasks.length}T
        </span>
        <span aria-hidden style={{ color: PATHD_THEME.label, letterSpacing: 0 }}>
          {expanded ? '▾' : '▸'}
        </span>
      </button>
      {expanded && (
        <div style={{ display: 'grid', gap: '8px' }}>
          <AutomationDrawer
            tasks={tasks}
            enabled
            onClear={clearTerminal}
            onCancel={cancelTask}
            onRetry={retryTask}
            onReorder={reorderTask}
          />
          <div
            data-testid="global-automation-dock-log"
            style={{
              borderRadius: '14px',
              border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
              background: PATHD_THEME.panelInset,
              padding: '10px 12px',
              display: 'grid',
              gap: '8px',
              maxHeight: '280px',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '10px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: PATHD_THEME.label,
              }}
            >
              Execution trace
            </div>
            <AxonLogPanel logs={logs} maxRows={40} compact />
          </div>
        </div>
      )}
    </div>
  );
}
