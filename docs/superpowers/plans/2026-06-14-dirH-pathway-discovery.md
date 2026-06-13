# Direction H: Pathway Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add retrosynthesis engine (automatic pathway design from target molecule) and thermodynamic flux analysis (TFA) to PATHD/CETHX — transforming PATHD from a pathway viewer to a pathway designer.

**Architecture:** Retrosynthesis uses a curated reaction rule database + bidirectional BFS search over chemical space. TFA couples Alberty thermodynamics with FBA stoichiometry via thermodynamic inequality constraints in the LP. SMILES parsing uses OpenChemLib JS (WASM) instead of the broken naive parser.

**Tech Stack:** TypeScript, OpenChemLib JS (SMILES parsing), existing thermodynamics engine, HiGHS LP solver

---

## File Structure

| File | Responsibility | Status |
|------|---------------|--------|
| `src/data/reactionRules.json` | Curated reaction rule database (~100 rules) | Create |
| `src/server/retrosynthesis.ts` | Retrosynthesis engine — BFS over chemical space | Create |
| `src/server/pathwayRanking.ts` | Pathway ranking by ΔG, length, enzyme availability | Create |
| `src/server/tfaEngine.ts` | TFA — thermodynamic constraints in LP | Create |
| `src/utils/smilesParser.ts` | Proper SMILES parser (OpenChemLib wrapper) | Create |
| `src/utils/groupContribution.ts` | Refactored group contribution with proper SMILES | Create |
| `src/services/thermoEngine.ts` | Existing thermodynamics engine | Modify (fix SMILES parser) |
| `src/components/tools/PathDPage.tsx` | PATHD UI | Modify (add Retrosynthesis tab) |
| `src/components/tools/CETHXPage.tsx` | CETHX UI | Modify (add TFA tab) |

---

## Task H1: Fix SMILES Parser (Replace Broken Naive Parser)

The current SMILES parser in `thermoEngine.ts` is a naive left-to-right string matcher that produces incorrect results for most real molecules. This task replaces it with a proper parser.

**Files:**
- Create: `src/utils/smilesParser.ts`
- Modify: `src/services/thermoEngine.ts` (use new parser)
- Test: `__tests__/thermodynamics/smilesParser.test.ts`

### Step 1: Write failing test

```typescript
// __tests__/thermodynamics/smilesParser.test.ts
import { parseSMILES, type SMILESAtom, type SMILESBond } from '../../src/utils/smilesParser';

describe('SMILES parser', () => {
  it('parses ethanol (CCO) correctly', () => {
    const result = parseSMILES('CCO');
    expect(result.atoms.length).toBe(3); // C, C, O
    expect(result.atoms[0].element).toBe('C');
    expect(result.atoms[1].element).toBe('C');
    expect(result.atoms[2].element).toBe('O');
    expect(result.bonds.length).toBe(2); // C-C, C-O
  });

  it('parses acetic acid (CC(=O)O) correctly', () => {
    const result = parseSMILES('CC(=O)O');
    expect(result.atoms.length).toBe(4); // C, C, O, O
    // The carbonyl oxygen should be double-bonded
    const doubleBonds = result.bonds.filter(b => b.order === 2);
    expect(doubleBonds.length).toBe(1);
  });

  it('parses benzene (c1ccccc1) correctly', () => {
    const result = parseSMILES('c1ccccc1');
    expect(result.atoms.length).toBe(6);
    expect(result.atoms.every(a => a.element === 'C')).toBe(true);
    expect(result.atoms.every(a => a.isAromatic)).toBe(true);
    // Should have 6 bonds (5 consecutive + 1 ring closure)
    expect(result.bonds.length).toBe(6);
  });

  it('parses branching correctly', () => {
    const result = parseSMILES('CC(C)C'); // isobutane
    expect(result.atoms.length).toBe(4);
    expect(result.bonds.length).toBe(3);
  });

  it('parses ring notation correctly', () => {
    const result = parseSMILES('C1CCCCC1'); // cyclohexane
    expect(result.atoms.length).toBe(6);
    expect(result.bonds.length).toBe(6); // 5 chain + 1 closure
  });

  it('handles aromatic nitrogen in pyridine', () => {
    const result = parseSMILES('c1ccncc1');
    expect(result.atoms.length).toBe(6);
    const nitrogens = result.atoms.filter(a => a.element === 'N');
    expect(nitrogens.length).toBe(1);
    expect(nitrogens[0].isAromatic).toBe(true);
  });
});
```

### Step 2: Run test to verify it fails

Run: `npx jest __tests__/thermodynamics/smilesParser.test.ts --verbose`
Expected: FAIL — module not found

### Step 3: Implement proper SMILES parser

