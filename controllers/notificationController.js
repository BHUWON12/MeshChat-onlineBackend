const Notification = require('../models/Notification');
const User = require('../models/User');
const AppError = require('../utils/appError');
const mongoose = require('mongoose');

/**
 * Get all notifications for the current user
 */
exports.getNotifications = async (req, res, next) => {
  try {
    // Get all notifications for the current user
    const notifications = await Notification.find({ user: req.user._id })
      .populate('user', 'username avatar')
      .populate({
        path: 'message',
        select: 'content type chat',
        populate: {
          path: 'sender',
          select: 'username avatar _id'
        }
      })
      .sort({ createdAt: -1 });

    // Enhance notifications with sender data
    const enhancedNotifications = await Promise.all(
      notifications.map(async (notification) => {
        // Get sender based on notification type and data
        let sender = null;
        
        if (notification.type === 'message' && notification.message) {
          sender = notification.message.sender;
        } else if (notification.data && notification.data.senderId) {
          sender = await User.findById(notification.data.senderId)
            .select('_id username avatar')
            .lean();
        }
        
        return {
          ...notification.toObject(),
          sender,
        };
      })
    );

    res.status(200).json(enhancedNotifications);
  } catch (err) {
    next(new AppError('Failed to fetch notifications', 500));
  }
};

/**
 * Mark a notification as read
 */
exports.markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return next(new AppError('Notification not found', 404));
    }

    res.status(200).json({
      success: true,
      data: notification
    });
  } catch (err) {
    next(new AppError('Failed to mark notification as read', 500));
  }
};

/**
 * Mark all notifications as read
 */
exports.markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, read: false },
      { read: true }
    );

    res.status(200).json({
      success: true
    });
  } catch (err) {
    next(new AppError('Failed to mark all notifications as read', 500));
  }
};

/**
 * Delete a notification
 */
exports.deleteNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });

    if (!notification) {
      return next(new AppError('Notification not found', 404));
    }

    res.status(200).json({
      success: true
    });
  } catch (err) {
    next(new AppError('Failed to delete notification', 500));
  }
};

/**
 * Create a notification (internal use)
 */
exports.createNotification = async (userId, type, data = {}, messageId = null) => {
  try {
    const newNotification = await Notification.create({
      user: userId,
      type,
      data,
      message: messageId,
      read: false
    });

    return newNotification;
  } catch (err) {
    console.error('Failed to create notification:', err);
    return null;
  }
};

/**
 * Get unread notification count
 */
exports.getUnreadCount = async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({
      user: req.user._id,
      read: false
    });

    res.status(200).json({
      count
    });
  } catch (err) {
    next(new AppError('Failed to get unread notification count', 500));
  }
};