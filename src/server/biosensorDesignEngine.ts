/**
 * Biosensor Design Engine
 *
 * Designs transcription factor-based biosensors for metabolite detection.
 * Models sensor response curves using extended Hill equation with leak
 * expression, binding affinity estimation, and cross-talk analysis.
 *
 * Reference: Rogers et al. (2015) Molecular Cell 58:148-157
 * Reference: d'Oelsnitz et al. (2023) Nat Chem Biol 19:1281-1289
 *
 * @scientific_provenance
 *   ALGORITHM: Extended Hill equation + binding affinity + orthogonality scoring
 *   KNOWN_LIMITATIONS:
 *     - Binding affinity is empirical (no physics-based FEP)
 *     - Promoter library is sampled, not exhaustive
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface BiosensorDesign {
  transcriptionFactor: string;
  ligand: string;
  promoter: string;
  responseCurve: ResponsePoint[];
  dynamicRange: number;       // fold-change
  sensitivity: number;        // EC50 (µM)
  specificity: number;        // 0-1
  signalToNoise: number;
  leakExpression: number;     // basal leak (0-1)
  orthogonality: number;      // 0-1 (1 = no cross-talk)
}

export interface ResponsePoint {
  ligandConc: number;         // µM
  signalIntensity: number;    // normalized (0-1)
}

export interface SensorSpec {
  targetLigand: string;
  desiredDynamicRange: number;   // fold-change
  desiredSensitivity: number;    // EC50 in µM
  hostOrganism: string;
}

export interface CrossTalkEntry {
  sensor: string;
  ligand: string;
  signal: number;    // normalized signal (0-1)
}

// ── Extended Hill Equation ─────────────────────────────────────────────────

/**
 * Extended Hill equation with leak expression and linear background.
 *
 * Response = α + (β - α) · L^n / (Kd^n + L^n) + γ·L
 *
 * Where:
 *   α = basal leak expression (minimum signal without inducer)
 *   β = maximum induced expression
 *   γ = linear background term (non-specific activation)
 *   L = ligand concentration
 *   Kd = dissociation constant
 *   n = Hill coefficient (cooperativity)
 *
 * Reference: Rogers et al. (2015) Molecular Cell 58:148-157
 */
function extendedHillResponse(
  ligandConc: number,
  kd: number,
  hillCoeff: number,
  alpha: number = 0.01,   // leak expression
  beta: number = 1.0,     // max expression
  gamma: number = 0.0001, // linear background
): number {
  const hillTerm = (ligandConc ** hillCoeff) / (kd ** hillCoeff + ligandConc ** hillCoeff);
  return alpha + (beta - alpha) * hillTerm + gamma * ligandConc;
}

/**
 * Generate a complete response curve for a biosensor.
 */
function generateResponseCurve(
  kd: number,
  hillCoeff: number,
  alpha: number = 0.01,
  beta: number = 1.0,
  gamma: number = 0.0001,
  nPoints: number = 50,
): ResponsePoint[] {
  const points: ResponsePoint[] = [];
  const logStart = -3; // 0.001 µM
  const logEnd = 3;    // 1000 µM
  const logStep = (logEnd - logStart) / (nPoints - 1);

  for (let i = 0; i < nPoints; i++) {
    const logConc = logStart + i * logStep;
    const conc = Math.pow(10, logConc);
    points.push({
      ligandConc: Math.round(conc * 1000) / 1000,
      signalIntensity: Math.round(extendedHillResponse(conc, kd, hillCoeff, alpha, beta, gamma) * 10000) / 10000,
    });
  }

  return points;
}

// ── TF Database ────────────────────────────────────────────────────────────

/**
 * Transcription factor database with thermodynamic binding parameters.
 *
 * Each entry includes:
 *   - tf: transcription factor name
 *   - kd: dissociation constant (µM)
 *   - n: Hill coefficient
 *   - promoter: associated promoter
 *   - alpha: leak expression fraction
 *   - beta: max fold-change
 *   - crossTalk: known cross-reactive ligands
 */
