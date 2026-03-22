import { useState } from 'react';
import Hero from './components/Hero';
import ThreeScene from './components/ThreeScene';
import NodePanel from './components/NodePanel';
import SemanticSearch from './components/SemanticSearch';
import ContactFlow from './components/ContactFlow';
import DevModePanel from './components/DevModePanel';
import PaperAnalyzer from './components/PaperAnalyzer';
import pathwayData from './data/pathwayData.json';
import { PathwayNode, PathwayEdge } from './types';
import { Dna } from 'lucide-react';

const DEFAULT_EDGES: PathwayEdge[] = [
  { start: 'acetyl_coa', end: 'hmg_coa', relationshipType: 'converts', direction: 'forward' },
  { start: 'acetyl_coa', end: 'mevalonate', relationshipType: 'produces', direction: 'forward' },
  { start: 'hmg_coa', end: 'mevalonate', relationshipType: 'converts', direction: 'forward' },
  { start: 'mevalonate', end: 'fpp', relationshipType: 'produces', direction: 'forward' },
  { start: 'fpp', end: 'amorpha_4_11_diene', relationshipType: 'catalyzes', direction: 'forward' },
  { start: 'amorpha_4_11_diene', end: 'artemisinic_acid', relationshipType: 'converts', direction: 'forward' },
  { start: 'artemisinic_acid', end: 'artemisinin', relationshipType: 'produces', direction: 'forward' },
];

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

  const activeNodes = aiNodes ?? (pathwayData as PathwayNode[]);
  const activeEdges = aiEdges ?? DEFAULT_EDGES;

  return (
    <main style={{ background: '#0a0a0a', minHeight: '100vh', color: '#f5f5f5' }}>
      <Hero />

      {/* 01 — Pathway */}
      <section id="demo" style={{ padding: '96px 24px' }}>
        <div style={{ maxWidth: '1024px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '40px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <p style={{ fontFamily: "'SF Mono','Fira Code',monospace", fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.2)', margin: '0 0 10px' }}>
                01 · Visualization
              </p>
              <h2 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 400, color: 'rgba(255,255,255,0.90)', letterSpacing: '-0.02em', lineHeight: 1.1, margin: '0 0 10px' }}>
                Atomic Pathway
              </h2>
              <p style={{ fontFamily: 'Arial, sans-serif', fontSize: '13px', color: 'rgba(255,255,255,0.32)', margin: 0, lineHeight: 1.6 }}>
                pLDDT confidence coloring · Substrate diffusion · Click any node for details
              </p>
              {!aiNodes && (
                <div style={{ marginTop: '16px', padding: '14px 18px', borderRadius: '12px', maxWidth: '520px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <p style={{ fontFamily: "'SF Mono','Fira Code',monospace", fontSize: '10px', color: 'rgba(255,255,255,0.22)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Showcase · Ro et al., Nature 2006
                  </p>
                  <p style={{ fontFamily: 'Arial, sans-serif', fontSize: '13px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, margin: 0 }}>
                    Artemisinin biosynthesis in engineered <em>S. cerevisiae</em> —
                    this 7-step pathway made malaria treatment affordable for 500 million patients.
                  </p>
                </div>
              )}
            </div>
            {aiNodes && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 14px', borderRadius: '100px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.45)', fontFamily: "'SF Mono','Fira Code',monospace", fontSize: '10px' }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'rgba(255,255,255,0.5)', animation: 'pulse 2s infinite' }} />
                  AI Generated · {aiNodes.length} entities
                </div>
                <button onClick={handleResetPathway} style={{ fontFamily: 'Arial, sans-serif', fontSize: '12px', color: 'rgba(255,255,255,0.28)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '100px', padding: '6px 14px', background: 'none', cursor: 'pointer', transition: 'color 0.2s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fff'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.28)'; }}>
                  Reset to Showcase
                </button>
              </div>
            )}
          </div>
          <ThreeScene
            nodes={activeNodes}
            onNodeClick={setSelectedNode}
            edges={activeEdges}
            selectedNodeId={selectedNode?.id ?? null}
          />
        </div>
      </section>

      <NodePanel
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
        allNodes={activeNodes}
        allEdges={activeEdges}
      />

      {/* 02 — Analyzer */}
      <PaperAnalyzer onPathwayGenerated={handlePathwayGenerated} />

      {/* 03 — Literature */}
      <SemanticSearch onAnalyzePaper={(text) => {
        document.getElementById('analyzer')?.scrollIntoView({ behavior: 'smooth' });
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('autoFillAnalyzer', { detail: { text } }));
        }, 600);
      }} />

      {/* 04 — Contact */}
      <ContactFlow />

      <DevModePanel />

      {/* Footer */}
      <footer style={{ padding: '24px 32px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: '1024px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '20px', height: '20px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Dna size={11} style={{ color: 'rgba(255,255,255,0.5)' }} />
            </div>
            <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>Nexus-Bio</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <p style={{ fontFamily: "'SF Mono','Fira Code',monospace", fontSize: '10px', color: 'rgba(255,255,255,0.15)', margin: 0 }}>
              © {new Date().getFullYear()} Nexus-Bio. All rights reserved.
            </p>
            <span style={{ color: 'rgba(255,255,255,0.08)' }}>·</span>
            <a href="/terms" style={{ fontFamily: "'SF Mono','Fira Code',monospace", fontSize: '10px', color: 'rgba(255,255,255,0.18)', textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.18)'; }}>
              Terms of Service
            </a>
            <span style={{ color: 'rgba(255,255,255,0.08)' }}>·</span>
            <a href="/privacy" style={{ fontFamily: "'SF Mono','Fira Code',monospace", fontSize: '10px', color: 'rgba(255,255,255,0.18)', textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.18)'; }}>
              Privacy Policy
            </a>
          </div>
          <div style={{ width: '100px' }} />
        </div>
      </footer>
    </main>
  );
}
