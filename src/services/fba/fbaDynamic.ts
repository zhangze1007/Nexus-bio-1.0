/**
 * Dynamic FBA — time-series flux balance analysis via Euler integration.
 *
 * Extends steady-state FBA to time-varying conditions by solving an LP at
 * each requested time point, computing metabolite concentration derivatives,
 * and integrating via forward Euler.
 *
 * Algorithm (per timestep):
 *   1. Scale exchange uptake bounds by Monod kinetics: lb_eff = lb * S/(K_s + S)
 *   2. Solve LP to get optimal fluxes
 *   3. Update concentrations:
 *      - External substrates (with exchange reactions): dS/dt = exchange_flux
 *      - Biomass: dX/dt = mu * X  (exponential growth, integrated exactly)
 *      - Internal metabolites: quasi-steady state (no dynamic tracking)
 *   4. Clamp concentrations to non-negative
 *   5. Record state and advance
 *
 * @scientific_provenance
 *   ALGORITHM: Dynamic FBA via Euler integration
 *   REFERENCE: Mahadevan, R., Edwards, J.S., & Doyle III, F.J. (2002).
 *     "Dynamic Flux Balance Analysis of Diauxic Growth in Escherichia coli."
 *     Metabolic Engineering, 4(3), 225-233.
 *   REFERENCE: Varma, A. & Palsson, B.O. (1994).
 *     "Metabolic Flux Balancing: Basic Concepts, Scientific and Practical Use."
 *     Nature Biotechnology, 12(10), 994-998.
 *   KNOWN_LIMITATIONS:
 *     - Forward Euler is first-order accurate; stiff systems may require small dt
 *     - FBA assumes quasi-steady state for internal metabolites
 *     - Monod kinetics are a simplified uptake model; does not capture PTS,
 *       competitive inhibition, or substrate-specific transporter kinetics
 *     - Biomass is integrated exactly (exp(mu*dt)) for stability
 */

import { type LPModel, solveLP } from "../../server/highsSolver";

/* ------------------------------------------------------------------ */
/*  Public types                                                       */
/* ------------------------------------------------------------------ */

/** A single reaction in the dynamic FBA model. */
export interface DynamicFBAReaction {
  /** Reaction identifier (must be unique). */
  id: string;
  /** Lower bound (negative for uptake/forward reversible). */
  lb: number;
  /** Upper bound. */
  ub: number;
  /** Stoichiometric coefficients: metabolite ID -> coefficient. */
  stoichiometry: Record<string, number>;
  /** If true, this reaction exchanges material with the environment. */
  isExchange?: boolean;
}

/** Model definition for a dynamic FBA simulation. */
export interface DynamicFBAModel {
  /** Reactions in the metabolic network. */
  reactions: DynamicFBAReaction[];
  /** Reaction ID whose flux is the objective (typically biomass). */
  objectiveId: string;
  /** Monod half-saturation constant for exchange uptake scaling (default 0.1 mM). */
  Ks?: number;
}

