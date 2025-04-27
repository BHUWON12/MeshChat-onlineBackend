const Chat = require('../models/Chat');
const User = require('../models/User');
const AppError = require('../utils/appError');
const mongoose = require('mongoose');

exports.createChat = async (req, res, next) => {
  try {
    const { participants: participantEmails } = req.body;
    const currentUser = req.user;

    if (!participantEmails || !Array.isArray(participantEmails)) {
      return next(new AppError('Please provide an array of participant emails', 400));
    }

    const uniqueEmails = [...new Set([
      ...participantEmails.map(e => e.toLowerCase()),
      currentUser.email.toLowerCase()
    ])];

    const users = await User.find({
      email: { $in: uniqueEmails.map(e => new RegExp(`^${e}$`, 'i')) }
    });

    const foundEmails = users.map(u => u.email.toLowerCase());
    const missing = uniqueEmails.filter(e => !foundEmails.includes(e.toLowerCase()));

    if (missing.length > 0) {
      return next(new AppError(`Users not found: ${missing.join(', ')}`, 404));
    }

    const userIds = users.map(u => u._id);
    const existingChat = await Chat.findOne({
      participants: { $all: userIds, $size: userIds.length }
    })
      .populate('participants', 'username email avatar')
      .populate('lastMessage');

    if (existingChat) {
      return res.status(200).json({
        status: 'success',
        data: existingChat
      });
    }

    const newChat = await Chat.create({ participants: userIds });
    const populatedChat = await Chat.findById(newChat._id)
      .populate('participants', 'username email avatar')
      .populate('lastMessage');

    res.status(201).json({
      status: 'success',
      data: populatedChat
    });
  } catch (err) {
    next(err);
  }
};

exports.connectToUser = async (req, res, next) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.user._id;

    if (targetUserId === currentUserId.toString()) {
      return next(new AppError("Cannot connect with yourself", 400));
    }

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return next(new AppError("Invalid user ID format", 400));
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return next(new AppError("User not found", 404));
    }

    const existingChat = await Chat.findOne({
      participants: { 
        $all: [currentUserId, targetUserId],
        $size: 2
      }
    })
    .populate('participants', 'username email avatar')
    .populate('lastMessage');

    if (existingChat) {
      return res.status(200).json({
        status: 'success',
        data: existingChat
      });
    }

    const newChat = await Chat.create({
      participants: [currentUserId, targetUserId]
    });

    const populatedChat = await Chat.findById(newChat._id)
      .populate('participants', 'username email avatar')
      .populate('lastMessage');

    res.status(201).json({
      status: 'success',
      data: populatedChat
    });
  } catch (err) {
    next(err);
  }
};

exports.getAllChats = async (req, res, next) => {
  try {
    const chats = await Chat.find({ participants: req.user._id })
      .populate('participants', 'username avatar')
      .populate('lastMessage')
      .sort('-updatedAt');
      
    res.json({
      status: 'success',
      results: chats.length,
      data: chats
    });
  } catch (err) {
    next(err);
  }
};

exports.getChat = async (req, res, next) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.id,
      participants: req.user._id
    })
      .populate('participants', 'username email avatar')
      .populate('lastMessage');

    if (!chat) {
      return next(new AppError('Chat not found or unauthorized', 404));
    }

    res.json({
      status: 'success',
      data: chat
    });
  } catch (err) {
    next(err);
  }
};

exports.updateChat = async (req, res, next) => {
  try {
    const chat = await Chat.findOneAndUpdate(
      {
        _id: req.params.id,
        participants: req.user._id
      },
      req.body,
      {
        new: true,
        runValidators: true
      }
    )
      .populate('participants', 'username email avatar')
      .populate('lastMessage');

    if (!chat) {
      return next(new AppError('Chat not found or unauthorized', 404));
    }

    res.json({
      status: 'success',
      data: chat
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteChat = async (req, res, next) => {
  try {
    const chat = await Chat.findOneAndDelete({
      _id: req.params.id,
      participants: req.user._id
    });

    if (!chat) {
      return next(new AppError('Chat not found or unauthorized', 404));
    }

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (err) {
    next(err);
  }
};
