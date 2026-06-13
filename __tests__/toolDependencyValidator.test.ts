/**
 * Tests for toolDependencyValidator.
 *
 * Covers:
 *  - Tools with no dependencies always return 'ok'
 *  - Golden-path tools with required upstream deps return 'missing' when upstream absent
 *  - Stale payloads are detected when older than the threshold
 *  - All deps present and fresh returns 'ok'
 *  - Unknown tool ids return 'ok' (nothing to validate)
 *  - getRequiredUpstreamIds / getOptionalUpstreamIds helpers
 */
import {
  validateDependencies,
  getRequiredUpstreamIds,
  getOptionalUpstreamIds,
} from '../src/services/toolDependencyValidator';

const NOW = Date.now();
const FRESH = { updatedAt: NOW };
const STALE = { updatedAt: NOW - 60 * 60 * 1000 }; // 1 hour ago

describe('validateDependencies', () => {
  // ── Golden-path tools ────────────────────────────────────────────────

  it('pathd has no required inputs — always ok', () => {
    const result = validateDependencies('pathd', {});
    expect(result.status).toBe('ok');
    expect(result.missing).toEqual([]);
    expect(result.stale).toEqual([]);
  });

  it('fbasim requires pathd payload — missing when absent', () => {
    const result = validateDependencies('fbasim', {});
    expect(result.status).toBe('missing');
    expect(result.missing).toContain('pathd');
  });

  it('fbasim with fresh pathd payload — ok', () => {
    const result = validateDependencies('fbasim', { pathd: FRESH });
    expect(result.status).toBe('ok');
  });

  it('fbasim with stale pathd payload — stale', () => {
    const result = validateDependencies('fbasim', { pathd: STALE });
    expect(result.status).toBe('stale');
    expect(result.stale).toContain('pathd');
  });

  it('catdes requires fbasim — missing when fbasim absent', () => {
    const result = validateDependencies('catdes', {});
    expect(result.status).toBe('missing');
    expect(result.missing).toContain('fbasim');
  });

  it('catdes with fresh fbasim — ok', () => {
    const result = validateDependencies('catdes', { fbasim: FRESH });
    expect(result.status).toBe('ok');
  });

  it('dyncon requires catdes — missing when absent', () => {
    const result = validateDependencies('dyncon', {});
    expect(result.status).toBe('missing');
    expect(result.missing).toContain('catdes');
  });

  it('dyncon with fresh catdes — ok', () => {
    const result = validateDependencies('dyncon', { catdes: FRESH });
    expect(result.status).toBe('ok');
  });

  it('cellfree requires dyncon — missing when absent', () => {
    const result = validateDependencies('cellfree', {});
    expect(result.status).toBe('missing');
    expect(result.missing).toContain('dyncon');
  });

  it('cellfree with fresh dyncon — ok', () => {
    const result = validateDependencies('cellfree', { dyncon: FRESH });
    expect(result.status).toBe('ok');
  });

  it('dbtlflow requires cellfree — missing when absent', () => {
    const result = validateDependencies('dbtlflow', {});
    expect(result.status).toBe('missing');
    expect(result.missing).toContain('cellfree');
  });

  it('dbtlflow with fresh cellfree — ok', () => {
    const result = validateDependencies('dbtlflow', { cellfree: FRESH });
    expect(result.status).toBe('ok');
  });

  // ── Sidecar tools (no required inputs) ──────────────────────────────

  it('cethx has no required inputs — always ok', () => {
    const result = validateDependencies('cethx', {});
    expect(result.status).toBe('ok');
  });

  it('proevol has no required inputs — always ok', () => {
    const result = validateDependencies('proevol', {});
    expect(result.status).toBe('ok');
  });

  it('genmim has no required inputs — always ok', () => {
    const result = validateDependencies('genmim', {});
    expect(result.status).toBe('ok');
  });

  it('gecair has no required inputs — always ok', () => {
    const result = validateDependencies('gecair', {});
    expect(result.status).toBe('ok');
  });

  it('multio has no required inputs — always ok', () => {
    const result = validateDependencies('multio', {});
    expect(result.status).toBe('ok');
  });

  it('scspatial has no required inputs — always ok', () => {
    const result = validateDependencies('scspatial', {});
    expect(result.status).toBe('ok');
  });

  it('nexai has no required inputs — always ok', () => {
    const result = validateDependencies('nexai', {});
    expect(result.status).toBe('ok');
  });

  it('metabolic-eng has no required inputs — always ok', () => {
    const result = validateDependencies('metabolic-eng', {});
    expect(result.status).toBe('ok');
  });

  // ── Unknown tool id ─────────────────────────────────────────────────

  it('unknown tool id returns ok (nothing to validate)', () => {
    const result = validateDependencies('nonexistent-tool', {});
    expect(result.status).toBe('ok');
    expect(result.missing).toEqual([]);
    expect(result.stale).toEqual([]);
  });

  // ── Multiple missing deps ───────────────────────────────────────────

  it('payload with undefined updatedAt is treated as present (not stale)', () => {
    const result = validateDependencies('fbasim', {
      pathd: { updatedAt: undefined },
    });
    // pathd payload exists, no updatedAt → not stale
    expect(result.status).toBe('ok');
  });

  // ── getRequiredUpstreamIds ──────────────────────────────────────────

  it('getRequiredUpstreamIds returns correct deps for golden-path tools', () => {
    expect(getRequiredUpstreamIds('pathd')).toEqual([]);
    expect(getRequiredUpstreamIds('fbasim')).toEqual(['pathd']);
    expect(getRequiredUpstreamIds('catdes')).toEqual(['fbasim']);
    expect(getRequiredUpstreamIds('dyncon')).toEqual(['catdes']);
    expect(getRequiredUpstreamIds('cellfree')).toEqual(['dyncon']);
    expect(getRequiredUpstreamIds('dbtlflow')).toEqual(['cellfree']);
  });

  it('getRequiredUpstreamIds returns [] for unknown tool', () => {
    expect(getRequiredUpstreamIds('nonexistent')).toEqual([]);
  });

  // ── getOptionalUpstreamIds ──────────────────────────────────────────

  it('getOptionalUpstreamIds returns optional deps for golden-path tools', () => {
    // fbasim optionally depends on cethx
    expect(getOptionalUpstreamIds('fbasim')).toContain('cethx');
    // catdes optionally depends on cethx
    expect(getOptionalUpstreamIds('catdes')).toContain('cethx');
    // dyncon optionally depends on gecair
    expect(getOptionalUpstreamIds('dyncon')).toContain('gecair');
    // cellfree optionally depends on catdes
    expect(getOptionalUpstreamIds('cellfree')).toContain('catdes');
  });

  it('getOptionalUpstreamIds returns [] for pathd (no optional inputs)', () => {
    expect(getOptionalUpstreamIds('pathd')).toEqual([]);
  });

  it('getOptionalUpstreamIds returns [] for unknown tool', () => {
    expect(getOptionalUpstreamIds('nonexistent')).toEqual([]);
  });
});
