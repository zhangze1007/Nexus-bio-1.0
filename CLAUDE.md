# Nexus-Bio 1.0 — Claude Code Context

## Project Background

Synthetic biology AI platform. Built by Zhang Ze Foo (Malaysia, STPM student on gap year) in 48 hours on a tablet.

**Core workflow — 4-stage research cycle:**
```
INPUT: Target Molecular Product
         │
STAGE 1: DESIGN & DISCOVERY
  LAB (basic research) ◄──────────────────────────┐
       │ path blueprint data                       │
       ▼                                           │
  PATHD: Pathway & Enzyme Design Navigator         │
       │ thermodynamic parameters ─────────────────┘
         │
STAGE 2: SIMULATION & COMPONENT OPTIMIZATION
  FBAsim (flux balance analysis) ─┐
  CETHX (thermodynamics)  ────────┴─► identify bottlenecks
                                              │
                                              ▼
                                   PROEVOL (protein evolution)
                                              │
                                              ▼
                                   CATDES (enzyme design)
                                              │ optimized sequence
STAGE 3: CHASSIS ENGINEERING & CONTROL       │
  GENMIM (genome minimization) ──► efficient chassis
                                        │
                                        ▼
                              GECAIR (gene circuit design)
                                        │
                                        ▼
                              DYNCON (dynamic feedback control)
                                        │ build instructions
STAGE 4: TEST, ANALYZE & ITERATE        │
  DBTLflow → CFS (cell-free screening)
           → DBTL (actual cell construction & testing)
           → MULTIO (multi-omics integration)
           → SCSPATIAL (single-cell & spatial omics)
           → DBTLflow (learned optimization params)
                │
                └──► feedback ──► INPUT (next iteration)

NEXAI: AI Multi-Module Research Assistant  ← available across all stages
```

**Live URL:** nexus-bio-1-0.vercel.app  
**GitHub:** github.com/zhangze1007/Nexus-bio-1.0  
**Brand name:** Nexus-Bio (never rename to SynPath Bio or anything else)

---

## Tech Stack

```
Frontend   React 19 + TypeScript + Next.js 15 (App Router) + Tailwind CSS v3 + Framer Motion
3D         Three.js 0.183 + @react-three/fiber 9.5 + @react-three/drei 10.7 + 3Dmol.js (CDN)
AI         Groq API (primary) + Gemini API (fallback)
State      Zustand 5 (uiStore, workbenchStore) + XState 5 (metabolicMachine, analysisMachine)
DB         better-sqlite3 (workbench project ledger, server-side only)
Deploy     Vercel (Hobby plan, free tier, Edge Runtime)
```

---

## Project Structure