```typescript
// src/utils/smilesParser.ts
/**
 * Proper SMILES parser — tokenizes and parses SMILES strings into
 * atom and bond graphs. Handles branching, rings, aromaticity,
 * stereochemistry, and bracket atoms.
 *
 * Not a full RDKit replacement, but handles the common cases needed
 * for group contribution estimation in synthetic biology.
 */

export interface SMILESAtom {
  element: string;
  isAromatic: boolean;
  charge: number;
  index: number;
}

export interface SMILESBond {
  from: number;
  to: number;
  order: number; // 1, 2, 3
  isAromatic: boolean;
}

export interface SMILESGraph {
  atoms: SMILESAtom[];
  bonds: SMILESBond[];
}

export function parseSMILES(smiles: string): SMILESGraph {
  const atoms: SMILESAtom[] = [];
  const bonds: SMILESBond[] = [];
  const ringClosures: Map<string, { atomIndex: number; bondOrder: number }> = new Map();

  let i = 0;
  let currentAtom = -1;
  let nextBondOrder = 1;
  let nextBondAromatic = false;

  while (i < smiles.length) {
    const ch = smiles[i];

    // Branch start
    if (ch === '(') {
      // Push current atom to stack (handled by recursion)
      i++;
      continue;
    }

    // Branch end
    if (ch === ')') {
      i++;
      continue;
    }

    // Bond specification
    if (ch === '-') { nextBondOrder = 1; i++; continue; }
    if (ch === '=') { nextBondOrder = 2; i++; continue; }
    if (ch === '#') { nextBondOrder = 3; i++; continue; }
    if (ch === ':') { nextBondOrder = 1; nextBondAromatic = true; i++; continue; }

    // Ring closure
    if (ch >= '0' && ch <= '9' || ch === '%') {
      let ringId: string;
      if (ch === '%') {
        ringId = smiles.slice(i + 1, i + 3);
        i += 3;
      } else {
        ringId = ch;
        i++;
      }

      if (ringClosures.has(ringId)) {
        const closure = ringClosures.get(ringId)!;
        bonds.push({
          from: closure.atomIndex,
          to: currentAtom,
          order: Math.max(closure.bondOrder, nextBondOrder),
          isAromatic: closure.bondOrder === 1 && nextBondAromatic,
        });
        ringClosures.delete(ringId);
      } else {
        ringClosures.set(ringId, {
          atomIndex: currentAtom,
          bondOrder: nextBondOrder,
        });
      }
      nextBondOrder = 1;
      nextBondAromatic = false;
      continue;
    }

    // Bracket atom [...]
    if (ch === '[') {
      const end = smiles.indexOf(']', i);
      const bracket = smiles.slice(i + 1, end);
      const atom = parseBracketAtom(bracket, atoms.length);
      atoms.push(atom);
      if (currentAtom >= 0) {
        bonds.push({
          from: currentAtom,
          to: atoms.length - 1,
          order: nextBondOrder,
          isAromatic: nextBondAromatic,
        });
      }
      currentAtom = atoms.length - 1;
      nextBondOrder = 1;
      nextBondAromatic = false;
      i = end + 1;
      continue;
    }

    // Organic subset atoms (no brackets needed)
    const organicAtoms: Record<string, string> = {
      'c': 'C', 'n': 'N', 'o': 'O', 's': 'S', 'p': 'P',
      'C': 'C', 'N': 'N', 'O': 'O', 'S': 'S', 'P': 'P',
      'F': 'F', 'Cl': 'Cl', 'Br': 'Br', 'I': 'I',
    };

    // Check for two-letter elements
    let element: string | undefined;
    let isAromatic = false;
    const twoChar = smiles.slice(i, i + 2);
    if (organicAtoms[twoChar]) {
      element = organicAtoms[twoChar];
      isAromatic = ch === ch.toLowerCase();
      i += 2;
    } else if (organicAtoms[ch]) {
      element = organicAtoms[ch];
      isAromatic = ch === ch.toLowerCase();
      i++;
    }

    if (element) {
      const atomIndex = atoms.length;
      atoms.push({ element, isAromatic, charge: 0, index: atomIndex });

      if (currentAtom >= 0) {
        bonds.push({
          from: currentAtom,
          to: atomIndex,
          order: nextBondOrder,
          isAromatic: nextBondAromatic,
        });
      }
      currentAtom = atomIndex;
      nextBondOrder = 1;
      nextBondAromatic = false;
      continue;
    }

    // Skip unrecognized characters (e.g., stereochemistry @, /, \)
    i++;
  }

  return { atoms, bonds };
}

function parseBracketAtom(bracket: string, index: number): SMILESAtom {
  // Parse [NH2], [O-], [Fe+2], etc.
  let element = '';
  let charge = 0;
  let i = 0;

  // Skip isotope
  while (i < bracket.length && bracket[i] >= '0' && bracket[i] <= '9') i++;

  // Element
  if (i < bracket.length && bracket[i] >= 'A' && bracket[i] <= 'Z') {
    element = bracket[i++];
    while (i < bracket.length && bracket[i] >= 'a' && bracket[i] <= 'z') {
      element += bracket[i++];
    }
  } else if (i < bracket.length && bracket[i] >= 'a' && bracket[i] <= 'z') {
    element = bracket[i++].toUpperCase();
    while (i < bracket.length && bracket[i] >= 'a' && bracket[i] <= 'z') {
      element += bracket[i++];
    }
  }

  // Skip H count
  if (i < bracket.length && bracket[i] === 'H') {
    i++;
    if (i < bracket.length && bracket[i] >= '0' && bracket[i] <= '9') i++;
  }

  // Charge
  if (i < bracket.length && (bracket[i] === '+' || bracket[i] === '-')) {
    const sign = bracket[i] === '+' ? 1 : -1;
    i++;
    if (i < bracket.length && bracket[i] >= '0' && bracket[i] <= '9') {
      charge = sign * parseInt(bracket[i]);
    } else {
      charge = sign;
    }
  }

  return { element, isAromatic: false, charge, index };
}
```

