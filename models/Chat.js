// backend/models/Chat.js

const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message' // Reference to the Message model
  },
  // --- ADDED lastMessageAt FIELD ---
  lastMessageAt: {
    type: Date,
    default: Date.now // Default to current time when chat is created
  },
  // --- END ADDED FIELD ---
  connection: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User.connections' // Assuming this is intended to reference an embedded connection subdocument? This might need adjustment depending on your User schema structure. If 'connections' is an array of subdocuments, referencing it like this might not work as expected for a single connection ID. Consider if this field is truly necessary on the Chat or if the connection status is derived from the User's connections array.
  }
}, {
  timestamps: true, // This adds createdAt and updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index participants for efficient lookup
chatSchema.index({ participants: 1 });
// Index lastMessage for efficient lookup (less common, lastMessageAt is usually indexed)
// chatSchema.index({ lastMessage: 1 }); // Consider indexing lastMessageAt instead

// --- ADDED INDEX FOR lastMessageAt ---
chatSchema.index({ lastMessageAt: -1 }); // Index for sorting by newest message
// --- END ADDED INDEX ---


// Virtual property to get all messages associated with this chat
chatSchema.virtual('messages', {
  ref: 'Message',
  localField: '_id', // Field on the Chat document
  foreignField: 'chatId' // Field on the Message document
});

// Export the Chat model
module.exports = mongoose.model('Chat', chatSchema);
