/**
 * Structure Prediction Module — Public API
 */

export {
  EmbeddingCache,
  generateBatchEmbeddings,
  generateComplexEmbedding,
  generateEmbedding,
  generateEmbeddingWithFallback,
} from "./embeddings";
export {
  classifyInterfaceResidues,
  detectGeometricInterfaces,
  estimateContactProbability,
  predictInterfaceFromEmbeddings,
} from "./interface";
export {
  computeAreaScore,
  computeClashPenalty,
  computeContactScore,
  computeEnergyScore,
  scoreComplex,
} from "./scoring";
export { predictStructure } from "./structurePredictor";
export type {
  ChainConfidence,
  ChainResult,
  ComplexScore,
  ConfidenceSummary,
  InterfacePrediction,
  InterfaceResidue,
  ProteinChain,
  ResidueConfidence,
  StructureInput,
  StructureResult,
} from "./types";
export {
  computeConfidenceSummary,
  confidenceToColor,
  exportConfidenceCSV,
  exportConfidenceJSON,
  mapIPTM,
  mapPLDDT,
} from "./visualization";
