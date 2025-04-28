const express = require('express');
const chatController = require('../controllers/chatController');
const authController = require('../controllers/authController');

const router = express.Router();

router.use(authController.protect);

router.post('/', chatController.createChat);
router.post('/connect/:userId', chatController.connectToUser);
router.get('/', chatController.getAllChats);
router.get('/:id', chatController.getChat);
router.patch('/:id', chatController.updateChat);
router.delete('/:id', chatController.deleteChat);


module.exports = router;
