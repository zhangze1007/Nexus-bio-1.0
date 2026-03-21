import { useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, FileText, Hash, Link2, ChevronDown, ChevronUp, Atom, Activity, Thermometer, Loader2, ExternalLink } from 'lucide-react';
import { PathwayNode, PathwayEdge, NodeType, EdgeRelationshipType, SHOWCASE_PUBCHEM_CIDS } from '../types';
import MoleculeViewer from './MoleculeViewer';
import KineticPanel from './KineticPanel';
import ThermodynamicsPanel from './ThermodynamicsPanel';

// ── AlphaFold IDs for showcase enzymes ────────────────────────────────
const ENZYME_ALPHAFOLD: Record<string, { afId: string; pdbId: string; name: string }> = {
  amorpha_4_11_diene: { afId: 'Q9MB61', pdbId: '2ON5', name: 'Amorphadiene Synthase' },
  artemisinic_acid:   { afId: 'Q8LKJ5', pdbId: '3CLA', name: 'CYP71AV1' },
  fpp:                { afId: 'P08836', pdbId: '1FPS', name: 'FPP Synthase' },
  hmg_coa:            { afId: 'P12683', pdbId: '1DQA', name: 'HMGR' },
};

// ── Inline protein viewer using 3Dmol ─────────────────────────────────
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
          if (!res.ok) throw new Error('AlphaFold unavailable');
          const pdb = await res.text();
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
      } catch {
        if (!cancelled) setStatus('error');
      }
    }
    init();
    return () => { cancelled = true; };
  }, [pdbId, alphafoldId, useAF]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ position: 'relative', width: '100%', height: '280px', borderRadius: '10px', overflow: 'hidden', background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 12px rgba(0,0,0,0.15)' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        {status === 'loading' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#ffffff', gap: '8px' }}>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <Loader2 size={18} style={{ color: '#6495ED', animation: 'spin 1s linear infinite' }} />
            <span style={{ color: 'rgba(0,0,0,0.35)', fontSize: '11px', fontFamily: 'monospace' }}>
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
              <span style={{ color: 'rgba(0,0,0,0.35)', fontSize: '9px', fontFamily: 'monospace', background: 'rgba(255,255,255,0.8)', padding: '2px 6px', borderRadius: '4px' }}>
                {useAF ? `AF-${alphafoldId}` : pdbId}
              </span>
            </div>
            <div style={{ position: 'absolute', bottom: '8px', right: '10px' }}>
              <a href={useAF ? `https://alphafold.ebi.ac.uk/entry/${alphafoldId}` : `https://www.rcsb.org/structure/${pdbId}`}
                target="_blank" rel="noopener noreferrer"
                style={{ color: 'rgba(0,0,0,0.3)', fontSize: '9px', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '3px', textDecoration: 'none', background: 'rgba(255,255,255,0.8)', padding: '2px 6px', borderRadius: '4px' }}
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', fontWeight: 500, margin: '0 0 2px' }}>AlphaFold pLDDT</p>
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: 'monospace', margin: 0 }}>AI confidence coloring</p>
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
              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', fontFamily: 'monospace' }}>{x.l}</span>
            </div>
          ))}
        </div>
      )}

      <p style={{ color: 'rgba(255,255,255,0.1)', fontSize: '9px', fontFamily: 'monospace', margin: 0, textAlign: 'center' }}>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.06em' }}>AI Confidence</span>
        <span style={{ color, fontSize: '10px', fontFamily: 'monospace', fontWeight: 700 }}>{pct}%</span>
      </div>
      <div style={{ height: '3px', background: 'rgba(255,255,255,0.07)', borderRadius: '2px' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>{label}</p>;
}
function Divider() { return <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />; }

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
              background: 'linear-gradient(180deg,#111318 0%,#0f1114 100%)',
              borderLeft: '1px solid rgba(255,255,255,0.07)',
              fontFamily: "'Inter',-apple-system,sans-serif",
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
              <div style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '3px' }}>
                {tabs.map(tab => (
                  <button key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                      padding: '6px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer',
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <Hash size={10} style={{ color: 'rgba(255,255,255,0.2)' }} />
                      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontFamily: 'monospace' }}>{node.id}</span>
                    </div>
                    {node.nodeType && node.nodeType !== 'unknown' && (
                      <div style={{ padding: '3px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {NODE_TYPE_LABELS[node.nodeType]}
                        </span>
                      </div>
                    )}
                  </div>

                  {node.confidenceScore !== undefined && <ConfidenceBar score={node.confidenceScore} />}

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
                          <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: '9px', fontFamily: 'monospace', marginBottom: '8px' }}>
                            AI · grounded in source
                          </span>
                        </div>
                        {node.evidenceSnippet && (
                          <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderLeft: '3px solid rgba(255,255,255,0.18)', position: 'relative' }}>
                            <span style={{ position: 'absolute', top: '8px', left: '14px', color: 'rgba(255,255,255,0.12)', fontSize: '28px', fontFamily: 'Georgia,serif', lineHeight: 1, userSelect: 'none' }}>"</span>
                            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', lineHeight: 1.7, margin: '12px 0 0', fontStyle: 'italic', letterSpacing: '-0.005em' }}>
                              {node.evidenceSnippet}
                            </p>
                          </div>
                        )}
                        {node.citation && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <FileText size={11} style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
                            <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: '11px', lineHeight: 1.5, margin: 0, fontFamily: 'monospace', letterSpacing: '0.01em' }}>{node.citation}</p>
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
                          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
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
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                  <Link2 size={11} style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
                                  <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', fontFamily: 'monospace' }}>{isSource ? '→' : '←'}</span>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', margin: '0 0 1px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {otherNode?.label || otherId}
                                    </p>
                                    <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: 'monospace', margin: 0 }}>
                                      {isSource ? `this ${EDGE_TYPE_LABELS[relType]} →` : `← ${EDGE_TYPE_LABELS[relType]} this`}
                                    </p>
                                  </div>
                                  {edge.confidenceScore !== undefined && (
                                    <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: 'monospace', flexShrink: 0 }}>{Math.round(edge.confidenceScore * 100)}%</span>
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
                              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', fontFamily: 'monospace', width: '64px', flexShrink: 0 }}>PubChem</span>
                              <a href={`https://pubchem.ncbi.nlm.nih.gov/compound/${pubchemCID}`} target="_blank" rel="noopener noreferrer" style={{ color: '#A8C5DA', fontSize: '11px', fontFamily: 'monospace', textDecoration: 'none' }}>CID {pubchemCID}</a>
                            </div>
                          )}
                          {node.ecNumber && (
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', fontFamily: 'monospace', width: '64px', flexShrink: 0 }}>EC</span>
                              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontFamily: 'monospace' }}>{node.ecNumber}</span>
                            </div>
                          )}
                          {node.uniprotId && (
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', fontFamily: 'monospace', width: '64px', flexShrink: 0 }}>UniProt</span>
                              <a href={`https://www.uniprot.org/uniprotkb/${node.uniprotId}`} target="_blank" rel="noopener noreferrer" style={{ color: '#A8C5DA', fontSize: '11px', fontFamily: 'monospace', textDecoration: 'none' }}>{node.uniprotId}</a>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  <Divider />
                  <button onClick={handleDownload}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 16px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.07)', fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.color = '#ffffff'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)'; }}>
                    <Download size={13} /> Download node JSON
                  </button>
                </>
              )}

              {/* ── TAB 2: STRUCTURE ── */}
              {activeTab === 'structure' && (
                <>
                  {ENZYME_ALPHAFOLD[node.id] ? (
                    // Has AlphaFold data → rotating protein structure
                    <div>
                      <SectionLabel label="Protein Structure" />
                      <ProteinViewer
                        pdbId={ENZYME_ALPHAFOLD[node.id].pdbId}
                        alphafoldId={ENZYME_ALPHAFOLD[node.id].afId}
                        label={ENZYME_ALPHAFOLD[node.id].name}
                      />
                    </div>
                  ) : pubchemCID ? (
                    // Has PubChem CID → small molecule 3D
                    <div>
                      <SectionLabel label="3D Molecular Structure" />
                      <MoleculeViewer
                        nodeId={node.id}
                        pubchemCID={pubchemCID}
                        label={node.canonicalLabel || node.label}
                        height={260}
                      />
                      <p style={{ color: 'rgba(255,255,255,0.12)', fontSize: '9px', fontFamily: 'monospace', marginTop: '6px' }}>
                        3D conformer · CPK coloring · Source: PubChem
                      </p>
                    </div>
                  ) : (
                    <div style={{ padding: '20px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                        <Atom size={18} style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: 500, margin: 0 }}>
                          3D structure not available for this node
                        </p>
                      </div>
                      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', lineHeight: 1.7, margin: '0 0 14px' }}>
                        Nexus-Bio renders 3D structures for <strong style={{ color: 'rgba(255,255,255,0.5)' }}>molecular entities</strong> only — 
                        such as metabolites, enzymes, and proteins. This node represents a 
                        biological entity (e.g. a cell, tissue, organism, or physiological process) 
                        that exists at a scale beyond molecular visualization.
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>
                          For structural data, try:
                        </p>
                        {[
                          { label: 'UniProt', desc: 'Protein sequences & structures', url: `https://www.uniprot.org/uniprotkb?query=${encodeURIComponent(node.label)}` },
                          { label: 'PubChem', desc: 'Small molecule compounds', url: `https://pubchem.ncbi.nlm.nih.gov/#query=${encodeURIComponent(node.label)}` },
                          { label: 'RCSB PDB', desc: 'Experimental 3D structures', url: `https://www.rcsb.org/search?request=${encodeURIComponent(JSON.stringify({ query: { type: 'terminal', service: 'full_text', parameters: { value: node.label } } }))}` },
                        ].map(db => (
                          <a key={db.label} href={db.url} target="_blank" rel="noopener noreferrer"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', textDecoration: 'none', transition: 'border-color 0.15s' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'; }}>
                            <div>
                              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 500, margin: '0 0 2px' }}>{db.label}</p>
                              <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', margin: 0 }}>{db.desc}</p>
                            </div>
                            <ExternalLink size={12} style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

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
