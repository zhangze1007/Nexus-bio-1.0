# Nexus-Bio Research-Grade Roadmap

**Date:** 2026-06-11
**Target Audience:** Synthetic biology researchers, experts, bloggers, enterprise consultants
**Goal:** All 14 tools reach research-grade standard

---

## Acceptance Criteria: What Is "Research-Grade"?

A tool is research-grade when it passes ALL three tests:

| Test | Definition | Example |
|------|-----------|---------|
| **Reviewer Test** | Would a peer reviewer accept data produced by this tool in a manuscript? | FBA flux values match COBRApy within 1% |
| **Reproducibility Test** | Does the same input always produce the same output? | No Math.random(), no non-deterministic code |
| **Citation Test** | Can you cite this tool's output in a paper without embarrassment? | All constants have literature references |

---

## Research-Grade Reference Standards

Each tool must match or exceed these reference implementations:

| Tool | Reference | Standard |
|------|-----------|----------|
| FBA | COBRApy (Ebrahim et al. 2013) | LP solution within 1% of COBRApy for same model |
| CETHX | eQuilibrator 3 (Beber et al. 2022) | ΔG'° within 2 kJ/mol of eQuilibrator |
| Kinetics | COPASI (Hoops et al. 2006) | ODE trajectories within 5% of COPASI |
| DynCon | SimBiology (MATLAB) | PID convergence within 10% of reference |
| CellFree | Stogbauer et al. 2012 | Protein yield within 2x of published S30 data |
| CatDes | FoldX (Schymkowitz et al. 2005) | ΔΔG correlation R² > 0.3 with FoldX |
| GenMIM | CHOPCHOP (Labun et al. 2019) | Off-target scores match CHOPCHOP for same sgRNA |
| MultiO | scanpy (Wolf et al. 2018) | PCA loadings within 10% of scanpy |
| ScSpatial | scanpy + Squidpy (Palla et al. 2022) | Moran's I within 5% of Squidpy |
| NEXAI | Elicit / Consensus | Citation verification rate > 80% |
| MetabolicEng | COBRApy + Escher | FBA results match COBRApy |

---

## Cross-Tool Integration Verification

These data flows must be verified after all fixes:

| Flow | Source | Sink | Verification |
|------|--------|------|-------------|
| FBA → GenMIM | Flux values | Knockout targets | GenMIM targets should align with FBA-identified bottlenecks |
| FBA → DynCon | Growth rate | Bioreactor model | DynCon biomass should track FBA-predicted µ |
| CETHX → CatDes | ΔG values | Binding energy | CatDes binding should be thermodynamically consistent |
| FBA → MultiO | Flux distribution | Perturbation model | MultiO perturbation should reflect FBA flux changes |
| ScSpatial → MultiO | Cluster assignments | Factor decomposition | MultiO factors should correlate with spatial clusters |
| Kinetics → DynCon | Enzyme parameters | PID tuning | DynCon response should match kinetic time constants |

---

## Performance Benchmarks

| Tool | Operation | Target | Current |
|------|-----------|--------|---------|
| FBA | Solve 200-reaction model | < 5s | ~2s (HiGHS) |
| FVA | 200 reactions | < 30s | ~15s |
| CETHX | Pathway ΔG (10 steps) | < 1s | ~0.5s |
| Kinetics | 1000-point ODE simulation | < 2s | ~1s |
| DynCon | 200h bioreactor simulation | < 5s | ~3s |
| CellFree | 4h TX-TL simulation | < 3s | ~2s |
| MultiO | VAE training (50 genes, 50 epochs) | < 10s | ~5s |
| ScSpatial | 10,000 cells clustering | < 30s | ~15s |
| NEXAI | Citation verification (10 papers) | < 10s | ~5s |

---

## Phase 1: CatDes — From Demo to Research-Grade

### Reference: FoldX (Schymkowitz et al. 2005), Rosetta (Leaver-Fay et al. 2011), ProteinMPNN (Dauparas et al. 2022)

### 1.1 Remove Random Mutagenesis Predictions

