'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useInView } from 'framer-motion';
import ThreeScene from './components/ThreeScene';
import NodePanel from './components/NodePanel';
import SemanticSearch from './components/SemanticSearch';
import ContactFlow from './components/ContactFlow';
import DevModePanel from './components/DevModePanel';
import PaperAnalyzer from './components/PaperAnalyzer';
import EvidencePopover from './components/EvidencePopover';
import pathwayData from './data/pathwayData.json';
import { PathwayNode, PathwayEdge, EvidenceAnchor } from './types';
import { NexusProvider, useNexus, useNexusDispatch } from './store/NexusContext';
import { Dna, Sparkles, FlaskConical, BookOpen, Activity } from 'lucide-react';

// ── Design tokens ──────────────────────────────────────────────────────
const BODY  = "'Public Sans', -apple-system, sans-serif";
const MONO  = "'JetBrains Mono', 'SF Mono', monospace";
const METALLIC = '#e7e7ea';

// ── Default edges — artemisinin mevalonate pathway ────────────────────
const DEFAULT_EDGES: PathwayEdge[] = [
  { start: 'acetyl_coa',        end: 'hmg_coa',            relationshipType: 'converts',  direction: 'forward', kineticParams: { Vmax: 1.2, Km: 0.4, deltaG: -31.4 } },
  { start: 'acetyl_coa',        end: 'mevalonate',          relationshipType: 'produces',  direction: 'forward', kineticParams: { Vmax: 0.8, Km: 0.3, deltaG: -25.1 } },
  { start: 'hmg_coa',           end: 'mevalonate',          relationshipType: 'converts',  direction: 'forward', kineticParams: { Vmax: 2.5, Km: 0.15, deltaG: -33.5 } },
  { start: 'mevalonate',        end: 'fpp',                 relationshipType: 'produces',  direction: 'forward', kineticParams: { Vmax: 1.0, Km: 0.6, deltaG: -18.2 } },
  { start: 'fpp',               end: 'amorpha_4_11_diene',  relationshipType: 'catalyzes', direction: 'forward', kineticParams: { Vmax: 3.0, Km: 0.08, deltaG: -42.7 } },
  { start: 'amorpha_4_11_diene', end: 'artemisinic_acid',   relationshipType: 'converts',  direction: 'forward', kineticParams: { Vmax: 0.6, Km: 0.5, deltaG: -28.9 } },
  { start: 'artemisinic_acid',  end: 'artemisinin',         relationshipType: 'produces',  direction: 'forward', kineticParams: { Vmax: 0.4, Km: 0.7, deltaG: -15.3 } },
];

const DEFAULT_NODES = (Array.isArray(pathwayData) ? pathwayData : []) as PathwayNode[];

