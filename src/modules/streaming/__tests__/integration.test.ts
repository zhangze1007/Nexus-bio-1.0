/**
 * Streaming Module Integration Tests
 *
 * Tests cover:
 *   1. Stack Creation (defaults, custom options, all components present)
 *   2. Integration (pipeline processes, detector catches anomalies, server broadcasts)
 *   3. Edge Cases (empty data, invalid data, disconnections)
 *
 * @jest-environment node
 */

import WebSocket from 'ws';
import {
  createStreamingStack,
  createDefaultStreamingStack,
  StreamingServer,
  StreamingPipeline,
  AnomalyDetector,
} from '../index';
import type { StreamingStack, StreamingMessage, PipelineStage } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Counter to assign unique ports per test */
let portCounter = 9400;
function nextPort(): number {
  return portCounter++;
}

/** Create a client WebSocket, register message buffer immediately, wait for open */
function connectAndBuffer(
  port: number,
): Promise<{ ws: WebSocket; nextMessage: () => Promise<StreamingMessage> }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    const queue: StreamingMessage[] = [];
    const waiters: Array<(msg: StreamingMessage) => void> = [];

    ws.on('message', (raw: Buffer | string) => {
      const msg: StreamingMessage = JSON.parse(raw.toString());
      const waiter = waiters.shift();
      if (waiter) {
        waiter(msg);
      } else {
        queue.push(msg);
      }
    });

    ws.on('error', reject);

    ws.on('open', () => {
      resolve({
        ws,
        nextMessage: () => {
          return new Promise<StreamingMessage>((res, rej) => {
            const msg = queue.shift();
            if (msg) {
              res(msg);
            } else {
              const timer = setTimeout(() => rej(new Error('nextMessage timeout')), 3000);
              waiters.push((m) => {
                clearTimeout(timer);
                res(m);
              });
            }
          });
        },
      });
    });
  });
}

/** Helper: send a message through a WebSocket */
function send(ws: WebSocket, msg: StreamingMessage): void {
  ws.send(JSON.stringify(msg));
}

