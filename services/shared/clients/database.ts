/**
 * PostgreSQL Database Client
 *
 * Drop-in replacement for the Supabase client. Provides a QueryBuilder
 * with a Supabase-compatible chaining API so service code changes are
 * minimal (change import + add .execute()).
 *
 * Before: supabase.from('customers').select('*').eq('id', id).single()
 * After:  db.from('customers').select('*').eq('id', id).single().execute()
 */

import { Pool, PoolConfig } from 'pg';
import { getSecret } from '../utils/secrets';

let pool: Pool | null = null;

interface DBSecret {
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
}

async function getPool(): Promise<Pool> {
  if (pool) return pool;

  const secretName = process.env.DB_SECRET_NAME;
  if (!secretName) {
    throw new Error('DB_SECRET_NAME environment variable is not set');
  }

  const secret = (await getSecret(secretName)) as unknown as DBSecret;

  const config: PoolConfig = {
    host: secret.host,
    port: parseInt(secret.port || '5432'),
    database: secret.database,
    user: secret.username,
    password: secret.password,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 5000,
  };

  pool = new Pool(config);
  return pool;
}

/**
 * Query builder that provides a Supabase-like interface.
 * Minimizes code changes across services.
 */
export class QueryBuilder<T = Record<string, unknown>> {
  private table: string;
  private selectClause = '*';
  private whereClauses: string[] = [];
  private whereParams: unknown[] = [];
  private orderClause = '';
  private limitClause = '';
  private offsetClause = '';
  private operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT' = 'SELECT';
  private insertData: Record<string, unknown> | Record<string, unknown>[] | null = null;
  private updateData: Record<string, unknown> | null = null;
  private upsertConflictColumn = 'id';
  private returnSingle = false;
  private countOnly = false;

  constructor(table: string) {
    this.table = table;
  }

  select(columns = '*'): this {
    this.selectClause = columns;
    this.operation = 'SELECT';
    return this;
  }

  insert(data: Record<string, unknown> | Record<string, unknown>[]): this {
    this.operation = 'INSERT';
    this.insertData = data;
    return this;
  }

  update(data: Record<string, unknown>): this {
    this.operation = 'UPDATE';
    this.updateData = data;
    return this;
  }

  delete(): this {
    this.operation = 'DELETE';
    return this;
  }

  upsert(data: Record<string, unknown>, options?: { onConflict?: string }): this {
    this.operation = 'UPSERT';
    this.insertData = data;
    if (options?.onConflict) {
      this.upsertConflictColumn = options.onConflict;
    }
    return this;
  }

  eq(column: string, value: unknown): this {
    this.whereParams.push(value);
    this.whereClauses.push(`${column} = $${this.whereParams.length}`);
    return this;
  }

  neq(column: string, value: unknown): this {
    this.whereParams.push(value);
    this.whereClauses.push(`${column} != $${this.whereParams.length}`);
    return this;
  }

  gt(column: string, value: unknown): this {
    this.whereParams.push(value);
    this.whereClauses.push(`${column} > $${this.whereParams.length}`);
    return this;
  }

  gte(column: string, value: unknown): this {
    this.whereParams.push(value);
    this.whereClauses.push(`${column} >= $${this.whereParams.length}`);
    return this;
  }

  lt(column: string, value: unknown): this {
    this.whereParams.push(value);
    this.whereClauses.push(`${column} < $${this.whereParams.length}`);
    return this;
  }

  lte(column: string, value: unknown): this {
    this.whereParams.push(value);
    this.whereClauses.push(`${column} <= $${this.whereParams.length}`);
    return this;
  }

  in(column: string, values: unknown[]): this {
    const placeholders = values.map((v) => {
      this.whereParams.push(v);
      return `$${this.whereParams.length}`;
    });
    this.whereClauses.push(`${column} IN (${placeholders.join(', ')})`);
    return this;
  }

  not(column: string, operator: string, value: unknown): this {
    this.whereParams.push(value);
    this.whereClauses.push(`NOT (${column} ${operator} $${this.whereParams.length})`);
    return this;
  }

  is(column: string, value: null | boolean): this {
    if (value === null) {
      this.whereClauses.push(`${column} IS NULL`);
    } else {
      this.whereClauses.push(`${column} IS ${value ? 'TRUE' : 'FALSE'}`);
    }
    return this;
  }

  like(column: string, pattern: string): this {
    this.whereParams.push(pattern);
    this.whereClauses.push(`${column} LIKE $${this.whereParams.length}`);
    return this;
  }

  ilike(column: string, pattern: string): this {
    this.whereParams.push(pattern);
    this.whereClauses.push(`${column} ILIKE $${this.whereParams.length}`);
    return this;
  }

  or(conditions: string): this {
    this.whereClauses.push(`(${conditions})`);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    const dir = options?.ascending === false ? 'DESC' : 'ASC';
    if (this.orderClause) {
      this.orderClause += `, ${column} ${dir}`;
    } else {
      this.orderClause = ` ORDER BY ${column} ${dir}`;
    }
    return this;
  }

