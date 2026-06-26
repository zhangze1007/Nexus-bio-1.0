/**
 * ML Prediction API — POST /api/ml/predict
 *
 * Accepts a PredictionRequest (modelId + inputs) and returns inference results.
 * Uses Edge Runtime for low latency; ONNX model loading is dynamic and cached.
 */

import { NextRequest, NextResponse } from 'next/server';
import { predict } from '../../../../src/services/ml/predictor';
import type { PredictionRequest } from '../../../../src/services/ml/types';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const body: PredictionRequest = await request.json();

    if (!body.modelId) {
      return NextResponse.json(
        { error: 'modelId is required' },
        { status: 400 },
      );
    }

    if (!body.inputs || typeof body.inputs !== 'object') {
      return NextResponse.json(
        { error: 'inputs object is required' },
        { status: 400 },
      );
    }

    const result = await predict(body);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Prediction failed';
    // Model-not-found and missing-input errors are client errors (400/404)
    const status = message.startsWith('Model not found')
      ? 404
      : message.startsWith('Missing input')
        ? 400
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
