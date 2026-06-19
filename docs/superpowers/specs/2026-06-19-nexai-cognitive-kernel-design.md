# NEXAI Cognitive Kernel — Design Spec

**Date:** 2026-06-19
**Scope:** Upgrade NEXAI from "LLM wrapper" to "solver-orchestrated cognitive kernel"
**Target users:** Researchers, PhD students, enterprise consultants
**Constraint:** Cost-effective (limited API budget), keep existing architecture

---

## Core Principle

> The LLM never fabricates numerical conclusions. It orchestrates real solvers, interprets their outputs, and presents results in natural language. For computational questions, the solver IS the brain — the LLM is the voice.

---

## Architecture: 4-Layer Cognitive Kernel

```
┌─────────────────────────────────────────────────────────────┐
│                    Layer 4: PRESENTATION                     │
│  Streaming output · Citation grounding · Confidence badges   │
│  Template-based responses · Export formats                   │
└─────────────────────────────────────────────────────────────┘
                              ▲
┌─────────────────────────────────────────────────────────────┐
│                    Layer 3: REASONING                        │
│  LLM synthesis · Multi-step planning · Self-correction      │
│  Only invoked for OPEN questions that solvers can't answer   │
└─────────────────────────────────────────────────────────────┘
                              ▲
┌─────────────────────────────────────────────────────────────┐
│                    Layer 2: ORCHESTRATION                    │
│  AxonOrchestrator · Pipeline routing · Adapter registry     │
│  Dependency scheduling · Retry · Cost tracking               │
│  ALL 14 tools have real adapters (via pipelines)             │
└─────────────────────────────────────────────────────────────┘
                              ▲
┌─────────────────────────────────────────────────────────────┐
│                    Layer 1: PERCEPTION                       │
│  Intent classification · Domain routing · Query parsing      │
│  Solver vs LLM decision · Workbench context injection        │
│  Response cache lookup                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Layer 1: PERCEPTION — Intelligent Routing

### Current State
- `axonDomainClassifier.ts`: 6 categories, keyword-based
- `axonIntentRouter.ts`: Only routes PATHD and FBASIM
- No solver-vs-LLM decision logic
- No response caching

### Upgrade: Cognitive Router

**New file:** `src/services/cognitiveRouter.ts`

The router classifies every query into one of 4 execution tiers:

```
Tier 0: CACHE HIT → return cached response (zero cost)
Tier 1: SOLVER DIRECT → call pipeline solver, template response (zero LLM cost)
Tier 2: SOLVER + LLM EXPLAIN → call solver, LLM explains result (low cost)
Tier 3: LLM REASONING → full LLM call with context (standard cost)
```

**Classification logic:**
```
Is this a computational question?
  ├─ "What is the growth rate?" → Tier 1 (solver direct)
  ├─ "What is the growth rate and why?" → Tier 2 (solver + LLM explain)
  ├─ "What should I do next?" → Tier 3 (LLM reasoning)
  └─ Same question as 5 minutes ago? → Tier 0 (cache hit)
