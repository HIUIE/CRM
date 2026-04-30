import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';

let io: Server | null = null;

export function initSocket(server: HttpServer) {
  io = new Server(server, {
    cors: {
      origin: '*', // Adjust for production if needed
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log('[Socket] User connected:', socket.id);

    socket.on('join-user-room', (userId: number) => {
      socket.join(`user-${userId}`);
      console.log(`[Socket] User ${userId} joined their private room`);
    });

    socket.on('disconnect', () => {
      console.log('[Socket] User disconnected');
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
