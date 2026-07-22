import type { Server as SocketServer, Socket } from 'socket.io';
import { verifyToken, accessibleAccountIds } from './auth/service.js';

export function setupSockets(io: SocketServer): void {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string') return next(new Error('Authentication required'));
    const user = verifyToken(token);
    if (!user) return next(new Error('Invalid token'));
    (socket.data as { user: typeof user }).user = user;
    next();
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as ReturnType<typeof verifyToken>;
    if (!user) {
      socket.disconnect(true);
      return;
    }
    socket.join(`user:${user.id}`);
    if (user.role === 'admin') {
      socket.join('admins');
    } else {
      for (const accountId of accessibleAccountIds(user)) {
        socket.join(`account:${accountId}`);
      }
    }
  });
}
