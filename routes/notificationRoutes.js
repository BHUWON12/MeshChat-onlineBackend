const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
// Correctly import the default exported middleware
const protect = require('../middleware/auth'); // CORRECTED IMPORT

// All routes are protected
router.use(protect); // This will now correctly use the imported middleware function

// Get all notifications
router.get('/', notificationController.getNotifications);

// Get unread notification count
router.get('/unread-count', notificationController.getUnreadCount);

// Mark all notifications as read
router.patch('/read-all', notificationController.markAllAsRead);

// Mark a notification as read
router.patch('/:id/read', notificationController.markAsRead);

// Delete a notification
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;
