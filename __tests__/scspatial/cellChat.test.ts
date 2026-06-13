/** @jest-environment node */

import {
  analyzeCommunication,
  getLRDatabase,
  getPathways,
  type CommunicationInput,
} from '../../src/server/cellChat';
import ligandReceptorDB from '../../src/data/ligandReceptorDB.json';

// ─── Database Tests ─────────────────────────────────────────────────────────

describe('ligand-receptor database', () => {
  it('contains at least 50 L-R pairs', () => {
    expect(ligandReceptorDB.length).toBeGreaterThanOrEqual(50);
  });

  it('each entry has ligand, receptor, and pathway', () => {
    for (const entry of ligandReceptorDB) {
      expect(entry).toHaveProperty('ligand');
      expect(entry).toHaveProperty('receptor');
      expect(entry).toHaveProperty('pathway');
      expect(typeof entry.ligand).toBe('string');
      expect(typeof entry.receptor).toBe('string');
      expect(typeof entry.pathway).toBe('string');
    }
  });

  it('covers major signaling pathways', () => {
    const pathways = new Set(ligandReceptorDB.map(e => e.pathway));
    const expected = ['FGF', 'WNT', 'Notch', 'TGF-beta', 'EGF', 'VEGF', 'Chemokine'];
    for (const p of expected) {
      expect(pathways).toContain(p);
    }
  });

  it('getLRDatabase returns the same data', () => {
    const db = getLRDatabase();
    expect(db.length).toBe(ligandReceptorDB.length);
    expect(db[0].ligand).toBe(ligandReceptorDB[0].ligand);
  });

  it('getPathways returns unique sorted pathways', () => {
    const pathways = getPathways();
    expect(pathways.length).toBeGreaterThan(0);
    expect(pathways).toEqual([...pathways].sort());
    expect(new Set(pathways).size).toBe(pathways.length);
  });
});

// ─── Communication Analysis Tests ───────────────────────────────────────────

describe('cell-cell communication', () => {
  const basicInput: CommunicationInput = {
    expressionMatrix: {
      'FGF1': { cluster1: 5.2, cluster2: 0.1, cluster3: 2.1 },
      'FGFR1': { cluster1: 0.3, cluster2: 4.8, cluster3: 1.5 },
      'WNT3A': { cluster1: 0.0, cluster2: 3.5, cluster3: 0.1 },
      'FZD5': { cluster1: 4.0, cluster2: 0.2, cluster3: 1.0 },
      'DLL1': { cluster1: 3.0, cluster2: 0.0, cluster3: 0.5 },
      'NOTCH1': { cluster1: 0.1, cluster2: 2.5, cluster3: 3.0 },
    },
    clusters: ['cluster1', 'cluster2', 'cluster3'],
  };

  it('identifies L-R interactions between clusters', () => {
    const result = analyzeCommunication(basicInput);
    const fgf = result.interactions.find(
      i => i.ligand === 'FGF1' && i.receptor === 'FGFR1'
    );
    expect(fgf).toBeDefined();
    expect(fgf!.probability).toBeGreaterThan(0);
  });

  it('finds the strongest FGF1->FGFR1 interaction in the expected pair', () => {
    const result = analyzeCommunication(basicInput);
    const fgfInteractions = result.interactions.filter(
      i => i.ligand === 'FGF1' && i.receptor === 'FGFR1'
    );
    // cluster1 (FGF1=5.2) -> cluster2 (FGFR1=4.8) should be strongest
    const best = fgfInteractions.reduce((a, b) =>
      a.probability > b.probability ? a : b
    );
    expect(best.sender).toBe('cluster1');
    expect(best.receiver).toBe('cluster2');
  });

  it('finds WNT3A->FZD5 strongest from cluster2->cluster1', () => {
    const result = analyzeCommunication(basicInput);
    const wnt = result.interactions.filter(
      i => i.ligand === 'WNT3A' && i.receptor === 'FZD5'
    );
    const best = wnt.reduce((a, b) =>
      a.probability > b.probability ? a : b
    );
    expect(best.sender).toBe('cluster2');
    expect(best.receiver).toBe('cluster1');
  });

  it('returns zero probability when ligand or receptor is absent', () => {
    const input: CommunicationInput = {
      expressionMatrix: {
        'FGF1': { cluster1: 5.0, cluster2: 0.0 },
        'FGFR1': { cluster1: 0.0, cluster2: 5.0 },
      },
      clusters: ['cluster1', 'cluster2'],
    };
    const result = analyzeCommunication(input);
    // All interactions involving absent genes should not appear (prob=0 filtered out)
    for (const inter of result.interactions) {
      expect(inter.probability).toBeGreaterThan(0);
    }
  });

  it('returns empty interactions for empty expression matrix', () => {
    const input: CommunicationInput = {
      expressionMatrix: {},
      clusters: ['c1', 'c2'],
    };
    const result = analyzeCommunication(input);
    expect(result.interactions).toEqual([]);
  });

  it('computes network centrality', () => {
    const result = analyzeCommunication(basicInput);
    expect(result.centrality.cluster1).toBeDefined();
    expect(result.centrality.cluster1.outgoingStrength).toBeGreaterThanOrEqual(0);
    expect(result.centrality.cluster1.incomingStrength).toBeGreaterThanOrEqual(0);
    expect(result.centrality.cluster1.totalStrength).toBeGreaterThanOrEqual(0);
    expect(['sender', 'receiver', 'mediator']).toContain(
      result.centrality.cluster1.dominantRole
    );
  });

  it('cluster1 is a dominant sender (high FGF1, DLL1 expression)', () => {
    const result = analyzeCommunication(basicInput);
    // cluster1 has high ligand expression (FGF1=5.2, DLL1=3.0)
    expect(result.centrality.cluster1.outgoingStrength).toBeGreaterThan(
      result.centrality.cluster2.outgoingStrength
    );
  });

  it('computes pathway summary', () => {
    const result = analyzeCommunication(basicInput);
    expect(result.pathwaySummary.FGF).toBeGreaterThan(0);
    expect(result.pathwaySummary.WNT).toBeGreaterThan(0);
    expect(result.pathwaySummary.Notch).toBeGreaterThan(0);
  });

  it('pathway details include top sender and receiver', () => {
    const result = analyzeCommunication(basicInput);
    const fgfDetail = result.pathwayDetails.find(p => p.pathway === 'FGF');
    expect(fgfDetail).toBeDefined();
    expect(fgfDetail!.topSender).toBeTruthy();
    expect(fgfDetail!.topReceiver).toBeTruthy();
    expect(fgfDetail!.interactionCount).toBeGreaterThan(0);
  });

  it('topInteractions are sorted by probability descending', () => {
    const result = analyzeCommunication(basicInput);
    for (let i = 1; i < result.topInteractions.length; i++) {
      expect(result.topInteractions[i - 1].probability).toBeGreaterThanOrEqual(
        result.topInteractions[i].probability
      );
    }
  });

  it('significance values are in [0, 1]', () => {
    const result = analyzeCommunication(basicInput);
    for (const inter of result.interactions) {
      expect(inter.significance).toBeGreaterThanOrEqual(0);
      expect(inter.significance).toBeLessThanOrEqual(1);
    }
  });

  it('respects cell counts via Hill scaling', () => {
    const withCounts: CommunicationInput = {
      ...basicInput,
      cellCounts: { cluster1: 500, cluster2: 50, cluster3: 100 },
    };
    const resultNoCounts = analyzeCommunication(basicInput);
    const resultWithCounts = analyzeCommunication(withCounts);
    // With cell counts, probabilities should differ
    expect(resultWithCounts.interactions.length).toBeGreaterThan(0);
    // At least one probability should be different
    const changed = resultWithCounts.interactions.some((inter, i) =>
      i < resultNoCounts.interactions.length &&
      inter.probability !== resultNoCounts.interactions[i].probability
    );
    expect(changed).toBe(true);
  });

  it('handles single cluster gracefully', () => {
    const input: CommunicationInput = {
      expressionMatrix: {
        'FGF1': { only: 5.0 },
        'FGFR1': { only: 3.0 },
      },
      clusters: ['only'],
    };
    const result = analyzeCommunication(input);
    expect(result.interactions.length).toBeGreaterThan(0);
    expect(result.centrality.only).toBeDefined();
  });

  it('preserves all cluster identifiers in centrality map', () => {
    const result = analyzeCommunication(basicInput);
    for (const cluster of basicInput.clusters) {
      expect(result.centrality[cluster]).toBeDefined();
    }
  });
});

