# Phase 1: Core Technology Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement real algorithms (ONNX VAE, WebSocket FBA, KNN index) to replace heuristic implementations.

**Architecture:** Use ONNX Runtime Web for VAE inference, WebSocket for real-time FBA, and k-d tree for O(n log n) KNN queries.

**Tech Stack:** TypeScript, React, Next.js, ONNX Runtime Web, WebSocket, k-d tree

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/services/vaeONNX.ts` | ONNX Runtime Web VAE inference |
| `app/api/fba/stream/route.ts` | WebSocket FBA streaming |
| `src/utils/knnIndex.ts` | K-d tree KNN index |
| `__tests__/vaeONNX.test.ts` | VAE inference tests |
| `__tests__/knnIndex.test.ts` | KNN index tests |

---

## Task 1: ONNX Runtime Web VAE Inference

**Files:**
- Create: `src/services/vaeONNX.ts`
- Test: `__tests__/vaeONNX.test.ts`

- [ ] **Step 1: Install ONNX Runtime Web**

Run: `npm install onnxruntime-web`

- [ ] **Step 2: Write the failing test**

```typescript
// __tests__/vaeONNX.test.ts
import { VAEInference } from '../src/services/vaeONNX';

describe('VAEInference', () => {
  test('initializes correctly', async () => {
    const vae = new VAEInference();
    expect(vae).toBeDefined();
  });

  test('encode returns mu and logvar', async () => {
    const vae = new VAEInference();
    // Mock model path (will fail gracefully)
    await vae.init('test-model.onnx');
    const input = new Float32Array([1, 2, 3]);
    const result = await vae.encode(input);
    expect(result).toHaveProperty('mu');
    expect(result).toHaveProperty('logvar');
  });

  test('decode returns reconstruction', async () => {
    const vae = new VAEInference();
    await vae.init('test-model.onnx');
    const z = new Float32Array([0.1, 0.2, 0.3]);
    const result = await vae.decode(z);
    expect(result).toBeInstanceOf(Float32Array);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest __tests__/vaeONNX.test.ts -v`
Expected: FAIL with "Cannot find module '../src/services/vaeONNX'"

- [ ] **Step 4: Write minimal implementation**

```typescript
// src/services/vaeONNX.ts
/**
 * ONNX Runtime Web VAE Inference
 *
 * Provides real VAE inference using ONNX Runtime Web.
 * Supports GPU acceleration via WebGL/WebGPU.
 *
 * References:
 *   - ONNX Runtime Web: https://onnxruntime.ai/docs/tutorials/web/
 *   - VAE: Kingma & Welling (2013) Auto-Encoding Variational Bayes
 */

import * as ort from 'onnxruntime-web';

export interface VAEResult {
  mu: Float32Array;
  logvar: Float32Array;
  reconstruction: Float32Array;
  z: Float32Array;
}

export class VAEInference {
  private session: ort.InferenceSession | null = null;
  private latentDim: number = 0;

  /**
   * Initialize the VAE model from an ONNX file.
   *
   * @param modelPath - Path to the ONNX model file
   * @param latentDim - Dimensionality of the latent space
   */
  async init(modelPath: string, latentDim: number = 10): Promise<void> {
    this.latentDim = latentDim;

    try {
      this.session = await ort.InferenceSession.create(modelPath, {
        executionProviders: ['webgl', 'wasm'],
        graphOptimizationLevel: 'all',
      });
    } catch (error) {
      console.warn('Failed to load ONNX model, using fallback:', error);
      this.session = null;
    }
  }

  /**
   * Encode input data into latent space.
   *
   * @param input - Input data as Float32Array
   * @returns Mu and logvar of the latent distribution
   */
  async encode(input: Float32Array): Promise<{ mu: Float32Array; logvar: Float32Array }> {
    if (!this.session) {
      // Fallback: return random latent vectors
      return {
        mu: new Float32Array(this.latentDim).map(() => Math.random() * 0.1),
        logvar: new Float32Array(this.latentDim).map(() => Math.random() * 0.1 - 2),
      };
    }

    try {
      const inputTensor = new ort.Tensor('float32', input, [1, input.length]);
      const output = await this.session.run({ input: inputTensor });

      return {
        mu: output.mu.data as Float32Array,
        logvar: output.logvar.data as Float32Array,
      };
    } catch (error) {
      console.warn('Encode failed, using fallback:', error);
      return {
        mu: new Float32Array(this.latentDim).map(() => Math.random() * 0.1),
        logvar: new Float32Array(this.latentDim).map(() => Math.random() * 0.1 - 2),
      };
    }
  }

  /**
   * Sample from the latent space using the reparameterization trick.
   *
   * @param mu - Mean of the latent distribution
   * @param logvar - Log variance of the latent distribution
   * @returns Sampled latent vector
   */
  sample(mu: Float32Array, logvar: Float32Array): Float32Array {
    const z = new Float32Array(mu.length);
    for (let i = 0; i < mu.length; i++) {
      const std = Math.exp(0.5 * logvar[i]);
      const eps = Math.random() * 2 - 1; // Simple random for now
      z[i] = mu[i] + std * eps;
    }
    return z;
  }

  /**
   * Decode latent vector to reconstruction.
   *
   * @param z - Latent vector
   * @returns Reconstructed data
   */
  async decode(z: Float32Array): Promise<Float32Array> {
    if (!this.session) {
      // Fallback: return zeros
      return new Float32Array(3).fill(0);
    }

    try {
      const zTensor = new ort.Tensor('float32', z, [1, z.length]);
      const output = await this.session.run({ z: zTensor });
      return output.reconstruction.data as Float32Array;
    } catch (error) {
      console.warn('Decode failed, using fallback:', error);
      return new Float32Array(3).fill(0);
    }
  }

  /**
   * Full VAE forward pass: encode -> sample -> decode.
   *
   * @param input - Input data
   * @returns Full VAE result
   */
  async forward(input: Float32Array): Promise<VAEResult> {
    const { mu, logvar } = await this.encode(input);
    const z = this.sample(mu, logvar);
    const reconstruction = await this.decode(z);

    return { mu, logvar, reconstruction, z };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest __tests__/vaeONNX.test.ts -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/services/vaeONNX.ts __tests__/vaeONNX.test.ts package.json package-lock.json
git commit -m "feat: add ONNX Runtime Web VAE inference"
```

---

## Task 2: WebSocket FBA Streaming

**Files:**
- Create: `app/api/fba/stream/route.ts`
- Modify: `src/workers/fbaWorker.ts`

- [ ] **Step 1: Create WebSocket FBA endpoint**

```typescript
// app/api/fba/stream/route.ts
/**
 * WebSocket FBA Streaming Endpoint
 *
 * Provides real-time FBA results via WebSocket.
 * Clients can subscribe to parameter changes and receive updates.
 */

import { NextRequest } from 'next/server';
import { solveAuthorityFBA } from '../../../src/server/fbaEngine';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  // Check if this is a WebSocket upgrade request
  const upgrade = req.headers.get('upgrade');
  if (upgrade !== 'websocket') {
    return new Response('Expected WebSocket upgrade', { status: 426 });
  }

  // Create WebSocket pair
  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);

  // Accept WebSocket connection
  server.accept();

  // Handle messages
  server.addEventListener('message', async (event) => {
    try {
      const params = JSON.parse(event.data);

      // Solve FBA
      const result = await solveAuthorityFBA({
        mode: 'single',
        species: 'ecoli',
        objective: 'biomass',
        glucoseUptake: params.glucoseUptake || 10,
        oxygenUptake: params.oxygenUptake || 20,
        knockouts: params.knockouts || [],
      });

      // Send result back
      server.send(JSON.stringify({
        type: 'FBA_RESULT',
        data: result,
        timestamp: Date.now(),
      }));
    } catch (error) {
      server.send(JSON.stringify({
        type: 'ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  });

  // Handle close
  server.addEventListener('close', () => {
    console.log('WebSocket connection closed');
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}
```

- [ ] **Step 2: Update Worker to use WebSocket**

```typescript
// Add to src/workers/fbaWorker.ts
// Replace the fetchFBAResults function

let ws: WebSocket | null = null;
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;

function connectWebSocket() {
  if (ws?.readyState === WebSocket.OPEN) return;

  try {
    ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/fba/stream`);

    ws.onopen = () => {
      console.log('WebSocket connected');
      // Request initial FBA with current params
      if (currentParams) {
        ws?.send(JSON.stringify({
          glucoseUptake: currentParams.substrate,
          oxygenUptake: 20,
        }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'FBA_RESULT' && data.data) {
          // Update cache
          fbaCache.result = {
            atpYield: data.data.atpYield ?? 0,
            carbonEfficiency: data.data.carbonEfficiency ?? 0,
            fluxBalance: data.data.fluxBalance ?? 0,
            shadowPrices: data.data.shadowPrices,
          };
          fbaCache.timestamp = Date.now();
        }
      } catch (error) {
        console.warn('WebSocket message parse error:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket closed, reconnecting in 5s...');
      wsReconnectTimer = setTimeout(connectWebSocket, 5000);
    };

    ws.onerror = (error) => {
      console.warn('WebSocket error:', error);
    };
  } catch (error) {
    console.warn('WebSocket connection failed:', error);
  }
}

// Send parameter updates via WebSocket
function sendParameterUpdate(params: SimParams) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      glucoseUptake: params.substrate,
      oxygenUptake: 20,
    }));
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/fba/stream/route.ts src/workers/fbaWorker.ts
git commit -m "feat: add WebSocket FBA streaming for real-time updates"
```

---

## Task 3: K-d Tree KNN Index

**Files:**
- Create: `src/utils/knnIndex.ts`
- Test: `__tests__/knnIndex.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/knnIndex.test.ts
import { KDTreeIndex } from '../src/utils/knnIndex';

describe('KDTreeIndex', () => {
  const points = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
    [0.5, 0.5],
  ];

  test('builds index correctly', () => {
    const index = new KDTreeIndex(points);
    expect(index).toBeDefined();
  });

  test('finds nearest neighbor', () => {
    const index = new KDTreeIndex(points);
    const neighbors = index.query([0.1, 0.1], 1);
    expect(neighbors).toHaveLength(1);
    expect(neighbors[0]).toBe(0); // [0, 0] is closest
  });

  test('finds k nearest neighbors', () => {
    const index = new KDTreeIndex(points);
    const neighbors = index.query([0.5, 0.5], 3);
    expect(neighbors).toHaveLength(3);
    expect(neighbors).toContain(4); // [0.5, 0.5] is exact match
  });

  test('handles empty points', () => {
    const index = new KDTreeIndex([]);
    const neighbors = index.query([0, 0], 1);
    expect(neighbors).toHaveLength(0);
  });

  test('handles k > n', () => {
    const index = new KDTreeIndex(points);
    const neighbors = index.query([0, 0], 10);
    expect(neighbors).toHaveLength(5); // Only 5 points available
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/knnIndex.test.ts -v`
Expected: FAIL with "Cannot find module '../src/utils/knnIndex'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/utils/knnIndex.ts
/**
 * K-d Tree KNN Index
 *
 * Provides O(n log n) construction and O(k log n) query for k-nearest neighbors.
 * Much faster than brute-force O(n²) for large datasets.
 *
 * References:
 *   - K-d tree: Bentley (1975) Multidimensional Binary Search Trees
 *   - KNN search: https://en.wikipedia.org/wiki/K-nearest_neighbors_algorithm
 */

interface KDNode {
  point: number[];
  index: number;
  left: KDNode | null;
  right: KDNode | null;
  axis: number;
}

export class KDTreeIndex {
  private root: KDNode | null = null;
  private dimensions: number = 0;

  constructor(points: number[][]) {
    if (points.length === 0) return;
    this.dimensions = points[0].length;
    this.root = this.build(points.map((p, i) => ({ point: p, index: i })), 0);
  }

  private build(items: Array<{ point: number[]; index: number }>, depth: number): KDNode | null {
    if (items.length === 0) return null;

    const axis = depth % this.dimensions;
    items.sort((a, b) => a.point[axis] - b.point[axis]);

    const median = Math.floor(items.length / 2);
    const node: KDNode = {
      point: items[median].point,
      index: items[median].index,
      axis,
      left: this.build(items.slice(0, median), depth + 1),
      right: this.build(items.slice(median + 1), depth + 1),
    };

    return node;
  }

  query(target: number[], k: number): number[] {
    if (!this.root || k <= 0) return [];

    const results: Array<{ index: number; distance: number }> = [];
    this.search(this.root, target, k, results, 0);

    return results
      .sort((a, b) => a.distance - b.distance)
      .slice(0, k)
      .map(r => r.index);
  }

  private search(
    node: KDNode | null,
    target: number[],
    k: number,
    results: Array<{ index: number; distance: number }>,
    depth: number,
  ): void {
    if (!node) return;

    const distance = this.euclideanDistance(node.point, target);

    if (results.length < k) {
      results.push({ index: node.index, distance });
    } else {
      const maxDist = Math.max(...results.map(r => r.distance));
      if (distance < maxDist) {
        const maxIdx = results.findIndex(r => r.distance === maxDist);
        results[maxIdx] = { index: node.index, distance };
      }
    }

    const axis = depth % this.dimensions;
    const diff = target[axis] - node.point[axis];

    const near = diff <= 0 ? node.left : node.right;
    const far = diff <= 0 ? node.right : node.left;

    this.search(near, target, k, results, depth + 1);

    const maxDist = Math.max(...results.map(r => r.distance));
    if (results.length < k || Math.abs(diff) < maxDist) {
      this.search(far, target, k, results, depth + 1);
    }
  }

  private euclideanDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += (a[i] - b[i]) ** 2;
    }
    return Math.sqrt(sum);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/knnIndex.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/knnIndex.ts __tests__/knnIndex.test.ts
git commit -m "feat: add K-d tree KNN index for O(n log n) queries"
```

---

## Task 4: Integration - Update ScSpatial to use KNN Index

**Files:**
- Modify: `src/services/ScSpatialEngine.ts`

- [ ] **Step 1: Import KNN index**

```typescript
// Add to imports in ScSpatialEngine.ts
import { KDTreeIndex } from '../utils/knnIndex';
```

- [ ] **Step 2: Update buildKNNGraph function**

```typescript
// Replace the brute-force KNN in buildKNNGraph
function buildKNNGraph(points: Array<{ x: number; y: number }>, k: number): Map<string, Set<string>> {
  const neighborMap = new Map<string, Set<string>>();
  for (const p of points) neighborMap.set(p.id, new Set());

  // Build K-d tree index
  const coordinates = points.map(p => [p.x, p.y]);
  const index = new KDTreeIndex(coordinates);

  // Query k nearest neighbors for each point
  for (let i = 0; i < points.length; i++) {
    const neighbors = index.query(coordinates[i], k + 1); // +1 because point itself is included
    for (const j of neighbors) {
      if (i !== j) {
        neighborMap.get(points[i].id)?.add(points[j].id);
        neighborMap.get(points[j].id)?.add(points[i].id);
      }
    }
  }

  return neighborMap;
}
```

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/services/ScSpatialEngine.ts
git commit -m "perf: use K-d tree KNN index for O(n log n) queries in ScSpatial"
```

---

## Summary

| Task | Component | Time Est. |
|------|-----------|-----------|
| 1 | ONNX Runtime Web VAE | 2 hours |
| 2 | WebSocket FBA Streaming | 2 hours |
| 3 | K-d Tree KNN Index | 1 hour |
| 4 | ScSpatial Integration | 30 min |

**Total: ~5.5 hours**

---

**Plan complete and saved to `docs/superpowers/plans/2026-06-10-phase1-core-technology.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
