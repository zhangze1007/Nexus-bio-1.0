# P2: fbaEngine.test.ts — Test Coverage Report

## Summary

Created `__tests__/fbaEngine.test.ts` with **39 tests** covering the HiGHS-backed FBA engine (`src/server/fbaEngine.ts`). All tests pass.

## Test Suites

| Suite | Tests | Coverage |
|-------|-------|----------|
| Determinism | 2 | Identical output on repeated runs (E. coli + yeast) |
| Known-Solution Validation | 3 | Feasibility, positive growth rate, hand-calculated values |
| Invariant Checks | 5 | Mass conservation (S·v=0), non-negative fluxes, objective maximality, carbon efficiency range, sensitivity coefficients |
| Knockout Tests | 5 | PFK essentiality, GLCpts essentiality, PRODUCT non-essentiality, yeast PFK_y, growth rate comparison |
| Species Tests | 4 | Both species feasible, distinct reaction IDs, yeast mass-balance, yeast hand-calculated values |
| Objective Tests | 6 | biomass/product/atp objectives for E. coli, yeast biomass vs product, cross-objective comparison |
| buildAuthorityFBAModel | 4 | Model structure, knockout bounds, glucose clamping |
| Community FBA | 5 | Feasibility, weighted blend, exchange fluxes, alpha=0/1 weights |
| Edge Cases | 4 | Uptake clamping to [0,25], zero glucose, zero oxygen, duplicate knockout dedup |

## Key Validation Points

- **Determinism**: `solveAuthorityFBA` returns `toEqual`-identical objects for the same request (byte-for-byte via JSON serialization)
- **Known solutions**: E. coli biomass growth rate = 1.22 h^-1 (20 * 0.061), yeast biomass growth rate = 0.45 h^-1 (10 * 0.045)
- **Mass conservation**: All 8 E. coli stoichiometric constraints and 9 yeast constraints verified via `toBeCloseTo`
- **Knockouts**: PFK knockout eliminates all downstream flux; PRODUCT knockout is growth-neutral

## Files

- Test: `__tests__/fbaEngine.test.ts` (new)
- Engine: `src/server/fbaEngine.ts` (existing, unmodified)
