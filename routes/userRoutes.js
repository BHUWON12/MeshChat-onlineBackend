const express = require('express');
const { getCurrentUser, updateUserProfile, searchUsers } = require('../controllers/userController');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/me', auth, getCurrentUser);
router.put('/me', auth, updateUserProfile);

// New route to search users by email (protected)
router.get('/search', auth, searchUsers);

module.exports = router;
