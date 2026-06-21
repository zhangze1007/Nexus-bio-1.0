/**
 * Acquisition Functions Module — Public API
 */

export { BaseAcquisition, createRNG, normalSample } from './base';
export type { AcquisitionFunction, AcquisitionInput, AcquisitionOutput, CandidatePoint, SurrogatePrediction } from './base';

export { ThompsonSampling, batchThompsonSampling } from './thompson';
export { KnowledgeGradient } from './kg';
export { EHVI } from './ehvi';
export { ConstrainedAcquisition, withConstraints } from './constraint';
export type { ConstraintConfig } from './constraint';
