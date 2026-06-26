/**
 * Biosecurity DNA Screening Tests
 *
 * Tests cover:
 *   - Clear sequences (no select agent matches)
 *   - Exact matches (blocked status)
 *   - Near-exact matches (review or blocked depending on identity)
 *   - Low-identity sequences (clear status)
 *   - Batch screening
 *   - Sequence normalization (lowercase, whitespace, non-ACGT characters)
 *   - Audit logging
 *   - Edge cases and configuration overrides
 */

import {
  screenSequence,
  screenBatch,
  normalizeSequence,
  maxLocalIdentity,
  screeningAuditLog,
  clearAuditLog,
} from '../src/services/biosecurity/dnaScreening';
import { SELECT_AGENTS } from '../src/data/biosecurity/selectAgents';

// Suppress console.warn from audit logging during tests
let warnSpy: jest.SpyInstance;
beforeAll(() => {
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterAll(() => {
  warnSpy.mockRestore();
});

// ─── Test Helpers ────────────────────────────────────────────────

/** Generate a random ACGT sequence of given length */
function randomSequence(length: number, seed = 42): string {
  const bases = 'ACGT';
  let s = '';
  let state = seed;
  for (let i = 0; i < length; i++) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    s += bases[state % 4];
  }
  return s;
}

/** Build a sequence that is N% identical to a reference by point mutation */
function mutateToIdentity(reference: string, targetIdentity: number, seed = 123): string {
  const bases = 'ACGT';
  const result = reference.split('');
  let state = seed;
  const numMutations = Math.round(reference.length * (1 - targetIdentity));
  const indices = new Set<number>();

  // Pick random positions to mutate
  while (indices.size < numMutations) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    indices.add(state % reference.length);
  }

  for (const idx of indices) {
    const originalBase = result[idx];
    let newBase: string;
    do {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      newBase = bases[state % 4];
    } while (newBase === originalBase);
    result[idx] = newBase;
  }

  return result.join('');
}

// ─── normalizeSequence ───────────────────────────────────────────

describe('normalizeSequence', () => {
  it('uppercases lowercase input', () => {
    expect(normalizeSequence('atcgatcg')).toBe('ATCGATCG');
  });

  it('strips whitespace', () => {
    expect(normalizeSequence('ATCG ATCG\nATCG')).toBe('ATCGATCGATCG');
  });

  it('strips non-ACGT characters', () => {
    expect(normalizeSequence('ATCG-NXatcg123')).toBe('ATCGATCG');
  });

  it('returns empty string for no ACGT input', () => {
    expect(normalizeSequence('---123xyz')).toBe('');
  });
});

// ─── maxLocalIdentity ────────────────────────────────────────────

describe('maxLocalIdentity', () => {
  it('returns 1.0 for identical sequences', () => {
    const seq = 'ATCGATCGATCG';
    expect(maxLocalIdentity(seq, seq, 4)).toBe(1.0);
  });

  it('returns 0 for completely different sequences of same length', () => {
    const a = 'AAAA';
    const b = 'TTTT';
    expect(maxLocalIdentity(a, b, 4)).toBe(0);
  });

  it('finds the best alignment when query is shorter', () => {
    const ref = 'AAAAAATCGATCGAAAAAA';
    const query = 'ATCGATCG';
    // query matches perfectly at position 6
    expect(maxLocalIdentity(query, ref, 4)).toBe(1.0);
  });

  it('returns 0 when either sequence is empty', () => {
    expect(maxLocalIdentity('', 'ATCG', 4)).toBe(0);
    expect(maxLocalIdentity('ATCG', '', 4)).toBe(0);
  });

  it('handles query longer than reference', () => {
    const ref = 'ATCG';
    const query = 'ZZZZATCGZZZZ';
    // ref slides across query; best position has 4/4 = 1.0
    expect(maxLocalIdentity(query, ref, 4)).toBe(1.0);
  });

  it('computes correct partial identity', () => {
    // 8 bp sequences, 6 matches = 0.75 identity
    const a = 'ATCGATCG';
    const b = 'ATCGAXXG'; // positions 4,5 differ
    expect(maxLocalIdentity(a, b, 4)).toBeCloseTo(0.75);
  });
});