```

**Keyword-to-solver mapping (extends existing axonIntentRouter):**

| Intent | Solver | Pipeline |
|--------|--------|----------|
| "bottleneck" / "rate-limiting" | identifyBottlenecks | fbaStrainPipeline |
| "growth rate" / "FBA" / "flux" | solveAuthorityFBA | fbaStrainPipeline |
| "stability" / "ΔΔG" / "mutation" | predictDDG | proevolPipeline |
| "robustness" / "Monte Carlo" | computeRobustness | robustnessPipeline |
| "circuit" / "oscillator" / "toggle" | simulateCircuit | circuitReasonerPipeline |
| "thermodynamic" / "ΔG" / "feasible" | runTFA | cethxPipeline |
| "control" / "PID" / "bioreactor" | solveRK4 | dynconPipeline |
| "cluster" / "spatial" / "single-cell" | analyzeClusters | scspatialPipeline |
| "multi-omics" / "factor" / "MOFA" | runMOFA | multioPipeline |
| "genome" / "CRISPRi" / "knockdown" | greedyKnockdownSchedule | genmimPipeline |
| "cell-free" / "TX-TL" / "expression" | simulateCFPS | robustnessPipeline |

**Response cache:**
- Key: hash(query + workbenchContext)
- TTL: 5 minutes (solver results are deterministic)
- Storage: in-memory Map (Edge Runtime compatible)
- Hit rate expected: ~30% for repeated queries during same session

---

## Layer 2: ORCHESTRATION — Full Tool Coverage

### Current State
- Only 2/14 tools have real adapters (pathd, fbasim)
- 12 tools are stubs that throw "unsupported"
- No pipeline integration

### Upgrade: Register All 10 Pipelines as Adapters

**Modified file:** `src/services/axonAdapterRegistry.ts`

Register adapters for all 14 tools by wiring the 10 pipelines we built:

```typescript
const PIPELINE_ADAPTERS: AxonAdapterMap = {
  // Existing (keep as-is)
  pathd: pathdAdapter,
  fbasim: fbasimAdapter,

  // New — wired to pipelines
  proevol:    buildPipelineAdapter(runProteinDesignPipeline),
  dyncon:     buildPipelineAdapter(runControlDesignPipeline),
  cethx:      buildPipelineAdapter(runThermodynamicPipeline),
  gecair:     buildPipelineAdapter(runCircuitReasonerPipeline),
  cellfree:   buildPipelineAdapter(runRobustnessPredictorPipeline),
  genmim:     buildPipelineAdapter(runMinimizationPipeline),
  multio:     buildPipelineAdapter(runMultiOmicsPipeline),
  scspatial:  buildPipelineAdapter(runScSpatialPipeline),
  nexai:      buildPipelineAdapter(runResearchPipeline),  // meta: uses other tools
  dbtlflow:   null,  // not a computation tool — workflow tracker
};
```

**Generic pipeline adapter factory:**
```typescript
function buildPipelineAdapter<P, R>(pipeline: (input: P) => R): AxonAdapter {
  return async (input, ctx) => {
    const result = pipeline(input as P);
    return { result, solverCalls: result.allSolverCalls };
  };
}
```

### Upgrade: Dynamic Re-planning on Failure

**Modified file:** `src/services/axonPlanner.ts`

When a plan step fails, the planner re-evaluates:
1. Can the step be retried? (max 2 retries)
2. Can an alternative tool accomplish the same goal?
3. Should the plan be simplified?

```
Step failed: fbasim (FBA solver error)
  → Retry 1: fbasim with different parameters
  → Retry 2: fbasim with simplified model
  → Re-plan: skip fbasim, continue with remaining steps
```

---

## Layer 3: REASONING — LLM Only When Needed

### Current State
- Every query hits the LLM provider
- No tiered execution
- No self-correction
- Static system prompts

### Upgrade: Tiered Execution Engine

**New file:** `src/services/tieredExecutor.ts`

```
Tier 0: Cache Hit
  Input: query hash
  Output: cached response
  Cost: $0
  Latency: <10ms

Tier 1: Solver Direct
  Input: parsed intent + parameters
  Pipeline: call solver → format result with template
  Output: structured result + template explanation
  Cost: $0 (no LLM call)
  Latency: 100-500ms
  Example: "What is the growth rate?" → FBA solver → "Growth rate: 0.42 h⁻¹"

Tier 2: Solver + LLM Explain
  Input: parsed intent + parameters + solver result
  Pipeline: call solver → send result + context to LLM → LLM explains
  Output: natural language explanation grounded in real numbers
  Cost: ~$0.0003 (small prompt, short response)
  Latency: 1-3s
  Example: "Why is the growth rate low?" → FBA solver → LLM: "The growth rate of
           0.42 h⁻¹ is constrained by the oxygen uptake rate. The shadow price of
           O2 is -0.85, indicating that increasing O2 availability would improve growth."

Tier 3: LLM Reasoning
  Input: full context + conversation history
  Pipeline: full LLM call with workbench context
  Output: open-ended synthesis, recommendations, explanations
  Cost: ~$0.001 (full prompt, longer response)
  Latency: 3-8s
  Example: "What should I do next to improve my strain?" → LLM analyzes all
           available tool results and makes a recommendation
```

**Decision logic:**
```typescript
function selectTier(query: string, intent: IntentRoute): ExecutionTier {
  // Tier 0: cache check
  if (cache.has(queryHash)) return 'cache';

  // Tier 1: pure computation, no "why" or "explain"
  if (intent.kind === 'compute' && !hasExplanationRequest(query)) return 'solver-direct';

  // Tier 2: computation + explanation
  if (intent.kind === 'compute' && hasExplanationRequest(query)) return 'solver-explain';

  // Tier 3: open-ended reasoning
  return 'llm-reasoning';
}
```

### Upgrade: Self-Correction Loop

**New file:** `src/services/selfCorrection.ts`

When the LLM makes a numerical claim, verify it against solver output:

```
LLM output: "The growth rate is approximately 0.5 h⁻¹"
Solver output: growthRate = 0.42 h⁻¹
Correction: "The growth rate is 0.42 h⁻¹ (solver-computed)"
```

**Implementation:**
1. LLM generates response
2. Extract numerical claims from response
3. Compare against solver cache
4. If discrepancy > 10%, inject correction note
5. Log the discrepancy for prompt improvement

### Upgrade: Adaptive Prompt Engineering

**Modified file:** `app/api/analyze/route.ts`

Dynamic system prompt based on query type:

```
Computational query → "You are a data interpreter. The solver has computed
  the following results. Explain them accurately. Do not fabricate numbers."