// ── Scroll reveal wrapper ──────────────────────────────────────────────
function Reveal({ children, delay = 0, className = '', style }: {
  children: React.ReactNode; delay?: number; className?: string; style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  return (
    <motion.div ref={ref} className={className} style={style}
      initial={{ opacity: 0, y: 16 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

// ── Compact stat badge ────────────────────────────────────────────────
function StatBadge({ label, value, color = 'rgba(255,255,255,0.5)' }: {
  label: string; value: string | number; color?: string;
}) {
  return (
    <div style={{
      padding: '8px 12px', borderRadius: '10px',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <p style={{ fontFamily: MONO, fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.25)', margin: '0 0 3px' }}>
        {label}
      </p>
      <p style={{ fontFamily: MONO, fontSize: '16px', fontWeight: 700, color, margin: 0, lineHeight: 1, fontFeatureSettings: "'tnum' 1" }}>
        {value}
      </p>
    </div>
  );
}

// ── Column header ────────────────────────────────────────────────────
function ColumnHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '6px 0', marginBottom: '8px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      {icon}
      <span style={{
        fontFamily: MONO, fontSize: '10px', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.1em',
        color: 'rgba(255,255,255,0.3)',
      }}>
        {label}
      </span>
    </div>
  );
}

// ── WebGL Error Boundary ──────────────────────────────────────────────
class WebGLErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{
          padding: '24px', borderRadius: '12px',
          background: 'rgba(255,60,60,0.06)',
          border: '1px solid rgba(255,60,60,0.15)',
          color: 'rgba(255,255,255,0.5)',
          fontFamily: MONO, fontSize: '11px',
          textAlign: 'center',
        }}>
          <p style={{ margin: '0 0 4px', fontWeight: 600 }}>WebGL Context Lost</p>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.25)' }}>
            3D rendering unavailable. AI analysis remains functional.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Dashboard Inner (consumes NexusContext) ────────────────────────────
function DashboardInner() {
  const state = useNexus();
  const dispatch = useNexusDispatch();
  const { activeNodes, activeEdges, isAIGenerated, selectedNodeId, activePopoverAnchor, edgeFluxMap } = state;
  const workerRef = useRef<Worker | null>(null);

  const selectedNode = activeNodes.find(n => n.id === selectedNodeId) ?? null;

  // ODE Web Worker integration
  useEffect(() => {
    workerRef.current = new Worker('/ode-worker.js');
    workerRef.current.onmessage = (e: MessageEvent) => {
      if (e.data?.fluxMap) {
        dispatch({ type: 'SET_EDGE_FLUX', fluxMap: e.data.fluxMap });
      }
    };
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [dispatch]);

  // Run ODE simulation when edges change
  useEffect(() => {
    if (!workerRef.current) return;
    const edgeData = activeEdges.map((edge, i) => ({
      id: `${edge.start}_${edge.end}`,
      Vmax: edge.kineticParams?.Vmax ?? 1.0,
      Km: edge.kineticParams?.Km ?? 0.5,
      deltaG: edge.kineticParams?.deltaG ?? -20,
      S0: 2.0,
    }));
    workerRef.current.postMessage({ edges: edgeData, duration: 20, steps: 200 });
  }, [activeEdges]);

  const handleNodeClick = useCallback((node: PathwayNode) => {
    dispatch({ type: 'SELECT_NODE', nodeId: node.id });
  }, [dispatch]);

  const handlePathwayGenerated = useCallback((nodes: PathwayNode[], edges: PathwayEdge[]) => {
    dispatch({ type: 'SET_PATHWAY', nodes, edges });

    // Collect evidence anchors from AI-generated nodes
    const anchors: EvidenceAnchor[] = [];
    for (const node of nodes) {
      if (node.evidenceAnchors) {
        anchors.push(...node.evidenceAnchors);
      }
    }
    if (anchors.length > 0) {
      dispatch({ type: 'SET_EVIDENCE_ANCHORS', anchors });
    }
  }, [dispatch]);

  const handleResetPathway = useCallback(() => {
    dispatch({ type: 'RESET_PATHWAY', defaultNodes: DEFAULT_NODES, defaultEdges: DEFAULT_EDGES });
  }, [dispatch]);

  const avgConf = activeNodes.length > 0
    ? Math.round(
        activeNodes.reduce((acc, n) => acc + (n.confidenceScore ?? 0.78), 0) / activeNodes.length * 100
      )
    : 0;

  return (
    <div className="app-shell bg-futuristic-background text-white" style={{ minHeight: '100vh' }}>
      <div id="three-background" aria-hidden="true" className="app-canvas-background">
        <div className="app-canvas-glow" />
      </div>

      <main className="app-content" style={{ minHeight: '100vh' }}>
        {/* ── Top Bar ── */}
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(5,5,5,0.85)',
          backdropFilter: 'blur(16px)',
          position: 'sticky', top: 0, zIndex: 100,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '22px', height: '22px', borderRadius: '6px',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Dna size={12} style={{ color: 'rgba(255,255,255,0.5)' }} />
            </div>
            <span style={{ fontFamily: MONO, fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.04em' }}>
              NEXUS-BIO
            </span>
            <span style={{ fontFamily: MONO, fontSize: '9px', color: 'rgba(255,255,255,0.2)', marginLeft: '4px' }}>
              v1.0 · R&amp;D Workspace
            </span>
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ fontFamily: MONO, fontSize: '10px', color: 'rgba(255,255,255,0.2)', fontFeatureSettings: "'tnum' 1" }}>
              {activeNodes.length} nodes · {activeEdges.length} edges · {avgConf}% avg pLDDT
            </span>
            {isAIGenerated && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '3px 10px', borderRadius: '100px',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              }}>
                <Sparkles size={9} style={{ color: METALLIC }} />
                <span style={{ fontFamily: MONO, fontSize: '9px', fontWeight: 600, color: METALLIC }}>
                  AI · {activeNodes.length}
                </span>
                <button onClick={handleResetPathway}
                  style={{ fontFamily: MONO, fontSize: '9px', color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: '4px' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fff'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'; }}>
                  reset
                </button>
              </div>
            )}
          </div>
        </header>

        {/* ── 3-Column Tiled Dashboard ── */}
        <div id="demo" style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 320px',
          gap: '1px',
          background: 'rgba(255,255,255,0.04)',
          minHeight: 'calc(100vh - 45px)',
        }}>

          {/* ── LEFT: 3D Visualization ── */}
          <div style={{
            background: 'var(--bg-base)',
            padding: '10px',
            display: 'flex', flexDirection: 'column',
            minHeight: '500px',
          }}>
            <ColumnHeader
              icon={<FlaskConical size={11} style={{ color: 'rgba(255,255,255,0.3)' }} />}
              label="3D Atomic Pathway"
            />
            <WebGLErrorBoundary>
              <div style={{
                flex: 1, borderRadius: '8px', overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.06)',
                position: 'relative',
              }}>
                <ThreeScene
                  nodes={activeNodes}
                  onNodeClick={handleNodeClick}
                  edges={activeEdges}
                  selectedNodeId={selectedNodeId}
                  edgeFluxMap={edgeFluxMap}
                />
              </div>
            </WebGLErrorBoundary>

            {/* Stat badges row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginTop: '8px' }}>
              <StatBadge label="Entities" value={activeNodes.length} color={isAIGenerated ? '#facc15' : 'rgba(255,255,255,0.6)'} />
              <StatBadge label="pLDDT" value={`${avgConf}%`} />
              <StatBadge label="Edges" value={activeEdges.length} />
            </div>
          </div>

          {/* ── CENTER: Literature / AI Insights ── */}
          <div style={{
            background: 'var(--bg-base)',
            padding: '10px',
            display: 'flex', flexDirection: 'column', gap: '10px',
            overflowY: 'auto',
          }}>
            <ColumnHeader
              icon={<BookOpen size={11} style={{ color: 'rgba(255,255,255,0.3)' }} />}
              label="Literature & AI Insights"
            />

            {/* Paper Analyzer */}
            <Reveal delay={0.05}>
              <div style={{
                borderRadius: '8px', padding: '10px',
                border: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(255,255,255,0.015)',
              }}>
                <PaperAnalyzer onPathwayGenerated={handlePathwayGenerated} />
              </div>
            </Reveal>

            {/* Semantic Search */}
            <Reveal delay={0.1}>
              <div style={{
                borderRadius: '8px', padding: '10px',
                border: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(255,255,255,0.015)',
              }}>
                <SemanticSearch onAnalyzePaper={(text) => {
                  window.dispatchEvent(new CustomEvent('autoFillAnalyzer', { detail: { text } }));
                }} />
              </div>
            </Reveal>

            {/* Evidence anchors summary */}
            {state.evidenceAnchors.length > 0 && (
              <Reveal delay={0.15}>
                <div style={{
                  borderRadius: '8px', padding: '10px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(255,255,255,0.015)',
                }}>
                  <p style={{ fontFamily: MONO, fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.25)', margin: '0 0 6px' }}>
                    Evidence Anchors ({state.evidenceAnchors.length})
                  </p>
                  {state.evidenceAnchors.slice(0, 5).map((a, i) => (
                    <button
                      key={i}
                      onClick={() => dispatch({ type: 'SHOW_EVIDENCE_POPOVER', anchor: a })}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '5px 8px', margin: '2px 0',
                        borderRadius: '6px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.04)',
                        color: 'rgba(255,255,255,0.5)',
                        fontFamily: MONO, fontSize: '10px',
                        cursor: 'pointer',
                        lineHeight: 1.5,
                      }}
                    >
                      <span style={{ color: 'rgba(255,255,255,0.25)' }}>R{a.residue_id}</span>
                      {' · '}
                      {a.snippet.slice(0, 80)}{a.snippet.length > 80 ? '…' : ''}
                    </button>
                  ))}
                </div>
              </Reveal>
            )}
          </div>

          {/* ── RIGHT: Kinetics & Parameters ── */}
          <div style={{
            background: 'var(--bg-base)',
            padding: '10px',
            display: 'flex', flexDirection: 'column', gap: '10px',
            overflowY: 'auto',
          }}>
            <ColumnHeader
              icon={<Activity size={11} style={{ color: 'rgba(255,255,255,0.3)' }} />}
              label="Parameters & Simulation"
            />

            {/* Node panel inline (when node selected) */}
            {selectedNode && (
              <Reveal delay={0.05}>
                <div style={{
                  borderRadius: '8px', padding: '10px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(255,255,255,0.015)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontFamily: MONO, fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
                      {selectedNode.label}
                    </span>
                    <button
                      onClick={() => dispatch({ type: 'SELECT_NODE', nodeId: null })}
                      style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '12px', fontFamily: MONO }}>
                      ×
                    </button>
                  </div>
                  <p style={{ fontFamily: BODY, fontSize: '11px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, margin: '0 0 6px' }}>
                    {selectedNode.summary}
                  </p>
                  {selectedNode.citation && (
                    <p style={{ fontFamily: MONO, fontSize: '9px', color: 'rgba(255,255,255,0.2)', margin: 0 }}>
                      {selectedNode.citation}
                    </p>
                  )}
                  {selectedNode.confidenceScore != null && (
                    <div style={{
                      marginTop: '6px', padding: '4px 8px', borderRadius: '6px',
                      background: 'rgba(255,255,255,0.03)',
                      display: 'inline-block',
                    }}>
                      <span style={{ fontFamily: MONO, fontSize: '10px', color: selectedNode.confidenceScore >= 0.8 ? '#4ade80' : '#facc15', fontFeatureSettings: "'tnum' 1" }}>
                        pLDDT {(selectedNode.confidenceScore * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}

                  {/* Evidence anchors for this node */}
                  {selectedNode.evidenceAnchors && selectedNode.evidenceAnchors.length > 0 && (
                    <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
                      <p style={{ fontFamily: MONO, fontSize: '9px', color: 'rgba(255,255,255,0.2)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Evidence
                      </p>
                      {selectedNode.evidenceAnchors.map((a, i) => (
                        <button
                          key={i}
                          onClick={() => dispatch({ type: 'SHOW_EVIDENCE_POPOVER', anchor: a })}
                          style={{
                            display: 'block', width: '100%', textAlign: 'left',
                            padding: '4px 6px', margin: '2px 0', borderRadius: '4px',
                            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
                            color: 'rgba(255,255,255,0.4)', fontFamily: MONO, fontSize: '9px',
                            cursor: 'pointer', lineHeight: 1.5,
                          }}
                        >
                          &ldquo;{a.snippet.slice(0, 60)}…&rdquo;
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </Reveal>
            )}

            {/* Edge flux table */}
            {Object.keys(edgeFluxMap).length > 0 && (
              <Reveal delay={0.1}>
                <div style={{
                  borderRadius: '8px', padding: '10px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(255,255,255,0.015)',
                }}>
                  <p style={{ fontFamily: MONO, fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.25)', margin: '0 0 6px' }}>
                    Edge Flux (ODE Worker)
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {activeEdges.map((edge) => {
                      const key = `${edge.start}_${edge.end}`;
                      const flux = edgeFluxMap[key] ?? 0;
                      const maxFlux = Math.max(...Object.values(edgeFluxMap), 0.01);
                      const barWidth = Math.min((flux / maxFlux) * 100, 100);
                      return (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontFamily: MONO, fontSize: '8px', color: 'rgba(255,255,255,0.2)', width: '80px', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {edge.start.replace(/_/g, ' ')}
                          </span>
                          <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.04)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ width: `${barWidth}%`, height: '100%', background: 'rgba(255,255,255,0.25)', borderRadius: '2px', transition: 'width 0.3s' }} />
                          </div>
                          <span style={{ fontFamily: MONO, fontSize: '8px', color: 'rgba(255,255,255,0.3)', fontFeatureSettings: "'tnum' 1", width: '36px', textAlign: 'right' }}>
                            {flux.toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Reveal>
            )}

            {/* Kinetic parameters summary */}
            <Reveal delay={0.15}>
              <div style={{
                borderRadius: '8px', padding: '10px',
                border: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(255,255,255,0.015)',
              }}>
                <p style={{ fontFamily: MONO, fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.25)', margin: '0 0 6px' }}>
                  Kinetic Parameters
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {activeEdges.filter(e => e.kineticParams).slice(0, 7).map((edge, i) => (
                    <div key={i} style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                      gap: '4px', padding: '4px 6px', borderRadius: '4px',
                      background: 'rgba(255,255,255,0.02)',
                    }}>
                      <span style={{ fontFamily: MONO, fontSize: '8px', color: 'rgba(255,255,255,0.3)' }}>
                        V<sub>max</sub>={edge.kineticParams!.Vmax}
                      </span>
                      <span style={{ fontFamily: MONO, fontSize: '8px', color: 'rgba(255,255,255,0.3)' }}>
                        K<sub>m</sub>={edge.kineticParams!.Km}
                      </span>
                      <span style={{ fontFamily: MONO, fontSize: '8px', color: edge.kineticParams!.deltaG! < -25 ? '#4ade80' : '#facc15' }}>
                        ΔG={edge.kineticParams!.deltaG}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            {/* Showcase info */}
            {!isAIGenerated && (
              <Reveal delay={0.2}>
                <div style={{
                  borderRadius: '8px', padding: '10px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(255,255,255,0.015)',
                }}>
                  <p style={{ fontFamily: MONO, fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.25)', margin: '0 0 4px' }}>
                    Showcase Pathway
                  </p>
                  <p style={{ fontFamily: BODY, fontSize: '12px', color: 'rgba(255,255,255,0.6)', margin: '0 0 4px', lineHeight: 1.5 }}>
                    Ro et al., Nature 2006
                  </p>
                  <p style={{ fontFamily: BODY, fontSize: '11px', color: 'rgba(255,255,255,0.3)', lineHeight: 1.6, margin: 0 }}>
                    Artemisinin biosynthesis in <em>S.&nbsp;cerevisiae</em> — 7-step mevalonate pathway.
                  </p>
                </div>
              </Reveal>
            )}
          </div>
        </div>

        {/* ── Below-fold sections ── */}
        <section id="contact" style={{ padding: '40px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
            <Reveal>
              <ContactFlow />
            </Reveal>
          </div>
        </section>

        <DevModePanel />

        {/* Footer */}
        <footer style={{ padding: '16px 16px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Dna size={10} style={{ color: 'rgba(255,255,255,0.3)' }} />
              <span style={{ fontFamily: MONO, fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>Nexus-Bio</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <p style={{ fontFamily: MONO, fontSize: '9px', color: 'rgba(255,255,255,0.12)', margin: 0 }}>
                © {new Date().getFullYear()} Nexus-Bio
              </p>
              {['Terms of Service', 'Privacy Policy'].map((t, i) => (
                <a key={i} href={t === 'Terms of Service' ? '/terms' : '/privacy'}
                  style={{ fontFamily: MONO, fontSize: '9px', color: 'rgba(255,255,255,0.15)', textDecoration: 'none' }}>
                  {t}
                </a>
              ))}
            </div>
          </div>
        </footer>
      </main>

      {/* Evidence Popover */}
      {activePopoverAnchor && (
        <EvidencePopover
          anchor={activePopoverAnchor}
          onClose={() => dispatch({ type: 'SHOW_EVIDENCE_POPOVER', anchor: null })}
        />
      )}

      {/* Node detail slide-out (kept for backward compat) */}
      <NodePanel
        node={selectedNode}
        onClose={() => dispatch({ type: 'SELECT_NODE', nodeId: null })}
        allNodes={activeNodes}
        allEdges={activeEdges}
      />
    </div>
  );
}

// ── Main Export (wraps with NexusProvider) ─────────────────────────────
export default function App() {
  return (
    <NexusProvider defaultNodes={DEFAULT_NODES} defaultEdges={DEFAULT_EDGES}>
      <DashboardInner />
    </NexusProvider>
  );
}
