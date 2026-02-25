/**
 * Characterization tests for services/shared/clients/database.ts
 *
 * Every database operation flows through the QueryBuilder.
 * We test SQL generation by mocking the pg Pool.
 */

import { QueryBuilder } from '../../../services/shared/clients/database';

// Mock pg module and getSecret
jest.mock('pg', () => {
  const mockQuery = jest.fn().mockResolvedValue({ rows: [] });
  const mockPool = { query: mockQuery };
  return { Pool: jest.fn(() => mockPool), __mockQuery: mockQuery, __mockPool: mockPool };
});

jest.mock('../../../services/shared/utils/secrets', () => ({
  getSecret: jest.fn().mockResolvedValue({
    host: 'localhost',
    port: '5432',
    database: 'test',
    username: 'test',
    password: 'test',
  }),
}));

// Get reference to mock query for assertions
const pg = require('pg');
const mockQuery: jest.Mock = pg.__mockQuery;

describe('QueryBuilder', () => {
  beforeEach(() => {
    mockQuery.mockClear();
    mockQuery.mockResolvedValue({ rows: [] });
    // Set required env var
    process.env.DB_SECRET_NAME = 'test/db/secret';
  });

  // ─── SELECT ───────────────────────────────────────────────────
  describe('SELECT operations', () => {
    it('should generate SELECT * by default', async () => {
      await new QueryBuilder('customers').select().execute();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM customers'),
        expect.any(Array)
      );
    });

    it('should generate SELECT with specific columns', async () => {
      await new QueryBuilder('customers').select('id, name, email').execute();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, name, email FROM customers'),
        expect.any(Array)
      );
    });

    it('should apply WHERE eq clause', async () => {
      await new QueryBuilder('customers').select().eq('id', 'user-123').execute();

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('WHERE id = $1');
      expect(params).toContain('user-123');
    });

    it('should apply multiple WHERE clauses with AND', async () => {
      await new QueryBuilder('customers')
        .select()
        .eq('status', 'active')
        .eq('kyc_status', 'verified')
        .execute();

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('WHERE status = $1 AND kyc_status = $2');
    });

    it('should apply ORDER BY', async () => {
      await new QueryBuilder('customers').select().order('created_at', { ascending: false }).execute();

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('ORDER BY created_at DESC');
    });

    it('should apply ORDER BY ASC by default', async () => {
      await new QueryBuilder('customers').select().order('name').execute();

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('ORDER BY name ASC');
    });

    it('should apply LIMIT', async () => {
      await new QueryBuilder('customers').select().limit(10).execute();

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('LIMIT 10');
    });

    it('should apply OFFSET', async () => {
      await new QueryBuilder('customers').select().offset(20).execute();

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('OFFSET 20');
    });

    it('should apply range (LIMIT + OFFSET)', async () => {
      await new QueryBuilder('customers').select().range(10, 19).execute();

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('LIMIT 10');
      expect(sql).toContain('OFFSET 10');
    });

    it('should return single row with .single()', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: '1', name: 'John' }] });

      const result = await new QueryBuilder('customers').select().eq('id', '1').single().execute();

      expect(result.data).toEqual({ id: '1', name: 'John' });
      expect(result.error).toBeNull();
    });

    it('should return null with .maybeSingle() when no rows', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await new QueryBuilder('customers').select().eq('id', 'none').maybeSingle().execute();

      expect(result.data).toBeNull();
    });
  });

  // ─── WHERE operators ──────────────────────────────────────────
  describe('WHERE operators', () => {
    it('neq should generate !=', async () => {
      await new QueryBuilder('loans').select().neq('status', 'cancelled').execute();
      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('status != $1');
    });

    it('gt should generate >', async () => {
      await new QueryBuilder('payments').select().gt('amount', 100).execute();
      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('amount > $1');
    });

    it('gte should generate >=', async () => {
      await new QueryBuilder('payments').select().gte('amount', 100).execute();
      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('amount >= $1');
    });

    it('lt should generate <', async () => {
      await new QueryBuilder('payments').select().lt('amount', 500).execute();
      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('amount < $1');
    });

    it('lte should generate <=', async () => {
      await new QueryBuilder('payments').select().lte('amount', 500).execute();
      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('amount <= $1');
    });

    it('in should generate IN clause', async () => {
      await new QueryBuilder('payments').select().in('status', ['pending', 'processing']).execute();
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('status IN ($1, $2)');
      expect(params).toEqual(['pending', 'processing']);
    });

    it('like should generate LIKE', async () => {
      await new QueryBuilder('customers').select().like('name', '%John%').execute();
      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('name LIKE $1');
    });

    it('ilike should generate ILIKE', async () => {
      await new QueryBuilder('customers').select().ilike('name', '%john%').execute();
      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('name ILIKE $1');
    });

    it('is null should generate IS NULL', async () => {
      await new QueryBuilder('customers').select().is('deleted_at', null).execute();
      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('deleted_at IS NULL');
    });

    it('is true should generate IS TRUE', async () => {
      await new QueryBuilder('customers').select().is('active', true).execute();
      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('active IS TRUE');
    });
  });

  // ─── INSERT ───────────────────────────────────────────────────
  describe('INSERT operations', () => {
    it('should generate INSERT with RETURNING *', async () => {
      await new QueryBuilder('customers')
        .insert({ name: 'John', email: 'john@test.com' })
        .execute();

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('INSERT INTO customers');
      expect(sql).toContain('RETURNING *');
      expect(params).toContain('John');
      expect(params).toContain('john@test.com');
    });

    it('should handle batch insert', async () => {
      await new QueryBuilder('customers')
        .insert([
          { name: 'John', email: 'john@test.com' },
          { name: 'Jane', email: 'jane@test.com' },
        ])
        .execute();

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('VALUES ($1, $2), ($3, $4)');
      expect(params).toHaveLength(4);
    });
  });

  // ─── UPDATE ───────────────────────────────────────────────────
  describe('UPDATE operations', () => {
    it('should generate UPDATE with SET and WHERE', async () => {
      await new QueryBuilder('customers')
        .update({ status: 'verified', kyc_status: 'approved' })
        .eq('id', 'user-123')
        .execute();

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('UPDATE customers SET');
      expect(sql).toContain('RETURNING *');
      expect(params).toContain('verified');
      expect(params).toContain('approved');
      expect(params).toContain('user-123');
    });
  });

  // ─── DELETE ───────────────────────────────────────────────────
  describe('DELETE operations', () => {
    it('should generate DELETE with WHERE', async () => {
      await new QueryBuilder('sessions')
        .delete()
        .eq('user_id', 'user-123')
        .execute();

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('DELETE FROM sessions');
      expect(sql).toContain('WHERE user_id = $1');
      expect(sql).toContain('RETURNING *');
      expect(params).toContain('user-123');
    });
  });

  // ─── UPSERT ───────────────────────────────────────────────────
  describe('UPSERT operations', () => {
    it('should generate INSERT ON CONFLICT DO UPDATE', async () => {
      await new QueryBuilder('customer_preferences')
        .upsert({ id: 'pref-1', theme: 'dark' }, { onConflict: 'id' })
        .execute();

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('ON CONFLICT (id) DO UPDATE');
      expect(sql).toContain('RETURNING *');
    });
  });

  // ─── COUNT ────────────────────────────────────────────────────
  describe('COUNT operations', () => {
    it('should generate COUNT query', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '42' }] });

      const result = await new QueryBuilder('customers')
        .select()
        .eq('status', 'active')
        .count()
        .execute();

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('SELECT COUNT(*) as count FROM customers');
      expect(result.count).toBe(42);
    });
  });

  // ─── Error handling ───────────────────────────────────────────
  describe('error handling', () => {
    it('should return error instead of throwing on query failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Connection timeout'));

      const result = await new QueryBuilder('customers').select().execute();

      expect(result.data).toBeNull();
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error!.message).toBe('Connection timeout');
    });
  });
});
