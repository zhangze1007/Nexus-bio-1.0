# Nexus-Bio Codex Guide

## Project Overview
- `Nexus-Bio` is a Next.js 15 / React 19 / TypeScript synthetic biology research workbench.
- Current thesis: **Nexus-Bio is an assumption-gated scientific inference runtime for synthetic biology workflows.**
- The repo uses the App Router in `app/`, but most real feature code lives in `src/`.
- The product is organized as a 4-stage workbench with 13 tool definitions in the shared registry plus a legacy `/tools/metabolic-eng` redirect to `/tools/pathd`.
- The hardening direction is not to describe Nexus-Bio as a collection of state-of-the-art biology algorithms. The core product is the trust runtime around scientific workflows: validity tiers, assumptions, provenance, claim surfaces, benchmark cases, payload admission, and gate decisions.
- Key backend surfaces already in-repo:
  - `app/api/analyze` for Axon literature/pathway analysis.
  - `app/api/fba` for Node-runtime flux balance analysis.
  - `app/api/workbench` for persistent workbench state and audit history.
  - `app/api/scspatial/*` for `.h5ad` ingest/query via the Python sidecar.

## Important Directories
- `app/`: Next.js routes, layouts, metadata, and API endpoints.
- `app/api/`: server endpoints; note the runtime split between Edge and Node routes.
- `src/components/`: shared UI, landing page, IDE shell, workbench panels, and tool pages.
- `src/components/tools/`: tool UIs plus shared workbench/tool config.
- `src/components/workbench/`: launcher, status, audit, timeline, and sync-facing workbench UI.
- `src/services/`: deterministic client/service logic, Axon orchestration, adapters, and scientific engines.
- `src/server/`: Node-side persistence, LP solver, SCSPATIAL sidecar integration, and artifact storage.
- `src/store/`: Zustand stores for UI, workbench, and SCSPATIAL state.
- `src/data/`: mock/reference datasets and seeded scientific inputs.
- `src/workers/`: web workers for pathway/FBA simulations.
- `__tests__/`: Jest coverage for routes, stores, services, and scientific utilities.
- `docs/`: repo docs and trust-runtime documentation.
- `spec/`: trust-runtime protocol specs and standards mapping.
- `benchmarks/`: trust-runtime benchmark corpus and expected labels.
- `.nexus/`: local runtime data store for workbench SQLite state and SCSPATIAL artifacts. Ignored; do not commit.

## Run And Validate
- Install JS deps: `npm install`
- Dev server: `npm run dev`
- Production build: `npm run build`
- Production server: `npm run start`
- Tests: `npm run test`
- Typecheck: `npm run lint`
- Lint: no separate ESLint command is confirmed from the repo. `npm run lint` is `tsc --noEmit`.
- Trust benchmark corpus validation: `npm run benchmark:trust:validate`
- Trust policy benchmark evaluation: `npm run benchmark:trust:evaluate`
- Format: not confirmed from repo.

## Environment And Sidecars
- AI env vars confirmed in code: `GROQ_API_KEY`, `GEMINI_API_KEY`
- Optional SCSPATIAL Python override: `SCSPATIAL_PYTHON_BIN`
- SCSPATIAL sidecar setup confirmed in `README.md` and server code:
  - `python3 -m venv .venv-scspatial`
  - `.venv-scspatial/bin/pip install -r requirements-scspatial-sidecar.txt`
- Repo-local fallback install path is also supported:
  - `python3 -m pip install --target .nexus/scspatial-pydeps -r requirements-scspatial-sidecar.txt`

## Engineering Conventions Visible In Repo
- Keep App Router pages thin. Most route files simply wrap/import `src` components.
- Preserve the persistent `/tools/*` shell. `app/tools/layout.tsx` mounts `ToolsLayoutShell`, which keeps sidebar/topbar/console/copilot state alive across tool navigation.
- Use Zustand stores for app state. `workbenchStore`, `uiStore`, and `scSpatialStore` are the main shared state surfaces.
- Keep scientific workflow wiring in shared config:
  - tool metadata in `src/components/tools/shared/toolRegistry.ts`
  - stage definitions in `src/components/tools/shared/workbenchConfig.ts`
  - dependency edges in `src/components/tools/shared/workbenchGraph.ts`
  - validity labels in `src/components/tools/shared/toolValidity.ts`
- Prefer deterministic, testable services. Axon planner/orchestrator/service files explicitly avoid hidden state and fake autonomy.
- Respect the runtime split:
  - `app/api/analyze` is `runtime = 'edge'`
  - `app/api/fba`, `app/api/workbench`, and `app/api/scspatial/*` are `runtime = 'nodejs'`
- UI styling is mixed:
  - many components use inline style objects and theme tokens
  - SCSPATIAL also uses a CSS module
  - avoid broad style rewrites unless the task specifically calls for them
- Keep scientific honesty. The repo already distinguishes `real`, `partial`, and `demo` tool validity instead of pretending everything is production-grade.

