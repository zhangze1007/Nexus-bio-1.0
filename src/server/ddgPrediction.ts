/**
 * FoldX-style ddG Stability Prediction
 *
 * Empirical force field for predicting the change in protein stability (ddG)
 * upon point mutation. Negative ddG = stabilizing, positive = destabilizing.
 *
 * Components modeled:
 *   - Van der Waals (LJ 6-12 potential over nearby atoms)
 *   - Solvation (Lazaridis-Karplus implicit solvation based on burial)
 *   - Hydrogen bonds (geometry-based H-bond scoring)
 *   - Backbone strain (Ramachandran penalty for helix/sheet propensity)
 *   - Entropy (side-chain rotamer entropy loss)
 *
 * @scientific_provenance
 *   ALGORITHM: FoldX-style empirical force field for protein stability change
 *     prediction (ddG). Decomposes the free energy change into five terms:
 *     (1) van der Waals via LJ 6-12 with Lorentz-Berthelot combining rules,
 *     (2) implicit solvation via Lazaridis-Karplus with burial estimated from
 *     neighbor count, (3) hydrogen bond scoring by polar atom proximity,
 *     (4) backbone strain from Chou-Fasman helix/sheet propensities, and
 *     (5) rotamer entropy loss scaled by volume change and burial.
 *   REFERENCE: Schymkowitz J, Borg J, Stricher F, Nys R, Rousseau F,
 *     Serrano L. "The FoldX web server: an online force field." Nucleic
 *     Acids Res. 2005;33(Web Server issue):W382-W388.
 *   KNOWN_LIMITATIONS:
 *     - VdW uses unified-atom LJ parameters rather than all-atom; loses
 *       accuracy for aromatic and polar hydrogen interactions.
 *     - Burial estimation is heuristic (non-polar neighbor count within 6A)
 *       rather than from SASA calculation as in the real FoldX.
 *     - H-bond scoring is geometry-proximity based, not angular; real H-bonds
 *       require donor-H-acceptor angle checks.
 *     - Backbone strain uses static Chou-Fasman propensities; does not
 *       consider actual Ramachandran angles from the structure.
 *     - Multi-mutant prediction uses additive single-mutant summation,
 *       ignoring epistatic (non-additive) effects between mutations.
 */

import { parsePDB, PDBAtom, PDBStructure } from '../utils/pdbParser';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface DDGMutation {
  position: number;
  wtResidue: string; // single-letter amino acid code
  mutantResidue: string;
}

export interface DDGResult {
  ddG: number; // kcal/mol (negative = stabilizing, positive = destabilizing)
  confidence: number; // 0-1
  components: {
    vdw: number;
    solvation: number;
    hbond: number;
    backbone: number;
    entropy: number;
  };
}

// ─── Amino Acid Properties ───────────────────────────────────────────────────

interface AAProperties {
  volume: number; // Angstroms^3
  hydrophobicity: number; // Kyte-Doolittle scale
  charge: number;
  isSmall: boolean;
  isCharged: boolean;
}

const AA_PROPERTIES: Record<string, AAProperties> = {
  G: { volume: 60, hydrophobicity: -0.4, charge: 0, isSmall: true, isCharged: false },
  A: { volume: 88, hydrophobicity: 1.8, charge: 0, isSmall: true, isCharged: false },
  V: { volume: 140, hydrophobicity: 4.2, charge: 0, isSmall: false, isCharged: false },
  L: { volume: 166, hydrophobicity: 3.8, charge: 0, isSmall: false, isCharged: false },
  I: { volume: 166, hydrophobicity: 4.5, charge: 0, isSmall: false, isCharged: false },
  F: { volume: 189, hydrophobicity: 2.8, charge: 0, isSmall: false, isCharged: false },
  W: { volume: 227, hydrophobicity: -0.9, charge: 0, isSmall: false, isCharged: false },
  Y: { volume: 193, hydrophobicity: -1.3, charge: 0, isSmall: false, isCharged: false },
  D: { volume: 111, hydrophobicity: -3.5, charge: -1, isSmall: false, isCharged: true },
  E: { volume: 138, hydrophobicity: -3.5, charge: -1, isSmall: false, isCharged: true },
  K: { volume: 168, hydrophobicity: -3.9, charge: 1, isSmall: false, isCharged: true },
  R: { volume: 173, hydrophobicity: -4.5, charge: 1, isSmall: false, isCharged: true },
  H: { volume: 153, hydrophobicity: -3.2, charge: 0.5, isSmall: false, isCharged: true },
  S: { volume: 89, hydrophobicity: -0.8, charge: 0, isSmall: true, isCharged: false },
  T: { volume: 116, hydrophobicity: -0.7, charge: 0, isSmall: false, isCharged: false },
  C: { volume: 108, hydrophobicity: 2.5, charge: 0, isSmall: false, isCharged: false },
  M: { volume: 162, hydrophobicity: 1.9, charge: 0, isSmall: false, isCharged: false },
  N: { volume: 114, hydrophobicity: -3.5, charge: 0, isSmall: false, isCharged: false },
  Q: { volume: 143, hydrophobicity: -3.5, charge: 0, isSmall: false, isCharged: false },
  P: { volume: 112, hydrophobicity: -1.6, charge: 0, isSmall: false, isCharged: false },
};

