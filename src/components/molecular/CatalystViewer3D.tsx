'use client';

import { useRef, useState, useEffect } from 'react';
import { load3Dmol } from '../../hooks/use3Dmol';
import type { EnzymeStructure, CatalyticResidue } from '../../services/CatalystDesignerEngine';

/* ── Helpers ───────────────────────────────────────────────────── */

const ROLE_COLORS: Record<string, number> = {
  nucleophile: 0xe41a1c,
  acid_base: 0x377eb8,
  stabilizer: 0x4daf4a,
  oxyanion_hole: 0xff7f00,
  substrate_binding: 0xffdb13,
};

const ROLE_LABELS: Record<string, string> = {
  nucleophile: 'Nucleophile',
  acid_base: 'Acid-base',
  stabilizer: 'Stabilizer',
  oxyanion_hole: 'Oxyanion hole',
  substrate_binding: 'Substrate binding',
};

/** Interpolate green ↔ red based on binding quality (0 = terrible, 1 = perfect). */
function bindingColor(quality: number): number {
  const q = Math.max(0, Math.min(1, quality));
  const r = Math.round(255 * (1 - q));
  const g = Math.round(200 * q);
  return (r << 16) | (g << 8) | 0x40;
}

export function bindingColorCSS(quality: number): string {
  const q = Math.max(0, Math.min(1, quality));
  const r = Math.round(255 * (1 - q));
  const g = Math.round(200 * q);
  return `rgb(${r},${g},64)`;
}

/** Map Kd (µM) to a 0-1 binding quality. Lower Kd = better binding. */
export function kdToQuality(kd: number): number {
  // log-scale: Kd=0.1→1.0, Kd=10→0.5, Kd=1000→0.15, Kd=10000→0.0
  if (kd <= 0) return 1;
  return Math.max(0, Math.min(1, 1 - Math.log10(kd) / 4));
}

/* ── Exported types ────────────────────────────────────────────── */

export interface ResidueClickData {
  position: number;
  name: string;           // e.g. "Ser195"
  residueLetter: string;  // e.g. "S"
  isCatalytic: boolean;
  catalyticResidue?: CatalyticResidue;
  distanceToSubstrate?: number;
}

export interface CatalystViewer3DProps {
  enzyme: EnzymeStructure;
  renderMode: 'cartoon' | 'surface' | 'confidence';
  spinEnabled?: boolean;
  onResidueClick?: (data: ResidueClickData) => void;
  selectedResidue?: number | null;
  bindingQuality?: number;  // 0-1 from Kd, drives interaction line colors
  style?: React.CSSProperties;
}

/* ── 3-letter → 1-letter lookup ────────────────────────────────── */
const AA3TO1: Record<string, string> = {
  ALA:'A',ARG:'R',ASN:'N',ASP:'D',CYS:'C',GLU:'E',GLN:'Q',GLY:'G',
  HIS:'H',ILE:'I',LEU:'L',LYS:'K',MET:'M',PHE:'F',PRO:'P',SER:'S',
  THR:'T',TRP:'W',TYR:'Y',VAL:'V',
};

/* ── Component ─────────────────────────────────────────────────── */

