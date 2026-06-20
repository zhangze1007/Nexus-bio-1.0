/**
 * Biosensor Design Engine
 *
 * Designs transcription factor-based biosensors for metabolite detection.
 * Models sensor response curves and optimizes dynamic range.
 *
 * Reference: Rogers et al. (2015) Molecular Cell 58:148-157
 *
 * @scientific_provenance
 *   ALGORITHM: Hill function response modeling + promoter engineering
 *   KNOWN_LIMITATIONS:
 *     - No molecular dynamics for TF-ligand binding
 *     - No promoter library screening
 *     - Simplified cross-talk model
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

// ── Hill Function Response ──────────────────────────────────────────────────

/**
 * Model biosensor response using Hill function.
 *
 * Response = (L^n) / (Kd^n + L^n)
 *
 * Where: L = ligand concentration, Kd = dissociation constant, n = Hill coefficient
 */
function hillResponse(
  ligandConc: number,
  kd: number,
  hillCoeff: number,
  basal: number = 0,
  maxSignal: number = 1,
): number {
  const signal = (ligandConc ** hillCoeff) / (kd ** hillCoeff + ligandConc ** hillCoeff);
  return basal + (maxSignal - basal) * signal;
}

/**
 * Generate a complete response curve for a biosensor.
 */
function generateResponseCurve(
  kd: number,
  hillCoeff: number,
  basal: number = 0.01,
  maxSignal: number = 1.0,
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
      signalIntensity: Math.round(hillResponse(conc, kd, hillCoeff, basal, maxSignal) * 10000) / 10000,
    });
  }

  return points;
}

// ── Sensor Design ───────────────────────────────────────────────────────────

/**
 * Design a biosensor for a target ligand.
 */
export function designBiosensor(spec: SensorSpec): BiosensorDesign {
  // Select TF based on ligand (simplified lookup)
  const tfDatabase: Record<string, { tf: string; kd: number; n: number; promoter: string }> = {
    'arabinose': { tf: 'AraC', kd: 100, n: 1.5, promoter: 'PBAD' },
    'IPTG': { tf: 'LacI', kd: 50, n: 2.0, promoter: 'Plac' },
    'aTc': { tf: 'TetR', kd: 10, n: 2.5, promoter: 'Ptet' },
    'salicylate': { tf: 'NahR', kd: 200, n: 1.8, promoter: 'Psal' },
    'acyl-HSL': { tf: 'LuxR', kd: 5, n: 2.0, promoter: 'Plux' },
    'theophylline': { tf: 'riboswitch', kd: 500, n: 1.0, promoter: 'Ptheo' },
  };

  const entry = tfDatabase[spec.targetLigand] ?? {
    tf: 'GenericTF',
    kd: spec.desiredSensitivity,
    n: 2.0,
    promoter: 'Psynthetic',
  };

  // Generate response curve
  const responseCurve = generateResponseCurve(entry.kd, entry.n);

  // Compute metrics
  const maxSignal = Math.max(...responseCurve.map(p => p.signalIntensity));
  const basalSignal = responseCurve[0].signalIntensity;
  const dynamicRange = maxSignal / Math.max(basalSignal, 0.001);

  // Find EC50 (concentration at half-max signal)
  const halfMax = (maxSignal + basalSignal) / 2;
  const ec50Point = responseCurve.find(p => p.signalIntensity >= halfMax);
  const sensitivity = ec50Point?.ligandConc ?? entry.kd;

  // Specificity (simplified — based on TF selectivity)
  const specificity = entry.n > 1.5 ? 0.8 : 0.6; // higher Hill = more specific

  // Signal-to-noise
  const signalToNoise = (maxSignal - basalSignal) / Math.max(basalSignal, 0.001);

  return {
    transcriptionFactor: entry.tf,
    ligand: spec.targetLigand,
    promoter: entry.promoter,
    responseCurve,
    dynamicRange: Math.round(dynamicRange * 100) / 100,
    sensitivity: Math.round(sensitivity * 100) / 100,
    specificity: Math.round(specificity * 100) / 100,
    signalToNoise: Math.round(signalToNoise * 100) / 100,
  };
}
