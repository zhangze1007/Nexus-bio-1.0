/**
 * Steepest Descent Energy Minimizer
 *
 * Minimizes protein backbone potential energy using the steepest descent
 * algorithm. Moves atoms along the negative gradient (force direction)
 * with a fixed step size until convergence or max iterations.
 *
 * Units: kJ/mol for energy, A for distance, kJ/mol/A for forces.
 *
 * @scientific_provenance
 *   ALGORITHM: Steepest descent energy minimization
 *   REFERENCE: Levitt M, Lifson S (1969) J Mol Biol 46:269-279
 */

import type { BackboneAtom } from "./backboneGenerator";
import { calculateEnergy, calculateForces, DEFAULT_FORCE_FIELD_PARAMS, type ForceFieldParams } from "./forceField";
import { calculateRMSD } from "./rmsd";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EnergyMinimizationConfig {
  /** Maximum iterations */
  maxIterations?: number; // default: 1000
  /** Convergence threshold (kJ/mol/A) */
  convergenceThreshold?: number; // default: 0.1
  /** Step size (A) */
  stepSize?: number; // default: 0.01
  /** Force field: 'amber' | 'charmm' | 'simple' */
  forceField?: string; // default: 'simple'
}

export interface MinimizationResult {
  initialEnergy: number;
  finalEnergy: number;
  iterations: number;
  converged: boolean;
  rmsd: number; // RMSD from initial structure
  trajectory: Array<{
    step: number;
    energy: number;
    rmsd: number;
  }>;
}

// ---------------------------------------------------------------------------
// Default config
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: Required<EnergyMinimizationConfig> = {
  maxIterations: 1000,
  convergenceThreshold: 0.1,
  stepSize: 0.01,
  forceField: "simple",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deepCopyAtoms(atoms: BackboneAtom[]): BackboneAtom[] {
  return atoms.map((a) => ({ ...a }));
}

function maxForceMagnitude(forces: Array<[number, number, number]>): number {
  let maxF = 0;
  for (const f of forces) {
    const mag = Math.sqrt(f[0] * f[0] + f[1] * f[1] + f[2] * f[2]);
    if (mag > maxF) maxF = mag;
  }
  return maxF;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Minimize protein backbone energy using steepest descent.
 *
 * At each step:
 * 1. Compute forces F = -dE/dr
 * 2. Normalize forces to unit vectors
 * 3. Move atoms: r_new = r_old + stepSize * F_hat
 * 4. Check convergence: max|F| < threshold
 *
 * @param atoms Backbone atoms to minimize
 * @param config Minimization configuration
 * @returns MinimizationResult with trajectory and statistics
 */
export function minimizeEnergy(atoms: BackboneAtom[], config?: EnergyMinimizationConfig): MinimizationResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const ffParams: ForceFieldParams = DEFAULT_FORCE_FIELD_PARAMS;

  if (atoms.length === 0) {
    return {
      initialEnergy: 0,
      finalEnergy: 0,
      iterations: 0,
      converged: true,
      rmsd: 0,
      trajectory: [],
    };
  }

  // Save initial structure for RMSD calculation
  const initialAtoms = deepCopyAtoms(atoms);
  const currentAtoms = deepCopyAtoms(atoms);

  const initialEnergy = calculateEnergy(currentAtoms, ffParams);
  const trajectory: MinimizationResult["trajectory"] = [];

  // Record initial state
  trajectory.push({
    step: 0,
    energy: initialEnergy,
    rmsd: 0,
  });

  let converged = false;
  let finalEnergy = initialEnergy;

  for (let iter = 1; iter <= cfg.maxIterations; iter++) {
    // Compute forces
    const forces = calculateForces(currentAtoms, ffParams);
    const maxF = maxForceMagnitude(forces);

    // Check convergence
    if (maxF < cfg.convergenceThreshold) {
      converged = true;
      finalEnergy = calculateEnergy(currentAtoms, ffParams);
      const rmsd = calculateRMSD(currentAtoms, initialAtoms);
      trajectory.push({ step: iter, energy: finalEnergy, rmsd });
      return {
        initialEnergy,
        finalEnergy,
        iterations: iter,
        converged: true,
        rmsd,
        trajectory,
      };
    }

    // Move atoms along force direction (steepest descent)
    for (let i = 0; i < currentAtoms.length; i++) {
      const f = forces[i];
      const fMag = Math.sqrt(f[0] * f[0] + f[1] * f[1] + f[2] * f[2]);
      if (fMag > 1e-12) {
        // Normalize and scale by step size
        currentAtoms[i] = {
          ...currentAtoms[i],
          x: currentAtoms[i].x + cfg.stepSize * (f[0] / fMag),
          y: currentAtoms[i].y + cfg.stepSize * (f[1] / fMag),
          z: currentAtoms[i].z + cfg.stepSize * (f[2] / fMag),
        };
      }
    }

    // Record trajectory every 10 steps or at the end
    if (iter % 10 === 0 || iter === cfg.maxIterations) {
      const energy = calculateEnergy(currentAtoms, ffParams);
      const rmsd = calculateRMSD(currentAtoms, initialAtoms);
      trajectory.push({ step: iter, energy, rmsd });
      finalEnergy = energy;
    }
  }

  // Did not converge within maxIterations
  const finalRmsd = calculateRMSD(currentAtoms, initialAtoms);
  return {
    initialEnergy,
    finalEnergy,
    iterations: cfg.maxIterations,
    converged: false,
    rmsd: finalRmsd,
    trajectory,
  };
}
