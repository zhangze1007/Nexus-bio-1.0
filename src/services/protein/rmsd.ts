/**
 * RMSD Calculator and Kabsch Structural Alignment
 *
 * Computes Root-Mean-Square Deviation between two sets of backbone atoms
 * and implements the Kabsch algorithm for optimal superposition.
 *
 * Units: Angstroms (A) for distances, dimensionless for RMSD.
 *
 * @scientific_provenance
 *   ALGORITHM: Kabsch algorithm for optimal superposition
 *   REFERENCE: Kabsch W (1976) Acta Cryst A32:922-923
 *   REFERENCE: Kabsch W (1978) Acta Cryst A34:827-828
 */

import type { BackboneAtom } from './backboneGenerator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Vec3 = [number, number, number];

// ---------------------------------------------------------------------------
// Internal linear algebra helpers
// ---------------------------------------------------------------------------

function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function norm(v: Vec3): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

/** Compute centroid of an array of Vec3. */
function centroid(points: Vec3[]): Vec3 {
  const n = points.length;
  if (n === 0) return [0, 0, 0];
  let cx = 0, cy = 0, cz = 0;
  for (const p of points) {
    cx += p[0];
    cy += p[1];
    cz += p[2];
  }
  return [cx / n, cy / n, cz / n];
}

/**
 * 3x3 SVD decomposition via Jacobi eigenvalue algorithm.
 * Returns U, S (singular values), Vt such that A = U * diag(S) * Vt.
 * For a 3x3 matrix this is efficient enough without external deps.
 */
function svd3x3(A: number[][]): { U: number[][]; S: number[]; Vt: number[][] } {
  // Compute A^T * A for right singular vectors
  const ATA = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 3; k++) {
        ATA[i][j] += A[k][i] * A[k][j];
      }
    }
  }

  // Jacobi eigenvalue algorithm for symmetric 3x3 matrix
  const eigenResult = jacobiEigen(ATA);
  const V = eigenResult.eigenvectors;
  const singularValues = eigenResult.eigenvalues.map((v) => Math.sqrt(Math.max(0, v)));

  // Sort by singular value descending
  const indices = [0, 1, 2].sort((a, b) => singularValues[b] - singularValues[a]);
  const sortedS = indices.map((i) => singularValues[i]);
  const sortedV = indices.map((i) => V[i]);

  // U = A * V * diag(1/S)
  const U: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 3; k++) {
        U[i][j] += A[i][k] * sortedV[j][k];
      }
      U[i][j] = sortedS[j] > 1e-12 ? U[i][j] / sortedS[j] : 0;
    }
  }

  // Vt = V^T (sorted)
  const Vt: number[][] = [
    [sortedV[0][0], sortedV[1][0], sortedV[2][0]],
    [sortedV[0][1], sortedV[1][1], sortedV[2][1]],
    [sortedV[0][2], sortedV[1][2], sortedV[2][2]],
  ];

  return { U, S: sortedS, Vt };
}

