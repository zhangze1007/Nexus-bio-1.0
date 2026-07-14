import { buildFindings, toMarkdown } from '../../scripts/audit/rank';

const claims = [{ file: 'a.ts', hasProvenance: true, citations: ['Watson 2023 Nature'] }];

describe('buildFindings', () => {
  it('drops excluded randomness and ranks a claim-backed fabrication highest', () => {
    const findings = buildFindings({
      random: [
        { file: 'a.ts', line: 10, snippet: '', klass: 'fabrication', reason: 'r' },
        { file: 'b.ts', line: 5, snippet: '', klass: 'reproducibility', reason: 'r' },
        { file: 'c.ts', line: 1, snippet: '', klass: 'excluded', reason: 'id' },
      ],
      decoy: [{ file: 'd.ts', line: 3, fn: 'findAB', param: 'minDist' }],
      claims,
    });
    expect(findings.map((f) => f.file)).toEqual(['a.ts', 'd.ts', 'b.ts']); // 5,3,2
    expect(findings.find((f) => f.file === 'a.ts')!.severity).toBe(5);
    expect(findings.some((f) => f.klass === 'reproducibility' && f.file === 'c.ts')).toBe(false);
  });

  it('renders a markdown table with a header row', () => {
    const md = toMarkdown(buildFindings({ random: [], decoy: [], claims: [] }));
    expect(md).toContain('| Severity | Class | File:Line |');
  });
});
