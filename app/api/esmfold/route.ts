/**
 * ESMFold API Route — Protein Structure Prediction
 *
 * Prefers ESMFold2 (Biohub hosted inference, MIT) when a BIOHUB_API_KEY is
 * configured, and falls back to the EBI ESMFold service otherwise. If neither
 * backend is reachable the route fails closed (returns an error) — it NEVER
 * fabricates a structure. The response always states which backend + model
 * actually produced the result (`source`: 'esmfold2' | 'esmfold-ebi' | 'unavailable').
 *
 * ESMFold2 REST contract (from the official ESM SDK SequenceStructureForge-
 * InferenceClient, github.com/Biohub/esm — base_forge_client.py + forge.py):
 *   POST  {BIOHUB_API_URL}/api/v1/fold
 *   Header: Authorization: Bearer <token>
 *   Body:   { "sequence": string, "model": "esmfold2-fast-2026-05", ... }
 *   Reply:  { "coordinates": [...], "plddt": [...], "ptm": number, "pae": [...] }
 *           (all-atom coordinates + confidence — NOT PDB text; a coordinate→PDB
 *            step is required downstream to render it, tracked separately.)
 * Guardrails: the SDK client carries no sequence-of-concern refusal; any server-
 * side screening for controlled pathogen/toxin sequences is undocumented in the
 * public sources. See the goal report for the full findings.
 *
 * References: Lin et al. (2023) Science 379:1123-1130 (ESMFold); Biohub ESMFold2
 * (https://biohub.ai/models/esmfold2). EBI: https://www.ebi.ac.uk/tools/esmfold/
 */

import { type NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, handleOptions } from "../../../src/utils/cors";

export const runtime = "edge";

const EBI_ESMFOLD_API = "https://www.ebi.ac.uk/tools/esmfold/api/predict";
const EBI_MODEL_LABEL = "ESMFold (ESM-2 650M, EBI)"; // EBI ESMFold is ESM-2 650M — not "ESM-2 (8M)"
const BIOHUB_API_URL = (process.env.BIOHUB_API_URL || "https://biohub.ai").replace(/\/+$/, "");
const BIOHUB_ESMFOLD2_MODEL = process.env.BIOHUB_ESMFOLD2_MODEL || "esmfold2-fast-2026-05";
const TIMEOUT = 60000; // 60s

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}

type Esm2Result = { ok: true; data: Record<string, unknown> } | { ok: false; error: string; noKey?: boolean };

/** ESMFold2 via the Biohub hosted API. Requires BIOHUB_API_KEY (read here, never hardcoded or echoed). */
async function callESMFold2(cleanSeq: string): Promise<Esm2Result> {
  const key = process.env.BIOHUB_API_KEY;
  if (!key) return { ok: false, error: "ESMFold2 not configured (BIOHUB_API_KEY unset)", noKey: true };
  try {
    const resp = await fetch(`${BIOHUB_API_URL}/api/v1/fold`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ sequence: cleanSeq, model: BIOHUB_ESMFOLD2_MODEL }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      return { ok: false, error: `ESMFold2 HTTP ${resp.status}: ${detail.slice(0, 200)}` };
    }
    const raw = (await resp.json()) as Record<string, unknown>;
    // base_forge_client wraps outputs under `outputs` or `data`; unwrap defensively.
    const out = ((raw.outputs ?? raw.data ?? raw) as Record<string, unknown>) || {};
    if (out.coordinates == null) return { ok: false, error: "ESMFold2 response missing coordinates" };
    return { ok: true, data: out };
  } catch (e) {
    return { ok: false, error: `ESMFold2 unreachable: ${e instanceof Error ? e.message : String(e)}` };
  }
}

type EbiResult = { ok: true; pdb: string; plddt: number } | { ok: false; error: string };

