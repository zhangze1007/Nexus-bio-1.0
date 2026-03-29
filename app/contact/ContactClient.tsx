'use client';
import dynamic from 'next/dynamic';
import TopNav from '../../src/components/TopNav';

const ContactFlow = dynamic(
  () => import('../../src/components/ContactFlow'),
  { ssr: false }
);

export default function ContactClient() {
  return (
    <div style={{ background: '#0A0D14', minHeight: '100vh', color: '#E2E8F0' }}>
      <TopNav />
      <div style={{ paddingTop: '58px' }}>
        <ContactFlow />
      </div>
    </div>
  );
}
