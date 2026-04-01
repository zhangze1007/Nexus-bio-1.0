'use client';
import { T } from '../tokens';

interface SimErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export default function SimErrorBanner({ message, onRetry }: SimErrorBannerProps) {
  return (
    <div
      role="alert"
      style={{
        padding: '16px 20px',
        background: 'rgba(250,128,114,0.08)',
        border: '1px solid rgba(250,128,114,0.25)',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontFamily: T.SANS,
      }}
    >
      <span style={{ fontSize: '18px', flexShrink: 0 }}>⚠</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#FA8072', marginBottom: '2px' }}>
          Simulation Error
        </div>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', wordBreak: 'break-word' }}>
          {message}
        </div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: '6px 14px',
            background: 'rgba(250,128,114,0.15)',
            border: '1px solid rgba(250,128,114,0.3)',
            borderRadius: '8px',
            color: '#FA8072',
            fontFamily: T.MONO,
            fontSize: '10px',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}
