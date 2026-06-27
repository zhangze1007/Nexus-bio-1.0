/**
 * Streaming Pipeline
 *
 * Ordered multi-stage data processing pipeline with backpressure-aware
 * buffer queue. Each stage receives the output of the previous stage,
 * enabling composable data transformation chains.
 *
 * @module streaming/pipeline
 */

import type { PipelineOptions, PipelineStage } from "./types";

// ── BufferQueue ──────────────────────────────────────────────────────────────

/**
 * Fixed-size FIFO buffer queue with backpressure support.
 *
 * When the buffer reaches its maximum size, new enqueue attempts return `false`
 * instead of accepting the item. This signals the producer to slow down
 * (backpressure). The consumer drains the queue via `dequeue()`.
 *
 * @template T - The type of items stored in the queue
 *
 * @example
 * ```ts
 * const queue = new BufferQueue<number>(3);
 * queue.enqueue(1); // true
 * queue.enqueue(2); // true
 * queue.enqueue(3); // true
 * queue.enqueue(4); // false — buffer full, backpressure applied
 * queue.dequeue();   // 1
 * queue.enqueue(4); // true — space freed
 * ```
 */
export class BufferQueue<T> {
  private readonly items: T[] = [];
  private readonly maxSize: number;

  /**
   * Create a new BufferQueue.
   *
   * @param maxSize - Maximum number of items the buffer can hold (default: 100)
   */
  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  /**
   * Add an item to the back of the queue.
   *
   * @param item - The item to enqueue
   * @returns `true` if the item was accepted, `false` if the buffer is full (backpressure)
   */
  enqueue(item: T): boolean {
    if (this.items.length >= this.maxSize) {
      return false;
    }
    this.items.push(item);
    return true;
  }

  /**
   * Remove and return the front item from the queue.
   *
   * @returns The front item, or `undefined` if the queue is empty
   */
  dequeue(): T | undefined {
    return this.items.shift();
  }

  /**
   * Return the front item without removing it.
   *
   * @returns The front item, or `undefined` if the queue is empty
   */
  peek(): T | undefined {
    return this.items[0];
  }

  /**
   * Get the current number of items in the queue.
   *
   * @returns The item count
   */
  size(): number {
    return this.items.length;
  }

  /**
   * Check whether the buffer has reached its maximum capacity.
   *
   * @returns `true` if no more items can be enqueued
   */
  isFull(): boolean {
    return this.items.length >= this.maxSize;
  }

  /**
   * Check whether the buffer is empty.
   *
   * @returns `true` if there are no items in the queue
   */
  isEmpty(): boolean {
    return this.items.length === 0;
  }

  /**
   * Remove all items from the queue, resetting it to empty.
   */
  clear(): void {
    this.items.length = 0;
  }
}

// ── StreamingPipeline ────────────────────────────────────────────────────────

/**
 * Ordered multi-stage data processing pipeline.
 *
 * Stages are added in order and data flows through them sequentially.
 * Each stage receives the output of the previous stage as its input.
 * When the pipeline has no stages, `process()` returns the input unchanged.
 *
 * @example
 * ```ts
 * const pipeline = new StreamingPipeline({ bufferSize: 50 });
 * pipeline.addStage({ name: 'parse', process: async (raw) => JSON.parse(raw) });
 * pipeline.addStage({ name: 'validate', process: async (data) => validate(data) });
 * pipeline.addStage({ name: 'transform', process: async (data) => transform(data) });
 *
 * const result = await pipeline.process('{"key":"value"}');
 * console.log(pipeline.getStages()); // ['parse', 'validate', 'transform']
 * ```
 */
export class StreamingPipeline {
  private stages: PipelineStage[] = [];
  private buffer: BufferQueue<unknown>;
  private options: Required<PipelineOptions>;

