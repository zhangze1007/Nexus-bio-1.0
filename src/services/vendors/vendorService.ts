/**
 * Vendor Integration Service
 *
 * Provides search and order management for external biology vendors
 * (Addgene, IDT). Uses libsql for persistent order storage.
 */

import { randomUUID } from 'node:crypto';
import { sqlAll, sqlGet, sqlRun } from '../../server/libsqlDb';

// ── Types ──

export interface VendorPlasmid {
  id: number;
  name: string;
  depositor: string;
  purpose: string | null;
  insert: string | null;
  expression: string | null;
  promoter: string | null;
  url: string;
  availability: string | null;
}

export interface VendorQuoteItem {
  sequence: string;
  length: number;
  scale: string;
  modifications: string[];
  unitPriceCents: number;
  estimatedDays: number;
}

export interface VendorQuote {
  vendor: 'idt';
  items: VendorQuoteItem[];
  totalCents: number;
  currency: string;
  validUntil: string;
}

export type OrderStatusValue = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderStatus {
  id: string;
  vendor: string;
  items: VendorOrderItem[];
  status: OrderStatusValue;
  totalCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface VendorOrderItem {
  name: string;
  quantity: number;
  unitPriceCents: number;
}

// ── Schema ──

const VENDOR_ORDERS_DDL = `
  CREATE TABLE IF NOT EXISTS vendor_orders (
    id TEXT PRIMARY KEY,
    vendor TEXT NOT NULL,
    items_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    total_cents INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

export async function initVendorSchema(): Promise<void> {
  // PRAGMA journal_mode cannot run inside a batch transaction, so run it separately.
  await sqlRun('PRAGMA journal_mode = WAL').catch(() => {});
  await sqlRun(VENDOR_ORDERS_DDL);
}

// ── Addgene Search ──

const ADDGENE_SEARCH_URL = 'https://www.addgene.org/search/catalog/plasmids/';

/**
 * Search Addgene's plasmid catalog.
 * Fetches results from the Addgene search API and normalizes them
 * into VendorPlasmid objects. Returns an empty array on API failure
 * so callers never crash.
 */
export async function searchAddgene(query: string): Promise<VendorPlasmid[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const url = `${ADDGENE_SEARCH_URL}?q=${encodeURIComponent(query.trim())}&format=json`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // Network failure — return empty rather than crash
    return [];
  }

  if (!response.ok) {
    return [];
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    // Non-JSON response (Addgene sometimes returns HTML)
    return [];
  }

  return normalizeAddgeneResponse(data);
}

function normalizeAddgeneResponse(data: unknown): VendorPlasmid[] {
  if (!data || typeof data !== 'object') return [];

  const record = data as Record<string, unknown>;
  const results = record.results ?? record.objects;

  if (!Array.isArray(results)) return [];

  return results
    .filter((r): r is Record<string, unknown> => r !== null && typeof r === 'object')
    .map((r) => ({
      id: typeof r.id === 'number' ? r.id : 0,
      name: typeof r.name === 'string' ? r.name : 'Unknown',
      depositor: typeof r.depositor === 'string' ? r.depositor : 'Unknown',
      purpose: typeof r.purpose === 'string' ? r.purpose : null,
      insert: typeof r.insert === 'string' ? r.insert : null,
      expression: typeof r.expression === 'string' ? r.expression : null,
      promoter: typeof r.promoter === 'string' ? r.promoter : null,
      url: typeof r.url === 'string' ? `https://www.addgene.org${r.url}` : '',
      availability: typeof r.availability === 'string' ? r.availability : null,
    }))
    .filter((p) => p.id > 0);
}

// ── IDT Quote Estimation ──

const BASE_PRICE_PER_BASE_CENTS = 15;
const MIN_OLIGO_PRICE_CENTS = 500;
const MODIFICATION_PRICE_CENTS = 200;

const KNOWN_MODIFICATIONS = [
  'phosphorothioate',
  'biotin',
  'fluorescent',
  'amine',
  'thiol',
  'methyl',
  'deoxyuridine',
];

/**
 * Generate a cost estimate for ordering DNA sequences from IDT.
 * Uses a length-based pricing model with modification surcharges.
 */
export async function searchIDT(sequences: string[]): Promise<VendorQuote> {
  if (!sequences || sequences.length === 0) {
    return {
      vendor: 'idt',
      items: [],
      totalCents: 0,
      currency: 'USD',
      validUntil: futureDate(7),
    };
  }

  let totalCents = 0;
  const items: VendorQuoteItem[] = sequences.map((seq) => {
    const cleanSeq = seq.trim().toUpperCase();
    const length = cleanSeq.length;

    // Detect modifications from sequence annotations (e.g., /biotin/ prefix)
    const modifications: string[] = [];
    for (const mod of KNOWN_MODIFICATIONS) {
      if (cleanSeq.includes(mod.toUpperCase())) {
        modifications.push(mod);
      }
    }

    const basePrice = Math.max(MIN_OLIGO_PRICE_CENTS, length * BASE_PRICE_PER_BASE_CENTS);
    const modPrice = modifications.length * MODIFICATION_PRICE_CENTS;
    const unitPriceCents = basePrice + modPrice;
    totalCents += unitPriceCents;

    const scale = length > 200 ? '25nm' : length > 60 ? '100nm' : '25nm';

    return {
      sequence: cleanSeq.slice(0, 20) + (cleanSeq.length > 20 ? '...' : ''),
      length,
      scale,
      modifications,
      unitPriceCents,
      estimatedDays: length > 150 ? 10 : length > 60 ? 7 : 5,
    };
  });

  return {
    vendor: 'idt',
    items,
    totalCents,
    currency: 'USD',
    validUntil: futureDate(7),
  };
}

function futureDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString();
}

// ── Order CRUD ──

/**
 * Create a new vendor order in the database.
 */
export async function createOrder(
  vendor: string,
  items: VendorOrderItem[],
  totalCents: number,
): Promise<OrderStatus> {
  const id = randomUUID();
  const now = new Date().toISOString();
  const itemsJson = JSON.stringify(items);

  await sqlRun(
    `INSERT INTO vendor_orders (id, vendor, items_json, status, total_cents, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', ?, ?, ?)`,
    [id, vendor, itemsJson, totalCents, now, now],
  );

  return {
    id,
    vendor,
    items,
    status: 'pending',
    totalCents,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get a single order by ID.
 */
export async function getOrderStatus(orderId: string): Promise<OrderStatus | null> {
  if (!orderId || orderId.trim().length === 0) return null;

  const row = await sqlGet(
    'SELECT * FROM vendor_orders WHERE id = ?',
    [orderId.trim()],
  );

  if (!row) return null;
  return rowToOrder(row);
}

/**
 * List all orders, most recent first.
 */
export async function listOrders(limit = 50): Promise<OrderStatus[]> {
  const rows = await sqlAll(
    'SELECT * FROM vendor_orders ORDER BY created_at DESC LIMIT ?',
    [Math.min(limit, 200)],
  );
  return rows.map(rowToOrder);
}

function rowToOrder(row: Record<string, unknown>): OrderStatus {
  let items: VendorOrderItem[] = [];
  try {
    const parsed = JSON.parse(row.items_json as string);
    if (Array.isArray(parsed)) items = parsed;
  } catch {
    // malformed JSON — return empty items
  }

  return {
    id: row.id as string,
    vendor: row.vendor as string,
    items,
    status: (row.status as OrderStatusValue) ?? 'pending',
    totalCents: Number(row.total_cents ?? 0),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