**Current:** `Math.random()` generates ΔKcat and ΔKm fold changes. Zero predictive power.

**Fix:** Remove random predictions, show "No prediction available."

**Verification:**
- Run mutagenesis 10 times on same position → all outputs identical (null)
- No `Math.random()` or `rng.next()` in mutagenesis code path

**Known Limitation After Fix:** No mutagenesis effect prediction at all. Users must use external tools (FoldX, Rosetta ddg_monomer).

### 1.2 Fix Binding Affinity Model

**Current:** LJ epsilon=0.15 kcal/mol (10x too low), SASA is heuristic.

**Fix:**
- LJ epsilon: 0.15 → 0.5 kcal/mol (typical for C-C contacts)
- Replace heuristic SASA with analytical approximation: SASA ≈ 4π(r_probe + r_atom)² * (1 - overlap_fraction)
- Add ±2 kcal/mol uncertainty bounds to all predictions

**Verification:**
- Compare output to SKEMPI 2.0 dataset (Jankauskaitė et al. 2019)
- URL: https://life.bsc.es/pid/skempi2/
- Target: Pearson r > 0.3 with experimental ΔΔG
- If r < 0.3, relabel as "qualitative estimate" not "binding energy"

**Known Limitation After Fix:** Still a simplified force field. No molecular dynamics, no rotamer optimization, no water molecules. Accuracy will be lower than FoldX (which achieves r ≈ 0.7).

### 1.3 Fix Misleading Names

**Fix:**
- "ProteinMPNN-style" → "BLOSUM62-based sequence diversification"
- "ESM-2-inspired" → "conservation-weighted mutagenesis targeting"
- "AlphaFold 3-inspired" → "MM-PBSA-style binding estimation"

**Verification:**
- grep -r "ProteinMPNN\|ESM-2\|AlphaFold 3" src/components/tools/CatalystDesignerPage.tsx → zero results
- All AlgorithmPanel text describes actual algorithm

### 1.4 Calibrate DDG Estimation

**Current:** `ddg = -0.3 * BLOSUM62_score` — uncalibrated.

**Fix:**
- Download SKEMPI 2.0: https://life.bsc.es/pid/skempi2/
- Extract (mutation, ΔΔG_exp) pairs
- Compute BLOSUM62 score for each mutation
- Fit: ΔΔG = a * BLOSUM62 + b
- Report R² and RMSE
- If R² < 0.1, remove numeric DDG entirely

**Verification:**
- R² > 0.1 on SKEMPI 2.0 hold-out set (20% split)
- RMSE < 2.0 kcal/mol

---

## Phase 2: CellFree — From Partial to Research-Grade

### Reference: Stogbauer et al. 2012 (Integr Biol), Jewett & Swartz 2004 (Biotech Bioeng)

### 2.1 Source All Kinetic Constants

**Fix:** Create `src/services/cellFreeParameterSources.ts` mapping each constant to paper/table/row.

| Constant | Value | Source | DOI |
|----------|-------|--------|-----|
| k_tx | 2.5 nM/min | Stogbauer et al. 2012, Table 1 | 10.1039/c2ib00108k |
| d_mRNA | 0.08 h⁻¹ | Stogbauer et al. 2012, Table 1 | 10.1039/c2ib00108k |
| k_tl | 4.0 nM/min | Stogbauer et al. 2012, Table 1 | 10.1039/c2ib00108k |
| K_tl | 0.5 mM | Stogbauer et al. 2012, Table 1 | 10.1039/c2ib00108k |
| PEP regeneration | 0.165 mM/min | Jewett & Swartz 2004 | 10.1002/bit.10865 |
| Ribosome total | 500 nM | Karzbrun et al. 2011 | 10.1038/msb.2011.74 |
| T7 RNAP kcat | 4.2 nt/s | BRENDA: EC 2.7.7.6 | brenda-enzymes.org |

**Verification:**
- Every constant has an inline citation comment
- `cellfreeParameterSources.ts` exports a map: `constantName → { value, unit, source, doi }`
- Run simulation → protein yield in 1-100 µM range for standard T7-GFP construct

