'use client';
import dynamic from 'next/dynamic';
const CellFreePage = dynamic(() => import('../../../src/components/tools/CellFreePage'), { ssr: false });
export default function CellFreePageClient() { return <CellFreePage />; }
