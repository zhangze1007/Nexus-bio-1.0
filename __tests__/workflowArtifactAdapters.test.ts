/**
 * Tests for src/domain/workflowArtifactAdapters.ts
 *
 * Covers deriveAnalyzeCompatibilityProjection with various
 * workflow artifact shapes, testing all branching logic including
 * target product derivation, bottleneck inference, enzyme filtering,
 * thermodynamic concerns, and recommended next tools.
 */

import { deriveAnalyzeCompatibilityProjection } from '../src/domain/workflowArtifactAdapters';
import type { WorkflowArtifact, WorkflowArtifactNode, WorkflowArtifactEdge } from '../src/domain/workflowArtifact';

function makeArtifact(overrides?: Partial<WorkflowArtifact>): WorkflowArtifact {
  return {
    id: 'wf-1',
    schemaVersion: 1,
    version: 1,
    status: 'compiled',
    sourcePage: 'analyze',
    intake: { rawAnalyzeInput: 'test', sourceQuery: 'test query' },
    evidencePackets: [],
    atomicPathwayGraph: {
      nodes: [
        { id: 'n1', label: 'Acetyl-CoA', role: 'metabolite', nodeType: 'metabolite', summary: '', citation: '', color: '' },
        { id: 'n2', label: 'Artemisinin', role: 'metabolite', nodeType: 'metabolite', summary: '', citation: '', color: '' },
        { id: 'n3', label: 'ADS', role: 'enzyme', nodeType: 'enzyme', summary: 'Rate-limiting step', citation: '', color: '' },
      ],
      edges: [
        { start: 'n1', end: 'n3', key: 'k1', role: 'catalysis' },
        { start: 'n3', end: 'n2', key: 'k2', role: 'evidence-backed-transition' },
      ],
    },
    candidateRoutes: [
      { id: 'primary-route', label: 'Acetyl-CoA -> Artemisinin', nodeIds: ['n1', 'n2', 'n3'], edgeKeys: ['k1', 'k2'], rank: 1 },
    ],
    provenance: { compiledFrom: 'manual-text', evidencePacketIds: ['ep-1'], sourceProvider: 'groq' },
    workbench: { scientificStage: 'design' },
    createdAt: 1000,
    updatedAt: 2000,
    ...overrides,
  } as WorkflowArtifact;
}

