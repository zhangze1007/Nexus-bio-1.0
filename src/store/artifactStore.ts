/**
 * Artifact Store — Zustand store for inter-tool data flow.
 *
 * Tools write their output artifacts here after successful execution.
 * Downstream tools read artifacts to auto-populate inputs.
 *
 * @architecture
 *   - Each artifact type has a dedicated setter (setPathway, setFBA, etc.)
 *   - getArtifact(type) returns the latest artifact of that type
 *   - clear() resets all artifacts (for new project)
 *   - Artifacts persist in memory only (not localStorage)
 */

import { create } from "zustand";
import type {
  ArtifactType,
  CatalystArtifact,
  ControlArtifact,
  EvolutionArtifact,
  FBAArtifact,
  PathwayArtifact,
  ThermodynamicArtifact,
  ToolArtifact,
} from "../domain/toolDataContract";

// ── State ───────────────────────────────────────────────────────────────

interface ArtifactState {
  pathway: PathwayArtifact | null;
  fba: FBAArtifact | null;
  thermodynamic: ThermodynamicArtifact | null;
  catalyst: CatalystArtifact | null;
  control: ControlArtifact | null;
  evolution: EvolutionArtifact | null;

  // Actions
  setPathway: (artifact: PathwayArtifact) => void;
  setFBA: (artifact: FBAArtifact) => void;
  setThermodynamic: (artifact: ThermodynamicArtifact) => void;
  setCatalyst: (artifact: CatalystArtifact) => void;
  setControl: (artifact: ControlArtifact) => void;
  setEvolution: (artifact: EvolutionArtifact) => void;
  getArtifact: (type: ArtifactType) => ToolArtifact | null;
  getAllArtifacts: () => Partial<Record<ArtifactType, ToolArtifact>>;
  clear: () => void;
}

// ── Store ───────────────────────────────────────────────────────────────

export const useArtifactStore = create<ArtifactState>((set, get) => ({
  pathway: null,
  fba: null,
  thermodynamic: null,
  catalyst: null,
  control: null,
  evolution: null,

  setPathway: (artifact) => set({ pathway: artifact }),
  setFBA: (artifact) => set({ fba: artifact }),
  setThermodynamic: (artifact) => set({ thermodynamic: artifact }),
  setCatalyst: (artifact) => set({ catalyst: artifact }),
  setControl: (artifact) => set({ control: artifact }),
  setEvolution: (artifact) => set({ evolution: artifact }),

  getArtifact: (type) => {
    const state = get();
    return state[type] ?? null;
  },

  getAllArtifacts: () => {
    const state = get();
    const artifacts: Partial<Record<ArtifactType, ToolArtifact>> = {};
    if (state.pathway) artifacts.pathway = state.pathway;
    if (state.fba) artifacts.fba = state.fba;
    if (state.thermodynamic) artifacts.thermodynamic = state.thermodynamic;
    if (state.catalyst) artifacts.catalyst = state.catalyst;
    if (state.control) artifacts.control = state.control;
    if (state.evolution) artifacts.evolution = state.evolution;
    return artifacts;
  },

  clear: () =>
    set({
      pathway: null,
      fba: null,
      thermodynamic: null,
      catalyst: null,
      control: null,
      evolution: null,
    }),
}));
