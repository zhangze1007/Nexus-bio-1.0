# Nexus-Bio 1.0

**Next-Gen Bio-Intelligent Architecture**

An AI-powered synthetic biology platform with 13 specialized simulation tools. The core workflow extracts metabolic pathways from scientific literature and renders them as interactive 3D visualizations — integrating AI analysis, molecular structures, protein data, kinetic simulation, flux analysis, and multi-omics in a single unified interface.

> Built by a gap-year student in Malaysia, on a tablet, in under 48 hours.

---

## Live Demo

**[nexus-bio-1-0.vercel.app](https://nexus-bio-1-0.vercel.app)**

Showcase pathway: Artemisinin biosynthesis in engineered *S. cerevisiae* — Ro et al., *Nature* 2006

---

## What It Does

Nexus-Bio implements a full 4-stage synthetic biology design cycle — from target molecule to optimized, validated construct — with NEXAI (AI research assistant) available across every stage.

**Core Research Workflow**

```
INPUT: Target Molecular Product
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  STAGE 1: DESIGN & DISCOVERY                        │
│                                                     │
│  LAB (basic research) ◄──────────────────────────┐  │
│       │  path blueprint data                     │  │
│       ▼                                          │  │
│  PATHD: Pathway & Enzyme Design Navigator        │  │
│       │  thermodynamic parameters ───────────────┘  │
└───────┼─────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────┐
│  STAGE 2: SIMULATION & COMPONENT OPTIMIZATION       │
│                                                     │
│  FBAsim (flux balance) ─┐                           │
│  CETHX (thermodynamics) ─┴─► identify bottlenecks   │
│                                    │                │
│                                    ▼                │
│                          PROEVOL (protein evolution) │
│                                    │                │
│                                    ▼                │
│                          CATDES (enzyme design)      │
│                                    │ optimized seq  │
└────────────────────────────────────┼────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────┐
│  STAGE 3: CHASSIS ENGINEERING & CONTROL             │
│                                                     │
│  GENMIM (genome minimization) ──► provide chassis   │
│                                        │            │
│                                        ▼            │
│                              GECAIR (gene circuits)  │
│                                        │            │
│                                        ▼            │
│                              DYNCON (dynamic control)│
│                                        │ build instr│
└────────────────────────────────────────┼────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────┐
│  STAGE 4: TEST, ANALYZE & ITERATE                   │
│                                                     │
│  DBTLflow → CFS (cell-free screening)               │
│           → DBTL (cell construction & testing)      │
│           → MULTIO (multi-omics analysis)           │
│           → SCSPATIAL (single-cell spatial omics)   │
│           → DBTLflow (learned optimization)         │
└──────────────────────┬──────────────────────────────┘
                       │ feedback: learned optimization
                       └──────────────────────────────► INPUT

         ╔══════════════════════════════╗
         ║  NEXAI: AI Research Assistant║  ← connects to all stages
         ╚══════════════════════════════╝
```

**Pathway Visualization Core (Stage 1 Entry Point)**

| Module | Description |
|--------|-------------|
| Paper Analyzer | AI (Axon) extracts metabolic nodes, edges, bottleneck enzymes, and evidence from research papers |
| 3D Pathway Viewer | Interactive 3D pathway with GLSL shaders, pastel palette, pLDDT confidence coloring |
| Database Research | Parallel search across 6 academic databases (PubMed, Semantic Scholar, OpenAlex, Europe PMC, bioRxiv, CORE) |
| Node Panel | 3-tab scientific workbench: Overview · Structure · Analysis |
| Protein Structure | AlphaFold pLDDT coloring + RCSB PDB structures via 3Dmol.js |
| Molecular Structure | Real 3D conformers from PubChem (CID lookup + name search) |
| Cell Imagery | Microscopy reference images from Wikipedia, Cell Image Library, EMBL-EBI IDR |
| Kinetic Simulation | Michaelis-Menten kinetics + RK4 ODE solver for enzyme nodes |
| Thermodynamics | Gibbs free energy (ΔG°) estimation using group contribution method for metabolite nodes |

---

## 13 Specialized Tools

| Tool | Route | Description |
|------|-------|-------------|
| **Pathway Designer** | `/tools/pathd` | Main 3D metabolic pathway lab — paper-to-3D workflow with DBTL cycle integration, XState FSM, 60 Hz FBA worker |
| **Metabolic Engineering Lab** | `/tools/metabolic-eng` | Full metabolic lab with 3D FluidSim canvas, NodePanel, ThreeScene; entry point for full Axon analysis |
| **Catalyst Designer** | `/tools/catdes` | Enzyme design: binding affinity radar, sequence design, flux cost analysis, Pareto front, mutagenesis targeting |
| **Cell-Free Simulation** | `/tools/cellfree` | Cell-free system simulation: gene construct design, parameter tuning, expression yield prediction |
| **Cell Thermodynamics** | `/tools/cethx` | Thermodynamic cascade: waterfall ΔG chart, ATP accounting, pathway feasibility analysis |
| **DBTL Flow** | `/tools/dbtlflow` | Design-Build-Test-Learn cycle tracker: iteration waterfall, protocol generation, SBOL serialization |
| **Dynamic Control** | `/tools/dyncon` | Bioreactor simulation: Hill function feedback loops, RK4 ODE integration, setpoint convergence analysis |
| **FBA Simulator** | `/tools/fbasim` | Flux Balance Analysis: single-species + community FBA (co-culture), knockout/overexpression strategies, shadow prices, carbon efficiency |
| **Gene Circuit Reasoner** | `/tools/gecair` | Gene circuit design: logic gate modeling, Hill curve analysis, circuit dynamics, gate efficiency scoring |
| **Gene Minimization** | `/tools/genmim` | Genome minimization: CRISPRi knockdown scheduling, chromosome map, efficiency heatmap, greedy optimization |
| **Multi-Omics** | `/tools/multio` | Multi-omics integration: projected embeddings, volcano plots, factor decomposition, perturbation prediction |
| **NEX-AI Research Agent** | `/tools/nexai` | AI-powered literature agent: citation network graph (year×relevance scatter), Socratic questioning, literature support map |
| **Protein Evolution** | `/tools/proevol` | Directed evolution campaign workbench: variant libraries, survivor selection, lineage tracking, diversity/convergence analysis, next-round strategy |
| **Single-Cell Spatial** | `/tools/scspatial` | Spatial transcriptomics: normalized artifact ingest, spatial/3D visualization, PAGA trajectory, hotspot and gene expression analysis |

---

## Tech Stack

```
Frontend     React 19 + TypeScript + Next.js 15 (App Router) + Tailwind CSS v3 + Framer Motion
3D           Three.js 0.183 + @react-three/fiber 9.5 + @react-three/drei 10.7
             Custom GLSL shaders (organic volume terrain, fluid simulation)
             3Dmol.js (protein + molecular rendering, CDN)
AI           Groq llama-3.3-70b (primary) → Gemini 2.0-flash (fallback)

## SCSPATIAL Sidecar

Real `.h5ad` ingest for SCSPATIAL uses a Python sidecar. Install the sidecar dependencies before uploading spatial datasets:

```bash
python3 -m venv .venv-scspatial
.venv-scspatial/bin/pip install -r requirements-scspatial-sidecar.txt
```

If `.venv-scspatial` exists, the SCSPATIAL sidecar will pick it up automatically.

If `python3-venv` is unavailable, you can install the packages into a repo-local target directory instead:

```bash
python3 -m pip install --target .nexus/scspatial-pydeps -r requirements-scspatial-sidecar.txt
```

If `.nexus/scspatial-pydeps` exists, the SCSPATIAL sidecar will add it to `PYTHONPATH` automatically.
State        Zustand 5 + XState 5 state machines
DB           better-sqlite3 (workbench experiment ledger)
Data         PubChem · AlphaFold EBI · RCSB PDB · 6 academic databases
Deploy       Vercel (Edge Runtime API routes)
```

---

## AI Architecture

All AI requests go through `app/api/analyze/route.ts` (Edge Runtime). The system prompt is "Axon" — a predictive design core that extracts pathway data, detects bottleneck enzymes, and proposes de novo design strategies.

**Groq is always primary. Gemini is always fallback. This order must never be reversed.**

```
1. Groq  llama-3.3-70b-versatile    primary (1000 req/day)
2. Groq  llama3-70b-8192            Groq backup
3. Gemini gemini-2.0-flash-lite     Google fallback (250 req/day)
4. Gemini gemini-1.5-flash          final fallback
5. 503 error                        all providers down
```

Supporting API routes:

| Route | Purpose |
|-------|---------|
| `app/api/alphafold` | CORS proxy — EBI AlphaFold PDB structures |
| `app/api/pubchem` | CORS proxy — PubChem 3D SDF conformers |
| `app/api/fba` | Simplex LP solver — single-species and community FBA |
| `app/api/workbench` | Project state sync — revision control + audit trail |

---

## Local Development

```bash
git clone https://github.com/zhangze1007/Nexus-bio-1.0
cd Nexus-bio-1.0
npm install
```

Create `.env.local`:
```
GROQ_API_KEY=your_groq_key
GEMINI_API_KEY=your_gemini_key
```

```bash
npm run dev
# runs at http://localhost:3000
```

Get a free Groq API key at [console.groq.com](https://console.groq.com)

---

## Deployment

Deployed on Vercel (Hobby plan). API routes run on Edge Runtime except `fba` and `workbench` which require Node.js runtime for the LP solver and SQLite.

Environment variables (`GROQ_API_KEY`, `GEMINI_API_KEY`) are set in the Vercel dashboard — never committed to the repository.

---

## Showcase

The default pathway demonstrates artemisinin biosynthesis — a landmark synthetic biology achievement that made malaria treatment affordable for 500 million patients.

**Ro et al., 2006. *Nature* 440, 940–943**

7 nodes · Acetyl-CoA → HMG-CoA → Mevalonate → FPP → Amorphadiene → Artemisinic Acid → Artemisinin

---

## Design Principles

- **Scientific credibility** — Every AI-generated node has an evidence trace and audit trail
- **Predictive design** — Axon detects bottleneck enzymes and proposes structure-level interventions
- **Progressive disclosure** — Core information first, details on demand
- **Workflow continuity** — Each tool is an entry point to the next
- **Visual integrity** — Dark theme, pastel palette, real algorithms — quality is never sacrificed

---

## About

Built by **Zhang Ze Foo** — a pre-university student in Malaysia on a gap year after completing STPM (A-level equivalent).

**Contact**
- Email: fuchanze@gmail.com
- LinkedIn: [linkedin.com/in/zhangze-foo-3575ba359](https://linkedin.com/in/zhangze-foo-3575ba359)

---

## Copilot Agent & Firewall

If you use the GitHub Copilot coding agent on this repo and the workflow fails with `HTTP/2 GOAWAY connection terminated` or a firewall-blocked warning, see **[docs/firewall.md](docs/firewall.md)** for a step-by-step fix.

---

## Trust and Limitations

Nexus-Bio is a transparent synthetic biology learning workbench with mixed-validity modules (`real`, `partial`, `demo`). It is not an end-to-end research-grade platform and does not include wet-lab validation in this repository.

Key limitations:
- Some tools are explicitly demo-tier and assumption-gated.
- Some algorithms are heuristic or simplified.
- LLM-assisted evidence and recommendations require human scientific validation.

Phase 3 public proof package:
- [Phase 3 Decisions](docs/PHASE_3_DECISIONS.md)
- [Artemisinin Trust-Gated Walkthrough](docs/ARTEMISININ_TRUST_GATED_WALKTHROUGH.md)
- [Demo Video Script](docs/DEMO_VIDEO_SCRIPT.md)
- [Portfolio Summary](docs/PORTFOLIO_SUMMARY.md)
- [Personal Statement Snippet](docs/PERSONAL_STATEMENT_SNIPPET.md)
- [Paper Draft](docs/PAPER_DRAFT.md)

---

## License

MIT License — open for research and educational use.
