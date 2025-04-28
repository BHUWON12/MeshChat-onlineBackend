const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  // console.log("checking if the auth token is valid");
  const authHeader = req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.replace('Bearer ', '');
  try {
    // console.log("checking if the auth token is valid");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id); // Secure: always fetch user from DB
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
