/**
 * Streaming Module — Public API
 *
 * WebSocket-based real-time streaming with pub/sub messaging.
 * Includes streaming pipeline with backpressure-aware buffer queue.
 */

export { StreamingServer } from './server';
export { StreamingPipeline, BufferQueue, composeStages } from './pipeline';
export type {
  StreamingMessage,
  StreamingOptions,
  MessageType,
  ClientInfo,
  PipelineStage,
  PipelineOptions,
} from './types';
