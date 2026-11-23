import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

declare global {
  var __kdpPrismaClient__: PrismaClient | undefined;
}

let dbUrl = process.env.DATABASE_URL || '';
if (dbUrl.includes('-pooler') && !dbUrl.includes('pgbouncer=true')) {
  dbUrl += (dbUrl.includes('?') ? '&' : '?') + 'pgbouncer=true&connect_timeout=15';
}

export const prisma =
  globalThis.__kdpPrismaClient__ ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    ...(dbUrl ? { datasources: { db: { url: dbUrl } } } : {}),
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__kdpPrismaClient__ = prisma;
}
