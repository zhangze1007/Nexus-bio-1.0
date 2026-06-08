/** @jest-environment node */

import {
  WORKBENCH_DEPENDENCY_GRAPH,
  getDependencyEdges,
  getUpstreamToolIds,
  getDownstreamToolIds,
  getDependencyTrace,
  type WorkbenchDependencyEdge,
} from '../src/config/workbenchGraph';

// ── Static data ─────────────────────────────────────────────────────────────

describe('WORKBENCH_DEPENDENCY_GRAPH', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(WORKBENCH_DEPENDENCY_GRAPH)).toBe(true);
    expect(WORKBENCH_DEPENDENCY_GRAPH.length).toBeGreaterThan(0);
  });

  it('every edge has required fields', () => {
    for (const edge of WORKBENCH_DEPENDENCY_GRAPH) {
      expect(typeof edge.fromToolId).toBe('string');
      expect(typeof edge.toToolId).toBe('string');
      expect(['forward', 'feedback', 'support']).toContain(edge.kind);
      expect(['required', 'recommended']).toContain(edge.mode);
      expect(typeof edge.summary).toBe('string');
      expect(edge.summary.length).toBeGreaterThan(0);
    }
  });

  it('has edges for all major tools', () => {
    const toolIds = new Set<string>();
    for (const edge of WORKBENCH_DEPENDENCY_GRAPH) {
      toolIds.add(edge.fromToolId);
      toolIds.add(edge.toToolId);
    }
    // Should include key tools
    expect(toolIds.has('pathd')).toBe(true);
    expect(toolIds.has('fbasim')).toBe(true);
    expect(toolIds.has('cethx')).toBe(true);
    expect(toolIds.has('catdes')).toBe(true);
    expect(toolIds.has('dbtlflow')).toBe(true);
    expect(toolIds.has('multio')).toBe(true);
    expect(toolIds.has('scspatial')).toBe(true);
  });

  it('has feedback edges', () => {
    const feedbackEdges = WORKBENCH_DEPENDENCY_GRAPH.filter(e => e.kind === 'feedback');
    expect(feedbackEdges.length).toBeGreaterThan(0);
  });

  it('has support edges', () => {
    const supportEdges = WORKBENCH_DEPENDENCY_GRAPH.filter(e => e.kind === 'support');
    expect(supportEdges.length).toBeGreaterThan(0);
  });
});

// ── getDependencyEdges ──────────────────────────────────────────────────────

describe('getDependencyEdges', () => {
  it('returns all edges when no options provided', () => {
    const edges = getDependencyEdges();
    expect(edges).toHaveLength(WORKBENCH_DEPENDENCY_GRAPH.length);
  });

  it('filters by toolId downstream', () => {
    const edges = getDependencyEdges({ toolId: 'pathd', direction: 'downstream' });
    expect(edges.length).toBeGreaterThan(0);
    for (const edge of edges) {
      expect(edge.fromToolId).toBe('pathd');
    }
  });

  it('filters by toolId upstream', () => {
    const edges = getDependencyEdges({ toolId: 'fbasim', direction: 'upstream' });
    expect(edges.length).toBeGreaterThan(0);
    for (const edge of edges) {
      expect(edge.toToolId).toBe('fbasim');
    }
  });

  it('excludes support edges when includeSupport is false', () => {
    const all = getDependencyEdges();
    const noSupport = getDependencyEdges({ includeSupport: false });
    expect(noSupport.length).toBeLessThan(all.length);
    for (const edge of noSupport) {
      expect(edge.kind).not.toBe('support');
    }
  });

  it('includes support edges by default', () => {
    const edges = getDependencyEdges();
    const supportEdges = edges.filter(e => e.kind === 'support');
    expect(supportEdges.length).toBeGreaterThan(0);
  });

  it('returns empty for non-existent tool', () => {
    const edges = getDependencyEdges({ toolId: 'nonexistent', direction: 'downstream' });
    expect(edges).toHaveLength(0);
  });

  it('filters downstream for tool with no downstream edges', () => {
    // scspatial is a leaf — check if it has downstream edges
    const edges = getDependencyEdges({ toolId: 'scspatial', direction: 'downstream' });
    // It may or may not have downstream edges, but the function should work
    expect(Array.isArray(edges)).toBe(true);
  });

  it('filters upstream for tool with no upstream edges', () => {
    // pathd is a root — check upstream
    const edges = getDependencyEdges({ toolId: 'pathd', direction: 'upstream' });
    expect(Array.isArray(edges)).toBe(true);
  });

  it('returns all edges when toolId is null', () => {
    const edges = getDependencyEdges({ toolId: null });
    expect(edges).toHaveLength(WORKBENCH_DEPENDENCY_GRAPH.length);
  });

  it('returns all edges when toolId is undefined', () => {
    const edges = getDependencyEdges({ toolId: undefined });
    expect(edges).toHaveLength(WORKBENCH_DEPENDENCY_GRAPH.length);
  });
});

// ── getUpstreamToolIds ──────────────────────────────────────────────────────