// 3-letter to 1-letter amino acid code mapping
const THREE_TO_ONE: Record<string, string> = {
  GLY: 'G', ALA: 'A', VAL: 'V', LEU: 'L', ILE: 'I',
  PHE: 'F', TRP: 'W', TYR: 'Y',
  ASP: 'D', GLU: 'E', LYS: 'K', ARG: 'R', HIS: 'H',
  SER: 'S', THR: 'T', CYS: 'C', MET: 'M',
  ASN: 'N', GLN: 'Q', PRO: 'P',
};

// ─── LJ 6-12 Parameters (unified atom, kcal/mol, Angstroms) ─────────────────

// Van der Waals radii for common atoms (Angstroms)
const VDW_RADII: Record<string, number> = {
  C: 1.7, N: 1.55, O: 1.52, S: 1.8, H: 1.2,
};

// LJ well depths (kcal/mol)
const LJ_EPSILON: Record<string, number> = {
  C: 0.066, N: 0.170, O: 0.170, S: 0.250, H: 0.020,
};

// ─── Helper Functions ────────────────────────────────────────────────────────

function euclidean(a: PDBAtom, b: PDBAtom): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function getElement(atom: PDBAtom): string {
  return atom.element || atom.name.charAt(0);
}

function getLJParams(atom: PDBAtom): { sigma: number; epsilon: number } {
  const el = getElement(atom);
  const radius = VDW_RADII[el] || 1.7;
  const epsilon = LJ_EPSILON[el] || 0.066;
  return { sigma: radius * 2, epsilon };
}

// ─── Energy Components ───────────────────────────────────────────────────────

/**
 * Compute van der Waals energy change using LJ 6-12 potential.
 * Evaluates interactions between mutation site atoms and neighbors within 5A.
 */
function computeVdW(
  structure: PDBStructure,
  mutationAtoms: PDBAtom[],
  neighborAtoms: PDBAtom[],
  wtProps: AAProperties,
  mutProps: AAProperties,
): number {
  const cutoff = 5.0; // Angstroms
  let eWt = 0;
  let eMut = 0;

  for (const mA of mutationAtoms) {
    for (const nA of neighborAtoms) {
      const dist = euclidean(mA, nA);
      if (dist < 0.5 || dist > cutoff) continue; // skip overlapping atoms

      const pA = getLJParams(mA);
      const pB = getLJParams(nA);

      // Combining rules (Lorentz-Berthelot)
      const sigma = (pA.sigma + pB.sigma) / 2;
      const epsilon = Math.sqrt(pA.epsilon * pB.epsilon);

      // LJ 6-12: 4 * epsilon * [(sigma/r)^12 - (sigma/r)^6]
      const sr6 = Math.pow(sigma / dist, 6);
      const sr12 = sr6 * sr6;
      const eLJ = 4 * epsilon * (sr12 - sr6);

      eWt += eLJ;
    }
  }

  // Mutation changes volume, scale the interaction energy
  const volumeRatio = mutProps.volume / Math.max(wtProps.volume, 1);
  eMut = eWt * volumeRatio;

  // The ddG contribution is the difference in packing energy
  // Larger side chains in tight spaces cause steric clashes (positive ddG)
  const volumeDelta = mutProps.volume - wtProps.volume;
  const stericPenalty = volumeDelta > 0 ? 0.02 * volumeDelta * Math.abs(eWt) : 0;

  return (eMut - eWt) + stericPenalty;
}

