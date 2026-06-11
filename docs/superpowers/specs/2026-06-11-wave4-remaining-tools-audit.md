# Wave 4: Remaining Tools Audit & Upgrade Plan

**Date:** 2026-06-11
**Status:** Draft

---

## Audit Summary

| Tool | Tier | P1 Count | Top Priority Fix |
|------|------|----------|-----------------|
| CatDes | demo | 3 | Remove random mutagenesis predictions |
| CellFree | demo | 3 | Source kinetic constants from literature |
| DynCon | partial | 3 | Remove fake confidence bands |
| GenMIM | partial | 2 | Source CRISPRi targets from literature |
| MultiO | demo | 4 | Seed all Math.random() calls |
| ScSpatial | partial | 1 | Rename "VAE" to linear autoencoder |

## Cross-Cutting Issues

### Issue 1: Math.random() in scientific predictions (MultiO, CatDes)
**Impact:** Non-reproducible results across renders
**Fix:** Replace with seeded PRNG (SeededRNG already exists in codebase)

### Issue 2: Misleading tool/model names (CatDes, ScSpatial)
**Impact:** Reviewers would flag as scientific misconduct
**Fix:** Rename to describe what actually happens

### Issue 3: Hardcoded mock data without citations (GenMIM, CellFree, MultiO)
**Impact:** Users mistake demo data for validated values
**Fix:** Source from literature or clearly label as demo

### Issue 4: Uncited physical constants (DynCon, CellFree)
**Impact:** Unverifiable quantitative outputs
**Fix:** Add literature citations or mark as tunable parameters

---

## Wave 4 Execution Plan

### Wave 4A: Quick Wins (P1, Low Effort) — 1 week

**Goal:** Fix the most impactful issues that require minimal code changes.

1. **MultiO: Seed all randomness** (Impact 5, Effort 1)
   - Replace `Math.random()` in OmicsIntegrator.simulatePerturbation with SeededRNG
   - Replace `Math.random()` in MOIEngine.pcaProject with SeededRNG(42)

2. **ScSpatial: Rename "VAE"** (Impact 5, Effort 2)
   - Rename `trainScVAE` → `trainKLAutoencoder`
   - Update types, labels, comments
   - Replace "t-SNE-like" with "force-directed layout"

3. **CatDes: Remove random predictions** (Impact 5, Effort 2)
   - Remove Math.random()-based ΔKcat/ΔKm predictions
   - Replace with qualitative labels ("likely beneficial/neutral/deleterious")
   - Fix Math.random() in UI (line 573)

4. **DynCon: Remove fake confidence bands** (Impact 4, Effort 2)
   - Remove `bandPath` rendering from TimeSeriesSVG
   - Or replace with Monte Carlo uncertainty (N=50, ±10% params)

### Wave 4B: Parameter Sourcing (P1, Medium Effort) — 2 weeks

**Goal:** Replace hardcoded values with literature-sourced data.

5. **CellFree: Source kinetic constants** (Impact 5, Effort 3)
   - Create `cellFreeParameterSources.ts` mapping each constant to paper/table
   - Sources: Stogbauer 2012, Jewett & Swartz 2004, Karzbrun 2011, BRENDA

6. **CellFree: Relabel IvIv model** (Impact 5, Effort 4)
   - Rename to "heuristic IvIv estimate with untrained architecture"
   - Remove numeric predictions, replace with qualitative guidance

7. **GenMIM: Source CRISPRi targets** (Impact 5, Effort 2)
   - Replace mock targets with Rousset et al. 2018 data
   - Import gene positions from NC_000913.3 GenBank

8. **DynCon: Cite hardcoded constants** (Impact 3, Effort 2)
   - Add literature citations for 6 constants
   - Expose as tunable parameters in Advanced panel

### Wave 4C: Algorithm Improvements (P2) — 2 weeks

**Goal:** Improve scientific accuracy of core algorithms.

9. **MultiO: Compute real PCA loadings** (Impact 4, Effort 3)
   - Replace decorative biplot arrows with actual loading vectors
   - Compute explained variance ratios from eigenvalues

10. **ScSpatial: Marker-gene cell annotation** (Impact 4, Effort 3)
    - Implement Wilcoxon rank-sum per cluster
    - Assign labels based on marker gene enrichment

11. **ScSpatial: LOESS for HVG** (Impact 3, Effort 3)
    - Implement basic LOESS with tricube kernel

12. **DynCon: Fix RBS mapping monotonicity** (Impact 3, Effort 2)
    - Sort RBS_REGISTRY by ascending strength
    - Use linear interpolation

13. **CellFree: Add user data input** (Impact 4, Effort 3)
    - Add CSV upload to fitting tab
    - Mark fitting as "demo" (mock) or "partial" (user data)

### Wave 4D: Backlog (P3)

- MultiO: Replace mock dataset with real published data
- ScSpatial: User-selectable PAGA root
- DynCon: Volume dynamics for fed-batch
- CellFree: RNAP competition model
- GenMIM: Off-target scoring via CHOPCHOP

---

## Success Criteria

- [ ] No `Math.random()` in any scientific prediction
- [ ] No misleading tool/model names
- [ ] All P1 issues resolved
- [ ] CellFree constants traced to specific papers
- [ ] GenMIM targets sourced from published CRISPRi data
- [ ] All tests pass
