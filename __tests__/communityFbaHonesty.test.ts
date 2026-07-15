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
    expect(communityBoundary.assumptionIds).toContain('fbasim-community.joint_steadycom_lp');
    expect(communityBoundary.formalClaimSurfacesBlocked).toEqual([]);
    expect(isCommunityFbaFormalSurfaceBlocked('payload')).toBe(false);
    expect(isCommunityFbaFormalSurfaceBlocked('export')).toBe(false);
    expect(isCommunityFbaFormalSurfaceBlocked('recommendation')).toBe(false);
    expect(isCommunityFbaFormalSurfaceBlocked('protocol')).toBe(false);
    expect(isCommunityFbaFormalSurfaceBlocked('external-handoff')).toBe(false);
  });

  it('keeps fbasim-community assumptions honest about the real joint SteadyCom LP', () => {
    const communityAssumptions = TOOL_ASSUMPTIONS['fbasim-community'];
    const jointLpAssumption = communityAssumptions.find((assumption) =>
      assumption.id === 'fbasim-community.joint_steadycom_lp',
    );

    expect(jointLpAssumption).toBeDefined();
    expect(jointLpAssumption).toMatchObject({
      severity: 'info',
      toolId: 'fbasim-community',
    });
    expect(jointLpAssumption?.statement.toLowerCase()).toContain('joint');
    expect(jointLpAssumption?.statement.toLowerCase()).toContain('steadycom');

    // The curated-model-scale caveat must be present (method real, numbers illustrative).
    const scaleCaveat = communityAssumptions.find((a) => a.id === 'fbasim-community.curated_model_scale');
    expect(scaleCaveat?.statement.toLowerCase()).toContain('illustrative');

    // No 'blocking' assumptions remain: community FBA is partial (a real joint LP),
    // not a demo fallback.
    expect(communityAssumptions.every((a) => a.severity !== 'blocking')).toBe(true);
    // The old dishonest tags must not appear in the canonical sub-tier registry.
    const ids = communityAssumptions.map((a) => a.id);
    expect(ids).not.toContain('fbasim-community.two_independent_lps');
    expect(ids).not.toContain('fbasim-community.community_not_joint_lp');
  });

  it('fbasim is real with an honest joint-SteadyCom community mode description', () => {
    expect(TOOL_VALIDITY.fbasim.level).toBe('real');
    // Single-species E. coli names the real model and its external verification.
    expect(TOOL_VALIDITY.fbasim.caption).toContain('e_coli_core');
    expect(TOOL_VALIDITY.fbasim.caption).toContain('COBRApy-verified');
    // Yeast's simplified status is disclosed, not hidden.
    expect(TOOL_VALIDITY.fbasim.caption.toLowerCase()).toContain('illustrative');
    expect(TOOL_VALIDITY.fbasim.caption).toContain('SteadyCom joint LP');
    // Must NOT carry the old, now-false claims.
    expect(TOOL_VALIDITY.fbasim.caption).not.toContain('two independent LPs');
    expect(TOOL_VALIDITY.fbasim.caption).not.toContain('NOT a joint LP');
    // The single-species solver is e_coli_core, NOT the 2583-reaction genome-scale
    // iJO1366 the badge used to falsely claim.
    expect(TOOL_VALIDITY.fbasim.caption).not.toContain('2583');
    expect(TOOL_VALIDITY.fbasim.caption).not.toContain('genome-scale model');
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
    // mockFBA no longer contains the old heuristic; it documents the real SteadyCom path.
    expect(mockFba).toContain('real SteadyCom joint LP');
    expect(mockFba).not.toContain('export function calculateCommunityFlux');
    expect(mockFba).not.toContain('This is not a joint community LP.');
    expect(fbaPage).toContain('Joint Community LP');
    expect(fbaPage).toContain('Community Biomass');
    expect(fbaPage).not.toContain('Two-Species Flux Comparison');
  });
});

describe('community FBA anti-fabrication guards', () => {
  it('solveAuthorityCommunityFBA source contains no magic cross-feeding constants', () => {
    const src = readRepoFile('src/server/fbaEngine.ts');
    const start = src.indexOf('export async function solveAuthorityCommunityFBA');
    expect(start).toBeGreaterThan(-1);
    // Bound the slice to the community function body (up to the next top-level
    // export) so unrelated code cannot mask a regression here.
    const rest = src.slice(start + 'export async function solveAuthorityCommunityFBA'.length);
    const nextExport = rest.indexOf('\nexport ');
    const body = nextExport === -1 ? rest : rest.slice(0, nextExport);

    // The old post-hoc-blend heuristic used these magic scalars — none may reappear.
    expect(body).not.toMatch(/0\.018|\* 1\.6|\* 2\.4|\* 1\.4/);
    expect(body).not.toContain('MOCK_DATA');
    expect(body).not.toContain('SHARED_METABOLITES');
    // Positive assertion: it genuinely calls the joint SteadyCom engine.
    expect(body).toContain('steadyCom(');
    expect(body).toContain('buildCommunityModel(');
  });

  it('syntrophy: a species with no carbon grows only via community cross-feeding', async () => {
    const { buildCommunityModel } = await import('../src/data/communityModel');
    const { steadyCom } = await import('../src/server/fbaSteadyCom');
    // E. coli gets zero glucose; it can only grow on yeast-secreted ethanol.
    const m = buildCommunityModel({ ecoli: { glucoseUptake: 0 }, yeast: { glucoseUptake: 10 } });
    const res = await steadyCom(m.species, m.sharedMetabolites);
    expect(res.status).toBe('optimal');
    expect(res.speciesGrowthRates.ecoli).toBeGreaterThan(0); // grows on cross-fed ethanol
    // The growth is genuinely fed by yeast's ethanol secretion (closed pool: secretion == uptake).
    const ethanolSecretion = res.speciesFluxes.yeast.EX_etoh;
    const ethanolUptake = res.speciesFluxes.ecoli.UP_etoh;
    expect(ethanolSecretion).toBeGreaterThan(1e-4);
    expect(ethanolSecretion).toBeCloseTo(ethanolUptake, 4);
  });
});
