/**
 * ESM-3 API Route — Multimodal Generative Protein Language Model
 *
 * Supports two modes:
 *   1. Generate: De novo protein sequence generation conditioned on function/fold
 *   2. Fold: Protein structure prediction (ESM-3 or ESMFold)
 *
 * Cascade for real ESM-3:
 *   1. ESM3_PYTHON_BACKEND (env var) — full ESM-3 model
 *   2. ESM Atlas foldSequence — structure prediction
 *   3. Local heuristic — amino-acid-composition-based fallback
 *
 * Reference: Hayes et al. (2024) EvolutionaryScale
 * License: MIT (EvolutionaryScale)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders, handleOptions } from '../../../src/utils/cors';
import { SeededRNG } from '../../../src/utils/seededRng';
import { perResiduePlddt } from '../../../src/utils/pdbParser';

export const runtime = 'edge';

const ESM3_TIMEOUT = 60000;

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}

/**
 * POST /api/esm3
 *
 * Generate mode:
 *   Body: { mode: "generate", function?: string, fold?: string, targetLength?: number,
 *           numSequences?: number, temperature?: number, fixedResidues?: Array, scaffold?: string }
 *   Returns: { ok, sequences: [...], model, source, metadata }
 *
 * Fold mode:
 *   Body: { mode: "fold", sequence: string, fullAtom?: boolean }
 *   Returns: { ok, pdb: string, confidence: number[], avgConfidence, model }
 */
export async function POST(req: NextRequest) {
  const requestId = `esm3_${Date.now().toString(36)}`;

  try {
    const body: ESM3RequestBody = await req.json();
    const { mode = "generate" } = body;

    if (mode === "fold") {
      return handleFold(body, req, requestId);
    }
    return handleGenerate(body, req, requestId);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Internal server error", requestId },
      { status: 500, headers: getCorsHeaders(req) },
    );
  }
}

interface ESM3FoldBody {
  mode?: string;
  sequence?: unknown;
  fullAtom?: boolean;
}

interface ESM3GenerateBody {
  mode?: string;
  function?: string;
  fold?: string;
  targetLength?: number;
  numSequences?: number;
  temperature?: number;
  fixedResidues?: Array<{ position: number; aminoAcid: string }>;
  scaffold?: string;
}

type ESM3RequestBody = ESM3FoldBody | ESM3GenerateBody;

async function handleFold(body: ESM3FoldBody, req: NextRequest, requestId: string) {
  const { sequence, fullAtom = false } = body;

  if (!sequence || typeof sequence !== "string") {
    return NextResponse.json(
      { ok: false, error: "Missing sequence for fold mode", requestId },
      { status: 400, headers: getCorsHeaders(req) },
    );
  }

  const cleanSeq = sequence.toUpperCase().replace(/[^ACDEFGHIKLMNPQRSTVWY]/g, "");
  if (cleanSeq.length < 10) {
    return NextResponse.json(
      { ok: false, error: "Sequence too short (min 10 residues)", requestId },
      { status: 400, headers: getCorsHeaders(req) },
    );
  }

  // Try ESM3 backend first
  const esm3Backend = process.env.ESM3_PYTHON_BACKEND;
  if (esm3Backend) {
    try {
      const resp = await fetch(`${esm3Backend}/esm3/fold`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sequence: cleanSeq, fullAtom }),
        signal: AbortSignal.timeout(ESM3_TIMEOUT),
      });
      if (resp.ok) {
        const data = await resp.json();
        return NextResponse.json(
          { ...data, ok: true, requestId },
          { headers: getCorsHeaders(req) },
        );
      }
    } catch {
      // Fall through to ESM Atlas
    }
  }

  // Try ESM Atlas foldSequence
  try {
    const resp = await fetch("https://api.esmatlas.com/foldSequence/v1/pdb/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `sequence=${encodeURIComponent(cleanSeq)}`,
      signal: AbortSignal.timeout(ESM3_TIMEOUT),
    });
    if (resp.ok) {
      const pdb = await resp.text();
      // Real per-residue pLDDT parsed from the ESMFold / ESM Atlas PDB B-factor
      // column (ESMFold encodes pLDDT there). Previously this fabricated the
      // confidence with an unseeded random draw — now it reports the model's
      // actual per-residue values.
      const confidence = perResiduePlddt(pdb);
      const avgConfidence = confidence.length
        ? Math.round((confidence.reduce((a, b) => a + b, 0) / confidence.length) * 100) / 100
        : 0;
      return NextResponse.json(
        {
          ok: true,
          pdb,
          confidence,
          avgConfidence: Math.round(avgConfidence * 100) / 100,
          model: "esm_atlas",
          requestId,
        },
        { headers: getCorsHeaders(req) },
      );
    }
  } catch {
    // Fall through to local heuristic
  }

  // Local fallback: return a poly-alanine backbone as placeholder
  const pdb = generatePolyAlaninePDB(cleanSeq.length);
  const confidence = Array.from({ length: cleanSeq.length }, () => 0.3);
  return NextResponse.json(
    {
      ok: true,
      pdb,
      confidence,
      avgConfidence: 0.3,
      model: "local_heuristic",
      requestId,
      warning: "No ESM-3 backend available. Returning placeholder structure.",
    },
    { headers: getCorsHeaders(req) },
  );
}

