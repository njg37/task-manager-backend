const express = require('express');
const Task = require('../models/Task');
const verifyToken = require('../middleware/auth');
const router = express.Router();
const { Parser } = require('json2csv');

// Create a new task
// Create a new task
// Create a new task
// Create a new task
// Create a new task
router.post('/create', verifyToken, async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    let assignedUserId = req.user._id;

    // Handle both 'assignedUser' and 'assignUser' from the request
    if (req.body.assignedUser || req.body.assignUser) {
      if (req.user.isAdmin) {
        assignedUserId = req.body.assignedUser || req.body.assignUser;
      } else {
        // For non-admin users, always use their own ID
        assignedUserId = req.user._id;
      }
    }

    console.log('Assigned User ID:', assignedUserId);

    const newTask = new Task({
      title: req.body.title,
      description: req.body.description,
      dueDate: req.body.dueDate,
      status: req.body.status || 'To Do',
      priority: req.body.priority || 'Medium',
      assignedUser: assignedUserId
    });

    console.log('New task before save:', newTask.toObject());

    const savedTask = await newTask.save();
    console.log('Saved task:', savedTask.toObject());

    res.status(201).json(savedTask);
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(500).json({ 
      message: 'Error creating task',
      details: err.errors ? err.errors : err.message
    });
  }
});
// Get tasks for the logged-in user (or all tasks if admin)
// In routes/task.js

// In routes/task.js

// In routes/task.js

router.get('/', verifyToken, async (req, res) => {
  try {
    const { status, priority, page = 1, limit = 10 } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    if (!req.user.isAdmin) {
      filter.$or = [
        { assignedUser: req.user.id },  // Tasks where the user is the assigned user
        { creator: req.user._id }       // Tasks where the user is the creator
      ];
    }

    const tasks = await Task.find(filter)
      .populate('assignedUser', 'username email')
      .sort({ createdAt: -1 }) // Sort by creation date descending
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await Task.countDocuments(filter);

    res.status(200).json({
      tasks,
      totalPages: Math.ceil(count / limit),
      currentPage: page
    });
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).json({ message: 'An error occurred while fetching tasks' });
  }
});
// Update a task
router.put('/:id', verifyToken, async (req, res) => {
  try {
    let assignedUserId = req.user.id; // Default to authenticated user's ID

    // Allow admin to assign tasks to other users
    if (req.user.isAdmin && req.body.assignedUser) {
      assignedUserId = req.body.assignedUser;
    }

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      { $set: { ...req.body, assignedUser: assignedUserId } },
      { new: true }
    );
    res.status(200).json(updatedTask);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete a task
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Task deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Task Summary Report
router.get('/report', verifyToken, async (req, res) => {
  try {
    const { status, priority, assignedUser, startDate, endDate, format = 'json' } = req.query;

    // Build filter based on the query parameters
    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignedUser) filter.assignedUser = assignedUser;
    if (startDate || endDate) {
      filter.dueDate = {};
      if (startDate) filter.dueDate.$gte = new Date(startDate);
      if (endDate) filter.dueDate.$lte = new Date(endDate);
    }

    // Fetch tasks based on the filter
    const tasks = await Task.find(filter).populate('assignedUser', 'username email');

    // Generate CSV if requested
    if (format === 'csv') {
      const fields = ['title', 'description', 'dueDate', 'status', 'priority', 'assignedUser.username'];
      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(tasks);

      res.header('Content-Type', 'text/csv');
      res.attachment('task-report.csv');
      return res.send(csv);
    }

    // Default to returning JSON
    res.status(200).json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Error generating report', error });
  }
});

// New route for fetching tasks without authentication
router.get('/tasks', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    
    if (page < 1) {
      return res.status(400).json({ message: 'Invalid page number' });
    }

    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    const totalTasks = await Task.countDocuments({});
    const totalPages = Math.ceil(totalTasks / limit);

    const tasks = await Task.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(startIndex);

    res.status(200).json({
      tasks,
      totalPages
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ message: 'An error occurred while fetching tasks', error: error.message });
  }
});

module.exports = router;