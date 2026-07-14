import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders, handleOptions } from '../../../src/utils/cors';
import { errorResponse } from '../../../src/utils/apiErrors';

interface ProteinChain {
  sequence: string;
  id?: string;
}

interface Ligand {
  smiles: string;
  id?: string;
}

interface ComplexRequestBody {
  mode?: "complex";
  proteins?: ProteinChain[];
  ligands?: Ligand[];
  dna?: string;
  rna?: string;
}

interface DockRequestBody {
  mode: "dock";
  proteinPdb: string;
  ligandSmiles: string;
}

type AlphafoldRequestBody = ComplexRequestBody | DockRequestBody;

export const runtime = 'edge';

const MIN_VALID_PDB_LENGTH = 100;

/** Whitelist of domains we're allowed to fetch PDB data from (SSRF prevention). */
const ALLOWED_PDB_HOSTS = new Set([
  'alphafold.ebi.ac.uk',
  'www.rcsb.org',
  'files.rcsb.org',
]);

function isAllowedPdbUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    return url.protocol === 'https:' && ALLOWED_PDB_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}

/**
 * GET /api/alphafold?id=<UniProtID>
 *
 * Fetch single-chain AlphaFold PDB structure (existing behavior).
 */
export async function GET(req: NextRequest) {
  const headers: Record<string, string> = {
    'Content-Type': 'text/plain',
    'Cache-Control': 'public, max-age=86400, s-maxage=604800', // 1 day browser, 7 days CDN
    ...getCorsHeaders(req),
  };

  const uniprotId = req.nextUrl.searchParams.get('id');

  if (!uniprotId) {
    return errorResponse('Missing id parameter', 400, undefined, getCorsHeaders(req));
  }

  // Sanitize — only allow valid UniProt ID format
  if (!/^[A-Z0-9]{6,10}$/i.test(uniprotId)) {
    return errorResponse('Invalid UniProt ID', 400, undefined, getCorsHeaders(req));
  }

  try {
    // Strategy 1: Use the AlphaFold prediction API to get the current download URL
    const apiUrl = `https://alphafold.ebi.ac.uk/api/prediction/${uniprotId}`;
    const apiRes = await fetch(apiUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    if (apiRes.ok) {
      const entries = await apiRes.json();
      const entry = Array.isArray(entries) ? entries[0] : entries;
      const pdbUrl = entry?.pdbUrl;

      if (pdbUrl && isAllowedPdbUrl(pdbUrl)) {
        const pdbRes = await fetch(pdbUrl, { signal: AbortSignal.timeout(8000) });
        if (pdbRes.ok) {
          const pdbData = await pdbRes.text();
          if (pdbData && pdbData.length > MIN_VALID_PDB_LENGTH) {
            return new NextResponse(pdbData, { status: 200, headers });
          }
        }
      }
    }

    // Strategy 2: Try the legacy direct file URL as fallback
    const legacyUrl = `https://alphafold.ebi.ac.uk/files/AF-${uniprotId}-F1-model_v4.pdb`;
    const legacyRes = await fetch(legacyUrl, { signal: AbortSignal.timeout(8000) });

    if (legacyRes.ok) {
      const pdbData = await legacyRes.text();
      if (pdbData && pdbData.length > MIN_VALID_PDB_LENGTH) {
        return new NextResponse(pdbData, { status: 200, headers });
      }
    }

    return errorResponse(`AlphaFold structure not found for ${uniprotId}`, 404, undefined, getCorsHeaders(req));
  } catch (err: unknown) {
    console.error('AlphaFold fetch error:', err);
    return errorResponse('AlphaFold structure fetch failed', 500, undefined, getCorsHeaders(req));
  }
}

/**
 * POST /api/alphafold
 *
 * AlphaFold3 complex prediction and molecular docking.
 *
 * Body: {
 *   mode: "complex" | "dock",
 *   // Complex mode (AF3-style):
 *   proteins?: Array<{ sequence: string, id?: string }>,
 *   ligands?: Array<{ smiles: string, id?: string }>,
 *   dna?: string,
 *   rna?: string,
 *   // Dock mode (DiffDock-style):
 *   proteinPdb?: string,
 *   ligandSmiles?: string,
 * }
 *
 * Returns: { ok, pdb, confidence, model, ... }
 */
export async function POST(req: NextRequest) {
  const requestId = `af3_${Date.now().toString(36)}`;
  const jsonHeaders = { 'Content-Type': 'application/json', ...getCorsHeaders(req) };

  try {
    const contentLength = parseInt(req.headers.get('content-length') ?? '0', 10);
    if (contentLength > 500_000) {
      return NextResponse.json(
        { ok: false, error: "Request body too large (max 500KB)", requestId },
        { status: 413, headers: jsonHeaders },
      );
    }
    const body: AlphafoldRequestBody = await req.json();
    const mode = body.mode ?? "complex";

    if (mode === "dock") {
      return handleDock(body as DockRequestBody, jsonHeaders, requestId);
    }
    return handleComplex(body as ComplexRequestBody, jsonHeaders, requestId);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Internal server error", requestId },
      { status: 500, headers: jsonHeaders },
    );
  }
}

