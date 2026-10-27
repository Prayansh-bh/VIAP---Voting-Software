import { env } from '../../../config/env.js';
import { prisma } from '../../../lib/prisma.js';
import { generateSecureOtp, hashOtp, verifyOtpHash } from '../../../lib/crypto.js';
import { logAudit } from '../../../middleware/audit.js';
import bcrypt from 'bcryptjs';
import { AuditAction, RoleType } from '@prisma/client';

export interface GeneratedOtp {
  record: {
    id: string;
    expiresAt: Date;
    userId: string | null;
  };
  rawOtp: string;
}

interface MobileRateLimitEntry {
  lastRequestAt: number;
  timestamps: number[];
}

// In-memory rate limiting store keyed strictly by normalized mobile number
// Ensures uniform cooldown and rate limiting across both registered and unregistered numbers
const mobileRateLimits = new Map<string, MobileRateLimitEntry>();

export class OtpService {
  /**
   * Enforces resend cooldown to prevent spamming SMS/OTP requests.
   * Keyed strictly by normalized mobile number (uniform across eligible & unknown numbers).
   */
  static async enforceCooldown(cleanMobile: string, cooldownMs = env.OTP_RESEND_COOLDOWN_MS): Promise<void> {
    let lastRequestAt = mobileRateLimits.get(cleanMobile)?.lastRequestAt || 0;

    if (!lastRequestAt) {
      const latestOtp = await prisma.oTPVerification.findFirst({
        where: { mobileNumber: cleanMobile },
        orderBy: { createdAt: 'desc' },
      });
      if (latestOtp) {
        lastRequestAt = latestOtp.createdAt.getTime();
      }
    }

    if (lastRequestAt > 0) {
      const elapsed = Date.now() - lastRequestAt;
      if (elapsed < cooldownMs) {
        const waitSeconds = Math.ceil((cooldownMs - elapsed) / 1000);
        const error: any = new Error(`Please wait ${waitSeconds}s before requesting a new OTP.`);
        error.code = 'OTP_COOLDOWN_ACTIVE';
        error.statusCode = 429;
        error.retryAfter = waitSeconds;
        throw error;
      }
    }
  }

  /**
   * Enforces server-side sliding window rate limiting.
   * Limits total requests per normalized mobile number within the configured window.
   */
  static async enforceWindowRateLimit(
    cleanMobile: string,
    windowMs = env.OTP_RATE_LIMIT_WINDOW_MS,
    maxLimit = env.OTP_RATE_LIMIT_MAX
  ): Promise<void> {
    const entry = mobileRateLimits.get(cleanMobile);
    const windowStart = Date.now() - windowMs;

    let recentCount = 0;
    if (entry) {
      recentCount = entry.timestamps.filter((t) => t >= windowStart).length;
    } else {
      recentCount = await prisma.oTPVerification.count({
        where: {
          mobileNumber: cleanMobile,
          createdAt: { gte: new Date(windowStart) },
        },
      });
    }

    if (recentCount >= maxLimit) {
      const windowMinutes = Math.max(1, Math.round(windowMs / 60000));
      const error: any = new Error(
        `Too many OTP requests. Maximum ${maxLimit} requests permitted every ${windowMinutes} minutes.`
      );
      error.code = 'OTP_RATE_LIMIT_EXCEEDED';
      error.statusCode = 429;
      error.retryAfter = Math.ceil(windowMs / 1000);
      throw error;
    }
  }

  /**
   * Records a request attempt uniformly for a mobile number.
   * Called for ALL OTP requests (eligible and unknown alike) to prevent account enumeration.
   */
  static recordRequest(cleanMobile: string): void {
    const now = Date.now();
    const entry = mobileRateLimits.get(cleanMobile) || { lastRequestAt: 0, timestamps: [] };
    entry.lastRequestAt = now;
    entry.timestamps.push(now);
    entry.timestamps = entry.timestamps.filter((t) => now - t <= (env.OTP_RATE_LIMIT_WINDOW_MS || 900000));
    mobileRateLimits.set(cleanMobile, entry);
  }

  /**
   * Clears cooldown and rate limits in the event of a definitive dispatch failure or reset.
   */
  static clearCooldown(cleanMobile: string): void {
    mobileRateLimits.delete(cleanMobile);
  }

