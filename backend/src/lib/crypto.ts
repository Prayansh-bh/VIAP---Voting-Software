import crypto from 'crypto';
import { env } from '../config/env.js';

export function hashOtp(otpCode: string, mobileNumber: string): string {
  const secret = env.OTP_SECRET || env.JWT_SECRET;
  return crypto
    .createHmac('sha256', secret)
    .update(`${mobileNumber.trim()}:${otpCode.trim()}`)
    .digest('hex');
}

export function verifyOtpHash(inputOtp: string, mobileNumber: string, storedHashOrPlain: string): boolean {
  if (!storedHashOrPlain || !inputOtp) return false;

  const expectedHash = hashOtp(inputOtp, mobileNumber);

  // If stored value is a sha256 hex hash (64 hex characters)
  if (storedHashOrPlain.length === 64 && /^[0-9a-f]+$/i.test(storedHashOrPlain)) {
    try {
      const a = Buffer.from(expectedHash, 'hex');
      const b = Buffer.from(storedHashOrPlain, 'hex');
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  // Development/test plaintext fallback strictly forbidden in production
  if (env.NODE_ENV !== 'production') {
    return inputOtp.trim() === storedHashOrPlain.trim();
  }

  return false;
}

export function generateSecureOtp(): string {
  // Generates uniform cryptographically secure 6-digit integer in range [100000, 999999] inclusive
  return String(crypto.randomInt(100000, 1000000));
}
