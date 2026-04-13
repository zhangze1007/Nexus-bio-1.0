import type { PathwayEdge, PathwayNode } from '../types';
import { sanitizeNodeId } from '../types';

export type WorkflowArtifactStatus = 'draft' | 'compiled' | 'error';
export type ProductSourcePage = 'research' | 'analyze' | 'pathd';
export type ScientificStage = 'design' | 'simulate-optimize' | 'engineer-host' | 'test-learn';
export type WorkflowNodeRole =
  | 'metabolite'
  | 'enzyme'
  | 'gene'
  | 'cofactor'
  | 'intermediate'
  | 'impurity'
  | 'hypothesis';
export type WorkflowEdgeRole =
  | 'evidence-backed-transition'
  | 'inferred-transition'
  | 'catalysis'
  | 'regulation'
  | 'abstraction';

export interface WorkflowEvidencePacket {
  id: string;
  sourceKind?: 'literature' | 'analysis' | 'tool' | 'system';
  title: string;
  abstract: string;
  authors: string[];
  journal?: string;
  year?: string;
  doi?: string;
  url?: string;
  source?: string;
  query?: string;
}

export interface WorkflowArtifactNode extends PathwayNode {
  role: WorkflowNodeRole;
}

export interface WorkflowArtifactEdge extends PathwayEdge {
  key: string;
  role: WorkflowEdgeRole;
}

export interface WorkflowCandidateRoute {
  id: string;
  label: string;
  nodeIds: string[];
  edgeKeys: string[];
  rank: number;
}

export interface WorkflowArtifact {
  id: string;
  schemaVersion: number;
  version: number;
  status: WorkflowArtifactStatus;
  sourcePage: ProductSourcePage;
  intake: {
    sourceQuery?: string;
    targetMolecule?: string;
    projectIntent?: string;
    rawAnalyzeInput: string;
  };
  evidencePackets: WorkflowEvidencePacket[];
  atomicPathwayGraph: {
    nodes: WorkflowArtifactNode[];
    edges: WorkflowArtifactEdge[];
  } | null;
  candidateRoutes: WorkflowCandidateRoute[];
  provenance: {
    compiledFrom: 'literature-bundle' | 'manual-text' | 'pdf' | 'image' | 'url';
    evidencePacketIds: string[];
    sourceProvider?: string | null;
  };
  workbench: {
    scientificStage: ScientificStage;
  };
  thermodynamics?: {
    status: 'placeholder';
    concerns?: string[];
  };
  flux?: {
    status: 'placeholder';
    notes?: string[];
  };
  createdAt: number;
  updatedAt: number;
}

interface CompileWorkflowArtifactOptions {
  id?: string | null;
  previousArtifact?: WorkflowArtifact | null;
  sourcePage: ProductSourcePage;
  intake: WorkflowArtifact['intake'];
  evidencePackets: WorkflowEvidencePacket[];
  nodes: PathwayNode[];
  edges: PathwayEdge[];
  compiledFrom: WorkflowArtifact['provenance']['compiledFrom'];
  sourceProvider?: string | null;
}

const WORKFLOW_SCHEMA_VERSION = 1;

