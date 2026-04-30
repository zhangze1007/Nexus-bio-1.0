/** @jest-environment node */
import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '..');

function repoPath(relativePath: string): string {
  return path.join(repoRoot, relativePath);
}

function read(relativePath: string): string {
  return fs.readFileSync(repoPath(relativePath), 'utf8');
}

function readJson(relativePath: string): Record<string, unknown> {
  return JSON.parse(read(relativePath)) as Record<string, unknown>;
}

const requiredDocs = [
  'docs/turing-path-whitepaper.md',
  'docs/sitr-governance-charter.md',
  'docs/conformance-leaderboard-plan.md',
  'docs/adoption-roadmap.md',
  'docs/versioning-policy.md',
];

describe('Turing path protocol governance docs', () => {
  it('creates the required governance and protocol roadmap docs', () => {
    for (const relativePath of requiredDocs) {
      expect(fs.existsSync(repoPath(relativePath))).toBe(true);
    }

    expect(read('docs/turing-path-whitepaper.md')).toContain('## Abstract');
    expect(read('docs/turing-path-whitepaper.md')).toContain('## Research Agenda');
    expect(read('docs/sitr-governance-charter.md')).toContain('## Change Process');
    expect(read('docs/conformance-leaderboard-plan.md')).toContain('## What The Leaderboard Measures');
    expect(read('docs/adoption-roadmap.md')).toContain('## Phase 5: Governance Working Group');
    expect(read('docs/versioning-policy.md')).toContain('## Changelog Requirements');
  });

  it('keeps the leaderboard template empty and not-yet-run', () => {
    const template = readJson('reports/conformance-leaderboard.template.json');

    expect(template.status).toBe('not-yet-run');
    expect(template.generatedAt).toBeNull();
    expect(template.submissions).toEqual([]);
    expect(template.rejectedSubmissions).toEqual([]);
    expect(template.nonClaims).toEqual(
      expect.arrayContaining([
        'no external adoption claimed',
        'no third-party validation claimed',
        'no scientific validation claimed',
        'no wet-lab validation claimed',
      ]),
    );
  });

  it('avoids Turing-level, adoption, and validation overclaims', () => {
    const combined = [
      ...requiredDocs.map(read),
      read('reports/conformance-leaderboard.template.json'),
    ].join('\n');

    expect(combined).toContain('No Turing-level achievement is claimed');
    expect(combined).toContain('No external adoption is claimed');
    expect(combined).not.toMatch(/\bhas achieved Turing-level\b/i);
    expect(combined).not.toMatch(/\bexternally adopted\b/i);
    expect(combined).not.toMatch(/\bstandardized by\b/i);
    expect(combined).not.toMatch(/\bscientifically validated\b/i);
    expect(combined).not.toMatch(/\bwet-lab validated\b/i);
    expect(combined).not.toMatch(/\bhas full SBOL compliance\b/i);
  });

  it('references the SITR draft and proof package', () => {
    const combined = requiredDocs.map(read).join('\n');

    expect(combined).toContain('spec/SITR-draft-v1.md');
    expect(combined).toContain('proof-package/');
    expect(combined).toContain('reference_impl_py/');
    expect(combined).toContain('reports/public-benchmark/');
  });
});
