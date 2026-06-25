# Nexus-Bio VC Pitch — Segmented Messages

Ready-to-send segments for Iterative VC conversation.

---

## Segment 1: The One-Liner

Nexus-Bio is an AI-powered platform that unifies the entire synthetic biology research workflow — from literature discovery to pathway design to enzyme engineering to experiment tracking — into a single, integrated environment.

---

## Segment 2: The Problem

Today, a metabolic engineer designing a biosynthetic pathway faces brutal toolchain fragmentation:

- Literature search → PubMed, Google Scholar, Zotero
- Pathway design → Pathway Tools (desktop, 1990s UI), KEGG website
- Flux simulation → COBRApy (Python scripts)
- Enzyme engineering → FoldX, Rosetta, AlphaFold (3-4 separate tools)
- Thermodynamics → eQuilibrator, Excel
- Gene circuits → MATLAB SimBiology
- Experiment tracking → Spreadsheets, paper notebooks

A researcher spends 70% of their time context-switching between tools, manually transferring data, and re-formatting outputs — not doing science. Each handoff loses context, evidence traceability, and reproducibility.

---

## Segment 3: What We Built

Nexus-Bio provides 14 integrated tools covering the full DBTL (Design-Build-Test-Learn) cycle:

**Stage 1 — Design & Discovery**
• NEXAI — AI research agent searching 6 databases in parallel (PubMed, Europe PMC, Semantic Scholar, OpenAlex, bioRxiv, CORE) with citation verification
• PATHD — 3D pathway designer with real-time metabolic visualization and thermodynamic feasibility checks

**Stage 2 — Simulation & Optimization**
• FBASim — Flux Balance Analysis using LP simplex solver (E. coli + yeast models, community FBA)
• CETHX — Cell thermodynamics with Alberty-transformed ΔG′, ATP accounting
• ProEvol — Protein evolution with fitness landscapes, Gaussian Process ML-guided directed evolution
• CATDES — Catalyst designer with BLOSUM62 matrices, FoldX-style ΔΔG prediction, molecular docking

**Stage 3 — Chassis Engineering & Control**
• GenMIM — Gene minimization with CRISPRi knockdown scheduling
• GECAIR — Gene circuit reasoner with Hill functions, Gillespie SSA stochastic simulation
• DynCon — Dynamic control with PID + MPC controllers, RK4 ODE integration

**Stage 4 — Test, Analyze & Iterate**
• CellFree — Cell-free system simulation with MCMC parameter calibration
• DBTLflow — DBTL cycle tracker with Bayesian optimization for experiment suggestions
• MultiO — Multi-omics integration with MOFA+ factor analysis, VAE/UMAP embeddings
• ScSpatial — Single-cell spatial transcriptomics with 10x Visium hexagonal spot grids

---

## Segment 4: Technical Depth

Every tool implements real scientific algorithms — no placeholders:

• Michaelis-Menten kinetics with competitive/uncompetitive/mixed inhibition + Dormand-Prince RK4(5) ODE solver
• LP simplex solver for FBA with shadow prices and carbon efficiency
• Gibbs free energy via Alberty transform at physiological pH
• Gaussian Process regression for ML-guided directed evolution
• Gillespie Stochastic Simulation Algorithm for gene circuit dynamics
• MOFA+ factor analysis for multi-omics integration
• MCMC parameter calibration for cell-free systems
• Bayesian optimization for experiment suggestions
• Model Predictive Control (MPC) for bioreactor dynamics
• Codon optimization with species-specific usage tables + RBS strength calculator (Salis et al. 2009)

The AI orchestration layer (Axon) plans multi-step research workflows, routes to the right tools, and maintains evidence traceability through a trust policy engine.

---

## Segment 5: The Numbers

• 455 TypeScript files
• 36,364 lines of code
• 142 test files, 33,513 lines of tests
• 1,082 commits
• 14 tool pages, 8 API routes
• Built by 1 person, in 48 hours, on a tablet

---

## Segment 6: Why This Matters

**Massive Market, Fragmented Tooling** — Synthetic biology market projected to reach $35B+ by 2030. Every major biotech (Ginkgo, Zymergen, Amyris) has internal tools doing fragments of what Nexus-Bio does. Academic labs cobble together Python scripts and spreadsheets.

**Platform, Not Point Solution** — Nexus-Bio is the operating system for synthetic biology research. The 14 tools share state, evidence, and context. A pathway designed in PATHD flows into FBASim for flux analysis, then into CATDES for enzyme optimization, then into DBTLflow for experiment tracking. No handoff friction.

**AI-Native Architecture** — The Axon orchestrator doesn't just answer questions — it plans multi-step research workflows, routes to the right tools, and maintains evidence traceability. This is the difference between "ChatGPT for bio" and a real research copilot.

**Real Scientific Rigor** — Every calculation is real. The kinetics engine implements actual Michaelis-Menten with inhibition models. The FBA solver uses real LP simplex. Synthetic biologists will immediately reject anything that gives placeholder results.

---

## Segment 7: Links

Live demo: nexus-bio-1-0.vercel.app
GitHub: github.com/zhangze1007/Nexus-bio-1.0