  limit(count: number): this {
    this.limitClause = ` LIMIT ${count}`;
    return this;
  }

  offset(count: number): this {
    this.offsetClause = ` OFFSET ${count}`;
    return this;
  }

  range(from: number, to: number): this {
    this.limitClause = ` LIMIT ${to - from + 1}`;
    this.offsetClause = ` OFFSET ${from}`;
    return this;
  }

  single(): this {
    this.returnSingle = true;
    this.limitClause = ' LIMIT 1';
    return this;
  }

  maybeSingle(): this {
    this.returnSingle = true;
    this.limitClause = ' LIMIT 1';
    return this;
  }

  /**
   * Return count instead of rows. Mirrors Supabase's
   * .select('*', { count: 'exact' }) pattern.
   */
  count(): this {
    this.countOnly = true;
    return this;
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  async execute(): Promise<{ data: any; error: Error | null; count?: number }> {
    try {
      const p = await getPool();
      const where = this.whereClauses.length > 0
        ? ` WHERE ${this.whereClauses.join(' AND ')}`
        : '';
      let sql: string;
      let params: unknown[];

      switch (this.operation) {
        case 'SELECT': {
          if (this.countOnly) {
            sql = `SELECT COUNT(*) as count FROM ${this.table}${where}`;
            params = this.whereParams;
            const result = await p.query(sql, params);
            return { data: null, error: null, count: parseInt(result.rows[0].count) };
          }
          sql = `SELECT ${this.selectClause} FROM ${this.table}${where}${this.orderClause}${this.limitClause}${this.offsetClause}`;
          params = this.whereParams;
          break;
        }

        case 'INSERT': {
          const rows = Array.isArray(this.insertData) ? this.insertData : [this.insertData!];
          const keys = Object.keys(rows[0]);
          const allParams: unknown[] = [];
          const valueGroups: string[] = [];

          for (const row of rows) {
            const placeholders = keys.map((k) => {
              allParams.push(row[k]);
              return `$${allParams.length}`;
            });
            valueGroups.push(`(${placeholders.join(', ')})`);
          }

          sql = `INSERT INTO ${this.table} (${keys.join(', ')}) VALUES ${valueGroups.join(', ')} RETURNING *`;
          params = allParams;
          break;
        }

        case 'UPDATE': {
          const setClauses: string[] = [];
          const allParams: unknown[] = [];
          let idx = 1;
          for (const [key, val] of Object.entries(this.updateData!)) {
            setClauses.push(`${key} = $${idx++}`);
            allParams.push(val);
          }
          const adjustedWhere = this.whereClauses.map((clause) => {
            return clause.replace(/\$(\d+)/g, () => `$${idx++}`);
          });
          allParams.push(...this.whereParams);
          const whereStr = adjustedWhere.length > 0
            ? ` WHERE ${adjustedWhere.join(' AND ')}`
            : '';
          sql = `UPDATE ${this.table} SET ${setClauses.join(', ')}${whereStr} RETURNING *`;
          params = allParams;
          break;
        }

        case 'DELETE':
          sql = `DELETE FROM ${this.table}${where} RETURNING *`;
          params = this.whereParams;
          break;

        case 'UPSERT': {
          const data = this.insertData as Record<string, unknown>;
          const keys = Object.keys(data);
          const values = Object.values(data);
          const placeholders = keys.map((_, i) => `$${i + 1}`);
          const updates = keys
            .filter((k) => k !== this.upsertConflictColumn)
            .map((k) => `${k} = EXCLUDED.${k}`);
          sql = `INSERT INTO ${this.table} (${keys.join(', ')})
                 VALUES (${placeholders.join(', ')})
                 ON CONFLICT (${this.upsertConflictColumn}) DO UPDATE SET ${updates.join(', ')}
                 RETURNING *`;
          params = values;
          break;
        }

        default:
          throw new Error(`Unknown operation: ${this.operation}`);
      }

      const result = await p.query(sql, params);

      if (this.returnSingle) {
        return { data: (result.rows[0] as T) || null, error: null };
      }
      return { data: result.rows as T[], error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }
}

/**
 * Database client with Supabase-compatible API.
 *
 * Usage:
 *   const { data, error } = await db.from('customers').select('*').eq('id', id).execute();
 */
export const db = {
  from: <T = Record<string, unknown>>(table: string) => new QueryBuilder<T>(table),
};

/**
 * Execute a raw SQL query. Use for complex queries that don't fit the QueryBuilder.
 */
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<{ data: T[]; error: Error | null }> {
  try {
    const p = await getPool();
    const result = await p.query(text, params);
    return { data: result.rows as T[], error: null };
  } catch (error) {
    return { data: [], error: error as Error };
  }
}

/**
 * Execute a raw SQL query returning a single row.
 */
export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<{ data: T | null; error: Error | null }> {
  const result = await query<T>(text, params);
  return { data: result.data[0] || null, error: result.error };
}
