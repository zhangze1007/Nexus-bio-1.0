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
      <section id="demo" className="px-4 py-24">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start justify-between mb-10 flex-wrap gap-4">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest mb-2"
                style={{ color: 'rgba(255,255,255,0.25)' }}>01 · Visualization</p>
              <h2 className="text-2xl md:text-3xl font-semibold text-white"
                style={{ letterSpacing: '-0.02em' }}>Atomic Pathway</h2>
              <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
                pLDDT confidence coloring · Substrate diffusion · Click any node for details
              </p>
              {!aiNodes && (
                <div className="mt-4 px-4 py-3 rounded-xl max-w-lg"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-xs font-mono mb-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    SHOWCASE · Ro et al., Nature 2006
                  </p>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
                    Artemisinin biosynthesis in engineered <em>S. cerevisiae</em> —
                    this 7-step pathway made malaria treatment affordable for 500 million patients.
                  </p>
                </div>
              )}
            </div>
            {aiNodes && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-white opacity-60 animate-pulse" />
                  AI Generated · {aiNodes.length} entities
                </div>
                <button onClick={handleResetPathway}
                  className="text-xs px-3 py-1.5 rounded-full transition-colors"
                  style={{ color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.08)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ffffff'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'; }}>
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
      <footer className="px-6 py-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-white flex items-center justify-center">
              <Dna size={12} className="text-black" />
            </div>
            <span className="text-sm font-semibold text-white">Nexus-Bio</span>
          </div>
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>
              © {new Date().getFullYear()} Nexus-Bio. All rights reserved.
            </p>
            <span style={{ color: 'rgba(255,255,255,0.1)' }}>·</span>
            <a href="/terms" className="text-xs font-mono transition-colors"
              style={{ color: 'rgba(255,255,255,0.2)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.2)'; }}>
              Terms of Service
            </a>
            <span style={{ color: 'rgba(255,255,255,0.1)' }}>·</span>
            <a href="/privacy" className="text-xs font-mono transition-colors"
              style={{ color: 'rgba(255,255,255,0.2)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.2)'; }}>
              Privacy Policy
            </a>
          </div>
          <div className="w-24 hidden md:block" />
        </div>
      </footer>
    </main>
  );
}
