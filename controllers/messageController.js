const Message = require('../models/Message');
const Chat = require('../models/Chat');
const AppError = require('../utils/appError');

exports.sendMessage = async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.chatId);
    if (!chat) return next(new AppError('Chat not found', 404));

    if (!chat.participants.some(p => p.equals(req.user._id))) {
      return next(new AppError('Not authorized for this chat', 403));
    }

    // Validate content for text messages
    if ((req.body.type === 'text' || !req.body.type) && !req.body.content) {
      return next(new AppError('Content is required for text messages', 400));
    }

    const message = await Message.create({
      chatId: req.params.chatId,
      sender: req.user._id,
      content: req.body.content,
      type: req.body.type || 'text',
      metadata: req.body.metadata || {},
    });

    // Update chat's last message
    chat.lastMessage = message._id;
    await chat.save();

    // Optionally, only return necessary fields
    const response = {
      id: message._id,
      chatId: message.chatId,
      sender: message.sender,
      content: message.content,
      type: message.type,
      createdAt: message.createdAt,
    };

    res.status(201).json({ status: 'success', data: response });
  } catch (err) {
    next(err);
  }
};


// Rest of your existing message controller methods remain unchanged
exports.getMessages = async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.chatId);
    if (!chat) return next(new AppError('Chat not found', 404));

    if (!chat.participants.some(p => p.equals(req.user._id))) {
      return next(new AppError('Not authorized for this chat', 403));
    }

    // Optional: Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const messages = await Message.find({ chatId: req.params.chatId })
      .sort('createdAt')
      .skip(skip)
      .limit(limit)
      .populate('sender', 'username avatar');

    res.json({ status: 'success', data: messages });
  } catch (err) {
    next(err);
  }
};


exports.updateMessage = async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message) return next(new AppError('Message not found', 404));

    if (!message.sender.equals(req.user._id)) {
      return next(new AppError('Not authorized to update this message', 403));
    }

    message.content = req.body.content;
    message.edited = true;
    await message.save();

    // Optionally, only return necessary fields
    const response = {
      id: message._id,
      chatId: message.chatId,
      sender: message.sender,
      content: message.content,
      type: message.type,
      edited: message.edited,
      createdAt: message.createdAt,
    };

    res.json({ status: 'success', data: response });
  } catch (err) {
    next(err);
  }
};


exports.deleteMessage = async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message) return next(new AppError('Message not found', 404));

    if (!message.sender.equals(req.user._id)) {
      return next(new AppError('Not authorized to delete this message', 403));
    }

    await message.deleteOne();
    res.status(204).json({ status: 'success' });
  } catch (err) {
    next(err);
  }
};

