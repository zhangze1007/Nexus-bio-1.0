/**
 * PDB Coordinate Parser
 *
 * Parses PDB format text to extract atomic coordinates and structural information.
 * Enables structure-based enzyme engineering calculations.
 *
 * Reference: https://www.wwpdb.org/documentation/file-format-content/format33/sect9.html
 */

export interface PDBAtom {
  serial: number;
  name: string;
  altLoc: string;
  residueName: string;
  chainId: string;
  residueNumber: number;
  x: number;
  y: number;
  z: number;
  occupancy: number;
  bFactor: number;
  element: string;
  isHetero: boolean;
}

export interface PDBStructure {
  atoms: PDBAtom[];
  title: string;
  distance(i: number, j: number): number;
  atomsNear(point: [number, number, number], radius: number): PDBAtom[];
  residuesNear(atomIndex: number, radius: number): Array<{
    residueName: string;
    residueNumber: number;
    chainId: string;
    distance: number;
  }>;
}

/**
 * Parse a PDB format text and return a PDBStructure object.
 *
 * @param pdbText - PDB format text content
 * @returns PDBStructure with atoms and utility methods
 */
export function parsePDB(pdbText: string): PDBStructure {
  const atoms: PDBAtom[] = [];
  let title = '';

  const lines = pdbText.split('\n');

  for (const line of lines) {
    const recordType = line.substring(0, 6).trim();

    if (recordType === 'TITLE') {
      // TITLE record: columns 11-80 contain the title
      title = line.substring(10).trim();
    } else if (recordType === 'ATOM' || recordType === 'HETATM') {
      const atom = parseAtomLine(line, recordType === 'HETATM');
      if (atom) {
        atoms.push(atom);
      }
    }
  }

  return createPDBStructure(atoms, title);
}

/**
 * Parse a single ATOM or HETATM record line.
 *
 * PDB format (fixed-width columns):
 *  1 -  6  Record name     "ATOM  " or "HETATM"
 *  7 - 11  Integer         serial        Atom serial number
 * 13 - 16  Atom            name          Atom name
 * 17       Character       altLoc        Alternate location indicator
 * 18 - 20  Residue name    resName       Residue name
 * 22       Character       chainID       Chain ID
 * 23 - 26  Integer         resSeq        Residue sequence number
 * 31 - 38  Real(8.3)       x             Orthogonal coordinates for X
 * 39 - 46  Real(8.3)       y             Orthogonal coordinates for Y
 * 47 - 54  Real(8.3)       z             Orthogonal coordinates for Z
 * 55 - 60  Real(6.2)       occupancy     Occupancy
 * 61 - 66  Real(6.2)       tempFactor    Temperature factor
 * 77 - 78  LString(2)      element       Element symbol
 */
function parseAtomLine(line: string, isHetero: boolean): PDBAtom | null {
  // Ensure line is at least 54 characters (minimum for coordinates)
  if (line.length < 54) {
    return null;
  }

  try {
    // Columns are 0-indexed in JavaScript, but 1-indexed in PDB spec
    // So column N in spec = index N-1 in string
    const serial = parseIntSafe(line.substring(6, 11).trim());
    const name = line.substring(12, 16).trim();
    const altLoc = line.length > 16 ? line.charAt(16) : ' ';
    const residueName = line.substring(17, 20).trim();
    // PDB columns 18-20 (1-indexed) = indices 17-19 (0-indexed), length 3
    const chainId = line.length > 21 ? line.charAt(21) : ' ';
    const residueNumber = parseIntSafe(line.substring(22, 26).trim());
    const x = parseFloatSafe(line.substring(30, 38).trim());
    const y = parseFloatSafe(line.substring(38, 46).trim());
    const z = parseFloatSafe(line.substring(46, 54).trim());

    // Occupancy and B-factor (optional fields)
    const occupancy = line.length > 60 ? parseFloatSafe(line.substring(54, 60).trim()) : 1.0;
    const bFactor = line.length > 66 ? parseFloatSafe(line.substring(60, 66).trim()) : 0.0;

    // Element symbol (optional, last 2 columns)
    const element = line.length > 76 ? line.substring(76, 78).trim() : extractElementFromName(name);

    return {
      serial,
      name,
      altLoc: altLoc === ' ' ? '' : altLoc,
      residueName,
      chainId: chainId === ' ' ? '' : chainId,
      residueNumber,
      x,
      y,
      z,
      occupancy,
      bFactor,
      element,
      isHetero,
    };
  } catch {
    // Skip malformed lines
    return null;
  }
}

/**
 * Safely parse an integer, returning 0 on failure.
 */
function parseIntSafe(s: string): number {
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}

/**
 * Safely parse a float, returning 0.0 on failure.
 */
function parseFloatSafe(s: string): number {
  const n = parseFloat(s);
  return isNaN(n) ? 0.0 : n;
}

