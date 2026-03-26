'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, ExternalLink, AlertCircle } from 'lucide-react';

declare global { interface Window { $3Dmol: any; } }

type ViewerStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

interface MoleculeViewerProps {
  nodeId?: string;
  pubchemCID?: number;
  searchName?: string;   // auto-search by molecule name if no CID
  molBlock?: string;
  label?: string;
  height?: number;
}

function load3Dmol(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.$3Dmol) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://3Dmol.org/build/3Dmol-min.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load 3Dmol'));
    document.head.appendChild(s);
  });
}

// Fetch by CID
async function fetchByCID(cid: number): Promise<string> {
  const res = await fetch(`/api/pubchem?cid=${cid}`);
  if (!res.ok) throw new Error(`PubChem CID ${res.status}`);
  const text = await res.text();
  if (!text || text.length < 50) throw new Error('Empty SDF');
  return text;
}

// Search by name → auto-resolve CID → fetch SDF
async function fetchByName(name: string): Promise<{ sdf: string; cid: number | null }> {
  const res = await fetch(`/api/pubchem?name=${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`Name not found: ${name}`);
  const sdf = await res.text();
  if (!sdf || sdf.length < 50) throw new Error('Empty SDF from name search');
  // Backend returns resolved CID in header
  const cid = res.headers.get('X-PubChem-CID');
  return { sdf, cid: cid ? parseInt(cid) : null };
}

export default function MoleculeViewer({ nodeId, pubchemCID, searchName, molBlock, label, height = 240 }: MoleculeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [status, setStatus] = useState<ViewerStatus>('idle');
  const [resolvedCID, setResolvedCID] = useState<number | null>(pubchemCID ?? null);

  const hasSource = !!(pubchemCID || searchName || molBlock);

  useEffect(() => {
    if (!hasSource) { setStatus('empty'); return; }
    let cancelled = false;

    async function init() {
      if (!containerRef.current) return;
      setStatus('loading');
      if (viewerRef.current) { try { viewerRef.current.clear(); } catch {} viewerRef.current = null; }
      containerRef.current.innerHTML = '';

      try {
        await load3Dmol();
        if (cancelled) return;

        const viewer = window.$3Dmol.createViewer(containerRef.current, {
          backgroundColor: 'white', antialias: true,
        });
        viewerRef.current = viewer;

        let sdf = molBlock || '';
        let cid = pubchemCID ?? null;

        if (!sdf && pubchemCID) {
          sdf = await fetchByCID(pubchemCID);
        } else if (!sdf && searchName) {
          // Dynamic name search
          const result = await fetchByName(searchName);
          sdf = result.sdf;
          if (result.cid) {
            cid = result.cid;
            setResolvedCID(result.cid);
          }
        }

        if (cancelled) return;
        if (!sdf) throw new Error('No SDF data');

        viewer.addModel(sdf, 'sdf');
        viewer.setStyle({}, {
          stick: { colorscheme: 'Jmol', radius: 0.12 },
          sphere: { colorscheme: 'Jmol', scale: 0.28 },
        });
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
  }, [pubchemCID, searchName, molBlock]);

  if (status === 'empty') return null;

  const displayCID = resolvedCID ?? pubchemCID;
  const pubchemLink = displayCID
    ? `https://pubchem.ncbi.nlm.nih.gov/compound/${displayCID}`
    : searchName
    ? `https://pubchem.ncbi.nlm.nih.gov/#query=${encodeURIComponent(searchName)}`
    : null;

  return (
    <div style={{ width: '100%', height: `${height}px`, position: 'relative', borderRadius: '20px', overflow: 'hidden', background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 12px rgba(0,0,0,0.12)' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#ffffff' }} />

      {status === 'loading' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#ffffff', pointerEvents: 'none' }}>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <Loader2 size={16} style={{ color: '#6495ED', animation: 'spin 1s linear infinite' }} />
          <span style={{ color: 'rgba(0,0,0,0.35)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1" }}>
            {searchName ? `Searching PubChem for "${searchName}"...` : 'Loading 3D conformer...'}
          </span>
        </div>
      )}

      {status === 'error' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#ffffff' }}>
          <AlertCircle size={14} style={{ color: 'rgba(180,60,60,0.5)' }} />
          <span style={{ color: 'rgba(0,0,0,0.35)', fontSize: '11px' }}>Structure not found in PubChem</span>
          {pubchemLink && (
            <a href={pubchemLink} target="_blank" rel="noopener noreferrer"
              style={{ color: '#6495ED', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", display: 'flex', alignItems: 'center', gap: '3px' }}>
              Search PubChem manually <ExternalLink size={8} />
            </a>
          )}
        </div>
      )}

      {status === 'ready' && (
        <>
          <div style={{ position: 'absolute', top: '8px', left: '10px', pointerEvents: 'none' }}>
            <span style={{ color: 'rgba(0,0,0,0.3)', fontSize: '9px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", background: 'rgba(255,255,255,0.85)', padding: '2px 6px', borderRadius: '8px' }}>
              {label || searchName || nodeId}
              {displayCID && ` · CID ${displayCID}`}
            </span>
          </div>
          {pubchemLink && (
            <div style={{ position: 'absolute', top: '8px', right: '10px' }}>
              <a href={pubchemLink} target="_blank" rel="noopener noreferrer"
                style={{ color: 'rgba(0,0,0,0.25)', fontSize: '9px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", display: 'flex', alignItems: 'center', gap: '3px', textDecoration: 'none', background: 'rgba(255,255,255,0.85)', padding: '2px 6px', borderRadius: '8px' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(0,0,0,0.7)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(0,0,0,0.25)'; }}>
                PubChem <ExternalLink size={8} />
              </a>
            </div>
          )}
          <div style={{ position: 'absolute', bottom: '8px', right: '10px', pointerEvents: 'none' }}>
            <span style={{ color: 'rgba(0,0,0,0.2)', fontSize: '9px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", background: 'rgba(255,255,255,0.7)', padding: '2px 6px', borderRadius: '8px' }}>3D · CPK</span>
          </div>
        </>
      )}
    </div>
  );
}
