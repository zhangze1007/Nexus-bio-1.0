/**
 * ESM-2 API Route — Protein Language Model Embeddings
 *
 * Cascade for real protein embeddings:
 *   1. ESM-2 Python backend (ESM2_PYTHON_BACKEND env var) — full model, 320-1280 dim
 *   2. ESM Atlas foldSequence — returns PDB structure, not embeddings (fallback)
 *   3. Local Atchley factors — 5-dim physicochemical (final fallback)
 *
 * Reference: Lin et al. (2023) Science 379:1123-1130
 * Python service: scspatial-backend/esm2_service.py
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders, handleOptions } from '../../../src/utils/cors';

export const runtime = 'edge';

const ESM2_TIMEOUT = 30000;

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}

/**
 * POST /api/esm2
 *
 * Body: { sequence: string, model?: string, returnEmbeddings?: boolean }
 * Returns: { ok, embeddings: number[][], model, sequence, ... }
 *
 * Embedding cascade:
 *   1. ESM2_PYTHON_BACKEND/esm2/analyze (real ESM-2, 320-1280 dim)
 *   2. ESM Atlas foldSequence (PDB only, falls back to Atchley for embeddings)
 *   3. Local Atchley factors (5-dim, offline)
 */
export async function POST(req: NextRequest) {
  const requestId = `esm2_${Date.now().toString(36)}`;

  try {
    const body = await req.json();
    const { sequence, model = 'esm2_t6_8M_UR50D', returnEmbeddings = true } = body;

    if (!sequence || typeof sequence !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Missing or invalid sequence', requestId },
        { status: 400, headers: getCorsHeaders(req) },
      );
    }

    const cleanSeq = sequence.toUpperCase().replace(/[^ACDEFGHIKLMNPQRSTVWY]/g, '');
    if (cleanSeq.length < 5) {
      return NextResponse.json(
        { ok: false, error: 'Sequence too short (minimum 5 residues)', requestId },
        { status: 400, headers: getCorsHeaders(req) },
      );
    }

    // ── Cascade 1: ESM-2 Python backend (real embeddings) ──────────────
    const esm2Backend = process.env.ESM2_PYTHON_BACKEND;
    if (esm2Backend) {
      try {
        const startTime = Date.now();
        const backendRes = await fetch(`${esm2Backend}/esm2/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sequence: cleanSeq,
            model,
            returnEmbeddings,
            returnContacts: false,
          }),
          signal: AbortSignal.timeout(ESM2_TIMEOUT),
        });

        if (backendRes.ok) {
          const data = await backendRes.json();
          if (data.ok && data.embeddings && Array.isArray(data.embeddings)) {
            return NextResponse.json(
              {
                ok: true,
                embeddings: data.embeddings,
                model: data.model || model,
                sequence: cleanSeq,
                embeddingDim: data.embedding_dim || (data.embeddings[0]?.length ?? 0),
                requestId,
                durationMs: Date.now() - startTime,
                source: 'esm2_python_backend',
              },
              { headers: { ...getCorsHeaders(req), 'Cache-Control': 'public, max-age=86400, s-maxage=604800' } },
            );
          }
        }
      } catch (backendErr) {
        // Python backend unavailable, fall through to Atlas
        console.warn('[ESM-2] Python backend unavailable, falling back:', backendErr);
      }
    }

    // ── Cascade 2: ESM Atlas foldSequence (PDB structure) ──────────────
    try {
      const startTime = Date.now();
      const atlasRes = await fetch('https://api.esmatlas.com/foldSequence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `sequence=${encodeURIComponent(cleanSeq)}`,
        signal: AbortSignal.timeout(ESM2_TIMEOUT),
      });

      if (atlasRes.ok) {
        const atlasData = await atlasRes.json();
        // Atlas returns PDB, not embeddings — compute Atchley factors as embedding proxy
        const embeddings = computeLocalEmbeddings(cleanSeq);
        return NextResponse.json(
          {
            ok: true,
            pdb: atlasData.pdb || '',
            embeddings,
            model: 'esm_atlas + atchley_fallback',
            sequence: cleanSeq,
            requestId,
            durationMs: Date.now() - startTime,
            source: 'esm_atlas',
            fallback: true,
          },
          { headers: { ...getCorsHeaders(req), 'Cache-Control': 'public, max-age=86400, s-maxage=604800' } },
        );
      }
    } catch (atlasErr) {
      console.warn('[ESM-2] Atlas API unavailable, using local fallback:', atlasErr);
    }

    // ── Cascade 3: Local Atchley factors (offline fallback) ────────────
    const embeddings = computeLocalEmbeddings(cleanSeq);
    return NextResponse.json(
      {
        ok: true,
        embeddings,
        model: 'local_atchley_approximation',
        sequence: cleanSeq,
        requestId,
        durationMs: 0,
        source: 'local_atchley',
        fallback: true,
      },
      { headers: { ...getCorsHeaders(req), 'Cache-Control': 'public, max-age=3600' } },
    );
  } catch (error) {
    // Final fallback: try to extract sequence and compute local embeddings
    let sequence = '';
    try {
      const body = await req.clone().json();
      sequence = (body?.sequence || '').toUpperCase().replace(/[^ACDEFGHIKLMNPQRSTVWY]/g, '');
    } catch {
      // Cannot parse body
    }

    if (sequence.length >= 5) {
      const localEmbeddings = computeLocalEmbeddings(sequence);
      return NextResponse.json(
        {
          ok: true,
          embeddings: localEmbeddings,
          model: 'local_atchley_approximation',
          sequence,
          requestId,
          durationMs: 0,
          source: 'local_atchley',
          fallback: true,
        },
        { headers: getCorsHeaders(req) },
      );
    }

    return NextResponse.json(
      { ok: false, error: String(error), requestId },
      { status: 500, headers: getCorsHeaders(req) },
    );
  }
}

/**
 * Compute local embeddings using Atchley amino acid property factors.
 * Fallback when ESM-2 API is unavailable.
 *
 * Uses 5 Atchley factors (published, peer-reviewed) per residue:
 *   Factor 1: Polarity/hydrophobicity
 *   Factor 2: Molecular size
 *   Factor 3: Charge
 *   Factor 4: Helix propensity
 *   Factor 5: Isoelectric point
 *
 * Reference: Atchley et al. (2005) PNAS 102:6395-6400
 *
 * These are REAL published values, not approximations.
 * For production use, ESM-2 Python backend provides 320-1280 dim embeddings per residue.
 */
function computeLocalEmbeddings(sequence: string): number[][] {
  // Atchley factors from Table 1 of Atchley et al. 2005
  const atchleyFactors: Record<string, number[]> = {
    A: [-0.591, -1.302, -0.733, 1.570, -0.146],
    C: [-1.343, 0.465, -0.862, -1.020, -0.255],
    D: [1.050, 0.302, -3.656, -0.259, -3.242],
    E: [1.357, -1.453, 1.477, 0.113, -0.837],
    F: [-1.006, -0.590, 1.891, -0.397, 0.412],
    G: [-0.384, 1.652, 1.330, 1.045, 2.064],
    H: [0.336, -0.417, -1.673, -1.474, -0.078],
    I: [-1.239, -0.547, 2.131, 0.393, 0.816],
    K: [1.831, -0.561, 0.533, -0.277, 1.648],
    L: [-1.019, -0.987, -1.505, 1.266, -0.912],
    M: [-0.663, -1.524, 2.219, -1.005, 1.212],
    N: [0.945, 0.828, 1.299, -0.169, 0.933],
    P: [0.189, 2.081, -1.628, 0.421, -1.392],
    Q: [0.931, -0.179, -3.005, -0.503, -1.853],
    R: [1.538, -0.055, 1.502, 0.440, 2.897],
    S: [-0.228, 1.399, -4.760, 0.670, -2.647],
    T: [-0.032, 0.326, 2.213, 0.908, 1.313],
    V: [-1.337, -0.279, -0.544, 1.242, -1.262],
    W: [-0.595, 0.009, 0.672, -2.128, -0.184],
    Y: [0.260, 0.830, 3.097, -0.838, 1.512],
  };

  return sequence.split('').map(aa => {
    const factors = atchleyFactors[aa];
    if (factors) return factors;
    // Unknown amino acid: return neutral values
    return [0, 0, 0, 0, 0];
  });
}
