/**
 * FSEOF — Flux Scanning Based on Enforced Objective Flux
 *
 * Identifies overexpression and knockout targets by systematically
 * increasing product flux while constraining growth rate.
 *
 * Reference: Choi et al. (2010) BMC Bioinformatics 11:616
 *
 * @scientific_provenance
 *   REFERENCE: Choi, H.S., Lee, S.Y., Kim, T.Y., & Woo, H.M. (2010).
 *     In silico identification of gene amplification targets for
 *     improvement of lycopene production. BMC Bioinformatics, 11, 616.
 */

import { type LPModel, solveLP } from "./highsSolver";

/* ------------------------------------------------------------------ */
/*  Public interfaces                                                  */
/* ------------------------------------------------------------------ */

export interface FSEOFReaction {
  id: string;
  lb: number;
  ub: number;
  stoichiometry: Record<string, number>;
  gpr?: string;
}

export interface FSEOFModel {
  reactions: FSEOFReaction[];
  objectiveId: string;
  productReactionId: string;
}

export interface FSEOFStep {
  step: number;
  growthRate: number;
  productFlux: number;
  fluxes: Record<string, number>;
}

export interface OverexpressionTarget {
  reactionId: string;
  fluxAtStep0: number;
  fluxAtStepN: number;
  direction: "up" | "down" | "unchanged";
  monotonicityScore: number; // 0-1
}

export interface FSEOFResult {
  overexpressionTargets: OverexpressionTarget[];
  knockoutTargets: string[];
  steps: FSEOFStep[];
  maxGrowthRate: number;
  maxProductFlux: number;
}

