/**
 * Characterization tests for services/shared/middleware/authorization.ts
 *
 * This module is the security backbone — imported by every authenticated endpoint.
 * Tests capture existing behavior so refactoring can proceed safely.
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import {
  getAuthContext,
  isAdminOrManager,
  isAdminStaff,
  requireRole,
  requireOwnership,
  buildAccessFilter,
  isInvestor,
  getApiKeyAuth,
  AuthContext,
} from '../../../services/shared/middleware/authorization';
import { createAPIGatewayEvent } from '../../helpers/test-utils';

function createEventWithClaims(claims: Record<string, string>): APIGatewayProxyEvent {
  return createAPIGatewayEvent({
    requestContext: {
      ...createAPIGatewayEvent().requestContext,
      authorizer: { claims },
    },
  });
}

describe('authorization middleware', () => {
  // ─── getAuthContext ───────────────────────────────────────────
  describe('getAuthContext', () => {
    it('should extract userId, email, and roles from Cognito claims', () => {
      const event = createEventWithClaims({
        sub: 'user-123',
        email: 'admin@lynia.co.zw',
        'cognito:groups': 'super_admin,operations_manager',
      });

      const ctx = getAuthContext(event);

      expect(ctx.userId).toBe('user-123');
      expect(ctx.email).toBe('admin@lynia.co.zw');
      expect(ctx.roles).toEqual(['super_admin', 'operations_manager']);
    });

    it('should return empty roles array when cognito:groups is missing', () => {
      const event = createEventWithClaims({
        sub: 'user-456',
        email: 'user@lynia.co.zw',
      });

      const ctx = getAuthContext(event);

      expect(ctx.roles).toEqual([]);
    });

    it('should throw AUTH_TOKEN_001 when claims are missing', () => {
      const event = createAPIGatewayEvent({
        requestContext: {
          ...createAPIGatewayEvent().requestContext,
          authorizer: {},
        },
      });

      expect(() => getAuthContext(event)).toThrow('Missing authentication');
    });

    it('should throw when authorizer is null', () => {
      const event = createAPIGatewayEvent({
        requestContext: {
          ...createAPIGatewayEvent().requestContext,
          authorizer: null as unknown as undefined,
        },
      });

      expect(() => getAuthContext(event)).toThrow('Missing authentication');
    });

    it('should parse single role from cognito:groups', () => {
      const event = createEventWithClaims({
        sub: 'user-789',
        email: 'support@lynia.co.zw',
        'cognito:groups': 'customer_support',
      });

      const ctx = getAuthContext(event);
      expect(ctx.roles).toEqual(['customer_support']);
    });
  });

  // ─── isAdminOrManager ─────────────────────────────────────────
  describe('isAdminOrManager', () => {
    it('should return true for super_admin', () => {
      expect(isAdminOrManager({ userId: '1', email: '', roles: ['super_admin'] })).toBe(true);
    });

    it('should return true for admin', () => {
      expect(isAdminOrManager({ userId: '1', email: '', roles: ['admin'] })).toBe(true);
    });

    it('should return true for operations_manager', () => {
      expect(isAdminOrManager({ userId: '1', email: '', roles: ['operations_manager'] })).toBe(true);
    });

    it('should return false for customer_support', () => {
      expect(isAdminOrManager({ userId: '1', email: '', roles: ['customer_support'] })).toBe(false);
    });

    it('should return false for customer', () => {
      expect(isAdminOrManager({ userId: '1', email: '', roles: ['customer'] })).toBe(false);
    });

    it('should return true when one of multiple roles matches', () => {
      expect(isAdminOrManager({ userId: '1', email: '', roles: ['customer', 'admin'] })).toBe(true);
    });

    it('should return false for empty roles', () => {
      expect(isAdminOrManager({ userId: '1', email: '', roles: [] })).toBe(false);
    });
  });

  // ─── isAdminStaff ─────────────────────────────────────────────
  describe('isAdminStaff', () => {
    const staffRoles = [
      'super_admin', 'admin', 'operations_manager', 'customer_support',
      'finance_team', 'kyc_reviewer', 'inventory_manager', 'reports_viewer',
    ] as const;

    for (const role of staffRoles) {
      it(`should return true for ${role}`, () => {
        expect(isAdminStaff({ userId: '1', email: '', roles: [role] })).toBe(true);
      });
    }

    it('should return false for distributor', () => {
      expect(isAdminStaff({ userId: '1', email: '', roles: ['distributor'] })).toBe(false);
    });

    it('should return false for customer', () => {
      expect(isAdminStaff({ userId: '1', email: '', roles: ['customer'] })).toBe(false);
    });

    it('should return false for investor', () => {
      expect(isAdminStaff({ userId: '1', email: '', roles: ['investor'] })).toBe(false);
    });
  });

  // ─── requireRole ──────────────────────────────────────────────
  describe('requireRole', () => {
    it('should not throw when user has required role', () => {
      const auth: AuthContext = { userId: '1', email: '', roles: ['admin'] };
      expect(() => requireRole(auth, 'admin')).not.toThrow();
    });

    it('should not throw when user has one of multiple allowed roles', () => {
      const auth: AuthContext = { userId: '1', email: '', roles: ['customer_support'] };
      expect(() => requireRole(auth, 'admin', 'customer_support')).not.toThrow();
    });

    it('should throw 403 when user lacks required role', () => {
      const auth: AuthContext = { userId: '1', email: '', roles: ['customer'] };
      expect(() => requireRole(auth, 'admin')).toThrow('Insufficient permissions');
    });

    it('should throw with AUTH_ROLE_001 code', () => {
      const auth: AuthContext = { userId: '1', email: '', roles: ['customer'] };
      try {
        requireRole(auth, 'admin');
        fail('Expected error');
      } catch (error: unknown) {
        expect((error as Record<string, unknown>).code).toBe('AUTH_ROLE_001');
        expect((error as Record<string, unknown>).statusCode).toBe(403);
      }
    });
  });

  // ─── requireOwnership ─────────────────────────────────────────
  describe('requireOwnership', () => {
    it('should allow access when user owns the resource', () => {
      const auth: AuthContext = { userId: 'owner-123', email: '', roles: ['customer'] };
      expect(() => requireOwnership(auth, 'owner-123')).not.toThrow();
    });

    it('should allow admin override by default', () => {
      const auth: AuthContext = { userId: 'admin-1', email: '', roles: ['admin'] };
      expect(() => requireOwnership(auth, 'other-user')).not.toThrow();
    });

    it('should deny admin override when disabled', () => {
      const auth: AuthContext = { userId: 'admin-1', email: '', roles: ['admin'] };
      expect(() => requireOwnership(auth, 'other-user', false)).toThrow('Access denied');
    });

    it('should deny access for non-owner non-admin', () => {
      const auth: AuthContext = { userId: 'user-1', email: '', roles: ['customer'] };
      expect(() => requireOwnership(auth, 'other-user')).toThrow('Access denied');
    });
  });

  // ─── buildAccessFilter ────────────────────────────────────────
  describe('buildAccessFilter', () => {
    it('should return no filter for admin', () => {
      const auth: AuthContext = { userId: '1', email: '', roles: ['admin'] };
      const filter = buildAccessFilter(auth, 'customer_id');
      expect(filter.clause).toBe('1=1');
      expect(filter.params).toEqual([]);
    });

    it('should return no filter for operations_manager', () => {
      const auth: AuthContext = { userId: '1', email: '', roles: ['operations_manager'] };
      const filter = buildAccessFilter(auth, 'customer_id');
      expect(filter.clause).toBe('1=1');
    });

    it('should return no filter for admin staff roles', () => {
      const auth: AuthContext = { userId: '1', email: '', roles: ['customer_support'] };
      const filter = buildAccessFilter(auth, 'customer_id');
      expect(filter.clause).toBe('1=1');
    });

    it('should filter by owner column for customer', () => {
      const auth: AuthContext = { userId: 'cust-99', email: '', roles: ['customer'] };
      const filter = buildAccessFilter(auth, 'customer_id');
      expect(filter.clause).toBe('customer_id = $1');
      expect(filter.params).toEqual(['cust-99']);
    });

    it('should filter by owner column for distributor', () => {
      const auth: AuthContext = { userId: 'dist-5', email: '', roles: ['distributor'] };
      const filter = buildAccessFilter(auth, 'distributor_id');
      expect(filter.clause).toBe('distributor_id = $1');
      expect(filter.params).toEqual(['dist-5']);
    });
  });

  // ─── isInvestor ───────────────────────────────────────────────
  describe('isInvestor', () => {
    it('should return true for investor role', () => {
      expect(isInvestor({ userId: '1', email: '', roles: ['investor'] })).toBe(true);
    });

    it('should return false for admin role', () => {
      expect(isInvestor({ userId: '1', email: '', roles: ['admin'] })).toBe(false);
    });
  });

  // ─── getApiKeyAuth ────────────────────────────────────────────
  describe('getApiKeyAuth', () => {
    it('should return investor context when x-api-key header is present', () => {
      const event = createAPIGatewayEvent({
        headers: { 'x-api-key': 'test-key-123' },
      });
      const ctx = getApiKeyAuth(event);
      expect(ctx).not.toBeNull();
      expect(ctx!.roles).toEqual(['investor']);
      expect(ctx!.userId).toBe('api-key-user');
    });

    it('should return null when no API key header', () => {
      const event = createAPIGatewayEvent({ headers: {} });
      expect(getApiKeyAuth(event)).toBeNull();
    });

    it('should handle X-Api-Key (capitalized) header', () => {
      const event = createAPIGatewayEvent({
        headers: { 'X-Api-Key': 'test-key-456' },
      });
      expect(getApiKeyAuth(event)).not.toBeNull();
    });
  });
});
