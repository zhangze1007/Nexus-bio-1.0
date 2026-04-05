'use client';
/**
 * /analyze — Full-page AI pathway analyzer
 * Preserves the existing analysis surface while emitting a structured workbench artifact.
 */

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState, useCallback, useEffect, useMemo } from 'react';
import TopNav from '../../src/components/TopNav';
import { useUIStore } from '../../src/store/uiStore';
import type { PathwayNode, PathwayEdge } from '../../src/types';
import {
  buildAnalyzeArtifactFromStructuredAnalysis,
  useWorkbenchStore,
  type StructuredAnalysisPayload,
} from '../../src/store/workbenchStore';
import { TOOL_BY_ID } from '../../src/components/tools/shared/toolRegistry';

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
  const setAiPathway = useUIStore((s) => s.setAiPathway);
  const draftAnalyzeInput = useWorkbenchStore((s) => s.draftAnalyzeInput);
  const analyzeArtifact = useWorkbenchStore((s) => s.analyzeArtifact);
  const selectedEvidenceIds = useWorkbenchStore((s) => s.selectedEvidenceIds);
  const evidenceItems = useWorkbenchStore((s) => s.evidenceItems);
  const ensureProject = useWorkbenchStore((s) => s.ensureProject);
  const setAnalyzeArtifact = useWorkbenchStore((s) => s.setAnalyzeArtifact);

  const [generatedNodes, setGeneratedNodes] = useState<PathwayNode[] | null>(null);
  const [generatedEdges, setGeneratedEdges] = useState<PathwayEdge[] | null>(null);

  useEffect(() => {
    if (!draftAnalyzeInput.trim()) return;
    ensureProject({
      summary: 'Structured analyze session prepared from evidence bundle or manual input.',
      status: 'active',
      isDemo: false,
    });
  }, [draftAnalyzeInput, ensureProject]);

  useEffect(() => {
    if (generatedNodes || generatedEdges || !analyzeArtifact) return;
    setGeneratedNodes(analyzeArtifact.nodes);
    setGeneratedEdges(analyzeArtifact.edges);
    setAiPathway(analyzeArtifact.nodes, analyzeArtifact.edges);
  }, [analyzeArtifact, generatedEdges, generatedNodes, setAiPathway]);

  const handlePathway = useCallback((nodes: PathwayNode[], edges: PathwayEdge[]) => {
    setAiPathway(nodes, edges);
    setGeneratedNodes(nodes);
    setGeneratedEdges(edges);
  }, [setAiPathway]);

  const handleStructuredAnalysis = useCallback((payload: StructuredAnalysisPayload) => {
    const artifact = buildAnalyzeArtifactFromStructuredAnalysis(payload, selectedEvidenceIds);
    setAnalyzeArtifact(artifact);
    setAiPathway(payload.nodes, payload.edges);
  }, [selectedEvidenceIds, setAiPathway, setAnalyzeArtifact]);

  const evidenceTrace = useMemo(() => {
    const traceIds = analyzeArtifact?.evidenceTraceIds ?? selectedEvidenceIds;
    return evidenceItems.filter((item) => traceIds.includes(item.id));
  }, [analyzeArtifact?.evidenceTraceIds, evidenceItems, selectedEvidenceIds]);

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', color: '#E2E8F0' }}>
      <TopNav />
      <div style={{ paddingTop: '58px' }}>
        <PaperAnalyzer
          onPathwayGenerated={handlePathway}
          onStructuredAnalysis={handleStructuredAnalysis}
          initialText={draftAnalyzeInput}
        />

        {analyzeArtifact && (
          <div style={{ padding: '0 24px 32px', maxWidth: '1200px', margin: '0 auto' }}>
            <div
              style={{
                borderRadius: '22px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
                padding: '20px',
                display: 'grid',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'grid', gap: '6px' }}>
                  <p style={{ fontFamily: MONO, fontSize: '11px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                    Structured analyze artifact
                  </p>
                  <h3 style={{ fontFamily: SANS, fontSize: '28px', color: '#ffffff', margin: 0, letterSpacing: '-0.04em' }}>
                    {analyzeArtifact.targetProduct}
                  </h3>
                  <p style={{ fontFamily: SANS, fontSize: '14px', color: 'rgba(255,255,255,0.56)', lineHeight: 1.7, margin: 0, maxWidth: '72ch' }}>
                    {analyzeArtifact.summary}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <Link
                    href="/tools/pathd"
                    style={{
                      minHeight: '36px',
                      padding: '0 12px',
                      borderRadius: '999px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      textDecoration: 'none',
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(255,255,255,0.06)',
                      color: '#ffffff',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    Open PATHD
                  </Link>
                  <Link
                    href="/tools"
                    style={{
                      minHeight: '36px',
                      padding: '0 12px',
                      borderRadius: '999px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      textDecoration: 'none',
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(255,255,255,0.03)',
                      color: 'rgba(255,255,255,0.65)',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    Open Stage Dashboard
                  </Link>
                </div>
              </div>

              <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                {[
                  {
                    label: 'Pathway candidates',
                    value: `${analyzeArtifact.pathwayCandidates.length}`,
                    detail: analyzeArtifact.pathwayCandidates[0]?.description ?? 'Primary candidate ready for PATHD.',
                  },
                  {
                    label: 'Bottleneck assumptions',
                    value: `${analyzeArtifact.bottleneckAssumptions.length}`,
                    detail: analyzeArtifact.bottleneckAssumptions[0]?.label ?? 'No explicit bottleneck extracted.',
                  },
                  {
                    label: 'Enzyme candidates',
                    value: `${analyzeArtifact.enzymeCandidates.length}`,
                    detail: analyzeArtifact.enzymeCandidates[0]?.label ?? 'Awaiting design-specific prioritization.',
                  },
                  {
                    label: 'Evidence trace',
                    value: `${evidenceTrace.length}`,
                    detail: evidenceTrace[0]?.title ?? 'Manual text input or direct analysis context.',
                  },
                ].map((card) => (
                  <div
                    key={card.label}
                    style={{
                      borderRadius: '18px',
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(255,255,255,0.03)',
                      padding: '14px 15px',
                      display: 'grid',
                      gap: '6px',
                    }}
                  >
                    <p style={{ fontFamily: MONO, fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                      {card.label}
                    </p>
                    <p style={{ fontFamily: SANS, fontSize: '22px', color: '#ffffff', fontWeight: 700, margin: 0 }}>
                      {card.value}
                    </p>
                    <p style={{ fontFamily: SANS, fontSize: '12px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, margin: 0 }}>
                      {card.detail}
                    </p>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gap: '14px', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
                <div
                  style={{
                    borderRadius: '18px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.03)',
                    padding: '14px 15px',
                    display: 'grid',
                    gap: '8px',
                  }}
                >
                  <p style={{ fontFamily: MONO, fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                    Thermodynamic concerns
                  </p>
                  {(analyzeArtifact.thermodynamicConcerns.length > 0 ? analyzeArtifact.thermodynamicConcerns : ['No immediate energy-risk edge was flagged.']).map((concern) => (
                    <p key={concern} style={{ fontFamily: SANS, fontSize: '12px', color: 'rgba(255,255,255,0.62)', lineHeight: 1.6, margin: 0 }}>
                      {concern}
                    </p>
                  ))}
                </div>

                <div
                  style={{
                    borderRadius: '18px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.03)',
                    padding: '14px 15px',
                    display: 'grid',
                    gap: '8px',
                  }}
                >
                  <p style={{ fontFamily: MONO, fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                    Evidence trace
                  </p>
                  {evidenceTrace.length > 0 ? evidenceTrace.slice(0, 3).map((item) => (
                    <p key={item.id} style={{ fontFamily: SANS, fontSize: '12px', color: 'rgba(255,255,255,0.62)', lineHeight: 1.6, margin: 0 }}>
                      {item.title}
                    </p>
                  )) : (
                    <p style={{ fontFamily: SANS, fontSize: '12px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, margin: 0 }}>
                      This artifact was created from manual input or a direct paper paste.
                    </p>
                  )}
                </div>

                <div
                  style={{
                    borderRadius: '18px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.03)',
                    padding: '14px 15px',
                    display: 'grid',
                    gap: '8px',
                  }}
                >
                  <p style={{ fontFamily: MONO, fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                    Recommended next tools
                  </p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {analyzeArtifact.recommendedNextTools.map((toolId) => {
                      const tool = TOOL_BY_ID[toolId];
                      if (!tool) return null;
                      return (
                        <Link
                          key={tool.id}
                          href={tool.href}
                          style={{
                            minHeight: '32px',
                            padding: '0 12px',
                            borderRadius: '999px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            textDecoration: 'none',
                            border: '1px solid rgba(255,255,255,0.08)',
                            background: 'rgba(255,255,255,0.05)',
                            color: '#ffffff',
                            fontSize: '11px',
                          }}
                        >
                          {tool.shortLabel}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {generatedNodes && generatedEdges && (
          <div style={{ padding: '0 24px 64px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '16px', flexWrap: 'wrap' }}>
              <p
                style={{
                  fontFamily: MONO,
                  fontSize: '11px',
                  color: 'rgba(255,255,255,0.4)',
                  letterSpacing: '0.08em',
                  margin: 0,
                  textTransform: 'uppercase',
                }}
              >
                Pathway · {generatedNodes.length} nodes extracted
              </p>
              <Link
                href="/tools/pathd"
                style={{
                  fontFamily: SANS,
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.5)',
                  textDecoration: 'none',
                  border: '1px solid rgba(255,255,255,0.12)',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#fff';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                }}
              >
                Open in PATHD →
              </Link>
            </div>

            <div
              style={{
                height: '480px',
                borderRadius: '16px',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
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
