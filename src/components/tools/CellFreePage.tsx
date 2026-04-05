'use client';
import { useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import AlgorithmInsight from '../ide/shared/AlgorithmInsight';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import SimErrorBanner from '../ide/shared/SimErrorBanner';
import {
  runFullCFSPipeline,
  generateDefaultConstructs,
  generateDefaultParameters,
} from '../../services/CellFreeEngine';
import type {
  CFSFullResult,
  GeneConstruct,
  CFSParameters,
} from '../../services/CellFreeEngine';
import { T, TOOL_RESULT_PALETTE} from '../ide/tokens';

/* ── Design Tokens ────────────────────────────────────────────────── */

const PANEL_BG = '#000000';
const BORDER = 'rgba(255,255,255,0.06)';
const LABEL = 'rgba(255,255,255,0.45)';
const VALUE = 'rgba(255,255,255,0.65)';
const INPUT_BG = 'rgba(255,255,255,0.05)';
const INPUT_BORDER = 'rgba(255,255,255,0.08)';
const INPUT_TEXT = 'rgba(255,255,255,0.7)';
const GLASS: React.CSSProperties = {
  borderRadius: '24px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
};

const GENE_COLORS = ['#F0FDFA', '#5151CD', '#FA8072', '#FFFB1F', '#FF1FFF'];

type ViewMode = 'TimeCourse' | 'Resources' | 'Fitting' | 'IvIv' | 'Reactor3D';

/* ── Section Label ────────────────────────────────────────────────── */

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p style={{
    fontFamily: T.SANS, fontSize: '9px', textTransform: 'uppercase',
    letterSpacing: '0.1em', color: LABEL, margin: '0 0 10px',
  }}>
    {children}
  </p>
);

/* ── SVG Helpers ──────────────────────────────────────────────────── */

function GridLines({ W, H, PAD, count }: { W: number; H: number; PAD: number; count: number }) {
  return (
    <>
      {Array.from({ length: count + 1 }).map((_, i) => {
        const gx = PAD + (i / count) * (W - PAD * 2);
        const gy = PAD + (i / count) * (H - PAD * 2);
        return (
          <g key={i}>
            <line x1={gx} y1={PAD} x2={gx} y2={H - PAD} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
            <line x1={PAD} y1={gy} x2={W - PAD} y2={gy} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
          </g>
        );
      })}
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="rgba(255,255,255,0.1)" />
      <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="rgba(255,255,255,0.1)" />
    </>
  );
}

/* ── Time Course Chart ────────────────────────────────────────────── */

