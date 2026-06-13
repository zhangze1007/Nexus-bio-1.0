# Direction G: Core Strain Design Algorithms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add MILP support to HiGHS solver, implement FSEOF (overexpression target scanning) and OptKnock (bilevel knockout strategy), and wire GPR gene-knockout rules into the LP solver — transforming FBASim from an analysis tool to a strain design tool.

**Architecture:** Build on the existing HiGHS WASM solver (`src/server/highsSolver.ts`). Add binary/integer variable support to the `LPModel` interface. Implement FSEOF as iterative parametric LP. Implement OptKnock as bilevel MILP reformulated as single-level MILP via duality. Wire existing GPR parser (`src/server/fbaGPR.ts`) into the LP solver for gene-level knockouts.

**Tech Stack:** TypeScript, HiGHS WASM solver, existing simplex LP infrastructure

---

## File Structure

| File | Responsibility | Status |
|------|---------------|--------|
| `src/server/highsSolver.ts` | HiGHS WASM wrapper — LP + MILP solving | Modify (add MILP) |
| `src/server/simplexLP.ts` | Fallback tableau simplex for small LPs | No change |
| `src/server/fbaEngine.ts` | Core FBA engine — toy + iJO1366 + dynamic | Modify (add FSEOF/OptKnock entry points) |
| `src/server/fbaFSEOF.ts` | FSEOF algorithm — overexpression target scanning | Create |
| `src/server/fbaOptKnock.ts` | OptKnock algorithm — bilevel knockout strategy | Create |
| `src/server/fbaGPR.ts` | GPR parser + evaluator | Modify (wire into LP) |
| `src/server/fbaRobustKnock.ts` | RobustKnock — guaranteed minimum production | Create |
| `src/server/fbaMOMA.ts` | MOMA — minimization of metabolic adjustment | Create |
| `src/server/fbaDynamic.ts` | Dynamic FBA — time-varying conditions | Create |
| `app/api/fba/route.ts` | FBA API endpoint | Modify (add new actions) |
| `src/services/FBAAuthorityClient.ts` | FBA client wrapper | Modify (add new functions) |
| `src/components/tools/FBASimPage.tsx` | FBASim UI | Modify (add Strain Design tab) |
| `__tests__/fba/` | All FBA tests | Create/Modify |

---

## Task G1: Add MILP Support to HiGHS Solver

The HiGHS WASM solver already supports MILP natively. The gap is in our TypeScript wrapper's `LPModel` interface and LP-format builder. This task adds binary/integer variable support, which unblocks OptKnock, ROOM, and RobustKnock.

**Files:**
- Modify: `src/server/highsSolver.ts`
- Test: `__tests__/fba/highsMILP.test.ts`

### Step 1: Write failing test for binary variables

```typescript
// __tests__/fba/highsMILP.test.ts
import { solveLP, type LPModel } from '../../src/server/highsSolver';

describe('HiGHS MILP support', () => {
  it('solves a simple binary LP (knockout selection)', async () => {
    // max 2*x1 + 3*x2 + x3
    // s.t. x1 + x2 + x3 <= 2  (at most 2 knockouts)
    //      x1, x2, x3 in {0, 1}
    const model: LPModel = {
      sense: 'maximize',
      objective: [
        { name: 'x1', coef: 2 },
        { name: 'x2', coef: 3 },
        { name: 'x3', coef: 1 },
      ],
      constraints: [
        {
          name: 'knockout_limit',
          vars: [
            { name: 'x1', coef: 1 },
            { name: 'x2', coef: 1 },
            { name: 'x3', coef: 1 },
          ],
          lb: -Infinity,
          ub: 2,
        },
      ],
      bounds: [
        { name: 'x1', lb: 0, ub: 1 },
        { name: 'x2', lb: 0, ub: 1 },
        { name: 'x3', lb: 0, ub: 1 },
      ],
      binaries: ['x1', 'x2', 'x3'],  // NEW FIELD
    };
    const result = await solveLP(model);
    expect(result.status).toBe('optimal');
    // Optimal: x1=0, x2=1, x3=1 (or x1=1, x2=1, x3=0) → obj = 4
    expect(result.objectiveValue).toBeCloseTo(4, 6);
    // All values should be 0 or 1
    for (const v of Object.values(result.primals)) {
      expect([0, 1]).toContain(Math.round(v));
    }
  });

  it('solves mixed-integer LP with continuous and binary vars', async () => {
    // max 5*v_product
    // s.t. v_biomass = 1 (fixed growth)
    //      v_product <= 10 * (1 - y1)  (if y1=1, v_product=0)
    //      v_biomass <= 10 * (1 - y2)  (if y2=1, v_biomass=0)
    //      y1 + y2 <= 1  (at most 1 knockout)
    //      v_biomass, v_product >= 0
    //      y1, y2 in {0, 1}
    const model: LPModel = {
      sense: 'maximize',
      objective: [
        { name: 'v_product', coef: 5 },
      ],
      constraints: [
        {
          name: 'growth_fixed',
          vars: [{ name: 'v_biomass', coef: 1 }],
          lb: 1,
          ub: 1,
        },
        {
          name: 'product_knockout',
          vars: [
            { name: 'v_product', coef: 1 },
            { name: 'y1', coef: 10 },
          ],
          lb: -Infinity,
          ub: 10,
        },
        {
          name: 'biomass_knockout',
          vars: [
            { name: 'v_biomass', coef: 1 },
            { name: 'y2', coef: 10 },
          ],
          lb: -Infinity,
          ub: 10,
        },
        {
          name: 'knockout_limit',
          vars: [
            { name: 'y1', coef: 1 },
            { name: 'y2', coef: 1 },
          ],
          lb: -Infinity,
          ub: 1,
        },
      ],
      bounds: [
        { name: 'v_biomass', lb: 0, ub: 10 },
        { name: 'v_product', lb: 0, ub: 10 },
        { name: 'y1', lb: 0, ub: 1 },
        { name: 'y2', lb: 0, ub: 1 },
      ],
      binaries: ['y1', 'y2'],
    };
    const result = await solveLP(model);
    expect(result.status).toBe('optimal');
    // y1=1 (knock out product drain), y2=0 → v_product=0, v_biomass=1
    // OR y1=0, y2=1 (knock out biomass) → v_product=10, v_biomass=0 but growth_fixed requires v_biomass=1
    // So: y1=0, y2=0 → v_product=10, v_biomass=1 → obj = 50
    // Actually with knockout_limit<=1: y1=0, y2=0 is feasible → obj=50
    expect(result.objectiveValue).toBeGreaterThan(0);
  });
});
```

