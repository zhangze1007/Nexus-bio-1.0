'use client';
import dynamic from 'next/dynamic';
const ProEvolPage = dynamic(() => import('../../../src/components/tools/ProEvolPage'), { ssr: false });
export default function ProEvolPageClient() { return <ProEvolPage />; }