async function handleGenerate(body: ESM3GenerateBody, req: NextRequest, requestId: string) {
  const {
    function: targetFunction,
    fold,
    targetLength = 200,
    numSequences = 3,
    temperature = 0.7,
    fixedResidues,
    scaffold,
  } = body;

  if (targetLength < 30 || targetLength > 2000) {
    return NextResponse.json(
      { ok: false, error: "targetLength must be 30-2000", requestId },
      { status: 400, headers: getCorsHeaders(req) },
    );
  }

  const startTime = Date.now();

  // Try ESM3 backend first
  const esm3Backend = process.env.ESM3_PYTHON_BACKEND;
  if (esm3Backend) {
    try {
      const resp = await fetch(`${esm3Backend}/esm3/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          function: targetFunction,
          fold,
          target_length: targetLength,
          num_sequences: numSequences,
          temperature,
          fixed_residues: fixedResidues,
          scaffold,
        }),
        signal: AbortSignal.timeout(ESM3_TIMEOUT),
      });
      if (resp.ok) {
        const data = await resp.json();
        return NextResponse.json(
          {
            ok: true,
            sequences: data.sequences,
            model: "esm3",
            source: "esm3_backend",
            metadata: {
              temperature,
              targetLength,
              function: targetFunction,
              fold,
              generationTime: Date.now() - startTime,
            },
            requestId,
          },
          { headers: getCorsHeaders(req) },
        );
      }
    } catch {
      // Fall through to local heuristic
    }
  }

  // Local heuristic fallback — seeded so identical requests are reproducible.
  // Seed derived from request inputs (deterministic per request, differs across
  // requests). These are HEURISTIC estimates, not ESM-3 model outputs.
  let seed = targetLength * 31 + numSequences * 7;
  for (const ch of (targetFunction ?? "") + (fold ?? "")) seed = (seed * 33 + ch.charCodeAt(0)) & 0x7fffffff;
  const rng = new SeededRNG(seed || 42);

  const sequences = [];
  const AMINO_ACIDS = "ACDEFGHIKLMNPQRSTVWY";
  const functionBiases: Record<string, string> = {
    enzyme: "DEKRHSTNQ",
    structural: "GAPVLIMFW",
    binding: "DEKRHSTNQYW",
    fluorescent: "SYWTGALVMF",
    membrane: "LIVMFCAW",
    soluble: "DEKRHSTNQP",
  };

  let biasSet = AMINO_ACIDS;
  if (targetFunction) {
    const funcLower = targetFunction.toLowerCase();
    for (const [key, bias] of Object.entries(functionBiases)) {
      if (funcLower.includes(key)) {
        biasSet = bias;
        break;
      }
    }
  }

  for (let n = 0; n < numSequences; n++) {
    let sequence = "";
    for (let i = 0; i < targetLength; i++) {
      // Apply fixed residues
      const fixed = fixedResidues?.find((f) => f.position === i);
      if (fixed) {
        sequence += fixed.aminoAcid.toUpperCase();
        continue;
      }
      // Bias toward function-relevant residues
      if (biasSet !== AMINO_ACIDS && rng.next() < 0.3) {
        sequence += biasSet[Math.floor(rng.next() * biasSet.length)];
      } else {
        sequence += AMINO_ACIDS[Math.floor(rng.next() * AMINO_ACIDS.length)];
      }
    }
    const hydrophobic = (sequence.match(/[LIVMFWCA]/g) || []).length / sequence.length;
    sequences.push({
      sequence,
      length: sequence.length,
      foldability: Math.round((0.4 + 0.3 * hydrophobic + 0.15 * rng.next()) * 100) / 100,
      functionConfidence: Math.round((0.2 + 0.25 * (biasSet.length / 20) + 0.15 * rng.next()) * 100) / 100,
      stabilityEstimate: Math.round((-5 + 10 * rng.next()) * 100) / 100,
      // Provenance: heuristic estimate, NOT ESM-3 model confidence.
      scoreType: "heuristic_estimate",
    });
  }

  return NextResponse.json(
    {
      ok: true,
      sequences,
      model: "local_heuristic",
      source: "local_heuristic",
      metadata: {
        temperature,
        targetLength,
        function: targetFunction,
        fold,
        generationTime: Date.now() - startTime,
      },
      requestId,
      warning: "No ESM-3 backend available. Using local heuristic (not real ESM-3).",
      // Machine-readable flag: foldability/functionConfidence are heuristic
      // estimates, not ESM-3 model confidence. UI must not present them as such.
      scoresAreHeuristic: true,
    },
    { headers: getCorsHeaders(req) },
  );
}

/**
 * Generate a minimal poly-alanine PDB as placeholder.
 */
function generatePolyAlaninePDB(length: number): string {
  const lines = ["HEADER    PLACEHOLDER STRUCTURE"];
  for (let i = 0; i < length; i++) {
    const resSeq = (i + 1).toString().padStart(4);
    const x = (Math.cos(i * 0.6) * 3.8).toFixed(3).padStart(8);
    const y = (Math.sin(i * 0.6) * 3.8).toFixed(3).padStart(8);
    const z = (i * 3.8).toFixed(3).padStart(8);
    lines.push(
      `ATOM  ${(i * 5 + 1).toString().padStart(5)} N   ALA A${resSeq}    ${x}${y}${z}  1.00  0.00           N  `,
    );
    lines.push(
      `ATOM  ${(i * 5 + 2).toString().padStart(5)} CA  ALA A${resSeq}    ${(parseFloat(x) + 1.459).toFixed(3).padStart(8)}${y}${z}  1.00  0.00           C  `,
    );
    lines.push(
      `ATOM  ${(i * 5 + 3).toString().padStart(5)} C   ALA A${resSeq}    ${(parseFloat(x) + 2.0).toFixed(3).padStart(8)}${(parseFloat(y) + 1.0).toFixed(3).padStart(8)}${z}  1.00  0.00           C  `,
    );
    lines.push(
      `ATOM  ${(i * 5 + 4).toString().padStart(5)} O   ALA A${resSeq}    ${(parseFloat(x) + 1.5).toFixed(3).padStart(8)}${(parseFloat(y) + 2.0).toFixed(3).padStart(8)}${z}  1.00  0.00           O  `,
    );
    lines.push(
      `ATOM  ${(i * 5 + 5).toString().padStart(5)} CB  ALA A${resSeq}    ${(parseFloat(x) + 0.5).toFixed(3).padStart(8)}${(parseFloat(y) - 1.2).toFixed(3).padStart(8)}${z}  1.00  0.00           C  `,
    );
  }
  lines.push("END");
  return lines.join("\n");
}
