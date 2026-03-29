'use client';

/**
 * Nexus-Bio 2.0 — Root Application Shell
 *
 * State management:
 *   - UI state → Zustand (useUIStore) — no prop-drilling
 *   - AI analysis lifecycle → XState actor (analysisMachine)
 *   - Heavy layout computation → Web Worker (pathwayWorker)
 *
 * Rendering:
 *   - WebGL2 Navier-Stokes fluid background (FluidBackground, z=0)
 *   - R3F pathway visualization (ThreeScene, z=1)
 *   - UI overlays (z=2+)
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, useInView } from 'framer-motion';
import { useMachine } from '@xstate/react';
import Hero from './components/Hero';
import ThreeScene from './components/ThreeScene';
import NodePanel from './components/NodePanel';
import SemanticSearch from './components/SemanticSearch';
import ContactFlow from './components/ContactFlow';
import DevModePanel from './components/DevModePanel';
import PaperAnalyzer from './components/PaperAnalyzer';
import FeaturesArchitecture from './components/FeaturesArchitecture';
import FluidBackground from './components/FluidBackground';
import pathwayData from './data/pathwayData.json';
import { PathwayNode, PathwayEdge } from './types';
import { Dna, Sparkles, ShieldCheck, Zap, BarChart3 } from 'lucide-react';
import { useUIStore } from './store/uiStore';
import { analysisMachine } from './machines/analysisMachine';

// ── Design tokens (aligned with Design System 2.0) ─────────────────────
const SERIF = "'DM Serif Display', Georgia, serif";
const MONO  = "'JetBrains Mono', 'Fira Code', monospace";
const SANS  = "'Inter', -apple-system, sans-serif";

const TOKENS = {
  bgBase:     '#0A0D14',
  bgSurface:  '#0F1219',
  bgElevated: '#161B26',
  textPrimary:'#E2E8F0',
  textSecond: '#94A3B8',
  textMuted:  '#4A5568',
  border:     'rgba(255,255,255,0.07)',
  borderHov:  'rgba(255,255,255,0.14)',
  cyan:       '#22D3EE',
  magenta:    '#E879F9',
  amber:      '#F59E0B',
  emerald:    '#10B981',
  riskRed:    '#F87171',
} as const;

// ── Default edges — artemisinin mevalonate pathway ────────────────────
const DEFAULT_EDGES: PathwayEdge[] = [
  { start: 'acetyl_coa',        end: 'hmg_coa',            relationshipType: 'converts',  direction: 'forward', predicted_delta_G_kJ_mol: -33.5, spontaneity: 'Spontaneous', thickness_mapping: 'Medium', yield_prediction: 'High' },
  { start: 'acetyl_coa',        end: 'mevalonate',          relationshipType: 'produces',  direction: 'forward', predicted_delta_G_kJ_mol: -45.2, spontaneity: 'Spontaneous', thickness_mapping: 'Thin' },
  { start: 'hmg_coa',           end: 'mevalonate',          relationshipType: 'converts',  direction: 'forward', predicted_delta_G_kJ_mol: -53.1, spontaneity: 'Highly Spontaneous', thickness_mapping: 'Thick', yield_prediction: 'Rate-limiting step' },
  { start: 'mevalonate',        end: 'fpp',                 relationshipType: 'produces',  direction: 'forward', predicted_delta_G_kJ_mol: -30.0, spontaneity: 'Spontaneous', thickness_mapping: 'Medium', yield_prediction: 'High' },
  { start: 'fpp',               end: 'amorpha_4_11_diene',  relationshipType: 'catalyzes', direction: 'forward', predicted_delta_G_kJ_mol: -45.2, spontaneity: 'Highly Spontaneous', thickness_mapping: 'Medium', yield_prediction: 'Moderate' },
  { start: 'fpp',               end: 'epi_cedrol',          relationshipType: 'produces',  direction: 'forward', predicted_delta_G_kJ_mol: -28.0, spontaneity: 'Spontaneous', thickness_mapping: 'Thin', yield_prediction: 'Side reaction — ~15% FPP diverted' },
  { start: 'amorpha_4_11_diene', end: 'artemisinic_acid',   relationshipType: 'converts',  direction: 'forward', predicted_delta_G_kJ_mol: -120.5, spontaneity: 'Spontaneous', thickness_mapping: 'Thick', yield_prediction: 'High with CPR co-expression' },
  { start: 'artemisinic_acid',  end: 'artemisinin',         relationshipType: 'produces',  direction: 'forward', predicted_delta_G_kJ_mol: -150.0, spontaneity: 'Spontaneous (condition dependent)', thickness_mapping: 'Thin', yield_prediction: 'Low to Moderate without optimization' },
  { start: 'artemisinic_acid',  end: 'arteannuin_b',        relationshipType: 'produces',  direction: 'forward', predicted_delta_G_kJ_mol: -65.0, spontaneity: 'Spontaneous', thickness_mapping: 'Thin', yield_prediction: 'Non-enzymatic rearrangement — competing side product' },
];

// ── Scroll reveal wrapper ──────────────────────────────────────────────
function Reveal({ children, delay = 0, className = '', style }: {
  children: React.ReactNode; delay?: number; className?: string; style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div ref={ref} className={className} style={style}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

// ── Bento stat card ────────────────────────────────────────────────────
function StatCard({ label, value, sub, accentColor }: {
  label: string; value: string | number; sub?: string; accentColor?: string;
}) {
  const accent = accentColor ?? TOKENS.cyan;
  return (
    <div style={{
      padding: '18px 20px', borderRadius: '16px',
      background: `${TOKENS.bgSurface}`,
      border: `1px solid rgba(255,255,255,0.07)`,
      backdropFilter: 'blur(20px)',
      boxShadow: `0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.05)`,
    }}>
      <p style={{ fontFamily: MONO, fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: TOKENS.textMuted, margin: '0 0 8px' }}>
        {label}
      </p>
      <p style={{ fontFamily: MONO, fontSize: '26px', fontWeight: 600, color: accent, margin: '0 0 4px', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
        {value}
      </p>
      {sub && <p style={{ fontFamily: SANS, fontSize: '11px', color: TOKENS.textMuted, margin: 0 }}>{sub}</p>}
    </div>
  );
}

// ── Web Worker hook ────────────────────────────────────────────────────
function usePathwayStats(nodes: PathwayNode[]) {
  const [stats, setStats] = useState({ avgConfidence: 0, highRiskCount: 0, avgRisk: 0 });
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (typeof Worker === 'undefined' || nodes.length === 0) return;
    try {
      // Lazy-instantiate worker
      if (!workerRef.current) {
        workerRef.current = new Worker(new URL('./workers/pathwayWorker.ts', import.meta.url), { type: 'module' });
      }
      const w = workerRef.current;
      w.onmessage = (e) => {
        if (e.data.type === 'STATS_DONE') {
          setStats({
            avgConfidence: e.data.avgConfidence,
            highRiskCount: e.data.highRiskCount,
            avgRisk: e.data.avgRisk,
          });
        }
      };
      w.postMessage({
        type: 'COMPUTE_STATS',
        nodes: nodes.map(n => ({
          confidenceScore: n.confidenceScore,
          risk_score: n.risk_score,
          separation_cost_index: n.separation_cost_index,
          carbon_efficiency: n.carbon_efficiency,
          nodeType: n.nodeType,
        })),
      });
    } catch {
      // Worker unavailable — fall back to inline computation
      const n = nodes.length;
      const avgConf = nodes.reduce((s, nd) => s + (nd.confidenceScore ?? 0.78), 0) / n;
      const highRisk = nodes.filter(nd => (nd.risk_score ?? 0) > 0.7).length;
      const avgRisk = nodes.reduce((s, nd) => s + (nd.risk_score ?? 0), 0) / n;
      setStats({ avgConfidence: avgConf, highRiskCount: highRisk, avgRisk });
    }
    return () => { /* keep worker alive across re-renders */ };
  }, [nodes]);

  useEffect(() => () => { workerRef.current?.terminate(); }, []);
  return stats;
}

