/**
 * Real-time sync service for project collaboration.
 *
 * Uses an in-process EventEmitter pattern — no external dependencies.
 * Channels are keyed by projectId so every collaborator on the same
 * project shares a single channel instance.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface Change {
  /** Kind of mutation (e.g. "node:add", "edge:update", "annotation:delete"). */
  type: string;
  /** ID of the entity that was changed. */
  entityId: string;
  /** Arbitrary payload describing the change. */
  data: unknown;
  /** Identifier of the user who made the change. */
  userId: string;
  /** ISO-8601 timestamp of when the change occurred. */
  timestamp: string;
}

export type ChangeCallback = (change: Change) => void;

/** Returned by subscribeToChanges — call it to unsubscribe. */
export type Unsubscribe = () => void;

export interface SyncChannel {
  /** Unique channel identifier. */
  id: string;
  /** The project this channel is scoped to. */
  projectId: string;
  /** Current number of active subscribers. */
  subscribers: number;
}

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

interface InternalChannel {
  id: string;
  projectId: string;
  listeners: Map<string, Set<ChangeCallback>>;
}

/** Global registry so channels survive hot-reloads in dev. */
interface GlobalWithSyncChannels {
  __NX_SYNC_CHANNELS__?: Map<string, InternalChannel>;
}
const g = globalThis as GlobalWithSyncChannels;
const channels: Map<string, InternalChannel> =
  g.__NX_SYNC_CHANNELS__ ??
  (g.__NX_SYNC_CHANNELS__ = new Map());

function getOrCreateChannel(projectId: string): InternalChannel {
  const existing = channels.get(projectId);
  if (existing) return existing;

  const channel: InternalChannel = {
    id: `sync:${projectId}`,
    projectId,
    listeners: new Map(),
  };
  channels.set(projectId, channel);
  return channel;
}

function totalSubscribers(channel: InternalChannel): number {
  let count = 0;
  for (const set of channel.listeners.values()) {
    count += set.size;
  }
  return count;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Create (or retrieve) a sync channel for the given project.
 * Channels are singletons per projectId — calling this twice with
 * the same id returns the same channel object.
 */
export function createSyncChannel(projectId: string): SyncChannel {
  if (!projectId) throw new Error("projectId is required");

  const ch = getOrCreateChannel(projectId);

  return Object.freeze({
    id: ch.id,
    projectId: ch.projectId,
    subscribers: totalSubscribers(ch),
  });
}

/**
 * Broadcast a change to every listener on the channel identified by
 * `channelId` (which is `"sync:<projectId>"`).
 *
 * The change is enriched with a `timestamp` if one is not already set.
 */
export function broadcastChange(channelId: string, change: Change): void {
  if (!channelId) throw new Error("channelId is required");
  if (!change) throw new Error("change is required");

  // Find channel by id
  let target: InternalChannel | undefined;
  for (const ch of channels.values()) {
    if (ch.id === channelId) {
      target = ch;
      break;
    }
  }
  if (!target) throw new Error(`Channel not found: ${channelId}`);

  // Ensure timestamp
  const stamped: Change = {
    ...change,
    timestamp: change.timestamp ?? new Date().toISOString(),
  };

  // Collect all listeners across all entity types
  const allCallbacks: ChangeCallback[] = [];
  for (const set of target.listeners.values()) {
    for (const cb of set) {
      allCallbacks.push(cb);
    }
  }

  // Dispatch synchronously (microtask would also work, but sync is
  // simpler to test and matches EventEmitter semantics).
  for (const cb of allCallbacks) {
    try {
      cb(stamped);
    } catch {
      // Swallow — one bad listener must not break others.
    }
  }
}

/**
 * Subscribe to changes on the channel for `channelId`.
 *
 * Optionally pass an `entityId` filter so the callback only fires for
 * changes whose `entityId` matches.
 *
 * Returns an `Unsubscribe` function.
 */
export function subscribeToChanges(
  channelId: string,
  callback: ChangeCallback,
  entityId?: string,
): Unsubscribe {
  if (!channelId) throw new Error("channelId is required");
  if (typeof callback !== "function")
    throw new Error("callback must be a function");

  // Find channel by id
  let target: InternalChannel | undefined;
  for (const ch of channels.values()) {
    if (ch.id === channelId) {
      target = ch;
      break;
    }
  }
  if (!target) throw new Error(`Channel not found: ${channelId}`);

  const key = entityId ?? "*";

  if (!target.listeners.has(key)) {
    target.listeners.set(key, new Set());
  }
  target.listeners.get(key)!.add(callback);

  // Return unsubscribe handle
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    const set = target!.listeners.get(key);
    if (set) {
      set.delete(callback);
      if (set.size === 0) target!.listeners.delete(key);
    }
  };
}

/* ------------------------------------------------------------------ */
/*  Test helpers (no-ops in production but safe to import anywhere)    */
/* ------------------------------------------------------------------ */

/** Remove all channels and listeners. Only meaningful in tests. */
export function __resetSync(): void {
  channels.clear();
}
