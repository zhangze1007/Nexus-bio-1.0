# Direction J: Stochastic Gene Circuit Simulation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Gillespie SSA (Stochastic Simulation Algorithm) to GECAIR — enabling stochastic gene circuit simulation that captures noise-induced phenomena (bistability, stochastic resonance) that deterministic ODE cannot.

**Architecture:** Pure TypeScript Gillespie SSA implementation with seeded PRNG for reproducibility. Operates on molecule counts (integer state) with propensity functions derived from Hill kinetics. Multiple ensemble runs characterize noise statistics.

**Tech Stack:** TypeScript, seeded PRNG (xorshift128+)

---

## Task J1: Implement Gillespie SSA Core

**Files:**
- Create: `src/server/gillespieSSA.ts`
- Test: `__tests__/gecair/gillespieSSA.test.ts`

### Step 1: Write failing test

```typescript
import { runGillespie, type StochasticModel, type GillespieResult } from '../../src/server/gillespieSSA';

describe('Gillespie SSA', () => {
  it('simulates birth-death process with correct steady-state mean', () => {
    const model: StochasticModel = {
      species: [{ id: 'mRNA', initialCount: 0 }],
      reactions: [
        { id: 'transcription', reactants: {}, products: { mRNA: 1 }, rate: 10 },
        { id: 'degradation', reactants: { mRNA: 1 }, products: {}, rate: 0.1 },
      ],
    };
    const result = runGillespie(model, { maxTime: 1000, seed: 42 });

    // Steady state mean = production/degradation = 10/0.1 = 100
    const mean = result.trajectories.mRNA.reduce((a, b) => a + b, 0) / result.trajectories.mRNA.length;
    expect(mean).toBeGreaterThan(50);
    expect(mean).toBeLessThan(150);

    // Fano factor (variance/mean) should be ~1 for Poisson process
    const variance = result.trajectories.mRNA.reduce((a, b) => a + (b - mean) ** 2, 0) / result.trajectories.mRNA.length;
    const fanoFactor = variance / mean;
    expect(fanoFactor).toBeGreaterThan(0.5);
    expect(fanoFactor).toBeLessThan(1.5);
  });

  it('reproduces toggle switch bistability', () => {
    // Toggle switch: two mutually repressing genes
    // Should show bistability — one gene ON, other OFF
    const model: StochasticModel = {
      species: [
        { id: 'proteinA', initialCount: 100 },
        { id: 'proteinB', initialCount: 100 },
      ],
      reactions: [
        { id: 'transcribeA', reactants: {}, products: { proteinA: 1 }, rate: 100 },
        { id: 'transcribeB', reactants: {}, products: { proteinB: 1 }, rate: 100 },
        { id: 'degradeA', reactants: { proteinA: 1 }, products: {}, rate: 1 },
        { id: 'degradeB', reactants: { proteinB: 1 }, products: {}, rate: 1 },
        // Repression: high B → low A transcription (simplified)
      ],
    };
    const result = runGillespie(model, { maxTime: 10000, seed: 42 });

    // Check that final state is bimodal (one high, one low)
    const finalA = result.trajectories.proteinA[result.trajectories.proteinA.length - 1];
    const finalB = result.trajectories.proteinB[result.trajectories.proteinB.length - 1];
    // One should be significantly higher than the other
    const ratio = Math.max(finalA, finalB) / Math.max(1, Math.min(finalA, finalB));
    expect(ratio).toBeGreaterThan(2);
  });

  it('is deterministic with same seed', () => {
    const model: StochasticModel = {
      species: [{ id: 'x', initialCount: 10 }],
      reactions: [
        { id: 'birth', reactants: {}, products: { x: 1 }, rate: 1 },
        { id: 'death', reactants: { x: 1 }, products: {}, rate: 0.1 },
      ],
    };
    const r1 = runGillespie(model, { maxTime: 100, seed: 12345 });
    const r2 = runGillespie(model, { maxTime: 100, seed: 12345 });
    expect(r1.trajectories.x).toEqual(r2.trajectories.x);
  });
});
```

### Step 2: Run test to verify it fails

Run: `npx jest __tests__/gecair/gillespieSSA.test.ts --verbose`
Expected: FAIL — module not found

### Step 3: Implement Gillespie SSA