// ─── Edge Cases ─────────────────────────────────────────────────────────────

describe('cell-cell communication edge cases', () => {
  it('handles genes not in L-R database gracefully', () => {
    const input: CommunicationInput = {
      expressionMatrix: {
        'UNKNOWN_GENE': { c1: 5.0, c2: 3.0 },
        'ANOTHER_GENE': { c1: 2.0, c2: 4.0 },
      },
      clusters: ['c1', 'c2'],
    };
    const result = analyzeCommunication(input);
    expect(result.interactions).toEqual([]);
    expect(result.centrality.c1.outgoingStrength).toBe(0);
  });

  it('handles mixed known and unknown genes', () => {
    const input: CommunicationInput = {
      expressionMatrix: {
        'FGF1': { c1: 5.0, c2: 0.1 },
        'FGFR1': { c1: 0.1, c2: 5.0 },
        'UNKNOWN': { c1: 10.0, c2: 10.0 },
      },
      clusters: ['c1', 'c2'],
    };
    const result = analyzeCommunication(input);
    expect(result.interactions.length).toBeGreaterThan(0);
    // UNKNOWN gene should not affect results
    const unknownInter = result.interactions.find(i => i.ligand === 'UNKNOWN' || i.receptor === 'UNKNOWN');
    expect(unknownInter).toBeUndefined();
  });

  it('handles many clusters', () => {
    const clusters = Array.from({ length: 10 }, (_, i) => `cluster${i}`);
    const expressionMatrix: Record<string, Record<string, number>> = {};
    for (const gene of ['FGF1', 'FGFR1', 'WNT3A', 'FZD5']) {
      expressionMatrix[gene] = {};
      for (const c of clusters) {
        expressionMatrix[gene][c] = Math.random() * 10;
      }
    }
    const result = analyzeCommunication({ expressionMatrix, clusters });
    expect(result.interactions.length).toBeGreaterThan(0);
    expect(Object.keys(result.centrality).length).toBe(10);
  });
});
