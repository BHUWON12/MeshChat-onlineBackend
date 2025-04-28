const Connection = require('../models/Connection');
const User = require('../models/User');
const AppError = require('../utils/appError');

// Get all connections and pending requests for current user
exports.getConnections = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Find accepted connections where user is requester or recipient
    const accepted = await Connection.find({
      $and: [
        { status: 'accepted' },
        { $or: [{ requester: userId }, { recipient: userId }] },
      ],
    }).populate('requester recipient', 'username avatar');

    // Find pending requests received by user
    const pendingReceived = await Connection.find({
      recipient: userId,
      status: 'pending',
    }).populate('requester', 'username avatar');

    // Find pending requests sent by user
    const pendingSent = await Connection.find({
      requester: userId,
      status: 'pending',
    }).populate('recipient', 'username avatar');

    res.status(200).json({
      status: 'success',
      data: {
        accepted,
        pendingReceived,
        pendingSent,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Send a connection request
exports.sendConnectionRequest = async (req, res, next) => {
  try {
    const requester = req.user._id;
    const recipient = req.params.userId;

    if (requester.equals(recipient)) {
      return next(new AppError('Cannot send connection request to yourself', 400));
    }

    // Check if connection already exists
    const existing = await Connection.findOne({
      $or: [
        { requester, recipient },
        { requester: recipient, recipient: requester },
      ],
    });

    if (existing) {
      return next(new AppError('Connection or request already exists', 400));
    }

    const connection = await Connection.create({ requester, recipient });

    res.status(201).json({
      status: 'success',
      data: connection,
    });
  } catch (err) {
    next(err);
  }
};

// Respond to a connection request (accept or reject)
exports.respondToRequest = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const requestId = req.params.requestId;
    const { action } = req.body; // expected 'accept' or 'reject'

    if (!['accept', 'reject'].includes(action)) {
      return next(new AppError('Invalid action', 400));
    }

    const connection = await Connection.findById(requestId);

    if (!connection) {
      return next(new AppError('Connection request not found', 404));
    }

    if (!connection.recipient.equals(userId)) {
      return next(new AppError('Not authorized to respond to this request', 403));
    }

    connection.status = action === 'accept' ? 'accepted' : 'rejected';
    await connection.save();

    res.status(200).json({
      status: 'success',
      data: connection,
    });
  } catch (err) {
    next(err);
  }
};

exports.removeConnection = async (req, res, next) => {
  try {
    // REPLACE THIS
    // await connection.remove(); ❌ Old code causing error
    
    // WITH THIS ✅
    const result = await Connection.deleteOne({
      _id: req.params.connectionId,
      $or: [
        { requester: req.user._id },
        { recipient: req.user._id }
      ]
    });

    if (result.deletedCount === 0) {
      return next(new AppError('Connection not found or unauthorized', 404));
    }

    res.status(204).json({ status: 'success', data: null });
  } catch (err) {
    next(new AppError('Deletion failed', 500));
  }
};

// New controller: Check if a connection request exists between current user and another user
exports.checkConnectionRequest = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const otherUserId = req.params.userId;

    const existing = await Connection.findOne({
      $or: [
        { requester: userId, recipient: otherUserId },
        { requester: otherUserId, recipient: userId }
      ],
      status: { $in: ['pending', 'accepted'] }
    });

    res.status(200).json({
      status: 'success',
      exists: !!existing,
      data: existing,
    });
  } catch (err) {
    next(err);
  }
};
