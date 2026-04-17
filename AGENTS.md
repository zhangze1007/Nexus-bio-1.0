# Nexus-Bio Codex Guide

## Project Overview
- `Nexus-Bio` is a Next.js 15 / React 19 / TypeScript synthetic biology research workbench.
- The repo uses the App Router in `app/`, but most real feature code lives in `src/`.
- The product is organized as a 4-stage workbench with 13 tool definitions in the shared registry plus a legacy `/tools/metabolic-eng` redirect to `/tools/pathd`.
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
- `docs/`: repo docs currently includes `docs/firewall.md`.
- `.nexus/`: local runtime data store for workbench SQLite state and SCSPATIAL artifacts. Ignored; do not commit.

## Run And Validate
- Install JS deps: `npm install`
- Dev server: `npm run dev`
- Production build: `npm run build`
- Production server: `npm run start`
- Tests: `npm run test`
- Typecheck: `npm run lint`
- Lint: no separate ESLint command is confirmed from the repo. `npm run lint` is `tsc --noEmit`.
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

## Preferred Workflow
1. Check `git status` and avoid disturbing unrelated in-flight work.
2. Read the specific route/store/service files you are about to touch; do not rely on README copy alone.
3. If the task affects a tool route, verify whether related updates are also needed in tool registry, workbench config/graph, payload typing, and validity metadata.
4. Make the smallest coherent change set.
5. Run the most relevant repo-native validation commands available.
6. Stage only intended files and summarize any uncertainties honestly.

## Definition Of Done
- The change matches the real repo structure and does not invent missing capabilities.
- Related config is kept in sync when required by the change.
- Relevant validation has been run, or the reason it was not run is stated clearly.
- Docs/status notes are updated when the task changes persistent workflow behavior.
- Diff is scoped to the task with no drive-by refactors.

## Keep Diffs Scoped
- Avoid broad reformatting in large inline-style components.
- Do not rename or reshuffle shared workbench files unless the task requires it.
- Ignore unrelated dirty-worktree changes; this repo frequently has in-progress workbench/Axon edits.
- When only docs are requested, touch only the requested docs.
