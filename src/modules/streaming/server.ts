/**
 * Streaming WebSocket Server
 *
 * Real-time publish/subscribe streaming server for Nexus-Bio.
 * Supports topic-based message routing, heartbeat monitoring,
 * and client session management.
 *
 * @module streaming/server
 */

import { randomUUID } from "crypto";
import { WebSocket, WebSocketServer } from "ws";
import type { ClientInfo, StreamingMessage, StreamingOptions } from "./types";

/**
 * WebSocket-based streaming server with pub/sub messaging.
 *
 * Clients connect and receive a unique clientId. They subscribe to named
 * topics and receive only messages published to those topics. A periodic
 * heartbeat detects and cleans up stale connections.
 *
 * @example
 * ```ts
 * const server = new StreamingServer({ port: 8080, heartbeatInterval: 30000 });
 * await server.start();
 * server.publish('fba-results', { flux: { R1: 1.2 } });
 * ```
 */
export class StreamingServer {
  private wss: WebSocketServer | null = null;
  private readonly port: number;
  private readonly heartbeatInterval: number;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private stopping = false;

  /** Map from clientId to client metadata */
  private clients: Map<string, ClientInfo> = new Map();

  /** Map from clientId to the raw WebSocket connection */
  private connections: Map<string, WebSocket> = new Map();

  /** Reverse index: topic -> Set of clientIds subscribed to it */
  private topicSubscribers: Map<string, Set<string>> = new Map();

  /** Map from raw WebSocket to the assigned clientId */
  private wsToClientId: Map<WebSocket, string> = new Map();

  /**
   * Create a new StreamingServer.
   *
   * @param options - Configuration options
   * @param options.port - Port to listen on (default: 8080)
   * @param options.heartbeatInterval - Heartbeat interval in ms (default: 30000)
   */
  constructor(options?: StreamingOptions) {
    this.port = options?.port ?? 8080;
    this.heartbeatInterval = options?.heartbeatInterval ?? 30_000;
  }

  /**
   * Start the WebSocket server.
   *
   * Begins accepting connections and starts the heartbeat timer.
   * Throws if the server is already running.
   *
   * @throws {Error} If the server is already started
   */
  async start(): Promise<void> {
    if (this.wss) {
      throw new Error("Server already started");
    }

    return new Promise<void>((resolve, reject) => {
      this.wss = new WebSocketServer({ port: this.port }, () => {
        this.startHeartbeat();
        resolve();
      });

      this.wss.on("error", (err) => {
        this.wss = null;
        reject(err);
      });

      this.wss.on("connection", (ws: WebSocket) => {
        this.handleConnection(ws);
      });
    });
  }