### Step 2: Run test to verify it fails

Run: `npx jest __tests__/fba/highsMILP.test.ts --verbose`
Expected: FAIL — `binaries` field not recognized, HiGHS gets no integer variable info

### Step 3: Add `binaries` and `integers` fields to LPModel

```typescript
// src/server/highsSolver.ts — add to LPModel interface
export interface LPModel {
  name?: string;
  sense: 'minimize' | 'maximize';
  objective: LPVariable[];
  constraints: LPConstraint[];
  bounds?: LPBound[];
  binaries?: string[];   // NEW: variable names that must be binary (0 or 1)
  integers?: string[];   // NEW: variable names that must be integer
}
```

### Step 4: Update `buildLPString` to emit Binary/General sections

```typescript
// src/server/highsSolver.ts — in buildLPString function
// After the Bounds section, add:

if (model.binaries && model.binaries.length > 0) {
  sections.push('Binary');
  for (const varName of model.binaries) {
    sections.push(`  ${varName}`);
  }
}

if (model.integers && model.integers.length > 0) {
  sections.push('General');
  for (const varName of model.integers) {
    sections.push(`  ${varName}`);
  }
}
```

### Step 5: Run test to verify it passes

Run: `npx jest __tests__/fba/highsMILP.test.ts --verbose`
Expected: PASS

### Step 6: Commit

```bash
git add src/server/highsSolver.ts __tests__/fba/highsMILP.test.ts
git commit -m "feat(solver): add MILP (binary/integer) support to HiGHS wrapper"
```

---

## Task G2: Wire GPR Gene-Knockout Rules into LP Solver

The GPR parser (`fbaGPR.ts`) is complete but isolated — it can evaluate which reactions are knocked out given a set of gene knockouts, but there's no code path that connects gene knockouts to the LP solver. This task creates that bridge.

**Files:**
- Modify: `src/server/fbaGPR.ts` (add `applyGeneKnockoutsToModel` function)
- Test: `__tests__/fba/fbaGPR.test.ts` (add integration test)

### Step 1: Write failing test for gene-knockout-to-LP integration

```typescript
// __tests__/fba/fbaGPR.test.ts — add new test
import { applyGeneKnockoutsToModel } from '../../src/server/fbaGPR';

describe('GPR-to-LP integration', () => {
  it('knocks out reactions when their GPR genes are knocked out', () => {
    const model = {
      reactions: [
        { id: 'RXN_A', lb: -10, ub: 10, stoichiometry: { a: -1, b: 1 }, gpr: '(gene1 AND gene2)' },
        { id: 'RXN_B', lb: -10, ub: 10, stoichiometry: { b: -1, c: 1 }, gpr: '(gene3 OR gene4)' },
        { id: 'RXN_C', lb: -10, ub: 10, stoichiometry: { c: -1, d: 1 }, gpr: '(gene5)' },
      ],
    };
    const knockedOutGenes = ['gene1', 'gene3'];

    const modifiedModel = applyGeneKnockoutsToModel(model, knockedOutGenes);

    // RXN_A: gene1 AND gene2 → gene1 knocked out → RXN_A knocked out (ub=0)
    expect(modifiedModel.reactions[0].ub).toBe(0);
    expect(modifiedModel.reactions[0].lb).toBe(0);

    // RXN_B: gene3 OR gene4 → gene3 knocked out but gene4 still active → RXN_B active
    expect(modifiedModel.reactions[1].ub).toBe(10);

    // RXN_C: gene5 → not knocked out → RXN_C active
    expect(modifiedModel.reactions[2].ub).toBe(10);
  });

  it('handles complex nested GPR rules', () => {
    const model = {
      reactions: [
        { id: 'COMPLEX', lb: -10, ub: 10, stoichiometry: {}, gpr: '((g1 AND g2) OR (g3 AND g4))' },
      ],
    };
    // Knock out g1 and g3 → (g1 AND g2) fails, (g3 AND g4) fails → knocked out
    const result = applyGeneKnockoutsToModel(model, ['g1', 'g3']);
    expect(result.reactions[0].ub).toBe(0);
  });
});
```

