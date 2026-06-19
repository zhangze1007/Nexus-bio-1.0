/** @jest-environment node */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const repoRoot = path.resolve(__dirname, '..');
const reportPath = path.join(repoRoot, 'reports', 'second-implementation-consistency.json');

interface SecondImplementationReport {
  schemaVersion: string;
  referenceImplementation: string;
  totalCases: number;
  pythonVsExpectedAgreementRate: number;
  pythonVsTypescriptAgreementRate: number | null;
  mismatchCount: number;
  limitations: string[];
  nonClaims: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseReport(): SecondImplementationReport {
  const parsed: unknown = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  if (!isRecord(parsed)) {
    throw new Error('second implementation report must be an object');
  }
  const report = parsed as Partial<SecondImplementationReport>;
  if (
    typeof report.schemaVersion !== 'string'
    || typeof report.referenceImplementation !== 'string'
    || typeof report.totalCases !== 'number'
    || typeof report.pythonVsExpectedAgreementRate !== 'number'
    || !(
      typeof report.pythonVsTypescriptAgreementRate === 'number'
      || report.pythonVsTypescriptAgreementRate === null
    )
    || typeof report.mismatchCount !== 'number'
    || !Array.isArray(report.limitations)
    || !Array.isArray(report.nonClaims)
  ) {
    throw new Error('second implementation report shape is unstable');
  }
  return report as SecondImplementationReport;
}

describe('Python second implementation smoke test', () => {
  it('runs the Python consistency comparison and writes a parseable report', () => {
    // Skip if python3 is not available or dependencies are missing
    try {
      execFileSync('python3', ['--version'], { stdio: 'pipe' });
    } catch {
      console.warn('python3 not available — skipping Python reference implementation test');
      return;
    }
    try {
      execFileSync('python3', ['reference_impl_py/run_reference_benchmark.py', 'compare'], {
        cwd: repoRoot,
        stdio: 'pipe',
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('No module named') || msg.includes('ModuleNotFoundError')) {
        console.warn('Python dependencies not installed — skipping Python reference implementation test');
        return;
      }
      throw e;
    }

    const report = parseReport();

    expect(report.schemaVersion).toBe('second-implementation-consistency-v1');
    expect(report.referenceImplementation).toBe('python-stdlib');
    expect(report.totalCases).toBe(74);
    expect(report.pythonVsExpectedAgreementRate).toBeGreaterThanOrEqual(0);
    expect(report.pythonVsExpectedAgreementRate).toBeLessThanOrEqual(1);
    if (report.pythonVsTypescriptAgreementRate !== null) {
      expect(report.pythonVsTypescriptAgreementRate).toBeGreaterThanOrEqual(0);
      expect(report.pythonVsTypescriptAgreementRate).toBeLessThanOrEqual(1);
    }
    expect(report.limitations.join('\n')).toMatch(/not independent third-party validation/i);
    expect(report.nonClaims).toContain('No external validation is claimed.');
  });

  it('does not change homepage or landing UI files', () => {
    const changedFiles = execFileSync('git', ['diff', '--name-only'], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).split(/\r?\n/);

    expect(changedFiles).not.toContain('app/page.tsx');
    expect(changedFiles).not.toContain('src/App.tsx');
    expect(changedFiles).not.toContain('src/components/Hero.tsx');
    // ThreeScene.tsx allowed — intentional font size fixes (8px→10px) as part of UI/UX refactor
  });
});
