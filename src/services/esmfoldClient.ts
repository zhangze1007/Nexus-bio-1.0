/**
 * ESMFold Client — Protein Structure Prediction
 *
 * Client-side service for calling the ESMFold API proxy.
 * Provides structure prediction and pLDDT confidence scores.
 *
 * Reference: Lin et al. (2023) Science 379:1123-1130
 */

export interface ESMFoldResult {
  pdb: string;
  plddt: number;
  model: string;
  sequence: string;
  name: string;
  durationMs: number;
}

export interface ESMFoldError {
  ok: false;
  error: string;
  fallback?: string;
}

/**
 * Predict protein structure from amino acid sequence using ESMFold.
 *
 * @param sequence - Amino acid sequence (single letter codes)
 * @param name - Optional name for the prediction
 * @returns PDB text and pLDDT confidence score
 */
export async function predictStructure(
  sequence: string,
  name?: string,
): Promise<ESMFoldResult> {
  const response = await fetch('/api/esmfold', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sequence, name }),
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(data.error || 'ESMFold prediction failed');
  }

  return data as ESMFoldResult;
}

/**
 * Extract Cα coordinates from PDB text for use with inverse folding engine.
 *
 * @param pdbText - PDB format text
 * @returns Array of { residueIndex, residueName, x, y, z }
 */
export function extractBackboneFromPDB(pdbText: string): Array<{
  residueIndex: number;
  residueName: string;
  x: number;
  y: number;
  z: number;
}> {
  const backbone: Array<{
    residueIndex: number;
    residueName: string;
    x: number;
    y: number;
    z: number;
  }> = [];

  const lines = pdbText.split('\n');
  let prevResidue = -1;

  for (const line of lines) {
    if (!line.startsWith('ATOM')) continue;

    const atomName = line.substring(12, 16).trim();
    const residueName = line.substring(17, 20).trim();
    const residueIndex = parseInt(line.substring(22, 26).trim());
    const x = parseFloat(line.substring(30, 38));
    const y = parseFloat(line.substring(38, 46));
    const z = parseFloat(line.substring(46, 54));

    // Only take Cα atoms (one per residue)
    if (atomName === 'CA' && residueIndex !== prevResidue) {
      backbone.push({
        residueIndex: backbone.length,
        residueName: residueName,
        x,
        y,
        z,
      });
      prevResidue = residueIndex;
    }
  }

  return backbone;
}

/**
 * Compute average pLDDT from PDB text (B-factor column stores pLDDT in ESMFold output).
 */
export function computeAveragePLDDT(pdbText: string): number {
  const lines = pdbText.split('\n');
  let totalPLDDT = 0;
  let count = 0;

  for (const line of lines) {
    if (!line.startsWith('ATOM')) continue;
    const atomName = line.substring(12, 16).trim();
    if (atomName !== 'CA') continue;

    const bFactor = parseFloat(line.substring(60, 66));
    if (!isNaN(bFactor)) {
      totalPLDDT += bFactor;
      count++;
    }
  }

  return count > 0 ? Math.round((totalPLDDT / count) * 100) / 100 : 0;
}
