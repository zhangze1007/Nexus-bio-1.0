# Wave 2: FBA Engine Upgrade (HiGHS)

**Date:** 2026-06-11
**Status:** Draft
**Author:** Zhang Ze Foo + Claude Code

---

## Problem Statement

The current FBA engine uses a custom tableau simplex solver (`simplexLP.ts`) designed for small networks (≤20 reactions). It lacks:
- FVA (Flux Variability Analysis)
- pFBA (parsimonious FBA)
- GPR rules (gene-protein-reaction mapping)
- Proper shadow prices (currently uses finite-difference approximation)
- Large model support (current iJO1366 subset: ~95 reactions)

## Solution

Replace `simplexLP.ts` with `highs` (HiGHS solver compiled to WebAssembly, MIT license). Implement FVA, pFBA, and GPR rules in TypeScript on top of highs. Keep all code on Vercel (no external services).

## Architecture

```
┌─────────────────────────────────────────────┐
│           FBASimPage.tsx (UI)               │
│  ┌─────────┐ ┌──────┐ ┌──────┐ ┌─────────┐ │
│  │ FBA     │ │ FVA  │ │ pFBA │ │ Knockout│ │
│  │ Panel   │ │ Panel│ │ Panel│ │ Panel   │ │
│  └────┬────┘ └──┬───┘ └──┬───┘ └────┬────┘ │
│       │         │        │          │       │
│  ┌────▼─────────▼────────▼──────────▼────┐ │
│  │         FBA Engine (TypeScript)        │ │
│  │  ┌──────────┐  ┌──────┐  ┌─────────┐ │ │
│  │  │ highs    │  │ FVA  │  │ GPR     │ │ │
│  │  │ solver   │  │ impl │  │ engine  │ │ │
│  │  └──────────┘  └──────┘  └─────────┘ │ │
│  └───────────────────────────────────────┘ │
│  ┌───────────────────────────────────────┐ │
│  │    iJO1366 Data (TypeScript)           │ │
│  │    ~200 reactions, ~150 metabolites    │ │
│  └───────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

## Features

### 1. LP Solver Replacement
- Replace `simplexLP.ts` with `highs` (WASM)
- Same interface: `solve({ objective, constraints, bounds }) → { fluxes, objectiveValue, status }`
- Direct dual variable extraction (shadow prices)
- Support for models up to 500+ reactions

### 2. FVA (Flux Variability Analysis)
- For each reaction, find min and max flux while maintaining optimal objective
- Implementation: iterate over reactions, solve two LPs per reaction (minimize/maximize)
- Output: flux range for each reaction
- Reference: Mahadevan & Schilling (2003) Metab Eng 5:264

### 3. pFBA (parsimonious FBA)
- After finding optimal growth rate, minimize total flux (sum of absolute fluxes)
- Implementation: fix objective at optimum, add secondary objective minimizing Σ|vᵢ|
- Output: unique flux distribution with minimum total flux
- Reference: Lewis et al. (2010) Mol Syst Biol 6:390

### 4. GPR Rules (Gene-Protein-Reaction)
- Parse gene-protein-reaction rules from iJO1366 data
- Support AND (protein complex) and OR (isozymes) logic
- Gene knockout: set reaction bounds to 0 if GPR evaluates to false
- Output: which genes are essential, which reactions are affected

### 5. Shadow Prices
- Extract directly from highs dual variables
- No more finite-difference approximation
- Units: mmol/gDW/h per mmol/L

### 6. Network Expansion
- Expand iJO1366 subset from ~95 to ~200 reactions
- Add amino acid biosynthesis pathways
- Add membrane transport reactions
- Add cofactor balancing

## Files to Create/Modify

| File | Change |
|------|--------|
| `src/server/fbaEngine.ts` | Replace simplexLP with highs, add FVA/pFBA/GPR |
| `src/server/simplexLP.ts` | Keep as fallback, but primary solver is now highs |
| `src/data/iJO1366Subset.ts` | Expand to ~200 reactions, add GPR rules |
| `src/components/tools/FBASimPage.tsx` | Add FVA/pFBA/GPR UI panels |
| `src/components/tools/fba/FVAPanel.tsx` | New: FVA results visualization |
| `src/components/tools/fba/pFBAPanel.tsx` | New: pFBA flux distribution |
| `src/components/tools/fba/GPRPanel.tsx` | New: gene knockout interface |
| `app/api/fba/route.ts` | Add FVA/pFBA/GPR endpoints |
| `package.json` | Add `highs` dependency |

## Success Criteria

- [ ] highs solves the existing E. coli and yeast toy networks correctly
- [ ] FVA produces flux ranges for all reactions in iJO1366 subset
- [ ] pFBA produces unique flux distribution
- [ ] Gene knockout predictions match COBRApy reference for known knockouts
- [ ] Shadow prices extracted directly from dual variables
- [ ] All existing FBA tests still pass
- [ ] Performance: FVA for 200 reactions completes in <10 seconds

## Risks

- highs WASM may have different numerical behavior than the current solver
- GPR rule parsing needs careful handling of complex boolean expressions
- Network expansion needs accurate stoichiometry from BiGG
