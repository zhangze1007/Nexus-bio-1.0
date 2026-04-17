# Nexus-Bio Project Memory

Snapshot date: 2026-04-17 UTC

## Current Project Status
- Confirmed: this is a Next.js 15 / React 19 / TypeScript App Router project with most feature code in `src/`.
- Confirmed: the shared workbench models 4 stages and 13 tool definitions in `src/components/tools/shared/toolRegistry.ts`.
- Confirmed: there are 14 `/tools/*` route directories on disk. `/tools/metabolic-eng` is a legacy redirect to `/tools/pathd`, so the shared registry intentionally centers the 13-tool workbench on `pathd`.
- Confirmed: workbench state sync is live in code. `WorkbenchSyncProvider` auto-loads/saves through `/api/workbench`, and `src/server/workbenchDb.ts` persists state to SQLite in `.nexus/workbench.db` locally or `/tmp/.nexus/workbench.db` on Vercel.
- Confirmed: SCSPATIAL supports demo ingest and uploaded `.h5ad` ingest through Node routes plus the Python sidecar in `src/server/scspatial_sidecar.py`.
- Confirmed: there are 24 Jest test files under `__tests__/`.
- Confirmed: the worktree was already dirty before this docs pass. Visible local changes are concentrated in home/workbench/Axon files:
  - Modified: `app/layout.tsx`, `app/tools/page.tsx`, `src/App.tsx`, `src/components/FeaturesArchitecture.tsx`, `src/components/Hero.tsx`, `src/components/TopNav.tsx`, `src/components/workbench/WorkbenchDirectoryPage.tsx`, `src/providers/AxonOrchestratorProvider.tsx`, `src/services/AxonOrchestrator.ts`, `src/store/workbenchStore.ts`, `src/store/workbenchTypes.ts`
  - Untracked: `src/services/axonAutonomyLoop.ts`, `src/services/axonEvidenceAdapter.ts`, `src/services/axonExecutionLog.ts`, `src/services/axonPlanner.ts`

## Current Milestone / Focus Areas
- Inferred from the dirty worktree: the current branch focus is expanding Axon from a basic queue into a more visible shared orchestration layer.
- Inferred from modified/new files: active work includes plan/log support, evidence adapters, workbench writeback, and launcher messaging around the 4-stage workbench.
- Inferred from home-page diffs: product positioning is being shifted from a generic tools directory toward a connected scientific workbench narrative.

## What Appears Implemented Already
- Confirmed: thin route wrappers in `app/` hand off most logic to `src` components.
- Confirmed: `/tools/*` pages share a persistent `ToolsLayoutShell`, so sidebar/topbar/console/coplayout state survives navigation.
- Confirmed: the workbench has explicit stage definitions, dependency edges, run artifacts, audit history, collaborator/history tables, and revision/conflict handling.
- Confirmed: `app/api/analyze` is the Axon backend and enforces Groq-primary / Gemini-fallback provider order.
- Confirmed: `app/api/fba` runs in Node and calls the TypeScript simplex/authority solver in `src/server/fbaEngine.ts`.
- Confirmed: SCSPATIAL can normalize artifacts, compute/query spatial analysis views, and persist normalized artifacts to JSON.
- Confirmed: the repo already encodes scientific honesty through `toolValidity.ts` with `real` / `partial` / `demo` badges instead of hiding limitations.
- Confirmed: Axon already has a real adapter path for `pathd` and `fbasim` through existing backend routes.

## What Appears Partial / In Progress
- Confirmed: Axon automation is only wired for `pathd` and `fbasim` in `src/services/axonAdapterRegistry.ts`.
- Confirmed: `src/services/axonAutonomyLoop.ts` ships a disabled seam labeled manual-only; bounded autonomy is not implemented.
- Confirmed: `src/services/axonEvidenceAdapter.ts` is framed as an extension seam for future evidence adapters.
- Confirmed: several scientific tools are intentionally marked `partial` or `demo` in `src/components/tools/shared/toolValidity.ts`.
- Confirmed: `src/components/tools/NEXAIPage.tsx` still describes some deferred areas such as broader external literature expansion and evidence tree visualization.
- Inferred: the new Axon planning/logging pieces are not fully integrated across every UI surface yet, because some older comments/components still describe earlier read-only behavior.

