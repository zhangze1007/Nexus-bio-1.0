/**
 * Group Contribution Method for Formation Energy Estimation
 *
 * Uses the Mavrovouniotis (1991) group contribution method to estimate
 * standard Gibbs free energies of formation (ΔG°f) from SMILES strings.
 *
 * Unlike the naive string-matching approach in thermoEngine.ts, this module
 * parses SMILES into a molecular graph using the proper SMILES parser, then
 * identifies functional groups by examining atomic connectivity patterns.
 *
 * @scientific_provenance
 * Mavrovouniotis (1991) J Biol Chem 266(22):14440-14445
 *
 * @module
 */

import { parseSMILES, SMILESGraph, SMILESAtom, SMILESBond } from './smilesParser';

/* ------------------------------------------------------------------ */
/*  Public interface                                                  */
/* ------------------------------------------------------------------ */

export interface GroupContributionResult {
  /** Estimated formation energy in kJ/mol */
  deltaGf: number;
  /** Confidence in the estimate (0–1) */
  confidence: number;
  /** Groups identified and their contributions */
  matchedGroups: Array<{ group: string; count: number; contribution: number }>;
}

/* ------------------------------------------------------------------ */
/*  Mavrovouniotis group contribution values (kJ/mol)                 */
/* ------------------------------------------------------------------ */

export const GROUP_CONTRIBUTIONS: Record<string, number> = {
  // Carbon skeleton groups
  CH3:       -3.6,
  CH2:        0.56,
  CH:         3.48,
  C_quat:     6.39,

  // Functional groups
  OH:       -16.2,
  COOH:     -24.4,
  NH2:       -6.6,
  NH:         2.2,
  'C=O':     15.0,
  SH:         1.7,

  // Aromatic / conjugation
  aromatic_C:  5.0,
  'C=C':      12.6,

  // Phosphate groups
  phosphate:    -25.1,
  phosphoester: -12.5,

  // Thioester / high-energy bonds
  thioester:  18.2,
  ester:      -8.2,

  // Amide / peptide
  amide:      -5.8,

  // Aldehyde
  CHO:        10.8,
};

/* ------------------------------------------------------------------ */
/*  Graph helpers                                                     */
/* ------------------------------------------------------------------ */

interface Neighbor {
  atomIdx: number;
  bond: SMILESBond;
}

/** Build an adjacency list from the parsed graph. */
function buildAdjacency(graph: SMILESGraph): Neighbor[][] {
  const adj: Neighbor[][] = graph.atoms.map(() => [] as Neighbor[]);
  for (const bond of graph.bonds) {
    adj[bond.from].push({ atomIdx: bond.to, bond });
    adj[bond.to].push({ atomIdx: bond.from, bond });
  }
  return adj;
}

/** Standard valence for common organic atoms (first-row + halogens). */
const VALENCE: Record<string, number> = {
  C: 4, N: 3, O: 2, S: 2, P: 3, H: 1, F: 1, Cl: 1, Br: 1, I: 1,
};

/** Number of explicit bonds an atom has in the graph. */
function explicitBonds(atomIdx: number, adj: Neighbor[][]): number {
  return adj[atomIdx].length;
}

/** Number of implicit hydrogens inferred from valence. */
function implicitH(atomIdx: number, graph: SMILESGraph, adj: Neighbor[][]): number {
  const atom = graph.atoms[atomIdx];
  const val = VALENCE[atom.element];
  if (val === undefined) return 0;
  const explicit = explicitBonds(atomIdx, adj);
  // Sum bond orders for implicit H calculation
  let bondOrderSum = 0;
  for (const n of adj[atomIdx]) {
    bondOrderSum += n.bond.order;
  }
  return Math.max(0, val - bondOrderSum);
}

/** Helper: does atom at `idx` have a double bond to element `el`? */
function hasDoubleBondTo(idx: number, el: string, graph: SMILESGraph, adj: Neighbor[][]): boolean {
  return adj[idx].some(n => n.bond.order === 2 && graph.atoms[n.atomIdx].element === el);
}

/** Helper: does atom at `idx` have a single bond to element `el`? */
function hasSingleBondTo(idx: number, el: string, graph: SMILESGraph, adj: Neighbor[][]): boolean {
  return adj[idx].some(n => n.bond.order === 1 && graph.atoms[n.atomIdx].element === el);
}

/** Count neighbors of a given element (any bond order). */
function countNeighborsOf(
  idx: number,
  el: string,
  graph: SMILESGraph,
  adj: Neighbor[][],
): number {
  return adj[idx].filter(n => graph.atoms[n.atomIdx].element === el).length;
}

