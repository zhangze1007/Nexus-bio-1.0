/**
 * Nexus-Bio — FBA (Flux Balance Analysis) Web Worker
 *
 * Offloads all heavy metabolic math from the main thread.
 * Runs Michaelis-Menten kinetics + simplified FBA at ~60 Hz tick.
 * Main thread INP stays ≤ 50ms.
 */

import type { SimParams, SimReadouts } from '../machines/metabolicMachine';

// ── Message types ──────────────────────────────────────────────────────

export type FBAWorkerIn =
  | { type: 'START';  params: SimParams; mode: 'simulating' | 'stress_test' | 'equilibrium' }
  | { type: 'UPDATE'; params: SimParams }
  | { type: 'STOP' };

export type FBAWorkerOut =
  | { type: 'TICK'; readouts: SimReadouts }
  | { type: 'EQUILIBRIUM_REACHED' }
  | { type: 'ERROR'; message: string };

// ── Internal state ─────────────────────────────────────────────────────

let intervalId: ReturnType<typeof setInterval> | null = null;
let currentParams: SimParams | null = null;
let currentMode: 'simulating' | 'stress_test' | 'equilibrium' = 'simulating';
let tick = 0;
let prevRate = 0;
let equilibriumCount = 0;

// ── Michaelis-Menten with temperature/pH correction ────────────────────

function michaelisRate(p: SimParams): number {
  const tempFactor = Math.exp(-((p.temperature - 37) ** 2) / 200);
  const phFactor   = Math.exp(-((p.pH - 7.4) ** 2) / 1.2);
  const vmax       = p.vmax * tempFactor * phFactor * (p.enzyme / 5);
  return (vmax * p.substrate) / (p.km + p.substrate);
}

// ── Simplified FBA: stoichiometric yield estimates ────────────────────

function computeFBA(p: SimParams, rate: number): Omit<SimReadouts, 'tick' | 'reactionRate'> {
  const baseAtp  = 2 + (p.substrate / 100) * 34;  // glycolysis + TCA
  const atpYield = baseAtp * (rate / (p.vmax + 0.01));

  const nadphRate = 0.6 * rate * (p.enzyme / 10);

  // Carbon efficiency: fraction of substrate carbon reaching product
  const carbonEfficiency = Math.min(
    100,
    50 + 40 * (rate / (p.vmax + 0.01)) * Math.exp(-((p.pH - 7.2) ** 2) / 2),
  );

  // Flux balance score: deviation from optimal steady state
  const optRate = michaelisRate({ ...p, substrate: p.km }); // v = Vmax/2 at Km
  const fluxBalance = 1 - Math.abs(rate - optRate) / (p.vmax + 0.01);

  // Stress index: heat shock + pH stress + substrate excess
  const heatStress  = Math.max(0, (p.temperature - 42) / 8);
  const phStress    = Math.max(0, Math.abs(p.pH - 7.4) - 0.5) / 2;
  const subStress   = Math.max(0, (p.substrate - 120) / 80);
  const stressIndex = Math.min(1, heatStress + phStress + subStress);

  return { atpYield, nadphRate, carbonEfficiency, fluxBalance, stressIndex };
}

// ── Stress test: apply random perturbation to params ──────────────────

function applyStress(p: SimParams): SimParams {
  const t = tick * 0.05;
  return {
    ...p,
    substrate:   p.substrate   * (1 + 0.15 * Math.sin(t)),
    temperature: p.temperature * (1 + 0.04 * Math.cos(t * 0.7)),
    pH:          p.pH          * (1 + 0.02 * Math.sin(t * 1.3)),
  };
}

// ── Simulation tick ────────────────────────────────────────────────────

function runTick() {
  if (!currentParams) return;
  tick++;

  const effectiveParams = currentMode === 'stress_test'
    ? applyStress(currentParams)
    : currentParams;

  const rate = michaelisRate(effectiveParams);
  const fba  = computeFBA(effectiveParams, rate);

  const readouts: SimReadouts = { reactionRate: rate, ...fba, tick };

  self.postMessage({ type: 'TICK', readouts } satisfies FBAWorkerOut);

  // Equilibrium detection: rate stable within 0.5% for 60 consecutive ticks
  if (currentMode === 'simulating') {
    const delta = Math.abs(rate - prevRate) / (prevRate + 0.0001);
    equilibriumCount = delta < 0.005 ? equilibriumCount + 1 : 0;
    if (equilibriumCount >= 60) {
      equilibriumCount = 0;
      self.postMessage({ type: 'EQUILIBRIUM_REACHED' } satisfies FBAWorkerOut);
    }
  }
  prevRate = rate;
}

// ── Message handler ────────────────────────────────────────────────────

self.onmessage = (e: MessageEvent<FBAWorkerIn>) => {
  const msg = e.data;

  if (msg.type === 'START') {
    currentParams = msg.params;
    currentMode   = msg.mode;
    tick = 0;
    prevRate = 0;
    equilibriumCount = 0;
    if (intervalId) clearInterval(intervalId);
    // 60 Hz tick on worker thread
    intervalId = setInterval(runTick, 1000 / 60);
    return;
  }

  if (msg.type === 'UPDATE') {
    currentParams = msg.params;
    return;
  }

  if (msg.type === 'STOP') {
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
    return;
  }
};
