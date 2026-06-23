# Nexus-Bio 1.0

![Next.js](https://img.shields.io/badge/Next.js-15-000000?style=flat-square&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-000000?style=flat-square&logo=vercel&logoColor=white)
![Tests](https://img.shields.io/badge/Tests-3346_passing-4CAF50?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-4CAF50?style=flat-square)

**Synthetic Biology AI Platform — From Literature to Validated Pathway Decisions**

Live: [nexus-bio-1-0.vercel.app](https://nexus-bio-1-0.vercel.app)

---

## What Problem Does Nexus-Bio Solve?

Synthetic biology research requires integrating data from metabolic databases, running flux balance analysis, designing enzymes, simulating cell-free systems, analyzing omics data, and tracking iterative design-build-test-learn cycles. Today, researchers juggle 10+ disconnected tools with no data flow between them, manually copy-pasting results from one tool to the next.

Nexus-Bio connects the entire workflow into a single platform. Results from one tool automatically feed into the next. Every computation is backed by real algorithms (LP simplex, RK4 ODE, Levenberg-Marquardt, EKF, Gillespie SSA, MPC, UMAP, MOFA+) and real database queries (KEGG, BiGG, BRENDA, SABIO-RK, UniProt, PubChem, AlphaFold, Semantic Scholar). When a database is unavailable, tools fall back gracefully to demo data with clear indicators.

---

## Smart Entry — Goal-Driven Routing

Nexus-Bio features a **Smart Entry** system that routes users to the right tools based on their input:

```
Input "artemisinin"  → Pathway Discovery → FBA → Enzyme Design → CRISPR Strategy
Input "E. coli K-12" → FBA Simulation → Strain Design → Genetic Circuit
Input "10.1038/..."  → Paper Analysis → Pathway Extraction
Input "50% yield"    → FBA Simulation → Strain Design → Bioprocess Control
```

The search bar on the homepage recognizes molecules, strains, DOIs, and production targets in real-time, with autocomplete from PubChem's 110M+ compound database.

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

## 14 Tool Pages — 37+ Compute Engines

### Stage 1: Design & Discovery

#### 1. PATHD — Pathway Designer
**Route:** `/tools/pathd`
**What it does:** Design metabolic pathways from target molecule to precursor. Search KEGG for real metabolic routes, discover novel biosynthetic pathways via A* search, evaluate thermodynamic feasibility.

**Engines:** `pathwayDiscoveryEngine` (A* search + ΔG cascade), `retrosynthesis` (backward BFS)

**Key features:**
- KEGG pathway search with live/demo data indicator
- Retrosynthesis from SMILES
- Pathway discovery with thermodynamic scoring
- Goal Context workflow integration

**Database:** KEGG (live pathway queries)

---

### Stage 2: Simulation & Optimization

#### 2. FBASim — Flux Balance Analysis
**Route:** `/tools/fbasim`
**What it does:** single-species simplex LP plus illustrative two-species demo mode. single-species FBA plus demo-only two-species comparison. Knockout, overexpression, and shadow price analysis. Community FBA mode — illustrative two-species demo, NOT a joint community LP.

**Engines:** `fbaEngine` (simplex LP), `fbaFVA` (flux variability), `fbaPFBA` (parsimonious FBA), `fbaGPR` (gene-protein-reaction rules), `fbaOptKnock` (bilevel knockout), `fbaFSEOF` (flux scanning), `consortiumDesignEngine` (SteadyCom + quorum sensing)

**Key features:**
- BiGG model selector (real E. coli iML1515 and other genome-scale models)
- Custom model upload (CSV: reaction_id, lb, ub, stoichiometry)
- Strain design pipeline: FSEOF + OptKnock → FBA evaluation → Pareto ranking
- Consortium design with multi-species optimization
- Shadow prices and carbon efficiency metrics

**Database:** BiGG Models (live model loading)

#### 3. CETHX — Cell Thermodynamics
**Route:** `/tools/cethx`
**What it does:** Calculate ΔG free energy changes for metabolic reactions. Waterfall cascade visualization, ATP accounting, and pathway feasibility assessment.

**Key features:**
- PubChem compound lookup (real molecular formulas, weights)
- Group contribution method for ΔG estimation
- Waterfall ΔG cascade chart
- Custom thermodynamic data upload (CSV)

**Database:** PubChem (live compound data)

#### 4. CatDes — Catalyst Designer
**Route:** `/tools/catdes`
**What it does:** Design and optimize enzymes for metabolic pathways. Left-right split layout: 3D protein viewer + sidebar with kinetics, binding, residue analysis, and mutation predictions.

**Engines:** `inverseFoldingEngine` (ProteinMPNN-style), `biosensorDesignEngine` (Hill function + cross-talk), `rnaEngine` (siRNA/ribozyme/toehold/aptamer), `regulatoryDesignEngine` (promoter/RBS/terminator), `plasmidDesignEngine`

**Key features:**
- SABIO-RK live enzyme kinetics (Km, kcat, kcat/Km) with local BRENDA fallback
- Coordinate-based empirical docking score (PDB + SDF atom contacts)
- AlphaFold / ESMFold protein structure prediction
- PDB file upload for custom structures
- BLOSUM62-based sequence design with codon optimization
- ΔΔG mutation predictions (BLOSUM62 linear model)
- Biosensor design with Hill function modeling
- RNA engineering (siRNA, ribozyme, toehold switch, aptamer)
- Regulatory cassette design (promoter + RBS + terminator)

**Database:** SABIO-RK (kinetics), AlphaFold (structure), PubChem (ligands)

#### 5. ProEvol — Protein Evolution
**Route:** `/tools/proevol`
**What it does:** Simulate directed evolution campaigns. Fitness landscape visualization, evolution trajectory tracking, basin climbing algorithms, and sequence diversity analysis.

**Key features:**
- Fitness landscape heatmap (viridis palette)
- Evolution trajectory visualization
- Gaussian Process regression for fitness prediction
- Campaign export (JSON/CSV)

---

### Stage 3: Chassis & Control

#### 6. GenMIM — Genome Minimization
**Route:** `/tools/genmim`
**What it does:** Plan CRISPRi-based genome minimization with multiplex CRISPR strategies, biosafety assessment, and GEM reconstruction.

**Engines:** `multiplexCRISPREngine` (epistasis-aware combinatorial search), `safetyEngine` (biosafety assessment), `gemReconstructionEngine` (GPR + iJO1366 assembly), `syntheticGenomicsEngine` (codon optimization)

**Key features:**
- Greedy knockdown scheduling with growth impact prediction
- Multiplex CRISPR strategy with Rule Set 2 on-target scoring
- Biosafety risk assessment with containment recommendations
- GEM reconstruction with gap-filling and essential gene detection
- Custom gene target upload (CSV)

#### 7. GECAIR — Gene Circuit Reasoner
**Route:** `/tools/gecair`
**What it does:** Design and analyze gene circuits with logic gate modeling. Hill function dynamics, circuit topology library, gate efficiency calculation.

**Key features:**
- Hill curve visualization with area fill
- Logic gate design (AND, OR, NOT, NAND, NOR)
- Circuit dynamics simulation (ODE + Gillespie SSA)
- Gate efficiency metrics

#### 8. DynCon — Dynamic Control
**Route:** `/tools/dyncon`
**What it does:** Simulate bioreactor control systems with digital twin, biprocess optimization, and bioreactor analytics.

**Engines:** `digitalTwinEngine` (EKF + Monod kinetics), `bioprocessOptimizationEngine` (Pontryagin maximum principle), `bioreactorAnalyticsEngine`

**Key features:**
- PID controller tuning with Hill function feedback
- Digital twin with Extended Kalman Filter state estimation
- Bioprocess optimization with structured kinetics
- Fed-batch dynamics with RK4 ODE integration
- Monte Carlo forecasting with confidence intervals

---

### Stage 4: Test & Iterate

#### 9. CellFree — Cell-Free Simulation
**Route:** `/tools/cellfree`
**What it does:** Simulate cell-free protein synthesis (TX-TL) with heuristic expression estimates. Resource-aware ODE model with transcription, translation, energy pools, and ribosome dynamics. Plate-reader kinetic fitting.

**Key features:**
- SABIO-RK reference kinetics display
- CSV data upload for user experiments
- Levenberg-Marquardt curve fitting
- Triple-fallback error handling

#### 10. DBTLflow — DBTL Cycle Tracker
**Route:** `/tools/dbtlflow`
**What it does:** Track design-build-test-learn iterations. Protocol generation, SBOL serialization, closed-loop DBTL automation.

**Key features:**
- Circular 4-arc progress ring
- Iteration waterfall chart
- Protocol generation
- SBOL export
- LearnedDeltaPack feedback to upstream tools

#### 11. MultiO — Multi-Omics Integration
**Route:** `/tools/multio`
**What it does:** Integrate transcriptomics, proteomics, and metabolomics data with deterministic sensitivity sketches. PCA biplot, correlation heatmap, volcano plot, and layer signal scoring.

**Engines:** `mlMetabolicEngine` (ML predictions), `fluxomicsEngine` (13C flux analysis), `mfa13CEngine` (EMU decomposition + Monte Carlo CI)

**Key features:**
- VAE/UMAP embeddings
- Volcano plots with gene labels
- Fluxomics with bottleneck analysis
- 13C-MFA with Monte Carlo confidence intervals
- Custom omics data upload (CSV)

#### 12. ScSpatial — Single-Cell Spatial
**Route:** `/tools/scspatial`
**What it does:** Analyze single-cell spatial transcriptomics data. h5ad file ingestion, clustering, marker gene detection, and spatial visualization.

**Key features:**
- h5ad file upload and processing
- Louvain community detection
- Wilcoxon rank-sum marker gene discovery
- Hexagonal spot grid (10x Visium style)
- UMAP with convex hull cluster territories

#### 13. NEXAI — AI Research Agent
**Route:** `/tools/nexai`
**What it does:** AI-powered literature search and analysis with multi-source paper search (OpenAlex + Semantic Scholar + PubMed), citation verification, and Axon AI copilot.

**Key features:**
- Multi-source paper search (250M+ papers)
- Citation verification via PubMed
- Cognitive Router (4-tier: cache → solver → solver+LLM → LLM)
- Agentic mode with tool execution
- Evidence map visualization

---

## Database Integrations (8)

| Database | API Route | Tools | What It Provides |
|----------|-----------|-------|------------------|
| **KEGG** | `/api/kegg` | PATHD | Metabolic pathways, reactions, compounds |
| **BiGG** | `/api/bigg` | FBASim | Genome-scale metabolic models |
| **SABIO-RK** | `/api/sabio` | CatDes, CellFree | Enzyme kinetics (Km, kcat, Vmax) |
| **BRENDA** | `/api/brenda` | CatDes, CellFree | Enzyme kinetics (local fallback) |
| **UniProt** | `/api/uniprot` | ProEvol | Protein sequences, function, annotations |
| **PubChem** | `/api/pubchem` | CETHX, CatDes | Compound structures, SDF 3D conformers |
| **AlphaFold** | `/api/alphafold` | CatDes | Protein 3D structure predictions |
| **Semantic Scholar** | (direct API) | NEXAI | Literature search, citation context |

**Data source indicator:** Every tool shows a badge — 🟢 **Live** (real database) or 🟡 **Demo** (fallback data). The `DataSourceBadge` component shows connection status.

---

## Scientific Honesty

Every compute engine in Nexus-Bio includes:
- **`@scientific_provenance` annotation** — ALGORITHM, REFERENCE, KNOWN_LIMITATIONS
- **Validity badge** — REAL / PARTIAL / DEMO with specific caption
- **DataSourceBadge** — live vs demo data indicator
- **Empirical scoring** — coordinate-based docking (not string hashing)
- **SABIO-RK integration** — real enzyme kinetics (not hardcoded defaults)

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
| Fonts | Self-hosted (Space Grotesk, Public Sans, IBM Plex Mono, IBM Plex Sans Condensed, Source Serif 4) |

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
│   │   ├── pubchem/              PubChem compound proxy + autocomplete
│   │   ├── alphafold/            AlphaFold structure proxy
│   │   ├── alphafold3/           AlphaFold 3 multi-chain
│   │   ├── esmfold/              ESMFold structure prediction
│   │   ├── esm2/                 ESM-2 embeddings
│   │   ├── equilibrator/         Thermodynamic calculations
│   │   ├── sabio/                SABIO-RK enzyme kinetics
│   │   ├── fba/                  FBA solver (Node.js runtime)
│   │   ├── pipeline/             Multi-agent pipeline dispatch
│   │   ├── docking/              Coordinate-based docking score
│   │   └── workbench/            Workbench state sync
│   ├── start/                    Smart Entry page
│   └── tools/                    14 tool pages
│
├── src/
│   ├── components/
│   │   ├── tools/                Tool page components (14 tools)
│   │   │   ├── shared/           ToolShell, tabs, shared components
│   │   │   ├── catdes/CatDesSidebar.tsx
│   │   │   └── fbasim/ConsortiumPanel.tsx
│   │   ├── ide/                  IDE shell, sidebar, top bar
│   │   │   └── shared/           MetricCard, ExportButton, DataSourceBadge
│   │   ├── workbench/            Workbench panels and sync
│   │   └── molecular/            CatalystViewer3D, MoleculeViewer
│   ├── lib/
│   │   ├── smart-parser.ts       Smart Entry input classification
│   │   └── goal-context.ts       Goal-driven workflow management
│   ├── server/                   27 compute engines
│   ├── modules/                  5 module engines (ML, RNA, biosafety, GEM, fluxomics)
│   ├── services/                 Database clients, AI services, engine wrappers
│   ├── store/                    Zustand stores (uiStore, workbenchStore)
│   ├── hooks/                    Custom hooks (useToolTheme, usePersistedState)
│   ├── theme/                    Design tokens (colors, typography, spacing)
│   └── utils/                    Kinetics, thermodynamics, statistics, viz
│
├── __tests__/                    205 test suites, 3346 tests
├── docs/                         Design specs, plans, audit reports
├── proof-package/                Trust runtime verification artifacts
├── reference_impl_py/            Python reference implementation
└── benchmarks/                   Trust runtime benchmark cases
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

All tool simulations work offline without API keys. Database integrations fall back to demo data when APIs are unavailable.

### Quality Checks

```bash
npx tsc --noEmit          # Type check
npm test                   # Run all tests (3346)
npm run build              # Production build
```

---

## Report System

Nexus-Bio includes a one-click report export that collects all tool results into a single Markdown document.

**How to use:** Click the "Export Report" button in the workbench status bar. The report is generated from every tool payload saved in the current workbench project.

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
