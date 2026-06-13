# Direction M: Workflow & Process Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Bayesian optimization to DBTLflow, create codon optimization tool, and create RBS/启动子强度 calculator — filling the remaining process gaps.

**Architecture:** Bayesian optimization via GP surrogate (reuses Direction I's GP implementation). Codon optimization via codon usage table lookup. RBS calculator via thermodynamic model of ribosome binding.

**Tech Stack:** TypeScript, Gaussian Process (from Direction I), codon usage tables

---

## Task M1: Integrate Bayesian Optimization into DBTLflow

**Files:**
- Modify: `src/utils/feedback-loop.ts`
- Modify: `src/components/tools/DBTLflowPage.tsx`

### Step 1: Write failing test

```typescript
import { runBayesianOptimization, type BOConfig, type BOResult } from '../../src/utils/feedback-loop';

describe('Bayesian optimization for DBTL', () => {
  it('suggests next experiment parameters that improve yield', () => {
    const history = [
      { params: { temperature: 30, promoter: 0.5, rbs: 0.7 }, yield: 2.1 },
      { params: { temperature: 37, promoter: 0.8, rbs: 0.9 }, yield: 3.5 },
      { params: { temperature: 33, promoter: 0.6, rbs: 0.8 }, yield: 2.8 },
    ];
    const config: BOConfig = {
      paramRanges: {
        temperature: [25, 42],
        promoter: [0.1, 1.0],
        rbs: [0.1, 1.0],
      },
      nSuggestions: 3,
    };
    const result = runBayesianOptimization(history, config);
    expect(result.suggestions.length).toBe(3);
    expect(result.suggestions[0].params.temperature).toBeGreaterThanOrEqual(25);
    expect(result.suggestions[0].params.temperature).toBeLessThanOrEqual(42);
    expect(result.suggestions[0].expectedImprovement).toBeGreaterThan(0);
  });
});
```

### Step 2-5: TDD implementation

Replace the current heuristic gap-analysis with GP-based Bayesian optimization:
1. Fit GP to (params → yield) data
2. Compute Expected Improvement acquisition function
3. Suggest top-N experiments that maximize EI
4. Fall back to heuristic suggestions when too few data points (<5)

---

## Task M2: Create Codon Optimization Tool

**Files:**
- Create: `src/server/codonOptimizer.ts`
- Create: `src/data/codonUsageTables.json`
- Test: `__tests__/workflow/codonOptimizer.test.ts`

### Step 1: Write failing test

```typescript
import { optimizeCodons, type CodonOptimizationConfig } from '../../src/server/codonOptimizer';

describe('codon optimization', () => {
  it('optimizes codons for E. coli', () => {
    const aminoAcidSequence = 'MKTAYIAKQRQISFVKSHFSRQLE';
    const result = optimizeCodons(aminoAcidSequence, { organism: 'ecoli' });
    expect(result.dnaSequence.length).toBe(aminoAcidSequence.length * 3);
    expect(result.cai).toBeGreaterThan(0.5); // Good codon adaptation index
    expect(result.gcContent).toBeGreaterThan(0.4);
    expect(result.gcContent).toBeLessThan(0.6);
  });

  it('optimizes codons for S. cerevisiae', () => {
    const result = optimizeCodons('MKTAYIAKQR', { organism: 'scerevisiae' });
    expect(result.cai).toBeGreaterThan(0.5);
  });

  it('avoids restriction sites', () => {
    const result = optimizeCodons('MKTAYIAKQR', {
      organism: 'ecoli',
      avoidSites: ['GAATTC', 'GGATCC'], // EcoRI, BamHI
    });
    expect(result.dnaSequence.includes('GAATTC')).toBe(false);
    expect(result.dnaSequence.includes('GGATCC')).toBe(false);
  });
});
```

### Step 2-5: TDD implementation

Codon optimization:
- Codon usage tables for E. coli, S. cerevisiae, etc. from Kazusa
- CAI (Codon Adaptation Index) calculation
- GC content optimization
- Restriction site avoidance
- mRNA secondary structure avoidance (optional)

---

## Task M3: Create RBS Strength Calculator

**Files:**
- Create: `src/server/rbsCalculator.ts`
- Test: `__tests__/workflow/rbsCalculator.test.ts`

### Step 1: Write failing test

```typescript
import { calculateRBSStrength, type RBSConfig } from '../../src/server/rbsCalculator';

describe('RBS calculator', () => {
  it('calculates RBS strength for standard RBS', () => {
    const result = calculateRBSStrength({
      rbsSequence: 'AAGAAGGAGATATACAT',
      cdsSequence: 'ATGAAATTT...',
      organism: 'ecoli',
    });
    expect(result.translationRate).toBeGreaterThan(0);
    expect(result.sdStrength).toBeDefined();
    expect(result.spacing).toBeDefined();
  });

  it('predicts weak RBS for poor Shine-Dalgarno match', () => {
    const weak = calculateRBSStrength({
      rbsSequence: 'AATTCGCGATATACAT', // no SD sequence
      cdsSequence: 'ATGAAATTT...',
      organism: 'ecoli',
    });
    const strong = calculateRBSStrength({
      rbsSequence: 'AAGAAGGAGATATACAT', // strong SD
      cdsSequence: 'ATGAAATTT...',
      organism: 'ecoli',
    });
    expect(weak.translationRate).toBeLessThan(strong.translationRate);
  });
});
```

### Step 2-5: TDD implementation

RBS Calculator (Salis et al. 2009):
- Thermodynamic model of ribosome-mRNA binding
- ΔG_total = ΔG_mRNA_rRNA + ΔG_spacing + ΔG_start_codon
- Translation rate ∝ exp(-ΔG_total / RT)
- Shine-Dalgarno sequence matching

---

## Task M4: Add Codon Optimizer UI

**Files:** Create: `src/components/tools/shared/CodonOptimizerPanel.tsx`

### Step 1: Reusable panel component for codon optimization. Used by CATDES and PROEvol.

### Step 2: Commit

---

## Task M5: Add RBS Calculator UI

**Files:** Create: `src/components/tools/shared/RBSCalculatorPanel.tsx`

### Step 1: Reusable panel component for RBS strength calculation.

### Step 2: Commit

---

## Summary

| Task | What It Builds | Priority |
|------|---------------|----------|
| M1 | Bayesian optimization for DBTLflow | 🟡 IMPORTANT |
| M2 | Codon optimization tool | 🟡 IMPORTANT |
| M3 | RBS strength calculator | 🟡 IMPORTANT |
| M4 | Codon optimizer UI | 🟢 NICE-TO-HAVE |
| M5 | RBS calculator UI | 🟢 NICE-TO-HAVE |

**Total: 5 tasks, ~15 commits**
