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

/**
 * Validate that a string looks like PDB data (starts with ATOM/HETATM/HEADER records).
 */
function isValidPdbData(data: string): boolean {
  return data.length > 100 && /^(HEADER|ATOM|HETATM|REMARK)/m.test(data);
}

/**
 * Validate that a string looks like SDF data (contains the typical V2000 or V3000 counts line).
 */
function isValidSdfData(data: string): boolean {
  return data.length > 50 && /^\s*-?\d+\s+-?\d+/m.test(data.split('\n').slice(3, 5).join('\n'));
}

// ─── PDB and SDF Parsing ────────────────────────────────────────────────────

interface Atom3D {
  x: number;
  y: number;
  z: number;
  element: string;
}

function parsePdbAtoms(pdb: string): Atom3D[] {
  const atoms: Atom3D[] = [];
  for (const line of pdb.split('\n')) {
    if (!line.startsWith('ATOM') && !line.startsWith('HETATM')) continue;
    const x = parseFloat(line.substring(30, 38));
    const y = parseFloat(line.substring(38, 46));
    const z = parseFloat(line.substring(46, 54));
    const element = (
      line.substring(76, 78).trim() ||
      line.substring(12, 14).trim().replace(/[0-9]/g, '')
    )[0];
    if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
      atoms.push({ x, y, z, element: element.toUpperCase() });
    }
  }
  return atoms;
}

function parseSdfAtoms(sdf: string): Atom3D[] {
  const atoms: Atom3D[] = [];
  const lines = sdf.split('\n');
  const countsLine = lines[3];
  if (!countsLine) return atoms;
  const numAtoms = parseInt(countsLine.substring(0, 3).trim());
  for (let i = 4; i < 4 + numAtoms && i < lines.length; i++) {
    const line = lines[i];
    const x = parseFloat(line.substring(0, 10));
    const y = parseFloat(line.substring(10, 20));
    const z = parseFloat(line.substring(20, 30));
    const element = line.substring(31, 34).trim();
    if (!isNaN(x) && !isNaN(y) && !isNaN(z) && element) {
      atoms.push({ x, y, z, element: element.toUpperCase() });
    }
  }
  return atoms;
}

function isHBondPair(e1: string, e2: string): boolean {
  const donors = new Set(['N', 'O', 'S']);
  return donors.has(e1) && donors.has(e2);
}

function isHydrophobicPair(e1: string, e2: string): boolean {
  return e1 === 'C' && e2 === 'C';
}

// ─── Empirical Docking Score ─────────────────────────────────────────────────

function computeEmpiricalDockingScore(
  proteinPdb: string,
  ligandSdf: string,
): { dockingScore: number; bindingEnergy: number; contactsFound: number; source: string } {
  const proteinAtoms = parsePdbAtoms(proteinPdb);
  const ligandAtoms = parseSdfAtoms(ligandSdf);

  if (proteinAtoms.length === 0 || ligandAtoms.length === 0) {
    throw new Error('Could not parse 3D coordinates from PDB/SDF');
  }

  // Use protein centroid as approximate binding site
  const cx = proteinAtoms.reduce((s, a) => s + a.x, 0) / proteinAtoms.length;
  const cy = proteinAtoms.reduce((s, a) => s + a.y, 0) / proteinAtoms.length;
  const cz = proteinAtoms.reduce((s, a) => s + a.z, 0) / proteinAtoms.length;

  // Nearby protein atoms (within 8 A of centroid)
  const nearbyProtein = proteinAtoms.filter(
    a => Math.sqrt((a.x - cx) ** 2 + (a.y - cy) ** 2 + (a.z - cz) ** 2) < 8.0,
  );

  let score = 0;
  let contactCount = 0;

  for (const ligAtom of ligandAtoms) {
    for (const proAtom of nearbyProtein) {
      const d = Math.sqrt(
        (ligAtom.x - proAtom.x) ** 2 +
        (ligAtom.y - proAtom.y) ** 2 +
        (ligAtom.z - proAtom.z) ** 2,
      );
      if (d < 2.0) {
        score += 5.0; // clash penalty
      } else if (d < 3.5 && isHBondPair(ligAtom.element, proAtom.element)) {
        score -= 2.0; // hydrogen bond
        contactCount++;
      } else if (d < 5.0 && isHydrophobicPair(ligAtom.element, proAtom.element)) {
        score -= 0.7; // hydrophobic contact
        contactCount++;
      }
    }
  }

  const dockingScore = Math.max(-15.0, Math.min(5.0, score));
  const bindingEnergy = dockingScore * 1.15;

  return {
    dockingScore: Math.round(dockingScore * 100) / 100,
    bindingEnergy: Math.round(bindingEnergy * 100) / 100,
    contactsFound: contactCount,
    source: 'empirical_contact_scoring_v1',
  };
}

