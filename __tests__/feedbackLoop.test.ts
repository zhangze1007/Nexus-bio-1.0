import { parseCSVData, runMOO } from '../src/utils/feedback-loop';
import type { DBTLIteration, TestDataRow } from '../src/types';

function makeIteration(overrides: Partial<DBTLIteration> = {}): DBTLIteration {
  return {
    id: 1,
    phase: 'Test',
    hypothesis: 'Raise mevalonate precursor supplementation',
    result: 100,
    unit: 'mg/L',
    passed: true,
    ...overrides,
  };
}

function makeRow(overrides: Partial<TestDataRow> = {}): TestDataRow {
  return {
    sample_id: 'S1',
    strain: 'yWT',
    condition: 'default',
    yield_mg_L: 80,
    biomass_OD600: 0.8,
    substrate_consumed_mM: 20,
    ...overrides,
  };
}

describe('parseCSVData', () => {
  it('parses a canonical header row with yield_mg_L and biomass_OD600', () => {
    const csv = [
      'sample_id,strain,yield_mg_L,biomass_OD600,substrate_consumed_mM',
      'S1,yWT,80.0,0.85,20',
      'S2,yM1,92.5,0.91,22',
    ].join('\n');
    const rows = parseCSVData(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ sample_id: 'S1', yield_mg_L: 80, biomass_OD600: 0.85 });
    expect(rows[1]).toMatchObject({ sample_id: 'S2', yield_mg_L: 92.5 });
  });

  it('strips a UTF-8 BOM and handles CRLF line endings', () => {
    const csv = '\uFEFFsample_id,yield_mg_L\r\nS1,42\r\nS2,58\r\n';
    const rows = parseCSVData(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].yield_mg_L).toBe(42);
    expect(rows[1].yield_mg_L).toBe(58);
  });

  it('accepts alias column names (yield, OD600, glucose_mm)', () => {
    const csv = [
      'sample_id,yield,OD600,glucose_mm',
      'S1,55,1.2,18',
    ].join('\n');
    const rows = parseCSVData(csv);
    expect(rows[0].yield_mg_L).toBe(55);
    expect(rows[0].biomass_OD600).toBe(1.2);
    expect(rows[0].substrate_consumed_mM).toBe(18);
  });

  it('skips rows where the required yield cell is missing or NaN', () => {
    const csv = [
      'sample_id,yield_mg_L',
      'S1,',
      'S2,NA',
      'S3,not_a_number',
      'S4,70',
    ].join('\n');
    const rows = parseCSVData(csv);
    expect(rows.map((r) => r.sample_id)).toEqual(['S4']);
  });

  it('throws when the yield column is missing entirely', () => {
    const csv = 'sample_id,strain\nS1,yWT';
    expect(() => parseCSVData(csv)).toThrow(/missing a yield column/);
  });

  it('handles quoted cells containing commas', () => {
    const csv = [
      'sample_id,strain,yield_mg_L,condition',
      '"S,1","yWT",42,"30 C, shaking"',
    ].join('\n');
    const rows = parseCSVData(csv);
    expect(rows[0].sample_id).toBe('S,1');
    expect(rows[0].condition).toBe('30 C, shaking');
    expect(rows[0].yield_mg_L).toBe(42);
  });

  it('returns [] for empty input', () => {
    expect(parseCSVData('')).toEqual([]);
    expect(parseCSVData('\n\n')).toEqual([]);
    expect(parseCSVData('sample_id,yield_mg_L')).toEqual([]);
  });
});

describe('runMOO — deterministic and edge-case safe', () => {
  const iteration = makeIteration({ result: 100 });

  it('returns identical suggestions across repeated calls', () => {
    const data = [
      makeRow({ sample_id: 'S1', yield_mg_L: 80, biomass_OD600: 0.8, substrate_consumed_mM: 20 }),
      makeRow({ sample_id: 'S2', yield_mg_L: 90, biomass_OD600: 0.9, substrate_consumed_mM: 22 }),
    ];
    const a = runMOO(data, iteration);
    const b = runMOO(data, iteration);
    expect(a).toEqual(b);
    // Improvement percents must be finite numbers, not random draws.
    for (const s of a) expect(Number.isFinite(s.predicted_improvement_percent)).toBe(true);
  });

  it('returns an empty list when given an empty dataset', () => {
    expect(runMOO([], iteration)).toEqual([]);
  });

  it('fires the precursor-loading objective when mean yield is below target', () => {
    const data = [makeRow({ yield_mg_L: 40, biomass_OD600: 0.9, substrate_consumed_mM: 20 })];
    const suggestions = runMOO(data, iteration);
    const precursor = suggestions.find((s) => s.parameter.startsWith('Precursor Loading'));
    expect(precursor).toBeDefined();
    expect(precursor!.predicted_improvement_percent).toBeGreaterThanOrEqual(8);
    expect(precursor!.predicted_improvement_percent).toBeLessThanOrEqual(30);
  });

  it('suggests the fallback when no objective fires', () => {
    // High yield + healthy biomass + zero substrate disables the four main gates.
    const data = [makeRow({ yield_mg_L: 500, biomass_OD600: 1.5, substrate_consumed_mM: 0 })];
    const noTargetIteration = makeIteration({ result: 0 });
    const suggestions = runMOO(data, noTargetIteration);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].parameter).toBe('Fermentation Duration (h)');
  });

  it('does not produce NaN when biomass is zero', () => {
    const data = [makeRow({ yield_mg_L: 60, biomass_OD600: 0, substrate_consumed_mM: 20 })];
    const suggestions = runMOO(data, iteration);
    for (const s of suggestions) {
      expect(Number.isFinite(s.current_value)).toBe(true);
      expect(Number.isFinite(s.suggested_value)).toBe(true);
      expect(Number.isFinite(s.predicted_improvement_percent)).toBe(true);
    }
  });
});
