/**
 * Retrosynthesis Engine
 *
 * Finds metabolic pathways from a target molecule back to central metabolites
 * using a backward BFS over reaction rules loaded from src/data/reactionRules.json.
 *
 * Algorithm:
 *   1. Normalize the target SMILES and seed the BFS frontier.
 *   2. At each depth level, for every frontier molecule, find rules whose
 *      products contain the molecule (exact normalized-SMILES match).
 *   3. Replace that molecule with the rule's reactants — these are the
 *      precursors we need to supply.
 *   4. If all molecules in a state are central metabolites, record the path.
 *   5. Continue BFS until maxSteps depth or no new states.
 *   6. Rank pathways by: 1/(length+1) + enzyme_availability + thermodynamic_feasibility.
 */

import * as path from 'path';
import * as fs from 'fs';

/* ------------------------------------------------------------------ */
/*  Public interfaces                                                 */
/* ------------------------------------------------------------------ */

export interface RetrosynthesisRequest {
  targetSmiles: string;
  precursorSmiles?: string;
  maxSteps?: number;     // default 5
  maxPathways?: number;  // default 10
}

export interface ReactionRule {
  id: string;
  name: string;
  enzymeClass: string;
  reactants: string[];
  products: string[];
  reversibility: boolean;
  cofactors: string[];
}

export interface PathwayStep {
  ruleId: string;
  ruleName: string;
  enzymeClass: string;
  reactantSmiles: string[];
  productSmiles: string[];
  reversibility: boolean;
  cofactors: string[];
}

export interface Pathway {
  steps: PathwayStep[];
  length: number;
  score: number;
}

export interface RetrosynthesisResult {
  pathways: Pathway[];
  targetSmiles: string;
  totalTime: number;
}

/* ------------------------------------------------------------------ */
/*  SMILES normalization                                              */
/* ------------------------------------------------------------------ */

/**
 * Normalize a SMILES string for comparison.
 * Removes stereo markers (@, /, \\) and trims whitespace so that
 * different valid SMILES for the same molecule are more likely to match.
 */
