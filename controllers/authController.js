const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/appError');

const signToken = id => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

exports.register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    const user = await User.create({ username, email, password });
    const token = signToken(user._id);
    res.status(201).json({
      status: 'success',
      token,
      data: { user }
    });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return next(new AppError('Please provide email and password', 400));
    }
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.correctPassword(password))) {
      return next(new AppError('Incorrect email or password', 401));
    }
    console.log('User found:', user);
    const token = signToken(user._id);
    res.status(200).json({
      status: 'success',
      token,
      data: { user }
    });
  } catch (err) {
    next(err);
  }
};

exports.protect = async (req, res, next) => {
  try {
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
      return next(new AppError('You are not logged in!', 401));
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return next(new AppError('User no longer exists', 401));
    }
    req.user = currentUser;
    next();
  } catch (err) {
    next(err);
  }
};
