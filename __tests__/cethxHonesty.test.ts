/** @jest-environment node */
import fs from 'fs';
import path from 'path';
import { TOOL_ASSUMPTIONS } from '../src/components/tools/shared/toolAssumptions';
import { TOOL_VALIDITY } from '../src/components/tools/shared/toolValidity';
import {
  CETHX_THERMODYNAMICS_BOUNDARY,
  CETHX_THERMODYNAMICS_ROUTE_DECISION,
  getCethxThermodynamicsBoundary,
  isCethxFormalThermodynamicsSurfaceBlocked,
} from '../src/domain/cethxThermodynamicsBoundary';
import { getClaimSurfacePolicy } from '../src/domain/claimSurfacePolicies';

interface TrustBenchmarkCase {
  caseId: string;
  category: string;
  toolId: string;
  surface: string;
  expected: {
    status: string;
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
}

const repoRoot = path.resolve(__dirname, '..');

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function loadBenchmarkCases(): TrustBenchmarkCase[] {
  const caseDir = path.join(repoRoot, 'benchmarks', 'trust-runtime-cases');
  return fs.readdirSync(caseDir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .flatMap((file) => {
      const parsed = JSON.parse(fs.readFileSync(path.join(caseDir, file), 'utf8')) as CaseFile;
      return parsed.cases;
    });
}

function loadExpectedLabels(): ExpectedLabelRow[] {
  const [, ...lines] = readRepoFile('benchmarks/expected_labels.csv').trim().split(/\r?\n/);
  return lines.map((line) => {
    const [caseId, expectedStatus, expectedBlockCode] = line.split(',');
    return {
      caseId,
      expectedStatus,
      expectedBlockCode: expectedBlockCode || null,
    };
  });
}

describe('CETHX thermodynamics honesty boundary', () => {
  it('documents the current implementation, route table, Route B recommendation, and non-claims', () => {
    const memo = readRepoFile('docs/decision-cethx.md');

    expect(memo).toContain('## Current Implementation Status');
    expect(memo).toContain('| A. Real backend integration |');
    expect(memo).toContain('| B. Demo-only boundary |');
    expect(memo).toContain('| C. Remove formal claim surface |');
    expect(memo).toContain('## Final Step 10 Recommendation');
    expect(memo).toContain('Recommend B now.');
    expect(memo).toContain('No real thermodynamics claim unless a backend exists.');
    expect(memo).toContain('No eQuilibrator claim unless integrated and tested.');
    expect(memo).toContain('No condition-aware delta G prime claim unless');
  });

  it('records CETHX as demo-only reference thermodynamics with blocked formal surfaces', () => {
    const boundary = getCethxThermodynamicsBoundary();

    expect(CETHX_THERMODYNAMICS_ROUTE_DECISION).toBe('demo-only-reference-boundary');
    expect(boundary).toBe(CETHX_THERMODYNAMICS_BOUNDARY);
    expect(boundary).toMatchObject({
      toolId: 'cethx',
      status: 'demo-only-reference',
      validityTier: 'demo',
      hasConditionAwareBackend: false,
      backendName: null,
      payloadAllowed: true,
    });
    expect(boundary.assumptionIds).toEqual(expect.arrayContaining([
      'cethx.thermodynamics_demo_only',
      'cethx.missing_condition_aware_backend',
      'cethx.uncertainty_not_calculated',
      'cethx.no_ionic_strength_correction',
      'cethx.lehninger_lookup',
    ]));
    expect(boundary.formalClaimSurfacesBlocked).toEqual([
      'export',
      'recommendation',
      'protocol',
      'external-handoff',
    ]);
    expect(isCethxFormalThermodynamicsSurfaceBlocked('payload')).toBe(false);
    expect(isCethxFormalThermodynamicsSurfaceBlocked('export')).toBe(true);
    expect(isCethxFormalThermodynamicsSurfaceBlocked('recommendation')).toBe(true);
    expect(isCethxFormalThermodynamicsSurfaceBlocked('protocol')).toBe(true);
    expect(isCethxFormalThermodynamicsSurfaceBlocked('external-handoff')).toBe(true);
  });

  it('keeps CETHX validity demo and declares backend, uncertainty, and condition limitations', () => {
    const assumptions = TOOL_ASSUMPTIONS.cethx;
    const assumptionById = new Map(assumptions.map((assumption) => [assumption.id, assumption]));

    expect(TOOL_VALIDITY.cethx.level).toBe('demo');
    expect(TOOL_VALIDITY.cethx.caption).toContain('No condition-aware backend');
    expect(TOOL_VALIDITY.cethx.caption).toContain('uncertainty');
    expect(assumptionById.get('cethx.thermodynamics_demo_only')).toMatchObject({
      severity: 'blocking',
      toolId: 'cethx',
    });
    expect(assumptionById.get('cethx.missing_condition_aware_backend')).toMatchObject({
      severity: 'blocking',
      toolId: 'cethx',
    });
    expect(assumptionById.get('cethx.uncertainty_not_calculated')).toMatchObject({
      severity: 'blocking',
      toolId: 'cethx',
    });
    expect(assumptionById.get('cethx.uniform_ph_factor')?.statement).toContain('Legacy compatibility id');
    expect(assumptionById.get('cethx.no_ionic_strength_correction')?.statement).toContain('pMg');
  });

  it('keeps demo CETHX off formal claim surfaces through policy tiers and rationales', () => {
    const payloadPolicy = getClaimSurfacePolicy('cethx', 'payload');
    const exportPolicy = getClaimSurfacePolicy('cethx', 'export');
    const recommendationPolicy = getClaimSurfacePolicy('cethx', 'recommendation');
    const protocolPolicy = getClaimSurfacePolicy('cethx', 'protocol');
    const handoffPolicy = getClaimSurfacePolicy('cethx', 'external-handoff');

    expect(payloadPolicy?.allowedTiers).toContain('demo');
    expect(payloadPolicy?.rationale).toContain('not a condition-aware thermodynamics backend');
    expect(exportPolicy?.allowedTiers).not.toContain('demo');
    expect(exportPolicy?.rationale).toContain('formal thermodynamic feasibility claims');
    expect(recommendationPolicy?.allowedTiers).not.toContain('demo');
    expect(recommendationPolicy?.rationale).toContain('lacks uncertainty');
    expect(protocolPolicy?.allowedTiers).not.toContain('demo');
    expect(protocolPolicy?.blockCode).toBe('DEMO_OUTPUT_PROTOCOL_BLOCKED');
    expect(protocolPolicy?.rationale).toContain('no condition-aware backend');
    expect(handoffPolicy?.allowedTiers).not.toContain('demo');
    expect(handoffPolicy?.blockCode).toBe('EXTERNAL_HANDOFF_BLOCKED');
    expect(handoffPolicy?.rationale).toContain('without uncertainty');
  });

  it('keeps CETHX benchmark cases blocked or demo-only rather than ok on formal claims', () => {
    const cases = loadBenchmarkCases();
    const labels = loadExpectedLabels();
    const labelsById = new Map(labels.map((label) => [label.caseId, label]));

    for (const caseId of ['TRB-042', 'TRB-057', 'TRB-058']) {
      const testCase = cases.find((item) => item.caseId === caseId);
      const label = labelsById.get(caseId);

      expect(testCase?.toolId).toBe('cethx');
      expect(testCase?.expected.status).not.toBe('ok');
      expect(label?.expectedStatus).not.toBe('ok');
    }

    expect(cases.find((item) => item.caseId === 'TRB-042')?.riskTags)
      .toContain('cethx-fake-dg-real-feasibility');
    expect(cases.find((item) => item.caseId === 'TRB-057')?.riskTags)
      .toContain('missing-condition-parameters');
    expect(cases.find((item) => item.caseId === 'TRB-058')?.riskTags)
      .toContain('missing-uncertainty');
    expect(labelsById.get('TRB-057')?.expectedBlockCode).toBe('DEMO_OUTPUT_PROTOCOL_BLOCKED');
    expect(labelsById.get('TRB-058')?.expectedBlockCode).toBe('EXTERNAL_HANDOFF_BLOCKED');
  });

  it('does not present current CETHX as real, condition-aware, or eQuilibrator-backed', () => {
    const cethxPage = readRepoFile('src/components/tools/CETHXPage.tsx');
    const registry = readRepoFile('src/components/tools/shared/toolRegistry.ts');
    const validity = readRepoFile('src/components/tools/shared/toolValidity.ts');
    const mockCethx = readRepoFile('src/data/mockCETHX.ts');

    expect(cethxPage).toContain('Demo thermodynamics explainer');
    expect(cethxPage).toContain('uncertainty not calculated');
    expect(cethxPage).toContain('not a condition-aware feasibility result');
    expect(registry).toContain('Demo thermodynamics explainer');
    expect(validity).toContain('No condition-aware backend');
    expect(mockCethx).toContain('reference-table values displayed unchanged');

    const combined = `${cethxPage}\n${registry}\n${validity}`;
    expect(combined).not.toContain('Thermodynamic feasibility engine');
    expect(combined).not.toContain("ΔG° corrected via Van't Hoff");
    expect(combined).not.toContain('exact Delta-G correction');
    expect(combined).not.toContain('Thermodynamically favorable at the current operating point');
    expect(combined).not.toContain('eQuilibrator-backed');
  });
});
