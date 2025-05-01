const express = require('express');
const auth = require('../middleware/auth');
const {
  getConnections,
  sendConnectionRequest,
  respondToRequest,
  removeConnection,
  checkConnectionStatus,
  checkRequestStatus
} = require('../controllers/connectionController');

const router = express.Router();
router.use(auth);

// Existing routes
router.get('/', getConnections);
router.post('/request/:userId', sendConnectionRequest);
router.post('/respond/:requestId', respondToRequest);
router.delete('/:connectionId', removeConnection);

// Status check routes
router.get('/check/:userId', checkConnectionStatus); // ✅ Matches frontend's checkConnectionStatus
router.get('/request/check/:userId', checkRequestStatus); // ✅ Add this critical route

module.exports = router;
