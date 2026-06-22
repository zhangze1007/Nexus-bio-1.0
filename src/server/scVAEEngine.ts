/**
 * scVAE Engine — Single-Cell Variational Autoencoder
 *
 * Provides browser-based VAE inference for single-cell RNA-seq data.
 * Uses ONNX Runtime Web to run a pre-trained scVI-style model.
 *
 * Architecture:
 *   Encoder: Input(2000) -> Linear(512) -> ReLU -> Linear(256) -> ReLU -> mu(32), sigma(32)
 *   Sampling: z = mu + sigma * eps, eps ~ N(0,1)
 *   Decoder: z(32) -> Linear(256) -> ReLU -> Linear(512) -> ReLU -> Linear(2000) -> Sigmoid
 *
 * The model is pre-trained in Python (scripts/train_scVAE.py) and exported to ONNX.
 * Browser inference uses ONNX Runtime Web (WASM backend).
 *
 * @scientific_provenance
 *   ALGORITHM: Single-cell Variational Autoencoder (scVI). A deep generative
 *     model for single-cell transcriptomics that learns a low-dimensional
 *     latent representation via a variational autoencoder. The encoder maps
 *     normalized gene expression to a Gaussian posterior N(mu, sigma^2) in
 *     latent space; the reparameterization trick (z = mu + sigma * eps)
 *     enables backpropagation through sampling. The decoder reconstructs
 *     gene expression from latent codes via a sigmoid output layer.
 *   REFERENCE: Lopez R, Regier J, Cole MB, Jordan MI, Yosef N. "Deep
 *     generative modeling for single-cell transcriptomics." Nat Methods.
 *     2018;15(12):1053-1058.
 *   KNOWN_LIMITATIONS:
 *     - Requires pre-trained ONNX model files; the browser engine does not
 *       perform training or fine-tuning.
 *     - Fixed architecture (2000 input genes, 32 latent dims); does not
 *       adapt to datasets with different gene panels without retraining.
 *     - Uses a simple Gaussian prior and sigmoid decoder; the real scVI
 *       uses negative binomial or zero-inflated distributions for
 *       count data, which better captures dropout and overdispersion.
 *     - WASM inference is significantly slower than native/GPU execution;
 *       practical for hundreds of cells but not tens of thousands.
 */

import { SeededRNG } from '../utils/seededRng';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SCVAEConfig {
  inputDim: number;       // number of genes (default 2000)
  latentDim: number;      // latent space dimension (default 32)
  encoderPath: string;    // path to encoder ONNX model
  decoderPath: string;    // path to decoder ONNX model
  seed?: number;
}

export interface SCVAEResult {
  latent: number[][];         // [cells × latent_dim]
  reconstructed: number[][];  // [cells × genes]
  reconstructionError: number; // MSE
  mu: number[][];             // [cells × latent_dim] mean
  sigma: number[][];          // [cells × latent_dim] std
}

export interface SCVAEStatus {
  ready: boolean;
  inputDim: number;
  latentDim: number;
  modelLoaded: boolean;
}

// ── scVAE Engine ───────────────────────────────────────────────────────────

export class SCVAEEngine {
  private config: SCVAEConfig;
  private rng: SeededRNG;
  private encoderSession: unknown = null; // ort.InferenceSession
  private decoderSession: unknown = null;
  private _ready = false;

  constructor(config: SCVAEConfig) {
    this.config = {
      ...config,
      inputDim: config.inputDim ?? 2000,
      latentDim: config.latentDim ?? 32,
      seed: config.seed ?? 42,
    };
    this.rng = new SeededRNG(this.config.seed);
  }

  /**
   * Initialize ONNX sessions. Call before using encode/decode.
   * Gracefully handles missing models (returns false if models not found).
   */
  async init(): Promise<boolean> {
    try {
      // Dynamic import to avoid bundling ONNX Runtime in SSR
      const ort = await import('onnxruntime-web');
      ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4;

      this.encoderSession = await ort.InferenceSession.create(this.config.encoderPath, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });

      this.decoderSession = await ort.InferenceSession.create(this.config.decoderPath, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });

