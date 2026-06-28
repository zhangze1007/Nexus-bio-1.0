/**
 * Langevin Dynamics MD Integrator
 *
 * Implements molecular dynamics using the BAOAB Langevin integrator
 * for NVT ensemble simulation. The BAOAB splitting provides excellent
 * sampling efficiency for Langevin dynamics.
 *
 * The Langevin equation of motion:
 *   m * a = F - γ * m * v + √(2γmkT) * η(t)
 *
 * where η(t) is Gaussian white noise.
 *
 * All internal computations use "natural" MD units:
 *   mass: amu, distance: Å, time: fs
 *   energy: amu*(Å/fs)² = 10 kJ/mol
 *   force: amu*Å/fs² = 10 kJ/(mol*Å)
 *
 * @scientific_provenance
 *   ALGORITHM: BAOAB Langevin integrator
 *   REFERENCE: Leimkuhler B, Matthews C (2013) Appl Math Res Express 2013:34
 *   ENSEMBLE: NVT (canonical)
 */

import type { BackboneAtom } from "./backboneGenerator";
import { calculateEnergy, calculateForces, DEFAULT_FORCE_FIELD_PARAMS, type ForceFieldParams } from "./forceField";
import { calculateRMSD } from "./rmsd";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MDConfig {
  /** Temperature (K) */
  temperature?: number; // default: 300
  /** Time step (fs) */
  timeStep?: number; // default: 2
  /** Number of steps */
  numSteps?: number; // default: 1000
  /** Friction coefficient for Langevin (ps^-1) */
  friction?: number; // default: 1.0
  /** Save interval (steps) */
  saveInterval?: number; // default: 100
}

export interface MDFrame {
  step: number;
  time: number; // ps
  atoms: BackboneAtom[];
  energy: number;
  temperature: number;
  rmsd: number;
}

export interface MDResult {
  frames: MDFrame[];
  initialEnergy: number;
  finalEnergy: number;
  meanTemperature: number;
  meanRMSD: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MD_CONFIG: Required<MDConfig> = {
  temperature: 300,
  timeStep: 2,
  numSteps: 1000,
  friction: 1.0,
  saveInterval: 100,
};

/**
 * Boltzmann constant in natural MD units: amu*(Å/fs)² / K
 *
 * kB = 1.380649e-23 J/K
 * 1 amu*(Å/fs)² = 1.66054e-27 * (1e-10)² / (1e-15)² J = 1.66054e-21 J
 * kB_MD = 1.380649e-23 / 1.66054e-21 = 0.008314 amu*(Å/fs)² / K
 *
 * This is numerically equal to kB in kJ/(mol*K), which is a known equivalence.
 */
const KB_MD = 0.008314; // amu*(Å/fs)² / K

/** Average backbone atom mass in amu */
const AVG_BACKBONE_MASS = 12.0; // amu

/**
 * Conversion: 1 amu*(Å/fs)² = 10.0 kJ/mol
 * (used to convert MD energies to kJ/mol for output)
 */
const MD_ENERGY_TO_KJ_MOL = 10.0;

/**
 * Conversion: 1 kJ/(mol*Å) = 0.1 amu*Å/fs²
 * (used to convert force field forces to natural MD units)
 *
 * Derivation:
 *   1 kJ/(mol*Å) = 1000/(6.022e23 * 1e-10) N = 1.661e-11 N
 *   1 amu*Å/fs² = 1.661e-27 * 1e-10 / (1e-15)² N = 1.661e-7 N
 *   Ratio = 1.661e-11 / 1.661e-7 = 1e-4
 *
 * Wait: 1 amu*(Å/fs)² = 10 kJ/mol
 * 1 amu*Å/fs² = 10 kJ/(mol*Å)
 * So 1 kJ/(mol*Å) = 0.1 amu*Å/fs²
 */
const KJ_MOL_A_TO_MD_FORCE = 0.1; // amu*Å/fs² per kJ/(mol*Å)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deepCopyAtoms(atoms: BackboneAtom[]): BackboneAtom[] {
  return atoms.map((a) => ({ ...a }));
}

