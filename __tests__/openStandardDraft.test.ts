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

describe('SITR open standard draft', () => {
  it('contains the SITR draft with required sections', () => {
    const draft = read('spec/SITR-draft-v1.md');
    const requiredSections = [
      '## Status of This Draft',
      '## Abstract',
      '## Motivation',
      '## Terminology',
      '## Required Objects',
      '## Claim Surfaces',
      '## Gate Semantics',
      '## Policy Language',
      '## Provenance',
      '## Biological Design Artifacts',
      '## Conformance',
      '## Security and Misuse Considerations',
      '## Limitations',
      '## Examples',
      '## Change Control',
    ];

    for (const section of requiredSections) {
      expect(draft).toContain(section);
    }
  });

  it('documents draft status and avoids validation overclaims', () => {
    const draft = read('spec/SITR-draft-v1.md');

    expect(draft).toContain('not an official standard');
    expect(draft).toContain('has not been externally ratified');
    expect(draft).toContain('No external validation is claimed');
    expect(draft).toContain('No wet-lab validation');
    expect(draft).toContain('not fully SBOL-compliant');
    expect(draft).not.toMatch(/\bis wet-lab validated\b/i);
    expect(draft).not.toMatch(/\bscientifically validated\b/i);
    expect(draft).not.toMatch(/\bthird-party validated\b/i);
    expect(draft).not.toMatch(/\bhas full SBOL compliance\b/i);
  });

  it('references supporting specs and implementation artifacts', () => {
    const draft = read('spec/SITR-draft-v1.md');

    for (const reference of [
      'spec/policy-dsl-v1.md',
      'spec/prov-dm-mapping.md',
      'spec/sbol-3-mapping.md',
      'proof-package/README.md',
      'proof-package/manifest.json',
      'reference_impl_py/README.md',
      'reports/second-implementation-consistency.json',
      'docs/second-implementation.md',
    ]) {
      expect(draft).toContain(reference);
    }
  });

  it('contains conformance levels and route decision docs', () => {
    const levels = read('docs/sitr-conformance-levels.md');
    const decision = read('docs/decision-open-standard-route.md');
    const checklist = read('docs/sitr-conformance-checklist.md');

    for (const level of [
      '## Level 0 - Object Parse',
      '## Level 1 - Policy Evaluation',
      '## Level 2 - Provenance-Linked Decisions',
      '## Level 3 - Benchmark Runner',
      '## Level 4 - External Review Ready',
      '## Level 5 - Cross-Domain Extension',
    ]) {
      expect(levels).toContain(level);
    }

    expect(decision).toContain('Moonshot');
    expect(decision).toContain('Generalist');
    expect(decision).toContain('Niche');
    expect(decision).toContain('selects the **Moonshot route');
    expect(checklist).toContain('## Object Parsing');
    expect(checklist).toContain('## External Review Workflow');
  });

  it('adds issue templates for open draft governance', () => {
    const templates = [
      '.github/ISSUE_TEMPLATE/policy-disagreement.yml',
      '.github/ISSUE_TEMPLATE/conformance-failure.yml',
      '.github/ISSUE_TEMPLATE/domain-extension.yml',
    ];

    for (const templatePath of templates) {
      const template = read(templatePath);
      expect(template).toContain('caseId');
      expect(template).toContain('Policy rule');
      expect(template).toContain('Claim surface');
      expect(template).toContain('Expected status');
      expect(template).toContain('Observed status');
      expect(template).toContain('Evidence/provenance');
      expect(template).toContain('Implementation language');
      expect(template).toContain('Reproduction steps');
      expect(template).toContain('Proposed fix');
    }
  });
});
