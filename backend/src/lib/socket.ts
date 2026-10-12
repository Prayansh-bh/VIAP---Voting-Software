import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'node:http';
import { createAdapter } from '@socket.io/redis-adapter';
import { prisma } from './prisma.js';
import { verifyTokenAndSession } from '../middleware/auth.js';
import { computeUserHierarchyScope } from '../middleware/rbac.js';
import { UserHierarchyScope } from '../common/types.js';
import { getRedisClient, createRedisSubscriber } from './redis.js';

let io: SocketIOServer | null = null;

export function initSocketServer(httpServer: HTTPServer, corsOrigin: string): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: !corsOrigin || corsOrigin === '*' ? true : corsOrigin.split(',').map((s) => s.trim()),
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Enable Redis horizontal pub/sub adapter if Redis URL is configured
  const pubClient = getRedisClient();
  const subClient = createRedisSubscriber();
  if (pubClient && subClient) {
    io.adapter(createAdapter(pubClient, subClient));
  }

  // Enforce JWT authentication and session validation on socket handshake
  io.use(async (socket, next) => {
    try {
      const authHeader = socket.handshake.headers.authorization;
      const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
      const handshakeAuthToken = socket.handshake.auth?.token;
      const queryToken = typeof socket.handshake.query?.token === 'string' ? socket.handshake.query.token : undefined;

      const token = handshakeAuthToken || bearerToken || queryToken;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const result = await verifyTokenAndSession(token);
      if (!result.valid || !result.user) {
        return next(new Error('Authentication failed'));
      }

      const hierarchyScope = await computeUserHierarchyScope(result.user.userId);

      socket.data.user = result.user;
      socket.data.hierarchyScope = hierarchyScope;

      next();
    } catch {
      return next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    const scope: UserHierarchyScope = socket.data.hierarchyScope;

    if (!user || !scope) {
      socket.disconnect(true);
      return;
    }

    // Join ONLY the authenticated user's own room (never trust handshake userId)
    socket.join(`user:${user.userId}`);

    // Join user's assigned home unit room ONLY if authorized in hierarchy
    if (user.unitId && scope.accessibleUnitIds.has(user.unitId)) {
      socket.join(`unit:${user.unitId}`);
    }

    // Secure unit room joining: validate against authorized hierarchy scope
    socket.on('join:unit', (targetUnitId: string, ack?: (res: { success: boolean; error?: string }) => void) => {
      if (!targetUnitId || typeof targetUnitId !== 'string') {
        if (ack) ack({ success: false, error: 'Invalid unit identifier' });
        return;
      }

      if (scope.isGlobalScope || scope.accessibleUnitIds.has(targetUnitId)) {
        socket.join(`unit:${targetUnitId}`);
        if (ack) ack({ success: true });
      } else {
        socket.emit('error:unauthorized', { message: 'Unauthorized room access' });
        if (ack) ack({ success: false, error: 'Unauthorized' });
      }
    });

    socket.on('leave:unit', (targetUnitId: string) => {
      if (targetUnitId && typeof targetUnitId === 'string') {
        socket.leave(`unit:${targetUnitId}`);
      }
    });

    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });
  });

  return io;
}


export function getSocketIO(): SocketIOServer | null {
  return io;
}

export async function emitHierarchyEvent(unitId: string, event: string, payload: unknown) {
  if (!io) return;

  const units = await prisma.organizationUnit.findMany({
    select: { id: true, parentId: true, level: true, name: true },
  });

  const byId = new Map(units.map((u) => [u.id, u]));
  let current = byId.get(unitId);

  while (current) {
    io.to(`unit:${current.id}`).emit(event, payload);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
}

export async function broadcastTurnoutUpdate(unitId: string, delta: number, voteEventPayload: unknown) {
  if (!io) return;

  // Emit detailed event to the voter's direct unit and all parent rooms
  await emitHierarchyEvent(unitId, 'vote:event', voteEventPayload);
  await emitHierarchyEvent(unitId, 'summary:invalidate', { unitId, delta, timestamp: new Date() });
}
