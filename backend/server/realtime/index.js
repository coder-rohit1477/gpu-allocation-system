'use strict';

const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

const config = require('../config/env');
const User = require('../models/user/model');

const ROOM_PREFIX = 'user:';

let io;

const getBearerToken = (authorization) => {
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
    return null;
  }

  const token = authorization.slice(7).trim();
  return token || null;
};

const getSocketToken = (socket) =>
  socket.handshake.auth?.token ||
  getBearerToken(socket.handshake.headers.authorization);

const initializeRealtime = (httpServer) => {
  if (io) {
    return io;
  }

  io = new Server(httpServer, {
    cors: {
      origin: config.allowedOrigins,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = getSocketToken(socket);

      if (!token) {
        throw new Error('No token provided.');
      }

      const decoded = jwt.verify(token, config.jwtSecret);
      const currentUser = await User.findById(decoded.id).select('_id username role');

      if (!currentUser) {
        throw new Error('The user belonging to this token no longer exists.');
      }

      socket.data.user = {
        id: String(currentUser._id),
        username: currentUser.username,
        role: currentUser.role,
      };

      console.log(`[socket] Authentication success: user=${socket.data.user.id} socket=${socket.id}`);
      next();
    } catch (err) {
      console.error(`[socket] Authentication failure: socket=${socket.id} reason=${err.message}`);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.user?.id;
    const roomName = `${ROOM_PREFIX}${userId}`;

    console.log(`[socket] Connection established: user=${userId} socket=${socket.id}`);
    socket.join(roomName);

    socket.on('disconnect', (reason) => {
      console.log(`[socket] Disconnect: user=${userId} socket=${socket.id} reason=${reason}`);
    });
  });

  return io;
};

const emitToUser = (userId, eventName, payload) => {
  if (!io) {
    return false;
  }

  io.to(`${ROOM_PREFIX}${userId}`).emit(eventName, payload);
  return true;
};

const closeRealtime = async () => {
  if (!io) {
    return;
  }

  const instance = io;
  io = null;

  await new Promise((resolve) => {
    instance.close(() => resolve());
  });
};

module.exports = {
  initializeRealtime,
  emitToUser,
  closeRealtime,
};
