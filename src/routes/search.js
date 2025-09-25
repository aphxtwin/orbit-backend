const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');
const authMiddleware = require('../middleware/authMiddleware');

// GET /search/messages?q=palabra (PROTECTED)
router.get('/messages', authMiddleware, searchController.searchMessages);

module.exports = router;
