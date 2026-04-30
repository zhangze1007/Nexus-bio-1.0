/** @jest-environment node */
import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '..');

const requiredDocs = [
  'docs/reviewer-pack.md',
  'docs/reviewer-worksheet.md',
  'docs/external-review-protocol.md',
  'docs/external-review-log.md',
];

const requiredTemplates = [
  'reports/external-review/README.md',
  'reports/external-review/reviewer-responses.template.json',
  'reports/external-review/adversarial-cases.json',
  'reports/external-review/disagreement-cases.json',
  'reports/external-review/pilot-summary.template.json',
];

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function readJson(relativePath: string): unknown {
  return JSON.parse(read(relativePath));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

describe('external review docs and templates', () => {
  it('creates reviewer-facing docs and external review templates', () => {
    for (const relativePath of [...requiredDocs, ...requiredTemplates]) {
      expect(fs.existsSync(path.join(repoRoot, relativePath))).toBe(true);
    }
  });

  it('marks review templates as not-yet-run with no fake reviewer data', () => {
    const responses = readJson('reports/external-review/reviewer-responses.template.json');
    const adversarial = readJson('reports/external-review/adversarial-cases.json');
    const disagreements = readJson('reports/external-review/disagreement-cases.json');
    const pilot = readJson('reports/external-review/pilot-summary.template.json');

    expect(isRecord(responses)).toBe(true);
    expect(isRecord(adversarial)).toBe(true);
    expect(isRecord(disagreements)).toBe(true);
    expect(isRecord(pilot)).toBe(true);
    if (!isRecord(responses) || !isRecord(adversarial) || !isRecord(disagreements) || !isRecord(pilot)) return;

    expect(responses.status).toBe('template-not-yet-run');
    expect(adversarial.status).toBe('template-not-yet-run');
    expect(disagreements.status).toBe('template-not-yet-run');
    expect(pilot.status).toBe('not-yet-run');
    expect(pilot.reviewerCount).toBe(0);
    expect(pilot.agreementRate).toBeNull();
    expect(pilot.bypassSuccessRate).toBeNull();
    expect(Array.isArray(adversarial.cases) && adversarial.cases.length).toBe(0);
    expect(Array.isArray(disagreements.cases) && disagreements.cases.length).toBe(0);

    const submission = responses.submission;
    expect(isRecord(submission)).toBe(true);
    if (!isRecord(submission)) return;
    expect(submission.reviewerLabel).toBe('');
    expect(Array.isArray(submission.responses) && submission.responses.length).toBe(0);
    expect(Array.isArray(submission.adversarialAttempts) && submission.adversarialAttempts.length).toBe(0);
  });

  it('documents non-claims and avoids completed-pilot language', () => {
    const combined = [...requiredDocs, ...requiredTemplates]
      .map((relativePath) => read(relativePath))
      .join('\n');

    expect(combined).toContain('not peer review');
    expect(combined).toContain('wet-lab validation');
    expect(combined).toContain('scientific validation');
    expect(combined).toContain('external validation');
    expect(combined).not.toMatch(/\bexternally validated\b/i);
    expect(combined).not.toMatch(/\bthird-party validated\b/i);
    expect(combined).not.toMatch(/\bpeer reviewed\b/i);
    expect(combined).not.toMatch(/\bhuman reviewer study completed\b/i);
    expect(combined).not.toMatch(/\bpilot completed\b/i);
  });

  it('links the reviewer worksheet to adversarial tasks and anonymous labels', () => {
    const worksheet = read('docs/reviewer-worksheet.md');
    const pack = read('docs/reviewer-pack.md');

    expect(worksheet).toContain('reviewer-001');
    expect(worksheet).toContain('Adversarial Tasks');
    expect(worksheet).toContain('CETHX demo');
    expect(worksheet).toContain('Community FBA demo');
    expect(pack).toContain('30-Minute Review Path');
    expect(pack).toContain('2-Hour Review Path');
  });
});
