const User = require('../models/User');
const AppError = require('../utils/appError');

// GET /users/me
exports.getCurrentUser = async (req, res, next) => {
  try {
    // req.user is set by auth middleware
    const user = req.user.toObject();
    delete user.password; // remove sensitive info
    res.status(200).json({
      status: 'success',
      data: user,
    });
  } catch (err) {
    console.log(err,"error in getCurrentUser");
    next(err);
  }
};

// PUT /users/me
exports.updateUserProfile = async (req, res, next) => {
  try {
    // Only allow updating certain fields for security
    const allowedUpdates = ['username', 'email', 'avatar', 'bio'];
    const updates = {};
    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    // Update user and return updated document
    const updatedUser = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    }).select('-password'); // exclude password

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
