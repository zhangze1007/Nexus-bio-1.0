# Wave 2: FBA Engine Upgrade (HiGHS)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the custom simplexLP solver with HiGHS (WASM, MIT license) and implement FVA, pFBA, GPR rules, and direct shadow price extraction.

**Architecture:** HiGHS runs as a WASM module in Node.js (server-side). The FBA engine (`src/server/fbaEngine.ts`) is refactored to use highs for all LP operations. FVA, pFBA, and GPR are implemented as TypeScript functions that call the solver multiple times.

**Tech Stack:** `highs` (WASM, MIT), TypeScript, existing iJO1366 data

---

## File Structure

### Files to Modify
| File | Change |
|------|--------|
| `src/server/fbaEngine.ts` | Refactor to use highs, add FVA/pFBA/GPR functions |
| `src/data/iJO1366Subset.ts` | Expand to ~200 reactions, add GPR rules field |
| `app/api/fba/route.ts` | Add FVA/pFBA/GPR endpoints |
| `src/components/tools/FBASimPage.tsx` | Add FVA/pFBA/GPR UI panels |
| `package.json` | Add `highs` dependency |

### Files to Create
| File | Purpose |
|------|---------|
| `src/server/highsSolver.ts` | Highs solver wrapper (builds LP model, calls highs, extracts results) |
| `src/server/fbaFVA.ts` | FVA implementation |
| `src/server/fbaPFBA.ts` | pFBA implementation |
| `src/server/fbaGPR.ts` | GPR rule parser and knockout engine |
| `src/components/tools/fba/FVAPanel.tsx` | FVA results visualization |
| `src/components/tools/fba/GPRPanel.tsx` | Gene knockout interface |

### Files Unchanged
| File | Reason |
|------|--------|
| `src/server/simplexLP.ts` | Keep as fallback reference, not used in primary path |

---

## Task 1: Install highs and create solver wrapper

**Files:**
- Modify: `package.json`
- Create: `src/server/highsSolver.ts`

- [ ] **Step 1: Install highs**

```bash
npm install highs
```

- [ ] **Step 2: Create the highs solver wrapper**

Create `src/server/highsSolver.ts`:

```typescript
/**
 * HiGHS LP solver wrapper.
 *
 * Builds LP models in the highs JSON format, solves them,
 * and extracts primal/dual variables.
 *
 * Replaces simplexLP.ts as the primary FBA solver.
 */
import highs from 'highs';

export interface LPVariable {
  name: string;
  coef: number;
}

export interface LPConstraint {
  name: string;
  vars: LPVariable[];
  lb: number;
  ub: number;
}

export interface LPBound {
  name: string;
  lb: number;
  ub: number;
}

export interface LPModel {
  name?: string;
  sense: 'minimize' | 'maximize';
  objective: LPVariable[];
  constraints: LPConstraint[];
  bounds?: LPBound[];
}

export interface LPSolution {
  status: 'optimal' | 'infeasible' | 'unbounded' | 'error';
  objectiveValue: number;
  primals: Record<string, number>;
  duals: Record<string, number>;
  solveTime: number;
}

/**
 * Solve an LP problem using HiGHS.
 */
export async function solveLP(model: LPModel): Promise<LPSolution> {
  const start = Date.now();

  // Build highs model format
  const highsModel: Record<string, unknown> = {
    name: model.name || 'fba',
    sense: model.sense === 'maximize' ? -1 : 1, // highs uses -1 for maximize
    continuous_variables: model.objective.map(v => v.name),
    objective_linear: model.objective.map(v => ({ name: v.name, coef: v.coef })),
    constraints: model.constraints.map(c => ({
      name: c.name,
      vars: c.vars.map(v => ({ name: v.name, coef: v.coef })),
      lower: c.lb,
      upper: c.ub,
    })),
  };

  // Add variable bounds
  if (model.bounds) {
    highsModel.bounds = model.bounds.map(b => ({
      name: b.name,
      lower: b.lb,
      upper: b.ub,
    }));
  }

  try {
    const result = highs(highsModel);
    const solveTime = Date.now() - start;

    // Extract primals and duals
    const primals: Record<string, number> = {};
    const duals: Record<string, number> = {};

    if (result.columns) {
      for (const [name, col] of Object.entries(result.columns)) {
        primals[name] = (col as { primal: number }).primal;
      }
    }

    if (result.rows) {
      for (const [name, row] of Object.entries(result.rows)) {
        duals[name] = (row as { dual: number }).dual;
      }
    }

    const statusMap: Record<number, LPSolution['status']> = {
      0: 'error',    // UNSET
      1: 'error',    // LOAD_ERROR
      2: 'error',    // MODEL_ERROR
      3: 'error',    // PRESOLVE_ERROR
      4: 'error',    // SOLVE_ERROR
      5: 'error',    // POSTSOLVE_ERROR
      6: 'optimal',  // OPTIMAL
      7: 'infeasible', // INFEASIBLE
      8: 'unbounded', // UNBOUNDED
      9: 'error',    // REACHED_DUAL_OBJECTIVE
      10: 'error',   // REACHED_OBJECTIVE_BOUND
      11: 'error',   // REACHED_TIME_LIMIT
      12: 'error',   // REACHED_ITERATION_LIMIT
    };

    return {
      status: statusMap[result.status] || 'error',
      objectiveValue: result.objective_value || 0,
      primals,
      duals,
      solveTime,
    };
  } catch (err) {
    return {
      status: 'error',
      objectiveValue: 0,
      primals: {},
      duals: {},
      solveTime: Date.now() - start,
    };
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/server/highsSolver.ts
git commit -m "feat: add highs LP solver wrapper"
```