```typescript
// src/server/gillespieSSA.ts
/**
 * Gillespie Stochastic Simulation Algorithm (SSA)
 *
 * Gillespie (1977) J Phys Chem 81(25):2340-2361
 *
 * Exact stochastic simulation of chemical reaction networks.
 * Each reaction has a propensity (rate * product of reactant counts).
 * At each step: draw time to next reaction from exponential distribution,
 * draw which reaction occurs proportional to propensities.
 */

export interface StochasticSpecies {
  id: string;
  initialCount: number;
}

export interface StochasticReaction {
  id: string;
  reactants: Record<string, number>; // species_id → stoichiometric coefficient
  products: Record<string, number>;
  rate: number; // stochastic rate constant
}

export interface StochasticModel {
  species: StochasticSpecies[];
  reactions: StochasticReaction[];
}

export interface GillespieResult {
  trajectories: Record<string, number[]>;
  times: number[];
  reactionEvents: Record<string, number>;
  finalState: Record<string, number>;
}

export interface GillespieOptions {
  maxTime: number;
  seed?: number;
  maxSteps?: number;
}

// Seeded PRNG (xorshift128+)
function createRNG(seed: number) {
  let s0 = seed;
  let s1 = seed ^ 0xdeadbeef;
  return () => {
    s1 ^= s0;
    s0 = ((s0 << 11) | (s0 >>> 21)) ^ s1 ^ (s1 >>> 19);
    s1 = (s1 << 7) | (s1 >>> 25);
    return (s0 + s1) >>> 0;
  };
}

export function runGillespie(
  model: StochasticModel,
  options: GillespieOptions,
): GillespieResult {
  const { maxTime, seed = 42, maxSteps = 1000000 } = options;
  const rng = createRNG(seed);

  // Initialize state
  const state: Record<string, number> = {};
  for (const sp of model.species) {
    state[sp.id] = sp.initialCount;
  }

  // Initialize trajectories
  const trajectories: Record<string, number[]> = {};
  const times: number[] = [0];
  for (const sp of model.species) {
    trajectories[sp.id] = [sp.initialCount];
  }
  const reactionEvents: Record<string, number> = {};
  for (const rxn of model.reactions) {
    reactionEvents[rxn.id] = 0;
  }

  let t = 0;
  let steps = 0;

  while (t < maxTime && steps < maxSteps) {
    // Compute propensities
    const propensities: number[] = [];
    let totalPropensity = 0;

    for (const rxn of model.reactions) {
      let propensity = rxn.rate;
      for (const [species, coeff] of Object.entries(rxn.reactants)) {
        // For bimolecular reactions: propensity = rate * n * (n-1) / 2
        // For simplicity, use: propensity = rate * product(n_i for each reactant)
        const count = state[species] ?? 0;
        for (let i = 0; i < coeff; i++) {
          propensity *= (count - i);
        }
      }
      propensities.push(propensity);
      totalPropensity += propensity;
    }

    if (totalPropensity === 0) break; // No reactions possible

    // Draw time to next reaction: tau ~ Exp(totalPropensity)
    const r1 = rng() / 0xffffffff;
    const tau = -Math.log(Math.max(r1, 1e-30)) / totalPropensity;
    t += tau;

    // Draw which reaction occurs
    const r2 = (rng() / 0xffffffff) * totalPropensity;
    let cumulative = 0;
    let selectedReaction = 0;
    for (let i = 0; i < propensities.length; i++) {
      cumulative += propensities[i];
      if (cumulative >= r2) {
        selectedReaction = i;
        break;
      }
    }

    // Update state
    const rxn = model.reactions[selectedReaction];
    for (const [species, coeff] of Object.entries(rxn.reactants)) {
      state[species] = (state[species] ?? 0) - coeff;
    }
    for (const [species, coeff] of Object.entries(rxn.products)) {
      state[species] = (state[species] ?? 0) + coeff;
    }
    reactionEvents[rxn.id]++;

    // Record trajectory
    times.push(t);
    for (const sp of model.species) {
      trajectories[sp.id].push(state[sp.id] ?? 0);
    }

    steps++;
  }

  return { trajectories, times, reactionEvents, finalState: { ...state } };
}
```

### Step 4: Run test to verify it passes

Run: `npx jest __tests__/gecair/gillespieSSA.test.ts --verbose`
Expected: PASS

### Step 5: Commit

```bash
git add src/server/gillespieSSA.ts __tests__/gecair/gillespieSSA.test.ts
git commit -m "feat(gecair): implement Gillespie SSA stochastic simulation"
```

---

## Task J2: Add Hill-Function Propensity Model

Extend Gillespie SSA to use Hill-function propensities for gene circuit reactions.

**Files:**
- Modify: `src/server/gillespieSSA.ts`
- Test: `__tests__/gecair/gillespieSSA.test.ts` (add Hill tests)

### Step 1: Write failing test for Hill repression

```typescript
it('Hill repression reduces transcription propensity', () => {
  const model: StochasticModel = {
    species: [
      { id: 'repressor', initialCount: 100 },
      { id: 'mRNA', initialCount: 0 },
    ],
    reactions: [
      {
        id: 'transcription',
        reactants: {},
        products: { mRNA: 1 },
        rate: 10, // basal rate
        hillRepression: { species: 'repressor', K: 50, n: 2 },
      },
      { id: 'degradation', reactants: { mRNA: 1 }, products: {}, rate: 0.1 },
    ],
  };
  const result = runGillespie(model, { maxTime: 1000, seed: 42 });
  // With repressor at 100 and K=50, n=2: propensity = 10 * 50^2 / (50^2 + 100^2) = 10 * 2500/12500 = 2
  const mean = result.trajectories.mRNA.reduce((a, b) => a + b, 0) / result.trajectories.mRNA.length;
  expect(mean).toBeLessThan(30); // Should be much less than unregulated (100)
});
```

### Step 2-5: TDD implementation

Add optional `hillRepression` and `hillActivation` fields to `StochasticReaction`. In propensity computation, multiply basal rate by Hill function: `K^n / (K^n + x^n)` for repression, `x^n / (K^n + x^n)` for activation.

---

## Task J3: Add Stochastic Mode to GECAIR UI

**Files:**
- Modify: `src/components/tools/GECAIRPage.tsx`

### Step 1: Add "Stochastic" toggle

When enabled, switch from ODE to Gillespie. Show stochastic trajectories with noise bands (mean ± std from ensemble runs). Show Fano factor and coefficient of variation.

### Step 2: Commit

---

## Summary

| Task | What It Builds | Priority |
|------|---------------|----------|
| J1 | Gillespie SSA core | 🔴 CRITICAL |
| J2 | Hill-function propensities | 🔴 CRITICAL |
| J3 | Stochastic mode in GECAIR UI | 🔴 CRITICAL |

**Total: 3 tasks, ~10 commits**
