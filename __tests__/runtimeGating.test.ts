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

  it('allows demo source into demo target as a warning-only demo chain', () => {
    const decision = canPassToDownstream(payload({ toolId: 'cethx', validity: 'demo' }), 'cellfree');
    expect(decision.allowed).toBe(true);
    expect(decision.severity).toBe('warn');
    expect(decision.reason).toContain('Demo-only chain');
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

  it('blocks fbasim-community blocking assumptions into partial or real targets', () => {
    const source = payload({
      toolId: 'fbasim-community',
      validity: 'demo',
      outputAssumptions: ['fbasim-community.community_not_joint_lp'],
    });
    const decision = canPassToDownstream(source, 'catdes');
    expect(decision.allowed).toBe(false);
    expect(decision.severity).toBe('block');
    expect(collectBlockingAssumptions(source)).toEqual(['fbasim-community.community_not_joint_lp']);
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
    expect(decision.targetValidity).toBe('partial');
  });
});
