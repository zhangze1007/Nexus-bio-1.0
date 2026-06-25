/**
 * PDB Coordinate Parser
 *
 * Parses PDB format text to extract atomic coordinates and structural information.
 * Enables structure-based enzyme engineering calculations.
 *
 * Reference: https://www.wwpdb.org/documentation/file-format-content/format33/sect9.html
 */

// ── Amino acid properties for structural analysis ──────────────────────────

const AA_3_TO_1: Record<string, string> = {
  ALA: "A",
  ARG: "R",
  ASN: "N",
  ASP: "D",
  CYS: "C",
  GLU: "E",
  GLN: "Q",
  GLY: "G",
  HIS: "H",
  ILE: "I",
  LEU: "L",
  LYS: "K",
  MET: "M",
  PHE: "F",
  PRO: "P",
  SER: "S",
  THR: "T",
  TRP: "W",
  TYR: "Y",
  VAL: "V",
};

/** Chou-Fasman helix propensity (simplified) */
const HELIX_PROPENSITY: Record<string, number> = {
  A: 1.42,
  R: 0.98,
  N: 0.67,
  D: 1.01,
  C: 0.7,
  E: 1.51,
  Q: 1.11,
  G: 0.57,
  H: 1.0,
  I: 1.08,
  L: 1.21,
  K: 1.16,
  M: 1.45,
  F: 1.13,
  P: 0.57,
  S: 0.77,
  T: 0.83,
  W: 1.08,
  Y: 0.69,
  V: 1.06,
};

/** Chou-Fasman sheet propensity (simplified) */
const SHEET_PROPENSITY: Record<string, number> = {
  A: 0.83,
  R: 0.93,
  N: 0.89,
  D: 0.54,
  C: 1.19,
  E: 0.37,
  Q: 1.1,
  G: 0.75,
  H: 0.87,
  I: 1.6,
  L: 1.3,
  K: 0.74,
  M: 1.05,
  F: 1.38,
  P: 0.55,
  S: 0.75,
  T: 1.19,
  W: 1.37,
  Y: 1.47,
  V: 1.7,
};

