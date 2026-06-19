# FBA Solver + All Tools Bug Fix Design

**Date:** 2026-06-19
**Scope:** 26 issues across FBA solver, 13 tool pages, and cross-cutting patterns
**Approach:** Severity-first (HIGH → MEDIUM → LOW → cross-cutting)

---

## Wave 1: FBA Solver (6 fixes)

### 1a. Better error visibility in API route
**File:** `app/api/fba/route.ts`
**Problem:** Single catch-all at line 323 hides which action failed.
**Fix:** Add targeted try/catch around each action type (fva, pfba, knockout, fseof, optknock, custom, default). Expose the action name in the error message so the client knows what failed. Keep internal stack traces server-side only.

### 1b. Community FBA feasibility logic
**File:** `src/server/fbaEngine.ts` line 387
**Problem:** `feasible: ecoli.feasible || yeast.feasible` — community is feasible if EITHER species lives.
**Fix:** Change to `&&` — both species must be feasible for the community to be feasible.

### 1c. Missing O2tx in yeast deriveMetrics
**File:** `src/server/fbaEngine.ts` lines 177-189
**Problem:** O2tx_y is solved but not included in the returned fluxes object.
**Fix:** Add `O2tx_y: round(vars.O2tx_y ?? 0)` to the yeast fluxes.

### 1d. PGK/ENO hardcoded to GAPD
**File:** `src/server/fbaEngine.ts` lines 111-112
**Problem:** `PGK: round(vars.GAPD ?? 0)` and `ENO: round(vars.GAPD ?? 0)` — not independently solved.
**Fix:** Add a clear comment explaining the linear-pathway simplification (PGK and ENO carry the same flux as GAPD in this linear glycolysis segment). Modifying the LP model to add these as independent variables would change the solver behavior and is out of scope for a bugfix pass.

### 1e. Stale closure in seed detection
**File:** `src/components/tools/FBASimPage.tsx` lines 179-184
**Problem:** `lastAppliedSeedRef` divergence check compares current render state against expected values, but the values are already overwritten on the same render cycle.
**Fix:** Store the expected values in the ref alongside the seed ID, and compare against those stored values instead of current state.

### 1f. Empty stoichiometry in defaultStrainReactions
**File:** `src/components/tools/FBASimPage.tsx` lines 380-385
**Problem:** FSEOF/OptKnock get empty stoichiometry when no BiGG model is loaded.
**Fix:** Either disable FSEOF/OptKnock buttons when no BiGG model is loaded, or provide the toy network's stoichiometry as a fallback.

---

## Wave 2: MEDIUM Tool Fixes (3 files, 6 issues)

### 2a. CellFreePage.tsx (4 issues)
**File:** `src/components/tools/CellFreePage.tsx`
1. **Line ~96:** `forEach` with `return` → change to `map` in `stackedPath` useMemo
2. **Line ~722:** Add `catch` block to `handleCalibrate` — set error state
3. **Line ~786:** Wrap fallback `runFullCFSPipeline` call in try/catch
4. **Line ~47:** Move `GENE_COLORS` after `THEME` import

### 2b. DBTLflowPage.tsx (1 issue, FORBIDDEN)
**File:** `src/components/tools/DBTLflowPage.tsx`
**Problem:** Iterations tab uses uppercase `THEME.BORDER` etc. — may be undefined.
**Fix:** Verify which token names exist in THEME. If uppercase tokens are undefined, report but do not modify (FORBIDDEN file).

### 2c. MetabolicEngPage.tsx (1 issue)
**File:** `src/components/tools/MetabolicEngPage.tsx`
**Problem:** `useSearchParams()` without `<Suspense>` boundary.
**Fix:** Wrap the component or its usage in `<Suspense>`.

---

## Wave 3: LOW Tool Fixes (5 files, 5 issues)

### 3a. CETHXPage.tsx
**File:** `src/components/tools/CETHXPage.tsx` line 612
**Fix:** Add missing deps to console logging useEffect.

### 3b. DynConPage.tsx
**File:** `src/components/tools/DynConPage.tsx` line 617
**Fix:** Add missing deps to console logging useEffect.

### 3c. GECAIRPage.tsx (FORBIDDEN)
**File:** `src/components/tools/GECAIRPage.tsx`
**Fix:** Add explicit parentheses to NAND gate. Add seed guard pattern.

### 3d. NEXAIPage.tsx
**File:** `src/components/tools/NEXAIPage.tsx` line 205
**Fix:** Add `verified` to citation effect dependency array.

### 3e. ProEvolPage.tsx (FORBIDDEN)
**File:** `src/components/tools/ProEvolPage.tsx` lines 460-486
**Fix:** Add logging to `runGPAnalysis` catch block.

---

## Wave 4: Cross-cutting (2 patterns)

### 4a. Silent error swallowing
**Files:** 19 empty catch blocks across the codebase
**Fix:**
- 3Dmol viewer cleanup (6): Leave as-is (intentional cleanup)
- JSON parse fallbacks (4): Add `console.warn` with URL and error
- Others (9): Case-by-case — add `console.warn` where appropriate

### 4b. Non-reproducible Math.random()
**Files:** 5 simulation files use `Math.random()` instead of seeded RNG
**Fix:** Replace with `seededRng` from `src/utils/seededRng.ts` in:
- `src/data/mockProEvol.ts`
- `src/services/vaeONNX.ts`
- `src/server/mofaPlus.ts`
- `src/server/fbaOptKnock.ts`
- `src/server/fbaRobustKnock.ts`
- Visual/cosmetic code (~31 instances): Leave as-is

---

## Success Criteria
- `npx tsc --noEmit` passes
- `npm test` passes
- `npm run build` succeeds
- All 26 issues addressed (fixed or documented as intentional/FORBIDDEN)
