import { useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, FileText, Hash, Link2, ChevronDown, ChevronUp, Atom, Activity, Thermometer, Loader2, ExternalLink } from 'lucide-react';
import { PathwayNode, PathwayEdge, NodeType, EdgeRelationshipType, SHOWCASE_PUBCHEM_CIDS } from '../types';
import MoleculeViewer from './MoleculeViewer';
import KineticPanel from './KineticPanel';
import ThermodynamicsPanel from './ThermodynamicsPanel';
import CellImageViewer from './CellImageViewer';

// ── AlphaFold IDs for showcase enzymes ────────────────────────────────
const ENZYME_ALPHAFOLD: Record<string, { afId: string; pdbId: string; name: string }> = {
  amorpha_4_11_diene: { afId: 'Q9AR04', pdbId: '2ON5', name: 'Amorphadiene Synthase' },
  artemisinic_acid:   { afId: 'Q8LKJ5', pdbId: '3CLA', name: 'CYP71AV1' },
  fpp:                { afId: 'P08836', pdbId: '1FPS', name: 'FPP Synthase' },
  hmg_coa:            { afId: 'P12683', pdbId: '1DQA', name: 'HMGR' },
};

// ── RCSB PDB structures for nucleic acids & bio macromolecules ─────────
// These are canonical reference structures, not molecule-specific
const RCSB_STRUCTURES: Record<string, { pdbId: string; name: string; description: string }> = {
  // DNA
  dna:                  { pdbId: '1BNA', name: 'B-DNA Double Helix', description: 'Canonical B-form DNA, Drew & Dickerson 1981' },
  'double-stranded dna':{ pdbId: '1BNA', name: 'B-DNA Double Helix', description: 'Canonical B-form DNA' },
  'double stranded dna':{ pdbId: '1BNA', name: 'B-DNA Double Helix', description: 'Canonical B-form DNA' },
  dsdna:                { pdbId: '1BNA', name: 'B-DNA Double Helix', description: 'Canonical B-form DNA' },
  'b-dna':              { pdbId: '1BNA', name: 'B-DNA', description: 'B-form DNA double helix' },
  'a-dna':              { pdbId: '1ANA', name: 'A-DNA', description: 'A-form DNA double helix' },
  'z-dna':              { pdbId: '1DCG', name: 'Z-DNA', description: 'Z-form DNA double helix' },
  // RNA
  rna:                  { pdbId: '1EHZ', name: 'tRNA (Phe)', description: 'Transfer RNA phenylalanine, classic L-shaped structure' },
  trna:                 { pdbId: '1EHZ', name: 'tRNA', description: 'Transfer RNA canonical structure' },
  mrna:                 { pdbId: '6XRZ', name: 'mRNA', description: 'Messenger RNA structure' },
  'ribosomal rna':      { pdbId: '4V9F', name: 'Ribosomal RNA', description: '23S/16S rRNA in ribosome' },
  rrna:                 { pdbId: '4V9F', name: 'Ribosomal RNA', description: 'Ribosomal RNA' },
  // Proteins / complexes
  ribosome:             { pdbId: '4V9F', name: 'Ribosome (70S)', description: 'E. coli 70S ribosome full structure' },
  'atp synthase':       { pdbId: '5ARA', name: 'ATP Synthase', description: 'Mitochondrial ATP synthase complex' },
  'dna polymerase':     { pdbId: '1TAU', name: 'DNA Polymerase I', description: 'E. coli DNA Polymerase I' },
  'rna polymerase':     { pdbId: '1I6H', name: 'RNA Polymerase', description: 'RNA Polymerase II core' },
  collagen:             { pdbId: '1CGD', name: 'Collagen Triple Helix', description: 'Collagen triple helix structure' },
  hemoglobin:           { pdbId: '2HHB', name: 'Hemoglobin', description: 'Human deoxyhemoglobin' },
  myosin:               { pdbId: '2MYS', name: 'Myosin', description: 'Skeletal muscle myosin' },
  actin:                { pdbId: '1ATN', name: 'Actin', description: 'Beta-actin monomer' },
  tubulin:              { pdbId: '1TUB', name: 'Tubulin', description: 'Alpha/beta tubulin dimer' },
  insulin:              { pdbId: '3I40', name: 'Insulin', description: 'Human insulin structure' },
  lysozyme:             { pdbId: '1LYZ', name: 'Lysozyme', description: 'Hen egg white lysozyme' },
  antibody:             { pdbId: '1IGT', name: 'IgG Antibody', description: 'Intact immunoglobulin G' },
  // Nucleotides
  atp:                  { pdbId: '1S9I', name: 'ATP-bound structure', description: 'ATP in active site context' },
  // Chromatin
  nucleosome:           { pdbId: '1AOI', name: 'Nucleosome Core', description: 'Nucleosome core particle with histone octamer + DNA' },
  histone:              { pdbId: '1AOI', name: 'Histone Octamer', description: 'H2A/H2B/H3/H4 octamer in nucleosome' },
};

