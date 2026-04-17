/** @jest-environment node */
/**
 * axonExecutionLog — log entry construction, metadata sanitisation, bounded append.
 */
import {
  buildLogEntry,
  appendLogEntry,
  sanitiseLogMetadata,
  phaseLabel,
  AXON_LOG_LIMIT,
  type AxonLogEntry,
} from '../src/services/axonExecutionLog';

describe('axonExecutionLog.sanitiseLogMetadata', () => {
  it('returns undefined for undefined input', () => {
    expect(sanitiseLogMetadata(undefined)).toBeUndefined();
  });

  it('strips rawText / raw / prompt keys', () => {
    const out = sanitiseLogMetadata({
      rawText: 'x'.repeat(10_000),
      raw: { any: 'thing' },
      prompt: 'secret',
      keep: 'ok',
    });
    expect(out).toEqual({ keep: 'ok' });
  });

  it('truncates long strings with an ellipsis', () => {
    const long = 'a'.repeat(300);
    const out = sanitiseLogMetadata({ long }) as Record<string, string>;
    expect(out.long.length).toBeLessThanOrEqual(160);
    expect(out.long.endsWith('…')).toBe(true);
  });

  it('keeps primitives and nulls, collapses arrays to a placeholder, drops objects', () => {
    const out = sanitiseLogMetadata({
      n: 5,
      b: true,
      s: 'hi',
      nul: null,
      arr: [1, 2, 3],
      obj: { nested: 'val' },
    }) as Record<string, unknown>;
    expect(out.n).toBe(5);
    expect(out.b).toBe(true);
    expect(out.s).toBe('hi');
    expect(out.nul).toBeNull();
    expect(out.arr).toBe('[array len=3]');
    expect(out.obj).toBeUndefined();
  });

  it('caps metadata at 8 keys', () => {
    const many: Record<string, number> = {};
    for (let i = 0; i < 20; i++) many[`k${i}`] = i;
    const out = sanitiseLogMetadata(many) as Record<string, number>;
    expect(Object.keys(out).length).toBe(8);
  });
});

describe('axonExecutionLog.buildLogEntry', () => {
  it('fills id and timestamp when omitted', () => {
    let t = 1_700_000_000_000;
    const e = buildLogEntry(
      { phase: 'started', message: 'go' },
      { now: () => ++t, idFactory: () => 'log-fixed' },
    );
    expect(e.id).toBe('log-fixed');
    expect(e.timestamp).toBeGreaterThan(1_700_000_000_000);
    expect(e.phase).toBe('started');
  });

  it('applies sanitisation to metadata', () => {
    const e = buildLogEntry({
      phase: 'enqueued',
      message: 'q',
      metadata: { rawText: 'x'.repeat(500), count: 3 },
    });
    expect(e.metadata).toEqual({ count: 3 });
  });
});

describe('axonExecutionLog.appendLogEntry', () => {
  it('prepends newest and caps at limit', () => {
    let log: AxonLogEntry[] = [];
    for (let i = 0; i < 5; i++) {
      log = appendLogEntry(log, buildLogEntry({ phase: 'info', message: String(i) }), 3);
    }
    expect(log).toHaveLength(3);
    expect(log[0].message).toBe('4');
    expect(log[2].message).toBe('2');
  });

  it('default limit is AXON_LOG_LIMIT', () => {
    let log: AxonLogEntry[] = [];
    for (let i = 0; i < AXON_LOG_LIMIT + 50; i++) {
      log = appendLogEntry(log, buildLogEntry({ phase: 'info', message: String(i) }));
    }
    expect(log).toHaveLength(AXON_LOG_LIMIT);
  });
});

describe('axonExecutionLog.phaseLabel', () => {
  it('labels every supported phase', () => {
    const phases = [
      'plan-created', 'plan-warning', 'planned', 'enqueued', 'context-attached',
      'started', 'adapter-invoked', 'writeback-emitted', 'completed', 'failed',
      'cancelled', 'interrupted', 'retried', 'reordered', 'blocked-dependency', 'info',
    ] as const;
    for (const p of phases) {
      const label = phaseLabel(p);
      expect(label.length).toBeGreaterThan(0);
    }
  });
});
