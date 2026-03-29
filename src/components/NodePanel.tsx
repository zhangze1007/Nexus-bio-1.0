'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// 注入了 ShieldAlert 用于合规面板
import { X, Download, FileText, Hash, Link2, ChevronDown, ChevronUp, Atom, Activity, Thermometer, Loader2, ExternalLink, ShieldAlert, AlertTriangle, CheckCircle, Circle, Scissors, ArrowUp } from 'lucide-react';
import { PathwayNode, PathwayEdge, NodeType, EdgeRelationshipType, SHOWCASE_PUBCHEM_CIDS } from '../types';
import { BIO_THEME_COLORS } from './ThreeScene';
import MoleculeViewer from './MoleculeViewer';
import KineticPanel from './KineticPanel';
import ThermodynamicsPanel from './ThermodynamicsPanel';
import CellImageViewer from './CellImageViewer';

// ── Compliance thresholds ─────────────────────────────────────────────
const HIGH_RISK_THRESHOLD = 0.7;
const MODERATE_RISK_THRESHOLD = 0.3;
const UI_SANS = "'Inter', 'Helvetica Neue', 'Public Sans', -apple-system, sans-serif";
const UI_MONO = "'JetBrains Mono', 'Fira Code', 'SFMono-Regular', ui-monospace, monospace";

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
                if (b >= 90) return 0x0053D6;
                if (b >= 70) return 0x65CBF3;
                if (b >= 50) return 0xFFDB13;
                return 0xFF7D45;
              },
              thickness: 0.5,
            }
          });
        } else {
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('PDB download timeout')), 15000);
            window.$3Dmol.download(`pdb:${pdbId}`, viewer, {}, () => { clearTimeout(timer); resolve(); });
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
            await new Promise<void>((resolve, reject) => {
              const timer = setTimeout(() => reject(new Error('PDB download timeout')), 15000);
              window.$3Dmol.download(`pdb:${pdbId}`, viewer2, {}, () => { clearTimeout(timer); resolve(); });
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
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#ffffff', gap: '12px', overflow: 'hidden' }}>
            <style>{`
              @keyframes dissolve-float {
                0%   { transform: translate(var(--tx), 40px) scale(0); opacity: 0; }
                20%  { opacity: 0.7; }
                80%  { opacity: 0.5; }
                100% { transform: translate(var(--tx), -40px) scale(0.3); opacity: 0; }
              }
              @keyframes dissolve-converge {
                0%   { transform: translate(var(--tx2), var(--ty2)) scale(1.2); opacity: 0; }
                30%  { opacity: 0.8; }
                100% { transform: translate(0, 0) scale(1); opacity: 1; }
              }
              .dissolve-dot {
                position: absolute;
                width: 4px; height: 4px;
                border-radius: 50%;
                animation: dissolve-float 2.2s ease-in-out infinite;
              }
              .converge-dot {
                position: absolute;
                width: 3px; height: 3px;
                border-radius: 50%;
                animation: dissolve-converge 1.8s cubic-bezier(0.22,1,0.36,1) infinite;
              }
            `}</style>

            {/* Floating particles — scatter phase */}
            {Array.from({ length: 18 }).map((_, i) => {
              const angle = (i / 18) * 360;
              const r = 30 + (i % 4) * 12;
              const tx = Math.cos(angle * Math.PI / 180) * r;
              const color = ['#0053D6','#65CBF3','#FFDB13','#4A90D9'][i % 4];
              return (
                <div key={i} className="dissolve-dot" style={{
                  left: '50%', top: '50%', marginLeft: '-2px', marginTop: '-2px',
                  background: color, opacity: 0.6,
                  '--tx': `${tx}px`,
                  animationDelay: `${(i / 18) * 2.2}s`,
                  animationDuration: `${1.8 + (i % 3) * 0.4}s`,
                } as any} />
              );
            })}

            {/* Center convergence ring */}
            <div style={{ position: 'relative', width: '48px', height: '48px' }}>
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: '1.5px solid rgba(0,83,214,0.25)',
                animation: 'spin 3s linear infinite',
              }} />
              <div style={{
                position: 'absolute', inset: '6px', borderRadius: '50%',
                border: '1px solid rgba(101,203,243,0.35)',
                animation: 'spin 2s linear infinite reverse',
              }} />
              <div style={{
                position: 'absolute', inset: '14px', borderRadius: '50%',
                background: 'rgba(0,83,214,0.12)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
            </div>

            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'rgba(0,0,0,0.5)', fontSize: '11px', fontFamily: "'Inter', -apple-system, sans-serif", fontWeight: 600, margin: '0 0 3px' }}>
                {useAF ? 'Predicting structure' : 'Loading structure'}
              </p>
              <p style={{ color: 'rgba(0,0,0,0.25)', fontSize: '10px', fontFamily: "'Inter', -apple-system, sans-serif", margin: 0, fontFeatureSettings: "'tnum' 1" }}>
                {useAF ? `AlphaFold · ${alphafoldId}` : `RCSB PDB · ${pdbId}`}
              </p>
            </div>
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
              <span style={{ color: 'rgba(0,0,0,0.35)', fontSize: '9px', fontFamily: "'Inter', -apple-system, sans-serif", fontFeatureSettings: "'tnum' 1", background: 'rgba(255,255,255,0.8)', padding: '2px 6px', borderRadius: '8px' }}>
                {useAF ? `AF-${alphafoldId}` : pdbId}
              </span>
            </div>
            <div style={{ position: 'absolute', bottom: '8px', right: '10px' }}>
              <a href={useAF ? `https://alphafold.ebi.ac.uk/entry/${alphafoldId}` : `https://www.rcsb.org/structure/${pdbId}`}
                target="_blank" rel="noopener noreferrer"
                style={{ color: 'rgba(0,0,0,0.3)', fontSize: '9px', fontFamily: "'Inter', -apple-system, sans-serif", fontFeatureSettings: "'tnum' 1", display: 'flex', alignItems: 'center', gap: '3px', textDecoration: 'none', background: 'rgba(255,255,255,0.8)', padding: '2px 6px', borderRadius: '8px' }}
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
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: "'Inter', -apple-system, sans-serif", fontFeatureSettings: "'tnum' 1", margin: 0 }}>AI confidence coloring</p>
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
              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', fontFamily: "'Inter', -apple-system, sans-serif", fontFeatureSettings: "'tnum' 1" }}>{x.l}</span>
            </div>
          ))}
        </div>
      )}

      <p style={{ color: 'rgba(255,255,255,0.1)', fontSize: '9px', fontFamily: "'Inter', -apple-system, sans-serif", fontFeatureSettings: "'tnum' 1", margin: 0, textAlign: 'center' }}>
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

