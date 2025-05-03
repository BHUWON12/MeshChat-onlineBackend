const express = require('express');
const messageController = require('../controllers/messageController');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);

// Message routes
router.post('/chats/:chatId/messages', messageController.sendMessage);
router.get('/chats/:chatId/messages', messageController.getMessages);
router.patch('/messages/:messageId', messageController.updateMessage);
router.delete('/messages/:messageId', messageController.deleteMessage);
router.patch('/messages/:messageId/read', messageController.markAsRead);

module.exports = router;
