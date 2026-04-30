/** @jest-environment node */
import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '..');

function repoPath(relativePath: string): string {
  return path.join(repoRoot, relativePath);
}

function read(relativePath: string): string {
  return fs.readFileSync(repoPath(relativePath), 'utf8');
}

function readJson(relativePath: string): Record<string, unknown> {
  return JSON.parse(read(relativePath)) as Record<string, unknown>;
}

const requiredFiles = [
  'docs/nobel-path-scientific-question.md',
  'analysis/nobel-path-design.md',
  'analysis/nobel_path_analysis_plan.md',
  'reports/nobel-path-results.md',
  'reports/nobel-path-results.template.json',
];

describe('Nobel path study design docs', () => {
  it('creates the required not-yet-run study artifacts', () => {
    for (const relativePath of requiredFiles) {
      expect(fs.existsSync(repoPath(relativePath))).toBe(true);
      expect(read(relativePath)).toContain('not-yet-run');
    }
  });

  it('keeps the results template empty of fake numeric outcomes', () => {
    const template = readJson('reports/nobel-path-results.template.json');

    expect(template.status).toBe('not-yet-run');
    expect(template.datasetId).toBeNull();
    expect(template.runLabel).toBeNull();
    expect(template.nDesignBranches).toBeNull();
    expect(template.invalidBranchReduction).toBeNull();
    expect(template.unsafeDirectionReduction).toBeNull();
    expect(template.decisionReproducibility).toBeNull();
    expect(template.wastedIterationReduction).toBeNull();
    expect(template.rawDataPath).toBeNull();
    expect(template.confidenceIntervals).toEqual([]);
  });

  it('states non-claims and avoids completed-result language', () => {
    const combined = requiredFiles.map(read).join('\n');

    expect(combined).toContain('No wet-lab validation is claimed');
    expect(combined).toContain('No scientific validation is claimed');
    expect(combined).toContain('No statistical significance is claimed');
    expect(combined).toContain('No real scientific result exists yet');
    expect(combined).not.toMatch(/\bNobel-level result achieved\b/i);
    expect(combined).not.toMatch(/\bwet-lab validated\b/i);
    expect(combined).not.toMatch(/\bscientifically validated\b/i);
    expect(combined).not.toMatch(/\bstatistically significant\b/i);
    expect(combined).not.toMatch(/\breal experimental result\b/i);
  });

  it('documents the three comparison arms and required metrics', () => {
    const design = read('analysis/nobel-path-design.md');
    const plan = read('analysis/nobel_path_analysis_plan.md');
    const combined = `${design}\n${plan}`;

    for (const arm of ['no-gating', 'badge-only', 'runtime-gating']) {
      expect(combined).toContain(arm);
    }

    expect(combined).toContain('invalid branch reduction');
    expect(combined).toContain('unsafe direction reduction');
    expect(combined).toContain('decision reproducibility');
    expect(combined).toContain('wasted iteration reduction');
    expect(combined).toContain('false block rate');
  });

  it('does not start Step 24 artifacts', () => {
    const changedScope = requiredFiles.map(read).join('\n');

    expect(changedScope).not.toMatch(/\bleaderboard design\b/i);
    expect(changedScope).not.toMatch(/\bgovernance charter\b/i);
    expect(changedScope).not.toMatch(/\bwhitepaper\b/i);
    expect(changedScope).not.toMatch(/\bcomputing\/protocol bet\b/i);
  });
});
