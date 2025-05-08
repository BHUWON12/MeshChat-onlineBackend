    // backend/routes/chatRoutes.js

    const express = require('express');
    const chatController = require('../controllers/chatController'); // Import the chat controller
    const auth = require('../middleware/auth'); // Assuming this is your authentication middleware

    const router = express.Router();

    // Protect all routes with authentication middleware
    router.use(auth);

    // Unified chat initiation endpoint (Handles finding or creating a chat)
    // This replaces the need for a separate createChat route for direct messages
    router.post('/initiate/:userId', chatController.initiateChat);

    // Get all chats for the authenticated user
    // This is the endpoint called by your frontend index.tsx
    router.get('/', chatController.getAllChats);

    // Get a single chat by its ID
    router.get('/:id', chatController.getChat);

    // Update a chat by ID (e.g., for group chat name changes - if implemented)
    router.patch('/:id', chatController.updateChat);

    // Delete a chat by ID
    router.delete('/:id', chatController.deleteChat);

    // --- Routes that were likely causing the error ---
    // The 'createChat' function was commented out in chatController.js,
    // and 'initiateChat' handles creating chats for direct messages.
    // Commenting out this route:
    // router.post('/', chatController.createChat);

    // The 'connectToUser' function was also commented out and seems unrelated to chat routes.
    // Commenting out this route:
    // router.post('/connect/:userId', chatController.connectToUser);
    // --- End of commented-out routes ---


    module.exports = router;
    