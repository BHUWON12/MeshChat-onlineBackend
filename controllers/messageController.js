// backend/controllers/messageController.js
const Message = require('../models/Message');
const Chat = require('../models/Chat');
const AppError = require('../utils/appError');
// Assuming you have a Notification model and controller/service to create notifications
const Notification = require('../models/Notification'); // Assuming Notification model exists
const notificationController = require('./notificationController'); // Assuming you have a notification controller
const { emitToUser } = require('../services/socketService'); // Assuming you have emitToUser helper


// This controller function is used by the REST API route to send messages.
// Note: Real-time message sending is handled by the socketService.js 'send-message' event handler.
// This REST endpoint could be a fallback or used for non-real-time scenarios if needed.
// Ensure consistency between this and the socket handler regarding message creation and chat updates.
exports.sendMessage = async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.chatId);
    if (!chat) return next(new AppError('Chat not found', 404));

    if (!chat.participants.some(p => p.equals(req.user._id))) {
      return next(new AppError('Not authorized for this chat', 403));
    }

    // Validate content for text messages
    if ((req.body.type === 'text' || !req.body.type) && (req.body.content === undefined || req.body.content === null || req.body.content.trim() === '')) {
       return next(new AppError('Content is required for text messages', 400));
     }


    const message = await Message.create({
      chatId: req.params.chatId,
      sender: req.user._id,
      content: req.body.content,
      type: req.body.type || 'text',
      metadata: req.body.metadata || {},
       status: 'sent', // Set initial status
       readBy: [], // Initialize readBy array
    });

    // Update chat's last message and timestamp
    chat.lastMessage = message._id;
    chat.lastMessageAt = message.createdAt; // Update timestamp
    await chat.save();

    // Populate sender before sending response
    const populatedMessage = await Message.findById(message._id).populate('sender', 'username avatar').lean();

    // Optionally, only return necessary fields in the response
    const response = {
      _id: populatedMessage._id, // Use _id consistently
      chatId: populatedMessage.chatId,
      sender: populatedMessage.sender, // Populated sender
      content: populatedMessage.content,
      type: populatedMessage.type,
      createdAt: populatedMessage.createdAt,
      status: populatedMessage.status,
      readBy: populatedMessage.readBy,
      // Include tempId if sent from frontend via REST (less common for REST)
      // tempId: req.body.tempId,
    };

    res.status(201).json({ status: 'success', data: response });

     // Note: If using REST for sending, you might still want to emit a socket event
     // to other users in the chat if they are online, but the primary real-time flow
     // is usually handled by the socket 'send-message' event.

  } catch (err) {
    console.error('MessageController: Error in sendMessage (REST):', err);
    next(err);
  }
};


// This controller function is used by the REST API route to fetch messages for a chat.
exports.getMessages = async (req, res, next) => {
  try {
    const chatId = req.params.chatId; // Get chatId from URL params

     // Basic validation if chatId is missing or invalid format
     if (!chatId || !mongoose.Types.ObjectId.isValid(chatId)) {
          return next(new AppError('Invalid chat ID', 400));
     }


    const chat = await Chat.findById(chatId);
    if (!chat) return next(new AppError('Chat not found', 404));

    // Ensure the user is a participant in the chat
    if (!chat.participants.some(p => p.equals(req.user._id))) {
      return next(new AppError('Not authorized for this chat', 403));
    }

    // Optional: Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 1000; // Default limit to a higher number for initial load
    const skip = (page - 1) * limit;

    console.log(`MessageController: Fetching messages for chat ${chatId} with pagination (page: ${page}, limit: ${limit}, skip: ${skip})`);

    const messages = await Message.find({ chatId: chatId })
      .sort('createdAt') // Sort by creation date ascending
      .skip(skip)
      .limit(limit)
      .populate('sender', 'username avatar'); // Populate sender details

     console.log(`MessageController: Found ${messages.length} messages for chat ${chatId}.`);

    res.json({ status: 'success', data: messages }); // Return the array of messages directly
  } catch (err) {
    console.error('MessageController: Error in getMessages:', err);
    next(err);
  }
};