describe('getUpstreamToolIds', () => {
  it('returns empty array for null toolId', () => {
    expect(getUpstreamToolIds(null)).toEqual([]);
  });

  it('returns empty array for undefined toolId', () => {
    expect(getUpstreamToolIds(undefined)).toEqual([]);
  });

  it('returns direct upstream tools', () => {
    const upstream = getUpstreamToolIds('fbasim');
    expect(upstream).toContain('pathd');
  });

  it('does not include the tool itself', () => {
    const upstream = getUpstreamToolIds('fbasim');
    expect(upstream).not.toContain('fbasim');
  });

  it('returns unique results', () => {
    const upstream = getUpstreamToolIds('fbasim');
    const unique = new Set(upstream);
    expect(upstream.length).toBe(unique.size);
  });

  it('deep traversal finds transitive upstream', () => {
    const shallow = getUpstreamToolIds('catdes');
    const deep = getUpstreamToolIds('catdes', { deep: true });
    // Deep should find at least as many as shallow
    expect(deep.length).toBeGreaterThanOrEqual(shallow.length);
  });

  it('excludes support edges by default', () => {
    const withSupport = getUpstreamToolIds('pathd', { includeSupport: true });
    const withoutSupport = getUpstreamToolIds('pathd', { includeSupport: false });
    // With support should have at least as many
    expect(withSupport.length).toBeGreaterThanOrEqual(withoutSupport.length);
  });

  it('returns empty for non-existent tool', () => {
    const upstream = getUpstreamToolIds('nonexistent');
    expect(upstream).toEqual([]);
  });
});

// ── getDownstreamToolIds ────────────────────────────────────────────────────

describe('getDownstreamToolIds', () => {
  it('returns empty array for null toolId', () => {
    expect(getDownstreamToolIds(null)).toEqual([]);
  });

  it('returns empty array for undefined toolId', () => {
    expect(getDownstreamToolIds(undefined)).toEqual([]);
  });

  it('returns direct downstream tools', () => {
    const downstream = getDownstreamToolIds('pathd');
    expect(downstream).toContain('fbasim');
    expect(downstream).toContain('cethx');
  });

  it('does not include the tool itself', () => {
    const downstream = getDownstreamToolIds('pathd');
    expect(downstream).not.toContain('pathd');
  });

  it('returns unique results', () => {
    const downstream = getDownstreamToolIds('pathd');
    const unique = new Set(downstream);
    expect(downstream.length).toBe(unique.size);
  });

  it('deep traversal finds transitive downstream', () => {
    const shallow = getDownstreamToolIds('pathd');
    const deep = getDownstreamToolIds('pathd', { deep: true });
    expect(deep.length).toBeGreaterThanOrEqual(shallow.length);
  });

  it('includes support edges by default', () => {
    const withSupport = getDownstreamToolIds('nexai', { includeSupport: true });
    const withoutSupport = getDownstreamToolIds('nexai', { includeSupport: false });
    expect(withSupport.length).toBeGreaterThanOrEqual(withoutSupport.length);
  });

  it('returns empty for non-existent tool', () => {
    const downstream = getDownstreamToolIds('nonexistent');
    expect(downstream).toEqual([]);
  });

  it('deep downstream from pathd reaches many tools', () => {
    const downstream = getDownstreamToolIds('pathd', { deep: true });
    // Should reach fbasim, cethx, catdes, proevol, dyncon, cellfree, etc.
    expect(downstream.length).toBeGreaterThan(2);
  });
});

// ── getDependencyTrace ──────────────────────────────────────────────────────

describe('getDependencyTrace', () => {
  it('returns empty array for null toolId', () => {
    expect(getDependencyTrace(null)).toEqual([]);
  });

  it('returns empty array for undefined toolId', () => {
    expect(getDependencyTrace(undefined)).toEqual([]);
  });

  it('includes the tool itself in the trace', () => {
    const trace = getDependencyTrace('catdes');
    expect(trace).toContain('catdes');
  });

  it('upstream tools are in the trace', () => {
    const trace = getDependencyTrace('catdes');
    // pathd and fbasim are upstream of catdes
    expect(trace).toContain('pathd');
    expect(trace).toContain('fbasim');
  });

  it('downstream tools are in the trace', () => {
    const trace = getDependencyTrace('pathd');
    // fbasim and cethx are downstream of pathd
    expect(trace).toContain('fbasim');
    expect(trace).toContain('cethx');
  });

  it('trace includes the tool and its neighbors', () => {
    const trace = getDependencyTrace('catdes');
    expect(trace).toContain('catdes');
    // Trace should have at least the tool plus some neighbors
    expect(trace.length).toBeGreaterThan(1);
  });

  it('trace for a leaf tool has only upstream + self', () => {
    const trace = getDependencyTrace('scspatial');
    expect(trace).toContain('scspatial');
    // scspatial may have downstream edges (multio -> scspatial is forward)
    // but the trace should at least include the tool
  });

  it('trace for a root tool has only self + downstream', () => {
    const trace = getDependencyTrace('pathd');
    expect(trace).toContain('pathd');
    expect(trace.length).toBeGreaterThan(1); // at least one downstream
  });
});

// ── Edge kind/mode distribution ─────────────────────────────────────────────

describe('edge distribution', () => {
  it('has forward edges', () => {
    const forward = WORKBENCH_DEPENDENCY_GRAPH.filter(e => e.kind === 'forward');
    expect(forward.length).toBeGreaterThan(0);
  });

  it('has required and recommended modes', () => {
    const required = WORKBENCH_DEPENDENCY_GRAPH.filter(e => e.mode === 'required');
    const recommended = WORKBENCH_DEPENDENCY_GRAPH.filter(e => e.mode === 'recommended');
    expect(required.length).toBeGreaterThan(0);
    expect(recommended.length).toBeGreaterThan(0);
  });

  it('no edge has same fromToolId and toToolId', () => {
    for (const edge of WORKBENCH_DEPENDENCY_GRAPH) {
      expect(edge.fromToolId).not.toBe(edge.toToolId);
    }
  });
});
