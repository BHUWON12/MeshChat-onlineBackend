// backend/controllers/connectionController.js

const Connection = require('../models/Connection');
const User = require('../models/User');
const AppError = require('../utils/appError');
const notificationController = require('./notificationController'); // Import notification controller
const { emitToUser } = require('../services/socketService'); // Import emitToUser from socketService


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

exports.sendConnectionRequest = async (req, res, next) => {
  try {
    const requester = req.user._id;
    const recipient = req.params.userId; // Assuming recipient ID is in URL params

     // Basic validation if recipient ID is missing or invalid format
     if (!mongoose.Types.ObjectId.isValid(recipient)) {
          return next(new AppError('Invalid recipient user ID', 400));
     }

    if (requester.equals(recipient)) {
      return next(new AppError('Cannot connect with yourself', 400));
    }

    // Check if recipient user exists
    const recipientUser = await User.findById(recipient);
    if (!recipientUser) {
        return next(new AppError('Recipient user not found', 404));
    }


    const existing = await Connection.findOne({
      $or: [
        { requester, recipient },
        { requester: recipient, recipient: requester }
      ]
    });

    if (existing) {
       let message = 'Connection already exists';
       if(existing.status === 'pending' && existing.recipient.equals(requester)) {
           message = 'User has already sent you a connection request.';
       } else if (existing.status === 'pending' && existing.requester.equals(requester)) {
           message = 'You have already sent a connection request to this user.';
       } else if (existing.status === 'accepted') {
           message = 'You are already connected with this user.';
       } else if (existing.status === 'rejected') {
           message = 'Connection request was previously rejected.'; // Or handle re-request logic
       }
      return next(new AppError(message, 400));
    }

    const connection = await Connection.create({ requester, recipient, status: 'pending' }); // Explicitly set status

    // --- Create and emit notification for connection request ---
    try {
         // The user who sent the request is req.user (populated by protect middleware)
         const senderUser = req.user; // Use the populated user from req

         const newNotification = await notificationController.createNotification(
             recipient, // Notification receiver is the target user
             'connection_request', // Type
             { // Data payload
                 senderId: requester.toString(), // Sender is the one who initiated
                 requestId: connection._id.toString(), // Link to the request
                 // Include sender info for frontend display
                 senderUsername: senderUser.username,
                 senderAvatar: senderUser.avatar,
             }
         );

         // Populate the sender on the notification object before emitting
         // to match the frontend Notification interface expectation
         const notificationPayload = {
            ...newNotification.toObject(), // Convert Mongoose doc to plain object
            sender: { // Add sender info to the notification payload
                 _id: senderUser._id.toString(),
                 username: senderUser.username,
                 avatar: senderUser.avatar,
            },
             // Ensure data field structure matches frontend expectation
            data: {
                ...newNotification.data, // Keep existing data
                requestId: connection._id.toString(), // Ensure requestId is a string
            }
         };

         // Emit notification via socket to the recipient's user room
         emitToUser(recipient, 'new-notification', notificationPayload);
         console.log(`ConnectionController: Emitted new-notification (request) to user ${recipient}`);


    } catch (notificationErr) {
         console.error('ConnectionController: Error creating/emitting connection request notification:', notificationErr);
         // Don't stop the main request, just log the error
    }
    // --- END ADD BLOCK ---


    res.status(201).json({ status: 'success', data: connection });
  } catch (err) {
    next(err);
  }
};

