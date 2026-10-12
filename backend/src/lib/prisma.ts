import { PrismaClient } from '@prisma/client';

declare global {
  var __kdpPrismaClient__: PrismaClient | undefined;
}

export const prisma =
  globalThis.__kdpPrismaClient__ ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__kdpPrismaClient__ = prisma;
}
