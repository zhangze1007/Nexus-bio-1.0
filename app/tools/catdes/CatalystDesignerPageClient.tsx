'use client';
import dynamic from 'next/dynamic';
const CatalystDesignerPage = dynamic(() => import('../../../src/components/tools/CatalystDesignerPageV2'), { ssr: false });
export default function CatalystDesignerPageClient() { return <CatalystDesignerPage />; }
