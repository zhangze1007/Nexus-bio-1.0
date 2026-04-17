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
import { useAxonOrchestratorOptional } from '../../providers/AxonOrchestratorProvider';
import { PATHD_THEME } from '../workbench/workbenchTheme';

const DOCK_WIDTH = 360;

export default function GlobalAutomationDock() {
  const axon = useAxonOrchestratorOptional();
  const pathname = usePathname() ?? '';
  const [expanded, setExpanded] = useState(true);

  if (!axon) return null;
  if (!axon.agenticMode) return null;
  if (pathname.startsWith('/tools/nexai')) return null;

  const { tasks, clearTerminal } = axon;
  const running = tasks.filter((t) => t.status === 'running').length;
  const pending = tasks.filter((t) => t.status === 'pending').length;

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
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: running > 0 ? '#93CB52' : PATHD_THEME.label,
            boxShadow: running > 0 ? '0 0 0 3px rgba(147,203,82,0.22)' : 'none',
          }}
        />
        <span>Automation queue</span>
        <span style={{ color: PATHD_THEME.label, letterSpacing: 0, textTransform: 'none' }}>
          {pending}P · {running}R · {tasks.length}T
        </span>
        <span aria-hidden style={{ color: PATHD_THEME.label, letterSpacing: 0 }}>
          {expanded ? '▾' : '▸'}
        </span>
      </button>
      {expanded && (
        <AutomationDrawer
          tasks={tasks}
          enabled
          onClear={clearTerminal}
        />
      )}
    </div>
  );
}
