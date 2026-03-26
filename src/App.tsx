import { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import Hero from './components/Hero';
import ThreeScene from './components/ThreeScene';
import NodePanel from './components/NodePanel';
import SemanticSearch from './components/SemanticSearch';
import ContactFlow from './components/ContactFlow';
import DevModePanel from './components/DevModePanel';
import PaperAnalyzer from './components/PaperAnalyzer';
import pathwayData from './data/pathwayData.json';
import { PathwayNode, PathwayEdge } from './types';
import { Dna, Sparkles } from 'lucide-react';

// ── Design tokens ──────────────────────────────────────────────────────
const SERIF = "'DM Serif Display', Georgia, serif";
const BODY  = "'Public Sans', -apple-system, sans-serif";

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

// ── Environment badge ──────────────────────────────────────────────────
function ThemeBadge() {
  const [isDark, setIsDark] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDark(mq.matches);
    mq.addEventListener('change', e => setIsDark(e.matches));
    return () => mq.removeEventListener('change', () => {});
  }, []);
  return (
    <span style={{ fontFamily: BODY, fontSize: '10px', color: 'var(--text-faint)', fontFeatureSettings: "'tnum' 1" }}>
      {isDark ? '◑ dark' : '○ light'}
    </span>
  );
}

// ── Default edges ──────────────────────────────────────────────────────
const DEFAULT_EDGES: PathwayEdge[] = [
  { start: 'acetyl_coa',       end: 'hmg_coa',           relationshipType: 'converts',  direction: 'forward' },
  { start: 'acetyl_coa',       end: 'mevalonate',         relationshipType: 'produces',  direction: 'forward' },
  { start: 'hmg_coa',          end: 'mevalonate',         relationshipType: 'converts',  direction: 'forward' },
  { start: 'mevalonate',       end: 'fpp',                relationshipType: 'produces',  direction: 'forward' },
  { start: 'fpp',              end: 'amorpha_4_11_diene', relationshipType: 'catalyzes', direction: 'forward' },
  { start: 'amorpha_4_11_diene',end:'artemisinic_acid',   relationshipType: 'converts',  direction: 'forward' },
  { start: 'artemisinic_acid', end: 'artemisinin',        relationshipType: 'produces',  direction: 'forward' },
];

