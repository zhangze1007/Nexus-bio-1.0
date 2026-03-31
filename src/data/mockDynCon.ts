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
  muMax: 0.4, Ks: 0.15, Yxs: 0.45, Yps: 0.38,
  kLa: 250, OstarSat: 8, feedConc: 400, feedRate: 0.02,
  kFPP: 12.0,      // FPP synthesis: 12 μM/h per g/L biomass
  kADS: 0.08,      // ADS catalysis rate
  fppDegradation: 0.15,  // FPP consumed at 0.15 h⁻¹
  fppToxicThreshold: 120, // FPP toxicity above 120 μM
  productToxicThreshold: 25, // Product IC₅₀ at 25 g/L
  maxBurdenTolerance: 0.6,
};

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
): { mu: number; toxicity: number; burden: number } {
  const muO = O > 0 ? O / (0.2 + O) : 0;
  const muBase = p.muMax * (S / (p.Ks + S)) * muO;

  // Toxicity penalty: FPP and product inhibit growth
  const fppInhibition = fpp > p.fppToxicThreshold
    ? Math.max(0, 1 - (fpp - p.fppToxicThreshold) / (p.fppToxicThreshold * 2))
    : 1;
  const productInhibition = product > p.productToxicThreshold
    ? Math.max(0, 1 - (product - p.productToxicThreshold) / (p.productToxicThreshold * 2))
    : 1;
  const toxicity = 1 - fppInhibition * productInhibition;

  // Metabolic burden: protein expression costs growth
  const burden = Math.min(1, adsExpr / p.maxBurdenTolerance);
  const burdenPenalty = Math.max(0, 1 - burden * 0.4); // Up to 40% growth reduction

  const mu = muBase * fppInhibition * productInhibition * burdenPenalty;
  return { mu, toxicity, burden };
}

// ── RK4 ODE derivatives ──────────────────────────────────────────────────────
interface State { X: number; S: number; P: number; O: number; FPP: number; ADS: number; }

function derivatives(
  s: State, airflowScale: number,
  p: BioreactorParams, hill: HillParams,
): State {
  const V = 2.0; // working volume L
  const { mu } = monodRate(s.S, s.O, s.FPP, s.P, s.ADS, p);

  // Biomass
  const dX = mu * s.X;
  // Substrate
  const dS = -dX / p.Yxs + p.feedRate * (p.feedConc - s.S) / V;
  // FPP intermediate: produced proportional to biomass, consumed by ADS
  const dFPP = p.kFPP * s.X - s.ADS * s.FPP * p.fppDegradation - s.FPP * 0.02; // spontaneous loss
  // ADS expression: Hill-function feedback from FPP
  const adsTarget = hillFeedback(s.FPP, hill);
  const dADS = (adsTarget - s.ADS) * 0.3; // 0.3 h⁻¹ protein turnover rate
  // Product: formed by ADS enzyme acting on FPP
  const dP = p.kADS * s.ADS * s.FPP * s.X;
  // Dissolved O₂
  const dO = p.kLa * airflowScale * (p.OstarSat - s.O) - mu * s.X * 0.18;

  return { X: dX, S: dS, P: dP, O: dO, FPP: dFPP, ADS: dADS };
}

function addState(a: State, b: State, scale: number): State {
  return {
    X: a.X + b.X * scale,
    S: a.S + b.S * scale,
    P: a.P + b.P * scale,
    O: a.O + b.O * scale,
    FPP: a.FPP + b.FPP * scale,
    ADS: a.ADS + b.ADS * scale,
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
  };
}

// ── Main bioreactor simulation with RK4 integration ──────────────────────────
export function runBioreactor(
  controller: ControllerParams,
  params: BioreactorParams = DEFAULT_PARAMS,
  steps = 100,
  dt = 1.0,
  hill: HillParams = DEFAULT_HILL,
): ODEState[] {
  const states: ODEState[] = [];
  let state: State = { X: 0.5, S: 20.0, P: 0.0, O: params.OstarSat, FPP: 10.0, ADS: hill.Vmax * 0.8 };
  let integral = 0, prevErr = 0;

  for (let i = 0; i < steps; i++) {
    // PID controller on dissolved O₂
    const err = controller.setpoint - state.O / params.OstarSat;
    integral += err * dt;
    integral = Math.max(-5, Math.min(5, integral)); // Anti-windup
    const derivative = (err - prevErr) / dt;
    const airflowScale = Math.max(0, Math.min(3,
      1 + controller.kp * err + controller.ki * integral + controller.kd * derivative
    ));
    prevErr = err;

    // RK4 integration
    const k1 = derivatives(state, airflowScale, params, hill);
    const s2 = clampState(addState(state, k1, dt / 2), params);
    const k2 = derivatives(s2, airflowScale, params, hill);
    const s3 = clampState(addState(state, k2, dt / 2), params);
    const k3 = derivatives(s3, airflowScale, params, hill);
    const s4 = clampState(addState(state, k3, dt), params);
    const k4 = derivatives(s4, airflowScale, params, hill);

    state = clampState({
      X:   state.X   + (dt / 6) * (k1.X   + 2 * k2.X   + 2 * k3.X   + k4.X),
      S:   state.S   + (dt / 6) * (k1.S   + 2 * k2.S   + 2 * k3.S   + k4.S),
      P:   state.P   + (dt / 6) * (k1.P   + 2 * k2.P   + 2 * k3.P   + k4.P),
      O:   state.O   + (dt / 6) * (k1.O   + 2 * k2.O   + 2 * k3.O   + k4.O),
      FPP: state.FPP + (dt / 6) * (k1.FPP + 2 * k2.FPP + 2 * k3.FPP + k4.FPP),
      ADS: state.ADS + (dt / 6) * (k1.ADS + 2 * k2.ADS + 2 * k3.ADS + k4.ADS),
    }, params);

    const { toxicity, burden } = monodRate(state.S, state.O, state.FPP, state.P, state.ADS, params);

    states.push({
      time: (i + 1) * dt,
      biomass: state.X,
      substrate: state.S,
      product: state.P,
      dissolvedO2: state.O / params.OstarSat,
      fpp: state.FPP,
      adsExpression: state.ADS,
      toxicity,
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

  // Protein cost: fraction of ribosome budget (assume 15% max for heterologous)
  const proteinCost = Math.min(1, avgADS * 0.15);

  // ATP drain: each enzyme unit costs ~2.5 mmol ATP/gDW/h for synthesis + folding
  const atpDrain = avgADS * 2.5;

  // Growth penalty: integrated burden over time
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

export function mapControlGainToRBS(
  kp: number, ki: number, kd: number,
): RBSMapping {
  // Normalize combined gain to [0, 1]
  const combinedGain = Math.min(1, Math.max(0,
    (kp / 10) * 0.5 + (ki / 5) * 0.3 + (kd / 2) * 0.2
  ));

  // Find closest RBS in registry
  let best = RBS_REGISTRY[0];
  let bestDist = Infinity;
  for (const rbs of RBS_REGISTRY) {
    const dist = Math.abs(rbs.controlGain - combinedGain);
    if (dist < bestDist) {
      bestDist = dist;
      best = rbs;
    }
  }

  return { ...best, controlGain: Math.round(combinedGain * 1000) / 1000 };
}

export function getAllRBS(): RBSMapping[] {
  return [...RBS_REGISTRY];
}

export const BASELINE_TRAJECTORY = runBioreactor(DEFAULT_CONTROLLER);
