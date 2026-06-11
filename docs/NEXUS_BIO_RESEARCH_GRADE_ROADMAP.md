# Nexus-Bio Research-Grade Roadmap

**Date:** 2026-06-11
**Target Audience:** Synthetic biology researchers, experts, bloggers, enterprise consultants
**Goal:** All 14 tools reach research-grade standard

---

## Current Status Summary

| Tool | Current Tier | Target Tier | Gap |
|------|-------------|-------------|-----|
| FBA (FBASim) | research-grade | research-grade | ✅ Done |
| Thermodynamics (CETHX) | partial | research-grade | Alberty transforms done, need real group contribution for arbitrary metabolites |
| Kinetics (KineticPanel) | research-grade | research-grade | ✅ Done |
| Dynamic Control (DynCon) | partial | research-grade | kLa fixed, still need RBS monotonicity, cited constants |
| Cell-Free (CellFree) | partial | research-grade | AA/NTP pools fixed, still need IvIv training, parameter sourcing |
| Catalyst Designer (CatDes) | demo | research-grade | **Critical: mutagenesis is random, binding is heuristic** |
| Gene Minimization (GenMIM) | partial | research-grade | Positions fixed, still need off-target scoring, real CRISPRi data |
| Multi-Omics (MultiO) | demo | research-grade | Math.random fixed, still need real PCA loadings, marker genes |
| ScSpatial | partial | research-grade | Math correct, still need cell-type annotation, LOESS HVG |
| NEXAI | partial | research-grade | Strategy injection fixed, still need citation auto-verify |
| MetabolicEng | partial | research-grade | FBA fallback fixed, still need stress model, cited defaults |
| DBTLflow | locked | locked | External review — no changes |
| GECAIR | locked | locked | External review — no changes |
| ProEvol | locked | locked | External review — no changes |

---

## Phase 1: CatDes — From Demo to Research-Grade (Highest Priority)

CatDes is the most critical gap. It serves enzyme designers and protein engineers who need real predictions.

### 1.1 Remove Random Mutagenesis Predictions

**Current:** `Math.random()` generates ΔKcat and ΔKm fold changes within predefined ranges. Zero predictive power.

**Target:** Either integrate a real model or clearly label as "no prediction available."

**Implementation:**
- File: `src/services/catalystDesignerEngine.ts` lines 1215-1220
- Remove the `rng.next()` based ΔKcat/ΔKm generation
- Replace with `null` or `undefined` — show "No prediction available" in UI
- Alternatively: integrate ESM-2 API for real mutagenesis effect prediction
- Reference: Rives et al. (2021) PNAS — ESM-2 protein language model

**Verification:** Run mutagenesis 10 times on same position → all outputs identical (null).

### 1.2 Fix Binding Affinity Model

**Current:** LJ epsilon=0.15 kcal/mol (10x too low), SASA is heuristic (200 * distanceScore), no structural computation.

**Target:** Either use real scoring function or clearly document limitations.

**Implementation:**
- Option A: Integrate Rosetta API for real binding energy (requires server-side Python)
- Option B: Keep current model but:
  - Fix LJ epsilon to 0.5-1.5 kcal/mol range
  - Replace heuristic SASA with actual surface estimation
  - Add explicit uncertainty bounds (±2 kcal/mol)
  - Document as "approximate scoring, not validated against experimental Kd"
- File: `src/services/catalystDesignerEngine.ts` lines 486-627

**Verification:** Compare output to known Kd values for enzyme-substrate pairs with published binding data.

### 1.3 Fix Misleading Names

**Current:** "ProteinMPNN-style" (is BLOSUM62), "ESM-2-inspired" (is Shannon entropy), "AlphaFold 3-inspired" (is heuristic).

**Target:** Names describe what actually happens.

**Implementation:**
- Rename "ProteinMPNN-style sequence design" → "BLOSUM62-based sequence diversification"
- Rename "ESM-2-inspired mutagenesis" → "conservation-weighted mutagenesis targeting"
- Rename "AlphaFold 3-inspired binding" → "MM-PBSA-style binding estimation"
- Update all UI labels, tooltips, AlgorithmPanel text
- Files: `src/services/catalystDesignerEngine.ts`, `src/components/tools/CatalystDesignerPage.tsx`

### 1.4 Calibrate DDG Estimation

**Current:** `ddg = -0.3 * BLOSUM62_score` — not calibrated against any experimental dataset.

**Target:** Either calibrate or remove.

**Implementation:**
- Option A: Calibrate against ProTherm or SKEMPI dataset
  - Download SKEMPI 2.0 (Jankauskaitė et al. 2019)
  - Fit linear regression: ΔΔG = a * BLOSUM62 + b
  - Report R² and RMSE
- Option B: Remove numeric DDG, show qualitative labels only

---

## Phase 2: CellFree — From Partial to Research-Grade

### 2.1 Source All Kinetic Constants

**Current:** Constants are within literature ranges but not traced to specific papers.

**Target:** Every constant has a citation.

