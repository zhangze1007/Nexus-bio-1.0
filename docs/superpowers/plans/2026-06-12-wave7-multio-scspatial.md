# Wave 7: MultiO (Phase 4) + ScSpatial (Phase 5) — Research-Grade Upgrade

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade MultiO and ScSpatial from demo to research-grade by computing real PCA, renaming misleading types, and implementing proper marker-gene annotation.

---

## MultiO Phase 4

### Task 1: Compute Real PCA Loadings (§4.1)

**Files:**
- Modify: `src/components/tools/MultiOPage.tsx` (PCA biplot)
- Modify: `src/services/MOIEngine.ts` (expose pcaProject for biplot use)

- [ ] **Step 1: Wire pcaProject into the biplot**

The real PCA exists in `MOIEngine.ts:pcaProject()`. Currently the biplot uses decorative arrows. Wire the actual eigenvectors into the biplot rendering:

In `MultiOPage.tsx`, find the PCA biplot section (around lines 260-311). Replace the decorative arrow computation with real loading vectors from `pcaProject`:

```typescript
// Call pcaProject on the [zT, zP, zM] data matrix
const pcaResult = pcaProject(dataMatrix); // returns { eigenvalues, eigenvectors, projected }

// Loading arrows from eigenvectors scaled by sqrt(eigenvalue)
const loadings = pcaResult.eigenvectors.map((v, i) => ({
  gene: geneNames[i],
  pc1: v[0] * Math.sqrt(pcaResult.eigenvalues[0]),
  pc2: v[1] * Math.sqrt(pcaResult.eigenvalues[1]),
}));
```

- [ ] **Step 2: Replace hardcoded variance labels**

Replace `"PC1 (38.2% var)"` and `"PC2 (21.6% var)"` with computed values:

```typescript
const totalVar = pcaResult.eigenvalues.reduce((a, b) => a + b, 0);
const pc1Pct = ((pcaResult.eigenvalues[0] / totalVar) * 100).toFixed(1);
const pc2Pct = ((pcaResult.eigenvalues[1] / totalVar) * 100).toFixed(1);
// Use: `PC1 (${pc1Pct}% var)` and `PC2 (${pc2Pct}% var)`
```

- [ ] **Step 3: Run tests and commit**

```bash
npx jest __tests__/multioHonesty.test.ts --verbose
git commit -m "fix(multio): compute real PCA loadings from eigenvectors, replace decorative arrows and hardcoded variance"
```

---

### Task 2: Rename "Attention Heads" (§4.2)

**Files:**
- Modify: `src/types.ts` (AttentionHead → LayerSignalScore)
- Modify: `src/services/OmicsIntegrator.ts` (rename function)
- Modify: `src/components/tools/MultiOPage.tsx` (update references)

- [ ] **Step 1: Rename type in types.ts**

```typescript
// OLD:
export interface AttentionHead {
  name: string;
  layer: OmicsLayer;
  weight: number; // 0–1 attention weight
  signal_strength: number;
  bottleneck_contribution: number;
}

// NEW:
export interface LayerSignalScore {
  name: string;
  layer: OmicsLayer;
  weight: number; // 0–1 signal ratio (variance/discordance/significance)
  signal_strength: number;
  bottleneck_contribution: number;
}
```

- [ ] **Step 2: Rename function in OmicsIntegrator.ts**

`computeAttentionWeights` → `computeLayerSignals`

- [ ] **Step 3: Update all references in MultiOPage.tsx**

Replace `attention_heads` with `layer_signals` and `AttentionHead` with `LayerSignalScore`.

- [ ] **Step 4: Update UI labels**

Ensure UI says "Layer Signal Scores" not "Attention Heads".

- [ ] **Step 5: Run tests and commit**

```bash
npx jest __tests__/multioHonesty.test.ts --verbose
git commit -m "fix(multio): rename AttentionHead → LayerSignalScore, computeAttentionWeights → computeLayerSignals"
```

---

### Task 3: Fix EmbeddingPoint Type Comment (§4.3)

**Files:**
- Modify: `src/types.ts:386`

- [ ] **Step 1: Fix comment**

```typescript
// OLD: coords: [number, number, number]; // UMAP 3D
// NEW: coords: [number, number, number]; // 3D projection coordinates (method varies by engine)
```

- [ ] **Step 2: Commit**

```bash
git commit -m "fix(multio): fix EmbeddingPoint comment — not UMAP, force-directed projection"
```

---

## ScSpatial Phase 5

### Task 4: Marker-Gene Cell-Type Annotation (§5.1)

