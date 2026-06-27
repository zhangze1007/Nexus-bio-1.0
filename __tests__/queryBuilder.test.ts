/**
 * Tests for src/server/db/queryBuilder.ts
 *
 * Covers: buildSelect, buildInsert, buildUpdate, buildDelete
 * with various where clause operators, joins, ordering, pagination, and error cases.
 */

import {
  buildSelect,
  buildInsert,
  buildUpdate,
  buildDelete,
  type QueryResult,
} from '../src/server/db/queryBuilder';

// ---------------------------------------------------------------------------
// buildSelect
// ---------------------------------------------------------------------------

describe('buildSelect', () => {
  it('generates SELECT * from a table', () => {
    const result = buildSelect('users');
    expect(result.sql).toBe('SELECT * FROM "users"');
    expect(result.params).toEqual([]);
  });

  it('selects specific columns', () => {
    const result = buildSelect('users', { columns: ['id', 'name', 'email'] });
    expect(result.sql).toBe('SELECT "id", "name", "email" FROM "users"');
    expect(result.params).toEqual([]);
  });

  it('applies DISTINCT', () => {
    const result = buildSelect('tags', { columns: ['label'], distinct: true });
    expect(result.sql).toBe('SELECT DISTINCT "label" FROM "tags"');
  });

  it('builds eq where clause', () => {
    const result = buildSelect('users', { where: { eq: { status: 'active' } } });
    expect(result.sql).toBe('SELECT * FROM "users" WHERE "status" = ?');
    expect(result.params).toEqual(['active']);
  });

  it('builds combined where clauses (eq + gt)', () => {
    const result = buildSelect('users', {
      where: { eq: { status: 'active' }, gt: { age: 18 } },
    });
    expect(result.sql).toBe('SELECT * FROM "users" WHERE "status" = ? AND "age" > ?');
    expect(result.params).toEqual(['active', 18]);
  });

  it('supports neq, lt, gte, lte, like operators', () => {
    const result = buildSelect('items', {
      where: {
        neq: { deleted: true },
        lt: { price: 100 },
        gte: { stock: 10 },
        lte: { weight: 50 },
        like: { name: '%widget%' },
      },
    });
    // Operators are emitted in a fixed order: eq, neq, gt, gte, lt, lte, like, in, isNull
    expect(result.sql).toBe(
      'SELECT * FROM "items" WHERE "deleted" <> ? AND "stock" >= ? AND "price" < ? AND "weight" <= ? AND "name" LIKE ?',
    );
    expect(result.params).toEqual([true, 10, 100, 50, '%widget%']);
  });

  it('handles IN with multiple values', () => {
    const result = buildSelect('users', {
      where: { in: { role: ['admin', 'editor', 'viewer'] } },
    });
    expect(result.sql).toBe('SELECT * FROM "users" WHERE "role" IN (?, ?, ?)');
    expect(result.params).toEqual(['admin', 'editor', 'viewer']);
  });

  it('handles IN with empty array as always-false condition', () => {
    const result = buildSelect('users', { where: { in: { role: [] } } });
    expect(result.sql).toBe('SELECT * FROM "users" WHERE 0');
    expect(result.params).toEqual([]);
  });

  it('handles IS NULL / IS NOT NULL', () => {
    const result = buildSelect('users', {
      where: { isNull: { deleted_at: true, email: false } },
    });
    expect(result.sql).toBe('SELECT * FROM "users" WHERE "deleted_at" IS NULL AND "email" IS NOT NULL');
    expect(result.params).toEqual([]);
  });

  it('applies ORDER BY', () => {
    const result = buildSelect('posts', {
      orderBy: [{ column: 'created_at', direction: 'DESC' }, { column: 'title' }],
    });
    expect(result.sql).toBe('SELECT * FROM "posts" ORDER BY "created_at" DESC, "title" ASC');
  });

  it('applies LIMIT and OFFSET', () => {
    const result = buildSelect('posts', { limit: 10, offset: 20 });
    expect(result.sql).toBe('SELECT * FROM "posts" LIMIT ? OFFSET ?');
    expect(result.params).toEqual([10, 20]);
  });

  it('applies LIMIT without OFFSET', () => {
    const result = buildSelect('posts', { limit: 5 });
    expect(result.sql).toBe('SELECT * FROM "posts" LIMIT ?');
    expect(result.params).toEqual([5]);
  });

  it('builds LEFT JOIN', () => {
    const result = buildSelect('users', {
      columns: ['users.id', 'users.name', 'profiles.bio'],
      joins: [{ type: 'LEFT', table: 'profiles', onLeft: 'users.id', onRight: 'profiles.user_id' }],
    });
    expect(result.sql).toBe(
      'SELECT "users.id", "users.name", "profiles.bio" FROM "users" LEFT JOIN "profiles" ON "users.id" = "profiles.user_id"',
    );
  });

  it('builds INNER and CROSS joins', () => {
    const result = buildSelect('orders', {
      joins: [
        { type: 'INNER', table: 'customers', onLeft: 'orders.customer_id', onRight: 'customers.id' },
        { type: 'CROSS', table: 'shipping_options', onLeft: '', onRight: '' },
      ],
    });
    expect(result.sql).toBe(
      'SELECT * FROM "orders" INNER JOIN "customers" ON "orders.customer_id" = "customers.id" CROSS JOIN "shipping_options"',
    );
  });

  it('applies GROUP BY', () => {
    const result = buildSelect('orders', {
      columns: ['status'],
      groupBy: 'status',
    });
    expect(result.sql).toBe('SELECT "status" FROM "orders" GROUP BY "status"');
  });

  it('rejects negative limit', () => {
    expect(() => buildSelect('t', { limit: -1 })).toThrow('Invalid limit');
  });

  it('rejects negative offset', () => {
    expect(() => buildSelect('t', { limit: 10, offset: -5 })).toThrow('Invalid offset');
  });
});