---

## Task 2: Write solver tests and verify correctness

**Files:**
- Create: `__tests__/highsSolver.test.ts`

- [ ] **Step 1: Write solver tests**

Create `__tests__/highsSolver.test.ts`:

```typescript
import { solveLP, type LPModel } from '../src/server/highsSolver';

describe('highsSolver', () => {
  test('solves a simple LP: max 2x + 3y s.t. x + y <= 4, x <= 2', async () => {
    const model: LPModel = {
      sense: 'maximize',
      objective: [
        { name: 'x', coef: 2 },
        { name: 'y', coef: 3 },
      ],
      constraints: [
        {
          name: 'c1',
          vars: [
            { name: 'x', coef: 1 },
            { name: 'y', coef: 1 },
          ],
          lb: -Infinity,
          ub: 4,
        },
        {
          name: 'c2',
          vars: [{ name: 'x', coef: 1 }],
          lb: -Infinity,
          ub: 2,
        },
      ],
      bounds: [
        { name: 'x', lb: 0, ub: Infinity },
        { name: 'y', lb: 0, ub: Infinity },
      ],
    };

    const result = await solveLP(model);
    expect(result.status).toBe('optimal');
    expect(result.primals['x']).toBeCloseTo(2, 4);
    expect(result.primals['y']).toBeCloseTo(2, 4);
    expect(result.objectiveValue).toBeCloseTo(10, 4);
  });

  test('returns dual variables (shadow prices)', async () => {
    const model: LPModel = {
      sense: 'maximize',
      objective: [{ name: 'x', coef: 1 }],
      constraints: [
        {
          name: 'supply',
          vars: [{ name: 'x', coef: 1 }],
          lb: -Infinity,
          ub: 5,
        },
      ],
      bounds: [
        { name: 'x', lb: 0, ub: Infinity },
      ],
    };

    const result = await solveLP(model);
    expect(result.status).toBe('optimal');
    expect(result.duals['supply']).toBeDefined();
    expect(typeof result.duals['supply']).toBe('number');
  });

  test('detects infeasible problem', async () => {
    const model: LPModel = {
      sense: 'maximize',
      objective: [{ name: 'x', coef: 1 }],
      constraints: [
        {
          name: 'c1',
          vars: [{ name: 'x', coef: 1 }],
          lb: 10,
          ub: 5,
        },
      ],
    };

    const result = await solveLP(model);
    expect(result.status).not.toBe('optimal');
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npx jest __tests__/highsSolver.test.ts --no-cache
```

