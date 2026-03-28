'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, ExternalLink, ChevronDown, ChevronUp, X } from 'lucide-react';

const PLDDT_LEVELS = [
  { color: '#0053D6', label: 'Very high', range: '>90', desc: 'Confident — accurately modelled' },
  { color: '#65CBF3', label: 'High', range: '70–90', desc: 'Generally accurate backbone' },
  { color: '#FFDB13', label: 'Medium', range: '50–70', desc: 'Flexible region' },
  { color: '#FF7D45', label: 'Low', range: '<50', desc: 'Intrinsically disordered' },
];

const PATHWAY_ENZYMES = [
  {
    id: 'CYP71AV1',
    name: 'CYP71AV1',
    fullName: 'Cytochrome P450 71AV1',
    organism: 'Artemisia annua',
    pdbId: '3CLA',
    alphafoldId: 'Q8LKJ5',
    role: 'Catalyzes 3-step oxidation of amorphadiene → artemisinic acid. Rate-limiting enzyme in artemisinin biosynthesis.',
    activeResidue: 'Heme Fe²⁺ — coordinates substrate for sequential oxidation',
    pathway: 'Artemisinin',
  },
  {
    id: 'ADS',
    name: 'ADS',
    fullName: 'Amorphadiene Synthase',
    organism: 'Artemisia annua',
    pdbId: '2ON5',
    alphafoldId: 'Q9MB61',
    role: 'Cyclizes FPP → amorphadiene. First committed step toward artemisinin.',
    activeResidue: 'Mg²⁺ trinuclear cluster — coordinates pyrophosphate departure',
    pathway: 'Artemisinin',
  },
  {
    id: 'HMGR',
    name: 'tHMGR',
    fullName: 'HMG-CoA Reductase (truncated)',
    organism: 'S. cerevisiae (engineered)',
    pdbId: '1DQA',
    alphafoldId: 'P12683',
    role: 'Rate-limiting enzyme of mevalonate pathway. Overexpression boosts isoprenoid flux 5×.',
    activeResidue: 'Ser-Asp-His catalytic triad',
    pathway: 'Mevalonate',
  },
];

const RESIDUE_TYPE_INFO: Record<string, { color: string; role: string }> = {
  ALA: { color: '#C8C8C8', role: 'Alanine — hydrophobic core' },
  ARG: { color: '#145AFF', role: 'Arginine — positively charged, salt bridges' },
  ASN: { color: '#00DCDC', role: 'Asparagine — H-bond donor/acceptor' },
  ASP: { color: '#E60A0A', role: 'Aspartate — negatively charged, catalysis' },
  CYS: { color: '#E6E600', role: 'Cysteine — disulfide bonds, metal coordination' },
  GLN: { color: '#00DCDC', role: 'Glutamine — H-bond donor/acceptor' },
  GLU: { color: '#E60A0A', role: 'Glutamate — negatively charged, proton transfer' },
  GLY: { color: '#EBEBEB', role: 'Glycine — flexible hinge, no side chain' },
  HIS: { color: '#8282D2', role: 'Histidine — pH sensor, metal coordination' },
  ILE: { color: '#0F820F', role: 'Isoleucine — hydrophobic core stability' },
  LEU: { color: '#0F820F', role: 'Leucine — hydrophobic core stability' },
  LYS: { color: '#145AFF', role: 'Lysine — positively charged, substrate binding' },
  MET: { color: '#E6E600', role: 'Methionine — hydrophobic, start codon' },
  PHE: { color: '#3232AA', role: 'Phenylalanine — aromatic stacking, hydrophobic' },
  PRO: { color: '#DC9682', role: 'Proline — rigid turn, secondary structure breaker' },
  SER: { color: '#FA9600', role: 'Serine — H-bond, phosphorylation site' },
  THR: { color: '#FA9600', role: 'Threonine — H-bond, phosphorylation site' },
  TRP: { color: '#B45AB4', role: 'Tryptophan — aromatic fluorescence probe' },
  TYR: { color: '#3232AA', role: 'Tyrosine — aromatic, phosphorylation' },
  VAL: { color: '#0F820F', role: 'Valine — hydrophobic β-sheet' },
};