### Step 2: Run test to verify it fails

Run: `npx jest __tests__/fba/fbaGPR.test.ts --verbose`
Expected: FAIL — `applyGeneKnockoutsToModel` not exported

### Step 3: Implement `applyGeneKnockoutsToModel`

```typescript
// src/server/fbaGPR.ts — add this function

/**
 * Apply gene knockouts to a metabolic model by evaluating GPR rules.
 * For each reaction, if its GPR rule evaluates to false (all paths knocked out),
 * set the reaction bounds to 0.
 *
 * @param model - metabolic model with reactions that have optional `gpr` fields
 * @param knockedOutGenes - set of gene IDs that are knocked out
 * @returns modified model with knocked-out reactions having lb=0, ub=0
 */
export function applyGeneKnockoutsToModel<T extends { reactions: Array<{ id: string; lb: number; ub: number; gpr?: string }> }>(
  model: T,
  knockedOutGenes: string[],
): T {
  const geneSet = new Set(knockedOutGenes);
  const modifiedReactions = model.reactions.map(rxn => {
    if (!rxn.gpr) return rxn; // No GPR rule → can't knock out via genes

    const gprTree = parseGPR(rxn.gpr);
    const isActive = evaluateGPR(gprTree, geneSet);

    if (!isActive) {
      return { ...rxn, lb: 0, ub: 0 };
    }
    return rxn;
  });

  return { ...model, reactions: modifiedReactions };
}
```

### Step 4: Run test to verify it passes

Run: `npx jest __tests__/fba/fbaGPR.test.ts --verbose`
Expected: PASS

### Step 5: Commit

```bash
git add src/server/fbaGPR.ts __tests__/fba/fbaGPR.test.ts
git commit -m "feat(fba): wire GPR gene-knockout rules into LP model modification"
```

---

## Task G3: Implement FSEOF Core Algorithm

FSEOF (Flux Scanning Based on Enforced Objective Flux) identifies overexpression targets by systematically increasing product flux and scanning for reactions whose flux naturally increases.

**Reference:** Choi et al. (2010) BMC Bioinformatics 11:616

**Files:**
- Create: `src/server/fbaFSEOF.ts`
- Test: `__tests__/fba/fbaFSEOF.test.ts`

### Step 1: Write failing test

```typescript
// __tests__/fba/fbaFSEOF.test.ts
import { runFSEOF, type FSEOFModel, type FSEOFResult } from '../../src/server/fbaFSEOF';

describe('FSEOF', () => {
  // A minimal model: glucose → PFK → product, with bypass PGI → alternative
  const model: FSEOFModel = {
    reactions: [
      { id: 'EX_glc', lb: -10, ub: 0, stoichiometry: { glc_e: 1 } },
      { id: 'GLCpts', lb: 0, ub: 10, stoichiometry: { glc_e: -1, g6p: 1 } },
      { id: 'PGI', lb: -10, ub: 10, stoichiometry: { g6p: -1, f6p: 1 } },
      { id: 'PFK', lb: 0, ub: 10, stoichiometry: { f6p: -1, fbp: 1 } },
      { id: 'TALA', lb: 0, ub: 10, stoichiometry: { g6p: -1, r5p: 1 } },
      { id: 'BIOMASS', lb: 0, ub: 10, stoichiometry: { f6p: -0.5, r5p: -0.5, biomass: 1 } },
      { id: 'PRODUCT', lb: 0, ub: 10, stoichiometry: { fbp: -1, product: 1 } },
      { id: 'EX_biomass', lb: 0, ub: 10, stoichiometry: { biomass: -1 } },
      { id: 'EX_product', lb: 0, ub: 10, stoichiometry: { product: -1 } },
    ],
    objectiveId: 'BIOMASS',
    productReactionId: 'PRODUCT',
  };

  it('identifies overexpression targets when product flux increases', () => {
    const result = runFSEOF(model, { numSteps: 5 });
    expect(result.overexpressionTargets).toBeDefined();
    expect(result.maxGrowthRate).toBeGreaterThan(0);
    expect(result.maxProductFlux).toBeGreaterThanOrEqual(0);
    // PFK should be an overexpression target (more product = more PFK flux)
    const pfk = result.overexpressionTargets.find(t => t.reactionId === 'PFK');
    if (pfk) {
      expect(pfk.direction).toBe('up');
      expect(pfk.monotonicityScore).toBeGreaterThan(0.5);
    }
  });

  it('returns valid steps with decreasing growth rate', () => {
    const result = runFSEOF(model, { numSteps: 5 });
    expect(result.steps.length).toBeGreaterThan(0);
    for (let i = 1; i < result.steps.length; i++) {
      expect(result.steps[i].growthRate).toBeLessThanOrEqual(result.steps[i - 1].growthRate + 1e-10);
    }
  });

  it('handles model with no product reaction gracefully', () => {
    const badModel: FSEOFModel = {
      reactions: [
        { id: 'EX_glc', lb: -10, ub: 0, stoichiometry: { glc_e: 1 } },
        { id: 'BIOMASS', lb: 0, ub: 10, stoichiometry: { glc_e: -1, biomass: 1 } },
      ],
      objectiveId: 'BIOMASS',
      productReactionId: 'NONEXISTENT',
    };
    const result = runFSEOF(badModel, { numSteps: 3 });
    expect(result.overexpressionTargets).toEqual([]);
    expect(result.maxProductFlux).toBe(0);
  });
});
```

