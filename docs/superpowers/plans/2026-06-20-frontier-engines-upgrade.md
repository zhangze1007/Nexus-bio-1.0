# Frontier Engines Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade 6 skeleton engines to production-quality with zero simplification markers, PhD-level algorithms, and full test coverage.

**Architecture:** Each engine is a standalone TypeScript module in `src/server/`. Each exports typed functions consumed by pipeline adapters. TDD: write test first, implement to pass, verify against literature benchmarks.

**Tech Stack:** TypeScript, Jest, existing simplexLP/FBA infrastructure in `src/server/`

## Global Constraints

- Zero `// simplified`, `// TODO`, `// FIXME` markers in any output file
- All algorithms must reference published papers (in JSDoc `@reference` tags)
- All numeric constants from literature (not arbitrary)
- TypeScript strict mode — zero `any` types
- Every exported function gets at least 3 unit tests
- Each task ends with `npx tsc --noEmit && npm test` passing
- Commit after each task with conventional commit format

---

## Batch 1: gemReconstructionEngine

### Task 1.1: Write GEM engine test scaffold

**Files:**
- Create: `__tests__/gemReconstructionEngine.test.ts`

**Interfaces:**
- Consumes: `src/server/gemReconstructionEngine.ts` exports
- Produces: test file with placeholder assertions (will pass after Task 1.2+)

- [ ] **Step 1: Create test file with structural tests**

```typescript
// __tests__/gemReconstructionEngine.test.ts
import { reconstructGEM, mapGenesToReactions, generateBiomassReaction } from '../src/server/gemReconstructionEngine';

describe('gemReconstructionEngine', () => {
  describe('mapGenesToReactions', () => {
    it('maps EC 2.7.1.1 to hexokinase reaction', () => {
      const reactions = mapGenesToReactions([{ geneId: 'b0001', geneName: 'hexA', organism: 'ecoli', ecNumber: '2.7.1.1' }]);
      expect(reactions.length).toBeGreaterThan(0);
      expect(reactions[0].id).toBe('HEX1');
    });

    it('returns empty array for unknown EC number', () => {
      const reactions = mapGenesToReactions([{ geneId: 'b9999', geneName: 'unknown', organism: 'ecoli', ecNumber: '99.99.99.99' }]);
      expect(reactions).toEqual([]);
    });

    it('maps multiple genes to multiple reactions', () => {
      const reactions = mapGenesToReactions([
        { geneId: 'b0001', geneName: 'hexA', organism: 'ecoli', ecNumber: '2.7.1.1' },
        { geneId: 'b0002', geneName: 'pgi', organism: 'ecoli', ecNumber: '5.3.1.9' },
      ]);
      expect(reactions.length).toBe(2);
    });
  });

  describe('generateBiomassReaction', () => {
    it('generates biomass reaction with amino acids', () => {
      const metabolites = [
        { id: 'ala__L_c', name: 'L-Alanine', formula: 'C3H7NO2', compartment: 'c' },
        { id: 'atp_c', name: 'ATP', formula: 'C10H12N5O13P3', compartment: 'c' },
      ];
      const rxn = generateBiomassReaction(metabolites);
      expect(rxn.id).toBe('BIOMASS');
      expect(rxn.stoichiometry['ala__L_c']).toBeLessThan(0); // consumed
    });

    it('includes ATP maintenance cost', () => {
      const rxn = generateBiomassReaction([]);
      expect(rxn.stoichiometry['atp_c']).toBeLessThan(0);
    });
  });

  describe('reconstructGEM', () => {
    it('builds a complete model from E. coli annotations', () => {
      const annotations = [
        { geneId: 'b0001', geneName: 'hexA', organism: 'ecoli', ecNumber: '2.7.1.1' },
        { geneId: 'b0002', geneName: 'pgi', organism: 'ecoli', ecNumber: '5.3.1.9' },
      ];
      const gem = reconstructGEM(annotations);
      expect(gem.reactions.length).toBeGreaterThan(0);
      expect(gem.metabolites.length).toBeGreaterThan(0);
      expect(gem.genes.length).toBe(2);
      expect(gem.biomassReaction).toBe('BIOMASS');
      expect(gem.stats.nReactions).toBe(gem.reactions.length);
    });

    it('handles empty annotations gracefully', () => {
      const gem = reconstructGEM([]);
      expect(gem.reactions.length).toBe(0);
      expect(gem.stats.nReactions).toBe(0);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/gemReconstructionEngine.test.ts --verbose 2>&1 | tail -20`