// ── Inline protein viewer using 3Dmol ─────────────────────────────────
// Lookup RCSB structure by node label (case-insensitive)
function lookupRCSB(label: string) {
  const key = label.toLowerCase().trim();
  return RCSB_STRUCTURES[key] ?? null;
}
declare global { interface Window { $3Dmol: any; } }

function load3Dmol(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.$3Dmol) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://3Dmol.org/build/3Dmol-min.js';
    s.onload = () => resolve();
    s.onerror = () => reject();
    document.head.appendChild(s);
  });
}

function ProteinViewer({ pdbId, alphafoldId, label }: { pdbId: string; alphafoldId?: string; label: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [useAF, setUseAF] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!containerRef.current) return;
      setStatus('loading');
      try {
        await load3Dmol();
        if (cancelled) return;
        if (viewerRef.current) { try { viewerRef.current.clear(); } catch {} }
        containerRef.current.innerHTML = '';

        const viewer = window.$3Dmol.createViewer(containerRef.current, {
          backgroundColor: 'white', antialias: true,
        });
        viewerRef.current = viewer;

        if (useAF && alphafoldId) {
          const res = await fetch(`/api/alphafold?id=${alphafoldId}`);
          if (!res.ok) throw new Error(`AlphaFold ${res.status}`);
          const pdb = await res.text();
          if (!pdb || pdb.length < 100) throw new Error('Empty AlphaFold response');
          viewer.addModel(pdb, 'pdb');
          viewer.setStyle({}, {
            cartoon: {
              colorfunc: (atom: any) => {
                const b = atom.b;
                if (b >= 90) return '#0053D6';
                if (b >= 70) return '#65CBF3';
                if (b >= 50) return '#FFDB13';
                return '#FF7D45';
              },
              thickness: 0.5,
            }
          });
        } else {
          await new Promise<void>((res, rej) => {
            window.$3Dmol.download(`pdb:${pdbId}`, viewer, {}, () => res());
            setTimeout(() => rej(), 15000);
          });
          viewer.setStyle({}, { cartoon: { color: 'spectrum', thickness: 0.5 } });
          viewer.setStyle({ hetflag: true }, { stick: { colorscheme: 'greenCarbon', radius: 0.15 } });
        }

        viewer.zoomTo();
        viewer.spin('y', 0.5);
        viewer.render();
        if (!cancelled) setStatus('ready');
      } catch (err) {
        // AlphaFold failed — fallback to RCSB PDB
        if (useAF && !cancelled) {
          try {
            if (viewerRef.current) { try { viewerRef.current.clear(); } catch {} }
            containerRef.current!.innerHTML = '';
            const viewer2 = window.$3Dmol.createViewer(containerRef.current!, {
              backgroundColor: 'white', antialias: true,
            });
            viewerRef.current = viewer2;
            await new Promise<void>((res, rej) => {
              window.$3Dmol.download(`pdb:${pdbId}`, viewer2, {}, () => res());
              setTimeout(() => rej(), 15000);
            });
            viewer2.setStyle({}, { cartoon: { color: 'spectrum', thickness: 0.5 } });
            viewer2.zoomTo();
            viewer2.spin('y', 0.5);
            viewer2.render();
            if (!cancelled) setStatus('ready');
          } catch {
            if (!cancelled) setStatus('error');
          }
        } else {
          if (!cancelled) setStatus('error');
        }
      }
    }
    init();
    return () => { cancelled = true; };
  }, [pdbId, alphafoldId, useAF]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ position: 'relative', width: '100%', height: '280px', borderRadius: '20px', overflow: 'hidden', background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 12px rgba(0,0,0,0.15)' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        {status === 'loading' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#ffffff', gap: '8px' }}>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <Loader2 size={18} style={{ color: '#6495ED', animation: 'spin 1s linear infinite' }} />
            <span style={{ color: 'rgba(0,0,0,0.35)', fontSize: '11px', fontFamily: "'Public Sans', sans-serif", fontFeatureSettings: "'tnum' 1" }}>
              Loading {useAF ? 'AlphaFold' : 'RCSB PDB'}...
            </span>
          </div>
        )}
        {status === 'error' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#ffffff', gap: '8px' }}>
            <span style={{ color: 'rgba(150,60,60,0.6)', fontSize: '12px' }}>Structure unavailable</span>
          </div>
        )}
        {status === 'ready' && (
          <>
            <div style={{ position: 'absolute', top: '8px', left: '10px', pointerEvents: 'none' }}>
              <span style={{ color: 'rgba(0,0,0,0.35)', fontSize: '9px', fontFamily: "'Public Sans', sans-serif", fontFeatureSettings: "'tnum' 1", background: 'rgba(255,255,255,0.8)', padding: '2px 6px', borderRadius: '4px' }}>
                {useAF ? `AF-${alphafoldId}` : pdbId}
              </span>
            </div>
            <div style={{ position: 'absolute', bottom: '8px', right: '10px' }}>
              <a href={useAF ? `https://alphafold.ebi.ac.uk/entry/${alphafoldId}` : `https://www.rcsb.org/structure/${pdbId}`}
                target="_blank" rel="noopener noreferrer"
                style={{ color: 'rgba(0,0,0,0.3)', fontSize: '9px', fontFamily: "'Public Sans', sans-serif", fontFeatureSettings: "'tnum' 1", display: 'flex', alignItems: 'center', gap: '3px', textDecoration: 'none', background: 'rgba(255,255,255,0.8)', padding: '2px 6px', borderRadius: '4px' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(0,0,0,0.7)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(0,0,0,0.3)'; }}>
                {useAF ? 'AlphaFold DB' : 'RCSB PDB'} <ExternalLink size={8} />
              </a>
            </div>
          </>
        )}
      </div>

      {/* AlphaFold toggle */}
      {alphafoldId && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', fontWeight: 500, margin: '0 0 2px' }}>AlphaFold pLDDT</p>
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: "'Public Sans', sans-serif", fontFeatureSettings: "'tnum' 1", margin: 0 }}>AI confidence coloring</p>
          </div>
          <button onClick={() => setUseAF(!useAF)}
            style={{ width: '34px', height: '18px', borderRadius: '9px', background: useAF ? '#A8C5DA' : 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px', left: useAF ? '19px' : '3px', transition: 'left 0.2s' }} />
          </button>
        </div>
      )}

      {/* pLDDT legend when AF is on */}
      {useAF && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[{ c: '#0053D6', l: '>90' }, { c: '#65CBF3', l: '70–90' }, { c: '#FFDB13', l: '50–70' }, { c: '#FF7D45', l: '<50' }].map(x => (
            <div key={x.l} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '10px', height: '4px', borderRadius: '2px', background: x.c }} />
              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', fontFamily: "'Public Sans', sans-serif", fontFeatureSettings: "'tnum' 1" }}>{x.l}</span>
            </div>
          ))}
        </div>
      )}

      <p style={{ color: 'rgba(255,255,255,0.1)', fontSize: '9px', fontFamily: "'Public Sans', sans-serif", fontFeatureSettings: "'tnum' 1", margin: 0, textAlign: 'center' }}>
        Hover to inspect · Drag to rotate · {useAF ? 'AlphaFold DB' : 'RCSB PDB'}
      </p>
    </div>
  );
}

