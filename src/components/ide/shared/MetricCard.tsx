'use client';

const MONO = "'JetBrains Mono','Fira Code',monospace";
const SANS = "'Inter',-apple-system,sans-serif";

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
    : delta > 0 ? 'rgba(20,160,80,0.85)'
    : delta < 0 ? 'rgba(200,60,50,0.85)'
    : 'rgba(0,0,0,0.3)';

  return (
    <div style={{
      padding: '12px 14px',
      background: highlight ? '#FFFFFF' : '#FAFBFC',
      border: `1px solid ${highlight ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.07)'}`,
      borderRadius: '12px',
    }}>
      <p style={{ fontFamily: SANS, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(0,0,0,0.38)', margin: '0 0 6px' }}>
        {label}
      </p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
        <span style={{ fontFamily: MONO, fontSize: '20px', fontWeight: 700, color: 'rgba(0,0,0,0.82)', letterSpacing: '-0.02em', lineHeight: 1 }}>
          {typeof value === 'number' ? value.toFixed(value < 10 ? 3 : value < 100 ? 2 : 1) : value}
        </span>
        {unit && (
          <span style={{ fontFamily: SANS, fontSize: '10px', color: 'rgba(0,0,0,0.3)' }}>{unit}</span>
        )}
        {delta !== undefined && (
          <span style={{ fontFamily: MONO, fontSize: '10px', color: deltaColor, marginLeft: '4px' }}>
            {delta > 0 ? '+' : ''}{delta.toFixed(2)}
          </span>
        )}
      </div>
      {warning && (
        <p style={{ fontFamily: SANS, fontSize: '10px', color: 'rgba(180,100,20,0.9)', margin: '4px 0 0', lineHeight: 1.4 }}>
          ⚠ {warning}
        </p>
      )}
    </div>
  );
}
