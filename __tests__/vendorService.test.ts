/** @jest-environment node */

import {
  searchAddgene,
  searchIDT,
  createOrder,
  getOrderStatus,
  listOrders,
  initVendorSchema,
  type VendorPlasmid,
} from '../src/services/vendors/vendorService';
import { sqlRun, sqlAll, closeLibsqlClient } from '../src/server/libsqlDb';

// ── Cleanup ──

afterAll(() => {
  closeLibsqlClient();
});

beforeEach(async () => {
  await initVendorSchema();
  await sqlRun('DELETE FROM vendor_orders').catch(() => {});
});

// ── Addgene Search ──

describe('searchAddgene', () => {
  it('returns empty array for empty query', async () => {
    expect(await searchAddgene('')).toEqual([]);
    expect(await searchAddgene('   ')).toEqual([]);
  });

  it('returns empty array when fetch fails', async () => {
    const original = global.fetch;
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));
    try {
      const results = await searchAddgene('GFP');
      expect(results).toEqual([]);
    } finally {
      global.fetch = original;
    }
  });

  it('returns empty array on non-200 response', async () => {
    const original = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    try {
      const results = await searchAddgene('GFP');
      expect(results).toEqual([]);
    } finally {
      global.fetch = original;
    }
  });

  it('returns empty array on non-JSON response', async () => {
    const original = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new SyntaxError('not json')),
    });
    try {
      const results = await searchAddgene('GFP');
      expect(results).toEqual([]);
    } finally {
      global.fetch = original;
    }
  });

  it('normalizes Addgene API response with results field', async () => {
    const mockResponse = {
      total_results: 2,
      results: [
        {
          id: 13770,
          name: 'pCALNL-GFP',
          depositor: 'Connie Cepko',
          purpose: 'Cre/Lox expression',
          insert: 'EGFP',
          expression: 'Mammalian',
          promoter: 'CAG',
          url: '/13770/',
          availability: 'Academic only',
        },
        {
          id: 22222,
          name: 'pCMV-GFP',
          depositor: 'Test Lab',
          purpose: null,
          insert: null,
          expression: null,
          promoter: null,
          url: '/22222/',
          availability: null,
        },
      ],
    };

    const original = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });
    try {
      const results = await searchAddgene('GFP');
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe(13770);
      expect(results[0].name).toBe('pCALNL-GFP');
      expect(results[0].depositor).toBe('Connie Cepko');
      expect(results[0].url).toBe('https://www.addgene.org/13770/');
      expect(results[1].purpose).toBeNull();
    } finally {
      global.fetch = original;
    }
  });

  it('normalizes response using objects field as fallback', async () => {
    const mockResponse = {
      objects: [
        { id: 99, name: 'pTest', depositor: 'X', url: '/99/' },
      ],
    };

    const original = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });
    try {
      const results = await searchAddgene('test');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(99);
    } finally {
      global.fetch = original;
    }
  });

  it('filters out entries with id=0 or non-objects', async () => {
    const mockResponse = {
      results: [
        { id: 0, name: 'bad', url: '/' },
        null,
        { id: 5, name: 'good', depositor: 'A', url: '/5/' },
        'invalid',
      ],
    };

    const original = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });
    try {
      const results = await searchAddgene('x');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(5);
    } finally {
      global.fetch = original;
    }
  });
});

// ── IDT Quote ──

