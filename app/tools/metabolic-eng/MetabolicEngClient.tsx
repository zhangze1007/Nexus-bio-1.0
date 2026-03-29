'use client';
import dynamic from 'next/dynamic';

const MetabolicEngPage = dynamic(
  () => import('../../../src/components/tools/MetabolicEngPage'),
  { ssr: false }
);

export default function MetabolicEngClient() {
  return <MetabolicEngPage />;
}