Expected: FAIL (functions exist but logic is simplified)

- [ ] **Step 3: Commit**

```bash
git add __tests__/gemReconstructionEngine.test.ts
git commit -m "test: GEM reconstruction engine test scaffold"
```

---

### Task 1.2: Upgrade EC→Reaction mapping with full KEGG database

**Files:**
- Modify: `src/server/gemReconstructionEngine.ts:64-120`

**Interfaces:**
- Consumes: `GeneAnnotation[]` type
- Produces: `Reaction[]` with complete EC mapping (30→100+ entries)

- [ ] **Step 1: Expand EC_REACTION_MAP to cover all glycolysis, TCA, PPP, amino acid biosynthesis**

Replace the existing `EC_REACTION_MAP` with a comprehensive version covering 100+ EC numbers from iJO1366 core model. Include:
- Glycolysis (10 reactions)
- TCA cycle (8 reactions)
- Pentose phosphate (7 reactions)
- Amino acid biosynthesis (20 reactions)
- Nucleotide biosynthesis (12 reactions)
- Fatty acid biosynthesis (8 reactions)
- Cofactor biosynthesis (10 reactions)
- Transport reactions (15 reactions)

Each entry must have: `reactionId`, `name`, `stoichiometry` (full), `subsystem`, `reversible`, `lb`, `ub`.

- [ ] **Step 2: Run EC mapping tests**

Run: `npx jest __tests__/gemReconstructionEngine.test.ts -t "mapGenesToReactions" --verbose`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/server/gemReconstructionEngine.ts
git commit -m "feat(GEM): expand EC→reaction mapping to 100+ entries from iJO1366"
```

---

### Task 1.3: Implement full biomass reaction (remove simplified marker)

**Files:**
- Modify: `src/server/gemReconstructionEngine.ts:127-160`

**Interfaces:**
- Consumes: `Metabolite[]`
- Produces: `Reaction` with full biomass composition

- [ ] **Step 1: Implement biomass composition from iJO1366**

Replace the simplified biomass with real composition data:
- 20 amino acids (molar fractions from iJO1366)
- 4 rNTPs (ATP, GTP, CTP, UTP)
- 4 dNTPs (dATP, dGTP, dCTP, dTTP)
- Lipid precursors (phosphatidylethanolamine, cardiolipin)
- Cofactors (NAD, NADP, FAD, CoA, THF, pyridoxal-5-phosphate)
- ATP maintenance (7.536 mmol/gDW/h for E. coli)

Remove the `// Simplified biomass` comment and `// Simplified: uses a hardcoded mapping` comment.

- [ ] **Step 2: Run biomass tests**

Run: `npx jest __tests__/gemReconstructionEngine.test.ts -t "generateBiomassReaction" --verbose`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/server/gemReconstructionEngine.ts
git commit -m "feat(GEM): implement full biomass reaction with iJO1366 composition data"
```

---

### Task 1.4: Implement GPR boolean expression parser

**Files:**
- Modify: `src/server/gemReconstructionEngine.ts` — add GPR section

**Interfaces:**
- Consumes: `Reaction.gpr: string` (boolean expression like "(b0001 AND b0002) OR b0003")
- Produces: `parseGPR(expr)` → `{ type: 'and'|'or'|'gene', genes: string[], children: GPRNode[] }`

- [ ] **Step 1: Implement recursive descent parser for GPR expressions**

```typescript
interface GPRNode {
  type: 'and' | 'or' | 'gene';
  genes: string[];
  children: GPRNode[];
}

