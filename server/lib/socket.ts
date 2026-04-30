import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { dbGet } from './db.js';
import { logger } from './logger.js';
import { verifyAuthToken, type AuthUser } from './auth.js';

let io: Server | null = null;

function parseCookieHeader(header: string | undefined) {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const [rawKey, ...rawValue] = part.trim().split('=');
    if (!rawKey) continue;
    cookies[rawKey] = decodeURIComponent(rawValue.join('=') || '');
  }
  return cookies;
}

function getAllowedSocketOrigins() {
  return (process.env.SOCKET_CORS_ORIGIN || process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function initSocket(server: HttpServer) {
  const allowedOrigins = getAllowedSocketOrigins();
  io = new Server(server, allowedOrigins.length ? {
    cors: {
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST'],
    },
  } : {});

  io.use(async (socket, next) => {
    try {
      const token = parseCookieHeader(socket.request.headers.cookie).token;
      if (!token) {
        return next(new Error('AUTH_REQUIRED'));
      }
      const user = verifyAuthToken(token);
      const currentUser = await dbGet<{ id: number; active: number | null }>(
        `SELECT id, active FROM users WHERE id = ?`,
        [user.id],
      );
      if (!currentUser || currentUser.active === 0) {
        return next(new Error('ACCOUNT_DISABLED'));
      }
      socket.data.user = user;
      next();
    } catch (_error) {
      next(new Error('AUTH_EXPIRED'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user as AuthUser;
    socket.join(`user-${user.id}`);
    logger.info({ socketId: socket.id, userId: user.id }, '[Socket] User connected');

    socket.on('disconnect', () => {
      logger.info({ socketId: socket.id, userId: user.id }, '[Socket] User disconnected');
    });
  });

  return io;
}

export function getIO() {
  if (!io) {
    // In some environments (like tests), io might not be initialized
    return null;
  }
  return io;
}

export function emitToUser(userId: number, event: string, data: any) {
  if (io) {
    io.to(`user-${userId}`).emit(event, data);
  }
}

export function emitToAll(event: string, data: any) {
  if (io) {
    io.emit(event, data);
  }
}
