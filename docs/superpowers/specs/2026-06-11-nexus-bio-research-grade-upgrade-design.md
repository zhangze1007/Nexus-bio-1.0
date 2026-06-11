# Nexus-Bio Research-Grade Upgrade Design

**Date:** 2026-06-11
**Status:** Reviewed — awaiting user approval
**Author:** Zhang Ze Foo + Claude Code

---

## Problem Statement

Nexus-Bio is a synthetic biology AI platform with 14 tool pages, honest provenance tracking, and a well-architected trust system. However, an objective assessment reveals:

- **Scientific computation is pedagogical-level** — FBA uses a toy ~95-reaction network (vs 2,251 in full iJO1366), thermodynamics is lookup-table-based (group contribution not implemented), kinetics only models competitive inhibition with fixed-step RK4
- **Trust engine is observe-only** — decisions are recorded but never block writes, exports, or protocols
- **SQLite backend is ephemeral** — data is lost on every Vercel cold start

The goal is to upgrade Nexus-Bio from "teaching platform" to "research-grade tool" across three dimensions: scientific depth, trust enforcement, and data persistence.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Nexus-Bio 2.0                         │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Next.js 15  │  │  Workbench   │  │   Trust      │  │
│  │   Frontend    │  │  (Turso)     │  │   Engine     │  │
│  │   + Pyodide   │  │              │  │  (enforced)  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                  │                  │          │
│  ┌──────▼──────────────────▼──────────────────▼───────┐ │
│  │              API Layer (Next.js Routes)             │ │
│  └──────┬──────────────────┬──────────────────┬───────┘ │
│         │                  │                  │          │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────▼───────┐ │
│  │  FBA Engine   │  │  Thermo      │  │  Kinetics    │ │
│  │  (COBRApy/    │  │  Engine      │  │  Engine      │ │
│  │   Pyodide)    │  │  (Pyodide)   │  │  (Pyodide)   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                          │
│  Fallback: Railway/Fly.io Python microservice            │
└─────────────────────────────────────────────────────────┘
```

**Key decisions:**
- **Python runtime:** Pyodide (browser-side) as primary; independent Python microservice as fallback
- **Persistence:** Turso (libSQL) replaces better-sqlite3
- **Trust:** Transition from `observe` to `enforce` mode
- **Upgrade order:** Persistence + Scientific depth (parallel) → Trust activation → New directions

---

## Sub-Project 1: Turso Persistence Migration

### Goal
Replace ephemeral SQLite with Turso (libSQL) so data survives Vercel cold starts.

### Implementation

**Phase 1: Dependency Replacement**
- Replace `better-sqlite3` with `@libsql/client`
- Keep existing 8-table schema unchanged
- Use Turso HTTP API for Serverless compatibility

**Phase 2: Connection Layer**
- Production: `@libsql/client` with Turso URL + auth token
- Local development: `@libsql/client` with `file:` URL (local SQLite)
- Connection pooling via `@libsql/client`'s built-in pooling

**Phase 3: Data Migration**
- Script to export existing localStorage data
- Import into Turso database
- Validate data integrity

**Phase 4: Multi-Session Support**
- The existing revision conflict detection (`readProjectState` returns `serverRevision`) already handles concurrent writes
- Turso's distributed nature enables true multi-session persistence

### Files Changed
- `src/server/workbenchDb.ts` — Rewrite connection layer
- `app/api/workbench/route.ts` — Adapt to new client
- `package.json` — Replace `better-sqlite3` with `@libsql/client`
- New: `scripts/migrate-to-turso.ts`

### Migration Strategy
- **Big-bang cutover** (not gradual) — the schema is identical, only the connection layer changes
- Local development continues to use `file:` URL (no Turso account needed for dev)
- Production uses `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` env vars
- Rollback plan: revert `workbenchDb.ts` to `better-sqlite3` version (git revert)

### Risks
- Turso free tier: 9GB storage, 500M row reads/month
- Need Turso account and `TURSO_AUTH_TOKEN` env var
- Existing localStorage data needs manual migration (one-time script)

---

## Sub-Project 2: Scientific Engine Upgrade

### Technical Route
- **Primary:** Pyodide (CPython → WebAssembly) running in the browser
- **Fallback:** Independent Python microservice on Railway/Fly.io
- **Decision:** Try Pyodide first; if COBRApy compatibility fails, switch to fallback

### Phase 1: Pyodide Integration

**Goal:** Verify COBRApy runs in Pyodide within the Next.js app.

**Implementation:**
1. Create `src/services/pyodideLoader.ts` — Singleton Pyodide runtime manager
2. Load Pyodide from CDN (`https://cdn.jsdelivr.net/pyodide/`)
3. Install COBRApy via `micropip.install('cobra')`
4. Verify basic FBA solve works

