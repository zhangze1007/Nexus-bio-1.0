'use client';

import { useRef, useState, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';

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

export default function ProteinViewer({ pdbId, alphafoldId, label }: { pdbId: string; alphafoldId?: string; label: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [useAF, setUseAF] = useState(false);
  const [renderMode, setRenderMode] = useState<'cartoon' | 'surface' | 'confidence'>('cartoon');
  const [spinEnabled, setSpinEnabled] = useState(true);
  const sourceLabel = useAF && alphafoldId ? `AlphaFold · ${alphafoldId}` : `RCSB PDB · ${pdbId}`;
  const traceText =
    renderMode === 'surface'
      ? 'Surface mode exposes envelope and packing so catalytic accessibility can be inspected quickly.'
      : renderMode === 'confidence'
        ? 'pLDDT mode maps AlphaFold confidence directly onto the fold so uncertain regions remain explicit.'
        : 'Cartoon mode keeps fold topology legible for presentation and residue-level orientation.';

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
          backgroundColor: '0x0d0f14', antialias: true,
        });
        viewerRef.current = viewer;

        if (useAF && alphafoldId) {
          const res = await fetch(`/api/alphafold?id=${alphafoldId}`);
          if (!res.ok) throw new Error(`AlphaFold ${res.status}`);
          const pdb = await res.text();
          if (!pdb || pdb.length < 100) throw new Error('Empty AlphaFold response');
          viewer.addModel(pdb, 'pdb');
        } else {
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('PDB download timeout')), 15000);
            window.$3Dmol.download(`pdb:${pdbId}`, viewer, {}, () => { clearTimeout(timer); resolve(); });
          });
        }

        viewer.setStyle({}, {});
        if (renderMode === 'surface') {
          viewer.setStyle({}, { cartoon: { color: useAF ? '#EAEAEA' : 'spectrum', thickness: 0.35 } });
          viewer.addSurface(window.$3Dmol.SurfaceType.VDW, {
            opacity: 0.72,
            color: useAF ? '#F0FDFA' : '#FFFFFF',
          });
        } else if (renderMode === 'confidence' && useAF && alphafoldId) {
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
            }
          });
        } else {
          viewer.setStyle({}, { cartoon: { color: useAF ? '#EAEAEA' : 'spectrum', thickness: 0.5 } });
          viewer.setStyle({ hetflag: true }, { stick: { colorscheme: 'greenCarbon', radius: 0.15 } });
        }

        viewer.zoomTo();
        viewer.spin(spinEnabled ? 'y' : false, 0.5);
        viewer.render();
        if (!cancelled) setStatus('ready');
      } catch (err) {
        if (useAF && !cancelled) {
          try {
            if (viewerRef.current) { try { viewerRef.current.clear(); } catch {} }
            containerRef.current!.innerHTML = '';
            const viewer2 = window.$3Dmol.createViewer(containerRef.current!, {
              backgroundColor: '0x0d0f14', antialias: true,
            });
            viewerRef.current = viewer2;
            await new Promise<void>((resolve, reject) => {
              const timer = setTimeout(() => reject(new Error('PDB download timeout')), 15000);
              window.$3Dmol.download(`pdb:${pdbId}`, viewer2, {}, () => { clearTimeout(timer); resolve(); });
            });
            viewer2.setStyle({}, { cartoon: { color: 'spectrum', thickness: 0.5 } });
            viewer2.zoomTo();
            viewer2.spin(spinEnabled ? 'y' : false, 0.5);
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
  }, [pdbId, alphafoldId, useAF, renderMode, spinEnabled]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ position: 'relative', width: '100%', height: '280px', borderRadius: '20px', overflow: 'hidden', background: '#0d0f14', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 2px 16px rgba(0,0,0,0.5)' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        {status === 'loading' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0d0f14', gap: '12px', overflow: 'hidden' }}>
            <style>{`
              @keyframes dissolve-float {
                0%   { transform: translate(var(--tx), 40px) scale(0); opacity: 0; }
                20%  { opacity: 0.7; }
                80%  { opacity: 0.5; }
                100% { transform: translate(var(--tx), -40px) scale(0.3); opacity: 0; }
              }
              .dissolve-dot {
                position: absolute;
                width: 4px; height: 4px;
                border-radius: 50%;
                animation: dissolve-float 2.2s ease-in-out infinite;
              }
            `}</style>
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
            <div style={{ position: 'relative', width: '48px', height: '48px' }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1.5px solid rgba(0,83,214,0.25)', animation: 'spin 3s linear infinite' }} />
              <div style={{ position: 'absolute', inset: '6px', borderRadius: '50%', border: '1px solid rgba(101,203,243,0.35)', animation: 'spin 2s linear infinite reverse' }} />
              <div style={{ position: 'absolute', inset: '14px', borderRadius: '50%', background: 'rgba(0,83,214,0.12)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontFamily: "'Inter', -apple-system, sans-serif", fontWeight: 600, margin: '0 0 3px' }}>
                {useAF ? 'Predicting structure' : 'Loading structure'}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontFamily: "'Inter', -apple-system, sans-serif", margin: 0, fontFeatureSettings: "'tnum' 1" }}>
                {useAF ? `AlphaFold · ${alphafoldId}` : `RCSB PDB · ${pdbId}`}
              </p>
            </div>
          </div>
        )}
        {status === 'error' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0d0f14', gap: '8px' }}>
            <span style={{ color: 'rgba(240,160,160,0.7)', fontSize: '12px' }}>Structure unavailable</span>
          </div>
        )}
        {status === 'ready' && (
          <>
            <div style={{ position: 'absolute', top: '8px', right: '10px', display: 'flex', gap: '6px' }}>
              {([
                { key: 'cartoon', label: 'Cartoon' },
                { key: 'surface', label: 'Surface' },
                ...(alphafoldId ? [{ key: 'confidence', label: 'pLDDT' }] : []),
              ] as const).map(mode => (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => setRenderMode(mode.key as 'cartoon' | 'surface' | 'confidence')}
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
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '9px', fontFamily: "'Inter', -apple-system, sans-serif", fontFeatureSettings: "'tnum' 1", background: 'rgba(0,0,0,0.45)', padding: '2px 6px', borderRadius: '8px' }}>
                {useAF ? `AF-${alphafoldId}` : pdbId}
              </span>
            </div>
            <div style={{ position: 'absolute', bottom: '8px', right: '10px' }}>
              <a href={useAF ? `https://alphafold.ebi.ac.uk/entry/${alphafoldId}` : `https://www.rcsb.org/structure/${pdbId}`}
                target="_blank" rel="noopener noreferrer"
                style={{ color: 'rgba(255,255,255,0.35)', fontSize: '9px', fontFamily: "'Inter', -apple-system, sans-serif", fontFeatureSettings: "'tnum' 1", display: 'flex', alignItems: 'center', gap: '3px', textDecoration: 'none', background: 'rgba(0,0,0,0.45)', padding: '2px 6px', borderRadius: '8px' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(200,232,240,0.9)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)'; }}>
                {useAF ? 'AlphaFold DB' : 'RCSB PDB'} <ExternalLink size={8} />
              </a>
            </div>
          </>
        )}
      </div>

      {alphafoldId && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', fontWeight: 500, margin: '0 0 2px' }}>AlphaFold pLDDT</p>
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: "'Inter', -apple-system, sans-serif", fontFeatureSettings: "'tnum' 1", margin: 0 }}>AI confidence coloring</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setSpinEnabled(!spinEnabled)}
              style={{ padding: '4px 8px', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.08)', background: spinEnabled ? 'rgba(255,255,255,0.1)' : 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: '9px', cursor: 'pointer' }}
            >
              {spinEnabled ? 'Auto spin' : 'Static'}
            </button>
            <button onClick={() => setUseAF(!useAF)}
              style={{ width: '34px', height: '18px', borderRadius: '9px', background: useAF ? '#A8C5DA' : 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px', left: useAF ? '19px' : '3px', transition: 'left 0.2s' }} />
            </button>
          </div>
        </div>
      )}

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

      <div style={{ padding: '10px 12px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: '10px', fontFamily: "'Inter', -apple-system, sans-serif", textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>
          Structure trace
        </p>
        <p style={{ color: 'rgba(255,255,255,0.68)', fontSize: '11px', lineHeight: 1.6, margin: '0 0 8px', fontFamily: "'Inter', -apple-system, sans-serif" }}>
          {traceText}
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ padding: '3px 8px', borderRadius: '999px', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.55)', fontSize: '9px', fontFamily: "'Inter', -apple-system, sans-serif" }}>
            source · {sourceLabel}
          </span>
          <span style={{ padding: '3px 8px', borderRadius: '999px', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.55)', fontSize: '9px', fontFamily: "'Inter', -apple-system, sans-serif" }}>
            mode · {renderMode}
          </span>
          <span style={{ padding: '3px 8px', borderRadius: '999px', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.55)', fontSize: '9px', fontFamily: "'Inter', -apple-system, sans-serif" }}>
            label · {label}
          </span>
        </div>
      </div>

      <p style={{ color: 'rgba(255,255,255,0.1)', fontSize: '9px', fontFamily: "'Inter', -apple-system, sans-serif", fontFeatureSettings: "'tnum' 1", margin: 0, textAlign: 'center' }}>
        Drag to rotate · {spinEnabled ? 'auto-spin on' : 'manual view'} · {renderMode === 'surface' ? 'surface envelope' : renderMode === 'confidence' ? 'confidence coloring' : 'cartoon fold'}
      </p>
    </div>
  );
}