// ── Bento stat card ────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent = false }: {
  label: string; value: string | number; sub?: string; accent?: boolean;
}) {
  return (
    <div style={{
      padding: '18px 20px', borderRadius: '20px',
      background: accent ? 'rgba(200,216,232,0.07)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${accent ? 'rgba(200,216,232,0.18)' : 'rgba(255,255,255,0.07)'}`,
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
    }}>
      <p style={{ fontFamily: BODY, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.25)', margin: '0 0 8px' }}>
        {label}
      </p>
      <p style={{ fontFamily: BODY, fontSize: '28px', fontWeight: 700, color: accent ? '#C8D8E8' : 'rgba(255,255,255,0.85)', margin: '0 0 4px', fontFeatureSettings: "'tnum' 1", lineHeight: 1 }}>
        {value}
      </p>
      {sub && <p style={{ fontFamily: BODY, fontSize: '11px', color: 'rgba(255,255,255,0.2)', margin: 0 }}>{sub}</p>}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────
export default function App() {
  const [selectedNode, setSelectedNode] = useState<PathwayNode | null>(null);
  const [aiNodes, setAiNodes] = useState<PathwayNode[] | null>(null);
  const [aiEdges, setAiEdges] = useState<PathwayEdge[] | null>(null);

  const handlePathwayGenerated = (nodes: PathwayNode[], edges: PathwayEdge[]) => {
    setAiNodes(nodes);
    setAiEdges(edges);
    setSelectedNode(null);
    document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleResetPathway = () => {
    setAiNodes(null);
    setAiEdges(null);
    setSelectedNode(null);
  };

  const activeNodes = Array.isArray(aiNodes)
    ? aiNodes
    : (Array.isArray(pathwayData) ? pathwayData as PathwayNode[] : []);
  const activeEdges = Array.isArray(aiEdges) ? aiEdges : DEFAULT_EDGES;

  const avgConf = activeNodes.length > 0
    ? Math.round(
        activeNodes.reduce((acc, n) => acc + (n.confidenceScore ?? 0.78), 0) / activeNodes.length * 100
      )
    : 0;

  return (
    <div className="app-shell bg-futuristic-background text-white">
      <div id="three-background" aria-hidden="true" className="app-canvas-background">
        <div className="app-canvas-glow" />
      </div>
      <main className="app-content min-h-screen">
        <Hero />

      {/* ── BENTO GRID DASHBOARD ── */}
      <section id="demo" style={{ padding: 'clamp(64px, 10vw, 120px) clamp(16px, 4vw, 40px)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>

          {/* Section header */}
          <Reveal>
            <div style={{ marginBottom: '40px' }}>
              <p style={{ fontFamily: BODY, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.22)', margin: '0 0 12px' }}>
                01 · Visualization
              </p>
              <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 400, color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.02em', lineHeight: 1.1, margin: '0 0 12px' }}>
                Atomic Pathway
              </h2>
              <p style={{ fontFamily: BODY, fontSize: '14px', color: 'rgba(255,255,255,0.35)', margin: 0, lineHeight: 1.6, maxWidth: '480px' }}>
                pLDDT confidence coloring · Substrate diffusion · Click any node for details
              </p>
            </div>
          </Reveal>

          {/* Bento Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '12px', gridTemplateRows: 'auto' }}>

            {/* Large card — 3D Pathway (8 cols) */}
            <div style={{ gridColumn: 'span 8' }}>
            <Reveal delay={0.05}>
              <motion.div
                className="glass-panel"
                style={{
                  borderRadius: '20px',
                  overflow: 'hidden',
                  position: 'relative',
                }}>
                {/* AI Generated badge */}
                {aiNodes && (
                  <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10, display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '100px', background: 'rgba(200,216,232,0.10)', border: '1px solid rgba(200,216,232,0.18)', backdropFilter: 'blur(12px)' }}>
                    <Sparkles size={10} style={{ color: '#C8D8E8' }} />
                    <span style={{ fontFamily: BODY, fontSize: '11px', fontWeight: 600, color: '#C8D8E8', fontFeatureSettings: "'tnum' 1" }}>
                      AI · {aiNodes.length} entities
                    </span>
                    <button onClick={handleResetPathway}
                      style={{ marginLeft: '4px', fontFamily: BODY, fontSize: '10px', color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fff'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'; }}>
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

            {/* Right sidebar — 4 cols, stat cards */}
            <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Reveal delay={0.1}>
                <StatCard label="Pathway Entities" value={activeNodes.length} sub={aiNodes ? 'AI generated' : 'Showcase pathway'} accent />
              </Reveal>
              <Reveal delay={0.15}>
                <StatCard label="Avg Confidence" value={`${avgConf}%`} sub="pLDDT score" />
              </Reveal>
              <Reveal delay={0.2}>
                <StatCard label="Evidence Edges" value={activeEdges.length} sub="Reaction steps" />
              </Reveal>

              {/* Showcase info card */}
              {!aiNodes && (
                <Reveal delay={0.25}>
                  <div style={{
                    padding: '18px 20px', borderRadius: '20px', flex: 1,
                    background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
                    backdropFilter: 'blur(20px)',
                  }}>
                    <p style={{ fontFamily: BODY, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.22)', margin: '0 0 10px' }}>
                      Showcase
                    </p>
                    <p style={{ fontFamily: SERIF, fontSize: '16px', color: 'rgba(255,255,255,0.8)', margin: '0 0 8px', lineHeight: 1.4 }}>
                      Ro et al., Nature 2006
                    </p>
                    <p style={{ fontFamily: BODY, fontSize: '12px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.65, margin: 0 }}>
                      Artemisinin biosynthesis in <em>S. cerevisiae</em> — 7-step pathway, 500M patients.
                    </p>
                  </div>
                </Reveal>
              )}
            </div>

            {/* Bottom row — single-line info strip */}
            <Reveal delay={0.3} style={{ gridColumn: 'span 12' }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 20px', borderRadius: '16px',
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                backdropFilter: 'blur(12px)', gap: '12px', flexWrap: 'nowrap', overflow: 'hidden',
              }}>
                <div style={{ display: 'flex', gap: '20px', flexShrink: 0 }}>
                  {[
                    { l: 'Rendering', v: 'Lambert · Pastel' },
                    { l: 'Confidence', v: 'pLDDT coloring' },
                    { l: 'Interaction', v: 'Drag · Scroll · Click' },
                  ].map(({ l, v }) => (
                    <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontFamily: BODY, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.07em', color: 'rgba(255,255,255,0.2)' }}>{l}</span>
                      <span style={{ fontFamily: BODY, fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontFeatureSettings: "'tnum' 1" }}>{v}</span>
                    </div>
                  ))}
                </div>
                <ThemeBadge />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <NodePanel
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
        allNodes={activeNodes}
        allEdges={activeEdges}
      />

      {/* ── ANALYZER ── */}
      <section id="analyzer" style={{ padding: 'clamp(64px, 10vw, 120px) clamp(16px, 4vw, 40px)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <Reveal>
            <p style={{ fontFamily: BODY, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.22)', margin: '0 0 12px' }}>
              02 · Analysis
            </p>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 400, color: 'rgba(255,255,255,0.92)', margin: '0 0 40px', letterSpacing: '-0.02em' }}>
              Paper Analyzer
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <PaperAnalyzer onPathwayGenerated={handlePathwayGenerated} />
          </Reveal>
        </div>
      </section>

      {/* ── SEARCH ── */}
      <section id="search" style={{ padding: 'clamp(64px, 10vw, 120px) clamp(16px, 4vw, 40px)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <Reveal>
            <p style={{ fontFamily: BODY, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.22)', margin: '0 0 12px' }}>
              03 · Literature
            </p>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 400, color: 'rgba(255,255,255,0.92)', margin: '0 0 40px', letterSpacing: '-0.02em' }}>
              Database Research
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <SemanticSearch onAnalyzePaper={(text) => {
              document.getElementById('analyzer')?.scrollIntoView({ behavior: 'smooth' });
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('autoFillAnalyzer', { detail: { text } }));
              }, 600);
            }} />
          </Reveal>
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section id="contact" style={{ padding: 'clamp(64px, 10vw, 120px) clamp(16px, 4vw, 40px)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <Reveal>
            <p style={{ fontFamily: BODY, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.22)', margin: '0 0 12px' }}>
              04 · Connect
            </p>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 400, color: 'rgba(255,255,255,0.92)', margin: '0 0 40px', letterSpacing: '-0.02em' }}>
              Contact
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <ContactFlow />
          </Reveal>
        </div>
      </section>

      <DevModePanel />

      {/* Footer */}
      <footer style={{ padding: '24px 32px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '20px', height: '20px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Dna size={11} style={{ color: 'rgba(255,255,255,0.5)' }} />
            </div>
            <span style={{ fontFamily: SERIF, fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>Nexus-Bio</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <p style={{ fontFamily: BODY, fontSize: '11px', color: 'rgba(255,255,255,0.15)', margin: 0, fontFeatureSettings: "'tnum' 1" }}>
              © {new Date().getFullYear()} Nexus-Bio. All rights reserved.
            </p>
            {['Terms of Service', 'Privacy Policy'].map((t, i) => (
              <a key={i} href={t === 'Terms of Service' ? '/terms' : '/privacy'}
                style={{ fontFamily: BODY, fontSize: '11px', color: 'rgba(255,255,255,0.18)', textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.18)'; }}>
                {t}
              </a>
            ))}
          </div>
          <ThemeBadge />
        </div>
      </footer>
      </main>
    </div>
  );
}