## Constraints And Do-Not Rules
- Do not reverse the AI provider order in `app/api/analyze`: Groq is primary, Gemini is fallback.
- Do not silently invent support for unsupported Axon tools. The current adapter registry only wires real adapters one tool at a time.
- Do not claim bounded autonomy exists; `src/services/axonAutonomyLoop.ts` is a disabled seam, not a live autonomous loop.
- Do not bypass workbench sanitizers/persistence conventions when editing state or server payloads.
- Do not commit generated or local runtime data from `.nexus/`, `.next/`, `.venv/`, or `.venv-scspatial/`.
- Treat `/tools/metabolic-eng` as a backward-compatibility route unless the task is explicitly to retire or reintroduce it.
- Do not rename Nexus-Bio.
- Do not invent DOI, citations, wet-lab validation, scientific validation, external validation, user traction, benchmark performance claims, or full SBOL compliance.

## Trust-Runtime Hardening Rules

### Runtime vs algorithm boundary
Runtime work may include:
- protocol types
- validity metadata
- assumptions
- provenance metadata
- claim-surface policy
- gate decisions
- benchmark corpus
- payload admission
- workflow governance
- state sanitization for trust metadata
- tests and docs for the trust runtime

Algorithm work means changing scientific computation logic, such as:
- FBA solver logic
- thermodynamics calculations
- TX-TL ODE equations
- protein/catalyst scoring
- codon optimization
- multi-omics decomposition

Do not touch algorithm work unless the task explicitly asks for it.

### Fixed trust-runtime vocabulary
Use these validity tiers exactly:
- `real`
- `partial`
- `demo`

Use these gate statuses exactly:
- `ok`
- `blocked`
- `gated`
- `demoOnly`

Use these claim surfaces exactly:
- `payload`
- `export`
- `recommendation`
- `protocol`
- `external-handoff`

Use these concepts consistently:
- `ValidityTier`
- `ClaimSurface`
- `GateStatus`
- `GateDecision`
- `ClaimSurfacePolicy`
- `ToolAssumption`
- `Evidence`
- `ProvenanceEntry`
- `AssumptionViolation`
- `WorkflowContract`

### Current implementation status
The hardening plan is being executed in staged commits.

Completed or in progress:
1. P0 Step 1–3: trust-runtime thesis, protocol vocabulary, PROV-DM mapping, SBOL-aligned mapping.
2. P0 Step 4: typed DBTL feedback and legacy `learnedParameters` compatibility.
3. P0 Step 5: claim-surface policy catalog.
4. P0 Step 6: trust benchmark corpus and validation harness.
5. P1 Step 7A: pure `evaluateClaimSurfacePolicy()` engine and local benchmark evaluation.
6. P1 Step 7B: observe-mode workbench payload admission and recorded `GateDecision` per tool.
7. P1 Step 8A/8B: provenance middleware and safe staged integrations.

Do not skip ahead to later steps unless the current task explicitly asks for it.

## Homepage UI/UX Lock
Homepage UI/UX is locked unless the user explicitly requests homepage changes.

Do not modify these files unless explicitly instructed:
- `app/page.tsx`
- `src/App.tsx`
- `src/components/Hero.tsx`
- `src/components/ThreeScene.tsx`
- homepage-only visual styling
- landing-page visual components

If a task requires positioning changes, prefer:
- `README.md`
- `docs/`
- `spec/`
- `examples/`
- test fixtures

If overclaiming text appears only in homepage UI, report it under:
`Homepage locked / future review needed`

Do not silently edit homepage or landing visual files.

## Preferred Workflow
1. Check `git status` and avoid disturbing unrelated in-flight work.
2. Read the specific route/store/service files you are about to touch; do not rely on README copy alone.
3. If the task affects a tool route, verify whether related updates are also needed in tool registry, workbench config/graph, payload typing, and validity metadata.
4. Make the smallest coherent change set.
5. Run the most relevant repo-native validation commands available.
6. Stage only intended files and summarize any uncertainties honestly.

## Plan Mode For Risky Tasks
For risky runtime/store/dataflow tasks, use Plan Mode first. The plan must list:
1. files to inspect
2. files to modify
3. files not to touch
4. how product behavior will remain safe
5. validation commands
6. risks and rollback plan

Do not modify files until the plan is approved when the task asks for Plan Mode.

## Validation Commands
Prefer the safest available checks:

```bash
git status --short
git diff --stat
git diff --name-only
npm run lint
```

When trust benchmark files are relevant, also run:

```bash
npm run benchmark:trust:validate
npm run benchmark:trust:evaluate
```

Run targeted Jest tests for changed areas. Examples:

```bash
npx jest __tests__/dbtlFeedback.test.ts --runInBand
npx jest __tests__/workbenchDataflowDbtlFeedback.test.ts --runInBand
npx jest __tests__/claimSurfacePolicy.test.ts --runInBand
npx jest __tests__/trustBenchmarkCorpus.test.ts --runInBand
npx jest __tests__/trustPolicyEngine.test.ts --runInBand
npx jest __tests__/trustPolicyEngineBenchmark.test.ts --runInBand
npx jest __tests__/workbenchPayloadAdmission.test.ts --runInBand
npx jest __tests__/provenanceMiddleware.test.ts --runInBand
```

Do not claim validation passed unless the command actually ran and passed.

