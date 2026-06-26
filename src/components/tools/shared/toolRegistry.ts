import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BrainCircuit,
  Cpu,
  Dna,
  FileText,
  FlaskConical,
  Gauge,
  GitBranch,
  Layers,
  Orbit,
  ScanSearch,
  Scissors,
  Sparkles,
  TestTubeDiagonal,
  Zap,
} from "lucide-react";

export type ToolShellKind = "ide" | "bento";
export type ToolCategory =
  | "Pathway Engineering"
  | "Simulation"
  | "Genetic Systems"
  | "Omics & Screening"
  | "Research Intelligence"
  | "Lab";

export type ToolDirection =
  | "Research Intake"
  | "Pathway & Design"
  | "Structure & Enzyme"
  | "Dynamic & System"
  | "Omics & Spatial"
  | "Validation & DBTL"
  | "AI Assistant";

export type ToolMode = "analysis" | "design" | "simulation" | "workflow" | "assistant";
export type ThreeDPotential = "none" | "supporting" | "strong";

export interface ToolKeyConcept {
  term: string;
  definition: string;
}

export interface ToolDefinition {
  id: string;
  shortLabel: string;
  name: string;
  href: string;
  category: ToolCategory;
  direction: ToolDirection;
  shell: ToolShellKind;
  icon: LucideIcon;
  summary: string;
  focus: string;
  outputs: string[];
  tags: string[];
  mode: ToolMode;
  threeDPotential: ThreeDPotential;
  relatedRoutes?: string[];
  glossary?: string;
  keyConcepts?: ToolKeyConcept[];
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    id: "pathd",
    shortLabel: "PATHD",
    name: "Pathway & Enzyme Design",
    href: "/tools/pathd",
    category: "Pathway Engineering",
    direction: "Pathway & Design",
    shell: "ide",
    icon: GitBranch,
    summary:
      "Primary 3D pathway design workbench with simulation overlays, node-level evidence drill-down, real-time metabolic lab view, worker telemetry, and node drawer.",
    focus: "Find a route, inspect nodes, simulate kinetics, and continue into structure or analysis.",
    outputs: ["3D pathway view", "Node evidence trace", "Realtime readouts", "Worker-backed simulation"],
    tags: ["3D", "pathway", "evidence", "enzyme", "workbench", "kinetics", "thermodynamics"],
    mode: "design",
    threeDPotential: "strong",
    glossary:
      "Pathway Designer maps metabolic routes from precursor to target molecule. It uses graph algorithms to find optimal biosynthetic pathways considering thermodynamic feasibility and enzyme availability.",
    keyConcepts: [
      {
        term: "Pathway",
        definition: "A sequence of enzymatic reactions converting a precursor into a target molecule",
      },
      { term: "Blueprint", definition: "A curated pathway template with known enzyme candidates" },
      { term: "ΔG", definition: "Gibbs free energy change — determines if a reaction is thermodynamically favorable" },
    ],
    relatedRoutes: ["/tools/catdes", "/tools/metabolic-eng"],
  },
  // Phase-1 — Workflow Control Plane: `metabolic-eng` is an internal
  // alias for PATHD's 3D lab page (see /tools/metabolic-eng → MetabolicEngPage).
  // It was previously registered in TOOL_VALIDITY but absent from
  // TOOL_DEFINITIONS, which produced a "ghost tool" reachable by route
  // but invisible to the registry. Reinstating it here as a contract-only
  // sidecar so registry / validity / contract are in lock-step.
  {
    id: "metabolic-eng",
    shortLabel: "METABOLIC-ENG",
    name: "Metabolic Engineering Lab",
    href: "/tools/metabolic-eng",
    category: "Pathway Engineering",
    direction: "Pathway & Design",
    shell: "ide",
    icon: GitBranch,
    summary: "Full 3D metabolic lab — same engine as PATHD with live FBA hooks and force-directed layout.",
    focus: "Internal alias of PATHD; surfaced for legacy /tools/metabolic-eng route compatibility.",
    outputs: ["3D pathway view", "Live FBA overlay"],
    tags: ["3D", "pathway", "lab", "alias"],
    mode: "design",
    threeDPotential: "strong",
    glossary:
      "The 3D Metabolic Lab is an immersive pathway visualization environment. It renders metabolic networks as interactive 3D graphs with real-time FBA overlays and node-level evidence drill-down.",
    keyConcepts: [
      { term: "FBA overlay", definition: "Flux values rendered as edge thickness on the 3D graph" },
      { term: "Node panel", definition: "Detailed view of a metabolite or enzyme with kinetics and thermodynamics" },
      { term: "Fluid simulation", definition: "Particle animation showing metabolite flow through pathways" },
    ],
    relatedRoutes: ["/tools/pathd"],
  },

  {
    id: "catdes",
    shortLabel: "CATDES",
    name: "Catalyst Designer",
    href: "/tools/catdes",
    category: "Pathway Engineering",
    direction: "Structure & Enzyme",
    shell: "bento",
    icon: Sparkles,
    summary: "Catalyst ranking workspace combining binding, design, flux coupling, and multi-objective scoring.",
    focus: "Compare candidate catalysts and inspect trade-offs.",
    outputs: ["Candidate ranking", "Objective trade-offs", "Design exports"],
    tags: ["catalyst", "design", "ranking", "optimization"],
    mode: "design",
    threeDPotential: "strong",
    glossary:
      "Catalyst Designer uses BLOSUM62 substitution matrices and MM-PBSA-style binding affinity calculations to engineer enzymes with improved catalytic properties. It predicts mutation effects on Km, Kcat, and binding energy.",
    keyConcepts: [
      { term: "Km", definition: "Michaelis constant — substrate concentration at half-max velocity" },
      { term: "Kcat", definition: "Turnover number — reactions per enzyme per second" },
      { term: "CAI", definition: "Codon Adaptation Index — measures how well a gene uses the host organism's codons" },
    ],
  },
  {
    id: "proevol",
    shortLabel: "PROEVOL",
    name: "Protein Evolution Campaign Workbench",
    href: "/tools/proevol",
    category: "Genetic Systems",
    direction: "Structure & Enzyme",
    shell: "ide",
    icon: Dna,
    summary:
      "Round-based protein evolution workspace for variant libraries, survivor selection, lineage tracking, diversity monitoring, and next-round strategy.",
    focus: "Judge whether the campaign should continue, narrow, broaden, stabilize, or transfer the current lead.",
    outputs: ["Variant library table", "Lineage trace", "Campaign recommendation exports"],
    tags: ["evolution", "campaign", "lineage", "selection", "variants"],
    mode: "design",
    threeDPotential: "supporting",
    glossary:
      "Protein Evolution simulates directed evolution campaigns. It models fitness landscapes, tracks variant lineages, and recommends the next round of mutations based on activity and diversity metrics.",
    keyConcepts: [
      {
        term: "Fitness landscape",
        definition: "A map from sequence space to activity — shows which mutations improve function",
      },
      { term: "Directed evolution", definition: "Iterative mutation and selection to improve protein properties" },
      { term: "Enrichment", definition: "How much a variant outcompetes others in a selection round" },
    ],
  },
  {
    id: "fbasim",
    shortLabel: "FBASIM",
    name: "Flux Balance Analysis",
    href: "/tools/fbasim",
    category: "Simulation",
    direction: "Dynamic & System",
    shell: "ide",
    icon: Activity,
    summary: "Flux-balance workspace for objective inspection, flux maps, and metabolic readouts.",
    focus: "Tune assumptions and inspect growth or flux outcomes.",
    outputs: ["Flux map", "Objective metrics", "Exportable flux tables"],
    tags: ["fba", "flux", "simulation", "metabolism"],
    mode: "simulation",
    threeDPotential: "supporting",
    glossary:
      "Flux Balance Analysis uses linear programming to predict metabolic fluxes. It finds the optimal distribution of reaction rates that maximizes growth while respecting mass balance constraints.",
    keyConcepts: [
      { term: "Flux", definition: "Rate of a metabolic reaction (mmol/gDW/h)" },
      { term: "Objective", definition: "What to maximize — usually biomass growth rate" },
      { term: "Shadow price", definition: "Marginal value of relaxing a metabolite constraint" },
    ],
  },
  {
    id: "dyncon",
    shortLabel: "DYNCON",
    name: "Dynamic Control Simulator",
    href: "/tools/dyncon",
    category: "Simulation",
    direction: "Dynamic & System",
    shell: "ide",
    icon: Gauge,
    summary: "Dynamic control workspace for tuning feedback loops and observing convergence behaviour.",
    focus: "Understand control stability and operating margins.",
    outputs: ["Time-series", "Control tuning", "Cross-module snapshots"],
    tags: ["control", "ode", "feedback", "bioprocess"],
    mode: "simulation",
    threeDPotential: "none",
    glossary:
      "Dynamic Control Simulator models feedback regulation in metabolic systems. It uses ODE integration (RK4) to simulate how PID controllers and Hill-function feedback maintain homeostasis.",
    keyConcepts: [
      {
        term: "PID",
        definition: "Proportional-Integral-Derivative controller — the most common feedback control strategy",
      },
      { term: "Hill function", definition: "Sigmoidal response curve modeling cooperative binding" },
      { term: "Setpoint", definition: "Target value the controller tries to maintain" },
    ],
  },
  {
    id: "cethx",
    shortLabel: "CETHX",
    name: "Cell Thermodynamics Engine",
    href: "/tools/cethx",
    category: "Simulation",
    direction: "Dynamic & System",
    shell: "bento",
    icon: Zap,
    summary:
      "Condition-aware thermodynamics with Alberty-transformed delta-G prime, feasibility dashboard, and ATP yield analysis.",
    focus: "Compute condition-aware ΔG′ values via Alberty transform and assess per-step thermodynamic feasibility.",
    outputs: ["Condition-aware step thermodynamics", "Feasibility assessment", "JSON/CSV exports"],
    tags: ["thermodynamics", "deltaG", "atp", "energy"],
    mode: "analysis",
    threeDPotential: "none",
    glossary:
      "Cell Thermodynamics calculates Gibbs free energy changes across metabolic pathways. It determines which reactions are thermodynamically feasible and identifies bottleneck steps.",
    keyConcepts: [
      { term: "ΔG'", definition: "Standard transformed Gibbs free energy at physiological pH and ionic strength" },
      { term: "ATP coupling", definition: "Reactions driven forward by coupling to ATP hydrolysis" },
      { term: "Limiting step", definition: "The thermodynamically least favorable reaction in a pathway" },
    ],
  },
  {
    id: "gecair",
    shortLabel: "GECAIR",
    name: "Gene Circuit AI Reasoner",
    href: "/tools/gecair",
    category: "Genetic Systems",
    direction: "Dynamic & System",
    shell: "ide",
    icon: Cpu,
    summary: "Interactive logic-gate and hill-function workbench for synthetic gene circuits.",
    focus: "Tune inputs and see how circuit logic changes in real time.",
    outputs: ["Circuit SVG", "Truth table", "Readout metrics"],
    tags: ["gene circuit", "logic", "hill", "reasoning"],
    mode: "simulation",
    threeDPotential: "supporting",
    glossary:
      "Gene Circuit AI Reasoner designs synthetic gene circuits using logic gate abstractions. It models circuit dynamics with ODE systems and analyzes stability via phase-space heatmaps.",
    keyConcepts: [
      { term: "Logic gate", definition: "Genetic implementation of Boolean operations (AND, OR, NOT)" },
      { term: "Phase space", definition: "A plot showing all possible states of a dynamical system" },
      { term: "Repressilator", definition: "A 3-gene oscillator circuit with negative feedback loops" },
    ],
  },
  {
    id: "multio",
    shortLabel: "MULTIO",
    name: "Multi-Omics Integrator",
    href: "/tools/multio",
    category: "Omics & Screening",
    direction: "Omics & Spatial",
    shell: "ide",
    icon: Layers,
    summary: "Demo multi-omics integration using deterministic factors, projections, and table views.",
    focus: "Compare layers, deterministic factors, bottlenecks, and ranked entities without reference-model claims.",
    outputs: ["Deterministic factor view", "Projected embedding", "Paginated omics table"],
    tags: ["omics", "integration", "deterministic", "table"],
    mode: "analysis",
    threeDPotential: "strong",
    glossary:
      "Multi-Omics Integration combines transcriptomics, proteomics, and metabolomics data using linear embedding and MOFA+ factor analysis. It identifies cross-omics patterns and predicts perturbation effects.",
    keyConcepts: [
      {
        term: "Linear embedding",
        definition:
          "Deterministic linear encoder with KL penalty — learns a compressed latent representation of multi-omics data (not a variational autoencoder)",
      },
      { term: "MOFA+", definition: "Multi-Omics Factor Analysis — identifies shared and unique sources of variation" },
      { term: "Volcano plot", definition: "Shows statistical significance vs fold change for differential expression" },
    ],
  },
  {
    id: "scspatial",
    shortLabel: "SCSPATIAL",
    name: "Single-Cell & Spatial Transcriptomics",
    href: "/tools/scspatial",
    category: "Omics & Screening",
    direction: "Omics & Spatial",
    shell: "ide",
    icon: ScanSearch,
    summary: "QC, clustering, trajectory, and spatial autocorrelation workbench with table fallback.",
    focus: "Move between spatial map, latent embedding, and cell table without losing context.",
    outputs: ["Spatial map", "PAGA trajectory", "Paginated cell table"],
    tags: ["single-cell", "spatial", "trajectory", "table"],
    mode: "analysis",
    threeDPotential: "strong",
    glossary:
      "Single-Cell Spatial analysis combines spatial transcriptomics with single-cell resolution. It uses hexagonal spot grids (10x Visium style) and UMAP embeddings to map gene expression patterns across tissue sections.",
    keyConcepts: [
      { term: "Spot", definition: "A spatial capture area containing transcripts from nearby cells" },
      { term: "UMAP", definition: "Uniform Manifold Approximation — a dimensionality reduction for visualization" },
      { term: "Cluster", definition: "A group of spots with similar gene expression profiles" },
    ],
  },
  {
    id: "cellfree",
    shortLabel: "CFS",
    name: "Cell-Free Sandbox",
    href: "/tools/cellfree",
    category: "Simulation",
    direction: "Validation & DBTL",
    shell: "ide",
    icon: TestTubeDiagonal,
    summary: "Resource-aware TX-TL simulation with explicit parameter-sourcing limits.",
    focus:
      "Inspect expression, depletion, fitting, and heuristic IVIV estimates without treating defaults as calibrated.",
    outputs: ["Time-course plots", "Resource model", "Fitting and IVIV view"],
    tags: ["cell-free", "txtl", "expression", "fitting"],
    mode: "simulation",
    threeDPotential: "strong",
    glossary:
      "Cell-Free Simulation models gene expression outside living cells. It predicts protein yield from DNA constructs using ODE-based kinetics of transcription and translation.",
    keyConcepts: [
      { term: "Cell-free", definition: "In vitro gene expression using purified transcription/translation machinery" },
      { term: "Construct", definition: "A DNA template with promoter, RBS, CDS, and terminator" },
      { term: "Yield", definition: "Predicted protein concentration (μM) at steady state" },
    ],
  },
  {
    id: "dbtlflow",
    shortLabel: "DBTL",
    name: "Design-Build-Test-Learn",
    href: "/tools/dbtlflow",
    category: "Pathway Engineering",
    direction: "Validation & DBTL",
    shell: "ide",
    icon: Orbit,
    summary: "Tracks the DBTL loop with protocol, timeline, and evidence-carrying design artifacts.",
    focus: "Map an engineering program from construct design to learning loops.",
    outputs: ["Timeline", "Protocol view", "Loop status"],
    tags: ["dbtl", "workflow", "protocol", "tracking"],
    mode: "workflow",
    threeDPotential: "none",
    glossary:
      "DBTL Cycle Tracker manages the Design-Build-Test-Learn iterative research cycle. It tracks hypothesis iterations, generates assembly protocols, exports SBOL, and manages delta pack approvals.",
    keyConcepts: [
      { term: "DBTL", definition: "Design-Build-Test-Learn — the iterative engineering biology cycle" },
      { term: "Delta pack", definition: "A bundle of changes approved for the next experimental iteration" },
      { term: "SBOL", definition: "Synthetic Biology Open Language — a standard for sharing genetic designs" },
    ],
  },
  {
    id: "genmim",
    shortLabel: "GENMIM",
    name: "Gene Minimization",
    href: "/tools/genmim",
    category: "Genetic Systems",
    direction: "Validation & DBTL",
    shell: "ide",
    icon: Scissors,
    summary: "CRISPRi minimization planner with target schedule, genome map, and impact summary.",
    focus: "Identify knockdown plans without losing viability.",
    outputs: ["Genome map", "Target schedule", "Impact metrics"],
    tags: ["crispri", "genome", "minimization", "targets"],
    mode: "design",
    threeDPotential: "none",
    glossary:
      "Gene Minimization identifies the minimal set of genes to knock down for metabolic efficiency. It uses greedy optimization with CRISPRi scheduling to maximize product yield while maintaining cell viability.",
    keyConcepts: [
      { term: "Knockdown", definition: "Reducing gene expression using CRISPRi interference" },
      { term: "Viability", definition: "Whether the cell can survive with the proposed gene modifications" },
      { term: "Essential gene", definition: "A gene required for cell survival — cannot be knocked out" },
    ],
  },
  {
    id: "nexai",
    shortLabel: "NEXAI",
    name: "Axon Research Agent",
    href: "/tools/nexai",
    category: "Research Intelligence",
    direction: "AI Assistant",
    shell: "bento",
    icon: BrainCircuit,
    summary: "Research assistant surface with query history, citation graph, and exportable synthesis output.",
    focus: "Move from question to curated research context quickly.",
    outputs: ["Citation graph", "Query history", "Exported syntheses"],
    tags: ["agent", "research", "citations", "query"],
    mode: "assistant",
    threeDPotential: "none",
    glossary:
      "NEXAI is an AI research assistant that searches literature, verifies citations, and provides evidence-based answers. It uses Socratic questioning and citation network analysis.",
    keyConcepts: [
      { term: "Citation verification", definition: "Checking that referenced papers actually exist in PubMed" },
      { term: "Socratic questioning", definition: "AI-guided questions that help refine research hypotheses" },
      { term: "Agentic mode", definition: "Multi-step AI reasoning with planning and execution logging" },
    ],
  },

  // ── Sequence Editor ─────────────────────────────────────────────────
  {
    id: "sequence",
    shortLabel: "SEQED",
    name: "Sequence Editor",
    href: "/tools/sequence",
    category: "Genetic Systems",
    direction: "Pathway & Design",
    shell: "ide",
    icon: FileText,
    summary:
      "DNA/protein sequence editor with linear viewer, circular plasmid map, restriction enzyme finder, 6-frame translation, and feature annotations.",
    focus: "View, annotate, and analyze genetic sequences with interactive linear and circular maps.",
    outputs: ["Linear sequence view", "Circular plasmid map", "Restriction sites", "6-frame translation"],
    tags: ["sequence", "editor", "plasmid", "restriction", "annotation", "genetic"],
    mode: "design",
    threeDPotential: "none",
    glossary:
      "The Sequence Editor is a Benchling-style sequence viewer for DNA and protein sequences. It provides a Canvas-based linear viewer with zoom and selection, SVG circular plasmid maps, automatic restriction enzyme site detection, and 6-frame translation.",
    keyConcepts: [
      {
        term: "Reading frame",
        definition: "One of six possible ways to translate a DNA sequence (3 forward + 3 reverse complement)",
      },
      {
        term: "Restriction enzyme",
        definition: "An enzyme that cuts DNA at specific recognition sequences (e.g., EcoRI at GAATTC)",
      },
      {
        term: "Plasmid map",
        definition: "Circular diagram showing features and cut sites on a circular DNA molecule",
      },
    ],
    relatedRoutes: ["/tools/pathd", "/tools/catdes"],
  },

  // ── Frontier engines (2025-2026) ──────────────────────────────────────
  {
    id: "inversefolding",
    shortLabel: "INV-FOLD",
    name: "Inverse Folding",
    href: "/tools/catdes",
    category: "Pathway Engineering",
    direction: "Structure & Enzyme",
    shell: "ide",
    icon: Sparkles,
    summary:
      "ProteinMPNN-style inverse folding: design amino acid sequences from backbone structure using graph neural message passing.",
    focus: "Given a protein backbone, generate sequences predicted to fold into that structure.",
    outputs: ["Designed sequences", "Confidence scores", "Structural motifs"],
    tags: ["protein", "design", "inverse-folding", "AI", "structure"],
    mode: "design",
    threeDPotential: "supporting",
    glossary:
      "Inverse folding takes a protein backbone structure and designs amino acid sequences that would fold into it. Uses k-NN graph construction, multi-round message passing, and PSSM decoding.",
    keyConcepts: [
      { term: "Inverse folding", definition: "Designing a sequence given a target 3D structure" },
      { term: "Message passing", definition: "Graph neural network technique to propagate structural context" },
      { term: "PSSM", definition: "Position-Specific Scoring Matrix for amino acid preferences" },
    ],
    relatedRoutes: ["/tools/catdes", "/tools/proevol"],
  },
  {
    id: "multiplexcrispr",
    shortLabel: "MULTI-CRISPR",
    name: "Multiplex CRISPR Strategy",
    href: "/tools/genmim",
    category: "Genetic Systems",
    direction: "Pathway & Design",
    shell: "ide",
    icon: Scissors,
    summary:
      "Combinatorial CRISPR library design with epistasis-aware fitness prediction and MAGE cycling optimization.",
    focus: "Design multi-gene knockout/knockdown strategies with optimal editing order.",
    outputs: ["Editing strategies", "Epistasis matrix", "Gene ranking", "gRNA library"],
    tags: ["CRISPR", "multiplex", "combinatorial", "epistasis", "genome-editing"],
    mode: "design",
    threeDPotential: "none",
    glossary:
      "Multiplex CRISPR designs combinatorial editing strategies for multiple genes simultaneously. It models epistatic interactions and predicts fitness of combinatorial variants.",
    keyConcepts: [
      { term: "Epistasis", definition: "Non-additive interaction between genetic edits" },
      { term: "MAGE", definition: "Multiplex Automated Genome Engineering — cycling through edits" },
      { term: "Combinatorial library", definition: "Set of all possible combinations of edits" },
    ],
    relatedRoutes: ["/tools/genmim", "/tools/fbasim"],
  },
  {
    id: "pathwaydiscovery",
    shortLabel: "PATH-DISC",
    name: "Pathway Discovery",
    href: "/tools/pathd",
    category: "Pathway Engineering",
    direction: "Pathway & Design",
    shell: "ide",
    icon: GitBranch,
    summary:
      "A* search over reaction database to discover novel biosynthetic pathways with thermodynamic feasibility scoring.",
    focus: "Automatically find routes from precursors to target molecules.",
    outputs: ["Discovered pathways", "ΔG cascade", "Bottleneck analysis", "Enzyme availability"],
    tags: ["pathway", "discovery", "A-star", "retrosynthesis", "thermodynamics"],
    mode: "design",
    threeDPotential: "strong",
    glossary:
      "Pathway Discovery uses graph search algorithms to find novel biosynthetic routes from available precursors to target molecules, scored by thermodynamic feasibility and enzyme availability.",
    keyConcepts: [
      { term: "A* search", definition: "Informed graph search using heuristics to find optimal paths" },
      { term: "Atom economy", definition: "Fraction of reactant atoms incorporated into the desired product" },
      { term: "ΔG cascade", definition: "Cumulative free energy change along a pathway" },
    ],
    relatedRoutes: ["/tools/pathd", "/tools/cethx"],
  },
  {
    id: "digitaltwin",
    shortLabel: "DIGI-TWIN",
    name: "Digital Twin Bioreactor",
    href: "/tools/dyncon",
    category: "Simulation",
    direction: "Dynamic & System",
    shell: "ide",
    icon: Cpu,
    summary: "Extended Kalman Filter state estimation with real-time sensor fusion and Monte Carlo forecasting.",
    focus: "Synchronize a bioreactor model with live sensor data for true digital twin operation.",
    outputs: ["State estimate", "Uncertainty bounds", "Parameter drift", "Forecast"],
    tags: ["digital-twin", "Kalman", "state-estimation", "bioreactor", "real-time"],
    mode: "simulation",
    threeDPotential: "none",
    glossary:
      "Digital Twin maintains a probabilistic belief state of a bioreactor using Extended Kalman Filtering. It fuses sensor data with a process model and provides Monte Carlo forecasts.",
    keyConcepts: [
      { term: "Extended Kalman Filter", definition: "Nonlinear state estimator using local linearization" },
      { term: "Sensor fusion", definition: "Combining multiple noisy sensor readings into a coherent estimate" },
      { term: "Monte Carlo forecast", definition: "Propagating uncertainty forward using random sampling" },
    ],
    relatedRoutes: ["/tools/dyncon"],
  },

  // ── Inventory Management ────────────────────────────────────────────
  {
    id: "inventory",
    shortLabel: "INV",
    name: "Inventory Management",
    href: "/tools/inventory/strains",
    category: "Lab",
    direction: "Validation & DBTL",
    shell: "ide",
    icon: FlaskConical,
    summary:
      "Biological inventory management for tracking strains, plasmids, primers, and chemicals with search, CRUD, and PubChem integration.",
    focus: "Track physical lab materials alongside digital pathway designs.",
    outputs: ["Strain catalog", "Plasmid registry", "Primer database", "Chemical inventory"],
    tags: ["inventory", "strains", "plasmids", "primers", "chemicals", "lab"],
    mode: "workflow",
    threeDPotential: "none",
    glossary:
      "Inventory Management bridges digital designs with physical lab materials. It tracks bacterial strains, plasmid constructs, oligonucleotide primers, and chemical reagents with searchable tables, auto-calculated primer properties, and PubChem integration.",
    keyConcepts: [
      { term: "Strain", definition: "A bacterial strain with specific genotype and resistance markers" },
      { term: "Plasmid", definition: "An extrachromosomal DNA construct with backbone, insert, and selection markers" },
      { term: "Primer", definition: "A short oligonucleotide used for PCR amplification of target sequences" },
    ],
  },
];

export const TOOL_CATEGORIES = Array.from(new Set(TOOL_DEFINITIONS.map((tool) => tool.category))) as ToolCategory[];

export const TOOL_DIRECTIONS = Array.from(new Set(TOOL_DEFINITIONS.map((tool) => tool.direction))) as ToolDirection[];

export const TOOL_BY_ID = TOOL_DEFINITIONS.reduce<Record<string, ToolDefinition>>((acc, tool) => {
  acc[tool.id] = tool;
  return acc;
}, {});

export function getToolDefinition(id: string) {
  return TOOL_BY_ID[id];
}
