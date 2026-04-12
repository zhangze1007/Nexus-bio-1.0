'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { load3Dmol } from '../../hooks/use3Dmol';
import type { EnzymeStructure } from '../../services/CatalystDesignerEngine';

/* ── Render‐mode helpers ───────────────────────────────────────── */

const ROLE_COLORS: Record<string, number> = {
  nucleophile: 0xe41a1c,
  acid_base: 0x377eb8,
  stabilizer: 0x4daf4a,
  oxyanion_hole: 0xff7f00,
};

function applyRenderMode(
  viewer: any,
  mode: 'cartoon' | 'surface' | 'confidence',
  hasAlphaFold: boolean,
) {
  viewer.setStyle({}, {});
  if (mode === 'surface') {
    viewer.setStyle({}, { cartoon: { color: hasAlphaFold ? '#EAEAEA' : 'spectrum', thickness: 0.35 } });
    viewer.addSurface(window.$3Dmol.SurfaceType.VDW, { opacity: 0.72, color: hasAlphaFold ? '#F0FDFA' : '#FFFFFF' });
  } else if (mode === 'confidence' && hasAlphaFold) {
    viewer.setStyle({}, {
      cartoon: {
        colorfunc: (atom: any) => {
          const b = atom.b;
          if (b >= 90) return 0x0053D6;
          if (b >= 70) return 0x65CBF3;
          if (b >= 50) return 0xFFDB13;
          return 0xFF7D45;
        },
        thickness: 0.55,
      },
    });
  } else {
    viewer.setStyle({}, { cartoon: { color: hasAlphaFold ? '#EAEAEA' : 'spectrum', thickness: 0.5 } });
    viewer.setStyle({ hetflag: true }, { stick: { colorscheme: 'greenCarbon', radius: 0.15 } });
  }
}

/* ── Props ─────────────────────────────────────────────────────── */

export interface CatalystViewer3DProps {
  enzyme: EnzymeStructure;
  renderMode: 'cartoon' | 'surface' | 'confidence';
  spinEnabled?: boolean;
  onResidueClick?: (position: number, residueName: string) => void;
  highlightResidues?: number[];
  style?: React.CSSProperties;
}

/* ── Component ─────────────────────────────────────────────────── */