exports.respondToRequest = async (req, res, next) => {
  try {
    const { action } = req.body;
    const requestId = req.params.requestId; // Request ID from URL params
     const respondentId = req.user._id; // The user accepting/rejecting

    if (!['accept', 'reject'].includes(action)) {
      return next(new AppError('Invalid action', 400));
    }
     // Basic validation if request ID is missing or invalid
     if (!mongoose.Types.ObjectId.isValid(requestId)) {
          return next(new AppError('Invalid connection request ID', 400));
     }


    const connection = await Connection.findById(requestId).populate('requester recipient', '_id username avatar'); // Populate for notification info

    if (!connection) {
      return next(new AppError('Request not found', 404));
    }

    // Ensure the respondent is the recipient of the request
    if (!connection.recipient._id.equals(respondentId)) {
      return next(new AppError('Unauthorized action', 403));
    }

    // Prevent responding if status is not pending
    if (connection.status !== 'pending') {
         return next(new AppError(`Request is no longer pending (status: ${connection.status})`, 400));
    }

    connection.status = action === 'accept' ? 'accepted' : 'rejected';
    await connection.save();


    // --- Create and emit notification for connection acceptance ---
    if (action === 'accept') {
        try {
             // The notification goes to the original requester
             const requesterId = connection.requester._id;
             // The sender of the notification is the one who accepted (respondent)
             const senderUser = req.user; // Use the populated user from req

             const newNotification = await notificationController.createNotification(
                 requesterId, // Notification receiver is the original requester
                 'connection_accepted', // Type
                 { // Data payload
                     senderId: respondentId.toString(), // Sender is the one who accepted
                     connectionId: connection._id.toString(), // Link to the connection
                     // Include sender (acceptor) info for frontend display
                     senderUsername: senderUser.username, // The acceptor's username
                     senderAvatar: senderUser.avatar,   // The acceptor's avatar
                 }
             );

             // Populate sender details before emitting for frontend use
             const notificationPayload = {
                ...newNotification.toObject(),
                sender: {
                     _id: senderUser._id.toString(),
                     username: senderUser.username,
                     avatar: senderUser.avatar,
                },
                data: {
                     ...newNotification.data, // Keep existing data
                    connectionId: connection._id.toString(), // Ensure connectionId is string
                }
             };
             // Emit notification via socket to the requester's room
             emitToUser(requesterId, 'new-notification', notificationPayload);
             console.log(`ConnectionController: Emitted new-notification (accepted) to user ${requesterId}`);

        } catch (notificationErr) {
             console.error('ConnectionController: Error creating/emitting connection accepted notification:', notificationErr);
             // Don't stop the main request, just log the error
        }
    }
    // --- END ADD BLOCK ---


    res.status(200).json({ status: 'success', data: connection });
  } catch (err) {
    next(err);
  }
};

exports.removeConnection = async (req, res, next) => {
     try {
        const connectionId = req.params.connectionId;
        const userId = req.user._id; // User performing the removal

        if (!mongoose.Types.ObjectId.isValid(connectionId)) {
             return next(new AppError('Invalid connection ID', 400));
        }

         // Find the connection first to get participants
         const connection = await Connection.findById(connectionId);

         if (!connection) {
             return next(new AppError('Connection not found', 404));
         }

         // Ensure the user performing the removal is one of the participants
         if (!connection.requester.equals(userId) && !connection.recipient.equals(userId)) {
             return next(new AppError('Unauthorized to remove this connection', 403));
         }


        const result = await Connection.deleteOne({
          _id: connectionId,
          $or: [
            { requester: userId },
            { recipient: userId }
          ]
        });

        if (result.deletedCount === 0) {
          return next(new AppError('Connection not found or not authorized to remove', 404));
        }

        // TODO: Optionally emit a socket event to the *other* participant
        // to notify them that the connection was removed.
         const otherParticipantId = connection.requester.equals(userId) ? connection.recipient._id : connection.requester._id;
        // emitToUser(otherParticipantId, 'connection-removed', { connectionId: connectionId.toString() });
        // Consider also deleting related notifications (e.g., the original request/accepted notifications)

        res.status(204).json({ status: 'success', data: null });
      } catch (err) {
        next(err);
      }
};

exports.checkConnectionStatus = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const otherUserId = req.params.userId;

     if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
          return next(new AppError('Invalid user ID', 400));
     }


    const connection = await Connection.findOne({
      status: 'accepted',
      $or: [
        { requester: userId, recipient: otherUserId },
        { requester: otherUserId, recipient: userId }
      ]
    });

    res.status(200).json({
      status: 'success',
      isConnected: !!connection, // Use isConnected for clarity
      connectionStatus: connection ? 'accepted' : null // Return status if found
    });
  } catch (err) {
    next(err);
  }
};

exports.checkRequestStatus = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const otherUserId = req.params.userId;

     if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
          return next(new AppError('Invalid user ID', 400));
     }

    const request = await Connection.findOne({
      status: 'pending',
      $or: [
        { requester: userId, recipient: otherUserId },
        { requester: otherUserId, recipient: userId }
      ]
    });

    res.status(200).json({
      status: 'success',
      hasPendingRequest: !!request, // Use hasPendingRequest for clarity
      requestStatus: request ? (request.requester.equals(userId) ? 'sent' : 'received') : null // Indicate if sent or received
    });
  } catch (err) {
    next(err);
  }
};

exports.checkConnectionRequest = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const otherUserId = req.params.userId;

    if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
         return next(new AppError('Invalid user ID', 400));
    }


    const existing = await Connection.findOne({
      $or: [
        { requester: userId, recipient: otherUserId },
        { requester: otherUserId, recipient: userId }
      ]
    });

    res.status(200).json({
      status: 'success',
      exists: !!existing,
      connectionStatus: existing?.status || null, // Return the actual status (pending, accepted, rejected)
       isRequester: existing ? existing.requester.equals(userId) : null, // Indicate if the current user was the requester
    });
  } catch (err) {
    next(err);
  }
};

const mongoose = require('mongoose'); // Import mongoose for isValid