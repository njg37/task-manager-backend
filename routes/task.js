const express = require('express');
const Task = require('../models/Task');
const verifyToken = require('../middleware/auth');
const router = express.Router();
const { Parser } = require('json2csv');

// Create a new task
router.post('/create', verifyToken, async (req, res) => {
  try {
    const newTask = new Task({
      title: req.body.title,
      description: req.body.description,
      dueDate: req.body.dueDate,
      status: req.body.status,
      assignedUser: req.user.id, // Default to authenticated user's ID
      priority: req.body.priority,
    });
    console.log('New task object:', JSON.stringify(newTask));
    const savedTask = await newTask.save();
    console.log('Saved task:', JSON.stringify(savedTask));
    res.status(201).json(savedTask);
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(500).json({ message: err.message });
  }
});

// Get tasks for the logged-in user (or all tasks if admin)
router.get('/', verifyToken, async (req, res) => {
  try {
    console.log('Fetching tasks for user:', req.user.id);
    
    const { status, priority, assignedUser, page = 1, limit = 10 } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignedUser) filter.assignedUser = assignedUser;

    if (!req.user.isAdmin) {
      filter.assignedUser = req.user.id;
    }

    console.log('Filter:', JSON.stringify(filter));

    const tasks = await Task.find(filter)
      .populate('assignedUser', 'username email')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    console.log('Found tasks:', tasks.length);

    const count = await Task.countDocuments(filter);
    console.log('Total count:', count);

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
    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
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
    const { format = 'json', status, priority, assignedUser } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignedUser) filter.assignedUser = assignedUser;

    if (!req.user.isAdmin) {
      filter.assignedUser = req.user.id;
    }

    const tasks = await Task.find(filter).populate('assignedUser', 'username email');

    if (format === 'csv') {
      const fields = ['title', 'description', 'dueDate', 'status', 'priority', 'assignedUser.username'];
      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(tasks);
      res.header('Content-Type', 'text/csv');
      res.attachment('task-report.csv');
      return res.send(csv);
    }

    res.status(200).json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
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