const TF_DATABASE: Record<string, {
  tf: string;
  kd: number;
  n: number;
  promoter: string;
  alpha: number;
  beta: number;
  crossTalk: string[];
}> = {
  'arabinose': { tf: 'AraC', kd: 100, n: 1.5, promoter: 'PBAD', alpha: 0.005, beta: 100, crossTalk: ['glucose'] },
  'IPTG': { tf: 'LacI', kd: 50, n: 2.0, promoter: 'Plac', alpha: 0.01, beta: 50, crossTalk: [] },
  'aTc': { tf: 'TetR', kd: 10, n: 2.5, promoter: 'Ptet', alpha: 0.002, beta: 200, crossTalk: [] },
  'salicylate': { tf: 'NahR', kd: 200, n: 1.8, promoter: 'Psal', alpha: 0.01, beta: 80, crossTalk: ['benzoate'] },
  'acyl-HSL': { tf: 'LuxR', kd: 5, n: 2.0, promoter: 'Plux', alpha: 0.008, beta: 150, crossTalk: ['C6-HSL', 'C8-HSL'] },
  'theophylline': { tf: 'riboswitch', kd: 500, n: 1.0, promoter: 'Ptheo', alpha: 0.02, beta: 30, crossTalk: ['caffeine'] },
  'vanillin': { tf: 'VanR', kd: 30, n: 1.8, promoter: 'Pvan', alpha: 0.005, beta: 120, crossTalk: [] },
  'erythromycin': { tf: 'ErmR', kd: 5, n: 2.0, promoter: 'Perm', alpha: 0.003, beta: 100, crossTalk: [] },
};

// ── Binding Affinity Estimation ────────────────────────────────────────────

/**
 * Estimate TF-ligand binding affinity (ΔG_bind).
 *
 * Uses empirical relationship between Kd and ΔG:
 *   ΔG = RT · ln(Kd)
 *
 * At 37°C (310K): ΔG = 0.593 · ln(Kd) kcal/mol
 *
 * Reference: Fersht (1999) Structure and Mechanism in Protein Science
 */
function estimateBindingAffinity(kdUM: number): {
  deltaG: number;     // kcal/mol
  kon: number;        // estimated on-rate (M⁻¹s⁻¹)
  koff: number;       // estimated off-rate (s⁻¹)
  halfLife: number;   // complex half-life (s)
} {
  const RT = 0.593; // kcal/mol at 310K
  const kdM = kdUM * 1e-6; // convert to M

  const deltaG = RT * Math.log(kdM);

  // Typical kon for TF-ligand: 10^5 - 10^7 M⁻¹s⁻¹
  const kon = 1e6; // M⁻¹s⁻¹ (typical)
  const koff = kon * kdM; // s⁻¹
  const halfLife = Math.log(2) / koff;

  return {
    deltaG: Math.round(deltaG * 100) / 100,
    kon: Math.round(kon * 100) / 100,
    koff: Math.round(koff * 1e6) / 1e6, // µs⁻¹
    halfLife: Math.round(halfLife * 100) / 100,
  };
}

// ── Cross-Talk Analysis ────────────────────────────────────────────────────

/**
 * Compute cross-talk matrix between sensors and ligands.
 *
 * For each sensor-ligand pair, compute the signal when exposed to
 * a non-cognate ligand. Uses the extended Hill equation with the
 * cross-reactive Kd.
 *
 * Reference: d'Oelsnitz et al. (2023) Nat Chem Biol 19:1281-1289
 */
function computeCrossTalkMatrix(
  sensors: Array<{ tf: string; kd: number; n: number; crossTalk: string[] }>,
  ligands: string[],
): CrossTalkEntry[] {
  const entries: CrossTalkEntry[] = [];

  for (const sensor of sensors) {
    for (const ligand of ligands) {
      // Check if this ligand is cross-reactive
      const isCrossReactive = sensor.crossTalk.includes(ligand);
      const isCognate = TF_DATABASE[ligand]?.tf === sensor.tf;

      let signal = 0;
      if (isCognate) {
        signal = 1.0; // full response to cognate ligand
      } else if (isCrossReactive) {
        // Cross-reactive: reduced signal (higher Kd)
        const crossKd = sensor.kd * 10; // 10x weaker binding
        signal = extendedHillResponse(crossKd, crossKd, sensor.n, 0.01, 1.0, 0.0001);
      } else {
        // No cross-talk: minimal signal
        signal = 0.01; // basal leak only
      }

      entries.push({ sensor: sensor.tf, ligand, signal: Math.round(signal * 10000) / 10000 });
    }
  }

  return entries;
}

/**
 * Compute orthogonality score for a sensor in a multi-sensor system.
 *
 * Orthogonality = 1 - max(cross_talk) / signal_cognate
 *
 * Higher = more orthogonal (less cross-talk)
 */
