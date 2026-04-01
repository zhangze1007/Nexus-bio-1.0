import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BrainCircuit,
  Cpu,
  Dna,
  FlaskConical,
  GitBranch,
  Gauge,
  Layers,
  Orbit,
  ScanSearch,
  Scissors,
  Sparkles,
  TestTubeDiagonal,
  Zap,
} from 'lucide-react';

export type ToolShellKind = 'ide' | 'bento';
export type ToolCategory =
  | 'Pathway Engineering'
  | 'Simulation'
  | 'Genetic Systems'
  | 'Omics & Screening'
  | 'Research Intelligence';

export interface ToolDefinition {
  id: string;
  shortLabel: string;
  name: string;
  href: string;
  category: ToolCategory;
  shell: ToolShellKind;
  icon: LucideIcon;
  summary: string;
  focus: string;
  outputs: string[];
  tags: string[];
  relatedRoutes?: string[];
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    id: 'pathd',
    shortLabel: 'PATHD',
    name: 'Pathway & Enzyme Design',
    href: '/tools/pathd',
    category: 'Pathway Engineering',
    shell: 'ide',
    icon: GitBranch,
    summary: 'Primary 3D pathway design workbench with simulation overlays and node-level evidence drill-down.',
    focus: 'Find a route, inspect nodes, and continue into structure or kinetics.',
    outputs: ['3D pathway view', 'Node evidence trace', 'Lab handoff'],
    tags: ['3D', 'pathway', 'evidence', 'enzyme', 'workbench'],
    relatedRoutes: ['/tools/metabolic-eng'],
  },
  {
    id: 'metabolic-eng',
    shortLabel: 'LAB',
    name: 'Metabolic Engineering Lab',
    href: '/tools/metabolic-eng',
    category: 'Pathway Engineering',
    shell: 'ide',
    icon: FlaskConical,
    summary: 'Real-time metabolic lab view that reuses the PATHD engine with simulation, worker telemetry, and the node drawer.',
    focus: 'Continue analysis from the paper pipeline with live pathway context.',
    outputs: ['Realtime readouts', 'Worker-backed simulation', 'Structure/analysis drawer'],
    tags: ['lab', 'worker', 'kinetics', 'thermodynamics', 'pathway'],
    relatedRoutes: ['/tools/pathd'],
  },
  {
    id: 'fbasim',
    shortLabel: 'FBASIM',
    name: 'Flux Balance Analysis',
    href: '/tools/fbasim',
    category: 'Simulation',
    shell: 'ide',
    icon: Activity,
    summary: 'Flux-balance workspace for objective inspection, flux maps, and metabolic readouts.',
    focus: 'Tune assumptions and inspect growth or flux outcomes.',
    outputs: ['Flux map', 'Objective metrics', 'Exportable flux tables'],
    tags: ['fba', 'flux', 'simulation', 'metabolism'],
  },
  {
    id: 'dbtlflow',
    shortLabel: 'DBTL',
    name: 'Design-Build-Test-Learn',
    href: '/tools/dbtlflow',
    category: 'Pathway Engineering',
    shell: 'ide',
    icon: Orbit,
    summary: 'Tracks the DBTL loop with protocol, timeline, and evidence-carrying design artifacts.',
    focus: 'Map an engineering program from construct design to learning loops.',
    outputs: ['Timeline', 'Protocol view', 'Loop status'],
    tags: ['dbtl', 'workflow', 'protocol', 'tracking'],
  },
  {
    id: 'catdes',
    shortLabel: 'CATDES',
    name: 'Catalyst Designer',
    href: '/tools/catdes',
    category: 'Pathway Engineering',
    shell: 'bento',
    icon: Sparkles,
    summary: 'Catalyst ranking workspace combining binding, design, flux coupling, and multi-objective scoring.',
    focus: 'Compare candidate catalysts and inspect trade-offs.',
    outputs: ['Candidate ranking', 'Objective trade-offs', 'Design exports'],
    tags: ['catalyst', 'design', 'ranking', 'optimization'],
  },
  {
    id: 'cethx',
    shortLabel: 'CETHX',
    name: 'Cell Thermodynamics Engine',
    href: '/tools/cethx',
    category: 'Simulation',
    shell: 'bento',
    icon: Zap,
    summary: 'Thermodynamic pathway breakdown with corrected delta-G, ATP yield, and efficiency.',
    focus: 'Inspect whether a pathway is energetically plausible and where it loses efficiency.',
    outputs: ['Step thermodynamics', 'Efficiency gauge', 'JSON/CSV exports'],
    tags: ['thermodynamics', 'deltaG', 'atp', 'energy'],
  },
  {
    id: 'cellfree',
    shortLabel: 'CFS',
    name: 'Cell-Free Sandbox',
    href: '/tools/cellfree',
    category: 'Simulation',
    shell: 'ide',
    icon: TestTubeDiagonal,
    summary: 'Resource-aware TX-TL simulation with fitting and in-vitro-to-in-vivo reasoning.',
    focus: 'Adjust constructs and inspect expression, depletion, and IVIV translation.',
    outputs: ['Time-course plots', 'Resource model', 'Fitting and IVIV view'],
    tags: ['cell-free', 'txtl', 'expression', 'fitting'],
  },
  {
    id: 'dyncon',
    shortLabel: 'DYNCON',
    name: 'Dynamic Control Simulator',
    href: '/tools/dyncon',
    category: 'Simulation',
    shell: 'ide',
    icon: Gauge,
    summary: 'Dynamic control workspace for tuning feedback loops and observing convergence behaviour.',
    focus: 'Understand control stability and operating margins.',
    outputs: ['Time-series', 'Control tuning', 'Cross-module snapshots'],
    tags: ['control', 'ode', 'feedback', 'bioprocess'],
  },
  {
    id: 'gecair',
    shortLabel: 'GECAIR',
    name: 'Gene Circuit AI Reasoner',
    href: '/tools/gecair',
    category: 'Genetic Systems',
    shell: 'ide',
    icon: Cpu,
    summary: 'Interactive logic-gate and hill-function workbench for synthetic gene circuits.',
    focus: 'Tune inputs and see how circuit logic changes in real time.',
    outputs: ['Circuit SVG', 'Truth table', 'Readout metrics'],
    tags: ['gene circuit', 'logic', 'hill', 'reasoning'],
  },
  {
    id: 'genmim',
    shortLabel: 'GENMIM',
    name: 'Gene Minimization',
    href: '/tools/genmim',
    category: 'Genetic Systems',
    shell: 'ide',
    icon: Scissors,
    summary: 'CRISPRi minimization planner with target schedule, genome map, and impact summary.',
    focus: 'Identify knockdown plans without losing viability.',
    outputs: ['Genome map', 'Target schedule', 'Impact metrics'],
    tags: ['crispri', 'genome', 'minimization', 'targets'],
  },
  {
    id: 'multio',
    shortLabel: 'MULTIO',
    name: 'Multi-Omics Integrator',
    href: '/tools/multio',
    category: 'Omics & Screening',
    shell: 'ide',
    icon: Layers,
    summary: 'Integrates transcriptomics, proteomics, and metabolomics into interpretable latent and table views.',
    focus: 'Compare layers, factors, bottlenecks, and ranked entities.',
    outputs: ['MOFA view', 'VAE view', 'Paginated omics table'],
    tags: ['omics', 'integration', 'vae', 'table'],
  },
  {
    id: 'nexai',
    shortLabel: 'NEXAI',
    name: 'Axon Research Agent',
    href: '/tools/nexai',
    category: 'Research Intelligence',
    shell: 'bento',
    icon: BrainCircuit,
    summary: 'Research assistant surface with query history, citation graph, and exportable synthesis output.',
    focus: 'Move from question to curated research context quickly.',
    outputs: ['Citation graph', 'Query history', 'Exported syntheses'],
    tags: ['agent', 'research', 'citations', 'query'],
  },
  {
    id: 'proevol',
    shortLabel: 'PROEVOL',
    name: 'Protein Evolution Simulator',
    href: '/tools/proevol',
    category: 'Genetic Systems',
    shell: 'ide',
    icon: Dna,
    summary: 'Directed-evolution simulator with fitness landscape, trajectory, and mutation scoring.',
    focus: 'See how mutation rate and rounds change trajectory quality.',
    outputs: ['Fitness heatmap', 'Trajectory sparkline', 'Sequence export'],
    tags: ['evolution', 'fitness', 'sequence', 'monte carlo'],
  },
  {
    id: 'scspatial',
    shortLabel: 'SCSPATIAL',
    name: 'Single-Cell & Spatial Transcriptomics',
    href: '/tools/scspatial',
    category: 'Omics & Screening',
    shell: 'ide',
    icon: ScanSearch,
    summary: 'QC, clustering, trajectory, and spatial autocorrelation workbench with table fallback.',
    focus: 'Move between spatial map, latent embedding, and cell table without losing context.',
    outputs: ['Spatial map', 'UMAP/trajectory', 'Paginated cell table'],
    tags: ['single-cell', 'spatial', 'trajectory', 'table'],
  },
];

export const TOOL_CATEGORIES = Array.from(
  new Set(TOOL_DEFINITIONS.map((tool) => tool.category)),
) as ToolCategory[];

export const TOOL_BY_ID = TOOL_DEFINITIONS.reduce<Record<string, ToolDefinition>>((acc, tool) => {
  acc[tool.id] = tool;
  return acc;
}, {});

export function getToolDefinition(id: string) {
  return TOOL_BY_ID[id];
}

