/**
 * Simplified Harmonic Force Field for Protein Backbone
 *
 * Implements a simplified force field with:
 * - Bond stretching: E = k_b * (r - r0)^2
 * - Angle bending: E = k_a * (θ - θ0)^2
 * - Torsional: E = k_d * (1 + cos(nφ - γ))
 * - Lennard-Jones: E = 4ε[(σ/r)^12 - (σ/r)^6]
 * - Coulomb: E = q1*q2 / (4πε0*r) (simplified)
 *
 * Units: kJ/mol for energy, A for distance, rad for angles.
 *
 * @scientific_provenance
 *   ALGORITHM: Harmonic force field with LJ + Coulomb
 *   PARAMETERS: Simplified AMBER-style
 *   REFERENCE: Cornell WD et al. (1995) JACS 117:5179-5197 (AMBER)
 */

import type { BackboneAtom } from './backboneGenerator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ForceFieldParams {
  /** Bond stretching force constant (kJ/mol/A^2) */
  bondForceConstant: number;
  /** Angle bending force constant (kJ/mol/rad^2) */
  angleForceConstant: number;
  /** Dihedral force constant (kJ/mol) */
  dihedralForceConstant: number;
  /** Lennard-Jones well depth (kJ/mol) */
  ljEpsilon: number;
  /** Lennard-Jones sigma (A) */
  ljSigma: number;
}

type Vec3 = [number, number, number];

// ---------------------------------------------------------------------------
// Default parameters
// ---------------------------------------------------------------------------

export const DEFAULT_FORCE_FIELD_PARAMS: ForceFieldParams = {
  bondForceConstant: 300,   // kJ/mol/A^2
  angleForceConstant: 50,   // kJ/mol/rad^2
  dihedralForceConstant: 10, // kJ/mol
  ljEpsilon: 0.5,           // kJ/mol
  ljSigma: 3.5,             // A
};

/** Equilibrium bond lengths by atom pair (A) */
const BOND_EQ_LENGTHS: Record<string, number> = {
  'N-CA': 1.47,
  'CA-C': 1.53,
  'C-N': 1.32,
};

/** Equilibrium bond angles (rad) */
const BOND_EQ_ANGLES: Record<string, number> = {
  'N-CA-C': (111 * Math.PI) / 180,
  'CA-C-N': (116 * Math.PI) / 180,
  'C-N-CA': (121 * Math.PI) / 180,
};

/** Simplified partial charges (e) */
const CHARGES: Record<string, number> = {
  N: -0.35,
  CA: 0.0,
  C: 0.35,
  O: -0.35,
};

/** Coulomb constant: 1/(4*pi*epsilon0) in kJ*A/mol/e^2 */
const COULOMB_K = 138.935;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function vec3Sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function vec3Add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function vec3Scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

function vec3Dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function vec3Cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function vec3Norm(v: Vec3): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

function getBondKey(a: BackboneAtom, b: BackboneAtom): string | null {
  const key1 = `${a.atomName}-${b.atomName}`;
  const key2 = `${b.atomName}-${a.atomName}`;
  if (BOND_EQ_LENGTHS[key1]) return key1;
  if (BOND_EQ_LENGTHS[key2]) return key2;
  return null;
}

function getAngleKey(a: BackboneAtom, b: BackboneAtom, c: BackboneAtom): string | null {
  const key = `${a.atomName}-${b.atomName}-${c.atomName}`;
  if (BOND_EQ_ANGLES[key]) return key;
  return null;
}

function getAtomPos(atoms: BackboneAtom[], i: number): Vec3 {
  return [atoms[i].x, atoms[i].y, atoms[i].z];
}

// ---------------------------------------------------------------------------
// Energy terms
// ---------------------------------------------------------------------------

/** Bond stretching energy: E = k_b * (r - r0)^2 */
function bondEnergy(pos1: Vec3, pos2: Vec3, r0: number, kb: number): number {
  const diff = vec3Sub(pos2, pos1);
  const r = vec3Norm(diff);
  return kb * (r - r0) * (r - r0);
}

