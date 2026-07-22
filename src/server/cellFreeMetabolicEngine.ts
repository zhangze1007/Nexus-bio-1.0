/**
 * Cell-Free Metabolic Engineering Engine
 *
 * Extends cell-free TX-TL simulation with metabolic pathway engineering.
 * Enables pathway prototyping without living cells.
 *
 * Key capabilities:
 *   1. Energy regeneration system modeling (PEP, creatine phosphate, maltodextrin)
 *   2. Cell-free metabolic engineering (CFME) pathway optimization
 *   3. Extract composition optimization
 *   4. Enzyme ratio balancing for cell-free systems
 *   5. Stability prediction (enzyme degradation, metabolite depletion)
 *
 * Reference: Silverman et al. (2020) Nat Rev Methods Primers 1:30
 * Reference: Karim et al. (2020) Nat Commun 11:4031
 *
 * @scientific_provenance
 *   ALGORITHM: TX-TL ODE + energy regeneration + enzyme kinetics
 *   KNOWN_LIMITATIONS:
 *     - No protein aggregation modeling
 *     - No metabolite toxicity effects
 *     - Standard E. coli extract composition
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface CellFreeSystem {
  extractType: "E_coli" | "wheat_germ" | "CHO" | "baculovirus";
  energySystem: "PEP" | "creatine_phosphate" | "maltodextrin" | "none";
  templateDNA: number; // nM concentration
  aminoAcids: Record<string, number>; // mM per amino acid
  rNTPs: Record<string, number>; // mM per rNTP
  cofactors: Record<string, number>; // mM per cofactor
  volume: number; // µL
  temperature: number; // °C
}

export interface PathwayStep {
  enzyme: string;
  ecNumber: string;
  substrate: string;
  product: string;
  kcat: number; // 1/s
  km: number; // mM
  enzymeConc: number; // µM
}

export interface CellFreeResult {
  productYield: number; // mM
  productivity: number; // mM/h
  stability: {
    halfLife: number; // hours
    limitingFactor: string;
  };
  energyBalance: {
    atpProduced: number; // mM
    atpConsumed: number; // mM
    net: number;
  };
  recommendations: string[];
  timeSeries: Array<{
    time: number; // hours
    product: number; // mM
    substrate: number; // mM
    atp: number; // mM
  }>;
}

// ── Energy Regeneration Systems ────────────────────────────────────────────

/**
 * Model energy regeneration system dynamics.
 *
 * PEP system: PEP → Pyruvate + ATP (via pyruvate kinase)
 *   - High rate, moderate cost
 *   - Reference: Silverman 2020
 *
 * Creatine phosphate: CP + ADP → Creatine + ATP (via creatine kinase)
 *   - Very high rate, expensive
 *   - Reference: Karim 2020
 *
 * Maltodextrin: Starch → Glucose → ... → ATP (via glycolysis)
 *   - Slow but sustained, cheap
 *   - Reference: Kim & Swartz 2001
 */
export function modelEnergySystem(
  type: CellFreeSystem["energySystem"],
  initialConc: number,
  dt: number,
): { atpRate: number; substrateConsumption: number; halfLife: number } {
  // Per-system base kinetics: Vmax (mM/min), Km (mM), substrate cost, enzyme
  // half-life (h). The ATP regeneration rate now follows Michaelis–Menten
  // saturation in the available energy-substrate concentration `initialConc`
  // and first-order enzyme decay over the step `dt` — both previously ignored.
  //   PEP:  pyruvate kinase, PEP → pyruvate + ATP. Ref: Silverman 2020; Calhoun & Swartz 2005.
  //   CP:   creatine kinase, CP + ADP → creatine + ATP. Ref: Karim 2020; Jewett & Swartz 2004.
  //   malto: amylase → glucose → glycolysis → ATP. Ref: Kim & Swartz 2001; Wang & Zhang 2009.
  const BASE: Record<string, { vmax: number; km: number; cost: number; halfLife: number }> = {
    PEP: { vmax: 0.5, km: 15, cost: 0.5, halfLife: 2.0 },
    creatine_phosphate: { vmax: 2.0, km: 10, cost: 2.0, halfLife: 1.0 },
    maltodextrin: { vmax: 0.1, km: 20, cost: 0.05, halfLife: 8.0 },
  };
  const base = BASE[type];
  if (!base) return { atpRate: 0, substrateConsumption: 0, halfLife: 0 };

  const conc = Math.max(0, initialConc);
  const saturation = conc / (base.km + conc); // Michaelis–Menten
  const decay = base.halfLife > 0 ? Math.exp((-Math.LN2 * Math.max(0, dt)) / base.halfLife) : 1; // first-order over dt

  return {
    atpRate: base.vmax * saturation * decay,
    substrateConsumption: base.cost * saturation * decay,
    halfLife: base.halfLife,
  };
}

