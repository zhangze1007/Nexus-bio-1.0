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
  const [renderMode, setRenderMode] = useState<'ball-stick' | 'spacefill' | 'wire'>('ball-stick');
  const [spinEnabled, setSpinEnabled] = useState(true);

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
          backgroundColor: '0x0d0f14', antialias: true,
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
        viewer.setStyle({}, {});
        if (renderMode === 'spacefill') {
          viewer.setStyle({}, { sphere: { colorscheme: 'Jmol', scale: 0.95 } });
        } else if (renderMode === 'wire') {
          viewer.setStyle({}, { line: { colorscheme: 'Jmol' } });
        } else {
          viewer.setStyle({}, {
            stick: { colorscheme: 'Jmol', radius: 0.12 },
            sphere: { colorscheme: 'Jmol', scale: 0.28 },
          });
        }
        viewer.zoomTo();
        viewer.spin(spinEnabled ? 'y' : false, 0.5);
        viewer.render();
        if (!cancelled) setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    }

    init();
    return () => { cancelled = true; };
  }, [pubchemCID, searchName, molBlock, renderMode, spinEnabled]);

  if (status === 'empty') return null;

  const displayCID = resolvedCID ?? pubchemCID;
  const pubchemLink = displayCID
    ? `https://pubchem.ncbi.nlm.nih.gov/compound/${displayCID}`
    : searchName
    ? `https://pubchem.ncbi.nlm.nih.gov/#query=${encodeURIComponent(searchName)}`
    : null;
  const sourceLabel = molBlock
    ? 'Inline mol block'
    : pubchemCID
      ? `PubChem CID ${pubchemCID}`
      : searchName
        ? `PubChem name search · ${searchName}`
        : 'Unknown source';
  const traceText =
    renderMode === 'spacefill'
      ? 'Spacefill emphasizes steric footprint and packing volume.'
      : renderMode === 'wire'
        ? 'Wire mode strips the conformer to bond topology for fast structural reading.'
        : 'Ball-stick keeps atoms and bonds balanced for general inspection and presentation.';

  return (
    <div style={{ width: '100%', height: `${height}px`, position: 'relative', borderRadius: '20px', overflow: 'hidden', background: '#0d0f14', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 2px 16px rgba(0,0,0,0.5)' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#0d0f14' }} />

      {status === 'loading' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#0d0f14', pointerEvents: 'none' }}>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <Loader2 size={16} style={{ color: '#C8E8F0', animation: 'spin 1s linear infinite' }} />
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1" }}>
            {searchName ? `Searching PubChem for "${searchName}"...` : 'Loading 3D conformer...'}
          </span>
        </div>
      )}

      {status === 'error' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#0d0f14' }}>
          <AlertCircle size={14} style={{ color: 'rgba(240,160,160,0.7)' }} />
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>Structure not found in PubChem</span>
          {pubchemLink && (
            <a href={pubchemLink} target="_blank" rel="noopener noreferrer"
              style={{ color: '#C8E8F0', fontSize: '10px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", display: 'flex', alignItems: 'center', gap: '3px' }}>
              Search PubChem manually <ExternalLink size={8} />
            </a>
          )}
        </div>
      )}

      {status === 'ready' && (
        <>
          <div style={{ position: 'absolute', bottom: '8px', left: '10px', display: 'flex', gap: '6px' }}>
            {([
              { key: 'ball-stick', label: 'Ball-stick' },
              { key: 'spacefill', label: 'Spacefill' },
              { key: 'wire', label: 'Wire' },
            ] as const).map(mode => (
              <button
                key={mode.key}
                type="button"
                onClick={() => setRenderMode(mode.key)}
                style={{
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: renderMode === mode.key ? 'rgba(200,232,240,0.18)' : 'rgba(255,255,255,0.06)',
                  color: renderMode === mode.key ? '#C8E8F0' : 'rgba(255,255,255,0.45)',
                  fontSize: '9px',
                  borderRadius: '999px',
                  padding: '3px 7px',
                  cursor: 'pointer',
                }}
              >
                {mode.label}
              </button>
            ))}
          </div>
          <div style={{ position: 'absolute', top: '8px', left: '10px', pointerEvents: 'none' }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '9px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", background: 'rgba(0,0,0,0.45)', padding: '2px 6px', borderRadius: '8px' }}>
              {label || searchName || nodeId}
              {displayCID && ` · CID ${displayCID}`}
            </span>
          </div>
          {pubchemLink && (
            <div style={{ position: 'absolute', top: '8px', right: '10px' }}>
              <a href={pubchemLink} target="_blank" rel="noopener noreferrer"
                style={{ color: 'rgba(255,255,255,0.35)', fontSize: '9px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", display: 'flex', alignItems: 'center', gap: '3px', textDecoration: 'none', background: 'rgba(0,0,0,0.45)', padding: '2px 6px', borderRadius: '8px' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(200,232,240,0.9)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)'; }}>
                PubChem <ExternalLink size={8} />
              </a>
            </div>
          )}
          <div style={{ position: 'absolute', bottom: '8px', right: '10px', pointerEvents: 'none' }}>
            <button
              type="button"
              onClick={() => setSpinEnabled(!spinEnabled)}
              style={{ color: 'rgba(255,255,255,0.5)', fontSize: '9px', fontFamily: "'Public Sans',sans-serif", fontFeatureSettings: "'tnum' 1", background: 'rgba(0,0,0,0.45)', padding: '2px 8px', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', pointerEvents: 'auto' }}
            >
              {spinEnabled ? 'Auto spin' : 'Static'}
            </button>
          </div>
        </>
      )}

      {status === 'ready' && (
        <div style={{ position: 'absolute', left: '10px', right: '10px', bottom: '40px', pointerEvents: 'none' }}>
          <div style={{ padding: '8px 10px', borderRadius: '12px', background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)' }}>
            <p style={{ margin: '0 0 4px', color: 'rgba(255,255,255,0.3)', fontSize: '9px', fontFamily: "'Public Sans',sans-serif", textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Structure trace
            </p>
            <p style={{ margin: '0 0 6px', color: 'rgba(255,255,255,0.65)', fontSize: '10px', lineHeight: 1.5, fontFamily: "'Public Sans',sans-serif" }}>
              {traceText}
            </p>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ padding: '2px 6px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)', fontSize: '9px', fontFamily: "'Public Sans',sans-serif" }}>
                {sourceLabel}
              </span>
              {displayCID && (
                <span style={{ padding: '2px 6px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)', fontSize: '9px', fontFamily: "'Public Sans',sans-serif" }}>
                  resolved CID {displayCID}
                </span>
              )}
              <span style={{ padding: '2px 6px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)', fontSize: '9px', fontFamily: "'Public Sans',sans-serif" }}>
                mode {renderMode}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