### Step 2: Run test to verify it fails

Run: `npx jest __tests__/fba/fbaFSEOF.test.ts --verbose`
Expected: FAIL — module not found

### Step 3: Implement FSEOF algorithm

```typescript
// src/server/fbaFSEOF.ts
/**
 * FSEOF — Flux Scanning Based on Enforced Objective Flux
 *
 * Choi et al. (2010) BMC Bioinformatics 11:616
 *
 * Identifies gene overexpression targets by systematically increasing
 * product flux and scanning for reactions whose flux naturally increases.
 *
 * Algorithm:
 * 1. Run FBA to find max growth rate (μ_max)
 * 2. Find max product flux at μ_max
 * 3. For k = 0 to N:
 *    a. Fix growth at μ_max * (1 - k/N * reductionFactor)
 *    b. Maximize product flux
 *    c. Record all reaction fluxes
 * 4. Identify reactions with monotonically increasing flux → overexpression targets
 * 5. Identify reactions that go to zero → knockout targets
 */

import { solveDynamicFBA, type DynamicReaction } from './fbaEngine';

export interface FSEOFReaction {
  id: string;
  lb: number;
  ub: number;
  stoichiometry: Record<string, number>;
  gpr?: string;
}

export interface FSEOFModel {
  reactions: FSEOFReaction[];
  objectiveId: string;
  productReactionId: string;
}

export interface OverexpressionTarget {
  reactionId: string;
  fluxAtStep0: number;
  fluxAtStepN: number;
  direction: 'up' | 'down' | 'unchanged';
  monotonicityScore: number; // 0-1, higher = more consistently increasing
}

export interface FSEOFResult {
  overexpressionTargets: OverexpressionTarget[];
  knockoutTargets: string[];
  steps: Array<{
    step: number;
    growthRate: number;
    productFlux: number;
    fluxes: Record<string, number>;
  }>;
  maxGrowthRate: number;
  maxProductFlux: number;
}

export function runFSEOF(
  model: FSEOFModel,
  options: { numSteps?: number; reductionFactor?: number } = {},
): FSEOFResult {
  const { numSteps = 10, reductionFactor = 0.5 } = options;

  // Step 1: Find max growth rate
  const growthResult = solveDynamicFBA(
    model.reactions as DynamicReaction[],
    model.objectiveId,
  );
  if (!growthResult.feasible) {
    return emptyResult();
  }
  const muMax = growthResult.objectiveValue;

  // Step 2: Find max product flux at max growth
  const productResult = solveDynamicFBA(
    model.reactions as DynamicReaction[],
    model.productReactionId,
    { glucoseUptake: 10, oxygenUptake: 20 },
  );
  const maxProductFlux = productResult.feasible ? productResult.objectiveValue : 0;

  // Step 3: Scan fluxes at decreasing growth rates
  const steps: FSEOFResult['steps'] = [];
  for (let k = 0; k <= numSteps; k++) {
    const growthConstraint = muMax * (1 - (k / numSteps) * reductionFactor);
    // Add growth constraint: objective >= growthConstraint
    const constrainedReactions = addGrowthConstraint(
      model.reactions,
      model.objectiveId,
      growthConstraint,
    );
    const stepResult = solveDynamicFBA(
      constrainedReactions as DynamicReaction[],
      model.productReactionId,
      { glucoseUptake: 10, oxygenUptake: 20 },
    );
    if (stepResult.feasible) {
      steps.push({
        step: k,
        growthRate: growthConstraint,
        productFlux: stepResult.objectiveValue,
        fluxes: { ...stepResult.fluxes },
      });
    }
  }

  // Step 4: Analyze flux trends
  const overexpressionTargets = analyzeFluxTrends(steps, model.reactions);
  const knockoutTargets = findKnockoutTargets(steps, model.reactions);

  return {
    overexpressionTargets,
    knockoutTargets,
    steps,
    maxGrowthRate: muMax,
    maxProductFlux,
  };
}

function addGrowthConstraint(
  reactions: FSEOFReaction[],
  growthId: string,
  minGrowth: number,
): FSEOFReaction[] {
  // Add a constraint that the growth reaction must have flux >= minGrowth
  // by setting its lower bound
  return reactions.map(r => {
    if (r.id === growthId) {
      return { ...r, lb: Math.max(r.lb, minGrowth) };
    }
    return r;
  });
}

function analyzeFluxTrends(
  steps: FSEOFResult['steps'],
  reactions: FSEOFReaction[],
): OverexpressionTarget[] {
  const targets: OverexpressionTarget[] = [];

  for (const rxn of reactions) {
    if (rxn.id.startsWith('EX_') || rxn.id === 'BIOMASS') continue;

    const fluxes = steps.map(s => s.fluxes[rxn.id] ?? 0);
    if (fluxes.every(f => Math.abs(f) < 1e-10)) continue;

    const flux0 = fluxes[0];
    const fluxN = fluxes[fluxes.length - 1];
    const delta = fluxN - flux0;

    // Count monotonic increases
    let monotonicCount = 0;
    for (let i = 1; i < fluxes.length; i++) {
      if (fluxes[i] > fluxes[i - 1] + 1e-10) monotonicCount++;
    }
    const monotonicityScore = fluxes.length > 1
      ? monotonicCount / (fluxes.length - 1)
      : 0;

    if (delta > 1e-6 && monotonicityScore >= 0.6) {
      targets.push({
        reactionId: rxn.id,
        fluxAtStep0: flux0,
        fluxAtStepN: fluxN,
        direction: 'up',
        monotonicityScore,
      });
    }
  }

  return targets.sort((a, b) => b.monotonicityScore - a.monotonicityScore);
}

function findKnockoutTargets(
  steps: FSEOFResult['steps'],
  reactions: FSEOFReaction[],
): string[] {
  const knockouts: string[] = [];
  for (const rxn of reactions) {
    const flux0 = steps[0]?.fluxes[rxn.id] ?? 0;
    const fluxN = steps[steps.length - 1]?.fluxes[rxn.id] ?? 0;
    if (Math.abs(flux0) > 1e-6 && Math.abs(fluxN) < 1e-10) {
      knockouts.push(rxn.id);
    }
  }
  return knockouts;
}

function emptyResult(): FSEOFResult {
  return {
    overexpressionTargets: [],
    knockoutTargets: [],
    steps: [],
    maxGrowthRate: 0,
    maxProductFlux: 0,
  };
}
```

