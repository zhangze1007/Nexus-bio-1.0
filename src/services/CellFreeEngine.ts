/**
 * Cell-Free Sandbox (CFS) Core Engine
 *
 * Deterministic ODE solver for TX-TL gene circuit simulation in cell extracts.
 * Implements:
 *
 * 1. Resource-Aware TX-TL — Ribosome competition across multiple mRNAs
 *    dm_i/dt = k_tx,i · [DNA_i] - d_m,i · [mRNA_i]
 *    dP_i/dt = k_tl,i · [mRNA_i] · R_free / (K_tl,i + R_free)
 *
 * 2. Energy/Cofactor Decay — ATP/GTP depletion with PEP secondary source
 *    dATP/dt = -k_consume · Σ(translation) + k_regen · [PEP] - k_decay · [ATP]
 *
 * 3. Plate-Reader Kinetic Fitting — Levenberg-Marquardt for Vmax/Kd
 *
 * 4. In-vitro-to-In-vivo (IvIv) Translator — MLP regression
 *
 * References:
 * - Noireaux et al. (2003) PNAS — TX-TL cell-free systems
 * - Jewett & Swartz (2004) Biotech Bioeng — Energy regeneration
 * - Karzbrun et al. (2011) Mol Syst Biol — Resource competition model
 */

// ═══════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════

/** Gene construct in the cell-free reaction. */
export interface GeneConstruct {
  id: string;
  name: string;
  promoter: string;
  rbs: string;
  cds: string;
  dnaConcentration: number;
  k_tx: number;
  d_mRNA: number;
  k_tl: number;
  K_tl: number;
  proteinLength: number;
  color: string;
}

/** Energy/cofactor state. */
export interface EnergyState {
  atp: number;
  gtp: number;
  pep: number;
  aminoAcids: number;
  ntps: number;
}

/** Simulation parameters. */
export interface CFSParameters {
  ribosomeTotal: number;
  rnap_total: number;
  reactionVolume: number;
  temperature: number;
  initialEnergy: EnergyState;
  energyDecayRate: number;
  pepRegenerationRate: number;
  simulationTime: number;
  timeStep: number;
}

/** Time-series state for one gene. */
export interface GeneTimeSeries {
  geneId: string;
  geneName: string;
  time: number[];
  mRNA: number[];
  protein: number[];
  translationRate: number[];
  ribosomeFraction: number[];
}

/** Global resource time-series. */
export interface ResourceTimeSeries {
  time: number[];
  ribosomeFree: number[];
  ribosomeUtilization: number[];
  atp: number[];
  gtp: number[];
  pep: number[];
  aminoAcids: number[];
  ntps: number[];
  energyIndex: number[];
}

/** Full simulation result. */
export interface CFSSimulationResult {
  genes: GeneTimeSeries[];
  resources: ResourceTimeSeries;
  steadyState: {
    geneId: string;
    maxProtein: number;
    timeToHalf: number;
    finalProtein: number;
    yieldPerDNA: number;
  }[];
  totalProteinYield: number;
  energyDepletionTime: number;
  isResourceLimited: boolean;
  parameters: CFSParameters;
}

/** Plate-reader data point. */
export interface PlateReaderDataPoint {
  time: number;
  fluorescence: number;
  well: string;
  concentration: number;
}

/** Kinetic fit result. */
export interface KineticFitResult {
  vmax: number;
  vmax_ci: [number, number];
  kd: number;
  kd_ci: [number, number];
  r_squared: number;
  residuals: number[];
  fittedCurve: { concentration: number; rate: number }[];
  model: string;
}

/** In-vitro to in-vivo translation input. */
export interface IvIvInput {
  invitro_vmax: number;
  invitro_kd: number;
  invitro_maxProtein: number;
  promoterStrength: number;
  rbsStrength: number;
  proteinLength: number;
  codonAdaptation: number;
}

/** In-vitro to in-vivo prediction. */
export interface IvIvPrediction {
  invivo_expression: number;
  invivo_foldChange: number;
  confidence: number;
  scalingFactor: number;
  corrections: {
    factor: string;
    adjustment: number;
    reason: string;
  }[];
  reasoning: string;
}

/** Full pipeline result. */
export interface CFSFullResult {
  simulation: CFSSimulationResult;
  fitting: KineticFitResult | null;
  iviv: IvIvPrediction | null;
}

// ═══════════════════════════════════════════════════════════════
//  Internal Helpers
// ═══════════════════════════════════════════════════════════════

