'use client';

const MONO = "'JetBrains Mono','Fira Code',monospace";
const SANS = "'Inter',-apple-system,sans-serif";

interface AlgorithmInsightProps {
  title: string;
  description: string;
  formula?: string;
}

export default function AlgorithmInsight({ title, description, formula }: AlgorithmInsightProps) {
  return (
    <div style={{
      borderBottom: '1px solid rgba(0,0,0,0.06)',
      padding: '10px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: '20px',
      background: 'rgba(200,240,224,0.2)',
      flexShrink: 0,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
          <span style={{ fontFamily: SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(0,0,0,0.3)' }}>
            Algorithm Insight
          </span>
          <span style={{ fontFamily: SANS, fontSize: '12px', fontWeight: 600, color: 'rgba(0,0,0,0.75)', letterSpacing: '-0.01em' }}>
            {title}
          </span>
        </div>
        <p style={{ fontFamily: SANS, fontSize: '11px', color: 'rgba(0,0,0,0.45)', margin: 0, lineHeight: 1.5 }}>
          {description}
        </p>
      </div>
      {formula && (
        <div style={{
          fontFamily: MONO, fontSize: '11px', color: 'rgba(0,0,0,0.65)',
          padding: '6px 14px',
          background: 'rgba(0,0,0,0.05)',
          border: '1px solid rgba(0,0,0,0.10)',
          borderRadius: '8px',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          {formula}
        </div>
      )}
    </div>
  );
}
