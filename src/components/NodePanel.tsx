import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, FileText, Hash, Dna, ExternalLink, ChevronDown, ChevronUp, FlaskConical } from 'lucide-react';
import { PathwayNode } from '../types';

interface NodePanelProps {
  node: PathwayNode | null;
  onClose: () => void;
  allNodes?: PathwayNode[];
  aiSources?: string[];
}

// pLDDT color scale (AlphaFold style)
function getPLDDTColor(score: number): string {
  if (score >= 90) return '#0053D6'; // Very high — dark blue
  if (score >= 70) return '#65CBF3'; // High — light blue
  if (score >= 50) return '#FFDB13'; // Medium — yellow
  return '#FF7D45';                  // Low — orange
}

// PDB Viewer using iFrame from RCSB
function PDBViewer({ pdbId }: { pdbId: string }) {
  const [loading, setLoading] = useState(true);

  return (
    <div style={{ position: 'relative', width: '100%', height: '220px', borderRadius: '12px', overflow: 'hidden', background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.08)' }}>
      {loading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <div style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'rgba(255,255,255,0.5)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontFamily: 'monospace' }}>Loading {pdbId}...</span>
        </div>
      )}
      <iframe
        src={`https://www.rcsb.org/3d-view/${pdbId}`}
        style={{ width: '100%', height: '100%', border: 'none', opacity: loading ? 0 : 1, transition: 'opacity 0.3s' }}
        onLoad={() => setLoading(false)}
        title={`PDB Structure ${pdbId}`}
        sandbox="allow-scripts allow-same-origin"
      />
      <div style={{ position: 'absolute', bottom: '8px', right: '8px' }}>
        <a
          href={`https://www.rcsb.org/structure/${pdbId}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', background: 'rgba(0,0,0,0.7)', borderRadius: '6px', color: 'rgba(255,255,255,0.5)', fontSize: '10px', fontFamily: 'monospace', textDecoration: 'none' }}
        >
          RCSB PDB <ExternalLink size={9} />
        </a>
      </div>
    </div>
  );
}

// pLDDT confidence legend
function ConfidenceLegend() {
  const levels = [
    { color: '#0053D6', label: 'Very high (>90)', desc: 'Confident prediction' },
    { color: '#65CBF3', label: 'High (70–90)', desc: 'Generally accurate' },
    { color: '#FFDB13', label: 'Medium (50–70)', desc: 'Flexible regions' },
    { color: '#FF7D45', label: 'Low (<50)', desc: 'Disordered region' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {levels.map(l => (
        <div key={l.color} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: l.color, flexShrink: 0 }} />
          <div>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontFamily: 'monospace' }}>{l.label}</span>
            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', marginLeft: '6px' }}>{l.desc}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// Extract PDB ID from node data if available
function extractPDBId(node: PathwayNode): string | null {
  const pdbMatch = node.citation?.match(/PDB[:\s]+([A-Z0-9]{4})/i) ||
    node.summary?.match(/PDB[:\s]+([A-Z0-9]{4})/i);
  if (pdbMatch) return pdbMatch[1].toUpperCase();
  // Known PDB IDs for common metabolic enzymes
  const knownPDB: Record<string, string> = {
    'hmg_coa': '1DQA',
    'acetyl_coa': '1OAO',
    'fpp': '1FPS',
    'artemisinic_acid': '2ONH',
    'amorpha_4_11_diene': '2ONH',
  };
  return knownPDB[node.id] || null;
}

export default function NodePanel({ node, onClose, allNodes, aiSources }: NodePanelProps) {
  const [showPDB, setShowPDB] = useState(false);
  const [showCitations, setShowCitations] = useState(true);
  const pdbId = node ? extractPDBId(node) : null;

  const handleDownload = () => {
    if (!node) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(node, null, 2));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', `${node.id}_metadata.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <AnimatePresence>
        {node && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            />

            {/* Panel */}
            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="fixed top-0 right-0 h-full w-full sm:w-[420px] z-50 flex flex-col"
              style={{ background: '#0f0f0f', borderLeft: '1px solid rgba(255,255,255,0.08)' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: node.color, boxShadow: `0 0 8px ${node.color}80` }} />
                  <div>
                    <h2 className="text-white font-semibold text-sm">{node.label}</h2>
                    <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>{node.id}</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-lg transition-all"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fff'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                  <X size={15} />
                </button>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                  {/* Summary */}
                  <div>
                    <p className="text-xs font-mono uppercase tracking-widest mb-2"
                      style={{ color: 'rgba(255,255,255,0.2)' }}>Biological Role</p>
                    <p className="text-sm leading-relaxed"
                      style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.75 }}>
                      {node.summary}
                    </p>
                  </div>

                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

                  {/* ── Citation Panel (Explainability Dashboard) ── */}
                  <div>
                    <button
                      onClick={() => setShowCitations(!showCitations)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: showCitations ? '12px' : 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={13} style={{ color: '#6495ED' }} />
                        <span className="text-xs font-mono uppercase tracking-widest"
                          style={{ color: 'rgba(255,255,255,0.4)' }}>AI Decision Sources</span>
                      </div>
                      {showCitations
                        ? <ChevronUp size={13} style={{ color: 'rgba(255,255,255,0.2)' }} />
                        : <ChevronDown size={13} style={{ color: 'rgba(255,255,255,0.2)' }} />}
                    </button>

                    {showCitations && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* Primary citation */}
                        <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(100,149,237,0.06)', border: '1px solid rgba(100,149,237,0.15)' }}>
                          <div style={{ display: 'flex', items: 'center', gap: '6px', marginBottom: '6px' }}>
                            <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#6495ED', background: 'rgba(100,149,237,0.12)', padding: '2px 6px', borderRadius: '4px' }}>
                              PRIMARY SOURCE
                            </span>
                          </div>
                          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', lineHeight: 1.6, margin: 0 }}>
                            {node.citation}
                          </p>
                        </div>

                        {/* AI reasoning note */}
                        <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', fontFamily: 'monospace', margin: 0 }}>
                            ⓘ This node was identified by Gemini AI based on co-occurrence frequency and biochemical relationship patterns in the source literature.
                          </p>
                        </div>

                        {/* Additional sources if AI generated */}
                        {aiSources && aiSources.length > 0 && (
                          <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', fontFamily: 'monospace', marginBottom: '6px' }}>RELATED LITERATURE</p>
                            {aiSources.map((src, i) => (
                              <p key={i} style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', lineHeight: 1.5, margin: '2px 0' }}>· {src}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

                  {/* ── PDB Structure Viewer ── */}
                  <div>
                    <button
                      onClick={() => setShowPDB(!showPDB)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: showPDB ? '12px' : 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Dna size={13} style={{ color: 'rgba(255,255,255,0.4)' }} />
                        <span className="text-xs font-mono uppercase tracking-widest"
                          style={{ color: 'rgba(255,255,255,0.4)' }}>
                          3D Structure
                          {pdbId && <span style={{ color: 'rgba(255,255,255,0.2)', marginLeft: '6px' }}>· {pdbId}</span>}
                        </span>
                      </div>
                      {showPDB
                        ? <ChevronUp size={13} style={{ color: 'rgba(255,255,255,0.2)' }} />
                        : <ChevronDown size={13} style={{ color: 'rgba(255,255,255,0.2)' }} />}
                    </button>

                    {showPDB && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {pdbId ? (
                          <>
                            <PDBViewer pdbId={pdbId} />
                            {/* pLDDT Legend */}
                            <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                              <p className="text-xs font-mono uppercase tracking-widest mb-3"
                                style={{ color: 'rgba(255,255,255,0.2)' }}>pLDDT Confidence Scale</p>
                              <ConfidenceLegend />
                            </div>
                          </>
                        ) : (
                          <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)', textAlign: 'center' }}>
                            <FlaskConical size={20} style={{ color: 'rgba(255,255,255,0.15)', margin: '0 auto 8px' }} />
                            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px', margin: 0 }}>
                              No PDB structure linked for this node.
                            </p>
                            <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: '11px', fontFamily: 'monospace', marginTop: '4px' }}>
                              Add PDB ID to citation to enable 3D view.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

                  {/* Export */}
                  <div>
                    <p className="text-xs font-mono uppercase tracking-widest mb-3"
                      style={{ color: 'rgba(255,255,255,0.2)' }}>Export</p>
                    <button
                      onClick={handleDownload}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 16px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.07)', fontSize: '13px', cursor: 'pointer', transition: 'all 0.15s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.color = '#ffffff'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'; }}>
                      <Download size={13} />
                      Download Node JSON
                    </button>
                  </div>

                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