function computeOrthogonality(
  sensor: string,
  crossTalkMatrix: CrossTalkEntry[],
): number {
  const cognateEntry = crossTalkMatrix.find(e => e.sensor === sensor && e.signal >= 0.9);
  const crossTalkEntries = crossTalkMatrix.filter(e => e.sensor === sensor && e.signal < 0.9);

  if (!cognateEntry || crossTalkEntries.length === 0) return 1.0;

  const maxCrossTalk = Math.max(...crossTalkEntries.map(e => e.signal));
  return Math.round(Math.max(0, 1 - maxCrossTalk / cognateEntry.signal) * 100) / 100;
}

// ── Sensor Design ──────────────────────────────────────────────────────────

/**
 * Design a biosensor for a target ligand.
 *
 * Uses extended Hill equation with leak expression, binding affinity
 * estimation, and cross-talk analysis.
 *
 * Reference: Rogers et al. (2015) Molecular Cell 58:148-157
 */
export function designBiosensor(spec: SensorSpec): BiosensorDesign {
  // Select TF from database
  const entry = TF_DATABASE[spec.targetLigand] ?? {
    tf: 'GenericTF',
    kd: spec.desiredSensitivity,
    n: 2.0,
    promoter: 'Psynthetic',
    alpha: 0.01,
    beta: 100,
    crossTalk: [],
  };

  // Generate response curve with extended Hill
  const responseCurve = generateResponseCurve(entry.kd, entry.n, entry.alpha, entry.beta);

  // Compute metrics
  const maxSignal = Math.max(...responseCurve.map(p => p.signalIntensity));
  const basalSignal = responseCurve[0].signalIntensity;
  const dynamicRange = maxSignal / Math.max(basalSignal, 0.001);

  // Find EC50 (concentration at half-max signal)
  const halfMax = (maxSignal + basalSignal) / 2;
  const ec50Point = responseCurve.find(p => p.signalIntensity >= halfMax);
  const sensitivity = ec50Point?.ligandConc ?? entry.kd;

  // Specificity: based on binding affinity and Hill coefficient
  // Higher ΔG (weaker binding) + higher Hill = more specific
  const binding = estimateBindingAffinity(entry.kd);
  const specificity = Math.min(0.99, Math.max(0.1,
    0.5 + 0.1 * entry.n + 0.01 * Math.abs(binding.deltaG)
  ));

  // Signal-to-noise
  const signalToNoise = (maxSignal - basalSignal) / Math.max(basalSignal, 0.001);

  // Leak expression
  const leakExpression = entry.alpha;

  // Orthogonality (if multiple sensors exist)
  const allSensors = Object.values(TF_DATABASE);
  const allLigands = Object.keys(TF_DATABASE);
  const crossTalkMatrix = computeCrossTalkMatrix(allSensors, allLigands);
  const orthogonality = computeOrthogonality(entry.tf, crossTalkMatrix);

  return {
    transcriptionFactor: entry.tf,
    ligand: spec.targetLigand,
    promoter: entry.promoter,
    responseCurve,
    dynamicRange: Math.round(dynamicRange * 100) / 100,
    sensitivity: Math.round(sensitivity * 100) / 100,
    specificity: Math.round(specificity * 100) / 100,
    signalToNoise: Math.round(signalToNoise * 100) / 100,
    leakExpression: Math.round(leakExpression * 10000) / 10000,
    orthogonality,
  };
}

/**
 * Design multiple biosensors and analyze cross-talk.
 *
 * Returns individual designs plus a cross-talk matrix.
 */
export function designBiosensorPanel(
  specs: SensorSpec[],
): {
  sensors: BiosensorDesign[];
  crossTalkMatrix: CrossTalkEntry[];
  systemOrthogonality: number;
} {
  const sensors = specs.map(s => designBiosensor(s));

  // Cross-talk analysis
  const allSensors = Object.values(TF_DATABASE);
  const allLigands = Object.keys(TF_DATABASE);
  const crossTalkMatrix = computeCrossTalkMatrix(allSensors, allLigands);

  // System orthogonality: average of individual orthogonality scores
  const systemOrthogonality = sensors.length > 0
    ? Math.round(sensors.reduce((s, sen) => s + sen.orthogonality, 0) / sensors.length * 100) / 100
    : 1.0;

  return { sensors, crossTalkMatrix, systemOrthogonality };
}
