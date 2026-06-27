/**
 * Bioprocess Optimizer
 *
 * Pure TypeScript bioprocess engineering calculations covering:
 *   - Fed-batch fermentation optimization via golden-section search on Monod kinetics
 *   - Bioreactor scale-up using constant P/V and constant kLa methods
 *   - Techno-economic analysis for fermentation processes
 *
 * Kinetic model:
 *   Monod growth with environmental correction factors:
 *     mu = muMax * S / (Ks + S) * fT * fpH * fDO
 *   where fT is Arrhenius-type temperature correction,
 *         fpH is bell-shaped pH correction,
 *         fDO is linear dissolved-oxygen limitation.
 *
 * Units:
 *   volume in L, substrateConc in g/L, feedRate in L/h,
 *   temperature in degC, pH dimensionless, dissolvedO2 in % saturation,
 *   concentrations in g/L, time in h, power in W, kLa in 1/h.
 */

// ─── Type Definitions ────────────────────────────────────────────

export interface FedBatchParams {
  /** Initial working volume (L) */
  volume: number;
  /** Initial substrate concentration (g/L) */
  substrateConc: number;
  /** Feed flow rate (L/h) */
  feedRate: number;
  /** Operating temperature (degC) */
  temperature: number;
  /** Operating pH */
  pH: number;
  /** Dissolved oxygen (% saturation, 0-100) */
  dissolvedO2: number;
}

export interface OptimizationResult {
  /** Optimal feed rate (L/h) */
  optimalFeedRate: number;
  /** Predicted product yield (g/L) */
  predictedYield: number;
  /** Convergence trace: [iteration, candidateFeedRate, yieldAtCandidate][] */
  convergenceHistory: [number, number, number][];
}

export interface LabScaleData {
  /** Agitation speed (rpm) */
  agitationSpeed: number;
  /** Power input (W) */
  powerInput: number;
  /** Working volume (L) */
  volume: number;
  /** Vessel diameter (m) */
  vesselDiameter: number;
  /** Oxygen transfer coefficient (1/h) */
  kLa: number;
  /** Aeration rate (vvm) */
  aerationRate: number;
  /** Product yield at lab scale (g/L) */
  yield: number;
}

export interface ScaleUpResult {
  /** Constant P/V method results */
  constantPV: {
    /** Scaled agitation speed (rpm) */
    agitationSpeed: number;
    /** Scaled power input (W) */
    powerInput: number;
    /** Predicted kLa after scale-up (1/h) */
    predictedKLa: number;
  };
  /** Constant kLa method results */
  constantKLa: {
    /** Scaled agitation speed (rpm) */
    agitationSpeed: number;
    /** Scaled power input (W) */
    powerInput: number;
    /** Scale-up ratio (dimensionless) */
    scaleFactor: number;
  };
  /** Target volume (L) */
  targetVolume: number;
}

export interface CostBreakdown {
  /** Raw material cost ($) */
  rawMaterials: number;
  /** Utility cost ($) */
  utilities: number;
  /** Labor cost ($) */
  labor: number;
  /** Equipment depreciation ($) */
  depreciation: number;
  /** Consumables ($) */
  consumables: number;
}

export interface EconomicAnalysis {
  /** Total production cost ($) */
  totalCost: number;
  /** Cost per gram of product ($/g) */
  costPerGram: number;
  /** Revenue at given market price ($) */
  revenue: number;
  /** Profit ($) */
  profit: number;
  /** Profit margin (0-1) */
  profitMargin: number;
  /** Break-even selling price ($/g) */
  breakEvenPrice: number;
  /** Cost breakdown by category */
  costBreakdown: CostBreakdown;
  /** Return on investment (0-1) */
  roi: number;
  /** Payback period (years) */
  paybackPeriod: number;
}

// ─── Kinetic Parameters ──────────────────────────────────────────

const MU_MAX = 0.4;        // max specific growth rate (1/h)
const KS = 1.0;            // Monod half-saturation constant (g/L)
const OPT_TEMP = 37;       // optimal temperature for growth (degC)
const TEMP_SIGMA = 5;      // temperature tolerance width (degC)
const OPT_PH = 7.0;        // optimal pH
const PH_SIGMA = 0.8;      // pH tolerance width
const YIELD_BASE = 0.35;   // base biomass/substrate yield (g/g)
const MAINTENANCE = 0.02;  // maintenance coefficient (1/h)
const SUBSTRATE_FEED_CONC = 200; // feed substrate concentration (g/L)

