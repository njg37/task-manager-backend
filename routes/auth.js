const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Joi = require('joi');
const router = express.Router();

// Define schema for user registration
const registerSchema = Joi.object().keys({
  username: Joi.string().alphanum().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(5).required(),
  role: Joi.string().valid('user', 'admin').optional() 
});

// Define schema for user login
const loginSchema = Joi.object().keys({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// Register a new user
router.post('/register', async (req, res) => {
  try {
    // Validate input
    const { error, value } = registerSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    // Check if user already exists
    const userExists = await User.findOne({ email: req.body.email });
    if (userExists) return res.status(400).json({ message: 'User already exists' });

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.password, salt);

    // Create new user with role option
    const newUser = new User({
      username: req.body.username,
      email: req.body.email,
      password: hashedPassword,
      isAdmin: req.body.role === 'admin', // Set isAdmin based on the role
    });

    // Save the user to the database
    const savedUser = await newUser.save();
    res.status(201).json(savedUser);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// Login a user
router.post('/login', async (req, res) => {
  try {
    // Validate input
    const { error, value } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

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
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// Logout a user
router.post('/logout', async (req, res) => {
  // Since JWT is stateless, we can't invalidate the token server-side.
  // Instead, just send a response indicating the logout was successful.
  res.status(200).json({ message: 'Logged out successfully' });
});

module.exports = router;