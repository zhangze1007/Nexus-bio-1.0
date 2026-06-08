import { formatResearchAnswer } from '../src/utils/researchAnswerFormatter';

describe('formatResearchAnswer', () => {
  it('maps Axon-style structured JSON into researcher-facing sections', () => {
    const raw = JSON.stringify({
      axon_interaction: {
        question: 'Axon indicates that precursor supply is currently the limiting factor.',
        options: ['Validate tHMGR expression', 'Route the case into DYNCON'],
      },
      bottleneck_enzymes: [
        {
          enzyme: 'tHMGR',
          efficiency_percent: 42,
          yield_loss_percent: 18,
          evidence: 'Low mevalonate draw into FPP was observed.',
        },
      ],
      nodes: [
        {
          label: 'FPP',
          summary: 'Central precursor pool with high downstream sensitivity.',
        },
      ],
    });

    const formatted = formatResearchAnswer(raw);
    const titles = formatted.sections.map((section) => section.title);

    expect(titles).toEqual(expect.arrayContaining([
      'Summary',
      'Key observations',
      'Recommended next steps',
    ]));
    expect(formatted.sections[0].paragraphs[0]).toContain('precursor supply');
    expect(formatted.sections.find((section) => section.id === 'observations')?.bullets[0]).toContain('tHMGR');
    expect(formatted.sections.find((section) => section.id === 'next-steps')?.bullets).toContain('Validate tHMGR expression');
  });

  it('reformats generic JSON-like text without exposing raw keys or braces', () => {
    const raw = "```json\n{'summary':'Flux is constrained by oxygen transfer.','observations':['Biomass remains feasible','NADH pressure rises'],'recommendations':['Increase kLa','Rerun with lower glucose']}\n```";
    const formatted = formatResearchAnswer(raw);

    expect(formatted.sections.find((section) => section.id === 'summary')?.paragraphs[0]).toBe('Flux is constrained by oxygen transfer.');
    expect(formatted.sections.find((section) => section.id === 'observations')?.bullets).toEqual([
      'Biomass remains feasible',
      'NADH pressure rises',
    ]);
    expect(formatted.sections.find((section) => section.id === 'next-steps')?.bullets).toEqual([
      'Increase kLa',
      'Rerun with lower glucose',
    ]);
  });

  it('preserves headed prose and bullet markers as readable sections', () => {
    const raw = `Summary:
The pathway remains feasible, but precursor supply is narrow.

Key observations:
- HMGR carries the largest burden.
- Oxygen transfer is secondary.

Interpretation:
Carbon is being redirected before product formation.

Recommended next steps:
- Validate HMGR expression.
- Run DYNCON with lower setpoint noise.`;

    const formatted = formatResearchAnswer(raw);

    expect(formatted.sections.find((section) => section.id === 'summary')?.paragraphs).toEqual([
      'The pathway remains feasible, but precursor supply is narrow.',
    ]);
    expect(formatted.sections.find((section) => section.id === 'observations')?.bullets).toEqual([
      'HMGR carries the largest burden.',
      'Oxygen transfer is secondary.',
    ]);
    expect(formatted.sections.find((section) => section.id === 'interpretation')?.paragraphs[0]).toContain('redirected before product formation');
    expect(formatted.sections.find((section) => section.id === 'next-steps')?.bullets[1]).toContain('DYNCON');
  });

  it('returns empty sections for empty string', () => {
    const result = formatResearchAnswer('');
    expect(result.sections).toEqual([]);
  });

  it('returns empty sections for whitespace-only', () => {
    const result = formatResearchAnswer('   \n\t  ');
    expect(result.sections).toEqual([]);
  });

  it('handles numeric input as text', () => {
    const result = formatResearchAnswer('42' as any);
    expect(result.sections.length).toBeGreaterThan(0);
  });

  it('formats plain text without structure', () => {
    const result = formatResearchAnswer('This is a simple plain text answer about biology.');
    expect(result.sections.length).toBeGreaterThan(0);
  });

  it('handles JSON array input', () => {
    const json = JSON.stringify([
      { title: 'Result 1', description: 'Desc 1' },
      { title: 'Result 2', description: 'Desc 2' },
    ]);
    const result = formatResearchAnswer(json);
    expect(result.sections.length).toBeGreaterThan(0);
  });

  it('handles JSON with de_novo_design_strategies', () => {
    const json = JSON.stringify({
      de_novo_design_strategies: [{
        node_id: 'enz1',
        de_novo_design_strategy: {
          active_site_remodeling: 'Remodel pocket',
          thermal_stability_enhancement: 'Add disulfide',
          substrate_specificity_tuning: 'Narrow channel',
          predicted_impact: '+15% yield',
        },
      }],
    });
    const result = formatResearchAnswer(json);
    expect(result.sections.length).toBeGreaterThan(0);
  });

  it('handles JSON embedded in prose', () => {
    const text = 'Here is the analysis:\n' + JSON.stringify({
      summary: 'Test summary',
      results: ['A', 'B'],
    }) + '\nEnd.';
    const result = formatResearchAnswer(text);
    expect(result.sections.length).toBeGreaterThan(0);
  });

  it('handles malformed JSON', () => {
    const result = formatResearchAnswer('Not valid JSON: { broken: }');
    expect(result.sections.length).toBeGreaterThan(0);
  });

  it('handles JSON with nested objects', () => {
    const json = JSON.stringify({
      pathway: { nodes: [{ id: 'n1' }], edges: [] },
      analysis: { bottleneck: 'PFK', efficiency: 0.45 },
    });
    const result = formatResearchAnswer(json);
    expect(result.sections.length).toBeGreaterThan(0);
  });

  it('handles text with markdown headers', () => {
    const text = '# Title\n## Section 1\nContent here.\n## Section 2\nMore content.';
    const result = formatResearchAnswer(text);
    expect(result.sections.length).toBeGreaterThan(0);
  });

  it('handles text with numbered lists', () => {
    const text = 'Steps:\n1. First step\n2. Second step\n3. Third step';
    const result = formatResearchAnswer(text);
    expect(result.sections.length).toBeGreaterThan(0);
  });

  it('handles JSON with null values in arrays', () => {
    const json = JSON.stringify({
      findings: [null, 'valid finding', null],
    });
    const result = formatResearchAnswer(json);
    expect(result.sections.length).toBeGreaterThan(0);
  });

  it('handles very long text', () => {
    const text = 'word '.repeat(500);
    const result = formatResearchAnswer(text);
    expect(result.sections.length).toBeGreaterThan(0);
  });

  it('handles text with special characters', () => {
    const text = 'ΔG = -18.5 kJ/mol\npH 7.4\n[ATP] = 2.5 mM';
    const result = formatResearchAnswer(text);
    expect(result.sections.length).toBeGreaterThan(0);
  });

  it('handles text with code blocks', () => {
    const text = 'Result:\n```\n{ "key": "value" }\n```\nEnd.';
    const result = formatResearchAnswer(text);
    expect(result.sections.length).toBeGreaterThan(0);
  });

  it('handles JSON with only bottleneck_enzymes', () => {
    const json = JSON.stringify({
      bottleneck_enzymes: [{
        enzyme: 'PFK',
        efficiency_percent: 25,
        yield_loss_percent: 75,
        evidence: 'Rate limiting',
      }],
    });
    const result = formatResearchAnswer(json);
    expect(result.sections.length).toBeGreaterThan(0);
  });

  it('handles JSON with only nodes', () => {
    const json = JSON.stringify({
      nodes: [
        { label: 'G6P', summary: 'Glucose-6-phosphate' },
        { label: 'F6P', summary: 'Fructose-6-phosphate' },
      ],
    });
    const result = formatResearchAnswer(json);
    expect(result.sections.length).toBeGreaterThan(0);
  });

  it('handles JSON with only axon_interaction', () => {
    const json = JSON.stringify({
      axon_interaction: {
        question: 'Should we optimize flux?',
        options: ['FBA', 'DYNCON'],
      },
    });
    const result = formatResearchAnswer(json);
    expect(result.sections.length).toBeGreaterThan(0);
  });
});