**Known Limitation After Fix:** Constants are from specific papers/batches. Different S30 extract preparations may have different values. Users should calibrate against their own data.

### 2.2 Fix IvIv MLP

**Current:** Random weights (SeededRNG 12345), not trained.

**Fix (Option B — relabel):**
- Rename `translateIvIv` → `estimateIvIvHeuristic`
- Remove numeric predictions from UI
- Show: "Expression estimate: [qualitative range] based on promoter strength and RBS"
- Add warning: "This is a heuristic estimate, not a trained model"

**Verification:**
- No numeric expression values shown to user
- UI shows qualitative guidance only
- Function is clearly labeled as "heuristic" not "MLP" or "neural network"

**Known Limitation After Fix:** No quantitative IvIv prediction. Users must run actual experiments.

### 2.3 Fix Radar Chart Reproducibility

**Fix:**
- Run simulation N=10 with ±10% parameter perturbation on (k_tx, k_tl, K_tl)
- Compute CV = std(yield) / mean(yield) for each construct
- Use 1 - min(CV, 1) as reproducibility score

**Verification:**
- Reproducibility score changes when parameters change
- Score is 1.0 when no perturbation (deterministic)
- Score decreases with larger perturbations

### 2.4 Add User Data Input for Fitting

**Fix:**
- Add CSV upload to fitting tab
- Format: `time,fluorescence` (header row + data rows)
- Parse with PapaParse or manual split
- Mark fitting as "demo" (mock) or "partial" (user data) in trust system

**Verification:**
- Upload a CSV with known Vmax/Kd → fitting recovers within 10%
- Mock data tab still works as before
- Trust system correctly marks user-data fitting as "partial"

---

## Phase 3: DynCon — From Partial to Research-Grade

### Reference: COPASI (Hoops et al. 2006), SimBiology (MATLAB)

### 3.1 Fix RBS Mapping Monotonicity

**Fix:**
- Sort RBS_REGISTRY by ascending rbsStrength
- Use linear interpolation between entries
- Document the transfer function in code comments

**Verification:**
- Sliding Kp from 0 to 1 → RBS strength increases monotonically
- No jumps from 0.01 to 1.0 within a small slider range

### 3.2 Cite All Hardcoded Constants

| Constant | Value | Source | Action |
|----------|-------|--------|--------|
| SPONTANEOUS_LOSS_RATE | 0.02 h⁻¹ | Estimate (plasmid loss) | Mark as tunable, expose in UI |
| PROTEIN_TURNOVER_RATE | 0.3 h⁻¹ | Bentley et al. 1990 (Biotech Bioeng) | Cite |
| O2_CONSUMPTION_COEFF | 1.5 | Tuned for simulation | Mark as tunable, expose in UI |
| proteinCost | 0.15 | Russell & Cook 1995 (Microbiol Rev) | Cite |
| atpDrain | 2.5 mmol/gDW/h | Estimate | Mark as tunable, expose in UI |
| burdenPenalty | 0.4 | Estimate | Mark as tunable, expose in UI |

**Verification:**
- Every constant has either a citation or a `// TODO: calibrate` comment
- All tunable constants exposed in "Advanced" parameter panel
- Default values match cited sources

### 3.3 Add Fed-Batch Volume Dynamics

**Fix:**
- Add state variable V with dV/dt = feedRate
- Update substrate equation: dS/dt = feedRate*(feedConc - S)/V - mu*X/Yxs
- Initial V = 2.0 L

**Verification:**
- Volume increases over time when feedRate > 0
- Substrate concentration stabilizes (CSTR behavior)
- Mass balance: feed_in = consumption + accumulation

**Known Limitation After Fix:** Still deterministic, no stochastic noise. No oxygen gradient modeling.

---

## Phase 4: MultiO — From Demo to Research-Grade

### Reference: scanpy (Wolf et al. 2018), MOFA+ (Argelaguet et al. 2020)

### 4.1 Compute Real PCA Loadings

