// backend/models/User.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Define the connection schema first (Keep as is)
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
    required: [true, 'Please tell us your username!'],
    trim: true, // Optional: trim whitespace
    unique: true // Optional: ensure usernames are unique
  },
  email: {
    type: String,
    required: [true, 'Please provide your email!'],
    unique: true,
    lowercase: true, // Optional: store emails in lowercase
    // Add email validation if needed
    // validate: [validator.isEmail, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 8,
    select: false // Exclude password from query results by default
  },
  // *** ADDED BIO FIELD HERE (Keep as is) ***
  bio: {
    type: String,
    default: '' // Optional: set a default empty string if no bio is provided
  },
  // *** END ADDED BIO FIELD ***

  // --- ADDED ONLINE STATUS AND LAST ACTIVE FIELDS (Keep as is) ---
  isOnline: {
    type: Boolean,
    default: false // Default to false (offline)
  },
  lastActive: {
    type: Date,
    default: Date.now // Default to current time
  },
  // --- END ADDED FIELDS ---

  avatar: { // Optional: Add avatar field if you store avatar URLs in the DB (Keep as is)
      type: String,
      default: '' // Default to empty string or a placeholder URL
  },


  connections: [connectionSchema]  // Reference connectionSchema here (Keep as is)
}, {
  timestamps: true, // This adds createdAt and updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Hash password before saving the user (Keep as is)
userSchema.pre('save', async function (next) {
  // Only run this function if password was actually modified
  if (!this.isModified('password')) return next();
  // Hash the password with cost of 12
  this.password = await bcrypt.hash(this.password, 12);
  // Do not persist passwordConfirm (assuming you have one in your input schema)
  // this.passwordConfirm = undefined;
  next();
});

// --- UPDATED Method to check password ---
userSchema.methods.correctPassword = async function (candidatePassword) {
  // 'this' refers to the current user document
  // this.password is the hashed password from the database (because select: false was overridden by select('+password') in the query)
  console.log("User Model: Comparing candidate password with stored password."); // Debug log
  return await bcrypt.compare(candidatePassword, this.password); // Use this.password directly
};
// --- END UPDATED Method ---


// Avoid overwriting the User model if it's already defined (Keep as is)
const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;
