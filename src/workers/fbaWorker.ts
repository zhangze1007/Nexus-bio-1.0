/**
 * Nexus-Bio — Metabolic Kinetics Web Worker
 *
 * This worker provides real-time metabolic simulation using:
 * 1. Michaelis-Menten kinetics (client-side, 60Hz)
 * 2. Flux Balance Analysis (server-side, cached)
 *
 * Architecture:
 * - Local: Michaelis-Menten for real-time responsiveness
 * - Server: Simplex LP FBA for accurate flux analysis
 * - Cache: FBA results cached for 5 seconds to reduce API calls
 *
 * Offloads all heavy metabolic math from the main thread.
 * Runs Michaelis-Menten kinetics at ~60 Hz tick.
 * Main thread INP stays ≤ 50ms.
 */

import type { SimParams, SimReadouts } from "../machines/metabolicMachine";
import { michaelisRate } from "../utils/michaelisMenten";

// ── Message types ──────────────────────────────────────────────────────

export type FBAWorkerIn =
  | { type: "START"; params: SimParams; mode: "simulating" | "stress_test" | "equilibrium" }
  | { type: "UPDATE"; params: SimParams }
  | { type: "STOP" }
  | { type: "STREAM_START"; params: SimParams; fbaParams?: FBAStreamOptions }
  | { type: "STREAM_UPDATE"; params: SimParams; fbaParams?: FBAStreamOptions }
  | { type: "STREAM_STOP" };

export type FBAWorkerOut =
  | { type: "TICK"; readouts: SimReadouts }
  | { type: "EQUILIBRIUM_REACHED" }
  | { type: "ERROR"; message: string }
  | { type: "STREAM_STATUS"; status: "connecting" | "connected" | "disconnected" | "error" }
  | { type: "STREAM_RESULT"; result: FBAStreamResult };

// ── Internal state ─────────────────────────────────────────────────────

let intervalId: ReturnType<typeof setInterval> | null = null;
let currentParams: SimParams | null = null;
let currentMode: "simulating" | "stress_test" | "equilibrium" = "simulating";
let tick = 0;
let prevRate = 0;
let equilibriumCount = 0;
let fbaUnavailableNotified = false;

// ── FBA Cache ──────────────────────────────────────────────────────────

interface FBACache {
  result: FBAReadouts | null;
  timestamp: number;
  params: string; // JSON serialized params for cache key
}

interface FBAReadouts {
  atpYield: number;
  carbonEfficiency: number;
  fluxBalance: number;
  shadowPrices?: Record<string, number>;
}

const fbaCache: FBACache = {
  result: null,
  timestamp: 0,
  params: "",
};

// Latest result from SSE stream (preferred over HTTP cache when available)
let latestStreamResult: FBAStreamResult | null = null;
let latestStreamTimestamp = 0;
const STREAM_RESULT_TTL = 10_000; // Stream results valid for 10s

const FBA_CACHE_TTL = 5000; // 5 seconds cache
const FBA_API_ENDPOINT = "/api/fba";
const FBA_STREAM_ENDPOINT = "/api/fba/stream";

// ── WebSocket/SSE Streaming Client ─────────────────────────────────────

interface FBAStreamOptions {
  species?: "ecoli" | "yeast";
  objective?: "biomass" | "atp" | "product";
  glucoseUptake?: number;
  oxygenUptake?: number;
  knockouts?: string[];
}

interface FBAStreamResult {
  ok: boolean;
  mode?: string;
  result?: {
    fluxes: Record<string, number>;
    growthRate: number;
    atpYield: number;
    carbonEfficiency: number;
    sensitivityCoefficients?: Record<string, number>;
  };
  timestamp?: number;
  solveCount?: number;
  error?: string;
}

type StreamEventHandler = (result: FBAStreamResult) => void;
type StreamStatusHandler = (status: "connecting" | "connected" | "disconnected" | "error") => void;

/**
 * SSE-based FBA stream client with automatic reconnection.
 *
 * Uses EventSource (SSE) which is natively supported in Web Workers.
 * Falls back to fetch-based streaming if EventSource is unavailable.
 *
 * Architecture:
 * - Connects to /api/fba/stream via GET (EventSource) or POST (fetch ReadableStream)
 * - Auto-reconnects on disconnect with exponential backoff (1s, 2s, 4s, max 30s)
 * - Sends parameter updates by reconnecting with new query params
 * - Heartbeat detection: if no event in 30s, force reconnect
 */
class FBAStreamClient {
  private eventSource: EventSource | null = null;
  private abortController: AbortController | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private isConnecting = false;
  private isClosed = false;
  private currentParams: FBAStreamOptions = {};
  private useFetchFallback = false;