**Fix:**
- Compute PCA on 3-column data matrix [zT, zP, zM]
- Use existing `pcaProject` eigenvalues
- Loading vectors = eigenvectors scaled by sqrt(eigenvalue)
- Replace decorative arrows with real loadings
- Replace hardcoded "38.2% var" with actual explained variance ratio

**Verification:**
- Loading arrows point in directions of maximum variance
- Explained variance ratios sum to 1.0
- Compare PCA results to scanpy `sc.pp.pca()` on same data → loadings within 10%

### 4.2 Rename "Attention Heads"

**Fix:**
- `AttentionHead` → `LayerSignalScore`
- `computeAttentionWeights` → `computeLayerSignals`
- Update all UI labels and tooltips

**Verification:**
- grep -r "AttentionHead\|attention" src/services/OmicsIntegrator.ts → zero results in type names
- UI labels say "Layer Signal Scores" not "Attention Heads"

### 4.3 Fix EmbeddingPoint Type Comment

**Fix:**
- `// UMAP 3D` → `// 3D projection coordinates (method varies by engine)`

**Known Limitation After Fix:** Still uses force-directed layout, not real UMAP. The umap-js library is available but not used in the main engine.

---

## Phase 5: ScSpatial — From Partial to Research-Grade

### Reference: scanpy (Wolf et al. 2018), Squidpy (Palla et al. 2022), BayesSpace (Zhao et al. 2021)

### 5.1 Marker-Gene Cell-Type Annotation

**Fix:**
- Implement Wilcoxon rank-sum test per cluster per gene
- Define marker gene sets for common cell types:
  - Progenitor: high SOX2, NES, VIM
  - Metabolically Active: high ATP5F1, COX4I1, SDHB
  - Stressed: high HSPA5, DDIT3, ATF4
  - Quiescent: low MKI67, PCNA, TOP2A
- Assign labels based on highest enrichment score
- Fall back to "Cluster N" when no marker set matches

**Verification:**
- On mock data with known clusters → correct labels assigned
- Wilcoxon p-values < 0.05 for assigned marker genes
- Compare to scanpy `sc.tl.rank_genes_groups()` → same top markers

### 5.2 LOESS for HVG Selection

**Fix:**
- Implement LOESS with tricube kernel: w_i = (1 - |d_i/d_max|^3)^3
- Degree-1 polynomial, span = 0.3
- Keep sliding-window as fast fallback for >10,000 genes

**Verification:**
- LOESS curve is smooth (no discontinuities at window boundaries)
- Compare to scanpy `sc.pp.highly_variable_genes(method='seurat_v3')` → top 50 HVGs overlap > 80%

### 5.3 Expression-Based Fate Classification

**Fix:**
- Define metabolic marker genes per pathway:
  - Artemisinin: ADS, CYP71AV1, CPR1, DBR2
  - General: ACTB (housekeeping), HSPA5 (stress)
- Score each cluster: mean expression of marker genes
- Classify: score > 0.7 → "productive", score < 0.3 → "stressed", else → "quiescent"

**Verification:**
- Mock data with known productive clusters → correctly classified
- Classification changes when marker genes change

**Known Limitation After Fix:** Classification depends on marker gene choice. Different pathways need different markers. No built-in pathway-specific marker sets.

---

## Phase 6: GenMIM — From Partial to Research-Grade

### Reference: CHOPCHOP (Labun et al. 2019), CRISPOR (Concordet & Haeussler 2018), CRISPRiDB

### 6.1 Source CRISPRi Targets from Literature

**Fix:**
- Source from Rousset et al. 2018 (Genome Research, DOI: 10.1101/gr.228965.117)
- Or Peters et al. 2016 (Cell, DOI: 10.1016/j.cell.2016.02.051)
- Include actual knockdown efficiencies and growth impacts
- Cite the dataset in code comments and UI

**Verification:**
- All 20 targets have literature citations
- Knockdown efficiencies match published values within 10%
- Growth impacts match published values within 15%

### 6.2 Add Off-Target Scoring

**Fix:**
- Integrate CHOPCHOP API: https://chopchop.cbu.uib.no/api/
- Or implement basic scoring: count 0/1/2/3-mismatches in 20bp sgRNA against E. coli genome
- Score = 1 - (off_target_count / total_sites)

