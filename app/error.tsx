'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{
      background: '#050505',
      color: 'rgba(250,246,240,0.96)',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Public Sans, sans-serif',
    }}>
      <h2 style={{ fontSize: '18px', marginBottom: '12px' }}>Something went wrong</h2>
      <p style={{ fontSize: '13px', opacity: 0.7, marginBottom: '20px' }}>
        {error.message || 'An unexpected error occurred'}
      </p>
      <button
        onClick={reset}
        style={{
          padding: '8px 20px',
          borderRadius: '8px',
          border: '1px solid rgba(250,246,240,0.2)',
          background: 'transparent',
          color: 'rgba(250,246,240,0.96)',
          cursor: 'pointer',
          fontSize: '13px',
        }}
      >
        Try again
      </button>
    </div>
  );
}
