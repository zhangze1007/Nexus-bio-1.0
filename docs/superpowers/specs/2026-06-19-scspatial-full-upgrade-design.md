# ScSpatial Full Upgrade — UMAP + VAE + CellChat

**Date:** 2026-06-19
**Scope:** 3 major upgrades to Single-Cell Spatial Transcriptomics tool
**Goal:** Replace all simplified/mock algorithms with production-grade implementations

---

## Current State

| Feature | Current | Target |
|---------|---------|--------|
| Dimensionality reduction | PCA linear projection | UMAP nonlinear embedding |
| Generative model | Linear encoder (NOT a VAE) | Pre-trained scVI ONNX model |
| Cell-cell communication | 52 L-R pairs, mean expression proxy | 2000+ pairs, probabilistic model + permutation test |

---

## Upgrade 1: UMAP Engine

**File:** `src/server/umapEngine.ts` (new)

### Algorithm

1. **k-NN graph construction**
   - Reuse existing `src/utils/knnIndex.ts` (KD-tree)
   - k = 15 (standard UMAP default)
   - Distance metric: Euclidean (cosine optional)

2. **Fuzzy simplicial set**
   - Local distance → Gaussian kernel → symmetrization
   - σ_i = distance to k-th neighbor
   - w_ij = exp(-d_ij / σ_i) for j in k-NN of i

3. **SGD embedding optimization**
   - Loss: cross-entropy between high-dimensional and low-dimensional fuzzy sets
   - Learning rate: 1.0
   - Epochs: 200
   - Negative sampling rate: 5
   - Repulsive force: negative samples from uniform distribution

4. **Output:** 2D coordinates [x, y] per cell

### Interface

```typescript
interface UMAPOptions {
  nNeighbors?: number;     // default 15
  minDist?: number;        // default 0.1
  nEpochs?: number;        // default 200
  learningRate?: number;   // default 1.0
  negativeSampleRate?: number; // default 5
  seed?: number;           // for reproducibility
}

interface UMAPResult {
  embedding: Array<{ x: number; y: number }>;
  nCells: number;
  nEpochs: number;
  convergenceLoss: number;
}

function runUMAP(
  data: number[][],  // [cells × features]
  options?: UMAPOptions,
): UMAPResult;
```

### Dependencies
- `src/utils/knnIndex.ts` — KD-tree (existing)
- `src/utils/seededRng.ts` — SeededRNG (existing)

---

## Upgrade 2: scVAE (Single-Cell VAE)

**Files:**
- `scripts/train_scVAE.py` (new) — Python training script
- `public/models/scVAE.onnx` (new) — Pre-trained model
- `src/server/scVAEEngine.ts` (new) — TypeScript inference wrapper

### Architecture

```
Encoder:  Input(2000) → Linear(512) → ReLU → Linear(256) → ReLU → μ(32), σ(32)
Sampling: z = μ + σ × ε,  ε ~ N(0,1)
Decoder:  z(32) → Linear(256) → ReLU → Linear(512) → ReLU → Linear(2000) → Sigmoid
Loss:     Reconstruction(BCE) + KL_divergence
```

### Training (one-time, Python)

```python
# scripts/train_scVAE.py
import torch
import scanpy as sc
import onnx

# 1. Load public dataset (PBMC 68k or Mouse Brain Atlas)
adata = sc.read_10x_h5('pbmc68k_filtered.h5')
sc.pp.filter_genes(adata, min_cells=10)
sc.pp.normalize_total(adata)
sc.pp.log1p(adata)
sc.pp.highly_variable_genes(adata, n_top_genes=2000)
adata = adata[:, adata.var.highly_variable]

# 2. Train VAE
model = scVAE(input_dim=2000, latent_dim=32)
train(model, adata.X, epochs=100, batch_size=128)

# 3. Export to ONNX
dummy = torch.randn(1, 2000)
torch.onnx.export(model.encoder, dummy, "scVAE_encoder.onnx", ...)
torch.onnx.export(model.decoder, torch.randn(1, 32), "scVAE_decoder.onnx", ...)
```

### Browser Inference

