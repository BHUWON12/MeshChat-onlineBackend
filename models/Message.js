const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: [true, 'Chat reference is required']
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Sender is required']
  },
  content: {
    type: String,
    required: function() { return this.type === 'text'; },
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'read'],
    default: 'pending'
  },
  type: {
    type: String,
    enum: ['text', 'image', 'video', 'file', 'location'],
    default: 'text'
  },
  metadata: {
    url: String,
    size: Number,
    duration: Number,
    coordinates: {
      lat: Number,
      lng: Number
    },
    thumbnail: String
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  reactions: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    emoji: String
  }],
  edited: {
    type: Boolean,
    default: false
  },
  deleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

messageSchema.index({ content: 'text' });

module.exports = mongoose.model('Message', messageSchema);
