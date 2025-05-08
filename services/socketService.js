// backend/services/socketService.js

const socketio = require('socket.io');
const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const User = require('../models/User');
const Chat = require('../models/Chat');
const AppError = require('../utils/appError');
const notificationController = require('../controllers/notificationController'); // Import notification controller

let io;

const getIo = () => {
  if (!io) {
    console.error('SocketService: Socket.IO not initialized!');
    // In a real app, you might throw or handle this gracefully
  }
  return io;
};

// Helper function to emit events to a specific user's socket(s)
const emitToUser = (userId, eventName, data) => {
    if (!io) {
        console.error('SocketService: Socket.IO not initialized, cannot emit to user.');
        return false;
    }
    // Ensure userId is a string, as room names are strings
    io.to(userId.toString()).emit(eventName, data);
    console.log(`SocketService: Emitted '${eventName}' to user room ${userId}`, data);
    return true;
};


const initializeSocket = (server) => {
  console.log('Initializing Socket.IO...');
  if (io) {
      console.warn('SocketService: Socket.IO already initialized.');
      return;
  }

  io = socketio(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
    transports: ['websocket'], // Use websockets first
    allowEIO3: true, // If needed for older clients
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers['x-auth-token'];
    if (!token) {
        console.warn('SocketService: Authentication error: No token provided');
        return next(new Error('Authentication error: No token provided'));
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => { // Made async to potentially fetch user
      if (err) {
        console.error('SocketService: Authentication error: Invalid token', err.message);
        return next(new Error('Authentication error: Invalid token'));
      }
      // Fetch the user document and attach it for better authorization checks
      const user = await User.findById(decoded.id).select('_id username avatar');
      if (!user) {
          console.error('SocketService: Authentication error: User not found for token');
          return next(new Error('Authentication error: User not found'));
      }
      socket.user = user; // Attach the full user object
      console.log('SocketService: Token verified for user ID:', socket.user._id);
      next();
    });
  });

  io.on('connection', (socket) => {
    console.log('SocketService: A user connected to WebSocket. Socket ID:', socket.id, 'User ID:', socket.user._id);
    const userId = socket.user._id; // Use _id from the populated user object

    // --- User joins their own room (essential for direct notifications) ---
    socket.join(userId.toString()); // Use toString() for ObjectId as room names are strings
    console.log(`SocketService: User ${userId} joined user room ${userId.toString()}`);
    // --- END ---

    // Mark user as online in the database
    User.findByIdAndUpdate(userId, { isOnline: true, lastActive: new Date() })
      .then(() => console.log(`SocketService: User ${userId} marked online in DB.`))
      .catch(err => console.error(`SocketService: Error marking user ${userId} online in DB:`, err));

    // Broadcast User Online Status
    io.emit('user-online', { userId: userId.toString(), isOnline: true }); // Use toString()
    console.log(`SocketService: Emitted 'user-online' for user ${userId}`);

    // Handle 'presence' Event
    socket.on('presence', async (statusUpdate) => {
        const userId = socket.user._id;
        const isOnline = typeof statusUpdate === 'object' && statusUpdate !== null ? statusUpdate.isOnline : undefined;

        if (typeof isOnline !== 'boolean') {
             console.warn(`SocketService: Received invalid presence status from user ${userId}:`, statusUpdate);
             return;
        }

        console.log(`SocketService: User ${userId} presence updated to ${isOnline}.`);
        User.findByIdAndUpdate(userId, { isOnline, lastActive: new Date() })
            .then(() => console.log(`SocketService: User ${userId} marked ${isOnline ? 'online' : 'offline'} in DB (from presence).`))
            .catch(err => console.error(`SocketService: Error marking user ${userId} presence in DB:`, err));

         if (isOnline) {
             io.emit('user-online', { userId: userId.toString(), isOnline: true });
             console.log(`SocketService: Emitted 'user-online' for user ${userId} (from presence)`);
         } else {
              io.emit('user-offline', { userId: userId.toString(), isOnline: false });
              console.log(`SocketService: Emitted 'user-offline' for user ${userId} (from presence)`);
         }
      });

    // Handle 'join-chat' Event
    socket.on('join-chat', (chatId) => {
      if (chatId && typeof chatId === 'string') {
          socket.join(chatId);
          console.log(`SocketService: User ${socket.user._id} joined chat room: ${chatId}`);
      } else {
          console.warn(`SocketService: Received invalid join-chat chatId from user ${socket.user._id}:`, chatId);
      }
    });

     // Handle 'leave-chat' Event
    socket.on('leave-chat', (chatId) => {
        if (chatId && typeof chatId === 'string') {
           socket.leave(chatId);
           console.log(`SocketService: User ${socket.user._id} left chat room: ${chatId}`);
        } else {
           console.warn(`SocketService: Received invalid leave-chat chatId from user ${socket.user._id}:`, chatId);
        }
     });

    // Handle 'send-message' Event
    socket.on('send-message', async (data, callback) => {
      console.log('SocketService: Received send-message event:', data);
      const senderId = socket.user._id; // Use _id
      const tempId = data?.tempId;

      if (!data || !data.chatId || typeof data.content === 'undefined' || data.content === null) {
          console.warn('SocketService: Invalid data received for send-message: Missing chatId or content.', data);
          return callback?.({ status: 'error', message: 'Invalid message data (missing chat ID or content)' });
      }

      try {
        const chat = await Chat.findById(data.chatId).populate('participants', '_id username avatar'); // Populate participants here
        if (!chat) {
          console.log('SocketService: Chat not found for chatId:', data.chatId);
           return callback?.({ status: 'error', message: 'Chat not found' });
        }
        if (!chat.participants.some(p => p._id.equals(senderId))) {
          console.log(`SocketService: User ${senderId} not authorized for chat ${data.chatId}`);
           return callback?.({ status: 'error', message: 'Not authorized for this chat' });
        }

        console.log('SocketService: Attempting to create message in DB...');

        const message = await Message.create({
          chatId: data.chatId,
          sender: senderId,
          content: data.content,
          type: data.type || 'text',
          metadata: data.metadata || {},
          status: 'sent',
          readBy: [],
        });

        console.log('SocketService: Message created in DB successfully:', message._id);

        chat.lastMessage = message._id;
        chat.lastMessageAt = message.createdAt;
        await chat.save();
        console.log(`SocketService: Chat ${chat._id} last message updated.`);

        // Populate sender before emitting 'new-message'
        const populatedMessage = await Message.findById(message._id).populate('sender', 'username avatar').lean();
        const messageObject = populatedMessage || message.toObject();

        if (tempId) {
             messageObject.tempId = tempId;
             console.log(`SocketService: Including tempId ${tempId} in new-message event payload.`);
        }

        console.log('SocketService: Emitting new-message event to chat room:', data.chatId, messageObject);
        io.to(data.chatId.toString()).emit('new-message', messageObject);


        // --- Create and emit notification for the recipient(s) ---
        const recipients = chat.participants.filter(p => !p._id.equals(senderId));

        // Create a notification for each recipient and emit
        for (const recipient of recipients) {
            try {
                // Check if recipient is currently in the chat room
                const recipientSockets = await io.in(data.chatId.toString()).allSockets();
                const isRecipientInChat = Array.from(recipientSockets).some(socketId => {
                     const socket = io.sockets.sockets.get(socketId);
                     return socket && socket.user && socket.user._id.equals(recipient._id);
                });

                // Only create/emit notification if the recipient is NOT in the chat room
                if (!isRecipientInChat) {
                    // Create notification in DB
                    const newNotification = await notificationController.createNotification(
                        recipient._id,
                        'message', // Type is 'message'
                        { // Data payload
                           senderId: senderId.toString(), // Sender of the message
                           chatId: chat._id.toString(),
                           messageId: message._id.toString(),
                           // Include sender info for frontend display
                           senderUsername: socket.user.username, // Sender is the current user
                           senderAvatar: socket.user.avatar,
                           messageContent: message.content, // Include content for display in notification item
                        },
                        message._id // Link to the message document
                    );

                    if (newNotification) {
                         // Emit the notification via socket to the recipient's user room
                        // Populate the notification sender before emitting for frontend use
                         const notificationPayload = {
                            ...newNotification.toObject(),
                            sender: { // Add sender info to the notification payload
                                 _id: socket.user._id.toString(),
                                 username: socket.user.username,
                                 avatar: socket.user.avatar,
                            },
                            // Ensure data field structure matches frontend expectation
                            data: {
                                ...newNotification.data,
                                chatId: chat._id.toString(), // Ensure chatId is string
                                messageId: message._id.toString(), // Ensure messageId is string
                            }
                         };

                         emitToUser(recipient._id, 'new-notification', notificationPayload);
                         console.log(`SocketService: Emitted new-notification (message) to user ${recipient._id} for message ${message._id} (Recipient NOT in chat).`);
                    }
                } else {
                     console.log(`SocketService: Recipient ${recipient._id} is in chat ${chat._id}. Skipping message notification.`);
                }


            } catch (notificationErr) {
                console.error(`SocketService: Error creating/emitting message notification for recipient ${recipient._id}:`, notificationErr);
            }
        }
        // --- END ADD BLOCK ---


        if (callback && typeof callback === 'function') {
          callback({ status: 'success', message: messageObject });
        }

      } catch (err) {
        console.error('SocketService: Error processing send-message:', err);
        if (callback && typeof callback === 'function') {
          callback({ status: 'error', message: err.message || 'Failed to send message', tempId: tempId });
        }
      }
    });

    // Handle 'mark-as-read' Event
    socket.on('mark-as-read', async (data, callback) => {
      console.log('SocketService: Received mark-as-read event:', data);
       const readerId = socket.user._id; // User marking as read
       const messageId = data?.messageId;
       const chatId = data?.chatId; // Assume chatId is also sent from frontend now

       if (!messageId || typeof messageId !== 'string' || !chatId || typeof chatId !== 'string') {
            console.warn(`SocketService: Received invalid mark-as-read data from user ${readerId}:`, data);
             return callback?.({ status: 'error', message: 'Message ID and Chat ID are required' });
       }

      try {
        // Find the message by its ID
        const message = await Message.findById(messageId).lean();
        if (!message) {
            console.log(`SocketService: Message not found for ID ${messageId}`);
             return callback?.({ status: 'error', message: 'Message not found' });
        }

         // Security check: Ensure the message's chatId matches the provided chatId and user is a participant
         if (message.chatId.toString() !== chatId) {
             console.warn(`SocketService: Provided chatId ${chatId} does not match message's chatId ${message.chatId} for message ${messageId}. User ${readerId}`);
             return callback?.({ status: 'error', message: 'Chat ID mismatch' });
         }

        const chat = await Chat.findById(chatId).populate('participants');
        if (!chat) {
             console.log(`SocketService: Chat not found for chatId ${chatId}`);
              return callback?.({ status: 'error', message: 'Chat not found' });
        }

        if (!chat.participants.some(p => p._id.equals(readerId))) {
           console.log(`SocketService: User ${readerId} not authorized to mark message ${messageId} as read in chat ${chatId}`);
           return callback?.({ status: 'error', message: 'Not authorized for this chat' });
        }

        const messageDoc = await Message.findById(messageId);
        if (!messageDoc) {
             console.log(`SocketService: Message document not found for ID ${messageId} during update.`);
             return callback?.({ status: 'error', message: 'Message document not found for update' });
        }

        const alreadyRead = (messageDoc.readBy || []).some(r => r.readerId && r.readerId.equals(readerId));

        if (!alreadyRead) {
            messageDoc.readBy.push({ readerId: readerId, readAt: new Date() });
            // Only set status to 'read' if *all* participants have read it (more accurate)
            // For simplicity, let's set it if at least one other participant has read it (excluding sender)
             const otherParticipantsCount = chat.participants.length - 1;
             const uniqueReadersCount = new Set(messageDoc.readBy.map(r => r.readerId.toString())).size;

            if (uniqueReadersCount >= otherParticipantsCount && otherParticipantsCount > 0) {
                messageDoc.status = 'read'; // Set status to 'read' if read by all others
                 console.log(`SocketService: Message ${messageId} status set to 'read' by user ${readerId} (all others have read).`);
            } else if (messageDoc.status === 'sent') {
                 messageDoc.status = 'delivered'; // If just the sender + 1 recipient read, set to delivered if not already
                  console.log(`SocketService: Message ${messageId} status set to 'delivered' by user ${readerId}.`);
            }


            console.log(`SocketService: Adding reader ${readerId} to readBy for message ${messageId}. ReadBy count: ${messageDoc.readBy.length}`);
            await messageDoc.save();
            console.log(`SocketService: Message ${messageId} read status updated in DB by user ${readerId}.`);

            const messageReadPayload = {
                messageId: messageDoc._id.toString(),
                readerId: readerId.toString(),
                chatId: messageDoc.chatId.toString(),
                readAt: new Date().toISOString(),
                status: messageDoc.status, // Include updated status
            };
            io.to(messageDoc.chatId.toString()).emit('message-read', messageReadPayload);
            console.log(`SocketService: Emitted 'message-read' for message ${messageId} by user ${readerId} to chat room ${messageDoc.chatId}.`);

            // --- Mark corresponding message notification as read ---
            // Find the notification for this message for the current reader and mark as read
            const notification = await Notification.findOneAndUpdate({
                user: readerId,
                type: 'message',
                message: messageId,
                read: false // Only find and update if not already read
            }, { read: true }, { new: true }); // Use findOneAndUpdate to get the updated doc


            if (notification) {
                console.log(`SocketService: Marked message notification ${notification._id} as read for user ${readerId}.`);
                // Emit an event to the user to update their notification count/status
                 emitToUser(readerId, 'notification-read-update', { notificationId: notification._id.toString(), read: true });
                 console.log(`SocketService: Emitted 'notification-read-update' for notification ${notification._id} to user ${readerId}`);
            }


        } else {
             console.log(`SocketService: Message ${messageId} already read by user ${readerId}. No DB update or emission needed.`);
        }

        callback?.({ status: 'success' });

      } catch (err) {
        console.error('SocketService: Error processing mark-as-read:', err);
        callback?.({ status: 'error', message: err.message || 'Failed to mark message as read' });
      }
    });

     // Handle 'message-delivered' Event (Optional but Recommended)
    socket.on('message-delivered', async (data, callback) => {
         const recipientId = socket.user._id;
         const messageIds = data?.messageIds;

         if (!Array.isArray(messageIds) || messageIds.length === 0) {
             console.warn(`SocketService: Received invalid messageIds for message-delivered from user ${recipientId}:`, data);
             return callback?.({ status: 'error', message: 'Array of message IDs is required' });
         }

         try {
             const messagesToUpdate = await Message.find(
                 {
                     _id: { $in: messageIds },
                     status: { $nin: ['read', 'delivered'] },
                 }
             );

             if (messagesToUpdate.length > 0) {
                 // Basic security check: ensure recipient is in chat for *at least one* of these messages
                 const chatIds = messagesToUpdate.map(msg => msg.chatId);
                 const isRecipientInAnyChat = await Chat.exists({ _id: { $in: chatIds }, participants: recipientId });

                 if (!isRecipientInAnyChat) {
                     console.warn(`SocketService: User ${recipientId} not participant in any chat for message-delivered IDs:`, messageIds);
                     return callback?.({ status: 'error', message: 'Not authorized for these messages' });
                 }

                 const messageIdsToMarkDelivered = messagesToUpdate.map(msg => msg._id);

                 const updateResult = await Message.updateMany(
                     { _id: { $in: messageIdsToMarkDelivered } },
                     { $set: { status: 'delivered' } }
                 );


                 if (updateResult.modifiedCount > 0) {
                     console.log(`SocketService: Marked ${updateResult.modifiedCount} messages as delivered for user ${recipientId}.`);

                     const updatedMessages = await Message.find({ _id: { $in: messageIdsToMarkDelivered } }).select('chatId _id status');
                     const chatsToEmit = new Set(updatedMessages.map(msg => msg.chatId.toString()));

                     chatsToEmit.forEach(chatId => {
                         const deliveredMessageIdsInChat = updatedMessages
                             .filter(msg => msg.chatId.toString() === chatId)
                             .map(msg => msg._id.toString());

                         const messageDeliveredPayload = {
                             messageIds: deliveredMessageIdsInChat,
                             recipientId: recipientId.toString(),
                             chatId: chatId, // Include chatId
                         };
                         io.to(chatId).emit('messages-delivered', messageDeliveredPayload);
                         console.log(`SocketService: Emitted 'messages-delivered' for chat ${chatId} with message IDs:`, deliveredMessageIdsInChat);
                     });

                 } else {
                     console.log(`SocketService: No messages needed status update to 'delivered' for user ${recipientId}.`);
                 }

             } else {
                 console.log(`SocketService: No messages found for message-delivered IDs or status already delivered/read:`, messageIds);
             }


             callback?.({ status: 'success' });

         } catch (err) {
             console.error('SocketService: Error processing message-delivered:', err);
             callback?.({ status: 'error', message: err.message || 'Failed to mark messages as delivered' });
         }
    });


    // Disconnect Handler
    socket.on('disconnect', (reason) => {
      const userId = socket.user._id;
      console.log('SocketService: A user disconnected from WebSocket. Socket ID:', socket.id, 'User ID:', userId, 'Reason:', reason);

      // Check if the user still has active sockets connected (in a real app, use adapter)
      // Use a short delay to see if they reconnect quickly
      setTimeout(async () => {
           // Use io.sockets.adapter.rooms for accuracy in identifying users in rooms
           const userSockets = io.sockets.adapter.rooms.get(userId.toString());
           const remainingSocketsCount = userSockets ? userSockets.size : 0;

           if (remainingSocketsCount === 0) {
               console.log(`SocketService: User ${userId} has no active sockets left. Marking offline.`);
               User.findByIdAndUpdate(userId, { isOnline: false, lastActive: new Date() })
                 .then(() => console.log(`SocketService: User ${userId} marked offline in DB.`))
                 .catch(err => console.error(`SocketService: Error marking user ${userId} offline in DB:`, err));

               // Broadcast User Offline Status
               io.emit('user-offline', { userId: userId.toString(), isOnline: false });
               console.log(`SocketService: Emitted 'user-offline' for user ${userId}`);
           } else {
                console.log(`SocketService: User ${userId} still has ${remainingSocketsCount} active sockets. Not marking offline.`);
           }
      }, 5000); // 5-second delay

    });

     // Error Handling for Socket
     socket.on('error', (err) => {
         console.error(`SocketService: Socket error for user ${socket.user?._id}:`, err);
         if (err && err.message === 'Authentication error: Invalid token') {
             socket.disconnect(true);
         }
     });

  });

  io.on('connect_error', (err) => {
      console.error('SocketService: Socket.IO connection error:', err.message);
  });
  io.on('connect_timeout', (err) => {
      console.error('SocketService: Socket.IO connection timeout:', err.message);
  });
   // Add global error handler if not using a separate middleware
   // io.on('error', (err) => { console.error('SocketService: Global IO error:', err); });


};

module.exports = { initializeSocket, getIo, emitToUser };