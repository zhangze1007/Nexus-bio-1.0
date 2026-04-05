export type WorkbenchDependencyKind = 'forward' | 'feedback' | 'support';
export type WorkbenchDependencyMode = 'required' | 'recommended';

export interface WorkbenchDependencyEdge {
  fromToolId: string;
  toToolId: string;
  kind: WorkbenchDependencyKind;
  mode: WorkbenchDependencyMode;
  summary: string;
}

export const WORKBENCH_DEPENDENCY_GRAPH: WorkbenchDependencyEdge[] = [
  {
    fromToolId: 'pathd',
    toToolId: 'fbasim',
    kind: 'forward',
    mode: 'required',
    summary: 'Pathway design seeds flux objectives and feasible route candidates.',
  },
  {
    fromToolId: 'pathd',
    toToolId: 'cethx',
    kind: 'forward',
    mode: 'required',
    summary: 'Pathway design seeds thermodynamic feasibility checks.',
  },
  {
    fromToolId: 'fbasim',
    toToolId: 'cethx',
    kind: 'forward',
    mode: 'recommended',
    summary: 'Flux simulation sharpens the thermodynamic operating window.',
  },
  {
    fromToolId: 'fbasim',
    toToolId: 'catdes',
    kind: 'forward',
    mode: 'required',
    summary: 'Flux bottlenecks prioritize catalyst redesign targets.',
  },
  {
    fromToolId: 'fbasim',
    toToolId: 'proevol',
    kind: 'forward',
    mode: 'recommended',
    summary: 'Flux bottlenecks nominate proteins for directed evolution.',
  },
  {
    fromToolId: 'cethx',
    toToolId: 'catdes',
    kind: 'forward',
    mode: 'required',
    summary: 'Thermodynamic penalties guide catalyst redesign and screening.',
  },
  {
    fromToolId: 'cethx',
    toToolId: 'dyncon',
    kind: 'forward',
    mode: 'recommended',
    summary: 'Thermodynamic stress informs dynamic control policies.',
  },
  {
    fromToolId: 'cethx',
    toToolId: 'cellfree',
    kind: 'forward',
    mode: 'recommended',
    summary: 'Feasibility constraints seed the first cell-free prototyping envelope.',
  },
  {
    fromToolId: 'catdes',
    toToolId: 'dyncon',
    kind: 'forward',
    mode: 'required',
    summary: 'Catalyst choices feed controller tuning and expression burden estimates.',
  },
  {
    fromToolId: 'catdes',
    toToolId: 'cellfree',
    kind: 'forward',
    mode: 'required',
    summary: 'Catalyst designs are pushed into cell-free prototyping.',
  },
  {
    fromToolId: 'proevol',
    toToolId: 'catdes',
    kind: 'forward',
    mode: 'recommended',
    summary: 'Directed evolution proposals loop back into catalyst selection.',
  },
  {
    fromToolId: 'proevol',
    toToolId: 'cellfree',
    kind: 'forward',
    mode: 'recommended',
    summary: 'Improved enzymes can be screened in the cell-free sandbox.',
  },
  {
    fromToolId: 'fbasim',
    toToolId: 'genmim',
    kind: 'forward',
    mode: 'recommended',
    summary: 'Flux constraints guide chassis minimization priorities.',
  },
  {
    fromToolId: 'genmim',
    toToolId: 'gecair',
    kind: 'forward',
    mode: 'recommended',
    summary: 'Minimal chassis decisions constrain circuit insertion strategy.',
  },
  {
    fromToolId: 'genmim',
    toToolId: 'dyncon',
    kind: 'forward',
    mode: 'recommended',
    summary: 'Chassis edits reshape dynamic-control limits.',
  },
  {
    fromToolId: 'genmim',
    toToolId: 'cellfree',
    kind: 'forward',
    mode: 'recommended',
    summary: 'Minimal-host assumptions affect prototyping constructs.',
  },
  {
    fromToolId: 'gecair',
    toToolId: 'dyncon',
    kind: 'forward',
    mode: 'required',
    summary: 'Gene-circuit design feeds the closed-loop controller.',
  },
  {
    fromToolId: 'gecair',
    toToolId: 'dbtlflow',
    kind: 'forward',
    mode: 'recommended',
    summary: 'Circuit designs become part of the experimental execution plan.',
  },
  {
    fromToolId: 'dyncon',
    toToolId: 'cellfree',
    kind: 'forward',
    mode: 'required',
    summary: 'Dynamic-control parameters are prototyped in cell-free tests.',
  },
  {
    fromToolId: 'dyncon',
    toToolId: 'dbtlflow',
    kind: 'forward',
    mode: 'required',
    summary: 'Controller strategy flows into DBTL execution and learning.',
  },
  {
    fromToolId: 'cellfree',
    toToolId: 'dbtlflow',
    kind: 'forward',
    mode: 'required',
    summary: 'Cell-free outcomes seed the experimental DBTL loop.',
  },
  {
    fromToolId: 'cellfree',
    toToolId: 'multio',
    kind: 'forward',
    mode: 'recommended',
    summary: 'Prototyping results can be merged with multi-omics readouts.',
  },
  {
    fromToolId: 'dbtlflow',
    toToolId: 'multio',
    kind: 'forward',
    mode: 'recommended',
    summary: 'DBTL batches produce the measurements consumed by multi-omics integration.',
  },
  {
    fromToolId: 'dbtlflow',
    toToolId: 'scspatial',
    kind: 'forward',
    mode: 'recommended',
    summary: 'DBTL outputs can be interrogated at single-cell and spatial resolution.',
  },
  {
    fromToolId: 'multio',
    toToolId: 'scspatial',
    kind: 'forward',
    mode: 'required',
    summary: 'Integrated omics findings seed single-cell and spatial interrogation.',
  },
  {
    fromToolId: 'dbtlflow',
    toToolId: 'pathd',
    kind: 'feedback',
    mode: 'required',
    summary: 'Committed Learn cycles should reshape the next pathway design iteration.',
  },
  {
    fromToolId: 'dbtlflow',
    toToolId: 'fbasim',
    kind: 'feedback',
    mode: 'required',
    summary: 'Committed Learn cycles recalibrate flux assumptions.',
  },
  {
    fromToolId: 'dbtlflow',
    toToolId: 'catdes',
    kind: 'feedback',
    mode: 'required',
    summary: 'Committed Learn cycles reprioritize catalyst redesign.',
  },
  {
    fromToolId: 'dbtlflow',
    toToolId: 'dyncon',
    kind: 'feedback',
    mode: 'required',
    summary: 'Committed Learn cycles update control targets and stability assumptions.',
  },
  {
    fromToolId: 'nexai',
    toToolId: 'pathd',
    kind: 'support',
    mode: 'recommended',
    summary: 'Axon can synthesize literature and route design questions into PATHD.',
  },
  {
    fromToolId: 'nexai',
    toToolId: 'fbasim',
    kind: 'support',
    mode: 'recommended',
    summary: 'Axon can interpret model outputs and suggest simulation pivots.',
  },
  {
    fromToolId: 'nexai',
    toToolId: 'dbtlflow',
    kind: 'support',
    mode: 'recommended',
    summary: 'Axon can summarize lessons learned and prepare the next iteration.',
  },
];

