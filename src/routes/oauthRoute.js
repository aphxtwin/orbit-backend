const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const oauthController = require('../controllers/oauthController');

// OAuth callback routes (public - no auth required)
// This must be BEFORE the auth middleware
router.get('/callback/:channel', oauthController.callback);

// Apply authentication middleware to protected OAuth routes
router.use(authMiddleware);

// OAuth configuration routes
router.get('/config/:tenantId/:channel', oauthController.getConfig);
router.post('/config/:tenantId/:channel', oauthController.updateConfig);

// OAuth connection routes
router.get('/connect/:tenantId/:channel', oauthController.connect);

// OAuth status and disconnect routes
router.get('/status/:tenantId', oauthController.getStatus);
router.delete('/disconnect/:tenantId/:channel', oauthController.disconnect);

module.exports = router; 