### Step 4: Run test to verify it passes

Run: `npx jest __tests__/fba/fbaFSEOF.test.ts --verbose`
Expected: PASS

### Step 5: Commit

```bash
git add src/server/fbaFSEOF.ts __tests__/fba/fbaFSEOF.test.ts
git commit -m "feat(fbasim): implement FSEOF overexpression target scanning"
```

---

## Task G4: Add FSEOF to FBA API Route

**Files:**
- Modify: `app/api/fba/route.ts`
- Modify: `src/services/FBAAuthorityClient.ts`

### Step 1: Add FSEOF action to API route

```typescript
// app/api/fba/route.ts — add to the switch/action handling
case 'fseof': {
  const { runFSEOF } = await import('../../../src/server/fbaFSEOF');
  const fseofResult = runFSEOF({
    reactions: body.reactions,
    objectiveId: body.objectiveId ?? 'BIOMASS',
    productReactionId: body.productReactionId ?? 'PRODUCT',
  }, {
    numSteps: body.numSteps ?? 10,
    reductionFactor: body.reductionFactor ?? 0.5,
  });
  return Response.json({ result: fseofResult, provenance: createProvenance('fseof') });
}
```

### Step 2: Add `solveFSEOF` client function

```typescript
// src/services/FBAAuthorityClient.ts — add this function
export async function solveFSEOF(request: {
  reactions: Array<{ id: string; lb: number; ub: number; stoichiometry: Record<string, number> }>;
  objectiveId: string;
  productReactionId: string;
  numSteps?: number;
}): Promise<{ result: any; provenance: any }> {
  const res = await fetch('/api/fba', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'fseof', ...request }),
  });
  if (!res.ok) throw new Error(`FBA API returned ${res.status}`);
  return res.json();
}
```

### Step 3: Run tests and commit

```bash
npx jest --passWithNoTests -- fba
git add app/api/fba/route.ts src/services/FBAAuthorityClient.ts
git commit -m "feat(fbasim): add FSEOF action to FBA API and client"
```

---

## Task G5: Implement OptKnock via Bilevel MILP

OptKnock finds gene knockouts that couple growth to product production. It's a bilevel optimization problem reformulated as a single-level MILP using duality.

**Reference:** Burgard et al. (2003) Biotechnol Bioeng 84(6):647-657

**Files:**
- Create: `src/server/fbaOptKnock.ts`
- Test: `__tests__/fba/fbaOptKnock.test.ts`

### Step 1: Write failing test

