/**
 * Backbone Generator — De Novo Protein Backbone Coordinate Generation
 *
 * Generates protein backbone atom coordinates (N, CA, C, O) using known
 * secondary structure geometry. This serves as a heuristic backbone builder
 * for the RFdiffusion integration.
 *
 * Reference geometry:
 * - Alpha helix: phi=-57, psi=-47, 3.6 residues/turn, 1.5 A rise per residue
 * - Beta sheet:  phi=-139, psi=+135, 3.3 A rise per residue
 * - Bond lengths: N-CA ~1.47 A, CA-C ~1.53 A, C-N ~1.32 A
 * - Bond angles: N-CA-C ~111, CA-C-N ~116, C-N-CA ~121
 *
 * Chain-building order (NeRF):
 *   N(i-1), CA(i-1), C(i-1) -> N(i)   [torsion = psi(i-1)]
 *   CA(i-1), C(i-1), N(i)   -> CA(i)  [torsion = omega(i-1) ~ 180]
 *   C(i-1), N(i), CA(i)     -> C(i)   [torsion = phi(i)]
 *
 * Reference: Parsons et al. (2005) J Appl Cryst 38:553-559 (NeRF algorithm)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BackboneConfig {
  length: number;
  secondaryStructure: Array<{
    type: "helix" | "sheet" | "loop";
    start: number;
    end: number;
  }>;
}

export interface BackboneAtom {
  atomName: "N" | "CA" | "C" | "O";
  x: number;
  y: number;
  z: number;
  residueIndex: number;
  residueName: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Bond lengths in Angstroms */
export const BACKBONE_BOND_LENGTHS = {
  N_CA: 1.47,
  CA_C: 1.53,
  C_N: 1.32,
} as const;

/** Bond angles in degrees */
export const BACKBONE_BOND_ANGLES = {
  N_CA_C: 111.0,
  CA_C_N: 116.0,
  C_N_CA: 121.0,
} as const;

/** Ramachandran angles for secondary structures (degrees) */
const RAMACHANDRAN = {
  helix: { phi: -57, psi: -47 },
  sheet: { phi: -139, psi: 135 },
} as const;

/** Standard 20 amino acid three-letter codes */
export const AMINO_ACIDS = [
  "ALA",
  "ARG",
  "ASN",
  "ASP",
  "CYS",
  "GLN",
  "GLU",
  "GLY",
  "HIS",
  "ILE",
  "LEU",
  "LYS",
  "MET",
  "PHE",
  "PRO",
  "SER",
  "THR",
  "TRP",
  "TYR",
  "VAL",
] as const;

