import { useEffect, useMemo, useRef, useState } from 'react';

// 3Dmol is loaded via CDN (same approach as PDBExplorer)
declare global { interface Window { $3Dmol: any; } }

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

type ViewerStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

interface MoleculeViewerProps {
  title?: string;
  smiles?: string;
  molecule3dUrl?: string;
  molBlock?: string;
}

function inferFormat(source?: string): string {
  if (!source) return 'sdf';
  const lower = source.toLowerCase();
  if (lower.endsWith('.pdb')) return 'pdb';
  if (lower.endsWith('.mol2')) return 'mol2';
  if (lower.endsWith('.mol')) return 'mol';
  if (lower.endsWith('.xyz')) return 'xyz';
  return 'sdf';
}

export default function MoleculeViewer({ title, smiles, molecule3dUrl, molBlock }: MoleculeViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<any>(null);
  const [status, setStatus] = useState<ViewerStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const sourceLabel = useMemo(() => {
    if (molecule3dUrl) return molecule3dUrl.split('/').pop() || molecule3dUrl;
    if (molBlock) return 'Inline molecular block';
    if (smiles) return 'SMILES metadata only';
    return null;
  }, [molecule3dUrl, molBlock, smiles]);

  useEffect(() => {
    let mounted = true;

    const cleanup = () => {
      if (viewerRef.current) {
        try { viewerRef.current.clear(); viewerRef.current.render(); } catch {}
        viewerRef.current = null;
      }
    };

    const run = async () => {
      if (!containerRef.current) return;
      cleanup();
      setError(null);

      if (!molecule3dUrl && !molBlock) {
        setStatus('empty');
        return;
      }

      setStatus('loading');

      try {
        await load3Dmol();
        if (!mounted) return;

        const viewer = window.$3Dmol.createViewer(containerRef.current, {
          backgroundColor: '#0b0f14',
        });
        viewerRef.current = viewer;

        let modelText = molBlock || '';
        let format = 'sdf';

        if (!modelText && molecule3dUrl) {
          format = inferFormat(molecule3dUrl);
          const response = await fetch(molecule3dUrl);
          if (!response.ok) throw new Error(`Failed to load 3D model (${response.status})`);
          modelText = await response.text();
        }

        if (!modelText.trim()) throw new Error('Empty molecular data');

        viewer.addModel(modelText, format);
        viewer.setStyle({}, {
          stick: { radius: 0.18, colorscheme: 'Jmol' },
          sphere: { scale: 0.25, colorscheme: 'Jmol' },
        });
        viewer.zoomTo();
        viewer.spin('y', 0.4);
        viewer.render();

        if (!mounted) return;
        setStatus('ready');
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'Unable to render molecule');
        setStatus('error');
      }
    };

    run();
    return () => { mounted = false; cleanup(); };
  }, [molecule3dUrl, molBlock]);

  if (status === 'empty') {
    return (
      <div style={{ width: '100%', minHeight: 200, borderRadius: 10, border: '1px solid rgba(180,190,200,0.08)', background: 'rgba(11,15,20,0.6)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 16 }}>
        <p style={{ color: 'rgba(220,228,236,0.4)', fontSize: 12, margin: '0 0 8px' }}>
          {title || 'Molecular structure'}
        </p>
        <p style={{ color: 'rgba(220,228,236,0.22)', fontSize: 11, lineHeight: 1.6, margin: 0 }}>
          No 3D conformer available for this node.
          Add a <code style={{ fontFamily: 'monospace', color: 'rgba(74,127,165,0.7)' }}>molecule3dUrl</code> pointing to an SDF/MOL/PDB file to render structure.
        </p>
        {smiles && (
          <div style={{ marginTop: 12, padding: '8px 10px', borderRadius: 8, background: 'rgba(74,144,217,0.06)', border: '1px solid rgba(74,144,217,0.14)', color: 'rgba(180,210,235,0.6)', fontSize: 10, fontFamily: 'monospace' }}>
            SMILES: {smiles}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ width: '100%', minHeight: 280, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(180,190,200,0.08)', background: 'linear-gradient(180deg, rgba(11,15,20,0.98), rgba(7,10,14,0.98))', position: 'relative' }}>
      {/* Labels */}
      <div style={{ position: 'absolute', top: 8, left: 10, zIndex: 2, pointerEvents: 'none' }}>
        <p style={{ color: 'rgba(235,241,247,0.85)', fontSize: 11, fontWeight: 600, margin: '0 0 2px' }}>
          {title || 'Molecular structure'}
        </p>
        {sourceLabel && (
          <p style={{ color: 'rgba(220,228,236,0.35)', fontSize: 9, fontFamily: 'monospace', margin: 0 }}>
            {sourceLabel}
          </p>
        )}
      </div>

      {status === 'loading' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(220,228,236,0.4)', fontSize: 11, zIndex: 1, pointerEvents: 'none' }}>
          Loading conformer…
        </div>
      )}

      {status === 'error' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, color: 'rgba(255,160,160,0.7)', fontSize: 11, textAlign: 'center', zIndex: 1, pointerEvents: 'none' }}>
          {error}
        </div>
      )}

      <div ref={containerRef} style={{ width: '100%', height: 280 }} />
    </div>
  );
}