If a command fails, report:
- exact command
- exit status
- whether it appears task-related or pre-existing
- short error summary

## Search Checks For Risky Tasks

For overclaiming:

```bash
grep -Rni "wet-lab validated\|validated biological design\|full SBOL compliance" README.md docs spec benchmarks src __tests__ scripts || true
```

For homepage lock:

```bash
git diff --name-only | grep -E "app/page.tsx|src/App.tsx|src/components/Hero.tsx|src/components/ThreeScene.tsx" || true
```

For trust policy tasks:

```bash
grep -Rni "evaluateClaimSurfacePolicy" src __tests__ docs scripts benchmarks || true
```

For provenance tasks:

```bash
grep -Rni "withProvenance" src __tests__ docs scripts benchmarks || true
grep -Rni "runProvenance" src __tests__ docs scripts benchmarks || true
```

For accidental UI/route/export/protocol wiring:

```bash
grep -Rni "disabled=.*evaluateClaimSurfacePolicy\|onClick=.*evaluateClaimSurfacePolicy\|route.*evaluateClaimSurfacePolicy" src app || true
grep -Rni "protocol.*evaluateClaimSurfacePolicy\|export.*evaluateClaimSurfacePolicy\|handoff.*evaluateClaimSurfacePolicy" src app || true
```

## Definition Of Done
- The change matches the real repo structure and does not invent missing capabilities.
- Related config is kept in sync when required by the change.
- Relevant validation has been run, or the reason it was not run is stated clearly.
- Docs/status notes are updated when the task changes persistent workflow behavior.
- Diff is scoped to the task with no drive-by refactors.
- Homepage UI/UX lock is respected.
- Scientific honesty is preserved.
- Non-goals are explicitly confirmed in the final report.

## Required Final Report Format
Every task should end with a report in this structure:

```markdown
# Completion Report

## Status
Complete / Partial / Incomplete

## Files inspected
List files.

## Files changed
List files.

## What changed
Brief but specific summary.

## Validation run
Exact command(s) and result(s).

## Search results
Summarize relevant grep/search checks.

## Homepage UI/UX lock confirmation
Confirm whether homepage or landing UI files were changed.

## Scientific honesty confirmation
Confirm:
- no scientific algorithm changed
- no tool tier changed
- no DOI invented
- no wet-lab validation claim added
- no scientific validation claim added
- no user traction invented

## Product behavior boundary
Explain whether product behavior changed.

## Non-goal confirmation
List explicitly avoided steps/features.

## Remaining gaps
List next step(s).

## Recommended commit message
Use a focused commit message.
```

## Commit Style
Use focused commits. Recommended examples:

```text
[p0-step-1-3] add trust-runtime thesis and protocol specs
[p0-step-4] replace stringly DBTL feedback with typed metrics
[p0-step-5] define claim-surface policy catalog
[p0-step-6] add trust benchmark corpus and validation harness
[p1-step-7a] add unified trust policy engine and benchmark evaluation
[p1-step-7b] add observe-mode workbench payload admission
[p1-step-8a] add provenance middleware and initial tool integrations
[p1-step-8b] extend provenance coverage and chain diagnostics
```

## Step-Specific Non-Goal Discipline
- If a task says “Step 8A only,” do not start Step 8B or Step 9.
- If a task says “policy definitions only,” do not wire UI/store/route behavior.
- If a task says “observe mode,” do not switch product behavior to enforcement mode.
- If a task says “benchmark corpus,” do not claim runtime performance or scientific validation.
- If a task says “provenance middleware,” do not create fake evidence or fake external provenance.
- If a task says “docs-only,” do not modify source code.
- If a task says “no UI,” do not touch UI components.

## Scientific Honesty Language
Prefer:
- “SBOL-aligned”
- “future SBOL-compatible export”
- “local development benchmark alignment”
- “trust-runtime corpus validation”
- “demo-level output”
- “partial implementation”
- “not wet-lab validated”
- “not a research-grade biofoundry”

Avoid:
- “fully SBOL-compliant” unless validated by a proper SBOL validator
- “wet-lab validated” unless real wet-lab evidence exists
- “research-grade” unless implementation and validation justify it
- “SOTA” or “state-of-the-art” unless supported by direct evidence
- “autonomous lab” or “fully automated biofoundry”
- “AI-discovered sequence” for heuristic variant suggestions

## Agent Behavior Expectations
- Make the smallest safe change that satisfies the task.
- Prefer adapters and migration paths over breaking old state.
- Preserve backward compatibility for persisted workbench state.
- Do not delete old pathways until replacement is tested and explicitly approved.
- If a task could affect runtime behavior, add or update tests.
- If a task touches trust metadata, confirm no IDs or evidence were invented.
- If a task touches docs, keep limitations visible.
- Ignore unrelated dirty-worktree changes unless the user explicitly asks to clean them up.

## Keep Diffs Scoped
- Avoid broad reformatting in large inline-style components.
- Do not rename or reshuffle shared workbench files unless the task requires it.
- Ignore unrelated dirty-worktree changes; this repo frequently has in-progress workbench/Axon edits.
- When only docs are requested, touch only the requested docs.
