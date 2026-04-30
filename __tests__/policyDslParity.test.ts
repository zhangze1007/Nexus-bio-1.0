/** @jest-environment node */
import fs from 'fs';
import path from 'path';
import { comparePolicyDslWithRuntimeEngine } from '../src/services/policyDslParity';

const repoRoot = path.resolve(__dirname, '..');
const caseDir = path.join(repoRoot, 'benchmarks', 'trust-runtime-cases');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function loadBenchmarkCases(): unknown[] {
  return fs.readdirSync(caseDir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .flatMap((file) => {
      const parsed: unknown = JSON.parse(fs.readFileSync(path.join(caseDir, file), 'utf8'));
      if (!isRecord(parsed) || !Array.isArray(parsed.cases)) {
        throw new Error(`${file} is not a benchmark case file`);
      }
      return parsed.cases;
    });
}

describe('comparePolicyDslWithRuntimeEngine', () => {
  it('matches evaluateClaimSurfacePolicy across the benchmark corpus', () => {
    const results = comparePolicyDslWithRuntimeEngine(loadBenchmarkCases());
    const mismatches = results.filter((result) => !result.matches);

    expect(results).toHaveLength(74);
    expect(mismatches).toEqual([]);
  });

  it('reports mismatches instead of hiding them', () => {
    const mismatchPolicy = {
      schemaVersion: 'policy-dsl-v1',
      policyId: 'mismatch-test-policy',
      description: 'A deliberately incomplete policy used to verify mismatch reporting.',
      rules: [],
      defaultDecision: {
        effect: 'block',
        blockCode: 'MISSING_POLICY',
        reason: 'Deliberate default deny.',
      },
    };

    const results = comparePolicyDslWithRuntimeEngine([
      {
        caseId: 'PARITY-MISMATCH-001',
        toolId: 'pathd',
        surface: 'payload',
        validityTier: 'partial',
        provenanceIds: ['prov-1'],
      },
    ], mismatchPolicy);

    expect(results).toEqual([
      expect.objectContaining({
        caseId: 'PARITY-MISMATCH-001',
        runtimeStatus: 'ok',
        dslStatus: 'blocked',
        dslBlockCode: 'MISSING_POLICY',
        matches: false,
      }),
    ]);
  });
});
