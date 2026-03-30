'use client';
import dynamic from 'next/dynamic';
const FBASimPage = dynamic(() => import('../../../src/components/tools/FBASimPage'), { ssr: false });
export default function FBASimPageClient() { return <FBASimPage />; }