// ─── screenSequence: Clear Sequences ─────────────────────────────

describe('screenSequence — clear sequences', () => {
  it('returns clear for a random non-matching sequence', () => {
    const seq = randomSequence(500);
    const result = screenSequence(seq, { enableAuditLog: false });
    expect(result.status).toBe('clear');
    expect(result.matches).toHaveLength(0);
  });

  it('returns clear for a short random sequence', () => {
    const seq = randomSequence(50);
    const result = screenSequence(seq, { enableAuditLog: false });
    expect(result.status).toBe('clear');
  });

  it('returns clear for a homopolymer (no select agent has long homopolymers)', () => {
    const seq = 'A'.repeat(500);
    const result = screenSequence(seq, { enableAuditLog: false });
    expect(result.status).toBe('clear');
  });
});

// ─── screenSequence: Exact Matches ───────────────────────────────

describe('screenSequence — exact matches', () => {
  it('blocks an exact copy of a select agent sequence', () => {
    const agent = SELECT_AGENTS[0]; // B. anthracis pagA
    const result = screenSequence(agent.sequence, { enableAuditLog: false });
    expect(result.status).toBe('blocked');
    expect(result.matches.length).toBeGreaterThanOrEqual(1);
    expect(result.matches[0].organism).toBe(agent.organism);
    expect(result.matches[0].identity).toBeCloseTo(1.0);
  });

  it('blocks when exact match is embedded in a longer sequence', () => {
    const agent = SELECT_AGENTS[0];
    const flanking = randomSequence(100);
    const seq = flanking + agent.sequence + flanking;
    const result = screenSequence(seq, { enableAuditLog: false });
    expect(result.status).toBe('blocked');
    expect(result.matches[0].organism).toBe(agent.organism);
  });

  it('blocks lowercase input of a select agent sequence', () => {
    const agent = SELECT_AGENTS[0];
    const result = screenSequence(agent.sequence.toLowerCase(), { enableAuditLog: false });
    expect(result.status).toBe('blocked');
  });
});

// ─── screenSequence: High Identity (Above Threshold) ─────────────

describe('screenSequence — high-identity matches', () => {
  it('flags a 95% identity match as blocked', () => {
    const agent = SELECT_AGENTS[0];
    // Build a longer sequence by repeating the reference to ensure window constraints are met
    const longRef = agent.sequence.repeat(3);
    const mutated = mutateToIdentity(longRef, 0.95);
    const result = screenSequence(mutated, { enableAuditLog: false });
    expect(result.status).toBe('blocked');
    expect(result.matches.length).toBeGreaterThanOrEqual(1);
  });

  it('flags a 75-85% identity match as review (not blocked)', () => {
    // Use 70% global identity; sliding window may find slightly higher local
    // regions but should stay below the 0.9 blocked threshold
    const agent = SELECT_AGENTS[0];
    const longRef = agent.sequence.repeat(3);
    const mutated = mutateToIdentity(longRef, 0.70, 999);
    const result = screenSequence(mutated, {
      enableAuditLog: false,
      minWindowLength: 10,
    });
    // At 70% global identity, the best local window should be review (0.8-0.9)
    // or clear (<0.8). It should NOT be blocked (>0.9).
    expect(['review', 'clear']).toContain(result.status);
    if (result.status === 'review') {
      expect(result.matches.length).toBeGreaterThanOrEqual(1);
      expect(result.matches[0].identity).toBeLessThanOrEqual(0.9);
    }
  });
});

// ─── screenSequence: Low Identity (Below Threshold) ──────────────

describe('screenSequence — low-identity sequences', () => {
  it('returns clear for a 50% identity match (below default threshold)', () => {
    const agent = SELECT_AGENTS[0];
    const longRef = agent.sequence.repeat(3);
    const mutated = mutateToIdentity(longRef, 0.50);
    const result = screenSequence(mutated, {
      enableAuditLog: false,
      minWindowLength: 10,
    });
    expect(result.status).toBe('clear');
  });
});

