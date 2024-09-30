const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

// Register a new user
router.post('/register', async (req, res) => {
  try {
    // Check if user already exists
    const userExists = await User.findOne({ email: req.body.email });
    if (userExists) return res.status(400).json({ message: 'User already exists' });

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.password, salt);

    // Create new user
    const newUser = new User({
      username: req.body.username,
      email: req.body.email,
      password: hashedPassword,
    });

    // Save the user to the database
    const savedUser = await newUser.save();
    res.status(201).json(savedUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Login a user
// Login a user
router.post('/login', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(400).json({ message: 'User not found' });

    const isPasswordValid = await bcrypt.compare(req.body.password, user.password);
    if (!isPasswordValid) return res.status(400).json({ message: 'Invalid credentials' });

    // Create JWT token, including the `_id` and `isAdmin` flag
    const token = jwt.sign({ 
      _id: user._id,
      isAdmin: user.isAdmin 
    }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Send token and isAdmin status as part of the response
    res.status(200).json({
      token,
      isAdmin: user.isAdmin, // Send this explicitly so the frontend can store it
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
module.exports = router;