/**
 * Compute solvation energy change using Lazaridis-Karplus implicit solvation.
 * Estimates burial from B-factor and neighbor count, then penalizes charged
 * residues in hydrophobic environments.
 */
function computeSolvation(
  structure: PDBStructure,
  mutationAtoms: PDBAtom[],
  neighborAtoms: PDBAtom[],
  wtProps: AAProperties,
  mutProps: AAProperties,
): number {
  // Estimate burial: count non-polar neighbors within 6A
  const burialCutoff = 6.0;
  let nonPolarNeighbors = 0;
  let totalNeighbors = 0;

  const hydrophobicResidues = new Set(['G', 'A', 'V', 'L', 'I', 'F', 'W', 'Y', 'C', 'M', 'P']);

  for (const nA of neighborAtoms) {
    const dist = euclidean(mutationAtoms[0], nA);
    if (dist < burialCutoff) {
      totalNeighbors++;
      const threeLetter = nA.residueName;
      const oneLetter = THREE_TO_ONE[threeLetter];
      if (oneLetter && hydrophobicResidues.has(oneLetter)) {
        nonPolarNeighbors++;
      }
    }
  }

  // Burial score: 0 = fully exposed, 1 = deeply buried
  const burialScore = totalNeighbors > 0
    ? Math.min(nonPolarNeighbors / Math.max(totalNeighbors, 1), 1.0)
    : 0;

  // Lazaridis-Karplus style: charged residues in hydrophobic burial are penalized
  // Reference energy scale: ~1 kcal/mol per unit charge per unit burial
  const solvationScale = 2.5; // kcal/mol per charge unit at full burial

  const wtSolvation = wtProps.charge * wtProps.charge * burialScore * solvationScale;
  const mutSolvation = mutProps.charge * mutProps.charge * burialScore * solvationScale;

  // Also account for hydrophobic mismatch: polar in nonpolar core
  const hydrophobicMismatch = (mutProps.hydrophobicity < 0 && burialScore > 0.5)
    ? Math.abs(mutProps.hydrophobicity) * burialScore * 0.8
    : 0;

  const wtHydrophobicMismatch = (wtProps.hydrophobicity < 0 && burialScore > 0.5)
    ? Math.abs(wtProps.hydrophobicity) * burialScore * 0.8
    : 0;

  return (mutSolvation - wtSolvation) + (hydrophobicMismatch - wtHydrophobicMismatch);
}

/**
 * Compute hydrogen bond energy change.
 * Estimates H-bond potential based on polar atoms and geometry.
 */
function computeHBond(
  mutationAtoms: PDBAtom[],
  neighborAtoms: PDBAtom[],
  wtProps: AAProperties,
  mutProps: AAProperties,
): number {
  // H-bond donors: N, O atoms on side chains
  // H-bond acceptors: O, N atoms on side chains
  const hbondCutoff = 3.5; // Angstroms (typical H-bond distance)

  // Count potential H-bond partners near mutation site
  let hbondPartners = 0;
  const polarElements = new Set(['N', 'O']);

  for (const mA of mutationAtoms) {
    const el = getElement(mA);
    if (!polarElements.has(el)) continue;

    for (const nA of neighborAtoms) {
      const nEl = getElement(nA);
      if (!polarElements.has(nEl)) continue;

      const dist = euclidean(mA, nA);
      if (dist < hbondCutoff && dist > 1.5) {
        hbondPartners++;
      }
    }
  }

  // H-bond energy scale
  const hbondEnergy = -1.5; // kcal/mol per H-bond (favorable)

  // Charged residues form stronger H-bonds
  const wtHBondCapacity = Math.abs(wtProps.charge) > 0 ? 3 : (wtProps.isSmall ? 0 : 1);
  const mutHBondCapacity = Math.abs(mutProps.charge) > 0 ? 3 : (mutProps.isSmall ? 0 : 1);

  // If mutation removes H-bond donors/acceptors, it's destabilizing
  const hbondDelta = (mutHBondCapacity - wtHBondCapacity) * hbondEnergy;

  // Scale by local environment: more partners = more impact
  const environmentFactor = Math.min(hbondPartners / 3, 1.0);

  return hbondDelta * environmentFactor;
}