function parseGPR(expression: string): GPRNode {
  // Tokenize: split by AND/OR/(/)
  // Recursive descent: expr → term (OR term)*
  // term → factor (AND factor)*
  // factor → gene | (expr)
}
```

- [ ] **Step 2: Implement probability GPR for partial knockouts**

```typescript
function computeKnockoutProbability(gpr: GPRNode, knockedOut: Set<string>): number {
  // OR: P = 1 - ∏(1 - p_i)  (isozymes — any one suffices)
  // AND: P = ∏(p_i)           (complex — all needed)
  // gene: P = 0 if knocked out, 1 otherwise
}
```

- [ ] **Step 3: Add GPR tests**

Add to test file:
```typescript
describe('GPR parsing', () => {
  it('parses simple AND expression', () => {
    const gpr = parseGPR('b0001 AND b0002');
    expect(gpr.type).toBe('and');
    expect(gpr.genes).toContain('b0001');
    expect(gpr.genes).toContain('b0002');
  });

  it('parses nested OR/AND expression', () => {
    const gpr = parseGPR('(b0001 AND b0002) OR b0003');
    expect(gpr.type).toBe('or');
    expect(gpr.children.length).toBe(2);
  });

  it('computes knockout probability for OR (isozymes)', () => {
    const gpr = parseGPR('b0001 OR b0002');
    expect(computeKnockoutProbability(gpr, new Set(['b0001']))).toBe(1); // b0002 still active
  });

  it('computes knockout probability for AND (complex)', () => {
    const gpr = parseGPR('b0001 AND b0002');
    expect(computeKnockoutProbability(gpr, new Set(['b0001']))).toBe(0);
  });
});
```

- [ ] **Step 4: Run GPR tests**

Run: `npx jest __tests__/gemReconstructionEngine.test.ts -t "GPR" --verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/gemReconstructionEngine.ts __tests__/gemReconstructionEngine.test.ts
git commit -m "feat(GEM): implement GPR boolean parser with probability knockout model"
```

---

### Task 1.5: Implement thermodynamic gap-filling

**Files:**
- Modify: `src/server/gemReconstructionEngine.ts` — add gap-filling section

**Interfaces:**
- Consumes: `GEMReconstruction` (incomplete model)
- Produces: `GapFillResult` with added reactions + thermodynamic feasibility

- [ ] **Step 1: Implement gap detection**

```typescript
function detectGaps(model: GEMReconstruction): { orphanMetabolites: string[]; deadEndReactions: string[] } {
  // Orphan metabolites: consumed but not produced (or vice versa)
  // Dead-end reactions: cannot carry flux in FBA
}
```

- [ ] **Step 2: Implement thermodynamic gap-filling solver**

```typescript
function gapFill(model: GEMReconstruction, candidateReactions: Reaction[]): GEMReconstruction {
  // Objective: minimize |added_reactions|
  // Constraints:
  //   S·v = 0
  //   v_biomass ≥ 0.01
  //   ΔG_r · v_r ≤ 0 for irreversible reactions
  //   lb ≤ v ≤ ub
  // Use existing simplexLP solver with binary variables for reaction inclusion
}
```

- [ ] **Step 3: Implement essential gene analysis**

```typescript
function findEssentialGenes(model: GEMReconstruction): { geneId: string; reaction: string; growthWithout: number }[] {
  // For each gene: knock out associated reactions, re-run FBA
  // Essential if growth rate < 1% of wild-type
  // Also compute double-knockout epistasis matrix
}
```

- [ ] **Step 4: Add gap-filling and essentiality tests**

```typescript
it('detects orphan metabolites in incomplete model', () => { ... });
it('gap-fills to restore growth', () => { ... });
it('identifies essential genes in E. coli core model', () => { ... });
it('computes double-knockout epistasis', () => { ... });
```

- [ ] **Step 5: Run all GEM tests**

Run: `npx jest __tests__/gemReconstructionEngine.test.ts --verbose`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/server/gemReconstructionEngine.ts __tests__/gemReconstructionEngine.test.ts
git commit -m "feat(GEM): thermodynamic gap-filling + essential gene analysis"
```

---

## Batch 2: mfa13CEngine

### Task 2.1: Write MFA engine test scaffold

**Files:**
- Create: `__tests__/mfa13CEngine.test.ts`

- [ ] **Step 1: Create test file**

```typescript
describe('mfa13CEngine', () => {
  describe('EMU decomposition', () => {
    it('decomposes glucose (6C) into EMU sets', () => { ... });
    it('handles 2-carbon metabolite (acetyl-CoA)', () => { ... });
  });

  describe('MID simulation', () => {
    it('simulates correct MID for fully labeled glucose', () => { ... });
    it('handles partially labeled substrate', () => { ... });
  });

  describe('flux estimation', () => {
    it('recovers known fluxes from synthetic MID data', () => { ... });
    it('converges within 100 iterations', () => { ... });
  });

  describe('confidence intervals', () => {
    it('produces 95% CI within ±20% of true value', () => { ... });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**
- [ ] **Step 3: Commit**

---

### Task 2.2: Implement full EMU decomposition (remove simplified marker)

**Files:**
- Modify: `src/server/mfa13CEngine.ts:74-180`

- [ ] **Step 1: Implement recursive EMU set generation**

Replace the simplified EMU with full recursive decomposition:
```typescript
function decomposeEMU(metabolite: Metabolite, reactions: Reaction[]): EMUNetwork {
  // For metabolite with n carbons:
  //   Generate all subsets: {0}, {1}, ..., {n-1}, {0,1}, {1,2}, ...
  //   For each reaction with this metabolite as product:
  //     Map input EMU atoms → output EMU atoms via atom mapping
  //     Build adjacency: inputEMU → outputEMU
  //   Return EMUNetwork with nodes, edges, dimensions
}
```

Remove `// Simplified: average the substrate MIDs weighted by stoichiometry`.

