'use client';
import dynamic from 'next/dynamic';
const CatalystDesignerPage = dynamic(() => import('../../../src/components/tools/CatalystDesignerPage'), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 400 }}>
      <div style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'rgba(175,195,214,0.6)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  ),
});
export default function CatalystDesignerPageClient() { return <CatalystDesignerPage />; }