```
/
├── app/                              Next.js 15 App Router
│   ├── layout.tsx                    Root layout (wraps WorkbenchSyncProvider)
│   ├── page.tsx                      Home — exports App component
│   ├── analyze/
│   │   ├── page.tsx
│   │   └── AnalyzeClient.tsx
│   ├── contact/
│   │   ├── page.tsx
│   │   └── ContactClient.tsx
│   ├── research/
│   │   ├── page.tsx
│   │   └── ResearchClient.tsx
│   ├── terms/page.tsx
│   ├── privacy/page.tsx
│   ├── api/                          Edge Runtime API routes
│   │   ├── analyze/route.ts          ← PRIMARY AI endpoint (Groq → Gemini fallback chain)
│   │   ├── gemini/route.ts           ← Re-exports analyze/route (legacy alias)
│   │   ├── alphafold/route.ts        AlphaFold EBI CORS proxy
│   │   ├── pubchem/route.ts          PubChem 3D SDF lookup
│   │   ├── fba/route.ts              Flux Balance Analysis engine (Node.js runtime)
│   │   └── workbench/route.ts        Workbench state sync & project ledger
│   └── tools/
│       ├── page.tsx                  Tools directory index
│       ├── layout.tsx                Tools shell layout
│       ├── catdes/                   Catalyst Designer
│       ├── cellfree/                 Cell-Free Simulation
│       ├── cethx/                    Cell Thermodynamics
│       ├── dbtlflow/                 DBTL Cycle Tracker
│       ├── dyncon/                   Dynamic Control
│       ├── fbasim/                   Flux Balance Analysis
│       ├── gecair/                   Gene Circuit Reasoner
│       ├── genmim/                   Gene Minimization
│       ├── metabolic-eng/            Metabolic Engineering Lab
│       ├── multio/                   Multi-Omics Integration
│       ├── nexai/                    AI Research Agent
│       ├── pathd/                    Pathway Designer (wraps MetabolicEngPage)
│       ├── proevol/                  Protein Evolution
│       └── scspatial/                Single-Cell Spatial
│
├── src/
│   ├── App.tsx                       Main application root
│   ├── types.ts                      Core interfaces: PathwayNode, PathwayEdge, GeneratedPathway
│   ├── components/
│   │   ├── Hero.tsx
│   │   ├── ThreeScene.tsx            3D pathway visualization (GLSL shaders, pastel palette)
│   │   ├── NodePanel.tsx             3-tab scientific workbench
│   │   ├── PaperAnalyzer.tsx         AI paper analysis (Groq primary)
│   │   ├── SemanticSearch.tsx        6-database parallel search
│   │   ├── MoleculeViewer.tsx        PubChem 3D small molecules
│   │   ├── CellImageViewer.tsx       Microscopy image search
│   │   ├── KineticPanel.tsx          Michaelis-Menten kinetics + RK4 ODE
│   │   ├── ThermodynamicsPanel.tsx   ΔG free energy calculation
│   │   ├── ProteinViewer.tsx         3Dmol.js protein rendering
│   │   ├── ide/
│   │   │   ├── IDEShell.tsx          ← FORBIDDEN: never modify
│   │   │   ├── IDETopBar.tsx         ← FORBIDDEN: never modify
│   │   │   ├── IDESidebar.tsx        ← FORBIDDEN: never modify
│   │   │   ├── ToolsLayoutShell.tsx
│   │   │   ├── tokens.ts             Design tokens (colors, spacing, typography)
│   │   │   └── shared/               Shared IDE components (DataTable, MetricCard, Pagination…)
│   │   ├── tools/
│   │   │   ├── CATDESPage.tsx        Catalyst Designer
│   │   │   ├── CellFreePage.tsx      Cell-free simulation
│   │   │   ├── CETHXPage.tsx         Cell thermodynamics
│   │   │   ├── DBTLflowPage.tsx      ← FORBIDDEN: never modify
│   │   │   ├── DynConPage.tsx        Dynamic control
│   │   │   ├── FBASimPage.tsx        Flux Balance Analysis
│   │   │   ├── GECAIRPage.tsx        ← FORBIDDEN: never modify
│   │   │   ├── GenMIMPage.tsx        Gene minimization
│   │   │   ├── MetabolicEngPage.tsx  Main 3D lab (ThreeScene + NodePanel + DBTL)
│   │   │   ├── MultiOPage.tsx        Multi-omics integration
│   │   │   ├── NEXAIPage.tsx         AI research agent
│   │   │   ├── PathDPage.tsx         Wraps MetabolicEngPage
│   │   │   ├── ProEvolPage.tsx       ← FORBIDDEN: never modify
│   │   │   ├── ScSpatialPage.tsx     Single-cell spatial
│   │   │   └── shared/               toolRegistry.ts, toolSchemas.ts, workbenchConfig.ts
│   │   └── workbench/
│   │       ├── WorkbenchSyncProvider.tsx   Root provider (wraps entire app)
│   │       ├── WorkbenchExperimentLedger.tsx
│   │       ├── WorkbenchDecisionTracePanel.tsx
│   │       ├── WorkbenchEvidenceTracePanel.tsx
│   │       ├── WorkbenchAuditTimeline.tsx
│   │       └── workbenchTheme.ts     Sepia/paper design tokens
│   ├── data/                         Mock data + pathway JSON
│   │   ├── pathwayData.json          Artemisinin showcase pathway
│   │   └── mock*.ts                  Per-tool mock datasets
│   ├── machines/
│   │   ├── metabolicMachine.ts       XState FSM for metabolic lab
│   │   └── analysisMachine.ts
│   ├── server/
│   │   ├── fbaEngine.ts              LP simplex solver
│   │   └── workbenchDb.ts            better-sqlite3 ledger
│   ├── services/                     Per-tool simulation engines
│   ├── store/
│   │   ├── uiStore.ts                Zustand UI state
│   │   └── workbenchStore.ts         Zustand workbench state
│   └── utils/
│       ├── kinetics.ts               Michaelis-Menten + RK4
│       ├── thermodynamics.ts         ΔG group contribution
│       └── vizUtils.ts               Convex hull, visualization primitives
│
├── .claude/commands/
│   └── nexus-bio-viz.md              Visualization upgrade skill (/nexus-bio-viz)
├── __tests__/                        Jest unit tests
├── vercel.json                       ← Do not modify
├── next.config.js
├── tailwind.config.js
└── package.json
```

---

## All 13 Tool Pages