/**
 * Handle AF3-style complex prediction.
 *
 * Cascade:
 *   1. AF3 Python backend (AF3_PYTHON_BACKEND env) — full AF3 model
 *   2. ESM-3 backend (ESM3_PYTHON_BACKEND env) — complex-aware fold
 *   3. Local heuristic — concatenate individual chains with linker
 */
async function handleComplex(
  body: ComplexRequestBody,
  headers: Record<string, string>,
  requestId: string,
) {
  const { proteins, ligands, dna, rna } = body;

  if (!proteins?.length && !dna && !rna) {
    return NextResponse.json(
      { ok: false, error: "At least one protein, DNA, or RNA chain required", requestId },
      { status: 400, headers },
    );
  }

  const startTime = Date.now();

  // Try AF3 backend
  const af3Backend = process.env.AF3_PYTHON_BACKEND;
  if (af3Backend) {
    try {
      const resp = await fetch(`${af3Backend}/af3/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proteins, ligands, dna, rna }),
        signal: AbortSignal.timeout(120000),
      });
      if (resp.ok) {
        const data = await resp.json();
        return NextResponse.json(
          { ...data, ok: true, model: "alphafold3", requestId },
          { headers },
        );
      }
    } catch {
      // Fall through
    }
  }

  // Try ESM-3 backend for complex folding
  const esm3Backend = process.env.ESM3_PYTHON_BACKEND;
  if (esm3Backend) {
    try {
      // Concatenate sequences for multi-chain prediction
      const allSequences = (proteins || []).map((p: ProteinChain) => p.sequence);
      if (dna) allSequences.push(dna);
      if (rna) allSequences.push(rna);

      const resp = await fetch(`${esm3Backend}/esm3/fold`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sequence: allSequences.join(":"),
          complex: true,
          chains: allSequences.length,
        }),
        signal: AbortSignal.timeout(60000),
      });
      if (resp.ok) {
        const data = await resp.json();
        return NextResponse.json(
          {
            ok: true,
            pdb: data.pdb,
            confidence: data.confidence,
            avgConfidence: data.avgConfidence,
            model: "esm3_complex",
            chains: allSequences.length,
            predictionTime: Date.now() - startTime,
            requestId,
          },
          { headers },
        );
      }
    } catch {
      // Fall through to heuristic
    }
  }

  // Local heuristic: generate a multi-chain PDB with linker
  const chains = (proteins || []).map((p: ProteinChain) => p.sequence);
  if (dna) chains.push(dna);
  if (rna) chains.push(rna);

  const pdb = generateMultiChainPDB(chains);
  const avgConfidence = 0.25; // Low confidence for heuristic

  return NextResponse.json(
    {
      ok: true,
      pdb,
      confidence: chains.map((s: string) => Array.from({ length: s.length }, () => 0.25)),
      avgConfidence,
      model: "local_heuristic",
      chains: chains.length,
      predictionTime: Date.now() - startTime,
      requestId,
      warning: "No AF3 backend available. Returning placeholder complex structure.",
    },
    { headers },
  );
}

/**
 * Handle DiffDock-style molecular docking.
 *
 * Cascade:
 *   1. DiffDock backend (DIFFDOCK_PYTHON_BACKEND env)
 *   2. Local heuristic — place ligand near protein centroid
 */
async function handleDock(
  body: DockRequestBody,
  headers: Record<string, string>,
  requestId: string,
) {
  const { proteinPdb, ligandSmiles } = body;

  if (!proteinPdb || !ligandSmiles) {
    return NextResponse.json(
      { ok: false, error: "proteinPdb and ligandSmiles required for dock mode", requestId },
      { status: 400, headers },
    );
  }

  const startTime = Date.now();

  // Try DiffDock backend
  const diffdockBackend = process.env.DIFFDOCK_PYTHON_BACKEND;
  if (diffdockBackend) {
    try {
      const resp = await fetch(`${diffdockBackend}/dock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ protein: proteinPdb, ligand: ligandSmiles }),
        signal: AbortSignal.timeout(120000),
      });
      if (resp.ok) {
        const data = await resp.json();
        return NextResponse.json(
          { ...data, ok: true, model: "diffdock", requestId },
          { headers },
        );
      }
    } catch {
      // Fall through
    }
  }

  // Local heuristic: estimate the binding site from the REAL protein centroid.
  // A docking SCORE is NOT computed offline (a genuine score needs the DiffDock
  // backend), so we report the binding-site estimate only rather than fabricating
  // a number — dockingScore is null and the absence is flagged in `warning`.
  const centroid = estimateProteinCentroid(proteinPdb);

  return NextResponse.json(
    {
      ok: true,
      dockingScore: null,
      bindingSite: {
        x: Math.round(centroid.x * 100) / 100,
        y: Math.round(centroid.y * 100) / 100,
        z: Math.round(centroid.z * 100) / 100,
      },
      confidence: 0.2,
      model: "local_heuristic",
      predictionTime: Date.now() - startTime,
      requestId,
      warning: "No DiffDock backend available — returning an estimated binding site only (no docking score computed).",
    },
    { headers },
  );
}