**Files:**
- Modify: `src/services/ScSpatialEngine.ts` (add Wilcoxon + marker gene sets)

- [ ] **Step 1: Import Wilcoxon from utils/statistics.ts**

The Wilcoxon rank-sum test already exists at `src/utils/statistics.ts:126`. Import it into ScSpatialEngine.ts.

- [ ] **Step 2: Define marker gene sets**

```typescript
const MARKER_GENE_SETS: Record<string, { markers: string[]; high: boolean }> = {
  'Progenitor': { markers: ['SOX2', 'NES', 'VIM', 'NOTCH1'], high: true },
  'Metabolically Active': { markers: ['ATP5F1', 'COX4I1', 'SDHB', 'IDH1'], high: true },
  'Stressed': { markers: ['HSPA5', 'DDIT3', 'ATF4', 'XBP1'], high: true },
  'Quiescent': { markers: ['MKI67', 'PCNA', 'TOP2A'], high: false }, // low = quiescent
};
```

- [ ] **Step 3: Implement marker-gene scoring per cluster**

For each cluster, compute enrichment score per marker gene set using Wilcoxon rank-sum test (cluster cells vs rest). Assign label based on highest enrichment.

- [ ] **Step 4: Replace modulo labeling**

In `clusterCells()` (line 677-687), replace the modulo cycling with marker-gene-based labeling.

- [ ] **Step 5: Run tests and commit**

```bash
npx jest __tests__/ScSpatialEngine.test.ts --verbose
git commit -m "fix(scspatial): implement marker-gene cell-type annotation with Wilcoxon rank-sum"
```

---

### Task 5: LOESS for HVG Selection (§5.2)

**Files:**
- Modify: `src/services/ScSpatialEngine.ts` (replace sliding-window with LOESS)

- [ ] **Step 1: Implement tricube-weighted LOESS**

Replace the sliding-window average in `selectHVGs()` with proper LOESS:

```typescript
function loessPredict(x: number[], y: number[], xQuery: number, span: number): number {
  const n = x.length;
  const halfWidth = Math.ceil(span * n);
  const distances = x.map((xi, i) => ({ i, dist: Math.abs(xi - xQuery) }));
  distances.sort((a, b) => a.dist - b.dist);
  const maxDist = distances[halfWidth - 1].dist || 1;

  let sumW = 0, sumWX = 0, sumWY = 0, sumWXX = 0, sumWXY = 0;
  for (let k = 0; k < halfWidth; k++) {
    const { i, dist } = distances[k];
    const u = dist / maxDist;
    const w = Math.pow(1 - Math.pow(u, 3), 3); // tricube kernel
    sumW += w;
    sumWX += w * x[i];
    sumWY += w * y[i];
    sumWXX += w * x[i] * x[i];
    sumWXY += w * x[i] * y[i];
  }

  const denom = sumW * sumWXX - sumWX * sumWX;
  if (Math.abs(denom) < 1e-10) return sumWY / sumW;
  const slope = (sumW * sumWXY - sumWX * sumWY) / denom;
  const intercept = (sumWY - slope * sumWX) / sumW;
  return intercept + slope * xQuery;
}
```

- [ ] **Step 2: Replace sliding-window in selectHVGs**

Replace the arithmetic mean of window with `loessPredict()` calls.

- [ ] **Step 3: Run tests and commit**

```bash
npx jest __tests__/ScSpatialEngine.test.ts --verbose
git commit -m "fix(scspatial): implement tricube-weighted LOESS for HVG selection"
```

---

### Task 6: Expression-Based Fate Classification (§5.3)

**Files:**
- Modify: `src/services/ScSpatialEngine.ts` (fate classification)

- [ ] **Step 1: Define metabolic marker genes**

```typescript
const METABOLIC_MARKERS: Record<string, string[]> = {
  artemisinin: ['ADS', 'CYP71AV1', 'CPR1', 'DBR2'],
  general: ['ACTB'], // housekeeping
  stress: ['HSPA5'], // stress
};
```

- [ ] **Step 2: Score each cluster**

For each cluster, compute mean expression of marker genes. Classify:
- score > 0.7 → "productive"
- score < 0.3 → "stressed"
- else → "quiescent"

- [ ] **Step 3: Replace modulo fate assignment in computePAGA**

Replace the round-robin `fates[idx % fates.length]` with expression-based scoring.

- [ ] **Step 4: Run tests and commit**

```bash
npx jest __tests__/ScSpatialEngine.test.ts --verbose
git commit -m "fix(scspatial): implement expression-based fate classification with metabolic markers"
```
