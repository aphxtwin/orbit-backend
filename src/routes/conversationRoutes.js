const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationController');
const authMiddleware = require('../middleware/authMiddleware');
router.post('/', conversationController.create);
router.get('/my-conversations', authMiddleware, conversationController.getUserConversations);
router.post('/:conversationId/messages/send', authMiddleware, conversationController.sendMessage);
router.get('/:conversationId/messages', conversationController.getMessages);
router.post('/:conversationId/incoming-messages', conversationController.saveIncomingMessage);
router.get('/messages/:messageId', conversationController.getMessageById);
router.post('/:conversationId/read', authMiddleware, conversationController.markAsRead);

module.exports = router;
