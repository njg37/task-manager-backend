const express = require('express');
const User = require('../models/User');
const verifyToken = require('../middleware/auth'); // Ensure user is authenticated
const router = express.Router();

// Fetch all users - Only for admins
router.get('/', verifyToken, async (req, res) => {
  try {
    // Check if the current user is an admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Access denied. Admins only.' });
    }

    // Fetch all users
    const users = await User.find({}, 'username email'); // Retrieve username and email only
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

module.exports = router;
