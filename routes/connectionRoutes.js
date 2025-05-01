const express = require('express');
const auth = require('../middleware/auth');
const {
  getConnections,
  sendConnectionRequest,
  respondToRequest,
  removeConnection,
  checkConnectionStatus, // ✅ Must be exported
  checkRequestStatus     // ✅ Must be exported
} = require('../controllers/connectionController');

const router = express.Router();
router.use(auth);

// Existing routes
router.get('/', getConnections);
router.post('/request/:userId', sendConnectionRequest);
router.post('/respond/:requestId', respondToRequest);
router.delete('/:connectionId', removeConnection);

// Add status check routes
router.get('/check-status/:userId', checkConnectionStatus); // Line 23
router.get('/request-status/:userId', checkRequestStatus);

module.exports = router;
