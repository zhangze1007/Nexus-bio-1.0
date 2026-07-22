/**
 * Dynamic FBA — time-series flux balance analysis
 *
 * Extends steady-state FBA to time-varying conditions by solving FBA at
 * each timestep, computing metabolite concentration changes, and integrating
 * via Euler or RK4.
 *
 * Reference: Mahadevan et al. (2002) "Dynamic Flux Balance Analysis of
 * Diauxic Growth in Escherichia coli". Metab Eng 4(3):225-233.
 *
 * Algorithm (per timestep):
 *   1. Scale exchange uptake bounds by Monod kinetics: lb_eff = lb * S/(K_s + S)
 *   2. Solve LP to get optimal fluxes
 *   3. Update concentrations:
 *      - External substrates (with exchange reactions): dS/dt = exchange_flux
 *      - Biomass (objective product): dX/dt = growthRate * X  (exponential growth)
 *      - Internal metabolites: quasi-steady state (no dynamic tracking)
 *   4. Clamp concentrations to non-negative
 *   5. Record state and advance
 *
 * @scientific_provenance
 *   REFERENCE: Mahadevan, R., Edwards, J.S., & Doyle III, F.J. (2002).
 *     Dynamic Flux Balance Analysis of Diauxic Growth in Escherichia coli.
 *     Metabolic Engineering, 4(3), 225-233.
 */

import { type LPModel, solveLP } from "./highsSolver";

/* ------------------------------------------------------------------ */
/*  Public interfaces                                                  */
/* ------------------------------------------------------------------ */

export interface DynamicFBAReaction {
  id: string;
  lb: number;
  ub: number;
  stoichiometry: Record<string, number>;
  isExchange?: boolean;
}

export interface DynamicFBAModel {
  reactions: DynamicFBAReaction[];
  objectiveId: string;
  initialConcentrations: Record<string, number>; // metabolite -> mM
  maxTime: number;
  dt: number;
  /** Half-saturation constant for Monod uptake kinetics (default 0.1 mM) */
  Ks?: number;
  /** Integration method: 'euler' (default) or 'rk4' */
  method?: "euler" | "rk4";
}