| # | Route | Component | What It Does |
|---|-------|-----------|--------------|
| 1 | `/tools/pathd` | `PathDPage.tsx` | Pathway Designer — wraps MetabolicEngPage; main 3D metabolic pathway lab with DBTL integration |
| 2 | `/tools/metabolic-eng` | `MetabolicEngPage.tsx` | Full metabolic lab: 3D FluidSim canvas, NodePanel, ThreeScene, XState FSM, 60 Hz FBA worker |
| 3 | `/tools/catdes` | `CatalystDesignerPage.tsx` | Enzyme design: binding affinity radar, sequence design, flux cost, Pareto front, mutagenesis targeting |
| 4 | `/tools/cellfree` | `CellFreePage.tsx` | Cell-free system simulation: gene construct design, expression yield prediction |
| 5 | `/tools/cethx` | `CETHXPage.tsx` | Cell thermodynamics: waterfall ΔG cascade, ATP accounting, pathway feasibility |
| 6 | `/tools/dbtlflow` | `DBTLflowPage.tsx` | DBTL cycle tracker: iteration waterfall, protocol generation, SBOL serialization |
| 7 | `/tools/dyncon` | `DynConPage.tsx` | Dynamic control: bioreactor simulation, Hill function feedback, RK4 ODE, convergence analysis |
| 8 | `/tools/fbasim` | `FBASimPage.tsx` | Flux Balance Analysis: single + community FBA, knockout/OE strategies, shadow prices, carbon efficiency |
| 9 | `/tools/gecair` | `GECAIRPage.tsx` | Gene circuit reasoner: logic gate design, Hill curve modeling, circuit dynamics, gate efficiency |
| 10 | `/tools/genmim` | `GenMIMPage.tsx` | Gene minimization: CRISPRi knockdown scheduling, genome map, efficiency heatmap, greedy optimization |
| 11 | `/tools/multio` | `MultiOPage.tsx` | Multi-omics: VAE/UMAP embeddings, volcano plots, MOFA+ factors, perturbation prediction |
| 12 | `/tools/nexai` | `NEXAIPage.tsx` | AI research agent: citation network graph (year×relevance scatter), Socratic questioning, literature support map |
| 13 | `/tools/proevol` | `ProEvolPage.tsx` | Protein evolution: fitness landscape heatmap, evolution trajectory, basin climbing, sequence diversity |
| 14 | `/tools/scspatial` | `ScSpatialPage.tsx` | Single-cell spatial: hexagonal spot grid, UMAP/3D spatial viz, cluster efficiency, gene expression heatmap |

---

## API Architecture

### AI Endpoint — `app/api/analyze/route.ts` (Edge Runtime)

The primary AI endpoint. Uses the "Axon" system prompt (predictive design core). Request order is **fixed and must never be reversed**:

```
1. Groq  llama-3.3-70b-versatile    ← PRIMARY (1000 req/day, fastest)
2. Groq  llama3-70b-8192            ← Groq backup
3. Gemini gemini-2.0-flash-lite     ← Google fallback (250 req/day)
4. Gemini gemini-1.5-flash          ← Final fallback
5. 503 error                        ← All providers down
```

`app/api/gemini/route.ts` is just a legacy re-export alias — all logic lives in `analyze/route.ts`.

### Supporting API Routes

| Route | Runtime | Purpose |
|-------|---------|---------|
| `app/api/alphafold/route.ts` | Edge | CORS proxy for EBI AlphaFold — input: `?id=<UniProtID>`, output: PDB text |
| `app/api/pubchem/route.ts` | Edge | PubChem 3D SDF — mode 1: `?cid=<CID>`, mode 2: `?name=<compound>` |
| `app/api/fba/route.ts` | Node.js | FBA solver (simplex LP) — single-species + community FBA |
| `app/api/workbench/route.ts` | Node.js | Workbench project sync — GET/PUT with revision conflict detection |

---

## Environment Variables

Set in Vercel dashboard. Never hardcode in source.

```
GROQ_API_KEY      Groq API authorization (used in app/api/analyze/route.ts)
GEMINI_API_KEY    Google Gemini authorization (used in app/api/analyze/route.ts)
```

`NODE_ENV` and `VERCEL` are set automatically by the platform.

---

## GOTCHAS — Things You Must Never Do

1. **No light backgrounds** — Never use `#FFFFFF`, `#F5F7FA`, `#F2F5F8`, or any light color. Dark theme only: `#0d0f14`, `#10131a`, `#050505`.

2. **No hardcoded mock responses** — All AI-generated content must be dynamically derived from real input. Never return hardcoded pathway data regardless of input.

3. **Never reverse the Groq → Gemini API order** — Groq is always primary. Gemini is always fallback. No exceptions.

