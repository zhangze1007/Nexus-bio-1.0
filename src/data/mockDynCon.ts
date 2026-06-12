import type {
  ODEState,
  ControllerParams,
  HillParams,
  ConvergenceMetrics,
  RBSMapping,
  MetabolicBurdenResult,
} from '../types';

/**
 * DYNCON Engine — Fed-batch bioreactor + Hill-function feedback + PID control
 *
 * Biochemical Assumptions:
 * 1. Monod kinetics for microbial growth: μ = μmax·S/(Ks+S)·O/(Ko+O)
 * 2. Hill-function negative feedback: FPP concentration represses ADS expression
 *    f(FPP) = Vmax · Kd^n / (Kd^n + FPP^n) — cooperative repression
 * 3. Product formation is coupled to ADS expression × FPP availability
 * 4. Metabolic burden: heterologous protein expression diverts ribosomes
 *    from housekeeping genes, reducing growth rate proportionally
 * 5. Toxicity: FPP and product accumulation above thresholds inhibit growth
 * 6. RK4 integration for numerical stability at 0.5h timestep
 */

export const DEFAULT_CONTROLLER: ControllerParams = { kp: 2.0, ki: 0.5, kd: 0.1, setpoint: 0.4 };

export const DEFAULT_HILL: HillParams = {
  Vmax: 1.0,   // Max ADS expression (normalized)
  Kd: 50.0,    // FPP concentration at half-maximal repression (μM)
  n: 2.0,      // Hill coefficient — cooperative binding
};

export interface BioreactorParams {
  muMax: number;    // max growth rate h⁻¹
  Ks: number;       // substrate affinity constant g/L
  Ko: number;       // oxygen half-saturation constant mg/L (default 0.2 for E. coli)
  Yxs: number;      // biomass yield g/g
  Yps: number;      // product yield g/g
  kLa: number;      // oxygen transfer coefficient h⁻¹
  OstarSat: number; // O₂ saturation mg/L
  feedConc: number; // substrate feed concentration g/L
  feedRate: number; // feed rate L/h
  // Artemisinin pathway parameters
  kFPP: number;     // FPP synthesis rate constant (μM/h per g/L biomass)
  kADS: number;     // ADS catalytic rate (product formation, g/L per h per a.u. enzyme)
  fppDegradation: number; // FPP consumption/degradation (h⁻¹)
  // Toxicity thresholds
  fppToxicThreshold: number;    // μM — above this, growth inhibited
  productToxicThreshold: number;// g/L — product IC₅₀
  // Metabolic burden
  maxBurdenTolerance: number;   // Max protein expression before lethality (0–1)
}

export const DEFAULT_PARAMS: BioreactorParams = {
  muMax: 0.4,       // h⁻¹ — typical E. coli max growth rate (Varma & Palsson 1994, Appl Environ Microbiol 60:3724)
  Ks: 0.15,         // g/L — substrate affinity constant
  Ko: 0.2,          // mg/L — O₂ half-saturation constant (Varma & Palsson 1994)
  Yxs: 0.45,        // g/g — aerobic biomass yield on glucose (Varma & Palsson 1994)
  Yps: 0.38,        // g/g — product yield
  kLa: 0.015,       // h⁻¹ — volumetric oxygen transfer coefficient (tuned for simulation)
  OstarSat: 8,      // mg/L — dissolved O₂ saturation
  feedConc: 400,    // g/L — substrate feed concentration
  feedRate: 0.02,   // L/h — feed rate
  kFPP: 12.0,       // μM/h per g/L biomass — FPP synthesis rate
  kADS: 0.08,       // g/L per h per a.u. — ADS catalysis rate
  fppDegradation: 0.15,  // h⁻¹ — FPP consumption rate
  fppToxicThreshold: 120, // μM — FPP toxicity threshold (IC₅₀ model)
  productToxicThreshold: 25, // g/L — product IC₅₀
  maxBurdenTolerance: 0.6, // max protein expression before lethality
};

// ── Tunable simulation constants — exported for Advanced panel overrides ─────
// SPONTANEOUS_LOSS_RATE = 0.02 h⁻¹ — estimated plasmid/metabolite loss
// TODO: calibrate against experimental data
export const SPONTANEOUS_LOSS_RATE = 0.02;

// PROTEIN_TURNOVER_RATE = 0.3 h⁻¹ — Bentley et al. 1990, Biotechnol Bioeng 35:668
// Typical E. coli protein half-life ~2.3 h → k = ln(2)/2.3 ≈ 0.3 h⁻¹
export const PROTEIN_TURNOVER_RATE = 0.3;

