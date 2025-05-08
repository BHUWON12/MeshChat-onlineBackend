// backend/models/Notification.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: { // The user who receives the notification
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Make message optional
  message: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    required: false // <--- CHANGE THIS TO false
  },
  read: {
    type: Boolean,
    default: false
  },
  type: {
    type: String,
    // Make sure enum includes all your notification types
    enum: ['message', 'connection_request', 'connection_accepted', 'system'], // <--- ENSURE ALL TYPES ARE HERE
    required: true
  },
  data: {
    // Use this for extra data like senderId, requestId, connectionId etc.
    type: mongoose.Schema.Types.Mixed
  }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);