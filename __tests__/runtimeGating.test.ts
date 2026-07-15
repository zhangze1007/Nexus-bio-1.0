import { canPassToDownstream, collectBlockingAssumptions } from '../src/utils/runtimeGating';
import type { ProvenanceEntry } from '../src/types/assumptions';

function payload(args: {
  toolId: string;
  validity: 'real' | 'partial' | 'demo';
  outputAssumptions?: string[];
  includeProvenance?: boolean;
}) {
  const provenance: ProvenanceEntry | undefined = args.includeProvenance === false
    ? undefined
    : {
        toolId: args.toolId,
        timestamp: 1,
        inputAssumptions: [],
        outputAssumptions: args.outputAssumptions ?? [],
        evidence: [],
        validityTier: args.validity,
        upstreamProvenance: [],
      };

  return {
    toolId: args.toolId,
    validity: args.validity,
    runProvenance: provenance,
  };
}

describe('runtime gating', () => {
  it('blocks demo source into partial target', () => {
    const decision = canPassToDownstream(payload({ toolId: 'cethx', validity: 'demo' }), 'catdes');
    expect(decision.allowed).toBe(false);
    expect(decision.severity).toBe('block');
  });

  it('blocks demo source into real target', () => {
    const decision = canPassToDownstream(payload({ toolId: 'cethx', validity: 'demo' }), 'cellfree');
    expect(decision.allowed).toBe(false);
    expect(decision.severity).toBe('block');
    expect(decision.reason).toContain('Demo output cannot feed');
  });

  it('allows partial source into partial target when no blocking assumptions are present', () => {
    const decision = canPassToDownstream(
      payload({
        toolId: 'fbasim-single',
        validity: 'partial',
        outputAssumptions: ['fbasim-single.steady_state'],
      }),
      'catdes',
    );
    expect(decision.allowed).toBe(true);
    expect(decision.severity).not.toBe('block');
  });

  it('allows partial source into real target when no blocking assumptions are present', () => {
    const decision = canPassToDownstream(
      payload({
        toolId: 'fbasim-single',
        validity: 'partial',
        outputAssumptions: ['fbasim-single.steady_state'],
      }),
      'nexai',
    );
    expect(decision.allowed).toBe(true);
    expect(decision.severity).not.toBe('block');
  });

  it('blocks payloads missing runProvenance', () => {
    const decision = canPassToDownstream(
      payload({ toolId: 'pathd', validity: 'partial', includeProvenance: false }),
      'fbasim',
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('no runProvenance');
  });

  it('blocks a payload carrying a blocking assumption into partial or real targets', () => {
    // Uses a real blocking-severity assumption id from the registry. (Community FBA is
    // now a real joint SteadyCom LP and no longer carries a blocking assumption, so this
    // generic gating behavior is exercised with a still-blocking cellfree assumption.)
    const source = payload({
      toolId: 'cellfree',
      validity: 'demo',
      outputAssumptions: ['cellfree.parameters_unsourced'],
    });
    const decision = canPassToDownstream(source, 'catdes');
    expect(decision.allowed).toBe(false);
    expect(decision.severity).toBe('block');
    expect(collectBlockingAssumptions(source)).toEqual(['cellfree.parameters_unsourced']);
  });

  it('allows fbasim-single partial payload into compatible partial target', () => {
    const decision = canPassToDownstream(
      payload({
        toolId: 'fbasim-single',
        validity: 'partial',
        outputAssumptions: [
          'fbasim-single.steady_state',
          'fbasim-single.biomass_objective',
          'fbasim-single.no_regulation',
          'fbasim-single.simplex_real',
        ],
      }),
      'catdes',
    );
    expect(decision.allowed).toBe(true);
    expect(decision.sourceValidity).toBe('partial');
    expect(decision.targetValidity).toBe('real');
  });
});
