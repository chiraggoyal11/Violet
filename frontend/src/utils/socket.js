import { io } from 'socket.io-client';

let socket = null;
let boundUserId = null;

/**
 * Singleton Socket.IO connection authenticated with the signed-in user id.
 * Reuses the existing connection when the same user reconnects.
 */
export function getSocket(userId) {
  const id = userId ? String(userId) : '';
  if (!id) return null;

  if (socket && boundUserId === id) {
    if (!socket.connected) socket.connect();
    return socket;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  boundUserId = id;
  socket = io({
    path: '/socket.io',
    auth: { userId: id },
    transports: ['websocket', 'polling'],
    autoConnect: true,
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    boundUserId = null;
  }
}
