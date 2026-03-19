import { useEffect, useRef, useState } from 'react';
import { Loader2, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

// pLDDT color scale matching AlphaFold standard
const PLDDT_LEVELS = [
  { color: '#0053D6', label: 'Very high', range: '>90', desc: 'Confident — accurately modelled' },
  { color: '#65CBF3', label: 'High', range: '70–90', desc: 'Generally accurate backbone' },
  { color: '#FFDB13', label: 'Medium', range: '50–70', desc: 'Flexible or uncertain region' },
  { color: '#FF7D45', label: 'Low', range: '<50', desc: 'Intrinsically disordered' },
];

// Artemisinin pathway enzymes with AlphaFold IDs
const PATHWAY_ENZYMES = [
  {
    id: 'CYP71AV1',
    name: 'CYP71AV1',
    fullName: 'Cytochrome P450 71AV1',
    organism: 'Artemisia annua',
    pdbId: '2ONH',
    alphafoldId: 'Q8LKJ5',
    role: 'Catalyzes 3-step oxidation of amorphadiene → artemisinic acid. Key bottleneck enzyme.',
    pathway: 'Artemisinin',
    activeResidue: 'Heme Fe — coordinates substrate for oxidation',
  },
  {
    id: 'ADS',
    name: 'ADS',
    fullName: 'Amorphadiene Synthase',
    organism: 'Artemisia annua',
    pdbId: '2ONH',
    alphafoldId: 'Q9MB61',
    role: 'Cyclizes FPP into amorphadiene. First committed step toward artemisinin.',
    pathway: 'Artemisinin',
    activeResidue: 'Mg²⁺ trinuclear cluster — coordinates pyrophosphate departure',
  },
  {
    id: 'HMGR',
    name: 'tHMGR',
    fullName: 'HMG-CoA Reductase (truncated)',
    organism: 'S. cerevisiae (engineered)',
    pdbId: '1DQA',
    alphafoldId: 'P12683',
    role: 'Rate-limiting enzyme of mevalonate pathway. Overexpression boosts isoprenoid flux 5×.',
    pathway: 'Mevalonate',
    activeResidue: 'Ser-Asp-His catalytic triad',
  },
];

declare global {
  interface Window { $3Dmol: any; }
}

function load3Dmol(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.$3Dmol) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://3Dmol.org/build/3Dmol-min.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load 3Dmol.js'));
    document.head.appendChild(script);
  });
}

interface ProteinViewerProps {
  pdbId: string;
  alphafoldId?: string;
  name: string;
  useAlphaFold?: boolean;
}