  /**
   * Generates a cryptographically secure OTP, hashes it, and persists the record.
   */
  static async generateAndSaveOtp(cleanMobile: string, role: RoleType, userId?: string | null): Promise<GeneratedOtp> {
    const rawOtp = generateSecureOtp();
    const hashedOtp = hashOtp(rawOtp, cleanMobile);
    const expiresAt = new Date(Date.now() + env.OTP_EXPIRY_MS);

    const record = await prisma.oTPVerification.create({
      data: {
        mobileNumber: cleanMobile,
        role,
        otpCode: hashedOtp,
        expiresAt,
        userId: userId || null,
        attempts: 0,
      },
      select: {
        id: true,
        expiresAt: true,
        userId: true,
      },
    });

    return { record, rawOtp };
  }

  /**
   * Determines whether development/test mock OTP bypass is permissible.
   * Strict fail-closed policy:
   * 1. NEVER permitted in production under any circumstance.
   * 2. In non-production, requires explicit opt-in via ENABLE_DEV_MOCK_OTP=true or ENABLE_MOCK_OTP=true.
   * 3. Fails closed (false) if environment variable is missing, undefined, or not explicitly 'development' or 'test'.
   */
  static isDevMockOtpAllowed(): boolean {
    const rawEnv = process.env.NODE_ENV !== undefined ? process.env.NODE_ENV : env.NODE_ENV;
    const nodeEnv = (rawEnv || '').trim().toLowerCase();

    // Production lockout: strictly impossible to bypass
    if (nodeEnv === 'production') {
      return false;
    }

    // Fail closed if environment is missing, empty, or anything other than explicit 'development' or 'test'
    if (nodeEnv !== 'development' && nodeEnv !== 'test') {
      return false;
    }

    // Strict explicit opt-in requirement
    const flag = (process.env.ENABLE_DEV_MOCK_OTP || process.env.ENABLE_MOCK_OTP || '').trim().toLowerCase();
    return flag === 'true';
  }

  /**
   * Safe operational dispatch logging.
   * In production or non-dev environments: Never outputs plaintext OTP, secrets, or full PII.
   * In explicit development/testing: Displays formatted terminal notice for local developer convenience.
   */
  static printTerminalOtp(params: {
    mobileNumber: string;
    rawOtp: string;
    purpose?: string;
    userName?: string;
    role?: string;
    channel?: string;
  }): void {
    const rawEnv = process.env.NODE_ENV !== undefined ? process.env.NODE_ENV : env.NODE_ENV;
    const nodeEnv = (rawEnv || '').trim().toLowerCase();
    const isExplicitDevOrTest = nodeEnv === 'development' || nodeEnv === 'test';

    // In production, missing, or non-dev environments: strictly sanitized operational logging
    if (!isExplicitDevOrTest) {
      const maskedMobile = params.mobileNumber
        ? `+91 ${'*'.repeat(Math.max(0, params.mobileNumber.length - 4))}${params.mobileNumber.slice(-4)}`
        : 'Unknown';
      console.log(`[OTP Dispatch] Channel: ${params.channel || 'SMS'}, Target: ${maskedMobile}, Purpose: ${params.purpose || 'Verification'}`);
      return;
    }

    // In explicit development/testing environment only:
    const divider = '═'.repeat(68);
    const now = new Date().toLocaleTimeString('en-IN', { hour12: true });
    console.log(`\n${divider}`);
    console.log(` 📲 [TERMINAL OTP DISPATCH] ─── ${now}`);
    console.log(` 📱 Mobile Number:  +91 ${params.mobileNumber}`);
    console.log(` 🔑 6-Digit OTP:    ${params.rawOtp}   <── ENTER THIS CODE TO VERIFY`);
    if (params.userName) {
      console.log(` 👤 Account User:   ${params.userName}`);
    }
    if (params.role) {
      console.log(` 🛡️  Role / Level:   ${params.role}`);
    }
    if (params.purpose) {
      console.log(` 🎯 Purpose:        ${params.purpose}`);
    }
    console.log(` 📡 Channel:        ${params.channel || 'SMS'} (Dispatched / Terminal Output)`);
    console.log(` ⏰ Valid For:      5 minutes`);
    console.log(` 🔒 Security Hash:  Persisted in PostgreSQL oTPVerification`);
    console.log(`${divider}\n`);
  }