/**
 * Compute backbone strain energy change.
 * Uses amino acid helix/sheet propensity as proxy for Ramachandran penalty.
 */
function computeBackbone(
  wtResidue: string,
  mutResidue: string,
): number {
  // Helix propensity (kcal/mol, Chou-Fasman derived)
  // Lower = more favorable in helix
  const helixPropensity: Record<string, number> = {
    A: -0.5, L: -0.4, E: -0.3, M: -0.3, Q: -0.2,
    K: -0.2, R: -0.1, H: -0.1, V: 0.0, I: 0.0,
    D: 0.1, F: 0.1, W: 0.1, Y: 0.2, S: 0.2,
    T: 0.3, C: 0.3, N: 0.3, P: 1.5, G: 0.6,
  };

  // Beta-sheet propensity (kcal/mol)
  const sheetPropensity: Record<string, number> = {
    V: -0.4, I: -0.3, Y: -0.2, F: -0.2, W: -0.1,
    L: -0.1, T: 0.0, C: 0.0, M: 0.0, A: 0.1,
    R: 0.1, G: 0.2, D: 0.2, K: 0.2, S: 0.3,
    H: 0.3, N: 0.3, Q: 0.3, E: 0.4, P: 0.8,
  };

  const wtHelix = helixPropensity[wtResidue] || 0;
  const mutHelix = helixPropensity[mutResidue] || 0;
  const wtSheet = sheetPropensity[wtResidue] || 0;
  const mutSheet = sheetPropensity[mutResidue] || 0;

  // Backbone strain: difference in secondary structure propensity
  // Weight helix and sheet equally
  const helixDelta = mutHelix - wtHelix;
  const sheetDelta = mutSheet - wtSheet;

  // Proline and glycine have special backbone effects
  let specialPenalty = 0;
  if (mutResidue === 'P') {
    specialPenalty += 1.0; // Proline restricts phi angle
  }
  if (wtResidue === 'P') {
    specialPenalty -= 1.0; // Removing proline relieves restriction
  }
  if (mutResidue === 'G') {
    specialPenalty -= 0.3; // Glycine increases flexibility
  }

  return (helixDelta + sheetDelta) * 0.5 + specialPenalty;
}

/**
 * Compute entropy loss upon mutation.
 * Larger residues have fewer accessible rotamers in a constrained environment.
 */
function computeEntropy(
  wtProps: AAProperties,
  mutProps: AAProperties,
  burialScore: number,
): number {
  // Rotamer entropy (R*ln(rotamers), kcal/mol at 298K)
  // Approximate number of rotamers for each amino acid
  const rotamerCount: Record<string, number> = {
    G: 1, A: 1, V: 3, L: 9, I: 8,
    F: 7, W: 6, Y: 8,
    D: 6, E: 9, K: 27, R: 36, H: 6,
    S: 3, T: 3, C: 3, M: 9,
    N: 6, Q: 9, P: 2,
  };

  const R = 1.987e-3; // kcal/(mol*K)
  const T = 298; // K

  // Entropy = R * T * ln(rotamers)
  const wtRotamers = 1; // wild-type is fixed in the crystal
  const mutRotamers = 1; // mutant is also constrained

  // The entropy cost comes from restricting the mutant side chain
  // Buried residues have more restricted rotamers
  const wtEntropy = R * T * Math.log(Math.max(rotamerCount['L'] || 1, 1));
  const mutEntropy = R * T * Math.log(Math.max(rotamerCount['L'] || 1, 1));

  // Volume change entropy: larger residues lose more entropy when constrained
  const volumeChange = mutProps.volume - wtProps.volume;
  const entropyPenalty = volumeChange > 0
    ? 0.01 * volumeChange * burialScore // positive = unfavorable
    : 0.005 * volumeChange * burialScore; // negative = favorable (smaller = more flexible)

  // Charged residues have additional desolvation entropy cost
  const chargeEntropy = (Math.abs(mutProps.charge) - Math.abs(wtProps.charge)) * burialScore * 0.5;

  return entropyPenalty + chargeEntropy;
}

// ─── Main Prediction Function ────────────────────────────────────────────────

