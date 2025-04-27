const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    required: true
  },
  read: {
    type: Boolean,
    default: false
  },
  type: {
    type: String,
    enum: ['message', 'group', 'system'],
    required: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed
  }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
