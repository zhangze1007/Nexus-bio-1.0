# Nexus-Bio 1.0

![Next.js](https://img.shields.io/badge/Next.js-15-000000?style=flat-square&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-000000?style=flat-square&logo=vercel&logoColor=white)
![Tests](https://img.shields.io/badge/Tests-1994_passing-4CAF50?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-4CAF50?style=flat-square)

**Synthetic Biology AI Platform — From Literature to Validated Pathway Decisions**

Live: [nexus-bio-1-0.vercel.app](https://nexus-bio-1-0.vercel.app)

---

## What Problem Does Nexus-Bio Solve?

Synthetic biology research requires integrating data from metabolic databases, running flux balance analysis, designing enzymes, simulating cell-free systems, analyzing omics data, and tracking iterative design-build-test-learn cycles. Today, researchers juggle 10+ disconnected tools with no data flow between them, manually copy-pasting results from one tool to the next.

Nexus-Bio connects the entire workflow into a single platform. Results from one tool automatically feed into the next. Every computation is backed by real algorithms (LP simplex, RK4 ODE, Louvain clustering, power-iteration PCA) and real database queries (KEGG, BiGG, BRENDA, UniProt, PubChem, AlphaFold). When a database is unavailable, tools fall back gracefully to demo data with clear indicators.

---

## 4-Stage Research Cycle

```
┌─────────────────────────────────────────────────────────────────┐
│                    INPUT: Target Molecular Product               │
└──────────────────────────────┬──────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  STAGE 1: DESIGN & DISCOVERY                                     │
│  ┌─────────┐    ┌──────────┐                                     │
│  │  PATHD   │───►│  LAB     │  Pathway design, enzyme selection  │
│  │ (KEGG)   │    │ (BRENDA) │  ΔG feasibility, route synthesis   │
│  └─────────┘    └──────────┘                                     │
└──────────────────────────────┬──────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  STAGE 2: SIMULATION & OPTIMIZATION                              │
│  ┌────────┐  ┌────────┐  ┌──────────┐  ┌──────────┐             │
│  │ FBASim │  │ CETHX  │  │ ProEvol  │  │ CatDes   │             │
│  │ (BiGG) │  │(PubChem│  │ (UniProt)│  │(BRENDA + │             │
│  │        │  │        │  │          │  │AlphaFold)│             │
│  └────────┘  └────────┘  └──────────┘  └──────────┘             │
└──────────────────────────────┬──────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  STAGE 3: CHASSIS & CONTROL                                      │
│  ┌────────┐  ┌────────┐  ┌──────────┐                            │
│  │ GenMIM │  │ GECAIR │  │ DynCon   │  Genome minimization,     │
│  │        │  │        │  │          │  circuit design, control   │
│  └────────┘  └────────┘  └──────────┘                            │
└──────────────────────────────┬──────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  STAGE 4: TEST & ITERATE                                         │
│  ┌──────────┐  ┌──────────┐  ┌────────┐  ┌──────────┐           │
│  │ CellFree │  │ DBTLflow │  │ MultiO │  │ScSpatial │           │
│  │(BRENDA)  │  │          │  │        │  │          │           │
│  └──────────┘  └──────────┘  └────────┘  └──────────┘           │
│                         └──► feedback ──► next iteration         │
└──────────────────────────────────────────────────────────────────┘
```

---

## 14 Tools — Detailed Guide

### Stage 1: Design & Discovery

#### 1. PATHD — Pathway Designer
**Route:** `/tools/pathd`
**What it does:** Design metabolic pathways from target molecule to precursor. Search KEGG for real metabolic routes, visualize pathway graphs in 3D, evaluate thermodynamic feasibility.

**Key features:**
- KEGG pathway search with live/demo data indicator
- 3D pathway graph visualization (Three.js)
- Node panel with kinetics, thermodynamics, and structure tabs
- DBTL integration for iterative refinement

**Database:** KEGG (live pathway queries)

---

### Stage 2: Simulation & Optimization

#### 2. FBASim — Flux Balance Analysis
**Route:** `/tools/fbasim`
**What it does:** single-species simplex LP plus illustrative two-species demo mode. single-species FBA plus demo-only two-species comparison. Knockout, overexpression, and shadow price analysis.

**Key features:**
- BiGG model selector (load real E. coli iML1515 or other genome-scale models)
- Simplex LP solver (two-phase, in-browser)
- Knockout and OE strategy analysis
- Shadow prices and carbon efficiency metrics
- Community FBA mode — illustrative two-species demo, NOT a joint community LP

**Database:** BiGG Models (live model loading)

#### 3. CETHX — Cell Thermodynamics
**Route:** `/tools/cethx`
**What it does:** Calculate ΔG free energy changes for metabolic reactions. Waterfall cascade visualization showing energy landscape of a pathway. ATP accounting and pathway feasibility assessment.

**Key features:**
- PubChem compound lookup (real molecular formulas, weights)
- Group contribution method for ΔG estimation
- Waterfall ΔG cascade chart
- ATP step highlights and energy balance

**Database:** PubChem (live compound data)

#### 4. CatDes — Catalyst Designer
**Route:** `/tools/catdes`
**What it does:** Design and optimize enzymes for metabolic pathways. Binding affinity prediction (MM-PBSA style), BLOSUM62-based sequence diversification, codon optimization, and mutagenesis site prediction.

**Key features:**
- BRENDA enzyme kinetics lookup (real Km/Kcat values)
- AlphaFold protein structure auto-fetch
- Binding affinity radar chart
- Sequence design with codon optimization
- Pareto-front multi-objective ranking
- Mutagenesis site prediction (conservation-weighted)

**Database:** BRENDA (kinetics), AlphaFold (structure)

#### 5. ProEvol — Protein Evolution
**Route:** `/tools/proevol`
**What it does:** Simulate directed evolution campaigns. Fitness landscape visualization, evolution trajectory tracking, basin climbing algorithms, and sequence diversity analysis.

**Key features:**
- Fitness landscape heatmap (viridis palette)
- Evolution trajectory visualization
- Basin climbing simulation
- Sequence diversity metrics
- Campaign export (JSON/CSV)

---

### Stage 3: Chassis & Control

#### 6. GenMIM — Genome Minimization
**Route:** `/tools/genmim`
**What it does:** Plan CRISPRi-based genome minimization. Greedy knockdown scheduling, gene essentiality scoring, growth impact prediction, and genome map visualization.

**Key features:**
- 20 literature-sourced CRISPRi targets (Rousset et al. 2018)
- IGV-style gene arrow visualization
- Efficiency heatmap
- Greedy optimization algorithm

#### 7. GECAIR — Gene Circuit Reasoner
**Route:** `/tools/gecair`
**What it does:** Design and analyze gene circuits with logic gate modeling. Hill function dynamics, circuit topology library, gate efficiency calculation.

**Key features:**
- Hill curve visualization with area fill
- Logic gate design (AND, OR, NOT, NAND, NOR)
- Circuit dynamics simulation (ODE)
- Gate efficiency metrics

#### 8. DynCon — Dynamic Control
**Route:** `/tools/dyncon`
**What it does:** Simulate bioreactor control systems. PID controller tuning, Hill function feedback, Monod growth model, RK4 ODE integration, and fed-batch dynamics.

**Key features:**
- Multi-lane time-series visualization
- RBS registry mapping (iGEM parts)
- Convergence analysis
- Parameter oscillation testing
- Fed-batch volume dynamics

---

### Stage 4: Test & Iterate

#### 9. CellFree — Cell-Free Simulation
**Route:** `/tools/cellfree`
**What it does:** Simulate cell-free protein synthesis (TX-TL) with heuristic expression estimates. Resource-aware ODE model with transcription, translation, energy pools, and ribosome dynamics. Plate-reader kinetic fitting.

**Key features:**
- BRENDA reference kinetics display
- CSV data upload for user experiments
- Levenberg-Marquardt curve fitting
- In-vitro to in-vivo heuristic estimation
- Radar chart with yield, depletion, reproducibility

**Database:** BRENDA (reference Km/Kcat)

#### 10. DBTLflow — DBTL Cycle Tracker
**Route:** `/tools/dbtlflow`
**What it does:** Track design-build-test-learn iterations. Iteration waterfall, protocol generation, SBOL serialization, and learned feedback packages.

**Key features:**
- Circular 4-arc progress ring
- Iteration waterfall chart
- Protocol generation
- SBOL export
- LearnedDeltaPack feedback to upstream tools

#### 11. MultiO — Multi-Omics Integration
**Route:** `/tools/multio`
**What it does:** Integrate transcriptomics, proteomics, and metabolomics data with deterministic sensitivity sketches. PCA biplot, correlation heatmap, volcano plot, and layer signal scoring.

**Key features:**
- Real PCA biplot (Gabriel scaling, shared coordinate system)
- 20×20 correlation heatmap
- Volcano plot with gene labels
- Layer signal scores (variance/discordance analysis)
- UMAP embedding with convex hull clusters

#### 12. ScSpatial — Single-Cell Spatial
**Route:** `/tools/scspatial`
**What it does:** Analyze single-cell spatial transcriptomics data. h5ad file ingestion, Louvain clustering, marker gene detection, PAGA trajectory, and hexagonal spot grid visualization.

**Key features:**
- h5ad file upload and processing
- Louvain community detection (real algorithm)
- Wilcoxon rank-sum marker gene discovery with BH FDR correction
- LOESS-based HVG detection (tricube kernel)
- Hexagonal spot grid (10x Visium style)
- UMAP with convex hull cluster territories
- PAGA trajectory inference

#### 13. NEXAI — AI Research Agent
**Route:** `/tools/nexai`
**What it does:** AI-powered literature search and analysis. Citation network visualization, Socratic questioning, evidence grounding, and literature support mapping.

**Key features:**
- Year×relevance scatter plot
- Quadratic arc bridge edges
- Citation verification
- Socratic questioning mode
- Evidence quality indicators

---

## Database Integration

Nexus-Bio queries 6 real scientific databases via API proxy routes. When a database is unavailable, tools fall back to demo data with a clear indicator.

| Database | API Route | Tools | What It Provides |
|----------|-----------|-------|------------------|
| **KEGG** | `/api/kegg` | PATHD | Metabolic pathways, reactions, compounds |
| **BiGG** | `/api/bigg` | FBASim | Genome-scale metabolic models (E. coli, yeast) |
| **BRENDA** | `/api/brenda` | CatDes, CellFree | Enzyme kinetics (Km, kcat, Kd) |
| **UniProt** | `/api/uniprot` | ProEvol | Protein sequences, function, annotations |
| **PubChem** | `/api/pubchem` | CETHX | Compound structures, formulas, molecular weight |
| **AlphaFold** | `/api/alphafold` | CatDes | Protein 3D structure predictions |

**Data source indicator:** Every tool shows a badge — 🟢 **Live** (real database) or 🟡 **Demo** (fallback data). The `DatabaseStatusDashboard` component shows connection status for all 6 databases.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Next.js 15 (App Router), Tailwind CSS v3, Framer Motion |
| 3D | Three.js 0.183, @react-three/fiber, 3Dmol.js (CDN) |
| AI | Groq API (primary), Gemini API (fallback) |
| State | Zustand 5, XState 5 |
| Database | better-sqlite3 (workbench ledger, server-side) |
| Deploy | Vercel (Edge Runtime for API proxies) |

---

## Project Structure

```
├── app/                          Next.js 15 App Router
│   ├── api/                      API routes
│   │   ├── analyze/              AI endpoint (Groq → Gemini fallback)
│   │   ├── bigg/                 BiGG Models proxy
│   │   ├── brenda/               BRENDA enzyme kinetics proxy
│   │   ├── kegg/                 KEGG pathway proxy
│   │   ├── uniprot/              UniProt protein proxy
│   │   ├── pubchem/              PubChem compound proxy
│   │   ├── alphafold/            AlphaFold structure proxy
│   │   ├── fba/                  FBA solver (Node.js runtime)
│   │   └── workbench/            Workbench state sync
│   └── tools/                    14 tool pages
│
├── src/
│   ├── components/
│   │   ├── tools/                Tool page components (14 tools)
│   │   │   └── shared/           Shared tool utilities, registry, dataflow
│   │   ├── ide/                  IDE shell, sidebar, top bar
│   │   │   └── shared/           MetricCard, ExportButton, DataSourceBadge
│   │   └── workbench/            Workbench panels and sync
│   ├── services/
│   │   ├── database/             Database clients (KEGG, BiGG, BRENDA, UniProt, PubChem)
│   │   ├── *Engine.ts            Per-tool simulation engines
│   │   └── workflowRegistry.ts   Tool contracts and dependency graph
│   ├── store/                    Zustand stores (uiStore, workbenchStore)
│   ├── machines/                 XState FSMs (metabolic, analysis)
│   ├── utils/                    Kinetics, thermodynamics, statistics, viz
│   └── data/                     Mock datasets and pathway JSON
│
├── __tests__/                    125 test suites, 1994 tests
├── docs/                         Design specs, plans, roadmap
└── proof-package/                Trust runtime verification artifacts
```

---

## Getting Started

```bash
git clone https://github.com/zhangze1007/Nexus-bio-1.0
cd Nexus-bio-1.0
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

```bash
# Optional — for AI features (analyze, paper search)
GROQ_API_KEY=your_groq_key
GEMINI_API_KEY=your_gemini_key
```

All tool simulations work offline without API keys. Database integrations (KEGG, BiGG, BRENDA, etc.) fall back to demo data when APIs are unavailable.

### Quality Checks

```bash
npx tsc --noEmit          # Type check
npm test                   # Run all tests (1994)
npm run build              # Production build
```

---

## Report System

Nexus-Bio includes a one-click report export that collects all tool results into a single Markdown document.

**How to use:** Click the "Export Report" button in the workbench status bar (bottom of the IDE). The report is generated from every tool payload saved in the current workbench project.

**What the report includes:**
- Project metadata (title, target molecule, generation date)
- Per-tool sections with summary text, data tables (FBA fluxes, thermodynamic metrics, enzyme design scores, etc.), and provenance blockquotes (data source, validity tier, assumptions)
- Automatic section ordering matching your tool execution sequence

**Output format:** Markdown (.md), easily convertible to PDF or HTML with any standard tool.

---

## Deployment

The app is deployed on Vercel. API proxy routes use Edge Runtime for low latency. Node.js runtime routes include FBA solver, workbench persistence, and ScSpatial sidecar.

---

## Contact

- **Zhang Ze Foo** — Pre-university student (STPM), Malaysia, on gap year
- Email: fuchanze@gmail.com
- LinkedIn: [linkedin.com/in/zhangze-foo-3575ba359](https://linkedin.com/in/zhangze-foo-3575ba359)

## License

MIT License — open for research and educational use.