// O2_CONSUMPTION_COEFF = 1.5 — tuned for simulation
// Typical E. coli: 10-20 mmol O₂/gDW/h (Varma & Palsson 1994, Appl Environ Microbiol 60:3724)
export const O2_CONSUMPTION_COEFF = 1.5;

// ── Hill Function: Negative feedback — FPP represses ADS expression ──────────
// f(FPP) = Vmax * Kd^n / (Kd^n + FPP^n)
// When FPP is high → ADS expression drops → less FPP consumed → homeostasis
export function hillFeedback(fpp: number, hill: HillParams): number {
  const { Vmax, Kd, n } = hill;
  if (fpp <= 0) return Vmax;
  return Vmax * (Kd ** n) / (Kd ** n + fpp ** n);
}

// ── Monod growth with toxicity + metabolic burden ────────────────────────────
function monodRate(
  S: number, O: number,
  fpp: number, product: number,
  adsExpr: number, p: BioreactorParams,
  burdenPenaltyCoeff = 0.4,
): { mu: number; toxicity: number; burden: number } {
  const muO = O > 0 ? O / (p.Ko + O) : 0;
  const muBase = p.muMax * (S / (p.Ks + S)) * muO;

  // Toxicity penalty: IC50 model — smooth sigmoid inhibition
  // f(x) = 1 / (1 + (x/IC50)^2) — no discontinuity at threshold
  const fppInhibition = 1 / (1 + (fpp / p.fppToxicThreshold) ** 2);
  const productInhibition = 1 / (1 + (product / p.productToxicThreshold) ** 2);
  const toxicity = 1 - fppInhibition * productInhibition;

  // Metabolic burden: protein expression costs growth
  // burdenPenalty factor = 0.4 — estimated, no direct literature source
  // Up to 40% growth reduction at max expression
  const burden = Math.min(1, adsExpr / p.maxBurdenTolerance);
  const burdenPenalty = Math.max(0, 1 - burden * burdenPenaltyCoeff);

  const mu = muBase * fppInhibition * productInhibition * burdenPenalty;
  return { mu, toxicity, burden };
}

// ── RK4 ODE derivatives ──────────────────────────────────────────────────────
interface State { X: number; S: number; P: number; O: number; FPP: number; ADS: number; V: number; }

export interface DynConOverrides {
  spontaneousLossRate?: number;
  o2ConsumptionCoeff?: number;
  burdenPenalty?: number;
}

function derivatives(
  s: State, airflowScale: number,
  p: BioreactorParams, hill: HillParams,
  overrides?: DynConOverrides,
): State {
  const spontaneousLossRate = overrides?.spontaneousLossRate ?? SPONTANEOUS_LOSS_RATE;
  const o2ConsumptionCoeff = overrides?.o2ConsumptionCoeff ?? O2_CONSUMPTION_COEFF;
  const burdenPenaltyCoeff = overrides?.burdenPenalty ?? 0.4;
  const { mu } = monodRate(s.S, s.O, s.FPP, s.P, s.ADS, p, burdenPenaltyCoeff);

  // Dilution factor: D = F/V — accounts for volume expansion in fed-batch
  const dilution = p.feedRate / s.V;

  // Volume dynamics: dV/dt = feedRate (fed-batch expansion)
  const dV = p.feedRate;

  // Biomass with dilution: growth minus washout
  const dX = mu * s.X - dilution * s.X;
  // Substrate: consumption for growth, replenished by feed with volume correction
  const dS = p.feedRate * (p.feedConc - s.S) / s.V - dX / p.Yxs;
  // FPP intermediate: produced proportional to biomass, consumed by ADS, diluted
  const dFPP = p.kFPP * s.X - s.ADS * s.FPP * p.fppDegradation - s.FPP * spontaneousLossRate - dilution * s.FPP;
  // ADS expression: Hill-function feedback from FPP
  const adsTarget = hillFeedback(s.FPP, hill);
  const dADS = (adsTarget - s.ADS) * PROTEIN_TURNOVER_RATE;
  // Product: formed by ADS enzyme acting on FPP, diluted by feed
  const dP = p.kADS * s.ADS * s.FPP - dilution * s.P;
  // Dissolved O₂
  const dO = p.kLa * airflowScale * (p.OstarSat - s.O) - mu * s.X * o2ConsumptionCoeff;

  return { X: dX, S: dS, P: dP, O: dO, FPP: dFPP, ADS: dADS, V: dV };
}