// This controller function is used by the REST API route to update a message.
exports.updateMessage = async (req, res, next) => {
  try {
    const messageId = req.params.messageId; // Get messageId from URL params

     if (!messageId || !mongoose.Types.ObjectId.isValid(messageId)) {
          return next(new AppError('Invalid message ID', 400));
     }

    const message = await Message.findById(messageId);
    if (!message) return next(new AppError('Message not found', 404));

    // Ensure the user is the sender of the message
    if (!message.sender.equals(req.user._id)) {
      return next(new AppError('Not authorized to update this message', 403));
    }

     // Basic validation for content update
     if (req.body.content === undefined || req.body.content === null || req.body.content.trim() === '') {
          return next(new AppError('Content cannot be empty', 400));
     }


    message.content = req.body.content;
    message.edited = true; // Mark as edited
    await message.save();

    // Populate sender before sending response
     const populatedMessage = await Message.findById(message._id).populate('sender', 'username avatar').lean();


    // Optionally, only return necessary fields
    const response = {
      _id: populatedMessage._id,
      chatId: populatedMessage.chatId,
      sender: populatedMessage.sender,
      content: populatedMessage.content,
      type: populatedMessage.type,
      edited: populatedMessage.edited,
      createdAt: populatedMessage.createdAt, // Keep original creation time
      updatedAt: populatedMessage.updatedAt, // Include update time
    };

    res.json({ status: 'success', data: response });

     // TODO: Emit a socket event to notify other users in the chat about the update

  } catch (err) {
    console.error('MessageController: Error in updateMessage:', err);
    next(err);
  }
};


// This controller function is used by the REST API route to delete a message.
exports.deleteMessage = async (req, res, next) => {
  try {
     const messageId = req.params.messageId; // Get messageId from URL params

      if (!messageId || !mongoose.Types.ObjectId.isValid(messageId)) {
           return next(new AppError('Invalid message ID', 400));
      }

    const message = await Message.findById(messageId);
    if (!message) return next(new AppError('Message not found', 404));

    // Ensure the user is the sender of the message
    if (!message.sender.equals(req.user._id)) {
      return next(new AppError('Not authorized to delete this message', 403));
    }

    await message.deleteOne();

     // TODO: Emit a socket event to notify other users in the chat about the deletion

    res.status(204).json({ status: 'success', data: null }); // 204 No Content is appropriate for successful deletion
  } catch (err) {
    console.error('MessageController: Error in deleteMessage:', err);
    next(err);
  }
};


// This controller function is used by the REST API route to mark a message as read.
// Note: Real-time marking as read is handled by the socketService.js 'mark-as-read' event handler.
// This REST endpoint could be a fallback or used for non-real-time scenarios.
// Ensure consistency between this and the socket handler regarding readBy array and status updates.
exports.markAsRead = async (req, res, next) => {
  try {
     const messageId = req.params.messageId; // Get messageId from URL params

      if (!messageId || !mongoose.Types.ObjectId.isValid(messageId)) {
           return next(new AppError('Invalid message ID', 400));
      }

    const message = await Message.findById(messageId);
    if (!message) return next(new AppError('Message not found', 404));

     // Find the chat to ensure the user is a participant
     const chat = await Chat.findById(message.chatId);
     if (!chat) {
          // This case is unlikely if message exists, but good practice
          return next(new AppError('Chat associated with message not found', 404));
     }

    if (!chat.participants.some(p => p.equals(req.user._id))) {
      return next(new AppError('Not authorized for this chat', 403));
    }

     const readerId = req.user._id;

     // Check if the user has already read this message
     const alreadyRead = (message.readBy || []).some(r => r.readerId && r.readerId.equals(readerId));

     if (!alreadyRead) {
          // Add the current user to the readBy array
          message.readBy.push({ readerId: readerId, readAt: new Date() });

          // Optional: Update message status based on readBy count (e.g., 'delivered' or 'read')
          // This logic should ideally match the socket handler's logic for consistency.
          // For simplicity here, we'll just save the readBy update.
           const otherParticipantsCount = chat.participants.length - 1; // Assuming sender is one participant
           const uniqueReadersCount = new Set(message.readBy.map(r => r.readerId.toString())).size;

           if (uniqueReadersCount >= otherParticipantsCount && otherParticipantsCount > 0) {
               message.status = 'read'; // Set status to 'read' if read by all others
           } else if (message.status === 'sent') {
               message.status = 'delivered'; // Set to delivered if at least one other reads it (and it was sent)
           }


          console.log(`MessageController: Marking message ${messageId} as read by user ${readerId} via REST.`);
          await message.save();
           console.log(`MessageController: Message ${messageId} read status updated in DB.`);

           // TODO: Emit a socket event to notify other users in the chat that this message was read
           // This keeps the UI consistent across all connected clients in the chat.
           // const messageReadPayload = {
           //     messageId: message._id.toString(),
           //     readerId: readerId.toString(),
           //     chatId: message.chatId.toString(),
           //     readAt: new Date().toISOString(),
           //     status: message.status,
           // };
           // getIo()?.to(message.chatId.toString()).emit('message-read', messageReadPayload);


     } else {
          console.log(`MessageController: Message ${messageId} already read by user ${readerId} via REST. No update needed.`);
     }


    res.json({ status: 'success', data: { _id: message._id, status: message.status, readBy: message.readBy } }); // Return updated status/readBy
  } catch (err) {
    console.error('MessageController: Error in markAsRead:', err);
    next(err);
  }
};

const mongoose = require('mongoose'); // Import mongoose for isValid