/** Bond stretching force (on atom1) */
function bondForce(pos1: Vec3, pos2: Vec3, r0: number, kb: number): Vec3 {
  const diff = vec3Sub(pos2, pos1);
  const r = vec3Norm(diff);
  if (r < 1e-12) return [0, 0, 0];
  const fMag = -2 * kb * (r - r0);
  const dir = vec3Scale(diff, 1 / r);
  return vec3Scale(dir, fMag);
}

/** Angle bending energy: E = k_a * (θ - θ0)^2 */
function angleEnergy(pos1: Vec3, pos2: Vec3, pos3: Vec3, theta0: number, ka: number): number {
  const v1 = vec3Sub(pos1, pos2);
  const v2 = vec3Sub(pos3, pos2);
  const dot = vec3Dot(v1, v2);
  const n1 = vec3Norm(v1);
  const n2 = vec3Norm(v2);
  if (n1 < 1e-12 || n2 < 1e-12) return 0;
  const cosTheta = Math.max(-1, Math.min(1, dot / (n1 * n2)));
  const theta = Math.acos(cosTheta);
  return ka * (theta - theta0) * (theta - theta0);
}

/** Angle bending force contribution on atom1 (central atom gets reaction) */
function angleForceOnEnd(
  pos1: Vec3,
  pos2: Vec3,
  pos3: Vec3,
  theta0: number,
  ka: number,
): Vec3 {
  const v1 = vec3Sub(pos1, pos2);
  const v2 = vec3Sub(pos3, pos2);
  const n1 = vec3Norm(v1);
  const n2 = vec3Norm(v2);
  if (n1 < 1e-12 || n2 < 1e-12) return [0, 0, 0];
  const cosTheta = Math.max(-1, Math.min(1, vec3Dot(v1, v2) / (n1 * n2)));
  const theta = Math.acos(cosTheta);
  if (Math.abs(theta) < 1e-12) return [0, 0, 0];

  const sinTheta = Math.sin(theta);
  if (Math.abs(sinTheta) < 1e-12) return [0, 0, 0];

  const dTheta = theta - theta0;
  const fMag = -2 * ka * dTheta / sinTheta;

  // Gradient direction: perpendicular to v1 in the v1-v2 plane
  const v1hat = vec3Scale(v1, 1 / n1);
  const v2hat = vec3Scale(v2, 1 / n2);
  const cosT = vec3Dot(v1hat, v2hat);
  const perp = vec3Sub(v2hat, vec3Scale(v1hat, cosT));
  const perpNorm = vec3Norm(perp);
  if (perpNorm < 1e-12) return [0, 0, 0];
  const perpHat = vec3Scale(perp, 1 / perpNorm);

  return vec3Scale(perpHat, fMag / n1);
}

/** Torsional energy: E = k_d * (1 + cos(nφ - γ)) */
function torsionalEnergy(
  pos1: Vec3,
  pos2: Vec3,
  pos3: Vec3,
  pos4: Vec3,
  kd: number,
  n = 3,
  gamma = 0,
): number {
  const b1 = vec3Sub(pos2, pos1);
  const b2 = vec3Sub(pos3, pos2);
  const b3 = vec3Sub(pos4, pos3);

  const n1 = vec3Cross(b1, b2);
  const n2 = vec3Cross(b2, b3);
  const n1Norm = vec3Norm(n1);
  const n2Norm = vec3Norm(n2);
  const b2Norm = vec3Norm(b2);

  if (n1Norm < 1e-12 || n2Norm < 1e-12 || b2Norm < 1e-12) return 0;

  const cosPhi = vec3Dot(n1, n2) / (n1Norm * n2Norm);
  const m1 = vec3Cross(n1, vec3Scale(b2, 1 / b2Norm));
  const sinPhi = vec3Dot(m1, n2) / n2Norm;

  const phi = Math.atan2(sinPhi, cosPhi);
  return kd * (1 + Math.cos(n * phi - gamma));
}

