# Task Brief: Page Extraction Batch 2 (4 pages)

Extract 4 large tool pages into sub-components. Same pattern as Batch 1.

## Pages to extract:

### 1. GenMIMPage.tsx (1670 lines)
**File:** `src/components/tools/GenMIMPage.tsx`
Create: `src/components/tools/genmim/`
Suggested: CRISPRiScheduler.tsx, GenomeMap.tsx, EfficiencyHeatmap.tsx, useGenMIMState.ts

### 2. GECAIRPage.tsx (1631 lines)
**File:** `src/components/tools/GECAIRPage.tsx`
Create: `src/components/tools/gecair/`
**NOTE: This file is FORBIDDEN — do NOT modify its logic. Only extract sub-components.**
Suggested: LogicGateDesigner.tsx, HillCurveModeler.tsx, CircuitDynamics.tsx, useGECAIRState.ts

### 3. FBASimPage.tsx (1631 lines)
**File:** `src/components/tools/FBASimPage.tsx`
Create: `src/components/tools/fbasim/`
Suggested: SingleSpeciesFBA.tsx, CommunityFBA.tsx, StrainDesign.tsx, FBAVisualization.tsx, useFBASimState.ts

### 4. CETHXPage.tsx (1501 lines)
**File:** `src/components/tools/CETHXPage.tsx`
Create: `src/components/tools/cethx/`
Suggested: WaterfallCascade.tsx, ATPAccounting.tsx, PathwayFeasibility.tsx, TFAAnalysis.tsx, useCETHXState.ts

## Constraints
- Do NOT modify any algorithm logic — pure structural refactor
- GECAIRPage.tsx is FORBIDDEN — extract only, no behavior changes
- Each sub-component ≤500 lines
- Main orchestrator ≤500 lines
- Run `npx tsc --noEmit` and `npx jest --no-coverage --forceExit --testPathIgnorePatterns="e2e|streaming|performanceBenchmark|scspatialApi|fetchWithFallback"` after all extractions
