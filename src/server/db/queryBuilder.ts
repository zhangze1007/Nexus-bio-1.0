/**
 * Parameterized SQL Query Builder
 *
 * Pure TypeScript query builder that generates parameterized SQL strings
 * compatible with the DatabaseAdapter / @libsql/client interface.
 *
 * Supports: where clauses (eq, neq, gt, lt, gte, lte, like, in, isNull, isNotNull),
 * ordering, pagination (limit/offset), and joins (inner, left, right, cross).
 *
 * Usage:
 *   const { sql, params } = buildSelect('users', {
 *     where: { eq: { status: 'active' }, gt: { age: 18 } },
 *     orderBy: [{ column: 'created_at', direction: 'DESC' }],
 *     limit: 10,
 *     offset: 20,
 *   });
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Output of every builder function. */
export interface QueryResult {
  /** SQL string with `?` placeholders for positional parameters. */
  sql: string;
  /** Ordered parameter values matching the placeholders. */
  params: unknown[];
}

/** Supported comparison operators for where clauses. */
export interface WhereConditions {
  /** Column equals value (`=`). */
  eq?: Record<string, unknown>;
  /** Column does not equal value (`<>`). */
  neq?: Record<string, unknown>;
  /** Column greater than value (`>`). */
  gt?: Record<string, unknown>;
  /** Column greater than or equal value (`>=`). */
  gte?: Record<string, unknown>;
  /** Column less than value (`<`). */
  lt?: Record<string, unknown>;
  /** Column less than or equal value (`<=`). */
  lte?: Record<string, unknown>;
  /** Column LIKE value (SQL LIKE, case-sensitive). */
  like?: Record<string, string>;
  /** Column IN list. */
  in?: Record<string, unknown[]>;
  /** Column IS NULL (true = IS NULL, false = IS NOT NULL). */
  isNull?: Record<string, boolean>;
}

export type SortDirection = "ASC" | "DESC";

export interface OrderByClause {
  column: string;
  direction?: SortDirection;
}

export type JoinType = "INNER" | "LEFT" | "RIGHT" | "CROSS";

export interface JoinClause {
  type: JoinType;
  table: string;
  /** The "left" column (from the main table or a previous join). */
  onLeft: string;
  /** The "right" column (from the joined table). */
  onRight: string;
}