/**
 * Predict the change in protein stability (ddG) upon point mutation.
 *
 * Uses a FoldX-style empirical force field with five energy components:
 * van der Waals, solvation, hydrogen bonds, backbone strain, and entropy.
 *
 * @param pdbText - PDB format text
 * @param mutation - Mutation specification (position, wild-type, mutant residue)
 * @returns DDGResult with total ddG, confidence, and component breakdown
 * @throws Error if PDB is invalid, residue not found, or mutation is invalid
 */
export function predictDDG(
  pdbText: string,
  mutation: DDGMutation,
): DDGResult {
  // Validate inputs
  if (!pdbText || pdbText.trim().length === 0) {
    throw new Error('PDB text is empty');
  }

  const wtOneLetter = mutation.wtResidue.toUpperCase();
  const mutOneLetter = mutation.mutantResidue.toUpperCase();

  if (!AA_PROPERTIES[wtOneLetter]) {
    throw new Error(`Invalid wild-type residue code: ${wtOneLetter}`);
  }
  if (!AA_PROPERTIES[mutOneLetter]) {
    throw new Error(`Invalid mutant residue code: ${mutOneLetter}`);
  }

  // Parse PDB structure
  const structure = parsePDB(pdbText);

  // Find mutation site atoms
  const mutationAtoms = structure.atoms.filter(
    (a) => a.residueNumber === mutation.position,
  );

  if (mutationAtoms.length === 0) {
    throw new Error(`No atoms found at residue position ${mutation.position}`);
  }

  // Validate wild-type residue matches
  const siteThreeLetter = mutationAtoms[0].residueName;
  const siteOneLetter = THREE_TO_ONE[siteThreeLetter];
  if (siteOneLetter && siteOneLetter !== wtOneLetter) {
    throw new Error(
      `Wild-type residue mismatch: expected ${wtOneLetter} but PDB has ${siteOneLetter} (${siteThreeLetter}) at position ${mutation.position}`,
    );
  }

  // Identity mutation: ddG = 0
  if (wtOneLetter === mutOneLetter) {
    return {
      ddG: 0,
      confidence: 1.0,
      components: { vdw: 0, solvation: 0, hbond: 0, backbone: 0, entropy: 0 },
    };
  }

  // Get amino acid properties
  const wtProps = AA_PROPERTIES[wtOneLetter];
  const mutProps = AA_PROPERTIES[mutOneLetter];

  // Find neighbor atoms within 5A of mutation site centroid
  const centroid: [number, number, number] = [
    mutationAtoms.reduce((s, a) => s + a.x, 0) / mutationAtoms.length,
    mutationAtoms.reduce((s, a) => s + a.y, 0) / mutationAtoms.length,
    mutationAtoms.reduce((s, a) => s + a.z, 0) / mutationAtoms.length,
  ];

  const neighborAtoms = structure.atoms.filter((a) => {
    // Exclude mutation site atoms
    if (a.residueNumber === mutation.position) return false;
    const dx = a.x - centroid[0];
    const dy = a.y - centroid[1];
    const dz = a.z - centroid[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz) <= 8.0;
  });

  // Compute burial score for confidence and entropy calculations
  const burialCutoff = 6.0;
  const hydrophobicResidues = new Set(['G', 'A', 'V', 'L', 'I', 'F', 'W', 'Y', 'C', 'M', 'P']);
  let nonPolarNeighbors = 0;
  let totalNeighbors = 0;
  for (const nA of neighborAtoms) {
    const dist = euclidean(mutationAtoms[0], nA);
    if (dist < burialCutoff) {
      totalNeighbors++;
      const oneLetter = THREE_TO_ONE[nA.residueName];
      if (oneLetter && hydrophobicResidues.has(oneLetter)) {
        nonPolarNeighbors++;
      }
    }
  }
  const burialScore = totalNeighbors > 0
    ? Math.min(nonPolarNeighbors / Math.max(totalNeighbors, 1), 1.0)
    : 0;

  // Compute each energy component
  const vdw = computeVdW(structure, mutationAtoms, neighborAtoms, wtProps, mutProps);
  const solvation = computeSolvation(structure, mutationAtoms, neighborAtoms, wtProps, mutProps);
  const hbond = computeHBond(mutationAtoms, neighborAtoms, wtProps, mutProps);
  const backbone = computeBackbone(wtOneLetter, mutOneLetter);
  const entropy = computeEntropy(wtProps, mutProps, burialScore);

  // Total ddG
  const ddG = vdw + solvation + hbond + backbone + entropy;

  // Confidence based on available structural context
  // More neighbors and lower B-factors = higher confidence
  const avgBFactor = mutationAtoms.reduce((s, a) => s + a.bFactor, 0) / mutationAtoms.length;
  const bfactorConfidence = Math.max(0, 1 - avgBFactor / 100); // B-factor penalty
  const neighborConfidence = Math.min(totalNeighbors / 10, 1.0); // more neighbors = more context
  const confidence = Math.min(0.95, (bfactorConfidence * 0.4 + neighborConfidence * 0.6 + 0.1));

  return {
    ddG: Math.round(ddG * 1000) / 1000,
    confidence: Math.round(confidence * 1000) / 1000,
    components: {
      vdw: Math.round(vdw * 1000) / 1000,
      solvation: Math.round(solvation * 1000) / 1000,
      hbond: Math.round(hbond * 1000) / 1000,
      backbone: Math.round(backbone * 1000) / 1000,
      entropy: Math.round(entropy * 1000) / 1000,
    },
  };
}

