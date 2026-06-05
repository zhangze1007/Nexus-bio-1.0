'use client';

export default function ToolError({
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
      padding: '40px',
      fontFamily: 'Public Sans, sans-serif',
      borderRadius: '12px',
      border: '1px solid rgba(250,246,240,0.08)',
      margin: '20px',
    }}>
      <h3 style={{ fontSize: '15px', marginBottom: '8px' }}>Tool Error</h3>
      <p style={{ fontSize: '13px', opacity: 0.7, marginBottom: '16px' }}>
        {error.message || 'This tool encountered an error.'}
      </p>
      <button
        onClick={reset}
        style={{
          padding: '6px 16px',
          borderRadius: '6px',
          border: '1px solid rgba(147,203,82,0.4)',
          background: 'rgba(147,203,82,0.1)',
          color: 'rgba(147,203,82,0.9)',
          cursor: 'pointer',
          fontSize: '12px',
        }}
      >
        Retry
      </button>
    </div>
  );
}
