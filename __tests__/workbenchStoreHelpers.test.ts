/** @jest-environment node */

import {
  STAGE_IDS,
  WORKBENCH_SCHEMA_VERSION,
  RUN_ARTIFACT_LIMIT,
  TOOL_RUN_LIMIT,
  WORKBENCH_ACTOR_KEY,
  DEFAULT_PROJECT_SYNC_SCOPE,
  PROVENANCE_MIDDLEWARE_TOOL_IDS,
  createId,
  stableSerialize,
  normalizeNonEmptyId,
  isPayloadRecord,
  payloadTimestamp,
  createEmptyCheckpoints,
  buildCheckpoints,
  composeEvidenceText,
  buildRecommendationsFromToolIds,
  deriveTargetProduct,
  inferToolSimulation,
  payloadValidity,
} from '../src/store/workbenchStoreHelpers';

// ── Constants ───────────────────────────────────────────────────────────────

describe('constants', () => {
  it('STAGE_IDS has 4 stages', () => {
    expect(STAGE_IDS).toHaveLength(4);
    expect(STAGE_IDS).toEqual(['stage-1', 'stage-2', 'stage-3', 'stage-4']);
  });

  it('WORKBENCH_SCHEMA_VERSION is 1', () => {
    expect(WORKBENCH_SCHEMA_VERSION).toBe(1);
  });

  it('RUN_ARTIFACT_LIMIT is 160', () => {
    expect(RUN_ARTIFACT_LIMIT).toBe(160);
  });

  it('TOOL_RUN_LIMIT is 120', () => {
    expect(TOOL_RUN_LIMIT).toBe(120);
  });

  it('WORKBENCH_ACTOR_KEY is defined', () => {
    expect(typeof WORKBENCH_ACTOR_KEY).toBe('string');
    expect(WORKBENCH_ACTOR_KEY.length).toBeGreaterThan(0);
  });

  it('DEFAULT_PROJECT_SYNC_SCOPE is defined', () => {
    expect(typeof DEFAULT_PROJECT_SYNC_SCOPE).toBe('string');
  });

  it('PROVENANCE_MIDDLEWARE_TOOL_IDS has expected tools', () => {
    expect(PROVENANCE_MIDDLEWARE_TOOL_IDS.has('pathd')).toBe(true);
    expect(PROVENANCE_MIDDLEWARE_TOOL_IDS.has('dyncon')).toBe(true);
    expect(PROVENANCE_MIDDLEWARE_TOOL_IDS.has('dbtlflow')).toBe(true);
    expect(PROVENANCE_MIDDLEWARE_TOOL_IDS.has('catdes')).toBe(true);
    expect(PROVENANCE_MIDDLEWARE_TOOL_IDS.size).toBe(4);
  });
});

// ── createId ────────────────────────────────────────────────────────────────

describe('createId', () => {
  it('returns string with prefix', () => {
    const id = createId('test');
    expect(id).toMatch(/^test-/);
  });

  it('returns unique ids', () => {
    const ids = new Set(Array.from({ length: 100 }, () => createId('x')));
    expect(ids.size).toBe(100);
  });
});

// ── stableSerialize ─────────────────────────────────────────────────────────

describe('stableSerialize', () => {
  it('serializes objects', () => {
    expect(stableSerialize({ a: 1 })).toBe('{"a":1}');
  });

  it('serializes arrays', () => {
    expect(stableSerialize([1, 2, 3])).toBe('[1,2,3]');
  });

  it('serializes primitives', () => {
    expect(stableSerialize(42)).toBe('42');
    expect(stableSerialize('hello')).toBe('"hello"');
    expect(stableSerialize(null)).toBe('null');
    expect(stableSerialize(true)).toBe('true');
  });

  it('returns empty string for circular references', () => {
    const obj: any = {};
    obj.self = obj;
    expect(stableSerialize(obj)).toBe('');
  });

  it('returns empty string for BigInt', () => {
    expect(stableSerialize(BigInt(42))).toBe('');
  });
});

// ── normalizeNonEmptyId ─────────────────────────────────────────────────────