  private onResult: StreamEventHandler | null = null;
  private onStatus: StreamStatusHandler | null = null;

  private static readonly MAX_RECONNECT_DELAY = 30_000;
  private static readonly BASE_RECONNECT_DELAY = 1_000;
  private static readonly HEARTBEAT_TIMEOUT = 30_000;

  constructor(handlers?: {
    onResult?: StreamEventHandler;
    onStatus?: StreamStatusHandler;
  }) {
    this.onResult = handlers?.onResult ?? null;
    this.onStatus = handlers?.onStatus ?? null;
  }

  /**
   * Start streaming with the given parameters.
   */
  connect(params: FBAStreamOptions): void {
    this.currentParams = params;
    this.isClosed = false;
    this.reconnectAttempt = 0;
    this.doConnect();
  }

  /**
   * Update parameters. Reconnects with new params.
   */
  updateParams(params: FBAStreamOptions): void {
    this.currentParams = { ...this.currentParams, ...params };
    if (this.eventSource || this.abortController) {
      this.disconnect();
      this.reconnectAttempt = 0;
      this.doConnect();
    }
  }

  /**
   * Close the stream and prevent reconnection.
   */
  close(): void {
    this.isClosed = true;
    this.disconnect();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.emitStatus("disconnected");
  }

  private doConnect(): void {
    if (this.isClosed || this.isConnecting) return;
    this.isConnecting = true;
    this.emitStatus("connecting");

    const qs = this.buildQueryString();

    // Try EventSource first (works in workers, native SSE support)
    if (!this.useFetchFallback && typeof EventSource !== "undefined") {
      try {
        this.connectEventSource(qs);
        return;
      } catch {
        this.useFetchFallback = true;
      }
    }

    // Fallback to fetch-based streaming
    this.connectFetchStream(qs);
  }

  private connectEventSource(qs: string): void {
    const url = `${FBA_STREAM_ENDPOINT}${qs}`;
    const es = new EventSource(url);
    this.eventSource = es;

    es.onopen = () => {
      this.isConnecting = false;
      this.reconnectAttempt = 0;
      this.emitStatus("connected");
      this.resetHeartbeatTimer();
    };

    es.addEventListener("fba-result", (event: MessageEvent) => {
      this.resetHeartbeatTimer();
      try {
        const data: FBAStreamResult = JSON.parse(event.data);
        this.onResult?.(data);
      } catch {
        /* ignore parse errors */
      }
    });

    es.addEventListener("heartbeat", () => {
      this.resetHeartbeatTimer();
    });

    es.addEventListener("stream-end", () => {
      // Server ended the stream (max duration reached)
      this.disconnect();
      this.scheduleReconnect();
    });

    es.addEventListener("fba-error", (event: MessageEvent) => {
      try {
        const data: FBAStreamResult = JSON.parse(event.data);
        this.onResult?.(data);
      } catch {
        /* ignore */
      }
    });

    es.onerror = () => {
      this.isConnecting = false;
      es.close();
      this.eventSource = null;
      this.emitStatus("error");
      this.scheduleReconnect();
    };
  }

  private async connectFetchStream(qs: string): Promise<void> {
    const ac = new AbortController();
    this.abortController = ac;

    try {
      const response = await fetch(`${FBA_STREAM_ENDPOINT}${qs}`, {
        method: "GET",
        signal: ac.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      this.isConnecting = false;
      this.reconnectAttempt = 0;
      this.emitStatus("connected");
      this.resetHeartbeatTimer();

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (!this.isClosed) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            this.resetHeartbeatTimer();
            const jsonStr = line.slice(6);
            try {
              const data: FBAStreamResult = JSON.parse(jsonStr);
              if (currentEvent === "fba-result") {
                this.onResult?.(data);
              } else if (currentEvent === "stream-end") {
                // Server ended stream
                this.disconnect();
                this.scheduleReconnect();
                return;
              } else if (currentEvent === "fba-error") {
                this.onResult?.(data);
              }
            } catch (parseErr) {
              console.warn("[FBAWorker] SSE event parse error:", parseErr);
            }
            currentEvent = "";
          }
        }
      }

      // Stream ended normally
      this.disconnect();
      this.scheduleReconnect();
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      this.isConnecting = false;
      this.disconnect();
      this.emitStatus("error");
      this.scheduleReconnect();
    }
  }

  private buildQueryString(): string {
    const params = new URLSearchParams();
    if (this.currentParams.species) params.set("species", this.currentParams.species);
    if (this.currentParams.objective) params.set("objective", this.currentParams.objective);
    if (this.currentParams.glucoseUptake !== undefined)
      params.set("glucoseUptake", String(this.currentParams.glucoseUptake));
    if (this.currentParams.oxygenUptake !== undefined)
      params.set("oxygenUptake", String(this.currentParams.oxygenUptake));
    if (this.currentParams.knockouts?.length) params.set("knockouts", this.currentParams.knockouts.join(","));
    const str = params.toString();
    return str ? `?${str}` : "";
  }

  private scheduleReconnect(): void {
    if (this.isClosed) return;
    const delay = Math.min(
      FBAStreamClient.BASE_RECONNECT_DELAY * 2 ** this.reconnectAttempt,
      FBAStreamClient.MAX_RECONNECT_DELAY,
    );
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.doConnect();
    }, delay);
  }

  private resetHeartbeatTimer(): void {
    if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer);
    this.heartbeatTimer = setTimeout(() => {
      // No heartbeat received — force reconnect
      this.disconnect();
      this.scheduleReconnect();
    }, FBAStreamClient.HEARTBEAT_TIMEOUT);
  }

  private emitStatus(status: "connecting" | "connected" | "disconnected" | "error"): void {
    this.onStatus?.(status);
  }
}