/**
 * Extract element symbol from atom name when element field is missing.
 * Common patterns: "CA" -> "C", "NE2" -> "N", "OXT" -> "O"
 */
function extractElementFromName(atomName: string): string {
  // Remove leading digits and spaces
  const cleaned = atomName.replace(/^[\d\s]+/, '');

  if (cleaned.length === 0) {
    return '';
  }

  // First character is typically the element
  const firstChar = cleaned.charAt(0).toUpperCase();

  // Check for two-letter elements (common ones)
  if (cleaned.length >= 2) {
    const twoChar = (firstChar + cleaned.charAt(1)).toUpperCase();
    const twoLetterElements = ['HE', 'LI', 'BE', 'NE', 'NA', 'MG', 'AL', 'SI', 'CL', 'AR', 'CA', 'FE', 'CU', 'ZN', 'SE', 'BR', 'KR', 'RB', 'SR', 'PD', 'AG', 'CD', 'IN', 'SN', 'XE', 'CS', 'BA', 'PT', 'AU', 'HG', 'PB', 'BI'];

    if (twoLetterElements.includes(twoChar)) {
      return twoChar;
    }
  }

  return firstChar;
}

/**
 * Create a PDBStructure object with utility methods.
 */
function createPDBStructure(atoms: PDBAtom[], title: string): PDBStructure {
  const residueCache = new Map<string, {
    residueName: string;
    residueNumber: number;
    chainId: string;
  }>();

  // Build residue cache for deduplication
  for (const atom of atoms) {
    const key = `${atom.chainId}:${atom.residueNumber}:${atom.residueName}`;
    if (!residueCache.has(key)) {
      residueCache.set(key, {
        residueName: atom.residueName,
        residueNumber: atom.residueNumber,
        chainId: atom.chainId,
      });
    }
  }

  return {
    atoms,
    title,

    /**
     * Compute Euclidean distance between two atoms by index.
     */
    distance(i: number, j: number): number {
      if (i < 0 || i >= atoms.length || j < 0 || j >= atoms.length) {
        throw new Error(`Atom index out of range: i=${i}, j=${j}, atoms.length=${atoms.length}`);
      }

      const a = atoms[i];
      const b = atoms[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dz = a.z - b.z;

      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    },

    /**
     * Find all atoms within a given radius of a point.
     *
     * @param point - [x, y, z] coordinates of the center point
     * @param radius - Search radius in Angstroms
     * @returns Array of PDBAtom objects within the radius
     */
    atomsNear(point: [number, number, number], radius: number): PDBAtom[] {
      const [px, py, pz] = point;
      const radiusSq = radius * radius;
      const result: PDBAtom[] = [];

      for (const atom of atoms) {
        const dx = atom.x - px;
        const dy = atom.y - py;
        const dz = atom.z - pz;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq <= radiusSq) {
          result.push(atom);
        }
      }

      return result;
    },

    /**
     * Find all unique residues that have at least one atom within a given radius of a specified atom.
     *
     * @param atomIndex - Index of the reference atom
     * @param radius - Search radius in Angstroms
     * @returns Array of unique residue descriptors with minimum distance to reference atom
     */
    residuesNear(atomIndex: number, radius: number): Array<{
      residueName: string;
      residueNumber: number;
      chainId: string;
      distance: number;
    }> {
      if (atomIndex < 0 || atomIndex >= atoms.length) {
        throw new Error(`Atom index out of range: atomIndex=${atomIndex}, atoms.length=${atoms.length}`);
      }

      const refAtom = atoms[atomIndex];
      const radiusSq = radius * radius;
      const refResidueKey = `${refAtom.chainId}:${refAtom.residueNumber}:${refAtom.residueName}`;

      // Track minimum distance for each residue
      const residueDistances = new Map<string, {
        residueName: string;
        residueNumber: number;
        chainId: string;
        minDistance: number;
      }>();

      for (const atom of atoms) {
        const dx = atom.x - refAtom.x;
        const dy = atom.y - refAtom.y;
        const dz = atom.z - refAtom.z;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq <= radiusSq) {
          const residueKey = `${atom.chainId}:${atom.residueNumber}:${atom.residueName}`;

          // Skip the reference atom's own residue
          if (residueKey === refResidueKey) {
            continue;
          }

          const distance = Math.sqrt(distSq);

          const existing = residueDistances.get(residueKey);
          if (!existing || distance < existing.minDistance) {
            residueDistances.set(residueKey, {
              residueName: atom.residueName,
              residueNumber: atom.residueNumber,
              chainId: atom.chainId,
              minDistance: distance,
            });
          }
        }
      }

      // Convert to array and sort by distance
      const result = Array.from(residueDistances.values()).map(r => ({
        residueName: r.residueName,
        residueNumber: r.residueNumber,
        chainId: r.chainId,
        distance: r.minDistance,
      }));

      result.sort((a, b) => a.distance - b.distance);

      return result;
    },
  };
}
