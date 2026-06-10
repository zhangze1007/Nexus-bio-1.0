# Design: Connect Real Algorithms to UI

**Date:** 2026-06-10
**Author:** Claude Code (with user approval)
**Status:** Approved

## Problem Statement

The Nexus-Bio platform has real scientific algorithms implemented in the codebase, but many tool pages use decorative formulas or hardcoded lookup tables instead. This creates a gap between what the tools claim to do and what they actually compute.

**First Principles Insight:** The most efficient optimization is to connect existing real algorithms to the UI, not to rewrite them.

## Scope

Connect 4 tools to their real algorithm backends:

1. **CETHX ← eQuilibrator** (thermodynamics)
2. **FBAsim ← Simplex LP** (flux balance analysis)
3. **ProEvol ← CSV upload** (directed evolution statistics)
4. **GECAIR ← More ODE models** (gene circuit dynamics)

## Design Details

### 1. CETHX ← eQuilibrator

**Current State:**
- CETHX page uses hardcoded ΔG values from Lehninger textbook (`mockCETHX.ts`)
- eQuilibrator sidecar exists (`src/server/equilibrator_sidecar.py`) with condition-aware ΔG' calculations
- `useEquilibrator` hook exists but is not connected to CETHX page

**Target State:**
- CETHX page calls eQuilibrator API on load
- Displays condition-aware ΔG' (pH, temperature, ionic strength dependent)
- Falls back to hardcoded values when sidecar unavailable

**Files to Modify:**
- `src/components/tools/CETHXPage.tsx` — import `useEquilibrator`, call API, display results

**Data Flow:**
```
User input (pH, temp) → eQuilibrator sidecar → ΔG' → CETHX page display
```

**Risk:** Low — sidecar already exists, just needs wiring

---

### 2. FBAsim ← Simplex LP

**Current State:**
- FBASimPage uses `mockFBA.ts` with hardcoded proportional scaling (`glucoseUptake * 0.92`)
- Real simplex LP solver exists (`src/server/fbaEngine.ts`)
- `/api/fba` endpoint exists and works

**Target State:**
- FBASimPage calls `/api/fba` endpoint
- Displays real flux distributions from LP optimization
- Shows actual shadow prices, growth rates, carbon efficiency
- Falls back to mock data when API unavailable

**Files to Modify:**
- `src/components/tools/FBASimPage.tsx` — call `/api/fba`, display real results

**Data Flow:**
```
User input (substrate, O2, knockouts) → /api/fba → Simplex LP → flux distribution → FBASim display
```

**Risk:** Medium — need to ensure API calls don't block UI

---

### 3. ProEvol ← CSV Upload

**Current State:**
- ProEvol uses `ProEvolCampaignEngine.ts` to generate synthetic data
- `proevolAnalysis.ts` has real statistical functions (Shannon entropy, selection coefficients, confidence intervals)
- No mechanism to ingest real experimental data

**Target State:**
- ProEvol page has CSV file upload component
- Parses CSV format: `variant_id, round, replicate, read_count`
- Calls `proevolAnalysis.ts` functions on real data
- Displays real Shannon diversity, selection coefficients, enrichment analysis
- Keeps simulation mode as fallback

**Files to Modify:**
- `src/components/tools/ProEvolPage.tsx` — add CSV upload, parse, call analysis

**CSV Format:**
```csv
variant_id,round,replicate,read_count
WT,1,1,1000
WT,1,2,950
M1-A12V,1,1,50
M1-A12V,1,2,45
```

**Risk:** Low — proevolAnalysis.ts already implemented

---

### 4. GECAIR ← More ODE Models

**Current State:**
- GECAIR page has Repressilator ODE integrated (just completed)
- Other circuit topologies (Toggle Switch, Logic Cascade) use steady-state Hill functions only

**Target State:**
- Add Toggle Switch ODE model (bistable system)
- Add Logic Cascade ODE model (cascade response)
- Add circuit topology selector in GECAIR page
- Run selected ODE model and display transient dynamics

**New ODE Models:**
- **Toggle Switch:** `dmA/dt = alpha/(1+pB^n) - mA`, `dmB/dt = alpha/(1+pA^n) - mB`
- **Logic Cascade:** A → B → C cascade inhibition

**Files to Modify:**
- `src/data/mockGECAIR.ts` — add Toggle Switch and Logic Cascade ODE functions
- `src/components/tools/GECAIRPage.tsx` — add topology selector, run selected ODE

**Risk:** Low — same pattern as Repressilator integration

---

## Implementation Order

1. CETHX ← eQuilibrator (30 min, lowest risk)
2. FBAsim ← Simplex LP (1 hour, medium risk)
3. ProEvol ← CSV upload (1 hour, low risk)
4. GECAIR ← More ODE models (30 min, low risk)

**Total estimated time:** 3 hours

## Testing Strategy

- Run full test suite after each tool connection (1575 tests)
- Verify TypeScript compilation after each change
- Manual testing of each tool page

## Success Criteria

- [ ] CETHX displays condition-aware ΔG' from eQuilibrator
- [ ] FBAsim displays real flux distributions from Simplex LP
- [ ] ProEvol accepts CSV upload and shows real statistics
- [ ] GECAIR has Toggle Switch and Logic Cascade ODE models
- [ ] All 1575 tests still pass
- [ ] No TypeScript errors

## Rollback Plan

Each tool connection is independent. If any connection fails:
1. Revert the specific tool's changes
2. Keep the other connections
3. The fallback (mock data) is always available

---

**Approved by:** User (2026-06-10)
**Next step:** Invoke writing-plans skill to create implementation plan
