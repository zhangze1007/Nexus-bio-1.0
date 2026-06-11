/**
 * Kinetics Engine Core
 *
 * Comprehensive enzyme kinetics models covering:
 *   - Competitive, uncompetitive, mixed, and substrate inhibition
 *   - Hill equation for cooperative binding
 *   - Multi-enzyme coupled ODE simulation via RK4
 *
 * All functions use SI units where:
 *   - Vmax in concentration/time (e.g. mM/s)
 *   - Km, Ki, K50 in concentration (e.g. mM)
 *   - S, I in concentration (e.g. mM)
 *   - n (Hill coefficient) is dimensionless
 */

// ─── Inhibition Models ──────────────────────────────────────────

/**
 * Competitive inhibition.
 * Inhibitor competes with substrate for the active site.
 *
 * v = Vmax * S / (Km * (1 + I/Ki) + S)
 *
 * @param vmax  Maximum velocity
 * @param s     Substrate concentration
 * @param km    Michaelis constant
 * @param ki    Inhibition constant
 * @param i     Inhibitor concentration
 */
export function competitiveInhibition(
  vmax: number,
  s: number,
  km: number,
  ki: number,
  i: number,
): number {
  const sSafe = Math.max(0, s);
  if (ki <= 0 || i <= 0) {
    // No effective inhibition — reduce to plain MM
    const denom = km + sSafe;
    return denom <= 0 ? 0 : (vmax * sSafe) / denom;
  }
  const kmEff = km * (1 + i / ki);
  const denom = kmEff + sSafe;
  if (denom <= 0) return 0;
  return (vmax * sSafe) / denom;
}

/**
 * Uncompetitive inhibition.
 * Inhibitor binds only to the enzyme-substrate complex.
 *
 * v = Vmax * S / (Km + S * (1 + I/Kiu))
 *
 * @param vmax  Maximum velocity
 * @param s     Substrate concentration
 * @param km    Michaelis constant
 * @param kiu   Uncompetitive inhibition constant
 * @param i     Inhibitor concentration
 */
export function uncompetitiveInhibition(
  vmax: number,
  s: number,
  km: number,
  kiu: number,
  i: number,
): number {
  const sSafe = Math.max(0, s);
  if (kiu <= 0 || i <= 0) {
    const denom = km + sSafe;
    return denom <= 0 ? 0 : (vmax * sSafe) / denom;
  }
  const denom = km + sSafe * (1 + i / kiu);
  if (denom <= 0) return 0;
  return (vmax * sSafe) / denom;
}

/**
 * Mixed inhibition.
 * Inhibitor binds both free enzyme and ES complex with different constants.
 *
 * v = Vmax * S / (Km * (1 + I/Kic) + S * (1 + I/Kiu))
 *
 * @param vmax  Maximum velocity
 * @param s     Substrate concentration
 * @param km    Michaelis constant
 * @param kic   Competitive inhibition constant (binding to free E)
 * @param kiu   Uncompetitive inhibition constant (binding to ES)
 * @param i     Inhibitor concentration
 */
export function mixedInhibition(
  vmax: number,
  s: number,
  km: number,
  kic: number,
  kiu: number,
  i: number,
): number {
  const sSafe = Math.max(0, s);
  const hasCompetitive = kic > 0 && i > 0;
  const hasUncompetitive = kiu > 0 && i > 0;

  if (!hasCompetitive && !hasUncompetitive) {
    const denom = km + sSafe;
    return denom <= 0 ? 0 : (vmax * sSafe) / denom;
  }

  const kmFactor = hasCompetitive ? 1 + i / kic : 1;
  const sFactor = hasUncompetitive ? 1 + i / kiu : 1;
  const denom = km * kmFactor + sSafe * sFactor;
  if (denom <= 0) return 0;
  return (vmax * sSafe) / denom;
}

/**
 * Substrate inhibition.
 * Excess substrate inhibits the enzyme (common in oxidases, esterases).
 *
 * v = Vmax * S / (Km + S + S^2 / Kis)
 *
 * @param vmax  Maximum velocity
 * @param s     Substrate concentration
 * @param km    Michaelis constant
 * @param kis   Substrate inhibition constant
 */
export function substrateInhibition(
  vmax: number,
  s: number,
  km: number,
  kis: number,
): number {
  const sSafe = Math.max(0, s);
  if (kis <= 0) {
    // No substrate inhibition — plain MM
    const denom = km + sSafe;
    return denom <= 0 ? 0 : (vmax * sSafe) / denom;
  }
  const denom = km + sSafe + (sSafe * sSafe) / kis;
  if (denom <= 0) return 0;
  return (vmax * sSafe) / denom;
}

// ─── Hill Equation ──────────────────────────────────────────────

/**
 * Hill equation for cooperative substrate binding.
 *
 * v = Vmax * S^n / (K50^n + S^n)
 *
 * When n = 1 this reduces to standard Michaelis-Menten.
 * When n > 1 the curve is sigmoidal (positive cooperativity).
 * When n < 1 the curve is sub-hyperbolic (negative cooperativity).
 *
 * @param vmax  Maximum velocity
 * @param s     Substrate concentration
 * @param k50   Substrate concentration at half-max velocity
 * @param n     Hill coefficient
 */
