'use client';
import dynamic from 'next/dynamic';
const DynConPage = dynamic(() => import('../../../src/components/tools/DynConPage'), { ssr: false });
export default function DynConPageClient() { return <DynConPage />; }