/** Jacobi eigenvalue algorithm for symmetric 3x3 matrix. */
function jacobiEigen(M: number[][]): { eigenvalues: number[]; eigenvectors: number[][] } {
  // Copy
  let A = M.map((row) => [...row]);
  const V = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];

  const maxIter = 100;
  for (let iter = 0; iter < maxIter; iter++) {
    // Find largest off-diagonal element
    let p = 0, q = 1;
    let maxVal = Math.abs(A[0][1]);
    if (Math.abs(A[0][2]) > maxVal) { p = 0; q = 2; maxVal = Math.abs(A[0][2]); }
    if (Math.abs(A[1][2]) > maxVal) { p = 1; q = 2; maxVal = Math.abs(A[1][2]); }

    if (maxVal < 1e-14) break;

    // Compute rotation angle
    const theta = A[p][p] === A[q][q]
      ? Math.PI / 4
      : 0.5 * Math.atan2(2 * A[p][q], A[p][p] - A[q][q]);

    const c = Math.cos(theta);
    const s = Math.sin(theta);

    // Apply rotation: A' = G^T * A * G
    const newA = A.map((row) => [...row]);
    for (let i = 0; i < 3; i++) {
      newA[i][p] = c * A[i][p] + s * A[i][q];
      newA[i][q] = -s * A[i][p] + c * A[i][q];
    }
    A = newA.map((row) => [...row]);
    for (let j = 0; j < 3; j++) {
      A[p][j] = c * newA[p][j] + s * newA[q][j];
      A[q][j] = -s * newA[p][j] + c * newA[q][j];
    }

    // Accumulate eigenvectors
    for (let i = 0; i < 3; i++) {
      const vip = V[i][p];
      const viq = V[i][q];
      V[i][p] = c * vip + s * viq;
      V[i][q] = -s * vip + c * viq;
    }
  }

  return {
    eigenvalues: [A[0][0], A[1][1], A[2][2]],
    eigenvectors: V[0].map((_, col) => V.map((row) => row[col])),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calculate RMSD between two sets of backbone atoms.
 * Does NOT align — computes raw RMSD based on corresponding atoms.
 *
 * @param atoms1 First structure
 * @param atoms2 Second structure (must be same length)
 * @returns RMSD in Angstroms
 */
export function calculateRMSD(atoms1: BackboneAtom[], atoms2: BackboneAtom[]): number {
  if (atoms1.length === 0 || atoms2.length === 0) {
    throw new Error('Cannot calculate RMSD for empty atom arrays');
  }
  if (atoms1.length !== atoms2.length) {
    throw new Error(`Atom arrays must have same length: ${atoms1.length} vs ${atoms2.length}`);
  }

  let sumSqDist = 0;
  for (let i = 0; i < atoms1.length; i++) {
    const dx = atoms1[i].x - atoms2[i].x;
    const dy = atoms1[i].y - atoms2[i].y;
    const dz = atoms1[i].z - atoms2[i].z;
    sumSqDist += dx * dx + dy * dy + dz * dz;
  }

  return Math.sqrt(sumSqDist / atoms1.length);
}

/**
 * Align mobile structure onto reference using the Kabsch algorithm.
 * Returns a new array of BackboneAtom with aligned coordinates.
 *
 * Steps:
 * 1. Center both structures at their centroids
 * 2. Compute covariance matrix H = P_mobile^T * Q_reference
 * 3. SVD of H
 * 4. Compute optimal rotation R = V * diag(1,1,det(V*U^T)) * U^T
 * 5. Apply rotation and translate to reference centroid
 *
 * @param mobile Structure to be aligned
 * @param reference Fixed reference structure
 * @returns New array of aligned backbone atoms
 */
export function alignStructures(
  mobile: BackboneAtom[],
  reference: BackboneAtom[],
): BackboneAtom[] {
  if (mobile.length !== reference.length) {
    throw new Error(`Structures must have same length: ${mobile.length} vs ${reference.length}`);
  }
  if (mobile.length === 0) return [];

  // Step 1: Convert to Vec3 arrays and compute centroids
  const mobilePts: Vec3[] = mobile.map((a) => [a.x, a.y, a.z]);
  const refPts: Vec3[] = reference.map((a) => [a.x, a.y, a.z]);

  const mobileCent = centroid(mobilePts);
  const refCent = centroid(refPts);

  // Center both
  const centeredMobile = mobilePts.map((p) => subtract(p, mobileCent));
  const centeredRef = refPts.map((p) => subtract(p, refCent));

  // Step 2: Covariance matrix H = P^T * Q (3x3)
  const H = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < centeredMobile.length; i++) {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        H[r][c] += centeredMobile[i][r] * centeredRef[i][c];
      }
    }
  }

  // Step 3: SVD of H
  const { U, Vt } = svd3x3(H);

  // Step 4: Check for reflection
  const det = determinant3x3(matrixMultiply(Vt, transpose3x3(U)));
  const d = det < 0 ? -1 : 1;
  const diag = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, d],
  ];

  // R = V^T^T * diag * U^T = V * diag * U^T
  const R = matrixMultiply(matrixMultiply(transpose3x3(Vt), diag), U);

  // Step 5: Apply rotation and translate
  const aligned: BackboneAtom[] = [];
  for (let i = 0; i < mobile.length; i++) {
    const p = centeredMobile[i];
    const rotated: Vec3 = [
      R[0][0] * p[0] + R[0][1] * p[1] + R[0][2] * p[2],
      R[1][0] * p[0] + R[1][1] * p[1] + R[1][2] * p[2],
      R[2][0] * p[0] + R[2][1] * p[1] + R[2][2] * p[2],
    ];
    const finalPos = add(rotated, refCent);
    aligned.push({
      atomName: mobile[i].atomName,
      x: finalPos[0],
      y: finalPos[1],
      z: finalPos[2],
      residueIndex: mobile[i].residueIndex,
      residueName: mobile[i].residueName,
    });
  }

  return aligned;
}

// ---------------------------------------------------------------------------
// Matrix helpers
// ---------------------------------------------------------------------------

function transpose3x3(M: number[][]): number[][] {
  return [
    [M[0][0], M[1][0], M[2][0]],
    [M[0][1], M[1][1], M[2][1]],
    [M[0][2], M[1][2], M[2][2]],
  ];
}

function matrixMultiply(A: number[][], B: number[][]): number[][] {
  const C = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 3; k++) {
        C[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  return C;
}

function determinant3x3(M: number[][]): number {
  return (
    M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
    M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
    M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0])
  );
}
