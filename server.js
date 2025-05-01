// Load Environment Variables
require('dotenv').config();

// Core Modules
const path = require('path');
const http = require('http');

// Third-party Packages
const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const socketio = require('socket.io');
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
const { initializeSocket } = require('./services/socketService');
const errorHandler = require('./middleware/errorHandler');
const userRoutes = require('./routes/userRoutes');
const connectionRoutes = require('./routes/connectionRoutes');

// Initialize App
const app = express();
const server = http.createServer(app);

// ----------------------
// Connect to Database
// ----------------------
dbConnect();

// ----------------------
// CORS Configuration (Critical Fix)
// ----------------------
const whitelist = [
  'http://localhost:8081',          // React Native web dev
  'http://localhost:19006',         // Expo web
  'exp://192.168.1.10:19000',      // Expo on device (replace with your LAN IP)
  'https://meshchat-onlinebackend.onrender.com' // Production backend
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl)
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
app.options('*', cors(corsOptions)); // Explicit OPTIONS handler

// ----------------------
// Global Middlewares
// ----------------------

// Set Security HTTP headers
app.use(helmet());

// Logging Middleware (only in development)
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Body Parser
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Data Sanitization against NoSQL Injection & XSS
app.use(mongoSanitize());
app.use(xss());

// Prevent HTTP Parameter Pollution
app.use(hpp());

// Rate Limiting
// app.use('/api', rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 1000,
//   message: 'Too many requests from this IP, please try again later.'
// }));

// Serving Static Files
app.use(express.static(path.join(__dirname, 'public')));

// ----------------------
// API Routes
// ----------------------
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/chats', chatRoutes);
app.use('/api/v1/messages', messageRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/connections', connectionRoutes);

// ----------------------
// Socket.io Setup
// ----------------------
initializeSocket(server);

// ----------------------
// Global Error Handler
// ----------------------
app.use(errorHandler);

// ----------------------
// Process Event Handling
// ----------------------
process.on('unhandledRejection', (err) => {
  console.error('💥 UNHANDLED REJECTION! Shutting down...');
  console.error(err.name, err.message);
  server.close(() => process.exit(1));
});

process.on('SIGTERM', () => {
  console.log('👋 SIGTERM RECEIVED. Shutting down gracefully.');
  server.close(() => console.log('💥 Process terminated.'));
});

// ----------------------
// Start Server
// ----------------------
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

server.listen(PORT, () => {
  console.log(`🚀 Server running in ${NODE_ENV} mode on port ${PORT}`);
});
