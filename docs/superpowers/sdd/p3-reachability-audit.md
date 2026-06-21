# P3: Engine Reachability Audit

## Method

**Tool:** `grep` across full `src/` and `app/` directories for import references (static and dynamic `import()`).

**Why not madge:** The project uses path aliases (`@/` -> `src/`) and TypeScript with JSX. `madge` requires careful tsconfig setup and has known issues with Next.js App Router projects. A thorough grep-based approach was used instead, searching for:
1. Direct engine name references across all of `src/` and `app/`
2. Dynamic `import()` patterns specifically
3. Exported function names from module indexes
4. Full import chain tracing through intermediate modules

**Chains traced:** For each engine, the import chain was followed from the engine file through all intermediate modules until reaching a page component (`src/components/tools/*Page.tsx`), an API route (`app/api/*/route.ts`), or a dead end (only self-references and tests).

---

## Results

| # | Engine | File Location | Classification | Import Chain | Evidence |
|---|--------|---------------|----------------|--------------|----------|
| 1 | `bioprocessOptimizationEngine` | `src/server/bioprocessOptimizationEngine.ts` | **DEAD** | None | No imports found anywhere in `src/` or `app/`. Only referenced by its own test file `__tests__/bioprocessOptimizationEngine.test.ts`. |
| 2 | `bioreactorAnalyticsEngine` | `src/server/bioreactorAnalyticsEngine.ts` | **REACHABLE** | `bioreactorAnalyticsEngine` -> `DynConPage.tsx` | Dynamic import at line 1321: `const { analyzeBioreactorData } = await import('../../server/bioreactorAnalyticsEngine')`. Page is at `/tools/dyncon`. |
| 3 | `biosensorDesignEngine` | `src/server/biosensorDesignEngine.ts` | **DEAD** | None | No imports found anywhere in `src/` or `app/`. Only referenced by its own test file `__tests__/biosensorDesignEngine.test.ts`. |
| 4 | `cellFreeMetabolicEngine` | `src/server/cellFreeMetabolicEngine.ts` | **REACHABLE** | `cellFreeMetabolicEngine` -> `CellFreePage.tsx` | Dynamic import at line 1810: `const { simulateCellFreePathway } = await import('../../server/cellFreeMetabolicEngine')`. Page is at `/tools/cellfree`. |
| 5 | `circuitCompilerEngine` | `src/server/circuitCompilerEngine.ts` | **REACHABLE** | `circuitCompilerEngine` -> `GECAIRPage.tsx` | Dynamic import at line 1537: `const { compileCircuit } = await import('../../server/circuitCompilerEngine')`. Page is at `/tools/gecair`. |
| 6 | `closedLoopDBTLEngine` | `src/server/closedLoopDBTLEngine.ts` | **REACHABLE** | `closedLoopDBTLEngine` -> `DBTLflowPage.tsx` | Dynamic import at line 1715: `const { createCampaign, runClosedLoopDBTL } = await import('../../server/closedLoopDBTLEngine')`. Page is at `/tools/dbtlflow`. |
| 7 | `consortiumDesignEngine` | `src/server/consortiumDesignEngine.ts` | **DEAD** | None | No imports found anywhere in `src/` or `app/`. Only referenced by its own test file `__tests__/consortiumDesignEngine.test.ts`. |
| 8 | `digitalCellEngine` | `src/server/digitalCellEngine.ts` | **REACHABLE** | `digitalCellEngine` -> `MetabolicEngPage.tsx` | Dynamic import at line 794: `const { simulateDigitalCell } = await import('../../server/digitalCellEngine')`. Page is at `/tools/metabolic-eng` and `/tools/pathd`. |
| 9 | `gemReconstructionEngine` | `src/server/gemReconstructionEngine.ts` | **DEAD** | `gemReconstructionEngine` -> `gemAutomation.ts` -> `modules/gem-automation/index.ts` -> (dead end) | Imported by `src/modules/gem-automation/gemAutomation.ts` (line 19). The module index exports `automateGEM` but nothing outside the module imports it. No page component or API route references `gem-automation`. Only test files reference it. |
| 10 | `mfa13CEngine` | `src/server/mfa13CEngine.ts` | **DEAD** | None | No imports found anywhere in `src/` or `app/`. Only referenced by its own test file `__tests__/mfa13CEngine.test.ts`. |
| 11 | `mlMetabolicEngine` | `src/server/mlMetabolicEngine.ts` | **REACHABLE** | `mlMetabolicEngine` -> `MultiOPage.tsx` | Dynamic import at line 1777: `const { predictEnzymeFunction, predictFluxes } = await import('../../server/mlMetabolicEngine')`. Page is at `/tools/multio`. |
| 12 | `plasmidDesignEngine` | `src/server/plasmidDesignEngine.ts` | **REACHABLE** | `plasmidDesignEngine` -> `CatalystDesignerPage.tsx` | Dynamic import at line 861: `const { designPlasmid } = await import('../../server/plasmidDesignEngine')`. Page is at `/tools/catdes`. |
| 13 | `regulatoryDesignEngine` | `src/server/regulatoryDesignEngine.ts` | **DEAD** | None | No imports found anywhere in `src/` or `app/`. Only referenced by its own test file `__tests__/regulatoryDesignEngine.test.ts`. |
| 14 | `syntheticGenomicsEngine` | `src/server/syntheticGenomicsEngine.ts` | **REACHABLE** | `syntheticGenomicsEngine` -> `GenMIMPage.tsx` | Dynamic import at line 756: `const { optimizeCodonsForHost, computeCAI } = await import('../../server/syntheticGenomicsEngine')`. Page is at `/tools/genmim`. |
| 15 | `MOIEngine` | `src/services/MOIEngine.ts` | **REACHABLE** | `MOIEngine` -> `MultiOPage.tsx` (direct) + `MOIEngine` -> `vaeWorker.ts` -> `useVAEWorker.ts` -> `MultiOPage.tsx` | Direct static import at line 21: `from '../../services/MOIEngine'`. Also imported by `src/workers/vaeWorker.ts` (line 10), which is used by `src/hooks/useVAEWorker.ts`, which is imported by `MultiOPage.tsx`. Page is at `/tools/multio`. |
| 16 | `confidenceEngine` | `src/services/confidenceEngine.ts` | **REACHABLE** | `confidenceEngine` -> `NEXAIPage.tsx` | Static import at line 48: `import { computeConfidenceFromResult } from '../../services/confidenceEngine'`. Page is at `/tools/nexai`. |
| 17 | `safetyEngine` | `src/modules/biosafety/safetyEngine.ts` | **DEAD** | `safetyEngine` -> `modules/biosafety/index.ts` -> (dead end) | The module index exports `assessBiosafety` but nothing outside the module imports it. `src/core/safety/riskModel.ts` is a separate utility that does NOT import safetyEngine. `src/components/safety/RiskPanel.tsx` and `RiskBadge.tsx` import from `riskModel.ts` but are themselves not imported by any page or API route. Only test files reference the engine. |
| 18 | `fluxomicsEngine` | `src/modules/fluxomics/fluxomicsEngine.ts` | **DEAD** | `fluxomicsEngine` -> `modules/fluxomics/index.ts` -> (dead end) | The module index exports `analyzeFluxomics` but nothing outside the module imports it. No page component or API route references `fluxomics`. Only test files reference the engine. |
| 19 | `rnaEngine` | `src/modules/rna-engine/rnaEngine.ts` | **DEAD** | `rnaEngine` -> `modules/rna-engine/index.ts` -> (dead end) | The module index exports `designRNA` but nothing outside the module imports it. No page component or API route references `rna-engine`. Only test files reference the engine. |

