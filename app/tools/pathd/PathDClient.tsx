'use client';
import dynamic from 'next/dynamic';

function PathDLoadingState() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#05070a',
        color: 'rgba(255,255,255,0.72)',
        fontFamily: "'Public Sans',sans-serif",
        fontSize: '12px',
      }}
    >
      Loading PATHD workbench...
    </div>
  );
}

const PathDPage = dynamic(() => import('../../../src/components/tools/PathDPage'), {
  ssr: false,
  loading: () => <PathDLoadingState />,
});

export default function PathDClient() {
  return <PathDPage />;
}