/** Count carbonyl (C=O) neighbors of `idx`. */
function countCarbonylNeighbors(idx: number, graph: SMILESGraph, adj: Neighbor[][]): number {
  return adj[idx].filter(n => {
    const neighbor = graph.atoms[n.atomIdx];
    if (neighbor.element !== 'C') return false;
    return hasDoubleBondTo(n.atomIdx, 'O', graph, adj);
  }).length;
}

/* ------------------------------------------------------------------ */
/*  Core group detection                                              */
/* ------------------------------------------------------------------ */

/**
 * Walk the parsed SMILES graph and identify functional groups by
 * atomic connectivity patterns.
 */
function detectGroups(graph: SMILESGraph): Map<string, number> {
  const adj = buildAdjacency(graph);
  const matched = new Set<number>();
  const groups = new Map<string, number>();

  const add = (group: string, count = 1) => {
    groups.set(group, (groups.get(group) ?? 0) + count);
  };

  for (let i = 0; i < graph.atoms.length; i++) {
    if (matched.has(i)) continue;
    const atom = graph.atoms[i];
    const neighbors = adj[i];

    // ---- Carbon groups (non-aromatic) ----
    if (atom.element === 'C' && !atom.isAromatic) {
      const hasCDoubleBond = hasDoubleBondTo(i, 'C', graph, adj);

      // -- Carboxyl (COOH): C double-bonded to O and single-bonded to O --
      if (
        hasDoubleBondTo(i, 'O', graph, adj) &&
        countNeighborsOf(i, 'O', graph, adj) >= 2
      ) {
        const oNeighbors = adj[i].filter(n => graph.atoms[n.atomIdx].element === 'O');
        const hasDoubleO = oNeighbors.some(n => n.bond.order === 2);
        const hasSingleO = oNeighbors.some(n => n.bond.order === 1);
        if (hasDoubleO && hasSingleO) {
          add('COOH');
          for (const n of neighbors) matched.add(n.atomIdx);
          matched.add(i);
          continue;
        }
      }

      // -- Amide: C double-bonded to O and bonded to N --
      if (
        hasDoubleBondTo(i, 'O', graph, adj) &&
        hasSingleBondTo(i, 'N', graph, adj)
      ) {
        add('amide');
        for (const n of neighbors) matched.add(n.atomIdx);
        matched.add(i);
        continue;
      }

      // -- Thioester: C double-bonded to O and bonded to S --
      if (
        hasDoubleBondTo(i, 'O', graph, adj) &&
        hasSingleBondTo(i, 'S', graph, adj)
      ) {
        add('thioester');
        for (const n of neighbors) matched.add(n.atomIdx);
        matched.add(i);
        continue;
      }

      // -- Aldehyde (CHO): terminal C=O with at least one implicit H --
      if (
        hasDoubleBondTo(i, 'O', graph, adj) &&
        neighbors.filter(n => n.bond.order === 1).length < 3 &&
        implicitH(i, graph, adj) > 0
      ) {
        add('CHO');
        for (const n of neighbors) matched.add(n.atomIdx);
        matched.add(i);
        continue;
      }

      // -- Standalone C=O (ketone): C=O with no other heteroatom single bonds --
      // Must come before C=C and carbon skeleton checks.
      if (
        hasDoubleBondTo(i, 'O', graph, adj) &&
        !matched.has(i)
      ) {
        const otherHetero = adj[i].some(
          n => n.bond.order !== 2 && !['C'].includes(graph.atoms[n.atomIdx].element),
        );
        if (!otherHetero) {
          add('C=O');
          matched.add(i);
          for (const n of adj[i]) {
            if (graph.atoms[n.atomIdx].element === 'O') matched.add(n.atomIdx);
          }
        }
      }

      // -- C=C double bond (non-aromatic) --
      if (hasCDoubleBond && !matched.has(i)) {
        const partner = adj[i].find(n =>
          n.bond.order === 2 &&
          graph.atoms[n.atomIdx].element === 'C' &&
          !graph.atoms[n.atomIdx].isAromatic,
        );
        if (partner && !matched.has(partner.atomIdx)) {
          add('C=C');
          matched.add(i);
          matched.add(partner.atomIdx);
        }
      }

      // -- CH3 / CH2 / CH / C_quat (by heavy-atom neighbor count) --
      // These represent the carbon skeleton contribution regardless of
      // whether neighbors are C or heteroatoms. A carbon with 1 heavy-atom
      // neighbor has 3 implicit H (CH3), etc.
      if (!matched.has(i)) {
        const nCount = neighbors.length;
        if (nCount <= 1) { add('CH3'); matched.add(i); }
        else if (nCount === 2) { add('CH2'); matched.add(i); }
        else if (nCount === 3) { add('CH'); matched.add(i); }
        else if (nCount >= 4) { add('C_quat'); matched.add(i); }
      }
    }

    // ---- Aromatic carbon ----
    if (atom.element === 'C' && atom.isAromatic && !matched.has(i)) {
      add('aromatic_C');
      matched.add(i);
    }

    // ---- Nitrogen groups ----
    if (atom.element === 'N' && !atom.isAromatic && !matched.has(i)) {
      const cNeighbors = adj[i].filter(n => graph.atoms[n.atomIdx].element === 'C');
      if (cNeighbors.length === 0) continue;
      if (cNeighbors.length === 1) { add('NH2'); matched.add(i); }
      else if (cNeighbors.length >= 2) { add('NH'); matched.add(i); }
    }

    // ---- Phosphate: P with at least one double-bonded O ----
    if (atom.element === 'P' && !matched.has(i)) {
      if (hasDoubleBondTo(i, 'O', graph, adj)) {
        add('phosphate');
        matched.add(i);
        for (const n of adj[i]) {
          if (graph.atoms[n.atomIdx].element === 'O') matched.add(n.atomIdx);
        }
      }
    }

    // ---- Phosphoester: O between two C atoms, at least one C bonded to P ----
    if (
      atom.element === 'O' &&
      !matched.has(i) &&
      neighbors.length === 2
    ) {
      const [n1, n2] = neighbors;
      if (
        graph.atoms[n1.atomIdx].element === 'C' &&
        graph.atoms[n2.atomIdx].element === 'C'
      ) {
        const c1HasP = adj[n1.atomIdx].some(nb => graph.atoms[nb.atomIdx].element === 'P');
        const c2HasP = adj[n2.atomIdx].some(nb => graph.atoms[nb.atomIdx].element === 'P');
        if (c1HasP || c2HasP) {
          add('phosphoester');
          matched.add(i);
        }
      }
    }

    // ---- Sulfhydryl (SH): S single-bonded to C ----
    if (
      atom.element === 'S' &&
      !matched.has(i) &&
      hasSingleBondTo(i, 'C', graph, adj)
    ) {
      add('SH');
      matched.add(i);
    }

    // ---- Hydroxyl (OH): O single-bonded to non-carbonyl C ----
    if (
      atom.element === 'O' &&
      !matched.has(i) &&
      !atom.isAromatic &&
      neighbors.length === 1
    ) {
      const parentAtom = graph.atoms[neighbors[0].atomIdx];
      if (
        parentAtom.element === 'C' &&
        !hasDoubleBondTo(neighbors[0].atomIdx, 'O', graph, adj)
      ) {
        add('OH');
        matched.add(i);
      }
    }
  }

  return groups;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

/**
 * Estimate ΔG°f from a SMILES string using the Mavrovouniotis group
 * contribution method with proper SMILES graph parsing.
 *
 * @param smiles - SMILES string
 * @returns Formation energy estimate with confidence and matched groups
 */
export function estimateFormationEnergy(smiles: string): GroupContributionResult {
  if (!smiles || smiles.trim().length === 0) {
    return { deltaGf: 0, confidence: 0, matchedGroups: [] };
  }

  const graph = parseSMILES(smiles);

  if (graph.atoms.length === 0) {
    return { deltaGf: 0, confidence: 0, matchedGroups: [] };
  }

  const detected = detectGroups(graph);
  let totalDGf = 0;
  let totalGroups = 0;
  const matchedGroups: GroupContributionResult['matchedGroups'] = [];

  for (const [group, count] of detected) {
    const contribution = GROUP_CONTRIBUTIONS[group] ?? 0;
    totalDGf += contribution * count;
    totalGroups += count;
    matchedGroups.push({ group, count, contribution });
  }

  // Confidence heuristic based on number of identified groups
  let confidence: number;
  if (totalGroups === 0) confidence = 0;
  else if (totalGroups <= 2) confidence = 0.3;
  else if (totalGroups <= 5) confidence = 0.7;
  else confidence = 1.0;

  return {
    deltaGf: totalGroups === 0 ? 0 : totalDGf,
    confidence,
    matchedGroups,
  };
}