/** Helper: sleep */
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Create a simple named stage that appends its name to an array */
function makeStage(name: string): PipelineStage {
  return {
    name,
    process: async (data: unknown) => {
      if (Array.isArray(data)) {
        return [...data, name];
      }
      return name;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('Stack Creation', () => {
  let server: StreamingServer | null = null;

  afterEach(async () => {
    if (server) {
      try {
        await server.stop();
      } catch {
        // already stopped
      }
      server = null;
    }
  });

  it('creates stack with defaults', () => {
    const stack = createDefaultStreamingStack();

    expect(stack.server).toBeInstanceOf(StreamingServer);
    expect(stack.pipeline).toBeInstanceOf(StreamingPipeline);
    expect(stack.detector).toBeInstanceOf(AnomalyDetector);

    // Pipeline should have default stages
    expect(stack.pipeline.getStages()).toEqual(['validate', 'timestamp']);

    // Detector should have default rules
    expect(stack.detector.getRules()).toHaveLength(2);
    expect(stack.detector.getRules().some((r) => r.metric === 'cpu')).toBe(true);
    expect(stack.detector.getRules().some((r) => r.metric === 'memory')).toBe(true);
  });

  it('creates stack with custom options', () => {
    const port = nextPort();
    const stack = createStreamingStack({
      serverPort: port,
      bufferSize: 50,
      windowSize: 200,
      zScoreThreshold: 2.5,
    });

    expect(stack.server).toBeInstanceOf(StreamingServer);
    expect(stack.pipeline).toBeInstanceOf(StreamingPipeline);
    expect(stack.detector).toBeInstanceOf(AnomalyDetector);

    server = stack.server;
  });

  it('returns all components', () => {
    const stack = createStreamingStack();

    expect(stack).toHaveProperty('server');
    expect(stack).toHaveProperty('pipeline');
    expect(stack).toHaveProperty('detector');

    // All three must be defined
    expect(stack.server).toBeDefined();
    expect(stack.pipeline).toBeDefined();
    expect(stack.detector).toBeDefined();
  });

  it('creates independent stacks', () => {
    const stack1 = createStreamingStack();
    const stack2 = createStreamingStack();

    // Each stack should have its own instances
    expect(stack1.server).not.toBe(stack2.server);
    expect(stack1.pipeline).not.toBe(stack2.pipeline);
    expect(stack1.detector).not.toBe(stack2.detector);
  });

  it('default stack is equivalent to no-argument call', () => {
    const defaultStack = createDefaultStreamingStack();
    const noArgStack = createStreamingStack();

    // Both should produce valid components of the same type
    expect(defaultStack.server).toBeInstanceOf(StreamingServer);
    expect(noArgStack.server).toBeInstanceOf(StreamingServer);
    expect(defaultStack.pipeline).toBeInstanceOf(StreamingPipeline);
    expect(noArgStack.pipeline).toBeInstanceOf(StreamingPipeline);
    expect(defaultStack.detector).toBeInstanceOf(AnomalyDetector);
    expect(noArgStack.detector).toBeInstanceOf(AnomalyDetector);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Integration', () => {
  let stack: StreamingStack | null = null;
  const clientsToClose: WebSocket[] = [];

  afterEach(async () => {
    for (const ws of clientsToClose) {
      try {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      } catch {
        // ignore
      }
    }
    clientsToClose.length = 0;

    if (stack) {
      try {
        await stack.server.stop();
      } catch {
        // already stopped
      }
      stack = null;
    }
  });

  it('pipeline processes data through stages', async () => {
    stack = createStreamingStack({ serverPort: nextPort() });

    stack.pipeline.addStage(makeStage('parse'));
    stack.pipeline.addStage(makeStage('validate'));
    stack.pipeline.addStage(makeStage('transform'));

    const result = await stack.pipeline.process([]);
    expect(result).toEqual(['parse', 'validate', 'transform']);
  });

  it('detector catches anomalies from pipeline output', async () => {
    stack = createStreamingStack({ serverPort: nextPort() });

    stack.detector.addRule({
      metric: 'flux',
      min: 0,
      max: 100,
      severity: 'high',
      message: 'Flux out of range',
    });

    // Normal value — no anomaly
    const normal = stack.detector.check({ metric: 'flux', value: 50 });
    expect(normal).toEqual([]);

    // Out-of-range value — anomaly detected
    const anomalous = stack.detector.check({ metric: 'flux', value: 150 });
    expect(anomalous.length).toBeGreaterThanOrEqual(1);
    expect(anomalous.some((a) => a.severity === 'high')).toBe(true);
  });

  it('server broadcasts results to subscribed clients', async () => {
    const port = nextPort();
    stack = createStreamingStack({ serverPort: port });
    await stack.server.start();

    const { ws, nextMessage } = await connectAndBuffer(port);
    clientsToClose.push(ws);

    // Consume welcome message
    const welcome = await nextMessage();
    expect(welcome.type).toBe('heartbeat');
    const clientId = welcome.clientId!;

    // Subscribe to results topic
    send(ws, { type: 'subscribe', topic: 'results', timestamp: Date.now() });
    await sleep(50);

    // Publish a result
    stack.server.publish('results', { flux: { R1: 1.5 }, anomalies: [] });

    const msg = await nextMessage();
    expect(msg.type).toBe('publish');
    expect(msg.topic).toBe('results');
    expect(msg.data).toEqual({ flux: { R1: 1.5 }, anomalies: [] });
  });

  it('end-to-end: pipeline processes, detector checks, server broadcasts', async () => {
    const port = nextPort();
    stack = createStreamingStack({ serverPort: port });
    await stack.server.start();

    // Add a pipeline stage that extracts metric values
    const extractStage: PipelineStage = {
      name: 'extract',
      process: async (data: { metric: string; value: number }) => data,
    };
    stack.pipeline.addStage(extractStage);

    // Add a threshold rule
    stack.detector.addRule({
      metric: 'temperature',
      min: 20,
      max: 80,
      severity: 'critical',
      message: 'Temperature out of range',
    });

    // Connect a client
    const { ws, nextMessage } = await connectAndBuffer(port);
    clientsToClose.push(ws);
    await nextMessage(); // consume welcome

    send(ws, { type: 'subscribe', topic: 'anomalies', timestamp: Date.now() });
    await sleep(50);

    // Process data through pipeline — wiring auto-detects anomalies and publishes
    const data = { metric: 'temperature', value: 150 };
    const processed = await stack.pipeline.process(data);
    expect(processed).toEqual(data);

    // The wiring auto-publishes individual AnomalyEvent objects to the 'anomalies' topic
    const msg = await nextMessage();
    expect(msg.type).toBe('publish');
    expect(msg.topic).toBe('anomalies');
    expect((msg.data as any).metric).toBe('temperature');
    expect((msg.data as any).severity).toBe('critical');
  });

  it('z-score anomaly detection works in integrated stack', async () => {
    stack = createStreamingStack({
      serverPort: nextPort(),
      windowSize: 50,
      zScoreThreshold: 2,
    });

    // Build history with consistent values
    for (let i = 0; i < 20; i++) {
      stack.detector.check({ metric: 'production_rate', value: 100 });
    }

    // Feed an outlier — should trigger z-score anomaly
    const anomalies = stack.detector.check({ metric: 'production_rate', value: 500 });
    expect(anomalies.length).toBeGreaterThanOrEqual(1);
    expect(anomalies.some((a) => a.zScore !== undefined)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Edge Cases', () => {
  let stack: StreamingStack | null = null;
  const clientsToClose: WebSocket[] = [];

  afterEach(async () => {
    for (const ws of clientsToClose) {
      try {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      } catch {
        // ignore
      }
    }
    clientsToClose.length = 0;

    if (stack) {
      try {
        await stack.server.stop();
      } catch {
        // already stopped
      }
      stack = null;
    }
  });

  it('handles empty data through pipeline', async () => {
    stack = createStreamingStack({ serverPort: nextPort() });

    // Pipeline with no stages returns input unchanged
    const result = await stack.pipeline.process(null);
    expect(result).toBeNull();

    const undefinedResult = await stack.pipeline.process(undefined);
    expect(undefinedResult).toBeUndefined();
  });

  it('handles empty data in anomaly detector', () => {
    stack = createStreamingStack({ serverPort: nextPort() });

    // No rules registered — no anomalies
    const anomalies = stack.detector.check({ metric: 'unknown', value: 0 });
    expect(anomalies).toEqual([]);
  });

  it('handles invalid data in pipeline stage gracefully', async () => {
    stack = createStreamingStack({ serverPort: nextPort() });

    const failingStage: PipelineStage = {
      name: 'validator',
      process: async (data: unknown) => {
        if (typeof data !== 'number') {
          throw new Error('Expected number');
        }
        return data * 2;
      },
    };
    stack.pipeline.addStage(failingStage);

    // Valid data works
    const valid = await stack.pipeline.process(21);
    expect(valid).toBe(42);

    // Invalid data throws (pipeline propagates errors)
    await expect(stack.pipeline.process('not-a-number')).rejects.toThrow('Expected number');
  });

  it('handles client disconnection gracefully', async () => {
    const port = nextPort();
    stack = createStreamingStack({ serverPort: port });
    await stack.server.start();

    const { ws, nextMessage } = await connectAndBuffer(port);
    const welcome = await nextMessage();
    const clientId = welcome.clientId!;

    send(ws, { type: 'subscribe', topic: 'test', timestamp: Date.now() });
    await sleep(50);

    expect(stack.server.getConnectedClients()).toBe(1);
    expect(stack.server.getClientTopics(clientId)).toContain('test');

    // Disconnect
    ws.close();
    await sleep(200);

    expect(stack.server.getConnectedClients()).toBe(0);
    expect(stack.server.getClientTopics(clientId)).toHaveLength(0);
  });

  it('handles publishing to a topic with no subscribers', async () => {
    const port = nextPort();
    stack = createStreamingStack({ serverPort: port });
    await stack.server.start();

    // Should not throw
    expect(() => stack!.server.publish('no-subscribers', { data: 1 })).not.toThrow();
  });

  it('handles backpressure in pipeline buffer', () => {
    stack = createStreamingStack({ serverPort: nextPort(), bufferSize: 3 });

    expect(stack.pipeline.submit(1)).toBe(true);
    expect(stack.pipeline.submit(2)).toBe(true);
    expect(stack.pipeline.submit(3)).toBe(true);
    expect(stack.pipeline.submit(4)).toBe(false); // buffer full
  });

  it('handles detector with multiple metrics simultaneously', () => {
    stack = createStreamingStack({ serverPort: nextPort() });

    stack.detector.addRule({
      metric: 'ph',
      min: 6,
      max: 8,
      severity: 'critical',
      message: 'pH out of range',
    });
    stack.detector.addRule({
      metric: 'temperature',
      min: 20,
      max: 40,
      severity: 'high',
      message: 'Temperature out of range',
    });

    // ph in range, temperature out of range
    const phAnomalies = stack.detector.check({ metric: 'ph', value: 7 });
    expect(phAnomalies).toEqual([]);

    const tempAnomalies = stack.detector.check({ metric: 'temperature', value: 50 });
    expect(tempAnomalies.length).toBeGreaterThanOrEqual(1);

    // ph out of range
    const phBad = stack.detector.check({ metric: 'ph', value: 3 });
    expect(phBad.length).toBeGreaterThanOrEqual(1);
  });

  it('handles server start/stop cycle in stack', async () => {
    const port = nextPort();
    stack = createStreamingStack({ serverPort: port });

    await stack.server.start();
    expect(stack.server.getConnectedClients()).toBe(0);

    await stack.server.stop();
    stack = null; // prevent double-stop
  });

  it('pipeline buffer can be cleared', async () => {
    stack = createStreamingStack({ serverPort: nextPort() });

    stack.pipeline.submit(1);
    stack.pipeline.submit(2);
    stack.pipeline.submit(3);

    stack.pipeline.clear();

    // Buffer should be empty — processNext returns undefined
    const result = await stack.pipeline.processNext();
    expect(result).toBeUndefined();
  });

  it('detector can be reset in stack', () => {
    stack = createStreamingStack({ serverPort: nextPort() });

    stack.detector.addRule({
      metric: 'test',
      max: 100,
      severity: 'medium',
      message: 'Too high',
    });

    // Build some history
    for (let i = 0; i < 10; i++) {
      stack.detector.check({ metric: 'test', value: 50 });
    }

    stack.detector.reset();
    expect(stack.detector.getRules()).toHaveLength(0);

    // After reset, no z-score anomalies (no history)
    const anomalies = stack.detector.check({ metric: 'test', value: 500 });
    expect(anomalies).toEqual([]);
  });
});
