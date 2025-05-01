const Connection = require('../models/Connection');
const User = require('../models/User');
const AppError = require('../utils/appError');

// Get all connections and requests
exports.getConnections = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const accepted = await Connection.find({
      $and: [
        { status: 'accepted' },
        { $or: [{ requester: userId }, { recipient: userId }] }
      ]
    }).populate('requester recipient', 'username avatar');

    const pendingReceived = await Connection.find({
      recipient: userId,
      status: 'pending'
    }).populate('requester', 'username avatar');

    const pendingSent = await Connection.find({
      requester: userId,
      status: 'pending'
    }).populate('recipient', 'username avatar');

    res.status(200).json({
      status: 'success',
      data: { accepted, pendingReceived, pendingSent }
    });
  } catch (err) {
    next(err);
  }
};

// Send connection request
exports.sendConnectionRequest = async (req, res, next) => {
  try {
    const requester = req.user._id;
    const recipient = req.params.userId;

    if (requester.equals(recipient)) {
      return next(new AppError('Cannot connect with yourself', 400));
    }

    const existing = await Connection.findOne({
      $or: [
        { requester, recipient },
        { requester: recipient, recipient: requester }
      ]
    });

    if (existing) {
      return next(new AppError('Connection already exists', 400));
    }

    const connection = await Connection.create({ requester, recipient });
    res.status(201).json({ status: 'success', data: connection });
  } catch (err) {
    next(err);
  }
};

// Respond to request
exports.respondToRequest = async (req, res, next) => {
  try {
    const { action } = req.body;
    const requestId = req.params.requestId;

    if (!['accept', 'reject'].includes(action)) {
      return next(new AppError('Invalid action', 400));
    }

    const connection = await Connection.findById(requestId);

    if (!connection) {
      return next(new AppError('Request not found', 404));
    }

    if (!connection.recipient.equals(req.user._id)) {
      return next(new AppError('Unauthorized action', 403));
    }

    connection.status = action === 'accept' ? 'accepted' : 'rejected';
    await connection.save();

    res.status(200).json({ status: 'success', data: connection });
  } catch (err) {
    next(err);
  }
};

// Remove connection
exports.removeConnection = async (req, res, next) => {
  try {
    const result = await Connection.deleteOne({
      _id: req.params.connectionId,
      $or: [
        { requester: req.user._id },
        { recipient: req.user._id }
      ]
    });

    if (result.deletedCount === 0) {
      return next(new AppError('Connection not found', 404));
    }

    res.status(204).json({ status: 'success', data: null });
  } catch (err) {
    next(err);
  }
};

// Check connection status
exports.checkConnectionStatus = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const otherUserId = req.params.userId;

    const connection = await Connection.findOne({
      status: 'accepted',
      $or: [
        { requester: userId, recipient: otherUserId },
        { requester: otherUserId, recipient: userId }
      ]
    });

    res.status(200).json({
      status: 'success',
      exists: !!connection,
      accepted: !!connection
    });
  } catch (err) {
    next(err);
  }
};

// Check request status
exports.checkRequestStatus = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const otherUserId = req.params.userId;

    const request = await Connection.findOne({
      status: 'pending',
      $or: [
        { requester: userId, recipient: otherUserId },
        { requester: otherUserId, recipient: userId }
      ]
    });

    res.status(200).json({
      status: 'success',
      exists: !!request
    });
  } catch (err) {
    next(err);
  }
};

// Check any existing connection/request
exports.checkConnectionRequest = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const otherUserId = req.params.userId;

    const existing = await Connection.findOne({
      $or: [
        { requester: userId, recipient: otherUserId },
        { requester: otherUserId, recipient: userId }
      ]
    });

    res.status(200).json({
      status: 'success',
      exists: !!existing,
      status: existing?.status || null
    });
  } catch (err) {
    next(err);
  }
};
