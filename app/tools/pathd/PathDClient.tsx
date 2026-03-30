'use client';
import dynamic from 'next/dynamic';

const PathDPage = dynamic(() => import('../../../src/components/tools/PathDPage'), { ssr: false });

export default function PathDClient() {
  return <PathDPage />;
}
