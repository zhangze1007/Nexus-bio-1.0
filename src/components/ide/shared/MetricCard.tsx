'use client';

const MONO = "'JetBrains Mono','Fira Code',monospace";
const SANS = "'Inter',-apple-system,sans-serif";

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  delta?: number;    // positive = improvement
  warning?: string;
  highlight?: boolean;
}

export default function MetricCard({ label, value, unit, delta, warning, highlight }: MetricCardProps) {
  const deltaColor = delta === undefined ? undefined
    : delta > 0 ? 'rgba(80,220,120,0.8)'
    : delta < 0 ? 'rgba(220,80,80,0.8)'
    : 'rgba(255,255,255,0.35)';

  return (
    <div style={{
      padding: '12px 14px',
      background: highlight ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
      border: `1px solid ${highlight ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)'}`,
      borderRadius: '4px',
    }}>
      <p style={{ fontFamily: MONO, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', margin: '0 0 6px' }}>
        {label}
      </p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
        <span style={{ fontFamily: MONO, fontSize: '20px', fontWeight: 700, color: 'rgba(255,255,255,0.88)', letterSpacing: '-0.02em', lineHeight: 1 }}>
          {typeof value === 'number' ? value.toFixed(value < 10 ? 3 : value < 100 ? 2 : 1) : value}
        </span>
        {unit && (
          <span style={{ fontFamily: SANS, fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>{unit}</span>
        )}
        {delta !== undefined && (
          <span style={{ fontFamily: MONO, fontSize: '10px', color: deltaColor, marginLeft: '4px' }}>
            {delta > 0 ? '+' : ''}{delta.toFixed(2)}
          </span>
        )}
      </div>
      {warning && (
        <p style={{ fontFamily: SANS, fontSize: '10px', color: 'rgba(220,140,60,0.8)', margin: '4px 0 0', lineHeight: 1.4 }}>
          ⚠ {warning}
        </p>
      )}
    </div>
  );
}
