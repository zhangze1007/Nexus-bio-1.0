/**
 * Tests for ONNX Runtime Web VAE inference module.
 */
import { VAEInference } from '../src/services/vaeONNX';

// Mock onnxruntime-web
jest.mock('onnxruntime-web', () => {
  const mockTensor = jest.fn((type: string, data: Float32Array, dims: number[]) => ({
    type,
    data,
    dims,
    size: dims.reduce((a: number, b: number) => a * b, 1),
  }));

  return {
    InferenceSession: {
      create: jest.fn().mockResolvedValue({
        run: jest.fn().mockResolvedValue({
          mu: { data: new Float32Array([0.1, 0.2, 0.3, 0.4]), dims: [1, 4] },
          logvar: { data: new Float32Array([-0.5, -0.3, -0.1, -0.2]), dims: [1, 4] },
          output: { data: new Float32Array([0.5, 0.6, 0.7, 0.8]), dims: [1, 4] },
        }),
        inputNames: ['input'],
        outputNames: ['mu', 'logvar', 'output'],
      }),
    },
    Tensor: mockTensor,
    env: { wasm: {} },
  };
});

describe('VAEInference', () => {
  let vae: VAEInference;

  beforeEach(() => {
    vae = new VAEInference();
  });

  test('initializes without errors', async () => {
    await expect(vae.init()).resolves.not.toThrow();
    expect(vae.isReady()).toBe(true);
  });

  test('encode returns mu and logvar', async () => {
    await vae.init();
    const result = await vae.encode(new Float32Array([1, 2, 3, 4]));

    expect(result).toHaveProperty('mu');
    expect(result).toHaveProperty('logvar');
    expect(result.mu).toBeInstanceOf(Float32Array);
    expect(result.logvar).toBeInstanceOf(Float32Array);
  });

  test('sample applies reparameterization trick', async () => {
    await vae.init();
    const mu = new Float32Array([0.1, 0.2, 0.3, 0.4]);
    const logvar = new Float32Array([-0.5, -0.3, -0.1, -0.2]);

    const z = vae.sample(mu, logvar);
    expect(z).toBeInstanceOf(Float32Array);
    expect(z.length).toBe(mu.length);
  });

  test('decode returns reconstruction', async () => {
    await vae.init();
    const z = new Float32Array([0.1, 0.2, 0.3, 0.4]);
    const result = await vae.decode(z);

    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBeGreaterThan(0);
  });

  test('forward returns full VAE output', async () => {
    await vae.init();
    const result = await vae.forward(new Float32Array([1, 2, 3, 4]));

    expect(result).toHaveProperty('mu');
    expect(result).toHaveProperty('logvar');
    expect(result).toHaveProperty('z');
    expect(result).toHaveProperty('reconstruction');
  });

  test('throws if not initialized', async () => {
    await expect(vae.encode(new Float32Array([1, 2, 3, 4]))).rejects.toThrow(
      'VAE session not initialized'
    );
  });
});
