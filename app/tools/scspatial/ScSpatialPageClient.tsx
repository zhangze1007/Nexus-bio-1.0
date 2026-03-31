'use client';
import dynamic from 'next/dynamic';
const ScSpatialPage = dynamic(() => import('../../../src/components/tools/ScSpatialPage'), { ssr: false });
export default function ScSpatialPageClient() { return <ScSpatialPage />; }
