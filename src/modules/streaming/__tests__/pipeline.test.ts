/**
 * Streaming Pipeline Tests
 *
 * Tests cover:
 *   1. Pipeline Stages (add/remove/list)
 *   2. Processing (multi-stage, empty, single)
 *   3. Buffer Queue (enqueue/dequeue, full, empty, FIFO)
 *   4. Backpressure (reject when full, accept when space)
 *   5. Stage Composition (compose multiple stages, correct order)
 *
 * @jest-environment node
 */

import { BufferQueue, StreamingPipeline, composeStages } from '../pipeline';
import type { PipelineStage } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Create a simple named stage that transforms data by appending its name */
function makeStage(name: string): PipelineStage {
  return {
    name,
    process: async (data: unknown) => {
      if (Array.isArray(data)) {
        return [...data, name];
      }
      return name;
    },
  };
}

/** Create a stage that doubles numeric values */
function doubleStage(): PipelineStage {
  return {
    name: 'double',
    process: async (data: unknown) => {
      if (typeof data === 'number') return data * 2;
      return data;
    },
  };
}

/** Create a stage that adds a fixed offset */
function addStage(value: number): PipelineStage {
  return {
    name: `add-${value}`,
    process: async (data: unknown) => {
      if (typeof data === 'number') return data + value;
      return data;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('BufferQueue', () => {
  // ── Basic Operations ─────────────────────────────────────────────────────

  describe('basic operations', () => {
    it('starts empty', () => {
      const queue = new BufferQueue<number>();
      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
      expect(queue.isFull()).toBe(false);
    });

    it('enqueues and dequeues a single item', () => {
      const queue = new BufferQueue<number>();
      expect(queue.enqueue(42)).toBe(true);
      expect(queue.size()).toBe(1);
      expect(queue.dequeue()).toBe(42);
      expect(queue.size()).toBe(0);
    });

    it('maintains FIFO ordering', () => {
      const queue = new BufferQueue<string>();
      queue.enqueue('first');
      queue.enqueue('second');
      queue.enqueue('third');

      expect(queue.dequeue()).toBe('first');
      expect(queue.dequeue()).toBe('second');
      expect(queue.dequeue()).toBe('third');
    });

    it('peek returns the front item without removing it', () => {
      const queue = new BufferQueue<number>();
      queue.enqueue(10);
      queue.enqueue(20);

      expect(queue.peek()).toBe(10);
      expect(queue.size()).toBe(2);
      expect(queue.dequeue()).toBe(10);
    });

    it('peek returns undefined when empty', () => {
      const queue = new BufferQueue<number>();
      expect(queue.peek()).toBeUndefined();
    });

    it('dequeue returns undefined when empty', () => {
      const queue = new BufferQueue<number>();
      expect(queue.dequeue()).toBeUndefined();
    });
  });

  // ── Fixed-Size Buffer ────────────────────────────────────────────────────

  describe('fixed-size buffer', () => {
    it('respects maxSize limit', () => {
      const queue = new BufferQueue<number>(3);
      expect(queue.enqueue(1)).toBe(true);
      expect(queue.enqueue(2)).toBe(true);
      expect(queue.enqueue(3)).toBe(true);
      expect(queue.size()).toBe(3);
      expect(queue.isFull()).toBe(true);
    });

    it('rejects enqueue when full (backpressure)', () => {
      const queue = new BufferQueue<number>(2);
      queue.enqueue(1);
      queue.enqueue(2);

      expect(queue.enqueue(3)).toBe(false);
      expect(queue.size()).toBe(2);
      // The rejected item should not be in the queue
      expect(queue.dequeue()).toBe(1);
      expect(queue.dequeue()).toBe(2);
      expect(queue.isEmpty()).toBe(true);
    });

    it('accepts items again after dequeue frees space', () => {
      const queue = new BufferQueue<number>(2);
      queue.enqueue(1);
      queue.enqueue(2);
      expect(queue.enqueue(3)).toBe(false); // full

      queue.dequeue(); // free one slot
      expect(queue.enqueue(3)).toBe(true); // should work now
      expect(queue.size()).toBe(2);
    });

    it('defaults to a reasonable max size when not specified', () => {
      const queue = new BufferQueue<number>();
      // Default should be > 0 so items can be enqueued
      expect(queue.enqueue(1)).toBe(true);
    });
  });

  // ── Clear ────────────────────────────────────────────────────────────────

  describe('clear', () => {
    it('empties the queue', () => {
      const queue = new BufferQueue<number>(10);
      queue.enqueue(1);
      queue.enqueue(2);
      queue.enqueue(3);

      queue.clear();
      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
      expect(queue.dequeue()).toBeUndefined();
    });

    it('allows enqueue after clear when buffer was full', () => {
      const queue = new BufferQueue<number>(2);
      queue.enqueue(1);
      queue.enqueue(2);
      expect(queue.isFull()).toBe(true);

      queue.clear();
      expect(queue.isFull()).toBe(false);
      expect(queue.enqueue(99)).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('StreamingPipeline', () => {
  // ── Stage Management ─────────────────────────────────────────────────────

  describe('stage management', () => {
    it('starts with no stages', () => {
      const pipeline = new StreamingPipeline();
      expect(pipeline.getStages()).toEqual([]);
    });

    it('adds stages correctly', () => {
      const pipeline = new StreamingPipeline();
      pipeline.addStage(makeStage('A'));
      pipeline.addStage(makeStage('B'));

      expect(pipeline.getStages()).toEqual(['A', 'B']);
    });

    it('removes stages correctly', () => {
      const pipeline = new StreamingPipeline();
      pipeline.addStage(makeStage('A'));
      pipeline.addStage(makeStage('B'));
      pipeline.addStage(makeStage('C'));

      pipeline.removeStage('B');
      expect(pipeline.getStages()).toEqual(['A', 'C']);
    });

    it('ignores removal of non-existent stage', () => {
      const pipeline = new StreamingPipeline();
      pipeline.addStage(makeStage('A'));

      pipeline.removeStage('nonexistent');
      expect(pipeline.getStages()).toEqual(['A']);
    });

    it('clears all stages', () => {
      const pipeline = new StreamingPipeline();
      pipeline.addStage(makeStage('A'));
      pipeline.addStage(makeStage('B'));

      pipeline.clear();
      expect(pipeline.getStages()).toEqual([]);
    });

    it('preserves order when adding stages', () => {
      const pipeline = new StreamingPipeline();
      pipeline.addStage(makeStage('first'));
      pipeline.addStage(makeStage('second'));
      pipeline.addStage(makeStage('third'));

      expect(pipeline.getStages()).toEqual(['first', 'second', 'third']);
    });
  });

  // ── Processing ───────────────────────────────────────────────────────────

  describe('processing', () => {
    it('processes data through all stages in order', async () => {
      const pipeline = new StreamingPipeline();
      pipeline.addStage(makeStage('A'));
      pipeline.addStage(makeStage('B'));
      pipeline.addStage(makeStage('C'));

      const result = await pipeline.process([]);
      expect(result).toEqual(['A', 'B', 'C']);
    });

    it('handles empty pipeline by returning input unchanged', async () => {
      const pipeline = new StreamingPipeline();
      const data = { key: 'value' };
      const result = await pipeline.process(data);
      expect(result).toEqual(data);
    });

    it('handles single stage', async () => {
      const pipeline = new StreamingPipeline();
      pipeline.addStage(doubleStage());

      const result = await pipeline.process(21);
      expect(result).toBe(42);
    });

    it('chains numeric transformations correctly', async () => {
      const pipeline = new StreamingPipeline();
      pipeline.addStage(doubleStage());
      pipeline.addStage(addStage(10));

      const result = await pipeline.process(5);
      // 5 * 2 = 10, 10 + 10 = 20
      expect(result).toBe(20);
    });

    it('handles null data through stages', async () => {
      const pipeline = new StreamingPipeline();
      const stage: PipelineStage = {
        name: 'null-handler',
        process: async (data) => (data === null ? 'was-null' : data),
      };
      pipeline.addStage(stage);

      const result = await pipeline.process(null);
      expect(result).toBe('was-null');
    });

    it('handles undefined data through stages', async () => {
      const pipeline = new StreamingPipeline();
      const stage: PipelineStage = {
        name: 'undef-handler',
        process: async (data) => (data === undefined ? 'was-undefined' : data),
      };
      pipeline.addStage(stage);

      const result = await pipeline.process(undefined);
      expect(result).toBe('was-undefined');
    });

    it('handles async stages', async () => {
      const pipeline = new StreamingPipeline();
      const slowStage: PipelineStage = {
        name: 'slow',
        process: async (data: number) => {
          return new Promise((resolve) => setTimeout(() => resolve(data + 1), 50));
        },
      };
      pipeline.addStage(slowStage);
      pipeline.addStage(slowStage);

      const result = await pipeline.process(0);
      expect(result).toBe(2);
    });

    it('propagates errors from stages', async () => {
      const pipeline = new StreamingPipeline();
      const failStage: PipelineStage = {
        name: 'fail',
        process: async () => {
          throw new Error('stage error');
        },
      };
      pipeline.addStage(failStage);

      await expect(pipeline.process('data')).rejects.toThrow('stage error');
    });
  });

  // ── Backpressure ─────────────────────────────────────────────────────────

  describe('backpressure', () => {
    it('creates with default options', () => {
      const pipeline = new StreamingPipeline();
      // Should not throw with defaults
      expect(pipeline.getStages()).toEqual([]);
    });

    it('creates with custom buffer options', () => {
      const pipeline = new StreamingPipeline({ bufferSize: 5, backpressureThreshold: 3 });
      // Should not throw with custom options
      expect(pipeline.getStages()).toEqual([]);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('composeStages', () => {
  it('composes multiple stages into one', async () => {
    const composed = composeStages(makeStage('A'), makeStage('B'), makeStage('C'));

    expect(composed.name).toBe('composed');
    const result = await composed.process([]);
    expect(result).toEqual(['A', 'B', 'C']);
  });

  it('executes stages in correct order', async () => {
    const composed = composeStages(doubleStage(), addStage(5));

    const result = await composed.process(10);
    // 10 * 2 = 20, 20 + 5 = 25
    expect(result).toBe(25);
  });

  it('returns a stage with the correct interface', () => {
    const composed = composeStages(makeStage('X'));
    expect(composed).toHaveProperty('name');
    expect(composed).toHaveProperty('process');
    expect(typeof composed.process).toBe('function');
  });

  it('handles single stage composition', async () => {
    const composed = composeStages(doubleStage());

    const result = await composed.process(7);
    expect(result).toBe(14);
  });

  it('handles empty composition by passing data through', async () => {
    const composed = composeStages();

    const data = { pass: 'through' };
    const result = await composed.process(data);
    expect(result).toEqual(data);
  });

  it('composed stage can be added to a pipeline', async () => {
    const pipeline = new StreamingPipeline();
    const composed = composeStages(doubleStage(), addStage(100));

    pipeline.addStage(composed);

    const result = await pipeline.process(5);
    // composed: 5 * 2 + 100 = 110
    expect(result).toBe(110);
  });

  it('composes stages with async processing', async () => {
    const asyncDouble: PipelineStage = {
      name: 'async-double',
      process: async (data: number) => {
        return new Promise((resolve) => setTimeout(() => resolve(data * 2), 10));
      },
    };
    const asyncAdd: PipelineStage = {
      name: 'async-add',
      process: async (data: number) => {
        return new Promise((resolve) => setTimeout(() => resolve(data + 3), 10));
      },
    };

    const composed = composeStages(asyncDouble, asyncAdd);
    const result = await composed.process(4);
    // 4 * 2 = 8, 8 + 3 = 11
    expect(result).toBe(11);
  });

  it('propagates errors through composition', async () => {
    const ok: PipelineStage = {
      name: 'ok',
      process: async (data: number) => data + 1,
    };
    const fail: PipelineStage = {
      name: 'fail',
      process: async () => {
        throw new Error('composed stage error');
      },
    };

    const composed = composeStages(ok, fail);
    await expect(composed.process(0)).rejects.toThrow('composed stage error');
  });
});
