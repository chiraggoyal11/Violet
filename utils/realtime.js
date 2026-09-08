const { Server } = require('socket.io');

let io = null;
const userSockets = new Map(); // userId -> Set(socketId)

function initRealtime(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || true,
      credentials: true,
    },
    path: '/socket.io',
  });

  io.on('connection', (socket) => {
    const userId = String(socket.handshake.auth?.userId || '').trim();
    if (userId) {
      if (!userSockets.has(userId)) userSockets.set(userId, new Set());
      userSockets.get(userId).add(socket.id);
      socket.join(`user:${userId}`);
    }

    socket.on('join_conversation', (conversationId) => {
      if (conversationId) socket.join(`convo:${conversationId}`);
    });

    socket.on('leave_conversation', (conversationId) => {
      if (conversationId) socket.leave(`convo:${conversationId}`);
    });

    socket.on('typing', ({ conversationId, username }) => {
      if (!conversationId) return;
      socket.to(`convo:${conversationId}`).emit('typing', {
        conversationId,
        username: username || 'Someone',
        userId,
      });
    });

    socket.on('disconnect', () => {
      if (!userId) return;
      const set = userSockets.get(userId);
      if (set) {
        set.delete(socket.id);
        if (!set.size) userSockets.delete(userId);
      }
    });
  });

  return io;
}

function getIo() {
  return io;
}

function emitToUser(userId, event, payload) {
  if (!io || !userId) return;
  io.to(`user:${String(userId)}`).emit(event, payload);
}

function emitToConversation(conversationId, event, payload) {
  if (!io || !conversationId) return;
  io.to(`convo:${String(conversationId)}`).emit(event, payload);
}

module.exports = {
  initRealtime,
  getIo,
  emitToUser,
  emitToConversation,
};
