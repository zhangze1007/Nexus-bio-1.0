/**
 * ML Models API — GET /api/ml/models
 *
 * Returns the list of all registered models with their metadata and I/O schemas.
 */

import { NextResponse } from 'next/server';
import { listModels } from '../../../../src/services/ml/modelRegistry';

export const runtime = 'edge';

export async function GET() {
  return NextResponse.json({ models: listModels() });
}
