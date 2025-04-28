const User = require('../models/User');
const AppError = require('../utils/appError');

// GET /users/me
exports.getCurrentUser = async (req, res, next) => {
  try {
    const user = req.user.toObject();
    delete user.password; // remove sensitive info
    res.status(200).json({
      status: 'success',
      data: user,
    });
  } catch (err) {
    console.log(err, "error in getCurrentUser");
    next(err);
  }
};

// PUT /users/me
exports.updateUserProfile = async (req, res, next) => {
  try {
    const allowedUpdates = ['username', 'email', 'avatar', 'bio'];
    const updates = {};
    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const updatedUser = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    }).select('-password');

    if (!updatedUser) {
      return next(new AppError('User not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: updatedUser,
    });
  } catch (err) {
    next(err);
  }
};

// GET /users/search?email=...
exports.searchUsers = async (req, res, next) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ status: 'fail', message: 'Email query parameter is required' });
    }

    // Find users with email matching (case-insensitive), excluding current user
    const users = await User.find({
      email: { $regex: email, $options: 'i' },
      _id: { $ne: req.user._id }
    }).select('-password');

    res.status(200).json({
      status: 'success',
      data: users,
    });
  } catch (err) {
    next(err);
  }
};