declare global { interface Window { $3Dmol: any; } }

const THREEDMOL_CDNS = [
  'https://cdnjs.cloudflare.com/ajax/libs/3Dmol/2.5.3/3Dmol-min.js',
  'https://3Dmol.org/build/3Dmol-min.js',
];

function load3Dmol(): Promise<void> {
  if (window.$3Dmol) return Promise.resolve();

  return THREEDMOL_CDNS.reduce<Promise<void>>(
    (chain, url) =>
      chain.catch(
        () =>
          new Promise<void>((resolve, reject) => {
            const s = document.createElement('script');
            s.src = url;
            s.onload = () => (window.$3Dmol ? resolve() : reject(new Error('3Dmol not defined')));
            s.onerror = () => reject(new Error(`Failed to load ${url}`));
            document.head.appendChild(s);
          }),
      ),
    Promise.reject<void>(),
  );
}

interface AtomTooltip {
  resn: string;
  resi: number;
  atom: string;
  chain: string;
  elem: string;
  b: number;
  x: number;
  y: number;
}

interface ProteinCanvasProps {
  pdbId: string;
  alphafoldId?: string;
  name: string;
  useAlphaFold: boolean;
}

function ProteinCanvas({ pdbId, alphafoldId, name, useAlphaFold }: ProteinCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [tooltip, setTooltip] = useState<AtomTooltip | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const getPLDDTColor = (b: number) => {
    if (b >= 90) return '#0053D6';
    if (b >= 70) return '#65CBF3';
    if (b >= 50) return '#FFDB13';
    return '#FF7D45';
  };

  // Hex numbers for 3Dmol colorfunc (more compatible across versions)
  const getPLDDTHex = (b: number) => {
    if (b >= 90) return 0x0053D6;
    if (b >= 70) return 0x65CBF3;
    if (b >= 50) return 0xFFDB13;
    return 0xFF7D45;
  };

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!containerRef.current) return;
      setStatus('loading');
      setTooltip(null);

      try {
        await load3Dmol();
        if (cancelled) return;

        // Clear old viewer
        if (viewerRef.current) {
          try { viewerRef.current.clear(); } catch {}
        }
        containerRef.current.innerHTML = '';

        const viewer = window.$3Dmol.createViewer(containerRef.current, {
          backgroundColor: 'white', // WHITE background
          antialias: true,
        });
        viewerRef.current = viewer;

        if (useAlphaFold && alphafoldId) {
          // Fetch PDB data via backend proxy, then add to viewer
          try {
            const proxyRes = await fetch(`/api/alphafold?id=${alphafoldId}`);
            if (!proxyRes.ok) throw new Error('AlphaFold proxy failed');
            const pdbData = await proxyRes.text();
            if (!pdbData || pdbData.length < 100) throw new Error('Empty PDB data');
            viewer.addModel(pdbData, 'pdb');
            // pLDDT via B-factor
            viewer.setStyle({}, {
              cartoon: {
                colorfunc: (atom: any) => getPLDDTHex(atom.b),
                thickness: 0.5,
              }
            });
          } catch (afErr) {
            // Fallback to RCSB PDB
            console.warn('AlphaFold failed, falling back to RCSB:', afErr);
            await new Promise<void>((resolve, reject) => {
              const timer = setTimeout(() => reject(new Error('Timeout')), 15000);
              window.$3Dmol.download(`pdb:${pdbId}`, viewer, {}, () => { clearTimeout(timer); resolve(); });
            });
            viewer.setStyle({}, { cartoon: { color: 'spectrum', thickness: 0.5 } });
          }
        } else {
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Timeout')), 15000);
            window.$3Dmol.download(`pdb:${pdbId}`, viewer, {}, () => { clearTimeout(timer); resolve(); });
          });
          viewer.setStyle({}, {
            cartoon: { color: 'spectrum', thickness: 0.5 }
          });
          // DO NOT render HET atoms as spheres — ruins visual clarity
        }

        // ── Hover — enzyme residues only, no HET atoms ──
        viewer.setHoverable(
          { hetflag: false }, // exclude all HET atoms (HEM, ligands etc)
          true,
          (atom: any, _viewer: any, event: any) => {
            if (!atom) return;
            const stdAA = ['ALA','ARG','ASN','ASP','CYS','GLN','GLU','GLY','HIS',
              'ILE','LEU','LYS','MET','PHE','PRO','SER','THR','TRP','TYR','VAL'];
            if (!stdAA.includes(atom.resn?.toUpperCase())) return;
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;
            setTooltipPos({ x: event.clientX - rect.left, y: event.clientY - rect.top });
            setTooltip({
              resn: atom.resn || '?',
              resi: atom.resi || 0,
              atom: atom.atom || '?',
              chain: atom.chain || 'A',
              elem: atom.elem || '?',
              b: atom.b || 0,
            } as AtomTooltip);
          },
          () => setTooltip(null)
        );

        viewer.zoomTo();
        viewer.spin('y', 0.5);
        viewer.render();

        if (!cancelled) setStatus('ready');
      } catch (err) {
        console.error(err);
        if (!cancelled) setStatus('error');
      }
    }

    init();
    return () => { cancelled = true; };
  }, [pdbId, alphafoldId, useAlphaFold]);

  const residueInfo = tooltip ? (RESIDUE_TYPE_INFO[tooltip.resn] || { color: '#888', role: `${tooltip.resn} residue` }) : null;

  return (
    <div style={{ position: 'relative', width: '100%', height: '360px' }}>
      {/* 3Dmol container — WHITE background */}
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', borderRadius: '14px', overflow: 'hidden', background: '#ffffff', border: '1px solid rgba(0,0,0,0.1)', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}
      />

      {/* Loading */}
      {status === 'loading' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', background: '#ffffff', borderRadius: '14px', pointerEvents: 'none' }}>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <Loader2 size={22} style={{ color: '#6495ED', animation: 'spin 1s linear infinite' }} />
          <span style={{ color: '#666', fontSize: '12px', fontFamily: 'monospace' }}>
            Loading {useAlphaFold ? 'AlphaFold' : 'RCSB PDB'} · {useAlphaFold ? alphafoldId : pdbId}
          </span>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#ffffff', borderRadius: '14px' }}>
          <span style={{ color: '#cc4444', fontSize: '12px', fontFamily: 'monospace' }}>Structure unavailable</span>
          <a href={`https://www.rcsb.org/structure/${pdbId}`} target="_blank" rel="noopener noreferrer" style={{ color: '#6495ED', fontSize: '11px' }}>
            Open in RCSB →
          </a>
        </div>
      )}

      {/* Atom hover tooltip */}
      {tooltip && residueInfo && (
        <div style={{
          position: 'absolute',
          left: Math.min(tooltipPos.x + 12, 260),
          top: Math.max(tooltipPos.y - 10, 0),
          zIndex: 50,
          pointerEvents: 'none',
          background: 'rgba(10,10,10,0.95)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '10px',
          padding: '10px 12px',
          width: '220px',
          backdropFilter: 'blur(12px)',
        }}>
          {/* Residue name + color */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: residueInfo.color, flexShrink: 0 }} />
            <span style={{ color: '#ffffff', fontSize: '13px', fontWeight: 700, fontFamily: 'monospace' }}>
              {tooltip.resn} {tooltip.resi}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontFamily: 'monospace' }}>
              Chain {tooltip.chain}
            </span>
          </div>

          {/* Atom info */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
            <span style={{ padding: '2px 6px', background: 'rgba(255,255,255,0.07)', borderRadius: '4px', color: 'rgba(255,255,255,0.5)', fontSize: '10px', fontFamily: 'monospace' }}>
              Atom: {tooltip.atom}
            </span>
            <span style={{ padding: '2px 6px', background: 'rgba(255,255,255,0.07)', borderRadius: '4px', color: 'rgba(255,255,255,0.5)', fontSize: '10px', fontFamily: 'monospace' }}>
              Elem: {tooltip.elem}
            </span>
          </div>

          {/* Role description */}
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '11px', lineHeight: 1.5, margin: '0 0 8px' }}>
            {residueInfo.role}
          </p>

          {/* pLDDT bar */}
          {tooltip.b > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', fontFamily: 'monospace' }}>pLDDT</span>
                <span style={{ color: getPLDDTColor(tooltip.b), fontSize: '9px', fontFamily: 'monospace', fontWeight: 700 }}>
                  {tooltip.b.toFixed(1)}
                </span>
              </div>
              <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px' }}>
                <div style={{ width: `${Math.min(tooltip.b, 100)}%`, height: '100%', background: getPLDDTColor(tooltip.b), borderRadius: '2px', transition: 'width 0.2s' }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Labels when ready */}
      {status === 'ready' && (
        <>
          <div style={{ position: 'absolute', top: '10px', left: '10px', pointerEvents: 'none', display: 'flex', gap: '6px' }}>
            <div style={{ padding: '3px 8px', background: 'rgba(0,0,0,0.6)', borderRadius: '6px', backdropFilter: 'blur(8px)' }}>
              <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: '10px', fontFamily: 'monospace', fontWeight: 700 }}>
                {useAlphaFold ? `AF-${alphafoldId}` : pdbId}
              </span>
            </div>
            {useAlphaFold && (
              <div style={{ padding: '3px 8px', background: 'rgba(0,83,214,0.15)', border: '1px solid rgba(0,83,214,0.3)', borderRadius: '6px' }}>
                <span style={{ color: '#65CBF3', fontSize: '10px', fontFamily: 'monospace' }}>pLDDT coloring</span>
              </div>
            )}
          </div>

          {/* RCSB + AlphaFold links */}
          <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '6px' }}>
            <a href={`https://www.rcsb.org/structure/${pdbId}`}
              target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', background: 'rgba(0,0,0,0.55)', borderRadius: '6px', color: 'rgba(255,255,255,0.5)', fontSize: '10px', fontFamily: 'monospace', textDecoration: 'none', backdropFilter: 'blur(8px)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ffffff'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'; }}>
              RCSB PDB <ExternalLink size={8} />
            </a>
            {alphafoldId && (
              <a href={`https://alphafold.ebi.ac.uk/entry/${alphafoldId}`}
                target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', background: 'rgba(0,0,0,0.55)', borderRadius: '6px', color: 'rgba(255,255,255,0.5)', fontSize: '10px', fontFamily: 'monospace', textDecoration: 'none', backdropFilter: 'blur(8px)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ffffff'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'; }}>
                AlphaFold DB <ExternalLink size={8} />
              </a>
            )}
          </div>

          <div style={{ position: 'absolute', bottom: '10px', right: '10px', pointerEvents: 'none' }}>
            <span style={{ color: 'rgba(0,0,0,0.3)', fontSize: '10px', fontFamily: 'monospace', background: 'rgba(255,255,255,0.7)', padding: '2px 6px', borderRadius: '4px' }}>
              Hover residues for data · Drag to rotate
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function getPLDDTColor(b: number) {
  if (b >= 90) return '#0053D6';
  if (b >= 70) return '#65CBF3';
  if (b >= 50) return '#FFDB13';
  return '#FF7D45';
}

