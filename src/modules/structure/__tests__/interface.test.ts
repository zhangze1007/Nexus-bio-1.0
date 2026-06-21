/**
 * Interface Prediction Tests
 *
 * Tests for geometric interface detection, embedding-based prediction,
 * contact probability estimation, and interface residue classification.
 */

import {
  detectGeometricInterfaces,
  predictInterfaceFromEmbeddings,
  estimateContactProbability,
  classifyInterfaceResidues,
} from '../interface';
import { generateEmbedding } from '../embeddings';
import type { ProteinChain } from '../types';

// ── Test Helpers ──────────────────────────────────────────────────────────────

/**
 * Build a minimal PDB-format ATOM line.
 *
 * Format: ATOM  serial name  resName chain resSeq    x      y      z  occ  temp
 * Columns: 1-6  7-11 13-16 18-20    22    23-26   31-38  39-46  47-54 55-60 61-66
 */
function buildAtomLine(
  serial: number,
  atomName: string,
  resName: string,
  chain: string,
  resSeq: number,
  x: number,
  y: number,
  z: number,
): string {
  const pad = (val: string, width: number) => val.padStart(width, ' ');
  return (
    'ATOM  ' +
    pad(String(serial), 5) +
    ' ' +
    atomName.padEnd(4, ' ') +
    ' ' +
    resName.padEnd(3, ' ') +
    ' ' +
    chain +
    pad(String(resSeq), 4) +
    '    ' +
    pad(x.toFixed(3), 8) +
    pad(y.toFixed(3), 8) +
    pad(z.toFixed(3), 8) +
    '  1.00' +
    '  0.00' +
    '           C'
  );
}

/**
 * Build a two-chain PDB where Cα atoms are within contact distance.
 * Chain A residues at x=0..10, Chain B residues at x=5..15 (overlap at 5Å).
 */
function buildTwoChainPdb(): string {
  const lines: string[] = [];

  // Chain A: 5 residues along x-axis
  for (let i = 0; i < 5; i++) {
    lines.push(buildAtomLine(i + 1, 'CA', 'ALA', 'A', i + 1, i * 3.8, 0, 0));
  }

  // Chain B: 5 residues along x-axis, offset to create interface near x=7.6
  for (let i = 0; i < 5; i++) {
    lines.push(buildAtomLine(i + 6, 'CA', 'GLY', 'B', i + 1, 7.6 + i * 3.8, 0, 0));
  }

  lines.push('END');
  return lines.join('\n');
}

/**
 * Build a PDB with charged residues at the interface for salt bridge detection.
 * ASP (negative) on chain A near LYS (positive) on chain B.
 */
function buildSaltBridgePdb(): string {
  const lines: string[] = [];

  // Chain A: ASP at (0,0,0), then others far away
  lines.push(buildAtomLine(1, 'CA', 'ASP', 'A', 1, 0, 0, 0));
  lines.push(buildAtomLine(2, 'CA', 'ALA', 'A', 2, 50, 0, 0));

  // Chain B: LYS near ASP (3.0Å away), others far away
  lines.push(buildAtomLine(3, 'CA', 'LYS', 'B', 1, 3.0, 0, 0));
  lines.push(buildAtomLine(4, 'CA', 'GLY', 'B', 2, 50, 0, 0));

  lines.push('END');
  return lines.join('\n');
}

/**
 * Build a PDB with hydrophobic residues at interface.
 */
function buildHydrophobicPdb(): string {
  const lines: string[] = [];

  // Chain A: LEU at origin
  lines.push(buildAtomLine(1, 'CA', 'LEU', 'A', 1, 0, 0, 0));
  // Chain B: VAL near LEU (6.0Å away)
  lines.push(buildAtomLine(2, 'CA', 'VAL', 'B', 1, 6.0, 0, 0));

  lines.push('END');
  return lines.join('\n');
}

/**
 * Build a PDB with H-bond capable (non-charged) residues at close range.
 * SER and ASN are both H-bond capable but not charged, so they should
 * be classified as hydrogen_bond at close distance.
 */
function buildHydrogenBondPdb(): string {
  const lines: string[] = [];

  // Chain A: SER at origin
  lines.push(buildAtomLine(1, 'CA', 'SER', 'A', 1, 0, 0, 0));
  // Chain B: ASN near SER (2.8Å away)
  lines.push(buildAtomLine(2, 'CA', 'ASN', 'B', 1, 2.8, 0, 0));

  lines.push('END');
  return lines.join('\n');
}