**Verification:**
- Compare scores to CHOPCHOP for 10 known sgRNAs → ranking within top 3
- High-specificity sgRNAs get high scores
- Known problematic sgRNAs get low scores

### 6.3 Calibrate Efficiency Heuristics

**Fix:**
- Source from Doench et al. 2016 (Nat Biotechnol, DOI: 10.1038/nbt.3437) — Rule Set 2
- Or expose as configurable parameters with documented defaults
- Add "Advanced" panel with efficiency parameters

**Verification:**
- Default efficiency values match published ranges
- Changing parameters affects target ranking

**Known Limitation After Fix:** CRISPRi efficiency depends on chromatin state, which this tool doesn't model. Predictions are for ideal conditions only.

---

## Phase 7: NEXAI — From Partial to Research-Grade

### Reference: Elicit (elicit.org), Consensus (consensus.app), Semantic Scholar (semanticscholar.org)

### 7.1 Auto-Verify Citations

**Fix:**
- Auto-verify first 3 citations on result load
- Use existing `citationVerifier.ts` (PubMed E-utilities)
- Show verification badge: ✓ verified, ✗ not found, ? ambiguous
- Flag unverified citations with warning

**Verification:**
- Known real PMID → shows ✓ verified
- Known fake PMID → shows ✗ not found
- Ambiguous query → shows ? ambiguous

### 7.2 Fix Relevance Scores

**Fix:**
- Check if Semantic Scholar API returns relevance score
- If yes: use `paper.relevanceScore` from API response
- If no: label as "positional rank" in UI

**Verification:**
- Top result has highest relevance score
- Scores decrease monotonically with rank
- Label says "Rank" not "Relevance" if using positional

### 7.3 Calibrate Confidence Score

**Fix (Option B — relabel):**
- Rename "Confidence" → "Answer Quality Index"
- Add tooltip: "This is a heuristic score based on answer length and hedging language. It is NOT a calibrated probability."
- Remove percentage sign from display

**Verification:**
- No "75% confidence" text in UI
- Tooltip explains the score is not calibrated
- Score is labeled "Quality Index" not "Confidence"

**Known Limitation After Fix:** No real uncertainty quantification from the LLM. The quality index is a heuristic, not a probability.

---

## Phase 8: MetabolicEng — From Partial to Research-Grade

### Reference: COBRApy (Ebrahim et al. 2013), Escher (King et al. 2015)

### 8.1 Rename Stress Test

**Fix:**
- Rename `applyStress()` → `applyParameterOscillation()`
- Update UI label: "Stress Test" → "Parameter Oscillation"
- Add tooltip: "Applies sinusoidal perturbation to model parameters. Not a biological stress model."

**Verification:**
- No "stress test" text in UI
- Tooltip clearly states it's parameter oscillation

### 8.2 Source Default Parameters

**Fix:**
- Look up PFK-1 in BRENDA: https://www.brenda-enzymes.org/
- EC 2.7.1.11, organism: E. coli
- Typical values: Km(F6P) ≈ 0.1 mM, kcat ≈ 100 s⁻¹
- Add citation comment: `// BRENDA: EC 2.7.1.11, E. coli, Km(F6P)=0.1mM`

**Verification:**
- Default values match BRENDA entries
- Citation comment present in code

**Known Limitation After Fix:** Default values are for specific enzymes. Users working with different organisms/enzymes need to update parameters.

---

## Execution Order

```
Wave 5: CatDes (Phase 1) — highest priority, demo → research-grade
Wave 6: CellFree (Phase 2) + DynCon (Phase 3) — parallel
Wave 7: MultiO (Phase 4) + ScSpatial (Phase 5) — parallel
Wave 8: GenMIM (Phase 6) + NEXAI (Phase 7) + MetabolicEng (Phase 8) — parallel
Wave 9: Cross-tool integration verification
Wave 10: Performance benchmarking + documentation
```

Each wave follows:
1. Deep verification (run actual calculations against reference)
2. Fix implementation
3. Test verification (unit + integration)
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
