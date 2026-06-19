# Multi-Agent Reasoning System — Design Spec

**Date:** 2026-06-19
**Scope:** 2 features, 6 new modules, integration with 8 existing solvers
**Core Constraint:** Every numerical conclusion must come from a real solver call. LLM only explains outputs and proposes parameters.

---

## Inviolable Principle

> LLM agents MUST NOT fabricate numerical judgments (burden scores, stability claims, robustness scores). Every numerical conclusion must come from a real solver's actual invocation. The LLM's sole role is to explain real outputs in natural language and propose/adjust parameters for the next solver call. If a step lacks a real data source or solver, stop and report — do not substitute LLM guesses.

This aligns with the existing validity badge system: unsupported claims are labeled "demo", not "real".

---

## Feature 1: Gene Circuit Reasoner

### Overview

A unidirectional pipeline (NOT multi-round debate) with three agents:

```
User spec → Agent A (Designer) → Agent B (Physiologist) → Agent C (Judge) → Output
```

Each agent has a strict boundary: what it receives, what it computes, what it outputs.

### Agent A — Designer

**Role:** Translate user circuit specification into structured parameters.

**Input:** User specification (topology type, sensitivity target, burden limit)

**Output:** Structured parameter set:
```typescript
interface CircuitParameters {
  topology: 'toggle_switch' | 'repressilator' | 'logic_cascade' | 'custom';
  promoters: Array<{ id: string; strength: number; }>;    // relative units
  rbs: Array<{ id: string; strength: number; }>;           // relative units
  copyNumber: number;
  degradationRates: Record<string, number>;                // min⁻¹
  hillCoefficients: Record<string, number>;                // dimensionless
  kdValues: Record<string, number>;                        // nM
}
```

**LLM role:** Translate user intent → parameter candidates. No numerical computation.

**Solver dependency:** NONE. Agent A is pure parameter generation.

**Existing infrastructure:** None needed. This is LLM translation only.

### Agent B — Physiologist

**Role:** Take Agent A's parameters, run real solvers, produce real numerical outputs.

**Input:** Agent A's `CircuitParameters`

**Output:**
```typescript
interface PhysiologistOutput {
  // From ODE solver
  trajectories: { time: number[]; species: Record<string, number[]>; };
  steadyState: Record<string, number>;
  period: number | null;        // min, null if non-oscillatory
  amplitude: number | null;     // nM, null if non-oscillatory
  dutyCycle: number | null;     // fraction, null if non-oscillatory

  // From Jacobian analysis
  jacobian: number[][];
  eigenvalues: number[];        // real parts
  maxEigenvalue: number;
  isStable: boolean;            // all eigenvalues < 0

  // From FBA/resource allocation
  growthBurden: number;         // fraction (0-1)
  growthRate: number;           // h⁻¹
  ribosomeBurden: number;       // fraction of ribosome pool

  // Metadata
  solverCalls: Array<{ solver: string; input: string; output: string; }>;
}
```

**Step 1: Build ODE system from parameters**

- Solver: `mockGECAIR.ts` (Hill functions) + new `circuitBuilder.ts`
- Action: Map `CircuitParameters` → ODE system (dy/dt = f(t, y))
- For toggle switch: 4 variables (2 mRNA + 2 proteins), mutual repression
- For repressilator: 6 variables (3 mRNA + 3 proteins), ring repression
- For logic cascade: 6 variables (3 mRNA + 3 proteins), linear repression

**Step 2: Run ODE to steady state**

- Solver: `odeSolver.ts::solveRK4`
- Parameters: dt = 0.01 min, t_max = 500 min, initial conditions from parameters
- Output: time-series trajectories for all species

**Step 3: Extract steady-state features**

- Computation: From ODE output, extract period (zero-crossing detection), amplitude (max-min), duty cycle (time above half-max / period)
- Solver dependency: Pure post-processing of ODE output
- Action: Deterministic computation, no LLM involvement

**Step 4: Compute growth burden**

- Solver: `fbaEngine.ts::solveAuthorityFBA` (shadow price approach)
- Alternative: `CellFreeEngine.ts::simulateCFPS` (ribosome competition)
- Method: Map circuit parameters to metabolic cost:
  - Promoter strength → mRNA production rate → ribosome occupancy
  - Copy number → DNA replication cost
  - Protein size → translation cost (5 ATP per amino acid)
