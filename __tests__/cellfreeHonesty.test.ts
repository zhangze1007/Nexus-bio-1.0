/** @jest-environment node */
import fs from 'fs';
import path from 'path';
import { TOOL_ASSUMPTIONS } from '../src/components/tools/shared/toolAssumptions';
import { TOOL_DEFINITIONS } from '../src/components/tools/shared/toolRegistry';
import { TOOL_VALIDITY } from '../src/components/tools/shared/toolValidity';
import {
  CELLFREE_PARAMETER_BOUNDARY,
  CELLFREE_PARAMETER_ROUTE_DECISION,
  getCellFreeParameterBoundary,
  isCellFreeFormalParameterSurfaceBlocked,
} from '../src/domain/cellfreeParameterBoundary';
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

function tableRows(markdown: string): string[] {
  return markdown
    .split(/\r?\n/)
    .filter((line) => line.startsWith('|') && !line.includes('---'));
}

describe('CellFree model structure and parameter sourcing honesty boundary', () => {
  it('documents the current implementation, route table, Route A recommendation, and non-claims', () => {
    const memo = readRepoFile('docs/cellfree-reality-audit.md');

    expect(memo).toContain('## Current Implementation Status');
    expect(memo).toContain('| A. Structure implemented, parameters partial |');
    expect(memo).toContain('| B. Demo-only model |');
    expect(memo).toContain('| C. Stronger sourced/calibrated model |');
    expect(memo).toContain('## Final Step 12 Recommendation');
    expect(memo).toContain('Recommend Route A now.');
    expect(memo).toContain('No fully sourced parameter claim unless every required source exists.');
    expect(memo).toContain('No calibration claim unless calibration evidence exists.');
    expect(memo).toContain('No wet-lab validation claim unless evidence exists.');
  });

  it('records a parameter pack without marking repo defaults or heuristics as cited', () => {
    const pack = readRepoFile('docs/cellfree-parameter-pack.md');
    const rows = tableRows(pack);

    expect(pack).toContain('| Parameter | Value/default | Unit | Used in code? | Source status | Source/citation | Confidence | Notes |');
    expect(rows.length).toBeGreaterThan(30);
    expect(pack).toContain('| Total ribosome pool | 500 | nM | yes | repo-default | none in repo | low |');
    expect(pack).toContain('| Energy decay rate | 0.003 | 1/min | yes | heuristic | none in repo | low |');
    expect(pack).toContain('| IvIv MLP weights | seeded RNG 12345 | not-applicable | yes | heuristic | none in repo | low |');

    const wronglyCitedDefaults = rows.filter((row) =>
      (row.includes('| repo-default |') || row.includes('| heuristic |') || row.includes('| unknown |')) &&
      row.includes('| cited |')
    );
    expect(wronglyCitedDefaults).toEqual([]);
  });

  it('separates implemented simulation structure from parameter sourcing, calibration, and uncertainty', () => {
    const boundary = getCellFreeParameterBoundary();

    expect(CELLFREE_PARAMETER_ROUTE_DECISION).toBe('structure-implemented-partial-parameters');
    expect(boundary).toBe(CELLFREE_PARAMETER_BOUNDARY);
    expect(boundary).toMatchObject({
      toolId: 'cellfree',
      status: 'structure-implemented-parameters-partial',
      validityTier: 'demo',
      hasOdeStructure: true,
      hasTxTlTerms: true,
      hasResourceTerms: true,
      hasDegradationTerms: true,
      parametersFullySourced: false,
      calibrationEstablished: false,
      uncertaintyQuantified: false,
      payloadAllowed: true,
    });
    expect(boundary.implementedModelComponents).toEqual(expect.arrayContaining([
      'resource-aware TX-TL ODE structure',
      'transcription and mRNA degradation terms',
      'ribosome-limited translation terms',
    ]));
    expect(boundary.missingEvidence).toEqual(expect.arrayContaining([
      'per-parameter source table for all defaults',
      'extract-specific calibration dataset',
      'parameter uncertainty model',
    ]));
    expect(isCellFreeFormalParameterSurfaceBlocked('payload')).toBe(false);
    expect(isCellFreeFormalParameterSurfaceBlocked('export')).toBe(true);
    expect(isCellFreeFormalParameterSurfaceBlocked('recommendation')).toBe(true);
    expect(isCellFreeFormalParameterSurfaceBlocked('protocol')).toBe(true);
    expect(isCellFreeFormalParameterSurfaceBlocked('external-handoff')).toBe(true);
  });

  it('keeps CellFree demo tier while declaring model, parameter, calibration, and uncertainty boundaries', () => {
    const assumptions = TOOL_ASSUMPTIONS.cellfree;
    const assumptionById = new Map(assumptions.map((assumption) => [assumption.id, assumption]));
    const registryEntry = TOOL_DEFINITIONS.find((tool) => tool.id === 'cellfree');

    expect(TOOL_VALIDITY.cellfree.level).toBe('demo');
    expect(TOOL_VALIDITY.cellfree.caption).toContain('Resource-aware TX-TL ODE structure exists');
    expect(TOOL_VALIDITY.cellfree.caption).toContain('calibration');
    expect(TOOL_VALIDITY.cellfree.caption).toContain('uncertainty');
    expect(registryEntry?.summary).toContain('parameter-sourcing limits');
    expect(registryEntry?.focus).toContain('heuristic IVIV estimates');

    expect(assumptionById.get('cellfree.model_structure_implemented')).toMatchObject({
      severity: 'info',
      toolId: 'cellfree',
    });
    expect(assumptionById.get('cellfree.parameters_partially_sourced')).toMatchObject({
      severity: 'blocking',
      toolId: 'cellfree',
    });
    expect(assumptionById.get('cellfree.calibration_not_established')).toMatchObject({
      severity: 'blocking',
      toolId: 'cellfree',
    });
    expect(assumptionById.get('cellfree.uncertainty_not_quantified')).toMatchObject({
      severity: 'blocking',
      toolId: 'cellfree',
    });
    expect(assumptionById.get('cellfree.parameters_unsourced')).toBeDefined();
    expect(assumptionById.get('cellfree.tx_tl_kinetics_ref')).toBeDefined();
  });

  it('keeps demo CellFree off formal claim surfaces through policy tiers and rationales', () => {
    const payloadPolicy = getClaimSurfacePolicy('cellfree', 'payload');
    const exportPolicy = getClaimSurfacePolicy('cellfree', 'export');
    const recommendationPolicy = getClaimSurfacePolicy('cellfree', 'recommendation');
    const protocolPolicy = getClaimSurfacePolicy('cellfree', 'protocol');
    const handoffPolicy = getClaimSurfacePolicy('cellfree', 'external-handoff');

    expect(payloadPolicy?.allowedTiers).toContain('demo');
    expect(payloadPolicy?.rationale).toContain('implemented TX-TL simulation structure');
    expect(exportPolicy?.allowedTiers).not.toContain('demo');
    expect(exportPolicy?.rationale).toContain('not fully sourced or calibrated');
    expect(recommendationPolicy?.allowedTiers).not.toContain('demo');
    expect(recommendationPolicy?.rationale).toContain('uncertainty is not quantified');
    expect(protocolPolicy?.allowedTiers).not.toContain('demo');
    expect(protocolPolicy?.blockCode).toBe('DEMO_OUTPUT_PROTOCOL_BLOCKED');
    expect(protocolPolicy?.rationale).toContain('implemented ODE structure alone');
    expect(handoffPolicy?.allowedTiers).not.toContain('demo');
    expect(handoffPolicy?.blockCode).toBe('EXTERNAL_HANDOFF_BLOCKED');
    expect(handoffPolicy?.rationale).toContain('incomplete parameter provenance');
  });

  it('keeps CellFree benchmark cases blocked or demo-only rather than ok on formal claims', () => {
    const cases = loadBenchmarkCases();
    const labels = loadExpectedLabels();
    const labelsById = new Map(labels.map((label) => [label.caseId, label]));

    for (const caseId of ['TRB-013', 'TRB-047', 'TRB-062', 'TRB-063', 'TRB-064']) {
      const testCase = cases.find((item) => item.caseId === caseId);
      const label = labelsById.get(caseId);

      expect(testCase?.toolId).toBe('cellfree');
      expect(label).toBeDefined();
      if (testCase?.surface !== 'payload') {
        expect(testCase?.expected.status).not.toBe('ok');
        expect(label?.expectedStatus).not.toBe('ok');
      }
    }

    expect(cases.find((item) => item.caseId === 'TRB-047')?.riskTags)
      .toContain('demo-cellfree-protocol-artifact');
    expect(cases.find((item) => item.caseId === 'TRB-062')?.riskTags)
      .toContain('missing-parameter-provenance');
    expect(cases.find((item) => item.caseId === 'TRB-063')?.riskTags)
      .toContain('cellfree-uncertainty-not-quantified');
    expect(labelsById.get('TRB-062')?.expectedBlockCode).toBe('EXTERNAL_HANDOFF_BLOCKED');
    expect(labelsById.get('TRB-063')?.expectedStatus).toBe('blocked');
    expect(labelsById.get('TRB-064')?.expectedStatus).toBe('demoOnly');
  });

  it('does not present current CellFree as fully sourced, calibrated, or wet-lab validated', () => {
    const cellfreePage = readRepoFile('src/components/tools/CellFreePage.tsx');
    const registry = readRepoFile('src/components/tools/shared/toolRegistry.ts');
    const validity = readRepoFile('src/components/tools/shared/toolValidity.ts');
    const workflowRegistry = readRepoFile('src/services/workflowRegistry.ts');
    const readme = readRepoFile('README.md');

    expect(cellfreePage).toContain('heuristic in-vitro-to-in-vivo estimate');
    expect(registry).toContain('parameter-sourcing limits');
    expect(validity).toContain('Resource-aware TX-TL ODE structure exists');
    expect(workflowRegistry).toContain('parameter sourcing, calibration, and uncertainty remain incomplete');
    expect(readme).toContain('heuristic expression estimates');

    const userFacingText = `${cellfreePage}\n${registry}\n${validity}\n${workflowRegistry}\n${readme}`;
    expect(userFacingText).not.toContain('fully sourced parameter set');
    expect(userFacingText).not.toContain('calibrated TX-TL model');
    expect(userFacingText).not.toContain('experimentally validated protocol');
    expect(userFacingText).not.toContain('production-grade CFPS prediction');
    expect(userFacingText).not.toContain('wet-lab validated');
    expect(userFacingText).not.toContain('no live TXTL kinetic model');
  });
});
