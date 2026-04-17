/** @jest-environment node */
/**
 * axonEvidenceAdapter — workbench-backed adapter + stub adapters + registry.
 */
import {
  buildDefaultEvidenceRegistry,
  createStubEvidenceAdapter,
  createWorkbenchEvidenceAdapter,
} from '../src/services/axonEvidenceAdapter';
import type { WorkbenchEvidenceItem } from '../src/store/workbenchTypes';

function sampleEvidence(): WorkbenchEvidenceItem[] {
  return Array.from({ length: 8 }).map((_, i) => ({
    id: `ev-${i}`,
    sourceKind: 'literature' as const,
    title: 'x'.repeat(200) + ` #${i}`,
    abstract: 'y'.repeat(500) + ` abstract ${i}`,
    authors: ['Author A'],
    journal: 'J',
    year: '2024',
    doi: `10.0/${i}`,
    savedAt: 1,
  }));
}

describe('workbench evidence adapter', () => {
  it('returns items, caps at default limit, truncates title + excerpt', () => {
    const adapter = createWorkbenchEvidenceAdapter(() => ({
      evidenceItems: sampleEvidence(),
      analyzeArtifact: null,
      nextRecommendations: [],
    }));
    const res = adapter.query({ targetProduct: 'muconate' });
    expect(res.status).toBe('available');
    expect(res.items.length).toBe(5);
    expect(res.items[0].title.length).toBeLessThanOrEqual(120);
    expect(res.items[0].excerpt?.length).toBeLessThanOrEqual(220);
    expect(res.provenance.queryTarget).toBe('muconate');
  });

  it('respects caller limit up to MAX_LIMIT', () => {
    const adapter = createWorkbenchEvidenceAdapter(() => ({
      evidenceItems: sampleEvidence(),
      analyzeArtifact: null,
      nextRecommendations: [],
    }));
    const res = adapter.query({ targetProduct: null, limit: 50 });
    // Hard ceiling is 12, but we only have 8 items.
    expect(res.items.length).toBe(8);
  });

  it('returns emptyReason when no evidence saved', () => {
    const adapter = createWorkbenchEvidenceAdapter(() => ({
      evidenceItems: [],
      analyzeArtifact: null,
      nextRecommendations: [],
    }));
    const res = adapter.query({ targetProduct: null });
    expect(res.items).toEqual([]);
    expect(res.provenance.emptyReason).toMatch(/No workbench evidence/i);
  });
});

describe('stub evidence adapter', () => {
  it('returns not-implemented with warning and emptyReason', () => {
    const adapter = createStubEvidenceAdapter('pubmed', 'PubMed');
    const res = adapter.query({ targetProduct: 'X' });
    expect(res.status).toBe('not-implemented');
    expect(res.items).toEqual([]);
    expect(res.warning).toMatch(/extension seam/i);
    expect(res.provenance.emptyReason).toMatch(/not wired/i);
  });
});

describe('default registry', () => {
  it('exposes the workbench adapter as available and stubs as not-implemented', () => {
    const registry = buildDefaultEvidenceRegistry(() => ({
      evidenceItems: [],
      analyzeArtifact: null,
      nextRecommendations: [],
    }));
    expect(registry.isAvailable('workbench')).toBe(true);
    expect(registry.isAvailable('pubmed')).toBe(false);
    expect(registry.isAvailable('biorxiv')).toBe(false);
    expect(registry.isAvailable('semantic-scholar')).toBe(false);
    expect(registry.list().length).toBe(4);
  });
});