// ─── 修改点 1：补齐了缺失的标签，修复构建错误 ────────────────────────────
const NODE_TYPE_LABELS: Record<NodeType, string> = {
  metabolite: 'Metabolite', enzyme: 'Enzyme', gene: 'Gene',
  complex: 'Protein Complex', cofactor: 'Cofactor', unknown: 'Unknown',
  impurity: 'Potential Impurity', intermediate: 'Intermediate Specie'
};
const EDGE_TYPE_LABELS: Record<EdgeRelationshipType, string> = {
  catalyzes: 'catalyzes', produces: 'produces', consumes: 'consumes',
  activates: 'activates', inhibits: 'inhibits', converts: 'converts',
  transports: 'transports', regulates: 'regulates', unknown: 'connects to',
};

function ConfidenceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const opacity = score >= 0.8 ? 0.85 : score >= 0.6 ? 0.6 : 0.35;
  const color = `rgba(255,255,255,${opacity})`;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
        <span style={{ fontFamily: "'Inter', -apple-system, sans-serif", fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.22)' }}>
          AI Confidence
        </span>
        <span style={{ fontFamily: "'Inter', -apple-system, sans-serif", fontSize: '13px', color, fontWeight: 700, fontFeatureSettings: "'tnum' 1" }}>{pct}%</span>
      </div>
      <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width 0.5s cubic-bezier(0.22,1,0.36,1)' }} />
      </div>
    </div>
  );
}

