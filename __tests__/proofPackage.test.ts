/** @jest-environment node */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const repoRoot = path.resolve(__dirname, '..');
const proofRoot = path.join(repoRoot, 'proof-package');

const requiredProofFiles = [
  'README.md',
  'manifest.json',
  'replication-guide.md',
  'limitations.md',
  'demo-status-table.md',
  'replay.md',
  'benchmark/README.md',
  'benchmark/run.sh',
  'benchmark/replay.mjs',
  'checks/README.md',
  'reports/trust-metrics-latest.json',
  'reports/public-benchmark-report.json',
  'reports/second-implementation-consistency.json',
  'reports/second-implementation-consistency.md',
  'examples/safe-pathway.json',
  'examples/blocked-cethx-claim.json',
  'provenance/example-provenance-bundle.json',
  'provenance/example-sbol-artifact.json',
];

const requiredNonClaims = [
  'No wet-lab validation is claimed.',
  'No scientific model validation is claimed.',
  'No external validation is claimed.',
  'No independent third-party validation is claimed.',
  'No full SBOL compliance is claimed unless validated separately.',
  'No statistical significance is claimed.',
  'No completed human reviewer study is claimed.',
  'No completed external reviewer pilot is claimed.',
  'No regulatory approval is claimed.',
  'No production-grade safety certification is claimed.',
  'No user traction is claimed.',
];

function proofPath(relativePath: string): string {
  return path.join(proofRoot, relativePath);
}

function readProof(relativePath: string): string {
  return fs.readFileSync(proofPath(relativePath), 'utf8');
}

function readJson(relativePath: string): unknown {
  return JSON.parse(readProof(relativePath));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function manifestEntries(manifest: Record<string, unknown>): Record<string, unknown>[] {
  const contents = manifest.contents;
  if (!isRecord(contents)) return [];
  return Object.values(contents).flatMap((items) => (
    Array.isArray(items) ? items.filter(isRecord) : []
  ));
}

function listProofFiles(relativeDir = ''): string[] {
  const fullDir = path.join(proofRoot, relativeDir);
  return fs.readdirSync(fullDir, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.posix.join(relativeDir, entry.name);
    if (entry.isDirectory()) return listProofFiles(relativePath);
    if (entry.isFile()) return [relativePath];
    return [];
  });
}

describe('proof package', () => {
  it('contains the required proof package files', () => {
    for (const relativePath of requiredProofFiles) {
      expect(fs.existsSync(proofPath(relativePath))).toBe(true);
    }
  });

  it('has a manifest with explicit non-claims and listed artifacts', () => {
    const manifest = readJson('manifest.json');
    expect(isRecord(manifest)).toBe(true);
    if (!isRecord(manifest)) return;

    expect(manifest.schemaVersion).toBe('proof-package-v1');
    expect(manifest.runLabel).toBe('local-dev');
    expect(Array.isArray(manifest.nonClaims)).toBe(true);
    const nonClaims = Array.isArray(manifest.nonClaims) ? manifest.nonClaims : [];
    for (const nonClaim of requiredNonClaims) {
      expect(nonClaims).toContain(nonClaim);
    }

    const packagePaths = new Set(
      manifestEntries(manifest)
        .map((entry) => entry.packagePath)
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.replace(/^proof-package\//, '')),
    );
    for (const proofFile of listProofFiles()) {
      expect(packagePaths.has(proofFile)).toBe(true);
    }
  });

  it('keeps key reports and benchmark assets parseable', () => {
    const trustReport = readJson('reports/trust-metrics-latest.json');
    const publicReport = readJson('reports/public-benchmark-report.json');
    const publicSummary = readJson('reports/public-benchmark-summary.json');
    const rawResults = readJson('reports/public-benchmark-raw-results.json');
    const secondImplementation = readJson('reports/second-implementation-consistency.json');
    const benchmarkCases = readJson('benchmark/trust-runtime-cases/p0-step-6-cases.json');

    expect(isRecord(trustReport) && trustReport.schemaVersion).toBe('trust-metrics-v1');
    expect(isRecord(publicReport) && publicReport.schemaVersion).toBe('public-benchmark-v1');
    expect(isRecord(secondImplementation) && secondImplementation.schemaVersion)
      .toBe('second-implementation-consistency-v1');
    expect(Array.isArray(publicSummary)).toBe(true);
    expect(Array.isArray(rawResults)).toBe(true);
    expect(isRecord(benchmarkCases) && Array.isArray(benchmarkCases.cases)).toBe(true);
  });

  it('documents replay instructions and package limitations', () => {
    expect(readProof('README.md')).toContain('npm run proof:check');
    expect(readProof('README.md')).toContain('npm run proof:replay');
    expect(readProof('replay.md')).toContain('npm run proof:replay');
    expect(readProof('limitations.md')).toContain('Community FBA mode is demo-only illustrative');
    expect(readProof('limitations.md')).toContain('external review workflow is prepared');
    expect(readProof('demo-status-table.md')).toContain('| CETHX | demo |');
  });

  it('passes the local proof package integrity script', () => {
    execFileSync('node', ['scripts/checkProofPackage.mjs'], {
      cwd: repoRoot,
      stdio: 'pipe',
    });
  });

  it('does not add positive validation claims to proof package docs', () => {
    const combinedText = listProofFiles()
      .filter((file) => /\.(md|json|csv|mjs|sh)$/.test(file))
      .map((file) => readProof(file))
      .join('\n');

    expect(combinedText).not.toMatch(/\bis wet-lab validated\b/i);
    expect(combinedText).not.toMatch(/\bscientifically validated\b/i);
    expect(combinedText).not.toMatch(/\bvalidated biological design\b/i);
    expect(combinedText).not.toMatch(/\bstatistically significant\b/i);
    expect(combinedText).not.toMatch(/\bhuman reviewer study completed\b/i);
    expect(combinedText).not.toMatch(/\bpilot completed\b/i);
    expect(combinedText).not.toMatch(/\bhas full SBOL compliance\b/i);
  });
});