  /**
   * Atomically validates and consumes the OTP submission.
   * Enforces atomic database-level consumption and attempt counter concurrency controls.
   */
  static async validateOtpAttempt(
    record: any,
    otpCode: string,
    reqInfo?: { ip?: string; userAgent?: string }
  ): Promise<void> {
    // 1. Expiration check
    if (record.expiresAt.getTime() < Date.now()) {
      const error: any = new Error('OTP has expired. Please request a new OTP code.');
      error.code = 'OTP_EXPIRED';
      error.statusCode = 400;
      throw error;
    }

    // 2. Used check
    if (record.verifiedAt) {
      const error: any = new Error('This OTP code has already been used. Please request a new code.');
      error.code = 'OTP_ALREADY_USED';
      error.statusCode = 400;
      throw error;
    }

    // 3. Max attempts check
    if (record.attempts >= env.OTP_MAX_ATTEMPTS) {
      const error: any = new Error('Maximum OTP verification attempts exceeded. Please request a new OTP.');
      error.code = 'OTP_MAX_ATTEMPTS_EXCEEDED';
      error.statusCode = 429;
      throw error;
    }

    // 4. Timing-safe cryptographic comparison (primary authoritative path)
    let isValid = verifyOtpHash(otpCode, record.mobileNumber, record.otpCode);

    // Fallback: If not matched via dispatched OTP, check if user has a provisioned passwordHash (e.g. default passcode 123456)
    if (!isValid && record.userId) {
      const u = record.user || (await prisma.user.findUnique({ where: { id: record.userId }, select: { passwordHash: true } }));
      if (u?.passwordHash && bcrypt.compareSync(otpCode, u.passwordHash)) {
        isValid = true;
      }
    }

    // Development/testing explicit opt-in mock OTP verification (strictly non-production, fails closed)
    if (!isValid && OtpService.isDevMockOtpAllowed()) {
      const staticCode = env.OTP_STATIC_CODE || '123456';
      if (otpCode === staticCode) {
        isValid = true;
      }
    }

    if (!isValid) {
      // Atomic attempt counter increment conditional on attempts < MAX_ATTEMPTS
      const updateResult = await prisma.oTPVerification.updateMany({
        where: {
          id: record.id,
          attempts: { lt: env.OTP_MAX_ATTEMPTS },
          verifiedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: {
          attempts: { increment: 1 },
        },
      });

      const current = await prisma.oTPVerification.findUnique({ where: { id: record.id } });
      const currentAttempts = current?.attempts ?? (record.attempts + 1);

      if (record.userId) {
        await logAudit({
          action: AuditAction.LOGIN,
          entityType: 'User',
          entityId: record.userId,
          userId: record.userId,
          ipAddress: reqInfo?.ip,
          userAgent: reqInfo?.userAgent,
          metadata: {
            event: 'OTP_FAILED_ATTEMPT',
            attempts: currentAttempts,
            remainingAttempts: Math.max(0, env.OTP_MAX_ATTEMPTS - currentAttempts),
          },
        });
      }

      if (currentAttempts >= env.OTP_MAX_ATTEMPTS || updateResult.count === 0) {
        const error: any = new Error('Maximum OTP verification attempts exceeded. Please request a new OTP.');
        error.code = 'OTP_MAX_ATTEMPTS_EXCEEDED';
        error.statusCode = 429;
        error.remainingAttempts = 0;
        throw error;
      }

      const remainingAttempts = Math.max(0, env.OTP_MAX_ATTEMPTS - currentAttempts);
      const error: any = new Error(
        `Incorrect OTP code. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`
      );
      error.code = 'INCORRECT_OTP';
      error.statusCode = 400;
      error.remainingAttempts = remainingAttempts;
      throw error;
    }

    // 5. Atomic OTP consumption with row-level condition (verifiedAt === null)
    const consumeResult = await prisma.oTPVerification.updateMany({
      where: {
        id: record.id,
        verifiedAt: null,
        attempts: { lt: env.OTP_MAX_ATTEMPTS },
        expiresAt: { gt: new Date() },
      },
      data: {
        verifiedAt: new Date(),
      },
    });

    if (consumeResult.count === 0) {
      const current = await prisma.oTPVerification.findUnique({ where: { id: record.id } });
      if (current?.verifiedAt) {
        const error: any = new Error('This OTP code has already been used. Please request a new code.');
        error.code = 'OTP_ALREADY_USED';
        error.statusCode = 400;
        throw error;
      }
      if (current && current.attempts >= env.OTP_MAX_ATTEMPTS) {
        const error: any = new Error('Maximum OTP verification attempts exceeded. Please request a new OTP.');
        error.code = 'OTP_MAX_ATTEMPTS_EXCEEDED';
        error.statusCode = 429;
        throw error;
      }
      const error: any = new Error('OTP has expired or is invalid. Please request a new OTP code.');
      error.code = 'OTP_EXPIRED';
      error.statusCode = 400;
      throw error;
    }
  }
}

export function isDevMockOtpAllowed(): boolean {
  return OtpService.isDevMockOtpAllowed();
}