// ─── Monod Kinetics with Environmental Corrections ───────────────

/**
 * Growth rate with Monod kinetics and environmental correction factors.
 *
 * mu = muMax * S/(Ks+S) * fT(S) * fpH(S) * fDO(S)
 */
function monodGrowthRate(
  substrateConc: number,
  temperature: number,
  pH: number,
  dissolvedO2: number,
): number {
  const s = Math.max(0, substrateConc);

  // Monod substrate limitation
  const monod = MU_MAX * s / (KS + s);

  // Temperature correction: Gaussian around optimum
  const fT = Math.exp(-0.5 * Math.pow((temperature - OPT_TEMP) / TEMP_SIGMA, 2));

  // pH correction: Gaussian around optimum
  const fpH = Math.exp(-0.5 * Math.pow((pH - OPT_PH) / PH_SIGMA, 2));

  // Dissolved oxygen limitation: linear, normalized to [0,1]
  const fDO = Math.min(1, Math.max(0, dissolvedO2 / 100));

  return monod * fT * fpH * fDO;
}

/**
 * Compute effective yield coefficient accounting for feed rate.
 *
 * At very high feed rates, excess substrate causes overflow metabolism
 * (Crabtree-like effect), reducing yield. At very low rates, maintenance
 * energy consumes a larger fraction of substrate.
 */
function effectiveYield(feedRate: number, volume: number): number {
  // Maintenance loss increases at low feed rates (substrate-limited)
  const maintenanceLoss = MAINTENANCE / Math.max(0.01, MU_MAX);
  // Overflow metabolism penalty at high dilution rates
  const dilutionRate = feedRate / Math.max(1, volume);
  const overflowPenalty = 0.1 * Math.pow(dilutionRate / MU_MAX, 2);
  return Math.max(0.05, YIELD_BASE - maintenanceLoss - overflowPenalty);
}

// ─── Fed-Batch Simulation ────────────────────────────────────────

/**
 * Simulate a fed-batch process and return final product concentration.
 *
 * Discretises batch time into steps. At each step:
 *   1. Compute growth rate from Monod + environmental factors
 *   2. Update biomass and substrate via Euler integration
 *   3. Track product formation as yield * consumed substrate
 *
 * @param params      Fed-batch operating parameters
 * @param batchTime   Total batch duration (h), default 48 h
 * @param nSteps      Number of integration steps, default 200
 * @returns           Final product concentration (g/L)
 */
function simulateFedBatch(
  params: FedBatchParams,
  batchTime: number = 48,
  nSteps: number = 200,
): number {
  const dt = batchTime / nSteps;
  let volume = params.volume;
  let substrate = params.substrateConc;
  let biomass = 0.5; // initial biomass (g/L)
  let product = 0;

  const yxs = effectiveYield(params.feedRate, params.volume);

  for (let i = 0; i < nSteps; i++) {
    const mu = monodGrowthRate(substrate, params.temperature, params.pH, params.dissolvedO2);

    // Biomass growth
    const dBiomass = mu * biomass * dt;

    // Substrate consumption: growth + maintenance
    const substrateUptake = (mu / yxs + MAINTENANCE) * biomass * dt;

    // Substrate feed contribution (dilution of concentration)
    const feedContribution = (params.feedRate * SUBSTRATE_FEED_CONC * dt) / volume;

    // Volume change from feed addition
    volume += params.feedRate * dt;

    // Update states
    biomass += dBiomass;
    substrate = Math.max(0, substrate + feedContribution - substrateUptake);
    product += yxs * substrateUptake; // product from consumed substrate
  }

  return product;
}

// ─── Fed-Batch Optimization ──────────────────────────────────────

/**
 * Optimise fed-batch feed rate to maximise product yield.
 *
 * Uses golden-section search over feed rate ∈ [0, maxFeedRate].
 * Each candidate feed rate is evaluated by running a full fed-batch
 * simulation with the provided environmental parameters.
 *
 * @param params        Fed-batch operating parameters (feedRate is used as initial guess)
 * @param batchTime     Batch duration (h), default 48
 * @param maxFeedRate   Upper bound for search (L/h), default 2.0
 * @param tol           Convergence tolerance (L/h), default 0.001
 * @param maxIter       Maximum iterations, default 50
 * @returns             OptimizationResult with optimal feed rate and yield
 */