/** Box-Muller transform for generating Gaussian random numbers. */
function gaussianRandom(): number {
  let u1 = 0;
  let u2 = 0;
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Compute instantaneous kinetic temperature from velocities.
 * Velocities in Å/fs, masses in amu.
 * Returns temperature in K.
 */
function kineticTemperature(velocities: Array<[number, number, number]>, masses: number[]): number {
  let ke = 0; // amu*(Å/fs)²
  for (let i = 0; i < velocities.length; i++) {
    const v = velocities[i];
    ke += masses[i] * (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  }
  ke *= 0.5; // KE = 0.5 * m * v²
  // T = 2*KE / (3*N*kB)
  // KE is in amu*(Å/fs)², kB is in amu*(Å/fs)²/K
  const dof = 3 * velocities.length;
  if (dof === 0) return 0;
  return (2 * ke) / (dof * KB_MD);
}

/**
 * Convert forces from kJ/(mol*Å) to natural MD units (amu*Å/fs²).
 */
function convertForcesToMD(forces: Array<[number, number, number]>): Array<[number, number, number]> {
  return forces.map((f) => [f[0] * KJ_MOL_A_TO_MD_FORCE, f[1] * KJ_MOL_A_TO_MD_FORCE, f[2] * KJ_MOL_A_TO_MD_FORCE]);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run Langevin dynamics molecular dynamics simulation.
 *
 * Uses the BAOAB integrator (Leimkuhler & Matthews, 2013):
 *   B: v += (dt/2) * F/m
 *   A: x += (dt/2) * v
 *   O: v = c*v + sqrt(kB*T*(1-c²)/m) * ξ
 *   A: x += (dt/2) * v
 *   compute F
 *   B: v += (dt/2) * F/m
 *
 * where c = exp(-γ*dt), γ in fs⁻¹.
 *
 * @param atoms Initial backbone atom positions
 * @param config MD configuration
 * @returns MDResult with frames and statistics
 */
export function runMD(atoms: BackboneAtom[], config?: MDConfig): MDResult {
  const cfg = { ...DEFAULT_MD_CONFIG, ...config };
  const ffParams: ForceFieldParams = DEFAULT_FORCE_FIELD_PARAMS;

  if (atoms.length === 0) {
    return {
      frames: [],
      initialEnergy: 0,
      finalEnergy: 0,
      meanTemperature: 0,
      meanRMSD: 0,
    };
  }

  const nAtoms = atoms.length;
  const dt = cfg.timeStep; // fs
  const T = cfg.temperature; // K

  // Convert friction from ps⁻¹ to fs⁻¹
  const gammaFs = cfg.friction * 1e-3; // fs⁻¹

  // BAOAB coefficients
  const c = Math.exp(-gammaFs * dt); // O-step velocity scaling
  const sigmaV = Math.sqrt((KB_MD * T * (1 - c * c)) / AVG_BACKBONE_MASS); // noise amplitude

  // Masses
  const masses = new Array(nAtoms).fill(AVG_BACKBONE_MASS);

  // Initialize positions
  let positions = deepCopyAtoms(atoms);
  const initialPositions = deepCopyAtoms(atoms);

  // Initialize velocities from Maxwell-Boltzmann distribution at target T
  // v ~ N(0, sqrt(kB*T/m)) per component
  const vSigma = Math.sqrt((KB_MD * T) / AVG_BACKBONE_MASS);
  const velocities: Array<[number, number, number]> = [];
  for (let i = 0; i < nAtoms; i++) {
    velocities.push([vSigma * gaussianRandom(), vSigma * gaussianRandom(), vSigma * gaussianRandom()]);
  }

  // Remove center-of-mass velocity to prevent drift
  let cmVx = 0,
    cmVy = 0,
    cmVz = 0;
  for (let i = 0; i < nAtoms; i++) {
    cmVx += velocities[i][0];
    cmVy += velocities[i][1];
    cmVz += velocities[i][2];
  }
  cmVx /= nAtoms;
  cmVy /= nAtoms;
  cmVz /= nAtoms;
  for (let i = 0; i < nAtoms; i++) {
    velocities[i][0] -= cmVx;
    velocities[i][1] -= cmVy;
    velocities[i][2] -= cmVz;
  }

  const initialEnergy = calculateEnergy(positions, ffParams);
  const frames: MDFrame[] = [];
  const temperatures: number[] = [];
  const rmsds: number[] = [];

  // Save initial frame
  frames.push({
    step: 0,
    time: 0,
    atoms: deepCopyAtoms(positions),
    energy: initialEnergy,
    temperature: kineticTemperature(velocities, masses),
    rmsd: 0,
  });

  // Convert forces to natural MD units
  let forcesMD = convertForcesToMD(calculateForces(positions, ffParams));

  // BAOAB Langevin integration loop
  for (let step = 1; step <= cfg.numSteps; step++) {
    const halfDt = 0.5 * dt;
    const invMass = 1.0 / AVG_BACKBONE_MASS;

    // B: v += (dt/2) * F/m
    for (let i = 0; i < nAtoms; i++) {
      velocities[i][0] += halfDt * forcesMD[i][0] * invMass;
      velocities[i][1] += halfDt * forcesMD[i][1] * invMass;
      velocities[i][2] += halfDt * forcesMD[i][2] * invMass;
    }

    // A: x += (dt/2) * v
    for (let i = 0; i < nAtoms; i++) {
      positions[i] = {
        ...positions[i],
        x: positions[i].x + halfDt * velocities[i][0],
        y: positions[i].y + halfDt * velocities[i][1],
        z: positions[i].z + halfDt * velocities[i][2],
      };
    }

    // O: thermostat step — Ornstein-Uhlenbeck
    // v = c*v + σ*ξ
    for (let i = 0; i < nAtoms; i++) {
      velocities[i][0] = c * velocities[i][0] + sigmaV * gaussianRandom();
      velocities[i][1] = c * velocities[i][1] + sigmaV * gaussianRandom();
      velocities[i][2] = c * velocities[i][2] + sigmaV * gaussianRandom();
    }

    // A: x += (dt/2) * v
    for (let i = 0; i < nAtoms; i++) {
      positions[i] = {
        ...positions[i],
        x: positions[i].x + halfDt * velocities[i][0],
        y: positions[i].y + halfDt * velocities[i][1],
        z: positions[i].z + halfDt * velocities[i][2],
      };
    }

    // Compute new forces
    forcesMD = convertForcesToMD(calculateForces(positions, ffParams));

    // B: v += (dt/2) * F/m
    for (let i = 0; i < nAtoms; i++) {
      velocities[i][0] += halfDt * forcesMD[i][0] * invMass;
      velocities[i][1] += halfDt * forcesMD[i][1] * invMass;
      velocities[i][2] += halfDt * forcesMD[i][2] * invMass;
    }

    // Record frame at save interval
    if (step % cfg.saveInterval === 0 || step === cfg.numSteps) {
      const energy = calculateEnergy(positions, ffParams);
      const temp = kineticTemperature(velocities, masses);
      const rmsd = calculateRMSD(positions, initialPositions);

      frames.push({
        step,
        time: step * dt * 1e-3, // convert fs to ps
        atoms: deepCopyAtoms(positions),
        energy,
        temperature: temp,
        rmsd,
      });

      temperatures.push(temp);
      rmsds.push(rmsd);
    }
  }

  const finalEnergy = calculateEnergy(positions, ffParams);
  const meanTemperature = temperatures.length > 0 ? temperatures.reduce((a, b) => a + b, 0) / temperatures.length : 0;
  const meanRMSD = rmsds.length > 0 ? rmsds.reduce((a, b) => a + b, 0) / rmsds.length : 0;

  return {
    frames,
    initialEnergy,
    finalEnergy,
    meanTemperature,
    meanRMSD,
  };
}
