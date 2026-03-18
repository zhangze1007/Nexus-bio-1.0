import { useState } from 'react';
import Hero from './components/Hero';
import ThreeScene from './components/ThreeScene';
import NodePanel from './components/NodePanel';
import SemanticSearch from './components/SemanticSearch';
import ContactFlow from './components/ContactFlow';
import DevModePanel from './components/DevModePanel';
import PaperAnalyzer from './components/PaperAnalyzer';
import pathwayData from './data/pathwayData.json';
import { PathwayNode } from './types';

export default function App() {
  const [selectedNode, setSelectedNode] = useState<PathwayNode | null>(null);
  const [aiNodes, setAiNodes] = useState<PathwayNode[] | null>(null);
  const [aiEdges, setAiEdges] = useState<{ start: string; end: string }[] | null>(null);

  const handlePathwayGenerated = (nodes: PathwayNode[], edges: { start: string; end: string }[]) => {
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
  const activeEdges = aiEdges ?? undefined;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-emerald-500/30">
      <Hero />

      <section className="py-24 px-4 max-w-6xl mx-auto" id="demo">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
            Metabolic Pathway Simulation
          </h2>
          <p className="text-zinc-400 font-mono text-sm uppercase tracking-widest">
            Interactive Node Exploration (交互式节点探索)
          </p>
          {aiNodes && (
            <div className="mt-6 flex items-center justify-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400 text-sm font-mono">
                  AI Generated · {aiNodes.length} nodes detected
                </span>
              </div>
              <button
                onClick={handleResetPathway}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 rounded-full transition-colors"
              >
                Reset to Default
              </button>
            </div>
          )}
        </div>

        <div className="relative">
          <ThreeScene
            nodes={activeNodes}
            onNodeClick={setSelectedNode}
            edges={activeEdges}
          />
        </div>
      </section>

      <NodePanel
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
      />

      <PaperAnalyzer onPathwayGenerated={handlePathwayGenerated} />

      <SemanticSearch />
      <ContactFlow />
      <DevModePanel />

      <footer className="py-8 text-center text-zinc-500 text-sm border-t border-zinc-900">
        <p>© {new Date().getFullYear()} Nexus-Bio. All rights reserved.</p>
        <p className="mt-2 font-mono text-xs">Built for Zero-Cost Deployment</p>
      </footer>
    </main>
  );
}
