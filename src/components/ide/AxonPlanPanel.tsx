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
import { THEME } from '../../theme';

const STATUS_TONE: Record<AxonPlanStepStatus, { dot: string; label: string; fg: string }> = {
  planned: { dot: THEME.LABEL, label: 'Planned', fg: THEME.VALUE },
  enqueued: { dot: '#AFC3D6', label: 'Enqueued', fg: THEME.VALUE },
  running: { dot: '#C8E0D0', label: 'Running', fg: THEME.VALUE },
  done: { dot: '#93CB52', label: 'Done', fg: '#B8DE8A' },
  error: { dot: '#FA8072', label: 'Error', fg: '#FA8072' },
  cancelled: { dot: THEME.LABEL, label: 'Cancelled', fg: THEME.LABEL },
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
          borderRadius: '12px',
          border: `1px dashed ${THEME.BORDER}`,
          color: THEME.LABEL,
          fontFamily: THEME.SANS,
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
        border: `1px solid ${THEME.BORDER}`,
        background: THEME.PANEL_INSET,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span
          style={{
            fontFamily: THEME.MONO,
            fontSize: '10px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: THEME.LABEL,
          }}
        >
          Axon plan
        </span>
        <span style={{ fontFamily: THEME.MONO, fontSize: '10px', color: THEME.VALUE }}>
          {summarisePlan(plan)}
        </span>
        <span style={{ fontFamily: THEME.MONO, fontSize: '10px', color: THEME.LABEL }}>
          origin={plan.origin}
        </span>
      </div>
      <div
        style={{
          fontFamily: THEME.SANS,
          fontSize: '11px',
          color: THEME.VALUE,
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
              style={{ fontFamily: THEME.SANS, fontSize: '10px', color: '#E8C49A', lineHeight: 1.4 }}
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
              fontFamily: THEME.SANS,
              fontSize: '11px',
              color: THEME.LABEL,
              lineHeight: 1.5,
              padding: '8px 10px',
              borderRadius: '8px',
              border: `1px dashed ${THEME.BORDER}`,
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
                border: `1px solid ${THEME.BORDER}`,
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
                      fontFamily: THEME.MONO,
                      fontSize: '10px',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      background: 'rgba(10,14,22,0.45)',
                      color: THEME.VALUE,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {step.tool}
                  </span>
                  <span
                    style={{
                      fontFamily: THEME.SANS,
                      fontSize: '12px',
                      color: THEME.VALUE,
                    }}
                  >
                    {step.title}
                  </span>
                  {step.dependsOn.length > 0 && (
                    <span
                      style={{
                        fontFamily: THEME.MONO,
                        fontSize: '10px',
                        color: THEME.LABEL,
                      }}
                    >
                      depends on {step.dependsOn.length} step(s)
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontFamily: THEME.SANS,
                    fontSize: '10px',
                    color: THEME.LABEL,
                    lineHeight: 1.45,
                  }}
                >
                  <div><strong style={{ color: THEME.VALUE }}>Objective:</strong> {step.objective}</div>
                  <div><strong style={{ color: THEME.VALUE }}>Input:</strong> {step.inputSummary}</div>
                  <div><strong style={{ color: THEME.VALUE }}>Expected:</strong> {step.expectedOutput}</div>
                  <div style={{ opacity: 0.85 }}><em>{step.reason}</em></div>
                </div>
              </div>
              <span
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: '10px',
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
