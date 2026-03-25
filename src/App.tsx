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
import { Dna, Sparkles, Activity, GitBranch } from 'lucide-react';

// ── Design tokens ──────────────────────────────────────────────────────
const SERIF = "'DM Serif Display', Georgia, serif";
const BODY  = "'Public Sans', -apple-system, sans-serif";
const MONO  = "'JetBrains Mono', 'Fira Code', monospace";

// ── Neon accent palette ────────────────────────────────────────────────
const CYAN   = '#38bdf8';
const BLUE   = '#60a5fa';
const PURPLE = '#a78bfa';

// ── Scroll reveal wrapper ──────────────────────────────────────────────
function Reveal({ children, delay = 0, className = '', style }: {
  children: React.ReactNode; delay?: number; className?: string; style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div ref={ref} className={className} style={style}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

// ── Section label component ────────────────────────────────────────────
function SectionHeader({ num, tag, title, sub }: { num: string; tag: string; title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: '40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <span style={{ fontFamily: MONO, fontSize: '10px', color: CYAN, letterSpacing: '0.12em', fontWeight: 500 }}>
          {num}
        </span>
        <div style={{ width: '24px', height: '1px', background: `linear-gradient(to right, ${CYAN}, transparent)` }} />
        <span style={{ fontFamily: BODY, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.22)' }}>
          {tag}
        </span>
      </div>
      <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 400, color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.02em', lineHeight: 1.1, margin: '0 0 12px' }}>
        {title}
      </h2>
      {sub && (
        <p style={{ fontFamily: BODY, fontSize: '14px', color: 'rgba(255,255,255,0.32)', margin: 0, lineHeight: 1.65, maxWidth: '500px' }}>
          {sub}
        </p>
      )}
    </div>
  );
}

// ── Stat card — neon accent version ───────────────────────────────────
function StatCard({ label, value, sub, accent = 'default', icon }: {
  label: string; value: string | number; sub?: string; accent?: 'default' | 'cyan' | 'blue' | 'purple'; icon?: React.ReactNode;
}) {
  const accentColors = {
    default: { bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.07)', text: 'rgba(255,255,255,0.85)', glow: '' },
    cyan:    { bg: 'rgba(56,189,248,0.06)',  border: 'rgba(56,189,248,0.2)',  text: CYAN,   glow: '0 0 20px rgba(56,189,248,0.1)' },
    blue:    { bg: 'rgba(96,165,250,0.06)',  border: 'rgba(96,165,250,0.2)',  text: BLUE,   glow: '0 0 20px rgba(96,165,250,0.1)' },
    purple:  { bg: 'rgba(167,139,250,0.06)', border: 'rgba(167,139,250,0.2)', text: PURPLE, glow: '0 0 20px rgba(167,139,250,0.1)' },
  };
  const c = accentColors[accent];
  return (
    <div style={{
      padding: '18px 20px', borderRadius: '16px',
      background: c.bg,
      border: `1px solid ${c.border}`,
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      boxShadow: c.glow,
      position: 'relative', overflow: 'hidden',
    }}>
      {icon && (
        <div style={{ position: 'absolute', top: '14px', right: '14px', opacity: 0.3 }}>
          {icon}
        </div>
      )}
      <p style={{ fontFamily: BODY, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.22)', margin: '0 0 8px' }}>
        {label}
      </p>
      <p style={{ fontFamily: MONO, fontSize: '26px', fontWeight: 500, color: c.text, margin: '0 0 4px', lineHeight: 1, fontFeatureSettings: "'tnum' 1", textShadow: accent !== 'default' ? `0 0 16px ${c.text}50` : 'none' }}>
        {value}
      </p>
      {sub && <p style={{ fontFamily: BODY, fontSize: '11px', color: 'rgba(255,255,255,0.2)', margin: 0 }}>{sub}</p>}
    </div>
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
    <span style={{ fontFamily: MONO, fontSize: '10px', color: isDark ? CYAN : 'rgba(255,255,255,0.25)', fontFeatureSettings: "'tnum' 1" }}>
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
    <main style={{ background: 'var(--bg-base, #04060a)', minHeight: '100vh', color: 'var(--text-primary, rgba(255,255,255,0.92))' }}>
      <Hero />

      {/* ── BENTO GRID DASHBOARD ── */}
      <section id="demo" style={{ padding: 'clamp(64px, 10vw, 120px) clamp(16px, 4vw, 40px)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>

          {/* Section header */}
          <Reveal>
            <SectionHeader
              num="01"
              tag="Visualization"
              title="Atomic Pathway"
              sub="pLDDT confidence coloring · Substrate diffusion · Click any node for details"
            />
          </Reveal>

          {/* Bento Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '12px' }}>

            {/* Large card — 3D Pathway (8 cols) */}
            <div style={{ gridColumn: 'span 8' }}>
            <Reveal delay={0.05}>
              <motion.div
                style={{
                  borderRadius: '20px',
                  overflow: 'hidden',
                  border: '1px solid rgba(56,189,248,0.12)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  background: 'rgba(8,12,20,0.65)',
                  position: 'relative',
                  boxShadow: '0 0 40px rgba(56,189,248,0.05), 0 24px 48px rgba(0,0,0,0.4)',
                }}>
                {/* AI Generated badge */}
                {aiNodes && (
                  <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10, display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '100px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.28)', backdropFilter: 'blur(12px)', boxShadow: '0 0 12px rgba(56,189,248,0.12)' }}>
                    <Sparkles size={10} style={{ color: CYAN }} />
                    <span style={{ fontFamily: BODY, fontSize: '11px', fontWeight: 600, color: CYAN }}>
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
                <StatCard label="Pathway Entities" value={activeNodes.length} sub={aiNodes ? 'AI generated' : 'Showcase pathway'} accent="cyan" icon={<Activity size={16} />} />
              </Reveal>
              <Reveal delay={0.15}>
                <StatCard label="Avg Confidence" value={`${avgConf}%`} sub="pLDDT score" accent="blue" />
              </Reveal>
              <Reveal delay={0.2}>
                <StatCard label="Evidence Edges" value={activeEdges.length} sub="Reaction steps" accent="purple" icon={<GitBranch size={16} />} />
              </Reveal>

              {/* Showcase info card */}
              {!aiNodes && (
                <Reveal delay={0.25}>
                  <div style={{
                    padding: '18px 20px', borderRadius: '16px', flex: 1,
                    background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
                    backdropFilter: 'blur(20px)',
                  }}>
                    <p style={{ fontFamily: BODY, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.22)', margin: '0 0 10px' }}>
                      Showcase
                    </p>
                    <p style={{ fontFamily: SERIF, fontSize: '16px', color: 'rgba(255,255,255,0.8)', margin: '0 0 8px', lineHeight: 1.4 }}>
                      Ro et al., Nature 2006
                    </p>
                    <p style={{ fontFamily: BODY, fontSize: '12px', color: 'rgba(255,255,255,0.32)', lineHeight: 1.65, margin: 0 }}>
                      Artemisinin biosynthesis in <em>S. cerevisiae</em> — 7-step pathway, 500M patients.
                    </p>
                  </div>
                </Reveal>
              )}
            </div>

            {/* Bottom row — info strip */}
            <Reveal delay={0.3} style={{ gridColumn: 'span 12' }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 20px', borderRadius: '12px',
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(56,189,248,0.08)',
                backdropFilter: 'blur(12px)', gap: '12px', flexWrap: 'nowrap', overflow: 'hidden',
              }}>
                <div style={{ display: 'flex', gap: '24px', flexShrink: 0 }}>
                  {[
                    { l: 'Rendering', v: 'Lambert · Pastel' },
                    { l: 'Confidence', v: 'pLDDT coloring' },
                    { l: 'Interaction', v: 'Drag · Scroll · Click' },
                  ].map(({ l, v }) => (
                    <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontFamily: MONO, fontSize: '10px', fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.2)' }}>{l}</span>
                      <span style={{ fontFamily: MONO, fontSize: '10px', color: CYAN, opacity: 0.7 }}>{v}</span>
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
            <SectionHeader num="02" tag="Analysis" title="Paper Analyzer" />
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
            <SectionHeader num="03" tag="Literature" title="Database Research" />
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
            <SectionHeader num="04" tag="Connect" title="Contact" />
          </Reveal>
          <Reveal delay={0.1}>
            <ContactFlow />
          </Reveal>
        </div>
      </section>

      <DevModePanel />

      {/* Footer */}
      <footer style={{ padding: '24px 32px', borderTop: '1px solid rgba(56,189,248,0.08)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '20px', height: '20px', borderRadius: '6px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Dna size={11} style={{ color: CYAN }} />
            </div>
            <span style={{ fontFamily: SERIF, fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>Nexus-Bio</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <p style={{ fontFamily: BODY, fontSize: '11px', color: 'rgba(255,255,255,0.14)', margin: 0 }}>
              © {new Date().getFullYear()} Nexus-Bio. All rights reserved.
            </p>
            {['Terms of Service', 'Privacy Policy'].map((t, i) => (
              <a key={i} href={t === 'Terms of Service' ? '/terms' : '/privacy'}
                style={{ fontFamily: BODY, fontSize: '11px', color: 'rgba(255,255,255,0.18)', textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = CYAN; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.18)'; }}>
                {t}
              </a>
            ))}
          </div>
          <ThemeBadge />
        </div>
      </footer>
    </main>
  );
}
