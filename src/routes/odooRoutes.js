const express = require("express");
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { 
  getPartnersHandler,
  createPartnerHandler,
  getCrmStagesHandler,
  getSalesmenHandler,  // ✅ AGREGAR: Importar nuevo handler
  syncExistingContactHandler,
} = require("../controllers/odooControllers");

// ✅ Todas las rutas de Odoo necesitan autenticación
router.get("/partners", authMiddleware, getPartnersHandler);
router.post("/export-contact", authMiddleware, createPartnerHandler);
router.get("/crm-stages", authMiddleware, getCrmStagesHandler);
router.get("/salesmen", authMiddleware, getSalesmenHandler);  // ✅ NUEVA RUTA: Para obtener vendedores
// ✅ NUEVA RUTA: Para sincronizar contactos existentes
router.post("/sync-existing-contact", authMiddleware, syncExistingContactHandler);

module.exports = router;