/**
 * Generate a multi-chain PDB with chain IDs A, B, C, ...
 */
function generateMultiChainPDB(sequences: string[]): string {
  const lines = ["HEADER    MULTI-CHAIN COMPLEX"];
  const chainIds = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let atomIdx = 1;

  for (let c = 0; c < sequences.length; c++) {
    const chainId = chainIds[c] || "X";
    const seq = sequences[c];
    const xOffset = c * 50; // Separate chains spatially

    for (let i = 0; i < seq.length; i++) {
      const resSeq = (i + 1).toString().padStart(4);
      const x = (xOffset + Math.cos(i * 0.6) * 3.8).toFixed(3).padStart(8);
      const y = (Math.sin(i * 0.6) * 3.8).toFixed(3).padStart(8);
      const z = (i * 3.8).toFixed(3).padStart(8);
      const aa = seq[i];

      lines.push(
        `ATOM  ${atomIdx.toString().padStart(5)} N   ${aa.padEnd(3)} ${chainId}${resSeq}    ${x}${y}${z}  1.00  0.00           N  `,
      );
      atomIdx++;
      lines.push(
        `ATOM  ${atomIdx.toString().padStart(5)} CA  ${aa.padEnd(3)} ${chainId}${resSeq}    ${(parseFloat(x) + 1.459).toFixed(3).padStart(8)}${y}${z}  1.00  0.00           C  `,
      );
      atomIdx++;
      lines.push(
        `ATOM  ${atomIdx.toString().padStart(5)} C   ${aa.padEnd(3)} ${chainId}${resSeq}    ${(parseFloat(x) + 2.0).toFixed(3).padStart(8)}${(parseFloat(y) + 1.0).toFixed(3).padStart(8)}${z}  1.00  0.00           C  `,
      );
      atomIdx++;
      lines.push(
        `ATOM  ${atomIdx.toString().padStart(5)} O   ${aa.padEnd(3)} ${chainId}${resSeq}    ${(parseFloat(x) + 1.5).toFixed(3).padStart(8)}${(parseFloat(y) + 2.0).toFixed(3).padStart(8)}${z}  1.00  0.00           O  `,
      );
      atomIdx++;
    }
    lines.push("TER");
  }
  lines.push("END");
  return lines.join("\n");
}

/**
 * Estimate protein centroid from PDB coordinates.
 */
function estimateProteinCentroid(pdb: string): { x: number; y: number; z: number } {
  let sumX = 0, sumY = 0, sumZ = 0, count = 0;
  const lines = pdb.split("\n");

  for (const line of lines) {
    if (line.startsWith("ATOM") && line.substring(12, 16).trim() === "CA") {
      const x = parseFloat(line.substring(30, 38));
      const y = parseFloat(line.substring(38, 46));
      const z = parseFloat(line.substring(46, 54));
      if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
        sumX += x;
        sumY += y;
        sumZ += z;
        count++;
      }
    }
  }

  return count > 0
    ? { x: sumX / count, y: sumY / count, z: sumZ / count }
    : { x: 0, y: 0, z: 0 };
}
