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

export type ToolDirection =
  | 'Research Intake'
  | 'Pathway & Design'
  | 'Structure & Enzyme'
  | 'Dynamic & System'
  | 'Omics & Spatial'
  | 'Validation & DBTL'
  | 'AI Assistant';

export type ToolMode = 'analysis' | 'design' | 'simulation' | 'workflow' | 'assistant';
export type ThreeDPotential = 'none' | 'supporting' | 'strong';

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
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    id: 'pathd',
    shortLabel: 'PATHD',
    name: 'Pathway & Enzyme Design',
    href: '/tools/pathd',
    category: 'Pathway Engineering',
    direction: 'Pathway & Design',
    shell: 'ide',
    icon: GitBranch,
    summary: 'Primary 3D pathway design workbench with simulation overlays and node-level evidence drill-down.',
    focus: 'Find a route, inspect nodes, and continue into structure or kinetics.',
    outputs: ['3D pathway view', 'Node evidence trace', 'Lab handoff'],
    tags: ['3D', 'pathway', 'evidence', 'enzyme', 'workbench'],
    mode: 'design',
    threeDPotential: 'strong',
    relatedRoutes: ['/tools/metabolic-eng', '/tools/catdes'],
  },
  {
    id: 'metabolic-eng',
    shortLabel: 'LAB',
    name: 'Metabolic Engineering Lab',
    href: '/tools/metabolic-eng',
    category: 'Pathway Engineering',
    direction: 'Pathway & Design',
    shell: 'ide',
    icon: FlaskConical,
    summary: 'Real-time metabolic lab view that reuses the PATHD engine with simulation, worker telemetry, and the node drawer.',
    focus: 'Continue analysis from the paper pipeline with live pathway context.',
    outputs: ['Realtime readouts', 'Worker-backed simulation', 'Structure/analysis drawer'],
    tags: ['lab', 'worker', 'kinetics', 'thermodynamics', 'pathway'],
    mode: 'simulation',
    threeDPotential: 'strong',
    relatedRoutes: ['/tools/pathd'],
  },
  {
    id: 'catdes',
    shortLabel: 'CATDES',
    name: 'Catalyst Designer',
    href: '/tools/catdes',
    category: 'Pathway Engineering',
    direction: 'Structure & Enzyme',
    shell: 'bento',
    icon: Sparkles,
    summary: 'Catalyst ranking workspace combining binding, design, flux coupling, and multi-objective scoring.',
    focus: 'Compare candidate catalysts and inspect trade-offs.',
    outputs: ['Candidate ranking', 'Objective trade-offs', 'Design exports'],
    tags: ['catalyst', 'design', 'ranking', 'optimization'],
    mode: 'design',
    threeDPotential: 'strong',
  },
  {
    id: 'proevol',
    shortLabel: 'PROEVOL',
    name: 'Protein Evolution Simulator',
    href: '/tools/proevol',
    category: 'Genetic Systems',
    direction: 'Structure & Enzyme',
    shell: 'ide',
    icon: Dna,
    summary: 'Directed-evolution simulator with fitness landscape, trajectory, and mutation scoring.',
    focus: 'See how mutation rate and rounds change trajectory quality.',
    outputs: ['Fitness heatmap', 'Trajectory sparkline', 'Sequence export'],
    tags: ['evolution', 'fitness', 'sequence', 'monte carlo'],
    mode: 'design',
    threeDPotential: 'supporting',
  },
  {
    id: 'fbasim',
    shortLabel: 'FBASIM',
    name: 'Flux Balance Analysis',
    href: '/tools/fbasim',
    category: 'Simulation',
    direction: 'Dynamic & System',
    shell: 'ide',
    icon: Activity,
    summary: 'Flux-balance workspace for objective inspection, flux maps, and metabolic readouts.',
    focus: 'Tune assumptions and inspect growth or flux outcomes.',
    outputs: ['Flux map', 'Objective metrics', 'Exportable flux tables'],
    tags: ['fba', 'flux', 'simulation', 'metabolism'],
    mode: 'simulation',
    threeDPotential: 'supporting',
  },
  {
    id: 'dyncon',
    shortLabel: 'DYNCON',
    name: 'Dynamic Control Simulator',
    href: '/tools/dyncon',
    category: 'Simulation',
    direction: 'Dynamic & System',
    shell: 'ide',
    icon: Gauge,
    summary: 'Dynamic control workspace for tuning feedback loops and observing convergence behaviour.',
    focus: 'Understand control stability and operating margins.',
    outputs: ['Time-series', 'Control tuning', 'Cross-module snapshots'],
    tags: ['control', 'ode', 'feedback', 'bioprocess'],
    mode: 'simulation',
    threeDPotential: 'none',
  },
  {
    id: 'cethx',
    shortLabel: 'CETHX',
    name: 'Cell Thermodynamics Engine',
    href: '/tools/cethx',
    category: 'Simulation',
    direction: 'Dynamic & System',
    shell: 'bento',
    icon: Zap,
    summary: 'Thermodynamic pathway breakdown with corrected delta-G, ATP yield, and efficiency.',
    focus: 'Inspect whether a pathway is energetically plausible and where it loses efficiency.',
    outputs: ['Step thermodynamics', 'Efficiency gauge', 'JSON/CSV exports'],
    tags: ['thermodynamics', 'deltaG', 'atp', 'energy'],
    mode: 'analysis',
    threeDPotential: 'none',
  },
  {
    id: 'gecair',
    shortLabel: 'GECAIR',
    name: 'Gene Circuit AI Reasoner',
    href: '/tools/gecair',
    category: 'Genetic Systems',
    direction: 'Dynamic & System',
    shell: 'ide',
    icon: Cpu,
    summary: 'Interactive logic-gate and hill-function workbench for synthetic gene circuits.',
    focus: 'Tune inputs and see how circuit logic changes in real time.',
    outputs: ['Circuit SVG', 'Truth table', 'Readout metrics'],
    tags: ['gene circuit', 'logic', 'hill', 'reasoning'],
    mode: 'simulation',
    threeDPotential: 'supporting',
  },
  {
    id: 'multio',
    shortLabel: 'MULTIO',
    name: 'Multi-Omics Integrator',
    href: '/tools/multio',
    category: 'Omics & Screening',
    direction: 'Omics & Spatial',
    shell: 'ide',
    icon: Layers,
    summary: 'Integrates transcriptomics, proteomics, and metabolomics into interpretable latent and table views.',
    focus: 'Compare layers, factors, bottlenecks, and ranked entities.',
    outputs: ['MOFA view', 'VAE view', 'Paginated omics table'],
    tags: ['omics', 'integration', 'vae', 'table'],
    mode: 'analysis',
    threeDPotential: 'strong',
  },
  {
    id: 'scspatial',
    shortLabel: 'SCSPATIAL',
    name: 'Single-Cell & Spatial Transcriptomics',
    href: '/tools/scspatial',
    category: 'Omics & Screening',
    direction: 'Omics & Spatial',
    shell: 'ide',
    icon: ScanSearch,
    summary: 'QC, clustering, trajectory, and spatial autocorrelation workbench with table fallback.',
    focus: 'Move between spatial map, latent embedding, and cell table without losing context.',
    outputs: ['Spatial map', 'UMAP/trajectory', 'Paginated cell table'],
    tags: ['single-cell', 'spatial', 'trajectory', 'table'],
    mode: 'analysis',
    threeDPotential: 'strong',
  },
  {
    id: 'cellfree',
    shortLabel: 'CFS',
    name: 'Cell-Free Sandbox',
    href: '/tools/cellfree',
    category: 'Simulation',
    direction: 'Validation & DBTL',
    shell: 'ide',
    icon: TestTubeDiagonal,
    summary: 'Resource-aware TX-TL simulation with fitting and in-vitro-to-in-vivo reasoning.',
    focus: 'Adjust constructs and inspect expression, depletion, and IVIV translation.',
    outputs: ['Time-course plots', 'Resource model', 'Fitting and IVIV view'],
    tags: ['cell-free', 'txtl', 'expression', 'fitting'],
    mode: 'simulation',
    threeDPotential: 'strong',
  },
  {
    id: 'dbtlflow',
    shortLabel: 'DBTL',
    name: 'Design-Build-Test-Learn',
    href: '/tools/dbtlflow',
    category: 'Pathway Engineering',
    direction: 'Validation & DBTL',
    shell: 'ide',
    icon: Orbit,
    summary: 'Tracks the DBTL loop with protocol, timeline, and evidence-carrying design artifacts.',
    focus: 'Map an engineering program from construct design to learning loops.',
    outputs: ['Timeline', 'Protocol view', 'Loop status'],
    tags: ['dbtl', 'workflow', 'protocol', 'tracking'],
    mode: 'workflow',
    threeDPotential: 'none',
  },
  {
    id: 'genmim',
    shortLabel: 'GENMIM',
    name: 'Gene Minimization',
    href: '/tools/genmim',
    category: 'Genetic Systems',
    direction: 'Validation & DBTL',
    shell: 'ide',
    icon: Scissors,
    summary: 'CRISPRi minimization planner with target schedule, genome map, and impact summary.',
    focus: 'Identify knockdown plans without losing viability.',
    outputs: ['Genome map', 'Target schedule', 'Impact metrics'],
    tags: ['crispri', 'genome', 'minimization', 'targets'],
    mode: 'design',
    threeDPotential: 'none',
  },
  {
    id: 'nexai',
    shortLabel: 'NEXAI',
    name: 'Axon Research Agent',
    href: '/tools/nexai',
    category: 'Research Intelligence',
    direction: 'AI Assistant',
    shell: 'bento',
    icon: BrainCircuit,
    summary: 'Research assistant surface with query history, citation graph, and exportable synthesis output.',
    focus: 'Move from question to curated research context quickly.',
    outputs: ['Citation graph', 'Query history', 'Exported syntheses'],
    tags: ['agent', 'research', 'citations', 'query'],
    mode: 'assistant',
    threeDPotential: 'none',
  },
];

export const TOOL_CATEGORIES = Array.from(
  new Set(TOOL_DEFINITIONS.map((tool) => tool.category)),
) as ToolCategory[];

export const TOOL_DIRECTIONS = Array.from(
  new Set(TOOL_DEFINITIONS.map((tool) => tool.direction)),
) as ToolDirection[];

export const TOOL_BY_ID = TOOL_DEFINITIONS.reduce<Record<string, ToolDefinition>>((acc, tool) => {
  acc[tool.id] = tool;
  return acc;
}, {});

export function getToolDefinition(id: string) {
  return TOOL_BY_ID[id];
}
