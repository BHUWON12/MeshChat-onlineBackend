// backend/services/socketService.js

const socketio = require('socket.io');
const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const User = require('../models/User');
const Chat = require('../models/Chat');
const AppError = require('../utils/appError'); // Assuming you have an AppError utility

let io; // Declare the Socket.IO server instance

// --- Function to get the Socket.IO instance ---
// Define getIo at the module level if needed elsewhere (e.g., in controllers)
// If server.js doesn't use getIo, you can remove this function and the export.
// Assuming server.js or controllers might need to access io for broadcasting
const getIo = () => {
  if (!io) {
    console.error('SocketService: Socket.IO not initialized!');
    // Optionally throw an error or handle this case
  }
  return io;
};

const initializeSocket = (server) => {
  console.log('Initializing Socket.IO...');
  // Prevent re-initializing if already initialized
  if (io) {
      console.warn('SocketService: Socket.IO already initialized.');
      return;
  }

  // Create the Socket.IO server instance, attaching it to the HTTP server
  io = socketio(server, {
    cors: {
      // Configure CORS for WebSocket connections.
      origin: process.env.CORS_ORIGIN || '*', // Ensure this matches your frontend URL
      methods: ['GET', 'POST'], // Specify allowed methods
      credentials: true, // Allow cookies/auth headers
    },
    // Ping/pong settings for connection liveness check
    pingInterval: 25000, // milliseconds
    pingTimeout: 20000, // milliseconds
    // Optionally specify transports, 'websocket' is generally preferred
    transports: ['websocket', 'polling'], // Fallback to polling if websocket is not available
    allowEIO3: true, // Allow connections from Socket.IO v2 clients (if needed)
  });

  // --- Socket Authentication Middleware ---
  // This middleware runs before the 'connection' event for each new socket connection.
  io.use(async (socket, next) => { // Made async to await JWT verification
    // Get the authentication token from the handshake headers or auth object
    const token = socket.handshake.auth.token || socket.handshake.headers['x-auth-token']; // Check both
    if (!token) {
        console.warn('SocketService: Authentication error: No token provided');
        // Use an Error object with a message
        return next(new Error('Authentication error: No token provided'));
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        console.error('SocketService: Authentication error: Invalid token', err.message);
        return next(new Error('Authentication error: Invalid token'));
      }
      // Attach the decoded user payload to the socket object
      // You might want to fetch the full user document here if needed for more robust checks
      // e.g., socket.user = await User.findById(decoded.id);
      socket.user = decoded; // decoded should contain user id and username
      console.log('SocketService: Token verified for user ID:', socket.user.id);
      next(); // Proceed with the connection
    });
  });

  // --- Main Connection Handler ---
  // This function runs when a new, authenticated client connects to the socket.
  io.on('connection', (socket) => {
    console.log('SocketService: A user connected to WebSocket. Socket ID:', socket.id, 'User ID:', socket.user.id); // --- BACKEND LOG 1 ---
    const userId = socket.user.id; // Get the user ID from the authenticated socket

    // Store socket ID for the user (useful for sending to specific user's sockets)
    // In a multi-server setup, you'd use an adapter (like Redis) to manage sockets across servers
    // For a single server, you could map userId to socket.id(s)
    // Example (simple in-memory map - won't work across processes):
    // userSockets.set(userId, (userSockets.get(userId) || new Set()).add(socket.id));

    // Mark user as online in the database
    // Use exec() without await means this operation runs in the background
    User.findByIdAndUpdate(userId, { isOnline: true, lastActive: new Date() })
      .then(() => console.log(`SocketService: User ${userId} marked online in DB.`))
      .catch(err => console.error(`SocketService: Error marking user ${userId} online in DB:`, err));


    // --- Broadcast User Online Status ---
    // Emit 'user-online' event to all connected clients
    io.emit('user-online', { userId: userId, isOnline: true }); // Emit with userId and status
    console.log(`SocketService: Emitted 'user-online' for user ${userId}`);

    // Optional: Join a general room for the user's ID
    // socket.join(userId); // Can be useful for direct user-to-user notifications


    // --- Handle 'presence' Event ---
    // Optional: Handle events where the frontend explicitly sets presence (e.g., goes offline manually)
    socket.on('presence', async (statusUpdate) => { 
        const userId = socket.user.id;
        const isOnline = statusUpdate?.isOnline;

        // Basic validation
        if (typeof isOnline !== 'boolean') {
             console.warn(`SocketService: Received invalid presence status from user ${userId}:`, statusUpdate);
             return; // Ignore invalid updates
        }

        console.log(`SocketService: User ${userId} presence updated to ${isOnline}.`);
        // Update user online status and last active timestamp in the database
        User.findByIdAndUpdate(userId, { isOnline, lastActive: new Date() })
            .then(() => console.log(`SocketService: User ${userId} marked ${isOnline ? 'online' : 'offline'} in DB (from presence).`))
            .catch(err => console.error(`SocketService: Error marking user ${userId} presence in DB:`, err));

        // --- Broadcast User Status based on Presence ---
        // Emit the status change to all connected clients
         if (isOnline) {
             io.emit('user-online', { userId: userId, isOnline: true });
             console.log(`SocketService: Emitted 'user-online' for user ${userId} (from presence)`);
         } else {
              io.emit('user-offline', { userId: userId, isOnline: false });
              console.log(`SocketService: Emitted 'user-offline' for user ${userId} (from presence)`);
         }
      });


    // --- Handle 'join-chat' Event ---
    // Add the socket to a room named after the chat ID
    socket.on('join-chat', (chatId) => {
      if (chatId && typeof chatId === 'string') { // Basic validation
          socket.join(chatId);
          console.log(`SocketService: User ${socket.user.id} joined chat room: ${chatId}`); // --- BACKEND LOG 2 ---
          // Optional: Broadcast that the user entered the chat room (e.g., for "User is typing...")
          // io.to(chatId).emit('user-joined-chat', { chatId: chatId, userId: socket.user.id, username: socket.user.username });
      } else {
          console.warn(`SocketService: Received invalid join-chat chatId from user ${socket.user.id}:`, chatId);
      }
    });

     // --- Handle 'leave-chat' Event ---
    // Remove the socket from a room named after the chat ID
    socket.on('leave-chat', (chatId) => {
        if (chatId && typeof chatId === 'string') { // Basic validation
           socket.leave(chatId);
           console.log(`SocketService: User ${socket.user.id} left chat room: ${chatId}`);
           // Optional: Broadcast that the user left the chat room
           // io.to(chatId).emit('user-left-chat', { chatId: chatId, userId: socket.user.id });
        } else {
           console.warn(`SocketService: Received invalid leave-chat chatId from user ${socket.user.id}:`, chatId);
        }
     });


    // --- Handle 'send-message' Event ---
    socket.on('send-message', async (data, callback) => {
      console.log('SocketService: Received send-message event:', data); // --- BACKEND LOG 3 ---
      const senderId = socket.user.id; // Sender ID from authenticated socket
      const tempId = data?.tempId; // Get temporary ID from frontend payload

      // Basic validation
      if (!data || !data.chatId || typeof data.content === 'undefined' || data.content === null) {
          console.warn('SocketService: Invalid data received for send-message: Missing chatId or content.', data);
          // Use callback to send error back to client
          return callback?.({ status: 'error', message: 'Invalid message data (missing chat ID or content)' });
      }

      try {
        // Validate chat and participants
        const chat = await Chat.findById(data.chatId).populate('participants');
        if (!chat) {
          console.log('SocketService: Chat not found for chatId:', data.chatId); // --- BACKEND LOG 4 ---
           return callback?.({ status: 'error', message: 'Chat not found' });
        }
        // Ensure the sender is a participant of the chat
        if (!chat.participants.some(p => p._id.equals(senderId))) {
          console.log(`SocketService: User ${senderId} not authorized for chat ${data.chatId}`); // --- BACKEND LOG 5 ---
           return callback?.({ status: 'error', message: 'Not authorized for this chat' });
        }

        // Log before creating the message
        console.log('SocketService: Attempting to create message in DB with data:', {
          chatId: data.chatId,
          sender: senderId,
          content: data.content,
          type: data.type || 'text', // Default type to 'text'
          metadata: data.metadata || {},
          status: 'sent', // Set initial backend status to 'sent'
        });

        // Create and save the message in the database
        const message = await Message.create({
          chatId: data.chatId,
          sender: senderId,
          content: data.content,
          type: data.type || 'text',
          metadata: data.metadata || {},
          status: 'sent', // Set initial status to 'sent' after creation
          // readBy is empty initially, will be populated by mark-as-read
        });

        // Log after successfully creating the message
        console.log('SocketService: Message created in DB successfully:', message._id);

        // Update chat's last message and lastMessageAt timestamp
        chat.lastMessage = message._id;
        chat.lastMessageAt = message.createdAt; // Use timestamp from DB
        await chat.save();
        console.log(`SocketService: Chat ${chat._id} last message updated.`);


        // --- Prepare and Emit 'new-message' Event ---
        // Populate sender information as frontend ChatBubble needs it
        const populatedMessage = await Message.findById(message._id).populate('sender', 'username avatar');

        const messageObject = populatedMessage ? populatedMessage.toObject() : message.toObject();

        // *** ADD THIS BLOCK to include tempId for Optimistic Updates ***
        if (tempId) { // Check if tempId was sent from the frontend
             messageObject.tempId = tempId; // Add tempId to the emitted message object
             console.log(`SocketService: Including tempId ${tempId} in new-message event payload.`);
        }
        // *** END ADDED BLOCK ***

        console.log('SocketService: Emitting new-message event to chat room:', data.chatId, messageObject); // --- BACKEND LOG 6 ---
        // Emit the message object to all sockets connected to the chat room
        io.to(data.chatId.toString()).emit('new-message', messageObject); // Ensure chatId is a string


        // Execute the callback function provided by the client if it exists
        if (callback && typeof callback === 'function') {
          // Send the emitted message object back in the success response
          callback({ status: 'success', message: messageObject });
        }

      } catch (err) {
        console.error('SocketService: Error processing send-message:', err); // --- BACKEND LOG 7 ---
        // Execute the callback function with an error status
        if (callback && typeof callback === 'function') {
          // Send tempId back in error response so frontend can mark the correct optimistic message as failed
          callback({ status: 'error', message: err.message || 'Failed to send message', tempId: tempId });
        }
      }
    });

    // --- Handle 'mark-as-read' Event ---
    socket.on('mark-as-read', async (data, callback) => {
      console.log('SocketService: Received mark-as-read event:', data);
       const readerId = socket.user.id; // User marking as read
       const messageId = data?.messageId;

       if (!messageId || typeof messageId !== 'string') {
            console.warn(`SocketService: Received invalid mark-as-read messageId from user ${readerId}:`, data);
             return callback?.({ status: 'error', message: 'Message ID is required' });
       }

      try {
        // Find the message by its ID
        // Ensure message belongs to a chat the user is in for robust security
        const message = await Message.findById(messageId);
        if (!message) {
            console.log(`SocketService: Message not found for ID ${messageId}`);
             return callback?.({ status: 'error', message: 'Message not found' });
        }

        // Find the chat the message belongs to and populate participants
        const chat = await Chat.findById(message.chatId).populate('participants');
        if (!chat) {
             console.log(`SocketService: Chat not found for message ${messageId}`);
              return callback?.({ status: 'error', message: 'Chat not found' });
        }

        // Ensure the user marking as read is a participant of the chat
        if (!chat.participants.some(p => p._id.equals(readerId))) { // Use _id.equals for Mongoose ObjectIds
           console.log(`SocketService: User ${readerId} not authorized to mark message ${messageId} as read in chat ${chat._id}`);
           return callback?.({ status: 'error', message: 'Not authorized for this chat' });
        }

        // --- Update Message Read Status in DB ---
        // Check if the reader is already in the readBy array to avoid adding duplicates
        const alreadyRead = message.readBy.some(r => r.readerId && r.readerId.equals(readerId));
        if (!alreadyRead) {
            // Add the reader's ID and timestamp to the readBy array
            message.readBy.push({ readerId: readerId, readAt: new Date() });
            // Optionally update the general status to 'read' here if you rely on a single status field
            // This depends on your frontend's interpretation - checking readBy.length is often better.
            // If message.status should strictly become 'read' ONLY when ALL participants have read it,
            // you'd need more complex logic here (check readBy.length against chat.participants.length).
            // For simple "at least one other person read it" status, setting to 'read' is okay.
            message.status = 'read'; // Set status to 'read'

            console.log(`SocketService: Adding reader ${readerId} to readBy for message ${messageId}. Status set to 'read'.`);

            // Save the updated message
            await message.save();
            console.log(`SocketService: Message ${messageId} read status updated in DB by user ${readerId}.`);


            // --- Emit 'message-read' Event ---
            // Broadcast the read status update to all clients in the chat room
            // Include messageId, readerId, chatId, and timestamp
            const messageReadPayload = {
                messageId: message._id.toString(), // Convert ObjectId to string
                readerId: readerId.toString(),       // Convert ObjectId to string
                chatId: message.chatId.toString(),   // Include chatId
                readAt: new Date().toISOString(),    // Include timestamp
            };
            io.to(message.chatId.toString()).emit('message-read', messageReadPayload);
            console.log(`SocketService: Emitted 'message-read' for message ${messageId} by user ${readerId} to chat room ${message.chatId}.`, messageReadPayload);

        } else {
             console.log(`SocketService: Message ${messageId} already read by user ${readerId}. No DB update or emission needed.`);
        }

        // Execute the callback function with success status
        callback?.({ status: 'success' });

      } catch (err) {
        console.error('SocketService: Error processing mark-as-read:', err);
        // Execute the callback function with an error status
        callback?.({ status: 'error', message: err.message || 'Failed to mark message as read' });
      }
    });

    // --- Handle 'message-delivered' Event (Optional but Recommended for Delivered Tick) ---
    // You could have the frontend emit this when it successfully receives a 'new-message'
    // Or the backend could track which sockets belong to which users and implicitly
    // consider a message "delivered" when at least one of the recipient's sockets receives it.
    // For now, let's assume frontend might emit this, or the backend doesn't explicitly track Delivered.
    socket.on('message-delivered', async (data, callback) => {
         const recipientId = socket.user.id; // The user who received the message(s)
         const messageIds = data?.messageIds; // Array of message IDs

         if (!Array.isArray(messageIds) || messageIds.length === 0) {
             console.warn(`SocketService: Received invalid messageIds for message-delivered from user ${recipientId}:`, data);
             return callback?.({ status: 'error', message: 'Array of message IDs is required' });
         }

         try {
             // Update status for multiple messages in one go
             const updateResult = await Message.updateMany(
                 {
                     _id: { $in: messageIds }, // Match message IDs
                     status: { $ne: 'read' }, // Only update if not already 'read'
                     // Optional: Add security check - ensure recipient is a participant in the chat(s)
                     // This would require finding chats for these messages and checking participant list.
                 },
                 {
                     $set: { status: 'delivered' } // Set status to 'delivered'
                 }
             );

             if (updateResult.modifiedCount > 0) {
                 console.log(`SocketService: Marked ${updateResult.modifiedCount} messages as delivered for user ${recipientId}.`);
                 // Emit an event to notify clients that message statuses have changed to 'delivered'
                 // This event should include the message IDs that were updated.
                 io.emit('messages-delivered', { messageIds: messageIds, recipientId: recipientId });
                  console.log(`SocketService: Emitted 'messages-delivered' for message IDs:`, messageIds);
             } else {
                 console.log(`SocketService: No messages needed status update to 'delivered' for user ${recipientId}.`);
             }

             callback?.({ status: 'success' });

         } catch (err) {
             console.error('SocketService: Error processing message-delivered:', err);
             callback?.({ status: 'error', message: err.message || 'Failed to mark messages as delivered' });
         }
    });


    // --- Disconnect Handler ---
    // This runs when a client disconnects from the socket.
    socket.on('disconnect', (reason) => {
      const userId = socket.user.id; // Get user ID before the socket is fully gone
      console.log('SocketService: A user disconnected from WebSocket. Socket ID:', socket.id, 'User ID:', userId, 'Reason:', reason); // --- BACKEND LOG 8 ---

      // Remove socket ID from user's list of sockets (if using a map)
      // userSockets.get(userId)?.delete(socket.id);
      // const remainingSockets = userSockets.get(userId)?.size || 0;

      // Only mark user offline in DB and emit if this was their *last* active socket connection
      // In a multi-server setup with adapter, you can check io.in(userId).allSockets() size
      // For single server, you might need to track actively connected sockets per user ID
      // Simple approach (might mark offline too soon if multiple tabs):
      User.findByIdAndUpdate(userId, { isOnline: false, lastActive: new Date() })
        .then(() => console.log(`SocketService: User ${userId} marked offline in DB.`))
        .catch(err => console.error(`SocketService: Error marking user ${userId} offline in DB:`, err));

      // --- Broadcast User Offline Status ---
      // Emit 'user-offline' event to all connected clients
      io.emit('user-offline', { userId: userId, isOnline: false }); // Emit with userId and status
      console.log(`SocketService: Emitted 'user-offline' for user ${userId}`);

      // Note: Rooms are automatically left on disconnect
    });

     // --- Error Handling for Socket (Optional but Recommended) ---
     socket.on('error', (err) => {
         console.error(`SocketService: Socket error for user ${socket.user?.id}:`, err);
         // Handle specific socket errors if needed
         // Example: Authentication errors, network issues, etc.
         if (err && err.message === 'Authentication error: Invalid token') {
             // Optionally disconnect the socket with a specific reason or send an error event
             socket.disconnect(true); // Disconnect the socket
         }
     });

  }); // End of io.on('connection', ...)


  // --- Error Handling for the entire Socket.IO server instance ---
  io.on('connect_error', (err) => {
      console.error('SocketService: Socket.IO connection error:', err.message);
      // This handles errors during the initial handshake
  });
  io.on('connect_timeout', (err) => {
      console.error('SocketService: Socket.IO connection timeout:', err.message);
  });
  // Add other global server-side error listeners if needed

}; // End of initializeSocket function

// Export the initialization function AND the getIo function
// This allows other parts of your application (like controllers) to access the 'io' instance
module.exports = { initializeSocket, getIo };