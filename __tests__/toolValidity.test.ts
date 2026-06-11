/**
 * Tests for toolValidity registry.
 *
 * Covers:
 * - TOOL_VALIDITY registry completeness (all 14 tools present)
 * - getToolValidity returns correct entries
 * - getToolValidity returns undefined for unknown tools
 * - Validity levels are one of the expected values
 * - Each entry has a non-empty caption
 */

import { TOOL_VALIDITY, getToolValidity } from '../src/config/toolValidity';
import type { ValidityLevel } from '../src/config/toolValidity';

// ── Expected tool IDs ──
const ALL_TOOL_IDS = [
  'pathd', 'metabolic-eng', 'fbasim', 'cethx', 'catdes', 'proevol',
  'genmim', 'gecair', 'dyncon', 'cellfree', 'dbtlflow', 'multio',
  'scspatial', 'nexai',
];

const VALID_LEVELS: ValidityLevel[] = ['real', 'partial', 'demo'];

// ── Tests ──

describe('TOOL_VALIDITY', () => {
  it('contains entries for all 14 tool IDs', () => {
    for (const toolId of ALL_TOOL_IDS) {
      expect(TOOL_VALIDITY[toolId]).toBeDefined();
    }
    expect(Object.keys(TOOL_VALIDITY).length).toBeGreaterThanOrEqual(14);
  });

  it('each entry has a valid level', () => {
    for (const [toolId, entry] of Object.entries(TOOL_VALIDITY)) {
      expect(VALID_LEVELS).toContain(entry.level);
    }
  });

  it('each entry has a non-empty caption', () => {
    for (const [toolId, entry] of Object.entries(TOOL_VALIDITY)) {
      expect(entry.caption).toBeTruthy();
      expect(typeof entry.caption).toBe('string');
      expect(entry.caption.length).toBeGreaterThan(10);
    }
  });

  it('nexai is marked as real', () => {
    expect(TOOL_VALIDITY.nexai.level).toBe('real');
  });

  it('cethx is marked as partial (Alberty transform) and multio as demo', () => {
    expect(TOOL_VALIDITY.cethx.level).toBe('partial');
    expect(TOOL_VALIDITY.multio.level).toBe('demo');
  });

  it('fbasim is marked as partial', () => {
    expect(TOOL_VALIDITY.fbasim.level).toBe('partial');
  });
});

describe('getToolValidity', () => {
  it('returns the correct entry for a known tool', () => {
    const result = getToolValidity('fbasim');
    expect(result).toBeDefined();
    expect(result!.level).toBe('partial');
    expect(result!.caption).toContain('simplex');
  });

  it('returns undefined for an unknown tool', () => {
    expect(getToolValidity('nonexistent-tool')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(getToolValidity('')).toBeUndefined();
  });

  it('returns the correct entry for each tool', () => {
    for (const toolId of ALL_TOOL_IDS) {
      const result = getToolValidity(toolId);
      expect(result).toBeDefined();
      expect(result).toBe(TOOL_VALIDITY[toolId]);
    }
  });

  it('returns the same reference as direct lookup', () => {
    const direct = TOOL_VALIDITY.catdes;
    const viaFn = getToolValidity('catdes');
    expect(viaFn).toBe(direct);
  });
});