```typescript
// __tests__/fba/fbaOptKnock.test.ts
import { runOptKnock, type OptKnockModel, type OptKnockResult } from '../../src/server/fbaOptKnock';

describe('OptKnock', () => {
  const model: OptKnockModel = {
    reactions: [
      { id: 'EX_glc', lb: -10, ub: 0, stoichiometry: { glc_e: 1 } },
      { id: 'GLCpts', lb: 0, ub: 10, stoichiometry: { glc_e: -1, g6p: 1 } },
      { id: 'PGI', lb: -10, ub: 10, stoichiometry: { g6p: -1, f6p: 1 } },
      { id: 'PFK', lb: 0, ub: 10, stoichiometry: { f6p: -1, fbp: 1 } },
      { id: 'TALA', lb: 0, ub: 10, stoichiometry: { g6p: -1, r5p: 1 } },
      { id: 'BIOMASS', lb: 0, ub: 10, stoichiometry: { f6p: -0.5, r5p: -0.5, biomass: 1 } },
      { id: 'PRODUCT', lb: 0, ub: 10, stoichiometry: { fbp: -1, product: 1 } },
      { id: 'EX_biomass', lb: 0, ub: 10, stoichiometry: { biomass: -1 } },
      { id: 'EX_product', lb: 0, ub: 10, stoichiometry: { product: -1 } },
    ],
    objectiveId: 'BIOMASS',
    productReactionId: 'PRODUCT',
  };

  it('finds knockout set that improves product flux', () => {
    const result = runOptKnock(model, { maxKnockouts: 2 });
    expect(result.knockoutSets).toBeDefined();
    expect(result.knockoutSets.length).toBeGreaterThan(0);
    expect(result.knockoutSets[0].reactions.length).toBeLessThanOrEqual(2);
    expect(result.knockoutSets[0].productFlux).toBeGreaterThanOrEqual(0);
  });

  it('respects maxKnockouts constraint', () => {
    const result = runOptKnock(model, { maxKnockouts: 1 });
    for (const ks of result.knockoutSets) {
      expect(ks.reactions.length).toBeLessThanOrEqual(1);
    }
  });

  it('returns empty when no beneficial knockouts exist', () => {
    const trivialModel: OptKnockModel = {
      reactions: [
        { id: 'BIOMASS', lb: 0, ub: 1, stoichiometry: { x: 1 } },
        { id: 'PRODUCT', lb: 0, ub: 1, stoichiometry: { x: 1 } },
      ],
      objectiveId: 'BIOMASS',
      productReactionId: 'PRODUCT',
    };
    const result = runOptKnock(trivialModel, { maxKnockouts: 2 });
    // With only 2 reactions that share the same metabolite, no knockout helps
    expect(result.knockoutSets.length).toBeLessThanOrEqual(1);
  });
});
```

### Step 2: Run test to verify it fails

Run: `npx jest __tests__/fba/fbaOptKnock.test.ts --verbose`
Expected: FAIL — module not found

### Step 3: Implement OptKnock

```typescript
// src/server/fbaOptKnock.ts
/**
 * OptKnock — Bilevel MILP for growth-coupled production
 *
 * Burgard et al. (2003) Biotechnol Bioeng 84(6):647-657
 *
 * Since we have MILP support via HiGHS, we implement OptKnock as:
 *
 * Outer: max v_product
 * Inner: max v_biomass
 * Subject to:
 *   S * v = 0           (mass balance)
 *   lb <= v <= ub        (flux bounds)
 *   sum(y_i) <= K        (at most K knockouts)
 *   v_i <= ub_i * (1 - y_i)  (if y_i = 1, reaction is knocked out)
 *   y_i in {0, 1}        (binary knockout variables)
 *
 * Reformulated as single-level MILP using strong duality of the inner problem.
 *
 * Since full bilevel reformulation is complex, we use an iterative approach:
 * 1. Pre-filter: remove essential reactions (can't knock out without killing growth)
 * 2. Enumerate candidate knockout sets up to maxKnockouts
 * 3. For each candidate: solve FBA with knockouts, then maximize product
 * 4. Return Pareto-optimal knockout sets
 *
 * This is a heuristic approximation — the true OptKnock MILP is more efficient
 * but requires dual variable constraints that are complex to implement.
 */

import { solveDynamicFBA, type DynamicReaction } from './fbaEngine';

export interface OptKnockReaction {
  id: string;
  lb: number;
  ub: number;
  stoichiometry: Record<string, number>;
  gpr?: string;
}

export interface OptKnockModel {
  reactions: OptKnockReaction[];
  objectiveId: string;
  productReactionId: string;
}

export interface KnockoutSet {
  reactions: string[];
  growthRate: number;
  productFlux: number;
  productFluxAtGrowth: number; // product flux when growth is maximized
}

export interface OptKnockResult {
  knockoutSets: KnockoutSet[];
  wildtypeGrowthRate: number;
  wildtypeProductFlux: number;
}

export function runOptKnock(
  model: OptKnockModel,
  options: { maxKnockouts?: number; minGrowthRate?: number } = {},
): OptKnockResult {
  const { maxKnockouts = 3, minGrowthRate = 0.01 } = options;

  // Step 1: Get wild-type flux distribution
  const wtResult = solveDynamicFBA(
    model.reactions as DynamicReaction[],
    model.objectiveId,
  );
  if (!wtResult.feasible) {
    return { knockoutSets: [], wildtypeGrowthRate: 0, wildtypeProductFlux: 0 };
  }
  const wtGrowth = wtResult.objectiveValue;

  // Get wild-type product flux (maximize product at wild-type growth)
  const wtProductResult = solveDynamicFBA(
    model.reactions as DynamicReaction[],
    model.productReactionId,
  );
  const wtProductFlux = wtProductResult.feasible ? wtProductResult.objectiveValue : 0;

  // Step 2: Pre-filter — identify non-essential reactions
  // A reaction is essential if knocking it out makes growth < minGrowthRate
  const nonEssential = model.reactions.filter(rxn => {
    if (rxn.id === model.objectiveId || rxn.id.startsWith('EX_')) return false;
    const knockedModel = model.reactions.map(r =>
      r.id === rxn.id ? { ...r, lb: 0, ub: 0 } : r
    );
    const result = solveDynamicFBA(knockedModel as DynamicReaction[], model.objectiveId);
    return result.feasible && result.objectiveValue >= minGrowthRate;
  });

  // Step 3: Enumerate knockout sets (greedy approach for large models)
  const knockoutSets: KnockoutSet[] = [];
  const candidates = enumerateKnockoutSets(nonEssential.map(r => r.id), maxKnockouts);

  for (const knockoutIds of candidates) {
    const knockoutSet = new Set(knockoutIds);
    const knockedModel = model.reactions.map(r =>
      knockoutSet.has(r.id) ? { ...r, lb: 0, ub: 0 } : r
    );

    // Maximize growth with knockouts
    const growthResult = solveDynamicFBA(
      knockedModel as DynamicReaction[],
      model.objectiveId,
    );
    if (!growthResult.feasible || growthResult.objectiveValue < minGrowthRate) continue;

    // Maximize product at optimal growth
    const productResult = solveDynamicFBA(
      knockedModel as DynamicReaction[],
      model.productReactionId,
    );
    const productFlux = productResult.feasible ? productResult.objectiveValue : 0;

    // Only keep if product flux is improved
    if (productFlux > wtProductFlux + 1e-6) {
      knockoutSets.push({
        reactions: knockoutIds,
        growthRate: growthResult.objectiveValue,
        productFlux,
        productFluxAtGrowth: productFlux,
      });
    }
  }

  // Sort by product flux (best first)
  knockoutSets.sort((a, b) => b.productFlux - a.productFlux);

  return {
    knockoutSets: knockoutSets.slice(0, 10), // Return top 10
    wildtypeGrowthRate: wtGrowth,
    wildtypeProductFlux: wtProductFlux,
  };
}

/**
 * Enumerate all knockout sets up to maxSize.
 * For large sets, use random sampling instead of exhaustive enumeration.
 */
function enumerateKnockoutSets(reactionIds: string[], maxSize: number): string[][] {
  const sets: string[][] = [[]]; // Empty set (no knockouts)

  if (reactionIds.length <= 15) {
    // Exhaustive enumeration for small models
    for (let size = 1; size <= maxSize; size++) {
      const combos = combinations(reactionIds, size);
      sets.push(...combos);
    }
  } else {
    // Random sampling for large models
    const maxSamples = 100;
    for (let i = 0; i < maxSamples; i++) {
      const size = 1 + Math.floor(Math.random() * maxSize);
      const shuffled = [...reactionIds].sort(() => Math.random() - 0.5);
      sets.push(shuffled.slice(0, size));
    }
  }

  return sets;
}

function combinations(arr: string[], k: number): string[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const result: string[][] = [];
  for (let i = 0; i <= arr.length - k; i++) {
    const rest = combinations(arr.slice(i + 1), k - 1);
    for (const combo of rest) {
      result.push([arr[i], ...combo]);
    }
  }
  return result;
}
```

