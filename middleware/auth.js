const jwt = require('jsonwebtoken');
const User = require('../models/User');

const verifyToken = async (req, res, next) => {
  try {
    const token = req.header('Authorization').split(' ')[1]; // Remove 'Bearer '
    
    if (!token) throw new Error('No token provided.');

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch the full user object from the database
    req.user = await User.findById(decoded._id);

    if (!req.user) {
      throw new Error('User not found.');
    }

    next();
  } catch (error) {
    console.error('Authentication error:', error.message);
    res.status(401).json({ 
      message: 'Access denied.',
      details: error.message
    });
  }
};

module.exports = verifyToken;