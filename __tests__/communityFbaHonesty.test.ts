/** @jest-environment node */
import fs from 'fs';
import path from 'path';
import { TOOL_ASSUMPTIONS } from '../src/config/toolAssumptions';
import { TOOL_VALIDITY } from '../src/config/toolValidity';
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
    expect(memo).toContain('Step 9B implements Route A (joint community LP)');
    expect(memo).toContain('## Rollback Condition');
    expect(memo).toContain('## Non-Claims');
    expect(memo).toContain('No formal external-handoff claim from community output.');
  });

  it('records the Step 9B mode-specific boundary without downgrading single-species fbasim', () => {
    const singleBoundary = getFbaModeBoundary('single');
    const communityBoundary = getFbaModeBoundary('community');

    expect(COMMUNITY_FBA_ROUTE_DECISION).toBe('joint-community-lp');
    expect(singleBoundary).toMatchObject({
      mode: 'single',
      status: 'supported-single-species-lp',
      toolId: 'fbasim',
      validityTier: 'real',
      payloadAllowed: true,
    });
    expect(singleBoundary.formalClaimSurfacesBlocked).toHaveLength(0);

    expect(communityBoundary).toBe(FBASIM_COMMUNITY_BOUNDARY);
    expect(communityBoundary).toMatchObject({
      mode: 'community',
      status: 'supported-joint-community-lp',
      toolId: 'fbasim-community',
      validityTier: 'partial',
      payloadAllowed: true,
    });
    expect(communityBoundary.assumptionIds).toContain('fbasim-community.two_independent_lps');
    expect(communityBoundary.formalClaimSurfacesBlocked).toEqual([]);
    expect(isCommunityFbaFormalSurfaceBlocked('payload')).toBe(false);
    expect(isCommunityFbaFormalSurfaceBlocked('export')).toBe(false);
    expect(isCommunityFbaFormalSurfaceBlocked('recommendation')).toBe(false);
    expect(isCommunityFbaFormalSurfaceBlocked('protocol')).toBe(false);
    expect(isCommunityFbaFormalSurfaceBlocked('external-handoff')).toBe(false);
  });

  it('keeps fbasim-community assumptions honest about independent LP limitations', () => {
    const communityAssumptions = TOOL_ASSUMPTIONS['fbasim-community'];
    const independentLpAssumption = communityAssumptions.find((assumption) =>
      assumption.id === 'fbasim-community.two_independent_lps',
    );

    expect(independentLpAssumption).toBeDefined();
    expect(independentLpAssumption).toMatchObject({
      severity: 'info',
      toolId: 'fbasim-community',
    });
    expect(independentLpAssumption?.statement.toLowerCase()).toContain('independent');
  });

  it('fbasim is real with honest community mode description', () => {
    expect(TOOL_VALIDITY.fbasim.level).toBe('real');
    expect(TOOL_VALIDITY.fbasim.caption).toContain('two-phase simplex LP');
    expect(TOOL_VALIDITY.fbasim.caption).toContain('independent LPs');
    expect(TOOL_VALIDITY.fbasim.caption).toContain('NOT a joint LP');
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

  it('uses honest wording for community FBA joint LP mode', () => {
    const readme = readRepoFile('README.md');
    const mockFba = readRepoFile('src/data/mockFBA.ts');
    const fbaPage = readRepoFile('src/components/tools/FBASimPage.tsx');

    expect(readme).toContain('joint community LP');
    expect(readme).toContain('shared exchange metabolite pools');
    expect(mockFba).toContain('Illustrative two-species demo.');
    expect(mockFba).toContain('This is not a joint community LP.');
    expect(fbaPage).toContain('Joint Community LP');
    expect(fbaPage).toContain('Community Biomass');
    expect(fbaPage).not.toContain('Two-Species Flux Comparison');
  });
});
