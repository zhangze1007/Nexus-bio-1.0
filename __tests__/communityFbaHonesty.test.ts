/** @jest-environment node */
import fs from 'fs';
import path from 'path';
import { TOOL_ASSUMPTIONS } from '../src/components/tools/shared/toolAssumptions';
import { TOOL_VALIDITY } from '../src/components/tools/shared/toolValidity';
import {
  COMMUNITY_FBA_ROUTE_DECISION,
  FBASIM_COMMUNITY_BOUNDARY,
  getFbaModeBoundary,
  isCommunityFbaFormalSurfaceBlocked,
} from '../src/domain/communityFbaBoundary';
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

describe('community FBA honesty boundary', () => {
  it('documents the current implementation, route options, recommendation, rollback, and non-claims', () => {
    const memo = readRepoFile('docs/decision-community-fba.md');

    expect(memo).toContain('## Current Implementation Status');
    expect(memo).toContain('| A. Full joint community LP |');
    expect(memo).toContain('| B. Demo-only illustrative mode |');
    expect(memo).toContain('| C. Remove formal community mode |');
    expect(memo).toContain('## Final Step 9A Recommendation');
    expect(memo).toContain('Recommend B now.');
    expect(memo).toContain('## Step 9B Implementation');
    expect(memo).toContain('Step 9B implements Route B as the current product boundary');
    expect(memo).toContain('## Rollback Condition');
    expect(memo).toContain('## Non-Claims');
    expect(memo).toContain('No true community FBA claim unless a joint LP exists.');
    expect(memo).toContain('No formal protocol or external-handoff claim from demo community output.');
  });

  it('records the Step 9B mode-specific boundary without downgrading single-species fbasim', () => {
    const singleBoundary = getFbaModeBoundary('single');
    const communityBoundary = getFbaModeBoundary('community');

    expect(COMMUNITY_FBA_ROUTE_DECISION).toBe('demo-only-illustrative-mode');
    expect(singleBoundary).toMatchObject({
      mode: 'single',
      status: 'supported-single-species-lp',
      toolId: 'fbasim',
      validityTier: 'partial',
      payloadAllowed: true,
    });
    expect(singleBoundary.formalClaimSurfacesBlocked).toHaveLength(0);

    expect(communityBoundary).toBe(FBASIM_COMMUNITY_BOUNDARY);
    expect(communityBoundary).toMatchObject({
      mode: 'community',
      status: 'demo-only-illustrative',
      toolId: 'fbasim-community',
      validityTier: 'demo',
      payloadAllowed: true,
    });
    expect(communityBoundary.assumptionIds).toContain('fbasim-community.community_not_joint_lp');
    expect(communityBoundary.formalClaimSurfacesBlocked).toEqual([
      'recommendation',
      'protocol',
      'external-handoff',
    ]);
    expect(isCommunityFbaFormalSurfaceBlocked('payload')).toBe(false);
    expect(isCommunityFbaFormalSurfaceBlocked('export')).toBe(false);
    expect(isCommunityFbaFormalSurfaceBlocked('recommendation')).toBe(true);
    expect(isCommunityFbaFormalSurfaceBlocked('protocol')).toBe(true);
    expect(isCommunityFbaFormalSurfaceBlocked('external-handoff')).toBe(true);
  });

  it('keeps fbasim-community assumptions demo-only and blocking for non-joint community LP claims', () => {
    const communityAssumptions = TOOL_ASSUMPTIONS['fbasim-community'];
    const notJointAssumption = communityAssumptions.find((assumption) =>
      assumption.id === 'fbasim-community.community_not_joint_lp',
    );

    expect(notJointAssumption).toBeDefined();
    expect(notJointAssumption).toMatchObject({
      severity: 'blocking',
      toolId: 'fbasim-community',
    });
    expect(notJointAssumption?.statement.toLowerCase()).toContain('not a joint community lp');
  });

  it('keeps parent fbasim partial while separating single-species LP from Two-Species demo mode', () => {
    expect(TOOL_VALIDITY.fbasim.level).toBe('partial');
    expect(TOOL_VALIDITY.fbasim.caption).toContain('Single-species FBA uses a real two-phase simplex LP');
    expect(TOOL_VALIDITY.fbasim.caption).toContain('Two-Species mode runs two independent LPs');
    expect(TOOL_VALIDITY.fbasim.caption).toContain('NOT a joint community LP');
  });

  it('keeps demo community outputs off formal claim surfaces via fbasim policy tiers', () => {
    const protocolPolicy = getClaimSurfacePolicy('fbasim', 'protocol');
    const handoffPolicy = getClaimSurfacePolicy('fbasim', 'external-handoff');
    const recommendationPolicy = getClaimSurfacePolicy('fbasim', 'recommendation');

    expect(protocolPolicy?.allowedTiers).not.toContain('demo');
    expect(protocolPolicy?.blockCode).toBe('DEMO_OUTPUT_PROTOCOL_BLOCKED');
    expect(handoffPolicy?.allowedTiers).not.toContain('demo');
    expect(handoffPolicy?.blockCode).toBe('EXTERNAL_HANDOFF_BLOCKED');
    expect(recommendationPolicy?.allowedTiers).not.toContain('demo');
  });

  it('keeps community demo benchmark cases blocked on formal recommendation surfaces', () => {
    const cases = loadBenchmarkCases();
    const labels = loadExpectedLabels();
    const communityCase = cases.find((testCase) => testCase.caseId === 'TRB-041');
    const communityLabel = labels.find((label) => label.caseId === 'TRB-041');
    const unsafeDemoCase = cases.find((testCase) => testCase.caseId === 'TRB-015');
    const unsafeDemoLabel = labels.find((label) => label.caseId === 'TRB-015');

    expect(communityCase).toMatchObject({
      category: 'known-bad-case',
      toolId: 'fbasim',
      surface: 'recommendation',
      knownBad: true,
    });
    expect(communityCase?.riskTags).toContain('community-fba-fake-exchange');
    expect(communityCase?.expected.status).not.toBe('ok');
    expect(communityLabel?.expectedStatus).not.toBe('ok');
    expect(communityLabel?.expectedStatus).toBe('blocked');
    expect(unsafeDemoCase).toMatchObject({
      category: 'unsafe-demo',
      toolId: 'fbasim',
      surface: 'recommendation',
    });
    expect(unsafeDemoCase?.riskTags).toContain('community-fba');
    expect(unsafeDemoCase?.expected.status).not.toBe('ok');
    expect(unsafeDemoLabel?.expectedStatus).toBe('blocked');
  });

  it('softens user-facing and source wording that previously implied real community FBA', () => {
    const readme = readRepoFile('README.md');
    const mockFba = readRepoFile('src/data/mockFBA.ts');
    const fbaPage = readRepoFile('src/components/tools/FBASimPage.tsx');

    expect(readme).not.toContain('single-species + community FBA');
    expect(readme).not.toContain('single-species and community FBA');
    expect(readme).toContain('single-species simplex LP plus illustrative two-species demo mode');
    expect(readme).toContain('single-species FBA plus demo-only two-species comparison');
    expect(mockFba).toContain('Illustrative two-species demo.');
    expect(mockFba).toContain('This is not a joint community LP.');
    expect(mockFba).not.toContain('Composite stoichiometric model S_com');
    expect(fbaPage).toContain('Two-Species Demo');
    expect(fbaPage).toContain('Demo Biomass Blend');
    expect(fbaPage).not.toContain('Two-Species Flux Comparison');
    expect(fbaPage).not.toContain('Community Biomass Objective');
  });
});
