---
name: multi-agent-reasoning
description: |
  Build multi-agent reasoning pipelines where every numerical conclusion comes from a real solver call.
  LLM agents only translate user intent to parameters and explain real solver outputs — never fabricate values.
  Use this skill when the user wants to: build a pipeline with multiple agents, create a reasoning system,
  design a multi-step optimization workflow, or connect multiple solvers into a decision pipeline.
  Applies to any domain: synthetic biology, protein engineering, circuit design, metabolic optimization, etc.
---

# Multi-Agent Reasoning Framework

## Core Principle (Inviolable)

> LLM agents MUST NOT fabricate numerical judgments. Every numerical conclusion must come from a real solver's actual invocation. The LLM's sole role is to explain real outputs in natural language and propose/adjust parameters for the next solver call.

If a step lacks a real data source or solver, **stop and report** — do not substitute LLM guesses.

## Pipeline Architecture

Every multi-agent reasoning pipeline follows a unidirectional pattern:

```
User Input → Agent A (Proposer) → Agent B (Evaluator) → Agent C (Decider) → Output
```

### Agent Roles

| Agent | Role | LLM Involvement | Solver Dependency |
|-------|------|-----------------|-------------------|
| **A — Proposer** | Translate user intent → structured parameters | HIGH (natural language → parameters) | NONE |
| **B — Evaluator** | Run real solvers on parameters → numerical results | NONE (pure computation) | REQUIRED |
| **C — Decider** | Evaluate candidates → ranked recommendations | LOW (explain results, not decide them) | REQUIRED |

### Data Flow Rules

1. **Agent A → Agent B**: Structured parameters only (JSON/object). No natural language.
2. **Agent B → Agent C**: Numerical results with solver trace. Every number has a source.
3. **Agent C → Output**: Ranked recommendations + LLM explanation. Numbers from solvers, words from LLM.

## Building a Pipeline

### Step 1: Identify Solvers

Before writing any code, map every numerical output to a solver:

```
Output: growth_burden
  Solver: fbaEngine.ts::solveAuthorityFBA
  Method: shadow price approach

Output: eigenvalues
  Solver: jacobianAnalysis.ts::findEigenvalues
  Method: QR algorithm on finite-difference Jacobian

Output: robustness_score
  Solver: robustnessScore.ts::computeRobustness
  Method: 1 - CV(yield) from Monte Carlo trials
```

**If no solver exists for an output, build one or mark the gap.**

### Step 2: Define Interfaces

Each agent has a strict input/output contract:

```typescript
// Agent A output = Agent B input
interface ProposerOutput {
  parameters: Record<string, number>;
  topology?: string;
  constraints?: Record<string, number>;
}

// Agent B output = Agent C input
interface EvaluatorOutput {
  objectives: Record<string, number>;
  constraints: Record<string, { value: number; satisfied: boolean }>;
  solverCalls: Array<{ solver: string; description: string }>;
}

// Agent C output = final result
interface DeciderOutput {
  recommendation: Record<string, number>;
  paretoFront: Array<Record<string, number>>;
  summary: string;  // LLM explanation
}
```

### Step 3: Implement Solver Calls

Every solver call must:
1. Use a real solver (not mock data)
2. Log the solver name and input for traceability
3. Handle errors gracefully (solver failure ≠ LLM fallback)

```typescript
const solverCalls: Array<{ solver: string; description: string }> = [];

// Real solver call
solverCalls.push({ solver: 'fbaEngine::solveAuthorityFBA', description: 'Growth burden from shadow prices' });
const result = await solveAuthorityFBA(params);
```

### Step 4: Build Grid Search (Agent C)

Use the existing `gridSearch.ts` infrastructure:

```typescript
import { runGridSearch } from './gridSearch';

const gridResult = runGridSearch(
  parameterRanges,
  (params) => {
    // Each evaluation calls real solvers
    const physResult = runPhysiologist(params);
    return {
      objectives: { sensitivity: physResult.sensitivity },
      constraints: { burden: { value: physResult.burden, satisfied: physResult.burden < 0.15 } },
    };
  },
  'lhs',  // Latin Hypercube Sampling
  50,     // 50 candidates
);
```

### Step 5: Wire Pipeline

```typescript
export function runPipeline(spec: UserSpec): PipelineResult {
  // Agent A: Propose parameters (LLM or preset)
  const params = proposeParameters(spec);

  // Agent B: Evaluate with real solvers
  const evaluation = evaluateWithSolvers(params);

  // Agent C: Grid search + Pareto ranking
  const decision = runGridSearch(ranges, evaluateWithSolvers);

  return { spec, evaluation, decision, solverCalls: [...] };
}
```

## Reusable Modules

These modules are available in `src/server/` for any pipeline:

| Module | File | Purpose |
|--------|------|---------|
| Grid Search | `gridSearch.ts` | Parameter space sampling + Pareto front |
| Jacobian Analysis | `jacobianAnalysis.ts` | Finite-diff Jacobian + eigenvalue decomposition |
| Sensitivity Analysis | `sensitivityAnalysis.ts` | ∂Y/∂θ normalized sensitivity |
| Robustness Score | `robustnessScore.ts` | Composite scoring from Monte Carlo |
| Parameter Distributions | `parameterDistributions.ts` | Log-normal priors from data |

## Existing Pipeline Templates

### Circuit Reasoner (`circuitReasonerPipeline.ts`)
```
User spec (topology, targets) → circuitBuilder (ODE) → jacobianAnalysis (stability) → gridSearch (Pareto)
```

### Robustness Predictor (`robustnessPipeline.ts`)
```
Single-cell data → parameterDistributions → Monte Carlo ODE → robustnessScore → sensitivityAnalysis
```

### Strain Design Optimizer (template)
```
FBA objectives → OptKnock/FSEOF (knockout/overexpression targets) → gridSearch (Pareto)
```

### Protein Engineering (template)
```
Target enzyme → ddgPrediction (ΔΔG scan) → designSequences (inverse folding) → predictFitness (ranking)
```

## Adding a New Pipeline

1. **Create `src/server/<tool>Pipeline.ts`**
2. **Define interfaces**: ProposerOutput, EvaluatorOutput, DeciderOutput
3. **Map solvers**: Every output → real solver call
4. **Implement Agent B**: Call solvers, collect results with solver trace
5. **Implement Agent C**: Use `gridSearch.ts` for Pareto evaluation
6. **Wire pipeline**: Proposer → Evaluator → Decider
7. **Add honesty test**: Verify no hardcoded mock responses

## Testing Pattern

Every pipeline gets an honesty test:

```typescript
test('pipeline uses real solvers, not mock data', () => {
  const result = runPipeline(testSpec);
  // Every solverCall references a real solver
  expect(result.solverCalls.length).toBeGreaterThan(0);
  // No hardcoded values in output
  expect(result.decision.recommendation).toBeDefined();
  // Pareto front has real evaluations
  expect(result.decision.paretoFront.length).toBeGreaterThan(0);
});
```

## Anti-Patterns

❌ **LLM decides numerical outcomes**: "The burden is probably low"
✅ **Solver computes, LLM explains**: "The FBA solver computed burden = 0.12, which is below the 0.15 threshold"

❌ **Mock data as real output**: Hardcoded growth rate
✅ **Real solver trace**: solverCalls shows fbaEngine::solveAuthorityFBA was called

❌ **LLM ranks candidates by "judgment"**: "I think option B is best"
✅ **Pareto front ranks by computation**: gridSearch evaluated 50 candidates, 7 are Pareto-optimal