interface NodePanelProps {
  node: PathwayNode | null;
  onClose: () => void;
  allNodes?: PathwayNode[];
  allEdges?: PathwayEdge[];
}

const NODE_TYPE_LABELS: Record<NodeType, string> = {
  metabolite: 'Metabolite', enzyme: 'Enzyme', gene: 'Gene',
  complex: 'Protein Complex', cofactor: 'Cofactor', unknown: 'Unknown',
};
const EDGE_TYPE_LABELS: Record<EdgeRelationshipType, string> = {
  catalyzes: 'catalyzes', produces: 'produces', consumes: 'consumes',
  activates: 'activates', inhibits: 'inhibits', converts: 'converts',
  transports: 'transports', regulates: 'regulates', unknown: 'connects to',
};

function ConfidenceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = score >= 0.8 ? '#C8E0D0' : score >= 0.6 ? '#E8DCC8' : '#E8C8D4';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
        <span style={{ fontFamily: "'Public Sans',sans-serif", fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.22)' }}>
          AI Confidence
        </span>
        <span style={{ fontFamily: "'Public Sans',sans-serif", fontSize: '13px', color, fontWeight: 700, fontFeatureSettings: "'tnum' 1" }}>{pct}%</span>
      </div>
      <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width 0.5s cubic-bezier(0.22,1,0.36,1)' }} />
      </div>
    </div>
  );
}

