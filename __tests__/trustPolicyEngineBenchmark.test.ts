/** @jest-environment node */
import fs from 'fs';
import path from 'path';
import type { ClaimSurface, GateStatus, ValidityTier } from '../src/protocol/nexusTrustRuntime';
import { evaluateClaimSurfacePolicy } from '../src/services/trustPolicyEngine';
import type { HumanGateStatus } from '../src/services/trustPolicyEngine';

interface BenchmarkInput {
  validityTier: ValidityTier;
  hasProvenance: boolean;
  evidenceState: 'present' | 'missing' | 'not-required';
  uncertaintyState: 'bounded' | 'unresolved' | 'not-applicable';
  isDraft: boolean;
  humanGateRequired: boolean;
  humanGateSatisfied: boolean;
  notes: string;
}

interface BenchmarkExpected {
  status: GateStatus;
  blockCode: string | null;
  rationale: string;
}

interface TrustBenchmarkCase {
  caseId: string;
  title: string;
  category: string;
  toolId: string;
  surface: ClaimSurface;
  claim: string;
  input: BenchmarkInput;
  expected: BenchmarkExpected;
  riskTags: string[];
  knownBad: boolean;
}

interface BenchmarkCaseFile {
  cases: TrustBenchmarkCase[];
}

interface ExpectedLabel {
  caseId: string;
  expectedStatus: GateStatus;
  expectedBlockCode: string | null;
}

const repoRoot = path.resolve(__dirname, '..');
const caseDir = path.join(repoRoot, 'benchmarks', 'trust-runtime-cases');
const labelsPath = path.join(repoRoot, 'benchmarks', 'expected_labels.csv');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBenchmarkCaseFile(value: unknown): value is BenchmarkCaseFile {
  if (!isRecord(value) || !Array.isArray(value.cases)) return false;
  return value.cases.every(isRecord);
}

function loadCases(): TrustBenchmarkCase[] {
  return fs.readdirSync(caseDir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .flatMap((file) => {
      const parsed: unknown = JSON.parse(fs.readFileSync(path.join(caseDir, file), 'utf8'));
      if (!isBenchmarkCaseFile(parsed)) {
        throw new Error(`${file} is not a trust benchmark case file`);
      }
      return parsed.cases;
    });
}

function loadExpectedLabels(): Map<string, ExpectedLabel> {
  const [, ...lines] = fs.readFileSync(labelsPath, 'utf8').trim().split(/\r?\n/);
  return new Map(lines.map((line) => {
    const [caseId, expectedStatus, expectedBlockCode] = line.split(',');
    return [
      caseId,
      {
        caseId,
        expectedStatus: expectedStatus as GateStatus,
        expectedBlockCode: expectedBlockCode || null,
      },
    ];
  }));
}

function humanGateStatus(testCase: TrustBenchmarkCase): HumanGateStatus {
  if (!testCase.input.humanGateRequired) return 'not-required';
  return testCase.input.humanGateSatisfied ? 'approved' : 'pending';
}

function provenanceIds(testCase: TrustBenchmarkCase): string[] {
  return testCase.input.hasProvenance ? [`${testCase.caseId}:provenance`] : [];
}

function evidenceIds(testCase: TrustBenchmarkCase): string[] {
  return testCase.input.evidenceState === 'present' ? [`${testCase.caseId}:evidence`] : [];
}

describe('evaluateClaimSurfacePolicy benchmark corpus alignment', () => {
  it('matches Step 6 expected labels for all benchmark cases', () => {
    const cases = loadCases();
    const labels = loadExpectedLabels();
    const mismatches: string[] = [];

    for (const testCase of cases) {
      const expectedLabel = labels.get(testCase.caseId);
      if (!expectedLabel) {
        mismatches.push(`${testCase.caseId}: missing expected label`);
        continue;
      }

      const decision = evaluateClaimSurfacePolicy({
        toolId: testCase.toolId,
        surface: testCase.surface,
        validityTier: testCase.input.validityTier,
        isDraft: testCase.input.isDraft,
        provenanceIds: provenanceIds(testCase),
        evidenceIds: evidenceIds(testCase),
        assumptionIds: testCase.riskTags,
        requiresHumanGate: testCase.input.humanGateRequired,
        humanGateStatus: humanGateStatus(testCase),
      });

      if (decision.status !== expectedLabel.expectedStatus) {
        mismatches.push(
          `${testCase.caseId} ${testCase.category}: status ${decision.status} !== ${expectedLabel.expectedStatus}`,
        );
      }

      if (expectedLabel.expectedBlockCode && decision.blockCode !== expectedLabel.expectedBlockCode) {
        mismatches.push(
          `${testCase.caseId} ${testCase.category}: blockCode ${decision.blockCode ?? '<empty>'} !== ${expectedLabel.expectedBlockCode}`,
        );
      }

      if (!expectedLabel.expectedBlockCode && decision.blockCode) {
        mismatches.push(
          `${testCase.caseId} ${testCase.category}: unexpected blockCode ${decision.blockCode}`,
        );
      }
    }

    expect(mismatches).toEqual([]);
    expect(cases).toHaveLength(56);
  });
});
