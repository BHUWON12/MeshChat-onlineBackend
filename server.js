// Load Environment Variables
require('dotenv').config();

// Core Modules
const path = require('path');
const http = require('http');

// Third-party Packages
const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

// Local Modules
const dbConnect = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const messageRoutes = require('./routes/messageRoutes');
const userRoutes = require('./routes/userRoutes');
const connectionRoutes = require('./routes/connectionRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const { initializeSocket } = require('./services/socketService');
const errorHandler = require('./middleware/errorHandler');

// Initialize App
const app = express();
const server = http.createServer(app);

// Connect to Database
dbConnect();

// CORS Configuration
const whitelist = [
  'http://localhost:8081',
  'http://localhost:19006',
  'exp://192.168.1.10:19000', // Replace with your LAN IP if needed
  'https://meshchat-onlinebackend.onrender.com' // Production backend
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  credentials: true,
  allowedHeaders: 'Content-Type, Authorization, X-Requested-With'
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Global Middlewares
app.use(helmet());

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

// Rate Limiting (optional, uncomment to enable)
/*
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  message: 'Too many requests from this IP, please try again later.'
}));
*/

// Serving Static Files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/v1/auth', authRoutes);
// Mount chat routes at /api/v1/chats
app.use('/api/v1/chats', chatRoutes); // CHAT ROUTES MOUNTED HERE
// Mount message routes UNDER /api/v1/chats to match frontend requests
// The route in messageRoutes.js should be like '/:chatId/messages'
app.use('/api/v1/chats', messageRoutes); // MESSAGE ROUTES MOUNTED UNDER /api/v1/chats
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/connections', connectionRoutes);
app.use('/api/v1/notifications', notificationRoutes);


// Socket.io Setup
initializeSocket(server);

// Global Error Handler
app.use(errorHandler);

// Process Event Handling
process.on('unhandledRejection', (err) => {
  console.error('💥 UNHANDLED REJECTION! Shutting down...');
  console.error(err.name, err.message);
  server.close(() => process.exit(1));
});

process.on('SIGTERM', () => {
  console.log('👋 SIGTERM RECEIVED. Shutting down gracefully.');
  server.close(() => console.log('💥 Process terminated.'));
});

// Start Server
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

server.listen(PORT, () => {
  console.log(`🚀 Server running in ${NODE_ENV} mode on port ${PORT}`);
});
