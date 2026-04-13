import { compileWorkflowArtifact } from '../src/domain/workflowArtifact';

describe('compileWorkflowArtifact', () => {
  it('builds a draft workflow artifact with stable edge keys and a primary route', () => {
    const artifact = compileWorkflowArtifact({
      sourcePage: 'analyze',
      intake: {
        sourceQuery: 'mevalonate pathway engineering',
        rawAnalyzeInput: 'Engineer a route to amorpha-4,11-diene.',
      },
      evidencePackets: [
        {
          id: 'evidence-1',
          title: 'Ro et al. 2006',
          abstract: 'Artemisinin precursor pathway engineering.',
          authors: ['Ro'],
        },
      ],
      nodes: [
        {
          id: 'acetyl_coa',
          label: 'Acetyl-CoA',
          canonicalLabel: 'acetyl coa',
          nodeType: 'metabolite',
          summary: 'Starting metabolite.',
          citation: 'Ro et al. 2006',
          color: '#fff',
          position: [0, 0, 0],
        },
        {
          id: 'hmgr',
          label: 'HMGR',
          canonicalLabel: 'hmgr',
          nodeType: 'enzyme',
          summary: 'Rate-limiting enzyme.',
          citation: 'Ro et al. 2006',
          color: '#fff',
          position: [1, 0, 0],
        },
        {
          id: 'amorpha_4_11_diene',
          label: 'Amorpha-4,11-diene',
          canonicalLabel: 'amorpha 4 11 diene',
          nodeType: 'metabolite',
          summary: 'Target product.',
          citation: 'Ro et al. 2006',
          color: '#fff',
          position: [2, 0, 0],
        },
      ],
      edges: [
        {
          start: 'acetyl_coa',
          end: 'amorpha_4_11_diene',
          relationshipType: 'converts',
          direction: 'forward',
          evidence: 'Observed conversion step.',
        },
      ],
      compiledFrom: 'literature-bundle',
      sourceProvider: 'test',
    });

    expect(artifact.schemaVersion).toBe(1);
    expect(artifact.status).toBe('draft');
    expect(artifact.atomicPathwayGraph?.nodes).toHaveLength(3);
    expect(artifact.atomicPathwayGraph?.edges[0]?.key).toBe(
      'evidence-backed-transition:acetyl_coa:converts:amorpha_4_11_diene:forward',
    );
    expect(artifact.candidateRoutes).toEqual([
      expect.objectContaining({
        id: 'primary-route',
        rank: 1,
        nodeIds: ['acetyl_coa', 'hmgr', 'amorpha_4_11_diene'],
        edgeKeys: ['evidence-backed-transition:acetyl_coa:converts:amorpha_4_11_diene:forward'],
      }),
    ]);
  });

  it('reuses stable node ids across Analyze recompiles for the same semantic entities', () => {
    const previousArtifact = compileWorkflowArtifact({
      id: 'artifact-1',
      sourcePage: 'analyze',
      intake: {
        rawAnalyzeInput: 'Initial pathway compile.',
      },
      evidencePackets: [],
      nodes: [
        {
          id: 'mevalonate',
          label: 'Mevalonate',
          canonicalLabel: 'mevalonate',
          nodeType: 'metabolite',
          summary: 'Intermediate.',
          citation: 'Source',
          color: '#fff',
          position: [0, 0, 0],
        },
        {
          id: 'ads',
          label: 'ADS',
          canonicalLabel: 'amorpha diene synthase',
          nodeType: 'enzyme',
          summary: 'Catalyzes terminal step.',
          citation: 'Source',
          color: '#fff',
          position: [1, 0, 0],
        },
      ],
      edges: [
        {
          start: 'mevalonate',
          end: 'ads',
          relationshipType: 'catalyzes',
          direction: 'forward',
        },
      ],
      compiledFrom: 'manual-text',
    });

    const recompiled = compileWorkflowArtifact({
      id: 'artifact-1',
      previousArtifact,
      sourcePage: 'analyze',
      intake: {
        rawAnalyzeInput: 'Refined pathway compile.',
      },
      evidencePackets: [],
      nodes: [
        {
          id: 'mv_new',
          label: 'Mevalonate',
          canonicalLabel: 'mevalonate',
          nodeType: 'metabolite',
          summary: 'Intermediate refined.',
          citation: 'Source',
          color: '#fff',
          position: [0, 0, 0],
        },
        {
          id: 'ads_new',
          label: 'ADS',
          canonicalLabel: 'amorpha diene synthase',
          nodeType: 'enzyme',
          summary: 'Catalyzes terminal step.',
          citation: 'Source',
          color: '#fff',
          position: [1, 0, 0],
        },
        {
          id: 'artemisinic_acid',
          label: 'Artemisinic acid',
          canonicalLabel: 'artemisinic acid',
          nodeType: 'intermediate',
          summary: 'New downstream node.',
          citation: 'Source',
          color: '#fff',
          position: [2, 0, 0],
        },
      ],
      edges: [
        {
          start: 'mv_new',
          end: 'artemisinic_acid',
          relationshipType: 'converts',
          direction: 'forward',
        },
      ],
      compiledFrom: 'manual-text',
    });

    expect(recompiled.atomicPathwayGraph?.nodes.map((node) => node.id)).toEqual([
      'mevalonate',
      'ads',
      'artemisinic_acid',
    ]);
    expect(recompiled.atomicPathwayGraph?.edges[0]?.key).toBe(
      'inferred-transition:mevalonate:converts:artemisinic_acid:forward',
    );
  });
});