- [ ] **Step 2: Implement atom mapping for key reaction types**

```typescript
const ATOM_MAPPINGS: Record<string, (substrate: string[]) => string[]> = {
  '2.7.1.1': (s) => s,  // kinase: preserve all carbons
  '5.3.1.9': (s) => [s[2], s[3], s[4], s[5], s[0], s[1]],  // isomerase: rearrange
  '4.1.2.13': (s) => [s[0], s[1], s[2]],  // aldolase: split 6C → 3C + 3C
  // ... more mappings
};
```

- [ ] **Step 3: Run EMU tests**
- [ ] **Step 4: Commit**

---

### Task 2.3: Implement Levenberg-Marquardt optimizer (replace grid search)

**Files:**
- Modify: `src/server/mfa13CEngine.ts:230-300`

- [ ] **Step 1: Implement LM optimizer**

Replace the grid search with proper Levenberg-Marquardt:
```typescript
function levenbergMarquardt(
  objective: (v: number[]) => number[],  // residuals
  jacobian: (v: number[]) => number[][],  // Jacobian matrix
  v0: number[],                           // initial guess
  options: { maxIter: number; tol: number; lambda0: number; lambdaUp: number; lambdaDown: number },
): { fluxes: number[]; chi2: number; iterations: number; converged: boolean } {
  // v_{k+1} = v_k + (JᵀJ + λI)⁻¹ · Jᵀ · r
  // Adaptive λ: decrease on improvement (λDown), increase on degradation (λUp)
}
```

Remove `// Grid search over flux space (simplified: 1D grid for each reaction)`.

- [ ] **Step 2: Implement numerical Jacobian**

```typescript
function numericalJacobian(f: (v: number[]) => number[], v: number[], eps: number = 1e-6): number[][] {
  const n = v.length;
  const m = f(v).length;
  const J = Array.from({ length: m }, () => new Array(n));
  for (let j = 0; j < n; j++) {
    const vPlus = [...v]; vPlus[j] += eps;
    const vMinus = [...v]; vMinus[j] -= eps;
    const fPlus = f(vPlus);
    const fMinus = f(vMinus);
    for (let i = 0; i < m; i++) J[i][j] = (fPlus[i] - fMinus[i]) / (2 * eps);
  }
  return J;
}
```

- [ ] **Step 3: Run optimizer tests**
- [ ] **Step 4: Commit**

---

### Task 2.4: Implement Monte Carlo confidence intervals

**Files:**
- Modify: `src/server/mfa13CEngine.ts` — add CI section

- [ ] **Step 1: Implement Monte Carlo sampling**

```typescript
function monteCarloCI(
  midExp: Record<string, number[]>,
  midStd: Record<string, number[]>,
  fluxEstimator: (mid: Record<string, number[]>) => number[],
  nSamples: number = 1000,
): { mean: number[]; ci95: [number, number][]; std: number[] } {
  // For each sample:
  //   1. Perturb MIDs: MID_sampled = MID_exp + N(0, σ²)
  //   2. Re-estimate fluxes
  //   3. Collect results
  // CI_95 = [percentile(2.5), percentile(97.5)]
}
```

- [ ] **Step 2: Implement Bootstrap validation**

```typescript
function bootstrapCI(
  midExp: Record<string, number[]>,
  fluxEstimator: (mid: Record<string, number[]>) => number[],
  nBootstrap: number = 1000,
): { mean: number[]; ci95: [number, number][] } {
  // Resample with replacement, re-estimate, collect
}
```

- [ ] **Step 3: Run CI tests**
- [ ] **Step 4: Commit**

---

## Batch 3: regulatoryDesignEngine

### Task 3.1: Write regulatory engine test scaffold