/** Result of a dynamic FBA simulation. */
export interface DynamicFBAResult {
  /** Time points at which the simulation was evaluated. */
  timePoints: number[];
  /** Metabolite concentrations over time: metId -> concentration at each time point. */
  concentrations: Record<string, number[]>;
  /** Reaction fluxes over time: rxnId -> flux at each time point. */
  fluxes: Record<string, number[]>;
  /** Biomass concentration at each time point (from the objective reaction). */
  biomass: number[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/** Clamp to non-negative (concentrations cannot go below zero). */
function clampNonNeg(v: number): number {
  return v < 0 ? 0 : v;
}

/* ------------------------------------------------------------------ */
/*  Metabolite classification                                          */
/* ------------------------------------------------------------------ */

interface MetaboliteInfo {
  /** Metabolites with exchange reactions (external substrates/products). */
  exchangeMetIds: Map<string, string>; // metId -> exchangeRxnId
  /** Metabolites produced by the objective reaction (biomass). */
  biomassMetIds: Set<string>;
  /** All metabolite IDs in the network. */
  allMetIds: string[];
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

  const allMetIdsSet = new Set<string>();
  for (const r of reactions) {
    for (const metId of Object.keys(r.stoichiometry)) {
      allMetIdsSet.add(metId);
    }
  }

  return { exchangeMetIds, biomassMetIds, allMetIds: Array.from(allMetIdsSet) };
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
 */
async function solveStep(
  reactions: DynamicFBAReaction[],
  objectiveId: string,
  concentrations: Record<string, number>,
  Ks: number,
  metIds: string[],
): Promise<StepResult | null> {
  // Build stoichiometric constraints: S * v = 0
  const constraints = metIds.map((metId) => ({
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
/*  Main entry point                                                   */
/* ------------------------------------------------------------------ */

/**
 * Run a dynamic FBA simulation over a series of time points.
 *
 * At each timestep:
 *   1. Scale exchange uptake bounds by Monod kinetics
 *   2. Solve steady-state FBA (LP) via HiGHS
 *   3. Compute metabolite concentration derivatives
 *   4. Integrate concentrations via forward Euler
 *   5. Record state
 *
 * @param model                - Dynamic FBA model (reactions, objectiveId, Ks)
 * @param timePoints           - Explicit array of time values (must be sorted ascending)
 * @param initialConcentrations - Initial metabolite concentrations (mM)
 * @returns Time-series of concentrations, fluxes, and biomass
 */
export async function runDynamicFBA(
  model: DynamicFBAModel,
  timePoints: number[],
  initialConcentrations: Record<string, number>,
): Promise<DynamicFBAResult> {
  const { reactions, objectiveId, Ks = 0.1 } = model;

  // Classify metabolites
  const metInfo = classifyMetabolites(reactions, objectiveId);
  const metIds = metInfo.allMetIds;

  // Initialize concentrations from initial values (default 0 for unlisted)
  const currentConc: Record<string, number> = {};
  for (const metId of metIds) {
    currentConc[metId] = clampNonNeg(initialConcentrations[metId] ?? 0);
  }

  // Result storage
  const concentrations: Record<string, number[]> = {};
  const allFluxes: Record<string, number[]> = {};
  const biomass: number[] = [];

  for (const metId of metIds) {
    concentrations[metId] = [];
  }
  for (const r of reactions) {
    allFluxes[r.id] = [];
  }

  // Main simulation loop
  for (let i = 0; i < timePoints.length; i++) {
    const t = timePoints[i];

    // Record current concentrations
    for (const metId of metIds) {
      concentrations[metId].push(round(clampNonNeg(currentConc[metId])));
    }

    // Solve FBA at this timestep
    const stepResult = await solveStep(reactions, objectiveId, currentConc, Ks, metIds);

    if (stepResult) {
      // Record fluxes and biomass
      for (const r of reactions) {
        allFluxes[r.id].push(stepResult.fluxes[r.id] ?? 0);
      }
      biomass.push(round(clampNonNeg(currentConc[biomassKey(metInfo)])));

      // Compute derivative and integrate concentrations for next step
      if (i < timePoints.length - 1) {
        const dt = timePoints[i + 1] - t;
        if (dt <= 0) continue;

        const growthRate = stepResult.growthRate;

        for (const metId of metIds) {
          if (metInfo.biomassMetIds.has(metId)) {
            // Biomass: exact exponential integration for stability
            // X(t+dt) = X(t) * exp(mu * dt)
            currentConc[metId] = clampNonNeg(currentConc[metId] * Math.exp(growthRate * dt));
          } else if (metInfo.exchangeMetIds.has(metId)) {
            // External substrate/product: forward Euler
            // dS/dt = exchange_flux
            const exRxnId = metInfo.exchangeMetIds.get(metId)!;
            const exchangeFlux = stepResult.fluxes[exRxnId] ?? 0;
            currentConc[metId] = clampNonNeg(currentConc[metId] + dt * exchangeFlux);
          }
          // Internal metabolites: quasi-steady state (no change)
        }
      }
    } else {
      // Infeasible: record zero fluxes, biomass at current level
      for (const r of reactions) {
        allFluxes[r.id].push(0);
      }
      biomass.push(round(clampNonNeg(currentConc[biomassKey(metInfo)])));
      // Concentrations stay unchanged (no feasible flux = no change)
    }
  }

  return {
    timePoints: timePoints.map((t) => round(t)),
    concentrations,
    fluxes: allFluxes,
    biomass,
  };
}

/**
 * Get the primary biomass metabolite ID (the one produced by the objective reaction).
 * Falls back to a synthetic "biomass" key if none found.
 */
function biomassKey(metInfo: MetaboliteInfo): string {
  // Return the first biomass metabolite produced by the objective reaction
  for (const metId of metInfo.biomassMetIds) {
    return metId;
  }
  return "biomass";
}