      this._ready = true;
      return true;
    } catch (err) {
      console.warn('[scVAE] Failed to load ONNX models:', err);
      this._ready = false;
      return false;
    }
  }

  isReady(): boolean {
    return this._ready;
  }

  getStatus(): SCVAEStatus {
    return {
      ready: this._ready,
      inputDim: this.config.inputDim,
      latentDim: this.config.latentDim,
      modelLoaded: this.encoderSession !== null && this.decoderSession !== null,
    };
  }

  /**
   * Encode input data to latent space.
   * Returns μ (mean) and σ (std) of the approximate posterior.
   */
  async encode(data: number[][]): Promise<{ mu: number[][]; sigma: number[][]; latent: number[][] }> {
    if (!this._ready || !this.encoderSession) {
      throw new Error('scVAE not initialized — call init() first');
    }

    const ort = await import('onnxruntime-web');
    const n = data.length;
    const inputDim = this.config.inputDim;
    const latentDim = this.config.latentDim;

    // Flatten input matrix
    const flatData = new Float32Array(n * inputDim);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < inputDim; j++) {
        flatData[i * inputDim + j] = data[i]?.[j] ?? 0;
      }
    }

    const inputTensor = new ort.Tensor('float32', flatData, [n, inputDim]);
    const results = await (this.encoderSession as { run: (inputs: Record<string, unknown>) => Promise<Record<string, { data: Float32Array }>> }).run({ input: inputTensor });

    // Extract mu and logvar from encoder output
    const muData = results.mu?.data ?? new Float32Array(n * latentDim);
    const logvarData = results.logvar?.data ?? new Float32Array(n * latentDim);

    const mu: number[][] = [];
    const sigma: number[][] = [];
    const latent: number[][] = [];

    for (let i = 0; i < n; i++) {
      const muRow: number[] = [];
      const sigmaRow: number[] = [];
      const zRow: number[] = [];
      for (let j = 0; j < latentDim; j++) {
        const m = muData[i * latentDim + j];
        const lv = logvarData[i * latentDim + j];
        const s = Math.exp(lv / 2);
        muRow.push(m);
        sigmaRow.push(s);
        // Reparameterization trick: z = μ + σ × ε
        zRow.push(m + s * this.gaussianRandom());
      }
      mu.push(muRow);
      sigma.push(sigmaRow);
      latent.push(zRow);
    }

    return { mu, sigma, latent };
  }

  /**
   * Decode latent vectors back to gene expression space.
   */
  async decode(latent: number[][]): Promise<number[][]> {
    if (!this._ready || !this.decoderSession) {
      throw new Error('scVAE not initialized — call init() first');
    }

    const ort = await import('onnxruntime-web');
    const n = latent.length;
    const latentDim = this.config.latentDim;
    const inputDim = this.config.inputDim;

    const flatData = new Float32Array(n * latentDim);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < latentDim; j++) {
        flatData[i * latentDim + j] = latent[i]?.[j] ?? 0;
      }
    }

    const inputTensor = new ort.Tensor('float32', flatData, [n, latentDim]);
    const results = await (this.decoderSession as { run: (inputs: Record<string, unknown>) => Promise<Record<string, { data: Float32Array }>> }).run({ input: inputTensor });

    const outputData = results.output?.data ?? new Float32Array(n * inputDim);
    const output: number[][] = [];

    for (let i = 0; i < n; i++) {
      const row: number[] = [];
      for (let j = 0; j < inputDim; j++) {
        row.push(outputData[i * inputDim + j]);
      }
      output.push(row);
    }

    return output;
  }

  /**
   * Full forward pass: encode → sample → decode.
   */
  async forward(data: number[][]): Promise<SCVAEResult> {
    const { mu, sigma, latent } = await this.encode(data);
    const reconstructed = await this.decode(latent);

    // Compute reconstruction error (MSE)
    let totalError = 0;
    let count = 0;
    for (let i = 0; i < data.length; i++) {
      for (let j = 0; j < data[i].length; j++) {
        const diff = (data[i][j] ?? 0) - (reconstructed[i]?.[j] ?? 0);
        totalError += diff * diff;
        count++;
      }
    }
    const reconstructionError = count > 0 ? totalError / count : 0;

    return {
      latent,
      reconstructed,
      reconstructionError: Math.round(reconstructionError * 1e6) / 1e6,
      mu,
      sigma,
    };
  }

  /**
   * Generate samples from the latent space.
   */
  async generate(nSamples: number, latentDim?: number): Promise<number[][]> {
    const dim = latentDim ?? this.config.latentDim;
    const latent: number[][] = [];

    for (let i = 0; i < nSamples; i++) {
      const z: number[] = [];
      for (let j = 0; j < dim; j++) {
        z.push(this.gaussianRandom());
      }
      latent.push(z);
    }

    return this.decode(latent);
  }

  private gaussianRandom(): number {
    const u1 = Math.max(1e-10, this.rng.next());
    const u2 = this.rng.next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}

// ── Convenience: create engine with default config ──────────────────────────

export function createDefaultSCVAEEngine(): SCVAEEngine {
  return new SCVAEEngine({
    inputDim: 2000,
    latentDim: 32,
    encoderPath: '/models/scVAE_encoder.onnx',
    decoderPath: '/models/scVAE_decoder.onnx',
    seed: 42,
  });
}
