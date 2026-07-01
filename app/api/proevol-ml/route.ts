/**
 * ProEvol ML API — Sequence→Fitness surrogate
 *
 * Trains a supervised ML surrogate (src/modules/ml) on a ProEvol campaign's
 * screened variants and returns evaluation metrics, feature importances, and
 * (optionally) fitness predictions for supplied candidate sequences.
 *
 * POST body:
 *   {
 *     artifact: ProEvolArtifact,          // required
 *     modelType?: "linear"|"ridge"|"lasso"|"decision_tree"|"random_forest",
 *     seed?: number,
 *     predictSequences?: string[]          // optional candidates to score
 *   }
 *
 * Reproducible: split + RandomForest sampling are seeded.
 */

import { NextResponse } from "next/server";
import { isProEvolArtifact } from "../../../src/domain/proevolArtifact";
import { predictVariantFitness, trainProEvolFitnessModel } from "../../../src/services/proevolML";
import type { ModelType } from "../../../src/modules/ml";
import { ProEvolMLRequestSchema, validateSchema } from "../../../src/schemas";
import { getCorsHeaders, handleOptions } from "../../../src/utils/cors";
import { errorResponse } from "../../../src/utils/apiErrors";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const VALID_MODELS: ModelType[] = ["linear", "ridge", "lasso", "decision_tree", "random_forest"];

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400, undefined, getCorsHeaders(req));
  }

  const parsed = validateSchema(ProEvolMLRequestSchema, body);
  if (!parsed.ok) {
    return errorResponse("Invalid request body", 400, { errors: parsed.errors }, getCorsHeaders(req));
  }
  const b = parsed.data as Record<string, unknown>;
  if (!isProEvolArtifact(b.artifact)) {
    return errorResponse("Missing or invalid `artifact` (expected a ProEvolArtifact)", 400, undefined, getCorsHeaders(req));
  }

  const modelType = VALID_MODELS.includes(b.modelType as ModelType) ? (b.modelType as ModelType) : "ridge";
  const seed = typeof b.seed === "number" ? b.seed : 42;

  const fit = trainProEvolFitnessModel(b.artifact, { modelType, seed });
  if (!fit) {
    return errorResponse(
      "Not enough labeled variants to train a fitness surrogate (need >= 8 with a numeric fitness label).",
      422,
      undefined,
      getCorsHeaders(req),
    );
  }

  let predictions: Array<{ sequence: string; predictedFitness: number }> | undefined;
  if (Array.isArray(b.predictSequences) && b.predictSequences.every((s) => typeof s === "string")) {
    const seqs = b.predictSequences as string[];
    const preds = predictVariantFitness(fit, seqs);
    predictions = seqs.map((sequence, i) => ({ sequence, predictedFitness: preds[i] }));
  }

  return NextResponse.json(
    {
      ok: true,
      modelType: fit.modelType,
      labelSource: fit.labelSource,
      nSamples: fit.nSamples,
      nTrain: fit.nTrain,
      nTest: fit.nTest,
      trainMetrics: fit.trainMetrics,
      testMetrics: fit.testMetrics,
      crossValidationMetrics: fit.crossValidationMetrics,
      topFeatures: fit.featureImportances.slice(0, 15),
      predictions,
    },
    { headers: getCorsHeaders(req) },
  );
}
