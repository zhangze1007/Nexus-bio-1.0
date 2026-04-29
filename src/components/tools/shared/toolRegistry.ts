import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BrainCircuit,
  Cpu,
  Dna,
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
    summary: 'Primary 3D pathway design workbench with simulation overlays, node-level evidence drill-down, real-time metabolic lab view, worker telemetry, and node drawer.',
    focus: 'Find a route, inspect nodes, simulate kinetics, and continue into structure or analysis.',
    outputs: ['3D pathway view', 'Node evidence trace', 'Realtime readouts', 'Worker-backed simulation'],
    tags: ['3D', 'pathway', 'evidence', 'enzyme', 'workbench', 'kinetics', 'thermodynamics'],
    mode: 'design',
    threeDPotential: 'strong',
    relatedRoutes: ['/tools/catdes', '/tools/metabolic-eng'],
  },
  // Phase-1 — Workflow Control Plane: `metabolic-eng` is an internal
  // alias for PATHD's 3D lab page (see /tools/metabolic-eng → MetabolicEngPage).
  // It was previously registered in TOOL_VALIDITY but absent from
  // TOOL_DEFINITIONS, which produced a "ghost tool" reachable by route
  // but invisible to the registry. Reinstating it here as a contract-only
  // sidecar so registry / validity / contract are in lock-step.
  {
    id: 'metabolic-eng',
    shortLabel: 'METABOLIC-ENG',
    name: 'Metabolic Engineering Lab',
    href: '/tools/metabolic-eng',
    category: 'Pathway Engineering',
    direction: 'Pathway & Design',
    shell: 'ide',
    icon: GitBranch,
    summary: 'Full 3D metabolic lab — same engine as PATHD with live FBA hooks and force-directed layout.',
    focus: 'Internal alias of PATHD; surfaced for legacy /tools/metabolic-eng route compatibility.',
    outputs: ['3D pathway view', 'Live FBA overlay'],
    tags: ['3D', 'pathway', 'lab', 'alias'],
    mode: 'design',
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
    name: 'Protein Evolution Campaign Workbench',
    href: '/tools/proevol',
    category: 'Genetic Systems',
    direction: 'Structure & Enzyme',
    shell: 'ide',
    icon: Dna,
    summary: 'Round-based protein evolution workspace for variant libraries, survivor selection, lineage tracking, diversity monitoring, and next-round strategy.',
    focus: 'Judge whether the campaign should continue, narrow, broaden, stabilize, or transfer the current lead.',
    outputs: ['Variant library table', 'Lineage trace', 'Campaign recommendation exports'],
    tags: ['evolution', 'campaign', 'lineage', 'selection', 'variants'],
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
    summary: 'Demo thermodynamics explainer with reference delta-G, ATP yield, and efficiency sketch.',
    focus: 'Inspect reference energy bookkeeping while keeping condition-aware feasibility claims out of scope.',
    outputs: ['Reference step thermodynamics', 'Efficiency sketch', 'JSON/CSV exports'],
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
    summary: 'Demo multi-omics integration using deterministic factors, projections, and table views.',
    focus: 'Compare layers, deterministic factors, bottlenecks, and ranked entities without reference-model claims.',
    outputs: ['Deterministic factor view', 'Projected embedding', 'Paginated omics table'],
    tags: ['omics', 'integration', 'deterministic', 'table'],
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
    outputs: ['Spatial map', 'PAGA trajectory', 'Paginated cell table'],
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
    summary: 'Resource-aware TX-TL simulation with explicit parameter-sourcing limits.',
    focus: 'Inspect expression, depletion, fitting, and heuristic IVIV estimates without treating defaults as calibrated.',
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
