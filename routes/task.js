const express = require('express');
const Task = require('../models/Task');
const verifyToken = require('../middleware/auth');
const Joi = require('joi');
const router = express.Router();
const { Parser } = require('json2csv');

// Function to validate GUID
const isGuid = (value) => {
  const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return guidRegex.test(value);
};

// Create schema
const createSchema = Joi.object().keys({
  title: Joi.string().required(),
  description: Joi.string().optional(),
  dueDate: Joi.date().iso().optional(),
  status: Joi.string().valid('To Do', 'In Progress', 'Completed').default('To Do'),
  priority: Joi.string().valid('Low', 'Medium', 'High').default('Medium'),
  assignedUser: Joi.string().custom(isGuid).optional()
});

// Update schema
const updateSchema = Joi.object().keys({
  title: Joi.string().optional(),
  description: Joi.string().optional(),
  dueDate: Joi.date().iso().optional(),
  status: Joi.string().valid('To Do', 'In Progress', 'Completed').optional(),
  priority: Joi.string().valid('Low', 'Medium', 'High').optional(),
  assignedUser: Joi.string().custom(isGuid).optional()
});

// Create a new task
router.post('/create', verifyToken, async (req, res) => {
  try {
    const { error, value } = createSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    let assignedUserId = req.user._id;

    if (req.body.assignedUser || req.body.assignUser) {
      if (req.user.isAdmin) {
        assignedUserId = req.body.assignedUser || req.body.assignUser;
      } else {
        assignedUserId = req.user._id;
      }
    }

    console.log('Assigned User ID:', assignedUserId);

    const newTask = new Task({
      title: value.title,
      description: value.description,
      dueDate: value.dueDate,
      status: value.status,
      priority: value.priority,
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
router.get('/', verifyToken, async (req, res) => {
  try {
    const { status, priority, page = 1, limit = 10 } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    if (!req.user.isAdmin) {
      filter.$or = [
        { assignedUser: req.user.id },
        { creator: req.user._id }
      ];
    }

    const tasks = await Task.find(filter)
      .populate('assignedUser', 'username email')
      .sort({ createdAt: -1 })
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
    res.status(500).json({ message: 'An error occurred while fetching tasks', error: err.message });
  }
});

// Update a task
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { error, value } = updateSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    let assignedUserId = req.user.id;

    if (req.user.isAdmin && req.body.assignedUser) {
      assignedUserId = req.body.assignedUser;
    }

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      { $set: { ...value, assignedUser: assignedUserId } },
      { new: true }
    );

    if (!updatedTask) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.status(200).json(updatedTask);
  } catch (err) {
    res.status(500).json({ message: 'Error updating task', error: err.message });
  }
});

// Delete a task
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const deletedTask = await Task.findByIdAndDelete(req.params.id);
    if (!deletedTask) {
      return res.status(404).json({ message: 'Task not found' });
    }
    res.status(200).json({ message: 'Task deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting task', error: err.message });
  }
});

// Task Summary Report
router.get('/report', verifyToken, async (req, res) => {
  try {
    const { status, priority, assignedUser, startDate, endDate, format = 'json' } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignedUser) filter.assignedUser = assignedUser;
    if (startDate || endDate) {
      filter.dueDate = {};
      if (startDate) filter.dueDate.$gte = new Date(startDate);
      if (endDate) filter.dueDate.$lte = new Date(endDate);
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
  } catch (error) {
    res.status(500).json({ message: 'Error generating report', error: error.message });
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