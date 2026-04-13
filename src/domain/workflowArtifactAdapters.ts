import type { WorkbenchAnalyzeArtifact } from '../store/workbenchTypes';
import type { WorkflowArtifact, WorkflowArtifactEdge, WorkflowArtifactNode } from './workflowArtifact';

function deriveTargetProduct(artifact: WorkflowArtifact) {
  const terminalNode = [...(artifact.atomicPathwayGraph?.nodes ?? [])]
    .reverse()
    .find((node) => node.role !== 'enzyme' && node.role !== 'gene');
  return artifact.intake.targetMolecule
    ?? terminalNode?.label
    ?? artifact.atomicPathwayGraph?.nodes[artifact.atomicPathwayGraph.nodes.length - 1]?.label
    ?? 'Target Product';
}

function summarizeRoute(route: WorkflowArtifact['candidateRoutes'][number], nodes: WorkflowArtifactNode[], edges: WorkflowArtifactEdge[]) {
  return {
    id: route.id,
    label: route.label,
    description: `${nodes.length} nodes · ${edges.length} edges`,
    nodeCount: nodes.length,
    edgeCount: edges.length,
  };
}

export function deriveAnalyzeCompatibilityProjection(artifact: WorkflowArtifact): WorkbenchAnalyzeArtifact {
  const nodes = artifact.atomicPathwayGraph?.nodes ?? [];
  const edges = artifact.atomicPathwayGraph?.edges ?? [];
  const targetProduct = deriveTargetProduct(artifact);
  const bottleneckNodes = nodes
    .filter((node) =>
      node.role === 'enzyme'
      || (node.risk_score ?? 0) >= 0.55
      || /bottleneck|rate[- ]limiting|limiting/i.test(node.summary ?? ''),
    )
    .slice(0, 4);
  const enzymeNodes = nodes
    .filter((node) => node.role === 'enzyme')
    .slice(0, 4);
  const thermodynamicConcerns = artifact.thermodynamics?.concerns
    ?? edges
      .filter((edge) => (edge.predicted_delta_G_kJ_mol ?? 0) > 0 || String(edge.spontaneity ?? '').toLowerCase().includes('non'))
      .slice(0, 4)
      .map((edge) => `${edge.start} -> ${edge.end}: ${edge.spontaneity ?? 'Condition-dependent thermodynamics'}`);
  const recommendedNextTools = Array.from(new Set([
    'pathd',
    'fbasim',
    'cethx',
    ...(enzymeNodes.length > 0 ? ['catdes'] : []),
  ]));

  return {
    id: artifact.id || `artifact-${artifact.updatedAt}`,
    title: `${targetProduct} pathway analysis`,
    summary: artifact.intake.projectIntent
      ?? `Compiled ${nodes.length} nodes and ${edges.length} edges for ${targetProduct}.`,
    targetProduct,
    nodes,
    edges,
    pathwayCandidates: artifact.candidateRoutes.map((route) => summarizeRoute(route, nodes, edges)),
    bottleneckAssumptions: bottleneckNodes.map((node) => ({
      id: node.id,
      label: node.label,
      detail: node.summary || 'Potential pathway bottleneck inferred from canonical graph.',
      yieldLossPercent: typeof node.risk_score === 'number' ? Math.round(node.risk_score * 100) : undefined,
    })),
    enzymeCandidates: enzymeNodes.map((node) => ({
      id: node.id,
      label: node.label,
      rationale: node.gene_recommendation || node.summary || 'Enzyme candidate inferred from canonical graph.',
    })),
    thermodynamicConcerns,
    recommendedNextTools,
    evidenceTraceIds: artifact.provenance.evidencePacketIds,
    sourceProvider: artifact.provenance.sourceProvider ?? null,
    generatedAt: artifact.updatedAt,
  };
}
