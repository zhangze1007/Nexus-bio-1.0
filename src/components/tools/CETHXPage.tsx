'use client';
import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ToolShell, { TOOL_TOKENS as T } from './shared/ToolShell';
import ModuleCard from './shared/ModuleCard';
import TactileSlider from './shared/TactileSlider';
import MetricCard from '../ide/shared/MetricCard';
import ExportButton from '../ide/shared/ExportButton';
import DemoBanner from '../ide/shared/DemoBanner';
import { PATHWAY_STEPS, computeThermo } from '../../data/mockCETHX';
import type { PathwayKey } from '../../data/mockCETHX';
import { useToolStore } from '../../store/toolStore';
import { useUIStore } from '../../store/uiStore';

// ── Breathing Waterfall Chart ──────────────────────────────────────────

function BreathingWaterfall({ steps }: { steps: ReturnType<typeof computeThermo>['steps'] }) {
  const W = 520, H = 340, PAD = { top: 28, right: 24, bottom: 48, left: 56 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const minG = Math.min(0, ...steps.map(s => s.cumulative));
  const maxG = Math.max(0, ...steps.map(s => s.cumulative), ...steps.map(s => s.deltaG));
  const range = maxG - minG || 1;
  function yPos(v: number) { return PAD.top + innerH - ((v - minG) / range) * innerH; }
  const barW = Math.max(12, innerW / steps.length - 6);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      {/* Zero line */}
      <line x1={PAD.left} y1={yPos(0)} x2={W - PAD.right} y2={yPos(0)}
        stroke="rgba(255,255,255,0.08)" strokeWidth={1} />

      {/* Cumulative trace */}
      <motion.polyline
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        points={steps.map((s, i) => {
          const x = PAD.left + (i / steps.length) * innerW + barW / 2;
          return `${x},${yPos(s.cumulative)}`;
        }).join(' ')}
        fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} strokeDasharray="4 2"
      />

      {/* Breathing bars — each animates height independently */}
      {steps.map((step, i) => {
        const x = PAD.left + (i / steps.length) * innerW + 2;
        const isNeg = step.deltaG < 0;
        const color = step.atpYield > 0
          ? T.NEON
          : isNeg ? 'rgba(147,203,82,0.75)' : 'rgba(255,80,80,0.65)';
        const topY = Math.min(yPos(step.cumulative), yPos(step.cumulative - step.deltaG));
        const h = Math.abs(yPos(step.cumulative) - yPos(step.cumulative - step.deltaG));

        return (
          <motion.rect
            key={step.step + i}
            x={x}
            width={barW - 4}
            rx={3}
            fill={color}
            initial={{ y: yPos(0), height: 0, opacity: 0 }}
            animate={{
              y: topY,
              height: h,
              opacity: [0.55, 0.8, 0.55],
            }}
            transition={{
              y: { type: 'spring', stiffness: 200, damping: 25, delay: i * 0.06 },
              height: { type: 'spring', stiffness: 200, damping: 25, delay: i * 0.06 },
              opacity: {
                duration: 3,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: i * 0.15,
              },
            }}
          />
        );
      })}

      {/* Step labels */}
      {steps.map((step, i) => {
        const x = PAD.left + (i / steps.length) * innerW + barW / 2;
        return (
          <text key={'lbl' + i} x={x} y={H - 6} textAnchor="middle"
            fontFamily={T.MONO} fontSize="7" fill="rgba(255,255,255,0.2)"
            transform={`rotate(-40,${x},${H - 6})`}>
            {step.step.slice(0, 10)}
          </text>
        );
      })}

      {/* Y-axis ticks */}
      {[-40, -20, 0, 20].map(v => v >= minG && v <= maxG ? (
        <g key={v}>
          <line x1={PAD.left - 4} y1={yPos(v)} x2={PAD.left} y2={yPos(v)} stroke="rgba(255,255,255,0.08)" />
          <text x={PAD.left - 8} y={yPos(v) + 3} textAnchor="end" fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.2)">
            {v}
          </text>
        </g>
      ) : null)}

      <text x={10} y={H / 2} textAnchor="middle" fontFamily={T.MONO} fontSize="8" fill="rgba(255,255,255,0.15)"
        transform={`rotate(-90,10,${H / 2})`}>ΔG (kJ/mol)</text>

      {/* Legend */}
      {[
        { color: 'rgba(147,203,82,0.75)', label: 'Exergonic' },
        { color: 'rgba(255,80,80,0.65)', label: 'Endergonic' },
        { color: T.NEON, label: 'ATP step' },
      ].map((l, i) => (
        <g key={l.label} transform={`translate(${PAD.left + i * 100},${PAD.top - 14})`}>
          <rect width={10} height={8} rx={2} fill={l.color} opacity={0.7} />
          <text x={14} y={8} fontFamily={T.SANS} fontSize="8" fill="rgba(255,255,255,0.25)">{l.label}</text>
        </g>
      ))}
    </svg>
  );
}

