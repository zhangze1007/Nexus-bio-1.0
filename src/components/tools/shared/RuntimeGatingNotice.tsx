import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import type { RuntimeGatingDecision } from '../../../utils/runtimeGating';
import { T } from '../../ide/tokens';
import { PATHD_THEME } from '../../workbench/workbenchTheme';

interface RuntimeGatingNoticeProps {
  decision: RuntimeGatingDecision;
  sourceLabel?: string;
  targetLabel?: string;
  compact?: boolean;
}

export default function RuntimeGatingNotice({
  decision,
  sourceLabel,
  targetLabel,
  compact = false,
}: RuntimeGatingNoticeProps) {
  const tone = decision.severity;
  const colors = tone === 'block'
    ? {
        border: 'rgba(250,128,114,0.32)',
        background: 'rgba(250,128,114,0.10)',
        icon: PATHD_THEME.coral,
        label: 'Blocked',
      }
    : tone === 'warn'
      ? {
          border: PATHD_THEME.chipBorderWarm,
          background: 'rgba(231,199,169,0.14)',
          icon: PATHD_THEME.apricot,
          label: 'Caution',
        }
      : {
          border: 'rgba(191,220,205,0.30)',
          background: 'rgba(191,220,205,0.10)',
          icon: PATHD_THEME.mint,
          label: 'Allowed',
        };
  const Icon = tone === 'block' ? ShieldAlert : tone === 'warn' ? AlertTriangle : CheckCircle2;

  return (
    <div
      style={{
        borderRadius: compact ? '10px' : '12px',
        border: `1px solid ${colors.border}`,
        background: colors.background,
        padding: compact ? '8px 9px' : '10px 12px',
        display: 'grid',
        gap: compact ? '6px' : '8px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <Icon size={compact ? 14 : 16} color={colors.icon} style={{ flexShrink: 0, marginTop: '1px' }} />
        <div style={{ display: 'grid', gap: '4px', minWidth: 0 }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: T.MONO,
                fontSize: compact ? '8px' : '9px',
                color: colors.icon,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Runtime gate · {colors.label}
            </span>
            <span
              style={{
                fontFamily: T.MONO,
                fontSize: compact ? '8px' : '9px',
                color: PATHD_THEME.label,
                overflowWrap: 'anywhere',
              }}
            >
              {(sourceLabel ?? decision.sourceToolId ?? 'source').toUpperCase()} {'->'} {(targetLabel ?? decision.targetToolId).toUpperCase()}
            </span>
          </div>
          <div style={{ fontFamily: T.SANS, fontSize: compact ? '9px' : '11px', color: PATHD_THEME.label, lineHeight: 1.45 }}>
            {decision.reason}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <span style={pillStyle(compact)}>
          {decision.sourceValidity} {'->'} {decision.targetValidity}
        </span>
        {decision.blockingAssumptionIds.map((id) => (
          <span key={id} style={{ ...pillStyle(compact), color: PATHD_THEME.coral, borderColor: 'rgba(250,128,114,0.30)' }}>
            {id}
          </span>
        ))}
      </div>
    </div>
  );
}

function pillStyle(compact: boolean): React.CSSProperties {
  return {
    borderRadius: '999px',
    border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
    background: PATHD_THEME.chipNeutral,
    color: PATHD_THEME.value,
    padding: compact ? '2px 6px' : '3px 7px',
    fontFamily: T.MONO,
    fontSize: compact ? '8px' : '9px',
    lineHeight: 1.2,
    overflowWrap: 'anywhere',
  };
}