function unique(items: string[]) {
  return Array.from(new Set(items));
}

export function getDependencyEdges(options?: {
  toolId?: string | null;
  direction?: 'upstream' | 'downstream';
  includeSupport?: boolean;
}) {
  const includeSupport = options?.includeSupport ?? true;
  return WORKBENCH_DEPENDENCY_GRAPH.filter((edge) => {
    if (!includeSupport && edge.kind === 'support') return false;
    if (!options?.toolId) return true;
    return options.direction === 'upstream'
      ? edge.toToolId === options.toolId
      : edge.fromToolId === options.toolId;
  });
}

export function getUpstreamToolIds(
  toolId?: string | null,
  options?: { deep?: boolean; includeSupport?: boolean },
) {
  if (!toolId) return [];
  const includeSupport = options?.includeSupport ?? false;
  const visited = new Set<string>();
  const queue = getDependencyEdges({ toolId, direction: 'upstream', includeSupport }).map((edge) => edge.fromToolId);
  const results: string[] = [];

  while (queue.length) {
    const next = queue.shift();
    if (!next || visited.has(next)) continue;
    visited.add(next);
    results.push(next);
    if (options?.deep) {
      getDependencyEdges({ toolId: next, direction: 'upstream', includeSupport }).forEach((edge) => {
        queue.push(edge.fromToolId);
      });
    }
  }

  return unique(results);
}

export function getDownstreamToolIds(
  toolId?: string | null,
  options?: { deep?: boolean; includeSupport?: boolean },
) {
  if (!toolId) return [];
  const includeSupport = options?.includeSupport ?? true;
  const visited = new Set<string>();
  const queue = getDependencyEdges({ toolId, direction: 'downstream', includeSupport }).map((edge) => edge.toToolId);
  const results: string[] = [];

  while (queue.length) {
    const next = queue.shift();
    if (!next || visited.has(next)) continue;
    visited.add(next);
    results.push(next);
    if (options?.deep) {
      getDependencyEdges({ toolId: next, direction: 'downstream', includeSupport }).forEach((edge) => {
        queue.push(edge.toToolId);
      });
    }
  }

  return unique(results);
}

export function getDependencyTrace(toolId?: string | null) {
  if (!toolId) return [];
  return getUpstreamToolIds(toolId, { deep: true }).reverse().concat(toolId, getDownstreamToolIds(toolId, { deep: true }));
}

