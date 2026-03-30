'use client';

const MONO = "'JetBrains Mono','Fira Code',monospace";
const SANS = "'Inter',-apple-system,sans-serif";

interface EmptyStateProps {
  type?: 'empty' | 'loading' | 'error';
  title?: string;
  message?: string;
}

export default function EmptyState({ type = 'empty', title, message }: EmptyStateProps) {
  const defaultTitle = type === 'loading' ? 'Computing...' : type === 'error' ? 'Error' : 'No data';
  const defaultMsg = type === 'loading'
    ? 'Running simulation engine'
    : type === 'error'
    ? 'An error occurred. Check console for details.'
    : 'Adjust parameters and run the simulation.';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', gap: '8px', padding: '32px',
    }}>
      {type === 'loading' && (
        <div style={{
          width: '28px', height: '28px', borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.08)',
          borderTopColor: 'rgba(255,255,255,0.4)',
          animation: 'spin 0.8s linear infinite',
        }} />
      )}
      {type === 'error' && (
        <div style={{ fontSize: '24px', opacity: 0.4 }}>⚠</div>
      )}
      {type === 'empty' && (
        <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)' }} />
      )}
      <p style={{ fontFamily: MONO, fontSize: '11px', color: 'rgba(255,255,255,0.5)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {title ?? defaultTitle}
      </p>
      <p style={{ fontFamily: SANS, fontSize: '11px', color: 'rgba(255,255,255,0.25)', margin: 0, textAlign: 'center', lineHeight: 1.5 }}>
        {message ?? defaultMsg}
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