export default function PDBExplorer() {
  const [activeEnzyme, setActiveEnzyme] = useState(PATHWAY_ENZYMES[0]);
  const [useAlphaFold, setUseAlphaFold] = useState(false);
  const [customPDB, setCustomPDB] = useState('');
  const [customActive, setCustomActive] = useState(false);
  const [showLegend, setShowLegend] = useState(true);

  return (
    <section className="px-4 py-24" id="structure" style={{ background: '#0a0a0a' }}>
      <div className="max-w-5xl mx-auto">

        <div className="mb-10">
          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
            05 · Structure
          </p>
          <h2 className="text-2xl md:text-3xl font-semibold text-white mb-2" style={{ letterSpacing: '-0.02em' }}>
            Enzyme Structure Explorer
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '14px' }}>
            Real 3D structures from{' '}
            <span style={{ color: '#6495ED', fontFamily: 'monospace' }}>RCSB PDB</span>
            {' '}·{' '}
            <span style={{ color: '#65CBF3', fontFamily: 'monospace' }}>AlphaFold DB</span>
            {' '}· Hover any atom for biochemical data
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">

          {/* Left controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Artemisinin Pathway Enzymes
            </p>

            {PATHWAY_ENZYMES.map(enzyme => (
              <button key={enzyme.id}
                onClick={() => { setActiveEnzyme(enzyme); setCustomActive(false); }}
                style={{
                  padding: '11px 13px', borderRadius: '11px', textAlign: 'left', cursor: 'pointer',
                  background: activeEnzyme.id === enzyme.id && !customActive ? 'rgba(100,149,237,0.08)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${activeEnzyme.id === enzyme.id && !customActive ? 'rgba(100,149,237,0.3)' : 'rgba(255,255,255,0.07)'}`,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (activeEnzyme.id !== enzyme.id || customActive) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)'; }}
                onMouseLeave={e => { if (activeEnzyme.id !== enzyme.id || customActive) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span style={{ color: '#6495ED', fontSize: '11px', fontFamily: 'monospace', fontWeight: 700 }}>{enzyme.name}</span>
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: 'monospace' }}>{enzyme.pdbId}</span>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 500, margin: '0 0 2px' }}>{enzyme.fullName}</p>
                <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', margin: 0, fontStyle: 'italic' }}>{enzyme.organism}</p>
              </button>
            ))}

            {/* Custom PDB */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
              <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '7px' }}>Custom PDB ID</p>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  value={customPDB}
                  onChange={e => setCustomPDB(e.target.value.toUpperCase().slice(0, 4))}
                  placeholder="e.g. 1TQN"
                  maxLength={4}
                  style={{ flex: 1, padding: '8px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#fff', fontSize: '13px', fontFamily: 'monospace', outline: 'none', letterSpacing: '0.08em' }}
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
                <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px', left: useAlphaFold ? '19px' : '3px', transition: 'left 0.2s' }} />
              </button>
            </div>

            {/* pLDDT Legend */}
            <div>
              <button
                onClick={() => setShowLegend(!showLegend)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontFamily: 'monospace' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'; }}>
                {showLegend ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                pLDDT Color Scale
              </button>
              {showLegend && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', marginTop: '6px' }}>
                  {PLDDT_LEVELS.map(l => (
                    <div key={l.color} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ width: '26px', height: '8px', borderRadius: '3px', background: l.color, flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '10px', fontFamily: 'monospace', margin: '0 0 1px' }}>{l.label} ({l.range})</p>
                        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', margin: 0 }}>{l.desc}</p>
                      </div>
                    </div>
                  ))}
                  <p style={{ color: 'rgba(255,255,255,0.12)', fontSize: '9px', fontFamily: 'monospace', margin: '4px 0 0', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px' }}>
                    Jumper et al., Nature 2021 · AlphaFold2 standard
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right — viewer + info */}
          <div className="md:col-span-2" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <ProteinCanvas
              pdbId={customActive ? customPDB : activeEnzyme.pdbId}
              alphafoldId={customActive ? undefined : activeEnzyme.alphafoldId}
              name={customActive ? customPDB : activeEnzyme.name}
              useAlphaFold={useAlphaFold && !customActive}
            />

            {!customActive && (
              <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <span style={{ padding: '2px 8px', background: 'rgba(100,149,237,0.1)', border: '1px solid rgba(100,149,237,0.2)', borderRadius: '6px', color: '#6495ED', fontSize: '10px', fontFamily: 'monospace' }}>
                    {activeEnzyme.pathway} Pathway
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', fontFamily: 'monospace' }}>{activeEnzyme.fullName}</span>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', lineHeight: 1.65, margin: '0 0 10px' }}>
                  {activeEnzyme.role}
                </p>
                <div style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: 'monospace' }}>ACTIVE SITE · </span>
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px' }}>{activeEnzyme.activeResidue}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
