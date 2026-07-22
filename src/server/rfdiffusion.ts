import { makeRng } from "../utils/rng";

/**
 * Backbone Sketch (heuristic) — De Novo Protein Design prototype
 *
 * VALIDITY TIER: demo.
 *
 * This module is a HEURISTIC backbone/sequence generator for UI prototyping.
 * It is NOT a generative diffusion model and implements no learned weights,
 * no denoising process, and no structure-prediction network. Sequences are
 * drawn from natural amino-acid frequencies with a simple secondary-structure
 * position bias; backbones are placed on an idealized helical trace. Outputs
 * are plausible-looking placeholders, not predictions.
 *
 * To obtain real de novo designs, set the DENOVO_DESIGN_BACKEND env var to a
 * hosted model endpoint; when present, `runBackboneSketch` delegates to it and
 * this heuristic is bypassed entirely. Provenance/citations belong to that
 * backend's response, not to this file.
 */

// ── Types ──────────────────────────────────────────────────────────────

export type DesignMode = "unconditional" | "scaffolding" | "binder" | "symmetric";

export interface BackboneSketchConfig {
  /** Design mode */
  mode: DesignMode;
  /** Target length (amino acids) for unconditional design */
  targetLength?: number;
  /** Motif specification for scaffolding */
  motif?: MotifSpec;
  /** Target structure for binder design */
  targetPDB?: string;
  /** Symmetry type for symmetric design */
  symmetry?: "C2" | "C3" | "C4" | "C5" | "C6";
  /** Number of design samples */
  numSamples?: number;
  /** Noise schedule steps */
  diffusionSteps?: number;
  /** Temperature for sampling */
  temperature?: number;
  /** Guidance scale */
  guidanceScale?: number;
}

export interface MotifSpec {
  /** Residue indices defining the motif */
  residueIndices: number[];
  /** Motif sequence (conserved residues) */
  sequence?: string;
  /** Motif secondary structure */
  secondaryStructure?: string;
}

export interface DesignedProtein {
  /** Unique ID */
  id: string;
  /** Designed sequence */
  sequence: string;
  /** Predicted structure (PDB format) */
  pdb: string;
  /** Predicted RMSD to target (if applicable) */
  rmsd?: number;
  /** Predicted TM-score */
  tmScore?: number;
  /** Confidence score (pLDDT-like) */
  confidence: number;
  /** Per-residue confidence */
  residueConfidence: number[];
  /** Design mode used */
  mode: DesignMode;
  /** Design metadata */
  metadata: {
    length: number;
    diffusionSteps: number;
    temperature: number;
    guidanceScale: number;
  };
}

export interface BackboneSketchResult {
  /** Designed proteins */
  proteins: DesignedProtein[];
  /** Best design (highest confidence) */
  bestDesign: DesignedProtein | null;
  /** Design statistics */
  stats: {
    meanConfidence: number;
    meanLength: number;
    successRate: number;
  };
  /** Reference */
  reference: {
    title: string;
    authors: string;
    journal: string;
    year: number;
    doi: string;
  };
}

// ── Main Design Function ───────────────────────────────────────────────

/**
 * Run heuristic backbone sketch (or delegate to a real de novo design backend).
 *
 * When DENOVO_DESIGN_BACKEND is unset, uses the heuristic fallback that
 * generates plausible but non-predictive designs (validity tier: demo).
 */
export async function runBackboneSketch(config: BackboneSketchConfig): Promise<BackboneSketchResult> {
  const {
    mode = "unconditional",
    targetLength = 100,
    numSamples = 8,
    diffusionSteps = 50,
    temperature = 1.0,
    guidanceScale = 1.0,
  } = config;

  // Try Python backend first
  try {
    const backend = process.env.DENOVO_DESIGN_BACKEND;
    if (backend) {
      const res = await fetch(`${backend}/design`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
        signal: AbortSignal.timeout(120000),
      });

      if (res.ok) {
        return await res.json();
      }
    }
  } catch {
    // Fall through to heuristic
  }

  // Heuristic fallback
  return heuristicDesign(config);
}

// ── Heuristic Design (Fallback) ────────────────────────────────────────

/**
 * Generate protein designs using heuristic methods.
 *
 * This is NOT a real diffusion model — it uses simplified rules to
 * generate plausible protein sequences and structures.
 *
 * For real designs, set DENOVO_DESIGN_BACKEND to a hosted model endpoint.
 */