describe('searchIDT', () => {
  it('returns empty quote for empty input', async () => {
    const quote = await searchIDT([]);
    expect(quote.items).toEqual([]);
    expect(quote.totalCents).toBe(0);
    expect(quote.vendor).toBe('idt');
    expect(quote.currency).toBe('USD');
  });

  it('computes price based on sequence length', async () => {
    const quote = await searchIDT(['ATCGATCG']); // 8 bases
    expect(quote.items).toHaveLength(1);
    // 8 * 15 = 120, but minimum is 500
    expect(quote.items[0].unitPriceCents).toBe(500);
    expect(quote.totalCents).toBe(500);
    expect(quote.items[0].length).toBe(8);
  });

  it('charges per-base for longer sequences', async () => {
    const longSeq = 'A'.repeat(100); // 100 bases
    const quote = await searchIDT([longSeq]);
    expect(quote.items[0].unitPriceCents).toBe(1500); // 100 * 15
    expect(quote.items[0].scale).toBe('100nm'); // 60 < length <= 200
    expect(quote.items[0].estimatedDays).toBe(7); // 60 < length <= 150
  });

  it('detects modifications in sequence', async () => {
    const quote = await searchIDT(['ATCG/biotin/GCTA']);
    expect(quote.items[0].modifications).toContain('biotin');
    // 4 bases * 15 = 60 -> min 500, plus 200 for biotin = 700
    expect(quote.items[0].unitPriceCents).toBe(700);
  });

  it('handles multiple sequences', async () => {
    const quote = await searchIDT(['ATCG', 'GCTAGCTAGCTA']);
    expect(quote.items).toHaveLength(2);
    expect(quote.totalCents).toBe(
      quote.items[0].unitPriceCents + quote.items[1].unitPriceCents,
    );
  });

  it('assigns longer estimated days for long oligos', async () => {
    const veryLong = 'A'.repeat(200);
    const quote = await searchIDT([veryLong]);
    expect(quote.items[0].estimatedDays).toBe(10);
    expect(quote.items[0].scale).toBe('100nm'); // length=200 is not > 200
  });

  it('sets validUntil roughly 7 days in the future', async () => {
    const quote = await searchIDT(['ATCG']);
    const valid = new Date(quote.validUntil);
    const now = new Date();
    const diffDays = (valid.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(6);
    expect(diffDays).toBeLessThan(8);
  });
});

// ── Order CRUD ──

describe('createOrder', () => {
  it('creates an order and returns correct shape', async () => {
    const items = [
      { name: 'pUC19', quantity: 2, unitPriceCents: 6500 },
      { name: 'pBR322', quantity: 1, unitPriceCents: 7200 },
    ];
    const order = await createOrder('addgene', items, 20200);

    expect(order.id).toBeDefined();
    expect(order.vendor).toBe('addgene');
    expect(order.items).toEqual(items);
    expect(order.status).toBe('pending');
    expect(order.totalCents).toBe(20200);
    expect(order.createdAt).toBeDefined();
    expect(order.updatedAt).toBeDefined();
  });

  it('persists order to database', async () => {
    const order = await createOrder('idt', [{ name: 'oligo1', quantity: 5, unitPriceCents: 500 }], 2500);

    const rows = await sqlAll('SELECT * FROM vendor_orders WHERE id = ?', [order.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0].vendor).toBe('idt');
    expect(rows[0].total_cents).toBe(2500);
    expect(rows[0].status).toBe('pending');
  });
});

describe('getOrderStatus', () => {
  it('returns null for non-existent order', async () => {
    expect(await getOrderStatus('non-existent-id')).toBeNull();
  });

  it('returns null for empty string', async () => {
    expect(await getOrderStatus('')).toBeNull();
  });

  it('retrieves an existing order by ID', async () => {
    const created = await createOrder('addgene', [{ name: 'plasmid1', quantity: 1, unitPriceCents: 8000 }], 8000);
    const fetched = await getOrderStatus(created.id);

    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(created.id);
    expect(fetched!.vendor).toBe('addgene');
    expect(fetched!.items).toHaveLength(1);
    expect(fetched!.items[0].name).toBe('plasmid1');
    expect(fetched!.totalCents).toBe(8000);
  });

  it('handles malformed items_json gracefully', async () => {
    // Insert a row with invalid JSON
    await sqlRun(
      `INSERT INTO vendor_orders (id, vendor, items_json, status, total_cents, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['bad-json-id', 'test', 'not-valid-json{', 'pending', 0, '2025-01-01', '2025-01-01'],
    );

    const order = await getOrderStatus('bad-json-id');
    expect(order).not.toBeNull();
    expect(order!.items).toEqual([]);
  });
});

describe('listOrders', () => {
  it('returns empty array when no orders exist', async () => {
    const orders = await listOrders();
    expect(orders).toEqual([]);
  });

  it('returns orders sorted by created_at descending', async () => {
    // Insert orders with explicit timestamps to guarantee ordering
    await sqlRun(
      `INSERT INTO vendor_orders (id, vendor, items_json, status, total_cents, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['ord-1', 'addgene', JSON.stringify([{ name: 'first', quantity: 1, unitPriceCents: 100 }]), 'pending', 100, '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z'],
    );
    await sqlRun(
      `INSERT INTO vendor_orders (id, vendor, items_json, status, total_cents, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['ord-2', 'idt', JSON.stringify([{ name: 'second', quantity: 1, unitPriceCents: 200 }]), 'pending', 200, '2025-06-01T00:00:00Z', '2025-06-01T00:00:00Z'],
    );

    const orders = await listOrders();
    expect(orders).toHaveLength(2);
    // Most recent first
    expect(orders[0].items[0].name).toBe('second');
    expect(orders[1].items[0].name).toBe('first');
  });

  it('respects limit parameter', async () => {
    for (let i = 0; i < 5; i++) {
      await createOrder('test', [{ name: `item-${i}`, quantity: 1, unitPriceCents: 100 }], 100);
    }

    const orders = await listOrders(3);
    expect(orders).toHaveLength(3);
  });
});

describe('initVendorSchema', () => {
  it('creates vendor_orders table without error', async () => {
    // Calling twice should not throw (idempotent)
    await expect(initVendorSchema()).resolves.not.toThrow();
  });
});
