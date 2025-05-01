
const express = require('express');
const chatController = require('../controllers/chatController');
const auth = require('../middleware/auth');

const router = express.Router();

// Unified chat initiation endpoint
router.post('/initiate/:userId', auth, chatController.initiateChat);

// Your existing endpoints
router.post('/', auth, chatController.createChat);
router.post('/connect/:userId', auth, chatController.connectToUser);
router.get('/', auth, chatController.getAllChats);
router.get('/:id', auth, chatController.getChat);
router.patch('/:id', auth, chatController.updateChat);
router.delete('/:id', auth, chatController.deleteChat);

module.exports = router;
