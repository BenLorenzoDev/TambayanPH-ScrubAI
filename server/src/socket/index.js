import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';

// Store connected users
const connectedUsers = new Map();

export const initializeSocket = (io) => {
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, config.jwt.secret);
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();
    logger.info(`User connected: ${socket.user.email}`);

    // Store connection
    connectedUsers.set(userId, socket.id);

    // Join user to their own room
    socket.join(userId);

    // Join role-based rooms
    socket.join(`role:${socket.user.role}`);

    // Emit current online agents to supervisors/admins
    io.to('role:supervisor').to('role:admin').emit('agents:online', {
      count: connectedUsers.size,
      agents: Array.from(connectedUsers.keys()),
    });

    // Handle agent status change
    socket.on('agent:setStatus', async (status) => {
      try {
        await User.findByIdAndUpdate(userId, { status });
        io.emit('agent:statusChanged', { agentId: userId, status });
        logger.info(`Agent ${socket.user.email} status changed to ${status}`);
      } catch (error) {
        socket.emit('error', { message: 'Failed to update status' });
      }
    });

    // Handle call events
    socket.on('call:answer', (data) => {
      io.emit('call:answered', { ...data, agentId: userId });
    });

    socket.on('call:hold', (data) => {
      io.emit('call:onHold', { ...data, agentId: userId });
    });

    socket.on('call:resume', (data) => {
      io.emit('call:resumed', { ...data, agentId: userId });
    });

    // Handle supervisor listening to call
    socket.on('call:listen', (data) => {
      const { callId, agentId } = data;
      socket.join(`call:${callId}`);
      logger.info(`Supervisor ${socket.user.email} listening to call ${callId}`);
    });

    socket.on('call:stopListen', (data) => {
      const { callId } = data;
      socket.leave(`call:${callId}`);
    });

    // Handle whisper (only agent hears)
    socket.on('call:whisper', (data) => {
      const { callId, agentId, message } = data;
      io.to(agentId).emit('call:whisperMessage', { callId, message });
    });

    // Handle barge-in (everyone hears)
    socket.on('call:barge', (data) => {
      const { callId, message } = data;
      io.to(`call:${callId}`).emit('call:bargeMessage', { callId, message });
    });

    // Disconnect handling
    socket.on('disconnect', async () => {
      connectedUsers.delete(userId);

      // Set user status to offline
      await User.findByIdAndUpdate(userId, { status: 'offline' });
      io.emit('agent:statusChanged', { agentId: userId, status: 'offline' });

      logger.info(`User disconnected: ${socket.user.email}`);

      // Update online agents count
      io.to('role:supervisor').to('role:admin').emit('agents:online', {
        count: connectedUsers.size,
        agents: Array.from(connectedUsers.keys()),
      });
    });
  });
};

export const getConnectedUsers = () => connectedUsers;
