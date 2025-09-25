const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware'); // ← Agregar
const appUserController = require('../controllers/appUserController');

// ✅ Ruta para obtener AppUser actual (necesita autenticación)
router.get('/me', authMiddleware, appUserController.getMe);

module.exports = router;