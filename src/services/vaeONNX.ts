/**
 * ONNX Runtime Web VAE Inference Module
 *
 * Provides a client-side Variational Autoencoder (VAE) using ONNX Runtime Web.
 * Supports encoding, sampling (reparameterization trick), decoding, and full forward pass.
 */
import * as ort from 'onnxruntime-web';

export interface EncodeResult {
  mu: Float32Array;
  logvar: Float32Array;
}

export interface ForwardResult {
  mu: Float32Array;
  logvar: Float32Array;
  z: Float32Array;
  reconstruction: Float32Array;
}

export class VAEInference {
  private session: ort.InferenceSession | null = null;
  private latentDim: number;

  constructor(latentDim: number = 4) {
    this.latentDim = latentDim;
  }

  /**
   * Initialize the ONNX session. Call before using encode/decode/forward.
   */
  async init(): Promise<void> {
    // Configure WASM backend
    ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4;

    this.session = await ort.InferenceSession.create('/models/vae.onnx', {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
  }

  /**
   * Check if the session is ready.
   */
  isReady(): boolean {
    return this.session !== null;
  }

  /**
   * Encode input to latent space parameters (mu, logvar).
   */
  async encode(input: Float32Array): Promise<EncodeResult> {
    if (!this.session) {
      throw new Error('VAE session not initialized');
    }

    const inputTensor = new ort.Tensor('float32', input, [1, input.length]);
    const results = await this.session.run({ input: inputTensor });

    const mu = results.mu?.data as Float32Array;
    const logvar = results.logvar?.data as Float32Array;

    return { mu, logvar };
  }

  /**
   * Reparameterization trick: z = mu + sigma * epsilon
   * where sigma = exp(0.5 * logvar) and epsilon ~ N(0, I)
   */
  sample(mu: Float32Array, logvar: Float32Array): Float32Array {
    const z = new Float32Array(mu.length);
    for (let i = 0; i < mu.length; i++) {
      const sigma = Math.exp(0.5 * logvar[i]);
      const epsilon = this.randn();
      z[i] = mu[i] + sigma * epsilon;
    }
    return z;
  }

  /**
   * Decode latent vector to reconstruction.
   */
  async decode(z: Float32Array): Promise<Float32Array> {
    if (!this.session) {
      throw new Error('VAE session not initialized');
    }

    const zTensor = new ort.Tensor('float32', z, [1, z.length]);
    const results = await this.session.run({ z: zTensor });

    return results.output?.data as Float32Array;
  }

  /**
   * Full forward pass: encode -> sample -> decode
   */
  async forward(input: Float32Array): Promise<ForwardResult> {
    const { mu, logvar } = await this.encode(input);
    const z = this.sample(mu, logvar);
    const reconstruction = await this.decode(z);

    return { mu, logvar, z, reconstruction };
  }

  /**
   * Generate standard normal random number using Box-Muller transform.
   */
  private randn(): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }
}