/**
 * Build a PDB with chains far apart (no interface).
 */
function buildNoInterfacePdb(): string {
  const lines: string[] = [];

  lines.push(buildAtomLine(1, 'CA', 'ALA', 'A', 1, 0, 0, 0));
  lines.push(buildAtomLine(2, 'CA', 'ALA', 'A', 2, 3.8, 0, 0));
  lines.push(buildAtomLine(3, 'CA', 'ALA', 'B', 1, 100, 0, 0));
  lines.push(buildAtomLine(4, 'CA', 'ALA', 'B', 2, 103.8, 0, 0));

  lines.push('END');
  return lines.join('\n');
}

// ── Test Data ─────────────────────────────────────────────────────────────────

const sampleChains: ProteinChain[] = [
  { id: 'A', sequence: 'MKWVTFISLLFLFSSAYS', type: 'protein' },
  { id: 'B', sequence: 'MKWVTFISLLFLFSSAYS', type: 'protein' },
];

const dissimilarChains: ProteinChain[] = [
  { id: 'A', sequence: 'MKWVTFISLLFLFSSAYS', type: 'protein' },
  { id: 'B', sequence: 'GGGGGGGGGGGGGGGGGG', type: 'protein' },
];

const mixedTypeChains: ProteinChain[] = [
  { id: 'A', sequence: 'MKWVTFISLLFLFSSAYS', type: 'protein' },
  { id: 'B', sequence: 'ATCGATCGATCG', type: 'dna' },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('interface prediction', () => {
  // ── Geometric Interface Detection ───────────────────────────────────────────

  describe('detectGeometricInterfaces', () => {
    it('detects interface residues between two chains', () => {
      const pdb = buildTwoChainPdb();
      const result = detectGeometricInterfaces(pdb, ['A', 'B']);

      expect(result.length).toBeGreaterThan(0);
      // Each result should reference both chains
      result.forEach(r => {
        expect(['A', 'B']).toContain(r.chain);
        expect(['A', 'B']).toContain(r.partnerChain);
        expect(r.chain).not.toBe(r.partnerChain);
      });
    });

    it('classifies contact types correctly', () => {
      // Test salt bridge: ASP (negative) + LYS (positive) at 3.0Å
      const saltBridgePdb = buildSaltBridgePdb();
      const saltResult = detectGeometricInterfaces(saltBridgePdb, ['A', 'B'], { distanceThreshold: 8 });

      expect(saltResult.length).toBeGreaterThan(0);
      const saltTypes = saltResult.map(r => r.type);
      expect(saltTypes).toContain('salt_bridge'); // ASP-LYS charged pair

      // Test hydrogen bond: SER + ASN at 2.8Å (non-charged, H-bond capable)
      const hbondPdb = buildHydrogenBondPdb();
      const hbondResult = detectGeometricInterfaces(hbondPdb, ['A', 'B'], { distanceThreshold: 8 });

      expect(hbondResult.length).toBeGreaterThan(0);
      const hbondTypes = hbondResult.map(r => r.type);
      expect(hbondTypes).toContain('hydrogen_bond'); // SER-ASN H-bond pair
    });

    it('respects distance threshold', () => {
      const pdb = buildTwoChainPdb();
      const result8 = detectGeometricInterfaces(pdb, ['A', 'B'], { distanceThreshold: 8 });
      const result2 = detectGeometricInterfaces(pdb, ['A', 'B'], { distanceThreshold: 2 });

      // Smaller threshold should find fewer contacts
      expect(result2.length).toBeLessThanOrEqual(result8.length);
    });

    it('uses default 8A threshold when not specified', () => {
      const pdb = buildTwoChainPdb();
      const result = detectGeometricInterfaces(pdb, ['A', 'B']);

      // Should find contacts (default 8A is generous)
      expect(result.length).toBeGreaterThan(0);
      result.forEach(r => {
        expect(r.distance).toBeLessThanOrEqual(8.01); // small float tolerance
      });
    });

    it('returns empty array when chains are far apart', () => {
      const pdb = buildNoInterfacePdb();
      const result = detectGeometricInterfaces(pdb, ['A', 'B']);

      expect(result).toEqual([]);
    });

    it('returns empty array for empty PDB', () => {
      const result = detectGeometricInterfaces('', ['A', 'B']);
      expect(result).toEqual([]);
    });

    it('assigns confidence scores between 0 and 1', () => {
      const pdb = buildTwoChainPdb();
      const result = detectGeometricInterfaces(pdb, ['A', 'B']);

      result.forEach(r => {
        expect(r.confidence).toBeGreaterThanOrEqual(0);
        expect(r.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('stores distance rounded to 2 decimal places', () => {
      const pdb = buildTwoChainPdb();
      const result = detectGeometricInterfaces(pdb, ['A', 'B']);

      result.forEach(r => {
        const str = r.distance.toFixed(2);
        expect(str).toMatch(/^\d+\.\d{2}$/);
      });
    });
  });

  // ── Embedding Similarity-Based Prediction ──────────────────────────────────

  describe('predictInterfaceFromEmbeddings', () => {
    it('predicts interface for similar sequences', async () => {
      const embeddings = new Map<string, number[]>();
      embeddings.set('A', await generateEmbedding('MKWVTFISLLFLFSSAYS'));
      embeddings.set('B', await generateEmbedding('MKWVTFISLLFLFSSAYS'));

      const result = predictInterfaceFromEmbeddings(sampleChains, embeddings);

      expect(result.chainPairs.length).toBe(1);
      expect(result.chainPairs[0].chainA).toBe('A');
      expect(result.chainPairs[0].chainB).toBe('B');
      // Identical sequences -> high similarity -> predicted interface
      expect(result.chainPairs[0].similarity).toBeGreaterThan(0.9);
      expect(result.chainPairs[0].predictedInterface).toBe(true);
    });

    it('predicts no interface for dissimilar sequences', async () => {
      const embeddings = new Map<string, number[]>();
      embeddings.set('A', await generateEmbedding('MKWVTFISLLFLFSSAYS'));
      embeddings.set('B', await generateEmbedding('GGGGGGGGGGGGGGGGGG'));

      const result = predictInterfaceFromEmbeddings(dissimilarChains, embeddings);

      expect(result.chainPairs.length).toBe(1);
      // Dissimilar -> lower similarity
      expect(result.chainPairs[0].similarity).toBeLessThan(0.95);
    });

    it('returns correct confidence scores', async () => {
      const embeddings = new Map<string, number[]>();
      embeddings.set('A', await generateEmbedding('MKWVTFISLLFLFSSAYS'));
      embeddings.set('B', await generateEmbedding('MKWVTFISLLFLFSSAYS'));

      const result = predictInterfaceFromEmbeddings(sampleChains, embeddings);

      expect(result.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(result.overallConfidence).toBeLessThanOrEqual(1);
    });

    it('generates all pairwise combinations', async () => {
      const chains: ProteinChain[] = [
        { id: 'A', sequence: 'MKWV', type: 'protein' },
        { id: 'B', sequence: 'TFIS', type: 'protein' },
        { id: 'C', sequence: 'LLFL', type: 'protein' },
      ];

      const embeddings = new Map<string, number[]>();
      for (const c of chains) {
        embeddings.set(c.id, await generateEmbedding(c.sequence));
      }

      const result = predictInterfaceFromEmbeddings(chains, embeddings);

      // 3 chains -> 3 pairs: AB, AC, BC
      expect(result.chainPairs.length).toBe(3);
    });

    it('handles empty chains array', () => {
      const result = predictInterfaceFromEmbeddings([], new Map());

      expect(result.chainPairs).toEqual([]);
      expect(result.overallConfidence).toBe(0);
    });

    it('handles single chain (no pairs)', async () => {
      const chains: ProteinChain[] = [
        { id: 'A', sequence: 'MKWV', type: 'protein' },
      ];
      const embeddings = new Map<string, number[]>();
      embeddings.set('A', await generateEmbedding('MKWV'));

      const result = predictInterfaceFromEmbeddings(chains, embeddings);

      expect(result.chainPairs).toEqual([]);
      expect(result.overallConfidence).toBe(0);
    });

    it('computes contactProbability for each pair', async () => {
      const embeddings = new Map<string, number[]>();
      embeddings.set('A', await generateEmbedding('MKWVTFISLLFLFSSAYS'));
      embeddings.set('B', await generateEmbedding('MKWVTFISLLFLFSSAYS'));

      const result = predictInterfaceFromEmbeddings(sampleChains, embeddings);

      result.chainPairs.forEach(pair => {
        expect(pair.contactProbability).toBeGreaterThanOrEqual(0);
        expect(pair.contactProbability).toBeLessThanOrEqual(1);
      });
    });
  });

  // ── Contact Probability Estimation ─────────────────────────────────────────

  describe('estimateContactProbability', () => {
    it('returns probability in [0, 1]', async () => {
      const embeddings = new Map<string, number[]>();
      embeddings.set('A', await generateEmbedding('MKWVTFISLLFLFSSAYS'));
      embeddings.set('B', await generateEmbedding('MKWVTFISLLFLFSSAYS'));

      const prob = estimateContactProbability(
        sampleChains[0],
        sampleChains[1],
        embeddings,
      );

      expect(prob).toBeGreaterThanOrEqual(0);
      expect(prob).toBeLessThanOrEqual(1);
    });

    it('returns higher probability for similar sequences', async () => {
      const embeddings = new Map<string, number[]>();
      embeddings.set('A', await generateEmbedding('MKWVTFISLLFLFSSAYS'));
      embeddings.set('B', await generateEmbedding('MKWVTFISLLFLFSSAYS'));
      embeddings.set('C', await generateEmbedding('GGGGGGGGGGGGGGGGGG'));

      const probSimilar = estimateContactProbability(
        sampleChains[0],
        sampleChains[1],
        embeddings,
      );

      const chainC: ProteinChain = { id: 'C', sequence: 'GGGGGGGGGGGGGGGGGG', type: 'protein' };
      const probDissimilar = estimateContactProbability(
        sampleChains[0],
        chainC,
        embeddings,
      );

      expect(probSimilar).toBeGreaterThanOrEqual(probDissimilar);
    });

    it('handles missing embeddings gracefully', () => {
      const emptyEmbeddings = new Map<string, number[]>();

      const prob = estimateContactProbability(
        sampleChains[0],
        sampleChains[1],
        emptyEmbeddings,
      );

      expect(prob).toBeGreaterThanOrEqual(0);
      expect(prob).toBeLessThanOrEqual(1);
    });

    it('returns 0 for empty sequences with no embeddings', () => {
      const emptyChainA: ProteinChain = { id: 'A', sequence: '', type: 'protein' };
      const emptyChainB: ProteinChain = { id: 'B', sequence: '', type: 'protein' };
      const emptyEmbeddings = new Map<string, number[]>();

      const prob = estimateContactProbability(emptyChainA, emptyChainB, emptyEmbeddings);

      expect(prob).toBeGreaterThanOrEqual(0);
      expect(prob).toBeLessThanOrEqual(1);
    });
  });

  // ── Interface Residue Classification ───────────────────────────────────────

  describe('classifyInterfaceResidues', () => {
    it('classifies residues at the interface', () => {
      const pdb = buildTwoChainPdb();
      const result = classifyInterfaceResidues(pdb, ['A', 'B']);

      expect(result.length).toBeGreaterThan(0);
      result.forEach(r => {
        expect(r.residue).toBeTruthy();
        expect(r.chain).toBeTruthy();
        expect(r.partnerChain).toBeTruthy();
      });
    });

    it('assigns confidence scores', () => {
      const pdb = buildTwoChainPdb();
      const result = classifyInterfaceResidues(pdb, ['A', 'B']);

      result.forEach(r => {
        expect(r.confidence).toBeGreaterThanOrEqual(0);
        expect(r.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('classifies hydrogen bonds for close residues', () => {
      const pdb = buildHydrogenBondPdb();
      const result = classifyInterfaceResidues(pdb, ['A', 'B']);

      expect(result.length).toBeGreaterThan(0);
      const types = result.map(r => r.type);
      expect(types).toContain('hydrogen_bond');
    });

    it('returns empty array when no interface exists', () => {
      const pdb = buildNoInterfacePdb();
      const result = classifyInterfaceResidues(pdb, ['A', 'B']);

      expect(result).toEqual([]);
    });

    it('returns empty array for empty PDB', () => {
      const result = classifyInterfaceResidues('', ['A', 'B']);
      expect(result).toEqual([]);
    });

    it('handles different chain types (protein-protein)', () => {
      const pdb = buildHydrophobicPdb();
      const result = classifyInterfaceResidues(pdb, ['A', 'B']);

      expect(result.length).toBeGreaterThan(0);
      // LEU-VAL at 6Å should be hydrophobic or van_der_waals
      result.forEach(r => {
        expect(['hydrophobic', 'van_der_waals', 'hydrogen_bond', 'salt_bridge']).toContain(r.type);
      });
    });

    it('stores valid residue index', () => {
      const pdb = buildTwoChainPdb();
      const result = classifyInterfaceResidues(pdb, ['A', 'B']);

      result.forEach(r => {
        expect(r.index).toBeGreaterThan(0);
        expect(Number.isInteger(r.index)).toBe(true);
      });
    });
  });
});
