import { useEffect, useRef, useState } from 'react';
import { Loader2, ExternalLink, AlertCircle } from 'lucide-react';

declare global { interface Window { $3Dmol: any; } }

type ViewerStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

interface MoleculeViewerProps {
  nodeId?: string;
  pubchemCID?: number;
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

async function fetchPubChemSDF(cid: number): Promise<string> {
  // Use backend proxy to avoid CORS
  const res = await fetch(`/api/pubchem?cid=${cid}`);
  if (!res.ok) throw new Error(`PubChem proxy ${res.status}`);
  const text = await res.text();
  if (!text || text.length < 50) throw new Error('Empty SDF');
  return text;
}

export default function MoleculeViewer({ nodeId, pubchemCID, molBlock, label, height = 240 }: MoleculeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [status, setStatus] = useState<ViewerStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!pubchemCID && !molBlock) { setStatus('empty'); return; }
    let cancelled = false;

    async function init() {
      if (!containerRef.current) return;
      setStatus('loading');
      setErrorMsg(null);
      if (viewerRef.current) { try { viewerRef.current.clear(); } catch {} viewerRef.current = null; }
      containerRef.current.innerHTML = '';

      try {
        await load3Dmol();
        if (cancelled) return;

        const viewer = window.$3Dmol.createViewer(containerRef.current, {
          backgroundColor: 'white',
          antialias: true,
        });
        viewerRef.current = viewer;

        const sdf = molBlock || (pubchemCID ? await fetchPubChemSDF(pubchemCID) : '');
        if (cancelled) return;

        viewer.addModel(sdf, 'sdf');

        // CPK — scientific standard coloring
        viewer.setStyle({}, {
          stick: { colorscheme: 'Jmol', radius: 0.12 },
          sphere: { colorscheme: 'Jmol', scale: 0.28 },
        });

        viewer.zoomTo();
        viewer.spin('y', 0.5);
        viewer.render();
        if (!cancelled) setStatus('ready');
      } catch (err: any) {
        if (!cancelled) { setStatus('error'); setErrorMsg(err.message || 'Failed'); }
      }
    }

    init();
    return () => { cancelled = true; };
  }, [pubchemCID, molBlock]);

  if (status === 'empty') return null;

  return (
    <div style={{ width: '100%', height: `${height}px`, position: 'relative', borderRadius: '10px', overflow: 'hidden', background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 12px rgba(0,0,0,0.12)' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#ffffff' }} />

      {status === 'loading' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#ffffff', pointerEvents: 'none' }}>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <Loader2 size={16} style={{ color: '#6495ED', animation: 'spin 1s linear infinite' }} />
          <span style={{ color: 'rgba(0,0,0,0.35)', fontSize: '10px', fontFamily: 'monospace' }}>
            Loading 3D conformer · PubChem
          </span>
        </div>
      )}

      {status === 'error' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#ffffff' }}>
          <AlertCircle size={14} style={{ color: 'rgba(180,60,60,0.5)' }} />
          <span style={{ color: 'rgba(0,0,0,0.35)', fontSize: '11px' }}>3D structure unavailable</span>
          {pubchemCID && (
            <a href={`https://pubchem.ncbi.nlm.nih.gov/compound/${pubchemCID}`} target="_blank" rel="noopener noreferrer"
              style={{ color: '#6495ED', fontSize: '10px', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '3px' }}>
              PubChem CID:{pubchemCID} <ExternalLink size={8} />
            </a>
          )}
        </div>
      )}

      {status === 'ready' && (
        <>
          <div style={{ position: 'absolute', top: '8px', left: '10px', pointerEvents: 'none' }}>
            <span style={{ color: 'rgba(0,0,0,0.3)', fontSize: '9px', fontFamily: 'monospace' }}>{label || nodeId}</span>
          </div>
          {pubchemCID && (
            <div style={{ position: 'absolute', top: '8px', right: '10px' }}>
              <a href={`https://pubchem.ncbi.nlm.nih.gov/compound/${pubchemCID}`} target="_blank" rel="noopener noreferrer"
                style={{ color: 'rgba(0,0,0,0.25)', fontSize: '9px', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '3px', textDecoration: 'none' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(0,0,0,0.7)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(0,0,0,0.25)'; }}>
                CID:{pubchemCID} <ExternalLink size={8} />
              </a>
            </div>
          )}
          <div style={{ position: 'absolute', bottom: '8px', right: '10px', pointerEvents: 'none' }}>
            <span style={{ color: 'rgba(0,0,0,0.2)', fontSize: '9px', fontFamily: 'monospace' }}>3D · CPK</span>
          </div>
        </>
      )}
    </div>
  );
}
