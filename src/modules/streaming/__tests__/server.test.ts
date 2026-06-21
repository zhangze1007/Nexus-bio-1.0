/**
 * StreamingServer Tests
 *
 * Tests cover:
 *   1. Server lifecycle (start/stop)
 *   2. Subscribe/unsubscribe mechanics
 *   3. Publish/receive message routing
 *   4. Client management and disconnection
 *   5. Heartbeat mechanism
 *
 * @jest-environment node
 */

import WebSocket from 'ws';
import { StreamingServer } from '../server';
import type { StreamingMessage } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Counter to assign unique ports per test */
let portCounter = 9200;
function nextPort(): number {
  return portCounter++;
}

/** Create a client WebSocket, register message buffer immediately, wait for open */
function connectAndBuffer(port: number): Promise<{ ws: WebSocket; nextMessage: () => Promise<StreamingMessage> }> {
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

// ─────────────────────────────────────────────────────────────────────────────

describe('StreamingServer', () => {
  let server: StreamingServer | null = null;
  const clientsToClose: WebSocket[] = [];

  afterEach(async () => {
    // Close any client WebSockets left open
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

    // Stop server if still running
    if (server) {
      try {
        await server.stop();
      } catch {
        // already stopped
      }
      server = null;
    }
  });

  // ── Server Lifecycle ──────────────────────────────────────────────────────

  describe('server lifecycle', () => {
    it('starts and stops cleanly', async () => {
      const port = nextPort();
      server = new StreamingServer({ port });
      await server.start();
      expect(server.getConnectedClients()).toBe(0);
      await server.stop();
      server = null; // prevent double-stop in afterEach
    });

    it('handles multiple start/stop cycles', async () => {
      const port = nextPort();
      server = new StreamingServer({ port });

      await server.start();
      expect(server.getConnectedClients()).toBe(0);
      await server.stop();

      // Second cycle
      server = new StreamingServer({ port });
      await server.start();
      expect(server.getConnectedClients()).toBe(0);
      await server.stop();
      server = null;
    });

    it('rejects starting when already started', async () => {
      const port = nextPort();
      server = new StreamingServer({ port });
      await server.start();
      await expect(server.start()).rejects.toThrow('already started');
    });

    it('rejects stopping when not started', async () => {
      const port = nextPort();
      server = new StreamingServer({ port });
      await expect(server.stop()).rejects.toThrow('not started');
      server = null;
    });
  });

  // ── Subscribe / Unsubscribe ───────────────────────────────────────────────

  describe('subscribe/unsubscribe', () => {
    it('client can subscribe to a topic', async () => {
      const port = nextPort();
      server = new StreamingServer({ port });
      await server.start();

      const { ws, nextMessage } = await connectAndBuffer(port);
      clientsToClose.push(ws);

      // First message from server should be a welcome with clientId
      const welcome = await nextMessage();
      expect(welcome.type).toBe('heartbeat');
      expect(welcome.clientId).toBeDefined();

      const clientId = welcome.clientId!;

      send(ws, { type: 'subscribe', topic: 'test-topic', timestamp: Date.now() });
      await sleep(50);

      expect(server.getClientTopics(clientId)).toContain('test-topic');
    });

    it('client can unsubscribe from a topic', async () => {
      const port = nextPort();
      server = new StreamingServer({ port });
      await server.start();

      const { ws, nextMessage } = await connectAndBuffer(port);
      clientsToClose.push(ws);

      const welcome = await nextMessage();
      const clientId = welcome.clientId!;

      send(ws, { type: 'subscribe', topic: 'topic-a', timestamp: Date.now() });
      await sleep(50);
      expect(server.getClientTopics(clientId)).toContain('topic-a');

      send(ws, { type: 'unsubscribe', topic: 'topic-a', timestamp: Date.now() });
      await sleep(50);
      expect(server.getClientTopics(clientId)).not.toContain('topic-a');
    });

    it('multiple clients can subscribe to the same topic', async () => {
      const port = nextPort();
      server = new StreamingServer({ port });
      await server.start();

      const c1 = await connectAndBuffer(port);
      const c2 = await connectAndBuffer(port);
      clientsToClose.push(c1.ws, c2.ws);

      const welcome1 = await c1.nextMessage();
      const welcome2 = await c2.nextMessage();
      const clientId1 = welcome1.clientId!;
      const clientId2 = welcome2.clientId!;

      send(c1.ws, { type: 'subscribe', topic: 'shared-topic', timestamp: Date.now() });
      send(c2.ws, { type: 'subscribe', topic: 'shared-topic', timestamp: Date.now() });
      await sleep(50);

      expect(server.getClientTopics(clientId1)).toContain('shared-topic');
      expect(server.getClientTopics(clientId2)).toContain('shared-topic');
    });

    it('ignores duplicate subscription to the same topic', async () => {
      const port = nextPort();
      server = new StreamingServer({ port });
      await server.start();

      const { ws, nextMessage } = await connectAndBuffer(port);
      clientsToClose.push(ws);

      const welcome = await nextMessage();
      const clientId = welcome.clientId!;

      send(ws, { type: 'subscribe', topic: 'dup-topic', timestamp: Date.now() });
      await sleep(30);
      send(ws, { type: 'subscribe', topic: 'dup-topic', timestamp: Date.now() });
      await sleep(30);

      // Should not duplicate
      const topics = server.getClientTopics(clientId);
      expect(topics.filter((t) => t === 'dup-topic')).toHaveLength(1);
    });

    it('ignores unsubscribe from a topic not subscribed to', async () => {
      const port = nextPort();
      server = new StreamingServer({ port });
      await server.start();

      const { ws, nextMessage } = await connectAndBuffer(port);
      clientsToClose.push(ws);
      await nextMessage(); // consume welcome

      // Should not throw
      send(ws, { type: 'unsubscribe', topic: 'never-subscribed', timestamp: Date.now() });
      await sleep(30);
    });
  });

  // ── Publish / Receive ─────────────────────────────────────────────────────

  describe('publish/receive', () => {
    it('published message reaches subscribers', async () => {
      const port = nextPort();
      server = new StreamingServer({ port });
      await server.start();

      const { ws, nextMessage } = await connectAndBuffer(port);
      clientsToClose.push(ws);
      await nextMessage(); // consume welcome

      send(ws, { type: 'subscribe', topic: 'data-stream', timestamp: Date.now() });
      await sleep(50);

      // Publish via server API
      server.publish('data-stream', { value: 42 });

      const msg = await nextMessage();
      expect(msg.type).toBe('publish');
      expect(msg.topic).toBe('data-stream');
      expect(msg.data).toEqual({ value: 42 });
    });

    it('non-subscribers do not receive the message', async () => {
      const port = nextPort();
      server = new StreamingServer({ port });
      await server.start();

      const c1 = await connectAndBuffer(port);
      const c2 = await connectAndBuffer(port);
      clientsToClose.push(c1.ws, c2.ws);
      await c1.nextMessage(); // consume welcome
      await c2.nextMessage(); // consume welcome

      // ws1 subscribes, ws2 does not
      send(c1.ws, { type: 'subscribe', topic: 'exclusive', timestamp: Date.now() });
      await sleep(50);

      // Publish
      server.publish('exclusive', { secret: true });

      // ws1 should receive
      const msg = await c1.nextMessage();
      expect(msg.type).toBe('publish');
      expect(msg.topic).toBe('exclusive');

      // ws2 should NOT receive — verify by subscribing ws2 to a different topic
      // and confirming it gets that message (not the 'exclusive' one)
      send(c2.ws, { type: 'subscribe', topic: 'other', timestamp: Date.now() });
      await sleep(50);
      server.publish('other', { other: true });
      const msg2 = await c2.nextMessage();
      expect(msg2.topic).toBe('other');
    });

    it('published messages include correct format', async () => {
      const port = nextPort();
      server = new StreamingServer({ port });
      await server.start();

      const { ws, nextMessage } = await connectAndBuffer(port);
      clientsToClose.push(ws);
      await nextMessage(); // consume welcome

      send(ws, { type: 'subscribe', topic: 'format-check', timestamp: Date.now() });
      await sleep(50);

      server.publish('format-check', { nested: { data: [1, 2, 3] } });

      const msg = await nextMessage();
      expect(msg).toHaveProperty('type', 'publish');
      expect(msg).toHaveProperty('topic', 'format-check');
      expect(msg).toHaveProperty('data');
      expect(msg).toHaveProperty('timestamp');
      expect(typeof msg.timestamp).toBe('number');
    });

    it('publishing to a topic with no subscribers does not throw', async () => {
      const port = nextPort();
      server = new StreamingServer({ port });
      await server.start();

      // Should not throw
      expect(() => server!.publish('empty-topic', { x: 1 })).not.toThrow();
    });
  });

  // ── Client Management ─────────────────────────────────────────────────────

  describe('client management', () => {
    it('tracks connected clients', async () => {
      const port = nextPort();
      server = new StreamingServer({ port });
      await server.start();

      expect(server.getConnectedClients()).toBe(0);

      const c1 = await connectAndBuffer(port);
      clientsToClose.push(c1.ws);
      await c1.nextMessage(); // consume welcome
      expect(server.getConnectedClients()).toBe(1);

      const c2 = await connectAndBuffer(port);
      clientsToClose.push(c2.ws);
      await c2.nextMessage(); // consume welcome
      expect(server.getConnectedClients()).toBe(2);

      c1.ws.close();
      await sleep(200);
      expect(server.getConnectedClients()).toBe(1);

      c2.ws.close();
      await sleep(200);
      expect(server.getConnectedClients()).toBe(0);
    });

    it('tracks client topics', async () => {
      const port = nextPort();
      server = new StreamingServer({ port });
      await server.start();

      const { ws, nextMessage } = await connectAndBuffer(port);
      clientsToClose.push(ws);
      const welcome = await nextMessage();
      const clientId = welcome.clientId!;

      send(ws, { type: 'subscribe', topic: 'alpha', timestamp: Date.now() });
      await sleep(30);
      send(ws, { type: 'subscribe', topic: 'beta', timestamp: Date.now() });
      await sleep(30);

      const topics = server.getClientTopics(clientId);
      expect(topics).toContain('alpha');
      expect(topics).toContain('beta');
      expect(topics).toHaveLength(2);
    });

    it('cleans up on client disconnection', async () => {
      const port = nextPort();
      server = new StreamingServer({ port });
      await server.start();

      const { ws, nextMessage } = await connectAndBuffer(port);
      const welcome = await nextMessage();
      const clientId = welcome.clientId!;

      send(ws, { type: 'subscribe', topic: 'cleanup-test', timestamp: Date.now() });
      await sleep(50);
      expect(server.getClientTopics(clientId)).toContain('cleanup-test');

      ws.close();
      await sleep(200);

      // After disconnect, client topics should be empty / client removed
      expect(server.getClientTopics(clientId)).toHaveLength(0);
      expect(server.getConnectedClients()).toBe(0);
    });

    it('supports custom client ID via message', async () => {
      const port = nextPort();
      server = new StreamingServer({ port });
      await server.start();

      const { ws, nextMessage } = await connectAndBuffer(port);
      clientsToClose.push(ws);
      const welcome = await nextMessage();
      const assignedId = welcome.clientId!;

      // Set custom ID by subscribing with a clientId field
      send(ws, { type: 'subscribe', topic: 'custom-id-test', clientId: 'my-custom-id', timestamp: Date.now() });
      await sleep(50);

      // Old assigned ID should no longer work
      expect(server.getClientTopics(assignedId)).toHaveLength(0);

      // Custom ID should now be the active client
      expect(server.getClientTopics('my-custom-id')).toContain('custom-id-test');
    });

    it('uses custom ID for subsequent messages after migration', async () => {
      const port = nextPort();
      server = new StreamingServer({ port });
      await server.start();

      const { ws, nextMessage } = await connectAndBuffer(port);
      clientsToClose.push(ws);
      const welcome = await nextMessage();
      const assignedId = welcome.clientId!;

      // First: migrate to custom ID
      send(ws, { type: 'subscribe', topic: 'first-topic', clientId: 'migrated-id', timestamp: Date.now() });
      await sleep(50);
      expect(server.getClientTopics(assignedId)).toHaveLength(0);
      expect(server.getClientTopics('migrated-id')).toContain('first-topic');

      // Second: subscribe to another topic using auto-assigned clientId (should use migrated ID)
      send(ws, { type: 'subscribe', topic: 'second-topic', timestamp: Date.now() });
      await sleep(50);
      expect(server.getClientTopics('migrated-id')).toContain('second-topic');
      expect(server.getClientTopics('migrated-id')).toHaveLength(2);
    });
  });

  // ── Heartbeat ─────────────────────────────────────────────────────────────

  describe('heartbeat', () => {
    it('sends periodic heartbeats', async () => {
      const port = nextPort();
      server = new StreamingServer({ port, heartbeatInterval: 200 });
      await server.start();

      const { ws, nextMessage } = await connectAndBuffer(port);
      clientsToClose.push(ws);

      // First heartbeat is the welcome
      const welcome = await nextMessage();
      expect(welcome.type).toBe('heartbeat');

      // Wait for the next heartbeat
      const hb2 = await nextMessage();
      expect(hb2.type).toBe('heartbeat');
    });

    it('detects disconnected clients via heartbeat timeout', async () => {
      const port = nextPort();
      server = new StreamingServer({ port, heartbeatInterval: 100 });
      await server.start();

      const { ws, nextMessage } = await connectAndBuffer(port);
      const welcome = await nextMessage();
      const clientId = welcome.clientId!;

      send(ws, { type: 'subscribe', topic: 'hb-test', timestamp: Date.now() });
      await sleep(50);
      expect(server.getConnectedClients()).toBe(1);

      // Terminate the WebSocket without closing gracefully (simulates crash)
      ws.terminate();
      // Wait for the server to detect the disconnection (2-3 heartbeat cycles)
      await sleep(500);

      expect(server.getConnectedClients()).toBe(0);
      expect(server.getClientTopics(clientId)).toHaveLength(0);
    });
  });
});