// ── Pathway list ───────────────────────────────────────────────────────

const PATHWAYS: { id: PathwayKey; label: string; desc: string }[] = [
  { id: 'glycolysis', label: 'Glycolysis', desc: 'Glucose → 2 Pyruvate' },
  { id: 'tca',        label: 'TCA Cycle',  desc: 'Acetyl-CoA → CO₂ + energy' },
  { id: 'ppp',        label: 'Pentose ℙ',  desc: 'G6P → Ribose-5P + NADPH' },
];

// ── Main Page ──────────────────────────────────────────────────────────

export default function CETHXPage() {
  const [pathway, setPathway] = useState<PathwayKey>('glycolysis');
  const [tempC, setTempC] = useState(37);
  const [pH, setPH] = useState(7.4);

  const thermo = useMemo(() =>
    computeThermo(PATHWAY_STEPS[pathway], tempC, pH),
    [pathway, tempC, pH]
  );

  // Sync to global store
  const setCETHX = useToolStore(s => s.setCETHX);
  useEffect(() => {
    setCETHX({
      pathway, tempC, pH,
      gibbsTotal: thermo.gibbs_free_energy,
      atpYield: thermo.atp_yield,
      efficiency: thermo.efficiency,
      timestamp: Date.now(),
    });
  }, [thermo, pathway, tempC, pH, setCETHX]);

  // Console logging
  const appendConsole = useUIStore((s) => s.appendConsole);
  useEffect(() => {
    appendConsole({
      level: thermo.gibbs_free_energy < 0 ? 'info' : 'warn',
      module: 'CETHX',
      message: `Thermo — ${pathway} @ ${tempC}°C pH${pH} | ΔG'=${thermo.gibbs_free_energy.toFixed(1)} kJ/mol | ATP=${thermo.atp_yield.toFixed(1)} | η=${thermo.efficiency.toFixed(1)}%`,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thermo]);

  return (
    <ToolShell
      moduleId="cethx"
      title="Cell Thermodynamics Engine"
      description="ΔG° corrected via Van't Hoff — ATP/NADH tallied per pathway step"
      formula="ΔG' = ΔG° · (T/298) + ΔpH · RT·ln10"
      grid="'side main main' 'side steps metrics'"
      columns="240px 1fr 220px"
      rows="2fr 1fr"
      gap={6}
      footer={
        <>
          <DemoBanner context="Glycolysis / TCA / Pentose Phosphate thermodynamics" />
          <ExportButton label="Export JSON" data={thermo} filename="cethx-thermodynamics" format="json" />
          <ExportButton label="Export CSV" data={thermo.steps} filename="cethx-steps" format="csv" />
        </>
      }
    >
      {/* ── Sidebar: Pathway + Sliders ──────────────────────── */}
      <ModuleCard area="side" title="Parameters" active={true}>
        <div style={{ flex: 1, overflowY: 'auto', paddingTop: '4px' }}>
          {/* Pathway selector */}
          <div style={{ marginBottom: '16px' }}>
            {PATHWAYS.map(p => (
              <motion.button
                key={p.id}
                onClick={() => setPathway(p.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '8px 10px', marginBottom: '4px',
                  background: pathway === p.id ? `${T.NEON}08` : 'transparent',
                  border: pathway === p.id
                    ? `1px solid ${T.NEON}25`
                    : '1px solid rgba(255,255,255,0.03)',
                  borderRadius: '10px', cursor: 'pointer',
                }}
              >
                <span style={{
                  fontFamily: T.SANS, fontSize: '11px', fontWeight: 500,
                  color: pathway === p.id ? T.NEON : 'rgba(255,255,255,0.5)',
                  display: 'block',
                }}>
                  {p.label}
                </span>
                <span style={{
                  fontFamily: T.MONO, fontSize: '8px',
                  color: 'rgba(255,255,255,0.2)',
                }}>
                  {p.desc}
                </span>
              </motion.button>
            ))}
          </div>

          {/* TactileSliders */}
          <TactileSlider
            label="Temperature" value={tempC} min={20} max={60} step={1}
            unit="°C" onChange={setTempC}
          />
          <TactileSlider
            label="pH" value={pH} min={5.5} max={9.0} step={0.1}
            onChange={setPH} color="rgba(120,180,255,0.9)"
          />
        </div>
      </ModuleCard>

      {/* ── Center: Breathing Waterfall ─────────────────────── */}
      <ModuleCard area="main" flush>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px', background: 'rgba(0,0,0,0.4)',
        }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={pathway}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ width: '100%', maxWidth: '600px' }}
            >
              <BreathingWaterfall steps={thermo.steps} />
            </motion.div>
          </AnimatePresence>
        </div>
      </ModuleCard>

      {/* ── Bottom-left: Step breakdown ─────────────────────── */}
      <ModuleCard area="steps" title="Step Breakdown">
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {thermo.steps.map((s, i) => (
            <motion.div
              key={s.step + i}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, duration: 0.2 }}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '4px 0',
                borderBottom: '1px solid rgba(255,255,255,0.02)',
              }}
            >
              <span style={{
                fontFamily: T.SANS, fontSize: '9px',
                color: 'rgba(255,255,255,0.35)',
                maxWidth: '140px', overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {s.step}
              </span>
              <span style={{
                fontFamily: T.MONO, fontSize: '10px', fontWeight: 600,
                textAlign: 'right',
                color: s.deltaG < 0 ? 'rgba(147,203,82,0.85)' : 'rgba(255,80,80,0.75)',
              }}>
                {s.deltaG > 0 ? '+' : ''}{s.deltaG.toFixed(1)}
              </span>
            </motion.div>
          ))}
        </div>
      </ModuleCard>

      {/* ── Right: Metrics ──────────────────────────────────── */}
      <ModuleCard area="metrics" title="Thermodynamics">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <MetricCard label="Net ATP Yield" value={thermo.atp_yield} unit="mol/mol" highlight />
          <MetricCard label="NADH Yield" value={thermo.nadh_yield} unit="mol/mol" />
          <MetricCard label="ΔG Total" value={thermo.gibbs_free_energy} unit="kJ/mol" />
          <MetricCard label="Entropy" value={thermo.entropy_production.toFixed(3)} unit="kJ/mol/K" />

          {/* Efficiency gauge */}
          <div style={{
            marginTop: '8px', padding: '10px',
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.02)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontFamily: T.SANS, fontSize: '9px', color: T.LABEL }}>Efficiency</span>
              <motion.span
                key={thermo.efficiency}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  fontFamily: T.MONO, fontSize: '16px', fontWeight: 700,
                  color: thermo.efficiency > 50 ? T.NEON : 'rgba(255,139,31,0.9)',
                }}
              >
                {thermo.efficiency.toFixed(1)}%
              </motion.span>
            </div>
            <div style={{ width: '100%', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)' }}>
              <motion.div
                animate={{ width: `${Math.min(100, thermo.efficiency)}%` }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                style={{
                  height: '100%', borderRadius: '2px',
                  background: thermo.efficiency > 50
                    ? 'linear-gradient(90deg, #4A7CFF, #FF8B1F)'
                    : 'linear-gradient(90deg, rgba(255,49,49,0.4), rgba(255,49,49,0.9))',
                  boxShadow: thermo.efficiency > 50
                    ? '0 0 6px rgba(74,124,255,0.3), 0 0 6px rgba(255,139,31,0.3)'
                    : '0 0 6px rgba(255,49,49,0.3)',
                }}
              />
            </div>
          </div>
        </div>
      </ModuleCard>
    </ToolShell>
  );
}
