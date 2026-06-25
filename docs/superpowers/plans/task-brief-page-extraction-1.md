# Task Brief: Page Extraction Batch 1 (4 pages)

Extract 4 large tool pages into sub-components. Each page follows the same pattern:
- Create a directory under `src/components/tools/<name>/`
- Extract logical sections into separate files (≤500 lines each)
- Keep the main page as an orchestrator (≤500 lines)
- Preserve ALL existing functionality — pure refactor
- Run `npx tsc --noEmit` after each extraction

## Pages to extract:

### 1. ProEvolPage.tsx (2282 lines)
**File:** `src/components/tools/ProEvolPage.tsx`
Create: `src/components/tools/proevol/`
Suggested: FitnessLandscape.tsx, EvolutionTrajectory.tsx, BasinClimbing.tsx, SequenceDiversity.tsx, useProEvolState.ts

### 2. CellFreePage.tsx (1931 lines)
**File:** `src/components/tools/CellFreePage.tsx`
Create: `src/components/tools/cellfree/`
Suggested: GeneConstruct.tsx, ExpressionYield.tsx, EnergySystem.tsx, CellFreeVisualization.tsx, useCellFreeState.ts

### 3. DBTLflowPage.tsx (1814 lines)
**File:** `src/components/tools/DBTLflowPage.tsx`
Create: `src/components/tools/dbtlflow/`
**NOTE: This file is FORBIDDEN — do NOT modify its logic. Only extract sub-components.**
Suggested: IterationWaterfall.tsx, ProtocolGenerator.tsx, SBOLSerializer.tsx, useDBTLState.ts

### 4. DynConPage.tsx (1794 lines)
**File:** `src/components/tools/DynConPage.tsx`
Create: `src/components/tools/dyncon/`
Suggested: BioreactorSim.tsx, HillFeedback.tsx, ConvergenceAnalysis.tsx, useDynConState.ts

## Constraints
- Do NOT modify any algorithm logic — pure structural refactor
- DBTLflowPage.tsx is FORBIDDEN — extract only, no behavior changes
- Each sub-component ≤500 lines
- Main orchestrator ≤500 lines
- Run `npx tsc --noEmit` and `npx jest --no-coverage --forceExit --testPathIgnorePatterns="e2e|streaming|performanceBenchmark|scspatialApi|fetchWithFallback"` after all extractions
