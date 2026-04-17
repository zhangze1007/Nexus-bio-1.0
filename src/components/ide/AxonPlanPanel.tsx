'use client';
/**
 * AxonPlanPanel — renders the active Axon plan.
 *
 * PR-4 requirement: planner output must be visible and inspectable.
 * This panel shows the step list with status dots, dependencies, and
 * warnings. It is intentionally passive — no re-plan button, no edit
 * controls. The plan comes from the orchestrator provider.
 */
import type { AxonPlan, AxonPlanStepStatus } from '../../services/axonPlanner';
import { summarisePlan } from '../../services/axonPlanner';
import { PATHD_THEME } from '../workbench/workbenchTheme';
import { T } from './tokens';

const STATUS_TONE: Record<AxonPlanStepStatus, { dot: string; label: string; fg: string }> = {
  planned: { dot: PATHD_THEME.label, label: 'Planned', fg: PATHD_THEME.value },
  enqueued: { dot: '#AFC3D6', label: 'Enqueued', fg: PATHD_THEME.value },
  running: { dot: '#C8E0D0', label: 'Running', fg: PATHD_THEME.value },
  done: { dot: '#93CB52', label: 'Done', fg: '#B8DE8A' },
  error: { dot: '#FA8072', label: 'Error', fg: '#FA8072' },
  cancelled: { dot: PATHD_THEME.label, label: 'Cancelled', fg: PATHD_THEME.label },
  unsupported: { dot: '#E58F46', label: 'Unsupported', fg: '#E8C49A' },
};

export interface AxonPlanPanelProps {
  plan: AxonPlan | null;
  compact?: boolean;
}

export default function AxonPlanPanel({ plan, compact }: AxonPlanPanelProps) {
  if (!plan) {
    return (
      <div
        data-testid="axon-plan-empty"
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
        No active plan. Ask Axon to plan a pathway design or flux analysis
        and the steps will appear here with dependencies and status.
      </div>
    );
  }

  return (
    <div
      data-testid="axon-plan-panel"
      data-plan-id={plan.id}
      style={{
        display: 'grid',
        gap: '8px',
        padding: compact ? '10px 12px' : '12px 14px',
        borderRadius: '12px',
        border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
        background: PATHD_THEME.panelInset,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span
          style={{
            fontFamily: T.MONO,
            fontSize: '10px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: PATHD_THEME.label,
          }}
        >
          Axon plan
        </span>
        <span style={{ fontFamily: T.MONO, fontSize: '9px', color: PATHD_THEME.value }}>
          {summarisePlan(plan)}
        </span>
        <span style={{ fontFamily: T.MONO, fontSize: '9px', color: PATHD_THEME.label }}>
          origin={plan.origin}
        </span>
      </div>
      <div
        style={{
          fontFamily: T.SANS,
          fontSize: '11px',
          color: PATHD_THEME.value,
          lineHeight: 1.4,
          overflowWrap: 'anywhere',
        }}
      >
        {plan.request}
      </div>
      {plan.warnings.length > 0 && (
        <div
          data-testid="axon-plan-warnings"
          style={{
            display: 'grid',
            gap: '4px',
            padding: '6px 8px',
            borderRadius: '8px',
            border: `1px solid rgba(229,143,70,0.36)`,
            background: 'rgba(229,143,70,0.12)',
          }}
        >
          {plan.warnings.map((w, i) => (
            <div
              key={i}
              style={{ fontFamily: T.SANS, fontSize: '10px', color: '#E8C49A', lineHeight: 1.4 }}
            >
              {w}
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'grid', gap: '6px' }}>
        {plan.steps.length === 0 && (
          <div
            data-testid="axon-plan-empty-steps"
            style={{
              fontFamily: T.SANS,
              fontSize: '11px',
              color: PATHD_THEME.label,
              lineHeight: 1.5,
              padding: '8px 10px',
              borderRadius: '8px',
              border: `1px dashed ${PATHD_THEME.sepiaPanelBorder}`,
            }}
          >
            Plan has no actionable steps.
          </div>
        )}
        {plan.steps.map((step, idx) => {
          const tone = STATUS_TONE[step.status];
          return (
            <div
              key={step.id}
              data-testid={`axon-plan-step-${idx}`}
              data-step-status={step.status}
              data-step-tool={step.tool}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                alignItems: 'start',
                gap: '8px',
                padding: '8px 10px',
                borderRadius: '8px',
                border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
                background: 'rgba(10,14,22,0.25)',
              }}
            >
              <span
                aria-hidden
                style={{
                  width: '8px',
                  height: '8px',
                  marginTop: '4px',
                  borderRadius: '50%',
                  background: tone.dot,
                  boxShadow: step.status === 'running' ? `0 0 0 3px rgba(200,224,208,0.25)` : 'none',
                }}
              />
              <div style={{ display: 'grid', gap: '3px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontFamily: T.MONO,
                      fontSize: '9px',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      background: 'rgba(10,14,22,0.45)',
                      color: PATHD_THEME.value,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {step.tool}
                  </span>
                  <span
                    style={{
                      fontFamily: T.SANS,
                      fontSize: '12px',
                      color: PATHD_THEME.value,
                    }}
                  >
                    {step.title}
                  </span>
                  {step.dependsOn.length > 0 && (
                    <span
                      style={{
                        fontFamily: T.MONO,
                        fontSize: '9px',
                        color: PATHD_THEME.label,
                      }}
                    >
                      depends on {step.dependsOn.length} step(s)
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontFamily: T.SANS,
                    fontSize: '10px',
                    color: PATHD_THEME.label,
                    lineHeight: 1.45,
                  }}
                >
                  <div><strong style={{ color: PATHD_THEME.value }}>Objective:</strong> {step.objective}</div>
                  <div><strong style={{ color: PATHD_THEME.value }}>Input:</strong> {step.inputSummary}</div>
                  <div><strong style={{ color: PATHD_THEME.value }}>Expected:</strong> {step.expectedOutput}</div>
                  <div style={{ opacity: 0.85 }}><em>{step.reason}</em></div>
                </div>
              </div>
              <span
                style={{
                  fontFamily: T.MONO,
                  fontSize: '9px',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: 'rgba(10,14,22,0.35)',
                  color: tone.fg,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}
              >
                {tone.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