function normalizeSignature(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

function inferNodeRole(node: PathwayNode): WorkflowNodeRole {
  switch (node.nodeType) {
    case 'enzyme':
      return 'enzyme';
    case 'gene':
      return 'gene';
    case 'cofactor':
      return 'cofactor';
    case 'intermediate':
      return 'intermediate';
    case 'impurity':
      return 'impurity';
    case 'metabolite':
      return 'metabolite';
    default:
      return 'hypothesis';
  }
}

function inferEdgeRole(edge: PathwayEdge): WorkflowEdgeRole {
  if (edge.relationshipType === 'catalyzes') return 'catalysis';
  if (edge.relationshipType === 'activates' || edge.relationshipType === 'inhibits' || edge.relationshipType === 'regulates') {
    return 'regulation';
  }
  if (edge.relationshipType === 'unknown') return 'abstraction';
  return edge.evidence ? 'evidence-backed-transition' : 'inferred-transition';
}

function makeNodeSignature(node: PathwayNode, role: WorkflowNodeRole) {
  return `${role}:${normalizeSignature(node.canonicalLabel ?? node.label ?? node.id)}`;
}

function buildPreviousNodeSignatureIndex(previousArtifact?: WorkflowArtifact | null) {
  const index = new Map<string, string>();
  previousArtifact?.atomicPathwayGraph?.nodes.forEach((node) => {
    index.set(makeNodeSignature(node, node.role), node.id);
  });
  return index;
}

function makeUniqueNodeId(baseId: string, usedIds: Set<string>) {
  let candidate = sanitizeNodeId(baseId || 'workflow_node');
  if (!candidate) candidate = 'workflow_node';
  if (!usedIds.has(candidate)) {
    usedIds.add(candidate);
    return candidate;
  }
  let suffix = 2;
  while (usedIds.has(`${candidate}_${suffix}`)) {
    suffix += 1;
  }
  const uniqueId = `${candidate}_${suffix}`;
  usedIds.add(uniqueId);
  return uniqueId;
}

function buildStableNodes(nodes: PathwayNode[], previousArtifact?: WorkflowArtifact | null) {
  const previousIndex = buildPreviousNodeSignatureIndex(previousArtifact);
  const usedIds = new Set<string>();

  return nodes.map((node) => {
    const role = inferNodeRole(node);
    const signature = makeNodeSignature(node, role);
    const preferredId = previousIndex.get(signature) ?? node.id ?? signature;
    const stableId = makeUniqueNodeId(preferredId, usedIds);

    return {
      ...node,
      id: stableId,
      role,
    } satisfies WorkflowArtifactNode;
  });
}

function buildEdgeKey(edge: PathwayEdge, role: WorkflowEdgeRole) {
  return [
    role,
    sanitizeNodeId(edge.start),
    edge.relationshipType ?? 'unknown',
    sanitizeNodeId(edge.end),
    edge.direction ?? 'forward',
  ].join(':');
}

function buildStableEdges(edges: PathwayEdge[], nodeIdMap: Map<string, string>) {
  const seen = new Set<string>();

  return edges.flatMap((edge) => {
    const resolvedStart = nodeIdMap.get(edge.start) ?? sanitizeNodeId(edge.start);
    const resolvedEnd = nodeIdMap.get(edge.end) ?? sanitizeNodeId(edge.end);
    const role = inferEdgeRole(edge);
    const key = buildEdgeKey({ ...edge, start: resolvedStart, end: resolvedEnd }, role);

    if (seen.has(key)) return [];
    seen.add(key);

    return [{
      ...edge,
      start: resolvedStart,
      end: resolvedEnd,
      key,
      role,
    } satisfies WorkflowArtifactEdge];
  });
}

function inferTargetMolecule(nodes: WorkflowArtifactNode[], intake: WorkflowArtifact['intake']) {
  const preferred = [...nodes].reverse().find((node) => node.role !== 'enzyme' && node.role !== 'gene');
  return intake.targetMolecule ?? preferred?.label ?? nodes[nodes.length - 1]?.label;
}

function buildCandidateRoutes(
  nodes: WorkflowArtifactNode[],
  edges: WorkflowArtifactEdge[],
  targetMolecule?: string,
): WorkflowCandidateRoute[] {
  if (!nodes.length) return [];
  const routeLabel = targetMolecule
    ? `${nodes[0]?.label ?? 'Source'} -> ${targetMolecule}`
    : `${nodes[0]?.label ?? 'Source'} route`;

  return [{
    id: 'primary-route',
    label: routeLabel,
    nodeIds: nodes.map((node) => node.id),
    edgeKeys: edges.map((edge) => edge.key),
    rank: 1,
  }];
}

function buildThermodynamicPlaceholder(edges: WorkflowArtifactEdge[]) {
  const concerns = edges
    .filter((edge) => (edge.predicted_delta_G_kJ_mol ?? 0) > 0 || String(edge.spontaneity ?? '').toLowerCase().includes('non'))
    .slice(0, 4)
    .map((edge) => `${edge.start} -> ${edge.end}: ${edge.spontaneity ?? 'Condition-dependent thermodynamics'}`);

  return concerns.length > 0 ? { status: 'placeholder' as const, concerns } : undefined;
}

export function compileWorkflowArtifact(options: CompileWorkflowArtifactOptions): WorkflowArtifact {
  const previousArtifact = options.previousArtifact ?? null;
  const stableNodes = buildStableNodes(options.nodes, previousArtifact);
  const nodeIdMap = new Map<string, string>(
    stableNodes.flatMap<readonly [string, string]>((node) => {
      const entries: Array<readonly [string, string]> = [[node.id, node.id]];
      if (node.id !== sanitizeNodeId(node.id)) {
        entries.push([sanitizeNodeId(node.id), node.id]);
      }
      return entries;
    }),
  );
  options.nodes.forEach((node, index) => {
    const stable = stableNodes[index];
    if (!stable) return;
    nodeIdMap.set(node.id, stable.id);
    nodeIdMap.set(sanitizeNodeId(node.id), stable.id);
  });

  const stableEdges = buildStableEdges(options.edges, nodeIdMap);
  const targetMolecule = inferTargetMolecule(stableNodes, options.intake);
  const createdAt = previousArtifact?.createdAt ?? Date.now();

  return {
    id: options.id ?? previousArtifact?.id ?? '',
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    version: previousArtifact?.version ?? 0,
    status: 'draft',
    sourcePage: options.sourcePage,
    intake: {
      ...options.intake,
      targetMolecule,
    },
    evidencePackets: options.evidencePackets,
    atomicPathwayGraph: stableNodes.length > 0 ? {
      nodes: stableNodes,
      edges: stableEdges,
    } : null,
    candidateRoutes: buildCandidateRoutes(stableNodes, stableEdges, targetMolecule),
    provenance: {
      compiledFrom: options.compiledFrom,
      evidencePacketIds: options.evidencePackets.map((packet) => packet.id),
      sourceProvider: options.sourceProvider ?? null,
    },
    workbench: {
      scientificStage: previousArtifact?.workbench.scientificStage ?? 'design',
    },
    thermodynamics: buildThermodynamicPlaceholder(stableEdges),
    createdAt,
    updatedAt: Date.now(),
  };
}

export function isCompiledWorkflowArtifact(artifact: WorkflowArtifact | null | undefined): artifact is WorkflowArtifact {
  return Boolean(
    artifact
    && artifact.status === 'compiled'
    && artifact.atomicPathwayGraph
    && artifact.atomicPathwayGraph.nodes.length > 0,
  );
}
