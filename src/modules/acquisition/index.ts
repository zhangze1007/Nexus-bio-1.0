/**
 * Acquisition Functions Module — Public API
 */

export type {
  AcquisitionFunction,
  AcquisitionInput,
  AcquisitionOutput,
  CandidatePoint,
  SurrogatePrediction,
} from "./base";
export { BaseAcquisition, createRNG, normalSample } from "./base";
export type { ConstraintConfig } from "./constraint";
export { ConstrainedAcquisition, withConstraints } from "./constraint";
export { EHVI } from "./ehvi";
export { KnowledgeGradient } from "./kg";
export { batchThompsonSampling, ThompsonSampling } from "./thompson";
