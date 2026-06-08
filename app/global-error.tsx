'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          background: '#050505',
          color: 'rgba(250,246,240,0.96)',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Public Sans, sans-serif',
          margin: 0,
        }}
      >
        <h2 style={{ fontSize: '18px', marginBottom: '12px' }}>
          Something went wrong
        </h2>
        <p
          style={{
            fontSize: '13px',
            opacity: 0.7,
            marginBottom: '20px',
            maxWidth: '400px',
            textAlign: 'center',
          }}
        >
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
      </body>
    </html>
  );
}
