const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Define the connection schema first
const connectionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    required: true
  },
  initiatedAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: Date
}, { _id: false });  // Set _id to false as this schema is embedded

// Define your user schema
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Please tell us your username!']
  },
  email: {
    type: String,
    required: [true, 'Please provide your email!'],
    unique: true
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 8,
    select: false
  },
  // *** ADDED BIO FIELD HERE ***
  bio: {
    type: String,
    default: '' // Optional: set a default empty string if no bio is provided
  },
  // *** END ADDED BIO FIELD ***
  connections: [connectionSchema]  // Reference connectionSchema here
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Hash password before saving the user
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Method to check password
userSchema.methods.correctPassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Avoid overwriting the User model
const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;