// ---------------------------------------------------------------------------
// Vector math utilities
// ---------------------------------------------------------------------------

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function vSub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function vAdd(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function vScale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

function vDot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function vCross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function vNorm(v: Vec3): number {
  return Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
}

function vNormalize(v: Vec3): Vec3 {
  const n = vNorm(v);
  if (n < 1e-10) return { x: 0, y: 0, z: 1 };
  return { x: v.x / n, y: v.y / n, z: v.z / n };
}

// ---------------------------------------------------------------------------
// Public utility functions
// ---------------------------------------------------------------------------

/** Compute Euclidean distance between two 3D points */
export function computeBondLength(a: Vec3, b: Vec3): number {
  return vNorm(vSub(a, b));
}

/** Compute angle (in degrees) between three points a-b-c (vertex at b) */
export function computeBondAngle(a: Vec3, b: Vec3, c: Vec3): number {
  const ba = vSub(a, b);
  const bc = vSub(c, b);
  const cosAngle = Math.max(-1, Math.min(1, vDot(ba, bc) / (vNorm(ba) * vNorm(bc))));
  return (Math.acos(cosAngle) * 180) / Math.PI;
}

// ---------------------------------------------------------------------------
// NeRF (Natural Extension Reference Frame) algorithm
// ---------------------------------------------------------------------------

/**
 * Place atom D given three preceding atoms A, B, C.
 *
 * @param a - First reference atom (for dihedral definition)
 * @param b - Second reference atom
 * @param c - Anchor atom (D is placed relative to C)
 * @param bondLength - |CD|
 * @param bondAngleDeg - angle B-C-D in degrees
 * @param torsionDeg - dihedral A-B-C-D in degrees
 * @returns Position of D
 */
function nerfPlace(a: Vec3, b: Vec3, c: Vec3, bondLength: number, bondAngleDeg: number, torsionDeg: number): Vec3 {
  const theta = degToRad(bondAngleDeg);
  const phi = degToRad(torsionDeg);

  // Build orthonormal frame at C
  const bcDir = vNormalize(vSub(c, b));
  const abDir = vNormalize(vSub(b, a));
  const n = vNormalize(vCross(abDir, bcDir)); // normal to ABC plane
  const nbc = vCross(n, bcDir); // completes right-handed frame

  // D in local coordinates: x along -BC, y along nbc, z along n
  const localD: Vec3 = {
    x: -bondLength * Math.cos(theta),
    y: bondLength * Math.sin(theta) * Math.cos(phi),
    z: bondLength * Math.sin(theta) * Math.sin(phi),
  };

  // Transform to global frame
  return {
    x: c.x + bcDir.x * localD.x + nbc.x * localD.y + n.x * localD.z,
    y: c.y + bcDir.y * localD.x + nbc.y * localD.y + n.y * localD.z,
    z: c.z + bcDir.z * localD.x + nbc.z * localD.y + n.z * localD.z,
  };
}

// ---------------------------------------------------------------------------
// Backbone generation
// ---------------------------------------------------------------------------

/** Determine which secondary structure element a residue belongs to */
function getSecondaryType(residueIndex: number, config: BackboneConfig): "helix" | "sheet" | "loop" {
  for (const ss of config.secondaryStructure) {
    if (residueIndex >= ss.start && residueIndex <= ss.end) {
      return ss.type;
    }
  }
  return "loop";
}

/** Get Ramachandran angles for a given secondary structure type */
function getPhiPsi(type: "helix" | "sheet" | "loop", residueIndex: number): { phi: number; psi: number } {
  if (type === "helix") return RAMACHANDRAN.helix;
  if (type === "sheet") return RAMACHANDRAN.sheet;
  // Loop: deterministic pseudo-random angles in allowed Ramachandran region
  const seed = (residueIndex * 137 + 42) % 360;
  const phi = -180 + (seed % 120);
  const psi = -60 + ((seed * 3 + 17) % 180);
  return { phi, psi };
}

/**
 * Place the carbonyl oxygen on a C atom.
 *
 * O is in the peptide plane (N-CA-C-O), ~1.24 A from C, with
 * CA-C-O angle ~121 deg. The O is placed opposite to N across
 * the CA-C bond, in the peptide plane.
 */
function placeOxygen(nPos: Vec3, caPos: Vec3, cPos: Vec3): Vec3 {
  // Use NeRF: N(prev), CA(prev), C -> O with torsion ~0 (cis to N)
  // This places O in the peptide plane on the opposite side from N
  // Actually: O is roughly 180 from the next N in the peptide plane.
  // The standard C=O direction: use NeRF with reference atoms CA, C, and a
  // virtual atom along the N direction, placing O at angle 121 from CA-C-O.
  //
  // Simpler approach: place O in the plane of N-CA-C, at 121 deg from CA
  const cToCa = vNormalize(vSub(caPos, cPos));
  const cToN = vNormalize(vSub(nPos, cPos));
  const planeN = vNormalize(vCross(cToCa, cToN));

  // Rotate cToCa by 121 deg around the plane normal to get O direction
  // (this puts O on the same side as N, which is the carbonyl orientation)
  const angleRad = degToRad(121.0);
  const oDir = rotateAboutAxis(cToCa, planeN, angleRad);
  const oLength = 1.24; // C=O bond length

  return vAdd(cPos, vScale(oDir, oLength));
}

/** Rodrigues' rotation: rotate v about axis by angleRad */
function rotateAboutAxis(v: Vec3, axis: Vec3, angleRad: number): Vec3 {
  const k = vNormalize(axis);
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);
  const kCrossV = vCross(k, v);
  const kDotV = vDot(k, v);
  return {
    x: v.x * cosA + kCrossV.x * sinA + k.x * kDotV * (1 - cosA),
    y: v.y * cosA + kCrossV.y * sinA + k.y * kDotV * (1 - cosA),
    z: v.z * cosA + kCrossV.z * sinA + k.z * kDotV * (1 - cosA),
  };
}

/**
 * Generate backbone atom coordinates for a protein.
 *
 * Builds the chain residue by residue using the NeRF algorithm:
 * - N(i)   from N(i-1), CA(i-1), C(i-1) with torsion psi(i-1)
 * - CA(i)  from CA(i-1), C(i-1), N(i)   with torsion omega ~ 180
 * - C(i)   from C(i-1), N(i), CA(i)     with torsion phi(i)
 * - O(i)   placed in the peptide plane
 *
 * @param config - Backbone configuration specifying length and secondary structure
 * @returns Array of backbone atoms (N, CA, C, O for each residue)
 */
