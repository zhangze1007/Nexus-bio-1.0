/**
 * Michaelis-Menten kinetics and ODE solver.
 *
 * Implements Michaelis-Menten kinetics (Michaelis & Menten, 1913) with
 * Dormand-Prince RK4 integration for time-course simulations.
 *
 * Delegates to kineticsEngine.ts for:
 *   - Multi-inhibition velocity models (competitive, uncompetitive, mixed, substrate)
 *   - Dormand-Prince adaptive RK4(5) ODE solver
 *
 * Backward compatibility: existing callers of mmVelocity and runRK4
 * continue to work with identical signatures and return types.
 *
 * @references
 * - Michaelis, L. & Menten, M.L. (1913). Die Kinetik der Invertinwirkung. Biochem. Z. 49, 333-369.
 * - Dormand, J.R. & Prince, P.J. (1980). A family of embedded Runge-Kutta formulae. J. Comput. Appl. Math. 6(1), 19-26.
 */

import { competitiveInhibition, type EnzymeKinetics, simulateEnzymeSystem } from "../services/kineticsEngine";

// ── Hill Functions ──────────────────────────────────────────────────────
/**
 * Hill function for transcriptional inhibition.
 * f(x) = K^n / (K^n + x^n)
 *
 * @param x - Repressor concentration
 * @param K - Half-maximal repression concentration (Kd)
 * @param n - Hill coefficient (cooperativity)
 */
export function hillInhibition(x: number, K = 0.5, n = 2): number {
  return K ** n / (K ** n + x ** n);
}

/**
 * Hill function for transcriptional activation.
 * f(x) = x^n / (K^n + x^n)
 *
 * @param x - Activator concentration
 * @param K - Half-maximal activation concentration (Kd)
 * @param n - Hill coefficient (cooperativity)
 */
export function hillActivation(x: number, K = 0.5, n = 2): number {
  return x ** n / (K ** n + x ** n);
}

export interface SimResult {
  time: number[];
  substrate: number[];
  product: number[];
  velocity: number[];
}

/**
 * Michaelis-Menten velocity with optional competitive inhibition.
 *
 * Delegates to kineticsEngine.competitiveInhibition internally.
 * When Ki and I are both provided and positive, competitive inhibition
 * is applied: Km_eff = Km * (1 + I / Ki).
 */
export function mmVelocity(S: number, Vmax: number, Km: number, Ki?: number, I?: number): number {
  if (Ki !== undefined && I !== undefined && Ki > 0 && I > 0) {
    return competitiveInhibition(Vmax, S, Km, Ki, I);
  }
  // No inhibition — plain Michaelis-Menten
  const sSafe = Math.max(0, S);
  const denominator = Km + sSafe;
  if (denominator <= 0) return 0;
  return (Vmax * sSafe) / denominator;
}

/**
 * ODE solver for single-enzyme pathway.
 *
 * dS/dt = -v(S) + formation_rate
 * dP/dt = +v(S) - degradation_rate * P
 *
 * Delegates to kineticsEngine.simulateEnzymeSystem with adaptive
 * Dormand-Prince RK4(5) step control. Formation and degradation rates
 * are modeled as additional pseudo-enzymes:
 *   - Formation: high-concentration pool species -> S (pool >> Km_formation)
 *   - Degradation: P -> pool (large Km for first-order approximation)
 */
export function runRK4(
  S0: number,
  P0: number,
  Vmax: number,
  Km: number,
  formationRate: number,
  degradationRate: number,
  Ki: number | undefined,
  I: number | undefined,
  duration: number,
  steps: number,
): SimResult {
  const velocity0 = mmVelocity(S0, Vmax, Km, Ki, I);

  // Guard against degenerate inputs
  if (steps <= 0 || duration <= 0) {
    return {
      time: [0],
      substrate: [S0],
      product: [P0],
      velocity: [velocity0],
    };
  }

  const hasFormation = formationRate > 0;
  const hasDegradation = degradationRate > 0;
  const hasInhibition = Ki !== undefined && I !== undefined && Ki > 0 && I > 0;

  // Pool concentration for formation/degradation pseudo-enzymes.
  // High enough that consumption over the simulation is negligible.
  const POOL_CONC = 1e8;
  // Large Km for degradation pseudo-enzyme to approximate first-order decay:
  // v = vmax * P / (km + P) ≈ (vmax / km) * P when P << km
  const DEGRADATION_KM = 1e8;

  // Species layout: [S, P] + optional pool + optional inhibitor
  const species: number[] = [S0, P0];
  let poolIndex = -1;
  let inhibitorIndex = -1;

  if (hasFormation || hasDegradation) {
    poolIndex = species.length;
    species.push(POOL_CONC);
  }
  if (hasInhibition) {
    inhibitorIndex = species.length;
    species.push(I);
  }

  // Build enzyme definitions
  const enzymes: EnzymeKinetics[] = [];

  // Formation pseudo-enzyme: pool -> S
  // When pool >> km, v ≈ vmax ≈ formationRate (constant production)
  if (hasFormation) {
    enzymes.push({
      id: "formation",
      substrateIndex: poolIndex,
      productIndex: 0, // S
      vmax: formationRate,
      km: 1, // pool (1e8) >> 1, so v ≈ formationRate
    });
  }

  // Main enzyme: S -> P (with optional competitive inhibition)
  const mainEnzyme: EnzymeKinetics = {
    id: "main",
    substrateIndex: 0, // S
    productIndex: 1, // P
    vmax: Vmax,
    km: Km,
  };
  if (hasInhibition) {
    mainEnzyme.ki = Ki;
    mainEnzyme.inhibitorIndex = inhibitorIndex;
  }
  enzymes.push(mainEnzyme);
  const mainEnzymeIdx = enzymes.length - 1;

  // Degradation pseudo-enzyme: P -> pool
  // First-order approximation: v = vmax * P / (km + P) ≈ (vmax/km) * P when P << km
  // Set vmax = degradationRate * km so that vmax/km = degradationRate
  if (hasDegradation) {
    enzymes.push({
      id: "degradation",
      substrateIndex: 1, // P
      productIndex: poolIndex,
      vmax: degradationRate * DEGRADATION_KM,
      km: DEGRADATION_KM,
    });
  }

  // Run adaptive Dormand-Prince simulation
  const dt = duration / steps;
  const result = simulateEnzymeSystem(enzymes, species, duration, dt, {
    adaptive: true,
    rtol: 1e-6,
    atol: 1e-9,
  });

  // Convert to SimResult (backward-compatible format)
  return {
    time: result.time.map((t) => parseFloat(t.toFixed(3))),
    substrate: result.species[0].map((s) => parseFloat(s.toFixed(4))),
    product: result.species[1].map((p) => parseFloat(p.toFixed(4))),
    velocity: result.velocities[mainEnzymeIdx].map((v) => parseFloat(v.toFixed(4))),
  };
}
