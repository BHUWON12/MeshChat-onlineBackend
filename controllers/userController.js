
const User = require('../models/User');
const AppError = require('../utils/appError');

exports.getCurrentUser = async (req, res, next) => {
  try {
    const user = req.user.toObject();
    delete user.password;
    res.status(200).json({
      status: 'success',
      data: user,
    });
  } catch (err) {
    console.log(err, "error in getCurrentUser");
    next(err);
  }
};
exports.updateUserProfile = async (req, res, next) => {
  try {
    const allowedUpdates = ['username', 'email', 'avatar', 'bio']; // 'bio' is included here
    const updates = {};
    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) updates[key] = req.body[key]; // It attempts to add bio from req.body
    }

    // It uses findByIdAndUpdate with the collected updates
    const updatedUser = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    }).select('-password'); // It selects all fields except password

    if (!updatedUser) {
      return next(new AppError('User not found', 404));
    }

    // It sends the updated user object back
    res.status(200).json({
      status: 'success',
      data: updatedUser,
    });
  } catch (err) {
    next(err);
  }
};

exports.searchUsers = async (req, res, next) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ status: 'fail', message: 'Email query parameter is required' });
    }

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

exports.getConnections = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('connections.user', 'username email avatar isOnline lastActive');

    const acceptedConnections = user.connections
      .filter(c => c.status === 'accepted')
      .map(c => c.user);

    res.status(200).json({ status: 'success', data: acceptedConnections });
  } catch (err) {
    next(err);
  }
};

exports.checkConnectionStatus = async (req, res, next) => {
  try {
    const targetUser = await User.findById(req.params.userId);
    const currentUser = await User.findById(req.user._id);

    const connection = currentUser.connections.find(c => 
      c.user.equals(targetUser._id)
    );

    res.status(200).json({
      status: 'success',
      data: {
        exists: !!connection,
        accepted: connection?.status === 'accepted',
        isOnline: targetUser.isOnline,
        lastActive: targetUser.lastActive
      }
    });
  } catch (err) {
    next(err);
  }
};
