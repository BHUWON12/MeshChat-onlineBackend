// const express = require('express');
// const chatController = require('../controllers/chatController');
// const authController = require('../controllers/authController');

// const router = express.Router();

// router.use(authController.protect);

// router.post('/', chatController.createChat);
// router.post('/connect/:userId', chatController.connectToUser);
// router.get('/', chatController.getAllChats);
// router.get('/:id', chatController.getChat);
// router.patch('/:id', chatController.updateChat);
// router.delete('/:id', chatController.deleteChat);


// module.exports = router;
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
