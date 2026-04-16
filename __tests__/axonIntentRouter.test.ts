/** @jest-environment node */
import { routeIntent } from '../src/services/axonIntentRouter';

describe('routeIntent', () => {
  it('routes clear PATHD requests when a target product is extractable', () => {
    const route = routeIntent('Design a pathway for artemisinin production');
    expect(route.kind).toBe('pathd');
    if (route.kind === 'pathd') {
      expect(route.targetProduct.toLowerCase()).toContain('artemisinin');
    }
  });

  it('falls back to the workbench target product when the query has no explicit product', () => {
    const route = routeIntent('Redesign the bottleneck enzyme', {
      targetProduct: 'lycopene',
    });
    expect(route.kind).toBe('pathd');
    if (route.kind === 'pathd') {
      expect(route.targetProduct).toBe('lycopene');
    }
  });

  it('rejects PATHD intent with no product and no context', () => {
    const route = routeIntent('Redesign the bottleneck enzyme');
    expect(route.kind).toBe('none');
    if (route.kind === 'none') {
      expect(route.reason).toMatch(/no target product/i);
    }
  });

  it('routes FBA / flux-balance queries to fbasim with sensible defaults', () => {
    const route = routeIntent('Run a flux balance analysis on our current build');
    expect(route.kind).toBe('fbasim');
    if (route.kind === 'fbasim') {
      expect(route.params.species).toBe('ecoli');
      expect(route.params.objective).toBe('biomass');
    }
  });

  it('reads "yeast" as a yeast request and "product" as a product objective', () => {
    const route = routeIntent('Simulate yeast metabolism maximising product yield via FBA');
    expect(route.kind).toBe('fbasim');
    if (route.kind === 'fbasim') {
      expect(route.params.species).toBe('yeast');
      expect(route.params.objective).toBe('product');
    }
  });

  it('refuses ambiguous prompts that mention both PATHD and FBASIM keywords', () => {
    const route = routeIntent('Do a flux balance analysis and redesign the pathway');
    expect(route.kind).toBe('none');
    if (route.kind === 'none') {
      expect(route.reason).toMatch(/both pathd and fbasim/i);
    }
  });

  it('does not force-route open-ended copilot questions', () => {
    const route = routeIntent('Summarise the current workbench and recommend what to do next');
    expect(route.kind).toBe('none');
  });

  it('does not route on empty input', () => {
    expect(routeIntent('').kind).toBe('none');
    expect(routeIntent('   ').kind).toBe('none');
  });
});
