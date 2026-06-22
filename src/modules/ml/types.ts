/**
 * ML Metabolic Engineering Types
 *
 * Unified types for enzyme activity prediction, Km/Kcat prediction,
 * and feature importance analysis.
 *
 * Reference: Ma et al. (2020) Nat Mach Intell 2:236-245
 */

export type TaskType = 'regression' | 'classification';
export type ModelType = 'linear' | 'ridge' | 'lasso' | 'decision_tree' | 'random_forest';

export interface TrainingSample {
  /** Feature vector */
  features: number[];
  /** Target value (regression) or class label (classification) */
  label: number;
  /** Sample metadata */
  metadata?: {
    enzymeId?: string;
    ecNumber?: string;
    organism?: string;
    source?: string;
    reference?: string;
  };
}

export interface Dataset {
  /** Feature names */
  featureNames: string[];
  /** Training samples */
  samples: TrainingSample[];
  /** Task type */
  taskType: TaskType;
}

export interface TrainTestSplit {
  train: Dataset;
  test: Dataset;
}

export interface ModelMetrics {
  /** Mean Absolute Error (regression) */
  mae: number;
  /** Root Mean Squared Error (regression) */
  rmse: number;
  /** R² score (regression) */
  r2: number;
  /** Accuracy (classification) */
  accuracy?: number;
  /** F1 score (classification) */
  f1?: number;
}

export interface FeatureImportance {
  featureName: string;
  importance: number;
  rank: number;
}

export interface TrainedModel {
  /** Model type */
  type: ModelType;
  /** Model weights/parameters */
  weights: number[];
  /** Feature names */
  featureNames: string[];
  /** Training metrics */
  trainMetrics: ModelMetrics;
  /** Test metrics */
  testMetrics: ModelMetrics;
  /** Feature importances */
  featureImportances: FeatureImportance[];
  /** Metadata */
  metadata: {
    trainedAt: number;
    nSamples: number;
    nFeatures: number;
  };
}

export interface PredictionResult {
  predictedValue: number;
  confidence: number;
  featureContributions: Record<string, number>;
}
