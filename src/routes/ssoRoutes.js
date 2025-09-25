const express = require('express');
const ssoControllers = require('../controllers/ssoControllers');
const authMiddleware = require('../middleware/authMiddleware'); // ← Agregar

const router = express.Router();

// // ✅ Rutas públicas (no necesitan auth)
router.get('/callback', ssoControllers.ssoCallback);
router.post('/callback', ssoControllers.ssoCallback);
router.get('/sso', ssoControllers.ssoCallback);
router.post('/sso', ssoControllers.ssoCallback);

// ✅ Rutas que necesitan autenticación
router.post('/logout', authMiddleware, ssoControllers.logout);
router.get('/logout', authMiddleware, ssoControllers.logout);



// ❌ REMOVER - Rutas de debug/testing
// router.get('/debug', ssoControllers.debugAuth);
// router.get('/test-login', ssoControllers.testLogin);

module.exports = router;