/** Lennard-Jones energy: E = 4ε[(σ/r)^12 - (σ/r)^6] */
function ljEnergy(pos1: Vec3, pos2: Vec3, epsilon: number, sigma: number): number {
  const diff = vec3Sub(pos2, pos1);
  const r = vec3Norm(diff);
  if (r < 1e-12) return Infinity;
  const sr6 = Math.pow(sigma / r, 6);
  const sr12 = sr6 * sr6;
  return 4 * epsilon * (sr12 - sr6);
}

/** LJ force (on atom1) */
function ljForce(pos1: Vec3, pos2: Vec3, epsilon: number, sigma: number): Vec3 {
  const diff = vec3Sub(pos2, pos1);
  const r = vec3Norm(diff);
  if (r < 1e-12) return [0, 0, 0];
  const sr6 = Math.pow(sigma / r, 6);
  const sr12 = sr6 * sr6;
  // F = -dE/dr * (r_vec/r)
  const fMag = 24 * epsilon * (2 * sr12 - sr6) / r;
  const dir = vec3Scale(diff, 1 / r);
  return vec3Scale(dir, fMag);
}

/** Coulomb energy: E = k * q1 * q2 / r */
function coulombEnergy(pos1: Vec3, pos2: Vec3, q1: number, q2: number): number {
  const diff = vec3Sub(pos2, pos1);
  const r = vec3Norm(diff);
  if (r < 1e-12) return Infinity;
  return COULOMB_K * q1 * q2 / r;
}

/** Coulomb force (on atom1) */
function coulombForce(pos1: Vec3, pos2: Vec3, q1: number, q2: number): Vec3 {
  const diff = vec3Sub(pos2, pos1);
  const r = vec3Norm(diff);
  if (r < 1e-12) return [0, 0, 0];
  const fMag = COULOMB_K * q1 * q2 / (r * r);
  const dir = vec3Scale(diff, 1 / r);
  return vec3Scale(dir, fMag);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calculate total potential energy of a protein backbone.
 *
 * @param atoms Backbone atoms
 * @param params Force field parameters (uses defaults if omitted)
 * @returns Total energy in kJ/mol
 */
export function calculateEnergy(
  atoms: BackboneAtom[],
  params: ForceFieldParams = DEFAULT_FORCE_FIELD_PARAMS,
): number {
  if (atoms.length === 0) return 0;
  if (atoms.length === 1) return 0;

  let totalEnergy = 0;

  // Bond stretching: consecutive atoms that form known bonds
  for (let i = 0; i < atoms.length - 1; i++) {
    const bondKey = getBondKey(atoms[i], atoms[i + 1]);
    if (bondKey) {
      const r0 = BOND_EQ_LENGTHS[bondKey];
      totalEnergy += bondEnergy(
        getAtomPos(atoms, i),
        getAtomPos(atoms, i + 1),
        r0,
        params.bondForceConstant,
      );
    }
  }

  // Angle bending: i, i+1, i+2 with known angles
  for (let i = 0; i < atoms.length - 2; i++) {
    const angleKey = getAngleKey(atoms[i], atoms[i + 1], atoms[i + 2]);
    if (angleKey) {
      const theta0 = BOND_EQ_ANGLES[angleKey];
      totalEnergy += angleEnergy(
        getAtomPos(atoms, i),
        getAtomPos(atoms, i + 1),
        getAtomPos(atoms, i + 2),
        theta0,
        params.angleForceConstant,
      );
    }
  }

  // Torsional: i, i+1, i+2, i+3
  for (let i = 0; i < atoms.length - 3; i++) {
    totalEnergy += torsionalEnergy(
      getAtomPos(atoms, i),
      getAtomPos(atoms, i + 1),
      getAtomPos(atoms, i + 2),
      getAtomPos(atoms, i + 3),
      params.dihedralForceConstant,
    );
  }

  // Non-bonded: LJ + Coulomb (all pairs beyond bonded)
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 2; j < atoms.length; j++) {
      // Skip if directly bonded (covered by bond term)
      const pos1 = getAtomPos(atoms, i);
      const pos2 = getAtomPos(atoms, j);
      totalEnergy += ljEnergy(pos1, pos2, params.ljEpsilon, params.ljSigma);
      const q1 = CHARGES[atoms[i].atomName] ?? 0;
      const q2 = CHARGES[atoms[j].atomName] ?? 0;
      if (q1 !== 0 && q2 !== 0) {
        totalEnergy += coulombEnergy(pos1, pos2, q1, q2);
      }
    }
  }

  return totalEnergy;
}