describe('normalizeNonEmptyId', () => {
  it('returns trimmed string for valid id', () => {
    expect(normalizeNonEmptyId('abc')).toBe('abc');
    expect(normalizeNonEmptyId('  abc  ')).toBe('abc');
  });

  it('returns null for empty string', () => {
    expect(normalizeNonEmptyId('')).toBeNull();
    expect(normalizeNonEmptyId('   ')).toBeNull();
  });

  it('returns null for non-string', () => {
    expect(normalizeNonEmptyId(null)).toBeNull();
    expect(normalizeNonEmptyId(undefined)).toBeNull();
    expect(normalizeNonEmptyId(42 as any)).toBeNull();
  });
});

// ── isPayloadRecord ─────────────────────────────────────────────────────────

describe('isPayloadRecord', () => {
  it('returns true for plain objects', () => {
    expect(isPayloadRecord({})).toBe(true);
    expect(isPayloadRecord({ a: 1 })).toBe(true);
  });

  it('returns false for arrays', () => {
    expect(isPayloadRecord([])).toBe(false);
    expect(isPayloadRecord([1, 2])).toBe(false);
  });

  it('returns false for null', () => {
    expect(isPayloadRecord(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isPayloadRecord(undefined)).toBe(false);
  });

  it('returns false for primitives', () => {
    expect(isPayloadRecord(42)).toBe(false);
    expect(isPayloadRecord('hello')).toBe(false);
    expect(isPayloadRecord(true)).toBe(false);
  });
});

// ── payloadTimestamp ─────────────────────────────────────────────────────────

describe('payloadTimestamp', () => {
  it('returns ISO string for valid timestamp', () => {
    const ts = payloadTimestamp({ updatedAt: 1700000000000 });
    expect(ts).toBeDefined();
    expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('returns undefined for non-record', () => {
    expect(payloadTimestamp(null)).toBeUndefined();
    expect(payloadTimestamp(undefined)).toBeUndefined();
    expect(payloadTimestamp(42)).toBeUndefined();
  });

  it('returns undefined for missing updatedAt', () => {
    expect(payloadTimestamp({})).toBeUndefined();
  });

  it('returns undefined for non-number updatedAt', () => {
    expect(payloadTimestamp({ updatedAt: 'abc' })).toBeUndefined();
  });

  it('returns undefined for NaN updatedAt', () => {
    expect(payloadTimestamp({ updatedAt: NaN })).toBeUndefined();
  });

  it('returns undefined for Infinity updatedAt', () => {
    expect(payloadTimestamp({ updatedAt: Infinity })).toBeUndefined();
  });
});

// ── createEmptyCheckpoints ──────────────────────────────────────────────────

describe('createEmptyCheckpoints', () => {
  it('creates 4 checkpoints', () => {
    const cps = createEmptyCheckpoints();
    expect(cps).toHaveLength(4);
  });

  it('all checkpoints are pending', () => {
    const cps = createEmptyCheckpoints();
    for (const cp of cps) {
      expect(cp.status).toBe('pending');
    }
  });

  it('uses provided timestamp', () => {
    const now = 12345;
    const cps = createEmptyCheckpoints(now);
    for (const cp of cps) {
      expect(cp.updatedAt).toBe(now);
    }
  });

  it('has correct stage ids', () => {
    const cps = createEmptyCheckpoints();
    expect(cps.map(c => c.id)).toEqual(STAGE_IDS);
  });
});

// ── buildCheckpoints ────────────────────────────────────────────────────────

describe('buildCheckpoints', () => {
  it('marks stage-1 as complete when analyzeArtifact exists', () => {
    const artifact = { pathwayCandidates: [{ id: 'p1' }] } as any;
    const cps = buildCheckpoints('stage-2', artifact, []);
    const stage1 = cps.find(c => c.id === 'stage-1')!;
    expect(stage1.status).toBe('complete');
  });

  it('marks current stage as active', () => {
    const cps = buildCheckpoints('stage-2', null, []);
    const stage2 = cps.find(c => c.id === 'stage-2')!;
    expect(stage2.status).toBe('active');
  });

  it('marks visited stages as complete', () => {
    const toolRuns = [
      { stageId: 'stage-1', toolId: 'pathd' },
      { stageId: 'stage-1', toolId: 'fbasim' },
    ] as any;
    const cps = buildCheckpoints('stage-3', null, toolRuns);
    const stage1 = cps.find(c => c.id === 'stage-1')!;
    expect(stage1.status).toBe('complete');
  });

  it('marks unvisited non-current stages as pending', () => {
    const cps = buildCheckpoints('stage-1', null, []);
    const stage3 = cps.find(c => c.id === 'stage-3')!;
    expect(stage3.status).toBe('pending');
  });

  it('includes pathway candidate count in stage-1 summary', () => {
    const artifact = { pathwayCandidates: [{ id: 'p1' }, { id: 'p2' }] } as any;
    const cps = buildCheckpoints('stage-1', artifact, []);
    const stage1 = cps.find(c => c.id === 'stage-1')!;
    expect(stage1.summary).toContain('2');
  });

  it('defaults to 1 pathway candidate when array is empty', () => {
    const artifact = { pathwayCandidates: [] } as any;
    const cps = buildCheckpoints('stage-1', artifact, []);
    const stage1 = cps.find(c => c.id === 'stage-1')!;
    expect(stage1.summary).toContain('1');
  });
});

// ── composeEvidenceText ─────────────────────────────────────────────────────

describe('composeEvidenceText', () => {
  it('composes text from evidence items', () => {
    const items = [{
      title: 'Test Paper',
      authors: ['Author A', 'Author B'],
      source: 'Journal',
      year: 2024,
      doi: '10.1234/test',
      abstract: 'Test abstract',
      journal: undefined,
    }] as any;
    const text = composeEvidenceText(items);
    expect(text).toContain('Test Paper');
    expect(text).toContain('Author A');
    expect(text).toContain('Author B');
    expect(text).toContain('Journal');
    expect(text).toContain('2024');
    expect(text).toContain('10.1234/test');
    expect(text).toContain('Test abstract');
  });

  it('handles empty items', () => {
    expect(composeEvidenceText([])).toBe('');
  });

  it('handles items with missing fields', () => {
    const items = [{
      title: 'Minimal Paper',
      authors: [],
      year: null,
      doi: null,
      abstract: null,
      source: null,
      journal: null,
    }] as any;
    const text = composeEvidenceText(items);
    expect(text).toContain('Minimal Paper');
  });

  it('uses journal as fallback for source', () => {
    const items = [{
      title: 'Paper',
      authors: [],
      source: null,
      journal: 'Nature',
      year: 2024,
      doi: null,
      abstract: null,
    }] as any;
    const text = composeEvidenceText(items);
    expect(text).toContain('Nature');
  });

  it('separates multiple items with divider', () => {
    const items = [
      { title: 'Paper 1', authors: [], source: null, journal: null, year: null, doi: null, abstract: null },
      { title: 'Paper 2', authors: [], source: null, journal: null, year: null, doi: null, abstract: null },
    ] as any;
    const text = composeEvidenceText(items);
    expect(text).toContain('---');
    expect(text).toContain('Paper 1');
    expect(text).toContain('Paper 2');
  });
});

// ── buildRecommendationsFromToolIds ─────────────────────────────────────────

describe('buildRecommendationsFromToolIds', () => {
  it('builds recommendations from tool ids', () => {
    const recs = buildRecommendationsFromToolIds(['pathd', 'fbasim'], 'analysis', 'test reason');
    expect(recs).toHaveLength(2);
    expect(recs[0].toolId).toBe('pathd');
    expect(recs[0].source).toBe('analysis');
    expect(recs[0].reason).toBe('test reason');
    expect(recs[1].toolId).toBe('fbasim');
  });

  it('returns empty for empty input', () => {
    expect(buildRecommendationsFromToolIds([], 'analysis', 'reason')).toEqual([]);
  });

  it('generates unique ids per tool', () => {
    const recs = buildRecommendationsFromToolIds(['a', 'b', 'c'], 'flow', 'r');
    const ids = new Set(recs.map(r => r.id));
    expect(ids.size).toBe(3);
  });
});

// ── deriveTargetProduct ─────────────────────────────────────────────────────

describe('deriveTargetProduct', () => {
  it('returns last non-enzyme node label', () => {
    const nodes = [
      { nodeType: 'enzyme', label: 'Enzyme1' },
      { nodeType: 'metabolite', label: 'Product' },
    ] as any;
    expect(deriveTargetProduct(nodes)).toBe('Product');
  });

  it('returns last node label when all are enzymes', () => {
    const nodes = [
      { nodeType: 'enzyme', label: 'Enzyme1' },
      { nodeType: 'enzyme', label: 'Enzyme2' },
    ] as any;
    expect(deriveTargetProduct(nodes)).toBe('Enzyme2');
  });

  it('returns "Target Product" for empty array', () => {
    expect(deriveTargetProduct([])).toBe('Target Product');
  });

  it('skips gene nodes', () => {
    const nodes = [
      { nodeType: 'gene', label: 'Gene1' },
      { nodeType: 'metabolite', label: 'Metabolite1' },
    ] as any;
    expect(deriveTargetProduct(nodes)).toBe('Metabolite1');
  });
});

// ── inferToolSimulation ─────────────────────────────────────────────────────

describe('inferToolSimulation', () => {
  it('returns true for null/undefined payload', () => {
    expect(inferToolSimulation(null as any)).toBe(true);
    expect(inferToolSimulation(undefined as any)).toBe(true);
  });

  it('returns true for demo validity', () => {
    expect(inferToolSimulation({ validity: 'demo' } as any)).toBe(true);
  });

  it('returns false for real validity', () => {
    expect(inferToolSimulation({ validity: 'real' } as any)).toBe(false);
  });

  it('returns true for mock mode in result', () => {
    expect(inferToolSimulation({ result: { mode: 'mock' } } as any)).toBe(true);
  });

  it('returns true for idle mode in result', () => {
    expect(inferToolSimulation({ result: { mode: 'idle' } } as any)).toBe(true);
  });

  it('returns false for non-mock mode in result', () => {
    expect(inferToolSimulation({ result: { mode: 'real' } } as any)).toBe(false);
  });

  it('returns false for result without mode', () => {
    expect(inferToolSimulation({ result: { data: 'test' } } as any)).toBe(false);
  });

  it('returns false for result that is not an object', () => {
    expect(inferToolSimulation({ result: 'string' } as any)).toBe(false);
  });

  it('returns false for payload without validity or result', () => {
    expect(inferToolSimulation({ someOtherField: 'test' } as any)).toBe(false);
  });
});

// ── payloadValidity ─────────────────────────────────────────────────────────

describe('payloadValidity', () => {
  it('returns null for null payload', () => {
    expect(payloadValidity(null as any)).toBeNull();
  });

  it('returns null for undefined payload', () => {
    expect(payloadValidity(undefined as any)).toBeNull();
  });

  it('returns null for non-object payload', () => {
    expect(payloadValidity(42 as any)).toBeNull();
    expect(payloadValidity('string' as any)).toBeNull();
  });

  it('returns null for payload without validity', () => {
    expect(payloadValidity({} as any)).toBeNull();
  });

  it('returns "real" for real validity', () => {
    expect(payloadValidity({ validity: 'real' } as any)).toBe('real');
  });

  it('returns "partial" for partial validity', () => {
    expect(payloadValidity({ validity: 'partial' } as any)).toBe('partial');
  });

  it('returns "demo" for demo validity', () => {
    expect(payloadValidity({ validity: 'demo' } as any)).toBe('demo');
  });

  it('returns null for invalid validity value', () => {
    expect(payloadValidity({ validity: 'invalid' } as any)).toBeNull();
  });

  it('returns null for numeric validity', () => {
    expect(payloadValidity({ validity: 0 } as any)).toBeNull();
  });
});