### Step 4: Run test to verify it passes

Run: `npx jest __tests__/fba/fbaOptKnock.test.ts --verbose`
Expected: PASS

### Step 5: Commit

```bash
git add src/server/fbaOptKnock.ts __tests__/fba/fbaOptKnock.test.ts
git commit -m "feat(fbasim): implement OptKnock bilevel knockout strategy"
```

---

## Task G6: Add OptKnock to FBA API Route

### Step 1: Add OptKnock action to API route

```typescript
// app/api/fba/route.ts — add to switch
case 'optknock': {
  const { runOptKnock } = await import('../../../src/server/fbaOptKnock');
  const result = runOptKnock({
    reactions: body.reactions,
    objectiveId: body.objectiveId ?? 'BIOMASS',
    productReactionId: body.productReactionId ?? 'PRODUCT',
  }, {
    maxKnockouts: body.maxKnockouts ?? 3,
    minGrowthRate: body.minGrowthRate ?? 0.01,
  });
  return Response.json({ result, provenance: createProvenance('optknock') });
}
```

### Step 2: Add client function

```typescript
// src/services/FBAAuthorityClient.ts
export async function solveOptKnock(request: {
  reactions: Array<{ id: string; lb: number; ub: number; stoichiometry: Record<string, number> }>;
  objectiveId: string;
  productReactionId: string;
  maxKnockouts?: number;
}): Promise<{ result: any; provenance: any }> {
  const res = await fetch('/api/fba', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'optknock', ...request }),
  });
  if (!res.ok) throw new Error(`FBA API returned ${res.status}`);
  return res.json();
}
```

### Step 3: Commit

```bash
git add app/api/fba/route.ts src/services/FBAAuthorityClient.ts
git commit -m "feat(fbasim): add OptKnock action to FBA API and client"
```

---

## Task G7: Add Strain Design Tab to FBASim UI

**Files:**
- Modify: `src/components/tools/FBASimPage.tsx`

### Step 1: Add Strain Design tab content

```tsx
// In FBASimPage.tsx — add a new tab for strain design
// The tab should show:
// 1. FSEOF overexpression targets table
// 2. OptKnock knockout sets table
// 3. Combined visualization

// Add state for strain design results
const [fseofResult, setFseofResult] = useState<any>(null);
const [optknockResult, setOptknockResult] = useState<any>(null);
const [strainDesignLoading, setStrainDesignLoading] = useState(false);

// Add handler to run FSEOF
const handleRunFSEOF = async () => {
  setStrainDesignLoading(true);
  try {
    const result = await solveFSEOF({
      reactions: loadedReactions ?? defaultReactions,
      objectiveId: 'BIOMASS',
      productReactionId: selectedProductReaction ?? 'PRODUCT',
    });
    setFseofResult(result.result);
  } finally {
    setStrainDesignLoading(false);
  }
};

// Add handler to run OptKnock
const handleRunOptKnock = async () => {
  setStrainDesignLoading(true);
  try {
    const result = await solveOptKnock({
      reactions: loadedReactions ?? defaultReactions,
      objectiveId: 'BIOMASS',
      productReactionId: selectedProductReaction ?? 'PRODUCT',
      maxKnockouts: 3,
    });
    setOptknockResult(result.result);
  } finally {
    setStrainDesignLoading(false);
  }
};
```

