// services/socketService.js

const socketio = require('socket.io');
const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const User = require('../models/User');
const Chat = require('../models/Chat');

let io;

const initializeSocket = (server) => {
  console.log('Initializing Socket.IO...');
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
    console.log('A user connected to WebSocket'); // --- BACKEND LOG 1 ---
    // Mark user as online
    User.findByIdAndUpdate(socket.user.id, { isOnline: true, lastActive: Date.now() }).exec();

    // Handle presence updates
    socket.on('presence', (isOnline) => {
      User.findByIdAndUpdate(socket.user.id, { isOnline, lastActive: Date.now() }).exec();
    });

    // Join a chat room
    socket.on('join-chat', (chatId) => {
      socket.join(chatId);
      console.log(`User ${socket.user.id} joined chat: ${chatId}`); // --- BACKEND LOG 2 ---
    });

    // Send a message
    socket.on('send-message', async (data, callback) => {
      try {
        console.log('Backend received send-message event:', data); // --- BACKEND LOG 3 ---
        // Validate chat and participants
        const chat = await Chat.findById(data.chatId);
        if (!chat) {
          console.log('Chat not found'); // --- BACKEND LOG 4 ---
          return callback && typeof callback === 'function' && callback({ status: 'error', message: 'Chat not found' });
        }
        if (!chat.participants.some(p => p.equals(socket.user.id))) {
          console.log('Not authorized for this chat'); // --- BACKEND LOG 5 ---
          return callback && typeof callback === 'function' && callback({ status: 'error', message: 'Not authorized for this chat' });
        }

        // Log before creating the message
        console.log('Attempting to create message with data:', {
          chatId: data.chatId,
          sender: socket.user.id,
          content: data.content,
          type: data.type || 'text',
          metadata: data.metadata || {},
        });

        // Create and save the message
        const message = await Message.create({
          chatId: data.chatId,
          sender: socket.user.id,
          content: data.content,
          type: data.type || 'text',
          metadata: data.metadata || {},
        });

        // Log after successfully creating the message
        console.log('Message created successfully:', message);

        // Update chat's last message
        chat.lastMessage = message._id;
        await chat.save();

        console.log('Backend emitting new-message event:', message); // --- BACKEND LOG 6 ---
        // Emit to all users in the chat room
        io.to(data.chatId).emit('new-message', message);
        // Check if callback is a function before calling
        if (callback && typeof callback === 'function') {
          callback({ status: 'success', message });
        }
      } catch (err) {
        console.error('Error processing send-message:', err); // --- BACKEND LOG 7 ---
        // Check if callback is a function before calling
        if (callback && typeof callback === 'function') {
          callback({ status: 'error', message: err.message });
        }
      }
    });

    // Mark as read
    socket.on('mark-as-read', async (data, callback) => {
      try {
        console.log('mark-as-read event received:', data);
        const message = await Message.findById(data.messageId);
        if (!message) return callback && typeof callback === 'function' && callback({ status: 'error', message: 'Message not found' });

        const chat = await Chat.findById(message.chatId);
        if (!chat.participants.some(p => p.equals(socket.user.id))) {
          return callback && typeof callback === 'function' && callback({ status: 'error', message: 'Not authorized for this chat' });
        }

        message.status = 'read';
        await message.save();

        io.to(message.chatId.toString()).emit('message-read', { messageId: message._id, userId: socket.user.id });
        callback && typeof callback === 'function' && callback({ status: 'success' });
      } catch (err) {
        console.error('Error processing mark-as-read:', err);
        callback && typeof callback === 'function' && callback({ status: 'error', message: err.message });
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log('A user disconnected from WebSocket'); // --- BACKEND LOG 8 ---
      User.findByIdAndUpdate(socket.user.id, { isOnline: false, lastActive: Date.now() }).exec();
    });
  });
};

module.exports = { initializeSocket };
