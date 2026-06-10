/**
 * Nexus-Bio — Metabolic Kinetics Web Worker
 *
 * This worker provides real-time metabolic simulation using:
 * 1. Michaelis-Menten kinetics (client-side, 60Hz)
 * 2. Flux Balance Analysis (server-side, cached)
 *
 * Architecture:
 * - Local: Michaelis-Menten for real-time responsiveness
 * - Server: Simplex LP FBA for accurate flux analysis
 * - Cache: FBA results cached for 5 seconds to reduce API calls
 *
 * Offloads all heavy metabolic math from the main thread.
 * Runs Michaelis-Menten kinetics at ~60 Hz tick.
 * Main thread INP stays ≤ 50ms.
 */

import type { SimParams, SimReadouts } from '../machines/metabolicMachine';
import { michaelisRate } from '../utils/michaelisMenten';

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

// ── FBA Cache ──────────────────────────────────────────────────────────

interface FBACache {
  result: FBAReadouts | null;
  timestamp: number;
  params: string; // JSON serialized params for cache key
}

interface FBAReadouts {
  atpYield: number;
  carbonEfficiency: number;
  fluxBalance: number;
  shadowPrices?: Record<string, number>;
}

const fbaCache: FBACache = {
  result: null,
  timestamp: 0,
  params: '',
};

const FBA_CACHE_TTL = 5000; // 5 seconds cache
const FBA_API_ENDPOINT = '/api/fba';

/**
 * Fetch real FBA results from server with caching.
 * Returns cached result if available and fresh.
 */
async function fetchFBAResults(params: SimParams): Promise<FBAReadouts | null> {
  const now = Date.now();
  const paramsKey = JSON.stringify({
    substrate: params.substrate,
    temperature: params.temperature,
    pH: params.pH,
  });

  // Return cached result if fresh
  if (
    fbaCache.result &&
    fbaCache.params === paramsKey &&
    now - fbaCache.timestamp < FBA_CACHE_TTL
  ) {
    return fbaCache.result;
  }

  try {
    const response = await fetch(FBA_API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'single',
        species: 'ecoli',
        objective: 'biomass',
        glucoseUptake: params.substrate,
        oxygenUptake: 20, // Default oxygen uptake
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (!data.ok || !data.fluxes) {
      return null;
    }

    const result: FBAReadouts = {
      atpYield: data.atpYield ?? 0,
      carbonEfficiency: data.carbonEfficiency ?? 0,
      fluxBalance: data.fluxBalance ?? 0,
      shadowPrices: data.shadowPrices,
    };

    // Update cache
    fbaCache.result = result;
    fbaCache.timestamp = now;
    fbaCache.params = paramsKey;

    return result;
  } catch (error) {
    // Network error - return cached result if available
    return fbaCache.result;
  }
}

// ── Kinetic readouts with real FBA integration ────────────────────────
// This function tries to use real FBA results from the server,
// falling back to heuristic calculations if the server is unavailable.

async function computeKineticReadouts(
  p: SimParams,
  rate: number,
): Promise<Omit<SimReadouts, 'tick' | 'reactionRate'>> {
  // Try to get real FBA results from server
  const fbaResults = await fetchFBAResults(p);

  if (fbaResults) {
    // Use real FBA results
    return {
      atpYield: fbaResults.atpYield,
      nadphRate: 0.6 * rate * (p.enzyme / 10), // Still heuristic for NADPH
      carbonEfficiency: fbaResults.carbonEfficiency,
      fluxBalance: fbaResults.fluxBalance,
      stressIndex: computeStressIndex(p),
    };
  }

  // Fallback to heuristic calculations if FBA unavailable
  const baseAtp  = 2 + (p.substrate / 100) * 34;  // glycolysis + TCA
  const atpYield = baseAtp * (rate / (p.vmax + 0.01));

  const nadphRate = 0.6 * rate * (p.enzyme / 10);

  // Carbon efficiency: fraction of substrate carbon reaching product
  const carbonEfficiency = Math.min(
    100,
    50 + 40 * (rate / (p.vmax + 0.01)) * Math.exp(-((p.pH - 7.4) ** 2) / 2),
  );

  // Flux balance score: deviation from optimal steady state
  const optRate = michaelisRate({ ...p, substrate: p.km }); // v = Vmax/2 at Km
  const fluxBalance = 1 - Math.abs(rate - optRate) / (p.vmax + 0.01);

  return {
    atpYield,
    nadphRate,
    carbonEfficiency,
    fluxBalance,
    stressIndex: computeStressIndex(p),
  };
}

// ── Stress index calculation ─────────────────────────────────────────

function computeStressIndex(p: SimParams): number {
  const heatStress  = Math.max(0, (p.temperature - 42) / 8);
  const phStress    = Math.max(0, Math.abs(p.pH - 7.4) - 0.5) / 2;
  const subStress   = Math.max(0, (p.substrate - 120) / 80);
  return Math.min(1, heatStress + phStress + subStress);
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

// ── Simulation tick (async to support FBA API calls) ─────────────────

async function runTick() {
  if (!currentParams) return;
  tick++;

  const effectiveParams = currentMode === 'stress_test'
    ? applyStress(currentParams)
    : currentParams;

  const rate = michaelisRate(effectiveParams);
  const fba  = await computeKineticReadouts(effectiveParams, rate);

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