- [ ] **Step 3: Commit**

```bash
git add __tests__/highsSolver.test.ts
git commit -m "test: add highs solver tests"
```

---

## Task 3: Refactor fbaEngine.ts to use highs

**Files:**
- Modify: `src/server/fbaEngine.ts`

- [ ] **Step 1: Replace simplexLP import with highsSolver**

Change the import at the top of `fbaEngine.ts`:
```typescript
import { solveLP, type LPModel } from './highsSolver';
```

- [ ] **Step 2: Rewrite solveAuthorityFBA to use highs**

Convert the existing constraint/reaction/bound definitions into the highs LP model format. The logic stays the same — only the solver call changes.

- [ ] **Step 3: Update shadow price extraction**

Replace the finite-difference sensitivity calculation with direct dual variable extraction from highs:
```typescript
// Before: finite difference
const sensitivityCoefficients = calculateSensitivity(request);

// After: direct duals
const sensitivityCoefficients = {
  glucose: round(result.duals['glc_balance'] || 0, 4),
  oxygen: round(result.duals['o2_balance'] || 0, 4),
};
```

- [ ] **Step 4: Verify existing tests pass**

```bash
npx jest __tests__/fba*.test.ts --no-cache
```

- [ ] **Step 5: Commit**

```bash
git add src/server/fbaEngine.ts
git commit -m "refactor: replace simplexLP with highs in fbaEngine"
```

---

## Task 4: Implement FVA (Flux Variability Analysis)

**Files:**
- Create: `src/server/fbaFVA.ts`
- Modify: `src/server/fbaEngine.ts` (add FVA export)

- [ ] **Step 1: Create FVA implementation**

Create `src/server/fbaFVA.ts`:

```typescript
/**
 * Flux Variability Analysis (FVA).
 *
 * For each reaction, find the min and max flux while maintaining
 * the optimal objective value.
 *
 * Reference: Mahadevan & Schilling (2003) Metab Eng 5:264
 */
import { solveLP, type LPModel, type LPSolution } from './highsSolver';

export interface FVAResult {
  reactionId: string;
  min: number;
  max: number;
}

export interface FVAOutput {
  results: FVAResult[];
  objectiveValue: number;
  solveTime: number;
}

/**
 * Run FVA on a model.
 *
 * @param baseModel - The base LP model (already solved for optimal objective)
 * @param objectiveValue - The optimal objective value from the base solve
 * @param reactionIds - Reaction IDs to analyze (defaults to all)
 * @param tolerance - Fraction of objective to allow (default 1e-6)
 */
export async function runFVA(
  baseModel: LPModel,
  objectiveValue: number,
  reactionIds?: string[],
  tolerance = 1e-6,
): Promise<FVAOutput> {
  const start = Date.now();

  // Identify reactions to analyze
  const varsToAnalyze = reactionIds
    || baseModel.objective.map(v => v.name);

  // Add objective constraint: obj >= (1 - tolerance) * optimal
  const objConstraint = {
    name: 'fva_obj_constraint',
    vars: baseModel.objective,
    lb: objectiveValue * (1 - tolerance),
    ub: Infinity,
  };

  const results: FVAResult[] = [];

  for (const varName of varsToAnalyze) {
    // Minimize this variable
    const minModel: LPModel = {
      ...baseModel,
      sense: 'minimize',
      objective: [{ name: varName, coef: 1 }],
      constraints: [...baseModel.constraints, objConstraint],
    };

    // Maximize this variable
    const maxModel: LPModel = {
      ...baseModel,
      sense: 'maximize',
      objective: [{ name: varName, coef: 1 }],
      constraints: [...baseModel.constraints, objConstraint],
    };

    const [minResult, maxResult] = await Promise.all([
      solveLP(minModel),
      solveLP(maxModel),
    ]);

    results.push({
      reactionId: varName,
      min: minResult.status === 'optimal' ? minResult.objectiveValue : 0,
      max: maxResult.status === 'optimal' ? maxResult.objectiveValue : 0,
    });
  }

  return {
    results,
    objectiveValue,
    solveTime: Date.now() - start,
  };
}
```

