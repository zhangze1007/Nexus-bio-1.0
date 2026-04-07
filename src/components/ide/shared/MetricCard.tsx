'use client';
import { T } from '../tokens';
import { PATHD_THEME } from '../../workbench/workbenchTheme';

const MONO = T.MONO;
const SANS = T.SANS;

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  delta?: number;
  warning?: string;
  highlight?: boolean;
}

export default function MetricCard({ label, value, unit, delta, warning, highlight }: MetricCardProps) {
  const deltaColor = delta === undefined ? undefined
    : delta > 0 ? PATHD_THEME.mint
    : delta < 0 ? PATHD_THEME.coral
    : PATHD_THEME.label;

  return (
    <div style={{
      padding: '14px 14px 12px',
      background: highlight ? 'rgba(191,220,205,0.10)' : PATHD_THEME.panelSurface,
      border: `1px solid ${highlight ? 'rgba(191,220,205,0.28)' : PATHD_THEME.sepiaPanelBorder}`,
      borderRadius: '14px',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
    }}>
      <p style={{ fontFamily: SANS, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.09em', color: PATHD_THEME.label, margin: '0 0 8px' }}>
        {label}
      </p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
        <span style={{ fontFamily: MONO, fontSize: '20px', fontWeight: 700, color: PATHD_THEME.value, letterSpacing: '-0.02em', lineHeight: 1 }}>
          {typeof value === 'number' ? value.toFixed(value < 10 ? 3 : value < 100 ? 2 : 1) : value}
        </span>
        {unit && (
          <span style={{ fontFamily: SANS, fontSize: '10px', color: PATHD_THEME.label }}>{unit}</span>
        )}
        {delta !== undefined && (
          <span style={{ fontFamily: MONO, fontSize: '10px', color: deltaColor, marginLeft: '4px' }}>
            {delta > 0 ? '+' : ''}{delta.toFixed(2)}
          </span>
        )}
      </div>
      {warning && (
        <p style={{ fontFamily: SANS, fontSize: '10px', color: PATHD_THEME.coral, margin: '6px 0 0', lineHeight: 1.45 }}>
          {warning}
        </p>
      )}
    </div>
  );
}