export function normalizeSmiles(smiles: string): string {
  return smiles
    .replace(/\\/g, '')
    .replace(/\//g, '')
    .replace(/@/g, '')
    .trim();
}

/* ------------------------------------------------------------------ */
/*  Central metabolites                                               */
/* ------------------------------------------------------------------ */

const CENTRAL_METABOLITES: Record<string, string> = {
  'pyruvate':            'CC(=O)C(O)=O',
  'acetyl_coa':          'CC(=O)SC(=O)O',
  'oxaloacetate':        'OC(=O)C(=O)CC(O)=O',
  'glucose':             'OCC1OC(O)C(O)C(O)C1O',
  'glucose_6_phosphate': 'OC[C@H]1OC(O)[C@H](O)[C@@H]1OP(O)(O)=O',
  'fructose_6_phosphate':'OC[C@H]1OC(OP(O)(O)=O)[C@@H](O)[C@H]1O',
  'g3p':                 'OCC(O)C(OP(O)(O)=O)=O',
  'dhap':                'OCC(OP(O)(O)=O)=O',
  'succinate':           'OC(=O)CCC(O)=O',
  'glycerol':            'OCC(O)CO',
  'glyceraldehyde':      'OCC=O',
  'acetate':             'CC(O)=O',
  'lactate':             'CC(O)C(O)=O',
  'ethanol':             'CCO',
  'aspartate':           'NC(CC(O)=O)C(O)=O',
  'glutamate':           'NC(CCC(O)=O)C(O)=O',
  'glycine':             'NCC(O)=O',
  'ribose_5_phosphate':  'OCC1OC(O)C(O)C1OP(O)(O)=O',
};

const CENTRAL_NORM = new Map<string, string>();
for (const [name, smi] of Object.entries(CENTRAL_METABOLITES)) {
  CENTRAL_NORM.set(normalizeSmiles(smi), name);
}

/* ------------------------------------------------------------------ */
/*  Load reaction rules                                               */
/* ------------------------------------------------------------------ */

function loadReactionRules(): ReactionRule[] {
  const rulesPath = path.join(__dirname, '..', 'data', 'reactionRules.json');
  const raw = fs.readFileSync(rulesPath, 'utf-8');
  return JSON.parse(raw) as ReactionRule[];
}

const REACTION_RULES = loadReactionRules();

/* ------------------------------------------------------------------ */
/*  Scoring helpers                                                   */
/* ------------------------------------------------------------------ */

/** Enzyme availability from the first digit of the EC class. */
export function enzymeClassScore(ecClass: string): number {
  const prefix = ecClass.charAt(0);
  switch (prefix) {
    case '1': return 0.9;  // Oxidoreductases
    case '2': return 0.8;  // Transferases
    case '3': return 0.7;  // Hydrolases
    case '4': return 0.6;  // Lyases
    case '5': return 0.5;  // Isomerases
    case '6': return 0.4;  // Ligases
    case '7': return 0.3;  // Translocases
    default:  return 0.5;
  }
}

function computeScore(
  steps: PathwayStep[],
  targetNorm: string,
  precursors: Set<string>,
): number {
  // Length component: shorter pathways score higher
  const lengthScore = 1 / (steps.length + 1);

  // Thermodynamic feasibility: penalise irreversible steps
  // (reversible reactions are thermodynamically more favourable in reverse)
  const reversibleCount = steps.filter(s => s.reversibility).length;
  const thermoScore = steps.length > 0 ? reversibleCount / steps.length : 0;

  // Enzyme availability: average across all steps
  const enzymeScores = steps.map(s => enzymeClassScore(s.enzymeClass));
  const enzymeScore =
    enzymeScores.length > 0
      ? enzymeScores.reduce((a, b) => a + b, 0) / enzymeScores.length
      : 1.0;

  return 0.4 * lengthScore + 0.3 * enzymeScore + 0.3 * thermoScore;
}

/* ------------------------------------------------------------------ */
/*  BFS helpers                                                       */
/* ------------------------------------------------------------------ */

function isCentral(mol: string): boolean {
  return CENTRAL_NORM.has(normalizeSmiles(mol));
}

function findMatchingRules(targetNorm: string): ReactionRule[] {
  const matches: ReactionRule[] = [];
  for (const rule of REACTION_RULES) {
    for (const prod of rule.products) {
      if (normalizeSmiles(prod) === targetNorm) {
        matches.push(rule);
        break;
      }
    }
  }
  return matches;
}

/* ------------------------------------------------------------------ */
/*  Core retrosynthesis search                                        */
/* ------------------------------------------------------------------ */

interface SearchState {
  frontier: string[];         // molecules still to resolve
  steps: PathwayStep[];       // reactions applied so far
  resolved: Set<string>;      // molecules already resolved to central metabolites
}

/**
 * Find retrosynthetic pathways from `targetSmiles` back to central metabolites.
 */
export function findPathways(request: RetrosynthesisRequest): RetrosynthesisResult {
  const t0 = Date.now();

  const targetSmiles = request.targetSmiles;
  const maxSteps = request.maxSteps ?? 5;
  const maxPathways = request.maxPathways ?? 10;

  // Guard: nothing to return if limits are zero
  if (maxPathways <= 0 || maxSteps <= 0) {
    return { pathways: [], targetSmiles, totalTime: Date.now() - t0 };
  }

  const targetNorm = normalizeSmiles(targetSmiles);

  // Trivial case: target is already a central metabolite
  if (CENTRAL_NORM.has(targetNorm)) {
    return {
      pathways: [{
        steps: [],
        length: 0,
        score: 1.0,
      }],
      targetSmiles,
      totalTime: Date.now() - t0,
    };
  }

  const resultPathways: Pathway[] = [];
  const visitedStates = new Set<string>();

  // BFS queue: each entry is a search state
  const queue: SearchState[] = [{
    frontier: [targetSmiles],
    steps: [],
    resolved: new Set(),
  }];

  // Seed visited with the target state
  visitedStates.add(JSON.stringify([normalizeSmiles(targetSmiles)]));

  while (queue.length > 0 && resultPathways.length < maxPathways * 3) {
    const state = queue.shift()!;

    if (state.steps.length >= maxSteps) continue;

    // Split frontier into unresolved molecules
    const unresolved = state.frontier.filter(m => !isCentral(m));
    const newlyResolved = new Set(state.resolved);
    for (const m of state.frontier) {
      if (isCentral(m)) newlyResolved.add(normalizeSmiles(m));
    }

    // All resolved? Record pathway.
    if (unresolved.length === 0 && state.steps.length > 0) {
      resultPathways.push({
        steps: [...state.steps],
        length: state.steps.length,
        score: computeScore(state.steps, targetNorm, newlyResolved),
      });
      continue;
    }

    if (unresolved.length === 0) continue;

    // Pick the first unresolved molecule to expand
    const mol = unresolved[0];
    const molNorm = normalizeSmiles(mol);
    const matchingRules = findMatchingRules(molNorm);

    for (const rule of matchingRules) {
      // Verify the rule actually matches this molecule
      const matchedIdx = rule.products.findIndex(p => normalizeSmiles(p) === molNorm);
      if (matchedIdx < 0) continue;

      // Build new frontier: replace matched molecule with reactants
      const newFrontier: string[] = [];

      // Add reactants (these are what we need to produce)
      for (const r of rule.reactants) {
        if (!isCentral(r)) {
          newFrontier.push(r);
        }
      }

      // Add remaining unresolved molecules (excluding the one we just resolved)
      for (let i = 1; i < unresolved.length; i++) {
        if (!isCentral(unresolved[i])) {
          newFrontier.push(unresolved[i]);
        }
      }

      // Deduplicate frontier
      const uniqueFrontier: string[] = [];
      const seenNorm = new Set<string>();
      for (const m of newFrontier) {
        const n = normalizeSmiles(m);
        if (!seenNorm.has(n)) {
          seenNorm.add(n);
          uniqueFrontier.push(m);
        }
      }

      // Skip if nothing new to explore
      if (uniqueFrontier.length === 0 && unresolved.length <= 1) {
        // All reactants are central metabolites — record this as a terminal step
        const allCentral = rule.reactants.every(r => isCentral(r));
        if (allCentral) {
          const step: PathwayStep = {
            ruleId: rule.id,
            ruleName: rule.name,
            enzymeClass: rule.enzymeClass,
            reactantSmiles: [...rule.reactants],
            productSmiles: [mol],
            reversibility: rule.reversibility,
            cofactors: [...rule.cofactors],
          };

          const finalResolved = new Set(newlyResolved);
          for (const r of rule.reactants) {
            finalResolved.add(normalizeSmiles(r));
          }

          resultPathways.push({
            steps: [...state.steps, step],
            length: state.steps.length + 1,
            score: computeScore([...state.steps, step], targetNorm, finalResolved),
          });
        }
        continue;
      }

      // Dedup check: have we seen this frontier state before?
      const stateKey = JSON.stringify(uniqueFrontier.map(normalizeSmiles).sort());
      if (visitedStates.has(stateKey)) continue;
      visitedStates.add(stateKey);

      // Check for cycles: no frontier molecule should appear in previous steps' products
      let hasCycle = false;
      for (const fm of uniqueFrontier) {
        const fmNorm = normalizeSmiles(fm);
        if (fmNorm === molNorm) { hasCycle = true; break; }
      }
      if (hasCycle) continue;

      const step: PathwayStep = {
        ruleId: rule.id,
        ruleName: rule.name,
        enzymeClass: rule.enzymeClass,
        reactantSmiles: [...rule.reactants],
        productSmiles: [mol],
        reversibility: rule.reversibility,
        cofactors: [...rule.cofactors],
      };

      queue.push({
        frontier: uniqueFrontier,
        steps: [...state.steps, step],
        resolved: newlyResolved,
      });
    }
  }

  // Sort by score descending, take top maxPathways
  resultPathways.sort((a, b) => b.score - a.score);
  const topPathways = resultPathways.slice(0, maxPathways);

  return {
    pathways: topPathways,
    targetSmiles,
    totalTime: Date.now() - t0,
  };
}