- [ ] **Step 2: Add FVA endpoint to API route**

In `app/api/fba/route.ts`, add a new handler for FVA requests.

- [ ] **Step 3: Write tests**

Create `__tests__/fbaFVA.test.ts` with a simple 3-reaction model and verify FVA produces correct ranges.

- [ ] **Step 4: Commit**

```bash
git add src/server/fbaFVA.ts app/api/fba/route.ts __tests__/fbaFVA.test.ts
git commit -m "feat: implement Flux Variability Analysis (FVA)"
```

---

## Task 5: Implement pFBA (parsimonious FBA)

**Files:**
- Create: `src/server/fbaPFBA.ts`

- [ ] **Step 1: Create pFBA implementation**

Create `src/server/fbaPFBA.ts`:

```typescript
/**
 * Parsimonious Flux Balance Analysis (pFBA).
 *
 * After finding the optimal objective value, minimize the total
 * flux (sum of absolute fluxes) to find the most efficient
 * flux distribution.
 *
 * Reference: Lewis et al. (2010) Mol Syst Biol 6:390
 */
import { solveLP, type LPModel, type LPSolution } from './highsSolver';

export interface pFBAOutput {
  fluxes: Record<string, number>;
  totalFlux: number;
  objectiveValue: number;
  solveTime: number;
}

/**
 * Run pFBA on a model.
 *
 * Step 1: Solve for optimal objective
 * Step 2: Fix objective at optimum, minimize sum of absolute fluxes
 *
 * For minimization of |vᵢ|, we split each variable into vᵢ⁺ and vᵢ⁻
 * where vᵢ = vᵢ⁺ - vᵢ⁻, vᵢ⁺ >= 0, vᵢ⁻ >= 0, and minimize Σ(vᵢ⁺ + vᵢ⁻).
 */
export async function runPFBA(baseModel: LPModel): Promise<pFBAOutput> {
  const start = Date.now();

  // Step 1: Solve for optimal objective
  const optResult = await solveLP(baseModel);
  if (optResult.status !== 'optimal') {
    return {
      fluxes: {},
      totalFlux: 0,
      objectiveValue: 0,
      solveTime: Date.now() - start,
    };
  }

  const objectiveValue = optResult.objectiveValue;

  // Step 2: Build pFBA model
  // Split each variable into positive and negative parts
  const pfbaModel: LPModel = {
    name: 'pfba',
    sense: 'minimize',
    objective: [],
    constraints: [],
    bounds: [],
  };

  // For each original variable vᵢ, create vᵢ_pos and vᵢ_neg
  const originalVars = new Set<string>();
  for (const c of baseModel.constraints) {
    for (const v of c.vars) {
      originalVars.add(v.name);
    }
  }

  // Objective: minimize Σ(vᵢ_pos + vᵢ_neg)
  for (const varName of originalVars) {
    pfbaModel.objective.push({ name: `${varName}_pos`, coef: 1 });
    pfbaModel.objective.push({ name: `${varName}_neg`, coef: 1 });

    // Bounds: vᵢ_pos >= 0, vᵢ_neg >= 0
    pfbaModel.bounds!.push({ name: `${varName}_pos`, lb: 0, ub: Infinity });
    pfbaModel.bounds!.push({ name: `${varName}_neg`, lb: 0, ub: Infinity });
  }

  // Constraint: vᵢ = vᵢ_pos - vᵢ_neg for each variable
  for (const varName of originalVars) {
    pfbaModel.constraints.push({
      name: `split_${varName}`,
      vars: [
        { name: varName, coef: 1 },
        { name: `${varName}_pos`, coef: -1 },
        { name: `${varName}_neg`, coef: 1 },
      ],
      lb: 0,
      ub: 0,
    });
  }

  // Copy original constraints (using original variable names)
  for (const c of baseModel.constraints) {
    pfbaModel.constraints.push(c);
  }

  // Fix objective at optimum
  pfbaModel.constraints.push({
    name: 'fix_objective',
    vars: baseModel.objective,
    lb: objectiveValue * (1 - 1e-6),
    ub: Infinity,
  });

  // Step 3: Solve pFBA
  const pfbaResult = await solveLP(pfbaModel);

  // Extract original fluxes: vᵢ = vᵢ_pos - vᵢ_neg
  const fluxes: Record<string, number> = {};
  let totalFlux = 0;

  for (const varName of originalVars) {
    const pos = pfbaResult.primals[`${varName}_pos`] || 0;
    const neg = pfbaResult.primals[`${varName}_neg`] || 0;
    fluxes[varName] = pos - neg;
    totalFlux += pos + neg;
  }

  return {
    fluxes,
    totalFlux,
    objectiveValue,
    solveTime: Date.now() - start,
  };
}
```

