# Nexus-Bio Tool Pipeline Presets

Each tool maps to a multi-agent pipeline with specific solver assignments.

---

## 1. FBAsim — Strain Design Optimizer

```
Agent A (Designer): Propose knockout/overexpression targets
Agent B (Simulator): Run FBA/FVA/pFBA on each strategy
Agent C (Optimizer): Grid search → Pareto front of yield vs growth
```

| Output | Solver | File |
|--------|--------|------|
| growth_rate | fbaEngine::solveAuthorityFBA | src/server/fbaEngine.ts |
| flux_ranges | fbaFVA::runFVA | src/server/fbaFVA.ts |
| min_flux | fbaPFBA::runPFBA | src/server/fbaPFBA.ts |
| knockout_targets | fbaOptKnock::runOptKnock | src/server/fbaOptKnock.ts |
| overexpression_targets | fbaFSEOF::runFSEOF | src/server/fbaFSEOF.ts |

**Pipeline file:** `src/server/fbaStrainPipeline.ts` (to build)

---

## 2. ProEvol — Protein Engineering

```
Agent A (Designer): Propose mutation candidates
Agent B (Predictor): Run ΔΔG + fitness + conservation
Agent C (Selector): Rank by Pareto (stability, fitness, diversity)
```

| Output | Solver | File |
|--------|--------|------|
| ddg | ddgPrediction::predictDDG | src/server/ddgPrediction.ts |
| fitness | ProEvolCampaignEngine::predictFitness | src/services/ProEvolCampaignEngine.ts |
| conservation | ProEvolCampaignEngine::analyzeConservation | src/services/ProEvolCampaignEngine.ts |
| sequences | ProEvolCampaignEngine::designSequences | src/services/ProEvolCampaignEngine.ts |

**Pipeline file:** `src/server/proevolPipeline.ts` (to build)

---

## 3. DynCon — Dynamic Control Optimizer

```
Agent A (Designer): Propose PID/MPC controller parameters
Agent B (Simulator): Run ODE simulation with controller
Agent C (Optimizer): Grid search → Pareto (settling time, overshoot, steady-state error)
```

| Output | Solver | File |
|--------|--------|------|
| trajectory | odeSolver::solveRK4 | src/utils/odeSolver.ts |
| stability | jacobianAnalysis::analyzeStability | src/server/jacobianAnalysis.ts |
| control_cost | modelPredictiveControl::solve | src/server/modelPredictiveControl.ts |
| sensitivity | sensitivityAnalysis::computeSensitivity | src/server/sensitivityAnalysis.ts |

**Pipeline file:** `src/server/dynconPipeline.ts` (to build)

---

## 4. CETHX — Thermodynamic Feasibility

```
Agent A (Designer): Propose pathway modifications
Agent B (Calculator): Run TFA + group contribution
Agent C (Optimizer): Rank by thermodynamic feasibility + yield
```

| Output | Solver | File |
|--------|--------|------|
| deltaG | tfaEngine::runTFA | src/server/tfaEngine.ts |
| transformed_gibbs | thermoEngine::calcTransformedGibbs | src/services/thermoEngine.ts |
| group_contribution | groupContribution::calcGroupContribution | src/utils/groupContribution.ts |
| feasibility | tfaEngine::checkFeasibility | src/server/tfaEngine.ts |

**Pipeline file:** `src/server/cethxPipeline.ts` (to build)

---

## 5. GECAIR — Gene Circuit Reasoner

**Status:** ✅ Already implemented

**Pipeline file:** `src/server/circuitReasonerPipeline.ts`

---

## 6. CellFree — Robustness Predictor

**Status:** ✅ Already implemented

**Pipeline file:** `src/server/robustnessPipeline.ts`

---

## 7. GenMIM — Genome Minimization

```
Agent A (Planner): Propose gene knockdown schedule
Agent B (Simulator): Run FBA with knockdowns applied
Agent C (Optimizer): Maximize growth while minimizing genome
```

| Output | Solver | File |
|--------|--------|------|
| growth_rate | fbaEngine::solveAuthorityFBA | src/server/fbaEngine.ts |
| essential_genes | fbaGPR::getKnockoutReactions | src/server/fbaGPR.ts |
| burden | fbaEngine::computeBurden | src/server/fbaEngine.ts |

**Pipeline file:** `src/server/genmimPipeline.ts` (to build)

---

## 8. MultiO — Multi-Omics Integration

```
Agent A (Analyzer): Select integration parameters
Agent B (Integrator): Run VAE/PCA + MOFA+ factorization
Agent C (Interpreter): Identify significant factors + pathways
```

| Output | Solver | File |
|--------|--------|------|
| factors | mofaPlus::runMOFA | src/server/mofaPlus.ts |
| embedding | vaeONNX::encode | src/services/vaeONNX.ts |
| clusters | ScSpatialEngine::louvainCluster | src/services/ScSpatialEngine.ts |

**Pipeline file:** `src/server/multioPipeline.ts` (to build)

---

## 9. ScSpatial — Single-Cell Spatial

```
Agent A (Processor): Select QC + normalization parameters
Agent B (Analyzer): Run clustering + spatial statistics
Agent C (Interpreter): Identify spatially variable genes + domains
```

| Output | Solver | File |
|--------|--------|------|
| clusters | ScSpatialEngine::louvainCluster | src/services/ScSpatialEngine.ts |
| spatial_autocorrelation | ScSpatialEngine::moransI | src/services/ScSpatialEngine.ts |
| trajectory | ScSpatialEngine::pagaTrajectory | src/services/ScSpatialEngine.ts |

**Pipeline file:** `src/server/scspatialPipeline.ts` (to build)

---

## 10. NEXAI — AI Research Agent

```
Agent A (Searcher): Propose search queries + filters
Agent B (Analyzer): Run citation verification + relevance scoring
Agent C (Synthesizer): Rank papers + extract key findings
```

| Output | Solver | File |
|--------|--------|------|
| citation_score | citationVerifier::verifyCitation | src/services/citationVerifier.ts |
| relevance | SemanticSearch::scoreRelevance | src/components/SemanticSearch.ts |

**Pipeline file:** `src/server/nexaiPipeline.ts` (to build)

---

## 11. DBTLflow — DBTL Cycle Tracker

Not a computation tool — tracks experimental workflow. No pipeline needed.

---

## 12. PathD — Pathway Designer

Wraps MetabolicEngPage. Pipeline is the same as FBAsim + CETHX combined.

---

## Implementation Priority

| Priority | Tool | Status | Effort |
|----------|------|--------|--------|
| 1 | GECAIR | ✅ Done | — |
| 1 | CellFree | ✅ Done | — |
| 2 | FBAsim | 🔲 To build | Medium |
| 2 | ProEvol | 🔲 To build | Medium |
| 3 | DynCon | 🔲 To build | Medium |
| 3 | CETHX | 🔲 To build | Low |
| 4 | GenMIM | 🔲 To build | Low |
| 4 | MultiO | 🔲 To build | Medium |
| 5 | ScSpatial | 🔲 To build | Medium |
| 5 | NEXAI | 🔲 To build | Low |