describe('deriveAnalyzeCompatibilityProjection', () => {
  it('derives target product from intake.targetMolecule', () => {
    const artifact = makeArtifact({
      intake: { rawAnalyzeInput: 'test', targetMolecule: 'My Target Molecule' },
    });
    const result = deriveAnalyzeCompatibilityProjection(artifact);
    expect(result.targetProduct).toBe('My Target Molecule');
  });

  it('derives target product from terminal non-enzyme node when no targetMolecule', () => {
    const artifact = makeArtifact({
      intake: { rawAnalyzeInput: 'test' },
    });
    const result = deriveAnalyzeCompatibilityProjection(artifact);
    // Terminal non-enzyme node (reversed) is 'Artemisinin' (n2)
    expect(result.targetProduct).toBe('Artemisinin');
  });

  it('falls back to last node label when all nodes are enzymes', () => {
    const artifact = makeArtifact({
      atomicPathwayGraph: {
        nodes: [
          { id: 'e1', label: 'EnzymeA', role: 'enzyme', nodeType: 'enzyme', summary: '', citation: '', color: '' },
          { id: 'e2', label: 'EnzymeB', role: 'enzyme', nodeType: 'enzyme', summary: '', citation: '', color: '' },
        ],
        edges: [],
      },
      intake: { rawAnalyzeInput: 'test' },
    });
    const result = deriveAnalyzeCompatibilityProjection(artifact);
    expect(result.targetProduct).toBe('EnzymeB');
  });

  it('falls back to "Target Product" when no nodes', () => {
    const artifact = makeArtifact({
      atomicPathwayGraph: { nodes: [], edges: [] },
      intake: { rawAnalyzeInput: 'test' },
    });
    const result = deriveAnalyzeCompatibilityProjection(artifact);
    expect(result.targetProduct).toBe('Target Product');
  });

  it('falls back to "Target Product" when atomicPathwayGraph is null', () => {
    const artifact = makeArtifact({
      atomicPathwayGraph: null,
      intake: { rawAnalyzeInput: 'test' },
    });
    const result = deriveAnalyzeCompatibilityProjection(artifact);
    expect(result.targetProduct).toBe('Target Product');
  });

  it('uses artifact.id or generates fallback id', () => {
    const withId = deriveAnalyzeCompatibilityProjection(makeArtifact({ id: 'my-id' }));
    expect(withId.id).toBe('my-id');

    const noId = deriveAnalyzeCompatibilityProjection(makeArtifact({ id: '', updatedAt: 5000 }));
    expect(noId.id).toBe('artifact-5000');
  });

  it('generates title from target product', () => {
    const result = deriveAnalyzeCompatibilityProjection(makeArtifact());
    expect(result.title).toContain('pathway analysis');
    expect(result.title).toContain('Artemisinin');
  });

  it('uses intake.projectIntent for summary when available', () => {
    const artifact = makeArtifact({
      intake: { rawAnalyzeInput: 'test', projectIntent: 'Build artemisinin pathway' },
    });
    const result = deriveAnalyzeCompatibilityProjection(artifact);
    expect(result.summary).toBe('Build artemisinin pathway');
  });

  it('generates summary from node/edge count when no projectIntent', () => {
    const artifact = makeArtifact({
      intake: { rawAnalyzeInput: 'test' },
    });
    const result = deriveAnalyzeCompatibilityProjection(artifact);
    expect(result.summary).toContain('3 nodes');
    expect(result.summary).toContain('2 edges');
  });

  it('filters bottleneck nodes correctly', () => {
    const nodes: WorkflowArtifactNode[] = [
      { id: 'n1', label: 'Met', role: 'metabolite', nodeType: 'metabolite', summary: '', citation: '', color: '' },
      { id: 'n2', label: 'Enz1', role: 'enzyme', nodeType: 'enzyme', summary: '', citation: '', color: '' },
      { id: 'n3', label: 'Enz2', role: 'enzyme', nodeType: 'enzyme', summary: 'bottleneck step', citation: '', color: '' },
      { id: 'n4', label: 'HighRisk', role: 'metabolite', nodeType: 'metabolite', summary: '', risk_score: 0.7, citation: '', color: '' },
      { id: 'n5', label: 'LowRisk', role: 'metabolite', nodeType: 'metabolite', summary: '', risk_score: 0.3, citation: '', color: '' },
    ];
    const artifact = makeArtifact({
      atomicPathwayGraph: { nodes, edges: [] },
    });
    const result = deriveAnalyzeCompatibilityProjection(artifact);
    // Enzyme nodes (n2, n3) + high risk node (n4) = 3 bottlenecks
    expect(result.bottleneckAssumptions.length).toBe(3);
    expect(result.bottleneckAssumptions.some((b) => b.id === 'n2')).toBe(true);
    expect(result.bottleneckAssumptions.some((b) => b.id === 'n3')).toBe(true);
    expect(result.bottleneckAssumptions.some((b) => b.id === 'n4')).toBe(true);
  });

  it('caps bottleneckAssumptions at 4', () => {
    const nodes: WorkflowArtifactNode[] = Array.from({ length: 10 }, (_, i) => ({
      id: `e${i}`,
      label: `Enz${i}`,
      role: 'enzyme' as const,
      nodeType: 'enzyme',
      summary: '',
      citation: '',
      color: '',
    }));
    const artifact = makeArtifact({
      atomicPathwayGraph: { nodes, edges: [] },
    });
    const result = deriveAnalyzeCompatibilityProjection(artifact);
    expect(result.bottleneckAssumptions.length).toBe(4);
  });

  it('sets yieldLossPercent from risk_score', () => {
    const nodes: WorkflowArtifactNode[] = [
      { id: 'n1', label: 'Enz', role: 'enzyme', nodeType: 'enzyme', summary: '', risk_score: 0.75, citation: '', color: '' },
    ];
    const artifact = makeArtifact({
      atomicPathwayGraph: { nodes, edges: [] },
    });
    const result = deriveAnalyzeCompatibilityProjection(artifact);
    expect(result.bottleneckAssumptions[0].yieldLossPercent).toBe(75);
  });

  it('sets yieldLossPercent to undefined when no risk_score', () => {
    const nodes: WorkflowArtifactNode[] = [
      { id: 'n1', label: 'Enz', role: 'enzyme', nodeType: 'enzyme', summary: '', citation: '', color: '' },
    ];
    const artifact = makeArtifact({
      atomicPathwayGraph: { nodes, edges: [] },
    });
    const result = deriveAnalyzeCompatibilityProjection(artifact);
    expect(result.bottleneckAssumptions[0].yieldLossPercent).toBeUndefined();
  });

  it('filters enzyme candidates', () => {
    const result = deriveAnalyzeCompatibilityProjection(makeArtifact());
    expect(result.enzymeCandidates.length).toBe(1);
    expect(result.enzymeCandidates[0].id).toBe('n3');
    expect(result.enzymeCandidates[0].label).toBe('ADS');
  });

  it('caps enzymeCandidates at 4', () => {
    const nodes: WorkflowArtifactNode[] = Array.from({ length: 8 }, (_, i) => ({
      id: `e${i}`,
      label: `Enz${i}`,
      role: 'enzyme' as const,
      nodeType: 'enzyme',
      summary: '',
      citation: '',
      color: '',
    }));
    const artifact = makeArtifact({
      atomicPathwayGraph: { nodes, edges: [] },
    });
    const result = deriveAnalyzeCompatibilityProjection(artifact);
    expect(result.enzymeCandidates.length).toBe(4);
  });

  it('uses gene_recommendation for enzyme rationale when available', () => {
    const nodes: WorkflowArtifactNode[] = [
      { id: 'n1', label: 'Enz', role: 'enzyme', nodeType: 'enzyme', summary: 'Some summary', gene_recommendation: 'Use variant X', citation: '', color: '' },
    ];
    const artifact = makeArtifact({
      atomicPathwayGraph: { nodes, edges: [] },
    });
    const result = deriveAnalyzeCompatibilityProjection(artifact);
    expect(result.enzymeCandidates[0].rationale).toBe('Use variant X');
  });

  it('falls back to summary for enzyme rationale', () => {
    const nodes: WorkflowArtifactNode[] = [
      { id: 'n1', label: 'Enz', role: 'enzyme', nodeType: 'enzyme', summary: 'Important enzyme', citation: '', color: '' },
    ];
    const artifact = makeArtifact({
      atomicPathwayGraph: { nodes, edges: [] },
    });
    const result = deriveAnalyzeCompatibilityProjection(artifact);
    expect(result.enzymeCandidates[0].rationale).toBe('Important enzyme');
  });

  it('uses default rationale when both gene_recommendation and summary are empty', () => {
    const nodes: WorkflowArtifactNode[] = [
      { id: 'n1', label: 'Enz', role: 'enzyme', nodeType: 'enzyme', summary: '', citation: '', color: '' },
    ];
    const artifact = makeArtifact({
      atomicPathwayGraph: { nodes, edges: [] },
    });
    const result = deriveAnalyzeCompatibilityProjection(artifact);
    expect(result.enzymeCandidates[0].rationale).toBe('Enzyme candidate inferred from canonical graph.');
  });

  it('uses thermodynamics from artifact when available', () => {
    const artifact = makeArtifact({
      thermodynamics: { status: 'placeholder', concerns: ['Custom concern 1', 'Custom concern 2'] },
    });
    const result = deriveAnalyzeCompatibilityProjection(artifact);
    expect(result.thermodynamicConcerns).toEqual(['Custom concern 1', 'Custom concern 2']);
  });

  it('derives thermodynamic concerns from edges when thermodynamics not present', () => {
    const edges: WorkflowArtifactEdge[] = [
      { start: 'n1', end: 'n2', key: 'k1', role: 'evidence-backed-transition', predicted_delta_G_kJ_mol: 5.0 },
      { start: 'n2', end: 'n3', key: 'k2', role: 'evidence-backed-transition', spontaneity: 'Non-spontaneous' },
      { start: 'n3', end: 'n4', key: 'k3', role: 'evidence-backed-transition', predicted_delta_G_kJ_mol: -10.0 },
    ];
    const artifact = makeArtifact({
      atomicPathwayGraph: { nodes: [], edges },
    });
    const result = deriveAnalyzeCompatibilityProjection(artifact);
    // First edge has positive delta G, second has 'Non' in spontaneity
    expect(result.thermodynamicConcerns.length).toBe(2);
  });

  it('caps thermodynamic concerns at 4', () => {
    const edges: WorkflowArtifactEdge[] = Array.from({ length: 8 }, (_, i) => ({
      start: `n${i}`,
      end: `n${i + 1}`,
      key: `k${i}`,
      role: 'evidence-backed-transition' as const,
      predicted_delta_G_kJ_mol: 1.0,
    }));
    const artifact = makeArtifact({
      atomicPathwayGraph: { nodes: [], edges },
    });
    const result = deriveAnalyzeCompatibilityProjection(artifact);
    expect(result.thermodynamicConcerns.length).toBe(4);
  });

  it('recommends catdes when enzyme nodes exist', () => {
    const result = deriveAnalyzeCompatibilityProjection(makeArtifact());
    expect(result.recommendedNextTools).toContain('catdes');
  });

  it('does not recommend catdes when no enzyme nodes', () => {
    const artifact = makeArtifact({
      atomicPathwayGraph: {
        nodes: [
          { id: 'n1', label: 'Met', role: 'metabolite', nodeType: 'metabolite', summary: '', citation: '', color: '' },
        ],
        edges: [],
      },
    });
    const result = deriveAnalyzeCompatibilityProjection(artifact);
    expect(result.recommendedNextTools).not.toContain('catdes');
  });

  it('always recommends pathd, fbasim, cethx', () => {
    const result = deriveAnalyzeCompatibilityProjection(makeArtifact());
    expect(result.recommendedNextTools).toContain('pathd');
    expect(result.recommendedNextTools).toContain('fbasim');
    expect(result.recommendedNextTools).toContain('cethx');
  });

  it('deduplicates recommended tools', () => {
    const result = deriveAnalyzeCompatibilityProjection(makeArtifact());
    const unique = new Set(result.recommendedNextTools);
    expect(result.recommendedNextTools.length).toBe(unique.size);
  });

  it('maps candidateRoutes to pathwayCandidates', () => {
    const result = deriveAnalyzeCompatibilityProjection(makeArtifact());
    expect(result.pathwayCandidates.length).toBe(1);
    expect(result.pathwayCandidates[0].id).toBe('primary-route');
    expect(result.pathwayCandidates[0].label).toBe('Acetyl-CoA -> Artemisinin');
    expect(result.pathwayCandidates[0].nodeCount).toBe(3);
    expect(result.pathwayCandidates[0].edgeCount).toBe(2);
  });

  it('preserves evidenceTraceIds from provenance', () => {
    const result = deriveAnalyzeCompatibilityProjection(makeArtifact());
    expect(result.evidenceTraceIds).toEqual(['ep-1']);
  });

  it('preserves sourceProvider from provenance', () => {
    const result = deriveAnalyzeCompatibilityProjection(makeArtifact());
    expect(result.sourceProvider).toBe('groq');
  });

  it('sets sourceProvider to null when not in provenance', () => {
    const artifact = makeArtifact({
      provenance: { compiledFrom: 'manual-text', evidencePacketIds: [] },
    });
    const result = deriveAnalyzeCompatibilityProjection(artifact);
    expect(result.sourceProvider).toBeNull();
  });

  it('sets generatedAt to artifact.updatedAt', () => {
    const artifact = makeArtifact({ updatedAt: 9999 });
    const result = deriveAnalyzeCompatibilityProjection(artifact);
    expect(result.generatedAt).toBe(9999);
  });

  it('uses empty arrays when atomicPathwayGraph is null', () => {
    const artifact = makeArtifact({ atomicPathwayGraph: null });
    const result = deriveAnalyzeCompatibilityProjection(artifact);
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
    expect(result.bottleneckAssumptions).toEqual([]);
    expect(result.enzymeCandidates).toEqual([]);
  });

  it('detects bottleneck via summary pattern matching (rate-limiting)', () => {
    const nodes: WorkflowArtifactNode[] = [
      { id: 'n1', label: 'X', role: 'metabolite', nodeType: 'metabolite', summary: 'rate limiting step', citation: '', color: '' },
    ];
    const artifact = makeArtifact({
      atomicPathwayGraph: { nodes, edges: [] },
    });
    const result = deriveAnalyzeCompatibilityProjection(artifact);
    expect(result.bottleneckAssumptions.some((b) => b.id === 'n1')).toBe(true);
  });

  it('detects bottleneck via summary pattern matching (rate-limiting with hyphen)', () => {
    const nodes: WorkflowArtifactNode[] = [
      { id: 'n1', label: 'X', role: 'metabolite', nodeType: 'metabolite', summary: 'rate-limiting enzyme', citation: '', color: '' },
    ];
    const artifact = makeArtifact({
      atomicPathwayGraph: { nodes, edges: [] },
    });
    const result = deriveAnalyzeCompatibilityProjection(artifact);
    expect(result.bottleneckAssumptions.some((b) => b.id === 'n1')).toBe(true);
  });

  it('sets detail from summary or default', () => {
    const nodes: WorkflowArtifactNode[] = [
      { id: 'n1', label: 'Enz', role: 'enzyme', nodeType: 'enzyme', summary: 'Custom detail', citation: '', color: '' },
      { id: 'n2', label: 'Enz2', role: 'enzyme', nodeType: 'enzyme', summary: '', citation: '', color: '' },
    ];
    const artifact = makeArtifact({
      atomicPathwayGraph: { nodes, edges: [] },
    });
    const result = deriveAnalyzeCompatibilityProjection(artifact);
    expect(result.bottleneckAssumptions[0].detail).toBe('Custom detail');
    expect(result.bottleneckAssumptions[1].detail).toBe('Potential pathway bottleneck inferred from canonical graph.');
  });
});
