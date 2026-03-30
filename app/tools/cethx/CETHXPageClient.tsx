'use client';
import dynamic from 'next/dynamic';
const CETHXPage = dynamic(() => import('../../../src/components/tools/CETHXPage'), { ssr: false });
export default function CETHXPageClient() { return <CETHXPage />; }