**Files:**
- Create: `__tests__/regulatoryDesignEngine.test.ts`

- [ ] **Step 1: Create test file with Salis RBS benchmark**

```typescript
describe('regulatoryDesignEngine', () => {
  describe('predictRBSStrength', () => {
    // Salis 2009 Table 1 benchmarks
    it('predicts strong RBS for AAGGAGG sequence', () => {
      const result = predictRBSStrength('AAGGAGGAAAAAAATG', 'ATGAAACGC...');
      expect(result.strength).toBeGreaterThan(0.7);
    });

    it('predicts weak RBS for mismatched SD', () => {
      const result = predictRBSStrength('AACCTTGAAAAAAATG', 'ATGAAACGC...');
      expect(result.strength).toBeLessThan(0.3);
    });

    it('computes correct ΔG_total within ±1 kcal/mol of Salis calculator', () => {
      // Known benchmark: SD=AGGAGG, spacing=6bp, expected ΔG ≈ -9.5 kcal/mol
      const result = predictRBSStrength('AGGAGGAAAAAATG', 'ATG...');
      expect(result.dgTotal).toBeCloseTo(-9.5, 0);
    });
  });

  describe('designRegulatoryCassette', () => {
    it('produces promoter + RBS + terminator', () => { ... });
    it('overall strength correlates with target strength', () => { ... });
  });
});
```

- [ ] **Step 2: Run tests**
- [ ] **Step 3: Commit**

---

### Task 3.2: Implement full Salis RBS 5-term model (remove all simplified markers)

**Files:**
- Modify: `src/server/regulatoryDesignEngine.ts:128-190`

- [ ] **Step 1: Implement NN thermodynamic parameters**

```typescript
// RNA nearest-neighbor parameters (Freier 1983, Turner 2009)
const NN_RNA: Record<string, number> = {
  'AA': -0.9, 'UU': -0.9, 'AU': -1.1, 'UA': -1.3,
  'CA': -1.8, 'UG': -1.8, 'CU': -0.9, 'AG': -0.9,
  'GA': -1.3, 'UC': -1.3, 'GU': -1.4, 'AC': -1.4,
  'CG': -2.4, 'GC': -3.4, 'GG': -1.7, 'CC': -1.7,
  // Bulge, hairpin, internal loop parameters...
};
```

- [ ] **Step 2: Implement 5-term RBS calculator**

```typescript
function predictRBSStrength(rbsSeq: string, cdsSeq: string): RBSResult {
  const sdSeq = findShineDalgarno(rbsSeq);

  // Term 1: ΔG_mRNA — mRNA folding energy (NN model)
  const dgMRNA = computeMRNAFolding_NN(rbsSeq);

  // Term 2: ΔG_spacing — SD-AUG spacing penalty
  const spacing = computeSpacingReal(rbsSeq, cdsSeq);  // NOT augPos + 5
  const dgSpacing = -0.5 * Math.abs(spacing - 5);  // optimal = 5 bp

  // Term 3: ΔG_standby — standby site energy
  const dgStandby = computeStandbySite(rbsSeq, cdsSeq);

  // Term 4: ΔG_start — AUG + anti-SD binding
  const dgStart = computeStartCodonEnergy(cdsSeq);

  // Term 5: ΔG_antiSD — anti-SD sequence match
  const dgAntiSD = computeAntiSDEnergy(rbsSeq);

  const dgTotal = dgMRNA + dgSpacing + dgStandby + dgStart + dgAntiSD;
  const strength = Math.max(0, Math.min(1, (-dgTotal) / 15));

  return { strength, dgTotal, dgMRNA, dgSpacing, dgStandby, dgStart, dgAntiSD };
}
```

Remove all 4 simplified markers: `const spacerOK = true`, `// Simplified nearest-neighbor`, `return augPos + 5`, `// ΔG_mRNA: mRNA folding energy (simplified nearest-neighbor)`.

- [ ] **Step 3: Run RBS tests**
- [ ] **Step 4: Commit**

---

### Task 3.3: Implement terminator thermodynamic stability

**Files:**
- Modify: `src/server/regulatoryDesignEngine.ts:198-222`

- [ ] **Step 1: Implement NN-based stem-loop stability**

