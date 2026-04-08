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
});
