const express = require('express');
const auth = require('../middleware/auth');
const {
  getConnections,
  sendConnectionRequest,
  respondToRequest,
  removeConnection,
  checkConnectionRequest, // new controller method
} = require('../controllers/connectionController');

const router = express.Router();

router.use(auth);

router.get('/', getConnections);
router.post('/request/:userId', sendConnectionRequest);
router.post('/respond/:requestId', respondToRequest);
router.delete('/:connectionId', removeConnection);

// New route to check if a connection request exists
router.get('/request/check/:userId', checkConnectionRequest);

module.exports = router;
