const AppError = require('../utils/appError');

const handleCastErrorDB = err => new AppError(`Invalid ${err.path}: ${err.value}`, 400);
const handleDuplicateFieldsDB = err => new AppError(`Duplicate field value: ${Object.values(err.keyValue)}`, 400);
const handleValidationErrorDB = err => new AppError(`Invalid input data: ${Object.values(err.errors).map(el => el.message).join('. ')}`, 400);
const handleJWTError = () => new AppError('Invalid token. Please log in again!', 401);
const handleJWTExpiredError = () => new AppError('Your token has expired! Please log in again.', 401);

const sendError = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    error: process.env.NODE_ENV === 'development' ? err : {},
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  let error = { ...err };
  error.message = err.message;

  if (error.name === 'CastError') error = handleCastErrorDB(error);
  if (error.code === 11000) error = handleDuplicateFieldsDB(error);
  if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
  if (error.name === 'JsonWebTokenError') error = handleJWTError();
  if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

  sendError(error, res);
};
