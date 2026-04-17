/** @jest-environment node */
/**
 * axonAdapterRegistry — registry pattern the orchestrator reads from.
 * These tests lock the "unsupported tools are explicitly unsupported"
 * contract — no silent stubs.
 */
import type { AxonAdapter, AxonTool } from '../src/services/AxonOrchestrator';
import {
  buildDefaultAxonAdapterRegistry,
  createAxonAdapterRegistry,
  DEFAULT_AXON_ADAPTERS,
} from '../src/services/axonAdapterRegistry';

describe('createAxonAdapterRegistry', () => {
  it('exposes registered adapters via get/isSupported/toMap', () => {
    const fake: AxonAdapter = async () => ({ ok: true });
    const reg = createAxonAdapterRegistry([
      { tool: 'pathd' as AxonTool, adapter: fake, label: 'pathd' },
    ]);
    expect(reg.isSupported('pathd')).toBe(true);
    expect(reg.isSupported('fbasim')).toBe(false);
    expect(reg.get('pathd')).toBe(fake);
    expect(reg.get('fbasim')).toBeUndefined();
    expect(reg.toMap()).toEqual({ pathd: fake });
  });

  it('list() returns registration metadata in insertion order', () => {
    const a: AxonAdapter = async () => ({});
    const b: AxonAdapter = async () => ({});
    const reg = createAxonAdapterRegistry([
      { tool: 'pathd' as AxonTool, adapter: a, label: 'A', inputShape: 'X' },
      { tool: 'fbasim' as AxonTool, adapter: b, label: 'B' },
    ]);
    const list = reg.list();
    expect(list.map((r) => r.tool)).toEqual(['pathd', 'fbasim']);
    expect(list[0].inputShape).toBe('X');
  });
});

describe('buildDefaultAxonAdapterRegistry', () => {
  it('registers both PATHD and FBASIM adapters', () => {
    const reg = buildDefaultAxonAdapterRegistry();
    expect(reg.isSupported('pathd')).toBe(true);
    expect(reg.isSupported('fbasim')).toBe(true);
    expect(DEFAULT_AXON_ADAPTERS.map((r) => r.tool).sort()).toEqual(['fbasim', 'pathd']);
  });
});