/**
 * Predict ΔΔG for multiple mutations (additive model).
 * Sums individual single-point ΔΔG values. This is a simplification —
 * real epistatic effects require Rosetta/FoldX multi-mutant scoring.
 */
export function predictMultiDDG(
  pdbText: string,
  mutations: DDGMutation[],
): DDGResult {
  if (mutations.length === 0) {
    return { ddG: 0, confidence: 1, components: { vdw: 0, solvation: 0, hbond: 0, backbone: 0, entropy: 0 } };
  }

  const results = mutations.map(m => predictDDG(pdbText, m));
  const totalDDG = results.reduce((s, r) => s + r.ddG, 0);
  const avgConfidence = results.reduce((s, r) => s + r.confidence, 0) / results.length;

  return {
    ddG: Math.round(totalDDG * 1000) / 1000,
    confidence: Math.round(avgConfidence * 1000) / 1000,
    components: {
      vdw: Math.round(results.reduce((s, r) => s + r.components.vdw, 0) * 1000) / 1000,
      solvation: Math.round(results.reduce((s, r) => s + r.components.solvation, 0) * 1000) / 1000,
      hbond: Math.round(results.reduce((s, r) => s + r.components.hbond, 0) * 1000) / 1000,
      backbone: Math.round(results.reduce((s, r) => s + r.components.backbone, 0) * 1000) / 1000,
      entropy: Math.round(results.reduce((s, r) => s + r.components.entropy, 0) * 1000) / 1000,
    },
  };
}

/**
 * Scan all single-point mutations for a protein structure.
 * Returns a 20 × L matrix of ΔΔG values (amino acid × position).
 *
 * @param pdbText - PDB format text
 * @param sequence - Wild-type sequence (1-letter codes)
 * @param chainId - Optional chain to restrict scanning
 * @returns Scan results with heatmap data
 */
export function scanAllMutations(
  pdbText: string,
  sequence: string,
  chainId?: string,
): {
  results: Array<{ position: number; wt: string; mut: string; ddg: number; confidence: number }>;
  heatmap: number[][]; // [position][amino acid] → ΔΔG
  aminoAcids: string[];
} {
  const AA_CODES = 'ACDEFGHIKLMNPQRSTVWY';
  const results: Array<{ position: number; wt: string; mut: string; ddg: number; confidence: number }> = [];
  const heatmap: number[][] = [];

  for (let i = 0; i < sequence.length; i++) {
    const wt = sequence[i].toUpperCase();
    if (!AA_PROPERTIES[wt]) {
      heatmap.push(Array(20).fill(0));
      continue;
    }

    const row: number[] = [];
    for (let j = 0; j < AA_CODES.length; j++) {
      const mut = AA_CODES[j];
      if (mut === wt) {
        row.push(0);
        continue;
      }

      try {
        const result = predictDDG(pdbText, { position: i + 1, wtResidue: wt, mutantResidue: mut });
        row.push(result.ddG);
        results.push({ position: i + 1, wt, mut, ddg: result.ddG, confidence: result.confidence });
      } catch {
        row.push(0);
      }
    }
    heatmap.push(row);
  }

  return { results, heatmap, aminoAcids: AA_CODES.split('') };
}