// Module-level stream client instance
let streamClient: FBAStreamClient | null = null;
let streamMode = false; // When true, use streaming instead of polling

/**
 * Fetch real FBA results from server with caching.
 * Returns cached result if available and fresh.
 */
async function fetchFBAResults(params: SimParams): Promise<FBAReadouts | null> {
  const now = Date.now();

  // Prefer stream results if available and fresh
  if (
    streamMode &&
    latestStreamResult?.ok &&
    latestStreamResult.result &&
    now - latestStreamTimestamp < STREAM_RESULT_TTL
  ) {
    const r = latestStreamResult.result;
    return {
      atpYield: r.atpYield ?? 0,
      carbonEfficiency: r.carbonEfficiency ?? 0,
      fluxBalance: r.growthRate ?? 0,
      shadowPrices: r.sensitivityCoefficients,
    };
  }

  const paramsKey = JSON.stringify({
    substrate: params.substrate,
    temperature: params.temperature,
    pH: params.pH,
  });

  // Return cached result if fresh
  if (fbaCache.result && fbaCache.params === paramsKey && now - fbaCache.timestamp < FBA_CACHE_TTL) {
    return fbaCache.result;
  }

  try {
    const response = await fetch(FBA_API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "single",
        species: "ecoli",
        objective: "biomass",
        glucoseUptake: params.substrate,
        oxygenUptake: 20, // Default oxygen uptake
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (!data.ok || !data.fluxes) {
      return null;
    }

    const result: FBAReadouts = {
      atpYield: data.atpYield ?? 0,
      carbonEfficiency: data.carbonEfficiency ?? 0,
      fluxBalance: data.fluxBalance ?? 0,
      shadowPrices: data.shadowPrices,
    };

    // Update cache
    fbaCache.result = result;
    fbaCache.timestamp = now;
    fbaCache.params = paramsKey;

    return result;
  } catch (error) {
    // Network error - return cached result if available
    return fbaCache.result;
  }
}

// ── Kinetic readouts with real FBA integration ────────────────────────
// This function tries to use real FBA results from the server,
// falling back to heuristic calculations if the server is unavailable.

async function computeKineticReadouts(p: SimParams, rate: number): Promise<Omit<SimReadouts, "tick" | "reactionRate">> {
  // Try to get real FBA results from server
  const fbaResults = await fetchFBAResults(p);

  if (fbaResults) {
    // Use real FBA results
    return {
      atpYield: fbaResults.atpYield,
      nadphRate: 0.6 * rate * (p.enzyme / 10), // Still heuristic for NADPH
      carbonEfficiency: fbaResults.carbonEfficiency,
      fluxBalance: fbaResults.fluxBalance,
      stressIndex: computeStressIndex(p),
    };
  }

  // FBA server unavailable — return NaN for FBA-dependent fields to
  // signal "no data" rather than fabricated values.  The UI should
  // display these as "—" or "N/A".  nadphRate and stressIndex are
  // still computed from real Michaelis-Menten kinetics and
  // environmental parameters respectively.
  const nadphRate = 0.6 * rate * (p.enzyme / 10);

  if (!fbaUnavailableNotified) {
    fbaUnavailableNotified = true;
    self.postMessage({
      type: "ERROR",
      message:
        "FBA server unavailable — ATP yield, carbon efficiency, and flux balance are not available. Showing kinetic simulation only.",
    } satisfies FBAWorkerOut);
  }

  return {
    atpYield: NaN,
    nadphRate,
    carbonEfficiency: NaN,
    fluxBalance: NaN,
    stressIndex: computeStressIndex(p),
  };
}

// ── Stress index calculation ─────────────────────────────────────────

function computeStressIndex(p: SimParams): number {
  const heatStress = Math.max(0, (p.temperature - 42) / 8);
  const phStress = Math.max(0, Math.abs(p.pH - 7.4) - 0.5) / 2;
  const subStress = Math.max(0, (p.substrate - 120) / 80);
  return Math.min(1, heatStress + phStress + subStress);
}

// ── Parameter oscillation: sinusoidal perturbation to model params ───
// NOT a biological stress model — applies sinusoidal perturbation to
// substrate, temperature, and pH to test simulation robustness.

function applyParameterOscillation(p: SimParams): SimParams {
  const t = tick * 0.05;
  return {
    ...p,
    substrate: p.substrate * (1 + 0.15 * Math.sin(t)),
    temperature: p.temperature * (1 + 0.04 * Math.cos(t * 0.7)),
    pH: p.pH * (1 + 0.02 * Math.sin(t * 1.3)),
  };
}

// ── Simulation tick (async to support FBA API calls) ─────────────────

async function runTick() {
  if (!currentParams) return;
  tick++;

  const effectiveParams = currentMode === "stress_test" ? applyParameterOscillation(currentParams) : currentParams;

  const rate = michaelisRate(effectiveParams);
  const fba = await computeKineticReadouts(effectiveParams, rate);

  const readouts: SimReadouts = { reactionRate: rate, ...fba, tick };

  self.postMessage({ type: "TICK", readouts } satisfies FBAWorkerOut);

  // Equilibrium detection: rate stable within 0.5% for 60 consecutive ticks
  if (currentMode === "simulating") {
    const delta = Math.abs(rate - prevRate) / (prevRate + 0.0001);
    equilibriumCount = delta < 0.005 ? equilibriumCount + 1 : 0;
    if (equilibriumCount >= 60) {
      equilibriumCount = 0;
      self.postMessage({ type: "EQUILIBRIUM_REACHED" } satisfies FBAWorkerOut);
    }
  }
  prevRate = rate;
}

// ── Message handler ────────────────────────────────────────────────────

self.onmessage = (e: MessageEvent<FBAWorkerIn>) => {
  const msg = e.data;

  if (msg.type === "START") {
    currentParams = msg.params;
    currentMode = msg.mode;
    tick = 0;
    prevRate = 0;
    equilibriumCount = 0;
    fbaUnavailableNotified = false;
    if (intervalId) clearInterval(intervalId);
    // 60 Hz tick on worker thread
    intervalId = setInterval(runTick, 1000 / 60);
    return;
  }

  if (msg.type === "UPDATE") {
    currentParams = msg.params;
    return;
  }

  if (msg.type === "STOP") {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    return;
  }

  // ── Streaming mode ──────────────────────────────────────────────────

  if (msg.type === "STREAM_START") {
    currentParams = msg.params;
    currentMode = "simulating";
    tick = 0;
    prevRate = 0;
    equilibriumCount = 0;
    fbaUnavailableNotified = false;

    // Start or update stream client
    if (!streamClient) {
      streamClient = new FBAStreamClient({
        onResult: (result) => {
          latestStreamResult = result;
          latestStreamTimestamp = Date.now();
          self.postMessage({ type: "STREAM_RESULT", result } satisfies FBAWorkerOut);
        },
        onStatus: (status) => {
          self.postMessage({ type: "STREAM_STATUS", status } satisfies FBAWorkerOut);
        },
      });
    }

    streamMode = true;
    const fbaParams = msg.fbaParams ?? {
      species: "ecoli",
      objective: "biomass",
      glucoseUptake: msg.params.substrate,
      oxygenUptake: 20,
    };
    streamClient.connect(fbaParams);

    // Also run local kinetics at 60 Hz (stream results are additive)
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(runTick, 1000 / 60);
    return;
  }

  if (msg.type === "STREAM_UPDATE") {
    currentParams = msg.params;
    if (streamClient && msg.fbaParams) {
      streamClient.updateParams(msg.fbaParams);
    }
    return;
  }

  if (msg.type === "STREAM_STOP") {
    streamMode = false;
    if (streamClient) {
      streamClient.close();
      streamClient = null;
    }
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    return;
  }
};