- [ ] **Step 2: Write tests and commit**

---

## Task 6: Implement GPR rules and gene knockout

**Files:**
- Create: `src/server/fbaGPR.ts`
- Modify: `src/data/iJO1366Subset.ts` (add gpr field)

- [ ] **Step 1: Add GPR rules to iJO1366 data**

Add a `gpr` field to each reaction in `iJO1366Subset.ts`:
```typescript
gpr: '((b0001 AND b0002) OR b0003)',  // boolean expression string
```

- [ ] **Step 2: Create GPR parser and knockout engine**

Create `src/server/fbaGPR.ts`:
- Parse GPR boolean expressions
- Evaluate with gene knockout set
- Return which reactions are knocked out

- [ ] **Step 3: Integrate with FBA engine**

When knockouts are provided, evaluate GPR rules and set reaction bounds to 0.

- [ ] **Step 4: Write tests and commit**

---

## Task 7: Update API route with new endpoints

**Files:**
- Modify: `app/api/fba/route.ts`

- [ ] **Step 1: Add FVA endpoint**

```typescript
// POST /api/fba with { action: 'fva', ... }
```

- [ ] **Step 2: Add pFBA endpoint**

```typescript
// POST /api/fba with { action: 'pfba', ... }
```

- [ ] **Step 3: Add GPR knockout endpoint**

```typescript
// POST /api/fba with { action: 'knockout', genes: ['b0001'], ... }
```

- [ ] **Step 4: Commit**

---

## Task 8: Update UI with FVA/pFBA/GPR panels

**Files:**
- Modify: `src/components/tools/FBASimPage.tsx`
- Create: `src/components/tools/fba/FVAPanel.tsx`
- Create: `src/components/tools/fba/GPRPanel.tsx`

- [ ] **Step 1: Create FVA panel**

Bar chart showing flux ranges for each reaction.

- [ ] **Step 2: Create GPR panel**

Gene list with checkboxes for knockout, showing affected reactions.

- [ ] **Step 3: Integrate into FBASimPage**

Add tabs for FVA, pFBA, and GPR alongside existing FBA results.

- [ ] **Step 4: Commit**

---

## Task 9: Final integration check

- [ ] **Step 1: Run full test suite**
- [ ] **Step 2: Run type check**
- [ ] **Step 3: Run build**
- [ ] **Step 4: Commit**

---

## Success Criteria

- [ ] highs solves existing E. coli and yeast networks correctly
- [ ] FVA produces flux ranges for all reactions
- [ ] pFBA produces unique flux distribution
- [ ] Gene knockout predictions work
- [ ] Shadow prices extracted directly from duals
- [ ] All existing tests pass
- [ ] FVA for 200 reactions completes in <10 seconds
