import crypto from 'crypto';
import { env } from '../config/env.js';

// ============================================================================
// 1. OTP Hashing & Verification (Baseline Security)
// ============================================================================

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

// ============================================================================
// 2. AES-256-GCM Database Encryption at Rest & Secret Masking
// ============================================================================

function getMasterKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || 'viap-secure-aes-256-gcm-master-encryption-key-32b!';
  return crypto.createHash('sha256').update(secret).digest();
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  authTag: string;
}

/**
 * Encrypts a plaintext secret using AES-256-GCM at rest.
 * Uses a unique 12-byte initialization vector (IV) per call.
 */
export function encryptSecret(plaintext: string): EncryptedPayload {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new Error('Plaintext secret must be a non-empty string');
  }

  const key = getMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return {
    ciphertext,
    iv: iv.toString('hex'),
    authTag,
  };
}

/**
 * Decrypts an AES-256-GCM ciphertext payload and validates authenticity tag.
 */
export function decryptSecret(payload: EncryptedPayload): string {
  const { ciphertext, iv, authTag } = payload;
  if (!ciphertext || !iv || !authTag) {
    throw new Error('Invalid encrypted payload: missing ciphertext, iv, or authTag');
  }

  const key = getMasterKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Masks a sensitive secret value for safe display and logging.
 * Example outputs:
 *   "sk_live_9876543210abcdef" -> "sk_live_...cdef"
 *   "msg91_super_secret_key" -> "msg91_..._key"
 *   "short" -> "****rt"
 */
export function maskSecret(secret: string): string {
  if (!secret || typeof secret !== 'string') {
    return '****';
  }

  const trimmed = secret.trim();

  // If secret starts with a known prefix pattern (e.g. sk_live_, ghp_, msg91_)
  const prefixMatch = trimmed.match(/^([a-zA-Z0-9_-]{3,8}_)/);
  if (prefixMatch && trimmed.length > prefixMatch[1].length + 4) {
    const prefix = prefixMatch[1];
    const tail = trimmed.slice(-4);
    return `${prefix}...${tail}`;
  }

  if (trimmed.length > 10) {
    const head = trimmed.slice(0, 4);
    const tail = trimmed.slice(-4);
    return `${head}...${tail}`;
  }

  if (trimmed.length > 4) {
    return `****${trimmed.slice(-2)}`;
  }

  return '****';
}