export default function CatalystViewer3D({
  enzyme,
  renderMode,
  spinEnabled = true,
  onResidueClick,
  selectedResidue,
  bindingQuality = 0.3,
  style,
}: CatalystViewer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [useAlphaFold, setUseAlphaFold] = useState(false);
  const substrateAtomsRef = useRef<any[]>([]);

  const sourceLabel = useAlphaFold
    ? `AlphaFold · ${enzyme.uniprotId}`
    : enzyme.pdbId ? `PDB · ${enzyme.pdbId}` : `AlphaFold · ${enzyme.uniprotId}`;

  /* ── Build the full 3D scene ─────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!containerRef.current) return;
      setStatus('loading');
      substrateAtomsRef.current = [];

      try {
        await load3Dmol();
        if (cancelled) return;

        if (viewerRef.current) { try { viewerRef.current.clear(); } catch {} }
        containerRef.current.innerHTML = '';

        const viewer = window.$3Dmol.createViewer(containerRef.current, {
          backgroundColor: '0x0d0f14', antialias: true,
        });
        viewerRef.current = viewer;

        const shouldUseAF = useAlphaFold || !enzyme.pdbId;

        // ── Load enzyme structure ──
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

        // ── Apply base enzyme style ──
        viewer.setStyle({}, {});
        if (renderMode === 'surface') {
          viewer.setStyle({}, { cartoon: { color: shouldUseAF ? '#EAEAEA' : 'spectrum', thickness: 0.35 } });
          viewer.addSurface(window.$3Dmol.SurfaceType.VDW, { opacity: 0.55, color: shouldUseAF ? '#F0FDFA' : '#FFFFFF' });
        } else if (renderMode === 'confidence' && shouldUseAF) {
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
          viewer.setStyle({}, { cartoon: { color: shouldUseAF ? '#EAEAEA' : 'spectrum', thickness: 0.5 } });
        }

        // ── Highlight catalytic residues as sticks ──
        for (const res of enzyme.catalyticResidues) {
          const color = ROLE_COLORS[res.role] ?? 0x999999;
          viewer.addStyle(
            { resi: res.position, and: [{ not: { hetflag: true } }] },
            { stick: { color, radius: 0.18 } },
          );
        }

        // ── Load substrate from PubChem via proxy ──
        try {
          const subRes = await fetch(`/api/pubchem?name=${encodeURIComponent(enzyme.substrate)}`);
          if (subRes.ok) {
            const sdf = await subRes.text();
            if (sdf && sdf.length > 50) {
              const modelIdx = viewer.addModel(sdf, 'sdf');
              // Style substrate as ball-and-stick
              viewer.setStyle(
                { model: -1 },
                { stick: { colorscheme: 'greenCarbon', radius: 0.14 },
                  sphere: { colorscheme: 'greenCarbon', scale: 0.25 } },
              );
              // Collect substrate atom positions for distance line drawing
              const models = viewer.getModel(-1);
              if (models) {
                try {
                  const atoms = models.selectedAtoms({});
                  if (atoms && atoms.length > 0) {
                    substrateAtomsRef.current = atoms;
                  }
                } catch {}
              }
            }
          }
        } catch {
          // substrate is optional
        }

        // ── Draw interaction lines from catalytic residues to substrate ──
        drawInteractionLines(viewer, enzyme, bindingQuality, null);

        // ── Click handler ──
        viewer.setClickable({}, true, (atom: any) => {
          if (!atom || typeof atom.resi !== 'number') return;
          const pos = atom.resi;
          const resn = atom.resn || '';
          const letter = AA3TO1[resn.toUpperCase()] || '?';
          const name = `${resn}${pos}`;
          const catRes = enzyme.catalyticResidues.find(r => r.position === pos);
          if (onResidueClick) {
            onResidueClick({
              position: pos,
              name,
              residueLetter: letter,
              isCatalytic: !!catRes,
              catalyticResidue: catRes,
              distanceToSubstrate: catRes?.distanceToSubstrate,
            });
          }
        });

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

  /* ── Update highlight + interaction lines when selection or binding quality changes ── */
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || status !== 'ready') return;

    // Remove old labels and shapes
    viewer.removeAllLabels();
    viewer.removeAllShapes();

    // Re-highlight catalytic residues (sticks)
    for (const res of enzyme.catalyticResidues) {
      const color = ROLE_COLORS[res.role] ?? 0x999999;
      viewer.addStyle(
        { resi: res.position, and: [{ not: { hetflag: true } }] },
        { stick: { color, radius: 0.18 } },
      );
    }

    // Highlight selected residue with glow
    if (selectedResidue != null) {
      // Glow: large translucent sphere
      viewer.addStyle(
        { resi: selectedResidue, and: [{ not: { hetflag: true } }] },
        { sphere: { color: 0xffdb13, radius: 1.2, opacity: 0.25 } },
      );
      // Solid core
      viewer.addStyle(
        { resi: selectedResidue, and: [{ not: { hetflag: true } }] },
        { stick: { color: 0xffdb13, radius: 0.22 } },
      );

      // Label the selected residue
      const selAtoms = viewer.selectedAtoms({ resi: selectedResidue, atom: 'CA' });
      if (selAtoms && selAtoms.length > 0) {
        const ca = selAtoms[0];
        const resn = ca.resn || '';
        viewer.addLabel(`${resn}${selectedResidue}`, {
          position: { x: ca.x, y: ca.y, z: ca.z + 2 },
          backgroundColor: 'rgba(0,0,0,0.7)',
          fontColor: '#FFDB13',
          fontSize: 11,
          borderRadius: 4,
          padding: 3,
        });
      }
    }

    // Draw interaction lines
    drawInteractionLines(viewer, enzyme, bindingQuality, selectedResidue);

    viewer.render();
  }, [selectedResidue, bindingQuality, enzyme, status]);

  /* ── Spin toggle without full reload ─────────────────────────── */
  useEffect(() => {
    if (viewerRef.current && status === 'ready') {
      viewerRef.current.spin(spinEnabled ? 'y' : false, 0.5);
    }
  }, [spinEnabled, status]);

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      <div style={{
        position: 'relative', width: '100%', height: '100%', minHeight: 340,
        borderRadius: 20, overflow: 'hidden', background: '#0d0f14',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 2px 16px rgba(0,0,0,0.5)',
      }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 340 }} />

        {status === 'loading' && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', background: '#0d0f14', gap: 12,
          }}>
            <style>{`@keyframes cv3d-spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              border: '2px solid rgba(0,83,214,0.3)', borderTopColor: '#0053D6',
              animation: 'cv3d-spin 1s linear infinite',
            }} />
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, margin: 0, fontFamily: "'Inter', sans-serif" }}>
              Loading {enzyme.name}...
            </p>
          </div>
        )}

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

        {status === 'ready' && (
          <>
            <div style={{ position: 'absolute', top: 8, left: 10, pointerEvents: 'none' }}>
              <span style={{
                color: 'rgba(255,255,255,0.5)', fontSize: 9,
                background: 'rgba(0,0,0,0.45)', padding: '2px 6px', borderRadius: 8,
                fontFamily: "'Inter', sans-serif",
              }}>
                {sourceLabel}
              </span>
            </div>
            {/* Binding quality indicator bar */}
            <div style={{
              position: 'absolute', bottom: 8, left: 10, right: 10,
              height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)',
            }}>
              <div style={{
                height: '100%', borderRadius: 2,
                width: `${bindingQuality * 100}%`,
                background: bindingColorCSS(bindingQuality),
                transition: 'width 0.4s ease, background 0.4s ease',
              }} />
            </div>
          </>
        )}
      </div>

      {enzyme.pdbId && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '5px 10px', borderRadius: 10,
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
        }}>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontFamily: "'Inter', sans-serif" }}>
            AlphaFold
          </span>
          <button
            type="button"
            onClick={() => setUseAlphaFold(!useAlphaFold)}
            style={{
              width: 32, height: 16, borderRadius: 8,
              background: useAlphaFold ? '#A8C5DA' : 'rgba(255,255,255,0.1)',
              border: 'none', cursor: 'pointer', position: 'relative',
              transition: 'background 0.2s',
            }}
          >
            <div style={{
              width: 10, height: 10, borderRadius: '50%', background: '#fff',
              position: 'absolute', top: 3,
              left: useAlphaFold ? 19 : 3,
              transition: 'left 0.2s',
            }} />
          </button>
        </div>
      )}

      <p style={{
        color: 'rgba(255,255,255,0.08)', fontSize: 8, margin: 0, textAlign: 'center',
        fontFamily: "'Inter', sans-serif",
      }}>
        Click residue to inspect · drag to rotate · {sourceLabel}
      </p>
    </div>
  );
}

/* ── Draw H-bond / distance interaction lines ──────────────────── */

function drawInteractionLines(
  viewer: any,
  enzyme: EnzymeStructure,
  quality: number,
  selectedResidue: number | null,
) {
  // For each catalytic residue, draw a dashed line toward the substrate region
  // Color: green (strong) to red (weak) based on quality
  const col = bindingColor(quality);

  for (const res of enzyme.catalyticResidues) {
    // Get alpha-carbon of this residue
    const caAtoms = viewer.selectedAtoms({ resi: res.position, atom: 'CA' });
    if (!caAtoms || caAtoms.length === 0) continue;
    const ca = caAtoms[0];

    // Find closest hetflag atom (ligand/substrate) or another catalytic residue's CA
    // Use substrate atoms if available
    let targetAtom: any = null;
    const hetAtoms = viewer.selectedAtoms({ hetflag: true });
    if (hetAtoms && hetAtoms.length > 0) {
      // Find closest het atom
      let minDist = Infinity;
      for (const ha of hetAtoms) {
        const d = Math.sqrt((ca.x - ha.x) ** 2 + (ca.y - ha.y) ** 2 + (ca.z - ha.z) ** 2);
        if (d < minDist) { minDist = d; targetAtom = ha; }
      }
    }

    if (!targetAtom) continue;

    const dist = Math.sqrt(
      (ca.x - targetAtom.x) ** 2 +
      (ca.y - targetAtom.y) ** 2 +
      (ca.z - targetAtom.z) ** 2,
    );

    // Only draw if < 15 Å (reasonable interaction range)
    if (dist > 15) continue;

    const isSelected = selectedResidue === res.position;
    const lineColor = isSelected ? 0xffdb13 : col;
    const lineWidth = isSelected ? 2.5 : 1.5;

    viewer.addCylinder({
      start: { x: ca.x, y: ca.y, z: ca.z },
      end: { x: targetAtom.x, y: targetAtom.y, z: targetAtom.z },
      radius: 0.04 * (isSelected ? 1.6 : 1),
      color: lineColor,
      dashed: true,
      dashLength: 0.3,
      gapLength: 0.15,
      opacity: isSelected ? 0.9 : 0.5,
      fromCap: 1,
      toCap: 1,
    });

    // Distance label
    const mx = (ca.x + targetAtom.x) / 2;
    const my = (ca.y + targetAtom.y) / 2;
    const mz = (ca.z + targetAtom.z) / 2;
    viewer.addLabel(`${dist.toFixed(1)} Å`, {
      position: { x: mx, y: my, z: mz },
      backgroundColor: 'rgba(0,0,0,0.6)',
      fontColor: isSelected ? '#FFDB13' : bindingColorCSS(quality),
      fontSize: isSelected ? 10 : 8,
      borderRadius: 3,
      padding: 2,
    });
  }
}