// ─── Fetch helpers (server-side, Edge Runtime compatible) ────────────────────

async function fetchPdbFromAlphaFold(uniprotId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://alphafold.ebi.ac.uk/api/pdb/${uniprotId}`);
    if (res.ok) {
      const text = await res.text();
      if (isValidPdbData(text)) return text;
    }
  } catch {
    // fall through
  }
  return null;
}

async function fetchPdbFromRcsb(pdbId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://files.rcsb.org/download/${pdbId.toUpperCase()}.pdb`);
    if (res.ok) {
      const text = await res.text();
      if (isValidPdbData(text)) return text;
    }
  } catch {
    // fall through
  }
  return null;
}

async function fetchSdfFromPubChem(smilesOrName: string): Promise<string | null> {
  try {
    // Try by CID first (if it looks numeric), then by name
    const isNumeric = /^\d+$/.test(smilesOrName.trim());
    const url = isNumeric
      ? `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${smilesOrName.trim()}/SDF?record_type=3d`
      : `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(smilesOrName)}/SDF?record_type=3d`;
    const res = await fetch(url);
    if (res.ok) {
      const text = await res.text();
      if (isValidSdfData(text)) return text;
    }
  } catch {
    // fall through
  }
  return null;
}

// ─── POST Handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const corsHeaders = getCorsHeaders(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, undefined, corsHeaders);
  }

  const {
    proteinPdbId,
    ligandSmiles,
    proteinPdb,
    ligandSdf,
    uniprotId,
  } = body as {
    proteinPdbId?: string;
    ligandSmiles?: string;
    proteinPdb?: string;
    ligandSdf?: string;
    uniprotId?: string;
  };

  // ── Path A: raw 3D data provided directly ──────────────────────────────────
  if (proteinPdb && ligandSdf && isValidPdbData(proteinPdb) && isValidSdfData(ligandSdf)) {
    try {
      const result = computeEmpiricalDockingScore(proteinPdb, ligandSdf);
      return NextResponse.json(
        {
          ok: true,
          protein: proteinPdbId?.toUpperCase() || 'uploaded',
          ligand: ligandSmiles || 'uploaded',
          ...result,
        },
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Cache-Control': 'public, max-age=3600, s-maxage=86400',
          },
        },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Scoring failed';
      return errorResponse(msg, 422, undefined, corsHeaders);
    }
  }

  // ── Path B: identifiers provided — fetch 3D data server-side ───────────────
  // Validate at least one protein identifier and one ligand identifier
  const hasProteinId = (proteinPdbId && isValidPdbId(proteinPdbId)) || uniprotId;
  const hasLigandId = ligandSmiles && isValidSmiles(ligandSmiles);

  if (!hasProteinId) {
    return errorResponse(
      'Missing protein identifier (proteinPdbId or uniprotId required)',
      400,
      undefined,
      corsHeaders,
    );
  }

  if (!hasLigandId) {
    return errorResponse(
      'Missing ligandSmiles (compound name, SMILES, or CID)',
      400,
      undefined,
      corsHeaders,
    );
  }

  // Fetch PDB: try AlphaFold by UniProt ID first, then RCSB by PDB ID
  let pdbData: string | null = null;
  if (uniprotId) {
    pdbData = await fetchPdbFromAlphaFold(uniprotId);
  }
  if (!pdbData && proteinPdbId && isValidPdbId(proteinPdbId)) {
    pdbData = await fetchPdbFromRcsb(proteinPdbId);
  }

  if (!pdbData) {
    return errorResponse(
      'Could not fetch protein 3D structure (tried AlphaFold and RCSB)',
      502,
      undefined,
      corsHeaders,
    );
  }

  // Fetch SDF from PubChem
  const sdfData = await fetchSdfFromPubChem(ligandSmiles!);

  if (!sdfData) {
    return errorResponse(
      'Could not fetch ligand 3D structure from PubChem',
      502,
      undefined,
      corsHeaders,
    );
  }

  // Score
  try {
    const result = computeEmpiricalDockingScore(pdbData, sdfData);
    return NextResponse.json(
      {
        ok: true,
        protein: (proteinPdbId || uniprotId || '').toUpperCase(),
        ligand: ligandSmiles,
        ...result,
      },
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        },
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Scoring failed';
    return errorResponse(msg, 422, undefined, corsHeaders);
  }
}
