'use client';
/**
 * /analyze — Full-page AI pathway analyzer
 * Preserves the existing analysis surface while compiling a canonical workflow artifact.
 */

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useCallback, useEffect, useMemo } from 'react';
import TopNav from '../../src/components/TopNav';
import WorkflowArtifactDebugPanel from '../../src/components/workflow/WorkflowArtifactDebugPanel';
import { compileWorkflowArtifact, type WorkflowArtifact, type WorkflowEvidencePacket } from '../../src/domain/workflowArtifact';
import { deriveAnalyzeCompatibilityProjection } from '../../src/domain/workflowArtifactAdapters';
import { useUIStore } from '../../src/store/uiStore';
import type { PathwayNode, PathwayEdge } from '../../src/types';
import {
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

function toWorkflowEvidencePackets(items: ReturnType<typeof useWorkbenchStore.getState>['evidenceItems']): WorkflowEvidencePacket[] {
  return items.map((item) => ({
    id: item.id,
    sourceKind: item.sourceKind,
    title: item.title,
    abstract: item.abstract,
    authors: item.authors,
    journal: item.journal,
    year: item.year,
    doi: item.doi,
    url: item.url,
    source: item.source,
    query: item.query,
  }));
}

function inferCompiledFrom(evidencePackets: WorkflowEvidencePacket[]) {
  return evidencePackets.length > 0 ? 'literature-bundle' : 'manual-text';
}

export default function AnalyzeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeArtifactId = searchParams.get('artifact');
  const setAiPathway = useUIStore((s) => s.setAiPathway);
  const resetPathway = useUIStore((s) => s.resetPathway);
  const draftAnalyzeInput = useWorkbenchStore((s) => s.draftAnalyzeInput);
  const workflowArtifact = useWorkbenchStore((s) => s.workflowArtifact);
  const selectedEvidenceIds = useWorkbenchStore((s) => s.selectedEvidenceIds);
  const evidenceItems = useWorkbenchStore((s) => s.evidenceItems);
  const project = useWorkbenchStore((s) => s.project);
  const ensureProject = useWorkbenchStore((s) => s.ensureProject);
  const persistWorkflowArtifact = useWorkbenchStore((s) => s.persistWorkflowArtifact);
  const artifactLoadState = useWorkbenchStore((s) => s.artifactLoadState);
  const artifactLoadError = useWorkbenchStore((s) => s.artifactLoadError);

  const [generatedNodes, setGeneratedNodes] = useState<PathwayNode[] | null>(null);
  const [generatedEdges, setGeneratedEdges] = useState<PathwayEdge[] | null>(null);
  const [draftArtifact, setDraftArtifact] = useState<WorkflowArtifact | null>(null);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [persistedArtifactId, setPersistedArtifactId] = useState<string | null>(routeArtifactId);

  useEffect(() => {
    setPersistedArtifactId(routeArtifactId);
  }, [routeArtifactId]);

  useEffect(() => {
    if (!draftAnalyzeInput.trim()) return;
    ensureProject({
      summary: 'Structured analyze session prepared from evidence bundle or manual input.',
      status: 'active',
      isDemo: false,
    });
  }, [draftAnalyzeInput, ensureProject]);

  const persistedArtifact = useMemo(
    () => (
      persistedArtifactId
      && workflowArtifact?.id === persistedArtifactId
      && workflowArtifact.status === 'compiled'
        ? workflowArtifact
        : null
    ),
    [persistedArtifactId, workflowArtifact],
  );

  const routeDraftArtifact = routeArtifactId && draftArtifact?.id === routeArtifactId
    ? draftArtifact
    : null;
  const displayArtifact = routeArtifactId
    ? persistedArtifact ?? routeDraftArtifact
    : persistedArtifact ?? draftArtifact;
  const displayAnalyzeArtifact = useMemo(
    () => (displayArtifact ? deriveAnalyzeCompatibilityProjection(displayArtifact) : null),
    [displayArtifact],
  );
  const graphSource = useMemo(() => {
    if (routeArtifactId) {
      if (artifactLoadState === 'ready' && persistedArtifact) return 'persisted' as const;
      if (artifactLoadState === 'loading' && persistedArtifact) return 'in-memory' as const;
      return 'none' as const;
    }
    if (persistedArtifact) return 'in-memory' as const;
    if (displayAnalyzeArtifact) return 'compatibility-projection' as const;
    if (generatedNodes && generatedEdges) return 'ui-graph' as const;
    return 'none' as const;
  }, [artifactLoadState, displayAnalyzeArtifact, generatedEdges, generatedNodes, persistedArtifact, routeArtifactId]);
  const compatibilityProjectionActive = Boolean(displayAnalyzeArtifact && !displayArtifact);
  const pathdArtifactId = displayArtifact?.status === 'compiled' ? displayArtifact.id : null;
  const pathdHref = pathdArtifactId ? `/tools/pathd?artifact=${encodeURIComponent(pathdArtifactId)}` : null;

  useEffect(() => {
    const graph = displayArtifact?.atomicPathwayGraph;
    if (!graph) {
      setGeneratedNodes(null);
      setGeneratedEdges(null);
      resetPathway();
      return;
    }

    setGeneratedNodes(graph.nodes);
    setGeneratedEdges(graph.edges);
    setAiPathway(graph.nodes, graph.edges);
  }, [displayArtifact?.id, displayArtifact?.status, displayArtifact?.updatedAt, displayArtifact?.version, displayArtifact?.atomicPathwayGraph, resetPathway, setAiPathway]);

  const handlePathway = useCallback((nodes: PathwayNode[], edges: PathwayEdge[]) => {
    setAiPathway(nodes, edges);
    setGeneratedNodes(nodes);
    setGeneratedEdges(edges);
  }, [setAiPathway]);

  const handleStructuredAnalysis = useCallback(async (payload: StructuredAnalysisPayload) => {
    const selectedEvidence = evidenceItems.filter((item) => selectedEvidenceIds.includes(item.id));
    const evidencePackets = toWorkflowEvidencePackets(selectedEvidence);
    const nextDraft = compileWorkflowArtifact({
      id: persistedArtifact?.id ?? '',
      previousArtifact: persistedArtifact,
      sourcePage: 'analyze',
      intake: {
        sourceQuery: project?.sourceQuery ?? selectedEvidence[0]?.query,
        targetMolecule: persistedArtifact?.intake.targetMolecule,
        projectIntent: payload.interaction?.question ?? project?.summary,
        rawAnalyzeInput: draftAnalyzeInput,
      },
      evidencePackets,
      nodes: payload.nodes,
      edges: payload.edges,
      compiledFrom: inferCompiledFrom(evidencePackets),
      sourceProvider: payload.sourceProvider,
    });

    setDraftArtifact(nextDraft);
    setPersistError(null);

    try {
      const savedArtifact = await persistWorkflowArtifact(nextDraft);
      setPersistedArtifactId(savedArtifact.id);
      router.replace(`/analyze?artifact=${encodeURIComponent(savedArtifact.id)}`, { scroll: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save compiled workflow artifact';
      setPersistError(message);
      setDraftArtifact({
        ...nextDraft,
        status: 'error',
        updatedAt: Date.now(),
      });
      throw (error instanceof Error ? error : new Error(message));
    }
  }, [
    draftAnalyzeInput,
    evidenceItems,
    persistWorkflowArtifact,
    persistedArtifact,
    project?.sourceQuery,
    project?.summary,
    router,
    selectedEvidenceIds,
  ]);

  const evidenceTrace = useMemo(() => {
    const traceIds = displayAnalyzeArtifact?.evidenceTraceIds ?? selectedEvidenceIds;
    return evidenceItems.filter((item) => traceIds.includes(item.id));
  }, [displayAnalyzeArtifact?.evidenceTraceIds, evidenceItems, selectedEvidenceIds]);

  const showArtifactLoading = Boolean(routeArtifactId && artifactLoadState === 'loading' && !persistedArtifact);
  const showArtifactEmpty = Boolean(routeArtifactId && artifactLoadState === 'empty');
  const showArtifactError = Boolean(routeArtifactId && artifactLoadState === 'error');

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', color: '#E2E8F0' }}>
      <TopNav />
      <div style={{ paddingTop: '58px' }}>
        <PaperAnalyzer
          onPathwayGenerated={handlePathway}
          onStructuredAnalysis={handleStructuredAnalysis}
          initialText={draftAnalyzeInput}
          pathdHref={pathdHref}
          pathdEnabled={Boolean(pathdArtifactId)}
        />

        {(persistError || showArtifactLoading || showArtifactEmpty || showArtifactError) && (
          <div style={{ padding: '0 24px 24px', maxWidth: '1200px', margin: '0 auto' }}>
            <div
              style={{
                borderRadius: '18px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)',
                padding: '14px 16px',
                color: 'rgba(255,255,255,0.68)',
                fontSize: '13px',
                lineHeight: 1.7,
              }}
            >
              {showArtifactLoading && `Loading canonical artifact ${routeArtifactId}...`}
              {showArtifactEmpty && `No persisted artifact was found for ${routeArtifactId}.`}
              {showArtifactError && (artifactLoadError ?? 'Failed to resolve canonical workflow artifact for this route.')}
              {persistError && !showArtifactLoading && !showArtifactEmpty && !showArtifactError && persistError}
            </div>
          </div>
        )}

        {displayAnalyzeArtifact && (
          <div style={{ padding: '0 24px 32px', maxWidth: '1200px', margin: '0 auto', display: 'grid', gap: '16px' }}>
            <WorkflowArtifactDebugPanel
              artifact={displayArtifact}
              graphSource={graphSource}
              compatibilityProjectionActive={compatibilityProjectionActive}
              title="Analyze workflow debug"
            />

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
                    {displayAnalyzeArtifact.targetProduct}
                  </h3>
                  <p style={{ fontFamily: SANS, fontSize: '14px', color: 'rgba(255,255,255,0.56)', lineHeight: 1.7, margin: 0, maxWidth: '72ch' }}>
                    {displayAnalyzeArtifact.summary}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {pathdHref ? (
                    <Link
                      href={pathdHref}
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
                  ) : (
                    <span
                      style={{
                        minHeight: '36px',
                        padding: '0 12px',
                        borderRadius: '999px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: 'rgba(255,255,255,0.03)',
                        color: 'rgba(255,255,255,0.42)',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}
                    >
                      Save artifact to enable PATHD
                    </span>
                  )}
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
                    value: `${displayAnalyzeArtifact.pathwayCandidates.length}`,
                    detail: displayAnalyzeArtifact.pathwayCandidates[0]?.description ?? 'Primary candidate ready for PATHD.',
                  },
                  {
                    label: 'Bottleneck assumptions',
                    value: `${displayAnalyzeArtifact.bottleneckAssumptions.length}`,
                    detail: displayAnalyzeArtifact.bottleneckAssumptions[0]?.label ?? 'No explicit bottleneck extracted.',
                  },
                  {
                    label: 'Enzyme candidates',
                    value: `${displayAnalyzeArtifact.enzymeCandidates.length}`,
                    detail: displayAnalyzeArtifact.enzymeCandidates[0]?.label ?? 'Awaiting design-specific prioritization.',
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
                  {(displayAnalyzeArtifact.thermodynamicConcerns.length > 0 ? displayAnalyzeArtifact.thermodynamicConcerns : ['No immediate energy-risk edge was flagged.']).map((concern) => (
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
                    {displayAnalyzeArtifact.recommendedNextTools.map((toolId) => {
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
              {pathdHref ? (
                <Link
                  href={pathdHref}
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
              ) : (
                <span
                  style={{
                    fontFamily: SANS,
                    fontSize: '12px',
                    color: 'rgba(255,255,255,0.35)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    padding: '6px 14px',
                    borderRadius: '8px',
                  }}
                >
                  Save artifact to enable PATHD
                </span>
              )}
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
