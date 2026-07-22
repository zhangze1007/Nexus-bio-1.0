/**
 * Nexus construct ↔ LIMS entity mapping. Written when a sample/order is created
 * so pulled assay results can be joined back to the design that produced them.
 * In-memory store with injectable persistence hooks (kept dependency-free for
 * tests; the app can wire a durable backing store via {@link setEntityLinkStore}).
 */

export interface EntityLink {
  nexusConstructId: string;
  /** externalId in the LIMS. */
  limsEntityId: string;
  limsType: "strain" | "plasmid" | "sample";
  linkedAt: string;
}

export interface EntityLinkStore {
  get(limsEntityId: string): EntityLink | undefined;
  set(link: EntityLink): void;
  values(): EntityLink[];
  clear(): void;
}

function createMemoryStore(): EntityLinkStore {
  const map = new Map<string, EntityLink>();
  return {
    get: (id) => map.get(id),
    set: (link) => {
      map.set(link.limsEntityId, link);
    },
    values: () => [...map.values()],
    clear: () => map.clear(),
  };
}

let store: EntityLinkStore = createMemoryStore();

/** Swap the backing store (e.g. a durable ledger). Replaces all in-memory links. */
export function setEntityLinkStore(next: EntityLinkStore): void {
  store = next;
}

export function upsertEntityLink(link: EntityLink): void {
  store.set(link);
}

/** Resolve a LIMS externalId to its Nexus constructId (undefined if unmapped). */
export function resolveConstructId(limsEntityId: string): string | undefined {
  return store.get(limsEntityId)?.nexusConstructId;
}

export function allEntityLinks(): EntityLink[] {
  return store.values();
}

/** Test/reset helper. */
export function clearEntityLinks(): void {
  store.clear();
}