function heuristicDesign(config: BackboneSketchConfig): BackboneSketchResult {
  const {
    mode = "unconditional",
    targetLength = 100,
    numSamples = 8,
    diffusionSteps = 50,
    temperature = 1.0,
    guidanceScale = 1.0,
    motif,
  } = config;

  const proteins: DesignedProtein[] = [];

  for (let i = 0; i < numSamples; i++) {
    // Deterministic per-sample stream: same config → identical designs across runs.
    const rng = makeRng(1234 + i * 7919);
    const sequence = generateHeuristicSequence(targetLength, mode, motif, temperature, rng);
    const pdb = generateHeuristicPDB(sequence, i);
    const confidence = calculateHeuristicConfidence(sequence, mode);
    const residueConfidence = heuristicResidueConfidence(sequence, confidence);

    proteins.push({
      id: `rfdiff_${i}_${Date.now().toString(36)}`,
      sequence,
      pdb,
      confidence,
      residueConfidence,
      mode,
      metadata: {
        length: sequence.length,
        diffusionSteps,
        temperature,
        guidanceScale,
      },
    });
  }

  // Sort by confidence
  proteins.sort((a, b) => b.confidence - a.confidence);

  const meanConfidence = proteins.reduce((s, p) => s + p.confidence, 0) / proteins.length;
  const meanLength = proteins.reduce((s, p) => s + p.sequence.length, 0) / proteins.length;

  return {
    proteins,
    bestDesign: proteins[0] ?? null,
    stats: {
      meanConfidence,
      meanLength,
      successRate: proteins.filter((p) => p.confidence > 0.7).length / proteins.length,
    },
    reference: {
      title: "Backbone Sketch (heuristic generator) — not a diffusion model; for UI prototyping only",
      authors: "Nexus-Bio heuristic generator",
      journal: "N/A (no published method — outputs are placeholders)",
      year: new Date().getFullYear(),
      doi: "",
    },
  };
}

// ── Heuristic Sequence Generation ──────────────────────────────────────

export function generateHeuristicSequence(
  length: number,
  mode: DesignMode,
  motif: MotifSpec | undefined,
  temperature: number,
  rng: () => number,
): string {
  // Amino acid frequencies in natural proteins (approximate)
  const aaFreq: Record<string, number> = {
    A: 0.082,
    C: 0.013,
    D: 0.054,
    E: 0.067,
    F: 0.039,
    G: 0.069,
    H: 0.023,
    I: 0.053,
    K: 0.059,
    L: 0.096,
    M: 0.023,
    N: 0.043,
    P: 0.052,
    Q: 0.042,
    R: 0.052,
    S: 0.074,
    T: 0.058,
    V: 0.066,
    W: 0.013,
    Y: 0.033,
  };

  const aminoAcids = Object.keys(aaFreq);
  const weights = Object.values(aaFreq);

  // Temperature modulates the sampling distribution: w^(1/T). T=1 is a no-op;
  // T<1 sharpens toward dominant residues, T>1 flattens toward uniform. This is
  // where `temperature` enters the heuristic sampler (previously ignored).
  const tSampling = Math.max(temperature, 1e-6);
  const tw = (w: number[]): number[] => w.map((x) => x ** (1 / tSampling));

  // Adjust weights based on mode
  const adjustedWeights = [...weights];

  if (mode === "scaffolding" && motif?.sequence) {
    // Keep motif residues fixed
    const motifSeq = motif.sequence;
    const startIdx = motif.residueIndices[0] ?? 0;
    let seq = "";

    for (let i = 0; i < length; i++) {
      const motifIdx = i - startIdx;
      if (motifIdx >= 0 && motifIdx < motifSeq.length) {
        seq += motifSeq[motifIdx];
      } else {
        seq += weightedRandom(aminoAcids, tw(adjustedWeights), rng);
      }
    }
    return seq;
  }

  // Generate random sequence
  let seq = "";
  for (let i = 0; i < length; i++) {
    // Add some local structure bias (helix/sheet formers)
    const pos = i / length;
    if (mode === "unconditional") {
      // Alternate between helix and sheet formers
      if (pos < 0.33) {
        // Helix-prone region
        seq += weightedRandom(["A", "E", "L", "M", "K"], tw([0.2, 0.2, 0.2, 0.2, 0.2]), rng);
      } else if (pos < 0.66) {
        // Sheet-prone region
        seq += weightedRandom(["V", "I", "L", "F", "Y"], tw([0.25, 0.2, 0.2, 0.2, 0.15]), rng);
      } else {
        // Loop region
        seq += weightedRandom(["G", "S", "D", "N", "P"], tw([0.25, 0.25, 0.2, 0.15, 0.15]), rng);
      }
    } else {
      seq += weightedRandom(aminoAcids, tw(adjustedWeights), rng);
    }
  }

  return seq;
}

// ── Heuristic PDB Generation ───────────────────────────────────────────

