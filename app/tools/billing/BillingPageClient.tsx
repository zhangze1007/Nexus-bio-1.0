'use client';
import dynamic from 'next/dynamic';

const BillingPage = dynamic(
  () => import('../../../src/components/tools/BillingPage'),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: 400,
          color: '#8a8f98',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 13,
        }}
      >
        Loading billing...
      </div>
    ),
  },
);

export default function BillingPageClient() {
  return <BillingPage />;
}
