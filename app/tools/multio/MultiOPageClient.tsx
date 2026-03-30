'use client';
import dynamic from 'next/dynamic';
const MultiOPage = dynamic(() => import('../../../src/components/tools/MultiOPage'), { ssr: false });
export default function MultiOPageClient() { return <MultiOPage />; }
