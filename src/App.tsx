import { useState } from 'react';
import Hero from './components/Hero';
import ThreeScene from './ThreeScene';
import NodePanel from './components/NodePanel';
import SemanticSearch from './components/SemanticSearch';
import ContactFlow from './components/ContactFlow';
import DevModePanel from './components/DevModePanel';
import pathwayData from './data/pathwayData.json';
import { PathwayNode } from './types';

export default function App() {
  const [selectedNode, setSelectedNode] = useState<PathwayNode | null>(null);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-emerald-500/30">
      <Hero />
      
      <section className="py-24 px-4 max-w-6xl mx-auto" id="demo">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Metabolic Pathway Simulation</h2>
          <p className="text-zinc-400 font-mono text-sm uppercase tracking-widest">
            Interactive Node Exploration (交互式节点探索)
          </p>
        </div>
        
        <div className="relative">
          <ThreeScene 
            nodes={pathwayData as PathwayNode[]} 
            onNodeClick={setSelectedNode} 
          />
        </div>
      </section>

      <NodePanel 
        node={selectedNode} 
        onClose={() => setSelectedNode(null)} 
      />

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