- Output: `growthBurden` (0-1 fraction)

**Step 5: Jacobian eigenvalue analysis**

- Solver: New `jacobianAnalysis.ts`
- Method: Finite-difference Jacobian at steady state
  - J_ij = (f_i(y + h*e_j) - f_i(y)) / h, where h = 1e-6
- Eigenvalue computation: Power iteration for largest eigenvalue (sufficient for stability check)
- Output: eigenvalues, maxEigenvalue, isStable (all < 0)

### Agent C — Judge

**Role:** Evaluate candidate designs against the objective function using real solver outputs.

**Input:** Agent A's parameters + Agent B's `PhysiologistOutput`

**Output:**
```typescript
interface JudgeOutput {
  // Objective function evaluation
  sensitivity: number;          // from ODE output
  burdenSatisfied: boolean;     // burden < threshold
  stabilitySatisfied: boolean;  // maxEigenvalue < 0

  // Pareto evaluation
  paretoFront: Array<{
    parameters: CircuitParameters;
    sensitivity: number;
    burden: number;
    isStable: boolean;
    dominated: boolean;
  }>;

  // Final recommendation
  recommendedDesign: CircuitParameters;
  recommendation: string;       // LLM explanation of the real numbers
}
```

**Step 1: Define objective function**

- Maximize: sensitivity (from ODE steady-state output)
- Constraint: growthBurden < threshold (from Agent B's FBA output)
- Constraint: maxEigenvalue < 0 (from Agent B's Jacobian analysis)
- This is a mathematical definition, not an LLM judgment

**Step 2: Grid search / Pareto frontier**

- Solver: New `gridSearch.ts`
- Method:
  1. Generate N parameter sets (Latin hypercube sampling or grid)
  2. For each set, run full Agent B pipeline (ODE → burden → Jacobian)
  3. Collect (sensitivity, burden, stability) triples
  4. Build Pareto front (non-dominated solutions)
  5. Select best by weighted composite: 0.6*sensitivity + 0.2*(1-burden) + 0.2*stability
- Each evaluation calls real solvers — no LLM estimation

**Step 3: Output recommendation**

- LLM role: Explain why the recommended design is optimal, using the real numbers from the grid search
- The recommendation is determined by the Pareto computation, not by LLM "opinion"

---

## Feature 2: Cell-Free Robustness Predictor

### Overview

A unidirectional pipeline with three agents:

```
Construct + Parameters → Agent A (Ideal) → Agent B (Quality Inspector) → Agent C (Optimizer) → Report
```

### Agent A — Ideal Simulator

**Role:** Run cell-free simulation under nominal/ideal conditions, no noise.

**Input:** Gene constructs + nominal parameters

**Output:**
```typescript
interface IdealSimulation {
  trajectory: { time: number[]; proteinConc: number[]; };
  yield: number;                // final protein concentration (nM)
  timeToHalfMax: number;        // min
  peakConc: number;             // nM
  steadyStateConc: number;      // nM
}
```

**Solver:** `CellFreeEngine.ts::simulateCFPS`
- RK4 ODE with resource competition (ribosome, ATP, amino acids)
- No modifications needed — use as-is
- Parameters: `generateDefaultParameters()` or user-provided

### Agent B — Quality Inspector

**Role:** Inject real biological noise (from single-cell data) and run Monte Carlo perturbation.

**Input:** Agent A's nominal parameters + source organism single-cell data

**Output:**
```typescript
interface MonteCarloResults {
  trials: Array<{
    parameters: Record<string, number>;     // perturbed parameters
    yield: number;
    timeToHalfMax: number;
    peakConc: number;
    converged: boolean;                      // ODE reached steady state
  }>;
  yieldDistribution: { mean: number; std: number; cv: number; };
  timingDistribution: { mean: number; std: number; cv: number; };
  convergenceRate: number;                   // fraction of trials that converged
}
```

**Step 1: Build parameter distributions from single-cell data**

- Data source: `ScSpatialEngine.ts` (single-cell expression data)
- Method: Extract per-gene expression mean and CV from single-cell dataset
- Map: expression CV → parameter uncertainty
  - k_tx CV ≈ expression CV (mRNA production rate tracks expression)
  - k_tl CV ≈ 0.5 * expression CV (translation is more buffered)
  - d_mRNA CV ≈ 0.3 * expression CV (degradation is more constrained)
- Distribution type: Log-normal (ensures positive parameters)
- Solver dependency: Real single-cell data → real distribution parameters

**Step 2: Monte Carlo perturbation**

- Solver: `CellFreeEngine.ts::simulateCFPS` (N times, N ≥ 1000)
- Perturbation: Sample each parameter from its log-normal distribution
- Extended parameter set (not just 3):
  - k_tx (mRNA production rate)
  - k_tl (translation rate)
  - d_mRNA (mRNA degradation)
  - d_protein (protein degradation)
  - K_tl (translation Michaelis constant)
  - energy_decay (ATP depletion rate)
  - Rnap_activity (RNA polymerase activity)
  - AA_conc (amino acid concentrations)
  - DNA_conc (template DNA concentration)
  - temperature
- Convergence check: Gelman-Rubin R-hat < 1.1 for each output metric

**Step 3: Convergence diagnostics**

- Method: Split N trials into M chains, compute within-chain and between-chain variance
- R-hat = sqrt((W*(n-1)/n + B/n) / W) where W = within-chain var, B = between-chain var
- If R-hat > 1.1, increase N and re-run

### Agent C — Optimizer

**Role:** Compute explicit robustness score from Monte Carlo results.

**Input:** Agent A's ideal simulation + Agent B's Monte Carlo results

**Output:**
```typescript
interface RobustnessReport {
  // Component scores (all 0-1)
  yieldRobustness: number;      // 1 - CV(yield)
  timingRobustness: number;     // 1 - CV(timeToHalfMax)
  energyRobustness: number;     // 1 - |dYield/dATP|
  resourceRobustness: number;   // 1 - sensitivity to ribosome saturation

  // Composite score
  overallRobustness: number;    // weighted combination

  // Sensitivity analysis
  parameterSensitivity: Record<string, number>;  // ∂Y/∂θ for each parameter

  // Formula documentation
  formulas: Record<string, string>;  // human-readable formula for each score

  // LLM interpretation
  interpretation: string;       // LLM explains the numbers
}
```

**Step 1: Compute component scores**

- yieldRobustness = 1 - CV(yield), where CV = std/mean from Monte Carlo
- timingRobustness = 1 - CV(timeToHalfMax)
- energyRobustness: perturb ATP-related parameters by ±10%, measure yield change
  - Solver: `CellFreeEngine.ts::simulateCFPS` with perturbed ATP parameters
  - energyRobustness = 1 - |ΔY/Y| / |ΔATP/ATP|
- resourceRobustness: perturb ribosome-related parameters by ±10%, measure yield change
  - Solver: `CellFreeEngine.ts::simulateCFPS` with perturbed ribosome parameters
  - resourceRobustness = 1 - |ΔY/Y| / |ΔRib/Rib|

**Step 2: Parameter sensitivity analysis**

- Method: Finite-difference sensitivity (∂Y/∂θ)
- For each parameter θ_i:
  1. Run simulation with θ_i + h (h = 5% of nominal)
  2. Run simulation with θ_i - h
  3. Sensitivity_i = (Y(θ_i + h) - Y(θ_i - h)) / (2h) * (θ_i / Y)
- Solver: `CellFreeEngine.ts::simulateCFPS` (2 calls per parameter)
- Output: normalized sensitivity for each parameter

**Step 3: Composite robustness score**

- Formula: R_total = 0.4*R_yield + 0.3*R_timing + 0.15*R_energy + 0.15*R_resource
- All inputs come from real solver outputs
- Weights are documented and configurable

**Step 4: LLM interpretation**

- LLM role: Explain what the robustness score means in biological terms
- LLM MUST NOT adjust the score — it reads the numbers and explains them
- Example: "The yield robustness of 0.72 indicates that parameter uncertainty causes ±28% variation in protein yield. The primary sensitivity is to k_tx (sensitivity = 0.85), suggesting that mRNA production rate is the dominant source of uncertainty."

---

## New Modules to Build

| Module | File | Feature | Purpose | Complexity |
|--------|------|---------|---------|------------|
| Circuit Builder | `src/server/circuitBuilder.ts` | 1 | Parameters → ODE system | Medium |
| Jacobian Analysis | `src/server/jacobianAnalysis.ts` | 1 | Finite-diff Jacobian + eigenvalues | Medium |
| Grid Search | `src/server/gridSearch.ts` | 1 | Parameter space sampling + evaluation | Medium |
| Parameter Distributions | `src/server/parameterDistributions.ts` | 2 | Single-cell → parameter priors | Medium |
| Robustness Score | `src/server/robustnessScore.ts` | 2 | Composite robustness scoring | Low |
| Sensitivity Analysis | `src/server/sensitivityAnalysis.ts` | 2 | Finite-diff ∂Y/∂θ | Medium |

## Existing Modules to Reuse

| Module | File | Used By | Purpose |
|--------|------|---------|---------|
| Hill Functions | `src/data/mockGECAIR.ts` | Feature 1 | hillInhibition, hillActivation |
| ODE Solver | `src/utils/odeSolver.ts` | Both | solveRK4 |
| FBA Engine | `src/server/fbaEngine.ts` | Feature 1 | Growth burden via shadow prices |
| CellFree Engine | `src/services/CellFreeEngine.ts` | Feature 2 | simulateCFPS |
| ScSpatial Engine | `src/services/ScSpatialEngine.ts` | Feature 2 | Single-cell expression data |
| Statistics | `src/utils/statistics.ts` | Both | CV, std, entropy |
| MPC Linearization | `src/server/modelPredictiveControl.ts` | Feature 1 | Jacobian logic reference |
| Pareto Ranking | `src/services/CatalystDesignerEngine.ts` | Feature 1 | rankPathways reference |
| Seeded RNG | `src/utils/seededRng.ts` | Both | Reproducible Monte Carlo |

## Data Flow: Where Each Number Comes From

Every number in the output has a traceable path to a solver:

```
Feature 1:
  sensitivity      → odeSolver.ts::solveRK4 → steady-state extraction
  growthBurden     → fbaEngine.ts::solveAuthorityFBA → shadow price
  eigenvalues      → jacobianAnalysis.ts → power iteration
  paretoRanking    → gridSearch.ts → enumerate + rankPathways

Feature 2:
  yield            → CellFreeEngine.ts::simulateCFPS
  timeToHalfMax    → CellFreeEngine.ts::simulateCFPS → zero-crossing
  CV(yield)        → statistics.ts::std / statistics.ts::mean
  sensitivity(θ)   → sensitivityAnalysis.ts → finite difference
  R_total          → robustnessScore.ts → weighted combination
```

No number is produced by LLM inference. The LLM's only output is natural language explanation.

## Testing Strategy

### Unit Tests

Each new module gets a test file:
- `__tests__/circuitBuilder.test.ts` — verify ODE system construction from parameters
- `__tests__/jacobianAnalysis.test.ts` — verify eigenvalues against known analytical solutions
- `__tests__/gridSearch.test.ts` — verify Pareto front correctness
- `__tests__/parameterDistributions.test.ts` — verify log-normal sampling statistics
- `__tests__/robustnessScore.test.ts` — verify score components sum correctly
- `__tests__/sensitivityAnalysis.test.ts` — verify finite-difference accuracy

### Integration Tests

- Feature 1: End-to-end test with toggle switch topology → verify sensitivity > 0, burden < 1, eigenvalues < 0
- Feature 2: End-to-end test with default constructs → verify 0 < R_total < 1

### Honesty Tests

Following the existing `cellfreeHonesty`, `cethxHonesty` pattern:
- `__tests__/circuitReasonerHonesty.test.ts` — verify no hardcoded mock responses, all values come from solvers
- `__tests__/robustnessPredictorHonesty.test.ts` — verify Monte Carlo results are non-deterministic (seeded RNG), not fixed

## Success Criteria

- All 6 new modules implemented and tested
- `npx tsc --noEmit` passes
- `npm test` passes
- `npm run build` succeeds
- Feature 1: Toggle switch example produces sensitivity, burden, eigenvalues from real solvers
- Feature 2: Cell-free example produces R_total from real Monte Carlo simulation
- Honesty tests verify no LLM-fabricated numbers
