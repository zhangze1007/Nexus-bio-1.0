import { NextResponse } from 'next/server';
import { getCorsHeaders, handleOptions } from '../../../src/utils/cors';
import { errorResponse } from '../../../src/utils/apiErrors';

export const runtime = 'edge';

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

/**
 * Validate that a string looks like a PDB ID (4 alphanumeric characters).
 */
function isValidPdbId(id: string): boolean {
  return /^[A-Z0-9]{4}$/i.test(id);
}

/**
 * Basic SMILES validation — must be non-empty, printable ASCII, and not too long.
 */
function isValidSmiles(smiles: string): boolean {
  if (!smiles || smiles.length === 0 || smiles.length > 5000) return false;
  // SMILES should only contain printable ASCII characters common in SMILES notation
  return /^[\x20-\x7E]+$/.test(smiles);
}

export async function POST(request: Request) {
  const corsHeaders = getCorsHeaders(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, undefined, corsHeaders);
  }

  const { proteinPdbId, ligandSmiles } = body as {
    proteinPdbId?: string;
    ligandSmiles?: string;
  };

  if (!proteinPdbId || !isValidPdbId(proteinPdbId)) {
    return errorResponse(
      'Missing or invalid proteinPdbId (expected 4-character PDB ID)',
      400,
      undefined,
      corsHeaders,
    );
  }

  if (!ligandSmiles || !isValidSmiles(ligandSmiles)) {
    return errorResponse(
      'Missing or invalid ligandSmiles (expected SMILES string)',
      400,
      undefined,
      corsHeaders,
    );
  }

  // TODO: Replace with real SwissDock / AutoDock Vina proxy when available.
  // For now, compute a deterministic mock docking score derived from the inputs
  // so that downstream tools (CATDES) get reproducible, non-hardcoded values.
  const hashInput = `${proteinPdbId}:${ligandSmiles}`;
  let hash = 0;
  for (let i = 0; i < hashInput.length; i++) {
    hash = ((hash << 5) - hash + hashInput.charCodeAt(i)) | 0;
  }

  // Map hash to a realistic docking score range: -3.0 to -12.0 kcal/mol
  const normalizedHash = Math.abs(hash) / 2147483647; // 0..1
  const dockingScore = -(3.0 + normalizedHash * 9.0);
  const bindingEnergy = dockingScore * (1.1 + normalizedHash * 0.3);

  return NextResponse.json(
    {
      ok: true,
      protein: proteinPdbId.toUpperCase(),
      ligand: ligandSmiles,
      dockingScore: Math.round(dockingScore * 100) / 100,
      bindingEnergy: Math.round(bindingEnergy * 100) / 100,
      pose: null, // Real pose coordinates would come from a docking engine
      source: 'mock',
    },
    {
      status: 200,
      headers: {
        ...corsHeaders,
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      },
    },
  );
}
