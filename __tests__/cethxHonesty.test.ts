/** @jest-environment node */
import fs from 'fs';
import path from 'path';
import { TOOL_ASSUMPTIONS } from '../src/config/toolAssumptions';
import { TOOL_VALIDITY } from '../src/config/toolValidity';
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

  it('records CETHX as Alberty-transformed partial thermodynamics with limited formal surfaces', () => {
    const boundary = getCethxThermodynamicsBoundary();

    expect(CETHX_THERMODYNAMICS_ROUTE_DECISION).toBe('alberty-transform-partial-boundary');
    expect(boundary).toBe(CETHX_THERMODYNAMICS_BOUNDARY);
    expect(boundary).toMatchObject({
      toolId: 'cethx',
      status: 'alberty-transform-partial',
      validityTier: 'partial',
      hasConditionAwareBackend: true,
      backendName: 'calcTransformedGibbs (thermoEngine)',
      payloadAllowed: true,
    });
    expect(boundary.assumptionIds).toEqual(expect.arrayContaining([
      'cethx.alberty_transform_local',
      'cethx.condition_aware_ph_ionic',
      'cethx.lehninger_reference_dg0',
      'cethx.proton_stoich_estimated',
    ]));
    expect(boundary.formalClaimSurfacesBlocked).toEqual([
      'external-handoff',
    ]);
    expect(isCethxFormalThermodynamicsSurfaceBlocked('payload')).toBe(false);
    expect(isCethxFormalThermodynamicsSurfaceBlocked('export')).toBe(false);
    expect(isCethxFormalThermodynamicsSurfaceBlocked('recommendation')).toBe(false);
    expect(isCethxFormalThermodynamicsSurfaceBlocked('protocol')).toBe(false);
    expect(isCethxFormalThermodynamicsSurfaceBlocked('external-handoff')).toBe(true);
  });

  it('declares CETHX as partial validity with Alberty transform assumptions', () => {
    const assumptions = TOOL_ASSUMPTIONS.cethx;
    const assumptionById = new Map(assumptions.map((assumption) => [assumption.id, assumption]));

    expect(TOOL_VALIDITY.cethx.level).toBe('partial');
    expect(TOOL_VALIDITY.cethx.caption).toContain('Alberty');
    expect(TOOL_VALIDITY.cethx.caption).toContain('Condition-aware');
    expect(assumptionById.get('cethx.alberty_transform_local')).toMatchObject({
      severity: 'info',
      toolId: 'cethx',
    });
    expect(assumptionById.get('cethx.condition_aware_ph_ionic')).toMatchObject({
      severity: 'info',
      toolId: 'cethx',
    });
    expect(assumptionById.get('cethx.proton_stoich_estimated')).toMatchObject({
      severity: 'warning',
      toolId: 'cethx',
    });
    expect(assumptionById.get('cethx.atp_yields_hardcoded')).toMatchObject({
      severity: 'warning',
      toolId: 'cethx',
    });
  });

  it('allows partial CETHX on export, recommendation, and protocol surfaces but blocks external-handoff', () => {
    const payloadPolicy = getClaimSurfacePolicy('cethx', 'payload');
    const exportPolicy = getClaimSurfacePolicy('cethx', 'export');
    const recommendationPolicy = getClaimSurfacePolicy('cethx', 'recommendation');
    const protocolPolicy = getClaimSurfacePolicy('cethx', 'protocol');
    const handoffPolicy = getClaimSurfacePolicy('cethx', 'external-handoff');

    expect(payloadPolicy?.allowedTiers).toContain('partial');
    expect(payloadPolicy?.rationale).toContain('Alberty');
    expect(exportPolicy?.allowedTiers).toContain('partial');
    expect(exportPolicy?.rationale).toContain('provenance');
    expect(recommendationPolicy?.allowedTiers).toContain('partial');
    expect(recommendationPolicy?.rationale).toContain('condition-aware');
    expect(protocolPolicy?.allowedTiers).toContain('partial');
    expect(protocolPolicy?.rationale).toContain('eQuilibrator');
    expect(handoffPolicy?.blockCode).toBe('EXTERNAL_HANDOFF_BLOCKED');
    expect(handoffPolicy?.requiresHumanGate).toBe(true);
    expect(handoffPolicy?.rationale).toContain('eQuilibrator');
  });

  it('keeps CETHX external-handoff blocked but allows export/recommendation/protocol for partial tier', () => {
    const cases = loadBenchmarkCases();
    const labels = loadExpectedLabels();
    const labelsById = new Map(labels.map((label) => [label.caseId, label]));

    // TRB-042: fake ΔG with real feasibility claim — still blocked
    const trb042 = cases.find((item) => item.caseId === 'TRB-042');
    expect(trb042?.toolId).toBe('cethx');
    expect(trb042?.expected.status).not.toBe('ok');
    expect(trb042?.riskTags).toContain('cethx-fake-dg-real-feasibility');

    // TRB-058: external-handoff without eQuilibrator — still blocked
    const trb058 = cases.find((item) => item.caseId === 'TRB-058');
    expect(trb058?.toolId).toBe('cethx');
    expect(trb058?.expected.status).not.toBe('ok');
    expect(labelsById.get('TRB-058')?.expectedBlockCode).toBe('EXTERNAL_HANDOFF_BLOCKED');
  });

  it('presents CETHX with Alberty-transformed condition-aware calculations', () => {
    const cethxPage = readRepoFile('src/components/tools/CETHXPage.tsx');
    const cethxState = readRepoFile('src/components/tools/cethx/useCETHXState.ts');
    const registry = readRepoFile('src/components/tools/shared/toolRegistry.ts');
    const validity = readRepoFile('src/config/toolValidity.ts');
    const mockCethx = readRepoFile('src/data/mockCETHX.ts');

    // CETHX now uses Alberty transform for condition-aware calculations
    // calcTransformedGibbs lives in the state hook (useCETHXState.ts)
    expect(cethxState).toContain('calcTransformedGibbs');
    expect(cethxPage).toContain('Alberty');
    expect(cethxPage).toContain('Condition-aware');
    expect(cethxPage).toContain('Feasibility');
    expect(registry).toContain('Condition-aware thermodynamics');
    expect(validity).toContain('Alberty');
    expect(mockCethx).toContain('reference-table values displayed unchanged');

    // Should not claim full eQuilibrator ComponentContribution when using local transform
    const combined = `${cethxPage}\n${registry}\n${validity}`;
    expect(combined).not.toContain('Thermodynamic feasibility engine');
    expect(combined).not.toContain("ΔG° corrected via Van't Hoff");
    expect(combined).not.toContain('exact Delta-G correction');
  });
});