**Fallback trigger (specific conditions):**
- COBRApy fails to install via `micropip` (missing wheels, C extension incompatibility)
- COBRApy installs but FBA solve takes >30 seconds for a 100-reaction model
- Pyodide initial load exceeds 60 seconds on 3G connection
- Memory usage exceeds 512MB for iJO1366 full model

If any trigger fires:
- Deploy Python service to Railway/Fly.io
- Frontend calls via HTTP API
- Same `src/services/pyodideLoader.ts` interface, different transport backend

### Phase 2: FBA Engine Upgrade (COBRApy)

**Goal:** Upgrade from toy FBA to research-grade metabolic modeling.

**Sub-phases:**

2a. **SBML Import/Export**
- Parse SBML Level 3 files via libSBML (within Pyodide)
- Support BiGG model library standard format
- Export current model as SBML

2b. **Core Algorithm Upgrade**
- FVA (Flux Variability Analysis) — flux range per reaction
- MOMA/ROOM — gene knockout phenotype prediction
- pFBA (parsimonious FBA) — unique flux distribution
- GPR rules — gene-protein-reaction mapping for gene knockouts
- Dual variable extraction — shadow prices from LP dual

2c. **Network Expansion**
- Expand from ~95 reactions to full iJO1366 (2,251 reactions)
- Support arbitrary BiGG model import
- Flux sampling (Hit-and-Run algorithm)

2d. **UI Upgrade**
- SBML file upload interface
- FVA results visualization (flux range bar chart)
- Gene knockout strategy table
- Flux distribution heatmap

**Files Changed:**
- New: `python/fba_engine.py` — COBRApy core
- New: `src/services/pyodideLoader.ts` — Pyodide runtime manager
- `app/api/fba/route.ts` — Rewrite for Pyodide calls
- `src/components/tools/FBASimPage.tsx` — UI upgrade
- New: `src/components/tools/fba/SBMLImporter.tsx`
- New: `src/components/tools/fba/FVAResults.tsx`

### Phase 3: Thermodynamics Engine Upgrade

**Goal:** Replace lookup tables with real group contribution calculations.

**Sub-phases:**

3a. **Group Contribution Calculation**
- Mavrovouniotis method — estimate ΔG°f from molecular structure
- Joback-Reid method — estimate ΔH°f, S°, Cp
- Support SMILES/InChI input for arbitrary metabolites
- Reference: Jankowski et al. (2008) Biophys J 95:1487

3b. **Alberty Transformed Gibbs Energy**
- pH-dependent transformed Gibbs energy ΔG'°
- Ionic strength correction (Debye-Hückel)
- Magnesium binding correction
- Reference: Alberty (2003) J Phys Chem B 107:12780

3c. **Pathway Thermodynamic Analysis**
- Full pathway ΔG profile (waterfall chart)
- Thermodynamic feasibility check (each step ΔG < 0?)
- Equilibrium constant calculation
- eQuilibrator API integration (Beber et al. 2022)

3d. **UI Upgrade**
- SMILES molecular structure input
- ΔG profile waterfall (upgrade existing to real calculations)
- Thermodynamic feasibility dashboard
- Integration with FBA engine (TMFA — thermodynamics-constrained FBA)

**Files Changed:**
- New: `python/thermo_engine.py` — Group contribution + transformed Gibbs
- `src/utils/thermodynamics.ts` — Rewrite for Pyodide calls
- `src/components/ThermodynamicsPanel.tsx` — UI upgrade
- `src/components/tools/CETHXPage.tsx` — Real computation integration

### Phase 4: Kinetics Engine Upgrade

**Goal:** Upgrade from simple MM + fixed RK4 to research-grade kinetics.

**Sub-phases:**

4a. **Enzyme Inhibition Model Expansion**
- Competitive (existing)
- Uncompetitive: v = Vmax·S / (Km + S·(1 + I/Kiu))
- Mixed: v = Vmax·S / (Km·(1 + I/Kic) + S·(1 + I/Kiu))
- Substrate inhibition: v = Vmax·S / (Km + S + S²/Kis)
- Hill equation: v = Vmax·Sⁿ / (K₅₀ⁿ + Sⁿ)
- Allosteric regulation (MWC model)

4b. **ODE Solver Upgrade**
- Dormand-Prince RK4(5) — adaptive step size, embedded error estimation
- LSODA/CVODE — stiff solvers (via SciPy in Pyodide)
- Multi-compartment models — cytoplasm, mitochondria, medium
- Sensitivity analysis — parameter sensitivity matrix