## Known Issues Or Open Questions
- Confirmed: `npm run lint` is a typecheck (`tsc --noEmit`), not a dedicated linter. No ESLint command is confirmed in `package.json`.
- Confirmed: formatting tooling is not declared in `package.json`.
- Confirmed: `app/tools/metabolic-eng/MetabolicEngClient.tsx` still exists even though the route redirects to `/tools/pathd`. Decide later whether to keep it as a compatibility artifact or remove it.
- Confirmed: current typecheck/build are broken by in-progress Axon work. Latest failures are `buildStepInput` missing in `src/providers/AxonOrchestratorProvider.tsx`, provider context shape drift in that same file, and missing `axonLogs` / `axonPlan` store fields in `src/store/workbenchStore.ts`.
- Inferred: some comments/docs lag the latest in-flight Axon changes. Treat current code and tests as the stronger source of truth than historical commentary.
- Confirmed: local runtime persistence lives under `.nexus/`; tasks that exercise workbench or SCSPATIAL flows can create local state artifacts even when no source files change.

## How To Run And Validate
- Install deps: `npm install`
- Start dev server: `npm run dev`
- Build: `npm run build`
- Start production server: `npm run start`
- Run tests: `npm run test`
- Run typecheck: `npm run lint`
- Required AI env vars confirmed in code: `GROQ_API_KEY`, `GEMINI_API_KEY`
- Optional SCSPATIAL Python override: `SCSPATIAL_PYTHON_BIN`
- SCSPATIAL sidecar setup:
  - `python3 -m venv .venv-scspatial`
  - `.venv-scspatial/bin/pip install -r requirements-scspatial-sidecar.txt`

## Important Architectural Decisions
- Confirmed: route files are intentionally thin; feature logic belongs in `src`.
- Confirmed: workbench continuity is a first-class concern. Shared UI chrome, Zustand stores, and `/api/workbench` persistence are designed so users can move across tools without losing project context.
- Confirmed: backend runtime choice is explicit per route. Edge is used for AI analyze requests; Node is used where SQLite, Python sidecars, or server-side scientific computation are needed.
- Confirmed: deterministic logic is preferred for planning/orchestration layers. The Axon planner/router/orchestrator emphasize auditable rules over opaque autonomous behavior.
- Confirmed: persistence is artifact-aware. `artifact` query params and revision handling are already part of the current workbench model.

## Recommended Next Steps
- Finish the in-flight Axon/workbench orchestration work and then align any stale comments/UI copy with the new behavior.
- Decide whether `/tools/metabolic-eng` should remain as a legacy alias indefinitely or be fully removed from the tree.
- Add an explicit ESLint and/or formatting command if the team wants a stricter, clearer validation story than `tsc --noEmit`.
- Extend Axon adapters only when a real backend execution surface exists for the target tool; keep unsupported tools explicit.
- Keep this file updated whenever the workbench persistence model, Axon capabilities, or tool registry meaningfully change.

## Last Updated By Codex
- 2026-04-17 UTC
- Created `AGENTS.md` and this `Documentation.md` from repo inspection rather than template boilerplate.
- Confirmed package scripts, route/runtime split, workbench persistence paths, SCSPATIAL sidecar flow, and current dirty-worktree status.
- Validation run on this pass:
  - `npm test -- --runInBand` passed: 24/24 suites, 160/160 tests.
  - `npm run lint` failed after `.next/types` existed because of current Axon/provider/store TypeScript errors.
  - `npm run build` failed on the same in-progress Axon/provider typing issues.