```typescript
// src/server/scVAEEngine.ts
import * as ort from 'onnxruntime-web';

export class SCVAEInference {
  private encoderSession: ort.InferenceSession | null = null;
  private decoderSession: ort.InferenceSession | null = null;

  async init(): Promise<void> {
    this.encoderSession = await ort.InferenceSession.create('/models/scVAE_encoder.onnx');
    this.decoderSession = await ort.InferenceSession.create('/models/scVAE_decoder.onnx');
  }

  async encode(data: Float32Array): Promise<{ mu: Float32Array; sigma: Float32Array; latent: Float32Array }>;
  async decode(latent: Float32Array): Promise<Float32Array>;
  async reconstruct(data: Float32Array): Promise<{ reconstructed: Float32Array; mse: number }>;
}
```

### Interface

```typescript
interface SCVAEResult {
  latent: number[][];         // [cells × latent_dim]
  reconstructed: number[][];  // [cells × genes]
  reconstructionError: number; // MSE
  elbo: number;                // Evidence lower bound
}
```

---

## Upgrade 3: CellChat Full Implementation

**File:** `src/server/cellChat.ts` (expand existing)

### Ligand-Receptor Database Expansion

Current: 52 pairs
Target: 2000+ pairs

Sources:
- CellChat DB (Jin et al. 2021, Nat Commun)
- KEGG signaling pathways
- Reactome pathway database

Structure:
```typescript
interface LigandReceptorPair {
  ligand: string;           // gene symbol
  receptor: string;         // gene symbol
  cofactors: string[];      // co-receptors/inhibitors
  pathway: string;          // signaling pathway name
  category: string;         // 'growth_factor', 'cytokine', 'ecm', etc.
  references: string[];     // PubMed IDs
}
```

### Communication Probability

```
P(L→R) = expression(L) × expression(R) × Hill(receptor_activity)

Hill(x) = x^n / (Kd^n + x^n)
n = 1.5 (Hill coefficient)
Kd = median expression across all cells
```

### Statistical Significance

```
1. Compute observed communication probability
2. Permutation test: shuffle cell labels 1000 times
3. p-value = (count where permuted > observed) / 1000
4. FDR correction: Benjamini-Hochberg
5. Significant if: p_adj < 0.05
```

### Interface

```typescript
interface CellChatResult {
  interactions: Array<{
    source: string;
    target: string;
    ligand: string;
    receptor: string;
    probability: number;
    pValue: number;
    pAdj: number;
    significant: boolean;
  }>;
  network: {
    nodes: Array<{ id: string; cellType: string; nCells: number }>;
    edges: Array<{ source: string; target: string; weight: number; significant: boolean }>;
  };
  pathwayEnrichment: Array<{
    pathway: string;
    interactions: string[];
    pValue: number;
  }>;
  stats: {
    totalInteractions: number;
    significantInteractions: number;
    nCellTypes: number;
    nPermutations: number;
  };
}
```

---

## File Summary

| File | Action | Lines (est.) |
|------|--------|-------------|
| `src/server/umapEngine.ts` | Create | ~300 |
| `scripts/train_scVAE.py` | Create | ~150 |
| `public/models/scVAE_encoder.onnx` | Create (binary) | — |
| `public/models/scVAE_decoder.onnx` | Create (binary) | — |
| `src/server/scVAEEngine.ts` | Create | ~150 |
| `src/server/cellChat.ts` | Expand | +400 |
| `src/components/tools/ScSpatialPage.tsx` | Modify | ~50 changes |
| `src/services/ScSpatialEngine.ts` | Modify | ~30 changes |

Total: ~1080 lines new/modified code

---

## Integration with Existing Architecture

```
ScSpatialPage.tsx
  │
  ├─ UMAP tab → umapEngine.ts (replaces PCA projection)
  ├─ Embedding tab → scVAEEngine.ts (replaces linear encoder)
  ├─ Communication tab → cellChat.ts (enhanced)
  └─ Other tabs unchanged (Hex Grid, Clusters, Gene Expression)
```

### Workbench Integration
- UMAP coordinates stored in tool payload
- VAE latent embedding stored in tool payload
- CellChat results stored in tool payload
- ProEvol can read CellChat results for pathway context

---

## Success Criteria

- `npx tsc --noEmit` passes
- `npm test` passes
- `npm run build` succeeds
- UMAP produces nonlinear embedding (visually distinct from PCA)
- scVAE encoder/decoder load and run in browser via ONNX Runtime
- CellChat computes communication probabilities for 2000+ L-R pairs
- Permutation test produces valid p-values
- All labels are honest (no "VAE" if model fails to load)