export function optimizeFedBatch(
  params: FedBatchParams,
  batchTime: number = 48,
  maxFeedRate: number = 2.0,
  tol: number = 0.001,
  maxIter: number = 50,
): OptimizationResult {
  // Golden-section search to maximize yield
  const gr = (Math.sqrt(5) + 1) / 2;

  let a = 0;
  let b = maxFeedRate;

  let c = b - (b - a) / gr;
  let d = a + (b - a) / gr;

  let yieldC = simulateFedBatch({ ...params, feedRate: c }, batchTime);
  let yieldD = simulateFedBatch({ ...params, feedRate: d }, batchTime);

  const history: [number, number, number][] = [
    [0, c, yieldC],
    [1, d, yieldD],
  ];

  let iter = 2;
  while (Math.abs(b - a) > tol && iter < maxIter) {
    if (yieldC < yieldD) {
      // Maximum is in [c, b]
      a = c;
      c = d;
      yieldC = yieldD;
      d = a + (b - a) / gr;
      yieldD = simulateFedBatch({ ...params, feedRate: d }, batchTime);
    } else {
      // Maximum is in [a, d]
      b = d;
      d = c;
      yieldD = yieldC;
      c = b - (b - a) / gr;
      yieldC = simulateFedBatch({ ...params, feedRate: c }, batchTime);
    }
    history.push([iter, (c + d) / 2, Math.max(yieldC, yieldD)]);
    iter++;
  }

  const optimalFeedRate = (a + b) / 2;
  const predictedYield = simulateFedBatch({ ...params, feedRate: optimalFeedRate }, batchTime);

  return {
    optimalFeedRate,
    predictedYield,
    convergenceHistory: history,
  };
}

// ─── Bioreactor Scale-Up ─────────────────────────────────────────

/**
 * Predict scale-up parameters from lab to production scale.
 *
 * Two classical scale-up methods:
 *   1. Constant P/V — maintain power per unit volume
 *      N2 = N1 * (V1/V2)^(2/3)  (assuming same geometry, Po constant)
 *      P2 = P1 * (V2/V1)
 *
 *   2. Constant kLa — maintain oxygen transfer coefficient
 *      Uses the correlation: kLa ∝ (P/V)^0.4 * vs^0.5 * D^(-0.5)
 *      where vs is superficial gas velocity and D is impeller diameter.
 *
 * Geometric similarity is assumed: D2/D1 = (V2/V1)^(1/3).
 *
 * @param labData       Lab-scale measurements
 * @param targetVolume  Production-scale volume (L)
 * @returns             ScaleUpResult with both methods
 */
export function predictScaleUp(
  labData: LabScaleData,
  targetVolume: number,
): ScaleUpResult {
  const scaleRatio = targetVolume / labData.volume;

  // Geometric similarity: all linear dimensions scale as cube root of volume ratio
  const lengthScale = Math.pow(scaleRatio, 1 / 3);
  const D2 = labData.vesselDiameter * lengthScale;

  // ── Method 1: Constant P/V ─────────────────────────────────────
  // P2/V2 = P1/V1  →  P2 = P1 * scaleRatio
  const pvPower = labData.powerInput * scaleRatio;
  // For geometrically similar vessels: N2/N1 = (D1/D2)^2 * (P2/P1)^(1/3)
  // Simplified: N ∝ V^(-2/3) for constant P/V with same geometry
  const pvSpeed = labData.agitationSpeed / Math.pow(scaleRatio, 2 / 3);

  // Predict kLa at scaled conditions using correlation:
  // kLa ∝ (P/V)^0.4 * vs^0.5 * D^(-0.5)
  const labPV = labData.powerInput / labData.volume;
  const scaledPV = pvPower / targetVolume;
  // Assume same vvm → vs scales with vessel height (lengthScale)
  const vsScale = lengthScale;
  const kLaScaleFactor = Math.pow(scaledPV / labPV, 0.4)
    * Math.pow(vsScale, 0.5)
    * Math.pow(1 / lengthScale, 0.5);
  const pvKLa = labData.kLa * kLaScaleFactor;

  // ── Method 2: Constant kLa ─────────────────────────────────────
  // Rearrange kLa correlation to solve for P/V at target scale
  // kLa_target = kLa_lab → (P/V)_target = (P/V)_lab * lengthScale^(-1/3) * vs^(-1.25)
  // More practically, solve numerically using the ratio:
  const vsTarget = lengthScale; // same vvm assumption
  const pvRequired = labPV * Math.pow(lengthScale / vsTarget, 1 / 0.4)
    * Math.pow(1 / lengthScale, -0.5 / 0.4);

  // Oversimplification corrected: use direct ratio
  // From kLa correlation: (P/V)2/(P/V)1 = (D2/D1)^1.25 * (vs1/vs2)^1.25
  // With same vvm: vs ratio ≈ lengthScale, D ratio = lengthScale
  const pvRatioFromKLa = Math.pow(lengthScale, 0.25);
  const kLaPower = labPV * pvRatioFromKLa * targetVolume;
  const kLaSpeed = labData.agitationSpeed / Math.pow(scaleRatio, 2 / 3)
    * Math.pow(pvRatioFromKLa, 1 / 3);

  return {
    constantPV: {
      agitationSpeed: pvSpeed,
      powerInput: pvPower,
      predictedKLa: pvKLa,
    },
    constantKLa: {
      agitationSpeed: kLaSpeed,
      powerInput: kLaPower,
      scaleFactor: scaleRatio,
    },
    targetVolume,
  };
}