// ── Main ───────────────────────────────────────────────────────────────
export default function App() {
  // ── Zustand (UI state — no prop-drilling) ─────────────────────────
  const { aiNodes, aiEdges, setAiPathway, resetPathway, selectedNode, setSelectedNode } = useUIStore();

  // ── XState actor (AI analysis FSM) ────────────────────────────────
  const [machineState] = useMachine(analysisMachine);

  const activeNodes = useMemo(() =>
    Array.isArray(aiNodes) ? aiNodes : (Array.isArray(pathwayData) ? pathwayData as PathwayNode[] : []),
    [aiNodes]
  );
  const activeEdges = useMemo(() =>
    Array.isArray(aiEdges) ? aiEdges : DEFAULT_EDGES,
    [aiEdges]
  );

  // ── Stats computed in Web Worker ───────────────────────────────────
  const { avgConfidence, highRiskCount } = usePathwayStats(activeNodes);

  const handlePathwayGenerated = useCallback((nodes: PathwayNode[], edges: PathwayEdge[]) => {
    setAiPathway(nodes, edges);
    document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' });
  }, [setAiPathway]);

  const handleResetPathway = useCallback(() => resetPathway(), [resetPathway]);

  const avgConf = Math.round(avgConfidence * 100);

  return (
    <div className="app-shell" style={{ background: TOKENS.bgBase, color: TOKENS.textPrimary, minHeight: '100vh' }}>
      {/* ── WebGL2 Navier-Stokes Fluid Background (z=0, independent canvas) ── */}
      <FluidBackground />

      {/* ── Ambient glow overlay ── */}
      <div id="three-background" aria-hidden="true" className="app-canvas-background">
        <div className="app-canvas-glow" />
      </div>

      <main className="app-content" style={{ minHeight: '100vh' }}>
        <Hero />

        {/* ── BENTO GRID DASHBOARD ── */}
        <section id="demo" style={{ padding: 'clamp(64px, 10vw, 120px) clamp(16px, 4vw, 40px)' }}>
          <div style={{ maxWidth: '1280px', margin: '0 auto' }}>

            {/* Section header */}
            <Reveal>
              <div style={{ marginBottom: '40px' }}>
                <p style={{ fontFamily: MONO, fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.12em', color: TOKENS.cyan, margin: '0 0 12px', opacity: 0.7 }}>
                  01 · Visualization
                </p>
                <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 400, color: TOKENS.textPrimary, letterSpacing: '-0.02em', lineHeight: 1.1, margin: '0 0 12px' }}>
                  Atomic Pathway
                </h2>
                <p style={{ fontFamily: SANS, fontSize: '14px', color: TOKENS.textSecond, margin: 0, lineHeight: 1.6, maxWidth: '480px' }}>
                  pLDDT confidence coloring · Substrate diffusion · Click any node for details
                </p>
              </div>
            </Reveal>

            {/* Bento Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '12px' }}>

              {/* 3D Pathway — 8 cols */}
              <div style={{ gridColumn: 'span 8' }}>
                <Reveal delay={0.05}>
                  <motion.div
                    className="glass-panel"
                    style={{ borderRadius: '20px', overflow: 'hidden', position: 'relative' }}>
                    {/* AI Generated badge */}
                    {aiNodes && (
                      <div style={{
                        position: 'absolute', top: '14px', right: '14px', zIndex: 10,
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '5px 12px', borderRadius: '100px',
                        background: 'rgba(34,211,238,0.1)',
                        border: '1px solid rgba(34,211,238,0.25)',
                        backdropFilter: 'blur(12px)',
                        boxShadow: '0 0 16px rgba(34,211,238,0.2)',
                      }}>
                        <Sparkles size={10} style={{ color: TOKENS.cyan }} />
                        <span style={{ fontFamily: MONO, fontSize: '10px', fontWeight: 600, color: TOKENS.cyan, fontVariantNumeric: 'tabular-nums' }}>
                          AI · {aiNodes.length} entities
                        </span>
                        <button onClick={handleResetPathway}
                          style={{ marginLeft: '4px', fontFamily: MONO, fontSize: '10px', color: TOKENS.textMuted, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = TOKENS.textPrimary; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = TOKENS.textMuted; }}>
                          reset
                        </button>
                      </div>
                    )}
                    <ThreeScene
                      nodes={activeNodes}
                      onNodeClick={setSelectedNode}
                      edges={activeEdges}
                      selectedNodeId={selectedNode?.id ?? null}
                    />
                  </motion.div>
                </Reveal>
              </div>

              {/* Right sidebar — 4 cols */}
              <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <Reveal delay={0.1}>
                  <StatCard label="Pathway Entities" value={activeNodes.length} sub={aiNodes ? 'AI generated' : 'Showcase pathway'} accentColor={TOKENS.cyan} />
                </Reveal>
                <Reveal delay={0.15}>
                  <StatCard label="Avg Confidence" value={`${avgConf}%`} sub="pLDDT score" accentColor={avgConf >= 80 ? TOKENS.emerald : avgConf >= 60 ? TOKENS.amber : TOKENS.riskRed} />
                </Reveal>
                <Reveal delay={0.2}>
                  <StatCard label="Evidence Edges" value={activeEdges.length} sub="Reaction steps" accentColor={TOKENS.magenta} />
                </Reveal>
                {highRiskCount > 0 && (
                  <Reveal delay={0.22}>
                    <StatCard label="High-Risk Nodes" value={highRiskCount} sub="risk_score > 0.7" accentColor={TOKENS.riskRed} />
                  </Reveal>
                )}

                {!aiNodes && (
                  <Reveal delay={0.25}>
                    <div style={{
                      padding: '18px 20px', borderRadius: '16px', flex: 1,
                      background: TOKENS.bgSurface,
                      border: `1px solid ${TOKENS.border}`,
                    }}>
                      <p style={{ fontFamily: MONO, fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: TOKENS.textMuted, margin: '0 0 10px' }}>
                        Showcase
                      </p>
                      <p style={{ fontFamily: SERIF, fontSize: '15px', color: TOKENS.textPrimary, margin: '0 0 8px', lineHeight: 1.4 }}>
                        Ro et al., Nature 2006
                      </p>
                      <p style={{ fontFamily: SANS, fontSize: '12px', color: TOKENS.textSecond, lineHeight: 1.65, margin: 0 }}>
                        Artemisinin biosynthesis in <em>S. cerevisiae</em> — 7-step pathway, 500M patients.
                      </p>
                    </div>
                  </Reveal>
                )}
              </div>

              {/* Bottom info strip */}
              <Reveal delay={0.3} style={{ gridColumn: 'span 12' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 18px', borderRadius: '12px',
                  background: TOKENS.bgSurface,
                  border: `1px solid ${TOKENS.border}`,
                  gap: '12px', flexWrap: 'nowrap', overflow: 'hidden',
                }}>
                  <div style={{ display: 'flex', gap: '20px', flexShrink: 0 }}>
                    {[
                      { l: 'Renderer', v: 'WebGL2 + InstancedMesh' },
                      { l: 'Confidence', v: 'pLDDT coloring' },
                      { l: 'Interaction', v: 'Drag · Scroll · Click' },
                    ].map(({ l, v }) => (
                      <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontFamily: MONO, fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: TOKENS.textMuted }}>{l}</span>
                        <span style={{ fontFamily: MONO, fontSize: '10px', color: TOKENS.textSecond, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                  {/* XState machine state indicator */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      background: machineState.value === 'analyzing' ? TOKENS.amber
                        : machineState.value === 'success' ? TOKENS.emerald
                        : machineState.value === 'error' ? TOKENS.riskRed
                        : TOKENS.textMuted,
                      boxShadow: machineState.value === 'analyzing' ? `0 0 8px ${TOKENS.amber}` : 'none',
                    }} />
                    <span style={{ fontFamily: MONO, fontSize: '10px', color: TOKENS.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      FSM:{String(machineState.value)}
                    </span>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── NodePanel (progressive disclosure side drawer) ── */}
        <NodePanel
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          allNodes={activeNodes}
          allEdges={activeEdges}
        />

        {/* ── ARCHITECTURE / FEATURES ── */}
        <Reveal>
          <FeaturesArchitecture />
        </Reveal>

        {/* ── AI ANALYZER ── */}
        <Reveal>
          <PaperAnalyzer onPathwayGenerated={handlePathwayGenerated} />
        </Reveal>

        {/* ── SEARCH ── */}
        <Reveal>
          <SemanticSearch onAnalyzePaper={(text) => {
            document.getElementById('analyzer')?.scrollIntoView({ behavior: 'smooth' });
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('autoFillAnalyzer', { detail: { text } }));
            }, 600);
          }} />
        </Reveal>

        {/* ── CONTACT ── */}
        <Reveal>
          <ContactFlow />
        </Reveal>

        <DevModePanel />

        {/* ── Footer ── */}
        <footer style={{ padding: '24px 32px', borderTop: `1px solid ${TOKENS.border}` }}>
          <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '7px', background: `rgba(34,211,238,0.08)`, border: `1px solid rgba(34,211,238,0.18)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Dna size={11} style={{ color: TOKENS.cyan }} />
              </div>
              <span style={{ fontFamily: SERIF, fontSize: '14px', color: TOKENS.textSecond, letterSpacing: '-0.01em' }}>Nexus-Bio</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { icon: <ShieldCheck size={10} />, label: 'WCAG 2.2 AA' },
                { icon: <Zap size={10} />, label: 'INP ≤ 50ms' },
                { icon: <BarChart3 size={10} />, label: 'WebGL2 + FSM' },
              ].map(({ icon, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', background: TOKENS.bgSurface, border: `1px solid ${TOKENS.border}` }}>
                  <span style={{ color: TOKENS.textMuted }}>{icon}</span>
                  <span style={{ fontFamily: MONO, fontSize: '9px', color: TOKENS.textMuted, letterSpacing: '0.06em' }}>{label}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
              <p style={{ fontFamily: MONO, fontSize: '10px', color: TOKENS.textMuted, margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                © {new Date().getFullYear()} Nexus-Bio. All rights reserved.
              </p>
              {['Terms of Service', 'Privacy Policy'].map((t, i) => (
                <a key={i} href={t === 'Terms of Service' ? '/terms' : '/privacy'}
                  style={{ fontFamily: SANS, fontSize: '11px', color: TOKENS.textMuted, textDecoration: 'none', transition: 'color 0.2s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = TOKENS.textPrimary; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = TOKENS.textMuted; }}>
                  {t}
                </a>
              ))}
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
