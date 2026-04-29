/** @jest-environment node */
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

type ExpectedStatus = 'ok' | 'blocked' | 'gated' | 'demoOnly';
type ClaimSurface = 'payload' | 'export' | 'recommendation' | 'protocol' | 'external-handoff';
type BenchmarkCategory =
  | 'truthful-partial'
  | 'unsafe-demo'
  | 'missing-evidence'
  | 'uncertainty-unresolved'
  | 'human-gate-required'
  | 'known-bad-case'
  | 'draft-output';

interface TrustBenchmarkCase {
  caseId: string;
  category: BenchmarkCategory;
  toolId: string;
  surface: ClaimSurface;
  expected: {
    status: ExpectedStatus;
    blockCode: string | null;
  };
  riskTags: string[];
  knownBad: boolean;
}

interface CaseFile {
  cases: TrustBenchmarkCase[];
}

interface ExpectedLabelRow {
  caseId: string;
  expectedStatus: string;
  expectedBlockCode: string | null;
  category: string;
  toolId: string;
  surface: string;
  knownBad: string;
}

const repoRoot = path.resolve(__dirname, '..');
const caseDir = path.join(repoRoot, 'benchmarks', 'trust-runtime-cases');
const labelsPath = path.join(repoRoot, 'benchmarks', 'expected_labels.csv');

const requiredCategories: BenchmarkCategory[] = [
  'truthful-partial',
  'unsafe-demo',
  'missing-evidence',
  'uncertainty-unresolved',
  'human-gate-required',
  'known-bad-case',
  'draft-output',
];

const requiredSurfaces: ClaimSurface[] = [
  'payload',
  'export',
  'recommendation',
  'protocol',
  'external-handoff',
];

const requiredStatuses: ExpectedStatus[] = ['ok', 'blocked', 'gated', 'demoOnly'];

const requiredKnownBadTags = [
  'community-fba-fake-exchange',
  'cethx-fake-dg-real-feasibility',
  'stringly-dbtl-loopback',
  'draft-dbtl-protocol-export',
  'missing-provenance-export',
];

function loadCases(): TrustBenchmarkCase[] {
  return fs.readdirSync(caseDir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .flatMap((file) => {
      const parsed = JSON.parse(fs.readFileSync(path.join(caseDir, file), 'utf8')) as CaseFile;
      return parsed.cases;
    });
}

function parseLabels(): ExpectedLabelRow[] {
  const [, ...lines] = fs.readFileSync(labelsPath, 'utf8').trim().split(/\r?\n/);
  return lines.map((line) => {
    const [
      caseId,
      expectedStatus,
      expectedBlockCode,
      category,
      toolId,
      surface,
      knownBad,
    ] = line.split(',');
    return {
      caseId,
      expectedStatus,
      expectedBlockCode: expectedBlockCode || null,
      category,
      toolId,
      surface,
      knownBad,
    };
  });
}

describe('trust benchmark corpus', () => {
  const cases = loadCases();
  const labels = parseLabels();

  it('passes the corpus validator script', () => {
    expect(() => {
      execFileSync('node', ['scripts/validateTrustBenchmarkCorpus.mjs'], {
        cwd: repoRoot,
        stdio: 'pipe',
      });
    }).not.toThrow();
  });

  it('has at least 50 cases', () => {
    expect(cases.length).toBeGreaterThanOrEqual(50);
  });

  it('represents all required categories', () => {
    const present = new Set(cases.map((testCase) => testCase.category));
    for (const category of requiredCategories) {
      expect(present.has(category)).toBe(true);
    }
  });

  it('represents all claim surfaces', () => {
    const present = new Set(cases.map((testCase) => testCase.surface));
    for (const surface of requiredSurfaces) {
      expect(present.has(surface)).toBe(true);
    }
  });

  it('represents all expected statuses', () => {
    const present = new Set(cases.map((testCase) => testCase.expected.status));
    for (const status of requiredStatuses) {
      expect(present.has(status)).toBe(true);
    }
  });

  it('keeps expected_labels.csv one-to-one with JSON cases', () => {
    const caseIds = new Set(cases.map((testCase) => testCase.caseId));
    const labelIds = new Set(labels.map((label) => label.caseId));
    expect(labelIds).toEqual(caseIds);
    expect(labels).toHaveLength(cases.length);

    const casesById = new Map(cases.map((testCase) => [testCase.caseId, testCase]));
    for (const label of labels) {
      const testCase = casesById.get(label.caseId);
      expect(testCase).toBeDefined();
      expect(label.expectedStatus).toBe(testCase?.expected.status);
      expect(label.expectedBlockCode).toBe(testCase?.expected.blockCode);
    }
  });

  it('includes required known-bad risk tags', () => {
    const knownBadTags = new Set(
      cases
        .filter((testCase) => testCase.knownBad)
        .flatMap((testCase) => testCase.riskTags),
    );
    for (const tag of requiredKnownBadTags) {
      expect(knownBadTags.has(tag)).toBe(true);
    }
  });
});