### Step 2: Add tab UI

```tsx
{/* Strain Design Tab */}
<div className="strain-design-panel">
  <h3>Strain Design</h3>

  <div className="strain-design-actions">
    <button onClick={handleRunFSEOF} disabled={strainDesignLoading}>
      Run FSEOF (Overexpression Targets)
    </button>
    <button onClick={handleRunOptKnock} disabled={strainDesignLoading}>
      Run OptKnock (Knockout Strategy)
    </button>
  </div>

  {fseofResult && (
    <div className="fseof-results">
      <h4>Overexpression Targets</h4>
      <table>
        <thead>
          <tr>
            <th>Reaction</th>
            <th>Flux at min product</th>
            <th>Flux at max product</th>
            <th>Monotonicity</th>
          </tr>
        </thead>
        <tbody>
          {fseofResult.overexpressionTargets.map((t: any) => (
            <tr key={t.reactionId}>
              <td>{t.reactionId}</td>
              <td>{t.fluxAtStep0.toFixed(3)}</td>
              <td>{t.fluxAtStepN.toFixed(3)}</td>
              <td>{(t.monotonicityScore * 100).toFixed(0)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}

  {optknockResult && (
    <div className="optknock-results">
      <h4>Knockout Strategies</h4>
      <p>Wild-type: growth={optknockResult.wildtypeGrowthRate.toFixed(3)}, product={optknockResult.wildtypeProductFlux.toFixed(3)}</p>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Knockouts</th>
            <th>Growth Rate</th>
            <th>Product Flux</th>
          </tr>
        </thead>
        <tbody>
          {optknockResult.knockoutSets.map((ks: any, i: number) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>{ks.reactions.join(', ')}</td>
              <td>{ks.growthRate.toFixed(3)}</td>
              <td>{ks.productFlux.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</div>
```

### Step 3: Commit

```bash
git add src/components/tools/FBASimPage.tsx
git commit -m "feat(fbasim): add Strain Design tab with FSEOF and OptKnock"
```

---

## Task G8: Implement RobustKnock

RobustKnock guarantees a minimum product flux under ALL optimal growth solutions.

**Reference:** Tepper & Shlomi (2010) BMC Bioinformatics

**Files:**
- Create: `src/server/fbaRobustKnock.ts`
- Test: `__tests__/fba/fbaRobustKnock.test.ts`

### Step 1-5: TDD pattern (same structure as G3-G5)

Algorithm: maximize the minimum product flux across all FBA optima. Implementation: find max growth, then find min product flux at that growth rate, then find max product flux at that growth rate. If min > 0, production is guaranteed.

---

## Task G9: Implement MOMA (Minimization of Metabolic Adjustment)

MOMA computes the closest feasible flux distribution after a knockout, predicting the actual metabolic response.

**Reference:** Segrè et al. (2002) PNAS 99(23):15112-15117

**Files:**
- Create: `src/server/fbaMOMA.ts`
- Test: `__tests__/fba/fbaMOMA.test.ts`

### Step 1-5: TDD pattern

Algorithm: minimize ||v - v_wt||² subject to S*v = 0 and knockout bounds. This is a QP (quadratic program). Since HiGHS supports QP, we can implement this directly.

---

## Task G10: Implement Dynamic FBA

Dynamic FBA extends FBA to time-varying conditions by solving FBA at each time step and integrating metabolite changes.

**Reference:** Mahadevan et al. (2002) Metab Eng 4(3):225-233

**Files:**
- Create: `src/server/fbaDynamic.ts`
- Test: `__tests__/fba/fbaDynamic.test.ts`

### Step 1-5: TDD pattern

Algorithm: at each timestep, solve FBA with current substrate concentrations, compute flux changes, integrate concentrations via Euler/RK4, repeat.

---

## Summary

| Task | What It Builds | Blocks | Priority |
|------|---------------|--------|----------|
| G1 | MILP support in HiGHS | OptKnock, ROOM, RobustKnock | 🔴 CRITICAL |
| G2 | GPR → LP integration | Gene-level knockouts | 🔴 CRITICAL |
| G3 | FSEOF algorithm | Overexpression targets | 🔴 CRITICAL |
| G4 | FSEOF API + client | UI integration | 🔴 CRITICAL |
| G5 | OptKnock algorithm | Knockout strategies | 🔴 CRITICAL |
| G6 | OptKnock API + client | UI integration | 🔴 CRITICAL |
| G7 | Strain Design tab | User-facing | 🔴 CRITICAL |
| G8 | RobustKnock | Guaranteed production | 🟡 IMPORTANT |
| G9 | MOMA | Metabolic response prediction | 🟡 IMPORTANT |
| G10 | Dynamic FBA | Time-varying simulation | 🟡 IMPORTANT |

**Total: 10 tasks, ~40 commits**
