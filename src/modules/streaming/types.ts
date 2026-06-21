/**
 * Streaming Module Types
 *
 * Type definitions for the WebSocket-based real-time streaming server.
 * Supports publish/subscribe messaging, heartbeat monitoring, and
 * session identification for connected clients.
 */

/** Message types supported by the streaming protocol */
export type MessageType = 'subscribe' | 'unsubscribe' | 'publish' | 'heartbeat' | 'error';

/**
 * Standard message format for all streaming communication.
 * Every message exchanged between client and server uses this shape.
 */
export interface StreamingMessage {
  /** Message type discriminator */
  type: MessageType;
  /** Topic name (required for subscribe/unsubscribe/publish) */
  topic?: string;
  /** Payload data (required for publish, optional for error details) */
  data?: unknown;
  /** Client identifier (set by server on connection, or sent by client to claim custom ID) */
  clientId?: string;
  /** Unix timestamp in milliseconds */
  timestamp: number;
}

/**
 * Configuration options for StreamingServer.
 */
export interface StreamingOptions {
  /** Port number to listen on (default: 8080) */
  port?: number;
  /** Heartbeat interval in milliseconds (default: 30000) */
  heartbeatInterval?: number;
}

/**
 * Internal metadata tracked for each connected client.
 */
export interface ClientInfo {
  /** Unique client identifier */
  id: string;
  /** Set of topics the client is subscribed to */
  topics: Set<string>;
  /** Timestamp of the last received heartbeat response */
  lastHeartbeat: number;
}
