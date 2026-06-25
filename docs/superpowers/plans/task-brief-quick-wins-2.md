# Task Brief: Quick Wins Batch 2 (3.4, 3.5, 3.11)

## Task 3.4: Upgrade cellFreeMetabolicEngine from Euler to RK4
**File:** `src/server/cellFreeMetabolicEngine.ts` lines 170-214
The current ODE integration uses forward Euler (dt=0.01h). Replace with RK4.
- Import or inline a simple RK4 stepper
- Replace the Euler loop with RK4 steps
- Keep the same dt=0.01h step size
- Keep the pathway flux calculation (min across enzyme steps) unchanged
- Keep the energy system modeling unchanged

## Task 3.5: Consolidate dual group contribution implementations
**Files:**
- `src/services/thermoEngine.ts` — has naive string-match `calcGroupContribution`
- `src/utils/groupContribution.ts` — has proper graph-based `estimateFormationEnergy`

The naive parser in thermoEngine.ts will produce wrong results for complex SMILES. Remove the naive implementation and make thermoEngine.ts import from groupContribution.ts instead.

1. Find all callers of `calcGroupContribution` in thermoEngine.ts
2. Replace them with imports from `groupContribution.ts`
3. Remove the naive `calcGroupContribution` function from thermoEngine.ts
4. Verify no other files import the removed function

## Task 3.11: Reduce FluidSimCanvas per-frame updates
**File:** `src/components/tools/FluidSimCanvas.tsx` lines 70-99
Skip frames to reduce CPU usage. Add a frame counter and only update every Nth frame (e.g., every 2nd frame).

## Constraints
- Run `npx jest --no-coverage --forceExit --testPathIgnorePatterns="e2e|streaming|performanceBenchmark|scspatialApi|fetchWithFallback"` after all changes
- Run `npx tsc --noEmit` after all changes