// ─── Economic Analysis ───────────────────────────────────────────

/**
 * Calculate techno-economic analysis for a fermentation process.
 *
 * Cost model:
 *   - Raw materials: proportional to volume and substrate concentration
 *   - Utilities: proportional to volume (heating, cooling, agitation energy)
 *   - Labor: fixed per batch
 *   - Depreciation: linear over equipment lifetime
 *   - Consumables: proportional to volume (media, filters, etc.)
 *
 * Revenue and profitability metrics are computed from the market price.
 *
 * @param totalYield    Total product yield (g/L * volume)
 * @param volume        Batch volume (L)
 * @param substrateConc Substrate concentration (g/L)
 * @param marketPrice   Selling price ($/g)
 * @param batchTime     Batch duration (h), default 48
 * @param batchesPerYear Batches per year, default 50
 * @param equipmentCost Total equipment cost ($), default 500000
 * @param equipmentLife Equipment lifetime (years), default 10
 * @returns             EconomicAnalysis
 */
export function calculateEconomics(
  totalYield: number,
  volume: number,
  substrateConc: number,
  marketPrice: number,
  batchTime: number = 48,
  batchesPerYear: number = 50,
  equipmentCost: number = 500_000,
  equipmentLife: number = 10,
): EconomicAnalysis {
  const totalProduct = totalYield; // total grams produced

  // ── Cost Breakdown ─────────────────────────────────────────────
  // Raw materials: substrate at ~$0.50/g, media components
  const substrateMass = substrateConc * volume;
  const rawMaterials = substrateMass * 0.50 + volume * 2.0; // $0.50/g substrate + $2/L media

  // Utilities: power, cooling, steam — scales with volume
  const utilities = volume * 0.8; // $0.80/L

  // Labor: operator time per batch
  const labor = 500 + 10 * batchTime; // base + per-hour

  // Equipment depreciation (per batch)
  const depreciation = equipmentCost / (equipmentLife * batchesPerYear);

  // Consumables: filters, probes, sterilization
  const consumables = volume * 0.3; // $0.30/L

  const breakdown: CostBreakdown = {
    rawMaterials,
    utilities,
    labor,
    depreciation,
    consumables,
  };

  const totalCost = rawMaterials + utilities + labor + depreciation + consumables;
  const costPerGram = totalProduct > 0 ? totalCost / totalProduct : Infinity;
  const revenue = totalProduct * marketPrice;
  const profit = revenue - totalCost;
  const profitMargin = revenue > 0 ? profit / revenue : 0;
  const breakEvenPrice = totalProduct > 0 ? totalCost / totalProduct : 0;
  const roi = totalCost > 0 ? profit / totalCost : 0;
  const annualProfit = profit * batchesPerYear;
  const paybackPeriod = annualProfit > 0 ? equipmentCost / annualProfit : Infinity;

  return {
    totalCost,
    costPerGram,
    revenue,
    profit,
    profitMargin,
    breakEvenPrice,
    costBreakdown: breakdown,
    roi,
    paybackPeriod,
  };
}
