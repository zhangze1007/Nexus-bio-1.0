'use client';
import dynamic from 'next/dynamic';
const DBTLflowPage = dynamic(() => import('../../../src/components/tools/DBTLflowPage'), { ssr: false });
export default function DBTLflowPageClient() { return <DBTLflowPage />; }
