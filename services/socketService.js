const socketio = require('socket.io');
const jwt = require('jsonwebtoken');
const Message = require('../models/Message');

let io;

const initializeSocket = (server) => {
  io = socketio(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST']
    }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) return next(new Error('Authentication error'));
      socket.user = decoded;
      next();
    });
  });

  io.on('connection', (socket) => {
    console.log(`User ${socket.user.id} connected`);

    socket.on('join-chat', (chatId) => {
      socket.join(chatId);
      console.log(`User ${socket.user.id} joined chat ${chatId}`);
    });

    socket.on('send-message', async (data, callback) => {
      try {
        const message = await Message.create({
          chatId: data.chatId,
          sender: socket.user.id,
          content: data.content
        });
        
        io.to(data.chatId).emit('new-message', message);
        callback({ status: 'success', message });
      } catch (err) {
        callback({ status: 'error', message: err.message });
      }
    });

    socket.on('disconnect', () => {
      console.log(`User ${socket.user.id} disconnected`);
    });
  });
};

module.exports = { initializeSocket };
