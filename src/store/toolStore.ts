/**
 * Nexus-Bio — Cross-Module Tool Store (Zustand)
 *
 * Global state bridge so DYNCON parameters flow into MULTIO,
 * FBA results feed CatalystDesigner, etc.
 * Inspired by Bret Victor's "Inventing on Principle" — every change
 * is immediately visible across every dependent view.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// ── DYNCON Parameters ──────────────────────────────────────────────────

export interface DynConSnapshot {
  /** Current ODE time-series (last sim run) */
  biomass: number;
  substrate: number;
  product: number;
  dissolvedO2: number;
  /** User-tuned control params */
  kp: number;
  ki: number;
  kd: number;
  setpoint: number;
  /** Convergence status */
  converged: boolean;
  timestamp: number;
}

// ── FBA Snapshot ────────────────────────────────────────────────────────

export interface FBASnapshot {
  growthRate: number;
  fluxes: Record<string, number>;
  objective: number;
  timestamp: number;
}

// ── Thermodynamics (CETHX) ─────────────────────────────────────────────

export interface CETHXSnapshot {
  pathway: string;
  tempC: number;
  pH: number;
  gibbsTotal: number;
  atpYield: number;
  efficiency: number;
  timestamp: number;
}

// ── Store Shape ────────────────────────────────────────────────────────

interface ToolState {
  // Cross-module data snapshots
  dyncon: DynConSnapshot | null;
  fba: FBASnapshot | null;
  cethx: CETHXSnapshot | null;

  // Active module tracking
  activeModule: string | null;

  // Actions
  setDynCon: (snap: DynConSnapshot) => void;
  setFBA: (snap: FBASnapshot) => void;
  setCETHX: (snap: CETHXSnapshot) => void;
  setActiveModule: (id: string | null) => void;
}

export const useToolStore = create<ToolState>()(
  subscribeWithSelector((set) => ({
    dyncon: null,
    fba: null,
    cethx: null,
    activeModule: null,

    setDynCon: (snap) => set({ dyncon: snap }),
    setFBA: (snap) => set({ fba: snap }),
    setCETHX: (snap) => set({ cethx: snap }),
    setActiveModule: (id) => set({ activeModule: id }),
  })),
);
