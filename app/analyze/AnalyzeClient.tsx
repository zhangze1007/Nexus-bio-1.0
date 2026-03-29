'use client';
/**
 * /analyze — Full-page AI pathway analyzer
 * After generation, shows inline 3D preview + "Open in Lab" link to /tools/metabolic-eng
 */

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState, useCallback } from 'react';
import TopNav from '../../src/components/TopNav';
import { useUIStore } from '../../src/store/uiStore';
import type { PathwayNode, PathwayEdge } from '../../src/types';

const PaperAnalyzer = dynamic(
  () => import('../../src/components/PaperAnalyzer'),
  { ssr: false }
);

const ThreeScene = dynamic(
  () => import('../../src/components/ThreeScene'),
  { ssr: false }
);

const MONO = "'JetBrains Mono', 'Fira Code', monospace";
const SANS = "'Inter', -apple-system, sans-serif";

export default function AnalyzeClient() {
  const setAiPathway = useUIStore(s => s.setAiPathway);

  const [generatedNodes, setGeneratedNodes] = useState<PathwayNode[] | null>(null);
  const [generatedEdges, setGeneratedEdges] = useState<PathwayEdge[] | null>(null);

  const handlePathway = useCallback((nodes: PathwayNode[], edges: PathwayEdge[]) => {
    setAiPathway(nodes, edges);     // persist to Zustand for /tools/metabolic-eng
    setGeneratedNodes(nodes);       // show inline 3D preview
    setGeneratedEdges(edges);
  }, [setAiPathway]);

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', color: '#E2E8F0' }}>
      <TopNav />
      <div style={{ paddingTop: '58px' }}>
        <PaperAnalyzer onPathwayGenerated={handlePathway} />

        {/* ── Inline 3D pathway preview ── */}
        {generatedNodes && generatedEdges && (
          <div style={{ padding: '0 24px 64px', maxWidth: '1200px', margin: '0 auto' }}>

            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <p style={{
                fontFamily: MONO, fontSize: '11px',
                color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', margin: 0,
                textTransform: 'uppercase',
              }}>
                Pathway · {generatedNodes.length} nodes extracted
              </p>
              <Link
                href="/tools/metabolic-eng"
                style={{
                  fontFamily: SANS, fontSize: '12px',
                  color: 'rgba(255,255,255,0.5)', textDecoration: 'none',
                  border: '1px solid rgba(255,255,255,0.12)', padding: '6px 14px',
                  borderRadius: '8px', transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.color = '#fff';
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.3)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)';
                }}
              >
                Open in Lab →
              </Link>
            </div>

            {/* 3D preview */}
            <div style={{
              height: '480px', borderRadius: '16px', overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <ThreeScene
                nodes={generatedNodes}
                edges={generatedEdges}
                onNodeClick={() => {}}
                selectedNodeId={null}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
