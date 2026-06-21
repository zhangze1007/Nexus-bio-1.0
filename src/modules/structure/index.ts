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
export {
  computeContactScore,
  computeAreaScore,
  computeEnergyScore,
  computeClashPenalty,
  scoreComplex,
} from './scoring';
export type { StructureInput, StructureResult, ChainResult, InterfaceResidue, ProteinChain, InterfacePrediction, ComplexScore } from './types';