Search query → "You are a literature analyst. Summarize the search results.
  Cite specific papers. Do not make claims without evidence."

Open query → "You are a senior metabolic engineer. Use the available tool
  results to make recommendations. Ground every claim in data."
```

---

## Layer 4: PRESENTATION — Research-Grade Output

### Current State
- No streaming
- No unified confidence score
- No export formats
- Crude confidence heuristic

### Upgrade: Streaming Response

**Modified file:** `app/api/analyze/route.ts`

Switch from buffered to streaming response:
```
Solver result → immediate display (instant)
LLM explanation → stream as generated (progressive)
```

Implementation: Use `ReadableStream` in the API route. The frontend displays solver results immediately, then streams the LLM explanation as it arrives.

### Upgrade: Unified Confidence Score

**New file:** `src/services/confidenceEngine.ts`

Merge confidence from all layers into a single score:

```
confidence = weighted_average(
  solver_confidence × 0.4,     // from solver convergence/status
  citation_confidence × 0.2,   // from citation verification
  workflow_confidence × 0.2,   // from workflow supervisor
  llm_self_report × 0.2        // LLM's own confidence (if available)
)
```

Display as a badge: 🟢 HIGH (>0.7) / 🟡 MEDIUM (0.4-0.7) / 🔴 LOW (<0.4)

### Upgrade: Citation Grounding

Every numerical claim in the LLM response is linked to:
1. The solver that computed it (e.g., "FBA solver, iJO1366 model")
2. The input parameters used
3. A provenance ID for reproducibility

### Upgrade: Export Formats

- **PDF report** — for enterprise consultants presenting to clients
- **LaTeX** — for PhD students writing papers
- **JSON** — for programmatic access
- **CSV** — for data analysis

---

## Cost Analysis

### Current Cost (per 1000 queries)
```
1000 × $0.001 (all LLM) = $1.00/day
```

### Upgraded Cost (per 1000 queries)
```
Tier 0 (cache, ~30%):    300 × $0       = $0.00
Tier 1 (solver, ~40%):   400 × $0       = $0.00
Tier 2 (solver+LLM, ~20%): 200 × $0.0003 = $0.06
Tier 3 (full LLM, ~10%):   100 × $0.001  = $0.10
                                          ────────
Total:                                    $0.16/day
```

**84% cost reduction** while providing better, more accurate answers.

---

## Implementation Priority

| Phase | What | Files | Effort |
|-------|------|-------|--------|
| 1 | Register all 10 pipeline adapters | axonAdapterRegistry.ts, axonAdapters.ts | Low |
| 2 | Cognitive Router (Tier 0-3 routing) | cognitiveRouter.ts (new) | Medium |
| 3 | Response cache | cognitiveRouter.ts (add cache) | Low |
| 4 | Tiered executor | tieredExecutor.ts (new) | Medium |
| 5 | Unified confidence engine | confidenceEngine.ts (new) | Medium |
| 6 | Streaming response | app/api/analyze/route.ts | Medium |
| 7 | Self-correction loop | selfCorrection.ts (new) | Medium |
| 8 | Adaptive prompts | app/api/analyze/route.ts | Low |
| 9 | Export formats | NEXAIPage.tsx | Low |
| 10 | Dynamic re-planning | axonPlanner.ts | Medium |

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/services/cognitiveRouter.ts` | Layer 1: Intent → Tier routing + cache |
| `src/services/tieredExecutor.ts` | Layer 2-3: Tier-based execution engine |
| `src/services/confidenceEngine.ts` | Layer 4: Unified confidence scoring |
| `src/services/selfCorrection.ts` | Layer 3: LLM output verification |

## Files to Modify

| File | Change |
|------|--------|
| `src/services/axonAdapterRegistry.ts` | Register all 10 pipeline adapters |
| `src/services/axonAdapters.ts` | Add pipeline adapter factory |
| `src/services/axonPlanner.ts` | Add dynamic re-planning on failure |
| `src/services/axonIntentRouter.ts` | Extend to all 14 tools |
| `app/api/analyze/route.ts` | Add streaming, adaptive prompts, tier routing |
| `src/components/tools/NEXAIPage.tsx` | Streaming display, confidence badges, exports |

---

## Success Criteria

- All 14 tools have real adapters (no more stubs)
- 90% of queries answered without LLM call (Tier 0+1)
- 84% cost reduction vs current architecture
- Every numerical claim linked to a solver trace
- Unified confidence score displayed to user
- Streaming responses for better UX
- Self-correction catches LLM numerical errors
- Dynamic re-planning on tool failures
