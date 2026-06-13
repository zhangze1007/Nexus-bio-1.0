# Direction K: Multi-Omics & Single-Cell Analysis

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add real MOFA+ factor analysis (Bayesian group-factor model) to MULTIO and cell-cell communication (CellChat-style L-R analysis) to SCSPATIAL.

**Architecture:** MOFA+ implemented as variational Bayes with ARD priors on factor loadings. CellChat-style analysis uses curated L-R interaction database + Hill-function communication probability.

**Tech Stack:** TypeScript, variational inference, KNN graph algorithms

---

## Task K1: Implement MOFA+ Factor Analysis

**Files:**
- Create: `src/server/mofaPlus.ts`
- Test: `__tests__/multio/mofaPlus.test.ts`

### Step 1: Write failing test

```typescript
import { runMOFA, type MOFAModel, type MOFAConfig } from '../../src/server/mofaPlus';

describe('MOFA+', () => {
  it('learns shared latent factors from multi-omics data', () => {
    // Generate synthetic data: 2 views sharing 2 latent factors
    const n = 100, k = 2;
    const Z = Array.from({ length: n }, () => [Math.random(), Math.random()]);
    const W1 = [[1, 0], [0, 1]]; // view 1 loads on factor 1
    const W2 = [[0, 1], [1, 0]]; // view 2 loads on factor 2

    const view1 = Z.map(z => [z[0] * W1[0][0] + z[1] * W1[0][1], z[0] * W1[1][0] + z[1] * W1[1][1]]);
    const view2 = Z.map(z => [z[0] * W2[0][0] + z[1] * W2[0][1], z[0] * W2[1][0] + z[1] * W2[1][1]]);

    const result = runMOFA({ views: { transcriptomics: view1, proteomics: view2 }, nFactors: 2 });
    expect(result.factors.length).toBe(n);
    expect(result.factors[0].length).toBe(2);
    expect(result.varianceExplained).toBeDefined();
  });

  it('handles missing data', () => {
    const view1 = [[1, 2], [3, 4], [5, 6]];
    const view2 = [[7, 8], [null, null], [11, 12]]; // missing middle sample
    const result = runMOFA({ views: { v1: view1, v2: view2 }, nFactors: 1 });
    expect(result.factors.length).toBe(3);
  });

  it('identifies relevant factors via ARD sparsity', () => {
    // View 1 has signal, view 2 is noise
    const n = 200;
    const view1 = Array.from({ length: n }, () => [Math.random() * 10, Math.random() * 10]);
    const view2 = Array.from({ length: n }, () => [Math.random() * 0.1, Math.random() * 0.1]);

    const result = runMOFA({ views: { signal: view1, noise: view2 }, nFactors: 2 });
    // Variance explained should be much higher for view1
    expect(result.varianceExplained.signal[0]).toBeGreaterThan(result.varianceExplained.noise[0] * 2);
  });
});
```

### Step 2-5: TDD implementation

MOFA+ (Argelaguet et al. 2020):
- Model: Y_vm = Z * W_v^T + E_vm
- Inference: Variational Bayes with ELBO optimization
- Sparsity: ARD priors on W_v for automatic factor relevance
- Missing data: Masked likelihood

---

## Task K2: Implement Cell-Cell Communication Analysis

**Files:**
- Create: `src/server/cellChat.ts`
- Create: `src/data/ligandReceptorDB.json`
- Test: `__tests__/scspatial/cellChat.test.ts`

### Step 1: Write failing test

```typescript
import { analyzeCommunication, type CommunicationInput } from '../../src/server/cellChat';

describe('cell-cell communication', () => {
  it('identifies ligand-receptor interactions between clusters', () => {
    const input: CommunicationInput = {
      expressionMatrix: {
        'FGF1': { cluster1: 5.2, cluster2: 0.1, cluster3: 2.1 },
        'FGFR1': { cluster1: 0.3, cluster2: 4.8, cluster3: 1.5 },
        'WNT3A': { cluster1: 0.1, cluster2: 3.5, cluster3: 0.2 },
        'FZD5': { cluster1: 2.8, cluster2: 0.4, cluster3: 3.1 },
      },
      clusters: ['cluster1', 'cluster2', 'cluster3'],
    };
    const result = analyzeCommunication(input);

    // cluster1 → cluster2 should have strong FGF1-FGFR1 communication
    const fgfComm = result.interactions.find(i =>
      i.ligand === 'FGF1' && i.receptor === 'FGFR1' &&
      i.sender === 'cluster1' && i.receiver === 'cluster2'
    );
    expect(fgfComm).toBeDefined();
    expect(fgfComm!.probability).toBeGreaterThan(0.1);
  });

  it('computes network centrality for each cluster', () => {
    const input = { /* ... */ };
    const result = analyzeCommunication(input);
    expect(result.centrality.cluster1).toBeDefined();
    expect(result.centrality.cluster1.outgoingStrength).toBeGreaterThanOrEqual(0);
    expect(result.centrality.cluster1.incomingStrength).toBeGreaterThanOrEqual(0);
  });
});
```

### Step 2-5: TDD implementation

CellChat (Jin et al. 2021):
- L-R database: ~2000 curated pairs from CellTalkDB/CellPhoneDB
- Communication probability: P(L in sender) * P(R in receiver) * Hill(n_cells)
- Pathway aggregation: group L-R pairs into signaling pathways
- Network centrality: degree, betweenness, information centrality

---

## Task K3: Add MOFA+ Tab to MULTIO UI

**Files:** Modify: `src/components/tools/MultiOPage.tsx`

### Step 1: Add MOFA+ analysis panel with factor loadings, variance explained per view, and feature importance.

### Step 2: Commit

---

## Task K4: Add Communication Tab to SCSPATIAL UI

**Files:** Modify: `src/components/tools/ScSpatialPage.tsx`

### Step 1: Add cell-cell communication panel with L-R interaction table, communication network graph, and pathway-level aggregation.

### Step 2: Commit

---

## Summary

| Task | What It Builds | Priority |
|------|---------------|----------|
| K1 | MOFA+ factor analysis | 🔴 CRITICAL |
| K2 | Cell-cell communication | 🔴 CRITICAL |
| K3 | MOFA+ UI | 🟡 IMPORTANT |
| K4 | Communication UI | 🟡 IMPORTANT |

**Total: 4 tasks, ~15 commits**