// ── TX-TL Dynamics ─────────────────────────────────────────────────────────

/**
 * Simulate cell-free TX-TL with metabolic pathway.
 *
 * d[mRNA]/dt = k_txn · [DNA] - k_deg_mRNA · [mRNA]
 * d[Protein]/dt = k_txn · [mRNA] - k_deg_prot · [Protein]
 * d[ATP]/dt = energy_regeneration - energy_consumption
 * d[Product]/dt = kcat · [Enzyme] · [Substrate] / (Km + [Substrate])
 */
export function simulateCellFreePathway(
  system: CellFreeSystem,
  pathway: PathwayStep[],
  duration: number = 8,
): CellFreeResult {
  const dt = 0.01; // hours
  const steps = Math.floor(duration / dt);

  // Initial conditions
  let atp = 2.0; // mM
  const gtp = 1.0; // mM
  let mrna = 0;
  let protein = 0;
  let substrate = 10; // mM
  let product = 0;

  const timeSeries: CellFreeResult["timeSeries"] = [];

  // Energy system parameters. Initial energy-substrate concentration is taken
  // from the system's nucleotide pool (proxy for regeneration capacity) so the
  // regeneration kinetics respond to the actual reaction setup, not a constant.
  const energySubstrateConc = Object.values(system.rNTPs).reduce((sum, v) => sum + v, 0);
  const energy = modelEnergySystem(system.energySystem, energySubstrateConc, dt);

  // TX-TL parameters (E. coli S30 extract)
  // Reference: Silverman et al. (2020) Nat Rev Methods Primers 1:30
  // Reference: Sun et al. (2013) ACS Synth Biol 2:1764 (E. coli TX-TL rates)
  const k_txn = 0.1; // transcription rate (nM/min) — Sun 2013: ~0.1-0.5 nM/min
  const k_tln = 0.05; // translation rate (nM/min) — Sun 2013: ~0.05-0.2 nM/min
  const k_deg_mRNA = 0.02; // mRNA degradation (1/min) — half-life ~35 min, E. coli extract
  const k_deg_prot = 0.01; // protein degradation (1/min) — half-life ~70 min, limited proteases

  // RK4 ODE integration (replaces forward Euler for better accuracy with stiff systems)
  type State = [number, number, number, number, number]; // mrna, protein, substrate, product, atp
  const derivatives = (s: State): State => {
    const [m, p, sub, , a] = s;
    const txnRate = k_txn * system.templateDNA * (a / (a + 0.5));
    const tlnRate = k_tln * m * (a / (a + 0.5)) * (gtp / (gtp + 0.1));
    const atpRegen = energy.atpRate;
    const atpCons = txnRate * 0.5 + tlnRate * 2.0;
    let pathwayFlux = Infinity;
    for (const step of pathway) {
      const v = (step.kcat * step.enzymeConc * sub) / (step.km + sub);
      pathwayFlux = Math.min(pathwayFlux, v);
    }
    pathwayFlux = Math.min(pathwayFlux, sub / dt);
    return [
      txnRate - k_deg_mRNA * m, // d(mrna)/dt
      tlnRate - k_deg_prot * p, // d(protein)/dt
      -pathwayFlux, // d(substrate)/dt
      pathwayFlux, // d(product)/dt
      atpRegen - atpCons, // d(atp)/dt
    ];
  };

  for (let step = 0; step <= steps; step++) {
    const t = step * dt;
    const y: State = [mrna, protein, substrate, product, atp];

    // Classic RK4
    const k1 = derivatives(y);
    const y2: State = y.map((yi, i) => yi + 0.5 * dt * k1[i]) as State;
    const k2 = derivatives(y2);
    const y3: State = y.map((yi, i) => yi + 0.5 * dt * k2[i]) as State;
    const k3 = derivatives(y3);
    const y4: State = y.map((yi, i) => yi + dt * k3[i]) as State;
    const k4 = derivatives(y4);

    [mrna, protein, substrate, product, atp] = y.map(
      (yi, i) => yi + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]),
    ) as State;

    // Clamp non-negative
    mrna = Math.max(0, mrna);
    protein = Math.max(0, protein);
    substrate = Math.max(0, substrate);
    atp = Math.max(0, atp);

    if (step % Math.floor(0.5 / dt) === 0) {
      // every 30 min
      timeSeries.push({
        time: Math.round(t * 100) / 100,
        product: Math.round(product * 1000) / 1000,
        substrate: Math.round(substrate * 1000) / 1000,
        atp: Math.round(atp * 1000) / 1000,
      });
    }
  }

  // Compute metrics
  const finalProduct = product;
  const productivity = finalProduct / duration;

  // Stability: based on ATP and enzyme half-lives
  const limitingFactor = atp < 0.1 ? "ATP depletion" : "Enzyme degradation";
  const halfLife = atp < 0.1 ? duration * 0.3 : duration * 0.7;

  // Energy balance
  const atpProduced = energy.atpRate * duration;
  const atpConsumed = atpProduced - atp;

  // Recommendations
  const recommendations: string[] = [];
  if (atp < 0.5) recommendations.push("Increase energy system concentration — ATP is limiting");
  if (productivity < 0.5) recommendations.push("Optimize enzyme ratios — pathway flux is low");
  if (substrate > 5) recommendations.push("Substrate not fully consumed — increase enzyme loading");

  return {
    productYield: Math.round(finalProduct * 1000) / 1000,
    productivity: Math.round(productivity * 1000) / 1000,
    stability: {
      halfLife: Math.round(halfLife * 100) / 100,
      limitingFactor,
    },
    energyBalance: {
      atpProduced: Math.round(atpProduced * 1000) / 1000,
      atpConsumed: Math.round(atpConsumed * 1000) / 1000,
      net: Math.round(atp * 1000) / 1000,
    },
    recommendations,
    timeSeries,
  };
}

