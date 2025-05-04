// services/socketService.js

const socketio = require('socket.io');
const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const User = require('../models/User');
const Chat = require('../models/Chat');

let io;

const initializeSocket = (server) => {
  io = socketio(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*', // Ensure this matches your frontend URL
      methods: ['GET', 'POST'],
      credentials: true,
    }
  });

  // Authenticate socket connections using JWT
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error: No token provided'));
   
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) return next(new Error('Authentication error: Invalid token'));
      socket.user = decoded;
      next();
    });
    
  });

  io.on('connection', (socket) => {
    // Mark user as online
    User.findByIdAndUpdate(socket.user.id, { isOnline: true, lastActive: Date.now() }).exec();

    // Handle presence updates
    socket.on('presence', (isOnline) => {
      User.findByIdAndUpdate(socket.user.id, { isOnline, lastActive: Date.now() }).exec();
    });

    // Join a chat room
    socket.on('join-chat', (chatId) => {
      socket.join(chatId);
    });

    // Send a message
    socket.on('send-message', async (data, callback) => {
      try {
        // Validate chat and participants
        const chat = await Chat.findById(data.chatId);
        if (!chat) return callback({ status: 'error', message: 'Chat not found' });
        if (!chat.participants.some(p => p.equals(socket.user.id))) {
          return callback({ status: 'error', message: 'Not authorized for this chat' });
        }

        // Create and save the message
        const message = await Message.create({
          chatId: data.chatId,
          sender: socket.user.id,
          content: data.content,
          type: data.type || 'text',
          metadata: data.metadata || {},
        });

        // Update chat's last message
        chat.lastMessage = message._id;
        await chat.save();

        // Emit to all users in the chat room
        io.to(data.chatId).emit('new-message', message);
        callback({ status: 'success', message });
      } catch (err) {
        callback({ status: 'error', message: err.message });
      }
    });

    // Mark as read
    socket.on('mark-as-read', async (data, callback) => {
      try {
        const message = await Message.findById(data.messageId);
        if (!message) return callback({ status: 'error', message: 'Message not found' });

        const chat = await Chat.findById(message.chatId);
        if (!chat.participants.some(p => p.equals(socket.user.id))) {
          return callback({ status: 'error', message: 'Not authorized for this chat' });
        }

        message.status = 'read';
        await message.save();

        io.to(message.chatId.toString()).emit('message-read', { messageId: message._id, userId: socket.user.id });
        callback({ status: 'success' });
      } catch (err) {
        callback({ status: 'error', message: err.message });
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      User.findByIdAndUpdate(socket.user.id, { isOnline: false, lastActive: Date.now() }).exec();
    });
  });
};

module.exports = { initializeSocket };
