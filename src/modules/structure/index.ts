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
export {
  detectGeometricInterfaces,
  predictInterfaceFromEmbeddings,
  estimateContactProbability,
  classifyInterfaceResidues,
} from './interface';
export type { StructureInput, StructureResult, ChainResult, InterfaceResidue, ProteinChain, InterfacePrediction } from './types';
