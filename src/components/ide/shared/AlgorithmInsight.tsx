'use client';
import { T } from '../tokens';

const MONO = T.MONO;
const SANS = T.SANS;

interface AlgorithmInsightProps {
  title: string;
  description: string;
  formula?: string;
}

export default function AlgorithmInsight({ title, description, formula }: AlgorithmInsightProps) {
  return (
    <div
      className="nb-algorithm-insight"
      style={{
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '8px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: 'rgba(255,255,255,0.025)',
        flexShrink: 0,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '1px', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: SANS, fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)' }}>
            Algorithm Insight
          </span>
          <span style={{ fontFamily: SANS, fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', letterSpacing: '-0.01em' }}>
            {title}
          </span>
        </div>
        <p style={{ fontFamily: SANS, fontSize: '10px', color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.45 }}>
          {description}
        </p>
      </div>
      {formula && (
        <div style={{
          fontFamily: MONO, fontSize: '10px', color: 'rgba(255,255,255,0.65)',
          padding: '4px 10px',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: 'min(42vw, 340px)',
          flexShrink: 0,
        }}>
          {formula}
        </div>
      )}
    </div>
  );
}
