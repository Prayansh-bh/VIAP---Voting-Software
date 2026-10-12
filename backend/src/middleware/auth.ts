import { FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { AuthenticatedUserPayload } from '../common/types.js';
import { errorResponse } from '../common/response.js';
import { prisma } from '../lib/prisma.js';
import { TokenService } from '../modules/auth/services/token.service.js';
import { PartyEligibilityService } from '../modules/auth/services/party-eligibility.service.js';
import { hashOtp } from '../lib/crypto.js';

import { isOriginAllowed } from '../common/origin.js';

export interface TokenVerificationResult {
  valid: boolean;
  user?: AuthenticatedUserPayload;
  sessionId?: string;
  error?: string;
  code?: string;
}

/**
 * Shared token & session verification logic.
 * Used across HTTP middleware and Socket.IO connection authentication.
 */
export async function verifyTokenAndSession(token: string): Promise<TokenVerificationResult> {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as AuthenticatedUserPayload & {
      jti?: string;
      tokenType?: string;
    };

    if (decoded.tokenType && decoded.tokenType !== 'access') {
      return { valid: false, code: 'INVALID_TOKEN_TYPE', error: 'Invalid token type: access token expected.' };
    }

    if (!decoded.jti) {
      return { valid: false, code: 'INVALID_SESSION', error: 'Authentication token is missing session identifier (jti).' };
    }

    const sessionCheck = await TokenService.validateSession(decoded.jti, decoded.userId);
    if (!sessionCheck.valid) {
      return { valid: false, code: sessionCheck.code || 'UNAUTHORIZED', error: sessionCheck.message || 'Session invalid.' };
    }

    // Ensure user is still active in database and attached to active political party
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        userCode: true,
        mobileNumber: true,
        role: true,
        accountStatus: true,
        organisationId: true,
        unitId: true,
        organisation: {
          select: {
            id: true,
            isActive: true,
            parties: {
              where: { isActive: true },
              select: { id: true, isActive: true },
            },
            cmsConfigs: {
              select: { activePartyCode: true },
            },
          },
        },
      },
    });

    if (!user || user.accountStatus !== 'ACTIVE') {
      return { valid: false, code: 'ACCOUNT_INACTIVE', error: 'Account is inactive or suspended.' };
    }

    const isSuperAdmin = user.role === 'SUPER_ADMIN';
    const hasActiveParty = isSuperAdmin || (await PartyEligibilityService.hasActiveParty(user.organisationId, user.organisation));

    if (!isSuperAdmin && !hasActiveParty) {
      return { valid: false, code: 'NOT_REGISTERED_TO_PARTY', error: 'User is not associated with an active political party.' };
    }

    return {
      valid: true,
      sessionId: decoded.jti,
      user: {
        userId: user.id,
        userCode: user.userCode,
        mobileNumber: user.mobileNumber,
        role: user.role,
        organisationId: user.organisationId,
        unitId: user.unitId,
      },
    };
  } catch (err: any) {
    return { valid: false, code: 'INVALID_TOKEN', error: 'Invalid or expired authentication token.' };
  }
}

export async function authenticate(req: FastifyRequest, reply: FastifyReply) {
  let token: string | undefined;

  // Check Authorization header
  const authHeader = req.headers.authorization;
  const isBearerAuth = Boolean(authHeader && authHeader.startsWith('Bearer '));

  if (isBearerAuth) {
    token = authHeader!.substring(7);
  } else if (req.cookies && req.cookies.access_token) {
    token = req.cookies.access_token;

    // Cookie-only CSRF Protection for state-changing requests
    const stateChangingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (stateChangingMethods.includes(req.method.toUpperCase())) {
      let requestOrigin = req.headers.origin as string | undefined;

      // If Origin is absent, evaluate Referer
      if (!requestOrigin && req.headers.referer) {
        try {
          const parsedUrl = new URL(req.headers.referer as string);
          requestOrigin = parsedUrl.origin;
        } catch {
          requestOrigin = undefined;
        }
      }

      // Reject cookie-only mutations with missing or unauthorized origin
      if (!requestOrigin || !isOriginAllowed(requestOrigin)) {
        return reply.status(403).send(
          errorResponse('Cross-origin request blocked: CSRF validation failed.', 'FORBIDDEN_CSRF')
        );
      }
    }
  }

  if (!token) {
    return reply.status(401).send(errorResponse('Authentication required', 'UNAUTHORIZED'));
  }

  const result = await verifyTokenAndSession(token);
  if (!result.valid || !result.user) {
    return reply.status(401).send(errorResponse(result.error || 'Authentication required', result.code || 'UNAUTHORIZED'));
  }

  req.user = result.user;
}

export async function optionalAuthenticate(req: FastifyRequest) {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.access_token) {
    token = req.cookies.access_token;
  }

  if (!token) {
    return;
  }

  const result = await verifyTokenAndSession(token);
  if (result.valid && result.user) {
    req.user = result.user;
  }
}

export function generateToken(payload: AuthenticatedUserPayload, sessionId?: string): string {
  const sid = sessionId || crypto.randomUUID();
  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d', jwtid: sid });

  // Register session asynchronously for test / dev utility callers
  prisma.loginSession
    .upsert({
      where: { id: sid },
      update: {
        userId: payload.userId,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      create: {
        id: sid,
        userId: payload.userId,
        tokenHash: hashOtp(`${token.slice(-32)}:${sid}`, payload.mobileNumber || 'system'),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })
    .catch(() => {});

  return token;
}

export async function createAuthenticatedTestSession(
  payload: AuthenticatedUserPayload,
  sessionId?: string
): Promise<{ token: string; sessionId: string }> {
  const sid = sessionId || crypto.randomUUID();
  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d', jwtid: sid });

  await prisma.loginSession.upsert({
    where: { id: sid },
    update: {
      userId: payload.userId,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    create: {
      id: sid,
      userId: payload.userId,
      tokenHash: hashOtp(`${token.slice(-32)}:${sid}`, payload.mobileNumber || 'system'),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return { token, sessionId: sid };
}