  /**
   * Create a new StreamingPipeline.
   *
   * @param options - Pipeline configuration
   * @param options.bufferSize - Maximum items in the buffer queue (default: 100)
   * @param options.backpressureThreshold - Fraction of buffer capacity at which backpressure kicks in (default: 0.8)
   */
  constructor(options?: PipelineOptions) {
    const bufferSize = options?.bufferSize ?? 100;
    this.options = {
      bufferSize,
      backpressureThreshold: options?.backpressureThreshold ?? 0.8,
    };
    this.buffer = new BufferQueue(this.options.bufferSize);
  }

  /**
   * Submit data to the pipeline buffer for processing.
   *
   * Returns `false` if the buffer is full (backpressure signal to the producer).
   *
   * @param data - The data item to enqueue
   * @returns `true` if accepted, `false` if the buffer is full
   */
  submit(data: unknown): boolean {
    return this.buffer.enqueue(data);
  }

  /**
   * Process the next item from the buffer through all stages.
   *
   * Returns `undefined` if the buffer is empty.
   *
   * @returns The transformed output, or `undefined` if nothing to process
   */
  async processNext(): Promise<unknown> {
    const item = this.buffer.dequeue();
    if (item === undefined) return undefined;
    return this.processItem(item);
  }

  /**
   * Check if the buffer is under backpressure.
   *
   * Backpressure is active when the current buffer size exceeds the
   * configured fraction of the maximum buffer capacity.
   *
   * @returns `true` if the buffer fill level exceeds the backpressure threshold
   */
  isBackpressured(): boolean {
    return this.buffer.size() > this.options.bufferSize * this.options.backpressureThreshold;
  }

  /**
   * Add a processing stage to the end of the pipeline.
   *
   * Stages execute in the order they are added. The first stage receives
   * the raw input data; each subsequent stage receives the output of the
   * previous stage.
   *
   * @param stage - The stage to add
   */
  addStage(stage: PipelineStage): void {
    this.stages.push(stage);
  }

  /**
   * Remove a stage by name.
   *
   * If multiple stages share the same name, only the first match is removed.
   * If no stage with the given name exists, this is a no-op.
   *
   * @param name - The name of the stage to remove
   */
  removeStage(name: string): void {
    const index = this.stages.findIndex((s) => s.name === name);
    if (index !== -1) {
      this.stages.splice(index, 1);
    }
  }

  /**
   * Process data through all stages sequentially (direct, no buffering).
   *
   * Each stage receives the output of the previous stage. If the pipeline
   * has no stages, the input data is returned unchanged.
   *
   * @param data - The input data to process
   * @returns The final transformed output
   */
  async process(data: unknown): Promise<unknown> {
    return this.processItem(data);
  }

  /**
   * Get the names of all stages in execution order.
   *
   * @returns Array of stage names
   */
  getStages(): string[] {
    return this.stages.map((s) => s.name);
  }

  /**
   * Remove all stages from the pipeline, resetting it to empty.
   */
  clear(): void {
    this.stages.length = 0;
    this.buffer.clear();
  }

  private async processItem(data: unknown): Promise<unknown> {
    let result: unknown = data;
    for (const stage of this.stages) {
      result = await stage.process(result);
    }
    return result;
  }
}

// ── composeStages ────────────────────────────────────────────────────────────

/**
 * Compose multiple pipeline stages into a single stage.
 *
 * The composed stage executes all input stages in order, passing the
 * output of each stage as the input to the next. This enables building
 * reusable stage groups that can be treated as a single unit.
 *
 * @param stages - The stages to compose (in execution order)
 * @returns A single PipelineStage that runs all input stages sequentially
 *
 * @example
 * ```ts
 * const parseAndValidate = composeStages(parseStage, validateStage);
 * pipeline.addStage(parseAndValidate); // treated as one stage
 * ```
 */
export function composeStages(...stages: PipelineStage[]): PipelineStage {
  return {
    name: "composed",
    process: async (data: unknown): Promise<unknown> => {
      let result: unknown = data;
      for (const stage of stages) {
        result = await stage.process(result);
      }
      return result;
    },
  };
}
