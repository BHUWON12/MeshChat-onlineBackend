// backend/routes/messageRoutes.js
const express = require('express');
const messageController = require('../controllers/messageController');
const auth = require('../middleware/auth'); // Assuming auth middleware is correctly exported as default

const router = express.Router();

// Apply authentication middleware to all routes in this router
router.use(auth);

// --- Message Routes ---
// Routes for messages *within* a specific chat, using chatId in the URL
// These routes will be mounted under /api/v1/chats/:chatId in server.js
router.route('/:chatId/messages')
  .get(messageController.getMessages) // GET /api/v1/chats/:chatId/messages
  .post(messageController.sendMessage); // POST /api/v1/chats/:chatId/messages

// Routes for operations on a specific message, using messageId in the URL
// These routes will be mounted under /api/v1/messages in server.js
router.route('/:messageId')
  .patch(messageController.updateMessage) // PATCH /api/v1/messages/:messageId
  .delete(messageController.deleteMessage); // DELETE /api/v1/messages/:messageId

// Route for marking a specific message as read
// This will be mounted under /api/v1/messages in server.js
router.patch('/:messageId/read', messageController.markAsRead); // PATCH /api/v1/messages/:messageId/read


module.exports = router;