/** EBI ESMFold (single-sequence, returns PDB text). */
async function callEBI(cleanSeq: string): Promise<EbiResult> {
  try {
    const resp = await fetch(EBI_ESMFOLD_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sequence: cleanSeq }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => "Unknown error");
      return { ok: false, error: `EBI ESMFold HTTP ${resp.status}: ${detail.slice(0, 200)}` };
    }
    const result = (await resp.json()) as { pdb?: string; structure?: string; plddt?: number; confidence?: number };
    const pdb = result.pdb || result.structure || "";
    const plddt = result.plddt || result.confidence || 0;
    if (!pdb) return { ok: false, error: "EBI ESMFold returned an empty structure" };
    return { ok: true, pdb, plddt };
  } catch (e) {
    return { ok: false, error: `EBI ESMFold unreachable: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * POST /api/esmfold — Body: { sequence: string, name?: string }
 * Returns (200): ESMFold2 -> { source:'esmfold2', format:'coordinates', coordinates, plddt, ptm, ... }
 *                EBI      -> { source:'esmfold-ebi', format:'pdb', pdb, plddt, ... }
 * Returns (503): { source:'unavailable', error } — fail closed, never a fabricated structure.
 */
export async function POST(req: NextRequest) {
  const requestId = `esmfold_${Date.now().toString(36)}`;

  let body: { sequence?: unknown; name?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body", requestId },
      { status: 400, headers: getCorsHeaders(req) },
    );
  }
  const sequence = body.sequence;
  const name = typeof body.name === "string" ? body.name : undefined;

  if (!sequence || typeof sequence !== "string") {
    return NextResponse.json(
      { ok: false, error: "Missing or invalid sequence", requestId },
      { status: 400, headers: getCorsHeaders(req) },
    );
  }
  const cleanSeq = sequence.toUpperCase().replace(/[^ACDEFGHIKLMNPQRSTVWY]/g, "");
  if (cleanSeq.length < 10) {
    return NextResponse.json(
      { ok: false, error: "Sequence too short (minimum 10 residues)", requestId },
      { status: 400, headers: getCorsHeaders(req) },
    );
  }
  if (cleanSeq.length > 1500) {
    return NextResponse.json(
      { ok: false, error: "Sequence too long (maximum 1500 residues)", requestId },
      { status: 400, headers: getCorsHeaders(req) },
    );
  }

  const startTime = Date.now();
  const errors: string[] = [];
  const cacheHeaders = { ...getCorsHeaders(req), "Cache-Control": "public, max-age=86400, s-maxage=604800" };

  // 1) Prefer ESMFold2 (Biohub) when a key is configured.
  const r2 = await callESMFold2(cleanSeq);
  if (r2.ok) {
    return NextResponse.json(
      {
        ok: true,
        source: "esmfold2",
        model: BIOHUB_ESMFOLD2_MODEL,
        format: "coordinates",
        coordinates: r2.data.coordinates,
        plddt: r2.data.plddt ?? null,
        ptm: r2.data.ptm ?? null,
        pae: r2.data.pae ?? null,
        sequence: cleanSeq,
        name: name || "ESMFold2 prediction",
        requestId,
        durationMs: Date.now() - startTime,
      },
      { headers: cacheHeaders },
    );
  }
  if (!r2.noKey) errors.push(r2.error); // a missing key is not an error, just "not configured"

  // 2) Fallback: EBI ESMFold (returns PDB).
  const rEbi = await callEBI(cleanSeq);
  if (rEbi.ok) {
    return NextResponse.json(
      {
        ok: true,
        source: "esmfold-ebi",
        model: EBI_MODEL_LABEL,
        format: "pdb",
        pdb: rEbi.pdb,
        plddt: Math.round(rEbi.plddt * 100) / 100,
        sequence: cleanSeq,
        name: name || "ESMFold prediction",
        requestId,
        durationMs: Date.now() - startTime,
      },
      { headers: cacheHeaders },
    );
  }
  errors.push(rEbi.error);

  // 3) Both backends unavailable — fail closed. NEVER return a fabricated structure.
  return NextResponse.json(
    {
      ok: false,
      source: "unavailable",
      error: `No structure-prediction backend available. ${errors.join(" | ")}`,
      requestId,
      fallback: "/api/alphafold",
    },
    { status: 503, headers: getCorsHeaders(req) },
  );
}

/** GET /api/esmfold?sequence=MKT... — convenience wrapper over POST. */
export async function GET(req: NextRequest) {
  const sequence = req.nextUrl.searchParams.get("sequence");
  if (!sequence) {
    return NextResponse.json(
      { ok: false, error: "Missing ?sequence= parameter" },
      { status: 400, headers: getCorsHeaders(req) },
    );
  }
  const fakeReq = new Request(req.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sequence }),
  }) as NextRequest;
  return POST(fakeReq);
}