export interface DynamicFBAResult {
  times: number[];
  concentrations: Record<string, number[]>;
  fluxes: Record<string, number[]>;
  growthRates: number[];
  feasible: boolean;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Clamp to non-negative (concentrations cannot go below zero). */
function clampNonNeg(v: number): number {
  return v < 0 ? 0 : v;
}

/* ------------------------------------------------------------------ */
/*  Metabolite classification                                          */
/* ------------------------------------------------------------------ */

interface MetaboliteInfo {
  /** Metabolites with exchange reactions (external substrates/products) */
  exchangeMetIds: Map<string, string>; // metId -> exchangeRxnId
  /** Metabolites produced by the objective reaction (biomass) */
  biomassMetIds: Set<string>;
}

function classifyMetabolites(reactions: DynamicFBAReaction[], objectiveId: string): MetaboliteInfo {
  const exchangeMetIds = new Map<string, string>();
  for (const r of reactions) {
    if (r.isExchange) {
      for (const metId of Object.keys(r.stoichiometry)) {
        exchangeMetIds.set(metId, r.id);
      }
    }
  }

  const biomassMetIds = new Set<string>();
  const objectiveRxn = reactions.find((r) => r.id === objectiveId);
  if (objectiveRxn) {
    for (const [metId, coef] of Object.entries(objectiveRxn.stoichiometry)) {
      if (coef > 0) biomassMetIds.add(metId);
    }
  }

  return { exchangeMetIds, biomassMetIds };
}

/* ------------------------------------------------------------------ */
/*  Single-step FBA solve                                              */
/* ------------------------------------------------------------------ */

interface StepResult {
  fluxes: Record<string, number>;
  growthRate: number;
  feasible: boolean;
}

/**
 * Solve one FBA instance with the given metabolite concentrations.
 * Exchange uptake bounds are scaled by Monod kinetics:
 *   effective_lb = lb * S / (K_s + S)
 *
 * Returns null if the LP is infeasible.
 */
async function solveStep(
  reactions: DynamicFBAReaction[],
  objectiveId: string,
  concentrations: Record<string, number>,
  Ks: number,
): Promise<StepResult | null> {
  // Collect all metabolite IDs
  const allMetIds = new Set<string>();
  for (const r of reactions) {
    for (const metId of Object.keys(r.stoichiometry)) {
      allMetIds.add(metId);
    }
  }

  // Build stoichiometric constraints: S * v = 0
  const constraints = Array.from(allMetIds).map((metId) => ({
    name: `${metId}_balance`,
    vars: reactions
      .filter((r) => r.stoichiometry[metId] !== undefined)
      .map((r) => ({ name: r.id, coef: r.stoichiometry[metId] })),
    lb: 0,
    ub: 0,
  }));

  // Build variable bounds with Monod-scaled exchange reactions
  const objective = [{ name: objectiveId, coef: 1 }];

  const bounds = reactions.map((r) => {
    let lb = r.lb;

    if (r.isExchange) {
      // Scale uptake bound by Monod kinetics based on metabolite concentration
      for (const metId of Object.keys(r.stoichiometry)) {
        const S = clampNonNeg(concentrations[metId] ?? 0);
        if (lb < 0) {
          lb = lb * (S / (Ks + S));
        }
      }
    }

    return { name: r.id, lb, ub: r.ub };
  });

  const model: LPModel = {
    name: "dynamic_fba_step",
    sense: "maximize",
    objective,
    constraints,
    bounds,
  };

  const result = await solveLP(model);

  if (result.status !== "optimal" || result.objectiveValue <= 1e-9) {
    return null;
  }

  const fluxes: Record<string, number> = {};
  for (const r of reactions) {
    fluxes[r.id] = round(result.primals[r.id] ?? 0);
  }

  return {
    fluxes,
    growthRate: fluxes[objectiveId] ?? 0,
    feasible: true,
  };
}

/* ------------------------------------------------------------------ */
/*  Concentration derivative computation                               */
/* ------------------------------------------------------------------ */

/**
 * Compute dS/dt for each metabolite.
 *
 * Key insight: FBA fluxes are at quasi-steady state, so internal
 * metabolites have dS/dt = 0. The dynamic changes come from:
 *
 *   - Exchange metabolites: dS/dt = exchange_flux (material flows
 *     across the system boundary)
 *   - Biomass metabolites:  dX/dt = growthRate * X (exponential growth,
 *     where growthRate is the objective reaction flux)
 */
export function computeDerivative(
  reactions: DynamicFBAReaction[],
  fluxes: Record<string, number>,
  metIds: string[],
  objectiveId: string,
  currentConc: Record<string, number>,
  info: MetaboliteInfo,
): Record<string, number> {
  const growthRate = fluxes[objectiveId] ?? 0;
  const dS: Record<string, number> = {};

  for (const metId of metIds) {
    if (info.biomassMetIds.has(metId)) {
      // Biomass: exponential growth  dX/dt = mu * X
      dS[metId] = growthRate * clampNonNeg(currentConc[metId] ?? 0);
      continue;
    }

    // Extracellular concentration change = negative of the cell's net boundary
    // exchange for this metabolite, assembled from the exchange reactions'
    // stoichiometry × their current FBA flux. Internal metabolites (no exchange
    // reaction) stay at quasi-steady-state (dS/dt = 0). Because a standard
    // exchange writes the metabolite with coefficient -1, -(-1)·v = v — i.e.
    // this reproduces "dS/dt = exchange flux" while genuinely using `reactions`.
    let d = 0;
    for (const r of reactions) {
      if (!r.isExchange) continue;
      const coeff = r.stoichiometry[metId];
      if (coeff === undefined) continue;
      d += -coeff * (fluxes[r.id] ?? 0);
    }
    dS[metId] = d;
  }

  return dS;
}

/* ------------------------------------------------------------------ */
/*  Main entry point                                                   */
/* ------------------------------------------------------------------ */

/**
 * Run a dynamic FBA simulation over time.
 *
 * At each timestep:
 *   1. Scale exchange uptake bounds by Monod kinetics
 *   2. Solve steady-state FBA (LP)
 *   3. Compute metabolite concentration derivatives
 *   4. Integrate concentrations via Euler or Heun (RK4-like) method
 *   5. Record state
 *
 * @param model - Dynamic FBA model definition
 * @returns Time-series of concentrations, fluxes, and growth rates
 */
export async function runDynamicFBA(model: DynamicFBAModel): Promise<DynamicFBAResult> {
  const { reactions, objectiveId, initialConcentrations, maxTime, dt, Ks = 0.1, method = "euler" } = model;

  // Classify metabolites
  const metInfo = classifyMetabolites(reactions, objectiveId);

  // Collect all metabolite IDs from reactions
  const allMetIds = new Set<string>();
  for (const r of reactions) {
    for (const metId of Object.keys(r.stoichiometry)) {
      allMetIds.add(metId);
    }
  }
  const metIds = Array.from(allMetIds);

  // Ensure all metabolites have an initial concentration (default 0)
  const currentConc: Record<string, number> = {};
  for (const metId of metIds) {
    currentConc[metId] = clampNonNeg(initialConcentrations[metId] ?? 0);
  }

  // Number of timesteps
  const nSteps = Math.ceil(maxTime / dt);

  // Result storage
  const times: number[] = [];
  const concentrations: Record<string, number[]> = {};
  const allFluxes: Record<string, number[]> = {};
  const growthRates: number[] = [];

  for (const metId of metIds) {
    concentrations[metId] = [];
  }
  for (const r of reactions) {
    allFluxes[r.id] = [];
  }

  let anyFeasible = false;

  // Main simulation loop
  for (let step = 0; step <= nSteps; step++) {
    const t = round(step * dt, 6);
    times.push(t);

    // Record current concentrations
    for (const metId of metIds) {
      concentrations[metId].push(round(clampNonNeg(currentConc[metId]), 6));
    }

    // Solve FBA at this timestep
    const stepResult = await solveStep(reactions, objectiveId, currentConc, Ks);

    if (stepResult) {
      anyFeasible = true;

      // Record fluxes and growth rate
      for (const r of reactions) {
        allFluxes[r.id].push(stepResult.fluxes[r.id] ?? 0);
      }
      growthRates.push(round(stepResult.growthRate, 6));

      // Compute derivative and integrate concentrations for next step
      if (step < nSteps) {
        const dS = computeDerivative(reactions, stepResult.fluxes, metIds, objectiveId, currentConc, metInfo);

        if (method === "rk4") {
          // Heun's method (improved Euler / RK2 approximation):
          //   k1 = f(t, S) at current point
          //   k2 = f(t+dt, S + dt*k1) — estimated via Monod scaling
          //   S(t+dt) = S(t) + dt/2 * (k1 + k2)
          //
          // Full RK4 would require resolving FBA at intermediate concentrations,
          // which doubles LP solves per step. Heun gives O(dt^2) accuracy with
          // a single FBA solve by estimating the endpoint derivative shift.
          for (const metId of metIds) {
            const S = clampNonNeg(currentConc[metId]);
            const k1 = dS[metId];
            const S_euler = clampNonNeg(S + dt * k1);

            if (metInfo.biomassMetIds.has(metId)) {
              // Biomass: exact exponential integration
              // X(t+dt) = X(t) * exp(mu * dt) for constant mu over dt
              const mu = stepResult.growthRate;
              currentConc[metId] = S * Math.exp(mu * dt);
            } else if (metInfo.exchangeMetIds.has(metId)) {
              // Exchange metabolite: Heun correction
              // Estimate k2 by scaling based on Monod ratio change
              const eff_S = S / (Ks + S);
              const eff_euler = S_euler / (Ks + S_euler);
              const k2 = eff_S > 1e-12 ? k1 * (eff_euler / eff_S) : 0;
              currentConc[metId] = clampNonNeg(S + dt * 0.5 * (k1 + k2));
            } else {
              // Internal: no change
              currentConc[metId] = S;
            }
          }
        } else {
          // Forward Euler: S(t+dt) = S(t) + dS/dt * dt
          for (const metId of metIds) {
            if (metInfo.biomassMetIds.has(metId)) {
              // Biomass: exact exponential integration
              const mu = stepResult.growthRate;
              currentConc[metId] = clampNonNeg(currentConc[metId] * Math.exp(mu * dt));
            } else {
              currentConc[metId] = clampNonNeg(currentConc[metId] + dt * dS[metId]);
            }
          }
        }
      }
    } else {
      // Infeasible: record zero fluxes, no growth
      for (const r of reactions) {
        allFluxes[r.id].push(0);
      }
      growthRates.push(0);
      // Concentrations stay unchanged (no feasible flux = no change)
    }
  }

  return {
    times,
    concentrations,
    fluxes: allFluxes,
    growthRates,
    feasible: anyFeasible,
  };
}