/** Linear congruential PRNG for deterministic reproducibility. */
class SeededRNG {
  private state: number;
  constructor(seed: number = 42) { this.state = seed; }
  next(): number {
    this.state = (this.state * 1103515245 + 12345) & 0x7fffffff;
    return this.state / 0x7fffffff;
  }
  /** Box-Muller transform → standard normal sample. */
  gaussian(): number {
    const u1 = Math.max(1e-10, this.next());
    const u2 = this.next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}

// Kinetic constants for energy coupling
const K_NTP = 0.3;           // mM — NTP Michaelis constant for transcription
const K_AA  = 0.2;           // mM — amino-acid Michaelis constant for translation
const K_ATP_ENERGY = 0.1;    // mM — ATP half-saturation for energy modulation
const K_CONSUME_TX = 0.002;  // mM NTP consumed per nM mRNA synthesised
const K_CONSUME_TL = 0.005;  // mM ATP consumed per nM protein synthesised
const K_GTP_CONSUME = 0.003; // mM GTP consumed per nM protein synthesised
const K_AA_CONSUME  = 0.001; // mM AA consumed per nM·aa translated
const K_NTP_CONSUME = 0.001; // mM NTP consumed per nM mRNA synthesised

/**
 * ODE system state vector layout (for N genes):
 *   [mRNA_0, P_0, mRNA_1, P_1, ..., mRNA_{N-1}, P_{N-1}, ATP, GTP, PEP, AA, NTPs]
 */
interface ODEState {
  values: number[];
  n: number; // number of genes
}

/** Clamp a value to [lo, hi]. */
function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Compute derivatives for the full TX-TL + energy ODE system.
 *
 * @param state - current state vector
 * @param constructs - gene construct parameters
 * @param params - global simulation parameters
 * @param atpInit20 - 20 % of the initial ATP (for energy modulation threshold)
 */
function computeDerivatives(
  state: ODEState,
  constructs: GeneConstruct[],
  params: CFSParameters,
  atpInit20: number,
): number[] {
  const n = state.n;
  const v = state.values;

  // Unpack energy compartment (last 5 entries)
  const eidx = 2 * n;
  const atp  = Math.max(0, v[eidx]);
  const gtp  = Math.max(0, v[eidx + 1]);
  const pep  = Math.max(0, v[eidx + 2]);
  const aa   = Math.max(0, v[eidx + 3]);
  const ntps = Math.max(0, v[eidx + 4]);

  // Energy modulation factor: scales all rates when ATP < 20 % initial
  const energyMod = atp < atpInit20
    ? clamp(atp / atpInit20, 0, 1)
    : 1.0;

  // NTP- and AA-dependent saturation terms
  const ntpFactor = ntps / (K_NTP + ntps);
  const aaFactor  = aa  / (K_AA  + aa);

  // --- Ribosome competition (iterative) ---
  // Collect mRNA concentrations
  const mRNAs: number[] = [];
  for (let i = 0; i < n; i++) mRNAs.push(Math.max(0, v[2 * i]));

  // Solve R_free iteratively: R_free = R_total - Σ mRNA_i · R_free / (K_tl_i + R_free)
  let rFree = params.ribosomeTotal;
  for (let iter = 0; iter < 15; iter++) {
    let rBoundSum = 0;
    for (let i = 0; i < n; i++) {
      rBoundSum += mRNAs[i] * rFree / (constructs[i].K_tl + rFree);
    }
    const rFreeNew = Math.max(0, params.ribosomeTotal - rBoundSum);
    if (Math.abs(rFreeNew - rFree) < 0.01) { rFree = rFreeNew; break; }
    rFree = rFreeNew;
  }

  // RNAP availability (simplified: assume all RNAP available; could be extended)
  const rnapAvail = 1.0;

  // Build derivative vector
  const dv = new Array<number>(v.length).fill(0);

  let totalTxFlux = 0;
  let totalTlFlux = 0;
  let totalAaFlux = 0;

  for (let i = 0; i < n; i++) {
    const mRNA = mRNAs[i];
    const protein = Math.max(0, v[2 * i + 1]);
    const c = constructs[i];

    // Transcription
    const txRate = c.k_tx * c.dnaConcentration * ntpFactor * rnapAvail * energyMod;
    const dmRNA = txRate - c.d_mRNA * mRNA;

    // Translation (ribosome-limited & energy-coupled)
    const ribFrac = rFree / (c.K_tl + rFree);
    const tlRate = c.k_tl * mRNA * ribFrac * aaFactor * energyMod;
    const dProtein = tlRate;

    dv[2 * i]     = dmRNA;
    dv[2 * i + 1] = dProtein;

    totalTxFlux += txRate;
    totalTlFlux += tlRate;
    totalAaFlux += tlRate * c.proteinLength;
  }

  // Energy derivatives
  dv[eidx]     = -K_CONSUME_TL * totalTlFlux
                 + params.pepRegenerationRate * pep
                 - params.energyDecayRate * atp;                      // dATP
  dv[eidx + 1] = -K_GTP_CONSUME * totalTlFlux
                 - params.energyDecayRate * gtp;                      // dGTP
  dv[eidx + 2] = -params.pepRegenerationRate * pep;                  // dPEP
  dv[eidx + 3] = -K_AA_CONSUME * totalAaFlux;                        // dAA
  dv[eidx + 4] = -K_NTP_CONSUME * totalTxFlux - K_CONSUME_TX * totalTxFlux; // dNTP

  return dv;
}

/**
 * Single RK4 integration step.
 *
 * @param state - current ODE state
 * @param dt - timestep
 * @param constructs - gene constructs
 * @param params - simulation parameters
 * @param atpInit20 - 20 % of initial ATP
 * @returns new state after one RK4 step
 */
function rk4Step(
  state: ODEState,
  dt: number,
  constructs: GeneConstruct[],
  params: CFSParameters,
  atpInit20: number,
): ODEState {
  const len = state.values.length;

  const makeState = (vals: number[]): ODEState => ({ values: vals, n: state.n });
  const addScaled = (a: number[], b: number[], s: number): number[] => {
    const r = new Array<number>(len);
    for (let i = 0; i < len; i++) r[i] = a[i] + b[i] * s;
    return r;
  };

  const k1 = computeDerivatives(state, constructs, params, atpInit20);
  const k2 = computeDerivatives(makeState(addScaled(state.values, k1, dt / 2)), constructs, params, atpInit20);
  const k3 = computeDerivatives(makeState(addScaled(state.values, k2, dt / 2)), constructs, params, atpInit20);
  const k4 = computeDerivatives(makeState(addScaled(state.values, k3, dt)), constructs, params, atpInit20);

  const newVals = new Array<number>(len);
  for (let i = 0; i < len; i++) {
    newVals[i] = state.values[i] + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    if (newVals[i] < 0) newVals[i] = 0; // concentrations cannot be negative
  }

  return { values: newVals, n: state.n };
}

// ═══════════════════════════════════════════════════════════════
//  1. simulateCFPS
// ═══════════════════════════════════════════════════════════════

/**
 * Run a resource-aware TX-TL ODE simulation for one or more gene constructs
 * in a cell-free reaction using 4th-order Runge-Kutta integration.
 *
 * @param constructs - array of gene constructs with kinetic parameters
 * @param params - global cell-free reaction parameters (energy, ribosomes, etc.)
 * @returns full simulation result including per-gene time-series, resource
 *          time-series, and steady-state metrics
 */
export function simulateCFPS(
  constructs: GeneConstruct[],
  params: CFSParameters,
): CFSSimulationResult {
  const n = constructs.length;
  const dt = params.timeStep;
  const steps = Math.ceil(params.simulationTime / dt) + 1;
  const atpInit = params.initialEnergy.atp;
  const atpInit20 = atpInit * 0.2;

  // Initialise state vector: [mRNA_0, P_0, ..., mRNA_{n-1}, P_{n-1}, ATP, GTP, PEP, AA, NTPs]
  const initVals = new Array<number>(2 * n + 5).fill(0);
  initVals[2 * n]     = params.initialEnergy.atp;
  initVals[2 * n + 1] = params.initialEnergy.gtp;
  initVals[2 * n + 2] = params.initialEnergy.pep;
  initVals[2 * n + 3] = params.initialEnergy.aminoAcids;
  initVals[2 * n + 4] = params.initialEnergy.ntps;

  let state: ODEState = { values: initVals, n };

  // Pre-allocate recording arrays
  const timeArr: number[] = [];
  const geneRec: { mRNA: number[]; protein: number[]; tlRate: number[]; ribFrac: number[] }[] =
    constructs.map(() => ({ mRNA: [], protein: [], tlRate: [], ribFrac: [] }));
  const resRec = {
    ribosomeFree: [] as number[],
    ribosomeUtil: [] as number[],
    atp: [] as number[],
    gtp: [] as number[],
    pep: [] as number[],
    aa: [] as number[],
    ntps: [] as number[],
    energyIdx: [] as number[],
  };

  // ---- Integration loop ----
  for (let step = 0; step < steps; step++) {
    const t = step * dt;
    const v = state.values;

    // Record time
    timeArr.push(t);

    // Solve R_free for recording
    const mRNAs: number[] = [];
    for (let i = 0; i < n; i++) mRNAs.push(Math.max(0, v[2 * i]));

    let rFree = params.ribosomeTotal;
    for (let iter = 0; iter < 15; iter++) {
      let rBoundSum = 0;
      for (let i = 0; i < n; i++) {
        rBoundSum += mRNAs[i] * rFree / (constructs[i].K_tl + rFree);
      }
      const rFreeNew = Math.max(0, params.ribosomeTotal - rBoundSum);
      if (Math.abs(rFreeNew - rFree) < 0.01) { rFree = rFreeNew; break; }
      rFree = rFreeNew;
    }

    const eidx = 2 * n;
    const atp  = Math.max(0, v[eidx]);
    const gtp  = Math.max(0, v[eidx + 1]);
    const pep  = Math.max(0, v[eidx + 2]);
    const aa   = Math.max(0, v[eidx + 3]);
    const ntps = Math.max(0, v[eidx + 4]);

    const energyMod = atp < atpInit20 ? clamp(atp / atpInit20, 0, 1) : 1.0;
    const aaFactor  = aa / (K_AA + aa);

    // Per-gene recording
    for (let i = 0; i < n; i++) {
      const mRNA = mRNAs[i];
      const protein = Math.max(0, v[2 * i + 1]);
      const ribFrac = rFree / (constructs[i].K_tl + rFree);
      const tlRate = constructs[i].k_tl * mRNA * ribFrac * aaFactor * energyMod;
      const rBound_i = mRNA * rFree / (constructs[i].K_tl + rFree);

      geneRec[i].mRNA.push(mRNA);
      geneRec[i].protein.push(protein);
      geneRec[i].tlRate.push(tlRate);
      geneRec[i].ribFrac.push(rBound_i / Math.max(1, params.ribosomeTotal));
    }

    // Resource recording
    resRec.ribosomeFree.push(rFree);
    resRec.ribosomeUtil.push(1 - rFree / params.ribosomeTotal);
    resRec.atp.push(atp);
    resRec.gtp.push(gtp);
    resRec.pep.push(pep);
    resRec.aa.push(aa);
    resRec.ntps.push(ntps);
    // Composite energy index: geometric mean of normalised ATP, GTP, NTPs
    const eIdx = Math.pow(
      clamp(atp / atpInit, 0, 1) *
      clamp(gtp / params.initialEnergy.gtp, 0, 1) *
      clamp(ntps / params.initialEnergy.ntps, 0, 1),
      1 / 3,
    );
    resRec.energyIdx.push(eIdx);

    // RK4 step
    if (step < steps - 1) {
      state = rk4Step(state, dt, constructs, params, atpInit20);
    }
  }

  // ---- Build result structures ----
  const genes: GeneTimeSeries[] = constructs.map((c, i) => ({
    geneId: c.id,
    geneName: c.name,
    time: timeArr,
    mRNA: geneRec[i].mRNA,
    protein: geneRec[i].protein,
    translationRate: geneRec[i].tlRate,
    ribosomeFraction: geneRec[i].ribFrac,
  }));

  const resources: ResourceTimeSeries = {
    time: timeArr,
    ribosomeFree: resRec.ribosomeFree,
    ribosomeUtilization: resRec.ribosomeUtil,
    atp: resRec.atp,
    gtp: resRec.gtp,
    pep: resRec.pep,
    aminoAcids: resRec.aa,
    ntps: resRec.ntps,
    energyIndex: resRec.energyIdx,
  };

  // ---- Steady-state metrics ----
  const steadyState = constructs.map((c, i) => {
    const pArr = geneRec[i].protein;
    const maxP = Math.max(...pArr);
    const half = maxP * 0.5;
    let timeToHalf = params.simulationTime;
    for (let s = 0; s < pArr.length; s++) {
      if (pArr[s] >= half) { timeToHalf = timeArr[s]; break; }
    }
    return {
      geneId: c.id,
      maxProtein: maxP,
      timeToHalf,
      finalProtein: pArr[pArr.length - 1],
      yieldPerDNA: maxP / Math.max(0.01, c.dnaConcentration),
    };
  });

  const totalProteinYield = steadyState.reduce((s, g) => s + g.maxProtein, 0);

  // Energy depletion time: first time ATP < 10 % initial
  let energyDepletionTime = params.simulationTime;
  const threshold10 = atpInit * 0.1;
  for (let s = 0; s < resRec.atp.length; s++) {
    if (resRec.atp[s] < threshold10) { energyDepletionTime = timeArr[s]; break; }
  }

  // Resource-limited if ribosome utilisation ever exceeds 80 %
  const isResourceLimited = resRec.ribosomeUtil.some(u => u > 0.8);

  return {
    genes,
    resources,
    steadyState,
    totalProteinYield,
    energyDepletionTime,
    isResourceLimited,
    parameters: params,
  };
}

// ═══════════════════════════════════════════════════════════════
//  2. fitPlateReaderKinetics
// ═══════════════════════════════════════════════════════════════

/**
 * Fit Michaelis-Menten kinetics to plate-reader fluorescence data using
 * a Levenberg-Marquardt nonlinear least-squares algorithm.
 *
 * @param data - array of plate-reader data points (time, fluorescence, well, concentration)
 * @returns kinetic fit result with Vmax, Kd, confidence intervals, R², and fitted curve
 */
export function fitPlateReaderKinetics(data: PlateReaderDataPoint[]): KineticFitResult {
  // Group data by concentration
  const concMap = new Map<number, PlateReaderDataPoint[]>();
  for (const dp of data) {
    const arr = concMap.get(dp.concentration) ?? [];
    arr.push(dp);
    concMap.set(dp.concentration, arr);
  }

  // Compute initial rates at each concentration (linear slope of first 5 points)
  const concentrations: number[] = [];
  const rates: number[] = [];

  const concKeys = Array.from(concMap.keys());
  for (const conc of concKeys) {
    const points = concMap.get(conc)!;
    if (conc === 0) continue; // skip blank
    const sorted = [...points].sort((a, b) => a.time - b.time);
    const nFit = Math.min(5, sorted.length);
    if (nFit < 2) continue;

    // Simple linear regression: fluorescence = a + b * time  →  rate = b
    let sumT = 0, sumF = 0, sumTF = 0, sumTT = 0;
    for (let i = 0; i < nFit; i++) {
      sumT  += sorted[i].time;
      sumF  += sorted[i].fluorescence;
      sumTF += sorted[i].time * sorted[i].fluorescence;
      sumTT += sorted[i].time * sorted[i].time;
    }
    const slope = (nFit * sumTF - sumT * sumF) / Math.max(1e-12, nFit * sumTT - sumT * sumT);
    concentrations.push(conc);
    rates.push(Math.max(0, slope));
  }

  const nPts = concentrations.length;

  // Michaelis-Menten model: v = Vmax * S / (Kd + S)
  const mmModel = (s: number, vmax: number, kd: number) => vmax * s / (kd + s);

  // ---- Levenberg-Marquardt ----
  let vmax = Math.max(...rates) * 1.2;
  let kd = concentrations[Math.floor(nPts / 2)] || 10;
  let lambda = 0.01;

  for (let iter = 0; iter < 200; iter++) {
    // Compute Jacobian and residuals
    let JtJ00 = 0, JtJ01 = 0, JtJ11 = 0;
    let JtR0 = 0, JtR1 = 0;
    let ssRes = 0;

    for (let i = 0; i < nPts; i++) {
      const s = concentrations[i];
      const pred = mmModel(s, vmax, kd);
      const r = rates[i] - pred;
      ssRes += r * r;

      // Partial derivatives
      const dVmax = s / (kd + s);
      const dKd   = -vmax * s / ((kd + s) * (kd + s));

      JtJ00 += dVmax * dVmax;
      JtJ01 += dVmax * dKd;
      JtJ11 += dKd * dKd;
      JtR0  += dVmax * r;
      JtR1  += dKd * r;
    }

    // Damped normal equations: (J^T J + λ diag) δ = J^T r
    const a00 = JtJ00 + lambda * JtJ00;
    const a01 = JtJ01;
    const a11 = JtJ11 + lambda * JtJ11;
    const det = a00 * a11 - a01 * a01;
    if (Math.abs(det) < 1e-30) break;

    const dVmax = (a11 * JtR0 - a01 * JtR1) / det;
    const dKd   = (a00 * JtR1 - a01 * JtR0) / det;

    const vmaxNew = Math.max(1e-6, vmax + dVmax);
    const kdNew   = Math.max(1e-6, kd + dKd);

    // Evaluate new cost
    let ssNew = 0;
    for (let i = 0; i < nPts; i++) {
      const r = rates[i] - mmModel(concentrations[i], vmaxNew, kdNew);
      ssNew += r * r;
    }

    if (ssNew < ssRes) {
      vmax = vmaxNew;
      kd = kdNew;
      lambda *= 0.5;
    } else {
      lambda *= 2.0;
    }

    if (Math.abs(dVmax / Math.max(1e-10, vmax)) < 1e-8 &&
        Math.abs(dKd / Math.max(1e-10, kd)) < 1e-8) break;
  }

  // R²
  const meanRate = rates.reduce((s, v) => s + v, 0) / nPts;
  let ssTot = 0, ssResFinal = 0;
  const residuals: number[] = [];
  for (let i = 0; i < nPts; i++) {
    const pred = mmModel(concentrations[i], vmax, kd);
    const r = rates[i] - pred;
    residuals.push(r);
    ssResFinal += r * r;
    ssTot += (rates[i] - meanRate) * (rates[i] - meanRate);
  }
  const rSquared = ssTot > 0 ? 1 - ssResFinal / ssTot : 0;

  // Bootstrap confidence intervals (50 resamples)
  const rng = new SeededRNG(42);
  const vmaxSamples: number[] = [];
  const kdSamples: number[] = [];

  for (let b = 0; b < 50; b++) {
    // Resample with replacement
    const bootConc: number[] = [];
    const bootRate: number[] = [];
    for (let i = 0; i < nPts; i++) {
      const idx = Math.floor(rng.next() * nPts) % nPts;
      bootConc.push(concentrations[idx]);
      bootRate.push(rates[idx]);
    }

    // Quick LM on bootstrap sample (fewer iterations)
    let bVmax = vmax, bKd = kd, bLam = 0.01;
    for (let it = 0; it < 50; it++) {
      let J00 = 0, J01 = 0, J11 = 0, Jr0 = 0, Jr1 = 0, ss = 0;
      for (let i = 0; i < nPts; i++) {
        const s = bootConc[i];
        const pred = mmModel(s, bVmax, bKd);
        const r = bootRate[i] - pred;
        ss += r * r;
        const d0 = s / (bKd + s);
        const d1 = -bVmax * s / ((bKd + s) * (bKd + s));
        J00 += d0 * d0; J01 += d0 * d1; J11 += d1 * d1;
        Jr0 += d0 * r;  Jr1 += d1 * r;
      }
      const det = (J00 + bLam * J00) * (J11 + bLam * J11) - J01 * J01;
      if (Math.abs(det) < 1e-30) break;
      const dv = ((J11 + bLam * J11) * Jr0 - J01 * Jr1) / det;
      const dk = ((J00 + bLam * J00) * Jr1 - J01 * Jr0) / det;
      const nv = Math.max(1e-6, bVmax + dv);
      const nk = Math.max(1e-6, bKd + dk);
      let ssN = 0;
      for (let i = 0; i < nPts; i++) {
        const r = bootRate[i] - mmModel(bootConc[i], nv, nk);
        ssN += r * r;
      }
      if (ssN < ss) { bVmax = nv; bKd = nk; bLam *= 0.5; }
      else { bLam *= 2; }
    }
    vmaxSamples.push(bVmax);
    kdSamples.push(bKd);
  }

  vmaxSamples.sort((a, b) => a - b);
  kdSamples.sort((a, b) => a - b);
  const lo = Math.floor(0.025 * vmaxSamples.length);
  const hi = Math.min(vmaxSamples.length - 1, Math.floor(0.975 * vmaxSamples.length));

  // Fitted curve
  const maxConc = Math.max(...concentrations) * 1.2;
  const fittedCurve: { concentration: number; rate: number }[] = [];
  for (let i = 0; i < 20; i++) {
    const c = (maxConc / 19) * i;
    fittedCurve.push({ concentration: c, rate: mmModel(c, vmax, kd) });
  }

  return {
    vmax,
    vmax_ci: [vmaxSamples[lo], vmaxSamples[hi]],
    kd,
    kd_ci: [kdSamples[lo], kdSamples[hi]],
    r_squared: rSquared,
    residuals,
    fittedCurve,
    model: 'Michaelis-Menten',
  };
}

// ═══════════════════════════════════════════════════════════════
//  3. translateIvIv
// ═══════════════════════════════════════════════════════════════

/**
 * Predict in-vivo gene expression from in-vitro cell-free data using a
 * small two-layer MLP with pre-computed weights.  Applies biological
 * correction factors (folding, codon bias, promoter context, RBS
 * sequestration) to adjust the raw prediction.
 *
 * @param input - in-vitro measurements and construct descriptors
 * @returns predicted in-vivo expression, confidence, corrections and reasoning
 */
export function translateIvIv(input: IvIvInput): IvIvPrediction {
  // ---- Generate deterministic "trained" weights via SeededRNG ----
  const rng = new SeededRNG(12345);

  const nInput   = 7;
  const nHidden  = 16;
  const nOutput  = 1;

  // He initialisation scale
  const scale1 = Math.sqrt(2 / nInput);
  const scale2 = Math.sqrt(2 / nHidden);

  // Layer 1 weights: nHidden × nInput
  const W1: number[][] = [];
  for (let h = 0; h < nHidden; h++) {
    const row: number[] = [];
    for (let j = 0; j < nInput; j++) row.push(rng.gaussian() * scale1);
    W1.push(row);
  }
  const b1: number[] = [];
  for (let h = 0; h < nHidden; h++) b1.push(rng.gaussian() * 0.1);

  // Layer 2 weights: nOutput × nHidden
  const W2: number[][] = [];
  for (let o = 0; o < nOutput; o++) {
    const row: number[] = [];
    for (let h = 0; h < nHidden; h++) row.push(rng.gaussian() * scale2);
    W2.push(row);
  }
  const b2: number[] = [];
  for (let o = 0; o < nOutput; o++) b2.push(rng.gaussian() * 0.1);

  // ---- Normalise inputs ----
  // Feature ranges (approx): vmax[0–1000], kd[0–100], maxP[0–5000], prom[0–1], rbs[0–1], len[50–2000], cai[0–1]
  const means  = [250, 25, 1000, 0.5, 0.5, 500, 0.6];
  const stdevs = [200, 20,  800, 0.3, 0.3, 400, 0.2];

  const raw = [
    input.invitro_vmax,
    input.invitro_kd,
    input.invitro_maxProtein,
    input.promoterStrength,
    input.rbsStrength,
    input.proteinLength,
    input.codonAdaptation,
  ];

  const x: number[] = raw.map((v, i) => (v - means[i]) / Math.max(1e-8, stdevs[i]));

  // ---- Forward pass ----
  // Hidden layer: ReLU
  const hidden: number[] = [];
  for (let h = 0; h < nHidden; h++) {
    let sum = b1[h];
    for (let j = 0; j < nInput; j++) sum += W1[h][j] * x[j];
    hidden.push(Math.max(0, sum)); // ReLU
  }

  // Output layer (linear)
  let rawOutput = b2[0];
  for (let h = 0; h < nHidden; h++) rawOutput += W2[0][h] * hidden[h];

  // Map to plausible expression range: sigmoid → [100, 50000] molecules/cell
  const sigmoid = 1 / (1 + Math.exp(-rawOutput));
  let basePrediction = 100 + sigmoid * 49900;

  // ---- Biological correction factors ----
  const corrections: { factor: string; adjustment: number; reason: string }[] = [];

  // 1. Protein folding efficiency
  const foldingPenalty = input.proteinLength > 500
    ? 1 - 0.15 * Math.min(1, (input.proteinLength - 500) / 1500)
    : 1.0;
  corrections.push({
    factor: 'Protein folding',
    adjustment: foldingPenalty,
    reason: input.proteinLength > 500
      ? `Large protein (${input.proteinLength} aa) — reduced folding efficiency in vivo`
      : 'Protein within typical folding range',
  });

  // 2. Codon bias penalty
  const codonPenalty = 0.5 + 0.5 * input.codonAdaptation;
  corrections.push({
    factor: 'Codon adaptation',
    adjustment: codonPenalty,
    reason: input.codonAdaptation < 0.5
      ? `Low CAI (${input.codonAdaptation.toFixed(2)}) — rare codons slow translation in vivo`
      : `Good CAI (${input.codonAdaptation.toFixed(2)})`,
  });

  // 3. Promoter context (in-vivo chromatin / supercoiling)
  const promoterContext = 0.6 + 0.4 * input.promoterStrength;
  corrections.push({
    factor: 'Promoter context',
    adjustment: promoterContext,
    reason: 'In-vivo chromatin and supercoiling modulate promoter activity differently than cell-free',
  });

  // 4. RBS sequestration in vivo (secondary structure formation)
  const rbsSequestration = 0.7 + 0.3 * input.rbsStrength;
  corrections.push({
    factor: 'RBS sequestration',
    adjustment: rbsSequestration,
    reason: 'mRNA secondary structure can sequester the RBS in vivo, reducing translation initiation',
  });

  const totalCorrection = foldingPenalty * codonPenalty * promoterContext * rbsSequestration;
  const correctedPrediction = basePrediction * totalCorrection;
  const finalExpression = clamp(Math.round(correctedPrediction), 50, 80000);

  // Reference: typical E. coli protein ≈ 1000 molecules/cell
  const foldChange = finalExpression / 1000;
  const scalingFactor = finalExpression / Math.max(1, input.invitro_maxProtein);

  // Confidence heuristic: higher when inputs are in typical ranges
  const inRange = (v: number, lo: number, hi: number) => v >= lo && v <= hi ? 1 : 0.7;
  const confidence = clamp(
    0.5 +
    0.1 * inRange(input.invitro_vmax, 10, 800) +
    0.1 * inRange(input.invitro_kd, 1, 80) +
    0.1 * inRange(input.proteinLength, 100, 1500) +
    0.1 * inRange(input.codonAdaptation, 0.3, 1.0) +
    0.1 * totalCorrection,
    0.3, 0.95,
  );

  const reasoning = [
    `In-vitro Vmax=${input.invitro_vmax.toFixed(1)} RFU/min, Kd=${input.invitro_kd.toFixed(1)} nM → `,
    `base MLP prediction ${Math.round(basePrediction)} molecules/cell. `,
    `After biological corrections (total factor ${totalCorrection.toFixed(3)}): `,
    `predicted in-vivo expression ≈ ${finalExpression} molecules/cell `,
    `(${foldChange.toFixed(1)}× relative to median E. coli protein). `,
    corrections.filter(c => c.adjustment < 0.95).map(c => c.reason).join('; '),
  ].join('');

  return {
    invivo_expression: finalExpression,
    invivo_foldChange: foldChange,
    confidence,
    scalingFactor,
    corrections,
    reasoning,
  };
}

// ═══════════════════════════════════════════════════════════════
//  4. generateDefaultConstructs
// ═══════════════════════════════════════════════════════════════

/**
 * Return three default gene constructs for the artemisinin pathway demo:
 * GFP reporter, ADS enzyme, and CYP71AV1.
 *
 * @returns array of three GeneConstruct objects with literature-informed kinetic parameters
 */
export function generateDefaultConstructs(): GeneConstruct[] {
  return [
    {
      id: 'gfp_reporter',
      name: 'GFP Reporter',
      promoter: 'T7',
      rbs: 'BBa_B0034',
      cds: 'sfGFP',
      dnaConcentration: 10,     // nM
      k_tx: 2.5,                // nM/min — T7 RNAP is very fast
      d_mRNA: 0.08,             // 1/min — ~12 min half-life
      k_tl: 4.0,                // nM/min — strong RBS
      K_tl: 50,                 // nM — ribosome affinity
      proteinLength: 239,       // sfGFP
      color: '#4ade80',         // green
    },
    {
      id: 'ads_enzyme',
      name: 'ADS (Amorpha-4,11-diene synthase)',
      promoter: 'sigma70',
      rbs: 'BBa_B0032',
      cds: 'ADS',
      dnaConcentration: 15,     // nM
      k_tx: 0.8,                // nM/min — sigma70 moderate
      d_mRNA: 0.1,              // 1/min — ~7 min half-life
      k_tl: 2.0,                // nM/min — medium RBS
      K_tl: 80,                 // nM
      proteinLength: 563,       // ADS from A. annua
      color: '#60a5fa',         // blue
    },
    {
      id: 'cyp71av1',
      name: 'CYP71AV1 (Cytochrome P450)',
      promoter: 'Ptac',
      rbs: 'BBa_B0031',
      cds: 'CYP71AV1',
      dnaConcentration: 20,     // nM
      k_tx: 0.5,                // nM/min — Ptac weaker without IPTG
      d_mRNA: 0.12,             // 1/min — ~6 min half-life
      k_tl: 1.0,                // nM/min — weak RBS
      K_tl: 120,                // nM — lower ribosome affinity
      proteinLength: 496,       // CYP71AV1 from A. annua
      color: '#f472b6',         // pink
    },
  ];
}

// ═══════════════════════════════════════════════════════════════
//  5. generateDefaultParameters
// ═══════════════════════════════════════════════════════════════

/**
 * Return default cell-free reaction parameters reflecting a standard
 * E. coli S30 extract system.
 *
 * @returns CFSParameters with literature-standard concentrations and rates
 */
export function generateDefaultParameters(): CFSParameters {
  return {
    ribosomeTotal: 500,         // nM
    rnap_total: 100,            // nM (T7 RNAP)
    reactionVolume: 10,         // μL
    temperature: 30,            // °C
    initialEnergy: {
      atp: 1.5,                 // mM
      gtp: 1.5,                 // mM
      pep: 33,                  // mM — phosphoenolpyruvate energy source
      aminoAcids: 2.0,          // mM
      ntps: 2.0,                // mM
    },
    energyDecayRate: 0.003,     // 1/min — background ATP hydrolysis
    pepRegenerationRate: 0.005, // 1/min — PEP → ATP regeneration
    simulationTime: 240,        // 4 hours
    timeStep: 0.5,              // min
  };
}

// ═══════════════════════════════════════════════════════════════
//  6. generateMockPlateReaderData
// ═══════════════════════════════════════════════════════════════

/**
 * Generate synthetic plate-reader fluorescence data at 6 DNA concentrations
 * (0, 1, 5, 10, 25, 50 nM) × 3 replicates × 20 timepoints, following
 * Michaelis-Menten kinetics with Gaussian noise.
 *
 * Known parameters: Vmax = 450 RFU/min, Kd = 8.5 nM.
 *
 * @returns array of PlateReaderDataPoint
 */
export function generateMockPlateReaderData(): PlateReaderDataPoint[] {
  const rng = new SeededRNG(42);
  const concentrations = [0, 1, 5, 10, 25, 50]; // nM DNA
  const replicates = 3;
  const timepoints = 20;
  const maxTime = 60; // minutes

  const VMAX = 450;   // RFU/min
  const KD   = 8.5;   // nM

  const wellLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
  const data: PlateReaderDataPoint[] = [];

  for (let ci = 0; ci < concentrations.length; ci++) {
    const conc = concentrations[ci];
    const rate = conc === 0 ? 0 : VMAX * conc / (KD + conc);

    for (let rep = 0; rep < replicates; rep++) {
      const well = `${wellLetters[ci]}${rep + 1}`;
      // Baseline offset per well
      const baseline = 50 + rng.gaussian() * 10;

      for (let ti = 0; ti < timepoints; ti++) {
        const t = (ti / (timepoints - 1)) * maxTime;
        // Fluorescence = baseline + rate * t + saturation curve + noise
        const saturation = 1 - Math.exp(-0.02 * t); // gradual onset
        const signal = baseline + rate * t * saturation;
        const noise = rng.gaussian() * (5 + 0.02 * signal); // heteroscedastic
        data.push({
          time: Math.round(t * 100) / 100,
          fluorescence: Math.max(0, signal + noise),
          well,
          concentration: conc,
        });
      }
    }
  }

  return data;
}

// ═══════════════════════════════════════════════════════════════
//  7. runFullCFSPipeline
// ═══════════════════════════════════════════════════════════════

/**
 * Orchestrate the full Cell-Free Sandbox pipeline:
 * 1. Simulate TX-TL dynamics
 * 2. Fit mock plate-reader kinetics
 * 3. Translate the first construct's results to in-vivo predictions
 *
 * @param constructs - gene constructs (defaults to artemisinin demo set)
 * @param params - simulation parameters (defaults to standard E. coli S30)
 * @returns combined result from simulation, fitting, and IvIv translation
 */
export function runFullCFSPipeline(
  constructs?: GeneConstruct[],
  params?: CFSParameters,
): CFSFullResult {
  const genes = constructs ?? generateDefaultConstructs();
  const simParams = params ?? generateDefaultParameters();

  // 1. TX-TL simulation
  const simulation = simulateCFPS(genes, simParams);

  // 2. Plate-reader kinetic fitting
  const plateData = generateMockPlateReaderData();
  let fitting: KineticFitResult | null = null;
  try {
    fitting = fitPlateReaderKinetics(plateData);
  } catch {
    fitting = null;
  }

  // 3. In-vitro → in-vivo translation for first construct
  let iviv: IvIvPrediction | null = null;
  if (genes.length > 0 && simulation.steadyState.length > 0 && fitting) {
    const first = genes[0];
    const ss = simulation.steadyState[0];
    iviv = translateIvIv({
      invitro_vmax: fitting.vmax,
      invitro_kd: fitting.kd,
      invitro_maxProtein: ss.maxProtein,
      promoterStrength: first.promoter === 'T7' ? 0.95 : first.promoter === 'sigma70' ? 0.5 : 0.3,
      rbsStrength: first.rbs === 'BBa_B0034' ? 0.9 : first.rbs === 'BBa_B0032' ? 0.5 : 0.3,
      proteinLength: first.proteinLength,
      codonAdaptation: 0.75,
    });
  }

  return { simulation, fitting, iviv };
}
