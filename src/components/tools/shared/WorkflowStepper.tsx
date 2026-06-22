'use client';

import { THEME } from '../../../theme';

/**
 * WorkflowStepper — Step indicator for multi-stage pipelines.
 *
 * Horizontal bar with numbered circles connected by lines.
 * Colors: done=MINT, active=SKY, error=CORAL, pending=DIM.
 * Clickable steps when onStepClick is provided.
 */

export interface StepDef {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'done' | 'error';
  detail?: string;
}

interface WorkflowStepperProps {
  steps: StepDef[];
  activeIndex: number;
  onStepClick?: (index: number) => void;
}

const STATUS_COLORS: Record<StepDef['status'], { bg: string; border: string; text: string; line: string }> = {
  done:    { bg: 'rgba(191, 220, 205, 0.18)', border: THEME.MINT,  text: THEME.MINT,  line: THEME.MINT },
  active:  { bg: 'rgba(175, 195, 214, 0.18)', border: THEME.SKY,   text: THEME.SKY,   line: THEME.SKY },
  error:   { bg: 'rgba(232, 163, 161, 0.18)', border: THEME.CORAL, text: THEME.CORAL, line: THEME.CORAL },
  pending: { bg: 'rgba(255, 255, 255, 0.04)', border: THEME.BORDER, text: THEME.DIM,  line: THEME.BORDER },
};

export default function WorkflowStepper({ steps, activeIndex, onStepClick }: WorkflowStepperProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 0,
      width: '100%',
      padding: '12px 0',
    }}>
      {steps.map((step, i) => {
        const colors = STATUS_COLORS[step.status];
        const isActive = i === activeIndex;
        const isLast = i === steps.length - 1;
        const clickable = !!onStepClick;

        return (
          <div
            key={step.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              flex: isLast ? '0 0 auto' : '1 1 0',
              minWidth: 0,
            }}
          >
            {/* Step node + label */}
            <div
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              onClick={() => onStepClick?.(i)}
              onKeyDown={(e) => {
                if (clickable && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onStepClick?.(i);
                }
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                cursor: clickable ? 'pointer' : 'default',
                flexShrink: 0,
                minWidth: '48px',
                outline: 'none',
              }}
            >
              {/* Circle */}
              <div style={{
                width: isActive ? '32px' : '26px',
                height: isActive ? '32px' : '26px',
                borderRadius: '50%',
                background: colors.bg,
                border: `2px solid ${colors.border}`,
                display: 'grid',
                placeItems: 'center',
                transition: 'all 200ms ease',
                boxShadow: isActive ? `0 0 12px ${colors.border}33` : 'none',
              }}>
                {step.status === 'done' ? (
                  <span style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_XS, color: colors.text, fontWeight: 700 }}>&#10003;</span>
                ) : step.status === 'error' ? (
                  <span style={{ fontFamily: THEME.MONO, fontSize: THEME.FS_SM, color: colors.text, fontWeight: 700 }}>!</span>
                ) : (
                  <span style={{
                    fontFamily: THEME.MONO,
                    fontSize: isActive ? THEME.FS_SM : THEME.FS_XS,
                    color: colors.text,
                    fontWeight: 700,
                  }}>
                    {i + 1}
                  </span>
                )}
              </div>

              {/* Label */}
              <span style={{
                fontFamily: THEME.SANS,
                fontSize: THEME.FS_XS,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? THEME.VALUE : THEME.LABEL,
                textAlign: 'center',
                lineHeight: 1.3,
                maxWidth: '80px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {step.label}
              </span>

              {/* Detail */}
              {step.detail && (
                <span style={{
                  fontFamily: THEME.MONO,
                  fontSize: '10px',
                  color: THEME.DIM,
                  textAlign: 'center',
                  maxWidth: '80px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {step.detail}
                </span>
              )}
            </div>

            {/* Connector line */}
            {!isLast && (
              <div style={{
                flex: 1,
                height: '2px',
                background: i < activeIndex
                  ? STATUS_COLORS.done.line
                  : i === activeIndex
                    ? `linear-gradient(90deg, ${STATUS_COLORS.active.line}, ${THEME.BORDER})`
                    : THEME.BORDER,
                margin: '13px 4px 0 4px',
                minWidth: '16px',
                borderRadius: '1px',
                transition: 'background 200ms ease',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
