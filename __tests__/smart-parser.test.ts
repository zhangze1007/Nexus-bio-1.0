import { parseSmartInput, type InputType, type ConfidenceLevel } from '../src/lib/smart-parser';

const tests: Array<{ input: string; expectedType: InputType; expectedConfidence: ConfidenceLevel }> = [
  { input: '10.1038/nature05113', expectedType: 'DOI', expectedConfidence: 'HIGH' },
  { input: 'E. coli K-12', expectedType: 'STRAIN', expectedConfidence: 'HIGH' },
  { input: 'e.coli', expectedType: 'STRAIN', expectedConfidence: 'HIGH' },
  { input: 'artemisinin', expectedType: 'MOLECULE', expectedConfidence: 'HIGH' },
  { input: 'lycopene biosynthesis', expectedType: 'MOLECULE', expectedConfidence: 'HIGH' },
  { input: '产量提升50%', expectedType: 'METRIC', expectedConfidence: 'MEDIUM' },
  { input: '10 g/L titer', expectedType: 'METRIC', expectedConfidence: 'MEDIUM' },
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
});
