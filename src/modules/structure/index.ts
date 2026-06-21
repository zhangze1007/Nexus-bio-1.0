/**
 * Structure Prediction Module — Public API
 */

export { predictStructure } from './structurePredictor';
export {
  generateEmbedding,
  generateComplexEmbedding,
  EmbeddingCache,
  generateBatchEmbeddings,
  generateEmbeddingWithFallback,
} from './embeddings';
export type { StructureInput, StructureResult, ChainResult, InterfaceResidue, ProteinChain } from './types';
