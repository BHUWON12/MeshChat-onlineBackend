// const express = require('express');
// const { getCurrentUser, updateUserProfile, searchUsers } = require('../controllers/userController');
// const auth = require('../middleware/auth');

// const router = express.Router();

// router.get('/me', auth, getCurrentUser);
// router.put('/me', auth, updateUserProfile);

// // New route to search users by email (protected)
// router.get('/search', auth, searchUsers);

// module.exports = router;



const express = require('express');
const { 
  getCurrentUser, 
  updateUserProfile, 
  searchUsers,
  getConnections,
  checkConnectionStatus
} = require('../controllers/userController');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/me', auth, getCurrentUser);
router.put('/me', auth, updateUserProfile);
router.get('/search', auth, searchUsers);
router.get('/connections', auth, getConnections);
router.get('/connections/:userId/status', auth, checkConnectionStatus);

module.exports = router;
