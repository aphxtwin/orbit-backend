// routes/internalUserRoutes.js
const express = require('express');
const router = express.Router();
const InternalUser = require('../models/InternalUser');
const Tenant = require('../models/Tenant');

// POST /api/internal-users/check-odoo-user
router.post('/check-odoo-user', async (req, res) => {
  console.log('🔍 Verificando usuario de Odoo en Orbit');
  console.log('📥 Body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { odoo_user_id, tenant_info } = req.body;
    
    if (!odoo_user_id) {
      return res.status(400).json({ 
        error: 'Bad Request',
        message: 'odoo_user_id es requerido'
      });
    }
    
    if (!tenant_info || !tenant_info.rex_url) {
      return res.status(400).json({ 
        error: 'Bad Request',
        message: 'tenant_info con rex_url es requerido'
      });
    }
    
    // Buscar el tenant por rex_url
    console.log('🔍 Buscando tenant por rex_url:', tenant_info.rex_url);
    const tenant = await Tenant.findOne({ rexUrl: tenant_info.rex_url });
    
    if (!tenant) {
      return res.status(404).json({ 
        error: 'Tenant not found',
        message: `Tenant no encontrado para rex_url: ${tenant_info.rex_url}`
      });
    }
    
    console.log('✅ Tenant encontrado:', tenant._id);
    
    // Buscar el InternalUser que tenga este odooUserId
    console.log('🔍 Buscando InternalUser por odooUserId:', odoo_user_id);
    const internalUser = await InternalUser.findOne({
      odooUserId: odoo_user_id,
      tenantId: tenant._id.toString()
    });
    
    if (internalUser) {
      console.log('✅ InternalUser encontrado:', internalUser._id);
      console.log('📝 Usuario:', internalUser.name, '(', internalUser.email, ')');
      
      res.json({
        exists: true,
        user: {
          id: internalUser._id,
          name: internalUser.name,
          email: internalUser.email,
          odooUserId: internalUser.odooUserId
        }
      });
    } else {
      console.log('⚠️ InternalUser no encontrado para odooUserId:', odoo_user_id);
      
      res.json({
        exists: false,
        user: null
      });
    }
    
  } catch (error) {
    console.error('❌ Error verificando usuario de Odoo:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error interno verificando usuario',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
