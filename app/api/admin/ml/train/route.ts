/**
 * Admin ML Training API
 *
 * POST /api/admin/ml/train — Train a new linear regression model.
 * GET  /api/admin/ml/train — List all trained models.
 */

import { NextResponse } from "next/server";
import {
  trainModel,
  listModels,
  type TrainingData,
  type TrainingConfig,
} from "../../../../../src/services/ml/modelTraining";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── POST — Train ───────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  let body: {
    trainingData?: { featureNames?: string[]; rows?: { features?: Record<string, number>; target?: number }[] };
    config?: TrainingConfig;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  // ── Validate trainingData ──
  const td = body.trainingData;
  if (!td || !Array.isArray(td.featureNames) || !Array.isArray(td.rows)) {
    return NextResponse.json(
      { ok: false, error: "trainingData must have featureNames (string[]) and rows (array)" },
      { status: 400 },
    );
  }

  if (td.featureNames.length === 0) {
    return NextResponse.json(
      { ok: false, error: "featureNames must not be empty" },
      { status: 400 },
    );
  }

  if (td.rows.length === 0) {
    return NextResponse.json(
      { ok: false, error: "training rows must not be empty" },
      { status: 400 },
    );
  }

  for (let i = 0; i < td.rows.length; i++) {
    const row = td.rows[i];
    if (!row.features || typeof row.target !== "number") {
      return NextResponse.json(
        { ok: false, error: `Row ${i}: must have features (object) and target (number)` },
        { status: 400 },
      );
    }
  }

  const trainingData: TrainingData = {
    featureNames: td.featureNames,
    rows: td.rows.map((r) => ({
      features: r.features as Record<string, number>,
      target: r.target as number,
    })),
  };

  try {
    const result = await trainModel(trainingData, body.config ?? {});
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[api/admin/ml/train] POST error:', err);
    return NextResponse.json({ ok: false, error: 'An internal error occurred' }, { status: 500 });
  }
}

// ── GET — List Models ──────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  try {
    const models = await listModels();
    return NextResponse.json({ ok: true, models });
  } catch (err) {
    console.error('[api/admin/ml/train] GET error:', err);
    return NextResponse.json({ ok: false, error: 'An internal error occurred' }, { status: 500 });
  }
}