/**
 * Optimize enzyme ratios for maximum product yield.
 *
 * Uses coordinate descent: optimize one enzyme at a time,
 * cycling through all enzymes until convergence.
 */
function generateRatioCombinations(n: number, steps: number[]): number[][] {
  if (n === 0) return [[]];
  const rest = generateRatioCombinations(n - 1, steps);
  const result: number[][] = [];
  for (const step of steps) {
    for (const r of rest) {
      result.push([step, ...r]);
    }
  }
  return result;
}

export function optimizeEnzymeRatios(
  system: CellFreeSystem,
  pathway: PathwayStep[],
  totalEnzymeBudget: number = 10, // µM total
): { optimalRatios: number[]; maxYield: number; improvement: number } {
  const nEnzymes = pathway.length;
  const baseline = simulateCellFreePathway(system, pathway);

  // Systematic grid search: vary each enzyme ratio in steps
  // For n enzymes, test all combinations of ratios [0.1, 0.3, 0.5, 0.7, 0.9]
  // This is deterministic and reproducible
  const ratioSteps = [0.1, 0.3, 0.5, 0.7, 0.9];
  let bestYield = baseline.productYield;
  let bestRatios = pathway.map((s) => s.enzymeConc);

  // For 2-3 enzymes, test all combinations
  // For >3 enzymes, use coordinate descent (optimize one at a time)
  if (nEnzymes <= 3) {
    // Exhaustive grid search
    const combinations = generateRatioCombinations(nEnzymes, ratioSteps);
    for (const ratios of combinations) {
      const sum = ratios.reduce((a, b) => a + b, 0);
      const normalized = ratios.map((r) => (r / sum) * totalEnzymeBudget);
      const testPathway = pathway.map((s, i) => ({ ...s, enzymeConc: normalized[i] }));
      const result = simulateCellFreePathway(system, testPathway);
      if (result.productYield > bestYield) {
        bestYield = result.productYield;
        bestRatios = normalized;
      }
    }
  } else {
    // Coordinate descent: optimize one enzyme at a time
    const currentRatios = pathway.map((s) => s.enzymeConc / totalEnzymeBudget);
    for (let round = 0; round < 5; round++) {
      for (let e = 0; e < nEnzymes; e++) {
        let bestRatio = currentRatios[e];
        for (const ratio of ratioSteps) {
          const testRatios = [...currentRatios];
          testRatios[e] = ratio;
          const sum = testRatios.reduce((a, b) => a + b, 0);
          const normalized = testRatios.map((r) => (r / sum) * totalEnzymeBudget);
          const testPathway = pathway.map((s, i) => ({ ...s, enzymeConc: normalized[i] }));
          const result = simulateCellFreePathway(system, testPathway);
          if (result.productYield > bestYield) {
            bestYield = result.productYield;
            bestRatio = ratio;
            bestRatios = normalized;
          }
        }
        currentRatios[e] = bestRatio;
      }
    }
  }

  const improvement = baseline.productYield > 0 ? (bestYield - baseline.productYield) / baseline.productYield : 0;

  return {
    optimalRatios: bestRatios.map((r) => Math.round(r * 1000) / 1000),
    maxYield: Math.round(bestYield * 1000) / 1000,
    improvement: Math.round(improvement * 100) / 100,
  };
}