function ProteinCanvas({ pdbId, alphafoldId, name, useAlphaFold }: ProteinViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [useAF, setUseAF] = useState(useAlphaFold ?? false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!containerRef.current) return;
      setStatus('loading');

      try {
        await load3Dmol();

        if (cancelled) return;

        // Clear previous viewer
        if (viewerRef.current) {
          viewerRef.current.clear();
        }

        const viewer = window.$3Dmol.createViewer(containerRef.current, {
          backgroundColor: '0x0d0d0d',
          antialias: true,
          id: `viewer-${pdbId}-${Date.now()}`,
        });

        viewerRef.current = viewer;

        if (useAF && alphafoldId) {
          // Load from AlphaFold DB — B-factor column = pLDDT
          const afUrl = `https://alphafold.ebi.ac.uk/files/AF-${alphafoldId}-F1-model_v4.pdb`;
          const res = await fetch(afUrl);
          if (!res.ok) throw new Error('AlphaFold structure not found');
          const pdbData = await res.text();

          viewer.addModel(pdbData, 'pdb');

          // pLDDT color scheme using B-factor column
          viewer.setStyle({}, {
            cartoon: {
              colorfunc: (atom: any) => {
                const b = atom.b; // B-factor = pLDDT in AlphaFold PDB
                if (b >= 90) return '#0053D6';
                if (b >= 70) return '#65CBF3';
                if (b >= 50) return '#FFDB13';
                return '#FF7D45';
              },
              thickness: 0.4,
            }
          });

        } else {
          // Load from RCSB PDB
          await new Promise<void>((res, rej) => {
            window.$3Dmol.download(`pdb:${pdbId}`, viewer, {}, () => res());
            setTimeout(() => rej(new Error('Timeout')), 15000);
          });

          // Cartoon ribbon — secondary structure visible
          viewer.setStyle({}, {
            cartoon: {
              color: 'spectrum',
              thickness: 0.4,
            }
          });

          // Highlight active site residues (HET atoms = ligands/cofactors)
          viewer.setStyle({ hetflag: true }, {
            stick: { colorscheme: 'greenCarbon', radius: 0.15 },
            sphere: { colorscheme: 'greenCarbon', radius: 0.35 },
          });
        }

        viewer.zoomTo();
        viewer.spin('y', 0.5);
        viewer.render();

        if (!cancelled) setStatus('ready');
      } catch (err) {
        console.error('3Dmol error:', err);
        if (!cancelled) setStatus('error');
      }
    }

    init();
    return () => { cancelled = true; };
  }, [pdbId, alphafoldId, useAF]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '340px' }}>
      {/* 3Dmol container */}
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', borderRadius: '12px', overflow: 'hidden', background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.08)' }}
      />

      {/* Loading overlay */}
      {status === 'loading' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', pointerEvents: 'none' }}>
          <Loader2 size={20} style={{ color: '#6495ED', animation: 'spin 1s linear infinite' }} />
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontFamily: 'monospace' }}>
            Loading {useAF ? 'AlphaFold' : 'RCSB PDB'} structure...
          </span>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <span style={{ color: 'rgba(255,100,100,0.7)', fontSize: '12px', fontFamily: 'monospace' }}>Failed to load structure</span>
          <a href={`https://www.rcsb.org/structure/${pdbId}`} target="_blank" rel="noopener noreferrer"
            style={{ color: '#6495ED', fontSize: '11px', fontFamily: 'monospace' }}>
            Open in RCSB →
          </a>
        </div>
      )}

      {/* Top labels */}
      {status === 'ready' && (
        <>
          <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', gap: '6px', pointerEvents: 'none' }}>
            <div style={{ padding: '3px 8px', background: 'rgba(0,0,0,0.75)', borderRadius: '6px', backdropFilter: 'blur(8px)' }}>
              <span style={{ color: '#6495ED', fontSize: '10px', fontFamily: 'monospace', fontWeight: 700 }}>
                {useAF ? `AF-${alphafoldId}` : pdbId}
              </span>
            </div>
            {useAF && (
              <div style={{ padding: '3px 8px', background: 'rgba(0,83,214,0.2)', borderRadius: '6px', border: '1px solid rgba(0,83,214,0.3)' }}>
                <span style={{ color: '#65CBF3', fontSize: '10px', fontFamily: 'monospace' }}>pLDDT colored</span>
              </div>
            )}
          </div>
          <div style={{ position: 'absolute', bottom: '10px', right: '10px' }}>
            <a href={useAF ? `https://alphafold.ebi.ac.uk/entry/${alphafoldId}` : `https://www.rcsb.org/structure/${pdbId}`}
              target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', background: 'rgba(0,0,0,0.75)', borderRadius: '6px', color: 'rgba(255,255,255,0.35)', fontSize: '10px', fontFamily: 'monospace', textDecoration: 'none', backdropFilter: 'blur(8px)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ffffff'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)'; }}>
              {useAF ? 'AlphaFold DB' : 'RCSB PDB'} <ExternalLink size={8} />
            </a>
          </div>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function PDBExplorer() {
  const [activeEnzyme, setActiveEnzyme] = useState(PATHWAY_ENZYMES[0]);
  const [useAlphaFold, setUseAlphaFold] = useState(false);
  const [customPDB, setCustomPDB] = useState('');
  const [customActive, setCustomActive] = useState(false);
  const [showLegend, setShowLegend] = useState(false);

  return (
    <section className="px-4 py-24" id="structure" style={{ background: '#0a0a0a' }}>
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-10">
          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
            05 · Structure
          </p>
          <h2 className="text-2xl md:text-3xl font-semibold text-white mb-2" style={{ letterSpacing: '-0.02em' }}>
            Enzyme Structure Explorer
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '14px' }}>
            Real 3D protein structures from{' '}
            <span style={{ color: '#6495ED', fontFamily: 'monospace' }}>RCSB PDB</span>
            {' '}·{' '}
            <span style={{ color: '#65CBF3', fontFamily: 'monospace' }}>AlphaFold DB</span>
            {' '}· Ribbon diagram with secondary structure
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">

          {/* Left — enzyme selector + controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* Enzyme cards */}
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Artemisinin Pathway Enzymes
            </p>
            {PATHWAY_ENZYMES.map(enzyme => (
              <button
                key={enzyme.id}
                onClick={() => { setActiveEnzyme(enzyme); setCustomActive(false); }}
                style={{
                  padding: '12px 14px', borderRadius: '12px', textAlign: 'left', cursor: 'pointer',
                  background: activeEnzyme.id === enzyme.id && !customActive ? 'rgba(100,149,237,0.08)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${activeEnzyme.id === enzyme.id && !customActive ? 'rgba(100,149,237,0.25)' : 'rgba(255,255,255,0.07)'}`,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (activeEnzyme.id !== enzyme.id || customActive) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)'; }}
                onMouseLeave={e => { if (activeEnzyme.id !== enzyme.id || customActive) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ color: '#6495ED', fontSize: '11px', fontFamily: 'monospace', fontWeight: 700 }}>{enzyme.name}</span>
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: 'monospace' }}>{enzyme.pdbId}</span>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontWeight: 500, margin: '0 0 3px' }}>{enzyme.fullName}</p>
                <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', margin: 0, fontStyle: 'italic' }}>{enzyme.organism}</p>
              </button>
            ))}

            {/* Custom PDB input */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
              <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                Custom PDB ID
              </p>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  value={customPDB}
                  onChange={e => setCustomPDB(e.target.value.toUpperCase().slice(0, 4))}
                  placeholder="e.g. 1TQN"
                  maxLength={4}
                  style={{ flex: 1, padding: '8px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#fff', fontSize: '13px', fontFamily: 'monospace', outline: 'none', letterSpacing: '0.05em' }}
                />
                <button
                  onClick={() => { if (customPDB.length === 4) setCustomActive(true); }}
                  disabled={customPDB.length !== 4}
                  style={{ padding: '8px 12px', background: customPDB.length === 4 ? '#ffffff' : 'rgba(255,255,255,0.05)', color: customPDB.length === 4 ? '#0a0a0a' : 'rgba(255,255,255,0.2)', borderRadius: '8px', border: 'none', fontSize: '12px', fontWeight: 600, cursor: customPDB.length === 4 ? 'pointer' : 'not-allowed', transition: 'all 0.15s' }}>
                  Load
                </button>
              </div>
            </div>

            {/* AlphaFold toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 500, margin: '0 0 2px' }}>AlphaFold pLDDT</p>
                <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', fontFamily: 'monospace', margin: 0 }}>Confidence color coding</p>
              </div>
              <button
                onClick={() => setUseAlphaFold(!useAlphaFold)}
                style={{ width: '36px', height: '20px', borderRadius: '10px', background: useAlphaFold ? '#6495ED' : 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
                <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#ffffff', position: 'absolute', top: '3px', left: useAlphaFold ? '19px' : '3px', transition: 'left 0.2s' }} />
              </button>
            </div>

            {/* pLDDT Legend */}
            {useAlphaFold && (
              <div>
                <button
                  onClick={() => setShowLegend(!showLegend)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontFamily: 'monospace' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'; }}>
                  {showLegend ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  pLDDT Color Legend
                </button>
                {showLegend && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {PLDDT_LEVELS.map(l => (
                      <div key={l.color} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '24px', height: '6px', borderRadius: '3px', background: l.color, flexShrink: 0 }} />
                        <div>
                          <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '10px', fontFamily: 'monospace' }}>{l.label} ({l.range})</span>
                          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', marginLeft: '4px' }}>{l.desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right — viewer + info */}
          <div className="md:col-span-2" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <ProteinCanvas
              pdbId={customActive ? customPDB : activeEnzyme.pdbId}
              alphafoldId={customActive ? undefined : activeEnzyme.alphafoldId}
              name={customActive ? customPDB : activeEnzyme.name}
              useAlphaFold={useAlphaFold && !customActive && !!activeEnzyme.alphafoldId}
            />

            {/* Enzyme info card */}
            {!customActive && (
              <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <span style={{ padding: '2px 8px', background: 'rgba(100,149,237,0.1)', border: '1px solid rgba(100,149,237,0.2)', borderRadius: '6px', color: '#6495ED', fontSize: '10px', fontFamily: 'monospace' }}>
                    {activeEnzyme.pathway} Pathway
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', fontFamily: 'monospace' }}>{activeEnzyme.fullName}</span>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', lineHeight: 1.65, margin: '0 0 10px' }}>
                  {activeEnzyme.role}
                </p>
                <div style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: 'monospace' }}>ACTIVE SITE · </span>
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px' }}>{activeEnzyme.activeResidue}</span>
                </div>
              </div>
            )}

            <p style={{ color: 'rgba(255,255,255,0.12)', fontSize: '10px', fontFamily: 'monospace', textAlign: 'center' }}>
              Drag to rotate · Scroll to zoom · Powered by 3Dmol.js + RCSB PDB
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