**Implementation:**
- Create `src/services/cellFreeParameterSources.ts`
- Map each constant to paper/table/row:
  - k_tx, d_mRNA, k_tl: Stogbauer et al. 2012 (Integr Biol, DOI 10.1039/c2ib00108k)
  - Energy regeneration: Jewett & Swartz 2004 (Biotech Bioeng)
  - Resource competition: Karzbrun et al. 2011 (Mol Syst Biol)
  - k_cat, K_M: BRENDA (specific enzyme IDs)
- Add inline citations in code comments

### 2.2 Fix IvIv MLP

**Current:** Random weights (SeededRNG 12345), not trained. Forward pass through untrained network.

**Target:** Either train on real data or relabel.

**Implementation:**
- Option A: Train on curated in-vitro/in-vivo pairs
  - Data sources: Sun et al. 2013 (ACS Synth Biol), Borkowski et al. 2016 (Nat Commun)
  - Train MLP on (promoter_strength, RBS_strength, gene_length) → in_vivo_expression
  - Report R² on held-out test set
- Option B: Relabel as "heuristic estimate with untrained architecture"
  - Remove numeric predictions from UI
  - Show qualitative guidance: "expression likely in range X-Y"

### 2.3 Fix Radar Chart Reproducibility

**Current:** `const repro = 0.7 + 0.3 * (1 - gi * 0.05)` — hardcoded formula, not derived from simulation.

**Target:** Derive from replicated simulation runs.

**Implementation:**
- Run simulation N=10 times with ±10% parameter perturbation
- Compute CV (coefficient of variation) of protein yield
- Use 1-CV as reproducibility score

### 2.4 Add User Data Input for Fitting

**Current:** Fitting only works on synthetic mock data.

**Target:** Accept real plate-reader data.

**Implementation:**
- Add CSV upload/paste to fitting tab
- Parse fluorescence time-series data
- Mark fitting as "demo" (mock) or "partial" (user data) in trust system

---

## Phase 3: DynCon — From Partial to Research-Grade

### 3.1 Fix RBS Mapping Monotonicity

**Current:** RBS_REGISTRY entries are non-monotonic (B0033 gain=0.3, strength=0.01; B0034 gain=0.4, strength=1.0).

**Target:** Physically intuitive slider-to-part mapping.

**Implementation:**
- Sort RBS_REGISTRY by ascending rbsStrength
- Use linear interpolation between entries
- Document the transfer function

### 3.2 Cite All Hardcoded Constants

**Current:** 6 constants without literature citations.

**Target:** Every constant has a citation or is marked as tunable.

**Implementation:**
- SPONTANEOUS_LOSS_RATE = 0.02 h⁻¹ → cite or mark as tunable
- PROTEIN_TURNOVER_RATE = 0.3 h⁻¹ → cite Bentley et al.
- O2_CONSUMPTION_COEFF = 1.5 → cite or mark as tunable
- proteinCost = 0.15 → cite Russell & Cook 1995
- atpDrain = 2.5 → cite or mark as tunable
- burdenPenalty = 0.4 → cite or mark as tunable
- Expose all as "Advanced" parameters in UI

### 3.3 Add Fed-Batch Volume Dynamics

**Current:** Volume hardcoded to 2.0 L despite having feedRate.

**Target:** Proper fed-batch model.

**Implementation:**
- Add state variable V with dV/dt = feedRate
- Update substrate equation for variable volume
- Or relabel as CSTR continuous culture

---

## Phase 4: MultiO — From Demo to Research-Grade

### 4.1 Compute Real PCA Loadings

**Current:** Biplot arrows at evenly spaced angles, not from actual loadings.

**Target:** Real PCA loading vectors.

**Implementation:**
- Compute PCA on 3-column data matrix [zT, zP, zM]
- Extract loading vectors for PC1/PC2
- Replace decorative arrows with real loadings
- Compute explained variance ratios from eigenvalues
- Replace hardcoded "38.2% var" with actual values

### 4.2 Rename "Attention Heads"

**Current:** `computeAttentionWeights` returns `AttentionHead[]` but computes variance ratios, not attention.

**Target:** Accurate naming.

**Implementation:**
- Rename `AttentionHead` → `LayerSignalScore`
- Rename `computeAttentionWeights` → `computeLayerSignals`
- Update all UI labels

### 4.3 Fix EmbeddingPoint Type Comment

**Current:** `coords` field documented as `// UMAP 3D` but uses force-directed layout.

**Target:** Accurate documentation.

**Implementation:**
- Change comment to `// 3D projection coordinates (method varies by engine)`

---

## Phase 5: ScSpatial — From Partial to Research-Grade

### 5.1 Marker-Gene Cell-Type Annotation

**Current:** Labels assigned by cluster index modulo 8. No biological basis.

**Target:** Labels derived from marker gene expression.

**Implementation:**
- Implement Wilcoxon rank-sum test per cluster per gene
- Define marker gene sets for common cell types
- Assign labels based on highest enrichment score
- Fall back to "Cluster N" when no marker set matches

### 5.2 LOESS for HVG Selection

