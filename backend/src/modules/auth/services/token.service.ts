import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../../../config/env.js';
import { prisma } from '../../../lib/prisma.js';
import { hashOtp } from '../../../lib/crypto.js';
import { AuthenticatedUserPayload } from '../../../common/types.js';

export interface IssuedTokens {
  token: string;
  refreshToken: string;
  sessionId: string;
}

export class TokenService {
  /**
   * Signs standard JWT access token and refresh token with explicit tokenType claims.
   */
  static generateTokens(payload: AuthenticatedUserPayload): IssuedTokens {
    const sessionId = crypto.randomUUID();

    const tokenOptions: SignOptions = {
      expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
      jwtid: sessionId,
      algorithm: 'HS256',
    };

    const refreshTokenOptions: SignOptions = {
      expiresIn: env.REFRESH_TOKEN_EXPIRES_IN as SignOptions['expiresIn'],
      jwtid: crypto.randomUUID(),
      algorithm: 'HS256',
    };

    const token = jwt.sign({ ...payload, tokenType: 'access' }, env.JWT_SECRET, tokenOptions);
    const refreshToken = jwt.sign(
      { userId: payload.userId, sessionId, tokenType: 'refresh' },
      env.JWT_SECRET,
      refreshTokenOptions
    );

    return { token, refreshToken, sessionId };
  }

  /**
   * Generates a single access token for session refreshes.
   */
  static generateAccessToken(payload: AuthenticatedUserPayload, sessionId?: string): string {
    const sId = sessionId || crypto.randomUUID();
    const tokenOptions: SignOptions = {
      expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
      jwtid: sId,
      algorithm: 'HS256',
    };
    return jwt.sign({ ...payload, tokenType: 'access' }, env.JWT_SECRET, tokenOptions);
  }

  /**
   * Verifies a refresh token with strict HS256 algorithm enforcement and tokenType discrimination.
   */
  static verifyRefreshToken(refreshTokenString: string): { userId: string; sessionId: string; tokenType: string } {
    const decoded = jwt.verify(refreshTokenString, env.JWT_SECRET, { algorithms: ['HS256'] }) as any;

    if (!decoded || typeof decoded !== 'object') {
      const error: any = new Error('Invalid refresh token structure.');
      error.code = 'INVALID_REFRESH_TOKEN';
      error.statusCode = 401;
      throw error;
    }

    if (decoded.tokenType !== 'refresh') {
      const error: any = new Error('Invalid token type: refresh token expected.');
      error.code = 'INVALID_REFRESH_TOKEN';
      error.statusCode = 401;
      throw error;
    }

    if (!decoded.sessionId || typeof decoded.sessionId !== 'string') {
      const error: any = new Error('Refresh token is missing session identity.');
      error.code = 'INVALID_REFRESH_TOKEN';
      error.statusCode = 401;
      throw error;
    }

    if (!decoded.userId || typeof decoded.userId !== 'string') {
      const error: any = new Error('Refresh token is missing user identity.');
      error.code = 'INVALID_REFRESH_TOKEN';
      error.statusCode = 401;
      throw error;
    }

    return {
      userId: decoded.userId,
      sessionId: decoded.sessionId,
      tokenType: decoded.tokenType,
    };
  }

  /**
   * Persists a login session in the database linked directly to the sessionId (jti).
   */
  static async recordLoginSession(
    userId: string,
    mobileNumber: string,
    token: string,
    sessionId: string,
    reqInfo?: { ip?: string; userAgent?: string }
  ) {
    const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return prisma.loginSession.create({
      data: {
        id: sessionId,
        userId,
        tokenHash: hashOtp(`${token.slice(-32)}:${sessionId}`, mobileNumber),
        ipAddress: reqInfo?.ip,
        deviceInfo: reqInfo?.userAgent,
        expiresAt: sessionExpiresAt,
      },
    });
  }

  /**
   * Validates that a LoginSession exists, is not revoked, has not expired, and belongs to the user.
   */
  static async validateSession(
    sessionId: string,
    userId: string
  ): Promise<{ valid: boolean; code?: string; message?: string }> {
    const session = await prisma.loginSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return { valid: false, code: 'SESSION_NOT_FOUND', message: 'Session does not exist or has been invalidated.' };
    }

    if (session.revokedAt) {
      return { valid: false, code: 'SESSION_REVOKED', message: 'Session has been revoked.' };
    }

    if (session.expiresAt.getTime() < Date.now()) {
      return { valid: false, code: 'SESSION_EXPIRED', message: 'Session has expired.' };
    }

    if (session.userId !== userId) {
      return { valid: false, code: 'INVALID_SESSION_OWNER', message: 'Session does not belong to the authenticated user.' };
    }

    return { valid: true };
  }

  /**
   * Revokes a specific login session by sessionId.
   */
  static async revokeSession(sessionId: string): Promise<void> {
    await prisma.loginSession.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  /**
   * Revokes all active login sessions for a user upon logout.
   */
  static async revokeSessions(userId: string): Promise<void> {
    await prisma.loginSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }
}
