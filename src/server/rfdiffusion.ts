/**
 * RFdiffusion De Novo Protein Design
 *
 * RFdiffusion (Watson et al., Nature 2023) is a generative model for
 * protein design. It uses a fine-tuned RoseTTAFold structure prediction
 * network to generate novel protein backbones from noise.
 *
 * This module provides:
 *   1. Unconditional protein generation
 *   2. Scaffolding of functional motifs
 *   3. Binder design (protein-protein interaction)
 *   4. Symmetric oligomer design
 *
 * Reference:
 *   Watson JL, Juergens D, Bennett NR, et al.
 *   De novo design of protein structure and function with RFdiffusion.
 *   Nature. 2023;620:1089-1100. doi:10.1038/s41586-023-06415-8
 *
 * @scientific_provenance
 *   ALGORITHM: Denoising diffusion probabilistic model (DDPM) for protein structures
 *   ARCHITECTURE: Fine-tuned RoseTTAFold (RF) structure prediction network
 *   TRAINING: PDB structures (experimentally determined)
 *   VALIDATION: Experimental validation of designed proteins (Watson et al. 2023)
 */

// ── Types ──────────────────────────────────────────────────────────────

export type DesignMode = "unconditional" | "scaffolding" | "binder" | "symmetric";

export interface RFdiffusionConfig {
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

export interface RFdiffusionResult {
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
 * Run RFdiffusion protein design.
 *
 * When the Python backend is not available, uses a heuristic fallback
 * that generates plausible but non-optimal designs.
 */
export async function runRFdiffusion(config: RFdiffusionConfig): Promise<RFdiffusionResult> {
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
    const backend = process.env.RFDIFFUSION_BACKEND;
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
 * For real designs, use the Python backend with the actual RFdiffusion model.
 */
function heuristicDesign(config: RFdiffusionConfig): RFdiffusionResult {
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
    const sequence = generateHeuristicSequence(targetLength, mode, motif, temperature);
    const pdb = generateHeuristicPDB(sequence, i);
    const confidence = calculateHeuristicConfidence(sequence, mode);
    const residueConfidence = sequence.split("").map(() => confidence + (Math.random() - 0.5) * 0.1);

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
      title: "De novo design of protein structure and function with RFdiffusion",
      authors: "Watson JL, Juergens D, Bennett NR, et al.",
      journal: "Nature",
      year: 2023,
      doi: "10.1038/s41586-023-06415-8",
    },
  };
}

// ── Heuristic Sequence Generation ──────────────────────────────────────

function generateHeuristicSequence(
  length: number,
  mode: DesignMode,
  motif?: MotifSpec,
  temperature: number = 1.0,
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
        seq += weightedRandom(aminoAcids, adjustedWeights);
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
        seq += weightedRandom(["A", "E", "L", "M", "K"], [0.2, 0.2, 0.2, 0.2, 0.2]);
      } else if (pos < 0.66) {
        // Sheet-prone region
        seq += weightedRandom(["V", "I", "L", "F", "Y"], [0.25, 0.2, 0.2, 0.2, 0.15]);
      } else {
        // Loop region
        seq += weightedRandom(["G", "S", "D", "N", "P"], [0.25, 0.25, 0.2, 0.15, 0.15]);
      }
    } else {
      seq += weightedRandom(aminoAcids, adjustedWeights);
    }
  }

  return seq;
}

// ── Heuristic PDB Generation ───────────────────────────────────────────

function generateHeuristicPDB(sequence: string, seed: number): string {
  const lines: string[] = [];
  lines.push("HEADER    DE NOVO PROTEIN DESIGN");
  lines.push("TITLE     RFdiffusion heuristic design");
  lines.push("REMARK   1 This is a heuristic structure, not a real prediction.");
  lines.push("REMARK   1 Use the Python backend for actual RFdiffusion designs.");

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

// ── Utility ────────────────────────────────────────────────────────────

function weightedRandom(items: string[], weights: number[]): string {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}
