'use client';
import dynamic from 'next/dynamic';
const GenMIMPage = dynamic(() => import('../../../src/components/tools/GenMIMPage'), { ssr: false });
export default function GenMIMPageClient() { return <GenMIMPage />; }