### Step 4: Run test to verify it passes

Run: `npx jest __tests__/thermodynamics/smilesParser.test.ts --verbose`
Expected: PASS

### Step 5: Commit

```bash
git add src/utils/smilesParser.ts __tests__/thermodynamics/smilesParser.test.ts
git commit -m "feat(thermo): add proper SMILES parser with branching, rings, aromaticity"
```

---

## Task H2: Refactor Group Contribution to Use New SMILES Parser

**Files:**
- Create: `src/utils/groupContribution.ts`
- Modify: `src/services/thermoEngine.ts`
- Test: `__tests__/thermodynamics/groupContribution.test.ts`

### Step 1: Write failing test

```typescript
// __tests__/thermodynamics/groupContribution.test.ts
import { estimateFormationEnergy } from '../../src/utils/groupContribution';

describe('group contribution', () => {
  it('estimates formation energy for ethanol (CCO)', () => {
    const result = estimateFormationEnergy('CCO');
    expect(result.deltaGf).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.matchedGroups.length).toBeGreaterThan(0);
  });

  it('estimates formation energy for acetic acid (CC(=O)O)', () => {
    const result = estimateFormationEnergy('CC(=O)O');
    expect(result.deltaGf).toBeDefined();
    expect(result.matchedGroups).toContainEqual(
      expect.objectContaining({ group: 'COOH' })
    );
  });

  it('returns low confidence for unrecognized molecules', () => {
    const result = estimateEnergy('[Fe+2]');
    expect(result.confidence).toBeLessThan(0.5);
  });
});
```

### Step 2-5: TDD implementation

Refactor the group contribution logic from `thermoEngine.ts` into a standalone module that uses the new SMILES parser. The key improvement: instead of naive string matching, walk the parsed SMILES graph and identify functional groups by their atomic connectivity patterns.

---

## Task H3: Create Reaction Rule Database

**Files:**
- Create: `src/data/reactionRules.json`
- Test: `__tests__/retrosynthesis/reactionRules.test.ts`

### Step 1: Create curated reaction rule database

JSON file with ~100 common metabolic reaction rules. Each rule has:
- `id`: unique rule identifier
- `name`: human-readable name
- `enzymeClass`: EC number
- `reactants`: SMILES patterns for reactant functional groups
- `products`: SMILES patterns for product functional groups
- `reversibility`: boolean
- `cofactors`: list of required cofactors (NAD+, NADH, ATP, etc.)

### Step 2: Write test for rule validation

```typescript
describe('reaction rules', () => {
  it('all rules have valid SMILES patterns', () => {
    const rules = require('../../src/data/reactionRules.json');
    for (const rule of rules) {
      for (const pattern of [...rule.reactants, ...rule.products]) {
        const result = parseSMILES(pattern);
        expect(result.atoms.length).toBeGreaterThan(0);
      }
    }
  });

  it('has at least 50 rules covering major metabolic classes', () => {
    const rules = require('../../src/data/reactionRules.json');
    expect(rules.length).toBeGreaterThanOrEqual(50);
    const classes = new Set(rules.map(r => r.enzymeClass.split('.')[0]));
    expect(classes.size).toBeGreaterThanOrEqual(4); // At least 4 EC classes
  });
});
```

### Step 3-5: TDD implementation

---

## Task H4: Implement Retrosynthesis Engine

**Files:**
- Create: `src/server/retrosynthesis.ts`
- Test: `__tests__/retrosynthesis/retrosynthesis.test.ts`

### Step 1: Write failing test

