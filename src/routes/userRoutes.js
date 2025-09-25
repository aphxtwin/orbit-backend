const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const appUserController = require('../controllers/appUserController');
const authMiddleware = require('../middleware/authMiddleware');

// ✅ RUTA PÚBLICA (webhooks)
router.post('/', userController.create);

// ✅ RUTAS PROTEGIDAS (necesitan odooSessionId para sincronización)
router.get('/:userId', authMiddleware, userController.getUserById);
router.post('/bulk', authMiddleware, userController.getUsersByIds);
router.put('/:id', authMiddleware, userController.update);

// ✅ RUTAS PÚBLICAS (no necesitan autenticación)
router.post('/lookup', userController.lookupContact);
router.post('/merge', userController.mergeContacts);

module.exports = router;
