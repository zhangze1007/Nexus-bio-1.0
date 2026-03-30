'use client';
import dynamic from 'next/dynamic';
const NEXAIPage = dynamic(() => import('../../../src/components/tools/NEXAIPage'), { ssr: false });
export default function NEXAIPageClient() { return <NEXAIPage />; }
