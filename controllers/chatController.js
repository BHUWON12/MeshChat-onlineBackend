const Chat = require('../models/Chat');
const Connection = require('../models/Connection');
const User = require('../models/User');
const AppError = require('../utils/appError');

// Helper function to check connections
const checkConnection = async (userA, userB) => {
  const connection = await Connection.findOne({
    $or: [
      { requester: userA, recipient: userB, status: 'accepted' },
      { requester: userB, recipient: userA, status: 'accepted' }
    ]
  });
  return !!connection;
};

exports.initiateChat = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    if (userId === currentUserId.toString()) {
      return next(new AppError("Cannot chat with yourself", 400));
    }

    const isConnected = await checkConnection(currentUserId, userId);
    if (!isConnected) {
      return next(new AppError('You must be connected to start a chat', 403));
    }

    let chat = await Chat.findOne({
      participants: { $all: [currentUserId, userId] }
    })
    .populate('participants', 'username avatar')
    .populate('lastMessage');

    if (!chat) {
      chat = await Chat.create({
        participants: [currentUserId, userId]
      });
      
      chat = await Chat.findById(chat._id)
        .populate('participants', 'username avatar');
    }

    res.status(200).json(chat);
  } catch (err) {
    next(err);
  }
};

exports.getAllChats = async (req, res, next) => {
  try {
    // Only return chats where the current user is a participant
    const chats = await Chat.find({
      participants: req.user._id
    })
      .populate('participants', 'username avatar')
      .populate('lastMessage');
    res.status(200).json(chats);
  } catch (err) {
    next(err);
  }
};


exports.getChat = async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.id)
      .populate({
        path: 'participants',
        select: 'username avatar isOnline connectionType',
        transform: doc => ({
          id: doc._id,
          username: doc.username,
          avatar: doc.avatar,
          isOnline: doc.isOnline,
          connectionType: doc.connectionType
        })
      })
      .populate('lastMessage');

    // Check participant
    if (!chat || !chat.participants.some(p => p.id == req.user._id.toString() || p._id == req.user._id.toString())) {
      return next(new AppError('Not authorized for this chat', 403));
    }

    res.status(200).json(chat);
  } catch (err) {
    next(err);
  }
};



exports.updateChat = async (req, res, next) => {
  try {
    const chat = await Chat.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    res.status(200).json(chat);
  } catch (err) {
    next(err);
  }
};

exports.deleteChat = async (req, res, next) => {
  try {
    await Chat.findByIdAndDelete(req.params.id);
    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (err) {
    next(err);
  }
};

// Other methods (keep if needed)
exports.createChat = async (req, res, next) => { /* ... */ };
exports.connectToUser = async (req, res, next) => { /* ... */ };

// Initiate a chat (Keep as is, seems functional)
exports.initiateChat = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    if (userId === currentUserId.toString()) {
      return next(new AppError("Cannot chat with yourself", 400));
    }

    const isConnected = await checkConnection(currentUserId, userId);
    if (!isConnected) {
      return next(new AppError('You must be connected to start a chat', 403));
    }

    // Find existing chat and populate participants and last message
    let chat = await Chat.findOne({
      participants: { $all: [currentUserId, userId] }
    })
    .populate('participants', 'username avatar isOnline lastActive') // <-- Added isOnline, lastActive
    .populate('lastMessage'); // Assuming lastMessage is already populated here if it exists

    if (!chat) {
      // If chat doesn't exist, create it
      chat = await Chat.create({
        participants: [currentUserId, userId]
      });

      // Find the newly created chat and populate participants and last message
      // This second find is necessary to get the populated fields immediately after creation
      chat = await Chat.findById(chat._id)
        .populate('participants', 'username avatar isOnline lastActive') // <-- Added isOnline, lastActive
        .populate('lastMessage'); // lastMessage will be null initially
    }

    // Return the chat object (either existing or newly created)
    res.status(200).json(chat);
  } catch (err) {
    next(err);
  }
};

// Get all chats for the current user
exports.getAllChats = async (req, res, next) => {
  try {
    console.log(`ChatController: Fetching all chats for user ID: ${req.user._id}`); // Debug log
    // Only return chats where the current user is a participant
    const chats = await Chat.find({
      participants: req.user._id
    })
      .populate('participants', 'username avatar isOnline lastActive') // <-- Added isOnline, lastActive
      .populate('lastMessage') // Populate the last message
      .sort({ lastMessageAt: -1 }); // <-- ADDED SORTING: Sort by lastMessageAt descending (newest first)

    console.log(`ChatController: Found ${chats.length} chats for user ID: ${req.user._id}`); // Debug log
    // console.log("ChatController: Chats data:", chats); // Detailed debug log (uncomment if needed)

    res.status(200).json(chats);
  } catch (err) {
    console.error('ChatController: Error in getAllChats:', err); // Error log
    next(err);
  }
};


// Get a single chat by ID (Keep as is, seems functional)
exports.getChat = async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.id)
      .populate({
        path: 'participants',
        select: 'username avatar isOnline connectionType', // Keep these fields as per your original code
        // transform: doc => ({ // Keep your transform if you need to restructure the participant object
        //   id: doc._id,
        //   username: doc.username,
        //   avatar: doc.avatar,
        //   isOnline: doc.isOnline,
        //   connectionType: doc.connectionType
        // })
      })
      .populate('lastMessage'); // Populate last message

    // Check participant
    if (!chat || !chat.participants.some(p => p._id.toString() === req.user._id.toString())) { // Use toString() for comparison
      return next(new AppError('Not authorized for this chat', 403));
    }

    res.status(200).json(chat);
  } catch (err) {
    next(err);
  }
};


// Update a chat (Keep as is)
exports.updateChat = async (req, res, next) => {
  try {
    const chat = await Chat.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    res.status(200).json(chat);
  } catch (err) {
    next(err);
  }
};

// Delete a chat (Keep as is)
exports.deleteChat = async (req, res, next) => {
  try {
    await Chat.findByIdAndDelete(req.params.id);
    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (err) {
    next(err);
  }
};

// Other methods (keep if needed)
// exports.createChat = async (req, res, next) => { /* ... */ }; // initiateChat handles creation
// exports.connectToUser = async (req, res, next) => { /* ... */ };

// Add to chatController.js
exports.getChatPartners = async (req, res, next) => {
  try {
    const chats = await Chat.find({
      participants: req.user._id
    })
    .populate({
      path: 'participants',
      match: { _id: { $ne: req.user._id } }, // Exclude current user
      select: 'username avatar isOnline lastActive'
    });

    // Extract unique partners
    const partners = [];
    const partnerIds = new Set();
    
    chats.forEach(chat => {
      chat.participants.forEach(user => {
        if (user._id && !partnerIds.has(user._id.toString())) {
          partnerIds.add(user._id.toString());
          partners.push(user);
        }
      });
    });

    res.status(200).json(partners);
  } catch (err) {
    next(err);
  }
};