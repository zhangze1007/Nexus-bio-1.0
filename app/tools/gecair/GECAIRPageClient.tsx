'use client';
import dynamic from 'next/dynamic';
const GECAIRPage = dynamic(() => import('../../../src/components/tools/GECAIRPage'), { ssr: false });
export default function GECAIRPageClient() { return <GECAIRPage />; }