4c. **Parameter Estimation**
- Levenberg-Marquardt — local optimization
- Global optimization — differential evolution / genetic algorithm
- Fit to experimental data — input Km, Vmax, Ki measurements
- BRENDA integration — fetch known parameters as initial guesses

4d. **SBML Compatibility**
- Extract kinetic parameters from SBML models
- Support SBML KineticLaw elements
- Export kinetic models as SBML

4e. **UI Upgrade**
- Multi-enzyme system editor
- Parameter estimation interface (input experimental data, output fitted parameters)
- Sensitivity analysis heatmap
- Time series comparison chart (simulation vs experiment)

**Files Changed:**
- New: `python/kinetics_engine.py` — ODE solvers + parameter estimation
- `src/utils/kinetics.ts` — Rewrite for Pyodide calls
- `src/components/KineticPanel.tsx` — UI upgrade
- New: `src/components/tools/kinetics/ParameterEstimator.tsx`

---

## Sub-Project 3: Trust Engine Activation

### Goal
Transition Trust Policy Engine from `observe` to `enforce` mode.

### Phase 1: Payload Write Blocking
- In `toolRunSlice.ts`, change `evaluateWorkbenchPayloadAdmission` mode from `observe` to `enforce`
- When gate decision is `blocked`, `shouldWritePayload` returns `false`
- UI displays blocking reason and resolution path

### Phase 2: Export Interception
- SBOL export checks provenance completeness before proceeding
- CSV/JSON export checks claim surface policy
- Data missing provenance is tagged `[UNVERIFIED]` in exports

### Phase 3: Route Guards
- `/tools/dbtlflow` protocol generation requires human gate approval
- `/tools/scspatial` external-handoff requires experiment-backed authority
- Routes that don't meet requirements show a blocking page with guidance

### Phase 4: UI Feedback
- Add trust status indicator to each tool page
- On blocking, show specific missing items (provenance, evidence, human gate)
- Provide one-click completion path

**Files Changed:**
- `src/store/slices/toolRunSlice.ts` — Change observe → enforce
- New: `src/components/workbench/WorkbenchTrustIndicator.tsx`
- New: `src/components/tools/shared/TrustGate.tsx`
- `app/api/workbench/route.ts` — Export interception logic

---

## Execution Order

```
Wave 1 (Parallel, ~2 weeks):
  ├── Sub-Project 1: Turso Migration (full)
  └── Sub-Project 2: Pyodide Integration Verification (Phase 1 only)

Wave 2 (Sequential, after Wave 1, ~3 weeks):
  └── Sub-Project 2: FBA Engine Upgrade — COBRApy (Phases 2a-2d)

Wave 3 (Parallel, after Wave 2, ~4 weeks):
  ├── Sub-Project 2: Thermodynamics Engine Upgrade (Phases 3a-3d)
  ├── Sub-Project 2: Kinetics Engine Upgrade (Phases 4a-4e)
  └── Sub-Project 3: Trust Engine Activation (Phases 1-4)

Wave 4 (After all above):
  └── New research directions (to be designed separately)
```

Note: Sub-project phase numbers (e.g., "Phase 2a") are internal to each sub-project. "Wave" numbers denote the overall execution timeline.

---

## Success Criteria

### Persistence
- [ ] Data survives Vercel cold starts
- [ ] Multiple browser sessions see the same project state
- [ ] Existing localStorage data migrates successfully

### FBA
- [ ] Import and solve a BiGG SBML model (iJO1366)
- [ ] FVA produces correct flux ranges
- [ ] Gene knockout predictions match COBRApy reference
- [ ] Shadow prices extracted from LP dual

### Thermodynamics
- [ ] Group contribution calculation for arbitrary metabolites
- [ ] Alberty transformed Gibbs energy with pH/ionic strength correction
- [ ] Pathway ΔG profile matches eQuilibrator reference

### Kinetics
- [ ] All inhibition types implemented and verified
- [ ] Stiff solver handles metabolic ODEs without numerical instability
- [ ] Parameter estimation converges on known parameters

### Trust
- [ ] Blocked payloads are not written to store
- [ ] Exports without provenance are flagged
- [ ] Route guards block unauthorized access

---

## Open Questions

1. **Pyodide COBRApy compatibility** — Need to verify that COBRApy's C extensions (libSBML, scipy) work in Pyodide. If not, fallback to independent Python service.
2. **Turso free tier limits** — 9GB storage may be sufficient for development but could limit production use.
3. **Group contribution data** — Need to source or implement the group contribution parameter tables (Mavrovouniotis, Joback-Reid).
4. **Parameter estimation performance** — Global optimization in Pyodide (browser) may be slow for large models. May need to offload to server.