4. **Real scientific algorithms only** — every tool must implement the actual math (MM kinetics, RK4 ODE, LP simplex, ΔG group contribution). No placeholder calculations.

5. **meshLambertMaterial only in Three.js** — never use `meshStandardMaterial`. It causes white bloom under the current tone mapping (`THREE.LinearToneMapping`).

6. **3Dmol.js is CDN-only** — loaded from `https://3Dmol.org/build/3Dmol-min.js`. It is not an npm package.

7. **AlphaFold and PubChem are proxied** — always call `/api/alphafold` and `/api/pubchem`, never fetch EBI or PubChem directly from the browser (CORS).

---

## Visualization Standards

The `/nexus-bio-viz` skill (`.claude/commands/nexus-bio-viz.md`) defines standards for upgrading tool visualizations.

**Design rules (all non-negotiable):**
- Dark background only: `#050505` or `#05070b` for SVG canvases
- Pastel accent palette: `#C8D8E8`, `#C8E0D0`, `#DDD0E8`, `#E8DCC8`, `#93CB52`, `#5151CD`, `#FA8072`
- `meshLambertMaterial` for all Three.js geometry
- Real algorithms only — no placeholder math
- Convex hulls via `computeConvexHull` + `expandHull` from `src/utils/vizUtils.ts`
- SVG directed edges use `<marker>` in `<defs>` for arrowheads
- Never hardcode final values — compute from props/state

**Per-tool visualization targets:**

| Tool | Target Aesthetic |
|------|-----------------|
| ScSpatial | 10x Visium hexagonal spot grid, UMAP with convex hull cluster territories |
| MultiO | VAE/UMAP scatter with per-layer convex hull halos, volcano with gene labels |
| FBAsim | Escher-style: subsystem background rects, flux-width Bezier edges with arrowhead markers |
| ProEvol | Viridis-palette heatmap with marching-squares contour lines, peak markers |
| GECAIR | Hill curve with area fill, logic surface heatmap with isocontours |
| GenMIM | IGV-style horizontal arrow gene bodies on chromosome ideogram |
| NEXAI | Year×relevance scatter, quadratic arc bridge edges, glow halos on high-relevance nodes |
| DBTLflow | Circular 4-arc progress ring, iteration waterfall |
| DynCon | Multi-lane time-series with setpoint bands, RK4 trajectory |
| CETHX | Waterfall ΔG cascade with ATP-step highlights |

---

## NodePanel Tab System

```
Tab 1: Overview    Summary + Evidence Trace + Connections (collapsible) + External IDs
Tab 2: Structure   Smart switching:
                     enzyme + ENZYME_ALPHAFOLD entry  →  AlphaFold/RCSB rotating protein (3Dmol.js)
                     nucleic acid                     →  RCSB structures
                     metabolite                       →  PubChem 3D conformer
                     cell / tissue / bio entity       →  CellImageViewer microscopy
Tab 3: Analysis    enzyme     →  KineticPanel (MM + RK4 ODE)
                   metabolite →  ThermodynamicsPanel (ΔG group contribution)
```

---

## Showcase Pathway Data

Artemisinin biosynthesis — Ro et al., *Nature* 2006 (7 nodes):

```
acetyl_coa → hmg_coa → mevalonate → fpp → amorpha_4_11_diene → artemisinic_acid → artemisinin
```

AlphaFold entries:
```typescript
const ENZYME_ALPHAFOLD = {
  amorpha_4_11_diene: { afId: 'Q9AR04', pdbId: '2ON5' },
  artemisinic_acid:   { afId: 'Q8LKJ5', pdbId: '3CLA' },
  fpp:                { afId: 'P08836', pdbId: '1FPS' },
  hmg_coa:            { afId: 'P12683', pdbId: '1DQA' },
};
```

PubChem CIDs:
```typescript
const SHOWCASE_PUBCHEM_CIDS = {
  acetyl_coa: 444493, hmg_coa: 439400, mevalonate: 441,
  fpp: 445483, amorpha_4_11_diene: 11230765,
  artemisinic_acid: 5362031, artemisinin: 68827,
};
```

---

## Workbench Architecture

Better-SQLite3 ledger (`src/server/workbenchDb.ts`) stores project state server-side. Synced via `app/api/workbench/route.ts` (GET/PUT with revision conflict detection). `WorkbenchSyncProvider` wraps the entire app tree and manages state via Zustand (`src/store/workbenchStore.ts`).

Features: project versioning, experiment ledger, actor/member tracking, immutable audit trail.

---

## Contact

- Email: fuchanze@gmail.com
- LinkedIn: linkedin.com/in/zhangze-foo-3575ba359
