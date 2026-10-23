import { Redis } from 'ioredis';
import { env } from '../config/env.js';

let redisClient: Redis | null = null;
let subscriberClient: Redis | null = null;
let isRedisAvailable = false;

function maskRedisUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    if (u.password) u.password = '***';
    if (u.username) u.username = '***';
    return u.toString();
  } catch {
    return '[REDACTED]';
  }
}

export function getRedisClient(): Redis | null {
  if (!env.REDIS_URL) {
    return null;
  }

  if (!redisClient) {
    try {
      const isTls = env.REDIS_URL.startsWith('rediss://');
      redisClient = new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false,
        tls: isTls ? {} : undefined,
        retryStrategy(times) {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });

      redisClient.on('connect', () => {
        isRedisAvailable = true;
        console.log(`✅ Connected to Redis (${maskRedisUrl(env.REDIS_URL!)}) for distributed rate-limiting and socket messaging`);
      });

      redisClient.on('error', (err) => {
        isRedisAvailable = false;
        console.warn('⚠️ [Redis] Connection warning (falling back gracefully):', err.message);
      });
    } catch (err: any) {
      console.warn('⚠️ [Redis] Failed to initialize client:', err.message);
      return null;
    }
  }

  return redisClient;
}

export function createRedisSubscriber(): Redis | null {
  const primary = getRedisClient();
  if (!primary) return null;

  if (!subscriberClient) {
    subscriberClient = primary.duplicate();
    subscriberClient.on('error', (err) => {
      console.warn('⚠️ [Redis Subscriber] Connection warning:', err.message);
    });
  }

  return subscriberClient;
}

export function isRedisActive(): boolean {
  return isRedisAvailable && redisClient !== null;
}

export async function closeRedis(): Promise<void> {
  if (subscriberClient) {
    try {
      await subscriberClient.quit();
    } catch {
      subscriberClient.disconnect();
    }
    subscriberClient = null;
  }

  if (redisClient) {
    try {
      await redisClient.quit();
    } catch {
      redisClient.disconnect();
    }
    redisClient = null;
  }

  isRedisAvailable = false;
}
