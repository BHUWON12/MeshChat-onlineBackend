const express = require('express');
const { getCurrentUser, updateUserProfile } = require('../controllers/userController');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/me', auth, getCurrentUser);
router.put('/me', auth, updateUserProfile);

module.exports = router;