export function generateBackbone(config: BackboneConfig): BackboneAtom[] {
  if (config.length <= 0) return [];

  const atoms: BackboneAtom[] = [];

  // -----------------------------------------------------------------------
  // First residue (i=0): place explicitly in the XZ plane
  // -----------------------------------------------------------------------
  const n0: Vec3 = { x: 0, y: 0, z: 0 };
  const ca0: Vec3 = { x: 0, y: 0, z: BACKBONE_BOND_LENGTHS.N_CA };

  // C at bond angle N-CA-C = 111 deg.
  // CA→N points along -z; the angle between CA→N and CA→C is 111°.
  // In spherical coords from +z, the CA→C direction is at (180° - 111°) = 69°.
  const alpha = degToRad(180 - BACKBONE_BOND_ANGLES.N_CA_C); // 69° from +z
  const c0: Vec3 = {
    x: BACKBONE_BOND_LENGTHS.CA_C * Math.sin(alpha),
    y: 0,
    z: ca0.z + BACKBONE_BOND_LENGTHS.CA_C * Math.cos(alpha),
  };

  const o0 = placeOxygen(n0, ca0, c0);

  atoms.push(
    { atomName: "N", ...n0, residueIndex: 0, residueName: "ALA" },
    { atomName: "CA", ...ca0, residueIndex: 0, residueName: "ALA" },
    { atomName: "C", ...c0, residueIndex: 0, residueName: "ALA" },
    { atomName: "O", ...o0, residueIndex: 0, residueName: "ALA" },
  );

  // -----------------------------------------------------------------------
  // Subsequent residues (i >= 1)
  // -----------------------------------------------------------------------
  for (let i = 1; i < config.length; i++) {
    const ssType = getSecondaryType(i, config);
    const prevSS = getSecondaryType(i - 1, config);
    const { phi } = getPhiPsi(ssType, i);
    const { psi: prevPsi } = getPhiPsi(prevSS, i - 1);

    // Atoms of previous residue
    const prevN = atoms[(i - 1) * 4 + 0];
    const prevCA = atoms[(i - 1) * 4 + 1];
    const prevC = atoms[(i - 1) * 4 + 2];

    // Step 1: Place N(i) from N(i-1), CA(i-1), C(i-1)
    //   bond = C-N = 1.32, angle = CA-C-N = 116, torsion = psi(i-1)
    const newN = nerfPlace(
      { x: prevN.x, y: prevN.y, z: prevN.z },
      { x: prevCA.x, y: prevCA.y, z: prevCA.z },
      { x: prevC.x, y: prevC.y, z: prevC.z },
      BACKBONE_BOND_LENGTHS.C_N,
      BACKBONE_BOND_ANGLES.CA_C_N,
      prevPsi,
    );

    // Step 2: Place CA(i) from CA(i-1), C(i-1), N(i)
    //   bond = N-CA = 1.47, angle = C-N-CA = 121, torsion = omega ~ 180
    const newCA = nerfPlace(
      { x: prevCA.x, y: prevCA.y, z: prevCA.z },
      { x: prevC.x, y: prevC.y, z: prevC.z },
      newN,
      BACKBONE_BOND_LENGTHS.N_CA,
      BACKBONE_BOND_ANGLES.C_N_CA,
      180, // trans peptide bond
    );

    // Step 3: Place C(i) from C(i-1), N(i), CA(i)
    //   bond = CA-C = 1.53, angle = N-CA-C = 111, torsion = phi(i)
    const newC = nerfPlace(
      { x: prevC.x, y: prevC.y, z: prevC.z },
      newN,
      newCA,
      BACKBONE_BOND_LENGTHS.CA_C,
      BACKBONE_BOND_ANGLES.N_CA_C,
      phi,
    );

    // Step 4: Place O(i) in the peptide plane
    const newO = placeOxygen(newN, newCA, newC);

    atoms.push(
      { atomName: "N", ...newN, residueIndex: i, residueName: "ALA" },
      { atomName: "CA", ...newCA, residueIndex: i, residueName: "ALA" },
      { atomName: "C", ...newC, residueIndex: i, residueName: "ALA" },
      { atomName: "O", ...newO, residueIndex: i, residueName: "ALA" },
    );
  }

  return atoms;
}

// ---------------------------------------------------------------------------
// PDB output
// ---------------------------------------------------------------------------

/**
 * Convert backbone atoms to PDB format text.
 *
 * Produces standard PDB ATOM records with correct column alignment,
 * plus TER and END records.
 */
export function backboneToPDB(atoms: BackboneAtom[]): string {
  if (atoms.length === 0) return "END\n";

  const lines: string[] = [];
  let serial = 1;

  for (const atom of atoms) {
    // PDB ATOM record format (fixed-width columns):
    // 1-6  "ATOM  "
    // 7-11 serial (int, right-justified)
    // 13-16 atom name
    // 17   altLoc
    // 18-20 residue name
    // 22   chain ID
    // 23-26 residue sequence number
    // 31-38 x (8.3f)
    // 39-46 y (8.3f)
    // 47-54 z (8.3f)
    // 55-60 occupancy (6.2f)
    // 61-66 tempFactor (6.2f)
    // 77-78 element

    const serialStr = String(serial).padStart(5, " ");
    const atomNameStr = atom.atomName.length < 4 ? ` ${atom.atomName}`.padEnd(4, " ") : atom.atomName;
    const resNameStr = atom.residueName.padStart(3, " ");
    const resSeqStr = String(atom.residueIndex + 1).padStart(4, " ");
    const xStr = atom.x.toFixed(3).padStart(8, " ");
    const yStr = atom.y.toFixed(3).padStart(8, " ");
    const zStr = atom.z.toFixed(3).padStart(8, " ");
    const elemStr = atom.atomName[0].padStart(2, " ");

    lines.push(
      `ATOM  ${serialStr} ${atomNameStr} ${resNameStr} A${resSeqStr}    ${xStr}${yStr}${zStr}  1.00  0.00          ${elemStr}`,
    );
    serial++;
  }

  lines.push("TER");
  lines.push("END");

  return lines.join("\n") + "\n";
}
