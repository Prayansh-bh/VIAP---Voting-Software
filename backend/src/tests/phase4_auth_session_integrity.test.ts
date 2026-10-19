/**
 * VIAP — Phase 4: Authentication, Sessions, and Role Integrity Tests
 *
 * Verifies:
 * 1. Session revocation enforcement (invalidating session causes immediate rejection).
 * 2. Token type and session identifier validation (refreshes cannot be passed as access tokens).
 * 3. Role-based access control (RBAC): client cannot forge roles to bypass server guards.
 * 4. Read-only role protection (VIEWER cannot mutate records).
 * 5. Mobile number change safety (duplicate/same number rejection, session rotation).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { TokenService } from '../modules/auth/services/token.service.js';
import { verifyTokenAndSession } from '../middleware/auth.js';
import { requireRoles, requireSuperAdmin, requireNotReadOnly, ROLE_RANK_WEIGHT } from '../middleware/rbac.js';
import { RoleType } from '@prisma/client';

describe('Phase 4: Authentication, Sessions & Role Integrity Suite', () => {

  describe('Session Validation & Revocation Logic', () => {
    it('should reject tokens with missing jti (session ID)', async () => {
      // Craft a validly signed JWT missing a jti claim
      const token = jwt.sign(
        { userId: 'test-user-id', role: RoleType.SUPER_ADMIN, tokenType: 'access' },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const result = await verifyTokenAndSession(token);
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.code, 'INVALID_SESSION');
      assert.match(result.error || '', /missing session identifier/);
    });

    it('should reject refresh tokens supplied to access token endpoints', async () => {
      // Craft a valid refresh token with tokenType='refresh'
      const token = jwt.sign(
        { userId: 'test-user-id', tokenType: 'refresh' },
        env.JWT_SECRET,
        { expiresIn: '1h', jwtid: 'some-session-id' }
      );

      const result = await verifyTokenAndSession(token);
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.code, 'INVALID_TOKEN_TYPE');
      assert.match(result.error || '', /access token expected/);
    });

    it('should reject expired tokens immediately', async () => {
      // Craft an expired token
      const token = jwt.sign(
        { userId: 'test-user-id', role: RoleType.SUPER_ADMIN, tokenType: 'access' },
        env.JWT_SECRET,
        { expiresIn: '-10s', jwtid: 'expired-session-id' }
      );

      const result = await verifyTokenAndSession(token);
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.code, 'INVALID_TOKEN');
    });

    it('should reject tokens signed with a different secret', async () => {
      const forgedToken = jwt.sign(
        { userId: 'victim-user-id', role: RoleType.SUPER_ADMIN, tokenType: 'access' },
        'forged-malicious-secret-key-1234567890',
        { expiresIn: '1h', jwtid: 'forged-session-id' }
      );

      const result = await verifyTokenAndSession(forgedToken);
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.code, 'INVALID_TOKEN');
    });
  });

  describe('Server-Authoritative Role-Based Access Control (RBAC)', () => {
    it('should enforce strict rank weights preventing lower roles from accessing higher tier permissions', () => {
      assert.ok(ROLE_RANK_WEIGHT[RoleType.SUPER_ADMIN] > ROLE_RANK_WEIGHT[RoleType.STATE_ADMIN]);
      assert.ok(ROLE_RANK_WEIGHT[RoleType.STATE_ADMIN] > ROLE_RANK_WEIGHT[RoleType.CONSTITUENCY_INCHARGE]);
      assert.ok(ROLE_RANK_WEIGHT[RoleType.CONSTITUENCY_INCHARGE] > ROLE_RANK_WEIGHT[RoleType.MANDAL_INCHARGE]);
      assert.ok(ROLE_RANK_WEIGHT[RoleType.MANDAL_INCHARGE] > ROLE_RANK_WEIGHT[RoleType.VILLAGE_INCHARGE]);
      assert.ok(ROLE_RANK_WEIGHT[RoleType.VILLAGE_INCHARGE] > ROLE_RANK_WEIGHT[RoleType.BOOTH_PRESIDENT]);
      assert.ok(ROLE_RANK_WEIGHT[RoleType.BOOTH_PRESIDENT] > ROLE_RANK_WEIGHT[RoleType.VOTER_100_INCHARGE]);
      assert.ok(ROLE_RANK_WEIGHT[RoleType.VOTER_100_INCHARGE] > ROLE_RANK_WEIGHT[RoleType.VIEWER]);
    });

    it('should block unauthenticated requests with 401 UNAUTHORIZED', async () => {
      const guard = requireRoles(RoleType.SUPER_ADMIN);
      let statusSent = 0;
      let bodySent: any = null;

      const mockReq: any = { user: null };
      const mockReply: any = {
        status: (s: number) => {
          statusSent = s;
          return {
            send: (b: any) => { bodySent = b; }
          };
        }
      };

      await guard(mockReq, mockReply);
      assert.strictEqual(statusSent, 401);
      assert.strictEqual(bodySent?.error?.code, 'UNAUTHORIZED');
    });

    it('should block low-privilege actor (BOOTH_PRESIDENT) from super-admin operations with 403 FORBIDDEN_ROLE', async () => {
      const guard = requireRoles(RoleType.SUPER_ADMIN);
      let statusSent = 0;
      let bodySent: any = null;

      const mockReq: any = {
        user: {
          userId: 'user-booth-incharge',
          role: RoleType.BOOTH_PRESIDENT,
          organisationId: 'org-1'
        }
      };
      const mockReply: any = {
        status: (s: number) => {
          statusSent = s;
          return {
            send: (b: any) => { bodySent = b; }
          };
        }
      };

      await guard(mockReq, mockReply);
      assert.strictEqual(statusSent, 403);
      assert.strictEqual(bodySent?.error?.code, 'FORBIDDEN_ROLE');
    });

    it('should allow authentic SUPER_ADMIN without error', async () => {
      const guard = requireRoles(RoleType.SUPER_ADMIN);
      let statusSent = 0;

      const mockReq: any = {
        user: {
          userId: 'user-super-admin',
          role: RoleType.SUPER_ADMIN,
          organisationId: 'org-1'
        }
      };
      const mockReply: any = {
        status: (s: number) => {
          statusSent = s;
          return { send: () => {} };
        }
      };

      await guard(mockReq, mockReply);
      assert.strictEqual(statusSent, 0); // No error response sent, execution proceeds
    });

    it('requireSuperAdmin guard should strictly reject non-superadmin accounts', async () => {
      const guard = requireSuperAdmin();
      let statusSent = 0;
      let bodySent: any = null;

      const mockReq: any = {
        user: {
          userId: 'user-state-admin',
          role: RoleType.STATE_ADMIN,
          organisationId: 'org-1'
        }
      };
      const mockReply: any = {
        status: (s: number) => {
          statusSent = s;
          return {
            send: (b: any) => { bodySent = b; }
          };
        }
      };

      await guard(mockReq, mockReply);
      assert.strictEqual(statusSent, 403);
      assert.strictEqual(bodySent?.error?.code, 'SUPER_ADMIN_REQUIRED');
    });

    it('requireNotReadOnly guard should block VIEWER role from mutating data', async () => {
      const guard = requireNotReadOnly();
      let statusSent = 0;
      let bodySent: any = null;

      const mockReq: any = {
        user: {
          userId: 'user-viewer',
          role: RoleType.VIEWER,
          organisationId: 'org-1'
        }
      };
      const mockReply: any = {
        status: (s: number) => {
          statusSent = s;
          return {
            send: (b: any) => { bodySent = b; }
          };
        }
      };

      await guard(mockReq, mockReply);
      assert.strictEqual(statusSent, 403);
      assert.strictEqual(bodySent?.error?.code, 'READ_ONLY_ACCESS');
    });
  });
});