/**
 * Calculate forces on each atom (negative gradient of energy).
 *
 * @param atoms Backbone atoms
 * @param params Force field parameters (uses defaults if omitted)
 * @returns Array of [fx, fy, fz] force vectors in kJ/mol/A
 */
export function calculateForces(
  atoms: BackboneAtom[],
  params: ForceFieldParams = DEFAULT_FORCE_FIELD_PARAMS,
): Array<[number, number, number]> {
  if (atoms.length === 0) return [];
  if (atoms.length === 1) return [[0, 0, 0]];

  // Initialize forces
  const forces: Vec3[] = atoms.map(() => [0, 0, 0] as Vec3);

  // Bond forces
  for (let i = 0; i < atoms.length - 1; i++) {
    const bondKey = getBondKey(atoms[i], atoms[i + 1]);
    if (bondKey) {
      const r0 = BOND_EQ_LENGTHS[bondKey];
      const f = bondForce(
        getAtomPos(atoms, i),
        getAtomPos(atoms, i + 1),
        r0,
        params.bondForceConstant,
      );
      forces[i] = vec3Add(forces[i], f);
      forces[i + 1] = vec3Sub(forces[i + 1], f); // Newton's 3rd law
    }
  }

  // Angle forces
  for (let i = 0; i < atoms.length - 2; i++) {
    const angleKey = getAngleKey(atoms[i], atoms[i + 1], atoms[i + 2]);
    if (angleKey) {
      const theta0 = BOND_EQ_ANGLES[angleKey];
      const f1 = angleForceOnEnd(
        getAtomPos(atoms, i),
        getAtomPos(atoms, i + 1),
        getAtomPos(atoms, i + 2),
        theta0,
        params.angleForceConstant,
      );
      const f3 = angleForceOnEnd(
        getAtomPos(atoms, i + 2),
        getAtomPos(atoms, i + 1),
        getAtomPos(atoms, i),
        theta0,
        params.angleForceConstant,
      );
      forces[i] = vec3Add(forces[i], f1);
      forces[i + 2] = vec3Add(forces[i + 2], f3);
      forces[i + 1] = vec3Sub(forces[i + 1], vec3Add(f1, f3)); // reaction
    }
  }

  // Non-bonded forces: LJ + Coulomb
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 2; j < atoms.length; j++) {
      const pos1 = getAtomPos(atoms, i);
      const pos2 = getAtomPos(atoms, j);
      const fLJ = ljForce(pos1, pos2, params.ljEpsilon, params.ljSigma);
      forces[i] = vec3Add(forces[i], fLJ);
      forces[j] = vec3Sub(forces[j], fLJ);

      const q1 = CHARGES[atoms[i].atomName] ?? 0;
      const q2 = CHARGES[atoms[j].atomName] ?? 0;
      if (q1 !== 0 && q2 !== 0) {
        const fC = coulombForce(pos1, pos2, q1, q2);
        forces[i] = vec3Add(forces[i], fC);
        forces[j] = vec3Sub(forces[j], fC);
      }
    }
  }

  return forces.map((f) => [f[0], f[1], f[2]]);
}