function addState(a: State, b: State, scale: number): State {
  return {
    X: a.X + b.X * scale,
    S: a.S + b.S * scale,
    P: a.P + b.P * scale,
    O: a.O + b.O * scale,
    FPP: a.FPP + b.FPP * scale,
    ADS: a.ADS + b.ADS * scale,
    V: a.V + b.V * scale,
  };
}

function clampState(s: State, p: BioreactorParams): State {
  return {
    X: Math.max(0, s.X),
    S: Math.max(0, s.S),
    P: Math.max(0, s.P),
    O: Math.max(0, Math.min(p.OstarSat * 1.2, s.O)),
    FPP: Math.max(0, s.FPP),
    ADS: Math.max(0, Math.min(2.0, s.ADS)), // Cap at 2× baseline
    V: Math.max(0.1, s.V), // Volume cannot go below 0.1 L
  };
}

// ── Main bioreactor simulation with RK4 integration ──────────────────────────
export function runBioreactor(
  controller: ControllerParams,
  params: BioreactorParams = DEFAULT_PARAMS,
  steps = 100,
  dt = 1.0,
  hill: HillParams = DEFAULT_HILL,
  overrides?: DynConOverrides,
): ODEState[] {
  const states: ODEState[] = [];
  let state: State = { X: 0.5, S: 20.0, P: 0.0, O: params.OstarSat, FPP: 10.0, ADS: hill.Vmax * 0.8, V: 2.0 };
  let integral = 0;
  let prevMeasurement = state.O / params.OstarSat; // for derivative-on-measurement

  for (let i = 0; i < steps; i++) {
    // PID controller on dissolved O₂ — recomputed at each RK4 sub-step
    // Derivative-on-measurement: avoids derivative kick on setpoint changes
    const calcAirflow = (s: State) => {
      const measurement = s.O / params.OstarSat;
      const e = controller.setpoint - measurement;
      // Derivative acts on -dMeasurement/dt (negative sign for correct direction)
      const derivative = -(measurement - prevMeasurement) / dt;
      return Math.max(0, Math.min(3,
        1 + controller.kp * e + controller.ki * integral + controller.kd * derivative
      ));
    };

    // RK4 integration with PID recomputed at each sub-step
    const k1 = derivatives(state, calcAirflow(state), params, hill, overrides);
    const s2 = clampState(addState(state, k1, dt / 2), params);
    const k2 = derivatives(s2, calcAirflow(s2), params, hill, overrides);
    const s3 = clampState(addState(state, k2, dt / 2), params);
    const k3 = derivatives(s3, calcAirflow(s3), params, hill, overrides);
    const s4 = clampState(addState(state, k3, dt), params);
    const k4 = derivatives(s4, calcAirflow(s4), params, hill, overrides);

    // Update PID state after RK4 step
    const currentMeasurement = state.O / params.OstarSat;
    const err = controller.setpoint - currentMeasurement;
    integral += err * dt;
    integral = Math.max(-5, Math.min(5, integral)); // Anti-windup
    prevMeasurement = currentMeasurement;

    state = clampState({
      X:   state.X   + (dt / 6) * (k1.X   + 2 * k2.X   + 2 * k3.X   + k4.X),
      S:   state.S   + (dt / 6) * (k1.S   + 2 * k2.S   + 2 * k3.S   + k4.S),
      P:   state.P   + (dt / 6) * (k1.P   + 2 * k2.P   + 2 * k3.P   + k4.P),
      O:   state.O   + (dt / 6) * (k1.O   + 2 * k2.O   + 2 * k3.O   + k4.O),
      FPP: state.FPP + (dt / 6) * (k1.FPP + 2 * k2.FPP + 2 * k3.FPP + k4.FPP),
      ADS: state.ADS + (dt / 6) * (k1.ADS + 2 * k2.ADS + 2 * k3.ADS + k4.ADS),
      V:   state.V   + (dt / 6) * (k1.V   + 2 * k2.V   + 2 * k3.V   + k4.V),
    }, params);

    const { toxicity, burden } = monodRate(state.S, state.O, state.FPP, state.P, state.ADS, params, overrides?.burdenPenalty ?? 0.4);

    states.push({
      time: (i + 1) * dt,
      biomass: state.X,
      substrate: state.S,
      product: state.P,
      dissolvedO2: state.O / params.OstarSat,
      fpp: state.FPP,
      adsExpression: state.ADS,
      toxicity,
      volume: state.V,
      metabolicBurden: burden,
    });
  }
  return states;
}

