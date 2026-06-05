/**
 * Axon domain slice — AI research agent state.
 *
 * Zero cross-domain dependencies. Only reads/writes axonRuns, axonLogs, axonPlan.
 * Extracted from workbenchStore.ts for single-responsibility.
 */
import type { StateCreator } from 'zustand';
import type { AxonRunRecord, WorkbenchAxonLogEntry, WorkbenchAxonPlanRecord } from '../workbenchTypes';

// ── Constants ──
export const AXON_RUN_LIMIT = 80;
export const AXON_LOG_LIMIT = 400;

// ── Slice type ──
export interface AxonSlice {
  axonRuns: AxonRunRecord[];
  axonLogs: WorkbenchAxonLogEntry[];
  axonPlan: WorkbenchAxonPlanRecord | null;
  appendAxonRun: (record: AxonRunRecord) => void;
  clearAxonRuns: () => void;
  appendAxonLog: (entry: WorkbenchAxonLogEntry) => void;
  clearAxonLogs: () => void;
  setAxonPlan: (plan: WorkbenchAxonPlanRecord | null) => void;
  updateAxonPlanStep: (planId: string, stepId: string, patch: Partial<WorkbenchAxonPlanRecord['steps'][number]>) => void;
}

// ── Initial state ──
export const axonInitialState = {
  axonRuns: [],
  axonLogs: [],
  axonPlan: null,
};

// ── Slice creator ──
export const createAxonSlice: StateCreator<AxonSlice, [], [], AxonSlice> = (set) => ({
  ...axonInitialState,

  appendAxonRun: (record) => {
    set((state) => ({
      axonRuns: [record, ...state.axonRuns].slice(0, AXON_RUN_LIMIT),
    }));
  },

  clearAxonRuns: () => {
    set({ axonRuns: [] });
  },

  appendAxonLog: (entry) => {
    set((state) => ({
      axonLogs: [entry, ...state.axonLogs].slice(0, AXON_LOG_LIMIT),
    }));
  },

  clearAxonLogs: () => {
    set({ axonLogs: [] });
  },

  setAxonPlan: (plan) => {
    set({ axonPlan: plan });
  },

  updateAxonPlanStep: (planId, stepId, patch) => {
    set((state) => {
      const plan = state.axonPlan;
      if (!plan || plan.id !== planId) return state;
      return {
        axonPlan: {
          ...plan,
          steps: plan.steps.map((s) =>
            s.id === stepId ? { ...s, ...patch } : s,
          ),
        },
      };
    });
  },
});
