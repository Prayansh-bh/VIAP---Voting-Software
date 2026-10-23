import { buildApp } from './app.js';
import { env } from './config/env.js';
import { initSocketServer } from './lib/socket.js';
import { prisma } from './lib/prisma.js';
import { closeRedis } from './lib/redis.js';
import { ImportQueueService } from './modules/applications/import-queue.service.js';

async function start() {
  const app = buildApp();

  try {
    await app.ready();
    const server = app.server;
    initSocketServer(server, env.CORS_ORIGIN);

    await app.listen({
      port: env.PORT,
      host: env.HOST,
    });

    app.log.info(`🚀 Kondapi Fastify Production Backend running on http://${env.HOST}:${env.PORT}`);

    // Initialize $0 in-process bulk CSV import queue processor
    ImportQueueService.init();

    // Pre-initialize WhatsApp Baileys Gateway in background if enabled
    if (env.WHATSAPP_PROVIDER === 'baileys' && env.NODE_ENV !== 'test') {
      const { SmsProviderFactory } = await import('./lib/sms/factory.js');
      const wa = SmsProviderFactory.getProvider('WHATSAPP');
      if ('initialize' in wa && typeof (wa as any).initialize === 'function') {
        (wa as any).initialize().catch((err: any) => {
          app.log.warn({ err }, 'WhatsApp Baileys background initialization notice');
        });
      }
    }
  } catch (err) {
    app.log.error(err, 'Failed to start server');
    process.exit(1);
  }

  let isShuttingDown = false;
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      app.log.info(`Received ${signal}, shutting down gracefully...`);
      ImportQueueService.stop();
      try {
        const { SmsProviderFactory } = await import('./lib/sms/factory.js');
        const wa = SmsProviderFactory.getProvider('WHATSAPP');
        if ('disconnect' in wa && typeof (wa as any).disconnect === 'function') {
          await (wa as any).disconnect();
        }
      } catch {}
      await app.close();
      await closeRedis();
      await prisma.$disconnect();
      process.exit(0);
    });
  });

  process.on('unhandledRejection', (reason) => {
    app.log.error({ reason }, 'Unhandled Promise Rejection caught at process level');
  });

  process.on('uncaughtException', (err) => {
    app.log.fatal({ err: err?.message || err }, 'Uncaught Exception at process level');
    process.exit(1);
  });
}

void start();