export interface FSEOFOptions {
  numSteps?: number;
  reductionFactor?: number;
  monotonicityThreshold?: number;
  glucoseUptake?: number;
  oxygenUptake?: number;
  knockouts?: string[];
  tolerance?: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Build a CPLEX LP model from FSEOF reactions and constraints. */
function buildFSEOFLP(
  reactions: FSEOFReaction[],
  objectiveId: string,
  growthLB: number,
  glucoseUptake: number,
  oxygenUptake: number,
  knockouts: string[],
): LPModel {
  const knockoutSet = new Set(knockouts);

  // Collect all metabolite IDs from stoichiometry
  const allMetIds = new Set<string>();
  for (const r of reactions) {
    for (const metId of Object.keys(r.stoichiometry)) {
      allMetIds.add(metId);
    }
  }

  // Objective: maximize product flux
  const objective = [{ name: objectiveId, coef: 1 }];

  // Mass-balance constraints: S * v = 0
  const constraints = Array.from(allMetIds).map((metId) => ({
    name: `${metId}_balance`,
    vars: reactions
      .filter((r) => r.stoichiometry[metId] !== undefined)
      .map((r) => ({ name: r.id, coef: r.stoichiometry[metId] })),
    lb: 0,
    ub: 0,
  }));

  // Variable bounds
  const bounds = reactions.map((r) => {
    let lb = r.lb;

    // Enforce minimum growth rate on biomass reaction
    if (r.id === "BIOMASS" || r.id === "BIOMASS_Ec_iML1515" || r.id === "BIOMASS_HP_published") {
      lb = Math.max(lb, growthLB);
    }

    // Exchange reactions: set uptake limits
    if (r.id.startsWith("EX_")) {
      const isGlucose = r.id.includes("glc") || r.id.includes("glu");
      const isOxygen = r.id.includes("o2") || r.id.includes("O2");
      if (isGlucose) lb = -Math.abs(glucoseUptake);
      if (isOxygen) lb = -Math.abs(oxygenUptake);
    }

    return {
      name: r.id,
      lb,
      ub: knockoutSet.has(r.id) ? 0 : r.ub,
    };
  });

  return {
    name: "fseof",
    sense: "maximize",
    objective,
    constraints,
    bounds,
  };
}

/* ------------------------------------------------------------------ */
/*  Core algorithm                                                     */
/* ------------------------------------------------------------------ */

/**
 * Run FSEOF analysis on a metabolic model.
 *
 * Algorithm:
 * 1. Run FBA to find max growth rate (mu_max)
 * 2. For k = 0 to N:
 *    a. Fix growth at mu_max * (1 - k/N * reductionFactor)
 *    b. Maximize product flux
 *    c. Record all reaction fluxes
 * 3. Identify reactions with monotonically increasing flux -> overexpression targets
 * 4. Identify reactions that go to zero -> knockout targets
 */
export async function runFSEOF(model: FSEOFModel, options: FSEOFOptions = {}): Promise<FSEOFResult> {
  const {
    numSteps = 10,
    reductionFactor = 0.5,
    monotonicityThreshold = 0.6,
    glucoseUptake = 10,
    oxygenUptake = 12,
    knockouts = [],
    tolerance = 1e-6,
  } = options;

  // Validate that product reaction exists
  const hasProduct = model.reactions.some((r) => r.id === model.productReactionId);
  if (!hasProduct) {
    return {
      overexpressionTargets: [],
      knockoutTargets: [],
      steps: [],
      maxGrowthRate: 0,
      maxProductFlux: 0,
    };
  }

  // Step 0: Find max growth rate by maximizing objective (growth)
  const step0LP = buildFSEOFLP(
    model.reactions,
    model.objectiveId,
    0, // no growth constraint
    glucoseUptake,
    oxygenUptake,
    knockouts,
  );
  const step0Result = await solveLP(step0LP);

  if (step0Result.status !== "optimal") {
    return {
      overexpressionTargets: [],
      knockoutTargets: [],
      steps: [],
      maxGrowthRate: 0,
      maxProductFlux: 0,
    };
  }

  const maxGrowthRate = round(step0Result.objectiveValue);

  // Collect step 0 data: growth-maximizing fluxes and product flux at this point
  const step0Fluxes: Record<string, number> = {};
  for (const r of model.reactions) {
    step0Fluxes[r.id] = round(step0Result.primals[r.id] ?? 0);
  }
  const step0ProductFlux = round(step0Fluxes[model.productReactionId] ?? 0);

  // Steps 1..N: Enforce decreasing growth, maximize product
  const steps: FSEOFStep[] = [
    { step: 0, growthRate: maxGrowthRate, productFlux: step0ProductFlux, fluxes: step0Fluxes },
  ];

  for (let k = 1; k <= numSteps; k++) {
    const growthConstraint = maxGrowthRate * (1 - (k / numSteps) * reductionFactor);

    const stepLP = buildFSEOFLP(
      model.reactions,
      model.productReactionId,
      growthConstraint,
      glucoseUptake,
      oxygenUptake,
      knockouts,
    );
    const stepResult = await solveLP(stepLP);

    if (stepResult.status !== "optimal") break;

    const fluxes: Record<string, number> = {};
    for (const r of model.reactions) {
      fluxes[r.id] = round(stepResult.primals[r.id] ?? 0);
    }

    steps.push({
      step: k,
      growthRate: round(growthConstraint),
      productFlux: round(stepResult.objectiveValue),
      fluxes,
    });
  }

  const maxProductFlux =
    steps.length > 1 ? round(Math.max(...steps.slice(1).map((s) => s.productFlux))) : step0ProductFlux;

  // Identify candidate reactions (exclude exchange, biomass, and product reactions)
  const candidateIds = model.reactions
    .map((r) => r.id)
    .filter((id) => !id.startsWith("EX_") && id !== model.objectiveId && id !== model.productReactionId);

  // Classify candidates by flux trend across all steps
  const overexpressionTargets: OverexpressionTarget[] = [];
  const knockoutTargets: string[] = [];

  for (const rxnId of candidateIds) {
    const fluxSeries = steps.map((s) => s.fluxes[rxnId] ?? 0);
    const firstFlux = fluxSeries[0];
    const lastFlux = fluxSeries[fluxSeries.length - 1];

    // Count monotonically non-decreasing steps
    let nonDecreasingCount = 0;
    for (let i = 1; i < fluxSeries.length; i++) {
      if (fluxSeries[i] >= fluxSeries[i - 1] - tolerance) {
        nonDecreasingCount++;
      }
    }
    const monotonicityScore = fluxSeries.length > 1 ? nonDecreasingCount / (fluxSeries.length - 1) : 0;

    const diff = lastFlux - firstFlux;
    let direction: "up" | "down" | "unchanged" = "unchanged";
    if (diff > tolerance) direction = "up";
    else if (diff < -tolerance) direction = "down";

    // Overexpression target: flux increases monotonically
    if (direction === "up" && monotonicityScore >= monotonicityThreshold) {
      overexpressionTargets.push({
        reactionId: rxnId,
        fluxAtStep0: round(firstFlux),
        fluxAtStepN: round(lastFlux),
        direction,
        monotonicityScore: round(monotonicityScore, 2),
      });
    }

    // Knockout target: flux drops to zero (or near-zero) by the final step
    if (Math.abs(lastFlux) < tolerance && Math.abs(firstFlux) > tolerance) {
      knockoutTargets.push(rxnId);
    }
  }

  return {
    overexpressionTargets,
    knockoutTargets,
    steps,
    maxGrowthRate,
    maxProductFlux,
  };
}