export default function CatalystViewer3D({
  enzyme,
  renderMode,
  spinEnabled = true,
  onResidueClick,
  highlightResidues,
  style,
}: CatalystViewer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [useAlphaFold, setUseAlphaFold] = useState(false);

  const sourceLabel = useAlphaFold
    ? `AlphaFold · ${enzyme.uniprotId}`
    : enzyme.pdbId ? `RCSB PDB · ${enzyme.pdbId}` : `AlphaFold · ${enzyme.uniprotId}`;

  /* ── Load structure and apply style ──────────────────────────── */
  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!containerRef.current) return;
      setStatus('loading');
      try {
        await load3Dmol();
        if (cancelled) return;

        // Clean previous viewer
        if (viewerRef.current) { try { viewerRef.current.clear(); } catch {} }
        containerRef.current.innerHTML = '';

        const viewer = window.$3Dmol.createViewer(containerRef.current, {
          backgroundColor: '0x0d0f14', antialias: true,
        });
        viewerRef.current = viewer;

        // Decide source: PDB direct or AlphaFold proxy
        const shouldUseAF = useAlphaFold || !enzyme.pdbId;

        if (shouldUseAF) {
          const res = await fetch(`/api/alphafold?id=${enzyme.uniprotId}`);
          if (!res.ok) throw new Error(`AlphaFold ${res.status}`);
          const pdb = await res.text();
          if (!pdb || pdb.length < 100) throw new Error('Empty AlphaFold response');
          viewer.addModel(pdb, 'pdb');
        } else {
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('PDB download timeout')), 15000);
            window.$3Dmol.download(`pdb:${enzyme.pdbId}`, viewer, {}, () => {
              clearTimeout(timer);
              resolve();
            });
          });
        }

        // Apply render mode
        applyRenderMode(viewer, renderMode, shouldUseAF);

        // Highlight catalytic residues as spheres
        for (const res of enzyme.catalyticResidues) {
          const color = ROLE_COLORS[res.role] ?? 0x999999;
          viewer.addStyle(
            { resi: res.position },
            { sphere: { radius: 0.6, color } },
          );
        }

        // Highlight additional residues if provided
        if (highlightResidues?.length) {
          for (const resi of highlightResidues) {
            viewer.addStyle(
              { resi },
              { sphere: { radius: 0.5, color: 0xffdb13, opacity: 0.7 } },
            );
          }
        }

        // Load substrate from PubChem proxy
        try {
          const subRes = await fetch(`/api/pubchem?name=${encodeURIComponent(enzyme.substrate)}`);
          if (subRes.ok) {
            const sdf = await subRes.text();
            if (sdf && sdf.length > 50) {
              viewer.addModel(sdf, 'sdf');
              viewer.setStyle({ model: -1 }, { stick: { colorscheme: 'greenCarbon', radius: 0.15 } });
            }
          }
        } catch {
          // substrate rendering is optional — continue without it
        }

        // Click handler for residue selection
        if (onResidueClick) {
          viewer.setClickable({}, true, (atom: any) => {
            if (atom && typeof atom.resi === 'number') {
              const name = atom.resn ? `${atom.resn}${atom.resi}` : `${atom.resi}`;
              onResidueClick(atom.resi, name);
            }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enzyme.id, enzyme.pdbId, enzyme.uniprotId, renderMode, useAlphaFold, spinEnabled]);

  /* ── Spin toggle (no full reload) ────────────────────────────── */
  useEffect(() => {
    if (viewerRef.current && status === 'ready') {
      viewerRef.current.spin(spinEnabled ? 'y' : false, 0.5);
    }
  }, [spinEnabled, status]);

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      {/* Viewer container */}
      <div style={{
        position: 'relative', width: '100%', height: '100%', minHeight: 320,
        borderRadius: 20, overflow: 'hidden', background: '#0d0f14',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 2px 16px rgba(0,0,0,0.5)',
      }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 320 }} />

        {/* Loading overlay */}
        {status === 'loading' && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', background: '#0d0f14', gap: 12,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              border: '2px solid rgba(0,83,214,0.3)',
              borderTopColor: '#0053D6',
              animation: 'spin 1s linear infinite',
            }} />
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, margin: 0 }}>
              Loading {enzyme.name}...
            </p>
          </div>
        )}

        {/* Error overlay */}
        {status === 'error' && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', background: '#0d0f14', gap: 8,
          }}>
            <span style={{ color: 'rgba(240,160,160,0.7)', fontSize: 12 }}>
              Structure unavailable for {enzyme.name}
            </span>
          </div>
        )}

        {/* Source badge */}
        {status === 'ready' && (
          <div style={{ position: 'absolute', top: 8, left: 10, pointerEvents: 'none' }}>
            <span style={{
              color: 'rgba(255,255,255,0.5)', fontSize: 9,
              background: 'rgba(0,0,0,0.45)', padding: '2px 6px', borderRadius: 8,
              fontFamily: "'Inter', -apple-system, sans-serif",
            }}>
              {sourceLabel}
            </span>
          </div>
        )}
      </div>

      {/* AlphaFold toggle (only if enzyme has a PDB) */}
      {enzyme.pdbId && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 10px', borderRadius: 12,
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
        }}>
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10 }}>
            AlphaFold pLDDT
          </span>
          <button
            type="button"
            onClick={() => setUseAlphaFold(!useAlphaFold)}
            style={{
              width: 34, height: 18, borderRadius: 9,
              background: useAlphaFold ? '#A8C5DA' : 'rgba(255,255,255,0.1)',
              border: 'none', cursor: 'pointer', position: 'relative',
              transition: 'background 0.2s',
            }}
          >
            <div style={{
              width: 12, height: 12, borderRadius: '50%', background: '#fff',
              position: 'absolute', top: 3,
              left: useAlphaFold ? 19 : 3,
              transition: 'left 0.2s',
            }} />
          </button>
        </div>
      )}

      {/* Interaction hint */}
      <p style={{
        color: 'rgba(255,255,255,0.1)', fontSize: 9, margin: 0, textAlign: 'center',
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}>
        Drag to rotate · Click residue to inspect · {sourceLabel}
      </p>
    </div>
  );
}