function PLDDTHistogram({ nodes }: { nodes?: PathwayNode[] }) {
  if (!nodes?.length) return null;
  const scores = nodes.map(n => Math.round((n.confidenceScore ?? 0.75) * 100));
  const bins = [
    { label: '<50',   color: '#E8C8D4', count: scores.filter(s => s < 50).length },
    { label: '50–70', color: '#E8DCC8', count: scores.filter(s => s >= 50 && s < 70).length },
    { label: '70–90', color: '#C8E0D0', count: scores.filter(s => s >= 70 && s < 90).length },
    { label: '>90',   color: '#C8D8E8', count: scores.filter(s => s >= 90).length },
  ];
  const maxCount = Math.max(...bins.map(b => b.count), 1);
  return (
    <div style={{ padding: '14px 16px', borderRadius: '20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <p style={{ fontFamily: "'Public Sans',sans-serif", fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.22)', margin: '0 0 12px' }}>
        pLDDT Distribution
      </p>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '56px' }}>
        {bins.map(b => (
          <div key={b.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
            <div style={{
              width: '100%',
              height: `${Math.max((b.count / maxCount) * 40, b.count > 0 ? 4 : 0)}px`,
              background: b.color, borderRadius: '4px 4px 0 0', opacity: 0.75,
              transition: 'height 0.5s cubic-bezier(0.22,1,0.36,1)',
            }} />
            <span style={{ fontFamily: "'Public Sans',sans-serif", fontSize: '9px', color: 'rgba(255,255,255,0.2)', fontFeatureSettings: "'tnum' 1", fontWeight: 600 }}>{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return <p style={{ fontFamily: "'Public Sans',sans-serif", fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.22)', margin: '0 0 8px' }}>{label}</p>;
}
function Divider() { return <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} />; }

type TabId = 'overview' | 'structure' | 'analysis';

export default function NodePanel({ node, onClose, allNodes, allEdges }: NodePanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [showConnections, setShowConnections] = useState(false);

  const connections = useMemo(() => {
    if (!node || !allEdges) return [];
    return allEdges.filter(e => e.start === node.id || e.end === node.id);
  }, [node, allEdges]);

  const handleDownload = () => {
    if (!node) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(node, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${node.id}_node.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  const pubchemCID = node?.pubchemCID ?? (node?.id ? SHOWCASE_PUBCHEM_CIDS[node.id] : undefined);
  const isEnzyme = node?.nodeType === 'enzyme' || node?.nodeType === 'complex';
  const isMetabolite = !isEnzyme && node?.nodeType !== 'gene';

  // Tab definitions — context-aware
  const tabs = [
    { id: 'overview' as TabId, label: 'Overview', icon: <FileText size={12} /> },
    { id: 'structure' as TabId, label: 'Structure', icon: <Atom size={12} /> },
    {
      id: 'analysis' as TabId,
      label: isEnzyme ? 'Kinetics' : 'Thermodynamics',
      icon: isEnzyme ? <Activity size={12} /> : <Thermometer size={12} />,
    },
  ];

  return (
    <AnimatePresence>
      {node && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', zIndex: 40 }}
          />
          <motion.div
            initial={{ x: '100%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            style={{
              position: 'fixed', top: 0, right: 0, height: '100%', width: '100%', maxWidth: '440px',
              zIndex: 50, display: 'flex', flexDirection: 'column',
              background: 'rgba(10,13,20,0.82)',
              backdropFilter: 'blur(28px)',
              WebkitBackdropFilter: 'blur(28px)',
              borderLeft: '1px solid rgba(255,255,255,0.09)',
              fontFamily: "'Public Sans', -apple-system, sans-serif",
              boxShadow: '-24px 0 80px rgba(0,0,0,0.4)',
            }}
          >
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0, background: node.color, boxShadow: `0 0 8px ${node.color}50` }} />
                  <div style={{ minWidth: 0 }}>
                    <h2 style={{ color: '#ffffff', fontSize: '14px', fontWeight: 600, margin: 0, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {node.label}
                    </h2>
                    {node.canonicalLabel && node.canonicalLabel !== node.label && (
                      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', margin: '2px 0 0', fontStyle: 'italic' }}>{node.canonicalLabel}</p>
                    )}
                  </div>
                </div>
                <button onClick={onClose}
                  style={{ color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', flexShrink: 0, display: 'flex' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ffffff'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'; }}>
                  <X size={15} />
                </button>
              </div>

              {/* Tab bar */}
              <div style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding: '3px' }}>
                {tabs.map(tab => (
                  <button key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                      padding: '6px 8px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                      background: activeTab === tab.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                      color: activeTab === tab.id ? '#ffffff' : 'rgba(255,255,255,0.3)',
                      fontSize: '11px', fontWeight: activeTab === tab.id ? 600 : 400,
                      fontFamily: 'inherit', transition: 'all 0.15s',
                    }}>
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* ── TAB 1: OVERVIEW ── */}
              {activeTab === 'overview' && (
                <>
                  {/* ID + Node Type */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '20px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <Hash size={10} style={{ color: 'rgba(255,255,255,0.2)' }} />
                      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontFamily: "'Public Sans', sans-serif", fontFeatureSettings: "'tnum' 1" }}>{node.id}</span>
                    </div>
                    {node.nodeType && node.nodeType !== 'unknown' && (
                      <div style={{ padding: '3px 8px', borderRadius: '20px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px', fontFamily: "'Public Sans', sans-serif", fontFeatureSettings: "'tnum' 1", textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {NODE_TYPE_LABELS[node.nodeType]}
                        </span>
                      </div>
                    )}
                  </div>

                  {node.confidenceScore !== undefined && <ConfidenceBar score={node.confidenceScore} />}

                  {/* pLDDT Histogram — shows distribution across all pathway nodes */}
                  {allNodes && allNodes.length > 1 && <PLDDTHistogram nodes={allNodes} />}

                  <Divider />

                  {/* Biological Role */}
                  <div>
                    <SectionLabel label="Biological Role" />
                    <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '13px', lineHeight: 1.75, margin: 0, letterSpacing: '-0.005em' }}>
                      {node.summary}
                    </p>
                  </div>

                  {/* Evidence Trace */}
                  {(node.evidenceSnippet || node.citation) && (
                    <>
                      <Divider />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <SectionLabel label="Evidence Trace" />
                          <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: '9px', fontFamily: "'Public Sans', sans-serif", fontFeatureSettings: "'tnum' 1", marginBottom: '8px' }}>
                            AI · grounded in source
                          </span>
                        </div>
                        {node.evidenceSnippet && (
                          <div style={{ padding: '12px 14px', borderRadius: '20px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderLeft: '3px solid rgba(255,255,255,0.18)', position: 'relative' }}>
                            <span style={{ position: 'absolute', top: '8px', left: '14px', color: 'rgba(255,255,255,0.12)', fontSize: '28px', fontFamily: 'Georgia,serif', lineHeight: 1, userSelect: 'none' }}>"</span>
                            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', lineHeight: 1.7, margin: '12px 0 0', fontStyle: 'italic', letterSpacing: '-0.005em' }}>
                              {node.evidenceSnippet}
                            </p>
                          </div>
                        )}
                        {node.citation && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <FileText size={11} style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
                            <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: '11px', lineHeight: 1.5, margin: 0, fontFamily: "'Public Sans', sans-serif", fontFeatureSettings: "'tnum' 1", letterSpacing: '0.01em' }}>{node.citation}</p>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Connections — Progressive Disclosure */}
                  {connections.length > 0 && allNodes && (
                    <>
                      <Divider />
                      <div>
                        <button onClick={() => setShowConnections(!showConnections)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px' }}>
                          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: "'Public Sans', sans-serif", fontFeatureSettings: "'tnum' 1", textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Connections ({connections.length})
                          </span>
                          {showConnections ? <ChevronUp size={12} style={{ color: 'rgba(255,255,255,0.2)' }} /> : <ChevronDown size={12} style={{ color: 'rgba(255,255,255,0.2)' }} />}
                        </button>
                        {showConnections && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {connections.map((edge, i) => {
                              const isSource = edge.start === node.id;
                              const otherId = isSource ? edge.end : edge.start;
                              const otherNode = allNodes.find(n => n.id === otherId);
                              const relType = edge.relationshipType || 'unknown';
                              return (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                  <Link2 size={11} style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
                                  <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', fontFamily: "'Public Sans', sans-serif", fontFeatureSettings: "'tnum' 1" }}>{isSource ? '→' : '←'}</span>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', margin: '0 0 1px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {otherNode?.label || otherId}
                                    </p>
                                    <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: "'Public Sans', sans-serif", fontFeatureSettings: "'tnum' 1", margin: 0 }}>
                                      {isSource ? `this ${EDGE_TYPE_LABELS[relType]} →` : `← ${EDGE_TYPE_LABELS[relType]} this`}
                                    </p>
                                  </div>
                                  {edge.confidenceScore !== undefined && (
                                    <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: "'Public Sans', sans-serif", fontFeatureSettings: "'tnum' 1", flexShrink: 0 }}>{Math.round(edge.confidenceScore * 100)}%</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* External IDs */}
                  {(node.ecNumber || node.chebiId || node.uniprotId || pubchemCID) && (
                    <>
                      <Divider />
                      <div>
                        <SectionLabel label="External Identifiers" />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {pubchemCID && (
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', fontFamily: "'Public Sans', sans-serif", fontFeatureSettings: "'tnum' 1", width: '64px', flexShrink: 0 }}>PubChem</span>
                              <a href={`https://pubchem.ncbi.nlm.nih.gov/compound/${pubchemCID}`} target="_blank" rel="noopener noreferrer" style={{ color: '#A8C5DA', fontSize: '11px', fontFamily: "'Public Sans', sans-serif", fontFeatureSettings: "'tnum' 1", textDecoration: 'none' }}>CID {pubchemCID}</a>
                            </div>
                          )}
                          {node.ecNumber && (
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', fontFamily: "'Public Sans', sans-serif", fontFeatureSettings: "'tnum' 1", width: '64px', flexShrink: 0 }}>EC</span>
                              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontFamily: "'Public Sans', sans-serif", fontFeatureSettings: "'tnum' 1" }}>{node.ecNumber}</span>
                            </div>
                          )}
                          {node.uniprotId && (
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', fontFamily: "'Public Sans', sans-serif", fontFeatureSettings: "'tnum' 1", width: '64px', flexShrink: 0 }}>UniProt</span>
                              <a href={`https://www.uniprot.org/uniprotkb/${node.uniprotId}`} target="_blank" rel="noopener noreferrer" style={{ color: '#A8C5DA', fontSize: '11px', fontFamily: "'Public Sans', sans-serif", fontFeatureSettings: "'tnum' 1", textDecoration: 'none' }}>{node.uniprotId}</a>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  <Divider />
                  <button onClick={handleDownload}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 16px', borderRadius: '20px', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.07)', fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.color = '#ffffff'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)'; }}>
                    <Download size={13} /> Download node JSON
                  </button>
                </>
              )}

              {/* ── TAB 2: STRUCTURE ── */}
              {activeTab === 'structure' && (() => {
                const rcsbMatch = lookupRCSB(node.label);
                return (
                  <>
                    {ENZYME_ALPHAFOLD[node.id] ? (
                      // Enzyme → AlphaFold / RCSB rotating protein
                      <div>
                        <SectionLabel label="Protein Structure" />
                        <ProteinViewer
                          pdbId={ENZYME_ALPHAFOLD[node.id].pdbId}
                          alphafoldId={ENZYME_ALPHAFOLD[node.id].afId}
                          label={ENZYME_ALPHAFOLD[node.id].name}
                        />
                      </div>
                    ) : rcsbMatch ? (
                      // Nucleic acid / macromolecule → RCSB canonical structure
                      <div>
                        <SectionLabel label="Reference Structure" />
                        <div style={{ padding: '8px 12px', borderRadius: '16px', background: 'rgba(200,216,232,0.06)', border: '1px solid rgba(200,216,232,0.12)', marginBottom: '10px' }}>
                          <p style={{ color: 'rgba(200,216,232,0.7)', fontSize: '11px', margin: '0 0 2px', fontWeight: 500 }}>{rcsbMatch.name}</p>
                          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', margin: 0 }}>{rcsbMatch.description}</p>
                        </div>
                        <ProteinViewer
                          pdbId={rcsbMatch.pdbId}
                          label={rcsbMatch.name}
                        />
                      </div>
                    ) : (() => {
                      // Determine if this node is a molecular entity or a biological entity
                      const BIOLOGICAL_ENTITY_KEYWORDS = [
                        'cell','cells','tissue','tissues','organism','bacteria','virus','fungi','fungus',
                        'microorganism','microbe','plant','animal','yeast','algae','protozoa','parasite',
                        'embryo','organ','blood','muscle','nerve','neuron','bone','skin','liver','kidney',
                        'heart','lung','brain','sperm','egg','gamete','chromosome','nucleus','ribosome',
                        'mitochondria','chloroplast','vacuole','membrane','wall','flagella','cilia',
                      ];
                      const labelLower = (node.canonicalLabel || node.label).toLowerCase();
                      const isBiologicalEntity = BIOLOGICAL_ENTITY_KEYWORDS.some(k => labelLower.includes(k))
                        || node.nodeType === 'unknown'
                        || (!node.nodeType && !pubchemCID);

                      if (!isBiologicalEntity || pubchemCID) {
                        // Molecular entity → try PubChem
                        return (
                          <div>
                            <SectionLabel label="3D Molecular Structure" />
                            <MoleculeViewer
                              nodeId={node.id}
                              pubchemCID={pubchemCID}
                              searchName={!pubchemCID ? (node.canonicalLabel || node.label) : undefined}
                              label={node.canonicalLabel || node.label}
                              height={260}
                            />
                            <p style={{ color: 'rgba(255,255,255,0.12)', fontSize: '9px', fontFamily: "'Public Sans', sans-serif", fontFeatureSettings: "'tnum' 1", marginTop: '6px' }}>
                              3D conformer · CPK coloring · Source: PubChem
                            </p>
                          </div>
                        );
                      }

                      // Biological entity → microscopy images
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ padding: '8px 12px', borderRadius: '16px', background: 'rgba(200,224,208,0.04)', border: '1px solid rgba(200,224,208,0.1)' }}>
                            <p style={{ color: 'rgba(200,224,208,0.6)', fontSize: '11px', margin: '0 0 2px', fontWeight: 500 }}>
                              Biological Entity — Microscopy View
                            </p>
                            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', margin: 0, lineHeight: 1.5 }}>
                              This node exists at a scale beyond molecular visualization.
                              Showing reference microscopy images instead.
                            </p>
                          </div>
                          <CellImageViewer searchTerm={node.canonicalLabel || node.label} height={260} />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: '9px', fontFamily: "'Public Sans', sans-serif", fontFeatureSettings: "'tnum' 1", textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                              Search more databases:
                            </p>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {[
                                { label: 'Cell Image Library', url: `https://cellimagelibrary.org/images/search?simple_search=${encodeURIComponent(node.label)}` },
                                { label: 'UniProt', url: `https://www.uniprot.org/uniprotkb?query=${encodeURIComponent(node.label)}` },
                                { label: 'RCSB PDB', url: `https://www.rcsb.org/search?request=${encodeURIComponent(JSON.stringify({ query: { type: 'terminal', service: 'full_text', parameters: { value: node.label } } }))}` },
                              ].map(db => (
                                <a key={db.label} href={db.url} target="_blank" rel="noopener noreferrer"
                                  style={{ padding: '4px 10px', borderRadius: '20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.35)', fontSize: '10px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)'; }}>
                                  {db.label} <ExternalLink size={8} />
                                </a>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                );
              })()}

              {/* ── TAB 3: ANALYSIS ── */}
              {activeTab === 'analysis' && (
                <>
                  {isEnzyme ? (
                    <KineticPanel nodeLabel={node.label} nodeId={node.id} />
                  ) : (
                    <ThermodynamicsPanel nodeLabel={node.label} nodeId={node.id} />
                  )}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
