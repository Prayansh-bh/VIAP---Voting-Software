import { Redis } from 'ioredis';
import { env } from '../config/env.js';

let redisClient: Redis | null = null;
let isRedisAvailable = false;

export function getRedisClient(): Redis | null {
  if (!env.REDIS_URL) {
    return null;
  }

  if (!redisClient) {
    try {
      redisClient = new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false,
        retryStrategy(times) {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });

      redisClient.on('connect', () => {
        isRedisAvailable = true;
        console.log('✅ Connected to Redis cluster/store for rate-limiting and socket messaging');
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
  return primary.duplicate();
}

export function isRedisActive(): boolean {
  return isRedisAvailable && redisClient !== null;
}