function generateHeuristicPDB(sequence: string, seed: number): string {
  const lines: string[] = [];
  lines.push("HEADER    DE NOVO PROTEIN DESIGN");
  lines.push("TITLE     Backbone Sketch (heuristic design)");
  lines.push("REMARK   1 This is a heuristic structure, not a real prediction.");
  lines.push("REMARK   1 Set DENOVO_DESIGN_BACKEND for actual de novo model designs.");

  let atomIdx = 1;
  const phi = (-57.8 * Math.PI) / 180; // Typical alpha helix phi
  const psi = (-47.0 * Math.PI) / 180; // Typical alpha helix psi
  const bondLength = 3.8; // Angstroms

  let x = 0,
    y = 0,
    z = 0;

  for (let i = 0; i < sequence.length; i++) {
    const aa = sequence[i];
    const resSeq = (i + 1).toString().padStart(4);

    // Generate CA position using dihedral angles
    if (i > 0) {
      x += bondLength * Math.cos(phi);
      y += bondLength * Math.sin(phi) * Math.cos(psi);
      z += bondLength * Math.sin(phi) * Math.sin(psi);
    }

    // Add some noise for realism
    const noise = 0.1;
    x += Math.sin(i * 2.3 + seed) * noise;
    y += Math.cos(i * 1.7 + seed) * noise;
    z += Math.sin(i * 3.1 + seed * 2) * noise;

    // CA atom
    lines.push(
      `ATOM  ${atomIdx.toString().padStart(5)} CA  ${aa.padEnd(3)} A${resSeq}    ${x.toFixed(3).padStart(8)}${y.toFixed(3).padStart(8)}${z.toFixed(3).padStart(8)}  1.00  0.00           C  `,
    );
    atomIdx++;

    // N atom (offset)
    lines.push(
      `ATOM  ${atomIdx.toString().padStart(5)} N   ${aa.padEnd(3)} A${resSeq}    ${(x - 1.2).toFixed(3).padStart(8)}${(y + 0.8).toFixed(3).padStart(8)}${(z - 0.5).toFixed(3).padStart(8)}  1.00  0.00           N  `,
    );
    atomIdx++;

    // C atom (offset)
    lines.push(
      `ATOM  ${atomIdx.toString().padStart(5)} C   ${aa.padEnd(3)} A${resSeq}    ${(x + 1.5).toFixed(3).padStart(8)}${(y - 0.3).toFixed(3).padStart(8)}${(z + 0.8).toFixed(3).padStart(8)}  1.00  0.00           C  `,
    );
    atomIdx++;
  }

  lines.push("END");
  return lines.join("\n");
}

// ── Confidence Calculation ─────────────────────────────────────────────

function calculateHeuristicConfidence(sequence: string, mode: DesignMode): number {
  let confidence = 0.6; // Base confidence for heuristic

  // GC-like content (hydrophobic core stability)
  const hydrophobic = (sequence.match(/[VILFMWY]/gi) ?? []).length;
  const hydrophobicRatio = hydrophobic / sequence.length;
  if (hydrophobicRatio >= 0.3 && hydrophobicRatio <= 0.5) {
    confidence += 0.15;
  }

  // Avoid long stretches of same amino acid
  let maxRepeat = 0;
  let currentRepeat = 1;
  for (let i = 1; i < sequence.length; i++) {
    if (sequence[i] === sequence[i - 1]) {
      currentRepeat++;
      maxRepeat = Math.max(maxRepeat, currentRepeat);
    } else {
      currentRepeat = 1;
    }
  }
  if (maxRepeat > 5) confidence -= 0.2;
  else if (maxRepeat <= 3) confidence += 0.05;

  // Mode-specific adjustments
  if (mode === "scaffolding") confidence += 0.1;
  if (mode === "binder") confidence -= 0.05; // Harder to design

  return Math.max(0.3, Math.min(0.95, confidence));
}

/**
 * Deterministic per-residue confidence proxy.
 *
 * NOT model per-residue pLDDT. This is a clearly-heuristic estimate: buried
 * hydrophobic core residues are treated as more "confident" than exposed/loop
 * residues, and chain termini are down-weighted (they are typically flexible).
 * The result is fully deterministic given the sequence and base confidence —
 * no randomness — so the same input always yields the same profile.
 */
function heuristicResidueConfidence(sequence: string, baseConfidence: number): number[] {
  const hydrophobic = new Set(["V", "I", "L", "F", "M", "W", "Y", "A", "C"]);
  const n = sequence.length;
  return sequence.split("").map((aa, i) => {
    // Terminal down-weight: cosine taper over the first/last ~10% of the chain.
    const edge = Math.min(i, n - 1 - i) / Math.max(1, n - 1);
    const terminusFactor = 0.85 + 0.15 * Math.min(1, edge / 0.1);
    // Hydrophobic residues get a small confidence bump (core-forming proxy).
    const coreBonus = hydrophobic.has(aa) ? 0.05 : -0.03;
    const v = baseConfidence * terminusFactor + coreBonus;
    return Math.max(0.1, Math.min(0.99, v));
  });
}

// ── Utility ────────────────────────────────────────────────────────────

function weightedRandom(items: string[], weights: number[], rng: () => number): string {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}
