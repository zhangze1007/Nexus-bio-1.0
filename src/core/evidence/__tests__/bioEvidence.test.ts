/**
 * BioEvidence + withEvidence Tests
 */

import { literatureEvidence, databaseEvidence, predictionEvidence, simulationEvidence } from '../bioEvidence';
import { withEvidence, isTrustedResult, getEvidenceStatusLabel } from '../withEvidence';

describe('bioEvidence', () => {
  it('creates literature evidence with correct sourceType', () => {
    const ev = literatureEvidence('Test paper', '10.1000/test', 'E. coli');
    expect(ev.sourceType).toBe('literature');
    expect(ev.doi).toBe('10.1000/test');
    expect(ev.organism).toBe('E. coli');
    expect(ev.isValidated).toBe(true);
    expect(ev.confidence).toBe('high');
  });

  it('creates database evidence', () => {
    const ev = databaseEvidence('BRENDA', 'Hexokinase kinetics', 'https://brenda-enzymes.org');
    expect(ev.sourceType).toBe('database');
    expect(ev.source).toBe('BRENDA');
    expect(ev.isValidated).toBe(true);
  });

  it('creates prediction evidence', () => {
    const ev = predictionEvidence('ESM-2', 'Protein fold prediction', 'medium');
    expect(ev.sourceType).toBe('predicted');
    expect(ev.isValidated).toBe(false);
    expect(ev.notes).toContain('experimental validation');
  });

  it('creates simulation evidence', () => {
    const ev = simulationEvidence('FBA', 'Flux balance analysis');
    expect(ev.sourceType).toBe('simulated');
    expect(ev.isValidated).toBe(false);
  });
});

describe('withEvidence', () => {
  it('wraps result with evidence metadata', () => {
    const ev = literatureEvidence('Test', '10.1000/test');
    const wrapped = withEvidence({ value: 42 }, [ev]);
    expect(wrapped.result.value).toBe(42);
    expect(wrapped.evidence.length).toBe(1);
    expect(wrapped.confidence).toBe('high');
    expect(wrapped.status).toBe('production');
    expect(wrapped.isProductionReady).toBe(true);
  });

  it('marks predicted results as research/demo', () => {
    const ev = predictionEvidence('ESM-2', 'prediction');
    const wrapped = withEvidence({ value: 42 }, [ev]);
    expect(wrapped.containsSimulated).toBe(true);
    expect(wrapped.isProductionReady).toBe(false);
    expect(['research', 'demo']).toContain(wrapped.status);
  });

  it('marks results without evidence as unverified', () => {
    const wrapped = withEvidence({ value: 42 }, []);
    expect(wrapped.confidence).toBe('uncertain');
    expect(wrapped.evidence.length).toBe(0);
    expect(wrapped.evidenceSummary).toContain('No evidence');
  });

  it('isTrustedResult returns false for unverified results', () => {
    const wrapped = withEvidence({ value: 42 }, []);
    expect(isTrustedResult(wrapped)).toBe(false);
  });

  it('isTrustedResult returns true for production-ready results', () => {
    const ev = literatureEvidence('Test', '10.1000/test');
    const wrapped = withEvidence({ value: 42 }, [ev]);
    // Literature evidence is production-ready
    expect(wrapped.isProductionReady).toBe(true);
    expect(isTrustedResult(wrapped)).toBe(true);
  });

  it('getEvidenceStatusLabel returns correct labels', () => {
    const ev = literatureEvidence('Test', '10.1000/test');
    const label = getEvidenceStatusLabel(withEvidence({}, [ev]));
    expect(label.length).toBeGreaterThan(0);

    const pred = predictionEvidence('ESM-2', 'pred');
    expect(getEvidenceStatusLabel(withEvidence({}, [pred]))).toContain('Predicted');

    expect(getEvidenceStatusLabel(withEvidence({}, []))).toContain('No Evidence');
  });
});