**Current:** Sliding-window mean instead of LOESS.

**Target:** Proper LOESS regression.

**Implementation:**
- Implement basic LOESS with tricube kernel, degree-1 polynomial
- Keep sliding-window as fast fallback for >10,000 genes

### 5.3 Expression-Based Fate Classification

**Current:** `avgEfficiency = 1 - pseudotime` — conflates trajectory position with metabolic output.

**Target:** Classification based on actual gene expression.

**Implementation:**
- Use metabolic marker genes (ADS, CYP71AV1, CPR1 for artemisinin)
- Score each cluster by marker expression
- Classify as "productive"/"stressed"/"quiescent" based on scores

---

## Phase 6: GenMIM — From Partial to Research-Grade

### 6.1 Source CRISPRi Targets from Literature

**Current:** Positions fixed to real loci, but efficiencies/growth impacts are unsourced.

**Target:** Data from published CRISPRi screens.

**Implementation:**
- Source from Rousset et al. 2018 (Genome Research) CRISPRi screen
- Or Peters et al. 2016 (Cell) CRISPRi library
- Include actual knockdown efficiencies and growth impacts
- Cite the dataset

### 6.2 Add Off-Target Scoring

**Current:** "Off-target risk" = fraction of targets with efficiency < 0.9. Not real off-target analysis.

**Target:** sgRNA-level off-target scoring.

**Implementation:**
- Integrate CHOPCHOP API for sgRNA design
- Or implement basic sequence-homology scoring against E. coli genome
- Score each target for off-target potential

### 6.3 Calibrate Efficiency Heuristics

**Current:** Base efficiency 0.72, base targets 3 — magic numbers.

**Target:** Literature-sourced or user-configurable.

**Implementation:**
- Cite CRISPRi efficiency literature
- Or expose as configurable parameters with documented defaults

---

## Phase 7: NEXAI — From Partial to Research-Grade

### 7.1 Auto-Verify Citations

**Current:** Verification is manual (user clicks "Verify").

**Target:** Auto-verify on load.

**Implementation:**
- Auto-verify first 3 citations on result load
- Show verification status prominently by default
- Flag unverified citations with warning badge

### 7.2 Fix Relevance Scores

**Current:** `relevance: Math.max(0.1, 1 - i * 0.16)` — positional, not semantic.

**Target:** Use Semantic Scholar's native relevance score.

**Implementation:**
- Check if Semantic Scholar API returns relevance score
- If yes, use it; if no, label as "positional rank"

### 7.3 Calibrate Confidence Score

**Current:** `0.5 + 0.1 * (length/200) - 0.15 * hasHedging` — not calibrated.

**Target:** Either calibrate or relabel.

**Implementation:**
- Option A: Calibrate against a set of known-correct/incorrect answers
- Option B: Relabel as "answer quality index (not calibrated probability)"

---

## Phase 8: MetabolicEng — From Partial to Research-Grade

### 8.1 Rename Stress Test

**Current:** `applyStress()` applies sinusoidal perturbation. Not biologically meaningful.

**Target:** Real stress models or accurate naming.

**Implementation:**
- Option A: Rename to "parameter oscillation test"
- Option B: Implement real stress models:
  - Product toxicity (Hill inhibition)
  - Nutrient depletion (Monod kinetics)
  - Oxygen limitation

### 8.2 Source Default Parameters

**Current:** Vmax=8.5, Km=12.0 — no cited source.

**Target:** BRENDA-sourced defaults.

**Implementation:**
- Look up PFK-1 kinetic parameters in BRENDA
- Add citation comment
- Or make parameters enzyme-specific with dropdown selector

---

## Execution Order

```
Phase 1: CatDes (highest priority — demo → research-grade)
Phase 2: CellFree (demo → research-grade)
Phase 3: DynCon (partial → research-grade)
Phase 4: MultiO (demo → research-grade)
Phase 5: ScSpatial (partial → research-grade)
Phase 6: GenMIM (partial → research-grade)
Phase 7: NEXAI (partial → research-grade)
Phase 8: MetabolicEng (partial → research-grade)
```

Each phase should be executed as a separate wave with:
1. Deep verification (run actual calculations)
2. Fix implementation
3. Test verification
4. Commit and push

---

## Already Completed (Waves 1-4)

- [x] Turso persistence migration
- [x] HiGHS LP solver (FVA, pFBA, GPR)
- [x] Thermodynamics engine (Alberty transforms, group contribution)
- [x] Kinetics engine (multi-inhibition, DP45 adaptive ODE, parameter estimation)
- [x] Trust engine activation (enforce mode)
- [x] DynCon kLa parameter fix
- [x] CellFree AA/NTP pool fix
- [x] MultiO Math.random() → SeededRNG
- [x] MultiO ALS over-parameterization fix
- [x] DynCon fake confidence bands removed
- [x] NEXAI server enrichment marking
- [x] MetabolicEng FBA fallback removal
- [x] CellFree LM fitting fix
- [x] GenMIM CRISPRi positions corrected
