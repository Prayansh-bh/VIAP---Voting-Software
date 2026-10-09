import { env } from '../config/env.js';

/**
 * Resolves the trusted origin allowlist from env.CORS_ORIGIN.
 */
export function getTrustedOrigins(): string[] {
  if (!env.CORS_ORIGIN || env.CORS_ORIGIN === '*') return [];
  return env.CORS_ORIGIN.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

/**
 * Checks whether an incoming origin is authorized.
 * - Non-browser requests (no origin) are allowed for general CORS evaluation.
 * - When CORS_ORIGIN is '*' or unspecified, all browser origins are allowed (reflected for credentials).
 * - In production with specific origins: checks against explicit trusted origins.
 * - In development/test: allows localhost / 127.0.0.1 on any port, in addition to trusted origins.
 */
export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) {
    return true; // cURL, mobile apps, server-to-server health checks
  }

  // Allow all origins when CORS_ORIGIN is '*' or empty
  if (!env.CORS_ORIGIN || env.CORS_ORIGIN === '*') {
    return true;
  }

  const trusted = getTrustedOrigins();
  if (trusted.includes(origin)) {
    return true;
  }

  if (env.NODE_ENV !== 'production') {
    // Development/test localhost allowance
    const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    if (isLocal) {
      return true;
    }
  }

  return false;
}
