'use client';

const SANS = "'Inter',-apple-system,sans-serif";
const MONO = "'JetBrains Mono','Fira Code',monospace";

interface EmptyStateProps {
  type?: 'empty' | 'loading' | 'error';
  title?: string;
  message?: string;
}

export default function EmptyState({
  type = 'empty',
  title,
  message,
}: EmptyStateProps) {
  const defaultTitle = type === 'loading' ? 'Loading data' : type === 'error' ? 'Something went wrong' : 'No data';
  const defaultMsg = type === 'loading'
    ? 'Preparing the current scientific view.'
    : type === 'error'
      ? 'The current step could not be completed. Adjust inputs or retry.'
      : 'Adjust filters or parameters to continue.';

  const accent = type === 'error'
    ? 'rgba(255,140,126,0.95)'
    : type === 'loading'
      ? 'rgba(255,255,255,0.9)'
      : 'rgba(143,239,197,0.95)';

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
        background: '#050505',
        color: '#f5f7fb',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '999px',
          border: `1px solid ${accent}`,
          background: `${accent.replace('0.95', '0.12')}`,
          display: 'grid',
          placeItems: 'center',
          boxShadow: '0 12px 30px rgba(5,12,19,0.22)',
        }}
      >
        {type === 'loading' ? (
          <div
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '999px',
              border: '2px solid rgba(255,255,255,0.18)',
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

      <p style={{ fontFamily: SANS, fontSize: '15px', fontWeight: 600, color: '#ffffff', margin: 0 }}>
        {title ?? defaultTitle}
      </p>
      <p
        style={{
          fontFamily: SANS,
          fontSize: '13px',
          color: 'rgba(255,255,255,0.45)',
          margin: 0,
          textAlign: 'center',
          lineHeight: 1.6,
          maxWidth: '44ch',
        }}
      >
        {message ?? defaultMsg}
      </p>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
