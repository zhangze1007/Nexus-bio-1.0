/**
 * Nexus-Bio 2.0 — Analysis Lifecycle FSM (XState v5)
 *
 * Deterministic Finite State Machine for the AI analysis pipeline.
 * Eliminates "boolean soup" — every state is explicit and exhaustive.
 *
 * States:
 *   idle → analyzing → success
 *                    ↘ error
 *   (success | error) → idle  (via RESET)
 *   (success | error) → analyzing  (via SUBMIT, allows re-run)
 *
 * Provider chain: Groq (primary) → Gemini (fallback)
 */

import { createMachine, assign } from 'xstate';
import type { PathwayNode, PathwayEdge } from '../types';

// ── Context shape ──────────────────────────────────────────────────────

export interface AnalysisContext {
  /** Raw text / URL / query submitted */
  input: string;
  /** Input mode (determines how the server builds the prompt) */
  inputMode: 'text' | 'pdf' | 'image' | 'web' | 'search';
  /** Successfully extracted pathway nodes */
  nodes: PathwayNode[];
  /** Successfully extracted pathway edges */
  edges: PathwayEdge[];
  /** Error message if analysis failed */
  error: string | null;
  /** Which AI provider ultimately served the response */
  provider: 'groq' | 'gemini' | null;
  /** Wall-clock ms of how long the last analysis took */
  latencyMs: number | null;
  /** Timestamp when analysis was kicked off */
  startedAt: number | null;
  /** Number of retry attempts on the current submission */
  retryCount: number;
}

// ── Events ─────────────────────────────────────────────────────────────

export type AnalysisEvent =
  | { type: 'SUBMIT'; input: string; inputMode?: AnalysisContext['inputMode'] }
  | {
      type: 'SUCCESS';
      nodes: PathwayNode[];
      edges: PathwayEdge[];
      provider: 'groq' | 'gemini';
      latencyMs: number;
    }
  | { type: 'ERROR'; message: string }
  | { type: 'RETRY' }
  | { type: 'RESET' };

// ── Machine ────────────────────────────────────────────────────────────

export const analysisMachine = createMachine({
  id: 'nexusBioAnalysis',
  initial: 'idle',

  types: {} as {
    context: AnalysisContext;
    events: AnalysisEvent;
  },

  context: {
    input: '',
    inputMode: 'text',
    nodes: [],
    edges: [],
    error: null,
    provider: null,
    latencyMs: null,
    startedAt: null,
    retryCount: 0,
  },

  states: {
    // ── Waiting for user action ──────────────────────────────────────
    idle: {
      on: {
        SUBMIT: {
          target: 'analyzing',
          actions: assign({
            input: ({ event }) => event.input,
            inputMode: ({ event }) => event.inputMode ?? 'text',
            error: () => null,
            startedAt: () => Date.now(),
            retryCount: () => 0,
          }),
        },
      },
    },

    // ── In-flight AI request ─────────────────────────────────────────
    analyzing: {
      on: {
        SUCCESS: {
          target: 'success',
          actions: assign({
            nodes: ({ event }) => event.nodes,
            edges: ({ event }) => event.edges,
            provider: ({ event }) => event.provider,
            latencyMs: ({ event }) => event.latencyMs,
            error: () => null,
          }),
        },
        ERROR: {
          target: 'error',
          actions: assign({
            error: ({ event }) => event.message,
          }),
        },
        // Allow cancellation back to idle mid-flight
        RESET: {
          target: 'idle',
          actions: assign({
            input: () => '',
            nodes: () => [],
            edges: () => [],
            error: () => null,
            provider: () => null,
            latencyMs: () => null,
            startedAt: () => null,
            retryCount: () => 0,
          }),
        },
      },
    },

    // ── Analysis succeeded ───────────────────────────────────────────
    success: {
      on: {
        // Re-submit without resetting (iterative refinement)
        SUBMIT: {
          target: 'analyzing',
          actions: assign({
            input: ({ event }) => event.input,
            inputMode: ({ event }) => event.inputMode ?? 'text',
            error: () => null,
            startedAt: () => Date.now(),
            retryCount: () => 0,
          }),
        },
        RESET: {
          target: 'idle',
          actions: assign({
            input: () => '',
            nodes: () => [],
            edges: () => [],
            error: () => null,
            provider: () => null,
            latencyMs: () => null,
            startedAt: () => null,
            retryCount: () => 0,
          }),
        },
      },
    },

    // ── Analysis failed ──────────────────────────────────────────────
    error: {
      on: {
        // Retry with same input
        RETRY: {
          target: 'analyzing',
          actions: assign({
            error: () => null,
            startedAt: () => Date.now(),
            retryCount: ({ context }) => context.retryCount + 1,
          }),
        },
        // New submission after failure
        SUBMIT: {
          target: 'analyzing',
          actions: assign({
            input: ({ event }) => event.input,
            inputMode: ({ event }) => event.inputMode ?? 'text',
            error: () => null,
            startedAt: () => Date.now(),
            retryCount: () => 0,
          }),
        },
        RESET: {
          target: 'idle',
          actions: assign({
            error: () => null,
            retryCount: () => 0,
          }),
        },
      },
    },
  },
});

// ── State guards (for consumers) ───────────────────────────────────────

export const isAnalyzing = (state: { value: string }) =>
  state.value === 'analyzing';

export const isSuccess = (state: { value: string }) =>
  state.value === 'success';

export const isError = (state: { value: string }) =>
  state.value === 'error';

export const isIdle = (state: { value: string }) =>
  state.value === 'idle';