function PLDDTHistogram({ nodes, currentNodeId }: { nodes?: PathwayNode[]; currentNodeId?: string }) {
  const BINS = 10; 

  const stats = useMemo(() => {
    if (!nodes?.length) return null;

    const scores = nodes
      .map(n => {
        if (n.confidenceScore !== undefined) return Math.round(n.confidenceScore * 100);
        const knownConf: Record<string, number> = {
          acetyl_coa: 85, hmg_coa: 72, mevalonate: 68,
          fpp: 91, amorpha_4_11_diene: 88,
          artemisinic_acid: 76, artemisinin: 93,
        };
        return knownConf[n.id] ?? null;
      })
      .filter((s): s is number => s !== null);

    if (!scores.length) return null;

    const binCounts = Array(BINS).fill(0);
    scores.forEach(s => {
      const binIdx = Math.min(Math.floor(s / 10), BINS - 1);
      binCounts[binIdx]++;
    });

    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const max  = Math.max(...binCounts);
    const n    = scores.length;

    const binColor = (idx: number): string => {
      const midpoint = idx * 10 + 5;
      if (midpoint < 50) return 'rgba(255,255,255,0.22)';
      if (midpoint < 70) return 'rgba(255,255,255,0.40)';
      if (midpoint < 90) return 'rgba(255,255,255,0.60)';
      return 'rgba(255,255,255,0.80)';
    };

    return { binCounts, mean, max, n, binColor };
  }, [nodes]);

  if (!stats) return null;

  const { binCounts, mean, max, n, binColor } = stats;
  const CHART_H = 72;
  const meanBinX = (mean / 100) * BINS;

  return (
    <div style={{ padding: '14px 16px', borderRadius: '20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <p style={{ fontFamily: "'Inter', -apple-system, sans-serif", fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.22)', margin: 0 }}>
          Confidence Distribution
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <span style={{ fontFamily: "'Inter', -apple-system, sans-serif", fontSize: '10px', color: 'rgba(255,255,255,0.2)', fontFeatureSettings: "'tnum' 1" }}>
            n = {n}
          </span>
          <span style={{ fontFamily: "'Inter', -apple-system, sans-serif", fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontFeatureSettings: "'tnum' 1", fontWeight: 600 }}>
            μ = {mean.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Chart area */}
      <div style={{ position: 'relative', height: `${CHART_H + 20}px` }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '18px' }}>
          {[max, Math.round(max/2), 0].map((v, i) => (
            <span key={i} style={{ fontFamily: "'Inter', -apple-system, sans-serif", fontSize: '8px', color: 'rgba(255,255,255,0.15)', fontFeatureSettings: "'tnum' 1", lineHeight: 1 }}>
              {v}
            </span>
          ))}
        </div>

        <div style={{ marginLeft: '22px', position: 'relative', height: `${CHART_H}px`, display: 'flex', alignItems: 'flex-end', gap: '2px' }}>
          <div style={{
            position: 'absolute',
            left: `${(meanBinX / BINS) * 100}%`,
            top: 0, bottom: 0, width: '1px',
            background: 'rgba(255,255,255,0.35)',
            zIndex: 10,
            pointerEvents: 'none',
          }}>
            <span style={{
              position: 'absolute', top: '-1px', left: '3px',
              fontFamily: "'Inter', -apple-system, sans-serif", fontSize: '8px',
              color: 'rgba(255,255,255,0.5)', fontFeatureSettings: "'tnum' 1",
              whiteSpace: 'nowrap',
            }}>μ</span>
          </div>

          {binCounts.map((count, i) => {
            const barH = max > 0 ? Math.max((count / max) * (CHART_H - 4), count > 0 ? 3 : 0) : 0;
            const isCurrentNode = currentNodeId && nodes?.find(n => n.id === currentNodeId)?.confidenceScore !== undefined
              && Math.floor((nodes.find(n => n.id === currentNodeId)!.confidenceScore! * 100) / 10) === i;

            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                <div style={{
                  width: '100%',
                  height: `${barH}px`,
                  background: binColor(i),
                  borderRadius: '3px 3px 0 0',
                  opacity: count > 0 ? (isCurrentNode ? 1.0 : 0.65) : 0.08,
                  transition: 'height 0.45s cubic-bezier(0.22,1,0.36,1), opacity 0.3s',
                  outline: isCurrentNode ? '1px solid rgba(255,255,255,0.35)' : 'none',
                }} />
              </div>
            );
          })}
        </div>

        <div style={{ marginLeft: '22px', display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
          {[0, 20, 40, 60, 80, 100].map(v => (
            <span key={v} style={{ fontFamily: "'Inter', -apple-system, sans-serif", fontSize: '8px', color: 'rgba(255,255,255,0.15)', fontFeatureSettings: "'tnum' 1" }}>
              {v}
            </span>
          ))}
        </div>
      </div>

      <p style={{ fontFamily: "'Inter', -apple-system, sans-serif", fontSize: '9px', color: 'rgba(255,255,255,0.12)', margin: '4px 0 0', textAlign: 'center' }}>
        Confidence Score (%)
      </p>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return <p style={{ fontFamily: UI_MONO, fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.22)', margin: '0 0 8px' }}>{label}</p>;
}
function Divider() { return <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} />; }

// ── Glowing Audit Trail Badge with progressive disclosure ──────────────
function AuditTrailBadge({ text, riskScore }: { text: string | null; riskScore?: number }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;

  return (
    <div>
      {/* Badge trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '4px 10px', borderRadius: '100px', cursor: 'pointer',
          background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)',
          color: 'rgba(255,255,255,0.6)', fontFamily: UI_MONO, fontSize: '10px',
          fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase',
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
        aria-expanded={open}
        aria-label="Toggle audit trail"
      >
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(255,255,255,0.5)', flexShrink: 0 }} />
        Audit Trail
        <span style={{ opacity: 0.6, fontSize: '9px' }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Expandable audit panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              marginTop: '8px', padding: '12px 14px', borderRadius: '10px',
              background: 'rgba(0,0,0,0.92)',
              border: '0.5px solid rgba(255,255,255,0.10)',
              fontFamily: UI_MONO, fontSize: '11px', color: 'rgba(255,255,255,0.55)',
              lineHeight: 1.7, backdropFilter: 'blur(12px)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(255,255,255,0.45)', display: 'inline-block' }} />
                <span style={{ fontFamily: UI_MONO, fontSize: '9px', fontWeight: 600, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Verifiable Source Trace
                </span>
              </div>
              <p style={{ margin: 0, fontStyle: 'italic', color: 'rgba(255,255,255,0.45)' }}>
                &ldquo;{text}&rdquo;
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type TabId = 'overview' | 'structure' | 'analysis';

const NodePanel = React.memo(function NodePanel({ node, onClose, allNodes, allEdges }: NodePanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [showConnections, setShowConnections] = useState(false);
  const [showRawData, setShowRawData] = useState(false);

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

  // ── Professional Null State Detection ──
  // A node has "insufficient data" if it's NOT the final target product and key metrics are missing/zero
  // A node is the "final target" if it's a desired metabolite with no risk and green status —
  // these intentionally have 0/null metrics and should NOT show "Inference Pending".
  const isFinalTarget = node?.nodeType === 'metabolite' && (node?.risk_score === undefined || node?.risk_score === 0) && node?.color_mapping === 'Green';
  const hasInsufficientRiskData = !isFinalTarget && (node?.risk_score === undefined || node?.risk_score === null);
  const hasInsufficientCarbonData = !isFinalTarget && (node?.carbon_efficiency === undefined || node?.carbon_efficiency === null || node?.carbon_efficiency === 0);
  const hasInsufficientCofactorData = !isFinalTarget && !node?.cofactor_balance;
  const hasInsufficientSepData = !isFinalTarget && (node?.separation_cost_index === undefined || node?.separation_cost_index === null);

  // Tab definitions
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
              background: 'rgba(0,0,0,0.92)',
              backdropFilter: 'blur(28px)',
              WebkitBackdropFilter: 'blur(28px)',
              borderLeft: '1px solid rgba(255,255,255,0.08)',
              fontFamily: UI_SANS,
            }}
          >
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0, background: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.2)' }} />
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
                  style={{ color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', padding: '4px', flexShrink: 0, display: 'flex', borderRadius: '6px', transition: 'border-color 300ms ease-out, filter 300ms ease-out' }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)';
                    (e.currentTarget as HTMLElement).style.filter = 'brightness(1.08)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
                    (e.currentTarget as HTMLElement).style.filter = 'brightness(1)';
                  }}>
                  <X size={15} />
                </button>
              </div>

              {/* Tab bar */}
              <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '4px', border: '1px solid rgba(255,255,255,0.08)' }}>
                {tabs.map(tab => (
                  <button key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    onMouseEnter={e => {
                      if (activeTab !== tab.id) {
                        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)';
                        (e.currentTarget as HTMLElement).style.filter = 'brightness(1.05)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (activeTab !== tab.id) {
                        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
                        (e.currentTarget as HTMLElement).style.filter = 'brightness(1)';
                      }
                    }}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                      padding: '6px 8px', borderRadius: '6px', border: `1px solid ${activeTab === tab.id ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`, cursor: 'pointer',
                      background: activeTab === tab.id ? 'rgba(255,255,255,0.06)' : 'transparent',
                      color: activeTab === tab.id ? '#ffffff' : 'rgba(255,255,255,0.55)',
                      fontSize: '11px', fontWeight: activeTab === tab.id ? 600 : 400,
                      transition: 'border-color 300ms ease-out, filter 300ms ease-out, color 300ms ease-out',
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
                      <span style={{ color: '#9CA3AF', fontSize: '10px', fontFamily: UI_MONO, fontFeatureSettings: "'tnum' 1" }}>{node.id}</span>
                    </div>
                    {node.nodeType && node.nodeType !== 'unknown' && (
                      <div style={{ padding: '3px 8px', borderRadius: '20px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <span style={{ color: '#9CA3AF', fontSize: '10px', fontFamily: UI_MONO, fontFeatureSettings: "'tnum' 1", textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {NODE_TYPE_LABELS[node.nodeType]}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* ─── Purity Status Badge — always visible ──────────────────────── */}
                  <div style={{ padding: '10px 14px', borderRadius: '16px', marginBottom: '12px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>
                        {node.nodeType === 'impurity' || (node.risk_score && node.risk_score > MODERATE_RISK_THRESHOLD)
                          ? <AlertTriangle size={14} />
                          : node.nodeType === 'intermediate'
                            ? <Circle size={14} />
                            : <CheckCircle size={14} />}
                      </span>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: "'Inter', -apple-system, sans-serif",
                          color: 'rgba(255,255,255,0.85)',
                        }}>
                          {node.nodeType === 'impurity' ? 'Impurity — Purification Risk'
                            : (node.risk_score && node.risk_score > MODERATE_RISK_THRESHOLD) ? 'Elevated Commercial Risk'
                            : node.nodeType === 'intermediate' ? 'Pathway Intermediate'
                            : 'Verified High-Yield'}
                        </span>
                        <span style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '2px', fontFamily: "'Inter', -apple-system, sans-serif" }}>
                          {node.nodeType === 'impurity'
                            ? 'This compound requires separation from the target product'
                            : (node.risk_score && node.risk_score > MODERATE_RISK_THRESHOLD)
                              ? 'Moderate to high risk — monitor during production'
                              : node.nodeType === 'intermediate'
                                ? 'Transient intermediate — may require yield optimization'
                                : 'On-pathway metabolite — standard purification sufficient'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ─── Commercial Risk & Compliance Panel ──────────────────────── */}
                  <div style={{ padding: '14px 16px', borderRadius: '20px', background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <ShieldAlert size={14} color="rgba(255,255,255,0.45)" />
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '0.03em', fontFamily: UI_SANS }}>COMMERCIAL RISK & COMPLIANCE</span>
                    </div>

                    {/* Risk Score Bar */}
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#9CA3AF', marginBottom: '6px', fontFamily: UI_MONO }}>
                        <span>Risk Score</span>
                        {hasInsufficientRiskData ? (
                          <span style={{ fontWeight: 600, fontSize: '9px', color: '#9CA3AF', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '6px', letterSpacing: '0.03em', fontFamily: UI_MONO }}>
                            Inference Pending
                          </span>
                        ) : (
                          <span style={{ fontWeight: 600, fontFamily: UI_MONO, color: 'rgba(255,255,255,0.65)' }}>
                            {((node.risk_score ?? 0) * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                      {hasInsufficientRiskData ? (
                        <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px' }} />
                      ) : (
                        <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px' }}>
                          <div style={{ width: `${(node.risk_score ?? 0) * 100}%`, height: '100%', borderRadius: '2px', background: 'rgba(255,255,255,0.75)' }} />
                        </div>
                      )}
                    </div>

                    {/* Separation Cost Index Bar */}
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#9CA3AF', marginBottom: '6px', fontFamily: UI_MONO }}>
                        <span>Separation Cost Index</span>
                        {hasInsufficientSepData ? (
                          <span style={{ fontWeight: 600, fontSize: '9px', color: '#9CA3AF', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '6px', letterSpacing: '0.03em', fontFamily: UI_MONO }}>
                            Inference Pending
                          </span>
                        ) : (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: UI_MONO }}>
                            {(node.separation_cost_index ?? 0) > HIGH_RISK_THRESHOLD && (
                              <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 700, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>High Separation Cost</span>
                            )}
                            <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>
                              {((node.separation_cost_index ?? 0) * 100).toFixed(0)}%
                            </span>
                          </span>
                        )}
                      </div>
                      {hasInsufficientSepData ? (
                        <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px' }} />
                      ) : (
                        <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px' }}>
                          <div style={{ width: `${(node.separation_cost_index ?? 0) * 100}%`, height: '100%', borderRadius: '2px', background: 'rgba(255,255,255,0.75)' }} />
                        </div>
                      )}
                    </div>

                    {/* Toxicity Impact */}
                    {node.toxicity_impact && (
                      <div style={{ padding: '10px 12px', borderRadius: '12px', marginBottom: '12px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '0.5px solid rgba(255,255,255,0.06)',
                      }}>
                        <span style={{ display: 'block', fontSize: '9px', color: 'rgba(255,255,255,0.35)', marginBottom: '4px', fontWeight: 700, textTransform: 'uppercase', fontFamily: "'Inter', -apple-system, sans-serif" }}>Potential Toxicity Analysis</span>
                        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '11px', fontWeight: 500, margin: 0, lineHeight: 1.5, fontFamily: "'Inter', -apple-system, sans-serif" }}>
                          {node.toxicity_impact}
                        </p>
                      </div>
                    )}

                    {/* Thermodynamic Stability */}
                    {node.thermodynamic_stability && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                        <span style={{ fontSize: '10px', color: '#9CA3AF', fontFamily: UI_MONO }}>Thermodynamic Stability:</span>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.65)', fontFamily: UI_MONO }}>{node.thermodynamic_stability}</span>
                      </div>
                    )}

                    {/* Cofactor Balance */}
                    {node.cofactor_balance ? (
                      <div style={{ padding: '10px 12px', borderRadius: '12px', marginBottom: '12px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '0.5px solid rgba(255,255,255,0.07)',
                      }}>
                        <span style={{ display: 'block', fontSize: '9px', color: 'rgba(255,255,255,0.35)', marginBottom: '4px', fontWeight: 700, textTransform: 'uppercase', fontFamily: "'Inter', -apple-system, sans-serif" }}>Cofactor Balance (ATP/NAD(P)H)</span>
                        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '11px', fontWeight: 500, margin: 0, lineHeight: 1.5, fontFamily: UI_MONO }}>
                          {node.cofactor_balance}
                        </p>
                      </div>
                    ) : hasInsufficientCofactorData && (
                      <div style={{ padding: '10px 12px', borderRadius: '12px', marginBottom: '12px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}>
                        <span style={{ display: 'block', fontSize: '9px', color: 'rgba(255,255,255,0.35)', marginBottom: '4px', fontWeight: 700, textTransform: 'uppercase', fontFamily: "'Inter', -apple-system, sans-serif" }}>Cofactor Balance (ATP/NAD(P)H)</span>
                        <span style={{ fontSize: '10px', color: '#9CA3AF', background: 'rgba(255,255,255,0.05)', padding: '3px 10px', borderRadius: '6px', fontFamily: UI_MONO, fontWeight: 600 }}>
                          Inference Pending / Data Insufficient
                        </span>
                      </div>
                    )}

                    {/* Carbon Efficiency */}
                    {hasInsufficientCarbonData ? (
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#9CA3AF', marginBottom: '6px', fontFamily: UI_MONO }}>
                          <span>Carbon Efficiency (Atom Economy)</span>
                          <span style={{ fontWeight: 600, fontSize: '9px', color: '#9CA3AF', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '6px', letterSpacing: '0.03em', fontFamily: UI_MONO }}>
                            Inference Pending
                          </span>
                        </div>
                        <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px' }} />
                      </div>
                    ) : node.carbon_efficiency !== undefined && (
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#9CA3AF', marginBottom: '6px', fontFamily: UI_MONO }}>
                          <span>Carbon Efficiency (Atom Economy)</span>
                          <span style={{ fontWeight: 600, fontFamily: UI_MONO, color: 'rgba(255,255,255,0.65)' }}>
                            {node.carbon_efficiency.toFixed(1)}%
                          </span>
                        </div>
                        <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px' }}>
                          <div style={{ width: `${node.carbon_efficiency}%`, height: '100%', borderRadius: '2px', background: 'rgba(255,255,255,0.75)' }} />
                        </div>
                      </div>
                    )}

                    {/* Gene KO/OE Recommendation */}
                    {node.gene_recommendation && node.gene_recommendation !== 'N/A' && (
                      <div style={{ padding: '10px 12px', borderRadius: '12px', marginBottom: '12px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '0.5px solid rgba(255,255,255,0.07)',
                      }}>
                        <span style={{ display: 'block', fontSize: '9px', color: 'rgba(255,255,255,0.35)', marginBottom: '4px', fontWeight: 700, textTransform: 'uppercase', fontFamily: "'Inter', -apple-system, sans-serif" }}>Gene Engineering Target (KO/OE)</span>
                        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: 500, margin: 0, lineHeight: 1.5, fontFamily: "'Inter', -apple-system, sans-serif" }}>
                          {node.gene_recommendation}
                        </p>
                      </div>
                    )}

                    {/* ── Audit Trail — glowing expandable badge (progressive disclosure) ── */}
                    <AuditTrailBadge
                      text={node.audit_trail ?? (
                        (hasInsufficientRiskData || hasInsufficientCarbonData || hasInsufficientCofactorData)
                          ? 'Real-time thermodynamic modeling requires binding constants not found in current literature. Estimate based on structural analogs and thermodynamic heuristics.'
                          : null
                      )}
                      riskScore={node.risk_score}
                    />
                  </div>

                  {node.confidenceScore !== undefined && <ConfidenceBar score={node.confidenceScore} />}

                  {allNodes && allNodes.length > 1 && <PLDDTHistogram nodes={allNodes} currentNodeId={node.id} />}

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
                          <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: '9px', fontFamily: "'Inter', -apple-system, sans-serif", fontFeatureSettings: "'tnum' 1", marginBottom: '8px' }}>
                            AI · grounded in source
                          </span>
                        </div>
                        {node.evidenceSnippet && (
                          <div style={{ padding: '12px 14px', borderRadius: '20px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderLeft: '3px solid rgba(255,255,255,0.18)', position: 'relative' }}>
                            <span style={{ position: 'absolute', top: '8px', left: '14px', color: 'rgba(255,255,255,0.12)', fontSize: '28px', fontFamily: "'Inter', -apple-system, sans-serif", lineHeight: 1, userSelect: 'none' }}>"</span>
                            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', lineHeight: 1.7, margin: '12px 0 0', fontStyle: 'italic', letterSpacing: '-0.005em' }}>
                              {node.evidenceSnippet}
                            </p>
                          </div>
                        )}
                        {node.citation && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <FileText size={11} style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
                            <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: '11px', lineHeight: 1.5, margin: 0, fontFamily: "'Inter', -apple-system, sans-serif", fontFeatureSettings: "'tnum' 1", letterSpacing: '0.01em' }}>{node.citation}</p>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Connections */}
                  {connections.length > 0 && allNodes && (
                    <>
                      <Divider />
                      <div>
                        <button onClick={() => setShowConnections(!showConnections)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px' }}>
                          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: "'Inter', -apple-system, sans-serif", fontFeatureSettings: "'tnum' 1", textTransform: 'uppercase', letterSpacing: '0.08em' }}>
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
                                  <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', fontFamily: "'Inter', -apple-system, sans-serif", fontFeatureSettings: "'tnum' 1" }}>{isSource ? '→' : '←'}</span>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', margin: '0 0 1px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {otherNode?.label || otherId}
                                    </p>
                                    <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: "'Inter', -apple-system, sans-serif", fontFeatureSettings: "'tnum' 1", margin: 0 }}>
                                      {isSource ? `this ${EDGE_TYPE_LABELS[relType]} →` : `← ${EDGE_TYPE_LABELS[relType]} this`}
                                    </p>
                                  </div>
                                  {edge.confidenceScore !== undefined && (
                                    <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: "'Inter', -apple-system, sans-serif", fontFeatureSettings: "'tnum' 1", flexShrink: 0 }}>{Math.round(edge.confidenceScore * 100)}%</span>
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
                              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', fontFamily: "'Inter', -apple-system, sans-serif", fontFeatureSettings: "'tnum' 1", width: '64px', flexShrink: 0 }}>PubChem</span>
                              <a href={`https://pubchem.ncbi.nlm.nih.gov/compound/${pubchemCID}`} target="_blank" rel="noopener noreferrer" style={{ color: '#A8C5DA', fontSize: '11px', fontFamily: "'Inter', -apple-system, sans-serif", fontFeatureSettings: "'tnum' 1", textDecoration: 'none' }}>CID {pubchemCID}</a>
                            </div>
                          )}
                          {node.ecNumber && (
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', fontFamily: "'Inter', -apple-system, sans-serif", fontFeatureSettings: "'tnum' 1", width: '64px', flexShrink: 0 }}>EC</span>
                              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontFamily: "'Inter', -apple-system, sans-serif", fontFeatureSettings: "'tnum' 1" }}>{node.ecNumber}</span>
                            </div>
                          )}
                          {node.uniprotId && (
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', fontFamily: "'Inter', -apple-system, sans-serif", fontFeatureSettings: "'tnum' 1", width: '64px', flexShrink: 0 }}>UniProt</span>
                              <a href={`https://www.uniprot.org/uniprotkb/${node.uniprotId}`} target="_blank" rel="noopener noreferrer" style={{ color: '#A8C5DA', fontSize: '11px', fontFamily: "'Inter', -apple-system, sans-serif", fontFeatureSettings: "'tnum' 1", textDecoration: 'none' }}>{node.uniprotId}</a>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  <Divider />

                  {/* ─── Genetic Intervention Badge ─────────────────────────── */}
                  {node.genetic_intervention && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        padding: '6px 12px', borderRadius: '20px',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}>
                        <span style={{ display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.45)' }}>
                          {node.genetic_intervention.startsWith('KO') ? <Scissors size={12} /> : <ArrowUp size={12} />}
                        </span>
                        <span style={{
                          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                          fontSize: '11px', fontWeight: 600,
                          color: 'rgba(255,255,255,0.75)',
                        }}>
                          {node.genetic_intervention}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* ─── Collapsible Raw Data Section ──────────────────────── */}
                  {(node.cofactor_balance || node.atom_economy !== undefined || node.dsp_bottleneck || node.ic50_toxicity) && (
                    <div style={{ marginBottom: '12px' }}>
                      <button
                        onClick={() => setShowRawData(!showRawData)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                          padding: '8px 0',
                        }}
                      >
                        <span style={{
                          color: 'rgba(255,255,255,0.3)', fontSize: '10px',
                          fontFamily: "'Inter', -apple-system, sans-serif",
                          textTransform: 'uppercase', letterSpacing: '0.08em',
                          fontFeatureSettings: "'tnum' 1",
                        }}>
                          {showRawData ? '[−]' : '[+]'} View Raw Thermodynamics & Kinetics
                        </span>
                        {showRawData
                          ? <ChevronUp size={12} style={{ color: 'rgba(255,255,255,0.2)' }} />
                          : <ChevronDown size={12} style={{ color: 'rgba(255,255,255,0.2)' }} />}
                      </button>

                      {showRawData && (
                        <div style={{
                          padding: '14px',
                          borderRadius: '16px',
                          background: 'rgba(0,0,0,0.3)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                          fontSize: '11px',
                          lineHeight: 1.8,
                          color: 'rgba(255,255,255,0.5)',
                        }}>
                          {node.cofactor_balance && (
                            <div style={{ marginBottom: '8px' }}>
                              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Inter', -apple-system, sans-serif", fontWeight: 700 }}>Cofactor Balance</span>
                              <div style={{ color: BIO_THEME_COLORS.PURPLE, marginTop: '2px' }}>{node.cofactor_balance}</div>
                            </div>
                          )}
                          {node.atom_economy !== undefined && node.atom_economy !== 0 ? (
                            <div style={{ marginBottom: '8px' }}>
                              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Inter', -apple-system, sans-serif", fontWeight: 700 }}>Atom Economy (Carbon Efficiency)</span>
                              <div style={{
                                color: node.atom_economy >= 80 ? BIO_THEME_COLORS.GREEN
                                  : node.atom_economy >= 50 ? BIO_THEME_COLORS.AMBER
                                  : BIO_THEME_COLORS.RED,
                                marginTop: '2px',
                              }}>
                                {node.atom_economy.toFixed(1)}%
                              </div>
                            </div>
                          ) : !isFinalTarget && (
                            <div style={{ marginBottom: '8px' }}>
                              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Inter', -apple-system, sans-serif", fontWeight: 700 }}>Atom Economy (Carbon Efficiency)</span>
                              <div style={{ color: 'rgba(255,255,255,0.30)', marginTop: '2px' }}>Inference Pending / Data Insufficient</div>
                            </div>
                          )}
                          {node.dsp_bottleneck && (
                            <div style={{ marginBottom: '8px' }}>
                              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Inter', -apple-system, sans-serif", fontWeight: 700 }}>DSP Bottleneck</span>
                              <div style={{ color: BIO_THEME_COLORS.AMBER, marginTop: '2px' }}>{node.dsp_bottleneck}</div>
                            </div>
                          )}
                          {node.ic50_toxicity && (
                            <div>
                              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Inter', -apple-system, sans-serif", fontWeight: 700 }}>IC50 Toxicity</span>
                              <div style={{ color: BIO_THEME_COLORS.RED, marginTop: '2px' }}>{node.ic50_toxicity}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

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
                      <div>
                        <SectionLabel label="Protein Structure" />
                        <ProteinViewer
                          pdbId={ENZYME_ALPHAFOLD[node.id].pdbId}
                          alphafoldId={ENZYME_ALPHAFOLD[node.id].afId}
                          label={ENZYME_ALPHAFOLD[node.id].name}
                        />
                      </div>
                    ) : rcsbMatch ? (
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
                            <p style={{ color: 'rgba(255,255,255,0.12)', fontSize: '9px', fontFamily: "'Inter', -apple-system, sans-serif", fontFeatureSettings: "'tnum' 1", marginTop: '6px' }}>
                              3D conformer · CPK coloring · Source: PubChem
                            </p>
                          </div>
                        );
                      }

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
                            <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: '9px', fontFamily: "'Inter', -apple-system, sans-serif", fontFeatureSettings: "'tnum' 1", textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
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
});

export default NodePanel;