// ── Convergence Rate Analysis ────────────────────────────────────────────────
export function analyzeConvergence(
  trajectory: ODEState[],
  setpoint: number,
): ConvergenceMetrics {
  if (trajectory.length < 5) {
    return { settlingTime: Infinity, overshoot: 0, steadyStateError: 0, convergenceRate: 0, oscillationCount: 0, isStable: false };
  }

  const doValues = trajectory.map(t => t.dissolvedO2);
  const errors = doValues.map(v => v - setpoint);

  // Settling time: first time |error| stays below 5% of setpoint permanently
  let settlingTime = trajectory[trajectory.length - 1].time;
  const threshold = setpoint * 0.05;
  for (let i = trajectory.length - 1; i >= 0; i--) {
    if (Math.abs(errors[i]) > threshold) {
      settlingTime = trajectory[Math.min(i + 1, trajectory.length - 1)].time;
      break;
    }
  }

  // Overshoot
  const maxDO = Math.max(...doValues);
  const overshoot = maxDO > setpoint
    ? ((maxDO - setpoint) / setpoint) * 100
    : 0;

  // Steady-state error (average of last 10%)
  const tail = errors.slice(-Math.max(5, Math.floor(errors.length * 0.1)));
  const steadyStateError = Math.abs(tail.reduce((a, b) => a + b, 0) / tail.length);

  // Convergence rate: exponential fit on |error| envelope
  const absErrors = errors.map(Math.abs).filter(e => e > 0.001);
  let convergenceRate = 0;
  if (absErrors.length > 10) {
    const logErrors = absErrors.slice(0, Math.floor(absErrors.length * 0.5)).map(e => Math.log(e + 1e-10));
    const n = logErrors.length;
    const dt = trajectory[1].time - trajectory[0].time;
    // Linear regression on log(|error|) vs time
    const xMean = (n - 1) * dt / 2;
    const yMean = logErrors.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      const x = i * dt - xMean;
      num += x * (logErrors[i] - yMean);
      den += x * x;
    }
    convergenceRate = den > 0 ? -num / den : 0; // Negative slope = positive convergence
  }

  // Oscillation count: zero-crossings in error signal
  let oscillationCount = 0;
  for (let i = 1; i < errors.length; i++) {
    if (errors[i] * errors[i - 1] < 0) oscillationCount++;
  }

  const isStable = steadyStateError < 0.08 && oscillationCount < trajectory.length * 0.2;

  return {
    settlingTime: Math.round(settlingTime * 10) / 10,
    overshoot: Math.round(overshoot * 10) / 10,
    steadyStateError: Math.round(steadyStateError * 1000) / 1000,
    convergenceRate: Math.round(convergenceRate * 1000) / 1000,
    oscillationCount,
    isStable,
  };
}

// ── Metabolic Burden Analysis ────────────────────────────────────────────────
export function analyzeMetabolicBurden(
  trajectory: ODEState[],
  params: BioreactorParams = DEFAULT_PARAMS,
): MetabolicBurdenResult {
  if (trajectory.length === 0) {
    return { burdenIndex: 0, proteinCost: 0, atpDrain: 0, growthPenalty: 0, isViable: true, recommendation: 'No data' };
  }

  const avgADS = trajectory.reduce((s, t) => s + (t.adsExpression ?? 0), 0) / trajectory.length;
  const avgBurden = trajectory.reduce((s, t) => s + (t.metabolicBurden ?? 0), 0) / trajectory.length;
  const maxToxicity = Math.max(...trajectory.map(t => t.toxicity ?? 0));

  // Protein cost factor = 0.15 — Russell & Cook 1995, Microbiol Rev 59:126
  // ATP cost of protein synthesis: fraction of ribosome budget for heterologous expression
  const proteinCost = Math.min(1, avgADS * 0.15);

  // ATP drain factor = 2.5 — Russell & Cook 1995, Microbiol Rev 59:126
  // Each enzyme unit costs ~2.5 mmol ATP/gDW/h for synthesis + folding
  const atpDrain = avgADS * 2.5;

  // Growth penalty factor = 0.4 — estimated, no direct literature source
  const growthPenalty = avgBurden * 0.4;

  const burdenIndex = (proteinCost + growthPenalty + maxToxicity) / 3;
  const isViable = burdenIndex < params.maxBurdenTolerance && maxToxicity < 0.8;

  let recommendation: string;
  if (burdenIndex < 0.2) {
    recommendation = 'Low burden — circuit is well-tolerated. Consider increasing expression for higher titer.';
  } else if (burdenIndex < 0.4) {
    recommendation = 'Moderate burden — acceptable for production strains. Monitor growth rate in scale-up.';
  } else if (burdenIndex < 0.6) {
    recommendation = 'High burden — consider dynamic regulation (e.g., two-stage fermentation) to decouple growth and production.';
  } else {
    recommendation = 'Critical burden — host cell viability compromised. Reduce circuit complexity or use chassis with higher metabolic capacity.';
  }

  return {
    burdenIndex: Math.round(burdenIndex * 1000) / 1000,
    proteinCost: Math.round(proteinCost * 1000) / 1000,
    atpDrain: Math.round(atpDrain * 100) / 100,
    growthPenalty: Math.round(growthPenalty * 1000) / 1000,
    isViable,
    recommendation,
  };
}