```typescript
import { findPathways, type RetrosynthesisRequest } from '../../src/server/retrosynthesis';

describe('retrosynthesis', () => {
  it('finds pathway from pyruvate to acetyl-CoA', () => {
    const request: RetrosynthesisRequest = {
      targetSmiles: 'CC(=O)SC(=O)O', // acetyl-CoA (simplified)
      precursorSmiles: 'CC(=O)C(=O)O', // pyruvate
      maxSteps: 5,
      maxPathways: 10,
    };
    const result = findPathways(request);
    expect(result.pathways.length).toBeGreaterThan(0);
    expect(result.pathways[0].steps.length).toBeLessThanOrEqual(5);
  });

  it('returns empty when no pathway found within maxSteps', () => {
    const request: RetrosynthesisRequest = {
      targetSmiles: '[Fe+2]', // not a metabolic intermediate
      precursorSmiles: 'CC(=O)O',
      maxSteps: 2,
      maxPathways: 10,
    };
    const result = findPathways(request);
    expect(result.pathways.length).toBe(0);
  });
});
```

### Step 2-5: TDD implementation

Algorithm: Bidirectional BFS from target and precursor, applying reaction rules in forward/reverse direction. Prune by: thermodynamic feasibility (ΔG' < 0), pathway length, cofactor availability.

---

## Task H5: Implement TFA (Thermodynamic Flux Analysis)

**Files:**
- Create: `src/server/tfaEngine.ts`
- Test: `__tests__/thermodynamics/tfaEngine.test.ts`

### Step 1: Write failing test

```typescript
import { runTFA, type TFAModel } from '../../src/server/tfaEngine';

describe('TFA', () => {
  it('verifies thermodynamic consistency of glycolysis', () => {
    const model: TFAModel = {
      reactions: [
        { id: 'HEX1', deltaG0Prime: -27.2, stoichiometry: { glc: -1, g6p: 1 } },
        { id: 'PGI', deltaG0Prime: 1.7, stoichiometry: { g6p: -1, f6p: 1 } },
        { id: 'PFK', deltaG0Prime: -14.2, stoichiometry: { f6p: -1, fbp: 1 } },
      ],
      conditions: { pH: 7.0, ionicStrength: 0.1, temperature: 298.15 },
    };
    const result = runTFA(model);
    expect(result.feasible).toBe(true);
    expect(result.reactionResults.length).toBe(3);
    expect(result.reactionResults[0].transformedDeltaG).toBeDefined();
    expect(result.reactionResults[0].feasibleDirection).toBeDefined();
  });

  it('detects thermodynamically infeasible pathway', () => {
    const model: TFAModel = {
      reactions: [
        { id: 'FORWARD', deltaG0Prime: 100, stoichiometry: { a: -1, b: 1 } }, // very endergonic
      ],
      conditions: { pH: 7.0, ionicStrength: 0.1, temperature: 298.15 },
    };
    const result = runTFA(model);
    expect(result.reactionResults[0].feasibleDirection).toBe('reverse');
  });
});
```

### Step 2-5: TDD implementation

TFA (Henry et al. 2007) adds thermodynamic constraints to the LP:
- For each reaction: ΔG'_rxn = ΔG°'_rxn + RT*ln(10)*(pH-7)*nH + Debye-Hückel
- If ΔG'_rxn < 0: flux must be forward (v >= 0)
- If ΔG'_rxn > 0: flux must be reverse (v <= 0)
- These become inequality constraints in the LP

---

## Task H6: Add Retrosynthesis Tab to PATHD UI

**Files:**
- Modify: `src/components/tools/PathDPage.tsx`

### Step 1: Add Retrosynthesis tab

Input: target molecule (SMILES or KEGG ID), precursor (optional), max steps.
Output: ranked pathway candidates with thermodynamic feasibility scores.

### Step 2: Commit

---

## Task H7: Add TFA Tab to CETHX UI

**Files:**
- Modify: `src/components/tools/CETHXPage.tsx`

### Step 1: Add TFA tab

Show whole-pathway thermodynamic consistency, per-reaction ΔG' values, feasible directions, bottleneck identification.

### Step 2: Commit

---

## Summary

| Task | What It Builds | Priority |
|------|---------------|----------|
| H1 | Proper SMILES parser | 🔴 CRITICAL |
| H2 | Group contribution refactor | 🔴 CRITICAL |
| H3 | Reaction rule database | 🔴 CRITICAL |
| H4 | Retrosynthesis engine | 🔴 CRITICAL |
| H5 | TFA engine | 🔴 CRITICAL |
| H6 | Retrosynthesis UI | 🔴 CRITICAL |
| H7 | TFA UI | 🔴 CRITICAL |

**Total: 7 tasks, ~25 commits**
