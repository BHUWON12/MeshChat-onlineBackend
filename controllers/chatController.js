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

// Required Methods
exports.getAllChats = async (req, res, next) => {
  try {
    const chats = await Chat.find()
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
      .populate('participants', 'username avatar')
      .populate('lastMessage');
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