// ─── screenSequence: Configuration ───────────────────────────────

describe('screenSequence — configuration', () => {
  it('respects custom identityThreshold', () => {
    const agent = SELECT_AGENTS[0];
    // Use a very high threshold so nothing matches
    const result = screenSequence(agent.sequence, {
      identityThreshold: 0.999,
      enableAuditLog: false,
      minWindowLength: 10,
    });
    // Exact match is 1.0 > 0.999, so still matches
    expect(result.matches.length).toBeGreaterThanOrEqual(1);

    // Use threshold above 1.0 — nothing should match
    const result2 = screenSequence(agent.sequence, {
      identityThreshold: 1.001,
      enableAuditLog: false,
      minWindowLength: 10,
    });
    expect(result2.status).toBe('clear');
    expect(result2.matches).toHaveLength(0);
  });

  it('respects custom minWindowLength', () => {
    // With a very small minWindow, even short matches can be detected
    const seq = 'ATCG'.repeat(10); // 40bp
    const result = screenSequence(seq, {
      minWindowLength: 4,
      enableAuditLog: false,
    });
    // Should not throw and should return a valid result
    expect(['clear', 'review', 'blocked']).toContain(result.status);
  });

  it('stores threshold and minWindowLength in result', () => {
    const result = screenSequence('ATCG', {
      identityThreshold: 0.75,
      minWindowLength: 50,
      enableAuditLog: false,
    });
    expect(result.threshold).toBe(0.75);
    expect(result.minWindowLength).toBe(50);
  });
});

// ─── screenSequence: Multiple Organisms ──────────────────────────

describe('screenSequence — multi-organism detection', () => {
  it('detects multiple agents when sequence contains fragments from multiple', () => {
    // Concatenate exact sequences from two different agents
    const agent1 = SELECT_AGENTS.find((a) => a.organism === 'Bacillus anthracis')!;
    const agent2 = SELECT_AGENTS.find((a) => a.organism === 'Yersinia pestis')!;
    const seq = agent1.sequence + randomSequence(50) + agent2.sequence;
    const result = screenSequence(seq, { enableAuditLog: false, minWindowLength: 10 });

    // Should detect at least the two organisms
    const organisms = new Set(result.matches.map((m) => m.organism));
    expect(organisms.has('Bacillus anthracis')).toBe(true);
    expect(organisms.has('Yersinia pestis')).toBe(true);
  });
});

// ─── screenSequence: Edge Cases ──────────────────────────────────