export function hillEquation(
  vmax: number,
  s: number,
  k50: number,
  n: number,
): number {
  const sSafe = Math.max(0, s);
  if (k50 <= 0) return sSafe > 0 ? vmax : 0;
  const sn = Math.pow(sSafe, n);
  const k50n = Math.pow(k50, n);
  const denom = k50n + sn;
  if (denom <= 0) return 0;
  return (vmax * sn) / denom;
}

// ─── Multi-Enzyme System Simulation ────────────────────────────

/** Describes a single enzyme in a coupled system. */
export interface EnzymeKinetics {
  /** Unique identifier for this enzyme */
  id: string;
  /** Index of the substrate species this enzyme consumes */
  substrateIndex: number;
  /** Index of the product species this enzyme produces */
  productIndex: number;
  /** Maximum velocity */
  vmax: number;
  /** Michaelis constant */
  km: number;
  /** Optional: competitive inhibition constant */
  ki?: number;
  /** Optional: index into the species array for the inhibitor */
  inhibitorIndex?: number;
}

/** Result of a multi-enzyme system simulation. */
export interface SystemSimResult {
  /** Time points */
  time: number[];
  /** Concentration trajectories for each species (speciesIndex -> concentration[]) */
  species: number[][];
  /** Velocity of each enzyme at each time point (enzymeIndex -> velocity[]) */
  velocities: number[][];
}

/**
 * Simulate a coupled multi-enzyme ODE system using RK4.
 *
 * Each enzyme converts one substrate species to one product species.
 * Multiple enzymes can share species (substrate of one = product of another).
 *
 * dX_j/dt = sum over enzymes that produce j (v_e)
 *         - sum over enzymes that consume j (v_e)
 *
 * @param enzymes               Array of enzyme definitions
 * @param initialConcentrations  Initial concentrations for each species
 * @param tEnd                  Simulation end time
 * @param dt                    Time step
 */
export function simulateEnzymeSystem(
  enzymes: EnzymeKinetics[],
  initialConcentrations: number[],
  tEnd: number,
  dt: number,
): SystemSimResult {
  const nSpecies = initialConcentrations.length;
  const nEnzymes = enzymes.length;

  if (tEnd <= 0 || dt <= 0 || nSpecies === 0) {
    const singlePoint = initialConcentrations.map(c => [c]);
    const zeroVel = enzymes.map(() => [0]);
    return {
      time: [0],
      species: singlePoint,
      velocities: zeroVel,
    };
  }

  const steps = Math.ceil(tEnd / dt);
  const actualDt = tEnd / steps;

  // Initialize storage
  const time: number[] = [0];
  const species: number[][] = initialConcentrations.map(c => [c]);
  const velocities: number[][] = enzymes.map(enz => [
    computeEnzymeVelocity(enz, initialConcentrations),
  ]);

  // Working arrays
  let concentrations = [...initialConcentrations];

  for (let step = 0; step < steps; step++) {
    const t = (step + 1) * actualDt;

    // RK4 for the coupled system
    const c0 = [...concentrations];

    // k1
    const k1 = computeDerivatives(enzymes, concentrations, nSpecies);

    // k2
    const c2 = concentrations.map((c, j) => c + (actualDt * k1[j]) / 2);
    const k2 = computeDerivatives(enzymes, c2, nSpecies);

    // k3
    const c3 = concentrations.map((c, j) => c + (actualDt * k2[j]) / 2);
    const k3 = computeDerivatives(enzymes, c3, nSpecies);

    // k4
    const c4 = concentrations.map((c, j) => c + actualDt * k3[j]);
    const k4 = computeDerivatives(enzymes, c4, nSpecies);

    // Update concentrations
    concentrations = concentrations.map((c, j) =>
      Math.max(0, c + (actualDt / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j])),
    );

    // Record
    time.push(parseFloat(t.toFixed(6)));
    for (let j = 0; j < nSpecies; j++) {
      species[j].push(parseFloat(concentrations[j].toFixed(6)));
    }
    for (let e = 0; e < nEnzymes; e++) {
      velocities[e].push(
        parseFloat(computeEnzymeVelocity(enzymes[e], concentrations).toFixed(6)),
      );
    }
  }

  return { time, species, velocities };
}

/** Compute velocity for a single enzyme given current concentrations. */
function computeEnzymeVelocity(enzyme: EnzymeKinetics, concentrations: number[]): number {
  const s = Math.max(0, concentrations[enzyme.substrateIndex] ?? 0);

  if (enzyme.ki !== undefined && enzyme.inhibitorIndex !== undefined) {
    const i = Math.max(0, concentrations[enzyme.inhibitorIndex] ?? 0);
    return competitiveInhibition(enzyme.vmax, s, enzyme.km, enzyme.ki, i);
  }

  // Plain Michaelis-Menten
  const denom = enzyme.km + s;
  return denom <= 0 ? 0 : (enzyme.vmax * s) / denom;
}

/** Compute dX/dt for all species given current concentrations. */
function computeDerivatives(
  enzymes: EnzymeKinetics[],
  concentrations: number[],
  nSpecies: number,
): number[] {
  const dCdt = new Array(nSpecies).fill(0) as number[];

  for (const enz of enzymes) {
    const v = computeEnzymeVelocity(enz, concentrations);
    // Enzyme consumes substrate
    if (enz.substrateIndex < nSpecies) {
      dCdt[enz.substrateIndex] -= v;
    }
    // Enzyme produces product
    if (enz.productIndex < nSpecies) {
      dCdt[enz.productIndex] += v;
    }
  }

  return dCdt;
}
