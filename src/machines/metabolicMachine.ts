/**
 * Nexus-Bio — Metabolic Engineering Lab FSM
 *
 * States (deterministic, no boolean soup):
 *
 *   idle ──[START]──► simulating ──[STRESS]──► stress_test
 *     ▲                   │  ▲                      │
 *     └──[RESET]──────────┘  └──[RESUME]────────────┘
 *                            ┌──[EQUILIBRATE]──────────────► equilibrium
 *                            │                                    │
 *                            └───────────[RESET]──────────────────┘
 *
 * Context carries all live simulation parameters so every consumer
 * (FluidSimCanvas, ToolOverlay, StatusOverlay) reads from one source.
 */

import { createMachine, assign } from 'xstate';

// ── Simulation parameter types ─────────────────────────────────────────

export interface SimParams {
  /** Substrate concentration [S] in mM (0–200) */
  substrate: number;
  /** Enzyme concentration [E] in nM (0–20) */
  enzyme: number;
  /** Temperature in °C (20–50) */
  temperature: number;
  /** pH (5.5–9.0) */
  pH: number;
  /** Max reaction velocity Vmax (μmol/min) */
  vmax: number;
  /** Michaelis constant Km (mM) */
  km: number;
}

export interface SimReadouts {
  /** Current reaction rate v (μmol/min) */
  reactionRate: number;
  /** ATP yield per cycle */
  atpYield: number;
  /** NADPH consumption rate */
  nadphRate: number;
  /** Carbon efficiency % */
  carbonEfficiency: number;
  /** Flux balance score (0–1) */
  fluxBalance: number;
  /** Stress index (0–1) */
  stressIndex: number;
  /** Simulation tick */
  tick: number;
}

export interface MetabolicContext {
  params: SimParams;
  readouts: SimReadouts;
  /** History of reaction rates for sparkline */
  rateHistory: number[];
  /** Error message if any */
  error: string | null;
  /** Timestamp when current state was entered */
  stateEnteredAt: number;
}

// ── Events ─────────────────────────────────────────────────────────────

export type MetabolicEvent =
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESET' }
  | { type: 'STRESS' }
  | { type: 'RESUME' }
  | { type: 'EQUILIBRATE' }
  | { type: 'SET_PARAM'; key: keyof SimParams; value: number }
  | { type: 'TICK'; readouts: SimReadouts };

// ── Default values ─────────────────────────────────────────────────────

const DEFAULT_PARAMS: SimParams = {
  substrate:   50,
  enzyme:       5,
  temperature: 37,
  pH:         7.4,
  vmax:        8.5,
  km:         12.0,
};

const ZERO_READOUTS: SimReadouts = {
  reactionRate:    0,
  atpYield:        0,
  nadphRate:       0,
  carbonEfficiency:0,
  fluxBalance:     0,
  stressIndex:     0,
  tick:            0,
};

// ── Machine ────────────────────────────────────────────────────────────

export const metabolicMachine = createMachine({
  id: 'metabolicEngLab',
  initial: 'idle',

  types: {} as {
    context: MetabolicContext;
    events: MetabolicEvent;
  },

  context: {
    params:       DEFAULT_PARAMS,
    readouts:     ZERO_READOUTS,
    rateHistory:  [],
    error:        null,
    stateEnteredAt: Date.now(),
  },

  states: {
    // ── Idle — awaiting user action ────────────────────────────────────
    idle: {
      on: {
        START: {
          target: 'simulating',
          actions: assign({ stateEnteredAt: () => Date.now() }),
        },
        SET_PARAM: {
          actions: assign({
            params: ({ context, event }) => ({
              ...context.params,
              [event.key]: event.value,
            }),
          }),
        },
      },
    },

    // ── Simulating — steady-state flux ─────────────────────────────────
    simulating: {
      on: {
        PAUSE: {
          target: 'idle',
          actions: assign({ stateEnteredAt: () => Date.now() }),
        },
        RESET: {
          target: 'idle',
          actions: assign({
            readouts:    () => ZERO_READOUTS,
            rateHistory: () => [],
            stateEnteredAt: () => Date.now(),
          }),
        },
        STRESS: {
          target: 'stress_test',
          actions: assign({ stateEnteredAt: () => Date.now() }),
        },
        EQUILIBRATE: {
          target: 'equilibrium',
          actions: assign({ stateEnteredAt: () => Date.now() }),
        },
        SET_PARAM: {
          actions: assign({
            params: ({ context, event }) => ({
              ...context.params,
              [event.key]: event.value,
            }),
          }),
        },
        TICK: {
          actions: assign({
            readouts: ({ event }) => event.readouts,
            rateHistory: ({ context, event }) => {
              const hist = [...context.rateHistory, event.readouts.reactionRate];
              return hist.length > 80 ? hist.slice(-80) : hist;
            },
          }),
        },
      },
    },

    // ── Stress Test — extreme parameter perturbation ───────────────────
    stress_test: {
      on: {
        RESUME: {
          target: 'simulating',
          actions: assign({ stateEnteredAt: () => Date.now() }),
        },
        RESET: {
          target: 'idle',
          actions: assign({
            readouts:    () => ZERO_READOUTS,
            rateHistory: () => [],
            stateEnteredAt: () => Date.now(),
          }),
        },
        SET_PARAM: {
          actions: assign({
            params: ({ context, event }) => ({
              ...context.params,
              [event.key]: event.value,
            }),
          }),
        },
        TICK: {
          actions: assign({
            readouts: ({ event }) => event.readouts,
            rateHistory: ({ context, event }) => {
              const hist = [...context.rateHistory, event.readouts.reactionRate];
              return hist.length > 80 ? hist.slice(-80) : hist;
            },
          }),
        },
      },
    },

    // ── Equilibrium — system has converged to steady state ─────────────
    equilibrium: {
      on: {
        RESET: {
          target: 'idle',
          actions: assign({
            readouts:    () => ZERO_READOUTS,
            rateHistory: () => [],
            stateEnteredAt: () => Date.now(),
          }),
        },
        START: {
          target: 'simulating',
          actions: assign({ stateEnteredAt: () => Date.now() }),
        },
        TICK: {
          actions: assign({
            readouts: ({ event }) => event.readouts,
            rateHistory: ({ context, event }) => {
              const hist = [...context.rateHistory, event.readouts.reactionRate];
              return hist.length > 80 ? hist.slice(-80) : hist;
            },
          }),
        },
      },
    },
  },
});

// ── Derived helpers ────────────────────────────────────────────────────

export type MachineState = 'idle' | 'simulating' | 'stress_test' | 'equilibrium';

export const STATE_LABELS: Record<MachineState, string> = {
  idle:         'IDLE',
  simulating:   'SIMULATING',
  stress_test:  'STRESS TEST',
  equilibrium:  'EQUILIBRIUM',
};

export const STATE_COLORS: Record<MachineState, string> = {
  idle:         'rgba(255,255,255,0.25)',
  simulating:   'rgba(255,255,255,0.75)',
  stress_test:  'rgba(255,255,255,0.45)',
  equilibrium:  'rgba(255,255,255,0.65)',
};

/**
 * Michaelis-Menten reaction rate — called from both main thread (preview)
 * and Web Worker (full FBA). Kept pure for testability.
 */
export function michaelisRate(params: SimParams): number {
  const tempFactor = Math.exp(-((params.temperature - 37) ** 2) / 200);
  const phFactor   = Math.exp(-((params.pH - 7.4) ** 2) / 1.2);
  const vmax       = params.vmax * tempFactor * phFactor * (params.enzyme / 5);
  return (vmax * params.substrate) / (params.km + params.substrate);
}