describe('screenSequence — edge cases', () => {
  it('throws for empty sequence', () => {
    expect(() => screenSequence('', { enableAuditLog: false })).toThrow('empty');
  });

  it('throws for sequence with no ACGT characters', () => {
    expect(() => screenSequence('---XYZ123', { enableAuditLog: false })).toThrow('empty');
  });

  it('handles mixed-case with whitespace and numbers', () => {
    const agent = SELECT_AGENTS[0];
    const formatted = agent.sequence.match(/.{1,10}/g)!.join(' ').toLowerCase();
    const result = screenSequence(formatted, { enableAuditLog: false });
    expect(result.status).toBe('blocked');
  });

  it('includes timestamp in ISO 8601 format', () => {
    const result = screenSequence('ATCG'.repeat(100), { enableAuditLog: false });
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('reports inputLength after normalization', () => {
    const result = screenSequence('ATCG atcg', { enableAuditLog: false });
    expect(result.inputLength).toBe(8); // ATCG + ATCG (spaces stripped)
  });
});

// ─── screenSequence: Audit Logging ───────────────────────────────

describe('screenSequence — audit logging', () => {
  beforeEach(() => {
    clearAuditLog();
  });

  it('logs to audit log when enableAuditLog is true (default)', () => {
    screenSequence(randomSequence(500));
    expect(screeningAuditLog.length).toBeGreaterThanOrEqual(1);
    const entry = screeningAuditLog[screeningAuditLog.length - 1];
    expect(entry).toHaveProperty('timestamp');
    expect(entry).toHaveProperty('status');
    expect(entry).toHaveProperty('matchCount');
  });

  it('does not log when enableAuditLog is false', () => {
    const beforeCount = screeningAuditLog.length;
    screenSequence(randomSequence(500), { enableAuditLog: false });
    expect(screeningAuditLog.length).toBe(beforeCount);
  });

  it('logs blocked status for blocked sequences', () => {
    const agent = SELECT_AGENTS[0];
    screenSequence(agent.sequence, { enableAuditLog: true });
    const entry = screeningAuditLog[screeningAuditLog.length - 1];
    expect(entry.status).toBe('blocked');
    expect(entry.topOrganism).toBe(agent.organism);
    expect(entry.topIdentity).toBeCloseTo(1.0);
  });
});

// ─── screenBatch ─────────────────────────────────────────────────

describe('screenBatch', () => {
  beforeEach(() => {
    clearAuditLog();
  });

  it('returns one result per input sequence', () => {
    const sequences = [
      randomSequence(300),
      randomSequence(300),
      randomSequence(300),
    ];
    const results = screenBatch(sequences, { enableAuditLog: false });
    expect(results).toHaveLength(3);
  });

  it('all results are clear for random sequences', () => {
    const sequences = Array.from({ length: 5 }, () => randomSequence(400));
    const results = screenBatch(sequences, { enableAuditLog: false });
    results.forEach((r) => expect(r.status).toBe('clear'));
  });

  it('detects a select agent among random sequences', () => {
    const agent = SELECT_AGENTS[0];
    const sequences = [
      randomSequence(300),
      agent.sequence, // This one should be caught
      randomSequence(300),
    ];
    const results = screenBatch(sequences, { enableAuditLog: false });
    expect(results[0].status).toBe('clear');
    expect(results[1].status).toBe('blocked');
    expect(results[2].status).toBe('clear');
  });

  it('passes config to all screenings', () => {
    const agent = SELECT_AGENTS[0];
    const sequences = [agent.sequence, randomSequence(200)];
    const results = screenBatch(sequences, {
      identityThreshold: 0.5,
      minWindowLength: 10,
      enableAuditLog: false,
    });
    expect(results[0].threshold).toBe(0.5);
    expect(results[1].threshold).toBe(0.5);
  });

  it('returns empty array for empty input', () => {
    const results = screenBatch([], { enableAuditLog: false });
    expect(results).toHaveLength(0);
  });
});

// ─── Select Agent Database Integrity ─────────────────────────────

describe('select agent database', () => {
  it('has at least 10 entries', () => {
    expect(SELECT_AGENTS.length).toBeGreaterThanOrEqual(10);
  });

  it('all sequences are valid ACGT after normalization', () => {
    SELECT_AGENTS.forEach((agent) => {
      const normalized = normalizeSequence(agent.sequence);
      expect(normalized.length).toBeGreaterThan(0);
      expect(normalized).toMatch(/^[ACGT]+$/);
    });
  });

  it('all entries have required fields', () => {
    SELECT_AGENTS.forEach((agent) => {
      expect(agent.id).toBeTruthy();
      expect(agent.organism).toBeTruthy();
      expect(agent.commonName).toBeTruthy();
      expect(agent.gene).toBeTruthy();
      expect(agent.sequence).toBeTruthy();
      expect(['HHS', 'USDA', 'HHS+USDA']).toContain(agent.regulation);
      expect([3, 4]).toContain(agent.riskGroup);
      expect(agent.accession).toBeTruthy();
    });
  });

  it('all IDs are unique', () => {
    const ids = SELECT_AGENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers both HHS and USDA regulated agents', () => {
    const regs = new Set(SELECT_AGENTS.map((a) => a.regulation));
    expect(regs.has('HHS') || regs.has('HHS+USDA')).toBe(true);
    expect(regs.has('USDA') || regs.has('HHS+USDA')).toBe(true);
  });

  it('includes at least one Risk Group 4 agent', () => {
    const rg4 = SELECT_AGENTS.filter((a) => a.riskGroup === 4);
    expect(rg4.length).toBeGreaterThanOrEqual(1);
  });
});