```typescript
function computeTerminatorStability(stemSeq: string, loopSeq: string, tTract: string): number {
  // ΔG_stem = Σ NN_RNA[stem[i:i+2]] for i in 0..stem.length-1
  // ΔG_loop = HAIRPIN_LOOP_PARAMS[loopSeq.length] (experimental table)
  // ΔG_ttract = -1.5 * tTract.length (poly-T stability)
  // ΔG_total = ΔG_stem + ΔG_loop + ΔG_ttract
  return dgTotal;
}
```

- [ ] **Step 2: Run terminator tests**
- [ ] **Step 3: Commit**

---

### Task 3.4: Implement tAI codon optimization

**Files:**
- Modify: `src/server/regulatoryDesignEngine.ts` — add codon optimization section

- [ ] **Step 1: Implement tRNA adaptiveness index**

```typescript
function optimizeCodons(proteinSeq: string, organism: 'ecoli' | 'yeast' | 'human'): string {
  // tRNA gene copy numbers from dos Reis 2004
  const tRNA_COPY_NUMBERS: Record<string, Record<string, number>> = { ... };

  // For each amino acid, compute tAI for each synonymous codon
  // Select codon with highest tAI (most adapted)
  // Avoid rare codons (tAI < 0.1)
}
```

- [ ] **Step 2: Run codon optimization tests**
- [ ] **Step 3: Commit**

---

## Batch 4: biosensorDesignEngine

### Task 4.1: Write biosensor test scaffold

**Files:**
- Create: `__tests__/biosensorDesignEngine.test.ts`

- [ ] **Step 1: Create test file**
- [ ] **Step 2: Run tests**
- [ ] **Step 3: Commit**

---

### Task 4.2: Implement extended Hill equation (remove simplified markers)

**Files:**
- Modify: `src/server/biosensorDesignEngine.ts:50-130`

- [ ] **Step 1: Implement extended Hill with leak expression**

Replace simplified lookup with real thermodynamic model. Remove `// Select TF based on ligand (simplified lookup)` and `// Specificity (simplified — based on TF selectivity)`.

- [ ] **Step 2: Run tests**
- [ ] **Step 3: Commit**

---

### Task 4.3: Implement binding affinity and orthogonality

**Files:**
- Modify: `src/server/biosensorDesignEngine.ts` — add sections

- [ ] **Step 1: Implement ΔG_bind estimation**
- [ ] **Step 2: Implement cross-talk network and orthogonality score**
- [ ] **Step 3: Run tests**
- [ ] **Step 4: Commit**

---

## Batch 5: consortiumDesignEngine

### Task 5.1: Write consortium test scaffold

**Files:**
- Create: `__tests__/consortiumDesignEngine.test.ts`

- [ ] **Step 1: Create test file**
- [ ] **Step 2: Run tests**
- [ ] **Step 3: Commit**

---

### Task 5.2: Implement SteadyCom community FBA (remove all simplified markers)

**Files:**
- Modify: `src/server/consortiumDesignEngine.ts:50-131`

- [ ] **Step 1: Implement SteadyCom LP formulation**

Replace simplified cross-feeding with real SteadyCom. Remove all 4 simplified markers.

- [ ] **Step 2: Implement quorum sensing ODE**
- [ ] **Step 3: Implement Jacobian stability analysis**
- [ ] **Step 4: Run tests**
- [ ] **Step 5: Commit**

---

## Batch 6: bioprocessOptimizationEngine

### Task 6.1: Write bioprocess test scaffold

**Files:**
- Create: `__tests__/bioprocessOptimizationEngine.test.ts`

- [ ] **Step 1: Create test file**
- [ ] **Step 2: Run tests**
- [ ] **Step 3: Commit**

---

### Task 6.2: Implement structured kinetics (remove Monod simplifications)

**Files:**
- Modify: `src/server/bioprocessOptimizationEngine.ts:60-180`

- [ ] **Step 1: Implement structured metabolic model**

Replace simplified Monod with structured kinetics. Remove all 5 simplified markers.

- [ ] **Step 2: Implement full kLa correlation**
- [ ] **Step 3: Implement Pontryagin fed-batch optimization**
- [ ] **Step 4: Run tests**
- [ ] **Step 5: Commit**

---

## Verification Checklist (after all batches)

- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm test` — all tests pass (2393+ tests)
- [ ] `grep -rn "simplified\|Simplified" src/server/*Engine.ts` — zero matches
- [ ] Each engine has ≥3 unit tests per exported function
- [ ] Each algorithm references a published paper in JSDoc
- [ ] Git log shows clean conventional commits per task
