const express = require('express');
const messageController = require('../controllers/messageController');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);

// Message routes
router.post('/:chatId', messageController.sendMessage);
router.get('/:chatId', messageController.getMessages);
router.patch('/:messageId', messageController.updateMessage);
router.delete('/:messageId', messageController.deleteMessage);

module.exports = router;
