import { parseSmartInput, getSmartSuggestions, type InputType, type ConfidenceLevel } from '../src/lib/smart-parser';

const tests: Array<{ input: string; expectedType: InputType; expectedConfidence: ConfidenceLevel }> = [
  // DOI
  { input: '10.1038/nature05113', expectedType: 'DOI', expectedConfidence: 'HIGH' },
  // Strain
  { input: 'E. coli K-12', expectedType: 'STRAIN', expectedConfidence: 'HIGH' },
  { input: 'e.coli', expectedType: 'STRAIN', expectedConfidence: 'HIGH' },
  // Molecule — exact match (HIGH)
  { input: 'artemisinin', expectedType: 'MOLECULE', expectedConfidence: 'HIGH' },
  { input: 'lycopene biosynthesis', expectedType: 'MOLECULE', expectedConfidence: 'HIGH' },
  { input: 'erythromycin', expectedType: 'MOLECULE', expectedConfidence: 'HIGH' },
  { input: 'rhamnolipid', expectedType: 'MOLECULE', expectedConfidence: 'HIGH' },
  { input: 'glucaric acid', expectedType: 'MOLECULE', expectedConfidence: 'HIGH' },
  // Molecule — pattern match (MEDIUM)
  { input: 'some unknown terpenoid', expectedType: 'MOLECULE', expectedConfidence: 'MEDIUM' },
  { input: 'hexanol', expectedType: 'MOLECULE', expectedConfidence: 'MEDIUM' },
  // Metric
  { input: '50% yield improvement', expectedType: 'METRIC', expectedConfidence: 'MEDIUM' },
  { input: '10 g/L titer', expectedType: 'METRIC', expectedConfidence: 'MEDIUM' },
  // Freeform
  { input: 'optimize my pathway', expectedType: 'FREEFORM', expectedConfidence: 'LOW' },
  { input: 'how to increase yield', expectedType: 'FREEFORM', expectedConfidence: 'LOW' },
];

describe('Smart Entry Parser', () => {
  test.each(tests)('parses "$input" as $expectedType ($expectedConfidence)', ({ input, expectedType, expectedConfidence }) => {
    const result = parseSmartInput(input);
    expect(result.type).toBe(expectedType);
    expect(result.confidence).toBe(expectedConfidence);
    expect(result.rawInput).toBe(input);
    expect(result.routeTo).toBeTruthy();
    expect(result.toolChainDescription).toBeTruthy();
  });

  test('throws on empty input', () => {
    expect(() => parseSmartInput('')).toThrow('Input is empty');
    expect(() => parseSmartInput('   ')).toThrow('Input is empty');
  });

  test('strips https://doi.org/ prefix', () => {
    const result = parseSmartInput('https://doi.org/10.1038/nature05113');
    expect(result.type).toBe('DOI');
    expect(result.routeTo).toContain('10.1038%2Fnature05113');
  });

  test('handles case-insensitive strain matching', () => {
    const result = parseSmartInput('ESCHERICHIA COLI');
    expect(result.type).toBe('STRAIN');
    expect(result.displayLabel).toContain('E. coli');
  });

  test('all displayLabels are in English', () => {
    const inputs = ['10.1038/nature05113', 'E. coli', 'artemisinin', '50% yield', 'test'];
    for (const input of inputs) {
      const result = parseSmartInput(input);
      // No Chinese characters in displayLabel or toolChainDescription
      expect(result.displayLabel).not.toMatch(/[一-鿿]/);
      expect(result.toolChainDescription).not.toMatch(/[一-鿿]/);
    }
  });
});

describe('Smart Suggestions', () => {
  test('returns matching molecules for partial input', () => {
    const results = getSmartSuggestions('arte');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(s => s.toLowerCase().includes('artemisinin'))).toBe(true);
  });

  test('returns matching strains for partial input', () => {
    const results = getSmartSuggestions('e. coli');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(s => s.includes('E. coli'))).toBe(true);
  });

  test('returns empty for very short input', () => {
    expect(getSmartSuggestions('a')).toEqual([]);
  });

  test('returns empty for no matches', () => {
    expect(getSmartSuggestions('zzzznonexistent')).toEqual([]);
  });

  test('limits results to 8', () => {
    const results = getSmartSuggestions('a');
    // Even with many matches, should return at most 8
    expect(results.length).toBeLessThanOrEqual(8);
  });
});
