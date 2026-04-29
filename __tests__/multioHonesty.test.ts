/** @jest-environment node */
import fs from 'fs';
import path from 'path';
import { TOOL_ASSUMPTIONS } from '../src/components/tools/shared/toolAssumptions';
import { TOOL_DEFINITIONS } from '../src/components/tools/shared/toolRegistry';
import { TOOL_VALIDITY } from '../src/components/tools/shared/toolValidity';
import {
  MULTIO_MODEL_BOUNDARY,
  MULTIO_MODEL_ROUTE_DECISION,
  getMultiOModelBoundary,
  isMultiOFormalModelSurfaceBlocked,
} from '../src/domain/multioModelBoundary';
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

describe('MultiO model honesty boundary', () => {
  it('documents the current implementation, route table, Route C recommendation, and non-claims', () => {
    const memo = readRepoFile('docs/decision-multio.md');

    expect(memo).toContain('## Current Implementation Status');
    expect(memo).toContain('| A. Reference model integration |');
    expect(memo).toContain('| B. Split deterministic and reference-model modes |');
    expect(memo).toContain('| C. Deterministic/demo-only boundary |');
    expect(memo).toContain('## Final Step 11 Recommendation');
    expect(memo).toContain('Recommend C now.');
    expect(memo).toContain('No Bayesian claim unless a Bayesian model exists.');
    expect(memo).toContain('No GP claim unless a GP backend exists.');
    expect(memo).toContain('No MOFA or VAE claim unless those models exist.');
    expect(memo).toContain('No posterior uncertainty claim unless uncertainty is computed.');
  });

  it('records MultiO as deterministic demo integration with blocked formal surfaces', () => {
    const boundary = getMultiOModelBoundary();

    expect(MULTIO_MODEL_ROUTE_DECISION).toBe('deterministic-demo-boundary');
    expect(boundary).toBe(MULTIO_MODEL_BOUNDARY);
    expect(boundary).toMatchObject({
      toolId: 'multio',
      status: 'deterministic-demo-only',
      validityTier: 'demo',
      hasReferenceModelBackend: false,
      backendName: null,
      posteriorUncertaintyAvailable: false,
      payloadAllowed: true,
    });
    expect(boundary.assumptionIds).toEqual(expect.arrayContaining([
      'multio.deterministic_demo_only',
      'multio.no_reference_model',
      'multio.no_bayesian_gp_posterior',
      'multio.not_mofa_plus',
      'multio.not_vae',
      'multio.deterministic_no_uncertainty',
    ]));
    expect(boundary.formalClaimSurfacesBlocked).toEqual([
      'export',
      'recommendation',
      'protocol',
      'external-handoff',
    ]);
    expect(isMultiOFormalModelSurfaceBlocked('payload')).toBe(false);
    expect(isMultiOFormalModelSurfaceBlocked('export')).toBe(true);
    expect(isMultiOFormalModelSurfaceBlocked('recommendation')).toBe(true);
    expect(isMultiOFormalModelSurfaceBlocked('protocol')).toBe(true);
    expect(isMultiOFormalModelSurfaceBlocked('external-handoff')).toBe(true);
  });

  it('keeps MultiO validity demo and declares model/backend/uncertainty limitations', () => {
    const assumptions = TOOL_ASSUMPTIONS.multio;
    const assumptionById = new Map(assumptions.map((assumption) => [assumption.id, assumption]));
    const registryEntry = TOOL_DEFINITIONS.find((tool) => tool.id === 'multio');

    expect(TOOL_VALIDITY.multio.level).toBe('demo');
    expect(TOOL_VALIDITY.multio.caption).toContain('Deterministic demo integration only');
    expect(TOOL_VALIDITY.multio.caption).toContain('No Bayesian');
    expect(TOOL_VALIDITY.multio.caption).toContain('reference-model backend');
    expect(registryEntry?.tags).not.toContain('vae');
    expect(registryEntry?.tags).toContain('deterministic');
    expect(assumptionById.get('multio.deterministic_demo_only')).toMatchObject({
      severity: 'blocking',
      toolId: 'multio',
    });
    expect(assumptionById.get('multio.no_reference_model')).toMatchObject({
      severity: 'blocking',
      toolId: 'multio',
    });
    expect(assumptionById.get('multio.no_bayesian_gp_posterior')).toMatchObject({
      severity: 'blocking',
      toolId: 'multio',
    });
    expect(assumptionById.get('multio.deterministic_no_uncertainty')).toMatchObject({
      severity: 'blocking',
      toolId: 'multio',
    });
  });

  it('keeps demo MultiO off formal claim surfaces through policy tiers and rationales', () => {
    const payloadPolicy = getClaimSurfacePolicy('multio', 'payload');
    const exportPolicy = getClaimSurfacePolicy('multio', 'export');
    const recommendationPolicy = getClaimSurfacePolicy('multio', 'recommendation');
    const protocolPolicy = getClaimSurfacePolicy('multio', 'protocol');
    const handoffPolicy = getClaimSurfacePolicy('multio', 'external-handoff');

    expect(payloadPolicy?.allowedTiers).toContain('demo');
    expect(payloadPolicy?.rationale).toContain('exploratory deterministic integration');
    expect(exportPolicy?.allowedTiers).not.toContain('demo');
    expect(exportPolicy?.rationale).toContain('formal multi-omics inference');
    expect(recommendationPolicy?.allowedTiers).not.toContain('demo');
    expect(recommendationPolicy?.rationale).toContain('lacks posterior uncertainty');
    expect(protocolPolicy?.allowedTiers).not.toContain('demo');
    expect(protocolPolicy?.blockCode).toBe('DEMO_OUTPUT_PROTOCOL_BLOCKED');
    expect(protocolPolicy?.rationale).toContain('no Bayesian/GP/MOFA/VAE backend');
    expect(handoffPolicy?.allowedTiers).not.toContain('demo');
    expect(handoffPolicy?.blockCode).toBe('EXTERNAL_HANDOFF_BLOCKED');
    expect(handoffPolicy?.rationale).toContain('local deterministic projections');
  });

  it('keeps MultiO benchmark cases blocked or demo-only rather than ok on formal claims', () => {
    const cases = loadBenchmarkCases();
    const labels = loadExpectedLabels();
    const labelsById = new Map(labels.map((label) => [label.caseId, label]));

    for (const caseId of ['TRB-045', 'TRB-059', 'TRB-060', 'TRB-061']) {
      const testCase = cases.find((item) => item.caseId === caseId);
      const label = labelsById.get(caseId);

      expect(testCase?.toolId).toBe('multio');
      expect(testCase?.expected.status).not.toBe('ok');
      expect(label?.expectedStatus).not.toBe('ok');
    }

    expect(cases.find((item) => item.caseId === 'TRB-045')?.riskTags)
      .toContain('demo-multio-external-handoff');
    expect(cases.find((item) => item.caseId === 'TRB-059')?.riskTags)
      .toContain('multio-demo-bayesian-claim');
    expect(cases.find((item) => item.caseId === 'TRB-060')?.riskTags)
      .toContain('missing-posterior-uncertainty');
    expect(cases.find((item) => item.caseId === 'TRB-061')?.riskTags)
      .toContain('reference-model-unavailable');
    expect(labelsById.get('TRB-060')?.expectedBlockCode).toBe('DEMO_OUTPUT_PROTOCOL_BLOCKED');
  });

  it('does not present current MultiO as Bayesian, MOFA-like, VAE-like, GP-backed, or reference-model-backed', () => {
    const multioPage = readRepoFile('src/components/tools/MultiOPage.tsx');
    const registry = readRepoFile('src/components/tools/shared/toolRegistry.ts');
    const validity = readRepoFile('src/components/tools/shared/toolValidity.ts');
    const readme = readRepoFile('README.md');

    expect(multioPage).toContain('Deterministic Multi-Omics Integration');
    expect(multioPage).toContain('sensitivity sketches');
    expect(registry).toContain('Demo multi-omics integration');
    expect(validity).toContain('Deterministic demo integration only');
    expect(readme).toContain('sensitivity sketches');

    const userFacingText = `${multioPage}\n${registry}\n${readme}`;
    expect(userFacingText).not.toContain('Biological Foundation Model');
    expect(userFacingText).not.toContain('Softmax(QK');
    expect(userFacingText).not.toContain('Perturbation predicts');
    expect(userFacingText).not.toContain('intervention hypotheses');
    expect(registry).not.toContain("'vae'");
    expect(readme).not.toContain('perturbation prediction');
  });
});
