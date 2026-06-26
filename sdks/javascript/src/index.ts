/**
 * Nexus-Bio JavaScript/TypeScript SDK.
 *
 * @example
 * ```ts
 * import { NexusBioClient, NexusBioError } from 'nexus-bio';
 *
 * const client = new NexusBioClient({ apiKey: 'your-key' });
 * const health = await client.health();
 * console.log(health.status); // 'ok'
 * ```
 */

export { NexusBioClient, NexusBioError } from './client';
export type {
  AnalyzeRequest,
  AnalyzeResponse,
  AnalyzeResponseCandidate,
  AnalyzeResponseCandidateContent,
  AnalyzeResponseMeta,
  ConversationTurn,
  FBARequest,
  FBAResponse,
  FBASpeciesConfig,
  HealthStatus,
  InventoryItem,
  InventoryListResponse,
  NexusBioClientOptions,
  ProjectSummary,
} from './types';