  /**
   * Stop the WebSocket server.
   *
   * Closes all client connections, stops the heartbeat timer,
   * and shuts down the server. Throws if the server is not running.
   *
   * @throws {Error} If the server is not started
   */
  async stop(): Promise<void> {
    if (!this.wss) {
      throw new Error("Server not started");
    }

    this.stopping = true;
    this.stopHeartbeat();

    // Close all client connections
    for (const ws of this.connections.values()) {
      ws.close();
    }

    // Close the server and clear maps after close completes
    await new Promise<void>((resolve, reject) => {
      this.wss!.close((err) => {
        this.wss = null;
        this.stopping = false;
        this.clients.clear();
        this.connections.clear();
        this.wsToClientId.clear();
        this.topicSubscribers.clear();
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Subscribe a client to one or more topics.
   *
   * Adds the topics to the client's subscription set and updates
   * the reverse topic index. Duplicate subscriptions are ignored.
   *
   * @param clientId - The client's unique identifier
   * @param topics - Array of topic names to subscribe to
   */
  subscribe(clientId: string, topics: string[]): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    for (const topic of topics) {
      if (!topic) continue; // skip empty strings
      if (!client.topics.has(topic)) {
        client.topics.add(topic);

        if (!this.topicSubscribers.has(topic)) {
          this.topicSubscribers.set(topic, new Set());
        }
        this.topicSubscribers.get(topic)!.add(clientId);
      }
    }
  }

  /**
   * Unsubscribe a client from one or more topics.
   *
   * Removes the topics from the client's subscription set and
   * updates the reverse topic index. Silently ignores topics
   * the client was not subscribed to.
   *
   * @param clientId - The client's unique identifier
   * @param topics - Array of topic names to unsubscribe from
   */
  unsubscribe(clientId: string, topics: string[]): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    for (const topic of topics) {
      client.topics.delete(topic);
      const subscribers = this.topicSubscribers.get(topic);
      if (subscribers) {
        subscribers.delete(clientId);
        if (subscribers.size === 0) {
          this.topicSubscribers.delete(topic);
        }
      }
    }
  }

  /**
   * Publish a message to a topic.
   *
   * Sends the data to all clients subscribed to the given topic.
   * Messages are JSON-serialized with type 'publish', the topic name,
   * the data payload, and a server timestamp.
   *
   * If no clients are subscribed to the topic, this is a no-op.
   *
   * @param topic - The topic to publish to
   * @param data - The data payload to send
   */
  publish(topic: string, data: unknown): void {
    const subscribers = this.topicSubscribers.get(topic);
    if (!subscribers || subscribers.size === 0) return;

    const message: StreamingMessage = {
      type: "publish",
      topic,
      data,
      timestamp: Date.now(),
    };

    const payload = JSON.stringify(message);

    for (const clientId of subscribers) {
      const ws = this.connections.get(clientId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  /**
   * Get the number of currently connected clients.
   *
   * @returns The count of active client connections
   */
  getConnectedClients(): number {
    return this.clients.size;
  }

  /**
   * Get the list of topics a client is subscribed to.
   *
   * Returns an empty array if the client ID is unknown.
   *
   * @param clientId - The client's unique identifier
   * @returns Array of topic names
   */
  getClientTopics(clientId: string): string[] {
    const client = this.clients.get(clientId);
    return client ? Array.from(client.topics) : [];
  }

  // ── Private Implementation ────────────────────────────────────────────────

  /**
   * Handle a new WebSocket connection.
   * Generates a unique clientId, sends a welcome heartbeat, and sets up message handling.
   */
  private handleConnection(ws: WebSocket): void {
    const clientId = randomUUID();
    const now = Date.now();

    const clientInfo: ClientInfo = {
      id: clientId,
      topics: new Set(),
      lastHeartbeat: now,
    };

    this.clients.set(clientId, clientInfo);
    this.connections.set(clientId, ws);
    this.wsToClientId.set(ws, clientId);

    // Mutable ref so the closure sees ID migrations
    const currentId = { value: clientId };

    // Send welcome message with assigned clientId
    this.sendTo(ws, {
      type: "heartbeat",
      clientId,
      timestamp: now,
    });

    ws.on("message", (raw: Buffer | string) => {
      this.handleMessage(ws, currentId, raw.toString());
    });

    ws.on("close", () => {
      this.handleDisconnect(ws, currentId.value);
    });

    ws.on("error", () => {
      this.handleDisconnect(ws, currentId.value);
    });
  }

  /**
   * Handle an incoming message from a client.
   * Routes subscribe/unsubscribe/clientId-claim messages.
   */
  private handleMessage(ws: WebSocket, currentId: { value: string }, raw: string): void {
    let message: StreamingMessage;
    try {
      message = JSON.parse(raw);
    } catch {
      this.sendTo(ws, {
        type: "error",
        data: "Invalid JSON",
        timestamp: Date.now(),
      });
      return;
    }

    // Update heartbeat timestamp on any message
    const client = this.clients.get(currentId.value);
    if (client) {
      client.lastHeartbeat = Date.now();
    }

    switch (message.type) {
      case "subscribe": {
        // Support custom clientId via message
        if (message.clientId && message.clientId !== currentId.value) {
          this.migrateClientId(ws, currentId.value, message.clientId);
          currentId.value = message.clientId;
        }
        if (message.topic) {
          this.subscribe(currentId.value, [message.topic]);
        }
        break;
      }

      case "unsubscribe": {
        if (message.topic) {
          this.unsubscribe(currentId.value, [message.topic]);
        }
        break;
      }

      case "heartbeat": {
        // Client responding to server heartbeat — already updated lastHeartbeat above
        break;
      }

      default:
        break;
    }
  }

  /**
   * Handle client disconnection.
   * Removes the client from all subscriptions and cleans up metadata.
   */
  private handleDisconnect(ws: WebSocket, clientId: string): void {
    if (this.stopping) return;

    const client = this.clients.get(clientId);

    if (client) {
      // Remove from all topic subscriptions
      for (const topic of client.topics) {
        const subscribers = this.topicSubscribers.get(topic);
        if (subscribers) {
          subscribers.delete(clientId);
          if (subscribers.size === 0) {
            this.topicSubscribers.delete(topic);
          }
        }
      }
    }

    this.clients.delete(clientId);
    this.connections.delete(clientId);
    this.wsToClientId.delete(ws);
  }

  /**
   * Migrate a client from an auto-assigned ID to a custom ID.
   * Transfers all subscriptions and connection state.
   */
  private migrateClientId(ws: WebSocket, oldId: string, newId: string): void {
    const client = this.clients.get(oldId);
    if (!client) return;

    // Transfer client info
    client.id = newId;
    this.clients.delete(oldId);
    this.clients.set(newId, client);

    // Transfer connection mapping
    this.connections.delete(oldId);
    this.connections.set(newId, ws);
    this.wsToClientId.set(ws, newId);

    // Update reverse index in topic subscribers
    for (const topic of client.topics) {
      const subscribers = this.topicSubscribers.get(topic);
      if (subscribers) {
        subscribers.delete(oldId);
        subscribers.add(newId);
      }
    }
  }

  /**
   * Send a JSON message to a specific WebSocket.
   */
  private sendTo(ws: WebSocket, message: StreamingMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Start the periodic heartbeat timer.
   * Sends heartbeats to all connected clients and cleans up stale connections.
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeats();
    }, this.heartbeatInterval);

    // Unref the timer so it doesn't keep the process alive
    if (this.heartbeatTimer.unref) {
      this.heartbeatTimer.unref();
    }
  }

  /**
   * Stop the heartbeat timer.
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Send heartbeat to all connected clients and clean up stale ones.
   * A client is considered stale if it hasn't responded within 2x the heartbeat interval.
   */
  private sendHeartbeats(): void {
    const now = Date.now();
    const staleThreshold = this.heartbeatInterval * 2;
    const staleClients: string[] = [];

    for (const [clientId, client] of this.clients) {
      if (now - client.lastHeartbeat > staleThreshold) {
        staleClients.push(clientId);
      } else {
        const ws = this.connections.get(clientId);
        if (ws) {
          this.sendTo(ws, {
            type: "heartbeat",
            clientId,
            timestamp: now,
          });
        }
      }
    }

    // Clean up stale clients
    for (const clientId of staleClients) {
      const ws = this.connections.get(clientId);
      if (ws) {
        ws.terminate();
        this.handleDisconnect(ws, clientId);
      }
    }
  }
}
