'use client';
/**
 * /analyze — Full-page AI pathway analyzer
 */

import dynamic from 'next/dynamic';
import TopNav from '../../src/components/TopNav';
import { useUIStore } from '../../src/store/uiStore';
import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { PathwayNode, PathwayEdge } from '../../src/types';

const PaperAnalyzer = dynamic(
  () => import('../../src/components/PaperAnalyzer'),
  { ssr: false }
);

export default function AnalyzeClient() {
  const setAiPathway = useUIStore(s => s.setAiPathway);
  const router = useRouter();

  const handlePathway = useCallback((nodes: PathwayNode[], edges: PathwayEdge[]) => {
    setAiPathway(nodes, edges);
    router.push('/');
    setTimeout(() => {
      document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' });
    }, 600);
  }, [setAiPathway, router]);

  return (
    <div style={{ background: '#0A0D14', minHeight: '100vh', color: '#E2E8F0' }}>
      <TopNav />
      <div style={{ paddingTop: '58px' }}>
        <PaperAnalyzer onPathwayGenerated={handlePathway} />
      </div>
    </div>
  );
}