// ── Codon Optimization Bridge: Control Gain → RBS Strength → DNA Sequence ──
// Maps normalized PID control gain to RBS parts from the iGEM Registry.
// RBS strengths are relative translation initiation rates from Salis Lab RBS Calculator.
const RBS_REGISTRY: RBSMapping[] = [
  { controlGain: 0.0, rbsName: 'B0030',  rbsStrength: 0.07, translationRate: 0.07, sequence: 'ATTAAAGAGGAGAAATACTAG', registryId: 'BBa_B0030' },
  { controlGain: 0.1, rbsName: 'B0031',  rbsStrength: 0.12, translationRate: 0.12, sequence: 'TCACACAGGAAACCTACTAG',  registryId: 'BBa_B0031' },
  { controlGain: 0.2, rbsName: 'B0032',  rbsStrength: 0.30, translationRate: 0.30, sequence: 'TCACACAGGAAAG',          registryId: 'BBa_B0032' },
  { controlGain: 0.3, rbsName: 'B0033',  rbsStrength: 0.01, translationRate: 0.01, sequence: 'TCACACAGGACT',           registryId: 'BBa_B0033' },
  { controlGain: 0.4, rbsName: 'B0034',  rbsStrength: 1.00, translationRate: 1.00, sequence: 'AAAGAGGAGAAATACTAG',     registryId: 'BBa_B0034' },
  { controlGain: 0.5, rbsName: 'B0035',  rbsStrength: 0.50, translationRate: 0.50, sequence: 'AATTCATTAAAGAGGAGAAAGGTACC', registryId: 'BBa_B0035' },
  { controlGain: 0.6, rbsName: 'J61100', rbsStrength: 0.20, translationRate: 0.20, sequence: 'AAAGACAGGACCCTACTAG',    registryId: 'BBa_J61100' },
  { controlGain: 0.7, rbsName: 'J61101', rbsStrength: 0.40, translationRate: 0.40, sequence: 'AAAGAGAAGACCCTACTAG',    registryId: 'BBa_J61101' },
  { controlGain: 0.8, rbsName: 'J61104', rbsStrength: 0.60, translationRate: 0.60, sequence: 'AAAGAGGAGAAACCTACTAG',   registryId: 'BBa_J61104' },
  { controlGain: 0.9, rbsName: 'J61106', rbsStrength: 0.80, translationRate: 0.80, sequence: 'AAAGAGGAGAAATACTAAG',    registryId: 'BBa_J61106' },
  { controlGain: 1.0, rbsName: 'J61107', rbsStrength: 0.90, translationRate: 0.90, sequence: 'AAAGAGGAGAAATAACAATG',   registryId: 'BBa_J61107' },
];

// Sort by ascending rbsStrength for monotonic mapping
const RBS_REGISTRY_SORTED = [...RBS_REGISTRY].sort((a, b) => a.rbsStrength - b.rbsStrength);

export function mapControlGainToRBS(
  kp: number, ki: number, kd: number,
): RBSMapping {
  const combinedGain = (kp / 10) * 0.5 + (ki / 5) * 0.3 + (kd / 2) * 0.2;
  const t = Math.max(0, Math.min(1, combinedGain));

  const sorted = RBS_REGISTRY_SORTED;
  if (t <= 0) return sorted[0];
  if (t >= 1) return sorted[sorted.length - 1];

  // Linear interpolation in rbsStrength space
  const idx = t * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, sorted.length - 1);
  const frac = idx - lo;

  const targetStrength = sorted[lo].rbsStrength * (1 - frac) + sorted[hi].rbsStrength * frac;

  // Find closest entry by strength
  let closest = sorted[0];
  let minDist = Infinity;
  for (const entry of sorted) {
    const dist = Math.abs(entry.rbsStrength - targetStrength);
    if (dist < minDist) { minDist = dist; closest = entry; }
  }
  return closest;
}

export function getAllRBS(): RBSMapping[] {
  return [...RBS_REGISTRY];
}

export const BASELINE_TRAJECTORY = runBioreactor(DEFAULT_CONTROLLER);