export interface SelectOptions {
  /** Columns to select. Defaults to `*`. */
  columns?: string[];
  /** Where conditions combined with AND. */
  where?: WhereConditions;
  /** ORDER BY clauses (applied in array order). */
  orderBy?: OrderByClause[];
  /** Maximum rows to return (LIMIT). */
  limit?: number;
  /** Rows to skip (OFFSET). Requires `limit`. */
  offset?: number;
  /** Join clauses. */
  joins?: JoinClause[];
  /** Add DISTINCT. */
  distinct?: boolean;
  /** Column to GROUP BY. */
  groupBy?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Quote an identifier (table or column name) with double quotes.
 * This prevents SQL injection from user-supplied identifiers and handles
 * reserved-word conflicts. Double-quote escaping is standard SQL and also
 * works in SQLite.
 */
function qid(name: string): string {
  // Disallow obviously malicious input
  if (name.includes(";") || name.includes("--") || name.includes("/*")) {
    throw new Error(`Invalid identifier: ${name}`);
  }
  return `"${name}"`;
}

/**
 * Build WHERE clause fragments from a WhereConditions object.
 * Returns [sqlFragment, params] where sqlFragment is the text after "WHERE "
 * (or an empty string if no conditions are provided).
 */
function buildWhere(conditions: WhereConditions): [string, unknown[]] {
  const clauses: string[] = [];
  const params: unknown[] = [];

  // Operator map: key -> SQL operator (or special handler)
  const operators: Array<{ key: keyof WhereConditions; handler: (col: string, val: unknown) => void }> = [
    {
      key: "eq",
      handler: (col, val) => {
        clauses.push(`${qid(col)} = ?`);
        params.push(val);
      },
    },
    {
      key: "neq",
      handler: (col, val) => {
        clauses.push(`${qid(col)} <> ?`);
        params.push(val);
      },
    },
    {
      key: "gt",
      handler: (col, val) => {
        clauses.push(`${qid(col)} > ?`);
        params.push(val);
      },
    },
    {
      key: "gte",
      handler: (col, val) => {
        clauses.push(`${qid(col)} >= ?`);
        params.push(val);
      },
    },
    {
      key: "lt",
      handler: (col, val) => {
        clauses.push(`${qid(col)} < ?`);
        params.push(val);
      },
    },
    {
      key: "lte",
      handler: (col, val) => {
        clauses.push(`${qid(col)} <= ?`);
        params.push(val);
      },
    },
    {
      key: "like",
      handler: (col, val) => {
        clauses.push(`${qid(col)} LIKE ?`);
        params.push(val);
      },
    },
    {
      key: "in",
      handler: (col, val) => {
        const vals = val as unknown[];
        if (!Array.isArray(vals) || vals.length === 0) {
          clauses.push("0");
        } else {
          const placeholders = vals.map(() => "?").join(", ");
          clauses.push(`${qid(col)} IN (${placeholders})`);
          params.push(...vals);
        }
      },
    },
    {
      key: "isNull",
      handler: (col, val) => {
        const shouldBeNull = val as boolean;
        clauses.push(`${qid(col)} ${shouldBeNull ? "IS NULL" : "IS NOT NULL"}`);
      },
    },
  ];

  for (const { key, handler } of operators) {
    const record = conditions[key];
    if (record) {
      for (const [col, val] of Object.entries(record)) {
        validateColumn(col);
        handler(col, val);
      }
    }
  }

  return [clauses.join(" AND "), params];
}

/**
 * Validate that a string looks like a safe column name (letters, digits, underscores, dots).
 * The dot is allowed for qualified references like `table.column`.
 */
function isValidColumn(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(name) && !name.includes(" ");
}

function validateColumn(name: string): void {
  if (!isValidColumn(name)) {
    throw new Error(`Invalid column name: ${name}`);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a SELECT query.
 *
 * @example
 * ```ts
 * const { sql, params } = buildSelect('users', {
 *   columns: ['id', 'name', 'email'],
 *   where: { eq: { status: 'active' }, gt: { age: 18 } },
 *   orderBy: [{ column: 'created_at', direction: 'DESC' }],
 *   joins: [{ type: 'LEFT', table: 'profiles', onLeft: 'users.id', onRight: 'profiles.user_id' }],
 *   limit: 10,
 *   offset: 20,
 * });
 * ```
 */
export function buildSelect(table: string, options: SelectOptions = {}): QueryResult {
  const params: unknown[] = [];
  const cols = options.distinct ? "DISTINCT " : "";
  const selectCols = options.columns?.length
    ? options.columns
        .map((c) => {
          validateColumn(c);
          return qid(c);
        })
        .join(", ")
    : "*";

  let sql = `SELECT ${cols}${selectCols} FROM ${qid(table)}`;

  // Joins
  if (options.joins?.length) {
    for (const join of options.joins) {
      if (join.type === "CROSS") {
        sql += ` CROSS JOIN ${qid(join.table)}`;
      } else {
        validateColumn(join.onLeft);
        validateColumn(join.onRight);
        sql += ` ${join.type} JOIN ${qid(join.table)} ON ${qid(join.onLeft)} = ${qid(join.onRight)}`;
      }
    }
  }

  // Where
  if (options.where) {
    const [clause, whereParams] = buildWhere(options.where);
    if (clause) {
      sql += ` WHERE ${clause}`;
      params.push(...whereParams);
    }
  }

  // Group By
  if (options.groupBy) {
    validateColumn(options.groupBy);
    sql += ` GROUP BY ${qid(options.groupBy)}`;
  }

  // Order By
  if (options.orderBy?.length) {
    const parts = options.orderBy.map((o) => {
      validateColumn(o.column);
      return `${qid(o.column)} ${o.direction ?? "ASC"}`;
    });
    sql += ` ORDER BY ${parts.join(", ")}`;
  }

  // Limit / Offset
  if (options.limit !== undefined) {
    if (!Number.isInteger(options.limit) || options.limit < 0) {
      throw new Error(`Invalid limit: ${options.limit}`);
    }
    sql += ` LIMIT ?`;
    params.push(options.limit);

    if (options.offset !== undefined) {
      if (!Number.isInteger(options.offset) || options.offset < 0) {
        throw new Error(`Invalid offset: ${options.offset}`);
      }
      sql += ` OFFSET ?`;
      params.push(options.offset);
    }
  }

  return { sql, params };
}

/**
 * Build an INSERT query.
 *
 * @example
 * ```ts
 * const { sql, params } = buildInsert('users', { name: 'Alice', email: 'alice@example.com' });
 * // sql: INSERT INTO "users" ("name", "email") VALUES (?, ?)
 * // params: ['Alice', 'alice@example.com']
 * ```
 */
export function buildInsert(table: string, data: Record<string, unknown>): QueryResult {
  const entries = Object.entries(data);
  if (entries.length === 0) {
    throw new Error("INSERT requires at least one column/value pair");
  }

  const columns = entries
    .map(([col]) => {
      validateColumn(col);
      return qid(col);
    })
    .join(", ");
  const placeholders = entries.map(() => "?").join(", ");
  const params = entries.map(([, val]) => val);

  const sql = `INSERT INTO ${qid(table)} (${columns}) VALUES (${placeholders})`;
  return { sql, params };
}

/**
 * Build an UPDATE query.
 *
 * @example
 * ```ts
 * const { sql, params } = buildUpdate('users', { status: 'inactive' }, { eq: { id: 42 } });
 * // sql: UPDATE "users" SET "status" = ? WHERE "id" = ?
 * // params: ['inactive', 42]
 * ```
 */
export function buildUpdate(table: string, data: Record<string, unknown>, where: WhereConditions): QueryResult {
  const entries = Object.entries(data);
  if (entries.length === 0) {
    throw new Error("UPDATE requires at least one column/value pair for SET");
  }

  const setClauses = entries
    .map(([col]) => {
      validateColumn(col);
      return `${qid(col)} = ?`;
    })
    .join(", ");
  const params: unknown[] = entries.map(([, val]) => val);

  let sql = `UPDATE ${qid(table)} SET ${setClauses}`;

  if (where) {
    const [clause, whereParams] = buildWhere(where);
    if (clause) {
      sql += ` WHERE ${clause}`;
      params.push(...whereParams);
    }
  }

  return { sql, params };
}

/**
 * Build a DELETE query.
 *
 * @example
 * ```ts
 * const { sql, params } = buildDelete('sessions', { lt: { expires_at: Date.now() } });
 * // sql: DELETE FROM "sessions" WHERE "expires_at" < ?
 * // params: [1687800000000]
 * ```
 */
export function buildDelete(table: string, where: WhereConditions): QueryResult {
  const [clause, params] = buildWhere(where);

  let sql = `DELETE FROM ${qid(table)}`;
  if (clause) {
    sql += ` WHERE ${clause}`;
  }

  return { sql, params };
}
