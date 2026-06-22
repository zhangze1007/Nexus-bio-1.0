'use client';
import { THEME } from '../../../theme';
const SANS = THEME.SANS;
const MONO = THEME.MONO;

interface EmptyStateProps {
  type?: 'empty' | 'loading' | 'error';
  title?: string;
  message?: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({
  type = 'empty',
  title,
  message,
  action,
}: EmptyStateProps) {
  const defaultTitle = type === 'loading' ? 'Loading data' : type === 'error' ? 'Something went wrong' : 'No data';
  const defaultMsg = type === 'loading'
    ? 'Preparing the current scientific view.'
    : type === 'error'
      ? 'The current step could not be completed. Adjust inputs or retry.'
      : 'Adjust filters or parameters to continue.';

  const accent = type === 'error'
    ? THEME.CORAL
    : type === 'loading'
      ? THEME.SKY
      : THEME.MINT;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100%',
        gap: '10px',
        padding: '32px',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.56) 100%)',
        color: THEME.PAPER_VALUE,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '999px',
          border: `1px solid ${accent}66`,
          background: `${accent}20`,
          display: 'grid',
          placeItems: 'center',
          boxShadow: '0 12px 30px rgba(41,46,53,0.08)',
        }}
      >
        {type === 'loading' ? (
          <div
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '999px',
              border: '2px solid rgba(79,88,97,0.16)',
              borderTopColor: accent,
              animation: 'spin 0.8s linear infinite',
            }}
          />
        ) : (
          <span style={{ fontFamily: MONO, fontSize: '14px', color: accent }}>
            {type === 'error' ? '!' : '·'}
          </span>
        )}
      </div>

      <p style={{ fontFamily: SANS, fontSize: '15px', fontWeight: 600, color: THEME.PAPER_VALUE, margin: 0 }}>
        {title ?? defaultTitle}
      </p>
      <p
        style={{
          fontFamily: SANS,
          fontSize: '13px',
          color: THEME.PAPER_LABEL,
          margin: 0,
          textAlign: 'center',
          lineHeight: 1.6,
          maxWidth: '44ch',
        }}
      >
        {message ?? defaultMsg}
      </p>

      {action && (
        <button
          onClick={action.onClick}
          style={{
            marginTop: '8px',
            padding: '8px 20px',
            fontFamily: SANS,
            fontSize: '13px',
            fontWeight: 600,
            color: '#050505',
            background: THEME.MINT,
            border: 'none',
            borderRadius: THEME.R_MD,
            cursor: 'pointer',
            transition: 'opacity 0.15s ease',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
        >
          {action.label}
        </button>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