// ---------------------------------------------------------------------------
// buildInsert
// ---------------------------------------------------------------------------

describe('buildInsert', () => {
  it('builds a single-row insert', () => {
    const result = buildInsert('users', { name: 'Alice', email: 'alice@example.com', age: 30 });
    expect(result.sql).toBe('INSERT INTO "users" ("name", "email", "age") VALUES (?, ?, ?)');
    expect(result.params).toEqual(['Alice', 'alice@example.com', 30]);
  });

  it('throws on empty data', () => {
    expect(() => buildInsert('users', {})).toThrow('at least one column');
  });
});

// ---------------------------------------------------------------------------
// buildUpdate
// ---------------------------------------------------------------------------

describe('buildUpdate', () => {
  it('builds an update with where clause', () => {
    const result = buildUpdate('users', { status: 'inactive' }, { eq: { id: 42 } });
    expect(result.sql).toBe('UPDATE "users" SET "status" = ? WHERE "id" = ?');
    expect(result.params).toEqual(['inactive', 42]);
  });

  it('builds an update with multiple set columns and compound where', () => {
    const result = buildUpdate(
      'users',
      { name: 'Bob', email: 'bob@example.com' },
      { eq: { id: 7 }, gt: { version: 3 } },
    );
    expect(result.sql).toBe(
      'UPDATE "users" SET "name" = ?, "email" = ? WHERE "id" = ? AND "version" > ?',
    );
    expect(result.params).toEqual(['Bob', 'bob@example.com', 7, 3]);
  });

  it('throws on empty data', () => {
    expect(() => buildUpdate('users', {}, { eq: { id: 1 } })).toThrow('at least one column');
  });
});

// ---------------------------------------------------------------------------
// buildDelete
// ---------------------------------------------------------------------------

describe('buildDelete', () => {
  it('builds a delete with where clause', () => {
    const result = buildDelete('sessions', { lt: { expires_at: 1000 } });
    expect(result.sql).toBe('DELETE FROM "sessions" WHERE "expires_at" < ?');
    expect(result.params).toEqual([1000]);
  });

  it('builds a delete with IN clause', () => {
    const result = buildDelete('logs', { in: { level: ['debug', 'trace'] } });
    expect(result.sql).toBe('DELETE FROM "logs" WHERE "level" IN (?, ?)');
    expect(result.params).toEqual(['debug', 'trace']);
  });
});

// ---------------------------------------------------------------------------
// Security / edge cases
// ---------------------------------------------------------------------------

describe('identifier validation', () => {
  it('rejects SQL injection in table name', () => {
    expect(() => buildSelect('users; DROP TABLE users')).toThrow('Invalid identifier');
  });

  it('rejects SQL injection in column name', () => {
    expect(() => buildSelect('users', { columns: ['name; --'] })).toThrow('Invalid column');
  });

  it('rejects SQL injection in where column', () => {
    expect(() => buildSelect('users', { where: { eq: { 'id OR 1=1': 1 } } })).toThrow('Invalid column');
  });

  it('produces consistent parameter ordering across multiple operators', () => {
    const result = buildSelect('t', {
      where: { eq: { a: 1 }, like: { b: '%x%' }, gt: { c: 5 } },
    });
    // eq params come first, then gt, then like (insertion order)
    expect(result.params).toEqual([1, 5, '%x%']);
    expect(result.sql).toContain('"a" = ?');
    expect(result.sql).toContain('"c" > ?');
    expect(result.sql).toContain('"b" LIKE ?');
  });
});
