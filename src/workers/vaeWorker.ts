/**
 * Nexus-Bio — VAE (Variational Autoencoder) Web Worker
 *
 * Offloads trainMultimodalVAE computation from the main thread.
 * Pure math — no browser APIs used. Module worker (importable).
 */

import type { VAETrainingResult } from "../services/MOIEngine";
import { trainMultimodalVAE } from "../services/MOIEngine";
import type { OmicsRow } from "../types";

// ── Message types ──────────────────────────────────────────────────────

export type VAEWorkerIn = {
  type: "TRAIN";
  data: OmicsRow[];
  latentDim: number;
  beta: number;
  epochs: number;
  lr: number;
  batchLabels?: number[];
};

export type VAEWorkerOut = { type: "RESULT"; result: VAETrainingResult } | { type: "ERROR"; message: string };

// ── Message handler ────────────────────────────────────────────────────

self.onmessage = (e: MessageEvent<VAEWorkerIn>) => {
  const msg = e.data;

  if (msg.type === "TRAIN") {
    try {
      const result = trainMultimodalVAE(msg.data, msg.latentDim, msg.beta, msg.epochs, msg.lr, msg.batchLabels);
      self.postMessage({ type: "RESULT", result } satisfies VAEWorkerOut);
    } catch (err) {
      const message = err instanceof Error ? err.message : "VAE training failed";
      self.postMessage({ type: "ERROR", message } satisfies VAEWorkerOut);
    }
  }
};