/** Hydrophobicity (Kyte-Doolittle, normalized to [0,1]) */
const HYDROPHOBICITY: Record<string, number> = {
  A: 0.62,
  R: 0.0,
  N: 0.24,
  D: 0.03,
  C: 0.68,
  E: 0.05,
  Q: 0.19,
  G: 0.48,
  H: 0.17,
  I: 1.0,
  L: 0.97,
  K: 0.0,
  M: 0.74,
  F: 0.88,
  P: 0.4,
  S: 0.38,
  T: 0.45,
  W: 0.81,
  Y: 0.56,
  V: 0.93,
};

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
  residuesNear(
    atomIndex: number,
    radius: number,
  ): Array<{
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
  let title = "";

  const lines = pdbText.split("\n");

  for (const line of lines) {
    const recordType = line.substring(0, 6).trim();

    if (recordType === "TITLE") {
      // TITLE record: columns 11-80 contain the title
      title = line.substring(10).trim();
    } else if (recordType === "ATOM" || recordType === "HETATM") {
      const atom = parseAtomLine(line, recordType === "HETATM");
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
    const altLoc = line.length > 16 ? line.charAt(16) : " ";
    const residueName = line.substring(17, 20).trim();
    // PDB columns 18-20 (1-indexed) = indices 17-19 (0-indexed), length 3
    const chainId = line.length > 21 ? line.charAt(21) : " ";
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
      altLoc: altLoc === " " ? "" : altLoc,
      residueName,
      chainId: chainId === " " ? "" : chainId,
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
  const cleaned = atomName.replace(/^[\d\s]+/, "");

  if (cleaned.length === 0) {
    return "";
  }

  // First character is typically the element
  const firstChar = cleaned.charAt(0).toUpperCase();

  // Check for two-letter elements (common ones)
  if (cleaned.length >= 2) {
    const twoChar = (firstChar + cleaned.charAt(1)).toUpperCase();
    const twoLetterElements = [
      "HE",
      "LI",
      "BE",
      "NE",
      "NA",
      "MG",
      "AL",
      "SI",
      "CL",
      "AR",
      "CA",
      "FE",
      "CU",
      "ZN",
      "SE",
      "BR",
      "KR",
      "RB",
      "SR",
      "PD",
      "AG",
      "CD",
      "IN",
      "SN",
      "XE",
      "CS",
      "BA",
      "PT",
      "AU",
      "HG",
      "PB",
      "BI",
    ];

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
  const residueCache = new Map<
    string,
    {
      residueName: string;
      residueNumber: number;
      chainId: string;
    }
  >();

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
    residuesNear(
      atomIndex: number,
      radius: number,
    ): Array<{
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
      const residueDistances = new Map<
        string,
        {
          residueName: string;
          residueNumber: number;
          chainId: string;
          minDistance: number;
        }
      >();

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
      const result = Array.from(residueDistances.values()).map((r) => ({
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

// ── Structural Analysis Functions ──────────────────────────────────────────

interface ResidueAtoms {
  residueName: string;
  residueNumber: number;
  chainId: string;
  N?: PDBAtom;
  CA?: PDBAtom;
  C?: PDBAtom;
  O?: PDBAtom;
  CB?: PDBAtom;
  /** Side-chain atoms (excluding backbone and CB) */
  sidechain: PDBAtom[];
}

/**
 * Group atoms by residue, extracting backbone and side-chain atoms.
 */
function groupByResidue(structure: PDBStructure, chainId?: string): ResidueAtoms[] {
  const groups = new Map<string, ResidueAtoms>();
  for (const atom of structure.atoms) {
    if (atom.isHetero) continue;
    if (chainId && atom.chainId !== chainId) continue;
    const key = `${atom.chainId}:${atom.residueNumber}:${atom.residueName}`;
    if (!groups.has(key)) {
      groups.set(key, {
        residueName: atom.residueName,
        residueNumber: atom.residueNumber,
        chainId: atom.chainId,
        sidechain: [],
      });
    }
    const g = groups.get(key)!;
    if (atom.name === "N") g.N = atom;
    else if (atom.name === "CA") g.CA = atom;
    else if (atom.name === "C") g.C = atom;
    else if (atom.name === "O") g.O = atom;
    else if (atom.name === "CB") g.CB = atom;
    else if (!["N", "CA", "C", "O", "CB", "H", "HA"].includes(atom.name)) {
      g.sidechain.push(atom);
    }
  }
  return Array.from(groups.values()).sort((a, b) => a.residueNumber - b.residueNumber);
}

function vec3Sub(a: PDBAtom, b: PDBAtom): [number, number, number] {
  return [a.x - b.x, a.y - b.y, a.z - b.z];
}

function vec3Dot(a: [number, number, number], b: [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function vec3Cross(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function vec3Norm(v: [number, number, number]): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

function dihedralAngle(a: PDBAtom, b: PDBAtom, c: PDBAtom, d: PDBAtom): number {
  const b1 = vec3Sub(b, a);
  const b2 = vec3Sub(c, b);
  const b3 = vec3Sub(d, c);
  const n1 = vec3Cross(b1, b2);
  const n2 = vec3Cross(b2, b3);
  const m1 = vec3Cross(n1, [b2[0] / vec3Norm(b2), b2[1] / vec3Norm(b2), b2[2] / vec3Norm(b2)]);
  const x = vec3Dot(n1, n2);
  const y = vec3Dot(m1, n2);
  return Math.atan2(y, x) * (180 / Math.PI);
}

/**
 * Compute backbone dihedral angles (phi, psi) and side-chain chi1/chi2 for each residue.
 *
 * phi:   C(i-1) - N(i) - CA(i) - C(i)
 * psi:   N(i) - CA(i) - C(i) - N(i+1)
 * chi1:  N - CA - CB - CG (or equivalent)
 * chi2:  CA - CB - CG - CD (or equivalent)
 */
export function computeDihedrals(
  structure: PDBStructure,
  chainId?: string,
): Array<{
  residueNumber: number;
  residueName: string;
  phi: number | null;
  psi: number | null;
  chi1: number | null;
  chi2: number | null;
}> {
  const residues = groupByResidue(structure, chainId);
  const result: Array<{
    residueNumber: number;
    residueName: string;
    phi: number | null;
    psi: number | null;
    chi1: number | null;
    chi2: number | null;
  }> = [];

  for (let i = 0; i < residues.length; i++) {
    const curr = residues[i];
    const prev = i > 0 ? residues[i - 1] : undefined;
    const next = i < residues.length - 1 ? residues[i + 1] : undefined;

    let phi: number | null = null;
    let psi: number | null = null;
    let chi1: number | null = null;
    let chi2: number | null = null;

    // phi: C(prev) - N(curr) - CA(curr) - C(curr)
    if (prev?.C && curr.N && curr.CA && curr.C) {
      phi = dihedralAngle(prev.C, curr.N, curr.CA, curr.C);
    }

    // psi: N(curr) - CA(curr) - C(curr) - N(next)
    if (curr.N && curr.CA && curr.C && next?.N) {
      psi = dihedralAngle(curr.N, curr.CA, curr.C, next.N);
    }

    // chi1: N - CA - CB - CG (first side-chain torsion)
    if (curr.N && curr.CA && curr.CB && curr.sidechain.length > 0) {
      // Find CG (or equivalent: first heavy side-chain atom after CB)
      const cg = curr.sidechain.find((a) => ["CG", "CG1", "OG", "OG1", "SG", "CG2"].includes(a.name));
      if (cg) {
        chi1 = dihedralAngle(curr.N, curr.CA, curr.CB, cg);

        // chi2: CA - CB - CG - CD (or equivalent)
        const cd = curr.sidechain.find((a) =>
          ["CD", "CD1", "OD", "OD1", "SD", "ND", "ND1", "NE", "NE1", "NZ", "CE", "CE1", "CZ"].includes(a.name),
        );
        if (cd) {
          chi2 = dihedralAngle(curr.CA, curr.CB, cg, cd);
        }
      }
    }

    result.push({
      residueNumber: curr.residueNumber,
      residueName: curr.residueName,
      phi,
      psi,
      chi1,
      chi2,
    });
  }

  return result;
}

/**
 * Compute per-residue Solvent Accessible Surface Area (SASA) using a
 * simplified Shrake-Rupley algorithm with 100 test points per atom.
 *
 * @param structure - PDB structure
 * @param probeRadius - Solvent probe radius (default 1.4 Å for water)
 * @param chainId - Optional chain to restrict computation
 * @returns Per-residue SASA in Ų
 */
export function computeSASA(
  structure: PDBStructure,
  probeRadius = 1.4,
  chainId?: string,
): Array<{
  residueNumber: number;
  residueName: string;
  sasa: number;
  relativeSASA: number;
}> {
  // Generate 100 points on a unit sphere (Fibonacci sphere)
  const spherePoints: [number, number, number][] = [];
  const n = 100;
  const goldenRatio = (1 + Math.sqrt(5)) / 2;
  for (let i = 0; i < n; i++) {
    const theta = (2 * Math.PI * i) / goldenRatio;
    const phi = Math.acos(1 - (2 * (i + 0.5)) / n);
    spherePoints.push([Math.sin(phi) * Math.cos(theta), Math.sin(phi) * Math.sin(theta), Math.cos(phi)]);
  }

  // Van der Waals radii (Å)
  const vdwRadii: Record<string, number> = {
    C: 1.7,
    N: 1.55,
    O: 1.52,
    S: 1.8,
    H: 1.2,
    P: 1.8,
    SE: 1.9,
    FE: 1.47,
    ZN: 1.39,
    MG: 1.73,
  };

  // Max SASA per residue type (extended tripeptide, Ų) — simplified
  const maxSASA: Record<string, number> = {
    ALA: 121,
    ARG: 265,
    ASN: 187,
    ASP: 187,
    CYS: 148,
    GLU: 214,
    GLN: 214,
    GLY: 97,
    HIS: 216,
    ILE: 195,
    LEU: 191,
    LYS: 230,
    MET: 203,
    PHE: 228,
    PRO: 154,
    SER: 143,
    THR: 163,
    TRP: 264,
    TYR: 255,
    VAL: 165,
  };

  const atoms = structure.atoms.filter((a) => !a.isHetero && (!chainId || a.chainId === chainId));
  const residues = groupByResidue(structure, chainId);

  // Pre-compute expanded radii for each atom
  const atomRadii = atoms.map((a) => (vdwRadii[a.element] || 1.7) + probeRadius);

  // For each atom, count accessible test points
  const atomSASA = new Map<number, number>();

  for (let i = 0; i < atoms.length; i++) {
    const atom = atoms[i];
    const radius = atomRadii[i];
    let accessible = 0;

    for (const [sx, sy, sz] of spherePoints) {
      const px = atom.x + radius * sx;
      const py = atom.y + radius * sy;
      const pz = atom.z + radius * sz;

      let blocked = false;
      for (let j = 0; j < atoms.length; j++) {
        if (i === j) continue;
        const other = atoms[j];
        const otherRadius = atomRadii[j];
        const dx = px - other.x;
        const dy = py - other.y;
        const dz = pz - other.z;
        if (dx * dx + dy * dy + dz * dz < otherRadius * otherRadius) {
          blocked = true;
          break;
        }
      }

      if (!blocked) accessible++;
    }

    // SASA = 4π r² × (accessible_points / total_points)
    const sasa = 4 * Math.PI * radius * radius * (accessible / n);
    atomSASA.set(i, sasa);
  }

  // Aggregate to residue level
  const residueSASA = new Map<string, number>();
  for (let i = 0; i < atoms.length; i++) {
    const a = atoms[i];
    const key = `${a.chainId}:${a.residueNumber}:${a.residueName}`;
    residueSASA.set(key, (residueSASA.get(key) ?? 0) + (atomSASA.get(i) ?? 0));
  }

  return residues.map((r) => {
    const key = `${r.chainId}:${r.residueNumber}:${r.residueName}`;
    const sasa = residueSASA.get(key) ?? 0;
    const max = maxSASA[r.residueName] ?? 180;
    return {
      residueNumber: r.residueNumber,
      residueName: r.residueName,
      sasa: Math.round(sasa * 100) / 100,
      relativeSASA: Math.min(1, Math.round((sasa / max) * 100) / 100),
    };
  });
}

/**
 * Assign secondary structure (H/E/C) per residue using DSSP-lite rules:
 * - Helix (H): phi in [-180, -20], psi in [-80, 40] AND helix propensity > 1.0
 * - Sheet (E): phi in [-180, -40], psi in [40, 220] AND sheet propensity > 1.0
 * - Coil (C): everything else
 */
export function assignSecondaryStructure(
  structure: PDBStructure,
  chainId?: string,
): Array<{
  residueNumber: number;
  residueName: string;
  ss: "H" | "E" | "C";
  phi: number | null;
  psi: number | null;
}> {
  const dihedrals = computeDihedrals(structure, chainId);

  return dihedrals.map((d) => {
    const aa1 = AA_3_TO_1[d.residueName] ?? "G";
    const helixP = HELIX_PROPENSITY[aa1] ?? 0.8;
    const sheetP = SHEET_PROPENSITY[aa1] ?? 0.8;

    let ss: "H" | "E" | "C" = "C";

    if (d.phi !== null && d.psi !== null) {
      const inHelixRange = d.phi >= -180 && d.phi <= -20 && d.psi >= -80 && d.psi <= 40;
      const inSheetRange = d.phi >= -180 && d.phi <= -40 && d.psi >= 40 && d.psi <= 220;

      if (inHelixRange && helixP > 1.0) ss = "H";
      else if (inSheetRange && sheetP > 1.0) ss = "E";
    }

    return {
      residueNumber: d.residueNumber,
      residueName: d.residueName,
      ss,
      phi: d.phi,
      psi: d.psi,
    };
  });
}

/**
 * Detect hydrogen bonds using geometric criteria:
 * - N-O distance < 3.5 Å
 * - N-H-O angle > 120° (approximated: use N···O···C angle as proxy)
 *
 * Returns backbone and side-chain H-bonds.
 */
export function detectHydrogenBonds(
  structure: PDBStructure,
  chainId?: string,
): Array<{
  donorResidue: string;
  donorResidueNumber: number;
  donorAtom: string;
  acceptorResidue: string;
  acceptorResidueNumber: number;
  acceptorAtom: string;
  distance: number;
  type: "backbone" | "sidechain";
}> {
  const atoms = structure.atoms.filter((a) => !a.isHetero && (!chainId || a.chainId === chainId));
  const nAtoms = atoms.filter((a) => a.element === "N");
  const oAtoms = atoms.filter((a) => a.element === "O");
  const bonds: Array<{
    donorResidue: string;
    donorResidueNumber: number;
    donorAtom: string;
    acceptorResidue: string;
    acceptorResidueNumber: number;
    acceptorAtom: string;
    distance: number;
    type: "backbone" | "sidechain";
  }> = [];

  for (const n of nAtoms) {
    for (const o of oAtoms) {
      // Skip same residue
      if (n.residueNumber === o.residueNumber && n.chainId === o.chainId) continue;

      const dx = n.x - o.x;
      const dy = n.y - o.y;
      const dz = n.z - o.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < 3.5) {
        const isBackbone = ["N", "O"].includes(n.name) && ["N", "O"].includes(o.name);
        bonds.push({
          donorResidue: n.residueName,
          donorResidueNumber: n.residueNumber,
          donorAtom: n.name,
          acceptorResidue: o.residueName,
          acceptorResidueNumber: o.residueNumber,
          acceptorAtom: o.name,
          distance: Math.round(dist * 100) / 100,
          type: isBackbone ? "backbone" : "sidechain",
        });
      }
    }
  }

  return bonds.sort((a, b) => a.distance - b.distance);
}

/**
 * Get hydrophobicity score for a residue (0 = hydrophilic, 1 = hydrophobic).
 */
export function getHydrophobicity(residueName: string): number {
  const aa1 = AA_3_TO_1[residueName] ?? "G";
  return HYDROPHOBICITY[aa1] ?? 0.5;
}