---

## Summary

| Classification | Count | Engines |
|----------------|-------|---------|
| **REACHABLE** | 10 | `bioreactorAnalyticsEngine`, `cellFreeMetabolicEngine`, `circuitCompilerEngine`, `closedLoopDBTLEngine`, `digitalCellEngine`, `mlMetabolicEngine`, `plasmidDesignEngine`, `syntheticGenomicsEngine`, `MOIEngine`, `confidenceEngine` |
| **DEAD** | 9 | `bioprocessOptimizationEngine`, `biosensorDesignEngine`, `consortiumDesignEngine`, `gemReconstructionEngine`, `mfa13CEngine`, `regulatoryDesignEngine`, `safetyEngine`, `fluxomicsEngine`, `rnaEngine` |
| **UNCERTAIN** | 0 | None |

---

## Key Findings

1. **The previous grep-based audit was wrong about 10 engines.** The original audit only checked `app/` and `app/api/` for direct filename references. The actual import chains go through `src/components/tools/*Page.tsx` files, which use dynamic `import()` to lazy-load engines. All 10 reachable engines use this pattern.

2. **All reachable engines use dynamic imports.** Every server engine that IS reachable is imported via `await import('../../server/...')` inside page components. This is a Next.js code-splitting pattern -- the engines are bundled into the page chunks at build time, not loaded at runtime.

3. **9 engines are genuinely dead.** These engines exist in the codebase but have no import chain leading to any page component or API route. They are only referenced by their own test files:
   - 5 are in `src/server/`: `bioprocessOptimizationEngine`, `biosensorDesignEngine`, `consortiumDesignEngine`, `mfa13CEngine`, `regulatoryDesignEngine`
   - 1 is in `src/server/` with a dead-end module chain: `gemReconstructionEngine`
   - 3 are in `src/modules/` with dead-end module indexes: `safetyEngine`, `fluxomicsEngine`, `rnaEngine`

4. **Module indexes are dead ends.** The `src/modules/{biosafety,fluxomics,rna-engine,gem-automation}/index.ts` files export their engines' functions, but nothing outside the module directories imports them. These modules appear to be prepared for future integration but are currently unused.

5. **`gemReconstructionEngine` has the deepest dead chain.** It is imported by `gemAutomation.ts`, which is exported by the module index, but the module index itself is never imported by anything outside the module. The chain goes 3 levels deep before hitting a dead end.

---

## Recommendation

The 9 dead engines should be evaluated for one of three dispositions:
- **Delete** if they are genuinely unused and have no planned integration path
- **Wire up** if they were intended to be connected to a page component (check if a matching tool page exists or is planned)
- **Keep as modules** if they are part of a planned module system that will be integrated later (add a TODO comment explaining the plan)
