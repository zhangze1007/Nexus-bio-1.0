import { keggToPathway } from '../../src/utils/keggToPathway';
import type { KEGGPathwayResult } from '../../src/services/database/keggClient';

describe('keggToPathway', () => {
  const glycolysisData: KEGGPathwayResult = {
    id: 'map00010',
    name: 'Glycolysis / Gluconeogenesis',
    reactions: ['R00200', 'R00658', 'R01015'],
    compounds: ['C00022', 'C00024', 'C00033', 'C00074'],
  };

  it('returns nodes and edges from KEGG data', () => {
    const result = keggToPathway(glycolysisData);
    expect(result.nodes.length).toBe(4);
    expect(result.edges.length).toBe(3);
  });

  it('creates one node per unique compound', () => {
    const result = keggToPathway(glycolysisData);
    const ids = result.nodes.map(n => n.id);
    expect(ids).toEqual(['C00022', 'C00024', 'C00033', 'C00074']);
  });

  it('deduplicates compounds', () => {
    const data: KEGGPathwayResult = {
      id: 'map00010',
      name: 'Test',
      reactions: [],
      compounds: ['C00022', 'C00022', 'C00024'],
    };
    const result = keggToPathway(data);
    expect(result.nodes.length).toBe(2);
    expect(result.nodes[0].id).toBe('C00022');
    expect(result.nodes[1].id).toBe('C00024');
  });

  it('creates edges between consecutive compounds (linear chain)', () => {
    const result = keggToPathway(glycolysisData);
    expect(result.edges[0]).toEqual({
      start: 'C00022',
      end: 'C00024',
      direction: 'forward',
      relationshipType: 'converts',
      evidence: 'KEGG reaction R00200',
    });
    expect(result.edges[1].start).toBe('C00024');
    expect(result.edges[1].end).toBe('C00033');
    expect(result.edges[2].start).toBe('C00033');
    expect(result.edges[2].end).toBe('C00074');
  });

  it('attaches reaction IDs to edges as evidence', () => {
    const result = keggToPathway(glycolysisData);
    expect(result.edges[0].evidence).toBe('KEGG reaction R00200');
    expect(result.edges[1].evidence).toBe('KEGG reaction R00658');
    expect(result.edges[2].evidence).toBe('KEGG reaction R01015');
  });

  it('sets nodeType to metabolite', () => {
    const result = keggToPathway(glycolysisData);
    result.nodes.forEach(node => {
      expect(node.nodeType).toBe('metabolite');
    });
  });

  it('resolves known compound names from lookup table', () => {
    const result = keggToPathway(glycolysisData);
    expect(result.nodes[0].label).toBe('Pyruvate');
    expect(result.nodes[1].label).toBe('Acetyl-CoA');
  });

  it('falls back to compound ID for unknown compounds', () => {
    const data: KEGGPathwayResult = {
      id: 'map99999',
      name: 'Unknown pathway',
      reactions: [],
      compounds: ['C99999'],
    };
    const result = keggToPathway(data);
    expect(result.nodes[0].label).toBe('C99999');
  });

  it('returns empty arrays when no compounds', () => {
    const data: KEGGPathwayResult = {
      id: 'map00000',
      name: 'Empty',
      reactions: [],
      compounds: [],
    };
    const result = keggToPathway(data);
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it('assigns circular positions with correct structure', () => {
    const result = keggToPathway(glycolysisData);
    result.nodes.forEach(node => {
      expect(node.position).toHaveLength(3);
      expect(typeof node.position[0]).toBe('number');
      expect(typeof node.position[1]).toBe('number');
      expect(typeof node.position[2]).toBe('number');
    });
  });

  it('sets citation to KEGG pathway ID', () => {
    const result = keggToPathway(glycolysisData);
    result.nodes.forEach(node => {
      expect(node.citation).toBe('KEGG map00010');
    });
  });

  it('sets summary with pathway name', () => {
    const result = keggToPathway(glycolysisData);
    expect(result.nodes[0].summary).toContain('Glycolysis / Gluconeogenesis');
  });

  it('uses blue color for all nodes', () => {
    const result = keggToPathway(glycolysisData);
    result.nodes.forEach(node => {
      expect(node.color).toBe('#4fc3f7');
    });
  });

  it('handles single compound (no edges)', () => {
    const data: KEGGPathwayResult = {
      id: 'map00001',
      name: 'Single',
      reactions: [],
      compounds: ['C00022'],
    };
    const result = keggToPathway(data);
    expect(result.nodes.length).toBe(1);
    expect(result.edges.length).toBe(0);
    expect(result.nodes[0].position).toEqual([0, 0, 0]);
  });

  it('handles more reactions than edges needed gracefully', () => {
    const data: KEGGPathwayResult = {
      id: 'map00010',
      name: 'Test',
      reactions: ['R001', 'R002', 'R003', 'R004', 'R005'],
      compounds: ['C001', 'C002', 'C003'],
    };
    const result = keggToPathway(data);
    // Only 2 edges for 3 compounds, extra reactions ignored
    expect(result.edges.length).toBe(2);
    expect(result.edges[0].evidence).toBe('KEGG reaction R001');
    expect(result.edges[1].evidence).toBe('KEGG reaction R002');
  });

  it('handles fewer reactions than edges needed gracefully', () => {
    const data: KEGGPathwayResult = {
      id: 'map00010',
      name: 'Test',
      reactions: ['R001'],
      compounds: ['C001', 'C002', 'C003'],
    };
    const result = keggToPathway(data);
    expect(result.edges.length).toBe(2);
    expect(result.edges[0].evidence).toBe('KEGG reaction R001');
    expect(result.edges[1].evidence).toBeUndefined();
  });
});