function TimeCourseChart({ result, constructs }: { result: CFSFullResult; constructs: GeneConstruct[] }) {
  const W = 520, H = 380, PAD = 44;
  const sim = result.simulation;

  const { tMax, pMax } = useMemo(() => {
    let tm = 0, pm = 0;
    sim.genes.forEach(g => {
      g.time.forEach(t => { if (t > tm) tm = t; });
      g.protein.forEach(p => { if (p > pm) pm = p; });
    });
    return { tMax: tm || 1, pMax: pm || 1 };
  }, [sim]);

  function sx(t: number) { return PAD + (t / tMax) * (W - PAD * 2); }
  function sy(p: number) { return H - PAD - (p / pMax) * (H - PAD * 2); }

  const ticks = 5;

  return (
    <svg role="img" aria-label="Chart" viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={H} fill="#050505" rx={12} />
      <GridLines W={W} H={H} PAD={PAD} count={8} />
      {/* X axis ticks */}
      {Array.from({ length: ticks + 1 }).map((_, i) => {
        const v = (tMax / ticks) * i;
        return (
          <text key={`xt${i}`} x={sx(v)} y={H - PAD + 14} textAnchor="middle"
            fontFamily={T.MONO} fontSize="7" fill={LABEL}>{Math.round(v)}</text>
        );
      })}
      {/* Y axis ticks */}
      {Array.from({ length: ticks + 1 }).map((_, i) => {
        const v = (pMax / ticks) * i;
        return (
          <text key={`yt${i}`} x={PAD - 6} y={sy(v) + 3} textAnchor="end"
            fontFamily={T.MONO} fontSize="7" fill={LABEL}>{v < 10 ? v.toFixed(1) : Math.round(v)}</text>
        );
      })}
      {/* Axis labels */}
      <text x={W / 2} y={H - 6} textAnchor="middle" fontFamily={T.MONO} fontSize="8" fill={LABEL}>
        Time (min)
      </text>
      <text x={12} y={H / 2} textAnchor="middle" fontFamily={T.MONO} fontSize="8" fill={LABEL}
        transform={`rotate(-90,12,${H / 2})`}>
        Protein (nM)
      </text>
      {/* Lines */}
      {sim.genes.map((g, gi) => {
        const color = constructs.find(c => c.id === g.geneId)?.color ?? GENE_COLORS[gi % GENE_COLORS.length];
        const pts = g.time.map((t, j) => `${sx(t)},${sy(g.protein[j])}`).join(' ');
        return <polyline key={g.geneId} points={pts} fill="none" stroke={color} strokeWidth={1.8} opacity={0.85} />;
      })}
      {/* Legend */}
      {sim.genes.map((g, gi) => {
        const color = constructs.find(c => c.id === g.geneId)?.color ?? GENE_COLORS[gi % GENE_COLORS.length];
        return (
          <g key={`l${gi}`} transform={`translate(${W - PAD - 110}, ${PAD + 8 + gi * 16})`}>
            <line x1={0} y1={0} x2={14} y2={0} stroke={color} strokeWidth={2} />
            <text x={18} y={3.5} fontFamily={T.SANS} fontSize="9" fill={VALUE}>{g.geneName}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── Resource Depletion Chart ─────────────────────────────────────── */

function ResourceChart({ result }: { result: CFSFullResult }) {
  const W = 520, H = 380, PAD = 44;
  const res = result.simulation.resources;

  const initials = useMemo(() => ({
    ribosomeFree: res.ribosomeFree[0] || 1,
    atp: res.atp[0] || 1,
    gtp: res.gtp[0] || 1,
    pep: res.pep[0] || 1,
    aminoAcids: res.aminoAcids[0] || 1,
  }), [res]);

  const tMax = res.time[res.time.length - 1] || 1;
  const depTime = result.simulation.energyDepletionTime;

  function sx(t: number) { return PAD + (t / tMax) * (W - PAD * 2); }
  function sy(f: number) { return H - PAD - f * (H - PAD * 2); }

  const series: { key: keyof typeof initials; label: string; color: string }[] = [
    { key: 'ribosomeFree', label: 'Ribosome (free)', color: '#F0FDFA' },
    { key: 'atp', label: 'ATP', color: '#FFFB1F' },
    { key: 'gtp', label: 'GTP', color: '#5151CD' },
    { key: 'pep', label: 'PEP', color: '#FA8072' },
    { key: 'aminoAcids', label: 'Amino Acids', color: '#FF1FFF' },
  ];

  return (
    <svg role="img" aria-label="Chart" viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={H} fill="#050505" rx={12} />
      <GridLines W={W} H={H} PAD={PAD} count={8} />
      {/* Y ticks */}
      {[0, 0.25, 0.5, 0.75, 1].map(v => (
        <text key={`yr${v}`} x={PAD - 6} y={sy(v) + 3} textAnchor="end"
          fontFamily={T.MONO} fontSize="7" fill={LABEL}>{v.toFixed(2)}</text>
      ))}
      {/* X ticks */}
      {Array.from({ length: 6 }).map((_, i) => {
        const v = (tMax / 5) * i;
        return (
          <text key={`xr${i}`} x={sx(v)} y={H - PAD + 14} textAnchor="middle"
            fontFamily={T.MONO} fontSize="7" fill={LABEL}>{Math.round(v)}</text>
        );
      })}
      <text x={W / 2} y={H - 6} textAnchor="middle" fontFamily={T.MONO} fontSize="8" fill={LABEL}>
        Time (min)
      </text>
      <text x={12} y={H / 2} textAnchor="middle" fontFamily={T.MONO} fontSize="8" fill={LABEL}
        transform={`rotate(-90,12,${H / 2})`}>
        Fraction of Initial
      </text>
      {/* Energy depletion line */}
      {depTime > 0 && depTime < tMax && (
        <>
          <line x1={sx(depTime)} y1={PAD} x2={sx(depTime)} y2={H - PAD}
            stroke="rgba(255,100,80,0.5)" strokeWidth={1} strokeDasharray="4,3" />
          <text x={sx(depTime) + 4} y={PAD + 12} fontFamily={T.MONO} fontSize="7" fill="rgba(255,100,80,0.7)">
            Depletion
          </text>
        </>
      )}
      {/* Lines */}
      {series.map(s => {
        const raw = res[s.key];
        const init = initials[s.key];
        const pts = res.time.map((t, j) => `${sx(t)},${sy(Math.min(raw[j] / init, 1))}`).join(' ');
        return <polyline key={s.key} points={pts} fill="none" stroke={s.color} strokeWidth={1.5} opacity={0.8} />;
      })}
      {/* Legend */}
      {series.map((s, i) => (
        <g key={`lr${i}`} transform={`translate(${W - PAD - 120}, ${PAD + 8 + i * 14})`}>
          <line x1={0} y1={0} x2={12} y2={0} stroke={s.color} strokeWidth={2} />
          <text x={16} y={3.5} fontFamily={T.SANS} fontSize="8" fill={VALUE}>{s.label}</text>
        </g>
      ))}
    </svg>
  );
}

/* ── Fitting Chart ────────────────────────────────────────────────── */

function FittingChart({ result }: { result: CFSFullResult }) {
  const W = 520, H = 380, PAD = 44;
  const fit = result.fitting;

  if (!fit) {
    return (
      <svg role="img" aria-label="Chart" viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
        <rect width={W} height={H} fill="#050505" rx={12} />
        <text x={W / 2} y={H / 2} textAnchor="middle" fontFamily={T.SANS} fontSize="12" fill={LABEL}>
          No fitting data available
        </text>
      </svg>
    );
  }

  const curve = fit.fittedCurve;
  const cMax = Math.max(...curve.map(p => p.concentration), 1);
  const rMax = Math.max(...curve.map(p => p.rate), fit.vmax * 1.1, 1);

  const mainH = 280;
  const resH = 80;
  const resTop = mainH + 20;

  function sx(c: number) { return PAD + (c / cMax) * (W - PAD * 2); }
  function sy(r: number) { return PAD + (1 - r / rMax) * (mainH - PAD * 2); }

  const rMaxRes = Math.max(...fit.residuals.map(r => Math.abs(r)), 0.01);

  return (
    <svg role="img" aria-label="Chart" viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={H} fill="#050505" rx={12} />
      {/* Main plot grid */}
      {Array.from({ length: 9 }).map((_, i) => {
        const gx = PAD + (i / 8) * (W - PAD * 2);
        const gy = PAD + (i / 8) * (mainH - PAD * 2);
        return (
          <g key={i}>
            <line x1={gx} y1={PAD} x2={gx} y2={mainH - PAD} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
            <line x1={PAD} y1={gy} x2={W - PAD} y2={gy} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
          </g>
        );
      })}
      <line x1={PAD} y1={mainH - PAD} x2={W - PAD} y2={mainH - PAD} stroke="rgba(255,255,255,0.1)" />
      <line x1={PAD} y1={PAD} x2={PAD} y2={mainH - PAD} stroke="rgba(255,255,255,0.1)" />
      {/* Scatter data points with error bars */}
      {curve.filter((_, i) => i % 3 === 0).map((p, i) => (
        <g key={`dp${i}`}>
          <line x1={sx(p.concentration)} y1={sy(p.rate * 0.9)} x2={sx(p.concentration)} y2={sy(p.rate * 1.1)}
            stroke="rgba(147,203,82,0.4)" strokeWidth={1} />
          <circle cx={sx(p.concentration)} cy={sy(p.rate)} r={3}
            fill="rgba(147,203,82,0.8)" stroke="rgba(147,203,82,0.4)" strokeWidth={0.5} />
        </g>
      ))}
      {/* Fitted curve */}
      <polyline
        points={curve.map(p => `${sx(p.concentration)},${sy(p.rate)}`).join(' ')}
        fill="none" stroke="#F0FDFA" strokeWidth={1.8} opacity={0.85}
      />
      {/* Vmax line */}
      <line x1={PAD} y1={sy(fit.vmax)} x2={W - PAD} y2={sy(fit.vmax)}
        stroke="rgba(255,251,31,0.4)" strokeWidth={1} strokeDasharray="4,3" />
      <text x={W - PAD - 4} y={sy(fit.vmax) - 4} textAnchor="end"
        fontFamily={T.MONO} fontSize="7" fill="rgba(255,251,31,0.7)">Vmax={fit.vmax.toFixed(2)}</text>
      {/* Stats text */}
      <text x={PAD + 8} y={PAD + 14} fontFamily={T.MONO} fontSize="8" fill={VALUE}>
        Vmax={fit.vmax.toFixed(2)} [{fit.vmax_ci[0].toFixed(2)}, {fit.vmax_ci[1].toFixed(2)}]
      </text>
      <text x={PAD + 8} y={PAD + 26} fontFamily={T.MONO} fontSize="8" fill={VALUE}>
        Kd={fit.kd.toFixed(2)} [{fit.kd_ci[0].toFixed(2)}, {fit.kd_ci[1].toFixed(2)}]
      </text>
      <text x={PAD + 8} y={PAD + 38} fontFamily={T.MONO} fontSize="8" fill={VALUE}>
        R²={fit.r_squared.toFixed(4)}
      </text>
      {/* Axis labels */}
      <text x={W / 2} y={mainH - 4} textAnchor="middle" fontFamily={T.MONO} fontSize="8" fill={LABEL}>
        [DNA] (nM)
      </text>
      <text x={12} y={mainH / 2} textAnchor="middle" fontFamily={T.MONO} fontSize="8" fill={LABEL}
        transform={`rotate(-90,12,${mainH / 2})`}>
        Rate (nM/min)
      </text>
      {/* ── Residual plot ──────────────── */}
      <line x1={PAD} y1={resTop + resH / 2} x2={W - PAD} y2={resTop + resH / 2}
        stroke="rgba(255,255,255,0.1)" strokeWidth={0.5} />
      <line x1={PAD} y1={resTop} x2={PAD} y2={resTop + resH}
        stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
      {fit.residuals.map((r, i) => {
        const xp = PAD + (i / (fit.residuals.length - 1 || 1)) * (W - PAD * 2);
        const yp = resTop + resH / 2 - (r / rMaxRes) * (resH / 2 - 4);
        return (
          <circle key={`res${i}`} cx={xp} cy={yp} r={2}
            fill={r > 0 ? 'rgba(147,203,82,0.6)' : 'rgba(255,100,80,0.6)'} />
        );
      })}
      <text x={PAD + 4} y={resTop + 10} fontFamily={T.MONO} fontSize="7" fill={LABEL}>Residuals</text>
    </svg>
  );
}

/* ── IvIv Chart ───────────────────────────────────────────────────── */

function IvIvChart({ result }: { result: CFSFullResult }) {
  const W = 520, H = 380, PAD = 44;
  const iviv = result.iviv;
  const sim = result.simulation;

  if (!iviv) {
    return (
      <svg role="img" aria-label="Chart" viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
        <rect width={W} height={H} fill="#050505" rx={12} />
        <text x={W / 2} y={H / 2} textAnchor="middle" fontFamily={T.SANS} fontSize="12" fill={LABEL}>
          IvIv prediction unavailable — fitting required
        </text>
      </svg>
    );
  }

  const invitro = sim.steadyState[0]?.maxProtein ?? 0;
  const invivo = iviv.invivo_expression;
  const barMax = Math.max(invitro, invivo, 1) * 1.2;

  const barW = 60;
  const barGap = 80;
  const barBaseY = H - PAD - 40;
  const barTopY = PAD + 20;
  const barRange = barBaseY - barTopY;

  const corrTop = PAD + 10;
  const corrLeft = W / 2 + 30;
  const corrBarW = 140;

  function barH(v: number) { return (v / barMax) * barRange; }

  const confAngle = iviv.confidence * 180;

  return (
    <svg role="img" aria-label="Chart" viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <rect width={W} height={H} fill="#050505" rx={12} />
      {/* Bar chart */}
      <rect x={PAD + 40} y={barBaseY - barH(invitro)} width={barW} height={barH(invitro)}
        fill="#5151CD" rx={4} opacity={0.8} />
      <text x={PAD + 40 + barW / 2} y={barBaseY + 14} textAnchor="middle"
        fontFamily={T.SANS} fontSize="9" fill={VALUE}>In vitro</text>
      <text x={PAD + 40 + barW / 2} y={barBaseY - barH(invitro) - 6} textAnchor="middle"
        fontFamily={T.MONO} fontSize="8" fill={VALUE}>{invitro.toFixed(1)} nM</text>

      <rect x={PAD + 40 + barW + barGap} y={barBaseY - barH(invivo)} width={barW} height={barH(invivo)}
        fill="#F0FDFA" rx={4} opacity={0.8} />
      <text x={PAD + 40 + barW + barGap + barW / 2} y={barBaseY + 14} textAnchor="middle"
        fontFamily={T.SANS} fontSize="9" fill={VALUE}>In vivo (pred)</text>
      <text x={PAD + 40 + barW + barGap + barW / 2} y={barBaseY - barH(invivo) - 6} textAnchor="middle"
        fontFamily={T.MONO} fontSize="8" fill={VALUE}>{invivo.toFixed(1)} nM</text>

      {/* Baseline */}
      <line x1={PAD + 20} y1={barBaseY} x2={PAD + 40 + barW * 2 + barGap + 20} y2={barBaseY}
        stroke="rgba(255,255,255,0.1)" strokeWidth={0.5} />

      {/* Correction factor bars */}
      <text x={corrLeft} y={corrTop} fontFamily={T.SANS} fontSize="9" fill={VALUE} fontWeight={600}>
        Correction Factors
      </text>
      {iviv.corrections.map((c, i) => {
        const adjMax = Math.max(...iviv.corrections.map(x => Math.abs(x.adjustment)), 0.1);
        const bw = (Math.abs(c.adjustment) / adjMax) * corrBarW;
        const y = corrTop + 18 + i * 22;
        const positive = c.adjustment >= 0;
        return (
          <g key={`cf${i}`}>
            <text x={corrLeft} y={y + 4} fontFamily={T.SANS} fontSize="7" fill={LABEL}>{c.factor}</text>
            <rect x={corrLeft} y={y + 8} width={bw} height={8}
              fill={positive ? 'rgba(147,203,82,0.5)' : 'rgba(255,100,80,0.5)'} rx={2} />
            <text x={corrLeft + bw + 4} y={y + 16} fontFamily={T.MONO} fontSize="7"
              fill={positive ? 'rgba(147,203,82,0.8)' : 'rgba(255,100,80,0.8)'}>
              {c.adjustment > 0 ? '+' : ''}{c.adjustment.toFixed(2)}
            </text>
          </g>
        );
      })}

      {/* Confidence gauge */}
      {(() => {
        const cx = corrLeft + corrBarW / 2;
        const cy = H - PAD - 30;
        const r = 32;
        const startAngle = Math.PI;
        const endAngle = Math.PI + (confAngle * Math.PI) / 180;
        const x1 = cx + r * Math.cos(startAngle);
        const y1 = cy + r * Math.sin(startAngle);
        const x2 = cx + r * Math.cos(endAngle);
        const y2 = cy + r * Math.sin(endAngle);
        const largeArc = confAngle > 90 ? 1 : 0;
        return (
          <g>
            <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
              fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
            <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
              fill="none" stroke="#F0FDFA" strokeWidth={6} strokeLinecap="round" />
            <text x={cx} y={cy - 4} textAnchor="middle" fontFamily={T.MONO} fontSize="14" fontWeight={700} fill={VALUE}>
              {(iviv.confidence * 100).toFixed(0)}%
            </text>
            <text x={cx} y={cy + 10} textAnchor="middle" fontFamily={T.SANS} fontSize="7" fill={LABEL}>
              Confidence
            </text>
          </g>
        );
      })()}
    </svg>
  );
}

function ReactorTwin3D({ result, constructs, params }: { result: CFSFullResult; constructs: GeneConstruct[]; params: CFSParameters }) {
  const steadyMap = useMemo(
    () => Object.fromEntries(result.simulation.steadyState.map(entry => [entry.geneId, entry])),
    [result.simulation.steadyState],
  );
  const maxYield = Math.max(...result.simulation.steadyState.map(entry => entry.maxProtein), 1);
  const energyPool = params.initialEnergy.atp + params.initialEnergy.gtp + params.initialEnergy.pep;
  const depletionRatio = Math.min(1, result.simulation.energyDepletionTime / params.simulationTime);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '420px', borderRadius: '18px', overflow: 'hidden', border: `1px solid ${BORDER}`, background: '#050505', position: 'relative' }}>
      <Canvas camera={{ position: [0, 5.5, 12], fov: 45 }}>
        <color attach="background" args={['#050505']} />
        <ambientLight intensity={0.72} />
        <directionalLight position={[6, 8, 7]} intensity={1.0} />
        <pointLight position={[-4, 4, 2]} intensity={0.45} color="#5151CD" />
        <gridHelper args={[18, 12, '#1f1f1f', '#111111']} position={[0, -2.1, 0]} />

        <mesh position={[0, -1.1, 0]}>
          <cylinderGeometry args={[2.8, 2.8, 2.3, 40, 1, true]} />
          <meshStandardMaterial color="#111111" transparent opacity={0.35} metalness={0.15} roughness={0.55} />
        </mesh>
        <mesh position={[0, -0.35 + depletionRatio * 0.65, 0]}>
          <cylinderGeometry args={[2.4, 2.4, Math.max(0.45, depletionRatio * 1.4), 36]} />
          <meshStandardMaterial color="#93CB52" emissive="#93CB52" emissiveIntensity={0.12} transparent opacity={0.42} />
        </mesh>

        {constructs.map((construct, index) => {
          const steady = steadyMap[construct.id];
          const normalized = steady ? steady.maxProtein / maxYield : 0.15;
          const height = 0.8 + normalized * 2.8;
          const x = -3.8 + index * 1.9;
          return (
            <group key={construct.id} position={[x, -0.6 + height / 2, 3.4]}>
              <mesh>
                <boxGeometry args={[0.9, height, 0.9]} />
                <meshStandardMaterial color={GENE_COLORS[index % GENE_COLORS.length]} emissive={GENE_COLORS[index % GENE_COLORS.length]} emissiveIntensity={0.18} />
              </mesh>
              <mesh position={[0, height / 2 + 0.2, 0]}>
                <sphereGeometry args={[0.12, 10, 10]} />
                <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.2} />
              </mesh>
            </group>
          );
        })}

        {[
          { label: 'ATP', value: params.initialEnergy.atp / energyPool, x: 4.2, z: -1.4, color: '#FFFB1F' },
          { label: 'GTP', value: params.initialEnergy.gtp / energyPool, x: 5.3, z: -1.4, color: '#FF8B1F' },
          { label: 'PEP', value: params.initialEnergy.pep / energyPool, x: 6.4, z: -1.4, color: '#FA8072' },
        ].map(res => (
          <mesh key={res.label} position={[res.x, -1.6 + res.value * 1.8, res.z]}>
            <boxGeometry args={[0.55, Math.max(0.35, res.value * 3), 0.55]} />
            <meshStandardMaterial color={res.color} emissive={res.color} emissiveIntensity={0.18} />
          </mesh>
        ))}

        <OrbitControls enablePan={false} minDistance={8} maxDistance={20} />
      </Canvas>

      <div style={{ position: 'absolute', top: '10px', left: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ padding: '3px 8px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', color: VALUE, fontSize: '9px', fontFamily: T.MONO }}>
          Center tank = active reaction volume
        </span>
        <span style={{ padding: '3px 8px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', color: VALUE, fontSize: '9px', fontFamily: T.MONO }}>
          Towers = construct yield
        </span>
      </div>
      <div style={{ position: 'absolute', top: '10px', right: '12px', width: 'min(260px, calc(100% - 24px))' }}>
        <div style={{ padding: '10px 12px', borderRadius: '14px', border: `1px solid ${BORDER}`, background: 'rgba(0,0,0,0.56)', backdropFilter: 'blur(10px)' }}>
          <p style={{ margin: '0 0 6px', color: LABEL, fontSize: '9px', fontFamily: T.MONO, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Evidence trace
          </p>
          <p style={{ margin: '0 0 8px', color: VALUE, fontSize: '10px', lineHeight: 1.55, fontFamily: T.SANS }}>
            Reactor 3D binds the simulated TX-TL state to one scene: depletion timing drives tank fill, gene yield drives tower height, and ATP/GTP/PEP are kept visible as explicit resource assumptions.
          </p>
          <div style={{ display: 'grid', gap: '6px' }}>
            <span style={{ padding: '3px 8px', borderRadius: '999px', background: 'rgba(255,255,255,0.05)', color: VALUE, fontSize: '9px', fontFamily: T.MONO }}>
              depletion · {result.simulation.energyDepletionTime.toFixed(0)} min
            </span>
            <span style={{ padding: '3px 8px', borderRadius: '999px', background: 'rgba(255,255,255,0.05)', color: VALUE, fontSize: '9px', fontFamily: T.MONO }}>
              total yield · {result.simulation.totalProteinYield.toFixed(1)} nM
            </span>
            <span style={{ padding: '3px 8px', borderRadius: '999px', background: 'rgba(255,255,255,0.05)', color: VALUE, fontSize: '9px', fontFamily: T.MONO }}>
              energy pool · {(params.initialEnergy.atp + params.initialEnergy.gtp + params.initialEnergy.pep).toFixed(1)} mM
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────────── */

export default function CellFreePage() {
  const constructs = useMemo(() => generateDefaultConstructs(), []);
  const params = useMemo(() => generateDefaultParameters(), []);
  const { data: result, error: simError } = useMemo(() => {
    try { return { data: runFullCFSPipeline(constructs, params), error: null as string | null }; }
    catch (e) { return { data: runFullCFSPipeline([], generateDefaultParameters()), error: e instanceof Error ? e.message : 'CFS pipeline failed' }; }
  }, [constructs, params]);

  const [viewMode, setViewMode] = useState<ViewMode>('TimeCourse');

  const sim = result.simulation;
  const fit = result.fitting;
  const iviv = result.iviv;

  const exportData = useMemo(() => {
    const rows: Record<string, unknown>[] = [];
    sim.genes.forEach(g => {
      g.time.forEach((t, i) => {
        rows.push({ gene: g.geneName, time: t, protein: g.protein[i], mRNA: g.mRNA[i] });
      });
    });
    return rows;
  }, [sim]);

  return (
    <>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: PANEL_BG }}>
        <AlgorithmInsight
          title="Cell-Free Sandbox (CFPS)"
          description="Resource-aware TX-TL ODE simulation → plate-reader Michaelis-Menten fitting → in-vitro-to-in-vivo translation prediction"
          formula="dP/dt = k_tl · [mRNA] · R_free / (K_tl + R_free)"
        />

        {simError && (
          <div style={{ padding: '0 16px 8px' }}><SimErrorBanner message={simError} /></div>
        )}

        <div className="nb-tool-panels" style={{ flex: 1 }}>

          {/* ── LEFT SIDEBAR (240px) ──────────────────────────────── */}
          <div style={{
            width: '240px', flexShrink: 0, overflowY: 'auto', padding: '16px',
            borderRight: `1px solid ${BORDER}`, background: PANEL_BG,
          }}>
            {/* Gene Constructs */}
            <SectionLabel>Gene Constructs</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {constructs.map((g, i) => (
                <div key={g.id} style={{ ...GLASS, borderRadius: '14px', padding: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <span style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: GENE_COLORS[i % GENE_COLORS.length], flexShrink: 0,
                    }} />
                    <span style={{ fontFamily: T.SANS, fontSize: '10px', fontWeight: 600, color: VALUE }}>
                      {g.name.length > 20 ? g.name.slice(0, 20) + '…' : g.name}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span style={{ fontFamily: T.SANS, fontSize: '8px', color: LABEL }}>Promoter</span>
                    <span style={{ fontFamily: T.MONO, fontSize: '9px', color: VALUE }}>{g.promoter}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: T.SANS, fontSize: '8px', color: LABEL }}>DNA conc.</span>
                    <span style={{ fontFamily: T.MONO, fontSize: '9px', color: VALUE }}>{g.dnaConcentration} nM</span>
                  </div>
                </div>
              ))}
            </div>

            {/* View Mode */}
            <SectionLabel>View Mode</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '16px' }}>
              {(['TimeCourse', 'Resources', 'Fitting', 'IvIv', 'Reactor3D'] as ViewMode[]).map(mode => (
                <button aria-label="Action" key={mode} onClick={() => setViewMode(mode)} style={{
                  flex: '1 1 0', padding: '5px 0', borderRadius: '6px', cursor: 'pointer',
                  fontFamily: T.SANS, fontSize: '10px', border: 'none',
                  background: viewMode === mode ? 'rgba(255,255,255,0.12)' : INPUT_BG,
                  color: viewMode === mode ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.4)',
                }}>
                  {mode}
                </button>
              ))}
            </div>

            {/* Reaction Parameters */}
            <SectionLabel>Reaction Parameters</SectionLabel>
            <div style={{ ...GLASS, borderRadius: '14px', padding: '10px', marginBottom: '16px' }}>
              {[
                { label: 'Ribosome Total', value: `${params.ribosomeTotal} nM` },
                { label: 'RNAP Total', value: `${params.rnap_total} nM` },
                { label: 'Temperature', value: `${params.temperature} °C` },
                { label: 'Volume', value: `${params.reactionVolume} μL` },
                { label: 'Sim Time', value: `${params.simulationTime} min` },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontFamily: T.SANS, fontSize: '8px', color: LABEL }}>{item.label}</span>
                  <span style={{ fontFamily: T.MONO, fontSize: '9px', color: VALUE }}>{item.value}</span>
                </div>
              ))}
            </div>

            {/* Energy Status */}
            <SectionLabel>Energy Status</SectionLabel>
            <div style={{ ...GLASS, borderRadius: '14px', padding: '10px' }}>
              {[
                { label: 'ATP', value: `${params.initialEnergy.atp} mM` },
                { label: 'GTP', value: `${params.initialEnergy.gtp} mM` },
                { label: 'PEP', value: `${params.initialEnergy.pep} mM` },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontFamily: T.SANS, fontSize: '8px', color: LABEL }}>{item.label}</span>
                  <span style={{ fontFamily: T.MONO, fontSize: '9px', color: VALUE }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── CENTER ENGINE ────────────────────────────────────── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#050505' }}>
            {viewMode === 'TimeCourse' && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                <div style={{ width: '100%', maxWidth: '600px' }}>
                  <TimeCourseChart result={result} constructs={constructs} />
                </div>
              </div>
            )}
            {viewMode === 'Resources' && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                <div style={{ width: '100%', maxWidth: '600px' }}>
                  <ResourceChart result={result} />
                </div>
              </div>
            )}
            {viewMode === 'Fitting' && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                <div style={{ width: '100%', maxWidth: '600px' }}>
                  <FittingChart result={result} />
                </div>
              </div>
            )}
            {viewMode === 'IvIv' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', padding: '16px', gap: '16px' }}>
                <div style={{ width: '100%', maxWidth: '600px', margin: '0 auto' }}>
                  <IvIvChart result={result} />
                </div>
                {iviv && (
                  <div style={{ ...GLASS, borderRadius: '16px', padding: '14px 18px', maxWidth: '600px', margin: '0 auto', width: '100%' }}>
                    <p style={{ fontFamily: T.SANS, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: LABEL, margin: '0 0 6px' }}>
                      Reasoning
                    </p>
                    <p style={{ fontFamily: T.SANS, fontSize: '11px', color: VALUE, margin: 0, lineHeight: 1.6 }}>
                      {iviv.reasoning}
                    </p>
                  </div>
                )}
              </div>
            )}
            {viewMode === 'Reactor3D' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px', gap: '10px' }}>
                <div style={{ maxWidth: '760px', margin: '0 auto', width: '100%' }}>
                  <div style={{ padding: '8px 12px', borderRadius: '14px', border: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.04)' }}>
                    <p style={{ margin: '0 0 3px', color: VALUE, fontSize: '11px', fontFamily: T.SANS }}>
                      Reactor 3D turns the CFPS run into a digital twin: construct yield, energy pool and depletion timing are mapped into one spatial scene.
                    </p>
                    <p style={{ margin: 0, color: LABEL, fontSize: '9px', fontFamily: T.MONO }}>
                      center tank = resource state · rear towers = expression output · right bars = ATP / GTP / PEP allocation
                    </p>
                  </div>
                </div>
                <div style={{ flex: 1, minHeight: '420px', maxWidth: '760px', margin: '0 auto', width: '100%' }}>
                  <ReactorTwin3D result={result} constructs={constructs} params={params} />
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT PANEL (260px) ──────────────────────────────── */}
          <div style={{
            width: '260px', flexShrink: 0, overflowY: 'auto', padding: '16px',
            borderLeft: `1px solid ${BORDER}`, background: PANEL_BG,
          }}>
            {/* Simulation Summary */}
            <SectionLabel>Simulation Summary</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
              <MetricCard label="Total Yield" value={sim.totalProteinYield.toFixed(1)} unit="nM" highlight />
              <MetricCard label="Depletion" value={sim.energyDepletionTime.toFixed(0)} unit="min" />
              <MetricCard
                label="Resource Ltd"
                value={sim.isResourceLimited ? 'Yes' : 'No'}
                warning={sim.isResourceLimited ? 'Ribosomes saturated' : undefined}
              />
            </div>

            {/* Per-Gene Stats */}
            <SectionLabel>Per-Gene Stats</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
              {sim.steadyState.map((ss, i) => {
                const gene = constructs.find(c => c.id === ss.geneId);
                const color = GENE_COLORS[i % GENE_COLORS.length];
                return (
                  <div key={ss.geneId} style={{ ...GLASS, borderRadius: '10px', padding: '8px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <span style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: color, flexShrink: 0,
                      }} />
                      <span style={{ fontFamily: T.SANS, fontSize: '10px', fontWeight: 600, color: VALUE }}>
                        {gene ? (gene.name.length > 18 ? gene.name.slice(0, 18) + '…' : gene.name) : ss.geneId}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span style={{ fontFamily: T.SANS, fontSize: '8px', color: LABEL }}>Peak Protein</span>
                      <span style={{ fontFamily: T.MONO, fontSize: '9px', color: VALUE }}>{ss.maxProtein.toFixed(1)} nM</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span style={{ fontFamily: T.SANS, fontSize: '8px', color: LABEL }}>Time to Half</span>
                      <span style={{ fontFamily: T.MONO, fontSize: '9px', color: VALUE }}>{ss.timeToHalf.toFixed(0)} min</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: T.SANS, fontSize: '8px', color: LABEL }}>Yield/DNA</span>
                      <span style={{ fontFamily: T.MONO, fontSize: '9px', color: VALUE }}>{ss.yieldPerDNA.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Fitting Results */}
            {fit && (
              <>
                <SectionLabel>Fitting Results</SectionLabel>
                <div style={{ ...GLASS, borderRadius: '14px', padding: '10px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontFamily: T.SANS, fontSize: '8px', color: LABEL }}>Vmax</span>
                    <span style={{ fontFamily: T.MONO, fontSize: '9px', color: VALUE }}>{fit.vmax.toFixed(3)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontFamily: T.SANS, fontSize: '8px', color: LABEL }}>Kd</span>
                    <span style={{ fontFamily: T.MONO, fontSize: '9px', color: VALUE }}>{fit.kd.toFixed(3)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontFamily: T.SANS, fontSize: '8px', color: LABEL }}>R²</span>
                    <span style={{ fontFamily: T.MONO, fontSize: '9px', color: 'rgba(147,203,82,0.9)' }}>
                      {fit.r_squared.toFixed(4)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontFamily: T.SANS, fontSize: '8px', color: LABEL }}>Vmax CI</span>
                    <span style={{ fontFamily: T.MONO, fontSize: '8px', color: LABEL }}>
                      [{fit.vmax_ci[0].toFixed(2)}, {fit.vmax_ci[1].toFixed(2)}]
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: T.SANS, fontSize: '8px', color: LABEL }}>Kd CI</span>
                    <span style={{ fontFamily: T.MONO, fontSize: '8px', color: LABEL }}>
                      [{fit.kd_ci[0].toFixed(2)}, {fit.kd_ci[1].toFixed(2)}]
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* IvIv Prediction */}
            {iviv && (
              <>
                <SectionLabel>IvIv Prediction</SectionLabel>
                <div style={{ ...GLASS, borderRadius: '14px', padding: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontFamily: T.SANS, fontSize: '8px', color: LABEL }}>In-vivo Expr</span>
                    <span style={{ fontFamily: T.MONO, fontSize: '9px', color: VALUE }}>
                      {iviv.invivo_expression.toFixed(1)} nM
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontFamily: T.SANS, fontSize: '8px', color: LABEL }}>Scaling Factor</span>
                    <span style={{ fontFamily: T.MONO, fontSize: '9px', color: VALUE }}>
                      {iviv.scalingFactor.toFixed(3)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontFamily: T.SANS, fontSize: '8px', color: LABEL }}>Fold Change</span>
                    <span style={{ fontFamily: T.MONO, fontSize: '9px', color: VALUE }}>
                      {iviv.invivo_foldChange.toFixed(2)}×
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: T.SANS, fontSize: '8px', color: LABEL }}>Confidence</span>
                    <span style={{
                      fontFamily: T.MONO, fontSize: '9px',
                      color: iviv.confidence > 0.7 ? 'rgba(147,203,82,0.9)' : iviv.confidence > 0.4 ? 'rgba(255,139,31,0.85)' : 'rgba(255,100,80,0.85)',
                    }}>
                      {(iviv.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Bottom Export Bar ──────────────────────────────────── */}
        <div style={{
          borderTop: `1px solid ${BORDER}`, padding: '8px 16px',
          display: 'flex', gap: '8px', flexShrink: 0, background: PANEL_BG,
        }}>
          <ExportButton label="Export Simulation JSON" data={result} filename="cellfree-simulation" format="json" />
          <ExportButton label="Export Time Series CSV" data={exportData} filename="cellfree-timeseries" format="csv" />
        </div>
      </div>
    </>
  );
}
